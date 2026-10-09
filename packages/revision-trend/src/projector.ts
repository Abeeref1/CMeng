import {classifyScheduleChanges} from "../../schedule-revision-core/src";
import {
  analyzeSchedule,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import {
  compareScheduleRevisions,
  orderScheduleRevisionsChronologically,
  type ScheduleRevision,
} from "../../schedule-revision-core/src";
import type {
  RevisionTrendPoint,
  RevisionTrendProjection,
} from "./types";

function completion(
  result: ReturnType<typeof analyzeSchedule>,
  basis: "programme" | "forecast",
): string | null {
  return (
    result.completionBases.find(
      (item) => item.basis === basis,
    )?.dateIso ?? null
  );
}

function elapsedCalendarDays(earlier:string|null|undefined,later:string|null|undefined):number|null{
  if(!earlier||!later)return null;
  const a=Date.parse(earlier.slice(0,10)+'T00:00:00Z'),b=Date.parse(later.slice(0,10)+'T00:00:00Z');
  return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):null;
}

export function buildRevisionTrendProjection(
  revisions: readonly ScheduleRevision[],
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
  },
): RevisionTrendProjection {
  const ordered =
    orderScheduleRevisionsChronologically(
      revisions,
    );

  const points: RevisionTrendPoint[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const revision = ordered[index]!;
    const analytics = analyzeSchedule(
      revision.model,
      input.config,
    );
    const previous =
      index > 0 ? ordered[index - 1]! : null;
    const comparison = previous
      ? compareScheduleRevisions(
          previous,
          revision,
        )
      : null;

    const latestForecast=completion(analytics,"forecast");
    const earlierPoint=points.at(-1)??null;
    points.push({
      criticalityBasis:'submitted_total_float',
      submittedFinishMovementCalendarDays:earlierPoint?elapsedCalendarDays(earlierPoint.forecastCompletionIso,latestForecast):null,
      reportingIntervalCalendarDays:earlierPoint?elapsedCalendarDays(earlierPoint.dataDateIso,revision.model.dataDateIso):null,
      sourceRevisionSequenceGap:previous?Math.max(0,revision.sequence-previous.sequence-1):null,
      changeCategories: comparison && previous ? classifyScheduleChanges(comparison.activityChanges,previous.model,revision.model) : null,
      executionActivityCount: analytics.population.executableActivityCount,
      sourceActivityCount: analytics.activityCount,
      scheduleProgressCoveragePercent: analytics.progress.durationWeightedPercentComplete.coveragePercent,
      revisionId: revision.revisionId,
      label: revision.label,
      sequence: revision.sequence,
      effectiveAt: revision.effectiveAt,
      dataDateIso:
        revision.model.dataDateIso,
      activityCount:
        analytics.activityCount,
      relationshipCount:
        analytics.relationshipCount,
      completedCount:
        analytics.status.completed,
      inProgressCount:
        analytics.status.inProgress,
      notStartedCount:
        analytics.status.notStarted,
      unknownStatusCount:
        analytics.status.unknown,
      durationWeightedProgressPercent:
        analytics.progress
          .durationWeightedPercentComplete
          .value,
      floatCoveragePercent:
        analytics.float.coveragePercent,
      criticalCount:
        analytics.float.criticalCount,
      nearCriticalCount:
        analytics.float.nearCriticalCount,
      floatRiskWatchlistCount:
        analytics.float.floatRiskWatchlistCount,
      zeroFloatCount:
        analytics.float.zeroFloatCount,
      negativeFloatCount:
        analytics.float.negativeFloatCount,
      forecastCompletionIso:
        latestForecast,
      programmeCompletionIso:
        completion(
          analytics,
          "programme",
        ),
      logicDensity:
        analytics.graph.logicDensity,
      graphComplete:
        analytics.graph.complete,
      addedVsPrevious:
        comparison
          ? comparison.addedActivityIds.length
          : null,
      removedVsPrevious:
        comparison
          ? comparison.removedActivityIds.length
          : null,
      modifiedVsPrevious:
        comparison
          ? comparison.modifiedActivityIds.length
          : null,
    });
  }

  return {
    schemaVersion: "1.0",
    projectionKey: "revision_trend",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    revisionCount: points.length,
    points,
  };
}
