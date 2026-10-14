import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSchedule,
  sourceScheduleCompletionBases,
  type CanonicalScheduleModel,
  type CanonicalScheduleActivity,
} from '../packages/schedule-analysis-core/src';
import {buildIndependentForecastProjection} from '../packages/independent-forecast/src';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

const date=(day:number)=>'2031-03-'+String(1+(day%28)).padStart(2,'0');
function sourceModel(projectId:string,count:number):CanonicalScheduleModel {
  const activities:CanonicalScheduleActivity[]=Array.from({length:count},(_,i)=>{
    const completed=i%7===0;
    const type=i%31===0?'wbs_summary':i%37===0?'level_of_effort':i%17===0?'finish_milestone':'task';
    return {
      projectId,activityId:'A-'+i,nativeId:String(i+1),name:'Source activity '+i,
      wbsId:'W',calendarId:'C',activityType:type,
      status:completed?'completed':i%5===0?'in_progress':'not_started',
      baselineStartIso:date(i),baselineFinishIso:i%13===0?null:date(i+6),
      currentStartIso:date(i),currentFinishIso:i%19===0?null:date(i+9),
      actualStartIso:completed?date(i+24):null,
      actualFinishIso:completed&&i%11!==0?date(i+13):null,
      forecastStartIso:null,forecastFinishIso:i%23===0?'not-a-date':i%3===0?date(i+16):null,
      originalDurationHours:8,remainingDurationHours:completed?0:8,
      totalFloatHours:i%9===0?null:i%3===0?-8:24,
      freeFloatHours:null,percentComplete:completed?100:i%5===0?50:0,
      sourceRefs:[],diagnostics:[],
    };
  });
  return {
    projectId,source:'xer',sourceRevisionId:'REV-1',dataDateIso:'2031-03-05',
    activities,relationships:[],wbs:[{wbsId:'W',name:'Source WBS',parentWbsId:null,sourceRefs:[]}],
    calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[],
  };
}

test('T11/T06 exact original completion-basis parity on 0, 1, 37 and 1200 activities',()=>{
  for(const count of [0,1,37,1200]){
    const model=sourceModel('SOURCE-PARITY-'+count,count),before=JSON.stringify(model);
    const original=analyzeSchedule(model).completionBases;
    const result=sourceScheduleCompletionBases(model);
    assert.deepEqual(result,original,'all three original source bases, references, states and denominators at '+count);
    assert.equal(result.length,3);
    if(!count){
      const forecast=result.find(row=>row.basis==='forecast')!;
      assert.equal(forecast.dateIso,null,'no source is unknown, not numeric zero');
      assert.equal(forecast.state,'missing');
      assert.equal(forecast.coveragePercent,null);
    }
    assert.equal(JSON.stringify(model),before,'source dates, calendar, activities and statuses unchanged');
  }
});

test('T11 current source, completed actual, exclusion and subsequent source revision remain exact',()=>{
  const model=sourceModel('SOURCE-AUTHORITY',6);
  model.activities.forEach((activity,i)=>{
    activity.activityType='task';
    activity.status=i===0?'completed':'not_started';
    activity.actualFinishIso=i===0?'2031-07-12':null;
    activity.forecastFinishIso=i===0?'2032-01-01':i===1?'2031-07-10':null;
    activity.currentFinishIso=i===2?'2031-07-11':null;
  });
  model.activities[3]!.activityType='level_of_effort';
  model.activities[3]!.forecastFinishIso='2035-11-30';
  model.activities[4]!.activityType='wbs_summary';
  model.activities[4]!.currentFinishIso='2036-11-30';
  const before=JSON.stringify(model);
  const source=sourceScheduleCompletionBases(model).find(x=>x.basis==='forecast')!;
  assert.equal(source.dateIso,'2031-07-12','completed actual outranks future forecast on same activity');
  assert.equal(source.activityId,'A-0');
  assert.equal(source.state,'partial');
  assert.equal(source.coveragePercent,75,'3 of 4 execution activities have source dates');
  assert.deepEqual(source.sourceRefs,['activity:A-0:effectiveCurrentFinish']);
  assert.equal(JSON.stringify(model),before,'read operation cannot alter user source or authority');
  const independent=buildIndependentForecastProjection(model,{generatedAt:'2031-07-01T00:00:00Z',producerVersion:'source-proof'});
  assert.equal(independent.sourceForecastCompletionIso,source.dateIso);
  model.activities[1]!.forecastFinishIso='2031-10-13';
  assert.equal(sourceScheduleCompletionBases(model).find(x=>x.basis==='forecast')!.dateIso,'2031-10-13');
  assert.deepEqual(sourceScheduleCompletionBases(model),analyzeSchedule(model).completionBases);
});

test('T11 two projects with identical revision and activity labels cannot share source finishes',()=>{
  const first=sourceModel('SITE-ONE',80),second=sourceModel('SITE-TWO',80);
  second.sourceRevisionId=first.sourceRevisionId;
  second.activities.forEach(a=>{a.currentFinishIso='2031-04-01';a.forecastFinishIso=null;a.actualFinishIso=null;});
  second.activities[1]!.forecastFinishIso='2031-12-28';
  assert.notDeepEqual(sourceScheduleCompletionBases(first).find(x=>x.basis==='forecast'),sourceScheduleCompletionBases(second).find(x=>x.basis==='forecast'));
  assert.deepEqual(sourceScheduleCompletionBases(first),analyzeSchedule(first).completionBases);
  assert.deepEqual(sourceScheduleCompletionBases(second),analyzeSchedule(second).completionBases);
});
