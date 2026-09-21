import type {
  DelayResponsibility,
  GovernanceState,
} from "../../delay-analysis-core/src";

export type WindowAnalysisState =
  | "complete"
  | "partial"
  | "unresolved";

export type ProgrammeMovementBasis =
  | "matched_activity_finish_shift"
  | "independent_cpm"
  | "source_forecast"
  | "source_schedule_boundary"
  | "unavailable";

export interface WindowEventRef {
  eventId: string;
  title: string;
  responsibility: DelayResponsibility;
  responsibilityState: GovernanceState;
  describedImpactDays: number | null;
  describedImpactState: GovernanceState;
}

export interface ScheduleWindowResult {
  windowId: string;
  sequence: number;
  fromRevisionId: string;
  toRevisionId: string;
  windowStartIso: string | null;
  windowEndIso: string | null;
  state: WindowAnalysisState;

  fromSourceForecastCompletionIso: string | null;
  toSourceForecastCompletionIso: string | null;
  sourceForecastMovementDays: number | null;

  fromIndependentForecastCompletionIso: string | null;
  toIndependentForecastCompletionIso: string | null;
  independentForecastMovementDays: number | null;

  fromScheduleBoundaryIso: string | null;
  toScheduleBoundaryIso: string | null;
  scheduleBoundaryMovementDays: number | null;

  /**
   * Analytical window movement: the strongest matched-activity finish shift
   * for the window. This is deliberately separate from project completion
   * movement and is not entitlement/EOT.
   */
  strongestProgrammeMovementDays: number | null;
  strongestProgrammeMovementBasis:
    ProgrammeMovementBasis;
  matchedActivityCount: number;
  comparableActivityFinishShiftCount: number;
  activityFinishShiftCoveragePercent: number | null;
  strongestPositiveActivityMovementDays: number | null;
  strongestPositiveActivityId: string | null;
  strongestNegativeActivityMovementDays: number | null;
  strongestNegativeActivityId: string | null;
  averagePositiveActivityMovementDays: number | null;
  averageNegativeActivityMovementDays: number | null;

  fromProgressPercent: number | null;
  toProgressPercent: number | null;
  progressMovementPercent: number | null;

  addedActivityCount: number;
  removedActivityCount: number;
  modifiedActivityCount: number;
  addedRelationshipCount: number;
  removedRelationshipCount: number;

  enteredCriticalActivityIds: string[];
  exitedCriticalActivityIds: string[];

  delayEvents: WindowEventRef[];
  employerEventIds: string[];
  contractorEventIds: string[];
  neutralEventIds: string[];
  concurrentEventCandidate: boolean;

  attributionState:
    "not_attributed";
  assumptions: string[];
  diagnostics: string[];
}

export interface WindowsAnalysisProjection {
  schemaVersion: "1.0";
  projectionKey: "windows_analysis";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  revisionCount: number;
  windowCount: number;
  completeWindowCount: number;
  partialWindowCount: number;
  unresolvedWindowCount: number;
  positiveIndependentMovementDays: number;
  negativeIndependentMovementDays: number;
  /**
   * Sum of the strongest positive matched-activity finish shift in each
   * chronological analysis window. This is an analytical gross movement
   * metric, not net project delay or EOT.
   */
  positiveProgrammeMovementDays: number;
  /**
   * Sum of the strongest negative matched-activity finish shift in each
   * chronological analysis window. This is an analytical recovery metric.
   */
  negativeProgrammeMovementDays: number;
  /** Net change in project completion from the first to the latest revision. */
  projectCompletionMovementDays: number | null;
  projectCompletionMovementBasis:
    | "source_forecast"
    | "source_schedule_boundary"
    | "unavailable";
  firstProjectCompletionIso: string | null;
  latestProjectCompletionIso: string | null;
  programmeMovementAvailableWindowCount: number;
  windows: ScheduleWindowResult[];
  diagnostics: string[];
}
