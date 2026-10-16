import {aggregateCount} from '../../truth-kernel/src/aggregates';
import {activityDateExceptionReader,activityDelayStatus} from './exceptions';
import {
  buildScheduleActivityLogicIndex,
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  activityNearCriticalThresholdHours,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  ActivityAnalyticsProjection,
  ActivityAnalyticsRow,
  ActivityCriticality,
} from "./types";

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function classifyFloat(
  activity: CanonicalScheduleActivity,
  config: ScheduleAnalysisConfig,
  upper: number | null,
): {criticality:ActivityCriticality;floatRiskWatchlist:boolean|null} {
  const hours=activity.totalFloatHours;
  if(hours===null)return {criticality:"unknown",floatRiskWatchlist:null};
  const criticality:ActivityCriticality=hours<=config.criticalFloatThresholdHours?"critical"
    :upper===null?"unknown":hours<=upper?"near_critical":"noncritical";
  const lowerSatisfied=config.floatRiskWatchlistIncludesCriticalThreshold===true
    ?hours>=config.criticalFloatThresholdHours:hours>config.criticalFloatThresholdHours;
  return {criticality,floatRiskWatchlist:upper===null?null:lowerSatisfied&&hours<=upper};
}

function effectiveFinish(
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
    activity.currentFinishIso
  );
}

function finishVarianceDays(
  activity: CanonicalScheduleActivity,
  sourceInstant: (date: string) => number = Date.parse,
): number | null {
  if (!activity.baselineFinishIso) return null;
  const current = effectiveFinish(activity);
  if (!current) return null;

  const baselineMs = sourceInstant(
    activity.baselineFinishIso,
  );
  const currentMs = sourceInstant(current);

  if (
    !Number.isFinite(baselineMs) ||
    !Number.isFinite(currentMs)
  ) {
    return null;
  }

  return Number(
    (
      (currentMs - baselineMs) /
      86_400_000
    ).toFixed(6),
  );
}

export function activityAnalyticsCounts(rows: readonly ActivityAnalyticsRow[]) {
  const executionRows = rows.filter(row => !['level_of_effort', 'wbs_summary'].includes(row.activityType));
  const openRows=executionRows.filter(row=>row.status!=='completed');
  return {
    critical: aggregateCount(openRows, row => row.totalFloatHours === null ? null : row.criticality === 'critical'),
    nearCritical: aggregateCount(openRows, row => row.criticality === 'unknown' || row.floatRiskWatchlist === null ? null : row.criticality === 'near_critical'),
    floatRisk: aggregateCount(openRows, row => row.floatRiskWatchlist),
    late: aggregateCount(openRows, row => row.finishVarianceDays === null ? null : row.finishVarianceDays > 0),
    missedStart: aggregateCount(executionRows, row => row.missedPlannedStart),
    overdueFinish: aggregateCount(executionRows, row => row.finishOverdue),
    scheduleDelayed: aggregateCount(executionRows, row => activityDelayStatus(row).scheduleDelayed),
  };
}

