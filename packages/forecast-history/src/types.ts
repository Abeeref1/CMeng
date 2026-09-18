import type {
  IndependentForecastOrigin,
} from "../../independent-forecast/src";

export type ForecastHistoryRevisionRole =
  | "regular_update"
  | "baseline"
  | "recovery"
  | "rebaseline"
  | "scenario"
  | "unknown";

export interface ForecastHistorySnapshot {
  snapshotId: string;
  generatedAt: string;
  sourceRevisionId: string;
  dataDateIso: string | null;
  producerVersion: string;
  origin: IndependentForecastOrigin;
  role?: ForecastHistoryRevisionRole;
  independentForecastCompletionIso: string | null;
  sourceForecastCompletionIso: string | null;
  assumptions: string[];
}

export interface ForecastHistoryPoint
  extends ForecastHistorySnapshot {
  role: "regular_update";
  dataDateIso: string;
  movementDaysVsPrevious: number | null;
  movementDaysVsFirst: number | null;
}

export interface ForecastHistoryProjection {
  schemaVersion: "1.0";
  projectionKey: "forecast_history";
  generatedAt: string;
  producerVersion: string;
  snapshotCount: number;
  inputSnapshotCount: number;
  establishedForecastCount: number;
  excludedSnapshotCount: number;
  excludedSnapshotIds: string[];
  duplicateDataDateSnapshotIds: string[];
  points: ForecastHistoryPoint[];
  diagnostics: string[];
}
