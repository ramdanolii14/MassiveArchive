import { useState } from "react";
import { IDB }   from "../database.js";
import { fmtDT } from "../utils.js";

export function InboxView({ inbox, onReload, toast, onDetail }) {
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
    toast("Pesan dihapus.");
  };

  if (sel) {
    return (
      <div style={{ maxWidth: 680 }}>
        <button className="btn btn-g btn-sm" style={{ marginBottom: 14 }} onClick={() => setSel(null)}>
          Kembali
        </button>
        <div className="panel pad">
          <div className="dt-id">Dari {sel.from}, {fmtDT(sel.sentAt)}</div>
          <div className="dt-title">{sel.archiveTitle}</div>
          <span className="badge">{sel.archiveNum}</span>
          {sel.message && <div className="note" style={{ marginTop: 18 }}>{sel.message}</div>}
          <div className="df-lbl" style={{ margin: "18px 0" }}>
            Untuk membuka berkas, gunakan kata kunci milik {sel.from}.
          </div>
          <div className="row">
            <button className="btn btn-p" onClick={() => { onDetail(sel.archiveId); setSel(null); }}>
              Buka arsip
            </button>
            <button className="btn btn-d" onClick={() => del(sel.id)}>Hapus pesan</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel tbl-wrap">
      {inbox.length === 0 ? (
        <div className="empty"><h3>Kotak masuk kosong</h3></div>
      ) : (
        inbox.map(item => (
          <div key={item.id} className="inbox-item" onClick={() => open(item)}>
            <div className="grow">
              <div className="inbox-from">{item.from}</div>
              <div className="inbox-title">{item.archiveTitle}</div>
              {item.message && <div className="inbox-msg">{item.message}</div>}
            </div>
            {!item.read && <span className="dot" />}
          </div>
        ))
      )}
    </div>
  );
}