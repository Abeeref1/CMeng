import test from "node:test";
import assert from "node:assert/strict";

import {
  AnalysisCoordinator,
  DEFAULT_ANALYSIS_PLAN,
  DurableProjectionWorker,
  InMemoryAnalysisJobQueue,
  InMemoryAnalysisMetadataStore,
  InMemoryArtifactStore,
  InMemoryCheckpointStore,
  analysisRunIdentity,
  deterministicValue,
  shouldBlockForApproval,
  type AnalysisInputSnapshot,
  type ProjectionExecutor,
} from "../packages/analysis-runtime/src";

function snapshot(
  revision: string,
  evidenceFingerprint = "evidence-" + revision,
): AnalysisInputSnapshot {
  return {
    projectId: "P88",
    evidenceRevisionId: revision,
    evidenceFingerprint,
    sourceManifestId: "manifest-" + revision,
    mappingVersion: "map-v1",
    parserVersion: "parser-v1",
    analysisEngineVersion: "analysis-v1",
    analysisPlanVersion: "plan-v1",
    projectConfigFingerprint: "config-v1",
    createdAt: "2026-09-18T10:00:00.000Z",
  };
}

function runtime() {
  const metadata = new InMemoryAnalysisMetadataStore();
  const artifacts = new InMemoryArtifactStore();
  const checkpoints = new InMemoryCheckpointStore();
  const queue = new InMemoryAnalysisJobQueue();
  const coordinator = new AnalysisCoordinator(
    metadata,
    queue,
  );
  return {
    metadata,
    artifacts,
    checkpoints,
    queue,
    coordinator,
  };
}

async function publishAll(
  rt: ReturnType<typeof runtime>,
  input: AnalysisInputSnapshot,
): Promise<string> {
  const run = await rt.coordinator.ensureProjectAnalysis(
    input,
    "2026-09-18T10:00:00.000Z",
  );

  for (const definition of DEFAULT_ANALYSIS_PLAN) {
    const artifact = await rt.artifacts.putImmutable(
      run.runId,
      definition.key,
      new TextEncoder().encode(
        JSON.stringify({
          runId: run.runId,
          projection: definition.key,
        }),
      ),
    );

    await rt.coordinator.markProjectionReady(
      run.runId,
      definition.key,
      artifact,
      "2026-09-18T10:01:00.000Z",
    );
  }

  const published = await rt.coordinator.tryPublishRun(
    run.runId,
    "2026-09-18T10:02:00.000Z",
  );
  assert.equal(published, true);
  return run.runId;
}

test("same evidence revision is idempotent and page opens do not enqueue reruns", async () => {
  const rt = runtime();
  const input = snapshot("rev-1");

  const first = await rt.coordinator.ensureProjectAnalysis(
    input,
    "2026-09-18T10:00:00.000Z",
  );
  const firstQueueSize = await rt.queue.size();

  const second = await rt.coordinator.ensureProjectAnalysis(
    input,
    "2026-09-18T10:05:00.000Z",
  );
  const secondQueueSize = await rt.queue.size();

  assert.equal(first.runId, second.runId);
  assert.equal(
    firstQueueSize,
    DEFAULT_ANALYSIS_PLAN.length,
  );
  assert.equal(secondQueueSize, firstQueueSize);

  for (let index = 0; index < 20; index += 1) {
    const read = await rt.coordinator.readProjection(
      "P88",
      "progress_scurve",
    );
    assert.equal(read.state, "preparing");
    assert.equal(read.artifact, null);
  }

  assert.equal(
    await rt.queue.size(),
    firstQueueSize,
  );
});

test("new evidence creates a new run and never exposes old artifact as current data", async () => {
  const rt = runtime();
  const oldRunId = await publishAll(
    rt,
    snapshot("rev-1"),
  );

  const ready = await rt.coordinator.readProjection(
    "P88",
    "progress_scurve",
  );
  assert.equal(ready.state, "ready");
  assert.equal(ready.isCurrentRevision, true);
  assert.equal(ready.publishedRunId, oldRunId);
  assert.ok(ready.artifact);

  const next = await rt.coordinator.ensureProjectAnalysis(
    snapshot("rev-2"),
    "2026-09-18T10:10:00.000Z",
  );

  assert.notEqual(next.runId, oldRunId);

  const updating = await rt.coordinator.readProjection(
    "P88",
    "progress_scurve",
  );

  assert.equal(updating.state, "updating");
  assert.equal(updating.publishedRunId, oldRunId);
  assert.equal(updating.desiredRunId, next.runId);
  assert.equal(updating.isCurrentRevision, false);

  // Old published data may remain stored, but it is not returned as
  // the result for the new desired revision.
  assert.equal(updating.artifact, null);
  assert.equal(
    updating.desiredEvidenceRevisionId,
    "rev-2",
  );
  assert.equal(
    updating.publishedEvidenceRevisionId,
    "rev-1",
  );
});

