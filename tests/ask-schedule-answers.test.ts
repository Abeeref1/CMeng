import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {ProjectAskEngine,requestedProjectFactsAnswer} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {activityDateExceptions} from '../packages/activity-analytics/src/exceptions';
import type {AnalysisResult,AskSession} from '../packages/project-ask/src/types';

const user:AskSession={userId:'schedule-reader',workspaceId:'cmeng-projects',name:null,title:null,company:null,allowModel:true};
test('multi-domain fact questions include every requested fact beyond the first authority metrics',()=>{
 const metric=(label:string,value:string|number)=>({id:label,label,value,unit:null,state:'established',traceId:label});
 const result={plan:{objective:'What are the original contract completion date, awarded EOT, extended contract completion date, current programme finish, open RFIs and certified unpaid amount?'},sections:[
  {authorityId:'programme',metrics:Array.from({length:22},(_,i)=>metric('Supporting figure '+i,i))},
  {authorityId:'forecast',metrics:[metric('Submitted programme finish','2031-12-31T14:00:00')]},
  {authorityId:'eot',metrics:[metric('Original contractual completion','2031-12-01'),metric('Contract completion including awarded EOT','2031-12-11'),metric('Awarded EOT',10)]},
  {authorityId:'payments',metrics:[metric('Certified Unpaid Amount · AED',321)]},
  {authorityId:'design',metrics:[metric('Open records',7)]},
 ]} as unknown as AnalysisResult;
 const answer=requestedProjectFactsAnswer(result)!;
 assert.match(answer.text,/Open RFIs: 7/);assert.match(answer.text,/Unpaid Amount · AED: 321/);assert.match(answer.text,/2031-12-01/);assert.match(answer.text,/2031-12-11/);assert.match(answer.text,/Awarded EOT: 10/);assert.match(answer.text,/2031-12-31/);assert.doesNotMatch(answer.text,/Supporting figure|T14/);
 assert.equal(answer.traceIds.length,6);
});
let sequence=0;
type Row=[string,string,string,string,string,string,string,string?];
const rows:Row[]=[
  ['START','TK_NotStart','2026-09-10 08:00','2026-09-30 17:00','','','8'],
  ['FINISH','TK_Active','2026-09-08 08:00','2026-09-12 17:00','2026-09-08 08:00','','-8'],
  ['BOTH','TK_NotStart','2026-09-10 08:00','2026-09-12 17:00','','','0'],
  ['FUTURE','TK_NotStart','2026-09-16 08:00','2026-09-20 17:00','','','16'],
  ['DONE','TK_Complete','2026-09-01 08:00','2026-09-12 17:00','2026-09-01 08:00','2026-09-12 17:00','0'],
  ['UNKNOWN','unreadable','','','','',''],
  ['FUTURE-ACTUAL','TK_Complete','2026-09-01 08:00','2026-09-12 17:00','2026-09-01 08:00','2026-09-20 17:00','0'],
  ['NO-FINISH','TK_NotStart','2026-09-10 08:00','','','','40'],
  ['SUMMARY','TK_NotStart','2026-09-01 08:00','2026-09-02 17:00','','','-80','TT_WBS'],
];
function xer(input:Row[]=rows,project='ASK-SCHEDULE'){
  return Buffer.from(['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+project+'\t2026-09-14 17:00',
    '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\tact_start_date\tact_end_date\ttotal_float_hr_cnt\ttask_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt',
    ...input.map((r,i)=>['%R',String(i+1),'1',r[0],r[0]+' work',...r.slice(1,7),r[7]??'TT_Task','16','16'].join('\t')),'%E'].join('\n'));
}
async function fixture(t:any,input=rows){
  const id='ASK-SCHEDULE-'+(++sequence),root=mkdtempSync(join(tmpdir(),'ask-schedule-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  let paid=0;const engine=new ProjectAskEngine(new AskStore(root),{plan:async()=>{paid++;throw new Error('A deterministic question called AI');},explain:async()=>{paid++;throw new Error('A deterministic question called AI');}});
  const upload=async(input:Row[],intent:'replace_current_basis'|'add_update'='replace_current_basis')=>runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'same-file.xer',bytes:xer(input,id),mediaType:'text/plain',uploadedAt:'2026-09-27',role:'update',uploadIntent:intent});
  await upload(input);
  const ask=(question:string,previous?:AnalysisResult)=>engine.ask(id,user,{question,...(previous?{conversationId:previous.conversationId,analysisId:previous.id}:{})});
  return {id,engine,ask,upload,paid:()=>paid};
}
const ids=(r:AnalysisResult)=>r.sections.find(s=>s.authorityId==='activities')!.tables[0]!.rows.map(r=>r.activityId).sort();

