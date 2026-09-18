export type CanonicalResourceType =
  | "labor"
  | "nonlabor"
  | "material"
  | "unknown";

export interface ResourceSourceRef {
  source: "xer";
  locator: string;
}

export interface CanonicalResourceRate {
  effectiveDateIso: string | null;
  maxUnitsPerHour: number | null;
  sourceRefs: ResourceSourceRef[];
}

export interface CanonicalUnitOfMeasure {
  unitId: string;
  name: string | null;
  abbreviation: string | null;
  sourceRefs: ResourceSourceRef[];
}

export interface CanonicalFinancialPeriod {
  periodId: string;
  name: string | null;
  startIso: string | null;
  endIso: string | null;
  sourceRefs: ResourceSourceRef[];
}

export interface CanonicalResourcePeriodActual {
  assignmentId: string;
  projectId: string | null;
  activityId: string;
  resourceId: string | null;
  periodId: string;
  periodName: string | null;
  periodStartIso: string | null;
  periodEndIso: string | null;
  actualUnits: number | null;
  sourceRefs: ResourceSourceRef[];
  diagnostics: string[];
}

export interface CanonicalResource {
  resourceId: string;
  nativeId: string;
  shortName: string | null;
  name: string | null;
  parentResourceId: string | null;
  resourceType: CanonicalResourceType;
  unitId: string | null;
  unitName: string | null;
  unitAbbreviation: string | null;
  calendarId: string | null;
  priceTimeUnit: string | null;
  rates: CanonicalResourceRate[];
  sourceRefs: ResourceSourceRef[];
}

export interface CanonicalResourceAssignment {
  assignmentId: string;
  projectId: string | null;
  activityId: string;
  nativeTaskId: string;
  resourceId: string | null;
  roleId: string | null;
  resourceType: CanonicalResourceType;

  plannedUnits: number | null;
  actualRegularUnits: number | null;
  actualOvertimeUnits: number | null;
  remainingUnits: number | null;
  atCompletionUnits: number | null;

  plannedUnitsPerHour: number | null;
  remainingUnitsPerHour: number | null;

  plannedStartIso: string | null;
  plannedFinishIso: string | null;
  actualStartIso: string | null;
  actualFinishIso: string | null;
  remainingStartIso: string | null;
  remainingFinishIso: string | null;

  curveId: string | null;
  sourceRefs: ResourceSourceRef[];
  diagnostics: string[];
}

export interface CanonicalResourceModel {
  projectId: string | null;
  sourceRevisionId: string;
  units: CanonicalUnitOfMeasure[];
  financialPeriods: CanonicalFinancialPeriod[];
  resources: CanonicalResource[];
  assignments: CanonicalResourceAssignment[];
  periodActuals: CanonicalResourcePeriodActual[];
  diagnostics: string[];
}

export interface UnitAggregate {
  knownValue: number;
  knownCount: number;
  totalCount: number;
  coveragePercent: number | null;
}
