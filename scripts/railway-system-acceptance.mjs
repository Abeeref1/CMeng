import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const base=(process.env.CMENG_RAILWAY_URL??"https://cmeng-main-production.up.railway.app").replace(/\/$/,"");
const expected=process.env.CMENG_EXPECTED_RELEASE??"";
const minProjects=Number(process.env.CMENG_MIN_PROJECTS??"6");
const coldTargetMs=Number(process.env.CMENG_COLD_DASHBOARD_TARGET_MS??"5000");
if(!/^[a-f0-9]{40}$/.test(expected)) throw new Error("CMENG_EXPECTED_RELEASE must be an exact commit SHA");

const {createRequire}=await import('node:module');
const require=createRequire(import.meta.url);
const {moduleRegistry}=require('../dist/packages/runtime-api/src/registry.js');
const {projectFactConsumerMismatches}=require('../dist/packages/runtime-api/src/project-fact-consumers.js');
const specialist=moduleRegistry.filter(p=>p.area!=='management').map(p=>p.key);
const management=moduleRegistry.filter(p=>p.area==='management').map(p=>p.key);
const areaByKey=new Map(moduleRegistry.map(p=>[p.key,p.area]));
if(specialist.length+management.length<58)throw Error('The complete 58-module acceptance population must be retained.');
const summary={mode:"ALL_PROJECTS_GENERIC_INVARIANTS",expectedRelease:expected,projects:[],checks:[],transportRetries:[],status:"running"};
const comparable=v=>Array.isArray(v)?v.map(comparable):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).filter(([k])=>k!=="generatedAt").map(([k,x])=>[k,comparable(x)])):v;
const digest=v=>createHash("sha256").update(JSON.stringify(comparable(v))).digest("hex");
const check=(name,ok,projectId=null,detail=null)=>{summary.checks.push({name,status:ok?"pass":"fail",projectFingerprint:projectId?createHash("sha256").update(projectId).digest("hex").slice(0,16):null,detail:ok?null:detail});return ok;};

async function pool(items,run){
  let next=0;
  await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{while(next<items.length){const item=items[next++];await run(item);}}));
}

