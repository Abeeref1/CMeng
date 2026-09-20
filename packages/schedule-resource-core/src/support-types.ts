export type UtilizationResourceClass =
  | "labor"
  | "equipment"
  | "material"
  | "unknown";

export interface ResourceEvidenceRef {
  sourceId: string;
  locator: string;
}

export interface CanonicalResourceCapacityMasterRow {
  resourceId: string;
  resourceUid: string | null;
  resourceName: string | null;
  resourceClass: UtilizationResourceClass;
  trade: string | null;
  unit: string | null;
  utilizationApplicable: boolean | null;
  availableUnits: number | null;
  hoursPerUnitPerWeek: number | null;
  baseWeeklyCapacity: number | null;
  sourceRefs: ResourceEvidenceRef[];
}

export interface CanonicalResourceWeekRow {
  resourceId: string;
  resourceUid: string | null;
  resourceClass: UtilizationResourceClass;
  trade: string | null;
  unit: string | null;
  weekStartIso: string | null;
  availableCapacity: number | null;
  plannedDemand: number | null;
  actualApprovedUsage: number | null;
  forecastDemand: number | null;
  plannedUtilizationPercent: number | null;
  actualUtilizationPercent: number | null;
  plannedOverallocated: boolean | null;
  actualOverallocated: boolean | null;
  sourceRefs: ResourceEvidenceRef[];
}

export interface CanonicalApprovedResourceUsageRow {
  resourceId: string;
  resourceUid: string | null;
  weekStartIso: string | null;
  unit: string | null;
  actualApprovedUsage: number | null;
  sourceStatus: string | null;
  sourceRefs: ResourceEvidenceRef[];
}

export interface CanonicalAssignmentTimephasedRow {
  assignmentId: string;
  activityId: string | null;
  resourceUid: string | null;
  resourceId: string | null;
  weekStartIso: string | null;
  unit: string | null;
  plannedQuantity: number | null;
  actualQuantity: number | null;
  remainingForecastQuantity: number | null;
  sourceRefs: ResourceEvidenceRef[];
}

export interface CanonicalMonthlyResourceUtilizationRow {
  resourceId: string;
  resourceUid: string | null;
  resourceClass: UtilizationResourceClass;
  trade: string | null;
  unit: string | null;
  month: string | null;
  availableCapacity: number | null;
  plannedDemand: number | null;
  actualUsage: number | null;
  forecastDemand: number | null;
  plannedUtilizationPercent: number | null;
  actualUtilizationPercent: number | null;
  forecastUtilizationPercent: number | null;
  sourceRefs: ResourceEvidenceRef[];
}

export interface CanonicalResourceUtilizationHeadline {
  metric: string;
  value: number | string | null;
  unit: string | null;
  source: string | null;
  sourceRefs: ResourceEvidenceRef[];
}

export interface CanonicalResourceSupportFragment {
  documentId: string;
  kind:
    | "capacity_master"
    | "weekly_utilization"
    | "approved_actual_usage"
    | "assignment_timephased"
    | "monthly_utilization"
    | "headline_metrics"
    | "unknown";
  capacityMaster: CanonicalResourceCapacityMasterRow[];
  weekly: CanonicalResourceWeekRow[];
  actualUsage: CanonicalApprovedResourceUsageRow[];
  assignmentTimephased: CanonicalAssignmentTimephasedRow[];
  monthly: CanonicalMonthlyResourceUtilizationRow[];
  headlineMetrics: CanonicalResourceUtilizationHeadline[];
  diagnostics: string[];
}

export interface CanonicalResourceSupportModel {
  projectId: string;
  dataDateIso: string | null;
  capacityMaster: CanonicalResourceCapacityMasterRow[];
  weekly: CanonicalResourceWeekRow[];
  actualUsage: CanonicalApprovedResourceUsageRow[];
  assignmentTimephased: CanonicalAssignmentTimephasedRow[];
  monthly: CanonicalMonthlyResourceUtilizationRow[];
  headlineMetrics: CanonicalResourceUtilizationHeadline[];
  utilizationApplicableResourceCount: number;
  materialResourceCount: number;
  weeklyRowCount: number;
  actualUsageRowCount: number;
  assignmentTimephasedRowCount: number;
  averagePlannedUtilizationToDataDatePercent: number | null;
  averageActualUtilizationToDataDatePercent: number | null;
  plannedOverallocationRowCount: number;
  actualOverallocationRowCount: number;
  units: string[];
  sourceDocumentIds: string[];
  diagnostics: string[];
}
