import {canonicalHeader,registerDate,numberValue,sumKnown} from '../../truth-kernel/src';
import {calendarWorkingDayHours} from '../../schedule-analysis-core/src';
import {resolveWorkingCalendar,subtractWorkingHours} from '../../schedule-cpm/src/calendar';
import {buildProgressBreakdownProjection} from '../../progress-breakdown/src/projector';
import {deliveryKinds,deliveryLabels,lifecycleExamples,type DeliveryRecord,type DeliveryKind} from '../../delivery-core/src/types';
import {deliveryRecords,deliveryStore,deliveryPopulationFingerprint} from './delivery-records';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {projectScheduleControlBasis} from './schedule-control-basis';
import {resolveBoqSource,suppliedBoqFigures} from './boq-source';
import {withInstalledMeasurements} from './installed-measurements';
import {operationalReporting,reportingState} from './reporting-state';
import {scheduleAuthorityReview} from './schedule-authority';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';

import {deliveryPages} from '../../delivery-core/src/registry';
export {deliveryPages,isDeliveryPage} from '../../delivery-core/src/registry';
export const field=(r:DeliveryRecord,...names:string[])=>{for(const n of names){const v=r.fields[canonicalHeader(n)];if(v!==null&&v!==undefined&&String(v).trim())return String(v).trim();}return '';};
const numeric=(r:DeliveryRecord,...names:string[])=>numberValue(field(r,...names));
const date=(r:DeliveryRecord,...names:string[])=>registerDate(field(r,...names));
const ids=(v:string)=>v.split(/[;|]/).map(s=>s.trim()).filter(Boolean);
const currentRecord=(r:DeliveryRecord)=>r.state==='governed'||r.state==='verified';
const round=(v:number)=>Math.round(v*10000)/10000;
const pct=(n:number|null,d:number|null)=>n===null||d===null||d<=0?null:round(n/d*100);
const difference=(a:number|null,b:number|null)=>a===null||b===null?null:round(a-b);
const days=(later:string|null,earlier:string|null)=>later&&earlier?round((Date.parse(later.slice(0,10))-Date.parse(earlier.slice(0,10)))/86400000):null;
const isOnDate=(d:string|null,cutoff:string|null):boolean=>!!d&&!!cutoff&&d<=cutoff;
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof buildDelivery>}>();

