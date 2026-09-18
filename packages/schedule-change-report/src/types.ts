import type {
  ActivityFieldChange,
  RelationshipSignature,
} from "../../schedule-revision-core/src";

export interface ScheduleChangeActivityRow {
  activityId: string;
  changeKind: "added" | "removed" | "modified";
  finishShiftDays: number | null;
  floatShiftHours: number | null;
  progressShiftPercent: number | null;
  fieldChanges: ActivityFieldChange[];
}

export interface ScheduleChangeReportProjection {
  schemaVersion: "1.0";
  projectionKey: "schedule_change_report";
  generatedAt: string;
  producerVersion: string;
  state: "ready" | "insufficient_history";
  fromRevisionId: string | null;
  toRevisionId: string | null;
  matchedActivityCount: number;
  populationMatchPercent: number | null;
  addedActivityCount: number;
  removedActivityCount: number;
  modifiedActivityCount: number;
  unchangedActivityCount: number;
  addedRelationshipCount: number;
  removedRelationshipCount: number;
  addedRelationships: RelationshipSignature[];
  removedRelationships: RelationshipSignature[];
  changedActivities: ScheduleChangeActivityRow[];
  diagnostics: string[];
}
