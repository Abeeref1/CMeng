import type {
  AnalysisProjectionKey,
  ProjectionArtifactPointer,
} from "../../analysis-runtime/src";

export interface DependencyReceipt {
  dependencyReceiptId: string;
  projectId: string;
  analysisRunId: string;
  evidenceRevisionId: string;
  projectionKey: AnalysisProjectionKey;
  evidenceFingerprint: string;
  sourceManifestId: string;
  upstreamProjectionHashes: Record<string, string>;
  producerVersion: string;
  parserVersion: string;
  mappingVersion: string;
  createdAt: string;
}

export interface GovernedPublication {
  projectId: string;
  analysisRunId: string;
  evidenceRevisionId: string;
  projectionKey: AnalysisProjectionKey;
  artifact: ProjectionArtifactPointer;
  dependencyReceipt: DependencyReceipt;
  publishedAt: string;
}

export interface PublicationValidation {
  valid: boolean;
  reasons: string[];
}
