import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { spawn } from "child_process";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const ffprobePath = ffprobeStatic.path;

export const VIDEO_HLS_CHUNK = 4 * 1024 * 1024;
const JOB_ID_RE = /^[a-f0-9]{48}$/;
const SERVER_KEY = process.env.SERVER_KEY || "";
const running = new Map();

function stateKey() {
  return crypto.createHash("sha256").update(SERVER_KEY).digest();
}

function encryptState(value) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", stateKey(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decryptState(buffer) {
  const iv = buffer.subarray(0, 16);
  const tag = buffer.subarray(16, 32);
  const body = buffer.subarray(32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", stateKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")
  );
}

function safeJobId(jobId) {
  return JOB_ID_RE.test(String(jobId || "")) ? String(jobId) : null;
}

function jobDir(root, jobId) {
  const safe = safeJobId(jobId);
  return safe ? path.join(root, safe) : null;
}

function statePath(root, jobId) {
  const dir = jobDir(root, jobId);
  return dir ? path.join(dir, "job.json.arsip") : null;
}

function sourcePath(root, jobId, extension) {
  const dir = jobDir(root, jobId);
  return dir ? path.join(dir, "source" + extension) : null;
}

export function hlsOutputDir(root, jobId) {
  const dir = jobDir(root, jobId);
  return dir ? path.join(dir, "hls") : null;
}

export function createVideoHlsStore(root) {
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function readVideoJob(root, jobId) {
  const p = statePath(root, jobId);
  if (!p || !fs.existsSync(p)) return null;
  try {
    return decryptState(fs.readFileSync(p));
  } catch {
    return null;
  }
}

function writeVideoJob(root, state) {
  const p = statePath(root, state.jobId);
  fs.writeFileSync(p, encryptState(state));
}

function updateVideoJob(root, jobId, patch) {
  const current = readVideoJob(root, jobId);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeVideoJob(root, next);
  return next;
}

function extensionFor(name, type) {
  const ext = path.extname(String(name || "")).toLowerCase();
  if (/^\.[a-z0-9]{1,12}$/.test(ext)) return ext;
  const map = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-matroska": ".mkv",
    "video/ogg": ".ogv",
    "video/mpeg": ".mpeg",
  };
  return map[String(type || "").toLowerCase()] || ".mp4";
}

export function createVideoJob(root, meta) {
  if (!ffmpegPath || !ffprobePath) {
    throw new Error("FFmpeg/FFprobe tidak tersedia. Jalankan npm install terlebih dahulu.");
  }
  const jobId = crypto.randomBytes(24).toString("hex");
  const dir = path.join(root, jobId);
  fs.mkdirSync(dir, { recursive: true });
  const extension = extensionFor(meta?.name, meta?.type);
  const size = Number(meta?.size);
  const state = {
    jobId,
    userId: meta.userId,
    name: String(meta.name || "video").slice(0, 240),
    type: String(meta.type || "video/mp4"),
    size: Number.isSafeInteger(size) ? size : 0,
    received: 0,
    extension,
    status: "uploading",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeVideoJob(root, state);
  return state;
}

export function appendVideoJobChunk(root, jobId, offset, body) {
  const state = readVideoJob(root, jobId);
  if (!state) throw new Error("Proses video tidak ditemukan.");
  if (state.status !== "uploading") throw new Error("Proses video sudah tidak menerima data.");

  if (!Number.isInteger(offset) || offset !== state.received) {
    const err = new Error("Offset video tidak sesuai.");
    err.status = 409;
    err.received = state.received;
    throw err;
  }

  if (!body?.length || body.length > VIDEO_HLS_CHUNK || offset + body.length > state.size) {
    const err = new Error("Ukuran chunk video tidak valid.");
    err.status = 400;
    throw err;
  }

  const input = sourcePath(root, jobId, state.extension);
  const fd = fs.openSync(input, "a");
  try {
    fs.writeSync(fd, body);
  } finally {
    fs.closeSync(fd);
  }

  state.received += body.length;
  writeVideoJob(root, state);
  return state;
}

function runProbe(input) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffprobePath, [
      "-v", "error",
      "-show_entries", "stream=codec_type,width,height:format=duration",
      "-of", "json",
      input,
    ], { windowsHide: true });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", data => { stdout += data.toString(); });
    child.stderr.on("data", data => { stderr += data.toString(); });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "FFprobe gagal membaca video."));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Hasil FFprobe tidak valid."));
      }
    });
  });
}

function even(value) {
  const n = Math.max(2, Math.floor(Number(value) || 2));
  return n % 2 ? n - 1 : n;
}

function chooseVariants(height) {
  const max = even(height);
  const candidates = [240, 360, 480, 720, 1080];
  const usable = candidates.filter(v => v <= max);
  return usable.length ? usable : [max];
}

function bitrateFor(height) {
  const map = {
    240: 400000,
    360: 800000,
    480: 1400000,
    720: 2800000,
    1080: 5000000,
  };
  return map[height] || Math.max(300000, Math.round(height * 4500));
}

function audioBitrateFor(index, count) {
  if (count <= 2) return index === 0 ? 64000 : 96000;
  return index < 2 ? 64000 : 128000;
}

