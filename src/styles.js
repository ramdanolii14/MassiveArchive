export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;600&family=Source+Code+Pro:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#f5f2ec;
  --bg2:#ede9e1;
  --bg3:#e4dfd5;
  --ink:#1a1815;
  --ink2:#3d3a35;
  --ink3:#6b6760;
  --ink4:#9b9892;
  --rule:#c8c2b8;
  --rule2:#d9d4cc;
  --gold:#8b6914;
  --gold2:#b08a2a;
  --gold3:#c9a84c;
  --gold-bg:#f9f4e8;
  --red:#7a1e1e;
  --red-bg:#fdf2f2;
  --green:#1e5c2e;
  --green-bg:#f2faf4;
  --blue:#1a3a6b;
  --blue-bg:#f0f4fb;
  --seal:#3d1a0a;
  --fh:'Libre Baskerville',serif;
  --fb:'Source Sans 3',sans-serif;
  --fm:'Source Code Pro',monospace;
  --radius:3px;
  --shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.06);
  --shadow2:0 4px 12px rgba(0,0,0,.1),0 2px 4px rgba(0,0,0,.06);
}

body{
  background:var(--bg);
  color:var(--ink);
  font-family:var(--fb);
  font-size:15px;
  line-height:1.6;
  min-height:100vh;
}

