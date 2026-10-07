import {aggregateCount} from '../../truth-kernel/src';
import {buildActivityAnalyticsProjection} from '../../activity-analytics/src';
import {buildScheduleAnalyticsProjection} from '../../schedule-analytics/src';
import {commercialPositionForState} from './commercial-runtime';
import {claimsReporting,operationalReporting,reportingState} from './reporting-state';
import {projectControlSchedule} from './canonical-time-claims';
import {projectScheduleControlBasis} from './schedule-control-basis';
import type {ModuleRuntimeResult,ProjectRuntimeState} from './project-state-types';
import {bindProjectFacts} from './project-fact-consumers';
import {pmcScheduleRules} from './pmc-schedule-rules';
import {projectActionRegisterForState} from './project-projections';
import {projectSourceLabels} from './project-presentation';
import {projectContractSections} from './project-contract-sections';

export type ProjectFactState =
  | 'confirmed'
  | 'from_register_not_confirmed'
  | 'calculated_with_stated_basis'
  | 'missing';

export interface ProjectFact<T> {
  value:T|null;
  state:ProjectFactState;
  complete:boolean;
  basis:string;
  sourceRefs:string[];
  diagnostics:string[];
}

export interface ProjectFactsSnapshot {
  schemaVersion:'1.0';
  projectId:string;
  projectVersion:number;
  dataDateIso:string|null;
  programmeQuality?:ReturnType<typeof pmcScheduleRules>;
  contractSections?:ReturnType<typeof projectContractSections>;
  actions:{openCount:ProjectFact<number>;recordCount:ProjectFact<number>;reviewCount:ProjectFact<number>};
  schedule:{
    dataDateIso:ProjectFact<string>;
    submittedProgrammeCompletionIso:ProjectFact<string>;
    criticalActivityCount:ProjectFact<number>;
    nearCriticalActivityCount:ProjectFact<number>;
    negativeFloatActivityCount:ProjectFact<number>;
    delayedOpenActivityCount:ProjectFact<number>;
    delayedExecutionActivityCount:ProjectFact<number>;
  };
  time:{
    contractualCompletionIso:ProjectFact<string>;
    awardedEotDays:ProjectFact<number>;
    extendedContractCompletionIso:ProjectFact<string>;
  };
  controls:{
    openRfiCount:ProjectFact<number>;
    overdueRfiCount:ProjectFact<number>;
    openCriticalMajorNcrCount:ProjectFact<number>;
    openRiskCount:ProjectFact<number>;
  };
  claims:{
    pipeline?:{recordCount:number;claimedDays:number|null;assessedDays:number|null;pendingCount:number;pendingAssessedDays:number|null;pendingScenarioCompletionIso:string|null;basis:string};
    eventDateMissingCount:ProjectFact<number>;
    noticeDateMissingCount:ProjectFact<number>;
    noticeRequirementMissingCount:ProjectFact<number>;
  };
  commercial:{
    variationRecordCount:ProjectFact<number>;
    approvedVariationCount:ProjectFact<number>;
    pendingVariationCount:ProjectFact<number>;
    rejectedVariationCount:ProjectFact<number>;
    activeBondCount:ProjectFact<number>;
    expiredBondCount:ProjectFact<number>;
    activeInsuranceCount:ProjectFact<number>;
    expiredInsuranceCount:ProjectFact<number>;
    currencies:Array<{
      currency:string;
      originalContractValue:ProjectFact<number>;
      currentContractValue:ProjectFact<number>;
      approvedVariationAmount:ProjectFact<number>;
      pendingVariationAmount:ProjectFact<number>;
      grossCertifiedAmount:ProjectFact<number>;
      netCertifiedAmount:ProjectFact<number>;
      paidAmount:ProjectFact<number>;
      interimCertificateCount:ProjectFact<number>;
      retentionDeductedAmount:ProjectFact<number>;
      retentionHeldAmount:ProjectFact<number>;
      claimedAmount:ProjectFact<number>;
      assessedClaimAmount:ProjectFact<number>;
      certifiedUnpaidAmount:ProjectFact<number>;
      advanceBalance:ProjectFact<number>;
      activeBondAmount:ProjectFact<number>;
    }>;
  };
}

