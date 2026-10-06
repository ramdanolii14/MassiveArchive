import { useState, useEffect } from "react";
import { IDB }    from "../database.js";
import { Crypto } from "../crypto.js";
import { fmtSize, fmtDT, fileTypeLabel, fileExtension } from "../utils.js";
import { EditForm, uploadEncryptedSource } from "./ArchiveViews.jsx";
import { Avatar } from "../components/Avatar.jsx";
import { OfficePreview } from "../components/OfficePreview.jsx";
import { logAudit } from "../audit.js";
import { createSecurePreview, previewKind } from "../securePreview.js";
import { VideoStreamPreview } from "../components/VideoStreamPreview.jsx";

const defaultSharedPermissions = {
  view: true,
  download: true,
  edit: false,
  reshare: false,
};

async function rotateAfterRevoke(current, revokedUsername, session, users, setProg) {
  if (current.owner !== session.username) {
    throw new Error("Hanya pemilik yang dapat merotasi kunci saat mencabut akses.");
  }

  const remaining = Array.from(
    new Set([session.username, ...(current.sharedWith || [])])
  ).filter(username => username !== revokedUsername);

  const byName = new Map(users.map(u => [u.username, u]));
  byName.set(session.username, {
    username: session.username,
    keyId: session.keyId,
    publicKey: session.publicKey,
  });

  for (const username of remaining) {
    const user = byName.get(username);
    if (!user?.publicKey || !user?.keyId) {
      throw new Error(
        `Pengguna "${username}" belum memiliki identitas keamanan sehingga rotasi kunci tidak dapat dilakukan.`
      );
    }
  }

  const archiveKey = Crypto.randomContentKey();
  const files = [];

  for (let i = 0; i < (current.files || []).length; i++) {
    const oldFile = current.files[i];
    setProg?.(`Menyiapkan ulang ${i + 1}/${current.files.length}`);
    let plain;

    if (current.keyMode === "envelope-v1") {
      const oldOwnerEnvelope = (current.keyEnvelopes || []).find(
        e => e.keyId === session.keyId
      );
      if (!oldOwnerEnvelope || !session.identityPrivateKey) {
        throw new Error("Kunci pemilik tidak tersedia untuk rotasi.");
      }
      const oldArchiveKey = await Crypto.unwrapKey(
        oldOwnerEnvelope.wrappedKey,
        session.identityPrivateKey
      );
      const oldCipher = await IDB.fileData(current.id, i, session, "download");
      plain = oldFile.encryptionMode === "chunked-aes-gcm-v1"
        ? await Crypto.decryptChunkedWithKey(oldCipher, oldArchiveKey, oldFile.size, oldFile.encryptionChunkSize)
        : await Crypto.decryptWithKey(oldCipher, oldArchiveKey);
    } else if (oldFile.encData) {
      plain = await Crypto.decrypt(oldFile.encData, session.passphrase);
    } else {
      const oldCipher = await IDB.fileData(current.id, i, session, "view");
      plain = await Crypto.decrypt(oldCipher, session.passphrase);
    }

    const uploaded = await uploadEncryptedSource(
      new Blob([plain], { type: oldFile.type || "application/octet-stream" }),
      archiveKey,
      oldFile,
      setProg
    );
    const nextFile = {
      name: oldFile.name,
      type: oldFile.type,
      size: oldFile.size,
      addedAt: oldFile.addedAt || new Date().toISOString(),
      ...uploaded,
    };

    if (previewKind(oldFile) && oldFile.size <= 50 * 1024 * 1024) {
      const preview = await createSecurePreview(plain, oldFile);
      if (preview?.blob) {
        nextFile.previewData = await Crypto.encryptWithKey(
          await preview.blob.arrayBuffer(),
          archiveKey
        );
        nextFile.previewType = preview.type;
        nextFile.previewSize = preview.size;
      }
    }

    files.push(nextFile);
  }

  const oldEnvelopes = new Map(
    (current.keyEnvelopes || []).map(e => [e.keyId, e])
  );
  const keyEnvelopes = [];

  for (const username of remaining) {
    const user = byName.get(username);
    const oldEnv = oldEnvelopes.get(user.keyId);
    const permissions = username === session.username
      ? { view: true, download: true, edit: true, reshare: true }
      : {
          ...defaultSharedPermissions,
          ...(oldEnv?.permissions || {}),
        };

    keyEnvelopes.push({
      keyId: user.keyId,
      username,
      wrappedKey: await Crypto.wrapKey(archiveKey, user.publicKey),
      permissions,
    });
  }

  return {
    files,
    keyMode: "envelope-v1",
    keyEnvelopes,
    sharedWith: remaining.filter(x => x !== session.username),
    updatedAt: new Date().toISOString(),
  };
}

