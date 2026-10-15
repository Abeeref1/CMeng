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
  matchedActivityCount: number | null;
  populationMatchPercent: number | null;
  addedActivityCount: number | null;
  removedActivityCount: number | null;
  modifiedActivityCount: number | null;
  unchangedActivityCount: number | null;
  addedRelationshipCount: number | null;
  removedRelationshipCount: number | null;
  addedRelationships: RelationshipSignature[];
  removedRelationships: RelationshipSignature[];
  changedActivities: ScheduleChangeActivityRow[];
  changeSummary?: {
    total:number;
    dominantFinishMovement:{days:number;count:number}|null;
    largestFloatMovements:Array<{activityId:string;floatShiftHours:number}>;
  };
  executionModifiedActivityCount?: number; excludedModifiedActivityCount?: number;
  populationBasis?: "source_records";
  fromActivityCount?: number; toActivityCount?: number;
  changeCategories?: Array<{ category: string; activityCount: number }>;
  modifiedRelationships?: Array<{ before: RelationshipSignature; after: RelationshipSignature }>;
  grossRelationshipChurn?: number; netRelationshipCountChange?: number;
  identityCoveragePercent?: number | null;
  ambiguousFromActivityIds?: string[]; ambiguousToActivityIds?: string[];
  baselineMutationActivityCount?: number;
  sourceTargetDateChangeCount?: number;
  sourceTargetEqualsCurrentCount?: number;
  targetDateInterpretation?: string;
  finishMovementAnalysis?: {
    fromLabel:string;toLabel:string;population:import('../../truth-kernel/src').PopulationContract;
    maximumDays:number|null;maximumCount:number|null;maximumPercent:number|null;sourcePairVerifiedCount:number;
    maximumRows:Array<{activityId:string;fromFinishIso:string;toFinishIso:string;movementDays:number}>;
    causation:'not_established';
  };
  engineeringChanges?:{originalDurationActivityIds:string[];remainingDurationActivityIds:string[];constraintActivityIds:string[];calendarActivityIds:string[];lagChangeCount:number;relationshipTypeChangeCount:number;fromCompletionIso:string|null;toCompletionIso:string|null;completionMovementDays:number|null;updateGapCalendarDays:number|null};
  diagnostics: string[];
}
