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

    points.push({
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
        completion(analytics, "forecast"),
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
