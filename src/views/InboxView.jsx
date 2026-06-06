import { useState } from "react";
import { IDB }   from "../database.js";
import { fmtDT } from "../utils.js";

// ════════════════════════════════════════════════════════════════
// INBOX / SHARED WITH ME
// ════════════════════════════════════════════════════════════════

export function InboxView({ session, inbox, onReload, toast, onDetail }) {
  const [sel, setSel] = useState(null);

  const open = async (item) => {
    if (!item.read) {
      await IDB.markRead(item.id);
      await onReload();
    }
    setSel(item);
  };

  const del = async (id) => {
    await IDB.delInbox(id);
    await onReload();
    setSel(null);
    toast("Notifikasi dihapus.");
  };

  if (sel) {
    return (
      <div style={{ maxWidth: "700px" }}>
        <div style={{ marginBottom: "14px" }}>
          <button className="btn btn-g btn-sm" onClick={() => setSel(null)}>← Kembali ke Kotak Masuk</button>
        </div>
        <div className="sec-card">
          <div style={{ padding: "24px 28px" }}>
            <div className="dt-id">Dari: {sel.from}</div>
            <div className="dt-title" style={{ fontSize: "20px", marginBottom: "14px" }}>{sel.archiveTitle}</div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <span className="badge badge-cat">{sel.archiveNum}</span>
              <span style={{ fontFamily: "var(--fm)", fontSize: "11px", color: "var(--ink4)" }}>{fmtDT(sel.sentAt)}</span>
            </div>
            {sel.message && (
              <div style={{
                background: "var(--bg2)", border: "1px solid var(--rule)", padding: "14px",
                fontSize: "14px", color: "var(--ink2)", lineHeight: "1.7", marginBottom: "20px",
              }}>{sel.message}</div>
            )}
            <div style={{
              padding: "10px 14px", background: "var(--blue-bg)", border: "1px solid #90ade0",
              fontFamily: "var(--fm)", fontSize: "11px", color: "var(--blue)", marginBottom: "16px",
            }}>
              Berkas dienkripsi dengan kata kunci milik <strong>{sel.from}</strong>.
              Saat mengunduh, Anda perlu memasukkan kata kunci mereka.
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn-share"
                onClick={() => { onDetail(sel.archiveId); setSel(null); }}>
                Buka Arsip
              </button>
              <button className="btn btn-d btn-sm" onClick={() => del(sel.id)}>Hapus Notifikasi</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Kotak Masuk</div>
          <div className="sec-sub">Arsip yang dibagikan oleh pengguna lain kepada Anda</div>
        </div>
      </div>

      {inbox.length === 0 ? (
        <div className="empty">
          <h3>Kotak masuk kosong</h3>
          <p style={{ marginTop: "6px", fontSize: "13px" }}>
            Belum ada arsip yang dibagikan kepada Anda.
          </p>
        </div>
      ) : (
        <div className="sec-card">
          {inbox.map(item => (
            <div key={item.id} className={`inbox-item${!item.read ? " unread" : ""}`}
              onClick={() => open(item)}>
              <div style={{ flex: 1 }}>
                <div className="inbox-from">{item.from}</div>
                <div className="inbox-title">{item.archiveTitle}</div>
                {item.message && <div className="inbox-msg">{item.message}</div>}
                <div style={{ fontFamily: "var(--fm)", fontSize: "10px", color: "var(--ink4)", marginTop: "5px" }}>
                  {item.archiveNum} — {fmtDT(item.sentAt)}
                </div>
              </div>
              {!item.read && (
                <span className="badge badge-shared" style={{ alignSelf: "center", flexShrink: 0 }}>Baru</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
