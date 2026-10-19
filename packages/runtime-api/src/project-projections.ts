import {projectScopeClassification} from './location-review';
import {attachSourceActivityCalendars} from './source-milestone-calendar-join';
import {sharedProjectPlanPositions} from './shared-plan-positions';
import {milestoneReviewForProjection} from './milestone-review';
import {sourceProgressEvidence} from './source-progress-evidence';
import {summarizeControlledBaselineCompletion} from './controlled-baseline-completion';
import {buildForecastReconciliationGate} from './forecast-control';
import {attachMilestonePopulation} from './milestone-population';
import {attachLookaheadResourceLinks} from './lookahead-resource-linkage';
import {cachedIndependentForecast,independentForecastCache} from './forecast-cache';
import {actionRecordKey,prioritizeActions,consolidateScheduleChains,pmcRoleOwner,groupActionsByOwnerRegister} from './action-priority';
import {completionPosition} from './completion-position';
import {activityFloatReconciliation,attachActivityFloatReconciliation,sourceCalendarWorkingDays} from './activity-float-reconciliation';
import {buildProjectDiagnosis,presentProjectDiagnosis} from './project-diagnosis';
import {buildModuleChallenge} from '../../module-challenge/src';
import {deliveryModule,deliveryDashboard,deliveryExportResult,isDeliveryPage,deliveryPosition} from './delivery-projections';
import {deliveryRecords,deliveryCurrentRecord} from './delivery-records';
import {interfaceModule,interfaceIntelligence} from './interface-intelligence';
import {accountabilityModule,crossDomainAccountability} from './accountability-intelligence';
import {projectActions,actionSourceCorrectionRecord,type ProjectAction} from './project-actions';
import {recoveryAccelerationModule} from './recovery-acceleration';
import {isAdoptedProgrammeRevision,isScenarioRevision,scheduleAuthorityReview} from './schedule-authority';
import {quantityMappingForState} from "./quantity-mapping-runtime";
import {nearCriticalScreening} from './near-critical-screening';
import {resolveModuleKey} from './registry';
import {registerDateReview} from './register-date-review';
import {deliveryFeasibilityForState} from './delivery-feasibility';
import {recoveryScenarioForState} from './recovery-scenario';
import {suppliedBoqFigures,resolveBoqSource} from './boq-source';
import {registerReadIssuesForModule} from './register-read-issues';
import {checkPageValues} from './page-value-checks';
import {sourceQualityPosition,withPositionVerdict} from './position-review';
import {scheduleBasisReview,durationEditReview} from './schedule-basis-review';
import {quantityBasisReview,contractValueBasisReview} from './source-basis-review';
import {sourceInterpretation} from "./source-interpretation";
import {scopeClassificationGroups} from "./schedule-scope-classification";
import {scheduleRiskMonteCarlo} from "./schedule-risk-monte-carlo";
import {earnedScheduleForState,evmByWbsForState,riskRegisterForState,contractRiskForState,finalAccountForState} from "./advanced-controls";
import {tenderReadinessForState} from './tender-readiness';
import {managementVisualControl} from './management-visual-control';
import {projectManagementContext} from './management-context';
import {moduleFeatureAvailability} from './feature-availability';
import {contractChallengeForState} from './contract-challenge-runtime';
import { enforceModuleReadiness } from "./module-readiness";
import {assessModuleIssues} from './module-issues';
import { documentClassificationForReview } from "./document-identification";
import { managementAction, reportingScope, summarizeControlIssues, type ControlIssue, type ManagementAction } from "../../truth-kernel/src";
import { attachReportingContract, reportingData, managementReportingData } from "./reporting-contract";
import {bindProjectFacts} from './project-fact-consumers';
import {projectSourceLabels} from './project-presentation';
import {attachProjectFacts,projectFactsForState,completedProjectFactsForState} from "./project-facts";
import { activityMovementAnalysis } from "../../activity-analytics/src/movement";
import { reportingState, claimsReporting, operationalReporting, boqSourceReporting } from "./reporting-state";
import {analyticalOperationalDocuments,SOURCE_ANALYTICAL_USE} from "./operational-reporting";
import { commercialFoundationForState, commercialFoundationCapabilityForState } from "./commercial-foundation-runtime";
import { commercialPerformanceCapabilityForState } from "./commercial-performance-runtime";
import { commercialContractControlCapabilityForState } from "./commercial-contract-controls-runtime";
import { parseScheduleTime,analyzeSchedule } from "../../schedule-analysis-core/src";
import { checkProjectionIntegrity } from "./projection-integrity";
import { resolveRevisionActivityCorrespondence, compareScheduleRevisions } from "../../schedule-revision-core/src";
import { activityPopulation, isExecutionActivity, numericDistribution } from "../../schedule-analysis-core/src";
import { finishVarianceBetween, firstSourceCalendars, workingDayVarianceSummary, type CanonicalScheduleModel } from "../../schedule-analysis-core/src";
/** Controlled-baseline finish variance in working days of each activity's own
 * source calendar (shared T06 helper). Unknown stays null. */
function controlledWorkingDayVariances(
  model: CanonicalScheduleModel,
  baselineFinishOf: (activity: CanonicalScheduleModel["activities"][number]) => string | null,
  currentFinishOf: (activity: CanonicalScheduleModel["activities"][number]) => string | null,
): Array<number | null> {
  const calendars = firstSourceCalendars(model.calendars);
  return model.activities.map((activity) => {
    const baselineIso = baselineFinishOf(activity), currentIso = currentFinishOf(activity);
    if (!baselineIso || !currentIso) return null;
    const before = parseScheduleTime(baselineIso), after = parseScheduleTime(currentIso);
    if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
    return finishVarianceBetween(before, after, activity.calendarId === null ? null : calendars.get(activity.calendarId)).workingDays;
  });
}
import {
  canonicalCommercialModule,
  commercialPositionForState,
} from "./commercial-runtime";
import { canonicalTimeClaims, projectControlSchedule } from "./canonical-time-claims";
import { contractCompletionPosition } from "./contract-completion";
import { buildDelayEotEvidenceChain } from "./delay-eot-evidence-chain";
import { projectScheduleControlBasis } from "./schedule-control-basis";
import { sourceProductivityForecastEvidence } from "./source-productivity-forecast";
import { forecastControlForState, hasUnreconciledScheduleCalendar } from "./forecast-control";
import { reviewScheduleCalendarBasis } from './schedule-calendar-review';
import { canonicalResourceModule } from "./canonical-resource-runtime";
import { createHash } from "node:crypto";
import {
  scheduleProgress,
} from "../../schedule-analysis-core/src";
import {
  buildActivityAnalyticsProjection, activityAnalyticsCounts, activityDelayStatus,
} from "../../activity-analytics/src";
import {
  buildChallengeContractProjection,
} from "../../challenge-contract/src";
import {
  extractContractLdTerms,
  extractContractValue,
} from "../../contract-commercial/src";
import {
  buildDelayClaimsProjection,
} from "../../delay-claims/src";
import {
  buildDeliveryChallengeProjection,
} from "../../delivery-challenge/src";
import {
  buildEotAssessmentProjection,
} from "../../eot-assessment/src";
import {
  buildForecastHistoryProjection,
  forecastSnapshotFromProjection as rawForecastSnapshot,
} from "../../forecast-history/src";
import {
  buildIndependentForecastProjection,
} from "../../independent-forecast/src";
import {
  buildLookAheadProjection,
} from "../../lookahead-schedule/src";
import type {ReadinessEvidence,ReadinessDimensionKey} from "../../lookahead-schedule/src";
import {
  buildManhourScurveProjection,
} from "../../manhour-scurve/src";
import {
  buildMilestonesProjection,
  refreshMilestoneManagementControl,
} from "../../milestones-analysis/src";
import {
  buildNearCriticalProjection,
} from "../../near-critical-analysis/src";
import {
  buildNoticesClaimsProjection,
  noticeComplianceAssessable,
} from "../../notices-claims/src";
import {
  buildPmoAnalysisProjection,
} from "../../pmo-analysis/src";
import {
  buildProgressBreakdownProjection,
} from "../../progress-breakdown/src";
import {
  buildProgressReportProjection,
} from "../../progress-report/src";
import {
  buildProgressScurveProjection,
} from "../../progress-scurve/src";
import {
  buildProjectDirectorPosition,
} from "../../project-director/src";
import {
  buildQuantityScurveProjection,
} from "../../quantity-scurve/src";
import {
  buildResourceUtilizationProjection,
} from "../../resource-utilization/src";
import {
  buildRevisionTrendProjection,
} from "../../revision-trend/src";
import {
  buildScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import {
  buildScheduleChangeReportProjection,
} from "../../schedule-change-report/src";
import {
  buildVarianceTrendsProjection,
} from "../../variance-trends/src";
import {
  buildWindowsAnalysisProjection,
} from "../../windows-analysis/src";
import {
  buildBoardReadyReport,
} from "../../board-report/src";
import type {
  ProjectRuntimeState,
  ModuleRuntimeResult,
  ProjectRuntimeOverview,
  EvidenceBasisEffect,
  EvidenceRerunReceipt,
} from "./project-state-types";
import {
  isProgrammeScheduleRevision,
  runtimeProjects,
} from "./project-state";
import {
  moduleRegistry,
  commercialModules,
  scheduleModules,
} from "./registry";

/** One source-to-programme readiness rule shared by every look-ahead consumer.
 * Only current, linked, late procurement records can block unfinished driving
 * work. No source record or pre-existing readiness evidence is removed. */
export function lookAheadReadinessWithProcurement(state:ProjectRuntimeState,drivingIds:readonly string[]){
  const retained=state.controls.readinessEvidence;
  if(drivingIds.length===0)return retained;
  // Do not build the complete Delivery/BOQ/readiness projections when there
  // is no sourced procurement package to connect to the programme. This
  // does not suppress an existing readiness blocker or a single source row.
  const driving=new Set(drivingIds);
  // The shared Delivery authority itself excludes stale, superseded,
  // conflicted and inactive source rows. They must remain retained and visible
  // for review, but cannot justify a current driving readiness blocker.
  // Check the same current-record population before invoking the expensive
  // full Delivery/BOQ/workfront calculation: matching *only historical*
  // package links cannot alter this project's governed Look-Ahead result.
  const records=deliveryRecords(state).records;
  if(!records.some(record=>record.kind==='package'&&deliveryCurrentRecord(record)&&
    record.links.activityIds.some(id=>driving.has(id))))return retained;
  const overrides:Record<string,Partial<Record<ReadinessDimensionKey,ReadinessEvidence>>>={};
  for(const pkg of deliveryPosition(state).packageRows){
    if(!pkg.drivingBlockerScenario||pkg.deliveredAtDataDate||pkg.deliveredStatusOnly)continue;
    const sourceRefs=pkg.receipts.map(r=>'evidence-document:'+r.documentId+':'+r.locator);
    if(!sourceRefs.length)sourceRefs.push('delivery-record:'+pkg.recordId);
    const basis=pkg.overdueUndelivered
      ?'Required-on-site date has passed without dated delivery evidence.'
      :'Forecast delivery is after the controlled programme need date; forecast readiness scenario, not actual contractual delay.';
    for(const activityId of pkg.activityIds){
      if(!driving.has(activityId))continue;
      const previous=overrides[activityId]?.procurement_material??retained[activityId]?.procurement_material;
      const note=[previous?.note,basis,
        'Linked driving activity '+activityId+', procurement package '+(pkg.reference||pkg.recordId)+
        ', required '+(pkg.needDate||'date not established')+'. Confirm supplier recovery and owner.']
        .filter(Boolean).join(' ');
      const record={recordId:pkg.recordId,documentType:'procurement package',
        state:'blocked' as const,dueIso:pkg.needDate,owner:pkg.owner??null,
        note:basis,sourceRefs};
      overrides[activityId]={...retained[activityId],...overrides[activityId],
        procurement_material:{state:'blocked',sourceRefs:[...new Set([...(previous?.sourceRefs??[]),...sourceRefs])],
          note,records:[...(previous?.records??[]).filter(r=>r.recordId!==pkg.recordId),record],
          diagnostics:[...new Set([...(previous?.diagnostics??[]),'SOURCE_LINKED_DRIVING_PROCUREMENT_BLOCKER'])] }};
    }
  }
  return Object.keys(overrides).length?{...retained,...overrides}:retained;
}

const certifiedScheduleModules = scheduleModules.filter(module => !module.onDemand);
const certifiedCommercialModules = commercialModules.filter(module => !module.onDemand);
const certifiedAnalyticalModules = [...certifiedScheduleModules, ...certifiedCommercialModules];
import {
  applyUniversalModuleChallenges,
} from "./module-challenges";
import type {
  DelayClaimsModel,
} from "../../delay-analysis-core/src";
import {
  certifyCrossModuleConsistency,
  consistencyForModule,
} from "./certification";
import {
  weeklyResourceCapacityEvidence,
} from "./resource-support-evidence";
import {
  resolveProjectControlNumberMetric,
} from "./project-control-source-metrics";
import {
  buildManagementSurfaces,
  type ManagementEvidenceGapInput,
  type ManagementHistoryInput,
  type ManagementModuleInput,
  type ManagementSurfacesProjection,
} from "../../management-surfaces/src";

function claimsQuarantined(model:DelayClaimsModel|null|undefined):boolean {
  return model?.integrity?.state==="quarantined";
}
function claimsIntegrity(model:DelayClaimsModel|null|undefined) {
  return model?.integrity??null;
}

interface ProjectionBundle {
  revisionComparisons?: Parameters<typeof buildWindowsAnalysisProjection>[2]['precomputedComparisons'];
  version: number;
  generatedAt: string;
  modules: Map<
    string,
    ModuleRuntimeResult
  >;
  director: ReturnType<
    typeof buildProjectDirectorPosition
  > | null;
  boardReport: ReturnType<
    typeof buildBoardReadyReport
  > | null;
}

const bundleCache =
  new Map<
    string,
    ProjectionBundle
  >();
/** Read a completed identical-version schedule analysis. This never starts a
 * calculation or changes authority, and is safe to use when building shared
 * facts after the specialist bundle has already been calculated. */
export function peekCachedScheduleAnalytics(state:ProjectRuntimeState):
  ReturnType<typeof buildScheduleAnalyticsProjection>|null {
  const bundle=bundleCache.get(state.projectId);
  if(bundle?.version!==state.version)return null;
  const existing=bundle.modules.get('schedule-analytics')?.data as ReturnType<typeof buildScheduleAnalyticsProjection>|undefined;
  return existing?.result?existing:null;
}


function blocked(
  key: string,
  reason: string,
  dependencies: string[],
): ModuleRuntimeResult {
  return {
    key,
    status: "blocked",
    engineState: "blocked",
    evidenceState: "missing",
    professionalState:
      "not_defensible",
    reason,
    dependencies,
    data: null,
  };
}

function available(
  key: string,
  data: unknown,
  dependencies: string[] = [],
  status:
    | "ready"
    | "partial" = "ready",
  reason: string | null = null,
): ModuleRuntimeResult {
  return {
    key,
    status,
    engineState: "ready",
    evidenceState:
      status === "ready"
        ? "established"
        : "partial",
    professionalState:
      status === "ready"
        ? "defensible"
        : "review_required",
    reason,
    dependencies,
    data,
  };
}

function revisionRolePriority(
  role:
    ProjectRuntimeState["schedules"][number]["role"],
): number {
  if (role === "baseline") return 0;
  if (role === "revised_baseline") return 1;
  if (role === "update") return 2;
  if (role === "other") return 3;
  return 4;
}

function revisionChronology(
  a: ProjectRuntimeState["schedules"][number],
  b: ProjectRuntimeState["schedules"][number],
): number {
  const ad =
    a.revision.model.dataDateIso ??
    a.revision.effectiveAt ??
    "";
  const bd =
    b.revision.model.dataDateIso ??
    b.revision.effectiveAt ??
    "";

  if (ad && bd) {
    const byDate =
      ad.localeCompare(bd);
    if (byDate !== 0) {
      return byDate;
    }
  } else if (ad) {
    return -1;
  } else if (bd) {
    return 1;
  }

  const byRole =
    revisionRolePriority(a.role) -
    revisionRolePriority(b.role);
  return byRole !== 0
    ? byRole
    : a.revision.sequence -
        b.revision.sequence;
}

function analyticalHistory(
  state: ProjectRuntimeState,
): ProjectRuntimeState["schedules"] {
  const cutoff=projectControlSchedule(state)?.revision.model.dataDateIso??null;
  const programmeSchedules = state.schedules.filter(isProgrammeScheduleRevision).filter(item=>isAdoptedProgrammeRevision(state,item)).filter(item=>reportingScope(item.revision.model.dataDateIso??item.revision.effectiveAt,cutoff)==='as_of');
  const official =
    programmeSchedules.filter(
      (item) =>
        item.role === "baseline" ||
        item.role === "update" ||
        item.role ===
          "revised_baseline",
    );
  const nonRecovery =
    programmeSchedules.filter(
      (item) =>
        !isScenarioRevision(item),
    );
  return [
    ...(official.length > 0
      ? official
      : nonRecovery.length > 0
        ? nonRecovery
        : programmeSchedules),
  ].sort(revisionChronology);
}

function applyGovernedWindowMovementMetrics(
  state: ProjectRuntimeState,
  projection: ReturnType<typeof buildWindowsAnalysisProjection>,
): ReturnType<typeof buildWindowsAnalysisProjection> {
  const positive =
    resolveProjectControlNumberMetric(
      state,
      "gross_positive_programme_movement",
    );
  const negative =
    resolveProjectControlNumberMetric(
      state,
      "gross_negative_programme_movement",
    );

  const diagnostics = [
    ...projection.diagnostics,
    ...positive.diagnostics,
    ...negative.diagnostics,
  ];

  const sourcePositive =
    positive.value !== null &&
    !["missing", "conflicted"].includes(
      positive.state,
    )
      ? positive.value
      : null;
  const sourceNegative =
    negative.value !== null &&
    !["missing", "conflicted"].includes(
      negative.state,
    )
      ? (
          negative.value > 0
            ? -negative.value
            : negative.value
        )
      : null;

  const calculatedPositive =
    projection.grossAnalyticalMovementDays;
  const calculatedNegative =
    projection.analyticalRecoveryMovementDays;
  const analyticalAvailable =
    projection.analyticalMovementAvailableWindowCount > 0;

  const positiveGap =
    sourcePositive === null || calculatedPositive === null ||
    !analyticalAvailable
      ? null
      : Number(
          (
            calculatedPositive -
            sourcePositive
          ).toFixed(6),
        );
  const negativeGap =
    sourceNegative === null || calculatedNegative === null ||
    !analyticalAvailable
      ? null
      : Number(
          (
            calculatedNegative -
            sourceNegative
          ).toFixed(6),
        );

  const sourceRefs = [
    ...new Set([
      ...positive.sourceRefs,
      ...negative.sourceRefs,
    ]),
  ];

  const stateValue:
    ReturnType<
      typeof buildWindowsAnalysisProjection
    >["sourceMovementReconciliation"]["state"] =
    sourcePositive === null &&
    sourceNegative === null
      ? "source_not_reported"
      : !analyticalAvailable
        ? "calculation_unavailable"
        : (
            (positiveGap === null ||
              Math.abs(positiveGap) <= 0.02) &&
            (negativeGap === null ||
              Math.abs(negativeGap) <= 0.02)
          )
          ? "reconciled"
          : "different";

  if (sourcePositive !== null) {
    diagnostics.push(
      "SOURCE_GROSS_POSITIVE_PROGRAMME_MOVEMENT_RECONCILED_NOT_APPLIED",
    );
  }
  if (sourceNegative !== null) {
    diagnostics.push(
      "SOURCE_GROSS_NEGATIVE_PROGRAMME_MOVEMENT_RECONCILED_NOT_APPLIED",
    );
  }

  return {
    ...projection,
    sourceReportedGrossPositiveMovementDays:
      sourcePositive,
    sourceReportedGrossNegativeMovementDays:
      sourceNegative,
    sourceMovementReconciliation: {
      state: stateValue,
      positiveGapDays:
        positiveGap,
      negativeGapDays:
        negativeGap,
      sourceRefs,
    },
    diagnostics:
      [...new Set(diagnostics)],
  };
}

function actualHistory(
  state: ProjectRuntimeState,
) {
  return analyticalHistory(
    state,
  )
    .map((stored) => {
      const model =
        stored.revision.model;
      const progress = scheduleProgress(model.activities).value;
      const asOfIso =
        model.dataDateIso ??
        stored.revision.effectiveAt;

      if (
        progress === null ||
        asOfIso === null
      ) {
        return null;
      }

      return {
        asOfIso,
        progressPercent: progress,
        sourceRevisionId:
          stored.revision
            .revisionId,
        sourceRefs: [
          "schedule-revision:" +
            stored.revision
              .revisionId,
        ],
      };
    })
    .filter(
      (
        item,
      ): item is NonNullable<
        typeof item
      > => item !== null,
    );
}

function previousComparableFloatBasis(
  ordered: ReturnType<typeof analyticalHistory>,
  current: NonNullable<ReturnType<typeof projectControlSchedule>>,
) {
  const previous = ordered
    .filter(
      (item) =>
        !isScenarioRevision(item) &&
        item.revision.revisionId !== current.revision.revisionId &&
        item.revision.sequence < current.revision.sequence,
    )
    .at(-1) ?? null;
  if (!previous) return null;
  const sourceById = new Map(
    previous.revision.model.activities.map(
      (activity) => [
        activity.activityId,
        activity,
      ],
    ),
  );
  const correspondence =
    resolveRevisionActivityCorrespondence(
      previous.revision.model.activities,
      current.revision.model.activities,
    );
  const totalFloatByActivity =
    new Map<string, number | null>();
  // T06: the previous float converts with the previous revision's own
  // calendar for that activity; unknown stays null (never an 8-hour day).
  const previousCalendars = sourceCalendarWorkingDays(previous.revision.model);
  const workingDayHoursByActivity =
    new Map<string, number | null>();
  for (const match of correspondence.matches) {
    const from = sourceById.get(match.fromActivityId);
    totalFloatByActivity.set(
      match.toActivityId,
      from
        ?.totalFloatHours ?? null,
    );
    workingDayHoursByActivity.set(match.toActivityId,
      from ? previousCalendars.workingDayHours(from.calendarId) : null);
  }
  return {
    revisionId:
      previous.revision.revisionId,
    totalFloatByActivity,
    workingDayHoursByActivity,
  };
}

/** A reporting calculation is identified by its retained source revision, not
 * the time at which an evicted worker happens to rebuild it. Audit events give
 * the actual mutation timestamp; the latest stored upload is a legacy fallback.
 * This never changes engineering figures, contract dates or approval state. */
function calculationSnapshotTime(state:ProjectRuntimeState):string {
  const audited=state.auditHistory?.slice().reverse().find(event=>event.projectVersion===state.version)?.occurredAt;
  if(audited)return audited;
  if(state.lastRerunReceipt?.projectVersion===state.version)return state.lastRerunReceipt.generatedAt;
  const sourceTimes=[
    ...state.schedules.map(row=>row.uploadedAt),
    ...state.evidenceDocuments.map(row=>row.uploadedAt),
  ].filter((value):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value)));
  return sourceTimes.sort().at(-1)??new Date().toISOString();
}

