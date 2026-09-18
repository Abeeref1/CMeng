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
  ProbabilisticForecastComparator,
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


function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state =
      (Math.imul(1664525, state) +
        1013904223) >>>
      0;
    return state / 4_294_967_296;
  };
}

function triangular(
  random: () => number,
  min: number,
  mode: number,
  max: number,
): number {
  const u = random();
  const split =
    (mode - min) / (max - min);
  if (u < split) {
    return min +
      Math.sqrt(
        u *
          (max - min) *
          (mode - min),
      );
  }
  return max -
    Math.sqrt(
      (1 - u) *
        (max - min) *
        (max - mode),
    );
}

function percentile(
  values: readonly number[],
  p: number,
): number | null {
  if (values.length === 0) return null;
  const index = Math.min(
    values.length - 1,
    Math.max(
      0,
      Math.ceil(p * values.length) - 1,
    ),
  );
  return values[index] ?? null;
}

function probabilisticComparator(
  dataDateIso: string | null,
  deterministicCompletionIso: string | null,
  config:
    | {
        iterations?: number;
        seed?: number;
        minFactor?: number;
        modeFactor?: number;
        maxFactor?: number;
      }
    | undefined,
): ProbabilisticForecastComparator {
  const iterations =
    config?.iterations ?? 2_000;
  const seed = config?.seed ?? 20_260_918;
  const minFactor =
    config?.minFactor ?? 0.9;
  const modeFactor =
    config?.modeFactor ?? 1.0;
  const maxFactor =
    config?.maxFactor ?? 1.25;

  const dataDate = dateMs(dataDateIso);
  const deterministic =
    dateMs(deterministicCompletionIso);

  const validConfig =
    Number.isSafeInteger(iterations) &&
    iterations >= 100 &&
    iterations <= 100_000 &&
    Number.isFinite(minFactor) &&
    Number.isFinite(modeFactor) &&
    Number.isFinite(maxFactor) &&
    minFactor > 0 &&
    minFactor <= modeFactor &&
    modeFactor <= maxFactor &&
    maxFactor > minFactor;

  if (
    !validConfig ||
    dataDate === null ||
    deterministic === null ||
    deterministic <= dataDate
  ) {
    return {
      status: "unavailable",
      method:
        "limited_triangular_duration_factor",
      authority: "non_official",
      iterations,
      seed,
      minFactor,
      modeFactor,
      maxFactor,
      p50CompletionIso: null,
      p80CompletionIso: null,
      p90CompletionIso: null,
      assumptions: [
        "Probabilistic comparator requires a valid Data Date, deterministic future completion and valid triangular duration factors.",
        "This comparator does not replace deterministic CPM and is not an entitlement or contractual forecast.",
      ],
    };
  }

  const baseDuration =
    deterministic - dataDate;
  const random = seededRandom(seed);
  const completions: number[] = [];

  for (
    let index = 0;
    index < iterations;
    index += 1
  ) {
    const factor = triangular(
      random,
      minFactor,
      modeFactor,
      maxFactor,
    );
    completions.push(
      dataDate + baseDuration * factor,
    );
  }

  completions.sort((a, b) => a - b);

  const toIso = (
    value: number | null,
  ): string | null =>
    value === null
      ? null
      : new Date(value).toISOString();

  return {
    status: "available",
    method:
      "limited_triangular_duration_factor",
    authority: "non_official",
    iterations,
    seed,
    minFactor,
    modeFactor,
    maxFactor,
    p50CompletionIso:
      toIso(percentile(completions, 0.5)),
    p80CompletionIso:
      toIso(percentile(completions, 0.8)),
    p90CompletionIso:
      toIso(percentile(completions, 0.9)),
    assumptions: [
      "P50/P80/P90 are limited duration-factor comparators around the deterministic CPM remaining duration.",
      "The comparator is seeded and reproducible.",
      "The comparator does not model activity-by-activity uncertainty or correlations and remains non-official.",
      "Deterministic CPM remains the canonical independent forecast.",
    ],
  };
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
    probabilisticConfig?: {
      iterations?: number;
      seed?: number;
      minFactor?: number;
      modeFactor?: number;
      maxFactor?: number;
    };
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
    probabilistic: probabilisticComparator(
      model.dataDateIso,
      cpm.projectFinishIso,
      input.probabilisticConfig,
    ),
    activities,
    complete: cpm.complete,
  };
}
