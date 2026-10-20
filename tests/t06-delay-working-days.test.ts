import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {buildActivityAnalyticsProjection} from '../packages/activity-analytics/src';
import {attachFloatWorkingDays,delayWorkingDays} from '../packages/runtime-api/src/activity-float-reconciliation';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// T06 / N7: finish slippage is shown in working days of the activity's own
// calendar (working hours between the two source dates on that calendar,
// divided by its day length), elapsed days second. Unknown calendar stays
// unknown, never an 8-hour day or a 7-day week.

// Sunday to Thursday, 06:00 to 18:00 UTC: a 12-hour working day.
const C12={calendarId:'C12',name:'Sun-Thu 12h',semanticComplete:true,standardDayHours:12,standardWeekHours:60,
  weeklyWorkIntervals:[1,2,3,4,5].map(dayIndex=>({dayIndex,intervals:[{start:'06:00',finish:'18:00',minutes:720}]})),exceptions:[],sourceRefs:[]};
const UNREAD={calendarId:'UNREAD',semanticComplete:false,standardDayHours:8,sourceRefs:[]};
function activity(id:string,calendarId:string,baselineFinishIso:string,currentFinishIso:string){
  return {projectId:'P',activityId:id,nativeId:id,name:id,wbsId:'W1',calendarId,activityType:'task',status:'in_progress',
    totalFloatHours:0,freeFloatHours:null,percentComplete:10,originalDurationHours:120,remainingDurationHours:120,
    currentStartIso:'2030-12-01T06:00:00Z',currentFinishIso,baselineStartIso:'2030-12-01T06:00:00Z',baselineFinishIso,
    actualStartIso:'2030-12-01T06:00:00Z',actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,sourceRefs:[],diagnostics:[]};
}
function model(activities:any[]){
  return {projectId:'P',source:'xer',sourceRevisionId:'R',dataDateIso:'2031-01-01T06:00:00Z',diagnostics:[],relationships:[],
    wbs:[{wbsId:'W1',name:'One',parentWbsId:null,sourceRefs:[]}],activities,calendars:[C12,UNREAD]} as any;
}
const meta={generatedAt:'2031-01-01T06:00:00Z',producerVersion:'t06-delay'};

test('T06 finish slippage over a weekend is 1 working day on a 12-hour calendar, 3 elapsed days kept',()=>{
  // Thu 2 Jan 18:00 -> Sun 5 Jan 18:00: Fri and Sat are non-working, Sunday gives 12 h.
  const m=model([activity('A','C12','2031-01-02T18:00:00Z','2031-01-05T18:00:00Z'),activity('U','UNREAD','2031-01-02T18:00:00Z','2031-01-05T18:00:00Z')]);
  const projection=buildActivityAnalyticsProjection(m,meta) as any;
  const out=attachFloatWorkingDays(projection,m) as any;
  const a=out.rows.find((r:any)=>r.activityId==='A'),u=out.rows.find((r:any)=>r.activityId==='U');
  assert.equal(a.finishVarianceDays,3,'elapsed days unchanged');
  assert.equal(a.finishVarianceWorkingDays,1,'Sunday 12 h on the activity calendar, never 3 or 4.5 days of 8 h');
  assert.equal(a.finishVarianceDaysBasis,'source_activity_calendar');
  assert.equal(u.finishVarianceDays,3);
  assert.equal(u.finishVarianceWorkingDays,null,'unread calendar stays unknown');
  assert.equal(u.finishVarianceDaysBasis,'calendar_working_day_not_established');
  assert.equal(projection.rows.find((r:any)=>r.activityId==='A').finishVarianceWorkingDays,undefined,'input not mutated');
  assert.deepEqual(delayWorkingDays(m,'A','2031-01-02T18:00:00Z','2031-01-05T18:00:00Z'),{calendarDays:3,workingDays:1,basis:'source_activity_calendar'});
  assert.equal(delayWorkingDays(m,'MISSING','2031-01-02T18:00:00Z','2031-01-05T18:00:00Z').workingDays,null);
});

test('T06 a delay value from another date pair is never relabelled in working days',()=>{
  const m=model([activity('A','C12','2031-01-02T18:00:00Z','2031-01-05T18:00:00Z')]);
  const out=attachFloatWorkingDays({rows:[{activityId:'A',finishVarianceDays:9}]},m) as any;
  assert.equal(out.rows[0].finishVarianceWorkingDays,null);
  assert.equal(out.rows[0].finishVarianceDaysBasis,'source_date_pair_not_matched');
});

test('T06 activity and near-critical screens show slippage in working days first, elapsed days second',()=>{
  const html=cmengUatHtml();
  assert.match(html,/function sourceWorkingDelay\(row,key\)/);
  assert.match(html,/sourceWorkingDelay\(a,"finishVarianceDays"\)/);
  assert.match(html,/sourceWorkingDelay\(r,"varianceDays"\)/);
  // W4: the unit agrees with the figure through the shared countUnit ("1 working day").
  assert.match(html,/countUnit\(working,'working days'\)\+' \(activity calendar\) · '/);
});

test('T06 working-day slippage on 8,900 activities stays fast (cached calendar walk)',()=>{
  const activities=[];
  for(let i=0;i<8900;i++){
    const base=Date.UTC(2031,0,2,18)+(i%400)*86_400_000,late=(i%37)*86_400_000+(i%5)*3_600_000;
    activities.push(activity('A'+i,i%10===0?'UNREAD':'C12',new Date(base).toISOString(),new Date(base+late).toISOString()));
  }
  const m=model(activities);
  let t=performance.now();
  const projection=buildActivityAnalyticsProjection(m,meta) as any;
  const analyticsMs=performance.now()-t;
  // Before: the same shared step on rows without slippage fields (float and duration only).
  const stripped={...projection,rows:projection.rows.map((r:any)=>{const copy={...r};delete copy.finishVarianceDays;return copy;})};
  t=performance.now();attachFloatWorkingDays(stripped,m);const beforeMs=performance.now()-t;
  t=performance.now();const cold=attachFloatWorkingDays(projection,m) as any;const coldMs=performance.now()-t;
  t=performance.now();attachFloatWorkingDays({...projection,rows:projection.rows.slice()},m);const warmMs=performance.now()-t;
  console.log(`8,900 activities: analytics ${analyticsMs.toFixed(0)} ms; shared step before ${beforeMs.toFixed(0)} ms, after cold ${coldMs.toFixed(0)} ms, after warm ${warmMs.toFixed(0)} ms`);
  assert.equal(cold.rows.filter((r:any)=>typeof r.finishVarianceWorkingDays==='number').length,8010,'every C12 activity converted');
  assert.equal(cold.rows.filter((r:any)=>r.finishVarianceDaysBasis==='calendar_working_day_not_established').length,890);
  assert.ok(coldMs<2000,'cold conversion of 8,900 rows under 2 s ('+coldMs.toFixed(0)+' ms)');
  assert.ok(warmMs<beforeMs+500,'cached conversion adds under 0.5 s per response ('+warmMs.toFixed(0)+' vs '+beforeMs.toFixed(0)+' ms)');
});