test("run publication is atomic across the full projection plan", async () => {
  const rt = runtime();
  const input = snapshot("rev-1");
  const run = await rt.coordinator.ensureProjectAnalysis(
    input,
    "2026-09-18T10:00:00.000Z",
  );

  const firstKey = DEFAULT_ANALYSIS_PLAN[0]!.key;
  const artifact = await rt.artifacts.putImmutable(
    run.runId,
    firstKey,
    new TextEncoder().encode("first projection"),
  );

  await rt.coordinator.markProjectionReady(
    run.runId,
    firstKey,
    artifact,
    "2026-09-18T10:01:00.000Z",
  );

  const stamped =
    await rt.metadata.getProjection(
      run.runId,
      firstKey,
    );
  assert.ok(stamped?.dependencyReceiptId);
  assert.equal(
    stamped?.producerVersion,
    "analysis-v1:" + firstKey,
  );
  assert.deepEqual(
    stamped?.upstreamProjectionHashes,
    {},
  );

  assert.equal(
    await rt.coordinator.tryPublishRun(
      run.runId,
      "2026-09-18T10:01:01.000Z",
    ),
    false,
  );

  const head = await rt.metadata.getProjectHead(
    "P88",
  );
  assert.equal(head.publishedRunId, null);

  const read = await rt.coordinator.readProjection(
    "P88",
    firstKey,
  );
  assert.equal(read.state, "ready");
  assert.ok(read.artifact);
  assert.equal(read.isCurrentRevision, true);

  const stillPreparing = await rt.coordinator.readProjection(
    "P88",
    DEFAULT_ANALYSIS_PLAN[1]!.key,
  );
  assert.equal(stillPreparing.state, "preparing");
  assert.equal(stillPreparing.artifact, null);
});

test("worker checkpoints one bounded chunk and resumes after termination without starting over", async () => {
  const rt = runtime();
  const run = await rt.coordinator.ensureProjectAnalysis(
    snapshot("rev-1"),
    "2026-09-18T10:00:00.000Z",
  );

  let calls = 0;
  let secondCallSawCheckpoint = false;

  const executor: ProjectionExecutor = {
    async processChunk({ checkpoint, sliceBudgetMs }) {
      calls += 1;
      assert.equal(sliceBudgetMs, 20_000);

      if (calls === 1) {
        assert.equal(checkpoint, null);
        return {
          done: false,
          nextCursor: "chunk-2",
          checkpointPayload:
            new TextEncoder().encode("chunk-1-done"),
        };
      }

      secondCallSawCheckpoint =
        checkpoint?.cursor === "chunk-2" &&
        new TextDecoder().decode(
          checkpoint.payload,
        ) === "chunk-1-done";

      return {
        done: true,
        nextCursor: null,
        checkpointPayload:
          new TextEncoder().encode("all-done"),
        finalArtifact:
          new TextEncoder().encode("projection-result"),
      };
    },
  };

  const worker = new DurableProjectionWorker(
    rt.metadata,
    rt.artifacts,
    rt.checkpoints,
    rt.queue,
    rt.coordinator,
    executor,
  );

  const first = await worker.processOne(
    "worker-a",
    "2026-09-18T10:00:00.000Z",
  );
  assert.equal(first, "checkpointed");

  // Simulate process death here. A new worker instance resumes from
  // the checkpoint instead of recomputing chunk 1.
  const resumedWorker = new DurableProjectionWorker(
    rt.metadata,
    rt.artifacts,
    rt.checkpoints,
    rt.queue,
    rt.coordinator,
    executor,
  );

  const second = await resumedWorker.processOne(
    "worker-b",
    "2026-09-18T10:00:31.000Z",
  );

  assert.equal(second, "published");
  assert.equal(calls, 2);
  assert.equal(secondCallSawCheckpoint, true);

  const firstProjection =
    await rt.metadata.getProjection(
      run.runId,
      DEFAULT_ANALYSIS_PLAN[0]!.key,
    );
  assert.equal(firstProjection?.state, "ready");
});

test("database outage after artifact materialization causes publish-only retry with zero recomputation", async () => {
  const rt = runtime();
  await rt.coordinator.ensureProjectAnalysis(
    snapshot("rev-1"),
    "2026-09-18T10:00:00.000Z",
  );

  let executorCalls = 0;
  const executor: ProjectionExecutor = {
    async processChunk() {
      executorCalls += 1;
      return {
        done: true,
        nextCursor: null,
        checkpointPayload:
          new TextEncoder().encode("done"),
        finalArtifact:
          new TextEncoder().encode("durable-scurve"),
      };
    },
  };

  const worker = new DurableProjectionWorker(
    rt.metadata,
    rt.artifacts,
    rt.checkpoints,
    rt.queue,
    rt.coordinator,
    executor,
  );

  rt.metadata.available = false;

  const first = await worker.processOne(
    "worker-a",
    "2026-09-18T10:00:00.000Z",
  );

  assert.equal(first, "publish_retry");
  assert.equal(executorCalls, 1);
  assert.equal(rt.artifacts.writes, 1);

  // DB comes back. Backoff prevents a hot-loop before notBefore.
  rt.metadata.available = true;

  const tooEarly = await worker.processOne(
    "worker-b",
    "2026-09-18T10:00:00.500Z",
  );
  assert.equal(tooEarly, "idle");
  assert.equal(executorCalls, 1);

  const second = await worker.processOne(
    "worker-b",
    "2026-09-18T10:00:31.000Z",
  );

  assert.equal(second, "published");
  assert.equal(executorCalls, 1);
  assert.equal(rt.artifacts.writes, 1);
});

