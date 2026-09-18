import {
  compareScheduleRevisions,
  type ScheduleRevision,
} from "../../schedule-revision-core/src";
import type {
  ScheduleChangeReportProjection,
} from "./types";

export function buildScheduleChangeReportProjection(
  from: ScheduleRevision,
  to: ScheduleRevision,
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): ScheduleChangeReportProjection {
  const comparison = compareScheduleRevisions(from, to);

  const changedActivities =
    comparison.activityChanges
      .filter(
        (change) =>
          change.kind !== "unchanged",
      )
      .map((change) => ({
        activityId: change.activityId,
        changeKind: change.kind as
          | "added"
          | "removed"
          | "modified",
        finishShiftDays:
          change.finishShiftDays,
        floatShiftHours:
          change.floatShiftHours,
        progressShiftPercent:
          change.progressShiftPercent,
        fieldChanges: [
          ...change.fieldChanges,
        ],
      }));

  return {
    schemaVersion: "1.0",
    projectionKey: "schedule_change_report",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    fromRevisionId: comparison.fromRevisionId,
    toRevisionId: comparison.toRevisionId,
    matchedActivityCount:
      comparison.matchedActivityCount,
    populationMatchPercent:
      comparison.populationMatchPercent,
    addedActivityCount:
      comparison.addedActivityIds.length,
    removedActivityCount:
      comparison.removedActivityIds.length,
    modifiedActivityCount:
      comparison.modifiedActivityIds.length,
    unchangedActivityCount:
      comparison.unchangedActivityIds.length,
    addedRelationshipCount:
      comparison.addedRelationships.length,
    removedRelationshipCount:
      comparison.removedRelationships.length,
    addedRelationships:
      comparison.addedRelationships,
    removedRelationships:
      comparison.removedRelationships,
    changedActivities,
  };
}
