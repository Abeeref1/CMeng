import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import { parseBoqWorkbook } from "../packages/boq-parser/src";

test("50,000 BOQ line items are all counted with 100% source-row coverage", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Priced BOQ");
  sheet.addRow(["Item No.", "Description", "Unit", "Quantity", "Rate", "Amount"]);

  for (let i = 1; i <= 50_000; i += 1) {
    const qty = (i % 100) + 1;
    const rate = ((i % 250) + 1) * 0.5;
    sheet.addRow([
      `I-${String(i).padStart(6, "0")}`,
      `BOQ line item ${i}`,
      i % 2 === 0 ? "m2" : "m3",
      qty,
      rate,
      qty * rate,
    ]);
  }

  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const parsed = await parseBoqWorkbook(bytes);

  assert.equal(parsed.candidateRows, 50_000);
  assert.equal(parsed.parsedRows, 50_000);
  assert.equal(parsed.unresolvedRows, 0);
  assert.equal(parsed.coveragePercent, 100);
  assert.equal(parsed.complete, true);
  assert.equal(parsed.sheets[0]!.items.at(-1)!.itemNumber, "I-050000");
});
