import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSchedule,sourceScheduleCompletionBases} from '../packages/schedule-analysis-core/src';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

test('T11 schedule analysis reuses source dates without losing any original variance, milestone or source basis',()=>{
  const iso=(day:number)=>'2031-01-'+String(1+day%28).padStart(2,'0');
  const types=['task','start_milestone','finish_milestone','wbs_summary','level_of_effort'];
  const acts=Array.from({length:8600},(_,i)=>({
    projectId:'ANALYTICS-TRUTH',activityId:'ACT-'+i,nativeId:String(i),name:'Trade '+i,
    activityType:(i%21===0?types[i%types.length]:'task'),
    wbsId:'W',calendarId:'C',status:i%31===0?'completed':i%13===0?'in_progress':'not_started',
    originalDurationHours:8,remainingDurationHours:8,percentComplete:i%31===0?100:0,
    totalFloatHours:i%9===0?null:i%17===0?-8:8,freeFloatHours:null,
    baselineStartIso:'2031-01-01',
    baselineFinishIso:i%37===0?null:i%41===0?'invalid-date':iso(i+2),
    currentStartIso:'2031-01-01',currentFinishIso:i%33===0?null:iso(i+5),
    forecastStartIso:null,forecastFinishIso:i%29===0?'2031-02-25':null,
    actualStartIso:null,actualFinishIso:i%31===0?'2031-02-13':null,
    sourceRefs:[],diagnostics:[]
  }));
  const model:any={projectId:'ANALYTICS-TRUTH',source:'xer',sourceRevisionId:'REV-A',
    dataDateIso:'2031-01-10',activities:acts,relationships:[],
    wbs:[{wbsId:'W',name:'Project WBS',parentWbsId:null,sourceRefs:[]}],
    calendars:[{...ELAPSED_24H_CALENDAR,calendarId:'C'}],diagnostics:[]};
  const before=JSON.stringify(model);
  const expected=acts.filter(a=>a.activityType!=='wbs_summary'&&a.activityType!=='level_of_effort');
  const metric=(a:any)=>{
    const finish=a.status==='completed'&&a.actualFinishIso?a.actualFinishIso:a.forecastFinishIso??a.currentFinishIso;
    const start=a.baselineFinishIso?Date.parse(a.baselineFinishIso):NaN;
    const end=finish?Date.parse(finish):NaN;
    return Number.isFinite(start)&&Number.isFinite(end)?(end-start)/86400000:null;
  };
  const values=expected.map(metric).filter((n):n is number=>n!==null);
  const first=analyzeSchedule(model);
  assert.equal(first.finishVariance.comparableActivities,values.length);
  assert.equal(first.finishVariance.unknownActivities,expected.length-values.length);
  assert.equal(first.finishVariance.averageFinishVarianceDays,
    values.length?Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(6)):null);
  assert.equal(first.finishVariance.maximumDelayDays,values.length?Number(Math.max(...values).toFixed(6)):null);
  assert.deepEqual(first.completionBases,sourceScheduleCompletionBases(model));
  const revised={...model,sourceRevisionId:'REV-B',activities:acts.map((a,i)=>({...a,
    currentFinishIso:i%31===0?a.currentFinishIso:'2031-06-20',
    forecastFinishIso:i%31===0?a.forecastFinishIso:null}))};
  const second=analyzeSchedule(revised);
  assert.deepEqual(second.completionBases,sourceScheduleCompletionBases(revised));
  assert.notEqual(first.completionBases[1]?.dateIso,second.completionBases[1]?.dateIso);
  assert.deepEqual(first.completionBases,sourceScheduleCompletionBases(model),'source A cannot reuse source B dates');
  assert.equal(JSON.stringify(model),before,'no source rows, dates or calendars altered by analytics');
});
