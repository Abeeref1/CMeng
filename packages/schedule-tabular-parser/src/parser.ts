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
  ScheduleRelationshipRow,
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

function durationValue(
  row: readonly string[],
  header: ScheduleHeaderMapping,
  role: ScheduleColumnRole,
  diagnostics: string[],
  code: string,
): ScheduleDurationValue {
  const raw = valueAt(row, roleColumn(header.roles, role));
  const parsed = parseScheduleDuration(raw, headerUnit(header, role));
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
      );
      const remainingDuration = durationValue(
        row,
        header,
        "remaining_duration",
        rowDiagnostics,
        "SCHEDULE_REMAINING_DURATION",
      );
      const totalFloat = durationValue(
        row,
        header,
        "total_float",
        rowDiagnostics,
        "SCHEDULE_TOTAL_FLOAT",
      );
      const freeFloat = durationValue(
        row,
        header,
        "free_float",
        rowDiagnostics,
        "SCHEDULE_FREE_FLOAT",
      );

      const start = valueAt(row, roleColumn(header.roles, "start"));
      const finish = valueAt(row, roleColumn(header.roles, "finish"));

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
    }
  }

  return { activities, relationships, diagnostics };
}

function finalize(
  sourceType: "csv" | "xlsx",
  sets: Array<ReturnType<typeof parseRows>>,
  diagnostics: string[],
): ScheduleTabularResult {
  const activities = sets.flatMap((set) => set.activities);
  const relationships = sets.flatMap((set) => set.relationships);
  const activityRowsUnresolved = activities.filter(
    (row) => row.statusState === "unresolved",
  ).length;
  const relationshipRowsUnresolved = relationships.filter(
    (row) => row.statusState === "unresolved",
  ).length;
  const total = activities.length + relationships.length;
  const verified =
    total - activityRowsUnresolved - relationshipRowsUnresolved;

  return {
    sourceType,
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
    coveragePercent:
      total === 0
        ? null
        : Number(((verified / total) * 100).toFixed(4)),
    complete:
      total > 0 &&
      activityRowsUnresolved === 0 &&
      relationshipRowsUnresolved === 0 &&
      diagnostics.length === 0,
    diagnostics,
  };
}

export function parseScheduleCsv(
  bytes: Uint8Array,
): ScheduleTabularResult {
  const csv = parseCsv(bytes);
  const rows = csv.rows.map((row) => row.cells);
  const headers = detectAllScheduleHeaders(rows);
  const diagnostics = [...csv.diagnostics];

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
  await workbook.xlsx.load(Buffer.from(bytes) as any);
  const sets: Array<ReturnType<typeof parseRows>> = [];
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

  return finalize("xlsx", sets, diagnostics);
}
