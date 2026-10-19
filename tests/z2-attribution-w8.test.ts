import {runInNewContext} from './browser-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import type {AddressInfo} from 'node:net';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {positionVerdict,blockedCause} from '../packages/runtime-api/src/position-review';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {createCmengServer} from '../packages/runtime-api/src/server';

// W8: a statement on screen must be true for the data behind it.
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
const functions=(names:string[])=>source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&names.includes(n.name.text)).map(n=>n.getText(source)).join('\n');

test('SW-29: a CMeng calculation that did not complete is not reported as the user\'s missing input',()=>{
 // Shapes produced today: the planning view that could not be calculated
 // (no input named) and an engine that reports failure.
 const notCalculated={key:'float-analysis',status:'blocked' as const,engineState:'blocked' as const,reason:'The selected Programme & Planning view could not be calculated.',dependencies:[],data:null};
 const failedEngine={key:'monte-carlo-risk',status:'blocked' as const,engineState:'failed' as const,reason:'No successful simulation iterations were produced.',dependencies:['adopted programme'],data:null};
 for(const r of [notCalculated,failedEngine]){
  const v=positionVerdict(r);
  assert.doesNotMatch(v.text,/missing inputs/i,r.key);
  assert.match(v.text,/CMeng did not complete this calculation/,r.key);
  assert.match(v.text,/No missing input has been identified/,r.key);
  assert.doesNotMatch(v.nextAction,/Provide the missing inputs/,r.key);
  assert.equal(v.owner,'CMeng Support',r.key);
  assert.equal(v.rag,'unknown',r.key);
 }
 // A truly missing input is still named as one.
 const missing={key:'float-analysis',status:'blocked' as const,engineState:'blocked' as const,reason:'Programme evidence has not been established.',dependencies:['schedule'],data:null};
 const m=positionVerdict(missing);
 assert.match(m.text,/The missing inputs are listed below/);
 assert.match(m.nextAction,/Provide the missing inputs/);
 assert.equal(blockedCause(missing),'missing_input');
 assert.equal(blockedCause({...missing,status:'partial'}),null);
 // The browser view uses the same shared rule, not its own copy.
 const ctx:any={};runInNewContext(functions(['blockedCause']),ctx);
 for(const r of [notCalculated,failedEngine,missing])assert.equal(ctx.blockedCause(r),blockedCause(r));
 assert.match(script,/calculationIncomplete=blockedCause\(result\)==="calculation_incomplete"/);
 assert.match(script,/CMeng did not complete this calculation\. No missing input has been identified for it\./);
});

function xer(project:string){
 return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+project+'\t2026-06-01',
  '%T\tPROJWBS','%F\twbs_id\tproj_id\twbs_short_name\twbs_name','%R\t10\t1\tROOT\tProject','%T\tTASK',
  '%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct',
  '%R\t100\t1\t10\tA100\tMobilise\tTK_Complete\t2026-05-01\t2026-05-02\t2026-05-01\t2026-05-02\t16\t0\t0\t100',
  '%R\t101\t1\t10\tA200\tExcavate East Station\tTK_Active\t2026-05-03\t2026-07-10\t2026-05-03\t2026-07-15\t48\t24\t16\t50',
  '%T\tTASKPRED','%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt','%R\tR1\t1\t101\t1\t100\tPR_FS\t0','%E'].join('\n');
}

test('SW-30: counts taken from the contractor\'s submitted float are labelled submitted, never an independent check',async()=>{
 const server=createCmengServer();
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',()=>resolve()));
 try{
  const base='http://127.0.0.1:'+(server.address() as AddressInfo).port,project='Z2-ATTRIBUTION-SW30';
  const up=await fetch(base+'/api/projects/'+project+'/evidence/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'current.xer','x-upload-intent':'replace_current_basis','x-schedule-role':'update'},body:xer(project)});
  assert.equal(up.status,201);
  const report=await fetch(base+'/api/projects/'+project+'/evidence/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'monthly-report.txt','x-evidence-category':'other'},body:['MONTHLY PROGRESS REPORT','Activity count: 1','Relationship count: 0','Critical activities: 0'].join('\n')});
  assert.equal(report.status,201);
  const result=await (await fetch(base+'/api/projects/'+project+'/schedule/modules/schedule-analytics')).json() as any;
  const items:any[]=result.data.challenge.items;
  const critical=items.find(i=>i.metric==='critical_count');
  assert.ok(critical,'critical_count comparison');
  // Figures unchanged: the count is still the count of the submitted float.
  assert.equal(critical.independent.value,0);assert.equal(critical.submitted.value,0);
  assert.equal(critical.independent.state,'calculated');
  assert.equal(critical.independent.authority,'submitted');
  assert.doesNotMatch(critical.consequence,/independent positions/i);
  assert.match(critical.consequence,/not an independent check/);
  for(const metric of ['near_critical_count','negative_float_count']){
   const item=items.find(i=>i.metric===metric);if(item)assert.equal(item.independent.authority,'submitted',metric);
  }
  // CMeng's own count of the programme records keeps its independent label.
  const activity=items.find(i=>i.metric==='activity_count');
  assert.equal(activity.independent.authority,'deterministic');
  assert.doesNotMatch(activity.consequence,/not an independent check/);
  // The browser comparison labels follow the same authority rule.
  const ctx:any={};runInNewContext(functions(['challengeValueFromSubmission']),ctx);
  assert.equal(ctx.challengeValueFromSubmission(critical.independent),true);
  assert.equal(ctx.challengeValueFromSubmission(activity.independent),false);
  assert.match(script,/challengeValueFromSubmission\(ind\)\?"From submitted records, not an independent check"/);
  assert.match(script,/challengeValueFromSubmission\(independent\)\?'From submitted records: ':'CMeng check: '/);
  assert.match(script,/'CMeng value and basis':'CMeng independent check'/);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
