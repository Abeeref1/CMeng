export type ScheduleColumnRole =
  | "activity_id"
  | "activity_name"
  | "wbs"
  | "wbs_id"
  | "calendar"
  | "start"
  | "finish"
  | "actual_start"
  | "actual_finish"
  | "baseline_start"
  | "baseline_finish"
  | "original_duration"
  | "remaining_duration"
  | "total_float"
  | "free_float"
  | "percent_complete"
  | "status"
  | "predecessor_id"
  | "successor_id"
  | "relationship_type"
  | "lag"
  | "record_type"
  | "unknown";

export interface ScheduleHeaderMapping {
  row: number;
  roles: Record<number, ScheduleColumnRole>;
  headers: Record<number, string>;
  score: number;
}

export interface ScheduleCellLocator {
  source: "csv" | "xlsx";
  sheet: string | null;
  row: number;
  column: number;
  address: string | null;
}

export interface ScheduleActivityRow {
  activityId: string | null;
  activityName: string | null;
  wbs: string | null;
  wbsId: string | null;
  calendar: string | null;
  start: string | null;
  startIso: string | null;
  finish: string | null;
  finishIso: string | null;
  originalDurationRaw: string | null;
  originalDurationUnit: "hours" | "days" | "weeks" | "minutes" | "unknown";
  originalDurationHours: number | null;
  remainingDurationRaw: string | null;
  remainingDurationUnit: "hours" | "days" | "weeks" | "minutes" | "unknown";
  remainingDurationHours: number | null;
  totalFloatRaw: string | null;
  totalFloatUnit: "hours" | "days" | "weeks" | "minutes" | "unknown";
  totalFloatHours: number | null;
  freeFloatRaw: string | null;
  freeFloatUnit: "hours" | "days" | "weeks" | "minutes" | "unknown";
  freeFloatHours: number | null;
  percentComplete: number | null;
  status: string | null;
  locators: Partial<Record<ScheduleColumnRole, ScheduleCellLocator>>;
  statusState: "verified" | "unresolved";
  diagnostics: string[];
}

export interface ScheduleRelationshipRow {
  predecessorId: string | null;
  successorId: string | null;
  relationshipType: string | null;
  lagRaw: string | null;
  lagUnit: "hours" | "days" | "weeks" | "minutes" | "unknown";
  lagHours: number | null;
  locators: Partial<Record<ScheduleColumnRole, ScheduleCellLocator>>;
  statusState: "verified" | "unresolved";
  diagnostics: string[];
}

export interface ScheduleTabularResult {
  sourceType: "csv" | "xlsx";
  activities: ScheduleActivityRow[];
  relationships: ScheduleRelationshipRow[];
  activityRowsSeen: number;
  activityRowsVerified: number;
  activityRowsUnresolved: number;
  relationshipRowsSeen: number;
  relationshipRowsVerified: number;
  relationshipRowsUnresolved: number;
  coveragePercent: number | null;
  complete: boolean;
  diagnostics: string[];
}
