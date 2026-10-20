import {countUnit} from './count-text';
import {isExecutionActivity,sourceFloatCriticality,calendarWorkingDayHours,finishVarianceBetween,type CanonicalScheduleModel,type ScheduleAnalysisConfig} from '../../schedule-analysis-core/src';
import {parseScheduleInstant} from '../../schedule-cpm/src/calendar';
import {relationshipLagCalendarBasis} from '../../schedule-cpm/src/lag-calendar';
import type {IndependentForecastProjection} from '../../independent-forecast/src';
import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';
import {reportingState} from './reporting-state';

/** One shared source-calendar working-day basis for float display (T06).
 * First source calendar ID wins, including duplicate IDs. Never substitute a
 * universal eight-hour day when a source calendar is incomplete: the working
 * day length is null and float stays in its original hours with a note. */
const calendarBases=new WeakMap<CanonicalScheduleModel,ReturnType<typeof buildSourceCalendarWorkingDays>>();
export function sourceCalendarWorkingDays(model:CanonicalScheduleModel){
 let basis=calendarBases.get(model);
 if(!basis){basis=buildSourceCalendarWorkingDays(model);calendarBases.set(model,basis);}
 return basis;
}
function buildSourceCalendarWorkingDays(model:CanonicalScheduleModel){
 const calendarById=new Map<string,CanonicalScheduleModel['calendars'][number]>();
 for(const calendar of model.calendars)if(!calendarById.has(calendar.calendarId))calendarById.set(calendar.calendarId,calendar);
 const workingHoursByCalendar=new Map<string|null,number|null>();
 const workingDayHours=(calendarId:string|null)=>{
  if(workingHoursByCalendar.has(calendarId))return workingHoursByCalendar.get(calendarId)!;
  const calendar=calendarId===null?model.calendars.find(row=>row.calendarId===calendarId):calendarById.get(calendarId);
  const hours=calendarWorkingDayHours(calendar);
  workingHoursByCalendar.set(calendarId,hours);
  return hours;
 };
 // First source activity ID wins, as for calendars.
 const activityById=new Map<string,CanonicalScheduleModel['activities'][number]>();
 for(const activity of model.activities)if(!activityById.has(activity.activityId))activityById.set(activity.activityId,activity);
 return {calendarById,workingDayHours,activityById};
}
/** Hours to working days of one source calendar day length. Unknown stays null; zero stays zero. */
export function floatHoursToWorkingDays(hours:number|null|undefined,dayHours:number|null|undefined):number|null{
 return typeof hours==='number'&&Number.isFinite(hours)&&typeof dayHours==='number'&&Number.isFinite(dayHours)&&dayHours>0
  ?Number((hours/dayHours).toFixed(6)):null;
}

/** Narrative text for one activity float: working days of its own source
 * calendar beside the original hours, or hours with an explicit note. */
export function floatHoursText(hours:number,dayHours:number|null|undefined):string{
 const days=floatHoursToWorkingDays(hours,dayHours);
 // Display only: two decimals as on the screen tables; stored values keep full precision.
 // N7: working days with the day type on screen; hours stay in the stored fields.
 return days===null?'working days not established (calendar hours per day not read)':Number(days.toFixed(2))+' '+countUnit(Number(days.toFixed(2)),'working days')+' (activity calendar)';
}

/** T06/N7: relationship lag is shown in working days of the calendar the
 * CMeng CPM counts it on (schedule-cpm relationshipLagCalendarBasis): the
 * calendar the programme states (P6 "Calendar for scheduling Relationship
 * Lag": predecessor, successor, 24-hour or project default), else the
 * successor activity calendar. Unknown activity or unread calendar stays
 * null, never 8 hours. */
