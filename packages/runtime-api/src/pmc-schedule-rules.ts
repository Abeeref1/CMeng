import type {CanonicalScheduleActivity,CanonicalScheduleModel,ScheduleAnalysisConfig} from '../../schedule-analysis-core/src';
import {activityNearCriticalThresholdHours,sourceFloatCriticality} from '../../schedule-analysis-core/src';
import {addWorkingHours,parseScheduleInstant,resolveWorkingCalendar,workingHoursBetween} from '../../schedule-cpm/src/calendar';
import {programmeControlStageClassifier,programmeControlStageLabel} from './management-context';
import {codeGroup,DISCIPLINE_CODE_TYPES,LOCATION_CODE_TYPES} from './schedule-scope-classification';

/** PMC screening rules, not contractual compliance thresholds. BEI follows
 * GAO-16-89G pp.144/188; technical checks follow its Appendix VII categories.
 * https://www.gao.gov/assets/gao-16-89g.pdf */
/** F38 inputs from the same project: the independent CPM forecast (only when
 * publishable) and the source resource model of the current revision. Null =
 * not available, so the dependent results stay unknown. */
type CpmFloatRows=Array<{activityId:string;independentTotalFloatHours:number|null}>;
export interface ProgrammeQualityInputs{
 independentForecast?:{complete:boolean;independentForecastCompletionIso:string|null;drivingNetwork?:{activityIds:string[];finishActivityIds:string[];relationships:Array<{relationshipId:string}>}|undefined;activities?:CpmFloatRows|undefined}|null|undefined;
 resources?:{assignments:Array<{activityId:string}>}|null|undefined;
 /** F38: the project's shared criticality rule (schedule control basis) and the
 * float basis the headline critical counts use. Null = not stated, so the
 * near-critical population and the float erosion stay not established. */
 criticality?:{config:ScheduleAnalysisConfig;thresholdMethod:string;headlineFloatBasis:string}|null|undefined;
 /** F38: the previous dated, adopted revision and its CMeng CPM floats (forecast
 * only when that CPM passes the same publication gate as the current one). */
 previousRevision?:{revisionId:string;label:string|null;model:CanonicalScheduleModel;forecast:{activities:CpmFloatRows}|null;reason?:string|null|undefined}|null|undefined;
}
/** F38 stage of one activity from the programme's own data: a Stage/Phase
 * activity code, else a Discipline/Trade activity code (the SW-27 code rule),
 * else the activity's own WBS element (level 2 or deeper, or level 1 when the
 * WBS has one level), else the existing shared programme-stage name rule with
 * its label. Otherwise not classified; nothing else is guessed. */
