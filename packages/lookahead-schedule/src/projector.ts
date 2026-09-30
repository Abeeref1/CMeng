import {naturalCompare} from '../../shared/src/natural-order';
import {activityDateExceptionReader} from '../../activity-analytics/src/exceptions';
import { addWorkingHours, resolveWorkingCalendar, parseScheduleInstant } from "../../schedule-cpm/src/calendar";
import {
  buildScheduleActivityLogicIndex,
  isExecutionActivity,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
  type CanonicalScheduleRelationship,
} from "../../schedule-analysis-core/src";
import type {
  LookAheadActivityRow,
  LookAheadProjection,
  ReadinessDimension,
  ReadinessDimensionKey,
  ReadinessEvidence,
} from "./types";

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseScheduleInstant(value);
  return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(msValue: number): string {
  return new Date(msValue).toISOString().slice(0, 10);
}


const READINESS_KEYS: readonly ReadinessDimensionKey[] = [
  "predecessor",
  "procurement_material",
  "design_submittal",
  "permit",
  "resource",
  "quality",
  "commercial",
  "risk",
  "access",
];

/** Preserve the source record type when several registers feed one readiness dimension. */
export function summarizeReadinessBlockers(rows: readonly LookAheadActivityRow[]) {
  const groups = new Map<string, { activities: Set<string>; records: Set<string>; recordIds: Set<string> }>();
  for (const row of rows) for (const dimension of row.readiness.dimensions) {
    if (dimension.state !== "blocked") continue;
    const records = (dimension.records ?? []).filter(record => record.state === "blocked");
    for (const record of records.length ? records : [{ documentType: dimension.key, recordId: null, sourceRefs: dimension.sourceRefs }]) {
      const group = groups.get(record.documentType) ?? { activities: new Set<string>(), records: new Set<string>(), recordIds: new Set<string>() };
      group.activities.add(row.activityId);
      group.records.add(record.recordId ?? (record.sourceRefs.join("|") || row.activityId + ":" + dimension.key));
      if (record.recordId) group.recordIds.add(record.recordId);
      groups.set(record.documentType, group);
    }
  }
  return [...groups].map(([documentType, group]) => ({ documentType, activityCount: group.activities.size,
    recordCount: group.records.size, recordIds: [...group.recordIds].sort() }))
    .sort((a, b) => b.activityCount - a.activityCount || a.documentType.localeCompare(b.documentType));
}

export function assessPredecessorRequirement(model: CanonicalScheduleModel, relation: CanonicalScheduleRelationship,
  predecessor: CanonicalScheduleActivity | undefined, successor: CanonicalScheduleActivity) {
  const unknown = (reason: string) => ({ state: "unknown" as const, requiredIso: null, note: relation.relationshipId + ": " + reason });
  if (!predecessor || relation.external) return unknown("Predecessor evidence is not established in this controlled programme.");
  if (relation.type === "unknown" || relation.lagHours === null || !Number.isFinite(relation.lagHours)) return unknown("Relationship type or lag is not established.");
  const predecessorAnchor = relation.type === "FS" || relation.type === "FF" ? effectiveFinish(predecessor) : effectiveStart(predecessor);
  const successorAnchor = relation.type === "FS" || relation.type === "SS" ? effectiveStart(successor) : effectiveFinish(successor);
  const from = parseScheduleInstant(predecessorAnchor), target = parseScheduleInstant(successorAnchor);
  if (from === null || target === null) return unknown("Required relationship date evidence is incomplete.");
  let required = from;
  if (relation.lagHours !== 0) {
    const calendar = resolveWorkingCalendar(successor.calendarId, model.calendars, false);
    if (!calendar) return unknown("Successor working calendar is unresolved; lag cannot be evaluated.");
    try { required = addWorkingHours(calendar.calendar, from, relation.lagHours); }
    catch { return unknown("Working-calendar lag calculation is unresolved."); }
  }
  return { state: required > target ? "blocked" as const : "ready" as const,
    requiredIso: new Date(required).toISOString(),
    note: relation.relationshipId + ": " + relation.type + ", lag " + relation.lagHours + " working hours (successor calendar); " +
      (required > target ? "predecessor requirement is later than the successor target." : "relationship requirement fits the submitted dates; physical readiness is assessed separately.") };
}

