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
  criticalCount: number | null;
  nearCriticalCount: number | null;
  floatRiskWatchlistCount: number | null;
  zeroFloatCount: number | null;
  negativeFloatCount: number | null;
  forecastCompletionIso: string | null;
  programmeCompletionIso: string | null;
  /** Signed submitted forecast finish movement from the immediately previous controlled revision; not entitlement. */
  submittedFinishMovementCalendarDays: number | null;
  /** Elapsed Data Date interval, not a contractual reporting cadence. */
  reportingIntervalCalendarDays: number | null;
  /** A jump in source revision sequence, not proof that a source file is missing. */
  sourceRevisionSequenceGap: number | null;
  criticalityBasis: 'submitted_total_float';
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
