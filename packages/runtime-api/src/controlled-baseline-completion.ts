import {parseScheduleTime, type CanonicalScheduleActivity} from '../../schedule-analysis-core/src';

type BaselineActivity=Pick<CanonicalScheduleActivity,'activityId'|'baselineFinishIso'|'currentFinishIso'>;
/**
 * T11 full-source baseline position: original valid-source denominator and
 * original last-equal-date completion selected together in one pass.
 * Retaining validCount is mandatory: management readiness and coverage are
 * meaningful evidence and must not be silently erased for performance.
 */
export function summarizeControlledBaselineCompletion(
  activities:readonly BaselineActivity[],
):{completion:{activityId:string;dateIso:string}|null;validCount:number} {
  let completion:{activityId:string;dateIso:string}|null=null,validCount=0;
  for(const activity of activities){
    const dateIso=activity.baselineFinishIso??activity.currentFinishIso;
    if(dateIso===null||!Number.isFinite(parseScheduleTime(dateIso)))continue;
    validCount++;
    // Original stable locale sort selects last source row for equal valid dates.
    if(completion===null||dateIso.localeCompare(completion.dateIso)>=0){
      completion={activityId:activity.activityId,dateIso};
    }
  }
  return {completion,validCount};
}

/** Standalone source completion consumer of the same immutable full scan. */
export function latestControlledBaselineCompletion(
  activities:readonly BaselineActivity[],
):{activityId:string;dateIso:string}|null {
  return summarizeControlledBaselineCompletion(activities).completion;
}
