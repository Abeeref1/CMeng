import type { ActivityPopulationContract } from "../../schedule-analysis-core/src";
export interface ProgressBreakdownRow {
  baselinePlannedPercent?: number | null; currentPlanPercent?: number | null;
  baselinePlanCoveragePercent?: number | null; currentPlanCoveragePercent?: number | null;
  scheduleMinusCurrentPlanPercentagePoints?: number | null; scheduleMinusBaselinePercentagePoints?: number | null;
  previousScheduleProgressPercent?: number | null; previousComparisonCoveragePercent?: number | null;
  scheduleProgressMovementPercentagePoints?: number | null;
  contractorReportedPercent?: number | null; certifiedPhysicalPercent?: number | null;
  physicalMeasuredPercent?: number | null;
  forecastFinishIso?: string | null;
  delayedActivityCount?: number;
  milestoneThreatIds?: string[];
  longLeadActivityCount?: number;
  procurementBlockerCount?: number;
  designBlockerCount?: number;
  completedRecordCleanupCount?:number;
  owner?: string | null;
  managementAction?: string;
  wbsId: string;
  wbsName: string | null;
  activityCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  unknownStatusCount: number;
  percentCompleteAverage: number | null;
  percentCompleteCoveragePercent: number | null;
  durationWeightedProgressPercent: number | null;
  durationWeightedCoveragePercent: number | null;
  originalDurationHoursKnown: number;
  remainingDurationHoursKnown: number;
  criticalCount: number | null;
  nearCriticalCount: number | null;
  negativeFloatCount: number | null;
  floatCoveragePercent: number | null;
}

export interface ProgressBreakdownProjection {
  schemaVersion: "1.0";
  projectionKey: "progress_breakdown";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  totalActivityCount: number;
  rows: ProgressBreakdownRow[];
  population?: ActivityPopulationContract;
  hierarchyState?: "established" | "review_required";
  diagnostics?: string[];
  hierarchyRows?: Array<ProgressBreakdownRow & {
    parentWbsId: string | null; depth: number; directActivityCount: number;
    progressAuthority: "submitted_schedule"; contractorReportedPercent: number | null;
    certifiedPhysicalPercent: number | null; baselinePlannedPercent: number | null;
    currentPlanPercent: number | null; basisNote: string;
  }>;
  dimensionViews?: ProgressBreakdownDimensionView[];
  overallScheduleProgressPercent?: number | null;
  overallProgressCoveragePercent?: number | null;
  overallKnownWeightHours?: number;
  baselinePlanAvailable?: boolean;
  controlledBaselineAvailable?: boolean;
}


export type ProgressBreakdownDimension =
  | "wbs"
  | "wbs_level"
  | "zone"
  | "level"
  | "work_front"
  | "cbs";

export interface ProgressBreakdownGroupRow {
  dimension: ProgressBreakdownDimension;
  groupKey: string;
  groupLabel: string;
  classified: boolean;
  activityCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  unknownStatusCount: number;
  scheduleProgressPercent: number | null;
  progressCoveragePercent: number | null;
  knownWeightHours: number;
  weightSharePercent: number | null;
  progressContributionPercentagePoints: number | null;
  criticalCount: number | null;
  nearCriticalCount: number | null;
  negativeFloatCount: number | null;
  activityIds?: string[];
  baselinePlannedPercent?: number | null;
  currentPlanPercent?: number | null;
  physicalMeasuredPercent?: number | null;
  certifiedPhysicalPercent?: number | null;
  forecastFinishIso?: string | null;
  delayedActivityCount?: number;
  milestoneThreatIds?: string[];
  longLeadActivityCount?: number;
  procurementBlockerCount?: number;
  designBlockerCount?: number;
  owner?: string | null;
  managementAction?: string;
}

export interface ProgressBreakdownDimensionView {
  dimension: ProgressBreakdownDimension;
  label: string;
  sourcePopulation: number;
  classifiedPopulation: number;
  unclassifiedPopulation: number;
  classificationCoveragePercent: number | null;
  available: boolean;
  basis: string;
  rows: ProgressBreakdownGroupRow[];
}
