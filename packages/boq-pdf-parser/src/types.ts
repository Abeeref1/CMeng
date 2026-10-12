import type { OcrProvider, AiPageVerifier, PdfDocumentResult } from "../../pdf-document-parser/src";
import type {RasterCellEvidence} from './raster-table';

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
  section: string | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  currency: string | null;
  sourceCells: Record<string, BoqPdfCellLocator>;
  status: "verified" | "unresolved";
  diagnostics: string[];
  rasterEvidence?: {rotation:number;imageWidth:number;imageHeight:number;cells:Record<string,RasterCellEvidence[]>};
}

export interface AiBoqCellEvidence {
  value: string;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
}

export interface AiBoqTableExtraction {
  rows: AiBoqCellEvidence[][];
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
  onProgress?: (pageNumber:number,totalPages:number,phase:'page_read'|'table_read')=>void;
  aiPageVerifier?: AiPageVerifier;
  aiTableExtractor?: AiBoqTableExtractor;
}

export interface BoqPdfResult {
  pageRead?: PdfDocumentResult;
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
