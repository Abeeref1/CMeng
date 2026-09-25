export interface RevisionTrendPoint {
  changeCategories?: Array<{category:string;activityCount:number}> | null;
  executionActivityCount?: number; sourceActivityCount?: number; scheduleProgressCoveragePercent?: number | null;
  revisionId: string;
  label: string | null;
  sequence: number;
  effectiveAt: string | null;
  dataDateIso: string | null;
  activityCount: number;
  relationshipCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  unknownStatusCount: number;
  durationWeightedProgressPercent: number | null;
  floatCoveragePercent: number | null;
  criticalCount: number;
  nearCriticalCount: number | null;
  floatRiskWatchlistCount: number | null;
  zeroFloatCount: number;
  negativeFloatCount: number;
  forecastCompletionIso: string | null;
  programmeCompletionIso: string | null;
  logicDensity: number | null;
  graphComplete: boolean;
  addedVsPrevious: number | null;
  removedVsPrevious: number | null;
  modifiedVsPrevious: number | null;
}

export interface RevisionTrendProjection {
  schemaVersion: "1.0";
  projectionKey: "revision_trend";
  generatedAt: string;
  producerVersion: string;
  revisionCount: number;
  points: RevisionTrendPoint[];
}
