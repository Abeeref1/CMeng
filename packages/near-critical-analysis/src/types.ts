import type { ActivityPopulationContract, numericDistribution } from "../../schedule-analysis-core/src";
export interface NearCriticalBoundaryAuditRow {
  activityId: string;
  name: string | null;
  calendarId: string | null;
  calendarSemanticComplete: boolean | null;
  totalFloatSourceRefs: string[];
  calendarSourceRefs: string[];
  totalFloatHours: number;
  calendarWorkingDayHours: number | null;
  totalFloatWorkingDays: number | null;
  criticalThresholdHours: number;
  nearCriticalThresholdWorkingDays: number | null;
  nearCriticalThresholdHours: number | null;
  distanceFromCriticalThresholdHours: number;
  distanceFromNearCriticalUpperBoundaryHours: number | null;
  distanceFromNearCriticalUpperBoundaryWorkingDays: number | null;
  criticality:
    | "critical"
    | "near_critical"
    | "noncritical"
    | "unknown";
  floatRiskWatchlist: boolean | null;
  inclusionReason: string;
}

export interface NearCriticalBoundaryAudit {
  sampleLimitPerSide: number;
  sourceRevisionId: string;
  totalFloatSourceField: "TASK.total_float_hr_cnt";
  calendarJoinField: "TASK.clndr_id -> CALENDAR.clndr_id";
  criticalBoundary: {
    thresholdHours: number;
    below: NearCriticalBoundaryAuditRow[];
    at: NearCriticalBoundaryAuditRow[];
    above: NearCriticalBoundaryAuditRow[];
  };
  nearCriticalUpperBoundary: {
    thresholdWorkingDays: number | null;
    inside: NearCriticalBoundaryAuditRow[];
    outside: NearCriticalBoundaryAuditRow[];
  };
}

export interface NearCriticalRow {
  activityId: string;
  name: string | null;
  wbsId: string | null;
  calendarId: string | null;
  status: string;
  totalFloatHours: number;
  nearCriticalThresholdHours: number | null;
  baselineFinishIso: string | null;
  sourceTargetFinishIso?: string | null;
  currentFinishIso: string | null;
  percentComplete: number | null;
}

export interface NearCriticalProjection {
  schemaVersion: "1.0";
  projectionKey: "near_critical";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  controlledBaselineRevisionId?: string | null;
  criticalThresholdHours: number;
  nearCriticalThresholdHours: number | null;
  nearCriticalThresholdWorkingDays: number | null;
  thresholdBasis: "activity_calendar_working_days" | "explicit_hours" | "unresolved";
  floatCoveragePercent: number | null;
  classificationCoveragePercent: number | null;
  nearCriticalCount: number;
  floatRiskWatchlistCount: number;
  zeroFloatCount: number;
  negativeFloatCount: number;
  floatRiskWatchlistIncludesCriticalThreshold: boolean;
  population?: ActivityPopulationContract;
  floatDistribution?: ReturnType<typeof numericDistribution>;
  rows: NearCriticalRow[];
  watchlistRows: NearCriticalRow[];
  boundaryAudit: NearCriticalBoundaryAudit;
}
