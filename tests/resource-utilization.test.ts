import test from "node:test";
import assert from "node:assert/strict";

import {
  parseXerBytes,
} from "../packages/xer-parser/src";
import {
  canonicalResourcesFromXer,
} from "../packages/schedule-resource-core/src";
import {
  buildResourceUtilizationProjection,
} from "../packages/resource-utilization/src";
import type {
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";

function resourceXer(): string {
  return [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\t1\tP88",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\tROOT",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name",
    "%R\t100\t1\t10\tA100\tActivity A",
    "%R\t101\t1\t10\tA200\tActivity B",
    "%T\tUMEASURE",
    "%F\tunit_id\tunit_name\tunit_abbrev\tseq_num",
    "%R\t500\tHour\thr\t1",
    "%T\tRSRC",
    "%F\trsrc_id\tparent_rsrc_id\tclndr_id\trsrc_short_name\trsrc_name\trsrc_type\tunit_id\tcost_qty_type",
    "%R\tR1\t\t\tLAB1\tLabor 1\tRT_Labor\t500\tQT_Hour",
    "%R\tR2\t\t\tLAB2\tLabor 2\tRT_Labor\t500\tQT_Hour",
    "%R\tR3\t\t\tEQ1\tCrane\tRT_Nonlabor\t500\tQT_Hour",
    "%T\tRSRCRATE",
    "%F\trsrc_rate_id\trsrc_id\tstart_date\tmax_qty_per_hr",
    "%R\t1\tR1\t2025-01-01\t2",
    "%R\t2\tR1\t2026-01-01\t4",
    "%R\t3\tR3\t2025-01-01\t1",
    "%T\tTASKRSRC",
    "%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trsrc_type\ttarget_qty\tact_reg_qty\tact_ot_qty\tremain_qty\ttotal_qty\ttarget_qty_per_hr\tremain_qty_per_hr\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\trestart_date\treend_date\tcurv_id",
    "%R\tAR1\t1\t100\tR1\tRT_Labor\t80\t20\t5\t55\t80\t2\t3\t2026-01-01\t2026-01-10\t2026-01-01\t\t2026-01-05\t2026-01-15\tC1",
    "%R\tAR2\t1\t101\tR2\tRT_Labor\t40\t10\t\t30\t40\t1\t1\t2026-01-01\t2026-01-10\t2026-01-01\t\t2026-01-05\t2026-01-15\t",
    "%R\tAR3\t1\t101\tR3\tRT_Nonlabor\t16\t4\t0\t12\t16\t1\t1\t2026-01-01\t2026-01-03\t2026-01-01\t\t2026-01-02\t2026-01-04\t",
    "%T\tFINDATES",
    "%F\tfin_dates_id\tfin_dates_name\tstart_date\tend_date",
    "%R\tF1\tJan W1\t2026-01-01\t2026-01-07",
    "%R\tF2\tJan W2\t2026-01-08\t2026-01-14",
    "%T\tTRSRCFIN",
    "%F\tproj_id\ttask_id\ttaskrsrc_id\tfin_dates_id\tact_qty\tact_cost",
    "%R\t1\t100\tAR1\tF1\t10\t100",
    "%R\t1\t100\tAR1\tF2\t8\t80",
    "%R\t1\t101\tAR2\tF1\t4\t40",
    "%E",
  ].join("\n");
}

function scheduleModel(): CanonicalScheduleModel {
  return {
    projectId: "P88",
    source: "xer",
    sourceRevisionId: "rev-res",
    dataDateIso: "2026-01-12",
    activities: [
      {
        projectId: "P88",
        activityId: "A100",
        nativeId: "100",
        name: "Activity A",
        wbsId: "10",
        calendarId: null,
        activityType: "task",
        status: "in_progress",
        baselineStartIso: null,
        baselineFinishIso: null,
        currentStartIso: "2026-01-01",
        currentFinishIso: "2026-01-15",
        actualStartIso: "2026-01-01",
        actualFinishIso: null,
        forecastStartIso: "2026-01-05",
        forecastFinishIso: "2026-01-15",
        originalDurationHours: 80,
        remainingDurationHours: 55,
        totalFloatHours: 8,
        freeFloatHours: 4,
        percentComplete: 31.25,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        projectId: "P88",
        activityId: "A200",
        nativeId: "101",
        name: "Activity B",
        wbsId: "10",
        calendarId: null,
        activityType: "task",
        status: "in_progress",
        baselineStartIso: null,
        baselineFinishIso: null,
        currentStartIso: "2026-01-01",
        currentFinishIso: "2026-01-15",
        actualStartIso: "2026-01-01",
        actualFinishIso: null,
        forecastStartIso: "2026-01-05",
        forecastFinishIso: "2026-01-15",
        originalDurationHours: 40,
        remainingDurationHours: 30,
        totalFloatHours: 8,
        freeFloatHours: 4,
        percentComplete: 25,
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

test("XER resource adapter preserves UMEASURE effective capacity and stored period actuals", () => {
  const parsed = parseXerBytes(
    Buffer.from(resourceXer(), "utf8"),
  );
  const resources =
    canonicalResourcesFromXer(
      parsed,
      {
        sourceRevisionId: "rev-res",
        projectId: "P88",
      },
    );

  assert.equal(resources.units.length, 1);
  assert.equal(
    resources.units[0]!.abbreviation,
    "hr",
  );
  assert.equal(
    resources.financialPeriods.length,
    2,
  );
  assert.equal(resources.resources.length, 3);
  assert.equal(
    resources.resources[0]!.unitName,
    "Hour",
  );
  assert.equal(
    resources.assignments.length,
    3,
  );
  assert.equal(
    resources.assignments[0]!.activityId,
    "A100",
  );
  assert.equal(
    resources.periodActuals.length,
    3,
  );
  assert.equal(
    resources.periodActuals[0]!.periodEndIso,
    "2026-01-07",
  );
  assert.equal(
    resources.periodActuals[0]!.actualUnits,
    10,
  );
  assert.equal(
    resources.periodActuals[0]!.resourceId,
    "R1",
  );
});

test("Resource Utilization selects effective source capacity and calculates overload only when capacity exists", () => {
  const parsed = parseXerBytes(
    Buffer.from(resourceXer(), "utf8"),
  );
  const resources =
    canonicalResourcesFromXer(
      parsed,
      {
        sourceRevisionId: "rev-res",
        projectId: "P88",
      },
    );

  const projection =
    buildResourceUtilizationProjection(
      resources,
      scheduleModel(),
      {
        generatedAt:
          "2026-09-18T19:30:00.000Z",
        producerVersion:
          "resource-util-v1",
      },
    );

  const r1 = projection.rows.find(
    (row) => row.resourceId === "R1",
  )!;
  assert.equal(
    r1.capacityUnitsPerHour,
    4,
  );
  assert.equal(
    r1.capacityEffectiveDateIso,
    "2026-01-01",
  );
  assert.equal(
    r1.actualUnitsKnown,
    25,
  );
  assert.equal(
    r1.actualUnitsCoveragePercent,
    100,
  );
  assert.equal(
    r1.peakRemainingUnitsPerHour,
    3,
  );
  assert.equal(
    r1.remainingUtilizationPercent,
    75,
  );
  assert.equal(r1.overloaded, false);
  assert.equal(
    r1.state,
    "capacity_based",
  );

  const r2 = projection.rows.find(
    (row) => row.resourceId === "R2",
  )!;
  assert.equal(
    r2.capacityUnitsPerHour,
    null,
  );
  assert.equal(
    r2.remainingUtilizationPercent,
    null,
  );
  assert.equal(r2.overloaded, null);
  assert.equal(r2.state, "demand_only");

  // Missing overtime is not treated as zero actual.
  assert.equal(
    r2.actualUnitsKnownCount,
    0,
  );
  assert.equal(
    r2.actualUnitsCoveragePercent,
    0,
  );

  assert.equal(
    projection.capacityBasedResourceCount,
    2,
  );
  assert.equal(
    projection.capacityCoveragePercent,
    66.6667,
  );
});

test("Resource Utilization rejects schedule/resource revision mixing", () => {
  const parsed = parseXerBytes(
    Buffer.from(resourceXer(), "utf8"),
  );
  const resources =
    canonicalResourcesFromXer(
      parsed,
      {
        sourceRevisionId: "rev-res",
        projectId: "P88",
      },
    );
  const schedule = scheduleModel();
  schedule.sourceRevisionId = "rev-other";

  assert.throws(
    () =>
      buildResourceUtilizationProjection(
        resources,
        schedule,
        {
          generatedAt:
            "2026-09-18T19:30:00.000Z",
          producerVersion:
            "resource-util-v1",
        },
      ),
    /same revision/,
  );
});
