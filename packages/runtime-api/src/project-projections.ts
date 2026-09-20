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
                return {
                  ...row,
                  baselineDateIso:
                    baselineDate,
                  varianceDays:
                    varianceDays(
                      baselineDate,
                      row.currentDateIso,
                    ),
                };
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

  const nearCritical =
    buildNearCriticalProjection(
      model,
      {
        generatedAt,
        producerVersion:
          versions.nearCritical,
      },
    );
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
  modules.set(
    "independent-forecast",
    available(
      "independent-forecast",
      independentForecast,
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
          independentForecast.complete
            ? "Source float classifications are shown alongside a valid independent CPM calculation."
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

    modules.set(
      "resource-utilization",
      available(
        "resource-utilization",
        resourceUtilization,
        ["resource-loaded XER"],
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
        windows
          .positiveProgrammeMovementDays,
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
              Math.max(
                0,
                window
                  .strongestProgrammeMovementDays ??
                  0,
              ),
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
        "Observed programme movement is not treated as EOT without a governed contract-time basis and event/causation evidence.",
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
    modules.set(
      "pmo-analysis",
      available(
        "pmo-analysis",
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
        }),
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
  const bundle =
    buildBundle(state);

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
          item.role === "recovery",
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
          programmeSchedules.length > 0,
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
        programmeSchedules.length > 0 &&
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
      scheduleModules.map(
        (module) => {
          const value =
            bundle.modules.get(
              module.key,
            );
          return {
            key: module.key,
            status:
              value?.status ??
              "blocked",
            reason:
              value?.reason ??
              null,
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
}
