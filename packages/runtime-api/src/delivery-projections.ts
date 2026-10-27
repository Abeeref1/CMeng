import {handoverSourceComparison} from './handover-source-review';
import {countText,countUnit} from './count-text';
import {riskOwner,riskRowInputStatus} from './project-input-status';
import {programmeTaskReviewBasis,programmeTaskScope,type ProgrammeTaskKind} from './programme-task-review';
import {projectScopeClassification,locationReviewSummary} from './location-review';
import {procurementDateBasis} from './procurement-date-basis';
import {boqProgrammeLinks} from './boq-programme-links';
import {boqItemSourceRows,reconcileScope,type ScopeAssignment} from './boq-scope-mapping';
import {governedTables,cell as sourceCell} from '../../truth-kernel/src';
import {cachedIndependentForecast} from './forecast-cache';
import {procurementTiming,PROCUREMENT_LEAD_REVIEW_HEADERS,needDatePassedText,programmeOnlyNeedDateText,linkTimingMismatchText,canonicalHeader,registerDate,numberValue,sumKnown,establishedPopulationCount,populationAuthority,type PopulationAuthority} from '../../truth-kernel/src';
import {deliveryHsePosition,deliveryEvidenceMetrics} from './delivery-intelligence';
import {hseReportPosition} from './hse-report-evidence';
import {deliveryNumericIssues} from './delivery-validation';
import {deliveryAuthorityCatalog} from './delivery-authorities';
import {calendarWorkingDayHours,sourceFloatCriticality,isExecutionActivity,scheduleProgress,type CanonicalScheduleActivity} from '../../schedule-analysis-core/src';
import type {ProgressBreakdownRow} from '../../progress-breakdown/src/types';
import {resolveWorkingCalendar,subtractWorkingHours} from '../../schedule-cpm/src/calendar';
import {buildDeliveryWorkfrontBreakdown} from '../../progress-breakdown/src/projector';
import {programmeLongLeadScope} from '../../progress-breakdown/src/long-lead-scope';
import {sharedProjectPlanPositions} from './shared-plan-positions';
import {deliveryKinds,deliveryLabels,lifecycleExamples,kindIdentities,type DeliveryRecord,type DeliveryKind} from '../../delivery-core/src/types';
import {deliveryRecords,deliveryStore,deliveryPopulationPosition,deliveryPopulationBasis,deliveryPopulationReason,deliveryCurrentRecord,deliveryAwaitingDecision} from './delivery-records';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {projectScheduleControlBasis} from './schedule-control-basis';

import {registerProgrammeContext} from './register-programme-context';
import {buildLookAheadProjection,readinessReviewState} from '../../lookahead-schedule/src';
import {resolveBoqSource,suppliedBoqFigures} from './boq-source';
import {boqScopeIntelligence} from './boq-scope-intelligence';
import {interfaceIntelligence,interfaceModule} from './interface-intelligence';
import {withInstalledMeasurements} from './installed-measurements';
import {operationalReporting,reportingState,claimsReporting} from './reporting-state';
import {managementSourceInventory,type ManagementSourceDomain} from './management-source-inventory';
import {scheduleAuthorityReview,isAdoptedProgrammeRevision} from './schedule-authority';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';

import {deliveryPages} from '../../delivery-core/src/registry';
/** Members of one group whose plan or progress value is unknown, on the same
 * eligible population the group's progress calculation uses (execution
 * activities with a duration weight). null when nothing is eligible. */
export function groupUnknownCounts(selected:readonly CanonicalScheduleActivity[],total:ProgressBreakdownRow|null){
 const progress=scheduleProgress(selected.filter(isExecutionActivity)),eligible=progress.totalCount;
 const unknown=(coveragePercent:number|null|undefined)=>eligible&&typeof coveragePercent==='number'?eligible-Math.round(coveragePercent*eligible/100):null;
 return {eligibleActivityCount:eligible,
  plannedUnknownActivityCount:total?unknown(total.currentPlanCoveragePercent):null,
  baselinePlannedUnknownActivityCount:total?unknown(total.baselinePlanCoveragePercent):null,
  scheduleProgressUnknownActivityCount:total&&eligible?eligible-progress.knownCount:null};
}
export {deliveryPages,isDeliveryPage} from '../../delivery-core/src/registry';
export const field=(r:DeliveryRecord,...names:string[])=>{for(const n of names){const v=r.fields[canonicalHeader(n)];if(v!==null&&v!==undefined&&String(v).trim())return String(v).trim();}return '';};
const numeric=(r:DeliveryRecord,...names:string[])=>numberValue(field(r,...names));
const date=(r:DeliveryRecord,...names:string[])=>registerDate(field(r,...names));
/** F04: the source register field each RFI / NCR table cell reads, or null
 * when the register has no value for it. "Not established" in a cell is then
 * traceable to a field the register truly lacks. Same aliases as the readers. */
const presentField=(r:DeliveryRecord,names:readonly string[])=>{for(const n of names){const k=canonicalHeader(n),v=r.fields[k];if(v!==null&&v!==undefined&&String(v).trim())return k;}return null;};
export function registerCellSources(r:DeliveryRecord){
 return {
  reference:presentField(r,['record reference',...kindIdentities[r.kind]]),
  description:presentField(r,['description','package name','name','subject','test']),
  discipline:presentField(r,['discipline']),
  'fields.severity':presentField(r,['severity']),
  sourceStatus:presentField(r,['status','outcome']),
  dueDate:presentField(r,['due date','required by','required response']),
  owner:presentField(r,['owner','responsible','responsible party','assigned to']),
  'programmeContext.activityIds':presentField(r,['linked activity']),
 };
}
const ids=(v:string)=>v.split(/[;|]/).map(s=>s.trim()).filter(Boolean);
const sourceCandidateUsable=(r:DeliveryRecord)=>r.state==='extracted_candidate'&&r.sourceActive&&r.diagnostics.length===0&&deliveryNumericIssues(r.kind,r.fields).length===0;
const currentRecord=deliveryCurrentRecord;
const round=(v:number)=>Math.round(v*10000)/10000;
const pct=(n:number|null,d:number|null)=>n===null||d===null||d<=0?null:round(n/d*100);
const difference=(a:number|null,b:number|null)=>a===null||b===null?null:round(a-b);
const days=(later:string|null,earlier:string|null)=>later&&earlier?round((Date.parse(later.slice(0,10))-Date.parse(earlier.slice(0,10)))/86400000):null;
const isOnDate=(d:string|null,cutoff:string|null):boolean=>!!d&&!!cutoff&&d<=cutoff;
/** SW-42: every procurement package sits in exactly one linked-work group, so the groups always add up to the
 * packages on the page. "Linked work complete" is the procurement close-out group. */
export const PACKAGE_LINKED_WORK_GROUPS=[
 ['unfinished_work','Linked work not finished'],['completed_work','Linked work complete'],
 ['links_incomplete','Programme links need review'],['unlinked','No programme link'],
] as const;
const packageLinkedWorkLabel=(state:string)=>PACKAGE_LINKED_WORK_GROUPS.find(([key])=>key===state)?.[1]??'Programme links need review';
export function packageLinkedWorkGroups(rows:ReadonlyArray<{recordId:string}>,packageById:ReadonlyMap<string,{linkedWorkState:string}>){
 const pageRows=rows.filter(row=>packageById.has(row.recordId));
 const groups=PACKAGE_LINKED_WORK_GROUPS.map(([key,label])=>{const members=pageRows.filter(row=>packageById.get(row.recordId)!.linkedWorkState===key);
  return {key,label,count:members.length,recordIds:members.map(row=>row.recordId)};});
 const closeout=groups.find(g=>g.key==='completed_work')!;const closeoutIds=new Set(closeout.recordIds);
 return {total:pageRows.length,groupedTotal:groups.reduce((n,g)=>n+g.count,0),closeoutCount:closeout.count,groups,
  closeoutRows:pageRows.filter(row=>closeoutIds.has(row.recordId)),
  basis:'Every package on this page is counted once, in one group by its linked programme activities. Packages whose linked work is all complete stay listed and counted here for procurement close-out (delivery receipt, acceptance and register closure); they are not live programme blockers.'};
}
export const deliveryPopulationAuthority=(population:any,sourceCount:number|null,currentCount:number|null):PopulationAuthority=>{
 const established=population?.state==='established';
 const known=typeof population?.knownRecordCount==='number'?population.knownRecordCount:null;
 const source=typeof sourceCount==='number'?sourceCount:null;
 return populationAuthority({
  state:established?'established':known!==null&&known>0?'partial':'missing',
  sourceCount:source,
  applicableCount:established&&typeof population?.denominator==='number'?population.denominator:known,
  currentCount:established?currentCount:null,
  excludedCount:typeof population?.pendingRecordCount==='number'?population.pendingRecordCount:null,
  coveragePercent:source!==null&&source>0&&known!==null?round(known/source*100):established?100:null,
  basis:String(population?.basis??'The full set of applicable records is not confirmed.'),
 });
};
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof buildDelivery>}>();
// The milestone header spellings of a lifecycle stage are fixed text, so each
// spelling's canonical register key (a pure function of the spelling) is
// derived once per stage instead of on every record, stage and series read.
// keyedField reads those keys in the same order and with the same rule as field.
const milestoneKeyCache=new Map<string,{planned:string[];forecast:string[];actual:string[]}>();
function milestoneFieldKeys(stage:string){
 const known=milestoneKeyCache.get(stage);if(known)return known;
 const keys=(...names:string[])=>names.map(name=>canonicalHeader(name));
 const value={
  planned:keys(stage+' planned date','planned '+stage+' date',stage+' planned','planned '+stage,...(stage==='delivery'?['required on site','required on site date']:[])),
  forecast:keys(stage+' forecast date','forecast '+stage+' date',stage+' forecast','forecast '+stage),
  actual:keys(stage+' actual date','actual '+stage+' date',stage+' date',stage+' actual','actual '+stage),
 };
 if(milestoneKeyCache.size>=1024)milestoneKeyCache.clear();
 milestoneKeyCache.set(stage,value);return value;
}
const keyedField=(r:DeliveryRecord,keys:readonly string[])=>{for(const k of keys){const v=r.fields[k];if(v!==null&&v!==undefined&&String(v).trim())return String(v).trim();}return '';};