test('ordinary schedule questions answer with the hand-checked activity list, not the delay claims register',async t=>{
  const f=await fixture(t);
  for(const q of ['Show delayed activities','What are the delayed activities?','Which activities are late?']){
    const answer=await f.ask(q);assert.deepEqual(answer.plan.authorities,['activities','float']);assert.deepEqual(ids(answer),['BOTH','FINISH','NO-FINISH','START']);
    assert.match(answer.narrative[0]!.text,/4 activities/);assert.doesNotMatch(answer.narrative[0]!.text,/Existing .* producer|entitlement|Claim records/);
  }
  for(const q of ['Which activities should have started?','activities should start and didnt','Show missed starts'])assert.deepEqual(ids(await f.ask(q)),['BOTH','NO-FINISH','START'],q);
  for(const q of ['Show overdue finishes','Which activities should have finished?'])assert.deepEqual(ids(await f.ask(q)),['BOTH','FINISH'],q);
  const negative=await f.ask('How many negative-float activities?');assert.deepEqual(ids(negative),['FINISH']);
  const claims=await f.ask('Show the delay event register');assert.ok(claims.plan.authorities.includes('delay'));assert.ok(!claims.plan.authorities.includes('activities'));
  assert.equal(f.paid(),0);
  const source:any=moduleForProject(f.id,'activity-analytics').data,dashboard:any=moduleForProject(f.id,'master-dashboard').data;
  assert.equal(source.counts.missedStart.knownCount,3);assert.equal(source.counts.overdueFinish.knownCount,2);
  assert.equal(source.counts.missedStart.value,null,'unknown and future-actual statuses do not become false zeroes');
  assert.deepEqual(dashboard.scheduleExceptions.rows.map((r:any)=>r.activityId).sort(),['BOTH','FINISH','NO-FINISH','START']);
  assert.deepEqual(dashboard.scheduleExceptions.counts,source.counts);
});

test('rolled-forward dates never turn no overdue rows into a no-delay-risk answer',async t=>{
  const f=await fixture(t,[['PRESSURE','TK_NotStart','2026-09-15','2026-09-20','','','-24'],rows[3]!,rows[5]!]);
  const answer=await f.ask('Show delayed activities');assert.deepEqual(ids(answer),[]);
  const pressure=answer.sections.find(s=>s.authorityId==='float')!.tables[0]!;assert.deepEqual(pressure.rows.map(r=>r.activityId),['PRESSURE']);
  assert.match(answer.narrative[0]!.text,/no confirmed missed starts or overdue finishes/);
  assert.match(answer.narrative[0]!.text,/No baseline has been confirmed/);
  assert.match(answer.narrative[0]!.text,/1 activity has negative float/);
  assert.match(answer.narrative[0]!.text,/1 activity still needs its dates or status checked/);
  const full=await f.ask('full',answer);assert.deepEqual(ids(full),[]);assert.deepEqual(full.sections.find(s=>s.authorityId==='float')!.tables[0]!.rows,pressure.rows);
  assert.equal(f.paid(),0);
});

test('critical path exposes named activities while clearly separating source float from an unresolved calculation',async t=>{
  const f=await fixture(t),answer=await f.ask('What is the critical path?');
  assert.deepEqual(answer.plan.authorities,['critical-path']);assert.equal(answer.providerStatus,'not_needed');assert.equal(f.paid(),0);
  const list=answer.sections[0]!.tables[0]!.rows;assert.ok(list.some(r=>r.activityId==='FINISH'));assert.ok(list.some(r=>r.activityId==='BOTH'));assert.ok(!list.some(r=>r.activityId==='SUMMARY'));
  assert.match(answer.narrative[0]!.text,/independent critical path is not yet confirmed/);
  const full=await f.ask('the full list',answer);assert.deepEqual(full.sections[0]!.tables[0]!.rows,list);
  const simple=await f.ask('make it simple',full);assert.deepEqual(simple.sections,full.sections);assert.equal(simple.presentation.detail,'short');assert.equal(f.paid(),0);
});

