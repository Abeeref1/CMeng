export interface ProgressReportProjectionRef {
  projectionKey:
    | "schedule_analytics"
    | "milestones"
    | "lookahead_schedule"
    | "progress_scurve"
    | "independent_forecast";
  producerVersion: string;
}

export interface ProgressReportProjection {
  schemaVersion: "1.0";
  projectionKey: "progress_report";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;
  sourceProjections: ProgressReportProjectionRef[];

  schedule: {
    activityCount: number;
    relationshipCount: number;
    graphComplete: boolean;
    openStartCount: number;
    openFinishCount: number;
    criticalCount: number;
    nearCriticalCount: number;
    negativeFloatCount: number;
    floatCoveragePercent: number | null;
  };

  progress: {
    completedCount: number;
    inProgressCount: number;
    notStartedCount: number;
    unknownStatusCount: number;
    durationWeightedProgressPercent: number | null;
    durationWeightedProgressCoveragePercent: number | null;
    scurveActualSnapshotPercent: number | null;
    scurveActualSnapshotCoveragePercent: number | null;
  };

  forecast: {
    sourceForecastCompletionIso: string | null;
    independentForecastCompletionIso: string | null;
    forecastVarianceDays: number | null;
    independentForecastOrigin: string;
    independentForecastComplete: boolean;
  };

  milestones: {
    milestoneCount: number;
    completedCount: number;
    openCount: number;
    lateOpenCount: number;
  };

  lookAhead: {
    windowDays: number;
    incompleteActivityCount: number;
    datedIncompleteActivityCount: number;
    currentDateCoveragePercent: number | null;
    overdueCount: number;
  };

  diagnostics: string[];
}
