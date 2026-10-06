import { useState, useRef } from "react";
import { IDB }    from "../database.js";
import { Crypto } from "../crypto.js";
import { Avatar } from "../components/Avatar.jsx";
import { migrateLegacyArchives } from "../archiveMigration.js";

const AVATAR_SIZE = 256;

function toAvatar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = AVATAR_SIZE;
      c.getContext("2d").drawImage(
        img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, AVATAR_SIZE, AVATAR_SIZE
      );
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar tidak valid.")); };
    img.src = url;
  });
}

export function ProfileView({ session, avatar, onAvatar, onSession, toast }) {
  const [name,  setName]  = useState(session.username);
  const [cur,   setCur]   = useState("");
  const [np,    setNp]    = useState("");
  const [np2,   setNp2]   = useState("");
  const [busy,  setBusy]  = useState("");
  const [legacyPass, setLegacyPass] = useState("");
  const [prog,  setProg]  = useState("");
  const fileRef = useRef();

  const pickAvatar = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Pilih berkas gambar.", "err"); return; }
    try {
      const data = await toAvatar(file);
      await IDB.updateUser(session.username, { avatar: data });
      onAvatar(data);
      toast("Foto profil disimpan.");
    } catch (e) { toast(e.message || "Gagal menyimpan foto.", "err"); }
  };

  const removeAvatar = async () => {
    try {
      await IDB.updateUser(session.username, { avatar: null });
      onAvatar(null);
      toast("Foto profil dihapus.");
    } catch { toast("Gagal menghapus foto.", "err"); }
  };

  const saveName = async () => {
    const next = name.trim().toLowerCase();
    if (next === session.username) return;
    if (!/^[a-z0-9_]{3,24}$/.test(next)) {
      toast("Username 3 sampai 24 karakter: huruf kecil, angka, atau garis bawah.", "err"); return;
    }
    setBusy("name");
    try {
      await IDB.updateUser(session.username, { username: next });
      onSession({ ...session, username: next });
      toast("Username diperbarui.");
    } catch (e) { toast(e.message || "Gagal mengubah username.", "err"); }
    setBusy("");
  };

  const savePass = async () => {
    if (!cur || !np) { toast("Isi semua kolom kata kunci.", "err"); return; }
    if (np.length < 8) { toast("Kata kunci baru minimal 8 karakter.", "err"); return; }
    if (np !== np2)    { toast("Konfirmasi kata kunci tidak cocok.", "err"); return; }
    if (np === cur)    { toast("Kata kunci baru sama dengan yang lama.", "err"); return; }
    setBusy("pass");
    try {
      const user = await IDB.getUser(session.username);
      if (!user || (await Crypto.hashPass(cur)) !== user.passHash) {
        toast("Kata kunci saat ini salah.", "err"); setBusy(""); return;
      }

      // Identitas ECDH tetap sama. Yang berubah hanya password yang
      // membungkus private key. Arsip yang sudah memakai envelope key
      // tidak perlu dienkripsi ulang sama sekali.
      let privateKeyBox = user.privateKeyBox;
      if (privateKeyBox) {
        privateKeyBox = await Crypto.rewrapIdentity(
          privateKeyBox, cur, np
        );
      } else if (!session.identityPrivateKey) {
        const identity = await Crypto.createIdentity(np);
        privateKeyBox = identity.privateKeyBox;
        onSession({
          ...session,
          passphrase: np,
          publicKey: identity.publicKey,
          keyId: identity.keyId,
          identityPrivateKey: identity.privateKey,
        });
      }

      // Arsip format lama masih memakai password sebagai kunci isi.
      // Hanya arsip lama yang perlu rotasi data. Arsip envelope yang
      // sudah memakai archive key tidak berubah saat password diganti.
      const metas = await IDB.listMeta();
      const legacyMine = metas.filter(a =>
        a.owner === session.username &&
        a.keyMode !== "envelope-v1" &&
        a.files?.length > 0
      );
      const total = legacyMine.reduce((n, a) => n + (a.fileCount || 0), 0);
      let n = 0;

      for (const meta of legacyMine) {
        const arc = await IDB.get(meta.id, session);
        if (!arc?.files?.length) continue;
        const files = [];

        for (const f of arc.files) {
          setProg(`${++n}/${total}`);
          let plain;
          try {
            plain = await Crypto.decrypt(f.encData, session.passphrase);
          } catch {
            throw new Error(`Tidak bisa membuka "${f.name}". Perubahan dibatalkan.`);
          }
          files.push({ ...f, encData: await Crypto.encrypt(plain, np) });
        }

        await IDB.update(arc.id, { files }, session);
      }

      await IDB.updateUser(session.username, {
        currentPassHash: await Crypto.hashPass(cur),
        passHash: await Crypto.hashPass(np),
        ...(privateKeyBox ? { privateKeyBox } : {}),
      });

      onSession({
        ...session,
        passphrase: np,
        ...(privateKeyBox ? { privateKeyBox } : {}),
      });
      setCur(""); setNp(""); setNp2("");
      toast("Kata kunci diperbarui.");
    } catch (e) { toast(e.message || "Gagal mengubah kata kunci.", "err"); }
    setProg("");
    setBusy("");
  };

  return (
    <div style={{ maxWidth: 560 }} className="stack">
      <div className="panel pad">
        <div className="profile-head">
          <Avatar src={avatar} name={session.username} large />
          <div className="row">
            <button className="btn btn-s btn-sm" onClick={() => fileRef.current.click()}>Ganti foto</button>
            {avatar && <button className="btn btn-g btn-sm" onClick={removeAvatar}>Hapus</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={e => { pickAvatar(e.target.files[0]); e.target.value = ""; }} />
          </div>
        </div>
      </div>

      <div className="panel pad">
        <div className="field">
          <label>Username</label>
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveName()} />
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-p btn-sm" onClick={saveName}
            disabled={busy === "name" || name.trim().toLowerCase() === session.username}>
            Simpan
          </button>
        </div>
      </div>

      <div className="panel pad">
        <div className="df-lbl" style={{ marginBottom: 8 }}>Pemulihan arsip lama</div>
        <div className="note">
          Arsip yang dibuat sebelum sistem kunci per arsip masih dapat menggunakan password lama.
          Masukkan password lama sekali untuk memindahkannya ke sistem kunci baru.
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Password lama arsip</label>
          <input
            type="password"
            value={legacyPass}
            onChange={e => setLegacyPass(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <button
            className="btn btn-s btn-sm"
            disabled={busy === "legacy" || !legacyPass}
            onClick={async () => {
              setBusy("legacy");
              try {
                const result = await migrateLegacyArchives(
                  session,
                  legacyPass,
                  value => setProg(value)
                );
                toast(
                  result.migrated
                    ? `${result.migrated} arsip lama berhasil dipindahkan ke sistem aman.`
                    : "Tidak ada arsip lama yang perlu dipindahkan."
                );
                setLegacyPass("");
              } catch (e) {
                toast(e.message || "Gagal memulihkan akses arsip lama.", "err");
              }
              setProg("");
              setBusy("");
            }}
          >
            {busy === "legacy" ? (prog ? `Memindahkan ${prog}` : "Memproses...") : "Pulihkan akses arsip lama"}
          </button>
        </div>
      </div>

      <div className="panel pad">
        <div className="stack">
          <div className="field">
            <label>Kata kunci saat ini</label>
            <input type="password" value={cur} onChange={e => setCur(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="field">
            <label>Kata kunci baru</label>
            <input type="password" value={np} onChange={e => setNp(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="field">
            <label>Ulangi kata kunci baru</label>
            <input type="password" value={np2} onChange={e => setNp2(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-p btn-sm" onClick={savePass} disabled={busy === "pass"}>
            {busy === "pass" ? (prog ? `Mengenkripsi ulang ${prog}` : "Memproses...") : "Ubah kata kunci"}
          </button>
        </div>
      </div>
    </div>
  );
}