// One full calculation per project version. The Dashboard, Accountability,
// every specialist page, the shared facts and the action register all read
// this same bundle; no caller receives a reduced or deferred variant.
function buildBundle(
  state: ProjectRuntimeState,
): ProjectionBundle {
  state = reportingState(state);
  const cached =
    bundleCache.get(
      state.projectId,
    );
  if (
    cached &&
    cached.version ===
      state.version
  ) {
    return cached;
  }

  const bundleProfile=process.env.CMENG_PROFILE_PERF?.trim()==='1';
  const bundleTimings:Array<{part:string;ms:number}>=[];
  let bundleMark=bundleProfile?performance.now():0;
  const measureBundle=(part:string)=>{
    if(!bundleProfile)return;
    const now=performance.now();
    bundleTimings.push({part,ms:now-bundleMark});
    bundleMark=now;
  };
  const generatedAt =
    calculationSnapshotTime(state);
  const modules =
    new Map<
      string,
      ModuleRuntimeResult
    >();

  for (const module of certifiedScheduleModules) {
    modules.set(
      module.key,
      blocked(
        module.key,
        "No schedule evidence has been uploaded.",
        ["schedule"],
      ),
    );
  }

  const ordered =
    analyticalHistory(state);
  const current =
    projectControlSchedule(state);

  let director:
    ProjectionBundle["director"] =
    null;
  let boardReport:
    ProjectionBundle["boardReport"] =
    null;

  if (!current) {
    const bundle = {
      version: state.version,
      generatedAt,
      modules,
      director,
      boardReport,
    };
    bundleCache.set(
      state.projectId,
      bundle,
    );
    return bundle;
  }

  const model =
    current.revision.model;
  const scheduleControlBasis =
    projectScheduleControlBasis(state);
  const scheduleAnalysisConfig =
    scheduleControlBasis.analysisConfig;
  const controlledBaseline =
    ordered
      .filter(
        (item) =>
          item.role ===
            "revised_baseline" ||
          item.role ===
            "baseline",
      )
      .at(-1) ??
    null;
  const previousFloat =
    previousComparableFloatBasis(
      ordered,
      current,
    );
  const baselineSourceById = new Map((controlledBaseline?.revision.model.activities ?? []).map(activity => [activity.activityId, activity]));
  const baselineCorrespondence = resolveRevisionActivityCorrespondence(controlledBaseline?.revision.model.activities ?? [], model.activities);
  const baselineByActivity = new Map(baselineCorrespondence.matches.map(match => [match.toActivityId, baselineSourceById.get(match.fromActivityId)!]));
  const currentByActivity =
    new Map(
      model.activities.map(
        (activity) => [
          activity.activityId,
          activity,
        ],
      ),
    );
  const controlledBaselineFinish =
    (
      activity:
        ProjectRuntimeState["schedules"][number]["revision"]["model"]["activities"][number],
    ): string | null =>
      activity.baselineFinishIso ?? activity.currentFinishIso;
  const currentEffectiveFinish =
    (
      activity:
        ProjectRuntimeState["schedules"][number]["revision"]["model"]["activities"][number],
    ): string | null =>
      (
        activity.status ===
          "completed"
          ? activity.actualFinishIso
          : null
      ) ??
      activity.forecastFinishIso ??
      activity.currentFinishIso;
  const {completion:controlledBaselineCompletion,validCount:controlledBaselineValidCount} =
    summarizeControlledBaselineCompletion(
      controlledBaseline?.revision.model.activities ?? [],
    );
  // The same dated source finishes recur across large controlled-baseline
  // populations. Cache only within this exact project/revision calculation:
  // a missing or invalid calendar date must never become a numerical zero.
  const varianceSourceInstants = new Map<string, number | null>();
  const varianceInstant = (iso: string): number | null => {
    if (varianceSourceInstants.has(iso)) return varianceSourceInstants.get(iso)!;
    const parsed = parseScheduleTime(iso);
    const result = Number.isFinite(parsed) ? parsed : null;
    varianceSourceInstants.set(iso, result);
    return result;
  };
  const varianceDays = (
    baselineIso: string | null,
    currentIso: string | null,
  ): number | null => {
    if (
      !baselineIso ||
      !currentIso
    ) {
      return null;
    }
    const before = varianceInstant(baselineIso);
    const after = varianceInstant(currentIso);
    if (
      before === null ||
      after === null
    ) {
      return null;
    }
    return Number(
      (
        (
          after -
          before
        ) /
        86_400_000
      ).toFixed(6),
    );
  };
  const versions = {
    schedule:
      "uat-schedule-v1",
    activity:
      "uat-activity-v1",
    resource:
      "uat-resource-v1",
    lookAhead:
      "uat-lookahead-v1",
    progress:
      "uat-progress-v1",
    change:
      "uat-change-v1",
    revision:
      "uat-revision-v1",
    variance:
      "uat-variance-v1",
    scurve:
      "uat-scurve-v1",
    quantity:
      "uat-quantity-v1",
    breakdown:
      "uat-breakdown-v1",
    milestones:
      "uat-milestones-v1",
    nearCritical:
      "uat-near-critical-v1",
    manhours:
      "uat-manhours-v1",
    history:
      "uat-forecast-history-v1",
    forecast:
      "uat-forecast-v1",
    windows:
      "uat-windows-v1",
    delay:
      "uat-delay-v1",
    notices:
      "uat-notices-v1",
    eot:
      "uat-eot-v1",
    challenge:
      "uat-challenge-v1",
    pmo:
      "uat-pmo-v1",
  };

  measureBundle('reporting_and_baseline_basis');
  const scheduleAnalyticsRaw =
    buildScheduleAnalyticsProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.schedule,
        config: scheduleAnalysisConfig,
      },
    );

  const controlledVariances =
    controlledBaseline
      ? model.activities.map(
          (activity) => {
            const baseline =
              baselineByActivity.get(
                activity.activityId,
              );
            return varianceDays(
              baseline
                ? controlledBaselineFinish(
                    baseline,
                  )
                : null,
              currentEffectiveFinish(
                activity,
              ),
            );
          },
        )
      : [];

  const knownControlledVariances =
    controlledVariances.filter(
      (
        value,
      ): value is number =>
        value !== null,
    );

  const scheduleAnalytics =
    controlledBaseline
      ? {
          ...scheduleAnalyticsRaw,
          controlledBaselineRevisionId:
            controlledBaseline
              .revision.revisionId,
          result: {
            ...scheduleAnalyticsRaw
              .result,
            completionBases:
              scheduleAnalyticsRaw
                .result
                .completionBases.map(
                  (basis) =>
                    basis.basis ===
                      "programme"
                      ? {
                          ...basis,
                          dateIso:
                            controlledBaselineCompletion
                              ?.dateIso ??
                            null,
                          activityId:
                            controlledBaselineCompletion
                              ?.activityId ??
                            null,
                          state:
                            controlledBaselineValidCount ===
                            0
                              ? "missing" as const
                              : controlledBaselineValidCount ===
                                  controlledBaseline
                                    .revision.model
                                    .activities
                                    .length
                                ? "available" as const
                                : "partial" as const,
                          coveragePercent:
                            controlledBaseline
                              .revision.model
                              .activities
                              .length
                              ? Number(
                                  (
                                    (
                                      controlledBaselineValidCount /
                                      controlledBaseline
                                        .revision.model
                                        .activities
                                        .length
                                    ) *
                                    100
                                  ).toFixed(4),
                                )
                              : null,
                          method:
                            "controlled baseline programme completion",
                          sourceRefs: [
                            "schedule-revision:" +
                              controlledBaseline
                                .revision
                                .revisionId,
                          ],
                        }
                      : basis,
                ),
            finishVariance: {
              distribution: numericDistribution(knownControlledVariances),
              ...scheduleAnalyticsRaw
                .result
                .finishVariance,
              populationBasis: "source_records" as const,
              denominator: model.activities.length,
              method:
                "controlled baseline programme versus current/forecast finish",
              // Working-day fields from the same controlled-baseline pairs, so
              // they never mix with the source-baseline values spread above.
              ...workingDayVarianceSummary(
                controlledBaseline
                  ? controlledWorkingDayVariances(
                      model,
                      (activity) => {
                        const baseline = baselineByActivity.get(activity.activityId);
                        return baseline ? controlledBaselineFinish(baseline) : null;
                      },
                      currentEffectiveFinish,
                    )
                  : [],
              ),
              comparableActivities:
                knownControlledVariances
                  .length,
              lateActivities:
                knownControlledVariances
                  .filter(
                    (value) =>
                      value > 0,
                  ).length,
              earlyActivities:
                knownControlledVariances
                  .filter(
                    (value) =>
                      value < 0,
                  ).length,
              onTimeActivities:
                knownControlledVariances
                  .filter(
                    (value) =>
                      value === 0,
                  ).length,
              unknownActivities:
                model.activities
                  .length -
                knownControlledVariances
                  .length,
              averageFinishVarianceDays:
                knownControlledVariances
                  .length
                  ? Number(
                      (
                        knownControlledVariances
                          .reduce(
                            (
                              sum,
                              value,
                            ) =>
                              sum +
                              value,
                            0,
                          ) /
                        knownControlledVariances
                          .length
                      ).toFixed(6),
                    )
                  : null,
              maximumDelayDays:
                knownControlledVariances
                  .length
                  ? Math.max(
                      ...knownControlledVariances,
                    )
                  : null,
              coveragePercent:
                model.activities
                  .length
                  ? Number(
                      (
                        (
                          knownControlledVariances
                            .length /
                          model.activities
                            .length
                        ) *
                        100
                      ).toFixed(4),
                    )
                  : null,
            },
          },
        }
      : scheduleAnalyticsRaw;

  modules.set(
    "schedule-analytics",
    available(
      "schedule-analytics",
      scheduleAnalytics,
    ),
  );

  measureBundle('schedule_analytics');
  const activityAnalyticsRaw =
    buildActivityAnalyticsProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.activity,
        config: scheduleAnalysisConfig,
      },
    );

  const activityAnalytics =
    controlledBaseline
      ? {
          ...activityAnalyticsRaw,
          controlledBaselineRevisionId:
            controlledBaseline
              .revision.revisionId,
          finishVarianceCoveragePercent:
            model.activities.length
              ? Number(
                  (
                    (
                      knownControlledVariances
                        .length /
                      model.activities
                        .length
                    ) *
                    100
                  ).toFixed(4),
                )
              : null,
          rows:
            activityAnalyticsRaw
              .rows.map(
                (row) => {
                  const baseline =
                    baselineByActivity.get(
                      row.activityId,
                    );
                  const baselineFinish =
                    baseline
                      ? controlledBaselineFinish(
                          baseline,
                        )
                      : null;
                  const currentActivity =
                    currentByActivity.get(
                      row.activityId,
                    );
                  return {
                    ...row,
                    baselineFinishIso:
                      baselineFinish,
                    finishVarianceDays:
                      varianceDays(
                        baselineFinish,
                        currentActivity
                          ? currentEffectiveFinish(
                              currentActivity,
                            )
                          : null,
                      ),
                  };
                },
              ),
        }
      : activityAnalyticsRaw;
  modules.set(
    "activity-analytics",
    available(
      "activity-analytics",
      activityAnalytics,
    ),
  );

  measureBundle('activity_analytics');
  const lookaheadStarted=bundleProfile?performance.now():0;
  const controllingForecast=cachedIndependentForecast(model,generatedAt);
  const drivingIds=controllingForecast.drivingNetwork?.activityIds??[];
  const cpmDone=bundleProfile?performance.now():0;
  const procurementReadiness=lookAheadReadinessWithProcurement(state,drivingIds);
  const procurementDone=bundleProfile?performance.now():0;
  const lookAhead=buildLookAheadProjection(model,{
    drivingActivityIds:controllingForecast.drivingNetwork?.activityIds,generatedAt,
    producerVersion:versions.lookAhead,readinessEvidence:procurementReadiness,
  });
  if(bundleProfile)process.stdout.write(JSON.stringify({
    event:'lookahead_cold_breakdown',projectId:state.projectId,
    cpmLookupMs:cpmDone-lookaheadStarted,
    procurementReadinessMs:procurementDone-cpmDone,
    lookaheadProjectionMs:performance.now()-procurementDone,
  })+'\n');
  modules.set(
    "lookahead-schedule",
    available(
      "lookahead-schedule",
      lookAhead,
    ),
  );

  measureBundle('lookahead_projection');
  let sourcePlanPositions:ReturnType<typeof sharedProjectPlanPositions>|undefined;
  const progressScurve =
    buildProgressScurveProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.scurve,
        actualHistory:
          actualHistory(state),
        baselineModel:
          controlledBaseline
            ?.revision.model ??
          null,
        onPlanPositions:positions=>{sourcePlanPositions=positions;},
      },
    );
  modules.set(
    "progress-scurve",
    available(
      "progress-scurve",
      progressScurve,
    ),
  );

  measureBundle('progress_scurve_projection');
  const milestonesRaw =
    buildMilestonesProjection(
      model,
      {
          review: milestoneReviewForProjection(state,model),
          config: scheduleAnalysisConfig,
        generatedAt,
        producerVersion:
          versions.milestones,
      },
    );
  const milestones =
    controlledBaseline
      ? {
          ...milestonesRaw,
          controlledBaselineRevisionId:
            controlledBaseline
              .revision.revisionId,
          rows:
            milestonesRaw.rows.map(
              (row) => {
                const baseline =
                  baselineByActivity.get(
                    row.activityId,
                  );
                const baselineDate =
                  baseline
                    ? (
                        baseline
                          .baselineFinishIso ??
                        baseline
                          .baselineStartIso ??
                        baseline
                          .forecastFinishIso ??
                        baseline
                          .currentFinishIso
                      )
                    : null;
                const movementDate =
                  row.status === "completed"
                    ? row.actualDateIso ?? row.currentDateIso
                    : row.forecastDateIso ?? row.currentDateIso;
                return refreshMilestoneManagementControl({
                  ...row,
                  baselineDateIso:
                    baselineDate,
                  movementBasis:
                    baselineDate === null || movementDate === null
                      ? "not_established"
                      : row.status === "completed" && row.actualDateIso
                        ? "actual_vs_baseline"
                        : row.forecastDateIso
                          ? "forecast_vs_baseline"
                          : "current_vs_baseline",
                  varianceDays:
                    varianceDays(
                      baselineDate,
                      movementDate,
                    ),
                });
              },
            ),
        }
      : milestonesRaw;
  modules.set(
    "milestones",
    available(
      "milestones",
      milestones,
    ),
  );

  measureBundle('milestones_projection');
  const nearCriticalRaw =
    buildNearCriticalProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.nearCritical,
        config: scheduleAnalysisConfig,
        controlledBaseline: controlledBaseline ? { revisionId: controlledBaseline.revision.revisionId, finishByActivity: new Map([...baselineByActivity].map(([id,a]) => [id,controlledBaselineFinish(a)])) } : null,
        previousFloat,
      },
    );
  const nearCriticalBase = {
    ...nearCriticalRaw,
    sourceReportedNearCriticalLabelCount:
      scheduleControlBasis.sourceReportedNearCriticalLabelCount,
    sourceReportedLabel:
      scheduleControlBasis.sourceReportedNearCriticalLabelCount !== null
        ? "Near Critical"
        : null,
    reconciliation: {
      strictNearCriticalCount:
        nearCriticalRaw.nearCriticalCount,
      floatRiskWatchlistCount:
        nearCriticalRaw.floatRiskWatchlistCount,
      sourceReportedCount:
        scheduleControlBasis.sourceReportedNearCriticalLabelCount,
      sourceLabelReconcilesTo:
        scheduleControlBasis.sourceCountReconcilesTo,
      gap:
        scheduleControlBasis.sourceReportedNearCriticalLabelCount === null || nearCriticalRaw.floatRiskWatchlistCount === null
          ? null
          : nearCriticalRaw.floatRiskWatchlistCount -
            scheduleControlBasis.sourceReportedNearCriticalLabelCount,
      status:
        scheduleControlBasis.sourceReportedNearCriticalLabelCount === null
          ? "source_not_reported"
          : nearCriticalRaw.floatRiskWatchlistCount === null
            ? "unresolved"
            : nearCriticalRaw.floatRiskWatchlistCount ===
              scheduleControlBasis.sourceReportedNearCriticalLabelCount
            ? "reconciled"
            : "difference",
    },
    nearCriticalThresholdAuthority:

      scheduleControlBasis.nearCriticalThresholdMethod === "explicit_working_days" ||

      scheduleControlBasis.nearCriticalThresholdMethod === "explicit_hours"

        ? "project_source"

        : scheduleControlBasis.nearCriticalThresholdMethod === "cmeng_policy_default"

          ? "cmeng_screening_policy"

          : "unresolved",

    nearCriticalThresholdExplanation:

      scheduleControlBasis.nearCriticalThresholdMethod === "explicit_working_days" ||

      scheduleControlBasis.nearCriticalThresholdMethod === "explicit_hours"

        ? "The near-critical threshold is explicitly evidenced in the project control basis."

        : scheduleControlBasis.nearCriticalThresholdMethod === "cmeng_policy_default"

          ? "The project documents do not establish a near-critical threshold. CMeng applies its screening policy for analysis only; this is not a project-approved threshold."

          : "A near-critical threshold is not established, so CMeng does not present the screening rule as a project requirement.",

    definitions: {

      critical:

        "TF <= confirmed critical float threshold",

      nearCritical:

        scheduleControlBasis.nearCriticalThresholdMethod === "explicit_working_days" ||

        scheduleControlBasis.nearCriticalThresholdMethod === "explicit_hours"

          ? "confirmed project critical threshold < TF <= N activity-calendar working days"

          : "CMeng screening threshold applied to source total float; project threshold not established",

      floatRiskWatchlist:

        scheduleControlBasis.nearCriticalThresholdMethod === "explicit_working_days" ||

        scheduleControlBasis.nearCriticalThresholdMethod === "explicit_hours"

          ? scheduleAnalysisConfig.floatRiskWatchlistIncludesCriticalThreshold

            ? "confirmed project critical threshold <= TF <= N activity-calendar working days"

            : "confirmed project critical threshold < TF <= N activity-calendar working days"

          : "CMeng screening watchlist applied to source total float; project threshold not established",

    },
  };
  const nearCritical = nearCriticalBase;
  modules.set(
    "near-critical",
    available(
      "near-critical",
      nearCritical,
    ),
  );

  measureBundle('nearcritical_projection');
  const breakdownInput = {
    baselineModel: controlledBaseline?.revision.model ?? null,
    sharedPlanPositions: sharedProjectPlanPositions(state,model,controlledBaseline?.revision.model ?? null,sourcePlanPositions),
    previousModel: ordered.at(-2)?.revision.model ?? null,
    scopeClassification: projectScopeClassification(state,model),
    readinessEvidence: state.controls.readinessEvidence,
    config: scheduleAnalysisConfig,
    generatedAt,
    producerVersion: versions.breakdown,
  };
  const progressBreakdown=buildProgressBreakdownProjection(model,breakdownInput);
  modules.set("progress-breakdown",available("progress-breakdown",progressBreakdown));

  measureBundle('progress_breakdown_projection');
  const independentStageTimings:Array<{part:string;ms:number}>=[];
  let independentStageStarted=bundleProfile?performance.now():0;
  const markIndependent=(part:string)=>{if(bundleProfile){const now=performance.now();independentStageTimings.push({part,ms:now-independentStageStarted});independentStageStarted=now;}};
  const independentForecast = cachedIndependentForecast(model, generatedAt);
  markIndependent('current_cpm');
  const productivityForecast =
    sourceProductivityForecastEvidence(state);
  markIndependent('productivity_evidence');
  const forecastControl =
    forecastControlForState(
      state,
      model,
      independentForecast,
    );
  markIndependent('forecast_reconciliation_and_contract');
  const forecastTaxonomy =
    forecastControl.taxonomy;
  modules.set(
    "independent-forecast",
    available(
      "independent-forecast",
      {
        ...independentForecast,
        sourceProductivityForecastCompletionIso:
          productivityForecast.completionIso,
        sourceProductivityForecastState:
          productivityForecast.state,
        sourceProductivityForecastMethod:
          productivityForecast.method,
        sourceProductivityForecastDriverWorkPackageId:
          productivityForecast.driverWorkPackageId,
        sourceProductivityForecastWorkPackageCount:
          productivityForecast.workPackageCount,
        sourceProductivityForecastCalculatedWorkPackageCount:
          productivityForecast.calculatedWorkPackageCount,
        sourceProductivityForecastCoveragePercent:
          productivityForecast.calculationCoveragePercent,
        sourceProductivityForecastReconciliation:
          productivityForecast.reconciliation,
        sourceProductivityForecastEvidence:
          productivityForecast,
        forecastTaxonomy,
        forecastReconciliationGate:
          forecastControl.gate,
        managementForecastCompletionIso:
          forecastControl.gate
            .managementForecastCompletionIso,
        managementReviewState:
          forecastControl.gate.publishable
            ? "accepted_for_analysis"
            : "review_required",
        managementReviewReason:
          forecastControl.gate.publishable
            ? null
            : forecastControl.gate.reason,
      },
      [],
      forecastControl.gate.publishable
        ? "ready"
        : "partial",
      forecastControl.gate.publishable
        ? null
        : forecastControl.gate.reason,
    ),
  );

  modules.set(
    "schedule-analytics",
    available(
      "schedule-analytics",
      {
        ...scheduleAnalytics,
        criticalityBasis:
          "source_total_float",
        independentCpmState:
          independentForecast.complete
            ? "established"
            : "not_established",
        drivingPathState:
          independentForecast.complete
            ? "independent_cpm_available"
            : "not_established",
        interpretation:
          scheduleAnalytics.result
            .complete
            ? "Source float classifications are shown for programme review. Independent CPM/driving-path calculation is kept separate and is not asserted by this quick view."
            : "Source total-float classifications remain visible, but CMeng does not call them an independently established critical/driving path because CPM integrity is unresolved.",
      },
      [],
      independentForecast.complete
        ? "ready"
        : "partial",
      independentForecast.complete
        ? null
        : "Schedule metrics derived directly from the submitted programme remain available, but independent CPM/driving-path conclusions are withheld until integrity defects are resolved.",
    ),
  );

  modules.set(
    "near-critical",
    available(
      "near-critical",
      {
        ...nearCritical,
        classificationBasis:
          "source_total_float",
        independentCpmState:
          independentForecast.complete
            ? "established"
            : "not_established",
      },
      [],
      independentForecast.complete
        ? "ready"
        : "partial",
      independentForecast.complete
        ? null
        : "Near-critical rows are source-float classifications only; independent CPM criticality is not asserted while schedule integrity fails.",
    ),
  );

  modules.set(
    "activity-analytics",
    available(
      "activity-analytics",
      {
        ...activityAnalytics,
        floatClassificationBasis:
          "source_total_float",
        independentCpmState:
          independentForecast.complete
            ? "established"
            : "not_established",
      },
      [],
      independentForecast.complete
        ? "ready"
        : "partial",
      independentForecast.complete
        ? null
        : "Activity float/criticality fields are source schedule values. Independent CPM/path status is not established.",
    ),
  );

  const progressReport =
    buildProgressReportProjection({
      generatedAt,
      producerVersion:
        versions.progress,
      scheduleAnalytics,
      milestones,
      lookAhead,
      progressScurve,
      independentForecast,
      progressEvidence: sourceProgressEvidence(state),
    });
  modules.set(
    "progress-report",
    available(
      "progress-report",
      progressReport,
    ),
  );

  markIndependent('progress_report');
  // The current-revision analysis was already calculated for Schedule Analytics
  // using this exact model and configuration. Do not analyze it twice.
  const revisionAnalyses=new Map<typeof model,ReturnType<typeof analyzeSchedule>>([[model,scheduleAnalyticsRaw.result]]);
  const revisionComparisons=new Map<typeof current.revision,Map<typeof current.revision,ReturnType<typeof compareScheduleRevisions>>>();
  const revisionTrend =
    buildRevisionTrendProjection(
      ordered.map(
        (item) =>
          item.revision,
      ),
      {
        generatedAt,
        producerVersion:
          versions.revision,
        config: scheduleAnalysisConfig,
        precomputedAnalyses:revisionAnalyses,
        onRevisionAnalytics:(revisionModel,analysis)=>revisionAnalyses.set(revisionModel,analysis),
        onComparison:(from,to,comparison)=>{const comparisons=revisionComparisons.get(from)??new Map();comparisons.set(to,comparison);revisionComparisons.set(from,comparisons);},
      },
    );
  modules.set(
    "revision-trend",
    available(
      "revision-trend",
      revisionTrend,
      ["schedule revision history"],
      ordered.length >= 2
        ? "ready"
        : "partial",
      ordered.length >= 2
        ? null
        : "One revision is available. CMeng shows the established first trend point and identifies the missing comparison history.",
    ),
  );

  markIndependent('revision_trend');
  const varianceTrends =
    buildVarianceTrendsProjection(
      ordered.map(
        (item) =>
          item.revision,
      ),
      {
        generatedAt,
        producerVersion:
          versions.variance,
        config: scheduleAnalysisConfig,
        controlledBaselineRevision:
          controlledBaseline
            ?.revision ??
          null,
        precomputedAnalyses:revisionAnalyses,
      },
    );
  modules.set(
    "variance-trends",
    available(
      "variance-trends",
      varianceTrends,
      ["schedule revision history"],
      ordered.length >= 2
        ? "ready"
        : "partial",
      ordered.length >= 2
        ? null
        : "One revision is available. Current variance is calculated, but cross-revision deterioration/improvement requires another revision.",
    ),
  );

  markIndependent('variance_trends');
  if (ordered.length >= 2) {
    const before =
      ordered.at(-2)!.revision;
    const after =
      current.revision;

    const changeProjection =
      buildScheduleChangeReportProjection(
        before,
        after,
        {
          generatedAt,
          producerVersion:
            versions.change,
          ...(revisionComparisons.get(before)?.get(after)?{precomputedComparison:revisionComparisons.get(before)!.get(after)!}:{}),
          // Revision Trend already evaluated this exact adjacent source pair.
          // Do not reuse a classification for an older/future current revision.
          ...(ordered.at(-1)?.revision.revisionId===after.revisionId&&
              ordered.at(-2)?.revision.revisionId===before.revisionId&&
              revisionTrend.points.at(-1)?.changeCategories
            ?{precomputedChangeCategories:revisionTrend.points.at(-1)!.changeCategories!}:{}),
          // Same source revisions already analyzed for the revision trend above.
          // Completion date bases come from original activity dates and status;
          // this local evidence map never survives source/version changes.
          precomputedAnalyses:revisionAnalyses,
        },
      );
    modules.set(
      "schedule-change-report",
      available(
        "schedule-change-report",
        {
          ...changeProjection,
          fromRevisionLabel:
            before.label,
          toRevisionLabel:
            after.label,
        },
        ["two schedule revisions"],
      ),
    );
  } else {
    modules.set(
      "schedule-change-report",
      available(
        "schedule-change-report",
        {
          schemaVersion: "1.0",
          projectionKey:
            "schedule_change_report",
          generatedAt,
          producerVersion:
            versions.change,
          state:
            "insufficient_history",
          fromRevisionId: null,
          toRevisionId:
            current.revision
              .revisionId,
          matchedActivityCount: null,
          populationMatchPercent:
            null,
          addedActivityCount: null,
          removedActivityCount: null,
          modifiedActivityCount: null,
          unchangedActivityCount: null,
          addedRelationshipCount: null,
          removedRelationshipCount: null,
          addedRelationships: [],
          removedRelationships: [],
          changedActivities: [],
          diagnostics: [
            "SECOND_SCHEDULE_REVISION_REQUIRED_FOR_CHANGE_COMPARISON",
          ],
        },
        ["second schedule revision"],
        "partial",
        "CMeng has preserved the current revision. A second revision is required for an actual field-level change comparison.",
      ),
    );
  }

  markIndependent('schedule_change_report');
  if(bundleProfile)process.stdout.write(JSON.stringify({event:'independent_change_stage_profile',projectId:state.projectId,stages:independentStageTimings,totalMs:independentStageTimings.reduce((n,p)=>n+p.ms,0)})+'\n');
  measureBundle('independent_forecast_and_change');
  const forecastSnapshots =
    ordered.map((stored) =>
      forecastSnapshotFromProjection(
cachedIndependentForecast(stored.revision.model,generatedAt),
        "forecast-" +
          stored.revision
            .revisionId,
        stored.revision.model,
      ),
    );

  modules.set(
    "forecast-history",
    available(
      "forecast-history",
      buildForecastHistoryProjection(
        forecastSnapshots,
        {
          generatedAt,
          producerVersion:
            versions.history,
        },
      ),
      ["schedule revision history"],
      ordered.length >= 2
        ? "ready"
        : "partial",
      ordered.length >= 2
        ? null
        : "Only one forecast snapshot is available.",
    ),
  );

  measureBundle('revision_forecasts');
  const resources =
    state.resourcesByRevision.get(
      current.revision
        .revisionId,
    ) ?? null;
  const resourceAssignmentsAvailable =
    (resources?.assignments.length ?? 0) >
    0;
  const usableResources =
    resourceAssignmentsAvailable
      ? resources
      : null;

  let resourceUtilization:
    ReturnType<
      typeof buildResourceUtilizationProjection
    > | null = null;
  let manhourScurve:
    ReturnType<
      typeof buildManhourScurveProjection
    > | null = null;

  if (
    usableResources
  ) {
    resourceUtilization =
      buildResourceUtilizationProjection(
        usableResources,
        model,
        {
          generatedAt,
          producerVersion:
            versions.resource,
        },
      );
    manhourScurve =
      buildManhourScurveProjection(
        usableResources,
        model,
        {
          generatedAt,
          producerVersion:
            versions.manhours,
        },
      );

    const weeklyCapacity =
      weeklyResourceCapacityEvidence(
        state.evidenceDocuments,
        {
          dataDateIso:
            model.dataDateIso,
        },
      );
    // The initial map contains blocked placeholders for every module. A real
    // assignment calculation must replace its placeholder; the canonical weekly
    // integration below then takes precedence over this assignment basis.
    modules.set(
      "resource-utilization",
      available(
        "resource-utilization",
        {
          ...resourceUtilization,
          scheduleCapacityCoveragePercent:
            resourceUtilization
              .capacityCoveragePercent,
          capacityCoveragePercent:
            weeklyCapacity
              .capacityCoveragePercent ??
            resourceUtilization
              .capacityCoveragePercent,
          plannedUtilizationPercent:
            weeklyCapacity
              .plannedUtilizationPercent ??
            null,
          actualUtilizationPercent:
            weeklyCapacity
              .actualUtilizationPercent ??
            null,
          utilizationByUnit:
            weeklyCapacity
              .utilizationByUnit,
          weeklyCapacityEvidence:
            weeklyCapacity,
        },
        [
          "resource-loaded XER",
          "governed resource evidence",
        ],
        weeklyCapacity.state ===
            "available" ||
          resourceUtilization
            .capacityBasedResourceCount >
            0
          ? "ready"
          : "partial",
        weeklyCapacity.state ===
            "candidate"
          ? "Resource support evidence exists only as candidate and is not promoted to confirmed utilization."
          : null,
      ),
    );
    modules.set(
      "manhour-scurve",
      available(
        "manhour-scurve",
        manhourScurve,
        ["resource-loaded XER"],
      ),
    );
  } else {
    // Missing resource evidence is an evidence gap, not a reason to make the
    // specialist pages unusable. Keep an explicit partial position here.
    // canonicalResourceModule() below still replaces this fallback whenever
    // governed weekly resource evidence exists, so scenario/no-evidence output
    // can never overwrite a source-backed result.
    modules.set(
      "resource-utilization",
      available(
        "resource-utilization",
        {
          schemaVersion: "1.0",
          projectionKey: "resource_utilization_scenario",
          generatedAt,
          producerVersion: versions.resource,
          projectId: state.projectId,
          sourceRevisionId: current.revision.revisionId,
          dataDateIso: model.dataDateIso,
          authority: "schedule_derived_scenario",
          submittedPlanAvailable: state.submittedManpowerPlan !== null,
          submittedAverageManpower: null,
          submittedPeakManpower: null,
          averageConcurrentWorkFronts: null,
          peakConcurrentWorkFronts: null,
          requiredAverageManpowerToContract: null,
          requiredAverageManpowerToContractorForecast: null,
          scheduleDerivedScenarios: [],
          rows: [],
          diagnostics: [
            "RESOURCE_ASSIGNMENTS_AND_GOVERNED_WEEKLY_RESOURCE_EVIDENCE_NOT_ESTABLISHED",
          ],
        },
        ["resource-loaded XER or governed weekly resource evidence"],
        "partial",
        "Resource assignments and governed weekly resource evidence are not established. The page remains available without manufacturing a resource population or utilization result.",
      ),
    );
    modules.set(
      "manhour-scurve",
      available(
        "manhour-scurve",
        {
          schemaVersion: "1.0",
          projectionKey: "manhour_scurve_scenario",
          generatedAt,
          producerVersion: versions.manhours,
          projectId: state.projectId,
          sourceRevisionId: current.revision.revisionId,
          dataDateIso: model.dataDateIso,
          actualHistoryMethod: "missing",
          submittedLaborAssignments: false,
          scenarios: [],
          points: [],
          diagnostics: [
            "LABOR_ASSIGNMENTS_AND_GOVERNED_WEEKLY_HISTORY_NOT_ESTABLISHED",
          ],
        },
        ["labor assignments or governed weekly labor history"],
        "partial",
        "Governed labor assignments or weekly labor history are not established. No man-hour curve is manufactured from missing evidence.",
      ),
    );
  }

  const quantityResult = canonicalQuantityModule(state, model, generatedAt);
  modules.set("quantity-scurve", quantityResult);
  const quantityScurve = quantityResult.data as ReturnType<typeof buildQuantityScurveProjection>;

  for (const resourceKey of ["resource-utilization", "manhour-scurve"]) {
    const sourceResource = canonicalResourceModule(state, resourceKey);
    if (sourceResource) {
      modules.set(resourceKey, sourceResource);
      if (resourceKey === "resource-utilization") resourceUtilization = sourceResource.data as ReturnType<typeof buildResourceUtilizationProjection>;
      if (resourceKey === "manhour-scurve") manhourScurve = sourceResource.data as ReturnType<typeof buildManhourScurveProjection>;
    }
  }
  measureBundle('resources_and_quantities');
  const delayModel =
    state.controls.delayClaims;
  const claimPopulationQuarantined=claimsQuarantined(delayModel);
  const claimPopulationIntegrity=claimsIntegrity(delayModel);
  const analyticalDelayModel:
    DelayClaimsModel =
    delayModel ?? {
      projectId:
        state.projectId,
      evidenceRevisionId:
        current.revision
          .revisionId,
      events: [],
      notices: [],
      claims: [],
      noticeRequirements: [],
      diagnostics: [
        "CONTRACTOR_DELAY_CLAIM_EVIDENCE_NOT_SUBMITTED",
      ],
    };

  let windows:
    ReturnType<
      typeof buildWindowsAnalysisProjection
    > | null = null;
  let delayClaims:
    ReturnType<
      typeof buildDelayClaimsProjection
    > | null = null;
  let noticesClaims:
    ReturnType<
      typeof buildNoticesClaimsProjection
    > | null = null;
  let eotAssessment:
    ReturnType<
      typeof buildEotAssessmentProjection
    > | null = null;

  windows =
    applyGovernedWindowMovementMetrics(
      state,
      buildWindowsAnalysisProjection(
        ordered.map(
          (item) =>
            item.revision,
        ),
        analyticalDelayModel,
        {
          generatedAt,
          producerVersion:
            versions.windows,
          precomputedComparisons:revisionComparisons,
          forecastResolver: revision => cachedIndependentForecast(revision.model,generatedAt),
        },
      ),
    );
  modules.set(
    "windows-analysis",
    available(
      "windows-analysis",
      windows,
      ["schedule revision history"],
      ordered.length >= 2
        ? delayModel&&!claimPopulationQuarantined
          ? "ready"
          : "partial"
        : "partial",
      ordered.length < 2
        ? "Window analysis not yet available — another comparable programme revision is required."
        : claimPopulationQuarantined
          ? claimPopulationIntegrity!.quarantinedClaimCount+" source claim rows are quarantined by the integrity gate and are excluded from causation, entitlement and management counts pending source verification."
          : delayModel
            ? null
            : "CMeng independently calculated schedule windows and movement. No contractor delay-event model was submitted, so causation remains un-attributed.",
    ),
  );

  delayClaims =
    buildDelayClaimsProjection(
      windows,
      analyticalDelayModel,
      {
        generatedAt,
        producerVersion:
          versions.delay,
        populationEstablished:delayModel!==null&&!claimPopulationQuarantined,
      },
    );
  const linkedClaimCount =
    analyticalDelayModel.claims.filter(
      (claim) =>
        claim.eventIds.length > 0,
    ).length;
  const unlinkedClaimCount =
    Math.max(
      0,
      analyticalDelayModel.claims.length -
        linkedClaimCount,
    );
  modules.set(
    "delay-claims",
    available(
      "delay-claims",
      {
        ...delayClaims,
        contractorClaimEvidenceSubmitted:
          delayModel !== null,
        claimPopulationIntegrity,
        independentScheduleMovementAvailable:
          windows.windowCount > 0,
        linkedClaimCount:delayModel&&!claimPopulationQuarantined?linkedClaimCount:null,
        unlinkedClaimCount:delayModel&&!claimPopulationQuarantined?unlinkedClaimCount:null,
        eventLinkageState:
          delayClaims.events.length > 0 &&
          linkedClaimCount > 0
            ? "linked"
            : "not_established",
      },
      [
        "schedule windows",
        "delay events",
        "claim-event linkage",
      ],
      !claimPopulationQuarantined&&
      delayClaims.events.length > 0 &&
      linkedClaimCount > 0 &&
      windows.windowCount > 0
        ? "ready"
        : "partial",
      claimPopulationQuarantined
        ? claimPopulationIntegrity!.quarantinedClaimCount+" source claim rows are retained but quarantined because their population matches a generated sequential pattern with no schedule linkage. They do not feed delay attribution, EOT, portfolio or Ask CMeng counts."
        : analyticalDelayModel.claims.length > 0 &&
          delayClaims.events.length === 0
          ? analyticalDelayModel.claims.length +
            " claim records are available, but no confirmed delay events are established. Programme movement cannot be attributed to those claims."
          : linkedClaimCount === 0 &&
              analyticalDelayModel.claims.length > 0
            ? "Claim records are not linked to confirmed delay events, so causation and entitlement remain unassessed."
            : windows.windowCount === 0
              ? "Claim and event evidence exists, but a second controlled programme revision is required to independently test movement."
              : null,
    ),
  );

  noticesClaims =
    buildNoticesClaimsProjection(
      analyticalDelayModel,
      {
        generatedAt,
        producerVersion:
          versions.notices,
        populationEstablished:delayModel!==null&&!claimPopulationQuarantined,
      },
    );
  const noticeAssessmentAvailable =
    noticesClaims.eventCount !== null && noticesClaims.eventCount > 0 &&
    analyticalDelayModel.noticeRequirements.length > 0;
  const noticeAssessable =
    noticeAssessmentAvailable &&
    noticeComplianceAssessable(noticesClaims);
  const delayEotEvidenceChain = buildDelayEotEvidenceChain({
    determinations:canonicalTimeClaims(state).determinations,
    schedule: model,
    milestoneReview:milestoneReviewForProjection(state,model),
    windows,
    delay: delayClaims,
    notices: noticesClaims,
    populationState: claimPopulationQuarantined ? "quarantined" : delayModel ? "established" : "missing",
    sourceClaimCount: claimPopulationIntegrity?.sourceClaimCount ?? (delayModel ? delayModel.claims.length : null),
    quarantinedClaimCount: claimPopulationIntegrity?.quarantinedClaimCount ?? null,
  });
  for (const moduleKey of ["windows-analysis", "delay-claims"] as const) {
    const existing = modules.get(moduleKey);
    if (existing?.data && typeof existing.data === "object") {
      modules.set(moduleKey, {
        ...existing,
        data: {
          ...(existing.data as Record<string, unknown>),
          delayEotEvidenceChain,
          contextualProgrammeIntelligence: delayEotEvidenceChain.programmeContext,
        },
      });
    }
  }
  modules.set(
    "notices-claims",
    available(
      "notices-claims",
      {
        ...noticesClaims,
        contractorNoticeClaimEvidenceSubmitted:
          delayModel !== null,
        claimPopulationIntegrity,
        noticeAssessmentState:
          noticeAssessable
            ? "assessed"
            : noticeAssessmentAvailable
              ? "partially_assessable"
              : "not_assessable_without_delay_events_and_requirements",
        linkedClaimCount:delayModel&&!claimPopulationQuarantined?linkedClaimCount:null,
        unlinkedClaimCount:delayModel&&!claimPopulationQuarantined?unlinkedClaimCount:null,
        delayEotEvidenceChain,
        contextualProgrammeIntelligence: delayEotEvidenceChain.programmeContext,
      },
      [
        "delay events",
        "notice requirements",
        "notices",
        "claims",
      ],
      noticeAssessable&&!claimPopulationQuarantined
        ? "ready"
        : "partial",
      claimPopulationQuarantined
        ? claimPopulationIntegrity!.quarantinedClaimCount+" source claim rows are quarantined by the integrity gate. Notice compliance is withheld for that population until the source is independently verified."
        : noticeAssessable
          ? null
          : noticeAssessmentAvailable &&
            noticesClaims.noticeRequirementMissingCount !== null && noticesClaims.noticeRequirementMissingCount > 0
          ? noticesClaims.noticeRequirementMissingCount +
            " confirmed delay event(s) do not have an applicable notice requirement. Assessed events remain visible, but the page stays under review."
          : noticesClaims.claimCount !== null && noticesClaims.claimCount > 0
            ? noticesClaims.claimCount +
              " claim records are available, but notice timeliness is not assessable until confirmed delay events and applicable notice requirements are linked."
            : "Notice compliance is not assessable until confirmed delay events, applicable notice requirements and actual notice evidence are established.",
    ),
  );

  if (
    state.controls
      .contractTimeBasis
  ) {
    eotAssessment =
      buildEotAssessmentProjection(
        windows,
        delayClaims,
        state.controls
          .contractTimeBasis,
        {
          generatedAt,
          producerVersion:
            versions.eot,
        },
      );
    const contractBasis =
      state.controls
        .contractTimeBasis;
    const contractReady =
      contractBasis
        .contractualCompletionIso !==
        null &&
      contractBasis
        .contractualCompletionState !==
        "missing" &&
      contractBasis
        .eotDayBasis !==
        "unknown" &&
      contractBasis
        .eotDayBasisState !==
        "missing";
    const hasCausalEvents =
      analyticalDelayModel
        .events.length > 0;
    const eligibleCausalEvents =
      eotAssessment.windowCandidates.some(
        (window) =>
          window.eligibleEventIds
            .length > 0,
      );
    const analyticalSupport =
      contractReady &&
      hasCausalEvents &&
      eligibleCausalEvents;

    if (!analyticalSupport) {
      eotAssessment = {
        ...eotAssessment,
        analyticalTimeImpactCandidateDays:
          null,
        attributableCandidateEotDays:
          null,
        candidateAdditionalEotDays:
          null,
        scenarioAdjustedCompletionIso:
          null,
        timeImpactScenarioAdjustedCompletionIso:
          null,
        includedWindowCount: 0,
        reviewWindowCount:
          eotAssessment
            .windowCandidates.length,
        windowCandidates:
          eotAssessment
            .windowCandidates.map(
              (window) => ({
                ...window,
                analyticalTimeImpactCandidateDays:
                  null,
                includedCandidateDays:
                  0,
                state:
                  "review" as const,
                reasons: [
                  ...new Set([
                    ...window.reasons,
                    ...(!contractReady
                      ? [
                          "CONTRACT_TIME_BASIS_NOT_ESTABLISHED",
                        ]
                      : []),
                    ...(!hasCausalEvents
                      ? [
                          "CAUSAL_DELAY_EVENT_BASIS_NOT_ESTABLISHED",
                        ]
                      : []),
                    ...(hasCausalEvents &&
                    !eligibleCausalEvents
                      ? [
                          "NO_EOT_ELIGIBLE_CAUSAL_EVENT_ESTABLISHED",
                        ]
                      : []),
                  ]),
                ],
              }),
            ),
      };
    }

    modules.set(
      "eot-assessment",
      available(
        "eot-assessment",
        {
          ...eotAssessment,
          contractorEotEvidenceSubmitted:
            delayModel !== null,
          causalEventEvidenceEstablished:
            hasCausalEvents,
          eligibleCausalEventEvidenceEstablished:
            eligibleCausalEvents,
          contractTimeBasisEstablished:
            contractReady,
          delayEotEvidenceChain,
          contextualProgrammeIntelligence:
            delayEotEvidenceChain.programmeContext,
        },
        [
          "contract time basis",
          "schedule windows",
          "causal delay events",
        ],
        analyticalSupport
          ? "ready"
          : "partial",
        !contractReady
          ? "Observed programme movement is shown separately, but a contractual EOT position cannot be calculated without an established contract finish and EOT day basis."
          : !hasCausalEvents
            ? "Observed programme movement is shown separately, but no EOT time-impact candidate is stated because causal delay events are not established."
            : !eligibleCausalEvents
              ? "Delay events exist, but no EOT-eligible employer/neutral causal event is established for the observed movement."
              : null,
      ),
    );
  } else {
    eotAssessment = {
      schemaVersion: "1.0",
      projectionKey:
        "eot_assessment",
      generatedAt,
      producerVersion:
        versions.eot,
      projectId:
        state.projectId,
      contractualCompletionIso:
        null,
      contractualCompletionState:
        "missing",
      officialApprovedEotDays:
        null,
      officialApprovedEotState:
        "missing",
      officialAdjustedCompletionIso:
        null,
      observedProgrammeMovementDays:
        windows
          .positiveProgrammeMovementDays,
      projectCompletionMovementDays:
        windows
          .projectCompletionMovementDays,
      projectCompletionMovementBasis:
        windows
          .projectCompletionMovementBasis,
      analyticalTimeImpactCandidateDays:
        null,
      attributableCandidateEotDays:
        null,
      unattributedTimeImpactDays:
        windows
          .positiveProgrammeMovementDays,
      candidateAdditionalEotDays:
        null,
      scenarioAdjustedCompletionIso:
        null,
      timeImpactScenarioAdjustedCompletionIso:
        null,
      eotDayBasis:
        "unknown",
      eotDayBasisState:
        "missing",
      includedWindowCount: 0,
      excludedWindowCount: 0,
      reviewWindowCount:
        windows.windowCount,
      windowCandidates:
        windows.windows.map(
          (window) => ({
            windowId:
              window.windowId,
            positiveIndependentMovementDays: window.independentForecastMovementDays===null?null:Math.max(0,window.independentForecastMovementDays),
            positiveProgrammeMovementDays: window.netCompletionMovementDays===null?null:Math.max(0,window.netCompletionMovementDays),
            programmeMovementBasis:
              window
                .netCompletionMovementBasis,
            analyticalTimeImpactCandidateDays:
              null,
            state:
              "review" as const,
            eligibleEventIds: [],
            contractorEventIds: [],
            reasons: [
              "CONTRACT_TIME_BASIS_NOT_SUBMITTED",
            ],
            assumptions: [
              "Programme movement is retained for analysis but is not treated as EOT entitlement without a confirmed contract-time basis.",
            ],
            includedCandidateDays: 0,
          }),
        ),
      basis:
        "analytical_candidate_not_contractual_determination",
      assumptions: [
        "Observed programme movement is schedule evidence only. No analytical time-impact candidate is stated without event/causation evidence and a confirmed contract-time basis.",
      ],
      diagnostics: [
        "CONTRACT_TIME_BASIS_NOT_SUBMITTED",
        ...(windows.positiveProgrammeMovementDays !== null && windows
          .positiveProgrammeMovementDays >
        0
          ? [
              "PROGRAMME_MOVEMENT_CARRIED_FORWARD_AS_ANALYTICAL_TIME_IMPACT_CANDIDATE",
            ]
          : []),
      ],
    };

    modules.set(
      "eot-assessment",
      available(
        "eot-assessment",
        {
          ...eotAssessment,
          contractorEotEvidenceSubmitted:
            delayModel !== null,
        },
        ["contract time basis"],
        "partial",
        "CMeng shows the independently observed schedule movement but does not fabricate EOT entitlement without the contract-time basis.",
      ),
    );
  }

  let challengeContract:
    ReturnType<
      typeof buildChallengeContractProjection
    > | null = null;
  let deliveryChallenge:
    ReturnType<
      typeof buildDeliveryChallengeProjection
    > | null = null;

  deliveryChallenge =
    buildDeliveryChallengeProjection({
      sourceProductivityForecast:sourceProductivityForecastEvidence(state),
      generatedAt,
      producerVersion:
        "uat-delivery-challenge-v1",
      schedule: model,
      quantities:
        state.quantities,
      quantityMapping: quantityMappingForState(state, model),
      resources:
        usableResources,
      independentForecast,
      contractTimeBasis:
        state.controls
          .contractTimeBasis,
      submittedManpowerPlan:
        state.submittedManpowerPlan,
    });

  measureBundle('delay_and_claims');
  const contractValueExtraction =
    state.contract
      ? extractContractValue(
          state.contract,
        )
      : null;

  for (const module of certifiedCommercialModules) {
    const commercial =
      canonicalCommercialModule(
        state,
        module.key,
      );
    if (commercial) {
      modules.set(
        module.key,
        commercial,
      );
    }
  }

  if (state.contract) {
    challengeContract =
      contractChallengeForState(state,generatedAt);
  }

  modules.set(
    "challenge-contract",
    available(
      "challenge-contract",
      {
        schemaVersion: "2.0",
        projectionKey:
          "challenge_contract",
        generatedAt,
        producerVersion:
          versions.challenge,
        deliveryChallenge,
        contractIntelligence:
          challengeContract,
        independentForecastState:
          independentForecastReviewReason(independentForecast)
            ? "review_required"
            : "calculated",
        independentForecastReviewReason:
          independentForecastReviewReason(independentForecast),
        contractValueEvidence: {
          governed:
            state.controls
              .contractValue,
          extraction:
            contractValueExtraction,
          state:
            state.controls
              .contractValue
              ? "governed"
              : contractValueExtraction
                    ?.state ===
                  "candidate"
                ? "candidate"
                : contractValueExtraction
                      ?.state ===
                    "conflicted"
                  ? "conflicted"
                  : "missing",
          note:
            state.controls
              .contractValue
              ? "Confirmed contract value is established."
              : contractValueExtraction
                    ?.state ===
                  "candidate"
                ? "CMeng found a contract value candidate in the contract. It is visible for review but is not used as a confirmed contract value until promoted."
                : contractValueExtraction
                      ?.state ===
                    "conflicted"
                  ? "Multiple contract value candidates conflict and require review."
                  : "CMeng searched the parsed contract and did not identify a defensible contract value candidate.",
        },
      },
      [
        "current schedule",
        "independent forecast",
        "contract time basis when available",
        "BOQ/quantity evidence when available",
        "resource/manpower evidence when available",
      ],
      (
        deliveryChallenge.position !==
          "not_yet_supportable" &&
        deliveryChallenge.position !==
          "scenario_only"
      )
        ? "ready"
        : "partial",
      deliveryChallenge.position ===
            "not_yet_supportable"
          ? "Delivery challenge cannot yet be fully supported by the available evidence."
          : deliveryChallenge.position ===
              "scenario_only"
            ? "Delivery challenge is currently scenario-only because measured manpower/productivity evidence is incomplete."
            : null,
    ),
  );

  if (
    !resourceAssignmentsAvailable
  ) {
    if (!modules.has("resource-utilization")) {
      modules.set(
        "resource-utilization",
        available(
        "resource-utilization",
        {
          schemaVersion: "1.0",
          projectionKey:
            "resource_utilization_scenario",
          generatedAt,
          producerVersion:
            versions.resource,
          projectId:
            state.projectId,
          sourceRevisionId:
            current.revision
              .revisionId,
          dataDateIso:
            model.dataDateIso,
          authority:
            "schedule_derived_scenario",
          submittedPlanAvailable:
            state
              .submittedManpowerPlan !==
            null,
          submittedAverageManpower:
            deliveryChallenge
              .manpowerChallenge
              .submittedAverageManpower,
          submittedPeakManpower:
            deliveryChallenge
              .manpowerChallenge
              .submittedPeakManpower,
          averageConcurrentWorkFronts:
            deliveryChallenge
              .manpowerChallenge
              .averageConcurrentWorkFronts,
          peakConcurrentWorkFronts:
            deliveryChallenge
              .manpowerChallenge
              .peakConcurrentWorkFronts,
          requiredAverageManpowerToContract:
            deliveryChallenge
              .manpowerChallenge
              .requiredAverageManpowerToContract,
          requiredAverageManpowerToContractorForecast:
            deliveryChallenge
              .manpowerChallenge
              .requiredAverageManpowerToContractorForecast,
          scheduleDerivedScenarios:
            deliveryChallenge
              .manpowerChallenge
              .scheduleDerivedScenarios,
          diagnostics: [
            "RESOURCE_ASSIGNMENTS_NOT_SUBMITTED_SCENARIO_DERIVED_FROM_WORKFRONTS",
          ],
        },
        [
          "current schedule",
          "contractor manpower plan when available",
        ],
        "partial",
        "No resource-loaded schedule was submitted. Manpower remains unresolved unless a headcount plan or an explicit staffing assumption is supplied. Concurrent activities alone do not establish crews.",
        ),
      );
    }

    const remainingDays =
      deliveryChallenge
        .scheduleChallenge
        .remainingDurationDays;
    const scenarioHoursPerPersonDay = deliveryChallenge.manpowerChallenge.workHoursPerPersonDay;
    const manhourScenarios =
      deliveryChallenge
        .manpowerChallenge
        .scheduleDerivedScenarios
        .map((scenario) => ({
          crewSize:
            scenario.crewSize,
          averageManpower:
            scenario
              .averageManpower,
          peakManpower:
            scenario
              .peakManpower,
          remainingScenarioHours:
            remainingDays !==
              null &&
            remainingDays > 0 && scenarioHoursPerPersonDay !== null &&
            scenario
              .averageManpower !==
              null
              ? Number(
                  (
                    remainingDays *
                    scenario
                      .averageManpower *
                    scenarioHoursPerPersonDay
                  ).toFixed(4),
                )
              : null,
          basis:
            scenarioHoursPerPersonDay === null
              ? "Unresolved: working hours per person per calendar day have not been supplied."
              : scenarioHoursPerPersonDay + " supplied working hours/person/calendar day",
          authority:
            "schedule_derived_scenario",
        }));

    if (!modules.has("manhour-scurve")) {
      modules.set(
        "manhour-scurve",
        available(
        "manhour-scurve",
        {
          schemaVersion: "1.0",
          projectionKey:
            "manhour_scurve_scenario",
          generatedAt,
          producerVersion:
            versions.manhours,
          projectId:
            state.projectId,
          sourceRevisionId:
            current.revision
              .revisionId,
          dataDateIso:
            model.dataDateIso,
          actualHistoryMethod:
            "missing",
          submittedLaborAssignments:
            false,
          scenarios:
            manhourScenarios,
          diagnostics: [
            "LABOR_ASSIGNMENTS_NOT_SUBMITTED_MANHOUR_SCENARIO_ONLY",
          ],
        },
        [
          "current schedule",
          "labor assignments when available",
        ],
        "partial",
        "No confirmed labor assignments were submitted. Remaining man-hours are unresolved unless an explicit staffing and working-hours basis is supplied.",
        ),
      );
    }
  }

  const evidenceTypes =
    new Set(
      state.evidenceDocuments.map(
        (document) =>
          document.documentType,
      ),
    );
  const evidenceCategoryPresent = (
    category: string,
  ): boolean =>
    state.evidenceDocuments.some(
      (document) =>
        document.category ===
        category,
    );
  const evidenceCoverage = (
    hasStructuredRows: boolean,
    sourcePresent: boolean,
  ):
    | "established"
    | "submitted_unparsed"
    | "not_submitted" =>
    hasStructuredRows
      ? "established"
      : sourcePresent
        ? "submitted_unparsed"
        : "not_submitted";

  if (
    ordered.length >= 2 &&
    resourceUtilization &&
    manhourScurve &&
    quantityScurve &&
    challengeContract &&
    noticesClaims &&
    delayClaims &&
    eotAssessment
  ) {
    const pmoAnalysis =
      buildPmoAnalysisProjection({
        generatedAt,
        producerVersion:
          versions.pmo,
        evidenceRevisionId:
          delayModel
            ?.evidenceRevisionId ??
          current.revision
            .revisionId,
        scheduleAnalytics,
        progressReport,
        revisionTrend,
        resourceUtilization,
        manhourScurve,
        quantityScurve,
        independentForecast,
        challengeContract,
        noticesClaims,
        delayClaims,
        eotAssessment,
      });
    modules.set(
      "pmo-analysis",
      available(
        "pmo-analysis",
        {
          ...pmoAnalysis,
          quantities:{...pmoAnalysis.quantities,installedQuantityStatus:(quantityResult.data as any).installedQuantityStatus,programmeMapping:(quantityResult.data as any).programmeMapping},
          programmeBaselineCompletionIso:
            scheduleAnalytics.result
              .completionBases.find(
                (basis) =>
                  basis.basis ===
                  "programme",
              )?.dateIso ??
            controlledBaselineCompletion
              ?.dateIso ??
            null,
          programmeBaselineRevisionId:
            controlledBaseline
              ?.revision
              .revisionId ??
            null,
        },
        [
          "schedule",
          "resources",
          "BOQ",
          "contract",
          "delay/claims",
        ],
      ),
    );
  } else {
    modules.set(
      "pmo-analysis",
      available(
        "pmo-analysis",
        {
          schemaVersion: "1.0",
          projectionKey:
            "pmo_analysis",
          generatedAt,
          producerVersion:
            versions.pmo,
          projectId:
            state.projectId,
          evidenceRevisionId:
            delayModel
              ?.evidenceRevisionId ??
            current.revision
              .revisionId,
          programmeBaselineCompletionIso:
            scheduleAnalytics.result
              .completionBases.find(
                (basis) =>
                  basis.basis ===
                  "programme",
              )?.dateIso ??
            controlledBaselineCompletion
              ?.dateIso ??
            null,
          programmeBaselineRevisionId:
            controlledBaseline
              ?.revision
              .revisionId ??
            null,
          synthesisState:
            "partial_cross_domain",
          schedule: {
            activityCount:
              scheduleAnalytics
                .result
                .activityCount,
            sourceActivityCount:
              scheduleAnalytics
                .result
                .population
                .sourceActivityCount,
            executableActivityCount:
              scheduleAnalytics
                .result
                .population
                .executableActivityCount,
            excludedActivityCount:
              scheduleAnalytics
                .result
                .population
                .excludedActivityCount,
            excludedByType: {
              ...scheduleAnalytics
                .result
                .population
                .excludedByType,
            },
            relationshipCount:
              scheduleAnalytics
                .result
                .relationshipCount,
            graphComplete:
              scheduleAnalytics
                .result
                .graph.complete,
            criticalCount:
              scheduleAnalytics
                .result
                .float
                .criticalCount,
            nearCriticalCount:
              scheduleAnalytics
                .result
                .float
                .nearCriticalCount,
            negativeFloatCount:
              scheduleAnalytics
                .result
                .float
                .negativeFloatCount,
            logicDensity:
              scheduleAnalytics
                .result
                .graph
                .logicDensity,
            criticalityBasis:
              "source_total_float",
            independentCpmState:
              independentForecast
                .complete
                ? "established"
                : "not_established",
            drivingPathState:
              independentForecast
                .complete
                ? "independent_cpm_available"
                : "not_established",
          },
          progress: {
            durationWeightedProgressPercent:
              progressReport
                .progress
                .durationWeightedProgressPercent,
            progressCoveragePercent:
              progressReport
                .progress
                .durationWeightedProgressCoveragePercent,
            completedCount:
              progressReport
                .progress
                .completedCount,
            inProgressCount:
              progressReport
                .progress
                .inProgressCount,
            notStartedCount:
              progressReport
                .progress
                .notStartedCount,
            unknownStatusCount:
              progressReport
                .progress
                .unknownStatusCount,
            lookAheadOverdueCount:
              progressReport
                .lookAhead
                .overdueCount,
            lateMilestoneCount:
              progressReport
                .milestones
                .lateOpenCount,
          },
          forecast: {
            sourceCompletionIso:
              independentForecast
                .sourceForecastCompletionIso,
            independentCompletionIso:
              independentForecast
                .independentForecastCompletionIso,
            varianceDays:
              independentForecast
                .forecastVarianceDays,
            origin:
              independentForecast
                .origin,
            complete:
              independentForecast
                .complete,
            basisRevisionId:
              independentForecast
                .sourceRevisionId,
            activityCoveragePercent:
              independentForecast
                .activityCoveragePercent,
            authority:
              independentForecast.origin ===
                "deterministic_source_calendar"
                ? "deterministic"
                : independentForecast.origin ===
                    "scenario_with_assumptions"
                  ? "scenario"
                  : "unresolved",
          },
          resources: resourceUtilization
            ? {
                state:
                  "resource_loaded",
                assignedResourceCount:
                  resourceUtilization
                    .assignedResourceCount,
                resourceCount:
                  resourceUtilization
                    .resourceCount,
                assignmentRecordCount:
                  resourceUtilization
                    .assignmentRecordCount,
                resourcePopulationBasis:
                  resourceUtilization
                    .resourcePopulationBasis,
                capacityCoveragePercent:
                  resourceUtilization
                    .capacityCoveragePercent,
                overloadedResourceCount:
                  resourceUtilization
                    .overloadedResourceCount,
              }
            : {
                state:
                  "scenario_only",
                submittedAverageManpower:
                  deliveryChallenge
                    .manpowerChallenge
                    .submittedAverageManpower,
                requiredAverageManpowerToContract:
                  deliveryChallenge
                    .manpowerChallenge
                    .requiredAverageManpowerToContract,
                scheduleDerivedScenarios:
                  deliveryChallenge
                    .manpowerChallenge
                    .scheduleDerivedScenarios,
              },
          quantities: quantityScurve
            ? {
                installedQuantityStatus:(quantityResult.data as any).installedQuantityStatus,
                state:
                  quantityScurve
                    .allocationState,
                unitSeriesCount:
                  quantityScurve
                    .series.length,
                unmappedItemCount:
                  quantityScurve
                    .unmappedItemIds
                    .length,
                overAllocatedItemCount:
                  quantityScurve
                    .overAllocatedItemIds
                    .length,
              }
            : {
                state:
                  state.quantities
                    ? "mapping_pending"
                    : "not_submitted",
                unitSeriesCount:
                  state.quantities
                    ? 0
                    : null,
                unmappedItemCount:
                  state.quantities
                    ?.items.length ??
                  null,
                overAllocatedItemCount:
                  state.quantities
                    ? 0
                    : null,
              },
          contract: challengeContract
            ? {
                loaded: true,
                physicalComplete:
                  challengeContract
                    .physicalComplete,
                semanticComplete:
                  challengeContract
                    .semanticComplete,
                challengeSignalCount:
                  challengeContract
                    .signalCount,
                noticeRequirementCandidateCount:
                  challengeContract
                    .noticeRequirementCandidates
                    .length,
              }
            : {
                loaded: false,
                physicalComplete:
                  null,
                semanticComplete:
                  null,
                challengeSignalCount:
                  null,
                noticeRequirementCandidateCount:
                  null,
              },
          claims: {
            contractorClaimEvidenceSubmitted:
              delayModel !== null,
            eventCount:
              delayModel
                ? (
                    noticesClaims
                      ?.eventCount ??
                    0
                  )
                : null,
            claimCount:
              delayModel
                ? (
                    noticesClaims
                      ?.claimCount ??
                    0
                  )
                : null,
            observedPositiveMovementDays:
              windows
                ? windows
                    .positiveIndependentMovementDays
                : null,
            observedProgrammeMovementDays:
              windows
                ? windows
                    .positiveProgrammeMovementDays
                : null,
            // Same value as the EOT page. Programme movement is not a
            // time-impact candidate; it stays in observedProgrammeMovementDays.
            analyticalTimeImpactCandidateDays:
              eotAssessment
                ?.analyticalTimeImpactCandidateDays ??
              null,
            attributableCandidateEotDays:
              eotAssessment
                ?.attributableCandidateEotDays ??
              null,
            unattributedTimeImpactDays:
              eotAssessment
                ?.unattributedTimeImpactDays ??
              windows
                ?.positiveProgrammeMovementDays ??
              null,
            candidateAdditionalEotDays:
              eotAssessment
                ?.candidateAdditionalEotDays ??
              null,
          },
          risk: {
            evidenceState:
              state.controls.risks
                .length > 0 ||
              state.evidenceDocuments
                .some(
                  (document) =>
                    document.documentType ===
                      "risk_register" &&
                    document.basisState ===
                      "active" &&
                    document.parserState ===
                      "parsed",
                )
                ? "established"
                : evidenceTypes.has(
                    "risk_register",
                  )
                  ? "submitted_unparsed"
                  : "not_submitted",
            openRiskCount:
              state.controls.risks
                .length > 0 ||
              state.evidenceDocuments
                .some(
                  (document) =>
                    document.documentType ===
                      "risk_register" &&
                    document.basisState ===
                      "active" &&
                    document.parserState ===
                      "parsed",
                )
                ? state.controls.risks
                    .filter(
                      (risk) =>
                        risk.status ===
                        "open",
                    )
                    .length
                : null,
            note:
              state.controls.risks
                .length > 0 ||
              state.evidenceDocuments
                .some(
                  (document) =>
                    document.documentType ===
                      "risk_register" &&
                    document.basisState ===
                      "active" &&
                    document.parserState ===
                      "parsed",
                )
                ? "Open-risk population is established from the active risk evidence basis."
                : evidenceTypes.has(
                    "risk_register",
                  )
                  ? "Risk register evidence is present, but an open-risk population is not yet semantically established; CMeng will not display zero."
                  : "No risk register evidence is established; CMeng will not display zero.",
          },
          revision: {
            revisionCount:
              revisionTrend
                .revisionCount,
            latestAddedActivityCount:
              revisionTrend
                .points.at(-1)
                ?.addedVsPrevious ??
              null,
            latestRemovedActivityCount:
              revisionTrend
                .points.at(-1)
                ?.removedVsPrevious ??
              null,
            latestModifiedActivityCount:
              revisionTrend
                .points.at(-1)
                ?.modifiedVsPrevious ??
              null,
          },
          missingEvidence: [
            ...(resourceAssignmentsAvailable
              ? []
              : [
                  "resource assignments",
                ]),
            ...(state.quantities
              ? []
              : [
                  "BOQ/quantity basis",
                ]),
            ...(state.contract
              ? []
              : [
                  "contract",
                ]),
            ...(delayModel
              ? []
              : [
                  "delay/claim submission",
                ]),
            ...(state.controls
              .contractTimeBasis
              ? []
              : [
                  "contract time basis",
                ]),
          ],
          diagnostics: [
            "PMO_ANALYSIS_PARTIAL_SYNTHESIS_INSTEAD_OF_BLOCKING",
          ],
        },
        [
          "available specialist evidence",
        ],
        "partial",
        "PMO Analysis is synthesized from every specialist result currently supportable. Missing evidence is exposed as a gap instead of suppressing the PMO view.",
      ),
    );
  }

  const pmoResult = modules.get("pmo-analysis");
  if (pmoResult?.data && typeof pmoResult.data === "object") {
    const pmo = pmoResult.data as Record<string, any>;
    const time = canonicalTimeClaims(state);
    const netMovement = windows?.projectCompletionMovementDays ?? null;
    const resourceData = modules.get("resource-utilization")?.data as Record<string, any> | null;
    pmo.claims = { ...pmo.claims,
      contractualCompletionIso: time.contractTimeBasis?.contractualCompletionIso ?? null,
      effectiveDeterminationDays: time.effectiveDeterminationDays,
      incorporatedEotDays: time.contractTimeBasis?.incorporatedEotDays ?? null,
      registerDeterminationDays: time.registerDeterminationDays,
      officialApprovedEotDays: time.contractTimeBasis?.officialApprovedEotDays ?? null,
      officialAdjustedCompletionIso: eotAssessment?.officialAdjustedCompletionIso ?? null,
      scenarioAdjustedCompletionIso: eotAssessment?.scenarioAdjustedCompletionIso ?? null,
      netSubmittedFinishMovementDays: netMovement,
      grossPositiveAnalyticalMovementDays: windows?.grossAnalyticalMovementDays ?? null,
      windowMovementTrace:windows?.windows.map(w=>({fromRevisionId:w.fromRevisionId,toRevisionId:w.toRevisionId,sourceDays:w.netCompletionMovementDays,calculatedDays:w.grossAnalyticalMovementDays}))??[],
      movementInterpretation: "Positive recalculated project-finish movement summed across revision windows and net submitted project-finish movement have different bases. The window trace retains both values. Their difference does not prove delay, overlap, concurrency or entitlement.",
    };
    const riskReport=operationalReporting(state).risk;
    pmo.risk={...pmo.risk,evidenceState:riskReport.state,openRiskCount:operationalReporting(state).counts.openRiskCount,validation:riskReport.validation,note:riskReport.validation.explanation};
    pmo.resources = { ...pmo.resources, weeklyCapacityCoveragePercent: resourceData?.weeklyCapacityEvidence?.capacityCoveragePercent ?? null,
      weeklyOverloadedResourceCount: resourceData?.weeklyOverloadedResourceCount ?? null,
      capacityChecksToDataDate:resourceData?.weeklyCapacityEvidence?.capacityChecksToDataDate??null };
    pmo.contract={...pmo.contract,uniqueWordingSignalCount:challengeContract?.uniqueWordingSignalCount??null,repeatedSignalOccurrenceCount:challengeContract?.repeatedSignalOccurrenceCount??null};
    pmo.progress = { ...pmo.progress, lookAheadMissedStartCount: lookAhead.missedStartCount ?? null };
  }

  measureBundle('commercial_and_pmo');
  applyUniversalModuleChallenges({
    state,
    generatedAt,
    model,
    independentForecast,
    deliveryChallenge,
    modules,
  });

  for (const [key, result] of modules) modules.set(key, checkProjectionIntegrity(result, model, scheduleAnalysisConfig, delayModel, key==='milestones'?milestoneReviewForProjection(state,model):undefined));

  measureBundle('universal_challenges_and_integrity');
  const latestBoardPublicationRecord =
    state.boardPublicationHistory
      .filter(
        (item) =>
          state.controls
            .boardPublication
            ?.finalizedAt ===
          item.finalizedAt,
      )
      .sort(
        (a, b) =>
          a.basisVersion -
          b.basisVersion,
      )
      .at(-1) ??
    null;

  if (
    delayClaims &&
    noticesClaims &&
    eotAssessment
  ) {
    const ldTerms =
      state.contract
        ? extractContractLdTerms(
            state.contract,
          )
        : {
            rateState:
              "missing" as const,
            capState:
              "missing" as const,
            rate: null,
            cap: null,
            rateCandidates: [],
            capCandidates: [],
            diagnostics: [
              "CONTRACT_NOT_SUBMITTED_LD_TERMS_UNAVAILABLE",
            ],
          };

    const canonicalCommercial =
      commercialPositionForState(
        state,
        generatedAt,
      );
    const directorCommercialByCurrency =
      canonicalCommercial.currencies.map(
        (row) => ({
          currency: row.currency,
          pendingVariationAmount: {
            ...row.pendingVariationAmount,
            sourceRefs: [...row.pendingVariationAmount.sourceRefs],
            diagnostics: [...row.pendingVariationAmount.diagnostics],
          },
          approvedVariationAmount: {
            ...row.approvedVariationAmount,
            sourceRefs: [...row.approvedVariationAmount.sourceRefs],
            diagnostics: [...row.approvedVariationAmount.diagnostics],
          },
          certifiedUnpaidAmount: {
            ...row.certifiedUnpaidAmount,
            sourceRefs: [...row.certifiedUnpaidAmount.sourceRefs],
            diagnostics: [...row.certifiedUnpaidAmount.diagnostics],
          },
          retentionDeductedAmount: {
            ...row.retentionDeductedAmount,
            sourceRefs: [...row.retentionDeductedAmount.sourceRefs],
            diagnostics: [...row.retentionDeductedAmount.diagnostics],
          },
          retentionHeldAmount: {
            ...row.retentionHeldAmount,
            sourceRefs: [...row.retentionHeldAmount.sourceRefs],
            diagnostics: [...row.retentionHeldAmount.diagnostics],
          },
          activeBondAmount: {
            ...row.activeBondAmount,
            sourceRefs: [...row.activeBondAmount.sourceRefs],
            diagnostics: [...row.activeBondAmount.diagnostics],
          },
          claimClaimedAmount: {
            ...row.claimedAmount,
            sourceRefs: [...row.claimedAmount.sourceRefs],
            diagnostics: [...row.claimedAmount.diagnostics],
          },
          claimAssessedAmount: {
            ...row.assessedClaimAmount,
            sourceRefs: [...row.assessedClaimAmount.sourceRefs],
            diagnostics: [...row.assessedClaimAmount.diagnostics],
          },
          ldScenarioAmount: {
            value: null,
            state: "not_applicable" as const,
            sourceRefs: [] as string[],
            diagnostics: [
              "LD_SCENARIO_IS_OWNED_BY_PROJECT_DIRECTOR_TIME_BASIS",
            ],
          },
        }),
      );

    director =
      buildProjectDirectorPosition({
        operationalReporting: operationalReporting(state),
        generatedAt,
        projectId:
          state.projectId,
        scheduleAnalytics,
        progressReport,
        independentForecast: forecastControl.gate.usable
          ? independentForecast
          : {
              ...independentForecast,
              // Only an uncalculable network result is withheld. A complete
              // calculation remains visible with its reconciliation state.
              independentForecastCompletionIso: null,
            },
        delayClaims,
        noticesClaims,
        eotAssessment,
        ldTerms,
        ...(state.controls
          .contractValue
          ? {
              contractValue:
                state.controls
                  .contractValue,
            }
          : {}),
        ...(
          !state.controls
            .contractValue &&
          contractValueExtraction
            ?.candidates
            .length
            ? {
                contractValueCandidates:
                  contractValueExtraction
                    .candidates
                    .map(
                      (candidate) => ({
                        amount:
                          candidate.amount,
                        currency:
                          candidate.currency,
                        sourceRefs: [
                          ...candidate
                            .sourceRefs,
                        ],
                      }),
                    ),
              }
            : {}
        ),
        bonds:
          state.controls.bonds,
        bondMonitoring:{expiredCount:canonicalCommercial.contractControls?.bondsInsurance.expiredBondCount??null,expiring30Count:canonicalCommercial.contractControls?.bondsInsurance.expiringBondCount==null?null:canonicalCommercial.contractControls.bondsInsurance.bonds.filter(row=>row.expiryState==='expiring_30').length},
        commercialByCurrency:
          directorCommercialByCurrency,
        hseIncidents:
          state.controls
            .hseIncidents,
        ncrs:
          state.controls.ncrs,
        rfis:
          state.controls.rfis,
        permits:
          state.controls.permits,
        openRiskCount:
          state.controls.risks
            .length > 0 ||
          state.evidenceDocuments
            .some(
              (document) =>
                document.documentType ===
                  "risk_register" &&
                document.basisState ===
                  "active" &&
                document.parserState ===
                  "parsed",
            )
            ? state.controls.risks
                .filter(
                  (risk) =>
                    risk.status ===
                    "open",
                )
                .length
            : null,
        boardEvidence:
          state.controls
            .boardPublication
          ? {
              reportId:
                "board-" +
                state.projectId,
              state:
                latestBoardPublicationRecord
                  ?.stale
                  ? "stale"
                  : state.controls
                      .boardPublication
                      .finalizedAt
                    ? "finalized"
                    : "draft",
              sourceManifestId:
                state.controls
                  .boardPublication
                  .sourceManifestId,
              evidenceReceiptIds:
                [
                  ...state.controls
                    .boardPublication
                    .evidenceReceiptIds,
                ],
              finalizedAt:
                state.controls
                  .boardPublication
                  .finalizedAt,
            }
          : null,
        evidenceAvailability: {
          claims:
            claimPopulationQuarantined
              ? "partial"
              : evidenceCoverage(
                  delayModel !==
                    null,
                  evidenceTypes.has(
                    "delay_eot_claims_register",
                  ) ||
                  evidenceCategoryPresent(
                    "risk_claims_procurement",
                  ),
                ),
          hse:
            evidenceCoverage(
              state.controls
                .hseIncidents
                .length > 0,
              evidenceTypes.has(
                "hse_report",
              ) ||
              evidenceCategoryPresent(
                "hse_quality_fm",
              ),
            ),
          quality:
            evidenceCoverage(
              state.controls
                .ncrs.length > 0,
              evidenceTypes.has(
                "quality_ncr_register",
              ),
            ),
          rfi:
            evidenceCoverage(
              state.controls
                .rfis.length > 0,
              evidenceTypes.has(
                "rfi_register",
              ),
            ),
          permits:
            evidenceCoverage(
              state.controls
                .permits.length > 0,
              [
                ...evidenceTypes,
              ].some(
                (type) =>
                  type.includes(
                    "permit",
                  ),
              ),
            ),
          bonds:
            evidenceCoverage(
              state.controls
                .bonds.length > 0,
              [
                ...evidenceTypes,
              ].some(
                (type) =>
                  type.includes(
                    "bond",
                  ),
              ),
            ),
          risk:
            evidenceCoverage(
              state.controls.risks
                .length > 0 ||
              state.evidenceDocuments
                .some(
                  (document) =>
                    document.documentType ===
                      "risk_register" &&
                    document.basisState ===
                      "active" &&
                    document.parserState ===
                      "parsed",
                ),
              evidenceTypes.has(
                "risk_register",
              ),
            ),
        },
      });

    director.sourceInterpretation=sourceInterpretation(state,director.schedule.progressBases,director.schedule.independentForecastCompletionIso,progressReport.scopeComparison);

    if (
      state.controls
        .boardPublication &&
      !(
        state.controls
          .boardPublication
          .finalizedAt &&
        latestBoardPublicationRecord
          ?.stale
      )
    ) {
      boardReport =
        buildBoardReadyReport(
          director,
          state.controls
            .boardPublication,
        );
      if (
        latestBoardPublicationRecord &&
        state.controls
          .boardPublication
          .finalizedAt
      ) {
        runtimeProjects
          .attachPublishedBoardReport(
            state.projectId,
            latestBoardPublicationRecord
              .publicationId,
            boardReport,
          );
      }
    }
  }

  const bundle:
    ProjectionBundle = {
    revisionComparisons,
    version: state.version,
    generatedAt,
    modules,
    director,
    boardReport,
  };

  measureBundle('board_and_finalization');
  if(bundleProfile)process.stdout.write(JSON.stringify({event:'project_bundle_profile',projectId:state.projectId,
    timings:bundleTimings,totalMs:bundleTimings.reduce((sum,part)=>sum+part.ms,0)})+'\n');
  bundleCache.set(
    state.projectId,
    bundle,
  );
  return bundle;
}



