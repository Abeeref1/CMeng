import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';

/** A shared, source-preserving schedule-candidate rule. Ordinary manufacturing,
 * materials, vendor and procurement text is not evidence of long-lead scope.
 * These are candidates, never confirmed procurement packages or late orders. */
const explicitLongLead=/\blong[\s_-]*lead\b/i;
export function programmeLongLeadScope(model:Pick<CanonicalScheduleModel,'wbs'|'activities'>){
  const roots=model.wbs.filter(w=>explicitLongLead.test([w.wbsId,w.name].filter(Boolean).join(' ')));
  const children=new Map<string,string[]>();
  for(const w of model.wbs){
    if(!w.parentWbsId)continue;
    const group=children.get(w.parentWbsId)??[];
    group.push(w.wbsId);children.set(w.parentWbsId,group);
  }
  // Iterative, cycle-safe descendant marking: O(WBS + activities).
  const markedWbsIds=new Set<string>(roots.map(w=>w.wbsId));
  const queue=[...markedWbsIds];
  for(let index=0;index<queue.length;index++)
    for(const child of children.get(queue[index]!)??[]){
      if(markedWbsIds.has(child))continue;
      markedWbsIds.add(child);queue.push(child);
    }
  const activityIds=new Set<string>();
  for(const activity of model.activities)
    if(activity.activityType!=='wbs_summary'&&activity.activityType!=='level_of_effort'&&
      ((activity.wbsId!==null&&markedWbsIds.has(activity.wbsId))||explicitLongLead.test(activity.name??'')))
      activityIds.add(activity.activityId);
  return {roots,markedWbsIds,activityIds};
}
