import { useEffect, useRef, useState } from "react";
import { IDB } from "../database.js";
import { Crypto } from "../crypto.js";

const MAX_BUFFER_AHEAD = 30;

function waitForEvent(target, eventName, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let timer;
    const done = () => {
      clearTimeout(timer);
      target.removeEventListener(eventName, onEvent);
      resolve();
    };
    const onEvent = () => done();
    target.addEventListener(eventName, onEvent, { once: true });
    timer = setTimeout(() => {
      target.removeEventListener(eventName, onEvent);
      reject(new Error("Browser terlalu lama memproses buffer video."));
    }, timeoutMs);
  });
}

async function appendBufferAsync(sourceBuffer, data) {
  while (sourceBuffer.updating) await waitForEvent(sourceBuffer, "updateend");
  sourceBuffer.appendBuffer(data);
  await waitForEvent(sourceBuffer, "updateend");
}

function bufferedAhead(video) {
  const ranges = video.buffered;
  if (!ranges.length) return 0;
  const t = video.currentTime || 0;
  for (let i = 0; i < ranges.length; i++) {
    if (t >= ranges.start(i) - 0.25 && t <= ranges.end(i) + 0.25) {
      return Math.max(0, ranges.end(i) - t);
    }
  }
  return Math.max(0, ranges.end(ranges.length - 1) - t);
}

