import {naturalCompare} from '../../shared/src/natural-order';
import { parseScheduleTime } from "../../schedule-analysis-core/src";
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
    parseScheduleTime(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export function scheduleActivityFinish(
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
  sourceInstant: typeof dateMs,
): number | null {
  const beforeMs =
    sourceInstant(before);
  const afterMs =
    sourceInstant(after);
  if (
    beforeMs === null ||
    afterMs === null
  ) {
    return null;
  }
  // Both instants are finite here; an equal pair is exactly zero movement.
  if (beforeMs === afterMs) return 0;
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
  // Equal finite values give exactly zero; skip the string round trip.
  if (before === after && Number.isFinite(before)) return 0;
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
  sourceInstant: typeof dateMs,
): ScheduleActivityChange {
  // Same fields in the same order as before; only differing fields allocate.
  const fieldChanges: ActivityFieldChange[] = [];
  let change: ActivityFieldChange | null;
  if ((change = fieldChange("name", before.name, after.name))) fieldChanges.push(change);
  if ((change = fieldChange("activityType", before.activityType, after.activityType))) fieldChanges.push(change);
  if ((change = fieldChange("wbsId", before.wbsId, after.wbsId))) fieldChanges.push(change);
  if ((change = fieldChange("calendarId", before.calendarId, after.calendarId))) fieldChanges.push(change);
  if ((change = fieldChange("status", before.status, after.status))) fieldChanges.push(change);
  if ((change = fieldChange("baselineStartIso", before.baselineStartIso, after.baselineStartIso))) fieldChanges.push(change);
  if ((change = fieldChange("baselineFinishIso", before.baselineFinishIso, after.baselineFinishIso))) fieldChanges.push(change);
  if ((change = fieldChange("currentStartIso", before.currentStartIso, after.currentStartIso))) fieldChanges.push(change);
  if ((change = fieldChange("currentFinishIso", before.currentFinishIso, after.currentFinishIso))) fieldChanges.push(change);
  if ((change = fieldChange("forecastStartIso", before.forecastStartIso, after.forecastStartIso))) fieldChanges.push(change);
  if ((change = fieldChange("forecastFinishIso", before.forecastFinishIso, after.forecastFinishIso))) fieldChanges.push(change);
  if ((change = fieldChange("actualStartIso", before.actualStartIso, after.actualStartIso))) fieldChanges.push(change);
  if ((change = fieldChange("actualFinishIso", before.actualFinishIso, after.actualFinishIso))) fieldChanges.push(change);
  if ((change = fieldChange("originalDurationHours", before.originalDurationHours, after.originalDurationHours))) fieldChanges.push(change);
  if ((change = fieldChange("remainingDurationHours", before.remainingDurationHours, after.remainingDurationHours))) fieldChanges.push(change);
  if ((change = fieldChange("totalFloatHours", before.totalFloatHours, after.totalFloatHours))) fieldChanges.push(change);
  if ((change = fieldChange("freeFloatHours", before.freeFloatHours, after.freeFloatHours))) fieldChanges.push(change);
  if ((change = fieldChange("percentComplete", before.percentComplete, after.percentComplete))) fieldChanges.push(change);

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
        scheduleActivityFinish(before),
        scheduleActivityFinish(after),
        sourceInstant,
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
  // Same text as the former [..].join("|"): join writes null/undefined as "".
  return (relationship.predecessorActivityId ?? "") + "|" +
    (relationship.successorActivityId ?? "") + "|" +
    (relationship.type ?? "") + "|" +
    (relationship.lagHours === null ? "" : String(relationship.lagHours));
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

function identityIndex(
  activities:
    readonly CanonicalScheduleActivity[],
  key: (
    activity:
      CanonicalScheduleActivity,
  ) => string | null,
) {
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
  return {unique,buckets,ambiguous:new Set([...buckets].filter(([,rows])=>rows.length>1).map(([value])=>value))};
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

type IdentityFields=Pick<CanonicalScheduleActivity,'activityId'|'nativeId'|'wbsId'|'name'|'activityType'>;
const identityFields=(a:CanonicalScheduleActivity):IdentityFields=>({activityId:a.activityId,nativeId:a.nativeId,wbsId:a.wbsId,name:a.name,activityType:a.activityType});
type IdentityResult=ReturnType<typeof calculateRevisionActivityCorrespondence>;
const correspondenceCache=new WeakMap<readonly CanonicalScheduleActivity[],WeakMap<readonly CanonicalScheduleActivity[],{from:IdentityFields[];to:IdentityFields[];value:IdentityResult}>>();
function identityFieldsUnchanged(activities:readonly CanonicalScheduleActivity[],saved:IdentityFields[]){
  return activities.length===saved.length&&activities.every((a,i)=>{const s=saved[i]!;return a.activityId===s.activityId&&a.nativeId===s.nativeId&&a.wbsId===s.wbsId&&a.name===s.name&&a.activityType===s.activityType;});
}
/** Identity matching is shared by several views. Validate every identity input
 * before reuse; neither mutable activities nor a caller's edited result can
 * preserve an obsolete match. Numeric/date changes are compared separately. */
export function resolveRevisionActivityCorrespondence(fromActivities:readonly CanonicalScheduleActivity[],toActivities:readonly CanonicalScheduleActivity[]):IdentityResult{
  let targets=correspondenceCache.get(fromActivities);if(!targets){targets=new WeakMap();correspondenceCache.set(fromActivities,targets);}
  let saved=targets.get(toActivities);
  if(!saved||!identityFieldsUnchanged(fromActivities,saved.from)||!identityFieldsUnchanged(toActivities,saved.to)){
    saved={from:fromActivities.map(identityFields),to:toActivities.map(identityFields),value:calculateRevisionActivityCorrespondence(fromActivities,toActivities)};targets.set(toActivities,saved);
  }
  return {matches:saved.value.matches.map(m=>({...m})),ambiguousFrom:new Set(saved.value.ambiguousFrom),ambiguousTo:new Set(saved.value.ambiguousTo)};
}

function calculateRevisionActivityCorrespondence(
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
  // Normal programme updates retain stable activity IDs. When both revisions
  // carry the same unique IDs in the same source order, the full multi-index
  // identity matcher cannot produce a different answer. Return that exact
  // activity-id correspondence directly and reserve the more expensive native
  // ID / WBS-name fallback for genuinely changed populations.
  if(fromActivities.length===toActivities.length){
    const seen=new Set<string>();
    let exact=true;
    for(let i=0;i<fromActivities.length;i++){
      const from=fromActivities[i]!,to=toActivities[i]!,id=from.activityId;
      if(!id||id!==to.activityId||seen.has(id)){exact=false;break;}
      seen.add(id);
    }
    if(exact){
      return {
        matches:fromActivities.map(activity=>({
          fromActivityId:activity.activityId,
          toActivityId:activity.activityId,
          method:"activity_id" as const,
          confidence:1,
        })),
        ambiguousFrom:new Set<string>(),
        ambiguousTo:new Set<string>(),
      };
    }
  }

  // Controlled workfronts and portfolio scopes are often a strict subset of
  // the current programme. If every target has an unambiguous identical ID,
  // the existing first-priority activity_id identity rule yields exactly
  // these matches; avoid rebuilding three global fallback indexes per group.
  if(toActivities.length>0&&fromActivities.length>=toActivities.length){
    const fromIds=new Set<string>();
    let uniqueFrom=true;
    for(const row of fromActivities){if(!row.activityId||fromIds.has(row.activityId)){uniqueFrom=false;break;}fromIds.add(row.activityId);}
    if(uniqueFrom){
      const seenTo=new Set<string>();
      let allExact=true;
      for(const row of toActivities){
        if(!row.activityId||seenTo.has(row.activityId)||!fromIds.has(row.activityId)){allExact=false;break;}
        seenTo.add(row.activityId);
      }
      if(allExact)return {matches:toActivities.map(row=>({
        fromActivityId:row.activityId,toActivityId:row.activityId,
        method:'activity_id' as const,confidence:1,
      })),ambiguousFrom:new Set<string>(),ambiguousTo:new Set<string>()};
    }
  }

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

  // Downstream comparison addresses records by activityId. A native-ID or
  // name fallback cannot safely recover a duplicated activityId: a Map lookup
  // would silently substitute a different source row with that same code.
  const duplicateFrom=identityIndex(fromActivities,a=>a.activityId).ambiguous;
  const duplicateTo=identityIndex(toActivities,a=>a.activityId).ambiguous;
  const duplicatedIds=new Set([...duplicateFrom,...duplicateTo]);
  for(const row of fromActivities)if(duplicatedIds.has(row.activityId))ambiguousFrom.add(row.activityId);
  for(const row of toActivities)if(duplicatedIds.has(row.activityId))ambiguousTo.add(row.activityId);

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
    if(matchedFrom.size===fromActivities.length&&matchedTo.size===toActivities.length)break;
    const remainingFrom =
      fromActivities.filter(
        (activity) =>
          !duplicatedIds.has(activity.activityId)&&!matchedFrom.has(
            activity.activityId,
          ),
      );
    const remainingTo =
      toActivities.filter(
        (activity) =>
          !duplicatedIds.has(activity.activityId)&&!matchedTo.has(
            activity.activityId,
          ),
      );
    const fromIndex =
      identityIndex(
        remainingFrom,
        step.key,
      );
    const toIndex =
      identityIndex(
        remainingTo,
        step.key,
      );
    const fromUnique=fromIndex.unique,toUnique=toIndex.unique;
    const fromAmbiguous=fromIndex.ambiguous,toAmbiguous=toIndex.ambiguous;

    for (
      const key of
        new Set([
          ...fromAmbiguous,
          ...toAmbiguous,
        ])
    ) {
      const from=fromIndex.buckets.get(key)??[];
      const to=toIndex.buckets.get(key)??[];
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
    resolveRevisionActivityCorrespondence(
      from.model.activities,
      to.model.activities,
    );
  // One comparison owns its date interpretation. Repeated source finish
  // dates are parsed only once across the entire original activity population;
  // the cache cannot outlive this pair of revisions or conceal later edits.
  // Keep invalid/null source dates distinct from a valid zero movement.
  const sourceInstants = new Map<string,number|null>();
  const sourceInstant = (iso: string|null):number|null => {
    if (iso===null) return null;
    if (sourceInstants.has(iso)) return sourceInstants.get(iso)!;
    const read = dateMs(iso);
    sourceInstants.set(iso,read);
    return read;
  };
  // Matched activity IDs are always unique in their own revision (duplicated
  // IDs never match). When the matches line up one-to-one with both source
  // arrays, position i is exactly the record an ID lookup returns and no
  // activity is unmatched, so the lookup maps and match sets are not needed.
  const fromActivities=from.model.activities,toActivities=to.model.activities;
  const aligned=identity.matches.length===fromActivities.length&&
    identity.matches.length===toActivities.length&&
    identity.matches.every((match,index)=>Boolean(match.fromActivityId)&&
      match.fromActivityId===fromActivities[index]!.activityId&&
      Boolean(match.toActivityId)&&
      match.toActivityId===toActivities[index]!.activityId);
  const fromById =
    aligned ? null : new Map(
      from.model.activities.map(
        (activity) => [
          activity.activityId,
          activity,
        ],
      ),
    );
  const toById =
    aligned ? null : new Map(
      to.model.activities.map(
        (activity) => [
          activity.activityId,
          activity,
        ],
      ),
    );
  const matchedFrom =
    aligned ? null : new Set(
      identity.matches.map(
        (match) =>
          match.fromActivityId,
      ),
    );
  const matchedTo =
    aligned ? null : new Set(
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
    let matchIndex = 0;
    matchIndex < identity.matches.length;
    matchIndex += 1
  ) {
    const match = identity.matches[matchIndex]!;
    const before =
      fromById ? fromById.get(
        match.fromActivityId,
      ) : fromActivities[matchIndex];
    const after =
      toById ? toById.get(
        match.toActivityId,
      ) : toActivities[matchIndex];
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
        sourceInstant,
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
    !matchedFrom ? [] : from.model.activities
      .filter(
        (activity) =>
          !matchedFrom.has(
            activity.activityId,
          ),
      );
  const added =
    !matchedTo ? [] : to.model.activities
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

  // When every match keeps its own activity ID, translating a predecessor or
  // successor through the match map returns that same ID, exactly as the
  // untranslated signature does.
  const sameIds=identity.matches.every(match=>match.fromActivityId===match.toActivityId);
  const fromTo =
    sameIds ? null : new Map(
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
              fromTo ? translateRelationship(
                relationship,
                fromTo,
              ) : relationshipSignature(relationship);
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
          naturalCompare(a.activityId, b.activityId),
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