function buildDelivery(state:ProjectRuntimeState){
 const profiling=process.env.CMENG_PROFILE_PERF?.trim()==='1';
 let last=profiling?performance.now():0;
 const stages:Array<{part:string;ms:number}>=[];
 const mark=(part:string)=>{if(profiling){const now=performance.now();stages.push({part,ms:now-last});last=now;}};
 const source=deliveryRecords(state),records=source.records,governed=records.filter(currentRecord),store=deliveryStore(state);
 const kindIndex=new Map<DeliveryKind,DeliveryRecord[]>();for(const r of governed){const rows=kindIndex.get(r.kind)??[];rows.push(r);kindIndex.set(r.kind,rows);}
 const current=projectControlSchedule(reportingState(state)),model=current?.revision.model??null,dataDateIso=projectDataDate(state);
 const byKind=(kind:DeliveryKind)=>kindIndex.get(kind)??[];
 const byId=new Map(governed.map(r=>[r.recordId,r]));
 const recordsByScope=new Map<string,DeliveryRecord[]>();for(const r of records)for(const scope of new Set(['',...r.links.packageIds,...r.links.recordIds])){const key=r.kind+'|'+scope;const rows=recordsByScope.get(key)??[];rows.push(r);recordsByScope.set(key,rows);}
 const latestPopulation=new Map(store.populations.map(p=>[p.kind+'|'+(p.scopeId??''),p]));
 const population=(kind:DeliveryKind,scopeId:string|null=null)=>{
  const scope=recordsByScope.get(kind+'|'+(scopeId??''))??[];
  const decision=latestPopulation.get(kind+'|'+(scopeId??''));
  return deliveryPopulationPosition(kind,scopeId,scope,source.documents,decision);
 };
 mark('record_population');
 const populations=Object.fromEntries(deliveryKinds.map(k=>[k,population(k)]));
 const boq=resolveBoqSource(state,current?.revision.revisionId??''),controlledBoq=boq.selection.adoptedSource&&boq.selection.state==='source';
 const quantities=withInstalledMeasurements(state,boq.quantities,dataDateIso);
 const supplied=suppliedBoqFigures(boq.boq,boq.quantities),items=new Map(quantities?.items.map(i=>[i.quantityItemId,i])??[]);
 const snapshotsByItem=new Map<string,NonNullable<typeof quantities>['installedSnapshots']>();
 for(const snapshot of quantities?.installedSnapshots??[]){if(!isOnDate(snapshot.asOfIso.slice(0,10),dataDateIso))continue;const rows=snapshotsByItem.get(snapshot.quantityItemId)??[];rows.push(snapshot);snapshotsByItem.set(snapshot.quantityItemId,rows);}
 for(const rows of snapshotsByItem.values())rows.sort((a,b)=>a.asOfIso.localeCompare(b.asOfIso));
 mark('source_boq_and_quantities');
 const activities=new Map(model?.activities.map(a=>[a.activityId,a])??[]);
 const findings:Array<{code:string;recordId:string|null;message:string;action:string;sourceRefs:string[]}>=[];
 const add=(code:string,r:DeliveryRecord|null,message:string,action:string)=>findings.push({code,recordId:r?.recordId??null,message,action,sourceRefs:r?.receipts.map(s=>s.documentId+':'+s.locator)??[]});
 const invalidFields=new Map(governed.map(r=>[r.recordId,new Set(deliveryNumericIssues(r.kind,r.fields).map(issue=>{add('INVALID_DELIVERY_NUMBER',r,issue.message,'Reconcile the input against its source. Invalid values are retained but excluded from calculations.');return issue.field;}))]));
 for(const r of records)if(['conflicted','stale'].includes(r.state))add('RECORD_'+r.state.toUpperCase(),r,r.description??r.reference??r.recordId,'Review the retained source and select the governed revision.');
 for(const r of governed){
  for(const [label,linked,available] of [['Activity',r.links.activityIds,activities],['BOQ',r.links.boqItemIds,items],['Package',r.links.packageIds,byId],['Supplier',r.links.supplierIds,byId],['Location',r.links.locationIds,byId],['Asset',r.links.assetIds,byId],['Record',r.links.recordIds,byId]] as const)
   if(linked.some(id=>!available.has(id)))add('STALE_RELATIONSHIP',r,label+' relationship no longer resolves to the current authority.','Review this '+label.toLowerCase()+' link of the '+deliveryLabels[r.kind]+' record against the current project records.');
 }
 const milestone=(r:DeliveryRecord,stage:string)=>{const keys=milestoneFieldKeys(stage);return {stage,
  planned:registerDate(keyedField(r,keys.planned)),
  forecast:registerDate(keyedField(r,keys.forecast)),
  actual:registerDate(keyedField(r,keys.actual)),
 };};
 const actualOn=(r:DeliveryRecord,stage:string)=>{const m=milestone(r,stage);return isOnDate(m.actual,dataDateIso)?m.actual:null;};
 const gatesByScope=new Map<string,DeliveryRecord[]>();for(const g of byKind('gate'))for(const id of new Set([...g.links.packageIds,...g.links.recordIds])){const rows=gatesByScope.get(id)??[];rows.push(g);gatesByScope.set(id,rows);}
 const submittalsByPackage=new Map<string,DeliveryRecord[]>();
 for(const submittal of byKind('submittal'))for(const id of submittal.links.packageIds){const rows=submittalsByPackage.get(id)??[];rows.push(submittal);submittalsByPackage.set(id,rows);}
 const gatesFor=(r:DeliveryRecord)=>{
  const gates=gatesByScope.get(r.recordId)??[];
  // A record without gate links or a scope decision has no gate denominator.
  // Avoid re-scanning document/pending authority for each of 12k+ assets.
  // Explicitly confirmed empty gate populations still use the full authority rule.
  const p=gates.length||latestPopulation.has('gate|'+r.recordId)
    ?population('gate',r.recordId)
    :{kind:'gate' as const,scopeId:r.recordId,state:'not_established' as const,denominator:null,
      knownRecordCount:0,pendingRecordCount:0,recordIds:[] as string[],
      basis:deliveryPopulationBasis('gate'),
      confirmedAt:null};
  const rows=gates.map(g=>{
   const applicable=field(g,'applicable').toLowerCase(),raw=field(g,'outcome','status').toLowerCase();
   const when=date(g,'outcome date','status as of'),satisfied=date(g,'satisfied date');
   const applicability=['yes','applicable'].includes(applicable)?true:['no','not applicable'].includes(applicable)?false:null;
   const known=isOnDate(satisfied,dataDateIso)||when===dataDateIso;
   const outcome=isOnDate(satisfied,dataDateIso)?'ready':known&&['ready','blocked','at risk'].includes(raw)?raw:'unknown';
   return {recordId:g.recordId,reference:g.reference,requirement:field(g,'requirement','description'),applicable:applicability,outcome,owner:field(g,'owner')||null,evidence:g.receipts};
  });
  const applicable=rows.filter(g=>g.applicable===true),notApplicable=rows.filter(g=>g.applicable===false),unknown=rows.filter(g=>g.applicable===null||g.applicable&&g.outcome==='unknown');
  const complete=p.state==='established'&&unknown.length===0&&!!dataDateIso;
  const ready=applicable.filter(g=>g.outcome==='ready').length,blocked=applicable.filter(g=>g.outcome==='blocked').length;
  return {state:blocked?'blocked':!complete?'unknown':applicable.some(g=>g.outcome==='at risk')?'at_risk':applicable.length?'ready':'not_applicable',
   satisfiedKnownCount:ready,applicableCount:complete?applicable.length:null,notApplicableCount:p.state==='established'?notApplicable.length:null,knownNotApplicableCount:notApplicable.length,
   readinessPercent:complete&&applicable.length?pct(ready,applicable.length):null,unknownCount:p.state==='established'?unknown.length:null,knownUnknownCount:unknown.length,
   population:p,rows,
   linkedSubmittals:(submittalsByPackage.get(r.recordId)??[]).map(s=>{
    const sourceStatus=field(s,'status')||null,approvalDate=date(s,'approval date'),rejectionDate=date(s,'rejection date'),statusAsOf=date(s,'status as of');
    const datedRejection=isOnDate(rejectionDate,dataDateIso)&&(!isOnDate(approvalDate,dataDateIso)||rejectionDate!>=approvalDate!);
    const currentRejection=statusAsOf===dataDateIso&&!!dataDateIso&&/^(rejected|blocked|failed)$/i.test(sourceStatus??'');
    const currentReview=statusAsOf===dataDateIso&&!!dataDateIso&&/^(under review|pending|submitted|revise.*|resubmit.*)$/i.test(sourceStatus??'');
    const approvedAtDataDate=approvalDate&&dataDateIso?isOnDate(approvalDate,dataDateIso)&&!datedRejection&&!currentRejection&&!currentReview:null;
    return {recordId:s.recordId,reference:s.reference,description:s.description,sourceStatus,approvalDate,rejectionDate,statusAsOf,approvedAtDataDate,
      state:datedRejection||currentRejection?'blocked':approvedAtDataDate===true?'ready':'unknown',receipts:s.receipts};
   }),
  };
 };
 const readiness=byKind('package').concat(byKind('workfront'),byKind('commissioning'),byKind('asset')).map(r=>({recordId:r.recordId,reference:r.reference,description:r.description,kind:r.kind,discipline:field(r,'discipline')||null,...gatesFor(r)}));
 const drivingNetwork=model?cachedIndependentForecast(model,new Date().toISOString()).drivingNetwork:undefined;
 const drivingIds=drivingNetwork?new Set(drivingNetwork.activityIds):null;
 const readinessByRecord=new Map(readiness.map(r=>[r.recordId,r]));
 const lifecycleById=new Map(byKind('lifecycle').map(r=>[r.recordId,r]));
 mark('cpm_and_record_readiness');
 const procurementDateChoice=procurementDateBasis(state).choice;
 const packageRows=byKind('package').map(r=>{
  const linkedActivities=r.links.activityIds.map(id=>activities.get(id));
  // SW-42: one shared linked-work rule (the same one RFIs and NCRs use). Completed linked work moves a package
  // into the close-out group; it never removes the package from the page lists or counts.
  const linkedWork=registerProgrammeContext(r.links.activityIds,activities);
  const registerCleanup=linkedWork.state==='completed_work';
  const unfinishedDrivingLink=drivingIds&&linkedActivities.length&&linkedActivities.every(Boolean)?r.links.activityIds.some(id=>drivingIds.has(id)&&activities.get(id)?.status!=='completed'):null;
  const programmeNeedDate=linkedActivities.length&&linkedActivities.every(a=>a?.currentStartIso)?linkedActivities.map(a=>a!.currentStartIso!.slice(0,10)).sort()[0]!:null;
  const forecastDelivery=date(r,'forecast delivery','forecast delivery date','delivery forecast date'),sourceRequiredOnSite=date(r,'required on site','required on site date');
  // SW-17: the package row's programme need date is the one assessed need date (linked start less any stated lead/review time), never the raw start.
  // G7-28: the linked work's finish for the shared link-timing rule (the latest linked finish).
  const linkedFinish=linkedActivities.length&&linkedActivities.every(a=>a?.forecastFinishIso??a?.currentFinishIso)?linkedActivities.map(a=>(a!.forecastFinishIso??a!.currentFinishIso)!.slice(0,10)).sort().at(-1)!:null;
  const timing=procurementTiming({governingDate:procurementDateChoice,dataDateIso,programmeNeedDate,sourceRequiredOnSite,forecastDelivery,actualDelivery:date(r,'actual delivery','actual delivery date','delivered date'),status:field(r,'status'),leadReviewTime:field(r,...PROCUREMENT_LEAD_REVIEW_HEADERS),linkedActivityFinish:linkedFinish});
  const {programmeNeedDate:assessedProgrammeNeedDate,needDate,needDateBasis,deliveredAtDataDate,deliveredStatusOnly,deliveryDateConflict,openStatusDeliveredConflict,notApplicable,overdueUndelivered,needDatePassedOnProgrammeOnly,forecastLate,headroomCalendarDays:headroom,linkTimingMismatch}=timing;
  if(forecastLate&&headroom!==null&&!registerCleanup)add('DELIVERY_AFTER_PROGRAMME_NEED',r,'Forecast delivery is '+(-headroom)+' calendar days after '+needDateBasis.toLowerCase()+'.'+(needDatePassedOnProgrammeOnly?' '+programmeOnlyNeedDateText(timing):''),'Review procurement and programme consequences; this does not establish delay entitlement.');
  if(overdueUndelivered&&!registerCleanup)add('PACKAGE_REQUIRED_DATE_MISSED',r,needDatePassedText(timing),'Obtain the actual delivery or recovery date and protect the linked installation work.');
  if(linkTimingMismatch&&!registerCleanup)add('MATERIAL_LINK_TIMING_MISMATCH',r,linkTimingMismatchText(timing)+'.','Check the required delivery date against the linked activity and correct the date or the activity link.');
  if(deliveryDateConflict)add('PROCUREMENT_DELIVERY_DATE_CONFLICT',r,'Source completion status conflicts with a delivery date after the reporting date.','Review the reported status and delivery dates against the receipt; save the corrected record without inventing an actual delivery date.');
  else if(openStatusDeliveredConflict)add('PROCUREMENT_DELIVERY_DATE_CONFLICT',r,'Source status "'+field(r,'status')+'" conflicts with an actual delivery dated on or before the reporting date.','Review the reported status and actual delivery date against the receipt; save the corrected record.');
  else if(deliveredStatusOnly)add('PROCUREMENT_DELIVERY_DATE_REQUIRED',r,'The source reports completed delivery but gives no actual delivery date.','Review the delivery receipt and record its actual date before treating the package as ready at the reporting date.');
  if(!r.links.boqItemIds.length&&!field(r,'scope basis'))add('PROCUREMENT_SCOPE_UNMAPPED',r,'Procurement package has no controlled BOQ relationship.','Map the applicable scope or document a governed non-BOQ scope basis.');
  const template=lifecycleById.get(field(r,'lifecycle id'));
  const stages=template?ids(field(template,'stages')):[];
  const lifecycle=stages.map(stage=>({...milestone(r,stage),actualAtDataDate:actualOn(r,stage)}));
  const currentStage=[...lifecycle].reverse().find(s=>s.actualAtDataDate)?.stage??(deliveredAtDataDate?'Delivered':field(r,'current stage','stage','status')||null);
  const latestActionDates:Array<{stage:string;dateIso:string|null;duration:number|null;basis:string;calendarId:string|null;source:string}>=[];
  let next=programmeNeedDate?Math.min(...linkedActivities.map(a=>Date.parse(a!.currentStartIso!))):null;
  const install=stages.indexOf('installation');const beforeNeed=install>=0?stages.slice(0,install):stages;
  if(!template||!beforeNeed.length)next=null;
  let assumption=false;
  for(const stage of [...beforeNeed].reverse()){
   const duration=numeric(r,stage+' duration')??numeric(template!,stage+' duration');
   const basis=field(r,stage+' day basis')||field(template!,stage+' day basis');
   const provenance=field(r,stage+' duration source')||field(template!,stage+' duration source');
   const calendarId=field(r,stage+' calendar id')||field(template!,stage+' calendar id')||null;
   if(/assumption|benchmark|historical/i.test(provenance))assumption=true;
   if(duration===null||duration<0||!provenance||!basis)next=null;
   if(next!==null&&duration!==null){try{
    if(basis==='calendar days')next-=duration*86400000;
    else{const cal=model?resolveWorkingCalendar(calendarId,model.calendars,false):null;const hours=cal?calendarWorkingDayHours(cal.calendar):null;
     if(!cal||!['working days','working hours'].includes(basis)||basis==='working days'&&hours===null)next=null;
     else next=subtractWorkingHours(cal.calendar,next,basis==='working hours'?duration:duration*hours!);
    }
   }catch{next=null;}}
   latestActionDates.unshift({stage,dateIso:next===null?null:new Date(next).toISOString(),duration,basis: basis||'not established',calendarId,source:provenance||'not established'});
  }
  const latestOrder=latestActionDates.length&&latestActionDates.every(s=>s.dateIso)?latestActionDates.find(s=>s.stage==='po')?.dateIso??null:null;
  const sourceLongLead=/^(yes|true|1|long lead)$/i.test(field(r,'long lead'));
  return {recordId:r.recordId,reference:r.reference,description:r.description,discipline:field(r,'discipline')||null,owner:field(r,'owner','responsible','responsible party')||null,supplier:field(r,'supplier','vendor','manufacturer')||null,sourceStatus:field(r,'status')||null,sourceState:r.state,
   supplierIds:r.links.supplierIds,activityIds:r.links.activityIds,boqItemIds:r.links.boqItemIds,locationIds:r.links.locationIds,programmeRevisionId:current?.revision.revisionId??null,registerCleanup,
   linkedWorkState:linkedWork.state,linkedWorkGroup:packageLinkedWorkLabel(linkedWork.state),
   programmeNeedDate:assessedProgrammeNeedDate,sourceRequiredOnSite,needDate,needDateBasis,needDatePassedOnProgrammeOnly,linkTimingMismatch,linkedActivityFinish:linkedFinish,forecastDelivery,actualDelivery:date(r,'actual delivery','actual delivery date','delivered date'),deliveredAtDataDate,deliveredStatusOnly,deliveryDateConflict,openStatusDeliveredConflict,notApplicable,overdueUndelivered,forecastLate,deliveryTimingBasis:deliveryDateConflict?'Source completion status and delivery date conflict; review required':openStatusDeliveredConflict?'Source open status and dated actual delivery conflict; review required':notApplicable?'Source status: not applicable':deliveredAtDataDate?'Dated actual delivery':deliveredStatusOnly?'Delivered, date not stated':forecastLate||overdueUndelivered?'Open package with date exposure':'Open package; timing does not establish lateness',drivingPath:unfinishedDrivingLink,drivingBlockerScenario:!registerCleanup&&(forecastLate||overdueUndelivered)&&unfinishedDrivingLink,linkedFloatHours:linkedActivities.some(a=>a&&a.status!=='completed'&&a.totalFloatHours!==null)?Math.min(...linkedActivities.filter(a=>a&&a.status!=='completed'&&a.totalFloatHours!==null).map(a=>a!.totalFloatHours!)):null,linkedFloatActivityId:(()=>{const open=linkedActivities.filter(a=>a&&a.status!=='completed'&&a.totalFloatHours!==null);if(!open.length)return null;const low=Math.min(...open.map(a=>a!.totalFloatHours!));return open.find(a=>a!.totalFloatHours===low)?.activityId??null;})(),linkedFloatCalendarIds:[...new Set(linkedActivities.filter(a=>a&&a.status!=='completed'&&a.totalFloatHours!==null).map(a=>a!.calendarId??null))],programmeFloat:linkedActivities.map(a=>({activityId:a?.activityId??null,totalFloatHours:a?.totalFloatHours??null,calendarId:a?.calendarId??null})),longLeadCandidate:field(r,'long lead')?sourceLongLead:/elevator|façade|facade|switchgear|transformer|generator|chiller|ahu|fcu|pump|bms|fire alarm|equipment|steel|stone/i.test(r.description??''),headroomCalendarDays:headroom,currentStage,lifecycle,latestActionDates,latestOrderDate:latestOrder,
   latestOrderState:latestOrder?(assumption?'scenario':'calculated'):'not_established',leadTimeBasis:latestOrder?'Governed lifecycle durations, explicit day basis and controlled programme need date.':'Latest order date not established: confirm programme links, lifecycle, duration sources and day/calendar basis.',
   packageValue:numeric(r,'package value','amount','value'),currency:field(r,'currency')||null,readiness:readinessByRecord.get(r.recordId),receipts:r.receipts};
 }).sort((a,b)=>Number(a.deliveredAtDataDate||a.deliveredStatusOnly)-Number(b.deliveredAtDataDate||b.deliveredStatusOnly)||(a.linkedFloatHours??Infinity)-(b.linkedFloatHours??Infinity)||Number(b.drivingPath)-Number(a.drivingPath)||(a.needDate??'9999').localeCompare(b.needDate??'9999'));
 for(const packageRow of packageRows){
  const gate=readinessByRecord.get(packageRow.recordId);if(!gate)continue;
  const raw=String(packageRow.sourceStatus??'').trim().toLowerCase();
  const blockedSubmittals=gate.linkedSubmittals.filter(s=>s.state==='blocked'),unknownSubmittals=gate.linkedSubmittals.filter(s=>s.state==='unknown');
  // SW-18: a date is a blocker only when it has passed and the item is not
  // done. A late forecast (even on the driving path) is at risk, not blocked.
  // G7-28: a link-timing mismatch leaves the date position to be confirmed.
  const dateBlocker=!packageRow.registerCleanup&&packageRow.overdueUndelivered&&!packageRow.linkTimingMismatch;
  // G7-56: each blocked package says what blocks it; a passed date is not called a blocking prerequisite.
  const blockedBy=[...gate.rows.filter(g=>g.applicable===true&&g.outcome==='blocked').map(g=>'gate '+(g.reference??g.requirement??g.recordId)+' is blocked'),
    ...blockedSubmittals.map(s=>'linked submittal '+(s.reference??s.recordId)+' is rejected or blocked'),
    ...(/^(blocked|rejected|failed|on hold)$/.test(raw)?['the source status is "'+String(packageRow.sourceStatus).trim()+'"']:[]),
    ...(dateBlocker?[needDatePassedText(packageRow).replace(/^The /,'the ').replace(/\.$/,'')]:[])];
  const blockers=gate.state==='blocked'||blockedBy.length>0;
  const ready=packageRow.deliveredAtDataDate||gate.state==='ready';
  const unresolved=packageRow.deliveryDateConflict||packageRow.openStatusDeliveredConflict||packageRow.deliveredStatusOnly||unknownSubmittals.length>0||packageRow.linkTimingMismatch;
  gate.state=blockers?'blocked':packageRow.notApplicable?'not_applicable':unresolved?'unknown':ready?'ready':packageRow.forecastLate||gate.state==='at_risk'?'at_risk':'unknown';
  Object.assign(gate,{classificationBasis:'Dated delivery, linked submittals and gates at the Data Date; an undated completed status cannot establish readiness. Gate percentages describe only the confirmed set of gates.',
    blockedBy:gate.state==='blocked'?blockedBy:[],
    deliveryDateConflict:packageRow.deliveryDateConflict,openStatusDeliveredConflict:packageRow.openStatusDeliveredConflict,
    missingInputs:packageRow.notApplicable?[]:[...(!packageRow.needDate?['Required-on-site or linked programme need date']:[]),...(packageRow.linkTimingMismatch?['Confirmed activity link and required-on-site date']:[]),...(packageRow.needDatePassedOnProgrammeOnly?['Procurement date basis (linked programme or register date)']:[]),...(!packageRow.forecastDelivery&&!ready?['Forecast delivery date']:[]),...(packageRow.deliveredStatusOnly?['Actual delivery date']:[]),...(unknownSubmittals.length?['Dated approval for '+unknownSubmittals.length+' linked submittal(s)']:[])],
    populationConfirmed:gate.population.state==='established'});
 }
 const scheduleWbs=model?.wbs??[];
 const explicitProgrammeLongLead=model?programmeLongLeadScope(model):{roots:[] as typeof scheduleWbs,activityIds:new Set<string>()};
 const longLeadRoots=explicitProgrammeLongLead.roots;
 const descendantWbs=(rootId:string)=>{
  const ids=new Set<string>([rootId]);let changed=true;
  while(changed){changed=false;for(const w of scheduleWbs)if(w.parentWbsId&&ids.has(w.parentWbsId)&&!ids.has(w.wbsId)){ids.add(w.wbsId);changed=true;}}
  return ids;
 };
 const deliveryDependencyRefs=(kind:DeliveryKind,activityIds:Set<string>)=>byKind(kind)
  .filter(r=>r.links.activityIds.some(id=>activityIds.has(id)))
  .map(r=>r.reference??r.recordId);
 const scheduleLongLeadCandidates:Array<any>=[];
 const representedActivities=new Set<string>();
 for(const root of longLeadRoots){
  const wbsIds=descendantWbs(root.wbsId);
  const activityRows=(model?.activities??[]).filter(a=>a.wbsId&&wbsIds.has(a.wbsId)&&explicitProgrammeLongLead.activityIds.has(a.activityId));
  activityRows.forEach(a=>representedActivities.add(a.activityId));
  const activityIds=new Set(activityRows.map(a=>a.activityId));
  const starts=activityRows.map(a=>a.currentStartIso??a.forecastStartIso).filter((d):d is string=>!!d).map(d=>d.slice(0,10)).sort();
  const finishes=activityRows.map(a=>a.currentFinishIso??a.forecastFinishIso).filter((d):d is string=>!!d).map(d=>d.slice(0,10)).sort();
  scheduleLongLeadCandidates.push({
   recordId:'schedule-long-lead-wbs:'+root.wbsId,reference:root.name||root.wbsId,description:root.name||root.wbsId,
   authority:'candidate',candidateType:'schedule_wbs',wbsId:root.wbsId,activityIds:[...activityIds],activityCount:activityRows.length,
   programmeNeedDate:starts[0]??null,forecastFinish:finishes.at(-1)??null,
   designDependencies:deliveryDependencyRefs('design',activityIds),submittalDependencies:deliveryDependencyRefs('submittal',activityIds),
   currentStatus:'schedule-derived long-lead scope candidate',
   basis:'Schedule-derived long-lead scope candidate from the controlled programme/WBS. This is not a confirmed procurement package and does not establish procurement lateness.'
  });
 }
 for(const activity of model?.activities??[]){
  if(representedActivities.has(activity.activityId)||!explicitProgrammeLongLead.activityIds.has(activity.activityId))continue;
  const activityIds=new Set([activity.activityId]);
  scheduleLongLeadCandidates.push({
   recordId:'schedule-long-lead-activity:'+activity.activityId,reference:activity.activityId,description:activity.name,
   authority:'candidate',candidateType:'schedule_activity',wbsId:activity.wbsId??null,activityIds:[activity.activityId],activityCount:1,
   programmeNeedDate:(activity.currentStartIso??activity.forecastStartIso)?.slice(0,10)??null,
   forecastFinish:(activity.currentFinishIso??activity.forecastFinishIso)?.slice(0,10)??null,
   designDependencies:deliveryDependencyRefs('design',activityIds),submittalDependencies:deliveryDependencyRefs('submittal',activityIds),
   currentStatus:'schedule-derived long-lead scope candidate',
   basis:'Schedule-derived long-lead activity candidate. This is contextual programme intelligence, not a confirmed procurement package or delay conclusion.'
  });
 }
 const packagesByItem=new Map<string,DeliveryRecord[]>();for(const r of byKind('package'))for(const id of r.links.boqItemIds){const list=packagesByItem.get(id)??[];list.push(r);packagesByItem.set(id,list);}
 const materialRows=byKind('package').map(r=>{
  const linked=r.links.boqItemIds.map(id=>items.get(id)),units=[...new Set(linked.map(i=>i?.unit))];
  const unit=units.length===1&&units[0]?units[0]:null;
  const splitScope=linked.some(i=>i&&(packagesByItem.get(i.quantityItemId)?.length??0)>1);
  const allocations=r.links.boqAllocations;
  const partialAllocation=linked.some(i=>{const a=allocations.find(a=>a.boqItemId===i?.quantityItemId);return !!a&&(!i||a.unit!==i.unit||a.quantity!==i.contractQuantity);});
  let required=unit&&linked.length===1&&linked.every(Boolean)?sumKnown(linked.map(i=>allocations.length?allocations.find(a=>a.boqItemId===i!.quantityItemId)?.quantity??null:splitScope?null:i!.contractQuantity)):null;
  const enteredUnit=field(r,'unit');if(enteredUnit&&enteredUnit!==unit)required=null;
  const installedScopeEstablished=!!unit&&linked.length===1&&linked.every(Boolean)&&!splitScope&&!partialAllocation&&(!enteredUnit||enteredUnit===unit);
  const installedValues=linked.map(i=>{if(!i||!installedScopeEstablished)return null;const snapshots=snapshotsByItem.get(i.quantityItemId);return snapshots?.at(-1)?.installedQuantity??null;});
  const quantity=(stage:string)=>{const n=numeric(r,stage+' quantity',stage+' qty');const when=date(r,stage+' date',stage+' as of','status as of');return !invalidFields.get(r.recordId)?.has(stage+' quantity')&&!invalidFields.get(r.recordId)?.has(stage+' qty')&&n!==null&&n>=0&&isOnDate(when,dataDateIso)&&(!enteredUnit||enteredUnit===unit)?n:null;};
  const ordered=quantity('ordered'),manufactured=quantity('manufactured'),shipped=quantity('shipped'),delivered=quantity('delivered'),accepted=quantity('accepted'),released=quantity('released'),installed=installedScopeEstablished?sumKnown(installedValues):null;
  if(units.length>1)add('MATERIAL_UNITS_INCOMPATIBLE',r,'Linked BOQ quantities have different units. A combined installed quantity cannot be established.','Separate the package quantities by compatible unit; the item measurements remain in Installed Quantities.');
  if(splitScope||partialAllocation)add('INSTALLED_SCOPE_UNRESOLVED',r,'Item-level installed quantities do not establish this package’s allocated share.','Reconcile measured package scope before relying on installed quantities or completion percentages.');
  for(const [code,left,right,label] of [['ORDERED_ABOVE_REQUIREMENT',ordered,required,'Ordered above controlled requirement'],['DELIVERED_ABOVE_ORDERED',delivered,ordered,'Delivered above ordered'],['ACCEPTED_ABOVE_DELIVERED',accepted,delivered,'Accepted above delivered'],['INSTALLED_ABOVE_DELIVERED',installed,delivered,'Installed above delivered'],['INSTALLED_ABOVE_ACCEPTED',installed,accepted,'Installed above accepted'],['INSTALLED_ABOVE_REQUIREMENT',installed,required,'Installed above controlled requirement']] as const)if(left!==null&&right!==null&&left>right)add(code,r,label+': '+left+' / '+right+' '+unit+'.','Reconcile the linked source quantities and scope; supplied quantities are retained.');
  return {recordId:r.recordId,reference:r.reference,description:r.description,unit,required,ordered,manufactured,shipped,delivered,accepted,released,installed,
   remainingToOrder:difference(required,ordered),remainingToDeliver:difference(required,delivered),remainingToInstall:difference(required,installed),
   procurementCoveragePercent:pct(ordered,required),manufacturingCoveragePercent:pct(manufactured,required),deliveryCoveragePercent:pct(delivered,required),acceptanceCoveragePercent:pct(accepted,required),installationCompletionPercent:pct(installed,required),
   installedScopeEstablished,basis:!unit?'Compatible BOQ units are not established; quantities with different units cannot be combined.':splitScope||partialAllocation?'Split scope: explicit BOQ allocations required. Item-level installed quantities cannot be assigned to one package without a governed measured split.':'Required quantities from controlled BOQ; installed quantities from existing Installed Quantities.',receipts:r.receipts};
 });
 const itemMaterialRows=[...items.values()].map(item=>{
  const installed=snapshotsByItem.get(item.quantityItemId)?.at(-1)?.installedQuantity??null;
  return {recordId:'boq-item:'+item.quantityItemId,reference:item.itemNumber??item.quantityItemId,description:item.description,unit:item.unit,required:item.contractQuantity,ordered:null,delivered:null,accepted:null,installed,remainingToInstall:difference(item.contractQuantity,installed),authority:'From BOQ and dated measurement register',basis:'Item quantities are usable independently of procurement allocation. Ordered, delivered and accepted quantities need dated package evidence.'};
 });
 for(const [itemId,packages] of packagesByItem){const item=items.get(itemId);const allocated=sumKnown(packages.map(p=>p.links.boqAllocations.find(a=>a.boqItemId===itemId)?.quantity??null));if(item?.contractQuantity!==null&&item?.contractQuantity!==undefined&&allocated!==null&&allocated>item.contractQuantity)add('SCOPE_ALLOCATIONS_ABOVE_BOQ',null,'Package allocations exceed BOQ item '+itemId+'.','Review the governed split quantities.');}
 // F21 shared BOQ-to-package rule. Explicit references only: the package
 // register's cited BOQ items (resolved in Delivery records) and the BOQ
 // row's own package code naming exactly one current package. An item cited
 // for more than one package, or matching an ambiguous reference, is counted
 // once in the unmapped part with its candidate packages listed.
 const packageKey=(v:string)=>v.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 const packagesByReference=new Map<string,DeliveryRecord[]>();
 for(const p of byKind('package'))if(p.reference){const k=packageKey(p.reference);packagesByReference.set(k,[...(packagesByReference.get(k)??[]),p]);}
 const boqHash=boq.boq?.sourceHashSha256??null;
 const boqSourceRows=controlledBoq&&boqHash?boqItemSourceRows(governedTables((state.evidenceDocuments??[]).filter(d=>d.sourceHashSha256===boqHash),[]),boqHash,quantities?.items??[]):new Map<string,import('../../truth-kernel/src').SourceRow[]>();
 const itemPackages=new Map<string,Set<string>>(),itemPackageCandidates=new Map<string,Set<string>>();
 const addTo=(target:Map<string,Set<string>>,itemId:string,value:string)=>{const set=target.get(itemId)??new Set<string>();set.add(value);target.set(itemId,set);};
 for(const [itemId,list] of packagesByItem)if(items.has(itemId))for(const p of list)addTo(itemPackages,itemId,p.recordId);
 for(const [itemId,rows] of boqSourceRows)for(const code of new Set<string>(rows.flatMap(r=>sourceCell(r,'package id','package','package code','work package').split(/[;|]/).map(x=>x.trim()).filter(Boolean)))){
  const matches=packagesByReference.get(packageKey(code))??[];
  if(matches.length===1)addTo(itemPackages,itemId,matches[0]!.recordId);
  else addTo(itemPackageCandidates,itemId,code+(matches.length?' (several current packages share this reference)':' (no current package with this reference)'));
 }
 for(const p of byKind('package'))for(const ref of p.boqReferences??[])if(ref.state==='ambiguous')for(const itemId of ref.candidates)addTo(itemPackageCandidates,itemId,(p.reference??p.recordId)+' cites '+ref.reference+' ('+ref.candidates.length+' BOQ items carry this number)');
 const packageLabel=(id:string)=>byId.get(id)?.reference??id;
 const packageAssignment=(itemId:string):ScopeAssignment=>{
  const ids=[...(itemPackages.get(itemId)??[])];
  if(ids.length===1)return {group:ids[0]!,state:'explicit',basis:'Package register or BOQ row names this package',candidates:[packageLabel(ids[0]!)]};
  if(ids.length>1)return {group:null,state:'ambiguous',basis:'Cited for more than one package; counted once here, not split by guess',candidates:ids.map(packageLabel)};
  const candidates=[...(itemPackageCandidates.get(itemId)??[])];
  return candidates.length?{group:null,state:'ambiguous',basis:'Package reference does not resolve to one package and one BOQ item',candidates}:{group:null,state:'unmapped',basis:'No package register or BOQ package reference',candidates:[]};
 };
 const mapped=new Set(itemPackages.keys());
 const activityByItem=new Map<string,string[]>();for(const a of quantities?.allocations??[]){const list=activityByItem.get(a.quantityItemId)??[];list.push(a.activityId);activityByItem.set(a.quantityItemId,list);}
 mark('material_and_scope');
 // A candidate-only BOQ has no adopted value or mapping authority in Delivery's
  // displayed BOQ rows. Preserve its retained quantities and source evidence,
  // but do not run the expensive full BOQ/activity candidate scorer solely
  // for a BOQ projection that cannot yet consume its result. The complete
  // source-backed mapping still runs when a governed BOQ becomes usable.
  const sharedBoqLinks=model&&controlledBoq?boqProgrammeLinks(state,model):null;
 mark('boq_to_programme_links');
 for(const row of sharedBoqLinks?.rows??[])if(row.activityIds.length)activityByItem.set(row.itemId,[...new Set([...(activityByItem.get(row.itemId)??[]),...row.activityIds])]);
 const workfrontsByItem=new Map<string,DeliveryRecord[]>();for(const r of byKind('workfront'))for(const id of r.links.boqItemIds){const rows=workfrontsByItem.get(id)??[];rows.push(r);workfrontsByItem.set(id,rows);}
 const boqRows=(controlledBoq?supplied.rows:[]).map(i=>{const packages=[...(itemPackages.get(i.itemId)??[])].map(id=>byId.get(id)).filter((p):p is DeliveryRecord=>!!p),workfronts=workfrontsByItem.get(i.itemId)??[],scope=[...packages,...workfronts];return {...i,
  procurementPackageIds:packages.map(p=>p.recordId),workfrontIds:workfronts.map(p=>p.recordId),
  programmeActivityIds:[...new Set([...(activityByItem.get(i.itemId)??[]),...scope.flatMap(r=>r.links.activityIds)])],
  disciplines:[...new Set(scope.map(r=>field(r,'discipline')).filter(Boolean))],locationIds:[...new Set(scope.flatMap(r=>r.links.locationIds))],
  quantityTrackingEstablished:snapshotsByItem.has(i.itemId),mappingRequirements:scope.map(r=>({recordId:r.recordId,programme:field(r,'programme representation required'),procurement:field(r,'procurement required'),highValue:field(r,'high value scope')}))};});
 const controlledSubsetValue=(rows:Array<{amount:number|null}>)=>!controlledBoq?null:rows.length?sumKnown(rows.map(r=>r.amount)):0;
 const currencyGroups=[...new Set(boqRows.map(r=>r.currency).filter((c):c is string=>!!c))].map(currency=>{const rows=boqRows.filter(r=>r.currency===currency);return {currency,totalValue:controlledBoq?sumKnown(rows.map(r=>r.amount)):null,mappedValue:controlledSubsetValue(rows.filter(r=>mapped.has(r.itemId))),unmappedValue:controlledSubsetValue(rows.filter(r=>!mapped.has(r.itemId)))};});
 for(const row of boqRows)for(const req of row.mappingRequirements){const r=byId.get(req.recordId)!;
  if(req.programme==='yes'&&!row.programmeActivityIds.length)add('BOQ_PROGRAMME_MAPPING_REQUIRED',r,'BOQ item '+row.itemNumber+' requires programme representation.','Link the controlled activities.');
  if(req.procurement==='yes'&&!row.procurementPackageIds.length)add('BOQ_PROCUREMENT_MAPPING_REQUIRED',r,'BOQ item '+row.itemNumber+' requires a procurement package.','Establish its governed procurement scope.');
  if(req.highValue==='yes'&&!row.workfrontIds.length)add('HIGH_VALUE_SCOPE_WITHOUT_WORKFRONT',r,'Reviewed high-value BOQ item '+row.itemNumber+' has no accountable workfront.','Assign the workfront and owner.');
 }
 const dimensionValues=(dimension:'disciplines'|'locationIds'|'workfrontIds'|'procurementPackageIds')=>{
  const groups=new Map<string,{dimension:string;id:string;label:string;currency:string;rows:typeof boqRows}>();
  for(const row of boqRows)if(row.currency)for(const id of row[dimension]){const key=id+'|'+row.currency;const group=groups.get(key)??{dimension,id,label:byId.get(id)?.description??id,currency:row.currency,rows:[]};group.rows.push(row);groups.set(key,group);}
  return [...groups.values()].map(g=>({...g,rows:undefined,itemIds:g.rows.map(r=>r.itemId),value:sumKnown(g.rows.map(r=>r.amount)),basis:'Linked BOQ scope value; items may be shared across groups. Group values must not be added together.'}));
 };
 const mappings=[['programme','programmeActivityIds'],['procurement','procurementPackageIds'],['workfront','workfrontIds'],['location','locationIds']] as const;
 const mappingCoverage=[...mappings.map(([dimension,key])=>{const count=boqRows.filter(r=>r[key].length>0).length;return {dimension,mappedCount:controlledBoq?count:null,totalCount:controlledBoq?boqRows.length:null,percent:controlledBoq?pct(count,boqRows.length):null,unmappedItemIds:boqRows.filter(r=>!r[key].length).map(r=>r.itemId)};}),{dimension:'quantity tracking',mappedCount:controlledBoq?boqRows.filter(r=>r.quantityTrackingEstablished).length:null,totalCount:controlledBoq?boqRows.length:null,percent:controlledBoq?pct(boqRows.filter(r=>r.quantityTrackingEstablished).length,boqRows.length):null,unmappedItemIds:boqRows.filter(r=>!r.quantityTrackingEstablished).map(r=>r.itemId)}];
 const quantityPopulations=boqRows.map(row=>({unit:row.unit,requiredQuantity:row.quantity,itemCount:1,itemIds:[row.itemId],description:row.description,basis:'Individual BOQ item; shared units alone do not establish compatible scope.',quantityReview:/^(ls|l\.?s\.?|lump\s*sum)$/i.test(row.unit??'')&&row.quantity!==null&&row.quantity!==1?'Lump-sum quantity differs from one; check the item basis.':null}));
 const packageReconciliation=controlledBoq?(()=>{const result=reconcileScope(boqRows.map(r=>({itemId:r.itemId,itemNumber:r.itemNumber,currency:r.currency,value:r.amount})),r=>packageAssignment(r.itemId),'Not mapped to a package');
  return {...result,groups:result.groups.map(g=>({...g,packageId:g.group,reference:packageLabel(g.group),description:byId.get(g.group)?.description??null}))};})():null;
 const boqIntelligence={packageReconciliation,valueByDiscipline:dimensionValues('disciplines'),valueByLocation:dimensionValues('locationIds'),valueByWorkfront:dimensionValues('workfrontIds'),topPackages:dimensionValues('procurementPackageIds').sort((a,b)=>a.currency.localeCompare(b.currency)||(b.value??-Infinity)-(a.value??-Infinity)),quantityPopulations,mappingCoverage,source:boq.selection,itemCount:controlledBoq?boqRows.length:null,mappedItemCount:controlledBoq?boqRows.filter(r=>mapped.has(r.itemId)).length:null,
  procurementMappingPercent:controlledBoq?pct(boqRows.filter(r=>mapped.has(r.itemId)).length,boqRows.length):null,currencies:currencyGroups,
  topCostDrivers:currencyGroups.map(g=>({currency:g.currency,items:boqRows.filter(r=>r.currency===g.currency&&r.amount!==null).sort((a,b)=>b.amount!-a.amount!).slice(0,20)})),rows:boqRows};
 const events:Array<{recordId:string;kind:string;stage:string;series:string;dateIso:string;value:number;unit:string;authority:string}>=[];
 // G7-47: the required-delivery curve is plotted on the same assessed need date the lateness
 // checks use, and every delivery curve states its date basis.
 for(const row of packageRows)if(row.needDate&&!row.notApplicable)events.push({recordId:row.recordId,kind:'throughput',stage:'delivery',series:'required',dateIso:row.needDate,value:1,unit:'records',authority:'assessed_need_date'});
 const requiredDateBasis='Assessed need date of each package, the same date the lateness checks use: '+(procurementDateChoice==='programme'?'the confirmed linked programme need date.':procurementDateChoice==='register'?'the confirmed register required-on-site date.':'the earlier of the linked programme need date and the register required-on-site date (screening until the procurement date basis is chosen).');
 const curveDateBasis=(kind:string,stage:string,series:string)=>kind!=='throughput'||stage!=='delivery'?null:series==='required'?requiredDateBasis
  :series==='planned'?'Planned delivery date as recorded in the register, or its required-on-site date where no planned delivery date is stated. The lateness checks use the assessed need date (the required curve).'
  :series==='forecast'?'Forecast delivery date as recorded in the register.':'Actual delivery date as recorded, on or before the Data Date.';
 for(const r of byKind('package'))for(const stage of ['rfq','tender return','award','po','delivery']){const dates=milestone(r,stage);for(const series of ['planned','forecast','actual'] as const){const when=dates[series];if(when&&(series!=='actual'||isOnDate(when,dataDateIso)))events.push({recordId:r.recordId,kind:'throughput',stage,series,dateIso:when,value:1,unit:'records',authority:'governed_record'});}}
 for(const r of byKind('submittal'))for(const stage of ['submission','review','approval','rejection','resubmission']){const dates=milestone(r,stage);for(const series of ['planned','forecast','actual'] as const){const when=dates[series]??(stage==='submission'?date(r,series==='planned'?'planned issue':series==='actual'?'actual issue':'forecast issue'):null);if(when&&(series!=='actual'||isOnDate(when,dataDateIso)))events.push({recordId:r.recordId,kind:'submittal_throughput',stage,series,dateIso:when,value:1,unit:'records',authority:'governed_record'});}}
 for(const r of byKind('package')){const amount=numeric(r,'package value','amount','value'),currency=field(r,'currency');if(amount===null||!currency)continue;const dates=milestone(r,'po');for(const series of ['planned','forecast','actual'] as const){const when=dates[series];if(when&&(series!=='actual'||isOnDate(when,dataDateIso)))events.push({recordId:r.recordId,kind:'commitment_value',stage:'po',series,dateIso:when,value:amount,unit:currency,authority:'source_package_value'});}}
 const groupEvents=new Map<string,typeof events>();for(const e of events){const key=[e.kind,e.stage,e.series,e.unit].join('|');const list=groupEvents.get(key)??[];list.push(e);groupEvents.set(key,list);}
 const curves=[...groupEvents].map(([key,rows])=>{let cumulative=0;const buckets=new Map<string,typeof events>();for(const e of rows){const list=buckets.get(e.dateIso)??[];list.push(e);buckets.set(e.dateIso,list);}return {key,kind:rows[0]!.kind,stage:rows[0]!.stage,series:rows[0]!.series,unit:rows[0]!.unit,dateBasis:curveDateBasis(rows[0]!.kind,rows[0]!.stage,rows[0]!.series),population:rows.map(r=>r.recordId),dataDateIso,denominator:null,weighting:rows[0]!.kind==='commitment_value'?'Package value by currency':'Count of dated events; throughput, not physical progress',points:[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([dateIso,entries])=>({dateIso,value:round(cumulative+=entries.reduce((n,e)=>n+e.value,0)),recordIds:entries.map(e=>e.recordId)}))};});
 const weightedPackages=byKind('package').map(r=>{const template=lifecycleById.get(field(r,'lifecycle id'));const stages=template?ids(field(template,'stages')):[];const weights=stages.map(s=>numeric(template!,s+' weight'));const total=weights.every(w=>w!==null&&w>=0)?sumKnown(weights):null;const basis=field(r,'weighting basis');const weight=basis==='controlled package value'?numeric(r,'package value','amount','value'):basis==='controlled management weight'?numeric(r,'management weight'):null;let earned=0;let known=!!dataDateIso&&stages.length>0&&total===100;
  stages.forEach((stage,i)=>{const when=milestone(r,stage).actual;if(isOnDate(when,dataDateIso))earned+=weights[i]??0;else if(!(when&&dataDateIso&&when>dataDateIso)&&!(date(r,stage+' status as of')===dataDateIso&&field(r,stage+' status')==='not started'))known=false;});
  return {recordId:r.recordId,basis,unit:basis==='controlled package value'?field(r,'currency')||null:'management weight',weight,percent:known?earned:null,lifecycleId:template?.recordId??null};});
 const weightedGroups=[...new Set(weightedPackages.map(r=>r.basis+'|'+r.unit))].map(key=>{const rows=weightedPackages.filter(r=>r.basis+'|'+r.unit===key),complete=populations.package!.state==='established'&&rows.every(r=>r.percent!==null&&r.weight!==null&&r.weight>0&&r.unit);const total=sumKnown(rows.map(r=>r.weight));return {key,unit:rows[0]?.unit??null,basis:rows[0]?.basis??null,value:complete&&total?round(rows.reduce((n,r)=>n+r.percent!*r.weight!,0)/total):null,denominator:complete?total:null,includedRecordIds:rows.filter(r=>r.percent!==null&&r.weight!==null).map(r=>r.recordId),excludedRecordIds:rows.filter(r=>r.percent===null||r.weight===null).map(r=>r.recordId),explanation:complete?'Governed lifecycle weights and complete package denominator.':'Weighted procurement progress not established. Confirm the full set of packages, package weights and dated lifecycle status.'};});
 mark('scope_and_curve_projections');
 const operations=operationalReporting(state);
 const operationalRows=new Map([...operations.rfi.current,...operations.quality.current].flatMap(row=>row.sourceRefs.map(ref=>[ref,row] as const)));
 const registerRows=governed.map(r=>{const raised=date(r,'raised date','identified date','submitted date','actual issue','incident date','event start','report date','effective date');const actual=date(r,'actual date','actual issue'),approval=date(r,'approval date'),verified=date(r,'verification date'),closed=date(r,'closed date','close date'),rectified=date(r,'rectified date'),accepted=date(r,'acceptance date','handover acceptance date');
  const statusAsOf=date(r,'status as of');const rawStatus=field(r,'status','outcome').toLowerCase();
  const due=date(r,'due date','required by','required response',...(r.kind==='package'?['required on site','required on site date']:[]));
  const verifiedEvidence=r.state==='verified'&&r.sourceActive&&r.receipts.length>0&&isOnDate(verified,dataDateIso);
  const sourceRegisterCandidate=r.state==='extracted_candidate'&&r.sourceActive;
  const sourceOperational=sourceRegisterCandidate&&['design','quality'].includes(r.kind)?r.receipts.map(receipt=>operationalRows.get('evidence-document:'+receipt.documentId+':'+receipt.locator)).find(Boolean):undefined;
  const sourceClosed=sourceOperational?['closed','answered'].includes(sourceOperational.status):sourceRegisterCandidate&&isOnDate(closed,dataDateIso)&&/^(closed|complete|completed|resolved)$/i.test(rawStatus);
  const sourceAccepted=sourceRegisterCandidate&&isOnDate(accepted,dataDateIso)&&/^(accepted|approved|passed|commissioned|complete|completed)$/i.test(rawStatus);
  const verificationRequired=(isOnDate(accepted,dataDateIso)||isOnDate(closed,dataDateIso))&&!verifiedEvidence&&!sourceClosed&&!sourceAccepted;
  if(verificationRequired)add('VERIFICATION_EVIDENCE_REQUIRED',r,'Reported acceptance or closure is awaiting verified supporting evidence.','Review the supporting document and date, then record a Verified decision. Reported dates remain visible.');
  const rawLatenessStatus=/\b(?:overdue|late)\b/i.test(rawStatus);
  if(rawLatenessStatus&&!due)add('DELIVERY_LATENESS_DUE_DATE_REQUIRED',r,'The source labels this record '+(rawStatus||'late')+' but no required/due date is established.','Provide or reconcile the applicable required date before CMeng states that this record is overdue.');
  let currentStatus='not_established';if(dataDateIso){if(sourceAccepted||isOnDate(accepted,dataDateIso)&&verifiedEvidence)currentStatus='accepted';else if(sourceClosed||isOnDate(closed,dataDateIso)&&verifiedEvidence)currentStatus='closed';else if(verificationRequired)currentStatus='verification_required';else if(approval&&approval<=dataDateIso)currentStatus='source_approved';else if(actual&&actual<=dataDateIso)currentStatus=['quality','commissioning'].includes(r.kind)&&['passed','failed','retest required','accepted','rejected'].includes(rawStatus)&&isOnDate(date(r,'outcome date')??statusAsOf,dataDateIso)?rawStatus:'performed';else if(raised&&raised<=dataDateIso)currentStatus='open';if(currentStatus==='not_established'&&statusAsOf===dataDateIso&&!rawLatenessStatus&&!['approved','accepted','closed','commissioned','complete','passed'].includes(rawStatus))currentStatus=rawStatus||'not_established';}
  // Source RFI/NCR lifecycles use the same dated authority as dashboard and Ask.
  if(sourceOperational)currentStatus=sourceClosed?'closed':sourceOperational.status==='open'?'open':'not_established';
  // Scope establishes when the requirement exists, not when it is completed.
  // Every completion/outcome above must independently satisfy its event date.
  const firstEvidence=[raised,actual,approval,verified,closed,accepted,statusAsOf].filter((d):d is string=>!!d).sort()[0];const scope=firstEvidence&&dataDateIso?(firstEvidence<=dataDateIso?'current':'future'):'undated';
  const overdue=currentStatus==='not_established'||!dataDateIso||!due?null:!['accepted','closed','source_approved','passed'].includes(currentStatus)&&due<dataDateIso;
  const owner=field(r,'owner','responsible','responsible party','assigned to')||null;
  const programmeContext=registerProgrammeContext(r.links.activityIds,activities);
  return {recordId:r.recordId,reference:r.reference,kind:r.kind,description:r.description,discipline:field(r,'discipline')||null,owner,sourceStatus:rawStatus||null,currentStatus,scope,raisedDate:raised,dueDate:due,actualDate:actual,approvalDate:approval,rectifiedDate:rectified,verificationDate:verified,closedDate:closed,acceptedDate:accepted,verifiedEvidence,verificationRequired,overdue,programmeContext,linkedPackages:r.links.packageIds.map(id=>({recordId:byId.get(id)?.kind==='package'?id:null,reference:byId.get(id)?.reference??id})),links:r.links,fields:r.fields,receipts:r.receipts,authority:r.state==='extracted_candidate'?'source_register_not_confirmed':'confirmed',cellSources:['design','quality'].includes(r.kind)?registerCellSources(r):null};
 });
 const registerById=new Map(registerRows.map(r=>[r.recordId,r] as const));
 const registerOrder=new Map(registerRows.map((r,i)=>[r.recordId,i] as const));
 // Index the retained relationships once rather than scanning every row for each asset.
 const rowsByAsset=new Map<string,typeof registerRows>();
 for(const row of registerRows)for(const assetId of row.links.assetIds){const related=rowsByAsset.get(assetId)??[];related.push(row);rowsByAsset.set(assetId,related);}
 const rates=(rows:typeof registerRows,complete:boolean)=>{
  const outcomes=rows.filter(r=>['passed','failed','accepted','rejected'].includes(r.currentStatus));
  const pass=outcomes.filter(r=>['passed','accepted'].includes(r.currentStatus)).length;
  const outcomesComplete=complete&&outcomes.length===rows.length;
  const knownPassedCount=outcomes.filter(r=>r.currentStatus==='passed').length;
  const knownFailedCount=outcomes.filter(r=>r.currentStatus==='failed').length;
  return {knownOutcomeCount:outcomes.length,unknownOutcomeCount:rows.length-outcomes.length,
   knownPassedCount,knownFailedCount,
   passedCount:outcomesComplete?knownPassedCount:null,failedCount:outcomesComplete?knownFailedCount:null,
   passRatePercent:outcomesComplete?pct(pass,rows.length):null,
   basis:outcomesComplete?'Rate uses the confirmed complete set of current applicable records at the Data Date; future and undated rows are excluded.':'Known current outcomes remain visible, but the rate is withheld until the set of applicable records and their outcomes are complete.'};
 };
 const allHandover=registerRows.filter(r=>r.kind==='handover'),handoverRows=allHandover.filter(r=>r.scope==='current'),handoverKnown=allHandover.every(r=>r.scope==='future'||r.currentStatus!=='not_established'&&r.scope!=='undated'&&!r.verificationRequired);
 const handover={population:populations.handover!,acceptedKnownCount:handoverRows.filter(r=>r.currentStatus==='accepted').length,readinessPercent:populations.handover!.state==='established'&&handoverKnown?pct(handoverRows.filter(r=>r.currentStatus==='accepted').length,handoverRows.length):null,rows:handoverRows};
 const hsePosition=deliveryHsePosition(byKind('hse'),dataDateIso,populations.hse!.state==='established');
 // T11/SW-54: the master/dashboard and procurement readers do not need
 // the specialist workfront breakdown's complete WBS progress calculations.
 // Keep the original producer and its full output, evaluated only when used.
 const workfrontGeneratedAt=new Date().toISOString();
 const calculateWorkfrontMatrix=()=>{
 const scopeGroups=new Map<string,{dimension:string;label:string;recordIds:string[];activityIds:Set<string>;groupSource?:string}>();
 for(const r of byKind('workfront'))for(const [dimension,labels] of [['discipline',[field(r,'discipline')]],['location',r.links.locationIds]] as const)for(const label of labels.filter(Boolean)){const key=dimension+'|'+label;const group=scopeGroups.get(key)??{dimension,label,recordIds:[],activityIds:new Set<string>()};group.recordIds.push(r.recordId);r.links.activityIds.forEach(id=>group.activityIds.add(id));scopeGroups.set(key,group);}
 // A specialist workfront register enriches the programme; its absence must
 // not hide programme progress that is already classified in Activity Review.
 // Derive all missing workfront dimensions from one full classified source
 // population; keep the existing discipline-then-location output order.
 if(model){
  const missing=(['discipline','location'] as const).filter(dimension=>
   ![...scopeGroups.values()].some(group=>group.dimension===dimension));
  if(missing.length){
   const rows=projectScopeClassification(state,model).rows;
   for(const dimension of missing)for(const row of rows){
    // SW-27: the programme's own activity codes, then WBS level (location),
    // then a labelled name match; the source label stays with its group.
    const value=dimension==='discipline'?row.disciplineGroup:row.locationGroup;
    const source=(dimension==='discipline'?row.disciplineGroupSource:row.locationGroupSource)??null;
    const label=value&&source?value:'Unclassified',groupSource=value&&source?source:'Not grouped';
    const key=dimension+'|'+(label==='Unclassified'?label:JSON.stringify([groupSource,label]));
    const group=scopeGroups.get(key)??{dimension,label,recordIds:[],activityIds:new Set<string>(),groupSource};
    group.activityIds.add(row.activityId);scopeGroups.set(key,group);
   }
  }
 }
 // Deferred workfront calculation is timed independently when requested.
 // The workfront scope dimensions retain all their activity IDs. Reuse one
 // controlled baseline and one planning configuration for all these groups,
 // instead of sorting revisions and rebuilding assumptions for every group.
 const workfrontBaseline=state.schedules.filter(r=>['baseline','revised_baseline'].includes(r.role)
   &&isAdoptedProgrammeRevision(state,r)&&isOnDate(r.revision.model.dataDateIso?.slice(0,10)??null,dataDateIso))
   .sort((a,b)=>(a.revision.model.dataDateIso??'').localeCompare(b.revision.model.dataDateIso??'')).at(-1)?.revision.model??null;
 const baselineSourceIds=new Set(workfrontBaseline?.activities.map(row=>row.activityId)??[]);
 const currentSourceIds=new Set(model?.activities.map(row=>row.activityId)??[]);
 const sameIds=!!workfrontBaseline&&!!model&&baselineSourceIds.size===workfrontBaseline.activities.length&&currentSourceIds.size===model.activities.length&&model.activities.every(row=>!!row.activityId&&baselineSourceIds.has(row.activityId));
 const sharedExactBaselineIds=sameIds?new Map(model!.activities.map(row=>[row.activityId,row.activityId])):undefined;
 // Every workfront uses the same full programme revision, baseline and Data Date.
 // Calculate its unchanged per-activity working-calendar positions once, not
 // again for each discipline/location workfront and the same 8,000+ activity baseline.
 const sharedPlanPositions=model&&scopeGroups.size?sharedProjectPlanPositions(state,model,workfrontBaseline):undefined;
 const workfrontConfig={baselineModel:workfrontBaseline,...(sharedExactBaselineIds?{sharedExactBaselineIds}:{}),...(sharedPlanPositions?{sharedPlanPositions}:{}),
   sharedProgrammeLongLeadActivityIds:explicitProgrammeLongLead.activityIds,readinessEvidence:state.controls.readinessEvidence,
   generatedAt:workfrontGeneratedAt,producerVersion:'shared-progress-breakdown',
   config:projectScheduleControlBasis(state).analysisConfig};
 // A source workfront may be indexed by both its discipline and location.
 // When both dimensions have the *identical ordered set* of governed activity
 // rows, recomputing its WBS/working-calendar progress cannot change a figure.
 // Share only this exact subpopulation; each distinct group, project, version
 // and source snapshot still receives its own complete calculation.
 // JSON encoding avoids ambiguous separators in user-supplied activity IDs.
 const workfrontProjectionCache=new Map<string,ReturnType<typeof buildDeliveryWorkfrontBreakdown>>();
 let workfrontBuildCount=0,workfrontReuseCount=0;
 const workfrontMatrix=[...scopeGroups.values()].map(group=>{
  const selected=[...group.activityIds].map(id=>activities.get(id)).filter((a):a is NonNullable<typeof a>=>!!a);
  // Workfront decisions consume precisely rows and overallSummary. The full
  // specialist Progress Breakdown continues returning its complete dimensions.
  let progress:ReturnType<typeof buildDeliveryWorkfrontBreakdown>|null=null;
  if(model&&selected.length){
   const orderedSourceIds=JSON.stringify(selected.map(activity=>activity.activityId));
   const prior=workfrontProjectionCache.get(orderedSourceIds);
   if(prior){progress=prior;workfrontReuseCount++;}
   else{
    progress=buildDeliveryWorkfrontBreakdown({...model,activities:selected},workfrontConfig);
    workfrontProjectionCache.set(orderedSourceIds,progress);
    workfrontBuildCount++;
   }
  }
  const rows=progress?.rows??[];
  const total=progress?.overallSummary??null;
  const unfinished=selected.filter(a=>a.status!=='completed');
  const blockedActivityIds=unfinished.filter(a=>Object.values(state.controls.readinessEvidence[a.activityId]??{}).some(r=>r.state==='blocked')).map(a=>a.activityId);
  const linkedBlockers=unfinished.flatMap(a=>Object.values(state.controls.readinessEvidence[a.activityId]??{}).filter(r=>r.state==='blocked').flatMap(r=>r.records?.filter(record=>record.state==='blocked').map(record=>record.recordId??record.note)??[r.note??'Linked prerequisite blocked']));
  // G8-44: one blocked item never makes a whole group blocked. A group is blocked when one of its
  // own gates is blocked or every unfinished activity in it is blocked; otherwise it is partly
  // blocked, with the count of blocked unfinished activities beside it.
  const gates=readiness.filter(r=>group.recordIds.includes(r.recordId));const ready=gates.some(r=>r.state==='blocked')||unfinished.length>0&&blockedActivityIds.length===unfinished.length?'blocked':blockedActivityIds.length?'partly_blocked':gates.some(r=>r.state==='unknown')||!gates.length?'unknown':gates.some(r=>r.state==='at_risk')?'at_risk':'ready';
  return {dimension:group.dimension,label:byId.get(group.label)?.description??group.label,groupSource:group.groupSource??(group.recordIds.length?'From workfront register':null),recordIds:group.recordIds,activityIds:[...group.activityIds],programmeRevisionId:current?.revision.revisionId??null,
   // SW-27: a group total is calculated from its known members; the members
   // it could not use are counted beside it, never blanking the whole group.
   plannedPercent:total?.currentPlanPercent??null,baselinePlannedPercent:total?.baselinePlannedPercent??null,scheduleProgressPercent:total?.durationWeightedProgressPercent??null,
   ...groupUnknownCounts(selected,total),
   variancePercentagePoints:total?.currentPlanCoveragePercent===100&&total?.durationWeightedCoveragePercent===100?total.scheduleMinusCurrentPlanPercentagePoints??null:null,
   readinessState:ready,blockedActivityCount:blockedActivityIds.length,unfinishedActivityCount:unfinished.length,mainBlockers:[...new Set([...linkedBlockers,...gates.flatMap(g=>g.rows.filter(r=>r.applicable&&r.outcome==='blocked').map(r=>r.requirement))])],
   activityCount:selected.length,completedActivityCount:selected.filter(a=>a.status==='completed').length,
   authority:group.recordIds.length?'From workfront register':'Calculated from programme classifications',
   progressAuthority:'Shared Progress Breakdown calculation; programme progress is separate from installed physical quantities and workfront acceptance.',wbsRows:rows,readiness:gates};
 });
 if(profiling)process.stdout.write(JSON.stringify({
  event:'delivery_workfront_scope_reuse',projectId:state.projectId,
  sourceGroupCount:scopeGroups.size,uniqueSourceScopeCount:workfrontBuildCount,
  reusedIdenticalScopeCount:workfrontReuseCount,
 })+'\n');
  return workfrontMatrix;
 };
 let cachedWorkfrontMatrix:ReturnType<typeof calculateWorkfrontMatrix>|undefined;
 const supplierKey=(value:string|null|undefined)=>String(value??'').trim().toLocaleLowerCase();
 const registeredSuppliers=byKind('supplier').map(r=>{const names=[r.reference,r.description,field(r,'company')].map(supplierKey).filter(Boolean);const packages=packageRows.filter(p=>p.supplierIds.includes(r.recordId)||p.supplier&&names.includes(supplierKey(p.supplier))),packageIds=new Set(packages.map(p=>p.recordId));const related=registerRows.filter(row=>row.links.supplierIds.includes(r.recordId)||row.links.packageIds.some(id=>packageIds.has(id)));
  return {recordId:r.recordId,reference:r.reference,description:r.description,packages,packageCount:packages.length,
   // G7-61: one late population with the procurement pages (open packages on unfinished work);
   // packages whose linked work is complete are counted apart, as close-out.
   lateKnownPackageCount:packages.some(p=>p.overdueUndelivered||p.headroomCalendarDays!==null)?packages.filter(p=>!p.registerCleanup&&(p.overdueUndelivered||p.forecastLate)).length:null,
   closeoutPackageCount:packages.filter(p=>p.registerCleanup&&!p.deliveredAtDataDate&&!p.deliveredStatusOnly).length,
   unresolvedPackageCount:packages.length?packages.filter(p=>p.headroomCalendarDays===null).length:null,
   materials:materialRows.filter(p=>packageIds.has(p.recordId)),quality:related.filter(q=>q.kind==='quality'),hse:related.filter(q=>q.kind==='hse'),workfronts:related.filter(q=>q.kind==='workfront'),
   existingRiskIds:[...new Set([r,...related.map(q=>byId.get(q.recordId)!)].flatMap(q=>q.links.riskIds))],existingVariationIds:[...new Set([r,...related.map(q=>byId.get(q.recordId)!)].flatMap(q=>q.links.variationIds))],
   commercialAuthority:'/commercial/modules/commercial-overview',source:r};});
 const supplierNames=new Map<string,string>();for(const row of packageRows)if(row.supplier&&!supplierNames.has(supplierKey(row.supplier)))supplierNames.set(supplierKey(row.supplier),row.supplier.trim());
 const sourceSuppliers=[...supplierNames.values()].filter(name=>!registeredSuppliers.some(r=>[r.reference,r.description,field(r.source,'company')].some(v=>v?.trim().toLowerCase()===name.trim().toLowerCase()))).map(name=>{
  const packages=packageRows.filter(r=>supplierKey(r.supplier)===supplierKey(name));
  return {recordId:'supplier-name:'+name,reference:name,description:'From procurement register',packages,packageCount:packages.length,lateKnownPackageCount:packages.filter(r=>!r.registerCleanup&&(r.overdueUndelivered||r.forecastLate)).length,closeoutPackageCount:packages.filter(r=>r.registerCleanup&&!r.deliveredAtDataDate&&!r.deliveredStatusOnly).length,unresolvedPackageCount:packages.filter(r=>!r.deliveredAtDataDate&&r.headroomCalendarDays===null&&!r.overdueUndelivered).length,authority:'From register, not yet confirmed',sourceRefs:packages.flatMap(r=>r.receipts)};
 });
 mark('supplier_rows');
 const supplierRows=[...registeredSuppliers,...sourceSuppliers];
 // Unknown outcomes remain an explicitly counted exclusion; they do not enter a pass denominator.
 const summaries=Object.fromEntries(deliveryKinds.map(kind=>{
  const rows=registerRows.filter(r=>r.kind===kind),currentRows=rows.filter(r=>r.scope==='current'),complete=populations[kind]!.state==='established'&&!!dataDateIso&&rows.every(r=>r.scope==='future'||r.scope==='current'&&r.currentStatus!=='not_established'&&!r.verificationRequired);
  const count=(condition:(r:typeof rows[number])=>boolean)=>complete?currentRows.filter(condition).length:null;
  // Dated source approval closes a submittal review. It is not a test outcome
  // or general acceptance/closure of other kinds of delivery record.
  const closeCount=count(r=>['closed','accepted'].includes(r.currentStatus)||kind==='submittal'&&r.currentStatus==='source_approved');
   const knownOpenCount=currentRows.filter(r=>!['closed','accepted','source_approved','passed','not_established','verification_required'].includes(r.currentStatus)).length;
   const knownOverdueCount=currentRows.length&&currentRows.every(r=>r.overdue!==null)?currentRows.filter(r=>r.overdue===true).length:null;
  const reviewPeriods=currentRows.flatMap(row=>{const r=byId.get(row.recordId)!,submitted=date(r,'actual submission date','submitted date','actual issue'),response=date(r,'response date','approval date');if(!isOnDate(submitted,dataDateIso)||!isOnDate(response,dataDateIso))return [];const period=days(response,submitted);if(period!==null&&period<0){add('REVIEW_DATE_ORDER_INVALID',r,'The response date precedes the submission date.','Reconcile the dated source; this interval is excluded from completed review statistics.');return [];}return period===null?[]:[period];});
  return [kind,{totalRequired:populations[kind]!.denominator,currentCount:complete?currentRows.length:null,knownCurrentCount:currentRows.length,knownOpenCount,unknownStatusCount:currentRows.filter(r=>['not_established','verification_required'].includes(r.currentStatus)).length,knownOverdueCount,futureCount:rows.filter(r=>r.scope==='future').length,undatedCount:rows.filter(r=>r.scope==='undated').length,
   openCount:count(r=>!['closed','accepted','source_approved','passed','not_established','verification_required'].includes(r.currentStatus)),overdueCount:rows.every(r=>r.scope==='future'||r.overdue!==null)?count(r=>r.overdue===true):null,
   closedCount:closeCount,closurePercent:complete?pct(closeCount,currentRows.length):null,retestCount:count(r=>r.currentStatus==='retest required'),
   ...rates(currentRows,complete),reviewPeriodCalendarDays:reviewPeriods.length?round(reviewPeriods.reduce((a,b)=>a+b,0)/reviewPeriods.length):null,reviewPeriodKnownCount:reviewPeriods.length}];
 }));
 // F48: a permit with no stated activity link is linked through the register only by
 // an exact single match: exactly one other register record citing the same permit
 // reference, else exactly one workfront stating the same area. Any other case stays
 // "not linked"; no link is guessed.
 const linkKey=(value:string|null|undefined)=>typeof value==='string'?value.trim().toLowerCase().replace(/\s+/g,' '):'';
 const recordAreas=(r:DeliveryRecord)=>[...new Set([...r.links.locationIds,field(r,'location'),field(r,'area'),field(r,'zone'),field(r,'work area')].map(linkKey).filter(Boolean))];
 const permitCitations=new Map<string,DeliveryRecord[]>(),areaWorkfronts=new Map<string,DeliveryRecord[]>();
 for(const r of governed){
  if(r.kind!=='permit')for(const ref of field(r,'permit id').split(/[;,]/).map(linkKey).filter(Boolean)){const rows=permitCitations.get(ref)??[];if(!rows.includes(r))rows.push(r);permitCitations.set(ref,rows);}
  if(r.kind==='workfront')for(const area of recordAreas(r)){const rows=areaWorkfronts.get(area)??[];if(!rows.includes(r))rows.push(r);areaWorkfronts.set(area,rows);}
 }
 const permitWorkLink=(r:DeliveryRecord):{activityIds:string[];basis:'stated_activity'|'permit_reference'|'area'|'not_linked';viaRecordId:string|null;reason:string|null}=>{
  if(r.links.activityIds.length)return {activityIds:r.links.activityIds,basis:'stated_activity',viaRecordId:null,reason:null};
  const byRef=permitCitations.get(linkKey(r.reference))??[];
  if(r.reference&&byRef.length===1&&byRef[0]!.links.activityIds.length)return {activityIds:byRef[0]!.links.activityIds,basis:'permit_reference',viaRecordId:byRef[0]!.recordId,reason:null};
  if(byRef.length>1)return {activityIds:[],basis:'not_linked',viaRecordId:null,reason:byRef.length+' register records cite this permit reference; not linked'};
  const areas=recordAreas(r),byArea=[...new Set(areas.flatMap(area=>areaWorkfronts.get(area)??[]))];
  if(areas.length&&byArea.length===1&&byArea[0]!.links.activityIds.length)return {activityIds:byArea[0]!.links.activityIds,basis:'area',viaRecordId:byArea[0]!.recordId,reason:null};
  return {activityIds:[],basis:'not_linked',viaRecordId:null,reason:byArea.length>1?byArea.length+' workfronts share this area; not linked':byRef.length===1||byArea.length===1?'The matching register record has no programme activity link':'No stated activity, permit reference or area match'};
 };
 const permitRows=byKind('permit').map(r=>{
  const issued=date(r,'issue date','actual issue'),expiry=date(r,'expiry date','valid until','valid to'),start=date(r,'valid from')??issued,permanent=field(r,'expiry applicable')==='no';
  const pending=!start&&!issued&&/pending|applied|submitted|awaiting/i.test(field(r,'status'));
  const status=pending?'pending':!dataDateIso||!start?'not_established':issued&&issued>dataDateIso?'future_issue':start>dataDateIso?'not_yet_valid':!permanent&&!expiry?'validity_not_established':expiry&&expiry<dataDateIso?'expired':'valid';
  const workLink=permitWorkLink(r);
  const linked=workLink.activityIds.map(id=>activities.get(id)).filter((row):row is NonNullable<typeof row>=>!!row);
  const hasUnresolvedLinks=workLink.activityIds.some(id=>!activities.has(id));
  const openLinked=linked.some(row=>row.status!=='completed'&&row.activityType!=='wbs_summary');
  const affectsOpenWork=openLinked?true:!linked.length||hasUnresolvedLinks?null:false;
  const openWorkAnswer=affectsOpenWork===true?'Affects open work':affectsOpenWork===false?'Does not affect open work':'Not linked to verified programme work';
  return {...registerById.get(r.recordId)!,affectsOpenWork,openWorkAnswer,workLinkBasis:workLink.basis,workLinkLabel:workLink.basis==='stated_activity'?'Stated activity':workLink.basis==='permit_reference'?'Permit reference (one register match)':workLink.basis==='area'?'Area (one workfront match)':'Not linked'+(workLink.reason?': '+workLink.reason:''),workLinkRecordId:workLink.viaRecordId,workLinkActivityIds:workLink.activityIds,workLinkNote:workLink.reason,owner:field(r,'owner','responsible party')||null,issuingAuthority:field(r,'issuing authority','authority')||null,issueDate:issued,validFrom:start,expiryDate:expiry,permitStatus:status,headroomCalendarDays:days(date(r,'required by','due date'),issued),renewalRequired:field(r,'renewal required')||null};
 });
 const spareRows=byKind('spare').map(r=>{
  const value=(name:string)=>{const n=numeric(r,name+' quantity');return !invalidFields.get(r.recordId)?.has(name+' quantity')&&n!==null&&n>=0&&(name==='required'||isOnDate(date(r,name+' date','status as of'),dataDateIso))?n:null;};
  const required=value('required'),delivered=value('delivered'),accepted=value('accepted'),stored=value('stored'),handedOver=value('handed over'),linked=value('asset linked'),unit=field(r,'unit')||null;
  const before=findings.length;
  for(const [code,left,right,label] of [['SPARES_DELIVERED_ABOVE_REQUIREMENT',delivered,required,'Delivered above requirement'],['SPARES_ACCEPTED_ABOVE_DELIVERED',accepted,delivered,'Accepted above delivered'],['SPARES_ACCEPTED_ABOVE_REQUIREMENT',accepted,required,'Accepted above requirement'],['SPARES_STORED_ABOVE_ACCEPTED',stored,accepted,'Stored above accepted'],['SPARES_STORED_ABOVE_REQUIREMENT',stored,required,'Stored above requirement'],['SPARES_HANDED_OVER_ABOVE_STORED',handedOver,stored,'Handed over above stored'],['SPARES_HANDED_OVER_ABOVE_ACCEPTED',handedOver,accepted,'Handed over above accepted'],['SPARES_HANDED_OVER_ABOVE_DELIVERED',handedOver,delivered,'Handed over above delivered'],['SPARES_HANDED_OVER_ABOVE_REQUIREMENT',handedOver,required,'Handed over above requirement']] as const)if(left!==null&&right!==null&&left>right)add(code,r,label+': '+left+' / '+right+(unit?' '+unit:'')+'.','Reconcile the quantities against their source and scope. Original quantities and signed remaining values are retained.');
  return {...registerById.get(r.recordId)!,unit,required,delivered,accepted,stored,assetLinked:linked,handedOver,remaining:difference(required,handedOver),quantityExceptions:findings.slice(before).map(f=>f.message)};
 });
 const assetRows=byKind('asset').map(r=>{
  // Look up forward and reverse links, deduplicate, then retain original register order.
  const linked=new Map<string,(typeof registerRows)[number]>();
  for(const item of rowsByAsset.get(r.recordId)??[])linked.set(item.recordId,item);
  for(const id of r.links.recordIds){const item=registerById.get(id);if(item)linked.set(item.recordId,item);}
  const related=[...linked.values()].sort((a,b)=>(registerOrder.get(a.recordId)??Number.MAX_SAFE_INTEGER)-(registerOrder.get(b.recordId)??Number.MAX_SAFE_INTEGER));
  return {...registerById.get(r.recordId)!,readiness:gatesFor(r),installationDate:actualOn(r,'installation'),inspectionAcceptance:actualOn(r,'inspection acceptance'),commissioningDate:actualOn(r,'commissioning'),takingOverDate:actualOn(r,'taking over'),
   system:field(r,'system')||null,location:field(r,'location')||null,criticality:field(r,'criticality')||null,
   originalSourceFlags:r.sourceValueReview?.originalValues??null,sourceValueReview:r.sourceValueReview??null,
   tagInstalledStatus:field(r,'tag installed')||null,commissionedStatus:field(r,'commissioned')||null,omManualStatus:field(r,'o m manual')||null,warrantyStatus:field(r,'warranty')||null,
   statusAsOfIso:date(r,'status as of'),sourceStatusBasis:(r.sourceValueReview?'Reviewed source flag interpretation: '+r.sourceValueReview.reference+'. Original flags remain in the source record. ':'')+(date(r,'status as of')?'Reported asset flags as of '+date(r,'status as of')+'. Dated installation, testing and formal acceptance remain separate.':'Reported asset flags have no status date. They do not establish completion or acceptance at the Data Date.'),
   tests:related.filter(q=>q.kind==='commissioning'),requirements:related.filter(q=>q.kind==='handover'),snags:related.filter(q=>q.kind==='snag'),spares:spareRows.filter(q=>q.links.assetIds.includes(r.recordId)),acceptanceAuthority:'Dated source position; commissioning and handover acceptance are separate.'};
 });
 const locations=byKind('location').map(r=>{const path:string[]=[];const visited=new Set<string>();let current:DeliveryRecord|undefined=r;while(current&&!visited.has(current.recordId)){visited.add(current.recordId);path.unshift(current.description??current.reference??current.recordId);current=byId.get(field(current,'parent location id'));}return {recordId:r.recordId,reference:r.reference,description:r.description,parentId:field(r,'parent location id')||null,level:field(r,'location type')||null,path:path.join(' / ')};});
 // Material observations are cumulative snapshots, never added to another snapshot of the same package.
 const materialCurves:Array<any>=[];
 for(const row of materialRows){const r=byId.get(row.recordId)!;if(!row.unit)continue;
  for(const stage of ['required','ordered','manufactured','shipped','delivered','accepted','released'] as const){const value=row[stage];const when=stage==='required'?packageRows.find(p=>p.recordId===r.recordId)?.programmeNeedDate:date(r,stage+' date',stage+' as of','status as of');
   if(value!==null&&when)materialCurves.push({key:'material|'+r.recordId+'|'+stage,kind:'material_quantity',stage,series:stage==='required'?'controlled_requirement':'actual',unit:row.unit,packageId:r.recordId,discipline:field(r,'discipline')||null,locationIds:r.links.locationIds,population:[r.recordId],dataDateIso,denominator:row.required,weighting:'Cumulative quantity snapshot; compatible unit only',points:[{dateIso:when,value,recordIds:[r.recordId]}]});
  }
  const linked=r.links.boqItemIds;if(!row.installedScopeEstablished)continue;
  const snapshots=linked.flatMap(id=>snapshotsByItem.get(id)??[]).sort((a,b)=>a.asOfIso.localeCompare(b.asOfIso));
  const dates=[...new Set(snapshots.map(s=>s.asOfIso.slice(0,10)))].sort();
  const latest=new Map<string,number>();let index=0;const points=dates.map(when=>{while(index<snapshots.length&&snapshots[index]!.asOfIso.slice(0,10)<=when){const observation=snapshots[index++]!;latest.set(observation.quantityItemId,observation.installedQuantity);}return {dateIso:when,value:sumKnown(linked.map(id=>latest.get(id)??null)),recordIds:[r.recordId],boqItemIds:linked};}).filter(p=>p.value!==null);
  if(points.length)materialCurves.push({key:'material|'+r.recordId+'|installed',kind:'material_quantity',stage:'installed',series:'actual',unit:row.unit,packageId:r.recordId,population:[r.recordId],boqItemIds:linked,dataDateIso,denominator:row.required,weighting:'Existing Installed Quantities snapshots; all mapped items must have an observation',points});
 }
 const weightedCurves:Array<any>=[];
 for(const group of weightedGroups){const entries=weightedPackages.filter(r=>r.basis+'|'+r.unit===group.key);
  for(const series of ['planned','forecast','actual'] as const){
   const stages=entries.map(entry=>{const r=byId.get(entry.recordId)!,template=byId.get(entry.lifecycleId??'');return {entry,stages:template?ids(field(template,'stages')).map(stage=>({stage,weight:numeric(template,stage+' weight'),when:milestone(r,stage)[series]})):[]};});
   const valid=populations.package!.state==='established'&&entries.length>0&&entries.every(r=>r.weight!==null&&r.weight>0&&r.unit)&&stages.every(r=>r.stages.length&&r.stages.every(s=>s.weight!==null&&s.weight>=0&&s.when)&&sumKnown(r.stages.map(s=>s.weight))===100);
   if(!valid)continue;const denominator=sumKnown(entries.map(r=>r.weight))!;
   const dates=[...new Set(stages.flatMap(r=>r.stages.map(s=>s.when!)))].filter(d=>series!=='actual'||isOnDate(d,dataDateIso)).sort();
   weightedCurves.push({key:'weighted|'+group.key+'|'+series,kind:'weighted_procurement_progress',stage:'lifecycle',series,unit:'%',population:entries.map(r=>r.recordId),dataDateIso,denominator,weighting:group.basis+' / '+group.unit,points:dates.map(when=>({dateIso:when,value:round(stages.reduce((n,r)=>n+r.entry.weight!*r.stages.filter(s=>s.when!<=when).reduce((m,s)=>m+s.weight!,0),0)/denominator),recordIds:entries.map(r=>r.recordId)}))});
  }
 }
 const curveData=[...curves,...materialCurves,...weightedCurves].map(curve=>{
  const kind:DeliveryKind=curve.kind==='submittal_throughput'?'submittal':'package';const included=new Set(curve.population),all=byKind(kind).filter(r=>!('packageId' in curve)||r.recordId===curve.packageId);
  const conflicts=curve.kind==='throughput'&&curve.stage==='delivery'&&curve.series==='forecast'?packageRows.filter(r=>included.has(r.recordId)&&r.deliveryDateConflict):[];
  return {...curve,sourceDateConflictCount:conflicts.length,sourceDateConflictRecordIds:conflicts.map(r=>r.recordId),qualification:conflicts.length?'Source forecast retained: '+conflicts.length+' completed-status package(s) have conflicting delivery dates. Review their receipts and dates before relying on this forecast.':null,denominator:curve.denominator??(curve.unit==='records'?populations[kind]!.denominator:null),period:{from:curve.points[0]?.dateIso??null,to:curve.points.at(-1)?.dateIso??null},populationState:populations[kind]!.state,includedRecordIds:[...included],excludedRecordIds:all.filter(r=>!included.has(r.recordId)).map(r=>r.recordId),sourceRecordIds:[...included],coveragePercent:populations[kind]!.state==='established'?pct(all.filter(r=>included.has(r.recordId)).length,all.length):null};
 });
 const config=projectScheduleControlBasis(state).analysisConfig;
 const recordsByRisk=new Map<string,DeliveryRecord[]>();for(const r of governed)for(const id of r.links.riskIds){const rows=recordsByRisk.get(id)??[];rows.push(r);recordsByRisk.set(id,rows);}
 const currentRisks=new Map(operations.risk.current.map(r=>[r.riskId,r]));
 const futureRiskIds=new Set(operations.risk.future.map(r=>r.riskId));
 // F15: Last Reviewed is shown as its own field. The review is stale when the next review
 // (stated, or Last Reviewed plus the stated interval) falls before the Data Date. With no
 // stated interval or next review date, staleness is not established (never assumed).
 const riskReview=(risk:{lastReviewedIso?:string|null;reviewIntervalDays?:number|null;nextReviewIso?:string|null})=>{
  const lastReviewedIso=risk.lastReviewedIso??null,interval=risk.reviewIntervalDays??null;
  const reviewDueIso=risk.nextReviewIso??(lastReviewedIso&&interval!==null?new Date(Date.parse(lastReviewedIso+'T00:00:00Z')+interval*86400000).toISOString().slice(0,10):null);
  const reviewStale=!dataDateIso||!reviewDueIso?null:reviewDueIso<dataDateIso.slice(0,10);
  const reviewBasis=!lastReviewedIso&&!risk.nextReviewIso?'Last reviewed date not stated':!reviewDueIso?'Review interval not stated; staleness not established':!dataDateIso?'Data Date missing; staleness not established':(reviewStale?'Review overdue: next review '+reviewDueIso+' is before the Data Date':'Review current: next review '+reviewDueIso)+(risk.nextReviewIso?' (stated next review)':' (last reviewed '+lastReviewedIso+' plus the stated '+interval+' days)');
  return {lastReviewedIso,reviewIntervalDays:interval,reviewDueIso,reviewStale,reviewBasis};
 };
 // T11: one lookup per risk instead of scanning every score row (three times)
 // and every package row for each risk. find() returned the first score row
 // of a risk id; a risk with no linked record has no linked long-lead package;
 // a score's rank is the first sorted position holding the same score.
 const scoreRowByRisk=new Map<unknown,(typeof operations.risk.validation.scoreRows)[number]>();
 if(operations.risk.sourceRows.length)for(const row of operations.risk.validation.scoreRows)if(!scoreRowByRisk.has(row.riskId))scoreRowByRisk.set(row.riskId,row);
 const firstScorePositions=new WeakMap<object,Map<unknown,number>>();
 const firstScorePosition=(all:ReadonlyArray<{row:{score:unknown}}>,score:unknown)=>{
  let positions=firstScorePositions.get(all);
  if(!positions){positions=new Map();for(const [i,entry] of all.entries()){const value=entry.row.score;if(value===value&&!positions.has(value))positions.set(value,i);}firstScorePositions.set(all,positions);}
  return positions.get(score)??-1;
 };
 const riskSourceRows=operations.risk.sourceRows.map(sourceRisk=>{const risk=currentRisks.get(sourceRisk.riskId)??sourceRisk;const linked=recordsByRisk.get(risk.riskId)??[];const linkedActivities=[...new Set([...(risk.linkedActivityId?[risk.linkedActivityId]:[]),...linked.flatMap(r=>r.links.activityIds)])].map(id=>activities.get(id)).filter((a):a is NonNullable<typeof a>=>!!a);return {...risk,owner:riskOwner(risk.owner),sourceOwner:risk.owner??null,reportingScope:currentRisks.has(risk.riskId)?'At reporting date':futureRiskIds.has(risk.riskId)?'After reporting date':'Reporting date missing',
  description:risk.subject??null,categories:[...new Set([risk.category,...linked.map(r=>r.kind==='package'?'procurement':r.kind==='workfront'?'construction':r.kind)].filter(Boolean))],
  deliveryRecordIds:linked.map(r=>r.recordId),longLeadPackageIds:linked.length?packageRows.filter(p=>p.longLeadCandidate&&linked.some(r=>r.recordId===p.recordId)).map(p=>p.recordId):[],
  programmeExposure:linkedActivities.map(a=>({activityId:a.activityId,currentStartIso:a.currentStartIso,currentFinishIso:a.currentFinishIso,criticality:model?sourceFloatCriticality(model,a,config):'unknown',totalFloatHours:a.totalFloatHours})),
  probability:scoreRowByRisk.get(risk.riskId)?.probability??null,impact:scoreRowByRisk.get(risk.riskId)?.impact??null,score:scoreRowByRisk.get(risk.riskId)?.score??null,scoreBasis:operations.risk.validation.scoreBasis,...riskReview(risk)};})
  // F15: ranked by the register score, highest first; risks without a score follow in source order.
  .map((row,index)=>({row,index})).sort((a,b)=>(a.row.score===null)!==(b.row.score===null)?Number(a.row.score===null)-Number(b.row.score===null):a.row.score!==null&&b.row.score!==null&&a.row.score!==b.row.score?b.row.score-a.row.score:a.index-b.index)
  .map(({row},index,all)=>({...row,scoreRank:row.score===null?null:firstScorePosition(all,row.score)+1}));
 const riskRows=riskSourceRows.filter(r=>r.reportingScope==='At reporting date');
 const evidenceMetrics=Object.fromEntries(['quality','commissioning','snag','handover','design','submittal'].map(kind=>[kind,deliveryEvidenceMetrics(byKind(kind as DeliveryKind),dataDateIso)]));
 const commissioningRows=registerRows.filter(r=>r.kind==='commissioning').map(r=>({...r,system:field(byId.get(r.recordId)!,'system')||null,subsystem:field(byId.get(r.recordId)!,'subsystem')||null,plannedDate:date(byId.get(r.recordId)!,'planned date'),forecastDate:date(byId.get(r.recordId)!,'forecast date'),readiness:gatesFor(byId.get(r.recordId)!)}));
 const commissioningSystems=[...new Set(commissioningRows.map(r=>r.system).filter((s):s is string=>!!s))].map(system=>{const rows=commissioningRows.filter(r=>r.system===system);return {system,requiredTestCount:populations.commissioning!.state==='established'?rows.length:null,knownStartedCount:rows.filter(r=>r.actualDate&&isOnDate(r.actualDate,dataDateIso)).length,
  passedKnownCount:rows.filter(r=>['passed','accepted'].includes(r.currentStatus)).length,failedKnownCount:rows.filter(r=>r.currentStatus==='failed').length,retestKnownCount:rows.filter(r=>r.currentStatus==='retest required').length,
  readiness:rows.some(r=>r.readiness.state==='blocked')?'blocked':rows.some(r=>r.readiness.state==='unknown')?'unknown':rows.some(r=>r.readiness.state==='at_risk')?'at_risk':'ready',recordIds:rows.map(r=>r.recordId),
  commissionedState:'Requires separate dated system acceptance; passing tests alone does not establish commissioning acceptance.'};});
 const weatherRows=registerRows.filter(r=>r.kind==='weather').map(r=>{const source=byId.get(r.recordId)!,eventStart=date(source,'event start'),eventEnd=date(source,'event end'),current=isOnDate(eventStart,dataDateIso)&&isOnDate(eventEnd,dataDateIso);return {...r,eventStart,eventEnd,durationHours:current?numeric(source,'duration hours'):null,recordedWorkingImpactHours:current?numeric(source,'recorded working impact hours'):null,claimIds:source.links.claimIds,causationBasis:'Recorded site facts only. Delay causation and entitlement remain in the existing claims authority.'};});
 for(const r of registerRows){const source=byId.get(r.recordId)!;if(r.overdue)add('RECORD_OVERDUE',source,(r.reference??r.kind)+' is overdue at the programme Data Date.','Review the required response or completion action and its dated evidence.');if(['failed','rejected','retest required'].includes(r.currentStatus))add('OUTCOME_REQUIRES_ACTION',source,(r.reference??r.kind)+' has a dated '+r.currentStatus+' outcome.','Review rectification, retesting and the applicable acceptance evidence.');}
 for(const r of permitRows)if(r.permitStatus==='expired'&&r.affectsOpenWork===true)add('PERMIT_EXPIRED_OPEN_WORK',byId.get(r.recordId)!,(r.reference??'Permit')+' expired and affects unfinished linked work at the programme Data Date.','Confirm renewal and restrict only the affected open workfront until evidence supports clearance.');
 // G7-56: a blocked item names its cause: a blocked gate, a rejected submittal, a blocking
 // source status or a passed need date. Only a gate or submittal is a blocking prerequisite.
 for(const r of readiness)if(r.state==='blocked'){
  const causes=(r as {blockedBy?:string[]}).blockedBy?.length?(r as {blockedBy?:string[]}).blockedBy!:r.rows.filter(g=>g.applicable===true&&g.outcome==='blocked').map(g=>'gate '+(g.reference??g.requirement??g.recordId)+' is blocked');
  add('READINESS_BLOCKED',byId.get(r.recordId)!,(r.reference??r.kind)+' is blocked: '+(causes.length?causes.join('; '):'a linked gate is blocked')+'.',causes.some(c=>c.startsWith('gate ')||c.startsWith('linked submittal '))?'Open the gate detail and resolve the dated blocker before releasing this scope.':'Obtain the actual delivery or recovery date, or correct the source status, before releasing this scope.');
 }
 mark('final_registers_and_curves');
 const relationshipAuthorities=Object.fromEntries(([['riskIds','risk'],['claimIds','claim'],['noticeIds','notice'],['variationIds','variation']] as const).map(([key,kind])=>{const linked=new Set(governed.flatMap(r=>r.links[key]));return [kind,linked.size?deliveryAuthorityCatalog(state,kind).filter(r=>linked.has(r.id)):[]];}));
 mark('relationship_authorities');
 if(profiling)process.stdout.write(JSON.stringify({event:'delivery_cold_profile',projectId:state.projectId,version:state.version,registerRecords:records.length,activities:model?.activities.length??0,boqItems:quantities?.items.length??0,stages,totalMs:stages.reduce((sum,part)=>sum+part.ms,0)})+'\n');
 return {schemaVersion:'1.0',producerVersion:'delivery-v1',projectId:state.projectId,projectVersion:state.version,dataDateIso,programmeLabel:current?.revision.label??current?.sourceFilename??null,programmeRevisionId:current?.revision.revisionId??null,
  scheduleAuthorityReview:scheduleAuthorityReview(state),records,documents:source.documents,diagnostics:source.diagnostics,populations,findings,
  packageRows,materialRows,itemMaterialRows,boqIntelligence,scheduleLongLeadCandidates,readiness,curves:curveData,weightedGroups,registerRows,handover,hsePosition,get workfrontMatrix(){return cachedWorkfrontMatrix??(cachedWorkfrontMatrix=calculateWorkfrontMatrix());},supplierRows,summaries,permitRows,spareRows,assetRows,locations,riskRows,riskSourceRows,evidenceMetrics,commissioningRows,commissioningSystems,weatherRows,relationshipAuthorities,
  existingAuthorities:{risk:operations.risk,quality:operations.quality,rfi:operations.rfi,programme:'/schedule/modules/schedule-analytics',progress:'/schedule/modules/progress-report',installedQuantities:'/schedule/modules/quantity-scurve',commercial:'/commercial/modules/commercial-overview',claims:'/schedule/modules/delay-claims'},
  lifecycleExamples:lifecycleExamples.map(t=>({...t,state:'example_requires_adoption',weights:null})),
  authorityScope:'Delivery consumes the controlled BOQ, programme, progress and commercial/claims authorities. Procurement exposure does not establish EOT or causation.'};
}
/** Raw controls and their dated reporting view must share one calculated
 * Delivery position. Using the source object as a WeakMap key made the first
 * Look-Ahead and first Management/Visual view construct the same full register
 * independently, including its forecast. The reporting view retains the
 * complete original source rows and applies the same project Data Date. */
