import {
  artifactHash,
} from "./fingerprint";
import type {
  AnalysisMetadataStore,
  AnalysisJobQueue,
  ProjectionArtifactStore,
  ProjectionCheckpointStore,
} from "./stores";
import {
  MetadataUnavailableError,
  ProjectionDependencyNotReadyError,
  RetryableProjectionError,
  type DurableCheckpoint,
  type ProjectionChunkResult,
  type ProjectionJob,
} from "./types";
import { AnalysisCoordinator } from "./coordinator";
import { retryDecision } from "../../runtime-supervision/src";

export interface ProjectionExecutor {
  processChunk(input: {
    job: ProjectionJob;
    checkpoint: DurableCheckpoint | null;
    sliceBudgetMs: number;
  }): Promise<ProjectionChunkResult>;
}

export interface DurableWorkerPolicy {
  leaseMs: number;
  sliceBudgetMs: number;
}

export const DEFAULT_DURABLE_WORKER_POLICY: DurableWorkerPolicy = {
  // Deliberately below a ~37 second host termination window.
  leaseMs: 30_000,
  sliceBudgetMs: 20_000,
};

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function retryNotBefore(
  timestamp: string,
  attempt: number,
): string {
  const decision = retryDecision(attempt);
  return new Date(
    Date.parse(timestamp) + decision.delayMs,
  ).toISOString();
}

export class DurableProjectionWorker {
  constructor(
    private readonly metadata: AnalysisMetadataStore,
    private readonly artifacts: ProjectionArtifactStore,
    private readonly checkpoints: ProjectionCheckpointStore,
    private readonly queue: AnalysisJobQueue,
    private readonly coordinator: AnalysisCoordinator,
    private readonly executor: ProjectionExecutor,
    private readonly policy: DurableWorkerPolicy =
      DEFAULT_DURABLE_WORKER_POLICY,
  ) {}

  async processOne(
    ownerId: string,
    now?: string,
  ): Promise<"idle" | "checkpointed" | "published" | "publish_retry"> {
    const timestamp = nowIso(now);
    const acquired =
      await this.queue.acquire(
        ownerId,
        timestamp,
        this.policy.leaseMs,
      );

    if (!acquired) return "idle";

    const { lease } = acquired;
    let job = acquired.job;

    if (
      job.phase === "publish" &&
      job.pendingArtifact
    ) {
      try {
        await this.publishArtifact(
          job,
          job.pendingArtifact,
          timestamp,
        );
        await this.queue.complete(lease);
        return "published";
      } catch (error) {
        if (
          error instanceof
          MetadataUnavailableError
        ) {
          const nextAttempt = job.attempt + 1;
          await this.queue.retry(
            lease,
            {
              ...job,
              attempt: nextAttempt,
              notBefore: retryNotBefore(
                timestamp,
                nextAttempt,
              ),
            },
          );
          return "publish_retry";
        }
        throw error;
      }
    }

    const checkpoint =
      await this.checkpoints.get(
        job.runId,
        job.projectionKey,
      );

    // Metadata state is observational here, not required for
    // computation. If the DB endpoint is unavailable the worker can
    // still compute and checkpoint safely.
    try {
      const projection =
        await this.metadata.getProjection(
          job.runId,
          job.projectionKey,
        );
      if (projection) {
        await this.metadata.putProjection({
          ...projection,
          state: "preparing",
          attempt: job.attempt,
          updatedAt: timestamp,
          errorCode: null,
          errorMessage: null,
        });
      }
    } catch (error) {
      if (
        !(error instanceof MetadataUnavailableError)
      ) {
        throw error;
      }
    }

    let result: ProjectionChunkResult;

    try {
      result =
        await this.executor.processChunk({
          job,
          checkpoint,
          sliceBudgetMs:
            this.policy.sliceBudgetMs,
        });
    } catch (error) {
      if (
        error instanceof
          MetadataUnavailableError ||
        error instanceof
          ProjectionDependencyNotReadyError ||
        error instanceof
          RetryableProjectionError
      ) {
        const nextAttempt =
          job.attempt + 1;
        await this.queue.retry(
          lease,
          {
            ...job,
            notBefore: retryNotBefore(
              timestamp,
              nextAttempt,
            ),
            attempt: nextAttempt,
          },
        );
        return "checkpointed";
      }

      throw error;
    }

    const durableCheckpoint: DurableCheckpoint = {
      runId: job.runId,
      projectionKey: job.projectionKey,
      cursor: result.nextCursor,
      payloadHash: artifactHash(
        result.checkpointPayload,
      ),
      payload: Uint8Array.from(
        result.checkpointPayload,
      ),
      savedAt: timestamp,
    };

    // Checkpoint is committed before queue acknowledgement.
    await this.checkpoints.put(
      durableCheckpoint,
    );

    if (!result.done) {
      job = {
        ...job,
        chunkCursor: result.nextCursor,
        notBefore: null,
        attempt: job.attempt + 1,
      };

      try {
        const projection =
          await this.metadata.getProjection(
            job.runId,
            job.projectionKey,
          );
        if (projection) {
          await this.metadata.putProjection({
            ...projection,
            state: "preparing",
            attempt: job.attempt,
            checkpointCursor:
              result.nextCursor,
            updatedAt: timestamp,
          });
        }
      } catch (error) {
        if (
          !(error instanceof MetadataUnavailableError)
        ) {
          throw error;
        }
      }

      await this.queue.retry(lease, job);
      return "checkpointed";
    }

    if (!result.finalArtifact) {
      throw new Error(
        "Completed projection chunk did not return finalArtifact",
      );
    }

    // Immutable artifact is stored before metadata promotion.
    const pointer =
      await this.artifacts.putImmutable(
        job.runId,
        job.projectionKey,
        result.finalArtifact,
      );

    try {
      await this.publishArtifact(
        job,
        pointer,
        timestamp,
      );
      await this.checkpoints.delete(
        job.runId,
        job.projectionKey,
      );
      await this.queue.complete(lease);
      return "published";
    } catch (error) {
      if (
        error instanceof MetadataUnavailableError ||
        error instanceof
          ProjectionDependencyNotReadyError
      ) {
        // No recomputation. The immutable artifact already exists;
        // dependency/metadata publication is retried only.
        const nextAttempt = job.attempt + 1;
        await this.queue.retry(
          lease,
          {
            ...job,
            phase: "publish",
            pendingArtifact: pointer,
            notBefore: retryNotBefore(
              timestamp,
              nextAttempt,
            ),
            attempt: nextAttempt,
          },
        );
        return "publish_retry";
      }
      throw error;
    }
  }

  private async publishArtifact(
    job: ProjectionJob,
    pointer: NonNullable<ProjectionJob["pendingArtifact"]>,
    timestamp: string,
  ): Promise<void> {
    await this.coordinator.markProjectionReady(
      job.runId,
      job.projectionKey,
      pointer,
      timestamp,
    );

    await this.coordinator.tryPublishRun(
      job.runId,
      timestamp,
    );
  }
}