async function response(path,allowed=[200],proxyRetry=false){
  const res=await fetch(base+path,{signal:AbortSignal.timeout(90000)});
  if(!allowed.includes(res.status)){
    const text=await res.text();
    // The execution proxy can refuse a connection before Railway receives it.
    // Retry that exact proxy response once, retaining it in the evidence. Real
    // application/proxy failures from Railway are not retried or reclassified.
    if(!proxyRetry&&res.status===502&&text.includes('[Errno 111] Connection refused')){
      summary.transportRetries.push({path:path.replace(/projects\/[^/]+/,"projects/[redacted]"),status:502,reason:'Execution proxy refused the connection',at:new Date().toISOString()});
      return response(path,allowed,true);
    }
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
  return projectPath(id,"/"+areaByKey.get(key)+"/modules/"+key);
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
    let projectFactsDigest=null;
    const checkProjectFacts=(body,label)=>{
      const facts=body?.data?.projectFacts;
      check(label+": canonical project facts attached",facts&&facts.projectId===id&&facts.projectVersion===overview.version,id);
      if(!facts)return;
      check(label+": displayed values match shared facts",projectFactConsumerMismatches(body.data).length===0,id);
      const current=digest(facts);
      if(projectFactsDigest===null){
        projectFactsDigest=current;
        check('Portfolio current-contract comparison matches project facts',p.submittedDaysAfterCurrentContract===(facts.time.submittedDaysAfterCurrentContract?.value??null),id);
        for(const money of facts.commercial.currencies){
          const card=p.commercialSummary?.find(row=>row.currency===money.currency);
          check('Portfolio '+money.currency+' money matches project facts',card?.currentContractValue===money.currentContractValue.value&&card?.forecastEac===(money.forecastEac?.value??null)&&card?.certifiedUnpaidAmount===money.certifiedUnpaidAmount.value,id);
        }
      }
      else check(label+": canonical project facts equal every other page",current===projectFactsDigest,id);
    };

    const t0=Date.now();
    const dash=await json(prefix+"/management/master-dashboard",[200,409]);
    const dashboardMs=Date.now()-t0;
    check("Dashboard response stays within release target",dashboardMs<=coldTargetMs,id,"dashboardMs="+dashboardMs);
    check("Dashboard returns a governed state rather than a transport error",dash.status===200,id,"status="+dash.status);

    await pool(specialist,async key=>{
      const path=modulePath(id,key);
      const page=await json(path,[200,409]);
      projectSummary.pageCount++;
      const body=page.body;
      check(key+": page returns a governed result",body&&typeof body==="object"&&typeof body.status==="string",id,"status="+page.status);
      checkProjectFacts(body,key);
      check(key+": no non-finite JSON marker",!/NaN|Infinity/.test(JSON.stringify(body)),id);
      const foreign=[...new Set(governedProjectionProjectIds(body))].filter(x=>x!==id);
      check(key+": no structured cross-project contamination",foreign.length===0,id,foreign.join(","));
      const invented=inventedMissing(body);
      check(key+": missing/unavailable values are not populated",invented.length===0,id,invented.slice(0,5).join(","));
      const pageDate=body?.data?.reportingContract?.dataDateIso??body?.data?.dataDateIso??body?.data?.result?.dataDateIso??null;
      if(pageDate&&expectedDate)check(key+": Data Date matches current project programme",String(pageDate).slice(0,10)===String(expectedDate).slice(0,10),id,pageDate+" vs "+expectedDate);
      const report=await json(path+"/report.json",[200,409]);
      if(page.body?.status!=="blocked"){
        check(key+": report is available when page is available",report.status===200,id,"report status="+report.status);
        check(key+": page and report share the exact governed data",report.status===200&&digest(report.body?.result?.data)===digest(body?.data),id);
      }else{
        projectSummary.blockedPages.push(key);
        check(key+": empty or blocked response is a normal result",page.status===200&&report.status===200&&report.body?.result?.status==="blocked",id,"page="+page.status+" report="+report.status);
        check(key+": blocked page explains why",typeof body.reason==="string"&&body.reason.trim().length>0,id);
      }
    });

    const managementViews=new Map();
    await pool(management,async key=>{
      const page=await json(prefix+"/management/"+key,[200,409]);
      projectSummary.pageCount++;
      managementViews.set(key,page.body);
      check(key+": management page returns a governed result",page.body&&typeof page.body==="object"&&typeof page.body.status==="string",id);
      checkProjectFacts(page.body,key);
      check(key+": no non-finite JSON marker",!/NaN|Infinity/.test(JSON.stringify(page.body)),id);
      const foreign=[...new Set(governedProjectionProjectIds(page.body))].filter(x=>x!==id);
      check(key+": no structured cross-project contamination",foreign.length===0,id,foreign.join(","));
      const invented=inventedMissing(page.body);
      check(key+": missing/unavailable values are not populated",invented.length===0,id,invented.slice(0,5).join(","));
      const report=await json(prefix+"/management/"+key+"/report.json",[200,409]);
      if(page.body?.status!=="blocked"){
        check(key+": page and report share the exact governed data",report.status===200&&digest(report.body?.result?.data)===digest(page.body?.data),id);
      }else{
        projectSummary.blockedPages.push(key);
        check(key+": blocked management page explains why",typeof page.body.reason==="string"&&page.body.reason.trim().length>0,id);
      }
    });

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
    console.log(JSON.stringify({completedProjects:summary.projects.length,totalProjects:projects.length,pageCount:projectSummary.pageCount,failedChecks:summary.checks.filter(c=>c.status==="fail").length}));
    writeFileSync(process.env.CMENG_ACCEPTANCE_OUTPUT??"system-acceptance.json",JSON.stringify(summary,null,2));
  }

  const finalHealth=(await json("/health")).body;
  check("Release remains unchanged through every project check",finalHealth.release===expected);
  const failed=summary.checks.filter(x=>x.status==="fail");
  summary.failedCheckCount=failed.length;
  summary.status=failed.length?"fail":"pass";
  if(failed.length)process.exitCode=1;
}catch(error){
  summary.status="fail";
  summary.error=error instanceof Error?error.message:String(error);
  process.exitCode=1;
}finally{
  writeFileSync(process.env.CMENG_ACCEPTANCE_OUTPUT??"system-acceptance.json",JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
}
