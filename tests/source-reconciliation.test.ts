import test from "node:test";
import assert from "node:assert/strict";

import {
  reconcileBoqs,
  reconcileSchedules,
  type BoqCanonicalItem,
  type ScheduleCanonicalActivity,
} from "../packages/source-reconciliation/src";

function activity(
  activityId: string,
  overrides: Partial<ScheduleCanonicalActivity> = {},
): ScheduleCanonicalActivity {
  return {
    source: overrides.source ?? "test",
    projectId: overrides.projectId ?? "P88",
    activityId,
    name: overrides.name ?? activityId,
    wbsRef: overrides.wbsRef ?? "1.1",
    calendarRef: overrides.calendarRef ?? "5D",
    startIso: overrides.startIso ?? "2026-01-01",
    finishIso: overrides.finishIso ?? "2026-01-02",
    originalDurationHours:
      overrides.originalDurationHours ?? 8,
    remainingDurationHours:
      overrides.remainingDurationHours ?? 8,
    totalFloatHours: overrides.totalFloatHours ?? 0,
  };
}

function boq(
  itemNumber: string,
  overrides: Partial<BoqCanonicalItem> = {},
): BoqCanonicalItem {
  return {
    source: overrides.source ?? "test",
    itemNumber,
    description: overrides.description ?? "Item " + itemNumber,
    unit: overrides.unit ?? "m3",
    quantity: overrides.quantity ?? 10,
    rate: overrides.rate ?? 20,
    amount: overrides.amount ?? 200,
  };
}

test("schedule reconciliation exposes unmatched activities instead of hiding them", () => {
  const left = [
    activity("A100"),
    activity("A200"),
    activity("A300"),
  ];
  const right = [
    activity("A100"),
    activity("A200"),
    activity("A400"),
  ];

  const result = reconcileSchedules(
    left,
    right,
    "XER",
    "XML",
  );

  assert.equal(result.matchedCount, 2);
  assert.deepEqual(result.leftOnlyKeys, ["P88::A300"]);
  assert.deepEqual(result.rightOnlyKeys, ["P88::A400"]);
  assert.equal(result.populationCoveragePercent, 66.6667);
  assert.equal(result.completeMatch, false);
});

test("schedule reconciliation detects value drift on a matched activity", () => {
  const result = reconcileSchedules(
    [activity("A100", { totalFloatHours: 0 })],
    [activity("A100", { totalFloatHours: -8 })],
    "XER",
    "XLSX",
  );

  assert.equal(result.matchedCount, 1);
  assert.equal(result.mismatches.length, 1);
  assert.deepEqual(result.mismatches[0], {
    key: "P88::A100",
    field: "totalFloatHours",
    left: 0,
    right: -8,
  });
  assert.equal(result.completeMatch, false);
});

test("duplicate schedule stable keys make reconciliation non-authoritative", () => {
  const result = reconcileSchedules(
    [activity("A100"), activity("A100")],
    [activity("A100")],
    "XER",
    "XML",
  );

  assert.equal(result.authoritative, false);
  assert.deepEqual(result.duplicateLeftKeys, ["P88::A100"]);
});

test("BOQ reconciliation detects amount drift even when populations match", () => {
  const result = reconcileBoqs(
    [boq("1.1", { amount: 200 })],
    [boq("1.1", { amount: 250 })],
    "XLSX",
    "PDF",
  );

  assert.equal(result.matchedCount, 1);
  assert.equal(result.mismatches.length, 1);
  assert.equal(result.mismatches[0]!.field, "amount");
  assert.equal(result.completeMatch, false);
});

test("BOQ reconciliation detects duplicate item numbers as non-authoritative", () => {
  const result = reconcileBoqs(
    [boq("1.1"), boq("1.1")],
    [boq("1.1")],
    "XLSX",
    "CSV",
  );

  assert.equal(result.authoritative, false);
  assert.deepEqual(result.duplicateLeftKeys, ["1.1"]);
});

test("BOQ text normalization tolerates whitespace/case but not numeric changes", () => {
  const result = reconcileBoqs(
    [
      boq("1.1", {
        description: "Concrete Works",
        unit: "M3",
      }),
    ],
    [
      boq("1.1", {
        description: " concrete   works ",
        unit: "m3",
      }),
    ],
    "XLSX",
    "CSV",
  );

  assert.equal(result.mismatches.length, 0);
  assert.equal(result.completeMatch, true);
});
