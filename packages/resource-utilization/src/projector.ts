import type {
  CanonicalCalendar,
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import {
  parseScheduleInstant,
  workingHoursBetween,
} from "../../schedule-cpm/src";
import {
  resourceBusinessClass,
  resourceCapacityEligible,
  type CanonicalResource,
  type CanonicalResourceAssignment,
  type CanonicalResourceModel,
  type ResourceBusinessClass,
} from "../../schedule-resource-core/src";
import type {
  ResourceUtilizationProjection,
  ResourceUtilizationRow,
} from "./types";

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function aggregate(
  assignments: readonly CanonicalResourceAssignment[],
  value: (
    assignment: CanonicalResourceAssignment,
  ) => number | null,
): {
  sum: number;
  knownCount: number;
  coveragePercent: number | null;
} {
  let sum = 0;
  let knownCount = 0;

  for (const assignment of assignments) {
    const item = value(assignment);
    if (item === null) continue;
    sum += item;
    knownCount += 1;
  }

  return {
    sum: Number(sum.toFixed(6)),
    knownCount,
    coveragePercent: coverage(
      knownCount,
      assignments.length,
    ),
  };
}

function actualUnits(
  assignment: CanonicalResourceAssignment,
): number | null {
  if (
    assignment.actualRegularUnits === null ||
    assignment.actualOvertimeUnits === null
  ) {
    return null;
  }

  return (
    assignment.actualRegularUnits +
    assignment.actualOvertimeUnits
  );
}

function atCompletionUnits(
  assignment: CanonicalResourceAssignment,
): number | null {
  if (assignment.atCompletionUnits !== null) {
    return assignment.atCompletionUnits;
  }

  const actual = actualUnits(assignment);
  if (
    actual === null ||
    assignment.remainingUnits === null
  ) {
    return null;
  }

  return actual + assignment.remainingUnits;
}

function calendarFor(
  assignment: CanonicalResourceAssignment,
  resource: CanonicalResource,
  schedule: CanonicalScheduleModel,
): {
  calendar: CanonicalCalendar | null;
  assumption: string | null;
} {
  const activity =
    schedule.activities.find(
      (item) =>
        item.activityId ===
        assignment.activityId,
    );

  const calendarId =
    resource.calendarId ??
    activity?.calendarId ??
    null;

  const calendar = calendarId
    ? schedule.calendars.find(
        (item) =>
          item.calendarId === calendarId &&
          item.semanticComplete &&
          item.weeklyWorkIntervals?.some(
            (day) =>
              day.intervals.length > 0,
          ),
      ) ?? null
    : null;

  if (calendar) {
    return {
      calendar,
      assumption: null,
    };
  }

  return {
    calendar: null,
    assumption:
      "RESOURCE_RATE_DERIVATION_CALENDAR_UNRESOLVED",
  };
}

function derivedRate(
  units: number | null,
  explicitRate: number | null,
  startIso: string | null,
  finishIso: string | null,
  assignment: CanonicalResourceAssignment,
  resource: CanonicalResource,
  schedule: CanonicalScheduleModel,
): {
  rate: number | null;
  assumption: string | null;
} {
  if (explicitRate !== null) {
    return {
      rate: explicitRate,
      assumption: null,
    };
  }

  if (
    units === null ||
    startIso === null ||
    finishIso === null
  ) {
    return {
      rate: null,
      assumption: null,
    };
  }

  const start = parseScheduleInstant(startIso);
  const finish = parseScheduleInstant(finishIso);
  if (
    start === null ||
    finish === null ||
    finish <= start
  ) {
    return {
      rate: null,
      assumption: null,
    };
  }

  const resolved = calendarFor(
    assignment,
    resource,
    schedule,
  );
  if (!resolved.calendar) {
    return { rate: null, assumption: resolved.assumption };
  }

  const hours = workingHoursBetween(
    resolved.calendar,
    start,
    finish,
  );

  if (hours <= 0) {
    return {
      rate: null,
      assumption: resolved.assumption,
    };
  }

  return {
    rate: units / hours,
    assumption: resolved.assumption,
  };
}

function peakRate(
  assignments: readonly CanonicalResourceAssignment[],
  resource: CanonicalResource,
  schedule: CanonicalScheduleModel,
  mode: "planned" | "remaining",
): {
  peak: number | null;
  peakAtIso: string | null;
  knownCount: number;
  coveragePercent: number | null;
  assumptions: string[];
} {
  const events: Array<{
    ms: number;
    delta: number;
    order: 0 | 1;
  }> = [];
  let knownCount = 0;
  const assumptions: string[] = [];

  for (const assignment of assignments) {
    const units =
      mode === "planned"
        ? assignment.plannedUnits
        : assignment.remainingUnits;
    const explicitRate =
      mode === "planned"
        ? assignment.plannedUnitsPerHour
        : assignment.remainingUnitsPerHour;
    const startIso =
      mode === "planned"
        ? assignment.plannedStartIso
        : assignment.remainingStartIso;
    const finishIso =
      mode === "planned"
        ? assignment.plannedFinishIso
        : assignment.remainingFinishIso;

    const start = parseScheduleInstant(
      startIso,
    );
    const finish = parseScheduleInstant(
      finishIso,
    );

    if (
      start === null ||
      finish === null ||
      finish < start
    ) {
      continue;
    }

    const resolved = derivedRate(
      units,
      explicitRate,
      startIso,
      finishIso,
      assignment,
      resource,
      schedule,
    );

    if (
      resolved.assumption !== null
    ) {
      assumptions.push(
        resolved.assumption,
      );
    }

    if (
      resolved.rate === null ||
      !Number.isFinite(resolved.rate)
    ) {
      continue;
    }

    knownCount += 1;
    events.push({
      ms: start,
      delta: resolved.rate,
      order: 1,
    });
    events.push({
      ms: finish,
      delta: -resolved.rate,
      order: 0,
    });
  }

  events.sort(
    (a, b) =>
      a.ms - b.ms ||
      a.order - b.order,
  );

  let current = 0;
  let peak = 0;
  let peakAt: number | null = null;

  for (const event of events) {
    current += event.delta;
    if (current > peak) {
      peak = current;
      peakAt = event.ms;
    }
  }

  return {
    peak:
      knownCount === 0
        ? null
        : Number(peak.toFixed(6)),
    peakAtIso:
      knownCount === 0 || peakAt === null
        ? null
        : new Date(peakAt).toISOString(),
    knownCount,
    coveragePercent: coverage(
      knownCount,
      assignments.length,
    ),
    assumptions: [
      ...new Set(assumptions),
    ],
  };
}

function effectiveCapacity(
  resource: CanonicalResource,
  dataDateIso: string | null,
): {
  value: number | null;
  effectiveDateIso: string | null;
} {
  const valid = resource.rates.filter(
    (rate) =>
      rate.maxUnitsPerHour !== null &&
      rate.maxUnitsPerHour >= 0,
  );

  if (valid.length === 0) {
    return {
      value: null,
      effectiveDateIso: null,
    };
  }

  if (dataDateIso === null) {
    if (valid.length !== 1) {
      return {
        value: null,
        effectiveDateIso: null,
      };
    }

    return {
      value:
        valid[0]!.maxUnitsPerHour,
      effectiveDateIso:
        valid[0]!.effectiveDateIso,
    };
  }

  const dataDate = Date.parse(dataDateIso);
  if (!Number.isFinite(dataDate)) {
    return {
      value: null,
      effectiveDateIso: null,
    };
  }

  const eligible = valid
    .filter((rate) => {
      if (
        rate.effectiveDateIso === null
      ) {
        return true;
      }
      const effective = Date.parse(
        rate.effectiveDateIso,
      );
      return (
        Number.isFinite(effective) &&
        effective <= dataDate
      );
    })
    .sort((a, b) => {
      const aMs =
        a.effectiveDateIso === null
          ? Number.NEGATIVE_INFINITY
          : Date.parse(
              a.effectiveDateIso,
            );
      const bMs =
        b.effectiveDateIso === null
          ? Number.NEGATIVE_INFINITY
          : Date.parse(
              b.effectiveDateIso,
            );
      return aMs - bMs;
    });

  const selected =
    eligible[eligible.length - 1];

  return selected
    ? {
        value:
          selected.maxUnitsPerHour,
        effectiveDateIso:
          selected.effectiveDateIso,
      }
    : {
        value: null,
        effectiveDateIso: null,
      };
}

function percentage(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator <= 0
  ) {
    return null;
  }

  return Number(
    ((numerator / denominator) * 100).toFixed(6),
  );
}

