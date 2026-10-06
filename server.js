import express  from "express";
import cors     from "cors";
import fs       from "fs";
import path     from "path";
import crypto   from "crypto";
import { fileURLToPath } from "url";
import dotenv   from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
const app       = express();

// ── Batas ukuran request 500mb (untuk file besar base64) ──────
app.use(cors());
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));

// ── Konfigurasi ───────────────────────────────────────────────
const SERVER_KEY = process.env.SERVER_KEY;
if (!SERVER_KEY || SERVER_KEY.length < 8) {
  console.error(
    "\n[FATAL] SERVER_KEY belum diset (atau kurang dari 8 karakter).\n" +
    "Buat file .env di folder yang sama dengan server.js, contoh:\n" +
    "  SERVER_KEY=password_kuat_kamu\n  PORT=3001\n"
  );
  process.exit(1);
}
const DB_DIR          = path.join(__dirname, "database");
const ARCHIVE_DIR     = path.join(DB_DIR, "archives");
const ARCHIVE_INDEX   = path.join(DB_DIR, "archives.index.arsip");
const LEGACY_ARCHIVES = path.join(DB_DIR, "archives.arsip");
const PAYLOAD_DIR     = path.join(DB_DIR, "payloads");
const UPLOAD_DIR      = path.join(DB_DIR, "uploads");
const MAX_FILE_SIZE   = 200 * 1024 * 1024;
const MAX_UPLOAD_SIZE = MAX_FILE_SIZE + 1024 * 1024;
const UPLOAD_CHUNK    = 4 * 1024 * 1024;

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
if (!fs.existsSync(PAYLOAD_DIR)) fs.mkdirSync(PAYLOAD_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ════════════════════════════════════════════════════════════════
// ENKRIPSI DISK — AES-256-GCM
// Format file: [iv(16)][authTag(16)][ciphertext]
// ════════════════════════════════════════════════════════════════

function deriveServerKey() {
  return crypto.createHash("sha256").update(SERVER_KEY).digest();
}

function encryptToDisk(plaintext) {
  const key    = deriveServerKey();
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function decryptFromDisk(buffer) {
  const key     = deriveServerKey();
  const iv      = buffer.slice(0, 16);
  const tag     = buffer.slice(16, 32);
  const ct      = buffer.slice(32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

function readCol(name) {
  const file = path.join(DB_DIR, `${name}.arsip`);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(decryptFromDisk(fs.readFileSync(file)));
  } catch (e) {
    console.error(`[DB] Gagal baca ${name}.arsip:`, e.message);
    return [];
  }
}

// ── Penyimpanan arsip terpecah (satu arsip logis = satu file shard) ──
// Index hanya berisi metadata sehingga perpindahan halaman tidak perlu
// membaca seluruh payload terenkripsi.
let metaCache = null;

function archiveShardPath(id) {
  return path.join(ARCHIVE_DIR, `archive-${String(id).padStart(8, "0")}.arsip`);
}

function isProtectedMedia(file) {
  const type = String(file?.type || "").toLowerCase();
  const ext = String(file?.name || "").split(".").pop().toLowerCase();
  return type.startsWith("image/") || type.startsWith("video/") ||
    ["jpg","jpeg","png","webp","gif","bmp","avif","svg",
      "mp4","webm","ogv","ogg","mov","m4v","mkv","avi","flv",
      "wmv","3gp","mpeg","mpg","ts"].includes(ext);
}

function safeArchiveForClient(arc) {
  if (!arc) return null;
  return {
    ...arc,
    files: (arc.files || []).map(({ encData, payloadRef, previewData, ...f }) => ({
      ...f,
      hasPreview: Boolean(previewData),
    })),
  };
}

function archiveMetaOf(arc) {
  return {
    ...arc,
    files: (arc.files || []).map(({ encData, payloadRef, previewData, ...f }) => ({
      ...f,
      hasPreview: Boolean(previewData),
    })),
  };
}

function readArchiveIndex() {
  if (!fs.existsSync(ARCHIVE_INDEX)) return [];
  try {
    return JSON.parse(decryptFromDisk(fs.readFileSync(ARCHIVE_INDEX)));
  } catch (e) {
    console.error("[DB] Indeks arsip rusak:", e.message);
    return [];
  }
}

function writeArchiveIndex(index) {
  fs.writeFileSync(ARCHIVE_INDEX, encryptToDisk(JSON.stringify(index)));
  metaCache = index;
}

function readArchive(id) {
  const file = archiveShardPath(id);
  if (!fs.existsSync(file)) return null;
  try {
    const arc = JSON.parse(decryptFromDisk(fs.readFileSync(file)));
    const meta = archivesMeta().find(a => a.id === id);
    // Metadata pada index menjadi sumber kebenaran untuk owner/sharedWith
    // sehingga rename username tidak perlu menulis ulang semua payload.
    if (meta) {
      arc.owner = meta.owner;
      arc.sharedWith = meta.sharedWith || [];
    }
    return arc;
  } catch (e) {
    console.error(`[DB] Gagal baca shard arsip ${id}:`, e.message);
    return null;
  }
}

function writeArchive(arc) {
  fs.writeFileSync(archiveShardPath(arc.id), encryptToDisk(JSON.stringify(arc)));
}

function removeArchive(id) {
  const file = archiveShardPath(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function archivesMeta() {
  ensureArchiveStore();
  if (!metaCache) metaCache = readArchiveIndex();
  return metaCache;
}

function upsertArchiveMeta(arc) {
  const index = archivesMeta().slice();
  const meta = archiveMetaOf(arc);
  const idx = index.findIndex(a => a.id === arc.id);
  if (idx >= 0) index[idx] = meta;
  else index.push(meta);
  index.sort((a, b) => (a.id || 0) - (b.id || 0));
  writeArchiveIndex(index);
}

function updateArchiveMeta(id, patch) {
  const index = archivesMeta().slice();
  const idx = index.findIndex(a => a.id === id);
  if (idx < 0) return false;
  index[idx] = { ...index[idx], ...patch, id };
  // Jangan pernah membiarkan payload terenkripsi masuk ke index.
  if (Array.isArray(index[idx].files)) {
    index[idx].files = index[idx].files.map(({ encData, ...f }) => f);
  }
  writeArchiveIndex(index);
  return true;
}

function ensureArchiveStore() {
  if (fs.existsSync(ARCHIVE_INDEX)) return;

  // Migrasi satu kali dari format lama: database/archives.arsip
  // menjadi database/archives/archive-XXXXXXXX.arsip + indeks metadata.
  if (fs.existsSync(LEGACY_ARCHIVES)) {
    const legacy = readCol("archives");
    const index = [];
    for (const arc of legacy) {
      writeArchive(arc);
      index.push(archiveMetaOf(arc));
    }
    writeArchiveIndex(index);

    // Backup format lama agar data asli tetap tersedia bila dibutuhkan.
    const backup = path.join(DB_DIR, "archives.legacy.arsip");
    if (!fs.existsSync(backup)) {
      try { fs.renameSync(LEGACY_ARCHIVES, backup); } catch { /* backup opsional */ }
    }
    return;
  }

  writeArchiveIndex([]);
}

function writeCol(name, data) {
  const file = path.join(DB_DIR, `${name}.arsip`);
  fs.writeFileSync(file, encryptToDisk(JSON.stringify(data)));
}

function nextId(col) {
  if (!col.length) return 1;
  return Math.max(...col.map(x => x.id || 0)) + 1;
}

// ════════════════════════════════════════════════════════════════
// AUTHENTICATION — server-side session
// ════════════════════════════════════════════════════════════════

const sessions = new Map();
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createSession(userId, options = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    userId,
    recoveryAuthorized: Boolean(options.recoveryAuthorized),
    securityBootstrap: Boolean(options.securityBootstrap),
    expiresAt: Date.now() + SESSION_TTL,
  });
  return token;
}

function setSessionCookie(res, token, req = null) {
  const forwarded = String(req?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const secure = process.env.NODE_ENV === "production" || forwarded === "https";
  const parts = [
    `ma_session=${encodeURIComponent(token)}` ,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL / 1000)}`
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "ma_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

function publicUser(user) {
  if (!user) return null;
  const { passHash, privateKeyBox, recoveryHash, recoveryKeyBox, ...safe } = user;
  return safe;
}

function authUser(user, includeRecoveryBox = false) {
  if (!user) return null;
  const safe = {
    id: user.id,
    username: user.username,
    avatar: user.avatar || null,
    publicKey: user.publicKey || null,
    keyId: user.keyId || null,
    privateKeyBox: user.privateKeyBox || null,
    createdAt: user.createdAt,
    hasRecovery: Boolean(user.recoveryHash && user.recoveryKeyBox),
  };
  if (includeRecoveryBox) safe.recoveryKeyBox = user.recoveryKeyBox;
  return safe;
}

function authRequired(req, res, next) {
  const token = parseCookies(req.headers.cookie || "").ma_session;
  const record = token ? sessions.get(token) : null;
  if (!record || record.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "Sesi login tidak valid atau sudah berakhir." });
  }
  const user = readCol("users").find(u => u.id === record.userId);
  if (!user) {
    sessions.delete(token);
    return res.status(401).json({ error: "Akun tidak ditemukan." });
  }
  req.sessionToken = token;
  req.user = user;
  record.expiresAt = Date.now() + SESSION_TTL;
  next();
}

function findUserByUsername(username) {
  const name = String(username || "").trim().toLowerCase();
  return readCol("users").find(u => u.username === name) || null;
}

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const passHash = String(req.body?.passHash || "");
  const user = findUserByUsername(username);
  if (!user || !passHash || user.passHash !== passHash) {
    return res.status(401).json({ error: "Username atau kata kunci salah." });
  }
  const token = createSession(user.id, { securityBootstrap: true });
  setSessionCookie(res, token, req);
  res.json(authUser(user));
});

app.post("/api/auth/register", (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({ error: "Username tidak valid." });
  }
  const users = readCol("users");
  if (users.some(u => u.username === username)) {
    return res.status(409).json({ error: "Username sudah digunakan." });
  }
  const required = ["passHash", "publicKey", "keyId", "privateKeyBox", "recoveryHash", "recoveryKeyBox"];
  if (required.some(k => !req.body?.[k])) {
    return res.status(400).json({ error: "Data akun keamanan tidak lengkap." });
  }
  const item = {
    ...req.body,
    username,
    id: nextId(users),
    createdAt: req.body?.createdAt || new Date().toISOString(),
  };
  delete item.actor;
  users.push(item);
  writeCol("users", users);
  const token = createSession(item.id);
  setSessionCookie(res, token, req);
  res.status(201).json(authUser(item));
});

app.post("/api/auth/recover", (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const recoveryHash = String(req.body?.recoveryHash || "");
  const user = findUserByUsername(username);
  if (!user || !user.recoveryHash || user.recoveryHash !== recoveryHash) {
    return res.status(401).json({ error: "Recovery Key tidak valid." });
  }
  const token = createSession(user.id, { recoveryAuthorized: true });
  setSessionCookie(res, token, req);
  res.json(authUser(user, true));
});

app.post("/api/auth/logout", authRequired, (req, res) => {
  sessions.delete(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json(authUser(req.user));
});

app.use(authRequired);

app.post("/api/auth/bootstrap-security", (req, res) => {
  const session = sessions.get(req.sessionToken);
  if (!session?.securityBootstrap) {
    return res.status(403).json({ error: "Onboarding keamanan tidak diizinkan untuk sesi ini." });
  }

  const users = readCol("users");
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: "Akun tidak ditemukan." });

  const hasRecovery = Boolean(
    users[idx].recoveryHash && users[idx].recoveryKeyBox
  );

  if (hasRecovery) {
    return res.status(409).json({
      error: "Recovery Key akun ini sudah tersedia."
    });
  }

  const fields = ["publicKey", "keyId", "privateKeyBox", "recoveryHash", "recoveryKeyBox"];
  for (const field of fields) {
    if (!req.body?.[field]) {
      return res.status(400).json({
        error: "Data keamanan akun belum lengkap."
      });
    }
  }

  for (const field of fields) {
    users[idx][field] = req.body[field];
  }

  writeCol("users", users);
  session.securityBootstrap = false;

  res.json(authUser(users[idx]));
});

// ════════════════════════════════════════════════════════════════
// ROUTES — Archives
// ════════════════════════════════════════════════════════════════

function isDeleted(a) {
  return Boolean(a?.deletedAt);
}

function archivePermissions(arc, actorKeyId, actorUsername) {
  if (!arc) return {};
  if (arc.owner === actorUsername) {
    return { view: true, download: true, edit: true, reshare: true };
  }

  const envelope = (arc.keyEnvelopes || []).find(e =>
    (actorKeyId && e.keyId === actorKeyId) || e.username === actorUsername
  );

  if (arc.keyMode !== "envelope-v1") {
    return (arc.sharedWith || []).includes(actorUsername)
      ? { view: true, download: true, edit: false, reshare: false }
      : {};
  }

  if (!envelope) return {};

  return {
    view: false,
    download: false,
    edit: false,
    reshare: false,
    ...(envelope.permissions || {}),
  };
}

function canReadArchive(arc, actorKeyId, actorUsername) {
  const p = archivePermissions(arc, actorKeyId, actorUsername);
  return Boolean(p.view);
}

function canChangeArchive(arc, actorKeyId, actorUsername, action = "edit") {
  if (!arc) return false;
  if (arc.owner === actorUsername) return true;
  const p = archivePermissions(arc, actorKeyId, actorUsername);
  return action === "reshare" ? Boolean(p.reshare) : Boolean(p.edit);
}

function archiveQuery(req, input) {
  const { includeTrash = false, onlyTrash = false } = input || {};
  let list = archivesMeta().filter(a => {
    if (onlyTrash) return isDeleted(a);
    if (includeTrash) return true;
    return !isDeleted(a);
  });

  const username = req.user?.username || "";
  const scope = req.query.scope || "";

  if (scope === "accessible" && username) {
    list = list.filter(a => a.owner === username || (a.sharedWith || []).includes(username));
  } else if (scope === "owner" && username) {
    list = list.filter(a => a.owner === username);
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  if (q) {
    list = list.filter(a => [
      a.title, a.archiveId, a.description, a.category, a.author,
      a.reference, a.location, ...(a.tags || []), a.owner
    ].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
  }

  if (req.query.cat) list = list.filter(a => a.category === req.query.cat);
  if (req.query.from) list = list.filter(a => a.date >= req.query.from);
  if (req.query.to) list = list.filter(a => a.date <= req.query.to);

  const sort = req.query.sort || "newest";
  list.sort((a, b) => {
    if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sort === "title") return String(a.title || "").localeCompare(String(b.title || ""));
    if (sort === "date") return String(b.date || "").localeCompare(String(a.date || ""));
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return list;
}

function payloadPath(ref) {
  const name = path.basename(String(ref || ""));
  if (!name || name !== String(ref || "")) return null;
  const full = path.join(PAYLOAD_DIR, name);
  return full.startsWith(PAYLOAD_DIR + path.sep) ? full : null;
}

function removePayload(ref) {
  const p = payloadPath(ref);
  if (p && fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
}

function fileIdentity(f) {
  return [
    String(f?.name || ""),
    String(f?.size || 0),
    String(f?.addedAt || ""),
  ].join("|");
}

function preserveExistingFilePayloads(oldArc, newArc) {
  const oldByIdentity = new Map(
    (oldArc.files || []).map(f => [fileIdentity(f), f])
  );

  newArc.files = (newArc.files || []).map(file => {
    const oldFile = oldByIdentity.get(fileIdentity(file));
    if (!oldFile) return file;

    const next = { ...oldFile, ...file };
    if (!file.encData && oldFile.encData) next.encData = oldFile.encData;
    if (!file.payloadRef && oldFile.payloadRef) next.payloadRef = oldFile.payloadRef;
    if (!file.previewData && oldFile.previewData) next.previewData = oldFile.previewData;
    if (!file.previewType && oldFile.previewType) next.previewType = oldFile.previewType;
    if (!file.previewSize && oldFile.previewSize) next.previewSize = oldFile.previewSize;
    return next;
  });
}

function cleanupRemovedPayloads(oldArc, newArc) {
  const kept = new Set((newArc.files || []).map(f => f.payloadRef).filter(Boolean));
  for (const f of oldArc.files || []) {
    if (f.payloadRef && !kept.has(f.payloadRef)) removePayload(f.payloadRef);
  }
}

function uploadStatePath(uploadId) {
  return path.join(UPLOAD_DIR, uploadId + ".json.arsip");
}

function uploadPartPath(uploadId) {
  return path.join(UPLOAD_DIR, uploadId + ".part");
}

function newUploadId() {
  return crypto.randomBytes(24).toString("hex");
}

function readUpload(uploadId) {
  if (!/^[a-f0-9]{48}$/.test(uploadId)) return null;
  const p = uploadStatePath(uploadId);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(decryptFromDisk(fs.readFileSync(p))); }
  catch { return null; }
}

function writeUpload(state) {
  fs.writeFileSync(uploadStatePath(state.uploadId), encryptToDisk(JSON.stringify(state)));
}

function removeUpload(uploadId) {
  for (const p of [uploadStatePath(uploadId), uploadPartPath(uploadId)]) {
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
  }
}

function materializeUploads(files, archiveId, userId) {
  const out = [];
  for (let i = 0; i < (files || []).length; i++) {
    const f = files[i];
    if (!f?.uploadId) { out.push(f); continue; }
    const state = readUpload(f.uploadId);
    if (!state) throw new Error("Upload tidak ditemukan atau sudah kedaluwarsa.");
    if (state.userId !== userId) throw new Error("Upload tidak dimiliki oleh sesi ini.");
    if (state.received !== state.size) {
      throw new Error("Upload \"" + state.name + "\" belum selesai (" + state.received + "/" + state.size + " bytes).");
    }
    const part = uploadPartPath(state.uploadId);
    if (!fs.existsSync(part)) throw new Error("Data upload tidak ditemukan.");
    const payloadRef = "payload-" + String(archiveId).padStart(8, "0") + "-" + crypto.randomBytes(8).toString("hex") + ".bin";
    const target = payloadPath(payloadRef);
    if (!target) throw new Error("Lokasi payload tidak valid.");
    fs.renameSync(part, target);
    removeUpload(state.uploadId);
    const clean = { ...f };
    delete clean.uploadId;
    out.push({ ...clean, payloadRef });
  }
  return out;
}

app.post("/api/uploads", (req, res) => {
  const size = Number(req.body?.size);
  if (!Number.isFinite(size) || size < 0 || size > MAX_UPLOAD_SIZE) {
    return res.status(400).json({ error: "Ukuran berkas tidak valid atau melebihi 200 MB." });
  }
  const uploadId = newUploadId();
  writeUpload({
    uploadId,
    name: String(req.body?.name || "berkas"),
    type: String(req.body?.type || "application/octet-stream"),
    size,
    received: 0,
    userId: req.user.id,
    createdAt: new Date().toISOString(),
  });
  res.json({ uploadId, size, received: 0, chunkSize: UPLOAD_CHUNK });
});

app.get("/api/uploads/:id", (req, res) => {
  const state = readUpload(req.params.id);
  if (!state) return res.status(404).json({ error: "Upload tidak ditemukan." });
  if (state.userId !== req.user.id) return res.status(403).json({ error: "Upload bukan milik sesi ini." });
  res.json(state);
});

app.put("/api/uploads/:id",
  express.raw({ type: () => true, limit: "5mb" }),
  (req, res) => {
    const state = readUpload(req.params.id);
    if (!state) return res.status(404).json({ error: "Upload tidak ditemukan." });
    if (state.userId !== req.user.id) return res.status(403).json({ error: "Upload bukan milik sesi ini." });
    const offset = Number(req.get("X-Upload-Offset"));
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!Number.isInteger(offset) || offset !== state.received) {
      return res.status(409).json({ error: "Offset upload tidak sesuai.", received: state.received });
    }
    if (!body.length) return res.status(400).json({ error: "Chunk kosong." });
    if (body.length > UPLOAD_CHUNK || offset + body.length > state.size) {
      return res.status(400).json({ error: "Ukuran chunk tidak valid." });
    }
    const fd = fs.openSync(uploadPartPath(state.uploadId), "a");
    try { fs.writeSync(fd, body); } finally { fs.closeSync(fd); }
    state.received += body.length;
    writeUpload(state);
    res.json({ uploadId: state.uploadId, received: state.received, size: state.size, done: state.received === state.size });
  }
);

app.delete("/api/uploads/:id", (req, res) => {
  const state = readUpload(req.params.id);
  if (!state) return res.json({ ok: true });
  if (state.userId !== req.user.id) return res.status(403).json({ error: "Upload bukan milik sesi ini." });
  removeUpload(state.uploadId);
  res.json({ ok: true });
});

app.get("/api/archives", (req, res) => {
  const includeTrash = req.query.includeTrash === "1";
  const onlyTrash = req.query.trash === "1";
  const index = archiveQuery(req, { includeTrash, onlyTrash });

  if (req.query.page) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const pages = Math.max(1, Math.ceil(index.length / limit));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;
    return res.json({ items: index.slice(start, start + limit), page: safePage, pages, limit, total: index.length });
  }

  if (req.query.meta) return res.json(index);
  const accessible = index.filter(a =>
    a.owner === req.user.username || (a.sharedWith || []).includes(req.user.username)
  );
  res.json(accessible.map(a => safeArchiveForClient(readArchive(a.id))).filter(Boolean));
});

app.get("/api/archives/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const meta = archivesMeta().find(a => a.id === id);
  if (!meta) return res.status(404).json({ error: "Tidak ditemukan" });
  if (req.query.meta) return res.json(meta);

  const username = req.user.username;
  const keyId = req.user.keyId || "";
  const arc = readArchive(id);
  if (!canReadArchive(arc, keyId, username)) {
    return res.status(403).json({ error: "Anda tidak memiliki akses untuk membuka arsip ini." });
  }

  const safeArc = safeArchiveForClient(arc);
  res.json(safeArc);
});

app.get("/api/archives/:id/files/:idx", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = parseInt(req.params.idx, 10);
  const arc = readArchive(id);
  if (!arc) return res.status(404).json({ error: "Tidak ditemukan" });
  if (isDeleted(arc)) return res.status(410).json({ error: "Arsip berada di Tempat Sampah." });

  const username = req.user.username;
  const keyId = req.user.keyId || "";
  const perms = archivePermissions(arc, keyId, username);
  const purpose = req.query.purpose === "download" ? "download" : "view";
  if (!perms[purpose]) {
    return res.status(403).json({
      error: purpose === "download"
        ? "Anda tidak memiliki izin mengunduh berkas ini."
        : "Anda tidak memiliki izin melihat berkas ini."
    });
  }

  const f = arc.files?.[idx];
  if (!f) return res.status(404).json({ error: "Tidak ditemukan" });

  let payload = null;
  if (purpose === "view") {
    if (isProtectedMedia(f)) {
      if (!f.previewData) {
        return res.status(404).json({
          error: "Preview aman untuk berkas ini belum tersedia."
        });
      }
      try { payload = Buffer.from(f.previewData, "base64"); } catch {}
    } else if (f.payloadRef) {
      const p = payloadPath(f.payloadRef);
      if (p && fs.existsSync(p)) payload = fs.readFileSync(p);
    } else if (f.encData) {
      try { payload = Buffer.from(f.encData, "base64"); } catch {}
    }
  } else if (f.payloadRef) {
    const p = payloadPath(f.payloadRef);
    if (p && fs.existsSync(p)) payload = fs.readFileSync(p);
  } else if (f.encData) {
    try { payload = Buffer.from(f.encData, "base64"); } catch {}
  }

  if (!payload) return res.status(404).json({ error: "Data berkas tidak ditemukan" });
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", payload.length);
  res.send(payload);
});

app.post("/api/archives", (req, res) => {
  const index = archivesMeta();
  const actor = req.user.username;
  const item = { ...req.body, id: nextId(index) };
  delete item.actor;
  item.owner = actor;
  if (item.deletedAt) delete item.deletedAt;
  if (Array.isArray(item.files)) {
    try { item.files = materializeUploads(item.files, item.id, req.user.id); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }
  if (actor && item.owner && actor !== item.owner) {
    return res.status(403).json({ error: "Pemilik arsip tidak valid." });
  }
  writeArchive(item);
  upsertArchiveMeta(item);
  res.json(item);
});

app.patch("/api/archives/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const current = readArchive(id);
  if (!current) return res.status(404).json({ error: "Tidak ditemukan" });
  if (isDeleted(current)) return res.status(409).json({ error: "Arsip berada di Tempat Sampah." });

  const actor = req.user.username;
  const actorKeyId = req.user.keyId || "";
  const shareChanged =
    ("keyEnvelopes" in req.body && JSON.stringify(req.body.keyEnvelopes) !== JSON.stringify(current.keyEnvelopes)) ||
    ("sharedWith" in req.body && JSON.stringify(req.body.sharedWith) !== JSON.stringify(current.sharedWith));
  const action = shareChanged ? "reshare" : "edit";
  if (!canChangeArchive(current, actorKeyId, actor, action)) {
    return res.status(403).json({ error: "Anda tidak memiliki izin untuk mengubah arsip ini." });
  }

  const rawBody = { ...req.body };
  delete rawBody.actor;
  delete rawBody.actorKeyId;

  const owner = current.owner === actor;
  const allowedEdit = [
    "title", "date", "category", "description", "tags",
    "location", "author", "reference", "notes", "status",
    "files", "updatedAt"
  ];
  const allowedShare = ["sharedWith", "keyEnvelopes", "updatedAt"];
  const keys = owner
    ? Object.keys(rawBody).filter(k => k !== "id" && k !== "owner" && k !== "deletedAt")
    : action === "reshare" ? allowedShare : allowedEdit;
  const body = {};
  for (const key of keys) {
    if (key in rawBody) body[key] = rawBody[key];
  }

  const item = { ...current, ...body, id };
  if (Array.isArray(item.files)) {
    preserveExistingFilePayloads(current, item);
    try { item.files = materializeUploads(item.files, id, req.user.id); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }
  cleanupRemovedPayloads(current, item);
  writeArchive(item);
  upsertArchiveMeta(item);
  res.json(item);
});

app.delete("/api/archives/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const current = archivesMeta().find(a => a.id === id);
  if (!current) return res.status(404).json({ error: "Tidak ditemukan" });
  const actor = req.user.username;
  if (current.owner !== actor) return res.status(403).json({ error: "Hanya pemilik yang dapat memindahkan arsip." });
  if (!isDeleted(current)) {
    const patch = { deletedAt: new Date().toISOString(), deletedBy: actor };
    const full = readArchive(id);
    writeArchive({ ...full, ...patch });
    updateArchiveMeta(id, patch);
  }
  res.json({ ok: true, trashed: true });
});

app.post("/api/archives/:id/restore", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const current = archivesMeta().find(a => a.id === id);
  if (!current) return res.status(404).json({ error: "Tidak ditemukan" });
  const actor = req.user.username;
  if (current.owner !== actor) return res.status(403).json({ error: "Hanya pemilik yang dapat memulihkan arsip." });
  const patch = { deletedAt: null, deletedBy: null, updatedAt: new Date().toISOString() };
  const full = readArchive(id);
  writeArchive({ ...full, ...patch });
  updateArchiveMeta(id, patch);
  res.json({ ...full, ...patch });
});

app.delete("/api/archives/:id/permanent", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const current = archivesMeta().find(a => a.id === id);
  if (!current) return res.status(404).json({ error: "Tidak ditemukan" });
  const actor = req.user.username;
  if (current.owner !== actor) return res.status(403).json({ error: "Hanya pemilik yang dapat menghapus permanen." });
  const full = readArchive(id);
  for (const f of full?.files || []) if (f.payloadRef) removePayload(f.payloadRef);
  removeArchive(id);
  writeArchiveIndex(archivesMeta().filter(a => a.id !== id));
  res.json({ ok: true, permanent: true });
});

// ════════════════════════════════════════════════════════════════
// ROUTES — Users
// ════════════════════════════════════════════════════════════════

app.get("/api/users", (req, res) => {
  res.json(readCol("users").map(publicUser));
});

app.get("/api/users/:username", (req, res) => {
  const username = decodeURIComponent(req.params.username || "").trim().toLowerCase();
  const user = findUserByUsername(username);
  if (!user) return res.status(404).json({ error: "Tidak ditemukan" });
  res.json(user.id === req.user.id ? user : publicUser(user));
});

function patchUser(req, res) {
  const users = readCol("users");
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: "Pengguna tidak ditemukan" });

  const oldName = users[idx].username;
  const newName = typeof req.body?.username === "string"
    ? req.body.username.trim().toLowerCase()
    : undefined;

  if (newName && newName !== oldName) {
    if (!/^[a-z0-9_]{3,24}$/.test(newName)) {
      return res.status(400).json({ error: "Username tidak valid" });
    }
    if (users.some(u => u.username === newName && u.id !== req.user.id)) {
      return res.status(409).json({ error: "Username sudah digunakan" });
    }

    const updatedIndex = archivesMeta().map(a => ({
      ...a,
      owner: a.owner === oldName ? newName : a.owner,
      sharedWith: (a.sharedWith || []).map(x => x === oldName ? newName : x),
    }));
    writeArchiveIndex(updatedIndex);

    const inbox = readCol("inbox").map(i => ({
      ...i,
      from: i.from === oldName ? newName : i.from,
      recipient: i.recipient === oldName ? newName : i.recipient,
    }));
    writeCol("inbox", inbox);
    users[idx].username = newName;
  }

  const securityFields = [
    "passHash", "publicKey", "keyId", "privateKeyBox",
    "recoveryHash", "recoveryKeyBox"
  ];
  const changingSecurity = securityFields.some(k => k in req.body);

  const sessionRecord = sessions.get(req.sessionToken);
  const securityAuthorized =
    sessionRecord?.recoveryAuthorized || sessionRecord?.securityBootstrap;

  if (changingSecurity && !securityAuthorized) {
    const currentPassHash = String(req.body?.currentPassHash || "");
    if (!currentPassHash || currentPassHash !== users[idx].passHash) {
      return res.status(403).json({ error: "Kata kunci lama tidak valid." });
    }
  }

  for (const k of ["avatar", ...securityFields]) {
    if (k in req.body) users[idx][k] = req.body[k];
  }
  if (changingSecurity) {
    if (sessionRecord) {
      sessionRecord.recoveryAuthorized = false;
      sessionRecord.securityBootstrap = false;
    }
  }
  delete req.body.currentPassHash;

  writeCol("users", users);
  res.json(req.user.id === users[idx].id ? users[idx] : publicUser(users[idx]));
}

app.post("/api/profile", patchUser);
app.post("/api/users/:username/update", patchUser);

// ════════════════════════════════════════════════════════════════
// ROUTES — Storage
// ════════════════════════════════════════════════════════════════

app.get("/api/storage", (req, res) => {
  let used = 0;
  for (const f of fs.readdirSync(DB_DIR)) {
    try { used += fs.statSync(path.join(DB_DIR, f)).size; } catch { /* abaikan */ }
  }
  let total = null, free = null;
  try {
    const s = fs.statfsSync(DB_DIR);
    total = s.bsize * s.blocks;
    free  = s.bsize * s.bavail;
  } catch { /* statfs tidak tersedia */ }
  res.json({ used, total, free });
});

// ════════════════════════════════════════════════════════════════
// ROUTES — Inbox
// ════════════════════════════════════════════════════════════════

app.get("/api/inbox", (req, res) => {
  const col = readCol("inbox");
  res.json(col.filter(i => i.recipient === req.user.username));
});

app.post("/api/inbox", (req, res) => {
  const col = readCol("inbox");
  const recipient = String(req.body?.recipient || "").trim().toLowerCase();
  if (!recipient) return res.status(400).json({ error: "Penerima wajib diisi." });
  const target = findUserByUsername(recipient);
  if (!target) return res.status(404).json({ error: "Penerima tidak ditemukan." });
  const item = {
    ...req.body,
    id: nextId(col),
    from: req.user.username,
    recipient,
  };
  col.push(item);
  writeCol("inbox", col);
  res.json(item);
});

app.patch("/api/inbox/:id/read", (req, res) => {
  const col = readCol("inbox");
  const idx = col.findIndex(i => i.id === parseInt(req.params.id, 10) && i.recipient === req.user.username);
  if (idx === -1) return res.status(404).json({ error: "Tidak ditemukan" });
  col[idx].read = true;
  writeCol("inbox", col);
  res.json(col[idx]);
});

app.delete("/api/inbox/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  writeCol("inbox", readCol("inbox").filter(i => !(i.id === id && i.recipient === req.user.username)));
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// ROUTES — Audit Log
// ════════════════════════════════════════════════════════════════

app.get("/api/audit", (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
  const list = readCol("audit")
    .filter(x => x.userId === req.user.id || (!x.userId && x.username === req.user.username))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
  res.json(list);
});

app.post("/api/audit", (req, res) => {
  const col = readCol("audit");
  const item = {
    id: nextId(col),
    userId: req.user.id,
    username: req.user.username,
    action: String(req.body?.action || "unknown").slice(0, 80),
    details: req.body?.details && typeof req.body.details === "object" ? req.body.details : {},
    at: req.body?.at || new Date().toISOString(),
  };
  col.push(item);
  writeCol("audit", col.slice(-1000));
  res.json(item);
});

// ════════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  try { ensureArchiveStore(); archivesMeta(); } catch { /* pemanasan/migrasi, abaikan galat */ }
  console.log(`
╔══════════════════════════════════════════╗
║     Sistem Arsip Digital — Backend      ║
╠══════════════════════════════════════════╣
║  Berjalan di : http://localhost:${PORT}    ║
║  Folder data : /database/               ║
║  Enkripsi    : AES-256-GCM (SHA-256 key) ║
╚══════════════════════════════════════════╝
  `);
});