const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ProjectFactsSnapshot}>();

function fact<T>(
  value:T|null,
  basis:string,
  state:ProjectFactState=value===null?'missing':'confirmed',
  complete=value!==null,
  sourceRefs:string[]=[],
  diagnostics:string[]=[],
):ProjectFact<T>{
  return {value,state,complete,basis,sourceRefs:[...new Set(sourceRefs)],diagnostics:[...new Set(diagnostics)]};
}

function aggregateFact(
  aggregate:{value:number|null;knownCount:number|null;unresolvedCount:number|null;populationCount:number|null},
  basis:string,
):ProjectFact<number>{
  if(aggregate.value!==null)return fact(aggregate.value,basis,'calculated_with_stated_basis',true);
  if(aggregate.populationCount!==null&&aggregate.populationCount>0&&aggregate.unresolvedCount===aggregate.populationCount)return fact<number>(null,basis,'missing',false);
  if(aggregate.knownCount!==null){
    return fact(
      aggregate.knownCount,
      basis+' The displayed number is the known subset; '+String(aggregate.unresolvedCount??0)+' record(s) remain unresolved.',
      'from_register_not_confirmed',
      false,
      [],
      aggregate.unresolvedCount?['PROJECT_FACT_PARTIAL_POPULATION:'+aggregate.unresolvedCount]:[],
    );
  }
  return fact<number>(null,basis,'missing',false);
}

function commercialFact<T>(
  metric:{value:T|null;state:string;sourceRefs:string[];diagnostics:string[]},
  basis:string,
  calculated=false,
):ProjectFact<T>{
  if(metric.value===null)return fact<T>(null,basis,'missing',false,metric.sourceRefs,metric.diagnostics);
  if(metric.state==='established'){
    return fact(metric.value,basis,calculated?'calculated_with_stated_basis':'confirmed',true,metric.sourceRefs,metric.diagnostics);
  }
  return fact(metric.value,basis,'from_register_not_confirmed',false,metric.sourceRefs,metric.diagnostics);
}

function sourceCount(
  official:number|null,
  known:number|null,
  complete:boolean,
  basis:string,
):ProjectFact<number>{
  if(official!==null)return fact(official,basis,'confirmed',true);
  // A zero known subset cannot establish that nothing is open when dates,
  // severity or status are unresolved. Positive known records remain usable.
  if(known!==null&&known>0)return fact(known,basis+' The register is readable but the total remains qualified.','from_register_not_confirmed',complete);
  return fact<number>(null,basis,'missing',false);
}

function projectedCount(
  value:number|null|undefined,
  state:string|null|undefined,
  basis:string,
  refs:string[],
):ProjectFact<number>{
  if(value===null||value===undefined)return fact<number>(null,basis,'missing',false,refs);
  if(state==='established')return fact(value,basis,'confirmed',true,refs);
  return fact(value,basis,'from_register_not_confirmed',false,refs);
}

