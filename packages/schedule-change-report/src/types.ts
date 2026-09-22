import type {
  ActivityFieldChange,
  RelationshipSignature,
} from "../../schedule-revision-core/src";

export interface ScheduleChangeActivityRow {
  activityId: string;
  fromActivityId?: string | null; toActivityId?: string | null;
  identityMethod?: string | null; identityConfidence?: number | null;
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
  executionModifiedActivityCount?: number; excludedModifiedActivityCount?: number;
  populationBasis?: "source_records";
  fromActivityCount?: number; toActivityCount?: number;
  changeCategories?: Array<{ category: string; activityCount: number }>;
  modifiedRelationships?: Array<{ before: RelationshipSignature; after: RelationshipSignature }>;
  grossRelationshipChurn?: number; netRelationshipCountChange?: number;
  identityCoveragePercent?: number | null;
  ambiguousFromActivityIds?: string[]; ambiguousToActivityIds?: string[];
  baselineMutationActivityCount?: number;
  diagnostics: string[];
}
