import {parseScheduleInstant} from '../../schedule-cpm/src';
import {readinessForActivity} from '../../lookahead-schedule/src';
import type {ActivityAnalyticsRow} from '../../activity-analytics/src/types';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ModuleRuntimeResult,ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';
import {deliveryPosition} from './delivery-projections';

const numeric=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const difference=(after:string|null,before:string|null)=>{const a=parseScheduleInstant(after),b=parseScheduleInstant(before);return a===null||b===null?null:Number(((a-b)/86400000).toFixed(6));};
const data=(modules:Map<string,ModuleRuntimeResult>,key:string):any=>{const d:any=modules.get(key)?.data;return d?.result??d;};
const shortWbs=(value:string)=>value.split(' / ').slice(-3).join(' / ');
const unfinished=(r:{status:string})=>['not_started','in_progress'].includes(r.status);
const details=new WeakMap<object,any>();
const detailKey=Symbol('cmeng.projectDiagnosisDetails');
/** Keep the first dashboard response bounded; paging/export and Ask use the same
 * retained full projection, not a second calculation or a truncated population. */
export function presentProjectDiagnosis(d:any){if(!d)return null;const {activities,pressureActivityIds,...summary}=d;const shown={...summary,
 network:{...d.network,rows:d.network.rows.slice(0,25),relationships:d.network.relationships.slice(0,50),finishActivityIds:d.network.finishActivityIds.slice(0,25),startReasons:d.network.startReasons.slice(0,25)},
 wbsRows:d.wbsRows.slice(0,25),milestoneRows:d.milestoneRows.slice(0,25),evidenceChecks:d.evidenceChecks.slice(0,25),
 tableTotals:{network:d.network.rows.length,relationships:d.network.relationships.length,wbs:d.wbsRows.length,milestones:d.milestoneRows.length,evidence:d.evidenceChecks.length,actions:d.actions.length}};
 // Object spread in the fact-binding layer preserves symbol properties, while
 // JSON still omits them. Ask and exports must retain the complete population.
 Object.defineProperty(shown,detailKey,{value:d,enumerable:true});
 details.set(shown,d);return shown;}
export function projectDiagnosisDetails(value:any){
 if(!value)return null;
 const full=details.get(value)??value[detailKey];
 return full?{...full,completion:{...full.completion,...value.completion}}:value;
}
const count=(rows:ActivityAnalyticsRow[],test:(r:ActivityAnalyticsRow)=>boolean|null)=>{let known=0,unresolved=0;for(const row of rows){const yes=test(row);if(yes===null)unresolved++;else if(yes)known++;}return {knownCount:rows.length&&unresolved<rows.length?known:null,value:rows.length&&!unresolved?known:null,unresolvedCount:unresolved,population:rows.length};};

/** One project-management answer over the existing, as-of, governed producers.
 * No external model, file-name inference, independent date engine or causal
 * attribution. Complete exception lists remain in their existing authorities. */
