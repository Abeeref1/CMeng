import {
  analyzeScheduleGraph,
  activityPopulation,
  type CanonicalRelationshipType,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import {
  addWorkingHours,
  isoInstant,
  nextWorkingInstant,
  parseScheduleInstant,
  previousWorkingInstant,
  resolveWorkingCalendar,
  subtractWorkingHours,
  workingHoursBetween,
  type WorkingCalendarResolution,
} from "./calendar";
import {
  resolveActivityDuration,
} from "./duration";
import {activityConstraints} from './constraints';
import {
  DEFAULT_CPM_CONFIG,
  type CpmActivityResult,
  type CpmConfig,
  type CpmResult,
} from "./types";

interface ActivityContext {
  activity: CanonicalScheduleActivity;
  calendar: WorkingCalendarResolution | null;
  durationHours: number | null;
  durationMethod: string | null;
  diagnostics: string[];
}

interface ForwardState {
  earlyStartMs: number | null;
  earlyFinishMs: number | null;
}

interface EffectiveRelationship {
  relationshipId: string;
  predecessorActivityId: string;
  successorActivityId: string;
  type: Exclude<
    CanonicalRelationshipType,
    "unknown"
  >;
  lagHours: number;
  diagnostics: string[];
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [...new Set(values)].sort();
}

function mergeConfig(
  input?: Partial<CpmConfig>,
): CpmConfig {
  return {
    ...DEFAULT_CPM_CONFIG,
    ...input,
  };
}

function maxDefined(
  values: readonly (number | null)[],
): number | null {
  const known = values.filter(
    (value): value is number =>
      value !== null,
  );
  return known.length === 0
    ? null
    : known.reduce((a,b)=>Math.max(a,b),-Infinity);
}

function minDefined(
  values: readonly (number | null)[],
): number | null {
  const known = values.filter(
    (value): value is number =>
      value !== null,
  );
  return known.length === 0
    ? null
    : known.reduce((a,b)=>Math.min(a,b),Infinity);
}

function earliestModelDate(
  model: CanonicalScheduleModel,
): number | null {
  const values = model.activities.flatMap(
    (activity) => [
      parseScheduleInstant(
        activity.actualStartIso,
      ),
      parseScheduleInstant(
        activity.currentStartIso,
      ),
      parseScheduleInstant(
        activity.forecastStartIso,
      ),
      parseScheduleInstant(
        activity.baselineStartIso,
      ),
    ],
  );

  return minDefined(values);
}

function requiredFinishInstant(
  value: string | null | undefined,
): number | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const nextDay = Date.parse(
      value + "T00:00:00Z",
    );
    return Number.isFinite(nextDay)
      ? nextDay + 86_400_000
      : null;
  }

  return parseScheduleInstant(value);
}

function effectiveRelationship(
  relationship: CanonicalScheduleModel["relationships"][number],
  config: CpmConfig,
  assumptions: string[],
): EffectiveRelationship | null {
  let type = relationship.type;
  const diagnostics = [
    ...relationship.diagnostics,
  ];

  if (type === "unknown") {
    if (
      !config.assumeUnknownRelationshipTypeFs
    ) {
      diagnostics.push(
        "CPM_RELATIONSHIP_TYPE_UNRESOLVED",
      );
      return null;
    }

    type = "FS";
    assumptions.push(
      "UNKNOWN_RELATIONSHIP_TYPE_ASSUMED_FS",
    );
    diagnostics.push(
      "CPM_RELATIONSHIP_TYPE_ASSUMED_FS",
    );
  }

  let lagHours = relationship.lagHours;

  if (lagHours === null) {
    if (!config.assumeMissingLagZero) {
      diagnostics.push(
        "CPM_RELATIONSHIP_LAG_UNRESOLVED",
      );
      return null;
    }

    lagHours = 0;
    assumptions.push(
      "MISSING_RELATIONSHIP_LAG_ASSUMED_ZERO",
    );
    diagnostics.push(
      "CPM_RELATIONSHIP_LAG_ASSUMED_ZERO",
    );
  }

  return {
    relationshipId: relationship.relationshipId,
    predecessorActivityId:
      relationship.predecessorActivityId,
    successorActivityId:
      relationship.successorActivityId,
    type,
    lagHours,
    diagnostics,
  };
}

function shiftByLag(
  calendar: WorkingCalendarResolution,
  anchorMs: number,
  lagHours: number,
): number {
  return addWorkingHours(
    calendar.calendar,
    anchorMs,
    lagHours,
  );
}

function forwardConstraintStart(
  relation: EffectiveRelationship,
  predecessorStartMs: number | null,
  predecessorFinishMs: number | null,
  successorDurationHours: number,
  successorCalendar: WorkingCalendarResolution,
): number | null {
  switch (relation.type) {
    case "FS":
      return predecessorFinishMs === null
        ? null
        : shiftByLag(
            successorCalendar,
            predecessorFinishMs,
            relation.lagHours,
          );
    case "SS":
      return predecessorStartMs === null
        ? null
        : shiftByLag(
            successorCalendar,
            predecessorStartMs,
            relation.lagHours,
          );
    case "FF": {
      if (
        predecessorFinishMs === null
      ) {
        return null;
      }
      const requiredFinish = shiftByLag(
        successorCalendar,
        predecessorFinishMs,
        relation.lagHours,
      );
      return subtractWorkingHours(
        successorCalendar.calendar,
        requiredFinish,
        successorDurationHours,
      );
    }
    case "SF": {
      if (
        predecessorStartMs === null
      ) {
        return null;
      }
      const requiredFinish = shiftByLag(
        successorCalendar,
        predecessorStartMs,
        relation.lagHours,
      );
      return subtractWorkingHours(
        successorCalendar.calendar,
        requiredFinish,
        successorDurationHours,
      );
    }
  }
}

