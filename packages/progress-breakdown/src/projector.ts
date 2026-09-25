import {naturalCompare} from '../../shared/src/natural-order';
import { schedulePlanPositions } from "../../progress-scurve/src/projector";
import { resolveRevisionActivityCorrespondence } from "../../schedule-revision-core/src";
import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  isExecutionActivity,
  scheduleProgress,
  activityPopulation,
  sourceFloatCriticality,
  activityNearCriticalThresholdHours,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
  type ScheduleAnalysisConfig,
} from "../../schedule-analysis-core/src";
import type {
  ProgressBreakdownProjection,
  ProgressBreakdownRow,
} from "./types";

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function average(
  values: readonly number[],
): number | null {
  if (values.length === 0) return null;
  return Number(
    (
      values.reduce((sum, value) => sum + value, 0) /
      values.length
    ).toFixed(6),
  );
}

function buildRow(
  model: CanonicalScheduleModel,
  wbsId: string,
  wbsName: string | null,
  activities: readonly CanonicalScheduleActivity[],
  config: ScheduleAnalysisConfig,
): ProgressBreakdownRow {
  const pctKnown = activities.filter(
    (activity) =>
      activity.percentComplete !== null &&
      activity.percentComplete >= 0 &&
      activity.percentComplete <= 100,
  );

  const floatKnown = activities.filter(
    (activity) =>
      activity.totalFloatHours !== null,
  );

  return {
    wbsId,
    wbsName,
    activityCount: activities.length,
    completedCount: activities.filter(
      (activity) => activity.status === "completed",
    ).length,
    inProgressCount: activities.filter(
      (activity) => activity.status === "in_progress",
    ).length,
    notStartedCount: activities.filter(
      (activity) => activity.status === "not_started",
    ).length,
    unknownStatusCount: activities.filter(
      (activity) => activity.status === "unknown",
    ).length,
    percentCompleteAverage: average(
      pctKnown.map(
        (activity) => activity.percentComplete!,
      ),
    ),
    percentCompleteCoveragePercent: coverage(
      pctKnown.length,
      activities.length,
    ),
    durationWeightedProgressPercent: scheduleProgress(activities).value,
    durationWeightedCoveragePercent: scheduleProgress(activities).coveragePercent,
    originalDurationHoursKnown:
      activities.reduce(
        (sum, activity) =>
          sum +
          (activity.originalDurationHours ?? 0),
        0,
      ),
    remainingDurationHoursKnown:
      activities.reduce(
        (sum, activity) =>
          sum +
          (activity.remainingDurationHours ?? 0),
        0,
      ),
    criticalCount: floatKnown.filter(
      (activity) =>
        sourceFloatCriticality(model, activity, config) ===
        "critical",
    ).length,
    nearCriticalCount: floatKnown.length!==activities.length||floatKnown.some(a=>activityNearCriticalThresholdHours(model,a,config)===null)?null:floatKnown.filter(
      (activity) =>
        sourceFloatCriticality(model, activity, config) ===
        "near_critical",
    ).length,
    negativeFloatCount: floatKnown.filter(
      (activity) =>
        activity.totalFloatHours! < 0,
    ).length,
    floatCoveragePercent: coverage(
      floatKnown.length,
      activities.length,
    ),
  };
}

