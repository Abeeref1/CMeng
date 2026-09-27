import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectDiagnosisDetails} from '../packages/runtime-api/src/project-diagnosis';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';
import {changeDelivery,deliveryRecords,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {createCmengServer} from '../packages/runtime-api/src/server';
import type {AskSession,AnalysisResult} from '../packages/project-ask/src/types';

const user:AskSession={userId:'diagnosis-reader',workspaceId:'cmeng-projects',name:null,title:null,company:null,allowModel:false};
let sequence=0;
function programme(date='2030-01-01',shift=0,chainLength=0){
 const calendar='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()((0||0(s|08:00|f|16:00)())))').join('')+'))))';
 const rows=chainLength?Array.from({length:chainLength},(_,i)=>({id:'N'+String(i).padStart(3,'0'),name:'Work '+i,rd:8,float:0,wbs:'MEP',start:1,finish:2})):
  [{id:'A',name:'Structure East',rd:16,float:-16,wbs:'STRUCT',start:1,finish:2},{id:'ALT',name:'Structure West',rd:16,float:0,wbs:'STRUCT',start:1,finish:2},{id:'B',name:'MEP riser',rd:8,float:-8,wbs:'MEP',start:3,finish:3},{id:'C',name:'Commissioning',rd:8,float:0,wbs:'COM',start:4,finish:4},{id:'SLACK',name:'Unrelated short preparation',rd:1,float:80,wbs:'MEP',start:1,finish:1}];
 const day=(n:number)=>'2030-01-'+String(n+shift).padStart(2,'0');
 const links=chainLength?rows.slice(1).map((r,i)=>[i+1,i+2]):[[1,3],[2,3],[3,4],[5,3]];
 return Buffer.from(['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDIAGNOSIS\t'+date+' 08:00','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\t1\tSeven days eight hours\t8\t56\t'+calendar,
 '%T\tPROJWBS','%F\twbs_id\tproj_id\twbs_short_name\twbs_name\tparent_wbs_id','%R\tSTRUCT\t1\tSTRUCT\tStructure\t','%R\tMEP\t1\tMEP\tMEP\t','%R\tCOM\t1\tCOM\tCommissioning\t',
 '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\tstatus_code\tclndr_id\twbs_id\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tearly_start_date\tearly_end_date',
 ...rows.map((r,i)=>['%R',i+1,1,r.id,r.name,'TT_Task','TK_NotStart',1,r.wbs,r.rd,r.rd,r.float,day(r.start)+' 08:00',day(r.finish)+' 16:00'].join('\t')),
 '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\tpred_proj_id',...links.map(([pre,post],i)=>['%R',i+1,post,pre,'PR_FS',0,1,1].join('\t')),'%E'].join('\n'));
}
async function fixture(t:any,chainLength=0){
 const id='DIAGNOSIS-'+(++sequence),root=mkdtempSync(join(tmpdir(),'cmeng-diagnosis-'));t.after(()=>rmSync(root,{recursive:true,force:true}));let calls=0;
 const engine=new ProjectAskEngine(new AskStore(root),{plan:async()=>{calls++;throw new Error('Unexpected paid planning');},explain:async()=>{calls++;throw new Error('Unexpected paid explanation');}});
 const upload=(date='2030-01-01',shift=0,intent:'replace_current_basis'|'add_update'='replace_current_basis')=>runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'same-name.xer',bytes:programme(date,shift,chainLength),mediaType:'text/plain',uploadedAt:'2030-01-03',role:'update',uploadIntent:intent});await upload();
 const state=runtimeProjects.get(id)!,shown=()=> (moduleForProject(id,'pmo-analysis').data as any).projectDiagnosis,full=()=>projectDiagnosisDetails(shown());
 const change=(input:any)=>{changeDelivery(state,{expectedVersion:state.version,...input});runtimeProjects.touch(state);};
 const record=(kind:string,reference:string,fields:any,activityId:string)=>{change({action:'create',kind,fields:{'record reference':reference,description:reference,...fields}});const row=deliveryRecords(state).records.find(r=>r.recordId===deliveryStore(state).manual.at(-1)!.recordId)!;change({action:'review',recordId:row.recordId,sourceRevision:row.revision,state:'governed',fields:{},links:{activityIds:[activityId]},note:'Hand-checked diagnosis scenario'});return row;};
 const ask=(question:string,previous?:AnalysisResult)=>engine.ask(id,user,{question,...previous?{conversationId:previous.conversationId,analysisId:previous.id}:{}});
 return {id,state,shown,full,upload,record,change,ask,calls:()=>calls};
}

