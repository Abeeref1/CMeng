import test from "node:test";
import assert from "node:assert/strict";

import type {
  CanonicalCalendar,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import {
  buildIndependentForecastProjection,
} from "../packages/independent-forecast/src";
import {
  buildForecastHistoryProjection,
  forecastSnapshotFromProjection,
} from "../packages/forecast-history/src";
import {
  buildImplementedScheduleProjection,
  buildImplementedForecastHistoryProjection,
} from "../packages/schedule-modules/src";

function calendar(): CanonicalCalendar {
  return {
    calendarId: "CAL1",
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
    exceptions: [],
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
    calendarId: "CAL1",
    activityType: "task",
    status: "not_started",
    baselineStartIso: "2026-01-05T08:00:00.000Z",
    baselineFinishIso: "2026-01-05T16:00:00.000Z",
    currentStartIso: "2026-01-05T08:00:00.000Z",
    currentFinishIso: "2026-01-05T16:00:00.000Z",
    actualStartIso: null,
    actualFinishIso: null,
    forecastStartIso: null,
    forecastFinishIso: null,
    originalDurationHours: 8,
    remainingDurationHours: 8,
    totalFloatHours: 8,
    freeFloatHours: 8,
    percentComplete: 0,
    sourceRefs: [],
    diagnostics: [],
    ...overrides,
  };
}

function model(
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
    calendars: [calendar()],
    diagnostics: [],
    ...overrides,
  };
}

test("Independent Forecast publishes source-vs-independent completion variance from source calendars", () => {
  const projection =
    buildIndependentForecastProjection(
      model(),
      {
        generatedAt:
          "2026-09-18T18:00:00.000Z",
        producerVersion:
          "independent-forecast-v1",
      },
    );

  assert.equal(
    projection.origin,
    "deterministic_source_calendar",
  );
  assert.equal(projection.complete, true);
  assert.equal(
    projection.sourceForecastCompletionIso,
    "2026-01-05T16:00:00.000Z",
  );
  assert.equal(
    projection.independentForecastCompletionIso,
    "2026-01-06T16:00:00.000Z",
  );
  assert.equal(
    projection.forecastVarianceDays,
    1,
  );
  assert.equal(
    projection.activityCoveragePercent,
    100,
  );

  const a200 = projection.activities.find(
    (row) => row.activityId === "A200",
  )!;
  assert.equal(
    a200.independentEarlyFinishIso,
    "2026-01-06T16:00:00.000Z",
  );
  assert.equal(a200.finishVarianceDays, 1);
  assert.equal(a200.critical, true);
});

test("Independent Forecast labels missing-calendar calculation as a scenario rather than deterministic source CPM", () => {
  const input = model({
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

  const projection =
    buildIndependentForecastProjection(
      input,
      {
        generatedAt:
          "2026-09-18T18:00:00.000Z",
        producerVersion:
          "independent-forecast-v1",
      },
    );

  assert.equal(
    projection.origin,
    "scenario_with_assumptions",
  );
  assert.equal(
    projection.calculationMode,
    "elapsed_time_fallback",
  );
  assert.ok(
    projection.assumptions.includes(
      "ACTIVITY_CALENDAR_MISSING_ASSUMED_24H_ELAPSED",
    ),
  );
});

test("Forecast History uses stored forecast snapshots and measures movement between them", () => {
  const first =
    buildIndependentForecastProjection(
      model(),
      {
        generatedAt:
          "2026-01-05T17:00:00.000Z",
        producerVersion:
          "independent-forecast-v1",
      },
    );

  const delayed = model({
    sourceRevisionId: "rev-2",
    activities: [
      activity("A100"),
      activity("A200", {
        remainingDurationHours: 16,
        originalDurationHours: 16,
      }),
    ],
  });

  const second =
    buildIndependentForecastProjection(
      delayed,
      {
        generatedAt:
          "2026-01-06T17:00:00.000Z",
        producerVersion:
          "independent-forecast-v1",
      },
    );

  const projection =
    buildForecastHistoryProjection(
      [
        forecastSnapshotFromProjection(
          first,
          "snapshot-1",
        ),
        forecastSnapshotFromProjection(
          second,
          "snapshot-2",
        ),
      ],
      {
        generatedAt:
          "2026-09-18T18:00:00.000Z",
        producerVersion:
          "forecast-history-v1",
      },
    );

  assert.equal(projection.snapshotCount, 2);
  assert.equal(
    projection.establishedForecastCount,
    2,
  );
  assert.equal(
    projection.points[0]!
      .movementDaysVsPrevious,
    null,
  );
  assert.equal(
    projection.points[1]!
      .movementDaysVsPrevious,
    1,
  );
  assert.equal(
    projection.points[1]!
      .movementDaysVsFirst,
    1,
  );
});

test("Forecast History preserves an unestablished historical snapshot instead of filling it from later data", () => {
  const projection =
    buildForecastHistoryProjection(
      [
        {
          snapshotId: "snapshot-1",
          generatedAt:
            "2026-01-01T10:00:00.000Z",
          sourceRevisionId: "rev-1",
          dataDateIso: "2026-01-01",
          producerVersion:
            "independent-forecast-v1",
          origin: "unresolved",
          role: "regular_update",
          independentForecastCompletionIso:
            null,
          sourceForecastCompletionIso:
            "2026-02-01",
          assumptions: [],
        },
        {
          snapshotId: "snapshot-2",
          generatedAt:
            "2026-01-02T10:00:00.000Z",
          sourceRevisionId: "rev-2",
          dataDateIso: "2026-01-02",
          producerVersion:
            "independent-forecast-v1",
          origin:
            "deterministic_source_calendar",
          role: "regular_update",
          independentForecastCompletionIso:
            "2026-02-03",
          sourceForecastCompletionIso:
            "2026-02-02",
          assumptions: [],
        },
      ],
      {
        generatedAt:
          "2026-09-18T18:00:00.000Z",
        producerVersion:
          "forecast-history-v1",
      },
    );

  assert.equal(
    projection.points[0]!
      .independentForecastCompletionIso,
    null,
  );
  assert.equal(
    projection.points[0]!
      .movementDaysVsFirst,
    null,
  );
  assert.ok(
    projection.diagnostics.includes(
      "FORECAST_HISTORY_CONTAINS_UNESTABLISHED_SNAPSHOTS",
    ),
  );
});

test("schedule registry exposes Independent Forecast and Forecast History builders", () => {
  const forecast =
    buildImplementedScheduleProjection(
      "independent_forecast",
      model(),
      {
        generatedAt:
          "2026-09-18T18:00:00.000Z",
        producerVersion: "test",
      },
    ) as any;

  assert.equal(
    forecast.projectionKey,
    "independent_forecast",
  );

  const history =
    buildImplementedForecastHistoryProjection(
      [
        forecastSnapshotFromProjection(
          forecast,
          "snapshot-1",
        ),
      ],
      {
        generatedAt:
          "2026-09-18T18:00:00.000Z",
        producerVersion: "test",
      },
    ) as any;

  assert.equal(
    history.projectionKey,
    "forecast_history",
  );
});
