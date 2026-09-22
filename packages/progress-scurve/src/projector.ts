import { parseScheduleTime, activityPopulation, isProgressActivity, scheduleProgress,
  type CanonicalCalendar, type CanonicalScheduleActivity, type CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import { resolveWorkingCalendar, workingHoursBetween } from "../../schedule-cpm/src/calendar";
import type { ActualProgressSnapshot, ProgressScurvePoint, ProgressScurveProjection } from "./types";

const DAY = 86_400_000;
const ms = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = parseScheduleTime(value); return Number.isFinite(parsed) ? parsed : null;
};
const coverage = (known: number, total: number) => total ? Number((known / total * 100).toFixed(4)) : null;
interface WeightedActivity { activityId: string; weight: number; start: number; finish: number; calendar: CanonicalCalendar; clock?: (at: number) => number; work?: number; }

function eligible(model: CanonicalScheduleModel, dates: (activity: CanonicalScheduleActivity) => [string | null, string | null], diagnostics: string[]): WeightedActivity[] {
  const rows: WeightedActivity[] = [];
  for (const activity of model.activities.filter(isProgressActivity)) {
    if (activity.originalDurationHours === null || !Number.isFinite(activity.originalDurationHours) || activity.originalDurationHours <= 0) continue;
    const [startDate, finishDate] = dates(activity), start = ms(startDate), finish = ms(finishDate);
    if (start === null || finish === null || finish <= start) continue;
    const calendar = resolveWorkingCalendar(activity.calendarId, model.calendars, false)?.calendar;
    if (!calendar) { diagnostics.push("PROGRESS_WORKING_CALENDAR_UNRESOLVED:" + activity.activityId); continue; }
    rows.push({ activityId: activity.activityId, weight: activity.originalDurationHours, start, finish, calendar });
  }
  // One daily working-time prefix per calendar: queries never scan the whole activity span for every chart point.
  const byCalendar = new Map<CanonicalCalendar, WeightedActivity[]>();
  for (const row of rows) { const group = byCalendar.get(row.calendar) ?? []; group.push(row); byCalendar.set(row.calendar, group); }
  for (const [calendar, group] of byCalendar) {
    let first = Infinity, last = -Infinity;
    for (const row of group) { first = Math.min(first, row.start); last = Math.max(last, row.finish); }
    const origin = Math.floor(first / DAY) * DAY, days = Math.ceil((last - origin) / DAY);
    if (days > 36525) { diagnostics.push("PROGRESS_HORIZON_EXCEEDS_SUPPORTED_WORKING_CALENDAR_RANGE"); continue; }
    const prefix = [0];
    for (let day = 0; day < days; day++) prefix.push(prefix[day]! + workingHoursBetween(calendar, origin + day * DAY, origin + (day + 1) * DAY));
    const clock = (at: number) => {
      const offset = Math.max(0, Math.min(days, Math.floor((at - origin) / DAY)));
      return prefix[offset]! + (offset < days ? workingHoursBetween(calendar, origin + offset * DAY, Math.max(origin + offset * DAY, at)) : 0);
    };
    for (const row of group) { row.clock = clock; row.work = clock(row.finish) - clock(row.start); }
  }
  return rows.filter(row => row.clock && row.work !== undefined && row.work > 0);
}

function cumulative(rows: readonly WeightedActivity[], at: number): number | null {
  let earned = 0, weight = 0;
  for (const row of rows) {
    const fraction = at <= row.start ? 0 : at >= row.finish ? 1 : (row.clock!(at) - row.clock!(row.start)) / row.work!;
    earned += row.weight * Math.max(0, Math.min(1, fraction)); weight += row.weight;
  }
  return weight > 0 ? Number((100 * earned / weight).toFixed(6)) : null;
}

export function buildProgressScurveProjection(model: CanonicalScheduleModel, input: {
  generatedAt: string; producerVersion: string; intervalDays?: number;
  actualHistory?: ActualProgressSnapshot[]; baselineModel?: CanonicalScheduleModel | null;
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
  const anchors = [...baseline, ...current].flatMap(row => [row.start, row.finish]);
  anchors.push(...observations.map(([at]) => at)); if (cutoff !== null) anchors.push(cutoff);
  let first = Infinity, last = -Infinity;
  for (const at of anchors) { first = Math.min(first, at); last = Math.max(last, at); }
  const dates = new Set<number>(anchors.filter(at => observations.some(([date]) => at === date) || at === cutoff));
  if (Number.isFinite(first) && Number.isFinite(last)) {
    for (let at = first; at <= last; at += intervalDays * DAY) dates.add(at);
    dates.add(last);
  }
  const lastObservation = observations.at(-1)?.[0] ?? null;
  const points: ProgressScurvePoint[] = [...dates].sort((a, b) => a - b).map(at => {
    const observed = lastObservation !== null && at <= lastObservation && cutoff !== null && at <= cutoff
      ? observations.filter(([date]) => date <= at).at(-1) : undefined;
    const date = new Date(at).toISOString();
    return { dateIso: date.endsWith("T00:00:00.000Z") ? date.slice(0,10) : date, baselinePlannedPercent: cumulative(baseline, at),
      currentForecastPercent: cumulative(current, at), actualProgressPercent: observed ? observedValue(observed[1]) : null };
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
    baselineCoveragePercent: coverage(baseline.length, baselinePopulation.activities.length),
    currentCoveragePercent: coverage(current.length, currentPopulation.activities.length),
    actualSnapshotCoveragePercent: snapshot.coveragePercent,
    actualHistoryMode: snapshots.length > 1 ? "snapshot_history" : snapshots.length === 1 ? "current_snapshot_only" : "missing",
    points, actualSnapshots: snapshots, diagnostics,
  };
}

/** Shared per-activity working-calendar positions for WBS aggregation at the same Data Date. */
export function schedulePlanPositions(model: CanonicalScheduleModel, baselineModel: CanonicalScheduleModel | null = null) {
  const diagnostics: string[] = [], cutoff = ms(model.dataDateIso);
  const positions = (rows: WeightedActivity[]) => new Map(rows.map(row => [row.activityId, {
    value: cutoff === null ? null : cumulative([row], cutoff), weight: row.weight,
  }]));
  return {
    baseline: positions(eligible(baselineModel ?? model, activity => [activity.baselineStartIso ?? (baselineModel ? activity.currentStartIso : null), activity.baselineFinishIso ?? (baselineModel ? activity.currentFinishIso : null)], diagnostics)),
    current: positions(eligible(model, activity => [activity.forecastStartIso ?? activity.currentStartIso ?? activity.actualStartIso, activity.forecastFinishIso ?? activity.currentFinishIso ?? activity.actualFinishIso], diagnostics)),
    diagnostics,
  };
}
