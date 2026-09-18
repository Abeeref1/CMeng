import test from "node:test";
import assert from "node:assert/strict";

import type {
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import {
  buildActivityAnalyticsProjection,
} from "../packages/activity-analytics/src";
import {
  buildMilestonesProjection,
} from "../packages/milestones-analysis/src";
import {
  buildNearCriticalProjection,
} from "../packages/near-critical-analysis/src";
import {
  buildLookAheadProjection,
} from "../packages/lookahead-schedule/src";

function fixture(): CanonicalScheduleModel {
  return {
    projectId: "P88",
    source: "schedule_xlsx",
    sourceRevisionId: "rev-2",
    dataDateIso: "2026-01-11",
    activities: [
      {
        projectId: "P88",
        activityId: "A100",
        nativeId: null,
        name: "Mobilize",
        wbsId: "W1",
        calendarId: "CAL1",
        activityType: "task",
        status: "completed",
        baselineStartIso: "2026-01-01",
        baselineFinishIso: "2026-01-03",
        currentStartIso: "2026-01-01",
        currentFinishIso: "2026-01-03",
        actualStartIso: "2026-01-01",
        actualFinishIso: "2026-01-03",
        forecastStartIso: null,
        forecastFinishIso: null,
        originalDurationHours: 16,
        remainingDurationHours: 0,
        totalFloatHours: 0,
        freeFloatHours: 0,
        percentComplete: 100,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        projectId: "P88",
        activityId: "A200",
        nativeId: null,
        name: "Excavate",
        wbsId: "W1",
        calendarId: "CAL1",
        activityType: "task",
        status: "in_progress",
        baselineStartIso: "2026-01-03",
        baselineFinishIso: "2026-01-08",
        currentStartIso: "2026-01-03",
        currentFinishIso: "2026-01-10",
        actualStartIso: "2026-01-03",
        actualFinishIso: null,
        forecastStartIso: "2026-01-03",
        forecastFinishIso: "2026-01-10",
        originalDurationHours: 40,
        remainingDurationHours: 16,
        totalFloatHours: 16,
        freeFloatHours: 8,
        percentComplete: 60,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        projectId: "P88",
        activityId: "A300",
        nativeId: null,
        name: "Foundation Complete",
        wbsId: "W1",
        calendarId: "CAL1",
        activityType: "finish_milestone",
        status: "not_started",
        baselineStartIso: "2026-01-08",
        baselineFinishIso: "2026-01-08",
        currentStartIso: "2026-01-10",
        currentFinishIso: "2026-01-10",
        actualStartIso: null,
        actualFinishIso: null,
        forecastStartIso: "2026-01-10",
        forecastFinishIso: "2026-01-10",
        originalDurationHours: 0,
        remainingDurationHours: 0,
        totalFloatHours: 40,
        freeFloatHours: 40,
        percentComplete: 0,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        projectId: "P88",
        activityId: "A400",
        nativeId: null,
        name: "Uncertain Activity",
        wbsId: "W2",
        calendarId: null,
        activityType: "task",
        status: "unknown",
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
        diagnostics: ["SOURCE_PARTIAL"],
      },
    ],
    relationships: [
      {
        relationshipId: "R1",
        predecessorActivityId: "A100",
        successorActivityId: "A200",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        relationshipId: "R2",
        predecessorActivityId: "A200",
        successorActivityId: "A300",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    wbs: [
      {
        wbsId: "W1",
        parentWbsId: null,
        name: "Civil",
        sourceRefs: [],
      },
      {
        wbsId: "W2",
        parentWbsId: null,
        name: "Other",
        sourceRefs: [],
      },
    ],
    calendars: [
      {
        calendarId: "CAL1",
        name: "5 Day",
        semanticComplete: true,
        sourceRefs: [],
      },
    ],
    diagnostics: [],
  };
}

test("Activity Analytics uses shared logic index and source float classification", () => {
  const projection =
    buildActivityAnalyticsProjection(
      fixture(),
      {
        generatedAt:
          "2026-09-18T16:30:00.000Z",
        producerVersion:
          "activity-analytics-v1",
      },
    );

  assert.equal(projection.activityCount, 4);
  assert.equal(
    projection.floatCoveragePercent,
    75,
  );

  const mobilize = projection.rows.find(
    (row) => row.activityId === "A100",
  )!;
  assert.equal(mobilize.criticality, "critical");
  assert.equal(mobilize.predecessorCount, 0);
  assert.equal(mobilize.successorCount, 1);
  assert.equal(mobilize.openStart, true);
  assert.equal(mobilize.openFinish, false);

  const excavate = projection.rows.find(
    (row) => row.activityId === "A200",
  )!;
  assert.equal(
    excavate.criticality,
    "near_critical",
  );
  assert.equal(excavate.predecessorCount, 1);
  assert.equal(excavate.successorCount, 1);
  assert.equal(excavate.finishVarianceDays, 2);

  const unknown = projection.rows.find(
    (row) => row.activityId === "A400",
  )!;
  assert.equal(unknown.criticality, "unknown");
  assert.equal(unknown.isolated, true);
  assert.equal(unknown.finishVarianceDays, null);
});

test("Milestones module identifies completed/open/late milestones from canonical schedule", () => {
  const projection =
    buildMilestonesProjection(
      fixture(),
      {
        generatedAt:
          "2026-09-18T16:30:00.000Z",
        producerVersion:
          "milestones-v1",
      },
    );

  assert.equal(projection.milestoneCount, 1);
  assert.equal(projection.completedCount, 0);
  assert.equal(projection.openCount, 1);
  assert.equal(projection.lateOpenCount, 1);
  assert.equal(
    projection.rows[0]!.activityId,
    "A300",
  );
  assert.equal(
    projection.rows[0]!.varianceDays,
    2,
  );
  assert.equal(
    projection.rows[0]!.daysFromDataDate,
    -1,
  );
});

test("Near-Critical module excludes critical and unknown-float activities", () => {
  const projection =
    buildNearCriticalProjection(
      fixture(),
      {
        generatedAt:
          "2026-09-18T16:30:00.000Z",
        producerVersion:
          "near-critical-v1",
      },
    );

  assert.equal(
    projection.floatCoveragePercent,
    75,
  );
  assert.equal(
    projection.nearCriticalCount,
    2,
  );
  assert.deepEqual(
    projection.rows.map(
      (row) => row.activityId,
    ),
    ["A200", "A300"],
  );
  assert.deepEqual(
    projection.rows.map(
      (row) => row.totalFloatHours,
    ),
    [16, 40],
  );
});


test("Look-Ahead uses current/forecast dates and never substitutes baseline dates", () => {
  const input = fixture();

  const projection =
    buildLookAheadProjection(
      input,
      {
        generatedAt:
          "2026-09-18T16:30:00.000Z",
        producerVersion:
          "lookahead-v1",
        windowDays: 42,
      },
    );

  assert.equal(
    projection.currentDateCoveragePercent,
    66.6667,
  );
  assert.equal(
    projection.missingCurrentDateActivityIds.includes(
      "A400",
    ),
    true,
  );

  const milestone = projection.rows.find(
    (row) => row.activityId === "A300",
  )!;
  assert.equal(
    milestone.classification,
    "overdue",
  );
  assert.equal(
    milestone.daysToFinish,
    -1,
  );

  const missing = projection.rows.find(
    (row) => row.activityId === "A400",
  );
  assert.equal(missing, undefined);
});

test("Look-Ahead window does not pull future baseline-only work into current plan", () => {
  const input = fixture();
  input.activities.push({
    projectId: "P88",
    activityId: "A500",
    nativeId: null,
    name: "Baseline Only Future",
    wbsId: "W2",
    calendarId: null,
    activityType: "task",
    status: "not_started",
    baselineStartIso: "2026-01-15",
    baselineFinishIso: "2026-01-20",
    currentStartIso: null,
    currentFinishIso: null,
    actualStartIso: null,
    actualFinishIso: null,
    forecastStartIso: null,
    forecastFinishIso: null,
    originalDurationHours: 40,
    remainingDurationHours: 40,
    totalFloatHours: 80,
    freeFloatHours: 80,
    percentComplete: 0,
    sourceRefs: [],
    diagnostics: [],
  });

  const projection =
    buildLookAheadProjection(
      input,
      {
        generatedAt:
          "2026-09-18T16:30:00.000Z",
        producerVersion:
          "lookahead-v1",
      },
    );

  assert.ok(
    projection.missingCurrentDateActivityIds.includes(
      "A500",
    ),
  );
  assert.equal(
    projection.rows.some(
      (row) => row.activityId === "A500",
    ),
    false,
  );
});
