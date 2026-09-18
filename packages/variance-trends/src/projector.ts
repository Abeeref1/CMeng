import {
  analyzeSchedule,
  type CanonicalScheduleActivity,
} from "../../schedule-analysis-core/src";
import type {
  ScheduleRevision,
} from "../../schedule-revision-core/src";
import type {
  ActivityVarianceTrend,
  VarianceTrendPoint,
  VarianceTrendsProjection,
} from "./types";

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function finish(
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
    activity.currentFinishIso
  );
}

function varianceDays(
  activity: CanonicalScheduleActivity,
): number | null {
  const baseline = ms(
    activity.baselineFinishIso,
  );
  const current = ms(finish(activity));
  if (
    baseline === null ||
    current === null
  ) {
    return null;
  }
  return Number(
    (
      (current - baseline) /
      86_400_000
    ).toFixed(6),
  );
}

function projectVariance(
  programme: string | null,
  forecast: string | null,
): number | null {
  const p = ms(programme);
  const f = ms(forecast);
  if (p === null || f === null) {
    return null;
  }
  return Number(
    ((f - p) / 86_400_000).toFixed(6),
  );
}

export function buildVarianceTrendsProjection(
  revisions: readonly ScheduleRevision[],
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): VarianceTrendsProjection {
  const ordered = [...revisions].sort(
    (a, b) =>
      a.sequence - b.sequence ||
      a.revisionId.localeCompare(b.revisionId),
  );

  const activitySeries = new Map<
    string,
    ActivityVarianceTrend
  >();

  const points: VarianceTrendPoint[] =
    ordered.map((revision) => {
      const analytics = analyzeSchedule(
        revision.model,
      );
      const programme =
        analytics.completionBases.find(
          (item) =>
            item.basis === "programme",
        )?.dateIso ?? null;
      const forecast =
        analytics.completionBases.find(
          (item) =>
            item.basis === "forecast",
        )?.dateIso ?? null;

      for (const activity of revision.model.activities) {
        const series =
          activitySeries.get(
            activity.activityId,
          ) ?? {
            activityId: activity.activityId,
            points: [],
            worseningFinishVarianceDays: null,
          };

        series.points.push({
          revisionId: revision.revisionId,
          sequence: revision.sequence,
          finishVarianceDays:
            varianceDays(activity),
          totalFloatHours:
            activity.totalFloatHours,
        });
        activitySeries.set(
          activity.activityId,
          series,
        );
      }

      return {
        revisionId: revision.revisionId,
        sequence: revision.sequence,
        dataDateIso:
          revision.model.dataDateIso,
        comparableActivities:
          analytics.finishVariance
            .comparableActivities,
        finishVarianceCoveragePercent:
          analytics.finishVariance
            .coveragePercent,
        averageFinishVarianceDays:
          analytics.finishVariance
            .averageFinishVarianceDays,
        maximumDelayDays:
          analytics.finishVariance
            .maximumDelayDays,
        lateActivityCount:
          analytics.finishVariance
            .lateActivities,
        earlyActivityCount:
          analytics.finishVariance
            .earlyActivities,
        onTimeActivityCount:
          analytics.finishVariance
            .onTimeActivities,
        negativeFloatCount:
          analytics.float
            .negativeFloatCount,
        criticalCount:
          analytics.float.criticalCount,
        nearCriticalCount:
          analytics.float
            .nearCriticalCount,
        forecastCompletionIso: forecast,
        programmeCompletionIso: programme,
        projectCompletionVarianceDays:
          projectVariance(
            programme,
            forecast,
          ),
      };
    });

  const activityTrends = [
    ...activitySeries.values(),
  ].map((series) => {
    const known = series.points
      .map((point) =>
        point.finishVarianceDays,
      )
      .filter(
        (value): value is number =>
          value !== null,
      );

    return {
      ...series,
      worseningFinishVarianceDays:
        known.length >= 2
          ? Number(
              (
                known[known.length - 1]! -
                known[0]!
              ).toFixed(6),
            )
          : null,
    };
  });

  activityTrends.sort((a, b) => {
    const aValue =
      a.worseningFinishVarianceDays ??
      Number.NEGATIVE_INFINITY;
    const bValue =
      b.worseningFinishVarianceDays ??
      Number.NEGATIVE_INFINITY;
    return (
      bValue - aValue ||
      a.activityId.localeCompare(
        b.activityId,
        undefined,
        { numeric: true },
      )
    );
  });

  return {
    schemaVersion: "1.0",
    projectionKey: "variance_trends",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    revisionCount: points.length,
    points,
    activityTrends,
  };
}
