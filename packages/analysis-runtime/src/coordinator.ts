import {
  analysisRunIdentity,
} from "./fingerprint";
import {
  DEFAULT_ANALYSIS_PLAN,
  projectionKeys,
} from "./plan";
import type {
  AnalysisMetadataStore,
  AnalysisJobQueue,
} from "./stores";
import type {
  AnalysisInputSnapshot,
  AnalysisProjectionKey,
  AnalysisRunRecord,
  ProjectionReadModel,
  ProjectionRecord,
  PublishedAnalysisPointer,
} from "./types";

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

export class AnalysisCoordinator {
  constructor(
    private readonly metadata: AnalysisMetadataStore,
    private readonly queue: AnalysisJobQueue,
  ) {}

  async ensureProjectAnalysis(
    snapshot: AnalysisInputSnapshot,
    now?: string,
  ): Promise<AnalysisRunRecord> {
    const identity = analysisRunIdentity(snapshot);
    const existing =
      await this.metadata.findRunByFingerprint(
        snapshot.projectId,
        identity.inputFingerprint,
      );

    if (existing) {
      await this.metadata.setDesiredRun(
        snapshot.projectId,
        existing.runId,
      );
      await this.ensureProjectionJobs(existing, now);
      return existing;
    }

    const timestamp = nowIso(now);
    const keys = projectionKeys(DEFAULT_ANALYSIS_PLAN);
    const run: AnalysisRunRecord = {
      ...identity,
      state: "queued",
      createdAt: timestamp,
      updatedAt: timestamp,
      projectionKeys: keys,
      readyProjectionCount: 0,
      failedProjectionCount: 0,
      publishedAt: null,
    };

    await this.metadata.createRun(snapshot, run);
    await this.metadata.setDesiredRun(
      snapshot.projectId,
      run.runId,
    );

    for (const key of keys) {
      const projection: ProjectionRecord = {
        runId: run.runId,
        projectId: run.projectId,
        evidenceRevisionId: run.evidenceRevisionId,
        projectionKey: key,
        state: "queued",
        attempt: 0,
        checkpointCursor: null,
        artifact: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        errorCode: null,
        errorMessage: null,
      };
      await this.metadata.putProjection(projection);
    }

    await this.ensureProjectionJobs(run, now);
    return run;
  }

  async ensureProjectionJobs(
    run: AnalysisRunRecord,
    _now?: string,
  ): Promise<void> {
    for (const projectionKey of run.projectionKeys) {
      const projection =
        await this.metadata.getProjection(
          run.runId,
          projectionKey,
        );

      if (
        projection?.state === "ready" ||
        projection?.state === "failed"
      ) {
        continue;
      }

      await this.queue.enqueueUnique({
        jobId:
          "job_" +
          run.runId +
          "_" +
          projectionKey,
        runId: run.runId,
        projectId: run.projectId,
        evidenceRevisionId:
          run.evidenceRevisionId,
        projectionKey,
        phase:
          projection?.artifact
            ? "publish"
            : "compute",
        chunkCursor:
          projection?.checkpointCursor ?? null,
        pendingArtifact:
          projection?.artifact ?? null,
        attempt: projection?.attempt ?? 0,
      });
    }
  }

  async markProjectionReady(
    runId: string,
    projectionKey: AnalysisProjectionKey,
    artifact: ProjectionRecord["artifact"],
    now?: string,
  ): Promise<void> {
    if (!artifact) {
      throw new Error(
        "Ready projection requires an artifact",
      );
    }

    const timestamp = nowIso(now);
    const projection =
      await this.metadata.getProjection(
        runId,
        projectionKey,
      );

    if (!projection) {
      throw new Error(
        "Projection record not found: " +
          runId +
          "/" +
          projectionKey,
      );
    }

    await this.metadata.putProjection({
      ...projection,
      state: "ready",
      artifact,
      updatedAt: timestamp,
      errorCode: null,
      errorMessage: null,
    });

    const run = await this.metadata.getRun(runId);
    if (!run) {
      throw new Error("Run not found: " + runId);
    }

    const projections =
      await this.metadata.listProjections(runId);
    const readyProjectionCount =
      projections.filter(
        (item) => item.state === "ready",
      ).length;
    const failedProjectionCount =
      projections.filter(
        (item) => item.state === "failed",
      ).length;

    await this.metadata.updateRun({
      ...run,
      state:
        readyProjectionCount ===
        run.projectionKeys.length
          ? "materialized"
          : "preparing",
      readyProjectionCount,
      failedProjectionCount,
      updatedAt: timestamp,
    });
  }

