import { useEffect, useState } from "react";
import { IDB } from "../database.js";
import { fmtDT } from "../utils.js";

const labels = {
  create: "Membuat arsip",
  view: "Membuka arsip",
  preview: "Melihat berkas",
  download: "Mengunduh berkas",
  share: "Membagikan arsip",
  revoke: "Mencabut akses",
  edit: "Mengedit arsip",
  trash: "Memindahkan ke Tempat Sampah",
  restore: "Memulihkan arsip",
  purge: "Menghapus permanen",
};

export function AuditView({ session, toast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    IDB.getAudit(session.username)
      .then(setItems)
      .catch(() => toast("Gagal memuat aktivitas.", "err"))
      .finally(() => setLoading(false));
  }, [session.username]);

  if (loading) return <div className="loading">Memuat...</div>;

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="panel tbl-wrap">
        {items.length === 0 ? (
          <div className="empty">
            <h3>Belum ada aktivitas</h3>
            <p>Aktivitas penggunaan arsip akan tercatat di sini.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Waktu</th><th>Aktivitas</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {items.map(item => {
                const d = item.details || {};
                const detail = [d.title, d.fileName, d.recipient, d.username]
                  .filter(Boolean).join(" • ");
                return (
                  <tr key={item.id} style={{ cursor: "default" }}>
                    <td className="mono">{fmtDT(item.at)}</td>
                    <td className="td-title">{labels[item.action] || item.action}</td>
                    <td className="td-sub">{detail || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
