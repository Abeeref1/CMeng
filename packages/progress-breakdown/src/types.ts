export interface ProgressBreakdownRow {
  wbsId: string;
  wbsName: string | null;
  activityCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  unknownStatusCount: number;
  percentCompleteAverage: number | null;
  percentCompleteCoveragePercent: number | null;
  durationWeightedProgressPercent: number | null;
  durationWeightedCoveragePercent: number | null;
  originalDurationHoursKnown: number;
  remainingDurationHoursKnown: number;
  criticalCount: number;
  nearCriticalCount: number;
  negativeFloatCount: number;
  floatCoveragePercent: number | null;
}

export interface ProgressBreakdownProjection {
  schemaVersion: "1.0";
  projectionKey: "progress_breakdown";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  totalActivityCount: number;
  rows: ProgressBreakdownRow[];
}
