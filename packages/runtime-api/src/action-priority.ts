import type {ManagementAction} from '../../truth-kernel/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';

export function actionRecordKey(domain:string,reference:string){
 const name=domain.toLowerCase();
 const kind=({design:'rfi',quality:'ncr',package:'procurement',activity:'schedule'} as Record<string,string>)[name]??name;
 return kind+'|'+reference.trim().toLowerCase();
}

/** One source record can create several findings. Merge its findings and retain
 * every source receipt, then rank the result by linked programme consequence. */
export function prioritizeActions(rows:ManagementAction[],model:CanonicalScheduleModel|null,drivingIds:readonly string[]=[]){
 const activities=new Map(model?.activities.map(a=>[a.activityId,a])??[]),driving=new Set(drivingIds);
 const unique=new Map<string,ManagementAction>();
 for(const row of rows){
  const key=row.recordKey??[row.issue,row.requiredAction,...row.affectedScope].join('|').toLowerCase().replace(/\s+/g,' ');
  const previous=unique.get(key);
  unique.set(key,previous?{...previous,
   owner:previous.owner??row.owner,organisation:previous.organisation??row.organisation,
   affectedScope:[...new Set([...previous.affectedScope,...row.affectedScope])],
   affectedMilestones:[...new Set([...previous.affectedMilestones,...row.affectedMilestones])],
   sourceRefs:[...new Set([...previous.sourceRefs,...row.sourceRefs])],
   dueIso:[previous.dueIso,row.dueIso].filter((x):x is string=>!!x).sort()[0]??null,
   requiredAction:[...new Set([previous.requiredAction,row.requiredAction])].join(' '),
   consequence:[...new Set([previous.consequence,row.consequence].filter(Boolean))].join(' ')||null,
  }:row);
 }
 const severity={critical:0,high:1,medium:2,low:3,information:4};
 return [...unique.values()].map(row=>{
  const linked=row.affectedScope.flatMap(id=>{const a=activities.get(id);return a&&a.status!=='completed'?[a]:[];});
  const floats=linked.flatMap(a=>a.totalFloatHours===null?[]:[a.totalFloatHours]);
  return {...row,priorityBasis:{linkedFloatHours:floats.length?Math.min(...floats):null,drivingPath:linked.some(a=>driving.has(a.activityId)),milestoneCount:row.affectedMilestones.length+linked.filter(a=>a.activityType==='start_milestone'||a.activityType==='finish_milestone').length}};
 }).sort((a,b)=>
  (a.priorityBasis.linkedFloatHours??Infinity)-(b.priorityBasis.linkedFloatHours??Infinity)||
  Number(b.priorityBasis.drivingPath)-Number(a.priorityBasis.drivingPath)||
  b.priorityBasis.milestoneCount-a.priorityBasis.milestoneCount||
  severity[a.severity]-severity[b.severity]||
  (a.dueIso??'9999').localeCompare(b.dueIso??'9999')||a.actionId.localeCompare(b.actionId));
}
