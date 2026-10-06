import { useState } from "react";
import { IDB }         from "../database.js";
import { Crypto }      from "../crypto.js";
import { passStrength } from "../utils.js";

function sessionFromUser(user, passphrase, identityPrivateKey) {
  return {
    username: user.username,
    passphrase,
    publicKey: user.publicKey,
    keyId: user.keyId,
    identityPrivateKey,
  };
}

export function WelcomeScreen({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [showP, setShowP] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [pendingSession, setPendingSession] = useState(null);

  const strength = passStrength(pass);

  const handleLogin = async () => {
    setErr("");
    if (!username.trim() || !pass) {
      setErr("Isi username dan kata kunci.");
      return;
    }

    setBusy(true);
    try {
      const hash = await Crypto.hashPass(pass);
      const user = await IDB.login(username.trim().toLowerCase(), hash);
      if (!user?.username) {
        throw new Error("Data akun dari server tidak lengkap.");
      }

      let identity;
      let securityPatch = {};

      try {
        if (user.publicKey && user.privateKeyBox && user.keyId) {
          identity = {
            publicKey: user.publicKey,
            keyId: user.keyId,
            privateKeyBox: user.privateKeyBox,
            privateKey: await Crypto.unlockIdentity(user.privateKeyBox, pass),
          };
        } else {
          identity = await Crypto.createIdentity(pass);
          if (!identity?.privateKeyBox || !identity?.publicKey || !identity?.keyId) {
            throw new Error("Gagal membuat identitas keamanan akun.");
          }
          securityPatch = {
            publicKey: identity.publicKey,
            keyId: identity.keyId,
            privateKeyBox: identity.privateKeyBox,
          };
        }
      } catch {
        setErr("Gagal menyiapkan identitas keamanan akun.");
        setBusy(false);
        return;
      }

      if (!user.hasRecovery) {
        if (!identity.privateKeyBox) {
          throw new Error("Kunci keamanan akun belum tersedia.");
        }

        const recovery = await Crypto.createRecoveryBundle(
          identity.privateKeyBox,
          pass
        );

        const bootstrap = await IDB.bootstrapSecurity({
          publicKey: identity.publicKey,
          keyId: identity.keyId,
          privateKeyBox: identity.privateKeyBox,
          recoveryHash: recovery.recoveryHash,
          recoveryKeyBox: recovery.recoveryKeyBox,
        });

        setRecoveryNotice(recovery.recoveryKey);
        setPendingSession(sessionFromUser(
          { ...user, ...bootstrap, hasRecovery: true },
          pass,
          identity.privateKey
        ));
      } else {
        if (Object.keys(securityPatch).length) {
          await IDB.updateUser(user.username, securityPatch);
        }
        onLogin(sessionFromUser(
          { ...user, ...securityPatch },
          pass,
          identity.privateKey
        ));
      }
    } catch (e) {
      setErr(e.message || "Username atau kata kunci salah.");
    }
    setBusy(false);
  };

  const handleRegister = async () => {
    setErr("");
    if (!username.trim()) {
      setErr("Username wajib diisi.");
      return;
    }
    const nextUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(nextUsername)) {
      setErr("Username 3 sampai 24 karakter: huruf kecil, angka, atau garis bawah.");
      return;
    }
    if (pass.length < 8) {
      setErr("Kata kunci minimal 8 karakter.");
      return;
    }
    if (pass !== pass2) {
      setErr("Konfirmasi kata kunci tidak cocok.");
      return;
    }

    setBusy(true);
    try {
      const passHash = await Crypto.hashPass(pass);
      const identity = await Crypto.createIdentity(pass);
      const recovery = await Crypto.createRecoveryBundle(identity.privateKeyBox, pass);

      const user = await IDB.register({
        username: nextUsername,
        passHash,
        publicKey: identity.publicKey,
        keyId: identity.keyId,
        privateKeyBox: identity.privateKeyBox,
        recoveryHash: recovery.recoveryHash,
        recoveryKeyBox: recovery.recoveryKeyBox,
        createdAt: new Date().toISOString(),
      });

      setRecoveryNotice(recovery.recoveryKey);
      setUsername(user.username);
      setRecoveryKey(recovery.recoveryKey);
      setPendingSession(sessionFromUser(user, pass, identity.privateKey));
    } catch (e) {
      setErr(e.message || "Gagal membuat akun.");
    }
    setBusy(false);
  };

  const finishRegistration = () => {
    const pending = pendingSession;
    setPendingSession(null);
    setRecoveryNotice("");
    if (pending) onLogin(pending);
  };

  const handleRecover = async () => {
    setErr("");
    const name = username.trim().toLowerCase();
    const key = recoveryKey.trim().toLowerCase();
    if (!name || !key) {
      setErr("Isi username dan Recovery Key.");
      return;
    }
    if (!/^[a-f0-9]{64}$/.test(key)) {
      setErr("Recovery Key tidak valid.");
      return;
    }
    if (pass.length < 8) {
      setErr("Kata kunci baru minimal 8 karakter.");
      return;
    }
    if (pass !== pass2) {
      setErr("Konfirmasi kata kunci tidak cocok.");
      return;
    }

    setBusy(true);
    try {
      const recoveryHash = await Crypto.hashRecoveryKey(key);
      const user = await IDB.recover(name, recoveryHash);
      const identityPrivateKey = await Crypto.unlockIdentityWithRecovery(
        user.recoveryKeyBox,
        key
      );
      const privateKeyBox = await Crypto.rewrapRecoveryAsIdentity(
        user.recoveryKeyBox,
        key,
        pass
      );

      await IDB.updateUser(user.username, {
        passHash: await Crypto.hashPass(pass),
        privateKeyBox,
      });

      onLogin(sessionFromUser(user, pass, identityPrivateKey));
    } catch (e) {
      setErr(e.message || "Recovery gagal. Periksa Recovery Key.");
    }
    setBusy(false);
  };

  const switchTab = next => {
    setTab(next);
    setErr("");
    setRecoveryNotice("");
    setPass("");
    setPass2("");
    setRecoveryKey("");
  };

  const submit = () => {
    if (tab === "login") return handleLogin();
    if (tab === "register") return handleRegister();
    return handleRecover();
  };

  const onEnter = e => e.key === "Enter" && submit();

  if (recoveryNotice) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-title">Akun berhasil disiapkan</div>
          <div style={{ fontWeight: 600, marginTop: 18, marginBottom: 8 }}>Simpan Recovery Key</div>
          <div className="auth-sub">
            Akun lama Anda sudah berhasil dilengkapi fitur pemulihan. Data dan arsip lama tetap dipertahankan.
          </div>
          <div className="recovery-key">{recoveryNotice}</div>
          <div className="note" style={{ marginTop: 16 }}>
            Simpan Recovery Key di tempat pribadi yang aman. Recovery Key tidak dapat ditampilkan kembali oleh MassiveArchive.
          </div>
          <button className="btn btn-p" style={{ width: "100%", marginTop: 18 }}
            onClick={finishRegistration}>
            Saya sudah menyimpannya
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-title">MassiveArchive</div>
        <div className="auth-sub">Arsip terenkripsi di perangkat Anda.</div>

        <div className="seg">
          <button className={tab === "login" ? "act" : ""}
            onClick={() => switchTab("login")}>Masuk</button>
          <button className={tab === "register" ? "act" : ""}
            onClick={() => switchTab("register")}>Daftar</button>
          <button className={tab === "recover" ? "act" : ""}
            onClick={() => switchTab("recover")}>Pulihkan</button>
        </div>

        <div className="auth-fields">
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={onEnter} autoComplete="username" />
          </div>

          {tab === "recover" && (
            <div className="field">
              <label>Recovery Key</label>
              <input value={recoveryKey} onChange={e => setRecoveryKey(e.target.value)}
                onKeyDown={onEnter} autoComplete="off" />
            </div>
          )}

          {tab !== "recover" ? (
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
          ) : (
            <div className="field">
              <label>Kata kunci baru</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                onKeyDown={onEnter} autoComplete="new-password" />
            </div>
          )}

          {(tab === "register" || tab === "recover") && (
            <div className="field">
              <label>Ulangi kata kunci {tab === "recover" ? "baru" : ""}</label>
              <input type={showP ? "text" : "password"} value={pass2}
                onChange={e => setPass2(e.target.value)} onKeyDown={onEnter}
                autoComplete="new-password" />
            </div>
          )}
        </div>

        {err && <div className="err">{err}</div>}

        <button className="btn btn-p" style={{ width: "100%", marginTop: 20 }}
          onClick={submit} disabled={busy}>
          {busy ? "Memproses..." :
            tab === "login" ? "Masuk" :
            tab === "register" ? "Buat akun" : "Pulihkan akun"}
        </button>

        {tab === "register" && (
          <div className="hint">
            Recovery Key akan dibuat sekali setelah akun berhasil dibuat.
          </div>
        )}
        {tab === "recover" && (
          <div className="hint">
            Recovery Key digunakan untuk membuat kata kunci baru tanpa kata kunci lama.
          </div>
        )}
      </div>
    </div>
  );
}
