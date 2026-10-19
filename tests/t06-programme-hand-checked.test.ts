// T06 programme, progress and resources: hand-checked fixtures.
// Every expected value below is worked out by hand from the fixture rows,
// never by calling CMeng to produce the expectation.
import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeSchedule,
  canonicalScheduleFromTabular,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import { parseScheduleCsv } from "../packages/schedule-tabular-parser/src";
import { buildProgressBreakdownProjection } from "../packages/progress-breakdown/src";
import { parseXerBytes } from "../packages/xer-parser/src";
import { canonicalResourcesFromXer } from "../packages/schedule-resource-core/src";
import { buildResourceUtilizationProjection } from "../packages/resource-utilization/src";

// Ten activities. Durations in hours, as written in the file.
//  A100 Task             OD 16 RD 0  Completed
//  A110 Start Milestone  OD 0  RD 0  Not Started
//  A200 Task             OD 40 RD 24 In Progress
//  A300 Task Dependent   OD 24 RD 24 Not Started
//  A400 Finish Milestone OD 0  RD 0  Not Started
//  A500 Level of Effort  OD 80 RD 40 In Progress   (not execution work)
//  A600 Milestone        OD 0  RD 0  Not Started   (typed by the source)
//  A700 (no type)        OD 0  RD 0  Not Started   (type inferred from zero duration)
//  A800 (no type)        OD 8  RD 8  Not Started   (type stays unknown)
//  A900 Task             OD 16 RD 8  Completed     (stale remaining value in the source)
const CSV = [
  "Activity ID,Activity Name,Activity Type,Original Duration (h),Remaining Duration (h),Start,Finish,Actual Finish,Status",
  "A100,Mobilise,Task,16,0,2026-01-05,2026-01-06,2026-01-06,Completed",
  "A110,Notice to proceed,Start Milestone,0,0,2026-01-05,2026-01-05,,Not Started",
  "A200,Excavation,Task,40,24,2026-01-07,2026-01-13,,In Progress",
  "A300,Blinding,Task Dependent,24,24,2026-01-14,2026-01-16,,Not Started",
  "A400,Handover,Finish Milestone,0,0,2026-01-16,2026-01-16,,Not Started",
  "A500,Site supervision,Level of Effort,80,40,2026-01-05,2026-01-16,,In Progress",
  "A600,Key date,Milestone,0,0,2026-01-12,2026-01-12,,Not Started",
  "A700,Untyped zero duration,,0,0,2026-01-12,2026-01-12,,Not Started",
  "A800,Untyped work,,8,8,2026-01-15,2026-01-15,,Not Started",
  "A900,Formwork,Task,16,8,2026-01-05,2026-01-06,2026-01-06,Completed",
].join("\n");

function model() {
  return canonicalScheduleFromTabular(parseScheduleCsv(Buffer.from(CSV, "utf8")), {
    sourceRevisionId: "t06-rev-1",
    projectId: "T06",
  });
}

test("SW-16: activity type column of a tabular programme is read, not left unknown", () => {
  const types = Object.fromEntries(model().activities.map((a) => [a.activityId, a.activityType]));
  assert.deepEqual(types, {
    A100: "task",
    A110: "start_milestone",
    A200: "task",
    A300: "task",
    A400: "finish_milestone",
    A500: "level_of_effort",
    A600: "milestone",
    A700: "milestone",
    A800: "unknown",
    A900: "task",
  });
  // Only the one untyped, non-zero activity stays unknown.
  assert.equal(model().activities.filter((a) => a.activityType === "unknown").length, 1);
});

test("SW-16: mixed record layout reads the shared Type column on ACTIVITY rows", () => {
  const csv = [
    "Record Type,Record ID,Parent/Successor,Predecessor,WBS,Name/Description,Type,Start,Finish,Duration,Float,Percent,Status,Lag,Revision",
    "ACTIVITY,M10,,,W1,Start,Start Milestone,2026-02-01,2026-02-01,0,0,0,Not Started,,1",
    "ACTIVITY,M20,,,W1,Pour slab,Task,2026-02-02,2026-02-04,3,0,0,Not Started,,1",
    "ACTIVITY,M30,,,W1,Finish,Finish Milestone,2026-02-04,2026-02-04,0,0,0,Not Started,,1",
    "RELATIONSHIP,R1,M20,M10,,,FS,,,,,,,0,1",
  ].join("\n");
  const m = canonicalScheduleFromTabular(parseScheduleCsv(Buffer.from(csv, "utf8")), {
    sourceRevisionId: "t06-mixed",
    projectId: "T06",
  });
  const types = Object.fromEntries(m.activities.map((a) => [a.activityId, a.activityType]));
  assert.deepEqual(types, { M10: "start_milestone", M20: "task", M30: "finish_milestone" });
  // The link type on the RELATIONSHIP row is still read as a link type.
  assert.equal(m.relationships.length, 1);
  assert.equal(m.relationships[0]!.type, "FS");
});

