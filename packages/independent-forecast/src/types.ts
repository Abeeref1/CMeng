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
  independentEarlyStartIso?: string | null;
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
  drivingNetwork?: import('../../schedule-cpm/src').CpmResult['drivingNetwork'];
  activityPopulation?: import('../../schedule-analysis-core/src').ActivityPopulationContract;
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
  /** Calendar the relationship lags are counted on, and its basis (stated by
   * the programme, or not stated: successor calendar used). Additive. */
  relationshipLagCalendar?: import('../../schedule-cpm/src').RelationshipLagCalendarSummary;
  sourceForecastCompletionIso: string | null;
  independentForecastCompletionIso: string | null;
  /** P0-B: the network finish CMeng calculated, including open activities on an assumed calendar (listed below). Null only when the network cannot be calculated. */
  calculatedCompletionIso?: string | null;
  /** Open (not completed) activities calculated on an assumed elapsed calendar. */
  assumedCalendarOpenActivityIds?: string[];
  forecastVarianceDays: number | null;
  /** calculatedCompletionIso minus the submitted programme finish, in calendar days. */
  calculatedVarianceDays?: number | null;
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
  /** F26: the same CPM run with and without the source constraints. Additive; present only when the constrained run was asked for. */
  constraintComparison?: ConstraintComparison;
}

export interface ConstraintComparison {
  basis: "source_constraints_applied_vs_not_applied" | "no_source_constraints_identical_network";
  formula: string;
  constrainedActivityCount: number;
  withConstraintsCompletionIso: string | null;
  withoutConstraintsCompletionIso: string | null;
  /** with-constraints completion minus without-constraints completion, elapsed calendar days; positive = constraints delay completion. Null when either run is unresolved. */
  differenceCalendarDays: number | null;
}
