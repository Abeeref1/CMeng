import type {ManagementAction} from '../../truth-kernel/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';

/** Preserve any named source owner; otherwise assign an accountable PMC discipline. */
export function pmcRoleOwner(domain:string, sourceOwner:string|null|undefined=null):string {
 const owner=typeof sourceOwner==='string'?sourceOwner.trim():'';
 if(owner&&!/^(not assigned|not recorded|not in source|not established|unassigned|unknown|not supplied|null|undefined|tbd|n\/?a|n-a|n_a|—|-)$/i.test(owner))return owner;
 const scope=domain.toLowerCase();
 if(/risk/.test(scope))return 'PMC Risk Manager — individual not designated';
 if(/rfi|design|submittal/.test(scope))return 'PMC Design Manager — individual not designated';
 if(/ncr|quality|inspection/.test(scope))return 'PMC Quality Manager — individual not designated';
 if(/procurement|material|purchase|supplier/.test(scope))return 'PMC Procurement Manager — individual not designated';
 if(/claim|notice|eot|contract/.test(scope))return 'PMC Contracts Manager — individual not designated';
 if(/bond|insurance|commercial|payment|certificate|cost|variation/.test(scope))return 'PMC Commercial Manager — individual not designated';
 if(/hse|safety|permit/.test(scope))return 'PMC HSE Manager — individual not designated';
 if(/site|delivery|interface|resource|construction/.test(scope))return 'PMC Construction Manager — individual not designated';
 if(/schedule|programme|activity|cpm|float/.test(scope))return 'PMC Planning Engineer — individual not designated';
 return 'PMC Project Controls Manager — individual not designated';
}

/** Display state of an owner value. The stored owner (and every key built from it)
 * is unchanged; a role assigned because no individual is named is shown as a missing
 * owner with its accountable role, never as if it were a named owner. */
export function ownerDisplayState(owner:string|null|undefined):{named:boolean;role:string|null}{
 const text=typeof owner==='string'?owner.trim():'';
 const match=/^(.+?)\s+—\s+individual not designated$/i.exec(text);
 if(match)return {named:false,role:match[1]!.trim()};
 if(!text||/^(not assigned|not recorded|not in source|not established|unassigned|unknown|unknown owner|owner not assigned|owner not recorded|not supplied|null|undefined|tbd|n\/?a|n-a|n_a|—|-)$/i.test(text))return {named:false,role:null};
 return {named:true,role:null};
}

/** T09 A4: the one owner wording for screens, downloads and Ask. An owner sent as
 * missing (null with ownerState / accountableOwnerState 'missing') or still held as a
 * role-only placeholder reads "Owner not set · Accountable role: <role>". Any other
 * value is returned unchanged. The browser script embeds this same function. */
/** T09: the one due-date rule for screens, downloads and Ask. A due date the user
 * assigned (assignmentState 'assigned') is used first; otherwise the action's own due
 * date. Unknown stays null. The browser script embeds this same function. */
export function apiDueIso(row:any,field:string='dueIso'):string|null{
 if(row&&row.assignmentState==='assigned'&&typeof row.assignedDueIso==='string'&&row.assignedDueIso)return row.assignedDueIso;
 const value=row?row[field]:null;
 return typeof value==='string'&&value?value:null;
}

/** T09: overdue = the due date from apiDueIso is before the Data Date and the action is
 * still open. An assigned due date uses the server's assignedOverdue (which also checks
 * that the action is open). Unknown (no due date or no Data Date) stays null. */
export function apiDueOverdue(row:any,dataDateIso:string|null|undefined,field:string='dueIso'):boolean|null{
 if(row&&row.assignmentState==='assigned'&&typeof row.assignedDueIso==='string'&&row.assignedDueIso)return typeof row.assignedOverdue==='boolean'?row.assignedOverdue:null;
 const due=apiDueIso(row,field),dataDate=typeof dataDateIso==='string'&&dataDateIso?dataDateIso.slice(0,10):null;
 return due&&dataDate?due.slice(0,10)<dataDate:null;
}

export function apiOwnerText(row:any,field:string='owner'):unknown{
 if(field==='owner'&&row&&typeof row.assignedOwner==='string'&&row.assignedOwner.trim())return row.assignedOwner.trim();
 const value=row?row[field]:null;
 const state=row?row[field==='accountableOwner'?'accountableOwnerState':'ownerState']:null;
 let role:string|null=null,missing=false;
 if(value==null&&state==='missing'){missing=true;role=typeof row.accountableRole==='string'&&row.accountableRole.trim()?row.accountableRole.trim():null;}
 else if(typeof value==='string'&&(field!=='value'||row.dimension==='owner')){const shown=ownerDisplayState(value);if(!shown.named&&shown.role){missing=true;role=shown.role;}}
 return missing?'Owner not set'+(role?' · Accountable role: '+role:''):value;
}

/** API presentation of owners (T09 A4). A role assigned only because no individual
 * is named is sent as owner null with ownerState 'missing' and its accountableRole.
 * Keys (recordKey, ownerGroupKey, key) are separate fields and are never changed, so
 * identity, grouping and de-duplication stay exactly as calculated. Copy on write:
 * unchanged parts of the response are returned as they are. */
