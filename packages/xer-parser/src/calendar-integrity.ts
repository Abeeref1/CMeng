import { parseP6CalendarData, type P6CalendarDataResult } from "./calendar-data";
import type { XerParseResult, XerRow } from "./types";
import { noteXerRead } from "./read-tracking";

export interface XerCalendarAssessment {
  calendarId: string;
  baseCalendarId: string | null;
  name: string | null;
  data: P6CalendarDataResult | null;
  status: "verified" | "unresolved";
  diagnostics: string[];
  conversionDiagnostics: string[];
  conversionDayHours: number | null;
  conversionWeekHours: number | null;
}

export interface XerCalendarIntegrity {
  calendars: XerCalendarAssessment[];
  missingBaseCalendarIds: string[];
  inheritanceCycles: string[][];
  unresolvedCalendars: number;
  complete: boolean;
}

function parsedRows(result: XerParseResult, table: string): XerRow[] {
  return (result.tables.get(table)?.rows ?? []).filter(
    (row) => row.status === "parsed" && row.data,
  );
}

function field(row: XerRow, name: string): string | null {
  noteXerRead(row.table, name);
  const value = row.data?.[name]?.trim();
  return value ? value : null;
}

function findCycles(parentById: Map<string, string | null>): string[][] {
  const cycles: string[][] = [];
  const canonical = new Set<string>();

  for (const start of parentById.keys()) {
    const path: string[] = [];
    const position = new Map<string, number>();
    let current: string | null = start;

    while (current && parentById.has(current)) {
      const seenAt = position.get(current);
      if (seenAt !== undefined) {
        const cycle = path.slice(seenAt);
        const normalized = [...cycle].sort().join("|");
        if (!canonical.has(normalized)) {
          canonical.add(normalized);
          cycles.push(cycle);
        }
        break;
      }
      position.set(current, path.length);
      path.push(current);
      current = parentById.get(current) ?? null;
    }
  }

  return cycles;
}

export function verifyXerCalendars(result: XerParseResult): XerCalendarIntegrity {
  const rows = parsedRows(result, "CALENDAR");
  const entries: P6CalendarSourceEntry[] = [];

  for (const row of rows) {
    const calendarId = field(row, "clndr_id");
    if (!calendarId) continue;
    const baseCalendarId = field(row, "base_clndr_id");
    const conversionDiagnostics:string[]=[];
    // Read explicit source aliases without treating a calendar name as a shift.
    // Conflicting declarations remain unresolved rather than choosing silently.
    const conversionHours=(name:string,alias:string):number|null=>
      statedConversionHours([name,alias].map(key=>({key,raw:field(row,key)})),conversionDiagnostics);
    const dayHours=conversionHours('day_hr_cnt','hours_per_day');
    const weekHours=conversionHours('week_hr_cnt','hours_per_week');
    const raw = field(row, "clndr_data");
    entries.push({
      calendarId,
      baseCalendarId,
      name: field(row, "clndr_name"),
      definitionPresent: !!raw,
      data: raw ? parseP6CalendarData(raw) : null,
      conversionDayHours: dayHours,
      conversionWeekHours: weekHours,
      conversionDiagnostics,
    });
  }
  return assessP6Calendars(entries);
}

/** Stated P6 hours-per-period conversion factor (XER day_hr_cnt with its
 * hours_per_day alias, P6 XML HoursPerDay; the same for week hours). An
 * invalid or conflicting declaration stays unresolved (null) with its
 * diagnostic; nothing is chosen silently. */
export function statedConversionHours(
  declarations: ReadonlyArray<{ key: string; raw: string | null }>,
  conversionDiagnostics: string[],
): number | null {
  const name = declarations[0]?.key ?? "";
  const alias = declarations[1]?.key ?? "";
  const stated = declarations.filter((item) => item.raw !== null);
  if (!stated.length) return null;
  const values = stated.map((item) => Number(item.raw));
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    conversionDiagnostics.push(`CALENDAR_CONVERSION_INVALID:${name}`);
    return null;
  }
  if (values.some((value) => Math.abs(value - values[0]!) > 0.001)) {
    conversionDiagnostics.push(`CALENDAR_CONVERSION_CONFLICT:${name}:${alias}`);
    return null;
  }
  return values[0]!;
}

