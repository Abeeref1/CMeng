import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  detectContractHeading,
  parseContractPdf,
  segmentContractPages,
} from "../packages/contract-parser/src";
import type {
  PdfDocumentResult,
  PdfPageResult,
} from "../packages/pdf-document-parser/src";

function page(
  pageNumber: number,
  text: string,
  method: PdfPageResult["method"] = "native",
): PdfPageResult {
  return {
    pageNumber,
    method,
    text,
    nativeCharacterCount: text.length,
    ocrConfidence: null,
    aiReview: null,
    diagnostics:
      method === "failed" ? ["TEST_PAGE_FAILED"] : [],
  };
}

function pdfResult(
  pages: PdfPageResult[],
): PdfDocumentResult {
  const failedPages = pages.filter(
    (item) => item.method === "failed",
  ).length;
  const processedPages = pages.length - failedPages;
  return {
    totalPages: pages.length,
    processedPages,
    nativePages: pages.filter(
      (item) => item.method === "native",
    ).length,
    ocrPages: pages.filter(
      (item) => item.method === "ocr",
    ).length,
    blankPages: pages.filter(
      (item) => item.method === "blank",
    ).length,
    failedPages,
    unresolvedPages: failedPages,
    coveragePercent:
      pages.length === 0
        ? 0
        : Number(
            ((processedPages / pages.length) * 100).toFixed(4),
          ),
    complete: failedPages === 0,
    pages,
    diagnostics: [],
  };
}

test("contract headings support English Arabic and Arabic-Indic digits", () => {
  assert.deepEqual(
    detectContractHeading("Clause 14.2 Payment"),
    {
      kind: "clause",
      identifier: "14.2",
      heading: "Payment",
    },
  );

  assert.deepEqual(
    detectContractHeading("المادة ١٢.٣ الدفعات"),
    {
      kind: "clause",
      identifier: "12.3",
      heading: "الدفعات",
    },
  );

  assert.deepEqual(
    detectContractHeading("Appendix A Price Schedule"),
    {
      kind: "appendix",
      identifier: "A",
      heading: "Price Schedule",
    },
  );
});

test("contract clause continuation across pages preserves exact source spans", () => {
  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        [
          "CONSTRUCTION CONTRACT",
          "1 General Conditions",
          "The Contractor shall execute the Works.",
        ].join("\n"),
      ),
      page(
        2,
        [
          "This sentence continues clause 1.",
          "2 Payment",
          "Payment shall be certified within 28 days.",
          "Appendix A Price Schedule",
          "The priced schedule forms part of the Contract.",
        ].join("\n"),
      ),
    ]),
  );

  assert.equal(result.physicalComplete, true);
  assert.equal(result.semanticComplete, true);
  assert.equal(result.complete, true);
  assert.equal(result.clauses.length, 2);
  assert.equal(result.appendices.length, 1);

  const clause1 = result.clauses[0]!;
  assert.equal(clause1.identifier, "1");
  assert.equal(clause1.startPage, 1);
  assert.equal(clause1.endPage, 2);
  assert.match(
    clause1.text,
    /continues clause 1/,
  );
  assert.ok(
    clause1.sourceSpans.some(
      (span) =>
        span.page === 2 &&
        span.text === "This sentence continues clause 1.",
    ),
  );
  assert.equal(result.semanticCoveragePercent, 100);
});

test("duplicate contract clause identifiers block semantic certification", () => {
  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        [
          "1.1 Definitions",
          "First definition text.",
          "1.1 Definitions Revised",
          "Second definition text.",
        ].join("\n"),
      ),
    ]),
  );

  assert.equal(result.physicalComplete, true);
  assert.equal(result.semanticComplete, false);
  assert.equal(result.complete, false);
  assert.deepEqual(
    result.duplicateIdentifiers,
    ["clause:1.1"],
  );
  assert.equal(
    result.clauses.filter(
      (clause) => clause.identifier === "1.1",
    ).length,
    2,
  );
});

test("unreadable contract page prevents physical and overall completeness", () => {
  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        "1 Scope\nThe Works include civil construction.",
      ),
      page(2, "", "failed"),
      page(
        3,
        "2 Payment\nPayment terms continue here.",
      ),
    ]),
  );

  assert.equal(result.physicalComplete, false);
  assert.equal(result.complete, false);
  assert.ok(
    result.diagnostics.includes(
      "CONTRACT_PAGE_UNREADABLE:2",
    ),
  );
});

test("contract with no detected clauses is preserved but not semantically certified", () => {
  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        "Cover Page\nProject P88\nSigned by the parties.",
      ),
    ]),
  );

  assert.equal(result.physicalComplete, true);
  assert.equal(result.semanticComplete, false);
  assert.equal(result.complete, false);
  assert.equal(result.sections[0]!.kind, "preamble");
  assert.match(result.sections[0]!.text, /Project P88/);
  assert.ok(
    result.diagnostics.includes(
      "CONTRACT_NO_CLAUSES_DETECTED",
    ),
  );
});

test("native searchable contract PDF integrates page parsing and clause segmentation", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const first = pdf.addPage([595, 842]);
  first.drawText(
    "1 Scope\nThe Contractor shall perform the Works.",
    {
      x: 50,
      y: 780,
      size: 12,
      font,
      lineHeight: 18,
    },
  );

  const second = pdf.addPage([595, 842]);
  second.drawText(
    "2 Payment\nPayment shall be made within 28 days.",
    {
      x: 50,
      y: 780,
      size: 12,
      font,
      lineHeight: 18,
    },
  );

  const result = await parseContractPdf(
    Buffer.from(await pdf.save()),
  );

  assert.equal(result.pdf.totalPages, 2);
  assert.equal(result.pdf.nativePages, 2);
  assert.equal(result.physicalComplete, true);
  assert.equal(result.clauses.length, 2);
  assert.equal(result.complete, true);
});
