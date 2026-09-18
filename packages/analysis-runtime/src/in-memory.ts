import {
  artifactHash,
} from "./fingerprint";
import type {
  AnalysisMetadataStore,
  AnalysisJobQueue,
  ProjectionArtifactStore,
  ProjectionCheckpointStore,
} from "./stores";
import type {
  AnalysisInputSnapshot,
  AnalysisProjectionKey,
  AnalysisRunRecord,
  DurableCheckpoint,
  ProjectAnalysisHead,
  ProjectionArtifactPointer,
  ProjectionJob,
  ProjectionRecord,
  PublishedAnalysisPointer,
  WorkerLease,
} from "./types";
import { MetadataUnavailableError } from "./types";

function projectionId(
  runId: string,
  key: AnalysisProjectionKey,
): string {
  return runId + "::" + key;
}

export class InMemoryAnalysisMetadataStore
  implements AnalysisMetadataStore
{
  private readonly runs =
    new Map<string, AnalysisRunRecord>();
  private readonly snapshots =
    new Map<string, AnalysisInputSnapshot>();
  private readonly projections =
    new Map<string, ProjectionRecord>();
  private readonly heads =
    new Map<string, ProjectAnalysisHead>();
  private readonly published =
    new Map<string, PublishedAnalysisPointer>();

  available = true;

  private assertAvailable(): void {
    if (!this.available) {
      throw new MetadataUnavailableError();
    }
  }

  async findRunByFingerprint(
    projectId: string,
    inputFingerprint: string,
  ): Promise<AnalysisRunRecord | null> {
    this.assertAvailable();
    return (
      [...this.runs.values()].find(
        (run) =>
          run.projectId === projectId &&
          run.inputFingerprint === inputFingerprint,
      ) ?? null
    );
  }

  async getRun(
    runId: string,
  ): Promise<AnalysisRunRecord | null> {
    this.assertAvailable();
    return this.runs.get(runId) ?? null;
  }

  async createRun(
    snapshot: AnalysisInputSnapshot,
    record: AnalysisRunRecord,
  ): Promise<void> {
    this.assertAvailable();
    if (this.runs.has(record.runId)) return;
    this.snapshots.set(record.runId, snapshot);
    this.runs.set(record.runId, {
      ...record,
      projectionKeys: [...record.projectionKeys],
    });
  }

  async updateRun(
    record: AnalysisRunRecord,
  ): Promise<void> {
    this.assertAvailable();
    this.runs.set(record.runId, {
      ...record,
      projectionKeys: [...record.projectionKeys],
    });
  }

  async getProjectHead(
    projectId: string,
  ): Promise<ProjectAnalysisHead> {
    this.assertAvailable();
    return (
      this.heads.get(projectId) ?? {
        projectId,
        desiredRunId: null,
        publishedRunId: null,
      }
    );
  }

  async setDesiredRun(
    projectId: string,
    runId: string,
  ): Promise<void> {
    this.assertAvailable();
    const current = await this.getProjectHead(projectId);
    this.heads.set(projectId, {
      ...current,
      desiredRunId: runId,
    });
  }

  async getProjection(
    runId: string,
    key: AnalysisProjectionKey,
  ): Promise<ProjectionRecord | null> {
    this.assertAvailable();
    return (
      this.projections.get(
        projectionId(runId, key),
      ) ?? null
    );
  }

  async putProjection(
    record: ProjectionRecord,
  ): Promise<void> {
    this.assertAvailable();
    this.projections.set(
      projectionId(
        record.runId,
        record.projectionKey,
      ),
      { ...record },
    );
  }

  async listProjections(
    runId: string,
  ): Promise<ProjectionRecord[]> {
    this.assertAvailable();
    return [...this.projections.values()]
      .filter((projection) => projection.runId === runId)
      .map((projection) => ({ ...projection }));
  }

  async publishRunAtomically(
    pointer: PublishedAnalysisPointer,
  ): Promise<void> {
    this.assertAvailable();
    const current = await this.getProjectHead(
      pointer.projectId,
    );

    if (
      current.desiredRunId !== pointer.runId
    ) {
      throw new Error(
        "Cannot publish a run that is no longer desired",
      );
    }

    this.published.set(
      pointer.projectId,
      { ...pointer },
    );
    this.heads.set(pointer.projectId, {
      ...current,
      publishedRunId: pointer.runId,
    });
  }

  publishedPointer(
    projectId: string,
  ): PublishedAnalysisPointer | null {
    return this.published.get(projectId) ?? null;
  }
}

