import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {nearCriticalScreening} from '../packages/runtime-api/src/near-critical-screening';
import {projectScheduleControlBasis} from '../packages/runtime-api/src/schedule-control-basis';
import {activityNearCriticalThresholdHours,sourceFloatCriticality,sourceFloatInFloatRiskWatchlist,calendarWorkingDayHours} from '../packages/schedule-analysis-core/src';

test('T11 SW-54 indexed calendar lookup matches original scalar float screening and complete source population',t=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-indexed-calendar-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false});
 const make=(id:string,firstHours:number)=>{
  const state=store.getOrCreate(id);
  const calendars=[
   {calendarId:'C',semanticComplete:true,standardDayHours:firstHours},
   {calendarId:'C',semanticComplete:true,standardDayHours:2},
   {calendarId:'SHIFT',semanticComplete:true,standardDayHours:10},
   {calendarId:'INCOMPLETE',semanticComplete:false,standardDayHours:24},
  ];
  const activities=Array.from({length:5200},(_,i)=>({
   projectId:id,activityId:'ACT-'+i,nativeId:String(i),name:'Work '+i,
   wbsId:'W',calendarId:['C','SHIFT','UNKNOWN','INCOMPLETE',null][i%5],
   activityType:'task',status:i%31===0?'completed':'in_progress',
   totalFloatHours:i%17===0?null:i%7===0?0:i%3===0?-8:8+(i%15)*8,
   freeFloatHours:null,percentComplete:0,originalDurationHours:8,remainingDurationHours:8,
   currentStartIso:'2031-01-01',currentFinishIso:'2031-06-01',
   baselineStartIso:'2031-01-01',baselineFinishIso:'2031-06-01',
   actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
   sourceRefs:[],diagnostics:[],
  }));
  const model:any={projectId:id,source:'xer',sourceRevisionId:'REV-'+id,
   dataDateIso:'2031-02-01',activities,calendars,
   wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],relationships:[],diagnostics:[]};
  state.schedules.push({role:'update',format:'xer',sourceFilename:'current.xer',
   sourceHashSha256:'source-'+id,uploadedAt:'2031-02-01',
   revision:{revisionId:model.sourceRevisionId,label:'Source',sequence:1,effectiveAt:'2031-02-01',model}});
  store.touch(state);
  return {state,model};
 };
 for(const [id,hrs] of [['FLOAT-A',8],['FLOAT-B',12]] as const){
  const {state,model}=make(id,hrs);
  const original=JSON.stringify(model);
  const cfg=projectScheduleControlBasis(state).analysisConfig;
  const calendarById=new Map<string,any>();
  for(const c of model.calendars)if(!calendarById.has(c.calendarId))calendarById.set(c.calendarId,c);
  const activities=model.activities.filter((a:any)=>a.status!=='completed');
  let unresolved=0,near=0,watched=0,unknownDays=0;
  const distribution=new Map<number,number>();
  for(const a of activities){
   const classified=sourceFloatCriticality(model,a,cfg);
   const watch=sourceFloatInFloatRiskWatchlist(model,a,cfg);
   assert.equal(sourceFloatCriticality(model,a,cfg,calendarById),classified);
   assert.equal(sourceFloatInFloatRiskWatchlist(model,a,cfg,calendarById),watch);
   assert.equal(activityNearCriticalThresholdHours(model,a,cfg,calendarById),activityNearCriticalThresholdHours(model,a,cfg));
   if(classified==='unknown'||watch===null)unresolved++;
   if(classified==='near_critical')near++;
   if(watch===true)watched++;
   const hours=calendarWorkingDayHours(model.calendars.find((c:any)=>c.calendarId===a.calendarId));
   if(a.totalFloatHours===null||hours===null){unknownDays++;continue;}
   const days=Math.round(a.totalFloatHours/hours*1e6)/1e6;
   distribution.set(days,(distribution.get(days)??0)+1);
  }
  const value=nearCriticalScreening(state);
  assert.ok(value);
  assert.equal(value.populationCount,activities.length);
  assert.equal(value.unresolvedActivityCount,unresolved);
  assert.equal(value.nearCriticalCount,unresolved?null:near);
  assert.equal(value.watchlistCount,unresolved?null:watched);
  assert.equal(value.distributionUnresolvedCount,unknownDays);
  assert.deepEqual(value.floatDistribution,[...distribution].sort((a,b)=>a[0]-b[0]).map(([workingDays,count])=>({workingDays,count})));
  assert.equal(JSON.stringify(model),original,'original source and duplicates remain unchanged');
  assert.strictEqual(nearCriticalScreening(state),value,'same-version evaluation reused');
  store.touch(state);
  assert.notStrictEqual(nearCriticalScreening(state),value,'new version invalidates evaluation');
 }
});
