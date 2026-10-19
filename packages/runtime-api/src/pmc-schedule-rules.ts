import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import {resolveWorkingCalendar,workingHoursBetween} from '../../schedule-cpm/src/calendar';

/** PMC screening rules, not contractual compliance thresholds. BEI follows
 * GAO-16-89G pp.144/188; technical checks follow its Appendix VII categories.
 * https://www.gao.gov/assets/gao-16-89g.pdf */
/** F38 inputs from the same project: the independent CPM forecast (only when
 * publishable) and the source resource model of the current revision. Null =
 * not available, so the dependent results stay unknown. */
export interface ProgrammeQualityInputs{
 independentForecast?:{complete:boolean;independentForecastCompletionIso:string|null;drivingNetwork?:{activityIds:string[];finishActivityIds:string[];relationships:Array<{relationshipId:string}>}}|null;
 resources?:{assignments:Array<{activityId:string}>}|null;
}
export const PROGRAMME_QUALITY_FORMULAS={
 constraints:'count of remaining execution activities with any source constraint / remaining execution activities',
 hard_constraints:'count of remaining execution activities with a mandatory (hard) constraint / remaining execution activities',
 high_float:'count of remaining execution activities with source total float / activity-calendar day hours > 44 working days / remaining execution activities',
 negative_float:'count of remaining execution activities with source total float < 0 / remaining execution activities',
 high_duration:'count of remaining execution activities with remaining duration / activity-calendar day hours > 44 working days / remaining execution activities',
 calendar:'count of remaining execution activities without a readable working calendar / remaining execution activities',
 float_missing:'count of remaining execution activities with no source total float / remaining execution activities',
 duration_day_basis_missing:'count of remaining execution activities whose calendar day hours are not stated / remaining execution activities',
 invalid_dates:'count of execution activities with start after finish, or an actual date after the Data Date / execution activities',
 missing_logic:'count of remaining execution activities with no predecessor or no successor inside the programme / remaining execution activities',
 resources:'count of remaining execution task activities with no resource assignment in the source resource model / remaining execution task activities; unknown when no resource model is loaded',
 missed_tasks:'count of detail tasks due by the Data Date under the adopted baseline that are not finished or finished after their baseline finish / detail tasks due by the Data Date (DCMA check 11)',
 leads:'count of relationships with lag < 0 / relationships',
 lags:'count of relationships with lag > 0 / relationships',
 sf_links:'count of start-to-finish relationships / relationships',
 bei:'BEI = detail tasks actually finished by the Data Date / detail tasks with adopted baseline finish on or before the Data Date',
 submitted_cpli:'Submitted finish CPLI = (remaining working hours from the Data Date to the submitted terminal finish + working hours from that finish to the required date) / remaining working hours, on the terminal activity calendar',
 independent_cpli:'Independent CPLI = (working hours from the Data Date to the independent CPM completion + working hours from that completion to the required date) / working hours from the Data Date to the independent CPM completion, on the calendar of the driving finish activity',
 driving_chain:'Driving chain = activities and binding relationships traced back from the independent CPM completion (the CMeng CPM engine drivingNetwork)',
} as const;
export function pmcScheduleRules(model:CanonicalScheduleModel|null,revisions:CanonicalScheduleModel[]=[],requiredFinishIso:string|null=null,inputs:ProgrammeQualityInputs={}){
 const execution=model?.activities.filter(a=>!['level_of_effort','wbs_summary'].includes(a.activityType))??[];
 const remaining=execution.filter(a=>a.status!=='completed'),ids=new Set(execution.map(a=>a.activityId));
 const calendars=new Map(model?.calendars.map(c=>[c.calendarId,c])??[]);
 const relations=model?.relationships.filter(r=>!r.external&&ids.has(r.predecessorActivityId)&&ids.has(r.successorActivityId))??[];
 const dayHours=(a:typeof execution[number])=>{const c=calendars.get(a.calendarId??'');return c?.standardDayHours&&c.standardDayHours>0?c.standardDayHours:null;};
 const calendarValidById=new Map<string|null,boolean>();
 const hasReadableCalendar=(id:string|null)=>{
   if(calendarValidById.has(id))return calendarValidById.get(id)!;
   const valid=!!model&&!!resolveWorkingCalendar(id,model.calendars,false);
   calendarValidById.set(id,valid);return valid;
 };
 const report=(key:string,label:string,rows:typeof execution,population:number,basis:string)=>({key,label,count:model?rows.length:null,population:model?population:null,percent:model&&population?rows.length/population*100:null,activityIds:rows.map(a=>a.activityId),basis});
 const checks:Array<ReturnType<typeof report>&{unknownActivityIds?:string[]}>=[
  report('constraints','Source constraints',remaining.filter(a=>a.sourceConstraints?.length),remaining.length,'All retained source constraint types and dates; review justification.'),
  report('hard_constraints','Mandatory constraints',remaining.filter(a=>a.sourceConstraints?.some(c=>/mandatory|must|^(CS_MSO|CS_MEO|CS_MFO)$/.test(c.type))),remaining.length,'Mandatory start/finish constraints can override normal schedule logic.'),
  report('high_float','High float',remaining.filter(a=>dayHours(a)!==null&&a.totalFloatHours!==null&&a.totalFloatHours/dayHours(a)!>44),remaining.length,'Source total float exceeds 44 activity-calendar working days; CMeng screening threshold.'),
  report('negative_float','Negative float',remaining.filter(a=>a.totalFloatHours!==null&&a.totalFloatHours<0),remaining.length,'Remaining execution activities with total float below zero.'),
  report('high_duration','Long remaining duration',remaining.filter(a=>dayHours(a)!==null&&a.remainingDurationHours!==null&&a.remainingDurationHours/dayHours(a)!>44),remaining.length,'Remaining duration exceeds 44 activity-calendar working days; CMeng screening threshold.'),
  report('calendar','Unreadable or missing calendar',remaining.filter(a=>!hasReadableCalendar(a.calendarId)),remaining.length,'Each remaining execution activity requires an explicit readable working calendar.'),
  report('float_missing','Missing float on remaining work',remaining.filter(a=>a.totalFloatHours===null),remaining.length,'Completed work is excluded from the missing-float population.'),
  report('duration_day_basis_missing','Unresolved working-day conversion',remaining.filter(a=>dayHours(a)===null),remaining.length,'High-float and duration checks cannot convert hours to days for these rows.'),
  report('invalid_dates','Invalid activity dates',execution.filter(a=>
   a.baselineStartIso&&a.baselineFinishIso&&a.baselineStartIso>a.baselineFinishIso||
   a.actualStartIso&&a.actualFinishIso&&a.actualStartIso>a.actualFinishIso||
   model?.dataDateIso&&((a.actualStartIso&&a.actualStartIso.slice(0,10)>model.dataDateIso.slice(0,10))||(a.actualFinishIso&&a.actualFinishIso.slice(0,10)>model.dataDateIso.slice(0,10)))),execution.length,'Start after finish, or an actual date later than the programme Data Date.'),
 ];
 const relationships=['FS','SS','FF','SF','unknown'].map(type=>({type,count:relations.filter(r=>r.type===type).length,relationshipIds:relations.filter(r=>r.type===type).map(r=>r.relationshipId)}));
 const lagRows=(predicate:(hours:number)=>boolean)=>relations.filter(r=>r.lagHours!==null&&predicate(r.lagHours)).map(r=>({relationshipId:r.relationshipId,predecessor:r.predecessorActivityId,successor:r.successorActivityId,type:r.type,lagHours:r.lagHours}));
 const detail=execution.filter(a=>a.activityType==='task'),cutoff=model?.dataDateIso?.slice(0,10)??null;
 const baselineKnown=detail.filter(a=>a.baselineFinishIso&&a.baselineDateBasis!=='xer_target_dates');
 // Per-activity source membership must be linear. Array.includes here created
 // a quadratic scan for every cold first dashboard on large real programmes.
 const baselineKnownSet=new Set(baselineKnown);
 const planned=baselineKnown.filter(a=>cutoff&&a.baselineFinishIso!.slice(0,10)<=cutoff);
 const completed=baselineKnown.filter(a=>cutoff&&a.actualFinishIso&&a.actualFinishIso.slice(0,10)<=cutoff);
 const baselineComplete=detail.length>0&&baselineKnown.length===detail.length;
 const unknownActual=detail.filter(a=>a.status==='completed'&&!a.actualFinishIso).map(a=>a.activityId);
 const bei={value:cutoff&&baselineComplete&&!unknownActual.length&&planned.length?completed.length/planned.length:null,completed:completed.length,planned:planned.length,
  missingBaselineActivityIds:detail.filter(a=>!baselineKnownSet.has(a)).map(a=>a.activityId),missingActualFinishActivityIds:unknownActual,
  basis:'Actual completed detail activities divided by detail activities due to finish under the adopted baseline at the Data Date; milestone and summary records excluded.'};
 const dated=[...new Set(revisions.map(r=>r.dataDateIso?.slice(0,10)).filter((v):v is string=>!!v))].sort();
 const updateGaps=dated.slice(1).map((to,i)=>({from:dated[i]!,to,calendarDays:Math.round((Date.parse(to)-Date.parse(dated[i]!))/86400000)})).filter(g=>g.calendarDays>45);
 // CPLI is kept on the terminal activity's working calendar. Do not mix elapsed
 // days with source working float or select an arbitrary calendar for tied ends.
 const finishes=remaining.flatMap(a=>{const finish=a.forecastFinishIso??a.currentFinishIso;return finish?[{activity:a,finish}]:[];}).sort((a,b)=>b.finish.localeCompare(a.finish));
 const latest=finishes[0],terminals=finishes.filter(a=>a.finish===latest?.finish),calendarIds=new Set(terminals.map(a=>a.activity.calendarId));
 let length:number|null=null,float:number|null=null;
 const calendar=model&&latest&&calendarIds.size===1?resolveWorkingCalendar(latest.activity.calendarId,model.calendars,false)?.calendar:null;
 if(calendar&&cutoff&&latest&&requiredFinishIso){try{length=workingHoursBetween(calendar,Date.parse(cutoff),Date.parse(latest.finish));float=workingHoursBetween(calendar,Date.parse(latest.finish),Date.parse(requiredFinishIso.slice(0,10)+'T23:59:59Z'));}catch{length=null;float=null;}}
 const cpli={value:length!==null&&length>0&&float!==null?(length+float)/length:null,remainingWorkingHours:length,totalFloatWorkingHours:float,finishActivityIds:terminals.map(t=>t.activity.activityId),requiredFinishIso,
  basis:'Submitted finish CPLI = (remaining working time to the terminal finish + working time from that finish to the required date) / remaining working time. Uses one explicit terminal calendar; this source-programme indicator does not certify the independent driving path.'};
 // F38 additions. One shared module; each formula is in PROGRAMME_QUALITY_FORMULAS.
 const hasPred=new Set(relations.map(r=>r.successorActivityId)),hasSucc=new Set(relations.map(r=>r.predecessorActivityId));
 const openStarts=remaining.filter(a=>!hasPred.has(a.activityId)),openEnds=remaining.filter(a=>!hasSucc.has(a.activityId));
 checks.push(report('missing_logic','Missing logic (open start or open end)',remaining.filter(a=>!hasPred.has(a.activityId)||!hasSucc.has(a.activityId)),remaining.length,'Remaining execution activities without a predecessor or without a successor; the project start and finish appear here by design and need review, not removal.'));
 const remainingTasks=remaining.filter(a=>a.activityType==='task');
 const assigned=inputs.resources?new Set(inputs.resources.assignments.map(x=>x.activityId)):null;
 const unresourced=assigned?remainingTasks.filter(a=>!assigned.has(a.activityId)):[];
 checks.push({...report('resources','Remaining tasks without resources',unresourced,remainingTasks.length,assigned?'Remaining execution tasks with no assignment in the source resource model.':'No source resource model is loaded for this revision; the check is not established.'),
  ...(assigned?{}:{count:null,percent:null,activityIds:[]})});
 const missedKnown=planned.filter(a=>a.actualFinishIso||a.status!=='completed');
 const missed=missedKnown.filter(a=>!a.actualFinishIso||a.actualFinishIso.slice(0,10)>a.baselineFinishIso!.slice(0,10));
 const missedUnknown=planned.filter(a=>!a.actualFinishIso&&a.status==='completed');
 checks.push({...report('missed_tasks','Missed tasks (DCMA 11)',missed,planned.length,'Detail tasks due by the Data Date under the adopted baseline that are unfinished or finished after their baseline finish. Completed tasks without an actual finish are unknown, not on time.'),
  ...(model&&cutoff&&baselineComplete&&!missedUnknown.length?{}:{count:null,percent:null}),unknownActivityIds:missedUnknown.map(a=>a.activityId)});
 const sfLinks=relations.filter(r=>r.type==='SF');
 const forecast=inputs.independentForecast??null;
 const network=forecast?.complete&&forecast.independentForecastCompletionIso?forecast.drivingNetwork??null:null;
 const drivingChain=network?{state:'calculated' as const,source:'independent_cpm' as const,completionIso:forecast!.independentForecastCompletionIso,
   activityCount:network.activityIds.length,activityIds:[...network.activityIds],finishActivityIds:[...network.finishActivityIds],relationshipIds:network.relationships.map(r=>r.relationshipId),formula:PROGRAMME_QUALITY_FORMULAS.driving_chain}
  :{state:'not_established' as const,source:'independent_cpm' as const,completionIso:null,activityCount:null,activityIds:[] as string[],finishActivityIds:[] as string[],relationshipIds:[] as string[],formula:PROGRAMME_QUALITY_FORMULAS.driving_chain,
   reason:forecast?'The independent CPM did not reach a complete, publishable completion.':'The independent CPM forecast is not available for this programme.'};
 let iLength:number|null=null,iHeadroom:number|null=null;
 const finishActs=network?network.finishActivityIds.map(id=>model?.activities.find(a=>a.activityId===id)).filter((a):a is NonNullable<typeof a>=>!!a):[];
 const finishCalendarIds=new Set(finishActs.map(a=>a.calendarId));
 const iCalendar=model&&network&&finishActs.length&&finishCalendarIds.size===1?resolveWorkingCalendar(finishActs[0]!.calendarId,model.calendars,false)?.calendar:null;
 if(iCalendar&&model?.dataDateIso&&forecast?.independentForecastCompletionIso&&requiredFinishIso){try{
  const completion=Date.parse(forecast.independentForecastCompletionIso);
  iLength=workingHoursBetween(iCalendar,Date.parse(model.dataDateIso),completion);
  iHeadroom=workingHoursBetween(iCalendar,completion,Date.parse(requiredFinishIso.slice(0,10)+'T23:59:59Z'));}catch{iLength=null;iHeadroom=null;}}
 const independentCpli={value:iLength!==null&&iLength>0&&iHeadroom!==null?(iLength+iHeadroom)/iLength:null,remainingWorkingHours:iLength,totalFloatWorkingHours:iHeadroom,
  completionIso:network?forecast!.independentForecastCompletionIso:null,finishActivityIds:drivingChain.finishActivityIds,requiredFinishIso,formula:PROGRAMME_QUALITY_FORMULAS.independent_cpli,
  basis:iCalendar?'Calculated on the driving finish activity calendar.':network?'Not established: the driving finish activities have no single readable calendar, or the required date or Data Date is missing.':'Not established: no complete independent CPM driving path.'};
 return {state:model?'calculated':'missing',dataDateIso:cutoff,remainingActivityCount:model?remaining.length:null,checks,relationships,relationshipCount:model?relations.length:null,
  formulas:PROGRAMME_QUALITY_FORMULAS,logic:{openStartActivityIds:openStarts.map(a=>a.activityId),openEndActivityIds:openEnds.map(a=>a.activityId)},
  sfRelationshipIds:sfLinks.map(r=>r.relationshipId),drivingChain,independentCpli,
  positiveLags:lagRows(h=>h>0),negativeLags:lagRows(h=>h<0),unknownLagRelationshipIds:relations.filter(r=>r.lagHours===null).map(r=>r.relationshipId),bei,cpli,updateGaps,
  basis:'Screening results identify records to review. They are not contractual acceptance rules. Thresholds: 44 working days for high float/duration; 45 calendar days between updates.'};
}
