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
  NearCriticalRow,
} from "./types";

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

/** Full submitted-hour population; calendar-based screening is separate. */
export function floatHourHistogram(values:readonly (number|null)[]){
  const counts=new Map<number,number>();
  for(const value of values)if(typeof value==='number'&&Number.isFinite(value))counts.set(value,(counts.get(value)??0)+1);
  const distinct=[...counts.keys()].sort((a,b)=>a-b),exact=distinct.length<=10;
  const minimum=distinct[0]??null,maximum=distinct.at(-1)??null;
  const groups=exact?distinct.map(value=>({lowerHours:value,upperHours:value,upperInclusive:true,count:counts.get(value)!})):
    Array.from({length:10},(_,i)=>({lowerHours:minimum!*(1-i/10)+maximum!*(i/10),upperHours:minimum!*(1-(i+1)/10)+maximum!* ((i+1)/10),upperInclusive:i===9,count:0}));
  if(!exact)for(const [value,count] of counts){const index=groups.findIndex(g=>value<g.upperHours);groups[index<0?groups.length-1:index]!.count+=count;}
  const knownCount=[...counts.values()].reduce((n,count)=>n+count,0);
  return {unit:'hours' as const,basis:'All unfinished execution activities with supplied finite total float; no working-day conversion.',knownCount,unknownCount:values.length-knownCount,exact,groups};
}

/** Retain the exact original sorted first-N boundary rows without sorting the
 * full source population five times. Source rows and audit candidates remain
 * intact; the heap stores only the worst retained candidate per side. */
