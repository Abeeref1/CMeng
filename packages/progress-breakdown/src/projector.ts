import {naturalCompare} from '../../shared/src/natural-order';
import {programmeLongLeadScope} from './long-lead-scope';
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
  progressFor: typeof scheduleProgress,
  sourceFloat:(activity:CanonicalScheduleActivity)=>{criticality:ReturnType<typeof sourceFloatCriticality>;thresholdHours:number|null},
): ProgressBreakdownRow {
  const pctKnown = activities.filter(
    (activity) =>
      activity.percentComplete !== null &&
      activity.percentComplete >= 0 &&
      activity.percentComplete <= 100,
  );

  const unfinished=activities.filter(activity=>activity.status!=='completed');
  const floatKnown = unfinished.filter(
    (activity) =>
      activity.totalFloatHours !== null,
  );
  const progress = progressFor(activities);

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
    durationWeightedProgressPercent: progress.value,
    durationWeightedCoveragePercent: progress.coveragePercent,
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
    criticalCount: floatKnown.length!==unfinished.length?null:floatKnown.filter(
      (activity) =>
        sourceFloat(activity).criticality ===
        "critical",
    ).length,
    nearCriticalCount: floatKnown.length!==unfinished.length||floatKnown.some(a=>sourceFloat(a).thresholdHours===null)?null:floatKnown.filter(
      (activity) =>
        sourceFloat(activity).criticality ===
        "near_critical",
    ).length,
    negativeFloatCount: floatKnown.length!==unfinished.length?null:floatKnown.filter(
      (activity) =>
        activity.totalFloatHours! < 0,
    ).length,
    floatCoveragePercent: coverage(
      floatKnown.length,
      unfinished.length,
    ),
  };
}

