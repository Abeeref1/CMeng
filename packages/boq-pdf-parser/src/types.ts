import type { OcrProvider, AiPageVerifier } from "../../pdf-document-parser/src";

export interface BoqPdfCellLocator {
  page: number;
  table: number;
  row: number;
  column: number;
}

export interface BoqPdfLineItem {
  page: number;
  table: number;
  row: number;
  rowKind: "line_item" | "section" | "total_or_summary" | "unclassified";
  itemNumber: string | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  currency: string | null;
  sourceCells: Record<string, BoqPdfCellLocator>;
  status: "verified" | "unresolved";
  diagnostics: string[];
}

export interface AiBoqTableExtraction {
  rows: string[][];
  confidence: number | null;
  diagnostics: string[];
}

export interface AiBoqTableExtractor {
  readonly name: string;
  extract(input: {
    pageNumber: number;
    ocrText: string;
  }): Promise<AiBoqTableExtraction>;
}

export interface BoqPdfOptions {
  ocrProvider?: OcrProvider;
  aiPageVerifier?: AiPageVerifier;
  aiTableExtractor?: AiBoqTableExtractor;
}

export interface BoqPdfResult {
  totalPages: number;
  nativeTablePages: number;
  ocrTablePages: number;
  items: BoqPdfLineItem[];
  candidateRows: number;
  verifiedRows: number;
  unresolvedRows: number;
  unresolvedPages: number[];
  coveragePercent: number | null;
  complete: boolean;
  diagnostics: string[];
}
