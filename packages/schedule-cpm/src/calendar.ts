import { parseScheduleTime } from "../../schedule-analysis-core/src/date-time";
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

// Exact shortcut for a *proved* exception-free, continuous source calendar.
// Every UTC instant is workable. Re-evaluate its source definition on every
// call so a later calendar edit never reuses stale working-time assumptions.
function continuousElapsedCalendar(calendar: CanonicalCalendar): boolean {
  return calendar.semanticComplete === true &&
    (calendar.exceptions?.length ?? 0) === 0 &&
    calendar.weeklyWorkMinutes?.length === 7 &&
    calendar.weeklyWorkMinutes.every(minutes => minutes === 1440) &&
    calendar.weeklyWorkIntervals?.length === 7 &&
    calendar.weeklyWorkIntervals.every((day, index) =>
      day.dayIndex === index + 1 &&
      day.intervals.length === 1 &&
      day.intervals[0]?.start === "00:00" &&
      day.intervals[0]?.finish === "24:00" &&
      day.intervals[0]?.minutes === 1440
    );
}

type WorkSegment = {
  startMs: number;
  finishMs: number;
};

const workSegmentCache =
  new WeakMap<
    CanonicalCalendar,
    Map<number, WorkSegment[]>
  >();

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
  return Math.floor(ms / DAY_MS) * DAY_MS;
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
): WorkSegment[] {
  const dayStart =
    utcDayStart(dateMs);
  let calendarCache =
    workSegmentCache.get(
      calendar,
    );
  if (!calendarCache) {
    calendarCache =
      new Map<
        number,
        WorkSegment[]
      >();
    workSegmentCache.set(
      calendar,
      calendarCache,
    );
  }
  const cached =
    calendarCache.get(
      dayStart,
    );
  if (cached) {
    return cached;
  }

  const current =
    intervalsForRawDate(
      calendar,
      dayStart,
    );
  const previousDay =
    dayStart - DAY_MS;
  const previous =
    intervalsForRawDate(
      calendar,
      previousDay,
    );

  const segments:
    WorkSegment[] = [];

  for (const interval of previous) {
    const start =
      minutesOfDay(
        interval.start,
      );
    const finish =
      minutesOfDay(
        interval.finish,
      );
    if (
      start !== null &&
      finish !== null &&
      finish < start
    ) {
      segments.push({
        startMs: dayStart,
        finishMs:
          dayStart +
          finish * 60_000,
      });
    }
  }

  for (const interval of current) {
    const start =
      minutesOfDay(
        interval.start,
      );
    const finish =
      minutesOfDay(
        interval.finish,
      );
    if (
      start === null ||
      finish === null
    ) {
      continue;
    }

    if (finish > start) {
      segments.push({
        startMs:
          dayStart +
          start * 60_000,
        finishMs:
          dayStart +
          finish * 60_000,
      });
    } else if (
      finish < start
    ) {
      segments.push({
        startMs:
          dayStart +
          start * 60_000,
        finishMs:
          dayStart +
          DAY_MS,
      });
    }
  }

  const resolved =
    segments
      .filter(
        (segment) =>
          segment.finishMs >
          segment.startMs,
      )
      .sort(
        (a, b) =>
          a.startMs -
          b.startMs,
      );
  calendarCache.set(
    dayStart,
    resolved,
  );
  return resolved;
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
      assumptions: source.reconciledFromP6Dates
        ? ["CALENDAR_P6_DATE_RECONCILIATION_QUALIFIED:"+source.calendarId]
        : [],
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

/** A source calendar that has no detailed working-time pattern but STATES its
 * hours per day (calendar table field day_hr_cnt / hours_per_day) and its days
 * per week (one "<n>D" / "<n> Day" token in the calendar name, e.g. 6D, 5D, 7D).
 * Which weekdays and shift times are worked is not stated, so only the stated
 * average weekly rate (hours per day x days per week) is established. Nothing
 * is assumed: no 8-hour day, no default week. A conflicting stated week-hours
 * value, several different day counts, or a missing value returns null. */
export interface StatedCalendarWorkBasis {
  calendarId: string;
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyHours: number;
  basis: "stated_hours_per_day_and_days_per_week";
}
export function statedCalendarWorkBasis(
  calendarId: string | null,
  calendars: readonly CanonicalCalendar[],
): StatedCalendarWorkBasis | null {
  if (calendarId === null) return null;
  const source = calendars.find((calendar) => calendar.calendarId === calendarId);
  if (!source || calendarHasUsableWorkPattern(source)) return null;
  const hoursPerDay = source.sourceConversionDayHours;
  if (typeof hoursPerDay !== "number" || !Number.isFinite(hoursPerDay) || hoursPerDay <= 0 || hoursPerDay > 24) return null;
  const counts = new Set<number>();
  for (const match of (source.name ?? "").matchAll(/(?:^|[^0-9a-z])([1-7])\s*-?\s*(?:days?|d)(?![a-wyz])/gi)) counts.add(Number(match[1]));
  if (counts.size !== 1) return null;
  const daysPerWeek = [...counts][0]!;
  const weeklyHours = hoursPerDay * daysPerWeek;
  const statedWeek = source.sourceConversionWeekHours;
  if (typeof statedWeek === "number" && Number.isFinite(statedWeek) && Math.abs(statedWeek - weeklyHours) > 0.001) return null;
  return { calendarId, hoursPerDay, daysPerWeek, weeklyHours, basis: "stated_hours_per_day_and_days_per_week" };
}

const instantParseMemo=new Map<string,number|null>();
export function parseScheduleInstant(value:string|null):number|null {
 if(!value)return null;
 if(instantParseMemo.has(value))return instantParseMemo.get(value)!;
 const parsed=/^\d{4}-\d{2}-\d{2}$/.test(value)?Date.parse(value+'T00:00:00Z'):parseScheduleTime(value);
 const result=Number.isFinite(parsed)?parsed:null;
 if(instantParseMemo.size>=32768)instantParseMemo.clear();
 instantParseMemo.set(value,result);return result;
}

const isoInstantMemo=new Map<number,string>();
export function isoInstant(
  ms: number | null,
): string | null {
  if(ms===null)return null;
  const cached=isoInstantMemo.get(ms);if(cached!==undefined)return cached;
  // A UTC instant has one representation irrespective of project or revision.
  // Keep the original invalid-instant exception rather than caching a fallback.
  const value=new Date(ms).toISOString();
  if(isoInstantMemo.size>=32768)isoInstantMemo.clear();
  isoInstantMemo.set(ms,value);return value;
}

export function nextWorkingInstant(
  calendar: CanonicalCalendar,
  instantMs: number,
): number {
  if (continuousElapsedCalendar(calendar)) return instantMs;
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
  if (continuousElapsedCalendar(calendar)) return instantMs;
  let searchDay = utcDayStart(instantMs);
  let probe = instantMs;

  for (let guard = 0; guard < 36525; guard += 1) {
    const segments =
      workSegmentsForDate(calendar, searchDay);

    for (
      let index = segments.length - 1;
      index >= 0;
      index -= 1
    ) {
      const segment = segments[index]!;

      if (probe >= segment.finishMs) {
        return segment.finishMs;
      }

      if (
        probe > segment.startMs &&
        probe < segment.finishMs
      ) {
        return probe;
      }
    }

    const nextBoundary = searchDay;
    searchDay -= DAY_MS;
    probe = nextBoundary;
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
  if (continuousElapsedCalendar(calendar)) return startMs + hours * HOUR_MS;
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
  if (continuousElapsedCalendar(calendar)) return finishMs - hours * HOUR_MS;
  if (hours < 0) {
    return addWorkingHours(
      calendar,
      finishMs,
      -hours,
    );
  }

  let cursor = finishMs;
  let remaining = hours * HOUR_MS;

  if (remaining === 0) {
    return previousWorkingInstant(
      calendar,
      cursor,
    );
  }

  for (let guard = 0; guard < 1_000_000; guard += 1) {
    const position =
      previousWorkingInstant(
        calendar,
        cursor,
      );

    let searchDay =
      utcDayStart(position);
    let segment:
      | {
          startMs: number;
          finishMs: number;
        }
      | null = null;

    for (
      let dayGuard = 0;
      dayGuard < 366;
      dayGuard += 1
    ) {
      const segments =
        workSegmentsForDate(
          calendar,
          searchDay,
        );

      segment =
        [...segments]
          .reverse()
          .find(
            (item) =>
              position >= item.startMs &&
              position <= item.finishMs &&
              position > item.startMs,
          ) ?? null;

      if (segment) break;

      searchDay -= DAY_MS;
    }

    if (!segment) {
      throw new Error(
        "No prior work segment found for subtraction",
      );
    }

    const effectivePosition =
      Math.min(
        position,
        segment.finishMs,
      );
    const available =
      effectivePosition -
      segment.startMs;

    if (remaining <= available) {
      return (
        effectivePosition - remaining
      );
    }

    remaining -= available;
    cursor = segment.startMs;
  }

  throw new Error(
    "Working-time subtraction exceeded iteration guard",
  );
}

// A dense CPM network repeatedly compares tens of thousands of source float
// dates that may be years apart. The original implementation scanned every
// intervening UTC day on EVERY activity. An immutable source calendar's exact
// working milliseconds can instead be summed once per calendar year.
// Partial first/last days still use the ORIGINAL segment intersection rule,
// including overnight shifts, holidays, duplicate intervals and exceptions.
// The cached result is per source calendar OBJECT (never calendar ID/project).
type YearWorkPrefix={startMs:number;endMs:number;totalMs:Float64Array};
const calendarWorkYears=new WeakMap<CanonicalCalendar,Map<number,YearWorkPrefix>>();
function yearStartUtc(year:number):number {
  const d=new Date(0);
  d.setUTCFullYear(year,0,1);
  d.setUTCHours(0,0,0,0);
  return d.getTime();
}
function partialDayWorkMs(calendar:CanonicalCalendar,dayStart:number,fromMs:number,toMs:number):number{
  let work=0;
  for(const part of workSegmentsForDate(calendar,dayStart)){
    const start=Math.max(dayStart,fromMs,part.startMs);
    const finish=Math.min(dayStart+DAY_MS,toMs,part.finishMs);
    if(finish>start)work+=finish-start;
  }
  return work;
}
function workYearPrefix(calendar:CanonicalCalendar,year:number):YearWorkPrefix {
  let perCalendar=calendarWorkYears.get(calendar);
  if(!perCalendar){perCalendar=new Map();calendarWorkYears.set(calendar,perCalendar);}
  const prior=perCalendar.get(year);if(prior)return prior;
  const startMs=yearStartUtc(year),endMs=yearStartUtc(year+1);
  const days=Math.round((endMs-startMs)/DAY_MS);
  const totalMs=new Float64Array(days+1);
  for(let day=0;day<days;day++){
    const at=startMs+day*DAY_MS;
    totalMs[day+1]=totalMs[day]!+partialDayWorkMs(calendar,at,at,at+DAY_MS);
  }
  const result={startMs,endMs,totalMs};
  perCalendar.set(year,result);
  return result;
}
function completeDayWorkMs(calendar:CanonicalCalendar,fromDay:number,toDayExclusive:number):number {
  let total=0,day=fromDay;
  while(day<toDayExclusive){
    const year=workYearPrefix(calendar,new Date(day).getUTCFullYear());
    const end=Math.min(toDayExclusive,year.endMs);
    const fromIndex=Math.round((day-year.startMs)/DAY_MS);
    const toIndex=Math.round((end-year.startMs)/DAY_MS);
    total+=year.totalMs[toIndex]!-year.totalMs[fromIndex]!;
    day=end;
  }
  return total;
}
export function workingHoursBetween(
  calendar: CanonicalCalendar,
  fromMs: number,
  toMs: number,
): number {
  if (fromMs === toMs) return 0;
  if (continuousElapsedCalendar(calendar)) return (toMs - fromMs) / HOUR_MS;
  if (toMs < fromMs) return -workingHoursBetween(calendar,toMs,fromMs);

  const firstDay=utcDayStart(fromMs),lastDay=utcDayStart(toMs);
  // Small windows need no yearly index. Retain exact original daily semantics.
  if(lastDay-firstDay<7*DAY_MS){
    let total=0;
    for(let day=firstDay;day<=lastDay;day+=DAY_MS)
      total+=partialDayWorkMs(calendar,day,fromMs,toMs);
    return total/HOUR_MS;
  }
  // The first and last day are handled by identical source-calendar segment
  // intersections. All intervening COMPLETE days use an immutable yearly prefix.
  const first=partialDayWorkMs(calendar,firstDay,fromMs,firstDay+DAY_MS);
  const middle=completeDayWorkMs(calendar,firstDay+DAY_MS,lastDay);
  const last=partialDayWorkMs(calendar,lastDay,lastDay,toMs);
  return (first+middle+last)/HOUR_MS;
}
