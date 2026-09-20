import { canonicalCommercialModule, commercialPositionForState } from "./commercial-runtime";
import { projectControlSchedule } from "./canonical-time-claims";
import { projectScheduleControlBasis } from "./schedule-control-basis";
import { sourceProductivityForecastEvidence } from "./source-productivity-forecast";
import { canonicalResourceModule } from "./canonical-resource-runtime";
import { commercialCanonical } from "./commercial-canonical";
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
  buildCommercialControlPosition,
  buildCommercialModuleProjection,
} from "../../commercial-control/src";
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
  const programmeSchedules =
    state.schedules.filter(
      isProgrammeScheduleRevision,
    );
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
    runtimeProjects.latestSchedule(
      state.projectId,
    );

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
  const baselineByActivity =
    new Map(
      (
        controlledBaseline
          ?.revision.model
          .activities ??
        []
      ).map(
        (activity) => [
          activity.activityId,
          activity,
        ],
      ),
    );
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
      activity.baselineFinishIso ??
      activity.forecastFinishIso ??
      activity.currentFinishIso ??
      activity.actualFinishIso;
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
            Date.parse(
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
      Date.parse(baselineIso);
    const after =
      Date.parse(currentIso);
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
              ...scheduleAnalyticsRaw
                .result
                .finishVariance,
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
  const nearCritical =
    controlledBaseline
      ? {
          ...nearCriticalRaw,
          controlledBaselineRevisionId:
            controlledBaseline
              .revision.revisionId,
          rows:
            nearCriticalRaw.rows.map(
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
      : nearCriticalRaw;
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

  const independentForecast =
    buildIndependentForecastProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.forecast,
      },
    );
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

  let quantityScurve:
    ReturnType<
      typeof buildQuantityScurveProjection
    > | null = null;

  if (
    state.quantities &&
    state.quantities
      .scheduleRevisionId ===
      current.revision
        .revisionId
  ) {
    const inferredMapping =
      buildQuantityScheduleMapping(
        state.quantities,
        model,
      );
    const useScenarioMapping =
      state.quantities
        .allocations.length ===
        0 &&
      inferredMapping
        .selectedScenarioLinks
        .length > 0;

    const quantityBasis =
      useScenarioMapping
        ? {
            ...state.quantities,
            allocations:
              inferredMapping
                .selectedScenarioLinks
                .filter(
                  (link) =>
                    link
                      .allocatedQuantity !==
                    null,
                )
                .map(
                  (link) => ({
                    allocationId:
                      "scenario-" +
                      link.candidateId,
                    quantityItemId:
                      link.quantityItemId,
                    activityId:
                      link.activityId,
                    allocatedQuantity:
                      link
                        .allocatedQuantity!,
                    sourceRefs: [
                      ...link.sourceRefs,
                      {
                        source:
                          "governed_mapping" as const,
                        locator:
                          "candidate-scenario:" +
                          link.candidateId,
                      },
                    ],
                  }),
                ),
          }
        : state.quantities;

    quantityScurve =
      buildQuantityScurveProjection(
        quantityBasis,
        model,
        {
          generatedAt,
          producerVersion:
            versions.quantity,
        },
      );

    if (useScenarioMapping) {
      quantityScurve = {
        ...quantityScurve,
        allocationState:
          "partial",
        series:
          quantityScurve.series.map(
            (series) => ({
              ...series,
              authority:
                "scenario_mapping" as const,
            }),
          ),
        diagnostics: [
          ...quantityScurve
            .diagnostics,
          "QUANTITY_SCURVE_USES_INFERRED_MAPPING_SCENARIO_NOT_GOVERNED_ALLOCATION",
        ],
      };
    }

    modules.set(
      "quantity-scurve",
      available(
        "quantity-scurve",
        {
          ...quantityScurve,
          mappingBasis:
            useScenarioMapping
              ? "candidate_scenario"
              : state.quantities
                    .allocations
                    .length > 0
                ? "governed"
                : "missing",
          inferredMapping,
        },
        ["BOQ", "quantity-to-activity mapping"],
        state.quantities
          .allocations.length > 0
          ? "ready"
          : "partial",
        state.quantities
          .allocations.length > 0
          ? null
          : useScenarioMapping
            ? "No governed BOQ/activity crosswalk was submitted. CMeng generated an evidence-scored scenario mapping and uses it only as a scenario."
            : "BOQ is loaded but no defensible quantity-to-activity allocation can yet be established.",
      ),
    );
  } else {
    modules.set(
      "quantity-scurve",
      available(
        "quantity-scurve",
        {
          schemaVersion: "1.0",
          projectionKey:
            "quantity_scurve",
          generatedAt,
          producerVersion:
            versions.quantity,
          projectId:
            state.projectId,
          boqRevisionId:
            state.quantities
              ?.boqRevisionId ??
            null,
          scheduleRevisionId:
            current.revision
              .revisionId,
          dataDateIso:
            model.dataDateIso,
          unitKeyed: true,
          allocationState:
            "missing",
          series: [],
          unmappedItemIds:
            state.quantities
              ?.items.map(
                (item) =>
                  item
                    .quantityItemId,
              ) ?? [],
          partiallyAllocatedItemIds:
            [],
          overAllocatedItemIds:
            [],
          mappingBasis:
            "missing",
          diagnostics: [
            "QUANTITY_BASIS_NOT_ESTABLISHED_FOR_CURRENT_REVISION",
          ],
        },
        ["BOQ"],
        "partial",
        "No current BOQ quantity basis is established. CMeng keeps the module active and states exactly what evidence is needed rather than returning an unavailable page.",
      ),
    );
  }

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
      },
      ["schedule windows"],
      delayModel &&
      windows.windowCount > 0
        ? "ready"
        : "partial",
      delayModel
        ? windows.windowCount > 0
          ? null
          : "Claim evidence exists, but a second schedule revision is required to independently test movement."
        : windows.windowCount > 0
          ? "No contractor claim was submitted. CMeng still reports observed schedule movement without assigning legal causation."
          : "No contractor claim was submitted and only one schedule revision exists. CMeng preserves the claim gap and states the evidence needed to test it.",
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
  modules.set(
    "notices-claims",
    available(
      "notices-claims",
      {
        ...noticesClaims,
        contractorNoticeClaimEvidenceSubmitted:
          delayModel !== null,
      },
      ["notices", "claims"],
      delayModel
        ? "ready"
        : "partial",
      delayModel
        ? null
        : "No contractor notices/claims were submitted. CMeng does not turn missing records into zero entitlement; it preserves the submission gap for reconciliation.",
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
    modules.set(
      "eot-assessment",
      available(
        "eot-assessment",
        {
          ...eotAssessment,
          contractorEotEvidenceSubmitted:
            delayModel !== null,
        },
        ["schedule windows", "contract time basis"],
        delayModel &&
        windows.windowCount > 0
          ? "ready"
          : "partial",
        delayModel
          ? windows.windowCount > 0
            ? null
            : "Contract/EOT basis is available, but at least two schedule revisions are required for a window-based independent movement assessment."
          : "Contract time basis is available and schedule movement is independently calculated where possible, but no contractor EOT/event case was submitted.",
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

  const commercialPosition = commercialPositionForState(state, generatedAt);

  const commercialModuleSpecs = [
    [
      "commercial-overview",
      "commercial_overview",
    ],
    [
      "cost-forecast",
      "cost_forecast",
    ],
    [
      "variations-change",
      "variations_change",
    ],
    [
      "payments",
      "payments",
    ],
    [
      "cash-flow",
      "cash_flow",
    ],
    [
      "commercial-claims-notices",
      "commercial_claims_notices",
    ],
    [
      "contract-particulars-bonds",
      "contract_particulars_bonds",
    ],
  ] as const;

  for (
    const [
      moduleKey,
      projectionKey,
    ] of commercialModuleSpecs
  ) {
    const projection =
      buildCommercialModuleProjection(
        projectionKey,
        commercialPosition,
      );
    const relevantState =
      moduleKey ===
        "variations-change"
        ? commercialPosition
            .evidence.variations
        : moduleKey ===
            "payments" ||
          moduleKey ===
            "cash-flow"
          ? commercialPosition
              .evidence.payments
          : moduleKey ===
              "commercial-claims-notices"
            ? commercialPosition
                .evidence.claims
            : moduleKey ===
                "contract-particulars-bonds"
              ? (
                  commercialPosition
                    .evidence.commercial ===
                    "established" ||
                  commercialPosition
                    .evidence.bonds ===
                    "established"
                    ? "established"
                    : commercialPosition
                        .evidence.commercial
                )
              : commercialPosition
                  .evidence.commercial;

    modules.set(
      moduleKey,
      available(
        moduleKey,
        projection,
        [
          "governed commercial evidence",
          "contract time basis",
        ],
        relevantState ===
          "established"
          ? "ready"
          : "partial",
        relevantState ===
          "established"
          ? null
          : relevantState ===
              "submitted_unparsed"
            ? "Relevant evidence is submitted but not yet structurally established. CMeng preserves it as missing/partial rather than zero."
            : "Relevant commercial evidence has not been submitted. CMeng does not infer zero exposure.",
      ),
    );
  }

  for (const [moduleKey] of commercialModuleSpecs) {
    const canonicalCommercial = canonicalCommercialModule(state, moduleKey);
    if (canonicalCommercial) modules.set(moduleKey, canonicalCommercial);
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
          },
          resources: resourceUtilization
            ? {
                state:
                  "resource_loaded",
                assignedResourceCount:
                  resourceUtilization
                    .assignedResourceCount,
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

  applyUniversalModuleChallenges({
    state,
    generatedAt,
    model,
    independentForecast,
    deliveryChallenge,
    modules,
  });

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
        variations:
          state.controls
            .variations,
        invoices:
          state.controls.invoices,
        retentions:
          state.controls
            .retentions,
        bonds:
          state.controls.bonds,
        claimCommercials:
          state.controls
            .claimCommercials,
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


const planningModuleKeys =
  new Set([
    "pmo-analysis",
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
    runtimeProjects.latestSchedule(
      state.projectId,
    );
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

  const baselineByActivity =
    new Map(
      (
        controlledBaseline
          ?.revision.model
          .activities ??
        []
      ).map(
        (activity) => [
          activity.activityId,
          activity,
        ],
      ),
    );
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
    activity.baselineFinishIso ??
    activity.forecastFinishIso ??
    activity.currentFinishIso ??
    activity.actualFinishIso;

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
    const a = Date.parse(from);
    const b = Date.parse(to);
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
            Date.parse(
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
              ...scheduleRaw.result
                .finishVariance,
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

  const independentForecast =
    {
      schemaVersion: "1.0",
      projectionKey:
        "independent_forecast",
      generatedAt,
      producerVersion:
        "planning-fast:forecast-deferred-v1",
      projectId:
        model.projectId,
      sourceRevisionId:
        model.sourceRevisionId,
      dataDateIso:
        model.dataDateIso,
      origin: "unresolved",
      sourceForecastCompletionIso,
      independentForecastCompletionIso:
        null,
      forecastVarianceDays: null,
      requiredFinishIso: null,
      requiredFinishVarianceDays:
        null,
      activities: [],
      criticalActivityIds: [],
      complete: false,
      diagnostics: [
        "INDEPENDENT_CPM_DEFERRED_FOR_FAST_PROGRAMME_VIEW",
      ],
    } as unknown as ReturnType<
      typeof buildIndependentForecastProjection
    >;

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
                            .forecastFinishIso ??
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
    const nearCritical =
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
        : raw;
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
                            .forecastFinishIso ??
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
    "progress-report",
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
  new Map<
    string,
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
    sourceOnlyForecast(
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
      Date.parse(finish);
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
    model.sourceRevisionId;
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
            sourceOnlyForecast(
              revision.model,
              generatedAt,
            ),
      },
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
    Date.parse(
      forecast.dataDateIso,
    );
  const sourceFinish =
    Date.parse(
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
      Math.abs(
        Number(
          variance.toFixed(1),
        ),
      ) +
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
    runtimeProjects.latestSchedule(
      state.projectId,
    );
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
    const quantities =
      state.quantities;
    if (
      !quantities ||
      quantities
        .scheduleRevisionId !==
        current.revision
          .revisionId
    ) {
      result = available(
        key,
        {
          schemaVersion:
            "1.0",
          projectionKey:
            "quantity_scurve",
          generatedAt,
          projectId:
            state.projectId,
          boqRevisionId:
            quantities
              ?.boqRevisionId ??
            null,
          scheduleRevisionId:
            current.revision
              .revisionId,
          dataDateIso:
            model.dataDateIso,
          unitKeyed: true,
          allocationState:
            "missing",
          mappingBasis:
            "missing",
          series: [],
          unmappedItemIds:
            quantities
              ?.items.map(
                (item) =>
                  item
                    .quantityItemId,
              ) ??
            [],
          partiallyAllocatedItemIds:
            [],
          overAllocatedItemIds:
            [],
          diagnostics: [
            "CURRENT_BOQ_QUANTITY_BASIS_NOT_ESTABLISHED",
          ],
        },
        ["BOQ", "quantity mapping"],
        "partial",
        "A current BOQ quantity basis and schedule crosswalk are required before an Installed Quantities curve can be calculated.",
      );
    } else if (
      quantities
        .allocations.length ===
      0
    ) {
      result = available(
        key,
        {
          schemaVersion:
            "1.0",
          projectionKey:
            "quantity_scurve",
          generatedAt,
          projectId:
            state.projectId,
          boqRevisionId:
            quantities
              .boqRevisionId,
          scheduleRevisionId:
            current.revision
              .revisionId,
          dataDateIso:
            model.dataDateIso,
          unitKeyed: true,
          allocationState:
            "missing",
          mappingBasis:
            "missing",
          candidateMappingState:
            "not_run_in_initial_view",
          series: [],
          unmappedItemIds:
            quantities.items.map(
              (item) =>
                item.quantityItemId,
            ),
          partiallyAllocatedItemIds:
            [],
          overAllocatedItemIds:
            [],
          diagnostics: [
            "NO_GOVERNED_QUANTITY_TO_ACTIVITY_ALLOCATION",
            "INFERRED_MAPPING_NOT_RUN_IN_INITIAL_VIEW",
          ],
        },
        [
          "BOQ",
          "governed quantity-to-activity mapping",
        ],
        "partial",
        "BOQ items are available, but no governed quantity-to-activity allocation is established. CMeng does not run an expensive inferred crosswalk or publish a quantity curve as if the mapping were approved.",
      );
    } else {
      const projection =
        buildQuantityScurveProjection(
          quantities,
          model,
          {
            generatedAt,
            producerVersion:
              "quantity-scurve-fast-v3",
          },
        );
      result = available(
        key,
        {
          ...projection,
          mappingBasis:
            "governed",
        },
        [
          "BOQ",
          "governed quantity-to-activity mapping",
        ],
        projection
          .allocationState ===
          "complete"
          ? "ready"
          : "partial",
        projection
            .allocationState ===
          "complete"
          ? null
          : "The governed quantity allocation is incomplete or conflicted. CMeng keeps unit series separate and reports mapping coverage.",
      );
    }
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
                .revisionId,
            );
          return forecastSnapshotFromProjection(
            cachedForecast ??
              sourceOnlyForecast(
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
      sourceOnlyForecast(
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
      const assessable =
        notices.eventCount > 0 &&
        analyticalDelayModel
          .noticeRequirements
          .length > 0;

      result = available(
        key,
        {
          ...notices,
          noticeAssessmentState:
            assessable
              ? "assessed"
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
        assessable
          ? "ready"
          : "partial",
        assessable
          ? null
          : notices.claimCount +
            " claim records are available, but notice timeliness is not assessable until governed delay events and applicable notice requirements are linked.",
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
      sourceOnlyForecast(
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
        quantities:
          state.quantities &&
          state.quantities
            .allocations.length > 0
            ? state.quantities
            : null,
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
        independentForecastState:
          "deferred",
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

  const sourceResource = canonicalResourceModule(state, key) ?? canonicalCommercialModule(state, key);
  if (sourceResource) {
    const current = projectControlSchedule(state);
    if (!current) return sourceResource;
    const generatedAt = new Date().toISOString();
    const context = specialistChallengeContext(state, current.revision.model, generatedAt);
    const modules = new Map([[key, sourceResource]]);
    applyUniversalModuleChallenges({state, generatedAt, model:current.revision.model,
      independentForecast:context.forecast, deliveryChallenge:context.delivery, modules});
    return modules.get(key) ?? sourceResource;
  }

  const planning =
    buildPlanningModuleFast(
      state,
      key,
    );
  if (planning) {
    return planning;
  }

  const specialist =
    buildSpecialistModuleFast(
      state,
      key,
    );
  if (specialist) {
    return specialist;
  }

  const bundle =
    buildBundle(state);
  return (
    bundle.modules.get(key) ??
    blocked(
      key,
      "Unknown Schedule module.",
      [],
    )
  );
}

export function directorForProject(
  projectId: string,
) {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;
  return buildBundle(state).director;
}

export function boardReportForProject(
  projectId: string,
) {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;
  return buildBundle(state)
    .boardReport;
}

export function overviewForProject(
  projectId: string,
): ProjectRuntimeOverview | null {
  const state =
    runtimeProjects.get(projectId);
  if (!state) return null;

  const latest =
    runtimeProjects.latestSchedule(
      projectId,
    );
  const programmeSchedules =
    state.schedules.filter(
      isProgrammeScheduleRevision,
    );
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
          const receiptStatus =
            receiptStates.get(
              module.key,
            );
          return {
            key: module.key,
            status:
              receiptStatus ??
              (
                commercialModules.some(
                  (item) =>
                    item.key ===
                    module.key,
                )
                  ? "partial"
                  : scheduleEstablished
                    ? "partial"
                    : "blocked"
              ),
            reason:
              receiptStatus
                ? null
                : commercialModules.some(
                    (item) =>
                      item.key ===
                      module.key,
                  )
                  ? "Open the commercial view to calculate the current governed position. Missing evidence will remain missing, not zero."
                  : scheduleEstablished
                    ? "Open the view to calculate the latest specialist position."
                    : "Programme evidence has not been established.",
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
  const certification =
    certifyCrossModuleConsistency({
      generatedAt,
      state,
      modules:
        bundle.modules,
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
      bundle.modules.size,
    moduleResults: [
      ...bundle.modules.entries(),
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
      bundle.modules.has(
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

