import { parseScheduleTime } from "./date-time";
import { activityPopulation, scheduleProgress } from "./population";
import { analyzeScheduleGraph } from "./graph";
import {
  activityNearCriticalThresholdHours,
  nearCriticalThresholdBasis,
} from "./float-thresholds";
import type {
  AverageMetric,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
  CompletionBasisValue,
  FloatSummary,
  MilestoneSummary,
  ProgressSummary,
  ScheduleAnalysisConfig,
  ScheduleAnalyticsResult,
  VarianceSummary,
} from "./types";
import { DEFAULT_SCHEDULE_ANALYSIS_CONFIG } from "./types";

function coveragePercent(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function validIsoDate(value: string | null): number | null {
  if (!value) return null;
  const ms = parseScheduleTime(value);
  return Number.isFinite(ms) ? ms : null;
}

function maxDate(
  values: Array<{
    dateIso: string | null;
    activityId: string;
    sourceRef: string;
  }>,
  sourceInstant: (value:string|null)=>number|null = validIsoDate,
): {
  dateIso: string | null;
  activityId: string | null;
  sourceRef: string | null;
} {
  let best:
    | {
        ms: number;
        dateIso: string;
        activityId: string;
        sourceRef: string;
      }
    | null = null;

  for (const value of values) {
    const ms = sourceInstant(value.dateIso);
    if (ms === null || !value.dateIso) continue;
    if (!best || ms > best.ms) {
      best = {
        ms,
        dateIso: value.dateIso,
        activityId: value.activityId,
        sourceRef: value.sourceRef,
      };
    }
  }

  return best
    ? {
        dateIso: best.dateIso,
        activityId: best.activityId,
        sourceRef: best.sourceRef,
      }
    : {
        dateIso: null,
        activityId: null,
        sourceRef: null,
      };
}

function statusSummary(
  activities: readonly CanonicalScheduleActivity[],
) {
  // One counting pass; the same four exact status matches as four filters.
  let completed = 0, inProgress = 0, notStarted = 0, unknown = 0;
  for (const activity of activities) {
    const status = activity.status;
    if (status === "completed") completed++;
    else if (status === "in_progress") inProgress++;
    else if (status === "not_started") notStarted++;
    else if (status === "unknown") unknown++;
  }
  return { completed, inProgress, notStarted, unknown };
}

function averagePercentComplete(
  activities: readonly CanonicalScheduleActivity[],
): AverageMetric {
  const known = activities.filter(
    (activity) =>
      activity.percentComplete !== null &&
      activity.percentComplete >= 0 &&
      activity.percentComplete <= 100,
  );

  return {
    value:
      known.length === 0
        ? null
        : Number(
            (
              known.reduce(
                (sum, activity) =>
                  sum + activity.percentComplete!,
                0,
              ) / known.length
            ).toFixed(6),
          ),
    knownCount: known.length,
    totalCount: activities.length,
    coveragePercent: coveragePercent(
      known.length,
      activities.length,
    ),
  };
}

function durationWeightedPercentComplete(activities: readonly CanonicalScheduleActivity[]): AverageMetric {
  return scheduleProgress(activities);
}

function progressSummary(
  activities: readonly CanonicalScheduleActivity[],
): ProgressSummary {
  return {
    status: statusSummary(activities),
    percentCompleteAverage:
      averagePercentComplete(activities),
    durationWeightedPercentComplete:
      durationWeightedPercentComplete(activities),
  };
}

function floatSummary(
  model: CanonicalScheduleModel,
  activities: readonly CanonicalScheduleActivity[],
  config: ScheduleAnalysisConfig,
): FloatSummary {
  // One full, source-qualified pass over unfinished execution work.
  // Earlier independent filters repeated calendar/criticality lookups and
  // full-population walks. Preserve *all* existing count/unknown rules.
  const unfinished=activities.filter(activity=>activity.status!=='completed');
  // Keep only the FIRST source calendar with a given ID, just as the original
  // scalar reader does. The index lives for this calculation alone: no mutable
  // source model, project decision, or calendar authority is cached globally.
  const calendarById=new Map<string,CanonicalScheduleModel['calendars'][number]>();
  for(const calendar of model.calendars)
    if(!calendarById.has(calendar.calendarId))calendarById.set(calendar.calendarId,calendar);
  let knownCount=0,critical=0,nearCritical=0,noncritical=0,unknownClassifications=0;
  let unresolvedThreshold=0,watchlist=0,zeroFloat=0,negativeFloat=0,positiveFloat=0;
  for(const activity of unfinished){
    const value=activity.totalFloatHours;
    if(value===null){unknownClassifications++;continue;}
    knownCount++;
    // A single calendar-qualified threshold is sufficient for the original
    // criticality, near-critical and watchlist definitions. Compare against
    // the public scalar source functions in the independent regression.
    const threshold=activityNearCriticalThresholdHours(model,activity,config,calendarById);
    const classification=value<=config.criticalFloatThresholdHours?'critical'
      :threshold===null?'unknown':value<=threshold?'near_critical':'noncritical';
    if(classification==='critical')critical++;
    else if(classification==='near_critical')nearCritical++;
    else if(classification==='noncritical')noncritical++;
    else unknownClassifications++;
    // A critical activity can have known criticality but an unresolved
    // calendar-dependent watchlist threshold. That uncertainty is retained.
    if(threshold===null)unresolvedThreshold++;
    if(threshold!==null
      &&(config.floatRiskWatchlistIncludesCriticalThreshold===true
        ?value>=config.criticalFloatThresholdHours
        :value>config.criticalFloatThresholdHours)
      &&value<=threshold)watchlist++;
    if(value===0)zeroFloat++;
    if(value<0)negativeFloat++;
    if(value>0)positiveFloat++;
  }
  const complete=knownCount===unfinished.length;
  const nearComplete=complete&&unresolvedThreshold===0;
  return {
    criticalCount:complete?critical:null,
    knownClassifications:{critical,nearCritical,noncritical,unknown:unknownClassifications},
    nearCriticalCount:nearComplete?nearCritical:null,
    floatRiskWatchlistCount:nearComplete?watchlist:null,
    zeroFloatCount:complete?zeroFloat:null,
    negativeFloatCount:complete?negativeFloat:null,
    positiveFloatCount:complete?positiveFloat:null,
    unknownFloatCount:unfinished.length-knownCount,
    knownFloatCount:knownCount,
    totalActivities:unfinished.length,
    coveragePercent:coveragePercent(knownCount,unfinished.length),
    criticalThresholdHours:config.criticalFloatThresholdHours,
    nearCriticalThresholdHours:config.nearCriticalWorkingDays!==undefined&&config.nearCriticalWorkingDays!==null?null:config.nearCriticalFloatThresholdHours,
    nearCriticalWorkingDays:config.nearCriticalWorkingDays??null,
    nearCriticalThresholdBasis:nearCriticalThresholdBasis(config),
    floatRiskWatchlistIncludesCriticalThreshold:config.floatRiskWatchlistIncludesCriticalThreshold===true,
    nearCriticalThresholdUnresolvedCount:unresolvedThreshold,
  };
}

function milestoneSummary(
  activities: readonly CanonicalScheduleActivity[],
): MilestoneSummary {
  const milestones = activities.filter((activity) =>
    [
      "milestone",
      "start_milestone",
      "finish_milestone",
    ].includes(activity.activityType),
  );

  return {
    milestoneActivityIds: milestones.map(
      (activity) => activity.activityId,
    ),
    completedMilestones: milestones
      .filter(
        (activity) => activity.status === "completed",
      )
      .map((activity) => activity.activityId),
    openMilestones: milestones
      .filter(
        (activity) => activity.status !== "completed",
      )
      .map((activity) => activity.activityId),
    inferredFromZeroDurationIds: milestones
      .filter(
        (activity) =>
          activity.activityType === "milestone" &&
          activity.originalDurationHours === 0,
      )
      .map((activity) => activity.activityId),
  };
}

function effectiveCurrentFinish(
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
    null
  );
}

