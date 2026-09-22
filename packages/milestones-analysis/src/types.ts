import type {
  CanonicalActivityStatus,
  CanonicalActivityType,
} from "../../schedule-analysis-core/src";

export type MilestoneCriticality =
  | "critical"
  | "near_critical"
  | "positive_float"
  | "unknown";

export type MilestoneDueState =
  | "completed"
  | "overdue"
  | "due_30_days"
  | "due_90_days"
  | "future"
  | "unknown";

export type MilestoneManagementPriority =
  | "critical"
  | "high"
  | "watch"
  | "normal";

export type MilestoneManagementFlag =
  | "SOURCE_FLOAT_CRITICAL"
  | "NEGATIVE_FLOAT"
  | "NEAR_CRITICAL"
  | "OVERDUE"
  | "DUE_WITHIN_30_DAYS"
  | "DUE_WITHIN_90_DAYS"
  | "LATER_THAN_BASELINE"
  | "FLOAT_NOT_ESTABLISHED"
  | "TERMINAL_CRITICAL_MILESTONE";

export interface MilestoneRow {
  activityId: string;
  name: string | null;
  wbsId: string | null;
  wbsName: string | null;
  activityType: CanonicalActivityType;
  status: CanonicalActivityStatus;
  baselineDateIso: string | null;
  currentDateIso: string | null;
  actualDateIso: string | null;
  totalFloatHours: number | null;
  calendarId: string | null;
  nearCriticalThresholdHours: number | null;
  varianceDays: number | null;
  daysFromDataDate: number | null;
  dueState: MilestoneDueState;
  criticality: MilestoneCriticality;
  negativeFloat: boolean;
  predecessorCount: number;
  successorCount: number;
  criticalPredecessorCount: number;
  criticalSuccessorCount: number;
  terminalMilestone: boolean;
  managementPriority: MilestoneManagementPriority;
  managementFlags: MilestoneManagementFlag[];
  managementAction: string;
}

export interface MilestonesProjection {
  schemaVersion: "1.0";
  projectionKey: "milestones";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;
  criticalityBasis: "submitted_total_float";
  criticalFloatThresholdHours: number;
  nearCriticalFloatThresholdHours: number | null;
  nearCriticalThresholdWorkingDays: number | null;
  nearCriticalThresholdBasis: "activity_calendar_working_days" | "explicit_hours" | "unresolved";
  floatCoveragePercent: number | null;
  sourceFloatState:
    | "source_float_established"
    | "source_float_partial"
    | "not_established";
  milestoneCount: number;
  completedCount: number;
  openCount: number;
  lateOpenCount: number;
  criticalMilestoneCount: number;
  nearCriticalMilestoneCount: number;
  negativeFloatMilestoneCount: number;
  due30Count: number;
  due90Count: number;
  criticalPriorityCount: number;
  highPriorityCount: number;
  sourceFloatCriticalMilestoneIds: string[];
  terminalCriticalMilestoneIds: string[];
  rows: MilestoneRow[];
}
