import {parseScheduleTime, type CanonicalScheduleActivity} from '../../schedule-analysis-core/src';

/**
 * T11: select the exact existing controlled-baseline completion without
 * allocating/sorting every full-source activity candidate on cold bundle reads.
 * Locale comparison and last-source-row tie precedence deliberately match the
 * original stable map/filter/sort(...).at(-1) calculation. This is a submitted
 * source position, NOT a formally adopted new programme or a calculated CPM end.
 */
export function latestControlledBaselineCompletion(
  activities:readonly Pick<CanonicalScheduleActivity,'activityId'|'baselineFinishIso'|'currentFinishIso'>[],
):{activityId:string;dateIso:string}|null {
  let latest:{activityId:string;dateIso:string}|null=null;
  for(const activity of activities){
    const dateIso=activity.baselineFinishIso??activity.currentFinishIso;
    if(dateIso===null||!Number.isFinite(parseScheduleTime(dateIso)))continue;
    // Stable ascending original sort: equal dates select the last source row.
    if(latest===null||dateIso.localeCompare(latest.dateIso)>=0){
      latest={activityId:activity.activityId,dateIso};
    }
  }
  return latest;
}
