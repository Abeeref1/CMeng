export type PdfPageMethod = "native" | "ocr" | "blank" | "failed";

export interface OcrPageResult {
  text: string;
  confidence: number | null;
  language: string | null;
  diagnostics: string[];
}

export interface OcrProvider {
  readonly name: string;
  recognize(image: Uint8Array, pageNumber: number): Promise<OcrPageResult>;
  close?(): Promise<void>;
}

export interface AiPageReview {
  status: "accepted" | "review_required";
  diagnostics: string[];
  proposedText: string | null;
  confidence: number | null;
}

export interface AiPageVerifier {
  readonly name: string;
  review(input: {
    pageNumber: number;
    method: "native" | "ocr";
    extractedText: string;
    ocrConfidence: number | null;
  }): Promise<AiPageReview>;
}

export interface PdfPageResult {
  pageNumber: number;
  method: PdfPageMethod;
  text: string;
  nativeCharacterCount: number;
  ocrConfidence: number | null;
  aiReview: AiPageReview | null;
  diagnostics: string[];
}

export interface PdfParseCheckpoint {
  completedPages: number[];
  persistedPages: PdfPageResult[];
}

export interface PdfDocumentResult {
  totalPages: number;
  processedPages: number;
  nativePages: number;
  ocrPages: number;
  blankPages: number;
  failedPages: number;
  unresolvedPages: number;
  coveragePercent: number;
  complete: boolean;
  pages: PdfPageResult[];
  diagnostics: string[];
}
