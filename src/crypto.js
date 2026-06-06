// ════════════════════════════════════════════════════════════════
// CRYPTO LAYER — AES-GCM via Web Crypto API
// encData disimpan sebagai base64 string agar aman melewati JSON
// ════════════════════════════════════════════════════════════════

export const Crypto = {
  async deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const km  = await window.crypto.subtle.importKey(
      "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
      km,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },

  // Encrypt ArrayBuffer → base64 string
  async encrypt(plainBuffer, passphrase) {
    const salt       = window.crypto.getRandomValues(new Uint8Array(16));
    const iv         = window.crypto.getRandomValues(new Uint8Array(12));
    const key        = await this.deriveKey(passphrase, salt);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, plainBuffer
    );
    const packed = new Uint8Array(16 + 12 + ciphertext.byteLength);
    packed.set(salt, 0);
    packed.set(iv, 16);
    packed.set(new Uint8Array(ciphertext), 28);
    return uint8ToB64(packed);
  },

  // Decrypt base64 string → ArrayBuffer
  async decrypt(encData, passphrase) {
    const packed = toUint8Array(encData);

    if (packed.length < 29) {
      throw new Error(
        `Data terenkripsi rusak atau terpotong (${packed.length} bytes). ` +
        `Kemungkinan file terlalu besar atau upload tidak sempurna.`
      );
    }

    const salt = packed.slice(0, 16);
    const iv   = packed.slice(16, 28);
    const ct   = packed.slice(28);
    const key  = await this.deriveKey(passphrase, salt);
    return window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  },

  // Hash passphrase → hex string (untuk verifikasi login)
  async hashPass(passphrase) {
    const enc = new TextEncoder();
    const buf = await window.crypto.subtle.digest(
      "SHA-256", enc.encode("ARSIP_VERIFY:" + passphrase)
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0")).join("");
  },
};

// ── Helpers (juga diexport untuk keperluan lain) ───────────────

// Uint8Array → base64 string
export function uint8ToB64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Terima semua format yang mungkin → Uint8Array
// Format yang didukung:
//   1. base64 string          — format baru (dari backend)
//   2. ArrayBuffer            — dari Web Crypto langsung
//   3. {0:n, 1:n, ...}       — plain object dari JSON.parse lama
export function toUint8Array(data) {
  if (typeof data === "string") {
    const binary = atob(data);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (data instanceof Uint8Array)  return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof data === "object" && data !== null) {
    // {0:n, 1:n, ...} — sisa format lama sebelum migrasi ke base64
    const len  = Object.keys(data).length;
    const arr  = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = data[i];
    return arr;
  }
  throw new Error("Format encData tidak dikenali: " + typeof data);
}