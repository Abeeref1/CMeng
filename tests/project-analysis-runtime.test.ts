import test from "node:test";
import assert from "node:assert/strict";

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
import type {
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";

function snapshot(
  revision: string,
): AnalysisInputSnapshot {
  return {
    projectId: "P88",
    evidenceRevisionId: revision,
    evidenceFingerprint:
      "evidence-" + revision,
    sourceManifestId:
      "manifest-" + revision,
    mappingVersion: "map-v2",
    parserVersion: "parser-v2",
    analysisEngineVersion:
      "analysis-v2",
    analysisPlanVersion: "plan-v2",
    projectConfigFingerprint:
      "config-v1",
    createdAt:
      "2026-09-18T20:00:00.000Z",
  };
}

function schedule(
  revision: string,
): CanonicalScheduleModel {
  return {
    projectId: "P88",
    source: "schedule_csv",
    sourceRevisionId: revision,
    dataDateIso: "2026-09-18",
    activities: [
      {
        projectId: "P88",
        activityId: "A100",
        nativeId: null,
        name: "Delivery Activity",
        wbsId: "W1",
        calendarId: null,
        activityType: "task",
        status: "in_progress",
        baselineStartIso:
          "2026-09-18",
        baselineFinishIso:
          "2026-09-20",
        currentStartIso:
          "2026-09-18",
        currentFinishIso:
          "2026-09-21",
        actualStartIso:
          "2026-09-18",
        actualFinishIso: null,
        forecastStartIso:
          "2026-09-18",
        forecastFinishIso:
          "2026-09-21",
        originalDurationHours: 72,
        remainingDurationHours: 72,
        totalFloatHours: 0,
        freeFloatHours: 0,
        percentComplete: 25,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    relationships: [],
    wbs: [
      {
        wbsId: "W1",
        parentWbsId: null,
        name: "Project",
        sourceRefs: [],
      },
    ],
    calendars: [],
    diagnostics: [],
  };
}

test("full project analysis materializes durably once and page reopen creates zero jobs", async () => {
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

  const input = snapshot("rev-1");
  const current = schedule("sched-rev-1");

  const run =
    await orchestrator.ensure(
      input,
      {
        generatedAt:
          "2026-09-18T20:00:00.000Z",
        analysisEngineVersion:
          "analysis-v2",
        currentSchedule: current,
        scheduleRevisions: [
          {
            revisionId:
              "sched-rev-1",
            label: "Current",
            sequence: 1,
            effectiveAt:
              "2026-09-18",
            model: current,
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

  assert.equal(
    await queue.size(),
    run.projectionKeys.length,
  );

  let iterations = 0;

  while (
    (await queue.size()) > 0 &&
    iterations < 100
  ) {
    const timestamp = new Date(
      Date.parse(
        "2026-09-18T20:00:00.000Z",
      ) +
        iterations * 60_000,
    ).toISOString();

    await worker.processOne(
      "worker-1",
      timestamp,
    );
    iterations += 1;
  }

  assert.ok(iterations < 100);
  assert.equal(await queue.size(), 0);

  const head =
    await metadata.getProjectHead("P88");

  assert.equal(
    head.publishedRunId,
    run.runId,
  );
  assert.equal(
    head.desiredRunId,
    run.runId,
  );

  const pmoRead =
    await coordinator.readProjection(
      "P88",
      "pmo_analysis",
    );

  assert.equal(pmoRead.state, "ready");
  assert.equal(
    pmoRead.isCurrentRevision,
    true,
  );
  assert.ok(pmoRead.artifact);

  const pmoBytes =
    await artifacts.get(
      pmoRead.artifact!,
    );
  assert.ok(pmoBytes);

  const pmo = JSON.parse(
    new TextDecoder().decode(
      pmoBytes!,
    ),
  );

  assert.equal(
    pmo.projectionKey,
    "pmo_analysis",
  );
  assert.equal(
    pmo.schedule.activityCount,
    1,
  );
  assert.equal(
    pmo.progress
      .durationWeightedProgressPercent,
    25,
  );
  assert.equal(
    pmo.quantities.allocationState,
    "missing",
  );
  assert.equal(
    pmo.contract.physicalComplete,
    false,
  );

  const artifactsWritten =
    artifacts.writes;

  for (let index = 0; index < 10; index += 1) {
    const read =
      await coordinator.readProjection(
        "P88",
        "schedule_analytics",
      );
    assert.equal(read.state, "ready");
  }

  assert.equal(await queue.size(), 0);
  assert.equal(
    artifacts.writes,
    artifactsWritten,
  );

  const sameRun =
    await orchestrator.ensure(
      input,
      {
        generatedAt:
          "2026-09-18T20:00:00.000Z",
        analysisEngineVersion:
          "analysis-v2",
        currentSchedule: current,
        scheduleRevisions: [
          {
            revisionId:
              "sched-rev-1",
            label: "Current",
            sequence: 1,
            effectiveAt:
              "2026-09-18",
            model: current,
          },
        ],
        resources: null,
        quantities: null,
        forecastHistory: [],
        contract: null,
        delayClaims: null,
        contractTimeBasis: null,
      },
      "2026-09-18T21:00:00.000Z",
    );

  assert.equal(
    sameRun.runId,
    run.runId,
  );
  assert.equal(await queue.size(), 0);
  assert.equal(
    artifacts.writes,
    artifactsWritten,
  );
});

test("worker retries when job is queued before immutable project context exists", async () => {
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

  const input = snapshot("rev-2");

  const run =
    await coordinator.ensureProjectAnalysis(
      input,
      "2026-09-18T20:00:00.000Z",
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

  const first =
    await worker.processOne(
      "worker-1",
      "2026-09-18T20:00:00.000Z",
    );

  assert.equal(first, "checkpointed");
  assert.ok((await queue.size()) > 0);

  const current = schedule("sched-rev-2");

  await contexts.put({
    runId: run.runId,
    projectId: "P88",
    evidenceRevisionId: "rev-2",
    generatedAt:
      "2026-09-18T20:00:00.000Z",
    analysisEngineVersion:
      "analysis-v2",
    currentSchedule: current,
    scheduleRevisions: [
      {
        revisionId: "sched-rev-2",
        label: "Current",
        sequence: 1,
        effectiveAt: "2026-09-18",
        model: current,
      },
    ],
    resources: null,
    quantities: null,
    forecastHistory: [],
    contract: null,
    delayClaims: null,
    contractTimeBasis: null,
  });

  const second =
    await worker.processOne(
      "worker-1",
      "2026-09-18T20:01:00.000Z",
    );

  assert.equal(second, "published");
});
