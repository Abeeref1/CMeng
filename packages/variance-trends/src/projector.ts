import {naturalCompare} from '../../shared/src/natural-order';
import { parseScheduleTime } from "../../schedule-analysis-core/src";
import {
  analyzeSchedule,
  numericDistribution,
  type CanonicalScheduleActivity,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import {
  orderScheduleRevisionsChronologically,
  resolveRevisionActivityCorrespondence,
  type ScheduleRevision,
} from "../../schedule-revision-core/src";
import type {
  ActivityVarianceTrend,
  VarianceTrendPoint,
  VarianceTrendsProjection,
} from "./types";

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseScheduleTime(value);
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
    controlledBaselineRevision?: ScheduleRevision | null;
    config?: ScheduleAnalysisConfig;
  },
): VarianceTrendsProjection {
  const ordered =
    orderScheduleRevisionsChronologically(
      revisions,
    );

  const activitySeries = new Map<
    string,
    ActivityVarianceTrend
  >();

  const baselineRevision =
    input.controlledBaselineRevision ??
    null;
  const baselineByActivity =
    baselineRevision
      ? new Map(
          baselineRevision.model.activities.map(
            (activity) => [
              activity.activityId,
              activity,
            ],
          ),
        )
      : null;
  const baselineProjectFinish = baselineRevision ? baselineRevision.model.activities
    .map(activity => activity.baselineFinishIso ?? activity.currentFinishIso)
    .filter((value): value is string => value !== null && ms(value) !== null)
    .sort((a, b) => ms(a)! - ms(b)!).at(-1) ?? null : null;

  const points: VarianceTrendPoint[] =
    ordered.map((revision) => {
      const correspondence = baselineRevision ? resolveRevisionActivityCorrespondence(baselineRevision.model.activities, revision.model.activities) : null;
      const baselineIdentity = new Map(correspondence?.matches.map(match => [match.toActivityId, match.fromActivityId]) ?? []);
  const controlledVarianceDays = (
    activity: CanonicalScheduleActivity,
  ): number | null => {
    if (!baselineByActivity) {
      return null;
    }
    const baseline =
      baselineByActivity.get(baselineIdentity.get(activity.activityId) ?? "");
    if (!baseline) return null;
    return projectVariance(
      baseline.baselineFinishIso ?? baseline.currentFinishIso,
      finish(activity),
    );
  };


      const analytics = analyzeSchedule(
        baselineRevision ? revision.model : {...revision.model,activities:revision.model.activities.map(a=>({...a,baselineStartIso:null,baselineFinishIso:null}))},
        input.config,
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
            controlledVarianceDays(
              activity,
            ),
          totalFloatHours:
            activity.totalFloatHours,
        });
        activitySeries.set(
          activity.activityId,
          series,
        );
      }

      const controlledValues =
        revision.model.activities
          .map(
            controlledVarianceDays,
          )
          .filter(
            (
              value,
            ): value is number =>
              value !== null,
          );
      const comparable =
        controlledValues.length;
      const totalActivities =
        revision.model.activities.length;

      return {
        sourceActivityCount: totalActivities,
        executionActivityCount: analytics.population.executableActivityCount,
        variancePopulationBasis: "source_records" as const,
        unmatchedActivityCount: totalActivities - comparable,
        movementDistribution: numericDistribution(controlledValues),
        identityCoveragePercent: correspondence ? (totalActivities ? correspondence.matches.length / totalActivities * 100 : null) : null,
        ambiguousIdentityCount: correspondence?.ambiguousTo.size ?? 0,
        revisionId: revision.revisionId,
        sequence: revision.sequence,
        dataDateIso:
          revision.model.dataDateIso,
        comparableActivities:
          baselineByActivity
            ? comparable
            : analytics.finishVariance
                .comparableActivities,
        finishVarianceCoveragePercent:
          baselineByActivity
            ? totalActivities > 0
              ? Number(
                  (
                    (
                      comparable /
                      totalActivities
                    ) *
                    100
                  ).toFixed(4),
                )
              : null
            : analytics.finishVariance
                .coveragePercent,
        averageFinishVarianceDays:
          baselineByActivity
            ? comparable > 0
              ? Number(
                  (
                    controlledValues.reduce(
                      (sum, value) =>
                        sum + value,
                      0,
                    ) /
                    comparable
                  ).toFixed(6),
                )
              : null
            : analytics.finishVariance
                .averageFinishVarianceDays,
        maximumDelayDays:
          baselineByActivity
            ? comparable > 0
              ? Math.max(
                  ...controlledValues,
                )
              : null
            : analytics.finishVariance
                .maximumDelayDays,
        lateActivityCount:
          baselineByActivity
            ? controlledValues.filter(
                (value) =>
                  value > 0,
              ).length
            : null,
        earlyActivityCount:
          baselineByActivity
            ? controlledValues.filter(
                (value) =>
                  value < 0,
              ).length
            : null,
        onTimeActivityCount:
          baselineByActivity
            ? controlledValues.filter(
                (value) =>
                  value === 0,
              ).length
            : null,
        negativeFloatCount:
          analytics.float
            .negativeFloatCount,
        criticalCount:
          analytics.float.criticalCount,
        nearCriticalCount:
          analytics.float
            .nearCriticalCount,
        floatRiskWatchlistCount:
          analytics.float
            .floatRiskWatchlistCount,
        zeroFloatCount:
          analytics.float
            .zeroFloatCount,
        forecastCompletionIso: forecast,
        programmeCompletionIso: programme,
        projectCompletionVarianceDays:
          baselineProjectFinish !== null
            ? projectVariance(
                baselineProjectFinish,
                forecast,
              )
            : null,
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
      naturalCompare(a.activityId, b.activityId)
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