function finishVariance(
  activities: readonly CanonicalScheduleActivity[],
  config: ScheduleAnalysisConfig,
  sourceInstant: (value:string|null)=>number|null = validIsoDate,
): VarianceSummary {
  const variances: number[] = [];

  for (const activity of activities) {
    const baseline = sourceInstant(
      activity.baselineFinishIso,
    );
    const current = sourceInstant(
      effectiveCurrentFinish(activity),
    );

    if (baseline === null || current === null) {
      continue;
    }

    variances.push(
      (current - baseline) / 86_400_000,
    );
  }

  const late = variances.filter(
    (days) =>
      days > config.varianceLateThresholdDays,
  );
  const early = variances.filter(
    (days) =>
      days < -config.varianceLateThresholdDays,
  );
  const onTime =
    variances.length - late.length - early.length;

  return {
    method:
      "baseline finish vs completed actual finish, otherwise explicit forecast/current finish",
    comparableActivities: variances.length,
    lateActivities: late.length,
    earlyActivities: early.length,
    onTimeActivities: onTime,
    unknownActivities:
      activities.length - variances.length,
    averageFinishVarianceDays:
      variances.length === 0
        ? null
        : Number(
            (
              variances.reduce(
                (sum, value) => sum + value,
                0,
              ) / variances.length
            ).toFixed(6),
          ),
    maximumDelayDays:
      variances.length === 0
        ? null
        : Number(
            variances.reduce((a,b)=>Math.max(a,b),-Infinity).toFixed(6),
          ),
    coveragePercent: coveragePercent(
      variances.length,
      activities.length,
    ),
  };
}

