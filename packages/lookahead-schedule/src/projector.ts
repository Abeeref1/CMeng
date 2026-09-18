import {
  buildScheduleActivityLogicIndex,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  LookAheadActivityRow,
  LookAheadProjection,
} from "./types";

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(msValue: number): string {
  return new Date(msValue).toISOString().slice(0, 10);
}

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function effectiveStart(
  activity: CanonicalScheduleActivity,
): string | null {
  if (activity.actualStartIso) {
    return activity.actualStartIso;
  }
  return (
    activity.forecastStartIso ??
    activity.currentStartIso
  );
}

function effectiveFinish(
  activity: CanonicalScheduleActivity,
): string | null {
  if (activity.actualFinishIso) {
    return activity.actualFinishIso;
  }
  return (
    activity.forecastFinishIso ??
    activity.currentFinishIso
  );
}

export function buildLookAheadProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    windowDays?: number;
  },
): LookAheadProjection {
  const windowDays = input.windowDays ?? 42;
  if (
    !Number.isSafeInteger(windowDays) ||
    windowDays <= 0
  ) {
    throw new Error(
      "Look-ahead windowDays must be a positive integer",
    );
  }

  const dataDateMs = ms(model.dataDateIso);
  const windowEndMs =
    dataDateMs === null
      ? null
      : dataDateMs +
        windowDays * 86_400_000;

  const logic =
    buildScheduleActivityLogicIndex(model);

  const incomplete = model.activities.filter(
    (activity) =>
      activity.status !== "completed" &&
      activity.activityType !== "wbs_summary",
  );

  const missingCurrentDateActivityIds: string[] = [];
  const rows: LookAheadActivityRow[] = [];

  for (const activity of incomplete) {
    const startIso = effectiveStart(activity);
    const finishIso = effectiveFinish(activity);
    const startMs = ms(startIso);
    const finishMs = ms(finishIso);

    if (
      dataDateMs === null ||
      startMs === null ||
      finishMs === null
    ) {
      missingCurrentDateActivityIds.push(
        activity.activityId,
      );
      continue;
    }

    const isOverdue =
      finishMs < dataDateMs;
    const overlapsWindow =
      startMs <= windowEndMs! &&
      finishMs >= dataDateMs;

    if (!isOverdue && !overlapsWindow) {
      continue;
    }

    let classification:
      LookAheadActivityRow["classification"];

    if (isOverdue) {
      classification = "overdue";
    } else if (
      startMs <= dataDateMs &&
      finishMs >= dataDateMs
    ) {
      classification = "ongoing";
    } else if (
      finishMs <= windowEndMs!
    ) {
      classification =
        "finishing_in_window";
    } else {
      classification = "upcoming";
    }

    const activityLogic =
      logic.byActivityId[activity.activityId];

    rows.push({
      activityId: activity.activityId,
      name: activity.name,
      wbsId: activity.wbsId,
      activityType: activity.activityType,
      status: activity.status,
      startIso,
      finishIso,
      baselineFinishIso:
        activity.baselineFinishIso,
      percentComplete:
        activity.percentComplete,
      totalFloatHours:
        activity.totalFloatHours,
      classification,
      predecessorIds:
        activityLogic?.predecessorIds ?? [],
      successorIds:
        activityLogic?.successorIds ?? [],
      daysToStart: Number(
        (
          (startMs - dataDateMs) /
          86_400_000
        ).toFixed(6),
      ),
      daysToFinish: Number(
        (
          (finishMs - dataDateMs) /
          86_400_000
        ).toFixed(6),
      ),
    });
  }

  rows.sort((a, b) => {
    const aDate = a.finishIso ?? "9999";
    const bDate = b.finishIso ?? "9999";
    return (
      aDate.localeCompare(bDate) ||
      a.activityId.localeCompare(
        b.activityId,
        undefined,
        { numeric: true },
      )
    );
  });

  return {
    schemaVersion: "1.0",
    projectionKey: "lookahead_schedule",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    windowDays,
    windowEndIso:
      windowEndMs === null
        ? null
        : dateOnly(windowEndMs),
    incompleteActivityCount:
      incomplete.length,
    datedIncompleteActivityCount:
      incomplete.length -
      missingCurrentDateActivityIds.length,
    currentDateCoveragePercent: coverage(
      incomplete.length -
        missingCurrentDateActivityIds.length,
      incomplete.length,
    ),
    overdueCount: rows.filter(
      (row) => row.classification === "overdue",
    ).length,
    rows,
    missingCurrentDateActivityIds:
      missingCurrentDateActivityIds.sort(),
  };
}
