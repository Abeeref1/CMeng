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
  dataDateIso: string | null;
  criticalThresholdHours: number;
  nearCriticalLowerBoundHours: number;
  nearCriticalLowerBoundInclusive: boolean;
  nearCriticalThresholdHours: number;
  thresholdAuthority?:
    | "default"
    | "project_control_basis"
    | "source_metric_reconciled";
  thresholdSourceRefs?: string[];
  thresholdDefinition?: string | null;
  floatCoveragePercent: number | null;
  nearCriticalCount: number;
  rows: NearCriticalRow[];
}
