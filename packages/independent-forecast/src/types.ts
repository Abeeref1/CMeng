export interface ProbabilisticForecastComparator {
  status: "available" | "unavailable";
  method: "limited_triangular_duration_factor";
  authority: "non_official";
  iterations: number;
  seed: number;
  minFactor: number;
  modeFactor: number;
  maxFactor: number;
  p50CompletionIso: string | null;
  p80CompletionIso: string | null;
  p90CompletionIso: string | null;
  assumptions: string[];
}

import type {
  CpmActivityResult,
  CpmCalculationMode,
  CpmDurationBasis,
} from "../../schedule-cpm/src";

export type IndependentForecastOrigin =
  | "deterministic_source_calendar"
  | "scenario_with_assumptions"
  | "unresolved";

export interface IndependentForecastActivityRow {
  activityId: string;
  sourceFinishIso: string | null;
  independentEarlyFinishIso: string | null;
  finishVarianceDays: number | null;
  independentTotalFloatHours: number | null;
  critical: boolean | null;
  calendarMode: CpmActivityResult["calendarMode"];
  status: CpmActivityResult["status"];
  diagnostics: string[];
}

export interface IndependentForecastProjection {
  schemaVersion: "1.0";
  projectionKey: "independent_forecast";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;
  origin: IndependentForecastOrigin;
  durationBasis: CpmDurationBasis;
  calculationMode: CpmCalculationMode;
  sourceForecastCompletionIso: string | null;
  independentForecastCompletionIso: string | null;
  forecastVarianceDays: number | null;
  requiredFinishIso: string | null;
  requiredFinishVarianceDays: number | null;
  calculatedActivityCount: number;
  unresolvedActivityCount: number;
  activityCoveragePercent: number | null;
  criticalActivityIds: string[];
  assumptions: string[];
  diagnostics: string[];
  probabilistic: ProbabilisticForecastComparator;
  activities: IndependentForecastActivityRow[];
  complete: boolean;
}
