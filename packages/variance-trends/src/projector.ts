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
    // Exact same revision, calendar and configuration already analyzed for Revision Trend.
    precomputedAnalyses?: ReadonlyMap<ScheduleRevision['model'],ReturnType<typeof analyzeSchedule>>;
  },
): VarianceTrendsProjection {
  const ordered =
    orderScheduleRevisionsChronologically(
      revisions,
    );
  // Revisions commonly repeat only a small number of original calendar dates
  // across thousands of activities. Parse each exact source string once for
  // this computation, without sharing stale values across project revisions.
  const sourceInstants=new Map<string,number|null>();
  const cachedMs=(value:string|null):number|null=>{
    if(!value)return null;
    if(sourceInstants.has(value))return sourceInstants.get(value)!;
    const parsed=parseScheduleTime(value);
    const result=Number.isFinite(parsed)?parsed:null;
    sourceInstants.set(value,result);
    return result;
  };
  const sourceVarianceDays=(programme:string|null,forecast:string|null):number|null=>{
    const first=cachedMs(programme),last=cachedMs(forecast);
    return first===null||last===null?null:Number(((last-first)/86_400_000).toFixed(6));
  };


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
  // The original stable ascending sort selected the final source row among
  // equal-time finish candidates. Preserve that tie behavior in one source
  // pass; repeated parsing inside a 9–100k activity comparison sort added CPU
  // cost without any additional date authority.
  let baselineProjectFinish:string|null=null;
  if(baselineRevision){
    let latestTime:number|null=null;
    for(const activity of baselineRevision.model.activities){
      const value=activity.baselineFinishIso??activity.currentFinishIso;
      if(value===null)continue;
      const parsed=cachedMs(value);
      if(parsed===null)continue;
      if(latestTime===null||parsed>=latestTime){
        latestTime=parsed;
        baselineProjectFinish=value;
      }
    }
  }

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
    return sourceVarianceDays(
      baseline.baselineFinishIso ?? baseline.currentFinishIso,
      finish(activity),
    );
  };


      // Reporting already clears unapproved baseline fields. In that case the
      // existing revision analysis is exactly the same calculation; avoid cloning
      // and re-analysing every activity. Supplied baseline fields without a
      // controlled baseline still require the original stripped calculation.
      const stripBaseline=!baselineRevision&&revision.model.activities.some(a=>a.baselineStartIso!=null||a.baselineFinishIso!=null);
      const analytics = (!stripBaseline?input.precomputedAnalyses?.get(revision.model):undefined) ?? analyzeSchedule(
        stripBaseline ? {...revision.model,activities:revision.model.activities.map(a=>({...a,baselineStartIso:null,baselineFinishIso:null}))} : revision.model,
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

      // One independent source/date comparison per row. Both the full
      // activity history and every aggregate consume this same measured value.
      // Missing dates remain null and never enter a numerical denominator.
      const controlledValues: number[] = [];
      for (const activity of revision.model.activities) {
        const measuredVariance = controlledVarianceDays(activity);
        if (measuredVariance !== null) controlledValues.push(measuredVariance);
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
          finishVarianceDays: measuredVariance,
          totalFloatHours:
            activity.totalFloatHours,
        });
        activitySeries.set(
          activity.activityId,
          series,
        );
      }

      // Every controlled variance contributes once to the full source
      // population. This single pass preserves the previously separate
      // filter/reduce/maximum results and never counts unknown dates as zero.
      let sumControlled=0,maximumControlled=-Infinity;
      let lateControlled=0,earlyControlled=0,onTimeControlled=0;
      for(const value of controlledValues){
        sumControlled+=value;
        if(value>maximumControlled)maximumControlled=value;
        if(value>0)lateControlled++;
        else if(value<0)earlyControlled++;
        else onTimeControlled++;
      }
      const comparable =
        controlledValues.length;
      const totalActivities =
        revision.model.activities.length;

      return {
        sourceActivityCount: totalActivities,
        executionActivityCount: analytics.population.executableActivityCount,
      unfinishedExecutionActivityCount: analytics.float.totalActivities,
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
                    sumControlled /
                    comparable
                  ).toFixed(6),
                )
              : null
            : analytics.finishVariance
                .averageFinishVarianceDays,
        maximumDelayDays:
          baselineByActivity
            ? comparable > 0
              ? maximumControlled
              : null
            : analytics.finishVariance
                .maximumDelayDays,
        lateActivityCount:
          baselineByActivity
            ? lateControlled
            : null,
        earlyActivityCount:
          baselineByActivity
            ? earlyControlled
            : null,
        onTimeActivityCount:
          baselineByActivity
            ? onTimeControlled
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
            ? sourceVarianceDays(
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
    revisionLabels: Object.fromEntries(ordered.map(revision => [revision.revisionId, revision.label || `Revision ${revision.sequence}`])),
    points,
    activityTrends,
  };
}
