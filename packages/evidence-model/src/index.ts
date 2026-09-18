export const REQUIRED_DOCUMENT_ROLES = [
  "contract",
  "boq",
  "approved_baseline",
] as const;

export type RequiredDocumentRole = (typeof REQUIRED_DOCUMENT_ROLES)[number];

export type EvidenceMediaKind =
  | "pdf"
  | "docx"
  | "xlsx"
  | "xls"
  | "csv"
  | "xer"
  | "xml"
  | "image"
  | "tiff"
  | "unknown";

export type SecurityState =
  | "pending_scan"
  | "accepted"
  | "quarantined"
  | "rejected";

export type ProcessingState =
  | "uploaded"
  | "inventoring"
  | "reading"
  | "partial"
  | "complete"
  | "failed";

export interface EvidenceObject {
  objectId: string;
  sha256: string;
  byteSize: number;
  verifiedMediaType: string;
  mediaKind: EvidenceMediaKind;
  createdAt: string;
}

export interface EvidenceDocument {
  documentId: string;
  projectId: string;
  role: RequiredDocumentRole;
  logicalName: string;
  currentRevisionId: string | null;
  createdAt: string;
}

export interface EvidenceRevision {
  revisionId: string;
  documentId: string;
  objectId: string;
  sourceFilename: string;
  revisionNumber: number;
  securityState: SecurityState;
  processingState: ProcessingState;
  supersedesRevisionId: string | null;
  createdAt: string;
}

export interface UploadRegistration {
  projectId: string;
  role: RequiredDocumentRole;
  sourceFilename: string;
  sha256: string;
  byteSize: number;
  verifiedMediaType: string;
  mediaKind: EvidenceMediaKind;
}

export interface DuplicateAssessment {
  sameBytesExistingObjectId: string | null;
  sameLogicalDocumentRevisionId: string | null;
  action: "new_object" | "reuse_object_new_revision" | "exact_duplicate";
}

export type SourceLocator =
  | {
      kind: "pdf";
      page: number;
      blockId?: string;
      bbox?: readonly [number, number, number, number];
    }
  | {
      kind: "xlsx";
      sheet: string;
      cell?: string;
      range?: string;
    }
  | {
      kind: "csv";
      row: number;
      column?: string;
    }
  | {
      kind: "xer";
      table: string;
      row: number;
      nativeId?: string;
    }
  | {
      kind: "xml";
      xpath: string;
      nativeId?: string;
    }
  | {
      kind: "docx";
      paragraph?: number;
      table?: number;
      row?: number;
      column?: number;
    }
  | {
      kind: "image";
      frame: number;
      bbox?: readonly [number, number, number, number];
    };

export interface SourceBackedValue<T> {
  value: T;
  locator: SourceLocator;
  sourceRevisionId: string;
  extractionMethod: "native" | "ocr" | "derived" | "ai_reconciled";
  confidence: number | null;
}

export function assertSha256(value: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("sha256 must be a 64-character hexadecimal digest");
  }
}

export function validateUploadRegistration(input: UploadRegistration): void {
  if (!input.projectId.trim()) throw new Error("projectId is required");
  if (!input.sourceFilename.trim()) throw new Error("sourceFilename is required");
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0) {
    throw new Error("byteSize must be a positive safe integer");
  }
  assertSha256(input.sha256);
  if (!input.verifiedMediaType.trim()) {
    throw new Error("verifiedMediaType is required");
  }
}
