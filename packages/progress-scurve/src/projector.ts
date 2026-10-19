import { parseScheduleTime, activityPopulation, isProgressActivity, scheduleProgress,
  type CanonicalCalendar, type CanonicalScheduleActivity, type CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import { resolveWorkingCalendar, workingHoursBetween } from "../../schedule-cpm/src/calendar";
import type { ActualProgressSnapshot, ProgressScurvePoint, ProgressScurveProjection } from "./types";
import {resolveRevisionActivityCorrespondence} from '../../schedule-revision-core/src';

const DAY = 86_400_000;
const ms = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = parseScheduleTime(value); return Number.isFinite(parsed) ? parsed : null;
};
const coverage = (known: number, total: number) => total ? Number((known / total * 100).toFixed(4)) : null;
interface WeightedActivity { activityId: string; weight: number; start: number; finish: number; calendar: CanonicalCalendar | null; clock?: (at: number) => number; clockStart?: number; work?: number; }

function eligible(model: CanonicalScheduleModel, dates: (activity: CanonicalScheduleActivity) => [string | null, string | null], diagnostics: string[]): WeightedActivity[] {
  const rows: WeightedActivity[] = [];
  // Within one unchanged source model, calendar resolution is identical for
  // all activities referencing the same original ID. Preserve ambiguous and
  // missing calendars as null rather than assuming a working-day pattern.
  const calendarBySourceId=new Map<string|null,CanonicalCalendar|null>();
  // Same activities in the same order as filtering first, without a second
  // 8k+-row array per call.
  for (const activity of model.activities) {
    if (!isProgressActivity(activity)) continue;
    if (activity.originalDurationHours === null || !Number.isFinite(activity.originalDurationHours) || activity.originalDurationHours <= 0) continue;
    const [startDate, finishDate] = dates(activity), start = ms(startDate), finish = ms(finishDate);
    if (start === null || finish === null || finish <= start) continue;
    const calendarId=activity.calendarId;
    let calendar:CanonicalCalendar|null;
    if(calendarBySourceId.has(calendarId))calendar=calendarBySourceId.get(calendarId)!;
    else{
      calendar=resolveWorkingCalendar(calendarId,model.calendars,false)?.calendar??null;
      calendarBySourceId.set(calendarId,calendar);
    }
    if (!calendar) diagnostics.push("PROGRESS_WORKING_CALENDAR_UNRESOLVED:" + activity.activityId);
    rows.push({ activityId: activity.activityId, weight: activity.originalDurationHours, start, finish, calendar });
  }
  // One daily working-time prefix per calendar: queries never scan the whole activity span for every chart point.
  const byCalendar = new Map<CanonicalCalendar, WeightedActivity[]>();
  for (const row of rows) { if(!row.calendar)continue;const group = byCalendar.get(row.calendar) ?? []; group.push(row); byCalendar.set(row.calendar, group); }
  for (const [calendar, group] of byCalendar) {
    let first = Infinity, last = -Infinity;
    for (const row of group) { first = Math.min(first, row.start); last = Math.max(last, row.finish); }
    const origin = Math.floor(first / DAY) * DAY, days = Math.ceil((last - origin) / DAY);
    if (days > 36525) { diagnostics.push("PROGRESS_HORIZON_EXCEEDS_SUPPORTED_WORKING_CALENDAR_RANGE"); continue; }
    const prefix = [0];
    for (let day = 0; day < days; day++) prefix.push(prefix[day]! + workingHoursBetween(calendar, origin + day * DAY, origin + (day + 1) * DAY));
    const clockValues = new Map<number,number>();
    const clock = (at: number) => {
      const known=clockValues.get(at);if(known!==undefined)return known;
      const offset = Math.max(0, Math.min(days, Math.floor((at - origin) / DAY)));
      const value=prefix[offset]! + (offset < days ? workingHoursBetween(calendar, origin + offset * DAY, Math.max(origin + offset * DAY, at)) : 0);
      clockValues.set(at,value);return value;
    };
    for (const row of group) { row.clock = clock; row.clockStart = clock(row.start); row.work = clock(row.finish) - row.clockStart; }
  }
  return rows.filter(row => !row.calendar || row.clock && row.work !== undefined && row.work > 0);
}

