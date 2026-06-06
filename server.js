import express  from "express";
import cors     from "cors";
import fs       from "fs";
import path     from "path";
import crypto   from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();

// ── Batas ukuran request 500mb (untuk file besar base64) ──────
app.use(cors());
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));

// ── Konfigurasi ───────────────────────────────────────────────
const SERVER_KEY = process.env.SERVER_KEY || "ganti-ini-dengan-kunci-rahasia-server";
const DB_DIR     = path.join(__dirname, "database");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

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
  res.json(readCol("archives"));
});

app.get("/api/archives/:id", (req, res) => {
  const id  = parseInt(req.params.id);
  const arc = readCol("archives").find(a => a.id === id);
  if (!arc) return res.status(404).json({ error: "Tidak ditemukan" });
  res.json(arc);
});

app.post("/api/archives", (req, res) => {
  const col  = readCol("archives");
  const item = { ...req.body, id: nextId(col) };
  col.push(item);
  writeCol("archives", col);
  res.json(item);
});

app.patch("/api/archives/:id", (req, res) => {
  const id  = parseInt(req.params.id);
  const col = readCol("archives");
  const idx = col.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: "Tidak ditemukan" });
  col[idx] = { ...col[idx], ...req.body };
  writeCol("archives", col);
  res.json(col[idx]);
});

app.delete("/api/archives/:id", (req, res) => {
  const id = parseInt(req.params.id);
  writeCol("archives", readCol("archives").filter(a => a.id !== id));
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