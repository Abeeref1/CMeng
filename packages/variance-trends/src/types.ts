export interface VarianceTrendPoint {
  sourceActivityCount?: number;
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
  lateActivityCount: number;
  earlyActivityCount: number;
  onTimeActivityCount: number;
  negativeFloatCount: number;
  criticalCount: number;
  nearCriticalCount: number | null;
  floatRiskWatchlistCount: number | null;
  zeroFloatCount: number;
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
  }>;
  worseningFinishVarianceDays: number | null;
}

export interface VarianceTrendsProjection {
  schemaVersion: "1.0";
  projectionKey: "variance_trends";
  generatedAt: string;
  producerVersion: string;
  revisionCount: number;
  points: VarianceTrendPoint[];
  activityTrends: ActivityVarianceTrend[];
}