function fractionAt(row:WeightedActivity,at:number):number|null {
  // Source start/finish boundaries need no invented daily working pattern.
  if(at<=row.start)return 0;
  if(at>=row.finish)return 1;
  return row.clock&&row.work!==undefined&&row.work>0?(row.clock(at)-row.clockStart!)/row.work:null;
}

/** cumulative([row], at) without allocating a one-row array per activity:
 * the identical statements for a single row, in the same order. */
function rowPosition(row: WeightedActivity, at: number): number | null {
  let earned = 0, weight = 0;
  const fraction = fractionAt(row,at);
  if(fraction===null)return null;
  earned += row.weight * Math.max(0, Math.min(1, fraction)); weight += row.weight;
  return weight > 0 ? Number((100 * earned / weight).toFixed(6)) : null;
}

function cumulative(rows: readonly WeightedActivity[], at: number): number | null {
  let earned = 0, weight = 0;
  for (const row of rows) {
    const fraction = fractionAt(row,at);
    if(fraction===null)return null;
    earned += row.weight * Math.max(0, Math.min(1, fraction)); weight += row.weight;
  }
  return weight > 0 ? Number((100 * earned / weight).toFixed(6)) : null;
}

export function buildProgressScurveProjection(model: CanonicalScheduleModel, input: {
  generatedAt: string; producerVersion: string; intervalDays?: number;
  actualHistory?: ActualProgressSnapshot[]; baselineModel?: CanonicalScheduleModel | null;
  /** Reuse these complete calculated source positions within one project evaluation. */
  onPlanPositions?: (positions: ReturnType<typeof schedulePlanPositions>)=>void;
}): ProgressScurveProjection {
  const intervalDays = input.intervalDays ?? 7;
  if (!Number.isSafeInteger(intervalDays) || intervalDays <= 0) throw new Error("Progress S-Curve intervalDays must be a positive integer");
  const diagnostics: string[] = input.baselineModel ? ["SCURVE_BASELINE_USES_CONTROLLED_BASELINE_REVISION"] : [];
  const currentPopulation = activityPopulation(model, "duration_weighted_progress");
  const baselineSource = input.baselineModel ?? model;
  const baselinePopulation = activityPopulation(baselineSource, "duration_weighted_progress");
  const baseline = eligible(baselineSource, activity => [
    activity.baselineStartIso ?? (input.baselineModel ? activity.currentStartIso : null),
    activity.baselineFinishIso ?? (input.baselineModel ? activity.currentFinishIso : null),
  ], diagnostics);
  const current = eligible(model, activity => [
    activity.forecastStartIso ?? activity.currentStartIso ?? activity.actualStartIso,
    activity.forecastFinishIso ?? activity.currentFinishIso ?? activity.actualFinishIso,
  ], diagnostics);
  const snapshot = scheduleProgress(model.activities), cutoff = ms(model.dataDateIso);
  // S-curve and WBS/control-scope plans use the identical original activity
  // dates, calendars, and Data Date. Keep the full per-activity values locally
  // instead of parsing the same 8k+ programme twice in scope comparisons and
  // a third time when Progress Breakdown opens. No cross-project cache.
  const planPositions = input.onPlanPositions || input.baselineModel
    ? {
      baseline:new Map(baseline.map(row=>[row.activityId,{
        value:cutoff===null?null:rowPosition(row,cutoff),weight:row.weight,
      }] as const)),
      current:new Map(current.map(row=>[row.activityId,{
        value:cutoff===null?null:rowPosition(row,cutoff),weight:row.weight,
      }] as const)),
      // S-curve's own baseline diagnostic is not a plan source diagnostic.
      diagnostics:diagnostics.slice(input.baselineModel?1:0),
    } : null;
  if(planPositions)input.onPlanPositions?.(planPositions);
  const supplied = (input.actualHistory ?? []).filter(row => row.progressPercent >= 0 && row.progressPercent <= 100
    && ms(row.asOfIso) !== null && cutoff !== null && ms(row.asOfIso)! <= cutoff).sort((a, b) => ms(a.asOfIso)! - ms(b.asOfIso)!);
  const snapshots: ActualProgressSnapshot[] = supplied.length ? supplied : cutoff !== null && snapshot.value !== null ? [{
    asOfIso: model.dataDateIso!, progressPercent: snapshot.value, sourceRevisionId: model.sourceRevisionId,
    sourceRefs: ["schedule:" + model.sourceRevisionId + ":percent-complete-snapshot"],
  }] : [];
  // Conflicting same-date observations remain visible, but cannot define a single plotted position.
  const groups = new Map<number, ActualProgressSnapshot[]>();
  for (const row of snapshots) { const group = groups.get(ms(row.asOfIso)!) ?? []; group.push(row); groups.set(ms(row.asOfIso)!, group); }
  const observations = [...groups].sort((a, b) => a[0] - b[0]);
  const observedValue = (rows: ActualProgressSnapshot[]) => new Set(rows.map(row => row.progressPercent)).size === 1 ? rows[0]!.progressPercent : null;
  for (const [at, rows] of observations) if (observedValue(rows) === null) diagnostics.push("CONFLICTING_SCHEDULE_PROGRESS_SNAPSHOTS:" + new Date(at).toISOString());
  // Same anchors in the same order, without a two-value array per activity.
  const anchors: number[] = [];
  for (const source of [baseline, current]) for (const row of source) anchors.push(row.start, row.finish);
  anchors.push(...observations.map(([at]) => at)); if (cutoff !== null) anchors.push(cutoff);
  let first = Infinity, last = -Infinity;
  for (const at of anchors) { first = Math.min(first, at); last = Math.max(last, at); }
  // Full snapshot population, identical date membership without multiplying
  // activity anchor count by the number of retained report observations.
  const observationDates=new Set(observations.map(([date])=>date));
  const dates = new Set<number>(anchors.filter(at => observationDates.has(at) || at === cutoff));
  if (Number.isFinite(first) && Number.isFinite(last)) {
    for (let at = first; at <= last; at += intervalDays * DAY) dates.add(at);
    dates.add(last);
  }
  // Weekly samples can jump over a short unresolved interval. Keep a gap per
  // sampled interval/series, without adding one chart point per source activity.
  const sampled=[...dates].sort((a,b)=>a-b);
  for(const source of [baseline,current]){
    const unresolved=source.filter(row=>!row.calendar);
    for(let index=1;index<sampled.length;index++){
      const left=sampled[index-1]!,right=sampled[index]!;
      const row=unresolved.find(row=>row.start<right&&row.finish>left);
      if(row)dates.add(Math.floor((Math.max(left,row.start)+Math.min(right,row.finish))/2));
    }
  }
  const lastObservation = observations.at(-1)?.[0] ?? null;
  const points: ProgressScurvePoint[] = [...dates].sort((a, b) => a - b).map(at => {
    const observed = lastObservation !== null && at <= lastObservation && cutoff !== null && at <= cutoff
      ? observations.filter(([date]) => date <= at).at(-1) : undefined;
    const date = new Date(at).toISOString();
    const currentSchedulePhasingPercent = cumulative(current, at);
    return { dateIso: date.endsWith("T00:00:00.000Z") ? date.slice(0,10) : date, baselinePlannedPercent: cumulative(baseline, at),
      currentSchedulePhasingPercent, currentForecastPercent: currentSchedulePhasingPercent,
      actualProgressPercent: observed ? observedValue(observed[1]) : null };
  });
  diagnostics.push("SCURVE_WORKING_CALENDAR_PHASING", "SCHEDULE_SNAPSHOTS_ARE_NOT_CERTIFIED_PHYSICAL_PROGRESS");
  if (snapshots.length <= 1) diagnostics.push("SCURVE_ACTUAL_HISTORY_NOT_RECONSTRUCTED_FROM_SINGLE_SNAPSHOT");
  return {
    schemaVersion: "1.0", projectionKey: "progress_scurve", generatedAt: input.generatedAt, producerVersion: input.producerVersion,
    projectId: model.projectId, sourceRevisionId: model.sourceRevisionId, dataDateIso: model.dataDateIso,
    weightingMethod: "original_duration_hours", timePhasingMethod: "working_calendar_between_activity_dates", intervalDays,
    populationContracts: { baseline: baselinePopulation.contract, current: currentPopulation.contract, snapshot: currentPopulation.contract },
    observationCount: observations.length,
    seriesContract: { seriesKey: "progress_percent", unit: "%", authority: "derived_schedule", basisRevisionId: model.sourceRevisionId,
      asOfIso: model.dataDateIso, sourceRefs: ["schedule:" + model.sourceRevisionId] },
    baselineCoveragePercent: coverage(baseline.filter(row=>cutoff!==null?fractionAt(row,cutoff)!==null:!!row.clock).length, baselinePopulation.activities.length),
    currentCoveragePercent: coverage(current.filter(row=>cutoff!==null?fractionAt(row,cutoff)!==null:!!row.clock).length, currentPopulation.activities.length),
    actualSnapshotCoveragePercent: snapshot.coveragePercent,
    actualHistoryMode: snapshots.length > 1 ? "snapshot_history" : snapshots.length === 1 ? "current_snapshot_only" : "missing",
    currentSeriesMeaning: "current_schedule_date_phasing_not_achieved_progress",
    points, actualSnapshots: snapshots, diagnostics,
    scopeComparison:input.baselineModel?compareProgressScopes(model,input.baselineModel,planPositions??undefined):null,
  };
}

