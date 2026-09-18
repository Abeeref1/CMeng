import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
  CanonicalScheduleRelationship,
} from "../packages/schedule-analysis-core/src";
import {
  buildScheduleAnalyticsProjection,
} from "../packages/schedule-analytics/src";
import {
  buildActivityAnalyticsProjection,
} from "../packages/activity-analytics/src";
import {
  buildIndependentForecastProjection,
} from "../packages/independent-forecast/src";
import {
  buildProgressScurveProjection,
} from "../packages/progress-scurve/src";

const ACTIVITY_COUNT = 50_000;
const MAX_SINGLE_PROJECTION_MS = 20_000;

function largeModel(): CanonicalScheduleModel {
  const activities:
    CanonicalScheduleActivity[] =
    new Array(ACTIVITY_COUNT);
  const relationships:
    CanonicalScheduleRelationship[] =
    new Array(ACTIVITY_COUNT - 1);

  for (
    let index = 0;
    index < ACTIVITY_COUNT;
    index += 1
  ) {
    const activityId =
      "A" +
      String(index + 1).padStart(
        6,
        "0",
      );

    activities[index] = {
      projectId: "P-SCALE",
      activityId,
      nativeId: String(index + 1),
      name: "Activity " + (index + 1),
      wbsId: "W1",
      calendarId: null,
      activityType: "task",
      status: "not_started",
      baselineStartIso: "2026-01-01",
      baselineFinishIso: "2026-01-02",
      currentStartIso: "2026-01-01",
      currentFinishIso: "2026-01-02",
      actualStartIso: null,
      actualFinishIso: null,
      forecastStartIso: null,
      forecastFinishIso: null,
      originalDurationHours: 1,
      remainingDurationHours: 1,
      totalFloatHours:
        index % 48,
      freeFloatHours:
        index % 24,
      percentComplete: 0,
      sourceRefs: [],
      diagnostics: [],
    };

    if (index > 0) {
      relationships[index - 1] = {
        relationshipId:
          "R" + index,
        predecessorActivityId:
          "A" +
          String(index).padStart(
            6,
            "0",
          ),
        successorActivityId:
          activityId,
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      };
    }
  }

  return {
    projectId: "P-SCALE",
    source: "xer",
    sourceRevisionId: "scale-rev-1",
    dataDateIso: "2026-01-01",
    activities,
    relationships,
    wbs: [
      {
        wbsId: "W1",
        parentWbsId: null,
        name: "Scale",
        sourceRefs: [],
      },
    ],
    calendars: [],
    diagnostics: [],
  };
}

function timed<T>(
  label: string,
  fn: () => T,
): {
  value: T;
  elapsedMs: number;
} {
  const started = performance.now();
  const value = fn();
  const elapsedMs =
    performance.now() - started;

  assert.ok(
    elapsedMs <
      MAX_SINGLE_PROJECTION_MS,
    label +
      " exceeded " +
      MAX_SINGLE_PROJECTION_MS +
      " ms worker-safe ceiling: " +
      elapsedMs.toFixed(2) +
      " ms",
  );

  return {
    value,
    elapsedMs,
  };
}

test(
  "50,000-activity schedule projections complete below the worker-safe ceiling",
  { timeout: 120_000 },
  () => {
    const model = largeModel();

    const schedule = timed(
      "Schedule Analytics",
      () =>
        buildScheduleAnalyticsProjection(
          model,
          {
            generatedAt:
              "2026-09-18T20:00:00.000Z",
            producerVersion:
              "scale-schedule-v1",
          },
        ),
    );

    assert.equal(
      schedule.value.result.activityCount,
      ACTIVITY_COUNT,
    );
    assert.equal(
      schedule.value.result.graph.complete,
      true,
    );
    assert.equal(
      schedule.value.result.graph
        .connectedComponentCount,
      1,
    );

    const activity = timed(
      "Activity Analytics",
      () =>
        buildActivityAnalyticsProjection(
          model,
          {
            generatedAt:
              "2026-09-18T20:00:00.000Z",
            producerVersion:
              "scale-activity-v1",
          },
        ),
    );

    assert.equal(
      activity.value.activityCount,
      ACTIVITY_COUNT,
    );

    const forecast = timed(
      "Independent Forecast",
      () =>
        buildIndependentForecastProjection(
          model,
          {
            generatedAt:
              "2026-09-18T20:00:00.000Z",
            producerVersion:
              "scale-forecast-v1",
          },
        ),
    );

    assert.equal(
      forecast.value.calculatedActivityCount,
      ACTIVITY_COUNT,
    );
    assert.equal(
      forecast.value.complete,
      true,
    );
    assert.equal(
      forecast.value.activityCoveragePercent,
      100,
    );

    const scurve = timed(
      "Progress S-Curve",
      () =>
        buildProgressScurveProjection(
          model,
          {
            generatedAt:
              "2026-09-18T20:00:00.000Z",
            producerVersion:
              "scale-scurve-v1",
            intervalDays: 7,
          },
        ),
    );

    assert.equal(
      scurve.value.baselineCoveragePercent,
      100,
    );
    assert.equal(
      scurve.value.currentCoveragePercent,
      100,
    );
  },
);
