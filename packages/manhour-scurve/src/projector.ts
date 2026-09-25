import { parseScheduleTime } from "../../schedule-analysis-core/src";
import type {
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  CanonicalResource,
  CanonicalResourceAssignment,
  CanonicalResourceModel,
  CanonicalResourcePeriodActual,
} from "../../schedule-resource-core/src";
import type {
  ManhourScurvePoint,
  ManhourScurveProjection,
  ManhourSeriesState,
} from "./types";

interface PhasedAssignment {
  assignmentId: string;
  units: number;
  startMs: number;
  finishMs: number;
}

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseScheduleTime(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function isoDate(value: number): string {
  return new Date(value)
    .toISOString()
    .slice(0, 10);
}

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function state(
  known: number,
  total: number,
): ManhourSeriesState {
  if (known === 0) return "missing";
  return known === total
    ? "complete"
    : "partial";
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

function phaseAssignments(
  assignments: readonly CanonicalResourceAssignment[],
  mode: "planned" | "remaining",
  assumptions: string[],
): {
  phased: PhasedAssignment[];
  knownUnitsCount: number;
  timePhasedCount: number;
  unitsKnown: number;
} {
  const phased: PhasedAssignment[] = [];
  let knownUnitsCount = 0;
  let timePhasedCount = 0;
  let unitsKnown = 0;

  for (const assignment of assignments) {
    const units =
      mode === "planned"
        ? assignment.plannedUnits
        : assignment.remainingUnits;
    const startIso =
      mode === "planned"
        ? assignment.plannedStartIso
        : assignment.remainingStartIso;
    const finishIso =
      mode === "planned"
        ? assignment.plannedFinishIso
        : assignment.remainingFinishIso;

    if (units !== null) {
      knownUnitsCount += 1;
      unitsKnown += units;
    }

    if (
      units === null ||
      units < 0
    ) {
      continue;
    }

    const startMs = ms(startIso);
    const finishMs = ms(finishIso);

    if (
      startMs === null ||
      finishMs === null ||
      finishMs < startMs
    ) {
      continue;
    }

    if (assignment.curveId) {
      assumptions.push(
        "RESOURCE_CURVE_" +
          assignment.curveId +
          "_NOT_PARSED_LINEAR_TIME_PHASING_USED",
      );
    }

    phased.push({
      assignmentId:
        assignment.assignmentId,
      units,
      startMs,
      finishMs,
    });
    timePhasedCount += 1;
  }

  return {
    phased,
    knownUnitsCount,
    timePhasedCount,
    unitsKnown: Number(
      unitsKnown.toFixed(6),
    ),
  };
}

function phasedCumulative(
  assignments: readonly PhasedAssignment[],
  pointMs: number,
): number | null {
  if (assignments.length === 0) return null;

  let total = 0;

  for (const assignment of assignments) {
    if (pointMs < assignment.startMs) {
      continue;
    }

    if (
      pointMs >= assignment.finishMs ||
      assignment.finishMs ===
        assignment.startMs
    ) {
      total += assignment.units;
      continue;
    }

    const fraction =
      (pointMs - assignment.startMs) /
      (assignment.finishMs -
        assignment.startMs);

    total +=
      assignment.units *
      Math.max(0, Math.min(1, fraction));
  }

  return Number(total.toFixed(6));
}

function laborResourceIds(
  resources: readonly CanonicalResource[],
): Set<string> {
  return new Set(
    resources
      .filter(
        (resource) =>
          resource.resourceType === "labor",
      )
      .map(
        (resource) =>
          resource.resourceId,
      ),
  );
}

function actualPeriodHistory(
  actuals: readonly CanonicalResourcePeriodActual[],
  laborIds: ReadonlySet<string>,
  dataDateIso: string | null,
): {
  history: Array<{
    periodEndIso: string;
    units: number;
  }>;
  excludedFuturePeriodActualCount: number;
} {
  const byEnd = new Map<string, number>();
  const dataDateMs = ms(dataDateIso);
  let excludedFuturePeriodActualCount = 0;

  for (const actual of actuals) {
    if (
      actual.resourceId === null ||
      !laborIds.has(actual.resourceId) ||
      actual.periodEndIso === null ||
      actual.actualUnits === null
    ) {
      continue;
    }

    const periodEndMs = ms(actual.periodEndIso);
    if (
      dataDateMs !== null &&
      periodEndMs !== null &&
      periodEndMs > dataDateMs
    ) {
      excludedFuturePeriodActualCount += 1;
      continue;
    }

    byEnd.set(
      actual.periodEndIso,
      (byEnd.get(actual.periodEndIso) ?? 0) +
        actual.actualUnits,
    );
  }

  return {
    history: [...byEnd.entries()]
      .map(([periodEndIso, units]) => ({
        periodEndIso,
        units,
      }))
      .sort(
        (a, b) =>
          parseScheduleTime(a.periodEndIso) -
          parseScheduleTime(b.periodEndIso),
      ),
    excludedFuturePeriodActualCount,
  };
}

function periodCumulativeAt(
  history: readonly {
    periodEndIso: string;
    units: number;
  }[],
  pointMs: number,
): number | null {
  let total = 0;
  let established = false;

  for (const period of history) {
    const endMs = ms(period.periodEndIso);
    if (
      endMs !== null &&
      endMs <= pointMs
    ) {
      total += period.units;
      established = true;
    }
  }

  return established
    ? Number(total.toFixed(6))
    : null;
}

function uniqueTimeline(
  planned: readonly PhasedAssignment[],
  remaining: readonly PhasedAssignment[],
  history: readonly {
    periodEndIso: string;
    units: number;
  }[],
  dataDateIso: string | null,
  intervalDays: number,
): number[] {
  const anchors = [
    ...planned.flatMap(
      (assignment) => [
        assignment.startMs,
        assignment.finishMs,
      ],
    ),
    ...remaining.flatMap(
      (assignment) => [
        assignment.startMs,
        assignment.finishMs,
      ],
    ),
    ...history
      .map((period) =>
        ms(period.periodEndIso),
      )
      .filter(
        (value): value is number =>
          value !== null,
      ),
    ...(dataDateIso
      ? [ms(dataDateIso)]
      : []),
  ].filter(
    (value): value is number =>
      value !== null,
  );

  if (anchors.length === 0) return [];

  const start = Math.min(...anchors);
  const finish = Math.max(...anchors);
  const step =
    intervalDays * 86_400_000;
  const points: number[] = [];

  for (
    let point = start;
    point <= finish;
    point += step
  ) {
    points.push(point);
  }

  points.push(...anchors);

  return [...new Set(points)].sort(
    (a, b) => a - b,
  );
}

export function buildManhourScurveProjection(
  resources: CanonicalResourceModel,
  schedule: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    intervalDays?: number;
  },
): ManhourScurveProjection {
  if (
    resources.sourceRevisionId !==
    schedule.sourceRevisionId
  ) {
    throw new Error(
      "Man-Hour S-Curve requires resource and schedule models from the same revision",
    );
  }

  const intervalDays =
    input.intervalDays ?? 7;

  if (
    !Number.isSafeInteger(intervalDays) ||
    intervalDays <= 0
  ) {
    throw new Error(
      "Man-Hour S-Curve intervalDays must be a positive integer",
    );
  }

  const laborIds =
    laborResourceIds(
      resources.resources,
    );

  const laborAssignments =
    resources.assignments.filter(
      (assignment) =>
        (
          assignment.resourceId !== null &&
          laborIds.has(
            assignment.resourceId,
          )
        ) ||
        (
          assignment.resourceId === null &&
          assignment.resourceType === "labor"
        ),
    );

  const assumptions: string[] = [];

  const planned = phaseAssignments(
    laborAssignments,
    "planned",
    assumptions,
  );
  const remaining = phaseAssignments(
    laborAssignments,
    "remaining",
    assumptions,
  );

  let currentActualHours = 0;
  let currentActualKnownCount = 0;

  for (const assignment of laborAssignments) {
    const actual = actualUnits(assignment);
    if (actual === null) continue;
    currentActualHours += actual;
    currentActualKnownCount += 1;
  }

  currentActualHours = Number(
    currentActualHours.toFixed(6),
  );

  const periodHistoryResult =
    actualPeriodHistory(
      resources.periodActuals,
      laborIds,
      schedule.dataDateIso,
    );
  const periodHistory =
    periodHistoryResult.history;

  const assignmentsWithPeriodActual =
    new Set(
      resources.periodActuals
        .filter(
          (actual) =>
            actual.resourceId !== null &&
            laborIds.has(
              actual.resourceId,
            ) &&
            actual.actualUnits !== null,
        )
        .map(
          (actual) =>
            actual.assignmentId,
        ),
    );

  const timeline = uniqueTimeline(
    planned.phased,
    remaining.phased,
    periodHistory,
    schedule.dataDateIso,
    intervalDays,
  );

  const dataDateMs =
    ms(schedule.dataDateIso);

  const points: ManhourScurvePoint[] =
    timeline.map((pointMs) => {
      const plannedValue =
        phasedCumulative(
          planned.phased,
          pointMs,
        );

      let actualValue = dataDateMs !== null && pointMs <= dataDateMs
        ? periodCumulativeAt(
          periodHistory,
          pointMs,
        ) : null;

      if (
        dataDateMs !== null &&
        pointMs === dataDateMs &&
        currentActualKnownCount > 0
      ) {
        actualValue =
          currentActualHours;
      }

      let forecastValue: number | null = null;

      if (
        dataDateMs !== null &&
        currentActualKnownCount > 0
      ) {
        if (pointMs <= dataDateMs) {
          forecastValue = actualValue;
        } else {
          const atPoint =
            phasedCumulative(
              remaining.phased,
              pointMs,
            );
          const atDataDate =
            phasedCumulative(
              remaining.phased,
              dataDateMs,
            );

          if (atPoint === null) {
            forecastValue =
              currentActualHours;
          } else {
            const incrementalRemaining =
              Math.max(
                0,
                atPoint -
                  (atDataDate ?? 0),
              );

            forecastValue = Number(
              (
                currentActualHours +
                incrementalRemaining
              ).toFixed(6),
            );
          }
        }
      }

      return {
        dateIso: isoDate(pointMs),
        plannedCumulativeHours:
          plannedValue,
        actualCumulativeHours:
          actualValue,
        forecastCumulativeHours:
          forecastValue,
      };
    });

  const plannedState = state(
    planned.knownUnitsCount,
    laborAssignments.length,
  );
  const actualState = state(
    currentActualKnownCount,
    laborAssignments.length,
  );
  const remainingState = state(
    remaining.knownUnitsCount,
    laborAssignments.length,
  );
  const forecastState: ManhourSeriesState =
    actualState === "missing"
      ? "missing"
      : actualState === "complete" &&
          remainingState === "complete"
        ? "complete"
        : "partial";

  const diagnostics: string[] = [];

  if (
    periodHistoryResult
      .excludedFuturePeriodActualCount > 0
  ) {
    diagnostics.push(
      "MANHOUR_PERIOD_ACTUALS_AFTER_DATA_DATE_EXCLUDED:" +
        periodHistoryResult
          .excludedFuturePeriodActualCount,
    );
  }

  if (
    periodHistory.length === 0 &&
    currentActualKnownCount > 0
  ) {
    diagnostics.push(
      "MANHOUR_ACTUAL_HISTORY_NOT_RECONSTRUCTED_FROM_CURRENT_TOTAL",
    );
  }

  if (
    remaining.timePhasedCount <
    remaining.knownUnitsCount
  ) {
    diagnostics.push(
      "MANHOUR_REMAINING_UNITS_HAVE_MISSING_OR_INVALID_DATES",
    );
  }

  if (
    planned.timePhasedCount <
    planned.knownUnitsCount
  ) {
    diagnostics.push(
      "MANHOUR_PLANNED_UNITS_HAVE_MISSING_OR_INVALID_DATES",
    );
  }

  return {
    schemaVersion: "1.0",
    projectionKey: "manhour_scurve",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId:
      resources.projectId ??
      schedule.projectId,
    sourceRevisionId:
      resources.sourceRevisionId,
    dataDateIso:
      schedule.dataDateIso,
    unitBasis:
      "p6_labor_assignment_work_units_as_hours",
    plannedTimePhasing:
      "linear_between_assignment_dates",
    remainingTimePhasing:
      "linear_between_remaining_assignment_dates",
    actualHistoryMethod:
      periodHistory.length > 0
        ? "stored_financial_period_actuals"
        : currentActualKnownCount > 0
          ? "current_actual_snapshot_only"
          : "missing",

    laborResourceCount:
      laborIds.size,
    laborAssignmentCount:
      laborAssignments.length,

    plannedHoursKnown:
      planned.knownUnitsCount > 0
        ? planned.unitsKnown
        : null,
    plannedAssignmentCoveragePercent:
      coverage(
        planned.knownUnitsCount,
        laborAssignments.length,
      ),
    plannedCurveCoveragePercent:
      coverage(
        planned.timePhasedCount,
        laborAssignments.length,
      ),
    plannedState,

    actualHoursKnownCurrent:
      currentActualKnownCount > 0
        ? currentActualHours
        : null,
    actualAssignmentCoveragePercent:
      coverage(
        currentActualKnownCount,
        laborAssignments.length,
      ),
    periodActualAssignmentCoveragePercent:
      coverage(
        assignmentsWithPeriodActual.size,
        laborAssignments.length,
      ),
    actualState,

    remainingHoursKnown:
      remaining.knownUnitsCount > 0
        ? remaining.unitsKnown
        : null,
    remainingAssignmentCoveragePercent:
      coverage(
        remaining.knownUnitsCount,
        laborAssignments.length,
      ),
    remainingCurveCoveragePercent:
      coverage(
        remaining.timePhasedCount,
        laborAssignments.length,
      ),
    forecastState,

    points,
    assumptions: [
      ...new Set(assumptions),
    ],
    diagnostics,
  };
}
