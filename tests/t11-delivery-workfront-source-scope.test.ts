import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDeliveryWorkfrontBreakdown} from '../packages/progress-breakdown/src/projector';
import {programmeLongLeadScope} from '../packages/progress-breakdown/src/long-lead-scope';
import {schedulePlanPositions} from '../packages/progress-scurve/src/projector';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

test('T11 full source long-lead scope is equivalent for every Delivery workfront subset',()=>{
 const id='SOURCE-SCOPE-COMPARISON';
 const wbs=[
  {wbsId:'ROOT',name:'Works',parentWbsId:null,sourceRefs:[]},
  {wbsId:'LL',name:'Long Lead Equipment',parentWbsId:'ROOT',sourceRefs:[]},
  {wbsId:'LL-CHILD',name:'Installation',parentWbsId:'LL',sourceRefs:[]},
  {wbsId:'NORMAL',name:'General installation',parentWbsId:'ROOT',sourceRefs:[]},
  {wbsId:'CIVIL',name:'Civil',parentWbsId:'ROOT',sourceRefs:[]},
 ];
 const current:CanonicalScheduleModel={
  projectId:id,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:'2031-03-01',
  activities:Array.from({length:600},(_,i)=>({
   projectId:id,activityId:'ACT-'+i,nativeId:String(i),
   name:i%19===0?'Explicit long lead procurement':i%17===0?'Civil earthworks':'Installation '+i,
   wbsId:['LL','LL-CHILD','NORMAL','CIVIL'][i%4]!,
   calendarId:'C',activityType:'task' as const,
   status:i%23===0?'completed' as const:'not_started' as const,
   baselineStartIso:'2031-01-01',baselineFinishIso:'2031-06-01',
   currentStartIso:'2031-01-01',currentFinishIso:'2031-07-01',
   actualStartIso:null,actualFinishIso:i%23===0?'2031-02-01':null,
   forecastStartIso:null,forecastFinishIso:null,
   originalDurationHours:24,remainingDurationHours:i%23===0?0:24,
   totalFloatHours:i%13===0?null:i%3===0?-8:i%3,
   freeFloatHours:null,percentComplete:i%23===0?100:0,sourceRefs:[],diagnostics:[],
  })),
  relationships:[],wbs,calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[],
 };
 const baseline:CanonicalScheduleModel={...current,sourceRevisionId:'BASE',activities:current.activities.map(a=>({...a,currentFinishIso:'2031-06-01'}))};
 const before=JSON.stringify({current,baseline});
 const fullMembership=programmeLongLeadScope(current).activityIds;
 assert.ok(fullMembership.size>0&&fullMembership.size<current.activities.length);
 const fullPositions=schedulePlanPositions(current,baseline);
 for(const selectedWbs of [['LL','NORMAL'],['LL-CHILD'],['CIVIL'],['NORMAL','CIVIL']]){
  const selected=current.activities.filter(a=>selectedWbs.includes(a.wbsId??''));
  const subset={...current,activities:selected};
  const options={generatedAt:'2031-03-01T00:00:00Z',
   producerVersion:'shared-workfront-source-proof',
   baselineModel:baseline,sharedPlanPositions:fullPositions};
  const original=buildDeliveryWorkfrontBreakdown(subset,options);
  const indexed=buildDeliveryWorkfrontBreakdown(subset,{
   ...options,sharedProgrammeLongLeadActivityIds:fullMembership,
  });
  assert.deepEqual(indexed,original,'all rows, unknown populations, and management signals unchanged for '+selectedWbs.join(','));
  assert.equal(indexed.overallSummary?.activityCount,selected.length,'no source activity lost');
 }
 assert.equal(JSON.stringify({current,baseline}),before,'source revisions and authorities must remain intact');
});

test('T11 absent long-lead source never becomes a made-up readiness blocker',()=>{
 const id='NO-LONG-LEAD',model:CanonicalScheduleModel={
  projectId:id,source:'xer',sourceRevisionId:'REV',dataDateIso:'2031-01-01',
  activities:[{
   projectId:id,activityId:'A',nativeId:'1',name:'Ordinary installation',wbsId:'W',
   calendarId:'C',activityType:'task',status:'not_started',
   baselineStartIso:'2031-01-01',baselineFinishIso:'2031-02-01',
   currentStartIso:'2031-01-01',currentFinishIso:'2031-02-01',
   actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
   originalDurationHours:16,remainingDurationHours:16,totalFloatHours:null,
   freeFloatHours:null,percentComplete:null,sourceRefs:[],diagnostics:[],
  }],
  relationships:[],wbs:[{wbsId:'W',name:'General',parentWbsId:null,sourceRefs:[]}],
  calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[],
 };
 const original=buildDeliveryWorkfrontBreakdown(model,{generatedAt:'2031-01-01T00:00:00Z',producerVersion:'p'});
 const reused=buildDeliveryWorkfrontBreakdown(model,{generatedAt:'2031-01-01T00:00:00Z',producerVersion:'p',
  sharedProgrammeLongLeadActivityIds:programmeLongLeadScope(model).activityIds});
 assert.deepEqual(reused,original);
 assert.equal(reused.overallSummary?.longLeadActivityCount,0);
 assert.equal(reused.overallSummary?.criticalCount,null,'missing source float stays unknown');
});
