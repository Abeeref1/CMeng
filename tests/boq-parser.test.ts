import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import {
  assessBoqAiHeaderProposal,
  parseBoqWorkbook,
  parseStrictNumeric,
} from "../packages/boq-parser/src";

async function workbookBytes(
  build: (workbook: ExcelJS.Workbook) => void | Promise<void>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await build(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("clean BOQ retains exact row/cell provenance and commercial values", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.addRow(["Item No.", "Description", "Unit", "Quantity", "Rate", "Amount"]);
    sheet.addRow(["1.1", "Concrete C40", "m3", 125, 450, 56250]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  assert.equal(parsed.complete, true);
  assert.equal(parsed.candidateRows, 1);
  assert.equal(parsed.parsedRows, 1);
  assert.equal(parsed.coveragePercent, 100);

  const item = parsed.sheets[0]!.items[0]!;
  assert.equal(item.itemNumber, "1.1");
  assert.equal(item.description, "Concrete C40");
  assert.equal(item.quantity, 125);
  assert.equal(item.rate, 450);
  assert.equal(item.amount, 56250);
  assert.equal(item.sourceCells.quantity!.address, "D2");
  assert.equal(item.sourceCells.amount!.address, "F2");
});

test("Arabic BOQ headers and descriptions parse without transliteration or mojibake", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("جدول الكميات");
    sheet.addRow(["رقم البند", "وصف البند", "الوحدة", "الكمية", "سعر الوحدة", "الإجمالي"]);
    sheet.addRow(["1", "أعمال الحفر والردم", "م3", 1000, 25.5, 25500]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  assert.equal(parsed.complete, true);
  const item = parsed.sheets[0]!.items[0]!;
  assert.equal(item.description, "أعمال الحفر والردم");
  assert.equal(item.quantity, 1000);
  assert.equal(item.rate, 25.5);
  assert.equal(item.amount, 25500);
});

test("formula cells retain formula source and use stored result when available", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "Blockwork", "m2", 200, 75, { formula: "D2*E2", result: 15000 }]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  assert.equal(parsed.complete, true);
  assert.equal(parsed.sheets[0]!.items[0]!.amount, 15000);
});

test("formula without cached result is unresolved rather than treated as zero", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "Blockwork", "m2", 200, 75, { formula: "D2*E2" }]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  const item = parsed.sheets[0]!.items[0]!;
  assert.equal(item.status, "unresolved");
  assert.ok(item.diagnosticCodes.includes("BOQ_AMOUNT_FORMULA_RESULT_MISSING"));
  assert.equal(parsed.complete, false);
});

test("quantity x rate arithmetic mismatch is explicit and blocks complete status", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "Steel", "kg", 1000, 3.5, 3600]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  const item = parsed.sheets[0]!.items[0]!;
  assert.ok(item.diagnosticCodes.includes("BOQ_AMOUNT_ARITHMETIC_MISMATCH"));
  assert.equal(item.status, "unresolved");
  assert.equal(parsed.complete, false);
});

test("ambiguous textual numbers are never guessed", () => {
  const ambiguous = parseStrictNumeric("1,234");
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.value, null);

  const clearDecimal = parseStrictNumeric("1234.50");
  assert.equal(clearDecimal.status, "valid");
  assert.equal(clearDecimal.value, 1234.5);

  const clearEuropean = parseStrictNumeric("1.234,50");
  assert.equal(clearEuropean.status, "valid");
  assert.equal(clearEuropean.value, 1234.5);
});

test("merged cells and hidden structures are inventoried instead of discarded", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "BILL 1 - PRELIMINARIES";
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "Site offices", "month", 12, 10000, 120000]);
    sheet.getRow(3).hidden = true;
    sheet.getColumn(6).hidden = true;
  });

  const parsed = await parseBoqWorkbook(bytes);
  const inventory = parsed.inventory.sheets[0]!;
  assert.ok(inventory.mergedRanges.includes("A1:F1"));
  assert.ok(inventory.hiddenRows.includes(3));
  assert.ok(inventory.hiddenColumns.includes(6));
  assert.equal(parsed.sheets[0]!.items.length, 1);
});

