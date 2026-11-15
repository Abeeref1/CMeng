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
    /** The same analysis of this exact model and config, already calculated or saved. */
    precomputedResult?: ReturnType<typeof analyzeSchedule>;
  },
): ScheduleAnalyticsProjection {
  return {
    schemaVersion: "1.0",
    projectionKey: "schedule_analytics",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    result: input.precomputedResult ?? analyzeSchedule(
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
