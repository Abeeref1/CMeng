import test from 'node:test';
import assert from 'node:assert/strict';
import type {CanonicalScheduleModel, CanonicalScheduleActivity} from '../packages/schedule-analysis-core/src';
import type {ScheduleRevision} from '../packages/schedule-revision-core/src';
import {buildVarianceTrendsProjection} from '../packages/variance-trends/src';

const makeModel=(revisionId:string,activities:CanonicalScheduleActivity[]):CanonicalScheduleModel=>({
 projectId:'SOURCE-BASED-T11',source:'schedule_xlsx',sourceRevisionId:revisionId,
 dataDateIso:revisionId==='CONTROLLED'?'2031-01-01':'2031-02-01',
 activities,relationships:[],wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],
 calendars:[],diagnostics:[],
});
const makeActivity=(id:string,finish:string|null,float:number|null=0):CanonicalScheduleActivity=>({
 projectId:'SOURCE-BASED-T11',activityId:id,nativeId:id,name:id,wbsId:'W',
 calendarId:null,activityType:'task',status:'not_started',
 baselineStartIso:'2031-01-01',baselineFinishIso:'2031-01-20',
 currentStartIso:'2031-01-01',currentFinishIso:finish,
 actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
 originalDurationHours:16,remainingDurationHours:16,totalFloatHours:float,
 freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[],
});

test('T11 controlled variance preserves complete source rows, independent totals and unknown dates after single-pass calculation',()=>{
 const controlled=Array.from({length:8500},(_,i)=>makeActivity('SRC-'+i,'2031-01-20',i%5===0?null:i%3));
 const actual=controlled.map((a,i)=>({...a,currentFinishIso:
  i%13===0?null:i%3===0?'2031-01-23':i%3===1?'2031-01-17':'2031-01-20'}));
 // New scope has no adopted baseline identity. It must not become a zero variance.
 actual.push(makeActivity('NEW-UNMATCHED','2031-02-07'));
 const revisions:ScheduleRevision[]=[
  {revisionId:'CONTROLLED',label:'Contractor baseline',sequence:1,effectiveAt:'2031-01-01',model:makeModel('CONTROLLED',controlled)},
  {revisionId:'UPDATE',label:'Current',sequence:2,effectiveAt:'2031-02-01',model:makeModel('UPDATE',actual)},
 ];
 const source=JSON.stringify(revisions);
 const result=buildVarianceTrendsProjection(revisions,{
  generatedAt:'2031-02-01T00:00:00.000Z',
  producerVersion:'full-source-t11-independent',
  controlledBaselineRevision:revisions[0]!,
 });
 const current=result.points[1]!;
 const values=actual.slice(0,-1).map(a=>{
  if(a.currentFinishIso===null)return null;
  const changed=Date.parse(a.currentFinishIso+'T00:00:00Z');
  return (changed-Date.parse('2031-01-20T00:00:00Z'))/86400000;
 }).filter((n):n is number=>n!==null);
 assert.equal(current.sourceActivityCount,8501);
 assert.equal(current.comparableActivities,values.length);
 assert.equal(current.unmatchedActivityCount,8501-values.length);
 assert.equal(current.lateActivityCount,values.filter(n=>n>0).length);
 assert.equal(current.earlyActivityCount,values.filter(n=>n<0).length);
 assert.equal(current.onTimeActivityCount,values.filter(n=>n===0).length);
 assert.equal(current.averageFinishVarianceDays,Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(6)));
 assert.equal(current.maximumDelayDays,3);
 assert.equal(result.activityTrends.find(x=>x.activityId==='NEW-UNMATCHED')!.points.at(-1)!.finishVarianceDays,null);
 assert.equal(JSON.stringify(revisions),source,'original source/authority cannot be mutated');
});

test('T11 original most recent source finish is retained across duplicates, invalid dates and source-order ties',()=>{
 const controlled=[
  makeActivity('A','2031-02-01'),
  makeActivity('B',null),
  makeActivity('C','2031-03-01'),
  makeActivity('D','not a date'),
  makeActivity('E','2031-03-01T00:00:00Z'),
 ];
 for(const row of controlled)row.baselineFinishIso=row.currentFinishIso;
 const actual=controlled.map(x=>({...x,currentFinishIso:'2031-03-04',baselineFinishIso:x.baselineFinishIso}));
 const base:ScheduleRevision={revisionId:'CONTROLLED',label:'Source baseline',sequence:1,effectiveAt:'2031-01-01',model:makeModel('CONTROLLED',controlled)};
 const updated:ScheduleRevision={revisionId:'UPDATE',label:'Update',sequence:2,effectiveAt:'2031-02-01',model:makeModel('UPDATE',actual)};
 const oldMax=controlled.map(a=>a.baselineFinishIso??a.currentFinishIso)
  .filter((v):v is string=>v!==null&&Number.isFinite(Date.parse(v)))
  .sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);
 assert.equal(oldMax,'2031-03-01T00:00:00Z','frozen old sort uses last source record on tied instant');
 const result=buildVarianceTrendsProjection([base,updated],{
  generatedAt:'2031-02-01T00:00:00Z',producerVersion:'source-tie-parity',
  controlledBaselineRevision:base,
 });
 assert.equal(result.points[1]?.projectCompletionVarianceDays,3);
 assert.equal(result.activityTrends.find(x=>x.activityId==='B')?.points.at(-1)?.finishVarianceDays,null);
 assert.equal(result.activityTrends.find(x=>x.activityId==='D')?.points.at(-1)?.finishVarianceDays,null);
});
