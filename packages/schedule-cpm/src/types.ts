import type {
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";

export type CpmCalculationMode =
  | "calendar_working_time"
  | "mixed_with_elapsed_fallback"
  | "elapsed_time_fallback";

export type CpmDurationBasis =
  | "remaining"
  | "original";

export interface CpmConfig {
  durationBasis: CpmDurationBasis;
  allowElapsedFallback: boolean;
  assumeUnknownRelationshipTypeFs: boolean;
  assumeMissingLagZero: boolean;
  criticalThresholdHours: number;
  projectStartIso?: string | null;
  requiredFinishIso?: string | null;
}

export const DEFAULT_CPM_CONFIG: CpmConfig = {
  durationBasis: "remaining",
  allowElapsedFallback: true,
  assumeUnknownRelationshipTypeFs: true,
  assumeMissingLagZero: true,
  criticalThresholdHours: 0,
};

export interface CpmActivityResult {
  activityId: string;
  calendarId: string | null;
  calendarMode:
    | "source_calendar"
    | "elapsed_fallback";
  durationHours: number | null;
  durationMethod: string | null;

  earlyStartIso: string | null;
  earlyFinishIso: string | null;
  lateStartIso: string | null;
  lateFinishIso: string | null;
  totalFloatHours: number | null;

  critical: boolean | null;
  status: "calculated" | "unresolved";
  diagnostics: string[];
}

export interface CpmResult {
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;
  durationBasis: CpmDurationBasis;
  calculationMode: CpmCalculationMode;
  relationshipLagCalendarMethod:
    "successor_calendar_forward_predecessor_calendar_backward";
  projectStartIso: string | null;
  projectFinishIso: string | null;
  requiredFinishIso: string | null;
  latePassFinishIso: string | null;
  criticalThresholdHours: number;
  criticalActivityIds: string[];
  activities: CpmActivityResult[];
  unresolvedActivityIds: string[];
  assumptions: string[];
  diagnostics: string[];
  complete: boolean;
}

export interface IndependentForecastInput {
  model: CanonicalScheduleModel;
  config?: Partial<CpmConfig>;
}
