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

export interface ActivityFieldChange {
  field:
    | "name"
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
    | "percentComplete";
  before: string | number | null;
  after: string | number | null;
  numericDelta: number | null;
}

export interface ScheduleActivityChange {
  activityId: string;
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
}
