import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const base=(process.env.CMENG_RAILWAY_URL??"https://cmeng-main-production.up.railway.app").replace(/\/$/,"");
const expected=process.env.CMENG_EXPECTED_RELEASE??"";
const minProjects=Number(process.env.CMENG_MIN_PROJECTS??"6");
const coldTargetMs=Number(process.env.CMENG_COLD_DASHBOARD_TARGET_MS??"5000");
if(!/^[a-f0-9]{40}$/.test(expected)) throw new Error("CMENG_EXPECTED_RELEASE must be an exact commit SHA");

const specialist=[
  "pmo-analysis","schedule-analytics","activity-analytics","lookahead-schedule",
  "schedule-change-report","revision-trend","milestones","near-critical",
  "resource-utilization","progress-report","variance-trends","progress-scurve",
  "quantity-scurve","progress-breakdown","manhour-scurve","forecast-history",
  "independent-forecast","delay-claims","notices-claims","windows-analysis",
  "eot-assessment","challenge-contract","commercial-overview","cost-forecast",
  "variations-change","payments","cash-flow","commercial-claims-notices",
  "contract-particulars-bonds"
];
const management=["master-dashboard","command-center","master-control-programme","source-quality"];
const commercial=new Set(["commercial-overview","cost-forecast","variations-change","payments","cash-flow","commercial-claims-notices","contract-particulars-bonds"]);
const summary={mode:"ALL_PROJECTS_GENERIC_INVARIANTS",expectedRelease:expected,projects:[],checks:[],status:"running"};
const comparable=v=>Array.isArray(v)?v.map(comparable):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).filter(([k])=>k!=="generatedAt").map(([k,x])=>[k,comparable(x)])):v;
const digest=v=>createHash("sha256").update(JSON.stringify(comparable(v))).digest("hex");
const check=(name,ok,projectId=null,detail=null)=>{summary.checks.push({name,status:ok?"pass":"fail",projectFingerprint:projectId?createHash("sha256").update(projectId).digest("hex").slice(0,16):null,detail:ok?null:detail});return ok;};

async function response(path,allowed=[200]){
  const res=await fetch(base+path,{signal:AbortSignal.timeout(90000)});
  if(!allowed.includes(res.status)){
    const text=await res.text();
    throw new Error(path.replace(/projects\/[^/]+/,"projects/[redacted]")+" HTTP "+res.status+" "+text.slice(0,300));
  }
  return res;
}
async function json(path,allowed=[200]){const r=await response(path,allowed);return {status:r.status,body:await r.json()};}
function governedProjectionProjectIds(value,out=[]){
  if(Array.isArray(value)){for(const x of value)governedProjectionProjectIds(x,out);return out;}
  if(!value||typeof value!=="object")return out;
  if(typeof value.projectionKey==="string"&&typeof value.projectId==="string")out.push(value.projectId);
  for(const child of Object.values(value))governedProjectionProjectIds(child,out);
  return out;
}
function inventedMissing(value,path="",out=[]){
  if(Array.isArray(value)){value.forEach((x,i)=>inventedMissing(x,path+"["+i+"]",out));return out;}
  if(!value||typeof value!=="object")return out;
  const state=String(value.state??"").toLowerCase();
  if(["missing","unavailable","not_established"].includes(state)&&Object.prototype.hasOwnProperty.call(value,"value")&&value.value!==null&&value.value!==undefined){
    out.push(path||"root");
  }
  for(const [k,v] of Object.entries(value))inventedMissing(v,path?path+"."+k:k,out);
  return out;
}
function projectPath(id,suffix){return "/api/projects/"+encodeURIComponent(id)+suffix;}
function modulePath(id,key){
  return projectPath(id,"/"+(commercial.has(key)?"commercial":"schedule")+"/modules/"+key);
}

