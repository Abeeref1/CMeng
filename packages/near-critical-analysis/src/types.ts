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
  rows: NearCriticalRow[];
}
