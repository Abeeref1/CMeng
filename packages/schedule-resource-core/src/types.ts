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

export interface CanonicalResource {
  resourceId: string;
  nativeId: string;
  shortName: string | null;
  name: string | null;
  parentResourceId: string | null;
  resourceType: CanonicalResourceType;
  unitId: string | null;
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
  resources: CanonicalResource[];
  assignments: CanonicalResourceAssignment[];
  diagnostics: string[];
}

export interface UnitAggregate {
  knownValue: number;
  knownCount: number;
  totalCount: number;
  coveragePercent: number | null;
}
