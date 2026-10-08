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

interface BackwardState {
  lateStartMs: number | null;
  lateFinishMs: number | null;
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
  predecessor: ForwardState,
  successorDurationHours: number,
  successorCalendar: WorkingCalendarResolution,
): number | null {
  switch (relation.type) {
    case "FS":
      return predecessor.earlyFinishMs === null
        ? null
        : shiftByLag(
            successorCalendar,
            predecessor.earlyFinishMs,
            relation.lagHours,
          );
    case "SS":
      return predecessor.earlyStartMs === null
        ? null
        : shiftByLag(
            successorCalendar,
            predecessor.earlyStartMs,
            relation.lagHours,
          );
    case "FF": {
      if (
        predecessor.earlyFinishMs === null
      ) {
        return null;
      }
      const requiredFinish = shiftByLag(
        successorCalendar,
        predecessor.earlyFinishMs,
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
        predecessor.earlyStartMs === null
      ) {
        return null;
      }
      const requiredFinish = shiftByLag(
        successorCalendar,
        predecessor.earlyStartMs,
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
  successor: BackwardState,
  predecessorDurationHours: number,
  predecessorCalendar: WorkingCalendarResolution,
  successorCalendar: WorkingCalendarResolution,
): {finish: number; start: number | null} | null {
  const endpoint = relation.type === 'FS' || relation.type === 'SS'
    ? successor.lateStartMs : successor.lateFinishMs;
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
  const start=closing&&strictlyAfterClosing&&lastClosesShift&&predecessorDurationHours>0
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

  const contexts = new Map<
    string,
    ActivityContext
  >();

  for (const activity of model.activities) {
    const calendar = resolveWorkingCalendar(
      activity.calendarId,
      model.calendars,
      config.allowElapsedFallback,
    );

    if (!calendar) {
      contexts.set(activity.activityId, {
        activity,
        calendar: null,
        durationHours: null,
        durationMethod: null,
        diagnostics: [
          ...activity.diagnostics,
          "CPM_ACTIVITY_CALENDAR_UNRESOLVED",
        ],
      });
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

    contexts.set(activity.activityId, {
      activity,
      calendar,
      durationHours: duration.hours,
      durationMethod: duration.method,
      diagnostics: [
        ...activity.diagnostics,
        ...duration.diagnostics,
      ],
    });
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

    const activities: CpmActivityResult[] =
      model.activities.map(
        (activity) => ({
          activityId: activity.activityId,
          calendarId: activity.calendarId,
          calendarMode:
            contexts.get(activity.activityId)
              ?.calendar?.mode ??
            "elapsed_fallback",
          durationHours:
            contexts.get(activity.activityId)
              ?.durationHours ?? null,
          durationMethod:
            contexts.get(activity.activityId)
              ?.durationMethod ?? null,
          earlyStartIso: null,
          earlyFinishIso: null,
          lateStartIso: null,
          lateFinishIso: null,
          totalFloatHours: null,
          critical: null,
          status: "unresolved",
          diagnostics: [
            ...(contexts.get(
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

  const incoming = new Map<
    string,
    EffectiveRelationship[]
  >();
  const outgoing = new Map<
    string,
    EffectiveRelationship[]
  >();

  for (const id of graph.topologicalOrder) {
    incoming.set(id, []);
    outgoing.set(id, []);
  }

  for (const relation of effectiveRelationships) {
    if (
      !incoming.has(
        relation.successorActivityId,
      ) ||
      !outgoing.has(
        relation.predecessorActivityId,
      )
    ) {
      diagnostics.push(
        "CPM_RELATIONSHIP_ENDPOINT_UNRESOLVED:" +
          relation.predecessorActivityId +
          "->" +
          relation.successorActivityId,
      );
      continue;
    }

    incoming
      .get(
        relation.successorActivityId,
      )!
      .push(relation);
    outgoing
      .get(
        relation.predecessorActivityId,
      )!
      .push(relation);
  }

  const forward = new Map<
    string,
    ForwardState
  >();
  const bindingPredecessors=new Map<string,EffectiveRelationship[]>();

  for (const activityId of graph.topologicalOrder) {
    const context =
      contexts.get(activityId);

    if (
      !context ||
      !context.calendar ||
      context.durationHours === null
    ) {
      forward.set(activityId, {
        earlyStartMs: null,
        earlyFinishMs: null,
      });
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
        forward.set(activityId, fixed);
      } else {
        context.diagnostics.push(
          "CPM_COMPLETED_ACTIVITY_FINISH_UNRESOLVED",
        );
        forward.set(activityId, {
          earlyStartMs: null,
          earlyFinishMs: null,
        });
      }
      continue;
    }

    const candidates: Array<{relation:EffectiveRelationship;start:number;finish:number|null}> = [];

    for (const relation of incoming.get(
      activityId,
    ) ?? []) {
      const predecessor =
        forward.get(
          relation.predecessorActivityId,
        );

      if (!predecessor) continue;

      const candidate =
        forwardConstraintStart(
          relation,
          predecessor,
          context.durationHours,
          context.calendar,
        );

      if (candidate !== null) {
        const finishAnchor=relation.type==='FF'?predecessor.earlyFinishMs:relation.type==='SF'?predecessor.earlyStartMs:null;
        candidates.push({relation,start:candidate,finish:finishAnchor===null?null:relation.lagHours===0?finishAnchor:
          shiftByLag(context.calendar,finishAnchor,relation.lagHours)});
      } else {
        context.diagnostics.push(
          "CPM_PREDECESSOR_TIMING_UNRESOLVED:" +
            relation.predecessorActivityId,
        );
      }
    }

    const sourceBounds=config.applySourceConstraints?activityConstraints(context.activity):{constraints:[],diagnostics:[]};
    context.diagnostics.push(...sourceBounds.diagnostics);
    let startCandidate = candidates.reduce((latest,c)=>Math.max(latest,c.start),anchor);
    let finishMinimum:number|null=null;
    for(const bound of sourceBounds.constraints){
      if(bound.date===null)continue;
      if(['start_on','start_after'].includes(bound.kind))startCandidate=Math.max(startCandidate,bound.date);
      if(['finish_on','finish_after'].includes(bound.kind)){
        startCandidate=Math.max(startCandidate,subtractWorkingHours(context.calendar.calendar,bound.date,context.durationHours));
        finishMinimum=Math.max(finishMinimum??bound.date,bound.date);
      }
    }

    let earlyStart =
      addWorkingHours(
        context.calendar.calendar,
        startCandidate,
        0,
      );
    const workFinish =
      addWorkingHours(
        context.calendar.calendar,
        earlyStart,
        context.durationHours,
      );
    // Subtracting work and adding it back can land on opposite sides of a
    // nonworking gap. Retain the actual FF/SF finish bound as well as its
    // translated start; the successor must never finish before that event.
    let earlyFinish=candidates.reduce((finish,c)=>Math.max(finish,c.finish??finish),Math.max(workFinish,finishMinimum??workFinish));
    for(const bound of sourceBounds.constraints){
      if(bound.date===null)continue;
      if(bound.kind==='mandatory_start'){
        earlyStart=bound.date;earlyFinish=addWorkingHours(context.calendar.calendar,earlyStart,context.durationHours);
      }else if(bound.kind==='mandatory_finish'){
        earlyFinish=bound.date;earlyStart=subtractWorkingHours(context.calendar.calendar,earlyFinish,context.durationHours);
      }
    }
    if(earlyStart<startCandidate||candidates.some(c=>c.finish!==null&&earlyFinish<c.finish))context.diagnostics.push('CPM_MANDATORY_CONSTRAINT_OVERRIDES_LOGIC');

    forward.set(activityId, {
      earlyStartMs: earlyStart,
      earlyFinishMs: earlyFinish,
    });
    // Calendar normalization may make several links bind at the same start.
    // Retain every tie instead of selecting an arbitrary single predecessor.
    bindingPredecessors.set(activityId,candidates.filter(c=>Math.abs(addWorkingHours(context.calendar!.calendar,c.start,0)-earlyStart)<1||c.finish!==null&&Math.abs(c.finish-earlyFinish)<1).map(c=>c.relation));

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

  // ALAP consumes free float, not total float: move only as far as the
  // successors' early dates allow, so the project finish does not move.
  if(config.applySourceConstraints){
    const networkFinish=maxDefined([...forward.values()].map(row=>row.earlyFinishMs));
    for(const activityId of [...graph.topologicalOrder].reverse()){
      const context=contexts.get(activityId),early=forward.get(activityId);
      if(!context?.calendar||context.durationHours===null||context.activity.status==='completed'||early?.earlyStartMs==null||early.earlyFinishMs===null||networkFinish===null||!activityConstraints(context.activity).constraints.some(c=>c.kind==='alap'))continue;
      let finishBound=networkFinish;const startBounds:number[]=[];
      for(const relation of outgoing.get(activityId)??[]){
        const successor=forward.get(relation.successorActivityId),calendar=contexts.get(relation.successorActivityId)?.calendar;
        if(!successor||!calendar)continue;
        const bound=backwardConstraintFinish(relation,{lateStartMs:successor.earlyStartMs,lateFinishMs:successor.earlyFinishMs},context.durationHours,context.calendar,calendar);
        if(bound){finishBound=Math.min(finishBound,bound.finish);if(bound.start!==null)startBounds.push(bound.start);}
      }
      const start=Math.min(subtractWorkingHours(context.calendar.calendar,finishBound,context.durationHours),...startBounds);
      if(start>early.earlyStartMs)forward.set(activityId,{earlyStartMs:start,earlyFinishMs:addWorkingHours(context.calendar.calendar,start,context.durationHours)});
    }
    // ALAP can turn a previously nonbinding branch into a tied driving branch.
    // Trace the final dates, not the pre-constraint forward-pass candidates.
    for(const activityId of graph.topologicalOrder){
      const context=contexts.get(activityId),early=forward.get(activityId);
      if(!context?.calendar||context.durationHours===null||early?.earlyStartMs==null||early.earlyFinishMs===null)continue;
      bindingPredecessors.set(activityId,(incoming.get(activityId)??[]).filter(relation=>{
        const predecessor=forward.get(relation.predecessorActivityId);if(!predecessor)return false;
        const start=forwardConstraintStart(relation,predecessor,context.durationHours!,context.calendar!);
        const finishAnchor=relation.type==='FF'?predecessor.earlyFinishMs:relation.type==='SF'?predecessor.earlyStartMs:null;
        const finish=finishAnchor===null?null:relation.lagHours===0?finishAnchor:shiftByLag(context.calendar!,finishAnchor,relation.lagHours);
        return start!==null&&Math.abs(addWorkingHours(context.calendar!.calendar,start,0)-early.earlyStartMs!)<1||finish!==null&&Math.abs(finish-early.earlyFinishMs!)<1;
      }));
    }
  }

  const calculatedFinish =
    maxDefined(
      [...forward.values()].map(
        (state) => state.earlyFinishMs,
      ),
    );

  const latePassFinish =
    requiredFinish ??
    calculatedFinish;

  const backward = new Map<
    string,
    BackwardState
  >();

  for (
    let index =
      graph.topologicalOrder.length - 1;
    index >= 0;
    index -= 1
  ) {
    const activityId =
      graph.topologicalOrder[index]!;
    const context =
      contexts.get(activityId);
    const early =
      forward.get(activityId);

    if (
      !context ||
      !context.calendar ||
      context.durationHours === null ||
      !early ||
      early.earlyFinishMs === null ||
      latePassFinish === null
    ) {
      backward.set(activityId, {
        lateStartMs: null,
        lateFinishMs: null,
      });
      continue;
    }

    if (
      context.activity.status ===
      "completed"
    ) {
      backward.set(activityId, {
        lateStartMs: null,
        lateFinishMs: null,
      });
      continue;
    }

    const candidates: number[] = [];
    const startBounds: number[] = [];
    const sourceBounds=config.applySourceConstraints?activityConstraints(context.activity).constraints:[];
    for(const bound of sourceBounds){
      if(bound.date===null)continue;
      if(['start_on','start_before'].includes(bound.kind)){
        startBounds.push(bound.date);candidates.push(addWorkingHours(context.calendar.calendar,bound.date,context.durationHours));
      }
      if(['finish_on','finish_before'].includes(bound.kind))candidates.push(bound.date);
    }

    for (const relation of outgoing.get(
      activityId,
    ) ?? []) {
      const successor =
        backward.get(
          relation.successorActivityId,
        );

      const successorCalendar=contexts.get(relation.successorActivityId)?.calendar;
      if (!successor || !successorCalendar) continue;

      const candidate =
        backwardConstraintFinish(
          relation,
          successor,
          context.durationHours,
          context.calendar,
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
        if(candidate.start!==null&&early.earlyFinishMs!==null&&
          early.earlyFinishMs<=latePassFinish&&finishBound<early.earlyFinishMs&&
          workingHoursBetween(context.calendar.calendar,finishBound,early.earlyFinishMs)===0){
          finishBound=early.earlyFinishMs;
        }
        candidates.push(finishBound);
        if (candidate.start !== null) startBounds.push(candidate.start);
      }
    }

    // Every execution task must finish by the project finish target, including
    // predecessors of SS/SF links whose successors may finish before them.
    // Otherwise a long predecessor can receive positive float even though it
    // determines project completion, and disappear from the critical list.
    const projectFinishBound = latePassFinish;
    const lateFinishCandidate = candidates.reduce(
      (latest,candidate)=>Math.min(latest,candidate),
      projectFinishBound,
    );

    const normalizedLateFinish =
      previousWorkingInstant(
        context.calendar.calendar,
        lateFinishCandidate,
      );
    // A relationship may hold completion to the next work opening without
    // adding working duration. Keep that valid endpoint when the late bound
    // permits it; never push it past an earlier required finish target.
    let lateFinish=early.earlyFinishMs!==null&&early.earlyFinishMs<=lateFinishCandidate&&
      early.earlyFinishMs>normalizedLateFinish&&workingHoursBetween(context.calendar.calendar,normalizedLateFinish,early.earlyFinishMs)===0
      ?early.earlyFinishMs:normalizedLateFinish;
    const durationStart = subtractWorkingHours(
        context.calendar.calendar,
        lateFinish,
        context.durationHours,
      );
    let lateStart = startBounds.reduce((latest, bound) => Math.min(latest, bound), durationStart);
    for(const bound of sourceBounds){
      if(bound.date===null)continue;
      if(bound.kind==='mandatory_start'){
        lateStart=bound.date;lateFinish=addWorkingHours(context.calendar.calendar,lateStart,context.durationHours);
      }else if(bound.kind==='mandatory_finish'){
        lateFinish=bound.date;lateStart=subtractWorkingHours(context.calendar.calendar,lateFinish,context.durationHours);
      }
    }

    backward.set(activityId, {
      lateStartMs: lateStart,
      lateFinishMs: lateFinish,
    });
  }

  const activities: CpmActivityResult[] =
    model.activities.map((activity) => {
      const context =
        contexts.get(activity.activityId);
      const early =
        forward.get(activity.activityId);
      const late =
        backward.get(activity.activityId);

      if (
        !context ||
        !context.calendar ||
        context.durationHours === null ||
        !early ||
        early.earlyStartMs === null ||
        early.earlyFinishMs === null ||
        context.diagnostics.some(d=>/^CPM_CONSTRAINT_(TYPE_UNSUPPORTED|DATE_MISSING)/.test(d))
      ) {
        return {
          activityId: activity.activityId,
          calendarId: activity.calendarId,
          calendarMode:
            context?.calendar?.mode ??
            "elapsed_fallback",
          durationHours:
            context?.durationHours ?? null,
          durationMethod:
            context?.durationMethod ?? null,
          earlyStartIso: null,
          earlyFinishIso: null,
          lateStartIso: null,
          lateFinishIso: null,
          totalFloatHours: null,
          critical: null,
          status: "unresolved" as const,
          diagnostics: [
            ...(context?.diagnostics ?? []),
            "CPM_ACTIVITY_UNRESOLVED",
          ],
        };
      }

      if (
        activity.status ===
        "completed"
      ) {
        return {
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
              early.earlyStartMs,
            ),
          earlyFinishIso:
            isoInstant(
              early.earlyFinishMs,
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
      }

      if (
        !late ||
        late.lateStartMs === null ||
        late.lateFinishMs === null
      ) {
        return {
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
              early.earlyStartMs,
            ),
          earlyFinishIso:
            isoInstant(
              early.earlyFinishMs,
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
      }

      const totalFloatHours =
        workingHoursBetween(
          context.calendar.calendar,
          early.earlyFinishMs,
          late.lateFinishMs,
        );

      return {
        activityId: activity.activityId,
        calendarId: activity.calendarId,
        calendarMode:
          context.calendar.mode,
        durationHours:
          context.durationHours,
        durationMethod:
          context.durationMethod,
        earlyStartIso:
          isoInstant(early.earlyStartMs),
        earlyFinishIso:
          isoInstant(early.earlyFinishMs),
        lateStartIso:
          isoInstant(late.lateStartMs),
        lateFinishIso:
          isoInstant(
            late.lateFinishMs,
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
    });

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

  const drivingIds=new Set<string>(),drivingRelationships:EffectiveRelationship[]=[];
  const finishActivityIds=graph.topologicalOrder.filter(id=>calculatedFinish!==null&&forward.get(id)?.earlyFinishMs===calculatedFinish);
  const pending=[...finishActivityIds];
  while(pending.length){const id=pending.pop()!;if(drivingIds.has(id))continue;drivingIds.add(id);
    for(const relation of bindingPredecessors.get(id)??[]){drivingRelationships.push(relation);pending.push(relation.predecessorActivityId);}}
  const drivingNetwork={activityIds:graph.topologicalOrder.filter(id=>drivingIds.has(id)),finishActivityIds,
    relationships:drivingRelationships.map(({diagnostics,...relation})=>relation),
    startReasons:graph.topologicalOrder.filter(id=>drivingIds.has(id)&&!(bindingPredecessors.get(id)?.length)).map(activityId=>({activityId,reason:contexts.get(activityId)?.activity.status==='completed'?'fixed_actual_dates' as const:'reporting_anchor_or_calendar' as const}))};
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
