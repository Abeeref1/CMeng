import {isExecutionActivity,sourceFloatCriticality,calendarWorkingDayHours,type CanonicalScheduleModel,type ScheduleAnalysisConfig} from '../../schedule-analysis-core/src';
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
 return days===null?hours+' h (working days unknown: calendar hours per day not read)':Number(days.toFixed(2))+' working days ('+hours+' h)';
}

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
   floatReconciliationState:state,floatReviewLabel:state==='material_difference'?'Disputed / under review':state==='matched'&&floatDifferenceHours!==null&&Math.abs(floatDifferenceHours)>0.000001?'Classification matched; numeric difference retained in planner detail':state==='matched'?'Reconciled':state==='not_applicable_completed'?'Not applicable · completed':state==='submitted_not_established'?'Submitted float missing':'Independent CPM not established',
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
      :'Independent source-calendar CPM is not established for the comparable open-activity population. Completed activities are outside the live float-comparison denominator.',
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
