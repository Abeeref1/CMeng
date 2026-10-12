import {naturalCompare} from '../../shared/src/natural-order';
import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  activityPopulation,
  numericDistribution,
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

function wbsPathLookup(model:CanonicalScheduleModel):Map<string,string>{
  const nodes=new Map((model.wbs??[]).map(node=>[node.wbsId,node])),cache=new Map<string,string>();
  const pathFor=(id:string|null):string=>{
    if(!id)return '';const cached=cache.get(id);if(cached!==undefined)return cached;
    const parts:string[]=[],seen=new Set<string>();let current:string|null=id;
    while(current&&!seen.has(current)){seen.add(current);const node=nodes.get(current);if(!node)break;parts.unshift(node.name??node.wbsId);current=node.parentWbsId??null;}
    const value=parts.join(' / ');cache.set(id,value);return value;
  };
  for(const id of nodes.keys())pathFor(id);return cache;
}

function downstreamMilestoneLookup(model:CanonicalScheduleModel):Map<string,string[]>{
  const byId=new Map(model.activities.map(a=>[a.activityId,a]));
  const predecessors=new Map<string,string[]>();
  for(const rel of model.relationships){
    if(rel.external||!byId.has(rel.predecessorActivityId)||!byId.has(rel.successorActivityId))continue;
    const rows=predecessors.get(rel.successorActivityId)??[];rows.push(rel.predecessorActivityId);predecessors.set(rel.successorActivityId,rows);
  }
  const bestDepth=new Map<string,number>(),milestonesByActivity=new Map<string,Set<string>>();
  const queue:Array<{id:string;milestoneId:string;depth:number}>=[];
  for(const activity of model.activities){
    if(activity.activityType!=='start_milestone'&&activity.activityType!=='finish_milestone')continue;
    bestDepth.set(activity.activityId,0);
    milestonesByActivity.set(activity.activityId,new Set([activity.activityId]));
    queue.push({id:activity.activityId,milestoneId:activity.activityId,depth:0});
  }
  for(let index=0;index<queue.length;index++){
    const current=queue[index]!;
    for(const predecessorId of predecessors.get(current.id)??[]){
      const depth=current.depth+1,knownDepth=bestDepth.get(predecessorId);
      if(knownDepth===undefined||depth<knownDepth){
        bestDepth.set(predecessorId,depth);
        milestonesByActivity.set(predecessorId,new Set([current.milestoneId]));
        queue.push({id:predecessorId,milestoneId:current.milestoneId,depth});
      }else if(depth===knownDepth){
        const set=milestonesByActivity.get(predecessorId)??new Set<string>();
        if(!set.has(current.milestoneId)&&set.size<8){
          set.add(current.milestoneId);milestonesByActivity.set(predecessorId,set);
          queue.push({id:predecessorId,milestoneId:current.milestoneId,depth});
        }
      }
    }
  }
  return new Map([...milestonesByActivity.entries()].map(([id,set])=>[id,[...set].sort(naturalCompare).slice(0,5)]));
}

