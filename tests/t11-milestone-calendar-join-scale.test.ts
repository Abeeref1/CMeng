import test from 'node:test';
import assert from 'node:assert/strict';
import {attachSourceActivityCalendars} from '../packages/runtime-api/src/source-milestone-calendar-join';
import type {CanonicalScheduleActivity} from '../packages/schedule-analysis-core/src';

test('T11 SW-10 complete milestone join is source-equivalent on 12001+ rows with missing and duplicated IDs',()=>{
 const projectId='SOURCE-JOIN';
 const activities:CanonicalScheduleActivity[]=Array.from({length:12001},(_,i)=>({
  projectId,activityId:'A'+i,nativeId:String(i),name:'Work '+i,wbsId:'W',
  calendarId:i%13===0?null:'C'+i%7,
  activityType:'task',status:'not_started',
  baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2031-01-01',currentFinishIso:'2031-06-01',
  actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
  originalDurationHours:8,remainingDurationHours:8,totalFloatHours:null,freeFloatHours:null,
  percentComplete:null,sourceRefs:[],diagnostics:[],
 }));
 activities.push({...activities[9]!,name:'Duplicate conflicting source',calendarId:'DIFFERENT'});
 const rows=activities.slice(0,12001).map(row=>({
  activityId:row.activityId,sourceRevisionId:'REV-1',expectedStatus:'retained',
 }));
 rows.push({activityId:'NOT-IN-ORIGINAL',sourceRevisionId:'REV-1',expectedStatus:'retained'});
 const source=JSON.stringify({activities,rows});
 const enriched=attachSourceActivityCalendars(rows,activities);
 assert.equal(enriched.length,rows.length,'all source milestone candidates remain present');
 for(let i=0;i<12001;i++)
  assert.equal(enriched[i]!.calendarId,i%13===0?null:'C'+i%7,'source calendar on original row '+i);
 assert.equal(enriched[9]?.calendarId,'C2','exact first source match retained when duplicate IDs are unresolved');
 assert.equal(enriched.at(-1)?.calendarId,null,'unlinked source cannot gain a fabricated calendar');
 assert.ok(enriched.every(row=>row.expectedStatus==='retained'&&row.sourceRevisionId==='REV-1'));
 assert.equal(JSON.stringify({activities,rows}),source,'source model and reported milestone rows remain unchanged');
});
