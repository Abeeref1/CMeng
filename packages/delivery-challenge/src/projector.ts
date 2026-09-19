import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import {
  buildQuantityScheduleMapping,
  type QuantityScheduleMappingResult,
} from "../../cross-domain-mapping/src";
import type {
  ContractTimeBasis,
} from "../../eot-assessment/src";
import type {
  IndependentForecastProjection,
} from "../../independent-forecast/src";
import type {
  CanonicalQuantityProgressModel,
  InstalledQuantitySnapshot,
} from "../../quantity-progress-core/src";
import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  CanonicalResource,
  CanonicalResourceAssignment,
  CanonicalResourceModel,
} from "../../schedule-resource-core/src";
import type {
  DeliveryChallengeFinding,
  DeliveryChallengePosition,
  DeliveryChallengeProjection,
  ProductivityUnitChallengeRow,
  QuantityUnitChallengeRow,
  SubmittedManpowerPlan,
} from "./types";

const DAY_MS = 86_400_000;

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function days(
  from: string | null,
  to: string | null,
): number | null {
  const a = ms(from);
  const b = ms(to);
  if (a === null || b === null) return null;
  return Number(
    ((b - a) / DAY_MS).toFixed(6),
  );
}

function ratioPercent(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator === 0
  ) return null;
  return Number(
    ((numerator / denominator) * 100).toFixed(4),
  );
}

function unitKey(
  value: string | null,
): string {
  const normalized =
    (value ?? "")
      .normalize("NFKC")
      .trim()
      .toUpperCase();
  return normalized || "UNSPECIFIED";
}

function activityInterval(
  activity: CanonicalScheduleActivity,
  dataDateIso: string | null,
): { start: number; finish: number } | null {
  if (
    activity.activityType !== "task" ||
    activity.status === "completed"
  ) return null;

  const dataDate = ms(dataDateIso);
  const start =
    ms(
      activity.forecastStartIso ??
      activity.currentStartIso ??
      activity.actualStartIso,
    ) ??
    dataDate;
  const finish =
    ms(
      activity.forecastFinishIso ??
      activity.currentFinishIso,
    );

  if (
    start === null ||
    finish === null ||
    finish <= start
  ) return null;

  return {
    start:
      dataDate === null
        ? start
        : Math.max(start, dataDate),
    finish,
  };
}

function concurrency(
  schedule: CanonicalScheduleModel,
): {
  average: number | null;
  peak: number | null;
  activityCount: number;
} {
  const intervals =
    schedule.activities
      .map(
        (activity) =>
          activityInterval(
            activity,
            schedule.dataDateIso,
          ),
      )
      .filter(
        (
          value,
        ): value is {
          start: number;
          finish: number;
        } => value !== null,
      );

  if (intervals.length === 0) {
    return {
      average: null,
      peak: null,
      activityCount: 0,
    };
  }

  const events:
    Array<{
      at: number;
      delta: number;
      order: 0 | 1;
    }> = [];

  for (const interval of intervals) {
    events.push({
      at: interval.start,
      delta: 1,
      order: 1,
    });
    events.push({
      at: interval.finish,
      delta: -1,
      order: 0,
    });
  }

  events.sort(
    (a, b) =>
      a.at - b.at ||
      a.order - b.order,
  );

  let current = 0;
  let peak = 0;
  let weighted = 0;
  let previous =
    events[0]!.at;

  for (const event of events) {
    const duration =
      event.at - previous;
    if (duration > 0) {
      weighted +=
        current * duration;
    }
    current += event.delta;
    peak = Math.max(
      peak,
      current,
    );
    previous = event.at;
  }

  const span =
    events.at(-1)!.at -
    events[0]!.at;

  return {
    average:
      span <= 0
        ? null
        : Number(
            (
              weighted / span
            ).toFixed(4),
          ),
    peak,
    activityCount:
      intervals.length,
  };
}

function latestSnapshots(
  model: CanonicalQuantityProgressModel,
): Map<
  string,
  InstalledQuantitySnapshot
> {
  const map =
    new Map<
      string,
      InstalledQuantitySnapshot
    >();

  for (const snapshot of model.installedSnapshots) {
    const previous =
      map.get(
        snapshot.quantityItemId,
      );
    if (
      !previous ||
      snapshot.asOfIso >
        previous.asOfIso
    ) {
      map.set(
        snapshot.quantityItemId,
        snapshot,
      );
    }
  }
  return map;
}