function permissionsFor(arc, session) {
  if (!arc || !session) return {};
  if (arc.owner === session.username) {
    return { view: true, download: true, edit: true, reshare: true };
  }
  const env = (arc.keyEnvelopes || []).find(e => e.keyId === session.keyId);
  if (env) return { ...defaultSharedPermissions, ...(env.permissions || {}) };
  return {};
}

function hasPermission(arc, session, key) {
  return Boolean(permissionsFor(arc, session)[key]);
}

function permissionSummary(p) {
  return [
    p.view && "Lihat",
    p.download && "Unduh",
    p.edit && "Edit",
    p.reshare && "Bagikan",
  ].filter(Boolean).join(", ") || "Tidak ada akses";
}

async function unlockArchiveKeyForSession(arc, session) {
  if (arc?.keyMode !== "envelope-v1") return null;
  const envelope = (arc.keyEnvelopes || []).find(e => e.keyId === session.keyId);
  if (!envelope || !session.identityPrivateKey) {
    throw new Error("Kunci pribadi akun tidak memiliki akses ke arsip ini.");
  }
  return Crypto.unwrapKey(envelope.wrappedKey, session.identityPrivateKey);
}
export function DetailView({ recId, session, userAvatars, onBack, onDelete, toast, onReload }) {
  const [arc, setArc] = useState(null);
  const [prev, setPrev] = useState(null);
  const [decBusy, setDecBusy] = useState(null);
  const [decStage, setDecStage] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const reload = () => IDB.getMeta(recId).then(setArc);
  useEffect(() => {
    reload().catch(() => {});
    logAudit(session, "view", { archiveId: recId });
  }, [recId]);

  const isOwner = arc?.owner === session.username;
  const perms = permissionsFor(arc, session);
  const canView = isOwner || Boolean(perms.view);
  const canDownload = isOwner || Boolean(perms.download);
  const canEdit = isOwner || Boolean(perms.edit);
  const canReshare = isOwner || Boolean(perms.reshare);

  const decrypt = async (file, idx, purpose = "view") => {
    setDecBusy(file.name);
    setDecStage("Mengambil berkas");
    try {
      const encData = await IDB.fileData(arc.id, idx, session, purpose);
      setDecStage("Mendekripsi");

      let plain;
      if (arc.keyMode === "envelope-v1") {
        const envelope = (arc.keyEnvelopes || []).find(e => e.keyId === session.keyId);
        if (!envelope || !session.identityPrivateKey) {
          throw new Error("Kunci pribadi akun tidak memiliki akses ke arsip ini.");
        }
        const archiveKey = await Crypto.unwrapKey(
          envelope.wrappedKey,
          session.identityPrivateKey
        );
        plain = file.encryptionMode === "chunked-aes-gcm-v1"
          ? await Crypto.decryptChunkedWithKey(encData, archiveKey, file.size, file.encryptionChunkSize)
          : await Crypto.decryptWithKey(encData, archiveKey);
      } else {
        plain = await Crypto.decrypt(encData, session.passphrase);
      }

      setDecBusy(null);
      const outputType =
        purpose === "view" && file.previewType
          ? file.previewType
          : file.type || "application/octet-stream";
      return new Blob([plain], { type: outputType });
    } catch (e) {
      setDecBusy(null);
      toast(e.message || "Gagal membuka berkas.", "err");
      return null;
    }
  };

  const download = async (file, idx) => {
    if (!canDownload) {
      toast("Anda tidak memiliki izin mengunduh berkas ini.", "err");
      return;
    }
    const blob = await decrypt(file, idx, "download");
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    logAudit(session, "download", { archiveId: arc.id, title: arc.title, fileName: file.name });
  };

  const preview = async (file, idx) => {
    if (!canView) {
      toast("Anda tidak memiliki izin melihat arsip ini.", "err");
      return;
    }
    const blob = await decrypt(file, idx);
    if (!blob) return;

    const ext = fileExtension(file.name);
    const type = (file.type || "").toLowerCase();
    const kind =
      type.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg","bmp","ico","avif"].includes(ext) ? "image" :
      type.startsWith("video/") || ["mp4","webm","ogv","ogg","mov","m4v","mkv","avi","flv","wmv","3gp","mpeg","mpg","ts"].includes(ext) ? "video" :
      type.startsWith("audio/") || ["mp3","m4a","flac","wav","ogg","oga","opus","aac","wma","aiff"].includes(ext) ? "audio" :
      type === "application/pdf" || ext === "pdf" ? "pdf" :
      type.startsWith("text/") || ["txt","md","csv","log","json","xml","yaml","yml","html","htm","css","js","jsx","ts","tsx","svg"].includes(ext) ? "text" :
      ["doc","docx","xls","xlsx","ppt","pptx","odt","ods","odp","rtf"].includes(ext) ? "office" :
      "binary";

    if (kind === "video" && file.storageMode === "chunks" && arc.keyMode === "envelope-v1") {
      try {
        const archiveKey = await unlockArchiveKeyForSession(arc, session);
        setPrev({ file, idx, kind, videoStream: true, archiveKey, blob: null, url: null });
        logAudit(session, "preview", { archiveId: arc.id, title: arc.title, fileName: file.name });
      } catch (e) {
        toast(e.message || "Gagal membuka streaming video.", "err");
      }
      return;
    }

    const officeSupported = ["docx", "xlsx", "pptx"].includes(ext);
    let text = "";
    let hex = "";
    if (kind === "text") {
      text = await blob.text();
    } else if ((kind === "binary" || kind === "office") && !officeSupported) {
      const bytes = new Uint8Array(await blob.slice(0, 8192).arrayBuffer());
      const lines = [];
      for (let i = 0; i < bytes.length; i += 16) {
        const row = Array.from(bytes.slice(i, i + 16))
          .map(b => b.toString(16).padStart(2, "0"))
          .join(" ");
        lines.push(row);
      }
      hex = lines.join("\n");
    }

    setPrev({
      file,
      idx,
      kind,
      officeSupported,
      text,
      hex,
      blob,
      url: URL.createObjectURL(blob),
    });
    logAudit(session, "preview", { archiveId: arc.id, title: arc.title, fileName: file.name });
  };

  const closePreview = () => {
    if (prev?.url) URL.revokeObjectURL(prev.url);
    setPrev(null);
  };

  if (!arc) return <div className="loading">Memuat...</div>;

  if (arc.deletedAt) {
    return (
      <div style={{ maxWidth: 760 }}>
        <button className="btn btn-g btn-sm" style={{ marginBottom: 14 }} onClick={onBack}>Kembali</button>
        <div className="panel pad">
          <div className="locked">Arsip ini berada di Tempat Sampah.</div>
        </div>
      </div>
    );
  }

  if (editOpen && canEdit) {
    return (
      <EditForm
        session={session}
        arcId={recId}
        onSave={async () => {
          await reload();
          await onReload();
          await logAudit(session, "edit", { archiveId: recId, title: arc.title });
          setEditOpen(false);
          toast("Perubahan disimpan.");
        }}
        onCancel={() => setEditOpen(false)}
      />
    );
  }

  const fields = [
    ["Tanggal dokumen", arc.date],
    ["Ditambahkan", fmtDT(arc.createdAt)],
    arc.author && ["Penyusun", arc.author],
    arc.reference && ["No. referensi", arc.reference],
    arc.location && ["Lokasi", arc.location],
    !isOwner && ["Pemilik", arc.owner],
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: 920 }}>
      <button className="btn btn-g btn-sm" style={{ marginBottom: 14 }} onClick={onBack}>Kembali</button>

      <div className="panel pad" style={{ padding: "28px 30px" }}>
        <div className="dt-head">
          <div className="grow">
            <div className="dt-id">{arc.archiveId}</div>
            <div className="dt-title">{arc.title}</div>
            <div className="archive-uploader">
              <Avatar src={userAvatars?.[arc.owner]} name={arc.owner} />
              <div>
                <div className="archive-uploader-label">Diunggah oleh</div>
                <div className="archive-uploader-name">{arc.owner}</div>
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {arc.category && <span className="badge">{arc.category}</span>}
              {arc.status && <span className="badge badge-line">{arc.status}</span>}
              {(arc.tags || []).map(t => <span key={t} className="badge badge-line">{t}</span>)}
            </div>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            {canEdit && <button className="btn btn-s btn-sm" onClick={() => setEditOpen(true)}>Edit</button>}
            {canReshare && <button className="btn btn-s btn-sm" onClick={() => setShareOpen(true)}>Bagikan</button>}
            {isOwner && <button className="btn btn-d btn-sm" onClick={() => onDelete(arc.id)}>Hapus</button>}
          </div>
        </div>

        <div className="dt-grid">
          {fields.map(([k, v]) => (
            <div key={k}>
              <div className="df-lbl">{k}</div>
              <div className="df-val">{v}</div>
            </div>
          ))}
        </div>

        {arc.description && <div className="note">{arc.description}</div>}
        {arc.notes && isOwner && (
          <div className="note">
            <div className="df-lbl" style={{ marginBottom: 4 }}>Catatan pribadi</div>
            {arc.notes}
          </div>
        )}

        {!isOwner && (
          <div className="note">
            <div className="df-lbl" style={{ marginBottom: 4 }}>Izin Anda</div>
            {permissionSummary(perms)}
          </div>
        )}

        <div className="files-title">Berkas ({arc.files?.length || 0})</div>

        {!canView ? (
          <div className="locked">Anda tidak memiliki izin untuk melihat isi berkas ini.</div>
        ) : !arc.files?.length ? (
          <div className="locked">Tidak ada berkas.</div>
        ) : (
          <div className="fcards">
            {arc.files.map((file, i) => (
              <div key={i} className="fcard">
                <span className="fi-type">{fileTypeLabel(file.type)}</span>
                <div className="fcard-name">{file.name}</div>
                <div className="fi-sz">{fmtSize(file.size)}</div>
                <div className="fcard-acts">
                  <button
                    className="btn btn-s btn-sm"
                    onClick={() => preview(file, i)}
                    disabled={decBusy === file.name}
                  >
                    {decBusy === file.name ? "..." : "Lihat"}
                  </button>
                  {canDownload && (
                    <button
                      className="btn btn-s btn-sm"
                      onClick={() => download(file, i)}
                      disabled={decBusy === file.name}
                    >
                      {decBusy === file.name ? "..." : "Unduh"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {prev && (
        <div className="ov" onClick={closePreview}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-ttl">{prev.file.name}</div>
              <div className="row" style={{ flexShrink: 0 }}>
                {canDownload && (
                  <button className="btn btn-s btn-sm" onClick={() => download(prev.file, prev.idx)}>Unduh</button>
                )}
                <button className="btn btn-g btn-sm" onClick={closePreview}>Tutup</button>
              </div>
            </div>
            <div className="modal-body">
              {prev.kind === "image" && <img src={prev.url} alt={prev.file.name} className="img-thumb" />}
              {prev.kind === "video" && prev.videoStream && (
                <VideoStreamPreview
                  file={prev.file}
                  archiveId={arc.id}
                  fileIndex={prev.idx}
                  archiveKey={prev.archiveKey}
                  onError={error => toast(error.message || "Streaming video gagal.", "err")}
                />
              )}
              {prev.kind === "video" && !prev.videoStream && (
                <video
                  src={prev.url}
                  controls
                  controlsList="nodownload"
                  playsInline
                  onContextMenu={e => e.preventDefault()}
                  style={{ maxWidth: "100%", maxHeight: "70vh" }}
                />
              )}
              {prev.kind === "audio" && (
                <div style={{ width: "100%", padding: "30px 10px" }}>
                  <audio src={prev.url} controls style={{ width: "100%" }} />
                </div>
              )}
              {prev.kind === "pdf" && <iframe src={prev.url} className="pdf-frame" title={prev.file.name} />}
              {prev.kind === "text" && (
                <pre style={{ whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "70vh", margin: 0 }}>
                  {prev.text}
                </pre>
              )}
              {prev.kind === "office" && prev.officeSupported && (
                <OfficePreview blob={prev.blob} fileName={prev.file.name} />
              )}
              {(prev.kind === "office" && !prev.officeSupported || prev.kind === "binary") && (
                <div style={{ width: "100%" }}>
                  <div className="note">
                    <strong>Pratinjau data umum</strong><br />
                    Format <strong>.{fileExtension(prev.file.name) || "bin"}</strong> belum memiliki renderer lokal yang kompatibel.
                    <br />Byte awal berkas ditampilkan untuk memastikan isi berhasil dibaca dan didekripsi.
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "55vh", marginTop: 12 }}>
                    {prev.hex || "(berkas kosong)"}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {decBusy && (
        <div className="ov dec-ov">
          <div className="dec-card">
            <div className="dec-ring" />
            <div className="dec-title">{decStage}</div>
            <div className="dec-name">{decBusy}</div>
            <div className="dec-bar"><div /></div>
          </div>
        </div>
      )}

      {shareOpen && canReshare && (
        <ShareModal
          arc={arc}
          session={session}
          onClose={() => setShareOpen(false)}
          toast={toast}
          onReload={async () => {
            await reload();
            await onReload();
          }}
        />
      )}
    </div>
  );
}

export function ShareModal({ arc, session, onClose, toast, onReload }) {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [permissions, setPermissions] = useState({ ...defaultSharedPermissions });
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [sharedWith, setSharedWith] = useState(arc.sharedWith || []);

  useEffect(() => {
    IDB.getAllUsers()
      .then(u => setUsers(u.filter(x => x.username !== session.username)))
      .catch(() => setUsers([]));
  }, [session.username]);

  const findRecipient = () => users.find(u => u.username === recipient);

  const setRecipientAndLoad = username => {
    setRecipient(username);
    if (!username) {
      setPermissions({ ...defaultSharedPermissions });
      return;
    }
    const target = users.find(u => u.username === username);
    const current = (arc.keyEnvelopes || []).find(e =>
      e.keyId === target?.keyId || e.username === username
    );
    setPermissions({
      ...defaultSharedPermissions,
      ...(current?.permissions || {}),
    });
  };

  const buildEnvelope = (username, user, nextPermissions) => {
    if (!user?.publicKey || !user?.keyId) {
      throw new Error(
        `Pengguna "${username}" belum menyiapkan kunci pribadi. Minta pengguna tersebut masuk ke akun sekali terlebih dahulu.`
      );
    }
    return {
      keyId: user.keyId,
      username,
      wrappedKey: null,
      permissions: { ...defaultSharedPermissions, ...nextPermissions },
    };
  };

  const ensureSecurePreviews = async (fullArc, archiveKey) => {
    const files = [...(fullArc.files || [])];
    let changed = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!previewKind(file) || file.previewData || file.hasPreview) continue;

      const encrypted = await IDB.fileData(fullArc.id, i, session, "download");
      const plain = await Crypto.decryptWithKey(encrypted, archiveKey);
      const preview = await createSecurePreview(plain, file);
      if (!preview?.blob) continue;

      files[i] = {
        ...file,
        previewData: await Crypto.encryptWithKey(
          await preview.blob.arrayBuffer(),
          archiveKey
        ),
        previewType: preview.type,
        previewSize: preview.size,
      };
      changed = true;
    }

    return changed ? files : null;
  };

  const legacyPermissionsFor = (fullArc, username, nextPermissions) => {
    const env = (fullArc.keyEnvelopes || []).find(e => e.username === username);
    if (username === recipient) return { ...defaultSharedPermissions, ...nextPermissions };
    if (env?.permissions) return { ...defaultSharedPermissions, ...env.permissions };
    return { view: true, download: true, edit: false, reshare: false };
  };

  const upgradeLegacyArchive = async (fullArc, additionalUser) => {
    const existingRecipients = Array.from(
      new Set([session.username, ...(fullArc.sharedWith || []), additionalUser])
    );
    const userByName = new Map(users.map(u => [u.username, u]));
    userByName.set(session.username, {
      username: session.username,
      keyId: session.keyId,
      publicKey: session.publicKey,
    });

    for (const username of existingRecipients) {
      const user = userByName.get(username);
      if (!user?.publicKey || !user?.keyId) {
        throw new Error(
          `Pengguna "${username}" belum memiliki identitas keamanan. Pengguna tersebut harus masuk sekali sebelum arsip ini bisa dibagikan secara aman.`
        );
      }
    }

    const archiveKey = Crypto.randomContentKey();
    const files = [];
    for (let i = 0; i < (fullArc.files || []).length; i++) {
      const f = fullArc.files[i];
      const encrypted = await IDB.fileData(fullArc.id, i, session, "download");
      const plain = await Crypto.decrypt(encrypted, session.passphrase);
      const nextFile = {
        ...f,
        encData: await Crypto.encryptWithKey(plain, archiveKey),
      };

      if (previewKind(f)) {
        const preview = await createSecurePreview(plain, f);
        if (preview?.blob) {
          nextFile.previewData = await Crypto.encryptWithKey(
            await preview.blob.arrayBuffer(),
            archiveKey
          );
          nextFile.previewType = preview.type;
          nextFile.previewSize = preview.size;
        }
      }

      files.push(nextFile);
    }

    const keyEnvelopes = [];
    for (const username of existingRecipients) {
      const user = userByName.get(username);
      const entry = buildEnvelope(
        username,
        user,
        legacyPermissionsFor(fullArc, username, username === additionalUser ? permissions : {})
      );
      entry.wrappedKey = await Crypto.wrapKey(archiveKey, user.publicKey);
      keyEnvelopes.push(entry);
    }

    return {
      ...fullArc,
      keyMode: "envelope-v1",
      keyEnvelopes,
      files,
      sharedWith: Array.from(new Set([...(fullArc.sharedWith || []), additionalUser])),
    };
  };

  const handleShare = async () => {
    if (!recipient) { toast("Pilih penerima.", "err"); return; }
    if (!permissions.view) { toast("Izin Lihat wajib diaktifkan.", "err"); return; }

    const target = findRecipient();
    if (!target?.publicKey || !target?.keyId) {
      toast(
        `Pengguna "${recipient}" perlu masuk ke akun sekali agar kunci pribadinya dibuat.`,
        "err"
      );
      return;
    }

    setBusy(true);
    try {
      const current = await IDB.get(arc.id, session);
      if (!current) throw new Error("Arsip tidak ditemukan.");

      if (current.keyMode === "envelope-v1") {
        const archiveEnvelope = (current.keyEnvelopes || []).find(e => e.keyId === session.keyId);
        if (!archiveEnvelope || !session.identityPrivateKey) {
          throw new Error("Kunci pribadi Anda tidak memiliki akses pemilik ke arsip.");
        }

        const archiveKey = await Crypto.unwrapKey(
          archiveEnvelope.wrappedKey,
          session.identityPrivateKey
        );

        const keyEnvelopes = [...(current.keyEnvelopes || [])];
        const existingKey = keyEnvelopes.findIndex(e => e.keyId === target.keyId);
        const wrappedKey = await Crypto.wrapKey(archiveKey, target.publicKey);
        const entry = buildEnvelope(recipient, target, permissions);
        entry.wrappedKey = wrappedKey;

        if (!entry.wrappedKey) {
          throw new Error("Kunci berbagi gagal dibuat.");
        }

        if (existingKey >= 0) keyEnvelopes[existingKey] = entry;
        else keyEnvelopes.push(entry);

        const newShared = Array.from(
          new Set([...(current.sharedWith || []), recipient])
        );

        await IDB.update(current.id, {
          sharedWith: newShared,
          keyMode: "envelope-v1",
          keyEnvelopes,
        }, session);
      } else {
        const upgraded = await upgradeLegacyArchive(current, recipient);
        await IDB.update(current.id, upgraded, session);
      }

      await IDB.addInbox({
        recipient,
        from: session.username,
        archiveId: arc.id,
        archiveNum: arc.archiveId,
        archiveTitle: arc.title,
        message,
        sentAt: new Date().toISOString(),
        read: false,
      });

      await logAudit(session, "share", {
        archiveId: arc.id,
        title: arc.title,
        recipient,
        permissions: { ...permissions },
      });
      const nextShared = Array.from(new Set([...sharedWith, recipient]));
      setSharedWith(nextShared);
      await onReload();
      toast(`Arsip dibagikan ke ${recipient}.`);
      setMessage("");
    } catch (e) {
      toast(e.message || "Gagal membagikan arsip.", "err");
    }
    setBusy(false);
  };

  const removeShare = async username => {
    setBusy(true);
    try {
      const current = await IDB.get(arc.id);
      if (!current) throw new Error("Arsip tidak ditemukan.");

      const allUsers = await IDB.getAllUsers();
      const progress = value => {
        if (value) setBusy(value);
      };

      const rotated = await rotateAfterRevoke(
        current,
        username,
        session,
        allUsers,
        progress
      );

      await IDB.update(current.id, rotated);
      await logAudit(session, "revoke", {
        archiveId: arc.id,
        title: arc.title,
        recipient: username,
        keyRotation: true,
      });

      setSharedWith(rotated.sharedWith);
      await onReload();
      toast(`Akses ${username} dicabut dan kunci arsip dirotasi.`);
    } catch (e) {
      toast(e.message || "Gagal mencabut akses.", "err");
    }
    setBusy(false);
  };

  return (
    <div className="ov" onClick={onClose}>
      <div className="modal modal-sm share-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-ttl">Bagikan arsip</div>
          <button className="btn btn-g btn-sm" onClick={onClose}>Tutup</button>
        </div>
        <div className="modal-body">
          <div className="note">
            Penerima memakai kunci pribadi akunnya sendiri. Pilih izin yang diberikan.
          </div>

          <div className="stack">
            <div className="field">
              <label>Penerima</label>
              <select value={recipient} onChange={e => setRecipientAndLoad(e.target.value)}>
                <option value="">Pilih pengguna</option>
                {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
              </select>
            </div>

            {recipient && (
              <div className="permission-grid">
                {[
                  ["view", "Lihat", "Boleh membuka dan melihat berkas"],
                  ["download", "Unduh", "Boleh mengunduh berkas"],
                  ["edit", "Edit", "Boleh mengubah metadata dan berkas"],
                  ["reshare", "Bagikan", "Boleh membagikan lagi ke pengguna lain"],
                ].map(([key, label, desc]) => (
                  <label key={key} className="permission-item">
                    <input
                      type="checkbox"
                      checked={Boolean(permissions[key])}
                      onChange={e => setPermissions(p => ({ ...p, [key]: e.target.checked }))}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{desc}</small>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="field">
              <label>Pesan</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                placeholder="Pesan untuk penerima (opsional)" />
            </div>

            <button className="btn btn-p" onClick={handleShare} disabled={busy || !recipient}>
              {busy ? "Memproses..." : "Simpan akses"}
            </button>

            <div>
              <div className="df-lbl" style={{ marginBottom: 8 }}>Pengguna yang sudah diberi akses</div>
              {sharedWith.length === 0 ? (
                <div className="td-sub">Belum ada.</div>
              ) : (
                <div className="stack share-list">
                  {sharedWith.map(username => {
                    const target = users.find(u => u.username === username);
                    const env = (arc.keyEnvelopes || []).find(e =>
                      e.keyId === target?.keyId || e.username === username
                    );
                    const p = { ...defaultSharedPermissions, ...(env?.permissions || {}) };
                    return (
                      <div key={username} className="share-row">
                        <div className="grow">
                          <div className="td-title">{username}</div>
                          <div className="td-sub">{permissionSummary(p)}</div>
                        </div>
                        <button
                          className="btn btn-g btn-sm"
                          disabled={busy}
                          onClick={() => setRecipientAndLoad(username)}
                        >
                          Atur
                        </button>
                        <button
                          className="btn btn-d btn-sm"
                          disabled={busy}
                          onClick={() => removeShare(username)}
                        >
                          Cabut
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