function buildDelivery(state:ProjectRuntimeState){
 const source=deliveryRecords(state),records=source.records,governed=records.filter(currentRecord),store=deliveryStore(state);
 const current=projectControlSchedule(reportingState(state)),model=current?.revision.model??null,dataDateIso=projectDataDate(state);
 const byKind=(kind:DeliveryKind)=>governed.filter(r=>r.kind===kind);
 const byId=new Map(governed.map(r=>[r.recordId,r]));
 const population=(kind:DeliveryKind,scopeId:string|null=null)=>{
  const rows=byKind(kind).filter(r=>!scopeId||r.links.packageIds.includes(scopeId)||r.links.recordIds.includes(scopeId));
  const decision=store.populations.filter(p=>p.kind===kind&&p.scopeId===scopeId).at(-1);
  const pending=records.filter(r=>r.kind===kind&&(!scopeId||r.links.packageIds.includes(scopeId)||r.links.recordIds.includes(scopeId))&&!['governed','verified','stale','scenario'].includes(r.state));
  const established=!!decision&&decision.fingerprint===deliveryPopulationFingerprint(rows)&&pending.length===0;
  return {kind,scopeId,state:established?'established':'not_established',denominator:established?rows.length:null,knownRecordCount:rows.length,pendingRecordCount:pending.length,
   recordIds:rows.map(r=>r.recordId),basis:decision?.note??'Confirm that all applicable records have been captured before relying on a percentage.',confirmedAt:decision?.recordedAt??null};
 };
 const populations=Object.fromEntries(deliveryKinds.map(k=>[k,population(k)]));
 const boq=resolveBoqSource(state,current?.revision.revisionId??''),controlledBoq=boq.selection.adoptedSource&&boq.selection.state==='source';
 const quantities=controlledBoq?withInstalledMeasurements(state,boq.quantities,dataDateIso):null;
 const supplied=suppliedBoqFigures(boq.boq,boq.quantities),items=new Map(quantities?.items.map(i=>[i.quantityItemId,i])??[]);
 const activities=new Map(model?.activities.map(a=>[a.activityId,a])??[]);
 const findings:Array<{code:string;recordId:string|null;message:string;action:string;sourceRefs:string[]}>=[];
 const add=(code:string,r:DeliveryRecord|null,message:string,action:string)=>findings.push({code,recordId:r?.recordId??null,message,action,sourceRefs:r?.receipts.map(s=>s.documentId+':'+s.locator)??[]});
 for(const r of records)if(['conflicted','stale'].includes(r.state))add('RECORD_'+r.state.toUpperCase(),r,r.description??r.reference??r.recordId,'Review the retained source and select the governed revision.');
 for(const r of governed){
  for(const [label,linked,available] of [['Activity',r.links.activityIds,activities],['BOQ',r.links.boqItemIds,items],['Package',r.links.packageIds,byId],['Supplier',r.links.supplierIds,byId],['Location',r.links.locationIds,byId],['Asset',r.links.assetIds,byId],['Record',r.links.recordIds,byId]] as const)
   if(linked.some(id=>!available.has(id)))add('STALE_RELATIONSHIP',r,label+' relationship no longer resolves to the current authority.','Review this relationship against the current project records.');
 }
 const milestone=(r:DeliveryRecord,stage:string)=>({stage,
  planned:date(r,stage+' planned date','planned '+stage+' date',stage+' planned'),
  forecast:date(r,stage+' forecast date','forecast '+stage+' date',stage+' forecast'),
  actual:date(r,stage+' actual date','actual '+stage+' date',stage+' date',stage+' actual'),
 });
 const actualOn=(r:DeliveryRecord,stage:string)=>{const m=milestone(r,stage);return isOnDate(m.actual,dataDateIso)?m.actual:null;};
 const gatesFor=(r:DeliveryRecord)=>{
  const gates=byKind('gate').filter(g=>g.links.packageIds.includes(r.recordId)||g.links.recordIds.includes(r.recordId));
  const p=population('gate',r.recordId);
  const rows=gates.map(g=>{
   const applicable=field(g,'applicable').toLowerCase(),raw=field(g,'outcome','status').toLowerCase();
   const when=date(g,'outcome date','status as of'),satisfied=date(g,'satisfied date');
   const applicability=['yes','applicable'].includes(applicable)?true:['no','not applicable'].includes(applicable)?false:null;
   const known=isOnDate(satisfied,dataDateIso)||when===dataDateIso;
   const outcome=isOnDate(satisfied,dataDateIso)?'ready':known&&['ready','blocked','at risk'].includes(raw)?raw:'unknown';
   return {recordId:g.recordId,reference:g.reference,requirement:field(g,'requirement','description'),applicable:applicability,outcome,owner:field(g,'owner')||null,evidence:g.receipts};
  });
  const applicable=rows.filter(g=>g.applicable===true),unknown=rows.filter(g=>g.applicable===null||g.applicable&&g.outcome==='unknown');
  const complete=p.state==='established'&&unknown.length===0&&!!dataDateIso;
  const ready=applicable.filter(g=>g.outcome==='ready').length,blocked=applicable.filter(g=>g.outcome==='blocked').length;
  return {state:blocked?'blocked':!complete?'unknown':applicable.some(g=>g.outcome==='at risk')?'at_risk':applicable.length?'ready':'not_applicable',
   satisfiedKnownCount:ready,applicableCount:complete?applicable.length:null,readinessPercent:complete?pct(ready,applicable.length):null,unknownCount:unknown.length,
   population:p,rows};
 };
 const readiness=byKind('package').concat(byKind('workfront')).map(r=>({recordId:r.recordId,reference:r.reference,description:r.description,kind:r.kind,discipline:field(r,'discipline')||null,...gatesFor(r)}));
 const packageRows=byKind('package').map(r=>{
  const linkedActivities=r.links.activityIds.map(id=>activities.get(id));
  const programmeNeedDate=linkedActivities.length&&linkedActivities.every(a=>a?.currentStartIso)?linkedActivities.map(a=>a!.currentStartIso!.slice(0,10)).sort()[0]!:null;
  const forecastDelivery=date(r,'forecast delivery','forecast delivery date','delivery forecast date'),sourceRequiredOnSite=date(r,'required on site','required on site date');
  const headroom=days(programmeNeedDate,forecastDelivery);
  if(headroom!==null&&headroom<0)add('DELIVERY_AFTER_PROGRAMME_NEED',r,'Forecast delivery is '+(-headroom)+' calendar days after the linked programme need date.','Review procurement and programme consequences; this does not establish delay entitlement.');
  if(!r.links.boqItemIds.length)add('PROCUREMENT_SCOPE_UNMAPPED',r,'Procurement package has no controlled BOQ relationship.','Map the applicable scope or document a governed non-BOQ scope basis.');
  const template=byKind('lifecycle').find(t=>t.recordId===field(r,'lifecycle id'));
  const stages=template?ids(field(template,'stages')):[];
  const lifecycle=stages.map(stage=>({...milestone(r,stage),actualAtDataDate:actualOn(r,stage)}));
  const currentStage=[...lifecycle].reverse().find(s=>s.actualAtDataDate)?.stage??null;
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
  return {recordId:r.recordId,reference:r.reference,description:r.description,discipline:field(r,'discipline')||null,owner:field(r,'owner')||null,
   supplierIds:r.links.supplierIds,activityIds:r.links.activityIds,boqItemIds:r.links.boqItemIds,locationIds:r.links.locationIds,programmeRevisionId:current?.revision.revisionId??null,
   programmeNeedDate,sourceRequiredOnSite,forecastDelivery,programmeFloat:linkedActivities.map(a=>({activityId:a?.activityId??null,totalFloatHours:a?.totalFloatHours??null,calendarId:a?.calendarId??null})),longLeadCandidate:/elevator|façade|facade|switchgear|transformer|generator|chiller|ahu|fcu|pump|bms|fire alarm|equipment|steel|stone/i.test(r.description??''),headroomCalendarDays:headroom,currentStage,lifecycle,latestActionDates,latestOrderDate:latestOrder,
   latestOrderState:latestOrder?(assumption?'scenario':'calculated'):'not_established',leadTimeBasis:latestOrder?'Governed lifecycle durations, explicit day basis and controlled programme need date.':'Latest order date not established: confirm programme links, lifecycle, duration sources and day/calendar basis.',
   packageValue:numeric(r,'package value','amount','value'),currency:field(r,'currency')||null,readiness:readiness.find(q=>q.recordId===r.recordId),receipts:r.receipts};
 });
 const packagesByItem=new Map<string,DeliveryRecord[]>();for(const r of byKind('package'))for(const id of r.links.boqItemIds){const list=packagesByItem.get(id)??[];list.push(r);packagesByItem.set(id,list);}
 const materialRows=byKind('package').map(r=>{
  const linked=r.links.boqItemIds.map(id=>items.get(id)),units=[...new Set(linked.map(i=>i?.unit))];
  const unit=units.length===1&&units[0]?units[0]:null;
  const splitScope=linked.some(i=>i&&(packagesByItem.get(i.quantityItemId)?.length??0)>1);
  const allocations=r.links.boqAllocations;
  let required=unit&&linked.length&&linked.every(Boolean)?sumKnown(linked.map(i=>allocations.length?allocations.find(a=>a.boqItemId===i!.quantityItemId)?.quantity??null:splitScope?null:i!.contractQuantity)):null;
  const enteredUnit=field(r,'unit');if(enteredUnit&&enteredUnit!==unit)required=null;
  const installedValues=linked.map(i=>{if(!i||splitScope)return null;const snapshots=quantities?.installedSnapshots.filter(s=>s.quantityItemId===i.quantityItemId&&isOnDate(s.asOfIso.slice(0,10),dataDateIso)).sort((a,b)=>a.asOfIso.localeCompare(b.asOfIso));return snapshots?.at(-1)?.installedQuantity??null;});
  const quantity=(stage:string)=>{const n=numeric(r,stage+' quantity',stage+' qty');const when=date(r,stage+' date',stage+' as of','status as of');return n!==null&&n>=0&&isOnDate(when,dataDateIso)&&(!enteredUnit||enteredUnit===unit)?n:null;};
  const ordered=quantity('ordered'),manufactured=quantity('manufactured'),shipped=quantity('shipped'),delivered=quantity('delivered'),accepted=quantity('accepted'),released=quantity('released'),installed=sumKnown(installedValues);
  for(const [code,left,right,label] of [['ORDERED_ABOVE_REQUIREMENT',ordered,required,'Ordered above controlled requirement'],['DELIVERED_ABOVE_ORDERED',delivered,ordered,'Delivered above ordered'],['ACCEPTED_ABOVE_DELIVERED',accepted,delivered,'Accepted above delivered'],['INSTALLED_ABOVE_ACCEPTED',installed,accepted,'Installed above accepted'],['INSTALLED_ABOVE_REQUIREMENT',installed,required,'Installed above controlled requirement']] as const)if(left!==null&&right!==null&&left>right)add(code,r,label+': '+left+' / '+right+' '+unit+'.','Reconcile the linked source quantities and scope; supplied quantities are retained.');
  return {recordId:r.recordId,reference:r.reference,description:r.description,unit,required,ordered,manufactured,shipped,delivered,accepted,released,installed,
   remainingToOrder:difference(required,ordered),remainingToDeliver:difference(required,delivered),remainingToInstall:difference(required,installed),
   procurementCoveragePercent:pct(ordered,required),manufacturingCoveragePercent:pct(manufactured,required),deliveryCoveragePercent:pct(delivered,required),acceptanceCoveragePercent:pct(accepted,required),installationCompletionPercent:pct(installed,required),
   basis:splitScope?'Split scope: explicit BOQ allocations required. Item-level installed quantities cannot be assigned to one package without a governed split.':'Required quantities from controlled BOQ; installed quantities from existing Installed Quantities.',receipts:r.receipts};
 });
 for(const [itemId,packages] of packagesByItem){const item=items.get(itemId);const allocated=sumKnown(packages.map(p=>p.links.boqAllocations.find(a=>a.boqItemId===itemId)?.quantity??null));if(item?.contractQuantity!==null&&item?.contractQuantity!==undefined&&allocated!==null&&allocated>item.contractQuantity)add('SCOPE_ALLOCATIONS_ABOVE_BOQ',null,'Package allocations exceed BOQ item '+itemId+'.','Review the governed split quantities.');}
 const mapped=new Set(byKind('package').flatMap(p=>p.links.boqItemIds));
 const activityByItem=new Map<string,string[]>();for(const a of quantities?.allocations??[]){const list=activityByItem.get(a.quantityItemId)??[];list.push(a.activityId);activityByItem.set(a.quantityItemId,list);}
 const boqRows=supplied.rows.map(i=>({...i,procurementPackageIds:(packagesByItem.get(i.itemId)??[]).map(p=>p.recordId),programmeActivityIds:activityByItem.get(i.itemId)??[]}));
 const currencyGroups=[...new Set(boqRows.map(r=>r.currency).filter((c):c is string=>!!c))].map(currency=>{const rows=boqRows.filter(r=>r.currency===currency);return {currency,totalValue:controlledBoq?sumKnown(rows.map(r=>r.amount)):null,mappedValue:controlledBoq?sumKnown(rows.filter(r=>mapped.has(r.itemId)).map(r=>r.amount)):null,unmappedValue:controlledBoq?sumKnown(rows.filter(r=>!mapped.has(r.itemId)).map(r=>r.amount)):null};});
 const boqIntelligence={source:boq.selection,itemCount:controlledBoq?boqRows.length:null,mappedItemCount:controlledBoq?boqRows.filter(r=>mapped.has(r.itemId)).length:null,
  procurementMappingPercent:controlledBoq?pct(boqRows.filter(r=>mapped.has(r.itemId)).length,boqRows.length):null,currencies:currencyGroups,
  topCostDrivers:currencyGroups.map(g=>({currency:g.currency,items:boqRows.filter(r=>r.currency===g.currency&&r.amount!==null).sort((a,b)=>b.amount!-a.amount!).slice(0,20)})),rows:boqRows};
 const events:Array<{recordId:string;kind:string;stage:string;series:string;dateIso:string;value:number;unit:string;authority:string}>=[];
 for(const r of byKind('package'))for(const stage of ['rfq','tender return','award','po','delivery'])for(const series of ['planned','forecast','actual'] as const){const when=milestone(r,stage)[series];if(when&&(series!=='actual'||isOnDate(when,dataDateIso)))events.push({recordId:r.recordId,kind:'throughput',stage,series,dateIso:when,value:1,unit:'records',authority:'governed_record'});}
 for(const r of byKind('submittal'))for(const stage of ['submission','review','approval','rejection','resubmission'])for(const series of ['planned','forecast','actual'] as const){const when=milestone(r,stage)[series]??(stage==='submission'?date(r,series==='planned'?'planned issue':series==='actual'?'actual issue':'forecast issue'):null);if(when&&(series!=='actual'||isOnDate(when,dataDateIso)))events.push({recordId:r.recordId,kind:'submittal_throughput',stage,series,dateIso:when,value:1,unit:'records',authority:'governed_record'});}
 for(const r of byKind('package')){const amount=numeric(r,'package value','amount','value'),currency=field(r,'currency');if(amount===null||!currency)continue;for(const series of ['planned','forecast','actual'] as const){const when=milestone(r,'po')[series];if(when&&(series!=='actual'||isOnDate(when,dataDateIso)))events.push({recordId:r.recordId,kind:'commitment_value',stage:'po',series,dateIso:when,value:amount,unit:currency,authority:'source_package_value'});}}
 const groupEvents=new Map<string,typeof events>();for(const e of events){const key=[e.kind,e.stage,e.series,e.unit].join('|');const list=groupEvents.get(key)??[];list.push(e);groupEvents.set(key,list);}
 const curves=[...groupEvents].map(([key,rows])=>{let cumulative=0;const buckets=new Map<string,typeof events>();for(const e of rows){const list=buckets.get(e.dateIso)??[];list.push(e);buckets.set(e.dateIso,list);}return {key,kind:rows[0]!.kind,stage:rows[0]!.stage,series:rows[0]!.series,unit:rows[0]!.unit,population:rows.map(r=>r.recordId),dataDateIso,denominator:null,weighting:rows[0]!.kind==='commitment_value'?'Package value by currency':'Count of dated events; throughput, not physical progress',points:[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([dateIso,entries])=>({dateIso,value:round(cumulative+=entries.reduce((n,e)=>n+e.value,0)),recordIds:entries.map(e=>e.recordId)}))};});
 const weightedPackages=byKind('package').map(r=>{const template=byKind('lifecycle').find(t=>t.recordId===field(r,'lifecycle id'));const stages=template?ids(field(template,'stages')):[];const weights=stages.map(s=>numeric(template!,s+' weight'));const total=weights.every(w=>w!==null&&w>=0)?sumKnown(weights):null;const basis=field(r,'weighting basis');const weight=basis==='controlled package value'?numeric(r,'package value','amount','value'):basis==='controlled management weight'?numeric(r,'management weight'):null;let earned=0;let known=!!dataDateIso&&stages.length>0&&total===100;
  stages.forEach((stage,i)=>{const when=milestone(r,stage).actual;if(isOnDate(when,dataDateIso))earned+=weights[i]??0;else if(!(when&&dataDateIso&&when>dataDateIso)&&!(date(r,stage+' status as of')===dataDateIso&&field(r,stage+' status')==='not started'))known=false;});
  return {recordId:r.recordId,basis,unit:basis==='controlled package value'?field(r,'currency')||null:'management weight',weight,percent:known?earned:null,lifecycleId:template?.recordId??null};});
 const weightedGroups=[...new Set(weightedPackages.map(r=>r.basis+'|'+r.unit))].map(key=>{const rows=weightedPackages.filter(r=>r.basis+'|'+r.unit===key),complete=populations.package!.state==='established'&&rows.every(r=>r.percent!==null&&r.weight!==null&&r.weight>0&&r.unit);const total=sumKnown(rows.map(r=>r.weight));return {key,unit:rows[0]?.unit??null,basis:rows[0]?.basis??null,value:complete&&total?round(rows.reduce((n,r)=>n+r.percent!*r.weight!,0)/total):null,denominator:complete?total:null,includedRecordIds:rows.filter(r=>r.percent!==null&&r.weight!==null).map(r=>r.recordId),excludedRecordIds:rows.filter(r=>r.percent===null||r.weight===null).map(r=>r.recordId),explanation:complete?'Governed lifecycle weights and complete package denominator.':'Weighted procurement progress not established. Confirm the package population, package weights and dated lifecycle status.'};});
 const registerRows=governed.map(r=>{const raised=date(r,'raised date','identified date','submitted date','actual issue','incident date','event start','report date','effective date');const actual=date(r,'actual date','actual issue'),approval=date(r,'approval date'),verified=date(r,'verification date'),closed=date(r,'closed date','close date'),rectified=date(r,'rectified date'),accepted=date(r,'acceptance date','handover acceptance date');
  const statusAsOf=date(r,'status as of');const rawStatus=field(r,'status','outcome').toLowerCase();
  let currentStatus='not_established';if(dataDateIso){if(accepted&&verified&&accepted<=dataDateIso&&verified<=dataDateIso)currentStatus='accepted';else if(closed&&verified&&closed<=dataDateIso&&verified<=dataDateIso)currentStatus='closed';else if(approval&&approval<=dataDateIso)currentStatus='source_approved';else if(actual&&actual<=dataDateIso)currentStatus=['quality','commissioning'].includes(r.kind)&&['passed','failed','retest required','accepted','rejected'].includes(rawStatus)&&isOnDate(date(r,'outcome date')??statusAsOf,dataDateIso)?rawStatus:'performed';else if(raised&&raised<=dataDateIso)currentStatus='open';if(currentStatus==='not_established'&&statusAsOf===dataDateIso&&!['approved','accepted','closed','commissioned','complete','passed'].includes(rawStatus))currentStatus=rawStatus||'not_established';}
  const due=date(r,'due date','required by','required response'),firstEvidence=[raised,actual,approval,verified,closed,accepted,statusAsOf].filter((d):d is string=>!!d).sort()[0];const scope=firstEvidence&&dataDateIso?(firstEvidence<=dataDateIso?'current':'future'):'undated';
  const overdue=currentStatus==='not_established'||!dataDateIso||!due?null:!['accepted','closed','source_approved','passed'].includes(currentStatus)&&due<dataDateIso;
  return {recordId:r.recordId,reference:r.reference,kind:r.kind,description:r.description,discipline:field(r,'discipline')||null,owner:field(r,'owner','responsible party')||null,sourceStatus:rawStatus||null,currentStatus,scope,raisedDate:raised,dueDate:due,actualDate:actual,approvalDate:approval,rectifiedDate:rectified,verificationDate:verified,closedDate:closed,acceptedDate:accepted,overdue,links:r.links,fields:r.fields,receipts:r.receipts};
 });
 const rates=(kind:DeliveryKind)=>{const rows=registerRows.filter(r=>r.kind===kind);const outcomes=rows.filter(r=>['passed','failed','accepted','rejected'].includes(r.currentStatus));const pass=outcomes.filter(r=>['passed','accepted'].includes(r.currentStatus)).length;return {knownOutcomeCount:outcomes.length,unknownOutcomeCount:rows.length-outcomes.length,passRatePercent:pct(pass,outcomes.length),basis:'Only dated known outcomes; unresolved outcomes excluded and counted separately.'};};
 const allHandover=registerRows.filter(r=>r.kind==='handover'),handoverRows=allHandover.filter(r=>r.scope==='current'),handoverKnown=allHandover.every(r=>r.scope==='future'||r.currentStatus!=='not_established'&&r.scope!=='undated');
 const handover={population:populations.handover!,acceptedKnownCount:handoverRows.filter(r=>r.currentStatus==='accepted').length,readinessPercent:populations.handover!.state==='established'&&handoverKnown?pct(handoverRows.filter(r=>r.currentStatus==='accepted').length,handoverRows.length):null,rows:handoverRows};
 const hse=byKind('hse').filter(r=>isOnDate(date(r,'report date','incident date','status as of'),dataDateIso));const hours=sumKnown(hse.map(r=>numeric(r,'man hours'))),injuries=sumKnown(hse.map(r=>numeric(r,'lost time injuries')));const basis=new Set(hse.map(r=>numeric(r,'frequency rate basis')));const factor=basis.size===1?[...basis][0]!:null;
 const hsePosition={exposureHours:hours,lostTimeInjuries:injuries,rateBasis:factor,frequencyRate:populations.hse!.state==='established'&&hours!==null&&hours>0&&injuries!==null&&injuries>=0&&factor!==null&&factor>0&&hse.length===byKind('hse').length?round(injuries/hours*factor):null,explanation:'A frequency rate requires complete dated exposure and incident populations, and an explicit rate basis.'};
 const scopeGroups=new Map<string,{dimension:string;label:string;recordIds:string[];activityIds:Set<string>}>();
 for(const r of byKind('workfront'))for(const [dimension,labels] of [['discipline',[field(r,'discipline')]],['location',r.links.locationIds]] as const)for(const label of labels.filter(Boolean)){const key=dimension+'|'+label;const group=scopeGroups.get(key)??{dimension,label,recordIds:[],activityIds:new Set<string>()};group.recordIds.push(r.recordId);r.links.activityIds.forEach(id=>group.activityIds.add(id));scopeGroups.set(key,group);}
 const workfrontMatrix=[...scopeGroups.values()].map(group=>{
  const selected=[...group.activityIds].map(id=>activities.get(id)).filter((a):a is NonNullable<typeof a>=>!!a);
  const config={generatedAt:new Date().toISOString(),producerVersion:'shared-progress-breakdown',config:projectScheduleControlBasis(state).analysisConfig};
  const rows=model&&selected.length?buildProgressBreakdownProjection({...model,activities:selected},config).rows:[];
  const total=model&&selected.length?buildProgressBreakdownProjection({...model,activities:selected.map(a=>({...a,wbsId:'DELIVERY_SCOPE'}))},config).rows[0]:null;
  const gates=readiness.filter(r=>group.recordIds.includes(r.recordId));const ready=gates.some(r=>r.state==='blocked')?'blocked':gates.some(r=>r.state==='unknown')||!gates.length?'unknown':gates.some(r=>r.state==='at_risk')?'at_risk':'ready';
  return {dimension:group.dimension,label:byId.get(group.label)?.description??group.label,recordIds:group.recordIds,activityIds:[...group.activityIds],programmeRevisionId:current?.revision.revisionId??null,
   plannedPercent:total?.currentPlanCoveragePercent===100?total.currentPlanPercent??null:null,baselinePlannedPercent:total?.baselinePlanCoveragePercent===100?total.baselinePlannedPercent??null:null,scheduleProgressPercent:total?.durationWeightedCoveragePercent===100?total.durationWeightedProgressPercent??null:null,
   variancePercentagePoints:total?.currentPlanCoveragePercent===100&&total?.durationWeightedCoveragePercent===100?total.scheduleMinusCurrentPlanPercentagePoints??null:null,
   readinessState:ready,mainBlockers:gates.flatMap(g=>g.rows.filter(r=>r.applicable&&r.outcome==='blocked').map(r=>r.requirement)),
   progressAuthority:'Existing WBS Progress producer; submitted schedule progress is separate from installed physical quantities.',wbsRows:rows,readiness:gates};
 });
 const supplierRows=byKind('supplier').map(r=>({recordId:r.recordId,reference:r.reference,description:r.description,packages:packageRows.filter(p=>p.supplierIds.includes(r.recordId)),source:r}));
 // Unknown outcomes remain an explicitly counted exclusion; they do not enter a pass denominator.
 const summaries=Object.fromEntries(deliveryKinds.map(kind=>{
  const rows=registerRows.filter(r=>r.kind===kind),currentRows=rows.filter(r=>r.scope==='current'),complete=populations[kind]!.state==='established'&&!!dataDateIso&&rows.every(r=>r.scope!=='undated'&&r.currentStatus!=='not_established');
  const count=(condition:(r:typeof rows[number])=>boolean)=>complete?currentRows.filter(condition).length:null;
  const closeCount=count(r=>['closed','accepted'].includes(r.currentStatus));
  return [kind,{totalRequired:populations[kind]!.denominator,currentCount:complete?currentRows.length:null,knownCurrentCount:currentRows.length,futureCount:rows.filter(r=>r.scope==='future').length,undatedCount:rows.filter(r=>r.scope==='undated').length,
   openCount:count(r=>!['closed','accepted','source_approved','passed'].includes(r.currentStatus)),overdueCount:rows.every(r=>r.scope==='future'||r.overdue!==null)?count(r=>r.overdue===true):null,
   closedCount:closeCount,closurePercent:complete?pct(closeCount,currentRows.length):null,passedCount:count(r=>r.currentStatus==='passed'),failedCount:count(r=>r.currentStatus==='failed'),retestCount:count(r=>r.currentStatus==='retest required'),
   ...rates(kind),reviewPeriodCalendarDays:(()=>{const periods=currentRows.map(r=>days(date(byId.get(r.recordId)!,'response date','approval date'),date(byId.get(r.recordId)!,'actual submission date','submitted date','actual issue'))).filter((n):n is number=>n!==null&&n>=0);return periods.length?round(periods.reduce((a,b)=>a+b,0)/periods.length):null;})(),reviewPeriodKnownCount:currentRows.filter(r=>date(byId.get(r.recordId)!,'response date','approval date')&&date(byId.get(r.recordId)!,'actual submission date','submitted date','actual issue')).length}];
 }));
 const permitRows=byKind('permit').map(r=>{
  const issued=date(r,'issue date','actual issue'),expiry=date(r,'expiry date','valid until'),start=date(r,'valid from')??issued,permanent=field(r,'expiry applicable')==='no';
  const status=!dataDateIso||!issued?'not_established':issued>dataDateIso?'future_issue':!start||!permanent&&!expiry?'validity_not_established':expiry&&expiry<dataDateIso?'expired':start>dataDateIso?'not_yet_valid':'valid';
  return {...registerRows.find(q=>q.recordId===r.recordId)!,issueDate:issued,validFrom:start,expiryDate:expiry,permitStatus:status,headroomCalendarDays:days(date(r,'required by','due date'),issued),renewalRequired:field(r,'renewal required')||null};
 });
 const spareRows=byKind('spare').map(r=>{
  const value=(name:string)=>{const n=numeric(r,name+' quantity');return n!==null&&n>=0&&isOnDate(date(r,name+' date','status as of'),dataDateIso)?n:null;};
  const required=numeric(r,'required quantity'),delivered=value('delivered'),accepted=value('accepted'),stored=value('stored'),handedOver=value('handed over'),linked=value('asset linked');
  return {...registerRows.find(q=>q.recordId===r.recordId)!,unit:field(r,'unit')||null,required:required!==null&&required>=0?required:null,delivered,accepted,stored,assetLinked:linked,handedOver,remaining:difference(required,handedOver)};
 });
 const assetRows=byKind('asset').map(r=>{
  const related=registerRows.filter(q=>q.links.assetIds.includes(r.recordId)||r.links.recordIds.includes(q.recordId));
  return {...registerRows.find(q=>q.recordId===r.recordId)!,installationDate:actualOn(r,'installation'),inspectionAcceptance:actualOn(r,'inspection acceptance'),commissioningDate:actualOn(r,'commissioning'),takingOverDate:actualOn(r,'taking over'),
   tests:related.filter(q=>q.kind==='commissioning'),requirements:related.filter(q=>q.kind==='handover'),snags:related.filter(q=>q.kind==='snag'),spares:spareRows.filter(q=>q.links.assetIds.includes(r.recordId)),acceptanceAuthority:'Dated source position; commissioning and handover acceptance are separate.'};
 });
 const locations=byKind('location').map(r=>{const path:string[]=[];const visited=new Set<string>();let current:DeliveryRecord|undefined=r;while(current&&!visited.has(current.recordId)){visited.add(current.recordId);path.unshift(current.description??current.reference??current.recordId);current=byId.get(field(current,'parent location id'));}return {recordId:r.recordId,reference:r.reference,description:r.description,parentId:field(r,'parent location id')||null,level:field(r,'location type')||null,path:path.join(' / ')};});
 // Material observations are cumulative snapshots, never added to another snapshot of the same package.
 const materialCurves:Array<any>=[];
 for(const row of materialRows){const r=byId.get(row.recordId)!;if(!row.unit)continue;
  for(const stage of ['required','ordered','manufactured','shipped','delivered','accepted','released'] as const){const value=row[stage];const when=stage==='required'?packageRows.find(p=>p.recordId===r.recordId)?.programmeNeedDate:date(r,stage+' date',stage+' as of','status as of');
   if(value!==null&&when)materialCurves.push({key:'material|'+r.recordId+'|'+stage,kind:'material_quantity',stage,series:stage==='required'?'controlled_requirement':'actual',unit:row.unit,packageId:r.recordId,discipline:field(r,'discipline')||null,locationIds:r.links.locationIds,population:[r.recordId],dataDateIso,denominator:row.required,weighting:'Cumulative quantity snapshot; compatible unit only',points:[{dateIso:when,value,recordIds:[r.recordId]}]});
  }
  const linked=r.links.boqItemIds;if(linked.some(id=>(packagesByItem.get(id)?.length??0)>1))continue;
  const snapshots=(quantities?.installedSnapshots??[]).filter(s=>linked.includes(s.quantityItemId)&&isOnDate(s.asOfIso.slice(0,10),dataDateIso));
  const dates=[...new Set(snapshots.map(s=>s.asOfIso.slice(0,10)))].sort();
  const points=dates.map(when=>({dateIso:when,value:sumKnown(linked.map(id=>snapshots.filter(s=>s.quantityItemId===id&&s.asOfIso.slice(0,10)<=when).sort((a,b)=>a.asOfIso.localeCompare(b.asOfIso)).at(-1)?.installedQuantity??null)),recordIds:linked})).filter(p=>p.value!==null);
  if(points.length)materialCurves.push({key:'material|'+r.recordId+'|installed',kind:'material_quantity',stage:'installed',series:'actual',unit:row.unit,packageId:r.recordId,population:linked,dataDateIso,denominator:row.required,weighting:'Existing Installed Quantities snapshots; all mapped items must have an observation',points});
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
  const kind:DeliveryKind=curve.kind==='submittal_throughput'?'submittal':'package';const included=new Set(curve.population),all=byKind(kind);
  return {...curve,denominator:curve.denominator??(curve.unit==='records'?populations[kind]!.denominator:null),period:{from:curve.points[0]?.dateIso??null,to:curve.points.at(-1)?.dateIso??null},populationState:populations[kind]!.state,includedRecordIds:[...included],excludedRecordIds:all.filter(r=>!included.has(r.recordId)).map(r=>r.recordId),sourceRecordIds:[...included],coveragePercent:populations[kind]!.state==='established'?pct(all.filter(r=>included.has(r.recordId)).length,all.length):null};
 });
 const operations=operationalReporting(state);
 return {schemaVersion:'1.0',producerVersion:'delivery-v1',projectId:state.projectId,projectVersion:state.version,dataDateIso,programmeRevisionId:current?.revision.revisionId??null,
  scheduleAuthorityReview:scheduleAuthorityReview(state),records,documents:source.documents,diagnostics:source.diagnostics,populations,findings,
  packageRows,materialRows,boqIntelligence,readiness,curves:curveData,weightedGroups,registerRows,handover,hsePosition,workfrontMatrix,supplierRows,summaries,permitRows,spareRows,assetRows,locations,
  existingAuthorities:{risk:operations.risk,quality:operations.quality,rfi:operations.rfi,programme:'/schedule/modules/schedule-analytics',progress:'/schedule/modules/progress-report',installedQuantities:'/schedule/modules/quantity-scurve',commercial:'/commercial/modules/commercial-overview',claims:'/schedule/modules/delay-claims'},
  lifecycleExamples:lifecycleExamples.map(t=>({...t,state:'example_requires_adoption',weights:null})),
  authorityScope:'Delivery consumes the controlled BOQ, programme, progress and commercial/claims authorities. Procurement exposure does not establish EOT or causation.'};
}
export function deliveryPosition(state:ProjectRuntimeState){const prior=cache.get(state);if(prior?.version===state.version)return prior.value;const value=buildDelivery(state);cache.set(state,{version:state.version,value});return value;}
export function deliveryModule(state:ProjectRuntimeState,key:string):ModuleRuntimeResult{
 const definition=deliveryPages.find(p=>p[0]===key);if(!definition)return {key,status:'blocked',reason:'Delivery page not found.',dependencies:[],data:null};
 const p=deliveryPosition(state),kind=definition[3],title=definition[1];const records=p.records.filter(r=>r.kind===kind),population=p.populations[kind]!,summary=p.summaries[kind]!;
 const rows:any[]=key==='delivery-control'||key==='long-lead'||key==='procurement-packages'?p.packageRows:key==='material-tracking'?p.materialRows:key.includes('readiness')&&key!=='handover-readiness'?p.readiness.filter(r=>r.kind===(key==='construction-readiness'?'workfront':'package')):key==='construction-discipline'||key==='construction-locations'?p.workfrontMatrix.filter(r=>r.dimension===(key==='construction-discipline'?'discipline':'location')):key==='delivery-suppliers'?p.supplierRows:key==='delivery-risks'?p.existingAuthorities.risk.current:key==='delivery-permits'?p.permitRows:key==='delivery-spares'?p.spareRows:key==='delivery-assets'?p.assetRows:p.registerRows.filter(r=>r.kind===kind);
 const rowIds=new Set(records.map(r=>r.recordId));const findings=p.findings.filter(f=>key==='delivery-control'||f.recordId&&rowIds.has(f.recordId));
 const hasRows=records.length>0||rows.length>0;const pending=records.filter(r=>['extracted_candidate','working','conflicted','stale'].includes(r.state));
 const sourceDocs=p.documents.filter(d=>d.kind===kind);const unread=sourceDocs.some(d=>d.state==='submitted_not_interpreted'||d.state==='mapping_required');
 const managementPosition=!hasRows?unread?'Source files are retained but their Delivery records require reading or field mapping. Open record review to resolve the source.':'No governed '+title.toLowerCase()+' population is established. Import a register or add a working record, then review the records.':!p.dataDateIso?'Adopt the current programme to establish the dated Delivery position. Supplied records remain available for review.':pending.length?pending.length+' supplied records require review. Calculations use the governed subset only.':findings.length?findings.length+' delivery exceptions require action. Open the linked record to reconcile the source.':'Governed records are available. Current values and coverage are shown against the programme Data Date.';
 const metric=(label:string,value:number|null,unit='records',basis='Governed records at the programme Data Date')=>({label,value,unit,state:value===null?'unavailable':'calculated',basis});
 let metrics=[metric('Current records',summary.currentCount),metric('Open records',summary.openCount),metric('Overdue records',summary.overdueCount),metric('Awaiting review',hasRows?pending.length:null,'records','Count of supplied records awaiting review; this is not an activity or scope total.')];
 if(['delivery-control','procurement-packages','long-lead','material-tracking','procurement-scurves'].includes(key))metrics=[metric('BOQ mapped to procurement',p.boqIntelligence.procurementMappingPercent,'%','Controlled BOQ item denominator; mapped item IDs counted once.'),metric('Governed packages',population.denominator),metric('Late delivery · known subset',p.packageRows.some(r=>r.headroomCalendarDays!==null)?p.packageRows.filter(r=>r.headroomCalendarDays!==null&&r.headroomCalendarDays<0).length:null),metric('Latest order unresolved',p.packageRows.length?p.packageRows.filter(r=>!r.latestOrderDate).length:null)];
 if(key==='delivery-hse')metrics=[metric('Reported exposure',p.hsePosition.exposureHours,'hours'),metric('Reported lost-time injuries',p.hsePosition.lostTimeInjuries),metric('Frequency rate',p.hsePosition.frequencyRate,'per '+(p.hsePosition.rateBasis??'unresolved')+' hours',p.hsePosition.explanation)];
 if(key==='handover-readiness')metrics=[metric('Handover readiness',p.handover.readinessPercent,'%','Accepted and verified requirements / confirmed current requirement population.'),metric('Confirmed requirement population',population.denominator),metric('Accepted · known subset',hasRows?p.handover.acceptedKnownCount:null),metric('Overdue',summary.overdueCount)];
 if(key==='delivery-quality'||key==='delivery-commissioning')metrics=[...metrics.slice(0,3),metric('Pass / acceptance rate',summary.passRatePercent,'%',summary.basis),metric('Unknown outcomes',hasRows?summary.unknownOutcomeCount:null)];
 if(key==='construction-readiness'||key==='procurement-readiness')metrics=[metric('Ready · known subset',rows.length?rows.filter(r=>r.state==='ready').length:null),metric('Blocked · known subset',rows.length?rows.filter(r=>r.state==='blocked').length:null),metric('Unknown readiness',rows.length?rows.filter(r=>r.state==='unknown').length:null),metric('Confirmed scope population',population.denominator)];
 const ready=hasRows&&!!p.dataDateIso&&pending.length===0&&findings.length===0&&population.state==='established'&&metrics.every(m=>m.value!==null);
 const extras:Record<string,unknown>={};
 if(['delivery-control','material-tracking'].includes(key))extras.boqIntelligence=p.boqIntelligence;
 if(['delivery-control','handover-readiness'].includes(key))extras.handover={...p.handover,rows:undefined};
 if(key==='delivery-control')extras.readiness=p.readiness;
 if(['procurement-scurves','delivery-submittals','material-tracking'].includes(key)){extras.curves=p.curves.filter(c=>key==='procurement-scurves'||key==='delivery-submittals'&&c.kind==='submittal_throughput'||key==='material-tracking'&&c.kind==='material_quantity');extras.weightedGroups=p.weightedGroups;}
 if(key==='delivery-hse')extras.hsePosition=p.hsePosition;
 if(key==='construction-locations')extras.locations=p.locations;
 if(key==='delivery-risks')extras.riskBasis=p.existingAuthorities.risk;
 return {key,status:!hasRows?'blocked':ready?'ready':'partial',reason:managementPosition,dependencies:['controlled programme','applicable Delivery records'],scheduleAuthorityReview:p.scheduleAuthorityReview,
  data:{projectionKey:'delivery',deliveryPage:key,projectId:state.projectId,projectVersion:state.version,dataDateIso:p.dataDateIso,programmeRevisionId:p.programmeRevisionId,title,kind,managementPosition,rows:rows.map(r=>({...r,projectId:state.projectId})),metrics,findings,
   reviewRecords:records.map(r=>({recordId:r.recordId,reference:r.reference,description:r.description,kind:r.kind,state:r.state,revision:r.revision,diagnostics:r.diagnostics})),population,summary,documents:sourceDocs,authorityScope:p.authorityScope,authorityLinks:{programme:'/schedule/modules/schedule-analytics',progress:'/schedule/modules/progress-report',installed:'/schedule/modules/quantity-scurve',commercial:'/commercial/modules/commercial-overview',claims:'/schedule/modules/delay-claims'},...extras}};
}
export function deliveryDashboard(state:ProjectRuntimeState){
 if(!state.delivery?.decisions.length)return null;
 const p=deliveryPosition(state);return {projectId:state.projectId,dataDateIso:p.dataDateIso,programmeRevisionId:p.programmeRevisionId,boqMappingPercent:p.boqIntelligence.procurementMappingPercent,handoverReadinessPercent:p.handover.readinessPercent,latePackageKnownCount:p.packageRows.some(r=>r.headroomCalendarDays!==null)?p.packageRows.filter(r=>r.headroomCalendarDays!==null&&r.headroomCalendarDays<0).length:null,unresolvedPackageCount:p.packageRows.length?p.packageRows.filter(r=>r.headroomCalendarDays===null).length:null,exceptions:p.findings.slice(0,8),exceptionCount:p.findings.length};
}
export function deliveryExportResult(state:ProjectRuntimeState,result:ModuleRuntimeResult):ModuleRuntimeResult{
 const data=result.data as any;if(data?.projectionKey!=='delivery')return result;
 const p=deliveryPosition(state),kinds=data.deliveryPage==='delivery-control'?deliveryKinds:[data.kind,'lifecycle','gate'];
 const sourceRecords=p.records.filter(r=>kinds.includes(r.kind)),recordIds=new Set(sourceRecords.map(r=>r.recordId));
 return {...result,data:{...data,sourceRecords,reviewHistory:deliveryStore(state).decisions.filter(d=>recordIds.has(d.recordId)),populationDecisions:deliveryStore(state).populations.filter(d=>kinds.includes(d.kind))}};
}
