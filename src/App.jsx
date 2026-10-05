import { useState, useEffect, useCallback } from "react";

import { CSS }            from "./styles.js";
import { IDB }            from "./database.js";
import { genId }          from "./utils.js";
import { WelcomeScreen }  from "./components/WelcomeScreen.jsx";
import { Dashboard, Browse, AddForm } from "./views/ArchiveViews.jsx";
import { DetailView }     from "./views/DetailView.jsx";
import { InboxView }      from "./views/InboxView.jsx";
import { ProfileView }    from "./views/ProfileView.jsx";
import { TrashView }      from "./views/TrashView.jsx";
import { AuditView }      from "./views/AuditView.jsx";
import { logAudit }       from "./audit.js";

// ROOT APP

export default function App() {
  const [session,  setSession]  = useState(null); // { username, passphrase }
  const [view,     setView]     = useState("dashboard");
  const [archives, setArchives] = useState([]);  // full records (own + shared-with-me)
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [selId,    setSelId]    = useState(null);
  const [toast,    setToast]    = useState(null);
  const [confirm,  setConfirm]  = useState(null);
  const [inbox,    setInbox]    = useState([]);
  const [avatar,   setAvatar]   = useState(null);
  const [userAvatars, setUserAvatars] = useState({});
  const [trashCount, setTrashCount] = useState(0);

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
      const [list, msgs, me, users, trash] = await Promise.all([
        IDB.listMeta(),
        IDB.getInbox(session.username),
        IDB.getUser(session.username),
        IDB.getAllUsers().catch(() => []),
        IDB.trashMeta(session.username).catch(() => []),
      ]);
      const avatarMap = Object.fromEntries(users.map(u => [u.username, u.avatar || null]));
      const newest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

      setArchives(
        list
          .filter(a => a.owner === session.username || (a.sharedWith || []).includes(session.username))
          .sort(newest)
      );
      setInbox(msgs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)));
      setAvatar(me?.avatar || null);
      setUserAvatars(avatarMap);
      setTrashCount(trash.length);
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

  const goDetail = (id) => { setSelId(id); setView("detail"); };

  // InboxView passes archiveId (numeric IDB key), not archiveId string
  const goDetailFromInbox = (id) => { setSelId(id); setView("detail"); };

  const handleSave = async (data) => {
    try {
      const cnt = await IDB.count();
      const created = await IDB.add({
        ...data,
        archiveId: genId(cnt),
        owner:     session.username,
        actor:     session.username,
        createdAt: new Date().toISOString(),
      });
      await logAudit(session, "create", { archiveId: created.archiveId, title: created.title });
      await load();
      showToast("Arsip disimpan.");
      setView("browse");
    } catch { showToast("Gagal menyimpan arsip.", "err"); }
  };

  const handleDelete = (id) => askConfirm(
    "Pindahkan ke Tempat Sampah?",
    "Arsip dipindahkan ke Tempat Sampah dan masih dapat dipulihkan.",
    async () => {
      try {
        const meta = await IDB.getMeta(id);
        await IDB.del(id, session.username);
        await logAudit(session, "trash", { archiveId: id, title: meta?.title });
        await load();
        setConfirm(null);
        showToast("Arsip dipindahkan ke Tempat Sampah.");
        setView("browse");
      } catch (e) {
        setConfirm(null);
        showToast(e.message || "Gagal memindahkan arsip.", "err");
      }
    }
  );

  const handleLogout = async () => {
    await IDB.logout().catch(() => {});
    setSession(null);
    setArchives([]);
    setInbox([]);
    setAvatar(null);
    setUserAvatars({});
    setTrashCount(0);
    setView("dashboard");
    setLoading(true);
  };

  const unreadCount = inbox.filter(i => !i.read).length;

  if (!session) return <WelcomeScreen onLogin={setSession} />;

  const navs = [
    { id: "dashboard", label: "Dasbor" },
    { id: "browse",    label: "Arsip" },
    { id: "add",       label: "Arsip Baru" },
    { id: "inbox",     label: "Kotak Masuk", count: unreadCount },
    { id: "trash",     label: "Tempat Sampah", count: trashCount },
    { id: "audit",     label: "Aktivitas" },
    { id: "profile",   label: "Profil" },
  ];

  const titles = {
    dashboard: "Dasbor",
    browse:    "Arsip",
    add:       "Arsip Baru",
    detail:    "Detail Arsip",
    inbox:     "Kotak Masuk",
    trash:     "Tempat Sampah",
    audit:     "Aktivitas",
    profile:   "Profil",
  };

  return (
    <div className="app">
      <nav className="sb">
        <div className="sb-brand">MassiveArchive</div>
        <div className="sb-nav">
          {navs.map(n => (
            <button key={n.id}
              className={`nav-item${view === n.id || (view === "detail" && n.id === "browse") ? " act" : ""}`}
              onClick={() => setView(n.id)}>
              <span>{n.label}</span>
              {n.count > 0 && <span className="nav-count">{n.count}</span>}
            </button>
          ))}
        </div>
        <div className="sb-user">
          <div className="sb-uname">{session.username}</div>
          <button className="btn btn-g btn-sm" onClick={handleLogout}>Keluar</button>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{titles[view]}</div>
          {(view === "browse" || view === "dashboard") && (
            <input className="search" placeholder="Cari arsip"
              value={search} onChange={e => setSearch(e.target.value)} />
          )}
          {view !== "add" && (
            <button className="btn btn-p btn-sm" onClick={() => setView("add")}>Arsip Baru</button>
          )}
        </header>

        <div className="page">
          {loading ? (
            <div className="loading">Memuat...</div>
          ) : view === "dashboard" ? (
            <Dashboard
              archives={filtered}
              session={session}
              avatar={avatar}
              onGo={setView}
              onDetail={goDetail}
            />
          ) : view === "browse" ? (
            <Browse
              archives={filtered}
              session={session}
              userAvatars={userAvatars}
              search={search}
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
              userAvatars={userAvatars}
              onBack={() => setView("browse")}
              onDelete={handleDelete}
              toast={showToast}
              onReload={load}
            />
          ) : view === "trash" ? (
            <TrashView
              session={session}
              userAvatars={userAvatars}
              toast={showToast}
              onReload={load}
            />
          ) : view === "audit" ? (
            <AuditView
              session={session}
              toast={showToast}
            />
          ) : view === "inbox" ? (
            <InboxView
              session={session}
              inbox={inbox}
              onReload={load}
              toast={showToast}
              onDetail={goDetailFromInbox}
            />
          ) : view === "profile" ? (
            <ProfileView
              session={session}
              avatar={avatar}
              onAvatar={(value) => {
                setAvatar(value);
                setUserAvatars(prev => ({ ...prev, [session.username]: value }));
              }}
              onSession={setSession}
              toast={showToast}
            />
          ) : null}
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {confirm && (
        <div className="ov" style={{ zIndex: 2000 }}>
          <div className="cfm-box">
            <h3>{confirm.title}</h3>
            <p>{confirm.msg}</p>
            <div className="cfm-acts">
              <button className="btn btn-s" onClick={() => setConfirm(null)}>Batal</button>
              <button className="btn btn-d" onClick={confirm.fn}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}