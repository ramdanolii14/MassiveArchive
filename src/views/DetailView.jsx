import { useState, useEffect } from "react";
import { IDB }    from "../database.js";
import { Crypto } from "../crypto.js";
import { fmtSize, fmtDT, fileTypeLabel, fileExtension } from "../utils.js";
import { EditForm } from "./ArchiveViews.jsx";
import { Avatar } from "../components/Avatar.jsx";

export function DetailView({ recId, session, userAvatars, onBack, onDelete, toast, onReload }) {
  const [arc,       setArc]       = useState(null);
  const [prev,      setPrev]      = useState(null);
  const [decBusy,   setDecBusy]   = useState(null);
  const [decStage,  setDecStage]  = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);

  const reload = () => IDB.getMeta(recId).then(setArc);
  useEffect(() => { reload(); }, [recId]);

  const isOwner   = arc?.owner === session.username;
  const canAccess = isOwner || (arc?.sharedWith || []).includes(session.username);

  // Arsip baru/share-ready memakai archive key acak. Kunci arsip
  // dibungkus khusus untuk setiap user dan dibuka dengan private key
  // milik user tersebut. Arsip lama tetap didukung dengan passphrase.
  const decrypt = async (file, idx) => {
    setDecBusy(file.name);
    setDecStage("Mengambil berkas");
    try {
      const encData = await IDB.fileData(arc.id, idx);
      setDecStage("Mendekripsi");

      let plain;
      if (arc.keyMode === "envelope-v1") {
        const envelope = (arc.keyEnvelopes || []).find(
          e => e.keyId === session.keyId
        );
        if (!envelope || !session.identityPrivateKey) {
          throw new Error("Kunci pribadi akun tidak memiliki akses ke arsip ini.");
        }
        const archiveKey = await Crypto.unwrapKey(
          envelope.wrappedKey,
          session.identityPrivateKey
        );
        plain = await Crypto.decryptWithKey(encData, archiveKey);
      } else {
        // Kompatibilitas dengan arsip sebelum sistem berbagi baru.
        plain = await Crypto.decrypt(encData, session.passphrase);
      }

      setDecBusy(null);
      return new Blob([plain], { type: file.type });
    } catch (e) {
      setDecBusy(null);
      toast(
        e.message || "Gagal membuka berkas.",
        "err"
      );
      return null;
    }
  };

  const download = async (file, idx) => {
    const blob = await decrypt(file, idx);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
  };

  const preview = async (file, idx) => {
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

    let text = "";
    let hex = "";
    if (kind === "text") {
      text = await blob.text();
    } else if (kind === "binary" || kind === "office") {
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
      file, idx, kind, text, hex,
      url: URL.createObjectURL(blob),
    });
  };

  const closePreview = () => {
    if (prev?.url) URL.revokeObjectURL(prev.url);
    setPrev(null);
  };

  // Semua berkas mendapatkan tombol "Lihat". Format yang didukung browser
  // dirender langsung; format lain tetap mendapat pratinjau data umum.\n  const canPreview = () => true;

  if (!arc) return <div className="loading">Memuat...</div>;

  if (editOpen && isOwner) {
    return (
      <EditForm
        session={session}
        arcId={recId}
        onSave={async () => {
          await reload();
          await onReload();
          setEditOpen(false);
          toast("Perubahan disimpan.");
        }}
        onCancel={() => setEditOpen(false)}
      />
    );
  }

  const fields = [
    ["Tanggal dokumen", arc.date],
    ["Ditambahkan",     fmtDT(arc.createdAt)],
    arc.author    && ["Penyusun", arc.author],
    arc.reference && ["No. referensi", arc.reference],
    arc.location  && ["Lokasi", arc.location],
    !isOwner      && ["Pemilik", arc.owner],
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
              {arc.status   && <span className="badge badge-line">{arc.status}</span>}
              {(arc.tags || []).map(t => <span key={t} className="badge badge-line">{t}</span>)}
            </div>
          </div>
          {isOwner && (
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-s btn-sm" onClick={() => setEditOpen(true)}>Edit</button>
              <button className="btn btn-s btn-sm" onClick={() => setShareOpen(true)}>Bagikan</button>
              <button className="btn btn-d btn-sm" onClick={() => onDelete(arc.id)}>Hapus</button>
            </div>
          )}
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

        <div className="files-title">Berkas ({arc.files?.length || 0})</div>

        {!canAccess ? (
          <div className="locked">
            Hanya pemilik dan pengguna yang diberi akses yang bisa membuka berkas. Hubungi {arc.owner}.
          </div>
        ) : !arc.files?.length ? (
          <div className="locked">Tidak ada berkas.</div>
        ) : (
          <>
            {!isOwner && (
              <div className="df-lbl" style={{ marginBottom: 12 }}>
                Berkas ini memakai kata kunci milik {arc.owner}.
              </div>
            )}
            <div className="fcards">
              {arc.files.map((file, i) => (
                <div key={i} className="fcard">
                  <span className="fi-type">{fileTypeLabel(file.type)}</span>
                  <div className="fcard-name">{file.name}</div>
                  <div className="fi-sz">{fmtSize(file.size)}</div>
                  <div className="fcard-acts">
                    <button className="btn btn-s btn-sm" onClick={() => preview(file, i)}
                      disabled={decBusy === file.name}>
                      {decBusy === file.name ? "..." : "Lihat"}
                    </button>
                    <button className="btn btn-s btn-sm" onClick={() => download(file, i)}
                      disabled={decBusy === file.name}>
                      {decBusy === file.name ? "..." : "Unduh"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {prev && (
        <div className="ov" onClick={closePreview}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-ttl">{prev.file.name}</div>
              <div className="row" style={{ flexShrink: 0 }}>
                <button className="btn btn-s btn-sm" onClick={() => download(prev.file, prev.idx)}>Unduh</button>
                <button className="btn btn-g btn-sm" onClick={closePreview}>Tutup</button>
              </div>
            </div>
            <div className="modal-body">
              {prev.kind === "image" && (
                <img src={prev.url} alt={prev.file.name} className="img-thumb" />
              )}
              {prev.kind === "video" && (
                <video src={prev.url} controls playsInline style={{ maxWidth: "100%", maxHeight: "70vh" }} />
              )}
              {prev.kind === "audio" && (
                <div style={{ width: "100%", padding: "30px 10px" }}>
                  <audio src={prev.url} controls style={{ width: "100%" }} />
                </div>
              )}
              {prev.kind === "pdf" && (
                <iframe src={prev.url} className="pdf-frame" title={prev.file.name} />
              )}
              {prev.kind === "text" && (
                <pre style={{ whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "70vh", margin: 0 }}>
                  {prev.text}
                </pre>
              )}
              {(prev.kind === "office" || prev.kind === "binary") && (
                <div style={{ width: "100%" }}>
                  <div className="note">
                    <strong>Pratinjau data umum</strong><br />
                    Format <strong>.{fileExtension(prev.file.name) || "bin"}</strong>
                    {prev.kind === "office"
                      ? " tidak dapat dirender penuh oleh browser tanpa mesin Office."
                      : " tidak memiliki renderer universal di browser."}
                    <br />Bagian berikut menampilkan byte awal berkas untuk memastikan isi berhasil dibaca dan didekripsi.
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

      {shareOpen && (
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
  const [recipient,  setRecipient]  = useState("");
  const [message,    setMessage]    = useState("");
  const [busy,       setBusy]       = useState(false);
  const [users,      setUsers]      = useState([]);
  const [sharedWith, setSharedWith] = useState(arc.sharedWith || []);

  useEffect(() => {
    IDB.getAllUsers()
      .then(u => setUsers(u.filter(x => x.username !== session.username)))
      .catch(() => setUsers([]));
  }, [session.username]);

  const findRecipient = () => users.find(u => u.username === recipient);

  const buildEnvelope = async (username, user) => {
    if (!user?.publicKey || !user?.keyId) {
      throw new Error(
        `Pengguna "${username}" belum menyiapkan kunci pribadi. Minta pengguna tersebut masuk ke akun sekali terlebih dahulu.`
      );
    }
    return {
      keyId: user.keyId,
      username,
      wrappedKey: null,
    };
  };

  const upgradeLegacyArchive = async (fullArc, additionalUser) => {
    const existingRecipients = Array.from(
      new Set([session.username, ...(fullArc.sharedWith || []), recipient])
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

    for (const f of fullArc.files || []) {
      const plain = await Crypto.decrypt(f.encData, session.passphrase);
      files.push({
        ...f,
        encData: await Crypto.encryptWithKey(plain, archiveKey),
      });
    }

    const keyEnvelopes = [];
    for (const username of existingRecipients) {
      const user = userByName.get(username);
      const entry = await buildEnvelope(username, user);
      entry.wrappedKey = await Crypto.wrapKey(archiveKey, user.publicKey);
      keyEnvelopes.push(entry);
    }

    return {
      ...fullArc,
      keyMode: "envelope-v1",
      keyEnvelopes,
      files,
      sharedWith: Array.from(
        new Set([...(fullArc.sharedWith || []), additionalUser])
      ),
    };
  };

  const handleShare = async () => {
    if (!recipient) { toast("Pilih penerima.", "err"); return; }
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
      const current = await IDB.get(arc.id);
      if (!current) throw new Error("Arsip tidak ditemukan.");

      if (current.keyMode === "envelope-v1") {
        const archiveEnvelope = (current.keyEnvelopes || []).find(
          e => e.keyId === session.keyId
        );
        if (!archiveEnvelope || !session.identityPrivateKey) {
          throw new Error("Kunci pribadi Anda tidak memiliki akses pemilik ke arsip.");
        }

        const archiveKey = await Crypto.unwrapKey(
          archiveEnvelope.wrappedKey,
          session.identityPrivateKey
        );

        const keyEnvelopes = [...(current.keyEnvelopes || [])];
        const existingKey = keyEnvelopes.findIndex(
          e => e.keyId === target.keyId
        );

        const wrappedKey = await Crypto.wrapKey(archiveKey, target.publicKey);
        const entry = {
          keyId: target.keyId,
          username: recipient,
          wrappedKey,
        };

        if (existingKey >= 0) keyEnvelopes[existingKey] = entry;
        else keyEnvelopes.push(entry);

        const newShared = Array.from(
          new Set([...(current.sharedWith || []), recipient])
        );

        await IDB.update(current.id, {
          sharedWith: newShared,
          keyMode: "envelope-v1",
          keyEnvelopes,
        });
      } else {
        const upgraded = await upgradeLegacyArchive(current, recipient);
        await IDB.update(current.id, upgraded);
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

      const nextShared = Array.from(new Set([...sharedWith, recipient]));
      setSharedWith(nextShared);
      await onReload();
      toast(`Arsip dibagikan ke ${recipient}. Penerima tidak perlu kunci pemilik.`);
      setRecipient("");
      setMessage("");
    } catch (e) {
      toast(e.message || "Gagal membagikan arsip.", "err");
    }
    setBusy(false);
  };

  const removeShare = async (username) => {
    setBusy(true);
    try {
      const current = await IDB.get(arc.id);
      if (!current) throw new Error("Arsip tidak ditemukan.");

      const newShared = (current.sharedWith || []).filter(x => x !== username);
      const patch = { sharedWith: newShared };

      if (current.keyMode === "envelope-v1") {
        const userRecord = users.find(u => u.username === username);
        const keyId =
          userRecord?.keyId ||
          current.keyEnvelopes?.find(e => e.username === username)?.keyId;

        patch.keyEnvelopes = keyId
          ? (current.keyEnvelopes || []).filter(e => e.keyId !== keyId)
          : (current.keyEnvelopes || []);
      }

      await IDB.update(current.id, patch);
      setSharedWith(newShared);
      await onReload();
      toast("Akses " + username + " dicabut.");
    } catch (e) {
      toast(e.message || "Gagal mencabut akses.", "err");
    }
    setBusy(false);
  };

  return (
    <div className="ov" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-ttl">Bagikan arsip</div>
          <button className="btn btn-g btn-sm" onClick={onClose}>Tutup</button>
        </div>
        <div className="modal-body">
          <div className="note" style={{ marginBottom: 16 }}>
            Penerima menggunakan <strong>kunci pribadi akunnya sendiri</strong>.
            Password pemilik tidak pernah dibutuhkan untuk membuka arsip.
          </div>

          {users.length === 0 ? (
            <div className="locked">Belum ada pengguna lain di perangkat ini.</div>
          ) : (
            <div className="stack">
              <div className="field">
                <label>Penerima</label>
                <select value={recipient} onChange={e => setRecipient(e.target.value)}>
                  <option value="">Pilih pengguna</option>
                  {users.map(u => (
                    <option
                      key={u.username}
                      value={u.username}
                      disabled={sharedWith.includes(u.username)}
                    >
                      {u.username}{sharedWith.includes(u.username) ? " (sudah dibagikan)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Pesan (opsional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} />
              </div>
              <button className="btn btn-p" onClick={handleShare} disabled={busy || !recipient}>
                {busy ? "Menyiapkan kunci..." : "Bagikan"}
              </button>
            </div>
          )}

          {sharedWith.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div className="df-lbl" style={{ marginBottom: 8 }}>Sudah dibagikan ke</div>
              <div className="flist" style={{ marginTop: 0 }}>
                {sharedWith.map(u => (
                  <div key={u} className="fi">
                    <Avatar src={users.find(x => x.username === u)?.avatar} name={u} />
                    <span className="grow">{u}</span>
                    <button className="btn btn-d btn-sm" onClick={() => removeShare(u)} disabled={busy}>Cabut</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
