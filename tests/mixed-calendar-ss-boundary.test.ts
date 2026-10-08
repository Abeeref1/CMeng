import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCpm} from '../packages/schedule-cpm/src';

// Independent exhaustive reference MIXED-4011ed0872-065, produced BEFORE
// this engine change. Original frozen SHA is retained in GitHub run 37748608559.
test('SS predecessor cannot start at a closed shift boundary on a mixed calendar',()=>{
 const calendar=(id:string,dayStart:number,dayEnd:number,weekdays:number[])=>({
   calendarId:id,name:id,semanticComplete:true,standardDayHours:dayEnd-dayStart,
   standardWeekHours:(dayEnd-dayStart)*weekdays.length,
   weeklyWorkMinutes:Array.from({length:7},(_,i)=>weekdays.includes(i+1)?(dayEnd-dayStart)*60:0),
   weeklyWorkIntervals:Array.from({length:7},(_,i)=>({dayIndex:i+1,intervals:weekdays.includes(i+1)?
     [{start:String(dayStart).padStart(2,'0')+':00',finish:String(dayEnd).padStart(2,'0')+':00',minutes:(dayEnd-dayStart)*60}]:[]})),
   exceptions:[],sourceRefs:[]
 });
 const model:any={projectId:'INDEPENDENT-SS-CLOSING',source:'xer',sourceRevisionId:'SS-CLOSING',
   dataDateIso:'2026-01-10T00:00:00.000Z',calendars:[calendar('C3',9,15,[3,4,5,6,7]),calendar('C0',8,16,[2,3,4,5,6])],
   activities:[1,11].map((duration,i)=>({projectId:'INDEPENDENT-SS-CLOSING',activityId:'A'+i,nativeId:String(i),name:'Independent '+i,
     wbsId:null,calendarId:i===0?'C3':'C0',activityType:'task',status:'not_started',
     baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,
     forecastStartIso:null,forecastFinishIso:null,originalDurationHours:duration,remainingDurationHours:duration,totalFloatHours:null,
     freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]})),
   relationships:[{relationshipId:'SS',predecessorActivityId:'A0',successorActivityId:'A1',
     type:'SS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]}],
   wbs:[],diagnostics:[]};
 const result=calculateCpm(model,{allowElapsedFallback:false,assumeUnknownRelationshipTypeFs:false,assumeMissingLagZero:false});
 const a=result.activities.find(r=>r.activityId==='A0')!;
 const b=result.activities.find(r=>r.activityId==='A1')!;
 assert.equal(a.earlyStartIso,'2026-01-10T09:00:00.000Z');
 assert.equal(a.lateStartIso,'2026-01-10T14:00:00.000Z');
 assert.equal(a.lateFinishIso,'2026-01-10T15:00:00.000Z');
 assert.equal(a.totalFloatHours,5);
 assert.equal(b.lateStartIso,'2026-01-12T08:00:00.000Z');
 assert.equal(b.totalFloatHours,0);
 assert.equal(result.projectFinishIso,'2026-01-13T11:00:00.000Z');
});
