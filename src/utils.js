// ════════════════════════════════════════════════════════════════
// UTILITIES & CONSTANTS
// ════════════════════════════════════════════════════════════════

export const fmtSize = (b) => {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
};

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export const fmtDT = (iso) =>
  iso ? new Date(iso).toLocaleString("id-ID") : "-";

export const genId = (n) =>
  `ARS-${new Date().getFullYear()}-${String(n + 1).padStart(4, "0")}`;

export const fileTypeLabel = (type = "") => {
  if (type.startsWith("image/"))             return "IMG";
  if (type.startsWith("video/"))             return "VID";
  if (type.startsWith("audio/"))             return "AUD";
  if (type === "application/pdf")            return "PDF";
  if (/zip|rar|tar|7z|gz/.test(type))        return "ZIP";
  if (/word|document/.test(type))            return "DOC";
  if (/sheet|excel/.test(type))              return "XLS";
  if (/presentation|powerpoint/.test(type))  return "PPT";
  return "BIN";
};

export const CATS = [
  "Dokumen Resmi", "Foto", "Video", "Audio",
  "Laporan", "Surat", "Kontrak", "Keuangan",
  "Hukum", "Teknis", "Lainnya",
];

export const STATUSES = {
  Aktif:       "badge-aktif",
  Diarsipkan:  "badge-arsip",
  Rahasia:     "badge-rahasia",
  Kadaluarsa:  "badge-exp",
};

export const passStrength = (p) => {
  if (!p) return { score: 0, label: "", color: "#ccc" };
  let s = 0;
  if (p.length >= 8)                           s++;
  if (p.length >= 14)                          s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p))     s++;
  if (/[0-9]/.test(p))                         s++;
  if (/[^A-Za-z0-9]/.test(p))                 s++;
  const labels = ["", "Lemah", "Sedang", "Baik", "Kuat", "Sangat Kuat"];
  const colors = ["#ccc", "#c0392b", "#e67e22", "#2980b9", "#27ae60", "#1e8449"];
  return { score: s, label: labels[s] || "", color: colors[s] || "#ccc" };
};
