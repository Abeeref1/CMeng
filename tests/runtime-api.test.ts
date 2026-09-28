import assert from "node:assert/strict";
import test from "node:test";
import {
  commercialModules,
  commercialModuleSummary,
  scheduleModules,
  scheduleModuleSummary,
} from "../packages/runtime-api/src/registry";

test("Railway runtime exposes exactly the 23 controlled Schedule modules", () => {
  assert.equal(scheduleModules.length, 23);
  assert.equal(new Set(scheduleModules.map((module) => module.key)).size, 23);
  assert.equal(scheduleModuleSummary().total, 23);
  assert.ok(scheduleModules.some((module) => module.key === "challenge-contract"));
  assert.ok(scheduleModules.some((module) => module.key === "manhour-scurve"));
  assert.ok(scheduleModules.some((module) => module.key === "quantity-scurve"));
});


test("Railway runtime exposes exactly the 7 real Commercial modules", () => {
  assert.equal(commercialModules.length, 7);
  assert.equal(new Set(commercialModules.map((module) => module.key)).size, 7);
  assert.equal(commercialModuleSummary().total, 7);
  assert.deepEqual(
    commercialModules.map((module) => module.key),
    [
      "commercial-overview",
      "cost-forecast",
      "variations-change",
      "payments",
      "cash-flow",
      "commercial-claims-notices",
      "contract-particulars-bonds",
    ],
  );
});
