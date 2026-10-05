import { useState, useEffect } from "react";
import { IDB }     from "../database.js";
import { fmtSize } from "../utils.js";

export function StorageCapsule() {
  const [s, setS] = useState(null);

  useEffect(() => {
    IDB.storage().then(setS).catch(() => setS(null));
  }, []);

  if (!s) return null;

  const hasDisk = s.total && s.free != null;
  const otherUsed = hasDisk ? Math.max(s.total - s.free - s.used, 0) : 0;
  const pct = (n) => (hasDisk ? (n / s.total) * 100 : 0);
  const dbPct = s.used > 0 ? Math.max(pct(s.used), 0.8) : 0;

  return (
    <div className="panel pad" style={{ marginBottom: 22 }}>
      <div className="cap-top">
        <div className="sec-title">Penyimpanan</div>
        <div className="df-lbl">
          {hasDisk ? `${fmtSize(s.free)} tersedia dari ${fmtSize(s.total)}` : fmtSize(s.used)}
        </div>
      </div>

      {hasDisk && (
        <div className="capsule">
          <div className="cap-db"    style={{ width: `${dbPct}%` }} />
          <div className="cap-other" style={{ width: `${pct(otherUsed)}%` }} />
        </div>
      )}

      <div className="cap-legend">
        <span><i className="db" />Database {fmtSize(s.used)}</span>
        {hasDisk && <span><i className="other" />Lainnya {fmtSize(otherUsed)}</span>}
        {hasDisk && <span><i />Tersedia {fmtSize(s.free)}</span>}
      </div>
    </div>
  );
}