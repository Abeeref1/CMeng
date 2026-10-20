import { parseScheduleTime } from "../../schedule-analysis-core/src";
import {
  sourceScheduleCompletionBases,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import {
  calculateCpm,
  relationshipLagCalendarSummary,
  type CpmConfig,
} from "../../schedule-cpm/src";
import type {
  ConstraintComparison,
  IndependentForecastActivityRow,
  IndependentForecastProjection,
  ProbabilisticForecastComparator,
} from "./types";

function dateMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseScheduleTime(value);
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
        "Probabilistic comparator requires a valid Data Date, a standard CPM future completion and valid triangular duration factors.",
        "This comparator does not replace the standard CPM calculation and is not an entitlement or contractual forecast.",
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
      "P50/P80/P90 are limited duration-factor comparators around the standard CPM remaining duration.",
      "The comparator is seeded and reproducible.",
      "The comparator does not model activity-by-activity uncertainty or correlations and remains non-official.",
      "The standard CPM calculation remains the main independent forecast.",
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

  // Independent CPM is already calculated above. Preserve the exact
  // original source-forecast date without running graph, float and progress
  // analytics again merely for this one source-comparison field.
  const sourceForecastCompletionIso =
    sourceScheduleCompletionBases(model).find(
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
    model.activities.filter(activity=>cpmById.has(activity.activityId)).map((activity) => {
      const calculated =
        cpmById.get(activity.activityId);
      const sourceFinishIso =
        sourceFinish(activity);
      const independentEarlyFinishIso =
        calculated?.calendarMode==='source_calendar'?calculated?.earlyFinishIso??null:null;

      return {
        activityId: activity.activityId,
        sourceFinishIso,
        independentEarlyStartIso:calculated?.calendarMode==='source_calendar'?calculated?.earlyStartIso??null:null,
        independentEarlyFinishIso,
        finishVarianceDays:
          dayVariance(
            sourceFinishIso,
            independentEarlyFinishIso,
          ),
        independentTotalFloatHours:
          calculated?.calendarMode==='source_calendar'?calculated?.totalFloatHours??null:null,
        critical:
          calculated?.calendarMode==='source_calendar'?calculated?.critical??null:null,
        calendarMode:
          calculated?.calendarMode ??
          "elapsed_fallback",
        status:
          calculated?.calendarMode==='source_calendar'?calculated?.status??'unresolved':'unresolved',
        diagnostics: [
          ...(calculated?.diagnostics ?? [
            "INDEPENDENT_FORECAST_ACTIVITY_NOT_CALCULATED",
          ]),
        ],
      };
    });

  const unresolvedCalendarCount=activities.filter(a=>a.calendarMode==='elapsed_fallback').length;
  const resolvedFinish=cpm.complete&&unresolvedCalendarCount===0?cpm.projectFinishIso:null;
  const calculatedActivityCount =
    activities.filter(
      (activity) =>
        activity.status === "calculated",
    ).length;

  const constraintComparison: ConstraintComparison | undefined =
    input.cpmConfig?.applySourceConstraints === true
      ? compareConstraintRuns(model, input.cpmConfig, resolvedFinish)
      : undefined;

  const origin =
    !cpm.complete || unresolvedCalendarCount>0
      ? "unresolved"
      : cpm.assumptions.length === 0 &&
          cpm.calculationMode ===
            "calendar_working_time"
        ? "deterministic_source_calendar"
        : "scenario_with_assumptions";

  return {
    schemaVersion: "1.0",
    activityPopulation:cpm.activityPopulation,
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
    relationshipLagCalendar:
      relationshipLagCalendarSummary(model),
    sourceForecastCompletionIso,
    independentForecastCompletionIso:
      resolvedFinish,
    forecastVarianceDays:
      dayVariance(
        sourceForecastCompletionIso,
        resolvedFinish,
      ),
    requiredFinishIso:
      cpm.requiredFinishIso,
    requiredFinishVarianceDays:
      dayVariance(
        cpm.requiredFinishIso,
        resolvedFinish,
      ),
    calculatedActivityCount,
    unresolvedActivityCount:
      Math.max(unresolvedCalendarCount,activities.length-calculatedActivityCount),
    activityCoveragePercent: coverage(
      calculatedActivityCount,
      activities.length,
    ),
    drivingNetwork:cpm.complete&&unresolvedCalendarCount===0?cpm.drivingNetwork:undefined,
    criticalActivityIds: [
      ...cpm.criticalActivityIds,
    ],
    assumptions: [...cpm.assumptions],
    diagnostics: [...cpm.diagnostics],
    probabilistic: probabilisticComparator(
      model.dataDateIso,
      resolvedFinish,
      input.probabilisticConfig,
    ),
    activities,
    complete: cpm.complete && unresolvedCalendarCount===0,
    ...(constraintComparison ? {constraintComparison} : {}),
  };
}

function cpmResolvedFinish(cpm: ReturnType<typeof calculateCpm>): string | null {
  const elapsed = cpm.activities.some((activity) => activity.calendarMode === "elapsed_fallback");
  return cpm.complete && !elapsed ? cpm.projectFinishIso : null;
}

/**
 * F26: run the same CPM engine without the source constraints and publish
 * both completions. Same rule as the constrained run's completion: null when
 * the run is incomplete or any activity fell back to elapsed time. When the
 * source has no constraints the two networks are identical, so the second run
 * is not repeated.
 */
function compareConstraintRuns(
  model: CanonicalScheduleModel,
  cpmConfig: Partial<CpmConfig>,
  withConstraintsCompletionIso: string | null,
): ConstraintComparison {
  // Same population the engine applies (engine.ts: activities with sourceConstraints).
  const constrainedActivityCount = model.activities.filter((a) => a.sourceConstraints?.length).length;
  const applied = constrainedActivityCount > 0;
  const formula = "difference (calendar days) = completion with source constraints - completion without source constraints; same CPM engine, same durations, logic and calendars";
  if (!applied) {
    return {
      basis: "no_source_constraints_identical_network",
      formula,
      constrainedActivityCount: 0,
      withConstraintsCompletionIso,
      withoutConstraintsCompletionIso: withConstraintsCompletionIso,
      differenceCalendarDays: withConstraintsCompletionIso === null ? null : 0,
    };
  }
  const unconstrained = calculateCpm(model, {
    durationBasis: "remaining",
    ...cpmConfig,
    applySourceConstraints: false,
  });
  const withoutConstraintsCompletionIso = cpmResolvedFinish(unconstrained);
  return {
    basis: "source_constraints_applied_vs_not_applied",
    formula,
    constrainedActivityCount,
    withConstraintsCompletionIso,
    withoutConstraintsCompletionIso,
    differenceCalendarDays: dayVariance(withoutConstraintsCompletionIso, withConstraintsCompletionIso),
  };
}
