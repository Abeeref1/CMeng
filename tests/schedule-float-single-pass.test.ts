import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSchedule,DEFAULT_SCHEDULE_ANALYSIS_CONFIG,activityNearCriticalThresholdHours,
  sourceFloatCriticality,sourceFloatInFloatRiskWatchlist,
  nearCriticalThresholdBasis,
} from '../packages/schedule-analysis-core/src';
import type {CanonicalScheduleModel,ScheduleAnalysisConfig} from '../packages/schedule-analysis-core/src';

const coverage=(known:number,total:number)=>total===0?null:Number((100*known/total).toFixed(4));
/** Frozen reference behavior from the original separate population scans.
 * Independent of the optimized one-pass accumulator. */
function reference(model:CanonicalScheduleModel,config:ScheduleAnalysisConfig){
 const unfinished=model.activities.filter(a=>a.activityType!=='level_of_effort'&&a.activityType!=='wbs_summary'&&a.status!=='completed');
 const known=unfinished.filter(a=>a.totalFloatHours!==null);
 const count=(predicate:(a:typeof known[number])=>boolean)=>known.filter(predicate).length;
 const unresolved=count(a=>activityNearCriticalThresholdHours(model,a,config)===null);
 const complete=known.length===unfinished.length;
 return {
  criticalCount:complete?count(a=>sourceFloatCriticality(model,a,config)==='critical'):null,
  knownClassifications:{
    critical:count(a=>sourceFloatCriticality(model,a,config)==='critical'),
    nearCritical:count(a=>sourceFloatCriticality(model,a,config)==='near_critical'),
    noncritical:count(a=>sourceFloatCriticality(model,a,config)==='noncritical'),
    unknown:unfinished.filter(a=>sourceFloatCriticality(model,a,config)==='unknown').length,
  },
  nearCriticalCount:complete&&unresolved===0?count(a=>sourceFloatCriticality(model,a,config)==='near_critical'):null,
  floatRiskWatchlistCount:complete&&unresolved===0?count(a=>sourceFloatInFloatRiskWatchlist(model,a,config)===true):null,
  zeroFloatCount:complete?count(a=>a.totalFloatHours===0):null,
  negativeFloatCount:complete?count(a=>a.totalFloatHours!<0):null,
  positiveFloatCount:complete?count(a=>a.totalFloatHours!>0):null,
  unknownFloatCount:unfinished.length-known.length,
  knownFloatCount:known.length,
  totalActivities:unfinished.length,
  coveragePercent:coverage(known.length,unfinished.length),
  criticalThresholdHours:config.criticalFloatThresholdHours,
  nearCriticalThresholdHours:config.nearCriticalWorkingDays!==undefined&&config.nearCriticalWorkingDays!==null?null:config.nearCriticalFloatThresholdHours,
  nearCriticalWorkingDays:config.nearCriticalWorkingDays??null,
  nearCriticalThresholdBasis:nearCriticalThresholdBasis(config),
  floatRiskWatchlistIncludesCriticalThreshold:config.floatRiskWatchlistIncludesCriticalThreshold===true,
  nearCriticalThresholdUnresolvedCount:unresolved,
 };
}
function fixture(){
 const activities=Array.from({length:144},(_,i)=>{
  const types=['task','task','task','wbs_summary','level_of_effort','finish_milestone'] as const;
  const status=(i%9===0?'completed':i%7===0?'unknown':'in_progress') as 'completed'|'unknown'|'in_progress';
  return {projectId:'FLOAT-BASIS',activityId:'A'+i,nativeId:String(i),name:'Task '+i,wbsId:'W',
    calendarId:i%11===0?null:i%3===0?'C-BAD':i%5===0?'MISSING':'C-GOOD',
    activityType:types[i%types.length],status,
    baselineStartIso:'2026-01-01',baselineFinishIso:'2026-02-01',
    currentStartIso:'2026-01-01',currentFinishIso:'2026-02-01',
    actualStartIso:null,actualFinishIso:status==='completed'?'2026-01-25':null,
    forecastStartIso:null,forecastFinishIso:null,originalDurationHours:40,remainingDurationHours:16,
    totalFloatHours:i%13===0?null:[-24,-1,0,0.1,8,40,80][i%7],freeFloatHours:null,
    percentComplete:status==='completed'?100:50,sourceRefs:[],diagnostics:[],
  };
 });
 const model:CanonicalScheduleModel={projectId:'FLOAT-BASIS',source:'xer',sourceRevisionId:'REV-0',
   dataDateIso:'2026-01-16',activities:activities as CanonicalScheduleModel['activities'],relationships:[],
   wbs:[{wbsId:'W',name:'Works',parentWbsId:null,sourceRefs:[]}],
   calendars:[
    {calendarId:'C-GOOD',name:'Six days',semanticComplete:true,standardDayHours:10,sourceRefs:[]},
    {calendarId:'C-BAD',name:'Unknown',semanticComplete:false,standardDayHours:null,sourceRefs:[]},
   ],diagnostics:[]};
 return model;
}
test('T11 streaming float populations equal the original full-scan source classification for every authority state',()=>{
 const model=fixture(),bytes=JSON.stringify(model);
 const configs:ScheduleAnalysisConfig[]=[
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:2},
  {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:5,floatRiskWatchlistIncludesCriticalThreshold:true},
  {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:null,floatRiskWatchlistIncludesCriticalThreshold:true},
  {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:-1},
 ];
 for(const config of configs){
  assert.deepEqual(analyzeSchedule(model,config).float,reference(model,config),'original float result must be byte-for-byte semantically preserved: '+JSON.stringify(config));
 }
 assert.equal(JSON.stringify(model),bytes,'calculation must preserve the actual submitted schedule');
});
test('empty and fully-known populations preserve real zero vs unknown distinctions',()=>{
 const model=fixture();
 assert.deepEqual(analyzeSchedule({...model,activities:[]}).float,reference({...model,activities:[]},DEFAULT_SCHEDULE_ANALYSIS_CONFIG));
 const complete={...model,activities:model.activities.filter(a=>a.activityType==='task').map(a=>({...a,totalFloatHours:0,calendarId:'C-GOOD' as string}))};
 const config={...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:2};
 assert.deepEqual(analyzeSchedule(complete,config).float,reference(complete,config));
});
