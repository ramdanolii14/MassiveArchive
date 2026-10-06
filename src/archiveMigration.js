import { IDB } from "./database.js";
import { Crypto } from "./crypto.js";

const DEFAULT_SHARED = {
  view: true,
  download: true,
  edit: false,
  reshare: false,
};

async function encryptedFileData(archive, file, index, session) {
  if (file.encData) return file.encData;
  return IDB.fileData(archive.id, index, session, "download");
}

export async function migrateLegacyArchives(session, legacyPassphrase, setProgress = () => {}) {
  const metas = await IDB.listMeta({
    scope: "owner",
    username: session.username,
  });
  const legacy = metas.filter(a =>
    a.owner === session.username &&
    a.keyMode !== "envelope-v1" &&
    (a.fileCount || a.files?.length || 0) > 0
  );

  if (!legacy.length) {
    return { migrated: 0, files: 0 };
  }

  const users = await IDB.getAllUsers().catch(() => []);
  const byName = new Map(users.map(u => [u.username, u]));
  byName.set(session.username, {
    username: session.username,
    publicKey: session.publicKey,
    keyId: session.keyId,
  });

  let migrated = 0;
  let filesDone = 0;
  const totalFiles = legacy.reduce((n, a) => n + (a.fileCount || 0), 0);

  for (const meta of legacy) {
    const archive = await IDB.get(meta.id);
    if (!archive) throw new Error(`Arsip "${meta.title}" tidak ditemukan.`);
    const archiveKey = Crypto.randomContentKey();
    const files = [];

    for (let i = 0; i < (archive.files || []).length; i++) {
      const oldFile = archive.files[i];
      const encrypted = await encryptedFileData(archive, oldFile, i, session);

      let plain;
      try {
        plain = await Crypto.decrypt(encrypted, legacyPassphrase);
      } catch {
        throw new Error(
          `Password lama tidak dapat membuka arsip "${archive.title}" pada berkas "${oldFile.name}".`
        );
      }

      const encData = await Crypto.encryptWithKey(plain, archiveKey);
      const nextFile = { ...oldFile, encData };
      delete nextFile.payloadRef;
      files.push(nextFile);
      filesDone++;
      setProgress(`${filesDone}/${totalFiles}`);
    }

    const keyEnvelopes = [];
    const usernames = Array.from(
      new Set([session.username, ...(archive.sharedWith || [])])
    );

    for (const username of usernames) {
      const user = byName.get(username);
      if (!user?.publicKey || !user?.keyId) {
        if (username === session.username) {
          throw new Error("Identitas keamanan akun pemilik belum tersedia.");
        }
        continue;
      }

      const existing = (archive.keyEnvelopes || []).find(e =>
        e.keyId === user.keyId || e.username === username
      );

      keyEnvelopes.push({
        keyId: user.keyId,
        username,
        wrappedKey: await Crypto.wrapKey(archiveKey, user.publicKey),
        permissions: username === session.username
          ? { view: true, download: true, edit: true, reshare: true }
          : { ...DEFAULT_SHARED, ...(existing?.permissions || {}) },
      });
    }

    if (!keyEnvelopes.some(e => e.keyId === session.keyId)) {
      throw new Error(`Gagal membuat kunci akses untuk arsip "${archive.title}".`);
    }

    await IDB.update(archive.id, {
      keyMode: "envelope-v1",
      keyEnvelopes,
      files,
      updatedAt: new Date().toISOString(),
    });

    migrated++;
  }

  return { migrated, files: filesDone };
}
