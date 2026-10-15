import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {DEFAULT_SCHEDULE_ANALYSIS_CONFIG} from '../packages/schedule-analysis-core/src';
import {activityFloatReconciliation} from '../packages/runtime-api/src/activity-float-reconciliation';

function sample(id:string,hours:number){
 const activities=[
  {activityId:'OPEN',activityType:'task',name:'Live task',status:'in_progress',calendarId:'FIRST',totalFloatHours:-24,sourceRefs:[]},
  {activityId:'ZERO',activityType:'task',name:'Zero float',status:'in_progress',calendarId:'FIRST',totalFloatHours:0,sourceRefs:[]},
  {activityId:'NO-CALENDAR',activityType:'task',name:'Missing calendar basis',status:'in_progress',calendarId:'MISSING',totalFloatHours:16,sourceRefs:[]},
  {activityId:'COMPLETE',activityType:'task',name:'Completed work',status:'completed',calendarId:'FIRST',totalFloatHours:-96,sourceRefs:[]},
 ];
 const model:any={projectId:id,sourceRevisionId:'REV-'+id,activities,relationships:[],wbs:[],diagnostics:[],calendars:[
  {calendarId:'FIRST',semanticComplete:true,standardDayHours:hours,sourceRefs:[]},
  {calendarId:'FIRST',semanticComplete:true,standardDayHours:20,sourceRefs:[]},
 ]};
 const forecast:any={sourceRevisionId:model.sourceRevisionId,complete:true,origin:'deterministic_source_calendar',
  activities:activities.map(a=>({activityId:a.activityId,status:'calculated',calendarMode:'source_calendar',independentTotalFloatHours:a.activityId==='OPEN'?-12:a.activityId==='ZERO'?0:8}))};
 return {model,forecast};
}
test('T06 original source hours remain auditable while float is expressed in each activity calendar working days',()=>{
 for(const [id,hours] of [['A',8],['B',12]] as const){
  const {model,forecast}=sample(id,hours);
  const original=JSON.stringify(model);
  const review=activityFloatReconciliation(model,forecast,DEFAULT_SCHEDULE_ANALYSIS_CONFIG,3);
  const live=review.byActivityId.get('OPEN')!;
  assert.equal(live.workingDayHours,hours,'first original source calendar wins');
  assert.equal(live.submittedTotalFloatHours,-24,'original unrounded hours retained');
  assert.equal(live.submittedTotalFloatWorkingDays,-24/hours);
  assert.equal(live.independentTotalFloatWorkingDays,-12/hours);
  assert.equal(live.floatDifferenceWorkingDays,12/hours);
  assert.equal(live.floatDaysBasis,'source_activity_calendar');
  const zero=review.byActivityId.get('ZERO')!;
  assert.equal(zero.submittedTotalFloatWorkingDays,0,'valid zero remains zero');
  const missing=review.byActivityId.get('NO-CALENDAR')!;
  assert.equal(missing.submittedTotalFloatWorkingDays,null,'missing calendar must not become eight-hour default');
  assert.equal(missing.floatDaysBasis,'calendar_working_day_not_established');
  const completed=review.byActivityId.get('COMPLETE')!;
  assert.equal(completed.submittedTotalFloatHours,-96,'source audit remains');
  assert.equal(completed.submittedTotalFloatWorkingDays,null,'completed work excluded from current day distribution');
  assert.equal(completed.independentTotalFloatWorkingDays,null);
  assert.equal(review.summary.checkedActivityCount,3,'current denominator excludes completed source work');
  assert.equal(JSON.stringify(model),original,'input source activities and calendar were not changed');
 }
});

test('T06 activity screen shows source-calendar days with original hourly audit and excludes completed work',()=>{
 const html=cmengUatHtml();
 const match=/function sourceWorkingFloat\(row,calculated=false\)\{[\s\S]*?\n\}/.exec(html)?.[0];
 assert.ok(match,'actual browser float renderer is present');
 const render=runInNewContext('('+match+')',{fmt:(n:unknown)=>String(n)}) as (row:any,calculated?:boolean)=>string;
 assert.equal(render({status:'in_progress',floatDaysBasis:'source_activity_calendar',
   submittedTotalFloatWorkingDays:-3,submittedTotalFloatHours:-24}),'-3 working days · -24 original h');
 assert.equal(render({status:'in_progress',submittedTotalFloatHours:-24}),
   'Working-day basis not established · -24 original h','no fabricated eight-hour conversion');
 assert.equal(render({status:'completed',submittedTotalFloatWorkingDays:-3,submittedTotalFloatHours:-24}),
   'Not applicable · completed');
 assert.equal(render({status:'in_progress',submittedTotalFloatWorkingDays:0,submittedTotalFloatHours:0}),
   '0 working days · 0 original h');
});
