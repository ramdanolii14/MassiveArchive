import { useState, useRef, useEffect } from "react";
import { Crypto } from "../crypto.js";
import { IDB }    from "../database.js";
import { fmtSize, CATS, STATUSES, fileTypeLabel } from "../utils.js";
import { Avatar }          from "../components/Avatar.jsx";
import { StorageCapsule }  from "../components/StorageCapsule.jsx";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB per berkas

function Empty({ title, text, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

// Dasbor

export function Dashboard({ archives, session, avatar, onGo, onDetail }) {
  const mine   = archives.filter(a => a.owner === session.username);
  const shared = archives.filter(a => a.owner !== session.username);
  const fileCount = mine.reduce((s, a) => s + (a.files?.length || 0), 0);
  const recent    = mine.slice(0, 6);

  return (
    <div>
      <div className="dash-head">
        <Avatar src={avatar} name={session.username} />
        <div className="dash-name">{session.username}</div>
      </div>

      <div className="stats">
        {[
          { lbl: "Arsip saya",        val: mine.length },
          { lbl: "Berkas",            val: fileCount },
          { lbl: "Dibagikan ke saya", val: shared.length },
        ].map(s => (
          <div key={s.lbl} className="panel stat">
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-val">{s.val}</div>
          </div>
        ))}
      </div>

      <StorageCapsule />

      <div className="sec-hdr">
        <div className="sec-title">Terbaru</div>
        <button className="btn btn-g btn-sm" onClick={() => onGo("browse")}>Lihat semua</button>
      </div>

      <div className="panel tbl-wrap">
        {recent.length === 0 ? (
          <Empty title="Belum ada arsip"
            action={<button className="btn btn-p btn-sm" style={{ marginTop: 14 }}
              onClick={() => onGo("add")}>Tambah arsip</button>} />
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>No.</th><th>Judul</th><th>Tanggal</th></tr>
            </thead>
            <tbody>
              {recent.map(a => (
                <tr key={a.id} onClick={() => onDetail(a.id)}>
                  <td className="mono">{a.archiveId}</td>
                  <td>
                    <div className="td-title">{a.title}</div>
                    {a.category && <div className="td-sub">{a.category}</div>}
                  </td>
                  <td className="mono">{a.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Daftar arsip

export function Browse({ session, userAvatars, search, onDetail }) {
  const [cat, setCat] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [scope, setScope] = useState("accessible");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { setPage(1); }, [search, cat, from, to, sort, scope]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    IDB.pageMeta({
      page,
      limit: 25,
      scope,
      username: session.username,
      q: search || "",
      cat,
      from,
      to,
      sort,
    }).then(result => {
      if (!cancelled) setData(result);
    }).catch(() => {
      if (!cancelled) setData({ items: [], page: 1, pages: 1, total: 0 });
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [page, search, cat, from, to, sort, scope, session.username]);

  const goPage = next => {
    setPage(Math.min(Math.max(1, next), data.pages || 1));
  };

  return (
    <div>
      <div className="filters">
        <select value={scope} onChange={e => setScope(e.target.value)}>
          <option value="accessible">Arsip saya dan dibagikan</option>
          <option value="all">Semua arsip</option>
        </select>
        <select value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Semua kategori</option>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
          <option value="title">Judul A-Z</option>
          <option value="date">Tanggal dokumen</option>
        </select>
      </div>

      <div className="panel tbl-wrap">
        {loading ? (
          <div className="loading">Memuat daftar arsip...</div>
        ) : data.items.length === 0 ? (
          <Empty title="Tidak ada hasil" text="Coba ubah filter atau kata pencarian." />
        ) : (
          <>
            <table className="tbl">
              <thead>
                <tr>
                  <th>No.</th><th>Judul</th><th>Tanggal</th><th>Pemilik</th><th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(a => {
                  const ok = a.owner === session.username ||
                    (a.sharedWith || []).includes(session.username);
                  return (
                    <tr key={a.id} onClick={() => onDetail(a.id)}>
                      <td className="mono">{a.archiveId}</td>
                      <td>
                        <div className="td-title">{a.title}</div>
                        <div className="td-sub">
                          {[a.category, ...(a.tags || [])].filter(Boolean).join(", ")}
                        </div>
                      </td>
                      <td className="mono">{a.date}</td>
                      <td>
                        <div className="owner-cell">
                          <Avatar src={userAvatars?.[a.owner]} name={a.owner} />
                          <span>{a.owner === session.username ? "Saya" : a.owner}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {!ok && <span className="badge badge-line">Terkunci</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="pager">
              <div className="td-sub">{data.total} arsip</div>
              <div className="row">
                <button className="btn btn-s btn-sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>Sebelumnya</button>
                <span className="pager-label">Halaman {data.page} / {data.pages}</span>
                <button className="btn btn-s btn-sm" disabled={page >= data.pages} onClick={() => goPage(page + 1)}>Berikutnya</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Bagian form yang dipakai Tambah dan Edit

function ArchiveFields({ f, up }) {
  return (
    <div className="fgrid">
      <div className="field full">
        <label>Judul *</label>
        <input value={f.title} onChange={e => up("title", e.target.value)} />
      </div>
      <div className="field">
        <label>Tanggal dokumen *</label>
        <input type="date" value={f.date} onChange={e => up("date", e.target.value)} />
      </div>
      <div className="field">
        <label>Kategori</label>
        <select value={f.category} onChange={e => up("category", e.target.value)}>
          <option value="">Pilih kategori</option>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Penyusun</label>
        <input value={f.author} onChange={e => up("author", e.target.value)} />
      </div>
      <div className="field">
        <label>Nomor referensi</label>
        <input value={f.reference} onChange={e => up("reference", e.target.value)} />
      </div>
      <div className="field">
        <label>Lokasi</label>
        <input value={f.location} onChange={e => up("location", e.target.value)} />
      </div>
      <div className="field">
        <label>Status</label>
        <select value={f.status} onChange={e => up("status", e.target.value)}>
          {Object.keys(STATUSES).map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="field full">
        <label>Deskripsi</label>
        <textarea value={f.description} onChange={e => up("description", e.target.value)} rows={3} />
      </div>
      <div className="field full">
        <label>Tag (pisahkan dengan koma)</label>
        <input value={f.tags} onChange={e => up("tags", e.target.value)} placeholder="kontrak, 2026" />
      </div>
      <div className="field full">
        <label>Catatan pribadi</label>
        <textarea value={f.notes} onChange={e => up("notes", e.target.value)} rows={2} />
      </div>
    </div>
  );
}

function FileRow({ name, type, size, marked, action, actionLabel }) {
  return (
    <div className={`fi${marked ? " marked" : ""}`}>
      <span className="fi-type">{fileTypeLabel(type)}</span>
      <div className="grow">
        <div className="fi-name">{name}</div>
        <div className="fi-sz">{fmtSize(size)}</div>
      </div>
      <button className="btn btn-g btn-sm" onClick={action}>{actionLabel}</button>
    </div>
  );
}

function DropArea({ onFiles }) {
  const [dov, setDov] = useState(false);
  const ref = useRef();
  return (
    <div className={`drop${dov ? " dov" : ""}`}
      onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setDov(true); }}
      onDragLeave={() => setDov(false)}
      onDrop={e => { e.preventDefault(); setDov(false); onFiles(e.dataTransfer.files); }}>
      Seret berkas ke sini atau <u>pilih dari perangkat</u>
      <input ref={ref} type="file" multiple hidden onChange={e => onFiles(e.target.files)} />
    </div>
  );
}

async function readFileList(fl) {
  const ok = [];
  const rejected = [];
  for (const file of fl) {
    if (file.size > MAX_FILE_SIZE) { rejected.push(`${file.name} (${fmtSize(file.size)})`); continue; }
    ok.push({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      data: await file.arrayBuffer(),
      addedAt: new Date().toISOString(),
    });
  }
  if (rejected.length) {
    alert("Melebihi batas 200 MB per berkas:\n\n" + rejected.join("\n"));
  }
  return ok;
}

async function encryptLegacyFiles(list, passphrase, setProg) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    setProg(`Mengenkripsi ${i + 1}/${list.length}`);
    const encData = await Crypto.encrypt(list[i].data, passphrase);
    out.push({
      name: list[i].name, type: list[i].type, size: list[i].size,
      encData, addedAt: list[i].addedAt,
    });
  }
  setProg("");
  return out;
}

async function uploadEncryptedPayload(encData, meta, setProg) {
  const bytes = Crypto.toUint8Array(encData);
  const state = await IDB.startUpload({
    size: bytes.byteLength,
    name: meta.name,
    type: meta.type,
  });

  let offset = state.received || 0;
  let retries = 0;
  try {
    while (offset < bytes.byteLength) {
      const end = Math.min(offset + (state.chunkSize || 4 * 1024 * 1024), bytes.byteLength);
      const chunk = bytes.slice(offset, end);
      try {
        const result = await IDB.uploadChunk(state.uploadId, offset, chunk);
        offset = result.received;
        retries = 0;
        setProg(`Mengunggah ${meta.name} ${Math.round((offset / bytes.byteLength) * 100)}%`);
      } catch (e) {
        const status = await IDB.uploadStatus(state.uploadId).catch(() => null);
        if (status && Number.isInteger(status.received)) {
          offset = status.received;
        } else {
          throw e;
        }
        if (++retries > 3) throw e;
      }
    }
    return state.uploadId;
  } catch (e) {
    await IDB.cancelUpload(state.uploadId).catch(() => {});
    throw e;
  }
}


async function createSecureArchiveFiles(list, session, setProg) {
  if (!session.publicKey || !session.keyId) {
    throw new Error("Identitas keamanan akun belum siap. Silakan masuk kembali.");
  }

  const archiveKey = Crypto.randomContentKey();
  const wrappedKey = await Crypto.wrapKey(archiveKey, session.publicKey);
  const files = [];
  for (let i = 0; i < list.length; i++) {
    setProg(`Mengenkripsi ${i + 1}/${list.length}`);
    const encData = await Crypto.encryptWithKey(list[i].data, archiveKey);
    const uploadId = await uploadEncryptedPayload(encData, list[i], setProg);
    files.push({
      name: list[i].name,
      type: list[i].type,
      size: list[i].size,
      addedAt: list[i].addedAt,
      uploadId,
    });
  }
  setProg("");
  return {
    files,
    keyMode: "envelope-v1",
    keyEnvelopes: [{
      keyId: session.keyId,
      username: session.username,
      wrappedKey,
      permissions: { view: true, download: true, edit: true, reshare: true },
    }],
  };
}

async function unlockArchiveKey(arc, session) {
  if (arc?.keyMode !== "envelope-v1") return null;
  const envelope = (arc.keyEnvelopes || []).find(e =>
    e.keyId === session.keyId
  );
  if (!envelope || !session.identityPrivateKey) {
    throw new Error("Anda tidak memiliki kunci akses untuk arsip ini.");
  }
  return Crypto.unwrapKey(envelope.wrappedKey, session.identityPrivateKey);
}

// Tambah arsip

export function AddForm({ session, onSave, onCancel }) {
  const today = new Date().toISOString().split("T")[0];
  const [f, setF] = useState({
    title: "", date: today, category: "", description: "",
    tags: "", location: "", author: "", reference: "", notes: "", status: "Aktif",
  });
  const [files,   setFiles]   = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [encProg, setEncProg] = useState("");
  const up = (k, v) => setF(p => ({ ...p, [k]: v }));

  const addFiles = async (fl) => {
    const arr = await readFileList(fl);
    if (arr.length) setFiles(p => [...p, ...arr]);
  };

  const save = async () => {
    if (!f.title.trim()) { alert("Judul wajib diisi."); return; }
    if (!f.date)         { alert("Tanggal wajib diisi."); return; }
    setSaving(true);
    try {
      const secured = await createSecureArchiveFiles(files, session, setEncProg);
      await onSave({
        ...f,
        tags: f.tags.split(",").map(t => t.trim()).filter(Boolean),
        ...secured,
      });
    } catch (e) {
      alert("Gagal mengenkripsi berkas: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 820 }} className="stack">
      <div className="panel pad"><ArchiveFields f={f} up={up} /></div>

      <div className="panel pad">
        <DropArea onFiles={addFiles} />
        {files.length > 0 && (
          <div className="flist">
            {files.map((fl, i) => (
              <FileRow key={i} name={fl.name} type={fl.type} size={fl.size}
                actionLabel="Hapus" action={() => setFiles(p => p.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-s" onClick={onCancel}>Batal</button>
        <button className="btn btn-p" onClick={save} disabled={saving}>
          {encProg || (saving ? "Menyimpan..." : "Simpan")}
        </button>
      </div>
    </div>
  );
}

// Edit arsip

export function EditForm({ session, arcId, onSave, onCancel }) {
  const [arc, setArc] = useState(null);
  const [f,   setF]   = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);
  const [newFiles,      setNewFiles]      = useState([]);
  const [removedIdx,    setRemovedIdx]    = useState(new Set());
  const [saving,  setSaving]  = useState(false);
  const [encProg, setEncProg] = useState("");
  const up = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    IDB.get(arcId, session).then(a => {
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

  const addFiles = async (fl) => {
    const arr = await readFileList(fl);
    if (arr.length) setNewFiles(p => [...p, ...arr]);
  };

  const toggleRemove = (i) => {
    setRemovedIdx(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const save = async () => {
    if (!f.title.trim()) { alert("Judul wajib diisi."); return; }
    if (!f.date)         { alert("Tanggal wajib diisi."); return; }
    setSaving(true);
    try {
      const keptFiles = existingFiles.filter((_, i) => !removedIdx.has(i));
      let encNew = [];
      let nextKeyMode = arc.keyMode;
      let nextEnvelopes = arc.keyEnvelopes;

      if (newFiles.length) {
        if (arc.keyMode === "envelope-v1") {
          const archiveKey = await unlockArchiveKey(arc, session);
          for (let i = 0; i < newFiles.length; i++) {
            setEncProg(`Mengenkripsi ${i + 1}/${newFiles.length}`);
            const encData = await Crypto.encryptWithKey(newFiles[i].data, archiveKey);
            const uploadId = await uploadEncryptedPayload(encData, newFiles[i], setEncProg);
            encNew.push({
              name: newFiles[i].name,
              type: newFiles[i].type,
              size: newFiles[i].size,
              addedAt: newFiles[i].addedAt,
              uploadId,
            });
          }
        } else {
          encNew = await encryptLegacyFiles(newFiles, session.passphrase, setEncProg);
        }
      }

      await IDB.update(arcId, {
        ...arc,
        ...f,
        tags: f.tags.split(",").map(t => t.trim()).filter(Boolean),
        keyMode: nextKeyMode,
        keyEnvelopes: nextEnvelopes,
        files: [...keptFiles, ...encNew],
        updatedAt: new Date().toISOString(),
      }, session);
      onSave();
    } catch (e) {
      alert("Gagal menyimpan perubahan: " + e.message);
    }
    setSaving(false);
  };

  if (!f) return <div className="loading">Memuat...</div>;

  return (
    <div style={{ maxWidth: 820 }} className="stack">
      <div className="panel pad"><ArchiveFields f={f} up={up} /></div>

      <div className="panel pad">
        {existingFiles.length > 0 && (
          <div className="flist" style={{ marginTop: 0, marginBottom: 14 }}>
            {existingFiles.map((fl, i) => (
              <FileRow key={i} name={fl.name} type={fl.type} size={fl.size}
                marked={removedIdx.has(i)}
                actionLabel={removedIdx.has(i) ? "Batalkan" : "Hapus"}
                action={() => toggleRemove(i)} />
            ))}
          </div>
        )}
        <DropArea onFiles={addFiles} />
        {newFiles.length > 0 && (
          <div className="flist">
            {newFiles.map((fl, i) => (
              <FileRow key={i} name={fl.name} type={fl.type} size={fl.size}
                actionLabel="Hapus" action={() => setNewFiles(p => p.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-s" onClick={onCancel}>Batal</button>
        <button className="btn btn-p" onClick={save} disabled={saving}>
          {encProg || (saving ? "Menyimpan..." : "Simpan perubahan")}
        </button>
      </div>
    </div>
  );
}