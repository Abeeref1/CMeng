import {createHash} from "node:crypto";
import {writeFileSync} from "node:fs";

const base=(process.env.CMENG_RAILWAY_URL??"https://cmeng-main-production.up.railway.app").replace(/\/$/,"");
const expected=process.env.CMENG_EXPECTED_RELEASE??"";
const minProjects=Number(process.env.CMENG_MIN_PROJECTS??"19");
const orbit=process.env.CMENG_ORBIT_PROJECT??"ORBIT-JED-PLH-P3";
if(!/^[a-f0-9]{40}$/.test(expected))throw new Error("CMENG_EXPECTED_RELEASE must be an exact commit SHA");

const summary={mode:"ALL_PAGES_PAGE_FIRST_ALL_PROJECTS_ORBIT_LAST",expectedRelease:expected,status:"running",projectCount:0,pageCount:0,checks:[],pages:[]};
const comparable=v=>Array.isArray(v)?v.map(comparable):v&&typeof v==="object"
  ?Object.fromEntries(Object.entries(v).filter(([k])=>k!=="generatedAt").map(([k,x])=>[k,comparable(x)])):v;
const digest=v=>createHash("sha256").update(JSON.stringify(comparable(v))).digest("hex");
const fingerprint=id=>createHash("sha256").update(id).digest("hex").slice(0,16);
const check=(name,ok,pageKey=null,projectId=null,detail=null)=>{
  summary.checks.push({name,pageKey,projectFingerprint:projectId?fingerprint(projectId):null,status:ok?"pass":"fail",detail:ok?null:detail});
  return ok;
};
async function response(path,allowed=[200]){
  const res=await fetch(base+path,{signal:AbortSignal.timeout(90000)});
  if(!allowed.includes(res.status)){
    const text=await res.text();
    throw new Error(path.replace(/projects\/[^/]+/,"projects/[redacted]")+" HTTP "+res.status+" "+text.slice(0,300));
  }
  return res;
}
async function json(path,allowed=[200]){const r=await response(path,allowed);return {status:r.status,body:await r.json()};}
const projectPath=(id,suffix)=>"/api/projects/"+encodeURIComponent(id)+suffix;
function route(id,page,report=false){
  const tail=report?"/report.json":"";
  return page.area==="management"
    ?projectPath(id,"/management/"+encodeURIComponent(page.key)+tail)
    :projectPath(id,"/"+page.area+"/modules/"+encodeURIComponent(page.apiKey??page.key)+tail);
}
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
  if(["missing","unavailable","not_established"].includes(state)&&Object.prototype.hasOwnProperty.call(value,"value")&&value.value!==null&&value.value!==undefined)out.push(path||"root");
  for(const [k,v] of Object.entries(value))inventedMissing(v,path?path+"."+k:k,out);
  return out;
}
function usefulPayload(data){
  if(!data||typeof data!=="object")return false;
  const ignored=new Set(["projectionKey","schemaVersion","projectId","projectVersion","producerVersion","generatedAt","reportingContract","positionVerdict"]);
  return Object.entries(data).some(([k,v])=>{
    if(ignored.has(k)||v===null||v===undefined)return false;
    if(Array.isArray(v))return v.length>0;
    if(typeof v==="object")return Object.keys(v).length>0;
    if(typeof v==="string")return v.trim().length>0;
    return true;
  });
}

