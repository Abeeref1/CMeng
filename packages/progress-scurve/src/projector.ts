import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  ActualProgressSnapshot,
  ProgressScurvePoint,
  ProgressScurveProjection,
} from "./types";

interface WeightedActivity {
  activityId: string;
  weight: number;
  startMs: number;
  finishMs: number;
}

function dateMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function dateIso(ms: number): string {
  return new Date(ms)
    .toISOString()
    .slice(0, 10);
}

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function eligibleWeightedActivities(
  activities: readonly CanonicalScheduleActivity[],
  dates: (
    activity: CanonicalScheduleActivity,
  ) => {
    startIso: string | null;
    finishIso: string | null;
  },
): WeightedActivity[] {
  const out: WeightedActivity[] = [];

  for (const activity of activities) {
    if (
      activity.originalDurationHours === null ||
      activity.originalDurationHours <= 0 ||
      activity.activityType === "milestone" ||
      activity.activityType === "start_milestone" ||
      activity.activityType === "finish_milestone" ||
      activity.activityType === "wbs_summary"
    ) {
      continue;
    }

    const pair = dates(activity);
    const startMs = dateMs(pair.startIso);
    const finishMs = dateMs(pair.finishIso);

    if (
      startMs === null ||
      finishMs === null ||
      finishMs < startMs
    ) {
      continue;
    }

    out.push({
      activityId: activity.activityId,
      weight: activity.originalDurationHours,
      startMs,
      finishMs,
    });
  }

  return out;
}

function cumulativePercent(
  activities: readonly WeightedActivity[],
  pointMs: number,
): number | null {
  const totalWeight = activities.reduce(
    (sum, activity) =>
      sum + activity.weight,
    0,
  );
  if (totalWeight <= 0) return null;

  let earnedWeight = 0;

  for (const activity of activities) {
    if (pointMs < activity.startMs) {
      continue;
    }

    if (
      pointMs >= activity.finishMs ||
      activity.finishMs === activity.startMs
    ) {
      earnedWeight += activity.weight;
      continue;
    }

    const fraction =
      (pointMs - activity.startMs) /
      (activity.finishMs - activity.startMs);

    earnedWeight +=
      activity.weight *
      Math.max(0, Math.min(1, fraction));
  }

  return Number(
    ((earnedWeight / totalWeight) * 100).toFixed(6),
  );
}

function currentDates(
  activity: CanonicalScheduleActivity,
): {
  startIso: string | null;
  finishIso: string | null;
} {
  return {
    startIso:
      activity.forecastStartIso ??
      activity.currentStartIso ??
      activity.actualStartIso,
    finishIso:
      activity.forecastFinishIso ??
      activity.currentFinishIso ??
      activity.actualFinishIso,
  };
}

function actualSnapshot(
  model: CanonicalScheduleModel,
): {
  percent: number | null;
  knownCount: number;
  eligibleCount: number;
} {
  const eligible = model.activities.filter(
    (activity) =>
      activity.originalDurationHours !== null &&
      activity.originalDurationHours > 0 &&
      activity.activityType !== "milestone" &&
      activity.activityType !== "start_milestone" &&
      activity.activityType !== "finish_milestone" &&
      activity.activityType !== "wbs_summary",
  );

  const known = eligible.filter(
    (activity) =>
      activity.percentComplete !== null &&
      activity.percentComplete >= 0 &&
      activity.percentComplete <= 100,
  );

  const totalEligibleWeight =
    eligible.reduce(
      (sum, activity) =>
        sum +
        activity.originalDurationHours!,
      0,
    );

  if (
    known.length === 0 ||
    totalEligibleWeight <= 0
  ) {
    return {
      percent: null,
      knownCount: known.length,
      eligibleCount: eligible.length,
    };
  }

  const knownWeightedProgress =
    known.reduce(
      (sum, activity) =>
        sum +
        activity.originalDurationHours! *
          activity.percentComplete!,
      0,
    );

  // Missing progress is not assumed zero. The numerator uses only
  // known progress but the denominator remains the full eligible
  // duration, so coverage is reported separately and the result is
  // never described as fully established unless coverage is 100%.
  return {
    percent: Number(
      (
        knownWeightedProgress /
        totalEligibleWeight
      ).toFixed(6),
    ),
    knownCount: known.length,
    eligibleCount: eligible.length,
  };
}

function timeline(
  baseline: readonly WeightedActivity[],
  current: readonly WeightedActivity[],
  snapshots: readonly ActualProgressSnapshot[],
  intervalDays: number,
): number[] {
  let start = Number.POSITIVE_INFINITY;
  let finish = Number.NEGATIVE_INFINITY;

  const include = (value: number | null): void => {
    if (value === null) return;
    if (value < start) start = value;
    if (value > finish) finish = value;
  };

  for (const activity of baseline) {
    include(activity.startMs);
    include(activity.finishMs);
  }

  for (const activity of current) {
    include(activity.startMs);
    include(activity.finishMs);
  }

  for (const snapshot of snapshots) {
    include(dateMs(snapshot.asOfIso));
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(finish)
  ) {
    return [];
  }

  const step = intervalDays * 86_400_000;
  const points: number[] = [];

  for (
    let point = start;
    point <= finish;
    point += step
  ) {
    points.push(point);
  }

  if (
    points.length === 0 ||
    points[points.length - 1] !== finish
  ) {
    points.push(finish);
  }

  for (const snapshot of snapshots) {
    const value =
      dateMs(
        snapshot.asOfIso,
      );
    if (value !== null) {
      points.push(value);
    }
  }

  return [
    ...new Set(points),
  ].sort(
    (a, b) => a - b,
  );
}

