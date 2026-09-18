import type {
  AnalysisProjectionKey,
  ProjectionReadState,
} from "../../analysis-runtime/src";

export type DomainManagementState =
  | "pending"
  | "partial"
  | "ready"
  | "failed";

export type CompletionBasis =
  | "contractual"
  | "programme"
  | "cpm"
  | "recovery"
  | "forecast"
  | "actual"
  | "eot";

export interface CompletionDateRecord {
  basis: CompletionBasis;
  date: string | null;
  state:
    | "missing"
    | "provisional"
    | "official";
  sourceRefs: string[];
  evidenceRevisionIds: string[];
}

export interface DomainSummary {
  key: AnalysisProjectionKey;
  state: DomainManagementState;
  producerVersion: string;
  dependencyReceiptId: string | null;
  asOf: string | null;
}

export interface CanonicalManagementSummary {
  summaryId: string;
  projectId: string;
  analysisRunId: string;
  evidenceRevisionId: string;
  generatedAt: string;
  overallState: DomainManagementState;
  domains: DomainSummary[];
  completionDates: CompletionDateRecord[];
}

export interface ManagementDto<T> {
  projectId: string;
  analysisRunId: string;
  evidenceRevisionId: string;
  projectionKey: AnalysisProjectionKey;
  state: DomainManagementState;
  summaryId: string;
  data: T | null;
  readableEvidence: boolean;
  processingMessage: string | null;
}

export interface RawModelEnvelope {
  rawModelOutput: unknown;
  modelName: string;
}

export interface ValidatedProjectionEnvelope<T> {
  projectionKey: AnalysisProjectionKey;
  projectId: string;
  analysisRunId: string;
  evidenceRevisionId: string;
  state: ProjectionReadState;
  validatedData: T | null;
  dependencyReceiptId: string | null;
  producerVersion: string;
  readableEvidence: boolean;
}
