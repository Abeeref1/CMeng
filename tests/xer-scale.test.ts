import test from "node:test";
import assert from "node:assert/strict";

import {
  parseXerBytes,
  verifyXerIntegrity,
} from "../packages/xer-parser/src";

test("100,000 activities are all counted and integrity-checked without truncation", () => {
  const lines: string[] = [
    "ERMHDR\t23.12\t2026-09-18",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\t1\tSCALE100K",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\tROOT",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttotal_float_hr_cnt",
  ];

  for (let i = 1; i <= 100_000; i += 1) {
    lines.push(
      `%R\t${i}\t1\t10\tA${String(i).padStart(6, "0")}\tActivity ${i}\t${i % 400}`,
    );
  }

  lines.push("%E");

  const bytes = Buffer.from(lines.join("\n"), "utf8");
  const parsed = parseXerBytes(bytes);
  const integrity = verifyXerIntegrity(parsed);

  assert.equal(parsed.rowsUnresolved, 0);
  assert.equal(integrity.activityCount, 100_000);
  assert.equal(integrity.duplicateTaskIds.length, 0);
  assert.equal(integrity.duplicateActivityCodes.length, 0);
  assert.equal(integrity.complete, true);
});
