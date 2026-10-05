import { useState, useEffect } from "react";
import { IDB }    from "../database.js";
import { Crypto } from "../crypto.js";
import { fmtSize, fmtDT, fileTypeLabel, fileExtension } from "../utils.js";
import { EditForm } from "./ArchiveViews.jsx";

export function DetailView({ recId, session, onBack, onDelete, toast, onReload }) {
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

  // Data berkas baru diambil dari server dan didekripsi saat dibuka.
  // Berkas dienkripsi dengan kata kunci pemilik. Penerima yang dibagikan
  // diminta memasukkan kata kunci pemilik bila kata kunci sendiri tidak cocok.
  const decrypt = async (file, idx) => {
    setDecBusy(file.name);
    setDecStage("Mengambil berkas");
    try {
      let encData;
      try { encData = await IDB.fileData(arc.id, idx); }
      catch {
        setDecBusy(null);
        toast("Gagal mengambil berkas dari server.", "err");
        return null;
      }
      setDecStage("Mendekripsi");
      try {
        const plain = await Crypto.decrypt(encData, session.passphrase);
        setDecBusy(null);
        return new Blob([plain], { type: file.type });
      } catch {
        if (!isOwner) {
          const ownerPass = window.prompt(`Masukkan kata kunci milik "${arc.owner}" untuk membuka berkas:`);
          if (!ownerPass) { setDecBusy(null); return null; }
          try {
            const plain = await Crypto.decrypt(encData, ownerPass);
            setDecBusy(null);
            return new Blob([plain], { type: file.type });
          } catch {
            setDecBusy(null);
            toast("Kata kunci salah.", "err");
            return null;
          }
        }
        setDecBusy(null);
        toast("Gagal membuka berkas. Kata kunci tidak cocok.", "err");
        return null;
      }
    } catch {
      setDecBusy(null);
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
        <ShareModal arc={arc} session={session} onClose={() => setShareOpen(false)} toast={toast} onReload={onReload} />
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
    IDB.getAllUsers().then(u => setUsers(u.filter(x => x.username !== session.username)));
  }, [session.username]);

  const handleShare = async () => {
    if (!recipient) { toast("Pilih penerima.", "err"); return; }
    setBusy(true);
    try {
      const newShared = Array.from(new Set([...sharedWith, recipient]));
      await IDB.update(arc.id, { sharedWith: newShared });
      setSharedWith(newShared);
      await IDB.addInbox({
        recipient,
        from:         session.username,
        archiveId:    arc.id,
        archiveNum:   arc.archiveId,
        archiveTitle: arc.title,
        message,
        sentAt:       new Date().toISOString(),
        read:         false,
      });
      await onReload();
      toast("Dibagikan ke " + recipient);
      setRecipient("");
      setMessage("");
    } catch { toast("Gagal membagikan arsip.", "err"); }
    setBusy(false);
  };

  const removeShare = async (u) => {
    const newShared = sharedWith.filter(x => x !== u);
    await IDB.update(arc.id, { sharedWith: newShared });
    setSharedWith(newShared);
    await onReload();
    toast("Akses " + u + " dicabut.");
  };

  return (
    <div className="ov" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-ttl">Bagikan arsip</div>
          <button className="btn btn-g btn-sm" onClick={onClose}>Tutup</button>
        </div>
        <div className="modal-body">
          {users.length === 0 ? (
            <div className="locked">Belum ada pengguna lain di perangkat ini.</div>
          ) : (
            <div className="stack">
              <div className="field">
                <label>Penerima</label>
                <select value={recipient} onChange={e => setRecipient(e.target.value)}>
                  <option value="">Pilih pengguna</option>
                  {users.map(u => (
                    <option key={u.username} value={u.username} disabled={sharedWith.includes(u.username)}>
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
                {busy ? "Membagikan..." : "Bagikan"}
              </button>
            </div>
          )}

          {sharedWith.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div className="df-lbl" style={{ marginBottom: 8 }}>Sudah dibagikan ke</div>
              <div className="flist" style={{ marginTop: 0 }}>
                {sharedWith.map(u => (
                  <div key={u} className="fi">
                    <span className="grow">{u}</span>
                    <button className="btn btn-d btn-sm" onClick={() => removeShare(u)}>Cabut</button>
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