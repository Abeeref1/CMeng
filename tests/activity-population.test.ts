import test from "node:test";
import assert from "node:assert/strict";

import { reconcileActivityPopulation } from "../packages/schedule-source-integrity/src/activity-population";

test("10,000 of 10,800 activities produces explicit 800 unmatched coverage", () => {
  const baseline = Array.from({ length: 10_000 }, (_, i) => `A${i + 1}`);
  const current = Array.from({ length: 10_800 }, (_, i) => `A${i + 1}`);

  const result = reconcileActivityPopulation({
    baselineStableIds: baseline,
    currentStableIds: current,
  });

  assert.equal(result.baselineCount, 10_000);
  assert.equal(result.currentCount, 10_800);
  assert.equal(result.matchedCount, 10_000);
  assert.equal(result.currentOnlyCount, 800);
  assert.equal(result.baselineOnlyCount, 0);
  assert.equal(result.coveragePercentOfCurrent, 92.5926);
  assert.equal(result.currentOnlyIds[0], "A10001");
  assert.equal(result.currentOnlyIds.at(-1), "A10800");
  assert.equal(result.authoritative, true);
});

test("duplicate stable IDs make reconciliation non-authoritative", () => {
  const result = reconcileActivityPopulation({
    baselineStableIds: ["A1", "A2"],
    currentStableIds: ["A1", "A1", "A2"],
  });

  assert.equal(result.authoritative, false);
  assert.deepEqual(result.duplicateCurrentIds, ["A1"]);
  assert.match(result.reasons.join("\n"), /duplicate stable ID/);
});

test("blank stable IDs are not silently treated as valid activities", () => {
  const result = reconcileActivityPopulation({
    baselineStableIds: ["A1", "A2"],
    currentStableIds: ["A1", "  ", "A2"],
  });

  assert.equal(result.authoritative, false);
  assert.match(result.reasons.join("\n"), /blank stable ID/);
});
