import type {CanonicalScheduleActivity} from '../../schedule-analysis-core/src';

/** Keep the original first-matching source activity semantics on duplicate IDs,
 * but index the full population once rather than scanning every activity for
 * every Milestones row. Never fabricate a calendar when no source matches.
 * Duplicate IDs still require the separate identity-reconciliation review.
 */
export function attachSourceActivityCalendars<T extends {activityId:string}>(
 rows:readonly T[],
 activities:readonly CanonicalScheduleActivity[],
):Array<T & {calendarId:string|null}>{
 const firstById=new Map<string,CanonicalScheduleActivity>();
 for(const activity of activities)
  if(!firstById.has(activity.activityId))
   firstById.set(activity.activityId,activity);
 return rows.map(row=>({...row,calendarId:firstById.get(row.activityId)?.calendarId??null}));
}