export function readinessForActivity(
  model: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
  predecessors: readonly CanonicalScheduleRelationship[],
  activityById: ReadonlyMap<string, CanonicalScheduleActivity>,
  externalEvidence:
    | Partial<Record<ReadinessDimensionKey, ReadinessEvidence>>
    | undefined,
) {
  const dimensions: ReadinessDimension[] =
    READINESS_KEYS.map((key) => {
      if (key === "predecessor") {
        if (predecessors.length === 0) return { key, state: "not_applicable" as const, sourceRefs: [], note: "No incoming schedule relationships; review open-end logic separately." };
        const checks = predecessors.map(relation => assessPredecessorRequirement(model, relation, activityById.get(relation.predecessorActivityId), activity));
        return {
          key, state: checks.some(check => check.state === "blocked") ? "blocked" as const
            : checks.some(check => check.state === "unknown") ? "unknown" as const : "ready" as const,
          sourceRefs: predecessors.flatMap(relation => ["schedule-relationship:" + relation.relationshipId, "schedule-activity:" + relation.predecessorActivityId]),
          note: checks.map(check => check.note).join("; "),
        };
      }

      const evidence = externalEvidence?.[key];
      if (!evidence || evidence.state === "ready" && evidence.sourceRefs.length === 0) {
        return {
          key,
          state: "unknown" as const,
          sourceRefs: [],
          note: evidence ? "Readiness assertion has no supporting evidence reference." : null,
        };
      }

      return {
        key,
        state: evidence.state,
        sourceRefs: [...evidence.sourceRefs],
        note: evidence.note ?? null,
        diagnostics: [...(evidence.diagnostics??[])],
        records:[...(evidence.records??[])],
      };
    });

  const blockedCount = dimensions.filter(
    (dimension) => dimension.state === "blocked",
  ).length;
  const unknownCount = dimensions.filter(
    (dimension) => dimension.state === "unknown",
  ).length;
  const readyCount = dimensions.filter(
    (dimension) =>
      dimension.state === "ready" ||
      dimension.state === "not_applicable",
  ).length;

  return {
    state:
      blockedCount > 0
        ? "blocked" as const
        : unknownCount > 0
          ? "conditional" as const
          : "ready" as const,
    readyCount,
    blockedCount,
    unknownCount,
    dimensions,
  };
}

function coverage(
  known: number,
  total: number,
): number | null {
  if (total === 0) return null;
  return Number(((known / total) * 100).toFixed(4));
}

function effectiveStart(
  activity: CanonicalScheduleActivity,
): string | null {
  if (activity.actualStartIso) {
    return activity.actualStartIso;
  }
  return (
    activity.forecastStartIso ??
    activity.currentStartIso
  );
}

function effectiveFinish(
  activity: CanonicalScheduleActivity,
): string | null {
  if (activity.actualFinishIso) {
    return activity.actualFinishIso;
  }
  return (
    activity.forecastFinishIso ??
    activity.currentFinishIso
  );
}

function wbsPathLookup(model: CanonicalScheduleModel): Map<string,string> {
  const nodes=new Map(model.wbs.map(node=>[node.wbsId,node]));
  const cache=new Map<string,string>();
  const pathFor=(id:string|null):string=>{
    if(!id)return '';
    const cached=cache.get(id);if(cached!==undefined)return cached;
    const parts:string[]=[],seen=new Set<string>();let current:string|null=id;
    while(current&&!seen.has(current)){
      seen.add(current);const node=nodes.get(current);if(!node)break;
      parts.unshift(node.name??node.wbsId);current=node.parentWbsId??null;
    }
    const value=parts.join(' / ');cache.set(id,value);return value;
  };
  for(const id of nodes.keys())pathFor(id);
  return cache;
}

function downstreamMilestoneLookup(model:CanonicalScheduleModel):Map<string,string[]>{
  const byId=new Map(model.activities.map(activity=>[activity.activityId,activity]));
  const predecessors=new Map<string,string[]>();
  for(const rel of model.relationships){
    if(rel.external||!byId.has(rel.predecessorActivityId)||!byId.has(rel.successorActivityId))continue;
    const rows=predecessors.get(rel.successorActivityId)??[];
    rows.push(rel.predecessorActivityId);predecessors.set(rel.successorActivityId,rows);
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
        if(!set.has(current.milestoneId)&&set.size<5){
          set.add(current.milestoneId);milestonesByActivity.set(predecessorId,set);
          queue.push({id:predecessorId,milestoneId:current.milestoneId,depth});
        }
      }
    }
  }
  return new Map([...milestonesByActivity.entries()].map(([id,set])=>[id,[...set].sort(naturalCompare).slice(0,5)]));
}

const readinessAction:Record<ReadinessDimensionKey,string>={
  predecessor:'Resolve the predecessor/logic requirement before releasing the affected activities.',
  procurement_material:'Expedite the material/procurement requirement and confirm the programme need date.',
  design_submittal:'Close the design/RFI/submittal requirement before the affected work proceeds.',
  permit:'Secure or renew the required permit/authority approval before the affected work proceeds.',
  resource:'Mobilise or reallocate the required labour/equipment capacity for the affected workfront.',
  quality:'Close the quality hold/inspection requirement before the affected work proceeds.',
  commercial:'Resolve the commercial instruction/change/payment dependency affecting the workfront.',
  risk:'Implement the linked mitigation or escalation affecting the workfront.',
  access:'Resolve site/access/logistics readiness before the affected activities are released.',
};

