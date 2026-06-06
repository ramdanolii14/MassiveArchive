import { useState } from "react";
import { IDB }         from "../database.js";
import { Crypto }      from "../crypto.js";
import { passStrength } from "../utils.js";

// ════════════════════════════════════════════════════════════════
// WELCOME / AUTH SCREEN
// ════════════════════════════════════════════════════════════════

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
      onLogin({ username: user.username, passphrase: pass });
    } catch { setErr("Terjadi kesalahan sistem."); }
    setBusy(false);
  };

  const handleRegister = async () => {
    setErr("");
    if (!username.trim()) { setErr("Username wajib diisi."); return; }
    if (!/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) {
      setErr("Username 3-24 karakter, huruf kecil/angka/garis bawah."); return;
    }
    if (pass.length < 8) { setErr("Kata kunci minimal 8 karakter."); return; }
    if (pass !== pass2)  { setErr("Konfirmasi kata kunci tidak cocok."); return; }
    setBusy(true);
    try {
      const exists = await IDB.getUser(username.trim().toLowerCase());
      if (exists) { setErr("Username sudah digunakan."); setBusy(false); return; }
      const passHash = await Crypto.hashPass(pass);
      await IDB.addUser({
        username:  username.trim().toLowerCase(),
        passHash,
        createdAt: new Date().toISOString(),
      });
      onLogin({ username: username.trim().toLowerCase(), passphrase: pass });
    } catch { setErr("Gagal membuat akun."); }
    setBusy(false);
  };

  return (
    <div className="welcome-wrap">
      <div className="welcome-left">
        <div className="welcome-seal">ARSIP</div>
        <div className="welcome-brand">
          Sistem Arsip Digital
          <span>DIGITAL ARCHIVE SYSTEM</span>
        </div>
        <div className="welcome-desc">
          Semua berkas dienkripsi dengan AES-256-GCM.<br/>
          Hanya pemegang kata kunci yang dapat membuka arsip.<br/><br/>
          Data tersimpan lokal di perangkat Anda.<br/>
          Tidak ada server. Tidak ada pihak ketiga.
        </div>
      </div>

      <div className="welcome-right">
        <div className="welcome-card">
          <h2>Akses Arsip</h2>
          <p className="sub">Masuk atau buat akun baru untuk menggunakan sistem arsip terenkripsi.</p>

          <div className="wc-tabs">
            <button className={`wc-tab${tab === "login" ? " act" : ""}`}
              onClick={() => { setTab("login"); setErr(""); }}>Masuk</button>
            <button className={`wc-tab${tab === "register" ? " act" : ""}`}
              onClick={() => { setTab("register"); setErr(""); }}>Daftar Akun</button>
          </div>

          <div className="fgrid" style={{ gridTemplateColumns: "1fr", gap: "14px" }}>
            <div className="fg">
              <label>Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="contoh: budi_santoso"
                onKeyDown={e => e.key === "Enter" && tab === "login" && handleLogin()}
                autoComplete="username"
              />
            </div>
            <div className="fg">
              <label>Kata Kunci Enkripsi</label>
              <div className="pass-input-wrap">
                <input
                  type={showP ? "text" : "password"}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder={tab === "login" ? "Masukkan kata kunci..." : "Buat kata kunci kuat..."}
                  onKeyDown={e => e.key === "Enter" && tab === "login" && handleLogin()}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                />
                <button className="pass-toggle" onClick={() => setShowP(p => !p)} type="button">
                  {showP ? "SEMB" : "LIHAT"}
                </button>
              </div>
              {tab === "register" && pass && (
                <>
                  <div className="strength-bar">
                    <div className="strength-fill"
                      style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }} />
                  </div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: "10px", color: strength.color, marginTop: "2px" }}>
                    {strength.label}
                  </div>
                </>
              )}
            </div>
            {tab === "register" && (
              <div className="fg">
                <label>Konfirmasi Kata Kunci</label>
                <input
                  type={showP ? "text" : "password"}
                  value={pass2}
                  onChange={e => setPass2(e.target.value)}
                  placeholder="Ulangi kata kunci..."
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>

          {err && (
            <div style={{
              marginTop: "14px", padding: "9px 12px",
              background: "var(--red-bg)", border: "1px solid #e09090",
              fontFamily: "var(--fm)", fontSize: "11.5px", color: "var(--red)",
            }}>{err}</div>
          )}

          <div style={{ marginTop: "20px" }}>
            {tab === "login"
              ? <button className="btn btn-p" style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleLogin} disabled={busy}>
                  {busy ? "Memverifikasi..." : "Masuk ke Arsip"}
                </button>
              : <button className="btn btn-p" style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleRegister} disabled={busy}>
                  {busy ? "Membuat Akun..." : "Buat Akun & Masuk"}
                </button>
            }
          </div>

          {tab === "register" && (
            <div style={{
              marginTop: "14px", fontFamily: "var(--fm)",
              fontSize: "10px", color: "var(--ink4)", lineHeight: "1.8",
            }}>
              CATATAN: Kata kunci digunakan untuk mengenkripsi seluruh berkas Anda.<br/>
              Jika kata kunci lupa, data tidak dapat dipulihkan. Simpan dengan baik.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
