import test from "node:test";
import assert from "node:assert/strict";

import { parseBoqCsv } from "../packages/boq-csv-parser/src";

test("BOQ CSV preserves quoted descriptions and arithmetic", () => {
  const csv = [
    "Item No.,Description,Unit,Quantity,Rate,Amount",
    '1,"Concrete, including pump",m3,125,450,56250',
    '2,"Blockwork",m2,200,75,15000',
  ].join("\n");

  const parsed = parseBoqCsv(Buffer.from(csv, "utf8"));
  assert.equal(parsed.complete, true);
  assert.equal(parsed.candidateRows, 2);
  assert.equal(parsed.coveragePercent, 100);
  assert.equal(parsed.items[0]!.description, "Concrete, including pump");
  assert.equal(parsed.items[0]!.sourceCells.amount!.address, "R2C6");
});

test("Arabic semicolon-delimited BOQ CSV parses", () => {
  const csv = [
    "رقم البند;وصف البند;الوحدة;الكمية;سعر الوحدة;الإجمالي",
    "1;أعمال الحفر;م3;1000;25.5;25500",
  ].join("\n");

  const parsed = parseBoqCsv(Buffer.from(csv, "utf8"));
  assert.equal(parsed.complete, true);
  assert.equal(parsed.items[0]!.description, "أعمال الحفر");
  assert.equal(parsed.items[0]!.amount, 25500);
});

test("BOQ CSV arithmetic mismatch blocks certification", () => {
  const csv = [
    "Item,Description,Unit,Qty,Rate,Amount",
    "1,Steel,kg,1000,3.5,3600",
  ].join("\n");

  const parsed = parseBoqCsv(Buffer.from(csv, "utf8"));
  assert.equal(parsed.complete, false);
  assert.equal(parsed.unresolvedRows, 1);
  assert.ok(parsed.items[0]!.diagnosticCodes.includes("BOQ_AMOUNT_ARITHMETIC_MISMATCH"));
});

test("ambiguous BOQ CSV numeric field is unresolved", () => {
  const csv = [
    "Item,Description,Unit,Qty,Rate,Amount",
    '1,Steel,kg,"1,234",3.5,4319',
  ].join("\n");

  const parsed = parseBoqCsv(Buffer.from(csv, "utf8"));
  assert.equal(parsed.complete, false);
  assert.ok(parsed.items[0]!.diagnosticCodes.includes("BOQ_QUANTITY_AMBIGUOUS"));
});