try{
  const health=(await json("/health")).body;
  check("Exact deployed release is healthy",health?.release===expected&&health?.status==="ok",null,null,health?.release??"no health");

  const registrySpecs=[
    {area:"schedule",path:"/api/schedule/modules"},
    {area:"commercial",path:"/api/commercial/modules"},
    {area:"delivery",path:"/api/delivery/modules"},
  ];
  const pages=[];
  for(const spec of registrySpecs){
    const body=(await json(spec.path)).body;
    const modules=Array.isArray(body.modules)?body.modules:[];
    check(spec.area+" registry is available",modules.length>0,null,null,"count="+modules.length);
    for(const m of modules){
      if(typeof m?.key!=="string"||!m.key.trim())continue;
      pages.push({key:m.key,apiKey:typeof m.apiKey==="string"&&m.apiKey?m.apiKey:m.key,area:spec.area});
    }
  }
  for(const key of ["master-dashboard","command-center","cross-domain-accountability","master-control-programme","source-quality"])pages.push({key,apiKey:key,area:"management"});
  const unique=new Map();
  for(const page of pages)unique.set(page.area+":"+page.key,page);
  const allPages=[...unique.values()];
  summary.pageCount=allPages.length;
  check("Full navigation registry is represented",allPages.length>=58,null,null,"pageCount="+allPages.length);
  check("Delivery registry is represented",allPages.filter(p=>p.area==="delivery").length>=23,null,null,"deliveryCount="+allPages.filter(p=>p.area==="delivery").length);
  check("Management Accountability is represented",allPages.some(p=>p.key==="cross-domain-accountability"),null,null);

  const portfolio=(await json("/api/portfolio")).body;
  const projects=Array.isArray(portfolio.projects)?portfolio.projects:[];
  summary.projectCount=projects.length;
  check("Live portfolio contains required regression population",projects.length>=minProjects,null,null,"projectCount="+projects.length);
  const ordered=[...projects].sort((a,b)=>{
    if(a.projectId===orbit&&b.projectId!==orbit)return 1;
    if(b.projectId===orbit&&a.projectId!==orbit)return -1;
    return String(a.projectId).localeCompare(String(b.projectId));
  });
  check("ORBIT is present in regression population",ordered.some(p=>p.projectId===orbit),null,null);

  const overviewDates=new Map();
  for(const p of ordered){
    const overview=(await json(projectPath(p.projectId,"/overview"))).body;
    overviewDates.set(p.projectId,overview.latestDataDateIso??null);
  }

  for(const page of allPages){
    const pageSummary={key:page.key,area:page.area,checkedProjects:0,blockedProjects:0,failedChecks:0};
    summary.pages.push(pageSummary);
    for(const p of ordered){
      const id=p.projectId;
      const beforeFailures=summary.checks.filter(x=>x.status==="fail").length;
      const result=await json(route(id,page),[200,409]);
      const body=result.body;
      pageSummary.checkedProjects++;
      check("Page returns a governed result",body&&typeof body==="object"&&typeof body.status==="string",page.key,id,"status="+result.status);
      check("No non-finite JSON marker",!/NaN|Infinity/.test(JSON.stringify(body)),page.key,id);
      const foreign=[...new Set(governedProjectionProjectIds(body))].filter(x=>x!==id);
      check("No structured cross-project contamination",foreign.length===0,page.key,id,foreign.join(","));
      const invented=inventedMissing(body);
      check("Missing/unavailable values are not populated",invented.length===0,page.key,id,invented.slice(0,5).join(","));
      const expectedDate=overviewDates.get(id);
      const pageDate=body?.data?.reportingContract?.dataDateIso??body?.data?.dataDateIso??body?.data?.result?.dataDateIso??null;
      if(pageDate&&expectedDate)check("Data Date matches current programme",String(pageDate).slice(0,10)===String(expectedDate).slice(0,10),page.key,id,pageDate+" vs "+expectedDate);
      const report=await json(route(id,page,true),[200,409]);
      if(result.status===200){
        check("Available page has report",report.status===200,page.key,id,"report status="+report.status);
        check("Page/report exact governed data parity",report.status===200&&digest(report.body?.result?.data)===digest(body?.data),page.key,id);
        check("Available page has usable content",usefulPayload(body?.data),page.key,id);
      }else{
        pageSummary.blockedProjects++;
        check("Blocked page fails closed in report",report.status===409,page.key,id,"report status="+report.status);
        check("Blocked page explains why",typeof body.reason==="string"&&body.reason.trim().length>0,page.key,id);
      }
      const afterFailures=summary.checks.filter(x=>x.status==="fail").length;
      pageSummary.failedChecks+=afterFailures-beforeFailures;
    }
    check("ORBIT checked last for this page",ordered.at(-1)?.projectId===orbit,page.key,null);
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
  writeFileSync("full-page-acceptance.json",JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
}
