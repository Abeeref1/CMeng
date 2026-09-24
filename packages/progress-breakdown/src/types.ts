import type { ActivityPopulationContract } from "../../schedule-analysis-core/src";
export interface ProgressBreakdownRow {
  baselinePlannedPercent?: number | null; currentPlanPercent?: number | null;
  baselinePlanCoveragePercent?: number | null; currentPlanCoveragePercent?: number | null;
  scheduleMinusCurrentPlanPercentagePoints?: number | null; scheduleMinusBaselinePercentagePoints?: number | null;
  previousScheduleProgressPercent?: number | null; previousComparisonCoveragePercent?: number | null;
  scheduleProgressMovementPercentagePoints?: number | null;
  contractorReportedPercent?: number | null; certifiedPhysicalPercent?: number | null;
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
  criticalCount: number;
  nearCriticalCount: number | null;
  negativeFloatCount: number;
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
}
