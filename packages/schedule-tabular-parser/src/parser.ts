import {readableXlsx} from '../../shared/src/xlsx';
import ExcelJS from "exceljs";
import { parseCsv } from "../../tabular-parser/src";
import { parseStrictNumeric } from "../../boq-parser/src/numeric";
import {
  inferDurationUnitFromHeader,
  parseScheduleDate,
  parseScheduleDuration,
  type ScheduleDurationUnit,
  type ScheduleDurationValue,
} from "../../schedule-values/src";
import { detectAllScheduleHeaders } from "./headers";
import type {
  ScheduleActivityRow,
  ScheduleCellLocator,
  ScheduleColumnRole,
  ScheduleHeaderMapping,
  ScheduleMetadataSheet,
  ScheduleRelationshipRow,
  ScheduleWbsRow,
  ScheduleCalendarRow,
  ScheduleActivityCodeRow,
  ScheduleTabularResult,
} from "./types";

function columnName(column: number): string {
  let value = column;
  let out = "";
  while (value > 0) {
    value -= 1;
    out = String.fromCharCode(65 + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out;
}

function locator(
  source: "csv" | "xlsx",
  sheet: string | null,
  row: number,
  column: number,
): ScheduleCellLocator {
  return {
    source,
    sheet,
    row,
    column,
    address:
      source === "xlsx"
        ? columnName(column) + row
        : "R" + row + "C" + column,
  };
}

function roleColumn(
  roles: Record<number, ScheduleColumnRole>,
  role: ScheduleColumnRole,
): number | null {
  const entry = Object.entries(roles).find(([, mapped]) => mapped === role);
  return entry ? Number(entry[0]) : null;
}

function valueAt(
  row: readonly string[],
  column: number | null,
): string | null {
  if (column === null) return null;
  const value = (row[column - 1] ?? "").trim();
  return value || null;
}

function headerUnit(
  header: ScheduleHeaderMapping,
  role: ScheduleColumnRole,
): ScheduleDurationUnit {
  const column = roleColumn(header.roles, role);
  if (column === null) return "unknown";
  return inferDurationUnitFromHeader(header.headers[column] ?? "");
}


function inferDurationUnitFromDateSpan(
  rows: readonly (readonly string[])[],
  header: ScheduleHeaderMapping,
  endIndexExclusive = rows.length,
): ScheduleDurationUnit {
  const explicit = headerUnit(header, "original_duration");
  if (explicit !== "unknown") return explicit;

  const durationColumn = roleColumn(
    header.roles,
    "original_duration",
  );
  const startColumn =
    roleColumn(header.roles, "baseline_start") ??
    roleColumn(header.roles, "start");
  const finishColumn =
    roleColumn(header.roles, "baseline_finish") ??
    roleColumn(header.roles, "finish");

  if (
    durationColumn === null ||
    startColumn === null ||
    finishColumn === null
  ) {
    return "unknown";
  }

  let usable = 0;
  let dayMatches = 0;

  for (
    let index = header.row;
    index < Math.min(endIndexExclusive, rows.length);
    index += 1
  ) {
    const row = rows[index] ?? [];
    const rawDuration = valueAt(row, durationColumn);
    const rawStart = valueAt(row, startColumn);
    const rawFinish = valueAt(row, finishColumn);

    if (!rawDuration || !rawStart || !rawFinish) continue;

    const duration = Number(rawDuration);
    const start = parseScheduleDate(rawStart);
    const finish = parseScheduleDate(rawFinish);

    if (
      !Number.isFinite(duration) ||
      start.status !== "valid" ||
      finish.status !== "valid" ||
      !start.iso ||
      !finish.iso
    ) {
      continue;
    }

    const startMs = Date.parse(start.iso.slice(0, 10) + "T00:00:00Z");
    const finishMs = Date.parse(
      finish.iso.slice(0, 10) + "T00:00:00Z",
    );

    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(finishMs)
    ) {
      continue;
    }

    usable += 1;
    const spanDays = (finishMs - startMs) / 86_400_000;
    if (Math.abs(spanDays - duration) <= 1e-9) {
      dayMatches += 1;
    }
  }

  // Never infer from a tiny sample. For large exports, require every
  // usable row to prove the same whole-day convention.
  if (usable >= 20 && dayMatches === usable) {
    return "days";
  }

  return "unknown";
}

function durationValue(
  row: readonly string[],
  header: ScheduleHeaderMapping,
  role: ScheduleColumnRole,
  diagnostics: string[],
  code: string,
  inferredUnit: ScheduleDurationUnit = "unknown",
): ScheduleDurationValue {
  const raw = valueAt(row, roleColumn(header.roles, role));
  const declaredUnit = headerUnit(header, role);
  const unit =
    declaredUnit === "unknown" ? inferredUnit : declaredUnit;
  const parsed = parseScheduleDuration(raw, unit);
  if (
    raw !== null &&
    (parsed.status === "ambiguous" || parsed.status === "invalid")
  ) {
    diagnostics.push(code + "_" + parsed.status.toUpperCase());
  }
  return parsed;
}

function normalizedDate(
  raw: string | null,
  diagnostics: string[],
  code: string,
): string | null {
  if (raw === null) return null;
  const parsed = parseScheduleDate(raw);
  if (parsed.status !== "valid") {
    diagnostics.push(code + "_" + parsed.status.toUpperCase());
    return null;
  }
  return parsed.iso;
}

function parsePercent(
  raw: string | null,
  diagnostics: string[],
): number | null {
  if (raw === null) return null;
  const parsed = parseStrictNumeric(raw);
  if (parsed.status !== "valid" || parsed.value === null) {
    diagnostics.push(
      "SCHEDULE_PERCENT_COMPLETE_" + parsed.status.toUpperCase(),
    );
    return null;
  }
  if (parsed.value < 0 || parsed.value > 100) {
    diagnostics.push("SCHEDULE_PERCENT_COMPLETE_OUT_OF_RANGE");
    return null;
  }
  return parsed.value;
}

function makeLocators(
  source: "csv" | "xlsx",
  sheet: string | null,
  rowNo: number,
  roles: Record<number, ScheduleColumnRole>,
): Partial<Record<ScheduleColumnRole, ScheduleCellLocator>> {
  const out: Partial<Record<ScheduleColumnRole, ScheduleCellLocator>> = {};
  for (const [columnText, role] of Object.entries(roles)) {
    const column = Number(columnText);
    out[role] = locator(source, sheet, rowNo, column);
  }
  return out;
}


function parseEmbeddedPredecessorIds(
  raw: string | null,
): { ids: string[]; supported: boolean } {
  if (!raw) return { ids: [], supported: true };

  const parts = raw
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (
    parts.length === 0 ||
    parts.some(
      (value) => !/^[A-Za-z0-9_.:\-]+$/.test(value),
    )
  ) {
    return { ids: [], supported: false };
  }

  return { ids: parts, supported: true };
}

function parseRows(
  source: "csv" | "xlsx",
  sheet: string | null,
  rows: readonly (readonly string[])[],
  header: ScheduleHeaderMapping,
  endIndexExclusive = rows.length,
): {
  activities: ScheduleActivityRow[];
  relationships: ScheduleRelationshipRow[];
  diagnostics: string[];
} {
  const activities: ScheduleActivityRow[] = [];
  const relationships: ScheduleRelationshipRow[] = [];
  const diagnostics: string[] = [];
  const activityIdColumn = roleColumn(header.roles, "activity_id");
  const predecessorColumn = roleColumn(header.roles, "predecessor_id");
  const successorColumn = roleColumn(header.roles, "successor_id");
  const inferredDurationUnit = inferDurationUnitFromDateSpan(
    rows,
    header,
    endIndexExclusive,
  );

  for (
    let index = header.row;
    index < Math.min(endIndexExclusive, rows.length);
    index += 1
  ) {
    const row = rows[index] ?? [];
    if (row.every((value) => !value.trim())) continue;
    const rowNumber = index + 1;

    if (predecessorColumn !== null && successorColumn !== null) {
      const rowDiagnostics: string[] = [];
      const predecessorId = valueAt(row, predecessorColumn);
      const successorId = valueAt(row, successorColumn);
      const relationshipType = valueAt(
        row,
        roleColumn(header.roles, "relationship_type"),
      );
      const lag = durationValue(
        row,
        header,
        "lag",
        rowDiagnostics,
        "SCHEDULE_LAG",
        inferredDurationUnit,
      );

      if (!predecessorId) {
        rowDiagnostics.push("SCHEDULE_PREDECESSOR_ID_MISSING");
      }
      if (!successorId) {
        rowDiagnostics.push("SCHEDULE_SUCCESSOR_ID_MISSING");
      }

      relationships.push({
        predecessorId,
        successorId,
        relationshipType,
        lagRaw: lag.raw || null,
        lagUnit: lag.unit,
        lagHours: lag.hours,
        locators: makeLocators(
          source,
          sheet,
          rowNumber,
          header.roles,
        ),
        statusState:
          rowDiagnostics.length === 0 ? "verified" : "unresolved",
        diagnostics: rowDiagnostics,
      });
      continue;
    }

    if (activityIdColumn !== null) {
      const rowDiagnostics: string[] = [];
      const activityId = valueAt(row, activityIdColumn);
      if (!activityId) {
        rowDiagnostics.push("SCHEDULE_ACTIVITY_ID_MISSING");
      }

      const originalDuration = durationValue(
        row,
        header,
        "original_duration",
        rowDiagnostics,
        "SCHEDULE_ORIGINAL_DURATION",
        inferredDurationUnit,
      );
      const remainingDuration = durationValue(
        row,
        header,
        "remaining_duration",
        rowDiagnostics,
        "SCHEDULE_REMAINING_DURATION",
        inferredDurationUnit,
      );
      const totalFloat = durationValue(
        row,
        header,
        "total_float",
        rowDiagnostics,
        "SCHEDULE_TOTAL_FLOAT",
        inferredDurationUnit,
      );
      const freeFloat = durationValue(
        row,
        header,
        "free_float",
        rowDiagnostics,
        "SCHEDULE_FREE_FLOAT",
        inferredDurationUnit,
      );

      const start = valueAt(row, roleColumn(header.roles, "start"));
      const finish = valueAt(row, roleColumn(header.roles, "finish"));
      const actualStart = valueAt(
        row,
        roleColumn(header.roles, "actual_start"),
      );
      const actualFinish = valueAt(
        row,
        roleColumn(header.roles, "actual_finish"),
      );
      const baselineStart = valueAt(
        row,
        roleColumn(header.roles, "baseline_start"),
      );
      const baselineFinish = valueAt(
        row,
        roleColumn(header.roles, "baseline_finish"),
      );

      activities.push({
        activityId,
        activityName: valueAt(
          row,
          roleColumn(header.roles, "activity_name"),
        ),
        wbs: valueAt(row, roleColumn(header.roles, "wbs")),
        wbsId: valueAt(row, roleColumn(header.roles, "wbs_id")),
        calendar: valueAt(row, roleColumn(header.roles, "calendar")),
        start,
        startIso: normalizedDate(
          start,
          rowDiagnostics,
          "SCHEDULE_START_DATE",
        ),
        finish,
        finishIso: normalizedDate(
          finish,
          rowDiagnostics,
          "SCHEDULE_FINISH_DATE",
        ),
        actualStart,
        actualStartIso: normalizedDate(
          actualStart,
          rowDiagnostics,
          "SCHEDULE_ACTUAL_START_DATE",
        ),
        actualFinish,
        actualFinishIso: normalizedDate(
          actualFinish,
          rowDiagnostics,
          "SCHEDULE_ACTUAL_FINISH_DATE",
        ),
        baselineStart,
        baselineStartIso: normalizedDate(
          baselineStart,
          rowDiagnostics,
          "SCHEDULE_BASELINE_START_DATE",
        ),
        baselineFinish,
        baselineFinishIso: normalizedDate(
          baselineFinish,
          rowDiagnostics,
          "SCHEDULE_BASELINE_FINISH_DATE",
        ),
        originalDurationRaw: originalDuration.raw || null,
        originalDurationUnit: originalDuration.unit,
        originalDurationHours: originalDuration.hours,
        remainingDurationRaw: remainingDuration.raw || null,
        remainingDurationUnit: remainingDuration.unit,
        remainingDurationHours: remainingDuration.hours,
        totalFloatRaw: totalFloat.raw || null,
        totalFloatUnit: totalFloat.unit,
        totalFloatHours: totalFloat.hours,
        freeFloatRaw: freeFloat.raw || null,
        freeFloatUnit: freeFloat.unit,
        freeFloatHours: freeFloat.hours,
        percentComplete: parsePercent(
          valueAt(
            row,
            roleColumn(header.roles, "percent_complete"),
          ),
          rowDiagnostics,
        ),
        status: valueAt(row, roleColumn(header.roles, "status")),
        locators: makeLocators(
          source,
          sheet,
          rowNumber,
          header.roles,
        ),
        statusState:
          rowDiagnostics.length === 0 ? "verified" : "unresolved",
        diagnostics: rowDiagnostics,
      });

      const embeddedPredecessorRaw = valueAt(
        row,
        predecessorColumn,
      );
      const embeddedPredecessors =
        parseEmbeddedPredecessorIds(embeddedPredecessorRaw);

      if (!embeddedPredecessors.supported) {
        rowDiagnostics.push(
          "SCHEDULE_EMBEDDED_PREDECESSOR_SYNTAX_UNSUPPORTED",
        );
      } else if (activityId) {
        for (const predecessorId of embeddedPredecessors.ids) {
          relationships.push({
            predecessorId,
            successorId: activityId,
            relationshipType: null,
            lagRaw: null,
            lagUnit: "unknown",
            lagHours: null,
            locators: makeLocators(
              source,
              sheet,
              rowNumber,
              header.roles,
            ),
            statusState: "verified",
            diagnostics: [],
          });
        }
      }
    }
  }

  return { activities, relationships, diagnostics };
}

function parseMetadataSheet(
  sheetName: string,
  rows: readonly (readonly string[])[],
): ScheduleMetadataSheet | null {
  let headerIndex = -1;

  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const row = rows[index] ?? [];
    const normalized = row.map((value) =>
      value.toLowerCase().replace(/\s+/g, " ").trim(),
    );

    if (
      normalized[0] === "field" &&
      normalized[1] === "value" &&
      normalized[2] === "field" &&
      normalized[3] === "value"
    ) {
      headerIndex = index;
      break;
    }
  }

  if (headerIndex < 0) return null;

  const fields: ScheduleMetadataSheet["fields"] = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];

    for (const [keyColumn, valueColumn] of [
      [1, 2],
      [3, 4],
    ] as const) {
      const key = (row[keyColumn - 1] ?? "").trim();
      const value = (row[valueColumn - 1] ?? "").trim();
      if (!key && !value) continue;
      if (!key || !value) {
        return null;
      }
      fields.push({
        key,
        value,
        row: index + 1,
        keyColumn,
        valueColumn,
      });
    }
  }

  if (fields.length < 4) return null;

  const firstPopulatedRow = rows.find(
    (row) => row.some((value) => value.trim()),
  );
  const title =
    firstPopulatedRow?.filter((value) => value.trim()).length === 1
      ? firstPopulatedRow.find((value) => value.trim())?.trim() ?? null
      : null;

  return {
    sheet: sheetName,
    title,
    fields,
    rows: rows
      .map((cells, index) => ({
        row: index + 1,
        cells: [...cells],
      }))
      .filter((row) =>
        row.cells.some((value) => value.trim()),
      ),
  };
}