export function deliveryPosition(state:ProjectRuntimeState){
 const scoped=reportingState(state);
 const prior=cache.get(scoped);
 if(prior?.version===scoped.version)return prior.value;
 const value=buildDelivery(scoped);
 cache.set(scoped,{version:scoped.version,value});
 return value;
}
const deliverySourceDomain=(key:string):ManagementSourceDomain|null=>
 ['delivery-control','procurement-packages','material-tracking','long-lead','procurement-scurves','delivery-suppliers','procurement-readiness'].includes(key)?'procurement':
 key==='delivery-submittals'?'submittal':
 key==='delivery-design'?'design':
 key==='delivery-quality'?'quality':
 key==='delivery-hse'?'hse':
 key==='delivery-risks'?'risk':null;
/** S1: the register each delivery page reads, named when it is missing. */
const DELIVERY_REGISTER_NEED:Record<string,string>={package:'a procurement register',submittal:'a submittal register',supplier:'a supplier register',design:'an RFI / design register',workfront:'workfront readiness records',location:'location records',quality:'an NCR / inspection register',permit:'a permit register',hse:'HSE incident and exposure records',commissioning:'a test and commissioning register',asset:'an asset register',snag:'a snag list',spare:'a spares register',handover:'a handover requirement register',weather:'weather or disruption records'};
export function deliveryModule(state:ProjectRuntimeState,key:string):ModuleRuntimeResult{
 if(key==='delivery-interfaces')return deliveryExportResult(state,interfaceModule(state));
 const definition=deliveryPages.find(p=>p[0]===key);if(!definition)return {key,status:'blocked',reason:'Delivery page not found.',dependencies:[],data:null};
 const p=deliveryPosition(state),kind=definition[3],title=definition[1],riskPage=key==='delivery-risks',risk=p.existingAuthorities.risk,boqScope=boqScopeIntelligence(state),interfaces=interfaceIntelligence(state);
 const reportedHse=key==='delivery-hse'?hseReportPosition(state,p.dataDateIso):null;
 const records=p.records.filter(r=>riskPage?r.links.riskIds.length>0:r.kind===kind);
 // SW-32: the risk page reads only the risk register. With no risk records read,
 // the risk population, counts and position are unknown (null with a reason);
 // BOQ wording is never a risk and is listed only as labelled candidates.
 const riskSourceDocumentCount=riskPage?managementSourceInventory(state).domains.find(domain=>domain.domain==='risk')?.documentCount??0:0;
 const riskUnknownReason=!riskPage||risk.sourceRecordCount>0?null:riskSourceDocumentCount>0?'Risk register uploaded but not read':'No risk register read';
 const riskKnown=riskPage&&!riskUnknownReason,riskComplete=riskKnown&&risk.complete;
 const population=riskPage?{kind:'risk',scopeId:null,state:riskComplete?'established':'not_established',denominator:riskComplete?risk.currentRecordCount:null,knownRecordCount:riskKnown?risk.currentRecordCount:null,pendingRecordCount:riskKnown?risk.undatedRecordCount+ risk.unknownStatusCount:null,recordIds:risk.current.map(r=>r.riskId),basis:riskUnknownReason?riskUnknownReason+'. The full set of risks is unknown.':'Existing project risk register, using its dated status and source completeness checks. Delivery record review does not approve the risk register.',confirmedAt:null}:p.populations[kind]!;
 const summary=riskPage?{currentCount:riskComplete?risk.currentRecordCount:null,knownCurrentCount:riskKnown?risk.currentRecordCount:null,openCount:riskComplete?risk.current.filter(r=>r.status==='open').length:null,knownOpenCount:riskKnown?risk.current.filter(r=>r.status==='open').length:null,overdueCount:null,knownOverdueCount:null,passRatePercent:null,unknownOutcomeCount:riskKnown?risk.unknownStatusCount:null,basis:population.basis}:p.summaries[kind]!;
 const populationAuthority=deliveryPopulationAuthority(population,records.length,summary.currentCount);
 const confirmedInterfaceIssues=interfaces.rows.filter(r=>r.authority==='confirmed'&&r.state!=='closed');
 const interfaceRiskRows=confirmedInterfaceIssues.map(r=>({recordId:'interface-risk:'+r.interfaceId,riskId:'IF-'+r.interfaceId,reference:r.interfaceId,description:r.consequence||('Open interface '+r.interfaceId),status:'Candidate',rating:null,score:null,categories:['interface'],owner:r.responsibleParty??r.givingParty??r.receivingParty,authority:'candidate',candidateGroup:'Candidates from interface records, not risks',basis:'Professional delivery-risk candidate from confirmed Interface records; not a formal Project Risk Register entry.',linkedActivity:r.linkedActivity,relatedPackages:r.packageIds}));
 const baseGovernedRows:any[]=key==='delivery-control'||key==='procurement-packages'?p.packageRows:key==='long-lead'?p.packageRows.filter(r=>r.longLeadCandidate):key==='material-tracking'?(p.materialRows.some(r=>r.required!==null||r.installed!==null)?p.materialRows:p.materialRows.length?p.itemMaterialRows:[]):key.includes('readiness')&&key!=='handover-readiness'?p.readiness.filter(r=>r.kind===(key==='construction-readiness'?'workfront':'package')):key==='construction-discipline'||key==='construction-locations'?p.workfrontMatrix.filter(r=>r.dimension===(key==='construction-discipline'?'discipline':'location')):key==='delivery-suppliers'?p.supplierRows:key==='delivery-risks'?p.riskSourceRows:key==='delivery-commissioning'?p.commissioningRows:key==='delivery-permits'?p.permitRows:key==='delivery-spares'?p.spareRows:key==='delivery-assets'?p.assetRows:key==='delivery-weather'?p.weatherRows:p.registerRows.filter(r=>r.kind===kind);
 const readinessInterfaceIssues=(row:any)=>{
  if(key!=='construction-readiness'&&key!=='procurement-readiness')return [];
  const source=p.records.find(r=>r.recordId===row.recordId);
  const sourceActivities=new Set(source?.links.activityIds??[]);
  const ref=String(row.reference??'').trim().toLowerCase(),description=String(row.description??'').trim().toLowerCase();
  return confirmedInterfaceIssues.filter(issue=>{
   if(key==='procurement-readiness'&&issue.packageIds.includes(row.recordId))return true;
   if(key==='construction-readiness'&&issue.workfrontIds.includes(row.recordId))return true;
   const affected=String(issue.affectedWorkfront??'').trim().toLowerCase();
   if(key==='construction-readiness'&&affected&&(affected===ref||affected===description))return true;
   const linked=String(issue.linkedActivity??'').split(';').map(v=>v.trim()).filter(Boolean);
   return linked.some(id=>sourceActivities.has(id));
  });
 };
 const governedRows:any[]=baseGovernedRows.map(row=>{
  if(key==='long-lead')return {...row,currentStatus:row.currentStage,
    authority:row.sourceState==='extracted_candidate'?'From register, not yet confirmed':'Confirmed',
    basis:row.sourceState==='extracted_candidate'
      ?'Source-register fact used immediately; confirming the complete register remains separate. '+row.leadTimeBasis
      :row.leadTimeBasis};
  if(key!=='construction-readiness'&&key!=='procurement-readiness')return row;
  const linked=readinessInterfaceIssues(row);if(!linked.length)return row;
  const interfaceState=linked.some(issue=>issue.state==='blocked'||issue.state==='overdue')?'blocked':'at_risk';
  const stateNow=row.state==='blocked'||interfaceState==='blocked'?'blocked':row.state==='at_risk'||interfaceState==='at_risk'?'at_risk':row.state;
  return {...row,state:stateNow,interfaceGate:{state:interfaceState,interfaceIds:linked.map(issue=>issue.interfaceId),basis:'Confirmed unresolved Interface records explicitly linked to this package/workfront or one of its programme activities.'}};
 });
 // One indexed material lookup for large 30k-item BOQs. A .find per row
 // was quadratic and could hang the Material Tracking page on real tenders.
 const itemMaterialByReference=key==='material-tracking'?new Map(p.itemMaterialRows.map(row=>[row.reference,row] as const)):null;
 const boqCandidateRows:any[]=key==='procurement-packages'?boqScope.packages.map((r,index)=>({recordId:'boq-package-'+index,reference:r.package,description:r.package,discipline:r.discipline,system:r.system,itemCount:r.itemCount,currency:r.currency,packageValue:r.readableValue,longLeadItemCount:r.longLeadItemCount,criticalItemCount:r.criticalItemCount,procurementPriority:r.priority,currentStatus:'candidate from BOQ'}))
  :key==='long-lead'?[...boqScope.longLead.map(r=>({recordId:r.itemId,reference:r.itemNumber,description:r.description,discipline:r.discipline,system:r.system,package:r.packageCandidate,currency:r.currency,amount:r.amount,procurementPriority:r.procurementPriority,confirmedLeadTime:null,latestOrderDate:null,currentStatus:'candidate from BOQ',authority:'candidate',basis:'BOQ-screened long-lead scope candidate; not a confirmed procurement package.'})),...p.scheduleLongLeadCandidates]
  :key==='material-tracking'?boqScope.rows.map(r=>({recordId:r.itemId,reference:r.itemNumber||r.itemId,description:r.description,discipline:r.discipline,location:[r.building,r.tower,r.zone,r.floor,r.level,r.area].filter(Boolean).join(' / ')||null,package:r.packageCandidate,unit:r.unit,required:r.quantity,ordered:null,manufactured:null,delivered:null,accepted:null,installed:itemMaterialByReference?.get(r.itemNumber||r.itemId)?.installed??null,remainingToOrder:null,remainingToDeliver:null,remainingToInstall:itemMaterialByReference?.get(r.itemNumber||r.itemId)?.remainingToInstall??null,currentStatus:'scope from BOQ',state:'extracted_candidate',basis:'BOQ quantity and scope only. Procurement, delivery and installation status are not established.'}))
  :key==='construction-discipline'?boqScope.dimensions.discipline.map((r,index)=>({recordId:'boq-discipline-'+index,dimension:'discipline',label:r.value,discipline:r.value,itemCount:r.itemCount,currency:r.currency,readableValue:r.readableValue,currentStatus:'scope from BOQ'}))
  :key==='construction-locations'?[...boqScope.dimensions.building,...boqScope.dimensions.tower,...boqScope.dimensions.zone,...boqScope.dimensions.floor,...boqScope.dimensions.level,...boqScope.dimensions.area].map((r,index)=>({recordId:'boq-location-'+index,dimension:'location',label:r.value,location:r.value,locationType:r.dimension,itemCount:r.itemCount,currency:r.currency,readableValue:r.readableValue,currentStatus:'scope from BOQ'}))
  :key==='delivery-risks'?boqScope.risks.map(r=>({recordId:r.riskId,riskId:r.riskId,reference:r.riskId,description:r.risk,category:r.category,categories:[r.category],impact:r.impact,probability:r.probability,severity:r.severity,rating:r.severity,score:null,mitigation:r.mitigation,responsibleParty:r.responsibleParty,owner:riskOwner(r.responsibleParty),status:'Candidate',currentStatus:'Candidate from BOQ wording, not a risk',candidateGroup:'Candidates from BOQ wording, not risks',state:'extracted_candidate',basis:r.basis,relatedPackages:r.relatedPackages}))
  :[];
 const relevantSourceRecords=key==='delivery-risks'
  ?p.existingAuthorities.risk.sourceRecordCount
  :['procurement-packages','long-lead','material-tracking'].includes(key)
    ?p.records.filter(r=>r.kind==='package'&&!['superseded','scenario'].includes(r.state)).length
    :key==='construction-discipline'
      ?p.records.filter(r=>r.kind==='workfront'&&!['superseded','scenario'].includes(r.state)).length
      :key==='construction-locations'
        ?p.records.filter(r=>['workfront','location'].includes(r.kind)&&!['superseded','scenario'].includes(r.state)).length
        :records.length;
 const reviewedSpecialistPosition=!riskPage&&records.some(r=>['working','conflicted','stale','superseded'].includes(r.state));
 const useBoqCandidates=!riskPage&&governedRows.length===0&&boqCandidateRows.length>0&&!reviewedSpecialistPosition;
 let rows:any[]=useBoqCandidates?boqCandidateRows:governedRows;
 // SW-33: Handover Readiness reads the supplied asset register when no handover
 // requirement register exists; programme names remain the last, labelled fallback.
 if(key==='handover-readiness'&&!rows.length&&p.assetRows.length)rows=p.assetRows;
 const taskKind:ProgrammeTaskKind|null=key==='delivery-commissioning'?'testing':['handover-readiness','delivery-assets'].includes(key)?'handover':null;
 const taskScope=taskKind?programmeTaskScope(state,taskKind):null;
 const programmeRows=taskKind?programmeTaskReviewBasis(state,taskKind)?.rows??[]:key==='delivery-closeout'?(projectControlSchedule(state)?.revision.model.activities??[]).filter(a=>!['wbs_summary','level_of_effort'].includes(a.activityType)&&/\bsnag(?:ging)?\b|punch list/i.test(a.name??'')):[];
 const programmeFallback=!rows.length?programmeRows.map(a=>({activityId:a.activityId,reference:a.activityId,description:a.name,status:a.status,currentStartIso:a.currentStartIso,currentFinishIso:a.currentFinishIso,actualFinishIso:a.actualFinishIso,percentComplete:a.percentComplete,authority:'Programme progress; acceptance remains separate',basis:taskScope?.basis??'Programme activities with snag or punch list names; scope has not been confirmed.'})):[];
 if(programmeFallback.length)rows=programmeFallback;
 const disruptionEvents=key==='delivery-weather'&&!rows.length?(claimsReporting(state)?.current.events??[]).filter(event=>/weather|climat|rain|wind|heat|disrupt/i.test(event.category+' '+event.title)).map(event=>({
  reference:event.eventId,description:event.title,eventStart:event.startIso,eventEnd:event.endIso,
  durationHours:null,recordedWorkingImpactHours:null,claimIds:claimsReporting(state)?.current.claims.filter(claim=>claim.eventIds.includes(event.eventId)).map(claim=>claim.claimId)??[],
  activityIds:event.relatedActivityIds,authority:'From claim register; causation not established',sourceRefs:event.evidenceRefs.map(ref=>ref.sourceId+':'+ref.locator),
 })) : [];
 if(disruptionEvents.length)rows=disruptionEvents;
 const scopedProgramme=key==='construction-readiness'&&!rows.length?reportingState(state):null;
 const readinessModel=scopedProgramme?projectControlSchedule(scopedProgramme)?.revision.model:null;
 const programmeReadiness=readinessModel?buildLookAheadProjection(readinessModel,{generatedAt:new Date().toISOString(),producerVersion:'shared-lookahead-readiness',drivingActivityIds:cachedIndependentForecast(readinessModel,new Date().toISOString()).drivingNetwork?.activityIds,readinessEvidence:scopedProgramme!.controls.readinessEvidence}):null;
 const readinessClassifications=readinessModel?new Map(projectScopeClassification(state,readinessModel).rows.map(row=>[row.activityId,row])):new Map();
 if(programmeReadiness)rows=programmeReadiness.rows.map(row=>({...row,reference:row.activityId,description:row.name,
  discipline:readinessClassifications.get(row.activityId)?.discipline??null,readinessPercent:pct(row.readiness.readyCount,row.readiness.dimensions.filter(d=>d.state!=='not_applicable').length),
  // ABB G2_PLANNING-55: the same readiness state as the Look-Ahead tab for the same activity.
  state:readinessReviewState(row.readiness),unknownCount:row.readiness.unknownCount,
  applicableCount:row.readiness.dimensions.filter(d=>d.state!=='not_applicable').length,
  notApplicableCount:row.readiness.dimensions.filter(d=>d.state==='not_applicable').length,
  rows:row.readiness.dimensions,authority:'Calculated from programme and linked register evidence'}));
 const rowIds=new Set(records.map(r=>r.recordId));
 const interfaceFindingRows=(key==='construction-readiness'||key==='procurement-readiness')
  ?confirmedInterfaceIssues.filter(issue=>governedRows.some(row=>readinessInterfaceIssues(row).some(linked=>linked.interfaceId===issue.interfaceId)))
  :interfaces.blockers;
 const interfaceFindings=interfaceFindingRows.map(r=>({code:'INTERFACE_'+r.state.toUpperCase(),recordId:null,message:(r.interfaceId+' · '+(r.consequence||'Interface requires action')),action:r.escalation||'Resolve the interface before the affected workfront/package proceeds.',sourceRefs:r.sourceRefs}));
 const findings=useBoqCandidates?interfaceFindings:[...p.findings.filter(f=>key==='delivery-control'||f.recordId&&rowIds.has(f.recordId)),...(['delivery-control','construction-readiness','procurement-readiness','delivery-risks'].includes(key)?interfaceFindings:[])];
 const programmeModel=projectControlSchedule(state)?.revision.model??null;
 const programmeActivities=new Map(programmeModel?.activities.map(a=>[a.activityId,a])??[]);
 const controlRecordById=key==='delivery-control'?new Map(p.records.map(r=>[r.recordId,r] as const)):null;
 const controlPackageById=key==='delivery-control'?new Map(p.packageRows.map(r=>[r.recordId,r] as const)):null;
 const workfrontsByActivity=new Map<string,typeof p.records>();
 if(key==='delivery-control')for(const record of p.records){
  if(!['governed','verified'].includes(record.state)||record.kind!=='workfront')continue;
  for(const activityId of record.links.activityIds){const list=workfrontsByActivity.get(activityId)??[];list.push(record);workfrontsByActivity.set(activityId,list);}
 }
 const deliveryControlActions=key==='delivery-control'?findings.map((finding,index)=>{
  const source=finding.recordId?controlRecordById?.get(finding.recordId)??null:null;
  const packageRow=finding.recordId?controlPackageById?.get(finding.recordId)??null:null;
  const issueInterface=interfaceFindingRows.find(row=>finding.message.startsWith(row.interfaceId+' ·'))??null;
  const activityIds=[...new Set([...(source?.links.activityIds??[]),...(issueInterface?.linkedActivity?issueInterface.linkedActivity.split(';').map(v=>v.trim()).filter(Boolean):[])])];
  const workfronts=[...new Map(activityIds.flatMap(id=>workfrontsByActivity.get(id)??[]).map(r=>[r.recordId,r] as const)).values()];
  const affectedSchedule=activityIds.map(id=>{const activity=programmeActivities.get(id);return activity?(activity.name?activity.activityId+' · '+activity.name:activity.activityId):id;});
  const consequence=issueInterface?.consequence
    ??(packageRow?.forecastLate===true&&packageRow.headroomCalendarDays!==null
      ?'Forecast delivery is '+(-packageRow.headroomCalendarDays)+' calendar days after '+packageRow.needDateBasis.toLowerCase()+'.'
      :'The Delivery exception affects the linked scope or programme until the recorded action is resolved.');
  const requiredDate=issueInterface?.requiredDate??packageRow?.needDate??null;
  const owner=issueInterface?.responsibleParty??issueInterface?.givingParty??issueInterface?.receivingParty??packageRow?.owner??(source?field(source,'owner','responsible party')||null:null);
  const packageLabel=issueInterface?.package??packageRow?.reference??(source?.kind==='package'?(source.reference??source.recordId):null);
  return {
   actionId:'delivery-control:'+index,issue:finding.message,workfront:workfronts.map(r=>r.reference??r.description??r.recordId).join('; ')||issueInterface?.affectedWorkfront||null,
   affectedSchedule,package:packageLabel,owner,requiredDate,consequence,action:finding.action,
   severity:issueInterface&&['blocked','overdue'].includes(issueInterface.state)||packageRow?.forecastLate===true?'high':'medium',
   authority:issueInterface?'source':source?'source':'calculated',sourceRefs:finding.sourceRefs
  };
 }).sort((a,b)=>(a.severity==='high'?0:1)-(b.severity==='high'?0:1)||(a.requiredDate??'9999').localeCompare(b.requiredDate??'9999')):[];
 const hasRows=riskPage?(risk.state!=='missing'||useBoqCandidates):records.length>0||rows.length>0;const pending=deliveryAwaitingDecision(records,recordKind=>p.populations[recordKind]);
 const sourceDocs=p.documents.filter(d=>d.kind===kind);const unread=sourceDocs.some(d=>d.state==='submitted_not_interpreted'||d.state==='mapping_required'||d.state==='partial_page_reading');
 const sourceDomain=deliverySourceDomain(key);
 const sourceAvailability=sourceDomain?managementSourceInventory(state).domains.find(domain=>domain.domain===sourceDomain)??null:null;
 const sourceEvidenceAvailable=riskPage?riskUnknownReason==='Risk register uploaded but not read':Boolean(sourceAvailability?.documentCount);
 const usable=hasRows||sourceEvidenceAvailable;
 let managementPosition=useBoqCandidates?(key==='long-lead'?'CMeng has identified '+rows.length+' qualified long-lead scope candidate'+(rows.length===1?'':'s')+' from BOQ and/or controlled schedule/WBS intelligence. These candidates remain separate from confirmed procurement status, supplier dates and lateness.':'CMeng has identified '+rows.length+' useful '+title.toLowerCase()+' candidate'+(rows.length===1?'':'s')+' from the BOQ. Scope, quantities, values and professional classifications are shown now; actual supplier/status dates remain separate until supplied.'+(relevantSourceRecords?' '+relevantSourceRecords+' supplied specialist record'+(relevantSourceRecords===1?' is':'s are')+' also awaiting review and may improve this position.':'')):!hasRows&&sourceEvidenceAvailable?(sourceAvailability?.readableRowCount!==null?sourceAvailability!.readableRowCount+' source row(s) are available from '+sourceAvailability!.documentCount+' '+sourceAvailability!.label.toLowerCase()+' document(s). The confirmed Delivery records and dependent dates/mappings are not yet established; the source evidence remains visible.':sourceAvailability!.documentCount+' relevant source document(s) are available. The confirmed Delivery records are not yet established, so CMeng shows the supplied evidence without inventing lifecycle status or schedule impact.'):!hasRows?unread?title+': the source files are retained, but their records could not yet be read reliably. Other Project information remains available.':'No current '+title.toLowerCase()+' information is available from the Project records.':!p.dataDateIso?title+': the records are available, but a reporting programme would add the dated position.':null;
 // S1: an unknown figure carries why it is unknown and what is needed (reason).
 const metric=(label:string,value:number|null,unit='records',basis='Confirmed records at the programme Data Date',reason='')=>({label,value,unit,state:value===null?'unavailable':'calculated',basis,...(value===null&&reason?{reason}:{})}) as {label:string;value:number|null;unit:string;state:string;basis:string;reason?:string};
 const establishedCurrentCount=establishedPopulationCount(summary.currentCount,populationAuthority),establishedOpenCount=establishedPopulationCount(summary.openCount,populationAuthority),establishedOverdueCount=establishedPopulationCount(summary.overdueCount,populationAuthority);
 const sourceCountBasis=populationAuthority.state==='established'?'Confirmed complete set of applicable records':'From supplied register, not yet confirmed as the complete set of applicable records';
 const visibleCurrentCount=establishedCurrentCount??summary.knownCurrentCount??null;
 const visibleOpenCount=establishedOpenCount??summary.knownOpenCount??null;
 const visibleOverdueCount=establishedOverdueCount??summary.knownOverdueCount??null;
 let metrics=!hasRows&&sourceEvidenceAvailable?[
   metric('Source documents',sourceAvailability!.documentCount,'documents','Relevant supplied evidence; document presence does not establish a complete set of control records.'),
   metric('Readable source rows',sourceAvailability!.readableRowCount,'rows',sourceAvailability!.basis),
   metric('Governed current records',null,'records','Not established until the complete set of applicable source records and their mapping are confirmed.'),
   metric('Overdue / late position',null,'records','Requires dated, confirmed records; source availability alone does not establish lateness.')
 ]:[metric('Current records',visibleCurrentCount,'records',sourceCountBasis),metric('Open records',visibleOpenCount,'records',sourceCountBasis),metric('Overdue records',visibleOverdueCount,'records',sourceCountBasis,(summary.knownCurrentCount??0)>0?'Needs a due date and a clear status on every current record':''),metric('Known source rows',populationAuthority.state==='established'?population.denominator:population.knownRecordCount,'records',populationAuthority.state==='established'?'Rows of the confirmed complete set of applicable records.':'Source-register rows currently usable for facts; whether this is the complete register is not yet confirmed.'),metric('Awaiting confirmation',hasRows?pending.filter(r=>r.state==='extracted_candidate').length:null,'records','Clean source rows remain usable while confirmation controls completeness/percentages, not visibility.')];
 if(['delivery-control','procurement-packages','long-lead','material-tracking','procurement-scurves'].includes(key))metrics=!hasRows&&sourceEvidenceAvailable?[
   metric('Source documents',sourceAvailability!.documentCount,'documents','Relevant supplied procurement evidence; source presence does not establish a complete set of lifecycle records.'),
   metric('Readable source rows',sourceAvailability!.readableRowCount,'rows',sourceAvailability!.basis),
   metric('Source-marked long lead',sourceAvailability!.signals.longLeadMarkedCount,'items','Explicit Long Lead marks read from the procurement source. This does not establish schedule impact or lateness.'),
   metric('Governed procurement status',null,'','Package completeness, dated lifecycle, programme linkage and lateness remain separate until established.')
  ]:useBoqCandidates?[
   metric('BOQ scope items',boqScope.itemCount,'items','Readable BOQ scope used for this candidate view.'),
   metric('Candidate packages',boqScope.packages.length,'packages','Packages derived from BOQ scope; not a confirmed procurement register.'),
   metric('Candidate long-lead items',boqScope.longLead.length,'items','Professional screening of actual BOQ descriptions.'),
   metric('Source-marked long lead',sourceAvailability?.signals.longLeadMarkedCount??null,'items','Explicit Long Lead marks from a supplied procurement register, when available.','Needs Long Lead marks in a supplied procurement register'),
   metric('Actual procurement status',null,'','Not recorded in the current Project information.')
  ]:[
   metric('BOQ mapped to procurement',p.boqIntelligence.procurementMappingPercent,'%','Controlled BOQ item denominator; mapped item IDs counted once.'),
   metric(population.state==='established'?'Confirmed packages':'Packages from register',p.packageRows.length,'records',sourceCountBasis),
   metric('Source-marked long lead',sourceAvailability?.signals.longLeadMarkedCount??null,'items','Explicit Long Lead marks from a supplied procurement register; schedule impact remains separate.','Needs Long Lead marks in a supplied procurement register'),
   metric('Late delivery · known subset',p.packageRows.some(r=>r.overdueUndelivered||r.headroomCalendarDays!==null)?p.packageRows.filter(r=>!r.registerCleanup&&(r.overdueUndelivered||r.forecastLate)).length:null),
   metric('Latest order unresolved',p.packageRows.length?p.packageRows.filter(r=>!r.latestOrderDate).length:null)
  ];
 // F10: in the governed procurement branch these figures come only from the shared
 // package register position (p), so every procurement page shows the same figures.
 const procurementRegisterMetrics=['delivery-control','procurement-packages','long-lead','material-tracking','procurement-scurves'].includes(key)&&!(!hasRows&&sourceEvidenceAvailable)&&!useBoqCandidates?metrics:null;
 if(key==='material-tracking'&&rows.some(r=>r.authority==='From BOQ and dated measurement register')){
  metrics=[metric('BOQ items',rows.length,'items','Each item retains its own quantity and unit.'),metric('Items with dated measurements',rows.filter(r=>r.installed!==null).length,'items','Latest measurement through the Data Date.'),metric('Procurement packages without item allocations',p.materialRows.filter(r=>r.required===null).length,'packages','Package allocation is separate from the known item quantities.')];
  // G7-33: say which source fills each unknown column, not only that it is unknown.
  const measuredItems=rows.filter(r=>r.installed!==null).length,unallocatedPackages=p.materialRows.filter(r=>r.required===null).length;
  managementPosition=countText(rows.length,'BOQ item')+' with their required quantities. '+(measuredItems?countText(measuredItems,'item')+' '+(measuredItems===1?'has':'have')+' a dated installed quantity. For the others, Installed':'None has a dated installed quantity. Installed')+' and Remaining to install need a dated installed-quantity (measurement) register with BOQ item numbers and units. Ordered, Delivered and Accepted need a procurement or material delivery register that gives quantities against BOQ item numbers'+(p.materialRows.length?' ('+unallocatedPackages+' of '+countText(p.materialRows.length,'procurement package')+' have no item allocation)':'')+'.';
 }
 if(key==='delivery-permits')metrics=[metric('Permits from register',p.permitRows.length,'records',sourceCountBasis),metric('Valid',p.permitRows.filter(r=>r.permitStatus==='valid').length),metric('Expired affecting open work',p.permitRows.filter(r=>r.permitStatus==='expired'&&r.affectsOpenWork===true).length),metric('Expired but not affecting open work',p.permitRows.filter(r=>r.permitStatus==='expired'&&r.affectsOpenWork===false).length,'records','Verified programme links lead only to completed work'),metric('Expired · not linked to programme',p.permitRows.filter(r=>r.permitStatus==='expired'&&r.affectsOpenWork===null).length,'records','Do not invent a blocker or clearance without matching source activity links'),metric('Pending approval',p.permitRows.filter(r=>r.permitStatus==='pending').length),metric('Not yet valid',p.permitRows.filter(r=>['future_issue','not_yet_valid'].includes(r.permitStatus)).length),metric('Validity dates missing',p.permitRows.filter(r=>['not_established','validity_not_established'].includes(r.permitStatus)).length)];
 if(key==='delivery-hse')metrics=[metric('Reported exposure',p.hsePosition.exposureHours,'hours',undefined,'Needs dated exposure periods with man-hours in the HSE records'),metric('Reported lost-time injuries',p.hsePosition.lostTimeInjuries,undefined,undefined,p.hsePosition.invalidInjuryRecordIds.length?'Review the invalid lost-time injury counts':'Needs lost-time injury counts for the exposure periods'),metric('Frequency rate',p.hsePosition.frequencyRate,'per '+(p.hsePosition.rateBasis??'unresolved')+' hours',p.hsePosition.explanation)];
 if(reportedHse?.periodEndIso)metrics=[metric('Reported exposure',reportedHse.metrics.manHours??null,'hours',reportedHse.scope),metric('Lost-time injuries',reportedHse.metrics.lostTimeInjuries??null,'cases',reportedHse.scope),metric('Medical treatment',reportedHse.metrics.medicalTreatmentCases??null,'cases',reportedHse.scope),metric('Restricted work',reportedHse.metrics.restrictedWorkCases??null,'cases',reportedHse.scope),metric(reportedHse.review.decision?.choice==='confirm_rates'?'Reviewed LTIFR':'Reported LTIFR',reportedHse.reportingRates.ltifr,reportedHse.reportingRates.ltifrBasisHours?'per '+reportedHse.reportingRates.ltifrBasisHours+' hours':'exposure basis not supplied',reportedHse.review.basis),metric(reportedHse.review.decision?.choice==='confirm_rates'?'Reviewed TRIR':'Reported TRIR',reportedHse.reportingRates.trir,reportedHse.reportingRates.trirBasisHours?'per '+reportedHse.reportingRates.trirBasisHours+' hours':'exposure basis not supplied',reportedHse.review.basis),...hseReconciliationMetrics(reportedHse,metric)];
 const assetRegisterRows=key==='handover-readiness'&&rows===p.assetRows;
 if(key==='handover-readiness')metrics=[metric('Handover readiness',p.handover.readinessPercent,'%','Accepted and verified requirements / confirmed set of current requirements.'),metric('Confirmed requirements',population.denominator),metric('Accepted · known subset',p.handover.rows.length?p.handover.acceptedKnownCount:null,undefined,undefined,'Needs handover requirement records with acceptance dates'),metric('Overdue',summary.overdueCount),
  ...(assetRegisterRows?[metric('Assets from register',p.assetRows.length,'assets',p.populations.asset!.state==='established'?'Confirmed complete set of applicable records':'From supplied register, not yet confirmed as the complete set of applicable records'),metric('Taken over · known subset',p.assetRows.filter(r=>r.takingOverDate).length,'assets','Dated taking-over on or before the Data Date; reported flags alone do not establish acceptance.')]:[])];
 if(key==='delivery-quality')metrics=[...metrics.slice(0,3),metric('Status unclear','unknownStatusCount' in summary?Number(summary.unknownStatusCount):null,'records','Records with unresolved status or inconsistent dates are excluded from the open count.')];
 if(key==='delivery-commissioning'||key==='delivery-quality'&&'knownOutcomeCount' in summary&&summary.knownOutcomeCount>0)metrics=[...(key==='delivery-quality'?metrics:metrics.slice(0,3)),metric(key==='delivery-commissioning'?'Test pass rate':'Known inspection outcome rate',summary.passRatePercent,'%',summary.basis),metric('Unknown outcomes',rows.length?summary.unknownOutcomeCount:null)];
 if(key==='construction-readiness'||key==='procurement-readiness')metrics=[metric('Ready · known subset',rows.length?rows.filter(r=>r.state==='ready').length:null),metric('At risk · known subset',rows.length?rows.filter(r=>r.state==='at_risk').length:null),metric('Blocked · known subset',rows.length?rows.filter(r=>r.state==='blocked').length:null),metric('Unknown readiness',rows.length?rows.filter(r=>r.state==='unknown').length:null),metric('Not applicable',rows.length?rows.filter(r=>r.state==='not_applicable').length:null,'scope items'),metric('Reviewed scope',rows.length||null,'scope items','Ready + at risk + blocked + unknown + N/A reconcile to these reviewed items.'),metric('Confirmed scope items',population.denominator)];
 if(key==='delivery-risks')metrics=riskUnknownReason?['Supplied risk records','Reported open / mitigating','Reporting date missing','Open at reporting date','Linked to Delivery · known subset'].map(label=>metric(label,null,'records',riskUnknownReason+'; the full set of risks, counts and position are unknown.')):[metric('Supplied risk records',risk.sourceRecordCount),metric('Reported open / mitigating',risk.sourceRows.filter(r=>r.status==='open').length,'records','Status as recorded in the source; undated records are not a confirmed position at the reporting date.'),metric('Reporting date missing',risk.undatedRecordCount),metric('Open at reporting date',risk.complete?p.riskRows.filter(r=>r.status==='open').length:null),metric('Linked to Delivery · known subset',p.riskSourceRows.filter(r=>r.deliveryRecordIds.length>0).length)];
 if(hasRows&&p.dataDateIso&&!pending.length){
  if(key==='construction-readiness'||key==='procurement-readiness')managementPosition=rows.filter(r=>r.state==='ready').length+' ready, '+rows.filter(r=>r.state==='at_risk').length+' at risk, '+rows.filter(r=>r.state==='blocked').length+' blocked, '+rows.filter(r=>r.state==='unknown').length+' unresolved and '+rows.filter(r=>r.state==='not_applicable').length+' not applicable in '+rows.length+' reviewed scope item'+(rows.length===1?'':'s')+'. '+(population.state==='established'?'The full set of scope items is confirmed.':'The full set of scope items still requires confirmation.');
  else if(key==='handover-readiness')managementPosition=p.handover.readinessPercent===null?'Handover readiness is unresolved. Confirm the complete set of requirements and dated verification/acceptance evidence.':p.handover.readinessPercent+'% of the confirmed current requirements are verified and accepted.';
  else if(key==='delivery-hse')managementPosition=p.hsePosition.explanation;
  else if(key==='delivery-weather')managementPosition='Recorded site events and working impacts are shown separately. These records do not establish delay causation or EOT entitlement.';
  else if(!findings.length&&population.state!=='established'&&key!=='delivery-risks')managementPosition=null;
  else if(!findings.length&&summary.currentCount!==null)managementPosition=title+': '+countText(summary.currentCount,'current reviewed record')+'; '+(summary.openCount===null?'open position unresolved':summary.openCount+' remain open')+'. '+(summary.overdueCount===null?'Overdue position is unresolved.':summary.overdueCount+' overdue at the programme Data Date.');
 }
 if(assetRegisterRows&&p.handover.readinessPercent===null)managementPosition=rows.length+' assets from the supplied asset register are shown with their reported flags and dated milestones. Handover readiness needs the confirmed set of handover requirements and dated acceptance evidence.';
 if(riskPage)managementPosition=riskUnknownReason?(riskUnknownReason==='Risk register uploaded but not read'?'Risk register uploaded but not read: '+riskSourceDocumentCount+' risk source document(s) produced no risk records. ':'No risk register read. ')+'No confirmed Project Risk Register is available, so the full set of risks, counts and position are unknown. Candidates from BOQ wording are listed separately and are not risks.':!p.dataDateIso?'Risk records are available; a reporting programme would add the dated risk position.':risk.sourceRecordCount+' risk records are supplied: '+risk.currentRecordCount+' current, '+risk.futureRecordCount+' after the Data Date and '+risk.undatedRecordCount+' without a reporting date. '+(risk.unknownStatusCount?risk.unknownStatusCount+' current risk statuses need dated evidence. ':'')+(risk.validation.state==='conflicted'?'Supplied risk ratings conflict. ':'')+(pending.length?pending.length+' linked Delivery records still need confirmation.':'');
 const ready=useBoqCandidates?false:!hasRows&&sourceEvidenceAvailable?false:riskPage?riskComplete&&risk.validation.state!=='conflicted'&&!!p.dataDateIso:hasRows&&!unread&&!!p.dataDateIso&&pending.length===0&&findings.length===0&&population.state==='established'&&metrics.every(m=>m.value!==null);
 const extras:Record<string,unknown>={};
 if(['delivery-design','delivery-quality'].includes(key)){
  const open=p.registerRows.filter(row=>row.kind===kind&&row.scope==='current'&&row.currentStatus==='open');
  const closeout=open.filter(row=>row.programmeContext.state==='completed_work');
  extras.programmeFollowUp={openOnUnfinishedWork:open.filter(row=>row.programmeContext.state==='unfinished_work').length,closeoutCount:closeout.length,
   linksNeedReview:open.filter(row=>['unlinked','links_incomplete'].includes(row.programmeContext.state)).length,closeoutRows:closeout,
   basis:'Open records on completed programme work require register close-out and any outstanding acceptance checks. They are not blockers to starting that completed work.'};
  const order=(row:any)=>row.scope==='current'&&row.currentStatus==='open'?(row.programmeContext?.state==='unfinished_work'?0:row.programmeContext?.state==='completed_work'?2:1):3;
  // F04: when every record on this page comes from the RFI / NCR register
  // itself, the page's open / overdue counts are that register's shared counts.
  const identity=canonicalHeader(kindIdentities[kind as DeliveryKind]![0]!),kindRows=p.registerRows.filter(row=>row.kind===kind);
  extras.registerIdentity=kindRows.length&&kindRows.every(row=>row.cellSources?.reference===identity)?identity:null;
  rows=[...rows].sort((a,b)=>order(a)-order(b)||(a.programmeContext?.linkedFloatHours??Infinity)-(b.programmeContext?.linkedFloatHours??Infinity)||String(a.dueDate??'9999').localeCompare(String(b.dueDate??'9999'))||String(a.reference??'').localeCompare(String(b.reference??'')));
 }
 if(riskPage)extras.derivedRiskCandidates=[...boqCandidateRows,...interfaceRiskRows];
 if(disruptionEvents.length){metrics=[metric('Reported disruption events',disruptionEvents.length,'events','Claim-register events through the Data Date')];managementPosition='Reported weather and disruption events are available from the claim register. Event dates and activity links are shown; working-hour loss and delay causation need separate evidence.';}
 if(programmeReadiness){metrics=metrics.filter(m=>m.label!=='Confirmed scope items');extras.programmeReadiness=true;managementPosition=rows.length+' activities from the shared 42-day look-ahead and overdue backlog: '+rows.filter(r=>r.state==='blocked').length+' blocked, '+rows.filter(r=>r.state==='unknown').length+' with missing readiness evidence. Open each activity for its linked prerequisites.';}
 if(['construction-discipline','construction-locations'].includes(key)&&governedRows.length){
  metrics=[metric('Programme activities',governedRows.every(row=>typeof row.activityCount==='number'&&Number.isFinite(row.activityCount))?governedRows.reduce((sum,row)=>sum+row.activityCount!,0):null,'activities'),metric('Progress groups',governedRows.length,'groups'),metric('Unclassified activities',governedRows.filter(row=>row.label==='Unclassified').every(row=>typeof row.activityCount==='number'&&Number.isFinite(row.activityCount))?governedRows.filter(row=>row.label==='Unclassified').reduce((sum,row)=>sum+row.activityCount!,0):null,'activities')];
  managementPosition='Programme progress by '+(key==='construction-discipline'?'discipline':'location')+' uses the same classifications as Activity Review. Workfront release and installed quantities retain their separate evidence.';
 }
 if(key==='delivery-suppliers'&&p.supplierRows.length){
  const linked=new Set(p.supplierRows.flatMap(row=>row.packages.map(pkg=>pkg.recordId)));
  metrics=[metric('Suppliers in available records',p.supplierRows.length,'suppliers','Distinct supplier identities from supplier and procurement registers.'),metric('Linked procurement packages',linked.size,'packages','Each linked package counted once.'),metric('Suppliers with known late packages',p.supplierRows.every(row=>typeof row.lateKnownPackageCount==='number'&&Number.isFinite(row.lateKnownPackageCount))?p.supplierRows.filter(row=>typeof row.lateKnownPackageCount==='number'&&row.lateKnownPackageCount>0).length:null,'suppliers','Suppliers with an open package on unfinished work that is late against its assessed need date: the same packages as the procurement late count. Packages on completed work are counted apart as close-out; unresolved suppliers do not count as zero.')];
  managementPosition=p.supplierRows.length+' suppliers are identified in the available supplier and procurement registers, linked to '+linked.size+' packages. Formal supplier approval and a complete supplier list remain separate.';
 }
 if(programmeFallback.length){extras.programmeFallback=true;metrics=[metric('Programme tasks',programmeFallback.length,'activities',taskScope?.basis??'Programme activities with snag or punch list names'),metric('Programme marked complete',programmeFallback.filter(r=>r.status==='completed').length,'activities','Reported programme progress; formal acceptance remains separate')];managementPosition=programmeFallback.length+' programme tasks and their current dates. '+(taskScope?.basis??'Selected by snag or punch list names.')+' Verification and formal acceptance are not established by programme progress.';}
 if(reportedHse?.periodEndIso){extras.reportedHse=reportedHse;managementPosition='Reported HSE position through '+reportedHse.periodEndIso+'. '+reportedHse.scope+(reportedHse.review.required?' Rate reconciliation or the exposure basis requires review below.':reportedHse.rates.basisEstablished&&reportedHse.rates.recordablePopulationComplete&&!reportedHse.diagnostics.length?' The reported rates reconcile with the incident and exposure table.':' The original rates and their calculation qualifications are retained below.');}
 if(['delivery-control','procurement-packages','material-tracking','long-lead','construction-discipline','construction-locations','delivery-risks'].includes(key))extras.boqIntelligence=useBoqCandidates?boqScope:p.boqIntelligence;
 if(!useBoqCandidates&&['delivery-control','procurement-packages','long-lead','material-tracking','procurement-readiness'].includes(key)){
  const packageById=new Map(p.packageRows.map(r=>[r.recordId,r] as const));
  if(rows.some(r=>packageById.has(r.recordId)))extras.packageLinkedWork=packageLinkedWorkGroups(rows,packageById);
 }
 if(key==='long-lead')extras.scheduleLongLeadCandidates=p.scheduleLongLeadCandidates;
 if(['delivery-control','handover-readiness'].includes(key))extras.handover={...p.handover,rows:undefined};
 if(taskKind){extras.handoverSourceComparison=handoverSourceComparison(state);extras.programmeTaskScope=taskScope;}
 if(['delivery-commissioning','handover-readiness'].includes(key))extras.assetSourceRows=p.assetRows.map(row=>({...row,projectId:state.projectId}));
 if(key==='delivery-control'){extras.readiness=p.readiness;extras.managementActions=deliveryControlActions;}
 if(['procurement-scurves','delivery-submittals','material-tracking'].includes(key)){extras.curves=p.curves.filter(c=>key==='procurement-scurves'||key==='delivery-submittals'&&c.kind==='submittal_throughput'||key==='material-tracking'&&c.kind==='material_quantity');extras.weightedGroups=p.weightedGroups;}
 if(key==='delivery-hse')extras.hsePosition=p.hsePosition;
 if(key==='construction-locations'){extras.locations=p.locations;extras.locationReview=locationReviewSummary(state);}
 if(key==='delivery-risks')extras.riskBasis=p.existingAuthorities.risk;
 if(key==='delivery-commissioning')extras.systems=p.commissioningSystems;
 if(p.evidenceMetrics[kind])extras.evidenceMetrics=p.evidenceMetrics[kind];
 if(procurementRegisterMetrics&&metrics===procurementRegisterMetrics)extras.metricsScope='procurement_register';
 // S1: an unknown figure without its own reason takes the page population's stated
 // next step, or names the register the page needs.
 // G8-64: a page with no register and no source document holds no figure: every count on it,
 // and in its download and Ask answers, is unknown with the register it needs, never 0.
 if(!usable)metrics=metrics.map(m=>m.value===null?m:{...m,value:null,state:'unavailable'});
 const metricReason=!hasRows?(sourceEvidenceAvailable?'Confirm the applicable source records and their mapping':'Needs '+(DELIVERY_REGISTER_NEED[kind as string]??'the supplied register')):population.state!=='established'?(riskPage?(population.basis||'Confirm the complete set of applicable records'):deliveryPopulationReason(kind)):'';
 if(metricReason)metrics=metrics.map(m=>m.value===null&&!m.reason?{...m,reason:metricReason}:m);
 extras.relationshipAuthorities=Object.fromEntries(Object.entries(p.relationshipAuthorities).map(([kind,rows])=>[kind,rows.map(r=>({id:r.id,label:r.label,authority:kind==='risk'?'Existing project Risk authority':kind==='variation'?'Existing Commercial authority':'Existing Delay / Notices / Claims authority'}))]));
 // W6: a page whose records are read states its position with its own title and
 // its own first figures, so each page answers its own question (no shared line).
 if(managementPosition===null){
  const unitShown=(m:{label:string;value:number|null;unit:string})=>m.unit==='%'?'%':m.unit&&!m.label.toLowerCase().includes(m.unit.toLowerCase().replace(/s$/,''))?' '+countUnit(m.value,m.unit):'';
  const shown=(m:{label:string;value:number|null;unit:string})=>m.label+' '+(m.value===null?'not established':(Math.round(m.value*100)/100).toLocaleString('en-US',{maximumFractionDigits:2})+unitShown(m));
  const note=pending.length?countText(pending.length,'supplied record')+' '+(pending.length===1?'is':'are')+' in use, awaiting confirmation that '+(pending.length===1?'it is':'they are')+' the complete set of applicable records.'
   :findings.length?countText(findings.length,'delivery exception')+' '+(findings.length===1?'requires':'require')+' attention.'
   :hasRows&&p.dataDateIso&&population.state!=='established'&&key!=='delivery-risks'?'Reviewed records are shown below. Confirm that these are the complete set of applicable records before relying on totals or percentages.'
   :'Confirmed records at the programme Data Date.';
  const figures=metrics.slice(0,3).map(shown).join(' · ');
  managementPosition=title+': '+(figures?figures+'. ':'')+note;
 }
 return deliveryExportResult(state,{key,status:!usable?'blocked':ready?'ready':'partial',reason:managementPosition,dependencies:useBoqCandidates?['readable BOQ scope']:['controlled programme','applicable Delivery records'],scheduleAuthorityReview:p.scheduleAuthorityReview,
  data:{projectionKey:'delivery',empty:!usable,
   // F07: the same risk register row counts as the risk register page and the project facts.
   ...(riskPage?(counts=>({riskRowCounts:counts,rowScopeLabel:counts.deliveryLabel}))(riskRowInputStatus(risk)):{}),
  deliveryPage:key,projectId:state.projectId,projectVersion:state.version,dataDateIso:p.dataDateIso,programmeLabel:p.programmeLabel,programmeRevisionId:p.programmeRevisionId,title,kind,managementPosition,boqDerivedCandidate:useBoqCandidates,candidateBasis:useBoqCandidates?boqScope.basis:null,rows:rows.map(r=>({...r,projectId:state.projectId})),metrics,findings,
   reviewRecords:records.map(r=>({recordId:r.recordId,reference:r.reference,description:r.description,kind:r.kind,state:r.state,revision:r.revision,diagnostics:r.diagnostics})),population,populationAuthority,summary,documents:sourceDocs,sourceAvailability,sourceReadingDiagnostics:p.diagnostics.filter(d=>sourceDocs.some(doc=>d.includes(doc.documentId))),authorityScope:p.authorityScope,authorityLinks:{programme:'/schedule/modules/schedule-analytics',progress:'/schedule/modules/progress-report',installed:'/schedule/modules/quantity-scurve',commercial:'/commercial/modules/commercial-overview',claims:'/schedule/modules/delay-claims'},...extras}});
}
export function deliveryDashboard(state:ProjectRuntimeState){
 const inventory=managementSourceInventory(state);
 const domain=(key:ManagementSourceDomain)=>inventory.domains.find(row=>row.domain===key)??null;
 const boq=boqScopeIntelligence(state);
 const p=deliveryPosition(state),packagePopulation=p.populations.package;
 if(!p.records.some(currentRecord)){
  return {projectId:state.projectId,dataDateIso:projectDataDate(state),programmeRevisionId:projectControlSchedule(state)?.revision.revisionId??null,
   mode:'source_available',boqMappingPercent:null,handoverReadinessPercent:null,latePackageKnownCount:null,unresolvedPackageCount:null,
   packagePopulationState:'not_established',
   confirmedPackageCount:null,knownPackageRecordCount:null,candidatePackageCount:boq.packages.length||null,candidateLongLeadCount:boq.longLead.length||null,scheduleLongLeadCandidateCount:deliveryPosition(state).scheduleLongLeadCandidates.length||null,
   sourceAvailability:{procurement:domain('procurement'),design:domain('design'),submittal:domain('submittal'),quality:domain('quality'),hse:domain('hse'),risk:domain('risk')},
   exceptions:[],exceptionCount:0,
   basis:'Available source evidence and BOQ-derived candidates are shown without asserting governed Delivery lifecycle status, lateness or schedule impact.'};
 }
 const packageSourceCount=p.records.filter(r=>r.kind==='package'&&!['superseded','scenario'].includes(r.state)).length;
 const packageAuthority=deliveryPopulationAuthority(packagePopulation,packageSourceCount,packagePopulation?.denominator??null);
 return {projectId:state.projectId,dataDateIso:p.dataDateIso,programmeRevisionId:p.programmeRevisionId,mode:state.delivery?.decisions.length?'governed_or_reviewed':'source_available',
  boqMappingPercent:p.boqIntelligence.procurementMappingPercent,handoverReadinessPercent:p.handover.readinessPercent,
  packagePopulationState:packagePopulation?.state??'not_established',
  confirmedPackageCount:packagePopulation?.denominator??null,knownPackageRecordCount:packagePopulation?.knownRecordCount??null,
  candidatePackageCount:boq.packages.length||null,candidateLongLeadCount:boq.longLead.length||null,scheduleLongLeadCandidateCount:p.scheduleLongLeadCandidates.length||null,
  latePackageKnownCount:p.packageRows.some(r=>r.overdueUndelivered||r.headroomCalendarDays!==null)?p.packageRows.filter(r=>!r.registerCleanup&&(r.overdueUndelivered||r.forecastLate)).length:null,
  unresolvedPackageCount:p.packageRows.length?p.packageRows.filter(r=>r.headroomCalendarDays===null).length:null,
  sourceAvailability:{procurement:domain('procurement'),design:domain('design'),submittal:domain('submittal'),quality:domain('quality'),hse:domain('hse'),risk:domain('risk')},
  exceptions:p.findings.slice(0,8),exceptionCount:p.findings.length,
  basis:packageAuthority.state==='established'?'Confirmed complete register.':'From supplied register, not yet confirmed as the complete set of applicable records. Clean dated rows are used now; unresolved rows qualify only the affected figures.'};
}
export function deliveryExportResult(state:ProjectRuntimeState,result:ModuleRuntimeResult):ModuleRuntimeResult{
 const data=result.data as any;if(data?.projectionKey!=='delivery')return result;
 const p=deliveryPosition(state),riskPage=data.deliveryPage==='delivery-risks',kind=data.kind??deliveryPages.find(page=>page[0]===data.deliveryPage)?.[3],kinds=data.deliveryPage==='delivery-control'?deliveryKinds:[kind,'lifecycle','gate'];
 const sourceRecords=p.records.filter(r=>riskPage?r.links.riskIds.length>0:kinds.includes(r.kind)),recordIds=new Set(sourceRecords.map(r=>r.recordId));
 return {...result,data:{...data,sourceRecords,reviewHistory:deliveryStore(state).decisions.filter(d=>recordIds.has(d.recordId)),populationDecisions:deliveryStore(state).populations.filter(d=>riskPage?d.recordIds.some(id=>recordIds.has(id))||!!d.scopeId&&recordIds.has(d.scopeId):kinds.includes(d.kind))}};
}

