import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  activityNearCriticalThresholdHours,
  calendarWorkingDayHours,
  nearCriticalThresholdBasis,
  sourceFloatCriticality,
  sourceFloatInFloatRiskWatchlist,
  type CanonicalScheduleModel,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  NearCriticalBoundaryAuditRow,
  NearCriticalProjection,
} from "./types";

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

export function buildNearCriticalProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
  },
): NearCriticalProjection {
  const config =
    input.config ??
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG;

  const known = model.activities.filter(
    (activity) =>
      activity.totalFloatHours !== null,
  );

  const classified = known.map((activity) => ({
    activity,
    threshold:
      activityNearCriticalThresholdHours(
        model,
        activity,
        config,
      ),
  }));
  const rowFor = ({
    activity,
    threshold,
  }: (typeof classified)[number]) => ({
    activityId: activity.activityId,
    name: activity.name,
    wbsId: activity.wbsId,
    calendarId: activity.calendarId,
    status: activity.status,
    totalFloatHours:
      activity.totalFloatHours!,
    nearCriticalThresholdHours:
      threshold,
    baselineFinishIso:
      activity.baselineFinishIso,
    currentFinishIso:
      activity.forecastFinishIso ??
      activity.currentFinishIso ??
      activity.actualFinishIso,
    percentComplete:
      activity.percentComplete,
  });

  const boundaryAuditRows: NearCriticalBoundaryAuditRow[] =
    classified.map(({ activity, threshold }) => {
      const calendar =
        activity.calendarId === null
          ? null
          : model.calendars.find(
              (candidate) =>
                candidate.calendarId ===
                activity.calendarId,
            ) ?? null;
      const dayHours =
        calendarWorkingDayHours(calendar);
      const totalFloatWorkingDays =
        dayHours === null
          ? null
          : Number(
              (
                activity.totalFloatHours! /
                dayHours
              ).toFixed(6),
            );
      const exclusionReason =
        activity.activityType ===
          "level_of_effort"
          ? "level_of_effort" as const
          : activity.activityType ===
              "wbs_summary"
            ? "wbs_summary" as const
            : null;

      return {
        ...rowFor({
          activity,
          threshold,
        }),
        calendarWorkingDayHours:
          dayHours,
        totalFloatWorkingDays,
        criticality:
          sourceFloatCriticality(
            model,
            activity,
            config,
          ),
        floatRiskWatchlist:
          sourceFloatInFloatRiskWatchlist(
            model,
            activity,
            config,
          ),
        distanceFromCriticalBoundaryHours:
          Number(
            (
              activity.totalFloatHours! -
              config.criticalFloatThresholdHours
            ).toFixed(6),
          ),
        distanceFromNearCriticalUpperHours:
          threshold === null
            ? null
            : Number(
                (
                  activity.totalFloatHours! -
                  threshold
                ).toFixed(6),
              ),
        analysisEligible:
          exclusionReason === null,
        exclusionReason,
      };
    });

  const byCriticalDistance = (
    rows: NearCriticalBoundaryAuditRow[],
  ) =>
    [...rows].sort(
      (a, b) =>
        Math.abs(
          a.distanceFromCriticalBoundaryHours,
        ) -
          Math.abs(
            b.distanceFromCriticalBoundaryHours,
          ) ||
        a.activityId.localeCompare(
          b.activityId,
          undefined,
          { numeric: true },
        ),
    );

  const byUpperDistance = (
    rows: NearCriticalBoundaryAuditRow[],
  ) =>
    [...rows].sort(
      (a, b) =>
        Math.abs(
          a.distanceFromNearCriticalUpperHours ??
            Number.POSITIVE_INFINITY,
        ) -
          Math.abs(
            b.distanceFromNearCriticalUpperHours ??
              Number.POSITIVE_INFINITY,
          ) ||
        a.activityId.localeCompare(
          b.activityId,
          undefined,
          { numeric: true },
        ),
    );

  const belowCriticalBoundary =
    boundaryAuditRows.filter(
      (row) =>
        row.totalFloatHours <
        config.criticalFloatThresholdHours,
    );
  const atCriticalBoundary =
    boundaryAuditRows.filter(
      (row) =>
        row.totalFloatHours ===
        config.criticalFloatThresholdHours,
    );
  const aboveCriticalBoundary =
    boundaryAuditRows.filter(
      (row) =>
        row.totalFloatHours >
        config.criticalFloatThresholdHours,
    );
  const nearCriticalUpperInside =
    boundaryAuditRows.filter(
      (row) =>
        row.distanceFromCriticalBoundaryHours >
          0 &&
        row.distanceFromNearCriticalUpperHours !==
          null &&
        row.distanceFromNearCriticalUpperHours <=
          0,
    );
  const nearCriticalUpperOutside =
    boundaryAuditRows.filter(
      (row) =>
        row.distanceFromNearCriticalUpperHours !==
          null &&
        row.distanceFromNearCriticalUpperHours >
          0,
    );
  const unresolvedCalendar =
    boundaryAuditRows.filter(
      (row) =>
        row.nearCriticalThresholdHours ===
        null,
    );

  const rows = classified
    .filter(
      ({ activity, threshold }) =>
        threshold !== null &&
        sourceFloatCriticality(
          model,
          activity,
          config,
        ) === "near_critical",
    )
    .map(rowFor)
    .sort(
      (a, b) =>
        a.totalFloatHours -
          b.totalFloatHours ||
        a.activityId.localeCompare(
          b.activityId,
          undefined,
          { numeric: true },
        ),
    );

  const watchlistRows = classified
    .filter(
      ({ activity, threshold }) =>
        threshold !== null &&
        sourceFloatInFloatRiskWatchlist(
          model,
          activity,
          config,
        ) === true,
    )
    .map(rowFor)
    .sort(
      (a, b) =>
        a.totalFloatHours -
          b.totalFloatHours ||
        a.activityId.localeCompare(
          b.activityId,
          undefined,
          { numeric: true },
        ),
    );

  return {
    schemaVersion: "1.0",
    projectionKey: "near_critical",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    criticalThresholdHours:
      config.criticalFloatThresholdHours,
    nearCriticalThresholdHours:
      config.nearCriticalWorkingDays !== undefined &&
      config.nearCriticalWorkingDays !== null
        ? null
        : config.nearCriticalFloatThresholdHours,
    nearCriticalThresholdWorkingDays:
      config.nearCriticalWorkingDays ?? null,
    thresholdBasis:
      nearCriticalThresholdBasis(config) ===
      "activity_working_days"
        ? "activity_calendar_working_days"
        : "explicit_hours",
    floatCoveragePercent: coverage(
      known.length,
      model.activities.length,
    ),
    classificationCoveragePercent: coverage(
      classified.filter(
        ({ activity, threshold }) =>
          activity.totalFloatHours! <=
            config.criticalFloatThresholdHours ||
          threshold !== null,
      ).length,
      model.activities.length,
    ),
    nearCriticalCount: rows.length,
    floatRiskWatchlistCount:
      watchlistRows.length,
    zeroFloatCount: known.filter(
      (activity) =>
        activity.totalFloatHours ===
        0,
    ).length,
    negativeFloatCount: known.filter(
      (activity) =>
        activity.totalFloatHours! < 0,
    ).length,
    floatRiskWatchlistIncludesCriticalThreshold:
      config.floatRiskWatchlistIncludesCriticalThreshold === true,
    rows,
    watchlistRows,
    boundaryAudit: {
      sampleSizePerSide: 100,
      criticalBoundaryHours:
        config.criticalFloatThresholdHours,
      belowCriticalBoundaryCount:
        belowCriticalBoundary.length,
      atCriticalBoundaryCount:
        atCriticalBoundary.length,
      aboveCriticalBoundaryCount:
        aboveCriticalBoundary.length,
      nearCriticalUpperInsideCount:
        nearCriticalUpperInside.length,
      nearCriticalUpperOutsideCount:
        nearCriticalUpperOutside.length,
      unresolvedCalendarCount:
        unresolvedCalendar.length,
      belowCriticalBoundary:
        byCriticalDistance(
          belowCriticalBoundary,
        ).slice(0, 100),
      atCriticalBoundary:
        byCriticalDistance(
          atCriticalBoundary,
        ).slice(0, 100),
      aboveCriticalBoundary:
        byCriticalDistance(
          aboveCriticalBoundary,
        ).slice(0, 100),
      nearCriticalUpperInside:
        byUpperDistance(
          nearCriticalUpperInside,
        ).slice(0, 100),
      nearCriticalUpperOutside:
        byUpperDistance(
          nearCriticalUpperOutside,
        ).slice(0, 100),
      unresolvedCalendar:
        unresolvedCalendar.slice(
          0,
          100,
        ),
    },
  };
}
