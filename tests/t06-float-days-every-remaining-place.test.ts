import test from 'node:test';
import assert from 'node:assert/strict';
import * as reconciliation from '../packages/runtime-api/src/activity-float-reconciliation';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

function model(){
  const activity=(activityId:string,calendarId:string,status='in_progress')=>({activityId,calendarId,status,activityType:'task',totalFloatHours:16,sourceRefs:[]});
  return {projectId:'P',sourceRevisionId:'R',relationships:[],wbs:[],diagnostics:[],
    activities:[activity('A','C8'),activity('B','C12'),activity('C','UNREAD'),activity('D','C8','completed')],
    calendars:[{calendarId:'C8',semanticComplete:true,standardDayHours:8,sourceRefs:[]},
      {calendarId:'C8',semanticComplete:true,standardDayHours:24,sourceRefs:[]},
      {calendarId:'C12',semanticComplete:true,standardDayHours:12,sourceRefs:[]},
      {calendarId:'UNREAD',semanticComplete:false,standardDayHours:8,sourceRefs:[]}]} as any;
}

test('T06 remaining places: float hours tied to an activity also carry its own calendar working days',()=>{
  const attach=(reconciliation as any).attachFloatWorkingDays;
  assert.equal(typeof attach,'function','shared working-day step exists');
  const body={rows:[{activityId:'A',totalFloatHours:16},{activityId:'B',sourceFloatHours:24},
    {activityId:'C',totalFloatHours:16},{activityId:'D',totalFloatHours:16},{activityId:'X',totalFloatHours:4},
    {activityId:'A',totalFloatHours:-8,totalFloatWorkingDays:-9}],
    groups:[{lowestFloatHours:-24,lowestFloatActivityId:'B',lowestFloatCalendarIds:['C12']},{worstFloatHours:8,worstFloatActivityId:'C',worstFloatCalendarIds:['UNREAD']},
      {lowestFloatHours:-24,lowestFloatActivityId:'B',lowestFloatCalendarIds:['C8','C12']}],
    actions:[{priorityBasis:{linkedFloatHours:0,linkedFloatActivityId:'A',linkedFloatCalendarIds:['C8']}}]};
  const before=JSON.stringify(body);
  const out=attach(body,model());
  assert.equal(JSON.stringify(body),before,'input not mutated');
  assert.equal(out.rows[0].totalFloatWorkingDays,2,'16 h on the first 8-hour calendar is 2 working days (duplicate 24 h ignored)');
  assert.equal(out.rows[0].totalFloatHours,16,'original hours kept');
  assert.equal(out.rows[0].floatDaysBasis,'source_activity_calendar');
  assert.equal(out.rows[1].sourceFloatWorkingDays,2,'24 h on a 12-hour calendar');
  assert.equal(out.rows[2].totalFloatWorkingDays,null,'unread calendar never becomes an 8-hour day');
  assert.equal(out.rows[2].floatDaysBasis,'calendar_working_day_not_established');
  assert.equal(out.rows[3].totalFloatWorkingDays,null,'completed work has no live float in days');
  assert.equal(out.rows[3].floatDaysBasis,'not_applicable_completed');
  assert.equal(out.rows[4].totalFloatWorkingDays,undefined,'unknown activity gets no invented day');
  assert.equal(out.rows[5].totalFloatWorkingDays,-9,'existing day value never overwritten');
  assert.equal(out.groups[0].lowestFloatWorkingDays,-2,'group converts with the lowest-float activity calendar');
  assert.equal(out.groups[1].worstFloatWorkingDays,null);
  assert.equal(out.groups[1].worstFloatDaysBasis,'calendar_working_day_not_established');
  assert.equal(out.groups[2].lowestFloatWorkingDays,null,'mixed calendar day lengths never give one group day value');
  assert.equal(out.groups[2].lowestFloatDaysBasis,'mixed_calendar_day_lengths');
  assert.equal(out.actions[0].priorityBasis.linkedFloatWorkingDays,0,'valid zero stays zero');
  assert.equal((reconciliation as any).floatHoursText(-8,8),'-1 working days (activity calendar)');
  assert.equal((reconciliation as any).floatHoursText(-8,24),'-0.33 working days (activity calendar)','narrative shows two decimals');
  assert.equal((reconciliation as any).floatHoursText(-8,null),'working days not established (calendar hours per day not read)');
});

test('T06 remaining places: no screen prints current float in hours only',()=>{
  const html=cmengUatHtml();
  const hourOnly=[
    'fmt(row.priorityBasis.linkedFloatHours)+\' h float\'',
    'fmt(row.worstFloatHours)+\' hours\'',
    'fmt(row.totalFloatHours)+\' hours\'',
    'fmt(row.sourceTotalFloatHours)+" h"',
    'fmt(group.lowestFloatHours)+" h"',
    'fmt(row.sourceFloatHours)+" h TF"',
    'fmt(stage.lowestFloatHours)+" h"',
    'fmt(row.sourceFloatHours)+" h"',
    "['totalFloatHours','Float · hours']",
    "['totalFloatHours','Source float · h']",
    "['worstFloatHours','Lowest float · h']",
    "['programmeContext.linkedFloatHours','Live float · hours']",
    "['linkedFloatHours','Linked float · hours']",
    "['Current float h','currentFloatHours']",
    "'Submitted float (hours)'",
    "'Float (hours)'",
  ];
  for(const text of hourOnly)assert.ok(!html.includes(text),'hour-only float display remains: '+text);
  for(const use of ["sourceWorkingFloatField(row.priorityBasis,'linkedFloatHours')","sourceWorkingFloatField(row,'worstFloatHours')",
    'sourceWorkingFloatField(group,"lowestFloatHours")','sourceWorkingFloatField(stage,"lowestFloatHours")',
    "sourceWorkingFloatField(row.programmeContext,'linkedFloatHours')","sourceWorkingFloatField(r,'submittedFloatHours')"])
    assert.ok(html.includes(use),'screen uses the shared source-calendar helper: '+use);
});