function buildProgressBreakdownProjectionImpl(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    config?: ScheduleAnalysisConfig;
    baselineModel?: CanonicalScheduleModel | null;
    // Workfront-only: exact unique activity ID correspondence already proved
    // across the full source revisions; not used for ambiguous/renamed IDs.
    sharedExactBaselineIds?:ReadonlyMap<string,string>;
    // Fully calculated at the same revision and Data Date by Delivery.
    // Each workfront consumes a subset of identical per-activity positions.
    sharedPlanPositions?:ReturnType<typeof schedulePlanPositions>;
    // Delivery already classified the complete source programme long-lead WBS
    // and activity set. Reuse that exact full-population membership in its
    // per-workfront subset projections instead of walking the same WBS tree
    // once for every workfront. Specialist calls still calculate it normally.
    sharedProgrammeLongLeadActivityIds?:ReadonlySet<string>;
    previousModel?: CanonicalScheduleModel | null;
    readinessEvidence?: Record<string, Partial<Record<"procurement_material"|"design_submittal", {state:string;records?:Array<{owner?:string|null;longLead?:boolean}>}>>>;
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
  deliveryOnly=false,
): ProgressBreakdownProjection | Pick<ProgressBreakdownProjection,'rows'|'overallSummary'> {
  const profiling=deliveryOnly&&process.env.CMENG_PROFILE_PERF?.trim()==='1';
  let last=profiling?performance.now():0;
  const stages:Array<{part:string;ms:number}>=[];
  const mark=(part:string)=>{if(profiling){const now=performance.now();stages.push({part,ms:now-last});last=now;}};
  const config =
    input.config ??
    DEFAULT_SCHEDULE_ANALYSIS_CONFIG;
  // Reuse classifications across WBS, ancestor, overall and dimension views.
  // Scope this first-source-calendar index to the current source evaluation.
  const calendars=new Map<string,CanonicalScheduleModel['calendars'][number]>();
  for(const c of model.calendars)if(!calendars.has(c.calendarId))calendars.set(c.calendarId,c);
  const floatCache=new WeakMap<CanonicalScheduleActivity,{criticality:ReturnType<typeof sourceFloatCriticality>;thresholdHours:number|null}>();
  const sourceFloat=(a:CanonicalScheduleActivity)=>{
    const existing=floatCache.get(a);if(existing)return existing;
    const result={criticality:sourceFloatCriticality(model,a,config,calendars),
      thresholdHours:activityNearCriticalThresholdHours(model,a,config,calendars)};
    floatCache.set(a,result);return result;
  };
  // Scope this cache to one source evaluation, never to a project or process.
  const progressCache = new WeakMap<readonly CanonicalScheduleActivity[], ReturnType<typeof scheduleProgress>>();
  const progressFor = (rows: readonly CanonicalScheduleActivity[]) => {
    const previous = progressCache.get(rows);
    if (previous) return previous;
    const calculated = scheduleProgress(rows);
    progressCache.set(rows, calculated);
    return calculated;
  };
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


  mark('wbs_index');
  const plan = input.sharedPlanPositions ?? schedulePlanPositions(model, input.baselineModel ?? null);
  mark('plan_positions');
  const baselineMatches = input.sharedExactBaselineIds?null:
    input.baselineModel ? resolveRevisionActivityCorrespondence(input.baselineModel.activities, model.activities) : null;
  const baselineId = input.sharedExactBaselineIds??new Map(
    baselineMatches?.matches.map(match=>[match.toActivityId,match.fromActivityId])??model.activities.map(a=>[a.activityId,a.activityId]));
  mark('baseline_correspondence');
  const previousMatches = input.previousModel ? resolveRevisionActivityCorrespondence(input.previousModel.activities, model.activities) : null;
  const previousById = new Map(input.previousModel?.activities.map(a=>[a.activityId,a]) ?? []);
  const previous = new Map(previousMatches?.matches.map(match=>[match.toActivityId,previousById.get(match.fromActivityId)!]) ?? []);
  const dataDateMs = model.dataDateIso ? Date.parse(model.dataDateIso) : NaN;
  const programmeLongLeadActivityIds=input.sharedProgrammeLongLeadActivityIds??programmeLongLeadScope(model).activityIds;
  const effectiveFinish = (a:CanonicalScheduleActivity) => a.status==="completed"
    ? a.actualFinishIso ?? a.forecastFinishIso ?? a.currentFinishIso
    : a.forecastFinishIso ?? a.currentFinishIso;
  const milestoneThreatsByWbs = new Map<string,string[]>();
  for(const activity of model.activities){
    if(!["milestone","start_milestone","finish_milestone"].includes(activity.activityType)||
      activity.status==="completed"||activity.wbsId===null||
      (typeof activity.totalFloatHours==="number"&&activity.totalFloatHours>0))continue;
    const list=milestoneThreatsByWbs.get(activity.wbsId)??[];
    if(list.length<10)list.push(activity.activityId);
    milestoneThreatsByWbs.set(activity.wbsId,list);
  }
  const signalByActivity = new Map(model.activities.map(activity=>{
    const finishIso=effectiveFinish(activity);
    const finishMs=finishIso?Date.parse(finishIso):NaN;
    const baselineMs=activity.baselineFinishIso?Date.parse(activity.baselineFinishIso):NaN;
    const readiness=input.readinessEvidence?.[activity.activityId];
    const sourceLongLead=!!readiness?.procurement_material?.records?.some(record=>record.longLead===true);
    const programmeCandidate=programmeLongLeadActivityIds.has(activity.activityId);
    return [activity.activityId,{
      finishIso,
      delayed:activity.status!=="completed"&&(
        (Number.isFinite(dataDateMs)&&Number.isFinite(finishMs)&&finishMs<dataDateMs)||
        (Number.isFinite(baselineMs)&&Number.isFinite(finishMs)&&finishMs>baselineMs)
      ),
      longLead:sourceLongLead||programmeCandidate,
      longLeadSourceLinked:sourceLongLead,
      longLeadProgrammeCandidate:programmeCandidate,
      procurementBlocked:activity.status!=="completed"&&readiness?.procurement_material?.state==="blocked",
      designBlocked:activity.status!=="completed"&&readiness?.design_submittal?.state==="blocked",
      completedRecordCleanup:activity.status==="completed"&&(readiness?.procurement_material?.state==="blocked"||readiness?.design_submittal?.state==="blocked"),
      owners:Object.values(readiness??{}).flatMap(dimension=>(dimension.records??[]).map(row=>row.owner).filter((owner):owner is string=>!!owner)),
      pressure:activity.status!=="completed"&&typeof activity.totalFloatHours==="number"&&activity.totalFloatHours<=0,
    }] as const;
  }));
  const managementSignals = (activities:readonly CanonicalScheduleActivity[]) => {
    const wbsIds=new Set<string>();
    let forecastFinishIso:string|null=null,delayedActivityCount=0,longLeadActivityCount=0,longLeadSourceLinkedCount=0,longLeadProgrammeCandidateCount=0;
    let procurementBlockerCount=0,designBlockerCount=0,criticalOrNegative=0,completedRecordCleanupCount=0;const owners=new Set<string>();
    for(const activity of activities){
      if(activity.wbsId)wbsIds.add(activity.wbsId);
      const signal=signalByActivity.get(activity.activityId);
      if(!signal)continue;
      if(signal.finishIso&&(!forecastFinishIso||signal.finishIso>forecastFinishIso))forecastFinishIso=signal.finishIso;
      if(signal.delayed)delayedActivityCount++;
      if(signal.longLead)longLeadActivityCount++;
      if(signal.longLeadSourceLinked)longLeadSourceLinkedCount++;
      if(signal.longLeadProgrammeCandidate)longLeadProgrammeCandidateCount++;
      if(signal.completedRecordCleanup)completedRecordCleanupCount++;
      for(const owner of signal.owners)owners.add(owner);
      if(signal.procurementBlocked)procurementBlockerCount++;
      if(signal.designBlocked)designBlockerCount++;
      if(signal.pressure)criticalOrNegative++;
    }
    const milestoneThreatIds:string[]=[];
    for(const wbsId of wbsIds){
      for(const id of milestoneThreatsByWbs.get(wbsId)??[]){
        if(!milestoneThreatIds.includes(id))milestoneThreatIds.push(id);
        if(milestoneThreatIds.length>=10)break;
      }
      if(milestoneThreatIds.length>=10)break;
    }
    const managementAction = procurementBlockerCount>0
      ? "Expedite procurement/material blockers and protect the affected workfront dates."
      : designBlockerCount>0
        ? "Close design/RFI/submittal blockers before the affected workfront proceeds."
        : delayedActivityCount>0
          ? "Agree recovery dates and accountable actions for delayed activities in this scope."
          : criticalOrNegative>0
            ? "Protect remaining float and monitor the critical/negative-float activities."
            : completedRecordCleanupCount>0?"Programme work is complete. Reconcile the open register records as closeout; they are not blockers to starting this completed work.":"Monitor the current plan and recorded progress for this scope.";
    return {
      forecastFinishIso,
      delayedActivityCount,
      milestoneThreatIds,
      longLeadActivityCount,
      longLeadSourceLinkedCount,
      longLeadProgrammeCandidateCount,
      procurementBlockerCount,
      designBlockerCount,
      completedRecordCleanupCount,
      owner:[...owners].join('; ')||null,
      managementAction,
      physicalMeasuredPercent:null,
      certifiedPhysicalPercent:null,
    };
  };
  const enrich = (row: ProgressBreakdownRow, activities: readonly CanonicalScheduleActivity[]) => {
    const eligibleCount = progressFor(activities).totalCount;
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
      contractorReportedPercent: null,
      ...managementSignals(activities),
    };
  };
  mark('derived_activity_signals');
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
        progressFor,
        sourceFloat,
      ), activities),
    )
    .sort(
      (a, b) =>
        b.activityCount - a.activityCount ||
        naturalCompare(a.wbsId, b.wbsId),
    );

  mark('grouped_wbs_progress_rows');
  if(deliveryOnly){
    // Delivery consumes the exact WBS rows and scope summary, not the
    // specialist's six additional dimension/hierarchy views. The specialist
    // continues using the complete original producer unchanged.
    const scopeActivities=model.activities.filter(isExecutionActivity);
    const overallSummary=enrich(buildRow(model,'DELIVERY_SCOPE',null,scopeActivities,config,progressFor,sourceFloat),scopeActivities);
    mark('scope_summary');
    if(profiling)process.stdout.write(JSON.stringify({event:'workfront_breakdown_profile',projectId:model.projectId,activities:model.activities.length,
      baselineActivities:input.baselineModel?.activities.length??0,stages,totalMs:stages.reduce((n,part)=>n+part.ms,0)})+'\n');
    return {rows,overallSummary};
  }

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
    return { ...enrich(buildRow(model, id, node?.name ?? null, activities, config, progressFor,sourceFloat), activities),
      parentWbsId: node?.parentWbsId ?? null, depth,
      directActivityCount: groups.get(id)?.length ?? 0,
      progressAuthority: "submitted_schedule" as const,
      contractorReportedPercent: null, certifiedPhysicalPercent: null,
      basisNote: "Plans use working-calendar date phasing. Schedule snapshots remain separate from missing contractor-reported and certified physical measurements." };
  }).sort((a, b) => a.depth - b.depth || naturalCompare(a.wbsId, b.wbsId));

  const executionActivities = model.activities.filter(isExecutionActivity);
  const overallSummary=enrich(buildRow(model,'DELIVERY_SCOPE',null,executionActivities,config,progressFor,sourceFloat),executionActivities);
  const progressPosition = progressFor(executionActivities);
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
    // A whole-programme class (including Unclassified) has exactly the
    // same activity population as the previously calculated scope summary.
    // Reuse the full calculations, while retaining the dimension's own label.
    const fullPopulation=activities.length===executionActivities.length;
    const progress = fullPopulation ? progressPosition : progressFor(activities);
    const row = fullPopulation ? overallSummary : enrich(buildRow(model, groupKey, groupLabel, activities, config, progressFor,sourceFloat), activities);
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
      activityIds: activities.map(activity=>activity.activityId),
      baselinePlannedPercent: row.baselinePlannedPercent ?? null,
      currentPlanPercent: row.currentPlanPercent ?? null,
      physicalMeasuredPercent: row.physicalMeasuredPercent ?? null,
      certifiedPhysicalPercent: row.certifiedPhysicalPercent ?? null,
      forecastFinishIso: row.forecastFinishIso ?? null,
      delayedActivityCount: row.delayedActivityCount ?? 0,
      milestoneThreatIds: row.milestoneThreatIds ?? [],
      longLeadActivityCount: row.longLeadActivityCount ?? 0,
      longLeadSourceLinkedCount: row.longLeadSourceLinkedCount ?? 0,
      longLeadProgrammeCandidateCount: row.longLeadProgrammeCandidateCount ?? 0,
      procurementBlockerCount: row.procurementBlockerCount ?? 0,
      designBlockerCount: row.designBlockerCount ?? 0,
      owner: row.owner ?? null,
      managementAction: row.managementAction ?? "Monitor the current plan and recorded progress for this scope.",
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
    overallSummary,
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
    baselinePlanAvailable: Boolean(input.baselineModel) && hierarchyRows.some(row=>typeof row.baselinePlannedPercent==="number"),
    controlledBaselineAvailable: Boolean(input.baselineModel),
  };
}

/** Same WBS/activity equations; retains the complete specialist projection. */
export function buildProgressBreakdownProjection(
 model:CanonicalScheduleModel,input:Parameters<typeof buildProgressBreakdownProjectionImpl>[1],
):ProgressBreakdownProjection{
 return buildProgressBreakdownProjectionImpl(model,input,false) as ProgressBreakdownProjection;
}
/** Delivery-only consumer uses the same exact WBS rows and overall result.
 * No source activities, evidence, scoring or specialist content are dropped. */
export function buildDeliveryWorkfrontBreakdown(
 model:CanonicalScheduleModel,input:Parameters<typeof buildProgressBreakdownProjectionImpl>[1],
):Pick<ProgressBreakdownProjection,'rows'|'overallSummary'>{
 return buildProgressBreakdownProjectionImpl(model,input,true);
}
