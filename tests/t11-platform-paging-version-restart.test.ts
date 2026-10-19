import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pageProjectResponse,recordDetailPage,jsonPointer} from "../packages/runtime-api/src/response-paging";
import {RuntimeProjectStore} from "../packages/runtime-api/src/project-state";
import {runInNewContext} from "./browser-context";

// SW-03 / N10: a register nested below the page depth budget must keep its
// first page, its true total and a pointer to the next pages. It was replaced
// by an empty [] stub (shown 0), so the page showed no rows.
test("SW-03 a deep register is paged, never replaced by an empty stub", () => {
  const rows=Array.from({length:30},(_,i)=>({reference:"NCR-"+i,status:"open",amount:i,detail:{note:"row "+i}}));
  let nested:any={rows};
  for(let i=0;i<10;i++)nested={level:nested};
  const body={key:"deep-register",data:{nested}};
  const projected=pageProjectResponse(body,"/api/projects/P1/management/deep-register") as any;
  const table=projected.responsePaging.tables.find((t:any)=>t.kind==="array"&&t.total===30);
  assert.ok(table,"the register keeps its true total");
  assert.ok(table.shown>0,"the first page is not empty");
  const page=jsonPointer(projected,table.pointer) as any[];
  assert.equal(page.length,table.shown);
  assert.equal(page[0].reference,"NCR-0");
  assert.equal(page[0].amount,0);
  const next=recordDetailPage(body,table.pointer,table.shown) as any;
  assert.equal(next.total,30);
  assert.equal(next.rows[0].reference,"NCR-"+table.shown);
  assert.deepEqual(next.rows[0].detail,{note:"row "+table.shown},"the next page carries the complete source row");
});

function xerFixture():Uint8Array{
  return new TextEncoder().encode([
    "ERMHDR\t23.12","%T\tPROJECT","%F\tproj_id\tproj_short_name\tdata_date","%R\t1\tVERSION\t2026-09-18",
    "%T\tPROJWBS","%F\twbs_id\tproj_id\twbs_short_name","%R\t10\t1\tROOT","%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t10\tA100\tMobilise\tTK_Active\t2026-09-01\t2026-09-02\t2026-09-01\t2026-09-02\t16\t8\t8\t50","%E",
  ].join("\n"));
}

// SW-52 / V1: a startup migration that re-saves the same content keeps the
// version. A migration that does change content still advances it.
test("SW-52 a startup migration with no content change keeps the project version", async () => {
  const dataDir=mkdtempSync(join(tmpdir(),"cmeng-sw52-"));
  try{
    const first=new RuntimeProjectStore({dataDir,durable:true});
    await first.ingestSchedule({uploadIntent:"replace_current_basis",projectId:"SW52",bytes:xerFixture(),mediaType:"text/plain",
      sourceFilename:"Programme_Update_01.xer",sourceRelativePath:"Schedules/Programme_Update_01.xer",role:"update",label:"Update 01",uploadedAt:"2026-09-18T20:00:00.000Z"});
    const state=first.get("SW52")!;
    state.sourceIntegrationVersion="canonical-source-v6";
    first.replace(state);
    const saved=first.get("SW52")!.version;
    const scheduleCount=first.get("SW52")!.schedules.length;
    const second=new RuntimeProjectStore({dataDir,durable:true}).get("SW52")!;
    assert.equal(second.sourceIntegrationVersion,"canonical-source-v7","the migration marker is still saved");
    assert.equal(second.version,saved,"no source or decision changed, so the version is kept");
    assert.equal(second.schedules.length,scheduleCount,"the project data is unchanged");
    const third=new RuntimeProjectStore({dataDir,durable:true}).get("SW52")!;
    assert.equal(third.version,saved,"a further restart keeps the version");
  }finally{rmSync(dataDir,{recursive:true,force:true});}
});

