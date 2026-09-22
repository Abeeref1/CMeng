import { documentClassificationForReview } from "./document-identification";
import { reportingScope } from "../../truth-kernel/src";
import { attachReportingContract, reportingData, managementReportingData } from "./reporting-contract";
import { activityMovementAnalysis } from "../../activity-analytics/src/movement";
import { reportingState, claimsReporting } from "./reporting-state";
import { commercialFoundationForState } from "./commercial-foundation-runtime";
import { parseScheduleTime } from "../../schedule-analysis-core/src";
import { checkProjectionIntegrity } from "./projection-integrity";
import { resolveRevisionActivityCorrespondence } from "../../schedule-revision-core/src";
import { activityPopulation, isExecutionActivity, numericDistribution } from "../../schedule-analysis-core/src";
import {
  canonicalCommercialModule,
  commercialPositionForState,
} from "./commercial-runtime";
import { canonicalTimeClaims, projectControlSchedule } from "./canonical-time-claims";
import { projectScheduleControlBasis } from "./schedule-control-basis";
import { sourceProductivityForecastEvidence } from "./source-productivity-forecast";
import { canonicalResourceModule } from "./canonical-resource-runtime";
import { createHash } from "node:crypto";
import {
  analyzeSchedule,
} from "../../schedule-analysis-core/src";
import {
  buildActivityAnalyticsProjection,
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
  forecastSnapshotFromProjection,
} from "../../forecast-history/src";
import {
  buildIndependentForecastProjection,
} from "../../independent-forecast/src";
import {
  buildLookAheadProjection,
} from "../../lookahead-schedule/src";
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
  commercialModules,
  scheduleModules,
} from "./registry";
import {
  applyUniversalModuleChallenges,
} from "./module-challenges";
import {
  buildQuantityScheduleMapping,
} from "../../cross-domain-mapping/src";
import type {
  DelayClaimsModel,
} from "../../delay-analysis-core/src";
import {
  certifyCrossModuleConsistency,
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

interface ProjectionBundle {
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
  const programmeSchedules = state.schedules.filter(isProgrammeScheduleRevision).filter(item=>reportingScope(item.revision.model.dataDateIso??item.revision.effectiveAt,cutoff)==='as_of');
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
        item.role !== "recovery",
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
    sourcePositive === null ||
    !analyticalAvailable
      ? null
      : Number(
          (
            calculatedPositive -
            sourcePositive
          ).toFixed(6),
        );
  const negativeGap =
    sourceNegative === null ||
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
      const progress =
        analyzeSchedule(model)
          .progress
          .durationWeightedPercentComplete
          .value;
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

  const generatedAt =
    new Date().toISOString();
  const modules =
    new Map<
      string,
      ModuleRuntimeResult
    >();

  for (const module of scheduleModules) {
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
  const controlledBaselineCompletionCandidates =
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
            controlledBaselineFinish(
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
    controlledBaselineCompletionCandidates
      .at(-1) ??
    null;
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
    const before =
      parseScheduleTime(baselineIso);
    const after =
      parseScheduleTime(currentIso);
    if (
      !Number.isFinite(before) ||
      !Number.isFinite(after)
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
                            controlledBaselineCompletionCandidates
                              .length ===
                            0
                              ? "missing" as const
                              : controlledBaselineCompletionCandidates
                                    .length ===
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
                                      controlledBaselineCompletionCandidates
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
              distribution: numericDistribution(knownControlledVariances),
              ...scheduleAnalyticsRaw
                .result
                .finishVariance,
              populationBasis: "source_records" as const,
              denominator: model.activities.length,
              method:
                "controlled baseline programme versus current/forecast finish",
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

  const lookAhead =
    buildLookAheadProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.lookAhead,
        readinessEvidence:
          state.controls
            .readinessEvidence,
      },
    );
  modules.set(
    "lookahead-schedule",
    available(
      "lookahead-schedule",
      lookAhead,
    ),
  );

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
      },
    );
  modules.set(
    "progress-scurve",
    available(
      "progress-scurve",
      progressScurve,
    ),
  );

  const milestonesRaw =
    buildMilestonesProjection(
      model,
      {
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
                return refreshMilestoneManagementControl({
                  ...row,
                  baselineDateIso:
                    baselineDate,
                  varianceDays:
                    varianceDays(
                      baselineDate,
                      row.currentDateIso,
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

  const nearCriticalRaw =
    buildNearCriticalProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.nearCritical,
        config: scheduleAnalysisConfig,
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
        scheduleControlBasis.sourceReportedNearCriticalLabelCount === null
          ? null
          : nearCriticalRaw.floatRiskWatchlistCount -
            scheduleControlBasis.sourceReportedNearCriticalLabelCount,
      status:
        scheduleControlBasis.sourceReportedNearCriticalLabelCount === null
          ? "source_not_reported"
          : nearCriticalRaw.floatRiskWatchlistCount ===
              scheduleControlBasis.sourceReportedNearCriticalLabelCount
            ? "reconciled"
            : "difference",
    },
    definitions: {
      critical:
        "TF <= governed critical float threshold",
      nearCritical:
        "governed critical threshold < TF <= N activity-calendar working days",
      floatRiskWatchlist:
        scheduleAnalysisConfig.floatRiskWatchlistIncludesCriticalThreshold
          ? "governed critical threshold <= TF <= N activity-calendar working days"
          : "governed critical threshold < TF <= N activity-calendar working days",
    },
  };
  const nearCritical =
    controlledBaseline
      ? {
          ...nearCriticalBase,
          controlledBaselineRevisionId:
            controlledBaseline
              .revision.revisionId,
          rows:
            nearCriticalBase.rows.map(
              (row) => {
                const baseline =
                  baselineByActivity.get(
                    row.activityId,
                  );
                return {
                  ...row,
                  baselineFinishIso:
                    baseline
                      ? controlledBaselineFinish(
                          baseline,
                        )
                      : null,
                };
              },
            ),
        }
      : nearCriticalBase;
  modules.set(
    "near-critical",
    available(
      "near-critical",
      nearCritical,
    ),
  );

  const progressBreakdown =
    buildProgressBreakdownProjection(
      model,
      {
      baselineModel: controlledBaseline?.revision.model ?? null,
      previousModel: ordered.at(-2)?.revision.model ?? null,
          config: scheduleAnalysisConfig,
        generatedAt,
        producerVersion:
          versions.breakdown,
      },
    );
  modules.set(
    "progress-breakdown",
    available(
      "progress-breakdown",
      progressBreakdown,
    ),
  );

  const independentForecast = cachedIndependentForecast(model, generatedAt);
  const productivityForecast =
    sourceProductivityForecastEvidence(state);
  const forecastTaxonomy = {
    contractorProgramme: {
      label: "Contractor Programme Forecast",
      completionIso:
        independentForecast.sourceForecastCompletionIso,
      authority: "submitted_programme",
      state:
        independentForecast.sourceForecastCompletionIso !== null
          ? "established"
          : "missing",
    },
    sourceProductivity: {
      label: "Source Productivity Forecast",
      completionIso:
        productivityForecast.completionIso,
      authority: "source_productivity_evidence",
      state: productivityForecast.state,
      method: productivityForecast.method,
      driverWorkPackageId:
        productivityForecast.driverWorkPackageId,
      workPackageCount:
        productivityForecast.workPackageCount,
      calculatedWorkPackageCount:
        productivityForecast.calculatedWorkPackageCount,
      coveragePercent:
        productivityForecast.calculationCoveragePercent,
      reconciliation:
        productivityForecast.reconciliation,
      sourceRefs: productivityForecast.sourceRefs,
    },
    cmengCpm: {
      label: "CMeng Independent CPM Forecast",
      completionIso:
        independentForecast.independentForecastCompletionIso,
      authority: "cmeng_deterministic",
      state:
        independentForecast.complete
          ? "established"
          : "review_required",
    },
    probabilistic: {
      label: "CMeng Probabilistic Forecast",
      p50CompletionIso:
        independentForecast.probabilistic.p50CompletionIso,
      p80CompletionIso:
        independentForecast.probabilistic.p80CompletionIso,
      p90CompletionIso:
        independentForecast.probabilistic.p90CompletionIso,
      authority: "non_official_comparator",
      state:
        independentForecast.probabilistic.status,
    },
  };
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
      },
      [],
      independentForecast.complete
        ? "ready"
        : "partial",
      independentForecast.complete
        ? null
        : "Independent forecast contains unresolved schedule evidence.",
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
      progressEvidence:
        state.controls
          .progressEvidence,
    });
  modules.set(
    "progress-report",
    available(
      "progress-report",
      progressReport,
    ),
  );

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
        ["second schedule revision"],
        "partial",
        "CMeng has preserved the current revision. A second revision is required for an actual field-level change comparison.",
      ),
    );
  }

  const forecastSnapshots =
    ordered.map((stored) =>
      forecastSnapshotFromProjection(
        buildIndependentForecastProjection(
          stored.revision.model,
          {
            generatedAt,
            producerVersion:
              versions.forecast +
              ":" +
              stored.revision
                .revisionId,
          },
        ),
        "forecast-" +
          stored.revision
            .revisionId,
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
          ? "Resource support evidence exists only as candidate and is not promoted to governed utilization."
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
    modules.set(
      "resource-utilization",
      blocked(
        "resource-utilization",
        "The current schedule revision has no resource assignment evidence.",
        ["resource-loaded XER"],
      ),
    );
    modules.set(
      "manhour-scurve",
      blocked(
        "manhour-scurve",
        "The current schedule revision has no governed labour assignment evidence.",
        ["resource-loaded XER"],
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
        ? delayModel
          ? "ready"
          : "partial"
        : "partial",
      ordered.length < 2
        ? "Only one revision exists. CMeng cannot calculate a comparative window until a second revision is supplied."
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
        independentScheduleMovementAvailable:
          windows.windowCount > 0,
        linkedClaimCount,
        unlinkedClaimCount,
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
      delayClaims.events.length > 0 &&
      linkedClaimCount > 0 &&
      windows.windowCount > 0
        ? "ready"
        : "partial",
      analyticalDelayModel.claims.length > 0 &&
      delayClaims.events.length === 0
        ? analyticalDelayModel.claims.length +
          " claim records are available, but no governed delay events are established. Programme movement cannot be attributed to those claims."
        : linkedClaimCount === 0 &&
            analyticalDelayModel.claims.length > 0
          ? "Claim records are not linked to governed delay events, so causation and entitlement remain unassessed."
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
      },
    );
  const noticeAssessmentAvailable =
    noticesClaims.eventCount > 0 &&
    analyticalDelayModel.noticeRequirements.length > 0;
  const noticeAssessable =
    noticeAssessmentAvailable &&
    noticesClaims.noticeRequirementMissingCount === 0;
  modules.set(
    "notices-claims",
    available(
      "notices-claims",
      {
        ...noticesClaims,
        contractorNoticeClaimEvidenceSubmitted:
          delayModel !== null,
        noticeAssessmentState:
          noticeAssessable
            ? "assessed"
            : noticeAssessmentAvailable
              ? "partially_assessable"
              : "not_assessable_without_delay_events_and_requirements",
        linkedClaimCount,
        unlinkedClaimCount,
      },
      [
        "delay events",
        "notice requirements",
        "notices",
        "claims",
      ],
      noticeAssessable
        ? "ready"
        : "partial",
      noticeAssessable
        ? null
        : noticeAssessmentAvailable &&
            noticesClaims.noticeRequirementMissingCount > 0
          ? noticesClaims.noticeRequirementMissingCount +
            " governed delay event(s) do not have an applicable notice requirement. Assessed events remain visible, but the page stays under review."
          : noticesClaims.claimCount > 0
            ? noticesClaims.claimCount +
              " claim records are available, but notice timeliness is not assessable until governed delay events and applicable notice requirements are linked."
            : "Notice compliance is not assessable until governed delay events, applicable notice requirements and actual notice evidence are established.",
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
            positiveIndependentMovementDays:
              Math.max(
                0,
                window
                  .independentForecastMovementDays ??
                  0,
              ),
            positiveProgrammeMovementDays:
              Math.max(
                0,
                window
                  .strongestProgrammeMovementDays ??
                  0,
              ),
            programmeMovementBasis:
              window
                .strongestProgrammeMovementBasis,
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
              "Programme movement is retained for analysis but is not treated as EOT entitlement without a governed contract-time basis.",
            ],
            includedCandidateDays: 0,
          }),
        ),
      basis:
        "analytical_candidate_not_contractual_determination",
      assumptions: [
        "Observed programme movement is schedule evidence only. No analytical time-impact candidate is stated without event/causation evidence and a governed contract-time basis.",
      ],
      diagnostics: [
        "CONTRACT_TIME_BASIS_NOT_SUBMITTED",
        ...(windows
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
      generatedAt,
      producerVersion:
        "uat-delivery-challenge-v1",
      schedule: model,
      quantities:
        state.quantities,
      resources:
        usableResources,
      independentForecast,
      contractTimeBasis:
        state.controls
          .contractTimeBasis,
      submittedManpowerPlan:
        state.submittedManpowerPlan,
    });

  const contractValueExtraction =
    state.contract
      ? extractContractValue(
          state.contract,
        )
      : null;

  for (const module of commercialModules) {
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
      buildChallengeContractProjection(
        state.contract,
        {
          generatedAt,
          producerVersion:
            versions.challenge,
        },
      );
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
              ? "Governed contract value is established."
              : contractValueExtraction
                    ?.state ===
                  "candidate"
                ? "CMeng found a contract value candidate in the contract. It is visible for review but is not used as a governed contract value until promoted."
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
        challengeContract !== null &&
        deliveryChallenge.position !==
          "not_yet_supportable" &&
        deliveryChallenge.position !==
          "scenario_only"
      )
        ? "ready"
        : "partial",
      challengeContract === null
        ? "Delivery challenge is available, but contractual clause intelligence is unavailable until a contract is loaded."
        : deliveryChallenge.position ===
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
        "No resource-loaded schedule was submitted. CMeng still derives 4/6/8 crew work-front scenarios and compares any submitted manpower plan instead of returning Unavailable.",
      ),
    );

    const remainingDays =
      deliveryChallenge
        .scheduleChallenge
        .remainingDurationDays;
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
        }));

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
        "No governed labor assignments were submitted. CMeng derives scenario remaining man-hours from concurrent work fronts and clearly labels them as scenarios.",
      ),
    );
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
            analyticalTimeImpactCandidateDays:
              eotAssessment
                ?.analyticalTimeImpactCandidateDays ??
              windows
                ?.positiveProgrammeMovementDays ??
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
      grossPositiveAnalyticalMovementDays: windows?.positiveProgrammeMovementDays ?? null,
      movementInterpretation: "Gross positive activity movement and net submitted project-finish movement have different bases. Their difference does not prove overlap, concurrency or entitlement.",
    };
    pmo.resources = { ...pmo.resources, weeklyCapacityCoveragePercent: resourceData?.weeklyCapacityEvidence?.capacityCoveragePercent ?? null,
      weeklyOverloadedResourceCount: resourceData?.weeklyOverloadedResourceCount ?? null };
    pmo.progress = { ...pmo.progress, lookAheadMissedStartCount: lookAhead.missedStartCount ?? null };
  }

  applyUniversalModuleChallenges({
    state,
    generatedAt,
    model,
    independentForecast,
    deliveryChallenge,
    modules,
  });

  for (const [key, result] of modules) modules.set(key, checkProjectionIntegrity(result, model, scheduleAnalysisConfig));

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
        generatedAt,
        projectId:
          state.projectId,
        scheduleAnalytics,
        progressReport,
        independentForecast,
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
            evidenceCoverage(
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



const quantityModuleCache = new WeakMap<ProjectRuntimeState, { version: number; result: ModuleRuntimeResult }>();
function canonicalQuantityModule(state: ProjectRuntimeState, model: ProjectRuntimeState["schedules"][number]["revision"]["model"], generatedAt: string): ModuleRuntimeResult {
  const cached = quantityModuleCache.get(state);
  if (cached?.version === state.version) return cached.result;
  const quantities = state.quantities;
  if (!quantities) return available("quantity-scurve", {
    schemaVersion: "1.0", projectionKey: "quantity_scurve", projectId: state.projectId,
    scheduleRevisionId: model.sourceRevisionId, dataDateIso: model.dataDateIso,
    allocationState: "missing", mappingBasis: "missing", boqState: "not_established", series: [],
    unmappedItemIds: [], partiallyAllocatedItemIds: [], overAllocatedItemIds: [],
    diagnostics: ["BOQ_QUANTITY_BASIS_NOT_ESTABLISHED"],
  }, ["BOQ"], "partial", "BOQ quantities have not been established.");
  const sameRevision = quantities.scheduleRevisionId === model.sourceRevisionId;
  const inferredMapping = sameRevision ? buildQuantityScheduleMapping(quantities, model) : null;
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
  const mappingBasis = !sameRevision ? "revision_mismatch" : scenario ? "candidate_scenario" : quantities.allocations.length ? "governed" : "missing";
  const result = available("quantity-scurve", {
    ...projection, allocationState: scenario ? "partial" : projection.allocationState,
    mappingBasis, candidateMappingState: sameRevision ? "evaluated" : "revision_mismatch", inferredMapping,
    boqState: "loaded", boqItemCount: quantities.items.length,
    knownQuantityItemCount: quantities.items.filter(item => item.contractQuantity !== null && Number.isFinite(item.contractQuantity) && item.contractQuantity >= 0).length,
    allocatedItemCount: mappedItemIds.size,
    itemLinkCoveragePercent: quantities.items.length ? mappedItemIds.size / quantities.items.length * 100 : null,
    unmappedKnownQuantityItemIds: projection.unmappedItemIds,
    unmappedItemIds: quantities.items.filter(item => !mappedItemIds.has(item.quantityItemId)).map(item => item.quantityItemId),
    actualAuthority: "measured_installed_quantities", actualIndependentOfScheduleMapping: true,
    series: projection.series.map(series => ({ ...series, authority: scenario ? "scenario_mapping" : "governed_mapping",
      actualAuthority: "measured_installed_quantities",
      points: series.points.map(point => ({ ...point, actualInstalledQuantity: model.dataDateIso !== null && point.dateIso.slice(0,10) <= model.dataDateIso.slice(0,10) ? point.actualInstalledQuantity : null })) })),
    diagnostics: [...projection.diagnostics, ...(scenario ? ["QUANTITY_PLAN_IS_CANDIDATE_SCENARIO_NOT_GOVERNED"] : []), ...(!sameRevision ? ["QUANTITY_MAPPING_REVISION_MISMATCH_PLANS_WITHHELD"] : [])],
  }, ["BOQ", "quantity-to-activity mapping", "installed quantity measurements"],
    sameRevision && !scenario && projection.allocationState === "complete" ? "ready" : "partial",
    mappingBasis === "governed" ? null : "BOQ and measured installations remain visible by unit. Planned quantities require a governed schedule mapping; any candidate plan is a scenario.");
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

  const generatedAt =
    new Date().toISOString();
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
            generatedAt,
            producerVersion:
              "planning-fast:lookahead-v1",
            readinessEvidence:
              state.controls
                .readinessEvidence,
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
          scheduleControlBasis.sourceReportedNearCriticalLabelCount === null
            ? null
            : raw.floatRiskWatchlistCount -
              scheduleControlBasis.sourceReportedNearCriticalLabelCount,
        status:
          scheduleControlBasis.sourceReportedNearCriticalLabelCount === null
            ? "source_not_reported"
            : raw.floatRiskWatchlistCount ===
                scheduleControlBasis.sourceReportedNearCriticalLabelCount
              ? "reconciled"
              : "difference",
      },
      definitions: {
        critical:
          "TF <= governed critical float threshold",
        nearCritical:
          "governed critical threshold < TF <= N activity-calendar working days",
        floatRiskWatchlist:
          scheduleAnalysisConfig.floatRiskWatchlistIncludesCriticalThreshold
            ? "governed critical threshold <= TF <= N activity-calendar working days"
            : "governed critical threshold < TF <= N activity-calendar working days",
      },
    };
    const nearCritical =
      controlledBaseline
        ? {
            ...nearCriticalBase,
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
                  return {
                    ...row,
                    baselineFinishIso:
                      baseline
                        ? baselineFinish(
                            baseline,
                          )
                        : null,
                  };
                },
              ),
          }
        : nearCriticalBase;
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
        "The watchlist uses submitted programme float. Independent CPM criticality is calculated separately and is not presented as established here.",
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
          generatedAt,
          producerVersion:
            "planning-fast:lookahead-v1",
          readinessEvidence:
            state.controls
              .readinessEvidence,
        },
      );
    const milestonesRaw =
      buildMilestonesProjection(
        model,
        {
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
          state.controls
            .delayClaims
            ?.events.length ??
          null,
        claimCount:
          state.controls
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
        "Management Position is synthesized from the specialist evidence currently available. Missing cross-domain evidence remains visible instead of being treated as zero.",
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

const independentForecastCache =
  new WeakMap<
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
    ReturnType<
      typeof buildIndependentForecastProjection
    >
  >();

const sourceOnlyForecastCache =
  new Map<
    string,
    ReturnType<
      typeof buildIndependentForecastProjection
    >
  >();

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

function sourceOnlyForecast(
  model:
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
  generatedAt: string,
): ReturnType<
  typeof buildIndependentForecastProjection
> {
  const key =
    model.sourceRevisionId;
  const cached =
    sourceOnlyForecastCache.get(
      key,
    );
  if (cached) {
    return {
      ...cached,
      generatedAt,
    };
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

  sourceOnlyForecastCache.set(
    key,
    projection,
  );
  return projection;
}

function cachedIndependentForecast(
  model:
    ProjectRuntimeState["schedules"][number]["revision"]["model"],
  generatedAt: string,
) {
  const key =
    model;
  const cached =
    independentForecastCache.get(
      key,
    );
  if (cached) {
    return cached;
  }
  const projection =
    buildIndependentForecastProjection(
      model,
      {
        generatedAt,
        producerVersion:
          "independent-forecast-fast-v1",
      },
    );
  independentForecastCache.set(
    key,
    projection,
  );
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
      linkedClaimCount: number;
      unlinkedClaimCount: number;
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
          forecastResolver:
            (revision) =>
              cachedIndependentForecast(
                revision.model,
                generatedAt,
              ),
        },
      ),
    );

  const delay =
    buildDelayClaimsProjection(
      windows,
      analyticalDelayModel,
      {
        generatedAt,
        producerVersion:
          "delay-claims-fast-v3",
      },
    );

  const linkedClaimCount =
    analyticalDelayModel.claims.filter(
      (claim) =>
        claim.eventIds.length >
        0,
    ).length;
  const unlinkedClaimCount =
    analyticalDelayModel
      .claims.length -
    linkedClaimCount;
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

function independentForecastReviewReason(
  forecast: ReturnType<
    typeof buildIndependentForecastProjection
  >,
): string | null {
  if (!forecast.complete) {
    return "Independent forecast requires review because one or more CPM inputs are unresolved.";
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
      "Independent forecast differs from the submitted finish by " +
      Math.round(Math.abs(variance)).toLocaleString("en-US") +
      " days. Reconcile calendars, remaining durations, logic and constraints before treating the independent date as a management forecast."
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
    return blocked(
      key,
      "Programme evidence has not been established.",
      ["schedule"],
    );
  }

  const generatedAt =
    new Date().toISOString();
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
        forecastTaxonomy: {
          contractorProgramme: {
            label: "Contractor Programme Forecast",
            completionIso:
              forecast.sourceForecastCompletionIso,
            authority: "submitted_programme",
            state:
              forecast.sourceForecastCompletionIso !== null
                ? "established"
                : "missing",
          },
          sourceProductivity: {
            label: "Source Productivity Forecast",
            completionIso:
              productivityForecast.completionIso,
            authority: "source_productivity_evidence",
            state:
              productivityForecast.state,
            method:
              productivityForecast.method,
            driverWorkPackageId:
              productivityForecast.driverWorkPackageId,
            workPackageCount:
              productivityForecast.workPackageCount,
            calculatedWorkPackageCount:
              productivityForecast.calculatedWorkPackageCount,
            coveragePercent:
              productivityForecast.calculationCoveragePercent,
            reconciliation:
              productivityForecast.reconciliation,
            sourceRefs:
              productivityForecast.sourceRefs,
          },
          cmengCpm: {
            label: "CMeng Independent CPM Forecast",
            completionIso:
              forecast.independentForecastCompletionIso,
            authority: "cmeng_deterministic",
            state:
              forecast.complete
                ? "established"
                : "review_required",
          },
          probabilistic: {
            label: "CMeng Probabilistic Forecast",
            p50CompletionIso:
              forecast.probabilistic.p50CompletionIso,
            p80CompletionIso:
              forecast.probabilistic.p80CompletionIso,
            p90CompletionIso:
              forecast.probabilistic.p90CompletionIso,
            authority:
              "non_official_comparator",
            state:
              forecast.probabilistic.status,
          },
        },
        managementReviewState:
          reviewReason
            ? "review_required"
            : "accepted_for_analysis",
        managementReviewReason:
          reviewReason,
      },
      [
        "current programme logic",
        "remaining durations",
        "source calendars",
      ],
      reviewReason
        ? "partial"
        : "ready",
      reviewReason,
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
          projection
            .establishedForecastCount >
          0
            ? "source_and_independent"
            : "source_forecast_only",
      },
      [
        "controlled programme revision history",
      ],
      projection
          .establishedForecastCount >
        0
        ? "ready"
        : "partial",
      projection
          .establishedForecastCount >
        0
        ? null
        : "Source forecast history is established. Independent historical CPM dates are not recalculated automatically in this view.",
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
          generatedAt,
          producerVersion:
            "progress-position:lookahead-v1",
          readinessEvidence:
            state.controls
              .readinessEvidence,
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
        progressEvidence:
          state.controls
            .progressEvidence,
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

    if (
      key ===
      "notices-claims"
    ) {
      const notices =
        buildNoticesClaimsProjection(
          analyticalDelayModel,
          {
            generatedAt,
            producerVersion:
              "notices-claims-fast-v3",
          },
        );
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
        notices.eventCount > 0 &&
        analyticalDelayModel
          .noticeRequirements
          .length > 0;
      const noticeAssessable =
        noticeAssessmentAvailable &&
        notices
          .noticeRequirementMissingCount ===
          0;

      result = available(
        key,
        {
          ...notices,
          contractorNoticeClaimEvidenceSubmitted:
            delayModel !== null,
          noticeAssessmentState:
            noticeAssessable
              ? "assessed"
              : noticeAssessmentAvailable
                ? "partially_assessable"
                : "not_assessable_without_delay_events_and_requirements",
          linkedClaimCount,
          unlinkedClaimCount,
        },
        [
          "delay events",
          "notice requirements",
          "notices",
          "claims",
        ],
        noticeAssessable
          ? "ready"
          : "partial",
        noticeAssessable
          ? null
          : noticeAssessmentAvailable &&
              notices
                .noticeRequirementMissingCount >
                0
            ? notices
                .noticeRequirementMissingCount +
              " governed delay event(s) do not have an applicable notice requirement. Assessed events remain visible, but the page stays under review."
            : notices.claimCount > 0
              ? notices.claimCount +
                " claim records are available, but notice timeliness is not assessable until governed delay events and applicable notice requirements are linked."
              : "Notice compliance is not assessable until governed delay events, applicable notice requirements and actual notice evidence are established.",
      );
    } else {
      const context =
        claimsFastContext(
          state,
          ordered,
          current,
          generatedAt,
        );
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
            linkedClaimCount,
            unlinkedClaimCount,
            eventLinkageState:
              delay.events.length >
                0 &&
              linkedClaimCount > 0
                ? "linked"
                : "not_established",
            revisionLabels:
              context.revisionLabels,
          },
          [
            "schedule windows",
            "delay events",
            "claim-event linkage",
          ],
          delay.events.length > 0 &&
          linkedClaimCount > 0
            ? "ready"
            : "partial",
          analyticalDelayModel
              .claims.length >
            0 &&
          delay.events.length === 0
            ? analyticalDelayModel
                .claims.length +
              " claim records are available, but no governed delay events are established. Programme movement cannot be attributed to those claims."
            : linkedClaimCount === 0
              ? "Claim records are not linked to governed delay events, so causation and entitlement remain unassessed."
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
                      positiveIndependentMovementDays:
                        Math.max(
                          0,
                          window
                            .independentForecastMovementDays ??
                            0,
                        ),
                      positiveProgrammeMovementDays:
                        Math.max(
                          0,
                          window
                            .strongestProgrammeMovementDays ??
                            0,
                        ),
                      programmeMovementBasis:
                        window
                          .strongestProgrammeMovementBasis,
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
                  "Observed programme movement is not an EOT entitlement or time-impact candidate without governed contract and event causation evidence.",
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
        generatedAt,
        producerVersion:
          "delivery-challenge-fast-v2",
        schedule: model,
        quantities: state.quantities,
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
      state.contract
        ? buildChallengeContractProjection(
            state.contract,
            {
              generatedAt,
              producerVersion:
                "challenge-contract-fast-v2",
            },
          )
        : null;
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
              ? "Governed contract value is established."
              : "Contract value evidence remains ungoverned until confirmed.",
        },
        independentForecastState: independentForecastReviewReason(sourceForecast) ? "review_required" : "calculated",
      },
      [
        "current programme",
        "contract",
        "resource and quantity evidence when available",
      ],
      (
        contractIntelligence !==
          null &&
        delivery.position !==
          "not_yet_supportable" &&
        delivery.position !==
          "scenario_only"
      )
        ? "ready"
        : "partial",
      contractIntelligence ===
        null
        ? "Contract clause intelligence requires a parsed contract."
        : delivery.position ===
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

