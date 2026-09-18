import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  ingestBoq,
} from "../packages/boq-ingestion/src";

async function xlsxBytes(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Priced BOQ");
  sheet.addRow([
    "Item",
    "Section",
    "Description",
    "Unit",
    "Qty",
    "Rate",
    "Amount",
    "Currency",
  ]);
  sheet.addRow([
    "1.1",
    "A",
    "Concrete C40",
    "m3",
    100,
    450,
    45000,
    "USD",
  ]);
  return Buffer.from(
    await workbook.xlsx.writeBuffer(),
  );
}

async function narrativePdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(
    StandardFonts.Helvetica,
  );
  const page = pdf.addPage([595, 842]);
  page.drawText(
    "BOQ narrative without structured table",
    {
      x: 50,
      y: 780,
      size: 12,
      font,
    },
  );
  return Buffer.from(await pdf.save());
}

test("Excel BOQ ingestion creates candidate-only governed evidence and canonical commercial items", async () => {
  const result = await ingestBoq({
    projectId: "P-BOQ-1",
    bytes: await xlsxBytes(),
    verifiedMediaType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sourceFilename: "priced-boq.xlsx",
    receivedAt:
      "2026-09-18T20:30:00.000Z",
  });

  assert.equal(
    result.sourceFormat,
    "excel_ooxml",
  );
  assert.equal(
    result.authority,
    "candidate_only",
  );
  assert.equal(
    result.persistence,
    "runtime_local",
  );
  assert.equal(
    result.state,
    "verified_candidate",
  );
  assert.equal(result.complete, true);
  assert.equal(result.candidateRows, 1);
  assert.equal(result.verifiedRows, 1);
  assert.equal(
    result.canonicalItems.length,
    1,
  );

  const item = result.canonicalItems[0]!;
  assert.equal(item.itemNumber, "1.1");
  assert.equal(item.quantity, 100);
  assert.equal(item.rate, 450);
  assert.equal(item.amount, 45000);
  assert.equal(item.currency, "USD");
  assert.ok(
    item.sourceRefs.some((ref) =>
      ref.includes("Priced BOQ!"),
    ),
  );
  assert.match(
    result.sourceHashSha256,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(
    result.sourceManifest.entries[0]!.sha256,
    result.sourceHashSha256,
  );
  assert.equal(
    result.evidenceReceipt.sourceHash,
    result.sourceHashSha256,
  );
});

test("PDF ingestion creates evidence but fails closed when no structured BOQ table is established", async () => {
  const result = await ingestBoq({
    projectId: "P-BOQ-2",
    bytes: await narrativePdf(),
    verifiedMediaType: "application/pdf",
    sourceFilename: "boq.pdf",
    receivedAt:
      "2026-09-18T20:31:00.000Z",
  });

  assert.equal(result.sourceFormat, "pdf");
  assert.equal(
    result.authority,
    "candidate_only",
  );
  assert.equal(result.complete, false);
  assert.equal(
    result.state,
    "unavailable",
  );
  assert.ok(
    result.diagnostics.some((code) =>
      code.includes(
        "BOQ_PDF_NATIVE_PAGE_WITHOUT_STRUCTURED_TABLE",
      ),
    ),
  );
  assert.match(
    result.evidenceReceipt.receiptId,
    /^receipt_/,
  );
});

test("media signature mismatch is rejected instead of trusting filename or MIME alone", async () => {
  await assert.rejects(
    () =>
      ingestBoq({
        projectId: "P-BOQ-3",
        bytes: await xlsxBytes(),
        verifiedMediaType:
          "application/pdf",
        sourceFilename: "fake.pdf",
        receivedAt:
          "2026-09-18T20:32:00.000Z",
      }),
    /BOQ_MEDIA_UNSUPPORTED_OR_SIGNATURE_MISMATCH/,
  );
});