test('XER alone establishes a tied driving network, WBS pressure and a no-change finish without contract or quantities',async t=>{
 const f=await fixture(t),d=f.full();
 assert.equal(d.executionActivityCount,5);assert.equal(d.relationshipCount,4);assert.equal(d.calendarCount,1);
 assert.equal(d.network.state,'calculated');assert.deepEqual(new Set(d.network.rows.map((r:any)=>r.activityId)),new Set(['A','ALT','B','C']));
 assert.equal(d.network.relationships.length,3);assert.ok(!d.network.relationships.some((r:any)=>r.predecessorActivityId==='SLACK'));
 assert.equal(d.completion.independentFinishIso,'2030-01-04T16:00:00.000Z');assert.equal(d.completion.contractualFinishIso,null);
 assert.equal(d.counts.negativeFloat.value,2);assert.equal(d.counts.baselineSlippage.knownCount,null);assert.equal(d.revision.state,'unavailable');
 assert.equal(d.wbsRows.find((r:any)=>r.wbs==='Structure').drivingCount,2);assert.match(d.noChangeOutlook,/2030-01-04/);
 const path=await f.ask('Show me the critical path');assert.equal(path.sections[0]!.tables[0]!.id,'critical-path.network');assert.equal(path.sections[0]!.tables[0]!.rows.length,4);assert.match(path.narrative[0]!.text,/A → B|ALT → B/);
 const all=await f.ask('show full path',path);assert.equal(all.sections[0]!.tables[0]!.rows.length,4);assert.equal(all.plan.limit,null);
 for(const q of ['Which WBS has most schedule pressure?','What happens if nothing changes?','What are the top 10 things I need to act on?']){const answer=await f.ask(q);assert.equal(answer.plan.authorities[0],'project-diagnosis');assert.doesNotMatch(answer.narrative[0]!.text,/Open relevant page|Existing .*producer/);}
 assert.equal(f.calls(),0);
});

test('ordinary management questions and WBS follow-ups retain the requested activity population',async t=>{
 const f=await fixture(t);
 const cases:[string,string][]=[['What is the critical path?','critical-path'],['What is driving completion?','project-diagnosis'],['Why is the project late?','project-diagnosis'],['What caused the delay?','project-diagnosis'],['Which activities are delayed?','activities'],['Give me all delayed activities.','activities'],['Which WBS is causing the problem?','project-diagnosis'],['What changed since the previous programme?','project-diagnosis'],['What should have started already?','activities'],['What should have finished already?','activities'],['Where is the negative float?','float'],['Which milestones are threatened?','project-diagnosis'],['What are the top 10 things I need to act on?','project-diagnosis'],['What happens if nothing changes?','project-diagnosis'],['Show all late items','activities']];
 for(const [q,id] of cases){const a=await f.ask(q);assert.ok(a.plan.authorities.includes(id),q+': '+a.plan.authorities);assert.ok(!a.plan.authorities.includes('delay'),q);assert.ok(a.narrative.length,q);}
 const negative=await f.ask('Show all negative-float activities');
 const explained=await f.ask('Explain these',negative);assert.match(explained.narrative[0]!.text,/2 activities match your preceding selection/);assert.match(explained.narrative[0]!.text,/MEP riser/);assert.equal(explained.plan.authorities.includes('delay'),false);
 const grouped=await f.ask('group by WBS',explained),table=grouped.sections[0]!.tables[0]!;
  assert.equal(table.rows.reduce((n,r)=>n+Number(r.activityCount),0),2);assert.equal(table.rows.reduce((n,r)=>n+Number(r.negativeFloatCount),0),2);
  const selectedDrill=await f.ask('Show the contributing activities for WBS "STRUCT"',grouped);
  assert.deepEqual(selectedDrill.plan.authorities,['activities']);assert.deepEqual(selectedDrill.sections[0]!.tables[0]!.rows.map(r=>r.activityId),['A']);
  const scopedExplanation=await f.ask('Explain these',selectedDrill);
  assert.equal(scopedExplanation.sections.find(s=>s.authorityId==='project-diagnosis')!.metrics[0]!.value,1);
  assert.doesNotMatch(scopedExplanation.narrative.map(n=>n.text).join(' '),/preceding selection: Not established/);
  const allPressure=await f.ask('Show all schedule pressure activities for WBS "STRUCT"');
  assert.deepEqual(allPressure.plan.authorities,['activities']);assert.deepEqual(new Set(allPressure.sections[0]!.tables[0]!.rows.map(r=>r.activityId)),new Set(['A','ALT']));
 const drill=await f.ask('Show all schedule pressure activities for WBS "MEP"');
 assert.deepEqual(drill.sections.find(s=>s.authorityId==='activities')!.tables[0]!.rows.map(r=>r.activityId),['B']);
 const path=await f.ask('critical path'),pathGroups=await f.ask('by WBS',path);
 assert.equal(pathGroups.sections[0]!.tables[0]!.rows.reduce((n,r)=>n+Number(r.activityCount),0),4);
 const milestones=await f.ask('Which milestones are threatened?');assert.deepEqual(milestones.sections[0]!.tables.map(t=>t.id),['project-diagnosis.milestones']);
 assert.equal(f.calls(),0);
});

