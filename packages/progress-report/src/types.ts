export type ProgressBasisAuthority =
  | "deterministic_schedule"
  | "progress_snapshot"
  | "source_evidence"
  | "missing";

export interface ProgressBasisValue {
  valuePercent: number | null;
  state: "established" | "missing";
  authority: ProgressBasisAuthority;
  sourceRefs: string[];
  asOfIso: string | null;
  coveragePercent: number | null;
  varianceToBaselinePercentagePoints: number | null;
}

export interface ExternalProgressEvidence {
  valuePercent: number;
  sourceRefs: string[];
  asOfIso?: string | null;
  coveragePercent?: number | null;
}

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
  /** True when only schedule-derived progress is available; never treat it as certified physical progress. */
  scheduleSnapshotOnly: boolean;
  externalProgressEvidenceState:
    | "established"
    | "missing";

  activityPopulation: {
    sourceActivityCount: number;
    executableActivityCount: number;
    excludedActivityCount: number;
    excludedByType: {
      wbsSummaryCount: number;
      levelOfEffortCount: number;
      otherExcludedCount: number;
    };
    basis: "execution_control_population";
  };

  schedule: {
    activityCount: number;
    relationshipCount: number;
    graphComplete: boolean;
    openStartCount: number;
    openFinishCount: number;
    criticalCount: number;
    nearCriticalCount: number | null;
    negativeFloatCount: number;
    floatCoveragePercent: number | null;
  };

  progressBases: {
    scheduleSnapshot?: ProgressBasisValue;
    baselinePlanned: ProgressBasisValue;
    currentSchedule: ProgressBasisValue;
    physical: ProgressBasisValue;
    contractorReported: ProgressBasisValue;
    certified: ProgressBasisValue;
  };
  scopeComparison?: import('../../progress-scurve/src').ProgressScurveProjection['scopeComparison'];

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
    basisRevisionId: string;
    activityCoveragePercent: number | null;
    authority:
      | "deterministic"
      | "scenario"
      | "unresolved";
  };

  milestones: {
    milestoneCount: number;
    completedCount: number;
    openCount: number;
    lateOpenCount: number | null;
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