function applyProfessionalModuleState(
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
    const eventCount =
      Number(
        data.eventCount ?? 0,
      );
    const activityLinked =
      Number(
        data.activityLinkedEventCount ??
          0,
      );
    if (
      eventCount > 0 &&
      activityLinked < eventCount
    ) {
      review(
        String(activityLinked) +
          " of " +
          String(eventCount) +
          " delay events are linked to governed schedule activities; causation is not fully defensible.",
      );
    }
  }

  if (
    result.key === "notices-claims"
  ) {
    const assessmentState =
      data?.noticeAssessmentState ??
      null;
    const requirementMissing =
      Number(
        data
          ?.noticeRequirementMissingCount ??
          0,
      );
    if (
      assessmentState !==
        "assessed" ||
      requirementMissing > 0
    ) {
      review(
        requirementMissing > 0
          ? String(
              requirementMissing,
            ) +
              " delay event(s) do not have a governed applicable notice requirement; assessed events remain visible but the page is only partially assessable."
          : "Notice compliance is not assessable as a complete population until governed delay events, applicable notice requirements and actual notice dates are established.",
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
    const count =
      Number(
        register?.recordCount ?? 0,
      );
    const coverage =
      register
        ?.stageCoveragePercent ??
      null;
    if (
      count > 0 &&
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
    if (
      control &&
      (
        control
          .scheduleLinkCoveragePercent !==
          100 ||
        control
          .claimLinkCoveragePercent !==
          100 ||
        control
          .paymentLinkCoveragePercent !==
          100
      )
    ) {
      review(
        "Variation final status is available, but cross-domain schedule/claim/payment lifecycle linkage is incomplete.",
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
      contractIntelligence === null ||
      contractIntelligence
        .physicalComplete === false ||
      contractIntelligence
        .semanticComplete === false ||
      data?.independentForecastState === "review_required" ||
      data?.deliveryChallenge?.findings?.some((finding: any) => ["missing_evidence", "scenario"].includes(finding.state)) ||
      deliveryPosition ===
        "not_yet_supportable" ||
      deliveryPosition ===
        "scenario_only"
    ) {
      review(
        contractIntelligence === null
          ? "Contract clause intelligence is not established; delivery scenarios remain separate from contractual findings."
          : deliveryPosition ===
                "scenario_only"
            ? "Delivery challenge contains programme-derived scenarios because measured manpower/productivity evidence is incomplete; scenario values are not project facts."
            : deliveryPosition ===
                  "not_yet_supportable"
              ? "The delivery challenge cannot yet be supported by the available measured evidence."
              : "The contract challenge position is not yet supportable from a complete governed contract evidence basis.",
      );
    }
  }

  if (result.key === "cost-forecast") {
    const position = data?.position;
    const cost = position?.performance?.costControl;
    const conflicts = (position?.sourceLedger?.costPosition ?? []).some((row: any) => (row.diagnostics ?? []).some((issue: string) => /CONFLICT|UNRESOLVED/.test(issue)));
    if (conflicts || cost?.state !== "established" || position?.foundation?.costRegister?.mappingCoveragePercent !== 100) {
      review("Cost snapshots are available, but reconciliation, source authority or CBS mapping requires review. A single observation does not establish a trend.");
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
      const noticeEvidenceGaps =
        Number(
          noticeCounts
            .requirement_missing ??
            0,
        ) +
        Number(
          noticeCounts
            .event_date_missing ??
            0,
        ) +
        Number(
          noticeCounts
            .notice_date_missing ??
            0,
        );
      const moneyLinkGap =
        claims.lifecycleClaimCount >
          0 &&
        (
          claims
            .commercialLifecycleLinkCoveragePercent !==
            100 ||
          claims
            .commercialClaimCount <
            claims
              .lifecycleClaimCount
        );
      if (
        moneyLinkGap ||
        noticeEvidenceGaps > 0
      ) {
        review(
          moneyLinkGap
            ? String(
                claims
                  .commercialClaimCount,
              ) +
                " of " +
                String(
                  claims
                    .lifecycleClaimCount,
                ) +
                " lifecycle claims have governed commercial-money linkage; Claims & Notices is not yet fully commercially defensible."
            : String(
                noticeEvidenceGaps,
              ) +
                " notice assessment(s) are missing a governed requirement, event date or notice date; Claims & Notices remains under review.",
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
  const sourceResource = canonicalResourceModule(state, key) ?? canonicalCommercialModule(state, key);
  if (sourceResource) {
    const current = projectControlSchedule(state);
    if (!current) return applyProfessionalModuleState(sourceResource);
    const generatedAt = new Date().toISOString();
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

function resolveProjectModule(state: ProjectRuntimeState, key: string): ModuleRuntimeResult {
  state = reportingState(state);
  const result = resolveProjectModuleUncertified(state, key);
  const model = projectControlSchedule(state)?.revision.model;
  if (!model) return attachReportingContract(state,result);
  const controlBasis = projectScheduleControlBasis(state);
  if (result.data && typeof result.data === "object") {
    const data = result.data as Record<string, any>;
    const time = canonicalTimeClaims(state);
    const forecast = ["milestones", "independent-forecast"].includes(key) ? cachedIndependentForecast(model, new Date().toISOString()) : null;
    const forecastReview = forecast ? independentForecastReviewReason(forecast) : null;
    result.data = { ...data, controlBasis,
      ...(["pmo-analysis","delay-claims","notices-claims","eot-assessment","windows-analysis","commercial-claims-notices"].includes(key) ? { claimsReporting: claimsReporting(state) } : {}),
      ...(key==='eot-assessment'?{sourceForecastCompletionIso:sourceOnlyForecast(model,new Date().toISOString()).sourceForecastCompletionIso}:{}),
      ...(key==='notices-claims'?{contractNoticePeriod:commercialFoundationForState(state).commercialTerms.noticePeriodDays}:{}),
      ...(["milestones", "independent-forecast", "notices-claims"].includes(key) ? {
        contractualCompletionIso: time.contractTimeBasis?.contractualCompletionIso ?? null,
        effectiveDeterminationDays: time.effectiveDeterminationDays,
        registerDeterminationDays: time.registerDeterminationDays,
        futureDeterminationCount: time.futureDeterminationCount,
      } : {}),
      ...(key === "milestones" ? {
        independentDrivingPathState: forecastReview ? "review_required" : forecast?.complete ? "calculated_requires_path_validation" : "not_established",
        independentDrivingPathReason: forecastReview ?? "CPM calculation coverage does not by itself validate a milestone driving path.",
        rows: (data.rows ?? []).map((row: any) => {
          const activity = model.activities.find(a => a.activityId === row.activityId);
          return {...row, calendarId: activity?.calendarId ?? null};
        }),
      } : {}),
      ...(key === "independent-forecast" ? {
        requiredFinishIso: time.contractTimeBasis?.contractualCompletionIso ?? data.requiredFinishIso ?? null,
        probabilistic: {...data.probabilistic,
          ...(forecastReview ? {status:"unavailable",p50CompletionIso:null,p80CompletionIso:null,p90CompletionIso:null} : {}),
          suppressionReason: forecastReview,
        },
        forecastTaxonomy: {...data.forecastTaxonomy,
          probabilistic: {...data.forecastTaxonomy?.probabilistic,
            ...(forecastReview ? {state:"suppressed",p50CompletionIso:null,p80CompletionIso:null,p90CompletionIso:null} : {}),
          },
        },
      } : {}),
      ...(key === "milestones" ? { movementDistribution: numericDistribution((data.rows ?? []).map((row: any)=>row.varianceDays)) } : {}),
      ...(key === "activity-analytics" ? {
        movementDistribution: numericDistribution((data.rows ?? []).map((row: any)=>row.finishVarianceDays)),
        movementAnalysis: (()=>{const history=analyticalHistory(state);const current=projectControlSchedule(state)!;const index=history.findIndex(r=>r.revision.revisionId===current.revision.revisionId);const previous=index>0?history[index-1]:null;const baseline=state.schedules.find(r=>r.revision.revisionId===data.controlledBaselineRevisionId);return activityMovementAnalysis(data.rows??[],{dataDateIso:model.dataDateIso,currentRevisionId:current.revision.revisionId,currentLabel:current.revision.label??current.sourceFilename??current.revision.revisionId,baselineRevisionId:data.controlledBaselineRevisionId??null,baselineLabel:baseline?.revision.label??null,previousRevisionId:previous?.revision.revisionId??null,previousLabel:previous?.revision.label??null,previousRows:previous?.revision.model.activities??[]});})(),
      } : {}),
    };
  }
  if(key==='milestones'&&controlBasis.state!=='official'){
    result.status='partial';
    result.professionalState='review_required';
    result.evidenceState='partial';
    result.reason='Milestones use submitted float and a '+controlBasis.nearCriticalThresholdMethod.replaceAll('_',' ')+' threshold. Contractual threshold authority and independent driving-path validation remain separate.';
  }
  return attachReportingContract(state,checkProjectionIntegrity(result, model, controlBasis.analysisConfig));
}

export function moduleForProject(
  projectId: string,
  key: string,
): ModuleRuntimeResult {
  const state =
    runtimeProjects.get(projectId);
  if (!state) {
    return blocked(
      key,
      "Project has not been created.",
      ["project"],
    );
  }
  return resolveProjectModule(state, key);
}

export function directorForProject(
  projectId: string,
) {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;
  const data=buildBundle(state).director;
  return data?reportingData(state,'project-director',data):null;
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
  if (
    category === "commercial"
  ) {
    return "Commercial";
  }
  if (
    category === "progress"
  ) {
    return "Progress & Resources";
  }
  if (
    category === "forecast"
  ) {
    return "Forecast & Finish";
  }
  if (
    category === "claims" ||
    category === "contract"
  ) {
    return "Claims & Commercial";
  }
  return "Programme & Planning";
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

export function managementSurfacesForProject(
  projectId: string,
): ManagementSurfacesProjection | null {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;

  const bundle =
    buildBundle(state);
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

  const resolvedModules = new Map([...scheduleModules, ...commercialModules].map(descriptor =>
    [descriptor.key, resolveProjectModule(state, descriptor.key)]));
  const certification = certifyCrossModuleConsistency({ generatedAt, state: reportingState(state), modules: resolvedModules,
    director, boardReport: bundle.boardReport });
  const consistency = { state: certification.state, checkCount: certification.checkCount,
    failedCheckIds: certification.failedCheckIds,
    scope: "Checked cross-module values, shared population IDs and denominators, Data Date, authority, configuration and project version. Evidence completeness is a separate gate." };
  const moduleInput = (descriptor: {key: string; title: string; category: string}, commercialModule = false): ManagementModuleInput => {
    const result = resolvedModules.get(descriptor.key)!;
    const integrity = (result.data as any)?.systemEvidenceContract;
    return { key: descriptor.key, label: descriptor.title,
      group: commercialModule ? "Commercial" : managementModuleGroup(descriptor.key, descriptor.category),
      status: result.status, reason: result.reason ?? null,
      calculationState: integrity?.state === "verified_for_checked_metrics" ? "checked" : integrity?.state === "failed" ? "failed" : "pending",
      evidenceState: result.evidenceState ?? "not_established", professionalState: result.professionalState ?? "review_required",
      consistencyState: certification.state };
  };
  const scheduleInputs = scheduleModules.map(descriptor => moduleInput(descriptor));
  const commercialInputs = commercialModules.map(descriptor => moduleInput(descriptor, true));

  const terms =
    commercial.foundation
      .commercialTerms;
  const cost =
    commercial.foundation
      .costRegister;
  const payments =
    commercial.foundation
      .paymentRegister;
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
          "Upload or select the governed current programme in the programme revision workflow.",
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
          "Upload or select the governed baseline/revised baseline.",
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
          "Provide or reconcile the governed cost register and CBS mappings.",
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
          "Governed risk information",
        state:
          riskState ===
          "established"
            ? "established"
            : riskState ===
                "submitted_unparsed"
              ? "partial"
              : "missing",
        action:
          "Establish the governed Risk Register before relying on project-wide risk KPIs.",
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
        "Review the management position, resolve evidence gaps, then finalize a current board report through the governed publication workflow.",
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
          actor: null,
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
          actor: null,
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
              actor: null,
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

  const surfaces = buildManagementSurfaces({
    schemaVersion: "1.0",
    projectId,
    generatedAt,
    director,
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
            item.role !==
            "recovery",
        ).length,
      recoveryScenarioCount:
        state.schedules.filter(
          (item) =>
            item.role ===
            "recovery",
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
            sourceState: source?.state ?? "not_established", datedApprovedAmount: row.asOfValue,
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
  return { ...surfaces,
    masterDashboard: managementReportingData(state, surfaces.masterDashboard, resolvedModules),
    commandCenter: managementReportingData(state, surfaces.commandCenter, resolvedModules),
    masterControlProgramme: managementReportingData(state, surfaces.masterControlProgramme, resolvedModules) };
}

export function managementSurfaceForProject(
  projectId: string,
  key: string,
): ModuleRuntimeResult | null {
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
          : null;
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

  return {
    key,
    status:
      !currentEstablished
        ? "partial"
        : managementReviewRequired
          ? "partial"
          : "ready",
    reason:
      !currentEstablished
        ? "A current governed programme is required before the integrated management position can be complete."
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
  };
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
  const receiptStates =
    new Map(
      (
        state.lastRerunReceipt
          ?.moduleResults ??
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

  return {
    projectId,
    releaseCommitSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null,
    version: state.version,
    demo: state.demo,
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
          item.role ===
          "recovery",
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
    moduleStates:
      [
        ...scheduleModules,
        ...commercialModules,
      ].map(
        (module) => {
          const resolved =
            resolveProjectModule(
              state,
              module.key,
            );
          return {
            key: module.key,
            status:
              resolved.status,
            reason:
              resolved.reason,
          };
        },
      ),
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
      [
        ...scheduleModules,
        ...commercialModules,
      ].map(
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
      state,
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
