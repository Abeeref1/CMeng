import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";

import {
  detectContractHeading,
  parseContractDocx,
  parseContractPdf,
  segmentContractPages,
} from "../packages/contract-parser/src";
import type {
  ContractAiResolver,
} from "../packages/contract-parser/src";
import type {
  OcrPageResult,
  OcrProvider,
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

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function makeDocx(input: {
  paragraphs: Array<{
    text: string;
    style?: string;
  }>;
  tableRows?: string[][];
}): Promise<Buffer> {
  const zip = new JSZip();

  const paragraphXml = input.paragraphs
    .map(
      (paragraph) =>
        `<w:p>${
          paragraph.style
            ? `<w:pPr><w:pStyle w:val="${xmlEscape(paragraph.style)}"/></w:pPr>`
            : ""
        }<w:r><w:t>${xmlEscape(paragraph.text)}</w:t></w:r></w:p>`,
    )
    .join("");

  const tableXml = input.tableRows
    ? `<w:tbl>${input.tableRows
        .map(
          (row) =>
            `<w:tr>${row
              .map(
                (cell) =>
                  `<w:tc><w:p><w:r><w:t>${xmlEscape(cell)}</w:t></w:r></w:p></w:tc>`,
              )
              .join("")}</w:tr>`,
        )
        .join("")}</w:tbl>`
    : "";

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${tableXml}
    ${paragraphXml}
  </w:body>
</w:document>`,
  );

  return Buffer.from(
    await zip.generateAsync({ type: "uint8array" }),
  );
}

test("contract headings support context English Arabic and Arabic-Indic digits", () => {
  assert.deepEqual(
    detectContractHeading("Clause 14.2 Payment"),
    {
      kind: "clause",
      identifier: "14.2",
      contextIdentifier: null,
      heading: "Payment",
    },
  );

  assert.deepEqual(
    detectContractHeading("المادة ١٢.٣ الدفعات"),
    {
      kind: "clause",
      identifier: "12.3",
      contextIdentifier: null,
      heading: "الدفعات",
    },
  );

  assert.deepEqual(
    detectContractHeading("Section 01 - Clause 02: Employer"),
    {
      kind: "clause",
      identifier: "1.2",
      contextIdentifier: "1",
      heading: "Employer",
    },
  );

  assert.deepEqual(
    detectContractHeading("Appendix A Price Schedule"),
    {
      kind: "appendix",
      identifier: "A",
      contextIdentifier: null,
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
  assert.equal(clause1.contextKey, "cycle:1");
  assert.equal(clause1.startPage, 1);
  assert.equal(clause1.endPage, 2);
  assert.match(clause1.text, /continues clause 1/);
  assert.ok(
    clause1.sourceSpans.some(
      (span) =>
        span.page === 2 &&
        span.text === "This sentence continues clause 1.",
    ),
  );
  assert.equal(result.semanticCoveragePercent, 100);
});

test("same clause number can repeat in a new deterministic cycle without false duplicate failure", () => {
  const result = segmentContractPages(
    pdfResult([
      page(1, "Clause 1 - General\n1.1 First cycle."),
      page(2, "Clause 2 - Payment\n2.1 First cycle payment."),
      page(3, "Clause 1 - General\n1.1 Second cycle."),
      page(4, "Clause 2 - Payment\n2.1 Second cycle payment."),
    ]),
  );

  assert.equal(result.complete, true);
  assert.deepEqual(result.duplicateIdentifiers, []);
  assert.ok(
    result.repeatedRawIdentifiers.includes("clause:1"),
  );

  const clauseOnes = result.clauses.filter(
    (section) => section.identifier === "1",
  );
  assert.equal(clauseOnes.length, 2);
  assert.equal(clauseOnes[0]!.contextKey, "cycle:1");
  assert.equal(clauseOnes[1]!.contextKey, "cycle:2");
  assert.notEqual(
    clauseOnes[0]!.sectionKey,
    clauseOnes[1]!.sectionKey,
  );
});

test("duplicate clause inside the same context blocks semantic certification", () => {
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
    ["clause:cycle:1:1.1"],
  );
});

test("NEBULA section-clause hierarchy creates source-grounded unique identities", () => {
  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        [
          "Section 01 - Clause 01: General Provisions",
          "1.1.1 First provision.",
          "Section 01 - Clause 02: Employer",
          "1.2.1 Employer provision.",
        ].join("\n"),
      ),
      page(
        2,
        [
          "Section 02 - Clause 01: General Provisions",
          "2.1.1 New section.",
        ].join("\n"),
      ),
    ]),
  );

  assert.equal(result.complete, true);
  assert.deepEqual(result.duplicateIdentifiers, []);

  const employer = result.clauses.find(
    (clause) => clause.identifier === "1.2",
  )!;
  assert.equal(employer.contextKey, "section:1");
  assert.equal(employer.parentIdentifier, "1");

  const section2 = result.clauses.find(
    (clause) => clause.identifier === "2.1",
  )!;
  assert.equal(section2.contextKey, "section:2");
});

test("cross-reference resolves inside the same clause context", () => {
  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        [
          "1 Notices",
          "A claim is subject to Clause 2.",
          "2 Claims",
          "The claim shall be notified within 28 days.",
        ].join("\n"),
      ),
    ]),
  );

  assert.equal(result.complete, true);
  const reference = result.references.find(
    (item) => item.targetIdentifier === "2",
  )!;
  assert.equal(reference.status, "resolved");
  assert.equal(reference.resolvedSectionKeys.length, 1);
  assert.match(
    reference.resolvedSectionKeys[0]!,
    /clause:cycle:1:2/,
  );
});

test("amendment action is preserved as an external target to the base contract", () => {
  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        [
          "CONTRACT AMENDMENT NO. 1",
          "Amendment Provision 1.2",
          "1.1 Clause 20.2.1 is amended: notice shall be given within 21 days.",
          "1.2 The detailed claim period remains unchanged.",
        ].join("\n"),
      ),
    ]),
  );

  assert.equal(result.complete, true);
  assert.equal(result.amendmentActions.length, 1);
  assert.equal(
    result.amendmentActions[0]!.targetIdentifier,
    "20.2.1",
  );
  assert.equal(
    result.amendmentActions[0]!.action,
    "amend",
  );
  assert.equal(
    result.amendmentActions[0]!.status,
    "external",
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

test("table-of-contents line does not create false clause boundary", () => {
  assert.equal(
    detectContractHeading(
      "14.2 Payment ................................ 37",
    ),
    null,
  );

  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        [
          "TABLE OF CONTENTS",
          "14.2 Payment ................................ 37",
          "15 Variations ................................ 40",
        ].join("\n"),
      ),
      page(
        2,
        [
          "14.2 Payment",
          "The Employer shall pay the certified amount.",
          "15 Variations",
          "Variations shall be instructed in writing.",
        ].join("\n"),
      ),
    ]),
  );

  assert.equal(result.complete, true);
  assert.deepEqual(
    result.clauses.map((clause) => clause.identifier),
    ["14.2", "15"],
  );
});

test("repeated running heading is ignored instead of creating duplicate clause", () => {
  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        [
          "8.4 Extension of Time",
          "The Contractor may claim an extension.",
        ].join("\n"),
      ),
      page(
        2,
        [
          "8.4 Extension of Time",
          "The claim shall state the cause and effect.",
        ].join("\n"),
      ),
    ]),
  );

  assert.equal(result.complete, true);
  assert.equal(result.clauses.length, 1);
  assert.deepEqual(result.duplicateIdentifiers, []);
  assert.equal(result.clauses[0]!.endPage, 2);
  assert.ok(
    result.ignoredSpans.some(
      (item) =>
        item.reason === "running_header" &&
        item.sourceSpan.text ===
          "8.4 Extension of Time",
    ),
  );
});

test("native searchable contract PDF integrates page parsing and hierarchy", async () => {
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

  assert.equal(result.sourceType, "pdf");
  assert.equal(result.pdf!.totalPages, 2);
  assert.equal(result.pdf!.nativePages, 2);
  assert.equal(result.physicalComplete, true);
  assert.equal(result.clauses.length, 2);
  assert.equal(result.complete, true);
});

test("ORION-style DOCX preserves metadata table and parses clauses", async () => {
  const bytes = await makeDocx({
    tableRows: [
      [
        "Contract No.",
        "ORION-RAMLC-P1-CW-001",
        "Contract Date",
        "19 October 2025",
      ],
      [
        "Employer",
        "ORION Development Company",
        "Engineer",
        "Meridian PMC",
      ],
    ],
    paragraphs: [
      {
        text: "Contract / Particular Conditions",
        style: "Title",
      },
      { text: "1. Contract Scope", style: "Heading1" },
      {
        text:
          "The Contractor shall execute, complete, test and remedy defects.",
      },
      {
        text:
          "2. Contract Documents and Order of Precedence",
        style: "Heading1",
      },
      {
        text:
          "The Priced Bill of Quantities forms part of the Contract.",
      },
      { text: "6. Notices and Claims", style: "Heading1" },
      {
        text:
          "A party seeking time or money shall notify a claim within 28 days.",
      },
    ],
  });

  const result = await parseContractDocx(bytes);

  assert.equal(result.sourceType, "docx");
  assert.equal(result.pdf, null);
  assert.equal(result.docx!.complete, true);
  assert.equal(result.docx!.tableCellBlocks, 8);
  assert.equal(result.clauses.length, 3);
  assert.equal(result.complete, true);
  assert.equal(result.clauses[0]!.identifier, "1");
  assert.ok(
    result.sections[0]!.text.includes(
      "ORION-RAMLC-P1-CW-001",
    ),
  );
});

test("grounded AI can recover ambiguous heading but cannot change source text", async () => {
  const bytes = await makeDocx({
    paragraphs: [
      { text: "Part IV - Payment" },
      {
        text:
          "Payment shall be certified within 28 days.",
      },
    ],
  });

  const resolver: ContractAiResolver = {
    name: "fake-grounded-ai",
    async resolveHeading(input) {
      return {
        kind: "clause",
        identifier: "4",
        contextIdentifier: null,
        heading: "Payment",
        confidence: 0.99,
        sourceStart: input.sourceSpan.start,
        sourceEnd: input.sourceSpan.end,
        sourceText: input.sourceSpan.text,
        explanation:
          "Roman-numeral part heading grounded in exact source.",
      };
    },
  };

  const result = await parseContractDocx(bytes, {
    aiResolver: resolver,
  });

  assert.equal(result.complete, true);
  assert.equal(result.clauses.length, 1);
  assert.equal(result.clauses[0]!.sourceMode, "ai_grounded");
  assert.equal(result.clauses[0]!.identifier, "4");
  assert.match(
    result.clauses[0]!.text,
    /Part IV - Payment/,
  );
});

test("AI proposal with wrong source span is rejected and contract remains unresolved", async () => {
  const bytes = await makeDocx({
    paragraphs: [
      { text: "Part IV - Payment" },
      { text: "Payment text." },
    ],
  });

  const resolver: ContractAiResolver = {
    name: "bad-ai",
    async resolveHeading(input) {
      return {
        kind: "clause",
        identifier: "4",
        contextIdentifier: null,
        heading: "Payment",
        confidence: 0.999,
        sourceStart: input.sourceSpan.start,
        sourceEnd: input.sourceSpan.end,
        sourceText: "different source text",
        explanation: "Unsupported proposal.",
      };
    },
  };

  const result = await parseContractDocx(bytes, {
    aiResolver: resolver,
  });

  assert.equal(result.complete, false);
  assert.equal(result.clauses.length, 0);
  assert.ok(
    result.diagnostics.some((diagnostic) =>
      diagnostic.includes(
        "CONTRACT_AI_SOURCE_SPAN_MISMATCH",
      ),
    ),
  );
});


test("NEBULA repeated source overlap is ignored only when contextual heading text is identical", () => {
  const result = segmentContractPages(
    pdfResult([
      page(
        1,
        [
          "Section 01 - Clause 01: General Provisions",
          "1.1.1 First provision.",
          "1.1.2 Second provision.",
        ].join("\n"),
      ),
      page(
        2,
        [
          "Section 01 - Clause 01: General Provisions",
          "1.1.1 First provision.",
          "1.1.2 Second provision.",
          "1.1.3 Third provision.",
        ].join("\n"),
      ),
    ]),
  );

  assert.equal(result.complete, true);
  assert.deepEqual(result.duplicateIdentifiers, []);
  assert.ok(
    result.ignoredSpans.filter(
      (item) =>
        item.reason === "repeated_source_overlap",
    ).length >= 3,
  );
  assert.equal(
    result.clauses.filter(
      (clause) => clause.identifier === "1.1.1",
    ).length,
    1,
  );
  assert.ok(
    result.clauses.some(
      (clause) => clause.identifier === "1.1.3",
    ),
  );
});


test("scanned contract PDF is parsed through OCR before contract segmentation", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);

  class FakeContractOcr implements OcrProvider {
    readonly name = "fake-contract-ocr";

    async recognize(
      _image: Uint8Array,
      _pageNumber: number,
    ): Promise<OcrPageResult> {
      return {
        text:
          "1 Scope\nThe Contractor shall execute the Works.\n2 Payment\nPayment is due within 30 days.",
        confidence: 0.98,
        language: "eng",
        diagnostics: [],
      };
    }
  }

  const result = await parseContractPdf(
    Buffer.from(await pdf.save()),
    {
      ocrProvider: new FakeContractOcr(),
    },
  );

  assert.equal(result.pdf!.ocrPages, 1);
  assert.equal(result.clauses.length, 2);
  assert.equal(result.clauses[0]!.identifier, "1");
  assert.equal(result.clauses[1]!.identifier, "2");
  assert.equal(result.complete, true);
});