export function buildActivityAnalyticsProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
  },
): ActivityAnalyticsProjection {
  const config =
    input.config ??
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG;
  const logic =
    buildScheduleActivityLogicIndex(model,true);
  const dateExceptions=activityDateExceptionReader(model.dataDateIso);
  // Preserve Date.parse interpretation, including invalid source values, but
  // avoid reparsing the same submitted dates for every activity. The index is
  // strictly local to this evaluation, so a later update cannot reuse old
  // dates or quietly turn a missing date into zero.
  const sourceDates=new Map<string,number>();
  const sourceInstant=(date:string):number=>{
    if(sourceDates.has(date))return sourceDates.get(date)!;
    const value=Date.parse(date);sourceDates.set(date,value);return value;
  };
  // First source occurrence wins even when a submitted calendar ID repeats.
  // Preserve all source calendars; avoid repeated full-calendar searching for
  // each of the 8k–100k activity rows of this exact source evaluation.
  const calendarById=new Map<string,CanonicalScheduleModel['calendars'][number]>();
  for(const calendar of model.calendars)
    if(!calendarById.has(calendar.calendarId))calendarById.set(calendar.calendarId,calendar);

  // First-calendar thresholds are reused only within this exact projection.
  const nearByCalendar=new Map<string|null,number|null>();
  const position=(activity:CanonicalScheduleActivity)=>{
    if(activity.totalFloatHours===null)return classifyFloat(activity,config,null);
    const id=activity.calendarId;
    if(!nearByCalendar.has(id))
      nearByCalendar.set(id,activityNearCriticalThresholdHours(model,activity,config,calendarById));
    return classifyFloat(activity,config,nearByCalendar.get(id)!);
  };
  const rows: ActivityAnalyticsRow[] =
    model.activities.map((activity) => {
      const entry =
        logic.byActivityId[activity.activityId];
      const predecessors =
        [...(entry?.predecessorIds ?? [])];
      const successors =
        [...(entry?.successorIds ?? [])];
      const dates=dateExceptions(activity);
      const variance=finishVarianceDays(activity,sourceInstant);
      const floatPosition=position(activity);
      // Same values and key order as spreading `dates` and the delay status,
      // without allocating two temporary objects for every source activity.
      const delay=activityDelayStatus({missedPlannedStart:dates.missedPlannedStart,finishOverdue:dates.finishOverdue,status:activity.status,finishVarianceDays:variance});

      return {
        activityId: activity.activityId,
        name: activity.name,
        wbsId: activity.wbsId,
        calendarId: activity.calendarId,
        activityType: activity.activityType,
        status: activity.status,

        baselineStartIso:
          activity.baselineStartIso,
        baselineFinishIso:
          activity.baselineFinishIso,
        currentStartIso:
          activity.currentStartIso,
        currentFinishIso:
          activity.currentFinishIso,
        actualStartIso:
          activity.actualStartIso,
        actualFinishIso:
          activity.actualFinishIso,
        forecastStartIso:
          activity.forecastStartIso,
        forecastFinishIso:
          activity.forecastFinishIso,

        percentComplete:
          activity.percentComplete,
        originalDurationHours:
          activity.originalDurationHours,
        remainingDurationHours:
          activity.remainingDurationHours,
        totalFloatHours:
          activity.totalFloatHours,
        freeFloatHours:
          activity.freeFloatHours,

        criticality:floatPosition.criticality,
        floatRiskWatchlist:floatPosition.floatRiskWatchlist,
        finishVarianceDays: variance,
        missedPlannedStart: dates.missedPlannedStart,
        finishOverdue: dates.finishOverdue,
        startOverdueCalendarDays: dates.startOverdueCalendarDays,
        finishOverdueCalendarDays: dates.finishOverdueCalendarDays,
        scheduleDelayed: delay.scheduleDelayed,
        delayStatus: delay.delayStatus,

        predecessorIds: predecessors,
        successorIds: successors,
        predecessorCount: predecessors.length,
        successorCount: successors.length,
        openStart: predecessors.length === 0,
        openFinish: successors.length === 0,
        isolated:
          predecessors.length === 0 &&
          successors.length === 0,

        diagnostics: [
          ...activity.diagnostics,
        ],
      };
    });

  const counts = activityAnalyticsCounts(rows);
  const unfinishedExecution = rows.filter(row => row.status !== 'completed' && !['wbs_summary','level_of_effort'].includes(row.activityType));
  return {
    schemaVersion: "1.0",
    projectionKey: "activity_analytics",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    activityCount: rows.length,
    counts,
    population: {
      sourceActivityCount: rows.length,
      executableActivityCount:
        rows.filter(
          (row) =>
            row.activityType !== "wbs_summary" &&
            row.activityType !== "level_of_effort",
        ).length,
      excludedActivityCount:
        rows.filter(
          (row) =>
            row.activityType === "wbs_summary" ||
            row.activityType === "level_of_effort",
        ).length,
      excludedByType: {
        wbsSummaryCount:
          rows.filter(
            (row) => row.activityType === "wbs_summary",
          ).length,
        levelOfEffortCount:
          rows.filter(
            (row) => row.activityType === "level_of_effort",
          ).length,
        otherExcludedCount: 0,
      },
      rowPopulation: "all_source_activities",
    },
    floatCoveragePercent: coverage(
      unfinishedExecution.filter(
        (row) => row.totalFloatHours !== null,
      ).length,
      unfinishedExecution.length,
    ),
    percentCompleteCoveragePercent: coverage(
      rows.filter(
        (row) => row.percentComplete !== null,
      ).length,
      rows.length,
    ),
    finishVarianceCoveragePercent: coverage(
      rows.filter(
        (row) =>
          row.finishVarianceDays !== null,
      ).length,
      rows.length,
    ),
    rows,
    diagnostics: [
      ...model.diagnostics,
      ...logic.brokenRelationshipIds.map(
        (relationshipId) =>
          "ACTIVITY_ANALYTICS_BROKEN_RELATIONSHIP:" +
          relationshipId,
      ),
    ],
  };
}

export function serializeActivityAnalyticsProjection(
  projection: ActivityAnalyticsProjection,
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(projection),
  );
}