export function buildProjectDiagnosis(state:ProjectRuntimeState,modules:Map<string,ModuleRuntimeResult>){
 const model=projectControlSchedule(state)?.revision.model;if(!model)return null;
 const forecast=data(modules,'independent-forecast'),analytics=data(modules,'activity-analytics');
 const rows:ActivityAnalyticsRow[]=(analytics?.rows??[]).filter((r:ActivityAnalyticsRow)=>!['wbs_summary','level_of_effort'].includes(r.activityType));
 const byId=new Map(rows.map(r=>[r.activityId,r])),sourceById=new Map(model.activities.map(r=>[r.activityId,r]));
 const wbsById=new Map(model.wbs.map(w=>[w.wbsId,w])),wbsPaths=new Map<string,string>();
 const wbsPath=(id:string|null)=>{if(!id)return 'WBS not supplied';if(wbsPaths.has(id))return wbsPaths.get(id)!;const names:string[]=[],seen=new Set<string>();let next:string|null=id;while(next&&!seen.has(next)){seen.add(next);const w=wbsById.get(next);names.unshift(w?.name??next);next=w?.parentWbsId??null;}const label=names.join(' / ');wbsPaths.set(id,label);return label;};
 const rawChanges=data(modules,'schedule-change-report');
 const changes=rawChanges?.state==='ready'&&rawChanges.toRevisionId===model.sourceRevisionId?rawChanges:null;
 const changeById=new Map<string,any>((changes?.changedActivities??[]).map((r:any)=>[r.toActivityId??r.activityId,r]));
 const previous=changes?state.schedules.find(s=>s.revision.revisionId===changes.fromRevisionId)?.revision.model:null;
 const previousById=new Map(previous?.activities.map(r=>[r.activityId,r])??[]);
 const network=forecast?.complete?forecast.drivingNetwork:null,drivingIds=new Set<string>(network?.activityIds??[]);
 const calculatedById=new Map<string,any>((forecast?.activities??[]).map((r:any)=>[r.activityId,r]));
 const incoming=new Map<string,CanonicalScheduleModel['relationships']>(),outgoing=new Map<string,CanonicalScheduleModel['relationships']>();
 for(const rel of model.relationships){const ins=incoming.get(rel.successorActivityId)??[];ins.push(rel);incoming.set(rel.successorActivityId,ins);const outs=outgoing.get(rel.predecessorActivityId)??[];outs.push(rel);outgoing.set(rel.predecessorActivityId,outs);}
 const networkIncoming=new Map<string,any[]>(),networkOutgoing=new Map<string,any[]>();
 for(const rel of network?.relationships??[]){const ins=networkIncoming.get(rel.successorActivityId)??[];ins.push(rel);networkIncoming.set(rel.successorActivityId,ins);const outs=networkOutgoing.get(rel.predecessorActivityId)??[];outs.push(rel);networkOutgoing.set(rel.predecessorActivityId,outs);}
 const previousMovement=(id:string)=>{const change=changeById.get(id);return !changes?null:change?change.finishShiftDays:previousById.has(id)?0:null;};
 const describe=(r:ActivityAnalyticsRow)=>({activityId:r.activityId,name:r.name??r.activityId,wbsId:r.wbsId,wbs:wbsPath(r.wbsId),status:r.status,
   baselineFinishIso:r.baselineFinishIso,currentStartIso:r.forecastStartIso??r.currentStartIso,currentFinishIso:r.forecastFinishIso??r.currentFinishIso,
   remainingDurationHours:r.remainingDurationHours,totalFloatHours:r.totalFloatHours,percentComplete:r.percentComplete,
   baselineVarianceCalendarDays:r.finishVarianceDays,previousFinishMovementCalendarDays:previousMovement(r.activityId),
   criticality:r.criticality,missedPlannedStart:r.missedPlannedStart,finishOverdue:r.finishOverdue,scheduleDelayed:r.scheduleDelayed,delayStatus:r.delayStatus,
   onDrivingNetwork:drivingIds.has(r.activityId),predecessors:r.predecessorIds.join('; '),successors:r.successorIds.join('; '),
   constraints:(sourceById.get(r.activityId)?.sourceConstraints??[]).map(c=>c.type+(c.dateIso?' '+c.dateIso:'')).join('; '),
   previousPredecessorSlippage:(incoming.get(r.activityId)??[]).flatMap(rel=>{const movement=previousMovement(rel.predecessorActivityId);return numeric(movement)&&movement>0?[rel.predecessorActivityId+' moved '+movement+' elapsed days later']:[];}).join('; ')});
 const networkRows=(network?.activityIds??[]).flatMap((id:string,index:number)=>{const r=byId.get(id);if(!r)return [];const calculated=calculatedById.get(id);return [{...describe(r),sequence:index+1,
   calculatedStartIso:calculated?.independentEarlyStartIso??null,calculatedFinishIso:calculated?.independentEarlyFinishIso??null,independentTotalFloatHours:calculated?.independentTotalFloatHours??null,
   drivingPredecessors:(networkIncoming.get(id)??[]).map(rel=>rel.predecessorActivityId+' ('+rel.type+', '+rel.lagHours+' h)').join('; '),
   drivingSuccessors:(networkOutgoing.get(id)??[]).map(rel=>rel.successorActivityId+' ('+rel.type+', '+rel.lagHours+' h)').join('; ')}];});
 const counts={critical:count(rows,r=>r.criticality==='unknown'?null:r.criticality==='critical'),negativeFloat:count(rows,r=>numeric(r.totalFloatHours)?r.totalFloatHours<0:null),
   zeroFloat:count(rows,r=>numeric(r.totalFloatHours)?r.totalFloatHours===0:null),nearCritical:count(rows,r=>r.criticality==='unknown'?null:r.criticality==='near_critical'),
   missedStarts:count(rows,r=>r.missedPlannedStart),overdueFinishes:count(rows,r=>r.finishOverdue),baselineSlippage:count(rows,r=>r.finishVarianceDays===null?null:unfinished(r)&&r.finishVarianceDays>0),
   previousUpdateSlippage:count(rows,r=>{const move=previousMovement(r.activityId);return move===null?null:move>0;}),scheduleDelayed:count(rows,r=>r.scheduleDelayed)};
 const pressureRows=rows.filter(r=>unfinished(r)&&(drivingIds.has(r.activityId)||r.criticality==='critical'||r.criticality==='near_critical'||r.scheduleDelayed||(previousMovement(r.activityId)??0)>0));
 const rank=(r:ActivityAnalyticsRow)=>drivingIds.has(r.activityId)?0:numeric(r.totalFloatHours)&&r.totalFloatHours<0?1:r.finishOverdue?2:r.missedPlannedStart?3:r.criticality==='critical'?4:r.criticality==='near_critical'?5:6;
 pressureRows.sort((a,b)=>rank(a)-rank(b)||(a.totalFloatHours??Infinity)-(b.totalFloatHours??Infinity)||(previousMovement(b.activityId)??0)-(previousMovement(a.activityId)??0)||a.activityId.localeCompare(b.activityId));
 const wbsGroups=new Map<string,{wbsId:string|null;wbs:string;activityCount:number;pressureCount:number;drivingCount:number;criticalCount:number;negativeFloatCount:number;nearCriticalCount:number;missedStartCount:number;overdueFinishCount:number;previousSlippageCount:number;worstFloatHours:number|null}>();
 const pressureSet=new Set(pressureRows.map(r=>r.activityId));
 for(const r of rows){const id=r.wbsId??'',g=wbsGroups.get(id)??{wbsId:r.wbsId,wbs:wbsPath(r.wbsId),activityCount:0,pressureCount:0,drivingCount:0,criticalCount:0,negativeFloatCount:0,nearCriticalCount:0,missedStartCount:0,overdueFinishCount:0,previousSlippageCount:0,worstFloatHours:null};
   g.activityCount++;if(pressureSet.has(r.activityId))g.pressureCount++;if(unfinished(r)&&drivingIds.has(r.activityId))g.drivingCount++;if(r.criticality==='critical')g.criticalCount++;if(numeric(r.totalFloatHours)&&r.totalFloatHours<0)g.negativeFloatCount++;if(r.criticality==='near_critical')g.nearCriticalCount++;if(r.missedPlannedStart)g.missedStartCount++;if(r.finishOverdue)g.overdueFinishCount++;if((previousMovement(r.activityId)??0)>0)g.previousSlippageCount++;if(numeric(r.totalFloatHours))g.worstFloatHours=g.worstFloatHours===null?r.totalFloatHours:Math.min(g.worstFloatHours,r.totalFloatHours);wbsGroups.set(id,g);}
 const wbsRows=[...wbsGroups.values()].sort((a,b)=>b.drivingCount-a.drivingCount||b.pressureCount-a.pressureCount||(a.worstFloatHours??Infinity)-(b.worstFloatHours??Infinity)||a.wbs.localeCompare(b.wbs));
 const delivery=deliveryPosition(state),packageIndex=new Map<string,any[]>(),registerIndex=new Map<string,any[]>(),packageById=new Map(delivery.packageRows.map(p=>[p.recordId,p]));
 for(const p of delivery.packageRows)for(const id of p.activityIds){const group=packageIndex.get(id)??[];group.push(p);packageIndex.set(id,group);}
 for(const record of delivery.registerRows){const ids=new Set([...record.links.activityIds,...record.links.packageIds.flatMap(id=>packageById.get(id)?.activityIds??[])]);for(const id of ids){const group=registerIndex.get(id)??[];group.push(record);registerIndex.set(id,group);}}
 const productivity=forecast?.sourceProductivityForecastEvidence??forecast?.sourceProductivityForecast;
 const products=new Map<string,any[]>();for(const p of productivity?.rows??[]){if(!p.linkedActivityId)continue;const list=products.get(p.linkedActivityId)??[];list.push(p);products.set(p.linkedActivityId,list);}
 const events=new Map<string,any[]>();for(const e of state.controls.delayClaims?.events??[])for(const id of e.relatedActivityIds){const list=events.get(id)??[];list.push(e);events.set(id,list);}
 const checks:any[]=[];
 // Assess all schedule pressure activities, including those outside the look-ahead window.
 for(const r of pressureRows){const activity=sourceById.get(r.activityId)!;const readiness=readinessForActivity(model,activity,incoming.get(r.activityId)??[],sourceById,state.controls.readinessEvidence[r.activityId]);
   for(const d of readiness.dimensions)if(d.state==='blocked'&&d.sourceRefs.length)checks.push({activityId:r.activityId,domain:d.key,state:'linked_pressure',recordId:(d.records??[]).map(x=>x.recordId).filter(Boolean).join('; ')||null,explanation:d.note??'A linked record reports a blocker.',sourceRefs:d.sourceRefs});
   for(const p of packageIndex.get(r.activityId)??[])if(numeric(p.headroomCalendarDays)&&p.headroomCalendarDays<0)checks.push({activityId:r.activityId,domain:'procurement_material',state:'linked_pressure',recordId:p.recordId,explanation:p.reference+': delivery forecast '+p.forecastDelivery+' is '+(-p.headroomCalendarDays)+' calendar days after programme need '+p.programmeNeedDate+'.',sourceRefs:p.receipts});
   for(const x of registerIndex.get(r.activityId)??[])if(x.scope==='current'&&(x.overdue===true||['rejected','failed'].includes(x.currentStatus)))checks.push({activityId:r.activityId,domain:x.kind,state:'linked_pressure',recordId:x.recordId,explanation:x.reference+': '+(x.overdue?'overdue':'')+' '+x.currentStatus+'; due '+(x.dueDate??'not supplied')+'.',sourceRefs:x.receipts});
   for(const p of products.get(r.activityId)??[])if(p.state==='official'&&p.completionIso){const move=difference(p.completionIso,r.forecastFinishIso??r.currentFinishIso);if(move!==null&&move>0)checks.push({activityId:r.activityId,domain:'productivity',state:'linked_pressure',recordId:p.workPackageId,explanation:p.workPackageId+': the evidenced productivity finish is '+move+' elapsed days after the activity finish.',sourceRefs:p.sourceRefs});}
   for(const e of events.get(r.activityId)??[])checks.push({activityId:r.activityId,domain:'delay_event',state:'linked_event',recordId:e.eventId,explanation:e.title+'; event starts '+(e.startIso??'not established')+'. This link does not establish an assessed completion effect.',sourceRefs:e.evidenceRefs});
 }
 const uniqueChecks=[...new Map(checks.map(c=>[[c.activityId,c.domain,c.recordId,c.explanation].join('|'),c])).values()];
 const checksByActivity=new Map<string,any[]>();for(const c of uniqueChecks){const list=checksByActivity.get(c.activityId)??[];list.push(c);checksByActivity.set(c.activityId,list);}
 const pressureIds=new Set(pressureRows.map(r=>r.activityId)),parent=new Map([...pressureIds].map(id=>[id,id]));
 const find=(id:string):string=>{const p=parent.get(id)??id;if(p===id)return id;const root=find(p);parent.set(id,root);return root;};
 const unite=(a:string,b:string)=>{const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra);};
 for(const rel of model.relationships)if(pressureIds.has(rel.predecessorActivityId)&&pressureIds.has(rel.successorActivityId))unite(rel.predecessorActivityId,rel.successorActivityId);
 const componentSizes=new Map<string,number>();for(const id of pressureIds){const root=find(id);componentSizes.set(root,(componentSizes.get(root)??0)+1);}
 const family=(r:ActivityAnalyticsRow)=>String(r.name??r.activityId).toLowerCase().replace(/\b\d+\b/g,'#').replace(/\s+/g,' ').trim();
 const actionGroups=new Map<string,{rows:ActivityAnalyticsRow[];linked:any[];movement:number|null;firstRank:number}>();
 pressureRows.forEach((r,index)=>{const movement=previousMovement(r.activityId),linked=checksByActivity.get(r.activityId)??[],root=find(r.activityId),componentSize=componentSizes.get(root)??1;
   const linkedKey=linked.map(c=>c.recordId).filter(Boolean).sort().join('|'),moveKey=numeric(movement)&&movement>0?movement.toFixed(6):null;
   const category=linkedKey?'linked:'+linkedKey:moveKey&&componentSize>1?'revision-chain:'+moveKey+':'+root:moveKey?'revision-family:'+moveKey+':'+family(r):'activity:'+r.activityId;
   const group=actionGroups.get(category)??{rows:[],linked:[],movement:numeric(movement)?movement:null,firstRank:index};group.rows.push(r);group.linked.push(...linked);actionGroups.set(category,group);
 });
 const actions=[...actionGroups.values()].sort((a,b)=>a.firstRank-b.firstRank).slice(0,10).map((group,index)=>{const r=group.rows[0]!,linked=[...new Map(group.linked.map(c=>[[c.domain,c.recordId,c.explanation].join('|'),c])).values()],described=describe(r),wbsLabels=[...new Set(group.rows.map(x=>shortWbs(wbsPath(x.wbsId))))],move=group.movement;
   const groupedCount=group.rows.length,ids=group.rows.map(x=>x.activityId),movementText=numeric(move)&&move>0?(groupedCount+' activities moved '+move+' elapsed days later since the previous adopted revision'):'';
   const individualWhy=[drivingIds.has(r.activityId)?'On the calculated finish-driving network':'',numeric(r.totalFloatHours)&&r.totalFloatHours<0?r.totalFloatHours+' hours source float':'',r.missedPlannedStart?'Should have started':'',r.finishOverdue?'Finish overdue':''].filter(Boolean).join('; ');
   const reason=groupedCount>1?(movementText||groupedCount+' related pressure activities in '+wbsLabels.slice(0,3).join('; ')+(wbsLabels.length>3?' and '+(wbsLabels.length-3)+' more WBS groups':'')):([individualWhy,movementText].filter(Boolean).join('; '));
   const linkedEvidence=!linked.length?'':linked.length===1?linked[0]!.explanation:(linked.length+' linked evidence records are available for this grouped finding.');
   const action=groupedCount>1?'Manage this as one grouped schedule finding; open the activities only when the detailed sequence or ownership is needed.':linked.length?'Resolve the identified linked blocker with its record owner and assess a recovery sequence.':r.finishOverdue?'Confirm remaining work and recovery dates for the overdue finish.':r.missedPlannedStart?'Establish why work has not started and agree a feasible start.':'Assess the remaining work and a feasible recovery sequence for this specific pressure activity.';
   return {rank:index+1,...described,groupedCount,activityIds:ids,wbsGroupCount:wbsLabels.length,revisionMovementCalendarDays:move,reason,linkedEvidence,action};
 });
 const milestoneRows=(data(modules,'milestones')?.rows??[]).filter((r:any)=>r.status!=='completed'&&['critical','high','watch'].includes(r.managementPriority)).map((r:any)=>({activityId:r.activityId,name:r.name,wbs:wbsPath(r.wbsId),currentFinishIso:r.currentDateIso,totalFloatHours:r.totalFloatHours,priority:r.managementPriority,reason:r.managementFlags.join('; '),action:r.managementAction}));
 const points=data(modules,'revision-trend')?.points??[],from=changes?points.find((p:any)=>p.revisionId===changes.fromRevisionId):null,to=points.find((p:any)=>p.revisionId===model.sourceRevisionId);
 const revision={state:changes?'available':'unavailable',fromRevisionId:changes?.fromRevisionId??null,toRevisionId:model.sourceRevisionId,previousFinishIso:from?.forecastCompletionIso??null,finishMovementCalendarDays:difference(to?.forecastCompletionIso??forecast?.sourceForecastCompletionIso??null,from?.forecastCompletionIso??null),added:changes?.addedActivityCount??null,removed:changes?.removedActivityCount??null,modified:changes?.modifiedActivityCount??null,
   largestChanges:(changes?.changedActivities??[]).filter((r:any)=>numeric(r.finishShiftDays)&&r.changeKind==='modified').sort((a:any,b:any)=>Math.abs(b.finishShiftDays)-Math.abs(a.finishShiftDays)).slice(0,20).map((c:any)=>({activityId:c.toActivityId??c.activityId,name:byId.get(c.toActivityId??c.activityId)?.name??c.activityId,finishMovementCalendarDays:c.finishShiftDays,floatMovementHours:c.floatShiftHours,progressMovementPercent:c.progressShiftPercent})),basis:changes?'Existing comparison between adopted revisions. Same Data Dates do not become later reporting periods.':'No applicable pair of adopted revisions is available; uploaded candidates do not change this comparison.'};
 const calendarsById=new Map(model.calendars.map(c=>[c.calendarId,c]));
 const anomalies={constraints:model.activities.filter(a=>a.sourceConstraints?.length).length,openStarts:rows.filter(r=>r.openStart).length,openFinishes:rows.filter(r=>r.openFinish).length,isolated:rows.filter(r=>r.isolated).length,
   unresolvedCalendars:rows.filter(r=>!calendarsById.get(r.calendarId??'')?.semanticComplete).length,
   remainingDuration:rows.filter(r=>numeric(r.remainingDurationHours)&&(r.remainingDurationHours<0||r.status==='completed'&&r.remainingDurationHours>0)).length,
   progress:rows.filter(r=>numeric(r.percentComplete)&&(r.percentComplete<0||r.percentComplete>100||r.status==='not_started'&&r.percentComplete>0||r.status==='completed'&&r.percentComplete<100)).length,
   unknownStatus:rows.filter(r=>r.status==='unknown').length,networkDiagnostics:forecast?.diagnostics??[]};
 const leading=wbsRows.filter(r=>r.pressureCount).slice(0,3),negative=counts.negativeFloat.knownCount;
 const summary=pressureRows.length?'The programme shows schedule pressure in '+leading.map(r=>shortWbs(r.wbs)).join('; ')+'. '+(negative===null?'Source float is unavailable; ':negative+' activities have known negative float; ')+(network?networkRows.filter((r:any)=>unfinished(r)).length+' unfinished activities lie on the calculated finish-driving network.':'the independent finish-driving network is not yet calculable.'):'No confirmed schedule pressure was found in the readable fields. Missing dates, float and statuses are reported separately; this is not confirmation of no project delay.';
 return {schemaVersion:1,projectId:state.projectId,projectVersion:state.version,sourceRevisionId:model.sourceRevisionId,dataDateIso:model.dataDateIso,sourceActivityCount:model.activities.length,executionActivityCount:rows.length,relationshipCount:model.relationships.length,calendarCount:model.calendars.length,activities:rows,pressureActivityIds:[...pressureSet],
   completion:forecast?.completionPosition??null,summary,counts,wbsRows,pressureActivityCount:pressureRows.length,actions,milestoneRows,revision,anomalies,
   network:{state:network?(forecast.origin==='deterministic_source_calendar'?'calculated':'scenario'):'unavailable',rows:networkRows,relationships:network?.relationships??[],finishActivityIds:network?.finishActivityIds??[],startReasons:network?.startReasons??[],basis:'Binding relationships from the existing forward calculation, traced back from the maximum calculated finish. All tied branches are retained. Topological order is not a claim that adjacent rows link. Relationship lags use the existing successor-calendar calculation. Source restrictions and other assumptions remain as stated in Completion position.'},
   evidenceChecks:uniqueChecks,evidenceCoverage:{pressureActivities:pressureRows.length,activitiesWithLinkedPressure:new Set(uniqueChecks.filter(c=>c.state==='linked_pressure').map(c=>c.activityId)).size,activitiesWithLinkedEvents:new Set(uniqueChecks.filter(c=>c.domain==='delay_event').map(c=>c.activityId)).size,
     basis:'Readiness, procurement, material, design/submittal, permits, resources, quality, access, commercial and risk records are checked through explicit activity/package links at the programme Data Date. Productivity and delay events use their existing authorities. A missing link is unknown, never a confirmed blocker or clearance.'},
   rankingBasis:'Unfinished finish-driving activities first, then negative float, overdue finishes, missed starts and near-critical/slipped activities. Within each group, source float and revision movement order the records. This is an action order, not quantified causal responsibility.',
   noChangeOutlook:forecast?.completionPosition?.independentFinishIso?'If the currently modelled remaining work, logic and calendars remain unchanged, the calculation finishes '+forecast.completionPosition.independentFinishIso.slice(0,10)+'. This retains the stated assumptions and is not a probabilistic prediction.':'The submitted finish remains the available outlook. An independent no-change finish is not established.',
   limitation:'Programme pressure and linked evidence do not establish contractual responsibility or entitlement. Missing domains qualify only the affected comparison.'};
}
