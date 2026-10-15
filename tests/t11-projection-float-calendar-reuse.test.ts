import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNearCriticalProjection} from '../packages/near-critical-analysis/src';
import {buildProgressBreakdownProjection} from '../packages/progress-breakdown/src';
import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  isExecutionActivity,
  sourceFloatCriticality,
  sourceFloatInFloatRiskWatchlist,
  activityNearCriticalThresholdHours,
} from '../packages/schedule-analysis-core/src';

// Work out expected activity membership from the UNCHANGED scalar source
// readers, not from either edited specialist projector.
function sourceModel(id:string,firstHours:number){
 let firstReads=0,duplicateReads=0;
 const first:any={calendarId:'C',semanticComplete:true,sourceRefs:[]};
 Object.defineProperty(first,'standardDayHours',{enumerable:true,get(){firstReads++;return firstHours;}});
 const duplicate:any={calendarId:'C',semanticComplete:true,sourceRefs:[]};
 Object.defineProperty(duplicate,'standardDayHours',{enumerable:true,get(){duplicateReads++;return 1;}});
 const activities=Array.from({length:1001},(_,i)=>({
   projectId:id,activityId:'ACT-'+i,nativeId:String(i),name:'Task '+i,wbsId:i%11===0?'KNOWN':i%3===0?'CHILD':'ROOT',
   calendarId:i%11===0?'C':['C','UNDEFINED','BAD',null][i%4],
   activityType:i%41===0?'wbs_summary':'task',
   status:i%29===0?'completed':'in_progress',
   totalFloatHours:i%11===0?[-16,0,8,16,24,40,64][i%7]:i%17===0?null:[-16,0,8,16,24,40,64][i%7],
   freeFloatHours:null,percentComplete:10,originalDurationHours:80,remainingDurationHours:65,
   currentStartIso:'2031-01-01',currentFinishIso:'2031-07-01',
   baselineStartIso:'2031-01-01',baselineFinishIso:'2031-07-01',
   actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
   sourceRefs:[],diagnostics:[],
 }));
 const model:any={projectId:id,source:'xer',sourceRevisionId:'REV-'+id,dataDateIso:'2031-05-01',
   wbs:[{wbsId:'ROOT',name:'Root',parentWbsId:null,sourceRefs:[]},{wbsId:'CHILD',name:'Child',parentWbsId:'ROOT',sourceRefs:[]},{wbsId:'KNOWN',name:'Known',parentWbsId:'ROOT',sourceRefs:[]}],
   calendars:[first,duplicate,{calendarId:'BAD',semanticComplete:false,standardDayHours:24,sourceRefs:[]}],
   activities,relationships:[],diagnostics:[]};
 return {model,reads:()=>firstReads,duplicateReads:()=>duplicateReads};
}

test('T11: near-critical and WBS projectors reuse first source calendar without changing scalar classifications',()=>{
 const config={...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:3};
 for(const [id,hours] of [['FLOAT-LOCAL-1',8],['FLOAT-LOCAL-2',12]] as const){
  const {model,reads,duplicateReads}=sourceModel(id,hours);
  const before=JSON.stringify(model);
  const firstAtStart=reads(),duplicateAtStart=duplicateReads();
  const near=buildNearCriticalProjection(model,{generatedAt:'2031-05-01T00:00:00Z',producerVersion:'independent',config});
  assert.equal(reads()-firstAtStart,2,'one threshold and one separate audit working-day basis per first calendar');
  assert.equal(duplicateReads()-duplicateAtStart,0,'duplicate later definition must never replace the first calendar');
  const open=model.activities.filter((a:any)=>isExecutionActivity(a)&&a.status!=='completed');
  // The near-critical producer uses the canonical activityPopulation execution
  // population; unknown float/calendar remains unresolved, never zero.
  const known=open.filter((a:any)=>a.totalFloatHours!==null);
  const oracleNear=known.filter((a:any)=>sourceFloatCriticality(model,a,config)==='near_critical').length;
  const oracleCritical=known.filter((a:any)=>sourceFloatCriticality(model,a,config)==='critical').length;
  const oracleWatch=known.filter((a:any)=>sourceFloatInFloatRiskWatchlist(model,a,config)===true).length;
  const unresolved=known.filter((a:any)=>activityNearCriticalThresholdHours(model,a,config)===null).length+open.length-known.length;
  assert.equal(near.knownCriticalCount,oracleCritical);
  assert.equal(near.rows.length,oracleNear);
  assert.equal(near.watchlistRows.length,oracleWatch);
  assert.equal(near.unresolvedActivityCount,unresolved);
  assert.equal(near.nearCriticalCount,unresolved?null:oracleNear);

  const breakdown=buildProgressBreakdownProjection(model,{
    generatedAt:'2031-05-01T00:00:00Z',producerVersion:'independent',config,
  });
  assert.equal(breakdown.totalActivityCount,model.activities.filter(isExecutionActivity).length,'full WBS population');
  const knownWbs=breakdown.rows.find(row=>row.wbsId==='KNOWN');
  assert.ok(knownWbs,'known-value WBS is retained');
  assert.ok(knownWbs.criticalCount!==null&&knownWbs.nearCriticalCount!==null,'known-value WBS must exercise numeric parity');
  const hierarchyRows=breakdown.hierarchyRows;
  assert.ok(hierarchyRows,'specialist WBS ancestor roll-ups must be present');
  const completeSummary=breakdown.overallSummary;
  assert.ok(completeSummary,'the complete specialist source-scope summary must be present');
  for(const row of [...breakdown.rows,...hierarchyRows,completeSummary]){
    const ancestorRoot=hierarchyRows.includes(row as any)&&row.wbsId==='ROOT';
    const subset=row.wbsId==='DELIVERY_SCOPE'||ancestorRoot
      ?model.activities.filter(isExecutionActivity)
      :model.activities.filter((a:any)=>isExecutionActivity(a)&&a.wbsId===row.wbsId);
    const active=subset.filter((a:any)=>a.status!=='completed');
    const allKnown=active.every((a:any)=>a.totalFloatHours!==null);
    const thresholdsKnown=active.every((a:any)=>a.totalFloatHours===null||activityNearCriticalThresholdHours(model,a,config)!==null);
    assert.equal(row.criticalCount,allKnown?active.filter((a:any)=>sourceFloatCriticality(model,a,config)==='critical').length:null,row.wbsId+'/critical');
    assert.equal(row.nearCriticalCount,allKnown&&thresholdsKnown?active.filter((a:any)=>sourceFloatCriticality(model,a,config)==='near_critical').length:null,row.wbsId+'/near');
  }
  assert.equal(duplicateReads()-duplicateAtStart,0,'later duplicate calendar never used by either producer');
  assert.equal(JSON.stringify(model),before,'source records and calendar order remain untouched');
 }
});
