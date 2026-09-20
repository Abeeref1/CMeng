export interface VarianceTrendPoint {
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
  nearCriticalCount: number;
  floatRiskWatchlistCount: number;
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