export function buildResourceUtilizationProjection(
  resources: CanonicalResourceModel,
  schedule: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    capacityConfirmations?:Array<{resourceId:string;capacityUnitsPerHour:number;effectiveFromIso:string;approvedBy:string;sourceRef:string}>;
  },
): ResourceUtilizationProjection {
  if (
    resources.sourceRevisionId !==
    schedule.sourceRevisionId
  ) {
    throw new Error(
      "Resource Utilization requires resource and schedule models from the same revision",
    );
  }

  const assignmentByResource =
    new Map<
      string,
      CanonicalResourceAssignment[]
    >();

  for (const assignment of resources.assignments) {
    if (!assignment.resourceId) continue;
    const list =
      assignmentByResource.get(
        assignment.resourceId,
      ) ?? [];
    list.push(assignment);
    assignmentByResource.set(
      assignment.resourceId,
      list,
    );
  }

  const activityById = new Map(
    schedule.activities.map(activity => [activity.activityId, activity]),
  );

  const rows: ResourceUtilizationRow[] =
    resources.resources.map((resource) => {
      const assignments =
        assignmentByResource.get(
          resource.resourceId,
        ) ?? [];

      const businessClass =
        resourceBusinessClass(resource);
      const canAssessCapacity =
        resourceCapacityEligible(businessClass);

      const planned = aggregate(
        assignments,
        (assignment) =>
          assignment.plannedUnits,
      );
      const actual = aggregate(
        assignments,
        actualUnits,
      );
      const remaining = aggregate(
        assignments,
        (assignment) =>
          assignment.remainingUnits,
      );
      const atCompletion = aggregate(
        assignments,
        atCompletionUnits,
      );

      const plannedPeak = canAssessCapacity
        ? peakRate(
            assignments,
            resource,
            schedule,
            "planned",
          )
        : {
            peak: null,
            peakAtIso: null,
            knownCount: 0,
            coveragePercent: null,
            assumptions: [],
          };
      const remainingPeak = canAssessCapacity
        ? peakRate(
            assignments,
            resource,
            schedule,
            "remaining",
          )
        : {
            peak: null,
            peakAtIso: null,
            knownCount: 0,
            coveragePercent: null,
            assumptions: [],
          };

      // P6 maxUnitsPerHour is a supplied rate, not approval of deployable crew capacity.
      // Keep those rates in the retained resource source; do not infer overload from them.
      // Only a separately governed and approved capacity source can establish a verdict.
      const sourceRate = canAssessCapacity ? effectiveCapacity(resource, schedule.dataDateIso) : {value:null,effectiveDateIso:null};
      const confirmation=(input.capacityConfirmations??[])
        .filter(row=>row.resourceId===resource.resourceId&&
          row.effectiveFromIso<=(schedule.dataDateIso?.slice(0,10)??'9999-12-31'))
        .sort((a,b)=>b.effectiveFromIso.localeCompare(a.effectiveFromIso))[0]??null;
      const capacity={value:confirmation?.capacityUnitsPerHour??null,
        effectiveDateIso:confirmation?.effectiveFromIso??null};

      const plannedUtilization = canAssessCapacity
        ? percentage(
            plannedPeak.peak,
            capacity.value,
          )
        : null;
      const remainingUtilization = canAssessCapacity
        ? percentage(
            remainingPeak.peak,
            capacity.value,
          )
        : null;

      const affectedActivityIds = [...new Set(assignments.map(assignment => assignment.activityId).filter(Boolean))];
      const affectedWbsIds = [...new Set(affectedActivityIds.map(id => activityById.get(id)?.wbsId ?? null).filter((id): id is string => Boolean(id)))];
      const affectedActivities = affectedActivityIds.map(id => activityById.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
      const pressureCount = affectedActivities.filter(activity => typeof activity.totalFloatHours === "number" && activity.totalFloatHours <= 0).length;
      const programmeEffect = affectedActivities.length === 0 ? null : pressureCount > 0
        ? String(pressureCount) + " affected activity(ies) are on submitted critical/negative-float scope."
        : "Affected programme scope is identified; project-completion effect is not established from resource evidence alone.";
      const remainingCapacityGapUnitsPerHour =
        canAssessCapacity && remainingPeak.peak !== null && capacity.value !== null
          ? Number((remainingPeak.peak - capacity.value).toFixed(6))
          : null;
      const managementAction =
        !canAssessCapacity
          ? null
          : remainingCapacityGapUnitsPerHour !== null && remainingCapacityGapUnitsPerHour > 0
            ? 'Mobilise, reallocate or resequence this resource before the affected workfront demand peaks.'
            : capacity.value === null
              ? 'Obtain an approved capacity basis; P6 rates are retained as source assumptions, not crew limits.'
              : 'Monitor the resource against its remaining-work peak and affected activities.';

      return {
        resourceId: resource.resourceId,
        resourceName:
          resource.name ??
          resource.shortName,
        resourceType:
          resource.resourceType,
        businessClass,
        capacityEligible: canAssessCapacity,
        assignmentCount:
          assignments.length,

        plannedUnitsKnown:
          planned.sum,
        plannedUnitsKnownCount:
          planned.knownCount,
        plannedUnitsCoveragePercent:
          planned.coveragePercent,

        actualUnitsKnown:
          actual.sum,
        actualUnitsKnownCount:
          actual.knownCount,
        actualUnitsCoveragePercent:
          actual.coveragePercent,

        remainingUnitsKnown:
          remaining.sum,
        remainingUnitsKnownCount:
          remaining.knownCount,
        remainingUnitsCoveragePercent:
          remaining.coveragePercent,

        atCompletionUnitsKnownOrDerived:
          atCompletion.sum,
        atCompletionUnitsKnownCount:
          atCompletion.knownCount,
        atCompletionUnitsCoveragePercent:
          atCompletion.coveragePercent,

        peakPlannedUnitsPerHour:
          plannedPeak.peak,
        peakRemainingUnitsPerHour:
          remainingPeak.peak,
        peakPlannedRateCoveragePercent:
          plannedPeak.coveragePercent,
        peakRemainingRateCoveragePercent:
          remainingPeak.coveragePercent,

        capacityUnitsPerHour:
          capacity.value,
        p6RateUnitsPerHour:sourceRate.value,
        capacityAuthority:confirmation?'project_confirmed':'not_approved',
        capacitySourceRef:confirmation?.sourceRef??null,
        capacityEffectiveDateIso:
          capacity.effectiveDateIso,
        plannedUtilizationPercent:
          plannedUtilization,
        remainingUtilizationPercent:
          remainingUtilization,
        overloaded:
          remainingUtilization === null
            ? null
            : remainingUtilization > 100,
        remainingCapacityGapUnitsPerHour,
        peakRemainingAtIso: remainingPeak.peakAtIso,
        affectedActivityIds,
        affectedWbsIds,
        managementAction,
        programmeEffect,
        state:
          assignments.length === 0
            ? "no_assignments"
            : !canAssessCapacity
              ? "not_capacity_resource"
              : capacity.value === null
                ? "demand_only"
                : "capacity_based",
        assumptions: [
          ...new Set([
            ...plannedPeak.assumptions,
            ...remainingPeak.assumptions,
          ]),
        ],
      };
    });

  const assigned = rows.filter(
    (row) => row.assignmentCount > 0,
  );
  const capacityEligibleRows = assigned.filter(
    (row) => row.capacityEligible,
  );
  const capacityBased = capacityEligibleRows.filter(
    (row) =>
      row.state === "capacity_based",
  );
  const businessClassCounts = rows.reduce(
    (counts, row) => {
      counts[row.businessClass] += 1;
      return counts;
    },
    {
      labor: 0,
      equipment: 0,
      material: 0,
      cost: 0,
      quantity: 0,
      weight_progress: 0,
      other: 0,
    } as Record<ResourceBusinessClass, number>,
  );

  return {
    schemaVersion: "1.0",
    projectionKey: "resource_utilization",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId:
      resources.projectId ??
      schedule.projectId,
    sourceRevisionId:
      resources.sourceRevisionId,
    dataDateIso:
      schedule.dataDateIso,
    resourceCount: rows.length,
    assignedResourceCount:
      assigned.length,
    assignmentRecordCount:
      resources.assignments.length,
    resourcePopulationBasis:
      "p6_resource_master",
    capacityBasedResourceCount:
      capacityBased.length,
    capacityEligibleResourceCount:
      capacityEligibleRows.length,
    capacityCoveragePercent:
      coverage(
        capacityBased.length,
        capacityEligibleRows.length,
      ),
    businessClassCounts,
    overloadedResourceCount:
      capacityBased.filter(
        (row) =>
          row.overloaded === true,
      ).length,
    rows,
    diagnostics: [
      ...resources.diagnostics,
    ],
  };
}
