// CRYPTO LAYER — AES-GCM + per-user ECDH identity + envelope encryption

const PBKDF2_ITERATIONS = 210000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const Crypto = {
  async deriveKey(passphrase, salt) {
    const km = await window.crypto.subtle.importKey(
      "raw", textEncoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      km,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },

  async encrypt(plainBuffer, passphrase) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(passphrase, salt);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, toArrayBuffer(plainBuffer)
    );
    const packed = new Uint8Array(16 + 12 + ciphertext.byteLength);
    packed.set(salt, 0);
    packed.set(iv, 16);
    packed.set(new Uint8Array(ciphertext), 28);
    return uint8ToB64(packed);
  },

  async decrypt(encData, passphrase) {
    const packed = toUint8Array(encData);
    if (packed.length < 29) {
      throw new Error(
        `Data terenkripsi rusak atau terpotong (${packed.length} bytes).`
      );
    }
    const salt = packed.slice(0, 16);
    const iv = packed.slice(16, 28);
    const ct = packed.slice(28);
    const key = await this.deriveKey(passphrase, salt);
    return window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  },

  async hashPass(passphrase) {
    const buf = await window.crypto.subtle.digest(
      "SHA-256", textEncoder.encode("ARSIP_VERIFY:" + passphrase)
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0")).join("");
  },

  // ── Per-user identity ─────────────────────────────────────
  // Private key dibuat acak, bukan diturunkan dari username.
  // Password hanya dipakai untuk mengenkripsi private-key envelope.
  async createIdentity(passphrase) {
    const pair = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );

    const publicJwk = await window.crypto.subtle.exportKey("jwk", pair.publicKey);
    const privateJwk = await window.crypto.subtle.exportKey("jwk", pair.privateKey);
    const privateBox = await this.encrypt(
      textEncoder.encode(JSON.stringify(privateJwk)).buffer,
      passphrase
    );

    const privateKey = await window.crypto.subtle.importKey(
      "jwk", privateJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]
    );

    return {
      publicKey: publicJwk,
      keyId: await this.publicKeyId(publicJwk),
      privateKeyBox: privateBox,
      privateKey,
    };
  },

  async unlockIdentity(privateKeyBox, passphrase) {
    if (!privateKeyBox) throw new Error("Identitas kriptografi belum tersedia.");
    const plain = await this.decrypt(privateKeyBox, passphrase);
    const privateJwk = JSON.parse(textDecoder.decode(new Uint8Array(plain)));
    return window.crypto.subtle.importKey(
      "jwk", privateJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]
    );
  },

  // Password berubah -> hanya private-key box yang dibungkus ulang.
  async rewrapIdentity(privateKeyBox, currentPassphrase, newPassphrase) {
    const plain = await this.decrypt(privateKeyBox, currentPassphrase);
    return this.encrypt(plain, newPassphrase);
  },

  async publicKeyId(publicJwk) {
    const stable = JSON.stringify({
      crv: publicJwk.crv,
      kty: publicJwk.kty,
      x: publicJwk.x,
      y: publicJwk.y,
    });
    const digest = await window.crypto.subtle.digest(
      "SHA-256", textEncoder.encode(stable)
    );
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0")).join("");
  },

  // ── Archive content keys ─────────────────────────────────
  randomContentKey() {
    return window.crypto.getRandomValues(new Uint8Array(32));
  },

  async encryptWithKey(plainBuffer, rawKey) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await importRawAesKey(rawKey, ["encrypt"]);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, toArrayBuffer(plainBuffer)
    );
    const packed = new Uint8Array(12 + ciphertext.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ciphertext), 12);
    return uint8ToB64(packed);
  },

  async decryptWithKey(encData, rawKey) {
    const packed = toUint8Array(encData);
    if (packed.length < 29) {
      throw new Error(`Data arsip rusak atau terpotong (${packed.length} bytes).`);
    }
    const iv = packed.slice(0, 12);
    const ct = packed.slice(12);
    const key = await importRawAesKey(rawKey, ["decrypt"]);
    return window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  },

  // Wrap archive key untuk public key penerima.
  // Memakai ECDH ephemeral + HKDF, sehingga penerima tidak pernah membutuhkan
  // password pemilik atau shared secret yang dapat ditebak dari username.
  async wrapKey(rawKey, recipientPublicJwk) {
    const recipient = await window.crypto.subtle.importKey(
      "jwk", recipientPublicJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false, []
    );

    const ephemeral = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    const shared = await window.crypto.subtle.deriveBits(
      { name: "ECDH", public: recipient },
      ephemeral.privateKey,
      256
    );

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const wrapKey = await deriveHkdfAes(shared, salt);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, wrapKey, toArrayBuffer(rawKey)
    );
    const ephemeralPublicKey = await window.crypto.subtle.exportKey(
      "jwk", ephemeral.publicKey
    );

    return {
      v: 1,
      alg: "ECDH-P256+HKDF-SHA256+AES-256-GCM",
      ephemeralPublicKey,
      salt: uint8ToB64(salt),
      iv: uint8ToB64(iv),
      ciphertext: uint8ToB64(new Uint8Array(ciphertext)),
    };
  },

  async unwrapKey(box, privateKey) {
    if (!box?.ephemeralPublicKey || !box?.salt || !box?.iv || !box?.ciphertext) {
      throw new Error("Kunci berbagi tidak valid.");
    }

    const ephemeralPublic = await window.crypto.subtle.importKey(
      "jwk", box.ephemeralPublicKey,
      { name: "ECDH", namedCurve: "P-256" },
      false, []
    );
    const shared = await window.crypto.subtle.deriveBits(
      { name: "ECDH", public: ephemeralPublic },
      privateKey,
      256
    );

    const wrapKey = await deriveHkdfAes(shared, toUint8Array(box.salt));
    const plain = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toUint8Array(box.iv) },
      wrapKey,
      toUint8Array(box.ciphertext)
    );
    return new Uint8Array(plain);
  },
};

async function importRawAesKey(rawKey, usages) {
  return window.crypto.subtle.importKey(
    "raw", toArrayBuffer(rawKey), { name: "AES-GCM", length: 256 }, false, usages
  );
}

async function deriveHkdfAes(sharedBits, salt) {
  const base = await window.crypto.subtle.importKey(
    "raw", sharedBits, "HKDF", false, ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: textEncoder.encode("MassiveArchive:archive-key:v1"),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  throw new Error("Data biner tidak valid.");
}

// Uint8Array → base64 string
export function uint8ToB64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Terima semua format yang mungkin → Uint8Array
export function toUint8Array(data) {
  if (typeof data === "string") {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  );
  if (typeof data === "object" && data !== null) {
    const keys = Object.keys(data).sort((a, b) => Number(a) - Number(b));
    const arr = new Uint8Array(keys.length);
    for (let i = 0; i < keys.length; i++) arr[i] = data[keys[i]];
    return arr;
  }
  throw new Error("Format data tidak dikenali: " + typeof data);
}