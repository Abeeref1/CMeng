import type {FloatPopulationShares,FloatTrendSummary} from "../../revision-trend/src/float-share";

export interface VarianceTrendPoint extends Partial<FloatPopulationShares> {
  sourceActivityCount?: number;
  unfinishedExecutionActivityCount?: number;
  executionActivityCount?: number;
  variancePopulationBasis?: "source_records";
  unmatchedActivityCount?: number;
  movementDistribution?: ReturnType<typeof import("../../schedule-analysis-core/src").numericDistribution>;
  identityCoveragePercent?: number | null;
  ambiguousIdentityCount?: number;
  revisionId: string;
  sequence: number;
  dataDateIso: string | null;
  comparableActivities: number;
  finishVarianceCoveragePercent: number | null;
  averageFinishVarianceDays: number | null;
  maximumDelayDays: number | null;
  lateActivityCount: number | null;
  earlyActivityCount: number | null;
  onTimeActivityCount: number | null;
  negativeFloatCount: number | null;
  criticalCount: number | null;
  nearCriticalCount: number | null;
  floatRiskWatchlistCount: number | null;
  zeroFloatCount: number | null;
  forecastCompletionIso: string | null;
  programmeCompletionIso: string | null;
  projectCompletionVarianceDays: number | null;
}

export interface ActivityVarianceTrend {
  activityId: string;
  points: Array<{
    revisionId: string;
    sequence: number;
    finishVarianceDays: number | null;
    totalFloatHours: number | null;
    totalFloatWorkingDays?: number | null;
    floatDaysBasis?: string;
  }>;
  worseningFinishVarianceDays: number | null;
}

export interface VarianceTrendsProjection {
  schemaVersion: "1.0";
  projectionKey: "variance_trends";
  generatedAt: string;
  producerVersion: string;
  revisionCount: number;
  revisionLabels: Record<string, string>;
  /** SW-25: first-to-latest float movement judged on the share of unfinished execution activities. */
  floatTrend?: FloatTrendSummary;
  points: VarianceTrendPoint[];
  activityTrends: ActivityVarianceTrend[];
}
