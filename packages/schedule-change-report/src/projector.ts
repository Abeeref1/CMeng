import {classifyScheduleChanges} from "../../schedule-revision-core/src";
import { isExecutionActivity,parseScheduleTime,analyzeSchedule,calendarWorkingDayHours,type CanonicalScheduleModel } from "../../schedule-analysis-core/src";
import {scheduleActivityFinish} from '../../schedule-revision-core/src/compare';
import {dateValue,populationContract} from '../../truth-kernel/src';
import {
  compareScheduleRevisions,
  orderScheduleRevisionsChronologically,
  type ScheduleRevision,
} from "../../schedule-revision-core/src";
import type {
  ScheduleChangeReportProjection,
} from "./types";

/** T06: working-day length of one revision's source calendar (first source
 * calendar ID wins, as in the shared float rule); unknown stays null. */
function revisionDayHours(model:CanonicalScheduleModel){
  const first=new Map<string,CanonicalScheduleModel['calendars'][number]>();
  for(const calendar of model.calendars)if(!first.has(calendar.calendarId))first.set(calendar.calendarId,calendar);
  const memo=new Map<string|null,number|null>();
  return (id:string|null)=>{
    if(!memo.has(id))memo.set(id,calendarWorkingDayHours(id===null?null:first.get(id)??null));
    return memo.get(id)!;
  };
}

