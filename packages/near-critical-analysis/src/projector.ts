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

  const boundaryAuditRowFor = ({
    activity,
    threshold,
  }: (typeof classified)[number]) => {
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
    const floatWorkingDays =
      dayHours === null
        ? null
        : Number(
            (
              activity.totalFloatHours! /
              dayHours
            ).toFixed(6),
          );
    const classification =
      sourceFloatCriticality(
        model,
        activity,
        config,
      );
    const watchlist =
      sourceFloatInFloatRiskWatchlist(
        model,
        activity,
        config,
      );
    const distanceUpperHours =
      threshold === null
        ? null
        : Number(
            (
              activity.totalFloatHours! -
              threshold
            ).toFixed(6),
          );
    const distanceUpperWorkingDays =
      floatWorkingDays === null ||
      config.nearCriticalWorkingDays === undefined ||
      config.nearCriticalWorkingDays === null
        ? null
        : Number(
            (
              floatWorkingDays -
              config.nearCriticalWorkingDays
            ).toFixed(6),
          );

    let inclusionReason =
      "outside_float_risk_band";
    if (threshold === null) {
      inclusionReason =
        "calendar_threshold_unresolved";
    } else if (
      activity.totalFloatHours! <
      config.criticalFloatThresholdHours
    ) {
      inclusionReason =
        "below_critical_threshold";
    } else if (
      activity.totalFloatHours ===
      config.criticalFloatThresholdHours
    ) {
      inclusionReason =
        watchlist === true
          ? "critical_boundary_included_in_float_risk_watchlist"
          : "critical_boundary_excluded_from_float_risk_watchlist";
    } else if (
      classification ===
      "near_critical"
    ) {
      inclusionReason =
        "strict_near_critical";
    } else if (
      distanceUpperHours !== null &&
      distanceUpperHours > 0
    ) {
      inclusionReason =
        "above_near_critical_upper_boundary";
    }

    return {
      activityId:
        activity.activityId,
      name:
        activity.name,
      calendarId:
        activity.calendarId,
      calendarSemanticComplete:
        calendar
          ? calendar.semanticComplete
          : null,
      totalFloatSourceRefs:
        activity.sourceRefs.map(
          (ref) =>
            ref.source + ":" +
            ref.locator,
        ),
      calendarSourceRefs:
        (calendar?.sourceRefs ?? []).map(
          (ref) =>
            ref.source + ":" +
            ref.locator,
        ),
      totalFloatHours:
        activity.totalFloatHours!,
      calendarWorkingDayHours:
        dayHours,
      totalFloatWorkingDays:
        floatWorkingDays,
      criticalThresholdHours:
        config.criticalFloatThresholdHours,
      nearCriticalThresholdWorkingDays:
        config.nearCriticalWorkingDays ??
        null,
      nearCriticalThresholdHours:
        threshold,
      distanceFromCriticalThresholdHours:
        Number(
          (
            activity.totalFloatHours! -
            config.criticalFloatThresholdHours
          ).toFixed(6),
        ),
      distanceFromNearCriticalUpperBoundaryHours:
        distanceUpperHours,
      distanceFromNearCriticalUpperBoundaryWorkingDays:
        distanceUpperWorkingDays,
      criticality:
        classification,
      floatRiskWatchlist:
        watchlist,
      inclusionReason,
    };
  };

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

  const boundaryAuditRows =
    classified.map(
      boundaryAuditRowFor,
    );
  const SAMPLE_LIMIT = 100;
  const byCriticalDistance = (
    a: ReturnType<typeof boundaryAuditRowFor>,
    b: ReturnType<typeof boundaryAuditRowFor>,
  ) =>
    Math.abs(
      a.distanceFromCriticalThresholdHours,
    ) -
      Math.abs(
        b.distanceFromCriticalThresholdHours,
      ) ||
    a.activityId.localeCompare(
      b.activityId,
      undefined,
      { numeric: true },
    );
  const byUpperDistance = (
    a: ReturnType<typeof boundaryAuditRowFor>,
    b: ReturnType<typeof boundaryAuditRowFor>,
  ) =>
    Math.abs(
      a.distanceFromNearCriticalUpperBoundaryWorkingDays ??
        Number.POSITIVE_INFINITY,
    ) -
      Math.abs(
        b.distanceFromNearCriticalUpperBoundaryWorkingDays ??
          Number.POSITIVE_INFINITY,
      ) ||
    a.activityId.localeCompare(
      b.activityId,
      undefined,
      { numeric: true },
    );

  const boundaryAudit = {
    sampleLimitPerSide:
      SAMPLE_LIMIT,
    sourceRevisionId:
      model.sourceRevisionId,
    totalFloatSourceField:
      "TASK.total_float_hr_cnt" as const,
    calendarJoinField:
      "TASK.clndr_id -> CALENDAR.clndr_id" as const,
    criticalBoundary: {
      thresholdHours:
        config.criticalFloatThresholdHours,
      below:
        boundaryAuditRows
          .filter(
            (row) =>
              row.totalFloatHours <
              config.criticalFloatThresholdHours,
          )
          .sort(byCriticalDistance)
          .slice(0, SAMPLE_LIMIT),
      at:
        boundaryAuditRows
          .filter(
            (row) =>
              row.totalFloatHours ===
              config.criticalFloatThresholdHours,
          )
          .sort(
            (a, b) =>
              a.activityId.localeCompare(
                b.activityId,
                undefined,
                { numeric: true },
              ),
          )
          .slice(0, SAMPLE_LIMIT),
      above:
        boundaryAuditRows
          .filter(
            (row) =>
              row.totalFloatHours >
              config.criticalFloatThresholdHours,
          )
          .sort(byCriticalDistance)
          .slice(0, SAMPLE_LIMIT),
    },
    nearCriticalUpperBoundary: {
      thresholdWorkingDays:
        config.nearCriticalWorkingDays ??
        null,
      inside:
        boundaryAuditRows
          .filter(
            (row) =>
              row.distanceFromNearCriticalUpperBoundaryWorkingDays !==
                null &&
              row.distanceFromNearCriticalUpperBoundaryWorkingDays <=
                0,
          )
          .sort(byUpperDistance)
          .slice(0, SAMPLE_LIMIT),
      outside:
        boundaryAuditRows
          .filter(
            (row) =>
              row.distanceFromNearCriticalUpperBoundaryWorkingDays !==
                null &&
              row.distanceFromNearCriticalUpperBoundaryWorkingDays >
                0,
          )
          .sort(byUpperDistance)
          .slice(0, SAMPLE_LIMIT),
    },
  };

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
    boundaryAudit,
  };
}
