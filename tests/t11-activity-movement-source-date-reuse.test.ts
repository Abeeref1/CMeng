import test from 'node:test';
import assert from 'node:assert/strict';
import {activityMovementAnalysis} from '../packages/activity-analytics/src/movement';
import type {ActivityAnalyticsRow} from '../packages/activity-analytics/src/types';

const independentDifference=(after:string|null,before:string|null)=>{
  if(!after||!before)return null;
  const a=Date.parse(after),b=Date.parse(before);
  return Number.isFinite(a)&&Number.isFinite(b)?Number(((a-b)/86400000).toFixed(6)):null;
};
const finish=(r:ActivityAnalyticsRow)=>r.status==='completed'&&r.actualFinishIso?r.actualFinishIso:r.forecastFinishIso??r.currentFinishIso;

test('T11 full-population movement caches repeated original source date parsing without changing a single answer',()=>{
  const currentDates=['2031-06-01','2031-06-07','2031-06-15','2031-06-21',null,'not-a-valid-date'];
  const baselineDates=['2031-05-01','2031-05-15',null,'not-a-valid-date'];
  const previousDates=['2031-05-19','2031-05-31','2031-06-02',null,'invalid'];
  const rows=Array.from({length:7500},(_,i)=>({
    activityId:'SOURCE-'+i,activityType:'task' as const,name:'Construction activity '+i,
    wbsId:'ZONE-'+Math.floor(i/100),status:i%41===0?'completed' as const:'in_progress' as const,
    currentFinishIso:currentDates[i%currentDates.length]??null,
    forecastFinishIso:null,actualFinishIso:i%41===0?'2031-06-23':null,
    baselineFinishIso:baselineDates[i%baselineDates.length]??null,
    finishVarianceDays:i%89===0?null:independentDifference(i%41===0?'2031-06-23':currentDates[i%currentDates.length]??null,baselineDates[i%baselineDates.length]??null),
  })) as ActivityAnalyticsRow[];
  const previousRows=rows.map((row,i)=>({...row,currentFinishIso:previousDates[i%previousDates.length]??null,forecastFinishIso:null,actualFinishIso:null,status:'not_started' as const}));
  const input={dataDateIso:'2031-04-01',currentRevisionId:'SOURCE-U2',currentLabel:'Second source update',
    baselineRevisionId:'SOURCE-B0',baselineLabel:'Controlled original',
    previousRevisionId:'SOURCE-U1',previousLabel:'Previous reported update',previousRows};
  const before=JSON.stringify({rows,previousRows});
  const actual=activityMovementAnalysis(rows,input);
  const expected=rows.filter(row=>row.finishVarianceDays!==null&&independentDifference(finish(row),row.baselineFinishIso)!==null);
  const maximum=Math.max(...expected.map(row=>row.finishVarianceDays!));
  const expectedMax=expected.filter(row=>row.finishVarianceDays===maximum);
  assert.equal(actual.population.sourceCount,rows.length);
  assert.equal(actual.population.denominator,expected.length);
  assert.equal(actual.distribution.maximum,maximum);
  assert.equal(actual.maximumRows.length,expectedMax.length);
  const prev=new Map(previousRows.map(row=>[row.activityId,row]));
  for(let i=0;i<expectedMax.length;i++){
    const current=expectedMax[i]!,shown=actual.maximumRows[i]!,old=prev.get(current.activityId)!;
    assert.equal(shown.activityId,current.activityId);
    assert.equal(shown.baselineMovementDays,independentDifference(finish(current),current.baselineFinishIso));
    assert.equal(shown.previousMovementDays,independentDifference(finish(current),finish(old)));
    assert.equal(shown.priorBaselineMovementDays,independentDifference(finish(old),current.baselineFinishIso));
    assert.equal(shown.sourcePairVerified,shown.baselineMovementDays===current.finishVarianceDays);
  }
  assert.equal(actual.sourcePairVerifiedCount,actual.maximumRows.filter(r=>r.sourcePairVerified).length);
  assert.equal(actual.population.exclusions.length,rows.length-expected.length);
  assert.equal(JSON.stringify({rows,previousRows}),before,'no original source facts can change during rendering');
});

test('T11 different projects and dated updates cannot reuse stale parsed source dates',()=>{
 const row=(when:string)=>({activityId:'ONE',name:'Same code',activityType:'task' as const,wbsId:'A',
  status:'not_started' as const,forecastFinishIso:null,currentFinishIso:when,actualFinishIso:null,
  baselineFinishIso:'2031-01-01',finishVarianceDays:independentDifference(when,'2031-01-01')}) as ActivityAnalyticsRow;
 const input={dataDateIso:'2031-01-01',currentRevisionId:'SCHEDULE-1',currentLabel:'Current',
  baselineRevisionId:'BASE',baselineLabel:'Baseline',previousRevisionId:null,previousLabel:null};
 const first=activityMovementAnalysis([row('2031-01-02')],input);
 const second=activityMovementAnalysis([row('2031-02-02')],{...input,currentRevisionId:'SCHEDULE-2'});
 assert.equal(first.maximumRows[0]?.baselineMovementDays,1);
 assert.equal(second.maximumRows[0]?.baselineMovementDays,32);
 assert.equal(first.maximumRows[0]?.baselineMovementDays,1);
});