interface MixedScheduleRows {
  activities: ScheduleActivityRow[];
  relationships: ScheduleRelationshipRow[];
  wbsRows: ScheduleWbsRow[];
  calendarRows: ScheduleCalendarRow[];
  activityCodeRows: ScheduleActivityCodeRow[];
  diagnostics: string[];
  sourceRecordCount: number;
}

function mixedHeaderIndex(
  header: readonly string[],
  name: string,
): number {
  const normalized = name.toLowerCase().trim();
  return header.findIndex(
    (value) => value.toLowerCase().trim() === normalized,
  );
}

function parseMixedScheduleRows(
  rows: readonly (readonly string[])[],
): MixedScheduleRows | null {
  if (rows.length === 0) return null;
  const header = rows[0] ?? [];
  const recordTypeIndex = mixedHeaderIndex(header, "Record Type");
  const recordIdIndex = mixedHeaderIndex(header, "Record ID");

  if (recordTypeIndex < 0 || recordIdIndex < 0) {
    return null;
  }

  const parentIndex = mixedHeaderIndex(header, "Parent/Successor");
  const predecessorIndex = mixedHeaderIndex(header, "Predecessor");
  const wbsIndex = mixedHeaderIndex(header, "WBS");
  const nameIndex = mixedHeaderIndex(header, "Name/Description");
  const typeIndex = mixedHeaderIndex(header, "Type");
  const startIndex = mixedHeaderIndex(header, "Start");
  const finishIndex = mixedHeaderIndex(header, "Finish");
  const durationIndex = mixedHeaderIndex(header, "Duration");
  const floatIndex = mixedHeaderIndex(header, "Float");
  const percentIndex = mixedHeaderIndex(header, "Percent");
  const statusIndex = mixedHeaderIndex(header, "Status");
  const lagIndex = mixedHeaderIndex(header, "Lag");
  const revisionIndex = mixedHeaderIndex(header, "Revision");

  const at = (
    row: readonly string[],
    index: number,
  ): string | null => {
    if (index < 0) return null;
    const value = (row[index] ?? "").trim();
    return value || null;
  };

  let mixedDurationUnit: ScheduleDurationUnit = "unknown";
  let mixedDurationUsable = 0;
  let mixedDurationDayMatches = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const recordType = (at(row, recordTypeIndex) ?? "").toUpperCase();
    if (recordType !== "ACTIVITY") continue;

    const rawDuration = at(row, durationIndex);
    const rawStart = at(row, startIndex);
    const rawFinish = at(row, finishIndex);
    if (!rawDuration || !rawStart || !rawFinish) continue;

    const duration = Number(rawDuration);
    const start = parseScheduleDate(rawStart);
    const finish = parseScheduleDate(rawFinish);

    if (
      !Number.isFinite(duration) ||
      start.status !== "valid" ||
      finish.status !== "valid" ||
      !start.iso ||
      !finish.iso
    ) {
      continue;
    }

    const startMs = Date.parse(start.iso.slice(0, 10) + "T00:00:00Z");
    const finishMs = Date.parse(
      finish.iso.slice(0, 10) + "T00:00:00Z",
    );
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(finishMs)
    ) {
      continue;
    }

    mixedDurationUsable += 1;
    const spanDays = (finishMs - startMs) / 86_400_000;
    if (Math.abs(spanDays - duration) <= 1e-9) {
      mixedDurationDayMatches += 1;
    }
  }

  if (
    mixedDurationUsable >= 20 &&
    mixedDurationDayMatches === mixedDurationUsable
  ) {
    mixedDurationUnit = "days";
  }

  const activities: ScheduleActivityRow[] = [];
  const relationships: ScheduleRelationshipRow[] = [];
  const wbsRows: ScheduleWbsRow[] = [];
  const calendarRows: ScheduleCalendarRow[] = [];
  const activityCodeRows: ScheduleActivityCodeRow[] = [];
  const diagnostics: string[] = [];
  let sourceRecordCount = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (row.every((value) => !value.trim())) continue;
    sourceRecordCount += 1;
    const rowNumber = index + 1;
    const recordType = (at(row, recordTypeIndex) ?? "").toUpperCase();
    const recordId = at(row, recordIdIndex);
    const revision = at(row, revisionIndex);

    if (recordType === "WBS") {
      const rowDiagnostics: string[] = [];
      if (!recordId) rowDiagnostics.push("SCHEDULE_WBS_ID_MISSING");
      wbsRows.push({
        wbsId: recordId ?? "",
        parentWbsId: at(row, parentIndex),
        name: at(row, nameIndex),
        revision,
        row: rowNumber,
        statusState:
          rowDiagnostics.length === 0 ? "verified" : "unresolved",
        diagnostics: rowDiagnostics,
      });
      continue;
    }

    if (recordType === "CALENDAR") {
      const rowDiagnostics: string[] = [];
      if (!recordId) rowDiagnostics.push("SCHEDULE_CALENDAR_ID_MISSING");
      calendarRows.push({
        calendarId: recordId ?? "",
        name: at(row, nameIndex),
        revision,
        row: rowNumber,
        statusState:
          rowDiagnostics.length === 0 ? "verified" : "unresolved",
        diagnostics: rowDiagnostics,
      });
      continue;
    }

    if (recordType === "ACTIVITY_CODE") {
      const rowDiagnostics: string[] = [];
      if (!recordId) rowDiagnostics.push("SCHEDULE_ACTIVITY_CODE_ID_MISSING");
      const activityId = at(row, parentIndex);
      if (!activityId) {
        rowDiagnostics.push("SCHEDULE_ACTIVITY_CODE_ACTIVITY_ID_MISSING");
      }
      activityCodeRows.push({
        codeId: recordId ?? "",
        activityId,
        value: at(row, nameIndex),
        revision,
        row: rowNumber,
        statusState:
          rowDiagnostics.length === 0 ? "verified" : "unresolved",
        diagnostics: rowDiagnostics,
      });
      continue;
    }

    if (recordType === "RELATIONSHIP") {
      const rowDiagnostics: string[] = [];
      const predecessorId = at(row, predecessorIndex);
      const successorId = at(row, parentIndex);
      if (!predecessorId) {
        rowDiagnostics.push("SCHEDULE_PREDECESSOR_ID_MISSING");
      }
      if (!successorId) {
        rowDiagnostics.push("SCHEDULE_SUCCESSOR_ID_MISSING");
      }
      const lag = parseScheduleDuration(
        at(row, lagIndex),
        mixedDurationUnit,
      );
      if (
        lag.raw &&
        (lag.status === "ambiguous" || lag.status === "invalid")
      ) {
        rowDiagnostics.push(
          "SCHEDULE_LAG_" + lag.status.toUpperCase(),
        );
      }
      relationships.push({
        predecessorId,
        successorId,
        relationshipType: at(row, typeIndex),
        lagRaw: lag.raw || null,
        lagUnit: lag.unit,
        lagHours: lag.hours,
        locators: {},
        statusState:
          rowDiagnostics.length === 0 ? "verified" : "unresolved",
        diagnostics: rowDiagnostics,
      });
      continue;
    }

    if (recordType === "ACTIVITY") {
      const rowDiagnostics: string[] = [];
      const activityId = recordId;
      if (!activityId) {
        rowDiagnostics.push("SCHEDULE_ACTIVITY_ID_MISSING");
      }

      const start = at(row, startIndex);
      const finish = at(row, finishIndex);
      const duration = parseScheduleDuration(
        at(row, durationIndex),
        mixedDurationUnit,
      );
      const floatValue = parseScheduleDuration(
        at(row, floatIndex),
        mixedDurationUnit,
      );

      if (
        duration.raw &&
        (duration.status === "ambiguous" ||
          duration.status === "invalid")
      ) {
        rowDiagnostics.push(
          "SCHEDULE_ORIGINAL_DURATION_" +
            duration.status.toUpperCase(),
        );
      }
      if (
        floatValue.raw &&
        (floatValue.status === "ambiguous" ||
          floatValue.status === "invalid")
      ) {
        rowDiagnostics.push(
          "SCHEDULE_TOTAL_FLOAT_" +
            floatValue.status.toUpperCase(),
        );
      }

      activities.push({
        activityId,
        activityName: at(row, nameIndex),
        wbs: at(row, wbsIndex),
        wbsId: null,
        calendar: null,
        start,
        startIso: normalizedDate(
          start,
          rowDiagnostics,
          "SCHEDULE_START_DATE",
        ),
        finish,
        finishIso: normalizedDate(
          finish,
          rowDiagnostics,
          "SCHEDULE_FINISH_DATE",
        ),
        actualStart: null,
        actualStartIso: null,
        actualFinish: null,
        actualFinishIso: null,
        baselineStart: null,
        baselineStartIso: null,
        baselineFinish: null,
        baselineFinishIso: null,
        originalDurationRaw: duration.raw || null,
        originalDurationUnit: duration.unit,
        originalDurationHours: duration.hours,
        remainingDurationRaw: null,
        remainingDurationUnit: "unknown",
        remainingDurationHours: null,
        totalFloatRaw: floatValue.raw || null,
        totalFloatUnit: floatValue.unit,
        totalFloatHours: floatValue.hours,
        freeFloatRaw: null,
        freeFloatUnit: "unknown",
        freeFloatHours: null,
        percentComplete: parsePercent(
          at(row, percentIndex),
          rowDiagnostics,
        ),
        status: at(row, statusIndex),
        locators: {},
        statusState:
          rowDiagnostics.length === 0 ? "verified" : "unresolved",
        diagnostics: rowDiagnostics,
      });
      continue;
    }

    diagnostics.push(
      "SCHEDULE_MIXED_UNKNOWN_RECORD_TYPE:" +
        (recordType || "<blank>") +
        ":row=" +
        rowNumber,
    );
  }

  return {
    activities,
    relationships,
    wbsRows,
    calendarRows,
    activityCodeRows,
    diagnostics,
    sourceRecordCount,
  };
}

