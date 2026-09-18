export type ScurveWeightingMethod =
  | "original_duration_hours";

export type ScurveTimePhasingMethod =
  | "linear_between_activity_dates";

export interface ProgressScurvePoint {
  dateIso: string;
  baselinePlannedPercent: number | null;
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
  baselineCoveragePercent: number | null;
  currentCoveragePercent: number | null;
  actualSnapshotCoveragePercent: number | null;
  actualHistoryMode:
    | "snapshot_history"
    | "current_snapshot_only"
    | "missing";
  points: ProgressScurvePoint[];
  actualSnapshots: ActualProgressSnapshot[];
  diagnostics: string[];
}