export function projectFactsForState(state:ProjectRuntimeState):ProjectFactsSnapshot{
  const cached=cache.get(state);
  if(cached?.version===state.version)return cached.value;

  const scoped=reportingState(state);
  const current=projectControlSchedule(scoped);
  const model=current?.revision.model??null;
  const dataDateIso=model?.dataDateIso?.slice(0,10)??null;
  const config=projectScheduleControlBasis(scoped).analysisConfig;

  const activity=model
    ?buildActivityAnalyticsProjection(model,{generatedAt:'project-version:'+state.version,producerVersion:'project-facts-v1',config})
    :null;
  const schedule=model
    ?buildScheduleAnalyticsProjection(model,{generatedAt:'project-version:'+state.version,producerVersion:'project-facts-v1',config})
    :null;

  const executionRows=activity?.rows.filter(row=>!['level_of_effort','wbs_summary'].includes(row.activityType))??null;
  const openRows=executionRows?.filter(row=>row.status!=='completed')??null;
  const delayedOpen=aggregateCount(activity?.rows.filter(row=>row.status!=='completed')??null,row=>row.finishVarianceDays===null?null:row.finishVarianceDays>0);
  const delayedExecution=aggregateCount(openRows,row=>row.finishVarianceDays===null?null:row.finishVarianceDays>0);
  const negativeFloat=aggregateCount(openRows,row=>row.totalFloatHours===null?null:row.totalFloatHours<0);
  const float=schedule?.result.float??null;
  const critical=float
    ?{value:float.criticalCount,knownCount:float.knownClassifications.critical,unresolvedCount:float.unknownFloatCount,populationCount:float.totalActivities}
    :{value:null,knownCount:null,unresolvedCount:null,populationCount:null};
  const nearCritical=float
    ?{value:float.nearCriticalCount,knownCount:float.knownClassifications.nearCritical,unresolvedCount:float.unknownFloatCount+float.nearCriticalThresholdUnresolvedCount,populationCount:float.totalActivities}
    :{value:null,knownCount:null,unresolvedCount:null,populationCount:null};
  const submittedFinish=schedule?.result.completionBases.find(row=>row.basis==='forecast')
    ??schedule?.result.completionBases.find(row=>row.basis==='programme')
    ??null;

  const operations=operationalReporting(scoped);
  const openRfiKnown=operations.rfi.state==='missing'?null:operations.rfi.current.filter((row:any)=>row.status==='open').length;
  const overdueRfiKnown=operations.rfi.state==='missing'?null:operations.rfi.current.filter((row:any)=>
    row.status==='open'&&row.dueIso&&operations.dataDateIso&&row.dueIso<operations.dataDateIso
  ).length;
  const openRiskKnown=operations.risk.state==='missing'?null:operations.risk.current.filter((row:any)=>row.status==='open').length;

  const commercial=commercialPositionForState(
    scoped,
    dataDateIso?dataDateIso+'T00:00:00.000Z':'1970-01-01T00:00:00.000Z',
  );
  const variations=commercial.contractControls?.variations??null;
  const securities=commercial.contractControls?.bondsInsurance??null;
  const variationRefs=variations?.rows.flatMap(row=>row.sourceRefs)??[];
  const bondRefs=securities?.bonds.flatMap(row=>row.sourceRefs)??[];
  const insuranceRefs=securities?.insurances.flatMap(row=>row.sourceRefs)??[];
  const noticeGaps=commercial.claimsNotices.dimensionalEvidenceGaps;
  const reportedClaims=claimsReporting(scoped)?.reported;
  const pendingClaims=reportedClaims?.rows.filter(row=>['under_review','submitted'].includes(row.state))??[];
  const pendingAssessedDays=pendingClaims.length&&pendingClaims.every(row=>row.assessedDays!==null)?pendingClaims.reduce((sum,row)=>sum+row.assessedDays!,0):null;
  const extendedCompletion=commercial.timeExposure.officialAdjustedCompletion.value;

  const actionRegister=projectActionRegisterForState(state);
  const value:ProjectFactsSnapshot={
    schemaVersion:'1.0',
    projectId:state.projectId,
    projectVersion:state.version,
    dataDateIso,
    actions:{openCount:fact(actionRegister.actions.length,'Distinct record follow-ups and source-review decisions from the shared project action register.','calculated_with_stated_basis'),recordCount:fact(actionRegister.recordActionCount,'Distinct actionable source records.','calculated_with_stated_basis'),reviewCount:fact(actionRegister.reviewActionCount,'Source corrections and confirmation decisions.','calculated_with_stated_basis')},
    programmeQuality:pmcScheduleRules(model,scoped.schedules.filter(s=>s.role!=='scenario').map(s=>s.revision.model),commercial.timeExposure.officialAdjustedCompletion.value??commercial.timeExposure.contractualCompletion.value),
    contractSections:projectContractSections(scoped,commercial.timeExposure.contractualCompletion.value,commercial.timeExposure.officialAdjustedCompletion.value),
    schedule:{
      dataDateIso:fact(
        dataDateIso,
        'Adopted current programme Data Date.',
        dataDateIso?'confirmed':'missing',
        dataDateIso!==null,
        current?['schedule-revision:'+current.revision.revisionId]:[],
      ),
      submittedProgrammeCompletionIso:fact(
        submittedFinish?.dateIso??null,
        submittedFinish?.method??'Current submitted programme completion is not established.',
        submittedFinish?.dateIso?'confirmed':'missing',
        submittedFinish?.state==='available',
        submittedFinish?.sourceRefs??[],
      ),
      criticalActivityCount:aggregateFact(
        critical,
        'Execution activities classified critical by the shared schedule-analysis configuration.',
      ),
      nearCriticalActivityCount:aggregateFact(
        nearCritical,
        'Execution activities classified near-critical by the shared schedule-analysis configuration.',
      ),
      negativeFloatActivityCount:aggregateFact(
        negativeFloat,
        'Execution activities with source total float below zero.',
      ),
      delayedOpenActivityCount:aggregateFact(
        delayedOpen,
        'All unfinished programme records, including level-of-effort records, whose effective finish is later than the adopted baseline finish.',
      ),
      delayedExecutionActivityCount:aggregateFact(
        delayedExecution,
        'Unfinished execution activities, excluding level-of-effort and WBS summaries, later than the adopted baseline finish.',
      ),
    },
    time:{
      contractualCompletionIso:commercialFact(
        commercial.timeExposure.contractualCompletion,
        'Canonical contract-time position used by every consumer.',
      ),
      awardedEotDays:commercialFact(
        commercial.timeExposure.approvedEotDays,
        'Official awarded EOT through the project Data Date.',
      ),
      extendedContractCompletionIso:commercialFact(
        commercial.timeExposure.officialAdjustedCompletion,
        'Contract completion plus reconciled official awarded EOT.',
        true,
      ),
    },
    controls:{
      openRfiCount:sourceCount(
        operations.counts.openRfiCount,
        openRfiKnown,
        operations.rfi.complete,
        'Current RFI register as of the project Data Date.',
      ),
      overdueRfiCount:sourceCount(
        operations.counts.overdueRfiCount,
        overdueRfiKnown,
        operations.rfi.complete,
        'Open RFIs whose required response date is before the project Data Date.',
      ),
      openCriticalMajorNcrCount:sourceCount(
        operations.counts.openCriticalMajorNcrCount,
        operations.knownCounts.openCriticalMajorNcrCount,
        operations.quality.complete,
        'Current NCR register, open Major/Critical records only.',
      ),
      openRiskCount:sourceCount(
        operations.counts.openRiskCount,
        openRiskKnown,
        operations.risk.complete,
        'Current risk register open records.',
      ),
    },
    claims:{
      ...(reportedClaims?{pipeline:{recordCount:reportedClaims.recordCount,claimedDays:reportedClaims.claimedDays.value,assessedDays:reportedClaims.assessedDays.value,
        pendingCount:pendingClaims.length,pendingAssessedDays,
        pendingScenarioCompletionIso:extendedCompletion&&pendingAssessedDays!==null?new Date(Date.parse(extendedCompletion.slice(0,10))+pendingAssessedDays*86400000).toISOString().slice(0,10):null,
        basis:'From the supplied register for claim identities evidenced by the Data Date; unconfirmed assessments are not awards. The date scenario assumes every pending assessed day is awarded in addition, with no overlap or duplicate days.'}}:{}),
      eventDateMissingCount:sourceCount(
        noticeGaps.eventDateMissing,
        noticeGaps.eventDateMissing,
        commercial.claimsNotices.state==='established',
        'Current notice-assessment event-date gap count.',
      ),
      noticeDateMissingCount:sourceCount(
        noticeGaps.noticeDateMissing,
        noticeGaps.noticeDateMissing,
        commercial.claimsNotices.state==='established',
        'Current notice-assessment notice-date gap count.',
      ),
      noticeRequirementMissingCount:sourceCount(
        noticeGaps.requirementMissing,
        noticeGaps.requirementMissing,
        commercial.claimsNotices.state==='established',
        'Current notice-assessment contractual-requirement gap count.',
      ),
    },
    commercial:{
      variationRecordCount:projectedCount(
        variations?.recordCount,
        variations?.state,
        'Current variation lifecycle records.',
        variationRefs,
      ),
      approvedVariationCount:projectedCount(
        variations?.approvedCount,
        variations?.state,
        'Current variation lifecycle stage = approved.',
        variationRefs,
      ),
      pendingVariationCount:projectedCount(
        variations?.pendingCount,
        variations?.state,
        'Current variation lifecycle stages that remain pending.',
        variationRefs,
      ),
      rejectedVariationCount:projectedCount(
        variations?.rejectedCount,
        variations?.state,
        'Current variation lifecycle stage = rejected.',
        variationRefs,
      ),
      activeBondCount:projectedCount(
        securities?.activeBondCount,
        securities?.state,
        'Security instruments valid at the Data Date; expiry overrides stale status text.',
        bondRefs,
      ),
      expiredBondCount:projectedCount(
        securities?.expiredBondCount,
        securities?.state,
        'Security instruments expired before the Data Date.',
        bondRefs,
      ),
      activeInsuranceCount:projectedCount(
        securities?.activeInsuranceCount,
        securities?.state,
        'Insurance policies valid at the Data Date.',
        insuranceRefs,
      ),
      expiredInsuranceCount:projectedCount(
        securities?.expiredInsuranceCount,
        securities?.state,
        'Insurance policies expired before the Data Date.',
        insuranceRefs,
      ),
      currencies:commercial.currencies.map(row=>({
        currency:row.currency,
        pendingVariationAmount:commercialFact(row.pendingVariationAmount,'Dated pending variations in this currency; zero only for a readable register with no pending or unknown stages.'),
        grossCertifiedAmount:commercialFact(row.grossCertifiedAmount,'Dated gross certification before retention and advance deductions; applications excluded.'),
        netCertifiedAmount:row.netCertifiedAmount?commercialFact(row.netCertifiedAmount,'Dated net certification after deductions; applications excluded.'):fact<number>(null,'Net certification is missing.'),
        paidAmount:commercialFact(row.paidAmount,'Evidenced cash receipts through the Data Date.'),
        interimCertificateCount:commercialFact(row.interimCertificateCount,'Certificates issued through the Data Date; applications excluded.'),
        retentionDeductedAmount:commercialFact(row.retentionDeductedAmount,'Dated retention deductions through the Data Date.'),
        retentionHeldAmount:commercialFact(row.retentionHeldAmount,'Reported retention balance in this currency.'),
        claimedAmount:commercialFact(row.claimedAmount,'Current submitted claims in this currency.'),
        assessedClaimAmount:commercialFact(row.assessedClaimAmount,'Assessed claim amount with the stated authority.'),
        originalContractValue:commercialFact(
          row.originalContractValue,
          'Canonical Commercial currency position.',
        ),
        currentContractValue:commercialFact(
          row.currentContractValue,
          'Original contract value plus approved variations only.',
          true,
        ),
        approvedVariationAmount:commercialFact(
          row.approvedVariationAmount,
          'Approved variation amount in this currency only.',
        ),
        certifiedUnpaidAmount:commercialFact(
          row.certifiedUnpaidAmount,
          'Certified amount less evidenced paid amount with complete payment coverage.',
          true,
        ),
        advanceBalance:commercialFact(
          row.advanceBalance,
          'Explicit advance balance or contract advance less certified recoveries.',
          true,
        ),
        activeBondAmount:commercialFact(
          row.activeBondAmount,
          'Valid active security amounts only; currencies remain separate.',
        ),
      })),
    },
  };

  cache.set(state,{version:state.version,value});
  return value;
}

export function attachProjectFacts(state:ProjectRuntimeState,result:ModuleRuntimeResult):ModuleRuntimeResult{
  const data=result.data&&typeof result.data==='object'?result.data as Record<string,unknown>:{};
  return {...result,data:{...bindProjectFacts(result.key,data,projectFactsForState(state)),sourceLabels:projectSourceLabels(state)}};
}