const quantityModuleCache = new WeakMap<ProjectRuntimeState, { version: number; result: ModuleRuntimeResult }>();
function canonicalQuantityModule(state: ProjectRuntimeState, model: ProjectRuntimeState["schedules"][number]["revision"]["model"], generatedAt: string): ModuleRuntimeResult {
  const cached = quantityModuleCache.get(state);
  if (cached?.version === state.version) return cached.result;
  const quantities = resolveBoqSource(state,model.sourceRevisionId).quantities;
  if (!quantities) return available("quantity-scurve", {
    schemaVersion: "1.0", projectionKey: "quantity_scurve", projectId: state.projectId,
    scheduleRevisionId: model.sourceRevisionId, dataDateIso: model.dataDateIso,
    allocationState: "missing", mappingBasis: "missing", boqState: "not_established", boqSource: boqSourceReporting(state), unitKeyed: true, generatedAt, producerVersion:"quantity-source-integration-v1", boqRevisionId:null, series: [],
    boqItemCount:null,knownQuantityItemCount:null,allocatedItemCount:null,unmappedItemCount:null,partiallyAllocatedItemCount:null,overAllocatedItemCount:null,
    allocationScope:"programme_links_only",
    programmeMapping:{state:"missing",basis:"missing",allocatedItemCount:null,itemLinkCoveragePercent:null},
    installedQuantityStatus:{state:"unresolved",measuredItemCount:null,boqItemCount:null,itemCoveragePercent:null,explanation:"Dated installed quantities are unresolved because the BOQ quantity basis is not established."},
    unmappedItemIds: [], partiallyAllocatedItemIds: [], overAllocatedItemIds: [],
    diagnostics: ["BOQ_QUANTITY_BASIS_NOT_ESTABLISHED"],
  }, ["BOQ"], "partial", "BOQ quantities have not been established.");
  const sameRevision = quantities.scheduleRevisionId === model.sourceRevisionId;
  const inferredMapping = quantityMappingForState(state, model);
  const scenario = sameRevision && quantities.allocations.length === 0 && (inferredMapping?.selectedScenarioLinks.length ?? 0) > 0;
  const allocations = !sameRevision ? [] : scenario ? inferredMapping!.selectedScenarioLinks.filter(link => link.allocatedQuantity !== null).map(link => ({
    allocationId: "scenario-" + link.candidateId, quantityItemId: link.quantityItemId, activityId: link.activityId,
    allocatedQuantity: link.allocatedQuantity!, sourceRefs: link.sourceRefs,
  })) : quantities.allocations;
  const basis = { ...quantities, scheduleRevisionId: model.sourceRevisionId, allocations,
    installedSnapshots: quantities.installedSnapshots.filter(row => model.dataDateIso !== null && row.asOfIso.slice(0,10) <= model.dataDateIso.slice(0,10)) };
  const projection = buildQuantityScurveProjection(basis, model, { generatedAt, producerVersion: "quantity-shared-evidence-v1" });
  const activityIds = new Set(model.activities.map(activity => activity.activityId));
  const itemIds = new Set(quantities.items.map(item => item.quantityItemId));
  const mappedItemIds = new Set(allocations.filter(allocation => itemIds.has(allocation.quantityItemId)
    && activityIds.has(allocation.activityId) && Number.isFinite(allocation.allocatedQuantity)
    && allocation.allocatedQuantity >= 0).map(allocation => allocation.quantityItemId));
  const approvedItemIds=new Set((sameRevision?quantities.allocations:[]).filter(row=>itemIds.has(row.quantityItemId)&&activityIds.has(row.activityId)&&Number.isFinite(row.allocatedQuantity)&&row.allocatedQuantity>=0).map(row=>row.quantityItemId));
  const mappingBasis = !sameRevision ? "revision_mismatch" : scenario ? "candidate_scenario" : quantities.allocations.length ? "governed" : "missing";
  const series = projection.series.map(series => ({ ...series, authority: scenario ? "scenario_mapping" : "governed_mapping",
    actualAuthority: "measured_installed_quantities",
    points: series.points.map(point => ({ ...point, actualInstalledQuantity: quantities.measurementReview?.complete!==false && model.dataDateIso !== null && point.dateIso.slice(0,10) <= model.dataDateIso.slice(0,10) ? point.actualInstalledQuantity : null })) }));
  const measuredItems = new Set(basis.installedSnapshots.filter(row=>itemIds.has(row.quantityItemId)&&Number.isFinite(row.installedQuantity)&&row.installedQuantity>=0).map(row=>row.quantityItemId));
  const measurementsPresent = !!quantities.measurementReview || quantities.installedSnapshots.length>0;
  const hasMeasuredActual = series.some(group=>group.points.some(point=>point.actualInstalledQuantity!==null));
  const measurementState = !hasMeasuredActual?"unresolved":measuredItems.size===quantities.items.length?"available":"partial";
  const productivityForecast = sourceProductivityForecastEvidence(state);
  const quantityProductivityRows = productivityForecast.rows.map(row=>({
    workPackageId:row.workPackageId,description:row.description,unit:row.unit,
    totalQuantity:row.totalQuantity,installedQuantity:row.installedQuantity,remainingQuantity:row.remainingQuantity,
    evidencedRatePerHour:row.evidencedRatePerHour,rateBasis:row.rateBasis,
    completionIso:row.completionIso,completionBasis:row.completionBasis,state:row.state,
    linkedActivityId:row.linkedActivityId,sourceRefs:row.sourceRefs,
  }));
  const installedQuantityStatus = {state:measurementState,measuredItemCount:measurementsPresent?measuredItems.size:null,boqItemCount:quantities.items.length,
    itemCoveragePercent:measurementsPresent&&quantities.items.length?measuredItems.size/quantities.items.length*100:null,
    explanation:hasMeasuredActual?"Dated installed quantities are available for "+measuredItems.size+" of "+quantities.items.length+" BOQ items. Programme links are a separate requirement for planned curves.":"Dated installed quantities are unresolved. A measurement source label or programme link does not establish measured actuals."};
  const result = available("quantity-scurve", {
    ...projection, allocationState: scenario ? "partial" : projection.allocationState,
    mappingBasis, candidateMappingState: sameRevision ? "evaluated" : "revision_mismatch", inferredMapping,
    boqState: "loaded", boqSource: boqSourceReporting(state), boqItemCount: quantities.items.length,
    knownQuantityItemCount: quantities.items.filter(item => item.contractQuantity !== null && Number.isFinite(item.contractQuantity) && item.contractQuantity >= 0).length,
    allocatedItemCount: mappedItemIds.size,
    allocationScope:"programme_links_only",
    programmeMapping:{state:scenario?"partial":projection.allocationState,basis:mappingBasis,allocatedItemCount:mappedItemIds.size,
      sourceLinkedItemCount:new Set([...mappedItemIds,...(inferredMapping?.sourceWbsLinks??[]).filter(row=>row.wbsId&&row.activityIds.length).map(row=>row.quantityItemId)]).size,
      itemLinkCoveragePercent:quantities.items.length?new Set([...mappedItemIds,...(inferredMapping?.sourceWbsLinks??[]).filter(row=>row.wbsId&&row.activityIds.length).map(row=>row.quantityItemId)]).size/quantities.items.length*100:null,
      plannedQuantityAllocationCoveragePercent:quantities.items.length?mappedItemIds.size/quantities.items.length*100:null,
      scopeBasis:'Unique source WBS codes and recorded allocations; scope links are not a quantity-distribution approval'},
    installedQuantityStatus,
    unmappedItemCount: quantities.items.length-mappedItemIds.size,
    partiallyAllocatedItemCount: projection.partiallyAllocatedItemIds.length,
    overAllocatedItemCount: projection.overAllocatedItemIds.length,
    itemLinkCoveragePercent: quantities.items.length ? new Set([...mappedItemIds,...(inferredMapping?.sourceWbsLinks??[]).filter(row=>row.wbsId&&row.activityIds.length).map(row=>row.quantityItemId)]).size / quantities.items.length * 100 : null,
    approvedAllocationCoveragePercent:quantities.items.length?approvedItemIds.size/quantities.items.length*100:null,
    itemLinkCoverageBasis:'Unique source WBS relationships plus approved activity allocations. WBS relationships identify scope, not quantity distribution or approval.',
    sourceWbsLinks:inferredMapping?.sourceWbsLinks??[],
    unmappedKnownQuantityItemIds: projection.unmappedItemIds,
    unmappedItemIds: quantities.items.filter(item => !mappedItemIds.has(item.quantityItemId)).map(item => item.quantityItemId),
    actualAuthority: "measured_installed_quantities", actualIndependentOfScheduleMapping: true, measurementReview:quantities.measurementReview??null,
    productivityForecast:{state:productivityForecast.state,method:productivityForecast.method,coveragePercent:productivityForecast.calculationCoveragePercent,rows:quantityProductivityRows},
    series,
    diagnostics: [...projection.diagnostics, ...(scenario ? ["QUANTITY_PLAN_IS_CANDIDATE_SCENARIO_NOT_GOVERNED"] : []), ...(!sameRevision ? ["QUANTITY_MAPPING_REVISION_MISMATCH_PLANS_WITHHELD"] : [])],
  }, ["BOQ", "quantity-to-activity mapping", "installed quantity measurements"],
    sameRevision && !scenario && projection.allocationState === "complete" ? "ready" : "partial",
    mappingBasis === "governed" ? null : "BOQ and measured installations remain visible by unit. Planned quantities require a confirmed schedule mapping; any candidate plan is a scenario.");
  quantityModuleCache.set(state, { version: state.version, result }); return result;
}

