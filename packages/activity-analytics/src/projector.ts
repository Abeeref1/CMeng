import {aggregateCount} from '../../truth-kernel/src/aggregates';
import {
  buildScheduleActivityLogicIndex,
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  sourceFloatCriticality,
  sourceFloatInFloatRiskWatchlist,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  ActivityAnalyticsProjection,
  ActivityAnalyticsRow,
  ActivityCriticality,
} from "./types";

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function criticality(
  model: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
  config: ScheduleAnalysisConfig,
): ActivityCriticality {
  return sourceFloatCriticality(
    model,
    activity,
    config,
  );
}

function effectiveFinish(
  activity: CanonicalScheduleActivity,
): string | null {
  if (
    activity.status === "completed" &&
    activity.actualFinishIso
  ) {
    return activity.actualFinishIso;
  }

  return (
    activity.forecastFinishIso ??
    activity.currentFinishIso
  );
}

function finishVarianceDays(
  activity: CanonicalScheduleActivity,
): number | null {
  if (!activity.baselineFinishIso) return null;
  const current = effectiveFinish(activity);
  if (!current) return null;

  const baselineMs = Date.parse(
    activity.baselineFinishIso,
  );
  const currentMs = Date.parse(current);

  if (
    !Number.isFinite(baselineMs) ||
    !Number.isFinite(currentMs)
  ) {
    return null;
  }

  return Number(
    (
      (currentMs - baselineMs) /
      86_400_000
    ).toFixed(6),
  );
}

export function activityAnalyticsCounts(rows: readonly ActivityAnalyticsRow[]) {
  const executionRows = rows.filter(row => !['level_of_effort', 'wbs_summary'].includes(row.activityType));
  return {
    critical: aggregateCount(executionRows, row => row.totalFloatHours === null ? null : row.criticality === 'critical'),
    nearCritical: aggregateCount(executionRows, row => row.criticality === 'unknown' || row.floatRiskWatchlist === null ? null : row.criticality === 'near_critical'),
    floatRisk: aggregateCount(executionRows, row => row.floatRiskWatchlist),
    late: aggregateCount(executionRows, row => row.finishVarianceDays === null ? null : row.finishVarianceDays > 0),
  };
}

export function buildActivityAnalyticsProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
  },
): ActivityAnalyticsProjection {
  const config =
    input.config ??
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG;
  const logic =
    buildScheduleActivityLogicIndex(model);

  const rows: ActivityAnalyticsRow[] =
    model.activities.map((activity) => {
      const entry =
        logic.byActivityId[activity.activityId];
      const predecessors =
        entry?.predecessorIds ?? [];
      const successors =
        entry?.successorIds ?? [];

      return {
        activityId: activity.activityId,
        name: activity.name,
        wbsId: activity.wbsId,
        calendarId: activity.calendarId,
        activityType: activity.activityType,
        status: activity.status,

        baselineStartIso:
          activity.baselineStartIso,
        baselineFinishIso:
          activity.baselineFinishIso,
        currentStartIso:
          activity.currentStartIso,
        currentFinishIso:
          activity.currentFinishIso,
        actualStartIso:
          activity.actualStartIso,
        actualFinishIso:
          activity.actualFinishIso,
        forecastStartIso:
          activity.forecastStartIso,
        forecastFinishIso:
          activity.forecastFinishIso,

        percentComplete:
          activity.percentComplete,
        originalDurationHours:
          activity.originalDurationHours,
        remainingDurationHours:
          activity.remainingDurationHours,
        totalFloatHours:
          activity.totalFloatHours,
        freeFloatHours:
          activity.freeFloatHours,

        criticality:
          criticality(model, activity, config),
        floatRiskWatchlist:
          sourceFloatInFloatRiskWatchlist(
            model,
            activity,
            config,
          ),
        finishVarianceDays:
          finishVarianceDays(activity),

        predecessorIds: predecessors,
        successorIds: successors,
        predecessorCount: predecessors.length,
        successorCount: successors.length,
        openStart: predecessors.length === 0,
        openFinish: successors.length === 0,
        isolated:
          predecessors.length === 0 &&
          successors.length === 0,

        diagnostics: [
          ...activity.diagnostics,
        ],
      };
    });

  const counts = activityAnalyticsCounts(rows);
  return {
    schemaVersion: "1.0",
    projectionKey: "activity_analytics",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    activityCount: rows.length,
    counts,
    population: {
      sourceActivityCount: rows.length,
      executableActivityCount:
        rows.filter(
          (row) =>
            row.activityType !== "wbs_summary" &&
            row.activityType !== "level_of_effort",
        ).length,
      excludedActivityCount:
        rows.filter(
          (row) =>
            row.activityType === "wbs_summary" ||
            row.activityType === "level_of_effort",
        ).length,
      excludedByType: {
        wbsSummaryCount:
          rows.filter(
            (row) => row.activityType === "wbs_summary",
          ).length,
        levelOfEffortCount:
          rows.filter(
            (row) => row.activityType === "level_of_effort",
          ).length,
        otherExcludedCount: 0,
      },
      rowPopulation: "all_source_activities",
    },
    floatCoveragePercent: coverage(
      rows.filter(
        (row) => row.totalFloatHours !== null,
      ).length,
      rows.length,
    ),
    percentCompleteCoveragePercent: coverage(
      rows.filter(
        (row) => row.percentComplete !== null,
      ).length,
      rows.length,
    ),
    finishVarianceCoveragePercent: coverage(
      rows.filter(
        (row) =>
          row.finishVarianceDays !== null,
      ).length,
      rows.length,
    ),
    rows,
    diagnostics: [
      ...model.diagnostics,
      ...logic.brokenRelationshipIds.map(
        (relationshipId) =>
          "ACTIVITY_ANALYTICS_BROKEN_RELATIONSHIP:" +
          relationshipId,
      ),
    ],
  };
}

export function serializeActivityAnalyticsProjection(
  projection: ActivityAnalyticsProjection,
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(projection),
  );
}
