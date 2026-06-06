import { useState, useRef, useEffect } from "react";
import { Crypto }    from "../crypto.js";
import { IDB }       from "../database.js";
import { fmtSize, fmtDT, CATS, STATUSES, fileTypeLabel } from "../utils.js";

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════

export function Dashboard({ archives, allMeta, session, onGo, onDetail }) {
  const mine    = archives.filter(a => a.owner === session.username);
  const shared  = archives.filter(a => a.owner !== session.username);
  const totalSz = mine.reduce((s, a) => (a.files || []).reduce((ss, f) => ss + f.size, s), 0);
  const catMap  = {};
  mine.forEach(a => { if (a.category) catMap[a.category] = (catMap[a.category] || 0) + 1; });
  const recent  = mine.slice(0, 5);

  // System-wide totals from allMeta (metadata only, no blobs)
  const sysTotal    = allMeta.length;
  const sysFiles    = allMeta.reduce((s, a) => s + a.fileCount, 0);
  const sysCapacity = allMeta.reduce((s, a) => s + a.totalSize, 0);

  return (
    <div>
      {/* ── Global system stats ── */}
      <div style={{ marginBottom: "6px" }}>
        <div style={{ fontFamily: "var(--fm)", fontSize: "9px", textTransform: "uppercase",
          letterSpacing: ".1em", color: "var(--ink4)", marginBottom: "6px" }}>
          Statistik Sistem — Semua Pengguna
        </div>
      </div>
      <div className="global-stats">
        {[
          { lbl: "Total Arsip Sistem", val: sysTotal,          sub: "Seluruh pengguna" },
          { lbl: "Total Berkas",        val: sysFiles,          sub: "Semua jenis berkas" },
          { lbl: "Kapasitas Sistem",    val: fmtSize(sysCapacity), sub: "Terenkripsi di server" },
        ].map(s => (
          <div key={s.lbl} className="global-stat">
            <div className="global-stat-lbl">{s.lbl}</div>
            <div className="global-stat-val">{s.val}</div>
            <div className="global-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── My stats ── */}
      <div className="stats">
        {[
          { lbl: "Arsip Saya",       val: mine.length,  sub: "Milik saya" },
          { lbl: "Berkas Saya",      val: mine.reduce((s, a) => s + (a.files?.length || 0), 0), sub: "Semua jenis" },
          { lbl: "Kapasitas Saya",   val: fmtSize(totalSz), sub: "Terenkripsi" },
          { lbl: "Dibagikan ke Saya", val: shared.length, sub: "Dari pengguna lain" },
        ].map(s => (
          <div key={s.lbl} className="stat">
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-val" style={{ fontSize: typeof s.val === "string" ? "22px" : "28px" }}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        <div>
          <div className="sec-hdr">
            <div>
              <div className="sec-title">Arsip Terbaru</div>
              <div className="sec-sub">5 entri terakhir milik Anda</div>
            </div>
            <button className="btn btn-g btn-sm" onClick={() => onGo("browse")}>Lihat Semua</button>
          </div>

          {recent.length === 0 ? (
            <div className="empty">
              <h3>Belum ada arsip</h3>
              <p style={{ marginTop: "6px", fontSize: "13px" }}>Mulai dengan menambahkan arsip pertama Anda.</p>
              <button className="btn btn-p btn-sm" style={{ marginTop: "14px" }} onClick={() => onGo("add")}>
                Tambah Arsip
              </button>
            </div>
          ) : (
            <table className="arc-table">
              <thead>
                <tr>
                  <th>No. Arsip</th><th>Judul</th><th>Tanggal</th><th>Berkas</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(a => (
                  <tr key={a.id} onClick={() => onDetail(a.id)}>
                    <td className="td-id">{a.archiveId}</td>
                    <td>
                      <div className="td-title">{a.title}</div>
                      {a.category && <div className="td-meta"><span className="badge badge-cat">{a.category}</span></div>}
                    </td>
                    <td style={{ fontFamily: "var(--fm)", fontSize: "12px", color: "var(--ink3)", whiteSpace: "nowrap" }}>{a.date}</td>
                    <td style={{ fontFamily: "var(--fm)", fontSize: "12px", color: "var(--ink4)" }}>{a.files?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="sec-hdr">
            <div>
              <div className="sec-title">Kategori</div>
              <div className="sec-sub">Distribusi arsip saya</div>
            </div>
          </div>
          <div className="sec-card">
            {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
              <div key={cat} className="cat-bar">
                <span style={{ fontSize: "13px", color: "var(--ink2)" }}>{cat}</span>
                <span className="cat-cnt">{cnt}</span>
              </div>
            ))}
            {!Object.keys(catMap).length && (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--ink4)", fontSize: "13px" }}>
                Belum ada kategori
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// BROWSE — shows own + shared archives; can also see public metadata
// ════════════════════════════════════════════════════════════════

export function Browse({ archives, allMeta, session, onDetail }) {
  const [cat,   setCat]   = useState("");
  const [from,  setFrom]  = useState("");
  const [to,    setTo]    = useState("");
  const [sort,  setSort]  = useState("newest");
  const [scope, setScope] = useState("accessible"); // accessible | all

  // "accessible" = own + shared-with-me; "all" = every archive (metadata only for others)
  const baseList = scope === "all" ? allMeta : archives;

  let list = [...baseList];
  if (cat)  list = list.filter(a => a.category === cat);
  if (from) list = list.filter(a => a.date >= from);
  if (to)   list = list.filter(a => a.date <= to);
  list.sort((a, b) => {
    if (sort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sort === "title")  return a.title.localeCompare(b.title);
    if (sort === "date")   return b.date.localeCompare(a.date);
    return 0;
  });

  const canAccess = (a) =>
    a.owner === session.username || (a.sharedWith || []).includes(session.username);

  return (
    <div>
      <div className="filters">
        <select className="filter-s" value={scope} onChange={e => setScope(e.target.value)}>
          <option value="accessible">Arsip Saya & Dibagikan</option>
          <option value="all">Direktori Publik (semua arsip)</option>
        </select>
        <select className="filter-s" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Semua Kategori</option>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <input type="date" className="filter-s" value={from} onChange={e => setFrom(e.target.value)} />
        <span style={{ color: "var(--ink4)", fontSize: "12px", fontFamily: "var(--fm)" }}>s/d</span>
        <input type="date" className="filter-s" value={to} onChange={e => setTo(e.target.value)} />
        <select className="filter-s" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
          <option value="title">Judul A-Z</option>
          <option value="date">Tanggal Dokumen</option>
        </select>
        <span style={{ color: "var(--ink4)", fontSize: "12px", fontFamily: "var(--fm)", marginLeft: "auto" }}>
          {list.length} arsip
        </span>
      </div>

      {scope === "all" && (
        <div style={{ padding: "9px 14px", background: "var(--gold-bg)", border: "1px solid var(--gold3)",
          fontFamily: "var(--fm)", fontSize: "11px", color: "var(--gold)", marginBottom: "14px" }}>
          Mode direktori publik — metadata semua arsip terlihat. Berkas hanya dapat diakses jika pemilik memberi izin.
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <h3>Tidak ada hasil</h3>
          <p style={{ marginTop: "6px", fontSize: "13px" }}>Coba ubah filter atau kata kunci pencarian.</p>
        </div>
      ) : (
        <table className="arc-table">
          <thead>
            <tr>
              <th style={{ width: "130px" }}>No. Arsip</th>
              <th>Judul / Keterangan</th>
              <th style={{ width: "110px" }}>Tanggal</th>
              <th style={{ width: "80px" }}>Status</th>
              <th style={{ width: "70px" }}>Berkas</th>
              <th style={{ width: "90px" }}>Pemilik</th>
              <th style={{ width: "80px" }}>Akses</th>
            </tr>
          </thead>
          <tbody>
            {list.map(a => {
              const accessible = canAccess(a);
              return (
                <tr key={a.id} onClick={() => onDetail(a.id)}
                  style={{ opacity: accessible ? 1 : 0.8 }}>
                  <td className="td-id">{a.archiveId}</td>
                  <td>
                    <div className="td-title">{a.title}</div>
                    <div className="td-meta">
                      {a.category && <span className="badge badge-cat">{a.category}</span>}
                      {(a.tags || []).map(t => (
                        <span key={t} style={{ fontFamily: "var(--fm)", fontSize: "10px", color: "var(--ink4)" }}>{t}</span>
                      ))}
                    </div>
                    {!accessible && (
                      <div className="td-locked">🔒 Berkas terkunci — minta akses ke pemilik</div>
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--fm)", fontSize: "12px", color: "var(--ink3)", whiteSpace: "nowrap" }}>{a.date}</td>
                  <td>
                    {a.status && <span className={`badge ${STATUSES[a.status] || "badge-exp"}`}>{a.status}</span>}
                  </td>
                  <td style={{ fontFamily: "var(--fm)", fontSize: "12px", color: "var(--ink4)", textAlign: "center" }}>
                    {a.fileCount ?? a.files?.length ?? 0}
                  </td>
                  <td style={{ fontFamily: "var(--fm)", fontSize: "11px",
                    color: a.owner === session.username ? "var(--ink4)" : "var(--blue)" }}>
                    {a.owner === session.username ? "saya" : a.owner}
                  </td>
                  <td>
                    {accessible
                      ? <span className="badge badge-aktif">Terbuka</span>
                      : <span className="badge badge-locked">Terkunci</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ADD FORM
// ════════════════════════════════════════════════════════════════

export function AddForm({ session, onSave, onCancel }) {
  const today = new Date().toISOString().split("T")[0];
  const [f, setF] = useState({
    title: "", date: today, category: "", description: "",
    tags: "", location: "", author: "", reference: "", notes: "", status: "Aktif",
  });
  const [files,   setFiles]   = useState([]);
  const [dov,     setDov]     = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [encProg, setEncProg] = useState("");
  const ref = useRef();
  const up  = (k, v) => setF(p => ({ ...p, [k]: v }));

  // Batas ukuran per file: 200MB (base64 ~267MB, aman di bawah limit server 500MB)
  const MAX_FILE_SIZE = 200 * 1024 * 1024;

  const readFiles = async (fl) => {
    const arr      = [];
    const rejected = [];
    for (const file of fl) {
      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name} (${fmtSize(file.size)})`);
        continue;
      }
      const data = await file.arrayBuffer();
      arr.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        data,
        addedAt: new Date().toISOString(),
      });
    }
    if (rejected.length > 0) {
      alert(
        `File berikut melebihi batas ukuran 200MB dan tidak dapat diupload:\n\n` +
        rejected.join("\n")
      );
    }
    if (arr.length > 0) setFiles(p => [...p, ...arr]);
  };

  const save = async () => {
    if (!f.title.trim()) { alert("Judul arsip wajib diisi!"); return; }
    if (!f.date)         { alert("Tanggal harus diisi!"); return; }
    setSaving(true);
    try {
      const encFiles = [];
      for (let i = 0; i < files.length; i++) {
        setEncProg(`Mengenkripsi berkas ${i + 1}/${files.length}...`);
        const encData = await Crypto.encrypt(files[i].data, session.passphrase);
        encFiles.push({
          name:    files[i].name,
          type:    files[i].type,
          size:    files[i].size,
          encData,
          addedAt: files[i].addedAt,
        });
      }
      setEncProg("");
      await onSave({
        ...f,
        tags:  f.tags.split(",").map(t => t.trim()).filter(Boolean),
        files: encFiles,
      });
    } catch (e) {
      alert("Gagal mengenkripsi berkas: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: "820px" }}>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Entri Arsip Baru</div>
          <div className="sec-sub">Semua berkas akan dienkripsi dengan kunci Anda sebelum disimpan</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-s" onClick={onCancel}>Batal</button>
          <button className="btn btn-p" onClick={save} disabled={saving}>
            {encProg || (saving ? "Menyimpan..." : "Simpan Arsip")}
          </button>
        </div>
      </div>

      <div className="enc-notice">
        Kunci enkripsi: akun [{session.username}] — AES-256-GCM. Berkas hanya dapat dibuka dengan kata kunci Anda.
      </div>

      <div className="sec-card" style={{ marginBottom: "18px" }}>
        <div className="sec-card-head">Informasi Arsip</div>
        <div style={{ padding: "20px" }}>
          <div className="fgrid">
            <div className="fg full">
              <label>Judul Arsip *</label>
              <input value={f.title} onChange={e => up("title", e.target.value)} placeholder="Judul dokumen / arsip..." />
            </div>
            <div className="fg">
              <label>Tanggal Dokumen *</label>
              <input type="date" value={f.date} onChange={e => up("date", e.target.value)} />
            </div>
            <div className="fg">
              <label>Kategori</label>
              <select value={f.category} onChange={e => up("category", e.target.value)}>
                <option value="">— Pilih Kategori —</option>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Penyusun / Pengarang</label>
              <input value={f.author} onChange={e => up("author", e.target.value)} placeholder="Nama penyusun, instansi..." />
            </div>
            <div className="fg">
              <label>Nomor Referensi</label>
              <input value={f.reference} onChange={e => up("reference", e.target.value)} placeholder="No. dokumen, seri berkas..." />
            </div>
            <div className="fg">
              <label>Lokasi / Asal</label>
              <input value={f.location} onChange={e => up("location", e.target.value)} placeholder="Kota, instansi, departemen..." />
            </div>
            <div className="fg">
              <label>Status</label>
              <select value={f.status} onChange={e => up("status", e.target.value)}>
                {Object.keys(STATUSES).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="fg full">
              <label>Deskripsi</label>
              <textarea value={f.description} onChange={e => up("description", e.target.value)}
                placeholder="Deskripsi singkat isi arsip..." rows={3} />
            </div>
            <div className="fg full">
              <label>Tag — pisahkan dengan koma</label>
              <input value={f.tags} onChange={e => up("tags", e.target.value)} placeholder="perjanjian, 2026, proyek-x" />
            </div>
            <div className="fg full">
              <label>Catatan Internal</label>
              <textarea value={f.notes} onChange={e => up("notes", e.target.value)}
                placeholder="Catatan tambahan..." rows={2} />
            </div>
          </div>
        </div>
      </div>

      <div className="sec-card">
        <div className="sec-card-head">Lampiran Berkas (akan dienkripsi)</div>
        <div style={{ padding: "20px" }}>
          <div className={`drop-zone${dov ? " dov" : ""}`}
            onClick={() => ref.current.click()}
            onDragOver={e => { e.preventDefault(); setDov(true); }}
            onDragLeave={() => setDov(false)}
            onDrop={e => { e.preventDefault(); setDov(false); readFiles(e.dataTransfer.files); }}>
            <p>Seret & lepas berkas ke sini, atau <span>klik untuk memilih</span></p>
            <p style={{ fontSize: "12px", color: "var(--ink4)", marginTop: "7px", fontFamily: "var(--fm)" }}>
              PDF · Gambar · Video · Audio · ZIP · Word · Excel · dan lainnya
            </p>
            <input ref={ref} type="file" multiple hidden onChange={e => readFiles(e.target.files)} />
          </div>
          {files.length > 0 && (
            <div className="flist">
              {files.map((fl, i) => (
                <div key={i} className="fi">
                  <span style={{
                    fontFamily: "var(--fm)", fontSize: "10px", color: "var(--ink4)",
                    background: "var(--bg2)", padding: "2px 6px", border: "1px solid var(--rule)",
                    minWidth: "34px", textAlign: "center",
                  }}>{fileTypeLabel(fl.type)}</span>
                  <div style={{ flex: 1 }}>
                    <div className="fi-name">{fl.name}</div>
                    <div className="fi-sz">{fmtSize(fl.size)} — {fl.type || "unknown"}</div>
                  </div>
                  <span className="fi-enc">AES-256</span>
                  <button className="fi-rm" onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>Hapus</button>
                </div>
              ))}
              <div style={{ fontFamily: "var(--fm)", fontSize: "11px", color: "var(--ink4)", marginTop: "6px" }}>
                Total: {files.length} berkas — {fmtSize(files.reduce((s, f) => s + f.size, 0))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// EDIT FORM — hanya pemilik yang bisa akses
// ════════════════════════════════════════════════════════════════

export function EditForm({ session, arcId, onSave, onCancel }) {
  const [arc,     setArc]     = useState(null);
  const [f,       setF]       = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);
  const [newFiles,      setNewFiles]      = useState([]);
  const [removedIdx,    setRemovedIdx]    = useState(new Set());
  const [dov,     setDov]     = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [encProg, setEncProg] = useState("");
  const ref = useRef();
  const up  = (k, v) => setF(p => ({ ...p, [k]: v }));

  // Load arsip dari DB saat mount
  useEffect(() => {
    IDB.get(arcId).then(a => {
      if (!a) return;
      setArc(a);
      setExistingFiles(a.files || []);
      setF({
        title:       a.title       || "",
        date:        a.date        || "",
        category:    a.category    || "",
        description: a.description || "",
        tags:        (a.tags || []).join(", "),
        location:    a.location    || "",
        author:      a.author      || "",
        reference:   a.reference   || "",
        notes:       a.notes       || "",
        status:      a.status      || "Aktif",
      });
    });
  }, [arcId]);

  const MAX_FILE_SIZE = 200 * 1024 * 1024;

  const readNewFiles = async (fl) => {
    const arr      = [];
    const rejected = [];
    for (const file of fl) {
      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name} (${fmtSize(file.size)})`);
        continue;
      }
      const data = await file.arrayBuffer();
      arr.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        data,
        addedAt: new Date().toISOString(),
      });
    }
    if (rejected.length > 0) {
      alert(
        `File berikut melebihi batas ukuran 200MB dan tidak dapat diupload:\n\n` +
        rejected.join("\n")
      );
    }
    if (arr.length > 0) setNewFiles(p => [...p, ...arr]);
  };

  const toggleRemove = (i) => {
    setRemovedIdx(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const save = async () => {
    if (!f.title.trim()) { alert("Judul arsip wajib diisi!"); return; }
    if (!f.date)         { alert("Tanggal harus diisi!"); return; }
    setSaving(true);
    try {
      // Berkas lama yang tidak dihapus — tetap pakai encData yang ada
      const keptFiles = existingFiles.filter((_, i) => !removedIdx.has(i));

      // Enkripsi berkas baru
      const encNew = [];
      for (let i = 0; i < newFiles.length; i++) {
        setEncProg(`Mengenkripsi berkas baru ${i + 1}/${newFiles.length}...`);
        const encData = await Crypto.encrypt(newFiles[i].data, session.passphrase);
        encNew.push({
          name:    newFiles[i].name,
          type:    newFiles[i].type,
          size:    newFiles[i].size,
          encData,
          addedAt: newFiles[i].addedAt,
        });
      }
      setEncProg("");

      const updated = {
        ...arc,
        ...f,
        tags:      f.tags.split(",").map(t => t.trim()).filter(Boolean),
        files:     [...keptFiles, ...encNew],
        updatedAt: new Date().toISOString(),
      };

      await IDB.update(arcId, updated);
      onSave();
    } catch (e) {
      alert("Gagal menyimpan perubahan: " + e.message);
    }
    setSaving(false);
  };

  if (!f) return <div className="loading">Memuat data arsip...</div>;

  return (
    <div style={{ maxWidth: "820px" }}>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Edit Arsip</div>
          <div className="sec-sub">
            {arc?.archiveId} — Perubahan hanya bisa dilakukan oleh pemilik
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-s" onClick={onCancel}>Batal</button>
          <button className="btn btn-p" onClick={save} disabled={saving}>
            {encProg || (saving ? "Menyimpan..." : "Simpan Perubahan")}
          </button>
        </div>
      </div>

      <div className="enc-notice">
        Berkas baru akan dienkripsi dengan kunci [{session.username}] — AES-256-GCM.
      </div>

      {/* ── Metadata ── */}
      <div className="sec-card" style={{ marginBottom: "18px" }}>
        <div className="sec-card-head">Informasi Arsip</div>
        <div style={{ padding: "20px" }}>
          <div className="fgrid">
            <div className="fg full">
              <label>Judul Arsip *</label>
              <input value={f.title} onChange={e => up("title", e.target.value)} placeholder="Judul dokumen / arsip..." />
            </div>
            <div className="fg">
              <label>Tanggal Dokumen *</label>
              <input type="date" value={f.date} onChange={e => up("date", e.target.value)} />
            </div>
            <div className="fg">
              <label>Kategori</label>
              <select value={f.category} onChange={e => up("category", e.target.value)}>
                <option value="">— Pilih Kategori —</option>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Penyusun / Pengarang</label>
              <input value={f.author} onChange={e => up("author", e.target.value)} placeholder="Nama penyusun, instansi..." />
            </div>
            <div className="fg">
              <label>Nomor Referensi</label>
              <input value={f.reference} onChange={e => up("reference", e.target.value)} placeholder="No. dokumen, seri berkas..." />
            </div>
            <div className="fg">
              <label>Lokasi / Asal</label>
              <input value={f.location} onChange={e => up("location", e.target.value)} placeholder="Kota, instansi, departemen..." />
            </div>
            <div className="fg">
              <label>Status</label>
              <select value={f.status} onChange={e => up("status", e.target.value)}>
                {Object.keys(STATUSES).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="fg full">
              <label>Deskripsi</label>
              <textarea value={f.description} onChange={e => up("description", e.target.value)}
                placeholder="Deskripsi singkat isi arsip..." rows={3} />
            </div>
            <div className="fg full">
              <label>Tag — pisahkan dengan koma</label>
              <input value={f.tags} onChange={e => up("tags", e.target.value)} placeholder="perjanjian, 2026, proyek-x" />
            </div>
            <div className="fg full">
              <label>Catatan Internal</label>
              <textarea value={f.notes} onChange={e => up("notes", e.target.value)}
                placeholder="Catatan tambahan..." rows={2} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Berkas yang sudah ada ── */}
      <div className="sec-card" style={{ marginBottom: "18px" }}>
        <div className="sec-card-head">
          Berkas Tersimpan ({existingFiles.length - removedIdx.size} aktif
          {removedIdx.size > 0 && `, ${removedIdx.size} ditandai hapus`})
        </div>
        <div style={{ padding: "16px 20px" }}>
          {existingFiles.length === 0 ? (
            <div style={{ color: "var(--ink4)", fontSize: "13px", textAlign: "center", padding: "16px" }}>
              Tidak ada berkas tersimpan
            </div>
          ) : (
            <div className="flist">
              {existingFiles.map((fl, i) => {
                const marked = removedIdx.has(i);
                return (
                  <div key={i} className="fi" style={{
                    opacity: marked ? 0.4 : 1,
                    background: marked ? "var(--red-bg)" : "#fff",
                    border: `1px solid ${marked ? "#e09090" : "var(--rule2)"}`,
                  }}>
                    <span style={{
                      fontFamily: "var(--fm)", fontSize: "10px", color: "var(--ink4)",
                      background: "var(--bg2)", padding: "2px 6px", border: "1px solid var(--rule)",
                      minWidth: "34px", textAlign: "center",
                    }}>{fileTypeLabel(fl.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div className="fi-name" style={{ textDecoration: marked ? "line-through" : "none" }}>
                        {fl.name}
                      </div>
                      <div className="fi-sz">{fmtSize(fl.size)}</div>
                    </div>
                    <span className="fi-enc">AES-256</span>
                    <button
                      className={`fi-rm`}
                      style={{ color: marked ? "var(--green)" : "var(--red)", opacity: 1 }}
                      onClick={() => toggleRemove(i)}
                    >
                      {marked ? "Batal" : "Hapus"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {removedIdx.size > 0 && (
            <div style={{
              marginTop: "10px", padding: "8px 12px",
              background: "var(--red-bg)", border: "1px solid #e09090",
              fontFamily: "var(--fm)", fontSize: "10.5px", color: "var(--red)",
            }}>
              {removedIdx.size} berkas akan dihapus permanen saat kamu klik "Simpan Perubahan".
            </div>
          )}
        </div>
      </div>

      {/* ── Tambah berkas baru ── */}
      <div className="sec-card">
        <div className="sec-card-head">Tambah Berkas Baru (akan dienkripsi)</div>
        <div style={{ padding: "20px" }}>
          <div className={`drop-zone${dov ? " dov" : ""}`}
            onClick={() => ref.current.click()}
            onDragOver={e => { e.preventDefault(); setDov(true); }}
            onDragLeave={() => setDov(false)}
            onDrop={e => { e.preventDefault(); setDov(false); readNewFiles(e.dataTransfer.files); }}>
            <p>Seret & lepas berkas ke sini, atau <span>klik untuk memilih</span></p>
            <p style={{ fontSize: "12px", color: "var(--ink4)", marginTop: "7px", fontFamily: "var(--fm)" }}>
              PDF · Gambar · Video · Audio · ZIP · Word · Excel · dan lainnya
            </p>
            <input ref={ref} type="file" multiple hidden onChange={e => readNewFiles(e.target.files)} />
          </div>
          {newFiles.length > 0 && (
            <div className="flist">
              {newFiles.map((fl, i) => (
                <div key={i} className="fi">
                  <span style={{
                    fontFamily: "var(--fm)", fontSize: "10px", color: "var(--ink4)",
                    background: "var(--bg2)", padding: "2px 6px", border: "1px solid var(--rule)",
                    minWidth: "34px", textAlign: "center",
                  }}>{fileTypeLabel(fl.type)}</span>
                  <div style={{ flex: 1 }}>
                    <div className="fi-name">{fl.name}</div>
                    <div className="fi-sz">{fmtSize(fl.size)} — baru</div>
                  </div>
                  <span className="fi-enc">AES-256</span>
                  <button className="fi-rm" onClick={() => setNewFiles(p => p.filter((_, j) => j !== i))}>Hapus</button>
                </div>
              ))}
              <div style={{ fontFamily: "var(--fm)", fontSize: "11px", color: "var(--ink4)", marginTop: "6px" }}>
                {newFiles.length} berkas baru — {fmtSize(newFiles.reduce((s, fl) => s + fl.size, 0))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}