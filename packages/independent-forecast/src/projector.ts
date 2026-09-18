import {
  analyzeSchedule,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import {
  calculateCpm,
  type CpmConfig,
} from "../../schedule-cpm/src";
import type {
  IndependentForecastActivityRow,
  IndependentForecastProjection,
} from "./types";

function dateMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function dayVariance(
  from: string | null,
  to: string | null,
): number | null {
  const fromMs = dateMs(from);
  const toMs = dateMs(to);
  if (
    fromMs === null ||
    toMs === null
  ) {
    return null;
  }

  return Number(
    ((toMs - fromMs) / 86_400_000).toFixed(6),
  );
}

function sourceFinish(
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
    activity.currentFinishIso ??
    activity.actualFinishIso
  );
}

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

export function buildIndependentForecastProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    cpmConfig?: Partial<CpmConfig>;
  },
): IndependentForecastProjection {
  const cpm = calculateCpm(model, {
    durationBasis: "remaining",
    ...(input.cpmConfig ?? {}),
  });

  const sourceAnalytics =
    analyzeSchedule(model);
  const sourceForecastCompletionIso =
    sourceAnalytics.completionBases.find(
      (basis) =>
        basis.basis === "forecast",
    )?.dateIso ?? null;

  const cpmById = new Map(
    cpm.activities.map((activity) => [
      activity.activityId,
      activity,
    ]),
  );

  const activities: IndependentForecastActivityRow[] =
    model.activities.map((activity) => {
      const calculated =
        cpmById.get(activity.activityId);
      const sourceFinishIso =
        sourceFinish(activity);
      const independentEarlyFinishIso =
        calculated?.earlyFinishIso ?? null;

      return {
        activityId: activity.activityId,
        sourceFinishIso,
        independentEarlyFinishIso,
        finishVarianceDays:
          dayVariance(
            sourceFinishIso,
            independentEarlyFinishIso,
          ),
        independentTotalFloatHours:
          calculated?.totalFloatHours ??
          null,
        critical:
          calculated?.critical ?? null,
        calendarMode:
          calculated?.calendarMode ??
          "elapsed_fallback",
        status:
          calculated?.status ??
          "unresolved",
        diagnostics: [
          ...(calculated?.diagnostics ?? [
            "INDEPENDENT_FORECAST_ACTIVITY_NOT_CALCULATED",
          ]),
        ],
      };
    });

  const calculatedActivityCount =
    activities.filter(
      (activity) =>
        activity.status === "calculated",
    ).length;

  const origin =
    !cpm.complete
      ? "unresolved"
      : cpm.assumptions.length === 0 &&
          cpm.calculationMode ===
            "calendar_working_time"
        ? "deterministic_source_calendar"
        : "scenario_with_assumptions";

  return {
    schemaVersion: "1.0",
    projectionKey: "independent_forecast",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    origin,
    durationBasis:
      cpm.durationBasis,
    calculationMode:
      cpm.calculationMode,
    sourceForecastCompletionIso,
    independentForecastCompletionIso:
      cpm.projectFinishIso,
    forecastVarianceDays:
      dayVariance(
        sourceForecastCompletionIso,
        cpm.projectFinishIso,
      ),
    requiredFinishIso:
      cpm.requiredFinishIso,
    requiredFinishVarianceDays:
      dayVariance(
        cpm.requiredFinishIso,
        cpm.projectFinishIso,
      ),
    calculatedActivityCount,
    unresolvedActivityCount:
      activities.length -
      calculatedActivityCount,
    activityCoveragePercent: coverage(
      calculatedActivityCount,
      activities.length,
    ),
    criticalActivityIds: [
      ...cpm.criticalActivityIds,
    ],
    assumptions: [...cpm.assumptions],
    diagnostics: [...cpm.diagnostics],
    activities,
    complete: cpm.complete,
  };
}
