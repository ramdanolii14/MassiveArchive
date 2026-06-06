import { useState, useEffect } from "react";
import { IDB }    from "../database.js";
import { Crypto } from "../crypto.js";
import { fmtSize, fmtDT, STATUSES, fileTypeLabel } from "../utils.js";
import { EditForm } from "./ArchiveViews.jsx";

// ════════════════════════════════════════════════════════════════
// DETAIL VIEW
// ════════════════════════════════════════════════════════════════

export function DetailView({ recId, session, onBack, onDelete, toast, onReload }) {
  const [arc,       setArc]       = useState(null);
  const [prev,      setPrev]      = useState(null);
  const [decBusy,   setDecBusy]   = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);

  const reload = () => IDB.get(recId).then(setArc);
  useEffect(() => { reload(); }, [recId]);

  const isOwner   = arc?.owner === session.username;
  const canAccess = isOwner || (arc?.sharedWith || []).includes(session.username);

  // ── Decrypt a file using the current session passphrase.
  // For shared files the owner encrypted with THEIR passphrase, so we need
  // to re-encrypt with the owner's key on share — but since we are local-only,
  // shared archives store the blobs encrypted with the OWNER's passphrase.
  // The owner must provide their passphrase to decrypt; we prompt if needed.
  const decrypt = async (file) => {
    setDecBusy(file.name);
    try {
      // Try with the current user's passphrase first (works for owners)
      const plain = await Crypto.decrypt(file.encData, session.passphrase);
      setDecBusy(null);
      return new Blob([plain], { type: file.type });
    } catch {
      // If that fails and this is a shared archive, ask for the owner's passphrase
      if (!isOwner) {
        const ownerPass = window.prompt(
          `Berkas ini dienkripsi dengan kata kunci milik "${arc.owner}".\n` +
          `Masukkan kata kunci milik "${arc.owner}" untuk mendekripsi:`
        );
        if (!ownerPass) { setDecBusy(null); return null; }
        try {
          const plain = await Crypto.decrypt(file.encData, ownerPass);
          setDecBusy(null);
          return new Blob([plain], { type: file.type });
        } catch {
          setDecBusy(null);
          toast("Kata kunci salah. Berkas tidak dapat didekripsi.", "err");
          return null;
        }
      }
      setDecBusy(null);
      toast("Gagal mendekripsi berkas. Kata kunci tidak cocok.", "err");
      return null;
    }
  };

  const download = async (file) => {
    const blob = await decrypt(file);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
    toast("Mengunduh " + file.name);
  };

  const preview = async (file) => {
    const blob = await decrypt(file);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPrev({ file, url });
  };

  const closePreview = () => {
    if (prev?.url) URL.revokeObjectURL(prev.url);
    setPrev(null);
  };

  const canPreview = (type = "") =>
    type.startsWith("image/") || type.startsWith("video/") || type === "application/pdf";

  if (!arc) return <div className="loading">Memuat detail arsip...</div>;

  // ── Mode edit — hanya owner ──
  if (editOpen && isOwner) {
    return (
      <EditForm
        session={session}
        arcId={recId}
        onSave={async () => {
          await reload();
          await onReload();
          setEditOpen(false);
          toast("Arsip berhasil diperbarui.");
        }}
        onCancel={() => setEditOpen(false)}
      />
    );
  }

  return (
    <div style={{ maxWidth: "920px" }}>
      <div style={{ marginBottom: "16px" }}>
        <button className="btn btn-g btn-sm" onClick={onBack}>← Kembali ke Daftar</button>
      </div>

      <div className="sec-card">
        <div style={{ padding: "28px 30px" }}>
          <div className="dt-hdr">
            <div style={{ flex: 1 }}>
              <div className="dt-id">{arc.archiveId}</div>
              <div className="dt-title">{arc.title}</div>
              <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
                {arc.category && <span className="badge badge-cat">{arc.category}</span>}
                {arc.status   && <span className={`badge ${STATUSES[arc.status] || "badge-exp"}`}>{arc.status}</span>}
                {!isOwner     && <span className="badge badge-shared">dibagikan oleh {arc.owner}</span>}
                {!canAccess   && <span className="badge badge-locked">🔒 Berkas Terkunci</span>}
                {(arc.tags || []).map(t => (
                  <span key={t} style={{ fontFamily: "var(--fm)", fontSize: "10px", color: "var(--ink4)" }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginLeft: "16px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {isOwner && (
                <button className="btn btn-s btn-sm" onClick={() => setEditOpen(true)}>✏ Edit</button>
              )}
              {isOwner && (
                <button className="btn btn-share btn-sm" onClick={() => setShareOpen(true)}>Bagikan</button>
              )}
              {isOwner && (
                <button className="btn btn-d btn-sm" onClick={() => onDelete(arc.id)}>Hapus</button>
              )}
            </div>
          </div>

          {/* Metadata — always visible */}
          <div className="dt-grid">
            <div className="df">
              <div className="df-lbl">Tanggal Dokumen</div>
              <div className="df-val">{arc.date}</div>
            </div>
            <div className="df">
              <div className="df-lbl">Ditambahkan</div>
              <div className="df-val" style={{ fontSize: "13.5px" }}>{fmtDT(arc.createdAt)}</div>
            </div>
            {arc.author    && <div className="df"><div className="df-lbl">Penyusun</div><div className="df-val">{arc.author}</div></div>}
            {arc.reference && <div className="df"><div className="df-lbl">No. Referensi</div><div className="df-val" style={{ fontFamily: "var(--fm)", fontSize: "13px" }}>{arc.reference}</div></div>}
            {arc.location  && <div className="df"><div className="df-lbl">Lokasi / Asal</div><div className="df-val">{arc.location}</div></div>}
            {arc.updatedAt && (
              <div className="df">
                <div className="df-lbl">Terakhir Diubah</div>
                <div className="df-val" style={{ fontSize: "13px", color: "var(--ink3)" }}>{fmtDT(arc.updatedAt)}</div>
              </div>
            )}
          </div>

          {arc.description && (
            <div style={{ marginBottom: "16px" }}>
              <div className="df-lbl" style={{ marginBottom: "6px" }}>Deskripsi</div>
              <div style={{
                background: "var(--bg2)", border: "1px solid var(--rule)", padding: "14px",
                color: "var(--ink2)", lineHeight: "1.7", fontSize: "14.5px",
              }}>{arc.description}</div>
            </div>
          )}

          {arc.notes && isOwner && (
            <div style={{ marginBottom: "16px" }}>
              <div className="df-lbl" style={{ marginBottom: "6px" }}>Catatan Internal</div>
              <div style={{
                background: "var(--gold-bg)", border: "1px solid var(--gold3)", padding: "12px",
                color: "var(--ink2)", lineHeight: "1.7", fontSize: "13.5px", fontStyle: "italic",
              }}>{arc.notes}</div>
            </div>
          )}

          {/* Files section */}
          <div className="files-sec" style={{ marginTop: "24px" }}>
            <h3>Lampiran Berkas ({arc.files?.length || 0}) — Terenkripsi</h3>

            {!canAccess ? (
              // Public view — only show count and sizes, no download
              <div className="locked-notice">
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔒</div>
                <p>
                  Berkas arsip ini hanya dapat diakses oleh pemilik atau pengguna yang diberi izin.<br/>
                  Hubungi <strong>{arc.owner}</strong> untuk meminta akses berbagi.
                </p>
                {arc.files?.length > 0 && (
                  <p style={{ marginTop: "10px" }}>
                    {arc.files.length} berkas terlampir —{" "}
                    Total: {fmtSize(arc.files.reduce((s, f) => s + f.size, 0))}
                  </p>
                )}
              </div>
            ) : !arc.files?.length ? (
              <div style={{
                color: "var(--ink4)", fontSize: "13px", textAlign: "center", padding: "20px",
                background: "var(--bg2)", border: "1px solid var(--rule)",
              }}>Tidak ada berkas terlampir</div>
            ) : (
              <>
                {!isOwner && (
                  <div style={{
                    padding: "9px 14px", background: "var(--blue-bg)", border: "1px solid #90ade0",
                    fontFamily: "var(--fm)", fontSize: "11px", color: "var(--blue)", marginBottom: "12px",
                  }}>
                    Berkas dienkripsi dengan kata kunci milik <strong>{arc.owner}</strong>.
                    Anda perlu memasukkan kata kunci mereka saat mengunduh.
                  </div>
                )}
                <div className="fgrid2">
                  {arc.files.map((file, i) => (
                    <div key={i} className="fcard">
                      <div className="fcard-ico">{fileTypeLabel(file.type)}</div>
                      <div className="fcard-name">{file.name}</div>
                      <div className="fcard-sz">{fmtSize(file.size)}</div>
                      <div className="fcard-lock">AES-256-GCM</div>
                      <div style={{ marginTop: "10px", display: "flex", gap: "5px", justifyContent: "center", flexWrap: "wrap" }}>
                        {canPreview(file.type) && (
                          <button className="btn btn-s btn-sm" style={{ fontSize: "11px", padding: "4px 9px" }}
                            onClick={() => preview(file)} disabled={decBusy === file.name}>
                            {decBusy === file.name ? "..." : "Lihat"}
                          </button>
                        )}
                        <button className="btn btn-s btn-sm" style={{ fontSize: "11px", padding: "4px 9px" }}
                          onClick={() => download(file)} disabled={decBusy === file.name}>
                          {decBusy === file.name ? "Dekripsi..." : "Unduh"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "10px", fontFamily: "var(--fm)", fontSize: "11px", color: "var(--ink4)" }}>
                  Total ukuran: {fmtSize(arc.files.reduce((s, f) => s + f.size, 0))} (terenkripsi)
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {prev && (
        <div className="ov" onClick={closePreview}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-ttl">
                {prev.file.name}
                <span style={{ fontFamily: "var(--fm)", fontSize: "10px", color: "var(--ink4)", marginLeft: "10px" }}>
                  {fmtSize(prev.file.size)}
                </span>
              </div>
              <div style={{ display: "flex", gap: "7px" }}>
                <button className="btn btn-s btn-sm" onClick={() => download(prev.file)}>Unduh</button>
                <button className="btn btn-g btn-sm" onClick={closePreview}>Tutup</button>
              </div>
            </div>
            <div className="modal-body">
              {prev.file.type?.startsWith("image/") && <img src={prev.url} alt={prev.file.name} className="img-thumb" />}
              {prev.file.type?.startsWith("video/") && <video src={prev.url} controls />}
              {prev.file.type === "application/pdf"  && <iframe src={prev.url} className="pdf-frame" title={prev.file.name} />}
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <ShareModal arc={arc} session={session} onClose={() => setShareOpen(false)} toast={toast} onReload={onReload} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SHARE MODAL
// ════════════════════════════════════════════════════════════════

export function ShareModal({ arc, session, onClose, toast, onReload }) {
  const [recipient,  setRecipient]  = useState("");
  const [message,    setMessage]    = useState("");
  const [busy,       setBusy]       = useState(false);
  const [users,      setUsers]      = useState([]);
  const [sharedWith, setSharedWith] = useState(arc.sharedWith || []);

  useEffect(() => {
    IDB.getAllUsers().then(u => setUsers(u.filter(u => u.username !== session.username)));
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
      toast("Arsip berhasil dibagikan ke " + recipient);
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
          <div className="modal-ttl">Bagikan Arsip</div>
          <button className="btn btn-g btn-sm" onClick={onClose}>Tutup</button>
        </div>
        <div className="modal-body">
          <div style={{ fontFamily: "var(--fm)", fontSize: "11px", color: "var(--ink4)", marginBottom: "16px", lineHeight: "1.7" }}>
            Arsip: <strong style={{ color: "var(--ink)" }}>{arc.archiveId}</strong> — {arc.title}<br />
            Penerima dapat mengunduh berkas, tetapi perlu memasukkan <strong>kata kunci Anda</strong> untuk mendekripsi.
          </div>

          {users.length === 0 ? (
            <div style={{
              padding: "16px", background: "var(--bg2)", border: "1px solid var(--rule)",
              fontFamily: "var(--fm)", fontSize: "11.5px", color: "var(--ink4)",
            }}>
              Belum ada pengguna lain terdaftar di perangkat ini.
            </div>
          ) : (
            <>
              <div className="fg" style={{ marginBottom: "12px" }}>
                <label>Bagikan ke Pengguna</label>
                <select value={recipient} onChange={e => setRecipient(e.target.value)}>
                  <option value="">— Pilih pengguna —</option>
                  {users.map(u => (
                    <option key={u.username} value={u.username}
                      disabled={sharedWith.includes(u.username)}>
                      {u.username}{sharedWith.includes(u.username) ? " (sudah dibagikan)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg" style={{ marginBottom: "16px" }}>
                <label>Pesan (opsional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Pesan untuk penerima..." rows={2} />
              </div>
              <button className="btn btn-share" onClick={handleShare} disabled={busy || !recipient}>
                {busy ? "Membagikan..." : "Bagikan Arsip"}
              </button>
            </>
          )}

          {sharedWith.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <div style={{ height: "1px", background: "var(--rule)", margin: "20px 0" }} />
              <div style={{
                fontFamily: "var(--fm)", fontSize: "10px", textTransform: "uppercase",
                letterSpacing: ".09em", color: "var(--ink4)", marginBottom: "10px",
              }}>Dibagikan ke</div>
              {sharedWith.map(u => (
                <div key={u} style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px",
                  background: "#fff", border: "1px solid var(--rule)", marginBottom: "6px",
                }}>
                  <span style={{ fontFamily: "var(--fm)", fontSize: "12.5px", color: "var(--blue)", flex: 1 }}>{u}</span>
                  <button className="btn btn-d btn-sm" onClick={() => removeShare(u)}>Cabut Akses</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
