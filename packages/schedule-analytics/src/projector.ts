import {
  analyzeSchedule,
  type CanonicalScheduleModel,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  ScheduleAnalyticsProjection,
} from "./types";

export function buildScheduleAnalyticsProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
  },
): ScheduleAnalyticsProjection {
  return {
    schemaVersion: "1.0",
    projectionKey: "schedule_analytics",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    result: analyzeSchedule(
      model,
      input.config,
    ),
  };
}

export function serializeScheduleAnalyticsProjection(
  projection: ScheduleAnalyticsProjection,
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(projection),
  );
}