const scopeCache=new WeakMap<CanonicalScheduleModel,WeakMap<CanonicalScheduleModel,ReturnType<typeof calculateProgressScope>>>();
export function compareProgressScopes(model:CanonicalScheduleModel,baseline:CanonicalScheduleModel,precomputed?:ReturnType<typeof schedulePlanPositions>){
  let cache=scopeCache.get(model);if(!cache){cache=new WeakMap();scopeCache.set(model,cache);}
  const existing=cache.get(baseline);if(existing)return existing;
  const result=calculateProgressScope(model,baseline,precomputed);cache.set(baseline,result);return result;
}
function calculateProgressScope(model:CanonicalScheduleModel,baseline:CanonicalScheduleModel,precomputed?:ReturnType<typeof schedulePlanPositions>){
  const before=baseline.activities.filter(isProgressActivity),after=model.activities.filter(isProgressActivity);
  const identity=resolveRevisionActivityCorrespondence(before,after);
  const beforeById=new Map(before.map(a=>[a.activityId,a])),afterById=new Map(after.map(a=>[a.activityId,a]));
  const positions=precomputed??schedulePlanPositions(model,baseline);
  const matched=identity.matches.map(m=>({before:beforeById.get(m.fromActivityId)!,after:afterById.get(m.toActivityId)!,
    baselinePlan:positions.baseline.get(m.fromActivityId),currentPlan:positions.current.get(m.toActivityId)}));
  const comparable=matched.filter(r=>r.baselinePlan?.value!=null&&r.currentPlan?.value!=null&&
    r.after.originalDurationHours!==null&&r.after.originalDurationHours>0&&
    r.after.percentComplete!==null&&Number.isFinite(r.after.percentComplete)&&r.after.percentComplete>=0&&r.after.percentComplete<=100);
  const weighted=(value:(r:typeof comparable[number])=>number,weight:(r:typeof comparable[number])=>number)=>{
    const denominator=comparable.reduce((n,r)=>n+weight(r),0);
    return denominator?comparable.reduce((n,r)=>n+value(r)*weight(r),0)/denominator:null;
  };
  const baselineWeight=(r:typeof comparable[number])=>r.baselinePlan!.weight;
  const currentWeight=(r:typeof comparable[number])=>r.after.originalDurationHours!;
  const baselinePlan=weighted(r=>r.baselinePlan!.value!,baselineWeight);
  const snapshot=weighted(r=>r.after.percentComplete!,baselineWeight);
  const currentPlan=weighted(r=>r.currentPlan!.value!,baselineWeight);
  const snapshotCurrentWeights=weighted(r=>r.after.percentComplete!,currentWeight);
  const currentPlanCurrentWeights=weighted(r=>r.currentPlan!.value!,currentWeight);
  const matchedIds=new Set(identity.matches.map(m=>m.toActivityId));
  const added=after.filter(a=>!matchedIds.has(a.activityId)&&!identity.ambiguousTo.has(a.activityId));
  const matchedBeforeIds=new Set(identity.matches.map(m=>m.fromActivityId));
  const removed=before.filter(a=>!matchedBeforeIds.has(a.activityId)&&!identity.ambiguousFrom.has(a.activityId));
  const positiveWeight=(rows:typeof after)=>rows.reduce((n,a)=>n+(a.originalDurationHours!==null&&a.originalDurationHours>0?a.originalDurationHours:0),0);
  const full=scheduleProgress(after),weight=positiveWeight(after);
  const delta=(a:number|null,b:number|null)=>a!==null&&b!==null?a-b:null;
  const addedStarts=added.map(a=>a.forecastStartIso??a.currentStartIso).filter((v):v is string=>Boolean(v)).sort();
  return {state:comparable.length===matched.length&&comparable.length>0?'complete':'partial',
    baselineRevisionId:baseline.sourceRevisionId,currentRevisionId:model.sourceRevisionId,dataDateIso:model.dataDateIso,
    baselineActivityCount:before.length,currentActivityCount:after.length,matchedActivityCount:matched.length,comparableActivityCount:comparable.length,
    addedActivityCount:added.length,removedActivityCount:removed.length,ambiguousIdentityCount:identity.ambiguousFrom.size+identity.ambiguousTo.size,
    baselinePlannedPercent:baselinePlan,snapshotPercent:snapshot,currentPlanPercent:currentPlan,
    snapshotCurrentWeightsPercent:snapshotCurrentWeights,currentPlanCurrentWeightsPercent:currentPlanCurrentWeights,
    gapPercentagePoints:delta(snapshot,baselinePlan),ratio:baselinePlan!==null&&baselinePlan>0&&snapshot!==null?snapshot/baselinePlan:null,
    currentWeightGapPercentagePoints:delta(snapshotCurrentWeights,baselinePlan),
    currentWeightRatio:baselinePlan!==null&&baselinePlan>0&&snapshotCurrentWeights!==null?snapshotCurrentWeights/baselinePlan:null,
    durationWeightEffectPercentagePoints:delta(snapshotCurrentWeights,snapshot),
    scopeDilutionPercentagePoints:comparable.length===matched.length?delta(full.value,snapshotCurrentWeights):null,
    addedDurationWeightPercent:weight?positiveWeight(added)/weight*100:null,
    addedNotStartedCount:added.filter(a=>a.status==='not_started').length,addedEarliestStartIso:addedStarts[0]??null,
    addedStartDateCoverage:addedStarts.length,fullScopeSnapshotPercent:full.value,
    sourceRefs:['schedule:'+baseline.sourceRevisionId,'schedule:'+model.sourceRevisionId],
    interpretation:'The headline compares the same activities with fixed baseline duration weights. The current-weight comparison separates changed duration weights from added scope. Current programme dates can include actuals, so agreement with the current plan is not independent evidence of performance. Schedule percentages do not reconcile earned value without a shared work/cost basis.'};
}

/** Shared per-activity working-calendar positions for WBS aggregation at the same Data Date. */
export function schedulePlanPositions(model: CanonicalScheduleModel, baselineModel: CanonicalScheduleModel | null = null) {
  const diagnostics: string[] = [], cutoff = ms(model.dataDateIso);
  const positions = (rows: WeightedActivity[]) => new Map(rows.map(row => [row.activityId, {
    value: cutoff === null ? null : rowPosition(row, cutoff), weight: row.weight,
  }]));
  return {
    baseline: positions(eligible(baselineModel ?? model, activity => [activity.baselineStartIso ?? (baselineModel ? activity.currentStartIso : null), activity.baselineFinishIso ?? (baselineModel ? activity.currentFinishIso : null)], diagnostics)),
    current: positions(eligible(model, activity => [activity.forecastStartIso ?? activity.currentStartIso ?? activity.actualStartIso, activity.forecastFinishIso ?? activity.currentFinishIso ?? activity.actualFinishIso], diagnostics)),
    diagnostics,
  };
}
