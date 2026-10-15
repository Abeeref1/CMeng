import test from 'node:test';
import assert from 'node:assert/strict';
import {buildActivityAnalyticsProjection} from '../packages/activity-analytics/src/projector';
import {
 DEFAULT_SCHEDULE_ANALYSIS_CONFIG,sourceFloatCriticality,sourceFloatInFloatRiskWatchlist,
} from '../packages/schedule-analysis-core/src';

function project(id:string,hours:number){
 let reads=0;
 const calendar:any={calendarId:'C',semanticComplete:true,sourceRefs:[]};
 Object.defineProperty(calendar,'standardDayHours',{enumerable:true,get(){reads++;return hours;}});
 const activities=Array.from({length:601},(_,i)=>({
  projectId:id,activityId:'A-'+i,nativeId:String(i),name:'Work '+i,
  wbsId:'W',calendarId:i%11===0?'MISSING':'C',activityType:'task',
  status:i%31===0?'completed':'in_progress',
  totalFloatHours:i%29===0?null:[-16,0,8,16,24,40,56][i%7],
  freeFloatHours:null,percentComplete:10,originalDurationHours:80,remainingDurationHours:70,
  baselineStartIso:'2031-01-01',baselineFinishIso:'2031-07-01',
  currentStartIso:'2031-01-01',currentFinishIso:'2031-07-01',
  actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
  sourceRefs:[],diagnostics:[],
 }));
 return {model:{projectId:id,source:'xer',sourceRevisionId:'REV-'+id,
  dataDateIso:'2031-04-01',activities,relationships:[],
  wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],
  calendars:[calendar,{calendarId:'C',standardDayHours:2,semanticComplete:true,sourceRefs:[]}],
  diagnostics:[]} as any,reads:()=>reads};
}

test('T06/T11 source float classification reuses first calendar only within each project',()=>{
 const config={...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:3};
 for(const [id,hours] of [['CAL-A',8],['CAL-B',11]] as const){
  const {model,reads}=project(id,hours);
  const result=buildActivityAnalyticsProjection(model,{
   generatedAt:'2031-04-01T00:00:00Z',producerVersion:'independent',config,
  });
  assert.equal(result.rows.length,601,'complete source population');
  assert.equal(reads(),1,'calendar working-day basis calculated once per source projection');
  for(let i=0;i<model.activities.length;i++){
   const activity=model.activities[i],row=result.rows[i]!;
   assert.equal(row.activityId,activity.activityId,'source record identity');
   assert.equal(row.criticality,sourceFloatCriticality(model,activity,config),
    'original unindexed source criticality '+id+'/'+i);
   assert.equal(row.floatRiskWatchlist,sourceFloatInFloatRiskWatchlist(model,activity,config),
    'original unindexed source watchlist '+id+'/'+i);
  }
 }
});
