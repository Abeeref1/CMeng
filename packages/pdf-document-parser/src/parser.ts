import { PDFParse } from "pdf-parse";
import type {
  AiPageVerifier,
  OcrProvider,
  PdfDocumentResult,
  PdfPageResult,
  PdfParseCheckpoint,
} from "./types";

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
  const parser = new PDFParse({ data: Buffer.from(bytes) as any });
  const pages: PdfPageResult[] = [];
  const diagnostics: string[] = [];

  try {
    const textResult = await parser.getText();
    const totalPages = textResult.total;
    const append=(page:PdfPageResult)=>{pages.push(page);options.onPageRead?.(page,totalPages);};
    const completed = new Set(options.checkpoint?.completedPages ?? []);
    const persistedByPage = new Map(
      (options.checkpoint?.persistedPages ?? []).map((page) => [
        page.pageNumber,
        page,
      ]),
    );

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
        } else {
          append(persisted);
        }
        continue;
      }

      const nativePage = textResult.pages.find(
        (page) => page.num === pageNumber,
      );
      const nativeText = nativePage?.text ?? "";
      const nativeCharacterCount = meaningfulCharacterCount(nativeText);

      if (nativeCharacterCount >= threshold) {
        const aiReview = options.aiVerifier
          ? await options.aiVerifier.review({
              pageNumber,
              method: "native",
              extractedText: nativeText,
              ocrConfidence: null,
            })
          : null;

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
          diagnostics: ["PDF_PAGE_REQUIRES_OCR_PROVIDER"],
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

        if (ocrCharacters === 0) {
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

        const aiReview = options.aiVerifier
          ? await options.aiVerifier.review({
              pageNumber,
              method: "ocr",
              extractedText: ocrText,
              ocrConfidence: ocr.confidence,
            })
          : null;

        append({
          pageNumber,
          method: "ocr",
          text: ocrText,
          nativeCharacterCount,
          ocrConfidence: ocr.confidence,
          aiReview,
          diagnostics: [
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
