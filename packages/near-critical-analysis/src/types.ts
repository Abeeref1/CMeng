export interface NearCriticalBoundaryAuditRow extends NearCriticalRow {
  calendarWorkingDayHours: number | null;
  totalFloatWorkingDays: number | null;
  criticality:
    | "critical"
    | "near_critical"
    | "noncritical"
    | "unknown";
  floatRiskWatchlist: boolean | null;
  distanceFromCriticalBoundaryHours: number;
  distanceFromNearCriticalUpperHours: number | null;
  analysisEligible: boolean;
  exclusionReason: "level_of_effort" | "wbs_summary" | null;
}

export interface NearCriticalBoundaryAudit {
  sampleSizePerSide: 100;
  criticalBoundaryHours: number;
  belowCriticalBoundaryCount: number;
  atCriticalBoundaryCount: number;
  aboveCriticalBoundaryCount: number;
  nearCriticalUpperInsideCount: number;
  nearCriticalUpperOutsideCount: number;
  unresolvedCalendarCount: number;
  belowCriticalBoundary: NearCriticalBoundaryAuditRow[];
  atCriticalBoundary: NearCriticalBoundaryAuditRow[];
  aboveCriticalBoundary: NearCriticalBoundaryAuditRow[];
  nearCriticalUpperInside: NearCriticalBoundaryAuditRow[];
  nearCriticalUpperOutside: NearCriticalBoundaryAuditRow[];
  unresolvedCalendar: NearCriticalBoundaryAuditRow[];
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
  rows: NearCriticalRow[];
  watchlistRows: NearCriticalRow[];
  boundaryAudit: NearCriticalBoundaryAudit;
}
