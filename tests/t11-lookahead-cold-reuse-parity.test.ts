import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedIndependentForecast} from '../packages/runtime-api/src/forecast-cache';
import {assessPredecessorRequirement,buildLookAheadProjection} from '../packages/lookahead-schedule/src';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel,CanonicalScheduleRelationship} from '../packages/schedule-analysis-core/src';

// Five 8-hour days (07:00-15:00) and a two-day weekend: lags cross non-working time.
const workweek={...ELAPSED_24H_CALENDAR,calendarId:'W',name:'Five day',
  weeklyWorkMinutes:[480,480,480,480,480,0,0] as [number,number,number,number,number,number,number],
  weeklyWorkIntervals:[1,2,3,4,5,6,7].map(dayIndex=>({dayIndex,
    intervals:dayIndex<=5?[{start:'07:00',finish:'15:00',minutes:480}]:[]})),
  standardDayHours:8,standardWeekHours:40};

function programme(revision:string,count=60):CanonicalScheduleModel{
  const activities=Array.from({length:count},(_,i)=>({projectId:'LOOKAHEAD-REUSE',activityId:'A'+i,nativeId:String(i),
    name:'Work '+i,wbsId:'W'+(i%3),calendarId:i%2?'W':'C',activityType:'task' as const,status:'not_started' as const,
    baselineStartIso:'2031-01-01',baselineFinishIso:'2031-02-01',
    currentStartIso:'2031-04-'+String(2+i%20).padStart(2,'0'),currentFinishIso:'2031-05-'+String(1+i%27).padStart(2,'0'),
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
    originalDurationHours:24,remainingDurationHours:24,totalFloatHours:i%5?i:-8,freeFloatHours:null,
    percentComplete:0,sourceRefs:[],diagnostics:[]}));
  const relationships:CanonicalScheduleRelationship[]=activities.slice(1).flatMap((a,i):CanonicalScheduleRelationship[]=>[
    {relationshipId:'R'+i,predecessorActivityId:activities[i]!.activityId,successorActivityId:a.activityId,
      type:(['FS','SS','FF','SF'] as const)[i%4]!,lagHours:i%3===0?0:i%3===1?8:-4,external:false,sourceRefs:[],diagnostics:[]},
    ...(i>3?[{relationshipId:'D'+i,predecessorActivityId:activities[i-3]!.activityId,successorActivityId:a.activityId,
      type:'FS' as const,lagHours:i%2?16:0,external:false,sourceRefs:[],diagnostics:[]}]:[])]);
  return {projectId:'LOOKAHEAD-REUSE',source:'xer',sourceRevisionId:revision,dataDateIso:'2031-04-10',
    activities,relationships,wbs:[0,1,2].map(i=>({wbsId:'W'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]})),
    calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'},workweek],diagnostics:[]};
}

test('T11 cold CPM lookup reuses only a value-identical programme, without hashing distinct revisions',()=>{
  const original=programme('POOL-REV-1');
  const first=cachedIndependentForecast(original,'2031-04-10T00:00:00.000Z');
  const copy=JSON.parse(JSON.stringify(original)) as CanonicalScheduleModel;
  assert.strictEqual(cachedIndependentForecast(copy,'2031-04-11T00:00:00.000Z'),first,
    'an exact reporting copy must reuse the existing projection, including its generatedAt');
  const changed=JSON.parse(JSON.stringify(original)) as CanonicalScheduleModel;
  changed.activities[7]!.remainingDurationHours=48;
  const recalculated=cachedIndependentForecast(changed,'2031-04-12T00:00:00.000Z');
  assert.notStrictEqual(recalculated,first,'same revision label and table sizes but different content must recalculate');
  assert.equal(recalculated.generatedAt,'2031-04-12T00:00:00.000Z');
  const other=cachedIndependentForecast(programme('POOL-REV-2'),'2031-04-13T00:00:00.000Z');
  assert.notStrictEqual(other,first);
  assert.equal(other.generatedAt,'2031-04-13T00:00:00.000Z');
});

test('T11 look-ahead predecessor readiness is identical with per-projection date, calendar and lag reuse',()=>{
  const model=programme('LOOKAHEAD-REV');
  const projection=buildLookAheadProjection(model,{generatedAt:'G',producerVersion:'P',windowDays:60});
  const byId=new Map(model.activities.map(a=>[a.activityId,a]));
  let lagged=0;
  for(const row of [...projection.forwardWindowRows,...projection.overdueBacklogRows]){
    const incoming=model.relationships.filter(r=>r.successorActivityId===row.activityId);
    const dimension=row.readiness.dimensions.find(d=>d.key==='predecessor')!;
    if(!incoming.length){assert.equal(dimension.state,'not_applicable');continue;}
    const checks=incoming.map(r=>assessPredecessorRequirement(model,r,byId.get(r.predecessorActivityId),byId.get(row.activityId)!));
    lagged+=incoming.filter(r=>r.lagHours).length;
    assert.equal(dimension.note,checks.map(c=>c.note).join('; '));
    assert.equal(dimension.state,checks.some(c=>c.state==='blocked')?'blocked':checks.some(c=>c.state==='unknown')?'unknown':'ready');
    assert.deepEqual(dimension.sourceRefs,incoming.flatMap(r=>['schedule-relationship:'+r.relationshipId,'schedule-activity:'+r.predecessorActivityId]));
    const start=Date.parse(row.startIso!+'T00:00:00Z'),finish=Date.parse(row.finishIso!+'T00:00:00Z'),data=Date.parse('2031-04-10T00:00:00Z');
    assert.equal(row.daysToStart,Number(((start-data)/86_400_000).toFixed(6)));
    assert.equal(row.daysToFinish,Number(((finish-data)/86_400_000).toFixed(6)));
  }
  assert.ok(lagged>0,'fixture must exercise working-calendar lag evaluation');
  assert.ok(projection.rows.length>0);
});
