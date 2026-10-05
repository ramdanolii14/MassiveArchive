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

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

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

function archiveMetaOf(arc) {
  return {
    ...arc,
    files: (arc.files || []).map(({ encData, ...f }) => f),
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
// ROUTES — Archives
// ════════════════════════════════════════════════════════════════

app.get("/api/archives", (req, res) => {
  const index = archivesMeta();
  if (req.query.meta) return res.json(index);
  // Tetap dukung kontrak lama /api/archives untuk kompatibilitas.
  res.json(index.map(a => readArchive(a.id)).filter(Boolean));
});

app.get("/api/archives/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const arc = req.query.meta ? archivesMeta().find(a => a.id === id) : readArchive(id);
  if (!arc) return res.status(404).json({ error: "Tidak ditemukan" });
  res.json(arc);
});

// Hanya mengambil satu payload berkas; tidak membaca arsip lain.
app.get("/api/archives/:id/files/:idx", (req, res) => {
  const id = parseInt(req.params.id);
  const idx = parseInt(req.params.idx);
  const arc = readArchive(id);
  const f = arc?.files?.[idx];
  if (!f?.encData) return res.status(404).json({ error: "Tidak ditemukan" });
  res.json({ encData: f.encData });
});

app.post("/api/archives", (req, res) => {
  const index = archivesMeta();
  const item = { ...req.body, id: nextId(index) };
  writeArchive(item);
  upsertArchiveMeta(item);
  res.json(item);
});

app.patch("/api/archives/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const current = readArchive(id);
  if (!current) return res.status(404).json({ error: "Tidak ditemukan" });

  const item = { ...current, ...req.body, id };
  writeArchive(item);
  upsertArchiveMeta(item);
  res.json(item);
});

app.delete("/api/archives/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const current = archivesMeta().find(a => a.id === id);
  if (!current) return res.status(404).json({ error: "Tidak ditemukan" });

  removeArchive(id);
  writeArchiveIndex(archivesMeta().filter(a => a.id !== id));
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// ROUTES — Users
// ════════════════════════════════════════════════════════════════

app.get("/api/users", (req, res) => {
  // Sembunyikan passHash saat list semua user
  res.json(readCol("users").map(({ passHash, ...u }) => u));
});

app.get("/api/users/:username", (req, res) => {
  const user = readCol("users").find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: "Tidak ditemukan" });
  // Sertakan passHash — dibutuhkan frontend untuk verifikasi login lokal
  res.json(user);
});

app.post("/api/users", (req, res) => {
  const col = readCol("users");
  if (col.find(u => u.username === req.body.username)) {
    return res.status(409).json({ error: "Username sudah digunakan" });
  }
  const item = { ...req.body, id: nextId(col) };
  col.push(item);
  writeCol("users", col);
  res.json(item);
});

function patchUser(req, res) {
  const users = readCol("users");
  const username = decodeURIComponent(req.params.username || "");
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return res.status(404).json({ error: "Pengguna tidak ditemukan" });

  const oldName = users[idx].username;
  const newName = typeof req.body.username === "string"
    ? req.body.username.trim().toLowerCase()
    : undefined;

  if (newName && newName !== oldName) {
    if (!/^[a-z0-9_]{3,24}$/.test(newName)) {
      return res.status(400).json({ error: "Username tidak valid" });
    }
    if (users.some(u => u.username === newName)) {
      return res.status(409).json({ error: "Username sudah digunakan" });
    }

    // Rename hanya metadata index, bukan payload berkas. Ini menghindari
    // penulisan ulang arsip besar saat pengguna sekadar mengganti username.
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

  for (const k of ["avatar", "passHash"]) {
    if (k in req.body) users[idx][k] = req.body[k];
  }

  writeCol("users", users);
  const { passHash, ...safe } = users[idx];
  res.json(safe);
}

app.patch("/api/users/:username", patchUser);
// Fallback POST supaya update profil tetap dapat bekerja pada host/proxy
// yang bermasalah meneruskan method PATCH.
app.post("/api/users/:username/update", patchUser);

// Endpoint profil tanpa username di URL. Ini menjadi jalur utama frontend
// untuk menghindari masalah routing/proxy terhadap parameter path atau PATCH.
app.post("/api/profile", (req, res) => {
  const username = typeof req.body?.username === "string"
    ? req.body.username.trim().toLowerCase()
    : "";
  if (!username) return res.status(400).json({ error: "Username wajib diisi" });
  req.params.username = username;
  return patchUser(req, res);
});

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
  const { recipient } = req.query;
  res.json(recipient ? col.filter(i => i.recipient === recipient) : col);
});

app.post("/api/inbox", (req, res) => {
  const col  = readCol("inbox");
  const item = { ...req.body, id: nextId(col) };
  col.push(item);
  writeCol("inbox", col);
  res.json(item);
});

app.patch("/api/inbox/:id/read", (req, res) => {
  const col = readCol("inbox");
  const idx = col.findIndex(i => i.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Tidak ditemukan" });
  col[idx].read = true;
  writeCol("inbox", col);
  res.json(col[idx]);
});

app.delete("/api/inbox/:id", (req, res) => {
  const id = parseInt(req.params.id);
  writeCol("inbox", readCol("inbox").filter(i => i.id !== id));
  res.json({ ok: true });
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