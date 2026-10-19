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
