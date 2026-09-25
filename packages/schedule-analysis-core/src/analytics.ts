import { parseScheduleTime } from "./date-time";
import { activityPopulation, scheduleProgress } from "./population";
import { analyzeScheduleGraph } from "./graph";
import {
  activityNearCriticalThresholdHours,
  nearCriticalThresholdBasis,
  sourceFloatCriticality,
  sourceFloatInFloatRiskWatchlist,
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
  const ms = parseScheduleTime(value);
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

function durationWeightedPercentComplete(activities: readonly CanonicalScheduleActivity[]): AverageMetric {
  return scheduleProgress(activities);
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
      activityNearCriticalThresholdHours(model, activity, config) === null,
  );
  const floatRiskWatchlist = known.filter(
    (activity) =>
      sourceFloatInFloatRiskWatchlist(
        model,
        activity,
        config,
      ) === true,
  );

  return {
    criticalCount: known.length===activities.length?critical.length:null,
    knownClassifications: {critical:critical.length,nearCritical:nearCritical.length,noncritical:known.filter(a=>sourceFloatCriticality(model,a,config)==="noncritical").length,unknown:activities.filter(a=>sourceFloatCriticality(model,a,config)==="unknown").length},
    nearCriticalCount: known.length!==activities.length||thresholdUnresolved.length?null:nearCritical.length,
    floatRiskWatchlistCount:
      known.length!==activities.length||thresholdUnresolved.length ? null : floatRiskWatchlist.length,
    zeroFloatCount: known.length!==activities.length?null:known.filter(
      (activity) =>
        activity.totalFloatHours ===
        0,
    ).length,
    negativeFloatCount: known.length!==activities.length?null:known.filter(
      (activity) => activity.totalFloatHours! < 0,
    ).length,
    positiveFloatCount: known.length!==activities.length?null:known.filter(
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
    floatRiskWatchlistIncludesCriticalThreshold:
      config.floatRiskWatchlistIncludesCriticalThreshold === true,
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
  // The elapsed-hour upper bound is a legacy alternative basis. Once a
  // working-day rule is active, each activity calendar supplies the operative
  // hour-equivalent threshold, so the legacy hour value must not invalidate it.
  const usesWorkingDayNearCriticalRule =
    config.nearCriticalWorkingDays !== undefined &&
    config.nearCriticalWorkingDays !== null;

  if (
    !usesWorkingDayNearCriticalRule &&
    config.nearCriticalFloatThresholdHours <
      config.criticalFloatThresholdHours
  ) {
    throw new Error(
      "nearCriticalFloatThresholdHours cannot be below criticalFloatThresholdHours when the near-critical basis is elapsed hours",
    );
  }

  const activities = activityPopulation(model).activities;
  const wbsSummaryCount = model.activities.filter(
    (activity) => activity.activityType === "wbs_summary",
  ).length;
  const levelOfEffortCount = model.activities.filter(
    (activity) => activity.activityType === "level_of_effort",
  ).length;
  const excludedActivityCount =
    model.activities.length - activities.length;
  const graph = analyzeScheduleGraph(model);
  const executionIds = new Set(activities.map(a => a.activityId));
  const executableIds = (ids: string[]) => ids.filter(id => executionIds.has(id));
  const executionOpenStarts = executableIds(graph.openStartActivityIds);
  const executionOpenFinishes = executableIds(graph.openFinishActivityIds);
  const boundaryCandidates = activities.filter(a =>
    a.activityType === "start_milestone" && executionOpenStarts.includes(a.activityId) ||
    a.activityType === "finish_milestone" && executionOpenFinishes.includes(a.activityId)).map(a=>a.activityId);
  const logicQuality = {
    state: executionOpenStarts.length || executionOpenFinishes.length || !graph.complete ? "review_required" as const : "no_detected_exceptions" as const,
    executionOpenStartActivityIds: executionOpenStarts, executionOpenFinishActivityIds: executionOpenFinishes,
    executionIsolatedActivityIds: executableIds(graph.isolatedActivityIds),
    excludedIsolatedActivityIds: graph.isolatedActivityIds.filter(id => !executionIds.has(id)),
    boundaryCandidateActivityIds: boundaryCandidates,
    boundaryApprovalState: "not_established" as const,
    interpretation: "Computational graph integrity does not establish adequate sequencing. Boundary candidates require governed confirmation; source records remain auditable.",
  };
  const diagnostics = [
    ...model.diagnostics,
    ...graph.diagnostics,
  ];

  return {
    projectId: model.projectId,
    sourceRevisionId: model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    graph,
    logicQuality,
    population: {
      sourceActivityCount: model.activities.length,
      executableActivityCount: activities.length,
      excludedActivityCount,
      excludedByType: {
        wbsSummaryCount,
        levelOfEffortCount,
        otherExcludedCount:
          Math.max(
            0,
            excludedActivityCount -
              wbsSummaryCount -
              levelOfEffortCount,
          ),
      },
      basis: "execution_control_population",
    },
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
