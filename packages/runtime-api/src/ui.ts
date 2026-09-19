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
  --soft:#f7f9fc;--soft-blue:#f3f7ff;--shadow:0 1px 2px rgba(15,23,42,.04),0 10px 28px rgba(15,23,42,.06);
  --shadow-strong:0 18px 50px rgba(15,23,42,.08)
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
.main{min-width:0}.topbar{min-height:72px;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:11px;padding:12px 30px;position:sticky;top:0;z-index:10}
.project-input{display:flex;align-items:center;gap:9px;min-width:350px}.project-input label{font-size:12px;color:var(--muted);font-weight:750;text-transform:uppercase;letter-spacing:.04em}.project-input input{height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 12px;min-width:220px;background:#fff;color:var(--ink);font-weight:650;outline:none}.project-input input:focus{border-color:#7aa2ff;box-shadow:0 0 0 3px rgba(35,87,217,.11)}
.btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:9px 14px;font-weight:700;font-size:13px;color:#334155;min-height:40px}.btn:hover{background:#f8fafc}.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 3px 10px rgba(35,87,217,.17)}.btn.primary:hover{background:var(--accent-strong)}.btn.small{padding:7px 11px;font-size:12px;min-height:34px}
.content{padding:28px 32px 64px;width:100%;max-width:none;margin:0}
.workspace-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.page-title{margin:0}.page-title .eyebrow,.section-kicker{display:block;font-size:11px;color:#617086;text-transform:uppercase;letter-spacing:.095em;font-weight:800;margin-bottom:6px}.page-title h2{font-size:29px;line-height:1.15;letter-spacing:-.035em;margin:0 0 7px}.page-title p{margin:0;color:var(--muted);font-size:14px;max-width:780px}
.grid{display:grid;gap:14px}.grid.kpi{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:16px}.grid.two{grid-template-columns:minmax(0,1.45fr) minmax(320px,1fr)}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow);padding:19px}.card h3{font-size:16px;line-height:1.25;margin:0 0 13px;letter-spacing:-.01em}.kpi-card{padding:17px 18px;min-height:112px}.kpi-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.055em;margin-bottom:9px;font-weight:750}.kpi-value{font-size:25px;font-weight:780;letter-spacing:-.035em;line-height:1.08}.kpi-sub{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.35}
.badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.045em;background:#f2f4f7;color:#475467;white-space:nowrap}.badge.ready{background:#ecfdf3;color:var(--ok)}.badge.partial{background:#fffaeb;color:var(--warn)}.badge.blocked{background:#fef3f2;color:var(--danger)}
.module-panel{padding:0;margin:0;overflow:hidden;border-radius:16px;box-shadow:var(--shadow-strong);min-height:560px}.module-panel>.module-head{padding:20px 22px 18px;border-bottom:1px solid var(--line);margin:0;background:linear-gradient(180deg,#fff,#fbfcfe)}.module-workspace-head>div{min-width:0}.module-workspace-head h3{font-size:24px;margin:0 0 4px;letter-spacing:-.025em}.module-workspace-head p{margin:0;color:var(--muted);font-size:13px}.module-panel #moduleContent{padding:22px;min-height:470px;background:#fbfcfe}
.module-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:13px}.module-head h3{font-size:18px;margin:0}
.director-section{margin-top:24px}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:14px;margin:0 0 12px}.section-heading h3{font-size:20px;margin:0 0 3px;letter-spacing:-.02em}.section-heading p{font-size:13px;color:var(--muted);margin:0}
.scalar-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:11px;margin-bottom:14px}.scalar{background:var(--soft);padding:13px 14px;border-radius:9px;border:1px solid #e7edf3;min-width:0}.scalar b{display:block;font-size:11.5px;color:var(--muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;font-weight:750}.scalar span{font-size:15px;font-weight:680;word-break:break-word}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px;max-height:560px;background:#fff}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#f6f8fb;color:#46556a;font-weight:780;position:sticky;top:0;z-index:1;font-size:12px;letter-spacing:.015em}tbody tr:hover td{background:#fbfdff}tr:last-child td{border-bottom:0}
.actions{display:flex;flex-direction:column;gap:8px}.action{padding:11px 13px;background:#fff8ed;border-left:3px solid #f79009;border-radius:7px;font-size:13px}
.empty{padding:34px;text-align:center;color:var(--muted);font-size:14px}.notice{padding:12px 14px;border-radius:9px;font-size:13px;margin:11px 0;line-height:1.45}.notice.info{background:#eff6ff;color:#1d4f91;border:1px solid #d9e8ff}.notice.warn{background:#fff9e8;color:#8a4b08;border:1px solid #f8e7b1}.notice.error{background:#fff1f0;color:#912018;border:1px solid #ffd8d3}
.upload-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.upload-box{border:1px solid #d9e2ec;border-radius:11px;padding:14px;background:#fafcff}.upload-box strong{font-size:13px;display:block;margin-bottom:5px}.upload-box small{color:var(--muted);display:block;margin-bottom:10px;line-height:1.45;font-size:12px}.upload-box input{width:100%;font-size:12px}.intent-control{display:flex;align-items:center;justify-content:space-between;gap:9px;margin:10px 0;padding:8px 9px;background:#f2f6fb;border-radius:8px}.intent-control span{font-size:11px;color:#607086;font-weight:750}.intent-control select{max-width:175px;height:32px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#334155;font-size:11.5px;padding:0 7px}
.wide-upload{margin-top:12px;border:1px solid #ccd9e8;border-radius:11px;padding:14px;background:#f7faff;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center}.wide-upload strong{font-size:13px;display:block;margin-bottom:4px}.wide-upload small{color:var(--muted);font-size:12px}.wide-upload input{font-size:12px;width:100%;margin-top:8px}
.queue{margin-top:9px;display:flex;flex-direction:column;gap:6px}.queue-row{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:8px;align-items:center;padding:8px 9px;border:1px solid var(--line);border-radius:7px;background:#fff}.queue-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.queue-row select{height:31px;border:1px solid #d0d5dd;border-radius:6px;font-size:11.5px}.upload-actions{display:flex;justify-content:flex-end;margin-top:10px}
.workspace-drawer{margin-top:20px;border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:var(--shadow);overflow:hidden}.workspace-drawer>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 18px;cursor:pointer;background:#fff}.workspace-drawer>summary::-webkit-details-marker{display:none}.workspace-drawer>summary strong{display:block;font-size:15px}.workspace-drawer>summary .section-kicker{margin-bottom:3px}.drawer-hint{font-size:12px;color:var(--accent);font-weight:750}.workspace-drawer[open] .drawer-hint{color:var(--muted)}.drawer-body{padding:0 18px 18px;background:#fbfcfe;border-top:1px solid var(--line)}.evidence-control-grid{grid-template-columns:minmax(280px,.62fr) minmax(0,1.5fr);align-items:start;padding-top:18px}.evidence-status-card{position:sticky;top:92px}.evidence-intake-card{min-width:0}
details:not(.workspace-drawer){border:1px solid var(--line);border-radius:9px;background:#fff}details:not(.workspace-drawer)>summary{padding:11px 13px;cursor:pointer;font-size:12.5px;font-weight:700}pre{margin:0;padding:13px;max-height:560px;overflow:auto;background:#0c1525;color:#d7e5ff;font-size:12px;line-height:1.55;border-radius:0 0 9px 9px;white-space:pre-wrap;word-break:break-word}
.currency-card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fff}.currency-code{font-size:17px;font-weight:820;margin-bottom:8px}.currency-line{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:5px 0;color:#526176}.currency-line strong{color:#152238}
.challenge-card{padding:0!important;overflow:hidden}.challenge-card .challenge-head{padding:17px 18px;border-bottom:1px solid var(--line)}.challenge-card .challenge-summary{padding:15px 18px 0}.challenge-card .challenge-table-wrap{margin:15px 18px 18px}.conflict-expand-row>td{padding:0;background:#f9fbff!important}.conflict-panel{padding:16px 18px;border-top:1px solid #dce7f5;border-bottom:1px solid #dce7f5;background:linear-gradient(180deg,#f8fbff,#f4f8ff)}.conflict-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.conflict-title strong{font-size:14px}.conflict-title p{margin:3px 0 0;color:var(--muted);font-size:12px}.candidate-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.candidate-card{border:1px solid #cedcf3;border-radius:10px;background:#fff;padding:13px}.candidate-card.recommended{border-color:#85a7f8;box-shadow:0 0 0 2px rgba(35,87,217,.08)}.candidate-value{font-size:20px;font-weight:790;letter-spacing:-.025em;margin:3px 0 9px}.candidate-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:11.5px;color:var(--muted)}.candidate-meta b{display:block;color:#435169;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}.candidate-sources{font-size:11.5px;color:#5d6b7e;margin-top:9px;word-break:break-word}.recommendation-card{margin-top:12px;padding:13px 14px;border-radius:10px;background:#eef4ff;border:1px solid #ccdcff;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.recommendation-card strong{display:block;font-size:16px;color:#173f9b;margin:3px 0}.recommendation-card p{margin:0;color:#53647b;font-size:12px;line-height:1.45}.recommendation-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:820;color:#315fbf}.decision-pill{flex:0 0 auto;background:#fff7e8;color:#8b4b08;border:1px solid #f6d99f;border-radius:999px;padding:6px 9px;font-size:10.5px;font-weight:820;text-transform:uppercase;letter-spacing:.04em}
.footer-note{font-size:12px;color:var(--muted);margin-top:22px;padding:0 2px}.muted{color:var(--muted)}
.spinner{width:14px;height:14px;border:2px solid #d0d5dd;border-top-color:var(--accent);border-radius:50%;display:inline-block;animation:spin .7s linear infinite;vertical-align:-2px}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1280px){.app{grid-template-columns:238px minmax(0,1fr)}.grid.three{grid-template-columns:1fr 1fr}.upload-row{grid-template-columns:1fr}.evidence-control-grid{grid-template-columns:1fr}.evidence-status-card{position:static}}
@media(max-width:900px){.app{display:block}.sidebar{position:relative;height:auto}.topbar{position:relative;flex-wrap:wrap;padding:13px 18px}.content{padding:20px 18px 48px}.project-input{min-width:0;width:100%;flex-wrap:wrap}.workspace-header{align-items:center}.grid.two,.grid.three{grid-template-columns:1fr}.module-panel #moduleContent{padding:16px}.module-panel>.module-head{padding:17px}.candidate-grid{grid-template-columns:1fr}}
@media(max-width:620px){.workspace-header{display:block}.workspace-header .badge{margin-top:10px}.grid.kpi{grid-template-columns:1fr 1fr}.scalar-grid{grid-template-columns:1fr}.wide-upload{grid-template-columns:1fr}.queue-row{grid-template-columns:1fr}.recommendation-card{display:block}.decision-pill{display:inline-flex;margin-top:10px}}
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
      <button class="btn primary" id="loadDemo">Load certified demo</button>
      <button class="btn" id="refresh">Refresh</button>
      <span id="globalStatus" style="margin-left:auto;font-size:12px;color:#667085"></span>
    </div>
    <div class="content">
      <div class="workspace-header">
        <div class="page-title">
          <span class="eyebrow">CMeng · controlled project intelligence</span>
          <h2>Project Control Workspace</h2>
          <p>Evidence-backed schedule, progress, forecast, claims and commercial analysis. Select a module on the left to work directly in the active analysis.</p>
        </div>
        <span id="projectBadge" class="badge">No project</span>
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

      <section class="director-section">
        <div class="section-heading">
          <div>
            <span class="section-kicker">Management position</span>
            <h3>Project Director</h3>
            <p>Current time, exposure and action position derived from the governed project basis.</p>
          </div>
        </div>
        <section id="director"></section>
      </section>

      <details class="workspace-drawer" id="evidenceControlDrawer">
        <summary>
          <div><span class="section-kicker">Evidence control</span><strong>Intake, basis intent and project status</strong></div>
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
function renderNav(){const states=new Map((overview?.moduleStates||[]).map(x=>[x.key,x]));let html="";Object.entries(groups).forEach(([group,keys])=>{html+='<div class="nav-group"><div class="nav-group-title">'+group+'</div>';keys.forEach(key=>{const st=states.get(key)?.status||"blocked";html+='<button class="nav-item '+(selected===key?"active":"")+'" data-key="'+key+'"><span class="nav-label">'+names[key]+'</span><span class="status-dot '+statusClass(st)+'"></span></button>'});html+='</div>'});el("nav").innerHTML=html;document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{selected=b.dataset.key;renderNav();loadModule(selected)})}
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
function renderModuleResult(result){el("moduleTitle").textContent=names[result.key]||result.key;el("moduleBadge").className="badge "+statusClass(result.status);el("moduleBadge").textContent=result.status;if(result.status==="blocked"){el("moduleContent").innerHTML='<div class="notice warn"><b>Blocked by evidence dependency</b><br>'+escapeHtml(result.reason||"Required evidence is not established.")+'</div><div class="scalar-grid">'+(result.dependencies||[]).map(x=>'<div class="scalar"><b>Required</b><span>'+escapeHtml(x)+'</span></div>').join("")+'</div>';return}const data=result.data||{};if(result.key==="challenge-contract"&&renderDeliveryChallenge(data,result.reason))return;const challengeHtml=renderUniversalChallenge(data.challenge);const scalars=scalarPairs(data).filter(([k])=>k!=="challenge").map(([k,v])=>'<div class="scalar"><b>'+escapeHtml(k)+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("");el("moduleContent").innerHTML=(result.reason?'<div class="notice info">'+escapeHtml(result.reason)+'</div>':'')+challengeHtml+'<div class="scalar-grid">'+scalars+'</div><details><summary>Evidence-backed module output</summary><pre>'+escapeHtml(JSON.stringify(data,null,2))+'</pre></details>'}
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
el("scheduleFiles").onchange=e=>{scheduleSelection=[...e.target.files];renderScheduleQueue()};
el("boqFiles").onchange=e=>{boqSelection=[...e.target.files];renderSimpleQueue("boqQueue",boqSelection)};
el("contractFiles").onchange=e=>{contractSelection=[...e.target.files];renderContractQueue()};
el("evidenceFiles").onchange=e=>{evidenceSelection=[...e.target.files];renderSimpleQueue("evidenceQueue",evidenceSelection)};
el("uploadSchedules").onclick=uploadSchedules;el("uploadBoqs").onclick=uploadBoqs;el("uploadContracts").onclick=uploadContracts;el("uploadEvidence").onclick=uploadEvidence;
const storedProject=localStorage.getItem("cmeng-project");el("projectId").value=storedProject||"UAT-DEMO";el("projectId").addEventListener("change",()=>refresh(true));renderNav();refresh(true);
</script>
</body>
</html>`;
}
