import type {
  CanonicalActivityStatus,
  CanonicalActivityType,
} from "../../schedule-analysis-core/src";

export type LookAheadClassification =
  | "overdue"
  | "missed_start"
  | "ongoing"
  | "upcoming"
  | "finishing_in_window"
  | "missing_current_dates";

export type ReadinessDimensionKey =
  | "predecessor"
  | "procurement_material"
  | "design_submittal"
  | "permit"
  | "resource"
  | "quality"
  | "commercial"
  | "risk"
  | "access";

export type ReadinessDimensionState =
  | "ready"
  | "blocked"
  | "unknown"
  | "not_applicable";

export interface ReadinessEvidence {
  state: Exclude<
    ReadinessDimensionState,
    "not_applicable"
  >;
  sourceRefs: string[];
  note?: string | null;
}

export interface ReadinessDimension {
  key: ReadinessDimensionKey;
  state: ReadinessDimensionState;
  sourceRefs: string[];
  note: string | null;
}

export interface LookAheadReadiness {
  state: "ready" | "conditional" | "blocked";
  readyCount: number;
  blockedCount: number;
  unknownCount: number;
  dimensions: ReadinessDimension[];
}

export interface LookAheadActivityRow {
  activityId: string;
  name: string | null;
  wbsId: string | null;
  activityType: CanonicalActivityType;
  status: CanonicalActivityStatus;
  startIso: string | null;
  finishIso: string | null;
  baselineFinishIso: string | null;
  percentComplete: number | null;
  totalFloatHours: number | null;
  classification: LookAheadClassification;
  missedPlannedStart?: boolean;
  finishOverdue?: boolean;
  predecessorIds: string[];
  successorIds: string[];
  daysToStart: number | null;
  daysToFinish: number | null;
  readiness: LookAheadReadiness;
}

export interface LookAheadProjection {
  schemaVersion: "1.0";
  projectionKey: "lookahead_schedule";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;
  windowDays: number;
  windowEndIso: string | null;
  incompleteActivityCount: number;
  datedIncompleteActivityCount: number;
  currentDateCoveragePercent: number | null;
  overdueCount: number;
  missedStartCount?: number;
  evidenceGapActivityCount?: number;
  blockedWithEvidenceGapCount?: number;
  blockerOccurrenceCount?: number;
  readinessCoverage?: Array<{ key: ReadinessDimensionKey; denominator: number; knownCount: number; coveragePercent: number | null }>;
  readyCount: number;
  conditionalCount: number;
  blockedCount: number;
  rows: LookAheadActivityRow[];
  missingCurrentDateActivityIds: string[];
}