function firstSortedBoundaryRows<T>(rows:readonly T[],eligible:(row:T)=>boolean,
  compare:(a:T,b:T)=>number,limit:number):T[]{
  if(limit<=0)return [];
  const heap:T[]=[];
  const swap=(a:number,b:number)=>{const value=heap[a]!;heap[a]=heap[b]!;heap[b]=value;};
  const siftUp=(initial:number)=>{let i=initial;while(i>0){
    const parent=Math.floor((i-1)/2);
    if(compare(heap[i]!,heap[parent]!)<=0)break;
    swap(i,parent);i=parent;
  }};
  const siftDown=()=>{let i=0;for(;;){
    let worse=i;const left=i*2+1,right=left+1;
    if(left<heap.length&&compare(heap[left]!,heap[worse]!)>0)worse=left;
    if(right<heap.length&&compare(heap[right]!,heap[worse]!)>0)worse=right;
    if(worse===i)break;swap(i,worse);i=worse;
  }};
  for(const row of rows){
    if(!eligible(row))continue;
    if(heap.length<limit){heap.push(row);siftUp(heap.length-1);}
    else if(compare(row,heap[0]!)<0){heap[0]=row;siftDown();}
  }
  return heap.sort(compare);
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
  // With no source milestone, the full DAG traversal cannot establish a
  // downstream milestone for any activity. Retain the exact empty result
  // without scanning or inferring names/dates from ordinary task activities.
  if(!model.activities.some(a=>a.activityType==='start_milestone'||a.activityType==='finish_milestone'))return new Map();
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

  // Source calendar identity is stable for this evaluation only. The first
  // source definition wins exactly as the original Array.find semantics did.
  // No cross-project or cross-revision cache can promote stale calendar facts.
  const calendarById=new Map<string,(typeof model.calendars)[number]>();
  for(const calendar of model.calendars)
    if(!calendarById.has(calendar.calendarId))calendarById.set(calendar.calendarId,calendar);
  const dayHoursById=new Map<string|null,number|null>();
  const workingDayHours=(id:string|null)=>{
    const cached=dayHoursById.get(id);
    if(cached!==undefined)return cached;
    const calendar=id===null?null:calendarById.get(id)??null;
    const hours=calendarWorkingDayHours(calendar);
    dayHoursById.set(id,hours);
    return hours;
  };

  const population = activityPopulation(model);
  const unfinished=population.activities.filter(activity=>activity.status!=='completed');
  const wbsPaths=wbsPathLookup(model);
  const downstreamMilestones=downstreamMilestoneLookup(model);
  // Only finite submitted float is an established numerical fact. A retained
  // malformed/undefined/NaN/infinite source must not enter specialist rows,
  // threshold decisions or known-count denominators as if it were read.
  const known = unfinished.filter(
    (activity) =>
      typeof activity.totalFloatHours === "number" &&
      Number.isFinite(activity.totalFloatHours),
  );

  // The entire source-float classification is calculated ONCE per known
  // activity. Boundary audit, specialist rows and management counts reuse it;
  // missing calendar semantics still yield null/unknown, not an assumed 24h.
  // The scalar source functions require only calendar identity/config for the
  // threshold; do not recalculate a working-day threshold three times for
  // every activity. Keep this map local to the exact source evaluation.
  const thresholdByCalendar=new Map<string|null,number|null>();
  const classified = known.map((activity) => {
    const id=activity.calendarId;
    if(!thresholdByCalendar.has(id))
      thresholdByCalendar.set(id,activityNearCriticalThresholdHours(model,activity,config,calendarById));
    const threshold=thresholdByCalendar.get(id)!;
    const hours=activity.totalFloatHours!;
    const classification:ReturnType<typeof sourceFloatCriticality>=
      hours<=config.criticalFloatThresholdHours?'critical':
      threshold===null?'unknown':hours<=threshold?'near_critical':'noncritical';
    const lowerSatisfied=config.floatRiskWatchlistIncludesCriticalThreshold===true
      ?hours>=config.criticalFloatThresholdHours:hours>config.criticalFloatThresholdHours;
    const watch:ReturnType<typeof sourceFloatInFloatRiskWatchlist>=
      threshold===null?null:lowerSatisfied&&hours<=threshold;
    return {activity,threshold,classification,watch};
  });
  const rowFor = ({
    activity,
    threshold,
  }: (typeof classified)[number]): NearCriticalRow => ({
    activityId: activity.activityId,
    name: activity.name,
    wbsId: activity.wbsId,
    wbsPath: activity.wbsId ? wbsPaths.get(activity.wbsId) ?? null : null,
    affectedMilestoneIds: downstreamMilestones.get(activity.activityId)??[],
    calendarId: activity.calendarId,
    status: activity.status,
    totalFloatHours:
      activity.totalFloatHours!,
    submittedTotalFloatHours:activity.totalFloatHours!,
    submittedTotalFloatWorkingDays:(()=>{
      const dayHours=workingDayHours(activity.calendarId);
      return dayHours!==null&&dayHours>0?Number((activity.totalFloatHours!/dayHours).toFixed(6)):null;
    })(),
    workingDayHours:workingDayHours(activity.calendarId),
    floatDaysBasis:workingDayHours(activity.calendarId)!==null?'source_activity_calendar':'calendar_working_day_not_established',
    previousTotalFloatHours:
      (() => { const value = input.previousFloat?.totalFloatByActivity.get(activity.activityId);
        return typeof value === 'number' && Number.isFinite(value) ? value : null; })(),
    floatErosionHours:
      (() => { const previous = input.previousFloat?.totalFloatByActivity.get(activity.activityId);
        return typeof previous === 'number' && Number.isFinite(previous)
          ? Number((previous - activity.totalFloatHours!).toFixed(6)) : null; })(),
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
    classification,
    watch:watchlist,
  }: (typeof classified)[number]) => {
    const calendar=activity.calendarId===null?null:calendarById.get(activity.calendarId)??null;
    const dayHours=workingDayHours(activity.calendarId);
    const floatWorkingDays =
      dayHours === null
        ? null
        : Number(
            (
              activity.totalFloatHours! /
              dayHours
            ).toFixed(6),
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

  // Every row list below is ordered by (submitted float, natural activity ID)
  // with source order kept for ties. A stable sort of the whole classified
  // population, then filtering, gives exactly the same order for each subset
  // as sorting each subset on its own, with one sort instead of four.
  const classifiedByFloat = [...classified].sort(
    (a, b) =>
      a.activity.totalFloatHours! -
        b.activity.totalFloatHours! ||
      naturalCompare(a.activity.activityId, b.activity.activityId),
  );
  const rows = classifiedByFloat
    .filter(
      ({ classification, threshold }) =>
        threshold !== null &&
        classification === "near_critical",
    )
    .map(rowFor);

  const watchlistRows = classifiedByFloat
    .filter(
      ({ watch, threshold }) =>
        threshold !== null &&
        watch === true,
    )
    .map(rowFor);

  const boundaryAuditRows =
    classified.map(
      boundaryAuditRowFor,
    );
  // Submitted critical/negative float is in hours and does not require a
  // working-day conversion or an independently recalculated driving path.
  // Keep these populations separate from the existing boundary-to-upper band.
  const criticalRows=classifiedByFloat.filter(({classification})=>classification==='critical').map(rowFor);
  const negativeFloatRows=classifiedByFloat.filter(({activity})=>activity.totalFloatHours!<0).map(rowFor);
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
    sampleLimitPerSide:SAMPLE_LIMIT,
    sourceRevisionId:model.sourceRevisionId,
    totalFloatSourceField:"TASK.total_float_hr_cnt" as const,
    calendarJoinField:"TASK.clndr_id -> CALENDAR.clndr_id" as const,
    criticalBoundary:{
      thresholdHours:config.criticalFloatThresholdHours,
      below:firstSortedBoundaryRows(boundaryAuditRows,row=>
        row.totalFloatHours<config.criticalFloatThresholdHours,byCriticalDistance,SAMPLE_LIMIT),
      at:firstSortedBoundaryRows(boundaryAuditRows,row=>
        row.totalFloatHours===config.criticalFloatThresholdHours,
        (a,b)=>naturalCompare(a.activityId,b.activityId),SAMPLE_LIMIT),
      above:firstSortedBoundaryRows(boundaryAuditRows,row=>
        row.totalFloatHours>config.criticalFloatThresholdHours,byCriticalDistance,SAMPLE_LIMIT),
    },
    nearCriticalUpperBoundary:{
      thresholdWorkingDays:config.nearCriticalWorkingDays??null,
      inside:firstSortedBoundaryRows(boundaryAuditRows,row=>
        row.distanceFromNearCriticalUpperBoundaryWorkingDays!==null&&
        row.distanceFromNearCriticalUpperBoundaryWorkingDays<=0,byUpperDistance,SAMPLE_LIMIT),
      outside:firstSortedBoundaryRows(boundaryAuditRows,row=>
        row.distanceFromNearCriticalUpperBoundaryWorkingDays!==null&&
        row.distanceFromNearCriticalUpperBoundaryWorkingDays>0,byUpperDistance,SAMPLE_LIMIT),
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
    const lowest=group.rows.reduce((best,row)=>!best||row.totalFloatHours<best.totalFloatHours||
       row.totalFloatHours===best.totalFloatHours&&naturalCompare(row.activityId,best.activityId)<0?row:best,
       null as (typeof group.rows)[number]|null);
    return {
      wbsId:group.wbsId,wbsPath:group.wbsPath,activityCount:group.rows.length,activityIds:group.rows.map(row=>row.activityId),
      nearCriticalCount:group.rows.filter(row=>row.totalFloatHours>config.criticalFloatThresholdHours).length,
      criticalCount:group.rows.filter(row=>row.totalFloatHours<=config.criticalFloatThresholdHours).length,
      negativeFloatCount:group.rows.filter(row=>row.totalFloatHours<0).length,
      lowestFloatHours:lowest?.totalFloatHours??null,
      lowestFloatActivityId:lowest?.activityId??null,
      lowestFloatWorkingDays:lowest?.submittedTotalFloatWorkingDays??null,
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
    floatHourHistogram:floatHourHistogram(unfinished.map(activity=>activity.totalFloatHours)),
    rows,
    watchlistRows,
    criticalRows,
    negativeFloatRows,
    managementGroups,
    boundaryAudit,
  };
}