export const LAG_DAYS_BASIS='successor_activity_calendar';
export function lagWorkingDays(model:CanonicalScheduleModel,successorActivityId:unknown,hours:number|null|undefined,predecessorActivityId?:unknown){
 const {workingDayHours,activityById}=sourceCalendarWorkingDays(model);
 const rule=relationshipLagCalendarBasis(model);
 const activityDayHours=(id:unknown)=>{const activity=typeof id==='string'?activityById.get(id):undefined;return activity?workingDayHours(activity.calendarId):null;};
 const [dayHours,basis,label]=rule.rule==='predecessor'?[activityDayHours(predecessorActivityId),'predecessor_activity_calendar','predecessor calendar'] as const
  :rule.rule==='24_hour'?[24,'24_hour_calendar','24-hour calendar'] as const
  :rule.rule==='project_default'?[rule.projectDefaultCalendarId===null?null:workingDayHours(rule.projectDefaultCalendarId),'project_default_calendar','project default calendar'] as const
  :[activityDayHours(successorActivityId),LAG_DAYS_BASIS,'successor calendar'] as const;
 return {dayHours,days:floatHoursToWorkingDays(hours,dayHours),label,
  basis:dayHours===null?basis.replace(/_activity_calendar$|_calendar$/,'')+'_calendar_working_day_not_established':basis};
}
/** Plain name of the lag calendar from a lagDaysBasis (or lag rule) value;
 * rows without a basis keep the successor calendar, as before. */
export function lagCalendarName(basisOrRule:unknown):string{
 const value=typeof basisOrRule==='string'?basisOrRule:'';
 return value.startsWith('predecessor')?'predecessor calendar':value.startsWith('24_hour')?'24-hour calendar'
  :value.startsWith('project_default')?'project default calendar':'successor calendar';
}
/** Narrative lag text: working days of the lag calendar first, hours second. */
export function lagHoursText(hours:number|null|undefined,dayHours:number|null|undefined,calendarLabel='successor calendar'):string{
 if(typeof hours!=='number'||!Number.isFinite(hours))return 'lag not established';
 const days=floatHoursToWorkingDays(hours,dayHours);
 // N7: working days on screen; the source hours stay as the audit, in the shared "original h" form.
 return days===null?'lag working days not established ('+calendarLabel+' hours per day not read) · '+hours+' original h'
  :'lag '+Number(days.toFixed(2))+' '+countUnit(Number(days.toFixed(2)),'working days')+' ('+calendarLabel+') · '+hours+' original h';
}

/** T06/N7: a delay between two source dates of one activity, in working days
 * of that activity's own source calendar: working hours between the two
 * instants on the calendar (workingHoursBetween, via the shared
 * finishVarianceBetween) divided by that calendar's working-day length.
 * Cached per programme and calendar/date pair, so screens over thousands of
 * rows pay the calendar walk once. Unknown activity, missing date, or a
 * missing, incomplete or unread calendar stays null with its basis. */
export const DELAY_DAYS_BASIS='source_activity_calendar';
const delayCache=new WeakMap<CanonicalScheduleModel,Map<string,{calendarDays:number|null;workingDays:number|null;basis:string}>>();
export function delayWorkingDays(model:CanonicalScheduleModel,activityId:unknown,fromIso:string|null|undefined,toIso:string|null|undefined,
 /** The date reader of the producer whose elapsed days are being matched. */
 reader:'date_parse'|'schedule_instant'='date_parse'){
 const {calendarById,activityById}=sourceCalendarWorkingDays(model);
 const activity=typeof activityId==='string'?activityById.get(activityId):undefined;
 if(!activity)return {calendarDays:null,workingDays:null,basis:'activity_not_in_programme'};
 if(!fromIso||!toIso)return {calendarDays:null,workingDays:null,basis:'dates_not_established'};
 let cache=delayCache.get(model);if(!cache){cache=new Map();delayCache.set(model,cache);}
 const key=reader+'|'+String(activity.calendarId)+'|'+fromIso+'|'+toIso;
 const known=cache.get(key);if(known)return known;
 const read=(iso:string)=>reader==='schedule_instant'?parseScheduleInstant(iso)??Number.NaN:Date.parse(iso);
 const fromMs=read(fromIso),toMs=read(toIso);
 let result:{calendarDays:number|null;workingDays:number|null;basis:string};
 if(!Number.isFinite(fromMs)||!Number.isFinite(toMs))result={calendarDays:null,workingDays:null,basis:'dates_not_established'};
 else{
  const calendar=activity.calendarId===null?undefined:calendarById.get(activity.calendarId);
  let variance:{calendarDays:number;workingDays:number|null};
  try{variance=finishVarianceBetween(fromMs,toMs,calendar);}catch{variance={calendarDays:(toMs-fromMs)/86_400_000,workingDays:null};}
  result={calendarDays:Number(variance.calendarDays.toFixed(6)),workingDays:variance.workingDays,
   basis:variance.workingDays===null?'calendar_working_day_not_established':DELAY_DAYS_BASIS};
 }
 cache.set(key,result);return result;
}
/** The same finish pair the activity analytics use: actual finish when
 * completed, otherwise forecast or current finish, against baseline finish. */
