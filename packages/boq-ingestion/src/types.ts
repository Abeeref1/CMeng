import type {
  EvidenceReceipt,
  SourceManifest,
} from "../../governance-model/src";

export type BoqSourceFormat = "excel_ooxml" | "pdf" | "csv";

export type BoqIngestionState =
  | "verified_candidate"
  | "partial_candidate"
  | "unavailable";

export interface CanonicalBoqCommercialItem {
  itemId: string;
  itemNumber: string | null;
  section: string | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  currency: string | null;
  sourceFormat: BoqSourceFormat;
  sourceRefs: string[];
  status: "verified" | "unresolved";
  diagnostics: string[];
}

export interface BoqIngestionResult {
  ingestionId: string;
  projectId: string;
  sourceFormat: BoqSourceFormat;
  mediaType: string;
  sourceFilename: string | null;
  sourceHashSha256: string;
  sourceManifest: SourceManifest;
  evidenceReceipt: EvidenceReceipt;
  authority: "candidate_only";
  persistence:
    | "runtime_local"
    | "railway_volume";
  state: BoqIngestionState;
  candidateRows: number;
  verifiedRows: number;
  unresolvedRows: number;
  coveragePercent: number | null;
  complete: boolean;
  canonicalItems: CanonicalBoqCommercialItem[];
  diagnostics: string[];
  receivedAt: string;
}

export interface BoqIngestionInput {
  projectId: string;
  bytes: Uint8Array;
  verifiedMediaType: string;
  receivedAt: string;
  sourceFilename?: string | null;
  documentId?: string | null;
  revisionId?: string | null;
  objectId?: string | null;
}
