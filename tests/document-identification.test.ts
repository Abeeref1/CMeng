import test from "node:test";
import assert from "node:assert/strict";
import {
  PDFDocument,
} from "pdf-lib";

import type {
  OcrPageResult,
  OcrProvider,
} from "../packages/pdf-document-parser/src";
import {
  identifyEvidenceDocument,
  documentClassificationForReview,
} from "../packages/runtime-api/src/document-identification";

class FakeOcrProvider
  implements OcrProvider {
  readonly name =
    "fake-ocr";
  closed = false;

  constructor(
    private readonly text:
      string,
    private readonly confidence:
      number | null = 0.96,
  ) {}

  async recognize(
    _image: Uint8Array,
    _pageNumber: number,
  ): Promise<OcrPageResult> {
    return {
      text: this.text,
      confidence:
        this.confidence,
      language: "eng",
      diagnostics: [],
    };
  }

  async close():
    Promise<void> {
    this.closed = true;
  }
}

test("image content is OCR-identified independently of filename", async () => {
  const provider =
    new FakeOcrProvider(
      [
        "CONTRACT AGREEMENT",
        "FIDIC Conditions of Contract for Construction",
        "Accepted Contract Amount SAR 900000000",
        "Time for Completion 900 days",
        "Liquidated damages apply.",
      ].join("\n"),
    );

  const fakePng =
    new Uint8Array([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x01, 0x02, 0x03,
    ]);

  const result =
    await identifyEvidenceDocument({
      bytes: fakePng,
      sourceFilename:
        "photo_001.bin",
      sourceRelativePath:
        "Other/photo_001.bin",
      declaredMediaType:
        "application/octet-stream",
      declaredCategory:
        "other",
      declaredDocumentType:
        null,
      ocrProvider:
        provider,
    });

  assert.equal(
    result.identification
      .verifiedMediaType,
    "image/png",
  );
  assert.equal(
    result.identification
      .detectedCategory,
    "contract",
  );
  assert.equal(
    result.identification
      .detectedDocumentType,
    "main_contract",
  );
  assert.equal(
    result.identification
      .method,
    "ocr_sample",
  );
  assert.equal(
    result.identification
      .ocrUsed,
    true,
  );
  assert.equal(
    result.identification
      .needsReview,
    false,
  );
  assert.equal(
    provider.closed,
    true,
  );
});

test("scanned PDF classification uses OCR when there is no text layer", async () => {
  const pdf =
    await PDFDocument.create();
  pdf.addPage([
    595,
    842,
  ]);
  const bytes =
    new Uint8Array(
      await pdf.save(),
    );

  const provider =
    new FakeOcrProvider(
      [
        "NEXUS PROJECT",
        "MONTHLY HSE REPORT",
        "Total Manhours 16200000",
        "Lost Time Injuries 1",
        "LTIFR 0.06",
        "TRIR 0.33",
      ].join("\n"),
      0.94,
    );

  const result =
    await identifyEvidenceDocument({
      bytes,
      sourceFilename:
        "document_992.pdf",
      sourceRelativePath:
        "Other/document_992.pdf",
      declaredMediaType:
        "application/pdf",
      declaredCategory:
        "other",
      declaredDocumentType:
        null,
      ocrProvider:
        provider,
    });

  assert.equal(
    result.identification
      .verifiedMediaType,
    "application/pdf",
  );
  assert.equal(
    result.identification
      .detectedCategory,
    "hse_quality_fm",
  );
  assert.equal(
    result.identification
      .detectedDocumentType,
    "hse_report",
  );
  assert.equal(
    result.identification
      .method,
    "ocr_sample",
  );
  assert.equal(
    result.identification
      .ocrUsed,
    true,
  );
  assert.equal(
    result.identification
      .pageCount,
    1,
  );
  assert.ok(
    (
      result.identification
        .ocrConfidence ?? 0
    ) >= 0.9,
  );
});

test("low-confidence OCR never becomes silently trusted", async () => {
  const provider =
    new FakeOcrProvider(
      "RFI ID Raised Date Required Response Response Date Technical Query",
      0.42,
    );

  const fakeJpeg =
    new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0,
      0x00, 0x10,
    ]);

  const result =
    await identifyEvidenceDocument({
      bytes: fakeJpeg,
      sourceFilename:
        "wrong_name.jpg",
      sourceRelativePath:
        "Other/wrong_name.jpg",
      declaredMediaType:
        "image/jpeg",
      declaredCategory:
        "other",
      declaredDocumentType:
        null,
      ocrProvider:
        provider,
    });

  assert.equal(
    result.identification
      .detectedCategory,
    "engineering",
  );
  assert.equal(
    result.identification
      .detectedDocumentType,
    "rfi_register",
  );
  assert.equal(
    result.identification
      .needsReview,
    true,
  );
  assert.ok(
    result.identification
      .diagnostics.includes(
        "DOCUMENT_OCR_LOW_CONFIDENCE",
      ),
  );
});


test("forecast method narratives do not become BOQ from quantity and rate words", async () => {
  const text = "Independent forecast method basis. Remaining quantity divided by conservative achievable rate defines productivity duration. This is a methodology, not a priced bill.";
  const result = await identifyEvidenceDocument({bytes: Buffer.from(text), sourceFilename: "unrelated-evidence.txt", sourceRelativePath: null});
  assert.equal(result.identification.detectedDocumentType, "productivity_forecast_basis");
  const legacy = {documentType: "boq", category: "boq_cost", mediaType: "text/plain", identification: {detectedTitle: "Independent forecast method basis"}, assertions: [{sourceText: text}], basisState: "candidate"} as any;
  const review = documentClassificationForReview(legacy);
  assert.equal(review.documentType, "productivity_forecast_basis"); assert.equal(review.reviewRequired, true);
  assert.equal(legacy.documentType, "boq"); assert.equal(legacy.basisState, "candidate");
  const generic = await identifyEvidenceDocument({bytes: Buffer.from("Quantity and rate are used to estimate a forecast."), sourceFilename: "unrelated.txt", sourceRelativePath: null});
  assert.notEqual(generic.identification.detectedDocumentType, "boq");
});
