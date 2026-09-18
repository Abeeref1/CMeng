import type {
  CanonicalScheduleActivity,
} from "../../schedule-analysis-core/src";
import type {
  WorkingCalendarResolution,
} from "./calendar";
import type {
  CpmDurationBasis,
} from "./types";

export interface DurationResolution {
  hours: number | null;
  method: string | null;
  assumptions: string[];
  diagnostics: string[];
}

function rawNumber(
  raw: string | null | undefined,
): number | null {
  if (!raw) return null;

  const match = raw
    .trim()
    .match(
      /^([+\-]?\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|min|mins|minute|minutes)?$/i,
    );

  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value)
    ? value
    : null;
}

function convertRaw(
  raw: string | null | undefined,
  unit:
    | "hours"
    | "days"
    | "weeks"
    | "minutes"
    | "unknown"
    | undefined,
  calendar: WorkingCalendarResolution,
): DurationResolution {
  const value = rawNumber(raw);
  if (value === null) {
    return {
      hours: null,
      method: null,
      assumptions: [],
      diagnostics:
        raw && raw.trim()
          ? ["CPM_DURATION_RAW_UNSUPPORTED:" + raw]
          : [],
    };
  }

  switch (unit) {
    case "hours":
      return {
        hours: value,
        method: "source_hours",
        assumptions: [],
        diagnostics: [],
      };
    case "minutes":
      return {
        hours: value / 60,
        method: "source_minutes_converted_to_hours",
        assumptions: [],
        diagnostics: [],
      };
    case "days": {
      const dayHours =
        calendar.calendar.standardDayHours;

      if (
        dayHours !== null &&
        dayHours !== undefined &&
        dayHours > 0
      ) {
        return {
          hours: value * dayHours,
          method:
            "source_days_converted_using_calendar_standard_day_hours",
          assumptions: [],
          diagnostics: [],
        };
      }

      if (
        calendar.mode === "elapsed_fallback"
      ) {
        return {
          hours: value * 24,
          method:
            "source_days_converted_using_elapsed_24h_fallback",
          assumptions: [
            "DURATION_DAY_UNIT_ASSUMED_24_ELAPSED_HOURS",
          ],
          diagnostics: [],
        };
      }

      return {
        hours: null,
        method: null,
        assumptions: [],
        diagnostics: [
          "CPM_DAY_DURATION_REQUIRES_UNIFORM_CALENDAR_DAY_HOURS",
        ],
      };
    }
    case "weeks": {
      const weekHours =
        calendar.calendar.standardWeekHours;

      if (
        weekHours !== null &&
        weekHours !== undefined &&
        weekHours > 0
      ) {
        return {
          hours: value * weekHours,
          method:
            "source_weeks_converted_using_calendar_week_hours",
          assumptions: [],
          diagnostics: [],
        };
      }

      if (
        calendar.mode === "elapsed_fallback"
      ) {
        return {
          hours: value * 168,
          method:
            "source_weeks_converted_using_elapsed_168h_fallback",
          assumptions: [
            "DURATION_WEEK_UNIT_ASSUMED_168_ELAPSED_HOURS",
          ],
          diagnostics: [],
        };
      }

      return {
        hours: null,
        method: null,
        assumptions: [],
        diagnostics: [
          "CPM_WEEK_DURATION_REQUIRES_CALENDAR_WEEK_HOURS",
        ],
      };
    }
    case "unknown":
    case undefined:
      return {
        hours: null,
        method: null,
        assumptions: [],
        diagnostics: [
          "CPM_DURATION_UNIT_UNKNOWN",
        ],
      };
  }
}

export function resolveActivityDuration(
  activity: CanonicalScheduleActivity,
  calendar: WorkingCalendarResolution,
  basis: CpmDurationBasis,
): DurationResolution {
  if (
    basis === "remaining" &&
    activity.status === "completed"
  ) {
    return {
      hours: 0,
      method: "completed_activity_zero_remaining_duration",
      assumptions: [],
      diagnostics: [],
    };
  }

  if (basis === "original") {
    if (
      activity.originalDurationHours !== null
    ) {
      return {
        hours:
          activity.originalDurationHours,
        method: "source_original_duration_hours",
        assumptions: [],
        diagnostics: [],
      };
    }

    return convertRaw(
      activity.originalDurationRaw,
      activity.originalDurationUnit,
      calendar,
    );
  }

  if (
    activity.remainingDurationHours !== null
  ) {
    return {
      hours:
        activity.remainingDurationHours,
      method: "source_remaining_duration_hours",
      assumptions: [],
      diagnostics: [],
    };
  }

  const rawRemaining = convertRaw(
    activity.remainingDurationRaw,
    activity.remainingDurationUnit,
    calendar,
  );

  if (rawRemaining.hours !== null) {
    return rawRemaining;
  }

  const original =
    activity.originalDurationHours !== null
      ? {
          hours:
            activity.originalDurationHours,
          method:
            "source_original_duration_hours",
          assumptions: [] as string[],
          diagnostics: [] as string[],
        }
      : convertRaw(
          activity.originalDurationRaw,
          activity.originalDurationUnit,
          calendar,
        );

  if (
    original.hours !== null &&
    activity.percentComplete !== null &&
    activity.percentComplete >= 0 &&
    activity.percentComplete <= 100
  ) {
    return {
      hours:
        original.hours *
        (1 -
          activity.percentComplete / 100),
      method:
        "derived_remaining_from_original_duration_and_percent_complete",
      assumptions: [
        "REMAINING_DURATION_DERIVED_FROM_PERCENT_COMPLETE",
        ...original.assumptions,
      ],
      diagnostics: [
        ...rawRemaining.diagnostics,
        ...original.diagnostics,
      ],
    };
  }

  if (
    original.hours !== null &&
    activity.status === "not_started"
  ) {
    return {
      hours: original.hours,
      method:
        "not_started_remaining_equals_original_duration",
      assumptions: [
        "NOT_STARTED_REMAINING_DURATION_ASSUMED_EQUAL_ORIGINAL",
        ...original.assumptions,
      ],
      diagnostics: [
        ...rawRemaining.diagnostics,
        ...original.diagnostics,
      ],
    };
  }

  return {
    hours: null,
    method: null,
    assumptions: [
      ...rawRemaining.assumptions,
      ...original.assumptions,
    ],
    diagnostics: [
      ...new Set([
        ...rawRemaining.diagnostics,
        ...original.diagnostics,
        "CPM_REMAINING_DURATION_UNRESOLVED",
      ]),
    ],
  };
}