test('a complete calendar calculation returns its actual critical activities rather than copying the source float flags',async t=>{
  const f=await fixture(t,[rows[3]!]);
  const calendar='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()((0||0(s|08:00|f|16:00)())))').join('')+'))))';
  const bytes=Buffer.from(['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCPM\t2026-09-14 08:00',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\t1\tDaily eight hours\t8\t56\t'+calendar,
    '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\tstatus_code\tclndr_id\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tearly_start_date\tearly_end_date',
    '%R\t1\t1\tLONG\tTwo-day work\tTT_Task\tTK_NotStart\t1\t16\t16\t100\t2026-09-14 08:00\t2026-09-15 16:00',
    '%R\t2\t1\tSHORT\tOne-day work\tTT_Task\tTK_NotStart\t1\t8\t8\t0\t2026-09-14 08:00\t2026-09-14 16:00','%E'].join('\n'));
  await runtimeProjects.ingestSchedule({projectId:f.id,sourceFilename:'next.xer',bytes,mediaType:'text/plain',uploadedAt:'2026-09-27',role:'update',uploadIntent:'replace_current_basis'});
  const forecast:any=moduleForProject(f.id,'independent-forecast').data;assert.equal(forecast.complete,true);assert.deepEqual(forecast.criticalActivityIds,['LONG']);
  const answer=await f.ask('Show the full critical path');assert.equal(answer.sections[0]!.state,'established');
  assert.deepEqual(answer.sections[0]!.tables[0]!.rows.map(r=>r.activityId),['LONG']);assert.equal(answer.sections[0]!.tables[0]!.rows[0]!.independentTotalFloatHours,0);
  assert.match(answer.narrative[0]!.text,/calendar calculation/);assert.equal(f.paid(),0);
});

test('full-list follow-up removes Top N and rechecks replacements, candidates and independent projects',async t=>{
  const a=await fixture(t,Array.from({length:75},(_,i)=>['L'+i,'TK_NotStart','2026-09-01','2026-09-20','','',String(-i)] as Row)),b=await fixture(t,[rows[3]!]);
  const first=await a.ask('Top 20 delayed activities');assert.equal(first.sections[0]!.tables[0]!.rows.length,20);
  const full=await a.ask('give me the full list',first);assert.equal(full.sections[0]!.tables[0]!.rows.length,75);assert.equal(full.plan.limit,null);
  assert.deepEqual(ids(await b.ask('Show delayed activities')),[]);
  await a.upload([rows[3]!],'add_update');const pending=await a.ask('full',full);assert.equal(ids(pending).length,75,'a candidate does not change the adopted answer');
  await a.upload([rows[0]!,rows[3]!]);const replaced=await a.ask('full',pending);assert.deepEqual(ids(replaced),['START']);
  assert.equal((await a.engine.store.result(full.id,a.id,user)).sections[0]!.tables[0]!.rows.length,75,'previous exports keep their snapshot');
  assert.deepEqual(ids(await b.ask('Show delayed activities')),[]);assert.equal(a.paid()+b.paid(),0);
});

test('activity paging reaches the last row and preserves existing session and project isolation',async t=>{
  const f=await fixture(t,Array.from({length:73},(_,i)=>['ROW'+i,'TK_NotStart','2026-09-01','2026-09-20','','','8'] as Row)),other=await fixture(t,[rows[3]!]);
  const server=createCmengServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+(server.address() as any).port;
  const response=await fetch(base+'/api/projects/'+f.id+'/intelligence/ask',{method:'POST',headers:{'content-type':'application/json','x-cmeng-paid-ai':'0'},body:JSON.stringify({question:'Show delayed activities'})});assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie')!.split(';')[0]!,answer:any=await response.json(),table=answer.sections[0].tables[0];assert.equal(table.rows.length,50);assert.equal(table.totalRows,73);
  const path='/intelligence/results/'+answer.id+'/tables/'+encodeURIComponent(table.id)+'?offset=50&limit=50';
  const next=await fetch(base+'/api/projects/'+f.id+path,{headers:{cookie}});assert.equal(next.status,200);const page:any=await next.json();assert.equal(page.rows.length,23);assert.equal(new Set([...table.rows,...page.rows].map(r=>r.activityId)).size,73);
  assert.equal((await fetch(base+'/api/projects/'+other.id+path,{headers:{cookie}})).status,404);
  assert.equal((await fetch(base+'/api/projects/'+f.id+path)).status,404);
  assert.equal((await fetch(base+'/api/projects/'+f.id+path.replace('limit=50','limit=999999'),{headers:{cookie}})).status,400);
});

