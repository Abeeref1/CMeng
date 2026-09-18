import test from "node:test";
import assert from "node:assert/strict";
import iconv from "iconv-lite";

import {
  decodeXerBytes,
  parseXerBytes,
  parseXerDateStrict,
  verifyXerIntegrity,
  xerFieldSemantic,
} from "../packages/xer-parser/src";

function utf8(value: string): Uint8Array {
  return Buffer.from(value, "utf8");
}

function validCoreXer(taskRows: string[], extras: string[] = []): string {
  return [
    "ERMHDR\t23.12\t2026-09-18",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\t1\tP88",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\tROOT",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name",
    ...taskRows,
    ...extras,
    "%E",
  ].join("\n");
}

test("UTF-8 Arabic activity names survive exactly", () => {
  const source = validCoreXer([
    "%R\t100\t1\t10\tA100\tتنفيذ الأعمال المدنية",
  ]);
  const parsed = parseXerBytes(utf8(source));
  const row = parsed.tables.get("TASK")!.rows[0]!;
  assert.equal(row.data!.task_name, "تنفيذ الأعمال المدنية");
  assert.equal(parsed.encoding, "utf8");
});

test("Windows-1256 Arabic is decoded without mojibake", () => {
  const source = validCoreXer([
    "%R\t100\t1\t10\tA100\tتنفيذ الأعمال المدنية",
  ]);
  const bytes = iconv.encode(source, "windows-1256");
  const parsed = parseXerBytes(bytes);
  const row = parsed.tables.get("TASK")!.rows[0]!;
  assert.equal(row.data!.task_name, "تنفيذ الأعمال المدنية");
  assert.ok(
    parsed.encoding === "windows-1256" ||
      parsed.encoding === "mixed-utf8-windows1256",
  );
});

test("UTF-16LE BOM is detected and removed from the header", () => {
  const source = validCoreXer(["%R\t100\t1\t10\tA100\tActivity"]);
  const bytes = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    iconv.encode(source, "utf16-le"),
  ]);
  const parsed = parseXerBytes(bytes);
  assert.equal(parsed.encoding, "utf16le");
  assert.equal(parsed.header!.tokens[0], "ERMHDR");
  assert.equal(parsed.tables.get("TASK")!.rows.length, 1);
});

test("UTF-8 BOM does not become a garbage record", () => {
  const source = validCoreXer(["%R\t100\t1\t10\tA100\tActivity"]);
  const bytes = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(source, "utf8"),
  ]);
  const parsed = parseXerBytes(bytes);
  assert.equal(parsed.header!.tokens[0], "ERMHDR");
  assert.equal(parsed.diagnostics.some((d) => d.code === "XER_UNKNOWN_NON_RECORD_LINE"), false);
});

test("table order is irrelevant to relationship resolution", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tTASKPRED",
    "%F\ttask_pred_id\tproj_id\ttask_id\tpred_task_id\tlag_hr_cnt",
    "%R\t900\t1\t101\t100\t8",
    "%T\tPROJECT",
    "%F\tproj_id",
    "%R\t1",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name",
    "%R\t100\t1\t10\tA100\tFirst",
    "%R\t101\t1\t10\tA101\tSecond",
    "%E",
  ].join("\n");

  const integrity = verifyXerIntegrity(parseXerBytes(utf8(source)));
  assert.equal(integrity.complete, true);
  assert.equal(integrity.relationshipCount, 1);
});

test("field count and order come from %F, not a hard-coded P6 version", () => {
  const source = [
    "ERMHDR\t8.3",
    "%T\tPROJECT",
    "%F\tproj_id",
    "%R\t1",
    "%T\tPROJWBS",
    "%F\tproj_id\twbs_id",
    "%R\t1\t10",
    "%T\tTASK",
    "%F\ttask_name\ttask_code\twbs_id\tproj_id\ttask_id\tnew_future_field",
    "%R\tActivity\tA100\t10\t1\t100\tfuture-value",
    "%E",
  ].join("\n");

  const row = parseXerBytes(utf8(source)).tables.get("TASK")!.rows[0]!;
  assert.deepEqual(row.data, {
    task_name: "Activity",
    task_code: "A100",
    wbs_id: "10",
    proj_id: "1",
    task_id: "100",
    new_future_field: "future-value",
  });
});

test("missing optional RSRC TASKRSRC and UDFVALUE tables do not crash", () => {
  const integrity = verifyXerIntegrity(
    parseXerBytes(
      utf8(validCoreXer(["%R\t100\t1\t10\tA100\tActivity"])),
    ),
  );
  assert.equal(integrity.complete, true);
});

test("calendar references are validated after the full file is read", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id",
    "%R\t1",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code",
    "%R\t100\t1\t10\t77\tA100",
    "%T\tCALENDAR",
    "%F\tclndr_id\tclndr_name\tclndr_data",
    "%R\t77\tProject Calendar\t(0||CalendarData())",
    "%E",
  ].join("\n");

  const integrity = verifyXerIntegrity(parseXerBytes(utf8(source)));
  assert.equal(integrity.complete, true);
  assert.equal(integrity.calendarCount, 1);
});

