import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  MilestoneRow,
  MilestonesProjection,
} from "./types";

function dateMs(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function currentDate(
  activity: CanonicalScheduleActivity,
): string | null {
  if (
    activity.status === "completed" &&
    activity.actualFinishIso
  ) {
    return activity.actualFinishIso;
  }
  return (
    activity.forecastFinishIso ??
    activity.currentFinishIso ??
    activity.currentStartIso
  );
}

function daysBetween(
  from: string | null,
  to: string | null,
): number | null {
  const fromMs = dateMs(from);
  const toMs = dateMs(to);
  if (fromMs === null || toMs === null) {
    return null;
  }
  return Number(
    ((toMs - fromMs) / 86_400_000).toFixed(6),
  );
}

export function buildMilestonesProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): MilestonesProjection {
  const milestoneTypes = new Set([
    "milestone",
    "start_milestone",
    "finish_milestone",
  ]);

  const rows: MilestoneRow[] =
    model.activities
      .filter((activity) =>
        milestoneTypes.has(
          activity.activityType,
        ),
      )
      .map((activity) => {
        const current = currentDate(activity);
        return {
          activityId: activity.activityId,
          name: activity.name,
          wbsId: activity.wbsId,
          activityType:
            activity.activityType,
          status: activity.status,
          baselineDateIso:
            activity.baselineFinishIso ??
            activity.baselineStartIso,
          currentDateIso: current,
          actualDateIso:
            activity.actualFinishIso ??
            activity.actualStartIso,
          totalFloatHours:
            activity.totalFloatHours,
          varianceDays: daysBetween(
            activity.baselineFinishIso ??
              activity.baselineStartIso,
            current,
          ),
          daysFromDataDate: daysBetween(
            model.dataDateIso,
            current,
          ),
        };
      })
      .sort((a, b) =>
        (a.currentDateIso ?? "9999").localeCompare(
          b.currentDateIso ?? "9999",
        ),
      );

  const completed = rows.filter(
    (row) => row.status === "completed",
  );
  const open = rows.filter(
    (row) => row.status !== "completed",
  );

  return {
    schemaVersion: "1.0",
    projectionKey: "milestones",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    milestoneCount: rows.length,
    completedCount: completed.length,
    openCount: open.length,
    lateOpenCount: open.filter(
      (row) =>
        row.daysFromDataDate !== null &&
        row.daysFromDataDate < 0,
    ).length,
    rows,
  };
}
