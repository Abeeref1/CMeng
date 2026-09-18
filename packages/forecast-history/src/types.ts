import type {
  IndependentForecastOrigin,
} from "../../independent-forecast/src";

export interface ForecastHistorySnapshot {
  snapshotId: string;
  generatedAt: string;
  sourceRevisionId: string;
  dataDateIso: string | null;
  producerVersion: string;
  origin: IndependentForecastOrigin;
  independentForecastCompletionIso: string | null;
  sourceForecastCompletionIso: string | null;
  assumptions: string[];
}

export interface ForecastHistoryPoint
  extends ForecastHistorySnapshot {
  movementDaysVsPrevious: number | null;
  movementDaysVsFirst: number | null;
}

export interface ForecastHistoryProjection {
  schemaVersion: "1.0";
  projectionKey: "forecast_history";
  generatedAt: string;
  producerVersion: string;
  snapshotCount: number;
  establishedForecastCount: number;
  points: ForecastHistoryPoint[];
  diagnostics: string[];
}
