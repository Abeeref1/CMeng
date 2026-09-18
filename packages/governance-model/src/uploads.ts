import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  EvidenceReceipt,
  FactCandidate,
  SourceManifest,
  SourceManifestEntry,
} from "./types";

export function documentIdentityKey(input: {
  documentId: string;
  revisionId: string;
  objectId: string;
  sha256: string;
  sourceFilename?: string;
}): string {
  return stableFingerprint({
    documentId: input.documentId,
    revisionId: input.revisionId,
    objectId: input.objectId,
    sha256: input.sha256,
  });
}

export interface UploadEvidenceInput {
  projectId: string;
  documentId: string;
  revisionId: string;
  objectId: string;
  sha256: string;
  role: string;
  receivedAt: string;
}

export function createSourceManifest(
  projectId: string,
  entries: SourceManifestEntry[],
  createdAt: string,
): SourceManifest {
  const sorted = [...entries].sort((a, b) =>
    [
      a.documentId,
      a.revisionId,
      a.objectId,
      a.sha256,
    ]
      .join("|")
      .localeCompare(
        [
          b.documentId,
          b.revisionId,
          b.objectId,
          b.sha256,
        ].join("|"),
      ),
  );

  return {
    manifestId:
      "manifest_" +
      stableFingerprint({
        projectId,
        entries: sorted,
      }).slice(0, 24),
    projectId,
    entries: sorted.map((entry) => ({ ...entry })),
    createdAt,
  };
}

export function evidenceReceiptFromUpload(
  input: UploadEvidenceInput,
  manifest: SourceManifest,
): EvidenceReceipt {
  if (
    manifest.projectId !== input.projectId ||
    !manifest.entries.some(
      (entry) =>
        entry.documentId === input.documentId &&
        entry.revisionId === input.revisionId &&
        entry.objectId === input.objectId &&
        entry.sha256 === input.sha256,
    )
  ) {
    throw new Error(
      "Upload is not present in the source manifest",
    );
  }

  return {
    receiptId:
      "receipt_" +
      stableFingerprint({
        projectId: input.projectId,
        documentId: input.documentId,
        revisionId: input.revisionId,
        objectId: input.objectId,
        sha256: input.sha256,
      }).slice(0, 24),
    projectId: input.projectId,
    documentId: input.documentId,
    revisionId: input.revisionId,
    objectId: input.objectId,
    sourceHash: input.sha256,
    sourceManifestId: manifest.manifestId,
    receivedAt: input.receivedAt,
  };
}

export function candidateFromUpload<T>(input: {
  projectId: string;
  factKey: string;
  value: T;
  receipt: EvidenceReceipt;
  sourceRefs: string[];
  confidence: number | null;
  createdAt: string;
}): FactCandidate<T> {
  return {
    candidateId:
      "candidate_" +
      stableFingerprint({
        projectId: input.projectId,
        factKey: input.factKey,
        value: input.value,
        receiptId: input.receipt.receiptId,
      }).slice(0, 24),
    projectId: input.projectId,
    factKey: input.factKey,
    value: input.value,
    origin: "document_extraction",
    evidenceReceiptIds: [
      input.receipt.receiptId,
    ],
    sourceRefs: [...input.sourceRefs],
    confidence: input.confidence,
    createdAt: input.createdAt,
  };
}