async function transcodeToHls(root, jobId) {
  const state = readVideoJob(root, jobId);
  if (!state) return;

  const input = sourcePath(root, jobId, state.extension);
  const out = hlsOutputDir(root, jobId);
  if (!fs.existsSync(input)) {
    throw new Error("Sumber video untuk transcoding tidak ditemukan.");
  }

  fs.mkdirSync(out, { recursive: true });

  const probe = await runProbe(input);
  const video = (probe.streams || []).find(x => x.codec_type === "video");
  if (!video || !video.height) {
    throw new Error("Berkas tidak mengandung track video yang dapat diproses.");
  }

  const hasAudio = (probe.streams || []).some(x => x.codec_type === "audio");
  const duration = Number(probe.format?.duration) || null;
  const variants = chooseVariants(video.height);

  variants.forEach((_, i) => {
    fs.mkdirSync(path.join(out, "v" + i), { recursive: true });
  });

  const keyPath = path.join(out, ".hls-key");
  const keyInfoPath = path.join(out, ".hls-key-info");
  const hlsKey = crypto.randomBytes(16);

  fs.writeFileSync(keyPath, hlsKey);
  fs.writeFileSync(
    keyInfoPath,
    "/api/video-stream/jobs/" + jobId + "/key\n" + keyPath + "\n"
  );

  const splitLabels = variants.map((_, i) => "[src" + i + "]").join("");
  const filters = ["[0:v]split=" + variants.length + splitLabels + ";"];

  variants.forEach((height, i) => {
    filters.push(
      "[src" + i + "]scale=w=-2:h='trunc(min(" + height + ",ih)/2)*2'[v" + i + "]"
    );
  });

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-i", input,
    "-filter_complex", filters.join(";"),
  ];

  variants.forEach((height, i) => {
    args.push("-map", "[v" + i + "]");
    if (hasAudio) args.push("-map", "0:a:0");

    args.push("-c:v:" + i, "libx264");
    args.push("-preset:v:" + i, "veryfast");
    args.push("-profile:v:" + i, "main");
    args.push("-pix_fmt:v:" + i, "yuv420p");
    args.push("-b:v:" + i, String(bitrateFor(height)));
    args.push("-maxrate:v:" + i, String(Math.round(bitrateFor(height) * 1.15)));
    args.push("-bufsize:v:" + i, String(bitrateFor(height) * 2));
    args.push("-g:v:" + i, "120");
    args.push("-keyint_min:v:" + i, "120");
    args.push("-sc_threshold:v:" + i, "0");

    if (hasAudio) {
      args.push("-c:a:" + i, "aac");
      args.push("-b:a:" + i, String(audioBitrateFor(i, variants.length)));
      args.push("-ar:a:" + i, "48000");
    }
  });

  const varMap = variants
    .map((height, i) => hasAudio
      ? "v:" + i + ",a:" + i + ",name:" + height + "p"
      : "v:" + i + ",name:" + height + "p")
    .join(" ");

  args.push(
    "-force_key_frames", "expr:gte(t,n_forced*4)",
    "-f", "hls",
    "-hls_time", "4",
    "-hls_playlist_type", "vod",
    "-hls_flags", "independent_segments",
    "-hls_segment_type", "mpegts",
    "-hls_key_info_file", keyInfoPath,
    "-master_pl_name", "master.m3u8",
    "-var_stream_map", varMap,
    "-hls_segment_filename", path.join(out, "v%v", "seg%05d.ts"),
    path.join(out, "v%v", "index.m3u8")
  );

  updateVideoJob(root, jobId, {
    status: "processing",
    progress: 0,
    duration,
    variants,
  });

  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    running.set(jobId, child);

    let stderr = "";
    child.stderr.on("data", data => { stderr += data.toString(); });

    child.on("error", error => {
      running.delete(jobId);
      reject(error);
    });

    child.on("close", code => {
      running.delete(jobId);
      if (code !== 0) {
        reject(new Error(stderr.trim() || "FFmpeg gagal membuat HLS."));
        return;
      }
      resolve();
    });
  });

  updateVideoJob(root, jobId, {
    status: "ready",
    progress: 100,
    duration,
    variants,
    hlsKey: hlsKey.toString("base64"),
  });

  try { fs.unlinkSync(keyInfoPath); } catch {}
  try { fs.unlinkSync(keyPath); } catch {}
  try { fs.unlinkSync(input); } catch {}
}

export function finishVideoJob(root, jobId) {
  const state = readVideoJob(root, jobId);
  if (!state) throw new Error("Proses video tidak ditemukan.");
  if (state.received !== state.size) throw new Error("Data video belum lengkap.");
  if (state.status !== "uploading") return state;

  updateVideoJob(root, jobId, { status: "queued", progress: 0 });

  transcodeToHls(root, jobId).catch(error => {
    const next = updateVideoJob(root, jobId, {
      status: "failed",
      error: error.message,
      progress: 0,
    });
    const out = next ? hlsOutputDir(root, jobId) : null;
    for (const p of [
      out && path.join(out, ".hls-key"),
      out && path.join(out, ".hls-key-info"),
    ].filter(Boolean)) {
      try { fs.unlinkSync(p); } catch {}
    }
  });

  return readVideoJob(root, jobId);
}

export function publicVideoJob(state) {
  if (!state) return null;
  const { hlsKey, ...safe } = state;
  return safe;
}

export function videoJobAsset(root, jobId, relativePath) {
  const safe = safeJobId(jobId);
  if (!safe || !relativePath || relativePath.includes("..") || relativePath.includes("\\")) {
    return null;
  }

  const base = hlsOutputDir(root, safe);
  const target = path.resolve(base, relativePath);
  if (!target.startsWith(path.resolve(base) + path.sep)) return null;
  return target;
}

export function getVideoJobKey(root, jobId) {
  const state = readVideoJob(root, jobId);
  if (!state?.hlsKey) return null;
  try {
    return Buffer.from(state.hlsKey, "base64");
  } catch {
    return null;
  }
}

export function removeVideoJob(root, jobId) {
  const safe = safeJobId(jobId);
  if (!safe) return;

  const child = running.get(safe);
  if (child) {
    try { child.kill("SIGKILL"); } catch {}
    running.delete(safe);
  }

  const dir = jobDir(root, safe);
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