/** SW-35: show the HSE rate reconciliation the report position already calculates.
 * Each recalculated rate states whether it reconciles with the reported rate.
 * With no stated exposure basis, the rate is recalculated from the reported
 * period totals at both common bases and labelled so; no basis is chosen. */
export function hseReconciliationMetrics(h:ReturnType<typeof hseReportPosition>,metric:(label:string,value:number|null,unit?:string,basis?:string)=>any){
 const r=h.rates,round=(v:number|null)=>v===null||!Number.isFinite(v)?null:Number(v.toFixed(4));
 const periodTotals=r.comparisons.filter(c=>c.fromReportedCases!==null).map(c=>round(c.fromReportedCases)+' per '+c.basisHours.toLocaleString('en-US')+' hours').join('; ');
 const result=(reported:number|null,calculated:number|null,code:string,basisHours:number|null)=>calculated===null
  ?'Not recalculated: '+(r.reason??(!r.basisEstablished?'the source does not state the exposure-hours basis':'restricted-work cases are unresolved'))+'.'+(code==='HSE_TRIR_RECONCILIATION_REQUIRED'&&periodTotals?' Calculated from period totals (LTI + medical + restricted cases / man hours): '+periodTotals+' ('+r.comparisons[0]!.comparisonBasis+').':'')
  :h.diagnostics.includes(code)?'Calculated from period totals per '+basisHours+' hours: does not reconcile with the reported rate '+reported+'. Review required.'
  :reported===null?'Calculated from period totals per '+basisHours+' hours; no reported rate to compare.'
  :'Calculated from period totals per '+basisHours+' hours: reconciles with the reported rate '+reported+'.';
 const ltifrBasis=r.sourceBasisHours?.ltifr??null,trirBasis=r.sourceBasisHours?.trir??null;
 return [
  metric('Recalculated LTIFR',round(r.calculatedLtifr),ltifrBasis?'per '+ltifrBasis+' hours':'exposure basis not supplied',result(r.reportedRates.ltifr,r.calculatedLtifr,'HSE_LTIFR_RECONCILIATION_REQUIRED',ltifrBasis)),
  metric('Recalculated TRIR',round(r.calculatedTrir),trirBasis?'per '+trirBasis+' hours':'exposure basis not supplied',result(r.reportedRates.trir,r.calculatedTrir,'HSE_TRIR_RECONCILIATION_REQUIRED',trirBasis)),
 ];
}
