import { useState } from "react";
import { IDB }         from "../database.js";
import { Crypto }      from "../crypto.js";
import { passStrength } from "../utils.js";

export function WelcomeScreen({ onLogin }) {
  const [tab,      setTab]      = useState("login");
  const [username, setUsername] = useState("");
  const [pass,     setPass]     = useState("");
  const [pass2,    setPass2]    = useState("");
  const [showP,    setShowP]    = useState(false);
  const [err,      setErr]      = useState("");
  const [busy,     setBusy]     = useState(false);

  const strength = passStrength(pass);

  const handleLogin = async () => {
    setErr("");
    if (!username.trim() || !pass) { setErr("Isi username dan kata kunci."); return; }
    setBusy(true);
    try {
      const user = await IDB.getUser(username.trim().toLowerCase());
      if (!user) { setErr("Username tidak ditemukan."); setBusy(false); return; }
      const hash = await Crypto.hashPass(pass);
      if (hash !== user.passHash) { setErr("Kata kunci salah."); setBusy(false); return; }

      // Akun lama yang belum memiliki identitas kriptografi akan diprovisikan
      // sekali saat login. Setelah itu public/private key tetap sama.
      let identity;
      try {
        if (user.publicKey && user.privateKeyBox && user.keyId) {
          identity = {
            publicKey: user.publicKey,
            keyId: user.keyId,
            privateKey: await Crypto.unlockIdentity(user.privateKeyBox, pass),
          };
        } else {
          const created = await Crypto.createIdentity(pass);
          await IDB.updateUser(user.username, {
            publicKey: created.publicKey,
            keyId: created.keyId,
            privateKeyBox: created.privateKeyBox,
          });
          identity = created;
        }
      } catch {
        setErr("Gagal menyiapkan identitas keamanan akun.");
        setBusy(false);
        return;
      }

      onLogin({
        username: user.username,
        passphrase: pass,
        publicKey: identity.publicKey,
        keyId: identity.keyId,
        identityPrivateKey: identity.privateKey,
      });
    } catch { setErr("Terjadi kesalahan sistem."); }
    setBusy(false);
  };

  const handleRegister = async () => {
    setErr("");
    if (!username.trim()) { setErr("Username wajib diisi."); return; }
    if (!/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) {
      setErr("Username 3 sampai 24 karakter: huruf kecil, angka, atau garis bawah."); return;
    }
    if (pass.length < 8) { setErr("Kata kunci minimal 8 karakter."); return; }
    if (pass !== pass2)  { setErr("Konfirmasi kata kunci tidak cocok."); return; }
    setBusy(true);
    try {
      const exists = await IDB.getUser(username.trim().toLowerCase());
      if (exists) { setErr("Username sudah digunakan."); setBusy(false); return; }
      const passHash = await Crypto.hashPass(pass);
      const identity = await Crypto.createIdentity(pass);
      await IDB.addUser({
        username:  username.trim().toLowerCase(),
        passHash,
        publicKey: identity.publicKey,
        keyId: identity.keyId,
        privateKeyBox: identity.privateKeyBox,
        createdAt: new Date().toISOString(),
      });
      onLogin({
        username: username.trim().toLowerCase(),
        passphrase: pass,
        publicKey: identity.publicKey,
        keyId: identity.keyId,
        identityPrivateKey: identity.privateKey,
      });
    } catch { setErr("Gagal membuat akun."); }
    setBusy(false);
  };

  const submit = () => (tab === "login" ? handleLogin() : handleRegister());
  const onEnter = e => e.key === "Enter" && submit();

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-title">MassiveArchive</div>
        <div className="auth-sub">Arsip terenkripsi di perangkat Anda.</div>

        <div className="seg">
          <button className={tab === "login" ? "act" : ""}
            onClick={() => { setTab("login"); setErr(""); }}>Masuk</button>
          <button className={tab === "register" ? "act" : ""}
            onClick={() => { setTab("register"); setErr(""); }}>Daftar</button>
        </div>

        <div className="auth-fields">
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={onEnter} autoComplete="username" />
          </div>
          <div className="field">
            <label>Kata kunci</label>
            <div className="pw">
              <input type={showP ? "text" : "password"} value={pass}
                onChange={e => setPass(e.target.value)} onKeyDown={onEnter}
                autoComplete={tab === "login" ? "current-password" : "new-password"} />
              <button type="button" onClick={() => setShowP(p => !p)}>
                {showP ? "Sembunyi" : "Lihat"}
              </button>
            </div>
            {tab === "register" && pass && (
              <div className="strength">
                <div style={{ width: `${(strength.score / 5) * 100}%` }} />
              </div>
            )}
          </div>
          {tab === "register" && (
            <div className="field">
              <label>Ulangi kata kunci</label>
              <input type={showP ? "text" : "password"} value={pass2}
                onChange={e => setPass2(e.target.value)} onKeyDown={onEnter}
                autoComplete="new-password" />
            </div>
          )}
        </div>

        {err && <div className="err">{err}</div>}

        <button className="btn btn-p" style={{ width: "100%", marginTop: 20 }}
          onClick={submit} disabled={busy}>
          {busy ? "Memproses..." : tab === "login" ? "Masuk" : "Buat akun"}
        </button>

        {tab === "register" && (
          <div className="hint">Kata kunci tidak bisa dipulihkan jika lupa.</div>
        )}
      </div>
    </div>
  );
}