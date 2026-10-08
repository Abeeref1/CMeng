import type {CommercialControlPosition} from '../../commercial-control/src';
import type {ModuleRuntimeResult,ProjectRuntimeState} from './project-state-types';
import {managementSourceInventory} from './management-source-inventory';
import {boqScopeIntelligence} from './boq-scope-intelligence';
import {projectManagementContext} from './management-context';
import {deliveryPosition} from './delivery-projections';
import {bestAvailableFact,managementFactView,type ManagementFactView,type PopulationAuthority} from '../../truth-kernel/src';

const data=(modules:Map<string,ModuleRuntimeResult>,key:string):any=>{
  const value=modules.get(key)?.data;
  return value&&typeof value==='object'?value:{};
};
const findingValue=(value:any):number|null=>typeof value?.value==='number'&&Number.isFinite(value.value)?value.value:null;

export function managementVisualControl(
  state:ProjectRuntimeState,
  modules:Map<string,ModuleRuntimeResult>,
  commercial:CommercialControlPosition,
  precomputedManagementContext?:ReturnType<typeof projectManagementContext>,
){
  const sourceInventory=managementSourceInventory(state);
  const managementContext=precomputedManagementContext??projectManagementContext(state,modules,commercial);
  const procurementSource=sourceInventory.domains.find(row=>row.domain==='procurement')??null;
  const sourceLongLeadCount=procurementSource?.signals.longLeadMarkedCount??null;
  const scheduleLongLead=managementContext.schedule?.longLeadEvidence??[];
  const boqScope=boqScopeIntelligence(state);
  const countFact=(key:string,label:string,value:number,basis:string,authority:ManagementFactView<number>['authority'],state:ManagementFactView<number>['state']):ManagementFactView<number>=>{
    const populationState:PopulationAuthority['state']=state==='official'?'established':state==='partial'?'partial':state==='candidate'?'candidate':state==='quarantined'?'quarantined':state==='conflicted'?'conflicted':'missing';
    return managementFactView({
      key,label,value,state,authority,basis,dataDateIso:managementContext.dataDateIso,diagnostics:[],
      receipts:[],coverage:{known:value,total:value},
      population:{state:populationState,sourceCount:value,applicableCount:populationState==='established'?value:null,currentCount:populationState==='established'?value:null,excludedCount:0,coveragePercent:100,basis},
    });
  };
  const longLeadFacts:ManagementFactView<number>[]=[];
  if(typeof sourceLongLeadCount==='number'&&sourceLongLeadCount>0)longLeadFacts.push(
    countFact('source-long-lead','Source-marked long lead',sourceLongLeadCount,
      'Explicit Long Lead marks read from the supplied procurement source.','source','partial'));
  if(boqScope.longLead.length>0)longLeadFacts.push(
    countFact('boq-long-lead','BOQ-screened long lead',boqScope.longLead.length,
      'Professional screening of readable BOQ descriptions; not a confirmed procurement lifecycle.','candidate','candidate'));
  if(scheduleLongLead.length>0)longLeadFacts.push(
    countFact('schedule-long-lead','Schedule/WBS long lead',scheduleLongLead.length,
      'Explicit Long Lead/procurement wording in the current programme and WBS; not a confirmed procurement lifecycle.','candidate','candidate'));
  const bestLongLead=bestAvailableFact(longLeadFacts);
  const activity=data(modules,'activity-analytics');
  const independent=data(modules,'independent-forecast');
  const milestones=data(modules,'milestones');
  const change=data(modules,'schedule-change-report');
  const revision=data(modules,'revision-trend');
  const progress=data(modules,'progress-report');
  const progressCurve=data(modules,'progress-scurve');
  const quantity=data(modules,'quantity-scurve');
  const delay=data(modules,'delay-claims');
  const notices=data(modules,'notices-claims');
  const eot=data(modules,'eot-assessment');
  const resource=data(modules,'resource-utilization');
  const manhour=data(modules,'manhour-scurve');
  const challenge=data(modules,'challenge-contract');

  const activityRows=Array.isArray(activity.rows)?activity.rows:[];
  const delivery=deliveryPosition(state);
  const activityById=new Map(activityRows.map((row:any)=>[row.activityId,row]));
  const drivingIds=Array.isArray(independent.drivingNetwork?.activityIds)?independent.drivingNetwork.activityIds:[];
  // A wide driving network can contain every activity. Build reusable indexes
  // once, rather than scanning/rebuilding the entire network for every row.
  const cpmById=new Map<string,any>();
  for(const row of independent.activities??[])if(!cpmById.has(row.activityId))cpmById.set(row.activityId,row);
  const drivingSet=new Set(drivingIds);
  const networkMilestones=new Set(independent.drivingNetwork?.finishActivityIds??[]);
  const drivingActivities=drivingIds.map((activityId:string)=>{
    const scheduleRow=activityById.get(activityId) as any;
    const cpmRow=cpmById.get(activityId);
    return {
      activityId,
      name:scheduleRow?.name??activityId,
      wbs:scheduleRow?.wbsPath??scheduleRow?.wbsId??null,
      currentFinishIso:scheduleRow?.currentFinishIso??scheduleRow?.forecastFinishIso??null,
      independentFinishIso:cpmRow?.independentEarlyFinishIso??null,
      sourceFloatHours:scheduleRow?.totalFloatHours??null,
      movementDays:cpmRow?.finishVarianceDays??null,
      status:scheduleRow?.status??null,
    };
  });

  const driverGroupsMap=new Map<string,{
    wbs:string;activityIds:string[];activityNames:string[];currentFinishes:string[];
    lowestFloatHours:number|null;milestoneIds:string[];packageCandidates:string[];
  }>();
  const milestoneSource=(Array.isArray(milestones.rows)?milestones.rows:[]).filter((row:any)=>row.status!=='completed');
  // Index once. The full driving set can contain 20k activities and must not
  // re-scan all milestones, delivery packages and BOQ packages for every row.
  const milestoneByActivity=new Map<string,Array<{id:string;ordinal:number}>>();
  const networkMilestoneRows:Array<{id:string;ordinal:number}>=[];
  milestoneSource.forEach((m:any,ordinal:number)=>{
    const entry={id:String(m.activityId),ordinal}, rows=milestoneByActivity.get(entry.id)??[];
    rows.push(entry);milestoneByActivity.set(entry.id,rows);
    if(networkMilestones.has(m.activityId))networkMilestoneRows.push(entry);
  });
  const packageCandidatesByActivity=new Map<string,string[]>();
  for(const p of delivery.packageRows)for(const id of p.activityIds){
    const rows=packageCandidatesByActivity.get(id)??[];
    rows.push(p.reference??p.recordId);packageCandidatesByActivity.set(id,rows);
  }
  const boqCandidatesByWbs=new Map<string,string[]>();
  for(const p of boqScope.packages){
    const label=String(p.package??''),rows=boqCandidatesByWbs.get(label)??[];
    rows.push(label);boqCandidatesByWbs.set(label,rows);
  }
  for(const row of drivingActivities){
    const wbs=String(row.wbs??'Unclassified driving scope');
    const group=driverGroupsMap.get(wbs)??{
      wbs,activityIds:[],activityNames:[],currentFinishes:[],lowestFloatHours:null,milestoneIds:[],packageCandidates:[]
    };
    group.activityIds.push(row.activityId);
    if(row.name)group.activityNames.push(String(row.name));
    if(row.currentFinishIso)group.currentFinishes.push(String(row.currentFinishIso));
    if(typeof row.sourceFloatHours==='number')group.lowestFloatHours=group.lowestFloatHours===null?row.sourceFloatHours:Math.min(group.lowestFloatHours,row.sourceFloatHours);
    const localMilestones=milestoneByActivity.get(row.activityId)??[];
    if(!driverGroupsMap.has(wbs)){
      // Preserve source-order precedence when the first activity establishes a
      // group. Network finish milestones are shared by all rows in that group.
      const first=[...networkMilestoneRows,...localMilestones].sort((a,b)=>a.ordinal-b.ordinal);
      group.milestoneIds.push(...first.map(m=>m.id));
    }else{
      // The global entries were already attached. Only local milestones can
      // add to the group's unique display population.
      group.milestoneIds.push(...localMilestones.filter(m=>!networkMilestones.has(m.id)).map(m=>m.id));
    }
    group.packageCandidates.push(...(packageCandidatesByActivity.get(row.activityId)??[]));
    group.packageCandidates.push(...(boqCandidatesByWbs.get(wbs)??[]));
    driverGroupsMap.set(wbs,group);
  }
  const priorityGroups=[...driverGroupsMap.values()].map(group=>({
    wbs:group.wbs,
    activityCount:group.activityIds.length,
    activityIds:[...new Set(group.activityIds)],
    activityNames:[...new Set(group.activityNames)],
    latestCurrentFinishIso:group.currentFinishes.sort().at(-1)??null,
    lowestFloatHours:group.lowestFloatHours,
    milestoneIds:[...new Set(group.milestoneIds)].slice(0,10),
    packageCandidates:[...new Set(group.packageCandidates)].slice(0,10),
    consequence:group.milestoneIds.length
      ?'Completion-driving scope is linked to '+[...new Set(group.milestoneIds)].length+' open milestone(s).'
      :'Completion-driving scope is established; a downstream milestone link is not established from the available programme evidence.',
  })).sort((a,b)=>(a.lowestFloatHours??Number.MAX_SAFE_INTEGER)-(b.lowestFloatHours??Number.MAX_SAFE_INTEGER)||b.activityCount-a.activityCount||a.wbs.localeCompare(b.wbs));

  const delayed=activityRows.filter((row:any)=>row.status!=='completed'&&!['level_of_effort','wbs_summary'].includes(row.activityType)&&(
    row.scheduleDelayed===true||(typeof row.finishVarianceDays==='number'&&row.finishVarianceDays>0)
  ));
  const wbsMap=new Map<string,{label:string;count:number;critical:number;negativeFloat:number;maxMovementDays:number|null}>();
  for(const row of delayed){
    const label=String(row.wbsPath??row.wbsId??'Unclassified WBS');
    const current=wbsMap.get(label)??{label,count:0,critical:0,negativeFloat:0,maxMovementDays:null};
    current.count++;
    if(row.criticality==='critical')current.critical++;
    if(typeof row.totalFloatHours==='number'&&row.totalFloatHours<0)current.negativeFloat++;
    if(typeof row.finishVarianceDays==='number')current.maxMovementDays=current.maxMovementDays===null?row.finishVarianceDays:Math.max(current.maxMovementDays,row.finishVarianceDays);
    wbsMap.set(label,current);
  }
  const delayedWbs=[...wbsMap.values()].sort((a,b)=>b.critical-a.critical||b.negativeFloat-a.negativeFloat||b.count-a.count);

  const milestoneRows=(Array.isArray(milestones.rows)?milestones.rows:[])
    .filter((row:any)=>row.status!=='completed')
    .sort((a:any,b:any)=>{
      const rank=(v:any)=>v==='critical'?0:v==='high'?1:v==='watch'?2:3;
      return rank(a.managementPriority)-rank(b.managementPriority)
        ||(a.daysFromDataDate??Number.MAX_SAFE_INTEGER)-(b.daysFromDataDate??Number.MAX_SAFE_INTEGER)
        ||(b.varianceDays??0)-(a.varianceDays??0);
    }).slice(0,10).map((row:any)=>({
      activityId:row.activityId,name:row.name??null,wbs:row.wbsName??row.wbsId??null,status:row.status,
      priority:row.managementPriority??'normal',baselineDateIso:row.baselineDateIso??null,currentDateIso:row.currentDateIso??null,
      varianceDays:row.varianceDays??null,totalFloatHours:row.totalFloatHours??null,criticality:row.criticality??null
    }));

  const commercialPositions=commercial.currencies.map(row=>({
    currency:row.currency,
    originalContractValue:{value:row.originalContractValue.value,state:row.originalContractValue.state},
    currentContractValue:{value:row.currentContractValue.value,state:row.currentContractValue.state},
    approvedVariationAmount:{value:row.approvedVariationAmount.value,state:row.approvedVariationAmount.state},
    pendingVariationAmount:{value:row.pendingVariationAmount.value,state:row.pendingVariationAmount.state},
    certifiedUnpaidAmount:{value:row.certifiedUnpaidAmount.value,state:row.certifiedUnpaidAmount.state},
    retentionDeductedAmount:{value:row.retentionDeductedAmount.value,state:row.retentionDeductedAmount.state},
  }));
  const costPositions=(commercial.performance.costControl?.positions??[]).map(row=>{
    const scenarios=(row.eacScenarios??[]).filter(s=>findingValue(s.value)!==null);
    const source=scenarios.find(s=>s.method==='source_reported')??null;
    const calculated=scenarios.find(s=>s.method!=='source_reported')??null;
    const contractValue=commercial.currencies.find(c=>c.currency===row.currency)?.currentContractValue.value??null;
    const selectedEac=source?findingValue(source.value):calculated?findingValue(calculated.value):null;
    return {
      currency:row.currency,taxBasis:row.taxBasis,
      bac:findingValue(row.bac),pv:findingValue(row.pv),ev:findingValue(row.ev),ac:findingValue(row.ac),
      spi:findingValue(row.spi),cpi:findingValue(row.cpi),cv:findingValue(row.cv),sv:findingValue(row.sv),
      sourceEac:findingValue(row.sourceEac),calculatedVac:findingValue(row.calculatedVac),
      bestEac:source?findingValue(source.value):calculated?findingValue(calculated.value):null,
      bestEacBasis:source?'source_reported':calculated?'cmeng_scenario':null,
      forecastMethodState:row.forecastMethodState,
      currentContractValue:contractValue,
      eacAboveCurrentContract:selectedEac===null||contractValue===null?null:selectedEac-contractValue,
      currentContractComparisonBasis:'Arithmetic comparison only. Confirm that the EAC covers the approved variation scope and uses the same tax basis before treating the difference as headroom or overrun.',
    };
  });

  const claimsReporting=delay.claimsReporting??notices.claimsReporting??null;
  const claimPopulationIntegrity=delay.claimPopulationIntegrity??notices.claimPopulationIntegrity??null;
  const claimPopulationQuarantined=claimPopulationIntegrity?.state==='quarantined';
  const claimsSource=sourceInventory.domains.find(row=>row.domain==='claims')??null;
  const claims={
    // Quarantined source evidence is retained for audit but is not a governed
    // claim/event population. Keep its source row count visible while withholding
    // governed counts so presentation can never turn "under review" into zero.
    sourceEventCount:claimPopulationQuarantined?null:claimsReporting?.events?.population?.sourceCount??null,
    currentEventCount:claimPopulationQuarantined?null:claimsReporting?.events?.asOf?.length??(delay.contractorClaimEvidenceSubmitted===true?delay.eventCount??null:null),
    sourceClaimCount:claimPopulationQuarantined
      ? claimPopulationIntegrity?.sourceClaimCount??claimsSource?.readableRowCount??null
      : claimsReporting?.claims?.population?.sourceCount??null,
    currentClaimCount:claimPopulationQuarantined?null:claimsReporting?.claims?.asOf?.length??null,
    sourceEvidenceRowCount:claimsSource?.readableRowCount??null,
    sourceDocumentCount:claimsSource?.documentCount??0,
    integrityState:claimPopulationIntegrity?.state??null,
    quarantinedClaimCount:claimPopulationIntegrity?.quarantinedClaimCount??0,
    integrityReasons:claimPopulationIntegrity?.reasons??[],
    currentNoticeCount:claimPopulationQuarantined?null:claimsReporting?.notices?.asOf?.length??null,
    timelyNoticeCount:claimPopulationQuarantined?null:notices.timelyNoticeCount??commercial.claimsNotices?.noticeTimelinessCounts?.timely??null,
    lateNoticeCount:claimPopulationQuarantined?null:notices.lateNoticeCount??commercial.claimsNotices?.noticeTimelinessCounts?.late??null,
    missingNoticeCount:claimPopulationQuarantined?null:notices.missingNoticeCount??commercial.claimsNotices?.noticeTimelinessCounts?.not_issued??null,
    officialApprovedEotDays:eot.officialApprovedEotDays??null,
    analyticalTimeImpactCandidateDays:claimPopulationQuarantined?null:eot.analyticalTimeImpactCandidateDays??null,
    attributableCandidateEotDays:claimPopulationQuarantined?null:eot.attributableCandidateEotDays??null,
    candidateAdditionalEotDays:claimPopulationQuarantined?null:eot.candidateAdditionalEotDays??null,
    fullChainCount:claimPopulationQuarantined?null:delay.fullDeterminationChainEventCount??null,
    incompleteChainCount:claimPopulationQuarantined?null:delay.determinationChainIncompleteEventCount??null,
  };

  const changeSummary={
    matchedActivityCount:change.matchedActivityCount??null,
    addedActivityCount:change.addedActivityCount??null,
    removedActivityCount:change.removedActivityCount??null,
    modifiedActivityCount:change.modifiedActivityCount??null,
    addedRelationshipCount:change.addedRelationshipCount??null,
    removedRelationshipCount:change.removedRelationshipCount??null,
    baselineMutationActivityCount:change.baselineMutationActivityCount??null,
    sourceTargetDateChangeCount:change.sourceTargetDateChangeCount??null,
    revisionCount:revision.revisionCount??null,
    latestRevision:revision.points?.at?.(-1)??null,
  };

  const progressSummary={
    scopeComparison:progress.scopeComparison??null,
    progressBases:progress.progressBases??null,
    latestCurvePoint:Array.isArray(progressCurve.points)?progressCurve.points.filter((p:any)=>!progressCurve.dataDateIso||String(p.dateIso).slice(0,10)<=String(progressCurve.dataDateIso).slice(0,10)).at(-1)??null:null,
  };

  const challengeSummary={
    overallStatus:challenge.boqFeasibility?.overallStatus??null,
    reason:challenge.boqFeasibility?.reason??null,
    requiredLaborHours:challenge.boqFeasibility?.requiredLaborHours??null,
    unresolvedCount:challenge.boqFeasibility?.unresolvedCount??null,
    programmeMovementDays:challenge.boqFeasibility?.programmePc?.movementDays??null,
    topActivityChecks:(challenge.boqFeasibility?.activityChecks??[]).filter((row:any)=>row.scheduleState==='exceeds'||row.manpowerState==='unresolved').slice(0,10),
    sourceLabor:challenge.sourceLaborEvidence??null,
  };

  const sourceDomain=(domain:string)=>sourceInventory.domains.find(row=>row.domain===domain)??null;
  const numericFact=(key:string,label:string,value:number|null,basis:string,authority:ManagementFactView<number>['authority'],state:ManagementFactView<number>['state'],coverage:{known:number;total:number}={known:value===null?0:1,total:1})=>
    value===null?null:managementFactView<number>({
      key,label,value,state,authority,basis,dataDateIso:managementContext.dataDateIso,diagnostics:[],receipts:[],coverage,
      population:{state:state==='official'?'established':state==='partial'?'partial':state==='candidate'?'candidate':state==='quarantined'?'quarantined':state==='conflicted'?'conflicted':'missing',
        sourceCount:coverage.total,applicableCount:state==='official'?coverage.total:null,currentCount:state==='official'?coverage.known:null,excludedCount:null,
        coveragePercent:coverage.total>0?Number((coverage.known/coverage.total*100).toFixed(4)):null,basis},
    });
  const sourceRowsFact=(domain:string,key:string,label:string)=>{
    const src=sourceDomain(domain),value=typeof src?.readableRowCount==='number'?src.readableRowCount:null;
    return numericFact(key,label,value,src?.basis??'No readable source population is established.','source','partial',
      {known:value??0,total:value??0});
  };
  const pick=<T>(rows:Array<ManagementFactView<T>|null>)=>bestAvailableFact(rows.filter((row):row is ManagementFactView<T>=>row!==null));

  const pBases=progress.progressBases??{};
  const progressCandidates:Array<ManagementFactView<number>|null>=[
    numericFact('physical-progress','Physical measured progress',pBases.physical?.valuePercent??null,'Physical measured progress evidence.','source','partial'),
    numericFact('contractor-progress','Contractor reported progress',pBases.contractorReported?.valuePercent??null,'Contractor reported progress evidence; not certified physical progress.','source','partial'),
    numericFact('certified-progress','Certified progress',pBases.certified?.valuePercent??null,'Certified progress evidence; retained as its own progress basis.','source','partial'),
    numericFact('schedule-snapshot-progress','Schedule snapshot progress',pBases.scheduleSnapshot?.valuePercent??null,'Schedule snapshot observation; contextual programme intelligence, not physical/certified progress.','calculated','candidate'),
    numericFact('current-planned-progress','Current planned progress',pBases.currentSchedule?.valuePercent??null,'Current schedule phasing at the Data Date; plan, not actual progress.','calculated','candidate'),
  ];
  const firstCost=costPositions[0]??null;
  const firstCommercial=commercialPositions[0]??null;
  const costCandidates:Array<ManagementFactView<number>|null>=[
    numericFact('source-eac','Source reported EAC',firstCost?.sourceEac??null,'Source-reported estimate at completion.','source','partial'),
    numericFact('calculated-eac','CMeng EAC scenario',firstCost?.bestEacBasis==='cmeng_scenario'?firstCost.bestEac:null,'CMeng calculated EAC scenario; not an official forecast.','calculated','candidate'),
    numericFact('current-contract-value','Current contract value',firstCommercial?.currentContractValue.value??null,'Current contract value; commercial basis rather than cost forecast.','source','partial'),
  ];
  const changeCandidates:Array<ManagementFactView<number>|null>=[
    numericFact('approved-variation-amount','Approved variation amount',firstCommercial?.approvedVariationAmount.value??null,'Approved/current variation amount from Commercial control.','source','partial'),
    numericFact('programme-modified-activities','Programme modified activities',change.modifiedActivityCount??null,'Observed schedule revision change; programme movement, not a contractual variation.','calculated','candidate'),
    sourceRowsFact('variations','variation-source-rows','Readable variation/change source rows'),
  ];
  const claimsCandidates:Array<ManagementFactView<number>|null>=[
    numericFact('current-claim-count','Current governed claims',claims.currentClaimCount,'Current governed claim population at the Data Date.','source','partial'),
    numericFact('source-claim-count','Source claims',claims.sourceClaimCount,'Readable claim records; source availability does not establish entitlement.','source',claims.integrityState==='quarantined'?'quarantined':'partial'),
    sourceRowsFact('claims','claim-source-rows','Readable Claims/EOT source rows'),
  ];
  const designSrc=sourceDomain('design'),submittalSrc=sourceDomain('submittal');
  const designCandidates:Array<ManagementFactView<number>|null>=[
    sourceRowsFact('design','design-source-rows','Readable design/RFI source rows'),
    sourceRowsFact('submittal','submittal-source-rows','Readable submittal source rows'),
    numericFact('programme-design-activities','Programme design/approval activities',
      managementContext.schedule?.programmeStages?.find((row:any)=>row.stage==='design')?.activityCount??null,
      'Schedule/WBS design and approval scope; contextual intelligence, not a confirmed design register.','candidate','candidate'),
  ];
  const measuredQuantityCount=typeof quantity.measurementReview?.measuredItemCount==='number'?quantity.measurementReview.measuredItemCount:null;
  const quantityCandidates:Array<ManagementFactView<number>|null>=[
    numericFact('measured-quantity-items','Measured installed quantity items',measuredQuantityCount,'Dated installed-quantity evidence.','source','partial'),
    numericFact('boq-quantity-items','BOQ quantity items',quantity.boqItemCount??boqScope.itemCount??null,'Readable BOQ quantity scope; not installed progress.','source','partial'),
    sourceRowsFact('boq','boq-source-rows','Readable BOQ/quantity source rows'),
  ];
  const riskCandidates:Array<ManagementFactView<number>|null>=[
    sourceRowsFact('risk','risk-source-rows','Readable formal risk source rows'),
    numericFact('schedule-float-risk','Schedule float-risk activities',activity.counts?.floatRisk?.value??null,'Programme float exposure; contextual risk intelligence, not a formal risk register.','calculated','candidate'),
  ];
  const qualityCandidates:Array<ManagementFactView<number>|null>=[
    sourceRowsFact('quality','quality-source-rows','Readable quality/NCR/inspection source rows'),
    sourceRowsFact('hse','hse-source-rows','Readable HSE/safety source rows'),
  ];
  const resourceCandidates:Array<ManagementFactView<number>|null>=[
    numericFact('assigned-resources','Assigned schedule resources',resource.assignedResourceCount??null,'Resources assigned to current programme activities.','source','partial'),
    numericFact('resource-master','Schedule resource master',resource.resourceCount??resource.p6ResourceMasterCount??null,'Resource master evidence from the programme.','source','partial'),
    sourceRowsFact('resources','resource-source-rows','Readable resource/manpower source rows'),
  ];
  const bestAvailablePositions={
    progress:pick(progressCandidates),
    cost:pick(costCandidates),
    change:pick(changeCandidates),
    claims:pick(claimsCandidates),
    design:pick(designCandidates),
    procurement:bestLongLead??null,
    quality:pick(qualityCandidates),
    quantities:pick(quantityCandidates),
    risk:pick(riskCandidates),
    resources:pick(resourceCandidates),
  };

  return {
    schemaVersion:'1.0',
    sourceInventory,
    bestAvailablePositions,
    schedule:{
      drivingActivityCount:drivingIds.length,
      finishActivityIds:independent.drivingNetwork?.finishActivityIds??[],
      drivingActivities,
      priorityGroups,
      delayedActivityCount:delayed.length,
      delayedWbs,
      criticalCount:activity.counts?.critical?.value??null,
      nearCriticalCount:activity.counts?.nearCritical?.value??null,
      floatRiskCount:activity.counts?.floatRisk?.value??null,
      negativeFloatKnownCount:activityRows.filter((row:any)=>typeof row.totalFloatHours==='number'&&row.totalFloatHours<0).length,
    },
    milestones:{
      milestoneCount:milestones.milestoneCount??null,
      openCount:milestones.openCount??null,
      lateOpenCount:milestones.lateOpenCount??null,
      due30Count:milestones.due30Count??null,
      criticalCount:milestones.criticalMilestoneCount??null,
      nearCriticalCount:milestones.nearCriticalMilestoneCount??null,
      negativeFloatCount:milestones.negativeFloatMilestoneCount??null,
      topRows:milestoneRows,
    },
    progress:progressSummary,
    changes:changeSummary,
    commercial:{positions:commercialPositions,cost:costPositions},
    claims,
    resources:{
      sourceResourceCount:resource.resourceCount??resource.p6ResourceMasterCount??null,
      assignedResourceCount:resource.assignedResourceCount??null,
      overallocatedPeriodCount:resource.overallocatedPeriodCount??null,
      plannedHours:manhour.plannedHours??manhour.plannedHoursKnown??null,
      actualHours:manhour.actualHours??manhour.actualHoursKnown??null,
    },
    challenge:challengeSummary,
    boqScope:{
      itemCount:boqScope.itemCount||null,
      candidatePackageCount:boqScope.packages.length||null,
      sourceMarkedLongLeadCount:sourceLongLeadCount,
      boqCandidateLongLeadCount:boqScope.longLead.length||null,
      scheduleCandidateLongLeadCount:scheduleLongLead.length||null,
      candidateLongLeadCount:bestLongLead?.value??null,
      bestLongLeadPosition:bestLongLead?{
        key:bestLongLead.key,label:bestLongLead.label,value:bestLongLead.value,state:bestLongLead.state,
        authority:bestLongLead.authority,basis:bestLongLead.basis
      }:null,
      complexity:boqScope.complexity,
      coverage:boqScope.coverage,
      topLongLead:
        delivery.packageRows.some(row=>row.longLeadCandidate)
          ?delivery.packageRows.filter(row=>row.longLeadCandidate).sort((a,b)=>Number(b.activityIds.some(id=>drivingSet.has(id)))-Number(a.activityIds.some(id=>drivingSet.has(id)))||(a.headroomCalendarDays??Infinity)-(b.headroomCalendarDays??Infinity)).map(row=>({itemId:row.recordId,itemNumber:row.reference,description:row.description,discipline:row.discipline,system:null,package:row.reference,priority:row.activityIds.some(id=>drivingSet.has(id))?'Critical':row.overdueUndelivered||(row.headroomCalendarDays??0)<0?'High':'From register',amount:row.packageValue,currency:row.currency,status:row.sourceStatus,requiredOnSite:row.needDate,forecastDelivery:row.forecastDelivery,basis:'source_register'}))
          :bestLongLead?.key==='source-long-lead'
          ?(procurementSource?.signals.longLeadSamples??[]).map((row,index)=>({
            itemId:'source-long-lead-'+index,itemNumber:row.reference,description:row.description,discipline:null,system:null,
            package:row.reference,priority:'Source marked',amount:null,currency:null,status:row.status,
            requiredOnSite:row.requiredOnSite,forecastDelivery:row.forecastDelivery,basis:'source_register'
          }))
          :bestLongLead?.key==='boq-long-lead'
            ?boqScope.longLead.slice(0,12).map(row=>({
              itemId:row.itemId,itemNumber:row.itemNumber,description:row.description,discipline:row.discipline,system:row.system,
              package:row.packageCandidate,priority:row.procurementPriority,amount:row.amount,currency:row.currency,
              basis:row.classificationBasis.longLeadCandidate
            }))
            :bestLongLead?.key==='schedule-long-lead'
              ?scheduleLongLead.slice(0,12).map(row=>({
                itemId:row.activityId,itemNumber:row.activityId,description:row.name,discipline:null,system:null,
                package:row.wbsPath,priority:typeof row.totalFloatHours==='number'&&row.totalFloatHours<=0?'Critical':'Schedule candidate',
                amount:null,currency:null,currentFinishIso:row.currentFinishIso,totalFloatHours:row.totalFloatHours,basis:'schedule_wbs_candidate'
              }))
              :[],
      basis:bestLongLead?.basis??(
        sourceLongLeadCount===0
          ?'The supplied procurement source contains no explicit Long Lead marks. No BOQ- or schedule-derived long-lead candidate is currently identified.'
          :'No procurement Long Lead field, readable BOQ long-lead screening, or schedule/WBS long-lead evidence is available.')
    },
  };
}
