import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNearCriticalProjection} from '../packages/near-critical-analysis/src';
import {calendarWorkingDayHours,sourceFloatCriticality,sourceFloatInFloatRiskWatchlist,activityNearCriticalThresholdHours} from '../packages/schedule-analysis-core/src';

test('T11 shared near-critical producer retains original every-row float decisions and boundary evidence',()=>{
 const model:any={
  projectId:'CALENDAR-SCALE',source:'xer',sourceRevisionId:'SOURCE-REV',
  dataDateIso:'2031-01-31',
  calendars:[
   {calendarId:'DAY',standardDayHours:8,semanticComplete:true,sourceRefs:[]},
   {calendarId:'DAY',standardDayHours:24,semanticComplete:true,sourceRefs:[]},
   {calendarId:'SHIFT',standardDayHours:10,semanticComplete:true,sourceRefs:[]},
   {calendarId:'UNRESOLVED',standardDayHours:24,semanticComplete:false,sourceRefs:[]},
  ],wbs:[{wbsId:'W',name:'Work package',parentWbsId:null,sourceRefs:[]}],
  relationships:[],diagnostics:[],
  activities:Array.from({length:6300},(_,i)=>({
    projectId:'CALENDAR-SCALE',activityId:'ACT-'+i,nativeId:String(i),
    name:'Task '+i,activityType:'task',wbsId:'W',
    calendarId:['DAY','SHIFT','ABSENT','UNRESOLVED',null][i%5],
    status:i%23===0?'completed':'in_progress',
    totalFloatHours:i%29===0?null:i%7===0?0:i%3===0?-8:(i%21)*8,
    currentFinishIso:'2031-06-01',baselineFinishIso:'2031-05-31',percentComplete:0,
    forecastFinishIso:null,actualFinishIso:null,sourceRefs:[],diagnostics:[],
  })),
 };
 const config:any={criticalFloatThresholdHours:0,nearCriticalWorkingDays:5,
    nearCriticalFloatThresholdHours:40,floatRiskWatchlistIncludesCriticalThreshold:true};
 const before=JSON.stringify(model);
 const result=buildNearCriticalProjection(model,{
  generatedAt:'2031-02-01T00:00:00Z',producerVersion:'test-source-parity',config,
 });
 const unfinished=model.activities.filter((a:any)=>a.status!=='completed');
 const known=unfinished.filter((a:any)=>a.totalFloatHours!==null);
 const expectedNear=known.filter((a:any)=>activityNearCriticalThresholdHours(model,a,config)!==null
    &&sourceFloatCriticality(model,a,config)==='near_critical').map((a:any)=>a.activityId);
 const expectedWatch=known.filter((a:any)=>activityNearCriticalThresholdHours(model,a,config)!==null
    &&sourceFloatInFloatRiskWatchlist(model,a,config)===true).map((a:any)=>a.activityId);
 const expectedCritical=known.filter((a:any)=>sourceFloatCriticality(model,a,config)==='critical')
    .map((a:any)=>a.activityId);
 const expectedNegative=known.filter((a:any)=>a.totalFloatHours<0).map((a:any)=>a.activityId);
 const sorted=(ids:string[])=>ids.sort();
 assert.deepEqual(sorted(result.rows.map(r=>r.activityId)),sorted(expectedNear));
 assert.deepEqual(sorted(result.watchlistRows.map(r=>r.activityId)),sorted(expectedWatch));
 assert.deepEqual(sorted(result.criticalRows.map(r=>r.activityId)),sorted(expectedCritical));
 assert.deepEqual(sorted(result.negativeFloatRows.map(r=>r.activityId)),sorted(expectedNegative));
 assert.equal(result.population?.denominator,unfinished.length,'full source denominator retained');
 assert.equal(result.unknownFloatCount,unfinished.length-known.length);
 assert.equal(result.nearCriticalCount,null,'unknown calendar/float withholds full-count conclusion');
 assert.equal(result.floatRiskWatchlistCount,null);
 const samples=[
   ...result.boundaryAudit.criticalBoundary.below,
   ...result.boundaryAudit.criticalBoundary.at,
   ...result.boundaryAudit.criticalBoundary.above,
   ...result.boundaryAudit.nearCriticalUpperBoundary.inside,
   ...result.boundaryAudit.nearCriticalUpperBoundary.outside,
 ];
 assert.ok(samples.length>0);
 const byId=new Map(known.map((a:any)=>[a.activityId,a]));
 for(const sample of samples){
  const a:any=byId.get(sample.activityId);
  assert.ok(a);
  assert.equal(sample.criticality,sourceFloatCriticality(model,a,config));
  assert.equal(sample.floatRiskWatchlist,sourceFloatInFloatRiskWatchlist(model,a,config));
  const calendar=model.calendars.find((c:any)=>c.calendarId===a.calendarId);
  const hours=a.calendarId===null?null:calendarWorkingDayHours(calendar);
  assert.equal(sample.calendarWorkingDayHours,hours);
  assert.equal(sample.nearCriticalThresholdHours,activityNearCriticalThresholdHours(model,a,config));
 }
 assert.equal(JSON.stringify(model),before,'source rows, duplicate calendar identities and decisions preserved');
});