function sourceFinishPair(activity:CanonicalScheduleModel['activities'][number]){
 const to=activity.status==='completed'&&activity.actualFinishIso?activity.actualFinishIso:(activity.forecastFinishIso??activity.currentFinishIso);
 return [activity.baselineFinishIso,to] as const;
}
// Finish slippage fields in elapsed calendar days, keyed to one activity.
const DELAY_FIELDS=['finishVarianceDays','varianceDays'] as const;
/** T06/N7 start slippage. Not started: planned start (current, else forecast
 * start, as the activity analytics read it) to the Data Date. Started: the
 * source planned start (baseline / P6 target start) to the actual start.
 * Working days on the activity's own calendar; the pair is stated. */
function sourceStartSlippagePair(activity:CanonicalScheduleModel['activities'][number],dataDateIso:string|null){
 if(activity.actualStartIso)return {fromIso:activity.baselineStartIso,toIso:activity.actualStartIso,
  pair:activity.baselineStartIso?'planned_start_to_actual_start':'planned_start_not_established',
  plannedStartBasis:activity.baselineDateBasis??(activity.baselineStartIso?'source_baseline_start':null)};
 const planned=activity.currentStartIso??activity.forecastStartIso;
 return {fromIso:planned,toIso:dataDateIso,pair:!planned?'planned_start_not_established':!dataDateIso?'data_date_not_established':'planned_start_to_data_date',
  plannedStartBasis:planned?'current_programme_planned_start':null};
}
/** Overdue at the Data Date, elapsed days from the activity analytics:
 * start (current, else forecast start) and finish (forecast, else current). */
const OVERDUE_FIELDS=[['startOverdueCalendarDays',(a:CanonicalScheduleModel['activities'][number])=>a.currentStartIso??a.forecastStartIso],
 ['finishOverdueCalendarDays',(a:CanonicalScheduleModel['activities'][number])=>a.forecastFinishIso??a.currentFinishIso]] as const;

/** Submitted classifications remain source assertions. Every comparison retains
 * the activity identity and both answers; an aggregate count cannot clear a row. */
