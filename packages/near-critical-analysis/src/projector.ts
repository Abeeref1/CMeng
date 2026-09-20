import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
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

  const rows = known
    .filter(
      (activity) => {
        const value =
          activity.totalFloatHours!;
        const aboveLower =
          config
            .nearCriticalLowerBoundInclusive
            ? value >=
              config
                .nearCriticalLowerBoundHours
            : value >
              config
                .nearCriticalLowerBoundHours;
        return (
          aboveLower &&
          value <=
            config
              .nearCriticalFloatThresholdHours
        );
      },
    )
    .map((activity) => ({
      activityId: activity.activityId,
      name: activity.name,
      wbsId: activity.wbsId,
      status: activity.status,
      totalFloatHours:
        activity.totalFloatHours!,
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
      config.nearCriticalFloatThresholdHours,
    nearCriticalLowerBoundHours:
      config.nearCriticalLowerBoundHours,
    nearCriticalLowerBoundInclusive:
      config.nearCriticalLowerBoundInclusive,
    floatCoveragePercent: coverage(
      known.length,
      model.activities.length,
    ),
    nearCriticalCount: rows.length,
    rows,
  };
}
