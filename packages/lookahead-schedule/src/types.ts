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
  // SW-18: a source can state that a dimension is not applicable; that is its
  // own state (not ready, not blocked, not unknown).
  state: ReadinessDimensionState;
  sourceRefs: string[];
  note?: string | null;
  diagnostics?: string[];
  records?:ReadinessRecord[];
}

export interface ReadinessRecord {
  owner?:string|null;
  longLead?:boolean;
  recordId:string|null;documentType:string;state:ReadinessDimensionState;
  dueIso:string|null;note:string;sourceRefs:string[];
}

export interface ReadinessDimension {
  key: ReadinessDimensionKey;
  state: ReadinessDimensionState;
  sourceRefs: string[];
  note: string | null;
  diagnostics?: string[];
  records?:ReadinessRecord[];
}

export interface LookAheadReadiness {
  state: "ready" | "conditional" | "blocked";
  readyCount: number;
  blockedCount: number;
  unknownCount: number;
  /** SW-18: not-applicable dimensions, shown apart from ready/blocked/unknown. */
  notApplicableCount?: number;
  dimensions: ReadinessDimension[];
}

export interface LookAheadActivityRow {
  activityId: string;
  name: string | null;
  wbsId: string | null;
  wbsPath?: string | null;
  affectedMilestoneIds?: string[];
  activityType: CanonicalActivityType;
  status: CanonicalActivityStatus;
  startIso: string | null;
  finishIso: string | null;
  baselineFinishIso: string | null;
  percentComplete: number | null;
  totalFloatHours: number | null;
  submittedTotalFloatHours?:number|null;
  submittedTotalFloatWorkingDays?:number|null;
  workingDayHours?:number|null;
  floatDaysBasis?:'source_activity_calendar'|'calendar_working_day_not_established';
  drivingPath?:boolean|null;
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
  /** F42: named blockers on each driving activity in the look-ahead. Additive. */
  drivingBlockers?: DrivingActivityBlockers;
  blockerTypes?: Array<{ documentType: string; activityCount: number; recordCount: number; recordIds: string[] }>;
  readinessCoverage?: Array<{ key: ReadinessDimensionKey; denominator: number; knownCount: number; coveragePercent: number | null; linkedActivityCount?:number; linkedSourceRecordCount?:number; unresolvedLinkedActivityCount?:number }>;
  forwardWindowCount: number;
  overdueBacklogCount: number;
  overdueBacklogBlockedCount: number;
  forwardWindowRows: LookAheadActivityRow[];
  overdueBacklogRows: LookAheadActivityRow[];
  managementInterventions?: Array<{
    blockerType: ReadinessDimensionKey;
    wbsId: string | null;
    wbsPath: string | null;
    activityCount: number;
    activityIds: string[];
    affectedMilestoneIds: string[];
    requiredByIso: string | null;
    owner: string | null;
    action: string;
    sourceRefs: string[];
  }>;
  readyCount: number;
  conditionalCount: number;
  atRiskCount?: number;
  noKnownLinkedBlockerCount?: number;
  blockedCount: number;
  rows: LookAheadActivityRow[];
  missingCurrentDateActivityIds: string[];
}

export interface DrivingActivityBlocker {
  activityId: string;
  name: string | null;
  startIso: string | null;
  finishIso: string | null;
  totalFloatHours: number | null;
  inForwardWindow: boolean;
  incompletePredecessors: Array<{ activityId: string; name: string | null; status: CanonicalActivityStatus | "not_in_programme"; finishIso: string | null }>;
  /** Readiness dimensions with no source evidence: unknown, not ready. */
  missingReadiness: Array<{ dimension: ReadinessDimensionKey; note: string | null }>;
  /** Linked source records still open (state blocked): RFIs, NCRs, permits, procurement and others. */
  openItems: Array<{ dimension: ReadinessDimensionKey; recordId: string | null; documentType: string; dueIso: string | null; owner: string | null; note: string; sourceRefs: string[] }>;
  blockerCount: number;
}

export interface DrivingActivityBlockers {
  basis: "independent_driving_path";
  formula: string;
  drivingActivityCount: number;
  blockedDrivingActivityCount: number;
  rows: DrivingActivityBlocker[];
}
