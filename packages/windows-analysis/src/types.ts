import type {
  DelayResponsibility,
  GovernanceState,
} from "../../delay-analysis-core/src";

export type WindowAnalysisState =
  | "complete"
  | "partial"
  | "unresolved";

export type ProgrammeMovementBasis =
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

  strongestProgrammeMovementDays: number | null;
  strongestProgrammeMovementBasis:
    ProgrammeMovementBasis;

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
  positiveProgrammeMovementDays: number;
  negativeProgrammeMovementDays: number;
  programmeMovementAvailableWindowCount: number;
  windows: ScheduleWindowResult[];
  diagnostics: string[];
}
