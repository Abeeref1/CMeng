import type {
  CanonicalCalendar,
} from "../../schedule-analysis-core/src";

export interface WorkingCalendarResolution {
  calendar: CanonicalCalendar;
  mode:
    | "source_calendar"
    | "elapsed_fallback";
  assumptions: string[];
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const ELAPSED_24H_CALENDAR: CanonicalCalendar = {
  calendarId: "__ELAPSED_24H__",
  name: "24/7 elapsed-time fallback",
  semanticComplete: true,
  weeklyWorkMinutes: [
    1440, 1440, 1440, 1440, 1440, 1440, 1440,
  ],
  weeklyWorkIntervals: [
    1, 2, 3, 4, 5, 6, 7,
  ].map((dayIndex) => ({
    dayIndex,
    intervals: [
      {
        start: "00:00",
        finish: "24:00",
        minutes: 1440,
      },
    ],
  })),
  exceptions: [],
  standardDayHours: 24,
  standardWeekHours: 168,
  sourceRefs: [],
};

function utcDayStart(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function dayIndex(ms: number): number {
  return new Date(ms).getUTCDay() + 1;
}

function minutesOfDay(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute < 0 || minute > 59) return null;
  if (hour === 24 && minute === 0) return 1440;
  if (hour < 0 || hour > 23) return null;
  return hour * 60 + minute;
}

function intervalsForRawDate(
  calendar: CanonicalCalendar,
  dateMs: number,
): Array<{
  start: string;
  finish: string;
  minutes: number;
}> {
  const exception = calendar.exceptions?.find(
    (item) => item.isoDate === isoDay(dateMs),
  );

  if (exception) {
    if (exception.nonWorking) return [];
    return exception.workIntervals;
  }

  return (
    calendar.weeklyWorkIntervals?.find(
      (item) => item.dayIndex === dayIndex(dateMs),
    )?.intervals ?? []
  );
}

function workSegmentsForDate(
  calendar: CanonicalCalendar,
  dateMs: number,
): Array<{ startMs: number; finishMs: number }> {
  const dayStart = utcDayStart(dateMs);
  const current = intervalsForRawDate(
    calendar,
    dayStart,
  );
  const previousDay = dayStart - DAY_MS;
  const previous = intervalsForRawDate(
    calendar,
    previousDay,
  );

  const segments: Array<{
    startMs: number;
    finishMs: number;
  }> = [];

  for (const interval of previous) {
    const start = minutesOfDay(interval.start);
    const finish = minutesOfDay(interval.finish);
    if (
      start !== null &&
      finish !== null &&
      finish < start
    ) {
      segments.push({
        startMs: dayStart,
        finishMs:
          dayStart + finish * 60_000,
      });
    }
  }

  for (const interval of current) {
    const start = minutesOfDay(interval.start);
    const finish = minutesOfDay(interval.finish);
    if (start === null || finish === null) continue;

    if (finish > start) {
      segments.push({
        startMs:
          dayStart + start * 60_000,
        finishMs:
          dayStart + finish * 60_000,
      });
    } else if (finish < start) {
      segments.push({
        startMs:
          dayStart + start * 60_000,
        finishMs: dayStart + DAY_MS,
      });
    }
  }

  return segments
    .filter(
      (segment) =>
        segment.finishMs > segment.startMs,
    )
    .sort((a, b) => a.startMs - b.startMs);
}

export function calendarHasUsableWorkPattern(
  calendar: CanonicalCalendar,
): boolean {
  return (
    calendar.semanticComplete &&
    (calendar.weeklyWorkIntervals?.some(
      (day) => day.intervals.length > 0,
    ) ?? false)
  );
}

export function resolveWorkingCalendar(
  calendarId: string | null,
  calendars: readonly CanonicalCalendar[],
  allowElapsedFallback: boolean,
): WorkingCalendarResolution | null {
  const source =
    calendarId === null
      ? null
      : calendars.find(
          (calendar) =>
            calendar.calendarId === calendarId,
        ) ?? null;

  if (
    source &&
    calendarHasUsableWorkPattern(source)
  ) {
    return {
      calendar: source,
      mode: "source_calendar",
      assumptions: [],
    };
  }

  if (!allowElapsedFallback) return null;

  return {
    calendar: ELAPSED_24H_CALENDAR,
    mode: "elapsed_fallback",
    assumptions: [
      calendarId
        ? "CALENDAR_" +
          calendarId +
          "_UNAVAILABLE_OR_UNRESOLVED_ASSUMED_24H_ELAPSED"
        : "ACTIVITY_CALENDAR_MISSING_ASSUMED_24H_ELAPSED",
    ],
  };
}

export function parseScheduleInstant(
  value: string | null,
): number | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = Date.parse(
      value + "T00:00:00Z",
    );
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export function isoInstant(
  ms: number | null,
): string | null {
  return ms === null
    ? null
    : new Date(ms).toISOString();
}

export function nextWorkingInstant(
  calendar: CanonicalCalendar,
  instantMs: number,
): number {
  let cursor = instantMs;

  for (let guard = 0; guard < 36525; guard += 1) {
    const dayStart = utcDayStart(cursor);
    const segments =
      workSegmentsForDate(calendar, dayStart);

    for (const segment of segments) {
      if (cursor < segment.startMs) {
        return segment.startMs;
      }
      if (
        cursor >= segment.startMs &&
        cursor < segment.finishMs
      ) {
        return cursor;
      }
    }

    cursor = dayStart + DAY_MS;
  }

  throw new Error(
    "No future working time found within calendar guard",
  );
}

export function previousWorkingInstant(
  calendar: CanonicalCalendar,
  instantMs: number,
): number {
  let cursor = instantMs;

  for (let guard = 0; guard < 36525; guard += 1) {
    const dayStart = utcDayStart(cursor);
    const segments =
      workSegmentsForDate(calendar, dayStart);

    for (
      let index = segments.length - 1;
      index >= 0;
      index -= 1
    ) {
      const segment = segments[index]!;
      if (cursor > segment.finishMs) {
        return segment.finishMs;
      }
      if (
        cursor > segment.startMs &&
        cursor <= segment.finishMs
      ) {
        return cursor;
      }
    }

    cursor = dayStart - 1;
  }

  throw new Error(
    "No prior working time found within calendar guard",
  );
}

export function addWorkingHours(
  calendar: CanonicalCalendar,
  startMs: number,
  hours: number,
): number {
  if (!Number.isFinite(hours)) {
    throw new Error("Working hours must be finite");
  }
  if (hours < 0) {
    return subtractWorkingHours(
      calendar,
      startMs,
      -hours,
    );
  }

  let cursor =
    nextWorkingInstant(calendar, startMs);
  let remaining = hours * HOUR_MS;

  if (remaining === 0) return cursor;

  for (let guard = 0; guard < 1_000_000; guard += 1) {
    const segments = workSegmentsForDate(
      calendar,
      cursor,
    );
    const segment = segments.find(
      (item) =>
        cursor >= item.startMs &&
        cursor < item.finishMs,
    );

    if (!segment) {
      cursor = nextWorkingInstant(
        calendar,
        cursor,
      );
      continue;
    }

    const available =
      segment.finishMs - cursor;

    if (remaining <= available) {
      return cursor + remaining;
    }

    remaining -= available;
    cursor = nextWorkingInstant(
      calendar,
      segment.finishMs,
    );
  }

  throw new Error(
    "Working-time addition exceeded iteration guard",
  );
}

export function subtractWorkingHours(
  calendar: CanonicalCalendar,
  finishMs: number,
  hours: number,
): number {
  if (!Number.isFinite(hours)) {
    throw new Error("Working hours must be finite");
  }
  if (hours < 0) {
    return addWorkingHours(
      calendar,
      finishMs,
      -hours,
    );
  }

  let cursor =
    previousWorkingInstant(calendar, finishMs);
  let remaining = hours * HOUR_MS;

  if (remaining === 0) return cursor;

  for (let guard = 0; guard < 1_000_000; guard += 1) {
    const segments = workSegmentsForDate(
      calendar,
      cursor,
    );
    const segment = [...segments]
      .reverse()
      .find(
        (item) =>
          cursor > item.startMs &&
          cursor <= item.finishMs,
      );

    if (!segment) {
      cursor = previousWorkingInstant(
        calendar,
        cursor,
      );
      continue;
    }

    const available =
      cursor - segment.startMs;

    if (remaining <= available) {
      return cursor - remaining;
    }

    remaining -= available;
    cursor = previousWorkingInstant(
      calendar,
      segment.startMs,
    );
  }

  throw new Error(
    "Working-time subtraction exceeded iteration guard",
  );
}

export function workingHoursBetween(
  calendar: CanonicalCalendar,
  fromMs: number,
  toMs: number,
): number {
  if (fromMs === toMs) return 0;

  if (toMs < fromMs) {
    return -workingHoursBetween(
      calendar,
      toMs,
      fromMs,
    );
  }

  let totalMs = 0;
  let day = utcDayStart(fromMs);
  const lastDay = utcDayStart(toMs);

  for (let guard = 0; guard < 36525; guard += 1) {
    const segments =
      workSegmentsForDate(calendar, day);

    for (const segment of segments) {
      const start = Math.max(
        fromMs,
        segment.startMs,
      );
      const finish = Math.min(
        toMs,
        segment.finishMs,
      );
      if (finish > start) {
        totalMs += finish - start;
      }
    }

    if (day >= lastDay) break;
    day += DAY_MS;
  }

  return totalMs / HOUR_MS;
}
