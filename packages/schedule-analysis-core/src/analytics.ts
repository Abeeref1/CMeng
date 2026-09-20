import { analyzeScheduleGraph } from "./graph";
import {
  activityNearCriticalThresholdHours,
  nearCriticalThresholdBasis,
  sourceFloatCriticality,
  sourceFloatMeetsNearCriticalLowerBound,
} from "./float-thresholds";
import type {
  AverageMetric,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
  CompletionBasisValue,
  FloatSummary,
  MilestoneSummary,
  ProgressSummary,
  ScheduleAnalysisConfig,
  ScheduleAnalyticsResult,
  VarianceSummary,
} from "./types";
import { DEFAULT_SCHEDULE_ANALYSIS_CONFIG } from "./types";

function coveragePercent(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function validIsoDate(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function maxDate(
  values: Array<{
    dateIso: string | null;
    activityId: string;
    sourceRef: string;
  }>,
): {
  dateIso: string | null;
  activityId: string | null;
  sourceRef: string | null;
} {
  let best:
    | {
        ms: number;
        dateIso: string;
        activityId: string;
        sourceRef: string;
      }
    | null = null;

  for (const value of values) {
    const ms = validIsoDate(value.dateIso);
    if (ms === null || !value.dateIso) continue;
    if (!best || ms > best.ms) {
      best = {
        ms,
        dateIso: value.dateIso,
        activityId: value.activityId,
        sourceRef: value.sourceRef,
      };
    }
  }

  return best
    ? {
        dateIso: best.dateIso,
        activityId: best.activityId,
        sourceRef: best.sourceRef,
      }
    : {
        dateIso: null,
        activityId: null,
        sourceRef: null,
      };
}

function executableActivities(
  model: CanonicalScheduleModel,
): CanonicalScheduleActivity[] {
  return model.activities.filter(
    (activity) =>
      activity.activityType !== "wbs_summary" &&
      activity.activityType !== "level_of_effort",
  );
}

function statusSummary(
  activities: readonly CanonicalScheduleActivity[],
) {
  return {
    completed: activities.filter(
      (activity) => activity.status === "completed",
    ).length,
    inProgress: activities.filter(
      (activity) => activity.status === "in_progress",
    ).length,
    notStarted: activities.filter(
      (activity) => activity.status === "not_started",
    ).length,
    unknown: activities.filter(
      (activity) => activity.status === "unknown",
    ).length,
  };
}

function averagePercentComplete(
  activities: readonly CanonicalScheduleActivity[],
): AverageMetric {
  const known = activities.filter(
    (activity) =>
      activity.percentComplete !== null &&
      activity.percentComplete >= 0 &&
      activity.percentComplete <= 100,
  );

  return {
    value:
      known.length === 0
        ? null
        : Number(
            (
              known.reduce(
                (sum, activity) =>
                  sum + activity.percentComplete!,
                0,
              ) / known.length
            ).toFixed(6),
          ),
    knownCount: known.length,
    totalCount: activities.length,
    coveragePercent: coveragePercent(
      known.length,
      activities.length,
    ),
  };
}

function durationWeightedPercentComplete(
  activities: readonly CanonicalScheduleActivity[],
): AverageMetric {
  const eligible = activities.filter(
    (activity) =>
      activity.activityType !== "start_milestone" &&
      activity.activityType !== "finish_milestone" &&
      activity.activityType !== "milestone",
  );

  const known = eligible.filter(
    (activity) =>
      activity.originalDurationHours !== null &&
      activity.originalDurationHours > 0 &&
      activity.percentComplete !== null &&
      activity.percentComplete >= 0 &&
      activity.percentComplete <= 100,
  );

  const duration = known.reduce(
    (sum, activity) =>
      sum + activity.originalDurationHours!,
    0,
  );

  const weighted =
    duration > 0
      ? known.reduce(
          (sum, activity) =>
            sum +
            activity.originalDurationHours! *
              activity.percentComplete!,
          0,
        ) / duration
      : null;

  return {
    value:
      weighted === null
        ? null
        : Number(weighted.toFixed(6)),
    knownCount: known.length,
    totalCount: eligible.length,
    coveragePercent: coveragePercent(
      known.length,
      eligible.length,
    ),
  };
}

function progressSummary(
  activities: readonly CanonicalScheduleActivity[],
): ProgressSummary {
  return {
    status: statusSummary(activities),
    percentCompleteAverage:
      averagePercentComplete(activities),
    durationWeightedPercentComplete:
      durationWeightedPercentComplete(activities),
  };
}

function floatSummary(
  model: CanonicalScheduleModel,
  activities: readonly CanonicalScheduleActivity[],
  config: ScheduleAnalysisConfig,
): FloatSummary {
  const known = activities.filter(
    (activity) => activity.totalFloatHours !== null,
  );

  const critical = known.filter(
    (activity) =>
      sourceFloatCriticality(model, activity, config) === "critical",
  );
  const nearCritical = known.filter(
    (activity) =>
      sourceFloatCriticality(model, activity, config) === "near_critical",
  );
  const thresholdUnresolved = known.filter(
    (activity) =>
      sourceFloatMeetsNearCriticalLowerBound(
        activity.totalFloatHours!,
        config,
      ) &&
      activityNearCriticalThresholdHours(model, activity, config) === null,
  );

  return {
    criticalCount: critical.length,
    nearCriticalCount: nearCritical.length,
    negativeFloatCount: known.filter(
      (activity) => activity.totalFloatHours! < 0,
    ).length,
    positiveFloatCount: known.filter(
      (activity) => activity.totalFloatHours! > 0,
    ).length,
    unknownFloatCount:
      activities.length - known.length,
    knownFloatCount: known.length,
    totalActivities: activities.length,
    coveragePercent: coveragePercent(
      known.length,
      activities.length,
    ),
    criticalThresholdHours:
      config.criticalFloatThresholdHours,
    nearCriticalThresholdHours:
      config.nearCriticalWorkingDays !== undefined &&
      config.nearCriticalWorkingDays !== null
        ? null
        : config.nearCriticalFloatThresholdHours,
    nearCriticalWorkingDays:
      config.nearCriticalWorkingDays ?? null,
    nearCriticalThresholdBasis:
      nearCriticalThresholdBasis(config),
    nearCriticalThresholdUnresolvedCount:
      thresholdUnresolved.length,
  };
}

function milestoneSummary(
  activities: readonly CanonicalScheduleActivity[],
): MilestoneSummary {
  const milestones = activities.filter((activity) =>
    [
      "milestone",
      "start_milestone",
      "finish_milestone",
    ].includes(activity.activityType),
  );

  return {
    milestoneActivityIds: milestones.map(
      (activity) => activity.activityId,
    ),
    completedMilestones: milestones
      .filter(
        (activity) => activity.status === "completed",
      )
      .map((activity) => activity.activityId),
    openMilestones: milestones
      .filter(
        (activity) => activity.status !== "completed",
      )
      .map((activity) => activity.activityId),
    inferredFromZeroDurationIds: milestones
      .filter(
        (activity) =>
          activity.activityType === "milestone" &&
          activity.originalDurationHours === 0,
      )
      .map((activity) => activity.activityId),
  };
}

function effectiveCurrentFinish(
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
    null
  );
}

function finishVariance(
  activities: readonly CanonicalScheduleActivity[],
  config: ScheduleAnalysisConfig,
): VarianceSummary {
  const variances: number[] = [];

  for (const activity of activities) {
    const baseline = validIsoDate(
      activity.baselineFinishIso,
    );
    const current = validIsoDate(
      effectiveCurrentFinish(activity),
    );

    if (baseline === null || current === null) {
      continue;
    }

    variances.push(
      (current - baseline) / 86_400_000,
    );
  }

  const late = variances.filter(
    (days) =>
      days > config.varianceLateThresholdDays,
  );
  const early = variances.filter(
    (days) =>
      days < -config.varianceLateThresholdDays,
  );
  const onTime =
    variances.length - late.length - early.length;

  return {
    method:
      "baseline finish vs completed actual finish, otherwise explicit forecast/current finish",
    comparableActivities: variances.length,
    lateActivities: late.length,
    earlyActivities: early.length,
    onTimeActivities: onTime,
    unknownActivities:
      activities.length - variances.length,
    averageFinishVarianceDays:
      variances.length === 0
        ? null
        : Number(
            (
              variances.reduce(
                (sum, value) => sum + value,
                0,
              ) / variances.length
            ).toFixed(6),
          ),
    maximumDelayDays:
      variances.length === 0
        ? null
        : Number(
            Math.max(...variances).toFixed(6),
          ),
    coveragePercent: coveragePercent(
      variances.length,
      activities.length,
    ),
  };
}

function completionBases(
  activities: readonly CanonicalScheduleActivity[],
): CompletionBasisValue[] {
  const total = activities.length;

  const programmeKnown = activities.filter(
    (activity) =>
      validIsoDate(activity.baselineFinishIso) !== null,
  );
  const programme = maxDate(
    programmeKnown.map((activity) => ({
      dateIso: activity.baselineFinishIso,
      activityId: activity.activityId,
      sourceRef:
        "activity:" +
        activity.activityId +
        ":baselineFinish",
    })),
  );

  const forecastKnown = activities.filter(
    (activity) =>
      validIsoDate(
        effectiveCurrentFinish(activity),
      ) !== null,
  );
  const forecast = maxDate(
    forecastKnown.map((activity) => ({
      dateIso: effectiveCurrentFinish(activity),
      activityId: activity.activityId,
      sourceRef:
        "activity:" +
        activity.activityId +
        ":effectiveCurrentFinish",
    })),
  );

  const completed = activities.filter(
    (activity) => activity.status === "completed",
  );
  const actualKnown = completed.filter(
    (activity) =>
      validIsoDate(activity.actualFinishIso) !== null,
  );
  const actual = maxDate(
    actualKnown.map((activity) => ({
      dateIso: activity.actualFinishIso,
      activityId: activity.activityId,
      sourceRef:
        "activity:" +
        activity.activityId +
        ":actualFinish",
    })),
  );

  const stateFor = (
    known: number,
    totalCount: number,
  ): "available" | "partial" | "missing" => {
    if (known === 0) return "missing";
    return known === totalCount
      ? "available"
      : "partial";
  };

  return [
    {
      basis: "programme",
      dateIso: programme.dateIso,
      activityId: programme.activityId,
      state: stateFor(
        programmeKnown.length,
        total,
      ),
      coveragePercent: coveragePercent(
        programmeKnown.length,
        total,
      ),
      method:
        "latest source baseline/programme finish across executable activities",
      sourceRefs: programme.sourceRef
        ? [programme.sourceRef]
        : [],
    },
    {
      basis: "forecast",
      dateIso: forecast.dateIso,
      activityId: forecast.activityId,
      state: stateFor(
        forecastKnown.length,
        total,
      ),
      coveragePercent: coveragePercent(
        forecastKnown.length,
        total,
      ),
      method:
        "latest completed actual finish, otherwise explicit forecast/current finish",
      sourceRefs: forecast.sourceRef
        ? [forecast.sourceRef]
        : [],
    },
    {
      basis: "actual",
      dateIso:
        completed.length === total &&
        actualKnown.length === total
          ? actual.dateIso
          : null,
      activityId:
        completed.length === total &&
        actualKnown.length === total
          ? actual.activityId
          : null,
      state:
        completed.length === total &&
        actualKnown.length === total &&
        total > 0
          ? "available"
          : actualKnown.length > 0
            ? "partial"
            : "missing",
      coveragePercent: coveragePercent(
        actualKnown.length,
        total,
      ),
      method:
        "actual project completion is published only when all executable activities are complete with actual finish dates",
      sourceRefs:
        completed.length === total &&
        actualKnown.length === total &&
        actual.sourceRef
          ? [actual.sourceRef]
          : [],
    },
  ];
}

export function analyzeSchedule(
  model: CanonicalScheduleModel,
  config: ScheduleAnalysisConfig =
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
): ScheduleAnalyticsResult {
  if (
    config.nearCriticalFloatThresholdHours <
    config.criticalFloatThresholdHours
  ) {
    throw new Error(
      "nearCriticalFloatThresholdHours cannot be below criticalFloatThresholdHours",
    );
  }

  const activities = executableActivities(model);
  const graph = analyzeScheduleGraph(model);
  const diagnostics = [
    ...model.diagnostics,
    ...graph.diagnostics,
  ];

  return {
    projectId: model.projectId,
    sourceRevisionId: model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    graph,
    status: statusSummary(activities),
    progress: progressSummary(activities),
    float: floatSummary(model, activities, config),
    milestones: milestoneSummary(activities),
    finishVariance: finishVariance(
      activities,
      config,
    ),
    completionBases: completionBases(activities),
    activityCount: model.activities.length,
    relationshipCount:
      model.relationships.length,
    wbsCount: model.wbs.length,
    calendarCount: model.calendars.length,
    diagnostics,
    complete:
      graph.complete &&
      model.diagnostics.length === 0,
  };
}