function finalize(
  sourceType: "csv" | "xlsx",
  sets: Array<ReturnType<typeof parseRows>>,
  diagnostics: string[],
  metadataSheets: ScheduleMetadataSheet[] = [],
  mixed: {
    wbsRows?: ScheduleWbsRow[];
    calendarRows?: ScheduleCalendarRow[];
    activityCodeRows?: ScheduleActivityCodeRow[];
    sourceRecordCount?: number;
  } = {},
): ScheduleTabularResult {
  const activities = sets.flatMap((set) => set.activities);
  const relationships = sets.flatMap((set) => set.relationships);
  const wbsRows = mixed.wbsRows ?? [];
  const calendarRows = mixed.calendarRows ?? [];
  const activityCodeRows = mixed.activityCodeRows ?? [];

  const activityIds = activities
    .map((activity) => activity.activityId)
    .filter((value): value is string => !!value);
  const activityIdCounts = new Map<string, number>();
  for (const activityId of activityIds) {
    activityIdCounts.set(
      activityId,
      (activityIdCounts.get(activityId) ?? 0) + 1,
    );
  }
  const duplicateActivityIds = [...activityIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([activityId]) => activityId)
    .sort();

  if (duplicateActivityIds.length > 0) {
    diagnostics.push(
      "SCHEDULE_DUPLICATE_ACTIVITY_IDS:" +
        duplicateActivityIds.slice(0, 25).join(","),
    );
  }

  const activityIdSet = new Set(activityIds);
  if (activityIdSet.size > 0) {
    for (const relationship of relationships) {
      const missing: string[] = [];
      if (
        relationship.predecessorId &&
        !activityIdSet.has(relationship.predecessorId)
      ) {
        missing.push(
          "SCHEDULE_PREDECESSOR_REFERENCE_UNRESOLVED",
        );
      }
      if (
        relationship.successorId &&
        !activityIdSet.has(relationship.successorId)
      ) {
        missing.push(
          "SCHEDULE_SUCCESSOR_REFERENCE_UNRESOLVED",
        );
      }
      if (missing.length > 0) {
        relationship.statusState = "unresolved";
        relationship.diagnostics.push(...missing);
      }
    }

    for (const code of activityCodeRows) {
      if (code.activityId && !activityIdSet.has(code.activityId)) {
        code.statusState = "unresolved";
        code.diagnostics.push(
          "SCHEDULE_ACTIVITY_CODE_REFERENCE_UNRESOLVED",
        );
      }
    }
  }

  const wbsIdSet = new Set(
    wbsRows
      .map((wbs) => wbs.wbsId)
      .filter(Boolean),
  );
  if (wbsIdSet.size > 0) {
    for (const activity of activities) {
      if (
        activity.wbs &&
        !wbsIdSet.has(activity.wbs) &&
        activity.wbsId === null
      ) {
        activity.statusState = "unresolved";
        activity.diagnostics.push(
          "SCHEDULE_WBS_REFERENCE_UNRESOLVED",
        );
      }
    }
  }

  const activityRowsUnresolved = activities.filter(
    (row) => row.statusState === "unresolved",
  ).length;
  const relationshipRowsUnresolved = relationships.filter(
    (row) => row.statusState === "unresolved",
  ).length;
  const wbsRowsUnresolved = wbsRows.filter(
    (row) => row.statusState === "unresolved",
  ).length;
  const calendarRowsUnresolved = calendarRows.filter(
    (row) => row.statusState === "unresolved",
  ).length;
  const activityCodeRowsUnresolved = activityCodeRows.filter(
    (row) => row.statusState === "unresolved",
  ).length;

  if (wbsRowsUnresolved > 0) {
    diagnostics.push(
      "SCHEDULE_WBS_ROWS_UNRESOLVED:" + wbsRowsUnresolved,
    );
  }
  if (calendarRowsUnresolved > 0) {
    diagnostics.push(
      "SCHEDULE_CALENDAR_ROWS_UNRESOLVED:" +
        calendarRowsUnresolved,
    );
  }
  if (activityCodeRowsUnresolved > 0) {
    diagnostics.push(
      "SCHEDULE_ACTIVITY_CODE_ROWS_UNRESOLVED:" +
        activityCodeRowsUnresolved,
    );
  }

  const total = activities.length + relationships.length;
  const verified =
    total - activityRowsUnresolved - relationshipRowsUnresolved;
  const recognizedStructuralRows =
    activities.length +
    relationships.length +
    wbsRows.length +
    calendarRows.length +
    activityCodeRows.length;
  const sourceRecordCount =
    mixed.sourceRecordCount ?? recognizedStructuralRows;

  return {
    sourceType,
    metadataSheets,
    wbsRows,
    calendarRows,
    activityCodeRows,
    activities,
    relationships,
    activityRowsSeen: activities.length,
    activityRowsVerified:
      activities.length - activityRowsUnresolved,
    activityRowsUnresolved,
    relationshipRowsSeen: relationships.length,
    relationshipRowsVerified:
      relationships.length - relationshipRowsUnresolved,
    relationshipRowsUnresolved,
    wbsRowsSeen: wbsRows.length,
    calendarRowsSeen: calendarRows.length,
    activityCodeRowsSeen: activityCodeRows.length,
    structuralCoveragePercent:
      sourceRecordCount === 0
        ? null
        : Number(
            (
              (recognizedStructuralRows / sourceRecordCount) *
              100
            ).toFixed(4),
          ),
    coveragePercent:
      total === 0
        ? null
        : Number(((verified / total) * 100).toFixed(4)),
    complete:
      total > 0 &&
      activityRowsUnresolved === 0 &&
      relationshipRowsUnresolved === 0 &&
      wbsRowsUnresolved === 0 &&
      calendarRowsUnresolved === 0 &&
      activityCodeRowsUnresolved === 0 &&
      diagnostics.length === 0,
    diagnostics,
  };
}

