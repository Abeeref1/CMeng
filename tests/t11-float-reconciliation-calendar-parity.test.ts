import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFloatCriticality,isExecutionActivity,DEFAULT_SCHEDULE_ANALYSIS_CONFIG} from '../packages/schedule-analysis-core/src';
import {activityFloatReconciliation} from '../packages/runtime-api/src/activity-float-reconciliation';

// Original scalar source oracle, deliberately without a calendar index.
test('T06/T11 SW-54: every source-vs-independent float row retains original scalar classification and authority',()=>{
 for(const [projectId,dayHours] of [['FLOAT-RECON-A',8],['FLOAT-RECON-B',11]] as const){
  const model:any={
   projectId,source:'xer',sourceRevisionId:'REV-'+projectId,dataDateIso:'2031-05-01',
   activities:Array.from({length:5101},(_,i)=>({
    projectId,activityId:'ROW-'+i,nativeId:String(i),name:'Task '+i,wbsId:'W',
    calendarId:['C','SHIFT','UNKNOWN','INCOMPLETE',null][i%5],
    activityType:['task','start_milestone','wbs_summary','level_of_effort','finish_milestone'][Math.floor(i/7)%5],
    status:i%31===0?'completed':i%37===0?'unknown':'in_progress',
    totalFloatHours:i%19===0?null:[-24,-1,0,8,16,24,40,64][i%8],
    freeFloatHours:null,percentComplete:15,
    originalDurationHours:80,remainingDurationHours:70,
    baselineStartIso:'2031-01-01',baselineFinishIso:'2031-07-01',
    currentStartIso:'2031-01-01',currentFinishIso:'2031-07-01',
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
    sourceRefs:[],diagnostics:[],
   })),
   relationships:[],wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],
   calendars:[
    {calendarId:'C',semanticComplete:true,standardDayHours:dayHours,sourceRefs:[]},
    {calendarId:'C',semanticComplete:true,standardDayHours:2,sourceRefs:[]},
    {calendarId:'SHIFT',semanticComplete:true,standardDayHours:10,sourceRefs:[]},
    {calendarId:'INCOMPLETE',semanticComplete:false,standardDayHours:null,sourceRefs:[]},
   ],diagnostics:[],
  };
  const original=JSON.stringify(model);
  const calc=new Map<string,number|null>(model.activities.map((a:any,i:number)=>[a.activityId,i%23===0?null:[-8,0,8,24,64][i%5]]));
  const forecast:any={sourceRevisionId:model.sourceRevisionId,complete:true,origin:'deterministic_source_calendar',
   activities:model.activities.map((a:any)=>({activityId:a.activityId,status:'calculated',calendarMode:'source_calendar',
    independentTotalFloatHours:calc.get(a.activityId)}))};
  for(const config of [
   {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:3},
   {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:null,nearCriticalFloatThresholdHours:32},
   {...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:-1},
  ]){
   const reviewed=activityFloatReconciliation(model,forecast,config,27);
   const sourceRows=model.activities.filter(isExecutionActivity);
   let matched=0,disputed=0,unresolved=0,completed=0,numericOnly=0;
   const exceptional:string[]=[];
   for(const a of sourceRows){
    const s=a.totalFloatHours as number|null,i=calc.get(a.activityId)??null,done=a.status==='completed';
    const sourceClass=done?'not_applicable':sourceFloatCriticality(model,{...a,totalFloatHours:s},config);
    const cpmClass=done?'not_applicable':sourceFloatCriticality(model,{...a,totalFloatHours:i},config);
    const expected=done?'not_applicable_completed':i===null?'independent_not_established':
     s===null?'submitted_not_established':sourceClass!==cpmClass?'material_difference':'matched';
    const row=reviewed.byActivityId.get(a.activityId);
    assert.ok(row,'original execution activity omitted');
    assert.equal(row.submittedCriticality,sourceClass);
    assert.equal(row.independentCriticality,cpmClass);
    assert.equal(row.floatReconciliationState,expected,a.activityId);
    assert.equal(row.submittedTotalFloatHours,s);
    assert.equal(row.independentTotalFloatHours,done?null:i);
    if(done)completed++;
    else if(expected==='matched'){matched++;if(s!==i)numericOnly++;}
    else {exceptional.push(a.activityId);if(expected==='material_difference')disputed++;else unresolved++;}
   }
   assert.equal(reviewed.summary.sourceActivityCount,sourceRows.length);
   assert.equal(reviewed.summary.checkedActivityCount,sourceRows.length-completed);
   assert.equal(reviewed.summary.matchedActivityCount,matched);
   assert.equal(reviewed.summary.disputedActivityCount,disputed);
   assert.equal(reviewed.summary.unresolvedActivityCount,unresolved);
   assert.equal(reviewed.summary.numericDifferenceActivityCount,numericOnly);
   assert.deepEqual(reviewed.summary.rows.map((row:any)=>row.activityId),exceptional);
   assert.strictEqual(activityFloatReconciliation(model,forecast,config,27),reviewed);
  }
  const conflict=activityFloatReconciliation(model,{...forecast,sourceRevisionId:'OTHER'},DEFAULT_SCHEDULE_ANALYSIS_CONFIG,28);
  assert.equal(conflict.summary.matchedActivityCount,0,'no authority promotion across revisions');
  assert.equal(JSON.stringify(model),original,'no source rows or calendars mutated');
 }
});
