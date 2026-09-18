import assert from "node:assert/strict";
import test from "node:test";
import { scheduleModules, scheduleModuleSummary } from "../packages/runtime-api/src/registry";

test("Railway runtime exposes exactly the 22 controlled Schedule modules", () => {
  assert.equal(scheduleModules.length, 22);
  assert.equal(new Set(scheduleModules.map((module) => module.key)).size, 22);
  assert.equal(scheduleModuleSummary().total, 22);
  assert.ok(scheduleModules.some((module) => module.key === "challenge-contract"));
  assert.ok(scheduleModules.some((module) => module.key === "manhour-scurve"));
  assert.ok(scheduleModules.some((module) => module.key === "quantity-scurve"));
});
