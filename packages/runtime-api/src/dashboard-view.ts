/**
 * Mechanism 14: the Dashboard screen sends what the Dashboard shows.
 *
 * The browser Dashboard renders the 12 lowest-float driver groups, the first
 * 8 activity IDs of each with the group's activity total, and the completion
 * trend points. The remaining driver groups, activity names and the trend
 * page's own contracts are not shown on the Dashboard; they stay complete in
 * the calculation, in the specialist pages and in Dashboard reports. Every
 * count the Dashboard states keeps its total.
 */
export const DASHBOARD_DRIVER_GROUPS_SHOWN=12;
export const DASHBOARD_GROUP_ACTIVITY_IDS_SHOWN=8;
const TREND_FIELDS_SHOWN=['schemaVersion','projectionKey','points','rows','revisions'] as const;

export function dashboardScreenView<T>(result:T):T{
  const data=(result as any)?.data;
  if(!data||typeof data!=='object')return result;
  const view:any={...data};
  const schedule=data.visualControl?.schedule;
  if(schedule&&Array.isArray(schedule.priorityGroups)){
    view.visualControl={...data.visualControl,schedule:{...schedule,
      priorityGroupTotal:schedule.priorityGroups.length,
      priorityGroups:schedule.priorityGroups.slice(0,DASHBOARD_DRIVER_GROUPS_SHOWN).map((group:any)=>{
        const {activityNames:_names,...shown}=group;
        const ids=Array.isArray(group.activityIds)?group.activityIds:[];
        return {...shown,activityIdTotal:ids.length,activityIds:ids.slice(0,DASHBOARD_GROUP_ACTIVITY_IDS_SHOWN)};
      })}};
  }
  if(data.trend&&typeof data.trend==='object'){
    view.trend=Object.fromEntries(TREND_FIELDS_SHOWN.filter(key=>key in data.trend).map(key=>[key,data.trend[key]]));
  }
  return {...(result as any),data:view};
}