test("missing referenced calendar fails integrity instead of inventing one", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id",
    "%R\t1",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code",
    "%R\t100\t1\t10\t77\tA100",
    "%E",
  ].join("\n");

  const integrity = verifyXerIntegrity(parseXerBytes(utf8(source)));
  assert.equal(integrity.complete, false);
  assert.deepEqual(integrity.missingCalendarIds, ["77"]);
});

test("ambiguous slash dates are never guessed", () => {
  const ambiguous = parseXerDateStrict("03/04/2026");
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.iso, null);
  assert.equal(ambiguous.candidates.length, 2);

  const dmy = parseXerDateStrict("31/08/2026");
  assert.equal(dmy.status, "valid");
  assert.equal(dmy.iso, "2026-08-31");

  const mdy = parseXerDateStrict("08/31/2026");
  assert.equal(mdy.status, "valid");
  assert.equal(mdy.iso, "2026-08-31");
});

test("duplicate internal task IDs are explicit integrity failures", () => {
  const source = validCoreXer([
    "%R\t100\t1\t10\tA100\tFirst",
    "%R\t100\t1\t10\tA101\tSecond",
  ]);
  const integrity = verifyXerIntegrity(parseXerBytes(utf8(source)));
  assert.equal(integrity.complete, false);
  assert.deepEqual(integrity.duplicateTaskIds, ["1::100"]);
});

test("duplicate project/activity codes are explicit integrity failures", () => {
  const source = validCoreXer([
    "%R\t100\t1\t10\tA100\tFirst",
    "%R\t101\t1\t10\tA100\tSecond",
  ]);
  const integrity = verifyXerIntegrity(parseXerBytes(utf8(source)));
  assert.equal(integrity.complete, false);
  assert.deepEqual(integrity.duplicateActivityCodes, ["1::A100"]);
});

test("truncated XER without %E can never be complete", () => {
  const source = validCoreXer([
    "%R\t100\t1\t10\tA100\tActivity",
  ]).replace(/\n%E$/, "");
  const parsed = parseXerBytes(utf8(source));
  const integrity = verifyXerIntegrity(parsed);
  assert.equal(parsed.endMarkerSeen, false);
  assert.equal(integrity.truncated, true);
  assert.equal(integrity.complete, false);
});

test("embedded tab or any field-count shift is unresolved, never positionally guessed", () => {
  const source = validCoreXer([
    "%R\t100\t1\t10\tA100\tActivity with\tembedded tab",
  ]);
  const parsed = parseXerBytes(utf8(source));
  const task = parsed.tables.get("TASK")!.rows[0]!;
  assert.equal(task.status, "unresolved");
  assert.equal(task.data, null);
  assert.ok(task.diagnosticCodes.includes("XER_FIELD_COUNT_MISMATCH"));

  const integrity = verifyXerIntegrity(parsed);
  assert.equal(integrity.complete, false);
  assert.equal(integrity.unresolvedRows, 1);
});

test("broken predecessor references are reported, not dropped", () => {
  const source = validCoreXer(
    ["%R\t100\t1\t10\tA100\tActivity"],
    [
      "%T\tTASKPRED",
      "%F\ttask_pred_id\tproj_id\ttask_id\tpred_task_id\tlag_hr_cnt",
      "%R\t900\t1\t100\t999\t8",
    ],
  );
  const integrity = verifyXerIntegrity(parseXerBytes(utf8(source)));
  assert.equal(integrity.complete, false);
  assert.deepEqual(integrity.missingPredecessorTaskIds, ["1::999"]);
});

test("known P6 hour fields retain hour semantics", () => {
  assert.equal(xerFieldSemantic("total_float_hr_cnt"), "hours");
  assert.equal(xerFieldSemantic("lag_hr_cnt"), "hours");
  assert.equal(xerFieldSemantic("lag_hr_cnt_elapsed"), "hours");
  assert.equal(xerFieldSemantic("day_hr_cnt"), "hours_per_day");
});

test("mixed UTF-8 and Windows-1256 lines preserve Arabic", () => {
  const lines = [
    Buffer.from("ERMHDR\t23.12\n", "utf8"),
    Buffer.from("%T\tPROJECT\n%F\tproj_id\n%R\t1\n", "utf8"),
    Buffer.from("%T\tPROJWBS\n%F\twbs_id\tproj_id\n%R\t10\t1\n", "utf8"),
    Buffer.from("%T\tTASK\n%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\n", "utf8"),
    iconv.encode("%R\t100\t1\t10\tA100\tأعمال عربية\n", "windows-1256"),
    Buffer.from("%E", "utf8"),
  ];
  const bytes = Buffer.concat(lines);
  const decoded = decodeXerBytes(bytes);
  assert.equal(decoded.encoding, "mixed-utf8-windows1256");

  const parsed = parseXerBytes(bytes);
  assert.equal(parsed.tables.get("TASK")!.rows[0]!.data!.task_name, "أعمال عربية");
});
