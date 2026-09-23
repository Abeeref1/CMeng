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
    : Math.max(...known);
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
    : Math.min(...known);
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
): number | null {
  switch (relation.type) {
    case "FS":
      return successor.lateStartMs === null
        ? null
        : addWorkingHours(
            predecessorCalendar.calendar,
            successor.lateStartMs,
            -relation.lagHours,
          );
    case "FF":
      return successor.lateFinishMs === null
        ? null
        : addWorkingHours(
            predecessorCalendar.calendar,
            successor.lateFinishMs,
            -relation.lagHours,
          );
    case "SS": {
      if (
        successor.lateStartMs === null
      ) {
        return null;
      }
      const latestStart = addWorkingHours(
        predecessorCalendar.calendar,
        successor.lateStartMs,
        -relation.lagHours,
      );
      return addWorkingHours(
        predecessorCalendar.calendar,
        latestStart,
        predecessorDurationHours,
      );
    }
    case "SF": {
      if (
        successor.lateFinishMs === null
      ) {
        return null;
      }
      const latestStart = addWorkingHours(
        predecessorCalendar.calendar,
        successor.lateFinishMs,
        -relation.lagHours,
      );
      return addWorkingHours(
        predecessorCalendar.calendar,
        latestStart,
        predecessorDurationHours,
      );
    }
  }
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
  const model:CanonicalScheduleModel={...sourceModel,activities:population.activities,
    relationships:sourceModel.relationships.filter(r=>!excludedIds.has(r.predecessorActivityId)&&!excludedIds.has(r.successorActivityId))};
  const config = mergeConfig(input);
  const graph = analyzeScheduleGraph(model);
  const assumptions: string[] = [];
  const constrainedActivities=model.activities.filter(a=>a.sourceConstraints?.length);
  if(constrainedActivities.length)assumptions.push('SOURCE_CONSTRAINTS_RETAINED_NOT_APPLIED_TO_UNCONSTRAINED_NETWORK:'+constrainedActivities.length);
  if(model.diagnostics.includes('SOURCE_CONSTRAINT_RECOVERY_NOT_ESTABLISHED'))assumptions.push('SOURCE_CONSTRAINT_RECOVERY_NOT_ESTABLISHED');
  const diagnostics = [
    ...model.diagnostics,
    ...graph.diagnostics,
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
        "successor_calendar_forward_predecessor_calendar_backward",
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

    const candidates: number[] = [];

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
        candidates.push(candidate);
      } else {
        context.diagnostics.push(
          "CPM_PREDECESSOR_TIMING_UNRESOLVED:" +
            relation.predecessorActivityId,
        );
      }
    }

    const startCandidate = Math.max(
      anchor,
      ...(candidates.length > 0
        ? candidates
        : [anchor]),
    );

    const earlyStart =
      addWorkingHours(
        context.calendar.calendar,
        startCandidate,
        0,
      );
    const earlyFinish =
      addWorkingHours(
        context.calendar.calendar,
        earlyStart,
        context.durationHours,
      );

    forward.set(activityId, {
      earlyStartMs: earlyStart,
      earlyFinishMs: earlyFinish,
    });

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

    for (const relation of outgoing.get(
      activityId,
    ) ?? []) {
      const successor =
        backward.get(
          relation.successorActivityId,
        );

      if (!successor) continue;

      const candidate =
        backwardConstraintFinish(
          relation,
          successor,
          context.durationHours,
          context.calendar,
        );

      if (candidate !== null) {
        candidates.push(candidate);
      }
    }

    const lateFinishCandidate =
      candidates.length > 0
        ? Math.min(...candidates)
        : previousWorkingInstant(
            context.calendar.calendar,
            latePassFinish,
          );

    const lateFinish =
      previousWorkingInstant(
        context.calendar.calendar,
        lateFinishCandidate,
      );
    const lateStart =
      subtractWorkingHours(
        context.calendar.calendar,
        lateFinish,
        context.durationHours,
      );

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
        early.earlyFinishMs === null
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

  return {
    activityPopulation:population.contract,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    durationBasis:
      config.durationBasis,
    calculationMode,
    relationshipLagCalendarMethod:
      "successor_calendar_forward_predecessor_calendar_backward",
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
