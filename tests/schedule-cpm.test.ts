import test from "node:test";
import assert from "node:assert/strict";

import type {
  CanonicalCalendar,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import {
  addWorkingHours,
  calculateCpm,
  subtractWorkingHours,
  workingHoursBetween,
} from "../packages/schedule-cpm/src";

function fiveDayCalendar(
  exceptions: CanonicalCalendar["exceptions"] = [],
): CanonicalCalendar {
  return {
    calendarId: "CAL-5D",
    name: "Mon-Fri 8h",
    semanticComplete: true,
    weeklyWorkMinutes: [
      0, 480, 480, 480, 480, 480, 0,
    ],
    weeklyWorkIntervals: [
      { dayIndex: 1, intervals: [] },
      {
        dayIndex: 2,
        intervals: [
          {
            start: "08:00",
            finish: "16:00",
            minutes: 480,
          },
        ],
      },
      {
        dayIndex: 3,
        intervals: [
          {
            start: "08:00",
            finish: "16:00",
            minutes: 480,
          },
        ],
      },
      {
        dayIndex: 4,
        intervals: [
          {
            start: "08:00",
            finish: "16:00",
            minutes: 480,
          },
        ],
      },
      {
        dayIndex: 5,
        intervals: [
          {
            start: "08:00",
            finish: "16:00",
            minutes: 480,
          },
        ],
      },
      {
        dayIndex: 6,
        intervals: [
          {
            start: "08:00",
            finish: "16:00",
            minutes: 480,
          },
        ],
      },
      { dayIndex: 7, intervals: [] },
    ],
    exceptions,
    standardDayHours: 8,
    standardWeekHours: 40,
    sourceRefs: [],
  };
}

function activity(
  activityId: string,
  overrides: Partial<CanonicalScheduleActivity> = {},
): CanonicalScheduleActivity {
  return {
    projectId: "P88",
    activityId,
    nativeId: null,
    name: activityId,
    wbsId: "W1",
    calendarId: "CAL-5D",
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
    originalDurationHours: 8,
    remainingDurationHours: 8,
    totalFloatHours: null,
    freeFloatHours: null,
    percentComplete: 0,
    sourceRefs: [],
    diagnostics: [],
    ...overrides,
  };
}

function chainModel(
  overrides: Partial<CanonicalScheduleModel> = {},
): CanonicalScheduleModel {
  return {
    projectId: "P88",
    source: "xer",
    sourceRevisionId: "rev-1",
    dataDateIso: "2026-01-05",
    activities: [
      activity("A100"),
      activity("A200"),
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
    ],
    wbs: [],
    calendars: [fiveDayCalendar()],
    diagnostics: [],
    ...overrides,
  };
}

test('execution CPM excludes LOE and WBS durations and retains the source population',()=>{
  const base=chainModel();
  const expected=calculateCpm(base);
  const extended=chainModel({activities:[...base.activities,
    activity('ADMIN',{activityType:'level_of_effort',remainingDurationHours:100000}),
    activity('SUMMARY',{activityType:'wbs_summary',remainingDurationHours:200000})]});
  const result=calculateCpm(extended);
  assert.equal(result.projectFinishIso,expected.projectFinishIso);
  assert.equal(result.activityPopulation.sourceCount,4);
  assert.equal(result.activityPopulation.denominator,2);
  assert.deepEqual(result.activityPopulation.exclusions,[{activityId:'ADMIN',reason:'level_of_effort'},{activityId:'SUMMARY',reason:'wbs_summary'}]);
  assert.ok(!result.criticalActivityIds.includes('ADMIN'));
  assert.equal(calculateCpm(chainModel({activities:[extended.activities[2]!],relationships:[]})).complete,false);
});
test('source constraints remain explicit limitations of the unconstrained network calculation',()=>{
  const model=chainModel();
  model.activities[1]!.sourceConstraints=[{type:'CS_MEO',dateIso:'2026-01-06T16:00:00'}];
  const result=calculateCpm(model);
  assert.ok(result.assumptions.includes('SOURCE_CONSTRAINTS_RETAINED_NOT_APPLIED_TO_UNCONSTRAINED_NETWORK:1'));
  assert.equal(model.activities[1]!.sourceConstraints[0]!.dateIso,'2026-01-06T16:00:00');
});

test("working-time arithmetic crosses weekends and non-working exceptions exactly", () => {
  const calendar = fiveDayCalendar([
    {
      isoDate: "2026-01-06",
      nonWorking: true,
      workIntervals: [],
    },
  ]);

  const mondayStart = Date.parse(
    "2026-01-05T08:00:00.000Z",
  );
  const mondayFinish = addWorkingHours(
    calendar,
    mondayStart,
    8,
  );
  assert.equal(
    new Date(mondayFinish).toISOString(),
    "2026-01-05T16:00:00.000Z",
  );

  const nextEight = addWorkingHours(
    calendar,
    mondayFinish,
    8,
  );
  assert.equal(
    new Date(nextEight).toISOString(),
    "2026-01-07T16:00:00.000Z",
  );

  const backSixteen = subtractWorkingHours(
    calendar,
    nextEight,
    16,
  );
  assert.equal(
    new Date(backSixteen).toISOString(),
    "2026-01-05T08:00:00.000Z",
  );

  assert.equal(
    workingHoursBetween(
      calendar,
      mondayFinish,
      nextEight,
    ),
    8,
  );
});

test("independent CPM calculates a simple FS chain on source calendar working time", () => {
  const result = calculateCpm(
    chainModel(),
  );

  assert.equal(
    result.calculationMode,
    "calendar_working_time",
  );
  assert.equal(result.complete, true);
  assert.equal(
    result.projectFinishIso,
    "2026-01-06T16:00:00.000Z",
  );
  assert.deepEqual(
    result.criticalActivityIds,
    ["A100", "A200"],
  );

  const first = result.activities.find(
    (row) => row.activityId === "A100",
  )!;
  const second = result.activities.find(
    (row) => row.activityId === "A200",
  )!;

  assert.equal(
    first.earlyStartIso,
    "2026-01-05T08:00:00.000Z",
  );
  assert.equal(
    first.earlyFinishIso,
    "2026-01-05T16:00:00.000Z",
  );
  assert.equal(
    second.earlyStartIso,
    "2026-01-06T08:00:00.000Z",
  );
  assert.equal(
    second.earlyFinishIso,
    "2026-01-06T16:00:00.000Z",
  );
  assert.equal(first.totalFloatHours, 0);
  assert.equal(second.totalFloatHours, 0);
});

test("parallel shorter path receives positive independent CPM float", () => {
  const model = chainModel();
  model.activities.push(
    activity("A300", {
      remainingDurationHours: 4,
      originalDurationHours: 4,
    }),
  );

  const result = calculateCpm(model);
  const parallel = result.activities.find(
    (row) => row.activityId === "A300",
  )!;

  assert.equal(result.complete, true);
  assert.equal(
    parallel.earlyFinishIso,
    "2026-01-05T12:00:00.000Z",
  );
  assert.equal(
    parallel.totalFloatHours,
    12,
  );
  assert.equal(parallel.critical, false);
});

test("required finish earlier than calculated finish produces negative float", () => {
  const result = calculateCpm(
    chainModel(),
    {
      requiredFinishIso: "2026-01-05",
    },
  );

  assert.equal(
    result.projectFinishIso,
    "2026-01-06T16:00:00.000Z",
  );
  assert.equal(
    result.requiredFinishIso,
    "2026-01-06T00:00:00.000Z",
  );

  const second = result.activities.find(
    (row) => row.activityId === "A200",
  )!;
  assert.ok(
    second.totalFloatHours !== null &&
      second.totalFloatHours < 0,
  );
});

test("day-unit duration converts only through proven source calendar day hours", () => {
  const model = chainModel({
    activities: [
      activity("A100", {
        originalDurationHours: null,
        remainingDurationHours: null,
        originalDurationRaw: "2",
        originalDurationUnit: "days",
        remainingDurationRaw: "2",
        remainingDurationUnit: "days",
      }),
    ],
    relationships: [],
  });

  const result = calculateCpm(model);
  const row = result.activities[0]!;

  assert.equal(row.durationHours, 16);
  assert.equal(
    row.durationMethod,
    "source_days_converted_using_calendar_standard_day_hours",
  );
  assert.equal(
    row.earlyFinishIso,
    "2026-01-06T16:00:00.000Z",
  );
});

test("missing calendar still calculates an explicitly labeled 24h elapsed scenario", () => {
  const model = chainModel({
    calendars: [],
    activities: [
      activity("A100", {
        calendarId: null,
        remainingDurationHours: 24,
        originalDurationHours: 24,
      }),
    ],
    relationships: [],
  });

  const result = calculateCpm(model);

  assert.equal(result.complete, true);
  assert.equal(
    result.calculationMode,
    "elapsed_time_fallback",
  );
  assert.equal(
    result.projectFinishIso,
    "2026-01-06T00:00:00.000Z",
  );
  assert.ok(
    result.assumptions.includes(
      "ACTIVITY_CALENDAR_MISSING_ASSUMED_24H_ELAPSED",
    ),
  );
});

test("unknown relationship type can be calculated as a flagged FS scenario", () => {
  const model = chainModel();
  model.relationships[0]!.type = "unknown";

  const result = calculateCpm(model);

  assert.equal(result.complete, true);
  assert.ok(
    result.assumptions.includes(
      "UNKNOWN_RELATIONSHIP_TYPE_ASSUMED_FS",
    ),
  );
  assert.equal(
    result.projectFinishIso,
    "2026-01-06T16:00:00.000Z",
  );
});

test("cyclic network is never force-calculated", () => {
  const model = chainModel();
  model.relationships.push({
    relationshipId: "R2",
    predecessorActivityId: "A200",
    successorActivityId: "A100",
    type: "FS",
    lagHours: 0,
    external: false,
    sourceRefs: [],
    diagnostics: [],
  });

  const result = calculateCpm(model);

  assert.equal(result.complete, false);
  assert.equal(result.projectFinishIso, null);
  assert.deepEqual(
    result.unresolvedActivityIds,
    ["A100", "A200"],
  );
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.startsWith(
          "SCHEDULE_GRAPH_CYCLES:",
        ),
    ),
  );
});