const STAGE_CODE_TYPES=[/\bstages?\b/i,/\bphases?\b/i];
export const STAGE_NOT_CLASSIFIED='Not classified';
export const STAGE_NAME_RULE_SOURCE='Programme stage name rule (name match)';
type StageBasis='activity_code'|'wbs'|'name_rule'|'not_classified';
function programmeStageClassifier(model:CanonicalScheduleModel){
 const nodes=new Map(model.wbs.map(node=>[node.wbsId,node]));
 const multiLevel=model.wbs.some(node=>node.parentWbsId!==null&&nodes.has(node.parentWbsId));
 const depth=(id:string)=>{let level=0;const seen=new Set<string>();let node=nodes.get(id);while(node&&!seen.has(node.wbsId)){seen.add(node.wbsId);level++;node=node.parentWbsId?nodes.get(node.parentWbsId):undefined;}return level;};
 const nameRule=programmeControlStageClassifier(model);
 return (activity:CanonicalScheduleActivity)=>{
  const place=codeGroup(activity,LOCATION_CODE_TYPES);
  const location={location:place?.value??null,locationSource:place?.source??null};
  const code=codeGroup(activity,STAGE_CODE_TYPES)??codeGroup(activity,DISCIPLINE_CODE_TYPES);
  if(code)return {stage:code.value,stageSource:code.source,basis:'activity_code' as StageBasis,...location};
  const node=activity.wbsId?nodes.get(activity.wbsId):undefined,level=node?depth(node.wbsId):0;
  const wbsName=node?.name?.trim()||node?.code?.trim()||null;
  if(node&&wbsName&&(level>=2||!multiLevel))return {stage:wbsName,stageSource:'From WBS level '+level,basis:'wbs' as StageBasis,...location};
  const stage=nameRule(activity);
  if(stage!=='other')return {stage:programmeControlStageLabel(stage),stageSource:STAGE_NAME_RULE_SOURCE,basis:'name_rule' as StageBasis,...location};
  return {stage:STAGE_NOT_CLASSIFIED,stageSource:null,basis:'not_classified' as StageBasis,...location};
 };
}
const round6=(value:number)=>Number(value.toFixed(6));
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
 missing_logic:'count of remaining execution activities with no predecessor or no successor (linked to an execution activity or an external activity; level of effort and WBS summary excluded) / remaining execution activities',
 resources:'count of remaining execution task activities with no resource assignment in the source resource model / remaining execution task activities; unknown when no resource model is loaded',
 missed_tasks:'count of detail tasks due by the Data Date under the adopted baseline that are not finished or finished after their baseline finish / detail tasks due by the Data Date (DCMA check 11)',
 leads:'count of relationships with lag < 0 / relationships',
 lags:'count of relationships with lag > 0 / relationships',
 sf_links:'count of start-to-finish relationships / relationships',
 bei:'BEI (Baseline Execution Index) = detail tasks completed by the Data Date / detail tasks baselined (adopted baseline) to finish by the Data Date',
 submitted_cpli:'Submitted finish CPLI = (remaining working hours from the Data Date to the submitted terminal finish + working hours from that finish to the required date) / remaining working hours, on the terminal activity calendar',
 independent_cpli:'Independent CPLI = (working hours from the Data Date to the independent CPM completion + working hours from that completion to the required date) / working hours from the Data Date to the independent CPM completion, on the calendar of the driving finish activity',
 driving_chain:'Driving chain = activities and binding relationships traced back from the independent CPM completion (the CMeng CPM engine drivingNetwork)',
 driving_stage:'Stage of each driving activity = its Stage/Phase activity code, else its Discipline/Trade activity code, else its own WBS element (level 2 or deeper, or level 1 when the WBS has one level), else the shared programme-stage name rule (labelled as a name match); otherwise not classified. Location = its Plot/Zone/Area/Building/Location activity code',
 criticality:'Critical = CMeng CPM total float <= the critical threshold; near-critical = above it and <= the near-critical threshold of the project schedule control basis (working days use each activity calendar)',
 float_erosion:'Float change rate = (current CMeng CPM total float - previous CMeng CPM total float) / working hours between the two Data Dates, on the activity calendar (working days of float per working day elapsed), for remaining activities on the current driving chain or near-critical, matched by activity id',
 turns_critical_by:'Turns critical by = current Data Date + (current total float - critical threshold) / float lost per working hour, in working time of the activity calendar; only while the float is eroding',
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
  report('float_missing','Missing float on remaining work',remaining.filter(a=>a.totalFloatHours===null),remaining.length,'Completed work is excluded from the missing-float count.'),
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
  basis:'Actual completed detail activities divided by detail activities due to finish under the adopted baseline at the Data Date; milestone and summary records excluded.',
  // F38: named, with its formula and, when it cannot be calculated, the reason.
  name:'Baseline Execution Index (BEI)',formula:PROGRAMME_QUALITY_FORMULAS.bei,
  reason:!model?'No current programme.':!cutoff?'The programme has no Data Date.':!detail.length?'The programme has no detail tasks.'
   :!baselineComplete?'The adopted baseline finish is not established for '+(detail.length-baselineKnown.length)+' of '+detail.length+' detail tasks.'
   :unknownActual.length?unknownActual.length+' completed detail tasks have no actual finish.':!planned.length?'No detail task is baselined to finish by the Data Date.':null};
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
 // Logic counts when the other end is an execution activity of this programme or an
 // external (other-project) activity; a link only to level-of-effort or summary rows does not.
 const logicLinks=model?.relationships.filter(r=>r.external||(ids.has(r.predecessorActivityId)&&ids.has(r.successorActivityId)))??[];
 const hasPred=new Set(logicLinks.map(r=>r.successorActivityId)),hasSucc=new Set(logicLinks.map(r=>r.predecessorActivityId));
 const openStarts=remaining.filter(a=>!hasPred.has(a.activityId)),openEnds=remaining.filter(a=>!hasSucc.has(a.activityId));
 checks.push(report('missing_logic','Missing logic (open start or open end)',remaining.filter(a=>!hasPred.has(a.activityId)||!hasSucc.has(a.activityId)),remaining.length,'Remaining execution activities without a predecessor or without a successor; the project start and finish appear here by design and need review, not removal.'));
 const remainingTasks=remaining.filter(a=>a.activityType==='task');
 // A stored resource model without a readable assignment list is not established (unknown), never 0.
 const assigned=Array.isArray(inputs.resources?.assignments)?new Set(inputs.resources!.assignments.map(x=>x.activityId)):null;
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
 // F38: each driving activity labelled with its stage from the programme's own
 // codes and WBS (driving order); consecutive activities of one stage form a segment.
 const activityById=new Map(model?.activities.map(a=>[a.activityId,a])??[]);
 const classifyStage=model&&network?programmeStageClassifier(model):null;
 const stageRows=classifyStage?network!.activityIds.map(id=>{const activity=activityById.get(id);
  return {activityId:id,name:activity?.name??null,...(activity?classifyStage(activity):{stage:STAGE_NOT_CLASSIFIED,stageSource:null,basis:'not_classified' as StageBasis,location:null,locationSource:null})};}):[];
 const stageSegments:Array<{label:string;stage:string;location:string|null;basis:StageBasis;stageSource:string|null;activityCount:number;firstActivityId:string;lastActivityId:string}>=[];
 for(const row of stageRows){
  const label=row.location&&row.location!==row.stage?row.stage+' · '+row.location:row.stage,last=stageSegments.at(-1);
  if(last&&last.label===label){last.activityCount++;last.lastActivityId=row.activityId;}
  else stageSegments.push({label,stage:row.stage,location:row.location,basis:row.basis,stageSource:row.stageSource,activityCount:1,firstActivityId:row.activityId,lastActivityId:row.activityId});
 }
 const stageCount=(basis:StageBasis)=>stageRows.filter(r=>r.basis===basis).length;
 const drivingStages=classifyStage?{state:'calculated' as const,rows:stageRows,segments:stageSegments,segmentCount:stageSegments.length,
   counts:{activityCode:stageCount('activity_code'),wbs:stageCount('wbs'),nameRule:stageCount('name_rule'),notClassified:stageCount('not_classified')},
   nameRuleSource:STAGE_NAME_RULE_SOURCE,formula:PROGRAMME_QUALITY_FORMULAS.driving_stage}
  :{state:'not_established' as const,rows:[] as typeof stageRows,segments:[] as typeof stageSegments,segmentCount:null,counts:null,nameRuleSource:STAGE_NAME_RULE_SOURCE,formula:PROGRAMME_QUALITY_FORMULAS.driving_stage};
 const drivingChain=network?{state:'calculated' as const,source:'independent_cpm' as const,completionIso:forecast!.independentForecastCompletionIso,
   activityCount:network.activityIds.length,activityIds:[...network.activityIds],finishActivityIds:[...network.finishActivityIds],relationshipIds:network.relationships.map(r=>r.relationshipId),formula:PROGRAMME_QUALITY_FORMULAS.driving_chain,stages:drivingStages}
  :{state:'not_established' as const,source:'independent_cpm' as const,completionIso:null,activityCount:null,activityIds:[] as string[],finishActivityIds:[] as string[],relationshipIds:[] as string[],formula:PROGRAMME_QUALITY_FORMULAS.driving_chain,stages:drivingStages,
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
 // F38: the criticality definition is the project's shared rule, stated with
 // its numbers (no new threshold). Working-day limits are shown per calendar.
 const rule=inputs.criticality??null,config=rule?.config??null;
 const thresholdLabel=(method:string)=>method==='explicit_working_days'||method==='explicit_hours'?'stated in the project schedule control basis'
  :method==='cmeng_policy_default'?'CMeng policy default':'threshold source not resolved';
 const calendarRepresentatives=new Map<string|null,typeof remaining[number]>();
 for(const a of remaining)if(!calendarRepresentatives.has(a.calendarId))calendarRepresentatives.set(a.calendarId,a);
 const nearHoursByCalendar=model&&config?[...calendarRepresentatives].map(([calendarId,a])=>{
  const hours=activityNearCriticalThresholdHours(model,a,config,calendars);return {calendarId,hours:hours===null?null:round6(hours)};}):[];
 const workingDayRule=config?.nearCriticalWorkingDays!==undefined&&config?.nearCriticalWorkingDays!==null;
 const criticalityDefinition=config?{state:'stated' as const,
   criticalThresholdHours:config.criticalFloatThresholdHours,
   nearCriticalWorkingDays:workingDayRule?config.nearCriticalWorkingDays!:null,
   nearCriticalThresholdHours:workingDayRule?null:config.nearCriticalFloatThresholdHours,
   nearCriticalHoursByCalendar:nearHoursByCalendar,thresholdMethod:rule!.thresholdMethod,thresholdSource:thresholdLabel(rule!.thresholdMethod),
   headlineFloatBasis:rule!.headlineFloatBasis,
   // N7: the screen text gives float in working days with the day type, never hours;
   // the hour thresholds stay in the stored fields above.
   critical:'critical = total float of '+(config.criticalFloatThresholdHours===0?'0 working days or less':'the critical threshold of the project schedule control basis or less')+' on the CMeng CPM',
   nearCritical:'near-critical = more than '+(config.criticalFloatThresholdHours===0?'0':'the critical threshold')+' and up to '+(workingDayRule
    ?config.nearCriticalWorkingDays+' working days of each activity calendar'
    :'the near-critical threshold of the project schedule control basis, in working days of each activity calendar')+' ('+thresholdLabel(rule!.thresholdMethod)+')',
   formula:PROGRAMME_QUALITY_FORMULAS.criticality}
  :{state:'not_established' as const,reason:'The project criticality rule was not supplied to this calculation.',formula:PROGRAMME_QUALITY_FORMULAS.criticality};
 const floatErosion=programmeFloatErosion(model,remaining,network?{driving:new Set(network.activityIds),floats:forecast?.activities??null,completionIso:forecast!.independentForecastCompletionIso!}:null,
  config,calendars,inputs.previousRevision??null);
 return {state:model?'calculated':'missing',dataDateIso:cutoff,remainingActivityCount:model?remaining.length:null,checks,relationships,relationshipCount:model?relations.length:null,
  formulas:PROGRAMME_QUALITY_FORMULAS,logic:{openStartActivityIds:openStarts.map(a=>a.activityId),openEndActivityIds:openEnds.map(a=>a.activityId)},
  sfRelationshipIds:sfLinks.map(r=>r.relationshipId),drivingChain,independentCpli,criticalityDefinition,floatErosion,
  positiveLags:lagRows(h=>h>0),negativeLags:lagRows(h=>h<0),unknownLagRelationshipIds:relations.filter(r=>r.lagHours===null).map(r=>r.relationshipId),bei,cpli,updateGaps,
  basis:'Screening results identify records to review. They are not contractual acceptance rules. Thresholds: 44 working days for high float/duration; 45 calendar days between updates.'};
}