async function waitForBufferRoom(video) {
  while (!video.paused && bufferedAhead(video) >= MAX_BUFFER_AHEAD) {
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

function candidateWebmTypes(file) {
  const ext = String(file.name || "").toLowerCase().split(".").pop();
  const base = file.type === "video/webm" || ext === "webm" ? "video/webm" : file.type || "video/mp4";
  return [...new Set([
    file.type,
    base,
    "video/webm; codecs=\"vp9,opus\"",
    "video/webm; codecs=\"vp8,opus\"",
    "video/webm",
  ].filter(Boolean))];
}

async function streamWebm({ video, file, archiveKey, archiveId, fileIndex, signal, setStatus }) {
  if (!window.MediaSource) throw new Error("Browser tidak mendukung Media Source streaming.");
  const mime = candidateWebmTypes(file).find(t => MediaSource.isTypeSupported(t));
  if (!mime) throw new Error("Browser ini tidak mendukung format WebM untuk streaming.");

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  video.src = objectUrl;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Media Source gagal dibuka.")), 15000);
    mediaSource.addEventListener("sourceopen", () => { clearTimeout(timer); resolve(); }, { once: true });
    mediaSource.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Media Source mengalami galat.")); }, { once: true });
  });

  const sourceBuffer = mediaSource.addSourceBuffer(mime);
  sourceBuffer.mode = "segments";
  try {
    for (let i = 0; i < file.chunkCount; i++) {
      if (signal.aborted) return;
      await waitForBufferRoom(video);
      const encrypted = await IDB.videoChunk(archiveId, fileIndex, i);
      const plain = await Crypto.decryptChunkWithKey(encrypted, archiveKey);
      await appendBufferAsync(sourceBuffer, plain);
      setStatus("Streaming " + Math.round(((i + 1) / file.chunkCount) * 100) + "%");
      if (i === 0) video.play().catch(() => {});
    }
    while (sourceBuffer.updating) await waitForEvent(sourceBuffer, "updateend");
    if (mediaSource.readyState === "open") mediaSource.endOfStream();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function streamMp4({ video, file, archiveKey, archiveId, fileIndex, signal, setStatus }) {
  if (!window.MediaSource) throw new Error("Browser tidak mendukung Media Source streaming.");

  const mod = await import("mp4box");
  const MP4Box = mod.default || mod;
  if (!MP4Box || !MP4Box.createFile) throw new Error("MP4Box.js tidak tersedia.");

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  video.src = objectUrl;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Media Source gagal dibuka.")), 15000);
    mediaSource.addEventListener("sourceopen", () => { clearTimeout(timer); resolve(); }, { once: true });
    mediaSource.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Media Source mengalami galat.")); }, { once: true });
  });

  const mp4boxfile = MP4Box.createFile();
  const tracks = new Map();
  let ready = false;
  let started = false;
  let parserError = null;

  async function appendQueue(state) {
    if (state.busy) return;
    state.busy = true;
    try {
      while (state.queue.length) {
        const buffer = state.queue.shift();
        await appendBufferAsync(state.sourceBuffer, buffer);
      }
    } finally {
      state.busy = false;
    }
  }

  mp4boxfile.onError = error => {
    parserError = new Error(String(error || "Gagal memproses video MP4."));
  };

  mp4boxfile.onReady = info => {
    ready = true;
    try {
      for (const track of info.tracks || []) {
        if (track.type !== "video" && track.type !== "audio") continue;
        if (!track.codec) continue;
        const mime = track.type + "/mp4; codecs=\"" + track.codec + "\"";
        if (!MediaSource.isTypeSupported(mime)) continue;
        const state = { sourceBuffer: mediaSource.addSourceBuffer(mime), queue: [], busy: false };
        state.sourceBuffer.mode = "segments";
        tracks.set(track.id, state);
        mp4boxfile.setSegmentOptions(track.id, state, { nbSamples: 300, rapAlignement: true });
      }
      if (!tracks.size) throw new Error("Codec video/audio tidak didukung browser untuk streaming.");
      const initial = mp4boxfile.initializeSegmentation("per-track") || [];
      Promise.all(initial.map(async seg => {
        const state = tracks.get(seg.id);
        if (state && seg.buffer) await appendBufferAsync(state.sourceBuffer, seg.buffer);
      })).then(() => {
        if (!signal.aborted) { started = true; mp4boxfile.start(); }
      }).catch(error => { parserError = error; });
    } catch (error) {
      parserError = error;
    }
  };

  mp4boxfile.onSegment = (id, user, buffer, sampleNumber) => {
    const state = user || tracks.get(id);
    if (!state || !buffer) return;
    state.queue.push(buffer);
    appendQueue(state).catch(error => { parserError = error; });
    setStatus("Streaming video...");
  };

  try {
    const plainChunkSize = Number(file.encryptionChunkSize);
    if (!Number.isSafeInteger(plainChunkSize) || plainChunkSize <= 0) {
      throw new Error("Metadata streaming video tidak valid.");
    }
    for (let i = 0; i < file.chunkCount; i++) {
      if (signal.aborted) return;
      if (parserError) throw parserError;
      const encrypted = await IDB.videoChunk(archiveId, fileIndex, i);
      const plain = await Crypto.decryptChunkWithKey(encrypted, archiveKey);
      const data = plain.slice(0);
      data.fileStart = Math.min(i * plainChunkSize, file.size);
      mp4boxfile.appendBuffer(data);
      setStatus("Menganalisis video " + Math.round(((i + 1) / file.chunkCount) * 100) + "%");
      if (started) await waitForBufferRoom(video);
    }
    mp4boxfile.flush();
    for (let i = 0; i < 120; i++) {
      if (parserError) throw parserError;
      const queuesEmpty = Array.from(tracks.values()).every(x => !x.busy && !x.queue.length);
      if (started && queuesEmpty) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (parserError) throw parserError;
    if (mediaSource.readyState === "open") mediaSource.endOfStream();
    video.play().catch(() => {});
  } finally {
    try { mp4boxfile.stop(); } catch {}
    URL.revokeObjectURL(objectUrl);
  }
}

export function VideoStreamPreview({ file, archiveId, fileIndex, archiveKey, onError }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("Menyiapkan streaming...");

  useEffect(() => {
    const controller = new AbortController();
    const video = videoRef.current;
    const run = async () => {
      try {
        if (!video) return;
        const ext = String(file.name || "").toLowerCase().split(".").pop();
        const isMp4Family = ["mp4", "m4v", "mov"].includes(ext) || file.type === "video/mp4" || file.type === "video/quicktime";
        if (isMp4Family) {
          await streamMp4({ video, file, archiveKey, archiveId, fileIndex, signal: controller.signal, setStatus });
        } else {
          await streamWebm({ video, file, archiveKey, archiveId, fileIndex, signal: controller.signal, setStatus });
        }
        if (!controller.signal.aborted) setStatus("Selesai memuat video.");
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus(error.message || "Streaming video gagal.");
          onError?.(error);
        }
      }
    };
    run();
    return () => controller.abort();
  }, [file, archiveId, fileIndex, archiveKey, onError]);

  return (
    <div style={{ width: "100%" }}>
      <video
        ref={videoRef}
        controls
        controlsList="nodownload"
        playsInline
        preload="metadata"
        onContextMenu={e => e.preventDefault()}
        style={{ width: "100%", maxHeight: "70vh", background: "#000" }}
      />
      <div className="td-sub" style={{ marginTop: 8 }}>{status}</div>
    </div>
  );
}