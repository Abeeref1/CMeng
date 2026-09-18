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
  --accent:#1d4ed8;--accent2:#0f766e;--danger:#b42318;--warn:#b54708;--ok:#067647;
  --nav:#101828;--nav2:#1d2939;--soft:#f8fafc;--shadow:0 1px 2px rgba(16,24,40,.05),0 4px 14px rgba(16,24,40,.04)
}
*{box-sizing:border-box} body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}
button,input,select{font:inherit} button{cursor:pointer}
.app{display:grid;grid-template-columns:290px 1fr;min-height:100vh}
.sidebar{background:var(--nav);color:#fff;padding:22px 16px;position:sticky;top:0;height:100vh;overflow:auto}
.brand{padding:0 10px 20px;border-bottom:1px solid #344054;margin-bottom:18px}
.brand h1{font-size:22px;margin:0 0 4px;letter-spacing:-.02em}.brand p{margin:0;color:#98a2b3;font-size:12px;line-height:1.4}
.nav-group{margin:18px 0}.nav-group-title{font-size:11px;color:#98a2b3;text-transform:uppercase;letter-spacing:.08em;padding:0 10px 8px}
.nav-item{width:100%;border:0;background:transparent;color:#d0d5dd;text-align:left;padding:9px 10px;border-radius:7px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px}
.nav-item:hover,.nav-item.active{background:var(--nav2);color:#fff}.nav-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status-dot{width:8px;height:8px;border-radius:50%;background:#667085;flex:0 0 auto}.status-dot.ready{background:#32d583}.status-dot.partial{background:#fdb022}.status-dot.blocked{background:#f97066}
.main{min-width:0}.topbar{height:72px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:0 28px;position:sticky;top:0;z-index:5}
.project-input{display:flex;align-items:center;gap:8px;min-width:360px}.project-input label{font-size:12px;color:var(--muted);font-weight:600}.project-input input{height:38px;border:1px solid #d0d5dd;border-radius:7px;padding:0 10px;min-width:210px}
.btn{border:1px solid #d0d5dd;background:#fff;border-radius:7px;padding:9px 13px;font-weight:600;font-size:13px;color:#344054}.btn:hover{background:#f9fafb}.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn.primary:hover{filter:brightness(.95)}
.content{padding:26px 28px 50px;max-width:1600px;margin:0 auto}.page-title{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
.page-title h2{font-size:25px;letter-spacing:-.02em;margin:0 0 5px}.page-title p{margin:0;color:var(--muted);font-size:13px}
.grid{display:grid;gap:14px}.grid.kpi{grid-template-columns:repeat(6,minmax(130px,1fr));margin-bottom:14px}.grid.two{grid-template-columns:1.35fr 1fr}.grid.three{grid-template-columns:repeat(3,1fr)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);padding:17px}.card h3{font-size:14px;margin:0 0 12px}.kpi-card{padding:15px}.kpi-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px}.kpi-value{font-size:23px;font-weight:700;letter-spacing:-.03em}.kpi-sub{font-size:11px;color:var(--muted);margin-top:5px}
.badge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;background:#f2f4f7;color:#475467}.badge.ready{background:#ecfdf3;color:var(--ok)}.badge.partial{background:#fffaeb;color:var(--warn)}.badge.blocked{background:#fef3f2;color:var(--danger)}
.upload-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.upload-box{border:1px dashed #cbd5e1;border-radius:9px;padding:13px;background:#fbfcfd}.upload-box strong{font-size:12px;display:block;margin-bottom:5px}.upload-box small{color:var(--muted);display:block;margin-bottom:9px}.upload-box input{width:100%;font-size:11px}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#f8fafc;color:#475467;font-weight:700;position:sticky;top:0}tr:last-child td{border-bottom:0}
.actions{display:flex;flex-direction:column;gap:8px}.action{padding:10px 12px;background:#fff7ed;border-left:3px solid #f79009;border-radius:5px;font-size:12px}
.empty{padding:30px;text-align:center;color:var(--muted);font-size:13px}.notice{padding:11px 12px;border-radius:7px;font-size:12px;margin:10px 0}.notice.info{background:#eff8ff;color:#175cd3}.notice.warn{background:#fffaeb;color:#93370d}.notice.error{background:#fef3f2;color:#912018}
.module-panel{margin-top:18px}.module-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.module-head h3{font-size:18px;margin:0}.scalar-grid{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin-bottom:12px}.scalar{background:var(--soft);padding:11px;border-radius:7px;border:1px solid #edf0f3}.scalar b{display:block;font-size:11px;color:var(--muted);margin-bottom:5px;overflow:hidden;text-overflow:ellipsis}.scalar span{font-size:14px;font-weight:650;word-break:break-word}
details{border:1px solid var(--line);border-radius:8px;background:#fff}summary{padding:10px 12px;cursor:pointer;font-size:12px;font-weight:650}pre{margin:0;padding:12px;max-height:520px;overflow:auto;background:#0b1220;color:#d1e0ff;font-size:11px;line-height:1.5;border-radius:0 0 8px 8px;white-space:pre-wrap;word-break:break-word}
.currency-card{border:1px solid var(--line);border-radius:8px;padding:12px}.currency-code{font-size:16px;font-weight:800;margin-bottom:8px}.currency-line{display:flex;justify-content:space-between;font-size:12px;padding:4px 0;color:#475467}.currency-line strong{color:#101828}
.footer-note{font-size:11px;color:var(--muted);margin-top:20px}
.spinner{width:14px;height:14px;border:2px solid #d0d5dd;border-top-color:var(--accent);border-radius:50%;display:inline-block;animation:spin .7s linear infinite;vertical-align:-2px}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1100px){.app{grid-template-columns:230px 1fr}.grid.kpi{grid-template-columns:repeat(3,1fr)}.grid.two,.grid.three,.upload-row{grid-template-columns:1fr}.scalar-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.app{display:block}.sidebar{position:relative;height:auto}.topbar{position:relative;height:auto;flex-wrap:wrap;padding:14px}.content{padding:18px}.project-input{min-width:0;width:100%;flex-wrap:wrap}.grid.kpi{grid-template-columns:repeat(2,1fr)}}
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
        <div><h2 id="title">Project Director</h2><p id="subtitle">Where are we, what is exposed, and what requires action?</p></div>
        <span id="projectBadge" class="badge">No project</span>
      </div>

      <section id="director"></section>

      <div class="grid two" style="margin-top:14px">
        <section class="card">
          <h3>Evidence intake</h3>
          <div class="upload-row">
            <div class="upload-box">
              <strong>Schedule revision</strong>
              <small>XER, Primavera XML, Excel or CSV</small>
              <select id="scheduleRole" style="width:100%;height:32px;margin-bottom:7px;border:1px solid #d0d5dd;border-radius:6px">
                <option value="update">Update</option><option value="baseline">Baseline</option><option value="recovery">Recovery</option><option value="revised_baseline">Revised baseline</option>
              </select>
              <input type="file" id="scheduleFile" accept=".xer,.xml,.xlsx,.xlsm,.csv">
            </div>
            <div class="upload-box">
              <strong>BOQ</strong>
              <small>Excel or PDF, currency preserved</small>
              <input type="file" id="boqFile" accept=".xlsx,.xlsm,.pdf">
            </div>
            <div class="upload-box">
              <strong>Contract</strong>
              <small>PDF or DOCX for clauses / LD / EOT</small>
              <input type="file" id="contractFile" accept=".pdf,.docx">
            </div>
          </div>
          <div id="uploadMessage"></div>
        </section>

        <section class="card">
          <h3>Project evidence status</h3>
          <div id="projectStatus" class="empty">Load the demo or upload a schedule.</div>
        </section>
      </div>

      <section class="card module-panel">
        <div class="module-head"><h3 id="moduleTitle">Schedule module</h3><span id="moduleBadge" class="badge">Select a module</span></div>
        <div id="moduleContent" class="empty">Choose a module from the left navigation.</div>
      </section>

      <div class="footer-note">Demo evidence is isolated and clearly flagged. User uploads create runtime-local candidates and do not become official facts automatically.</div>
    </div>
  </main>
</div>
<script>
const groups = {
  "Analysis":["pmo-analysis","schedule-analytics","activity-analytics","lookahead-schedule","schedule-change-report","revision-trend","milestones","near-critical"],
  "Progress & Resources":["resource-utilization","progress-report","variance-trends","progress-scurve","quantity-scurve","progress-breakdown","manhour-scurve"],
  "Forecast":["forecast-history","independent-forecast"],
  "Claims & Contract":["delay-claims","notices-claims","windows-analysis","eot-assessment","challenge-contract"]
};
const names = {
"pmo-analysis":"PMO Analysis","schedule-analytics":"Schedule Analytics","activity-analytics":"Activity Analytics","resource-utilization":"Resource Utilization","lookahead-schedule":"Look-Ahead Schedule","progress-report":"Progress Report","schedule-change-report":"Schedule Change Report","revision-trend":"Revision Trend","variance-trends":"Variance Trends","progress-scurve":"Progress S-Curve","quantity-scurve":"Quantity Installed S-Curve","progress-breakdown":"Progress Breakdown","milestones":"Milestones","near-critical":"Near-Critical Activities","manhour-scurve":"Man-Hour S-Curve","forecast-history":"Forecast History","independent-forecast":"Independent Forecast","delay-claims":"Delay & Claims","notices-claims":"Notices, EOT & Claims","windows-analysis":"Windows Analysis","eot-assessment":"EOT Assessment","challenge-contract":"Challenge the Contract"
};
let overview=null, selected="pmo-analysis";
const el=id=>document.getElementById(id);
const project=()=>el("projectId").value.trim()||"UAT-DEMO";
const fmt=v=>v===null||v===undefined?"—":typeof v==="number"?new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v):String(v);
const statusClass=s=>s==="ready"?"ready":s==="partial"?"partial":"blocked";
function setBusy(text){el("globalStatus").innerHTML=text?'<span class="spinner"></span> '+text:"";}
async function api(path,opts={}){const r=await fetch(path,opts);let data=null;try{data=await r.json()}catch{}if(!r.ok){const e=new Error(data?.error||data?.reason||("HTTP "+r.status));e.data=data;e.status=r.status;throw e}return data}
function renderNav(){
  const states=new Map((overview?.moduleStates||[]).map(x=>[x.key,x]));
  let html="";
  Object.entries(groups).forEach(([group,keys])=>{
    html+='<div class="nav-group"><div class="nav-group-title">'+group+'</div>';
    keys.forEach(key=>{
      const st=states.get(key)?.status||"blocked";
      html+='<button class="nav-item '+(selected===key?"active":"")+'" data-key="'+key+'"><span class="nav-label">'+names[key]+'</span><span class="status-dot '+statusClass(st)+'"></span></button>';
    });
    html+='</div>';
  });
  el("nav").innerHTML=html;
  document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{selected=b.dataset.key;renderNav();loadModule(selected)});
}
function scalarPairs(obj){
  if(!obj||typeof obj!=="object")return[];
  return Object.entries(obj).filter(([k,v])=>["string","number","boolean"].includes(typeof v)||v===null).slice(0,12);
}
function renderModuleResult(result){
  el("moduleTitle").textContent=names[result.key]||result.key;
  el("moduleBadge").className="badge "+statusClass(result.status);
  el("moduleBadge").textContent=result.status;
  if(result.status==="blocked"){
    el("moduleContent").innerHTML='<div class="notice warn"><b>Blocked by evidence dependency</b><br>'+ (result.reason||"Required evidence is not established.")+'</div><div class="scalar-grid">'+(result.dependencies||[]).map(x=>'<div class="scalar"><b>Required</b><span>'+x+'</span></div>').join("")+'</div>';
    return;
  }
  const data=result.data||{};
  const scalars=scalarPairs(data).map(([k,v])=>'<div class="scalar"><b>'+k+'</b><span>'+fmt(v)+'</span></div>').join("");
  el("moduleContent").innerHTML=(result.reason?'<div class="notice info">'+result.reason+'</div>':'')+'<div class="scalar-grid">'+scalars+'</div><details><summary>Evidence-backed module output</summary><pre>'+escapeHtml(JSON.stringify(data,null,2))+'</pre></details>';
}
function escapeHtml(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
async function loadModule(key){
  if(!overview){el("moduleContent").innerHTML='<div class="empty">Load a project first.</div>';return}
  setBusy("Calculating "+names[key]);
  try{const result=await api("/api/projects/"+encodeURIComponent(project())+"/schedule/modules/"+encodeURIComponent(key));renderModuleResult(result)}
  catch(e){const d=e.data||{};renderModuleResult({key,status:"blocked",reason:d.reason||d.error||e.message,dependencies:d.dependencies||[]})}
  finally{setBusy("")}
}
function kpi(label,value,sub=""){return '<div class="card kpi-card"><div class="kpi-label">'+label+'</div><div class="kpi-value">'+fmt(value)+'</div><div class="kpi-sub">'+sub+'</div></div>'}
function renderDirector(d){
  if(!d){el("director").innerHTML='<div class="card"><div class="empty">Director position requires schedule plus contract / claims / EOT evidence. Load the certified demo to inspect the complete position.</div></div>';return}
  const s=d.schedule,c=d.claims,ctrl=d.controls;
  let html='<div class="grid kpi">'+
    kpi("Data Date",s.dataDateIso)+
    kpi("Independent Forecast",s.independentForecastCompletionIso)+
    kpi("Official Completion",s.officialAdjustedCompletionIso||s.contractualCompletionIso)+
    kpi("Schedule Variance",s.varianceDaysToOfficialAdjustedCompletion,"days to official basis")+
    kpi("Claims linked",c.fullyLinkedClaimCount+" / "+c.claimCount,"claim → event → activity")+
    kpi("LD Scenario",d.ld.cappedAmount===null?"—":fmt(d.ld.cappedAmount)+" "+(d.ld.currency||""),d.ld.state)+
    '</div>';
  html+='<div class="grid two"><div class="card"><h3>Commercial exposure by currency</h3><div class="grid three">';
  (d.commercialByCurrency||[]).forEach(r=>{html+='<div class="currency-card"><div class="currency-code">'+r.currency+'</div>'+[
    ["Pending variations",r.pendingVariationAmount],["Approved variations",r.approvedVariationAmount],["Certified unpaid",r.certifiedUnpaidAmount],["Retention held",r.retentionHeldAmount],["Active bonds",r.activeBondAmount],["Claimed",r.claimClaimedAmount],["LD scenario",r.ldScenarioAmount]
  ].map(x=>'<div class="currency-line"><span>'+x[0]+'</span><strong>'+fmt(x[1])+'</strong></div>').join("")+'</div>'});
  html+='</div></div><div class="card"><h3>Management actions</h3><div class="actions">'+((d.managementActions||[]).length?d.managementActions.map(a=>'<div class="action">'+a+'</div>').join(""):'<div class="empty">No current actions generated.</div>')+'</div><div style="margin-top:14px" class="scalar-grid">'+
    '<div class="scalar"><b>Open HSE</b><span>'+ctrl.openHseIncidentCount+'</span></div>'+
    '<div class="scalar"><b>LTI or worse</b><span>'+ctrl.openLtiOrWorseCount+'</span></div>'+
    '<div class="scalar"><b>Major / critical NCR</b><span>'+ctrl.openCriticalMajorNcrCount+'</span></div>'+
    '<div class="scalar"><b>Overdue RFI</b><span>'+ctrl.overdueRfiCount+'</span></div>'+
    '<div class="scalar"><b>Permit issues</b><span>'+ctrl.overduePermitCount+'</span></div>'+
    '<div class="scalar"><b>Expiring bonds</b><span>'+ctrl.expiringBondCount30Days+'</span></div>'+
    '</div></div></div>';
  el("director").innerHTML=html;
}
function renderStatus(o){
  const ready=o.moduleStates.filter(x=>x.status==="ready").length, partial=o.moduleStates.filter(x=>x.status==="partial").length, blocked=o.moduleStates.filter(x=>x.status==="blocked").length;
  el("projectBadge").className="badge "+(o.demo?"partial":"ready");el("projectBadge").textContent=o.demo?"CERTIFIED DEMO":"USER PROJECT";
  el("projectStatus").innerHTML='<div class="scalar-grid">'+
    '<div class="scalar"><b>Schedule revisions</b><span>'+o.revisionCount+'</span></div>'+
    '<div class="scalar"><b>Latest Data Date</b><span>'+fmt(o.latestDataDateIso)+'</span></div>'+
    '<div class="scalar"><b>Ready modules</b><span>'+ready+' / 22</span></div>'+
    '<div class="scalar"><b>Partial</b><span>'+partial+'</span></div>'+
    '<div class="scalar"><b>Blocked</b><span>'+blocked+'</span></div>'+
    '<div class="scalar"><b>Contract</b><span>'+(o.contractLoaded?"Loaded":"Missing")+'</span></div>'+
    '</div>';
}
async function refresh(){
  setBusy("Refreshing project");
  try{
    overview=await api("/api/projects/"+encodeURIComponent(project())+"/overview");
    renderStatus(overview);renderNav();
    let director=null;try{director=await api("/api/projects/"+encodeURIComponent(project())+"/director-position")}catch{}
    renderDirector(director);
    await loadModule(selected);
    localStorage.setItem("cmeng-project",project());
  }catch(e){overview=null;renderNav();renderDirector(null);el("projectStatus").innerHTML='<div class="notice warn">Project is not loaded yet. Use the certified demo or upload a schedule revision.</div>';el("projectBadge").className="badge blocked";el("projectBadge").textContent="NO PROJECT"}
  finally{setBusy("")}
}
async function loadDemo(){
  setBusy("Loading certified demo");
  try{await api("/api/projects/"+encodeURIComponent(project())+"/demo",{method:"POST"});selected="pmo-analysis";await refresh();el("uploadMessage").innerHTML='<div class="notice info">Certified demo loaded. Demo evidence is isolated from your uploads.</div>'}
  catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+e.message+'</div>'}finally{setBusy("")}
}
function fileType(file){
  const n=file.name.toLowerCase();
  if(n.endsWith(".xer"))return"text/plain";
  if(n.endsWith(".xml"))return"application/xml";
  if(n.endsWith(".csv"))return"text/csv";
  if(n.endsWith(".pdf"))return"application/pdf";
  if(n.endsWith(".docx"))return"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
async function upload(kind,file){
  if(!file)return;
  setBusy("Uploading "+file.name);
  const headers={"content-type":fileType(file),"x-source-filename":file.name};
  let path="";
  if(kind==="schedule"){path="/api/projects/"+encodeURIComponent(project())+"/schedule/uploads";headers["x-schedule-role"]=el("scheduleRole").value;headers["x-revision-label"]=file.name}
  if(kind==="boq")path="/api/projects/"+encodeURIComponent(project())+"/boq/uploads";
  if(kind==="contract")path="/api/projects/"+encodeURIComponent(project())+"/contract/uploads";
  try{const result=await api(path,{method:"POST",headers,body:file});el("uploadMessage").innerHTML='<div class="notice info">'+kind+' accepted: '+escapeHtml(JSON.stringify(result))+'</div>';await refresh()}
  catch(e){el("uploadMessage").innerHTML='<div class="notice error">'+e.message+'</div>'}finally{setBusy("")}
}
el("loadDemo").onclick=loadDemo;el("refresh").onclick=refresh;
el("scheduleFile").onchange=e=>upload("schedule",e.target.files[0]);
el("boqFile").onchange=e=>upload("boq",e.target.files[0]);
el("contractFile").onchange=e=>upload("contract",e.target.files[0]);
el("projectId").value=localStorage.getItem("cmeng-project")||"UAT-DEMO";
el("projectId").addEventListener("change",refresh);
renderNav();refresh();
</script>
</body>
</html>`;
}
