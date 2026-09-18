import type {
  ScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import type {
  MilestonesProjection,
} from "../../milestones-analysis/src";
import type {
  LookAheadProjection,
} from "../../lookahead-schedule/src";
import type {
  ProgressScurveProjection,
} from "../../progress-scurve/src";
import type {
  IndependentForecastProjection,
} from "../../independent-forecast/src";
import type {
  ProgressReportProjection,
} from "./types";

function latestActualSnapshot(
  scurve: ProgressScurveProjection,
): number | null {
  if (scurve.actualSnapshots.length === 0) {
    return null;
  }

  const ordered = [
    ...scurve.actualSnapshots,
  ].sort(
    (a, b) =>
      Date.parse(a.asOfIso) -
      Date.parse(b.asOfIso),
  );

  return ordered[ordered.length - 1]!
    .progressPercent;
}

export function buildProgressReportProjection(
  input: {
    generatedAt: string;
    producerVersion: string;
    scheduleAnalytics: ScheduleAnalyticsProjection;
    milestones: MilestonesProjection;
    lookAhead: LookAheadProjection;
    progressScurve: ProgressScurveProjection;
    independentForecast: IndependentForecastProjection;
  },
): ProgressReportProjection {
  const schedule =
    input.scheduleAnalytics.result;

  const projectIds = new Set(
    [
      schedule.projectId,
      input.milestones.projectId,
      input.lookAhead.projectId,
      input.progressScurve.projectId,
      input.independentForecast.projectId,
    ].filter(
      (value): value is string =>
        value !== null,
    ),
  );

  if (projectIds.size > 1) {
    throw new Error(
      "Progress Report inputs belong to different projects",
    );
  }

  const revisions = new Set([
    schedule.sourceRevisionId,
    input.milestones.sourceRevisionId,
    input.lookAhead.sourceRevisionId,
    input.progressScurve.sourceRevisionId,
    input.independentForecast.sourceRevisionId,
  ]);

  if (revisions.size !== 1) {
    throw new Error(
      "Progress Report inputs belong to different schedule revisions",
    );
  }

  return {
    schemaVersion: "1.0",
    projectionKey: "progress_report",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId:
      schedule.projectId,
    sourceRevisionId:
      schedule.sourceRevisionId,
    dataDateIso:
      schedule.dataDateIso,
    sourceProjections: [
      {
        projectionKey:
          "schedule_analytics",
        producerVersion:
          input.scheduleAnalytics
            .producerVersion,
      },
      {
        projectionKey: "milestones",
        producerVersion:
          input.milestones.producerVersion,
      },
      {
        projectionKey:
          "lookahead_schedule",
        producerVersion:
          input.lookAhead.producerVersion,
      },
      {
        projectionKey:
          "progress_scurve",
        producerVersion:
          input.progressScurve
            .producerVersion,
      },
      {
        projectionKey:
          "independent_forecast",
        producerVersion:
          input.independentForecast
            .producerVersion,
      },
    ],
    schedule: {
      activityCount:
        schedule.activityCount,
      relationshipCount:
        schedule.relationshipCount,
      graphComplete:
        schedule.graph.complete,
      openStartCount:
        schedule.graph
          .openStartActivityIds.length,
      openFinishCount:
        schedule.graph
          .openFinishActivityIds.length,
      criticalCount:
        schedule.float.criticalCount,
      nearCriticalCount:
        schedule.float
          .nearCriticalCount,
      negativeFloatCount:
        schedule.float
          .negativeFloatCount,
      floatCoveragePercent:
        schedule.float
          .coveragePercent,
    },
    progress: {
      completedCount:
        schedule.status.completed,
      inProgressCount:
        schedule.status.inProgress,
      notStartedCount:
        schedule.status.notStarted,
      unknownStatusCount:
        schedule.status.unknown,
      durationWeightedProgressPercent:
        schedule.progress
          .durationWeightedPercentComplete
          .value,
      durationWeightedProgressCoveragePercent:
        schedule.progress
          .durationWeightedPercentComplete
          .coveragePercent,
      scurveActualSnapshotPercent:
        latestActualSnapshot(
          input.progressScurve,
        ),
      scurveActualSnapshotCoveragePercent:
        input.progressScurve
          .actualSnapshotCoveragePercent,
    },
    forecast: {
      sourceForecastCompletionIso:
        input.independentForecast
          .sourceForecastCompletionIso,
      independentForecastCompletionIso:
        input.independentForecast
          .independentForecastCompletionIso,
      forecastVarianceDays:
        input.independentForecast
          .forecastVarianceDays,
      independentForecastOrigin:
        input.independentForecast.origin,
      independentForecastComplete:
        input.independentForecast.complete,
    },
    milestones: {
      milestoneCount:
        input.milestones.milestoneCount,
      completedCount:
        input.milestones.completedCount,
      openCount:
        input.milestones.openCount,
      lateOpenCount:
        input.milestones.lateOpenCount,
    },
    lookAhead: {
      windowDays:
        input.lookAhead.windowDays,
      incompleteActivityCount:
        input.lookAhead
          .incompleteActivityCount,
      datedIncompleteActivityCount:
        input.lookAhead
          .datedIncompleteActivityCount,
      currentDateCoveragePercent:
        input.lookAhead
          .currentDateCoveragePercent,
      overdueCount:
        input.lookAhead.overdueCount,
    },
    diagnostics: [
      ...schedule.diagnostics,
      ...input.independentForecast
        .diagnostics,
      ...input.progressScurve
        .diagnostics,
    ],
  };
}