function actualAt(
  pointMs: number,
  snapshots: readonly ActualProgressSnapshot[],
): number | null {
  const eligible = snapshots
    .map((snapshot) => ({
      snapshot,
      ms: dateMs(snapshot.asOfIso),
    }))
    .filter(
      (
        item,
      ): item is {
        snapshot: ActualProgressSnapshot;
        ms: number;
      } =>
        item.ms !== null &&
        item.ms <= pointMs,
    )
    .sort((a, b) => a.ms - b.ms);

  return eligible.length === 0
    ? null
    : eligible[eligible.length - 1]!
        .snapshot.progressPercent;
}

export function buildProgressScurveProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    intervalDays?: number;
    actualHistory?: ActualProgressSnapshot[];
    baselineModel?: CanonicalScheduleModel | null;
  },
): ProgressScurveProjection {
  const intervalDays =
    input.intervalDays ?? 7;

  if (
    !Number.isSafeInteger(intervalDays) ||
    intervalDays <= 0
  ) {
    throw new Error(
      "Progress S-Curve intervalDays must be a positive integer",
    );
  }

  const weightedEligible =
    model.activities.filter(
      (activity) =>
        activity.originalDurationHours !== null &&
        activity.originalDurationHours > 0 &&
        activity.activityType !== "milestone" &&
        activity.activityType !== "start_milestone" &&
        activity.activityType !== "finish_milestone" &&
        activity.activityType !== "wbs_summary",
    );

  const baselineSource =
    input.baselineModel ??
    model;
  const baseline =
    eligibleWeightedActivities(
      baselineSource.activities,
      (activity) => ({
        startIso:
          input.baselineModel
            ? (
                activity.forecastStartIso ??
                activity.currentStartIso ??
                activity.baselineStartIso ??
                activity.actualStartIso
              )
            : activity.baselineStartIso,
        finishIso:
          input.baselineModel
            ? (
                activity.forecastFinishIso ??
                activity.currentFinishIso ??
                activity.baselineFinishIso ??
                activity.actualFinishIso
              )
            : activity.baselineFinishIso,
      }),
    );

  const current =
    eligibleWeightedActivities(
      model.activities,
      currentDates,
    );

  const currentSnapshot =
    actualSnapshot(model);

  const suppliedHistory =
    [...(input.actualHistory ?? [])]
      .filter(
        (snapshot) =>
          snapshot.progressPercent >= 0 &&
          snapshot.progressPercent <= 100 &&
          dateMs(snapshot.asOfIso) !== null,
      )
      .sort(
        (a, b) =>
          dateMs(a.asOfIso)! -
          dateMs(b.asOfIso)!,
      );

  const actualSnapshots =
    suppliedHistory.length > 0
      ? suppliedHistory
      : model.dataDateIso &&
          currentSnapshot.percent !== null
        ? [
            {
              asOfIso: model.dataDateIso,
              progressPercent:
                currentSnapshot.percent,
              sourceRevisionId:
                model.sourceRevisionId,
              sourceRefs: [
                "schedule:" +
                  model.sourceRevisionId +
                  ":current-progress-snapshot",
              ],
            },
          ]
        : [];

  const timelineMs = timeline(
    baseline,
    current,
    actualSnapshots,
    intervalDays,
  );

  const points: ProgressScurvePoint[] =
    timelineMs.map((pointMs) => ({
      dateIso: dateIso(pointMs),
      baselinePlannedPercent:
        cumulativePercent(
          baseline,
          pointMs,
        ),
      currentForecastPercent:
        cumulativePercent(
          current,
          pointMs,
        ),
      actualProgressPercent:
        actualAt(
          pointMs,
          actualSnapshots,
        ),
    }));

  const diagnostics: string[] = [
    input.baselineModel
      ? "SCURVE_BASELINE_USES_CONTROLLED_BASELINE_REVISION"
      : "SCURVE_BASELINE_AND_CURRENT_DERIVED_BY_DURATION_WEIGHTED_LINEAR_TIME_PHASING",
  ];

  if (suppliedHistory.length === 0) {
    diagnostics.push(
      "SCURVE_ACTUAL_HISTORY_NOT_RECONSTRUCTED_FROM_SINGLE_SNAPSHOT",
    );
  }

  return {
    schemaVersion: "1.0",
    projectionKey: "progress_scurve",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    weightingMethod:
      "original_duration_hours",
    timePhasingMethod:
      "linear_between_activity_dates",
    intervalDays,
    seriesContract: {
      seriesKey:
        "progress_percent",
      unit: "%",
      authority:
        "derived_schedule",
      basisRevisionId:
        model.sourceRevisionId,
      asOfIso:
        model.dataDateIso,
      sourceRefs: [
        "schedule:" +
          model.sourceRevisionId,
      ],
    },
    baselineCoveragePercent: coverage(
      baseline.length,
      weightedEligible.length,
    ),
    currentCoveragePercent: coverage(
      current.length,
      weightedEligible.length,
    ),
    actualSnapshotCoveragePercent:
      coverage(
        currentSnapshot.knownCount,
        currentSnapshot.eligibleCount,
      ),
    actualHistoryMode:
      suppliedHistory.length > 1
        ? "snapshot_history"
        : actualSnapshots.length === 1
          ? "current_snapshot_only"
          : "missing",
    points,
    actualSnapshots,
    diagnostics,
  };
}