function backwardConstraintFinish(
  relation: EffectiveRelationship,
  successorLateStartMs: number | null,
  successorLateFinishMs: number | null,
  predecessorDurationHours: number,
  predecessorCalendar: WorkingCalendarResolution,
  successorCalendar: WorkingCalendarResolution,
): {finish: number; start: number | null} | null {
  const endpoint = relation.type === 'FS' || relation.type === 'SS'
    ? successorLateStartMs : successorLateFinishMs;
  if (endpoint === null) return null;
  // The reverse pass must invert the SAME lag calendar used forward. A
  // negative lag can admit every instant in a nonworking gap, up to its next
  // opening. Preserve that bound rather than inventing negative float.
  const reversed = relation.lagHours === 0 ? endpoint : addWorkingHours(
    successorCalendar.calendar, endpoint, -relation.lagHours,
  );
  const bound = relation.lagHours < 0
    ? nextWorkingInstant(successorCalendar.calendar, reversed) : reversed;
  if (relation.type === 'FS' || relation.type === 'FF') {
    return {finish: bound, start: null};
  }
  // For an SS/SF start deadline strictly *inside* an off-shift gap, the
  // previous closing boundary is not the final feasible start slot: go back
  // into the last workable hour. At a deadline exactly ON that closing
  // instant, independent slot enumeration permits the boundary itself
  // (subsequent work resumes at the next opening). Rewinding that exact
  // instant incorrectly loses one hour of float in mixed-lag networks.
  const closing=nextWorkingInstant(predecessorCalendar.calendar,bound)>bound;
  const last=closing?previousWorkingInstant(predecessorCalendar.calendar,bound):bound;
  const lastClosesShift=nextWorkingInstant(predecessorCalendar.calendar,last)>last;
  const strictlyAfterClosing=last<bound;
  // With an explicit signed lag, the successor calendar owns the lag
  // reversal. Moving this predecessor start one extra working hour changes
  // that lag's feasible boundary and invents negative/one-hour float.
  // A zero-lag start link instead requires a genuine working start before a
  // successor event occurring in the predecessor's closed shift.
  const zeroLagStartLink=relation.lagHours===0;
  const start=zeroLagStartLink&&closing&&strictlyAfterClosing&&lastClosesShift&&predecessorDurationHours>0
    ?subtractWorkingHours(predecessorCalendar.calendar,last,Math.min(1,predecessorDurationHours))
    :last;
  return {start, finish: addWorkingHours(
    predecessorCalendar.calendar, start, predecessorDurationHours,
  )};
}

function fixedCompletedDates(
  activity: CanonicalScheduleActivity,
): ForwardState | null {
  const finish =
    parseScheduleInstant(
      activity.actualFinishIso,
    ) ??
    parseScheduleInstant(
      activity.currentFinishIso,
    );

  if (finish === null) return null;

  const start =
    parseScheduleInstant(
      activity.actualStartIso,
    ) ??
    parseScheduleInstant(
      activity.currentStartIso,
    ) ??
    finish;

  return {
    earlyStartMs: start,
    earlyFinishMs: finish,
  };
}