function completionBases(
  activities: readonly CanonicalScheduleActivity[],
  sourceInstant: (value:string|null)=>number|null = validIsoDate,
): CompletionBasisValue[] {
  const total = activities.length;

  // One pass over the same source population. Each basis keeps the FIRST
  // source record holding the latest valid date (strictly later replaces),
  // exactly as maxDate() over the filtered lists did, and builds a source
  // reference only for the selected record instead of for every activity.
  type Latest = { ms: number; dateIso: string; activityId: string } | null;
  let programmeLatest: Latest = null, forecastLatest: Latest = null, actualLatest: Latest = null;
  let programmeCount = 0, forecastCount = 0, actualCount = 0, completedCount = 0;
  for (const activity of activities) {
    const baselineMs = sourceInstant(activity.baselineFinishIso);
    if (baselineMs !== null) {
      programmeCount++;
      if (!programmeLatest || baselineMs > programmeLatest.ms)
        programmeLatest = { ms: baselineMs, dateIso: activity.baselineFinishIso!, activityId: activity.activityId };
    }
    const effectiveFinish = effectiveCurrentFinish(activity);
    const forecastMs = sourceInstant(effectiveFinish);
    if (forecastMs !== null) {
      forecastCount++;
      if (!forecastLatest || forecastMs > forecastLatest.ms)
        forecastLatest = { ms: forecastMs, dateIso: effectiveFinish!, activityId: activity.activityId };
    }
    if (activity.status === "completed") {
      completedCount++;
      const actualMs = sourceInstant(activity.actualFinishIso);
      if (actualMs !== null) {
        actualCount++;
        if (!actualLatest || actualMs > actualLatest.ms)
          actualLatest = { ms: actualMs, dateIso: activity.actualFinishIso!, activityId: activity.activityId };
      }
    }
  }
  const selected = (latest: Latest, field: string) => latest
    ? { dateIso: latest.dateIso, activityId: latest.activityId, sourceRef: "activity:" + latest.activityId + ":" + field }
    : { dateIso: null, activityId: null, sourceRef: null };
  const programme = selected(programmeLatest, "baselineFinish");
  const forecast = selected(forecastLatest, "effectiveCurrentFinish");
  const actual = selected(actualLatest, "actualFinish");
  const programmeKnown = { length: programmeCount };
  const forecastKnown = { length: forecastCount };
  const completed = { length: completedCount };
  const actualKnown = { length: actualCount };

  const stateFor = (
    known: number,
    totalCount: number,
  ): "available" | "partial" | "missing" => {
    if (known === 0) return "missing";
    return known === totalCount
      ? "available"
      : "partial";
  };

  return [
    {
      basis: "programme",
      dateIso: programme.dateIso,
      activityId: programme.activityId,
      state: stateFor(
        programmeKnown.length,
        total,
      ),
      coveragePercent: coveragePercent(
        programmeKnown.length,
        total,
      ),
      method:
        "latest source baseline/programme finish across executable activities",
      sourceRefs: programme.sourceRef
        ? [programme.sourceRef]
        : [],
    },
    {
      basis: "forecast",
      dateIso: forecast.dateIso,
      activityId: forecast.activityId,
      state: stateFor(
        forecastKnown.length,
        total,
      ),
      coveragePercent: coveragePercent(
        forecastKnown.length,
        total,
      ),
      method:
        "latest completed actual finish, otherwise explicit forecast/current finish",
      sourceRefs: forecast.sourceRef
        ? [forecast.sourceRef]
        : [],
    },
    {
      basis: "actual",
      dateIso:
        completed.length === total &&
        actualKnown.length === total
          ? actual.dateIso
          : null,
      activityId:
        completed.length === total &&
        actualKnown.length === total
          ? actual.activityId
          : null,
      state:
        completed.length === total &&
        actualKnown.length === total &&
        total > 0
          ? "available"
          : actualKnown.length > 0
            ? "partial"
            : "missing",
      coveragePercent: coveragePercent(
        actualKnown.length,
        total,
      ),
      method:
        "actual project completion is published only when all executable activities are complete with actual finish dates",
      sourceRefs:
        completed.length === total &&
        actualKnown.length === total &&
        actual.sourceRef
          ? [actual.sourceRef]
          : [],
    },
  ];
}