export function parseScheduleCsv(
  bytes: Uint8Array,
): ScheduleTabularResult {
  const csv = parseCsv(bytes);
  const rows = csv.rows.map((row) => row.cells);
  const diagnostics = [...csv.diagnostics];

  const mixed = parseMixedScheduleRows(rows);
  if (mixed) {
    return finalize(
      "csv",
      [
        {
          activities: mixed.activities,
          relationships: mixed.relationships,
          diagnostics: mixed.diagnostics,
        },
      ],
      [...diagnostics, ...mixed.diagnostics],
      [],
      {
        wbsRows: mixed.wbsRows,
        calendarRows: mixed.calendarRows,
        activityCodeRows: mixed.activityCodeRows,
        sourceRecordCount: mixed.sourceRecordCount,
      },
    );
  }

  const headers = detectAllScheduleHeaders(rows);

  if (headers.length === 0) {
    diagnostics.push("SCHEDULE_CSV_HEADER_NOT_FOUND");
    return finalize("csv", [], diagnostics);
  }

  const sets: Array<ReturnType<typeof parseRows>> = [];
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index]!;
    const nextHeader = headers[index + 1];
    const endIndexExclusive = nextHeader
      ? nextHeader.row - 1
      : rows.length;
    sets.push(
      parseRows(
        "csv",
        null,
        rows,
        header,
        endIndexExclusive,
      ),
    );
  }

  return finalize("csv", sets, diagnostics);
}