  async tryPublishRun(
    runId: string,
    now?: string,
  ): Promise<boolean> {
    const run = await this.metadata.getRun(runId);
    if (!run) {
      throw new Error("Run not found: " + runId);
    }

    const projections =
      await this.metadata.listProjections(runId);

    const required = DEFAULT_ANALYSIS_PLAN
      .filter(
        (definition) =>
          definition.requiredForPublish,
      )
      .map((definition) => definition.key);

    const ready = new Set(
      projections
        .filter(
          (projection) =>
            projection.state === "ready" &&
            projection.artifact !== null,
        )
        .map(
          (projection) =>
            projection.projectionKey,
        ),
    );

    if (
      required.some(
        (key) => !ready.has(key),
      )
    ) {
      return false;
    }

    const timestamp = nowIso(now);
    const pointer: PublishedAnalysisPointer = {
      projectId: run.projectId,
      runId: run.runId,
      evidenceRevisionId:
        run.evidenceRevisionId,
      inputFingerprint:
        run.inputFingerprint,
      publishedAt: timestamp,
    };

    await this.metadata.publishRunAtomically(
      pointer,
    );
    await this.metadata.updateRun({
      ...run,
      state: "published",
      readyProjectionCount:
        projections.filter(
          (projection) =>
            projection.state === "ready",
        ).length,
      failedProjectionCount:
        projections.filter(
          (projection) =>
            projection.state === "failed",
        ).length,
      updatedAt: timestamp,
      publishedAt: timestamp,
    });

    return true;
  }

  async readProjection(
    projectId: string,
    projectionKey: AnalysisProjectionKey,
  ): Promise<ProjectionReadModel> {
    const head =
      await this.metadata.getProjectHead(
        projectId,
      );

    const desiredRun = head.desiredRunId
      ? await this.metadata.getRun(
          head.desiredRunId,
        )
      : null;
    const publishedRun = head.publishedRunId
      ? await this.metadata.getRun(
          head.publishedRunId,
        )
      : null;

    if (
      head.publishedRunId &&
      head.desiredRunId === head.publishedRunId
    ) {
      const projection =
        await this.metadata.getProjection(
          head.publishedRunId,
          projectionKey,
        );

      return {
        state:
          projection?.state === "ready"
            ? "ready"
            : "retrying",
        projectId,
        projectionKey,
        desiredRunId: head.desiredRunId,
        publishedRunId:
          head.publishedRunId,
        desiredEvidenceRevisionId:
          desiredRun?.evidenceRevisionId ??
          null,
        publishedEvidenceRevisionId:
          publishedRun?.evidenceRevisionId ??
          null,
        artifact:
          projection?.state === "ready"
            ? projection.artifact
            : null,
        isCurrentRevision:
          projection?.state === "ready",
      };
    }

    if (head.desiredRunId) {
      return {
        state: head.publishedRunId
          ? "updating"
          : "preparing",
        projectId,
        projectionKey,
        desiredRunId: head.desiredRunId,
        publishedRunId:
          head.publishedRunId,
        desiredEvidenceRevisionId:
          desiredRun?.evidenceRevisionId ??
          null,
        publishedEvidenceRevisionId:
          publishedRun?.evidenceRevisionId ??
          null,
        artifact: null,
        isCurrentRevision: false,
      };
    }

    return {
      state: "preparing",
      projectId,
      projectionKey,
      desiredRunId: null,
      publishedRunId:
        head.publishedRunId,
      desiredEvidenceRevisionId: null,
      publishedEvidenceRevisionId:
        publishedRun?.evidenceRevisionId ??
        null,
      artifact: null,
      isCurrentRevision: false,
    };
  }
}