const planningModuleKeys =
  new Set([
    "schedule-analytics",
    "activity-analytics",
    "lookahead-schedule",
    "schedule-change-report",
    "revision-trend",
    "milestones",
    "near-critical",
  ]);

const planningModuleCache =
  new Map<
    string,
    {
      version: number;
      result:
        ModuleRuntimeResult;
    }
  >();

// Planning pages share the same governed schedule analysis within a project
// version. Keep the context on the reporting view so edits and authority changes
// create a fresh context; each page still builds and certifies its own result.
const planningContextCache = new WeakMap<ProjectRuntimeState, {
  version: number;
  context: ReturnType<typeof calculatePlanningContext>;
}>();

function planningContextForState(state: ProjectRuntimeState, current: NonNullable<ReturnType<typeof projectControlSchedule>>) {
  const cached = planningContextCache.get(state);
  if (cached?.version === state.version) return cached.context;
  const context = calculatePlanningContext(state, current);
  planningContextCache.set(state, {version: state.version, context});
  return context;
}

function calculatePlanningContext(state: ProjectRuntimeState, current: NonNullable<ReturnType<typeof projectControlSchedule>>) {
  const generatedAt =
    calculationSnapshotTime(state);
  const ordered =
    analyticalHistory(state);
  const model =
    current.revision.model;
  const scheduleControlBasis =
    projectScheduleControlBasis(state);
  const scheduleAnalysisConfig =
    scheduleControlBasis.analysisConfig;
  const controlledBaseline =
    ordered
      .filter(
        (item) =>
          item.role ===
            "revised_baseline" ||
          item.role ===
            "baseline",
      )
      .at(-1) ??
    null;
  const previousFloat =
    previousComparableFloatBasis(
      ordered,
      current,
    );

  const baselineSourceById = new Map((controlledBaseline?.revision.model.activities ?? []).map(activity => [activity.activityId, activity]));
  const baselineCorrespondence = resolveRevisionActivityCorrespondence(controlledBaseline?.revision.model.activities ?? [], model.activities);
  const baselineByActivity = new Map(baselineCorrespondence.matches.map(match => [match.toActivityId, baselineSourceById.get(match.fromActivityId)!]));
  const currentByActivity =
    new Map(
      model.activities.map(
        (activity) => [
          activity.activityId,
          activity,
        ],
      ),
    );

  const baselineFinish = (
    activity:
      ProjectRuntimeState["schedules"][number]["revision"]["model"]["activities"][number],
  ): string | null =>
    activity.baselineFinishIso ?? activity.currentFinishIso;

  const currentFinish = (
    activity:
      ProjectRuntimeState["schedules"][number]["revision"]["model"]["activities"][number],
  ): string | null =>
    (
      activity.status ===
        "completed"
        ? activity.actualFinishIso
        : null
    ) ??
    activity.forecastFinishIso ??
    activity.currentFinishIso ??
    activity.actualFinishIso;

  const daysBetween = (
    from: string | null,
    to: string | null,
  ): number | null => {
    if (!from || !to) {
      return null;
    }
    const a = parseScheduleTime(from);
    const b = parseScheduleTime(to);
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b)
    ) {
      return null;
    }
    return Number(
      (
        (
          b - a
        ) /
        86_400_000
      ).toFixed(6),
    );
  };

  const baselineCompletionCandidates =
    (
      controlledBaseline
        ?.revision.model
        .activities ??
      []
    )
      .map(
        (activity) => ({
          activityId:
            activity.activityId,
          dateIso:
            baselineFinish(
              activity,
            ),
        }),
      )
      .filter(
        (
          item,
        ): item is {
          activityId: string;
          dateIso: string;
        } =>
          item.dateIso !== null &&
          Number.isFinite(
            parseScheduleTime(
              item.dateIso,
            ),
          ),
      )
      .sort(
        (a, b) =>
          a.dateIso.localeCompare(
            b.dateIso,
          ),
      );

  const controlledBaselineCompletion =
    baselineCompletionCandidates
      .at(-1) ??
    null;

  const scheduleRaw =
    buildScheduleAnalyticsProjection(
      model,
      {
        generatedAt,
        producerVersion:
          "planning-fast:schedule-v1",
        config: scheduleAnalysisConfig,
      },
    );

  const controlledVariances =
    controlledBaseline
      ? model.activities.map(
          (activity) => {
            const baseline =
              baselineByActivity.get(
                activity.activityId,
              );
            return daysBetween(
              baseline
                ? baselineFinish(
                    baseline,
                  )
                : null,
              currentFinish(
                activity,
              ),
            );
          },
        )
      : [];

  const knownVariances =
    controlledVariances.filter(
      (
        value,
      ): value is number =>
        value !== null,
    );

  const scheduleAnalytics =
    controlledBaseline
      ? {
          ...scheduleRaw,
          controlledBaselineRevisionId:
            controlledBaseline
              .revision.revisionId,
          result: {
            ...scheduleRaw.result,
            completionBases:
              scheduleRaw.result
                .completionBases.map(
                  (basis) =>
                    basis.basis ===
                      "programme"
                      ? {
                          ...basis,
                          dateIso:
                            controlledBaselineCompletion
                              ?.dateIso ??
                            null,
                          activityId:
                            controlledBaselineCompletion
                              ?.activityId ??
                            null,
                          state:
                            baselineCompletionCandidates
                              .length ===
                            0
                              ? "missing" as const
                              : "available" as const,
                          coveragePercent:
                            controlledBaseline
                              .revision.model
                              .activities
                              .length
                              ? Number(
                                  (
                                    (
                                      baselineCompletionCandidates
                                        .length /
                                      controlledBaseline
                                        .revision.model
                                        .activities
                                        .length
                                    ) *
                                    100
                                  ).toFixed(4),
                                )
                              : null,
                          method:
                            "controlled baseline programme completion",
                          sourceRefs: [
                            "schedule-revision:" +
                              controlledBaseline
                                .revision
                                .revisionId,
                          ],
                        }
                      : basis,
                ),
            finishVariance: {
              distribution: numericDistribution(knownVariances),
              ...scheduleRaw.result
                .finishVariance,
              populationBasis: "source_records" as const,
              denominator: model.activities.length,
              method:
                "controlled baseline programme versus current/forecast finish",
              // Working-day fields from the same controlled-baseline pairs.
              ...workingDayVarianceSummary(
                controlledBaseline
                  ? controlledWorkingDayVariances(
                      model,
                      (activity) => {
                        const baseline = baselineByActivity.get(activity.activityId);
                        return baseline ? baselineFinish(baseline) : null;
                      },
                      currentFinish,
                    )
                  : [],
              ),
              comparableActivities:
                knownVariances.length,
              lateActivities:
                knownVariances.filter(
                  (value) =>
                    value > 0,
                ).length,
              earlyActivities:
                knownVariances.filter(
                  (value) =>
                    value < 0,
                ).length,
              onTimeActivities:
                knownVariances.filter(
                  (value) =>
                    value === 0,
                ).length,
              unknownActivities:
                model.activities
                  .length -
                knownVariances.length,
              averageFinishVarianceDays:
                knownVariances.length
                  ? Number(
                      (
                        knownVariances.reduce(
                          (
                            sum,
                            value,
                          ) =>
                            sum +
                            value,
                          0,
                        ) /
                        knownVariances
                          .length
                      ).toFixed(6),
                    )
                  : null,
              maximumDelayDays:
                knownVariances.length
                  ? Math.max(
                      ...knownVariances,
                    )
                  : null,
              coveragePercent:
                model.activities
                  .length
                  ? Number(
                      (
                        (
                          knownVariances
                            .length /
                          model.activities
                            .length
                        ) *
                        100
                      ).toFixed(4),
                    )
                  : null,
            },
          },
        }
      : scheduleRaw;

  const sourceForecastCompletionIso =
    scheduleAnalytics.result
      .completionBases.find(
        (basis) =>
          basis.basis ===
          "forecast",
      )?.dateIso ??
    null;

  const independentForecast = cachedIndependentForecast(model, generatedAt);

  const minimalDeliveryChallenge =
    buildDeliveryChallengeProjection({
      sourceProductivityForecast:sourceProductivityForecastEvidence(state),
      generatedAt,
      producerVersion:
        "planning-fast:delivery-v1",
      schedule: model,
      quantities: null,
      resources: null,
      independentForecast,
      contractTimeBasis:
        state.controls
          .contractTimeBasis,
      submittedManpowerPlan:
        state.submittedManpowerPlan,
    });

  return {
    generatedAt, ordered, model, scheduleControlBasis, scheduleAnalysisConfig,
    controlledBaseline, previousFloat, baselineByActivity, currentByActivity, baselineFinish,
    currentFinish, daysBetween, controlledBaselineCompletion, knownVariances,
    scheduleAnalytics, independentForecast, minimalDeliveryChallenge,
  };
}

function buildPlanningModuleFast(
  state: ProjectRuntimeState,
  key: string,
): ModuleRuntimeResult | null {
  if (!planningModuleKeys.has(key)) {
    return null;
  }

  const cacheKey =
    state.projectId +
    "::" +
    key;
  const cached =
    planningModuleCache.get(
      cacheKey,
    );
  if (
    cached &&
    cached.version ===
      state.version
  ) {
    return cached.result;
  }

  const current =
    projectControlSchedule(state);
  if (!current) {
    return blocked(
      key,
      "Programme evidence has not been established.",
      ["schedule"],
    );
  }

  const {
    generatedAt, ordered, model, scheduleControlBasis, scheduleAnalysisConfig,
    controlledBaseline, previousFloat, baselineByActivity, currentByActivity, baselineFinish,
    currentFinish, daysBetween, controlledBaselineCompletion, knownVariances,
    scheduleAnalytics, independentForecast, minimalDeliveryChallenge,
  } = planningContextForState(state, current);

  const modules =
    new Map<
      string,
      ModuleRuntimeResult
    >();

  const scheduleResult =
    available(
      "schedule-analytics",
      {
        ...scheduleAnalytics,
        criticalityBasis:
          "source_total_float",
        independentCpmState:
          independentForecast.complete
            ? "established"
            : "not_established",
        drivingPathState:
          independentForecast.complete
            ? "independent_cpm_available"
            : "not_established",
        interpretation:
          independentForecast.complete
            ? "Source float classifications are shown alongside a valid independent CPM calculation."
            : "Source total-float classifications remain visible, but CMeng does not call them an independently established critical/driving path because CPM integrity is unresolved.",
      },
      [],
      scheduleAnalytics.result
        .complete
        ? "ready"
        : "partial",
      scheduleAnalytics.result
        .complete
        ? null
        : "Programme values are available, while schedule integrity items still need review.",
    );

  if (
    key === "schedule-analytics" ||
    key === "activity-analytics" ||
    key === "pmo-analysis"
  ) {
    modules.set(
      "schedule-analytics",
      scheduleResult,
    );
  }

  if (key === "activity-analytics") {
    const raw =
      buildActivityAnalyticsProjection(
        model,
        {
          generatedAt,
          producerVersion:
            "planning-fast:activity-v1",
          config: scheduleAnalysisConfig,
        },
      );
    const activity =
      controlledBaseline
        ? {
            ...raw,
            controlledBaselineRevisionId:
              controlledBaseline
                .revision
                .revisionId,
            finishVarianceCoveragePercent:
              model.activities.length
                ? Number(
                    (
                      (
                        knownVariances
                          .length /
                        model.activities
                          .length
                      ) *
                      100
                    ).toFixed(4),
                  )
                : null,
            rows:
              raw.rows.map(
                (row) => {
                  const baseline =
                    baselineByActivity.get(
                      row.activityId,
                    );
                  const currentActivity =
                    currentByActivity.get(
                      row.activityId,
                    );
                  const baselineFinishIso =
                    baseline
                      ? baselineFinish(
                          baseline,
                        )
                      : null;
                  return {
                    ...row,
                    baselineFinishIso,
                    finishVarianceDays:
                      daysBetween(
                        baselineFinishIso,
                        currentActivity
                          ? currentFinish(
                              currentActivity,
                            )
                          : null,
                      ),
                  };
                },
              ),
          }
        : raw;

    modules.set(
      key,
      available(
        key,
        {
          ...activity,
          floatClassificationBasis:
            "source_total_float",
          independentCpmState:
            independentForecast.complete
              ? "established"
              : "not_established",
        },
        [],
        scheduleAnalytics.result
          .complete
          ? "ready"
          : "partial",
        scheduleAnalytics.result
          .complete
          ? null
          : "Activity dates, progress and source float are available while schedule integrity items still need review.",
      ),
    );
  } else if (
    key === "lookahead-schedule"
  ) {
    modules.set(
      key,
      available(
        key,
        buildLookAheadProjection(
          model,
          {
        drivingActivityIds:cachedIndependentForecast(model,generatedAt).drivingNetwork?.activityIds,
            generatedAt,
            producerVersion:
              "planning-fast:lookahead-v1",
            readinessEvidence:
              lookAheadReadinessWithProcurement(state,cachedIndependentForecast(model,generatedAt).drivingNetwork?.activityIds??[]),
          },
        ),
      ),
    );
  } else if (
    key === "milestones"
  ) {
    const raw =
      buildMilestonesProjection(
        model,
        {
          review: milestoneReviewForProjection(state,model),
          config: scheduleAnalysisConfig,
          generatedAt,
          producerVersion:
            "planning-fast:milestones-v1",
        },
      );
    const milestones =
      controlledBaseline
        ? {
            ...raw,
            controlledBaselineRevisionId:
              controlledBaseline
                .revision
                .revisionId,
            rows:
              raw.rows.map(
                (row) => {
                  const baseline =
                    baselineByActivity.get(
                      row.activityId,
                    );
                  const baselineDateIso =
                    baseline
                      ? (
                          baseline
                            .baselineFinishIso ??
                          baseline
                            .baselineStartIso ??
                          baseline
                            .currentFinishIso
                        )
                      : null;
                  const movementDate =
                  row.status === "completed"
                    ? row.actualDateIso ?? row.currentDateIso
                    : row.forecastDateIso ?? row.currentDateIso;
                return refreshMilestoneManagementControl({
                    ...row,
                    baselineDateIso,
                    movementBasis:
                      baselineDateIso === null || movementDate === null
                        ? "not_established"
                        : row.status === "completed" && row.actualDateIso
                          ? "actual_vs_baseline"
                          : row.forecastDateIso
                            ? "forecast_vs_baseline"
                            : "current_vs_baseline",
                    varianceDays:
                      daysBetween(
                        baselineDateIso,
                        movementDate,
                      ),
                  });
                },
              ),
          }
        : raw;
    modules.set(
      key,
      available(
        key,
        milestones,
      ),
    );
  } else if (
    key === "near-critical"
  ) {
    const raw =
      buildNearCriticalProjection(
        model,
        {
          generatedAt,
          producerVersion:
            "planning-fast:near-critical-v1",
          config: scheduleAnalysisConfig,
          controlledBaseline: controlledBaseline ? { revisionId: controlledBaseline.revision.revisionId, finishByActivity: new Map([...baselineByActivity].map(([id,a]) => [id,baselineFinish(a)])) } : null,
          previousFloat,
        },
      );
    const nearCriticalBase = {
      ...raw,
      sourceReportedNearCriticalLabelCount:
        scheduleControlBasis.sourceReportedNearCriticalLabelCount,
      sourceReportedLabel:
        scheduleControlBasis.sourceReportedNearCriticalLabelCount !== null
          ? "Near Critical"
          : null,
      reconciliation: {
        strictNearCriticalCount:
          raw.nearCriticalCount,
        floatRiskWatchlistCount:
          raw.floatRiskWatchlistCount,
        sourceReportedCount:
          scheduleControlBasis.sourceReportedNearCriticalLabelCount,
        sourceLabelReconcilesTo:
          scheduleControlBasis.sourceCountReconcilesTo,
        gap:
          scheduleControlBasis.sourceReportedNearCriticalLabelCount === null || raw.floatRiskWatchlistCount === null
            ? null
            : raw.floatRiskWatchlistCount -
              scheduleControlBasis.sourceReportedNearCriticalLabelCount,
        status:
          scheduleControlBasis.sourceReportedNearCriticalLabelCount === null
            ? "source_not_reported"
            : raw.floatRiskWatchlistCount === null
              ? "unresolved"
              : raw.floatRiskWatchlistCount ===
                scheduleControlBasis.sourceReportedNearCriticalLabelCount
              ? "reconciled"
              : "difference",
      },
      nearCriticalThresholdAuthority:

        scheduleControlBasis.nearCriticalThresholdMethod === "explicit_working_days" ||

        scheduleControlBasis.nearCriticalThresholdMethod === "explicit_hours"

          ? "project_source"

          : scheduleControlBasis.nearCriticalThresholdMethod === "cmeng_policy_default"

            ? "cmeng_screening_policy"

            : "unresolved",

      nearCriticalThresholdExplanation:

        scheduleControlBasis.nearCriticalThresholdMethod === "explicit_working_days" ||

        scheduleControlBasis.nearCriticalThresholdMethod === "explicit_hours"

          ? "The near-critical threshold is explicitly evidenced in the project control basis."

          : scheduleControlBasis.nearCriticalThresholdMethod === "cmeng_policy_default"

            ? "The project documents do not establish a near-critical threshold. CMeng applies its screening policy for analysis only; this is not a project-approved threshold."

            : "A near-critical threshold is not established, so CMeng does not present the screening rule as a project requirement.",

      definitions: {

        critical:

          "TF <= confirmed critical float threshold",

        nearCritical:

          scheduleControlBasis.nearCriticalThresholdMethod === "explicit_working_days" ||

          scheduleControlBasis.nearCriticalThresholdMethod === "explicit_hours"

            ? "confirmed project critical threshold < TF <= N activity-calendar working days"

            : "CMeng screening threshold applied to source total float; project threshold not established",

        floatRiskWatchlist:

          scheduleControlBasis.nearCriticalThresholdMethod === "explicit_working_days" ||

          scheduleControlBasis.nearCriticalThresholdMethod === "explicit_hours"

            ? scheduleAnalysisConfig.floatRiskWatchlistIncludesCriticalThreshold

              ? "confirmed project critical threshold <= TF <= N activity-calendar working days"

              : "confirmed project critical threshold < TF <= N activity-calendar working days"

            : "CMeng screening watchlist applied to source total float; project threshold not established",

      },
    };
    const nearCritical = nearCriticalBase;
    modules.set(
      key,
      available(
        key,
        {
          ...nearCritical,
          classificationBasis:
            "source_total_float",
          independentCpmState:
            independentForecast.complete
              ? "established"
              : "not_established",
        },
        [],
        "partial",
        independentForecast.complete
          ? "The watchlist uses submitted programme float. Independent CPM criticality is calculated separately and remains a separate authority."
          : "The watchlist uses submitted programme float. " +
            (
              independentForecastReviewReason(
                independentForecast,
              ) ??
              "Independent CPM criticality is not established."
            ),
      ),
    );
  } else if (
    key === "revision-trend"
  ) {
    const revisionTrend =
      buildRevisionTrendProjection(
        ordered.map(
          (item) =>
            item.revision,
        ),
        {
          generatedAt,
          producerVersion:
            "planning-fast:revision-v1",
          config: scheduleAnalysisConfig,
        },
      );
    modules.set(
      key,
      available(
        key,
        revisionTrend,
        [
          "schedule revision history",
        ],
        ordered.length >= 2
          ? "ready"
          : "partial",
        ordered.length >= 2
          ? null
          : "A second controlled programme revision is required for trend comparison.",
      ),
    );
  } else if (
    key === "schedule-change-report"
  ) {
    if (ordered.length >= 2) {
      const before =
        ordered.at(-2)!
          .revision;
      const after =
        current.revision;
      const change =
        buildScheduleChangeReportProjection(
          before,
          after,
          {
            generatedAt,
            producerVersion:
              "planning-fast:change-v1",
          },
        );
      modules.set(
        key,
        available(
          key,
          {
            ...change,
            fromRevisionLabel:
              before.label,
            toRevisionLabel:
              after.label,
          },
          [
            "two schedule revisions",
          ],
        ),
      );
    } else {
      modules.set(
        key,
        available(
          key,
          {
            schemaVersion: "1.0",
            projectionKey:
              "schedule_change_report",
            generatedAt,
            producerVersion:
              "planning-fast:change-v1",
            state:
              "insufficient_history",
            fromRevisionId: null,
            toRevisionId:
              current.revision
                .revisionId,
            fromRevisionLabel:
              null,
            toRevisionLabel:
              current.revision.label,
            matchedActivityCount: 0,
            populationMatchPercent:
              null,
            addedActivityCount: 0,
            removedActivityCount: 0,
            modifiedActivityCount: 0,
            unchangedActivityCount: 0,
            addedRelationshipCount: 0,
            removedRelationshipCount: 0,
            addedRelationships: [],
            removedRelationships: [],
            changedActivities: [],
            diagnostics: [
              "SECOND_SCHEDULE_REVISION_REQUIRED_FOR_CHANGE_COMPARISON",
            ],
          },
          [
            "second schedule revision",
          ],
          "partial",
          "A second controlled programme revision is required for comparison.",
        ),
      );
    }
  } else if (
    key === "pmo-analysis"
  ) {
    const lookAhead =
      buildLookAheadProjection(
        model,
        {
        drivingActivityIds:cachedIndependentForecast(model,generatedAt).drivingNetwork?.activityIds,
          generatedAt,
          producerVersion:
            "planning-fast:lookahead-v1",
          readinessEvidence:
            lookAheadReadinessWithProcurement(state,cachedIndependentForecast(model,generatedAt).drivingNetwork?.activityIds??[]),
        },
      );
    const milestonesRaw =
      buildMilestonesProjection(
        model,
        {
          review: milestoneReviewForProjection(state,model),
          config: scheduleAnalysisConfig,
          generatedAt,
          producerVersion:
            "planning-fast:milestones-v1",
        },
      );
    const milestones =
      controlledBaseline
        ? {
            ...milestonesRaw,
            rows:
              milestonesRaw.rows.map(
                (row) => {
                  const baseline =
                    baselineByActivity.get(
                      row.activityId,
                    );
                  const baselineDateIso =
                    baseline
                      ? (
                          baseline
                            .baselineFinishIso ??
                          baseline
                            .baselineStartIso ??
                          baseline
                            .currentFinishIso
                        )
                      : null;
                  return refreshMilestoneManagementControl({
                    ...row,
                    baselineDateIso,
                    varianceDays:
                      daysBetween(
                        baselineDateIso,
                        row.currentDateIso,
                      ),
                  });
                },
              ),
          }
        : milestonesRaw;

    const resourceModel =
      state.resourcesByRevision.get(
        current.revision
          .revisionId,
      ) ??
      null;

    const pmoData = {
      schemaVersion: "1.0",
      projectionKey:
        "pmo_analysis",
      generatedAt,
      producerVersion:
        "planning-fast:pmo-v1",
      projectId:
        state.projectId,
      evidenceRevisionId:
        current.revision
          .revisionId,
      programmeBaselineCompletionIso:
        scheduleAnalytics.result
          .completionBases.find(
            (basis) =>
              basis.basis ===
              "programme",
          )?.dateIso ??
        controlledBaselineCompletion
          ?.dateIso ??
        null,
      programmeBaselineRevisionId:
        controlledBaseline
          ?.revision.revisionId ??
        null,
      synthesisState:
        "partial_cross_domain",
      schedule: {
        activityCount:
          scheduleAnalytics
            .result
            .activityCount,
        relationshipCount:
          scheduleAnalytics
            .result
            .relationshipCount,
        graphComplete:
          scheduleAnalytics
            .result
            .graph.complete,
        criticalCount:
          scheduleAnalytics
            .result
            .float
            .criticalCount,
        nearCriticalCount:
          scheduleAnalytics
            .result
            .float
            .nearCriticalCount,
        negativeFloatCount:
          scheduleAnalytics
            .result
            .float
            .negativeFloatCount,
        logicDensity:
          scheduleAnalytics
            .result
            .graph
            .logicDensity,
        independentCpmState:
          independentForecast.complete
            ? "established"
            : "not_established",
      },
      progress: {
        durationWeightedProgressPercent:
          scheduleAnalytics
            .result
            .progress
            .durationWeightedPercentComplete
            .value,
        progressCoveragePercent:
          scheduleAnalytics
            .result
            .progress
            .durationWeightedPercentComplete
            .coveragePercent,
        completedCount:
          scheduleAnalytics
            .result
            .status.completed,
        inProgressCount:
          scheduleAnalytics
            .result
            .status.inProgress,
        lookAheadOverdueCount:
          lookAhead.overdueCount,
        lateMilestoneCount:
          milestonesRaw
            .lateOpenCount,
      },
      forecast: {
        sourceCompletionIso:
          independentForecast
            .sourceForecastCompletionIso,
        independentCompletionIso:
          independentForecast
            .independentForecastCompletionIso,
        varianceDays:
          independentForecast
            .forecastVarianceDays,
        origin:
          independentForecast.origin,
        complete:
          independentForecast.complete,
      },
      resources: {
        state:
          resourceModel &&
          resourceModel
            .assignments.length > 0
            ? "resource_loaded"
            : "not_loaded",
        assignedResourceCount:
          resourceModel
            ?.assignments.length ??
          null,
        capacityCoveragePercent:
          null,
        overloadedResourceCount:
          null,
      },
      quantities: {
        state:
          state.quantities
            ? "submitted"
            : "not_submitted",
        unitSeriesCount: null,
        unmappedItemCount:
          state.quantities
            ? state.quantities
                .items.length
            : null,
        overAllocatedItemCount:
          null,
      },
      contract: {
        loaded:
          state.contract !== null,
        physicalComplete:
          state.contract
            ?.physicalComplete ??
          null,
        semanticComplete:
          state.contract
            ?.semanticComplete ??
          null,
        challengeSignalCount:
          null,
        noticeRequirementCandidateCount:
          null,
      },
      claims: {
        eventCount:
          claimsQuarantined(state.controls.delayClaims)
            ? null
            : state.controls
                .delayClaims
                ?.events.length ??
              null,
        claimCount:
          claimsQuarantined(state.controls.delayClaims)
            ? null
            : state.controls
                .delayClaims
                ?.claims.length ??
              null,
        observedProgrammeMovementDays:
          null,
        officialApprovedEotDays:
          null,
      },
    };

    modules.set(
      key,
      available(
        key,
        pmoData,
        [
          "current programme",
          "available specialist evidence",
        ],
        "partial",
        "Management Brief is synthesized from the specialist evidence currently available. Missing cross-domain evidence remains visible instead of being treated as zero.",
      ),
    );
  }

  applyUniversalModuleChallenges({
    state,
    generatedAt,
    model,
    independentForecast,
    deliveryChallenge:
      minimalDeliveryChallenge,
    modules,
  });

  const result =
    modules.get(key) ??
    blocked(
      key,
      "The selected Programme & Planning view could not be calculated.",
      [],
    );

  planningModuleCache.set(
    cacheKey,
    {
      version: state.version,
      result,
    },
  );

  return result;
}


const specialistFastModuleKeys =
  new Set([
    "resource-utilization",
    "variance-trends",
    "progress-scurve",
    "quantity-scurve",
    "progress-breakdown",
    "manhour-scurve",
    "forecast-history",
    "independent-forecast",
    "delay-claims",
    "notices-claims",
    "windows-analysis",
    "eot-assessment",
    "challenge-contract",
  ]);

const specialistModuleCache =
  new Map<
    string,
    {
      version: number;
      result:
        ModuleRuntimeResult;
    }
  >();

/** The source-only fallback is a project-version fact, not a global
 * revision-name fact. Different projects can use the same source revision ID;
 * a global string cache previously returned one project's dates for another.
 * Retain the complete source calculation and invalidate on state/model change. */
const sourceOnlyForecastCache =
  new WeakMap<ProjectRuntimeState,{
    version:number;
    model:ProjectRuntimeState["schedules"][number]["revision"]["model"];
    result:ReturnType<typeof buildIndependentForecastProjection>;
  }>();

const specialistChallengeCache =
  new Map<
    string,
    {
      version: number;
      forecast:
        ReturnType<
          typeof buildIndependentForecastProjection
        >;
      delivery:
        ReturnType<
          typeof buildDeliveryChallengeProjection
        >;
    }
  >();

function specialistChallengeContext(
  state: ProjectRuntimeState,
  model:
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
  generatedAt: string,
) {
  const cached =
    specialistChallengeCache.get(
      state.projectId,
    );
  if (
    cached &&
    cached.version ===
      state.version
  ) {
    return cached;
  }

  const forecast =
    cachedIndependentForecast(
      model,
      generatedAt,
    );
  const resourceModel =
    state.resourcesByRevision.get(
      model.sourceRevisionId,
    ) ??
    null;
  const delivery =
    buildDeliveryChallengeProjection({
      sourceProductivityForecast:sourceProductivityForecastEvidence(state),
      generatedAt,
      producerVersion:
        "specialist-challenge-fast-v1",
      schedule: model,
      quantities:
        state.quantities &&
        state.quantities
          .allocations.length > 0
          ? state.quantities
          : null,
      quantityMapping: state.quantities && state.quantities.allocations.length > 0
        ? quantityMappingForState(state, model) : null,
      resources:
        resourceModel &&
        resourceModel
          .assignments.length > 0
          ? resourceModel
          : null,
      independentForecast:
        forecast,
      contractTimeBasis:
        state.controls
          .contractTimeBasis,
      submittedManpowerPlan:
        state.submittedManpowerPlan,
    });

  const context = {
    version:
      state.version,
    forecast,
    delivery,
  };
  specialistChallengeCache.set(
    state.projectId,
    context,
  );
  return context;
}

export function sourceOnlyForecast(
  state:ProjectRuntimeState,
  model:
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
  generatedAt: string,
): ReturnType<
  typeof buildIndependentForecastProjection
> {
  const cached=sourceOnlyForecastCache.get(state);
  if(cached&&cached.version===state.version&&cached.model===model){
    return {...cached.result,generatedAt};
  }

  let latestFinishMs:
    number | null = null;
  let sourceForecastCompletionIso:
    string | null = null;

  for (
    const activity of
      model.activities
  ) {
    if (
      activity.activityType ===
        "wbs_summary" ||
      activity.activityType ===
        "level_of_effort"
    ) {
      continue;
    }

    const finish =
      (
        activity.status ===
          "completed" &&
        activity.actualFinishIso
          ? activity
              .actualFinishIso
          : activity
              .forecastFinishIso ??
            activity
              .currentFinishIso
      ) ??
      null;

    if (!finish) continue;
    const finishMs =
      parseScheduleTime(finish);
    if (
      !Number.isFinite(
        finishMs,
      )
    ) {
      continue;
    }
    if (
      latestFinishMs === null ||
      finishMs >
        latestFinishMs
    ) {
      latestFinishMs =
        finishMs;
      sourceForecastCompletionIso =
        finish;
    }
  }

  const projection = {
    schemaVersion:
      "1.0" as const,
    projectionKey:
      "independent_forecast" as const,
    generatedAt,
    producerVersion:
      "source-forecast-only-v3",
    projectId:
      model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    dataDateIso:
      model.dataDateIso,
    origin:
      "unresolved" as const,
    durationBasis:
      "remaining" as const,
    calculationMode:
      "elapsed_time_fallback" as const,
    sourceForecastCompletionIso,
    independentForecastCompletionIso:
      null,
    forecastVarianceDays:
      null,
    requiredFinishIso:
      null,
    requiredFinishVarianceDays:
      null,
    calculatedActivityCount:
      0,
    unresolvedActivityCount:
      model.activities.length,
    activityCoveragePercent:
      0,
    criticalActivityIds:
      [],
    assumptions:
      [],
    diagnostics: [
      "INDEPENDENT_CPM_NOT_CALCULATED_IN_THIS_FAST_VIEW",
    ],
    probabilistic: {
      status:
        "unavailable" as const,
      method:
        "limited_triangular_duration_factor" as const,
      authority:
        "non_official" as const,
      iterations: 0,
      seed: 0,
      minFactor: 0.9,
      modeFactor: 1,
      maxFactor: 1.25,
      p50CompletionIso:
        null,
      p80CompletionIso:
        null,
      p90CompletionIso:
        null,
      assumptions: [
        "Probabilistic comparison is not calculated until the independent deterministic forecast is reviewed.",
      ],
    },
    activities: [],
    complete: false,
  };

  sourceOnlyForecastCache.set(state,{version:state.version,model,result:projection});
  return projection;
}


const claimsFastContextCache =
  new Map<
    string,
    {
      version: number;
      analyticalDelayModel:
        DelayClaimsModel;
      windows:
        ReturnType<
          typeof buildWindowsAnalysisProjection
        >;
      delay:
        ReturnType<
          typeof buildDelayClaimsProjection
        >;
      notices:
        ReturnType<
          typeof buildNoticesClaimsProjection
        >;
      delayEotEvidenceChain:
        ReturnType<
          typeof buildDelayEotEvidenceChain
        >;
      linkedClaimCount: number | null;
      unlinkedClaimCount: number | null;
      revisionLabels:
        Record<string, string>;
    }
  >();

function claimsFastContext(
  state: ProjectRuntimeState,
  ordered:
    ProjectRuntimeState["schedules"],
  current:
    ProjectRuntimeState["schedules"][number],
  generatedAt: string,
) {
  const cached =
    claimsFastContextCache.get(
      state.projectId,
    );
  if (
    cached &&
    cached.version ===
      state.version
  ) {
    return cached;
  }

  const delayModel =
    state.controls.delayClaims;
  const analyticalDelayModel:
    DelayClaimsModel =
    delayModel ?? {
      projectId:
        state.projectId,
      evidenceRevisionId:
        current.revision
          .revisionId,
      events: [],
      notices: [],
      claims: [],
      noticeRequirements: [],
      diagnostics: [
        "DELAY_CLAIM_EVIDENCE_NOT_SUBMITTED",
      ],
    };

  const windows =
    applyGovernedWindowMovementMetrics(
      state,
      buildWindowsAnalysisProjection(
        ordered.map(
          (item) =>
            item.revision,
        ),
        analyticalDelayModel,
        {
          generatedAt,
          producerVersion:
            "windows-fast-v3",
          ...(bundleCache.get(state.projectId)?.version===state.version
            ? {precomputedComparisons:bundleCache.get(state.projectId)!.revisionComparisons??new Map()}:{}),
          forecastResolver:
            (revision) =>
              cachedIndependentForecast(
                revision.model,
                generatedAt,
              ),
        },
      ),
    );

  const claimPopulationIntegrity = claimsIntegrity(delayModel);
  const claimPopulationQuarantined = claimsQuarantined(delayModel);
  const delay =
    buildDelayClaimsProjection(
      windows,
      analyticalDelayModel,
      {
        generatedAt,
        producerVersion:
          "delay-claims-fast-v3",
        populationEstablished: delayModel !== null && !claimPopulationQuarantined,
      },
    );
  const notices = buildNoticesClaimsProjection(
    analyticalDelayModel,
    {
      generatedAt,
      producerVersion: "notices-claims-fast-v3",
      populationEstablished: delayModel !== null && !claimPopulationQuarantined,
    },
  );
  const delayEotEvidenceChain = buildDelayEotEvidenceChain({
    determinations:canonicalTimeClaims(state).determinations,
    schedule: current.revision.model,
    milestoneReview:milestoneReviewForProjection(state,current.revision.model),
    windows,
    delay,
    notices,
    populationState: claimPopulationQuarantined ? "quarantined" : delayModel ? "established" : "missing",
    sourceClaimCount: claimPopulationIntegrity?.sourceClaimCount ?? (delayModel ? delayModel.claims.length : null),
    quarantinedClaimCount: claimPopulationIntegrity?.quarantinedClaimCount ?? null,
  });

  // Same rule as the full projection path: no established claim population means unknown, not 0.
  const claimPopulationEstablished = delayModel !== null && !claimPopulationQuarantined;
  const linkedClaimCount =
    claimPopulationEstablished ? analyticalDelayModel.claims.filter(
      (claim) =>
        claim.eventIds.length >
        0,
    ).length : null;
  const unlinkedClaimCount =
    claimPopulationEstablished && linkedClaimCount !== null ? analyticalDelayModel
      .claims.length -
    linkedClaimCount : null;
  const revisionLabels =
    Object.fromEntries(
      ordered.map(
        (item) => [
          item.revision.revisionId,
          item.revision.label ??
          item.sourceFilename ??
          item.revision.revisionId,
        ],
      ),
    );

  const context = {
    version:
      state.version,
    analyticalDelayModel,
    windows,
    delay,
    notices,
    delayEotEvidenceChain,
    linkedClaimCount,
    unlinkedClaimCount,
    revisionLabels,
  };
  claimsFastContextCache.set(
    state.projectId,
    context,
  );
  return context;
}