function selectedItems(
  mapping: QuantityScheduleMappingResult,
): Set<string> {
  return new Set(
    mapping.selectedScenarioLinks.map(
      (row) =>
        row.quantityItemId,
    ),
  );
}

function quantityRows(
  quantities: CanonicalQuantityProgressModel,
  mapping: QuantityScheduleMappingResult,
  dataDateIso: string | null,
  contractualCompletionIso: string | null,
  contractorCompletionIso: string | null,
): QuantityUnitChallengeRow[] {
  const snapshots =
    latestSnapshots(quantities);
  const selected =
    selectedItems(mapping);
  const grouped =
    new Map<
      string,
      typeof quantities.items
    >();

  for (const item of quantities.items) {
    if (
      item.contractQuantity === null ||
      item.contractQuantity < 0
    ) continue;
    const key =
      unitKey(item.unit);
    const list =
      grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  const contractDays =
    days(
      dataDateIso,
      contractualCompletionIso,
    );
  const contractorDays =
    days(
      dataDateIso,
      contractorCompletionIso,
    );

  return [
    ...grouped.entries(),
  ]
    .map(([unit, items]) => {
      let contractQuantity = 0;
      let mappedContractQuantity = 0;
      let installedKnown = 0;
      let installedKnownCount = 0;

      for (const item of items) {
        contractQuantity +=
          item.contractQuantity!;
        if (
          selected.has(
            item.quantityItemId,
          )
        ) {
          mappedContractQuantity +=
            item.contractQuantity!;
        }
        const installed =
          snapshots.get(
            item.quantityItemId,
          );
        if (installed) {
          installedKnown +=
            installed.installedQuantity;
          installedKnownCount += 1;
        }
      }

      const allInstalledKnown =
        installedKnownCount ===
        items.length;
      const remainingQuantity =
        allInstalledKnown
          ? Math.max(
              0,
              contractQuantity -
                installedKnown,
            )
          : null;

      return {
        unit,
        contractQuantity:
          Number(
            contractQuantity.toFixed(6),
          ),
        mappedContractQuantity:
          Number(
            mappedContractQuantity.toFixed(6),
          ),
        installedQuantity:
          installedKnownCount === 0
            ? null
            : Number(
                installedKnown.toFixed(6),
              ),
        remainingQuantity:
          remainingQuantity === null
            ? null
            : Number(
                remainingQuantity.toFixed(6),
              ),
        requiredPerDayToContract:
          remainingQuantity !== null &&
          contractDays !== null &&
          contractDays > 0
            ? Number(
                (
                  remainingQuantity /
                  contractDays
                ).toFixed(6),
              )
            : null,
        requiredPerDayToContractorForecast:
          remainingQuantity !== null &&
          contractorDays !== null &&
          contractorDays > 0
            ? Number(
                (
                  remainingQuantity /
                  contractorDays
                ).toFixed(6),
              )
            : null,
        mappingCoveragePercent:
          contractQuantity > 0
            ? Number(
                (
                  (
                    mappedContractQuantity /
                    contractQuantity
                  ) *
                  100
                ).toFixed(4),
              )
            : null,
      };
    })
    .sort(
      (a, b) =>
        a.unit.localeCompare(
          b.unit,
        ),
    );
}

function resourceById(
  resources: CanonicalResourceModel,
): Map<string, CanonicalResource> {
  return new Map(
    resources.resources.map(
      (resource) => [
        resource.resourceId,
        resource,
      ],
    ),
  );
}

function laborAssignments(
  resources: CanonicalResourceModel,
): {
  assignments:
    CanonicalResourceAssignment[];
  diagnostics: string[];
} {
  const byId =
    resourceById(resources);
  const diagnostics: string[] = [];
  const assignments =
    resources.assignments.filter(
      (assignment) => {
        if (
          assignment.resourceType ===
          "labor"
        ) return true;
        const resource =
          assignment.resourceId
            ? byId.get(
                assignment.resourceId,
              )
            : null;
        return (
          resource?.resourceType ===
          "labor"
        );
      },
    );

  for (const assignment of assignments) {
    if (!assignment.resourceId) {
      diagnostics.push(
        "LABOR_ASSIGNMENT_RESOURCE_ID_MISSING",
      );
      continue;
    }
    const resource =
      byId.get(
        assignment.resourceId,
      );
    if (!resource) continue;
    const unit =
      (
        resource.unitAbbreviation ??
        resource.unitName ??
        ""
      )
        .trim()
        .toLowerCase();
    if (
      unit &&
      !/^(h|hr|hrs|hour|hours|mh|manhour|manhours)$/.test(
        unit,
      )
    ) {
      diagnostics.push(
        "LABOR_UNIT_NOT_CONFIRMED_AS_HOURS:" +
          resource.resourceId +
          ":" +
          unit,
      );
    }
  }

  return {
    assignments,
    diagnostics: [
      ...new Set(
        diagnostics,
      ),
    ],
  };
}

function actualLaborUnits(
  assignment:
    CanonicalResourceAssignment,
): number | null {
  const regular =
    assignment.actualRegularUnits;
  const overtime =
    assignment.actualOvertimeUnits;

  if (
    regular === null &&
    overtime === null
  ) return null;

  return (
    (regular ?? 0) +
    (overtime ?? 0)
  );
}

function sumKnown(
  values: Array<number | null>,
): number | null {
  const known =
    values.filter(
      (
        value,
      ): value is number =>
        value !== null &&
        Number.isFinite(value),
    );
  if (known.length === 0) return null;
  return Number(
    known.reduce(
      (sum, value) =>
        sum + value,
      0,
    ).toFixed(6),
  );
}

function productivityRows(
  quantities: CanonicalQuantityProgressModel,
  mapping: QuantityScheduleMappingResult,
  resources: CanonicalResourceModel | null,
): {
  rows: ProductivityUnitChallengeRow[];
  remainingLaborHours: number | null;
  diagnostics: string[];
} {
  if (!resources) {
    return {
      rows: [],
      remainingLaborHours: null,
      diagnostics: [
        "RESOURCE_ASSIGNMENT_EVIDENCE_MISSING",
      ],
    };
  }

  const labor =
    laborAssignments(resources);
  const itemById =
    new Map(
      quantities.items.map(
        (item) => [
          item.quantityItemId,
          item,
        ],
      ),
    );
  const snapshots =
    latestSnapshots(quantities);

  const activityUnits =
    new Map<
      string,
      Set<string>
    >();

  for (
    const link of
      mapping.selectedScenarioLinks
  ) {
    const item =
      itemById.get(
        link.quantityItemId,
      );
    if (!item) continue;
    const unit =
      unitKey(item.unit);
    const set =
      activityUnits.get(
        link.activityId,
      ) ??
      new Set<string>();
    set.add(unit);
    activityUnits.set(
      link.activityId,
      set,
    );
  }

  const diagnostics = [
    ...labor.diagnostics,
  ];

  const crossUnitActivities =
    new Set(
      [...activityUnits.entries()]
        .filter(
          ([, units]) =>
            units.size > 1,
        )
        .map(
          ([activityId]) =>
            activityId,
        ),
    );

  if (
    crossUnitActivities.size > 0
  ) {
    diagnostics.push(
      "MAPPED_ACTIVITY_SERVES_MULTIPLE_QUANTITY_UNITS_PRODUCTIVITY_EXCLUDED:" +
        [...crossUnitActivities]
          .sort()
          .join(","),
    );
  }

  const byUnit =
    new Map<
      string,
      {
        quantityItemIds: Set<string>;
        activityIds: Set<string>;
        plannedQuantity: number;
        measuredInstalled: number;
        installedKnownCount: number;
      }
    >();

  for (
    const link of
      mapping.selectedScenarioLinks
  ) {
    const item =
      itemById.get(
        link.quantityItemId,
      );
    if (!item) continue;
    const unit =
      unitKey(item.unit);
    const group =
      byUnit.get(unit) ?? {
        quantityItemIds:
          new Set<string>(),
        activityIds:
          new Set<string>(),
        plannedQuantity: 0,
        measuredInstalled: 0,
        installedKnownCount: 0,
      };
    group.quantityItemIds.add(
      item.quantityItemId,
    );
    group.activityIds.add(
      link.activityId,
    );
    if (
      link.allocatedQuantity !==
      null
    ) {
      group.plannedQuantity +=
        link.allocatedQuantity;
    }
    byUnit.set(unit, group);
  }

  for (
    const [unit, group] of
      byUnit
  ) {
    for (
      const itemId of
        group.quantityItemIds
    ) {
      const snapshot =
        snapshots.get(itemId);
      if (snapshot) {
        group.measuredInstalled +=
          snapshot.installedQuantity;
        group.installedKnownCount +=
          1;
      }
    }
    byUnit.set(unit, group);
  }

  const rows:
    ProductivityUnitChallengeRow[] =
    [];

  for (
    const [unit, group] of
      byUnit.entries()
  ) {
    const eligibleActivities =
      new Set(
        [...group.activityIds]
          .filter(
            (activityId) =>
              !crossUnitActivities.has(
                activityId,
              ),
          ),
      );

    const related =
      labor.assignments.filter(
        (assignment) =>
          eligibleActivities.has(
            assignment.activityId,
          ),
      );

    const plannedLaborHours =
      sumKnown(
        related.map(
          (assignment) =>
            assignment.plannedUnits,
        ),
      );
    const actualLaborHours =
      sumKnown(
        related.map(
          actualLaborUnits,
        ),
      );
    const remainingLaborHours =
      sumKnown(
        related.map(
          (assignment) =>
            assignment.remainingUnits,
        ),
      );

    const plannedQuantity =
      group.plannedQuantity > 0
        ? group.plannedQuantity
        : null;
    const measuredInstalled =
      group.installedKnownCount > 0
        ? group.measuredInstalled
        : null;

    const actualProductivity =
      measuredInstalled !== null &&
      actualLaborHours !== null &&
      actualLaborHours > 0
        ? Number(
            (
              measuredInstalled /
              actualLaborHours
            ).toFixed(8),
          )
        : null;
    const plannedProductivity =
      plannedQuantity !== null &&
      plannedLaborHours !== null &&
      plannedLaborHours > 0
        ? Number(
            (
              plannedQuantity /
              plannedLaborHours
            ).toFixed(8),
          )
        : null;

    const contractQuantity =
      [...group.quantityItemIds]
        .map(
          (itemId) =>
            itemById.get(
              itemId,
            )?.contractQuantity ??
            null,
        );
    const totalContract =
      contractQuantity.every(
        (value) =>
          value !== null,
      )
        ? contractQuantity.reduce(
            (
              sum,
              value,
            ) =>
              sum +
              (value ?? 0),
            0,
          )
        : null;
    const remainingQuantity =
      totalContract !== null &&
      measuredInstalled !== null
        ? Math.max(
            0,
            totalContract -
              measuredInstalled,
          )
        : null;
    const requiredProductivity =
      remainingQuantity !== null &&
      remainingLaborHours !== null &&
      remainingLaborHours > 0
        ? Number(
            (
              remainingQuantity /
              remainingLaborHours
            ).toFixed(8),
          )
        : null;

    rows.push({
      unit,
      measuredInstalledQuantity:
        measuredInstalled,
      actualLaborHours,
      plannedQuantity,
      plannedLaborHours,
      actualMeasuredQuantityPerLaborHour:
        actualProductivity,
      plannedQuantityPerLaborHour:
        plannedProductivity,
      requiredQuantityPerLaborHour:
        requiredProductivity,
      requiredProductivityVsActualPercent:
        actualProductivity !== null &&
        requiredProductivity !== null &&
        actualProductivity > 0
          ? Number(
              (
                (
                  requiredProductivity /
                  actualProductivity
                ) *
                100
              ).toFixed(4),
            )
          : null,
      evidenceState:
        actualProductivity !== null
          ? "measured"
          : plannedProductivity !==
              null
            ? "planned_only"
            : related.length > 0
              ? "scenario_only"
              : "missing",
    });
  }

  const projectRemaining =
    sumKnown(
      labor.assignments.map(
        (assignment) =>
          assignment.remainingUnits,
      ),
    );

  return {
    rows:
      rows.sort(
        (a, b) =>
          a.unit.localeCompare(
            b.unit,
          ),
      ),
    remainingLaborHours:
      projectRemaining,
    diagnostics,
  };
}

function planStats(
  plan: SubmittedManpowerPlan | null,
): {
  average: number | null;
  peak: number | null;
} {
  if (
    !plan ||
    plan.periods.length === 0
  ) {
    return {
      average: null,
      peak: null,
    };
  }

  let weighted = 0;
  let duration = 0;
  let peak = 0;

  for (const period of plan.periods) {
    const start =
      ms(period.startIso);
    const end =
      ms(period.endIso);
    if (
      start === null ||
      end === null ||
      end <= start
    ) continue;
    const span =
      end - start;
    weighted +=
      span *
      period.plannedManpower;
    duration += span;
    peak = Math.max(
      peak,
      period.plannedManpower,
    );
  }

  return {
    average:
      duration <= 0
        ? null
        : Number(
            (
              weighted /
              duration
            ).toFixed(4),
          ),
    peak:
      duration <= 0
        ? null
        : peak,
  };
}

function finding(
  input: Omit<
    DeliveryChallengeFinding,
    "findingId"
  >,
): DeliveryChallengeFinding {
  return {
    findingId:
      "delivery-find-" +
      stableFingerprint(
        input,
      ).slice(0, 18),
    ...input,
  };
}

export function buildDeliveryChallengeProjection(
  input: {
    generatedAt: string;
    producerVersion: string;
    schedule: CanonicalScheduleModel;
    quantities:
      CanonicalQuantityProgressModel | null;
    resources:
      CanonicalResourceModel | null;
    independentForecast:
      IndependentForecastProjection;
    contractTimeBasis:
      ContractTimeBasis | null;
    submittedManpowerPlan?:
      SubmittedManpowerPlan | null;
    workHoursPerPersonDay?:
      number;
    crewScenarios?:
      number[];
    materialDateGapDays?:
      number;
    manpowerTolerancePercent?:
      number;
    productivityTolerancePercent?:
      number;
  },
): DeliveryChallengeProjection {
  const schedule =
    input.schedule;
  const contractorCompletion =
    input.independentForecast
      .sourceForecastCompletionIso;
  const independentCompletion =
    input.independentForecast
      .independentForecastCompletionIso;
  const contractualCompletion =
    input.contractTimeBasis
      ?.contractualCompletionIso ??
    input.independentForecast
      .requiredFinishIso ??
    null;

  const contractorVsIndependent =
    days(
      contractorCompletion,
      independentCompletion,
    );
  const independentVsContractual =
    days(
      contractualCompletion,
      independentCompletion,
    );
  const remainingDurationDays =
    days(
      schedule.dataDateIso,
      contractorCompletion,
    );

  const fronts =
    concurrency(schedule);

  const mapping =
    input.quantities
      ? buildQuantityScheduleMapping(
          input.quantities,
          schedule,
        )
      : null;

  const quantityByUnit =
    input.quantities &&
    mapping
      ? quantityRows(
          input.quantities,
          mapping,
          schedule.dataDateIso,
          contractualCompletion,
          contractorCompletion,
        )
      : [];

  const singleUnit =
    quantityByUnit.length === 1
      ? quantityByUnit[0]!
      : null;

  const productivity =
    input.quantities &&
    mapping
      ? productivityRows(
          input.quantities,
          mapping,
          input.resources,
        )
      : {
          rows: [],
          remainingLaborHours:
            input.resources
              ? sumKnown(
                  laborAssignments(
                    input.resources,
                  ).assignments.map(
                    (assignment) =>
                      assignment
                        .remainingUnits,
                  ),
                )
              : null,
          diagnostics: [],
        };

  const workHoursPerPersonDay =
    input.workHoursPerPersonDay ??
    8;
  const contractDays =
    days(
      schedule.dataDateIso,
      contractualCompletion,
    );
  const contractorDays =
    days(
      schedule.dataDateIso,
      contractorCompletion,
    );

  const requiredAverageToContract =
    productivity
      .remainingLaborHours !==
      null &&
    contractDays !== null &&
    contractDays > 0
      ? Number(
          (
            productivity
              .remainingLaborHours /
            (
              contractDays *
              workHoursPerPersonDay
            )
          ).toFixed(4),
        )
      : null;

  const requiredAverageToContractor =
    productivity
      .remainingLaborHours !==
      null &&
    contractorDays !== null &&
    contractorDays > 0
      ? Number(
          (
            productivity
              .remainingLaborHours /
            (
              contractorDays *
              workHoursPerPersonDay
            )
          ).toFixed(4),
        )
      : null;

  const submitted =
    planStats(
      input.submittedManpowerPlan ??
      null,
    );

  const crewSizes =
    input.crewScenarios ??
    [4, 6, 8];
  const scheduleDerivedScenarios =
    crewSizes.map(
      (crewSize) => ({
        crewSize,
        averageManpower:
          fronts.average === null
            ? null
            : Number(
                (
                  fronts.average *
                  crewSize
                ).toFixed(4),
              ),
        peakManpower:
          fronts.peak === null
            ? null
            : Number(
                (
                  fronts.peak *
                  crewSize
                ).toFixed(4),
              ),
        authority:
          "schedule_derived_scenario" as const,
      }),
    );

  const findings:
    DeliveryChallengeFinding[] =
    [];

  if (mapping) {
    findings.push(
      finding({
        topic: "mapping",
        state:
          mapping.scenarioLinkCount >
          0
            ? "scenario"
            : mapping.governedLinkCount >
                0
              ? "supported"
              : "missing_evidence",
        contractorAssumption:
          "BOQ and programme are assumed to describe the same delivery scope.",
        independentCalculation:
          mapping.quantityCoveragePercent ===
          null
            ? null
            : mapping.quantityCoveragePercent.toFixed(
                2,
              ) +
              "% of known BOQ quantity has a governed or scenario activity link.",
        difference:
          mapping.unmappedItemIds.length +
          " BOQ item(s) remain unmapped; " +
          mapping.ambiguousItemIds.length +
          " item(s) are ambiguous.",
        evidenceBasis: [
          "BOQ item description/section",
          "Schedule Activity ID/name",
          "WBS hierarchy",
          "Governed allocations where available",
        ],
        milestoneConsequence:
          mapping.quantityCoveragePercent !==
            null &&
          mapping.quantityCoveragePercent <
            80
            ? "Quantity-driven manpower/productivity conclusions have limited coverage."
            : null,
        requiredResponse:
          mapping.unmappedItemIds.length >
            0 ||
          mapping.ambiguousItemIds.length >
            0
            ? "Confirm or correct the BOQ-to-activity crosswalk for material unmapped/ambiguous items."
            : null,
      }),
    );
  }

  findings.push(
    finding({
      topic: "programme",
      state:
        contractorVsIndependent ===
        null
          ? "missing_evidence"
          : contractorVsIndependent >
              0
            ? "challenged"
            : "supported",
      contractorAssumption:
        contractorCompletion,
      independentCalculation:
        independentCompletion,
      difference:
        contractorVsIndependent ===
        null
          ? null
          : contractorVsIndependent.toFixed(
              2,
            ) +
            " day(s) independent minus contractor forecast.",
      evidenceBasis: [
        "Current contractor programme",
        "Independent deterministic forecast",
      ],
      milestoneConsequence:
        independentVsContractual !==
          null &&
        independentVsContractual >
          0
          ? "Independent forecast is later than the current contractual completion basis."
          : null,
      requiredResponse:
        contractorVsIndependent !==
          null &&
        contractorVsIndependent >
          0
          ? "Demonstrate the production, resource and work-front assumptions supporting the contractor forecast."
          : null,
    }),
  );

  const manpowerTolerance =
    input.manpowerTolerancePercent ??
    10;
  const manpowerGapPercent =
    submitted.average !== null &&
    requiredAverageToContract !==
      null &&
    requiredAverageToContract >
      0
      ? Number(
          (
            (
              (
                submitted.average -
                requiredAverageToContract
              ) /
              requiredAverageToContract
            ) *
            100
          ).toFixed(4),
        )
      : null;

  findings.push(
    finding({
      topic: "manpower",
      state:
        submitted.average === null
          ? fronts.average !== null
            ? "scenario"
            : "missing_evidence"
          : requiredAverageToContract ===
              null
            ? "missing_evidence"
            : manpowerGapPercent !==
                  null &&
                manpowerGapPercent <
                  -manpowerTolerance
              ? "challenged"
              : "supported",
      contractorAssumption:
        submitted.average === null
          ? "No governed contractor manpower plan available."
          : "Submitted average manpower=" +
            submitted.average,
      independentCalculation:
        requiredAverageToContract ===
        null
          ? (
              fronts.average ===
              null
                ? null
                : "Schedule-derived work-front scenarios use crew sizes " +
                  crewSizes.join(
                    "/",
                  ) +
                  "."
            )
          : "Required average manpower to contractual completion=" +
            requiredAverageToContract,
      difference:
        manpowerGapPercent === null
          ? null
          : manpowerGapPercent.toFixed(
              2,
            ) +
            "% submitted versus independently required.",
      evidenceBasis: [
        "Current schedule",
        "Resource assignments",
        ...(input.submittedManpowerPlan
          ? [
              "Contractor submitted manpower plan",
            ]
          : []),
      ],
      milestoneConsequence:
        manpowerGapPercent !== null &&
        manpowerGapPercent <
          -manpowerTolerance
          ? "Submitted manpower does not currently support the contractual completion scenario."
          : null,
      requiredResponse:
        submitted.average === null
          ? "Provide the periodised manpower plan by trade/work front, or confirm the schedule-derived scenario assumptions."
          : manpowerGapPercent !==
                null &&
              manpowerGapPercent <
                -manpowerTolerance
            ? "Submit a resource-loaded recovery response showing how the manpower shortfall will be closed."
            : null,
    }),
  );

  const measuredRows =
    productivity.rows.filter(
      (row) =>
        row.evidenceState ===
        "measured",
    );
  const productivityGap =
    measuredRows
      .map(
        (row) =>
          row
            .requiredProductivityVsActualPercent,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );
  const maxProductivityRequirement =
    productivityGap.length
      ? Math.max(
          ...productivityGap,
        )
      : null;
  const productivityTolerance =
    input.productivityTolerancePercent ??
    10;

  findings.push(
    finding({
      topic: "productivity",
      state:
        measuredRows.length > 0
          ? (
              maxProductivityRequirement !==
                null &&
              maxProductivityRequirement >
                100 +
                  productivityTolerance
                ? "challenged"
                : "supported"
            )
          : productivity.rows.some(
              (row) =>
                row.evidenceState ===
                "planned_only",
            )
            ? "scenario"
            : "missing_evidence",
      contractorAssumption:
        "Submitted programme assumes remaining output can be achieved within its remaining durations.",
      independentCalculation:
        maxProductivityRequirement ===
        null
          ? null
          : "Highest evidenced required/actual productivity ratio=" +
            maxProductivityRequirement.toFixed(
              2,
            ) +
            "%.",
      difference:
        maxProductivityRequirement ===
        null
          ? null
          : (
              maxProductivityRequirement -
              100
            ).toFixed(2) +
            "% above/below evidenced actual productivity.",
      evidenceBasis: [
        "Mapped BOQ quantities",
        "Installed quantity snapshots where available",
        "Labor resource assignments",
      ],
      milestoneConsequence:
        maxProductivityRequirement !==
          null &&
        maxProductivityRequirement >
          100 +
            productivityTolerance
          ? "Required future productivity exceeds the evidenced actual productivity tolerance."
          : null,
      requiredResponse:
        measuredRows.length === 0
          ? "Provide certified installed quantities and actual labor hours to substantiate productivity."
          : maxProductivityRequirement !==
                null &&
              maxProductivityRequirement >
                100 +
                  productivityTolerance
            ? "Demonstrate productivity improvement measures, additional crews or revised sequencing."
            : null,
    }),
  );

  const materialDateGap =
    input.materialDateGapDays ??
    14;
  const materialManpowerGap =
    manpowerGapPercent !== null &&
    manpowerGapPercent <
      -manpowerTolerance;
  const materialProductivityGap =
    maxProductivityRequirement !==
      null &&
    maxProductivityRequirement >
      100 +
        productivityTolerance;

  let position:
    DeliveryChallengePosition;

  if (
    contractorCompletion === null ||
    independentCompletion === null
  ) {
    position =
      "not_yet_supportable";
  } else if (
    independentVsContractual !==
      null &&
    independentVsContractual >
      materialDateGap &&
    (
      materialManpowerGap ||
      materialProductivityGap
    )
  ) {
    position =
      "material_delivery_gap";
  } else if (
    materialManpowerGap ||
    materialProductivityGap ||
    (
      contractorVsIndependent !==
        null &&
      contractorVsIndependent > 0
    )
  ) {
    position = "challenged";
  } else if (
    submitted.average === null &&
    measuredRows.length === 0
  ) {
    position = "scenario_only";
  } else {
    position = "supportable";
  }

  const singleProductivity =
    productivity.rows.length === 1
      ? productivity.rows[0]!
      : null;

  return {
    schemaVersion: "1.0",
    projectionKey:
      "delivery_challenge",
    generatedAt:
      input.generatedAt,
    producerVersion:
      input.producerVersion,
    projectId:
      schedule.projectId,
    sourceRevisionId:
      schedule.sourceRevisionId,
    position,
    authority:
      "analytical_challenge_not_replacement_programme",
    disclaimer:
      "This module independently tests whether the contractor delivery approach is supported by available evidence. It does not create a replacement programme and does not decide EOT, entitlement or legal compliance.",
    scheduleChallenge: {
      contractorSubmittedCompletionIso:
        contractorCompletion,
      independentCompletionIso:
        independentCompletion,
      contractualCompletionIso:
        contractualCompletion,
      contractorVsIndependentDays:
        contractorVsIndependent,
      independentVsContractualDays:
        independentVsContractual,
      remainingDurationDays,
      averageConcurrentWorkFronts:
        fronts.average,
      peakConcurrentWorkFronts:
        fronts.peak,
      workFrontActivityCount:
        fronts.activityCount,
    },
    quantityChallenge: {
      totalKnownQuantity:
        singleUnit
          ?.contractQuantity ??
        null,
      mappedQuantity:
        singleUnit
          ?.mappedContractQuantity ??
        null,
      mappingCoveragePercent:
        mapping
          ?.quantityCoveragePercent ??
        null,
      knownRemainingQuantity:
        singleUnit
          ?.remainingQuantity ??
        null,
      measuredInstalledQuantity:
        singleUnit
          ?.installedQuantity ??
        null,
      requiredQuantityPerDayToContract:
        singleUnit
          ?.requiredPerDayToContract ??
        null,
      requiredQuantityPerDayToContractorForecast:
        singleUnit
          ?.requiredPerDayToContractorForecast ??
        null,
      ambiguousMappingItemCount:
        mapping
          ?.ambiguousItemIds
          .length ?? 0,
      unmappedItemCount:
        mapping
          ?.unmappedItemIds
          .length ?? 0,
      byUnit:
        quantityByUnit,
    },
    productivityChallenge: {
      actualMeasuredQuantityPerLaborHour:
        singleProductivity
          ?.actualMeasuredQuantityPerLaborHour ??
        null,
      plannedQuantityPerLaborHour:
        singleProductivity
          ?.plannedQuantityPerLaborHour ??
        null,
      requiredQuantityPerLaborHour:
        singleProductivity
          ?.requiredQuantityPerLaborHour ??
        null,
      requiredProductivityVsActualPercent:
        singleProductivity
          ?.requiredProductivityVsActualPercent ??
        null,
      productivityEvidenceState:
        productivity.rows.some(
          (row) =>
            row.evidenceState ===
            "measured",
        )
          ? "measured"
          : productivity.rows.some(
              (row) =>
                row.evidenceState ===
                "planned_only",
            )
            ? "planned_only"
            : productivity.rows.length >
                0
              ? "scenario_only"
              : "missing",
      byUnit:
        productivity.rows,
    },
    manpowerChallenge: {
      submittedPlanAvailable:
        input.submittedManpowerPlan !==
        null &&
        input.submittedManpowerPlan !==
          undefined,
      submittedAverageManpower:
        submitted.average,
      submittedPeakManpower:
        submitted.peak,
      evidenceRemainingLaborHours:
        productivity
          .remainingLaborHours,
      requiredAverageManpowerToContract:
        requiredAverageToContract,
      requiredAverageManpowerToContractorForecast:
        requiredAverageToContractor,
      submittedVsRequiredToContract:
        manpowerGapPercent,
      scheduleDerivedScenarios,
      averageConcurrentWorkFronts:
        fronts.average,
      peakConcurrentWorkFronts:
        fronts.peak,
    },
    mapping,
    findings,
    assumptions: [
      "Inferred BOQ-to-activity links are scenario candidates unless backed by governed allocations.",
      "Where a BOQ item has several similarly strong activity candidates, scenario quantity is distributed by remaining duration and remains review-required.",
      "Crew fallback scenarios use 4/6/8 people per concurrent work front unless configuration states otherwise.",
      "Labor resource units are treated as labor-hours only where the resource model supports that interpretation; non-hour UOMs are diagnosed.",
      "Quantities with different units are never cross-summed for productivity.",
    ],
    diagnostics: [
      ...(mapping
        ?.diagnostics ?? []),
      ...productivity.diagnostics,
      ...(quantityByUnit.length >
        1
        ? [
            "MIXED_QUANTITY_UNITS_NOT_CROSS_SUMMED",
          ]
        : []),
      ...(input.submittedManpowerPlan
        ? [
            ...input.submittedManpowerPlan
              .diagnostics,
          ]
        : [
            "CONTRACTOR_MANPOWER_PLAN_NOT_AVAILABLE",
          ]),
    ],
  };
}
