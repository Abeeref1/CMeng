import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  parsePdfDocument,
  type AiPageVerifier,
  type OcrPageResult,
  type OcrProvider,
} from "../packages/pdf-document-parser/src";

class FakeOcr implements OcrProvider {
  readonly name = "fake-ocr";
  calls: number[] = [];
  constructor(private readonly byPage: Record<number, OcrPageResult>) {}
  async recognize(_image: Uint8Array, pageNumber: number): Promise<OcrPageResult> {
    this.calls.push(pageNumber);
    return (
      this.byPage[pageNumber] ?? {
        text: "",
        confidence: 1,
        language: "eng",
        diagnostics: [],
      }
    );
  }
}

async function makePdf(pageTexts: Array<string | null>): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (const pageText of pageTexts) {
    const page = pdf.addPage([595, 842]);
    if (pageText) {
      page.drawText(pageText, {
        x: 50,
        y: 780,
        size: 12,
        font,
      });
    }
  }

  return Buffer.from(await pdf.save());
}

test("searchable PDF page stays native and does not call OCR", async () => {
  const pdf = await makePdf([
    "Contract Clause 14.2 payment shall be certified within 28 days.",
  ]);
  const ocr = new FakeOcr({});

  const parsed = await parsePdfDocument(pdf, { ocrProvider: ocr });

  assert.equal(parsed.totalPages, 1);
  assert.equal(parsed.nativePages, 1);
  assert.equal(parsed.ocrPages, 0);
  assert.equal(parsed.complete, true);
  assert.deepEqual(ocr.calls, []);
  assert.match(parsed.pages[0]!.text, /Contract Clause 14.2/);
});

test("mixed PDF routes only low-text page to OCR", async () => {
  const pdf = await makePdf([
    "Native BOQ cover and contract reference information.",
    null,
    "Another searchable native page with enough meaningful characters.",
  ]);
  const ocr = new FakeOcr({
    2: {
      text: "OCR recovered scanned BOQ line item 001 concrete works",
      confidence: 0.97,
      language: "eng",
      diagnostics: [],
    },
  });

  const parsed = await parsePdfDocument(pdf, { ocrProvider: ocr });

  assert.equal(parsed.totalPages, 3);
  assert.equal(parsed.nativePages, 2);
  assert.equal(parsed.ocrPages, 1);
  assert.equal(parsed.failedPages, 0);
  assert.equal(parsed.coveragePercent, 100);
  assert.equal(parsed.complete, true);
  assert.deepEqual(ocr.calls, [2]);
  assert.match(parsed.pages[1]!.text, /concrete works/);
});

test("page requiring OCR without provider fails closed", async () => {
  const pdf = await makePdf(["Native searchable page with text.", null]);

  const parsed = await parsePdfDocument(pdf);

  assert.equal(parsed.totalPages, 2);
  assert.equal(parsed.failedPages, 1);
  assert.equal(parsed.coveragePercent, 50);
  assert.equal(parsed.complete, false);
  assert.ok(
    parsed.pages[1]!.diagnostics.includes("PDF_PAGE_REQUIRES_OCR_PROVIDER"),
  );
});

test("AI review-required flag blocks complete status but cannot overwrite text", async () => {
  const pdf = await makePdf([
    "BOQ quantity 100 rate 5 amount 500 source text remains immutable.",
  ]);

  const aiVerifier: AiPageVerifier = {
    name: "fake-ai",
    async review(input) {
      return {
        status: "review_required",
        diagnostics: ["Possible numeric inconsistency"],
        proposedText: "AI proposed different text",
        confidence: 0.99,
      };
    },
  };

  const parsed = await parsePdfDocument(pdf, { aiVerifier });

  assert.equal(parsed.complete, false);
  assert.equal(parsed.unresolvedPages, 1);
  assert.match(parsed.pages[0]!.text, /quantity 100 rate 5 amount 500/);
  assert.equal(
    parsed.pages[0]!.aiReview!.proposedText,
    "AI proposed different text",
  );
  assert.notEqual(
    parsed.pages[0]!.text,
    parsed.pages[0]!.aiReview!.proposedText,
  );
});

test("resumable PDF checkpoint requires and reuses persisted page result", async () => {
  const pdf = await makePdf([
    "First page native text with sufficient content for checkpoint.",
    "Second page native text with sufficient content for parsing.",
  ]);

  const first = await parsePdfDocument(pdf);
  const persistedFirstPage = first.pages[0]!;

  const resumed = await parsePdfDocument(pdf, {
    checkpoint: {
      completedPages: [1],
      persistedPages: [persistedFirstPage],
    },
  });

  assert.equal(resumed.complete, true);
  assert.equal(resumed.pages[0]!.text, persistedFirstPage.text);
  assert.equal(resumed.pages[1]!.method, "native");

  const invalidResume = await parsePdfDocument(pdf, {
    checkpoint: {
      completedPages: [1],
      persistedPages: [],
    },
  });

  assert.equal(invalidResume.complete, false);
  assert.ok(
    invalidResume.pages[0]!.diagnostics.includes(
      "PDF_CHECKPOINT_RESULT_MISSING",
    ),
  );
});