type FloatErosionState='eroding'|'not_eroding'|'already_critical'|'not_comparable';
interface FloatErosionRow{activityId:string;name:string|null;onDrivingChain:boolean;calendarId:string|null;previousFloatHours:number|null;currentFloatHours:number|null;
 floatChangeHours:number|null;elapsedWorkingHours:number|null;floatChangePerElapsedWorkingDay:number|null;state:FloatErosionState;turnsCriticalByIso:string|null;reason:string|null}
/** F38 float erosion between the previous and the current dated revision, on the
 * CMeng CPM total float of both revisions, for the remaining activities on the
 * current driving chain or near-critical under the project's shared rule. Only
 * when both revisions are dated (previous earlier) with a publishable CPM; the
 * rate is per working time of each activity's own calendar. Unknown stays unknown. */
function programmeFloatErosion(model:CanonicalScheduleModel|null,remaining:CanonicalScheduleActivity[],
 current:{driving:Set<string>;floats:CpmFloatRows|null;completionIso:string}|null,config:ScheduleAnalysisConfig|null,
 calendars:ReadonlyMap<string,CanonicalScheduleModel['calendars'][number]>,previous:NonNullable<ProgrammeQualityInputs['previousRevision']>|null){
 const base={formula:PROGRAMME_QUALITY_FORMULAS.float_erosion,turnsCriticalFormula:PROGRAMME_QUALITY_FORMULAS.turns_critical_by,floatBasis:'cmeng_cpm' as const,
  unit:'working days of total float per working day elapsed, on the activity calendar',
  previousRevisionId:previous?.revisionId??null,previousRevisionLabel:previous?.label??null,previousDataDateIso:previous?.model.dataDateIso??null,currentDataDateIso:model?.dataDateIso??null};
 const none=(reason:string)=>({...base,state:'not_established' as const,reason,populationCount:null,populationComplete:null,drivingCount:null,nearCriticalCount:null,matchedCount:null,
  erodingCount:null,notErodingCount:null,alreadyCriticalCount:null,notComparableCount:null,criticalityUnknownActivityIds:[] as string[],
  averageFloatChangePerElapsedWorkingDay:null,earliestTurnsCritical:null as {activityId:string;dateIso:string}|null,rows:[] as FloatErosionRow[]});
 if(!model)return none('No current programme.');
 if(!model.dataDateIso)return none('The current programme has no Data Date.');
 if(!config)return none('The project criticality rule is not available, so the near-critical activities are not established.');
 if(!current?.floats)return none('The CMeng CPM of the current revision is not complete and publishable, so its total floats are not established.');
 if(!previous)return none('No earlier dated, adopted programme revision is available to compare.');
 if(!previous.model.dataDateIso)return none('The previous revision has no Data Date.');
 // Source instants are read as the CPM engine reads them (no offset = UTC).
 const fromMs=parseScheduleInstant(previous.model.dataDateIso),toMs=parseScheduleInstant(model.dataDateIso),completionMs=parseScheduleInstant(current.completionIso)??NaN;
 if(fromMs===null||toMs===null||fromMs>=toMs)return none('The previous revision Data Date is not earlier than the current Data Date.');
 if(!previous.forecast)return none(previous.reason??'The CMeng CPM of the previous revision is not complete and publishable, so its total floats are not established.');
 const now=new Map(current.floats.map(r=>[r.activityId,r.independentTotalFloatHours])),then=new Map(previous.forecast.activities.map(r=>[r.activityId,r.independentTotalFloatHours]));
 const priorById=new Map(previous.model.activities.map(a=>[a.activityId,a]));
 const criticalityUnknown:string[]=[];
 const population=remaining.filter(a=>{
  if(current.driving.has(a.activityId))return true;
  const float=now.get(a.activityId)??null;
  const criticality=float===null?'unknown':sourceFloatCriticality(model,{...a,totalFloatHours:float},config,calendars);
  if(criticality==='unknown')criticalityUnknown.push(a.activityId);
  return criticality==='near_critical';
 });
 const critical=config.criticalFloatThresholdHours,horizonByCalendar=new Map<string|null,number|null>();
 const rows=population.map((a):FloatErosionRow=>{
  const currentFloatHours=now.get(a.activityId)??null;
  const row=(state:FloatErosionState,extra:Partial<FloatErosionRow>):FloatErosionRow=>({activityId:a.activityId,name:a.name,onDrivingChain:current.driving.has(a.activityId),calendarId:a.calendarId,
   previousFloatHours:null,currentFloatHours,floatChangeHours:null,elapsedWorkingHours:null,floatChangePerElapsedWorkingDay:null,state,turnsCriticalByIso:null,reason:null,...extra});
  const prior=priorById.get(a.activityId);
  if(!prior)return row('not_comparable',{reason:'Not in the previous revision (no matching activity id).'});
  const previousFloatHours=then.get(a.activityId)??null;
  if(currentFloatHours===null||previousFloatHours===null)return row('not_comparable',{previousFloatHours,reason:'The CMeng CPM total float is not established in both revisions.'});
  if(prior.calendarId!==a.calendarId)return row('not_comparable',{previousFloatHours,reason:'The activity calendar changed between the revisions.'});
  const calendar=resolveWorkingCalendar(a.calendarId,model.calendars,false)?.calendar;
  let elapsed=NaN;if(calendar)try{elapsed=workingHoursBetween(calendar,fromMs,toMs);}catch{elapsed=NaN;}
  if(!calendar||!(elapsed>0))return row('not_comparable',{previousFloatHours,reason:'No readable working time between the two Data Dates on the activity calendar.'});
  const change=currentFloatHours-previousFloatHours,state:FloatErosionState=currentFloatHours<=critical?'already_critical':change<0?'eroding':'not_eroding';
  let turnsCriticalByIso:string|null=null,reason:string|null=null;
  if(state==='eroding'){
   const hours=(currentFloatHours-critical)/(-change/elapsed);
   if(!horizonByCalendar.has(a.calendarId)){let limit:number|null=null;try{limit=Number.isFinite(completionMs)&&completionMs>toMs?workingHoursBetween(calendar,toMs,completionMs):0;}catch{limit=null;}horizonByCalendar.set(a.calendarId,limit);}
   const limit=horizonByCalendar.get(a.calendarId)??null;
   if(limit===null)reason='The working time to the CMeng CPM completion is not established on the activity calendar.';
   else if(hours>limit)reason='At this rate the float lasts beyond the CMeng CPM completion ('+current.completionIso.slice(0,10)+').';
   else try{turnsCriticalByIso=new Date(Math.round(addWorkingHours(calendar,toMs,hours)/1000)*1000).toISOString();}catch{reason='The date could not be placed on the activity calendar.';}
  }
  return row(state,{previousFloatHours,floatChangeHours:round6(change),elapsedWorkingHours:round6(elapsed),floatChangePerElapsedWorkingDay:round6(change/elapsed),turnsCriticalByIso,reason});
 });
 const order:Record<FloatErosionState,number>={eroding:0,not_eroding:1,already_critical:2,not_comparable:3};
 rows.sort((x,y)=>order[x.state]-order[y.state]||(x.turnsCriticalByIso??'9999').localeCompare(y.turnsCriticalByIso??'9999')||x.activityId.localeCompare(y.activityId));
 const matched=rows.filter(r=>r.state!=='not_comparable'),count=(state:FloatErosionState)=>rows.filter(r=>r.state===state).length;
 const first=rows.find(r=>r.turnsCriticalByIso!==null)??null;
 return {...base,state:matched.length?'calculated' as const:'not_established' as const,
  reason:matched.length?null:'No near-critical or driving activity has the same activity id and a CMeng CPM total float in both revisions.',
  populationCount:rows.length,populationComplete:criticalityUnknown.length===0,drivingCount:rows.filter(r=>r.onDrivingChain).length,nearCriticalCount:rows.filter(r=>!r.onDrivingChain).length,
  matchedCount:matched.length,erodingCount:count('eroding'),notErodingCount:count('not_eroding'),alreadyCriticalCount:count('already_critical'),notComparableCount:count('not_comparable'),
  criticalityUnknownActivityIds:criticalityUnknown,
  averageFloatChangePerElapsedWorkingDay:matched.length?round6(matched.reduce((sum,r)=>sum+r.floatChangePerElapsedWorkingDay!,0)/matched.length):null,
  earliestTurnsCritical:first?{activityId:first.activityId,dateIso:first.turnsCriticalByIso!}:null,rows};
}