test('diagnosis crosses linked evidence, revision changes, candidate updates and record withdrawal without affecting another project',async t=>{
 const a=await fixture(t),b=await fixture(t);const first=a.full();
 await a.upload('2030-01-03',2,'add_update');assert.equal(a.full().revision.state,'unavailable');assert.equal(a.full().dataDateIso,first.dataDateIso);
 const candidate=a.state.schedules.at(-1)!;runtimeProjects.adoptSchedule(a.id,candidate.revision.revisionId);
 let d=a.full();assert.equal(d.revision.state,'available');assert.equal(d.revision.finishMovementCalendarDays,2);assert.equal(d.counts.previousUpdateSlippage.knownCount,5);
 const packageRow=a.record('package','MEP-017',{'scope basis':'Controlled equipment package','forecast delivery':'2030-01-10'},'B');
 d=a.full();assert.ok(d.evidenceChecks.some((c:any)=>c.recordId===packageRow.recordId&&c.activityId==='B'&&/5 calendar days after/.test(c.explanation)));
  const answer=await a.ask('Why are we late?');assert.equal(answer.plan.questionRecipe,'delay_diagnosis');assert.match(answer.narrative[0]!.text,/MEP-017/);assert.ok(answer.sections.some(s=>s.tables.some(t=>t.id==='project-diagnosis.linked-evidence')));
  const grouped=await a.ask('Which WBS has most schedule pressure?'),drill=await a.ask('Show the contributing activities for WBS "MEP"',grouped),explanation=await a.ask('Explain these',drill);
  assert.ok(explanation.sections.find(s=>s.authorityId==='project-diagnosis')!.tables.find(t=>t.id==='project-diagnosis.linked-evidence')!.rows.some(r=>r.recordId===packageRow.recordId));
 assert.equal(b.full().evidenceChecks.length,0);assert.equal(b.full().dataDateIso,'2030-01-01T08:00:00');
 a.change({action:'review',recordId:packageRow.recordId,sourceRevision:packageRow.revision,state:'governed',fields:{'forecast delivery':'2030-01-04'},note:'Delivery date corrected by reviewed source'});
 assert.ok(!a.full().evidenceChecks.some((c:any)=>c.recordId===packageRow.recordId));
 a.change({action:'review',recordId:packageRow.recordId,sourceRevision:packageRow.revision,state:'working',fields:{'forecast delivery':'2030-01-20'},note:'Withdraw current authority while source is reviewed'});
 assert.ok(!a.full().evidenceChecks.some((c:any)=>c.recordId===packageRow.recordId));assert.equal(b.full().evidenceChecks.length,0);
});

test('large path preview pages and exports the complete network with revision and project guards',async t=>{
 const f=await fixture(t,73),d=f.shown(),all=f.full();assert.equal(d.network.rows.length,25);assert.equal(d.tableTotals.network,73);assert.equal(all.network.rows.length,73);
 const server=createCmengServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+(server.address() as any).port;
 const path='/api/projects/'+f.id+'/diagnosis?section=network&version='+f.state.version;
 const response=await fetch(base+path+'&offset=50&limit=25');assert.equal(response.status,200);const page:any=await response.json();assert.equal(page.rows.length,23);assert.equal(page.rows.at(-1).activityId,'N072');
 const exported=await fetch(base+path+'&format=xlsx');assert.equal(exported.status,200);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await exported.arrayBuffer()) as any);assert.equal(workbook.worksheets[0]!.rowCount,76);
 assert.equal((await fetch(base+'/api/projects/UNKNOWN/diagnosis')).status,404);assert.equal((await fetch(base+path+'&limit=100000')).status,400);
 runtimeProjects.touch(f.state);assert.equal((await fetch(base+path)).status,409);
 const answer=await f.ask('Show the full critical path');assert.equal(answer.sections[0]!.tables[0]!.rows.length,73);assert.equal(answer.sections[0]!.tables[1]!.rows.length,72);
});