const reviewsByVersion=new WeakMap<CanonicalScheduleModel,{version:number;forecast:IndependentForecastProjection;configKey:string;value:any}>();
export function activityFloatReconciliation(model:CanonicalScheduleModel,forecast:IndependentForecastProjection,config:ScheduleAnalysisConfig,sourceVersion?:number){
 const configKey=JSON.stringify(config),prior=reviewsByVersion.get(model);
 if(sourceVersion!==undefined&&prior?.version===sourceVersion&&prior.forecast===forecast&&prior.configKey===configKey)return prior.value as ReturnType<typeof buildActivityFloatReconciliation>;
 const value=buildActivityFloatReconciliation(model,forecast,config);
 if(sourceVersion!==undefined)reviewsByVersion.set(model,{version:sourceVersion,forecast,configKey,value});
 return value;
}
function buildActivityFloatReconciliation(model:CanonicalScheduleModel,forecast:IndependentForecastProjection,config:ScheduleAnalysisConfig){
 const revisionMatches=forecast.sourceRevisionId===model.sourceRevisionId;
 const deterministic=forecast.complete&&forecast.origin==='deterministic_source_calendar'&&revisionMatches;
 const qualifiedScenario=forecast.complete&&forecast.origin==='scenario_with_assumptions'&&revisionMatches;
 const calculated=new Map(forecast.activities.map(row=>[row.activityId,row]));
 const {calendarById,workingDayHours}=sourceCalendarWorkingDays(model);
 const rows=model.activities.filter(isExecutionActivity).map(activity=>{
  const independent=calculated.get(activity.activityId);
  const completed=activity.status==='completed';
  const usable=!completed&&revisionMatches&&forecast.complete&&(deterministic||qualifiedScenario)&&independent?.status==='calculated'&&independent.calendarMode==='source_calendar';
  const independentTotalFloatHours=usable&&typeof independent?.independentTotalFloatHours==='number'&&Number.isFinite(independent.independentTotalFloatHours)?independent.independentTotalFloatHours:null;
  const submittedTotalFloatHours=typeof activity.totalFloatHours==='number'&&Number.isFinite(activity.totalFloatHours)?activity.totalFloatHours:null;
  const submittedCriticality=completed?'not_applicable':sourceFloatCriticality(model,{...activity,totalFloatHours:submittedTotalFloatHours},config,calendarById);
  const independentCriticality=completed?'not_applicable':sourceFloatCriticality(model,{...activity,totalFloatHours:independentTotalFloatHours},config,calendarById);
  const floatDifferenceHours=submittedTotalFloatHours!==null&&independentTotalFloatHours!==null?Number((independentTotalFloatHours-submittedTotalFloatHours).toFixed(6)):null;
  const dayHours=completed?null:workingDayHours(activity.calendarId);
  const toDays=(hours:number|null)=>floatHoursToWorkingDays(hours,dayHours);
  const submittedTotalFloatWorkingDays=toDays(submittedTotalFloatHours);
  const independentTotalFloatWorkingDays=toDays(independentTotalFloatHours);
  const floatDifferenceWorkingDays=toDays(floatDifferenceHours);
  const state=completed?'not_applicable_completed':
   independentTotalFloatHours===null?'independent_not_established':submittedTotalFloatHours===null?'submitted_not_established':
   submittedCriticality!==independentCriticality?'material_difference':'matched';
  const authority=deterministic?'deterministic_source_calendar':qualifiedScenario&&usable?'qualified_scenario_source_calendar':'not_established';
  return {activityId:activity.activityId,name:activity.name,calendarId:activity.calendarId,sourceRevisionId:model.sourceRevisionId,
   submittedTotalFloatHours,independentTotalFloatHours,submittedCriticality,independentCriticality,floatDifferenceHours,
   workingDayHours:dayHours,submittedTotalFloatWorkingDays,independentTotalFloatWorkingDays,floatDifferenceWorkingDays,
   floatDaysBasis:completed?'not_applicable_completed':dayHours===null?'calendar_working_day_not_established':'source_activity_calendar',
   floatReconciliationState:state,floatReviewLabel:state==='material_difference'?'Disputed / under review':state==='matched'&&floatDifferenceHours!==null&&Math.abs(floatDifferenceHours)>0.000001?'Float differs; classification unchanged':state==='matched'?'Reconciled':state==='not_applicable_completed'?'Not applicable · completed':state==='submitted_not_established'?'Submitted float missing':'Independent CPM not established',
   independentCpmAuthority:authority,sourceRefs:[...activity.sourceRefs]};
 });
 const byActivityId=new Map(rows.map(row=>[row.activityId,row]));
 const comparableRows=rows.filter(row=>row.floatReconciliationState!=='not_applicable_completed');
 const scenarioComparable=qualifiedScenario&&comparableRows.some(row=>row.independentCpmAuthority==='qualified_scenario_source_calendar');
 const classificationsDiffer=comparableRows.filter(row=>row.floatReconciliationState==='material_difference');
 const numericOnly=comparableRows.filter(row=>row.floatReconciliationState==='matched'&&row.floatDifferenceHours!==null&&Math.abs(row.floatDifferenceHours)>0.000001);
 const differingRows=classificationsDiffer;
 const commonOffsetHours=comparableRows.length>=10&&numericOnly.length===comparableRows.length&&
   numericOnly.every(row=>row.floatDifferenceHours!==null&&Math.abs(row.floatDifferenceHours!-numericOnly[0]!.floatDifferenceHours!)<=0.000001)
   ?numericOnly[0]!.floatDifferenceHours:null;
 return {byActivityId,summary:{sourceRevisionId:model.sourceRevisionId,independentCpmState:deterministic?'established':scenarioComparable?'qualified_scenario':'not_established',
  sourceActivityCount:rows.length,checkedActivityCount:comparableRows.length,notApplicableCompletedCount:rows.length-comparableRows.length,
  matchedActivityCount:comparableRows.filter(row=>row.floatReconciliationState==='matched').length,
  disputedActivityCount:classificationsDiffer.length,
  totalDifferenceCount:classificationsDiffer.length+numericOnly.length,
  numberOnlyDifferenceCount:numericOnly.length,
  classChangeCount:classificationsDiffer.length,
  notEstablishedCount:comparableRows.filter(row=>!['matched','material_difference'].includes(row.floatReconciliationState)).length,
  criticalityDifferenceCount:classificationsDiffer.length,
  numericDifferenceActivityCount:numericOnly.length,
  differenceActivityCount:classificationsDiffer.length+numericOnly.length,
  numericAuditRows:numericOnly,
  commonOffsetHours,
  unresolvedActivityCount:comparableRows.filter(row=>!['matched','material_difference'].includes(row.floatReconciliationState)).length,
  basis:deterministic
    ?'Submitted total float and CMeng independent source-calendar CPM are compared for the same open activity and revision using the same critical and near-critical thresholds. Completed activities are outside the live float-comparison denominator.'
    :scenarioComparable
      ?'Open-activity submitted float is compared with CMeng source-calendar CPM using the assumptions stated in the calculation. The comparison remains visible as a qualified scenario and is not promoted to official CPM authority. Completed activities are not counted as unresolved float comparisons.'
      :'Independent source-calendar CPM is not established for the comparable open activities. Completed activities are outside the live float-comparison denominator.',
  toleranceHours:0.000001,rows:comparableRows.filter(row=>row.floatReconciliationState!=='matched')}};
}

