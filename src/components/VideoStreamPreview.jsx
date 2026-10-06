import { useEffect, useRef, useState } from "react";
import { IDB } from "../database.js";
import { Crypto } from "../crypto.js";

const POLL_MS = 1500;

function isSafariNative(video) {
  return Boolean(video?.canPlayType?.("application/vnd.apple.mpegurl"));
}

async function waitForHlsReady(jobId, signal, setStatus) {
  while (!signal.aborted) {
    const state = await IDB.videoJobStatus(jobId);
    if (state.status === "ready") return state;
    if (state.status === "failed") {
      throw new Error(state.error || "Pemrosesan HLS gagal.");
    }

    if (state.status === "uploading") {
      setStatus("Menyiapkan data video...");
    } else if (state.status === "queued") {
      setStatus("Antrean transcoding...");
    } else {
      setStatus(
        state.progress
          ? "Memproses HLS " + state.progress + "%"
          : "Memproses HLS..."
      );
    }

    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }

  throw new Error("Streaming dibatalkan.");
}

async function createHlsFromExistingChunks(file, archiveId, fileIndex, archiveKey, signal, setStatus) {
  if (file.storageMode !== "chunks" || file.encryptionMode !== "chunked-aes-gcm-v1") {
    throw new Error("Video lama belum menggunakan format chunk yang didukung untuk HLS.");
  }

  const job = await IDB.videoJobStart({
    size: file.size,
    name: file.name,
    type: file.type,
  });

  const plainChunkSize = Number(file.encryptionChunkSize);
  const count = Number(file.chunkCount);
  if (!Number.isSafeInteger(plainChunkSize) || plainChunkSize <= 0 ||
      !Number.isSafeInteger(count) || count <= 0) {
    await IDB.videoJobCancel(job.jobId).catch(() => {});
    throw new Error("Metadata video chunk tidak valid.");
  }

  let offset = 0;
  try {
    for (let i = 0; i < count; i++) {
      if (signal.aborted) throw new Error("Streaming dibatalkan.");
      const encrypted = await IDB.videoChunk(archiveId, fileIndex, i);
      const plain = await Crypto.decryptChunkWithKey(encrypted, archiveKey);
      await IDB.videoJobChunk(job.jobId, offset, plain);
      offset += plain.byteLength;
      setStatus(
        "Menyiapkan streaming HLS " +
        Math.round((offset / Math.max(1, file.size)) * 100) + "%"
      );
    }

    await IDB.videoJobFinish(job.jobId);
    return job.jobId;
  } catch (error) {
    await IDB.videoJobCancel(job.jobId).catch(() => {});
    throw error;
  }
}

async function attachJobToArchive(archiveId, fileIndex, file, jobId, canEdit) {
  if (!canEdit || file.hlsJobId === jobId) return;
  const nextFiles = [];
  const fresh = await IDB.get(archiveId);
  if (!fresh?.files?.length) return;

  for (let i = 0; i < fresh.files.length; i++) {
    nextFiles.push(
      i === fileIndex
        ? { ...fresh.files[i], hlsJobId: jobId, hlsStatus: "processing" }
        : fresh.files[i]
    );
  }

  await IDB.update(
    archiveId,
    { files: nextFiles, updatedAt: new Date().toISOString() },
    null
  ).catch(() => {});
}

async function setupHlsVideo(video, jobId, signal, setStatus) {
  const state = await waitForHlsReady(jobId, signal, setStatus);
  const manifestUrl = "/api/video-stream/jobs/" + encodeURIComponent(jobId) + "/master.m3u8";

  if (isSafariNative(video)) {
    video.src = manifestUrl;
    video.load();
    setStatus("Streaming HLS siap.");
    return () => {};
  }

  const mod = await import("hls.js");
  const Hls = mod.default || mod;
  if (!Hls?.isSupported?.()) {
    throw new Error("Browser ini tidak mendukung HLS melalui MediaSource.");
  }

  const hls = new Hls({
    enableWorker: true,
    backBufferLength: 30,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    xhrSetup: xhr => {
      xhr.withCredentials = true;
    },
  });

  const cleanup = () => {
    hls.destroy();
  };

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data?.fatal) {
      setStatus(data.details || "HLS mengalami galat.");
    }
  });

  hls.loadSource(manifestUrl);
  hls.attachMedia(video);
  setStatus(
    state.variants?.length
      ? "Streaming adaptif " + state.variants.join(", ") + "p"
      : "Streaming HLS siap."
  );

  return cleanup;
}

export function VideoStreamPreview({
  file,
  archiveId,
  fileIndex,
  archiveKey,
  canEdit = false,
  onJobReady,
  onError,
}) {
  const videoRef = useRef(null);
  const onJobReadyRef = useRef(onJobReady);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState("Menyiapkan streaming...");

  useEffect(() => {
    onJobReadyRef.current = onJobReady;
    onErrorRef.current = onError;
  }, [onJobReady, onError]);

  useEffect(() => {
    const controller = new AbortController();
    let cleanupPlayer = () => {};

    const run = async () => {
      try {
        let jobId = file.hlsJobId;

        if (!jobId) {
          if (!archiveKey) {
            throw new Error("Kunci arsip tidak tersedia untuk menyiapkan HLS.");
          }
          setStatus("Membuat streaming HLS dari video...");
          jobId = await createHlsFromExistingChunks(
            file,
            archiveId,
            fileIndex,
            archiveKey,
            controller.signal,
            setStatus
          );
          await onJobReadyRef.current?.(jobId);
        }

        cleanupPlayer = await setupHlsVideo(
          videoRef.current,
          jobId,
          controller.signal,
          setStatus
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus(error.message || "Streaming HLS gagal.");
          onErrorRef.current?.(error);
        }
      }
    };

    run();

    return () => {
      controller.abort();
      cleanupPlayer();
    };
  }, [file, archiveId, fileIndex, archiveKey]);

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
