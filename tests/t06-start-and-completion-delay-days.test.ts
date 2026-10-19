import test from 'node:test';
import assert from 'node:assert/strict';
import {buildActivityAnalyticsProjection} from '../packages/activity-analytics/src';
import {completionDelayWorkingDays} from '../packages/project-director/src';
import {attachFloatWorkingDays} from '../packages/runtime-api/src/activity-float-reconciliation';
import {completionDelayCalendar} from '../packages/runtime-api/src/completion-delay-calendar';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// T06 / N7: start slippage and the completion delay are shown in working days
// of the relevant calendar first, elapsed days second. Unknown calendar stays
// unknown, never an 8-hour day or a 7-day week.

// Sunday to Thursday, 06:00 to 18:00 UTC: a 12-hour working day.
const C12={calendarId:'C12',name:'Sun-Thu 12h',semanticComplete:true,standardDayHours:12,standardWeekHours:60,
  weeklyWorkIntervals:[1,2,3,4,5].map(dayIndex=>({dayIndex,intervals:[{start:'06:00',finish:'18:00',minutes:720}]})),exceptions:[],sourceRefs:[]};
const UNREAD={calendarId:'UNREAD',semanticComplete:false,standardDayHours:8,sourceRefs:[]};
const THU='2031-01-02T06:00:00Z',SUN='2031-01-05T06:00:00Z';
function activity(id:string,calendarId:string,over:Record<string,unknown>){
  return {projectId:'P',activityId:id,nativeId:id,name:id,wbsId:'W1',calendarId,activityType:'task',status:'not_started',
    totalFloatHours:0,freeFloatHours:null,percentComplete:0,originalDurationHours:120,remainingDurationHours:120,
    currentStartIso:THU,currentFinishIso:'2031-02-20T18:00:00Z',baselineStartIso:THU,baselineFinishIso:'2031-02-20T18:00:00Z',
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,sourceRefs:[],diagnostics:[],...over};
}
function model(activities:any[]){
  return {projectId:'P',source:'xer',sourceRevisionId:'R',dataDateIso:SUN,diagnostics:[],relationships:[],
    wbs:[{wbsId:'W1',name:'One',parentWbsId:null,sourceRefs:[]}],activities,calendars:[C12,UNREAD]} as any;
}
const meta={generatedAt:SUN,producerVersion:'t06-start'};
function rows(m:any){
  const out=attachFloatWorkingDays(buildActivityAnalyticsProjection(m,meta),m) as any;
  return new Map<string,any>(out.rows.map((r:any)=>[r.activityId,r]));
}

test('T06 a not-started activity overdue since Thursday is 1 working day late at Sunday Data Date (3 elapsed days kept)',()=>{
  const r=rows(model([activity('N','C12',{}),activity('NU','UNREAD',{})]));
  const n=r.get('N'),u=r.get('NU');
  assert.equal(n.startOverdueCalendarDays,3,'elapsed days unchanged');
  assert.equal(n.startOverdueWorkingDays,1,'Thursday 12 h; Friday and Saturday are not working days');
  assert.equal(n.startOverdueDaysBasis,'source_activity_calendar');
  assert.equal(n.startSlippageWorkingDays,1);
  assert.equal(n.startSlippageCalendarDays,3);
  assert.equal(n.startSlippageDatePair,'planned_start_to_data_date');
  assert.equal(u.startOverdueCalendarDays,3);
  assert.equal(u.startOverdueWorkingDays,null,'unread calendar stays unknown (never 3 days of 8 h)');
  assert.equal(u.startOverdueDaysBasis,'calendar_working_day_not_established');
  assert.equal(u.startSlippageWorkingDays,null);
});

test('T06 a started activity: start slippage is planned start to actual start on its own calendar',()=>{
  const r=rows(model([
    activity('S','C12',{status:'in_progress',actualStartIso:SUN,currentStartIso:SUN,percentComplete:5}),
    activity('SNB','C12',{status:'in_progress',actualStartIso:SUN,currentStartIso:SUN,baselineStartIso:null,baselineFinishIso:null,percentComplete:5}),
    activity('F','C12',{currentStartIso:'2031-01-09T06:00:00Z'})]));
  const s=r.get('S'),nb=r.get('SNB'),f=r.get('F');
  assert.equal(s.startOverdueCalendarDays,0,'started work is not start-overdue (unchanged)');
  assert.equal(s.startSlippageCalendarDays,3);
  assert.equal(s.startSlippageWorkingDays,1);
  assert.equal(s.startSlippageDatePair,'planned_start_to_actual_start');
  assert.equal(nb.startSlippageWorkingDays,null,'no planned start: not established, never zero');
  assert.equal(nb.startSlippageDaysBasis,'planned_start_not_established');
  assert.equal(f.startSlippageWorkingDays,0,'a start still in the future has not slipped at the Data Date');
  assert.equal(f.startSlippageDaysBasis,'not_due_at_data_date');
});

test('T06 completion delay counts working days on the completion milestone calendar; LD days unchanged',()=>{
  const m=model([activity('A','C12',{}),activity('PC','C12',{name:'Practical Completion',activityType:'finish_milestone',
    currentStartIso:'2031-03-02T18:00:00Z',currentFinishIso:'2031-03-02T18:00:00Z'})]);
  const completion=completionDelayCalendar(m,null);
  assert.equal(completion.basis,'completion_milestone_calendar');
  assert.equal(completion.activityId,'PC');
  assert.equal(completion.calendarId,'C12');
  // Adjusted completion Thursday 2 Jan, forecast Sunday 5 Jan: 3 elapsed days, 1 working day (Thursday).
  assert.deepEqual(completionDelayWorkingDays(3,'2031-01-02','2031-01-05',completion),{workingDays:1,basis:'completion_milestone_calendar'});
  assert.deepEqual(completionDelayWorkingDays(0,'2031-01-05','2031-01-02',completion),{workingDays:0,basis:'no_delay'});
  assert.deepEqual(completionDelayWorkingDays(null,null,'2031-01-05',completion),{workingDays:null,basis:'unavailable'});
  const unread=completionDelayCalendar(model([activity('PC','UNREAD',{name:'Practical Completion',activityType:'finish_milestone'})]),null);
  assert.equal(completionDelayWorkingDays(3,'2031-01-02','2031-01-05',unread).workingDays,null,'unread completion calendar stays unknown');
  const none=completionDelayCalendar(model([activity('A','C12',{})]),null);
  assert.equal(none.basis,'completion_calendar_not_established');
  assert.deepEqual(completionDelayWorkingDays(3,'2031-01-02','2031-01-05',none),{workingDays:null,basis:'completion_calendar_not_established'});
});

test('T06 the Director screen shows the completion delay in working days first and states the LD day basis',()=>{
  const html=cmengUatHtml();
  assert.match(html,/function completionDelayText\(ld\)/);
  assert.match(html,/completionDelayText\(d\.ld\)/);
  assert.match(html,/LD counted on calendar days \(contract rate per day or week\)/);
});
