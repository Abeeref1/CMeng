import test from "node:test";
import assert from "node:assert/strict";

import type {
  CanonicalCalendar,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import {
  buildScheduleAnalyticsProjection,
} from "../packages/schedule-analytics/src";
import {
  buildMilestonesProjection,
} from "../packages/milestones-analysis/src";
import {
  buildLookAheadProjection,
} from "../packages/lookahead-schedule/src";
import {
  buildProgressScurveProjection,
} from "../packages/progress-scurve/src";
import {
  buildIndependentForecastProjection,
} from "../packages/independent-forecast/src";
import {
  buildProgressReportProjection,
} from "../packages/progress-report/src";
import {
  projectionDefinition,
} from "../packages/analysis-runtime/src";

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
      ...[2, 3, 4, 5, 6].map(
        (dayIndex) => ({
          dayIndex,
          intervals: [
            {
              start: "08:00",
              finish: "16:00",
              minutes: 480,
            },
          ],
        }),
      ),
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

function model(): CanonicalScheduleModel {
  return {
    projectId: "P88",
    source: "xer",
    sourceRevisionId: "rev-1",
    dataDateIso: "2026-01-05",
    activities: [
      activity("A100", {
        status: "completed",
        actualStartIso:
          "2026-01-05T08:00:00.000Z",
        actualFinishIso:
          "2026-01-05T16:00:00.000Z",
        remainingDurationHours: 0,
        totalFloatHours: 0,
        percentComplete: 100,
      }),
      activity("A200", {
        status: "in_progress",
        currentStartIso:
          "2026-01-06T08:00:00.000Z",
        currentFinishIso:
          "2026-01-06T16:00:00.000Z",
        baselineStartIso:
          "2026-01-06T08:00:00.000Z",
        baselineFinishIso:
          "2026-01-06T16:00:00.000Z",
        actualStartIso:
          "2026-01-06T08:00:00.000Z",
        remainingDurationHours: 4,
        totalFloatHours: 16,
        percentComplete: 50,
      }),
      activity("M300", {
        activityType: "finish_milestone",
        status: "not_started",
        currentStartIso:
          "2026-01-07T08:00:00.000Z",
        currentFinishIso:
          "2026-01-07T08:00:00.000Z",
        baselineStartIso:
          "2026-01-06T16:00:00.000Z",
        baselineFinishIso:
          "2026-01-06T16:00:00.000Z",
        originalDurationHours: 0,
        remainingDurationHours: 0,
        totalFloatHours: 32,
        percentComplete: 0,
      }),
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
        successorActivityId: "M300",
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
  };
}

test("Progress Report consumes governed projections and preserves differently-based progress values", () => {
  const source = model();
  const generatedAt =
    "2026-09-18T19:00:00.000Z";

  const scheduleAnalytics =
    buildScheduleAnalyticsProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "schedule-v1",
      },
    );
  const milestones =
    buildMilestonesProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "milestones-v1",
      },
    );
  const lookAhead =
    buildLookAheadProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "lookahead-v1",
      },
    );
  const progressScurve =
    buildProgressScurveProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "scurve-v1",
        actualHistory: [
          {
            asOfIso: "2026-01-05",
            progressPercent: 50,
            sourceRevisionId: "rev-1",
            sourceRefs: [
              "governed-progress-snapshot",
            ],
          },
        ],
      },
    );
  const independentForecast =
    buildIndependentForecastProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "forecast-v1",
      },
    );

  const report =
    buildProgressReportProjection({
      generatedAt,
      producerVersion:
        "progress-report-v1",
      scheduleAnalytics,
      milestones,
      lookAhead,
      progressScurve,
      independentForecast,
    });

  assert.equal(
    report.sourceProjections.length,
    5,
  );
  assert.equal(
    report.progress
      .durationWeightedProgressPercent,
    75,
  );
  assert.equal(
    report.progress
      .scurveActualSnapshotPercent,
    50,
  );
  assert.equal(
    report.progress
      .scurveActualSnapshotCoveragePercent,
    100,
  );

  assert.equal(
    report.forecast
      .sourceForecastCompletionIso,
    independentForecast
      .sourceForecastCompletionIso,
  );
  assert.equal(
    report.forecast
      .independentForecastCompletionIso,
    independentForecast
      .independentForecastCompletionIso,
  );
});

test("Progress Report rejects projection inputs from different schedule revisions", () => {
  const source = model();
  const generatedAt =
    "2026-09-18T19:00:00.000Z";

  const scheduleAnalytics =
    buildScheduleAnalyticsProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "schedule-v1",
      },
    );
  const milestones =
    buildMilestonesProjection(
      source,
      {
        generatedAt,
        producerVersion:
          "milestones-v1",
      },
    );
  milestones.sourceRevisionId = "rev-2";

  assert.throws(
    () =>
      buildProgressReportProjection({
        generatedAt,
        producerVersion:
          "progress-report-v1",
        scheduleAnalytics,
        milestones,
        lookAhead:
          buildLookAheadProjection(
            source,
            {
              generatedAt,
              producerVersion:
                "lookahead-v1",
            },
          ),
        progressScurve:
          buildProgressScurveProjection(
            source,
            {
              generatedAt,
              producerVersion:
                "scurve-v1",
            },
          ),
        independentForecast:
          buildIndependentForecastProjection(
            source,
            {
              generatedAt,
              producerVersion:
                "forecast-v1",
            },
          ),
      }),
    /different schedule revisions/,
  );
});

test("durable Progress Report projection declares every upstream schedule dependency", () => {
  const definition =
    projectionDefinition(
      "progress_report",
    );

  assert.deepEqual(
    [...definition.dependencies].sort(),
    [
      "independent_forecast",
      "lookahead_schedule",
      "milestones",
      "progress_scurve",
      "schedule_analytics",
    ].sort(),
  );
});


test("Progress S-Curve controlled-baseline coverage uses the baseline population rather than the current population", () => {
  const baseline =
    model();
  baseline.sourceRevisionId =
    "baseline-rev";

  const current =
    model();
  current.sourceRevisionId =
    "current-rev";
  current.activities =
    current.activities.filter(
      (activity) =>
        activity.activityId !==
        "A200",
    );
  current.relationships = [];

  const scurve =
    buildProgressScurveProjection(
      current,
      {
        generatedAt:
          "2026-09-20T07:00:00.000Z",
        producerVersion:
          "controlled-baseline-test-v1",
        baselineModel:
          baseline,
      },
    );

  assert.equal(
    scurve.baselineCoveragePercent,
    100,
    "baseline coverage must be measured against baseline-eligible activities, not the smaller current population",
  );
  assert.equal(
    scurve.currentCoveragePercent,
    100,
  );
  assert.ok(
    scurve.diagnostics.includes(
      "SCURVE_CONTROLLED_BASELINE_REVISION_AND_CURRENT_DERIVED_BY_DURATION_WEIGHTED_LINEAR_TIME_PHASING",
    ),
  );
});