export function buildScheduleChangeReportProjection(
  from: ScheduleRevision,
  to: ScheduleRevision,
  input: {
    generatedAt: string;
    producerVersion: string;
    // Optional identical-revision comparison calculated earlier in the same management bundle.
    precomputedComparison?: ReturnType<typeof compareScheduleRevisions>;
    // Reuse this exact from/to source classification when Revision Trend has
    // already classified the same comparison; fallback remains independent.
    precomputedChangeCategories?: ReturnType<typeof classifyScheduleChanges>;
    // Reuse exact source-model analyses already calculated in this evaluation.
    precomputedAnalyses?: ReadonlyMap<ScheduleRevision['model'],ReturnType<typeof analyzeSchedule>>;
  },
): ScheduleChangeReportProjection {
  const comparison = input.precomputedComparison ?? compareScheduleRevisions(from, to);
  const currentExecution = new Set(to.model.activities.filter(isExecutionActivity).map(a=>a.activityId));
  const before=new Map(from.model.activities.map(a=>[a.activityId,a])),after=new Map(to.model.activities.map(a=>[a.activityId,a]));
  const finishRows=comparison.activityChanges.flatMap(change=>{
    const a=before.get(change.fromActivityId??''),b=after.get(change.toActivityId??'');
    const fromFinishIso=a?scheduleActivityFinish(a):null,toFinishIso=b?scheduleActivityFinish(b):null;
    return fromFinishIso&&toFinishIso&&dateValue(fromFinishIso)&&dateValue(toFinishIso)&&change.finishShiftDays!==null?[{activityId:change.activityId,fromFinishIso,toFinishIso,movementDays:change.finishShiftDays}]:[];
  });
  const maximumDays=finishRows.length?finishRows.reduce((max,r)=>Math.max(max,r.movementDays),-Infinity):null;
  const maximumRows=finishRows.filter(r=>r.movementDays===maximumDays);
  const knownIds=new Set(finishRows.map(r=>r.activityId));
  const finishMovementAnalysis={fromLabel:from.label??from.revisionId,toLabel:to.label??to.revisionId,
    population:populationContract({name:'Revision-comparable source activity finish dates',entity:'activity',dataDateIso:to.model.dataDateIso,
      dateBasis:'source finish elapsed days (24 hours) for each matched activity; unchanged matched records included',sourceRevisionId:from.revisionId+'->'+to.revisionId,
      authority:'calculated',sourceCount:comparison.activityChanges.length,memberIds:[...knownIds],exclusions:comparison.activityChanges.filter(r=>!knownIds.has(r.activityId)).map(r=>({id:r.activityId,reason:'unmatched_or_finish_date_missing'}))}),
    maximumDays,maximumCount:maximumDays===null?null:maximumRows.length,maximumPercent:finishRows.length?maximumRows.length/finishRows.length*100:null,
    sourcePairVerifiedCount:maximumRows.filter(r=>Math.abs((parseScheduleTime(r.toFinishIso)-parseScheduleTime(r.fromFinishIso))/86_400_000-r.movementDays)<0.000001).length,maximumRows,causation:'not_established' as const};

  // T06: float shift in working days converts each side with its own
  // revision's calendar; days only when both sides are known and live.
  const fromDayHours=revisionDayHours(from.model),toDayHours=revisionDayHours(to.model);
  const floatShiftDays=(change:(typeof comparison.activityChanges)[number])=>{
    if(change.floatShiftHours===null)return {floatShiftWorkingDays:null,floatShiftDaysBasis:null};
    const a=before.get(change.fromActivityId??''),b=after.get(change.toActivityId??'');
    if(!a||!b)return {floatShiftWorkingDays:null,floatShiftDaysBasis:'calendar_working_day_not_established'};
    if(a.status==='completed'||b.status==='completed')return {floatShiftWorkingDays:null,floatShiftDaysBasis:'not_applicable_completed'};
    const fromHours=fromDayHours(a.calendarId),toHours=toDayHours(b.calendarId);
    if(fromHours===null||toHours===null||!(fromHours>0)||!(toHours>0)||typeof a.totalFloatHours!=='number'||typeof b.totalFloatHours!=='number')
      return {floatShiftWorkingDays:null,floatShiftDaysBasis:'calendar_working_day_not_established'};
    return {floatShiftWorkingDays:Number((b.totalFloatHours/toHours-a.totalFloatHours/fromHours).toFixed(6)),floatShiftDaysBasis:'each_revision_activity_calendar'};
  };
  const changedActivities =
    comparison.activityChanges
      .filter(
        (change) =>
          change.kind !== "unchanged",
      )
      .map((change) => ({
        activityId: change.activityId,
        fromActivityId: change.fromActivityId, toActivityId: change.toActivityId,
        identityMethod: change.identityMethod, identityConfidence: change.identityConfidence,
        changeKind: change.kind as
          | "added"
          | "removed"
          | "modified",
        finishShiftDays:
          change.finishShiftDays,
        floatShiftHours:
          change.floatShiftHours,
        ...floatShiftDays(change),
        progressShiftPercent:
          change.progressShiftPercent,
        fieldChanges: [
          ...change.fieldChanges,
        ],
      }));

  const movementCounts=new Map<number,number>();
  for(const row of changedActivities){
    if(row.finishShiftDays===null)continue;
    const days=Number(row.finishShiftDays.toFixed(6));
    movementCounts.set(days,(movementCounts.get(days)??0)+1);
  }
  const dominant=[...movementCounts].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
  const changeSummary={total:changedActivities.length,
    dominantFinishMovement:dominant?{days:dominant[0],count:dominant[1]}:null,
    largestFloatMovements:changedActivities.filter(row=>row.floatShiftHours!==null&&row.floatShiftHours!==0)
      .sort((a,b)=>Math.abs(b.floatShiftHours!)-Math.abs(a.floatShiftHours!)).slice(0,15)
      .map(row=>({activityId:row.activityId,floatShiftHours:row.floatShiftHours!,floatShiftWorkingDays:row.floatShiftWorkingDays,floatShiftDaysBasis:row.floatShiftDaysBasis}))};
  changedActivities.sort((a,b)=>Math.abs(b.finishShiftDays??0)-Math.abs(a.finishShiftDays??0));

  // Keep returned module evidence independently owned: a later page must not
  // be able to mutate the Revision Trend's retained classification by reference.
  const changeCategories=input.precomputedChangeCategories
    ?input.precomputedChangeCategories.map(item=>({...item}))
    :classifyScheduleChanges(comparison.activityChanges,from.model,to.model);
  const endpoint = (link: { predecessorActivityId: string; successorActivityId: string }) => JSON.stringify([link.predecessorActivityId, link.successorActivityId]);
  const added = new Map<string, typeof comparison.addedRelationships>();
  const removed = new Map<string, typeof comparison.removedRelationships>();
  for (const link of comparison.addedRelationships) { const k = endpoint(link); const rows = added.get(k) ?? []; rows.push(link); added.set(k, rows); }
  for (const link of comparison.removedRelationships) { const k = endpoint(link); const rows = removed.get(k) ?? []; rows.push(link); removed.set(k, rows); }
  // Pair only unique endpoint signatures. Parallel links are not guessed.
  const modifiedRelationships = [...added].flatMap(([key, after]) => {
    const before = removed.get(key); return after.length === 1 && before?.length === 1 ? [{ before: before[0]!, after: after[0]! }] : [];
  });
  const changedField=(field:string)=>comparison.activityChanges.filter(row=>row.fieldChanges.some(change=>change.field===field)).map(row=>row.activityId);
  const constraints=(value:typeof from.model.activities[number])=>JSON.stringify([...(value.sourceConstraints??[])].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  const constraintActivityIds=comparison.activityChanges.flatMap(row=>{const a=before.get(row.fromActivityId??''),b=after.get(row.toActivityId??'');return a&&b&&constraints(a)!==constraints(b)?[row.activityId]:[];});
  const completion=(model:typeof from.model)=>{
    const bases=input.precomputedAnalyses?.get(model)?.completionBases??analyzeSchedule(model).completionBases;
    return (bases.find(row=>row.basis==='forecast'&&row.dateIso)??bases.find(row=>row.basis==='programme'&&row.dateIso))?.dateIso??null;
  };
  const fromCompletionIso=completion(from.model),toCompletionIso=completion(to.model);
  const days=(a:string|null,b:string|null)=>a&&b?(Date.parse(b.slice(0,10))-Date.parse(a.slice(0,10)))/86400000:null;
  const engineeringChanges={originalDurationActivityIds:changedField('originalDurationHours'),remainingDurationActivityIds:changedField('remainingDurationHours'),constraintActivityIds,calendarActivityIds:changedField('calendarId'),lagChangeCount:modifiedRelationships.filter(row=>row.before.lagHours!==row.after.lagHours).length,relationshipTypeChangeCount:modifiedRelationships.filter(row=>row.before.type!==row.after.type).length,fromCompletionIso,toCompletionIso,completionMovementDays:days(fromCompletionIso,toCompletionIso),updateGapCalendarDays:days(from.model.dataDateIso,to.model.dataDateIso)};

  return {
    schemaVersion: "1.0",
    projectionKey: "schedule_change_report",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    state: "ready",
    fromRevisionId: comparison.fromRevisionId,
    toRevisionId: comparison.toRevisionId,
    matchedActivityCount:
      comparison.matchedActivityCount,
    populationMatchPercent:
      comparison.populationMatchPercent,
    addedActivityCount:
      comparison.addedActivityIds.length,
    removedActivityCount:
      comparison.removedActivityIds.length,
    modifiedActivityCount:
      comparison.modifiedActivityIds.length,
    unchangedActivityCount:
      comparison.unchangedActivityIds.length,
    addedRelationshipCount:
      comparison.addedRelationships.length,
    removedRelationshipCount:
      comparison.removedRelationships.length,
    addedRelationships:
      comparison.addedRelationships,
    removedRelationships:
      comparison.removedRelationships,
    changedActivities,
    changeSummary,
    engineeringChanges,
    finishMovementAnalysis,
    executionModifiedActivityCount: comparison.modifiedActivityIds.filter(id=>currentExecution.has(id)).length,
    excludedModifiedActivityCount: comparison.modifiedActivityIds.filter(id=>!currentExecution.has(id)).length,
    populationBasis: "source_records",
    fromActivityCount: comparison.fromActivityCount, toActivityCount: comparison.toActivityCount,
    changeCategories, modifiedRelationships,
    grossRelationshipChurn: comparison.addedRelationships.length + comparison.removedRelationships.length,
    netRelationshipCountChange: comparison.addedRelationships.length - comparison.removedRelationships.length,
    identityCoveragePercent: comparison.identityCoveragePercent,
    ambiguousFromActivityIds: comparison.ambiguousFromActivityIds,
    ambiguousToActivityIds: comparison.ambiguousToActivityIds,
    baselineMutationActivityCount: changeCategories.find(row => row.category === "baseline")!.activityCount,
    sourceTargetDateChangeCount: changeCategories.find(r=>r.category==='source_target')!.activityCount,
    sourceTargetEqualsCurrentCount: to.model.activities.filter(a=>a.baselineDateBasis==='xer_target_dates' && a.baselineStartIso!==null && a.baselineFinishIso!==null && a.baselineStartIso===a.currentStartIso && a.baselineFinishIso===a.currentFinishIso).length,
    targetDateInterpretation: 'Changes to XER target dates describe source planning fields. They do not establish a change to a separately controlled baseline file.',
    diagnostics: [
      ...(comparison.ambiguousFromActivityIds.length || comparison.ambiguousToActivityIds.length ? ["AMBIGUOUS_ACTIVITY_IDENTITY_REQUIRES_REVIEW"] : []),
      ...(changeCategories.some(row => row.category === "baseline" && row.activityCount > 0) ? ["BASELINE_FIELDS_CHANGED_REQUIRES_GOVERNANCE_REVIEW"] : []),
    ],
  };
}


export function buildScheduleChangeReportFromHistory(
  revisions: readonly ScheduleRevision[],
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): ScheduleChangeReportProjection {
  const ordered =
    orderScheduleRevisionsChronologically(
      revisions,
    );

  if (ordered.length < 2) {
    return {
      schemaVersion: "1.0",
      projectionKey:
        "schedule_change_report",
      generatedAt: input.generatedAt,
      producerVersion:
        input.producerVersion,
      state: "insufficient_history",
      fromRevisionId: null,
      toRevisionId:
        ordered[0]?.revisionId ?? null,
      matchedActivityCount: null,
      populationMatchPercent: null,
      addedActivityCount: null,
      removedActivityCount: null,
      modifiedActivityCount: null,
      unchangedActivityCount: null,
      addedRelationshipCount: null,
      removedRelationshipCount: null,
      addedRelationships: [],
      removedRelationships: [],
      changedActivities: [],
      diagnostics: [
        "SCHEDULE_CHANGE_REQUIRES_AT_LEAST_TWO_REVISIONS",
      ],
    };
  }

  return buildScheduleChangeReportProjection(
    ordered[ordered.length - 2]!,
    ordered[ordered.length - 1]!,
    input,
  );
}
