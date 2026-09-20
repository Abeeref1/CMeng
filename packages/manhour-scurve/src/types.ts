export type ManhourSeriesState =
  | "complete"
  | "partial"
  | "missing";

export interface ManhourScurvePoint {
  dateIso: string;
  plannedCumulativeHours: number | null;
  actualCumulativeHours: number | null;
  forecastCumulativeHours: number | null;
}

export interface ManhourScurveProjection {
  schemaVersion: "1.0";
  projectionKey: "manhour_scurve";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;

  unitBasis:
    "p6_labor_assignment_work_units_as_hours";
  plannedTimePhasing:
    "linear_between_assignment_dates";
  remainingTimePhasing:
    "linear_between_remaining_assignment_dates";
  actualHistoryMethod:
    | "approved_resource_week_source"
    | "stored_financial_period_actuals"
    | "current_actual_snapshot_only"
    | "missing";
  actualHistoryAuthority:
    | "approved_source_register"
    | "p6_period_actuals"
    | "p6_current_snapshot"
    | "missing";
  sourceActualResourceCoveragePercent:
    number | null;

  laborResourceCount: number;
  laborAssignmentCount: number;

  plannedHoursKnown: number | null;
  plannedAssignmentCoveragePercent: number | null;
  plannedCurveCoveragePercent: number | null;
  plannedState: ManhourSeriesState;

  actualHoursKnownCurrent: number | null;
  actualAssignmentCoveragePercent: number | null;
  periodActualAssignmentCoveragePercent: number | null;
  actualState: ManhourSeriesState;

  remainingHoursKnown: number | null;
  remainingAssignmentCoveragePercent: number | null;
  remainingCurveCoveragePercent: number | null;
  forecastState: ManhourSeriesState;

  points: ManhourScurvePoint[];
  assumptions: string[];
  diagnostics: string[];
}
