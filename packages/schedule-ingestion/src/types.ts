import type {
  EvidenceReceipt,
  SourceManifest,
} from "../../governance-model/src";
import type {
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  CanonicalResourceModel,
} from "../../schedule-resource-core/src";
import type {
  ScheduleRevision,
} from "../../schedule-revision-core/src";

export interface ScheduleIngestionInput {
  projectId: string;
  bytes: Uint8Array;
  verifiedMediaType: string;
  receivedAt: string;
  sourceFilename?: string | null;
  documentId?: string | null;
  revisionId?: string | null;
  revisionLabel?: string | null;
  revisionSequence?: number | null;
  effectiveAt?: string | null;
}

export interface ScheduleIngestionResult {
  ingestionId: string;
  projectId: string;
  sourceFormat: "xer";
  sourceProjectId: string | null;
  mediaType: string;
  sourceFilename: string | null;
  sourceHashSha256: string;
  sourceManifest: SourceManifest;
  evidenceReceipt: EvidenceReceipt;
  authority: "candidate_only";
  persistence: "runtime_local";
  revision: ScheduleRevision;
  schedule: CanonicalScheduleModel;
  resources: CanonicalResourceModel;
  diagnostics: string[];
}
