import type { CanonicalCalendar } from "./types";
import { calendarWorkingDayHours } from "./float-thresholds";
import {
  calendarHasUsableWorkPattern,
  workingHoursBetween,
} from "../../schedule-cpm/src/calendar";

const DAY_MS = 86_400_000;

/** First source calendar per ID, the same rule as the float readers. */
export function firstSourceCalendars(
  calendars: readonly CanonicalCalendar[],
): Map<string, CanonicalCalendar> {
  const byId = new Map<string, CanonicalCalendar>();
  for (const calendar of calendars)
    if (!byId.has(calendar.calendarId)) byId.set(calendar.calendarId, calendar);
  return byId;
}

/**
 * Shared baseline comparison for one activity (T06): current or actual
 * finish minus baseline finish, positive = late.
 * - calendarDays: elapsed calendar days, unrounded, as before.
 * - workingDays: working time between the two instants on the activity's
 *   own source calendar, divided by that calendar's working-day length.
 *   Null when the calendar is missing or incomplete or its day length is
 *   not read. Never an assumed 8-hour day or 7-day week.
 */
export function finishVarianceBetween(
  baselineMs: number,
  currentMs: number,
  calendar: CanonicalCalendar | null | undefined,
): { calendarDays: number; workingDays: number | null } {
  const calendarDays = (currentMs - baselineMs) / DAY_MS;
  if (!calendar || !calendarHasUsableWorkPattern(calendar))
    return { calendarDays, workingDays: null };
  const dayHours = calendarWorkingDayHours(calendar);
  if (dayHours === null) return { calendarDays, workingDays: null };
  const hours = workingHoursBetween(calendar, baselineMs, currentMs);
  return { calendarDays, workingDays: Number((hours / dayHours).toFixed(6)) };
}

/** Summary of known working-day variances (null when none is known). */
export function workingDayVarianceSummary(values: readonly (number | null)[]): {
  comparableWorkingDayActivities: number;
  averageFinishVarianceWorkingDays: number | null;
  maximumDelayWorkingDays: number | null;
} {
  const known = values.filter((v): v is number => v !== null);
  return {
    comparableWorkingDayActivities: known.length,
    averageFinishVarianceWorkingDays: known.length
      ? Number((known.reduce((s, v) => s + v, 0) / known.length).toFixed(6))
      : null,
    maximumDelayWorkingDays: known.length
      ? Number(known.reduce((a, b) => Math.max(a, b), -Infinity).toFixed(6))
      : null,
  };
}