test("SW-52 a startup migration that changes content still advances the version", async () => {
  const dataDir=mkdtempSync(join(tmpdir(),"cmeng-sw52-boq-"));
  try{
    const store=new RuntimeProjectStore({dataDir,durable:true});
    const base={projectId:"SW52-BOQ",mediaType:"text/csv",uploadedAt:"2026-09-18T20:00:00.000Z",category:"boq_cost",documentType:"boq"};
    await store.ingestEvidenceFile({...base,bytes:new TextEncoder().encode("Item No,Section,Cost Code,Description,Unit,Quantity,Rate SAR,Amount SAR\n1,Civil,CIV-01,Concrete,m3,10,2,20"),sourceFilename:"BOQ_Rev01.csv",uploadIntent:"add_update"} as any);
    await store.ingestEvidenceFile({...base,bytes:new TextEncoder().encode("Item No,Section,Cost Code,Description,Unit,Quantity,Rate SAR,Amount SAR\n1,Civil,CIV-01,Concrete,m3,20,2,40"),sourceFilename:"BOQ_Rev02.csv",uploadedAt:"2026-09-18T20:01:00.000Z",uploadIntent:"replace_current_basis"} as any);
    const stale=store.get("SW52-BOQ")!;
    const activeId=stale.activeEvidenceBasis["boq:quantity"]!.activeArtifactId!;
    stale.boq=stale.boqRevisions.find(b=>b.ingestionId!==activeId)!;
    stale.sourceIntegrationVersion="canonical-source-v5";
    store.replace(stale);
    const saved=store.get("SW52-BOQ")!.version;
    const restored=new RuntimeProjectStore({dataDir,durable:true}).get("SW52-BOQ")!;
    assert.equal(restored.boq?.ingestionId,activeId);
    assert.equal(restored.version,saved+1,"the governed BOQ changed, so the version advances");
  }finally{rmSync(dataDir,{recursive:true,force:true});}
});

// SW-53 / P2: during a deployment restart a page read meets 502/503 or a lost
// connection. The page script waits briefly, shows a plain notice, sends the
// read again and resumes. A save is never sent twice.
function browserContext(responses:Array<()=>any>){
  const calls:Array<{path:string;method:string}>=[],delays:number[]=[],notices:string[]=[];
  let text="";
  const node={dataset:{} as Record<string,string>,innerHTML:"",get textContent(){return text;},set textContent(value:string){text=value;notices.push(value);}};
  const context:any={
    fetch:async(path:string,init:any)=>{calls.push({path,method:init?.method??"GET"});const next=responses.shift();if(!next)throw new Error("unexpected request");return next();},
    setTimeout:(fn:()=>void,ms:number)=>{if(ms<60000){delays.push(ms);fn();}return 1;},clearTimeout:()=>{},
    AbortController,el:(id:string)=>id==="globalStatus"?node:null,
    project:()=>"P1",projectRequestSeq:0,overview:null,currentModuleResult:null,loadProjectActions:async()=>{},
  };
  return {context,calls,delays,notices,status:()=>text};
}
const reply=(status:number,body:unknown)=>()=>({ok:status>=200&&status<300,status,json:async()=>body});

test("SW-53 a page read retries through a restart and then resumes", async () => {
  const run=browserContext([
    ()=>{throw new TypeError("Failed to fetch");},
    reply(502,{status:"error",code:502,message:"Application failed to respond"}),
    reply(503,{}),
    reply(200,{position:"resumed"}),
  ]);
  const data=await runInNewContext('api("/api/projects/P1/overview")',run.context);
  assert.deepEqual(JSON.parse(JSON.stringify(data)),{position:"resumed"});
  assert.equal(run.calls.length,4);
  assert.deepEqual(run.delays,[1000,2000,3000],"short increasing back-off");
  assert.ok(run.notices.includes("CMeng is restarting, retrying…"),"plain restart notice is shown");
  assert.equal(run.status(),"","the notice is cleared once the page resumes");
});

test("SW-53 a save that meets a restart is not sent twice", async () => {
  const run=browserContext([reply(502,{message:"Application failed to respond"})]);
  await assert.rejects(()=>runInNewContext('api("/api/projects/P1/actions/a1/decision",{method:"POST",body:"{}"})',run.context),(e:any)=>e.status===502);
  assert.equal(run.calls.length,1);
});
