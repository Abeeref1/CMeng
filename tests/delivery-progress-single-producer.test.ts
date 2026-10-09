import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProgressBreakdownProjection} from '../packages/progress-breakdown/src/projector';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

test('one delivery workfront calculation retains the exact old full-scope progress totals',()=>{
 const activities=[
  ['A1','W1',0,24,'not_started'],
  ['A2','W1',50,48,'in_progress'],
  ['A3','W2',100,36,'completed'],
  ['A4','W2',20,60,'in_progress'],
 ].map(([activityId,wbsId,percentComplete,originalDurationHours,status],i)=>({
  projectId:'PARITY',activityId,nativeId:String(i+1),name:'Work '+activityId,wbsId,
  calendarId:'C',activityType:'task',status,baselineStartIso:'2026-07-01',baselineFinishIso:'2026-09-01',
  currentStartIso:'2026-07-01',currentFinishIso:'2026-09-01',forecastStartIso:null,forecastFinishIso:null,
  actualStartIso:null,actualFinishIso:null,originalDurationHours,remainingDurationHours:24,
  totalFloatHours:i*8,freeFloatHours:null,percentComplete,sourceRefs:[],diagnostics:[],
 }));
 const model:any={projectId:'PARITY',source:'xer',sourceRevisionId:'REV1',dataDateIso:'2026-08-31',
  activities,relationships:[],calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],
  wbs:[{wbsId:'W1',name:'West',parentWbsId:null,sourceRefs:[]},{wbsId:'W2',name:'East',parentWbsId:null,sourceRefs:[]}],
  diagnostics:[]};
 const input={generatedAt:'2026-08-31T00:00:00Z',producerVersion:'parity'};
 const current=buildProgressBreakdownProjection(model,input);
 const historical=buildProgressBreakdownProjection({
  ...model,activities:activities.map(a=>({...a,wbsId:'DELIVERY_SCOPE'})),
 },input).rows[0]!;
 assert.equal(current.totalActivityCount,4);
 assert.equal(current.rows.length,2);
 assert.ok(current.overallSummary);
 const oldTotal=historical as unknown as Record<string,unknown>;
 const newTotal=current.overallSummary! as unknown as Record<string,unknown>;
 for(const field of ['activityCount','completedCount','inProgressCount','notStartedCount','unknownStatusCount',
  'percentCompleteAverage','percentCompleteCoveragePercent','durationWeightedProgressPercent','durationWeightedCoveragePercent',
  'originalDurationHoursKnown','remainingDurationHoursKnown','criticalCount','nearCriticalCount','negativeFloatCount',
  'baselinePlannedPercent','currentPlanPercent','baselinePlanCoveragePercent','currentPlanCoveragePercent',
  'scheduleMinusCurrentPlanPercentagePoints','scheduleMinusBaselinePercentagePoints'] as const)
  assert.deepEqual(newTotal[field],oldTotal[field],field+' drifted when the duplicate producer was removed');
});
