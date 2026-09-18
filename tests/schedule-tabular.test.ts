import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import {
  parseScheduleCsv,
  parseScheduleXlsx,
} from "../packages/schedule-tabular-parser/src";

test("schedule CSV preserves activity population and hours semantics", () => {
  const csv = [
    "Activity ID,Activity Name,WBS,Calendar,Original Duration,Remaining Duration,Total Float,Percent Complete,Status",
    "A100,Excavation,1.1,5 Day,80,40,16,50,In Progress",
    "A200,Foundation,1.2,5 Day,120,120,-8,0,Not Started",
  ].join("\n");

  const parsed = parseScheduleCsv(Buffer.from(csv, "utf8"));
  assert.equal(parsed.complete, true);
  assert.equal(parsed.activityRowsSeen, 2);
  assert.equal(parsed.activityRowsVerified, 2);
  assert.equal(parsed.activities[0]!.originalDurationHours, 80);
  assert.equal(parsed.activities[1]!.totalFloatHours, -8);
});

test("schedule CSV relationship table preserves predecessor successor type and lag", () => {
  const csv = [
    "Predecessor ID,Successor ID,Relationship Type,Lag",
    "A100,A200,FS,8",
    "A200,A300,SS,-4",
  ].join("\n");

  const parsed = parseScheduleCsv(Buffer.from(csv, "utf8"));
  assert.equal(parsed.complete, true);
  assert.equal(parsed.relationshipRowsSeen, 2);
  assert.equal(parsed.relationships[0]!.lagHours, 8);
  assert.equal(parsed.relationships[1]!.lagHours, -4);
});

test("missing activity ID remains unresolved instead of disappearing", () => {
  const csv = [
    "Activity ID,Activity Name,Original Duration",
    "A100,Good,8",
    ",Missing ID,16",
  ].join("\n");

  const parsed = parseScheduleCsv(Buffer.from(csv, "utf8"));
  assert.equal(parsed.activityRowsSeen, 2);
  assert.equal(parsed.activityRowsUnresolved, 1);
  assert.equal(parsed.coveragePercent, 50);
  assert.equal(parsed.complete, false);
});

test("schedule XLSX recognizes separate activities and relationships sheets", async () => {
  const workbook = new ExcelJS.Workbook();
  const activities = workbook.addWorksheet("Activities");
  activities.addRow(["Activity ID","Activity Name","WBS","Original Duration","Total Float"]);
  activities.addRow(["A100","Excavation","1.1",80,0]);
  activities.addRow(["A200","Foundation","1.2",120,16]);

  const rel = workbook.addWorksheet("Relationships");
  rel.addRow(["Predecessor ID","Successor ID","Relationship Type","Lag"]);
  rel.addRow(["A100","A200","FS",0]);

  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const parsed = await parseScheduleXlsx(bytes);

  assert.equal(parsed.complete, true);
  assert.equal(parsed.activityRowsSeen, 2);
  assert.equal(parsed.relationshipRowsSeen, 1);
  assert.equal(parsed.coveragePercent, 100);
});

test("populated unclassified schedule sheet prevents complete status", async () => {
  const workbook = new ExcelJS.Workbook();
  const cover = workbook.addWorksheet("Cover");
  cover.addRow(["Project","P88"]);
  cover.addRow(["Revision","R2"]);
  cover.addRow(["Data Date","2026-08-31"]);

  const activities = workbook.addWorksheet("Activities");
  activities.addRow(["Activity ID","Activity Name","Original Duration"]);
  activities.addRow(["A100","Excavation",80]);

  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const parsed = await parseScheduleXlsx(bytes);
  assert.equal(parsed.complete, false);
  assert.ok(parsed.diagnostics.some(d=>d.includes("Cover:SCHEDULE_POPULATED_SHEET_UNCLASSIFIED")));
});
