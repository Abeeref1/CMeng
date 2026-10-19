import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {plotCrewScenarios} from '../packages/runtime-api/src/plot-crew-scenarios';
import {cachedIndependentForecast} from '../packages/runtime-api/src/forecast-cache';
import {classifyRecoveryAgainstCompletion} from '../packages/runtime-api/src/recovery-completion-path';
import {recoveryAccelerationIntelligence,type RecoveryScenario} from '../packages/runtime-api/src/recovery-acceleration';

// SW-24: a recovery option must sit on the CPM path to completion and carry the
// completion gain from a CMeng CPM run; late work off that path is not recovery.
function chainModel(){
 const model=loadCertifiedDemoProject('SW24-'+randomUUID()).schedules.at(-1)!.revision.model,template=model.activities[0]!;
 model.dataDateIso='2034-01-01';
 model.calendars=[{calendarId:'C',name:'Daily shift',semanticComplete:true,standardDayHours:8,weeklyWorkMinutes:[480,480,480,480,480,480,480],weeklyWorkIntervals:[0,1,2,3,4,5,6].map(dayIndex=>({dayIndex,intervals:[{start:'08:00',finish:'16:00',minutes:480}]})),sourceRefs:[]}] as any;
 const task=(activityId:string,name:string)=>({...template,activityId,name,wbsId:null,activityType:'task' as const,status:'not_started' as const,calendarId:'C',remainingDurationHours:8,originalDurationHours:8,sourceConstraints:[],actualStartIso:null,actualFinishIso:null});
 // Eight one-day plots done by one crew (8 working days), plus one late
 // inspection that has 7 working days of CPM float.
 model.activities=[...Array.from({length:8},(_,i)=>task('A'+i,'Excavation Plot '+(i+1))),task('B','Facade inspection')];
 model.relationships=Array.from({length:7},(_,i)=>({relationshipId:'LINK'+i,predecessorActivityId:'A'+i,successorActivityId:'A'+(i+1),type:'FS' as const,lagHours:0,external:false,sourceRefs:[],diagnostics:[]}));
 return model;
}
function lateItem(id:string,activities:string[]):RecoveryScenario{
 return {scenarioId:id,type:'procurement_expedite',state:'calculated',subject:id,affectedActivities:activities,affectedPackages:[],assumption:'a',currentPosition:'Forecast delivery is 5 calendar days after need.',targetPosition:'t',
  possibleDaysRecovered:5,effectBasis:'e',additionalResources:null,estimatedCost:null,currency:null,costBasis:'c',implementationDate:null,constraints:[],risks:[],diminishingReturn:'d',authority:'scenario'};
}

test('SW-24 a driving-path crew option states its completion gain from a CMeng CPM run; late work off the path is not recovery',()=>{
 const model=chainModel(),before=JSON.stringify(model);
 const forecast=cachedIndependentForecast(model,'2034-01-01T00:00:00.000Z');
 assert.equal(forecast.complete,true,'the synthetic network is fully calculable');
 const crew=plotCrewScenarios(model);assert.equal(crew.length,1);
 const local=crew[0]!.possibleDaysRecovered;
 assert.ok(typeof local==='number'&&local>0,'the existing local chain figure (calendar days) is present');
 const offPath=lateItem('LATE-OFF-PATH',['B']),unlinked=lateItem('LATE-UNLINKED',[]);
 const scenarios=[...crew,offPath,unlinked];
 const summary=classifyRecoveryAgainstCompletion(scenarios,model,forecast,model.calendars[0]!);
 assert.equal(crew[0]!.pathRole,'recovery_option');
 // 64 working hours on one crew against two parallel 32-hour crews on the same 8-hour calendar.
 assert.equal(crew[0]!.completionGainWorkingDays,4,'CPM run: two crews move the project finish 4 working days earlier');
 assert.equal(crew[0]!.possibleDaysRecovered,local,'the local figure is unchanged by the CPM classification');
 assert.match(crew[0]!.completionGainBasis!,/CMeng CPM run/);
 assert.equal(offPath.pathRole,'late_work','late item with float above the near-critical threshold is late work');
 assert.equal(offPath.completionGainWorkingDays,null,'late work claims no completion gain');
 assert.equal(offPath.possibleDaysRecovered,5,'the local lateness figure is kept, not relabelled');
 assert.equal(unlinked.pathRole,'path_not_established','no linked activity: unknown stays unknown');
 assert.deepEqual({options:summary.recoveryOptionCount,late:summary.lateWorkCount,unknown:summary.pathNotEstablishedCount},{options:1,late:1,unknown:1});
 assert.equal(JSON.stringify(model),before,'scenario CPM runs never change the programme');
});

