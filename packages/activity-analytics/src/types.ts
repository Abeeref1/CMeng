import type {
  CanonicalActivityStatus,
  CanonicalActivityType,
} from "../../schedule-analysis-core/src";

export type ActivityCriticality =
  | "critical"
  | "near_critical"
  | "noncritical"
  | "unknown";

export interface ActivityAnalyticsRow {
  activityId: string;
  name: string | null;
  wbsId: string | null;
  calendarId: string | null;
  activityType: CanonicalActivityType;
  status: CanonicalActivityStatus;

  baselineStartIso: string | null;
  baselineFinishIso: string | null;
  currentStartIso: string | null;
  currentFinishIso: string | null;
  actualStartIso: string | null;
  actualFinishIso: string | null;
  forecastStartIso: string | null;
  forecastFinishIso: string | null;

  percentComplete: number | null;
  originalDurationHours: number | null;
  remainingDurationHours: number | null;
  totalFloatHours: number | null;
  freeFloatHours: number | null;

  criticality: ActivityCriticality;
  floatRiskWatchlist: boolean | null;
  finishVarianceDays: number | null;

  predecessorIds: string[];
  successorIds: string[];
  predecessorCount: number;
  successorCount: number;
  openStart: boolean;
  openFinish: boolean;
  isolated: boolean;

  diagnostics: string[];
}

export interface ActivityAnalyticsProjection {
  schemaVersion: "1.0";
  projectionKey: "activity_analytics";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  activityCount: number;
  counts: Record<'critical' | 'nearCritical' | 'floatRisk' | 'late', {
    value: number | null; knownCount: number | null; unresolvedCount: number | null; populationCount: number | null;
  }>;
  population: {
    sourceActivityCount: number;
    executableActivityCount: number;
    excludedActivityCount: number;
    excludedByType: {
      wbsSummaryCount: number;
      levelOfEffortCount: number;
      otherExcludedCount: number;
    };
    rowPopulation: "all_source_activities";
  };
  floatCoveragePercent: number | null;
  percentCompleteCoveragePercent: number | null;
  finishVarianceCoveragePercent: number | null;
  rows: ActivityAnalyticsRow[];
  diagnostics: string[];
}