test("a populated unclassified sheet is surfaced and prevents complete status", async () => {
  const bytes = await workbookBytes((workbook) => {
    const cover = workbook.addWorksheet("Cover");
    cover.addRow(["Project Name", "Mega Project"]);
    cover.addRow(["Tender", "ABC-001"]);
    cover.addRow(["Revision", "02"]);

    const boq = workbook.addWorksheet("BOQ");
    boq.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    boq.addRow(["1", "Excavation", "m3", 100, 20, 2000]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  assert.equal(parsed.complete, false);
  assert.equal(parsed.coveragePercent, null);
  assert.ok(parsed.diagnostics.some((d) => d.includes("Cover:BOQ_POPULATED_SHEET_UNCLASSIFIED")));
});

test("summary/total rows are not silently mixed with ordinary line items", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "Excavation", "m3", 100, 20, 2000]);
    sheet.addRow(["", "TOTAL", "", "", "", 2000]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  const total = parsed.sheets[0]!.items.find((item) => item.description === "TOTAL")!;
  assert.equal(total.rowKind, "total_or_summary");
  assert.equal(total.status, "verified");
});

test("AI BOQ header proposal can never become authoritative by confidence alone", () => {
  const assessment = assessBoqAiHeaderProposal({
    sheet: "BOQ",
    headerRow: 7,
    mapping: {
      1: "item_number",
      2: "description",
      4: "quantity",
      5: "rate",
      6: "amount",
    },
    confidence: 0.9999,
    explanation: "Header semantics inferred from layout and labels",
  });

  assert.equal(assessment.accepted, true);
  assert.equal(assessment.authoritative, false);
});

test("description-only section rows remain in the source population", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "EARTHWORKS", "", "", "", ""]);
    sheet.addRow(["1.1", "Excavation", "m3", 100, 20, 2000]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  assert.equal(parsed.candidateRows, 2);
  assert.equal(parsed.parsedRows, 2);
  assert.equal(parsed.coveragePercent, 100);
  assert.equal(parsed.sheets[0]!.items[0]!.rowKind, "section");
  assert.equal(parsed.sheets[0]!.items[1]!.rowKind, "line_item");
});

test("repeated BOQ print headers are segmented and never parsed as line items", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("Bill 1");
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "Excavation", "m3", 100, 20, 2000]);
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["2", "Backfilling", "m3", 80, 15, 1200]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  const sheet = parsed.sheets[0]!;
  assert.equal(sheet.headers.length, 2);
  assert.equal(sheet.items.length, 2);
  assert.deepEqual(sheet.items.map((item) => item.itemNumber), ["1", "2"]);
  assert.equal(parsed.complete, true);
});

test("multiple BOQ tables with different column order in one sheet use their own header mappings", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("Bills");
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "Excavation", "m3", 100, 20, 2000]);
    sheet.addRow([]);
    sheet.addRow(["Description", "Amount", "Item", "Rate", "Qty", "Unit"]);
    sheet.addRow(["Concrete", 4500, "2", 45, 100, "m3"]);
    sheet.addRow([]);
    sheet.addRow(["رقم البند", "وصف البند", "الوحدة", "الكمية", "سعر الوحدة", "الإجمالي"]);
    sheet.addRow(["3", "أعمال البلوك", "م2", 200, 30, 6000]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  const sheet = parsed.sheets[0]!;
  assert.equal(sheet.headers.length, 3);
  assert.equal(sheet.items.length, 3);
  assert.equal(sheet.items[0]!.amount, 2000);
  assert.equal(sheet.items[1]!.description, "Concrete");
  assert.equal(sheet.items[1]!.quantity, 100);
  assert.equal(sheet.items[1]!.rate, 45);
  assert.equal(sheet.items[1]!.amount, 4500);
  assert.equal(sheet.items[2]!.description, "أعمال البلوك");
  assert.equal(sheet.items[2]!.amount, 6000);
  assert.equal(parsed.complete, true);
});


test("currency-suffixed commercial headers map rate and amount correctly", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.addRow([
      "Item No",
      "Description",
      "Unit",
      "Quantity",
      "Rate SAR",
      "Amount SAR",
    ]);
    sheet.addRow([
      "1.0001",
      "Concrete",
      "m3",
      "406.449",
      "461",
      "187373",
    ]);
  });

  const parsed = await parseBoqWorkbook(bytes);

  assert.equal(parsed.complete, true);
  const item = parsed.sheets[0]!.items[0]!;
  assert.equal(item.quantity, 406.449);
  assert.equal(item.rate, 461);
  assert.equal(item.amount, 187373);
});