export function buildNearCriticalProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
    controlledBaseline?: { revisionId: string; finishByActivity: ReadonlyMap<string, string | null> } | null;
    previousFloat?: { revisionId: string; totalFloatByActivity: ReadonlyMap<string, number | null> } | null;
  },
): NearCriticalProjection {
  const config =
    input.config ??
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG;

  const population = activityPopulation(model);
  const unfinished=population.activities.filter(activity=>activity.status!=='completed');
  const wbsPaths=wbsPathLookup(model);
  const downstreamMilestones=downstreamMilestoneLookup(model);
  const known = unfinished.filter(
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
    wbsPath: activity.wbsId ? wbsPaths.get(activity.wbsId) ?? null : null,
    affectedMilestoneIds: downstreamMilestones.get(activity.activityId)??[],
    calendarId: activity.calendarId,
    status: activity.status,
    totalFloatHours:
      activity.totalFloatHours!,
    previousTotalFloatHours:
      input.previousFloat?.totalFloatByActivity.get(activity.activityId) ?? null,
    floatErosionHours:
      (() => {
        const previous = input.previousFloat?.totalFloatByActivity.get(activity.activityId) ?? null;
        return previous === null
          ? null
          : Number((previous - activity.totalFloatHours!).toFixed(6));
      })(),
    nearCriticalThresholdHours:
      threshold,
    baselineFinishIso:
      input.controlledBaseline ? input.controlledBaseline.finishByActivity.get(activity.activityId) ?? null
        : activity.baselineDateBasis === "controlled_baseline" ? activity.baselineFinishIso : null,
    sourceTargetFinishIso: activity.baselineDateBasis === "xer_target_dates" ? activity.baselineFinishIso : null,
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
        naturalCompare(a.activityId, b.activityId),
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
        naturalCompare(a.activityId, b.activityId),
    );

  const boundaryAuditRows =
    classified.map(
      boundaryAuditRowFor,
    );
  // Submitted critical/negative float is in hours and does not require a
  // working-day conversion or an independently recalculated driving path.
  // Keep these populations separate from the existing boundary-to-upper band.
  const criticalRows=classified.filter(({activity})=>sourceFloatCriticality(model,activity,config)==='critical').map(rowFor)
    .sort((a,b)=>a.totalFloatHours-b.totalFloatHours||naturalCompare(a.activityId,b.activityId));
  const negativeFloatRows=classified.filter(({activity})=>activity.totalFloatHours!<0).map(rowFor)
    .sort((a,b)=>a.totalFloatHours-b.totalFloatHours||naturalCompare(a.activityId,b.activityId));
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
    naturalCompare(a.activityId, b.activityId);
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
    naturalCompare(a.activityId, b.activityId);

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
              naturalCompare(a.activityId, b.activityId),
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

  const managementSource=[...new Map([...watchlistRows,...criticalRows,...negativeFloatRows].map(row=>[row.activityId,row])).values()]
    .filter(row=>row.status!=="completed");
  const managementMap=new Map<string,{
    wbsId:string|null;wbsPath:string|null;rows:typeof managementSource;
  }>();
  for(const row of managementSource){
    const key=row.wbsId??"";
    const group=managementMap.get(key)??{wbsId:row.wbsId,wbsPath:row.wbsPath??null,rows:[]};
    group.rows.push(row);managementMap.set(key,group);
  }
  const managementGroups=[...managementMap.values()].map(group=>{
    const floats=group.rows.map(row=>row.totalFloatHours).filter((v):v is number=>typeof v==="number");
    const finishes=group.rows.map(row=>row.currentFinishIso).filter((v):v is string=>!!v).sort();
    const later=group.rows.filter(row=>row.baselineFinishIso&&row.currentFinishIso&&row.currentFinishIso.slice(0,10)>row.baselineFinishIso.slice(0,10)).length;
    const erosions=group.rows.map(row=>row.floatErosionHours).filter((v):v is number=>typeof v==="number"&&Number.isFinite(v));
    return {
      wbsId:group.wbsId,wbsPath:group.wbsPath,activityCount:group.rows.length,activityIds:group.rows.map(row=>row.activityId),
      nearCriticalCount:group.rows.filter(row=>row.totalFloatHours>config.criticalFloatThresholdHours).length,
      criticalCount:group.rows.filter(row=>row.totalFloatHours<=config.criticalFloatThresholdHours).length,
      negativeFloatCount:group.rows.filter(row=>row.totalFloatHours<0).length,
      lowestFloatHours:floats.length?Math.min(...floats):null,
      floatErosionKnownCount:erosions.length,
      maxFloatErosionHours:erosions.length?Math.max(...erosions):null,
      averageFloatErosionHours:erosions.length?Number((erosions.reduce((sum,value)=>sum+value,0)/erosions.length).toFixed(6)):null,
      earliestCurrentFinishIso:finishes[0]??null,
      affectedMilestoneIds:[...new Set(group.rows.flatMap(row=>row.affectedMilestoneIds??[]))].slice(0,10),
      laterThanBaselineCount:later,
      action:'Protect remaining float, clear the linked constraints and confirm the recovery/protection action before this scope becomes completion-driving.',
    };
  }).sort((a,b)=>(a.lowestFloatHours??Number.MAX_SAFE_INTEGER)-(b.lowestFloatHours??Number.MAX_SAFE_INTEGER)||
    (b.maxFloatErosionHours??Number.NEGATIVE_INFINITY)-(a.maxFloatErosionHours??Number.NEGATIVE_INFINITY)||
    b.activityCount-a.activityCount||String(a.wbsPath??"").localeCompare(String(b.wbsPath??"")));

  return {
    schemaVersion: "1.0",
    projectionKey: "near_critical",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    controlledBaselineRevisionId: input.controlledBaseline?.revisionId ?? null,
    floatComparisonRevisionId: input.previousFloat?.revisionId ?? null,
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
      unfinished.length,
    ),
    classificationCoveragePercent: coverage(
      classified.filter(
        ({ activity, threshold }) =>
          activity.totalFloatHours! <=
            config.criticalFloatThresholdHours ||
          threshold !== null,
      ).length,
      unfinished.length,
    ),
    nearCriticalCount: known.length!==unfinished.length||classified.some(r=>r.threshold===null)?null:rows.length,
    unresolvedActivityCount:unfinished.length-known.length+classified.filter(r=>r.threshold===null).length,
    floatRiskWatchlistCount:
      known.length!==unfinished.length||classified.some(r => r.threshold === null) ? null : watchlistRows.length,
    zeroFloatCount: known.length!==unfinished.length?null:known.filter(
      (activity) =>
        activity.totalFloatHours ===
        0,
    ).length,
    negativeFloatCount: known.length!==unfinished.length?null:known.filter(
      (activity) =>
        activity.totalFloatHours! < 0,
    ).length,
    knownCriticalCount:criticalRows.length,
    knownNegativeFloatCount:negativeFloatRows.length,
    knownZeroFloatCount:known.filter(a=>a.totalFloatHours===0).length,
    unknownFloatCount:unfinished.length-known.length,
    floatRiskWatchlistIncludesCriticalThreshold:
      config.floatRiskWatchlistIncludesCriticalThreshold === true,
    population: population.contract,
    floatDistribution: numericDistribution(known.map(activity => activity.totalFloatHours)),
    rows,
    watchlistRows,
    criticalRows,
    negativeFloatRows,
    managementGroups,
    boundaryAudit,
  };
}
