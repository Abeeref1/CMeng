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

export type ImplementedScheduleProjectionKey =
  | "schedule_analytics"
  | "activity_analytics"
  | "milestones"
  | "near_critical";

export const IMPLEMENTED_SCHEDULE_PROJECTIONS:
  readonly ImplementedScheduleProjectionKey[] = [
    "schedule_analytics",
    "activity_analytics",
    "milestones",
    "near_critical",
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
  }
}
