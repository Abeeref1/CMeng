import {populationContract} from '../../truth-kernel/src';
import {calendarWorkingDayHours,isExecutionActivity} from '../../schedule-analysis-core/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src/types';
import {workingHoursBetween,parseScheduleInstant,resolveWorkingCalendar} from '../../schedule-cpm/src/calendar';
const cache=new WeakMap<CanonicalScheduleModel,ReturnType<typeof calculateCalendarReview>>();

/** A date/duration reconciliation, not a delay calculation or a replacement calendar. */
export function reviewScheduleCalendarBasis(model:CanonicalScheduleModel) {
  const existing=cache.get(model);if(existing)return existing;
  const value=calculateCalendarReview(model);cache.set(model,value);return value;
}
function calculateCalendarReview(model:CanonicalScheduleModel) {
  const completed=model.activities.filter(a=>isExecutionActivity(a)&&a.status==='completed'&&a.originalDurationHours!==null&&a.originalDurationHours>0);
  const rows=completed.map(a=>{
    const start=parseScheduleInstant(a.actualStartIso),finish=parseScheduleInstant(a.actualFinishIso);
    const calendar=resolveWorkingCalendar(a.calendarId,model.calendars,false)?.calendar;
    const hoursPerDay=calendar?calendarWorkingDayHours(calendar):null;
    let workingHours:number|null=null;
    if(calendar&&start!==null&&finish!==null&&finish>=start){try{workingHours=workingHoursBetween(calendar,start,finish);}catch{/* Unresolved calendars stay explicit. */}}
    const elapsedDays=start!==null&&finish!==null?(finish-start)/86400000:null;
    const elapsedDayHours=elapsedDays!==null&&hoursPerDay!==null?elapsedDays*hoursPerDay:null;
    const same=(a:number|null,b:number|null)=>a!==null&&b!==null&&Math.abs(a-b)<0.000001;
    return {activityId:a.activityId,calendarId:a.calendarId,actualStartIso:a.actualStartIso,actualFinishIso:a.actualFinishIso,
      sourceDurationHours:a.originalDurationHours,assignedCalendarWorkingHours:workingHours,elapsedCalendarDays:elapsedDays,standardDayHours:hoursPerDay,
      matchesElapsedDayConvention:same(a.originalDurationHours,elapsedDayHours),matchesAssignedCalendar:same(a.originalDurationHours,workingHours),
      sourceRefs:a.sourceRefs};
  });
  const comparable=rows.filter(r=>r.assignedCalendarWorkingHours!==null&&r.standardDayHours!==null);
  const patterned=comparable.filter(r=>r.matchesElapsedDayConvention&&!r.matchesAssignedCalendar);
  return {state:patterned.length?'calendar_basis_difference':'no_pattern_detected',sourceRevisionId:model.sourceRevisionId,
    population:{...populationContract({name:'Completed execution tasks with positive source duration',entity:'activity',dataDateIso:model.dataDateIso,dateBasis:'Recorded actual start/finish span and original duration; calendar-pattern reconciliation only',sourceRevisionId:model.sourceRevisionId,authority:'calculated',sourceCount:completed.length,memberIds:comparable.map(r=>r.activityId),exclusions:rows.filter(r=>!comparable.includes(r)).map(r=>({id:r.activityId,reason:'calendar_or_actual_span_unresolved'}))}),excludedCount:completed.length-comparable.length},
    elapsedDayMatchCount:comparable.filter(r=>r.matchesElapsedDayConvention).length,assignedCalendarMismatchCount:comparable.filter(r=>!r.matchesAssignedCalendar).length,
    elapsedDayMismatchCount:patterned.length,
    byCalendar:[...new Set(comparable.map(r=>r.calendarId))].map(calendarId=>{const group=comparable.filter(r=>r.calendarId===calendarId);return {calendarId,name:model.calendars.find(c=>c.calendarId===calendarId)?.name??null,count:group.length,elapsedDayMatchCount:group.filter(r=>r.matchesElapsedDayConvention).length,assignedCalendarMismatchCount:group.filter(r=>!r.matchesAssignedCalendar).length};}),
    interpretation:'Submitted logic recalculated on its own calendars is a model reconciliation scenario. Completed-task actual spans are compared with original source durations; this pattern is not proof of actual working hours, delay causation or entitlement.',
    rows};
}
