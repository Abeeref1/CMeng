import {registerCompleteness,riskRegisterCompleteness,type RegisterCompleteness} from './register-completeness';
import {projectDecisionFacts,decisionAnalysisForModule,measuredProgressByArea} from './project-decision-facts';
import {calendarInputStatus,capacityInputStatus,riskOwnerInputStatus,riskRowInputStatus,quantityInputStatus,installedQuantityInputStatus,cpmCoverageInputStatus,disciplineInputStatus,bindSharedInputStatus,type CalendarInputStatus,type CapacityInputStatus,type RiskOwnerInputStatus,type RiskRowInputStatus,type QuantityInputStatus,type InstalledQuantityInputStatus,type CpmCoverageInputStatus,type DisciplineInputStatus} from './project-input-status';
import {boqSourceReporting} from './reporting-state';
import {projectScopeClassification} from './location-review';
import {canonicalResources} from './canonical-resource-runtime';
import {bindMeasuredAreasToWbs} from './progress-breakdown-source-area';
import {boqProgrammeLinks} from './boq-programme-links';
import {managementValueState,type ManagementValueState} from './management-values';
import {aggregateCount} from '../../truth-kernel/src';
import {buildScheduleAnalyticsProjection} from '../../schedule-analytics/src';
import {commercialPositionForState} from './commercial-runtime';
import {claimsReporting,operationalReporting,reportingState} from './reporting-state';
import {projectControlSchedule} from './canonical-time-claims';
import {projectScheduleControlBasis} from './schedule-control-basis';
import type {ModuleRuntimeResult,ProjectRuntimeState} from './project-state-types';
import {bindProjectFacts} from './project-fact-consumers';
import {pmcScheduleRules} from './pmc-schedule-rules';
import {projectActionRegisterForState,peekCachedScheduleAnalytics,analyticalHistory} from './project-projections';
import {cachedIndependentForecast} from './forecast-cache';
import {parseScheduleInstant} from '../../schedule-cpm/src/calendar';
import {projectSourceLabels} from './project-presentation';
import {projectContractSections} from './project-contract-sections';
import {contractCompletionPosition} from './contract-completion';
import {canonicalTimeClaims} from './canonical-time-claims';
import {deliveryPosition} from './delivery-projections';
import {securityValidityReview} from './security-validity';
import {moduleFeatureAvailability} from './feature-availability';
import {contractSourceAnalysis,CONTRACT_SOURCE_ANALYTICAL_NOTE,SOURCE_ANALYTICAL_USE} from './contract-source-analysis';
import {buildForecastReconciliationGate} from './forecast-control';
import {scheduleCriticalityFacts} from './schedule-criticality-facts';
import {dateAdditionBasisLabel} from './commercial-sum-basis';
import {tradeChainResourcesForState,tradeChainFacts} from './trade-chain-resources';
import {earnedHoursForState} from './earned-hours';
import {pendingEotScenario,type PendingEotScenario} from './pending-eot-scenario';
import {contractTimeDatesFrom} from './contract-time-reader';
import {extractContractLdTerms} from '../../contract-commercial/src';
import {certifiedAmountLabel} from '../../commercial-control/src';
import {registerScopeReason} from './unknown-reason';

export type ProjectFactState =
  | 'confirmed'
  | 'from_register_not_confirmed'
  | 'calculated_with_stated_basis'
  | 'missing';

export interface ProjectFact<T> {
  value:T|null;
  valueState?:ManagementValueState;
  state:ProjectFactState;
  complete:boolean;
  basis:string;
  /** S1: why the value is unknown or qualified and what is needed, in plain words. */
  reason?:string;
  sourceRefs:string[];
  diagnostics:string[];
}

