import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {reportingState} from '../packages/runtime-api/src/reporting-state';
import {prioritizeActions,actionRecordKey} from '../packages/runtime-api/src/action-priority';
import {managementAction} from '../packages/truth-kernel/src';
import {classifyScheduleActivity} from '../packages/runtime-api/src/schedule-scope-classification';
import {analyzeSchedule} from '../packages/schedule-analysis-core/src';

test('baseline start and finish come from the matched adopted baseline, never the update target dates',()=>{
 const state=loadCertifiedDemoProject('BASELINE-DATES-'+randomUUID());
 const baseline=state.schedules.find(r=>r.role==='baseline')!,current=state.schedules.at(-1)!;
 assert.ok(baseline);assert.notEqual(baseline,current);
 const row=baseline.revision.model.activities[0]!,target=current.revision.model.activities.find(a=>a.activityId===row.activityId)!;
 row.baselineStartIso='2025-01-01';row.baselineFinishIso='2025-01-10';
 target.baselineStartIso='2030-12-20';target.baselineFinishIso='2030-01-01';state.version++;
 const actual=reportingState(state).schedules.at(-1)!.revision.model.activities.find(a=>a.activityId===row.activityId)!;
 assert.equal(actual.baselineStartIso,'2025-01-01');assert.equal(actual.baselineFinishIso,'2025-01-10');
 assert.equal(target.baselineStartIso,'2030-12-20','reporting must not overwrite retained evidence');
});

test('completed activities with missing float do not blank remaining-work float counts',()=>{
 const state=loadCertifiedDemoProject('FLOAT-POPULATION-'+randomUUID()),model=state.schedules.at(-1)!.revision.model;
 const sample=model.activities[0]!;model.activities=[{...sample,activityId:'DONE',status:'completed',totalFloatHours:null},{...sample,activityId:'OPEN',status:'not_started',totalFloatHours:-8}];model.relationships=[];
 const result=analyzeSchedule(model);assert.equal(result.float.criticalCount,1);assert.equal(result.float.unknownFloatCount,0);assert.equal(result.float.totalActivities,1);
});

test('one record produces one action and driving work outranks an older non-driving record',()=>{
 const state=loadCertifiedDemoProject('PRIORITY-'+randomUUID()),model=state.schedules.at(-1)!.revision.model,sample=model.activities[0]!;
 model.activities=[{...sample,activityId:'DRIVER',status:'not_started',totalFloatHours:-40},{...sample,activityId:'SLACK',status:'not_started',totalFloatHours:80}];
 const row=(id:string,activity:string,due:string,owner:string|null)=>managementAction({actionId:id,recordKey:actionRecordKey('RFI',id),issue:id,affectedScope:[activity],affectedMilestones:[],owner,organisation:null,requiredAction:'Obtain response',dueIso:due,escalation:null,severity:'high',authority:'source',consequence:null,sourceRefs:[id]});
 const result=prioritizeActions([row('OLD','SLACK','2020-01-01',null),row('NEW','DRIVER','2030-01-01','Design Lead'),{...row('NEW','DRIVER','2030-01-01',null),actionId:'activity-copy',sourceRefs:['second receipt']}],model,['DRIVER']);
 assert.equal(result.length,2);assert.equal(result[0]!.issue,'NEW');assert.equal(result[0]!.owner,'Design Lead');assert.deepEqual(result[0]!.sourceRefs,['NEW','second receipt']);
});

test('plot location is parsed from source text without project-specific assumptions',()=>{
 const state=loadCertifiedDemoProject('PLOT-'+randomUUID()),model=state.schedules.at(-1)!.revision.model;
 const row=classifyScheduleActivity(model,{...model.activities[0]!,wbsId:null,name:'Waterproofing Plot 127B roof'});
 assert.equal(row.plot,'Plot 127B');assert.equal(row.location,'Plot 127B');assert.equal(row.classificationBasis.plot,'source_activity_text');
});

test('server activity paging searches the entire population and does not mutate or truncate exports',async()=>{
 const {activityRegisterPage}=await import('../packages/runtime-api/src/activity-register-page');
 const rows=Array.from({length:2057},(_,i)=>({activityId:'A'+String(i).padStart(4,'0'),activityType:'task',name:i===2056?'Fire pumps':'Civil work',status:'not_started',criticality:'noncritical',totalFloatHours:40,discipline:i===2056?'Mechanical':'Civil'}));
 const first=activityRegisterPage(rows,new URLSearchParams('page=0&pageSize=50'));
 assert.equal(first.rows.length,50);assert.equal(first.totalCount,2057);assert.equal(first.pageCount,42);
 const tail=activityRegisterPage(rows,new URLSearchParams('page=41&pageSize=50'));assert.equal(tail.rows.length,7);
 const found=activityRegisterPage(rows,new URLSearchParams('q=Fire+pumps&discipline=Mechanical'));
 assert.equal(found.rows[0]!.activityId,'A2056');assert.equal(found.matchingCount,1);assert.equal(rows.length,2057);
});
