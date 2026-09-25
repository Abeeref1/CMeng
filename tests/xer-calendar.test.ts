import test from "node:test";
import assert from "node:assert/strict";

import {
  parseP6CalendarData,
  parseXerBytes,
  verifyXerCalendars,
  verifyXerIntegrity,
} from "../packages/xer-parser/src";
import {
  canonicalScheduleFromXer,
} from "../packages/schedule-analysis-core/src";

const fiveDay =
  "(0||CalendarData()(" +
    "(0||DaysOfWeek()(" +
      "(0||1()())" +
      "(0||2()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))" +
      "(0||3()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))" +
      "(0||4()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))" +
      "(0||5()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))" +
      "(0||6()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))" +
      "(0||7()())" +
    "))" +
    "(0||Exceptions()(" +
      "(0||0(d|45292)())" +
      "(0||1(d|45293)((0||0(s|09:00|f|13:00)())))" +
    "))" +
  "))";

test("P6 calendar structured text preserves split shifts and exceptions", () => {
  const parsed = parseP6CalendarData(fiveDay);
  assert.equal(parsed.status, "valid");
  assert.equal(parsed.days.length, 7);

  const mondayLikeIndex2 = parsed.days.find((day) => day.dayIndex === 2)!;
  assert.equal(mondayLikeIndex2.intervals.length, 2);
  assert.equal(mondayLikeIndex2.workMinutes, 480);
  assert.deepEqual(
    mondayLikeIndex2.intervals.map((x) => [x.start, x.finish]),
    [["08:00", "12:00"], ["13:00", "17:00"]],
  );

  assert.equal(parsed.exceptions.length, 2);
  assert.equal(parsed.exceptions[0]!.serialDay, 45292);
  assert.equal(parsed.exceptions[0]!.isoDate, "2024-01-01");
  assert.equal(parsed.exceptions[0]!.nonWorking, true);
  assert.equal(parsed.exceptions[1]!.nonWorking, false);
  assert.equal(parsed.exceptions[1]!.intervals[0]!.minutes, 240);
});

test("overlapping calendar work intervals invalidate semantic certification", () => {
  const bad =
    "(0||CalendarData()((0||DaysOfWeek()(" +
      "(0||1()((0||0(s|08:00|f|12:00)())(0||1(s|11:00|f|15:00)())))" +
    "))(0||Exceptions()())))";

  const parsed = parseP6CalendarData(bad);
  assert.equal(parsed.status, "invalid");
  assert.ok(parsed.diagnostics.some((d) => d.startsWith("CALENDAR_INTERVAL_OVERLAP")));
});

test("malformed clndr_data blocks XER source certification", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id",
    "%R\t1",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tCALENDAR",
    "%F\tclndr_id\tclndr_name\tclndr_data",
    "%R\t77\tBroken\t(0||CalendarData()((BROKEN)",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code",
    "%R\t100\t1\t10\t77\tA100",
    "%E",
  ].join("\n");

  const integrity = verifyXerIntegrity(parseXerBytes(Buffer.from(source, "utf8")));
  assert.equal(integrity.calendarSemanticComplete, false);
  assert.equal(integrity.sourceComplete, false);
  assert.equal(integrity.complete, false);
});

test("calendar inheritance cycle is explicit and cannot certify", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id",
    "%R\t1",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tCALENDAR",
    "%F\tclndr_id\tbase_clndr_id\tclndr_name\tclndr_data",
    "%R\t1\t2\tOne\t(0||CalendarData())",
    "%R\t2\t1\tTwo\t(0||CalendarData())",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code",
    "%R\t100\t1\t10\t1\tA100",
    "%E",
  ].join("\n");

  const parsed = parseXerBytes(Buffer.from(source, "utf8"));
  const calendarIntegrity = verifyXerCalendars(parsed);
  assert.equal(calendarIntegrity.complete, false);
  assert.equal(calendarIntegrity.inheritanceCycles.length, 1);

  const integrity = verifyXerIntegrity(parsed);
  assert.equal(integrity.complete, false);
  assert.equal(integrity.unresolvedCalendars, 2);
});


test("human-readable six-day calendar is parsed and reconciled", () => {
  const parsed = parseP6CalendarData(
    "Sat-Thu 07:00-17:00",
  );

  assert.equal(parsed.status, "valid");
  assert.equal(parsed.days.length, 7);
  assert.equal(
    parsed.days.reduce(
      (sum, day) => sum + day.workMinutes,
      0,
    ),
    60 * 60,
  );
  assert.equal(
    parsed.days.find((day) => day.dayIndex === 6)!
      .workMinutes,
    0,
  );
});

