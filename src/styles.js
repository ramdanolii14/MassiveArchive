export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --ink:#1c1f24;
  --ink2:#4a5058;
  --ink3:#7b828c;
  --ink4:#a3a9b2;
  --line:rgba(28,31,36,.09);
  --glass:rgba(255,255,255,.55);
  --glass2:rgba(255,255,255,.78);
  --glass-edge:rgba(255,255,255,.85);
  --accent:#23272e;
  --danger:#8f3a3a;
  --r:20px;
  --r2:12px;
  --blur:blur(22px) saturate(150%);
  --shadow:0 8px 32px rgba(40,46,58,.08),0 1px 2px rgba(40,46,58,.05);
  --font:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
}

html{background:#e9ebef}
body{
  font-family:var(--font);font-size:14px;line-height:1.55;color:var(--ink);
  min-height:100vh;background:transparent;-webkit-font-smoothing:antialiased;
}
body::before{
  content:'';position:fixed;inset:0;z-index:-1;
  background:
    radial-gradient(520px 420px at 10% 12%,rgba(255,255,255,1),transparent 70%),
    radial-gradient(560px 480px at 88% 14%,rgba(176,181,190,.9),transparent 70%),
    radial-gradient(520px 460px at 62% 62%,rgba(255,255,255,.95),transparent 70%),
    radial-gradient(520px 480px at 8% 88%,rgba(168,173,182,.85),transparent 70%),
    radial-gradient(420px 380px at 94% 92%,rgba(190,194,202,.8),transparent 70%),
    linear-gradient(160deg,#f0f2f5,#d9dce2);
}
button,input,select,textarea{font-family:inherit;color:inherit}

/* auth */
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.auth-card{
  width:100%;max-width:400px;padding:36px 32px;border-radius:var(--r);
  background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);
  border:1px solid var(--glass-edge);box-shadow:var(--shadow);
}
.auth-title{font-size:22px;font-weight:600;letter-spacing:-.02em}
.auth-sub{color:var(--ink3);margin:4px 0 24px}
.seg{display:flex;padding:3px;border-radius:var(--r2);background:rgba(28,31,36,.06);margin-bottom:20px}
.seg button{
  flex:1;padding:8px;border:none;background:none;border-radius:9px;cursor:pointer;
  font-size:13.5px;color:var(--ink3);transition:all .15s;
}
.seg button.act{background:var(--glass2);color:var(--ink);box-shadow:0 1px 3px rgba(40,46,58,.1)}
.auth-fields{display:flex;flex-direction:column;gap:14px}
.err{margin-top:14px;padding:10px 12px;border-radius:var(--r2);background:rgba(143,58,58,.08);color:var(--danger);font-size:13px}
.hint{margin-top:14px;font-size:12.5px;color:var(--ink3)}

/* layout */
.app{display:flex;min-height:100vh}
.sb{
  position:fixed;left:16px;top:16px;bottom:16px;width:216px;z-index:100;
  display:flex;flex-direction:column;padding:22px 14px 16px;border-radius:var(--r);
  background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);
  border:1px solid var(--glass-edge);box-shadow:var(--shadow);
}
.sb-brand{font-size:16px;font-weight:600;letter-spacing:-.02em;padding:0 10px 18px}
.sb-nav{display:flex;flex-direction:column;gap:2px;flex:1}
.nav-item{
  display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;
  padding:9px 12px;border:none;background:none;border-radius:var(--r2);cursor:pointer;
  font-size:14px;color:var(--ink2);transition:background .12s,color .12s;
}
.nav-item:hover{background:rgba(255,255,255,.6)}
.nav-item.act{background:var(--glass2);color:var(--ink);font-weight:500;box-shadow:0 1px 3px rgba(40,46,58,.08)}
.nav-count{
  min-width:20px;padding:0 6px;border-radius:10px;background:var(--accent);color:#fff;
  font-size:11px;line-height:20px;text-align:center;
}
.sb-user{display:flex;align-items:center;gap:10px;padding:12px 10px 0;border-top:1px solid var(--line)}
.sb-uname{flex:1;font-size:13px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.main{margin-left:248px;flex:1;min-width:0;display:flex;flex-direction:column;min-height:100vh}
.topbar{display:flex;align-items:center;gap:12px;padding:20px 28px 8px;position:sticky;top:0;z-index:50}
.topbar-title{font-size:20px;font-weight:600;letter-spacing:-.02em;flex:1}
.page{padding:12px 28px 40px;flex:1}

/* panels */
.panel{
  border-radius:var(--r);background:var(--glass);
  backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);
  border:1px solid var(--glass-edge);box-shadow:var(--shadow);
}
.pad{padding:22px 24px}
.stack{display:flex;flex-direction:column;gap:16px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px}
.stat{padding:18px 20px}
.stat-lbl{font-size:12.5px;color:var(--ink3);margin-bottom:6px}
.stat-val{font-size:26px;font-weight:600;letter-spacing:-.02em;line-height:1.1}
.sec-hdr{display:flex;align-items:center;justify-content:space-between;margin:4px 2px 12px}
.sec-title{font-size:15px;font-weight:600}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.grow{flex:1}

