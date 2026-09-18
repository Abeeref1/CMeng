import test from "node:test";
import assert from "node:assert/strict";

import { parseCsv } from "../packages/tabular-parser/src";

test("CSV parser preserves commas, tabs and newlines inside quoted fields", () => {
  const source =
    '\uFEFFItem,Description,Qty\r\n' +
    '1,"Concrete, including pump",10\r\n' +
    '2,"Multi-line\ndescription",20\r\n' +
    '3,"Quoted ""word""",30\r\n';

  const parsed = parseCsv(Buffer.from(source, "utf8"));
  assert.equal(parsed.delimiter, ",");
  assert.equal(parsed.rows.length, 4);
  assert.equal(parsed.rows[1]!.cells[1], "Concrete, including pump");
  assert.equal(parsed.rows[2]!.cells[1], "Multi-line\ndescription");
  assert.equal(parsed.rows[3]!.cells[1], 'Quoted "word"');
});

test("CSV parser detects tab delimiter without corrupting quoted text", () => {
  const source = "Activity ID\tName\tDuration\nA1\t\"Name with, comma\"\t8";
  const parsed = parseCsv(Buffer.from(source, "utf8"));
  assert.equal(parsed.delimiter, "\t");
  assert.deepEqual(parsed.rows[1]!.cells, ["A1", "Name with, comma", "8"]);
});

test("unterminated quote is a hard diagnostic", () => {
  const parsed = parseCsv(Buffer.from('A,B\n1,"broken', "utf8"));
  assert.ok(parsed.diagnostics.includes("CSV_UNTERMINATED_QUOTED_FIELD"));
});
