export interface NearCriticalRow {
  activityId: string;
  name: string | null;
  wbsId: string | null;
  status: string;
  totalFloatHours: number;
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
  nearCriticalThresholdHours: number;
  floatCoveragePercent: number | null;
  nearCriticalCount: number;
  rows: NearCriticalRow[];
}
