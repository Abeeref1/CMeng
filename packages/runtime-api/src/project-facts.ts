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
import {projectActionRegisterForState,peekCachedScheduleAnalytics} from './project-projections';
import {projectSourceLabels} from './project-presentation';
import {projectContractSections} from './project-contract-sections';
import {contractCompletionPosition} from './contract-completion';
import {canonicalTimeClaims} from './canonical-time-claims';
import {deliveryPosition} from './delivery-projections';
import {securityValidityReview} from './security-validity';
import {hasUnreconciledScheduleCalendar,buildForecastReconciliationGate} from './forecast-control';
import {scheduleCriticalityFacts} from './schedule-criticality-facts';

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
    submittedDaysAfterExtendedCompletion?:ProjectFact<number>;
    submittedDaysAfterCurrentContract?:ProjectFact<number>;
    independentDaysAfterCurrentContract?:ProjectFact<number>;
    amendmentEotStatements?:Array<{documentId:string;statement:string;sourceRefs:string[];basis:string}>;
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
    pipeline?:{rows?:Array<{claimId:string;state:string;claimedDays:number|null;assessedDays:number|null}>;recordCount:number;claimedDays:number|null;assessedDays:number|null;pendingCount:number;pendingAssessedDays:number|null;pendingScenarioCompletionIso:string|null;basis:string};
    eventDateMissingCount:ProjectFact<number>;
    noticeDateMissingCount:ProjectFact<number>;
    noticeRequirementMissingCount:ProjectFact<number>;
  };
  commercial:{
    securityValidity?:ReturnType<typeof securityValidityReview>;
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
  const valueState:ManagementValueState=value!==null?managementValueState(value):diagnostics.some(d=>/CONFLICT|DISAGREE/.test(d))?'records_disagree':diagnostics.some(d=>/WITHHELD|SUPPRESS|QUARANTIN|CPM.*FAIL|RECONCILIATION.*FAIL/.test(d))?'withheld':diagnostics.some(d=>/NOT_CALCUL|INVALID/.test(d))?'not_calculable':'not_in_source';
  return {value,valueState,state:value===null?'missing':state,complete:value===null?false:complete,basis,sourceRefs:[...new Set(sourceRefs)],diagnostics:[...new Set(diagnostics)]};
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
  // Facts are reporting facts. Cache them on the canonical read-only reporting
  // view so callers that start from persisted state and callers already working
  // on that view share one exact snapshot for the same project version.
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
  const reportedClaims=claimsReporting(scoped)?.reported;
  const pendingClaims=reportedClaims?.rows.filter(row=>['under_review','submitted'].includes(row.state))??[];
  const pendingAssessedDays=pendingClaims.length&&pendingClaims.every(row=>row.assessedDays!==null)?pendingClaims.reduce((sum,row)=>sum+row.assessedDays!,0):null;
  const extendedCompletion=commercial.timeExposure.officialAdjustedCompletion.value;
  const officialAward=commercial.timeExposure.approvedEotDays.value;
  const contractTime=canonicalTimeClaims(scoped).contractTimeBasis;
  // An adjustment identical to the original completion is not an extension.
  // Some source amendments echo the original date while a separate dated EOT
  // award exists. Retain both facts and present the calendared comparison
  // without claiming that amendment/EOT overlap has been legally reconciled.
  const baseCompletion=commercial.timeExposure.contractualCompletion.value;
  const adjustmentUnapplied=(extendedCompletion===null||(
    baseCompletion!==null&&extendedCompletion.slice(0,10)===baseCompletion.slice(0,10)));
  const dateRepeatedDespiteAward=baseCompletion!==null&&extendedCompletion!==null&&
    baseCompletion.slice(0,10)===extendedCompletion.slice(0,10);
  const overlapPending=adjustmentUnapplied&&officialAward!==null&&officialAward>0&&(
    dateRepeatedDespiteAward||contractTime?.overlapResolution!=='resolved'
  );
  const completionCandidates=overlapPending?contractCompletionPosition(scoped,dataDateIso).candidates:[];
  const originalDates=[...new Set(completionCandidates.filter(item=>item.role==='main'||item.role==='replacement').map(item=>item.date))];
  const amendedDates=[...new Set(completionCandidates.filter(item=>item.role==='amendment'&&
    item.effectiveFrom!==null&&dataDateIso!==null&&item.effectiveFrom<=dataDateIso).map(item=>item.date))];
  // This is a visible SOURCE-QUALIFIED comparison, never a second official
  // EOT award or a new governing contract date. No extra days are silently
  // added to an amendment, because that could double-count awarded EOT.
  const originalDate=originalDates.length===1?originalDates[0]!:originalDates.length===0?baseCompletion:null;
  const calendared=originalDate&&/^\d{4}-\d{2}-\d{2}$/.test(originalDate)
    ?Date.parse(originalDate+'T00:00:00Z'):NaN;
  const provisionalExtendedDate=overlapPending&&Number.isFinite(calendared)
    ?new Date(calendared+officialAward!*86400000).toISOString().slice(0,10)
    :null;
  const overlapSourceRefs=overlapPending?[...new Set([
    ...completionCandidates.map(item=>item.sourceRef),
    ...(contractTime?.sourceRefs??[]),
  ])]:[];
  const presentedExtension=provisionalExtendedDate!==null
    ?fact(provisionalExtendedDate,'Amendment overlap to confirm: original contract completion plus the source-reported awarded EOT, assuming calendar days unless the contract expressly adopts that day basis. The result is a qualified comparison, not a certified amendment or a basis for liquidated damages.','from_register_not_confirmed',false,overlapSourceRefs,['AMENDMENT_OVERLAP_TO_CONFIRM'])
    :commercialFact(commercial.timeExposure.officialAdjustedCompletion,
        commercial.timeExposure.officialAdjustedCompletion.diagnostics.includes('EOT_CALENDAR_DAY_BASIS_ASSUMED_CHECK_CONTRACT')
          ?'Contract completion plus awarded EOT, using assumed calendar days; confirm the applicable day definition.'
          :'Contract completion plus reconciled official awarded EOT.',true);
  // Never call a project late against the original date when an award exists
  // but the extended date cannot yet be calculated.
  const currentContractCompletion=extendedCompletion??(
    officialAward!==null&&officialAward>0?null:commercial.timeExposure.contractualCompletion.value);
  const forecastGate=model&&independentForecast?buildForecastReconciliationGate({
    model,forecast:independentForecast,
    requiredFinishIso:currentContractCompletion
  }):null;
  const independentFinish=forecastGate?.publishable===true&&!hasUnreconciledScheduleCalendar(independentForecast)
    ?independentForecast?.independentForecastCompletionIso??null:null;
  const calendarDifference=(finish:string|null|undefined,target:string|null)=>finish&&target?(Date.parse(finish.slice(0,10))-Date.parse(target.slice(0,10)))/86400000:null;

  const amendmentEotStatements=(scoped.contractDocuments??[])
    .filter(doc=>doc.role==='amendment')
    .filter(doc=>{
      const row=scoped.evidenceDocuments.find(record=>record.documentId===doc.documentId);
      return !row||['active','additive'].includes(row.basisState);
    }).map(doc=>{
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
      return {documentId:doc.documentId,
        statement:phrase?'Amendment states: "'+phrase.wording!.replace(/\s+/g,' ').trim()+'"':
          fragments.length
            ?'amendment text not found: no explicit EOT statement identified in the extracted wording; the determination-register award remains separate.'
            :'amendment text not found; the determination-register award remains separate.',
        sourceRefs,
        basis:phrase?'Quoted extracted source text; not an independent award determination':
          fragments.length?'Source does not explicitly state an EOT period':'Document extraction incomplete'};
    });
  const actionRegister=projectActionRegisterForState(state);
  const value:ProjectFactsSnapshot={
    schemaVersion:'1.0',
    projectId:state.projectId,
    projectVersion:state.version,
    dataDateIso,
    actions:{openCount:fact(actionRegister.actions.length,'Owner/register/state groups plus source-review decisions. Individual record actions are counted only inside groups.','calculated_with_stated_basis'),recordCount:fact(actionRegister.recordActionCount,'Distinct actionable source records.','calculated_with_stated_basis'),reviewCount:fact(actionRegister.reviewActionCount,'Source corrections and confirmation decisions.','calculated_with_stated_basis')},
    programmeQuality:pmcScheduleRules(model,scoped.schedules.filter(s=>s.role!=='scenario').map(s=>s.revision.model),commercial.timeExposure.officialAdjustedCompletion.value??commercial.timeExposure.contractualCompletion.value),
    contractSections:projectContractSections(scoped,commercial.timeExposure.contractualCompletion.value,commercial.timeExposure.officialAdjustedCompletion.value),
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
          ?'Unfinished execution activities classified critical by deterministic independent source-calendar CPM.'
             :'Unfinished execution activities classified critical from '+governedCriticality.floatLabel+'.',
      ),
      nearCriticalActivityCount:aggregateFact(
        canonicalNearCritical,
        authoritativeIndependent
          ?'Unfinished execution activities classified near-critical by deterministic independent source-calendar CPM using the shared threshold.'
             :'Unfinished execution activities classified near-critical from '+governedCriticality.floatLabel+'.',
      ),
      negativeFloatActivityCount:aggregateFact(
        canonicalNegativeFloat,
        authoritativeIndependent
          ?'Unfinished execution activities with deterministic independent CPM total float below zero.'
             :'Unfinished execution activities with '+governedCriticality.floatLabel+'.',
      ),
      submittedCriticalActivityCount:aggregateFact(submittedCritical,'Submitted/source total-float critical population retained for reconciliation.'),
      submittedNearCriticalActivityCount:aggregateFact(submittedNearCritical,'Submitted/source total-float near-critical population retained for reconciliation.'),
      submittedNegativeFloatActivityCount:aggregateFact(submittedNegativeFloat,'Submitted/source negative-float population retained for reconciliation.'),
      independentCriticalActivityCount:aggregateFact(independentCritical,'Independent CPM critical population; unavailable until the independent calculation covers the open execution population.'),
      independentNearCriticalActivityCount:aggregateFact(independentNearCritical,'Independent CPM near-critical population; unavailable until the independent calculation covers the open execution population.'),
      independentNegativeFloatActivityCount:aggregateFact(independentNegativeFloat,'Independent CPM negative-float population; unavailable until the independent calculation covers the open execution population.'),
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
      submittedDaysAfterCurrentContract:fact(calendarDifference(submittedFinish?.dateIso,currentContractCompletion),'Submitted finish less contract completion including known awarded EOT, using calendar dates.','calculated_with_stated_basis'),
      independentDaysAfterCurrentContract:fact(calendarDifference(independentFinish,currentContractCompletion),'Calendar recalculation finish less contract completion including known awarded EOT, using calendar dates.','calculated_with_stated_basis'),
      submittedDaysAfterExtendedCompletion:fact(submittedFinish?.dateIso&&extendedCompletion?(Date.parse(submittedFinish.dateIso.slice(0,10))-Date.parse(extendedCompletion.slice(0,10)))/86400000:null,'Submitted finish less contract completion including awarded EOT, in calendar days.','calculated_with_stated_basis'),
      contractualCompletionIso:commercialFact(
        commercial.timeExposure.contractualCompletion,
        'Canonical contract-time position used by every consumer.',
      ),
      awardedEotDays:commercialFact(
        commercial.timeExposure.approvedEotDays,
        'Official awarded EOT through the project Data Date.',
      ),
      extendedContractCompletionIso:presentedExtension,
    },
    controls:{
      expiredPermitCount:aggregateFact(aggregateCount(permitRows.length?permitRows:null,row=>['not_established','validity_not_established'].includes(row.permitStatus)||row.permitStatus==='expired'&&row.affectsOpenWork===null?null:row.permitStatus==='expired'&&row.affectsOpenWork===true),'Supplied permits whose validity ends before the project Data Date; valid-from and valid-to fields are used without inventing an issue date.'),
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
      openNcrCount:sourceCount(
        operations.counts.openNcrCount,
        operations.knownCounts.openNcrCount,
        operations.quality.complete,
        'Current NCR register open records through the project Data Date, all severities.',
      ),
      overdueNcrCount:sourceCount(
        operations.counts.overdueNcrCount,
        operations.knownCounts.overdueNcrCount,
        operations.quality.complete,
        'Open NCRs whose required closure date precedes the project Data Date.',
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
      ...(reportedClaims?{pipeline:{rows:reportedClaims.rows.map(row=>({claimId:row.claimId,state:row.sourceStatus||row.state,claimedDays:row.claimedDays,assessedDays:row.assessedDays})),recordCount:reportedClaims.recordCount,claimedDays:reportedClaims.claimedDays.value,assessedDays:reportedClaims.assessedDays.value,
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
      securityValidity:securityValidityReview(scoped,commercial.sourceLedger?.bonds??[],submittedFinish?.dateIso??null),
      currencies:commercial.currencies.map(row=>({
        currency:row.currency,
        forecastEac:(()=>{const positions=commercial.costBasisReview?.filter(p=>p.currency===row.currency)??[];return fact(positions.length===1?positions[0]!.sourceEac:null,'Latest EAC in the cost register, with currency and tax basis retained.','from_register_not_confirmed',positions.length===1);})(),
        cpi:(()=>{const positions=commercial.costBasisReview?.filter(p=>p.currency===row.currency)??[];return fact(positions.length===1?positions[0]!.cpi:null,'EV / AC from the same currency, tax basis and reporting period.','calculated_with_stated_basis',positions.length===1);})(),
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
  const bound=bindProjectFacts(result.key,data,projectFactsForState(state));
  if(bound.projectDiagnosis&&typeof bound.projectDiagnosis==='object'){
    const register=projectActionRegisterForState(state);
    bound.projectDiagnosis={...bound.projectDiagnosis,actionRegister:{total:register.actions.length,actions:register.actions.slice(0,5)}};
  }
  const currentModel=projectControlSchedule(state)?.revision.model;
  const successors=new Set((currentModel?.relationships??[]).filter(r=>!r.external).map(r=>r.predecessorActivityId));
  const submitted=(bound.projectFacts as any)?.schedule?.submittedProgrammeCompletionIso?.value;
  const finishes=(currentModel?.activities??[]).flatMap(a=>[a.currentFinishIso,a.forecastFinishIso].filter((d):d is string=>!!d)).sort();
  const finish=(submitted??finishes.at(-1))?.slice(0,10)??null;
  const terminalMilestones=(currentModel?.activities??[]).filter(a=>
    (['milestone','finish_milestone','start_milestone'].includes(a.activityType)&&/completion|complete.*works|handover|taking.over/i.test(a.name??''))||
    (!successors.has(a.activityId)&&[a.currentFinishIso,a.forecastFinishIso,...(a.sourceConstraints??[]).map(c=>c.dateIso)].some(d=>!!d&&!!finish&&d.slice(0,10)===finish)));
  const completionMilestoneConstraints=terminalMilestones.flatMap(a=>(a.sourceConstraints??[]).map(c=>({activityReference:a.activityId,activityName:a.name,type:c.type,dateIso:c.dateIso??null,basis:'Constraint retained from the submitted completion activity; not a contract amendment'})));
  const commercial= result.key==='pmo-analysis'?commercialPositionForState(state):null;
  const currencyFacts=(bound.projectFacts as any)?.commercial?.currencies??[];
  const briefCommercialPosition=commercial?{currencies:[
    ...(commercial.performance?.costControl?.positions??[]).map(p=>{const source=(commercial.costBasisReview??[]).find(r=>r.currency===p.currency&&r.taxBasis===p.taxBasis);const base=currencyFacts.find((r:any)=>r.currency===p.currency)??{currency:p.currency};return {...base,taxBasis:p.taxBasis,asOf:(p as any).asOf??source?.asOf??null,
      forecastEac:p.sourceEac?.value!==null&&p.sourceEac?.value!==undefined?p.sourceEac:source?.sourceEac!==null&&source?.sourceEac!==undefined?fact(source.sourceEac,'Reported EAC from the same cost source and tax basis','from_register_not_confirmed'):base.forecastEac,
      cpi:p.cpi?.value!==null&&p.cpi?.value!==undefined?p.cpi:source?.cpi!==null&&source?.cpi!==undefined?fact(source.cpi,'EV / AC from the same cost source and tax basis','calculated_with_stated_basis'):base.cpi};}),
    ...currencyFacts.filter((r:any)=>!(commercial.performance?.costControl?.positions??[]).some(p=>p.currency===r.currency))]}:undefined;
  const relevant=['quantity-scurve','quantity-progress','pmo-analysis','schedule-analytics','material-tracking','challenge-contract','delivery-control'];
  const linked=currentModel&&relevant.includes(result.key)?boqProgrammeLinks(state,currentModel):undefined;
  return {...result,data:{...bound,completionMilestoneConstraints,...(briefCommercialPosition?{briefCommercialPosition}:{}),...(linked?{boqProgrammeLinks:linked}:{}),sourceLabels:projectSourceLabels(state)}};
}