/** Exact original source completion facts, without graph/float/progress work
 * after CPM. Visit each executable source record once; keep the original
 * analyzeSchedule().completionBases as an independent, unchanged parity oracle.
 * Invalid dates remain missing and tied maximum dates retain their first
 * source record, never a fabricated finish or a different authority. */
export function sourceScheduleCompletionBases(model: CanonicalScheduleModel): CompletionBasisValue[] {
  const activities=activityPopulation(model).activities;
  const total=activities.length;
  type Selected={time:number;dateIso:string;activityId:string;sourceRef:string};
  // The source date was already parsed for known/missing coverage. Carry its
  // validated timestamp into the source-order maximum; do not parse a 100k-row
  // baseline, forecast or actual date a second time.
  const choose=(prior:Selected|null,dateIso:string|null,time:number,activityId:string,field:string):Selected|null=>{
    if(!dateIso||prior&&time<=prior.time)return prior;
    return {time,dateIso,activityId,sourceRef:"activity:"+activityId+":"+field};
  };
  let programme:Selected|null=null,forecast:Selected|null=null,actual:Selected|null=null;
  let programmeKnown=0,forecastKnown=0,actualKnown=0,completed=0;
  for(const activity of activities){
    const baselineTime=validIsoDate(activity.baselineFinishIso);
    if(baselineTime!==null){
      programmeKnown++;
      programme=choose(programme,activity.baselineFinishIso,baselineTime,activity.activityId,"baselineFinish");
    }
    const effectiveFinish=effectiveCurrentFinish(activity);
    const forecastTime=validIsoDate(effectiveFinish);
    if(forecastTime!==null){
      forecastKnown++;
      forecast=choose(forecast,effectiveFinish,forecastTime,activity.activityId,"effectiveCurrentFinish");
    }
    if(activity.status==="completed"){
      completed++;
      const actualTime=validIsoDate(activity.actualFinishIso);
      if(actualTime!==null){
        actualKnown++;
        actual=choose(actual,activity.actualFinishIso,actualTime,activity.activityId,"actualFinish");
      }
    }
  }
  const stateFor=(known:number):"available"|"partial"|"missing"=>
    known===0?"missing":known===total?"available":"partial";
  const actualEstablished=total>0&&completed===total&&actualKnown===total;
  return [
    {basis:"programme",dateIso:programme?.dateIso??null,activityId:programme?.activityId??null,
      state:stateFor(programmeKnown),coveragePercent:coveragePercent(programmeKnown,total),
      method:"latest source baseline/programme finish across executable activities",
      sourceRefs:programme?[programme.sourceRef]:[]},
    {basis:"forecast",dateIso:forecast?.dateIso??null,activityId:forecast?.activityId??null,
      state:stateFor(forecastKnown),coveragePercent:coveragePercent(forecastKnown,total),
      method:"latest completed actual finish, otherwise explicit forecast/current finish",
      sourceRefs:forecast?[forecast.sourceRef]:[]},
    {basis:"actual",dateIso:actualEstablished?actual?.dateIso??null:null,
      activityId:actualEstablished?actual?.activityId??null:null,
      state:actualEstablished?"available":actualKnown>0?"partial":"missing",
      coveragePercent:coveragePercent(actualKnown,total),
      method:"actual project completion is published only when all executable activities are complete with actual finish dates",
      sourceRefs:actualEstablished&&actual?[actual.sourceRef]:[]},
  ];
}

