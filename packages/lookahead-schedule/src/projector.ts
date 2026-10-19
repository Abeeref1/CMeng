import {naturalCompare} from '../../shared/src/natural-order';
import {activityDateExceptionReader} from '../../activity-analytics/src/exceptions';
import { addWorkingHours, resolveWorkingCalendar, parseScheduleInstant } from "../../schedule-cpm/src/calendar";
import {
  buildScheduleActivityLogicIndex,
  isExecutionActivity,
  calendarWorkingDayHours,
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

// These immutable dimension values contain no activity or project identity.
// Sharing absent-evidence descriptors avoids allocating eight identical objects
// for every activity. Source-backed descriptors and relationship receipts remain
// specific to the activity, and source changes rebuild the projection normally.
const absentDimensions=new Map<ReadinessDimensionKey,ReadinessDimension>(READINESS_KEYS.map(key=>[key,Object.freeze({key,state:"unknown" as const,sourceRefs:Object.freeze([]) as unknown as string[],note:null})]));

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

/** Pure per-projection results for one model: the same instant, calendar and
 * lag are converted once instead of once per relationship. Never shared
 * across models, so another project or revision cannot contaminate a row. */
export interface PredecessorAssessmentMemo {
  iso: Map<number, string>;
  calendars: Map<string | null, ReturnType<typeof resolveWorkingCalendar>>;
  /** calendarId|from|lag -> required instant, or null when the calendar calculation threw. */
  lagged: Map<string, number | null>;
}
export function predecessorAssessmentMemo(): PredecessorAssessmentMemo {
  return { iso: new Map(), calendars: new Map(), lagged: new Map() };
}

export function assessPredecessorRequirement(model: CanonicalScheduleModel, relation: CanonicalScheduleRelationship,
  predecessor: CanonicalScheduleActivity | undefined, successor: CanonicalScheduleActivity,
  instant:(value:string|null)=>number|null=parseScheduleInstant, memo?: PredecessorAssessmentMemo) {
  const unknown = (reason: string) => ({ state: "unknown" as const, requiredIso: null, note: relation.relationshipId + ": " + reason });
  if (!predecessor || relation.external) return unknown("Predecessor evidence is not established in this controlled programme.");
  if (relation.type === "unknown" || relation.lagHours === null || !Number.isFinite(relation.lagHours)) return unknown("Relationship type or lag is not established.");
  const predecessorAnchor = relation.type === "FS" || relation.type === "FF" ? effectiveFinish(predecessor) : effectiveStart(predecessor);
  const successorAnchor = relation.type === "FS" || relation.type === "SS" ? effectiveStart(successor) : effectiveFinish(successor);
  const from = instant(predecessorAnchor), target = instant(successorAnchor);
  if (from === null || target === null) return unknown("Required relationship date evidence is incomplete.");
  let required = from;
  if (relation.lagHours !== 0) {
    let calendar: ReturnType<typeof resolveWorkingCalendar>;
    if (memo && memo.calendars.has(successor.calendarId)) calendar = memo.calendars.get(successor.calendarId)!;
    else {
      calendar = resolveWorkingCalendar(successor.calendarId, model.calendars, false);
      memo?.calendars.set(successor.calendarId, calendar);
    }
    if (!calendar) return unknown("Successor working calendar is unresolved; lag cannot be evaluated.");
    const lagKey = memo ? successor.calendarId + "|" + from + "|" + relation.lagHours : "";
    const known = memo?.lagged.get(lagKey);
    if (known === null) return unknown("Working-calendar lag calculation is unresolved.");
    if (known !== undefined) required = known;
    else {
      try { required = addWorkingHours(calendar.calendar, from, relation.lagHours); }
      catch { memo?.lagged.set(lagKey, null); return unknown("Working-calendar lag calculation is unresolved."); }
      memo?.lagged.set(lagKey, required);
    }
  }
  let requiredIso = memo?.iso.get(required);
  if (requiredIso === undefined) {
    requiredIso = new Date(required).toISOString();
    memo?.iso.set(required, requiredIso);
  }
  return { state: required > target ? "blocked" as const : "ready" as const,
    requiredIso,
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
  instant:(value:string|null)=>number|null=parseScheduleInstant,
  memo?: PredecessorAssessmentMemo,
) {
  const dimensions: ReadinessDimension[] =
    READINESS_KEYS.map((key) => {
      if (key === "predecessor") {
        if (predecessors.length === 0) return { key, state: "not_applicable" as const, sourceRefs: [], note: "No incoming schedule relationships; review open-end logic separately." };
        // One pass over the incoming relationships: same checks, order and text.
        let anyBlocked = false, anyUnknown = false;
        const notes: string[] = [];
        for (const relation of predecessors) {
          const check = assessPredecessorRequirement(model, relation, activityById.get(relation.predecessorActivityId), activity, instant, memo);
          if (check.state === "blocked") anyBlocked = true;
          else if (check.state === "unknown") anyUnknown = true;
          notes.push(check.note);
        }
        const sourceRefs: string[] = [];
        for (const relation of predecessors) sourceRefs.push("schedule-relationship:" + relation.relationshipId, "schedule-activity:" + relation.predecessorActivityId);
        return {
          key, state: anyBlocked ? "blocked" as const
            : anyUnknown ? "unknown" as const : "ready" as const,
          sourceRefs,
          note: notes.join("; "),
        };
      }

      const evidence = externalEvidence?.[key];
      if (!evidence) return absentDimensions.get(key)!;
      if (evidence.state === "ready" && evidence.sourceRefs.length === 0) {
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

  // SW-18: "not applicable" is its own state. It is not counted as ready
  // (known) or blocked; it is counted separately.
  let blockedCount = 0, unknownCount = 0, readyCount = 0, notApplicableCount = 0;
  for (const dimension of dimensions) {
    if (dimension.state === "blocked") blockedCount++;
    else if (dimension.state === "unknown") unknownCount++;
    else if (dimension.state === "ready") readyCount++;
    else if (dimension.state === "not_applicable") notApplicableCount++;
  }

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
    notApplicableCount,
    dimensions,
  };
}

/** T11: readiness is a pure function of the revision model, the activity, its
 * incoming relationships, their predecessor activities and the evidence
 * object. Look-Ahead and Diagnosis assess the same activity of the same
 * revision; a later consumer reuses the earlier result only when every one of
 * those inputs is the very same object. Entries are held weakly by the
 * immutable revision model, so another project or revision never shares one.
 * The instant reader and memo only speed up the same arithmetic. */
type SharedReadinessEntry={predecessors:readonly CanonicalScheduleRelationship[];
  predecessorActivities:(CanonicalScheduleActivity|undefined)[];evidence:unknown;value:ReturnType<typeof readinessForActivity>};
const sharedReadinessByModel=new WeakMap<CanonicalScheduleModel,WeakMap<CanonicalScheduleActivity,SharedReadinessEntry>>();
export function sharedReadinessForActivity(
  model: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
  predecessors: readonly CanonicalScheduleRelationship[],
  activityById: ReadonlyMap<string, CanonicalScheduleActivity>,
  externalEvidence: Partial<Record<ReadinessDimensionKey, ReadinessEvidence>> | undefined,
  instant:(value:string|null)=>number|null=parseScheduleInstant,
  memo?: PredecessorAssessmentMemo,
) {
  let byActivity=sharedReadinessByModel.get(model);
  if(!byActivity){byActivity=new WeakMap();sharedReadinessByModel.set(model,byActivity);}
  const entry=byActivity.get(activity);
  if(entry&&entry.evidence===externalEvidence&&entry.predecessors.length===predecessors.length){
    let same=true;
    for(let i=0;i<predecessors.length;i++){
      const relation=predecessors[i]!;
      if(relation!==entry.predecessors[i]||activityById.get(relation.predecessorActivityId)!==entry.predecessorActivities[i]){same=false;break;}
    }
    if(same)return entry.value;
  }
  const value=readinessForActivity(model,activity,predecessors,activityById,externalEvidence,instant,memo);
  byActivity.set(activity,{predecessors:predecessors.slice(),
    predecessorActivities:predecessors.map(relation=>activityById.get(relation.predecessorActivityId)),evidence:externalEvidence,value});
  return value;
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
  // Many live programmes have no milestone-typed activities. A full reverse
  // relationship index cannot produce downstream milestones in that case.
  if(!model.activities.some(a=>a.activityType==='start_milestone'||a.activityType==='finish_milestone'))return new Map();
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
    drivingActivityIds?:readonly string[]|undefined;
    readinessEvidence?: Record<
      string,
      Partial<Record<ReadinessDimensionKey, ReadinessEvidence>>
    >;
  },
): LookAheadProjection {
  const profiling=process.env.CMENG_PROFILE_PERF==='1';
  let previous=profiling?performance.now():0;
  const stages:Array<{part:string;ms:number}>=[];
  const stage=(part:string)=>{if(profiling){const now=performance.now();stages.push({part,ms:now-previous});previous=now;}};
  const windowDays = input.windowDays ?? 42;
  const drivingIds=input.drivingActivityIds?new Set(input.drivingActivityIds):null;
  if (
    !Number.isSafeInteger(windowDays) ||
    windowDays <= 0
  ) {
    throw new Error(
      "Look-ahead windowDays must be a positive integer",
    );
  }

  // Parse each distinct programme date once per projection, without allowing
  // dates from another project or revision to contaminate this result.
  const parsedInstants=new Map<string,number|null>();
  const instant=(value:string|null):number|null=>{
    if(!value)return null;
    if(parsedInstants.has(value))return parsedInstants.get(value)!;
    const result=ms(value);
    parsedInstants.set(value,result);
    return result;
  };
  const dataDateMs = instant(model.dataDateIso);
  const dateExceptions=activityDateExceptionReader(model.dataDateIso);
  const windowEndMs =
    dataDateMs === null
      ? null
      : dataDateMs +
        windowDays * 86_400_000;

  const logic =
    buildScheduleActivityLogicIndex(model,true);

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
  // One exact source-calendar day definition per calendar, reused by each row.
  // A missing/incomplete calendar never falls back to eight or twenty-four hours.
  const firstCalendars=new Map<string,(typeof model.calendars)[number]>();
  for(const calendar of model.calendars)if(!firstCalendars.has(calendar.calendarId))firstCalendars.set(calendar.calendarId,calendar);
  const dayHoursByCalendar=new Map<string|null,number|null>();
  const floatDayHours=(id:string|null)=>{
    if(dayHoursByCalendar.has(id))return dayHoursByCalendar.get(id)!;
    const hours=calendarWorkingDayHours(id===null?null:firstCalendars.get(id)??null);
    dayHoursByCalendar.set(id,hours);
    return hours;
  };
  const wbsPaths=wbsPathLookup(model);
  const downstreamMilestones=downstreamMilestoneLookup(model);
  // Exact per-projection conversions: each distinct instant, day offset and
  // float/day-hours pair is formatted once, with the same arithmetic.
  const predecessorMemo=predecessorAssessmentMemo();
  const dayOffsets=new Map<number,number>();
  const dayOffset=(value:number)=>{
    let result=dayOffsets.get(value);
    if(result===undefined){result=Number(((value-dataDateMs!)/86_400_000).toFixed(6));dayOffsets.set(value,result);}
    return result;
  };
  const floatWorkingDays=new Map<number,Map<number,number>>();
  const workingDaysFor=(sourceHours:number,dayHours:number)=>{
    let byHours=floatWorkingDays.get(dayHours);
    if(!byHours){byHours=new Map();floatWorkingDays.set(dayHours,byHours);}
    let result=byHours.get(sourceHours);
    if(result===undefined){result=Number((sourceHours/dayHours).toFixed(6));byHours.set(sourceHours,result);}
    return result;
  };
  stage('indexes_and_dates');

  for (const activity of incomplete) {
    const startIso = effectiveStart(activity);
    const finishIso = effectiveFinish(activity);
    const startMs = instant(startIso);
    const finishMs = instant(finishIso);

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

    if (!isOverdue && !missedStart && !overlapsWindow) {
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

    const dayHours=floatDayHours(activity.calendarId);
    const sourceHours=typeof activity.totalFloatHours==='number'&&Number.isFinite(activity.totalFloatHours)?activity.totalFloatHours:null;
    const sourceWorkingDays=dayHours!==null&&dayHours>0&&sourceHours!==null?workingDaysFor(sourceHours,dayHours):null;
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
      submittedTotalFloatHours:sourceHours,
      submittedTotalFloatWorkingDays:sourceWorkingDays,
      workingDayHours:dayHours,
      floatDaysBasis:sourceWorkingDays===null?'calendar_working_day_not_established':'source_activity_calendar',
      drivingPath:drivingIds?drivingIds.has(activity.activityId):null,
      classification,
      missedPlannedStart: missedStart,
      finishOverdue: isOverdue,
      predecessorIds:
        [...(activityLogic?.predecessorIds ?? [])],
      successorIds:
        [...(activityLogic?.successorIds ?? [])],
      readiness: sharedReadinessForActivity(
        model,
        activity,
        incoming.get(activity.activityId) ?? [],
        activityById,
        input.readinessEvidence?.[activity.activityId],
        instant,
        predecessorMemo,
      ),
      daysToStart: dayOffset(startMs),
      daysToFinish: dayOffset(finishMs),
    };
    if(isOverdue || missedStart)overdueBacklogRows.push(row);
    else forwardWindowRows.push(row);
  }

  stage('activity_rows_and_readiness');
  const byFinish=(a:LookAheadActivityRow,b:LookAheadActivityRow)=>{
    const aDate=a.finishIso??"9999",bDate=b.finishIso??"9999";
    return aDate.localeCompare(bDate)||naturalCompare(a.activityId,b.activityId);
  };
  forwardWindowRows.sort(byFinish);
  const backlogAge=(row:LookAheadActivityRow)=>Math.max(0,row.missedPlannedStart?-(row.daysToStart??0):0,row.finishOverdue?-(row.daysToFinish??0):0);
  overdueBacklogRows.sort((a,b)=>backlogAge(b)-backlogAge(a)||byFinish(a,b));
  const rows=[...overdueBacklogRows,...forwardWindowRows].sort(byFinish);

  stage('sort_rows');
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
    owner:[...new Set(group.rows.flatMap(row=>row.readiness.dimensions.filter(d=>d.key===group.blockerType).flatMap(d=>(d.records??[]).filter(record=>record.state==='blocked').map(record=>record.owner).filter((owner):owner is string=>!!owner))))].join('; ')||null,
    action:readinessAction[group.blockerType],
    sourceRefs:[...group.sourceRefs],
  })).sort((a,b)=>b.activityCount-a.activityCount||(a.requiredByIso??"9999").localeCompare(b.requiredByIso??"9999")||String(a.wbsPath??"").localeCompare(String(b.wbsPath??"")));

  // One complete population traversal replaces 36 repeated full-table
  // scans and per-row dimension searches. The retained source record set is
  // unchanged: these are authoritative denominators, not visible-row counts.
  const coverageByDimension=new Map<ReadinessDimensionKey,{
    linkedActivityCount:number;sourceRefs:Set<string>;
    unresolvedLinkedActivityCount:number;knownCount:number;
  }>(READINESS_KEYS.map(key=>[key,{
    linkedActivityCount:0,sourceRefs:new Set<string>(),
    unresolvedLinkedActivityCount:0,knownCount:0,
  }]));
  for(const row of forwardWindowRows)for(const dimension of row.readiness.dimensions){
    const bucket=coverageByDimension.get(dimension.key)!;
    if(dimension.sourceRefs.length){
      bucket.linkedActivityCount++;
      for(const ref of dimension.sourceRefs)bucket.sourceRefs.add(ref);
      if(dimension.state==='unknown')bucket.unresolvedLinkedActivityCount++;
    }
    if(dimension.state!=='unknown')bucket.knownCount++;
  }

  stage('group_and_coverage');
  if(profiling)process.stdout.write(JSON.stringify({event:'lookahead_profile',projectId:model.projectId,activities:model.activities.length,relationships:model.relationships.length,stages})+'\n');
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
    // Preserve the established finish-overdue definition; backlog is the union of overdue starts and finishes.
    overdueCount: overdueBacklogRows.filter(row=>row.finishOverdue).length,
    missedStartCount: overdueBacklogRows.filter(row => row.missedPlannedStart).length,
    evidenceGapActivityCount: forwardWindowRows.filter(row => row.readiness.unknownCount > 0).length,
    blockedWithEvidenceGapCount: forwardWindowRows.filter(row => row.readiness.state === "blocked" && row.readiness.unknownCount > 0).length,
    blockerOccurrenceCount: forwardWindowRows.reduce((sum, row) => sum + row.readiness.blockedCount, 0),
    blockerTypes: summarizeReadinessBlockers(forwardWindowRows),
    readinessCoverage: READINESS_KEYS.map(key => {
      const bucket=coverageByDimension.get(key)!;
      return {key,denominator:forwardWindowRows.length,
        linkedActivityCount:bucket.linkedActivityCount,
        linkedSourceRecordCount:bucket.sourceRefs.size,
        unresolvedLinkedActivityCount:bucket.unresolvedLinkedActivityCount,
        knownCount:bucket.knownCount,
        coveragePercent:coverage(bucket.knownCount,forwardWindowRows.length)};
    }),
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
    atRiskCount:forwardWindowRows.filter(row=>row.readiness.state==='conditional'&&
      row.readiness.dimensions.some(dim=>dim.key!=='predecessor'&&dim.sourceRefs.length>0)).length,
    noKnownLinkedBlockerCount:forwardWindowRows.filter(row=>row.readiness.state==='conditional'&&
      !row.readiness.dimensions.some(dim=>dim.key!=='predecessor'&&dim.sourceRefs.length>0)).length,
    blockedCount: forwardWindowRows.filter(
      (row) => row.readiness.state === "blocked",
    ).length,
    rows,
    missingCurrentDateActivityIds:
      missingCurrentDateActivityIds.sort(),
  };
}
