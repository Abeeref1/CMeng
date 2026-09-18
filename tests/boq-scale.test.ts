import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import ExcelJS from "exceljs";

import {
  parseBoqOoxmlWorkbook,
} from "../packages/boq-parser/src";

const MAX_BOQ_SEMANTIC_PARSE_MS = 60_000;

test("50,000 BOQ line items are all counted with 100% source-row coverage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cmeng-boq-"));
  const filename = join(dir, "boq-50000.xlsx");

  try {
    const totalStarted = performance.now();
    const workbookStarted = performance.now();
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename,
      useStyles: false,
      useSharedStrings: false,
    });
    const sheet = workbook.addWorksheet("Priced BOQ");

    sheet
      .addRow(["Item No.", "Description", "Unit", "Quantity", "Rate", "Amount"])
      .commit();

    for (let i = 1; i <= 50_000; i += 1) {
      const qty = (i % 100) + 1;
      const rate = ((i % 250) + 1) * 0.5;
      sheet
        .addRow([
          `I-${String(i).padStart(6, "0")}`,
          `BOQ line item ${i}`,
          i % 2 === 0 ? "m2" : "m3",
          qty,
          rate,
          qty * rate,
        ])
        .commit();
    }

    await workbook.commit();
    const workbookMs = performance.now() - workbookStarted;
    console.info(
      "[scale] BOQ workbook generation completed in " +
        workbookMs.toFixed(2) +
        " ms",
    );

    const readStarted = performance.now();
    const bytes = await readFile(filename);
    const readMs = performance.now() - readStarted;
    console.info(
      "[scale] BOQ workbook read completed in " +
        readMs.toFixed(2) +
        " ms; bytes=" +
        bytes.length,
    );

    const parseStarted = performance.now();
    const parsed = await parseBoqOoxmlWorkbook(bytes);
    const parseMs = performance.now() - parseStarted;
    console.info(
      "[scale] BOQ semantic parse completed in " +
        parseMs.toFixed(2) +
        " ms",
    );

    assert.ok(
      parseMs < MAX_BOQ_SEMANTIC_PARSE_MS,
      "BOQ 50k semantic parse exceeded " +
        MAX_BOQ_SEMANTIC_PARSE_MS +
        " ms ceiling: " +
        parseMs.toFixed(2) +
        " ms",
    );
    console.info(
      "[scale] BOQ total scale case completed in " +
        (performance.now() - totalStarted).toFixed(2) +
        " ms",
    );

    assert.equal(parsed.candidateRows, 50_000);
    assert.equal(parsed.parsedRows, 50_000);
    assert.equal(parsed.unresolvedRows, 0);
    assert.equal(parsed.coveragePercent, 100);
    assert.equal(parsed.complete, true);
    assert.equal(parsed.sheets[0]!.items.at(-1)!.itemNumber, "I-050000");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