test('reporting-instant boundaries and partial dates do not depend on a five-day calendar or wall clock',()=>{
  const base={status:'not_started',currentStartIso:'2026-09-14T17:00:00',currentFinishIso:null,forecastStartIso:null,forecastFinishIso:null,actualStartIso:null,actualFinishIso:null};
  assert.equal(activityDateExceptions(base,'2026-09-14T17:00:00').missedPlannedStart,false);
  assert.equal(activityDateExceptions({...base,currentStartIso:'2026-09-14T16:59:00'},'2026-09-14T17:00:00').missedPlannedStart,true);
  assert.equal(activityDateExceptions({...base,currentStartIso:'2026-09-13'},null).missedPlannedStart,null);
  assert.equal(activityDateExceptions({...base,status:'unknown'},'2026-09-14').finishOverdue,null);
});

test('delay-driver questions return actual schedule pressure points without collecting unrelated missing domains',async t=>{
  const f=await fixture(t);
  for(const question of ['What is driving the project delay?','Why is the project delayed?']){
    const answer=await f.engine.ask(f.id,{...user,allowModel:false},{question});
    assert.ok(answer.plan.authorities.includes('critical-path'));assert.ok(answer.plan.authorities.includes('project-diagnosis'));
    for(const id of ['materials','productivity','design','quality','construction-readiness','delay'])assert.ok(!answer.plan.authorities.includes(id),question+' must not add '+id+' by default');
    assert.match(answer.narrative[0]!.text,/FINISH — FINISH work/);assert.match(answer.narrative[0]!.text,/BOTH — BOTH work/);assert.ok(answer.sections.find(s=>s.authorityId==='project-diagnosis')!.findings.some(f=>/do not establish contractual responsibility/.test(f.explanation)));
    assert.doesNotMatch(answer.narrative[0]!.text,/Existing .*producer|Open relevant|Supply quantities/);
  }
  const finish=await f.ask('What is the completion forecast?');assert.match(finish.narrative[0]!.text,/Submitted programme finish/);assert.match(finish.narrative[0]!.text,/Contract comparison unavailable/);assert.equal(f.paid(),0);
});

test('incomplete float data is never narrated as zero float-risk activities',async t=>{
  const f=await fixture(t,[['NOFLOAT','TK_NotStart','2026-09-10 08:00','2026-09-30 17:00','','','']]);
  const answer=await f.ask('Show the worst float-risk activities');
  assert.match(answer.narrative[0]!.text,/not confirmation that no float-risk activities exist|not fully calculable/i);
  assert.doesNotMatch(answer.narrative[0]!.text,/No matching activities were found/);
});

test('delay-driver summaries retain full matching counts for Top N and do not turn missing programmes into zero',async t=>{
  const f=await fixture(t,Array.from({length:75},(_,i)=>['PRESSURE'+i,'TK_NotStart','2026-09-01','2026-09-20','','',String(-i-1)] as Row));
  const answer=await f.engine.ask(f.id,{...user,allowModel:false},{question:'What are the top 20 activities driving the project delay?'});
  const table=answer.sections.find(s=>s.authorityId==='critical-path')!.tables[0]!;
  assert.equal(table.selection?.matching??table.rows.length,75);
  assert.equal(answer.sections.find(s=>s.authorityId==='activities')!.tables[0]!.rows.length,20);
  assert.match(answer.narrative[0]!.text,/75 activities have known negative float/);assert.match(answer.narrative[0]!.text,/No baseline has been confirmed/);
  const empty=f.id+'-EMPTY';runtimeProjects.getOrCreate(empty);
  const missing=await f.engine.ask(empty,{...user,allowModel:false},{question:'What is driving the project delay?'});
  assert.match(missing.narrative[0]!.text,/Select the reporting programme/);assert.doesNotMatch(missing.narrative[0]!.text,/identifies 0|0 activities show|0 have negative/);
});
