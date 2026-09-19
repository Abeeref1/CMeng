export function cmengUatHtml(): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CMeng | Project Control</title>
<style>
:root{
  --bg:#eef2f6;--panel:#ffffff;--ink:#142033;--muted:#66758a;--line:#dce3ea;
  --accent:#2357d9;--accent-strong:#1946b8;--accent-soft:#eef4ff;--teal:#0f766e;
  --danger:#b42318;--warn:#b54708;--ok:#067647;--nav:#0b1424;--nav2:#16243a;
  --soft:#f7f9fc;--soft-blue:#f3f7ff;--shadow:0 1px 2px rgba(15,23,42,.025),0 4px 14px rgba(15,23,42,.035);
  --shadow-strong:0 10px 30px rgba(15,23,42,.06)
}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.48}
button,input,select{font:inherit}button{cursor:pointer}
.app{display:grid;grid-template-columns:258px minmax(0,1fr);min-height:100vh}
.sidebar{background:linear-gradient(180deg,#0b1424 0%,#111d31 100%);color:#fff;padding:20px 14px;position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid rgba(255,255,255,.05)}
.brand{display:flex;align-items:center;gap:12px;padding:2px 8px 20px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:20px}
.brand-mark{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(145deg,#2e66ed,#0f766e);box-shadow:0 8px 20px rgba(0,0,0,.2);font-size:14px;font-weight:850;letter-spacing:.04em}
.brand-copy h1{font-size:21px;line-height:1.05;margin:0 0 5px;letter-spacing:-.025em}.brand-copy p{margin:0;color:#9fb0c6;font-size:11.5px;line-height:1.35}
.nav-group{margin:20px 0}.nav-group-title{font-size:11px;color:#8292aa;text-transform:uppercase;letter-spacing:.095em;padding:0 10px 9px;font-weight:750}
.nav-item{width:100%;border:0;background:transparent;color:#c5d0df;text-align:left;padding:10px 11px;border-radius:9px;display:flex;align-items:center;justify-content:space-between;gap:9px;font-size:13.5px;font-weight:570;transition:.16s ease}
.nav-item:hover{background:rgba(255,255,255,.06);color:#fff}.nav-item.active{background:#213453;color:#fff;box-shadow:inset 3px 0 0 #4f7df1}
.nav-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status-dot{width:8px;height:8px;border-radius:50%;background:#63738b;flex:0 0 auto;box-shadow:0 0 0 3px rgba(255,255,255,.03)}.status-dot.ready{background:#32d583}.status-dot.partial{background:#fdb022}.status-dot.blocked{background:#f97066}
.main{min-width:0}.topbar{min-height:72px;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:11px;padding:12px 30px;position:sticky;top:0;z-index:10;box-shadow:0 1px 0 rgba(15,23,42,.02)}.topbar-context{display:flex;flex-direction:column;gap:1px;padding-left:14px;margin-left:2px;border-left:1px solid var(--line);min-width:150px}.topbar-context b{font-size:12px;color:#182438}.topbar-context span{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.055em;font-weight:750}.topbar-spacer{flex:1}.release-state{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#526176;white-space:nowrap}.release-state:before{content:"";width:7px;height:7px;border-radius:50%;background:#32d583;box-shadow:0 0 0 3px #ecfdf3}
.project-input{display:flex;align-items:center;gap:9px;min-width:350px}.project-input label{font-size:12px;color:var(--muted);font-weight:750;text-transform:uppercase;letter-spacing:.04em}.project-input input{height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 12px;min-width:220px;background:#fff;color:var(--ink);font-weight:650;outline:none}.project-input input:focus{border-color:#7aa2ff;box-shadow:0 0 0 3px rgba(35,87,217,.11)}
.btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:9px 14px;font-weight:700;font-size:13px;color:#334155;min-height:40px;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease,transform .15s ease}.btn:hover{background:#f8fafc;border-color:#b8c4d1}.btn:active{transform:translateY(1px)}.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 3px 10px rgba(35,87,217,.17)}.btn.primary:hover{background:var(--accent-strong);border-color:var(--accent-strong)}.btn.small{padding:7px 11px;font-size:12px;min-height:34px}.btn.active{background:#eef4ff;border-color:#b6caff;color:#1f4fb8}
.content{padding:28px 32px 64px;width:100%;max-width:none;margin:0}
.workspace-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.workspace-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}.quick-upload-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 16px;padding:12px 14px;border:1px solid #d8e3f3;border-left:4px solid var(--accent);border-radius:11px;background:#f8fbff;color:var(--ink)}.quick-upload-copy{min-width:0}.quick-upload-copy b{display:block;font-size:14px;margin-bottom:2px}.quick-upload-copy span{font-size:12px;color:var(--muted)}.quick-upload-actions{display:flex;gap:8px;flex:0 0 auto}.btn.upload-cta{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:none}.btn.upload-cta:hover{background:var(--accent-strong);border-color:var(--accent-strong)}.btn.ghost-dark{background:#fff;color:#334155;border-color:#cbd5e1}.btn.ghost-dark:hover{background:#f8fafc;border-color:#b8c4d1}.page-title{margin:0}.page-title .eyebrow,.section-kicker{display:block;font-size:11px;color:#617086;text-transform:uppercase;letter-spacing:.095em;font-weight:800;margin-bottom:6px}.page-title h2{font-size:29px;line-height:1.15;letter-spacing:-.035em;margin:0 0 7px}.page-title p{margin:0;color:var(--muted);font-size:14px;max-width:780px}
.grid{display:grid;gap:14px}.grid.kpi{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:16px}.grid.two{grid-template-columns:minmax(0,1.45fr) minmax(320px,1fr)}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow);padding:18px}.card h3{font-size:16px;line-height:1.25;margin:0 0 13px;letter-spacing:-.01em}.kpi-card{padding:17px 18px;min-height:112px}.kpi-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.055em;margin-bottom:9px;font-weight:750}.kpi-value{font-size:25px;font-weight:780;letter-spacing:-.035em;line-height:1.08}.kpi-sub{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.35}
.badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.045em;background:#f2f4f7;color:#475467;white-space:nowrap}.badge.ready{background:#ecfdf3;color:var(--ok)}.badge.partial{background:#fffaeb;color:var(--warn)}.badge.blocked{background:#fef3f2;color:var(--danger)}
.module-panel{padding:0;margin:0;overflow:hidden;border-radius:12px;box-shadow:var(--shadow-strong);min-height:560px;border-color:#d7e0e9}.module-panel>.module-head{padding:20px 22px 18px;border-bottom:1px solid var(--line);margin:0;background:linear-gradient(180deg,#fff,#fbfcfe)}.module-workspace-head>div{min-width:0}.module-workspace-head h3{font-size:24px;margin:0 0 4px;letter-spacing:-.025em}.module-workspace-head p{margin:0;color:var(--muted);font-size:13px}.module-panel #moduleContent{padding:22px;min-height:470px;background:#fbfcfe}
.module-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.module-head h3{font-size:18px;margin:0}
.director-section{margin-top:24px}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:14px;margin:0 0 12px}.section-heading h3{font-size:20px;margin:0 0 3px;letter-spacing:-.02em}.section-heading p{font-size:13px;color:var(--muted);margin:0}
.scalar-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:11px;margin-bottom:14px}.scalar{background:var(--soft);padding:13px 14px;border-radius:9px;border:1px solid #e7edf3;min-width:0}.scalar b{display:block;font-size:11.5px;color:var(--muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;font-weight:750}.scalar span{font-size:15px;font-weight:680;word-break:break-word}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px;max-height:min(66vh,680px);background:#fff;scrollbar-color:#c7d2df transparent;scrollbar-width:thin}table{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#f6f8fb;color:#46556a;font-weight:780;position:sticky;top:0;z-index:2;font-size:11.5px;letter-spacing:.025em;white-space:nowrap;text-transform:none}td{color:#27364a}tbody tr:nth-child(even) td{background:#fcfdff}tbody tr:hover td{background:#f6f9fd}tr:last-child td{border-bottom:0}.kpi-value,.position-value,.scalar span,.currency-line strong,.movement-value,.candidate-value{font-variant-numeric:tabular-nums}.module-panel{position:relative}.module-panel:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#2357d9,#0f766e);z-index:3}.module-basis{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.basis-chip{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:6px 9px;border:1px solid #dbe4ee;border-radius:9px;background:#fff;font-size:11.5px;color:#526176}.basis-chip b{font-size:10px;color:#738198;text-transform:uppercase;letter-spacing:.05em}.basis-chip strong{font-size:11.5px;color:#233149;font-weight:780}.focus-module .director-section,.focus-module .workspace-drawer,.focus-module .footer-note,.focus-module .workspace-header,.focus-module .quick-upload-bar{display:none}.focus-module .content{padding-top:18px}.focus-module .module-panel{min-height:calc(100vh - 112px)}.focus-module .module-panel #moduleContent{min-height:calc(100vh - 190px)}
.actions{display:flex;flex-direction:column;gap:8px}.action{padding:11px 13px;background:#fff8ed;border-left:3px solid #f79009;border-radius:7px;font-size:13px}
.empty{padding:34px;text-align:center;color:var(--muted);font-size:14px}.notice{padding:12px 14px;border-radius:9px;font-size:13px;margin:11px 0;line-height:1.45}.notice.info{background:#eff6ff;color:#1d4f91;border:1px solid #d9e8ff}.notice.warn{background:#fff9e8;color:#8a4b08;border:1px solid #f8e7b1}.notice.error{background:#fff1f0;color:#912018;border:1px solid #ffd8d3}
.upload-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.upload-box{border:1px solid #d9e2ec;border-radius:11px;padding:14px;background:#fafcff}.upload-box strong{font-size:13px;display:block;margin-bottom:5px}.upload-box small{color:var(--muted);display:block;margin-bottom:10px;line-height:1.45;font-size:12px}.upload-box input{width:100%;font-size:12px}.intent-control{display:flex;align-items:center;justify-content:space-between;gap:9px;margin:10px 0;padding:8px 9px;background:#f2f6fb;border-radius:8px}.intent-control span{font-size:11px;color:#607086;font-weight:750}.intent-control select{max-width:175px;height:32px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#334155;font-size:11.5px;padding:0 7px}
.wide-upload{margin-top:12px;border:1px solid #ccd9e8;border-radius:11px;padding:14px;background:#f7faff;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center}.wide-upload strong{font-size:13px;display:block;margin-bottom:4px}.wide-upload small{color:var(--muted);font-size:12px}.wide-upload input{font-size:12px;width:100%;margin-top:8px}
.queue{margin-top:9px;display:flex;flex-direction:column;gap:6px}.queue-row{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:8px;align-items:center;padding:8px 9px;border:1px solid var(--line);border-radius:7px;background:#fff}.queue-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.queue-row select{height:31px;border:1px solid #d0d5dd;border-radius:6px;font-size:11.5px}.upload-actions{display:flex;justify-content:flex-end;margin-top:10px}
.workspace-drawer{margin-top:20px;border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:var(--shadow);overflow:hidden}.workspace-drawer>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 18px;cursor:pointer;background:#fff}.workspace-drawer>summary::-webkit-details-marker{display:none}.workspace-drawer>summary strong{display:block;font-size:15px}.workspace-drawer>summary .section-kicker{margin-bottom:3px}.drawer-hint{font-size:12px;color:var(--accent);font-weight:750}.workspace-drawer[open] .drawer-hint{color:var(--muted)}.drawer-body{padding:0 18px 18px;background:#fbfcfe;border-top:1px solid var(--line)}.evidence-control-grid{grid-template-columns:minmax(280px,.62fr) minmax(0,1.5fr);align-items:start;padding-top:18px}.evidence-status-card{position:sticky;top:92px}.evidence-intake-card{min-width:0}
details:not(.workspace-drawer){border:1px solid var(--line);border-radius:9px;background:#fff}details:not(.workspace-drawer)>summary{padding:11px 13px;cursor:pointer;font-size:12.5px;font-weight:700}pre{margin:0;padding:13px;max-height:560px;overflow:auto;background:#0c1525;color:#d7e5ff;font-size:12px;line-height:1.55;border-radius:0 0 9px 9px;white-space:pre-wrap;word-break:break-word}
.currency-card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fff}.currency-code{font-size:17px;font-weight:820;margin-bottom:8px}.currency-line{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:5px 0;color:#526176}.currency-line strong{color:#152238}
.challenge-card{padding:0!important;overflow:hidden}.challenge-card .challenge-head{padding:17px 18px;border-bottom:1px solid var(--line)}.challenge-card .challenge-summary{padding:15px 18px 0}.challenge-card .challenge-table-wrap{margin:15px 18px 18px}.conflict-expand-row>td{padding:0;background:#f9fbff!important}.conflict-panel{padding:16px 18px;border-top:1px solid #dce7f5;border-bottom:1px solid #dce7f5;background:linear-gradient(180deg,#f8fbff,#f4f8ff)}.conflict-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.conflict-title strong{font-size:14px}.conflict-title p{margin:3px 0 0;color:var(--muted);font-size:12px}.candidate-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.candidate-card{border:1px solid #cedcf3;border-radius:10px;background:#fff;padding:13px}.candidate-card.recommended{border-color:#85a7f8;box-shadow:0 0 0 2px rgba(35,87,217,.08)}.candidate-value{font-size:20px;font-weight:790;letter-spacing:-.025em;margin:3px 0 9px}.candidate-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:11.5px;color:var(--muted)}.candidate-meta b{display:block;color:#435169;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}.candidate-sources{font-size:11.5px;color:#5d6b7e;margin-top:9px;word-break:break-word}.recommendation-card{margin-top:12px;padding:13px 14px;border-radius:10px;background:#eef4ff;border:1px solid #ccdcff;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.recommendation-card strong{display:block;font-size:16px;color:#173f9b;margin:3px 0}.recommendation-card p{margin:0;color:#53647b;font-size:12px;line-height:1.45}.recommendation-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:820;color:#315fbf}.decision-pill{flex:0 0 auto;background:#fff7e8;color:#8b4b08;border:1px solid #f6d99f;border-radius:999px;padding:6px 9px;font-size:10.5px;font-weight:820;text-transform:uppercase;letter-spacing:.04em}
.chart-card{margin-top:14px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}.chart-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#f8fafc}.chart-card-head h4{margin:0;font-size:14px}.chart-card-head p{margin:3px 0 0;color:var(--muted);font-size:12px}.chart-body{padding:14px 16px}.svg-chart{width:100%;min-width:620px;height:auto;display:block}.chart-scroll{overflow-x:auto}.chart-legend{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 10px}.legend-item{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#526176}.legend-dot{width:9px;height:9px;border-radius:50%}.domain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:11px}.domain-card{border:1px solid var(--line);border-radius:11px;background:#fff;padding:14px}.domain-card h5{margin:0 0 10px;font-size:14px}.domain-metric{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #edf1f5;font-size:12px;color:#5a687b}.domain-metric:last-child{border-bottom:0}.domain-metric strong{color:#182438;text-align:right}.position-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.position-card{border:1px solid var(--line);border-radius:10px;background:#fff;padding:13px}.position-card .position-label{font-size:10.5px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em}.position-card .position-value{font-size:19px;font-weight:780;margin:5px 0 3px;letter-spacing:-.02em}.position-card .position-sub{font-size:11.5px;color:var(--muted)}.readiness-table td{vertical-align:middle}.state-pill{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.035em}.state-pill.ready,.state-pill.included{background:#ecfdf3;color:#067647}.state-pill.blocked,.state-pill.excluded{background:#fef3f2;color:#b42318}.state-pill.conditional,.state-pill.review,.state-pill.unknown{background:#fffaeb;color:#b54708}.state-pill.not_applicable{background:#f2f4f7;color:#667085}.window-strip{display:grid;gap:10px}.window-card{display:grid;grid-template-columns:minmax(170px,.55fr) minmax(0,1fr) minmax(180px,.6fr);gap:13px;border:1px solid var(--line);border-radius:10px;padding:13px;background:#fff}.window-id{font-size:13px;font-weight:800}.window-dates{font-size:11.5px;color:var(--muted);margin-top:4px}.movement-value{font-size:22px;font-weight:780;letter-spacing:-.03em}.movement-label{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:750}.event-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.event-tag{font-size:10.5px;border:1px solid #d9e2ec;border-radius:999px;padding:3px 6px;background:#f8fafc;color:#526176}.data-section{margin-top:14px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}.data-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#f8fafc}.data-section-head h4{margin:0;font-size:14px;letter-spacing:-.01em}.data-section-body{padding:14px 16px}.value-list{display:flex;flex-wrap:wrap;gap:7px}.value-chip{display:inline-flex;padding:6px 9px;border:1px solid #d9e2ec;border-radius:8px;background:#f8fafc;font-size:12px;color:#435169}.nested-block{margin-top:12px}.nested-block:first-child{margin-top:0}.nested-title{font-size:12px;font-weight:800;color:#526176;margin:0 0 8px;text-transform:uppercase;letter-spacing:.045em}.cell-details summary{padding:4px 0!important;border:0!important;background:transparent!important}.cell-details pre{max-height:320px}.technical-payload{margin-top:16px}.footer-note{font-size:12px;color:var(--muted);margin-top:22px;padding:0 2px}.muted{color:var(--muted)}
.spinner{width:14px;height:14px;border:2px solid #d0d5dd;border-top-color:var(--accent);border-radius:50%;display:inline-block;animation:spin .7s linear infinite;vertical-align:-2px}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1280px){.app{grid-template-columns:238px minmax(0,1fr)}.grid.three{grid-template-columns:1fr 1fr}.upload-row{grid-template-columns:1fr}.evidence-control-grid{grid-template-columns:1fr}.evidence-status-card{position:static}}
@media(max-width:900px){.app{display:block}.sidebar{position:relative;height:auto}.topbar{position:relative;flex-wrap:wrap;padding:13px 18px}.content{padding:20px 18px 48px}.project-input{min-width:0;width:100%;flex-wrap:wrap}.workspace-header{align-items:center}.grid.two,.grid.three{grid-template-columns:1fr}.module-panel #moduleContent{padding:16px}.module-panel>.module-head{padding:17px}.candidate-grid{grid-template-columns:1fr}}
@media(max-width:620px){.workspace-header{display:block}.quick-upload-bar{display:block}.quick-upload-actions{margin-top:10px}.quick-upload-actions .btn{width:100%}.workspace-actions{justify-content:flex-start;margin-top:10px}.workspace-header .badge{margin-top:10px}.grid.kpi{grid-template-columns:1fr 1fr}.scalar-grid{grid-template-columns:1fr}.wide-upload{grid-template-columns:1fr}.queue-row{grid-template-columns:1fr}.recommendation-card{display:block}.decision-pill{display:inline-flex;margin-top:10px}}
</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand"><div class="brand-mark">CM</div><div class="brand-copy"><h1>CMeng</h1><p>Project Control Intelligence</p></div></div>
    <div id="nav"></div>
  </aside>
  <main class="main">
    <div class="topbar">
      <div class="project-input">
        <label>Project</label>
        <input id="projectId" value="UAT-DEMO" aria-label="Project ID">
      </div>
      <button class="btn primary" id="openEvidenceTop">Upload evidence</button>
      <button class="btn" id="loadDemo">Load certified demo</button>
      <button class="btn" id="refresh">Refresh</button>
      <button class="btn" id="focusMode" aria-pressed="false">Focus module</button>
      <div class="topbar-context"><span>Active module</span><b id="topbarModule">PMO Analysis</b></div>
      <div class="topbar-spacer"></div>
      <span id="releaseStatus" class="release-state">Production</span>
      <span id="globalStatus" style="font-size:12px;color:#667085"></span>
    </div>
    <div class="content">
      <div class="workspace-header">
        <div class="page-title">
          <span class="eyebrow">CMeng · controlled project intelligence</span>
          <h2>Project Control Workspace</h2>
          <p>Evidence-backed schedule, progress, forecast, claims and commercial analysis. Select a module on the left to work directly in the active analysis.</p>
        </div>
        <div class="workspace-actions">
          <button class="btn primary" id="openEvidenceHero">Upload evidence</button>
          <span id="projectBadge" class="badge">No project</span>
        </div>
      </div>

      <div class="quick-upload-bar">
        <div class="quick-upload-copy"><b>Start with project evidence</b><span>Upload schedules, BOQ, contracts, claims, registers, reports or a complete ZIP evidence pack.</span></div>
        <div class="quick-upload-actions">
          <button class="btn upload-cta" id="openEvidenceQuick">Upload files</button>
          <button class="btn ghost-dark" id="openLibraryQuick">Evidence library</button>
        </div>
      </div>

      <section class="card module-panel module-workspace">
        <div class="module-head module-workspace-head">
          <div>
            <span class="section-kicker">Active module</span>
            <h3 id="moduleTitle">Schedule module</h3>
            <p>Calculated position, evidence basis, contradictions, consequences and required action.</p>
          </div>
          <span id="moduleBadge" class="badge">Select a module</span>
        </div>
        <div id="moduleContent" class="empty">Choose a module from the left navigation.</div>
      </section>

      <details class="workspace-drawer" id="evidenceControlDrawer" open>
        <summary>
          <div><span class="section-kicker">Evidence & uploads</span><strong>Upload project files and control the active basis</strong></div>
          <span class="drawer-hint">Open workspace</span>
        </summary>
        <div class="drawer-body">
          <div class="grid evidence-control-grid">
            <section class="card evidence-status-card">
              <div class="module-head"><h3>Project evidence status</h3><span class="badge">Control basis</span></div>
              <div id="projectStatus" class="empty">Load the demo or upload project evidence.</div>
            </section>

            <section class="card evidence-intake-card">
              <h3>Evidence intake</h3>
              <div class="upload-row">
                <div class="upload-box">
                  <strong>Schedule revisions</strong>
                  <small>Select baseline, updates, revised baseline and recovery files together. CMeng verifies content and chronology; filenames are only hints.</small>
                  <div class="intent-control"><span>Upload intent</span><select id="scheduleIntent"><option value="add_update" selected>Add / update</option><option value="replace_current_basis">Replace current basis</option></select></div>
                  <input type="file" id="scheduleFiles" multiple accept=".xer,.xml,.xlsx,.xlsm,.csv">
                  <div id="scheduleQueue" class="queue"></div>
                  <div class="upload-actions"><button class="btn small primary" id="uploadSchedules">Upload schedule batch</button></div>
                </div>
                <div class="upload-box">
                  <strong>BOQ / quantity revisions</strong>
                  <small>Select one or more BOQ revisions. CMeng inspects the content and retains prior revisions rather than silently overwriting them.</small>
                  <div class="intent-control"><span>Upload intent</span><select id="boqIntent"><option value="add_update" selected>Add / update</option><option value="replace_current_basis">Replace current basis</option></select></div>
                  <input type="file" id="boqFiles" multiple accept=".csv,.xlsx,.xlsm,.pdf">
                  <div id="boqQueue" class="queue"></div>
                  <div class="upload-actions"><button class="btn small primary" id="uploadBoqs">Upload BOQ batch</button></div>
                </div>
                <div class="upload-box">
                  <strong>Contract family</strong>
                  <small>Select the main contract, amendments and appendices. Additive documents remain separate; replacement is an explicit user intent.</small>
                  <div class="intent-control"><span>Upload intent</span><select id="contractIntent"><option value="add_update" selected>Add / update</option><option value="replace_current_basis">Replace current basis</option></select></div>
                  <input type="file" id="contractFiles" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp">
                  <div id="contractQueue" class="queue"></div>
                  <div class="upload-actions"><button class="btn small primary" id="uploadContracts">Upload contract batch</button></div>
                </div>
              </div>

              <div class="wide-upload">
                <div>
                  <strong>Full evidence pack / supporting documents</strong>
                  <small>Upload ZIP or multiple files covering cost/EVM, payment, variations, claims, risk, procurement, RFI, submittals, design, HSE, NCR, FM/assets, ORAT and other control evidence.</small>
                  <div class="intent-control"><span>Batch intent</span><select id="evidenceIntent"><option value="add_update" selected>Add / update</option><option value="replace_current_basis">Replace current basis where applicable</option></select></div>
                  <input type="file" id="evidenceFiles" multiple accept=".zip,.csv,.pdf,.docx,.xlsx,.xlsm,.xer,.xml,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp">
                  <div id="evidenceQueue" class="queue"></div>
                </div>
                <button class="btn primary" id="uploadEvidence">Upload evidence</button>
              </div>
              <div id="uploadMessage"></div>
            </section>
          </div>
        </div>
      </details>

      <details class="workspace-drawer director-section" id="directorDrawer">
        <summary>
          <div><span class="section-kicker">Management position</span><strong>Project Director</strong></div>
          <span class="drawer-hint">Open management view</span>
        </summary>
        <div class="drawer-body" style="padding-top:18px">
          <section id="director"></section>
        </div>
      </details>

      <details class="workspace-drawer" id="evidenceLibraryDrawer">
        <summary>
          <div><span class="section-kicker">Traceability</span><strong>Evidence library & mapping</strong></div>
          <span id="evidenceBadge" class="badge">0 documents</span>
        </summary>
        <div class="drawer-body">
          <div id="evidenceLibrary" class="empty">No project evidence has been registered.</div>
        </div>
      </details>

      <div class="footer-note">CMeng retains source lineage, keeps missing evidence distinct from zero, keeps recovery schedules separate from the current programme, and never turns a recommendation into the governed basis without the required authority or user decision.</div>
    </div>
  </main>
</div>
<script>
const groups={
  "Analysis":["pmo-analysis","schedule-analytics","activity-analytics","lookahead-schedule","schedule-change-report","revision-trend","milestones","near-critical"],
  "Progress & Resources":["resource-utilization","progress-report","variance-trends","progress-scurve","quantity-scurve","progress-breakdown","manhour-scurve"],
  "Forecast":["forecast-history","independent-forecast"],
  "Claims & Contract":["delay-claims","notices-claims","windows-analysis","eot-assessment","challenge-contract"]
};
const names={
"pmo-analysis":"PMO Analysis","schedule-analytics":"Schedule Analytics","activity-analytics":"Activity Analytics","resource-utilization":"Resource Utilization","lookahead-schedule":"Look-Ahead Schedule","progress-report":"Progress Report","schedule-change-report":"Schedule Change Report","revision-trend":"Revision Trend","variance-trends":"Variance Trends","progress-scurve":"Progress S-Curve","quantity-scurve":"Quantity Installed S-Curve","progress-breakdown":"Progress Breakdown","milestones":"Milestones","near-critical":"Near-Critical Activities","manhour-scurve":"Man-Hour S-Curve","forecast-history":"Forecast History","independent-forecast":"Independent Forecast","delay-claims":"Delay & Claims","notices-claims":"Notices, EOT & Claims","windows-analysis":"Windows Analysis","eot-assessment":"EOT Assessment","challenge-contract":"Challenge the Contract"
};
let overview=null,selected="pmo-analysis";
let scheduleSelection=[],boqSelection=[],contractSelection=[],evidenceSelection=[];
const el=id=>document.getElementById(id);
const project=()=>el("projectId").value.trim()||"UAT-DEMO";
const fmt=v=>v===null||v===undefined?"—":typeof v==="number"?new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v):String(v);
const statusClass=s=>s==="ready"?"ready":s==="partial"?"partial":"blocked";
function setBusy(text){el("globalStatus").innerHTML=text?'<span class="spinner"></span> '+text:"";}
async function api(path,opts={}){const r=await fetch(path,opts);let data=null;try{data=await r.json()}catch{}if(!r.ok){const e=new Error(data?.error||data?.reason||("HTTP "+r.status));e.data=data;e.status=r.status;throw e}return data}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function fileType(file){const n=file.name.toLowerCase();if(n.endsWith(".zip"))return"application/zip";if(n.endsWith(".xer"))return"text/plain";if(n.endsWith(".xml"))return"application/xml";if(n.endsWith(".csv"))return"text/csv";if(n.endsWith(".pdf"))return"application/pdf";if(n.endsWith(".docx"))return"application/vnd.openxmlformats-officedocument.wordprocessingml.document";if(n.endsWith(".png"))return"image/png";if(n.endsWith(".jpg")||n.endsWith(".jpeg"))return"image/jpeg";if(n.endsWith(".tif")||n.endsWith(".tiff"))return"image/tiff";if(n.endsWith(".bmp"))return"image/bmp";if(n.endsWith(".webp"))return"image/webp";if(n.endsWith(".xlsm"))return"application/vnd.ms-excel.sheet.macroEnabled.12";return file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
function inferScheduleRole(name){const n=name.toLowerCase();if(n.includes("revised")&&n.includes("baseline"))return"revised_baseline";if(n.includes("recovery"))return"recovery";if(n.includes("baseline")||n.includes("rev0")||n.startsWith("s01_"))return"baseline";return"update"}
function inferContractRole(name){const n=name.toLowerCase();if(n.includes("amendment"))return"amendment";if(n.includes("appendix")||n.includes("technical"))return"appendix";if(n.includes("tender")||n.includes("employer_require"))return"tender";if(n.includes("main")||n.startsWith("c01_"))return"main";return"other"}
function renderNav(){const states=new Map((overview?.moduleStates||[]).map(x=>[x.key,x]));let html="";Object.entries(groups).forEach(([group,keys])=>{html+='<div class="nav-group"><div class="nav-group-title">'+group+'</div>';keys.forEach(key=>{const st=states.get(key)?.status||"blocked";html+='<button class="nav-item '+(selected===key?"active":"")+'" data-key="'+key+'" title="'+escapeHtml(names[key])+'"><span class="nav-label">'+names[key]+'</span><span class="status-dot '+statusClass(st)+'"></span></button>'});html+='</div>'});el("nav").innerHTML=html;document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{selected=b.dataset.key;localStorage.setItem("cmeng-module",selected);renderNav();loadModule(selected)})}
function scalarPairs(obj){if(!obj||typeof obj!=="object")return[];return Object.entries(obj).filter(([k,v])=>["string","number","boolean"].includes(typeof v)||v===null).slice(0,12)}
function renderUniversalChallenge(challenge){
  if(!challenge||!Array.isArray(challenge.items))return"";
  const show=v=>v===null||v===undefined?"—":fmt(v);
  const withUnit=(v,u)=>show(v)+(u?" "+u:"");
  const conflictPanel=(item)=>{
    const sub=item.submitted||{};
    const comparisons=Array.isArray(item.candidateComparisons)?item.candidateComparisons:[];
    const rec=item.conflictRecommendation||{};
    if(sub.state!=="conflicted"&&comparisons.length<2)return"";
    const assessed=Array.isArray(rec.candidates)?rec.candidates:[];
    const candidateCards=comparisons.map((candidate,index)=>{
      const score=assessed.find(x=>String(x.value)===String(candidate.submittedValue)&&String(x.unit||"")===String(candidate.submittedUnit||""))||assessed[index]||{};
      const sources=(candidate.sourceRefs||score.sourceRefs||[]).join(", ")||"Source lineage retained";
      const gap=candidate.comparable===false?"Not directly comparable":withUnit(candidate.gapValue,candidate.gapUnit);
      const evidenceScore=score.evidenceScore===undefined?"—":fmt(score.evidenceScore);
      const recommendationScore=score.recommendationScore===undefined?"—":fmt(score.recommendationScore);
      return '<div class="candidate-card '+(score.recommended?"recommended":"")+'">'+
        '<span class="section-kicker">Candidate '+escapeHtml(index+1)+(score.recommended?" · recommended":"")+'</span>'+
        '<div class="candidate-value">'+escapeHtml(withUnit(candidate.submittedValue,candidate.submittedUnit))+'</div>'+
        '<div class="candidate-meta">'+
          '<div><b>Independent gap</b>'+escapeHtml(gap)+'</div>'+
          '<div><b>Comparable</b>'+escapeHtml(candidate.comparable===false?"No":"Yes")+'</div>'+
          '<div><b>Evidence score</b>'+escapeHtml(evidenceScore)+'</div>'+
          '<div><b>Recommendation score</b>'+escapeHtml(recommendationScore)+'</div>'+
        '</div>'+
        '<div class="candidate-sources"><b>Evidence:</b> '+escapeHtml(sources)+(candidate.note?'<br>'+escapeHtml(candidate.note):'')+'</div>'+
      '</div>';
    }).join("");
    const hasRecommendation=rec.recommendedValue!==null&&rec.recommendedValue!==undefined;
    const recommendation=hasRecommendation?withUnit(rec.recommendedValue,rec.recommendedUnit):"No unique candidate";
    const rationale=Array.isArray(rec.rationale)?rec.rationale.join(" "):(rec.rationale||"All defensible candidates remain visible until the user determines the governed basis.");
    return '<div class="conflict-panel">'+
      '<div class="conflict-title"><div><strong>Contradictory evidence · parallel calculations retained</strong><p>CMeng calculates every defensible candidate separately. Contradiction does not make the metric unavailable.</p></div><span class="badge partial">Conflict</span></div>'+
      '<div class="candidate-grid">'+candidateCards+'</div>'+
      '<div class="recommendation-card"><div><span class="recommendation-label">CMeng recommendation</span><strong>'+escapeHtml(recommendation)+'</strong><p>'+escapeHtml(rationale)+'</p></div><span class="decision-pill">User decision required</span></div>'+
    '</div>';
  };
  const rows=challenge.items.map(item=>{
    const sub=item.submitted||{},ind=item.independent||{},gap=item.gap||{};
    const comparisons=Array.isArray(item.candidateComparisons)?item.candidateComparisons:[];
    const conflicted=sub.state==="conflicted"||comparisons.length>1;
    const submittedText=sub.state==="not_submitted"?"Not submitted":conflicted?"Contradictory · "+Math.max(comparisons.length,sub.alternatives?.length||0)+" candidates":withUnit(sub.value,sub.unit);
    const gapText=conflicted?"Parallel calculations below":withUnit(gap.value,gap.unit);
    const main='<tr>'+
      '<td><b>'+escapeHtml(item.label||item.metric)+'</b><br><span class="muted">'+escapeHtml(item.evidenceState||"")+'</span></td>'+
      '<td>'+escapeHtml(submittedText)+(sub.note?'<br><span class="muted">'+escapeHtml(sub.note)+'</span>':'')+'</td>'+
      '<td>'+escapeHtml(withUnit(ind.value,ind.unit))+'<br><span class="muted">'+escapeHtml(ind.state||"")+(ind.note?" · "+escapeHtml(ind.note):"")+'</span></td>'+
      '<td>'+escapeHtml(gapText)+(!conflicted&&gap.note?'<br><span class="muted">'+escapeHtml(gap.note)+'</span>':'')+'</td>'+
      '<td>'+escapeHtml(item.consequence||"—")+'</td>'+
      '<td>'+escapeHtml(item.action||"—")+'</td>'+
    '</tr>';
    const detail=conflictPanel(item);
    return main+(detail?'<tr class="conflict-expand-row"><td colspan="6">'+detail+'</td></tr>':'');
  }).join("");
  return '<div class="card challenge-card" style="margin-bottom:14px"><div class="module-head challenge-head"><h3>Submitted vs Independent Challenge</h3><span class="badge '+(challenge.challengedCount?"partial":"ready")+'">'+escapeHtml(challenge.challengedCount)+" challenged"+'</span></div>'+
    '<div class="scalar-grid challenge-summary">'+
      '<div class="scalar"><b>Submitted evidence</b><span>'+escapeHtml(challenge.submittedEvidenceState)+'</span></div>'+
      '<div class="scalar"><b>Independent state</b><span>'+escapeHtml(challenge.independentState)+'</span></div>'+
      '<div class="scalar"><b>Not submitted</b><span>'+escapeHtml(challenge.notSubmittedCount)+'</span></div>'+
      '<div class="scalar"><b>Scenario items</b><span>'+escapeHtml(challenge.scenarioCount)+'</span></div>'+
    '</div>'+
    '<div class="table-wrap challenge-table-wrap"><table><thead><tr><th>Metric</th><th>Submitted</th><th>Independent</th><th>Gap</th><th>Consequence</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}
function renderDeliveryChallenge(data,reason){
  const d=data?.deliveryChallenge;
  if(!d)return false;
  const s=d.scheduleChallenge||{},m=d.manpowerChallenge||{},q=d.quantityChallenge||{},p=d.productivityChallenge||{};
  let html=(reason?'<div class="notice info">'+escapeHtml(reason)+'</div>':'')+renderUniversalChallenge(data?.challenge);
  html+='<div class="notice '+(d.position==="material_delivery_gap"||d.position==="challenged"?"warn":"info")+'"><b>Delivery challenge position: '+escapeHtml(d.position)+'</b><br>'+escapeHtml(d.disclaimer||"")+'</div>';
  html+='<div class="grid kpi">'+
    kpi("Contractor forecast",s.contractorSubmittedCompletionIso)+
    kpi("Independent forecast",s.independentCompletionIso)+
    kpi("Contract completion",s.contractualCompletionIso)+
    kpi("Forecast gap",s.contractorVsIndependentDays,"days independent minus contractor")+
    kpi("Avg work fronts",s.averageConcurrentWorkFronts)+
    kpi("Peak work fronts",s.peakConcurrentWorkFronts)+
  '</div>';
  html+='<div class="grid two" style="margin-top:12px"><div class="card"><h3>Challenge manpower plan</h3><div class="scalar-grid">'+
    '<div class="scalar"><b>Submitted average manpower</b><span>'+escapeHtml(fmt(m.submittedAverageManpower))+'</span></div>'+
    '<div class="scalar"><b>Submitted peak manpower</b><span>'+escapeHtml(fmt(m.submittedPeakManpower))+'</span></div>'+
    '<div class="scalar"><b>Required avg to contract</b><span>'+escapeHtml(fmt(m.requiredAverageManpowerToContract))+'</span></div>'+
    '<div class="scalar"><b>Required avg to contractor forecast</b><span>'+escapeHtml(fmt(m.requiredAverageManpowerToContractorForecast))+'</span></div>'+
    '<div class="scalar"><b>Submitted vs required</b><span>'+escapeHtml(fmt(m.submittedVsRequiredToContract))+'%</span></div>'+
    '<div class="scalar"><b>Remaining labor hours</b><span>'+escapeHtml(fmt(m.evidenceRemainingLaborHours))+'</span></div>'+
    '</div><h3 style="margin-top:14px">Schedule-derived fallback scenarios</h3><div class="table-wrap"><table><thead><tr><th>Crew / work front</th><th>Average manpower</th><th>Peak manpower</th><th>Authority</th></tr></thead><tbody>'+
    (m.scheduleDerivedScenarios||[]).map(x=>'<tr><td>'+escapeHtml(x.crewSize)+'</td><td>'+escapeHtml(fmt(x.averageManpower))+'</td><td>'+escapeHtml(fmt(x.peakManpower))+'</td><td>'+escapeHtml(x.authority)+'</td></tr>').join("")+
    '</tbody></table></div></div>';
  html+='<div class="card"><h3>Quantity, productivity & mapping</h3><div class="scalar-grid">'+
    '<div class="scalar"><b>Mapping coverage</b><span>'+escapeHtml(fmt(q.mappingCoveragePercent))+'%</span></div>'+
    '<div class="scalar"><b>Ambiguous BOQ items</b><span>'+escapeHtml(fmt(q.ambiguousMappingItemCount))+'</span></div>'+
    '<div class="scalar"><b>Unmapped BOQ items</b><span>'+escapeHtml(fmt(q.unmappedItemCount))+'</span></div>'+
    '<div class="scalar"><b>Productivity evidence</b><span>'+escapeHtml(p.productivityEvidenceState||"—")+'</span></div>'+
    '</div><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Unit</th><th>Contract qty</th><th>Mapped qty</th><th>Installed</th><th>Remaining</th><th>Req/day contract</th><th>Map coverage</th></tr></thead><tbody>'+
    (q.byUnit||[]).map(x=>'<tr><td>'+escapeHtml(x.unit)+'</td><td>'+escapeHtml(fmt(x.contractQuantity))+'</td><td>'+escapeHtml(fmt(x.mappedContractQuantity))+'</td><td>'+escapeHtml(fmt(x.installedQuantity))+'</td><td>'+escapeHtml(fmt(x.remainingQuantity))+'</td><td>'+escapeHtml(fmt(x.requiredPerDayToContract))+'</td><td>'+escapeHtml(fmt(x.mappingCoveragePercent))+'%</td></tr>').join("")+
    '</tbody></table></div></div></div>';
  html+='<div class="card" style="margin-top:12px"><h3>Combined delivery challenge findings</h3><div class="table-wrap"><table><thead><tr><th>Topic</th><th>State</th><th>Contractor assumption</th><th>Independent calculation</th><th>Gap</th><th>Milestone consequence</th><th>Required response</th></tr></thead><tbody>'+
    (d.findings||[]).map(x=>'<tr><td>'+escapeHtml(x.topic)+'</td><td>'+escapeHtml(x.state)+'</td><td>'+escapeHtml(x.contractorAssumption||"—")+'</td><td>'+escapeHtml(x.independentCalculation||"—")+'</td><td>'+escapeHtml(x.difference||"—")+'</td><td>'+escapeHtml(x.milestoneConsequence||"—")+'</td><td>'+escapeHtml(x.requiredResponse||"—")+'</td></tr>').join("")+
    '</tbody></table></div></div>';
  if(d.mapping){
    html+='<details style="margin-top:12px"><summary>BOQ ↔ Schedule mapping candidates and evidence</summary><pre>'+escapeHtml(JSON.stringify(d.mapping,null,2))+'</pre></details>';
  }
  if(data.contractValueEvidence){
    const cv=data.contractValueEvidence;
    const governed=cv.governed;
    const candidate=cv.extraction?.value;
    const display=governed?fmt(governed.amount)+" "+(governed.currency||""):candidate?fmt(candidate.amount)+" "+(candidate.currency||""):"—";
    html+='<div class="card" style="margin-top:12px"><h3>Contract value evidence</h3><div class="scalar-grid">'+
      '<div class="scalar"><b>State</b><span>'+escapeHtml(cv.state||"missing")+'</span></div>'+
      '<div class="scalar"><b>Value</b><span>'+escapeHtml(display)+'</span></div>'+
      '<div class="scalar"><b>Authority</b><span>'+escapeHtml(governed?"governed":candidate?"candidate only":"not established")+'</span></div>'+
      '</div><div class="notice info">'+escapeHtml(cv.note||"")+'</div>'+
      (cv.extraction?.candidates?.length?'<details><summary>Contract value candidates and source evidence</summary><pre>'+escapeHtml(JSON.stringify(cv.extraction,null,2))+'</pre></details>':'')+
      '</div>';
  }
  if(data.contractIntelligence){
    html+='<details style="margin-top:12px"><summary>Contract clause intelligence supporting the challenge</summary><pre>'+escapeHtml(JSON.stringify(data.contractIntelligence,null,2))+'</pre></details>';
  }
  el("moduleContent").innerHTML=html;
  return true;
}
function humanizeKey(key){
  return String(key)
    .replace(/[_-]+/g," ")
    .replace(/([a-z0-9])([A-Z])/g,"$1 $2")
    .replace(/\b\w/g,c=>c.toUpperCase());
}
function isScalarValue(value){
  return value===null||["string","number","boolean"].includes(typeof value);
}
function renderComplexCell(value){
  if(isScalarValue(value))return escapeHtml(fmt(value));
  if(Array.isArray(value)&&value.every(isScalarValue))return '<div class="value-list">'+value.map(v=>'<span class="value-chip">'+escapeHtml(fmt(v))+'</span>').join("")+'</div>';
  return '<details class="cell-details"><summary>Open detail</summary><pre>'+escapeHtml(JSON.stringify(value,null,2))+'</pre></details>';
}
function renderRecordTable(records){
  const rows=records.filter(x=>x&&typeof x==="object"&&!Array.isArray(x));
  if(!rows.length)return"";
  const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
  return '<div class="table-wrap"><table><thead><tr>'+columns.map(key=>'<th>'+escapeHtml(humanizeKey(key))+'</th>').join("")+'</tr></thead><tbody>'+
    rows.map(row=>'<tr>'+columns.map(key=>'<td>'+renderComplexCell(row[key])+'</td>').join("")+'</tr>').join("")+
    '</tbody></table></div>';
}
function renderStructuredValue(value,depth=0){
  if(isScalarValue(value))return '<div class="value-chip">'+escapeHtml(fmt(value))+'</div>';
  if(Array.isArray(value)){
    if(!value.length)return '<div class="muted">No records.</div>';
    if(value.every(isScalarValue))return '<div class="value-list">'+value.map(v=>'<span class="value-chip">'+escapeHtml(fmt(v))+'</span>').join("")+'</div>';
    if(value.every(x=>x&&typeof x==="object"&&!Array.isArray(x)))return renderRecordTable(value);
    return '<details><summary>Mixed records · '+escapeHtml(value.length)+'</summary><pre>'+escapeHtml(JSON.stringify(value,null,2))+'</pre></details>';
  }
  if(!value||typeof value!=="object")return"";
  const entries=Object.entries(value);
  const scalars=entries.filter(([,v])=>isScalarValue(v));
  const complex=entries.filter(([,v])=>!isScalarValue(v));
  let html=scalars.length?'<div class="scalar-grid">'+scalars.map(([key,v])=>'<div class="scalar"><b>'+escapeHtml(humanizeKey(key))+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("")+'</div>':"";
  if(depth>=2&&complex.length){
    html+='<details><summary>Full nested evidence</summary><pre>'+escapeHtml(JSON.stringify(value,null,2))+'</pre></details>';
    return html;
  }
  html+=complex.map(([key,v])=>'<div class="nested-block"><div class="nested-title">'+escapeHtml(humanizeKey(key))+'</div>'+renderStructuredValue(v,depth+1)+'</div>').join("");
  return html||'<div class="muted">No displayable values.</div>';
}
function projectionFor(data,projectionKey){
  if(data?.projectionKey===projectionKey)return data;
  for(const value of Object.values(data||{})){
    if(value&&typeof value==="object"&&!Array.isArray(value)&&value.projectionKey===projectionKey)return value;
  }
  return data||{};
}
function renderLineChart(points,series,yMaxHint=null){
  if(!Array.isArray(points)||!points.length)return '<div class="muted">No series points available.</div>';
  const numeric=[];
  points.forEach(point=>series.forEach(s=>{const v=point?.[s.key];if(typeof v==="number"&&Number.isFinite(v))numeric.push(v)}));
  if(!numeric.length)return '<div class="muted">No numeric series points available.</div>';
  const width=960,height=270,left=52,right=18,top=18,bottom=42;
  const plotW=width-left-right,plotH=height-top-bottom;
  const rawMax=Math.max(...numeric,1);
  const maxY=yMaxHint!==null?yMaxHint:Math.max(1,rawMax*1.08);
  const x=i=>left+(points.length===1?plotW/2:(i/(points.length-1))*plotW);
  const y=v=>top+plotH-(Math.max(0,Math.min(maxY,v))/maxY)*plotH;
  const segments=(key)=>{
    const result=[];let current=[];
    points.forEach((point,i)=>{
      const value=point?.[key];
      if(typeof value==="number"&&Number.isFinite(value)){current.push(x(i).toFixed(1)+","+y(value).toFixed(1))}
      else if(current.length){result.push(current);current=[]}
    });
    if(current.length)result.push(current);
    return result;
  };
  const grid=[0,.25,.5,.75,1].map(r=>{
    const yy=top+plotH-(r*plotH);
    return '<line x1="'+left+'" y1="'+yy+'" x2="'+(width-right)+'" y2="'+yy+'" stroke="#e4eaf1" stroke-width="1"/><text x="'+(left-9)+'" y="'+(yy+4)+'" text-anchor="end" font-size="10" fill="#75849a">'+escapeHtml(fmt(maxY*r))+'</text>';
  }).join("");
  const lines=series.map(s=>segments(s.key).map(seg=>'<polyline points="'+seg.join(" ")+'" fill="none" stroke="'+s.color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>').join("")).join("");
  const labelIndexes=[0,Math.floor((points.length-1)/2),points.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const labels=labelIndexes.map(i=>'<text x="'+x(i)+'" y="'+(height-14)+'" text-anchor="'+(i===0?"start":i===points.length-1?"end":"middle")+'" font-size="10" fill="#75849a">'+escapeHtml(points[i]?.dateIso||String(i+1))+'</text>').join("");
  const legend='<div class="chart-legend">'+series.map(s=>'<span class="legend-item"><span class="legend-dot" style="background:'+s.color+'"></span>'+escapeHtml(s.label)+'</span>').join("")+'</div>';
  return legend+'<div class="chart-scroll"><svg class="svg-chart" viewBox="0 0 '+width+' '+height+'" role="img">'+grid+lines+labels+'</svg></div>';
}
function renderProgressScurveVisual(data){
  const p=projectionFor(data,"progress_scurve");
  if(!Array.isArray(p.points))return"";
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>Progress S-Curve</h4><p>Baseline, current forecast and actual history remain separate evidence series.</p></div><span class="badge">'+escapeHtml(p.actualHistoryMode||"")+'</span></div><div class="chart-body">'+
    renderLineChart(p.points,[
      {key:"baselinePlannedPercent",label:"Baseline planned",color:"#2357d9"},
      {key:"currentForecastPercent",label:"Current forecast",color:"#0f766e"},
      {key:"actualProgressPercent",label:"Actual",color:"#d97706"}
    ],100)+
  '</div></section>';
}
function renderQuantityScurveVisual(data){
  const p=projectionFor(data,"quantity_scurve");
  if(!Array.isArray(p.series))return"";
  return p.series.map(series=>'<section class="chart-card"><div class="chart-card-head"><div><h4>Quantity S-Curve · '+escapeHtml(series.unitKey||series.unit||series.seriesKey)+'</h4><p>'+escapeHtml(series.itemCount)+' mapped item(s) · '+escapeHtml(fmt(series.mappingCoveragePercent))+'% mapping coverage</p></div><span class="badge '+(series.authority==="governed_mapping"?"ready":"partial")+'">'+escapeHtml(series.authority)+'</span></div><div class="chart-body">'+
    renderLineChart(series.points||[],[
      {key:"baselinePlannedQuantity",label:"Baseline planned",color:"#2357d9"},
      {key:"currentForecastQuantity",label:"Current forecast",color:"#0f766e"},
      {key:"actualInstalledQuantity",label:"Actual installed",color:"#d97706"}
    ])+
  '</div></section>').join("");
}
function renderLookAheadVisual(data){
  const p=projectionFor(data,"lookahead_schedule");
  if(!Array.isArray(p.rows))return"";
  const dimensions=["predecessor","procurement_material","design_submittal","permit","resource","quality","commercial","risk","access"];
  const rows=p.rows.map(row=>{
    const map=new Map((row.readiness?.dimensions||[]).map(d=>[d.key,d]));
    return '<tr><td><b>'+escapeHtml(row.activityId)+'</b><br><span class="muted">'+escapeHtml(row.name||"")+'</span></td><td>'+escapeHtml(row.startIso||"—")+'</td><td>'+escapeHtml(row.finishIso||"—")+'</td><td><span class="state-pill '+escapeHtml(row.readiness?.state||"unknown")+'">'+escapeHtml(row.readiness?.state||"unknown")+'</span></td>'+
      dimensions.map(key=>{const dim=map.get(key);const state=dim?.state||"unknown";return '<td><span class="state-pill '+escapeHtml(state)+'" title="'+escapeHtml(dim?.note||"")+'">'+escapeHtml(state)+'</span></td>'}).join("")+'</tr>';
  }).join("");
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>Look-Ahead Readiness Matrix</h4><p>Readiness is evidence-derived by activity and control dimension, not inferred from planned dates.</p></div><span class="badge '+(p.blockedCount?"partial":"ready")+'">'+escapeHtml(p.readyCount||0)+' ready · '+escapeHtml(p.blockedCount||0)+' blocked</span></div><div class="chart-body"><div class="table-wrap readiness-table"><table><thead><tr><th>Activity</th><th>Start</th><th>Finish</th><th>Overall</th>'+
    dimensions.map(key=>'<th>'+escapeHtml(humanizeKey(key))+'</th>').join("")+
    '</tr></thead><tbody>'+rows+'</tbody></table></div></div></section>';
}
function renderForecastVisual(data){
  const p=projectionFor(data,"independent_forecast");
  if(!("independentForecastCompletionIso" in p))return"";
  const prob=p.probabilistic||{};
  const cards=[
    ["Source forecast",p.sourceForecastCompletionIso,p.sourceRevisionId||""],
    ["Independent forecast",p.independentForecastCompletionIso,(p.forecastVarianceDays===null||p.forecastVarianceDays===undefined)?"":fmt(p.forecastVarianceDays)+" days vs source"],
    ["Required finish",p.requiredFinishIso,(p.requiredFinishVarianceDays===null||p.requiredFinishVarianceDays===undefined)?"":fmt(p.requiredFinishVarianceDays)+" days variance"],
    ["P50 comparator",prob.p50CompletionIso,prob.authority||""],
    ["P80 comparator",prob.p80CompletionIso,prob.authority||""],
    ["P90 comparator",prob.p90CompletionIso,prob.authority||""]
  ];
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>Forecast Position</h4><p>Source programme and independent calculation stay separate; probabilistic dates are non-official comparators.</p></div><span class="badge '+(p.complete?"ready":"partial")+'">'+escapeHtml(p.origin||"")+'</span></div><div class="chart-body"><div class="position-grid">'+cards.map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(c[1]||"—")+'</div><div class="position-sub">'+escapeHtml(c[2]||"")+'</div></div>').join("")+'</div></div></section>';
}
function renderWindowsVisual(data){
  const p=projectionFor(data,"windows_analysis");
  if(!Array.isArray(p.windows))return"";
  const rows=p.windows.map(w=>'<div class="window-card"><div><div class="window-id">Window '+escapeHtml(w.sequence)+' · '+escapeHtml(w.windowId)+'</div><div class="window-dates">'+escapeHtml(w.windowStartIso||"—")+' → '+escapeHtml(w.windowEndIso||"—")+'</div><div class="event-tags">'+
      (w.delayEvents||[]).map(e=>'<span class="event-tag">'+escapeHtml(e.responsibility)+' · '+escapeHtml(e.eventId)+'</span>').join("")+
    '</div></div><div><div class="movement-label">Strongest programme movement</div><div class="movement-value">'+escapeHtml(fmt(w.strongestProgrammeMovementDays))+' days</div><div class="muted">'+escapeHtml(w.strongestProgrammeMovementBasis||"")+' · progress '+escapeHtml(fmt(w.progressMovementPercent))+'%</div></div><div><span class="state-pill '+escapeHtml(w.state||"unknown")+'">'+escapeHtml(w.state||"unknown")+'</span><div class="muted" style="margin-top:7px">'+escapeHtml(w.addedActivityCount)+' added · '+escapeHtml(w.removedActivityCount)+' removed · '+escapeHtml(w.modifiedActivityCount)+' modified</div>'+(w.concurrentEventCandidate?'<div class="event-tag" style="margin-top:7px">Concurrency review</div>':'')+'</div></div>').join("");
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>Schedule Windows</h4><p>Revision-to-revision programme movement with event population and concurrency visibility.</p></div><span class="badge">'+escapeHtml(p.windowCount||0)+' windows</span></div><div class="chart-body"><div class="window-strip">'+rows+'</div></div></section>';
}
function renderDelayClaimsVisual(data){
  const p=projectionFor(data,"delay_claims");
  if(!Array.isArray(p.events))return"";
  const rows=p.events.map(e=>'<tr><td><b>'+escapeHtml(e.eventId)+'</b><br><span class="muted">'+escapeHtml(e.title||"")+'</span></td><td>'+escapeHtml(e.responsibility)+'</td><td>'+escapeHtml(e.noticeTimeliness)+'</td><td>'+escapeHtml(fmt(e.observedPositiveProgrammeMovementDays))+'</td><td>'+escapeHtml(e.programmeMovementBasis)+'</td><td><span class="state-pill '+(e.concurrencyCandidate?"review":"ready")+'">'+escapeHtml(e.candidateClass)+'</span></td><td>'+escapeHtml((e.linkedClaimIds||[]).join(", ")||"—")+'</td><td>'+escapeHtml((e.relatedActivityIds||[]).join(", ")||"—")+'</td></tr>').join("");
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>Delay Event & Claim Linkage</h4><p>Observed programme movement remains separate from causal/contractual entitlement.</p></div><span class="badge">'+escapeHtml(p.eventCount||0)+' events · '+escapeHtml(p.claimCount||0)+' claims</span></div><div class="chart-body"><div class="table-wrap"><table><thead><tr><th>Event</th><th>Responsibility</th><th>Notice</th><th>Positive movement days</th><th>Movement basis</th><th>Candidate class</th><th>Claims</th><th>Activities</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section>';
}
function renderEotVisual(data){
  const p=projectionFor(data,"eot_assessment");
  if(!Array.isArray(p.windowCandidates))return"";
  const cards=[
    ["Contract completion",p.contractualCompletionIso,p.contractualCompletionState],
    ["Official approved EOT",p.officialApprovedEotDays===null?"—":fmt(p.officialApprovedEotDays)+" days",p.officialApprovedEotState],
    ["Official adjusted completion",p.officialAdjustedCompletionIso,"governed only"],
    ["Observed movement",fmt(p.observedProgrammeMovementDays)+" days","schedule observation"],
    ["Analytical time impact",fmt(p.analyticalTimeImpactCandidateDays)+" days","candidate, not entitlement"],
    ["Attributable EOT candidate",p.attributableCandidateEotDays===null?"—":fmt(p.attributableCandidateEotDays)+" days","candidate, not award"],
    ["Scenario adjusted completion",p.scenarioAdjustedCompletionIso,"analytical scenario"]
  ];
  const rows=p.windowCandidates.map(w=>'<tr><td>'+escapeHtml(w.windowId)+'</td><td>'+escapeHtml(fmt(w.positiveProgrammeMovementDays))+'</td><td>'+escapeHtml(w.programmeMovementBasis)+'</td><td>'+escapeHtml(fmt(w.analyticalTimeImpactCandidateDays))+'</td><td><span class="state-pill '+escapeHtml(w.state)+'">'+escapeHtml(w.state)+'</span></td><td>'+escapeHtml(fmt(w.includedCandidateDays))+'</td><td>'+escapeHtml((w.reasons||[]).join("; ")||"—")+'</td></tr>').join("");
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>EOT Position</h4><p>Official award, observed movement and analytical candidate remain explicitly separate.</p></div><span class="badge partial">Analytical candidate ≠ award</span></div><div class="chart-body"><div class="position-grid">'+cards.map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(c[1]||"—")+'</div><div class="position-sub">'+escapeHtml(c[2]||"")+'</div></div>').join("")+'</div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Window</th><th>Programme movement</th><th>Basis</th><th>Time impact</th><th>State</th><th>Included days</th><th>Reason</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></section>';
}
function visualSection(title,description,badge,body){
  return '<section class="chart-card"><div class="chart-card-head"><div><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(description)+'</p></div>'+(badge?'<span class="badge">'+escapeHtml(badge)+'</span>':'')+'</div><div class="chart-body">'+body+'</div></section>';
}
function metricLine(label,value){
  return '<div class="domain-metric"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value===null||value===undefined?"—":fmt(value))+'</strong></div>';
}
function renderPmoVisual(data){
  const p=projectionFor(data,"pmo_analysis");
  if(!p.schedule||!p.progress||!p.forecast)return"";
  const cards=[
    ["Schedule",[
      ["Activities",p.schedule.activityCount],["Relationships",p.schedule.relationshipCount],["Critical",p.schedule.criticalCount],["Near-critical",p.schedule.nearCriticalCount],["Negative float",p.schedule.negativeFloatCount],["Logic density",p.schedule.logicDensity],["CPM",p.schedule.independentCpmState]
    ]],
    ["Progress",[
      ["Weighted progress",p.progress.durationWeightedProgressPercent===null?"—":fmt(p.progress.durationWeightedProgressPercent)+"%"],["Coverage",p.progress.progressCoveragePercent===null?"—":fmt(p.progress.progressCoveragePercent)+"%"],["Completed",p.progress.completedCount],["In progress",p.progress.inProgressCount],["Look-ahead overdue",p.progress.lookAheadOverdueCount],["Late milestones",p.progress.lateMilestoneCount]
    ]],
    ["Forecast",[
      ["Source completion",p.forecast.sourceCompletionIso],["Independent completion",p.forecast.independentCompletionIso],["Variance days",p.forecast.varianceDays],["Authority",p.forecast.authority],["Coverage",p.forecast.activityCoveragePercent===null?"—":fmt(p.forecast.activityCoveragePercent)+"%"]
    ]],
    ["Resources",[
      ["Assigned resources",p.resources.assignedResourceCount],["Capacity coverage",p.resources.capacityCoveragePercent===null?"—":fmt(p.resources.capacityCoveragePercent)+"%"],["Overloaded",p.resources.overloadedResourceCount],["Actual labor hours",p.resources.laborHoursActualKnown],["Actual coverage",p.resources.laborActualCoveragePercent===null?"—":fmt(p.resources.laborActualCoveragePercent)+"%"]
    ]],
    ["Quantities",[
      ["Allocation",p.quantities.allocationState],["Unit series",p.quantities.unitSeriesCount],["Unmapped BOQ items",p.quantities.unmappedItemCount],["Over-allocated",p.quantities.overAllocatedItemCount]
    ]],
    ["Contract",[
      ["Physical complete",p.contract.physicalComplete],["Semantic complete",p.contract.semanticComplete],["Challenge signals",p.contract.challengeSignalCount],["Notice candidates",p.contract.noticeRequirementCandidateCount]
    ]],
    ["Claims & EOT",[
      ["Events",p.claims.eventCount],["Claims",p.claims.claimCount],["Timely notices",p.claims.timelyNoticeCount],["Late notices",p.claims.lateNoticeCount],["Observed movement",fmt(p.claims.observedProgrammeMovementDays)+" days"],["Analytical impact",fmt(p.claims.analyticalTimeImpactCandidateDays)+" days"],["Official EOT",p.claims.officialApprovedEotDays===null?"—":fmt(p.claims.officialApprovedEotDays)+" days"]
    ]],
    ["Revision",[
      ["Revision count",p.revision.revisionCount],["Latest added",p.revision.latestAddedActivityCount],["Latest removed",p.revision.latestRemovedActivityCount],["Latest modified",p.revision.latestModifiedActivityCount]
    ]]
  ];
  const body='<div class="domain-grid">'+cards.map(c=>'<div class="domain-card"><h5>'+escapeHtml(c[0])+'</h5>'+c[1].map(m=>metricLine(m[0],m[1])).join("")+'</div>').join("")+'</div>';
  return visualSection("PMO Control Position","Cross-domain management position with each evidence authority kept separate.","evidence "+(p.evidenceRevisionId||""),body);
}
function renderScheduleAnalyticsVisual(data){
  const p=projectionFor(data,"schedule_analytics");
  const r=p.result||p;
  if(!r.graph||!r.float)return"";
  const position='<div class="position-grid">'+[
    ["Activities",r.activityCount,"schedule population"],["Relationships",r.relationshipCount,"logic population"],["Logic density",r.graph.logicDensity,"relationships / activity"],["Critical",r.float.criticalCount,"source total float"],["Near-critical",r.float.nearCriticalCount,"source total float"],["Negative float",r.float.negativeFloatCount,"schedule pressure"],["Open starts",(r.graph.openStartActivityIds||[]).length,"logic integrity"],["Open finishes",(r.graph.openFinishActivityIds||[]).length,"logic integrity"],["Graph complete",r.graph.complete,"integrity state"]
  ].map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(fmt(c[1]))+'</div><div class="position-sub">'+escapeHtml(c[2])+'</div></div>').join("")+'</div>';
  const bases='<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Completion basis</th><th>Date</th><th>State</th><th>Coverage</th><th>Method</th><th>Source</th></tr></thead><tbody>'+
    (r.completionBases||[]).map(b=>'<tr><td><b>'+escapeHtml(b.basis)+'</b></td><td>'+escapeHtml(b.dateIso||"—")+'</td><td><span class="state-pill '+(b.state==="available"?"ready":b.state==="partial"?"review":"unknown")+'">'+escapeHtml(b.state)+'</span></td><td>'+escapeHtml(b.coveragePercent===null?"—":fmt(b.coveragePercent)+"%")+'</td><td>'+escapeHtml(b.method||"")+'</td><td>'+escapeHtml((b.sourceRefs||[]).join(", ")||"—")+'</td></tr>').join("")+
    '</tbody></table></div>';
  return visualSection("Schedule Integrity & Completion Bases","Logic, float and completion bases are shown separately; actual completion is never inferred from forecast.",r.complete?"complete":"partial",position+bases);
}
function renderActivityAnalyticsVisual(data){
  const p=projectionFor(data,"activity_analytics");
  if(!Array.isArray(p.rows))return"";
  const rows=p.rows.map(a=>'<tr><td><b>'+escapeHtml(a.activityId)+'</b><br><span class="muted">'+escapeHtml(a.name||"")+'</span></td><td>'+escapeHtml(a.status)+'</td><td><span class="state-pill '+(a.criticality==="critical"?"blocked":a.criticality==="near_critical"?"review":"ready")+'">'+escapeHtml(a.criticality)+'</span></td><td>'+escapeHtml(a.currentStartIso||"—")+'</td><td>'+escapeHtml(a.currentFinishIso||"—")+'</td><td>'+escapeHtml(a.percentComplete===null?"—":fmt(a.percentComplete)+"%")+'</td><td>'+escapeHtml(fmt(a.totalFloatHours))+'</td><td>'+escapeHtml(fmt(a.finishVarianceDays))+'</td><td>'+escapeHtml(a.predecessorCount)+'</td><td>'+escapeHtml(a.successorCount)+'</td><td>'+escapeHtml(a.openStart?"Yes":"No")+'</td><td>'+escapeHtml(a.openFinish?"Yes":"No")+'</td></tr>').join("");
  return visualSection("Activity Detail","Current dates, progress, float, variance and logic status across the full activity population.",p.activityCount+" activities",'<div class="table-wrap"><table><thead><tr><th>Activity</th><th>Status</th><th>Criticality</th><th>Current start</th><th>Current finish</th><th>Progress</th><th>Total float h</th><th>Finish variance d</th><th>Pred</th><th>Succ</th><th>Open start</th><th>Open finish</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderResourceVisual(data){
  const p=projectionFor(data,"resource_utilization");
  if(!Array.isArray(p.rows))return"";
  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.resourceId)+'</b><br><span class="muted">'+escapeHtml(r.resourceName||"")+'</span></td><td>'+escapeHtml(r.resourceType)+'</td><td>'+escapeHtml(r.assignmentCount)+'</td><td>'+escapeHtml(fmt(r.capacityUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakPlannedUnitsPerHour))+'</td><td>'+escapeHtml(fmt(r.peakRemainingUnitsPerHour))+'</td><td>'+escapeHtml(r.plannedUtilizationPercent===null?"—":fmt(r.plannedUtilizationPercent)+"%")+'</td><td>'+escapeHtml(r.remainingUtilizationPercent===null?"—":fmt(r.remainingUtilizationPercent)+"%")+'</td><td><span class="state-pill '+(r.overloaded===true?"blocked":r.state==="capacity_based"?"ready":"review")+'">'+escapeHtml(r.overloaded===true?"overloaded":r.state)+'</span></td></tr>').join("");
  return visualSection("Resource Utilization","Capacity-based utilization is separated from demand-only resources; unknown capacity is not assumed.",p.overloadedResourceCount+" overloaded",'<div class="position-grid" style="margin-bottom:14px">'+[
    ["Resources",p.resourceCount],["Assigned",p.assignedResourceCount],["Capacity based",p.capacityBasedResourceCount],["Capacity coverage",p.capacityCoveragePercent===null?"—":fmt(p.capacityCoveragePercent)+"%"]
  ].map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(fmt(c[1]))+'</div></div>').join("")+'</div><div class="table-wrap"><table><thead><tr><th>Resource</th><th>Type</th><th>Assignments</th><th>Capacity/hr</th><th>Peak planned/hr</th><th>Peak remaining/hr</th><th>Planned util.</th><th>Remaining util.</th><th>State</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderProgressReportVisual(data){
  const p=projectionFor(data,"progress_report");
  if(!p.progressBases)return"";
  const bases=Object.entries(p.progressBases).map(([key,b])=>'<div class="position-card"><div class="position-label">'+escapeHtml(humanizeKey(key))+'</div><div class="position-value">'+escapeHtml(b.valuePercent===null?"—":fmt(b.valuePercent)+"%")+'</div><div class="position-sub">'+escapeHtml(b.state)+' · '+escapeHtml(b.authority)+'<br>Coverage '+escapeHtml(b.coveragePercent===null?"—":fmt(b.coveragePercent)+"%")+' · as of '+escapeHtml(b.asOfIso||"—")+'<br>Variance to baseline '+escapeHtml(b.varianceToBaselinePercentagePoints===null?"—":fmt(b.varianceToBaselinePercentagePoints)+" pp")+'</div></div>').join("");
  const summary='<div class="domain-grid" style="margin-top:14px">'+[
    ["Schedule",[["Critical",p.schedule?.criticalCount],["Near-critical",p.schedule?.nearCriticalCount],["Negative float",p.schedule?.negativeFloatCount],["Float coverage",p.schedule?.floatCoveragePercent===null?"—":fmt(p.schedule?.floatCoveragePercent)+"%"]]],
    ["Forecast",[["Source",p.forecast?.sourceForecastCompletionIso],["Independent",p.forecast?.independentForecastCompletionIso],["Variance days",p.forecast?.forecastVarianceDays],["Authority",p.forecast?.authority]]],
    ["Milestones",[["Total",p.milestones?.milestoneCount],["Open",p.milestones?.openCount],["Late open",p.milestones?.lateOpenCount]]],
    ["Look-Ahead",[["Window days",p.lookAhead?.windowDays],["Incomplete",p.lookAhead?.incompleteActivityCount],["Overdue",p.lookAhead?.overdueCount],["Date coverage",p.lookAhead?.currentDateCoveragePercent===null?"—":fmt(p.lookAhead?.currentDateCoveragePercent)+"%"]]]
  ].map(c=>'<div class="domain-card"><h5>'+escapeHtml(c[0])+'</h5>'+c[1].map(m=>metricLine(m[0],m[1])).join("")+'</div>').join("")+'</div>';
  return visualSection("Progress Bases","Baseline, current schedule, physical, contractor-reported and certified progress are kept as distinct authorities.",p.dataDateIso||"",'<div class="position-grid">'+bases+'</div>'+summary);
}
function renderScheduleChangeVisual(data){
  const p=projectionFor(data,"schedule_change_report");
  if(!Array.isArray(p.changedActivities))return"";
  const top='<div class="position-grid">'+[
    ["Matched activities",p.matchedActivityCount],["Population match",p.populationMatchPercent===null?"—":fmt(p.populationMatchPercent)+"%"],["Added",p.addedActivityCount],["Removed",p.removedActivityCount],["Modified",p.modifiedActivityCount],["Unchanged",p.unchangedActivityCount],["Added relationships",p.addedRelationshipCount],["Removed relationships",p.removedRelationshipCount]
  ].map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(fmt(c[1]))+'</div></div>').join("")+'</div>';
  const rows=p.changedActivities.map(a=>'<tr><td>'+escapeHtml(a.activityId)+'</td><td>'+escapeHtml(a.changeKind)+'</td><td>'+escapeHtml(fmt(a.finishShiftDays))+'</td><td>'+escapeHtml(fmt(a.floatShiftHours))+'</td><td>'+escapeHtml(fmt(a.progressShiftPercent))+'</td><td>'+renderComplexCell(a.fieldChanges||[])+'</td></tr>').join("");
  return visualSection("Schedule Revision Comparison","Full canonical activity changes and relationship movement between the compared revisions.",p.state,top+'<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Activity</th><th>Change</th><th>Finish shift d</th><th>Float shift h</th><th>Progress shift pp</th><th>All field changes</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderRevisionTrendVisual(data){
  const p=projectionFor(data,"revision_trend");
  if(!Array.isArray(p.points))return"";
  const points=p.points.map(x=>({...x,dateIso:x.dataDateIso||("Rev "+x.sequence)}));
  const chart=renderLineChart(points,[
    {key:"durationWeightedProgressPercent",label:"Weighted progress %",color:"#2357d9"}
  ],100);
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td>'+escapeHtml(x.revisionId)+'</td><td>'+escapeHtml(x.dataDateIso||"—")+'</td><td>'+escapeHtml(x.durationWeightedProgressPercent===null?"—":fmt(x.durationWeightedProgressPercent)+"%")+'</td><td>'+escapeHtml(x.criticalCount)+'</td><td>'+escapeHtml(x.nearCriticalCount)+'</td><td>'+escapeHtml(x.negativeFloatCount)+'</td><td>'+escapeHtml(x.forecastCompletionIso||"—")+'</td><td>'+escapeHtml(fmt(x.addedVsPrevious))+'</td><td>'+escapeHtml(fmt(x.removedVsPrevious))+'</td><td>'+escapeHtml(fmt(x.modifiedVsPrevious))+'</td></tr>').join("");
  return visualSection("Revision Trend","Chronological schedule evolution follows proven schedule chronology, not upload order.",p.revisionCount+" revisions",chart+'<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Seq</th><th>Revision</th><th>Data date</th><th>Progress</th><th>Critical</th><th>Near-critical</th><th>Neg. float</th><th>Forecast completion</th><th>Added</th><th>Removed</th><th>Modified</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderVarianceTrendVisual(data){
  const p=projectionFor(data,"variance_trends");
  if(!Array.isArray(p.points))return"";
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.sequence)+'</td><td>'+escapeHtml(x.revisionId)+'</td><td>'+escapeHtml(x.dataDateIso||"—")+'</td><td>'+escapeHtml(fmt(x.averageFinishVarianceDays))+'</td><td>'+escapeHtml(fmt(x.maximumDelayDays))+'</td><td>'+escapeHtml(x.lateActivityCount)+'</td><td>'+escapeHtml(x.earlyActivityCount)+'</td><td>'+escapeHtml(x.onTimeActivityCount)+'</td><td>'+escapeHtml(x.negativeFloatCount)+'</td><td>'+escapeHtml(x.criticalCount)+'</td><td>'+escapeHtml(fmt(x.projectCompletionVarianceDays))+'</td></tr>').join("");
  return visualSection("Variance Trend","Finish variance and project completion movement by revision, with comparable-population coverage retained.",p.revisionCount+" revisions",'<div class="table-wrap"><table><thead><tr><th>Seq</th><th>Revision</th><th>Data date</th><th>Avg finish variance d</th><th>Max delay d</th><th>Late</th><th>Early</th><th>On time</th><th>Neg. float</th><th>Critical</th><th>Completion variance d</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderProgressBreakdownVisual(data){
  const p=projectionFor(data,"progress_breakdown");
  if(!Array.isArray(p.rows))return"";
  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.wbsId)+'</b><br><span class="muted">'+escapeHtml(r.wbsName||"")+'</span></td><td>'+escapeHtml(r.activityCount)+'</td><td>'+escapeHtml(r.completedCount)+'</td><td>'+escapeHtml(r.inProgressCount)+'</td><td>'+escapeHtml(r.notStartedCount)+'</td><td>'+escapeHtml(r.durationWeightedProgressPercent===null?"—":fmt(r.durationWeightedProgressPercent)+"%")+'</td><td>'+escapeHtml(r.durationWeightedCoveragePercent===null?"—":fmt(r.durationWeightedCoveragePercent)+"%")+'</td><td>'+escapeHtml(r.criticalCount)+'</td><td>'+escapeHtml(r.nearCriticalCount)+'</td><td>'+escapeHtml(r.negativeFloatCount)+'</td></tr>').join("");
  return visualSection("WBS Progress Breakdown","Duration-weighted progress, coverage and schedule pressure by WBS without averaging unknown values as zero.",p.totalActivityCount+" activities",'<div class="table-wrap"><table><thead><tr><th>WBS</th><th>Activities</th><th>Complete</th><th>In progress</th><th>Not started</th><th>Weighted progress</th><th>Coverage</th><th>Critical</th><th>Near-critical</th><th>Neg. float</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderMilestonesVisual(data){
  const p=projectionFor(data,"milestones");
  if(!Array.isArray(p.rows))return"";
  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.activityId)+'</b><br><span class="muted">'+escapeHtml(r.name||"")+'</span></td><td>'+escapeHtml(r.status)+'</td><td>'+escapeHtml(r.baselineDateIso||"—")+'</td><td>'+escapeHtml(r.currentDateIso||"—")+'</td><td>'+escapeHtml(r.actualDateIso||"—")+'</td><td>'+escapeHtml(fmt(r.varianceDays))+'</td><td>'+escapeHtml(fmt(r.totalFloatHours))+'</td><td>'+escapeHtml(fmt(r.daysFromDataDate))+'</td></tr>').join("");
  return visualSection("Milestone Position","Baseline, current and actual milestone dates remain separate, with direct variance and float visibility.",p.lateOpenCount+" late open",'<div class="position-grid" style="margin-bottom:14px">'+[
    ["Milestones",p.milestoneCount],["Completed",p.completedCount],["Open",p.openCount],["Late open",p.lateOpenCount]
  ].map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(fmt(c[1]))+'</div></div>').join("")+'</div><div class="table-wrap"><table><thead><tr><th>Milestone</th><th>Status</th><th>Baseline</th><th>Current</th><th>Actual</th><th>Variance d</th><th>Total float h</th><th>Days from DD</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderNearCriticalVisual(data){
  const p=projectionFor(data,"near_critical");
  if(!Array.isArray(p.rows))return"";
  const rows=p.rows.map(r=>'<tr><td><b>'+escapeHtml(r.activityId)+'</b><br><span class="muted">'+escapeHtml(r.name||"")+'</span></td><td>'+escapeHtml(r.status)+'</td><td>'+escapeHtml(fmt(r.totalFloatHours))+'</td><td>'+escapeHtml(r.baselineFinishIso||"—")+'</td><td>'+escapeHtml(r.currentFinishIso||"—")+'</td><td>'+escapeHtml(r.percentComplete===null?"—":fmt(r.percentComplete)+"%")+'</td></tr>').join("");
  return visualSection("Near-Critical Watchlist","Activities inside the governed near-critical float band, shown with current finish and progress.",p.nearCriticalCount+" activities",'<div class="table-wrap"><table><thead><tr><th>Activity</th><th>Status</th><th>Total float h</th><th>Baseline finish</th><th>Current finish</th><th>Progress</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderManhourVisual(data){
  const p=projectionFor(data,"manhour_scurve");
  if(!Array.isArray(p.points))return"";
  const chart=renderLineChart(p.points,[
    {key:"plannedCumulativeHours",label:"Planned hours",color:"#2357d9"},
    {key:"actualCumulativeHours",label:"Actual hours",color:"#d97706"},
    {key:"forecastCumulativeHours",label:"Forecast hours",color:"#0f766e"}
  ]);
  const top='<div class="position-grid" style="margin-bottom:14px">'+[
    ["Planned known",p.plannedHoursKnown+" h"],["Planned coverage",p.plannedAssignmentCoveragePercent===null?"—":fmt(p.plannedAssignmentCoveragePercent)+"%"],["Actual known",p.actualHoursKnownCurrent+" h"],["Actual coverage",p.actualAssignmentCoveragePercent===null?"—":fmt(p.actualAssignmentCoveragePercent)+"%"],["Remaining known",p.remainingHoursKnown+" h"],["Actual history",p.actualHistoryMethod]
  ].map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(fmt(c[1]))+'</div></div>').join("")+'</div>';
  return visualSection("Man-Hour S-Curve","Labor work units only; actual history uses stored periods when available and never fabricates missing history.",p.actualState,top+chart);
}
function renderForecastHistoryVisual(data){
  const p=projectionFor(data,"forecast_history");
  if(!Array.isArray(p.points))return"";
  const rows=p.points.map(x=>'<tr><td>'+escapeHtml(x.dataDateIso||"—")+'</td><td>'+escapeHtml(x.sourceRevisionId)+'</td><td>'+escapeHtml(x.sourceForecastCompletionIso||"—")+'</td><td>'+escapeHtml(x.independentForecastCompletionIso||"—")+'</td><td>'+escapeHtml(fmt(x.movementDaysVsPrevious))+'</td><td>'+escapeHtml(fmt(x.movementDaysVsFirst))+'</td><td>'+escapeHtml(x.origin)+'</td><td>'+escapeHtml((x.assumptions||[]).join("; ")||"—")+'</td></tr>').join("");
  return visualSection("Forecast History","Independent forecast movement across controlled snapshots; source and independent dates remain separate.",p.establishedForecastCount+" established",'<div class="table-wrap"><table><thead><tr><th>Data date</th><th>Revision</th><th>Source forecast</th><th>Independent forecast</th><th>Move vs previous d</th><th>Move vs first d</th><th>Origin</th><th>Assumptions</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
}
function renderNoticesClaimsVisual(data){
  const p=projectionFor(data,"notices_claims");
  if(!Array.isArray(p.events)||!Array.isArray(p.claims))return"";
  const totals='<div class="position-grid" style="margin-bottom:14px">'+[
    ["Timely notices",p.timelyNoticeCount],["Late notices",p.lateNoticeCount],["Missing notices",p.missingNoticeCount],["Official assessed days",p.officialAssessedDaysTotal],["Candidate/provisional days",p.provisionalOrCandidateAssessedDaysTotal],["Official assessed amount",p.officialAssessedAmountTotal],["Candidate/provisional amount",p.provisionalOrCandidateAssessedAmountTotal]
  ].map(c=>'<div class="position-card"><div class="position-label">'+escapeHtml(c[0])+'</div><div class="position-value">'+escapeHtml(fmt(c[1]))+'</div></div>').join("")+'</div>';
  const events='<div class="nested-title">Notice compliance by event</div><div class="table-wrap"><table><thead><tr><th>Event</th><th>Responsibility</th><th>Start</th><th>Notice</th><th>Required days</th><th>Elapsed days</th><th>Timeliness</th><th>Claims</th></tr></thead><tbody>'+
    p.events.map(e=>'<tr><td><b>'+escapeHtml(e.eventId)+'</b><br><span class="muted">'+escapeHtml(e.title||"")+'</span></td><td>'+escapeHtml(e.responsibility)+'</td><td>'+escapeHtml(e.eventStartIso||"—")+'</td><td>'+escapeHtml(e.noticeIssuedAt||"—")+'</td><td>'+escapeHtml(fmt(e.requiredNoticeDays))+'</td><td>'+escapeHtml(fmt(e.elapsedNoticeDays))+'</td><td><span class="state-pill '+(e.noticeTimeliness==="timely"?"ready":e.noticeTimeliness==="late"?"blocked":"review")+'">'+escapeHtml(e.noticeTimeliness)+'</span></td><td>'+escapeHtml((e.linkedClaimIds||[]).join(", ")||"—")+'</td></tr>').join("")+
    '</tbody></table></div>';
  const claims='<div class="nested-title" style="margin-top:14px">Claim state & assessment authority</div><div class="table-wrap"><table><thead><tr><th>Claim</th><th>State</th><th>Submitted</th><th>Claimed days</th><th>Assessed days</th><th>Days authority</th><th>Claimed amount</th><th>Assessed amount</th><th>Amount authority</th></tr></thead><tbody>'+
    p.claims.map(c=>'<tr><td><b>'+escapeHtml(c.claimId)+'</b><br><span class="muted">'+escapeHtml(c.title||"")+'</span></td><td>'+escapeHtml(c.state)+'</td><td>'+escapeHtml(c.submittedAt||"—")+'</td><td>'+escapeHtml(fmt(c.claimedDays))+'</td><td>'+escapeHtml(fmt(c.assessedDays))+'</td><td>'+escapeHtml(c.assessedDaysState)+'</td><td>'+escapeHtml(fmt(c.claimedAmount))+'</td><td>'+escapeHtml(fmt(c.assessedAmount))+'</td><td>'+escapeHtml(c.assessedAmountState)+'</td></tr>').join("")+
    '</tbody></table></div>';
  return visualSection("Notices, EOT & Claims","Actual notice timestamps drive timeliness; claimed and assessed values stay separate by authority.",p.claimCount+" claims",totals+events+claims);
}
function renderSpecializedModule(key,data){
  if(key==="pmo-analysis")return renderPmoVisual(data);
  if(key==="schedule-analytics")return renderScheduleAnalyticsVisual(data);
  if(key==="activity-analytics")return renderActivityAnalyticsVisual(data);
  if(key==="resource-utilization")return renderResourceVisual(data);
  if(key==="lookahead-schedule")return renderLookAheadVisual(data);
  if(key==="progress-report")return renderProgressReportVisual(data);
  if(key==="schedule-change-report")return renderScheduleChangeVisual(data);
  if(key==="revision-trend")return renderRevisionTrendVisual(data);
  if(key==="variance-trends")return renderVarianceTrendVisual(data);
  if(key==="progress-scurve")return renderProgressScurveVisual(data);
  if(key==="quantity-scurve")return renderQuantityScurveVisual(data);
  if(key==="progress-breakdown")return renderProgressBreakdownVisual(data);
  if(key==="milestones")return renderMilestonesVisual(data);
  if(key==="near-critical")return renderNearCriticalVisual(data);
  if(key==="manhour-scurve")return renderManhourVisual(data);
  if(key==="forecast-history")return renderForecastHistoryVisual(data);
  if(key==="independent-forecast")return renderForecastVisual(data);
  if(key==="delay-claims")return renderDelayClaimsVisual(data);
  if(key==="notices-claims")return renderNoticesClaimsVisual(data);
  if(key==="windows-analysis")return renderWindowsVisual(data);
  if(key==="eot-assessment")return renderEotVisual(data);
  return"";
}
function findProjectionRoot(data){
  if(!data||typeof data!=="object")return data||{};
  if(data.projectionKey)return data;
  const direct=Object.values(data).find(value=>value&&typeof value==="object"&&!Array.isArray(value)&&value.projectionKey);
  return direct||data;
}
function renderModuleBasis(data){
  const root=findProjectionRoot(data);
  const revision=root.sourceRevisionId||root.evidenceRevisionId||root.scheduleRevisionId||root.boqRevisionId||root.basisRevisionId||root.forecast?.basisRevisionId||null;
  const asOf=root.dataDateIso||root.asOfIso||root.generatedAt||null;
  const authority=root.authority||root.forecast?.authority||root.seriesContract?.authority||null;
  const coverage=root.activityCoveragePercent??root.currentDateCoveragePercent??root.coveragePercent??root.floatCoveragePercent??root.progress?.durationWeightedProgressCoveragePercent??root.schedule?.floatCoveragePercent??null;
  const projectId=root.projectId||null;
  const values=[
    ["Project",projectId],
    ["Basis revision",revision],
    ["As of",asOf],
    ["Authority",authority],
    ["Coverage",typeof coverage==="number"?fmt(coverage)+"%":coverage]
  ].filter(([,value])=>value!==null&&value!==undefined&&String(value).length>0);
  if(!values.length)return"";
  return '<div class="module-basis">'+values.map(([label,value])=>'<span class="basis-chip"><b>'+escapeHtml(label)+'</b><strong>'+escapeHtml(value)+'</strong></span>').join("")+'</div>';
}
function renderStructuredSections(data){
  if(!data||typeof data!=="object")return"";
  const complex=Object.entries(data).filter(([key,value])=>key!=="challenge"&&!isScalarValue(value));
  return complex.map(([key,value])=>{
    const count=Array.isArray(value)?value.length:null;
    return '<section class="data-section"><div class="data-section-head"><h4>'+escapeHtml(humanizeKey(key))+'</h4>'+(count===null?'':'<span class="badge">'+escapeHtml(count)+' records</span>')+'</div><div class="data-section-body">'+renderStructuredValue(value,0)+'</div></section>';
  }).join("");
}
function renderModuleResult(result){const moduleName=names[result.key]||result.key;el("moduleTitle").textContent=moduleName;el("topbarModule").textContent=moduleName;el("moduleBadge").className="badge "+statusClass(result.status);el("moduleBadge").textContent=result.status;if(result.status==="blocked"){el("moduleContent").innerHTML='<div class="notice warn"><b>Blocked by evidence dependency</b><br>'+escapeHtml(result.reason||"Required evidence is not established.")+'</div><div class="scalar-grid">'+(result.dependencies||[]).map(x=>'<div class="scalar"><b>Required</b><span>'+escapeHtml(x)+'</span></div>').join("")+'</div>';return}const data=result.data||{};if(result.key==="challenge-contract"&&renderDeliveryChallenge(data,result.reason))return;const basisHtml=renderModuleBasis(data);const challengeHtml=renderUniversalChallenge(data.challenge);const specialized=renderSpecializedModule(result.key,data);const scalars=scalarPairs(data).filter(([k])=>k!=="challenge").map(([k,v])=>'<div class="scalar"><b>'+escapeHtml(humanizeKey(k))+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("");const structured=renderStructuredSections(data);const genericView=(scalars?'<div class="scalar-grid">'+scalars+'</div>':'')+structured;const primaryView=specialized||genericView;const evidenceDetail=specialized&&structured?'<details class="technical-payload"><summary>Full evidence-backed detail</summary><div style="padding:0 12px 12px">'+structured+'</div></details>':'';el("directorDrawer").open=result.key==="pmo-analysis";el("moduleContent").innerHTML=basisHtml+(result.reason?'<div class="notice info">'+escapeHtml(result.reason)+'</div>':'')+challengeHtml+primaryView+evidenceDetail+'<details class="technical-payload"><summary>Technical payload</summary><pre>'+escapeHtml(JSON.stringify(data,null,2))+'</pre></details>'}
async function loadModule(key){if(!overview){el("moduleContent").innerHTML='<div class="empty">Load a project first.</div>';return}setBusy("Calculating "+names[key]);try{const result=await api("/api/projects/"+encodeURIComponent(project())+"/schedule/modules/"+encodeURIComponent(key));renderModuleResult(result)}catch(e){const d=e.data||{};renderModuleResult({key,status:"blocked",reason:d.reason||d.error||e.message,dependencies:d.dependencies||[]})}finally{setBusy("")}}
function kpi(label,value,sub=""){return'<div class="card kpi-card"><div class="kpi-label">'+escapeHtml(label)+'</div><div class="kpi-value">'+escapeHtml(fmt(value))+'</div><div class="kpi-sub">'+escapeHtml(sub)+'</div></div>'}
function evidenceCount(state,value){if(state==="established")return fmt(value);if(state==="submitted_unparsed")return"Source submitted · count not established";return"Not submitted"}
function renderDirector(d){if(!d){el("director").innerHTML='<div class="card"><div class="empty">Director position will populate only when its governed schedule, contract, claims/EOT and commercial dependencies are available.</div></div>';return}const s=d.schedule,c=d.claims,ctrl=d.controls;let html='<div class="grid kpi">'+kpi("Data Date",s.dataDateIso)+kpi("Independent Forecast",s.independentForecastCompletionIso)+kpi("Official Completion",s.officialAdjustedCompletionIso||s.contractualCompletionIso)+kpi("Programme movement",c.observedProgrammeMovementDays,"days carried from schedule windows")+kpi("Time-impact candidate",c.analyticalTimeImpactCandidateDays,"analytical, not entitlement")+kpi("Attributable EOT candidate",c.attributableCandidateEotDays,"analytical, not awarded")+kpi("Official EOT",c.officialApprovedEotDays,"governed award only")+kpi("CPM integrity",s.independentCpmState,s.drivingPathState)+kpi("Claims linked",c.fullyLinkedClaimCount+" / "+c.claimCount,"claim → event → activity")+kpi("LD Scenario",d.ld.cappedAmount===null?"—":fmt(d.ld.cappedAmount)+" "+(d.ld.currency||""),d.ld.state)+'</div>';html+='<div class="grid two"><div class="card"><h3>Commercial exposure by currency</h3><div class="grid three">';(d.commercialByCurrency||[]).forEach(r=>{html+='<div class="currency-card"><div class="currency-code">'+escapeHtml(r.currency)+'</div>'+[["Pending variations",r.pendingVariationAmount],["Approved variations",r.approvedVariationAmount],["Certified unpaid",r.certifiedUnpaidAmount],["Retention held",r.retentionHeldAmount],["Active bonds",r.activeBondAmount],["Claimed",r.claimClaimedAmount],["LD scenario",r.ldScenarioAmount]].map(x=>'<div class="currency-line"><span>'+x[0]+'</span><strong>'+escapeHtml(fmt(x[1]))+'</strong></div>').join("")+'</div>'});html+='</div></div><div class="card"><h3>Management actions</h3><div class="actions">'+((d.managementActions||[]).length?d.managementActions.map(a=>'<div class="action">'+escapeHtml(a)+'</div>').join(""):'<div class="empty">No current actions generated.</div>')+'</div><div style="margin-top:14px" class="scalar-grid">'+'<div class="scalar"><b>Open HSE</b><span>'+escapeHtml(evidenceCount(ctrl.hseEvidenceState,ctrl.openHseIncidentCount))+'</span></div>'+'<div class="scalar"><b>LTI or worse</b><span>'+escapeHtml(evidenceCount(ctrl.hseEvidenceState,ctrl.openLtiOrWorseCount))+'</span></div>'+'<div class="scalar"><b>Major / critical NCR</b><span>'+escapeHtml(evidenceCount(ctrl.qualityEvidenceState,ctrl.openCriticalMajorNcrCount))+'</span></div>'+'<div class="scalar"><b>Overdue RFI</b><span>'+escapeHtml(evidenceCount(ctrl.rfiEvidenceState,ctrl.overdueRfiCount))+'</span></div>'+'<div class="scalar"><b>Permit issues</b><span>'+escapeHtml(evidenceCount(ctrl.permitEvidenceState,ctrl.overduePermitCount))+'</span></div>'+'<div class="scalar"><b>Expiring bonds</b><span>'+escapeHtml(evidenceCount(ctrl.bondEvidenceState,ctrl.expiringBondCount30Days))+'</span></div>'+'<div class="scalar"><b>Open risks</b><span>'+escapeHtml(evidenceCount(ctrl.riskEvidenceState,ctrl.openRiskCount))+'</span></div>'+'</div></div></div>';el("director").innerHTML=html}
function renderStatus(o){const ready=o.moduleStates.filter(x=>x.status==="ready").length,partial=o.moduleStates.filter(x=>x.status==="partial").length,blocked=o.moduleStates.filter(x=>x.status==="blocked").length;el("projectBadge").className="badge "+(o.demo?"partial":"ready");el("projectBadge").textContent=o.demo?"CERTIFIED DEMO":"USER PROJECT";el("projectStatus").innerHTML='<div class="scalar-grid">'+'<div class="scalar"><b>Baseline / revised baseline</b><span>'+fmt(o.baselineRevisionCount)+'</span></div>'+'<div class="scalar"><b>Updates</b><span>'+fmt(o.updateRevisionCount)+'</span></div>'+'<div class="scalar"><b>Recovery scenarios</b><span>'+fmt(o.recoveryRevisionCount)+'</span></div>'+'<div class="scalar"><b>Current Data Date</b><span>'+fmt(o.latestDataDateIso)+'</span></div>'+'<div class="scalar"><b>Evidence documents</b><span>'+fmt(o.evidenceDocumentCount)+'</span></div>'+'<div class="scalar"><b>Ready modules</b><span>'+ready+' / 22</span></div>'+'<div class="scalar"><b>Partial</b><span>'+partial+'</span></div>'+'<div class="scalar"><b>Blocked</b><span>'+blocked+'</span></div>'+'</div>'}
function renderScheduleQueue(){el("scheduleQueue").innerHTML=scheduleSelection.map((file,i)=>'<div class="queue-row"><span class="queue-name">'+escapeHtml(file.name)+'</span><select class="schedule-role" data-index="'+i+'"><option value="baseline" '+(inferScheduleRole(file.name)==="baseline"?"selected":"")+'>Baseline</option><option value="update" '+(inferScheduleRole(file.name)==="update"?"selected":"")+'>Update</option><option value="revised_baseline" '+(inferScheduleRole(file.name)==="revised_baseline"?"selected":"")+'>Revised baseline</option><option value="recovery" '+(inferScheduleRole(file.name)==="recovery"?"selected":"")+'>Recovery</option></select></div>').join("")}
function renderContractQueue(){el("contractQueue").innerHTML=contractSelection.map((file,i)=>{const role=inferContractRole(file.name);return'<div class="queue-row"><span class="queue-name">'+escapeHtml(file.name)+'</span><select class="contract-role" data-index="'+i+'"><option value="main" '+(role==="main"?"selected":"")+'>Main</option><option value="amendment" '+(role==="amendment"?"selected":"")+'>Amendment</option><option value="appendix" '+(role==="appendix"?"selected":"")+'>Appendix</option><option value="tender" '+(role==="tender"?"selected":"")+'>Tender/ER</option><option value="other" '+(role==="other"?"selected":"")+'>Other</option></select></div>'}).join("")}
function renderSimpleQueue(target,files){el(target).innerHTML=files.map(file=>'<div class="queue-row" style="grid-template-columns:1fr"><span class="queue-name">'+escapeHtml(file.name)+'</span></div>').join("")}
async function loadEvidence(){if(!overview){el("evidenceBadge").textContent="0 documents";el("evidenceLibrary").innerHTML='<div class="empty">No project evidence has been registered.</div>';return}try{const data=await api("/api/projects/"+encodeURIComponent(project())+"/evidence/documents");el("evidenceBadge").className="badge "+(data.documentCount?"ready":"");el("evidenceBadge").textContent=data.documentCount+" documents";if(!data.documentCount){el("evidenceLibrary").innerHTML='<div class="empty">No uploaded user evidence in this project yet.</div>';return}el("evidenceLibrary").innerHTML='<div class="table-wrap"><table><thead><tr><th>File</th><th>Content identified as</th><th>Change effect</th><th>Confidence</th><th>Read method</th><th>Metadata conflict</th><th>Parser</th><th>Schedule role</th><th>Activity mapping</th></tr></thead><tbody>'+data.documents.map(d=>{const m=d.mapping;const i=d.identification||{};const mapping=!m||m.linkedActivityCount===null?"—":fmt(m.mappedActivityCount)+" / "+fmt(m.linkedActivityCount)+(m.coveragePercent===null?"":" ("+fmt(m.coveragePercent)+"%)");const confidence=i.confidence===undefined?"—":fmt(i.confidence*100)+"%";const conflict=i.classificationConflict?"YES":"No";const method=(i.method||"—")+(i.ocrUsed?" / OCR":"");const title=i.detectedTitle?'<br><span class="muted">'+escapeHtml(i.detectedTitle)+'</span>':"";return'<tr><td><b>'+escapeHtml(d.sourceFilename)+'</b><br><span class="muted">'+escapeHtml(d.sourceRelativePath||"")+'</span></td><td><b>'+escapeHtml(d.category)+'</b><br>'+escapeHtml(d.documentType)+title+'</td><td>'+escapeHtml(d.lineage?.effect||"unknown")+(d.lineage?.replacesEntireBasis?'<br><span class="badge partial">replaces basis</span>':d.lineage?.appliesAsDelta?'<br><span class="badge">delta</span>':'')+'</td><td>'+escapeHtml(confidence)+(i.needsReview?'<br><span class="badge partial">review</span>':'')+'</td><td>'+escapeHtml(method)+'</td><td>'+escapeHtml(conflict)+'</td><td>'+escapeHtml(d.parserState)+'</td><td>'+escapeHtml(d.scheduleRole||"—")+'</td><td>'+escapeHtml(mapping)+'</td></tr>'}).join("")+'</tbody></table></div>'}catch(e){el("evidenceLibrary").innerHTML='<div class="notice warn">Evidence library could not be loaded: '+escapeHtml(e.message)+'</div>'}}
async function refresh(bootstrapDemo=true){setBusy("Refreshing project");try{overview=await api("/api/projects/"+encodeURIComponent(project())+"/overview");renderStatus(overview);renderNav();let director=null;try{director=await api("/api/projects/"+encodeURIComponent(project())+"/director-position")}catch{}renderDirector(director);await loadEvidence();await loadModule(selected);localStorage.setItem("cmeng-project",project())}catch(e){if(bootstrapDemo&&e.status===404&&project()==="UAT-DEMO"){try{await api("/api/projects/UAT-DEMO/demo",{method:"POST"});return await refresh(false)}catch{}}overview=null;renderNav();renderDirector(null);el("projectStatus").innerHTML='<div class="notice warn">Project is not loaded yet. Upload evidence or load the certified demo.</div>';el("projectBadge").className="badge blocked";el("projectBadge").textContent="NO PROJECT";await loadEvidence()}finally{setBusy("")}}
async function loadDemo(){setBusy("Loading certified demo");try{el("projectId").value="UAT-DEMO";localStorage.setItem("cmeng-project","UAT-DEMO");await api("/api/projects/UAT-DEMO/demo",{method:"POST"});selected="pmo-analysis";await refresh(false);el("uploadMessage").innerHTML='<div class="notice info">Certified demo loaded in the isolated UAT-DEMO project. User projects are never replaced by demo data.</div>'}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadSchedules(){if(!scheduleSelection.length)return;setBusy("Uploading schedule revisions");const roles=[...document.querySelectorAll(".schedule-role")].reduce((a,s)=>{a[Number(s.dataset.index)]=s.value;return a},{});const results=[];try{for(let i=0;i<scheduleSelection.length;i+=1){const file=scheduleSelection[i];const headers={"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.name,"x-evidence-category":"schedule","x-upload-intent":el("scheduleIntent").value,"x-schedule-role":roles[i]||inferScheduleRole(file.name)};results.push(await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers,body:file}))}el("uploadMessage").innerHTML='<div class="notice info">'+results.length+' schedule revision(s) accepted. Baselines/updates form official history; recovery remains a separate scenario.</div>';scheduleSelection=[];el("scheduleFiles").value="";renderScheduleQueue();await refresh(false)}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadBoqs(){if(!boqSelection.length)return;setBusy("Uploading BOQ revisions");let count=0;try{for(const file of boqSelection){await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers:{"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.name,"x-evidence-category":"boq_cost","x-document-type":"boq","x-upload-intent":el("boqIntent").value},body:file});count+=1}el("uploadMessage").innerHTML='<div class="notice info">'+count+' BOQ revision(s) accepted and retained.</div>';boqSelection=[];el("boqFiles").value="";renderSimpleQueue("boqQueue",boqSelection);await refresh(false)}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadContracts(){if(!contractSelection.length)return;setBusy("Uploading contract family");const roles=[...document.querySelectorAll(".contract-role")].reduce((a,s)=>{a[Number(s.dataset.index)]=s.value;return a},{});let count=0;try{for(let i=0;i<contractSelection.length;i+=1){const file=contractSelection[i];const role=roles[i]||inferContractRole(file.name);const docType=role==="main"?"main_contract":role==="amendment"?"contract_amendment":role==="appendix"?"contract_appendix":role==="tender"?"tender_employer_requirements":"contract_supporting_document";await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers:{"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.name,"x-evidence-category":"contract","x-document-type":docType,"x-upload-intent":el("contractIntent").value},body:file});count+=1}el("uploadMessage").innerHTML='<div class="notice info">'+count+' contract-family document(s) accepted. Amendments are retained separately from the base contract.</div>';contractSelection=[];el("contractFiles").value="";renderContractQueue();await refresh(false)}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadEvidence(){if(!evidenceSelection.length)return;setBusy("Uploading project evidence");let documentCount=0;try{for(const file of evidenceSelection){const result=await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers:{"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.webkitRelativePath||file.name,"x-upload-intent":el("evidenceIntent").value},body:file});documentCount+=result.documentCount||1}el("uploadMessage").innerHTML='<div class="notice info">'+documentCount+' evidence document(s) registered. Known schedule/BOQ/contract files were parsed; other files were classified, preserved and mapped to schedule activities where explicit activity IDs exist.</div>';evidenceSelection=[];el("evidenceFiles").value="";renderSimpleQueue("evidenceQueue",evidenceSelection);await refresh(false)}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
el("loadDemo").onclick=loadDemo;el("refresh").onclick=()=>refresh(false);
function openEvidenceWorkspace(){
  setFocusMode(false);
  const drawer=el("evidenceControlDrawer");
  drawer.open=true;
  drawer.scrollIntoView({behavior:"smooth",block:"start"});
}
function openEvidenceLibrary(){
  setFocusMode(false);
  const drawer=el("evidenceLibraryDrawer");
  drawer.open=true;
  drawer.scrollIntoView({behavior:"smooth",block:"start"});
}
el("openEvidenceTop").onclick=openEvidenceWorkspace;
el("openEvidenceHero").onclick=openEvidenceWorkspace;
el("openEvidenceQuick").onclick=openEvidenceWorkspace;
el("openLibraryQuick").onclick=openEvidenceLibrary;
function setFocusMode(enabled){document.body.classList.toggle("focus-module",enabled);el("focusMode").classList.toggle("active",enabled);el("focusMode").setAttribute("aria-pressed",String(enabled));el("focusMode").textContent=enabled?"Exit focus":"Focus module";localStorage.setItem("cmeng-focus",enabled?"1":"0")}
el("focusMode").onclick=()=>setFocusMode(!document.body.classList.contains("focus-module"));
async function loadRelease(){try{const health=await api("/health");const short=health.release?String(health.release).slice(0,7):"runtime";el("releaseStatus").textContent="Production · "+short}catch{el("releaseStatus").textContent="Production"}}

el("scheduleFiles").onchange=e=>{scheduleSelection=[...e.target.files];renderScheduleQueue()};
el("boqFiles").onchange=e=>{boqSelection=[...e.target.files];renderSimpleQueue("boqQueue",boqSelection)};
el("contractFiles").onchange=e=>{contractSelection=[...e.target.files];renderContractQueue()};
el("evidenceFiles").onchange=e=>{evidenceSelection=[...e.target.files];renderSimpleQueue("evidenceQueue",evidenceSelection)};
el("uploadSchedules").onclick=uploadSchedules;el("uploadBoqs").onclick=uploadBoqs;el("uploadContracts").onclick=uploadContracts;el("uploadEvidence").onclick=uploadEvidence;
const storedProject=localStorage.getItem("cmeng-project");const storedModule=localStorage.getItem("cmeng-module");if(storedModule&&names[storedModule])selected=storedModule;el("projectId").value=storedProject||"UAT-DEMO";el("projectId").addEventListener("change",()=>refresh(true));setFocusMode(localStorage.getItem("cmeng-focus")==="1");renderNav();loadRelease();refresh(true);
</script>
</body>
</html>`;
}
