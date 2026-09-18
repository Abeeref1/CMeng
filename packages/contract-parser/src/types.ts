import type {
  AiPageVerifier,
  OcrProvider,
  PdfDocumentResult,
} from "../../pdf-document-parser/src";

export type ContractSectionKind =
  | "preamble"
  | "clause"
  | "appendix"
  | "annex"
  | "schedule";

export interface ContractSourceSpan {
  page: number;
  start: number;
  end: number;
  text: string;
}

export interface ContractSection {
  sectionKey: string;
  kind: ContractSectionKind;
  identifier: string | null;
  heading: string | null;
  text: string;
  startPage: number;
  endPage: number;
  sourceSpans: ContractSourceSpan[];
  status: "verified" | "unresolved";
  diagnostics: string[];
}

export interface ContractUnclassifiedLine {
  page: number;
  start: number;
  end: number;
  text: string;
  reason: string;
}

export interface ContractParseOptions {
  ocrProvider?: OcrProvider;
  aiPageVerifier?: AiPageVerifier;
}

export interface ContractDocumentResult {
  pdf: PdfDocumentResult;
  sections: ContractSection[];
  clauses: ContractSection[];
  appendices: ContractSection[];
  duplicateIdentifiers: string[];
  unclassifiedLines: ContractUnclassifiedLine[];
  semanticCoveragePercent: number | null;
  physicalComplete: boolean;
  semanticComplete: boolean;
  complete: boolean;
  diagnostics: string[];
}
