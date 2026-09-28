import {naturalCompare} from '../../shared/src/natural-order';
import { schedulePlanPositions } from "../../progress-scurve/src/projector";
import { resolveRevisionActivityCorrespondence } from "../../schedule-revision-core/src";
import {
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG,
  isExecutionActivity,
  isProgressActivity,
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
  ProgressBreakdownDimension,
  ProgressBreakdownDimensionView,
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
    criticalCount: floatKnown.length!==activities.length?null:floatKnown.filter(
      (activity) =>
        sourceFloatCriticality(model, activity, config) ===
        "critical",
    ).length,
    nearCriticalCount: floatKnown.length!==activities.length||floatKnown.some(a=>activityNearCriticalThresholdHours(model,a,config)===null)?null:floatKnown.filter(
      (activity) =>
        sourceFloatCriticality(model, activity, config) ===
        "near_critical",
    ).length,
    negativeFloatCount: floatKnown.length!==activities.length?null:floatKnown.filter(
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
    scopeClassification?: {
      rows: Array<{
        activityId: string;
        wbsId: string | null;
        wbsLevel: number | null;
        zone: string | null;
        level: string | null;
        workFront: string | null;
        cbs: string | null;
      }>;
    } | null;
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
      if (basis === "baseline" && !input.baselineModel) {
        return { value: null, coverage: null };
      }
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

  const executionActivities = model.activities.filter(isExecutionActivity);
  const progressPosition = scheduleProgress(executionActivities);
  const overallKnownWeightHours = progressPosition.knownWeightHours;
  const scopeByActivity = new Map((input.scopeClassification?.rows ?? []).map(row => [row.activityId, row]));
  const wbsNodeById = new Map(model.wbs.map(node => [node.wbsId, node]));

  const fallbackWbsLevel = (activity: CanonicalScheduleActivity): number | null => {
    if (!activity.wbsId) return null;
    let id: string | null = activity.wbsId;
    let depth = 0;
    const seen = new Set<string>();
    while (id && !seen.has(id)) {
      seen.add(id);
      depth += 1;
      id = wbsNodeById.get(id)?.parentWbsId ?? null;
    }
    return depth || null;
  };

  const dimensions: Array<{
    dimension: ProgressBreakdownDimension;
    label: string;
    basis: string;
    value: (activity: CanonicalScheduleActivity) => { key: string; label: string } | null;
  }> = [
    {
      dimension: "wbs",
      label: "By WBS",
      basis: "Direct activity WBS assignments from the submitted programme. Parent hierarchy is not double-counted in this grouped view.",
      value: activity => activity.wbsId ? {key: activity.wbsId, label: wbsNames.get(activity.wbsId) ?? activity.wbsId} : null,
    },
    {
      dimension: "wbs_level",
      label: "By WBS Level",
      basis: "WBS depth from the submitted parent-child hierarchy; root is Level 1.",
      value: activity => {
        const level = scopeByActivity.get(activity.activityId)?.wbsLevel ?? fallbackWbsLevel(activity);
        return level === null ? null : {key: String(level), label: "Level " + level};
      },
    },
    {
      dimension: "zone",
      label: "By Zone",
      basis: "Only explicit Zone classifications read from the current programme WBS/activity source are used.",
      value: activity => {
        const value = scopeByActivity.get(activity.activityId)?.zone ?? null;
        return value ? {key:value,label:value} : null;
      },
    },
    {
      dimension: "level",
      label: "By Level",
      basis: "Only explicit spatial Level classifications read from the current programme are used; WBS depth is a separate view.",
      value: activity => {
        const value = scopeByActivity.get(activity.activityId)?.level ?? null;
        return value ? {key:value,label:value} : null;
      },
    },
    {
      dimension: "work_front",
      label: "By Work Front",
      basis: "Only explicit Work Front classifications read from the current programme are used.",
      value: activity => {
        const value = scopeByActivity.get(activity.activityId)?.workFront ?? null;
        return value ? {key:value,label:value} : null;
      },
    },
    {
      dimension: "cbs",
      label: "By CBS",
      basis: "Only explicit CBS / cost-code classifications read from the current programme are used. CMeng does not treat package as CBS or invent an allocation.",
      value: activity => {
        const value = scopeByActivity.get(activity.activityId)?.cbs ?? null;
        return value ? {key:value,label:value} : null;
      },
    },
  ];

  const groupSummary = (
    dimension: ProgressBreakdownDimension,
    groupKey: string,
    groupLabel: string,
    classified: boolean,
    activities: CanonicalScheduleActivity[],
  ) => {
    const progress = scheduleProgress(activities);
    const row = buildRow(model, groupKey, groupLabel, activities, config);
    const weightSharePercent = overallKnownWeightHours > 0
      ? Number((progress.knownWeightHours / overallKnownWeightHours * 100).toFixed(6))
      : null;
    const progressContributionPercentagePoints =
      progress.value !== null && weightSharePercent !== null
        ? Number((progress.value * weightSharePercent / 100).toFixed(6))
        : null;
    return {
      dimension,
      groupKey,
      groupLabel,
      classified,
      activityCount: activities.length,
      completedCount: row.completedCount,
      inProgressCount: row.inProgressCount,
      notStartedCount: row.notStartedCount,
      unknownStatusCount: row.unknownStatusCount,
      scheduleProgressPercent: progress.value,
      progressCoveragePercent: progress.coveragePercent,
      knownWeightHours: progress.knownWeightHours,
      weightSharePercent,
      progressContributionPercentagePoints,
      criticalCount: row.criticalCount,
      nearCriticalCount: row.nearCriticalCount,
      negativeFloatCount: row.negativeFloatCount,
    };
  };

  const dimensionViews: ProgressBreakdownDimensionView[] = dimensions.map(definition => {
    const grouped = new Map<string,{label:string;activities:CanonicalScheduleActivity[]}>();
    const unclassified: CanonicalScheduleActivity[] = [];
    for (const activity of executionActivities) {
      const classification = definition.value(activity);
      if (!classification) {
        unclassified.push(activity);
        continue;
      }
      const existing = grouped.get(classification.key) ?? {label:classification.label,activities:[]};
      existing.activities.push(activity);
      grouped.set(classification.key, existing);
    }
    const rows = [...grouped.entries()].map(([key,group]) =>
      groupSummary(definition.dimension,key,group.label,true,group.activities)
    );
    if (unclassified.length) {
      rows.push(groupSummary(definition.dimension,"__UNCLASSIFIED__","Unclassified",false,unclassified));
    }
    rows.sort((a,b) =>
      (a.classified===b.classified?0:a.classified?-1:1) ||
      b.activityCount-a.activityCount ||
      naturalCompare(a.groupLabel,b.groupLabel)
    );
    const classifiedPopulation = executionActivities.length - unclassified.length;
    return {
      dimension: definition.dimension,
      label: definition.label,
      sourcePopulation: executionActivities.length,
      classifiedPopulation,
      unclassifiedPopulation: unclassified.length,
      classificationCoveragePercent: coverage(classifiedPopulation,executionActivities.length),
      available: classifiedPopulation > 0,
      basis: definition.basis,
      rows,
    };
  });

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
    dimensionViews,
    overallScheduleProgressPercent: progressPosition.value,
    overallProgressCoveragePercent: progressPosition.coveragePercent,
    overallKnownWeightHours,
    baselinePlanAvailable: Boolean(input.baselineModel),
  };
}
