export function cmengUatHtml(): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CMeng | Project Control</title>
<style>
:root{
  --bg:#f4f6f8;--panel:#fff;--ink:#17202a;--muted:#667085;--line:#e4e7ec;
  --accent:#1d4ed8;--danger:#b42318;--warn:#b54708;--ok:#067647;
  --nav:#101828;--nav2:#1d2939;--soft:#f8fafc;--shadow:0 1px 2px rgba(16,24,40,.05),0 4px 14px rgba(16,24,40,.04)
}
*{box-sizing:border-box} body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}
button,input,select{font:inherit} button{cursor:pointer}
.app{display:grid;grid-template-columns:290px 1fr;min-height:100vh}
.sidebar{background:var(--nav);color:#fff;padding:22px 16px;position:sticky;top:0;height:100vh;overflow:auto}
.brand{padding:0 10px 20px;border-bottom:1px solid #344054;margin-bottom:18px}
.brand h1{font-size:22px;margin:0 0 4px}.brand p{margin:0;color:#98a2b3;font-size:12px;line-height:1.4}
.nav-group{margin:18px 0}.nav-group-title{font-size:11px;color:#98a2b3;text-transform:uppercase;letter-spacing:.08em;padding:0 10px 8px}
.nav-item{width:100%;border:0;background:transparent;color:#d0d5dd;text-align:left;padding:9px 10px;border-radius:7px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px}
.nav-item:hover,.nav-item.active{background:var(--nav2);color:#fff}.nav-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status-dot{width:8px;height:8px;border-radius:50%;background:#667085;flex:0 0 auto}.status-dot.ready{background:#32d583}.status-dot.partial{background:#fdb022}.status-dot.blocked{background:#f97066}
.main{min-width:0}.topbar{min-height:72px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:12px 28px;position:sticky;top:0;z-index:5}
.project-input{display:flex;align-items:center;gap:8px;min-width:360px}.project-input label{font-size:12px;color:var(--muted);font-weight:600}.project-input input{height:38px;border:1px solid #d0d5dd;border-radius:7px;padding:0 10px;min-width:210px}
.btn{border:1px solid #d0d5dd;background:#fff;border-radius:7px;padding:9px 13px;font-weight:600;font-size:13px;color:#344054}.btn:hover{background:#f9fafb}.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn.primary:hover{filter:brightness(.95)}.btn.small{padding:7px 10px;font-size:12px}
.content{padding:26px 28px 50px;max-width:1700px;margin:0 auto}.page-title{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
.page-title h2{font-size:25px;letter-spacing:-.02em;margin:0 0 5px}.page-title p{margin:0;color:var(--muted);font-size:13px}
.grid{display:grid;gap:14px}.grid.kpi{grid-template-columns:repeat(6,minmax(130px,1fr));margin-bottom:14px}.grid.two{grid-template-columns:1.45fr 1fr}.grid.three{grid-template-columns:repeat(3,1fr)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);padding:17px}.card h3{font-size:14px;margin:0 0 12px}.kpi-card{padding:15px}.kpi-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px}.kpi-value{font-size:23px;font-weight:700;letter-spacing:-.03em}.kpi-sub{font-size:11px;color:var(--muted);margin-top:5px}
.badge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;background:#f2f4f7;color:#475467}.badge.ready{background:#ecfdf3;color:var(--ok)}.badge.partial{background:#fffaeb;color:var(--warn)}.badge.blocked{background:#fef3f2;color:var(--danger)}
.upload-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.upload-box{border:1px dashed #cbd5e1;border-radius:9px;padding:13px;background:#fbfcfd}.upload-box strong{font-size:12px;display:block;margin-bottom:5px}.upload-box small{color:var(--muted);display:block;margin-bottom:9px;line-height:1.4}.upload-box input{width:100%;font-size:11px}
.wide-upload{margin-top:10px;border:1px dashed #94a3b8;border-radius:9px;padding:13px;background:#f8fafc;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.wide-upload strong{font-size:12px;display:block;margin-bottom:4px}.wide-upload small{color:var(--muted);font-size:11px}.wide-upload input{font-size:11px;width:100%;margin-top:7px}
.queue{margin-top:9px;display:flex;flex-direction:column;gap:6px}.queue-row{display:grid;grid-template-columns:minmax(0,1fr) 145px;gap:8px;align-items:center;padding:7px 8px;border:1px solid var(--line);border-radius:6px;background:#fff}.queue-name{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.queue-row select{height:30px;border:1px solid #d0d5dd;border-radius:6px;font-size:11px}
.upload-actions{display:flex;justify-content:flex-end;margin-top:9px}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px;max-height:420px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#f8fafc;color:#475467;font-weight:700;position:sticky;top:0}tr:last-child td{border-bottom:0}
.actions{display:flex;flex-direction:column;gap:8px}.action{padding:10px 12px;background:#fff7ed;border-left:3px solid #f79009;border-radius:5px;font-size:12px}
.empty{padding:30px;text-align:center;color:var(--muted);font-size:13px}.notice{padding:11px 12px;border-radius:7px;font-size:12px;margin:10px 0}.notice.info{background:#eff8ff;color:#175cd3}.notice.warn{background:#fffaeb;color:#93370d}.notice.error{background:#fef3f2;color:#912018}
.module-panel{margin-top:18px}.module-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.module-head h3{font-size:18px;margin:0}.scalar-grid{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin-bottom:12px}.scalar{background:var(--soft);padding:11px;border-radius:7px;border:1px solid #edf0f3}.scalar b{display:block;font-size:11px;color:var(--muted);margin-bottom:5px;overflow:hidden;text-overflow:ellipsis}.scalar span{font-size:14px;font-weight:650;word-break:break-word}
details{border:1px solid var(--line);border-radius:8px;background:#fff}summary{padding:10px 12px;cursor:pointer;font-size:12px;font-weight:650}pre{margin:0;padding:12px;max-height:520px;overflow:auto;background:#0b1220;color:#d1e0ff;font-size:11px;line-height:1.5;border-radius:0 0 8px 8px;white-space:pre-wrap;word-break:break-word}
.currency-card{border:1px solid var(--line);border-radius:8px;padding:12px}.currency-code{font-size:16px;font-weight:800;margin-bottom:8px}.currency-line{display:flex;justify-content:space-between;font-size:12px;padding:4px 0;color:#475467}.currency-line strong{color:#101828}
.footer-note{font-size:11px;color:var(--muted);margin-top:20px}.muted{color:var(--muted)}
.spinner{width:14px;height:14px;border:2px solid #d0d5dd;border-top-color:var(--accent);border-radius:50%;display:inline-block;animation:spin .7s linear infinite;vertical-align:-2px}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1100px){.app{grid-template-columns:230px 1fr}.grid.kpi{grid-template-columns:repeat(3,1fr)}.grid.two,.grid.three,.upload-row{grid-template-columns:1fr}.scalar-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.app{display:block}.sidebar{position:relative;height:auto}.topbar{position:relative;flex-wrap:wrap;padding:14px}.content{padding:18px}.project-input{min-width:0;width:100%;flex-wrap:wrap}.grid.kpi{grid-template-columns:repeat(2,1fr)}.wide-upload{grid-template-columns:1fr}.queue-row{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand"><h1>CMeng</h1><p>Controlled project evidence & intelligence</p></div>
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
      <div class="page-title">
        <div><h2>Project Director</h2><p>Where are we, what is exposed, and what requires action?</p></div>
        <span id="projectBadge" class="badge">No project</span>
      </div>

      <section id="director"></section>

      <div class="grid two" style="margin-top:14px">
        <section class="card">
          <h3>Evidence intake</h3>
          <div class="upload-row">
            <div class="upload-box">
              <strong>Schedule revisions</strong>
              <small>Select baseline, multiple updates, revised baseline and recovery files together. CMeng verifies the actual file content/signature; the filename is only a hint.</small>
              <input type="file" id="scheduleFiles" multiple accept=".xer,.xml,.xlsx,.xlsm,.csv">
              <div id="scheduleQueue" class="queue"></div>
              <div class="upload-actions"><button class="btn small primary" id="uploadSchedules">Upload schedule batch</button></div>
            </div>
            <div class="upload-box">
              <strong>BOQ / quantity revisions</strong>
              <small>Select one or more BOQ revisions. CMeng inspects the content before routing it, so a wrongly named file is not trusted as a BOQ.</small>
              <input type="file" id="boqFiles" multiple accept=".csv,.xlsx,.xlsm,.pdf">
              <div id="boqQueue" class="queue"></div>
              <div class="upload-actions"><button class="btn small primary" id="uploadBoqs">Upload BOQ batch</button></div>
            </div>
            <div class="upload-box">
              <strong>Contract family</strong>
              <small>Select the main contract, amendments and appendices together. Searchable PDF, scanned PDF and image evidence are content-identified; amendments do not silently replace the base contract.</small>
              <input type="file" id="contractFiles" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp">
              <div id="contractQueue" class="queue"></div>
              <div class="upload-actions"><button class="btn small primary" id="uploadContracts">Upload contract batch</button></div>
            </div>
          </div>

          <div class="wide-upload">
            <div>
              <strong>Full evidence pack / supporting documents</strong>
              <small>Upload a ZIP evidence pack or multiple supporting files: cost/EVM, payment certificates, variations, claims, risk, procurement, correspondence, RFI, submittals, design, HSE, NCR, assets/FM, testing/ORAT, tender requirements, WBS/OBS/control registers and other project evidence.</small>
              <input type="file" id="evidenceFiles" multiple accept=".zip,.csv,.pdf,.docx,.xlsx,.xlsm,.xer,.xml,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp">
              <div id="evidenceQueue" class="queue"></div>
            </div>
            <button class="btn primary" id="uploadEvidence">Upload evidence</button>
          </div>
          <div id="uploadMessage"></div>
        </section>

        <section class="card">
          <h3>Project evidence status</h3>
          <div id="projectStatus" class="empty">Load the demo or upload project evidence.</div>
        </section>
      </div>

      <section class="card" style="margin-top:14px">
        <div class="module-head"><h3>Evidence library & mapping</h3><span id="evidenceBadge" class="badge">0 documents</span></div>
        <div id="evidenceLibrary" class="empty">No project evidence has been registered.</div>
      </section>

      <section class="card module-panel">
        <div class="module-head"><h3 id="moduleTitle">Schedule module</h3><span id="moduleBadge" class="badge">Select a module</span></div>
        <div id="moduleContent" class="empty">Choose a module from the left navigation.</div>
      </section>

      <div class="footer-note">All uploaded documents are retained as candidate evidence with source hashes. Missing evidence is not treated as zero, recovery schedules do not silently replace the current control update, and amendments do not silently replace the main contract.</div>
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
  const rows=challenge.items.map(item=>{
    const sub=item.submitted||{},ind=item.independent||{},gap=item.gap||{};
    const show=v=>v===null||v===undefined?"—":fmt(v);
    const withUnit=(v,u)=>show(v)+(u?" "+u:"");
    return '<tr>'+
      '<td><b>'+escapeHtml(item.label||item.metric)+'</b><br><span class="muted">'+escapeHtml(item.evidenceState||"")+'</span></td>'+
      '<td>'+escapeHtml(sub.state==="not_submitted"?"Not submitted":withUnit(sub.value,sub.unit))+(sub.note?'<br><span class="muted">'+escapeHtml(sub.note)+'</span>':'')+'</td>'+
      '<td>'+escapeHtml(withUnit(ind.value,ind.unit))+'<br><span class="muted">'+escapeHtml(ind.state||"")+(ind.note?" · "+escapeHtml(ind.note):"")+'</span></td>'+
      '<td>'+escapeHtml(withUnit(gap.value,gap.unit))+(gap.note?'<br><span class="muted">'+escapeHtml(gap.note)+'</span>':'')+'</td>'+
      '<td>'+escapeHtml(item.consequence||"—")+'</td>'+
      '<td>'+escapeHtml(item.action||"—")+'</td>'+
    '</tr>';
  }).join("");
  return '<div class="card" style="margin-bottom:12px"><div class="module-head"><h3>Submitted vs Independent Challenge</h3><span class="badge '+(challenge.challengedCount?"partial":"ready")+'">'+escapeHtml(challenge.challengedCount)+" challenged"+'</span></div>'+
    '<div class="scalar-grid">'+
      '<div class="scalar"><b>Submitted evidence</b><span>'+escapeHtml(challenge.submittedEvidenceState)+'</span></div>'+
      '<div class="scalar"><b>Independent state</b><span>'+escapeHtml(challenge.independentState)+'</span></div>'+
      '<div class="scalar"><b>Not submitted</b><span>'+escapeHtml(challenge.notSubmittedCount)+'</span></div>'+
      '<div class="scalar"><b>Scenario items</b><span>'+escapeHtml(challenge.scenarioCount)+'</span></div>'+
    '</div>'+
    '<div class="table-wrap"><table><thead><tr><th>Metric</th><th>Submitted</th><th>Independent</th><th>Gap</th><th>Consequence</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
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
  if(data.contractIntelligence){
    html+='<details style="margin-top:12px"><summary>Contract clause intelligence supporting the challenge</summary><pre>'+escapeHtml(JSON.stringify(data.contractIntelligence,null,2))+'</pre></details>';
  }
  el("moduleContent").innerHTML=html;
  return true;
}
function renderModuleResult(result){el("moduleTitle").textContent=names[result.key]||result.key;el("moduleBadge").className="badge "+statusClass(result.status);el("moduleBadge").textContent=result.status;if(result.status==="blocked"){el("moduleContent").innerHTML='<div class="notice warn"><b>Blocked by evidence dependency</b><br>'+escapeHtml(result.reason||"Required evidence is not established.")+'</div><div class="scalar-grid">'+(result.dependencies||[]).map(x=>'<div class="scalar"><b>Required</b><span>'+escapeHtml(x)+'</span></div>').join("")+'</div>';return}const data=result.data||{};if(result.key==="challenge-contract"&&renderDeliveryChallenge(data,result.reason))return;const challengeHtml=renderUniversalChallenge(data.challenge);const scalars=scalarPairs(data).filter(([k])=>k!=="challenge").map(([k,v])=>'<div class="scalar"><b>'+escapeHtml(k)+'</b><span>'+escapeHtml(fmt(v))+'</span></div>').join("");el("moduleContent").innerHTML=(result.reason?'<div class="notice info">'+escapeHtml(result.reason)+'</div>':'')+challengeHtml+'<div class="scalar-grid">'+scalars+'</div><details><summary>Evidence-backed module output</summary><pre>'+escapeHtml(JSON.stringify(data,null,2))+'</pre></details>'}
async function loadModule(key){if(!overview){el("moduleContent").innerHTML='<div class="empty">Load a project first.</div>';return}setBusy("Calculating "+names[key]);try{const result=await api("/api/projects/"+encodeURIComponent(project())+"/schedule/modules/"+encodeURIComponent(key));renderModuleResult(result)}catch(e){const d=e.data||{};renderModuleResult({key,status:"blocked",reason:d.reason||d.error||e.message,dependencies:d.dependencies||[]})}finally{setBusy("")}}
function kpi(label,value,sub=""){return'<div class="card kpi-card"><div class="kpi-label">'+escapeHtml(label)+'</div><div class="kpi-value">'+escapeHtml(fmt(value))+'</div><div class="kpi-sub">'+escapeHtml(sub)+'</div></div>'}
function renderDirector(d){if(!d){el("director").innerHTML='<div class="card"><div class="empty">Director position will populate only when its governed schedule, contract, claims/EOT and commercial dependencies are available.</div></div>';return}const s=d.schedule,c=d.claims,ctrl=d.controls;let html='<div class="grid kpi">'+kpi("Data Date",s.dataDateIso)+kpi("Independent Forecast",s.independentForecastCompletionIso)+kpi("Official Completion",s.officialAdjustedCompletionIso||s.contractualCompletionIso)+kpi("Programme movement",c.observedProgrammeMovementDays,"days carried from schedule windows")+kpi("Time-impact candidate",c.analyticalTimeImpactCandidateDays,"analytical, not entitlement")+kpi("Attributable EOT candidate",c.attributableCandidateEotDays,"analytical, not awarded")+kpi("Official EOT",c.officialApprovedEotDays,"governed award only")+kpi("CPM integrity",s.independentCpmState,s.drivingPathState)+kpi("Claims linked",c.fullyLinkedClaimCount+" / "+c.claimCount,"claim → event → activity")+kpi("LD Scenario",d.ld.cappedAmount===null?"—":fmt(d.ld.cappedAmount)+" "+(d.ld.currency||""),d.ld.state)+'</div>';html+='<div class="grid two"><div class="card"><h3>Commercial exposure by currency</h3><div class="grid three">';(d.commercialByCurrency||[]).forEach(r=>{html+='<div class="currency-card"><div class="currency-code">'+escapeHtml(r.currency)+'</div>'+[["Pending variations",r.pendingVariationAmount],["Approved variations",r.approvedVariationAmount],["Certified unpaid",r.certifiedUnpaidAmount],["Retention held",r.retentionHeldAmount],["Active bonds",r.activeBondAmount],["Claimed",r.claimClaimedAmount],["LD scenario",r.ldScenarioAmount]].map(x=>'<div class="currency-line"><span>'+x[0]+'</span><strong>'+escapeHtml(fmt(x[1]))+'</strong></div>').join("")+'</div>'});html+='</div></div><div class="card"><h3>Management actions</h3><div class="actions">'+((d.managementActions||[]).length?d.managementActions.map(a=>'<div class="action">'+escapeHtml(a)+'</div>').join(""):'<div class="empty">No current actions generated.</div>')+'</div><div style="margin-top:14px" class="scalar-grid">'+'<div class="scalar"><b>Open HSE</b><span>'+ctrl.openHseIncidentCount+'</span></div>'+'<div class="scalar"><b>LTI or worse</b><span>'+ctrl.openLtiOrWorseCount+'</span></div>'+'<div class="scalar"><b>Major / critical NCR</b><span>'+ctrl.openCriticalMajorNcrCount+'</span></div>'+'<div class="scalar"><b>Overdue RFI</b><span>'+ctrl.overdueRfiCount+'</span></div>'+'<div class="scalar"><b>Permit issues</b><span>'+ctrl.overduePermitCount+'</span></div>'+'<div class="scalar"><b>Expiring bonds</b><span>'+ctrl.expiringBondCount30Days+'</span></div>'+'</div></div></div>';el("director").innerHTML=html}
function renderStatus(o){const ready=o.moduleStates.filter(x=>x.status==="ready").length,partial=o.moduleStates.filter(x=>x.status==="partial").length,blocked=o.moduleStates.filter(x=>x.status==="blocked").length;el("projectBadge").className="badge "+(o.demo?"partial":"ready");el("projectBadge").textContent=o.demo?"CERTIFIED DEMO":"USER PROJECT";el("projectStatus").innerHTML='<div class="scalar-grid">'+'<div class="scalar"><b>Baseline / revised baseline</b><span>'+fmt(o.baselineRevisionCount)+'</span></div>'+'<div class="scalar"><b>Updates</b><span>'+fmt(o.updateRevisionCount)+'</span></div>'+'<div class="scalar"><b>Recovery scenarios</b><span>'+fmt(o.recoveryRevisionCount)+'</span></div>'+'<div class="scalar"><b>Current Data Date</b><span>'+fmt(o.latestDataDateIso)+'</span></div>'+'<div class="scalar"><b>Evidence documents</b><span>'+fmt(o.evidenceDocumentCount)+'</span></div>'+'<div class="scalar"><b>Ready modules</b><span>'+ready+' / 22</span></div>'+'<div class="scalar"><b>Partial</b><span>'+partial+'</span></div>'+'<div class="scalar"><b>Blocked</b><span>'+blocked+'</span></div>'+'</div>'}
function renderScheduleQueue(){el("scheduleQueue").innerHTML=scheduleSelection.map((file,i)=>'<div class="queue-row"><span class="queue-name">'+escapeHtml(file.name)+'</span><select class="schedule-role" data-index="'+i+'"><option value="baseline" '+(inferScheduleRole(file.name)==="baseline"?"selected":"")+'>Baseline</option><option value="update" '+(inferScheduleRole(file.name)==="update"?"selected":"")+'>Update</option><option value="revised_baseline" '+(inferScheduleRole(file.name)==="revised_baseline"?"selected":"")+'>Revised baseline</option><option value="recovery" '+(inferScheduleRole(file.name)==="recovery"?"selected":"")+'>Recovery</option></select></div>').join("")}
function renderContractQueue(){el("contractQueue").innerHTML=contractSelection.map((file,i)=>{const role=inferContractRole(file.name);return'<div class="queue-row"><span class="queue-name">'+escapeHtml(file.name)+'</span><select class="contract-role" data-index="'+i+'"><option value="main" '+(role==="main"?"selected":"")+'>Main</option><option value="amendment" '+(role==="amendment"?"selected":"")+'>Amendment</option><option value="appendix" '+(role==="appendix"?"selected":"")+'>Appendix</option><option value="tender" '+(role==="tender"?"selected":"")+'>Tender/ER</option><option value="other" '+(role==="other"?"selected":"")+'>Other</option></select></div>'}).join("")}
function renderSimpleQueue(target,files){el(target).innerHTML=files.map(file=>'<div class="queue-row" style="grid-template-columns:1fr"><span class="queue-name">'+escapeHtml(file.name)+'</span></div>').join("")}
async function loadEvidence(){if(!overview){el("evidenceBadge").textContent="0 documents";el("evidenceLibrary").innerHTML='<div class="empty">No project evidence has been registered.</div>';return}try{const data=await api("/api/projects/"+encodeURIComponent(project())+"/evidence/documents");el("evidenceBadge").className="badge "+(data.documentCount?"ready":"");el("evidenceBadge").textContent=data.documentCount+" documents";if(!data.documentCount){el("evidenceLibrary").innerHTML='<div class="empty">No uploaded user evidence in this project yet.</div>';return}el("evidenceLibrary").innerHTML='<div class="table-wrap"><table><thead><tr><th>File</th><th>Content identified as</th><th>Change effect</th><th>Confidence</th><th>Read method</th><th>Metadata conflict</th><th>Parser</th><th>Schedule role</th><th>Activity mapping</th></tr></thead><tbody>'+data.documents.map(d=>{const m=d.mapping;const i=d.identification||{};const mapping=!m||m.linkedActivityCount===null?"—":fmt(m.mappedActivityCount)+" / "+fmt(m.linkedActivityCount)+(m.coveragePercent===null?"":" ("+fmt(m.coveragePercent)+"%)");const confidence=i.confidence===undefined?"—":fmt(i.confidence*100)+"%";const conflict=i.classificationConflict?"YES":"No";const method=(i.method||"—")+(i.ocrUsed?" / OCR":"");const title=i.detectedTitle?'<br><span class="muted">'+escapeHtml(i.detectedTitle)+'</span>':"";return'<tr><td><b>'+escapeHtml(d.sourceFilename)+'</b><br><span class="muted">'+escapeHtml(d.sourceRelativePath||"")+'</span></td><td><b>'+escapeHtml(d.category)+'</b><br>'+escapeHtml(d.documentType)+title+'</td><td>'+escapeHtml(d.lineage?.effect||"unknown")+(d.lineage?.replacesEntireBasis?'<br><span class="badge partial">replaces basis</span>':d.lineage?.appliesAsDelta?'<br><span class="badge">delta</span>':'')+'</td><td>'+escapeHtml(confidence)+(i.needsReview?'<br><span class="badge partial">review</span>':'')+'</td><td>'+escapeHtml(method)+'</td><td>'+escapeHtml(conflict)+'</td><td>'+escapeHtml(d.parserState)+'</td><td>'+escapeHtml(d.scheduleRole||"—")+'</td><td>'+escapeHtml(mapping)+'</td></tr>'}).join("")+'</tbody></table></div>'}catch(e){el("evidenceLibrary").innerHTML='<div class="notice warn">Evidence library could not be loaded: '+escapeHtml(e.message)+'</div>'}}
async function refresh(bootstrapDemo=true){setBusy("Refreshing project");try{overview=await api("/api/projects/"+encodeURIComponent(project())+"/overview");renderStatus(overview);renderNav();let director=null;try{director=await api("/api/projects/"+encodeURIComponent(project())+"/director-position")}catch{}renderDirector(director);await loadEvidence();await loadModule(selected);localStorage.setItem("cmeng-project",project())}catch(e){if(bootstrapDemo&&e.status===404&&project()==="UAT-DEMO"){try{await api("/api/projects/UAT-DEMO/demo",{method:"POST"});return await refresh(false)}catch{}}overview=null;renderNav();renderDirector(null);el("projectStatus").innerHTML='<div class="notice warn">Project is not loaded yet. Upload evidence or load the certified demo.</div>';el("projectBadge").className="badge blocked";el("projectBadge").textContent="NO PROJECT";await loadEvidence()}finally{setBusy("")}}
async function loadDemo(){setBusy("Loading certified demo");try{await api("/api/projects/"+encodeURIComponent(project())+"/demo",{method:"POST"});selected="pmo-analysis";await refresh(false);el("uploadMessage").innerHTML='<div class="notice info">Certified demo loaded. Demo evidence is isolated from your uploads.</div>'}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadSchedules(){if(!scheduleSelection.length)return;setBusy("Uploading schedule revisions");const roles=[...document.querySelectorAll(".schedule-role")].reduce((a,s)=>{a[Number(s.dataset.index)]=s.value;return a},{});const results=[];try{for(let i=0;i<scheduleSelection.length;i+=1){const file=scheduleSelection[i];const headers={"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.name,"x-evidence-category":"schedule","x-schedule-role":roles[i]||inferScheduleRole(file.name)};results.push(await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers,body:file}))}el("uploadMessage").innerHTML='<div class="notice info">'+results.length+' schedule revision(s) accepted. Baselines/updates form official history; recovery remains a separate scenario.</div>';scheduleSelection=[];el("scheduleFiles").value="";renderScheduleQueue();await refresh(false)}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadBoqs(){if(!boqSelection.length)return;setBusy("Uploading BOQ revisions");let count=0;try{for(const file of boqSelection){await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers:{"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.name,"x-evidence-category":"boq_cost","x-document-type":"boq"},body:file});count+=1}el("uploadMessage").innerHTML='<div class="notice info">'+count+' BOQ revision(s) accepted and retained.</div>';boqSelection=[];el("boqFiles").value="";renderSimpleQueue("boqQueue",boqSelection);await refresh(false)}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadContracts(){if(!contractSelection.length)return;setBusy("Uploading contract family");const roles=[...document.querySelectorAll(".contract-role")].reduce((a,s)=>{a[Number(s.dataset.index)]=s.value;return a},{});let count=0;try{for(let i=0;i<contractSelection.length;i+=1){const file=contractSelection[i];const role=roles[i]||inferContractRole(file.name);const docType=role==="main"?"main_contract":role==="amendment"?"contract_amendment":role==="appendix"?"contract_appendix":role==="tender"?"tender_employer_requirements":"contract_supporting_document";await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers:{"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.name,"x-evidence-category":"contract","x-document-type":docType},body:file});count+=1}el("uploadMessage").innerHTML='<div class="notice info">'+count+' contract-family document(s) accepted. Amendments are retained separately from the base contract.</div>';contractSelection=[];el("contractFiles").value="";renderContractQueue();await refresh(false)}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
async function uploadEvidence(){if(!evidenceSelection.length)return;setBusy("Uploading project evidence");let documentCount=0;try{for(const file of evidenceSelection){const result=await api("/api/projects/"+encodeURIComponent(project())+"/evidence/uploads",{method:"POST",headers:{"content-type":fileType(file),"x-source-filename":file.name,"x-source-relative-path":file.webkitRelativePath||file.name},body:file});documentCount+=result.documentCount||1}el("uploadMessage").innerHTML='<div class="notice info">'+documentCount+' evidence document(s) registered. Known schedule/BOQ/contract files were parsed; other files were classified, preserved and mapped to schedule activities where explicit activity IDs exist.</div>';evidenceSelection=[];el("evidenceFiles").value="";renderSimpleQueue("evidenceQueue",evidenceSelection);await refresh(false)}catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+escapeHtml(e.message)+'</div>'}finally{setBusy("")}}
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