export interface ProjectFactsSnapshot {
  schemaVersion:'1.0';
  projectId:string;
  projectVersion:number;
  dataDateIso:string|null;
  programmeQuality?:ReturnType<typeof pmcScheduleRules>;
  /** F46: repeated trade chains, their remaining assigned hours, stated capacity,
   * shortfall and completion effect (one shared calculation with the Resources page). */
  resources?:{tradeChains:ReturnType<typeof tradeChainFacts>};
  contractSections?:ReturnType<typeof projectContractSections>;
  actions:{openCount:ProjectFact<number>;recordCount:ProjectFact<number>;reviewCount:ProjectFact<number>};
  /** F07: the one shared status of the inputs pages depend on (calendars,
   * resource capacity, risk owners). Every page reads these same rules. */
  inputs?:ProjectInputStatus;
  schedule:{
    dataDateIso:ProjectFact<string>;
    submittedProgrammeCompletionIso:ProjectFact<string>;
    declaredProjectFinishIso?:ProjectFact<string>;
    /** Canonical management criticality. Deterministic independent CPM governs
     * when established; submitted/source float remains separately visible. */
    floatBasis:'independent_cpm'|'source_total_float'|'qualified_scenario'|'missing';
    criticalityLabel?:string;
    criticalActivityCount:ProjectFact<number>;
    nearCriticalActivityCount:ProjectFact<number>;
    negativeFloatActivityCount:ProjectFact<number>;
    submittedCriticalActivityCount:ProjectFact<number>;
    submittedNearCriticalActivityCount:ProjectFact<number>;
    submittedNegativeFloatActivityCount:ProjectFact<number>;
    independentCriticalActivityCount:ProjectFact<number>;
    independentNearCriticalActivityCount:ProjectFact<number>;
    independentNegativeFloatActivityCount:ProjectFact<number>;
    delayedOpenActivityCount:ProjectFact<number>;
    delayedExecutionActivityCount:ProjectFact<number>;
  };
  time:{
    contractualCompletionIso:ProjectFact<string>;
    awardedEotDays:ProjectFact<number>;
    extendedContractCompletionIso:ProjectFact<string>;
    /** F33: the one date lateness and delay damages are measured against. */
    governingContractCompletionIso?:ProjectFact<string>;
    /** F34: the Works Time for Completion is stated as a period: the basis of the
     * date (Commencement Date + the period) or the reason it stays unknown. */
    completionPeriod?:{label:string|null;reason:string|null;commencementIso:string|null};
    submittedDaysAfterExtendedCompletion?:ProjectFact<number>;
    submittedDaysAfterCurrentContract?:ProjectFact<number>;
    submittedDaysAfterOriginalCompletion?:ProjectFact<number>;
    independentDaysAfterCurrentContract?:ProjectFact<number>;
    amendmentEotStatements?:Array<{documentId:string;statement:string;sourceRefs:string[];basis:string;sourceAnalyticalUse?:typeof SOURCE_ANALYTICAL_USE;sourceAnalyticalNote?:string}>;
  };
  controls:{
    openRfiCount:ProjectFact<number>;
    overdueRfiCount:ProjectFact<number>;
    openNcrCount:ProjectFact<number>;
    overdueNcrCount:ProjectFact<number>;
    openCriticalMajorNcrCount:ProjectFact<number>;
    openRiskCount:ProjectFact<number>;
    expiredPermitCount?:ProjectFact<number>;
  };
  claims:{
    pipeline?:{rows?:Array<{claimId:string;state:string;claimedDays:number|null;assessedDays:number|null}>;recordCount:number;claimedDays:number|null;assessedDays:number|null;pendingCount:number;pendingAssessedDays:number|null;pendingScenarioCompletionIso:string|null;pendingEotScenario?:PendingEotScenario|null;basis:string;
      /** Additive (F06): records stated with different values in two current files (later file used). */
      sourceRecordQueries?:Array<{queryId:string;kind:string;recordId:string;field:string;usedValue:string;question:string}>};
    eventDateMissingCount:ProjectFact<number>;
    noticeDateMissingCount:ProjectFact<number>;
    noticeRequirementMissingCount:ProjectFact<number>;
  };
  commercial:{
    securityValidity?:ReturnType<typeof securityValidityReview>;
    /** F34: the one shared sectional LD position (contract controls), read by Dashboard, Director and Financial Claims. */
    sectionalLd?:import('../../commercial-contract-controls/src').SectionalLdPosition|null;
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
      forecastEac?:ProjectFact<number>;
      cpi?:ProjectFact<number>;
      approvedVariationAmount:ProjectFact<number>;
      pendingVariationAmount:ProjectFact<number>;
      grossCertifiedAmount:ProjectFact<number>;
      /** R12 (additive): the register column the certified figure came from (null: none read). */
      grossCertifiedAmountColumn?:'gross'|'net'|'unstated'|null;
      /** R12 (additive): the shared label of the certified figure. */
      grossCertifiedAmountLabel?:string;
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
      /** F20: summary of the shared dated cash series (commercial position datedCashSeries). */
      cashSeries?:{
        periodCount:number;latestActualPeriod:string|null;
        latestPeriod:{period:string;certified:number|null;paid:number|null;sourceRefs:string[]}|null;
        certifiedToDate:number|null;paidToDate:number|null;
        forecastBasis:string;forecastBasisLabel:string;forecastReason:string|null;
        nextForecastPeriod:string|null;nextForecast:{forecastIncome:number|null;forecastExpenditure:number|null}|null;
        forecastIncomeTotal:number|null;forecastExpenditureTotal:number|null;
      };
    }>;
  };
}

const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ProjectFactsSnapshot}>();
/** R12: the stated basis of the certified figure follows the register column it came from. */
const CERTIFIED_FIGURE_BASIS={
  gross:'Dated gross certification before retention and advance deductions; applications excluded.',
  net:'Dated certified amounts from a net certified column (after deductions); the gross certified amount is not stated in the source. Applications excluded.',
  unstated:'Dated certified amounts from a column that does not say gross or net; the source does not state which. Applications excluded.',
} as const;

/** F20: the brief and every page read one dated cash series; this is its summary per currency. */
function cashSeriesSummary(series:import('./dated-cash-series').DatedCashSeries|undefined,currency:string){
  const row=series?.currencies.find(c=>c.currency===currency);
  if(!row)return {};
  const actual=row.periods.filter(p=>p.certified!==null||p.paid!==null);
  const latest=actual.at(-1)??null,next=row.nextForecastPeriod?row.periods.find(p=>p.period===row.nextForecastPeriod)??null:null;
  return {cashSeries:{
    periodCount:row.periods.length,latestActualPeriod:row.latestActualPeriod,
    latestPeriod:latest?{period:latest.period,certified:latest.certified,paid:latest.paid,sourceRefs:latest.sourceRefs.slice(0,10)}:null,
    certifiedToDate:row.certifiedToDate,paidToDate:row.paidToDate,
    forecastBasis:row.forecastBasis,forecastBasisLabel:row.forecastBasisLabel,forecastReason:row.forecastReason,
    nextForecastPeriod:row.nextForecastPeriod,nextForecast:next?{forecastIncome:next.forecastIncome,forecastExpenditure:next.forecastExpenditure}:null,
    forecastIncomeTotal:row.forecastIncomeTotal,forecastExpenditureTotal:row.forecastExpenditureTotal,
  }};
}

function fact<T>(
  value:T|null,
  basis:string,
  state:ProjectFactState=value===null?'missing':'confirmed',
  complete=value!==null,
  sourceRefs:string[]=[],
  diagnostics:string[]=[],
):ProjectFact<T>{
  const valueState:ManagementValueState=value!==null?managementValueState(value):diagnostics.some(d=>/CONFLICT|DISAGREE/.test(d))?'records_disagree':diagnostics.some(d=>/WITHHELD|SUPPRESS|QUARANTIN|CPM.*FAIL|RECONCILIATION.*FAIL/.test(d))?'withheld':diagnostics.some(d=>/NOT_CALCUL|INVALID/.test(d))?'not_calculable':'not_established';
  return {value,valueState,state:value===null?'missing':state,complete:value===null?false:complete,basis,sourceRefs:[...new Set(sourceRefs)],diagnostics:[...new Set(diagnostics)]};
}

