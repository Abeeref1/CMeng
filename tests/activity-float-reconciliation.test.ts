import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject,directorForProject} from '../packages/runtime-api/src/project-projections';
import {activityFloatReconciliation} from '../packages/runtime-api/src/activity-float-reconciliation';
import {DEFAULT_SCHEDULE_ANALYSIS_CONFIG} from '../packages/schedule-analysis-core/src';

// Builder regression from the reported network. This is not fresh independent proof.
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()('+(i>0&&i<6?'(0||0(s|08:00|f|16:00))':'')+'))').join('')+'))(0||Exceptions()())))';
function network(projectId:string,missingCalendar=false){
 const tasks=[['A1',40,0,'2026-01-05 08:00','2026-01-09 16:00'],['A2',80,40,'2026-01-12 08:00','2026-01-23 16:00'],['A3',24,0,'2026-01-12 08:00','2026-01-14 16:00'],['A4',16,0,'2026-01-15 08:00','2026-01-16 16:00'],['A5',8,0,'2026-01-26 08:00','2026-01-26 16:00']];
 return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectId+'\t2026-01-05 08:00',
  ...(!missingCalendar?['%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tFive day eight hours\t'+calendar]:[]),
  '%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
  ...tasks.map(([id,hours,float,start,finish],i)=>['%R',i+1,1,1,id,id,'TT_Task','TK_NotStart',start,finish,hours,hours,float].join('\t')),
  '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  ...[[2,1],[3,1],[4,3],[5,2],[5,4]].map(([to,from],i)=>['%R',i+1,to,from,1,1,'PR_FS',0].join('\t')),'%E'].join('\n');
}
test('planted stale float is attributed to each affected activity across all five reported modules',async()=>{
 const id=('FLOAT-DISPUTE-'+randomUUID()).toUpperCase();
 await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'programme.xer',bytes:Buffer.from(network(id)),uploadedAt:'2026-01-05',mediaType:'text/plain',uploadIntent:'replace_current_basis'});
 const original=JSON.stringify(runtimeProjects.get(id)!.schedules[0]!.revision.model);
 const forecast=moduleForProject(id,'independent-forecast').data as any;
 assert.equal(forecast.complete,true);
 assert.deepEqual(forecast.activities.map((r:any)=>[r.activityId,r.independentTotalFloatHours]),[['A1',0],['A2',0],['A3',40],['A4',40],['A5',0]]);
 for(const key of ['activity-analytics','schedule-analytics','pmo-analysis','milestones','project-director']){
  const data=(key==='project-director'?directorForProject(id):moduleForProject(id,key).data) as any;
  assert.ok(data.activityFloatReconciliation,key+' has no per-activity float reconciliation');
  assert.deepEqual(data.activityFloatReconciliation.rows.filter((r:any)=>r.floatReconciliationState==='material_difference').map((r:any)=>r.activityId),['A2','A3','A4']);
  const a2=data.activityFloatReconciliation.rows.find((r:any)=>r.activityId==='A2');
  assert.equal(a2.submittedTotalFloatHours,40);assert.equal(a2.independentTotalFloatHours,0);
  assert.equal(a2.submittedCriticality,'near_critical');assert.equal(a2.independentCriticality,'critical');
  assert.equal(a2.floatReviewLabel,'Disputed / under review');
  if(key==='activity-analytics')assert.equal(data.rows.find((r:any)=>r.activityId==='A2').floatReconciliationState,'material_difference');
 }
 assert.equal(JSON.stringify(runtimeProjects.get(id)!.schedules[0]!.revision.model),original,'source model is immutable');
 const model=runtimeProjects.get(id)!.schedules[0]!.revision.model;
 const sameCounts={...model,activities:model.activities.map(row=>row.activityId==='A4'?{...row,totalFloatHours:40}:row)};
 const review=activityFloatReconciliation(sameCounts,forecast,DEFAULT_SCHEDULE_ANALYSIS_CONFIG);
 assert.deepEqual(review.summary.rows.map(row=>row.activityId),['A2','A3'],'equal aggregate counts cannot hide swapped critical activities');
 const incomplete=activityFloatReconciliation(model,{...forecast,complete:false,origin:'unresolved'},DEFAULT_SCHEDULE_ANALYSIS_CONFIG);
 assert.equal(incomplete.summary.disputedActivityCount,0);assert.equal(incomplete.summary.unresolvedActivityCount,5);
 assert.ok(incomplete.summary.rows.every(row=>row.independentTotalFloatHours===null&&row.independentCriticality==='unknown'));
 const scenario=activityFloatReconciliation(model,{...forecast,origin:'scenario_with_assumptions'},DEFAULT_SCHEDULE_ANALYSIS_CONFIG);
 assert.equal(scenario.summary.independentCpmState,'qualified_scenario');assert.equal(scenario.summary.matchedActivityCount,2);assert.equal(scenario.summary.disputedActivityCount,3);assert.equal(scenario.summary.unresolvedActivityCount,0);
 const otherRevision=activityFloatReconciliation(model,{...forecast,sourceRevisionId:'OTHER'},DEFAULT_SCHEDULE_ANALYSIS_CONFIG);
 assert.equal(otherRevision.summary.matchedActivityCount,0);
});
