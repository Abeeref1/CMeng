import test from "node:test";
import assert from "node:assert/strict";

import {
  assessAiRowRepair,
  type XerRow,
} from "../packages/xer-parser/src";

test("AI cannot make an unresolved row authoritative by confidence alone", () => {
  const row: XerRow = {
    table: "TASK",
    line: 42,
    fields: ["task_id", "task_code", "task_name"],
    rawValues: ["100", "A100", "name", "with-tab"],
    rawLine: "%R\t100\tA100\tname\twith-tab",
    status: "unresolved",
    data: null,
    diagnosticCodes: ["XER_FIELD_COUNT_MISMATCH"],
  };

  const result = assessAiRowRepair(row, {
    table: "TASK",
    line: 42,
    reconstructedValues: ["100", "A100", "name with-tab"],
    explanation: "Likely embedded delimiter in activity name",
    confidence: 0.9999,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.status, "suggested");
  assert.notEqual(result.status, "deterministically_confirmed");
});
