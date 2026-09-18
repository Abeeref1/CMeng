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


test("repeated BOQ CSV header is not parsed as a line item", () => {
  const csv = [
    "Item,Description,Unit,Qty,Rate,Amount",
    "1,Excavation,m3,100,20,2000",
    "2,Backfill,m3,80,15,1200",
    "Item,Description,Unit,Qty,Rate,Amount",
    "3,Concrete,m3,50,100,5000",
  ].join("\n");

  const parsed = parseBoqCsv(Buffer.from(csv, "utf8"));

  assert.equal(parsed.complete, true);
  assert.equal(parsed.candidateRows, 3);
  assert.equal(parsed.verifiedRows, 3);
  assert.deepEqual(
    parsed.items.map((item) => item.itemNumber),
    ["1", "2", "3"],
  );
});

test("multiple BOQ CSV tables can remap changed column order", () => {
  const csv = [
    "Item,Description,Unit,Qty,Rate,Amount",
    "1,Excavation,m3,100,20,2000",
    "Amount,Rate,Qty,Unit,Description,Item",
    "5000,100,50,m3,Concrete,2",
  ].join("\n");

  const parsed = parseBoqCsv(Buffer.from(csv, "utf8"));

  assert.equal(parsed.complete, true);
  assert.equal(parsed.candidateRows, 2);
  assert.equal(parsed.items[1]!.itemNumber, "2");
  assert.equal(parsed.items[1]!.description, "Concrete");
  assert.equal(parsed.items[1]!.quantity, 50);
  assert.equal(parsed.items[1]!.rate, 100);
  assert.equal(parsed.items[1]!.amount, 5000);
  assert.equal(parsed.items[1]!.sourceCells.amount!.address, "R4C1");
});

test("populated BOQ CSV prefix before first table makes coverage unknown", () => {
  const csv = [
    "Project,P88",
    "Revision,R2",
    "Item,Description,Unit,Qty,Rate,Amount",
    "1,Excavation,m3,100,20,2000",
  ].join("\n");

  const parsed = parseBoqCsv(Buffer.from(csv, "utf8"));

  assert.equal(parsed.complete, false);
  assert.equal(parsed.coveragePercent, null);
  assert.ok(
    parsed.diagnostics.some((diagnostic) =>
      diagnostic.startsWith(
        "BOQ_CSV_POPULATED_PREFIX_ROWS_UNCLASSIFIED:",
      ),
    ),
  );
});
