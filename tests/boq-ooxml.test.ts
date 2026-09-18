import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import {
  parseBoqOoxmlWorkbook,
  parseBoqWorkbook,
} from "../packages/boq-parser/src";

async function workbookBytes(
  build: (workbook: ExcelJS.Workbook) => void | Promise<void>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await build(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("OOXML fast BOQ parser matches canonical clean commercial values and provenance", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("Priced BOQ");
    sheet.addRow(["Item No.", "Description", "Unit", "Quantity", "Rate", "Amount"]);
    sheet.addRow(["1.1", "Concrete C40", "m3", 125, 450, 56250]);
  });

  const fast = await parseBoqOoxmlWorkbook(bytes);
  const canonical = await parseBoqWorkbook(bytes);

  assert.equal(fast.complete, true);
  assert.equal(fast.candidateRows, canonical.candidateRows);
  assert.equal(fast.parsedRows, canonical.parsedRows);
  assert.equal(fast.sheets[0]!.items[0]!.quantity, 125);
  assert.equal(fast.sheets[0]!.items[0]!.rate, 450);
  assert.equal(fast.sheets[0]!.items[0]!.amount, 56250);
  assert.equal(fast.sheets[0]!.items[0]!.sourceCells.quantity!.address, "D2");
  assert.equal(fast.sheets[0]!.items[0]!.sourceCells.amount!.address, "F2");
});

test("OOXML fast BOQ parser preserves formulas, merges and hidden structure", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("BOQ");
    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "BILL 1";
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "Blockwork", "m2", 200, 75, { formula: "D3*E3", result: 15000 }]);
    sheet.getRow(3).hidden = true;
    sheet.getColumn(6).hidden = true;
  });

  const fast = await parseBoqOoxmlWorkbook(bytes);

  assert.equal(fast.complete, true);
  assert.ok(fast.inventory.sheets[0]!.mergedRanges.includes("A1:F1"));
  assert.ok(fast.inventory.sheets[0]!.hiddenRows.includes(3));
  assert.ok(fast.inventory.sheets[0]!.hiddenColumns.includes(6));
  assert.equal(fast.sheets[0]!.items[0]!.amount, 15000);
});

test("OOXML fast BOQ parser handles repeated headers and different column order", async () => {
  const bytes = await workbookBytes((workbook) => {
    const sheet = workbook.addWorksheet("Bills");
    sheet.addRow(["Item", "Description", "Unit", "Qty", "Rate", "Amount"]);
    sheet.addRow(["1", "Excavation", "m3", 100, 20, 2000]);
    sheet.addRow([]);
    sheet.addRow(["Description", "Amount", "Item", "Rate", "Qty", "Unit"]);
    sheet.addRow(["Concrete", 4500, "2", 45, 100, "m3"]);
  });

  const fast = await parseBoqOoxmlWorkbook(bytes);

  assert.equal(fast.complete, true);
  assert.equal(fast.sheets[0]!.headers.length, 2);
  assert.equal(fast.sheets[0]!.items.length, 2);
  assert.equal(fast.sheets[0]!.items[1]!.description, "Concrete");
  assert.equal(fast.sheets[0]!.items[1]!.quantity, 100);
  assert.equal(fast.sheets[0]!.items[1]!.rate, 45);
  assert.equal(fast.sheets[0]!.items[1]!.amount, 4500);
});

test("OOXML fast BOQ parser preserves summary reconciliation and arithmetic ambiguity rules", async () => {
  const bytes = await workbookBytes((workbook) => {
    const summary = workbook.addWorksheet("BOQ Summary");
    summary.addRow(["Section", "Description", "Amount (USD)", "Share"]);
    summary.addRow(["A", "Civil", 2468, 1]);
    summary.addRow(["", "TOTAL", 2468, 1]);

    const priced = workbook.addWorksheet("Priced BOQ");
    priced.addRow(["Item", "Section", "Description", "Qty", "Unit", "Rate", "Amount"]);
    priced.addRow(["1", "A", "Concrete", "1,234", "m3", "2", "2468"]);
  });

  const fast = await parseBoqOoxmlWorkbook(bytes);

  assert.equal(fast.complete, true);
  assert.equal(fast.auxiliarySheets.length, 1);
  assert.equal(fast.auxiliarySheets[0]!.totalAmount, 2468);
  assert.equal(fast.sheets[0]!.items[0]!.quantity, 1234);
  assert.equal(fast.sheets[0]!.items[0]!.amount, 2468);
  assert.deepEqual(fast.diagnostics, []);
});
