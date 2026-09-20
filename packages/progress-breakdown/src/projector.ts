import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  sourceFloatCriticality,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  ProgressBreakdownProjection,
  ProgressBreakdownRow,
} from "./types";

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function average(
  values: readonly number[],
): number | null {
  if (values.length === 0) return null;
  return Number(
    (
      values.reduce((sum, value) => sum + value, 0) /
      values.length
    ).toFixed(6),
  );
}

function buildRow(
  model: CanonicalScheduleModel,
  wbsId: string,
  wbsName: string | null,
  activities: readonly CanonicalScheduleActivity[],
  config: ScheduleAnalysisConfig,
): ProgressBreakdownRow {
  const pctKnown = activities.filter(
    (activity) =>
      activity.percentComplete !== null &&
      activity.percentComplete >= 0 &&
      activity.percentComplete <= 100,
  );

  const weightedKnown = activities.filter(
    (activity) =>
      activity.percentComplete !== null &&
      activity.percentComplete >= 0 &&
      activity.percentComplete <= 100 &&
      activity.originalDurationHours !== null &&
      activity.originalDurationHours > 0 &&
      activity.activityType !== "milestone" &&
      activity.activityType !== "start_milestone" &&
      activity.activityType !== "finish_milestone",
  );

  const weightedDuration = weightedKnown.reduce(
    (sum, activity) =>
      sum + activity.originalDurationHours!,
    0,
  );

  const weightedProgress =
    weightedDuration > 0
      ? weightedKnown.reduce(
          (sum, activity) =>
            sum +
            activity.originalDurationHours! *
              activity.percentComplete!,
          0,
        ) / weightedDuration
      : null;

  const floatKnown = activities.filter(
    (activity) =>
      activity.totalFloatHours !== null,
  );

  return {
    wbsId,
    wbsName,
    activityCount: activities.length,
    completedCount: activities.filter(
      (activity) => activity.status === "completed",
    ).length,
    inProgressCount: activities.filter(
      (activity) => activity.status === "in_progress",
    ).length,
    notStartedCount: activities.filter(
      (activity) => activity.status === "not_started",
    ).length,
    unknownStatusCount: activities.filter(
      (activity) => activity.status === "unknown",
    ).length,
    percentCompleteAverage: average(
      pctKnown.map(
        (activity) => activity.percentComplete!,
      ),
    ),
    percentCompleteCoveragePercent: coverage(
      pctKnown.length,
      activities.length,
    ),
    durationWeightedProgressPercent:
      weightedProgress === null
        ? null
        : Number(weightedProgress.toFixed(6)),
    durationWeightedCoveragePercent: coverage(
      weightedKnown.length,
      activities.filter(
        (activity) =>
          activity.activityType !== "milestone" &&
          activity.activityType !== "start_milestone" &&
          activity.activityType !== "finish_milestone",
      ).length,
    ),
    originalDurationHoursKnown:
      activities.reduce(
        (sum, activity) =>
          sum +
          (activity.originalDurationHours ?? 0),
        0,
      ),
    remainingDurationHoursKnown:
      activities.reduce(
        (sum, activity) =>
          sum +
          (activity.remainingDurationHours ?? 0),
        0,
      ),
    criticalCount: floatKnown.filter(
      (activity) =>
        sourceFloatCriticality(model, activity, config) ===
        "critical",
    ).length,
    nearCriticalCount: floatKnown.filter(
      (activity) =>
        sourceFloatCriticality(model, activity, config) ===
        "near_critical",
    ).length,
    negativeFloatCount: floatKnown.filter(
      (activity) =>
        activity.totalFloatHours! < 0,
    ).length,
    floatCoveragePercent: coverage(
      floatKnown.length,
      activities.length,
    ),
  };
}

export function buildProgressBreakdownProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
  },
): ProgressBreakdownProjection {
  const config =
    input.config ??
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG;
  const wbsNames = new Map(
    model.wbs.map((row) => [
      row.wbsId,
      row.name,
    ]),
  );

  const groups = new Map<
    string,
    CanonicalScheduleActivity[]
  >();

  for (const activity of model.activities) {
    if (
      activity.activityType === "wbs_summary"
    ) {
      continue;
    }

    const key =
      activity.wbsId ?? "__UNASSIGNED__";
    const group = groups.get(key) ?? [];
    group.push(activity);
    groups.set(key, group);
  }

  const rows = [...groups.entries()]
    .map(([wbsId, activities]) =>
      buildRow(
        model,
        wbsId,
        wbsId === "__UNASSIGNED__"
          ? null
          : wbsNames.get(wbsId) ?? null,
        activities,
        config,
      ),
    )
    .sort(
      (a, b) =>
        b.activityCount - a.activityCount ||
        a.wbsId.localeCompare(
          b.wbsId,
          undefined,
          { numeric: true },
        ),
    );

  return {
    schemaVersion: "1.0",
    projectionKey: "progress_breakdown",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    totalActivityCount: rows.reduce(
      (sum, row) => sum + row.activityCount,
      0,
    ),
    rows,
  };
}
