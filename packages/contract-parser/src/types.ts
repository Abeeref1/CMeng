import type {
  AiPageVerifier,
  OcrProvider,
  PdfDocumentResult,
} from "../../pdf-document-parser/src";

export type ContractSourceType = "pdf" | "docx";

export type ContractSectionKind =
  | "preamble"
  | "clause"
  | "appendix"
  | "annex"
  | "schedule";

export type ContractSourceSpanKind =
  | "pdf_page"
  | "docx_paragraph"
  | "docx_table_cell";

export interface ContractTextBlock {
  sourceKind: ContractSourceSpanKind;
  sourceIndex: number;
  page: number | null;
  block: number | null;
  text: string;
}

export interface ContractSourceSpan {
  sourceKind: ContractSourceSpanKind;
  sourceIndex: number;
  page: number | null;
  block: number | null;
  start: number;
  end: number;
  text: string;
}

export interface ContractSection {
  sectionKey: string;
  kind: ContractSectionKind;
  identifier: string | null;
  contextKey: string;
  parentIdentifier: string | null;
  instanceOrdinal: number;
  heading: string | null;
  text: string;
  startPage: number | null;
  endPage: number | null;
  startBlock: number | null;
  endBlock: number | null;
  sourceSpans: ContractSourceSpan[];
  sourceMode: "deterministic" | "ai_grounded";
  status: "verified" | "unresolved";
  diagnostics: string[];
}

export interface ContractUnclassifiedLine {
  sourceSpan: ContractSourceSpan;
  reason: string;
}

export interface ContractIgnoredSpan {
  sourceSpan: ContractSourceSpan;
  reason:
    | "running_header"
    | "running_footer"
    | "page_number"
    | "watermark";
}

export interface ContractReference {
  fromSectionKey: string;
  targetIdentifier: string;
  resolvedSectionKeys: string[];
  status: "resolved" | "ambiguous" | "external" | "unresolved";
  sourceSpan: ContractSourceSpan;
}

export interface ContractAmendmentAction {
  fromSectionKey: string;
  targetIdentifier: string;
  action:
    | "amend"
    | "replace"
    | "delete"
    | "supplement"
    | "confirm"
    | "unknown";
  resolvedSectionKeys: string[];
  status: "resolved" | "external" | "ambiguous";
  sourceSpan: ContractSourceSpan;
}

export interface ContractAiHeadingProposal {
  kind: Exclude<ContractSectionKind, "preamble">;
  identifier: string;
  contextIdentifier: string | null;
  heading: string | null;
  confidence: number;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
  explanation: string;
}

export interface ContractAiHeadingInput {
  sourceSpan: ContractSourceSpan;
  previousSection: {
    kind: ContractSectionKind;
    identifier: string | null;
    contextKey: string;
    heading: string | null;
  } | null;
  nextText: string | null;
}

export interface ContractAiResolver {
  readonly name: string;
  resolveHeading(
    input: ContractAiHeadingInput,
  ): Promise<ContractAiHeadingProposal | null>;
}

export interface ContractDocxBlock {
  blockNumber: number;
  kind: "paragraph" | "table_cell";
  tableNumber: number | null;
  rowNumber: number | null;
  columnNumber: number | null;
  style: string | null;
  text: string;
}

export interface ContractDocxSource {
  blocks: ContractDocxBlock[];
  totalBlocks: number;
  paragraphBlocks: number;
  tableCellBlocks: number;
  complete: boolean;
  diagnostics: string[];
}

export interface ContractParseOptions {
  ocrProvider?: OcrProvider;
  aiPageVerifier?: AiPageVerifier;
  aiResolver?: ContractAiResolver;
}

export interface ContractDocumentResult {
  sourceType: ContractSourceType;
  pdf: PdfDocumentResult | null;
  docx: ContractDocxSource | null;
  sections: ContractSection[];
  clauses: ContractSection[];
  appendices: ContractSection[];
  duplicateIdentifiers: string[];
  repeatedRawIdentifiers: string[];
  references: ContractReference[];
  amendmentActions: ContractAmendmentAction[];
  ignoredSpans: ContractIgnoredSpan[];
  unclassifiedLines: ContractUnclassifiedLine[];
  semanticCoveragePercent: number | null;
  physicalComplete: boolean;
  semanticComplete: boolean;
  complete: boolean;
  diagnostics: string[];
}
