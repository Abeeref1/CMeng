import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  activityNearCriticalThresholdHours,
  nearCriticalThresholdBasis,
  sourceFloatCriticality,
  sourceFloatInFloatRiskWatchlist,
  type CanonicalScheduleModel,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  NearCriticalProjection,
} from "./types";

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

export function buildNearCriticalProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
  },
): NearCriticalProjection {
  const config =
    input.config ??
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG;

  const known = model.activities.filter(
    (activity) =>
      activity.totalFloatHours !== null,
  );

  const classified = known.map((activity) => ({
    activity,
    threshold:
      activityNearCriticalThresholdHours(
        model,
        activity,
        config,
      ),
  }));
  const rowFor = ({
    activity,
    threshold,
  }: (typeof classified)[number]) => ({
    activityId: activity.activityId,
    name: activity.name,
    wbsId: activity.wbsId,
    calendarId: activity.calendarId,
    status: activity.status,
    totalFloatHours:
      activity.totalFloatHours!,
    nearCriticalThresholdHours:
      threshold,
    baselineFinishIso:
      activity.baselineFinishIso,
    currentFinishIso:
      activity.forecastFinishIso ??
      activity.currentFinishIso ??
      activity.actualFinishIso,
    percentComplete:
      activity.percentComplete,
  });

  const rows = classified
    .filter(
      ({ activity, threshold }) =>
        threshold !== null &&
        sourceFloatCriticality(
          model,
          activity,
          config,
        ) === "near_critical",
    )
    .map(rowFor)
    .sort(
      (a, b) =>
        a.totalFloatHours -
          b.totalFloatHours ||
        a.activityId.localeCompare(
          b.activityId,
          undefined,
          { numeric: true },
        ),
    );

  const watchlistRows = classified
    .filter(
      ({ activity, threshold }) =>
        threshold !== null &&
        sourceFloatInFloatRiskWatchlist(
          model,
          activity,
          config,
        ) === true,
    )
    .map(rowFor)
    .sort(
      (a, b) =>
        a.totalFloatHours -
          b.totalFloatHours ||
        a.activityId.localeCompare(
          b.activityId,
          undefined,
          { numeric: true },
        ),
    );

  return {
    schemaVersion: "1.0",
    projectionKey: "near_critical",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    criticalThresholdHours:
      config.criticalFloatThresholdHours,
    nearCriticalThresholdHours:
      config.nearCriticalWorkingDays !== undefined &&
      config.nearCriticalWorkingDays !== null
        ? null
        : config.nearCriticalFloatThresholdHours,
    nearCriticalThresholdWorkingDays:
      config.nearCriticalWorkingDays ?? null,
    thresholdBasis:
      nearCriticalThresholdBasis(config) ===
      "activity_working_days"
        ? "activity_calendar_working_days"
        : "explicit_hours",
    floatCoveragePercent: coverage(
      known.length,
      model.activities.length,
    ),
    classificationCoveragePercent: coverage(
      classified.filter(
        ({ activity, threshold }) =>
          activity.totalFloatHours! <=
            config.criticalFloatThresholdHours ||
          threshold !== null,
      ).length,
      model.activities.length,
    ),
    nearCriticalCount: rows.length,
    floatRiskWatchlistCount:
      watchlistRows.length,
    zeroFloatCount: known.filter(
      (activity) =>
        activity.totalFloatHours ===
        0,
    ).length,
    negativeFloatCount: known.filter(
      (activity) =>
        activity.totalFloatHours! <
        config.criticalFloatThresholdHours,
    ).length,
    floatRiskWatchlistIncludesCriticalThreshold:
      config.floatRiskWatchlistIncludesCriticalThreshold === true,
    rows,
    watchlistRows,
  };
}
