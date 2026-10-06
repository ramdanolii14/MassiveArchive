import { fileExtension } from "./utils.js";

const IMAGE_EXTS = new Set([
  "jpg","jpeg","png","webp","gif","bmp","avif","svg"
]);

const VIDEO_EXTS = new Set([
  "mp4","webm","ogv","ogg","mov","m4v","mkv","avi","flv",
  "wmv","3gp","mpeg","mpg","ts"
]);

export function previewKind(file) {
  const ext = fileExtension(file?.name || "");
  const type = String(file?.type || "").toLowerCase();
  if (type.startsWith("image/") || IMAGE_EXTS.has(ext)) return "image";
  if (type.startsWith("video/") || VIDEO_EXTS.has(ext)) return "video";
  return null;
}

export async function createSecurePreview(buffer, file) {
  const kind = previewKind(file);
  if (!kind) return null;

  const source = new Blob([buffer], {
    type: file.type || "application/octet-stream",
  });

  if (kind === "image") {
    return createImagePreview(source);
  }

  return createVideoPreview(source);
}

async function createImagePreview(source) {
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Gagal membuat preview gambar."));
      el.src = url;
    });

    const scale = 0.8;
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas preview tidak tersedia.");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg", 0.78)
    );
    if (!blob) throw new Error("Preview gambar tidak dapat dibuat.");

    return {
      blob,
      type: "image/jpeg",
      size: blob.size,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function createVideoPreview(source) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Browser tidak mendukung preview video aman.");
  }

  const url = URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = url;

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("Video tidak dapat dibaca."));
    });

    const width = Math.max(2, Math.round(video.videoWidth * 0.8));
    const height = Math.max(2, Math.round(video.videoHeight * 0.8));
    const fps = 24;
    const canvas = document.createElement("canvas");
    canvas.width = width % 2 ? width - 1 : width;
    canvas.height = height % 2 ? height - 1 : height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas preview video tidak tersedia.");

    const stream = canvas.captureStream(fps);
    let audioTracks = [];
    try {
      const sourceStream = video.captureStream?.() || video.mozCaptureStream?.();
      audioTracks = sourceStream?.getAudioTracks?.() || [];
    } catch {}

    audioTracks.forEach(track => stream.addTrack(track));

    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];
    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error("Format preview video aman tidak didukung browser.");

    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2_000_000,
    });

    const recorderDone = new Promise((resolve, reject) => {
      recorder.ondataavailable = e => {
        if (e.data?.size) chunks.push(e.data);
      };
      recorder.onerror = () => reject(new Error("Gagal membuat preview video."));
      recorder.onstop = resolve;
    });

    recorder.start(500);
    await video.play();

    await new Promise((resolve, reject) => {
      let drawing = false;

      const draw = () => {
        if (video.ended) {
          resolve();
          return;
        }
        if (!drawing) {
          drawing = true;
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } catch {}
          drawing = false;
        }
        requestAnimationFrame(draw);
      };

      video.onerror = () => reject(new Error("Video rusak saat membuat preview."));
      draw();
    });

    if (recorder.state !== "inactive") recorder.stop();
    await recorderDone;

    audioTracks.forEach(track => track.stop());
    stream.getTracks().forEach(track => track.stop());

    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) throw new Error("Preview video tidak menghasilkan data.");

    return {
      blob,
      type: mimeType,
      size: blob.size,
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}