try{
  let health=null;
  for(let attempt=0;attempt<60;attempt++){
    try{health=(await json("/health")).body;}catch{health=null;}
    if(health?.release===expected&&health?.status==="ok")break;
    await new Promise(r=>setTimeout(r,5000));
  }
  check("Exact deployed release is healthy",health?.release===expected&&health?.status==="ok",null,health?.release??"no health");

  const portfolio=(await json("/api/portfolio")).body;
  const projects=Array.isArray(portfolio.projects)?portfolio.projects:[];
  check("Live portfolio contains the required regression population",projects.length>=minProjects,null,"projectCount="+projects.length);
  summary.projectCount=projects.length;

  for(const p of projects){
    const id=p.projectId;
    const prefix=projectPath(id,"");
    const projectSummary={projectFingerprint:createHash("sha256").update(id).digest("hex").slice(0,16),pageCount:0,blockedPages:[],failures:[]};
    summary.projects.push(projectSummary);
    const before=(await json(prefix+"/evidence/documents")).body;
    const beforeDigest=createHash("sha256").update(JSON.stringify((before.documents??[]).map(d=>[d.documentId,d.sourceHashSha256]).sort())).digest("hex");
    const overview=(await json(prefix+"/overview")).body;
    const expectedDate=overview.latestDataDateIso??null;

    const t0=Date.now();
    const dash=await json(prefix+"/management/master-dashboard",[200,409]);
    const dashboardMs=Date.now()-t0;
    check("Dashboard response stays within release target",dashboardMs<=coldTargetMs,id,"dashboardMs="+dashboardMs);
    check("Dashboard returns a governed state rather than a transport error",[200,409].includes(dash.status),id,"status="+dash.status);

    for(const key of specialist){
      const path=modulePath(id,key);
      const page=await json(path,[200,409]);
      projectSummary.pageCount++;
      const body=page.body;
      check(key+": page returns a governed result",body&&typeof body==="object"&&typeof body.status==="string",id,"status="+page.status);
      check(key+": no non-finite JSON marker",!/NaN|Infinity/.test(JSON.stringify(body)),id);
      const foreign=[...new Set(governedProjectionProjectIds(body))].filter(x=>x!==id);
      check(key+": no structured cross-project contamination",foreign.length===0,id,foreign.join(","));
      const invented=inventedMissing(body);
      check(key+": missing/unavailable values are not populated",invented.length===0,id,invented.slice(0,5).join(","));
      const pageDate=body?.data?.reportingContract?.dataDateIso??body?.data?.dataDateIso??body?.data?.result?.dataDateIso??null;
      if(pageDate&&expectedDate)check(key+": Data Date matches current project programme",String(pageDate).slice(0,10)===String(expectedDate).slice(0,10),id,pageDate+" vs "+expectedDate);
      const report=await json(path+"/report.json",[200,409]);
      if(page.status===200){
        check(key+": report is available when page is available",report.status===200,id,"report status="+report.status);
        check(key+": page and report share the exact governed data",report.status===200&&digest(report.body?.result?.data)===digest(body?.data),id);
      }else{
        projectSummary.blockedPages.push(key);
        check(key+": blocked page report also fails closed",report.status===409,id,"report status="+report.status);
        check(key+": blocked page explains why",typeof body.reason==="string"&&body.reason.trim().length>0,id);
      }
    }

    const managementViews=new Map();
    for(const key of management){
      const page=await json(prefix+"/management/"+key,[200,409]);
      projectSummary.pageCount++;
      managementViews.set(key,page.body);
      check(key+": management page returns a governed result",page.body&&typeof page.body==="object"&&typeof page.body.status==="string",id);
      check(key+": no non-finite JSON marker",!/NaN|Infinity/.test(JSON.stringify(page.body)),id);
      const foreign=[...new Set(governedProjectionProjectIds(page.body))].filter(x=>x!==id);
      check(key+": no structured cross-project contamination",foreign.length===0,id,foreign.join(","));
      const invented=inventedMissing(page.body);
      check(key+": missing/unavailable values are not populated",invented.length===0,id,invented.slice(0,5).join(","));
      const report=await json(prefix+"/management/"+key+"/report.json",[200,409]);
      if(page.status===200){
        check(key+": page and report share the exact governed data",report.status===200&&digest(report.body?.result?.data)===digest(page.body?.data),id);
      }else{
        projectSummary.blockedPages.push(key);
        check(key+": blocked management page explains why",typeof page.body.reason==="string"&&page.body.reason.trim().length>0,id);
      }
    }

    const bundle=(await json(prefix+"/management-surfaces")).body;
    for(const [key,field] of [["master-dashboard","masterDashboard"],["command-center","commandCenter"],["master-control-programme","masterControlProgramme"]]){
      check(key+": management bundle equals first-class page",digest(bundle?.[field])===digest(managementViews.get(key)?.data),id);
    }
    const sourceQuality=managementViews.get("source-quality")?.data;
    const mismatches=(sourceQuality?.pageValueChecks??[]).filter(x=>x.state==="failed");
    check("Cross-page value checks contain no mismatches",mismatches.length===0,id,mismatches.map(x=>x.metric).join(","));
    const crossFailures=(sourceQuality?.systemFailures??[]).filter(x=>x.code==="CROSS_PAGE_VALUE_MISMATCH");
    check("Information & Actions has no cross-page system failure",crossFailures.length===0,id,"count="+crossFailures.length);

    const after=(await json(prefix+"/evidence/documents")).body;
    const afterDigest=createHash("sha256").update(JSON.stringify((after.documents??[]).map(d=>[d.documentId,d.sourceHashSha256]).sort())).digest("hex");
    check("Read-only acceptance preserves source document identities and hashes",beforeDigest===afterDigest,id);
  }

  const failed=summary.checks.filter(x=>x.status==="fail");
  summary.failedCheckCount=failed.length;
  summary.status=failed.length?"fail":"pass";
  if(failed.length)process.exitCode=1;
}catch(error){
  summary.status="fail";
  summary.error=error instanceof Error?error.message:String(error);
  process.exitCode=1;
}finally{
  writeFileSync("system-acceptance.json",JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
}
