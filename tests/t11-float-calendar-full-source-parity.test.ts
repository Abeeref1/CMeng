import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSchedule,DEFAULT_SCHEDULE_ANALYSIS_CONFIG,activityNearCriticalThresholdHours,
  sourceFloatCriticality,sourceFloatInFloatRiskWatchlist,nearCriticalThresholdBasis,
} from '../packages/schedule-analysis-core/src';
import type {CanonicalScheduleModel,ScheduleAnalysisConfig} from '../packages/schedule-analysis-core/src';
import {buildActivityAnalyticsProjection} from '../packages/activity-analytics/src/projector';

// Independent original-scalar oracle. Does not consume CMeng's optimized
// streaming counts, cached calendar map or its activity-analytics results.
const coverage=(known:number,total:number)=>total?Number((100*known/total).toFixed(4)):null;
function scalarSourceFloat(model:CanonicalScheduleModel,config:ScheduleAnalysisConfig){
 const open=model.activities.filter(a=>a.activityType!=='wbs_summary'&&a.activityType!=='level_of_effort'&&a.status!=='completed');
 const known=open.filter(a=>a.totalFloatHours!==null);
 const count=(fn:(a:typeof known[number])=>boolean)=>known.filter(fn).length;
 const unresolved=count(a=>activityNearCriticalThresholdHours(model,a,config)===null);
 const allKnown=known.length===open.length;
 const nearKnown=allKnown&&unresolved===0;
 return {
  criticalCount:allKnown?count(a=>sourceFloatCriticality(model,a,config)==='critical'):null,
  knownClassifications:{
   critical:count(a=>sourceFloatCriticality(model,a,config)==='critical'),
   nearCritical:count(a=>sourceFloatCriticality(model,a,config)==='near_critical'),
   noncritical:count(a=>sourceFloatCriticality(model,a,config)==='noncritical'),
   unknown:open.filter(a=>sourceFloatCriticality(model,a,config)==='unknown').length,
  },
  nearCriticalCount:nearKnown?count(a=>sourceFloatCriticality(model,a,config)==='near_critical'):null,
  floatRiskWatchlistCount:nearKnown?count(a=>sourceFloatInFloatRiskWatchlist(model,a,config)===true):null,
  zeroFloatCount:allKnown?count(a=>a.totalFloatHours===0):null,
  negativeFloatCount:allKnown?count(a=>a.totalFloatHours!<0):null,
  positiveFloatCount:allKnown?count(a=>a.totalFloatHours!>0):null,
  unknownFloatCount:open.length-known.length,
  knownFloatCount:known.length,totalActivities:open.length,
  coveragePercent:coverage(known.length,open.length),
  criticalThresholdHours:config.criticalFloatThresholdHours,
  nearCriticalThresholdHours:config.nearCriticalWorkingDays!=null?null:config.nearCriticalFloatThresholdHours,
  nearCriticalWorkingDays:config.nearCriticalWorkingDays??null,
  nearCriticalThresholdBasis:nearCriticalThresholdBasis(config),
  floatRiskWatchlistIncludesCriticalThreshold:config.floatRiskWatchlistIncludesCriticalThreshold===true,
  nearCriticalThresholdUnresolvedCount:unresolved,
 };
}
function source(projectId:string,firstHours:number,size:number):CanonicalScheduleModel {
 const calendarIds:(string|null)[]=['C','SHIFT','MISSING','INCOMPLETE',null];
 const activityTypes=['task','start_milestone','wbs_summary','level_of_effort','finish_milestone'] as const;
 return {projectId,source:'xer',sourceRevisionId:'SUBMITTED-'+firstHours,
  dataDateIso:'2031-04-01',
  activities:Array.from({length:size},(_,i)=>({
   projectId,activityId:'ACT-'+i,nativeId:String(i),name:'Work '+i,wbsId:'W',
   calendarId:calendarIds[i%calendarIds.length]!,
   activityType:activityTypes[i%activityTypes.length]!,
   status:(i%31===0?'completed':i%43===0?'unknown':'in_progress') as 'completed'|'unknown'|'in_progress',
   baselineStartIso:i%41===0?null:'2031-01-01',baselineFinishIso:'2031-07-01',
   currentStartIso:'2031-01-01',currentFinishIso:i%17===0?null:'2031-07-01',
   actualStartIso:null,actualFinishIso:i%31===0?'2031-03-15':null,
   forecastStartIso:null,forecastFinishIso:null,
   percentComplete:i%31===0?100:12,originalDurationHours:80,remainingDurationHours:70,
   totalFloatHours:i%29===0?null:[-24,-1,0,8,16,24,32,40,64][i%9]!,
   freeFloatHours:null,sourceRefs:[],diagnostics:[],
  })),
  relationships:[],wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],
  calendars:[
   {calendarId:'C',name:'Original first',semanticComplete:true,standardDayHours:firstHours,sourceRefs:[]},
   {calendarId:'C',name:'Duplicate must not supersede first',semanticComplete:true,standardDayHours:12,sourceRefs:[]},
   {calendarId:'SHIFT',name:'Ten hours',semanticComplete:true,standardDayHours:10,sourceRefs:[]},
   {calendarId:'INCOMPLETE',name:'Unread calendar',semanticComplete:false,standardDayHours:null,sourceRefs:[]},
  ],diagnostics:[]};
}
test('T11 SW-54 and T06 calendar/source float counts retain original complete scalar results across independent projects',()=>{
 const configs:ScheduleAnalysisConfig[]=[
  {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:3},
  {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:3,floatRiskWatchlistIncludesCriticalThreshold:true},
  {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:null},
  {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:-1},
 ];
 for(const [id,hours] of [['A',8],['B',11]] as const){
  const model=source(id,hours,6501);
  const original=JSON.stringify(model);
  for(const config of configs){
   const result=analyzeSchedule(model,config);
   assert.deepEqual(result.float,scalarSourceFloat(model,config),
    'independent unindexed source float and all unknown/count states: '+id+'/'+String(config.nearCriticalWorkingDays));
   const analytics=buildActivityAnalyticsProjection(model,{
    generatedAt:'2031-04-01T00:00:00Z',producerVersion:'source-parity',config,
   });
   assert.equal(analytics.rows.length,model.activities.length,'all original source records including excluded types');
   for(let i=0;i<model.activities.length;i++){
    const activity=model.activities[i]!,row=analytics.rows[i]!;
    assert.equal(row.activityId,activity.activityId);
    assert.equal(row.criticality,sourceFloatCriticality(model,activity,config),'first-match calendar criticality');
    assert.equal(row.floatRiskWatchlist,sourceFloatInFloatRiskWatchlist(model,activity,config),'full-population watchlist');
   }
  }
  assert.equal(JSON.stringify(model),original,'source calendars and submitted records must remain unchanged');
 }
});
