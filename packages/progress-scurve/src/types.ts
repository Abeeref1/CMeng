export type ScurveWeightingMethod =
  | "original_duration_hours";

export type ScurveTimePhasingMethod =
  | "linear_between_activity_dates" | "working_calendar_between_activity_dates";

export interface ProgressScurvePoint {
  dateIso: string;
  baselinePlannedPercent: number | null;
  /** Schedule-date phasing of the current programme. This is not achieved progress. */
  currentSchedulePhasingPercent: number | null;
  /** @deprecated Compatibility alias for currentSchedulePhasingPercent. */
  currentForecastPercent: number | null;
  actualProgressPercent: number | null;
}

export interface ActualProgressSnapshot {
  asOfIso: string;
  progressPercent: number;
  sourceRevisionId: string;
  sourceRefs: string[];
}

export interface ProgressScurveProjection {
  schemaVersion: "1.0";
  projectionKey: "progress_scurve";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;
  weightingMethod: ScurveWeightingMethod;
  timePhasingMethod: ScurveTimePhasingMethod;
  intervalDays: number;
  populationContracts?: Record<string, import("../../schedule-analysis-core/src").ActivityPopulationContract>;
  observationCount?: number;
  scopeComparison?: ReturnType<typeof import('./projector').compareProgressScopes> | null;
  seriesContract: {
    seriesKey:
      "progress_percent";
    unit: "%";
    authority:
      "derived_schedule";
    basisRevisionId: string;
    asOfIso: string | null;
    sourceRefs: string[];
  };
  baselineCoveragePercent: number | null;
  currentCoveragePercent: number | null;
  actualSnapshotCoveragePercent: number | null;
  actualHistoryMode:
    | "snapshot_history"
    | "current_snapshot_only"
    | "missing";
  currentSeriesMeaning: "current_schedule_date_phasing_not_achieved_progress";
  points: ProgressScurvePoint[];
  actualSnapshots: ActualProgressSnapshot[];
  diagnostics: string[];
}
