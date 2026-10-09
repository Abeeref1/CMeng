type LinkedActivity={status:string;totalFloatHours:number|null};

/** Completion is only established when every referenced activity is present.
 * A mixed or broken link set must never become a completed-work clearance. */
export function registerProgrammeContext(activityIds:string[],activities:ReadonlyMap<string,LinkedActivity>){
 const ids=[...new Set(activityIds)],unfinished=ids.filter(id=>activities.has(id)&&activities.get(id)!.status!=='completed');
 const completed=ids.filter(id=>activities.get(id)?.status==='completed'),missing=ids.filter(id=>!activities.has(id));
 const state=unfinished.length?'unfinished_work':missing.length?'links_incomplete':completed.length?'completed_work':'unlinked';
 const floats=unfinished.flatMap(id=>{const value=activities.get(id)!.totalFloatHours;return typeof value==='number'&&Number.isFinite(value)?[value]:[];});
 return {state,activityIds:ids,unfinishedActivityIds:unfinished,completedActivityIds:completed,missingActivityIds:missing,
  label:state==='unfinished_work'?'Unfinished linked work':state==='completed_work'?'Completed linked work':state==='links_incomplete'?'Programme links need review':'No activity link supplied',
  linkedFloatHours:floats.length?Math.min(...floats):null};
}