/* table */
.tbl-wrap{overflow:hidden}
.tbl{width:100%;border-collapse:collapse}
.tbl th{
  text-align:left;font-weight:500;font-size:12.5px;color:var(--ink3);
  padding:14px 18px 10px;border-bottom:1px solid var(--line);
}
.tbl td{padding:14px 18px;border-bottom:1px solid var(--line);vertical-align:middle;color:var(--ink2)}
.tbl tbody tr{cursor:pointer;transition:background .12s}
.tbl tbody tr:hover{background:rgba(255,255,255,.55)}
.tbl tbody tr:last-child td{border-bottom:none}
.td-title{color:var(--ink);font-weight:500}
.td-sub{font-size:12.5px;color:var(--ink3);margin-top:2px}
.mono{font-variant-numeric:tabular-nums;white-space:nowrap}

/* badges */
.badge{
  display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;line-height:20px;
  background:rgba(28,31,36,.06);color:var(--ink2);
}
.badge-dark{background:var(--accent);color:#fff}
.badge-line{background:transparent;border:1px solid var(--line);color:var(--ink3)}

/* buttons */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 16px;
  border-radius:var(--r2);border:1px solid transparent;cursor:pointer;
  font-size:13.5px;font-weight:500;transition:all .14s;
}
.btn-p{background:var(--accent);color:#fff;box-shadow:0 4px 14px rgba(35,39,46,.22)}
.btn-p:hover{background:#383d46}
.btn-s{background:var(--glass2);border-color:var(--glass-edge);color:var(--ink);box-shadow:0 1px 3px rgba(40,46,58,.08)}
.btn-s:hover{background:#fff}
.btn-d{background:rgba(143,58,58,.08);color:var(--danger)}
.btn-d:hover{background:rgba(143,58,58,.14)}
.btn-g{background:transparent;color:var(--ink2)}
.btn-g:hover{background:rgba(255,255,255,.6)}
.btn-sm{padding:6px 12px;font-size:13px}
.btn:disabled{opacity:.45;cursor:not-allowed}

/* forms */
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.field{display:flex;flex-direction:column;gap:6px}
.field.full{grid-column:1/-1}
label{font-size:12.5px;color:var(--ink3);font-weight:500}
input,textarea,select{
  width:100%;padding:10px 13px;border-radius:var(--r2);border:1px solid var(--line);
  background:rgba(255,255,255,.7);font-size:14px;outline:none;transition:border-color .14s,box-shadow .14s,background .14s;
}
input::placeholder,textarea::placeholder{color:var(--ink4)}
input:focus,textarea:focus,select:focus{border-color:rgba(28,31,36,.35);background:#fff;box-shadow:0 0 0 4px rgba(28,31,36,.06)}
textarea{resize:vertical;min-height:84px}
.pw{position:relative}
.pw input{padding-right:64px}
.pw button{
  position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:none;
  font-size:12.5px;color:var(--ink3);cursor:pointer;padding:4px 6px;
}
.strength{height:3px;border-radius:2px;background:var(--line);overflow:hidden;margin-top:2px}
.strength div{height:100%;background:var(--accent);transition:width .2s}
.filters{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
.filters select,.filters input{width:auto;padding:8px 12px;font-size:13px}
.search{width:260px}

/* files */
.drop{
  padding:34px 20px;text-align:center;border-radius:var(--r2);cursor:pointer;
  border:1.5px dashed rgba(28,31,36,.18);background:rgba(255,255,255,.4);color:var(--ink3);transition:all .15s;
}
.drop:hover,.drop.dov{border-color:rgba(28,31,36,.45);background:rgba(255,255,255,.75);color:var(--ink)}
.drop u{text-underline-offset:3px}
.flist{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.fi{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--r2);background:rgba(255,255,255,.65);border:1px solid var(--line)}
.fi.marked{opacity:.45}
.fi.marked .fi-name{text-decoration:line-through}
.fi-type{min-width:38px;text-align:center;padding:2px 6px;border-radius:7px;background:rgba(28,31,36,.06);font-size:11px;color:var(--ink2);font-weight:500}
.fi-name{font-size:13.5px;color:var(--ink);word-break:break-all}
.fi-sz{font-size:12px;color:var(--ink3)}
.fcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.fcard{padding:16px 14px;border-radius:var(--r2);background:rgba(255,255,255,.65);border:1px solid var(--line);text-align:center}
.fcard .fi-type{display:inline-block;margin-bottom:10px}
.fcard-name{font-size:13px;word-break:break-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:2px}
.fcard-acts{display:flex;gap:6px;justify-content:center;margin-top:12px}

/* detail */
.dt-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
.dt-id{font-size:12.5px;color:var(--ink3);margin-bottom:4px}
.dt-title{font-size:24px;font-weight:600;letter-spacing:-.02em;line-height:1.25;margin-bottom:10px}
.dt-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 24px;margin-bottom:22px}
.df-lbl{font-size:12.5px;color:var(--ink3)}
.df-val{font-size:14.5px}
.note{padding:14px 16px;border-radius:var(--r2);background:rgba(255,255,255,.6);border:1px solid var(--line);color:var(--ink2);line-height:1.7;margin-bottom:16px}
.files-title{font-size:15px;font-weight:600;margin:26px 0 14px}
.locked{padding:22px;text-align:center;border-radius:var(--r2);background:rgba(255,255,255,.5);color:var(--ink3)}

/* modal, toast, confirm */
.ov{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(40,46,58,.28);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.modal{
  width:100%;max-width:860px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;
  border-radius:var(--r);background:var(--glass2);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);
  border:1px solid var(--glass-edge);box-shadow:0 20px 60px rgba(40,46,58,.25);
}
.modal-sm{max-width:440px}
.modal-hdr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--line)}
.modal-ttl{font-size:15px;font-weight:600;word-break:break-all}
.modal-body{flex:1;overflow:auto;padding:20px}
.toast{
  position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 18px;border-radius:var(--r2);
  background:rgba(28,31,36,.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  color:#fff;font-size:13.5px;box-shadow:0 10px 30px rgba(28,31,36,.3);animation:rise .2s ease;
}
.toast.err{background:rgba(143,58,58,.92)}
@keyframes rise{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
.cfm-box{width:100%;max-width:380px;padding:26px;border-radius:var(--r);background:var(--glass2);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--glass-edge);box-shadow:0 20px 60px rgba(40,46,58,.25)}
.cfm-box h3{font-size:17px;font-weight:600;margin-bottom:6px}
.cfm-box p{color:var(--ink3);margin-bottom:20px}
.cfm-acts{display:flex;gap:10px;justify-content:flex-end}

/* misc */
.empty{text-align:center;padding:56px 24px;color:var(--ink3)}
.empty h3{font-size:16px;font-weight:600;color:var(--ink2);margin-bottom:4px}
.loading{display:flex;justify-content:center;padding:56px;color:var(--ink3)}
.inbox-item{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--line);cursor:pointer;transition:background .12s}
.inbox-item:last-child{border-bottom:none}
.inbox-item:hover{background:rgba(255,255,255,.55)}
.inbox-from{font-size:12.5px;color:var(--ink3)}
.inbox-title{font-weight:500}
.inbox-msg{font-size:13px;color:var(--ink2);margin-top:2px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0}
img.img-thumb{max-width:100%;max-height:66vh;object-fit:contain;display:block;margin:0 auto;border-radius:10px}
video{width:100%;max-height:64vh;border-radius:10px}
iframe.pdf-frame{width:100%;height:64vh;border:none;border-radius:10px}
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-thumb{background:rgba(28,31,36,.18);border-radius:8px}
::-webkit-scrollbar-track{background:transparent}

/* dekripsi */
.dec-ov{z-index:3000;animation:decfade .2s ease .15s both}
.dec-card{
  width:100%;max-width:320px;padding:28px;text-align:center;border-radius:var(--r);
  background:var(--glass2);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);
  border:1px solid var(--glass-edge);box-shadow:0 20px 60px rgba(40,46,58,.25);
}
.dec-ring{
  width:34px;height:34px;margin:0 auto 16px;border-radius:50%;
  border:3px solid rgba(28,31,36,.12);border-top-color:var(--accent);animation:decspin .8s linear infinite;
}
.dec-title{font-weight:600}
.dec-name{font-size:13px;color:var(--ink3);margin-top:2px;word-break:break-all}
.dec-bar{height:4px;border-radius:4px;background:rgba(28,31,36,.08);overflow:hidden;margin-top:18px}
.dec-bar div{width:40%;height:100%;border-radius:4px;background:var(--accent);animation:decslide 1.1s ease-in-out infinite}
@keyframes decfade{from{opacity:0}to{opacity:1}}
@keyframes decspin{to{transform:rotate(360deg)}}
@keyframes decslide{from{transform:translateX(-100%)}to{transform:translateX(250%)}}

/* profile, avatar, storage */
.avatar{
  width:44px;height:44px;border-radius:50%;flex-shrink:0;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.8);border:1px solid var(--glass-edge);
  box-shadow:0 2px 8px rgba(40,46,58,.12);font-weight:600;font-size:16px;color:var(--ink2);
}
.avatar img{width:100%;height:100%;object-fit:cover;display:block}
.avatar-lg{width:88px;height:88px;font-size:32px}
.dash-head{display:flex;align-items:center;gap:14px;margin:0 2px 20px}
.dash-name{font-size:17px;font-weight:600;letter-spacing:-.01em}
.profile-head{display:flex;align-items:center;gap:20px}
.owner-cell{display:flex;align-items:center;gap:9px;min-width:0}
.owner-cell .avatar{width:34px;height:34px;font-size:13px}
.archive-uploader{display:flex;align-items:center;gap:10px;margin:10px 0 14px}
.archive-uploader .avatar{width:40px;height:40px;font-size:14px}
.archive-uploader-label{font-size:11px;color:var(--ink3);line-height:1.2}
.archive-uploader-name{font-size:13.5px;font-weight:600;color:var(--ink2);line-height:1.35}
.capsule{display:flex;height:14px;border-radius:999px;overflow:hidden;background:rgba(28,31,36,.08)}
.cap-db{background:var(--accent)}
.cap-other{background:rgba(28,31,36,.28)}
.cap-legend{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--ink3)}
.cap-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:rgba(28,31,36,.08);border:1px solid var(--line)}
.cap-legend i.db{background:var(--accent);border-color:var(--accent)}
.cap-legend i.other{background:rgba(28,31,36,.28);border-color:transparent}
.cap-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}

@media (max-width:860px){
  .sb{position:static;width:auto;margin:12px 12px 0;flex-direction:row;align-items:center;padding:10px 12px;gap:8px;overflow-x:auto}
  .sb-brand{display:none}
  .sb-nav{flex-direction:row;flex:1}
  .nav-item{white-space:nowrap;width:auto}
  .sb-user{border:none;padding:0}
  .app{flex-direction:column}
  .main{margin-left:0}
  .topbar,.page{padding-left:16px;padding-right:16px}
  .stats,.fgrid,.dt-grid{grid-template-columns:1fr}
  .search{width:100%}
  .topbar{flex-wrap:wrap}
}
`;