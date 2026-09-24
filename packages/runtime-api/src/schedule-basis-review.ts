import {isProgressActivity,calendarWorkingDayHours,type CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import {calculateCpm} from '../../schedule-cpm/src';
import {resolveRevisionActivityCorrespondence} from '../../schedule-revision-core/src';
import type {IndependentForecastProjection} from '../../independent-forecast/src';

const days=(from:string|null,to:string|null)=>from&&to?(Date.parse(to.slice(0,10))-Date.parse(from.slice(0,10)))/86400000:null;
const range=(values:Array<number|null>)=>{const known=values.filter((v):v is number=>v!==null&&Number.isFinite(v));return {min:known.length?Math.min(...known):null,max:known.length?Math.max(...known):null,knownCount:known.length};};
const sourceFinish=(a:CanonicalScheduleModel['activities'][number])=>a.actualFinishIso??a.forecastFinishIso??a.currentFinishIso;
const cache=new WeakMap<CanonicalScheduleModel,Map<string,ReturnType<typeof calculateReview>>>();

/** Partition by actual source calendars and WBS membership, never package number.
 * Contract lateness is a separate comparison from submitted total float. */
export function scheduleBasisReview(model:CanonicalScheduleModel,forecast:IndependentForecastProjection,contractFinish:string|null){
  let byContract=cache.get(model);if(!byContract){byContract=new Map();cache.set(model,byContract);}
  const key=contractFinish??'',old=byContract.get(key);if(old)return old;
  const value=calculateReview(model,forecast,contractFinish);byContract.set(key,value);return value;
}
function calculateReview(model:CanonicalScheduleModel,forecast:IndependentForecastProjection,contractFinish:string|null){
  const parents=new Set(model.wbs.map(w=>w.parentWbsId).filter(Boolean));
  const leaves=model.wbs.filter(w=>!parents.has(w.wbsId));
  const byWbs=new Map<string,typeof model.activities>();
  for(const a of model.activities){if(!a.wbsId)continue;const rows=byWbs.get(a.wbsId)??[];rows.push(a);byWbs.set(a.wbsId,rows);}
  const forecasts=new Map(forecast.activities.map(a=>[a.activityId,a]));
  const rows=leaves.flatMap(w=>{
    const activities=byWbs.get(w.wbsId)??[],tasks=activities.filter(isProgressActivity);
    const finishes=activities.filter(a=>a.activityType==='finish_milestone');
    if(!tasks.length||finishes.length!==1)return [];
    const finish=finishes[0]!,calendars=[...new Set(tasks.map(a=>a.calendarId))];
    const calendarId=calendars.length===1?calendars[0]??null:null;
    const calendar=model.calendars.find(c=>c.calendarId===calendarId);
    const recalculated=forecasts.get(finish.activityId)?.independentEarlyFinishIso??null;
    return [{wbsId:w.wbsId,name:w.name,activityId:finish.activityId,calendarId,calendarName:calendar?.name??null,
      workingDaysPerWeek:calendar?.weeklyWorkMinutes?.filter(n=>n>0).length??null,calendarIds:calendars,
      submittedFinishIso:sourceFinish(finish),calendarFinishIso:recalculated,
      calendarMovementDays:days(sourceFinish(finish),recalculated),contractLatenessDays:days(contractFinish,sourceFinish(finish)),
      submittedFloatHours:finish.totalFloatHours,sourceRefs:finish.sourceRefs}];
  });
  const keys=[...new Set(rows.map(r=>r.calendarId))];
  const groups=keys.map(calendarId=>{const group=rows.filter(r=>r.calendarId===calendarId),dates=group.map(r=>r.calendarFinishIso).filter((v):v is string=>!!v).sort();return {
    calendarId,calendarName:group[0]?.calendarName??'Mixed / unresolved',workingDaysPerWeek:group[0]?.workingDaysPerWeek??null,
    packageCount:group.length,movementDays:range(group.map(r=>r.calendarMovementDays)),earliestCalendarFinishIso:dates[0]??null,latestCalendarFinishIso:dates.at(-1)??null,
    sample:group.slice().sort((a,b)=>(b.calendarMovementDays??-Infinity)-(a.calendarMovementDays??-Infinity)).slice(0,5)};});
  const constraints=model.activities.flatMap(a=>(a.sourceConstraints??[]).map(c=>({activityId:a.activityId,wbsId:a.wbsId,type:c.type,dateIso:c.dateIso,sourceRefs:a.sourceRefs})));
  const constraintGroups=[...new Set(constraints.map(r=>r.type))].map(type=>({type,count:constraints.filter(r=>r.type===type).length,wbsCount:new Set(constraints.filter(r=>r.type===type).map(r=>r.wbsId)).size}));
  const late=rows.filter(r=>r.contractLatenessDays!==null&&r.contractLatenessDays>0);
  // An explicit sensitivity, using an existing six-day calendar with the same
  // day length. No change is made to the supplied model or adopted forecast.
  const five=keys.map(k=>model.calendars.find(c=>c.calendarId===k)).filter(c=>c?.weeklyWorkMinutes?.filter(n=>n>0).length===5);
  const six=keys.map(k=>model.calendars.find(c=>c.calendarId===k)).filter(c=>c?.weeklyWorkMinutes?.filter(n=>n>0).length===6);
  let sensitivity:null|{fromCalendarIds:string[];toCalendarId:string;toCalendarName:string|null;changedActivityCount:number;completionIso:string|null;movementDays:number|null;complete:boolean;assumptions:string[]}=null;
  if(five.length&&six.length===1&&five.every(c=>calendarWorkingDayHours(c!)===calendarWorkingDayHours(six[0]!))){
    const fromIds=new Set(five.map(c=>c!.calendarId)),target=six[0]!;
    const activities=model.activities.map(a=>a.calendarId&&fromIds.has(a.calendarId)?{...a,calendarId:target.calendarId}:a);
    const result=calculateCpm({...model,activities},{durationBasis:forecast.durationBasis});
    sensitivity={fromCalendarIds:[...fromIds],toCalendarId:target.calendarId,toCalendarName:target.name,
      changedActivityCount:activities.filter((a,i)=>a!==model.activities[i]).length,completionIso:result.projectFinishIso,
      movementDays:days(forecast.independentForecastCompletionIso,result.projectFinishIso),complete:result.complete,
      assumptions:['Scenario only: replace assigned five-day calendars with the existing six-day calendar of equal standard day length. Durations, logic, actuals and other calendars are unchanged.','The unconstrained network calculation does not apply retained source date constraints. Confirm the correct calendars with the programme owner.']};
  }
  return {contractFinishIso:contractFinish,packageCount:rows.length,leafWbsCount:leaves.length,excludedLeafCount:leaves.length-rows.length,
    packageDefinition:'Leaf WBS with execution tasks and exactly one finish milestone; other WBS nodes are excluded and counted.',
    groups,rows,constraints,constraintGroups,sensitivity,
    deadline:{lateCount:late.length,positiveFloatButLateCount:late.filter(r=>(r.submittedFloatHours??0)>0).length,latenessDays:range(late.map(r=>r.contractLatenessDays))},
    interpretation:'Submitted float, contractual lateness and calendar-model movement are distinct. A positive submitted float does not establish compliance with the contract date. Calendar partitioning explains model sensitivity, not delay causation or entitlement.'};
}

/** Original-duration edits, not elapsed delay or entitlement. Ambiguous matches
 * and unknown durations remain excluded and are explicitly counted. */
export function durationEditReview(before:CanonicalScheduleModel,after:CanonicalScheduleModel){
  const old=before.activities.filter(isProgressActivity),now=after.activities.filter(isProgressActivity);
  const identity=resolveRevisionActivityCorrespondence(old,now),oldMap=new Map(old.map(a=>[a.activityId,a])),nowMap=new Map(now.map(a=>[a.activityId,a]));
  const matches=identity.matches.map(m=>({before:oldMap.get(m.fromActivityId)!,after:nowMap.get(m.toActivityId)!}));
  const matchedIds=new Set(matches.map(r=>r.after.activityId)),added=now.filter(a=>!matchedIds.has(a.activityId)&&!identity.ambiguousTo.has(a.activityId));
  const comparable=matches.filter(r=>r.before.originalDurationHours!==null&&r.after.originalDurationHours!==null);
  const changes=comparable.map(r=>({activityId:r.after.activityId,wbsId:r.after.wbsId,deltaHours:r.after.originalDurationHours!-r.before.originalDurationHours!,
    standardDayHours:after.calendars.find(c=>c.calendarId===r.after.calendarId)?.standardDayHours??null}));
  const distribution=[...new Set(changes.map(r=>r.deltaHours))].map(deltaHours=>({deltaHours,count:changes.filter(r=>r.deltaHours===deltaHours).length})).sort((a,b)=>b.count-a.count);
  const packages=after.wbs.flatMap(w=>{const m=comparable.filter(r=>r.after.wbsId===w.wbsId),a=added.filter(r=>r.wbsId===w.wbsId);if(!m.length&&!a.length)return [];
    const hours=[...new Set([...m.map(r=>before.calendars.find(c=>c.calendarId===r.before.calendarId)?.standardDayHours),...m.map(r=>after.calendars.find(c=>c.calendarId===r.after.calendarId)?.standardDayHours),...a.map(r=>after.calendars.find(c=>c.calendarId===r.calendarId)?.standardDayHours)])];
    const day=hours.length===1&&hours[0]&&hours[0]>0?hours[0]:null;
    const baselineHours=m.reduce((s,r)=>s+r.before.originalDurationHours!,0),existingHours=m.reduce((s,r)=>s+r.after.originalDurationHours!,0);
    const addedHours=a.every(r=>r.originalDurationHours!==null)?a.reduce((s,r)=>s+r.originalDurationHours!,0):null;
    return [{wbsId:w.wbsId,name:w.name,matchedCount:m.length,addedCount:a.length,changedExistingCount:m.filter(r=>r.before.originalDurationHours!==r.after.originalDurationHours).length,
      baselineHours,existingChangeHours:existingHours-baselineHours,addedHours,standardDayHours:day,
      baselineDurationDays:day?baselineHours/day:null,currentDurationDays:day&&addedHours!==null?(existingHours+addedHours)/day:null,
      existingChangeDays:day?(existingHours-baselineHours)/day:null,addedDays:day&&addedHours!==null?addedHours/day:null}];});
  return {fromRevisionId:before.sourceRevisionId,toRevisionId:after.sourceRevisionId,fromDataDateIso:before.dataDateIso,toDataDateIso:after.dataDateIso,matchedCount:matches.length,comparableCount:comparable.length,
    addedCount:added.length,ambiguousCount:identity.ambiguousFrom.size+identity.ambiguousTo.size,distribution,packages,
    interpretation:'This decomposes original-duration edits and added task budgets. Summed durations are not elapsed delay; concurrency, logic, calendars and cause must be examined separately. Repeated identical edits are a question for the programme owner, not proof of many separate delay events.'};
}
