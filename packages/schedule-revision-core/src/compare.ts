import type {
  CanonicalScheduleActivity,
  CanonicalScheduleRelationship,
} from "../../schedule-analysis-core/src";
import type {
  ActivityFieldChange,
  ActivityIdentityMatch,
  ActivityIdentityMethod,
  RelationshipSignature,
  ScheduleActivityChange,
  ScheduleRevision,
  ScheduleRevisionComparison,
} from "./types";

function dateMs(
  value: string | null,
): number | null {
  if (!value) return null;
  const parsed =
    Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function finishDate(
  activity:
    CanonicalScheduleActivity,
): string | null {
  if (
    activity.status ===
      "completed" &&
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
  const beforeMs =
    dateMs(before);
  const afterMs =
    dateMs(after);
  if (
    beforeMs === null ||
    afterMs === null
  ) {
    return null;
  }
  return Number(
    (
      (afterMs -
        beforeMs) /
      86_400_000
    ).toFixed(6),
  );
}

function numericDelta(
  before: number | null,
  after: number | null,
): number | null {
  if (
    before === null ||
    after === null
  ) {
    return null;
  }
  return Number(
    (
      after -
      before
    ).toFixed(6),
  );
}

function fieldChange(
  field:
    ActivityFieldChange["field"],
  before:
    | string
    | number
    | null,
  after:
    | string
    | number
    | null,
): ActivityFieldChange | null {
  if (
    Object.is(
      before,
      after,
    )
  ) {
    return null;
  }

  return {
    field,
    before,
    after,
    numericDelta:
      typeof before ===
        "number" &&
      typeof after ===
        "number"
        ? numericDelta(
            before,
            after,
          )
        : null,
  };
}

function compareActivity(
  before:
    CanonicalScheduleActivity,
  after:
    CanonicalScheduleActivity,
  identity:
    ActivityIdentityMatch,
): ScheduleActivityChange {
  const fieldChanges = [
    fieldChange(
      "name",
      before.name,
      after.name,
    ),
    fieldChange(
      "activityType",
      before.activityType,
      after.activityType,
    ),
    fieldChange(
      "wbsId",
      before.wbsId,
      after.wbsId,
    ),
    fieldChange(
      "calendarId",
      before.calendarId,
      after.calendarId,
    ),
    fieldChange(
      "status",
      before.status,
      after.status,
    ),
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
      "freeFloatHours",
      before.freeFloatHours,
      after.freeFloatHours,
    ),
    fieldChange(
      "percentComplete",
      before.percentComplete,
      after.percentComplete,
    ),
  ].filter(
    (
      value,
    ): value is
      ActivityFieldChange =>
      value !== null,
  );

  return {
    activityId:
      after.activityId,
    fromActivityId:
      before.activityId,
    toActivityId:
      after.activityId,
    identityMethod:
      identity.method,
    identityConfidence:
      identity.confidence,
    kind:
      fieldChanges.length >
      0
        ? "modified"
        : "unchanged",
    fieldChanges,
    finishShiftDays:
      dateDeltaDays(
        finishDate(before),
        finishDate(after),
      ),
    floatShiftHours:
      numericDelta(
        before
          .totalFloatHours,
        after
          .totalFloatHours,
      ),
    progressShiftPercent:
      numericDelta(
        before
          .percentComplete,
        after
          .percentComplete,
      ),
  };
}

function relationshipSignature(
  relationship:
    CanonicalScheduleRelationship,
): RelationshipSignature {
  return {
    predecessorActivityId:
      relationship
        .predecessorActivityId,
    successorActivityId:
      relationship
        .successorActivityId,
    type:
      relationship.type,
    lagHours:
      relationship.lagHours,
  };
}

function relationshipKey(
  relationship:
    RelationshipSignature,
): string {
  return [
    relationship
      .predecessorActivityId,
    relationship
      .successorActivityId,
    relationship.type,
    relationship
      .lagHours === null
      ? ""
      : String(
          relationship
            .lagHours,
        ),
  ].join("|");
}

function norm(
  value:
    | string
    | null,
): string {
  return (
    value ?? ""
  )
    .normalize("NFKC")
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueIndex(
  activities:
    readonly CanonicalScheduleActivity[],
  key: (
    activity:
      CanonicalScheduleActivity,
  ) => string | null,
): Map<
  string,
  CanonicalScheduleActivity
> {
  const buckets =
    new Map<
      string,
      CanonicalScheduleActivity[]
    >();

  for (
    const activity of
      activities
  ) {
    const value =
      key(activity);
    if (!value) continue;
    const list =
      buckets.get(value) ??
      [];
    list.push(activity);
    buckets.set(
      value,
      list,
    );
  }

  const unique =
    new Map<
      string,
      CanonicalScheduleActivity
    >();
  for (
    const [
      value,
      list,
    ] of buckets
  ) {
    if (list.length === 1) {
      unique.set(
        value,
        list[0]!,
      );
    }
  }
  return unique;
}

function ambiguousKeys(
  activities:
    readonly CanonicalScheduleActivity[],
  key: (
    activity:
      CanonicalScheduleActivity,
  ) => string | null,
): Set<string> {
  const counts =
    new Map<string, number>();
  for (
    const activity of
      activities
  ) {
    const value =
      key(activity);
    if (!value) continue;
    counts.set(
      value,
      (counts.get(value) ??
        0) + 1,
    );
  }
  return new Set(
    [...counts.entries()]
      .filter(
        ([, count]) =>
          count > 1,
      )
      .map(([value]) => value),
  );
}

function compositeKey(
  activity:
    CanonicalScheduleActivity,
): string | null {
  const name =
    norm(activity.name);
  if (!name) return null;
  return [
    norm(activity.wbsId),
    name,
    activity.activityType,
  ].join("|");
}

function identityMatches(
  fromActivities:
    readonly CanonicalScheduleActivity[],
  toActivities:
    readonly CanonicalScheduleActivity[],
): {
  matches:
    ActivityIdentityMatch[];
  ambiguousFrom:
    Set<string>;
  ambiguousTo:
    Set<string>;
} {
  const matches:
    ActivityIdentityMatch[] =
    [];
  const matchedFrom =
    new Set<string>();
  const matchedTo =
    new Set<string>();
  const ambiguousFrom =
    new Set<string>();
  const ambiguousTo =
    new Set<string>();

  const steps: Array<{
    method:
      ActivityIdentityMethod;
    confidence: number;
    key: (
      activity:
        CanonicalScheduleActivity,
    ) => string | null;
  }> = [
    {
      method:
        "activity_id",
      confidence: 1,
      key: (activity) =>
        activity.activityId ||
        null,
    },
    {
      method:
        "native_id",
      confidence: 0.98,
      key: (activity) =>
        activity.nativeId ||
        null,
    },
    {
      method:
        "wbs_name_type",
      confidence: 0.85,
      key:
        compositeKey,
    },
  ];

  for (const step of steps) {
    const remainingFrom =
      fromActivities.filter(
        (activity) =>
          !matchedFrom.has(
            activity.activityId,
          ),
      );
    const remainingTo =
      toActivities.filter(
        (activity) =>
          !matchedTo.has(
            activity.activityId,
          ),
      );
    const fromUnique =
      uniqueIndex(
        remainingFrom,
        step.key,
      );
    const toUnique =
      uniqueIndex(
        remainingTo,
        step.key,
      );
    const fromAmbiguous =
      ambiguousKeys(
        remainingFrom,
        step.key,
      );
    const toAmbiguous =
      ambiguousKeys(
        remainingTo,
        step.key,
      );

    for (
      const key of
        new Set([
          ...fromAmbiguous,
          ...toAmbiguous,
        ])
    ) {
      const from =
        remainingFrom.filter(
          (activity) =>
            step.key(
              activity,
            ) === key,
        );
      const to =
        remainingTo.filter(
          (activity) =>
            step.key(
              activity,
            ) === key,
        );
      if (
        from.length > 1 ||
        to.length > 1
      ) {
        for (
          const activity of from
        ) {
          ambiguousFrom.add(
            activity.activityId,
          );
        }
        for (
          const activity of to
        ) {
          ambiguousTo.add(
            activity.activityId,
          );
        }
      }
    }

    for (
      const [
        key,
        before,
      ] of fromUnique
    ) {
      const after =
        toUnique.get(key);
      if (!after) continue;
      if (
        matchedFrom.has(
          before.activityId,
        ) ||
        matchedTo.has(
          after.activityId,
        )
      ) {
        continue;
      }
      matches.push({
        fromActivityId:
          before.activityId,
        toActivityId:
          after.activityId,
        method:
          step.method,
        confidence:
          step.confidence,
      });
      matchedFrom.add(
        before.activityId,
      );
      matchedTo.add(
        after.activityId,
      );
      ambiguousFrom.delete(
        before.activityId,
      );
      ambiguousTo.delete(
        after.activityId,
      );
    }
  }

  return {
    matches,
    ambiguousFrom,
    ambiguousTo,
  };
}

function translateRelationship(
  relationship:
    CanonicalScheduleRelationship,
  fromTo:
    ReadonlyMap<
      string,
      string
    >,
): RelationshipSignature {
  return {
    predecessorActivityId:
      fromTo.get(
        relationship
          .predecessorActivityId,
      ) ??
      relationship
        .predecessorActivityId,
    successorActivityId:
      fromTo.get(
        relationship
          .successorActivityId,
      ) ??
      relationship
        .successorActivityId,
    type:
      relationship.type,
    lagHours:
      relationship.lagHours,
  };
}

export function compareScheduleRevisions(
  from: ScheduleRevision,
  to: ScheduleRevision,
): ScheduleRevisionComparison {
  const identity =
    identityMatches(
      from.model.activities,
      to.model.activities,
    );
  const fromById =
    new Map(
      from.model.activities.map(
        (activity) => [
          activity.activityId,
          activity,
        ],
      ),
    );
  const toById =
    new Map(
      to.model.activities.map(
        (activity) => [
          activity.activityId,
          activity,
        ],
      ),
    );
  const matchedFrom =
    new Set(
      identity.matches.map(
        (match) =>
          match.fromActivityId,
      ),
    );
  const matchedTo =
    new Set(
      identity.matches.map(
        (match) =>
          match.toActivityId,
      ),
    );

  const changes:
    ScheduleActivityChange[] =
    [];
  const modifiedActivityIds:
    string[] = [];
  const unchangedActivityIds:
    string[] = [];

  for (
    const match of
      identity.matches
  ) {
    const before =
      fromById.get(
        match.fromActivityId,
      );
    const after =
      toById.get(
        match.toActivityId,
      );
    if (
      !before ||
      !after
    ) {
      continue;
    }
    const change =
      compareActivity(
        before,
        after,
        match,
      );
    changes.push(change);
    if (
      change.kind ===
      "modified"
    ) {
      modifiedActivityIds.push(
        change.activityId,
      );
    } else {
      unchangedActivityIds.push(
        change.activityId,
      );
    }
  }

  const removed =
    from.model.activities
      .filter(
        (activity) =>
          !matchedFrom.has(
            activity.activityId,
          ),
      );
  const added =
    to.model.activities
      .filter(
        (activity) =>
          !matchedTo.has(
            activity.activityId,
          ),
      );

  for (const activity of removed) {
    changes.push({
      activityId:
        activity.activityId,
      fromActivityId:
        activity.activityId,
      toActivityId: null,
      identityMethod: null,
      identityConfidence:
        null,
      kind: "removed",
      fieldChanges: [],
      finishShiftDays: null,
      floatShiftHours: null,
      progressShiftPercent:
        null,
    });
  }

  for (const activity of added) {
    changes.push({
      activityId:
        activity.activityId,
      fromActivityId: null,
      toActivityId:
        activity.activityId,
      identityMethod: null,
      identityConfidence:
        null,
      kind: "added",
      fieldChanges: [],
      finishShiftDays: null,
      floatShiftHours: null,
      progressShiftPercent:
        null,
    });
  }

  const fromTo =
    new Map(
      identity.matches.map(
        (match) => [
          match.fromActivityId,
          match.toActivityId,
        ],
      ),
    );

  const fromRelationships =
    new Map(
      from.model.relationships
        .filter(
          (relationship) =>
            !relationship.external,
        )
        .map(
          (relationship) => {
            const signature =
              translateRelationship(
                relationship,
                fromTo,
              );
            return [
              relationshipKey(
                signature,
              ),
              signature,
            ];
          },
        ),
    );

  const toRelationships =
    new Map(
      to.model.relationships
        .filter(
          (relationship) =>
            !relationship.external,
        )
        .map(
          (relationship) => {
            const signature =
              relationshipSignature(
                relationship,
              );
            return [
              relationshipKey(
                signature,
              ),
              signature,
            ];
          },
        ),
    );

  const addedRelationships =
    [
      ...toRelationships.entries(),
    ]
      .filter(
        ([key]) =>
          !fromRelationships.has(
            key,
          ),
      )
      .map(
        ([, signature]) =>
          signature,
      );

  const removedRelationships =
    [
      ...fromRelationships.entries(),
    ]
      .filter(
        ([key]) =>
          !toRelationships.has(
            key,
          ),
      )
      .map(
        ([, signature]) =>
          signature,
      );

  const denominator =
    Math.max(
      from.model.activities
        .length,
      to.model.activities
        .length,
    );
  const matchedActivityCount =
    identity.matches.length;
  const populationMatchPercent =
    denominator === 0
      ? null
      : Number(
          (
            (
              matchedActivityCount /
              denominator
            ) *
            100
          ).toFixed(4),
        );

  return {
    fromRevisionId:
      from.revisionId,
    toRevisionId:
      to.revisionId,
    addedActivityIds:
      added
        .map(
          (activity) =>
            activity.activityId,
        )
        .sort(),
    removedActivityIds:
      removed
        .map(
          (activity) =>
            activity.activityId,
        )
        .sort(),
    modifiedActivityIds:
      modifiedActivityIds
        .sort(),
    unchangedActivityIds:
      unchangedActivityIds
        .sort(),
    activityChanges:
      changes.sort(
        (a, b) =>
          a.activityId.localeCompare(
            b.activityId,
            undefined,
            {
              numeric: true,
            },
          ),
      ),
    addedRelationships,
    removedRelationships,
    matchedActivityCount,
    fromActivityCount:
      from.model.activities
        .length,
    toActivityCount:
      to.model.activities
        .length,
    populationMatchPercent,
    identityCoveragePercent:
      populationMatchPercent,
    identityMatches:
      identity.matches,
    ambiguousFromActivityIds:
      [
        ...identity
          .ambiguousFrom,
      ].sort(),
    ambiguousToActivityIds:
      [
        ...identity
          .ambiguousTo,
      ].sort(),
    unmatchedFromActivityIds:
      removed
        .map(
          (activity) =>
            activity.activityId,
        )
        .sort(),
    unmatchedToActivityIds:
      added
        .map(
          (activity) =>
            activity.activityId,
        )
        .sort(),
  };
}