function eotCompletionAuthorityContext(
  state: ProjectRuntimeState,
  time: ReturnType<typeof canonicalTimeClaims>,
  model: ProjectRuntimeState["schedules"][number]["revision"]["model"],
  generatedAt: string,
) {
  const completion = contractCompletionPosition(state, time.dataDateIso);
  // SW-22: one shared original-date read (contract and amendment restatements, T04 label).
  const originalContractualCompletionIso = completion.original.value;
  const originalContractualCompletionState = completion.original.state;
  const applicableAmendments = time.amendments
    .filter(amendment => amendment.state === "official" && amendment.effectiveDate !== null && time.dataDateIso !== null && amendment.effectiveDate <= time.dataDateIso)
    .sort((a,b)=>a.effectiveDate!.localeCompare(b.effectiveDate!));
  const latestEffective = applicableAmendments.at(-1)?.effectiveDate ?? null;
  const latestAmendmentDates = latestEffective
    ? [...new Set(applicableAmendments.filter(amendment => amendment.effectiveDate === latestEffective).map(amendment => amendment.completionIso))]
    : [];
  const amendedContractualCompletionIso = latestAmendmentDates.length === 1 ? latestAmendmentDates[0]! : null;
  const amendedContractualCompletionState = latestAmendmentDates.length === 1 ? "official" : latestAmendmentDates.length > 1 ? "conflicted" : "missing";
  return {
    originalContractualCompletionIso,
    originalContractualCompletionState,
    ...(completion.original.sourceAnalyticalNote ? {originalContractualCompletionSourceNote: completion.original.sourceAnalyticalNote} : {}),
    amendedContractualCompletionIso,
    amendedContractualCompletionState,
    currentContractualCompletionIso: time.contractTimeBasis?.contractualCompletionIso ?? null,
    sourceForecastCompletionIso: sourceOnlyForecast(state,model, generatedAt).sourceForecastCompletionIso,
  };
}

function independentForecastReviewReason(
  forecast: ReturnType<
    typeof buildIndependentForecastProjection
  >,
): string | null {
  if (!forecast.complete) {
    const missingPatterns =
      forecast.diagnostics.filter(
        (diagnostic) =>
          diagnostic.startsWith(
            "CALENDAR_WORK_PATTERN_NOT_ESTABLISHED:",
          ),
      );
    const unresolvedSemantics =
      forecast.diagnostics.filter(
        (diagnostic) =>
          diagnostic.startsWith(
            "CALENDAR_SEMANTICS_UNRESOLVED:",
          ),
      );
    if (missingPatterns.length > 0) {
      return (
        String(
          forecast.unresolvedActivityCount,
        ) +
        " execution activities cannot be recalculated because " +
        String(
          missingPatterns.length,
        ) +
        " referenced P6 calendar record(s) do not establish a usable working-time pattern. CMeng does not assume a fallback calendar."
      );
    }
    if (unresolvedSemantics.length > 0) {
      return (
        String(
          forecast.unresolvedActivityCount,
        ) +
        " execution activities cannot be recalculated because " +
        String(
          unresolvedSemantics.length,
        ) +
        " referenced P6 calendar record(s) have unresolved source semantics. CMeng keeps the forecast unavailable rather than replacing them with assumed working time."
      );
    }
    return "Independent forecast requires review because one or more CPM inputs are unresolved.";
  }
  if(forecast.assumptions.some(a=>a.startsWith('SOURCE_CONSTRAINTS_RETAINED_NOT_APPLIED'))){
    return 'This is an unconstrained execution-network calculation. Source constraints are retained but are not applied by this calculation; their effect must be reconciled before adopting a management forecast.';
  }

  const variance =
    forecast.forecastVarianceDays;
  if (
    variance === null ||
    !forecast.dataDateIso ||
    !forecast
      .sourceForecastCompletionIso
  ) {
    return null;
  }

  const dataDate =
    parseScheduleTime(
      forecast.dataDateIso,
    );
  const sourceFinish =
    parseScheduleTime(
      forecast
        .sourceForecastCompletionIso,
    );
  const sourceRemainingDays =
    Number.isFinite(dataDate) &&
    Number.isFinite(sourceFinish)
      ? Math.max(
          1,
          (
            sourceFinish -
            dataDate
          ) /
            86_400_000,
        )
      : 1;
  const reviewLimit =
    Math.max(
      180,
      sourceRemainingDays *
        0.25,
    );

  if (
    Math.abs(variance) >
    reviewLimit
  ) {
    return (
      "Independent forecast is withheld from management comparison because its calendar and programme reconciliation checks have not passed. Review calendars, remaining durations, logic and constraints; the submitted finish remains visible."
    );
  }

  return null;
}

function buildSpecialistModuleFast(
  state: ProjectRuntimeState,
  key: string,
): ModuleRuntimeResult | null {
  if (
    !specialistFastModuleKeys.has(
      key,
    )
  ) {
    return null;
  }

  const cacheKey =
    state.projectId +
    "::specialist::" +
    key;
  const cached =
    specialistModuleCache.get(
      cacheKey,
    );
  if (
    cached &&
    cached.version ===
      state.version
  ) {
    return cached.result;
  }

  const current =
    projectControlSchedule(state);
  if (!current) {
    const delayModel =
      state.controls.delayClaims;
    if (
      delayModel &&
      (
        key === "delay-claims" ||
        key === "notices-claims"
      )
    ) {
      const generatedAt =
        calculationSnapshotTime(state);
      const claimPopulationQuarantined =
        claimsQuarantined(delayModel);
      const claimPopulationIntegrity =
        claimsIntegrity(delayModel);
      const linkedClaimCount =
        delayModel.claims.filter(
          claim =>
            claim.eventIds.length > 0,
        ).length;
      const unlinkedClaimCount =
        Math.max(
          0,
          delayModel.claims.length -
            linkedClaimCount,
        );

      let claimsOnlyResult:
        ModuleRuntimeResult;
      if (key === "delay-claims") {
        // Claims/events are valid evidence even when no programme has been
        // established. Build an empty schedule-window context so the register
        // remains usable, while withholding every schedule-derived conclusion.
        const emptyWindows =
          buildWindowsAnalysisProjection(
            [],
            delayModel,
            {
              generatedAt,
              producerVersion:
                "claims-without-programme:windows-v1",
            },
          );
        const projection =
          buildDelayClaimsProjection(
            emptyWindows,
            delayModel,
            {
              generatedAt,
              producerVersion:
                "claims-without-programme:delay-v1",
              populationEstablished: !claimPopulationQuarantined,
            },
          );
        const sourceActivityReferenceEventCount =
          projection.activityLinkedEventCount;
        claimsOnlyResult =
          available(
            key,
            {
              ...projection,
              // No programme population exists. These are unknown/not
              // established, not authoritative zeroes.
              windowCount: null,
              activityLinkedEventCount: null,
              windowLinkedEventCount: null,
              observedPositiveIndependentMovementDays:
                null,
              observedPositiveProgrammeMovementDays:
                null,
              projectCompletionMovementDays:
                null,
              projectCompletionMovementBasis:
                "unavailable",
              unattributedProgrammeMovementDays:
                null,
              employerOrNeutralCandidateWindowMovementDays:
                null,
              contractorRiskWindowMovementDays:
                null,
              concurrentReviewWindowMovementDays:
                null,
              contractorClaimEvidenceSubmitted:
                true,
              claimPopulationIntegrity,
              independentScheduleMovementAvailable:
                false,
              linkedClaimCount:
                claimPopulationQuarantined
                  ? null
                  : linkedClaimCount,
              unlinkedClaimCount:
                claimPopulationQuarantined
                  ? null
                  : unlinkedClaimCount,
              sourceActivityReferenceEventCount,
              programmeEvidenceState:
                "not_established",
              eventLinkageState:
                linkedClaimCount > 0
                  ? "claim_event_linked_programme_not_established"
                  : "not_established",
            },
            [
              "delay events",
              "claims",
              "programme for schedule movement and activity validation",
            ],
            "partial",
            claimPopulationQuarantined
              ? String(
                  claimPopulationIntegrity
                    ?.quarantinedClaimCount ??
                    delayModel.claims.length,
                ) +
                  " source claim rows are retained but quarantined. Programme evidence is also not established, so schedule attribution and EOT conclusions are withheld."
              : "Claim and event evidence is available. Programme movement, activity validation and delay-window attribution remain not established until a controlled programme is available.",
          );
      } else {
        const notices =
          buildNoticesClaimsProjection(
            delayModel,
            {
              generatedAt,
              producerVersion:
                "claims-without-programme:notices-v1",
              populationEstablished:
                !claimPopulationQuarantined,
            },
          );
        const noticeAssessmentAvailable =
          notices.eventCount !== null &&
          notices.eventCount > 0 &&
          delayModel
            .noticeRequirements
            .length > 0;
        const noticeAssessable =
          noticeAssessmentAvailable &&
          noticeComplianceAssessable(notices);
        claimsOnlyResult =
          available(
            key,
            {
              ...notices,
              contractorNoticeClaimEvidenceSubmitted:
                true,
              claimPopulationIntegrity,
              noticeAssessmentState:
                noticeAssessable
                  ? "assessed"
                  : noticeAssessmentAvailable
                    ? "partially_assessable"
                    : "not_assessable_without_delay_events_and_requirements",
              linkedClaimCount:
                claimPopulationQuarantined
                  ? null
                  : linkedClaimCount,
              unlinkedClaimCount:
                claimPopulationQuarantined
                  ? null
                  : unlinkedClaimCount,
              programmeEvidenceState:
                "not_established",
            },
            [
              "delay events",
              "notice requirements",
              "notices",
              "claims",
              "programme for schedule attribution",
            ],
            "partial",
            claimPopulationQuarantined
              ? "Claim/notice evidence is retained but quarantined. Notice and schedule conclusions are withheld until the population is independently verified."
              : noticeAssessable
                ? "Notice compliance is assessable from the governed event, requirement and notice evidence. Programme attribution is not established because no controlled programme is available."
                : "Claim/notice evidence remains visible. Complete notice assessment needs the missing event/requirement evidence; programme attribution separately requires a controlled programme.",
          );
      }

      specialistModuleCache.set(
        cacheKey,
        {
          version: state.version,
          result: claimsOnlyResult,
        },
      );
      return claimsOnlyResult;
    }
    return blocked(
      key,
      "Programme evidence has not been established.",
      ["schedule"],
    );
  }

  const generatedAt =
    calculationSnapshotTime(state);
  const model =
    current.revision.model;
  const scheduleControlBasis =
    projectScheduleControlBasis(state);
  const scheduleAnalysisConfig =
    scheduleControlBasis.analysisConfig;
  const ordered =
    analyticalHistory(state);
  const controlledBaseline =
    ordered
      .filter(
        (item) =>
          item.role ===
            "revised_baseline" ||
          item.role ===
            "baseline",
      )
      .at(-1) ??
    null;

  let result:
    ModuleRuntimeResult;

  if (
    key ===
      "progress-scurve"
  ) {
    const projection =
      buildProgressScurveProjection(
        model,
        {
          generatedAt,
          producerVersion:
            "progress-scurve-fast-v2",
          actualHistory:
            actualHistory(state),
          baselineModel:
            controlledBaseline
              ?.revision.model ??
            null,
        },
      );
    const actualHistoryEstablished =
      projection
        .actualHistoryMode ===
      "snapshot_history";
    result = available(
      key,
      projection,
      [
        "current programme",
        "controlled baseline",
        "progress history when available",
      ],
      actualHistoryEstablished
        ? "ready"
        : "partial",
      actualHistoryEstablished
        ? null
        : projection
              .actualHistoryMode ===
            "current_snapshot_only"
          ? "Only the current progress snapshot is available. CMeng does not draw a fabricated historical actual curve."
          : "Actual progress history has not been established.",
    );
  } else if (
    key ===
      "progress-breakdown"
  ) {
    const projection =
      buildProgressBreakdownProjection(
        model,
        {
      baselineModel: controlledBaseline?.revision.model ?? null,
      previousModel: ordered.at(-2)?.revision.model ?? null,
      scopeClassification: projectScopeClassification(state,model),
      readinessEvidence: state.controls.readinessEvidence,
          config: scheduleAnalysisConfig,
          generatedAt,
          producerVersion:
            "progress-breakdown-fast-v1",
        },
      );
    result = available(
      key,
      projection,
    );
  } else if (
    key ===
      "variance-trends"
  ) {
    const projection =
      buildVarianceTrendsProjection(
        ordered.map(
          (item) =>
            item.revision,
        ),
        {
          generatedAt,
          producerVersion:
            "variance-trends-fast-v2",
          config: scheduleAnalysisConfig,
          controlledBaselineRevision:
            controlledBaseline
              ?.revision ??
            null,
        },
      );
    result = available(
      key,
      {
        ...projection,
        revisionLabels:
          Object.fromEntries(
            ordered.map(
              (item) => [
                item.revision
                  .revisionId,
                item.revision
                  .label,
              ],
            ),
          ),
      },
      [
        "controlled schedule revision history",
      ],
      ordered.length >= 2 &&
      controlledBaseline !==
        null
        ? "ready"
        : "partial",
      controlledBaseline ===
        null
        ? "A controlled baseline is required before revision variance can be presented as baseline movement."
        : ordered.length < 2
          ? "A second controlled programme revision is required for a variance trend."
          : null,
    );
  } else if (
    key ===
      "resource-utilization" ||
    key ===
      "manhour-scurve"
  ) {
    const resources =
      state.resourcesByRevision.get(
        current.revision
          .revisionId,
      ) ??
      null;
    const hasAssignments =
      (
        resources
          ?.assignments.length ??
        0
      ) > 0;

    if (!resources ||
        !hasAssignments) {
      const scenarioContext =
        specialistChallengeContext(
          state,
          model,
          generatedAt,
        );
      const manpower =
        scenarioContext
          .delivery
          .manpowerChallenge;
      if (
        key ===
        "resource-utilization"
      ) {
        result = available(
          key,
          {
            schemaVersion:
              "1.0",
            projectionKey:
              "resource_utilization_scenario",
            generatedAt,
            producerVersion:
              "resource-utilization-fast-v2",
            projectId:
              state.projectId,
            sourceRevisionId:
              current.revision
                .revisionId,
            dataDateIso:
              model.dataDateIso,
            authority:
              "schedule_derived_scenario",
            submittedPlanAvailable:
              state
                .submittedManpowerPlan !==
              null,
            submittedAverageManpower:
              manpower
                .submittedAverageManpower,
            submittedPeakManpower:
              manpower
                .submittedPeakManpower,
            averageConcurrentWorkFronts:
              manpower
                .averageConcurrentWorkFronts,
            peakConcurrentWorkFronts:
              manpower
                .peakConcurrentWorkFronts,
            requiredAverageManpowerToContract:
              manpower
                .requiredAverageManpowerToContract,
            requiredAverageManpowerToContractorForecast:
              manpower
                .requiredAverageManpowerToContractorForecast,
            scheduleDerivedScenarios:
              manpower
                .scheduleDerivedScenarios,
            weeklyCapacityEvidence:
              weeklyResourceCapacityEvidence(
                state.evidenceDocuments,
                {
                  dataDateIso:
                    model.dataDateIso,
                },
              ),
            diagnostics: [
              "RESOURCE_ASSIGNMENTS_NOT_SUBMITTED_SCENARIO_DERIVED_FROM_WORKFRONTS",
            ],
          },
          [
            "current schedule",
            "resource assignments when available",
          ],
          "partial",
          "Resource assignments are not established. CMeng keeps schedule-derived crew scenarios separate from measured resource utilization.",
        );
      } else {
        const remainingDays =
          scenarioContext
            .delivery
            .scheduleChallenge
            .remainingDurationDays;
        result = available(
          key,
          {
            schemaVersion:
              "1.0",
            projectionKey:
              "manhour_scurve_scenario",
            generatedAt,
            producerVersion:
              "manhour-scurve-fast-v2",
            projectId:
              state.projectId,
            sourceRevisionId:
              current.revision
                .revisionId,
            dataDateIso:
              model.dataDateIso,
            actualHistoryMethod:
              "missing",
            submittedLaborAssignments:
              false,
            scenarios:
              manpower
                .scheduleDerivedScenarios
                .map(
                  (scenario) => ({
                    crewSize:
                      scenario.crewSize,
                    averageManpower:
                      scenario
                        .averageManpower,
                    peakManpower:
                      scenario
                        .peakManpower,
                    remainingScenarioHours:
                      remainingDays !==
                        null &&
                      remainingDays > 0 &&
                      scenario
                        .averageManpower !==
                        null
                        ? Number(
                            (
                              remainingDays *
                              scenario
                                .averageManpower *
                              8
                            ).toFixed(4),
                          )
                        : null,
                    basis:
                      "8 hours/person/day",
                    authority:
                      "schedule_derived_scenario",
                  }),
                ),
            diagnostics: [
              "LABOR_ASSIGNMENTS_NOT_SUBMITTED_MANHOUR_SCENARIO_ONLY",
            ],
          },
          [
            "current schedule",
            "labor assignments when available",
          ],
          "partial",
          "Labor assignments are not established. Any man-hour values shown are explicit schedule-derived scenarios, not measured history.",
        );
      }
    } else if (
      key ===
      "resource-utilization"
    ) {
      const projection =
        buildResourceUtilizationProjection(
          resources,
          model,
          {
            generatedAt,
            producerVersion:
              "resource-utilization-fast-v2",
          },
        );
      const weeklyCapacity =
        weeklyResourceCapacityEvidence(
          state.evidenceDocuments,
          {
            dataDateIso:
              model.dataDateIso,
          },
        );
      const capacityKnown =
        projection
          .capacityBasedResourceCount;
      const allCapacityKnown =
        projection
          .assignedResourceCount >
          0 &&
        capacityKnown ===
          projection
            .assignedResourceCount;
      const weeklyComparable =
        weeklyCapacity
          .comparableRowCount > 0;
      const governedWeeklyCapacity =
        weeklyCapacity.state ===
          "available" ||
        weeklyCapacity.state ===
          "partial";
      const effectiveCoverage =
        governedWeeklyCapacity &&
        weeklyCapacity
          .capacityCoveragePercent !==
          null
          ? weeklyCapacity
              .capacityCoveragePercent
          : projection
              .capacityCoveragePercent;
      const enriched = {
        ...projection,
        scheduleCapacityCoveragePercent:
          projection
            .capacityCoveragePercent,
        capacityCoveragePercent:
          effectiveCoverage,
        plannedUtilizationPercent:
          governedWeeklyCapacity
            ? weeklyCapacity
                .plannedUtilizationPercent
            : null,
        actualUtilizationPercent:
          governedWeeklyCapacity
            ? weeklyCapacity
                .actualUtilizationPercent
            : null,
        utilizationByUnit:
          governedWeeklyCapacity
            ? weeklyCapacity
                .utilizationByUnit
            : [],
        assessedOverloadResourceCount:
          capacityKnown,
        overloadAssessmentState:
          capacityKnown === 0 &&
          !weeklyComparable
            ? "not_assessable_per_hour"
            : allCapacityKnown ||
                weeklyCapacity.state ===
                  "available"
              ? "complete"
              : "partial",
        weeklyCapacityEvidence:
          weeklyCapacity,
      };
      result = available(
        key,
        enriched,
        [
          "resource assignments",
          "resource capacity",
        ],
        allCapacityKnown ||
        weeklyCapacity.state ===
          "available"
          ? "ready"
          : "partial",
        capacityKnown === 0
          ? weeklyComparable
            ? "Per-hour resource capacity is not established in the schedule resource model. Weekly capacity and demand evidence is shown separately without unsafe unit conversion."
            : "Resource assignments are available, but no usable capacity rate is established. Overload cannot be assessed and zero must not be inferred."
          : "Resource utilization is calculated only for resources with established capacity; the remaining resources stay demand-only.",
      );
    } else {
      const projection =
        buildManhourScurveProjection(
          resources,
          model,
          {
            generatedAt,
            producerVersion:
              "manhour-scurve-fast-v2",
          },
        );
      const actualHistoryComplete =
        projection
          .actualHistoryMethod ===
        "stored_financial_period_actuals";
      result = available(
        key,
        projection,
        [
          "labor assignments",
          "financial-period actuals when available",
        ],
        actualHistoryComplete
          ? "ready"
          : "partial",
        actualHistoryComplete
          ? null
          : projection
              .actualHistoryMethod ===
            "current_actual_snapshot_only"
            ? "Only a current labor-hours snapshot is available. CMeng does not reconstruct a historical actual S-curve from that single value."
            : "Actual labor-hour history is not established.",
      );
    }
  } else if (
    key ===
      "quantity-scurve"
  ) {
    result = canonicalQuantityModule(state, model, generatedAt);
  } else if (
    key ===
      "independent-forecast"
  ) {
    const forecast =
      cachedIndependentForecast(
        model,
        generatedAt,
      );
    const reviewReason =
      independentForecastReviewReason(
        forecast,
      );
    const forecastControl =
      forecastControlForState(
        state,
        model,
        forecast,
      );
    const finalReviewReason =
      reviewReason ??
      (
        forecastControl.gate.publishable
          ? null
          : forecastControl.gate.reason
      );
    const productivityForecast =
      sourceProductivityForecastEvidence(state);
    result = available(
      key,
      {
        ...forecast,
        sourceProductivityForecastCompletionIso:
          productivityForecast.completionIso,
        sourceProductivityForecastState:
          productivityForecast.state,
        sourceProductivityForecastMethod:
          productivityForecast.method,
        sourceProductivityForecastDriverWorkPackageId:
          productivityForecast.driverWorkPackageId,
        sourceProductivityForecastWorkPackageCount:
          productivityForecast.workPackageCount,
        sourceProductivityForecastCalculatedWorkPackageCount:
          productivityForecast.calculatedWorkPackageCount,
        sourceProductivityForecastCoveragePercent:
          productivityForecast.calculationCoveragePercent,
        sourceProductivityForecastReconciliation:
          productivityForecast.reconciliation,
        sourceProductivityForecastEvidence:
          productivityForecast,
        forecastTaxonomy:
          forecastControl.taxonomy,
        forecastReconciliationGate:
          forecastControl.gate,
        managementForecastCompletionIso:
          forecastControl.gate
            .managementForecastCompletionIso,
        managementReviewState:
          finalReviewReason
            ? "review_required"
            : "accepted_for_analysis",
        managementReviewReason:
          finalReviewReason,
      },
      [
        "current programme logic",
        "remaining durations",
        "source calendars",
      ],
      finalReviewReason
        ? "partial"
        : "ready",
      finalReviewReason,
    );
  } else if (
    key ===
      "forecast-history"
  ) {
    const snapshots =
      ordered.map(
        (stored) => {
          const cachedForecast =
            independentForecastCache.get(
              stored.revision
                .model,
            );
          return forecastSnapshotFromProjection(
            cachedForecast ??
              cachedIndependentForecast(
                stored.revision
                  .model,
                generatedAt,
              ),
            "forecast-" +
              stored.revision
                .revisionId,
            stored.revision.model,
          );
        },
      );
    const projection =
      buildForecastHistoryProjection(
        snapshots,
        {
          generatedAt,
          producerVersion:
            "forecast-history-fast-v2",
        },
      );
    const sourceForecastCount =
      projection.points.filter(
        (point) =>
          point
            .sourceForecastCompletionIso !==
          null,
      ).length;
    result = available(
      key,
      {
        ...projection,
        sourceForecastCount,
        revisionLabels:
          Object.fromEntries(
            ordered.map(
              (item) => [
                item.revision
                  .revisionId,
                item.revision
                  .label,
              ],
            ),
          ),
        historyState:
          projection.points.length >= 2
            ? "history_trend"
            : projection.points.length === 1
              ? "current_position_only"
              : "no_history",
      },
      [
        "controlled programme revision history",
      ],
      projection.points.length >= 2
        ? "ready"
        : "partial",
      projection.points.length >= 2
        ? null
        : projection.points.length === 1
          ? "Only one comparable programme revision exists. CMeng shows the current completion position, not a trend."
          : "No comparable programme revision is available for completion history.",
    );
  } else if (
    key ===
      "progress-report"
  ) {
    const scheduleAnalytics =
      buildScheduleAnalyticsProjection(
        model,
        {
          generatedAt,
          producerVersion:
            "progress-position:schedule-v1",
          config: scheduleAnalysisConfig,
        },
      );
    const milestones =
      buildMilestonesProjection(
        model,
        {
          review: milestoneReviewForProjection(state,model),
          config: scheduleAnalysisConfig,
          generatedAt,
          producerVersion:
            "progress-position:milestones-v1",
        },
      );
    const lookAhead =
      buildLookAheadProjection(
        model,
        {
        drivingActivityIds:cachedIndependentForecast(model,generatedAt).drivingNetwork?.activityIds,
          generatedAt,
          producerVersion:
            "progress-position:lookahead-v1",
          readinessEvidence:
            lookAheadReadinessWithProcurement(state,cachedIndependentForecast(model,generatedAt).drivingNetwork?.activityIds??[]),
        },
      );
    const progressScurve =
      buildProgressScurveProjection(
        model,
        {
          generatedAt,
          producerVersion:
            "progress-position:scurve-v2",
          actualHistory:
            actualHistory(state),
          baselineModel:
            controlledBaseline
              ?.revision.model ??
            null,
        },
      );
    const sourceForecast =
      cachedIndependentForecast(
        model,
        generatedAt,
      );
    const projection =
      buildProgressReportProjection({
        generatedAt,
        producerVersion:
          "progress-report-fast-v2",
        scheduleAnalytics,
        milestones,
        lookAhead,
        progressScurve,
        independentForecast:
          sourceForecast,
        progressEvidence: sourceProgressEvidence(state),
      });
    const externalProgressEstablished =
      projection.progressBases
        .contractorReported
        .valuePercent !== null ||
      projection.progressBases
        .certified
        .valuePercent !== null ||
      (
        projection.progressBases
          .physical
          .valuePercent !== null &&
        projection.progressBases
          .physical
          .authority ===
          "source_evidence"
      );

    result = available(
      key,
      {
        ...projection,
        independentForecastDeferred:
          true,
        scheduleSnapshotOnly:
          !externalProgressEstablished,
      },
      [
        "current programme",
        "controlled baseline",
        "progress evidence",
      ],
      externalProgressEstablished
        ? "ready"
        : "partial",
      externalProgressEstablished
        ? null
        : "Schedule-derived progress is available, but contractor-reported, certified or independently sourced physical progress is not established. The schedule snapshot is not treated as certified physical progress.",
    );
  } else if (
    key ===
      "windows-analysis" ||
    key ===
      "delay-claims" ||
    key ===
      "notices-claims" ||
    key ===
      "eot-assessment"
  ) {
    const delayModel =
      state.controls
        .delayClaims;
    const claimPopulationQuarantined=claimsQuarantined(delayModel);
    const claimPopulationIntegrity=claimsIntegrity(delayModel);
    const analyticalDelayModel:
      DelayClaimsModel =
      delayModel ?? {
        projectId:
          state.projectId,
        evidenceRevisionId:
          current.revision
            .revisionId,
        events: [],
        notices: [],
        claims: [],
        noticeRequirements: [],
        diagnostics: [
          "DELAY_CLAIM_EVIDENCE_NOT_SUBMITTED",
        ],
      };

    const context = claimsFastContext(
      state,
      ordered,
      current,
      generatedAt,
    );
    if (
      key ===
      "notices-claims"
    ) {
      const notices = context.notices;
      const linkedClaimCount =
        analyticalDelayModel
          .claims.filter(
            (claim) =>
              claim.eventIds
                .length > 0,
          ).length;
      const unlinkedClaimCount =
        analyticalDelayModel
          .claims.length -
        linkedClaimCount;
      const noticeAssessmentAvailable =
        notices.eventCount !== null && notices.eventCount > 0 &&
        analyticalDelayModel
          .noticeRequirements
          .length > 0;
      const noticeAssessable =
        noticeAssessmentAvailable &&
        noticeComplianceAssessable(notices);

      result = available(
        key,
        {
          ...notices,
          contractorNoticeClaimEvidenceSubmitted:
            delayModel !== null,
          claimPopulationIntegrity,
          noticeAssessmentState:
            noticeAssessable
              ? "assessed"
              : noticeAssessmentAvailable
                ? "partially_assessable"
                : "not_assessable_without_delay_events_and_requirements",
          linkedClaimCount:delayModel&&!claimPopulationQuarantined?linkedClaimCount:null,
          unlinkedClaimCount:delayModel&&!claimPopulationQuarantined?unlinkedClaimCount:null,
          delayEotEvidenceChain: context.delayEotEvidenceChain,
          contextualProgrammeIntelligence: context.delayEotEvidenceChain.programmeContext,
        },
        [
          "delay events",
          "notice requirements",
          "notices",
          "claims",
        ],
        noticeAssessable&&!claimPopulationQuarantined
          ? "ready"
          : "partial",
        claimPopulationQuarantined
          ? claimPopulationIntegrity!.quarantinedClaimCount+" source claim rows are quarantined by the integrity gate. Notice compliance is withheld for that population until the source is independently verified."
          : noticeAssessable
            ? null
            : noticeAssessmentAvailable && notices.noticeRequirementMissingCount !== null &&
              notices
                .noticeRequirementMissingCount >
                0
            ? notices
                .noticeRequirementMissingCount +
              " confirmed delay event(s) do not have an applicable notice requirement. Assessed events remain visible, but the page stays under review."
            : notices.claimCount !== null && notices.claimCount > 0
              ? notices.claimCount +
                " claim records are available, but notice timeliness is not assessable until confirmed delay events and applicable notice requirements are linked."
              : "Notice compliance is not assessable until confirmed delay events, applicable notice requirements and actual notice evidence are established.",
      );
    } else {
      const windows =
        context.windows;
      const delay =
        context.delay;
      const linkedClaimCount =
        context.linkedClaimCount;
      const unlinkedClaimCount =
        context.unlinkedClaimCount;

      if (
        key ===
        "windows-analysis"
      ) {
        result = available(
          key,
          {
            ...windows,
            movementPresentationBasis:
              "source_forecast_then_schedule_boundary",
            revisionLabels:
              context.revisionLabels,
            delayEotEvidenceChain: context.delayEotEvidenceChain,
            contextualProgrammeIntelligence: context.delayEotEvidenceChain.programmeContext,
          },
          [
            "controlled programme revision history",
          ],
          delayModel &&
          delayModel.events.length >
            0
            ? "ready"
            : "partial",
          delayModel &&
          delayModel.events.length >
            0
            ? null
            : "Programme movement is calculated from controlled programme revisions, but causation remains un-attributed because no linked delay-event population is established.",
        );
      } else if (
        key ===
        "delay-claims"
      ) {
        result = available(
          key,
          {
            ...delay,
            contractorClaimEvidenceSubmitted:
              delayModel !==
              null,
            claimPopulationIntegrity,
            linkedClaimCount:claimPopulationQuarantined?null:linkedClaimCount,
            unlinkedClaimCount:claimPopulationQuarantined?null:unlinkedClaimCount,
            eventLinkageState:
              delay.events.length >
                0 &&
              linkedClaimCount !== null && linkedClaimCount > 0
                ? "linked"
                : "not_established",
            revisionLabels:
              context.revisionLabels,
            delayEotEvidenceChain: context.delayEotEvidenceChain,
            contextualProgrammeIntelligence: context.delayEotEvidenceChain.programmeContext,
          },
          [
            "schedule windows",
            "delay events",
            "claim-event linkage",
          ],
          !claimPopulationQuarantined&&
          delay.events.length > 0 &&
          linkedClaimCount !== null && linkedClaimCount > 0
            ? "ready"
            : "partial",
          claimPopulationQuarantined
            ? claimPopulationIntegrity!.quarantinedClaimCount+" source claim rows are retained but quarantined because their population matches a generated sequential pattern with no schedule linkage. They do not feed delay attribution, EOT, portfolio or Ask CMeng counts."
            : analyticalDelayModel
                .claims.length >
              0 &&
              delay.events.length === 0
              ? analyticalDelayModel
                  .claims.length +
                " claim records are available, but no confirmed delay events are established. Programme movement cannot be attributed to those claims."
              : linkedClaimCount === 0
                ? "Claim records are not linked to confirmed delay events, so causation and entitlement remain unassessed."
                : null,
        );
      } else {
        const eot =
          state.controls
            .contractTimeBasis
            ? buildEotAssessmentProjection(
                windows,
                delay,
                state.controls
                  .contractTimeBasis,
                {
                  generatedAt,
                  producerVersion:
                    "eot-assessment-fast-v3",
                },
              )
            : {
                schemaVersion:
                  "1.0" as const,
                projectionKey:
                  "eot_assessment" as const,
                generatedAt,
                producerVersion:
                  "eot-assessment-fast-v3",
                projectId:
                  state.projectId,
                contractualCompletionIso:
                  null,
                contractualCompletionState:
                  "missing" as const,
                officialApprovedEotDays:
                  null,
                officialApprovedEotState:
                  "missing" as const,
                officialAdjustedCompletionIso:
                  null,
                observedProgrammeMovementDays:
                  windows
                    .positiveProgrammeMovementDays,
                projectCompletionMovementDays:
                  windows
                    .projectCompletionMovementDays,
                projectCompletionMovementBasis:
                  windows
                    .projectCompletionMovementBasis,
                analyticalTimeImpactCandidateDays:
                  null,
                attributableCandidateEotDays:
                  null,
                unattributedTimeImpactDays:
                  windows
                    .positiveProgrammeMovementDays,
                candidateAdditionalEotDays:
                  null,
                scenarioAdjustedCompletionIso:
                  null,
                timeImpactScenarioAdjustedCompletionIso:
                  null,
                eotDayBasis:
                  "unknown" as const,
                eotDayBasisState:
                  "missing" as const,
                includedWindowCount:
                  0,
                excludedWindowCount:
                  0,
                reviewWindowCount:
                  windows
                    .windowCount,
                windowCandidates:
                  windows.windows.map(
                    (window) => ({
                      windowId:
                        window
                          .windowId,
                      positiveIndependentMovementDays: window.independentForecastMovementDays===null?null:Math.max(0,window.independentForecastMovementDays),
                      positiveProgrammeMovementDays: window.netCompletionMovementDays===null?null:Math.max(0,window.netCompletionMovementDays),
                      programmeMovementBasis:
                        window
                          .netCompletionMovementBasis,
                      analyticalTimeImpactCandidateDays:
                        null,
                      state:
                        "review" as const,
                      eligibleEventIds:
                        [],
                      contractorEventIds:
                        [],
                      reasons: [
                        "CONTRACT_TIME_BASIS_NOT_SUBMITTED",
                        "CAUSAL_DELAY_EVENT_BASIS_NOT_ESTABLISHED",
                      ],
                      assumptions:
                        [],
                      includedCandidateDays:
                        0,
                    }),
                  ),
                basis:
                  "analytical_candidate_not_contractual_determination" as const,
                assumptions: [
                  "Observed programme movement is not an EOT entitlement or time-impact candidate without confirmed contract and event causation evidence.",
                ],
                diagnostics: [
                  "CONTRACT_TIME_BASIS_NOT_SUBMITTED",
                ],
              };
        const hasCausalEvents =
          analyticalDelayModel
            .events.length > 0;
        const contractBasis =
          state.controls
            .contractTimeBasis;
        const contractReady =
          contractBasis !==
            null &&
          contractBasis
            .contractualCompletionIso !==
            null &&
          contractBasis
            .contractualCompletionState !==
            "missing" &&
          contractBasis
            .eotDayBasis !==
            "unknown" &&
          contractBasis
            .eotDayBasisState !==
            "missing";
        const eligibleCausalEvents =
          eot.windowCandidates.some(
            (window) =>
              window
                .eligibleEventIds
                .length > 0,
          );
        const analyticalSupport =
          contractReady &&
          hasCausalEvents &&
          eligibleCausalEvents;

        const governedEot =
          analyticalSupport
            ? eot
            : {
                ...eot,
                analyticalTimeImpactCandidateDays:
                  null,
                attributableCandidateEotDays:
                  null,
                candidateAdditionalEotDays:
                  null,
                scenarioAdjustedCompletionIso:
                  null,
                timeImpactScenarioAdjustedCompletionIso:
                  null,
                includedWindowCount:
                  0,
                reviewWindowCount:
                  eot.windowCandidates
                    .length,
                windowCandidates:
                  eot.windowCandidates.map(
                    (window) => ({
                      ...window,
                      analyticalTimeImpactCandidateDays:
                        null,
                      includedCandidateDays:
                        0,
                      state:
                        "review" as const,
                      reasons: [
                        ...new Set([
                          ...window.reasons,
                          ...(!contractReady
                            ? [
                                "CONTRACT_TIME_BASIS_NOT_ESTABLISHED",
                              ]
                            : []),
                          ...(!hasCausalEvents
                            ? [
                                "CAUSAL_DELAY_EVENT_BASIS_NOT_ESTABLISHED",
                              ]
                            : []),
                          ...(hasCausalEvents &&
                          !eligibleCausalEvents
                            ? [
                                "NO_EOT_ELIGIBLE_CAUSAL_EVENT_ESTABLISHED",
                              ]
                            : []),
                        ]),
                      ],
                    }),
                  ),
              };

        result = available(
          key,
          {
            ...governedEot,
            contractorEotEvidenceSubmitted:
              delayModel !==
              null,
            causalEventEvidenceEstablished:
              hasCausalEvents,
            eligibleCausalEventEvidenceEstablished:
              eligibleCausalEvents,
            contractTimeBasisEstablished:
              contractReady,
            delayEotEvidenceChain:
              context.delayEotEvidenceChain,
            contextualProgrammeIntelligence:
              context.delayEotEvidenceChain.programmeContext,
            revisionLabels:
              context.revisionLabels,
          },
          [
            "contract time basis",
            "schedule windows",
            "causal delay events",
          ],
          analyticalSupport
            ? "ready"
            : "partial",
          !contractReady
            ? "Observed programme movement is shown separately, but a contractual EOT position cannot be calculated without an established contract finish and EOT day basis."
            : !hasCausalEvents
              ? "Observed programme movement is shown separately, but no EOT time-impact candidate is stated because causal delay events are not established."
              : !eligibleCausalEvents
                ? "Delay events exist, but no EOT-eligible employer/neutral causal event is established for the observed movement."
                : null,
        );
      }
    }
  } else if (
    key ===
      "challenge-contract"
  ) {
    const sourceForecast =
      cachedIndependentForecast(
        model,
        generatedAt,
      );
    const resources =
      state.resourcesByRevision.get(
        current.revision
          .revisionId,
      ) ??
      null;
    const delivery =
      buildDeliveryChallengeProjection({
      sourceProductivityForecast:sourceProductivityForecastEvidence(state),
        generatedAt,
        producerVersion:
          "delivery-challenge-fast-v2",
        schedule: model,
        quantities: state.quantities,
        quantityMapping: quantityMappingForState(state, model),
        resources:
          resources &&
          resources.assignments
            .length > 0
            ? resources
            : null,
        independentForecast:
          sourceForecast,
        contractTimeBasis:
          state.controls
            .contractTimeBasis,
        submittedManpowerPlan:
          state.submittedManpowerPlan,
      });
    const contractIntelligence =
      contractChallengeForState(state,generatedAt);
    const contractValueExtraction =
      state.contract
        ? extractContractValue(
            state.contract,
          )
        : null;

    result = available(
      key,
      {
        schemaVersion:
          "2.0",
        projectionKey:
          "challenge_contract",
        generatedAt,
        producerVersion:
          "challenge-contract-fast-v2",
        deliveryChallenge:
          delivery,
        contractIntelligence,
        contractValueEvidence: {
          governed:
            state.controls
              .contractValue,
          extraction:
            contractValueExtraction,
          state:
            state.controls
              .contractValue
              ? "governed"
              : contractValueExtraction
                    ?.state ===
                  "candidate"
                ? "candidate"
                : contractValueExtraction
                      ?.state ===
                    "conflicted"
                  ? "conflicted"
                  : "missing",
          note:
            state.controls
              .contractValue
              ? "Confirmed contract value is established."
              : "Contract value evidence remains ungoverned until confirmed.",
        },
        independentForecastState: independentForecastReviewReason(sourceForecast) ? "review_required" : "calculated",
        independentForecastReviewReason: independentForecastReviewReason(sourceForecast),
      },
      [
        "current programme",
        "contract",
        "resource and quantity evidence when available",
      ],
      (
        delivery.position !==
          "not_yet_supportable" &&
        delivery.position !==
          "scenario_only"
      )
        ? "ready"
        : "partial",
      delivery.position ===
            "scenario_only"
          ? "Delivery challenge contains scenarios because measured manpower/productivity evidence is incomplete. Scenario values are not treated as project facts."
          : delivery.position ===
              "not_yet_supportable"
            ? "Delivery challenge cannot yet be supported by the available measured evidence."
            : null,
    );
  } else {
    return null;
  }

  const challengeContext =
    specialistChallengeContext(
      state,
      model,
      generatedAt,
    );
  const challengeModules =
    new Map<
      string,
      ModuleRuntimeResult
    >([
      [key, result],
    ]);
  applyUniversalModuleChallenges({
    state,
    generatedAt,
    model,
    independentForecast:
      key ===
        "independent-forecast" &&
      result.data &&
      typeof result.data ===
        "object" &&
      "projectionKey" in
        result.data
        ? result.data as ReturnType<
            typeof buildIndependentForecastProjection
          >
        : challengeContext
            .forecast,
    deliveryChallenge:
      challengeContext
        .delivery,
    modules:
      challengeModules,
  });
  result =
    challengeModules.get(key) ??
    result;

  specialistModuleCache.set(
    cacheKey,
    {
      version:
        state.version,
      result,
    },
  );
  return result;
}