test("milestones: source-typed milestones are not reported as inferred from zero duration", () => {
  const result = analyzeSchedule(model());
  assert.deepEqual([...result.milestones.milestoneActivityIds].sort(), ["A110", "A400", "A600", "A700"]);
  assert.deepEqual(result.milestones.completedMilestones, []);
  assert.deepEqual([...result.milestones.openMilestones].sort(), ["A110", "A400", "A600", "A700"]);
  // A600 is typed "Milestone" in the file; only A700 was inferred.
  assert.deepEqual(result.milestones.inferredFromZeroDurationIds, ["A700"]);
});

test("completed work is excluded from the remaining duration figure", () => {
  const projection = buildProgressBreakdownProjection(model(), {
    generatedAt: "2026-01-08T00:00:00.000Z",
    producerVersion: "t06-test",
  });
  const overall = projection.overallSummary!;
  // Execution population excludes the level-of-effort A500: 9 activities.
  assert.equal(overall.activityCount, 9);
  assert.equal(overall.completedCount, 2);
  // Unfinished execution work: A110 0 + A200 24 + A300 24 + A400 0 + A600 0
  // + A700 0 + A800 8 = 56 hours. The completed A900 carries a stale 8 hours
  // that must not be counted (the old figure was 64).
  assert.equal(overall.remainingDurationHoursKnown, 56);
  // Original duration still covers all execution work: 16+0+40+24+0+0+0+8+16 = 104.
  assert.equal(overall.originalDurationHoursKnown, 104);
});

function activity(
  id: string,
  fields: Partial<CanonicalScheduleActivity>,
): CanonicalScheduleActivity {
  return {
    projectId: "T06",
    activityId: id,
    nativeId: null,
    name: id,
    wbsId: "W1",
    calendarId: "CAL5",
    activityType: "task",
    status: "not_started",
    baselineStartIso: null,
    baselineFinishIso: null,
    currentStartIso: null,
    currentFinishIso: null,
    actualStartIso: null,
    actualFinishIso: null,
    forecastStartIso: null,
    forecastFinishIso: null,
    originalDurationHours: null,
    remainingDurationHours: null,
    totalFloatHours: null,
    freeFloatHours: null,
    percentComplete: null,
    sourceRefs: [],
    diagnostics: [],
    ...fields,
  };
}

test("completed work is excluded from remaining duration on every WBS row (typed model)", () => {
  const m: CanonicalScheduleModel = {
    projectId: "T06",
    source: "xer",
    sourceRevisionId: "t06-typed",
    dataDateIso: "2026-01-08",
    activities: [
      // Completed, stale remaining 8 h in the source: must count as 0.
      activity("B100", { status: "completed", originalDurationHours: 16, remainingDurationHours: 8, actualFinishIso: "2026-01-06", percentComplete: 100 }),
      activity("B200", { status: "in_progress", originalDurationHours: 40, remainingDurationHours: 24, percentComplete: 40 }),
      activity("B300", { status: "not_started", originalDurationHours: 24, remainingDurationHours: 24, percentComplete: 0 }),
      // Unknown remaining stays out of the known sum.
      activity("B400", { status: "not_started", originalDurationHours: 8, remainingDurationHours: null, percentComplete: 0 }),
    ],
    relationships: [],
    wbs: [{ wbsId: "W1", name: "Substructure", parentWbsId: null, sourceRefs: [] }],
    calendars: [],
    diagnostics: [],
  } as CanonicalScheduleModel;
  const projection = buildProgressBreakdownProjection(m, {
    generatedAt: "2026-01-08T00:00:00.000Z",
    producerVersion: "t06-test",
  });
  // 24 + 24 = 48 hours of known remaining duration on unfinished work.
  assert.equal(projection.overallSummary!.remainingDurationHoursKnown, 48);
  const w1 = projection.rows.find((row) => row.wbsId === "W1")!;
  assert.equal(w1.remainingDurationHoursKnown, 48);
});