export class InMemoryArtifactStore
  implements ProjectionArtifactStore
{
  private readonly payloads =
    new Map<string, Uint8Array>();

  writes = 0;

  async putImmutable(
    runId: string,
    projectionKey: AnalysisProjectionKey,
    payload: Uint8Array,
  ): Promise<ProjectionArtifactPointer> {
    const hash = artifactHash(payload);
    const artifactId =
      runId + "::" + projectionKey + "::" + hash;

    if (!this.payloads.has(artifactId)) {
      this.payloads.set(
        artifactId,
        Uint8Array.from(payload),
      );
      this.writes += 1;
    }

    return {
      artifactId,
      contentHash: hash,
      byteLength: payload.byteLength,
    };
  }

  async get(
    pointer: ProjectionArtifactPointer,
  ): Promise<Uint8Array | null> {
    const payload = this.payloads.get(
      pointer.artifactId,
    );
    return payload
      ? Uint8Array.from(payload)
      : null;
  }
}

export class InMemoryCheckpointStore
  implements ProjectionCheckpointStore
{
  private readonly checkpoints =
    new Map<string, DurableCheckpoint>();

  async put(
    checkpoint: DurableCheckpoint,
  ): Promise<void> {
    this.checkpoints.set(
      projectionId(
        checkpoint.runId,
        checkpoint.projectionKey,
      ),
      {
        ...checkpoint,
        payload: Uint8Array.from(
          checkpoint.payload,
        ),
      },
    );
  }

  async get(
    runId: string,
    projectionKey: AnalysisProjectionKey,
  ): Promise<DurableCheckpoint | null> {
    const checkpoint = this.checkpoints.get(
      projectionId(runId, projectionKey),
    );

    return checkpoint
      ? {
          ...checkpoint,
          payload: Uint8Array.from(
            checkpoint.payload,
          ),
        }
      : null;
  }

  async delete(
    runId: string,
    projectionKey: AnalysisProjectionKey,
  ): Promise<void> {
    this.checkpoints.delete(
      projectionId(runId, projectionKey),
    );
  }
}

interface QueueEntry {
  job: ProjectionJob;
  lease: WorkerLease | null;
}

export class InMemoryAnalysisJobQueue
  implements AnalysisJobQueue
{
  private readonly entries =
    new Map<string, QueueEntry>();

  private jobKey(job: ProjectionJob): string {
    return (
      job.runId +
      "::" +
      job.projectionKey
    );
  }

  async enqueueUnique(
    job: ProjectionJob,
  ): Promise<boolean> {
    const key = this.jobKey(job);
    if (this.entries.has(key)) return false;

    this.entries.set(key, {
      job: { ...job },
      lease: null,
    });
    return true;
  }

  async acquire(
    ownerId: string,
    now: string,
    leaseMs: number,
  ): Promise<{
    job: ProjectionJob;
    lease: WorkerLease;
  } | null> {
    const nowMs = Date.parse(now);

    for (const [key, entry] of this.entries) {
      const expired =
        entry.lease !== null &&
        Date.parse(entry.lease.expiresAt) <= nowMs;

      if (entry.lease && !expired) continue;

      if (
        entry.job.notBefore &&
        Date.parse(entry.job.notBefore) > nowMs
      ) {
        continue;
      }

      const lease: WorkerLease = {
        leaseId:
          "lease_" +
          key +
          "_" +
          ownerId,
        jobId: entry.job.jobId,
        ownerId,
        acquiredAt: now,
        expiresAt: new Date(
          nowMs + leaseMs,
        ).toISOString(),
      };

      entry.lease = lease;
      return {
        job: { ...entry.job },
        lease: { ...lease },
      };
    }

    return null;
  }

  async renew(
    lease: WorkerLease,
    now: string,
    leaseMs: number,
  ): Promise<WorkerLease> {
    const entry = [...this.entries.values()]
      .find(
        (candidate) =>
          candidate.lease?.leaseId === lease.leaseId,
      );

    if (!entry || !entry.lease) {
      throw new Error("Lease no longer exists");
    }

    const renewed: WorkerLease = {
      ...entry.lease,
      expiresAt: new Date(
        Date.parse(now) + leaseMs,
      ).toISOString(),
    };
    entry.lease = renewed;
    return { ...renewed };
  }

  async complete(
    lease: WorkerLease,
  ): Promise<void> {
    const found = [...this.entries.entries()]
      .find(
        ([, entry]) =>
          entry.lease?.leaseId === lease.leaseId,
      );
    if (found) this.entries.delete(found[0]);
  }

  async retry(
    lease: WorkerLease,
    job: ProjectionJob,
  ): Promise<void> {
    const found = [...this.entries.entries()]
      .find(
        ([, entry]) =>
          entry.lease?.leaseId === lease.leaseId,
      );

    if (!found) return;

    found[1].job = { ...job };
    found[1].lease = null;
  }

  async size(): Promise<number> {
    return this.entries.size;
  }
}