export function calculateCpm(
  sourceModel: CanonicalScheduleModel,
  input?: Partial<CpmConfig>,
): CpmResult {
  // LOE and WBS summaries describe a span; their stored duration is not an
  // independent execution task. Keep exclusions explicit for every consumer.
  const population=activityPopulation(sourceModel,'execution_control');
  const excludedIds=new Set(population.excluded.map(a=>a.activityId));
  // With no exclusions this is the same topology already analysed by other
  // schedule views. Preserve its identity for the input-validated graph cache.
  const model:CanonicalScheduleModel=excludedIds.size===0?sourceModel:{...sourceModel,activities:population.activities,
    relationships:sourceModel.relationships.filter(r=>!excludedIds.has(r.predecessorActivityId)&&!excludedIds.has(r.successorActivityId))};
  const config = mergeConfig(input);
  const graph = analyzeScheduleGraph(model);
  const assumptions: string[] = [];
  const constrainedActivities=model.activities.filter(a=>a.sourceConstraints?.length);
  const noConstraints:ReturnType<typeof activityConstraints>={constraints:[],diagnostics:[]};
  const constraintsByActivity=new Map(config.applySourceConstraints
    ?constrainedActivities.map(a=>[a,activityConstraints(a)] as const):[]);
  if(constrainedActivities.length&&!config.applySourceConstraints)assumptions.push('SOURCE_CONSTRAINTS_RETAINED_NOT_APPLIED_TO_UNCONSTRAINED_NETWORK:'+constrainedActivities.length);
  if(model.diagnostics.includes('SOURCE_CONSTRAINT_RECOVERY_NOT_ESTABLISHED'))assumptions.push('SOURCE_CONSTRAINT_RECOVERY_NOT_ESTABLISHED');
  const diagnostics = [
    ...model.diagnostics,
    ...graph.diagnostics,
    ...(constrainedActivities.length&&config.applySourceConstraints?['SOURCE_CONSTRAINTS_APPLIED:'+constrainedActivities.length]:[]),
  ];

  const anchor =
    parseScheduleInstant(
      config.projectStartIso ?? null,
    ) ??
    (config.durationBasis === "remaining"
      ? parseScheduleInstant(
          model.dataDateIso,
        )
      : null) ??
    earliestModelDate(model);

  const requiredFinish =
    requiredFinishInstant(
      config.requiredFinishIso,
    );

  // Every per-activity table below is indexed by the activity's position in
  // model.activities. Identifiers are resolved to these integer positions
  // once, so the passes read plain arrays instead of string-keyed maps. The
  // calculation, its order and every result are the same as the map version.
  const activityCount = model.activities.length;
  const contexts: ActivityContext[] = new Array(activityCount);
  // One calendar identifier always resolves to the same calendar in this
  // model. Resolve it once per identifier; the resolution is never mutated.
  const calendarResolutions = new Map<
    string | null,
    WorkingCalendarResolution | null
  >();

  for (let index = 0; index < activityCount; index += 1) {
    const activity = model.activities[index]!;
    let calendar = calendarResolutions.get(activity.calendarId);
    if (calendar === undefined) {
      calendar = resolveWorkingCalendar(
        activity.calendarId,
        model.calendars,
        config.allowElapsedFallback,
      );
      calendarResolutions.set(activity.calendarId, calendar);
    }

    if (!calendar) {
      contexts[index] = {
        activity,
        calendar: null,
        durationHours: null,
        durationMethod: null,
        diagnostics: [
          ...activity.diagnostics,
          "CPM_ACTIVITY_CALENDAR_UNRESOLVED",
        ],
      };
      continue;
    }

    assumptions.push(...calendar.assumptions);

    const duration =
      resolveActivityDuration(
        activity,
        calendar,
        config.durationBasis,
      );

    assumptions.push(
      ...duration.assumptions,
    );

    contexts[index] = {
      activity,
      calendar,
      durationHours: duration.hours,
      durationMethod: duration.method,
      diagnostics: [
        ...activity.diagnostics,
        ...duration.diagnostics,
      ],
    };
  }

  const effectiveRelationships =
    model.relationships.flatMap(
      (relationship) => {
        if (relationship.external) {
          diagnostics.push(
            "CPM_EXTERNAL_RELATIONSHIP_UNRESOLVED:" +
              relationship.relationshipId,
          );
          return [];
        }

        const effective =
          effectiveRelationship(
            relationship,
            config,
            assumptions,
          );

        if (!effective) {
          diagnostics.push(
            "CPM_RELATIONSHIP_UNRESOLVED:" +
              relationship.relationshipId,
          );
          return [];
        }

        return [effective];
      },
    );

  if (
    graph.duplicateActivityIds.length > 0 ||
    graph.cyclicActivityIds.length > 0 ||
    graph.topologicalOrder === null ||
    anchor === null
  ) {
    if (anchor === null) {
      diagnostics.push(
        "CPM_PROJECT_START_UNRESOLVED",
      );
    }

    // With duplicate identifiers the last activity of an identifier owns
    // that identifier's context, exactly as an identifier-keyed map does.
    const contextById = new Map<string, ActivityContext>();
    for (let index = 0; index < activityCount; index += 1) {
      contextById.set(model.activities[index]!.activityId, contexts[index]!);
    }

    const activities: CpmActivityResult[] =
      model.activities.map(
        (activity) => ({
          activityId: activity.activityId,
          calendarId: activity.calendarId,
          calendarMode:
            contextById.get(activity.activityId)
              ?.calendar?.mode ??
            "elapsed_fallback",
          durationHours:
            contextById.get(activity.activityId)
              ?.durationHours ?? null,
          durationMethod:
            contextById.get(activity.activityId)
              ?.durationMethod ?? null,
          earlyStartIso: null,
          earlyFinishIso: null,
          lateStartIso: null,
          lateFinishIso: null,
          totalFloatHours: null,
          critical: null,
          status: "unresolved",
          diagnostics: [
            ...(contextById.get(
              activity.activityId,
            )?.diagnostics ?? []),
            "CPM_NETWORK_NOT_CALCULABLE",
          ],
        }),
      );

    return {
      activityPopulation:population.contract,
      projectId: model.projectId,
      sourceRevisionId:
        model.sourceRevisionId,
      dataDateIso: model.dataDateIso,
      durationBasis:
        config.durationBasis,
      calculationMode:
        "elapsed_time_fallback",
      relationshipLagCalendarMethod:
        "successor_calendar_forward_and_backward",
      projectStartIso:
        isoInstant(anchor),
      projectFinishIso: null,
      requiredFinishIso:
        isoInstant(requiredFinish),
      latePassFinishIso:
        isoInstant(requiredFinish),
      criticalThresholdHours:
        config.criticalThresholdHours,
      criticalActivityIds: [],
      activities,
      unresolvedActivityIds:
        activities.map(
          (activity) =>
            activity.activityId,
        ),
      assumptions:
        uniqueSorted(assumptions),
      diagnostics:
        uniqueSorted(diagnostics),
      complete: false,
    };
  }

  // Here identifiers are unique and the topological order holds every
  // activity exactly once (the graph is built from these same activities).
  const topologicalIds = graph.topologicalOrder;
  const indexById = new Map<string, number>();
  for (let index = 0; index < activityCount; index += 1) {
    indexById.set(model.activities[index]!.activityId, index);
  }
  const order = new Int32Array(topologicalIds.length);
  for (let position = 0; position < topologicalIds.length; position += 1) {
    const index = indexById.get(topologicalIds[position]!);
    if (index === undefined) {
      throw new Error("CPM topological order does not match the activity table");
    }
    order[position] = index;
  }

  // Valid links, in source order, as integer endpoints. Incoming and
  // outgoing lists keep that source order for every activity.
  const linked: EffectiveRelationship[] = [];
  const linkedPredecessor: number[] = [];
  const linkedSuccessor: number[] = [];
  for (const relation of effectiveRelationships) {
    const successorIndex = indexById.get(relation.successorActivityId);
    const predecessorIndex = indexById.get(relation.predecessorActivityId);
    if (
      successorIndex === undefined ||
      predecessorIndex === undefined
    ) {
      diagnostics.push(
        "CPM_RELATIONSHIP_ENDPOINT_UNRESOLVED:" +
          relation.predecessorActivityId +
          "->" +
          relation.successorActivityId,
      );
      continue;
    }
    linked.push(relation);
    linkedPredecessor.push(predecessorIndex);
    linkedSuccessor.push(successorIndex);
  }
  const linkCount = linked.length;
  const incomingStart = new Int32Array(activityCount + 1);
  const outgoingStart = new Int32Array(activityCount + 1);
  for (let link = 0; link < linkCount; link += 1) {
    incomingStart[linkedSuccessor[link]! + 1]! += 1;
    outgoingStart[linkedPredecessor[link]! + 1]! += 1;
  }
  let maxIncoming = 0;
  for (let index = 0; index < activityCount; index += 1) {
    maxIncoming = Math.max(maxIncoming, incomingStart[index + 1]!);
    incomingStart[index + 1]! += incomingStart[index]!;
    outgoingStart[index + 1]! += outgoingStart[index]!;
  }
  const incomingLinks = new Int32Array(linkCount);
  const outgoingLinks = new Int32Array(linkCount);
  {
    const incomingFill = incomingStart.slice(0, activityCount);
    const outgoingFill = outgoingStart.slice(0, activityCount);
    for (let link = 0; link < linkCount; link += 1) {
      incomingLinks[incomingFill[linkedSuccessor[link]!]!++] = link;
      outgoingLinks[outgoingFill[linkedPredecessor[link]!]!++] = link;
    }
  }

  // Forward state: 0 = not yet visited, 1 = visited with unresolved dates,
  // 2 = visited with early start and finish.
  const forwardState = new Uint8Array(activityCount);
  const earlyStartMs = new Float64Array(activityCount);
  const earlyFinishMs = new Float64Array(activityCount);
  const forwardStartOf = (index: number): number | null =>
    forwardState[index] === 2 ? earlyStartMs[index]! : null;
  const forwardFinishOf = (index: number): number | null =>
    forwardState[index] === 2 ? earlyFinishMs[index]! : null;
  // Retained logic: work that has started has a fixed start event. An SS/SF
  // successor counts its lag from the predecessor's actual start, not from
  // the remaining-work start at the data date (T06 D2). Only a recorded
  // actual start no later than the remaining start is used; anything else
  // keeps the calculated start.
  const actualStartMs = new Float64Array(activityCount).fill(NaN);
  if (config.durationBasis === "remaining") {
    for (let index = 0; index < activityCount; index += 1) {
      const activity = model.activities[index]!;
      if (activity.status !== "in_progress") continue;
      const actual = parseScheduleInstant(activity.actualStartIso);
      if (actual !== null) actualStartMs[index] = actual;
    }
  }
  const startedAt = (index: number): number | null => {
    const actual = actualStartMs[index]!;
    return forwardState[index] === 2 && !Number.isNaN(actual) && actual <= earlyStartMs[index]! ? actual : null;
  };
  const relationStartOf = (index: number): number | null =>
    startedAt(index) ?? forwardStartOf(index);
  // Binding (driving) predecessor links of each activity, as link numbers.
  // A later retrace appends a fresh list and repoints the activity to it.
  const bindingStart = new Int32Array(activityCount);
  const bindingCount = new Int32Array(activityCount);
  const bindingLinks: number[] = [];
  const candidateLink = new Int32Array(maxIncoming);
  const candidateStart = new Float64Array(maxIncoming);
  const candidateFinish = new Float64Array(maxIncoming);
  const candidateHasFinish = new Uint8Array(maxIncoming);

  for (let position = 0; position < activityCount; position += 1) {
    const index = order[position]!;
    const context = contexts[index]!;

    if (
      !context.calendar ||
      context.durationHours === null
    ) {
      forwardState[index] = 1;
      continue;
    }

    if (
      context.activity.status ===
      "completed"
    ) {
      const fixed =
        fixedCompletedDates(
          context.activity,
        );

      if (fixed) {
        earlyStartMs[index] = fixed.earlyStartMs!;
        earlyFinishMs[index] = fixed.earlyFinishMs!;
        forwardState[index] = 2;
      } else {
        context.diagnostics.push(
          "CPM_COMPLETED_ACTIVITY_FINISH_UNRESOLVED",
        );
        forwardState[index] = 1;
      }
      continue;
    }

    const calendar = context.calendar;
    const durationHours = context.durationHours;
    let candidates = 0;

    for (
      let slot = incomingStart[index]!;
      slot < incomingStart[index + 1]!;
      slot += 1
    ) {
      const link = incomingLinks[slot]!;
      const relation = linked[link]!;
      const predecessorIndex = linkedPredecessor[link]!;

      if (forwardState[predecessorIndex] === 0) continue;

      const predecessorStart = relationStartOf(predecessorIndex);
      const predecessorFinish = forwardFinishOf(predecessorIndex);
      const candidate =
        forwardConstraintStart(
          relation,
          predecessorStart,
          predecessorFinish,
          durationHours,
          calendar,
        );

      if (candidate !== null) {
        const finishAnchor=relation.type==='FF'?predecessorFinish:relation.type==='SF'?predecessorStart:null;
        candidateLink[candidates] = link;
        candidateStart[candidates] = candidate;
        if (finishAnchor === null) {
          candidateHasFinish[candidates] = 0;
        } else {
          candidateHasFinish[candidates] = 1;
          candidateFinish[candidates] = relation.lagHours===0?finishAnchor:
            shiftByLag(calendar,finishAnchor,relation.lagHours);
        }
        candidates += 1;
      } else {
        context.diagnostics.push(
          "CPM_PREDECESSOR_TIMING_UNRESOLVED:" +
            relation.predecessorActivityId,
        );
      }
    }

    const sourceBounds=constraintsByActivity.get(context.activity)??noConstraints;
    context.diagnostics.push(...sourceBounds.diagnostics);
    let startCandidate = anchor;
    for (let candidate = 0; candidate < candidates; candidate += 1) {
      startCandidate = Math.max(startCandidate, candidateStart[candidate]!);
    }
    let finishMinimum:number|null=null;
    for(const bound of sourceBounds.constraints){
      if(bound.date===null)continue;
      if(['start_on','start_after'].includes(bound.kind))startCandidate=Math.max(startCandidate,bound.date);
      if(['finish_on','finish_after'].includes(bound.kind)){
        startCandidate=Math.max(startCandidate,subtractWorkingHours(calendar.calendar,bound.date,durationHours));
        finishMinimum=Math.max(finishMinimum??bound.date,bound.date);
      }
    }

    let earlyStart =
      addWorkingHours(
        calendar.calendar,
        startCandidate,
        0,
      );
    const workFinish =
      addWorkingHours(
        calendar.calendar,
        earlyStart,
        durationHours,
      );
    // Subtracting work and adding it back can land on opposite sides of a
    // nonworking gap. Retain the actual FF/SF finish bound as well as its
    // translated start; the successor must never finish before that event.
    let earlyFinish=Math.max(workFinish,finishMinimum??workFinish);
    for (let candidate = 0; candidate < candidates; candidate += 1) {
      if (candidateHasFinish[candidate] === 1) {
        earlyFinish = Math.max(earlyFinish, candidateFinish[candidate]!);
      }
    }
    for(const bound of sourceBounds.constraints){
      if(bound.date===null)continue;
      if(bound.kind==='mandatory_start'){
        earlyStart=bound.date;earlyFinish=addWorkingHours(calendar.calendar,earlyStart,durationHours);
      }else if(bound.kind==='mandatory_finish'){
        earlyFinish=bound.date;earlyStart=subtractWorkingHours(calendar.calendar,earlyFinish,durationHours);
      }
    }
    let finishOverridden = false;
    for (let candidate = 0; candidate < candidates; candidate += 1) {
      if (candidateHasFinish[candidate] === 1 && earlyFinish < candidateFinish[candidate]!) {
        finishOverridden = true;
        break;
      }
    }
    if(earlyStart<startCandidate||finishOverridden)context.diagnostics.push('CPM_MANDATORY_CONSTRAINT_OVERRIDES_LOGIC');

    earlyStartMs[index] = earlyStart;
    earlyFinishMs[index] = earlyFinish;
    forwardState[index] = 2;
    // Calendar normalization may make several links bind at the same start.
    // Retain every tie instead of selecting an arbitrary single predecessor.
    bindingStart[index] = bindingLinks.length;
    for (let candidate = 0; candidate < candidates; candidate += 1) {
      if (
        Math.abs(addWorkingHours(calendar.calendar,candidateStart[candidate]!,0)-earlyStart)<1||
        candidateHasFinish[candidate] === 1&&Math.abs(candidateFinish[candidate]!-earlyFinish)<1
      ) {
        bindingLinks.push(candidateLink[candidate]!);
      }
    }
    bindingCount[index] = bindingLinks.length - bindingStart[index]!;

    if (
      context.activity.status ===
      "unknown"
    ) {
      context.diagnostics.push(
        "CPM_UNKNOWN_ACTIVITY_STATUS_TREATED_AS_INCOMPLETE",
      );
      assumptions.push(
        "UNKNOWN_ACTIVITY_STATUS_TREATED_AS_INCOMPLETE",
      );
    }
  }

  const maxForwardFinish = (): number | null => {
    let known = false;
    let latest = -Infinity;
    for (let index = 0; index < activityCount; index += 1) {
      if (forwardState[index] !== 2) continue;
      known = true;
      latest = Math.max(latest, earlyFinishMs[index]!);
    }
    return known ? latest : null;
  };

  // ALAP consumes free float, not total float: move only as far as the
  // successors' early dates allow, so the project finish does not move.
  if(config.applySourceConstraints){
    const alap = new Uint8Array(activityCount);
    let alapCount = 0;
    for (let index = 0; index < activityCount; index += 1) {
      const bounds = constraintsByActivity.get(model.activities[index]!);
      if (bounds?.constraints.some(c=>c.kind==='alap')) {
        alap[index] = 1;
        alapCount += 1;
      }
    }
    const networkFinish=alapCount?maxForwardFinish():null;
    let alapMoved=false;
    for(let position=activityCount-1;alapCount&&position>=0;position--){
      const index=order[position]!;
      if(!alap[index])continue;
      const context=contexts[index]!;
      if(!context.calendar||context.durationHours===null||context.activity.status==='completed'||forwardState[index]!==2||networkFinish===null)continue;
      let finishBound=networkFinish;const startBounds:number[]=[];
      for(let slot=outgoingStart[index]!;slot<outgoingStart[index+1]!;slot++){
        const link=outgoingLinks[slot]!,relation=linked[link]!,successorIndex=linkedSuccessor[link]!;
        const calendar=contexts[successorIndex]!.calendar;
        if(!calendar)continue;
        const bound=backwardConstraintFinish(relation,forwardStartOf(successorIndex),forwardFinishOf(successorIndex),context.durationHours,context.calendar,calendar);
        if(bound){finishBound=Math.min(finishBound,bound.finish);if(bound.start!==null)startBounds.push(bound.start);}
      }
      const start=Math.min(subtractWorkingHours(context.calendar.calendar,finishBound,context.durationHours),...startBounds);
      if(start>earlyStartMs[index]!){
        earlyStartMs[index]=start;
        earlyFinishMs[index]=addWorkingHours(context.calendar.calendar,start,context.durationHours);
        alapMoved=true;
      }
    }
    // ALAP can turn a previously nonbinding branch into a tied driving branch.
    // Trace the final dates, not the pre-constraint forward-pass candidates.
    // Without an ALAP date movement the forward pass already has the exact
    // unfinished-activity ties. Completed activities bypass that pass's trace,
    // so retain their original fixed-date link inspection in either case.
    const retrace=(index:number)=>{
      const context=contexts[index]!;
      if(!context.calendar||context.durationHours===null||forwardState[index]!==2)return;
      const calendar=context.calendar,durationHours=context.durationHours;
      const early={start:earlyStartMs[index]!,finish:earlyFinishMs[index]!};
      bindingStart[index]=bindingLinks.length;
      for(let slot=incomingStart[index]!;slot<incomingStart[index+1]!;slot++){
        const link=incomingLinks[slot]!,relation=linked[link]!,predecessorIndex=linkedPredecessor[link]!;
        if(forwardState[predecessorIndex]===0)continue;
        const predecessorStart=relationStartOf(predecessorIndex),predecessorFinish=forwardFinishOf(predecessorIndex);
        const start=forwardConstraintStart(relation,predecessorStart,predecessorFinish,durationHours,calendar);
        const finishAnchor=relation.type==='FF'?predecessorFinish:relation.type==='SF'?predecessorStart:null;
        const finish=finishAnchor===null?null:relation.lagHours===0?finishAnchor:shiftByLag(calendar,finishAnchor,relation.lagHours);
        if(start!==null&&Math.abs(addWorkingHours(calendar.calendar,start,0)-early.start)<1||finish!==null&&Math.abs(finish-early.finish)<1)bindingLinks.push(link);
      }
      bindingCount[index]=bindingLinks.length-bindingStart[index]!;
    };
    if(alapMoved){
      for(let position=0;position<activityCount;position++)retrace(order[position]!);
    }else{
      for(let index=0;index<activityCount;index++)if(model.activities[index]!.status==='completed')retrace(index);
    }
  }

  const calculatedFinish =
    maxForwardFinish();

  const latePassFinish =
    requiredFinish ??
    calculatedFinish;

  // Backward state, with the same three states as the forward pass.
  const backwardState = new Uint8Array(activityCount);
  const lateStartMs = new Float64Array(activityCount);
  const lateFinishMs = new Float64Array(activityCount);

  for (
    let position =
      activityCount - 1;
    position >= 0;
    position -= 1
  ) {
    const index = order[position]!;
    const context = contexts[index]!;

    if (
      !context.calendar ||
      context.durationHours === null ||
      forwardState[index] !== 2 ||
      latePassFinish === null
    ) {
      backwardState[index] = 1;
      continue;
    }

    if (
      context.activity.status ===
      "completed"
    ) {
      backwardState[index] = 1;
      continue;
    }

    const calendar = context.calendar;
    const durationHours = context.durationHours;
    const earlyFinishOfActivity = earlyFinishMs[index]!;
    let lateFinishCandidate = latePassFinish;
    let startBound = Infinity;
    let hasStartBound = false;
    const sourceBounds=(constraintsByActivity.get(context.activity)??noConstraints).constraints;
    for(const bound of sourceBounds){
      if(bound.date===null)continue;
      if(['start_on','start_before'].includes(bound.kind)){
        startBound=Math.min(startBound,bound.date);hasStartBound=true;
        lateFinishCandidate=Math.min(lateFinishCandidate,addWorkingHours(calendar.calendar,bound.date,durationHours));
      }
      if(['finish_on','finish_before'].includes(bound.kind))lateFinishCandidate=Math.min(lateFinishCandidate,bound.date);
    }

    for (
      let slot = outgoingStart[index]!;
      slot < outgoingStart[index + 1]!;
      slot += 1
    ) {
      const link = outgoingLinks[slot]!;
      const relation = linked[link]!;
      const successorIndex = linkedSuccessor[link]!;

      const successorCalendar=contexts[successorIndex]!.calendar;
      if (backwardState[successorIndex] === 0 || !successorCalendar) continue;

      // A started predecessor's start is fixed in the past: an SS/SF link
      // cannot move it, so it gives no late bound (T06 D2, retained logic).
      if ((relation.type === "SS" || relation.type === "SF") && startedAt(index) !== null) continue;
      const successorKnown = backwardState[successorIndex] === 2;
      const candidate =
        backwardConstraintFinish(
          relation,
          successorKnown ? lateStartMs[successorIndex]! : null,
          successorKnown ? lateFinishMs[successorIndex]! : null,
          durationHours,
          calendar,
          successorCalendar,
        );

      if (candidate !== null) {
        let finishBound=candidate.finish;
        // SS/SF constrain the predecessor start. If forward analysis already
        // holds that activity's completion at the next chronological event
        // across a zero-work gap (for example because of an incoming FF/SF
        // finish constraint), deriving a work-finish from the start bound must
        // not pull late finish back to the prior closing boundary. Preserve the
        // held finish unless an explicit project/required finish is earlier.
        if(candidate.start!==null&&
          earlyFinishOfActivity<=latePassFinish&&finishBound<earlyFinishOfActivity&&
          workingHoursBetween(calendar.calendar,finishBound,earlyFinishOfActivity)===0){
          finishBound=earlyFinishOfActivity;
        }
        lateFinishCandidate=Math.min(lateFinishCandidate,finishBound);
        if (candidate.start !== null) {
          startBound=Math.min(startBound,candidate.start);hasStartBound=true;
        }
      }
    }

    // Every execution task must finish by the project finish target, including
    // predecessors of SS/SF links whose successors may finish before them.
    // Otherwise a long predecessor can receive positive float even though it
    // determines project completion, and disappear from the critical list.
    const normalizedLateFinish =
      previousWorkingInstant(
        calendar.calendar,
        lateFinishCandidate,
      );
    // A relationship may hold completion to the next work opening without
    // adding working duration. Keep that valid endpoint when the late bound
    // permits it; never push it past an earlier required finish target.
    let lateFinish=earlyFinishOfActivity<=lateFinishCandidate&&
      earlyFinishOfActivity>normalizedLateFinish&&workingHoursBetween(calendar.calendar,normalizedLateFinish,earlyFinishOfActivity)===0
      ?earlyFinishOfActivity:normalizedLateFinish;
    // A zero-duration activity starts where it finishes. Subtracting zero
    // work from a finish held at a work opening returns the previous closing
    // instant; a predecessor on a calendar that works through that gap was
    // then forced to finish before its early finish (false negative float,
    // T06 D1).
    const durationStart = durationHours === 0 ? lateFinish : subtractWorkingHours(
        calendar.calendar,
        lateFinish,
        durationHours,
      );
    let lateStart = hasStartBound ? Math.min(durationStart, startBound) : durationStart;
    for(const bound of sourceBounds){
      if(bound.date===null)continue;
      if(bound.kind==='mandatory_start'){
        lateStart=bound.date;lateFinish=addWorkingHours(calendar.calendar,lateStart,durationHours);
      }else if(bound.kind==='mandatory_finish'){
        lateFinish=bound.date;lateStart=subtractWorkingHours(calendar.calendar,lateFinish,durationHours);
      }
    }

    lateStartMs[index] = lateStart;
    lateFinishMs[index] = lateFinish;
    backwardState[index] = 2;
  }

  const unsupportedConstraint = /^CPM_CONSTRAINT_(TYPE_UNSUPPORTED|DATE_MISSING)/;
  const activities: CpmActivityResult[] = new Array(activityCount);
  for (let index = 0; index < activityCount; index += 1) {
      const activity = model.activities[index]!;
      const context = contexts[index]!;

      if (
        !context.calendar ||
        context.durationHours === null ||
        forwardState[index] !== 2 ||
        context.diagnostics.some(d=>unsupportedConstraint.test(d))
      ) {
        activities[index] = {
          activityId: activity.activityId,
          calendarId: activity.calendarId,
          calendarMode:
            context.calendar?.mode ??
            "elapsed_fallback",
          durationHours:
            context.durationHours ?? null,
          durationMethod:
            context.durationMethod ?? null,
          earlyStartIso: null,
          earlyFinishIso: null,
          lateStartIso: null,
          lateFinishIso: null,
          totalFloatHours: null,
          critical: null,
          status: "unresolved" as const,
          diagnostics: [
            ...context.diagnostics,
            "CPM_ACTIVITY_UNRESOLVED",
          ],
        };
        continue;
      }

      const earlyStart = earlyStartMs[index]!;
      const earlyFinish = earlyFinishMs[index]!;

      if (
        activity.status ===
        "completed"
      ) {
        activities[index] = {
          activityId: activity.activityId,
          calendarId: activity.calendarId,
          calendarMode:
            context.calendar.mode,
          durationHours:
            context.durationHours,
          durationMethod:
            context.durationMethod,
          earlyStartIso:
            isoInstant(
              earlyStart,
            ),
          earlyFinishIso:
            isoInstant(
              earlyFinish,
            ),
          lateStartIso: null,
          lateFinishIso: null,
          totalFloatHours: null,
          critical: null,
          status: "calculated" as const,
          diagnostics: [
            ...context.diagnostics,
            "CPM_COMPLETED_ACTIVITY_FLOAT_NOT_RECALCULATED",
          ],
        };
        continue;
      }

      if (backwardState[index] !== 2) {
        activities[index] = {
          activityId: activity.activityId,
          calendarId: activity.calendarId,
          calendarMode:
            context.calendar.mode,
          durationHours:
            context.durationHours,
          durationMethod:
            context.durationMethod,
          earlyStartIso:
            isoInstant(
              earlyStart,
            ),
          earlyFinishIso:
            isoInstant(
              earlyFinish,
            ),
          lateStartIso: null,
          lateFinishIso: null,
          totalFloatHours: null,
          critical: null,
          status: "unresolved" as const,
          diagnostics: [
            ...context.diagnostics,
            "CPM_LATE_PASS_UNRESOLVED",
          ],
        };
        continue;
      }

      const lateFinish = lateFinishMs[index]!;
      const totalFloatHours =
        workingHoursBetween(
          context.calendar.calendar,
          earlyFinish,
          lateFinish,
        );

      activities[index] = {
        activityId: activity.activityId,
        calendarId: activity.calendarId,
        calendarMode:
          context.calendar.mode,
        durationHours:
          context.durationHours,
        durationMethod:
          context.durationMethod,
        earlyStartIso:
          isoInstant(earlyStart),
        earlyFinishIso:
          isoInstant(earlyFinish),
        lateStartIso:
          isoInstant(lateStartMs[index]!),
        lateFinishIso:
          isoInstant(
            lateFinish,
          ),
        totalFloatHours: Number(
          totalFloatHours.toFixed(6),
        ),
        critical:
          totalFloatHours <=
          config.criticalThresholdHours,
        status: "calculated" as const,
        diagnostics: [
          ...context.diagnostics,
        ],
      };
  }

  const modes = new Set(
    activities
      .filter(
        (activity) =>
          activity.status === "calculated",
      )
      .map(
        (activity) =>
          activity.calendarMode,
      ),
  );

  const calculationMode =
    modes.size === 1 &&
    modes.has("source_calendar")
      ? "calendar_working_time"
      : modes.size === 1 &&
          modes.has("elapsed_fallback")
        ? "elapsed_time_fallback"
        : "mixed_with_elapsed_fallback";

  const unresolvedActivityIds =
    activities
      .filter(
        (activity) =>
          activity.status === "unresolved",
      )
      .map(
        (activity) =>
          activity.activityId,
      );

  const criticalActivityIds =
    activities
      .filter(
        (activity) =>
          activity.critical === true,
      )
      .map(
        (activity) =>
          activity.activityId,
      );

  const driving=new Uint8Array(activityCount),drivingRelationships:EffectiveRelationship[]=[];
  const finishActivityIds:string[]=[];
  for(let position=0;position<activityCount;position++){
    const index=order[position]!;
    if(calculatedFinish!==null&&forwardState[index]===2&&earlyFinishMs[index]===calculatedFinish)finishActivityIds.push(topologicalIds[position]!);
  }
  const pending=finishActivityIds.map(id=>indexById.get(id)!);
  while(pending.length){const index=pending.pop()!;if(driving[index])continue;driving[index]=1;
    for(let slot=bindingStart[index]!;slot<bindingStart[index]!+bindingCount[index]!;slot++){
      const link=bindingLinks[slot]!;drivingRelationships.push(linked[link]!);pending.push(linkedPredecessor[link]!);}}
  const drivingActivityIds:string[]=[];
  const startReasons:Array<{activityId:string;reason:'fixed_actual_dates'|'reporting_anchor_or_calendar'}>=[];
  for(let position=0;position<activityCount;position++){
    const index=order[position]!;
    if(!driving[index])continue;
    const activityId=topologicalIds[position]!;
    drivingActivityIds.push(activityId);
    if(!bindingCount[index])startReasons.push({activityId,reason:contexts[index]!.activity.status==='completed'?'fixed_actual_dates' as const:'reporting_anchor_or_calendar' as const});
  }
  const drivingNetwork={activityIds:drivingActivityIds,finishActivityIds,
    relationships:drivingRelationships.map(({diagnostics,...relation})=>relation),
    startReasons};
  return {
    drivingNetwork,
    activityPopulation:population.contract,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    durationBasis:
      config.durationBasis,
    calculationMode,
    relationshipLagCalendarMethod:
      "successor_calendar_forward_and_backward",
    projectStartIso:
      isoInstant(anchor),
    projectFinishIso:
      isoInstant(calculatedFinish),
    requiredFinishIso:
      isoInstant(requiredFinish),
    latePassFinishIso:
      isoInstant(latePassFinish),
    criticalThresholdHours:
      config.criticalThresholdHours,
    criticalActivityIds:
      criticalActivityIds.sort(),
    activities,
    unresolvedActivityIds:
      unresolvedActivityIds.sort(),
    assumptions:
      uniqueSorted(assumptions),
    diagnostics:
      uniqueSorted(diagnostics),
    complete:
      activities.length > 0 &&
      unresolvedActivityIds.length === 0 &&
      graph.duplicateActivityIds.length === 0 &&
      graph.cyclicActivityIds.length === 0 &&
      graph.brokenPredecessorActivityIds
        .length === 0 &&
      graph.brokenSuccessorActivityIds
        .length === 0 &&
      graph.externalRelationshipCount === 0,
  };
}
