import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProgressScurveProjection,schedulePlanPositions} from '../packages/progress-scurve/src/projector';
import {statedCalendarWorkBasis} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalCalendar,CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// SW-28: a calendar table that states hours per day (day_hr_cnt / hours_per_day)
// and a calendar name that states days per week (6D, 5D, 7D), but no detailed
// work pattern. Planned progress must use that stated basis, labelled; if either
// value is not stated it stays not established. No 8-hour day is assumed.
const calendar=(calendarId:string,name:string|null,dayHours:number|null,weekHours:number|null=null):CanonicalCalendar=>({
 calendarId,name,semanticComplete:false,weeklyWorkMinutes:[0,0,0,0,0,0,0],weeklyWorkIntervals:[],exceptions:[],
 standardDayHours:null,standardWeekHours:0,sourceConversionDayHours:dayHours,sourceConversionWeekHours:weekHours,sourceRefs:[]});
const model=(cal:CanonicalCalendar):CanonicalScheduleModel=>{
 const projectId='SW28';
 return {projectId,source:'xer',sourceRevisionId:'REV',dataDateIso:'2031-01-15',
  activities:[{projectId,activityId:'A',nativeId:'1',name:'Scope',wbsId:'W',calendarId:cal.calendarId,activityType:'task',status:'in_progress',
   baselineStartIso:'2031-01-01',baselineFinishIso:'2031-01-29',currentStartIso:'2031-01-01',currentFinishIso:'2031-01-29',
   actualStartIso:'2031-01-01',actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
   originalDurationHours:240,remainingDurationHours:120,totalFloatHours:null,freeFloatHours:null,percentComplete:40,sourceRefs:[],diagnostics:[]}],
  relationships:[],wbs:[{wbsId:'W',name:'Work',parentWbsId:null,sourceRefs:[]}],calendars:[cal],diagnostics:[]};
};
const options={generatedAt:'2031-01-15T00:00:00Z',producerVersion:'sw28-test'};

test('SW-28 stated hours per day and days per week give planned progress, labelled as the stated basis',()=>{
 for(const [name,hours,days] of [['6D',10,6],['5D',10,5],['7D',24,7]] as const){
  const cal=calendar('C-'+name,name,hours);
  const basis=statedCalendarWorkBasis(cal.calendarId,[cal]);
  assert.deepEqual(basis,{calendarId:cal.calendarId,hoursPerDay:hours,daysPerWeek:days,weeklyHours:hours*days,basis:'stated_hours_per_day_and_days_per_week'});
  const curve=buildProgressScurveProjection(model(cal),options);
  const at=curve.points.find(p=>p.dateIso.startsWith('2031-01-15'))!;
  // 14 of 28 days at a stated constant weekly rate: half of the planned work.
  assert.ok(at,'data date point retained');
  assert.equal(at.baselinePlannedPercent,50);
  assert.equal(at.currentSchedulePhasingPercent,50);
  assert.equal(curve.currentCoveragePercent,100);
  assert.ok(curve.points.every(p=>p.baselinePlannedPercent!==null),'no blank planned progress');
  assert.ok(curve.diagnostics.includes('PROGRESS_STATED_CALENDAR_BASIS:'+cal.calendarId+':'+hours+'_HOURS_PER_DAY:'+days+'_DAYS_PER_WEEK'));
  assert.ok(curve.diagnostics.includes('SCURVE_STATED_CALENDAR_BASIS_PHASING'));
  assert.ok(!curve.diagnostics.some(d=>d.startsWith('PROGRESS_WORKING_CALENDAR_UNRESOLVED')));
  assert.equal(schedulePlanPositions(model(cal)).current.get('A')?.value,50,'WBS plan positions use the same stated basis');
 }
});

test('SW-28 planned progress stays not established when hours per day or days per week is not stated',()=>{
 const cases:CanonicalCalendar[]=[
  calendar('NO-DAYS','Site calendar',10),       // days per week not stated
  calendar('NO-HOURS','6D',null),               // hours per day not stated: never assume 8
  calendar('TWO-COUNTS','5D / 6D',10),          // conflicting day counts
  calendar('WEEK-CONFLICT','6D',10,40),         // stated week hours contradict 10 x 6
 ];
 for(const cal of cases){
  assert.equal(statedCalendarWorkBasis(cal.calendarId,[cal]),null,cal.calendarId);
  const curve=buildProgressScurveProjection(model(cal),options);
  const at=curve.points.find(p=>p.dateIso.startsWith('2031-01-15'))!;
  assert.equal(at.baselinePlannedPercent,null,cal.calendarId);
  assert.equal(at.currentSchedulePhasingPercent,null,cal.calendarId);
  assert.ok(curve.diagnostics.some(d=>d.startsWith('PROGRESS_WORKING_CALENDAR_UNRESOLVED:')),cal.calendarId);
  assert.ok(!curve.diagnostics.includes('SCURVE_STATED_CALENDAR_BASIS_PHASING'),cal.calendarId);
 }
});
