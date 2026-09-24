import type {
  CanonicalCalendar,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
  ScheduleAnalysisConfig,
} from "./types";

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function calendarWorkingDayHours(
  calendar: CanonicalCalendar | null | undefined,
): number | null {
  if (!calendar || calendar.semanticComplete===false) return null;

  const standard = finitePositive(calendar.standardDayHours);
  if (standard !== null) return standard;

  if (calendar.weeklyWorkMinutes) {
    const working = calendar.weeklyWorkMinutes.filter(
      (minutes) => Number.isFinite(minutes) && minutes > 0,
    );
    if (working.length > 0) {
      return Number(
        (
          working.reduce((sum, minutes) => sum + minutes, 0) /
          working.length /
          60
        ).toFixed(6),
      );
    }
  }

  if (calendar.weeklyWorkIntervals) {
    const working = calendar.weeklyWorkIntervals
      .map((day) =>
        day.intervals.reduce(
          (sum, interval) =>
            sum +
            (Number.isFinite(interval.minutes) && interval.minutes > 0
              ? interval.minutes
              : 0),
          0,
        ),
      )
      .filter((minutes) => minutes > 0);
    if (working.length > 0) {
      return Number(
        (
          working.reduce((sum, minutes) => sum + minutes, 0) /
          working.length /
          60
        ).toFixed(6),
      );
    }
  }

  return null;
}

export function activityNearCriticalThresholdHours(
  model: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
  config: ScheduleAnalysisConfig,
): number | null {
  const calendar=activity.calendarId===null?null:model.calendars.find(c=>c.calendarId===activity.calendarId)??null;
  if(activity.calendarId!==null&&(!calendar||calendar.semanticComplete===false))return null;
  if (
    config.nearCriticalWorkingDays !== undefined &&
    config.nearCriticalWorkingDays !== null
  ) {
    if (
      !Number.isFinite(config.nearCriticalWorkingDays) ||
      config.nearCriticalWorkingDays < 0
    ) {
      return null;
    }

    const dayHours = calendarWorkingDayHours(calendar);
    return dayHours === null
      ? null
      : Number((dayHours * config.nearCriticalWorkingDays).toFixed(6));
  }

  return Number.isFinite(config.nearCriticalFloatThresholdHours)
    ? config.nearCriticalFloatThresholdHours
    : null;
}

export function sourceFloatCriticality(
  model: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
  config: ScheduleAnalysisConfig,
): "critical" | "near_critical" | "noncritical" | "unknown" {
  if (activity.totalFloatHours === null) return "unknown";

  if (
    activity.totalFloatHours <=
    config.criticalFloatThresholdHours
  ) {
    return "critical";
  }

  const near = activityNearCriticalThresholdHours(
    model,
    activity,
    config,
  );
  if (near === null) return "unknown";

  return activity.totalFloatHours <= near
    ? "near_critical"
    : "noncritical";
}

export function sourceFloatInFloatRiskWatchlist(
  model: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
  config: ScheduleAnalysisConfig,
): boolean | null {
  if (activity.totalFloatHours === null) return null;

  const upper =
    activityNearCriticalThresholdHours(
      model,
      activity,
      config,
    );
  if (upper === null) return null;

  const lowerSatisfied =
    config.floatRiskWatchlistIncludesCriticalThreshold === true
      ? activity.totalFloatHours >=
        config.criticalFloatThresholdHours
      : activity.totalFloatHours >
        config.criticalFloatThresholdHours;

  return (
    lowerSatisfied &&
    activity.totalFloatHours <= upper
  );
}

export function nearCriticalThresholdBasis(
  config: ScheduleAnalysisConfig,
): "elapsed_hours" | "activity_working_days" {
  return config.nearCriticalWorkingDays !== undefined &&
    config.nearCriticalWorkingDays !== null
    ? "activity_working_days"
    : "elapsed_hours";
}