export function presentMissingOwners<T>(body:T):T{
 const memo=new Map<object,unknown>();
 const visit=(value:any,depth:number):any=>{
  if(!value||typeof value!=='object'||depth>64)return value;
  if(memo.has(value))return memo.get(value);
  memo.set(value,value);
  if(Array.isArray(value)){
   let copy:any[]|null=null;
   for(let i=0;i<value.length;i++){const next=visit(value[i],depth+1);if(next!==value[i])(copy??=value.slice())[i]=next;}
   const result=copy??value;memo.set(value,result);return result;
  }
  if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return value;
  let copy:Record<string,unknown>|null=null;
  const set=(key:string,next:unknown)=>{(copy??={...value})[key]=next;};
  for(const key of Object.keys(value)){const next=visit(value[key],depth+1);if(next!==value[key])set(key,next);}
  for(const field of ['owner','accountableOwner'] as const){
   const state=typeof value[field]==='string'?ownerDisplayState(value[field]):null;
   if(!state||state.named||!state.role)continue;
   set(field,null);set(field==='owner'?'ownerState':'accountableOwnerState','missing');
   if(!('accountableRole' in value))set('accountableRole',state.role);
  }
  if(value.dimension==='owner'&&typeof value.value==='string'){
   const state=ownerDisplayState(value.value);
   if(!state.named&&state.role){set('value',null);set('ownerState','missing');if(!('accountableRole' in value))set('accountableRole',state.role);}
  }
  const result=copy??value;memo.set(value,result);return result;
 };
 return visit(body,0) as T;
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
export function prioritizeActions(rows:ManagementAction[],model:CanonicalScheduleModel|null,drivingIds:readonly string[]|null=null,floatAuthority:'independent_cpm'|'source_total_float'='source_total_float',rankingFloatByActivityId?:ReadonlyMap<string,number|null>){
 const activities=new Map(model?.activities.map(a=>[a.activityId,a])??[]),driving=new Set(drivingIds??[]);
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
  const lowestLinkedFloat=floats.length?Math.min(...floats):null;
  // T06: the linked activity carrying the lowest float supplies its own calendar for working days.
  const linkedFloatActivityId=lowestLinkedFloat===null?null:linked.find(a=>(rankingFloatByActivityId?.has(a.activityId)?rankingFloatByActivityId.get(a.activityId)!:a.totalFloatHours)===lowestLinkedFloat)?.activityId??null;
  const drivingPath=drivingIds!==null&&row.affectedScope.some(id=>activities.has(id))?linked.some(a=>driving.has(a.activityId)):null;
  return {...row,priorityBasis:{linkedFloatHours:lowestLinkedFloat,linkedFloatActivityId,linkedFloatCalendarIds:[...new Set(linked.filter(a=>(rankingFloatByActivityId?.has(a.activityId)?rankingFloatByActivityId.get(a.activityId)!:a.totalFloatHours)!==null).map(a=>a.calendarId??null))],floatAuthority,drivingPath,milestoneCount:row.affectedMilestones.length+linked.filter(a=>a.activityType==='start_milestone'||a.activityType==='finish_milestone').length,moneyAtRisk:row.moneyAtRisk??[],safety:safetyAction(row)}};
 }).sort((a,b)=>
  (a.priorityBasis.linkedFloatHours??Infinity)-(b.priorityBasis.linkedFloatHours??Infinity)||
  Number(b.priorityBasis.drivingPath)-Number(a.priorityBasis.drivingPath)||
  b.priorityBasis.milestoneCount-a.priorityBasis.milestoneCount||
  Number(b.priorityBasis.moneyAtRisk.some(m=>m.amount>0))-Number(a.priorityBasis.moneyAtRisk.some(m=>m.amount>0))||
  (a.priorityBasis.moneyAtRisk.length===1&&b.priorityBasis.moneyAtRisk.length===1&&a.priorityBasis.moneyAtRisk[0]!.currency===b.priorityBasis.moneyAtRisk[0]!.currency?b.priorityBasis.moneyAtRisk[0]!.amount-a.priorityBasis.moneyAtRisk[0]!.amount:0)||
  // F51: consequence order is completion (float, driving path, milestones), then money, then safety.
  Number(b.priorityBasis.safety)-Number(a.priorityBasis.safety)||
  severity[a.severity]-severity[b.severity]||
  (a.dueIso??'9999').localeCompare(b.dueIso??'9999')||a.actionId.localeCompare(b.actionId));
}

/** F51: a safety consequence (HSE, permit, incident or safety record) is read from
 * the action's own register identity, never from its wording. */
export function safetyAction(row:Pick<ManagementAction,'recordKey'|'owningModule'>):boolean{
 const kind=String(row.recordKey??'').split('|')[0]!;
 return /^(?:hse|safety|permit|incident)/i.test(kind)||/(?:^|-)(?:hse|safety|permit|incident)/i.test(String(row.owningModule??''));
}

/** Full-population action groups for register/owner presentation; never count paged rows. */
export function groupActionsByOwnerRegister(actions:ManagementAction[]){
 const groups=new Map<string,{owner:string;register:string;total:number;actionIds:string[]}>();
 for(const action of actions){
   const owner=pmcRoleOwner(action.owningModule??action.recordKey??'project controls',action.owner);
   const recordKind=action.recordKey?.split('|')[0];
   const register=recordKind&&!recordKind.startsWith('accountability-owner-group:')&&recordKind!=='review'
     ?recordKind:action.owningModule??'project controls';
   const key=register+'|'+owner.toLowerCase(),row=groups.get(key)??{owner,register,total:0,actionIds:[]};
   row.total++;row.actionIds.push(action.actionId);groups.set(key,row);
 }
 return [...groups.values()].sort((a,b)=>b.total-a.total||a.register.localeCompare(b.register)||a.owner.localeCompare(b.owner));
}
