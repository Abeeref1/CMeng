import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  activityNearCriticalThresholdHours,
  nearCriticalThresholdBasis,
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
  const rows = classified
    .filter(
      ({ activity, threshold }) =>
        threshold !== null &&
        activity.totalFloatHours! >
          config.criticalFloatThresholdHours &&
        activity.totalFloatHours! <= threshold,
    )
    .map(({ activity, threshold }) => ({
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
    }))
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
    rows,
  };
}
