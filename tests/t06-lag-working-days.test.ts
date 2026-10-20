import test from 'node:test';
import assert from 'node:assert/strict';
import {attachFloatWorkingDays,lagHoursText,lagWorkingDays} from '../packages/runtime-api/src/activity-float-reconciliation';

// T06 / N7: relationship lag is shown in working days of the successor
// activity calendar (P6 lag convention, as the CMeng CPM works it), hours
// second. An unread calendar never becomes an 8-hour day.
function model(){
  const activity=(id:string,calendarId:string)=>({activityId:id,nativeId:id,name:id,wbsId:'W1',calendarId,activityType:'task',
    status:'in_progress',totalFloatHours:0,freeFloatHours:null,percentComplete:0,originalDurationHours:24,remainingDurationHours:24,
    currentStartIso:'2031-01-01',currentFinishIso:'2031-01-03',baselineStartIso:null,baselineFinishIso:null,
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,sourceRefs:[],diagnostics:[]});
  return {projectId:'P',source:'xer',sourceRevisionId:'R',dataDateIso:'2031-01-01',diagnostics:[],
    wbs:[{wbsId:'W1',name:'One',parentWbsId:null,sourceRefs:[]}],
    activities:[activity('PRED','C8'),activity('S12','C12'),activity('SUNREAD','UNREAD')],
    relationships:[],
    calendars:[{calendarId:'C8',semanticComplete:true,standardDayHours:8,sourceRefs:[]},
      {calendarId:'C12',semanticComplete:true,standardDayHours:12,sourceRefs:[]},
      {calendarId:'UNREAD',semanticComplete:false,standardDayHours:8,sourceRefs:[]}]} as any;
}

test('T06 a 24 h lag into a 12-hour successor calendar is 2 working days; hours kept',()=>{
  const m=model();
  const body={relationships:[{relationshipId:'R1',predecessorActivityId:'PRED',successorActivityId:'S12',type:'FS',lagHours:24}],
    positiveLags:[{relationshipId:'R1',predecessor:'PRED',successor:'S12',type:'FS',lagHours:24}]};
  const out=attachFloatWorkingDays(body,m) as any;
  assert.equal(out.relationships[0].lagHours,24,'hours unchanged');
  assert.equal(out.relationships[0].lagWorkingDays,2,'successor calendar (12 h), never the predecessor 8 h day');
  assert.equal(out.relationships[0].lagDaysBasis,'successor_activity_calendar');
  assert.equal(out.positiveLags[0].lagWorkingDays,2,'logic-check lag rows carry the same working days');
  assert.equal((body.relationships[0] as any).lagWorkingDays,undefined,'input is not mutated');
  // N7: working days on screen; the source hours stay as the audit ("original h").
  assert.equal(lagHoursText(24,lagWorkingDays(m,'S12',24).dayHours),'lag 2 working days (successor calendar) · 24 original h');
});

test('T06 lag into an unread or unknown successor calendar is not established, never an 8-hour day',()=>{
  const m=model();
  const out=attachFloatWorkingDays({rows:[{relationshipId:'R2',predecessorActivityId:'PRED',successorActivityId:'SUNREAD',type:'FS',lagHours:24},
    {relationshipId:'R3',predecessorActivityId:'PRED',successorActivityId:'NOT_IN_PROGRAMME',type:'FS',lagHours:16}]},m) as any;
  assert.equal(out.rows[0].lagWorkingDays,null,'unread calendar stays unknown (not 3 days of 8 h)');
  assert.equal(out.rows[0].lagDaysBasis,'successor_calendar_working_day_not_established');
  assert.equal(out.rows[1].lagWorkingDays,null,'successor not in the programme stays unknown (not 2 days of 8 h)');
  assert.equal(out.rows[0].lagHours,24);
  const text=lagHoursText(24,lagWorkingDays(m,'SUNREAD',24).dayHours);
  assert.match(text,/lag working days not established/);
  assert.match(text,/24 original h/);
  assert.doesNotMatch(text,/\b3 working days/);
  assert.equal(lagHoursText(null,12),'lag not established');
});