export function applyProfessionalModuleState(
  result: ModuleRuntimeResult,
): ModuleRuntimeResult {
  if (
    result.status === "blocked" ||
    result.data === null
  ) {
    return {
      ...result,
      engineState:
        result.engineState ??
        "blocked",
      evidenceState:
        result.evidenceState ??
        "missing",
      professionalState:
        "not_defensible",
      status: "blocked",
    };
  }

  const data = result.data as any;
  let evidenceState =
    result.evidenceState ??
    (
      result.status === "ready"
        ? "established"
        : "partial"
    );
  let professionalState =
    result.professionalState ??
    (
      result.status === "ready"
        ? "defensible"
        : "review_required"
    );
  let reason = result.reason;

  const review = (
    message: string,
    state:
      | "partial"
      | "missing" =
      "partial",
  ) => {
    evidenceState = state;
    professionalState =
      state === "missing"
        ? "not_defensible"
        : "review_required";
    reason = message;
  };

  if (
    result.key === "progress-report"
  ) {
    const bases =
      data?.progressBases;
    const externalEstablished =
      bases?.contractorReported
        ?.valuePercent !== null &&
      bases?.contractorReported
        ?.valuePercent !== undefined ||
      bases?.certified
        ?.valuePercent !== null &&
      bases?.certified
        ?.valuePercent !== undefined ||
      (
        bases?.physical
          ?.valuePercent !== null &&
        bases?.physical
          ?.valuePercent !== undefined &&
        bases?.physical
          ?.authority ===
          "source_evidence"
      );
    if (!externalEstablished) {
      review(
        "Schedule-derived progress is available, but contractor-reported, certified or independently sourced physical progress is not established. The schedule snapshot is not treated as certified physical progress.",
      );
    }
  }

  if (
    result.key === "delay-claims"
  ) {
    const eventCount = typeof data.eventCount === 'number' && Number.isFinite(data.eventCount) && data.eventCount >= 0 ? data.eventCount : null;
    const activityLinked = typeof data.activityLinkedEventCount === 'number' && Number.isFinite(data.activityLinkedEventCount) && data.activityLinkedEventCount >= 0 ? data.activityLinkedEventCount : null;
    if (eventCount === null || activityLinked === null) review('Delay event or activity-link population is not established; missing records cannot be reported as zero.');
    if (
      eventCount !== null && activityLinked !== null && eventCount > 0 &&
      activityLinked < eventCount
    ) {
      review(
        String(activityLinked) +
          " of " +
          String(eventCount) +
          " delay events are linked to confirmed schedule activities; causation is not fully defensible.",
      );
    }
  }

  if (
    result.key === "notices-claims"
  ) {
    const assessmentState =
      data?.noticeAssessmentState ??
      null;
    const statedMissing = data?.noticeRequirementMissingCount;
    const requirementMissing = typeof statedMissing === 'number' && Number.isFinite(statedMissing) && statedMissing >= 0 ? statedMissing : null;
    if (
      assessmentState !==
        "assessed" ||
      requirementMissing === null || requirementMissing > 0
    ) {
      review(
        requirementMissing !== null && requirementMissing > 0
          ? String(
              requirementMissing,
            ) +
              " delay event(s) do not have a confirmed applicable notice requirement; assessed events remain visible but the page is only partially assessable."
          : "Notice compliance is not assessable as a complete population until confirmed delay events, applicable notice requirements and actual notice dates are established.",
      );
    }
  }

  if (
    result.key === "payments"
  ) {
    const register =
      data?.focus?.paymentRegister ??
      data?.position?.foundation
        ?.paymentRegister ??
      null;
    const rawCount = register?.recordCount;
    const count = typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : null;
    if (count === null) review('Payment register population is not established; absence of records cannot be represented as zero payments.');
    const coverage =
      register
        ?.stageCoveragePercent ??
      null;
    if (
      count !== null && count > 0 &&
      coverage !== 100
    ) {
      review(
        "Payment lifecycle dates are incomplete; overdue and late-payment outcomes are not fully assessable.",
      );
    }
  }

  if (
    result.key === "cash-flow"
  ) {
    const currencies =
      data?.focus
        ?.cashFlowRegister
        ?.currencies ??
      data?.position
        ?.performance
        ?.cashFlow
        ?.currencies ??
      [];
    const cashReady =
      currencies.length > 0 &&
      currencies.every(
        (row: any) =>
          row.sourceReadiness
            ?.netCashReady ===
          true,
      );
    if (!cashReady) {
      review(
        "Dated cash receipts and expenditure evidence are incomplete; current cash position remains withheld.",
      );
    }
  }

  if (
    result.key ===
    "variations-change"
  ) {
    const control =
      data?.focus
        ?.variationControl ??
      null;
    // Schedule, claim and payment links are conditional relationships, not
    // universal prerequisites for a valid variation register. A pending change
    // can be professionally established before a claim or payment exists.
    // Keep linkage coverage visible, but gate readiness on the variation
    // lifecycle/authority itself rather than forcing every optional link to 100%.
    if (
      control &&
      control.state !==
        "established"
    ) {
      review(
        "Variation lifecycle or authority is incomplete; review the unresolved current variation stages before relying on the control position.",
      );
    }
  }

  if (
    result.key ===
    "eot-assessment"
  ) {
    if (
      data
        ?.officialAdjustedCompletionIso ===
        null ||
      data
        ?.officialAdjustedCompletionIso ===
        undefined
    ) {
      review(
        "Further completion adjustment after the current amended contract date is not established; determination overlap and causal entitlement require reconciliation.",
      );
    }
  }

  if (
    result.key ===
    "challenge-contract"
  ) {
    const contractIntelligence =
      data?.contractIntelligence ??
      null;
    const deliveryPosition =
      data?.deliveryChallenge
        ?.position ??
      null;
    if (
      data?.independentForecastState === "review_required" ||
      data?.deliveryChallenge?.findings?.some((finding: any) => ["missing_evidence", "scenario"].includes(finding.state)) ||
      deliveryPosition ===
        "not_yet_supportable" ||
      deliveryPosition ===
        "scenario_only"
    ) {
      review(
        deliveryPosition ===
                "scenario_only"
            ? "Delivery challenge contains programme-derived scenarios because measured manpower/productivity evidence is incomplete; scenario values are not project facts."
            : deliveryPosition ===
                  "not_yet_supportable"
              ? "The delivery challenge cannot yet be supported by the available measured evidence."
              : "The delivery comparison has unresolved quantity, productivity, resource or calendar evidence.",
      );
    }
  }

  if (result.key === "cost-forecast") {
    const position = data?.position;
    const cost = position?.performance?.costControl;
    const conflicts = (position?.sourceLedger?.costPosition ?? []).some((row: any) => (row.diagnostics ?? []).some((issue: string) => /CONFLICT|UNRESOLVED/.test(issue)));
    if (conflicts || cost?.state !== "established" || position?.foundation?.costRegister?.mappingCoveragePercent !== 100) {
      review((position?.sourceLedger?.costPosition ?? []).length
        ? "Cost snapshots are available, but reconciliation, source authority or CBS mapping requires review. A single observation does not establish a trend."
        : "Cost snapshots are not established. Supply dated EVM inputs with a compatible currency, tax basis and measurement population before calculating cost performance.");
    }
  }

  if (
    result.key ===
    "commercial-overview"
  ) {
    const position =
      data?.position ?? null;
    const evidence =
      position?.evidence ?? null;
    const currencies =
      Array.isArray(
        position?.currencies,
      )
        ? position.currencies
        : [];
    const incompleteEvidence =
      [
        evidence?.payments,
        evidence?.claims,
        evidence?.bonds,
      ].some(
        (state) =>
          state !== undefined &&
          state !== "established" &&
          state !== "not_applicable",
      );
    const incompleteMoney =
      currencies.some(
        (row: any) =>
          [
            row.grossCertifiedAmount,
            row.paidAmount,
            row.retentionHeldAmount,
            row.claimedAmount,
            row.activeBondAmount,
          ].some(
            (finding: any) =>
              finding &&
              finding.value === null &&
              finding.state !==
                "not_applicable",
          ),
      );
    if (
      incompleteEvidence ||
      incompleteMoney
    ) {
      review(
        "Contract-value reconciliation, certification, payment, held-retention, claim or security evidence requires review; source availability does not establish the integrated commercial position.",
      );
    }
  }

  if (
    result.key ===
    "commercial-claims-notices"
  ) {
    const claims =
      data?.position
        ?.claimsNotices ??
      data?.focus
        ?.claimsNotices ??
      null;
    if (claims) {
      const noticeCounts =
        claims
          .noticeTimelinessCounts ??
        {};
      // Missing document facts never establish a valid zero.
      const countNames = [
        "requirement_missing", "event_date_missing", "notice_date_missing",
      ] as const;
      const rawCounts = countNames.map((key) => noticeCounts[key]);
      const noticeEvidenceGaps = rawCounts.every(
        (value: unknown) => typeof value === "number" &&
          Number.isSafeInteger(value) && value >= 0,
      ) ? (rawCounts as number[]).reduce((total, value) => total + value, 0) : null;
      const lifecycleCount =
        typeof claims.lifecycleClaimCount === "number" &&
        Number.isSafeInteger(claims.lifecycleClaimCount) &&
        claims.lifecycleClaimCount >= 0 ? claims.lifecycleClaimCount as number : null;
      const commercialCount =
        typeof claims.commercialClaimCount === "number" &&
        Number.isSafeInteger(claims.commercialClaimCount) &&
        claims.commercialClaimCount >= 0 ? claims.commercialClaimCount as number : null;
      const moneyLinkGap = lifecycleCount !== null && lifecycleCount > 0 &&
        (commercialCount === null ||
          claims.commercialLifecycleLinkCoveragePercent !== 100 ||
          commercialCount < lifecycleCount);
      if (lifecycleCount === null || moneyLinkGap ||
          noticeEvidenceGaps === null || noticeEvidenceGaps > 0) {
        review(
          lifecycleCount === null
            ? "Claim lifecycle population is not established; Financial Claims remains under review."
            : moneyLinkGap
              ? (commercialCount === null ? "Not established" : String(commercialCount)) +
                " of " + String(lifecycleCount) +
                " lifecycle claims have confirmed commercial-money linkage; Financial Claims requires review of its money linkage."
              : noticeEvidenceGaps === null
                ? "Notice requirement, event-date or notice-date counts are not established; Financial Claims cannot report zero evidence gaps."
                : String(noticeEvidenceGaps) +
                  " notice assessment(s) are missing a confirmed requirement, event date or notice date; Financial Claims remains under review.",
        );
      }
    }
  }

  if (
    result.key ===
    "contract-particulars-bonds"
  ) {
    const bonds =
      data?.focus
        ?.bondsInsurance ??
      null;
    if (
      bonds &&
      bonds.state !==
        "established"
    ) {
      review(
        "Contract terms may be available, but the bond/security or insurance evidence basis is incomplete.",
      );
    }
  }

  return {
    ...result,
    engineState:
      result.engineState ??
      "ready",
    evidenceState,
    professionalState,
    status:
      professionalState ===
        "defensible"
        ? "ready"
        : professionalState ===
            "review_required"
          ? "partial"
          : "blocked",
    reason,
  };
}

function resolveProjectModuleUncertified(
  state: ProjectRuntimeState,
  key: string,
): ModuleRuntimeResult {
  if(key==='scope-classification'){
    const current=projectControlSchedule(state);
    if(!current)return blocked(key,'Select an adopted reporting programme to establish schedule scope classifications.',['adopted programme']);
    const classification=projectScopeClassification(state,current.revision.model);
    const materiallyClassified=classification.coverage.filter(row=>!['wbsId','wbsPath','wbsLevel'].includes(String(row.key))&&row.classified>0);
    return {key,status:'ready',engineState:'ready',evidenceState:'established',professionalState:'defensible',reason:null,dependencies:['adopted programme','source WBS/activity text'],
      data:{projectionKey:'scope_classification',schemaVersion:'1.0',projectId:state.projectId,sourceRevisionId:current.revision.revisionId,dataDateIso:current.revision.model.dataDateIso,
        ...classification,dimensionGroups:scopeClassificationGroups(classification),classificationState:classification.rows.some(row=>row.classificationBasis.location==='user_reviewed')?'reviewed_location_mapping':materiallyClassified.length?'source_derived_available':'wbs_only',
        basis:'Classifications retain explicit source WBS/activity readings. Location grouping can additionally use an explicitly reviewed WBS mapping, labelled user reviewed on each affected row. These classifications support filtering and do not establish master data or contractual authority.'}};
  }
  const sourceResource = canonicalResourceModule(state, key) ?? canonicalCommercialModule(state, key);
  if (sourceResource) {
    const current = projectControlSchedule(state);
    if (!current) return applyProfessionalModuleState(sourceResource);
    const generatedAt = calculationSnapshotTime(state);
    const context = specialistChallengeContext(state, current.revision.model, generatedAt);
    const modules = new Map([[key, sourceResource]]);
    applyUniversalModuleChallenges({state, generatedAt, model:current.revision.model,
      independentForecast:context.forecast, deliveryChallenge:context.delivery, modules});
    return applyProfessionalModuleState(
      modules.get(key) ??
        sourceResource,
    );
  }

  const planning =
    buildPlanningModuleFast(
      state,
      key,
    );
  if (planning) {
    return applyProfessionalModuleState(
      planning,
    );
  }

  const specialist =
    buildSpecialistModuleFast(
      state,
      key,
    );
  if (specialist) {
    return applyProfessionalModuleState(
      specialist,
    );
  }

  const bundle =
    buildBundle(state);
  return applyProfessionalModuleState(
    bundle.modules.get(key) ??
      blocked(
        key,
        "Unknown Schedule module.",
        [],
      ),
  );
}

function resolveProjectModuleCandidate(
  state: ProjectRuntimeState,
  key: string,
  precomputed?: ModuleRuntimeResult,
  sharedFloatReview?: ReturnType<typeof activityFloatReconciliation>,
  sharedInterpretation?: ReturnType<typeof sourceInterpretation>,
  alreadyScoped = false,
): ModuleRuntimeResult {
  state = alreadyScoped ? state : reportingState(state);
  const readIssues=registerReadIssuesForModule(state,key);
  // A rejected register withholds its count, not the independently established
  // contract date, current claim cohort or shared commercial position.
  const discloseReadIssues=(value:ModuleRuntimeResult):ModuleRuntimeResult=>readIssues.length?{
    ...value,status:'partial',professionalState:'review_required',
    reason:readIssues.map(r=>r.filename+': '+r.message).join('; '),
    data:{...(value.data&&typeof value.data==='object'?value.data:{}),state:'unresolved',recordCount:null,registerReadIssues:readIssues},
  }:value;
  // If the canonical full bundle has already been built for this project
  // version, reuse its exact module calculation. Fast builders exist for isolated
  // single-module reads; rerunning them here duplicates the same schedule work.
  const baseResult=precomputed
    ? applyProfessionalModuleState(precomputed)
    : resolveProjectModuleUncertified(state,key);
  const result:ModuleRuntimeResult={...baseResult,
    data:baseResult.data&&typeof baseResult.data==='object'?{...(baseResult.data as Record<string,unknown>)}:baseResult.data};
  if(key==='challenge-contract'||key==='quantity-scurve'){
    const suppliedBoq=suppliedBoqFigures(state.boq,state.quantities);
    result.data={...(result.data&&typeof result.data==='object'?result.data:{}),suppliedBoq};
    if(key==='challenge-contract'&&suppliedBoq.itemCount&&result.status==='blocked'){
      result.status='partial';result.engineState='ready';result.evidenceState='partial';result.professionalState='review_required';
      result.reason='Supplied BOQ figures are available. Manpower and duration calculations need the missing schedule and production inputs.';
    }
  }
  const model = projectControlSchedule(state)?.revision.model;
  if (!model) {
    const data=result.data&&typeof result.data==='object'?result.data as Record<string,unknown>:{};
    const challenge=data.challenge??buildModuleChallenge({moduleKey:key,generatedAt:calculationSnapshotTime(state),assertions:[],metrics:[],diagnostics:['Programme comparison unavailable until a programme is adopted.']});
    const enriched={...result,data:{...data,challenge}};
    if(enriched.data&&typeof enriched.data==='object'){
      (enriched.data as any).featureAvailability=moduleFeatureAvailability(key,enriched.data);
    }
    return attachReportingContract(state,discloseReadIssues(enriched));
  }
  const controlBasis = projectScheduleControlBasis(state);
  if (result.data && typeof result.data === "object") {
    const data = result.data as Record<string, any>;
    const time = canonicalTimeClaims(state);
    const forecast = ["milestones", "independent-forecast", "near-critical", "schedule-analytics"].includes(key) ? cachedIndependentForecast(model, calculationSnapshotTime(state)) : null;
    const forecastReview = forecast ? independentForecastReviewReason(forecast) : null;
    const laborEvidence=['challenge-contract','cost-forecast','progress-report'].includes(key)?canonicalResourceModule(state,'manhour-scurve')?.data as any:null;
    const contractReview = ['challenge-contract','cost-forecast','commercial-overview','contract-particulars-bonds'].includes(key) ? contractValueBasisReview(state) : null;
    result.data = { ...data, controlBasis, scheduleAuthorityReview:scheduleAuthorityReview(state),
      ...(['pmo-analysis','schedule-analytics','activity-analytics','near-critical','milestones','progress-report','progress-breakdown','revision-trend','scope-classification'].includes(key)?{nearCriticalScreening:nearCriticalScreening(state)}:{}),
      ...(forecast?{scheduleBasisReview:scheduleBasisReview(model,forecast,time.contractTimeBasis?.contractualCompletionIso??null)}:{}),
      ...(['variance-trends','schedule-change-report'].includes(key)?{durationEditReview:(()=>{const first=analyticalHistory(state)[0]?.revision.model;return first&&first!==model?durationEditReview(first,model):null;})()}:{}),
      ...(['quantity-scurve','independent-forecast','challenge-contract'].includes(key)?{quantityBasisReview:quantityBasisReview(state)}:{}),
      ...(contractReview ? { contractValueBasisReview: contractReview, ...(data.contractValueEvidence ? {contractValueEvidence: { ...data.contractValueEvidence, extractionScope: 'original_contract_only', currentSource: contractReview.current, currentSourceState: contractReview.state, note: 'The original-contract extraction is historical. Read currentSource for the explicit value from the contract version effective at the data date; formal approval remains separate.' }} : {}) } : {}),
      ...(laborEvidence?{basisComparison:laborEvidence.basisComparison}:{}),
      ...(['pmo-analysis','schedule-analytics','independent-forecast','challenge-contract'].includes(key)?{
        calendarBasisReview:(()=>{const review=reviewScheduleCalendarBasis(model);return {...review,rows:key==='independent-forecast'?review.rows:undefined};})(),
        sourceProductivityForecast:(()=>{const p=sourceProductivityForecastEvidence(state);return {completionIso:p.completionIso,state:p.state,method:p.method,workPackageCount:p.workPackageCount,coveragePercent:p.calculationCoveragePercent,driverWorkPackageIds:p.driverWorkPackageIds,concentration:p.concentration,sourceRefs:p.sourceRefs};})(),
      }:{}),
      ...(key==='contract-particulars-bonds'?{contractSourceContext:contractChallengeForState(state,calculationSnapshotTime(state))}:{}),
      ...(key==='challenge-contract'?{recoveryScenario:recoveryScenarioForState(state),boqFeasibility:deliveryFeasibilityForState(state),sourceLaborEvidence:laborEvidence?{
        state:'source',laborResourceCount:laborEvidence.laborResourceCount,plannedHours:laborEvidence.plannedHoursKnown,
        plannedHoursToDataDate:laborEvidence.plannedHoursToDataDate,actualHoursToDataDate:laborEvidence.actualHoursToDataDate,
        sourcePeriodCount:laborEvidence.plannedSourcePeriodCount,dataDateIso:laborEvidence.dataDateIso,
        basis:'Weekly labor demand and approved usage; source hours do not by themselves establish a submitted headcount plan or measured productivity.'
      }:null,boqSource:boqSourceReporting(state)}:{}),
      ...(["pmo-analysis","delay-claims","notices-claims","eot-assessment","windows-analysis","commercial-claims-notices"].includes(key) ? { claimsReporting: claimsReporting(state) } : {}),
      ...(key==='eot-assessment'?{...eotCompletionAuthorityContext(state,time,model,calculationSnapshotTime(state)),
        determinationOverlapScenario:(()=>{const finish=sourceOnlyForecast(state,model,calculationSnapshotTime(state)).sourceForecastCompletionIso,contract=time.contractTimeBasis?.contractualCompletionIso;
          if(!finish||!contract||time.effectiveDeterminationDays===null||data.timeBasisReconciliation?.overlapResolution!=='unresolved')return null;
          const late=(Date.parse(finish.slice(0,10))-Date.parse(contract.slice(0,10)))/86400000;
          return {allIncludedLatenessDays:late,noneIncludedLatenessDays:late-time.effectiveDeterminationDays,determinedDays:time.effectiveDeterminationDays,
            basis:'Conditional arithmetic only: if all effective register determinations are already inside the amendment, no further days apply; if none are incorporated and all can be applied on a calendar-day basis, the alternative subtracts those days. Award-letter evidence, overlap and entitlement still require confirmation.'};})()}:{}),
      ...(key==='notices-claims'?{contractNoticePeriod:commercialFoundationForState(state).commercialTerms.noticePeriodDays,contractNoticeReview:commercialFoundationForState(state).commercialTerms.noticeReview}:{}),
      ...(["milestones", "independent-forecast", "notices-claims"].includes(key) ? {
        contractualCompletionIso: time.contractTimeBasis?.contractualCompletionIso ?? null,
        effectiveDeterminationDays: time.effectiveDeterminationDays,
        registerDeterminationDays: time.registerDeterminationDays,
        futureDeterminationCount: time.futureDeterminationCount,
      } : {}),
      ...(key === "milestones" ? {
        independentDrivingPathState: forecastReview ? "review_required" : forecast?.complete ? "calculated_requires_path_validation" : "not_established",
        independentDrivingPathReason: forecastReview ?? "CPM calculation coverage does not by itself validate a milestone driving path.",
        rows: attachSourceActivityCalendars(data.rows??[],model.activities),
      } : {}),
      ...(key === "independent-forecast" ? (() => {
        const control =
          forecastControlForState(
            state,
            model,
            forecast!,
          );
        const finalReview =
          forecastReview ??
          (
            control.gate.publishable
              ? null
              : control.gate.reason
          );
        const required =
          control.taxonomy
            .contractualCompletion
            .completionIso ??
          data.requiredFinishIso ??
          null;
        return {
          originalContractualCompletionIso:control.originalContractualCompletionIso,
          requiredFinishIso:
            required,
          requiredFinishVarianceDays:
            required &&
            data.independentForecastCompletionIso
              ? (
                  parseScheduleTime(
                    data.independentForecastCompletionIso,
                  ) -
                  parseScheduleTime(required)
                ) /
                86400000
              : null,
          sourceConstraints:
            model.activities
              .filter(
                a =>
                  a.sourceConstraints?.length,
              )
              .map(a => ({
                activityId:
                  a.activityId,
                constraints:
                  a.sourceConstraints,
              })),
          forecastTaxonomy:
            control.taxonomy,
          forecastReconciliationGate:
            control.gate,
          managementForecastCompletionIso:
            control.gate
              .managementForecastCompletionIso,
          managementReviewState:
            finalReview
              ? "review_required"
              : "accepted_for_analysis",
          managementReviewReason:
            finalReview,
          probabilistic: {
            ...data.probabilistic,
            ...(!forecast?.complete||forecast.assumptions.some(a=>a.startsWith('SOURCE_CONSTRAINTS_RETAINED_NOT_APPLIED'))
              ? {
                  status:
                    "unavailable",
                  p50CompletionIso:
                    null,
                  p80CompletionIso:
                    null,
                  p90CompletionIso:
                    null,
                }
              : {}),
            suppressionReason:!forecast?.complete?forecastReview:null,
            reviewReason:forecastReview,
          },
        };
      })() : {}),
      ...(key === "milestones" ? { movementDistribution: numericDistribution((data.rows ?? []).map((row: any)=>row.varianceDays)) } : {}),
      ...(key === "activity-analytics" ? {
        rows:(()=>{const classification=projectScopeClassification(state,model),byId=new Map(classification.rows.map(row=>[row.activityId,row]));return (data.rows??[]).map((row:any)=>{const scope=byId.get(row.activityId);return {...row,...activityDelayStatus(row),
          wbsPath:scope?.wbsPath??null,wbsLevel:scope?.wbsLevel??null,plot:scope?.plot??null,location:scope?.location??null,zone:scope?.zone??null,floor:scope?.floor??null,level:scope?.level??null,tower:scope?.tower??null,building:scope?.building??null,area:scope?.area??null,workFront:scope?.workFront??null,
          phase:scope?.phase??null,section:scope?.section??null,chainage:scope?.chainage??null,discipline:scope?.discipline??null,trade:scope?.trade??null,system:scope?.system??null,package:scope?.package??null,cbs:scope?.cbs??null,contractor:scope?.contractor??null,subcontractor:scope?.subcontractor??null};});})(),
        scopeClassification:projectScopeClassification(state,model),
        counts: activityAnalyticsCounts(data.rows ?? []),
        movementDistribution: numericDistribution((data.rows ?? []).map((row: any)=>row.finishVarianceDays)),
        movementAnalysis: (()=>{const history=analyticalHistory(state);const current=projectControlSchedule(state)!;const index=history.findIndex(r=>r.revision.revisionId===current.revision.revisionId);const previous=index>0?history[index-1]:null;const baseline=state.schedules.find(r=>r.revision.revisionId===data.controlledBaselineRevisionId);return activityMovementAnalysis(data.rows??[],{dataDateIso:model.dataDateIso,currentRevisionId:current.revision.revisionId,currentLabel:current.revision.label??current.sourceFilename??current.revision.revisionId,baselineRevisionId:data.controlledBaselineRevisionId??null,baselineLabel:baseline?.revision.label??null,previousRevisionId:previous?.revision.revisionId??null,previousLabel:previous?.revision.label??null,previousRows:previous?.revision.model.activities??[]});})(),
      } : {}),
    };
  }
  if(key==='milestones'&&result.data)result.data=attachMilestonePopulation(result.data);
  if(key==='milestones'&&controlBasis.state!=='official'){
    result.status='partial';
    result.professionalState='review_required';
    result.evidenceState='partial';
    result.reason='Milestones use submitted float and a '+controlBasis.nearCriticalThresholdMethod.replaceAll('_',' ')+' threshold. Contractual threshold authority and independent driving-path validation remain separate.';
  }
  if(result.data&&typeof result.data==='object'){
    (result.data as any).featureAvailability=moduleFeatureAvailability(key,result.data);
  }
  if(result.data&&typeof result.data==='object'&&['activity-analytics','schedule-analytics','pmo-analysis','milestones','near-critical'].includes(key)){
    const review=sharedFloatReview??activityFloatReconciliation(model,cachedIndependentForecast(model,calculationSnapshotTime(state)),controlBasis.analysisConfig,state.version);
    result.data=attachActivityFloatReconciliation(result.data,review);
    if(review.summary.criticalityDifferenceCount){
      result.status='partial';result.professionalState='review_required';
      const offset=review.summary.commonOffsetHours;
      result.reason=[result.reason,review.summary.differenceActivityCount+' open activities have submitted versus independently calculated float differences ('+
        review.summary.criticalityDifferenceCount+' change criticality classification; '+review.summary.numericDifferenceActivityCount+' retain the same classification).'+
        (offset!==null?' A common '+offset+'-hour difference requires calendar/definition reconciliation; it is not evidence of a contractual dispute.':'')+
        ' Both hourly values and classifications remain available; no difference is silently approved.'].filter(Boolean).join(' ');
    }
  }
  if(key==='lookahead-schedule'&&result.data&&typeof result.data==='object'){
    const current=projectControlSchedule(state),resource=current?state.resourcesByRevision.get(current.revision.revisionId):null;
    const value=result.data as any,output=value?.result?.projectionKey==='lookahead_schedule'?value.result:value;
    const ids=new Set<string>(((output.forwardWindowRows??output.rows??[]) as Array<{activityId:string}>).map(x=>x.activityId));
    const master=new Map((resource?.resources??[]).map(x=>[x.resourceId,x]));
    const groups=new Map<string,{resourceId:string;trade:string;unit:string|null;activityIds:Set<string>;count:number;known:number;remaining:number}>();
    for(const row of resource?.assignments??[]){
      if(!ids.has(row.activityId)||row.resourceType!=='labor'||!row.resourceId)continue;
      const r=master.get(row.resourceId),g=groups.get(row.resourceId)??{resourceId:row.resourceId,trade:r?.name??r?.shortName??row.resourceId,unit:r?.unitAbbreviation??r?.unitName??null,activityIds:new Set<string>(),count:0,known:0,remaining:0};
      g.activityIds.add(row.activityId);g.count++;
      if(typeof row.remainingUnits==='number'&&Number.isFinite(row.remainingUnits)){g.remaining+=row.remainingUnits;g.known++;}
      groups.set(row.resourceId,g);
    }
    // S-20: exact resource-ID linkage only. A shared trade name alone is
    // insufficient evidence of the same crew, resource or approved capacity.
    // T04: shared source-analytical rule; a unique fully read candidate is
    // used and labelled (registerEvidenceState 'candidate'), never adopted.
    const resourceDocs=analyticalOperationalDocuments(state.evidenceDocuments).filter(doc=>
      /resource|manpower|labou?r|crew|capacity|time.?phas/i.test(
        [doc.sourceFilename,doc.documentType].join(' ')));
    const dated=groups.size&&resourceDocs.length
      ?weeklyResourceCapacityEvidence(resourceDocs,{dataDateIso:model.dataDateIso})
      :null;
    const weeksById=new Map<string,NonNullable<typeof dated>['points']>();
    const normalizeTrade=(name:string)=>String(name??'').normalize('NFKC').toLowerCase()
      .replace(/\b(labour|labor)\b/g,'labour').replace(/\b(electricians)\b/g,'electrician')
      .replace(/\b(plumbers)\b/g,'plumber').replace(/\b(carpenters)\b/g,'carpenter')
      .replace(/\b(?:crew|trade|resource|resources|manpower|workforce)\b/g,'')
      .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
    const tradeIds=new Map<string,Set<string>>();
    for(const point of dated?.points??[]){
      const list=weeksById.get(point.resourceId)??[];
      list.push(point);weeksById.set(point.resourceId,list);
      const normalized=normalizeTrade(point.resourceName??'');
      if(normalized){
        const ids=tradeIds.get(normalized)??new Set<string>();
        ids.add(point.resourceId);tradeIds.set(normalized,ids);
      }
    }
    const dataDate=model.dataDateIso?.slice(0,10)??null;
    const endDate=dataDate&&Number.isFinite(Date.parse(dataDate))?
      new Date(Date.parse(dataDate)+42*86400000).toISOString().slice(0,10):null;
    const sumKnown=(rows:NonNullable<typeof dated>['points'],key:'availableCapacity'|'plannedDemand'|'actualApprovedUsage')=>
      rows.length&&rows.every(row=>typeof row[key]==='number'&&Number.isFinite(row[key]))
        ?rows.reduce((total,row)=>total+(row[key]??0),0):null;
    output.sourceResourceTrades=[...groups.values()].map(g=>{
      const sourceMatch=weeksById.get(g.resourceId)??[];
      const possibleNames=tradeIds.get(normalizeTrade(g.trade))??new Set<string>();
      // A trade-name match is accepted only when unique. Ambiguous names are
      // never used to merge independent crew/capacity populations.
      const uniqueNameId=possibleNames.size===1?[...possibleNames][0]!:null;
      const matchingId=sourceMatch.length?g.resourceId:uniqueNameId;
      const unitsComparable=(a:string|null,b:string|null)=>{
        const normalize=(unit:string)=>unit.toLowerCase().replace(/[^a-z0-9]/g,'')
          .replace('labour','labor').replace('hours','hour');
        return !a||!b||normalize(a)===normalize(b);
      };
      const identityMatches=matchingId?weeksById.get(matchingId)??[]:[];
      const matching=identityMatches.filter(p=>unitsComparable(g.unit,p.unit));
      // Label only a trade whose figures actually came from an unadopted source.
      const fromUnadopted=identityMatches.some(p=>((p as any).receipts??[]).some((r:any)=>r.basisState==='candidate'));
      const matchBasis=sourceMatch.length?'Exact source resource ID':
        uniqueNameId&&identityMatches.length?'Unique matching trade name':
        possibleNames.size>1?'Trade name matches multiple register IDs; reconciliation required':
        'No comparable resource register record';
      const forward=matching.filter(p=>p.weekStartIso&&dataDate&&endDate
        &&p.weekStartIso.slice(0,10)>=dataDate&&p.weekStartIso.slice(0,10)<=endDate);
      const history=matching.filter(p=>p.weekStartIso&&dataDate&&p.weekStartIso.slice(0,10)<=dataDate);
      return {resourceId:g.resourceId,trade:g.trade,unit:g.unit,activityIds:[...g.activityIds],
        remainingUnits:g.known===g.count?g.remaining:null,
        registerLinkedByExactId:sourceMatch.length>0,
        registerLinkedByTradeName:sourceMatch.length===0&&uniqueNameId!==null&&identityMatches.length>0,
        capacityUnitsComparable:matching.length>0,
        registerMatchBasis:matchBasis,
        matchedRegisterResourceId:identityMatches.length?matchingId:null,
        registerPeriodCount:forward.length,
        registerPlannedDemand:sumKnown(forward,'plannedDemand'),
        registerAvailableCapacity:sumKnown(forward,'availableCapacity'),
        registerActualToDate:sumKnown(history,'actualApprovedUsage'),
        registerEvidenceState:dated?.state??'not_found',
        ...(fromUnadopted?{registerSourceUse:SOURCE_ANALYTICAL_USE,registerSourceNote:'Capacity read from source; not formally adopted'}:{}),
        registerSourceRefs:[...new Set(identityMatches.map(row=>row.sourceRef))].slice(0,12),
        basis:matching.length?
          matchBasis+(fromUnadopted
            ?'. Source weekly planned demand, capacity read from a source that is not formally adopted (not approved capacity) and actual usage are separate; no crew overload verdict without approved comparable capacity.'
            :'. Source weekly planned demand, approved capacity where established and actual usage are separate; no crew overload verdict without approved comparable capacity.'):
          matchBasis+'. Submitted P6 labor demand is not an approved crew limit.'};
    });
  }
  if(key==='lookahead-schedule'&&result.data){const p=result.data as any;attachLookaheadResourceLinks(p.result?.projectionKey==='lookahead_schedule'?p.result:p);}
  if(result.data&&typeof result.data==='object'&&['pmo-analysis','schedule-analytics','independent-forecast','progress-report','cash-flow','cost-forecast','commercial-overview'].includes(key)) {
    // An unavailable Director interpretation is not permission to rebuild
    // every specialist projection. Use the canonical source interpretation
    // directly; it has the same authority and does not invent missing facts.
    const interpretation=sharedInterpretation??sourceInterpretation(state);
    const fields=key==='pmo-analysis'?Object.keys(interpretation):['progress-report','cost-forecast','commercial-overview'].includes(key)?['progressMeasures']:
      ['schedule-analytics','independent-forecast'].includes(key)?['calendarRecalculatedFinishIso','calendarReview','productivityForecast']:[];
    if(fields.length)(result.data as any).sourceInterpretation=Object.fromEntries(fields.map(field=>[field,(interpretation as any)[field]]));
    // The shared full bundle is cached per project version, so this reads
    // the already calculated Progress Breakdown rows rather than rebuilding.
    if(key==='progress-report')(result.data as any).areaProgress=(buildBundle(state).modules.get('progress-breakdown')?.data as any)?.rows??[];
  }
  return attachReportingContract(state,discloseReadIssues(checkProjectionIntegrity(result, model, controlBasis.analysisConfig, state.controls.delayClaims, key==='milestones'?milestoneReviewForProjection(state,model):undefined)));
}

