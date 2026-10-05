import { useEffect, useState } from "react";
import { IDB } from "../database.js";
import { Avatar } from "../components/Avatar.jsx";
import { fmtDT, fmtSize } from "../utils.js";
import { logAudit } from "../audit.js";

export function TrashView({ session, userAvatars, toast, onReload }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setItems(await IDB.trashMeta(session.username));
    } catch {
      toast("Gagal memuat Tempat Sampah.", "err");
    }
  };

  useEffect(() => { load(); }, [session.username]);

  const restore = async (item) => {
    if (!window.confirm(`Pulihkan arsip "${item.title}"?`)) return;
    setBusy(true);
    try {
      await IDB.restore(item.id, session.username);
      await logAudit(session, "restore", { archiveId: item.id, title: item.title });
      await load();
      await onReload();
      toast("Arsip dipulihkan.");
    } catch (e) {
      toast(e.message || "Gagal memulihkan arsip.", "err");
    }
    setBusy(false);
  };

  const purge = async (item) => {
    if (!window.confirm(`Hapus permanen "${item.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setBusy(true);
    try {
      await IDB.purge(item.id, session.username);
      await logAudit(session, "purge", { archiveId: item.id, title: item.title });
      await load();
      await onReload();
      toast("Arsip dihapus permanen.");
    } catch (e) {
      toast(e.message || "Gagal menghapus arsip.", "err");
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 980 }} className="stack">
      <div className="note">Arsip yang dihapus dipindahkan ke Tempat Sampah. Pulihkan atau hapus permanen dari sini.</div>
      <div className="panel tbl-wrap">
        {items.length === 0 ? (
          <div className="empty">
            <h3>Tempat Sampah kosong</h3>
            <p>Belum ada arsip yang dihapus.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Judul</th><th>Tanggal dihapus</th><th>Pemilik</th><th>Berkas</th><th></th></tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ cursor: "default" }}>
                  <td>
                    <div className="td-title">{item.title}</div>
                    <div className="td-sub">{item.archiveId}</div>
                  </td>
                  <td className="mono">{fmtDT(item.deletedAt)}</td>
                  <td>
                    <div className="owner-cell">
                      <Avatar src={userAvatars?.[item.owner]} name={item.owner} />
                      <span>{item.owner}</span>
                    </div>
                  </td>
                  <td>
                    <div>{item.fileCount || 0} berkas</div>
                    <div className="td-sub">{fmtSize(item.totalSize || 0)}</div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn-s btn-sm" disabled={busy} onClick={() => restore(item)}>Pulihkan</button>
                      <button className="btn btn-d btn-sm" disabled={busy} onClick={() => purge(item)}>Hapus permanen</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