export async function parseScheduleXlsx(
  bytes: Uint8Array,
): Promise<ScheduleTabularResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readableXlsx(bytes) as any);
  const sets: Array<ReturnType<typeof parseRows>> = [];
  const metadataSheets: ScheduleMetadataSheet[] = [];
  const diagnostics: string[] = [];

  for (const sheet of workbook.worksheets) {
    const rows: string[][] = [];

    for (let row = 1; row <= sheet.rowCount; row += 1) {
      const values: string[] = [];
      for (
        let column = 1;
        column <= sheet.columnCount;
        column += 1
      ) {
        values.push(
          sheet.getRow(row).getCell(column).text ?? "",
        );
      }
      rows.push(values);
    }

    const headers = detectAllScheduleHeaders(rows);

    if (headers.length === 0) {
      const metadata = parseMetadataSheet(sheet.name, rows);
      if (metadata) {
        metadataSheets.push(metadata);
        continue;
      }

      const populated = rows.flat().filter((value) => value.trim()).length;
      if (populated >= 6) {
        diagnostics.push(
          sheet.name +
            ":SCHEDULE_POPULATED_SHEET_UNCLASSIFIED",
        );
      }
      continue;
    }

    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index]!;
      const nextHeader = headers[index + 1];
      const endIndexExclusive = nextHeader
        ? nextHeader.row - 1
        : rows.length;
      sets.push(
        parseRows(
          "xlsx",
          sheet.name,
          rows,
          header,
          endIndexExclusive,
        ),
      );
    }
  }

  return finalize("xlsx", sets, diagnostics, metadataSheets);
}
