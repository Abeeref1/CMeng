import type {
  CanonicalScheduleModel,
  ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import {
  buildScheduleAnalyticsProjection,
} from "../../schedule-analytics/src";
import {
  buildActivityAnalyticsProjection,
} from "../../activity-analytics/src";
import {
  buildMilestonesProjection,
} from "../../milestones-analysis/src";
import {
  buildNearCriticalProjection,
} from "../../near-critical-analysis/src";
import {
  buildLookAheadProjection,
} from "../../lookahead-schedule/src";
import {
  buildProgressBreakdownProjection,
} from "../../progress-breakdown/src";
import {
  buildProgressScurveProjection,
} from "../../progress-scurve/src";
import {
  buildScheduleChangeReportProjection,
} from "../../schedule-change-report/src";
import {
  buildRevisionTrendProjection,
} from "../../revision-trend/src";
import {
  buildVarianceTrendsProjection,
} from "../../variance-trends/src";
import type {
  ScheduleRevision,
} from "../../schedule-revision-core/src";

export type ImplementedScheduleProjectionKey =
  | "schedule_analytics"
  | "activity_analytics"
  | "milestones"
  | "near_critical"
  | "lookahead_schedule"
  | "progress_breakdown"
  | "progress_scurve";

export const IMPLEMENTED_SCHEDULE_PROJECTIONS:
  readonly ImplementedScheduleProjectionKey[] = [
    "schedule_analytics",
    "activity_analytics",
    "milestones",
    "near_critical",
    "lookahead_schedule",
    "progress_breakdown",
    "progress_scurve",
  ] as const;

export function buildImplementedScheduleProjection(
  key: ImplementedScheduleProjectionKey,
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
  },
): unknown {
  switch (key) {
    case "schedule_analytics":
      return buildScheduleAnalyticsProjection(
        model,
        input,
      );
    case "activity_analytics":
      return buildActivityAnalyticsProjection(
        model,
        input,
      );
    case "milestones":
      return buildMilestonesProjection(
        model,
        input,
      );
    case "near_critical":
      return buildNearCriticalProjection(
        model,
        input,
      );
    case "lookahead_schedule":
      return buildLookAheadProjection(
        model,
        input,
      );
    case "progress_breakdown":
      return buildProgressBreakdownProjection(
        model,
        input,
      );
    case "progress_scurve":
      return buildProgressScurveProjection(
        model,
        input,
      );
  }
}


export type ImplementedScheduleRevisionProjectionKey =
  | "schedule_change_report"
  | "revision_trend"
  | "variance_trends";

export const IMPLEMENTED_SCHEDULE_REVISION_PROJECTIONS:
  readonly ImplementedScheduleRevisionProjectionKey[] = [
    "schedule_change_report",
    "revision_trend",
    "variance_trends",
  ] as const;

export function buildImplementedScheduleRevisionProjection(
  key: ImplementedScheduleRevisionProjectionKey,
  revisions: readonly ScheduleRevision[],
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): unknown {
  if (revisions.length === 0) {
    throw new Error(
      "At least one schedule revision is required",
    );
  }

  switch (key) {
    case "schedule_change_report": {
      if (revisions.length < 2) {
        throw new Error(
          "Schedule Change Report requires at least two revisions",
        );
      }
      const ordered = [...revisions].sort(
        (a, b) =>
          a.sequence - b.sequence ||
          a.revisionId.localeCompare(b.revisionId),
      );
      return buildScheduleChangeReportProjection(
        ordered[ordered.length - 2]!,
        ordered[ordered.length - 1]!,
        input,
      );
    }
    case "revision_trend":
      return buildRevisionTrendProjection(
        revisions,
        input,
      );
    case "variance_trends":
      return buildVarianceTrendsProjection(
        revisions,
        input,
      );
  }
}