const resolvedProjectCache = new Map<string, {version: number; modules: Map<string, ModuleRuntimeResult>}>();

function resolveProjectModule(state: ProjectRuntimeState, key: string): ModuleRuntimeResult {
  const cached = resolvedProjectCache.get(state.projectId);
  if (cached?.version === state.version) return cached.modules.get(key) ?? blocked(key, "Unknown module.", []);
  const profiling=process.env.CMENG_PROFILE_PERF?.trim()==='1';
  const p0=profiling?performance.now():0;
  const scoped = reportingState(state);
  const p1=profiling?performance.now():0;
  const bundle = buildBundle(scoped);
  const p2=profiling?performance.now():0;
  const candidateProfile:Array<{key:string;ms:number}>=[];
  const sharedModel=projectControlSchedule(scoped)?.revision.model;
  const sharedControlBasis=sharedModel?projectScheduleControlBasis(scoped):null;
  let sharedFloatReview:ReturnType<typeof activityFloatReconciliation>|undefined;
  const sharedInterpretation=bundle.director?.sourceInterpretation;
  const floatReviewKeys=new Set(['activity-analytics','schedule-analytics','pmo-analysis','milestones','near-critical']);
  const candidates = new Map(certifiedAnalyticalModules.map(descriptor => {
    const t=profiling?performance.now():0;
    // Reuse the full-bundle result only where the normal uncertified resolver
    // would use that same bundle. Commercial and specialist Claims/Forecast
    // modules have dedicated canonical/fast resolvers with additional semantics
    // and must continue through those paths.
    const bundleReusable=
      planningModuleKeys.has(descriptor.key)||
      descriptor.key==='pmo-analysis'||
      descriptor.key==='progress-report'||
      descriptor.key==='progress-scurve'||
      descriptor.key==='progress-breakdown'||
      descriptor.key==='challenge-contract'||
      descriptor.key==='variance-trends'||
      descriptor.key==='resource-utilization'||
      descriptor.key==='manhour-scurve'||
      descriptor.key==='quantity-scurve';
    if(floatReviewKeys.has(descriptor.key)&&sharedModel&&sharedControlBasis&&!sharedFloatReview){
      sharedFloatReview=activityFloatReconciliation(
        sharedModel,
        cachedIndependentForecast(sharedModel,bundle.generatedAt),
        sharedControlBasis.analysisConfig,
        scoped.version,
      );
    }
    const result=resolveProjectModuleCandidate(
      scoped,
      descriptor.key,
      bundleReusable?bundle.modules.get(descriptor.key):undefined,
      floatReviewKeys.has(descriptor.key)?sharedFloatReview:undefined,
      sharedInterpretation,
      true,
    );
    if(profiling)candidateProfile.push({key:descriptor.key,ms:performance.now()-t});
    return [descriptor.key,result] as const;
  }));
  const p3=profiling?performance.now():0;
  const consistency = certifyCrossModuleConsistency({generatedAt: bundle.generatedAt, state: scoped,
    modules: candidates, director: bundle.director, boardReport: bundle.boardReport});
  const p4=profiling?performance.now():0;
  const readinessProfile:Array<{key:string;ms:number}>=[];
  const issueScan={eligibility:new WeakMap<object,boolean>()};
  const modules = new Map([...candidates].map(([key, result]) => {
    const t=profiling?performance.now():0;
    const ready=enforceModuleReadiness(result, consistency,issueScan);
    if(profiling)readinessProfile.push({key,ms:performance.now()-t});
    return [key,ready] as const;
  }));
  const postReadiness=profiling?performance.now():0;
  const forecast=modules.get('independent-forecast')?.data as any;
  const near=modules.get('near-critical')?.data as any;
  const activityNames=new Map((projectControlSchedule(scoped)?.revision.model.activities??[]).map(a=>[a.activityId,a.name??a.activityId]));
  for(const key of ['pmo-analysis','independent-forecast']){
    const result=modules.get(key),data=result?.data as any;
    if(data&&forecast){data.completionPosition=completionPosition(data,forecast,activityNames);
      if(key==='pmo-analysis')data.knownScheduleCounts={critical:near?.knownCriticalCount??near?.criticalCount??null,nearCritical:near?.nearCriticalCount??near?.rows?.length??null,negativeFloat:near?.knownNegativeFloatCount??near?.negativeFloatCount??null};
    }
  }
  const interfacePosition=interfaceIntelligence(scoped);
  for(const moduleKey of ['lookahead-schedule','delay-claims']){
    const currentModule=modules.get(moduleKey),moduleData=currentModule?.data;
    if(currentModule&&moduleData&&typeof moduleData==='object')modules.set(moduleKey,{...currentModule,data:{...(moduleData as Record<string,unknown>),interfacePosition}});
  }
  const beforeDiagnosis=profiling?performance.now():0;
  const diagnosis=buildProjectDiagnosis(scoped,modules);
  const afterDiagnosis=profiling?performance.now():0;
  const management=modules.get('pmo-analysis')?.data as any;
  if(management)management.projectDiagnosis=presentProjectDiagnosis(diagnosis);
  const p5=profiling?performance.now():0;
  if(profiling)process.stdout.write(JSON.stringify({event:'project_resolution_profile',projectId:state.projectId,
    reportingStateMs:p1-p0,bundleMs:p2-p1,candidatesMs:p3-p2,certificationMs:p4-p3,readinessMs:p5-p4,readinessOnlyMs:postReadiness-p4,diagnosisMs:afterDiagnosis-beforeDiagnosis,otherPostReadinessMs:(p5-postReadiness)-(afterDiagnosis-beforeDiagnosis),totalMs:p5-p0,
    slowCandidates:candidateProfile.filter(row=>row.ms>=5).sort((a,b)=>b.ms-a.ms),
    slowReadiness:readinessProfile.filter(row=>row.ms>=5).sort((a,b)=>b.ms-a.ms)})+'\n');
  resolvedProjectCache.set(state.projectId, {version: state.version, modules});
  return modules.get(key) ?? blocked(key, "Unknown module.", []);
}

/** History and the live forecast share one hard publication gate. */
export function forecastSnapshotFromProjection(forecast:Parameters<typeof rawForecastSnapshot>[0],snapshotId:string,model:Parameters<typeof buildForecastReconciliationGate>[0]['model']){
  const gate=buildForecastReconciliationGate({forecast,model,requiredFinishIso:null});
  return {...rawForecastSnapshot(forecast,snapshotId),
    independentForecastCompletionIso:gate.usable?forecast.independentForecastCompletionIso:null,
    calculationState:gate.usable?'calculated_with_stated_assumption':'withheld',
    calculationReason:gate.reason,
    calculationChecks:gate.checks,
    // Raw result is audit evidence, never a published history date or difference.
    calculationEvidence:{rawRecalculatedFinishIso:forecast.independentForecastCompletionIso}};
}

const projectActionCache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof buildProjectActionRegister>}>();
function buildProjectActionRegister(state:ProjectRuntimeState){
  // Resolve raw owning projections before facts are attached. This producer never
  // calls a page/API wrapper, so the shared-facts consumer cannot recurse.
  // Every certified module raises issues into this register, so it is always
  // built from the complete shared module set; Dashboard and Accountability
  // therefore show the same actions.
  resolveProjectModule(state,'pmo-analysis');
  const modules=resolvedProjectCache.get(state.projectId)!.modules;
  const assessment=summarizeControlIssues([...modules.values()].flatMap(r=>r.issueAssessment?.issues??[]));
  const forecast=modules.get('independent-forecast')?.data as any;
  const review=projectActions(state,assessment,{completionPosition:forecast?.completionPosition});
  const recordPosition=crossDomainAccountability(state);
  const reviewById=new Map(review.actions.map(a=>[a.id,a]));
  const reviewRows=review.actions.map(a=>managementAction({actionId:a.id,recordKey:'review|'+a.id,issue:a.title,
    consequence:a.reason,affectedScope:[...new Set(a.findings?.flatMap(f=>f.sourceRefs)??[])],affectedMilestones:[],
    owner:'Project controls reviewer',organisation:null,requiredAction:a.resolution?.instruction??a.reason,dueIso:null,
    escalation:null,severity:a.category==='review'?'high':'medium',authority:'calculated',sourceRefs:a.findings?.flatMap(f=>f.sourceRefs)??[],owningModule:a.target.moduleKey??'source-quality'}));
  const model=projectControlSchedule(state)?.revision.model??null;
  const independentRanking=!!model&&forecast?.origin==='deterministic_source_calendar'&&forecast?.unresolvedActivityCount===0&&Array.isArray(forecast?.activities);
  const independentFloatById=new Map<string,number|null>(
    independentRanking?forecast.activities.map((row:any)=>[String(row.activityId),typeof row.independentTotalFloatHours==='number'?row.independentTotalFloatHours:null]):[],
  );
  const recordActions=recordPosition.recordActions;
  const actions=prioritizeActions(
    [...recordPosition.actions,...reviewRows],
    model,
    forecast?.complete===true?forecast.drivingNetwork?.activityIds??null:null,
    independentRanking?'independent_cpm':'source_total_float',
    independentRanking?independentFloatById:undefined,
  );
  const workflowActions:ProjectAction[]=actions.map(a=>reviewById.get(a.actionId)??{
    id:a.actionId,category:'follow_up',title:a.issue,reason:a.consequence??a.requiredAction,recordCount:recordPosition.ownerGroups.find(g=>g.groupId===a.actionId)?.count??1,
    owner:pmcRoleOwner(a.owningModule??a.recordKey??'project controls',a.owner??a.organisation),dueIso:a.dueIso,priorityBasis:a.priorityBasis,
    resolution:{kind:'information',requiresUserAction:false,instruction:a.requiredAction,completionRule:'Closes when the underlying dated record shows the work or response is complete.'},
    target:{type:'module',moduleKey:a.owningModule??'cross-domain-accountability',label:'Open supporting record'},
  });
  // Publish direct decisions only. The full, independently ranked team register
  // stays above: source rows, owners, priorities, and links are never removed.
  const decisionOrder=new Map(actions.map((a,i)=>[a.actionId,i]));
  const decisions=review.actions
    .filter(a=>(a.category==='confirmation'||a.category==='review')&&a.resolution?.requiresUserAction===true)
    .sort((a,b)=>(decisionOrder.get(a.id)??Number.MAX_SAFE_INTEGER)-(decisionOrder.get(b.id)??Number.MAX_SAFE_INTEGER));
  const decisionIds=new Set(decisions.map(a=>a.id));
  const teamActions=actions.filter(a=>!decisionIds.has(a.actionId));
  return {actions,recordActions,ownerGroups:recordPosition.ownerGroups,recordActionCount:recordActions.length,reviewActionCount:decisions.length,
    workflow:{...review,actions:decisions,actionCount:decisions.length,userDecisionCount:decisions.length,
      teamFollowUpCount:teamActions.length,
      scope:'User decisions only. Accountable team actions and supporting source records remain in Accountability.'},
    recordPosition};
}
export function projectActionRegisterForState(state:ProjectRuntimeState){
  state=reportingState(state);
  const cached=projectActionCache.get(state);if(cached?.version===state.version)return cached.value;
  const value=buildProjectActionRegister(state);projectActionCache.set(state,{version:state.version,value});return value;
}

/** Publish one coherent read-only module result per retained source revision.
 * Screen and downloadable report must read the SAME completed source facts,
 * including report provenance/generation stamps, rather than recalculating
 * a second version of the answer for an unchanged project.
 * This is bounded, worker-local and invalidated by state identity/version.
 * Persistent gateway reads retain their independent exact-release protection. */
const publishedModuleResponses = new WeakMap<ProjectRuntimeState,{
  version:number; results:Map<string,ModuleRuntimeResult>
}>();
export function moduleForProject(projectId:string,key:string):ModuleRuntimeResult {
  const state=runtimeProjects.get(projectId),canonical=resolveModuleKey(key);
  if(!state)return moduleForProjectUncached(projectId,canonical);
  let entry=publishedModuleResponses.get(state);
  if(!entry||entry.version!==state.version){
    entry={version:state.version,results:new Map()};
    publishedModuleResponses.set(state,entry);
  }
  const existing=entry.results.get(canonical);
  if(existing){
    entry.results.delete(canonical);
    entry.results.set(canonical,existing);
    return existing;
  }
  const result=moduleForProjectUncached(projectId,canonical);
  if(runtimeProjects.get(projectId)===state&&state.version===entry.version){
    entry.results.set(canonical,result);
    // Only finished per-project positions remain in memory. Long source
    // registers are paged independently; never truncate any source result.
    while(entry.results.size>8)entry.results.delete(entry.results.keys().next().value!);
  }
  return result;
}
function moduleForProjectUncached(
  projectId: string,
  key: string,
): ModuleRuntimeResult {
  key=resolveModuleKey(key);
  const state =
    runtimeProjects.get(projectId);
  if (!state) {
    return blocked(
      key,
      "Project has not been created.",
      ["project"],
    );
  }
  const finalize=(result:ModuleRuntimeResult)=>{
    // The Dashboard is the shared full management surface, which already
    // carries the canonical full-calculation facts. Publish it unchanged so the
    // Dashboard page equals the full management calculation exactly.
    const attached=key==='master-dashboard'&&(result.data as any)?.projectFacts
      ? result : attachProjectFacts(state,result);
    // A position verdict that predates canonical facts can compare against
    // the unextended contract. Re-evaluate only existing verdict surfaces
    // after shared fact attachment, without a second calculation producer.
    return (result.data as any)?.positionVerdict?withPositionVerdict(attached):attached;
  };
  // No-programme is a normal management state for a real project, not a
  // not-found exception. Non-programme registers remain independently usable.
  const programmePages=new Set([
    'pmo-analysis','schedule-analytics','activity-analytics','lookahead-schedule',
    'schedule-change-report','revision-trend','milestones','near-critical',
    'forecast-history','independent-forecast','windows-analysis'
  ]);
  if(programmePages.has(key)&&!projectControlSchedule(state)){
    return finalize({key,status:'partial',reason:'Current programme not established. The project exists and its source documents are retained.',
      dependencies:['Current adopted programme with a Data Date'],
      data:{projectId:state.projectId,projectVersion:state.version,programmeState:'no_programme',
        managementPosition:'No current programme. Supply or adopt a dated programme to calculate schedule findings.',
        availability:{state:'unavailable',missingInput:'Current adopted programme with a Data Date'},
        rows:[],metrics:[],sourcePreserved:true}});
  }
  if (key==='delivery-interfaces') {const scoped=reportingState(state);return finalize(withPositionVerdict(attachReportingContract(scoped,deliveryExportResult(scoped,interfaceModule(scoped)))));}
  if (key==='recovery-acceleration') {const scoped=reportingState(state);return finalize(withPositionVerdict(attachReportingContract(scoped,recoveryAccelerationModule(scoped))));}
  if (key==='cross-domain-accountability') {
    const scoped=reportingState(state),register=projectActionRegisterForState(state),result=accountabilityModule(scoped);
    const decisionIds=new Set(register.workflow.actions.map(a=>a.id));
    const correctionRecords=(sourceRefs:readonly string[]|undefined)=>[...new Set(sourceRefs??[])].map(ref=>actionSourceCorrectionRecord(scoped,ref));
    const teamActions=register.actions.filter(a=>!decisionIds.has(a.actionId)).map(a=>({...a,correctionRecords:correctionRecords(a.sourceRefs)}));
    const recordActions=register.recordActions.map(a=>({...a,correctionRecords:correctionRecords(a.sourceRefs)}));
    return finalize(withPositionVerdict(attachReportingContract(scoped,{
      ...result,
      status:teamActions.length?'partial':result.status,
      data:{...(result.data as object),actions:teamActions,recordActions,actionCount:teamActions.length,
        // actionCount is re-bound to the shared project fact actions.openCount (all owner/register groups
        // plus source-review decisions). Name each population so 7 decisions + 2 team groups = 9 is visible.
        teamActionCount:teamActions.length,userDecisionCount:decisionIds.size,
        actionCountBasis:'All management actions: accountable team groups plus decisions requiring your authority (Project Review). The Actions page counts only the decisions.',
        ownerRegisterGroups:groupActionsByOwnerRegister(teamActions),
        managementPosition:teamActions.length+' accountable project-team groups. '+register.recordActionCount+' underlying source records remain available. Each action carries its retained source evidence and owning correction page; decisions requiring your authority remain in Project Review.'}
    })));
  }
  if (isDeliveryPage(key)) {
    const scoped=reportingState(state),result=deliveryModule(scoped,key);
    const deliveryData=result.data as any;
    const register=projectActionRegisterForState(state);
    const moduleOwner=['long-lead','procurement-readiness','procurement-scurves','material-tracking'].includes(key)?'procurement-packages':key;
    const sourceRecords=deliveryData?.reviewRecords??[];
    const sourceByReference=new Map(sourceRecords.map((r:any)=>[String(r.reference??'').toLowerCase(),r]));
    const priorityActions=register.actions.filter(a=>a.owningModule===moduleOwner&&(!sourceRecords.length||sourceByReference.has(a.recordKey?.split('|').slice(1).join('|')??'')));
    result.data={...deliveryData,priorityFindings:priorityActions.map(a=>({message:a.issue,action:a.requiredAction,recordId:(sourceByReference.get(a.recordKey?.split('|').slice(1).join('|')??'') as any)?.recordId??null,sourceRefs:a.sourceRefs,priorityBasis:a.priorityBasis}))};
    if(key==='delivery-control'){
      const actions=register.actions.filter(a=>isDeliveryPage(a.owningModule??''));
      result.data={...(result.data as object),findings:[],managementActions:actions.map(a=>({actionId:a.actionId,recordKey:a.recordKey,issue:a.issue,workfront:a.affectedMilestones.join('; ')||null,affectedSchedule:a.affectedScope,package:a.recordKey?.startsWith('procurement|')?a.recordKey.split('|')[1]:null,owner:a.owner??a.organisation,requiredDate:a.dueIso,sourceDueIso:a.sourceDueIso??null,sourceOverdueDays:a.sourceOverdueDays??null,escalation:a.escalation,consequence:a.consequence,action:a.requiredAction,priorityBasis:a.priorityBasis,sourceRefs:a.sourceRefs})),managementPosition:actions.length+' delivery actions from the shared project action register, ranked by linked programme and commercial effect.'};
    }
    return finalize(attachReportingContract(scoped,result));
  }
  if (key==='scope-classification') return finalize(resolveProjectModuleUncertified(reportingState(state),key));
  if (key==='monte-carlo-risk') return finalize(scheduleRiskMonteCarlo(reportingState(state)));
  if (key==='earned-schedule') return finalize(earnedScheduleForState(reportingState(state)));
  if (key==='evm-by-wbs') return finalize(evmByWbsForState(reportingState(state)));
  if (key==='risk-register') return finalize(riskRegisterForState(reportingState(state)));
  if (key==='contract-risk') return finalize(contractRiskForState(reportingState(state)));
  if (key==='final-account') return finalize(finalAccountForState(reportingState(state)));
  if (key==='tender-readiness') return finalize(tenderReadinessForState(reportingState(state)));
  const commercialCapability=commercialFoundationCapabilityForState(state,key)??commercialPerformanceCapabilityForState(state,key)??commercialContractControlCapabilityForState(state,key);
  if(commercialCapability)return finalize(attachReportingContract(reportingState(state),commercialCapability));
  if (managementModuleKeys.includes(key)) {
    return finalize(managementSurfaceForProject(projectId, key) ?? blocked(key, "Management position is not established.", []));
  }
  return finalize(resolveProjectModule(state, key));
}

const managementModuleKeys = ["master-dashboard", "command-center", "master-control-programme", "source-quality"];

/** True only when this worker already holds the finished full calculation for
 * the CURRENT project version. Reads in-memory caches only; it never starts,
 * resumes or schedules a calculation. 'modules' covers the specialist bundle
 * and the shared module set (Accountability, Director position); 'management'
 * additionally requires the one shared management calculation (Dashboard and
 * management surfaces). */
export function fullCalculationRetained(projectId:string,scope:'modules'|'management'):boolean{
  const state=runtimeProjects.get(projectId);if(!state)return false;
  const version=state.version;
  if(bundleCache.get(projectId)?.version!==version)return false;
  if(resolvedProjectCache.get(projectId)?.version!==version)return false;
  return scope==='modules'||managementProjectionCache.get(projectId)?.version===version;
}

export function directorForProject(
  projectId: string,
) {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;
  const data=buildBundle(state).director;
  if(!data)return null;
  const scoped=reportingState(state),model=projectControlSchedule(scoped)?.revision.model;
  const reviewedBase=model?attachActivityFloatReconciliation(data,activityFloatReconciliation(model,cachedIndependentForecast(model,calculationSnapshotTime(state)),projectScheduleControlBasis(scoped).analysisConfig,scoped.version)):data;
  const register=projectActionRegisterForState(state);
  const reviewed={...reviewedBase,managementActions:register.actions.map(a=>{
    const kind=a.recordKey?.split('|')[0],label=kind==='ncr'?'NCR':kind==='rfi'?'RFI':null;
    const issue=label&&!a.issue.startsWith(label)?label+' '+a.issue:a.issue;
    return [issue,a.requiredAction,a.dueIso?'Action due '+a.dueIso:'Follow-up deadline not agreed',a.sourceDueIso?'Earliest source due '+a.sourceDueIso:null,a.sourceOverdueDays?'Source overdue '+a.sourceOverdueDays+' calendar days':null,a.escalation].filter(Boolean).join(' — ');
  }),managementActionCount:register.actions.length};
  return reportingData(state,'project-director',bindProjectFacts('project-director',reviewed,projectFactsForState(state)) as typeof reviewed);
}

export function boardReportForProject(
  projectId: string,
) {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;
  const data=buildBundle(state).boardReport;
  return data?reportingData(state,'board-report',data):null;
}

function managementModuleGroup(
  key: string,
  category: string,
): string {
  return moduleRegistry.find(module => module.key === key)?.group ?? "Programme & Planning";
}

function gapState(
  established: boolean,
  partial = false,
): ManagementEvidenceGapInput["state"] {
  return established
    ? "established"
    : partial
      ? "partial"
      : "missing";
}

/** Presentation-only, exact-count operational scope for management pages.
 * Keep all original rows in specialist authorities and their exports. */ 
export function compactManagementOperationalReporting(operations: ReturnType<typeof operationalReporting>){
 const register=(row:any)=>({
   state:row.state,
   sourceRecordCount:row.sourceRecordCount,
   currentRecordCount:row.currentRecordCount,
   futureRecordCount:row.futureRecordCount,
   undatedRecordCount:row.undatedRecordCount,
   unknownStatusCount:row.unknownStatusCount,
 });
 return {
   dataDateIso:operations.dataDateIso,
   counts:operations.counts,
   knownCounts:operations.knownCounts,
   quality:register(operations.quality),
   rfi:register(operations.rfi),
   risk:{...register(operations.risk),
     // Only displayed status breakdown is needed for undated-risk coverage;
     // source references, identities, dates and evidence stay in Risk Review.
     sourceRows:(operations.risk.sourceRows??[]).map((row:any)=>({
       sourceStatus:row.sourceStatus??null,status:row.status??null,
     })),
   },
 };
}

const managementProjectionCache = new Map<string, {version: number; data: ManagementSurfacesProjection & {sourceQuality: ReturnType<typeof sourceQualityPosition>}}>();

/** One management calculation per project version, shared by the Dashboard,
 * Command Center, Master Control Programme, Source Quality and Accountability.
 * The optional purpose is accepted only for existing callers: every purpose
 * returns this same complete result from the same cache, so the Dashboard can
 * never show a different figure or action count from the full calculation. */
