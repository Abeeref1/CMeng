import type {
  CanonicalActivityStatus,
  CanonicalActivityType,
} from "../../schedule-analysis-core/src";

export type LookAheadClassification =
  | "overdue"
  | "ongoing"
  | "upcoming"
  | "finishing_in_window"
  | "missing_current_dates";

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
  predecessorIds: string[];
  successorIds: string[];
  daysToStart: number | null;
  daysToFinish: number | null;
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
  rows: LookAheadActivityRow[];
  missingCurrentDateActivityIds: string[];
}
