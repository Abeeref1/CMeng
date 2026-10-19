import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {IndependentForecastProjection} from '../../independent-forecast/src';
import type {CompletionDelayCalendar} from '../../project-director/src/types';
import {resolveWorkingCalendar} from '../../schedule-cpm/src/calendar';
import {programmePcMilestone} from './delivery-feasibility';

/** T06/N7: the calendar a completion delay is counted on, by the same rule as
 * the recovery completion gain (recovery-acceleration / recovery-completion-path):
 * the single Programme PC milestone's calendar; where the programme has no
 * single completion milestone, the one source calendar shared by every CPM
 * finish activity. Otherwise not established; no calendar is assumed. */
export function completionDelayCalendar(model:CanonicalScheduleModel|null|undefined,forecast:IndependentForecastProjection|null|undefined):CompletionDelayCalendar{
  const none:CompletionDelayCalendar={activityId:null,calendarId:null,calendar:null,basis:'completion_calendar_not_established'};
  if(!model)return none;
  const activityById=new Map<string,CanonicalScheduleModel['activities'][number]>();
  for(const activity of model.activities)if(!activityById.has(activity.activityId))activityById.set(activity.activityId,activity);
  const pc=programmePcMilestone(model);
  const milestone=pc.activityIds.length===1?activityById.get(pc.activityIds[0]!):undefined;
  if(milestone)return {activityId:milestone.activityId,calendarId:milestone.calendarId,
    calendar:milestone.calendarId===null?null:resolveWorkingCalendar(milestone.calendarId,model.calendars,false)?.calendar??null,
    basis:'completion_milestone_calendar'};
  const finishIds=forecast?.complete&&forecast.drivingNetwork?forecast.drivingNetwork.finishActivityIds??[]:[];
  const calendarIds=[...new Set(finishIds.map(id=>activityById.get(id)?.calendarId??null))];
  if(!finishIds.length||calendarIds.length!==1||calendarIds[0]===null)return none;
  return {activityId:finishIds.length===1?finishIds[0]!:null,calendarId:calendarIds[0]!,
    calendar:resolveWorkingCalendar(calendarIds[0]!,model.calendars,false)?.calendar??null,basis:'cpm_finish_activity_calendar'};
}