/** S1: a missing or qualified fact carries why and what is needed; a complete
 * fact is returned unchanged. */
function withFactReason<T>(item:ProjectFact<T>,reason:string):ProjectFact<T>{
  return !reason||item.value!==null&&item.complete?item:{...item,reason};
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
      basis+' The displayed number is the known subset; '+(aggregate.unresolvedCount===null?'the unresolved record count is not established':String(aggregate.unresolvedCount)+' record(s) remain unresolved')+'.',
      'from_register_not_confirmed',
      false,
      [],
      aggregate.unresolvedCount===null?['PROJECT_FACT_UNRESOLVED_POPULATION_NOT_ESTABLISHED']:aggregate.unresolvedCount>0?['PROJECT_FACT_PARTIAL_POPULATION:'+aggregate.unresolvedCount]:[],
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
  reason='',
  completeness:RegisterCompleteness|null=null,
):ProjectFact<number>{
  // M4.3: an available count from readable records is published, qualified, until
  // the register is confirmed complete; only then is it a confirmed figure.
  if(official!==null&&completeness?.state==='not_established')return fact(official,basis+' '+completeness.note,'from_register_not_confirmed',false);
  if(official!==null)return fact(official,basis,'confirmed',true);
  const why=reason?{reason}:{};
  // A zero known subset cannot establish that nothing is open when dates,
  // severity or status are unresolved. Positive known records remain usable.
  if(known!==null&&known>0)return {...fact(known,basis+' The register is readable but the total remains qualified.','from_register_not_confirmed',complete),...why};
  return {...fact<number>(null,basis,'missing',false),...why};
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

/** Read completed facts without starting a cold calculation for navigation. */
export function completedProjectFactsForState(state:ProjectRuntimeState):ProjectFactsSnapshot|null{
  state=reportingState(state);
  const cached=cache.get(state);
  return cached?.version===state.version?cached.value:null;
}

export function projectFactsForState(state:ProjectRuntimeState):ProjectFactsSnapshot{
  // Facts are reporting facts. Cache them on the canonical read-only reporting
  // view so callers that start from persisted state and callers already working
  // on that view share one exact snapshot for the same project version.
  // The Dashboard uses this same snapshot and the same full action register.
  state=reportingState(state);
  const cached=cache.get(state);
  if(cached?.version===state.version)return cached.value;

  const scoped=state;
  const current=projectControlSchedule(scoped);
  const model=current?.revision.model??null;
  const dataDateIso=model?.dataDateIso?.slice(0,10)??null;
  const config=projectScheduleControlBasis(scoped).analysisConfig;

  // Keep the shared facts producer light. The full Activity Analytics projection
  // is already built by the project bundle; rebuilding its thousands of rows here
  // made first management views recalculate the same project a second time.
  const schedule=model
    ?peekCachedScheduleAnalytics(state)??buildScheduleAnalyticsProjection(model,{generatedAt:'project-version:'+state.version,producerVersion:'project-facts-v1',config})
    :null;
  const executionRows=model?.activities.filter(row=>!['level_of_effort','wbs_summary'].includes(row.activityType))??null;
  const openRows=executionRows?.filter(row=>row.status!=='completed')??null;
  const effectiveFinish=(row:NonNullable<typeof executionRows>[number])=>
    row.status==='completed'&&row.actualFinishIso?row.actualFinishIso:(row.forecastFinishIso??row.currentFinishIso??row.actualFinishIso);
  const finishVarianceDays=(row:NonNullable<typeof executionRows>[number])=>{
    const currentFinish=effectiveFinish(row);
    if(!row.baselineFinishIso||!currentFinish)return null;
    const baseline=Date.parse(row.baselineFinishIso),currentMs=Date.parse(currentFinish);
    return Number.isFinite(baseline)&&Number.isFinite(currentMs)?Number(((currentMs-baseline)/86400000).toFixed(6)):null;
  };
  const delayedOpen=aggregateCount(model?.activities.filter(row=>row.status!=='completed')??null,row=>{
    if(['wbs_summary'].includes(row.activityType))return false;
    const variance=finishVarianceDays(row);return variance===null?null:variance>0;
  });
  const delayedExecution=aggregateCount(openRows,row=>{const variance=finishVarianceDays(row);return variance===null?null:variance>0;});
  const governedCriticality=scheduleCriticalityFacts(state,schedule?.result.float);
  const {submittedCritical,submittedNearCritical,submittedNegativeFloat,
    independentCritical,independentNearCritical,independentNegativeFloat,
    canonicalCritical,canonicalNearCritical,canonicalNegativeFloat,
    authoritativeIndependent,floatBasis,independentForecast}=governedCriticality;
  const submittedFinish=schedule?.result.completionBases.find(row=>row.basis==='forecast')
    ??schedule?.result.completionBases.find(row=>row.basis==='programme')
    ??null;

  const operations=operationalReporting(scoped);
  const permitRows=deliveryPosition(scoped).permitRows;
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
  const claimsReport=claimsReporting(scoped),reportedClaims=claimsReport?.reported;
  const pendingClaims=reportedClaims?.rows.filter(row=>['under_review','submitted'].includes(row.state))??[];
  const pendingAssessedDays=pendingClaims.length&&pendingClaims.every(row=>row.assessedDays!==null)?pendingClaims.reduce((sum,row)=>sum+row.assessedDays!,0):null;
  const extendedCompletion=commercial.timeExposure.officialAdjustedCompletion.value;
  const officialAward=commercial.timeExposure.approvedEotDays.value;
  const contractTime=canonicalTimeClaims(scoped).contractTimeBasis;
  // F34: the period basis applies only to the date every page reads (or to its absence).
  const statedPeriod=contractTime?.contractualCompletionPeriod??null;
  const completionPeriod=statedPeriod&&(statedPeriod.label?contractTime!.contractualCompletionIso===commercial.timeExposure.contractualCompletion.value:commercial.timeExposure.contractualCompletion.value===null)?statedPeriod:null;
  // An adjustment identical to the original completion is not an extension.
  // Some source amendments echo the original date while a separate dated EOT
  // award exists. Retain both facts and present the calendared comparison
  // without claiming that amendment/EOT overlap has been legally reconciled.
  const baseCompletion=commercial.timeExposure.contractualCompletion.value;
  const adjustmentUnapplied=(extendedCompletion===null||(
    baseCompletion!==null&&extendedCompletion.slice(0,10)===baseCompletion.slice(0,10)));
  const dateRepeatedDespiteAward=baseCompletion!==null&&extendedCompletion!==null&&
    baseCompletion.slice(0,10)===extendedCompletion.slice(0,10);
  // C9: while the overlap is not confirmed, CMeng's proposal gives the date (qualified), on every page.
  const overlapProposal=contractTime?.overlapResolution==='unresolved'?contractTime.overlapProposal??null:null;
  // C9: the user's overlap decision is final: no other comparison replaces it.
  const overlapDecided=(contractTime?.sourceRefs??[]).some(ref=>ref.startsWith('user-confirmation:eot-overlap:'));
  const overlapPending=!overlapProposal&&!overlapDecided&&adjustmentUnapplied&&officialAward!==null&&officialAward>0&&(
    dateRepeatedDespiteAward||contractTime?.overlapResolution!=='resolved'
  );
  const completionPosition=overlapPending?contractCompletionPosition(scoped,dataDateIso):null;
  const completionCandidates=completionPosition?.candidates??[];
  const amendedDates=[...new Set(completionCandidates.filter(item=>item.role==='amendment'&&!item.historical&&
    item.effectiveFrom!==null&&dataDateIso!==null&&item.effectiveFrom<=dataDateIso).map(item=>item.date))];
  // This is a visible SOURCE-QUALIFIED comparison, never a second official
  // EOT award or a new governing contract date. No extra days are silently
  // added to an amendment, because that could double-count awarded EOT.
  // SW-22: the same shared original-date read the EOT page uses.
  const originalDate=completionPosition?.original.value??null;
  const calendared=originalDate&&/^\d{4}-\d{2}-\d{2}$/.test(originalDate)
    ?Date.parse(originalDate+'T00:00:00Z'):NaN;
  const provisionalExtendedDate=overlapPending&&Number.isFinite(calendared)
    ?new Date(calendared+officialAward!*86400000).toISOString().slice(0,10)
    :null;
  const overlapSourceRefs=overlapPending?[...new Set([
    ...completionCandidates.map(item=>item.sourceRef),
    ...(contractTime?.sourceRefs??[]),
  ])]:[];
  // F27: the date addition states its records through the shared basis label.
  // The days shown are the exact difference between the two dates used, so the
  // label always matches the addition actually made.
  const extensionBasis=(start:string|null|undefined,result:string|null|undefined,label:string)=>' '+dateAdditionBasisLabel({label,startIso:start,resultIso:result,asOf:dataDateIso});
  const presentedExtension=overlapProposal
    ?fact(extendedCompletion??baseCompletion,'CMeng proposal, not confirmed: the amended completion plus '+overlapProposal.days+' additional awarded days. '+overlapProposal.reason+' Confirm or correct it in Project Review.'+
        extensionBasis(baseCompletion,extendedCompletion??baseCompletion,'amended completion'),'from_register_not_confirmed',false,[...new Set(contractTime?.sourceRefs??[])],['AMENDMENT_OVERLAP_PROPOSED_NOT_CONFIRMED'])
    :provisionalExtendedDate!==null
    ?fact(provisionalExtendedDate,'Amendment overlap to confirm: original contract completion plus the source-reported awarded EOT, assuming calendar days unless the contract expressly adopts that day basis. The result is a qualified comparison, not a certified amendment or a basis for liquidated damages.'+extensionBasis(originalDate,provisionalExtendedDate,'original contract completion'),'from_register_not_confirmed',false,overlapSourceRefs,['AMENDMENT_OVERLAP_TO_CONFIRM'])
    :commercialFact(commercial.timeExposure.officialAdjustedCompletion,
        (commercial.timeExposure.officialAdjustedCompletion.diagnostics.includes('EOT_CALENDAR_DAY_BASIS_ASSUMED_CHECK_CONTRACT')
          ?'Contract completion plus awarded EOT, using assumed calendar days; confirm the applicable day definition.'
          :'Contract completion plus reconciled official awarded EOT.')+
        (commercial.timeExposure.officialAdjustedCompletion.value!==null?extensionBasis(commercial.timeExposure.contractualCompletion.value,commercial.timeExposure.officialAdjustedCompletion.value,'contract completion'):''),true);
  // Never call a project late against the original date when an award exists
  // but the extended date cannot yet be calculated.
  const currentContractCompletion=contractTimeDatesFrom(commercial.timeExposure).governingCompletionIso;
  const forecastGate=model&&independentForecast?buildForecastReconciliationGate({
    model,forecast:independentForecast,
    requiredFinishIso:currentContractCompletion
  }):null;
  // P0-B: the calculated finish, published with its qualifications whenever the network can be calculated.
  const independentFinish=forecastGate?.managementForecastCompletionIso??null;
  // F38: the previous dated, adopted revision (latest earlier Data Date in the
  // shared revision history) and its CMeng CPM, under the same publication gate
  // as the current CPM. Only read when the current CPM is publishable.
  const history=current&&independentFinish!==null?analyticalHistory(scoped):[];
  const currentAt=current?history.findIndex(row=>row.revision.revisionId===current.revision.revisionId):-1;
  const currentDataMs=parseScheduleInstant(model?.dataDateIso??null);
  const previousStored=currentAt>0&&currentDataMs!==null?history.slice(0,currentAt).filter(row=>{const at=parseScheduleInstant(row.revision.model.dataDateIso??null);return at!==null&&at<currentDataMs;}).at(-1)??null:null;
  const previousForecast=previousStored?cachedIndependentForecast(previousStored.revision.model,'project-version:'+state.version):null;
  const previousPublishable=!!previousStored&&!!previousForecast&&buildForecastReconciliationGate({model:previousStored.revision.model,forecast:previousForecast,requiredFinishIso:currentContractCompletion}).usable===true;
  const previousRevision=previousStored?{revisionId:previousStored.revision.revisionId,label:previousStored.revision.label??previousStored.sourceFilename??null,model:previousStored.revision.model,
    forecast:previousPublishable?previousForecast:null,reason:previousPublishable?null:'The CMeng CPM of the previous revision did not pass the same publication gate as the current one, so its total floats are not established.'}:null;
  const controlBasis=projectScheduleControlBasis(scoped);
  const calendarDifference=(finish:string|null|undefined,target:string|null)=>finish&&target?(Date.parse(finish.slice(0,10))-Date.parse(target.slice(0,10)))/86400000:null;
  // F33: one shared governing date (contract + awarded EOT; never the original
  // date while an award exists but the extended date is unknown).
  const governingCompletion=fact(currentContractCompletion,
    extendedCompletion?'Contract completion including the awarded EOT; lateness and delay damages are measured against it.':'Contract completion; no awarded EOT is recorded.',
    'calculated_with_stated_basis',currentContractCompletion!==null&&(extendedCompletion?commercial.timeExposure.officialAdjustedCompletion.state==='established':commercial.timeExposure.contractualCompletion.state==='established'));
  const pendingScenario=pendingEotScenario({model,cpmPublishable:independentFinish!==null,governingCompletionIso:currentContractCompletion,
    pendingCount:pendingClaims.length,pendingAssessedDays,ldTerms:scoped.contract?extractContractLdTerms(scoped.contract):null,
    ...(scoped.controls?.contractValue?{contractValue:scoped.controls.contractValue}:{})});

  // T04: the shared source-analytical rule; wording read only from an
  // unadopted amendment is quoted with its label, never as adopted text.
  const amendmentSources=contractSourceAnalysis(scoped);
  const amendmentEotStatements=(scoped.contractDocuments??[])
    .filter(doc=>doc.role==='amendment')
    .filter(doc=>amendmentSources.eligible(doc.documentId,true)).map(doc=>{
      const unadopted=amendmentSources.unadopted(doc.documentId);
      const fragments=[
        ...(doc.result.pdf?.pages??[]).filter(page=>Boolean(page.text?.trim()))
          .map(page=>({text:page.text,locator:'page:'+page.pageNumber})),
        ...(doc.result.sections??[]).filter(section=>Boolean(section.text?.trim()))
          .map(section=>({text:section.text,locator:'section:'+section.sectionKey}))
      ];
      const phrase=fragments.map(part=>{
        const explicit=/\b(?:EOT\s*(?:granted|approved)|extended\s+by|extension\s+of\s+time\s*(?:granted|approved)?\s*(?:of|by)?)\s*:?\s*(\d+)\s*(?:calendar|working)?\s*days\b/i.exec(part.text);
        const zero=/(?:\bno\s+(?:additional\s+)?(?:EOT|extension\s+of\s+time)\b|\b(?:zero|0)\s+days\s+(?:EOT|extension)\b)/i.exec(part.text);
        return {wording:explicit?.[0]??zero?.[0]??null,locator:part.locator};
      }).find(item=>item.wording!==null);
      const sourceRefs=['contract-document:'+doc.documentId,...(phrase?['contract-document:'+doc.documentId+':'+phrase.locator]:[])];
      const statement=phrase?'Amendment states: "'+phrase.wording!.replace(/\s+/g,' ').trim()+'"':
          fragments.length
            ?'amendment text not found: no explicit EOT statement identified in the extracted wording; the determination-register award remains separate.'
            :'amendment text not found; the determination-register award remains separate.';
      const basis=phrase?'Quoted extracted source text; not an independent award determination':
          fragments.length?'Source does not explicitly state an EOT period':'Document extraction incomplete';
      return {documentId:doc.documentId,
        statement:unadopted?statement+' ('+CONTRACT_SOURCE_ANALYTICAL_NOTE.replace(/\.$/,'').toLowerCase()+')':statement,
        sourceRefs,
        basis:unadopted?basis+'. '+CONTRACT_SOURCE_ANALYTICAL_NOTE:basis,
        ...(unadopted?{sourceAnalyticalUse:SOURCE_ANALYTICAL_USE,sourceAnalyticalNote:CONTRACT_SOURCE_ANALYTICAL_NOTE}:{})};
    });
  const actionRegister=projectActionRegisterForState(state);
  const value:ProjectFactsSnapshot={
    schemaVersion:'1.0',
    projectId:state.projectId,
    projectVersion:state.version,
    dataDateIso,
    actions:{openCount:fact(actionRegister.actions.length,'Owner/register/state groups plus source-review decisions. Individual record actions are counted only inside groups.','calculated_with_stated_basis'),recordCount:fact(actionRegister.recordActionCount,'Distinct actionable source records.','calculated_with_stated_basis'),reviewCount:fact(actionRegister.reviewActionCount,'Source corrections and confirmation decisions.','calculated_with_stated_basis')},
    resources:{tradeChains:tradeChainFacts(tradeChainResourcesForState(scoped))},
    programmeQuality:pmcScheduleRules(model,scoped.schedules.filter(s=>s.role!=='scenario').map(s=>s.revision.model),commercial.timeExposure.officialAdjustedCompletion.value??commercial.timeExposure.contractualCompletion.value,
      {independentForecast:independentFinish!==null?independentForecast:null,resources:current?state.resourcesByRevision.get(current.revision.revisionId)??null:null,
        criticality:{config,thresholdMethod:controlBasis.nearCriticalThresholdMethod,headlineFloatBasis:floatBasis},previousRevision}),
    contractSections:projectContractSections(scoped,commercial.timeExposure.contractualCompletion.value,commercial.timeExposure.officialAdjustedCompletion.value,currentContractCompletion),
    schedule:{
      floatBasis,
      criticalityLabel:governedCriticality.floatLabel,
      dataDateIso:fact(
        dataDateIso,
        'Adopted current programme Data Date.',
        dataDateIso?'confirmed':'missing',
        dataDateIso!==null,
        current?['schedule-revision:'+current.revision.revisionId]:[],
      ),
      declaredProjectFinishIso:withFactReason(fact(model?.declaredProjectFinishIso??null,
        'Project finish explicitly recorded in the submitted programme header; separate from activity-derived completion and independent CPM.',
        model?.declaredProjectFinishIso?'confirmed':'missing',model?.declaredProjectFinishIso!=null,
        model?.declaredProjectFinishIso?['schedule-revision:'+model.sourceRevisionId+':PROJECT.plan_end_date']:[]),'Needs a project finish date in the programme header'),
      submittedProgrammeCompletionIso:fact(
        submittedFinish?.dateIso??null,
        submittedFinish?.method??'Current submitted programme completion is not established.',
        submittedFinish?.dateIso?'confirmed':'missing',
        submittedFinish?.state==='available',
        submittedFinish?.sourceRefs??[],
      ),
      criticalActivityCount:aggregateFact(
        canonicalCritical,
        authoritativeIndependent
          ?'Unfinished execution activities classified critical by the standard independent CPM on the source calendars.'
             :'Unfinished execution activities classified critical from '+governedCriticality.floatLabel+'.',
      ),
      nearCriticalActivityCount:aggregateFact(
        canonicalNearCritical,
        authoritativeIndependent
          ?'Unfinished execution activities classified near-critical by the standard independent CPM on the source calendars, using the shared threshold.'
             :'Unfinished execution activities classified near-critical from '+governedCriticality.floatLabel+'.',
      ),
      negativeFloatActivityCount:aggregateFact(
        canonicalNegativeFloat,
        authoritativeIndependent
          ?'Unfinished execution activities with standard independent CPM total float below zero.'
             :'Unfinished execution activities with '+governedCriticality.floatLabel+'.',
      ),
      submittedCriticalActivityCount:aggregateFact(submittedCritical,'Submitted/source total-float critical activities retained for reconciliation.'),
      submittedNearCriticalActivityCount:aggregateFact(submittedNearCritical,'Submitted/source total-float near-critical activities retained for reconciliation.'),
      submittedNegativeFloatActivityCount:aggregateFact(submittedNegativeFloat,'Submitted/source negative-float activities retained for reconciliation.'),
      independentCriticalActivityCount:aggregateFact(independentCritical,'Independent CPM critical activities; unavailable until the independent calculation covers all open execution activities.'),
      independentNearCriticalActivityCount:aggregateFact(independentNearCritical,'Independent CPM near-critical activities; unavailable until the independent calculation covers all open execution activities.'),
      independentNegativeFloatActivityCount:aggregateFact(independentNegativeFloat,'Independent CPM negative-float activities; unavailable until the independent calculation covers all open execution activities.'),
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
      amendmentEotStatements,
      submittedDaysAfterOriginalCompletion:fact(calendarDifference(submittedFinish?.dateIso,commercial.timeExposure.contractualCompletion.value),'Submitted programme finish minus the recorded original contractual completion, calendar-date comparison only. This is not the award-adjusted deadline or entitlement.','calculated_with_stated_basis'),
      submittedDaysAfterCurrentContract:fact(calendarDifference(submittedFinish?.dateIso,currentContractCompletion),'Submitted finish less contract completion including known awarded EOT, using calendar dates.','calculated_with_stated_basis'),
      independentDaysAfterCurrentContract:fact(calendarDifference(independentFinish,currentContractCompletion),'Calendar recalculation finish less contract completion including known awarded EOT, using calendar dates.','calculated_with_stated_basis'),
      submittedDaysAfterExtendedCompletion:fact(submittedFinish?.dateIso&&extendedCompletion?(Date.parse(submittedFinish.dateIso.slice(0,10))-Date.parse(extendedCompletion.slice(0,10)))/86400000:null,'Submitted finish less contract completion including awarded EOT, in calendar days.','calculated_with_stated_basis'),
      contractualCompletionIso:withFactReason(commercialFact(
        commercial.timeExposure.contractualCompletion,
        // T04: every page, report and Ask answer reading this fact shows the label.
        (contractTime?.contractualCompletionSourceUse==='qualified_source_read'
          ?'Canonical contract-time position used by every consumer. '+(contractTime.contractualCompletionSourceNote??'Read from source; not formally adopted.')
          :'Canonical contract-time position used by every consumer.')+
        // F34: a date computed from the Commencement Date and a stated period states that basis; an unknown date states why.
        (completionPeriod?.label?' Basis: '+completionPeriod.label+'.':completionPeriod?.reason?' '+completionPeriod.reason:''),
      ),completionPeriod?.reason||'Needs the contractual completion date from the contract'),
      ...(completionPeriod?{completionPeriod}:{}),
      awardedEotDays:commercialFact(
        commercial.timeExposure.approvedEotDays,
        'Official awarded EOT through the project Data Date.',
      ),
      extendedContractCompletionIso:withFactReason(presentedExtension,presentedExtension.value===null
        ?(presentedExtension.diagnostics.some(d=>d.startsWith('ADJUSTED_COMPLETION_REQUIRES_CONTRACTUAL_COMPLETION'))?'Needs the contractual completion date and a dated awarded EOT':'Needs awarded EOT days from a dated determination')
        :provisionalExtendedDate!==null?'Review the amendment and determination overlap before this becomes the governing date':''),
      governingContractCompletionIso:governingCompletion,
    },
    controls:{
      expiredPermitCount:aggregateFact(aggregateCount(permitRows.length?permitRows:null,row=>['not_established','validity_not_established'].includes(row.permitStatus)||row.permitStatus==='expired'&&row.affectsOpenWork===null?null:row.permitStatus==='expired'&&row.affectsOpenWork===true),'Supplied permits whose validity ends before the project Data Date; valid-from and valid-to fields are used without inventing an issue date.'),
      openRfiCount:sourceCount(
        operations.counts.openRfiCount,
        openRfiKnown,
        operations.rfi.complete,
        'Current RFI register as of the project Data Date.',
        registerScopeReason(operations.rfi,'an RFI register'),
        registerCompleteness(state,'design'),
      ),
      overdueRfiCount:sourceCount(
        operations.counts.overdueRfiCount,
        overdueRfiKnown,
        operations.rfi.complete,
        'Open RFIs whose required response date is before the project Data Date.',
        registerScopeReason(operations.rfi,'an RFI register'),
        registerCompleteness(state,'design'),
      ),
      openNcrCount:sourceCount(
        operations.counts.openNcrCount,
        operations.knownCounts.openNcrCount,
        operations.quality.complete,
        'Current NCR register open records through the project Data Date, all severities.',
        registerScopeReason(operations.quality,'an NCR register'),
        registerCompleteness(state,'quality'),
      ),
      overdueNcrCount:sourceCount(
        operations.counts.overdueNcrCount,
        operations.knownCounts.overdueNcrCount,
        operations.quality.complete,
        'Open NCRs whose required closure date precedes the project Data Date.',
        registerScopeReason(operations.quality,'an NCR register'),
        registerCompleteness(state,'quality'),
      ),
      openCriticalMajorNcrCount:sourceCount(
        operations.counts.openCriticalMajorNcrCount,
        operations.knownCounts.openCriticalMajorNcrCount,
        operations.quality.complete,
        'Current NCR register, open Major/Critical records only.',
        registerScopeReason(operations.quality,'an NCR register'),
        registerCompleteness(state,'quality'),
      ),
      openRiskCount:sourceCount(
        operations.counts.openRiskCount,
        openRiskKnown,
        operations.risk.complete,
        'Current risk register open records.',
        registerScopeReason(operations.risk,'a risk register'),
        riskRegisterCompleteness(state),
      ),
    },
    claims:{
      ...(reportedClaims?{pipeline:{rows:reportedClaims.rows.map(row=>({claimId:row.claimId,state:row.sourceStatus||row.state,claimedDays:row.claimedDays,assessedDays:row.assessedDays})),recordCount:reportedClaims.recordCount,claimedDays:reportedClaims.claimedDays.value,assessedDays:reportedClaims.assessedDays.value,
        pendingCount:pendingClaims.length,pendingAssessedDays,
        // F44: the CMeng CPM scenario; date arithmetic only as its labelled fallback.
        pendingScenarioCompletionIso:pendingScenario?.scenarioContractCompletionIso??null,pendingEotScenario:pendingScenario,
        sourceRecordQueries:(claimsReport?.sourceRecordQueries??[]).map(query=>({queryId:query.queryId,kind:query.kind,recordId:query.recordId,field:query.field,usedValue:query.usedValue,question:query.question})),
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
        'partial',
        'Identified current pending lifecycle stages in the supplied register; complete pending exposure is not established by an approved-only list.',
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
      securityValidity:securityValidityReview(scoped,commercial.sourceLedger?.bonds??[],submittedFinish?.dateIso??null),
      sectionalLd:commercial.contractControls?.liquidatedDamages?.sectionalPosition??null,
      currencies:commercial.currencies.map(row=>({
        currency:row.currency,
        forecastEac:(()=>{const rows=projectDecisionFacts(state).commercialSummary.filter((p:any)=>p.currency===row.currency);const r=rows.length===1?rows[0]:null;return commercialFact(r?.forecastEac??{value:null,state:'missing',sourceRefs:[]},'Latest source EAC in its reporting period, currency and tax basis.');})(),
        cpi:(()=>{const rows=projectDecisionFacts(state).commercialSummary.filter((p:any)=>p.currency===row.currency);const r=rows.length===1?rows[0]:null;return commercialFact(r?.cpi??{value:null,state:'missing',sourceRefs:[]},'EV / AC from the same reporting period, currency and tax basis.');})(),
        pendingVariationAmount:commercialFact(row.pendingVariationAmount,'Dated pending variations in this currency; zero only for a readable register with no pending or unknown stages.'),
        grossCertifiedAmount:commercialFact(row.grossCertifiedAmount,CERTIFIED_FIGURE_BASIS[row.grossCertifiedAmountColumn??'gross']),
        grossCertifiedAmountColumn:row.grossCertifiedAmountColumn??null,
        grossCertifiedAmountLabel:row.grossCertifiedAmountLabel??certifiedAmountLabel(null),
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
        ...cashSeriesSummary(commercial.datedCashSeries,row.currency),
      })),
    },
  };

  value.inputs=projectInputStatus(state);
  cache.set(state,{version:state.version,value});
  return value;
}

export interface ProjectInputStatus {
  calendar:CalendarInputStatus;
  capacity:CapacityInputStatus;
  riskOwners:RiskOwnerInputStatus;
  /** F07: the one risk register row count every risk page states. */
  riskRows:RiskRowInputStatus;
  /** F07: BOQ quantities and units readable. */
  quantities:QuantityInputStatus;
  /** F07: installed measurement records matched to BOQ items at the Data Date. */
  installedQuantities:InstalledQuantityInputStatus;
  /** F07: share of activities the CMeng CPM calculates and whether it is publishable. */
  cpmCoverage:CpmCoverageInputStatus;
  /** F07: the programme's discipline list (activity codes, else the shared name rule). */
  disciplines:DisciplineInputStatus;
}
const quantityInputCache=new WeakMap<ProjectRuntimeState,{version:number;value:{quantities:QuantityInputStatus;installedQuantities:InstalledQuantityInputStatus}}>();
/** F07: the one BOQ quantity and installed quantity status of a project, read
 * by the project facts and by the Quantities page producer alike. */
export function quantityInputStatusForState(state:ProjectRuntimeState){
  state=reportingState(state);
  const cached=quantityInputCache.get(state);if(cached?.version===state.version)return cached.value;
  const model=state.quantities??null;
  const quantities=quantityInputStatus(boqSourceReporting(state),model?.items??null);
  const installedQuantities=installedQuantityInputStatus(quantities,model,projectControlSchedule(state)?.revision.model.dataDateIso??null);
  const value={quantities,installedQuantities};quantityInputCache.set(state,{version:state.version,value});return value;
}
/** F07: CMeng CPM coverage and publication, under the same gate and calendar
 * rule the project facts use for the CMeng finish. */
export function cpmCoverageInputStatusForState(state:ProjectRuntimeState):CpmCoverageInputStatus{
  state=reportingState(state);
  const model=projectControlSchedule(state)?.revision.model??null;
  const forecast=model?scheduleCriticalityFacts(state).independentForecast:null;
  const gate=model&&forecast?buildForecastReconciliationGate({model,forecast,requiredFinishIso:contractTimeDatesFrom(commercialPositionForState(state).timeExposure).governingCompletionIso}):null;
  return cpmCoverageInputStatus(forecast,gate);
}
/** F07: shared input status for a project, from the same rules the pages use. */
export function projectInputStatus(state:ProjectRuntimeState):ProjectInputStatus{
  state=reportingState(state);
  const model=projectControlSchedule(state)?.revision.model??null;
  return {
    calendar:calendarInputStatus(model),
    capacity:capacityInputStatus(canonicalResources(state)),
    // No supplied risk rows: owner coverage is unknown, never 0 of 0.
    riskOwners:(rows=>riskOwnerInputStatus(rows.length?rows:null))(operationalReporting(state).risk.sourceRows),
    riskRows:riskRowInputStatus(operationalReporting(state).risk),
    ...quantityInputStatusForState(state),
    cpmCoverage:cpmCoverageInputStatusForState(state),
    disciplines:disciplineInputStatus(model?projectScopeClassification(state,model).rows:null),
  };
}

export function attachProjectFacts(state:ProjectRuntimeState,result:ModuleRuntimeResult):ModuleRuntimeResult{
  const data=result.data&&typeof result.data==='object'?result.data as Record<string,unknown>:{};
  const bound=bindProjectFacts(result.key,data,projectFactsForState(state));
  if(bound.projectDiagnosis&&typeof bound.projectDiagnosis==='object'){
    const register=projectActionRegisterForState(state);
    bound.projectDiagnosis={...bound.projectDiagnosis,actionRegister:{total:register.actions.length,actions:register.actions.slice(0,5)}};
  }
  const scoped=reportingState(state),decisions=projectDecisionFacts(scoped);
  const key=result.key;
  const completionMilestoneConstraints=decisions.completionConstraints;
  const briefCommercialPosition=key==='pmo-analysis'?{currencies:decisions.commercialSummary}:undefined;
  const relevant=['quantity-scurve','quantity-progress','pmo-analysis','schedule-analytics','material-tracking','challenge-contract','delivery-control'];
  const linked=relevant.includes(key)?decisions.boqLinkage:undefined;
  // F46: the Resources page shows the same trade-chain calculation as the project facts.
  const tradeChains=key==='resource-utilization'?tradeChainResourcesForState(scoped):undefined;
  // F45: earned hours (budgeted hours x % complete) against hours spent, one shared calculation for both pages.
  const earnedHours=key==='manhour-scurve'||key==='resource-utilization'?earnedHoursForState(scoped):undefined;
  const decisionAnalysis=decisionAnalysisForModule(scoped,key,bound);
  // The primary WBS management table and the measured-area panel consume
  // one authoritative source value, only for unique exact-name associations.
  const measured=key==='progress-breakdown'?bindMeasuredAreasToWbs(bound,decisionAnalysis):bound;
  // F07: pages that show or gate on a shared input read it from the project facts.
  const inputs=bound.projectFacts.inputs;
  const shown:Record<string,any>=bindSharedInputStatus(key,measured,inputs);
  // F07: prerequisites shown on a page are decided from the shared inputs.
  if(inputs&&shown.featureAvailability&&(key==='challenge-contract'||key==='quantity-scurve'))
    shown.featureAvailability=moduleFeatureAvailability(key,shown,{calendar:inputs.calendar,quantities:inputs.quantities,installedQuantities:inputs.installedQuantities});
  const cpmHeld=key==='independent-forecast'&&shown.forecastReconciliationGate?.heldBySharedRule===true;
  // F45: the Progress page shows the same measured progress by area.
  const measuredProgress=key==='progress-report'?measuredProgressByArea(scoped):null;
  // The fast worker path and the direct route share the same bound action
  // position, including the explanation sent before transport paging.
  const reason=key==='cross-domain-accountability'&&typeof bound.managementPosition==='string'?bound.managementPosition:cpmHeld?shown.managementReviewReason:result.reason;
  return {...result,...(cpmHeld?{status:'partial' as const}:{}),reason,data:{...shown,completionMilestoneConstraints,...(briefCommercialPosition?{briefCommercialPosition}:{}),...(linked?{boqProgrammeLinks:linked}:{}),...(decisionAnalysis?{decisionAnalysis}:{}),...(measuredProgress?{measuredProgressByArea:measuredProgress}:{}),...(tradeChains?{tradeChains}:{}),...(earnedHours?{earnedHours}:{}),sourceLabels:projectSourceLabels(scoped)}};
}