test("human-readable overnight calendar preserves eight working hours", () => {
  const parsed = parseP6CalendarData(
    "Sat-Thu 22:00-06:00",
  );

  assert.equal(parsed.status, "valid");
  assert.equal(
    parsed.days.find((day) => day.dayIndex === 7)!
      .workMinutes,
    8 * 60,
  );
  assert.equal(
    parsed.days.find((day) => day.dayIndex === 6)!
      .workMinutes,
    0,
  );
});

test("human-readable nonwork declaration must match working-day range", () => {
  const valid = parseP6CalendarData(
    "Mon-Sat 07:00-17:00; Sun nonwork",
  );
  assert.equal(valid.status, "valid");

  const invalid = parseP6CalendarData(
    "Mon-Sat 07:00-17:00; Fri nonwork",
  );
  assert.equal(invalid.status, "invalid");
  assert.ok(
    invalid.diagnostics.includes(
      "CALENDAR_HUMAN_NONWORK_DECLARATION_MISMATCH",
    ),
  );
});

test("human-readable 24-hour calendar is parsed exactly", () => {
  const parsed = parseP6CalendarData("All days 24h");

  assert.equal(parsed.status, "valid");
  assert.equal(
    parsed.days.reduce(
      (sum, day) => sum + day.workMinutes,
      0,
    ),
    168 * 60,
  );
});

test('explicit 24/7 and seven-day shift labels retain their actual hours',()=>{
 const continuous=parseP6CalendarData('24/7');
 assert.equal(continuous.status,'valid');assert.deepEqual(continuous.days.map(d=>d.workMinutes),Array(7).fill(1440));
 const shift=parseP6CalendarData('7 days 07:00-17:00');
 assert.equal(shift.status,'valid');assert.deepEqual(shift.days.map(d=>d.workMinutes),Array(7).fill(600));
 assert.notEqual(parseP6CalendarData('Night').status,'valid');
});


test("child calendars inherit a verified P6 base working pattern without a synthetic fallback", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tlast_recalc_date",
    "%R\t1\tBASE-CALENDAR\t2026-09-18",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tCALENDAR",
    "%F\tclndr_id\tbase_clndr_id\tclndr_name\tclndr_data",
    "%R\t1\t\tBase\t" + fiveDay,
    "%R\t2\t1\tProject Child\t",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt",
    "%R\t100\t1\t10\t2\tA100\tInherited calendar task\tTK_NotStart\t16\t16\t8",
    "%E",
  ].join("\n");

  const parsed =
    parseXerBytes(
      Buffer.from(
        source,
        "utf8",
      ),
    );
  const model =
    canonicalScheduleFromXer(
      parsed,
      {
        sourceRevisionId:
          "REV-1",
        projectId:
          "BASE-CALENDAR",
      },
    );
  const child =
    model.calendars.find(
      (calendar) =>
        calendar.calendarId ===
        "2",
    )!;

  assert.equal(
    child.semanticComplete,
    true,
  );
  assert.equal(
    child.standardDayHours,
    8,
  );
  assert.ok(
    child.sourceRefs.some(
      (ref) =>
        ref.locator ===
        "CALENDAR:1",
    ),
  );
  assert.ok(
    model.diagnostics.includes(
      "CALENDAR_BASE_PATTERN_INHERITED:2:1",
    ),
  );
});

test("a calendar record with no working pattern stays unresolved and states why", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tlast_recalc_date",
    "%R\t1\tNO-PATTERN\t2026-09-18",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tCALENDAR",
    "%F\tclndr_id\tclndr_name\tclndr_data",
    "%R\t77\tProject Calendar\t(0||CalendarData())",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt",
    "%R\t100\t1\t10\t77\tA100\tNo pattern task\tTK_NotStart\t16\t16\t8",
    "%E",
  ].join("\n");

  const model =
    canonicalScheduleFromXer(
      parseXerBytes(
        Buffer.from(
          source,
          "utf8",
        ),
      ),
      {
        sourceRevisionId:
          "REV-1",
        projectId:
          "NO-PATTERN",
      },
    );

  assert.equal(
    model.calendars[0]!
      .semanticComplete,
    false,
  );
  assert.ok(
    model.diagnostics.includes(
      "CALENDAR_WORK_PATTERN_NOT_ESTABLISHED:77",
    ),
  );
});
