import type {CommercialControlPosition} from '../../commercial-control/src';
import type {ModuleRuntimeResult,ProjectRuntimeState} from './project-state-types';
import {managementSourceInventory} from './management-source-inventory';
import {boqScopeIntelligence} from './boq-scope-intelligence';
import {projectManagementContext} from './management-context';
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
){
  const sourceInventory=managementSourceInventory(state);
  const managementContext=projectManagementContext(state,modules,commercial);
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
  const delay=data(modules,'delay-claims');
  const notices=data(modules,'notices-claims');
  const eot=data(modules,'eot-assessment');
  const resource=data(modules,'resource-utilization');
  const manhour=data(modules,'manhour-scurve');
  const challenge=data(modules,'challenge-contract');

  const activityRows=Array.isArray(activity.rows)?activity.rows:[];
  const activityById=new Map(activityRows.map((row:any)=>[row.activityId,row]));
  const drivingIds=Array.isArray(independent.drivingNetwork?.activityIds)?independent.drivingNetwork.activityIds:[];
  const drivingActivities=drivingIds.slice(0,20).map((activityId:string)=>{
    const scheduleRow=activityById.get(activityId) as any;
    const cpmRow=(independent.activities??[]).find((row:any)=>row.activityId===activityId);
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

  const delayed=activityRows.filter((row:any)=>!['level_of_effort','wbs_summary'].includes(row.activityType)&&(
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
  const delayedWbs=[...wbsMap.values()].sort((a,b)=>b.critical-a.critical||b.negativeFloat-a.negativeFloat||b.count-a.count).slice(0,10);

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
    return {
      currency:row.currency,taxBasis:row.taxBasis,
      bac:findingValue(row.bac),pv:findingValue(row.pv),ev:findingValue(row.ev),ac:findingValue(row.ac),
      spi:findingValue(row.spi),cpi:findingValue(row.cpi),cv:findingValue(row.cv),sv:findingValue(row.sv),
      sourceEac:findingValue(row.sourceEac),calculatedVac:findingValue(row.calculatedVac),
      bestEac:source?findingValue(source.value):calculated?findingValue(calculated.value):null,
      bestEacBasis:source?'source_reported':calculated?'cmeng_scenario':null,
      forecastMethodState:row.forecastMethodState,
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

  return {
    schemaVersion:'1.0',
    sourceInventory,
    schedule:{
      drivingActivityCount:drivingIds.length,
      finishActivityIds:independent.drivingNetwork?.finishActivityIds??[],
      drivingActivities,
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
        bestLongLead?.key==='source-long-lead'
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