export function analyzeSchedule(
  model: CanonicalScheduleModel,
  config: ScheduleAnalysisConfig =
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
): ScheduleAnalyticsResult {
  // The elapsed-hour upper bound is a legacy alternative basis. Once a
  // working-day rule is active, each activity calendar supplies the operative
  // hour-equivalent threshold, so the legacy hour value must not invalidate it.
  const usesWorkingDayNearCriticalRule =
    config.nearCriticalWorkingDays !== undefined &&
    config.nearCriticalWorkingDays !== null;

  if (
    !usesWorkingDayNearCriticalRule &&
    config.nearCriticalFloatThresholdHours <
      config.criticalFloatThresholdHours
  ) {
    throw new Error(
      "nearCriticalFloatThresholdHours cannot be below criticalFloatThresholdHours when the near-critical basis is elapsed hours",
    );
  }

  // A programme repeats a small number of genuine calendar dates across
  // thousands of activities and revisions. Parse each original source date
  // only once within this exact analysis; a new call has a fresh map and cannot
  // reuse values from a different project, revision, or mutable source update.
  // Null and invalid dates remain unknown, never zero or silently normalized.
  const sourceInstants=new Map<string,number|null>();
  const sourceInstant=(value:string|null):number|null=>{
    if(!value)return null;
    if(sourceInstants.has(value))return sourceInstants.get(value)!;
    const parsed=validIsoDate(value);
    sourceInstants.set(value,parsed);
    return parsed;
  };
  const activities = activityPopulation(model).activities;
  const wbsSummaryCount = model.activities.filter(
    (activity) => activity.activityType === "wbs_summary",
  ).length;
  const levelOfEffortCount = model.activities.filter(
    (activity) => activity.activityType === "level_of_effort",
  ).length;
  const excludedActivityCount =
    model.activities.length - activities.length;
  const graph = analyzeScheduleGraph(model);
  const executionIds = new Set(activities.map(a => a.activityId));
  const executableIds = (ids: string[]) => ids.filter(id => executionIds.has(id));
  const executionOpenStarts = executableIds(graph.openStartActivityIds);
  const executionOpenFinishes = executableIds(graph.openFinishActivityIds);
  const openStartIds=new Set(executionOpenStarts),openFinishIds=new Set(executionOpenFinishes);
  const boundaryCandidates = activities.filter(a =>
    a.activityType === "start_milestone" && openStartIds.has(a.activityId) ||
    a.activityType === "finish_milestone" && openFinishIds.has(a.activityId)).map(a=>a.activityId);
  const logicQuality = {
    state: executionOpenStarts.length || executionOpenFinishes.length || !graph.complete ? "review_required" as const : "no_detected_exceptions" as const,
    executionOpenStartActivityIds: executionOpenStarts, executionOpenFinishActivityIds: executionOpenFinishes,
    executionIsolatedActivityIds: executableIds(graph.isolatedActivityIds),
    excludedIsolatedActivityIds: graph.isolatedActivityIds.filter(id => !executionIds.has(id)),
    boundaryCandidateActivityIds: boundaryCandidates,
    boundaryApprovalState: "not_established" as const,
    interpretation: "Computational graph integrity does not establish adequate sequencing. Boundary candidates require governed confirmation; source records remain auditable.",
  };
  const diagnostics = [
    ...model.diagnostics,
    ...graph.diagnostics,
  ];

  return {
    projectId: model.projectId,
    sourceRevisionId: model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    graph,
    logicQuality,
    population: {
      sourceActivityCount: model.activities.length,
      executableActivityCount: activities.length,
      excludedActivityCount,
      excludedByType: {
        wbsSummaryCount,
        levelOfEffortCount,
        otherExcludedCount:
          Math.max(
            0,
            excludedActivityCount -
              wbsSummaryCount -
              levelOfEffortCount,
          ),
      },
      basis: "execution_control_population",
    },
    status: statusSummary(activities),
    progress: progressSummary(activities),
    float: floatSummary(model, activities, config),
    milestones: milestoneSummary(activities),
    finishVariance: finishVariance(
      activities,
      config,
      sourceInstant,
    ),
    completionBases: completionBases(activities,sourceInstant),
    activityCount: model.activities.length,
    relationshipCount:
      model.relationships.length,
    wbsCount: model.wbs.length,
    calendarCount: model.calendars.length,
    diagnostics,
    complete:
      graph.complete &&
      model.diagnostics.length === 0,
  };
}