/** One P6 calendar as its source states it, in any P6 format (XER CALENDAR
 * row, P6 XML Calendar element). */
export interface P6CalendarSourceEntry {
  calendarId: string;
  baseCalendarId: string | null;
  name: string | null;
  /** The source states a working-time definition (XER clndr_data; P6 XML StandardWorkWeek or HolidayOrExceptions). */
  definitionPresent: boolean;
  data: P6CalendarDataResult | null;
  conversionDayHours: number | null;
  conversionWeekHours: number | null;
  conversionDiagnostics: string[];
}

/** Shared P6 calendar integrity: base-calendar references and cycles, the
 * stated working time, and the stated conversion factors checked against it.
 * One rule for every P6 format. */
export function assessP6Calendars(entries: readonly P6CalendarSourceEntry[]): XerCalendarIntegrity {
  const ids = new Set(entries.map((entry) => entry.calendarId));
  const missingBase = new Set<string>();
  const parentById = new Map<string, string | null>();
  const calendars: XerCalendarAssessment[] = [];

  for (const entry of entries) {
    const { calendarId, baseCalendarId, data } = entry;
    parentById.set(calendarId, baseCalendarId);

    const diagnostics: string[] = [];
    const conversionDiagnostics:string[]=[...entry.conversionDiagnostics];
    const dayHours=entry.conversionDayHours;
    const weekHours=entry.conversionWeekHours;
    if (baseCalendarId && !ids.has(baseCalendarId)) {
      missingBase.add(baseCalendarId);
      diagnostics.push(`CALENDAR_BASE_MISSING:${baseCalendarId}`);
    }

    if (data?.status === "invalid") {
      diagnostics.push(...data.diagnostics);
    }

    if (data?.status === "valid" && data.days.length > 0) {
      const computedWeekHours =
        data.days.reduce(
          (sum, day) => sum + day.workMinutes,
          0,
        ) / 60;

      const declaredWeekHours=weekHours;
      if (
        declaredWeekHours!==null&&Number.isFinite(declaredWeekHours) &&
        Math.abs(declaredWeekHours - computedWeekHours) > 0.001
      ) {
        conversionDiagnostics.push(
          `CALENDAR_WEEK_CONVERSION_DIFFERS_FROM_WORK_PATTERN:${declaredWeekHours}:${computedWeekHours}`,
        );
      }

      const nonzeroDayHours = [
        ...new Set(
          data.days
            .filter((day) => day.workMinutes > 0)
            .map((day) => day.workMinutes / 60),
        ),
      ];

      const declaredDayHours=dayHours;
      if (
        declaredDayHours!==null&&Number.isFinite(declaredDayHours) &&
        nonzeroDayHours.length === 1 &&
        Math.abs(declaredDayHours - nonzeroDayHours[0]!) > 0.001
      ) {
        conversionDiagnostics.push(
          `CALENDAR_DAY_CONVERSION_DIFFERS_FROM_WORK_PATTERN:${declaredDayHours}:${nonzeroDayHours[0]}`,
        );
      }
    }

    if (!entry.definitionPresent && !baseCalendarId) {
      diagnostics.push("CALENDAR_DATA_AND_BASE_BOTH_MISSING");
    }

    calendars.push({
      calendarId,
      baseCalendarId,
      name: entry.name,
      data,
      status: diagnostics.length === 0 ? "verified" : "unresolved",
      diagnostics,
      // P6 Hours per Time Period are display/input conversion factors. They
      // do not invalidate the independently specified working intervals.
      conversionDiagnostics,
      conversionDayHours:dayHours,
      conversionWeekHours:weekHours,
    });
  }

  const inheritanceCycles = findCycles(parentById);
  const cycleIds = new Set(inheritanceCycles.flat());
  for (const calendar of calendars) {
    if (cycleIds.has(calendar.calendarId)) {
      calendar.status = "unresolved";
      calendar.diagnostics.push("CALENDAR_INHERITANCE_CYCLE");
    }
  }

  const unresolvedCalendars = calendars.filter(
    (calendar) => calendar.status === "unresolved",
  ).length;

  return {
    calendars,
    missingBaseCalendarIds: [...missingBase].sort(),
    inheritanceCycles,
    unresolvedCalendars,
    complete: unresolvedCalendars === 0 && inheritanceCycles.length === 0,
  };
}
