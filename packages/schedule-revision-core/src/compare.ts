import type {
  CanonicalScheduleActivity,
  CanonicalScheduleRelationship,
} from "../../schedule-analysis-core/src";
import type {
  ActivityFieldChange,
  RelationshipSignature,
  ScheduleActivityChange,
  ScheduleRevision,
  ScheduleRevisionComparison,
} from "./types";

function dateMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finishDate(
  activity: CanonicalScheduleActivity,
): string | null {
  if (
    activity.status === "completed" &&
    activity.actualFinishIso
  ) {
    return activity.actualFinishIso;
  }

  return (
    activity.forecastFinishIso ??
    activity.currentFinishIso ??
    activity.actualFinishIso
  );
}

function dateDeltaDays(
  before: string | null,
  after: string | null,
): number | null {
  const beforeMs = dateMs(before);
  const afterMs = dateMs(after);
  if (beforeMs === null || afterMs === null) {
    return null;
  }
  return Number(
    ((afterMs - beforeMs) / 86_400_000).toFixed(6),
  );
}

function numericDelta(
  before: number | null,
  after: number | null,
): number | null {
  if (before === null || after === null) return null;
  return Number((after - before).toFixed(6));
}

function fieldChange(
  field: ActivityFieldChange["field"],
  before: string | number | null,
  after: string | number | null,
): ActivityFieldChange | null {
  if (Object.is(before, after)) return null;

  return {
    field,
    before,
    after,
    numericDelta:
      typeof before === "number" &&
      typeof after === "number"
        ? numericDelta(before, after)
        : null,
  };
}

function compareActivity(
  before: CanonicalScheduleActivity,
  after: CanonicalScheduleActivity,
): ScheduleActivityChange {
  const fieldChanges = [
    fieldChange("name", before.name, after.name),
    fieldChange("wbsId", before.wbsId, after.wbsId),
    fieldChange("calendarId", before.calendarId, after.calendarId),
    fieldChange("status", before.status, after.status),
    fieldChange(
      "baselineStartIso",
      before.baselineStartIso,
      after.baselineStartIso,
    ),
    fieldChange(
      "baselineFinishIso",
      before.baselineFinishIso,
      after.baselineFinishIso,
    ),
    fieldChange(
      "currentStartIso",
      before.currentStartIso,
      after.currentStartIso,
    ),
    fieldChange(
      "currentFinishIso",
      before.currentFinishIso,
      after.currentFinishIso,
    ),
    fieldChange(
      "forecastStartIso",
      before.forecastStartIso,
      after.forecastStartIso,
    ),
    fieldChange(
      "forecastFinishIso",
      before.forecastFinishIso,
      after.forecastFinishIso,
    ),
    fieldChange(
      "actualStartIso",
      before.actualStartIso,
      after.actualStartIso,
    ),
    fieldChange(
      "actualFinishIso",
      before.actualFinishIso,
      after.actualFinishIso,
    ),
    fieldChange(
      "originalDurationHours",
      before.originalDurationHours,
      after.originalDurationHours,
    ),
    fieldChange(
      "remainingDurationHours",
      before.remainingDurationHours,
      after.remainingDurationHours,
    ),
    fieldChange(
      "totalFloatHours",
      before.totalFloatHours,
      after.totalFloatHours,
    ),
    fieldChange(
      "percentComplete",
      before.percentComplete,
      after.percentComplete,
    ),
  ].filter(
    (value): value is ActivityFieldChange =>
      value !== null,
  );

  return {
    activityId: after.activityId,
    kind:
      fieldChanges.length > 0
        ? "modified"
        : "unchanged",
    fieldChanges,
    finishShiftDays: dateDeltaDays(
      finishDate(before),
      finishDate(after),
    ),
    floatShiftHours: numericDelta(
      before.totalFloatHours,
      after.totalFloatHours,
    ),
    progressShiftPercent: numericDelta(
      before.percentComplete,
      after.percentComplete,
    ),
  };
}

