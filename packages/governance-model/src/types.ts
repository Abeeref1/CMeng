export type FactState =
  | "missing"
  | "pending"
  | "partial"
  | "conflicted"
  | "provisional"
  | "official";

export type CandidateOrigin =
  | "document_extraction"
  | "deterministic_derivation"
  | "ai_proposal"
  | "manual_entry";

export interface EvidenceReceipt {
  receiptId: string;
  projectId: string;
  documentId: string;
  revisionId: string;
  objectId: string;
  sourceHash: string;
  sourceManifestId: string;
  receivedAt: string;
}

export interface SourceManifestEntry {
  documentId: string;
  revisionId: string;
  objectId: string;
  sha256: string;
  role: string;
}

export interface SourceManifest {
  manifestId: string;
  projectId: string;
  entries: SourceManifestEntry[];
  createdAt: string;
}

export interface FactCandidate<T> {
  candidateId: string;
  projectId: string;
  factKey: string;
  value: T;
  origin: CandidateOrigin;
  evidenceReceiptIds: string[];
  sourceRefs: string[];
  confidence: number | null;
  createdAt: string;
}

export interface AuthorityReceipt {
  authorityReceiptId: string;
  authorityType:
    | "governing_document"
    | "approved_record"
    | "authorized_user"
    | "system_rule";
  authorityRef: string;
  promotedBy: string;
  promotedAt: string;
}

export interface GovernedFact<T> {
  projectId: string;
  factKey: string;
  state: FactState;
  value: T | null;
  officialCandidateId: string | null;
  candidateIds: string[];
  authorityReceipt: AuthorityReceipt | null;
  updatedAt: string;
}

export interface PromotionResult<T> {
  fact: GovernedFact<T>;
  promoted: boolean;
  reason: string | null;
}