// The reconciliation projection is immutable for a source version. Reuse its
// transformed subtrees across module views; unchanged source-only subtrees keep
// their identity instead of being deeply copied for every page.
const attachedTrees=new WeakMap<object,WeakMap<object,any>>();
export function attachActivityFloatReconciliation<T>(data:T,review:ReturnType<typeof activityFloatReconciliation>):T&{activityFloatReconciliation:typeof review.summary}{
 const memo=attachedTrees.get(review)??new WeakMap<object,any>();attachedTrees.set(review,memo);
 // T11: memo values are always objects, so one lookup replaces has+get. An
 // object or array without object-valued members (a leaf) cannot be part of a
 // cycle and is recomputed in O(own keys) with the same answer, so an
 // unchanged leaf is not inserted into the weak memo. Anything with an object
 // member, or any changed leaf, is memoised exactly as before.
 const visit=(value:any):any=>{
  if(!value||typeof value!=='object')return value;
  const known=memo.get(value);if(known!==undefined)return known;
  let open=false;
  if(Array.isArray(value)){
   let result:any[]=value;
   for(let i=0;i<value.length;i++){
    const original=value[i];if(!original||typeof original!=='object')continue;
    // Set the unmodified source before descending, containing accidental cycles.
    if(!open){open=true;memo.set(value,value);}
    const child=visit(original);
    if(child!==original){if(result===value)result=value.slice();result[i]=child;}
   }
   if(open)memo.set(value,result);
   return result;
  }
  let result=value;
  for(const key in value){
   if(!Object.hasOwn(value,key))continue;
   const original=value[key];if(!original||typeof original!=='object')continue;
   if(!open){open=true;memo.set(value,value);}
   const child=visit(original);
   if(child!==original){if(result===value)result={...value};result[key]=child;}
  }
  const row=typeof value.activityId==='string'?review.byActivityId.get(value.activityId):undefined;
  if(row&&('criticality' in value||'totalFloatHours' in value)&&(!value.sourceRevisionId||value.sourceRevisionId===row.sourceRevisionId))result={...result,...row};
  if(open||result!==value)memo.set(value,result);
  return result;
 };
 const result={...data} as any;
 for(const key of ['rows','watchlistRows','criticalRows','negativeFloatRows','priorityRows','managementRows','boundaryAudit'])if(result[key])result[key]=visit(result[key]);
 return {...result,activityFloatReconciliation:review.summary};
}

// T06: current float values (one activity, current revision) that reach a
// screen, a download or an Ask answer also carry the same float in working
// days of that activity's own source calendar. Movement between revisions
// (previous float, erosion, shift) is not converted here: it needs both
// revisions' calendars, so it stays in its original hours.
const CURRENT_FLOAT_FIELDS=['totalFloatHours','submittedTotalFloatHours','independentTotalFloatHours','sourceTotalFloatHours',
 'sourceFloatHours','currentFloatHours','submittedFloatHours','freeFloatHours',
 // An activity's own near-critical limit in hours converts with the same calendar.
 'nearCriticalThresholdHours'] as const;