export function buildProgressBreakdownProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
    baselineModel?: CanonicalScheduleModel | null;
    previousModel?: CanonicalScheduleModel | null;
  },
): ProgressBreakdownProjection {
  const config =
    input.config ??
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG;
  const wbsNames = new Map(
    model.wbs.map((row) => [
      row.wbsId,
      row.name,
    ]),
  );

  const groups = new Map<
    string,
    CanonicalScheduleActivity[]
  >();

  for (const activity of model.activities) {
    if (
      !isExecutionActivity(activity)
    ) {
      continue;
    }

    const key =
      activity.wbsId ?? "__UNASSIGNED__";
    const group = groups.get(key) ?? [];
    group.push(activity);
    groups.set(key, group);
  }


  const plan = schedulePlanPositions(model, input.baselineModel ?? null);
  const baselineMatches = input.baselineModel ? resolveRevisionActivityCorrespondence(input.baselineModel.activities, model.activities) : null;
  const baselineId = new Map(baselineMatches?.matches.map(match=>[match.toActivityId,match.fromActivityId]) ?? model.activities.map(a=>[a.activityId,a.activityId]));
  const previousMatches = input.previousModel ? resolveRevisionActivityCorrespondence(input.previousModel.activities, model.activities) : null;
  const previousById = new Map(input.previousModel?.activities.map(a=>[a.activityId,a]) ?? []);
  const previous = new Map(previousMatches?.matches.map(match=>[match.toActivityId,previousById.get(match.fromActivityId)!]) ?? []);
  const enrich = (row: ProgressBreakdownRow, activities: readonly CanonicalScheduleActivity[]) => {
    const eligibleCount = scheduleProgress(activities).totalCount;
    const weighted = (basis: "baseline" | "current") => {
      const values = activities.flatMap(a=>{ const pos = plan[basis].get(basis === "baseline" ? baselineId.get(a.activityId) ?? "" : a.activityId); return pos?.value !== null && pos?.value !== undefined ? [pos] : []; });
      const weight = values.reduce((n,x)=>n+x.weight,0);
      return { value: weight ? Number((values.reduce((n,x)=>n+x.value!*x.weight,0)/weight).toFixed(6)) : null, coverage: coverage(values.length,eligibleCount) };
    };
    const baseline = weighted("baseline"), current = weighted("current");
    const prior = activities.flatMap(a=>previous.has(a.activityId)?[previous.get(a.activityId)!]:[]);
    const priorProgress = scheduleProgress(prior);
    return { ...row, baselinePlannedPercent: baseline.value, currentPlanPercent: current.value,
      baselinePlanCoveragePercent: baseline.coverage, currentPlanCoveragePercent: current.coverage,
      scheduleMinusCurrentPlanPercentagePoints: row.durationWeightedProgressPercent !== null && current.value !== null ? Number((row.durationWeightedProgressPercent-current.value).toFixed(6)) : null,
      scheduleMinusBaselinePercentagePoints: row.durationWeightedProgressPercent !== null && baseline.value !== null ? Number((row.durationWeightedProgressPercent-baseline.value).toFixed(6)) : null,
      previousScheduleProgressPercent: priorProgress.value, previousComparisonCoveragePercent: coverage(prior.length,activities.length),
      scheduleProgressMovementPercentagePoints: priorProgress.value !== null && prior.length === activities.length && row.durationWeightedProgressPercent !== null ? Number((row.durationWeightedProgressPercent-priorProgress.value).toFixed(6)) : null,
      contractorReportedPercent: null, certifiedPhysicalPercent: null,
    };
  };
  const rows = [...groups.entries()]
    .map(([wbsId, activities]) =>
      enrich(buildRow(
        model,
        wbsId,
        wbsId === "__UNASSIGNED__"
          ? null
          : wbsNames.get(wbsId) ?? null,
        activities,
        config,
      ), activities),
    )
    .sort(
      (a, b) =>
        b.activityCount - a.activityCount ||
        naturalCompare(a.wbsId, b.wbsId),
    );

  // Ancestor rollups are a separate population from direct assignments. Each
  // activity contributes once to each ancestor and once to the project total.
  const nodes = new Map(model.wbs.map(node => [node.wbsId, node]));
  const descendants = new Map<string, CanonicalScheduleActivity[]>();
  const diagnostics: string[] = [...plan.diagnostics];
  for (const [directId, activities] of groups) {
    let id: string | null = directId;
    const seen = new Set<string>();
    while (id !== null) {
      if (seen.has(id)) { diagnostics.push("WBS_HIERARCHY_CYCLE:" + directId); break; }
      seen.add(id);
      const list = descendants.get(id) ?? []; list.push(...activities); descendants.set(id, list);
      const node = nodes.get(id);
      if (!node && id !== "__UNASSIGNED__") diagnostics.push("WBS_NODE_UNRESOLVED:" + id);
      id = node?.parentWbsId ?? null;
    }
  }
  const hierarchyRows = [...descendants].map(([id, activities]) => {
    const node = nodes.get(id); let depth = 0, parent = node?.parentWbsId ?? null;
    const seen = new Set([id]);
    while (parent !== null && !seen.has(parent)) { seen.add(parent); depth++; parent = nodes.get(parent)?.parentWbsId ?? null; }
    return { ...enrich(buildRow(model, id, node?.name ?? null, activities, config), activities),
      parentWbsId: node?.parentWbsId ?? null, depth,
      directActivityCount: groups.get(id)?.length ?? 0,
      progressAuthority: "submitted_schedule" as const,
      contractorReportedPercent: null, certifiedPhysicalPercent: null,
      basisNote: "Plans use working-calendar date phasing. Schedule snapshots remain separate from missing contractor-reported and certified physical measurements." };
  }).sort((a, b) => a.depth - b.depth || naturalCompare(a.wbsId, b.wbsId));

  return {
    schemaVersion: "1.0",
    projectionKey: "progress_breakdown",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    totalActivityCount: rows.reduce(
      (sum, row) => sum + row.activityCount,
      0,
    ),
    rows,
    hierarchyRows,
    population: activityPopulation(model).contract,
    hierarchyState: diagnostics.length ? "review_required" : "established",
    diagnostics: [...new Set(diagnostics)],
  };
}