test("analysis fingerprint changes only when material analysis inputs change", () => {
  const first = analysisRunIdentity(
    snapshot("rev-1", "hash-a"),
  );
  const same = analysisRunIdentity(
    snapshot("rev-1", "hash-a"),
  );
  const changed = analysisRunIdentity(
    snapshot("rev-2", "hash-b"),
  );

  assert.equal(first.runId, same.runId);
  assert.equal(
    first.inputFingerprint,
    same.inputFingerprint,
  );
  assert.notEqual(first.runId, changed.runId);
});

test("calculable values never block on manual approval", () => {
  const variance = deterministicValue(
    -8,
    "forecast_finish - baseline_finish",
    [
      "schedule:A100:forecast_finish",
      "schedule:A100:baseline_finish",
    ],
  );

  assert.equal(
    variance.origin,
    "deterministic_derived",
  );
  assert.equal(variance.value, -8);
  assert.equal(
    shouldBlockForApproval(variance.origin),
    false,
  );
});


test("expired worker lease can be reacquired after abrupt termination", async () => {
  const rt = runtime();
  const identity = analysisRunIdentity(
    snapshot("rev-1"),
  );

  await rt.queue.enqueueUnique({
    jobId: "single-lease-job",
    runId: identity.runId,
    projectId: "P88",
    evidenceRevisionId: "rev-1",
    projectionKey: "progress_scurve",
    phase: "compute",
    chunkCursor: null,
    pendingArtifact: null,
    notBefore: null,
    attempt: 0,
  });

  const first = await rt.queue.acquire(
    "worker-a",
    "2026-09-18T10:00:00.000Z",
    30_000,
  );
  assert.ok(first);

  const beforeExpiry = await rt.queue.acquire(
    "worker-b",
    "2026-09-18T10:00:20.000Z",
    30_000,
  );
  assert.equal(beforeExpiry, null);

  // Worker A vanished without complete/retry. Lease expiry makes the
  // exact same durable job available to a new worker.
  const afterExpiry = await rt.queue.acquire(
    "worker-b",
    "2026-09-18T10:00:31.000Z",
    30_000,
  );
  assert.ok(afterExpiry);
  assert.equal(
    afterExpiry!.job.jobId,
    first!.job.jobId,
  );
});


test("dependent projection cannot become ready before its declared upstream projection", async () => {
  const rt = runtime();
  const run = await rt.coordinator.ensureProjectAnalysis(
    snapshot("rev-1"),
    "2026-09-18T10:00:00.000Z",
  );

  const artifact = await rt.artifacts.putImmutable(
    run.runId,
    "activity_analytics",
    new TextEncoder().encode("activity-result"),
  );

  await assert.rejects(
    () =>
      rt.coordinator.markProjectionReady(
        run.runId,
        "activity_analytics",
        artifact,
        "2026-09-18T10:01:00.000Z",
      ),
    (error: any) => {
      assert.equal(
        error.code,
        "PROJECTION_DEPENDENCY_NOT_READY",
      );
      assert.equal(
        error.dependencyKey,
        "schedule_analytics",
      );
      return true;
    },
  );
});

test("dependent projection receipt records upstream artifact hash after dependency is ready", async () => {
  const rt = runtime();
  const run = await rt.coordinator.ensureProjectAnalysis(
    snapshot("rev-1"),
    "2026-09-18T10:00:00.000Z",
  );

  const scheduleArtifact =
    await rt.artifacts.putImmutable(
      run.runId,
      "schedule_analytics",
      new TextEncoder().encode("schedule-result"),
    );

  await rt.coordinator.markProjectionReady(
    run.runId,
    "schedule_analytics",
    scheduleArtifact,
    "2026-09-18T10:01:00.000Z",
  );

  const activityArtifact =
    await rt.artifacts.putImmutable(
      run.runId,
      "activity_analytics",
      new TextEncoder().encode("activity-result"),
    );

  await rt.coordinator.markProjectionReady(
    run.runId,
    "activity_analytics",
    activityArtifact,
    "2026-09-18T10:02:00.000Z",
  );

  const activity =
    await rt.metadata.getProjection(
      run.runId,
      "activity_analytics",
    );

  assert.ok(activity?.dependencyReceiptId);
  assert.equal(
    activity?.upstreamProjectionHashes
      .schedule_analytics,
    scheduleArtifact.contentHash,
  );
});

test("source manifest change invalidates analysis identity even when evidence label is unchanged", () => {
  const firstInput = snapshot(
    "rev-1",
    "same-evidence-fingerprint",
  );
  const secondInput = {
    ...firstInput,
    sourceManifestId: "manifest-repacked",
  };

  const first = analysisRunIdentity(firstInput);
  const second = analysisRunIdentity(secondInput);

  assert.notEqual(first.runId, second.runId);
});
