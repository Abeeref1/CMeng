import {activityPopulation,sourceFloatCriticality,sourceFloatInFloatRiskWatchlist,calendarWorkingDayHours} from '../../schedule-analysis-core/src';
import {projectControlSchedule} from './canonical-time-claims';
import {projectScheduleControlBasis} from './schedule-control-basis';
import type {ProjectRuntimeState} from './project-state-types';

const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof build>}>();
/** Explain a screening count without changing source float or choosing a
 * threshold merely to produce a smaller, more attractive population. */
export function nearCriticalScreening(state:ProjectRuntimeState){
  const previous=cache.get(state);if(previous?.version===state.version)return previous.value;
  const value=build(state);cache.set(state,{version:state.version,value});return value;
}
function build(state:ProjectRuntimeState){
  const model=projectControlSchedule(state)?.revision.model;
  if(!model)return null;
  const basis=projectScheduleControlBasis(state),config=basis.analysisConfig;
  const activities=activityPopulation(model).activities;
  const rows=activities.map(activity=>({activity,classification:sourceFloatCriticality(model,activity,config),watch:sourceFloatInFloatRiskWatchlist(model,activity,config)}));
  const unknown=rows.filter(r=>r.classification==='unknown'||r.watch===null).length;
  const near=rows.filter(r=>r.classification==='near_critical').length;
  const watch=rows.filter(r=>r.watch===true).length;
  const percent=(count:number)=>activities.length&&unknown===0?Math.round(count/activities.length*1000)/10:null;
  const nearPercent=percent(near),watchPercent=percent(watch);
  const authority=basis.nearCriticalThresholdMethod==='cmeng_policy_default'?'cmeng_screening_policy':basis.state==='official'?'project_evidenced_threshold':'threshold_requires_review';
  const threshold=config.nearCriticalWorkingDays!=null?config.nearCriticalWorkingDays+' working days on each activity calendar':config.nearCriticalFloatThresholdHours+' hours';
  const distribution=new Map<number,number>();let unknownWorkingDays=0;
  for(const {activity} of rows){
    const hours=calendarWorkingDayHours(model.calendars.find(c=>c.calendarId===activity.calendarId));
    if(activity.totalFloatHours===null||hours===null){unknownWorkingDays++;continue;}
    const days=Math.round(activity.totalFloatHours/hours*1e6)/1e6;
    distribution.set(days,(distribution.get(days)??0)+1);
  }
  const broad=watchPercent!==null&&watchPercent>50;
  const authorityText=authority==='cmeng_screening_policy'?'CMeng screening only; project threshold unresolved':authority==='project_evidenced_threshold'?'Project-evidenced threshold':'Threshold authority requires review';
  const message=unknown?`${unknown} of ${activities.length} execution activities cannot be fully classified. Whole-population counts and percentages remain unresolved.`
    :`${near} of ${activities.length} execution activities (${nearPercent??'unresolved'}%) are near-critical; the wider watchlist contains ${watch} (${watchPercent??'unresolved'}%).`;
  return {sourceRevisionId:model.sourceRevisionId,authority,threshold,thresholdWorkingDays:config.nearCriticalWorkingDays??null,
    thresholdHours:config.nearCriticalWorkingDays==null?config.nearCriticalFloatThresholdHours:null,
    populationCount:activities.length,unresolvedActivityCount:unknown,nearCriticalCount:unknown?null:near,watchlistCount:unknown?null:watch,
    nearCriticalPercent:nearPercent,watchlistPercent:watchPercent,broadScreening:broad,
    broadScreeningRule:'Advisory review when the watchlist contains more than half of the execution population; this does not alter activity classifications.',
    basis:threshold+' · '+authorityText,
    explanation:message+(broad?' The watchlist covers most of the programme and cannot serve as a short priority list.':''),
    action:'Review negative and zero float, remaining work, upcoming dates and driving paths. Establish the project threshold in the schedule control basis; do not rescale it automatically to reduce the count.',
    floatDistribution: [...distribution].sort((a,b)=>a[0]-b[0]).map(([workingDays,count])=>({workingDays,count})),
    distributionUnresolvedCount:unknownWorkingDays};
}