function relationshipSignature(
  relationship: CanonicalScheduleRelationship,
): RelationshipSignature {
  return {
    predecessorActivityId:
      relationship.predecessorActivityId,
    successorActivityId:
      relationship.successorActivityId,
    type: relationship.type,
    lagHours: relationship.lagHours,
  };
}

function relationshipKey(
  relationship: RelationshipSignature,
): string {
  return [
    relationship.predecessorActivityId,
    relationship.successorActivityId,
    relationship.type,
    relationship.lagHours === null
      ? ""
      : String(relationship.lagHours),
  ].join("|");
}

export function compareScheduleRevisions(
  from: ScheduleRevision,
  to: ScheduleRevision,
): ScheduleRevisionComparison {
  const fromMap = new Map(
    from.model.activities.map((activity) => [
      activity.activityId,
      activity,
    ]),
  );
  const toMap = new Map(
    to.model.activities.map((activity) => [
      activity.activityId,
      activity,
    ]),
  );

  const allIds = [
    ...new Set([
      ...fromMap.keys(),
      ...toMap.keys(),
    ]),
  ].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  const changes: ScheduleActivityChange[] = [];
  const addedActivityIds: string[] = [];
  const removedActivityIds: string[] = [];
  const modifiedActivityIds: string[] = [];
  const unchangedActivityIds: string[] = [];
  let matchedActivityCount = 0;

  for (const activityId of allIds) {
    const before = fromMap.get(activityId);
    const after = toMap.get(activityId);

    if (!before && after) {
      addedActivityIds.push(activityId);
      changes.push({
        activityId,
        kind: "added",
        fieldChanges: [],
        finishShiftDays: null,
        floatShiftHours: null,
        progressShiftPercent: null,
      });
      continue;
    }

    if (before && !after) {
      removedActivityIds.push(activityId);
      changes.push({
        activityId,
        kind: "removed",
        fieldChanges: [],
        finishShiftDays: null,
        floatShiftHours: null,
        progressShiftPercent: null,
      });
      continue;
    }

    if (!before || !after) continue;

    matchedActivityCount += 1;
    const change = compareActivity(before, after);
    changes.push(change);

    if (change.kind === "modified") {
      modifiedActivityIds.push(activityId);
    } else {
      unchangedActivityIds.push(activityId);
    }
  }

  const fromRelationships = new Map(
    from.model.relationships
      .filter((relationship) => !relationship.external)
      .map((relationship) => {
        const signature =
          relationshipSignature(relationship);
        return [
          relationshipKey(signature),
          signature,
        ];
      }),
  );
  const toRelationships = new Map(
    to.model.relationships
      .filter((relationship) => !relationship.external)
      .map((relationship) => {
        const signature =
          relationshipSignature(relationship);
        return [
          relationshipKey(signature),
          signature,
        ];
      }),
  );

  const addedRelationships = [
    ...toRelationships.entries(),
  ]
    .filter(([key]) => !fromRelationships.has(key))
    .map(([, signature]) => signature);
  const removedRelationships = [
    ...fromRelationships.entries(),
  ]
    .filter(([key]) => !toRelationships.has(key))
    .map(([, signature]) => signature);

  return {
    fromRevisionId: from.revisionId,
    toRevisionId: to.revisionId,
    addedActivityIds,
    removedActivityIds,
    modifiedActivityIds,
    unchangedActivityIds,
    activityChanges: changes,
    addedRelationships,
    removedRelationships,
    matchedActivityCount,
    fromActivityCount:
      from.model.activities.length,
    toActivityCount: to.model.activities.length,
    populationMatchPercent:
      Math.max(
        from.model.activities.length,
        to.model.activities.length,
      ) === 0
        ? null
        : Number(
            (
              (matchedActivityCount /
                Math.max(
                  from.model.activities.length,
                  to.model.activities.length,
                )) *
              100
            ).toFixed(4),
          ),
  };
}