export function buildLookAheadProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    windowDays?: number;
    readinessEvidence?: Record<
      string,
      Partial<Record<ReadinessDimensionKey, ReadinessEvidence>>
    >;
  },
): LookAheadProjection {
  const windowDays = input.windowDays ?? 42;
  if (
    !Number.isSafeInteger(windowDays) ||
    windowDays <= 0
  ) {
    throw new Error(
      "Look-ahead windowDays must be a positive integer",
    );
  }

  const dataDateMs = ms(model.dataDateIso);
  const dateExceptions=activityDateExceptionReader(model.dataDateIso);
  const windowEndMs =
    dataDateMs === null
      ? null
      : dataDateMs +
        windowDays * 86_400_000;

  const logic =
    buildScheduleActivityLogicIndex(model);

  const activityById = new Map(model.activities.map(activity => [activity.activityId, activity]));
  const incoming = new Map<string, CanonicalScheduleRelationship[]>();
  for (const relation of model.relationships) { const rows = incoming.get(relation.successorActivityId) ?? []; rows.push(relation); incoming.set(relation.successorActivityId, rows); }
  const incomplete = model.activities.filter(
    (activity) =>
      activity.status !== "completed" &&
      isExecutionActivity(activity),
  );

  const missingCurrentDateActivityIds: string[] = [];
  const forwardWindowRows: LookAheadActivityRow[] = [];
  const overdueBacklogRows: LookAheadActivityRow[] = [];
  const wbsPaths=wbsPathLookup(model);
  const downstreamMilestones=downstreamMilestoneLookup(model);

  for (const activity of incomplete) {
    const startIso = effectiveStart(activity);
    const finishIso = effectiveFinish(activity);
    const startMs = ms(startIso);
    const finishMs = ms(finishIso);

    if (
      dataDateMs === null ||
      startMs === null ||
      finishMs === null
    ) {
      missingCurrentDateActivityIds.push(
        activity.activityId,
      );
      continue;
    }

    const dates=dateExceptions(activity);
    const isOverdue = dates.finishOverdue === true;
    const missedStart = dates.missedPlannedStart === true;
    const overlapsWindow =
      startMs <= windowEndMs! &&
      finishMs >= dataDateMs;

    if (!isOverdue && !overlapsWindow) {
      continue;
    }

    let classification:
      LookAheadActivityRow["classification"];

    if (isOverdue) {
      classification = "overdue";
    } else if (missedStart) {
      classification = "missed_start";
    } else if (
      startMs <= dataDateMs &&
      finishMs >= dataDateMs
    ) {
      classification = "ongoing";
    } else if (
      finishMs <= windowEndMs!
    ) {
      classification =
        "finishing_in_window";
    } else {
      classification = "upcoming";
    }

    const activityLogic =
      logic.byActivityId[activity.activityId];

    const row:LookAheadActivityRow={
      activityId: activity.activityId,
      name: activity.name,
      wbsId: activity.wbsId,
      wbsPath: activity.wbsId ? wbsPaths.get(activity.wbsId) ?? null : null,
      affectedMilestoneIds: downstreamMilestones.get(activity.activityId)??[],
      activityType: activity.activityType,
      status: activity.status,
      startIso,
      finishIso,
      baselineFinishIso:
        activity.baselineFinishIso,
      percentComplete:
        activity.percentComplete,
      totalFloatHours:
        activity.totalFloatHours,
      classification,
      missedPlannedStart: missedStart,
      finishOverdue: isOverdue,
      predecessorIds:
        activityLogic?.predecessorIds ?? [],
      successorIds:
        activityLogic?.successorIds ?? [],
      readiness: readinessForActivity(
        model,
        activity,
        incoming.get(activity.activityId) ?? [],
        activityById,
        input.readinessEvidence?.[activity.activityId],
      ),
      daysToStart: Number(
        (
          (startMs - dataDateMs) /
          86_400_000
        ).toFixed(6),
      ),
      daysToFinish: Number(
        (
          (finishMs - dataDateMs) /
          86_400_000
        ).toFixed(6),
      ),
    };
    if(isOverdue)overdueBacklogRows.push(row);
    else forwardWindowRows.push(row);
  }

  const byFinish=(a:LookAheadActivityRow,b:LookAheadActivityRow)=>{
    const aDate=a.finishIso??"9999",bDate=b.finishIso??"9999";
    return aDate.localeCompare(bDate)||naturalCompare(a.activityId,b.activityId);
  };
  forwardWindowRows.sort(byFinish);
  overdueBacklogRows.sort((a,b)=>(a.daysToFinish??0)-(b.daysToFinish??0)||byFinish(a,b));
  const rows=[...overdueBacklogRows,...forwardWindowRows].sort(byFinish);

  const managementGroups=new Map<string,{
    blockerType:ReadinessDimensionKey;wbsId:string|null;wbsPath:string|null;rows:LookAheadActivityRow[];sourceRefs:Set<string>
  }>();
  for(const row of forwardWindowRows){
    for(const dimension of row.readiness.dimensions){
      if(dimension.state!=="blocked")continue;
      const key=dimension.key+"|"+(row.wbsId??"");
      const group=managementGroups.get(key)??{blockerType:dimension.key,wbsId:row.wbsId,wbsPath:row.wbsPath??null,rows:[],sourceRefs:new Set<string>()};
      group.rows.push(row);for(const ref of dimension.sourceRefs)group.sourceRefs.add(ref);managementGroups.set(key,group);
    }
  }
  const managementInterventions=[...managementGroups.values()].map(group=>({
    blockerType:group.blockerType,wbsId:group.wbsId,wbsPath:group.wbsPath,
    activityCount:group.rows.length,activityIds:group.rows.map(row=>row.activityId),
    affectedMilestoneIds:[...new Set(group.rows.flatMap(row=>row.affectedMilestoneIds??[]))].slice(0,10),
    requiredByIso:group.rows.map(row=>row.startIso).filter((value):value is string=>!!value).sort()[0]??null,
    owner:null,
    action:readinessAction[group.blockerType],
    sourceRefs:[...group.sourceRefs],
  })).sort((a,b)=>b.activityCount-a.activityCount||(a.requiredByIso??"9999").localeCompare(b.requiredByIso??"9999")||String(a.wbsPath??"").localeCompare(String(b.wbsPath??"")));

  return {
    schemaVersion: "1.0",
    projectionKey: "lookahead_schedule",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId: model.projectId,
    sourceRevisionId:
      model.sourceRevisionId,
    dataDateIso: model.dataDateIso,
    windowDays,
    windowEndIso:
      windowEndMs === null
        ? null
        : dateOnly(windowEndMs),
    incompleteActivityCount:
      incomplete.length,
    datedIncompleteActivityCount:
      incomplete.length -
      missingCurrentDateActivityIds.length,
    currentDateCoveragePercent: coverage(
      incomplete.length -
        missingCurrentDateActivityIds.length,
      incomplete.length,
    ),
    overdueCount: overdueBacklogRows.length,
    missedStartCount: forwardWindowRows.filter(row => row.missedPlannedStart).length,
    evidenceGapActivityCount: forwardWindowRows.filter(row => row.readiness.unknownCount > 0).length,
    blockedWithEvidenceGapCount: forwardWindowRows.filter(row => row.readiness.state === "blocked" && row.readiness.unknownCount > 0).length,
    blockerOccurrenceCount: forwardWindowRows.reduce((sum, row) => sum + row.readiness.blockedCount, 0),
    blockerTypes: summarizeReadinessBlockers(forwardWindowRows),
    readinessCoverage: READINESS_KEYS.map(key => ({ key, denominator: forwardWindowRows.length,
      linkedActivityCount: forwardWindowRows.filter(row=>(row.readiness.dimensions.find(d=>d.key===key)?.sourceRefs.length??0)>0).length,
      linkedSourceRecordCount: new Set(forwardWindowRows.flatMap(row=>row.readiness.dimensions.find(d=>d.key===key)?.sourceRefs??[])).size,
      unresolvedLinkedActivityCount: forwardWindowRows.filter(row=>row.readiness.dimensions.some(d=>d.key===key&&d.state==='unknown'&&d.sourceRefs.length>0)).length,
      knownCount: forwardWindowRows.filter(row => row.readiness.dimensions.find(d => d.key === key)?.state !== "unknown").length,
      coveragePercent: coverage(forwardWindowRows.filter(row => row.readiness.dimensions.find(d => d.key === key)?.state !== "unknown").length, forwardWindowRows.length),
    })),
    forwardWindowCount:forwardWindowRows.length,
    overdueBacklogCount:overdueBacklogRows.length,
    overdueBacklogBlockedCount:overdueBacklogRows.filter(row=>row.readiness.state==="blocked").length,
    forwardWindowRows,
    overdueBacklogRows,
    managementInterventions,
    readyCount: forwardWindowRows.filter(
      (row) => row.readiness.state === "ready",
    ).length,
    conditionalCount: forwardWindowRows.filter(
      (row) => row.readiness.state === "conditional",
    ).length,
    blockedCount: forwardWindowRows.filter(
      (row) => row.readiness.state === "blocked",
    ).length,
    rows,
    missingCurrentDateActivityIds:
      missingCurrentDateActivityIds.sort(),
  };
}