export function managementSurfacesForProject(
  projectId: string,
  _purpose?:'full'|'dashboard',
): (ManagementSurfacesProjection & {sourceQuality: ReturnType<typeof sourceQualityPosition>}) | null {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;

  const cached = managementProjectionCache.get(projectId);
  if (cached?.version === state.version) return cached.data;

  const profiling=process.env.CMENG_PROFILE_PERF?.trim()==='1';
  const mp0=profiling?performance.now():0;
  const bundle =
    buildBundle(state);
  const mp1=profiling?performance.now():0;
  const generatedAt =
    bundle.generatedAt;
  const director =
    bundle.director;
  const commercial =
    commercialPositionForState(
      state,
      generatedAt,
    );
  const current =
    projectControlSchedule(state);
  const baselineCandidates =
    state.schedules
      .filter(
        (item) =>
          item.role ===
            "baseline" ||
          item.role ===
            "revised_baseline",
      )
      .sort(
        (a, b) =>
          a.revision.sequence -
          b.revision.sequence,
      );
  const baseline =
    baselineCandidates.at(-1) ??
    null;

  // Keep the exact same certified module order and results, while allowing
  // T11 cold-run profiles to identify the shared producer(s) behind the
  // expensive resolution stage. Profiling does not skip a module or write data.
  const resolvedModules=new Map<string,ModuleRuntimeResult>();
  const moduleResolutionProfile:Array<{module:string;ms:number}>=[];
  for(const descriptor of certifiedAnalyticalModules){
    const started=profiling?performance.now():0;
    resolvedModules.set(descriptor.key,resolveProjectModule(state,descriptor.key));
    if(profiling)moduleResolutionProfile.push({module:descriptor.key,ms:performance.now()-started});
  }
  if(profiling)process.stdout.write(JSON.stringify({
    event:'management_resolved_modules_breakdown',projectId,
    modules:moduleResolutionProfile,
    totalMs:moduleResolutionProfile.reduce((sum,row)=>sum+row.ms,0),
  })+'\n');
  const mp2=profiling?performance.now():0;
  const certification = certifyCrossModuleConsistency({ generatedAt, state: reportingState(state), modules: resolvedModules,
    director, boardReport: bundle.boardReport });
  const mp3=profiling?performance.now():0;
  const consistency = { state: certification.state, checkCount: certification.checkCount,
    failedCheckIds: certification.failedCheckIds,
    scope: "Checked cross-module values, shared population IDs and denominators, Data Date, authority, configuration and project version. Evidence completeness is a separate gate." };
  const moduleInput = (descriptor: {key: string; title: string; category: string}, commercialModule = false): ManagementModuleInput => {
    const result = resolvedModules.get(descriptor.key)!;
    const integrity = (result.data as any)?.systemEvidenceContract;
    return { key: descriptor.key, label: descriptor.title, issueAssessment: result.issueAssessment,
      group: commercialModule ? "Commercial" : managementModuleGroup(descriptor.key, descriptor.category),
      status: result.status, reason: result.reason ?? null,
      calculationState: integrity?.state === "verified_for_checked_metrics" ? "checked" : integrity?.state === "failed" ? "failed" : "pending",
      evidenceState: result.evidenceState ?? "not_established", professionalState: result.professionalState ?? "review_required",
      consistencyState: consistencyForModule(certification, descriptor.key).state };
  };
  const scheduleInputs = certifiedScheduleModules.map(descriptor => moduleInput(descriptor));
  const commercialInputs = certifiedCommercialModules.map(descriptor => moduleInput(descriptor, true));

  const terms =
    commercial.foundation
      .commercialTerms;
  const cost =
    commercial.foundation
      .costRegister;
  const payments =
    commercial.foundation
      .paymentRegister;
  const riskValidation=operationalReporting(state).risk.validation;
  const riskState =
    director?.controls
      .riskEvidenceState ??
    "not_submitted";

  const evidenceGaps:
    ManagementEvidenceGapInput[] = [
      {
        key:
          "current-programme",
        label:
          "Current programme",
        state: gapState(
          current !== null,
        ),
        action:
          "Upload or select the confirmed current programme in the programme revision workflow.",
        owningModule:
          "schedule-analytics",
      },
      {
        key:
          "controlled-baseline",
        label:
          "Controlled baseline",
        state: gapState(
          baseline !== null,
        ),
        action:
          "Upload or select the confirmed baseline/revised baseline.",
        owningModule:
          "revision-trend",
      },
      {
        key:
          "contract-completion",
        label:
          "Contract completion date",
        state: gapState(
          terms
            .contractualCompletionDate
            .value !== null,
          terms
            .contractualCompletionDate
            .state ===
            "candidate",
        ),
        action:
          "Review and govern the contractual completion term in Commercial Terms.",
        owningModule:
          "contract-particulars-bonds",
      },
      {
        key:
          "cost-evidence",
        label:
          "Cost evidence",
        state: gapState(
          cost.state ===
            "established",
          cost.state ===
            "partial" ||
            cost.recordCount > 0,
        ),
        action:
          "Confirm the cost register and link its records to the cost breakdown.",
        owningModule:
          "cost-forecast",
      },
      {
        key:
          "payment-dates",
        label:
          "Payment lifecycle dates",
        state: gapState(
          payments.recordCount >
            0 &&
          payments
            .stageCoveragePercent ===
            100,
          payments.recordCount >
            0,
        ),
        action:
          "Complete the application, assessment, certification and payment event dates in the Payment Register.",
        owningModule:
          "payments",
      },
      {
        key:
          "risk-information",
        label:
          "Risk register figures",
        state:
          riskValidation.sourceRecordCount > 0 ? (operationalReporting(state).risk.complete&&riskValidation.state==="consistent_in_checked_scores"?"established":"partial") : riskState ===
          "established"
            ? "established"
            : riskState ===
                "submitted_unparsed"
              ? "partial"
              : "missing",
        action:
          riskValidation.sourceRecordCount>0 ? riskValidation.explanation : "Provide a risk register with dated status and a documented rating method.",
        owningModule: "documents",
      },
      {
        key:
          "commercial-terms",
        label:
          "Commercial terms",
        state:
          terms.state ===
            "established"
            ? "established"
            : terms.state ===
                "partial" ||
                terms.state ===
                  "candidate"
              ? "partial"
              : "missing",
        action:
          "Review contract facts, amendments and provisional terms in Commercial Terms.",
        owningModule:
          "contract-particulars-bonds",
      },
    ];

  const currentPublication =
    state.boardPublicationHistory
      .filter(
        (item) =>
          !item.stale,
      )
      .sort(
        (a, b) =>
          a.finalizedAt.localeCompare(
            b.finalizedAt,
          ),
      )
      .at(-1) ??
    null;
  const stalePublication =
    state.boardPublicationHistory
      .filter(
        (item) =>
          item.stale,
      )
      .sort(
        (a, b) =>
          a.finalizedAt.localeCompare(
            b.finalizedAt,
          ),
      )
      .at(-1) ??
    null;
  const boardPublicationState =
    currentPublication
      ? "current" as const
      : stalePublication
        ? "stale" as const
        : "none" as const;

  if (
    boardPublicationState !==
    "current"
  ) {
    evidenceGaps.push({
      key:
        "board-publication",
      label:
        "Board publication",
      state:
        boardPublicationState ===
          "stale"
          ? "stale"
          : "missing",
      action:
        "Review the management position, resolve outstanding information requests and approve the current board report.",
      owningModule: "pmo-analysis",
    });
  }

  const candidates = [
    ...state.evidenceDocuments
      .filter(
        (document) =>
          document.basisState ===
          "candidate",
      )
      .map(
        (document) => ({
          candidateId:
            "document:" +
            document.documentId,
          type:
            documentClassificationForReview(document).documentType,
          classification: documentClassificationForReview(document),
          label:
            document.sourceFilename,
          sourceRef:
            "evidence-document:" +
            document.documentId,
          status:
            "pending_review" as const,
          owningModule: "documents",
        }),
      ),
    ...terms.clauses
      .filter(
        (clause) =>
          clause.governanceState !==
          "effective",
      )
      .map(
        (clause) => ({
          candidateId:
            "contract-clause:" +
            clause.clauseKey,
          type:
            "contract_clause",
          label:
            (
              clause.identifier ??
              clause.clauseKey
            ) +
            (
              clause.heading
                ? " · " +
                  clause.heading
                : ""
            ),
          sourceRef:
            clause.sourceRef,
          status:
            "pending_review" as const,
          owningModule:
            "contract-particulars-bonds",
        }),
      ),
  ];

  const history:
    ManagementHistoryInput[] = [
      ...(state.auditHistory??[]).map(event=>({eventId:event.eventId,occurredAt:event.occurredAt,entity:'Project version '+event.projectVersion,
        action:event.operation,actor:event.actor.label,state:event.actor.identityVerified?(event.actor.kind==='user'?'attributed_user':'attributed_system'):'session_identity_unverified',sourceRef:'audit-request:'+event.requestId})),
      ...state.evidenceDocuments.map(
        (document) => ({
          eventId:
            "evidence-upload:" +
            document.documentId,
          occurredAt:
            document.uploadedAt,
          entity:
            document.sourceFilename,
          action:
            "Project evidence added or updated",
          actor: state.auditSourceActors?.['evidence:'+document.documentId]?.label??"Actor not recorded (legacy)",
          state:
            document.basisState,
          sourceRef:
            "evidence-document:" +
            document.documentId,
        }),
      ),
      ...state.boardPublicationHistory.map(
        (publication) => ({
          eventId:
            "board-publication:" +
            publication.publicationId,
          occurredAt:
            publication.finalizedAt,
          entity:
            publication.publicationId,
          action:
            publication.stale
              ? "Board publication became stale"
              : "Board publication finalized",
          actor: state.auditSourceActors?.['publication:'+publication.publicationId]?.label??"Actor not recorded (legacy)",
          state:
            publication.stale
              ? "stale"
              : "finalized",
          sourceRef:
            publication.sourceManifestId
              ? "source-manifest:" +
                publication.sourceManifestId
              : null,
        }),
      ),
      ...(state.lastRerunReceipt
        ? [
            {
              eventId:
                state.lastRerunReceipt
                  .receiptId,
              occurredAt:
                state.lastRerunReceipt
                  .generatedAt,
              entity:
                "Project control position",
              action:
                "Project position recalculated and cross-module certification executed",
              actor: state.auditSourceActors?.['rerun:'+state.lastRerunReceipt.receiptId]?.label??"Actor not recorded (legacy)",
              state:
                state.lastRerunReceipt
                  .certification
                  .state,
              sourceRef:
                "rerun-receipt:" +
                state.lastRerunReceipt
                  .receiptId,
            },
          ]
        : []),
    ].sort(
      (a, b) =>
        b.occurredAt.localeCompare(
          a.occurredAt,
        ),
    );

  const model =
    current?.revision.model ??
    null;
  const observedWbsLabels =
    model
      ? [
          ...new Set(
            model.wbs.map(
              (node) =>
                node.name ??
                node.wbsId,
            ),
          ),
        ].sort()
      : [];
  const activitiesWithWbs =
    model
      ? model.activities.filter(
          (activity) =>
            Boolean(
              activity.wbsId,
            ),
        ).length
      : 0;
  const observedCoveragePercent =
    model &&
    model.activities.length >
      0
      ? Number(
          (
            (
              activitiesWithWbs /
              model.activities.length
            ) *
            100
          ).toFixed(2),
        )
      : null;

  const evmByCurrency =
    commercial.performance
      .costControl.positions
      .map(
        (position) => ({
          currency:
            position.currency,
          cv:
            position.cv.value,
          spi:
            position.spi.value,
          cpi:
            position.cpi.value,
          state:
            position.spi.value !==
              null &&
            position.cpi.value !==
              null
              ? "established" as const
              : (
                    position.spi.value !==
                      null ||
                    position.cpi.value !==
                      null ||
                    position.cv.value !==
                      null
                  )
                ? "partial" as const
                : "missing" as const,
        }),
      );

  const canonicalFacts=projectFactsForState(state);
  const mp4=profiling?performance.now():0;
  const surfaces = buildManagementSurfaces({
    schemaVersion: "1.0",
    projectId,
    generatedAt,
    director,
    projectFacts:canonicalFacts,
    consistency,
    contractualCompletionAuthority: terms.contractualCompletionDate.state === "established" ? "official" : terms.contractualCompletionDate.state === "candidate" ? "provisional" : "source",
    negativeFloatCount: (resolvedModules.get("schedule-analytics")?.data as any)?.result?.float?.negativeFloatCount ?? null,
    modules: [
      ...scheduleInputs,
      ...commercialInputs,
    ],
    evidenceDocumentCount:
      state.evidenceDocuments.length,
    evidenceGaps,
    candidates,
    history,
    revisionAuthority: {
      baselineRevisionId:
        baseline?.revision
          .revisionId ??
        null,
      baselineLabel:
        baseline?.revision.label ??
        baseline?.sourceFilename ??
        null,
      currentRevisionId:
        current?.revision
          .revisionId ??
        null,
      currentLabel:
        current?.revision.label ??
        current?.sourceFilename ??
        null,
      currentDataDateIso:
        current?.revision.model
          .dataDateIso ??
        null,
      governedRevisionCount:
        state.schedules.filter(
          (item) =>
            !isScenarioRevision(item),
        ).length,
      recoveryScenarioCount:
        state.schedules.filter(
          (item) =>
            isScenarioRevision(item),
        ).length,
      correctionModule:
        "revision-trend",
    },
    wbsControl: {
      observedWbsCount:
        model?.wbs.length ??
        0,
      observedWbsLabels,
      activityCount:
        model?.activities.length ??
        0,
      activitiesWithWbs,
      observedCoveragePercent,
      officialWorkPackageCoveragePercent:
        null,
      officialWorkPackageState:
        "not_established",
    },
    commercial: {
      variationReconciliation: (commercial.sourceLedger?.temporalPosition?.money ?? [])
        .filter(row => row.kind === "Approved variation source values")
        .map(row => {
          const source = commercial.currencies.find(item => item.currency === row.currency)?.approvedVariationAmount;
          const partitions = (commercial.sourceLedger?.temporalPosition?.money ?? []).filter(item => item.kind === row.kind && item.currency === row.currency);
          const aggregate = partitions.length === 1 ? source?.value ?? null : null;
          return { currency: row.currency, taxBasis: row.taxBasis, sourceAggregate: aggregate,
            sourceState: source?.value!==null&&source?.value!==undefined?"reported_source_value":source?.state ?? "not_established", datedApprovedAmount: row.asOfValue,
            datedApprovedCount: row.asOfCount, futureCount: row.futureCount, undatedCount: row.undatedCount,
            state: aggregate === null || row.asOfValue === null ? "not_established" as const :
              Math.abs(aggregate - row.asOfValue) > 0.01 ? "conflicted" as const : "consistent" as const };
        }),
      overdueUnpaidPayments:
        payments.slaCounts
          .overdueUnpaid,
      paidLatePayments:
        payments.slaCounts
          .paidLate,
      lateNotices:
        commercial.claimsNotices
          .noticeTimelinessCounts
          .late,
      notIssuedNotices:
        commercial.claimsNotices
          .noticeTimelinessCounts
          .not_issued,
      evmByCurrency,
    },
    boardPublicationState,
  });
  const mp5=profiling?performance.now():0;
  const issueStage0=profiling?performance.now():0;
  const issues = [...resolvedModules.values()].flatMap(r=>r.issueAssessment?.issues??[]);
  const governanceIssues:ControlIssue[] = surfaces.commandCenter.governanceGaps.map(g=>({kind:'governance_review',code:'MANAGEMENT_GOVERNANCE_'+g.key,
    summary:g.label+' needs approval',detail:'Review and approve the current report before publication.',
    action:g.action,owner:'Project controls reviewer',moduleKeys:['master-dashboard','command-center','master-control-programme'],
    evidencePaths:['governanceGaps.'+g.key],sourceRefs:[],checkIds:[]}));
  const operations=operationalReporting(state);
  const operationChecks=([['NCR',operations.quality],['RFI',operations.rfi],['Risk',operations.risk]] as const).map(([name,r])=>{
    const actual=r.currentRecordCount+r.futureRecordCount+r.undatedRecordCount,expected=r.sourceRecordCount;
    return {metric:name+' dated source partition',expected,actual,passed:actual===expected};
  });
  const operationalIssues=assessModuleIssues({key:'command-center',status:'partial',reason:null,dependencies:['dated operational registers'],
    engineState:'ready',evidenceState:'partial',professionalState:'review_required',data:{operationalReporting:operations,registerDateReview:registerDateReview(state),
      challenge:{reconciliationState:'not_applicable'},systemEvidenceContract:{state:operationChecks.every(c=>c.passed)?'verified_for_checked_metrics':'failed',checks:operationChecks}}},certification).issues
    .map(issue=>({...issue,moduleKeys:[...managementModuleKeys]}));
  const issueAssessment=summarizeControlIssues([...issues,...governanceIssues,...operationalIssues]);
  const issueStage1=profiling?performance.now():0;
  const lookahead=(resolvedModules.get('lookahead-schedule')?.data as any);
  const overdueRows=Array.isArray(lookahead?.overdueBacklogRows)?lookahead.overdueBacklogRows:(lookahead?.rows??[]).filter((r:any)=>r.finishOverdue);
  const activities=resolvedModules.get('activity-analytics')?.data as any;
  // Management pages expose source counts and priority previews; complete
  // activity and backlog rows stay available on their specialist pages.
  const delayedSourceRows=(activities?.rows??[])
    .filter((r:any)=>!['wbs_summary','level_of_effort'].includes(r.activityType)&&r.scheduleDelayed===true);
  const exceptionPreview=[...delayedSourceRows]
    .sort((a:any,b:any)=>(a.criticality==='critical'?-1:0)-(b.criticality==='critical'?-1:0)||
      (b.finishOverdueCalendarDays??b.startOverdueCalendarDays??0)-(a.finishOverdueCalendarDays??a.startOverdueCalendarDays??0)||
      String(a.activityId).localeCompare(String(b.activityId))).slice(0,60);
  // The Activity Review page publishes these counts through the shared
  // canonical fact binding. The Dashboard is published without that pass, so
  // the same binding is applied here to keep one count on every page.
  const scheduleExceptions=activities?{dataDate:current?.revision.model.dataDateIso??null,
    counts:activities.counts?bindProjectFacts('activity-analytics',{counts:activities.counts},canonicalFacts).counts:activities.counts,
    totalDelayedOpenCount:delayedSourceRows.length,detailModule:'activity-analytics',
    rows:exceptionPreview.map((r:any)=>({activityId:r.activityId,name:r.name,status:r.status,currentStartIso:r.currentStartIso,
      currentFinishIso:r.forecastFinishIso??r.currentFinishIso,percentComplete:r.percentComplete,
      totalFloatHours:r.totalFloatHours,delayStatus:r.delayStatus,criticality:r.criticality}))}:null;
  const deliveryExceptions={actions:[...operations.actions.slice(0,60),...overdueRows.slice(0,60).map((r:any)=>{
    const missedStart=r.missedPlannedStart===true||r.classification==='missed_start';
    const missedFinish=r.finishOverdue===true||r.classification==='overdue';
    // The backlog includes missed starts with finishes in the future.
    const dueIso=missedFinish?r.finishIso:missedStart?r.startIso:null;
    const dataDate=current?.revision.model.dataDateIso;
    const elapsed=dataDate&&dueIso?Math.floor((Date.parse(dataDate.slice(0,10))-Date.parse(dueIso.slice(0,10)))/86400000):null;
    const basis=missedStart&&missedFinish?'overdue start and finish':missedFinish?'overdue finish':'missed start';
    return {recordId:r.activityId,type:'Activity',priority:'overdue',owner:null,dueIso,ageDays:null,
      overdueDays:elapsed!==null&&Number.isFinite(elapsed)?Math.max(0,elapsed):null,
      action:'Review '+basis+' for activity '+r.activityId+' ('+r.name+') and agree its recovery dates.',sourceRefs:[]};
  })],totalActionCount:operations.actions.length+overdueRows.length,detailModule:'lookahead-schedule',
    overdueActivityCount:Array.isArray(lookahead?.overdueBacklogRows)||Array.isArray(lookahead?.rows)?overdueRows.length:null};
  const currentForecast=(resolvedModules.get('independent-forecast')?.data as any)??null;
  const rawCompletion=currentForecast?.completionPosition??null;
  const completion=rawCompletion&&(currentForecast?.forecastReconciliationGate?.publishable!==true||hasUnreconciledScheduleCalendar(currentForecast))
    // Withhold everything derived from the withheld finish (same rule as the
    // project diagnosis), so no day difference survives without its finish.
    ?{...rawCompletion,independentFinishIso:null,differenceElapsedDays:null,differenceRows:[],calculationState:'unresolved',
      interpretation:'Independent CPM/calendar calculation failed reconciliation. No recalculated finish or day difference is presented as a management position.',
      reason:'Source calendar semantics or duration/day conversion needs reconciliation; use the submitted programme finish for now.'}
    :rawCompletion;
  const diagnosis=(resolvedModules.get('pmo-analysis')?.data as any)?.projectDiagnosis??null;
  const issueStage2=profiling?performance.now():0;
  const managementContext=projectManagementContext(state,resolvedModules,commercial);
  const issueStage3=profiling?performance.now():0;
  const visualControl=managementVisualControl(state,resolvedModules,commercial,managementContext);
  const issueStage4=profiling?performance.now():0;
  const interfaces=interfaceIntelligence(state);
  const issueStage5=profiling?performance.now():0;
  const accountability=crossDomainAccountability(state);
  const issueStage6=profiling?performance.now():0;
  const deliveryPosition=deliveryDashboard(state);
  const issueStage7=profiling?performance.now():0;
  const canonicalActions=projectActionRegisterForState(state).actions;
  const issueStage8=profiling?performance.now():0;
  // Do not overwrite grouped accountability decisions with the raw shared register.
  // Both totals remain explicitly distinguished by their authority and population.
  accountability.managementPosition=canonicalActions.length+' project actions in the shared register; '+accountability.actions.length+' owner/register action groups for this view. Underlying source record counts are retained separately.';
  // Management pages need evaluated as-of totals, not the same full NCR,
  // RFI and Risk source population a second time. Specialist pages retain the
  // exact dated records and full provenance for drill-down/export.
  const managementOperations=compactManagementOperationalReporting(operations);
  const mp6=profiling?performance.now():0;
  const result = { ...surfaces,
    sourceQuality: managementReportingData(state,{...sourceQualityPosition(resolvedModules,issueAssessment,state.evidenceDocuments,current?.revision.model.dataDateIso??null),registerDateReview:registerDateReview(state)},resolvedModules),
    masterDashboard: {actions:canonicalActions,projectFacts:canonicalFacts,projectDiagnosis:diagnosis,completionPosition:completion,delivery:deliveryPosition,visualControl,managementContext,scheduleExceptions,deliveryExceptions,...managementReportingData(state, surfaces.masterDashboard, resolvedModules),decisions:surfaces.commandCenter.decisions,trend:(resolvedModules.get("forecast-history")?.data as any)??null,issueAssessment,operationalReporting:managementOperations,sourceInterpretation:director?.sourceInterpretation},
    commandCenter: {projectDiagnosis:diagnosis,completionPosition:completion,scheduleExceptions,deliveryExceptions,delivery:deliveryPosition,visualControl,managementContext,...managementReportingData(state, surfaces.commandCenter, resolvedModules),actions:canonicalActions,issueAssessment,controls:({...surfaces.commandCenter.controls,reporting:managementOperations} as any),operationalReporting:managementOperations,interfaces,accountability,sourceInterpretation:director?.sourceInterpretation},
    masterControlProgramme: {visualControl,managementContext,interfaces,accountability,delivery:deliveryPosition,...managementReportingData(state, surfaces.masterControlProgramme, resolvedModules),issueAssessment,operationalReporting:managementOperations,sourceInterpretation:director?.sourceInterpretation} };
  for(const surface of [result.masterDashboard,result.commandCenter,result.masterControlProgramme,result.sourceQuality])Object.assign(surface,{sourceLabels:projectSourceLabels(state)});
  const allPages=new Map(resolvedModules);
  allPages.set('master-dashboard',{key:'master-dashboard',status:'partial',reason:null,dependencies:[],data:result.masterDashboard});
  allPages.set('command-center',{key:'command-center',status:'partial',reason:null,dependencies:[],data:result.commandCenter});
  allPages.set('master-control-programme',{key:'master-control-programme',status:'partial',reason:null,dependencies:[],data:result.masterControlProgramme});
  const pageChecks=checkPageValues(allPages);
  Object.assign(result.sourceQuality,{pageValueChecks:pageChecks});
  const pageFailures=pageChecks.filter(c=>c.state==='failed');
  if(pageFailures.length){
    const failures:ControlIssue[]=pageFailures.map(c=>({kind:'system_defect',code:'CROSS_PAGE_VALUE_MISMATCH',summary:c.metric+' differs across pages',detail:JSON.stringify(c.values),action:'Correct the shared producer or consumer and rerun the cross-page release checks.',owner:'CMeng',moduleKeys:c.values.map(v=>v.page),evidencePaths:[],sourceRefs:[],checkIds:[c.metric]}));
    result.sourceQuality.systemFailures.push(...failures);
    for(const surface of [result.masterDashboard,result.commandCenter,result.masterControlProgramme,result.sourceQuality])surface.issueAssessment=summarizeControlIssues([...issueAssessment.issues,...failures]);
  }
  const mp7=profiling?performance.now():0;
  if(profiling)process.stdout.write(JSON.stringify({event:'management_surface_profile',projectId,
    bundleMs:mp1-mp0,resolvedModulesMs:mp2-mp1,certificationMs:mp3-mp2,preBuildMs:mp4-mp3,
    buildSurfacesMs:mp5-mp4,issuesAndExceptionsMs:mp6-mp5,issueStageMs:{issues:issueStage1-issueStage0,exceptions:issueStage2-issueStage1,managementContext:issueStage3-issueStage2,visualControl:issueStage4-issueStage3,interfaces:issueStage5-issueStage4,accountability:issueStage6-issueStage5,delivery:issueStage7-issueStage6,actions:issueStage8-issueStage7},reportingAndChecksMs:mp7-mp6,totalMs:mp7-mp0})+'\n');
  managementProjectionCache.set(projectId, {version: state.version, data: result});
  return result;
}

export function managementSurfaceForProject(
  projectId: string,
  key: string,
): ModuleRuntimeResult | null {
  key=resolveModuleKey(key);
  const surfaces =
    managementSurfacesForProject(
      projectId,
    );
  if (!surfaces) {
    return null;
  }
  const data =
    key ===
    "master-dashboard"
      ? surfaces.masterDashboard
      : key ===
          "command-center"
        ? surfaces.commandCenter
        : key ===
            "master-control-programme"
          ? surfaces
              .masterControlProgramme
          : key === "source-quality" ? surfaces.sourceQuality : null;
  if (!data) {
    return null;
  }

  const currentEstablished =
    surfaces
      .masterControlProgramme
      .revisionAuthority
      .currentRevisionId !==
    null;
  const readiness =
    surfaces.masterDashboard
      .readiness;
  const specialistReviewCount =
    readiness.partial +
    readiness.blocked;
  const evidenceGapCount =
    surfaces.commandCenter
      .evidenceGaps.filter(
        (gap) =>
          gap.state !==
          "established",
      ).length;
  const managementReviewRequired =
    specialistReviewCount > 0 ||
    evidenceGapCount > 0 || surfaces.commandCenter.governanceGaps.length > 0 ||
    surfaces.masterDashboard.consistency.state !== "pass";

  return withPositionVerdict({
    key,
    issueAssessment: data.issueAssessment,
    status:
      !currentEstablished
        ? "partial"
        : managementReviewRequired
          ? "partial"
          : "ready",
    reason:
      !currentEstablished
        ? "A current confirmed programme is required before the integrated management position can be complete."
        : managementReviewRequired
          ? String(
              specialistReviewCount,
            ) +
            " specialist control view(s) and " +
            String(
              evidenceGapCount,
            ) +
            " management evidence gap(s) require review; the management surface is usable but is not a fully defensible all-clear."
          : null,
    engineState:
      "ready",
    evidenceState:
      managementReviewRequired
        ? "partial"
        : "established",
    professionalState:
      managementReviewRequired
        ? "review_required"
        : "defensible",
    dependencies: [
      "canonical specialist projections",
      "Project Director position",
      "governed evidence basis",
      "Commercial control position",
    ],
    data,
  });
}

export function overviewForProject(
  projectId: string,
): ProjectRuntimeOverview | null {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;

  const latest =
    projectControlSchedule(state);
  const programmeSchedules = state.schedules.filter(isProgrammeScheduleRevision);
  const retainedReceipt=state.lastRerunReceipt?.projectVersion===state.version?state.lastRerunReceipt:null;
  const receiptStates =
    new Map(
      (
        retainedReceipt?.moduleResults ??
        []
      ).map(
        (item) => [
          item.key,
          item.status,
        ],
      ),
    );
  const scheduleEstablished =
    programmeSchedules.length > 0;

  // Source facts do not change when a page opens, but completion of a checked
  // calculation must be visible. Reuse the same finished result as its owning
  // page, never invent readiness from source presence or start cold analysis.
  const finished=resolvedProjectCache.get(projectId);
  const calculated=finished?.version===state.version?finished.modules:null;
  const overviewModuleStates=certifiedAnalyticalModules.map(module=>{
    const live=calculated?.get(module.key);
    const recorded=receiptStates.get(module.key);
    return {
      key:module.key,
      status:live?.status??recorded??'partial' as const,
      reason:live?live.reason:recorded
        ?'The recorded specialist check is available for this project version; open its page to review the basis.'
        :'Specialist check not yet recorded for this project version; open the specialist page for its current findings.',
      issueAssessment:live?.issueAssessment,
    };
  });
  const managementEntry=managementProjectionCache.get(projectId);
  const management=managementEntry?.version===state.version?managementEntry.data:null;
  const overviewManagementStates=managementModuleKeys.map(key=>{
    const live=management?managementSurfaceForProject(projectId,key):null;
    const recorded=receiptStates.get(key);
    return {
      key,
      status:live?.status??recorded??'partial' as const,
      reason:live?live.reason:recorded
        ?'The recorded management check is available for this project version; open its page to review the basis.'
        :'Open this management page to review its current source-backed position. An overview does not certify a specialist page.',
      issueAssessment:live?.issueAssessment,
    };
  });

  const pmo=calculated?.get('pmo-analysis')?.data as any;
  const roleDiagnosis=pmo?.projectDiagnosis??null,roleCompletion=pmo?.completionPosition??null;
  const roleContext=(management?.masterDashboard as any)?.managementContext??null;
  const roleInterfaces=(management?.commandCenter as any)?.interfaces??null;
  const forecastData=calculated?.get('independent-forecast')?.data as any;
  const projectFacts=completedProjectFactsForState(state);
  const actionEntry=projectActionCache.get(reportingState(state));
  const canonicalActions=actionEntry?.version===state.version?actionEntry.value.actions:[];
  const compactActions=canonicalActions.slice(0,12).map(action=>({
    issue:action.issue??null,
    consequence:action.consequence??null,
    affectedScope:Array.isArray(action.affectedScope)?action.affectedScope:[],
    affectedMilestones:Array.isArray(action.affectedMilestones)?action.affectedMilestones:[],
    owner:pmcRoleOwner(action.owningModule??action.recordKey??'project controls',action.owner),
    organisation:action.organisation??null,
    requiredAction:action.requiredAction??null,
    dueIso:action.dueIso??null,
    sourceDueIso:action.sourceDueIso??null,sourceOverdueDays:action.sourceOverdueDays??null,sourceOverdueCount:action.sourceOverdueCount??null,knownSourceOverdueCount:action.knownSourceOverdueCount??null,sourceUnknownDueRecordCount:action.sourceUnknownDueRecordCount??null,
    escalation:action.escalation??null,
    severity:action.severity??null,
    authority:action.authority??null,
    owningModule:action.owningModule??null,
  }));
  const executiveMetrics=[
    {label:'Original contract completion',value:projectFacts?.time.contractualCompletionIso.value??null,unit:'date',basis:projectFacts?.time.contractualCompletionIso.basis??'Not calculated in this overview',health:'unavailable'},
    {label:'Contract completion including awarded EOT',value:projectFacts?.time.extendedContractCompletionIso.value??null,unit:'date',basis:projectFacts?.time.extendedContractCompletionIso.basis??'Not calculated in this overview',health:'unavailable'},
    {label:'Submitted programme finish',value:projectFacts?.schedule.submittedProgrammeCompletionIso.value??null,unit:'date',basis:projectFacts?.schedule.submittedProgrammeCompletionIso.basis??'Not calculated in this overview',health:'unavailable'},
    {label:'Programme calendar recalculation',value:forecastData?.forecastReconciliationGate?.publishable===true&&!hasUnreconciledScheduleCalendar(forecastData)?forecastData?.independentForecastCompletionIso??null:null,unit:'date',
      basis:(forecastData?.forecastReconciliationGate?.publishable!==true||hasUnreconciledScheduleCalendar(forecastData))?'Withheld from management until all forecast and source-calendar checks pass.':'Independent source-calendar CPM with stated qualifications.',health:'unavailable'},
    {label:'Critical activities',value:projectFacts?.schedule.criticalActivityCount.value??null,unit:null,basis:projectFacts?.schedule.criticalActivityCount.basis??'Not calculated in this overview',health:(projectFacts?.schedule.negativeFloatActivityCount.value??0)>0?'attention':'unavailable'},
    {label:'Near-critical activities',value:projectFacts?.schedule.nearCriticalActivityCount.value??null,unit:null,basis:projectFacts?.schedule.nearCriticalActivityCount.basis??'Not calculated in this overview',health:'unavailable'},
  ];
  const executiveDecisions=canonicalActions.slice(0,8).map(action=>({
    description:action.issue,
    accountableOwner:pmcRoleOwner(action.owningModule??action.recordKey??'project controls',action.owner),
    dueDate:action.dueIso??null,
    sourceDueIso:action.sourceDueIso??null,sourceOverdueDays:action.sourceOverdueDays??null,
    requiredAuthority:action.authority??null,
    dependencyParty:action.organisation??null,
    state:'open',
  }));
  const roleLensContext = {
    dataDateIso:
      latest?.revision.model
        .dataDateIso ?? null,
    planning: {
      criticalCount:
        projectFacts?.schedule.criticalActivityCount.value??null,
      nearCriticalCount:
        projectFacts?.schedule.nearCriticalActivityCount.value??null,
      negativeFloatCount:
        projectFacts?.schedule.negativeFloatActivityCount.value??null,
      drivingNetworkState:
        roleDiagnosis?.network
          ?.state ?? null,
      drivers:
        Array.isArray(
          roleDiagnosis?.network
            ?.rows,
        )
          ? roleDiagnosis.network.rows
              .slice(0, 10)
              .map((row: any) => ({
                activityId:
                  row.activityId ??
                  null,
                name:
                  row.name ?? null,
                wbs:
                  row.wbs ??
                  row.wbsPath ??
                  null,
                calculatedFinishIso:
                  row.calculatedFinishIso ??
                  row.finishIso ??
                  null,
                totalFloatHours:
                  row.totalFloatHours ??
                  row.independentTotalFloatHours ??
                  null,
              }))
          : [],
      revision:
        roleDiagnosis?.revision
          ? {
              state:
                roleDiagnosis
                  .revision.state ??
                null,
              fromRevisionId:
                roleDiagnosis
                  .revision
                  .fromRevisionId ??
                null,
              toRevisionId:
                roleDiagnosis
                  .revision
                  .toRevisionId ??
                null,
              modified:
                roleDiagnosis
                  .revision.modified ??
                null,
              added:
                roleDiagnosis
                  .revision.added ??
                null,
              removed:
                roleDiagnosis
                  .revision.removed ??
                null,
              finishMovementCalendarDays:
                roleDiagnosis
                  .revision
                  .finishMovementCalendarDays ??
                null,
            }
          : null,
    },
    controls: {
      progress:
        roleContext?.crossModule
          ?.progress?.progressBases ??
        null,
      forecastCompletionIso:
        roleCompletion
          ?.independentFinishIso ??
        null,
      // Same key is the submitted programme finish on a revision-trend point;
      // here it is the CMeng recalculated finish. State the basis.
      forecastCompletionBasis:"cmeng_independent_recalculation" as const,
      submittedCompletionIso:
        projectFacts?.schedule.submittedProgrammeCompletionIso.value??null,
      scheduleVarianceDays:
        roleCompletion
          ?.differenceElapsedDays ??
        null,
      revision:
        roleDiagnosis?.revision
          ? {
              state:
                roleDiagnosis
                  .revision.state ??
                null,
              modified:
                roleDiagnosis
                  .revision.modified ??
                null,
              finishMovementCalendarDays:
                roleDiagnosis
                  .revision
                  .finishMovementCalendarDays ??
                null,
            }
          : null,
    },
    projectDirector: {
      actions: compactActions,
    },
    programDirector: {
      programmeStages:
        Array.isArray(
          roleContext?.schedule
            ?.programmeStages,
        )
          ? roleContext?.schedule?.programmeStages
              .slice(0, 10)
          : [],
      interfaces:
        Array.isArray(
          roleInterfaces?.rows,
        )
          ? roleInterfaces?.rows
              .slice(0, 10)
              .map((row: any) => ({
                interfaceId:
                  row.interfaceId ??
                  null,
                package:
                  row.package ?? null,
                affectedWorkfront:
                  row.affectedWorkfront ??
                  null,
                requiredDate:
                  row.requiredDate ??
                  null,
                responsibleParty:
                  row.responsibleParty ??
                  null,
                consequence:
                  row.consequence ??
                  null,
                state:
                  row.state ?? null,
              }))
          : [],
    },
    executive: {
      contractualCompletionIso:
        projectFacts?.time.contractualCompletionIso.value??null,
      submittedCompletionIso:
        projectFacts?.schedule.submittedProgrammeCompletionIso.value??null,
      forecastCompletionIso:
        roleCompletion
          ?.independentFinishIso ??
        null,
      // Same key is the submitted programme finish on a revision-trend point;
      // here it is the CMeng recalculated finish. State the basis.
      forecastCompletionBasis:"cmeng_independent_recalculation" as const,
      metrics:executiveMetrics.filter(metric=>metric.value!==null&&metric.value!==undefined).slice(0,10),
      commercialByCurrency:(projectFacts?.commercial.currencies??[]).slice(0,8).map((row:any)=>({currency:row.currency})),
      decisions:executiveDecisions,
    },
  };

  return {
    projectId,
    releaseCommitSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null,
    version: state.version,
    demo: state.demo,
    testProject:state.testProject===true,
    revisionCount:
      programmeSchedules.length,
    baselineRevisionCount:
      programmeSchedules.filter(
        (item) =>
          item.role === "baseline" ||
          item.role ===
            "revised_baseline",
      ).length,
    updateRevisionCount:
      programmeSchedules.filter(
        (item) =>
          item.role === "update",
      ).length,
    recoveryRevisionCount:
      programmeSchedules.filter(
        (item) =>
          isScenarioRevision(item),
      ).length,
    evidenceDocumentCount:
      state.evidenceDocuments.length,
    evidenceCategoryCounts:
      state.evidenceDocuments.reduce(
        (counts, document) => {
          counts[document.category] =
            (counts[
              document.category
            ] ?? 0) + 1;
          return counts;
        },
        {} as Record<string, number>,
      ),
    latestRevisionId:
      latest?.revision
        .revisionId ?? null,
    latestRevisionLabel:
      latest?.revision.label ??
      latest?.sourceFilename ??
      null,
    latestDataDateIso:
      latest?.revision.model
        .dataDateIso ?? null,
    boqState:
      state.boq?.state ?? null,
    contractLoaded:
      state.contract !== null,
    delayClaimsLoaded:
      state.controls
        .delayClaims !== null,
    minimumEvidenceBasis: {
      schedule: {
        required: true,
        established:
          scheduleEstablished,
        revisionCount:
          programmeSchedules.length,
        latestRevisionId:
          latest?.revision
            .revisionId ?? null,
        latestDataDateIso:
          latest?.revision.model
            .dataDateIso ?? null,
      },
      boq: {
        required: true,
        established:
          state.boqRevisions.length > 0,
        revisionCount:
          state.boqRevisions.length,
        currentIngestionId:
          state.boq
            ?.ingestionId ?? null,
      },
      ready:
        scheduleEstablished &&
        state.boqRevisions.length > 0,
    },
    optionalEvidence:
      [
        ...state.evidenceDocuments
          .reduce(
            (map, document) => {
              if (
                document.category ===
                  "schedule" ||
                (
                  document.category ===
                    "boq_cost" &&
                  document.documentType ===
                    "boq"
                )
              ) {
                return map;
              }
              const existing =
                map.get(
                  document.documentType,
                );
              map.set(
                document.documentType,
                {
                  documentType:
                    document.documentType,
                  count:
                    (existing?.count ??
                      0) + 1,
                  latestUploadedAt:
                    existing &&
                    existing.latestUploadedAt >
                      document.uploadedAt
                      ? existing.latestUploadedAt
                      : document.uploadedAt,
                },
              );
              return map;
            },
            new Map<
              string,
              {
                documentType:
                  string;
                count: number;
                latestUploadedAt:
                  string;
              }
            >(),
          )
          .values(),
      ].sort(
        (a, b) =>
          a.documentType.localeCompare(
            b.documentType,
          ),
      ),
    activeEvidenceBasis:
      JSON.parse(
        JSON.stringify(
          state.activeEvidenceBasis,
        ),
      ),
    lastRerunReceipt:
      state.lastRerunReceipt
        ? JSON.parse(
            JSON.stringify(
              state.lastRerunReceipt,
            ),
          )
        : null,
    boardPublicationHistory:
      state.boardPublicationHistory
        .map(
          (item) => ({
            ...item,
            evidenceReceiptIds: [
              ...item.evidenceReceiptIds,
            ],
          }),
        ),
    roleLensContext,
    managementStates:
      overviewManagementStates,
    moduleStates:
      overviewModuleStates,
  };
}

export function rerunProject(
  projectId: string,
  evidenceChanges:
    EvidenceBasisEffect[] = [],
): EvidenceRerunReceipt | null {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;

  invalidateProject(projectId);
  const generatedAt =
    new Date().toISOString();
  const bundle =
    buildBundle(state);
  const resolvedModules =
    new Map(
      certifiedAnalyticalModules.map(
        (module) => [
          module.key,
          resolveProjectModule(
            state,
            module.key,
          ),
        ],
      ),
    );
  const certification =
    certifyCrossModuleConsistency({
      generatedAt,
      state: reportingState(state),
      modules:
        resolvedModules,
      director:
        bundle.director,
      boardReport:
        bundle.boardReport,
    });

  const evidenceFingerprint =
    createHash("sha256")
      .update(
        JSON.stringify({
          projectVersion:
            state.version,
          evidence:
            state.evidenceDocuments
              .map(
                (document) => ({
                  documentId:
                    document.documentId,
                  hash:
                    document
                      .sourceHashSha256,
                  familyKey:
                    document.familyKey,
                  basisState:
                    document.basisState,
                  supersededBy:
                    document
                      .supersededByDocumentId,
                }),
              )
              .sort(
                (a, b) =>
                  a.documentId.localeCompare(
                    b.documentId,
                  ),
              ),
          activeBasis:
            state.activeEvidenceBasis,
        }),
      )
      .digest("hex");

  const currentPublication =
    state.boardPublicationHistory
      .filter(
        (item) =>
          !item.stale,
      )
      .sort(
        (a, b) =>
          a.finalizedAt.localeCompare(
            b.finalizedAt,
          ),
      )
      .at(-1) ??
    null;
  const stalePublication =
    state.boardPublicationHistory
      .filter(
        (item) =>
          item.stale,
      )
      .sort(
        (a, b) =>
          a.finalizedAt.localeCompare(
            b.finalizedAt,
          ),
      )
      .at(-1) ??
    null;

  const receipt:
    EvidenceRerunReceipt = {
    receiptId:
      "rerun_" +
      createHash("sha256")
        .update(
          projectId +
            "|" +
            String(
              state.version,
            ) +
            "|" +
            evidenceFingerprint,
        )
        .digest("hex")
        .slice(0, 24),
    projectId,
    generatedAt,
    projectVersion:
      state.version,
    evidenceFingerprint,
    activeBasis: JSON.parse(
      JSON.stringify(
        state.activeEvidenceBasis,
      ),
    ),
    evidenceChanges:
      evidenceChanges.map(
        (change) => ({
          ...change,
        }),
      ),
    moduleCount:
      resolvedModules.size,
    moduleResults: [
      ...resolvedModules.entries(),
    ]
      .map(
        ([key, value]) => ({
          key,
          status:
            value.status,
        }),
      )
      .sort(
        (a, b) =>
          a.key.localeCompare(
            b.key,
          ),
      ),
    pmoRecalculated:
      resolvedModules.has(
        "pmo-analysis",
      ),
    directorRecalculated:
      bundle.director !==
      null,
    boardPublicationState:
      currentPublication
        ? "current"
        : stalePublication
          ? "stale"
          : "none",
    certification: {
      state:
        certification.state,
      checkCount:
        certification
          .checkCount,
      failedCheckIds: [
        ...certification
          .failedCheckIds,
      ],
      checks:
        certification.checks.map(
          (check) => ({
            ...check,
            values:
              check.values.map(
                (value) => ({
                  ...value,
                }),
              ),
          }),
        ),
    },
    diagnostics: [
      ...(certification.state ===
      "pass"
        ? [
            "CROSS_MODULE_CERTIFICATION_PASS",
          ]
        : [
            "CROSS_MODULE_CERTIFICATION_FAIL",
          ]),
    ],
  };

  runtimeProjects
    .recordRerunReceipt(
      projectId,
      receipt,
    );
  return receipt;
}

export function invalidateProject(
  projectId: string,
): void {
  bundleCache.delete(projectId);
  resolvedProjectCache.delete(projectId);
  managementProjectionCache.delete(projectId);
  for (
    const key of
      planningModuleCache.keys()
  ) {
    if (
      key.startsWith(
        projectId + "::",
      )
    ) {
      planningModuleCache.delete(
        key,
      );
    }
  }
  for (
    const key of
      specialistModuleCache.keys()
  ) {
    if (
      key.startsWith(
        projectId +
          "::specialist::",
      )
    ) {
      specialistModuleCache.delete(
        key,
      );
    }
  }
  specialistChallengeCache.delete(
    projectId,
  );
  claimsFastContextCache.delete(
    projectId,
  );
}