const GROUP_FLOAT_FIELDS=[['lowestFloatHours','lowestFloatCalendarIds'],['worstFloatHours','worstFloatCalendarIds'],['linkedFloatHours','linkedFloatCalendarIds']] as const;
// T06/N7: activity durations in hours carry working days of the same activity
// calendar. A duration is a source fact for completed work too, so it is
// converted whatever the status; unknown calendar stays null with its basis.
const DURATION_FIELDS=['originalDurationHours','remainingDurationHours'] as const;
const daysKey=(field:string)=>field.replace(/Hours$/,'WorkingDays');
/** Returns a copy with working-day float beside every current float in hours
 * that is tied to a source activity. Hours are kept; existing day values are
 * never overwritten; the input is never mutated; unchanged branches keep
 * their identity. Unknown calendar or unknown activity never becomes a day. */
export function attachFloatWorkingDays<T>(data:T,model:CanonicalScheduleModel|null|undefined):T{
 if(!model||!data||typeof data!=='object')return data;
 const {workingDayHours,activityById}=sourceCalendarWorkingDays(model);
 const memo=new WeakMap<object,unknown>();
 const visit=(value:any,depth:number):any=>{
  if(!value||typeof value!=='object'||depth>40)return value;
  if(memo.has(value))return memo.get(value);
  memo.set(value,value);
  let result=value;
  if(Array.isArray(value)){
   for(let i=0;i<value.length;i++){
    const child=visit(value[i],depth+1);
    if(child!==value[i]){if(result===value)result=value.slice();result[i]=child;}
   }
   memo.set(value,result);return result;
  }
  const set=(key:string,next:unknown)=>{if(result===value)result={...value};result[key]=next;};
  for(const key in value){
   if(!Object.hasOwn(value,key))continue;
   const original=value[key];if(!original||typeof original!=='object')continue;
   const child=visit(original,depth+1);
   if(child!==original)set(key,child);
  }
  const daysFor=(activityId:unknown,status?:unknown)=>{
   const activity=typeof activityId==='string'?activityById.get(activityId):undefined;
   if(!activity)return undefined;
   if(activity.status==='completed'||status==='completed')return {dayHours:null,basis:'not_applicable_completed'};
   const dayHours=workingDayHours(activity.calendarId);
   return {dayHours,basis:dayHours===null?'calendar_working_day_not_established':'source_activity_calendar'};
  };
  const own=daysFor(value.activityId,value.status);
  if(own){
   let converted=false;
   for(const field of CURRENT_FLOAT_FIELDS){
    const hours=value[field];
    if(typeof hours!=='number'||!Number.isFinite(hours)||daysKey(field) in value)continue;
    // Rows already carrying the reconciled submitted float in days keep it.
    if(field==='totalFloatHours'&&'submittedTotalFloatWorkingDays' in value&&value.submittedTotalFloatHours===hours)continue;
    set(daysKey(field),floatHoursToWorkingDays(hours,own.dayHours));converted=true;
   }
   if(converted&&!('floatDaysBasis' in value))set('floatDaysBasis',own.basis);
   const durationActivity=activityById.get(value.activityId)!;
   const durationDayHours=workingDayHours(durationActivity.calendarId);
   let durationConverted=false;
   for(const field of DURATION_FIELDS){
    const hours=value[field];
    if(typeof hours!=='number'||!Number.isFinite(hours)||daysKey(field) in value)continue;
    set(daysKey(field),floatHoursToWorkingDays(hours,durationDayHours));durationConverted=true;
   }
   if(durationConverted&&!('durationDaysBasis' in value))
    set('durationDaysBasis',durationDayHours===null?'calendar_working_day_not_established':'source_activity_calendar');
  }
  // T06/N7: finish slippage in elapsed days carries working days of the
  // activity's own calendar (finishVarianceWorkingDays + finishVarianceDaysBasis).
  // Converted only when the source date pair reproduces the row's elapsed
  // days, so a value from another date pair is never relabelled.
  if(own){
   const activity=activityById.get(value.activityId)!;
   for(const field of DELAY_FIELDS){
    const days=value[field],workingKey=field.replace(/Days$/,'WorkingDays'),basisKey=field.replace(/Days$/,'DaysBasis');
    if(typeof days!=='number'||!Number.isFinite(days)||workingKey in value)continue;
    const [fromIso,toIso]=sourceFinishPair(activity);
    const delay=delayWorkingDays(model,activity.activityId,fromIso,toIso);
    const matched=delay.calendarDays!==null&&Math.abs(delay.calendarDays-days)<1e-5;
    set(workingKey,matched?delay.workingDays:null);
    if(!(basisKey in value))set(basisKey,matched?delay.basis:'source_date_pair_not_matched');
   }
   // Overdue at the Data Date: working days twin of each elapsed value. A
   // zero means "not overdue" in the analytics and stays zero.
   for(const [field,dateOf] of OVERDUE_FIELDS){
    const days=value[field],workingKey=field.replace(/CalendarDays$/,'WorkingDays'),basisKey=field.replace(/CalendarDays$/,'DaysBasis');
    if(typeof days!=='number'||!Number.isFinite(days)||workingKey in value)continue;
    if(days===0){set(workingKey,0);if(!(basisKey in value))set(basisKey,'not_overdue_at_data_date');continue;}
    const delay=delayWorkingDays(model,activity.activityId,dateOf(activity),model.dataDateIso,'schedule_instant');
    const matched=delay.calendarDays!==null&&Math.abs(delay.calendarDays-days)<1e-5;
    set(workingKey,matched?delay.workingDays:null);
    if(!(basisKey in value))set(basisKey,matched?delay.basis:'source_date_pair_not_matched');
   }
   // Start slippage beside the overdue figure, on rows that carry it.
   if(typeof value.startOverdueCalendarDays==='number'&&!('startSlippageWorkingDays' in value)){
    const pair=sourceStartSlippagePair(activity,model.dataDateIso);
    const started=!!activity.actualStartIso||activity.status==='in_progress'||activity.status==='completed';
    let calendarDays:number|null=null,workingDays:number|null=null,basis:string,datePair:string=pair.pair;
    if(started&&!activity.actualStartIso){datePair='actual_start_not_established';basis=datePair;}
    else if(!started&&value.startOverdueCalendarDays===0){calendarDays=0;workingDays=0;basis='not_due_at_data_date';}
    else if(pair.pair==='planned_start_to_actual_start'||pair.pair==='planned_start_to_data_date'){
     const delay=delayWorkingDays(model,activity.activityId,pair.fromIso,pair.toIso,'schedule_instant');
     ({calendarDays,workingDays,basis}=delay);
    }else basis=pair.pair;
    set('startSlippageCalendarDays',calendarDays);
    set('startSlippageWorkingDays',workingDays);
    set('startSlippageDaysBasis',basis);
    set('startSlippageDatePair',datePair);
    set('startSlippagePlannedStartBasis',pair.plannedStartBasis);
   }
  }
  // T06/N7: a relationship row's lag carries working days of its successor
  // calendar beside the hours (lagWorkingDays + lagDaysBasis). Only rows that
  // name a successor are converted; existing day values are kept.
  const successorId=typeof value.successorActivityId==='string'?value.successorActivityId:typeof value.successor==='string'?value.successor:null;
  if(successorId!==null&&typeof value.lagHours==='number'&&Number.isFinite(value.lagHours)&&!('lagWorkingDays' in value)){
   const lag=lagWorkingDays(model,successorId,value.lagHours,value.predecessorActivityId??value.predecessor);
   set('lagWorkingDays',lag.days);
   if(!('lagDaysBasis' in value))set('lagDaysBasis',lag.basis);
  }
  // A group value converts only when every float-bearing member activity uses
  // one working-day length; otherwise hours stay with an explicit basis.
  for(const [field,calendarsKey] of GROUP_FLOAT_FIELDS){
   const hours=value[field],calendarIds=value[calendarsKey];
   if(typeof hours!=='number'||!Number.isFinite(hours)||daysKey(field) in value||!Array.isArray(calendarIds)||!calendarIds.length)continue;
   const lengths=new Set(calendarIds.map((id:string|null)=>workingDayHours(id??null)));
   const dayHours=lengths.size===1?[...lengths][0]??null:null;
   set(daysKey(field),floatHoursToWorkingDays(hours,dayHours));
   set(field.replace(/Hours$/,'DaysBasis'),lengths.has(null)?'calendar_working_day_not_established':lengths.size>1?'mixed_calendar_day_lengths':'source_activity_calendar');
  }
  memo.set(value,result);return result;
 };
 return visit(data,0) as T;
}

/** The reporting programme of a project gives the calendars for every screen,
 * download and Ask answer: one shared entry point. */
export function attachProjectFloatWorkingDays<T>(state:ProjectRuntimeState|null|undefined,body:T):T{
 const model=state?projectControlSchedule(reportingState(state))?.revision.model:null;
 return model?attachFloatWorkingDays(body,model):body;
}
