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
import {
  AnalysisCoordinator,
  DurableProjectionWorker,
  InMemoryAnalysisJobQueue,
  InMemoryAnalysisMetadataStore,
  InMemoryArtifactStore,
  InMemoryCheckpointStore,
  type AnalysisInputSnapshot,
} from "../packages/analysis-runtime/src";
import {
  CMengProjectionExecutor,
  InMemoryProjectAnalysisContextStore,
  ProjectAnalysisOrchestrator,
} from "../packages/project-analysis-runtime/src";

const ACTIVITY_COUNT = 50_000;
const MAX_SINGLE_PROJECTION_MS = 20_000;

function largeModel(
  activityCount = ACTIVITY_COUNT,
): CanonicalScheduleModel {
  const activities:
    CanonicalScheduleActivity[] =
    new Array(activityCount);
  const relationships:
    CanonicalScheduleRelationship[] =
    new Array(activityCount - 1);

  for (
    let index = 0;
    index < activityCount;
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


function scaleSnapshot(
  revision: string,
): AnalysisInputSnapshot {
  return {
    projectId: "P-SCALE",
    evidenceRevisionId: revision,
    evidenceFingerprint:
      "scale-evidence-" + revision,
    sourceManifestId:
      "scale-manifest-" + revision,
    mappingVersion: "map-scale-v1",
    parserVersion: "parser-scale-v1",
    analysisEngineVersion:
      "analysis-scale-v1",
    analysisPlanVersion:
      "plan-scale-v1",
    projectConfigFingerprint:
      "config-scale-v1",
    createdAt:
      "2026-09-18T20:00:00.000Z",
  };
}

test(
  "10,000-activity full durable projection plan publishes PMO with every worker call below slice ceiling",
  { timeout: 180_000 },
  async () => {
    const model = largeModel(10_000);

    const metadata =
      new InMemoryAnalysisMetadataStore();
    const artifacts =
      new InMemoryArtifactStore();
    const checkpoints =
      new InMemoryCheckpointStore();
    const queue =
      new InMemoryAnalysisJobQueue();
    const contexts =
      new InMemoryProjectAnalysisContextStore();
    const coordinator =
      new AnalysisCoordinator(
        metadata,
        queue,
      );
    const orchestrator =
      new ProjectAnalysisOrchestrator(
        contexts,
        coordinator,
      );
    const executor =
      new CMengProjectionExecutor(
        contexts,
        metadata,
        artifacts,
      );
    const worker =
      new DurableProjectionWorker(
        metadata,
        artifacts,
        checkpoints,
        queue,
        coordinator,
        executor,
      );

    const run =
      await orchestrator.ensure(
        scaleSnapshot("rev-scale"),
        {
          generatedAt:
            "2026-09-18T20:00:00.000Z",
          analysisEngineVersion:
            "analysis-scale-v1",
          currentSchedule: model,
          scheduleRevisions: [
            {
              revisionId:
                model.sourceRevisionId,
              label: "Current",
              sequence: 1,
              effectiveAt:
                model.dataDateIso,
              model,
            },
          ],
          resources: null,
          quantities: null,
          forecastHistory: [],
          contract: null,
          delayClaims: null,
          contractTimeBasis: null,
        },
        "2026-09-18T20:00:00.000Z",
      );

    let iterations = 0;
    let maxWorkerMs = 0;

    while (
      (await queue.size()) > 0 &&
      iterations < 100
    ) {
      const started =
        performance.now();
      const result =
        await worker.processOne(
          "scale-worker",
          new Date(
            Date.parse(
              "2026-09-18T20:00:00.000Z",
            ) +
              iterations *
                60_000,
          ).toISOString(),
        );
      const elapsed =
        performance.now() - started;
      maxWorkerMs = Math.max(
        maxWorkerMs,
        elapsed,
      );

      assert.ok(
        elapsed <
          MAX_SINGLE_PROJECTION_MS,
        "Durable projection worker call exceeded " +
          MAX_SINGLE_PROJECTION_MS +
          " ms: " +
          elapsed.toFixed(2) +
          " ms for result " +
          result,
      );

      iterations += 1;
    }

    assert.equal(
      await queue.size(),
      0,
    );
    assert.ok(iterations < 100);

    const head =
      await metadata.getProjectHead(
        "P-SCALE",
      );
    assert.equal(
      head.publishedRunId,
      run.runId,
    );

    const pmo =
      await coordinator.readProjection(
        "P-SCALE",
        "pmo_analysis",
      );
    assert.equal(pmo.state, "ready");
    assert.ok(pmo.artifact);

    assert.equal(
      artifacts.writes,
      run.projectionKeys.length,
    );

    assert.ok(
      maxWorkerMs <
        MAX_SINGLE_PROJECTION_MS,
    );
  },
);
