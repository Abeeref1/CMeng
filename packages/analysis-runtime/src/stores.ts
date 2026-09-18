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

export interface AnalysisMetadataStore {
  findRunByFingerprint(
    projectId: string,
    inputFingerprint: string,
  ): Promise<AnalysisRunRecord | null>;

  getRun(runId: string): Promise<AnalysisRunRecord | null>;

  createRun(
    snapshot: AnalysisInputSnapshot,
    record: AnalysisRunRecord,
  ): Promise<void>;

  updateRun(record: AnalysisRunRecord): Promise<void>;

  getProjectHead(
    projectId: string,
  ): Promise<ProjectAnalysisHead>;

  setDesiredRun(
    projectId: string,
    runId: string,
  ): Promise<void>;

  getProjection(
    runId: string,
    key: AnalysisProjectionKey,
  ): Promise<ProjectionRecord | null>;

  putProjection(
    record: ProjectionRecord,
  ): Promise<void>;

  listProjections(
    runId: string,
  ): Promise<ProjectionRecord[]>;

  publishRunAtomically(
    pointer: PublishedAnalysisPointer,
  ): Promise<void>;
}

export interface ProjectionArtifactStore {
  putImmutable(
    runId: string,
    projectionKey: AnalysisProjectionKey,
    payload: Uint8Array,
  ): Promise<ProjectionArtifactPointer>;

  get(
    pointer: ProjectionArtifactPointer,
  ): Promise<Uint8Array | null>;
}

export interface ProjectionCheckpointStore {
  put(
    checkpoint: DurableCheckpoint,
  ): Promise<void>;

  get(
    runId: string,
    projectionKey: AnalysisProjectionKey,
  ): Promise<DurableCheckpoint | null>;

  delete(
    runId: string,
    projectionKey: AnalysisProjectionKey,
  ): Promise<void>;
}

export interface AnalysisJobQueue {
  enqueueUnique(job: ProjectionJob): Promise<boolean>;

  acquire(
    ownerId: string,
    now: string,
    leaseMs: number,
  ): Promise<{
    job: ProjectionJob;
    lease: WorkerLease;
  } | null>;

  renew(
    lease: WorkerLease,
    now: string,
    leaseMs: number,
  ): Promise<WorkerLease>;

  complete(
    lease: WorkerLease,
  ): Promise<void>;

  retry(
    lease: WorkerLease,
    job: ProjectionJob,
  ): Promise<void>;

  size(): Promise<number>;
}
