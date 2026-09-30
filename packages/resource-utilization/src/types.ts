import type {ResourceBusinessClass} from '../../schedule-resource-core/src';
export type ResourceUtilizationState =
  | "capacity_based"
  | "demand_only"
  | "no_assignments"
  | "not_capacity_resource";

export interface ResourceUtilizationRow {
  resourceId: string;
  resourceName: string | null;
  resourceType:
    | "labor"
    | "nonlabor"
    | "material"
    | "unknown";
  businessClass: ResourceBusinessClass;
  capacityEligible: boolean;
  assignmentCount: number;

  plannedUnitsKnown: number;
  plannedUnitsKnownCount: number;
  plannedUnitsCoveragePercent: number | null;

  actualUnitsKnown: number;
  actualUnitsKnownCount: number;
  actualUnitsCoveragePercent: number | null;

  remainingUnitsKnown: number;
  remainingUnitsKnownCount: number;
  remainingUnitsCoveragePercent: number | null;

  atCompletionUnitsKnownOrDerived: number;
  atCompletionUnitsKnownCount: number;
  atCompletionUnitsCoveragePercent: number | null;

  peakPlannedUnitsPerHour: number | null;
  peakRemainingUnitsPerHour: number | null;
  peakPlannedRateCoveragePercent: number | null;
  peakRemainingRateCoveragePercent: number | null;

  capacityUnitsPerHour: number | null;
  capacityEffectiveDateIso: string | null;
  plannedUtilizationPercent: number | null;
  remainingUtilizationPercent: number | null;
  overloaded: boolean | null;
  state: ResourceUtilizationState;
  assumptions: string[];
}

export interface ResourceUtilizationProjection {
  schemaVersion: "1.0";
  projectionKey: "resource_utilization";
  generatedAt: string;
  producerVersion: string;
  projectId: string | null;
  sourceRevisionId: string;
  dataDateIso: string | null;
  resourceCount: number;
  assignedResourceCount: number;
  assignmentRecordCount: number;
  resourcePopulationBasis:
    | "p6_resource_master"
    | "weekly_resource_evidence";
  capacityBasedResourceCount: number;
  capacityCoveragePercent: number | null;
  overloadedResourceCount: number;
  capacityEligibleResourceCount: number;
  businessClassCounts: Record<ResourceBusinessClass, number>;
  rows: ResourceUtilizationRow[];
  diagnostics: string[];
}
