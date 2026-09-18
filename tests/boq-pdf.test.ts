import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { parseBoqPdf } from "../packages/boq-pdf-parser/src";
import type { OcrPageResult, OcrProvider } from "../packages/pdf-document-parser/src";

class FakeOcr implements OcrProvider {
  readonly name = "fake-ocr";
  async recognize(_image: Uint8Array, _pageNumber: number): Promise<OcrPageResult> {
    return {
      text: "Item Description Unit Qty Rate Amount\n1 Excavation m3 100 20 2000",
      confidence: 0.99,
      language: "eng",
      diagnostics: [],
    };
  }
}

async function nativeTextPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  page.drawText("BOQ narrative page without a structured table", {
    x: 50,
    y: 780,
    size: 12,
    font,
  });
  return Buffer.from(await pdf.save());
}

async function blankScannedPlaceholderPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  return Buffer.from(await pdf.save());
}

async function nativeTablePdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);

  const xs = [40, 95, 280, 345, 405, 465, 555];
  const top = 780;
  const rowHeight = 28;

  for (let row = 0; row <= 2; row += 1) {
    page.drawLine({
      start: { x: xs[0]!, y: top - row * rowHeight },
      end: { x: xs.at(-1)!, y: top - row * rowHeight },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }

  for (const x of xs) {
    page.drawLine({
      start: { x, y: top },
      end: { x, y: top - 2 * rowHeight },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }

  const header = ["Item", "Description", "Unit", "Qty", "Rate", "Amount"];
  const data = ["1", "Excavation", "m3", "100", "20", "2000"];

  header.forEach((value, index) => {
    page.drawText(value, {
      x: xs[index]! + 3,
      y: top - 18,
      size: 9,
      font,
    });
  });

  data.forEach((value, index) => {
    page.drawText(value, {
      x: xs[index]! + 3,
      y: top - rowHeight - 18,
      size: 9,
      font,
    });
  });

  return Buffer.from(await pdf.save());
}

test("native BOQ narrative page without structured table fails closed", async () => {
  const parsed = await parseBoqPdf(await nativeTextPdf());

  assert.equal(parsed.complete, false);
  assert.deepEqual(parsed.unresolvedPages, [1]);
  assert.ok(
    parsed.diagnostics.some((d) =>
      d.includes("BOQ_PDF_NATIVE_PAGE_WITHOUT_STRUCTURED_TABLE"),
    ),
  );
});

test("OCR BOQ page requires structured extractor, not plain OCR text", async () => {
  const parsed = await parseBoqPdf(await blankScannedPlaceholderPdf(), {
    ocrProvider: new FakeOcr(),
  });

  assert.equal(parsed.complete, false);
  assert.deepEqual(parsed.unresolvedPages, [1]);
  assert.ok(
    parsed.diagnostics.some((d) =>
      d.includes("BOQ_PDF_OCR_PAGE_REQUIRES_STRUCTURED_TABLE_EXTRACTOR"),
    ),
  );
});

test("OCR plus high-confidence structured extractor still passes BOQ arithmetic validation", async () => {
  const parsed = await parseBoqPdf(await blankScannedPlaceholderPdf(), {
    ocrProvider: new FakeOcr(),
    aiTableExtractor: {
      name: "fake-structured-ai",
      async extract() {
        return {
          confidence: 0.99,
          diagnostics: [],
          rows: [
            ["Item", "Description", "Unit", "Qty", "Rate", "Amount"],
            ["1", "Excavation", "m3", "100", "20", "2000"],
          ],
        };
      },
    },
  });

  assert.equal(parsed.complete, true);
  assert.equal(parsed.ocrTablePages, 1);
  assert.equal(parsed.candidateRows, 1);
  assert.equal(parsed.verifiedRows, 1);
  assert.equal(parsed.items[0]!.amount, 2000);
  assert.equal(parsed.items[0]!.sourceCells.amount!.page, 1);
});

test("AI-extracted OCR BOQ with wrong arithmetic remains unresolved", async () => {
  const parsed = await parseBoqPdf(await blankScannedPlaceholderPdf(), {
    ocrProvider: new FakeOcr(),
    aiTableExtractor: {
      name: "fake-structured-ai",
      async extract() {
        return {
          confidence: 0.99,
          diagnostics: [],
          rows: [
            ["Item", "Description", "Unit", "Qty", "Rate", "Amount"],
            ["1", "Excavation", "m3", "100", "20", "2500"],
          ],
        };
      },
    },
  });

  assert.equal(parsed.complete, false);
  assert.equal(parsed.unresolvedRows, 1);
  assert.ok(
    parsed.items[0]!.diagnostics.includes("BOQ_AMOUNT_ARITHMETIC_MISMATCH"),
  );
});

test("native drawn BOQ table is structurally discovered when PDF table engine recognizes it", async () => {
  const parsed = await parseBoqPdf(await nativeTablePdf());

  if (parsed.nativeTablePages === 0) {
    assert.equal(parsed.complete, false);
    assert.deepEqual(parsed.unresolvedPages, [1]);
    return;
  }

  assert.equal(parsed.candidateRows, 1);
  assert.equal(parsed.items[0]!.quantity, 100);
  assert.equal(parsed.items[0]!.rate, 20);
  assert.equal(parsed.items[0]!.amount, 2000);
});
