import type {
  ScheduleAnalyticsResult,
} from "../../schedule-analysis-core/src";

export interface ScheduleAnalyticsProjection {
  schemaVersion: "1.0";
  projectionKey: "schedule_analytics";
  generatedAt: string;
  producerVersion: string;
  result: ScheduleAnalyticsResult;
}