test("single-separator 3-digit quantity is resolved only when BOQ arithmetic proves one interpretation", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.addRow([
      "Item",
      "Description",
      "Unit",
      "Qty",
      "Rate",
      "Amount",
    ]);
    sheet.addRow([
      "1",
      "Concrete",
      "m3",
      "1,234",
      "2",
      "2468",
    ]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  const item = parsed.sheets[0]!.items[0]!;

  assert.equal(parsed.complete, true);
  assert.equal(item.quantity, 1234);
  assert.equal(item.rate, 2);
  assert.equal(item.amount, 2468);
});

test("ambiguous numeric remains unresolved when BOQ arithmetic cannot prove a unique interpretation", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.addRow([
      "Item",
      "Description",
      "Unit",
      "Qty",
      "Rate",
      "Amount",
    ]);
    sheet.addRow([
      "1",
      "Concrete",
      "m3",
      "1,234",
      "",
      "",
    ]);
  });

  const parsed = await parseBoqWorkbook(bytes);
  const item = parsed.sheets[0]!.items[0]!;

  assert.equal(parsed.complete, false);
  assert.equal(item.quantity, null);
  assert.ok(
    item.diagnosticCodes.includes("BOQ_QUANTITY_AMBIGUOUS"),
  );
});


test("ORION-style BOQ summary is preserved and reconciled to priced items", async () => {
  const bytes = await workbookBytes((workbook) => {
    const summary = workbook.addWorksheet("BOQ Summary");
    summary.addRow(["Section", "Description", "Amount (SAR)", "Share"]);
    summary.addRow(["A", "Civil", 2000, 0.4]);
    summary.addRow(["B", "MEP", 3000, 0.6]);
    summary.addRow(["", "TOTAL", 5000, 1]);

    const priced = workbook.addWorksheet("Priced BOQ");
    priced.addRow([
      "Item No.",
      "Section",
      "Description",
      "Quantity",
      "Unit",
      "Rate (SAR)",
      "Amount (SAR)",
    ]);
    priced.addRow(["1.1", "A", "Excavation", 100, "m3", 20, 2000]);
    priced.addRow(["2.1", "B", "MEP Works", 100, "item", 30, 3000]);
  });

  const parsed = await parseBoqWorkbook(bytes);

  assert.equal(parsed.complete, true);
  assert.equal(parsed.candidateRows, 2);
  assert.equal(parsed.sheets.length, 1);
  assert.equal(parsed.sheets[0]!.items[0]!.section, "A");
  assert.equal(parsed.sheets[0]!.items[1]!.section, "B");
  assert.equal(parsed.auxiliarySheets.length, 1);

  const summary = parsed.auxiliarySheets[0]!;
  assert.equal(summary.kind, "summary");
  assert.equal(summary.summaryRows.length, 2);
  assert.equal(summary.totalAmount, 5000);
  assert.equal(summary.totalShare, 1);
  assert.deepEqual(summary.diagnostics, []);
});

test("BOQ summary mismatch blocks workbook certification", async () => {
  const bytes = await workbookBytes((workbook) => {
    const summary = workbook.addWorksheet("BOQ Summary");
    summary.addRow(["Section", "Description", "Amount (SAR)", "Share"]);
    summary.addRow(["A", "Civil", 2000, 0.4]);
    summary.addRow(["B", "MEP", 3000, 0.6]);
    summary.addRow(["", "TOTAL", 6000, 1]);

    const priced = workbook.addWorksheet("Priced BOQ");
    priced.addRow([
      "Item",
      "Section",
      "Description",
      "Qty",
      "Unit",
      "Rate (SAR)",
      "Amount (SAR)",
    ]);
    priced.addRow(["1", "A", "Civil", 100, "m3", 20, 2000]);
    priced.addRow(["2", "B", "MEP", 100, "item", 30, 3000]);
  });

  const parsed = await parseBoqWorkbook(bytes);

  assert.equal(parsed.complete, false);
  assert.ok(
    parsed.diagnostics.some(
      (diagnostic) =>
        diagnostic.includes("BOQ_SUMMARY_INTERNAL_TOTAL_MISMATCH") ||
        diagnostic.includes("BOQ_SUMMARY_TO_LINE_ITEMS_MISMATCH"),
    ),
  );
});
