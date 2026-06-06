import { useState, useEffect, useCallback } from "react";

import { CSS }            from "./styles.js";
import { IDB }            from "./database.js";
import { Crypto }         from "./crypto.js";
import { fmtSize, genId } from "./utils.js";
import { WelcomeScreen }  from "./components/WelcomeScreen.jsx";
import { Dashboard, Browse, AddForm } from "./views/ArchiveViews.jsx";
import { DetailView }     from "./views/DetailView.jsx";
import { InboxView }      from "./views/InboxView.jsx";

// ════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════

export default function App() {
  const [session,  setSession]  = useState(null); // { username, passphrase }
  const [view,     setView]     = useState("dashboard");
  const [archives, setArchives] = useState([]);  // full records (own + shared-with-me)
  const [allMeta,  setAllMeta]  = useState([]);  // metadata-only for ALL archives
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [selId,    setSelId]    = useState(null);
  const [toast,    setToast]    = useState(null);
  const [confirm,  setConfirm]  = useState(null);
  const [inbox,    setInbox]    = useState([]);

  // Inject CSS once
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  // Load data whenever session changes
  const load = useCallback(async () => {
    if (!session) return;
    try {
      const accessible = await IDB.byOwner(session.username);
      setArchives(accessible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

      const meta = await IDB.getAllMeta();
      setAllMeta(meta.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

      const msgs = await IDB.getInbox(session.username);
      setInbox(msgs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)));
    } catch { showToast("Gagal memuat data", "err"); }
    finally  { setLoading(false); }
  }, [session]);

  useEffect(() => { if (session) { setLoading(true); load(); } }, [session, load]);

  const showToast  = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };
  const askConfirm = (title, msg, fn) => setConfirm({ title, msg, fn });

  // Search filter applied to the "accessible" list
  const filtered = archives.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [a.title, a.archiveId, a.description, a.category, a.author, a.reference, ...(a.tags || [])]
      .filter(Boolean).some(v => v.toLowerCase().includes(q));
  });

  // Search filter for allMeta (public directory)
  const filteredMeta = allMeta.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [a.title, a.archiveId, a.description, a.category, a.author, ...(a.tags || [])]
      .filter(Boolean).some(v => v.toLowerCase().includes(q));
  });

  const goDetail = (id) => { setSelId(id); setView("detail"); };

  // InboxView passes archiveId (numeric IDB key), not archiveId string
  const goDetailFromInbox = (id) => { setSelId(id); setView("detail"); };

  const handleSave = async (data) => {
    try {
      const cnt = await IDB.count();
      await IDB.add({
        ...data,
        archiveId: genId(cnt),
        owner:     session.username,
        createdAt: new Date().toISOString(),
      });
      await load();
      showToast("Arsip berhasil disimpan.");
      setView("browse");
    } catch { showToast("Gagal menyimpan arsip.", "err"); }
  };

  const handleDelete = (id) => askConfirm(
    "Hapus Arsip",
    "Arsip dan semua berkas terlampir akan dihapus permanen. Lanjutkan?",
    async () => {
      await IDB.del(id);
      await load();
      setConfirm(null);
      showToast("Arsip dihapus.");
      setView("browse");
    }
  );

  const handleLogout = () => {
    setSession(null);
    setArchives([]);
    setAllMeta([]);
    setInbox([]);
    setView("dashboard");
    setLoading(true);
  };

  const unreadCount = inbox.filter(i => !i.read).length;

  if (!session) return <WelcomeScreen onLogin={setSession} />;

  const navs = [
    { id: "dashboard", label: "Dasbor",       ic: "◈" },
    { id: "browse",    label: "Semua Arsip",   ic: "≡" },
    { id: "add",       label: "Arsip Baru",    ic: "+" },
    { id: "inbox",     label: `Berbagi${unreadCount ? ` (${unreadCount})` : ""}`, ic: "✉" },
  ];

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <nav className="sb">
        <div className="sb-head">
          <div className="sb-logo">
            Sistem Arsip
            <small>Digital Archive System</small>
          </div>
          <div className="sb-user">
            <div className="sb-avatar">{session.username[0].toUpperCase()}</div>
            <div className="sb-uname">{session.username}</div>
          </div>
        </div>

        <div className="sb-nav">
          <div className="sb-sec">
            <div className="sb-sec-lbl">Navigasi</div>
            {navs.map(n => (
              <div key={n.id}
                className={`nav-item${view === n.id || (view === "detail" && n.id === "browse") ? " act" : ""}`}
                onClick={() => setView(n.id)}>
                <span className="nav-ic">{n.ic}</span>{n.label}
              </div>
            ))}
          </div>

          <div className="sb-sec">
            <div className="sb-sec-lbl">Info Arsip Saya</div>
            <div className="nav-item" style={{ cursor: "default", fontSize: "12.5px" }}>
              <span className="nav-ic">#</span>
              {archives.filter(a => a.owner === session.username).length} Arsip
            </div>
            <div className="nav-item" style={{ cursor: "default", fontSize: "12.5px" }}>
              <span className="nav-ic">∑</span>
              {fmtSize(
                archives
                  .filter(a => a.owner === session.username)
                  .reduce((s, a) => (a.files || []).reduce((ss, f) => ss + f.size, s), 0)
              )}
            </div>
          </div>

          <div className="sb-sec">
            <div className="sb-sec-lbl">Sistem</div>
            <div className="nav-item" style={{ cursor: "default", fontSize: "12.5px" }}>
              <span className="nav-ic">#</span>
              {allMeta.length} Total Arsip
            </div>
            <div className="nav-item" style={{ cursor: "default", fontSize: "12.5px" }}>
              <span className="nav-ic">∑</span>
              {fmtSize(allMeta.reduce((s, a) => s + a.totalSize, 0))}
            </div>
          </div>
        </div>

        <div className="sb-foot">
          Tersimpan lokal — Terenkripsi AES-256<br />
          <span
            style={{ color: "rgba(255,255,255,.4)", cursor: "pointer", textDecoration: "underline" }}
            onClick={handleLogout}>Keluar dari akun</span>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            {view === "dashboard" && "Dasbor"}
            {view === "browse"    && "Semua Arsip"}
            {view === "add"       && "Tambah Arsip Baru"}
            {view === "detail"    && "Detail Arsip"}
            {view === "inbox"     && "Berbagi & Kiriman"}
          </div>
          {(view === "browse" || view === "dashboard") && (
            <div className="searchbar">
              <span style={{ fontFamily: "var(--fm)", fontSize: "11px", color: "var(--ink4)" }}>CARI</span>
              <input
                placeholder="Judul, ID, tag, kategori..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
          {view !== "add" && (
            <button className="btn btn-p btn-sm" onClick={() => setView("add")}>+ Arsip Baru</button>
          )}
        </header>

        <div className="page">
          {loading ? (
            <div className="loading">Memuat data arsip...</div>
          ) : view === "dashboard" ? (
            <Dashboard
              archives={archives}
              allMeta={allMeta}
              session={session}
              onGo={setView}
              onDetail={goDetail}
            />
          ) : view === "browse" ? (
            <Browse
              archives={filtered}
              allMeta={filteredMeta}
              session={session}
              onDetail={goDetail}
            />
          ) : view === "add" ? (
            <AddForm
              session={session}
              onSave={handleSave}
              onCancel={() => setView("browse")}
            />
          ) : view === "detail" && selId ? (
            <DetailView
              key={selId}
              recId={selId}
              session={session}
              onBack={() => setView("browse")}
              onDelete={handleDelete}
              toast={showToast}
              onReload={load}
            />
          ) : view === "inbox" ? (
            <InboxView
              session={session}
              inbox={inbox}
              onReload={load}
              toast={showToast}
              onDetail={goDetailFromInbox}
            />
          ) : null}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {/* ── Confirm dialog ── */}
      {confirm && (
        <div className="cfm-ov">
          <div className="cfm-box">
            <h3>{confirm.title}</h3>
            <p>{confirm.msg}</p>
            <div className="cfm-acts">
              <button className="btn btn-s" onClick={() => setConfirm(null)}>Batal</button>
              <button className="btn btn-d" onClick={confirm.fn}>Hapus Sekarang</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
