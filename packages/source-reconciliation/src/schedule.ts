import { reconcileByKey } from "./core";
import type {
  ReconciliationResult,
  ScheduleCanonicalActivity,
} from "./types";

function scheduleKey(
  activity: ScheduleCanonicalActivity,
): string {
  return (activity.projectId ?? "?") + "::" + activity.activityId;
}

export function reconcileSchedules(
  left: readonly ScheduleCanonicalActivity[],
  right: readonly ScheduleCanonicalActivity[],
  leftSource: string,
  rightSource: string,
): ReconciliationResult {
  return reconcileByKey({
    leftSource,
    rightSource,
    left,
    right,
    key: scheduleKey,
    fields: [
      {
        name: "name",
        value: (activity) => activity.name,
        normalizeText: true,
      },
      {
        name: "wbsRef",
        value: (activity) => activity.wbsRef,
      },
      {
        name: "calendarRef",
        value: (activity) => activity.calendarRef,
      },
      {
        name: "startIso",
        value: (activity) => activity.startIso,
      },
      {
        name: "finishIso",
        value: (activity) => activity.finishIso,
      },
      {
        name: "originalDurationHours",
        value: (activity) => activity.originalDurationHours,
        numericTolerance: 0.0001,
      },
      {
        name: "remainingDurationHours",
        value: (activity) => activity.remainingDurationHours,
        numericTolerance: 0.0001,
      },
      {
        name: "totalFloatHours",
        value: (activity) => activity.totalFloatHours,
        numericTolerance: 0.0001,
      },
    ],
  });
}