// One labour resource on two activities.
//  A100 completed, float 0. Its assignment still carries a stale remaining
//       quantity of 8 h at 1 h/h (12 to 14 Jan) in the source.
//  A200 in progress, float 16 h. Remaining 30 h at 2 h/h (12 to 16 Jan).
// No source at-completion quantity, so at-completion = actual + remaining.
function resourceFixture() {
  const xer = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\t1\tT06",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\tROOT",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name",
    "%R\t100\t1\t10\tA100\tFormwork",
    "%R\t101\t1\t10\tA200\tRebar",
    "%T\tUMEASURE",
    "%F\tunit_id\tunit_name\tunit_abbrev\tseq_num",
    "%R\t500\tHour\thr\t1",
    "%T\tRSRC",
    "%F\trsrc_id\tparent_rsrc_id\tclndr_id\trsrc_short_name\trsrc_name\trsrc_type\tunit_id\tcost_qty_type",
    "%R\tR1\t\t\tCARP\tCarpenter\tRT_Labor\t500\tQT_Hour",
    "%T\tTASKRSRC",
    "%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trsrc_type\ttarget_qty\tact_reg_qty\tact_ot_qty\tremain_qty\ttotal_qty\ttarget_qty_per_hr\tremain_qty_per_hr\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\trestart_date\treend_date\tcurv_id",
    "%R\tAR1\t1\t100\tR1\tRT_Labor\t40\t40\t0\t8\t\t1\t1\t2026-01-01\t2026-01-05\t2026-01-01\t2026-01-06\t2026-01-12\t2026-01-14\t",
    "%R\tAR2\t1\t101\tR1\tRT_Labor\t40\t10\t0\t30\t\t2\t2\t2026-01-05\t2026-01-10\t2026-01-05\t\t2026-01-12\t2026-01-16\t",
    "%E",
  ].join("\n");
  const resources = canonicalResourcesFromXer(parseXerBytes(Buffer.from(xer, "utf8")), {
    sourceRevisionId: "t06-res",
    projectId: "T06",
  });
  const schedule = {
    projectId: "T06",
    source: "xer",
    sourceRevisionId: "t06-res",
    dataDateIso: "2026-01-12",
    activities: [
      activity("A100", { nativeId: "100", wbsId: "10", calendarId: null, status: "completed", actualFinishIso: "2026-01-06", totalFloatHours: 0, remainingDurationHours: 0, percentComplete: 100 }),
      activity("A200", { nativeId: "101", wbsId: "10", calendarId: null, status: "in_progress", totalFloatHours: 16, remainingDurationHours: 30, percentComplete: 25 }),
    ],
    relationships: [],
    wbs: [],
    calendars: [],
    diagnostics: [],
  } as CanonicalScheduleModel;
  return buildResourceUtilizationProjection(resources, schedule, {
    generatedAt: "2026-01-12T00:00:00.000Z",
    producerVersion: "t06-test",
  }).rows.find((row) => row.resourceId === "R1")!;
}

test("resources: completed work is excluded from remaining units, remaining peak and pressure", () => {
  const row = resourceFixture();
  // Planned 40 + 40 = 80 and actual 40 + 10 = 50 are unchanged source values.
  assert.equal(row.plannedUnitsKnown, 80);
  assert.equal(row.actualUnitsKnown, 50);
  // Remaining: A100 is complete, so 0 (not the stale 8) + 30 = 30.
  assert.equal(row.remainingUnitsKnown, 30);
  assert.equal(row.remainingUnitsKnownCount, 2);
  // At completion: (40 + 0) + (10 + 30) = 80, not 88.
  assert.equal(row.atCompletionUnitsKnownOrDerived, 80);
  // Remaining peak: only A200 at 2 h/h; the stale 1 h/h on A100 is not added (old figure 3).
  assert.equal(row.peakRemainingUnitsPerHour, 2);
  // The completed A100 with zero float is not schedule pressure.
  assert.equal(row.programmeEffect, "Affected programme scope is identified; project-completion effect is not established from resource evidence alone.");
});
