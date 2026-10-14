import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProgressBreakdownProjection} from '../packages/progress-breakdown/src';
import {
 sourceFloatCriticality,activityNearCriticalThresholdHours,isExecutionActivity,
 DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
} from '../packages/schedule-analysis-core/src';

// Oracle uses original uncached scalar float readers, independent of the
// shared per-activity WBS/hierarchy/dimension projection's indexed cache.
function expected(model:any,activities:any[],config:any){
 const open=activities.filter(a=>a.status!=='completed');
 const known=open.filter(a=>a.totalFloatHours!==null);
 const whole=known.length===open.length;
 const thresholds=known.every(a=>activityNearCriticalThresholdHours(model,a,config)!==null);
 return {
  criticalCount:whole?known.filter(a=>sourceFloatCriticality(model,a,config)==='critical').length:null,
  nearCriticalCount:whole&&thresholds?known.filter(a=>sourceFloatCriticality(model,a,config)==='near_critical').length:null,
  negativeFloatCount:whole?known.filter(a=>a.totalFloatHours<0).length:null,
 };
}
test('T06/T11 WBS, ancestor and complete progress breakdown float counts match uncached source in separate projects',()=>{
 for(const [id,dayHours] of [['WBS-FLOAT-A',8],['WBS-FLOAT-B',11]] as const){
  const wbs=[
   {wbsId:'ROOT',name:'Root',parentWbsId:null,sourceRefs:[]},
   {wbsId:'A',name:'A',parentWbsId:'ROOT',sourceRefs:[]},
   {wbsId:'A2',name:'A2',parentWbsId:'A',sourceRefs:[]},
   {wbsId:'B',name:'B',parentWbsId:'ROOT',sourceRefs:[]},
  ];
  const model:any={projectId:id,source:'xer',sourceRevisionId:'SOURCE-'+id,dataDateIso:'2031-05-01',
   wbs,calendars:[
    {calendarId:'C',semanticComplete:true,standardDayHours:dayHours,sourceRefs:[]},
    {calendarId:'C',semanticComplete:true,standardDayHours:2,sourceRefs:[]},
    {calendarId:'ALT',semanticComplete:true,standardDayHours:10,sourceRefs:[]},
    {calendarId:'BAD',semanticComplete:false,standardDayHours:null,sourceRefs:[]},
   ],
   activities:Array.from({length:3101},(_,i)=>({
    projectId:id,activityId:'ACT-'+i,nativeId:String(i),name:'Activity '+i,
    wbsId:['A','A2','B',null][i%4],calendarId:['C','ALT','MISSING','BAD',null][i%5],
    activityType:['task','start_milestone','finish_milestone','wbs_summary','level_of_effort'][Math.floor(i/7)%5],
    status:i%31===0?'completed':'in_progress',totalFloatHours:i%19===0?null:[-24,-1,0,8,16,24,40,64][i%8],
    freeFloatHours:null,percentComplete:i%31===0?100:15,originalDurationHours:80,remainingDurationHours:70,
    baselineStartIso:'2031-01-01',baselineFinishIso:'2031-07-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-07-01',
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,sourceRefs:[],diagnostics:[],
   })),relationships:[],diagnostics:[]};
  const before=JSON.stringify(model);
  const activities=model.activities.filter(isExecutionActivity);
  assert.ok(activities.some((a:any)=>a.calendarId==='BAD'));
  assert.ok(activities.some((a:any)=>a.calendarId==='MISSING'));
  for(const config of [
   {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:3},
   {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:null,nearCriticalFloatThresholdHours:32},
  ]){
   const result=buildProgressBreakdownProjection(model,{generatedAt:'2031-05-01T00:00:00Z',producerVersion:'scalar-parity',config});
   const check=(name:string,row:any,sourceRows:any[])=>{
    const oracle=expected(model,sourceRows,config);
    for(const key of ['criticalCount','nearCriticalCount','negativeFloatCount'] as const)
     assert.equal(row[key],oracle[key],name+'/'+key);
    assert.equal(row.activityCount,sourceRows.length,name+'/source population');
   };
   check('overall',result.overallSummary,activities);
   for(const row of result.rows){
    const subset=activities.filter((a:any)=>(a.wbsId??'__UNASSIGNED__')===row.wbsId);
    check('direct '+row.wbsId,row,subset);
   }
   const ancestors=new Map(wbs.map(w=>[w.wbsId,w.parentWbsId] as const));
   for(const row of result.hierarchyRows){
    const subset=activities.filter((a:any)=>{
     let current=a.wbsId;
     const seen=new Set();
     while(current&&!seen.has(current)){
      if(current===row.wbsId)return true;
      seen.add(current);current=ancestors.get(current)??null;
     }
     return row.wbsId==='__UNASSIGNED__'&&!a.wbsId;
    });
    check('hierarchy '+row.wbsId,row,subset);
   }
   assert.equal(result.totalActivityCount,activities.length,'no lost activity in WBS table');
  }
  assert.equal(JSON.stringify(model),before,'original activities, WBS and duplicate calendars unchanged');
 }
});
