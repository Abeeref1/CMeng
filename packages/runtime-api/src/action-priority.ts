import type {ManagementAction} from '../../truth-kernel/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';

/** Preserve any named source owner; otherwise assign an accountable PMC discipline. */
export function pmcRoleOwner(domain:string, sourceOwner:string|null|undefined=null):string {
 const owner=typeof sourceOwner==='string'?sourceOwner.trim():'';
 if(owner&&!/^(not assigned|unassigned|unknown|not supplied|tbd|na|n-a|n_a|-)$/i.test(owner))return owner;
 const scope=domain.toLowerCase();
 if(/rfi|design|submittal/.test(scope))return 'PMC Design Manager';
 if(/ncr|quality|inspection/.test(scope))return 'PMC Quality Manager';
 if(/procurement|material|purchase|supplier/.test(scope))return 'PMC Procurement Manager';
 if(/claim|notice|eot|contract/.test(scope))return 'PMC Contracts Manager';
 if(/bond|insurance|commercial|payment|certificate|cost|variation/.test(scope))return 'PMC Commercial Manager';
 if(/hse|safety|permit/.test(scope))return 'PMC HSE Manager';
 if(/site|delivery|interface|resource|construction/.test(scope))return 'PMC Construction Manager';
 if(/schedule|programme|activity|cpm|float/.test(scope))return 'PMC Planning Engineer';
 return 'PMC Project Controls Manager';
}

export function actionRecordKey(domain:string,reference:string){
 const name=domain.toLowerCase();
 const kind=({design:'rfi',quality:'ncr',package:'procurement',activity:'schedule'} as Record<string,string>)[name]??name;
 return kind+'|'+reference.trim().toLowerCase();
}

/** Connected programme findings with the same owner form one recovery task.
 * Source RFIs, NCRs and procurement records always retain their own action. */
export function consolidateScheduleChains(rows:ManagementAction[],model:CanonicalScheduleModel|null){
 rows=rows.map(row=>({...row,owner:pmcRoleOwner(row.recordKey??row.issue,row.owner)}));
 if(!model)return rows;
 const activityIds=new Set(model.activities.map(activity=>activity.activityId));
 const byActivity=new Map(rows.flatMap(row=>{
  if(!row.recordKey?.startsWith('schedule|'))return [];
  const ids=row.affectedScope.filter(id=>activityIds.has(id));
  return ids.length===1?[[ids[0]!,row] as const]:[];
 }));
 const parents=new Map([...byActivity.keys()].map(id=>[id,id]));
 const root=(id:string):string=>{const parent=parents.get(id)!;if(parent===id)return id;const value=root(parent);parents.set(id,value);return value;};
 for(const link of model.relationships){
  const a=byActivity.get(link.predecessorActivityId),b=byActivity.get(link.successorActivityId);
  if(link.external||!a||!b||a.owner!==b.owner||a.organisation!==b.organisation)continue;
  parents.set(root(link.successorActivityId),root(link.predecessorActivityId));
 }
 const groups=new Map<string,ManagementAction[]>();
 for(const [id,row] of byActivity){const key=root(id),group=groups.get(key)??[];group.push(row);groups.set(key,group);}
 const replacements=new Map<string,ManagementAction>();const removed=new Set<string>();
 for(const group of groups.values()){
  if(group.length<2)continue;
  const scope=[...new Set(group.flatMap(row=>row.affectedScope))],ids=scope.filter(id=>activityIds.has(id)).sort(),first=group[0]!,key='schedule-chain|'+ids[0];
  group.forEach(row=>removed.add(row.actionId));
  replacements.set(first.actionId,{...first,actionId:key,recordKey:key,
   issue:'Recover linked programme work · '+ids.length+' activities',affectedScope:scope,
   affectedMilestones:[...new Set(group.flatMap(row=>row.affectedMilestones))],
   requiredAction:'Agree one recovery plan covering the '+ids.length+' linked activities; confirm resources, sequencing and the forecast finish.',
   consequence:'Connected programme exceptions are one recovery task. Every affected activity remains available in Activity Review.',
   dueIso:group.flatMap(row=>row.dueIso?[row.dueIso]:[]).sort()[0]??null,
   sourceRefs:[...new Set(group.flatMap(row=>row.sourceRefs))],
   severity:group.some(row=>row.severity==='critical')?'critical':group.some(row=>row.severity==='high')?'high':first.severity});
 }
 return rows.flatMap(row=>replacements.has(row.actionId)?[replacements.get(row.actionId)!]:removed.has(row.actionId)?[]:[row]);
}

/** One source record can create several findings. Merge its findings and retain
 * every source receipt, then rank the result by linked programme consequence. */
export function prioritizeActions(rows:ManagementAction[],model:CanonicalScheduleModel|null,drivingIds:readonly string[]=[],floatAuthority:'independent_cpm'|'source_total_float'='source_total_float',rankingFloatByActivityId?:ReadonlyMap<string,number|null>){
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
   moneyAtRisk:[...new Map([...(previous.moneyAtRisk??[]),...(row.moneyAtRisk??[])].map(m=>[m.currency+'|'+m.amount,m])).values()],
   dueIso:[previous.dueIso,row.dueIso].filter((x):x is string=>!!x).sort()[0]??null,
   requiredAction:[...new Set([previous.requiredAction,row.requiredAction])].join(' '),
   consequence:[...new Set([previous.consequence,row.consequence].filter(Boolean))].join(' ')||null,
  }:row);
 }
 const severity={critical:0,high:1,medium:2,low:3,information:4};
 return [...unique.values()].map(row=>{
  row={...row,owner:pmcRoleOwner(row.recordKey??row.issue,row.owner)};
  const linked=row.affectedScope.flatMap(id=>{const a=activities.get(id);return a&&a.status!=='completed'?[a]:[];});
  const floats=linked.flatMap(a=>{const value=rankingFloatByActivityId?.has(a.activityId)?rankingFloatByActivityId.get(a.activityId)!:a.totalFloatHours;return value===null?[]:[value];});
  return {...row,priorityBasis:{linkedFloatHours:floats.length?Math.min(...floats):null,floatAuthority,drivingPath:linked.some(a=>driving.has(a.activityId)),milestoneCount:row.affectedMilestones.length+linked.filter(a=>a.activityType==='start_milestone'||a.activityType==='finish_milestone').length,moneyAtRisk:row.moneyAtRisk??[]}};
 }).sort((a,b)=>
  (a.priorityBasis.linkedFloatHours??Infinity)-(b.priorityBasis.linkedFloatHours??Infinity)||
  Number(b.priorityBasis.drivingPath)-Number(a.priorityBasis.drivingPath)||
  b.priorityBasis.milestoneCount-a.priorityBasis.milestoneCount||
  Number(b.priorityBasis.moneyAtRisk.some(m=>m.amount>0))-Number(a.priorityBasis.moneyAtRisk.some(m=>m.amount>0))||
  (a.priorityBasis.moneyAtRisk.length===1&&b.priorityBasis.moneyAtRisk.length===1&&a.priorityBasis.moneyAtRisk[0]!.currency===b.priorityBasis.moneyAtRisk[0]!.currency?b.priorityBasis.moneyAtRisk[0]!.amount-a.priorityBasis.moneyAtRisk[0]!.amount:0)||
  severity[a.severity]-severity[b.severity]||
  (a.dueIso??'9999').localeCompare(b.dueIso??'9999')||a.actionId.localeCompare(b.actionId));
}