test('SW-24 an on-path option with no CPM-runnable change shows the completion gain as not established',()=>{
 const model=chainModel(),forecast=cachedIndependentForecast(model,'2034-01-01T00:00:00.000Z');
 const onPath=lateItem('LATE-ON-PATH',['A3']);
 classifyRecoveryAgainstCompletion([onPath],model,forecast,model.calendars[0]!);
 assert.equal(onPath.pathRole,'recovery_option');
 assert.equal(onPath.completionGainWorkingDays,null);
 assert.match(onPath.completionGainBasis!,/^Not established/);
 // Without the completion calendar's working-day hours no working-day gain is stated.
 const crew=plotCrewScenarios(model);classifyRecoveryAgainstCompletion(crew,model,forecast,{...model.calendars[0]!,standardDayHours:null});
 assert.equal(crew[0]!.completionGainWorkingDays,null);assert.match(crew[0]!.completionGainBasis!,/^Not established/);
});

test('SW-24 the recovery projection counts only CPM-calculated options on the path to completion',()=>{
 const state=loadCertifiedDemoProject('SW24-PROJECTION-'+randomUUID());
 const result=recoveryAccelerationIntelligence(state);
 for(const row of result.scenarios){
  assert.ok(['recovery_option','late_work','path_not_established'].includes(row.pathRole!),row.scenarioId);
  if(row.pathRole!=='recovery_option')assert.equal(row.completionGainWorkingDays,null,row.scenarioId);
  assert.ok(row.completionGainWorkingDays===null||typeof row.completionGainWorkingDays==='number',row.scenarioId);
  assert.equal(typeof row.completionGainBasis,'string',row.scenarioId);
 }
 const options=result.scenarios.filter(row=>row.pathRole==='recovery_option');
 assert.equal(result.calculatedScenarioCount,options.filter(row=>typeof row.completionGainWorkingDays==='number').length);
 assert.equal(result.assumptionRequiredCount,options.length-result.calculatedScenarioCount);
 assert.equal(result.recoveryOptionCount+result.lateWorkCount+result.pathNotEstablishedCount,result.scenarios.length);
});

test('SW-24 crew and shift options on the driving path get a CPM completion gain from their stated duration ratio',()=>{
 const model=chainModel(),before=JSON.stringify(model),forecast=cachedIndependentForecast(model,'2034-01-01T00:00:00.000Z');
 // Crew 2 -> 4 people on the last driving activity: its 8 remaining hours become 4.
 const crew={...lateItem('crew:A7',['A7']),type:'additional_crew' as const,cpmChange:{removeRelationshipIds:[],addRelationships:[],durationScale:[{activityId:'A7',factor:2/4}]}};
 // Equal second shift on an off-path activity: still late work, no gain claimed.
 const offShift={...lateItem('shift:B',['B']),type:'additional_shift_or_calendar' as const,cpmChange:{removeRelationshipIds:[],addRelationships:[],durationScale:[{activityId:'B',factor:0.5}]}};
 classifyRecoveryAgainstCompletion([crew,offShift],model,forecast,model.calendars[0]!);
 assert.equal(crew.pathRole,'recovery_option');
 assert.equal(crew.completionGainWorkingDays,0.5,'4 working hours earlier on an 8-hour calendar day');
 assert.match(crew.completionGainBasis!,/A7 × 0\.5/);
 assert.equal(offShift.pathRole,'late_work');assert.equal(offShift.completionGainWorkingDays,null);
 // A remaining duration the source does not state cannot be scaled: not established, never 0.
 const unstated=chainModel();unstated.activities.find(a=>a.activityId==='A6')!.remainingDurationHours=null as any;
 const missing={...lateItem('crew:A6',['A6']),type:'additional_crew' as const,cpmChange:{removeRelationshipIds:[],addRelationships:[],durationScale:[{activityId:'A6',factor:0.5}]}};
 classifyRecoveryAgainstCompletion([missing],unstated,{complete:true,drivingNetwork:{activityIds:['A6']},activities:[]},unstated.calendars[0]!);
 assert.equal(missing.pathRole,'recovery_option');assert.equal(missing.completionGainWorkingDays,null);assert.match(missing.completionGainBasis!,/^Not established/);
 assert.equal(JSON.stringify(model),before);
});

test('SW-24 with no completion milestone the gain is counted on the CPM finish activity\'s stated source calendar',()=>{
 // The programme has no Programme PC milestone, as in an ordinary task-only XER.
 const model=chainModel(),forecast=cachedIndependentForecast(model,'2034-01-01T00:00:00.000Z');
 assert.deepEqual(forecast.drivingNetwork?.finishActivityIds,['A7']);
 const crew=plotCrewScenarios(model);
 classifyRecoveryAgainstCompletion(crew,model,forecast,null);
 assert.equal(crew[0]!.pathRole,'recovery_option');
 assert.equal(crew[0]!.completionGainWorkingDays,4,'counted in working days of calendar C (8 stated hours per day)');
 assert.match(crew[0]!.completionGainBasis!,/calendar C of the CPM finish activity/);
 // The source calendar does not state its day hours: still not established, never assumed.
 const unstated=chainModel();(unstated.calendars[0] as any).standardDayHours=null;
 const again=plotCrewScenarios(unstated);
 classifyRecoveryAgainstCompletion(again,unstated,cachedIndependentForecast(unstated,'2034-01-01T00:00:00.000Z'),null);
 assert.equal(again[0]!.completionGainWorkingDays,null);assert.doesNotMatch(again[0]!.completionGainBasis!,/CMeng CPM run with/);
});
