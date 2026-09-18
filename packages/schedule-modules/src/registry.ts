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
  type ReadinessDimensionKey,
  type ReadinessEvidence,
} from "../../lookahead-schedule/src";
import {
  buildProgressBreakdownProjection,
} from "../../progress-breakdown/src";
import {
  buildProgressScurveProjection,
} from "../../progress-scurve/src";
import {
  buildScheduleChangeReportFromHistory,
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
import {
  buildIndependentForecastProjection,
} from "../../independent-forecast/src";
import {
  buildForecastHistoryProjection,
  type ForecastHistorySnapshot,
} from "../../forecast-history/src";
import type {
  CpmConfig,
} from "../../schedule-cpm/src";
import {
  buildProgressReportProjection,
} from "../../progress-report/src";
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
  ExternalProgressEvidence,
} from "../../progress-report/src";
import {
  buildResourceUtilizationProjection,
} from "../../resource-utilization/src";
import {
  buildManhourScurveProjection,
} from "../../manhour-scurve/src";
import type {
  CanonicalResourceModel,
} from "../../schedule-resource-core/src";
import {
  buildQuantityScurveProjection,
} from "../../quantity-scurve/src";
import type {
  CanonicalQuantityProgressModel,
} from "../../quantity-progress-core/src";

export type ImplementedScheduleProjectionKey =
  | "schedule_analytics"
  | "activity_analytics"
  | "milestones"
  | "near_critical"
  | "lookahead_schedule"
  | "progress_breakdown"
  | "progress_scurve"
  | "independent_forecast";

export const IMPLEMENTED_SCHEDULE_PROJECTIONS:
  readonly ImplementedScheduleProjectionKey[] = [
    "schedule_analytics",
    "activity_analytics",
    "milestones",
    "near_critical",
    "lookahead_schedule",
    "progress_breakdown",
    "progress_scurve",
    "independent_forecast",
  ] as const;

export function buildImplementedScheduleProjection(
  key: ImplementedScheduleProjectionKey,
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
    cpmConfig?: Partial<CpmConfig>;
    readinessEvidence?: Record<
      string,
      Partial<Record<ReadinessDimensionKey, ReadinessEvidence>>
    >;
    probabilisticConfig?: {
      iterations?: number;
      seed?: number;
      minFactor?: number;
      modeFactor?: number;
      maxFactor?: number;
    };
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
        {
          generatedAt: input.generatedAt,
          producerVersion: input.producerVersion,
          ...(input.readinessEvidence
            ? { readinessEvidence: input.readinessEvidence }
            : {}),
        },
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
    case "independent_forecast":
      return buildIndependentForecastProjection(
        model,
        {
          generatedAt: input.generatedAt,
          producerVersion:
            input.producerVersion,
          ...(input.cpmConfig
            ? {
                cpmConfig:
                  input.cpmConfig,
              }
            : {}),
          ...(input.probabilisticConfig
            ? {
                probabilisticConfig:
                  input.probabilisticConfig,
              }
            : {}),
        },
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
    case "schedule_change_report":
      return buildScheduleChangeReportFromHistory(
        revisions,
        input,
      );
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


export function buildImplementedForecastHistoryProjection(
  snapshots: readonly ForecastHistorySnapshot[],
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): unknown {
  return buildForecastHistoryProjection(
    snapshots,
    input,
  );
}


export function buildImplementedProgressReportProjection(
  input: {
    generatedAt: string;
    producerVersion: string;
    scheduleAnalytics: ScheduleAnalyticsProjection;
    milestones: MilestonesProjection;
    lookAhead: LookAheadProjection;
    progressScurve: ProgressScurveProjection;
    independentForecast: IndependentForecastProjection;
    progressEvidence?: {
      physical?: ExternalProgressEvidence;
      contractorReported?: ExternalProgressEvidence;
      certified?: ExternalProgressEvidence;
    };
  },
): unknown {
  return buildProgressReportProjection(input);
}


export type ImplementedScheduleResourceProjectionKey =
  | "resource_utilization"
  | "manhour_scurve";

export const IMPLEMENTED_SCHEDULE_RESOURCE_PROJECTIONS:
  readonly ImplementedScheduleResourceProjectionKey[] = [
    "resource_utilization",
    "manhour_scurve",
  ] as const;

export function buildImplementedScheduleResourceProjection(
  key: ImplementedScheduleResourceProjectionKey,
  resources: CanonicalResourceModel,
  schedule: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    intervalDays?: number;
  },
): unknown {
  switch (key) {
    case "resource_utilization":
      return buildResourceUtilizationProjection(
        resources,
        schedule,
        {
          generatedAt: input.generatedAt,
          producerVersion:
            input.producerVersion,
        },
      );
    case "manhour_scurve":
      return buildManhourScurveProjection(
        resources,
        schedule,
        {
          generatedAt: input.generatedAt,
          producerVersion:
            input.producerVersion,
          ...(input.intervalDays !== undefined
            ? {
                intervalDays:
                  input.intervalDays,
              }
            : {}),
        },
      );
  }
}


export function buildImplementedQuantityScurveProjection(
  quantities: CanonicalQuantityProgressModel,
  schedule: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    intervalDays?: number;
  },
): unknown {
  return buildQuantityScurveProjection(
    quantities,
    schedule,
    {
      generatedAt: input.generatedAt,
      producerVersion:
        input.producerVersion,
      ...(input.intervalDays !== undefined
        ? {
            intervalDays:
              input.intervalDays,
          }
        : {}),
    },
  );
}
