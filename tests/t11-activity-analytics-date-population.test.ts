import test from 'node:test';
import assert from 'node:assert/strict';
import {buildActivityAnalyticsProjection} from '../packages/activity-analytics/src/projector';

const expectedVariance=(baseline:string|null,finish:string|null):number|null=>{
  if(!baseline||!finish)return null;
  const a=Date.parse(baseline),b=Date.parse(finish);
  return Number.isFinite(a)&&Number.isFinite(b)?Number(((b-a)/86400000).toFixed(6)):null;
};

test('T11 source-scoped parsing keeps every activity, nulls, completed actual finishes and dated update independent',()=>{
 const baseline=['2031-01-01','2031-01-15',null,'invalid-date'];
 const forecast=['2031-02-01','2031-02-15','2031-03-01',null,'invalid-date'];
 const row=(i:number)=>({
   projectId:'DATE-PARITY-A',activityId:'ACT-'+i,nativeId:String(i),name:'Work '+i,
   wbsId:'W',calendarId:'C',activityType:'task' as const,
   status:i%27===0?'completed' as const:'in_progress' as const,
   baselineStartIso:'2031-01-01',baselineFinishIso:baseline[i%baseline.length],
   currentStartIso:'2031-01-01',currentFinishIso:forecast[i%forecast.length],
   forecastStartIso:null,forecastFinishIso:null,
   actualStartIso:null,actualFinishIso:i%27===0?'2031-02-20':null,
   totalFloatHours:i%11,freeFloatHours:null,originalDurationHours:8,
   remainingDurationHours:8,percentComplete:0,sourceRefs:[],diagnostics:[]
 });
 const model:any={
   projectId:'DATE-PARITY-A',source:'xer',sourceRevisionId:'SOURCE-1',
   dataDateIso:'2031-02-01',activities:Array.from({length:8200},(_,i)=>row(i)),
   relationships:[],wbs:[{wbsId:'W',name:'WBS',parentWbsId:null,sourceRefs:[]}],
   calendars:[{calendarId:'C',semanticComplete:true,standardDayHours:8,sourceRefs:[]}],
   diagnostics:[]
 };
 const prior=JSON.stringify(model);
 const observed=buildActivityAnalyticsProjection(model,{generatedAt:'2031-02-01T00:00:00Z',producerVersion:'reference'});
 assert.equal(observed.activityCount,8200);
 assert.equal(observed.rows.length,8200);
 for(let i=0;i<model.activities.length;i++){
   const activity=model.activities[i],presented=observed.rows[i]!;
   const finish=activity.status==='completed'&&activity.actualFinishIso?activity.actualFinishIso:activity.forecastFinishIso??activity.currentFinishIso;
   assert.equal(presented.activityId,activity.activityId);
   assert.equal(presented.finishVarianceDays,expectedVariance(activity.baselineFinishIso,finish),'original source pair: '+activity.activityId);
 }
 assert.equal(JSON.stringify(model),prior,'producer must not alter uploaded source records');
 const updated={...model,sourceRevisionId:'SOURCE-2',activities:model.activities.map((a:any,i:number)=>({...a,
   currentFinishIso:i%27===0?a.currentFinishIso:'2031-04-01',
   actualFinishIso:i%27===0?a.actualFinishIso:null}))};
 const second=buildActivityAnalyticsProjection(updated,{generatedAt:'2031-03-01T00:00:00Z',producerVersion:'reference'});
 assert.equal(second.rows[1]?.finishVarianceDays,expectedVariance(updated.activities[1].baselineFinishIso,'2031-04-01'));
 assert.equal(observed.rows[1]?.finishVarianceDays,expectedVariance(model.activities[1].baselineFinishIso,model.activities[1].currentFinishIso),'old revision must not be affected');
 assert.equal(second.rows.length,observed.rows.length,'no source rows dropped');
});
