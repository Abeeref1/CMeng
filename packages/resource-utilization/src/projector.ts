import type {
  CanonicalCalendar,
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import {
  ELAPSED_24H_CALENDAR,
  parseScheduleInstant,
  workingHoursBetween,
} from "../../schedule-cpm/src";
import type {
  CanonicalResource,
  CanonicalResourceAssignment,
  CanonicalResourceModel,
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
  calendar: CanonicalCalendar;
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
    calendar: ELAPSED_24H_CALENDAR,
    assumption:
      "RESOURCE_RATE_DERIVATION_USED_24H_ELAPSED_FALLBACK",
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

  for (const event of events) {
    current += event.delta;
    peak = Math.max(peak, current);
  }

  return {
    peak:
      knownCount === 0
        ? null
        : Number(peak.toFixed(6)),
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

  const rows: ResourceUtilizationRow[] =
    resources.resources.map((resource) => {
      const assignments =
        assignmentByResource.get(
          resource.resourceId,
        ) ?? [];

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

      const plannedPeak = peakRate(
        assignments,
        resource,
        schedule,
        "planned",
      );
      const remainingPeak = peakRate(
        assignments,
        resource,
        schedule,
        "remaining",
      );

      const capacity =
        effectiveCapacity(
          resource,
          schedule.dataDateIso,
        );

      const plannedUtilization =
        percentage(
          plannedPeak.peak,
          capacity.value,
        );
      const remainingUtilization =
        percentage(
          remainingPeak.peak,
          capacity.value,
        );

      return {
        resourceId: resource.resourceId,
        resourceName:
          resource.name ??
          resource.shortName,
        resourceType:
          resource.resourceType,
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
        state:
          assignments.length === 0
            ? "no_assignments"
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
  const capacityBased = assigned.filter(
    (row) =>
      row.state === "capacity_based",
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
    capacityBasedResourceCount:
      capacityBased.length,
    capacityCoveragePercent:
      coverage(
        capacityBased.length,
        assigned.length,
      ),
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
