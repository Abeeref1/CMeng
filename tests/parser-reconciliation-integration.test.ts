import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import { parseXerBytes } from "../packages/xer-parser/src";
import { parsePrimaveraXml } from "../packages/primavera-xml-parser/src";
import { parseBoqWorkbook } from "../packages/boq-parser/src";
import { parseBoqCsv } from "../packages/boq-csv-parser/src";
import {
  boqItemsFromCsv,
  boqItemsFromXlsx,
  reconcileBoqs,
  reconcileSchedules,
  scheduleActivitiesFromPrimaveraXml,
  scheduleActivitiesFromXer,
} from "../packages/source-reconciliation/src";

test("actual XER and Primavera XML parser outputs reconcile on the same activity", () => {
  const xer = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\t1\tP88",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\t1.1",
    "%T\tCALENDAR",
    "%F\tclndr_id\tclndr_name\tclndr_data",
    "%R\t77\t5 Day\t(0||CalendarData())",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt",
    "%R\t100\t1\t10\t77\tA100\tExcavation\t2026-01-01\t2026-01-02\t8\t8\t0",
    "%E",
  ].join("\n");

  const xml = `
  <APIBusinessObjects>
    <Project><ObjectId>900</ObjectId><Id>P88</Id></Project>
    <WBS><ObjectId>10</ObjectId><ProjectObjectId>900</ProjectObjectId></WBS>
    <Calendar><ObjectId>77</ObjectId><Name>5 Day</Name></Calendar>
    <Activity>
      <ProjectObjectId>900</ProjectObjectId>
      <ObjectId>100</ObjectId>
      <Id>A100</Id>
      <Name>Excavation</Name>
      <WBSObjectId>10</WBSObjectId>
      <CalendarObjectId>77</CalendarObjectId>
      <StartDate>2026-01-01</StartDate>
      <FinishDate>2026-01-02</FinishDate>
      <OriginalDuration>28800000</OriginalDuration>
      <RemainingDuration>28800000</RemainingDuration>
      <TotalFloat>0</TotalFloat>
    </Activity>
  </APIBusinessObjects>`;

  const xerCanonical = scheduleActivitiesFromXer(
    parseXerBytes(Buffer.from(xer, "utf8")),
    { source: "XER", projectIdOverride: "P88" },
  );
  const xmlCanonical = scheduleActivitiesFromPrimaveraXml(
    parsePrimaveraXml(Buffer.from(xml, "utf8")),
    { source: "XML", projectIdOverride: "P88" },
  );

  assert.deepEqual(xerCanonical.diagnostics, []);
  assert.deepEqual(xmlCanonical.diagnostics, []);

  const result = reconcileSchedules(
    xerCanonical.items,
    xmlCanonical.items,
    "XER",
    "XML",
  );

  assert.equal(result.completeMatch, true);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.mismatches.length, 0);
});

test("actual XER/XML reconciliation exposes a total-float disagreement", () => {
  const xer = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id",
    "%R\t1",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttotal_float_hr_cnt",
    "%R\t100\t1\t10\tA100\tExcavation\t0",
    "%E",
  ].join("\n");

  const xml = `
  <APIBusinessObjects>
    <Project><ObjectId>900</ObjectId><Id>P88</Id></Project>
    <Activity>
      <ProjectObjectId>900</ProjectObjectId>
      <ObjectId>100</ObjectId>
      <Id>A100</Id>
      <Name>Excavation</Name>
      <TotalFloat>-28800000</TotalFloat>
    </Activity>
  </APIBusinessObjects>`;

  const left = scheduleActivitiesFromXer(
    parseXerBytes(Buffer.from(xer, "utf8")),
    { source: "XER", projectIdOverride: "P88" },
  );
  const right = scheduleActivitiesFromPrimaveraXml(
    parsePrimaveraXml(Buffer.from(xml, "utf8")),
    { source: "XML", projectIdOverride: "P88" },
  );

  const result = reconcileSchedules(
    left.items,
    right.items,
    "XER",
    "XML",
  );

  assert.equal(result.completeMatch, false);
  assert.ok(
    result.mismatches.some(
      (mismatch) =>
        mismatch.field === "totalFloatHours" &&
        mismatch.left === 0 &&
        mismatch.right === -8,
    ),
  );
});

test("actual XLSX and CSV BOQ parser outputs reconcile", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("BOQ");
  sheet.addRow([
    "Item",
    "Description",
    "Unit",
    "Qty",
    "Rate",
    "Amount",
  ]);
  sheet.addRow(["1.1", "Concrete Works", "m3", 10, 20, 200]);

  const xlsx = await parseBoqWorkbook(
    Buffer.from(await workbook.xlsx.writeBuffer()),
  );

  const csv = parseBoqCsv(
    Buffer.from(
      [
        "Item,Description,Unit,Qty,Rate,Amount",
        "1.1, concrete   works ,M3,10,20,200",
      ].join("\n"),
      "utf8",
    ),
  );

  const left = boqItemsFromXlsx(xlsx, "XLSX");
  const right = boqItemsFromCsv(csv, "CSV");

  assert.deepEqual(left.diagnostics, []);
  assert.deepEqual(right.diagnostics, []);

  const result = reconcileBoqs(
    left.items,
    right.items,
    "XLSX",
    "CSV",
  );

  assert.equal(result.completeMatch, true);
  assert.equal(result.matchedCount, 1);
});

test("actual XLSX/CSV BOQ reconciliation exposes quantity drift", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("BOQ");
  sheet.addRow([
    "Item",
    "Description",
    "Unit",
    "Qty",
    "Rate",
    "Amount",
  ]);
  sheet.addRow(["1.1", "Concrete", "m3", 10, 20, 200]);

  const xlsx = await parseBoqWorkbook(
    Buffer.from(await workbook.xlsx.writeBuffer()),
  );
  const csv = parseBoqCsv(
    Buffer.from(
      [
        "Item,Description,Unit,Qty,Rate,Amount",
        "1.1,Concrete,m3,11,20,220",
      ].join("\n"),
      "utf8",
    ),
  );

  const result = reconcileBoqs(
    boqItemsFromXlsx(xlsx).items,
    boqItemsFromCsv(csv).items,
    "XLSX",
    "CSV",
  );

  assert.equal(result.completeMatch, false);
  assert.ok(
    result.mismatches.some(
      (mismatch) =>
        mismatch.field === "quantity" &&
        mismatch.left === 10 &&
        mismatch.right === 11,
    ),
  );
});
