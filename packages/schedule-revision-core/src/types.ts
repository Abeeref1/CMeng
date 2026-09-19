import type {
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";

export interface ScheduleRevision {
  revisionId: string;
  label: string | null;
  sequence: number;
  effectiveAt: string | null;
  model: CanonicalScheduleModel;
}

export type ScheduleActivityChangeKind =
  | "added"
  | "removed"
  | "modified"
  | "unchanged";

export type ActivityIdentityMethod =
  | "activity_id"
  | "native_id"
  | "wbs_name_type";

export interface ActivityIdentityMatch {
  fromActivityId: string;
  toActivityId: string;
  method: ActivityIdentityMethod;
  confidence: number;
}

export interface ActivityFieldChange {
  field:
    | "name"
    | "activityType"
    | "wbsId"
    | "calendarId"
    | "status"
    | "baselineStartIso"
    | "baselineFinishIso"
    | "currentStartIso"
    | "currentFinishIso"
    | "forecastStartIso"
    | "forecastFinishIso"
    | "actualStartIso"
    | "actualFinishIso"
    | "originalDurationHours"
    | "remainingDurationHours"
    | "totalFloatHours"
    | "freeFloatHours"
    | "percentComplete";
  before: string | number | null;
  after: string | number | null;
  numericDelta: number | null;
}

export interface ScheduleActivityChange {
  activityId: string;
  fromActivityId: string | null;
  toActivityId: string | null;
  identityMethod:
    ActivityIdentityMethod | null;
  identityConfidence: number | null;
  kind: ScheduleActivityChangeKind;
  fieldChanges: ActivityFieldChange[];
  finishShiftDays: number | null;
  floatShiftHours: number | null;
  progressShiftPercent: number | null;
}

export interface RelationshipSignature {
  predecessorActivityId: string;
  successorActivityId: string;
  type: string;
  lagHours: number | null;
}

export interface ScheduleRevisionComparison {
  fromRevisionId: string;
  toRevisionId: string;
  addedActivityIds: string[];
  removedActivityIds: string[];
  modifiedActivityIds: string[];
  unchangedActivityIds: string[];
  activityChanges: ScheduleActivityChange[];
  addedRelationships: RelationshipSignature[];
  removedRelationships: RelationshipSignature[];
  matchedActivityCount: number;
  fromActivityCount: number;
  toActivityCount: number;
  populationMatchPercent: number | null;
  identityCoveragePercent: number | null;
  identityMatches:
    ActivityIdentityMatch[];
  ambiguousFromActivityIds:
    string[];
  ambiguousToActivityIds:
    string[];
  unmatchedFromActivityIds:
    string[];
  unmatchedToActivityIds:
    string[];
}
