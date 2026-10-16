type LinkedActivity={status:string;totalFloatHours:number|null;calendarId?:string|null};

/** Completion is only established when every referenced activity is present.
 * A mixed or broken link set must never become a completed-work clearance. */
export function registerProgrammeContext(activityIds:string[],activities:ReadonlyMap<string,LinkedActivity>){
 const ids=[...new Set(activityIds)],unfinished=ids.filter(id=>activities.has(id)&&activities.get(id)!.status!=='completed');
 const completed=ids.filter(id=>activities.get(id)?.status==='completed'),missing=ids.filter(id=>!activities.has(id));
 const state=unfinished.length?'unfinished_work':missing.length?'links_incomplete':completed.length?'completed_work':'unlinked';
 const floats=unfinished.flatMap(id=>{const value=activities.get(id)!.totalFloatHours;return typeof value==='number'&&Number.isFinite(value)?[value]:[];});
 return {state,activityIds:ids,unfinishedActivityIds:unfinished,completedActivityIds:completed,missingActivityIds:missing,
  label:state==='unfinished_work'?'Unfinished linked work':state==='completed_work'?'Completed linked work':state==='links_incomplete'?'Programme links need review':'No activity link supplied',
  linkedFloatHours:floats.length?Math.min(...floats):null,
  // T06: the unfinished linked activity carrying the lowest float gives the working-day calendar.
  linkedFloatActivityId:floats.length?unfinished.find(id=>activities.get(id)!.totalFloatHours===Math.min(...floats))??null:null,
  linkedFloatCalendarIds:[...new Set(unfinished.filter(id=>{const v=activities.get(id)!.totalFloatHours;return typeof v==='number'&&Number.isFinite(v);}).map(id=>activities.get(id)!.calendarId??null))]};
}
