export type AnalysisProjectionKey =
  | "pmo_analysis"
  | "schedule_analytics"
  | "activity_analytics"
  | "resource_utilization"
  | "lookahead_schedule"
  | "progress_report"
  | "schedule_change_report"
  | "revision_trend"
  | "variance_trends"
  | "progress_scurve"
  | "quantity_scurve"
  | "progress_breakdown"
  | "milestones"
  | "near_critical"
  | "manhour_scurve"
  | "forecast_history"
  | "independent_forecast"
  | "delay_claims"
  | "notices_claims"
  | "windows_analysis"
  | "eot_assessment"
  | "challenge_contract";

export type AnalysisRunState =
  | "queued"
  | "preparing"
  | "materialized"
  | "publish_pending"
  | "published"
  | "retryable"
  | "failed";

export type ProjectionState =
  | "queued"
  | "preparing"
  | "ready"
  | "retryable"
  | "failed";

export type ValueOrigin =
  | "source"
  | "deterministic_derived"
  | "model_derived"
  | "scenario_assumption";

export interface AnalysisInputSnapshot {
  projectId: string;
  evidenceRevisionId: string;
  evidenceFingerprint: string;
  mappingVersion: string;
  parserVersion: string;
  analysisEngineVersion: string;
  analysisPlanVersion: string;
  projectConfigFingerprint: string;
  createdAt: string;
}

export interface AnalysisRunIdentity {
  runId: string;
  inputFingerprint: string;
  projectId: string;
  evidenceRevisionId: string;
}

export interface AnalysisRunRecord extends AnalysisRunIdentity {
  state: AnalysisRunState;
  createdAt: string;
  updatedAt: string;
  projectionKeys: AnalysisProjectionKey[];
  readyProjectionCount: number;
  failedProjectionCount: number;
  publishedAt: string | null;
}

export interface ProjectionArtifactPointer {
  artifactId: string;
  contentHash: string;
  byteLength: number;
}

export interface ProjectionRecord {
  runId: string;
  projectId: string;
  evidenceRevisionId: string;
  projectionKey: AnalysisProjectionKey;
  state: ProjectionState;
  attempt: number;
  checkpointCursor: string | null;
  artifact: ProjectionArtifactPointer | null;
  createdAt: string;
  updatedAt: string;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface PublishedAnalysisPointer {
  projectId: string;
  runId: string;
  evidenceRevisionId: string;
  inputFingerprint: string;
  publishedAt: string;
}

export interface ProjectAnalysisHead {
  projectId: string;
  desiredRunId: string | null;
  publishedRunId: string | null;
}

export interface ProjectionJob {
  jobId: string;
  runId: string;
  projectId: string;
  evidenceRevisionId: string;
  projectionKey: AnalysisProjectionKey;
  phase: "compute" | "publish";
  chunkCursor: string | null;
  pendingArtifact: ProjectionArtifactPointer | null;
  notBefore: string | null;
  attempt: number;
}

export interface ProjectionChunkResult {
  done: boolean;
  nextCursor: string | null;
  checkpointPayload: Uint8Array;
  finalArtifact?: Uint8Array;
}

export interface DurableCheckpoint {
  runId: string;
  projectionKey: AnalysisProjectionKey;
  cursor: string | null;
  payloadHash: string;
  payload: Uint8Array;
  savedAt: string;
}

export interface ProjectionDefinition {
  key: AnalysisProjectionKey;
  dependencies: AnalysisProjectionKey[];
  requiredForPublish: boolean;
}

export interface ComputedValue<T> {
  value: T;
  origin: ValueOrigin;
  formula: string | null;
  sourceRefs: string[];
  confidence: number | null;
  assumptions: string[];
}

export type ProjectionReadState =
  | "ready"
  | "preparing"
  | "updating"
  | "retrying";

export interface ProjectionReadModel {
  state: ProjectionReadState;
  projectId: string;
  projectionKey: AnalysisProjectionKey;
  desiredRunId: string | null;
  publishedRunId: string | null;
  desiredEvidenceRevisionId: string | null;
  publishedEvidenceRevisionId: string | null;
  artifact: ProjectionArtifactPointer | null;
  isCurrentRevision: boolean;
}

export interface WorkerLease {
  leaseId: string;
  jobId: string;
  ownerId: string;
  acquiredAt: string;
  expiresAt: string;
}

export class MetadataUnavailableError extends Error {
  readonly code = "METADATA_UNAVAILABLE";
  constructor(message = "Analysis metadata store is unavailable") {
    super(message);
    this.name = "MetadataUnavailableError";
  }
}
