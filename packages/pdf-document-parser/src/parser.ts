import type {
  AiPageVerifier,
  OcrProvider,
  PdfDocumentResult,
  PdfPageResult,
  PdfParseCheckpoint,
} from "./types";
import {fragmentedPdfText} from './text-quality';

export interface PdfDocumentParserOptions {
  nativeTextCharacterThreshold?: number;
  screenshotScale?: number;
  ocrProvider?: OcrProvider;
  aiVerifier?: AiPageVerifier;
  checkpoint?: PdfParseCheckpoint;
  onPageRead?:(page:PdfPageResult,totalPages:number)=>void;
}

function meaningfulCharacterCount(text: string): number {
  return [...text].filter((char) => /[\p{L}\p{N}]/u.test(char)).length;
}

function percent(processed: number, total: number): number {
  if (total === 0) return 0;
  return Number(((processed / total) * 100).toFixed(4));
}

export async function parsePdfDocument(
  bytes: Uint8Array,
  options: PdfDocumentParserOptions = {},
): Promise<PdfDocumentResult> {
  const threshold = options.nativeTextCharacterThreshold ?? 12;
  const screenshotScale = options.screenshotScale ?? 2;
  const parser = new (await import('pdf-parse')).PDFParse({ data: Buffer.from(bytes) as any });
  const pages: PdfPageResult[] = [];
  const diagnostics: string[] = [];
  const reviewPage=async(input:Parameters<AiPageVerifier['review']>[0])=>{
    if(!options.aiVerifier)return null;
    try{return await options.aiVerifier.review(input);}
    catch(error){
      const code=error instanceof Error&&/^MODEL_[A-Z_]+$/.test(error.message)?error.message:'PDF_AI_REVIEW_FAILED';
      // Verification availability cannot erase physically extracted source text
      // or prevent later pages from being read. Never treat a failed review as acceptance.
      return {status:'review_required' as const,diagnostics:[code],proposedText:null,confidence:null};
    }
  };

  try {
    const textResult = await parser.getText();
    const totalPages = textResult.total;
    const append=(page:PdfPageResult)=>{pages.push(page);options.onPageRead?.(page,totalPages);};
    const completed = new Set(options.checkpoint?.completedPages ?? []);
    const persistedByPage = new Map<number, PdfPageResult>();
    const repeatedPages = new Set<number>();
    for (const page of options.checkpoint?.persistedPages ?? []) {
      if (persistedByPage.has(page.pageNumber)) repeatedPages.add(page.pageNumber);
      else persistedByPage.set(page.pageNumber, page);
    }
    const nativeByPage = new Map(textResult.pages.map(page => [page.num, page.text]));

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (completed.has(pageNumber)) {
        const persisted = persistedByPage.get(pageNumber);
        if (!persisted) {
          append({
            pageNumber,
            method: "failed",
            text: "",
            nativeCharacterCount: 0,
            ocrConfidence: null,
            aiReview: null,
            diagnostics: [
              "PDF_CHECKPOINT_RESULT_MISSING",
            ],
          });
          continue;
        }
        const validReading = !repeatedPages.has(pageNumber) &&
          persisted.pageNumber === pageNumber &&
          (persisted.method === 'native' || persisted.method === 'ocr' || persisted.method === 'blank') &&
          typeof persisted.text === 'string' &&
          (persisted.method === 'blank' || persisted.text.trim().length > 0) &&
          !(persisted.method !== 'blank' && fragmentedPdfText(persisted.text));
        // Preserve an outstanding AI challenge when no verifier is available.
        // With a verifier, re-read from original bytes before clearing it.
        if (validReading && !(persisted.aiReview?.status === 'review_required' && options.aiVerifier)) {
          append(persisted);
          continue;
        }
      }

      const nativeText = nativeByPage.get(pageNumber) ?? "";
      const nativeCharacterCount = meaningfulCharacterCount(nativeText);
      const fragmented = fragmentedPdfText(nativeText);
      const qualityDiagnostics = fragmented ? ['PDF_NATIVE_TEXT_FRAGMENTED_REQUIRES_OCR'] : [];

      if (nativeCharacterCount >= threshold && !fragmented) {
        const aiReview = await reviewPage({
              pageNumber,
              method: "native",
              extractedText: nativeText,
              ocrConfidence: null,
            });

        append({
          pageNumber,
          method: "native",
          text: nativeText,
          nativeCharacterCount,
          ocrConfidence: null,
          aiReview,
          diagnostics:
            aiReview?.status === "review_required"
              ? ["PDF_AI_REVIEW_REQUIRED"]
              : [],
        });
        continue;
      }

      if (!options.ocrProvider) {
        append({
          pageNumber,
          method: "failed",
          text: nativeText,
          nativeCharacterCount,
          ocrConfidence: null,
          aiReview: null,
          diagnostics: [...qualityDiagnostics, "PDF_PAGE_REQUIRES_OCR_PROVIDER"],
        });
        continue;
      }

      try {
        const screenshot: any = await parser.getScreenshot({
          partial: [pageNumber],
          scale: screenshotScale,
          imageBuffer: true,
          imageDataUrl: false,
        });

        const image = screenshot.pages?.[0]?.data;
        if (!image) {
          append({
            pageNumber,
            method: "failed",
            text: "",
            nativeCharacterCount,
            ocrConfidence: null,
            aiReview: null,
            diagnostics: ["PDF_PAGE_SCREENSHOT_MISSING"],
          });
          continue;
        }

        const ocr = await options.ocrProvider.recognize(
          image instanceof Uint8Array ? image : Buffer.from(image),
          pageNumber,
        );
        const ocrText = ocr.text ?? "";
        const ocrCharacters = meaningfulCharacterCount(ocrText);

        if (ocrCharacters === 0 && !fragmented) {
          append({
            pageNumber,
            method: "blank",
            text: "",
            nativeCharacterCount,
            ocrConfidence: ocr.confidence,
            aiReview: null,
            diagnostics: [...ocr.diagnostics],
          });
          continue;
        }

        if (ocrCharacters === 0 || fragmentedPdfText(ocrText)) {
          append({pageNumber, method:'failed', text:ocrText || nativeText,
            nativeCharacterCount, ocrConfidence:ocr.confidence, aiReview:null,
            diagnostics:[...qualityDiagnostics,...ocr.diagnostics,'PDF_OCR_TEXT_UNREADABLE']});
          continue;
        }

        const aiReview = await reviewPage({
              pageNumber,
              method: "ocr",
              extractedText: ocrText,
              ocrConfidence: ocr.confidence,
            });

        append({
          pageNumber,
          method: "ocr",
          text: ocrText,
          nativeCharacterCount,
          ocrConfidence: ocr.confidence,
          aiReview,
          diagnostics: [
            ...qualityDiagnostics,
            ...ocr.diagnostics,
            ...(aiReview?.status === "review_required"
              ? ["PDF_AI_REVIEW_REQUIRED"]
              : []),
          ],
        });
      } catch (error) {
        append({
          pageNumber,
          method: "failed",
          text: "",
          nativeCharacterCount,
          ocrConfidence: null,
          aiReview: null,
          diagnostics: [
            ...qualityDiagnostics,
            "PDF_OCR_FAILURE:" +
              (error instanceof Error ? error.message : String(error)),
          ],
        });
      }
    }

    const nativePages = pages.filter((page) => page.method === "native").length;
    const ocrPages = pages.filter((page) => page.method === "ocr").length;
    const blankPages = pages.filter((page) => page.method === "blank").length;
    const failedPages = pages.filter((page) => page.method === "failed").length;
    const unresolvedPages = pages.filter(
      (page) =>
        page.method === "failed" ||
        page.aiReview?.status === "review_required",
    ).length;
    const processedPages = pages.filter(
      (page) => page.method !== "failed",
    ).length;

    return {
      totalPages,
      processedPages,
      nativePages,
      ocrPages,
      blankPages,
      failedPages,
      unresolvedPages,
      coveragePercent: percent(processedPages, totalPages),
      complete:
        pages.length === totalPages &&
        failedPages === 0 &&
        unresolvedPages === 0,
      pages,
      diagnostics,
    };
  } finally {
    await parser.destroy();
    if (options.ocrProvider?.close) {
      await options.ocrProvider.close();
    }
  }
}
