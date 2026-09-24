import { parseP6CalendarData, type P6CalendarDataResult } from "./calendar-data";
import type { XerParseResult, XerRow } from "./types";

export interface XerCalendarAssessment {
  calendarId: string;
  baseCalendarId: string | null;
  name: string | null;
  data: P6CalendarDataResult | null;
  status: "verified" | "unresolved";
  diagnostics: string[];
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
  const ids = new Set(
    rows.map((row) => field(row, "clndr_id")).filter((id): id is string => !!id),
  );
  const missingBase = new Set<string>();
  const parentById = new Map<string, string | null>();
  const calendars: XerCalendarAssessment[] = [];

  for (const row of rows) {
    const calendarId = field(row, "clndr_id");
    if (!calendarId) continue;
    const baseCalendarId = field(row, "base_clndr_id");
    parentById.set(calendarId, baseCalendarId);

    const diagnostics: string[] = [];
    if (baseCalendarId && !ids.has(baseCalendarId)) {
      missingBase.add(baseCalendarId);
      diagnostics.push(`CALENDAR_BASE_MISSING:${baseCalendarId}`);
    }

    const raw = field(row, "clndr_data");
    const data = raw ? parseP6CalendarData(raw) : null;
    if (data?.status === "invalid") {
      diagnostics.push(...data.diagnostics);
    }

    if (data?.status === "valid" && data.days.length > 0) {
      const computedWeekHours =
        data.days.reduce(
          (sum, day) => sum + day.workMinutes,
          0,
        ) / 60;

      const rawWeekHours=field(row,'week_hr_cnt');
      const declaredWeekHours=rawWeekHours===null?null:Number(rawWeekHours);
      if (
        declaredWeekHours!==null&&Number.isFinite(declaredWeekHours) &&
        Math.abs(declaredWeekHours - computedWeekHours) > 0.001
      ) {
        diagnostics.push(
          `CALENDAR_WEEK_HOURS_MISMATCH:${declaredWeekHours}:${computedWeekHours}`,
        );
      }

      const nonzeroDayHours = [
        ...new Set(
          data.days
            .filter((day) => day.workMinutes > 0)
            .map((day) => day.workMinutes / 60),
        ),
      ];

      const rawDayHours=field(row,'day_hr_cnt');
      const declaredDayHours=rawDayHours===null?null:Number(rawDayHours);
      if (
        declaredDayHours!==null&&Number.isFinite(declaredDayHours) &&
        nonzeroDayHours.length === 1 &&
        Math.abs(declaredDayHours - nonzeroDayHours[0]!) > 0.001
      ) {
        diagnostics.push(
          `CALENDAR_DAY_HOURS_MISMATCH:${declaredDayHours}:${nonzeroDayHours[0]}`,
        );
      }
    }

    if (!raw && !baseCalendarId) {
      diagnostics.push("CALENDAR_DATA_AND_BASE_BOTH_MISSING");
    }

    calendars.push({
      calendarId,
      baseCalendarId,
      name: field(row, "clndr_name"),
      data,
      status: diagnostics.length === 0 ? "verified" : "unresolved",
      diagnostics,
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
