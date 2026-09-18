import test from "node:test";
import assert from "node:assert/strict";

import {
  inferDurationUnitFromHeader,
  parseScheduleDate,
  parseScheduleDuration,
} from "../packages/schedule-values/src";

test("generic duration number without proven unit is ambiguous", () => {
  const parsed = parseScheduleDuration("10");
  assert.equal(parsed.status, "ambiguous");
  assert.equal(parsed.hours, null);
});

test("explicit hours normalize while days remain calendar-dependent", () => {
  const hours = parseScheduleDuration("10h");
  assert.equal(hours.status, "valid");
  assert.equal(hours.hours, 10);

  const days = parseScheduleDuration("10d");
  assert.equal(days.status, "valid");
  assert.equal(days.unit, "days");
  assert.equal(days.hours, null);
});

test("header unit and value suffix conflict is explicit", () => {
  const parsed = parseScheduleDuration("10d", "hours");
  assert.equal(parsed.status, "ambiguous");
  assert.equal(parsed.hours, null);
});

test("schedule headers prove common duration units", () => {
  assert.equal(inferDurationUnitFromHeader("Total Float (h)"), "hours");
  assert.equal(inferDurationUnitFromHeader("lag_hr_cnt"), "hours");
  assert.equal(inferDurationUnitFromHeader("Original Duration (days)"), "days");
  assert.equal(inferDurationUnitFromHeader("Original Duration"), "unknown");
});

test("ambiguous numeric dates remain ambiguous while month-name dates are deterministic", () => {
  assert.equal(parseScheduleDate("03/04/2026").status, "ambiguous");
  assert.equal(parseScheduleDate("31-Aug-2026").iso, "2026-08-31");
  assert.equal(parseScheduleDate("Aug 31 2026").iso, "2026-08-31");
});
