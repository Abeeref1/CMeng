import test from "node:test";
import assert from "node:assert/strict";

import {
  parseBoqCsv,
} from "../packages/boq-csv-parser/src";
import {
  quantityItemsFromBoqCsv,
  type CanonicalQuantityProgressModel,
} from "../packages/quantity-progress-core/src";
import {
  buildQuantityScurveProjection,
} from "../packages/quantity-scurve/src";
import {
  buildManhourScurveProjection,
} from "../packages/manhour-scurve/src";
import type {
  CanonicalResourceModel,
} from "../packages/schedule-resource-core/src";
import type {
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";

function schedule(): CanonicalScheduleModel {
  return {
    projectId: "P88",
    source: "schedule_xlsx",
    sourceRevisionId: "sched-rev-1",
    dataDateIso: "2026-01-12",
    activities: [
      {
        projectId: "P88",
        activityId: "A100",
        nativeId: null,
        name: "Concrete",
        wbsId: "W1",
        calendarId: null,
        activityType: "task",
        status: "in_progress",
        baselineStartIso: "2026-01-01",
        baselineFinishIso: "2026-01-05",
        currentStartIso: "2026-01-01",
        currentFinishIso: "2026-01-06",
        actualStartIso: "2026-01-01",
        actualFinishIso: null,
        forecastStartIso: "2026-01-01",
        forecastFinishIso: "2026-01-06",
        originalDurationHours: 40,
        remainingDurationHours: 16,
        totalFloatHours: 8,
        freeFloatHours: 4,
        percentComplete: 60,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        projectId: "P88",
        activityId: "A200",
        nativeId: null,
        name: "Blockwork",
        wbsId: "W2",
        calendarId: null,
        activityType: "task",
        status: "not_started",
        baselineStartIso: "2026-01-06",
        baselineFinishIso: "2026-01-10",
        currentStartIso: "2026-01-08",
        currentFinishIso: "2026-01-12",
        actualStartIso: null,
        actualFinishIso: null,
        forecastStartIso: "2026-01-08",
        forecastFinishIso: "2026-01-12",
        originalDurationHours: 40,
        remainingDurationHours: 40,
        totalFloatHours: 16,
        freeFloatHours: 8,
        percentComplete: 0,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    relationships: [],
    wbs: [],
    calendars: [],
    diagnostics: [],
  };
}

test("BOQ quantity adapter preserves separate item identities and units", () => {
  const parsed = parseBoqCsv(
    Buffer.from(
      [
        "Item,Description,Unit,Qty,Rate,Amount",
        "1.1,Concrete,m3,100,10,1000",
        "1.2,Blockwork,m2,200,5,1000",
      ].join("\n"),
      "utf8",
    ),
  );

  const items = quantityItemsFromBoqCsv(
    parsed,
  );

  assert.equal(items.length, 2);
  assert.equal(
    items[0]!.quantityItemId,
    "CSV::1.1",
  );
  assert.equal(items[0]!.unit, "m3");
  assert.equal(
    items[0]!.contractQuantity,
    100,
  );
  assert.equal(items[1]!.unit, "m2");
});

test("Quantity Installed S-Curve keeps units separate and reports mapping gaps", () => {
  const quantities: CanonicalQuantityProgressModel = {
    projectId: "P88",
    boqRevisionId: "boq-rev-1",
    scheduleRevisionId: "sched-rev-1",
    items: [
      {
        quantityItemId: "BOQ::1.1",
        itemNumber: "1.1",
        section: "Civil",
        description: "Concrete",
        unit: "m3",
        contractQuantity: 100,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        quantityItemId: "BOQ::1.2",
        itemNumber: "1.2",
        section: "Civil",
        description: "Additional Concrete",
        unit: "m3",
        contractQuantity: 50,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        quantityItemId: "BOQ::2.1",
        itemNumber: "2.1",
        section: "Architectural",
        description: "Blockwork",
        unit: "m2",
        contractQuantity: 200,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    allocations: [
      {
        allocationId: "MAP-1",
        quantityItemId: "BOQ::1.1",
        activityId: "A100",
        allocatedQuantity: 100,
        sourceRefs: [],
      },
      {
        allocationId: "MAP-2",
        quantityItemId: "BOQ::2.1",
        activityId: "A200",
        allocatedQuantity: 100,
        sourceRefs: [],
      },
    ],
    installedSnapshots: [
      {
        snapshotId: "Q-1",
        asOfIso: "2026-01-03",
        quantityItemId: "BOQ::1.1",
        installedQuantity: 30,
        sourceRefs: [],
      },
      {
        snapshotId: "Q-2",
        asOfIso: "2026-01-06",
        quantityItemId: "BOQ::1.1",
        installedQuantity: 80,
        sourceRefs: [],
      },
      {
        snapshotId: "Q-3",
        asOfIso: "2026-01-10",
        quantityItemId: "BOQ::2.1",
        installedQuantity: 50,
        sourceRefs: [],
      },
    ],
    diagnostics: [],
  };

  const projection =
    buildQuantityScurveProjection(
      quantities,
      schedule(),
      {
        generatedAt:
          "2026-09-18T20:00:00.000Z",
        producerVersion:
          "quantity-scurve-v1",
        intervalDays: 1,
      },
    );

  assert.equal(
    projection.allocationState,
    "partial",
  );
  assert.equal(projection.series.length, 2);

  const m3 = projection.series.find(
    (series) => series.unit === "m3",
  )!;
  const m2 = projection.series.find(
    (series) => series.unit === "m2",
  )!;

  assert.equal(
    m3.knownContractQuantity,
    150,
  );
  assert.equal(
    m3.mappingCoveragePercent,
    66.6667,
  );
  assert.equal(
    m3.actualHistoryMode,
    "snapshot_history",
  );
  assert.equal(
    m3.actualSnapshotItemCoveragePercent,
    50,
  );

  assert.equal(
    m2.knownContractQuantity,
    200,
  );
  assert.equal(
    m2.mappingCoveragePercent,
    50,
  );

  // The module never adds m3 and m2 together into one curve.
  assert.equal(
    projection.series.some(
      (series) =>
        series.unit === "__TOTAL__",
    ),
    false,
  );

  assert.ok(
    projection.unmappedItemIds.includes(
      "BOQ::1.2",
    ),
  );
  assert.ok(
    projection.partiallyAllocatedItemIds.includes(
      "BOQ::2.1",
    ),
  );
});

test("Quantity S-Curve flags over-allocation and over-installation instead of clipping them silently", () => {
  const quantities: CanonicalQuantityProgressModel = {
    projectId: "P88",
    boqRevisionId: "boq-rev-1",
    scheduleRevisionId: "sched-rev-1",
    items: [
      {
        quantityItemId: "BOQ::1.1",
        itemNumber: "1.1",
        section: null,
        description: "Concrete",
        unit: "m3",
        contractQuantity: 100,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    allocations: [
      {
        allocationId: "MAP-1",
        quantityItemId: "BOQ::1.1",
        activityId: "A100",
        allocatedQuantity: 120,
        sourceRefs: [],
      },
    ],
    installedSnapshots: [
      {
        snapshotId: "Q-1",
        asOfIso: "2026-01-06",
        quantityItemId: "BOQ::1.1",
        installedQuantity: 110,
        sourceRefs: [],
      },
    ],
    diagnostics: [],
  };

  const projection =
    buildQuantityScurveProjection(
      quantities,
      schedule(),
      {
        generatedAt:
          "2026-09-18T20:00:00.000Z",
        producerVersion:
          "quantity-scurve-v1",
      },
    );

  assert.equal(
    projection.allocationState,
    "conflicted",
  );
  assert.deepEqual(
    projection.overAllocatedItemIds,
    ["BOQ::1.1"],
  );
  assert.deepEqual(
    projection.series[0]!
      .overInstalledItemIds,
    ["BOQ::1.1"],
  );
});

function resources(): CanonicalResourceModel {
  return {
    projectId: "P88",
    sourceRevisionId: "sched-rev-1",
    units: [
      {
        unitId: "U1",
        name: "Hour",
        abbreviation: "hr",
        sourceRefs: [],
      },
    ],
    financialPeriods: [
      {
        periodId: "F1",
        name: "Period 1",
        startIso: "2026-01-01",
        endIso: "2026-01-07",
        sourceRefs: [],
      },
      {
        periodId: "F2",
        name: "Period 2",
        startIso: "2026-01-08",
        endIso: "2026-01-14",
        sourceRefs: [],
      },
    ],
    resources: [
      {
        resourceId: "R1",
        nativeId: "R1",
        shortName: "LAB1",
        name: "Labor 1",
        parentResourceId: null,
        resourceType: "labor",
        unitId: "U1",
        unitName: "Hour",
        unitAbbreviation: "hr",
        calendarId: null,
        priceTimeUnit: "QT_Hour",
        rates: [],
        sourceRefs: [],
      },
      {
        resourceId: "R2",
        nativeId: "R2",
        shortName: "LAB2",
        name: "Labor 2",
        parentResourceId: null,
        resourceType: "labor",
        unitId: "U1",
        unitName: "Hour",
        unitAbbreviation: "hr",
        calendarId: null,
        priceTimeUnit: "QT_Hour",
        rates: [],
        sourceRefs: [],
      },
      {
        resourceId: "R3",
        nativeId: "R3",
        shortName: "EQ1",
        name: "Crane",
        parentResourceId: null,
        resourceType: "nonlabor",
        unitId: "U1",
        unitName: "Hour",
        unitAbbreviation: "hr",
        calendarId: null,
        priceTimeUnit: "QT_Hour",
        rates: [],
        sourceRefs: [],
      },
    ],
    assignments: [
      {
        assignmentId: "AR1",
        projectId: "P88",
        activityId: "A100",
        nativeTaskId: "100",
        resourceId: "R1",
        roleId: null,
        resourceType: "labor",
        plannedUnits: 80,
        actualRegularUnits: 20,
        actualOvertimeUnits: 5,
        remainingUnits: 55,
        atCompletionUnits: 80,
        plannedUnitsPerHour: 2,
        remainingUnitsPerHour: 3,
        plannedStartIso: "2026-01-01",
        plannedFinishIso: "2026-01-10",
        actualStartIso: "2026-01-01",
        actualFinishIso: null,
        remainingStartIso: "2026-01-05",
        remainingFinishIso: "2026-01-15",
        curveId: "C1",
        sourceRefs: [],
        diagnostics: [],
      },
      {
        assignmentId: "AR2",
        projectId: "P88",
        activityId: "A200",
        nativeTaskId: "101",
        resourceId: "R2",
        roleId: null,
        resourceType: "labor",
        plannedUnits: 40,
        actualRegularUnits: 10,
        actualOvertimeUnits: null,
        remainingUnits: 30,
        atCompletionUnits: 40,
        plannedUnitsPerHour: 1,
        remainingUnitsPerHour: 1,
        plannedStartIso: "2026-01-01",
        plannedFinishIso: "2026-01-10",
        actualStartIso: "2026-01-01",
        actualFinishIso: null,
        remainingStartIso: "2026-01-05",
        remainingFinishIso: "2026-01-15",
        curveId: null,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        assignmentId: "AR3",
        projectId: "P88",
        activityId: "A200",
        nativeTaskId: "101",
        resourceId: "R3",
        roleId: null,
        resourceType: "nonlabor",
        plannedUnits: 16,
        actualRegularUnits: 4,
        actualOvertimeUnits: 0,
        remainingUnits: 12,
        atCompletionUnits: 16,
        plannedUnitsPerHour: 1,
        remainingUnitsPerHour: 1,
        plannedStartIso: "2026-01-01",
        plannedFinishIso: "2026-01-03",
        actualStartIso: "2026-01-01",
        actualFinishIso: null,
        remainingStartIso: "2026-01-02",
        remainingFinishIso: "2026-01-04",
        curveId: null,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    periodActuals: [
      {
        assignmentId: "AR1",
        projectId: "P88",
        activityId: "A100",
        resourceId: "R1",
        periodId: "F1",
        periodName: "Period 1",
        periodStartIso: "2026-01-01",
        periodEndIso: "2026-01-07",
        actualUnits: 10,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        assignmentId: "AR1",
        projectId: "P88",
        activityId: "A100",
        resourceId: "R1",
        periodId: "F2",
        periodName: "Period 2",
        periodStartIso: "2026-01-08",
        periodEndIso: "2026-01-14",
        actualUnits: 8,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        assignmentId: "AR2",
        projectId: "P88",
        activityId: "A200",
        resourceId: "R2",
        periodId: "F1",
        periodName: "Period 1",
        periodStartIso: "2026-01-01",
        periodEndIso: "2026-01-07",
        actualUnits: 4,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    diagnostics: [],
  };
}

test("Man-Hour S-Curve uses labor only, stored-period actuals, and never invents missing current actuals", () => {
  const projection =
    buildManhourScurveProjection(
      resources(),
      schedule(),
      {
        generatedAt:
          "2026-09-18T20:00:00.000Z",
        producerVersion:
          "manhour-v1",
        intervalDays: 1,
      },
    );

  assert.equal(
    projection.laborResourceCount,
    2,
  );
  assert.equal(
    projection.laborAssignmentCount,
    2,
  );
  assert.equal(
    projection.plannedHoursKnown,
    120,
  );
  assert.equal(
    projection.remainingHoursKnown,
    85,
  );
  assert.equal(
    projection.actualHoursKnownCurrent,
    25,
  );
  assert.equal(
    projection.actualAssignmentCoveragePercent,
    50,
  );
  assert.equal(
    projection.actualState,
    "partial",
  );
  assert.equal(
    projection.forecastState,
    "partial",
  );
  assert.equal(
    projection.actualHistoryMethod,
    "stored_financial_period_actuals",
  );

  const jan7 = projection.points.find(
    (point) => point.dateIso === "2026-01-07",
  )!;
  assert.equal(
    jan7.actualCumulativeHours,
    14,
  );

  const jan12 = projection.points.find(
    (point) => point.dateIso === "2026-01-12",
  )!;
  assert.equal(
    jan12.actualCumulativeHours,
    25,
  );

  assert.ok(
    projection.assumptions.includes(
      "RESOURCE_CURVE_C1_NOT_PARSED_LINEAR_TIME_PHASING_USED",
    ),
  );
  assert.ok(
    projection.diagnostics.includes(
      "MANHOUR_PERIOD_ACTUALS_AFTER_DATA_DATE_EXCLUDED:1",
    ),
  );
});

test("Man-Hour actual history is one current snapshot only when stored financial-period actuals are absent", () => {
  const input = resources();
  input.periodActuals = [];

  const projection =
    buildManhourScurveProjection(
      input,
      schedule(),
      {
        generatedAt:
          "2026-09-18T20:00:00.000Z",
        producerVersion:
          "manhour-v1",
      },
    );

  assert.equal(
    projection.actualHistoryMethod,
    "current_actual_snapshot_only",
  );
  assert.ok(
    projection.diagnostics.includes(
      "MANHOUR_ACTUAL_HISTORY_NOT_RECONSTRUCTED_FROM_CURRENT_TOTAL",
    ),
  );

  const beforeDataDate =
    projection.points.filter(
      (point) =>
        point.dateIso < "2026-01-12",
    );

  assert.ok(
    beforeDataDate.every(
      (point) =>
        point.actualCumulativeHours === null,
    ),
  );
});