/* ── WELCOME SCREEN ── */
.welcome-wrap{min-height:100vh;background:var(--bg);display:flex;align-items:stretch}
.welcome-left{
  width:420px;min-height:100vh;background:var(--seal);
  display:flex;flex-direction:column;padding:60px 48px;
  position:relative;overflow:hidden;
}
.welcome-left::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.03) 39px,rgba(255,255,255,.03) 40px);
}
.welcome-seal{
  width:72px;height:72px;border:2px solid rgba(255,255,255,.3);border-radius:50%;
  display:flex;align-items:center;justify-content:center;margin-bottom:36px;
  font-family:var(--fm);font-size:10px;color:rgba(255,255,255,.5);letter-spacing:.15em;text-transform:uppercase;
}
.welcome-brand{font-family:var(--fh);font-size:26px;color:#fff;line-height:1.2;margin-bottom:10px}
.welcome-brand span{
  display:block;font-size:13px;font-family:var(--fm);
  color:rgba(255,255,255,.45);font-weight:400;letter-spacing:.1em;margin-top:6px;
}
.welcome-desc{
  color:rgba(255,255,255,.5);font-size:13.5px;line-height:1.75;
  margin-top:auto;padding-top:48px;border-top:1px solid rgba(255,255,255,.1);
}
.welcome-right{flex:1;display:flex;align-items:center;justify-content:center;padding:48px}
.welcome-card{width:100%;max-width:440px}
.welcome-card h2{font-family:var(--fh);font-size:24px;color:var(--ink);margin-bottom:6px}
.welcome-card .sub{
  color:var(--ink3);font-size:13.5px;margin-bottom:36px;
  padding-bottom:24px;border-bottom:1px solid var(--rule);
}
.wc-tabs{
  display:flex;gap:0;margin-bottom:28px;
  border:1px solid var(--rule);border-radius:var(--radius);overflow:hidden;
}
.wc-tab{
  flex:1;padding:9px;background:var(--bg2);border:none;cursor:pointer;
  font-family:var(--fb);font-size:13.5px;color:var(--ink3);transition:all .15s;
}
.wc-tab.act{background:var(--seal);color:#fff}

/* ── LAYOUT ── */
.app{display:flex;min-height:100vh}
.sb{
  width:240px;min-height:100vh;background:var(--seal);
  display:flex;flex-direction:column;position:fixed;left:0;top:0;bottom:0;z-index:100;
}
.sb-head{padding:28px 22px 22px;border-bottom:1px solid rgba(255,255,255,.1)}
.sb-logo{font-family:var(--fh);font-size:17px;color:#fff;line-height:1.3}
.sb-logo small{
  display:block;font-family:var(--fm);font-size:10px;
  color:rgba(255,255,255,.38);letter-spacing:.1em;font-weight:400;margin-top:4px;text-transform:uppercase;
}
.sb-user{
  margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;gap:10px;
}
.sb-avatar{
  width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;
  font-family:var(--fh);font-size:13px;color:#fff;flex-shrink:0;
}
.sb-uname{font-size:13px;color:rgba(255,255,255,.7);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-nav{padding:18px 10px;flex:1;overflow-y:auto}
.sb-sec{margin-bottom:20px}
.sb-sec-lbl{
  font-family:var(--fm);font-size:9.5px;color:rgba(255,255,255,.3);
  text-transform:uppercase;letter-spacing:.13em;padding:0 12px;margin-bottom:5px;
}
.nav-item{
  display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:2px;
  cursor:pointer;color:rgba(255,255,255,.55);font-size:13.5px;transition:all .12s;
  border-left:2px solid transparent;margin-bottom:1px;
}
.nav-item:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.85)}
.nav-item.act{background:rgba(255,255,255,.1);color:#fff;border-left-color:var(--gold3)}
.nav-ic{width:16px;text-align:center;font-size:13px;font-family:var(--fm);flex-shrink:0}
.sb-foot{
  padding:16px 22px;border-top:1px solid rgba(255,255,255,.08);
  font-family:var(--fm);font-size:10px;color:rgba(255,255,255,.25);line-height:2;
}
.main{margin-left:240px;flex:1;min-height:100vh;display:flex;flex-direction:column}
.topbar{
  height:54px;background:var(--bg);border-bottom:2px solid var(--ink);
  display:flex;align-items:center;padding:0 28px;gap:14px;position:sticky;top:0;z-index:50;
}
.topbar-title{font-family:var(--fh);font-size:14px;color:var(--ink);flex:1;letter-spacing:.02em}
.searchbar{
  display:flex;align-items:center;gap:8px;background:#fff;
  border:1px solid var(--rule);padding:6px 12px;width:280px;
}
.searchbar input{
  background:none;border:none;outline:none;
  color:var(--ink);font-family:var(--fb);font-size:13.5px;width:100%;
}
.searchbar input::placeholder{color:var(--ink4)}
.page{padding:28px 32px;flex:1}

/* ── STATS ── */
.stats{
  display:grid;grid-template-columns:repeat(4,1fr);gap:1px;
  background:var(--rule);border:1px solid var(--rule);margin-bottom:28px;
}
.stat{background:var(--bg);padding:20px 22px}
.stat-lbl{font-family:var(--fm);font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink4);margin-bottom:8px}
.stat-val{font-family:var(--fh);font-size:28px;color:var(--ink);line-height:1}
.stat-sub{font-size:11.5px;color:var(--ink4);margin-top:4px}

/* ── GLOBAL STATS BANNER ── */
.global-stats{
  display:grid;grid-template-columns:repeat(3,1fr);gap:1px;
  background:var(--ink);border:1px solid var(--ink);margin-bottom:28px;
}
.global-stat{background:var(--ink);padding:16px 20px;text-align:center}
.global-stat-lbl{font-family:var(--fm);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.4);margin-bottom:6px}
.global-stat-val{font-family:var(--fh);font-size:22px;color:#fff;line-height:1}
.global-stat-sub{font-size:11px;color:rgba(255,255,255,.35);margin-top:3px}

/* ── SECTION HEADER ── */
.sec-hdr{
  display:flex;align-items:flex-end;justify-content:space-between;
  margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--ink);
}
.sec-title{font-family:var(--fh);font-size:18px;color:var(--ink)}
.sec-sub{font-family:var(--fm);font-size:11px;color:var(--ink4);margin-top:2px;letter-spacing:.03em}

/* ── TABLE ── */
.arc-table{width:100%;border-collapse:collapse}
.arc-table thead tr{background:var(--ink)}
.arc-table thead th{
  font-family:var(--fm);font-size:9.5px;text-transform:uppercase;
  letter-spacing:.1em;color:rgba(255,255,255,.7);padding:9px 14px;text-align:left;font-weight:400;
}
.arc-table tbody tr{border-bottom:1px solid var(--rule2);cursor:pointer;transition:background .1s}
.arc-table tbody tr:hover{background:var(--gold-bg)}
.arc-table td{padding:12px 14px;font-size:13.5px;color:var(--ink2);vertical-align:top}
.td-id{font-family:var(--fm);font-size:11.5px;color:var(--gold);white-space:nowrap}
.td-title{font-family:var(--fh);font-size:14.5px;color:var(--ink)}
.td-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.td-locked{font-family:var(--fm);font-size:10px;color:var(--ink4);display:flex;align-items:center;gap:4px;margin-top:3px}

/* ── BADGES ── */
.badge{display:inline-block;font-family:var(--fm);font-size:10px;padding:2px 7px;text-transform:uppercase;letter-spacing:.07em;border:1px solid}
.badge-cat{background:var(--gold-bg);color:var(--gold);border-color:var(--gold3)}
.badge-aktif{background:var(--green-bg);color:var(--green);border-color:#7ec99a}
.badge-arsip{background:var(--gold-bg);color:var(--gold);border-color:var(--gold3)}
.badge-rahasia{background:var(--red-bg);color:var(--red);border-color:#e09090}
.badge-exp{background:var(--bg3);color:var(--ink3);border-color:var(--rule)}
.badge-shared{background:var(--blue-bg);color:var(--blue);border-color:#90ade0}
.badge-locked{background:var(--bg3);color:var(--ink4);border-color:var(--rule2)}

/* ── BUTTONS ── */
.btn{
  display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid;
  cursor:pointer;font-family:var(--fb);font-size:13.5px;font-weight:600;
  transition:all .12s;text-decoration:none;border-radius:var(--radius);
}
.btn-p{background:var(--seal);color:#fff;border-color:var(--seal)}
.btn-p:hover{background:#5a2a14;border-color:#5a2a14}
.btn-s{background:#fff;color:var(--ink);border-color:var(--rule)}
.btn-s:hover{background:var(--bg2);border-color:var(--rule2)}
.btn-d{background:var(--red-bg);color:var(--red);border-color:#e09090}
.btn-d:hover{background:#fce8e8}
.btn-g{background:transparent;color:var(--ink3);border-color:transparent}
.btn-g:hover{background:var(--bg2);color:var(--ink);border-color:var(--rule)}
.btn-share{background:var(--blue-bg);color:var(--blue);border-color:#90ade0}
.btn-share:hover{background:#e4ecf8}
.btn-sm{padding:5px 10px;font-size:12px}
.btn:disabled{opacity:.45;cursor:not-allowed}

/* ── FORMS ── */
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.fg{display:flex;flex-direction:column;gap:4px}
.fg.full{grid-column:1/-1}
label{font-family:var(--fm);font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink3)}
input,textarea,select{
  background:#fff;border:1px solid var(--rule);padding:8px 11px;
  color:var(--ink);font-family:var(--fb);font-size:14px;outline:none;
  transition:border-color .12s;border-radius:var(--radius);
}
input:focus,textarea:focus,select:focus{border-color:var(--ink)}
textarea{resize:vertical;min-height:80px}
select option{background:#fff;color:var(--ink)}
input[type=date]{color-scheme:light}

/* ── DROPZONE ── */
.drop-zone{
  border:1px dashed var(--rule);padding:32px;text-align:center;
  cursor:pointer;transition:all .15s;background:var(--bg2);
}
.drop-zone:hover,.drop-zone.dov{border-color:var(--ink);background:#fff}
.drop-zone p{color:var(--ink3);font-size:13.5px}
.drop-zone span{color:var(--gold);cursor:pointer;text-decoration:underline}
.flist{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.fi{
  display:flex;align-items:center;gap:10px;background:#fff;
  border:1px solid var(--rule2);padding:9px 12px;border-radius:var(--radius);
}
.fi-name{font-size:13px;color:var(--ink);flex:1}
.fi-sz{font-family:var(--fm);font-size:10.5px;color:var(--ink4)}
.fi-rm{background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;opacity:.5;transition:opacity .12s;font-family:var(--fm)}
.fi-rm:hover{opacity:1}
.fi-enc{font-family:var(--fm);font-size:9px;color:var(--green);background:var(--green-bg);padding:2px 5px;border:1px solid #7ec99a}

/* ── DETAIL ── */
.dt-hdr{
  display:flex;align-items:flex-start;justify-content:space-between;
  margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid var(--ink);
}
.dt-id{font-family:var(--fm);font-size:11px;color:var(--gold);margin-bottom:6px;letter-spacing:.05em}
.dt-title{font-family:var(--fh);font-size:24px;color:var(--ink);line-height:1.2;margin-bottom:10px}
.dt-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px}
.df{display:flex;flex-direction:column;gap:2px}
.df-lbl{font-family:var(--fm);font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink4)}
.df-val{font-size:14.5px;color:var(--ink)}

/* ── FILE CARDS ── */
.fgrid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.fcard{background:#fff;border:1px solid var(--rule);padding:14px 12px;cursor:pointer;transition:all .12s;text-align:center}
.fcard:hover{border-color:var(--ink);background:var(--gold-bg)}
.fcard-ico{font-family:var(--fm);font-size:10px;color:var(--ink4);margin-bottom:8px;text-transform:uppercase;letter-spacing:.1em}
.fcard-name{font-size:12px;color:var(--ink);word-break:break-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:4px}
.fcard-sz{font-family:var(--fm);font-size:10px;color:var(--ink4)}
.fcard-lock{font-family:var(--fm);font-size:9px;color:var(--green);margin-top:5px}
.files-sec h3{font-family:var(--fh);font-size:16px;color:var(--ink);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--rule)}

/* ── LOCKED OVERLAY ── */
.locked-notice{
  background:var(--bg3);border:1px solid var(--rule);padding:20px;text-align:center;
  margin-top:16px;
}
.locked-notice p{font-family:var(--fm);font-size:11px;color:var(--ink4);line-height:1.8}

/* ── MODAL ── */
.ov{
  position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;
  display:flex;align-items:center;justify-content:center;padding:24px;
}
.modal{
  background:var(--bg);border:1px solid var(--rule);border-top:3px solid var(--ink);
  width:100%;max-width:860px;max-height:90vh;display:flex;flex-direction:column;
  overflow:hidden;box-shadow:var(--shadow2);
}
.modal-hdr{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 20px;border-bottom:1px solid var(--rule);background:var(--bg);
}
.modal-ttl{font-family:var(--fh);font-size:15px;color:var(--ink)}
.modal-body{flex:1;overflow:auto;padding:20px}
.modal-sm{max-width:460px}

/* ── EMPTY ── */
.empty{text-align:center;padding:60px 32px;color:var(--ink4);border:1px dashed var(--rule);background:var(--bg2)}
.empty h3{font-family:var(--fh);font-size:18px;color:var(--ink3);margin-bottom:6px}

/* ── TOAST ── */
.toast{
  position:fixed;bottom:24px;right:24px;background:var(--ink);border-top:3px solid var(--gold3);
  padding:11px 18px;color:#fff;font-size:13px;z-index:9999;
  animation:fadeup .2s ease;box-shadow:var(--shadow2);font-family:var(--fb);
}
.toast.err{border-top-color:var(--red);background:var(--red)}
@keyframes fadeup{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}

/* ── CONFIRM ── */
.cfm-ov{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center}
.cfm-box{background:var(--bg);border:1px solid var(--rule);border-top:3px solid var(--red);padding:28px;max-width:380px;width:100%;box-shadow:var(--shadow2)}
.cfm-box h3{font-family:var(--fh);font-size:18px;color:var(--ink);margin-bottom:8px}
.cfm-box p{color:var(--ink3);font-size:13.5px;margin-bottom:20px}
.cfm-acts{display:flex;gap:10px}

/* ── MISC ── */
.divider{height:1px;background:var(--rule);margin:20px 0}
.filters{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.filter-s{padding:6px 10px;font-size:12.5px;background:#fff;border:1px solid var(--rule);color:var(--ink);font-family:var(--fm)}
.loading{display:flex;align-items:center;justify-content:center;padding:56px;color:var(--ink4);gap:10px;font-family:var(--fm);font-size:12px;letter-spacing:.05em}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--rule);border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:var(--rule2)}
.cat-bar{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--rule2);background:#fff}
.cat-bar:last-child{border-bottom:none}
.cat-cnt{font-family:var(--fm);font-size:10px;color:var(--gold)}
.sec-card{background:#fff;border:1px solid var(--rule)}
.sec-card-head{padding:12px 18px;border-bottom:1px solid var(--rule);background:var(--bg2);font-family:var(--fm);font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink3)}
img.img-thumb{max-width:100%;max-height:66vh;object-fit:contain;display:block;margin:0 auto}
video{width:100%;max-height:64vh}
iframe.pdf-frame{width:100%;height:64vh;border:none}
.inbox-item{display:flex;align-items:start;gap:14px;padding:14px 16px;border-bottom:1px solid var(--rule2);background:#fff;cursor:pointer;transition:background .1s}
.inbox-item:hover{background:var(--gold-bg)}
.inbox-item.unread{border-left:3px solid var(--gold)}
.inbox-from{font-family:var(--fm);font-size:11px;color:var(--gold);margin-bottom:3px}
.inbox-title{font-family:var(--fh);font-size:14.5px;color:var(--ink)}
.inbox-msg{font-size:12.5px;color:var(--ink3);margin-top:3px}
.pass-input-wrap{position:relative}
.pass-input-wrap input{padding-right:40px;width:100%}
.pass-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-family:var(--fm);font-size:10px;color:var(--ink4);padding:2px}
.strength-bar{height:2px;background:var(--rule);margin-top:5px;border-radius:1px;overflow:hidden}
.strength-fill{height:100%;transition:width .2s,background .2s;border-radius:1px}
.enc-notice{background:var(--green-bg);border:1px solid #7ec99a;padding:8px 12px;font-family:var(--fm);font-size:10.5px;color:var(--green);letter-spacing:.03em;display:flex;align-items:center;gap:8px;margin-bottom:14px}
`;
