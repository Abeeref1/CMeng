import test from "node:test";
import assert from "node:assert/strict";

import {
  buildXerCoverageReport,
  parseXerBytes,
} from "../packages/xer-parser/src";

test("every source %R row is included in the XER coverage denominator", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id",
    "%R\t1",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name",
    "%R\t100\t1\t10\tA100\tGood",
    "%R\t101\t1\t10\tA101\tBad\tembedded-tab",
    "%E",
  ].join("\n");

  const parsed = parseXerBytes(Buffer.from(source, "utf8"));
  const coverage = buildXerCoverageReport(parsed);

  assert.equal(coverage.rowsSeen, 4);
  assert.equal(coverage.rowsParsed, 3);
  assert.equal(coverage.rowsUnresolved, 1);
  assert.equal(coverage.rowCoveragePercent, 75);
  assert.equal(coverage.complete, false);

  const task = coverage.tables.find((table) => table.table === "TASK")!;
  assert.equal(task.rowsSeen, 2);
  assert.equal(task.rowsParsed, 1);
  assert.equal(task.rowsUnresolved, 1);
  assert.equal(task.coveragePercent, 50);
});

test("fully mapped well-formed XER reports 100% row coverage", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id",
    "%R\t1",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code",
    "%R\t100\t1\t10\tA100",
    "%E",
  ].join("\n");

  const coverage = buildXerCoverageReport(
    parseXerBytes(Buffer.from(source, "utf8")),
  );

  assert.equal(coverage.rowCoveragePercent, 100);
  assert.equal(coverage.rowsUnresolved, 0);
  assert.equal(coverage.complete, true);
});
