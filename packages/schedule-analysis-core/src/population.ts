import type { CanonicalScheduleActivity, CanonicalScheduleModel } from "./types";

export type ActivityPopulationBasis = "source_records" | "execution_control" | "duration_weighted_progress" | "milestones";

export interface ActivityPopulationContract {
  basis: ActivityPopulationBasis;
  sourceCount: number;
  denominator: number;
  excludedCount: number;
  exclusions: Array<{ activityId: string; reason: string }>;
  unknownActivityTypeCount: number;
  authority: "submitted_schedule";
  sourceRevisionId: string;
  asOfIso: string | null;
}

export function isMilestoneActivity(activity: Pick<CanonicalScheduleActivity, "activityType">): boolean {
  return ["milestone", "start_milestone", "finish_milestone"].includes(activity.activityType);
}

export function isExecutionActivity(activity: Pick<CanonicalScheduleActivity, "activityType">): boolean {
  return activity.activityType !== "wbs_summary" && activity.activityType !== "level_of_effort";
}

export function isProgressActivity(activity: Pick<CanonicalScheduleActivity, "activityType">): boolean {
  return isExecutionActivity(activity) && !isMilestoneActivity(activity);
}

export function activityPopulation(model: CanonicalScheduleModel, basis: ActivityPopulationBasis = "execution_control") {
  const include = basis === "source_records" ? () => true
    : basis === "duration_weighted_progress" ? isProgressActivity
    : basis === "milestones" ? isMilestoneActivity : isExecutionActivity;
  const activities = model.activities.filter(include);
  const excluded = model.activities.filter(activity => !include(activity));
  const contract: ActivityPopulationContract = {
    basis, sourceCount: model.activities.length, denominator: activities.length,
    excludedCount: excluded.length,
    exclusions: excluded.map(activity => ({ activityId: activity.activityId, reason: activity.activityType })),
    unknownActivityTypeCount: activities.filter(activity => activity.activityType === "unknown").length,
    authority: "submitted_schedule", sourceRevisionId: model.sourceRevisionId, asOfIso: model.dataDateIso,
  };
  return { activities, excluded, contract };
}

/** Partial progress is a known-population estimate, never zero-filled missing progress. */
export function scheduleProgress(activities: readonly CanonicalScheduleActivity[]) {
  const eligible = activities.filter(isProgressActivity);
  const known = eligible.filter(a => a.originalDurationHours !== null && Number.isFinite(a.originalDurationHours)
    && a.originalDurationHours > 0 && a.percentComplete !== null && Number.isFinite(a.percentComplete)
    && a.percentComplete >= 0 && a.percentComplete <= 100);
  const knownWeight = known.reduce((sum, a) => sum + a.originalDurationHours!, 0);
  const value = knownWeight > 0 ? known.reduce((sum, a) => sum + a.originalDurationHours! * a.percentComplete!, 0) / knownWeight : null;
  return {
    value: value === null ? null : Number(value.toFixed(6)), knownCount: known.length, totalCount: eligible.length,
    coveragePercent: eligible.length ? Number((100 * known.length / eligible.length).toFixed(4)) : null,
    knownWeightHours: knownWeight,
    state: known.length === 0 ? "missing" as const : known.length === eligible.length ? "established" as const : "partial" as const,
  };
}

export function numericDistribution(values: readonly (number | null)[]) {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const value of known) { const key = Number(value.toFixed(6)); counts.set(key, (counts.get(key) ?? 0) + 1); }
  const groups = [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value - b.value);
  const percentile = (p: number) => {
    if (!known.length) return null;
    const index = (known.length - 1) * p, low = Math.floor(index), high = Math.ceil(index);
    return known[low]! + (known[high]! - known[low]!) * (index - low);
  };
  return { totalCount: values.length, knownCount: known.length, unknownCount: values.length - known.length,
    median: percentile(0.5), p90: percentile(0.9), maximum: known.at(-1) ?? null, groups: groups.slice(0,10),
    dominantValue: groups[0]?.value ?? null, dominantCount: groups[0]?.count ?? 0,
    dominantPercent: known.length ? 100 * (groups[0]?.count ?? 0) / known.length : null,
    interpretation: "Repeated values are a concentration pattern, not evidence of a shared cause or separate delay entitlement." };
}
