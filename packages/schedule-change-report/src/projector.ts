import { isExecutionActivity,parseScheduleTime } from "../../schedule-analysis-core/src";
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

export function buildScheduleChangeReportProjection(
  from: ScheduleRevision,
  to: ScheduleRevision,
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): ScheduleChangeReportProjection {
  const comparison = compareScheduleRevisions(from, to);
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
    maximumDays,maximumCount:maximumRows.length,maximumPercent:finishRows.length?maximumRows.length/finishRows.length*100:null,
    sourcePairVerifiedCount:maximumRows.filter(r=>Math.abs((parseScheduleTime(r.toFinishIso)-parseScheduleTime(r.fromFinishIso))/86_400_000-r.movementDays)<0.000001).length,maximumRows,causation:'not_established' as const};

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
        progressShiftPercent:
          change.progressShiftPercent,
        fieldChanges: [
          ...change.fieldChanges,
        ],
      }));

  const categoryFields: Record<string, string[]> = {
    structural: ["activityType", "wbsId", "calendarId", "originalDurationHours"],
    forecast: ["currentStartIso", "currentFinishIso", "forecastStartIso", "forecastFinishIso", "totalFloatHours", "freeFloatHours"],
    progress: ["status", "actualStartIso", "actualFinishIso", "remainingDurationHours", "percentComplete"],
    metadata: ["name"], baseline: ["baselineStartIso", "baselineFinishIso"],
  };
  const changeCategories = Object.entries(categoryFields).map(([category, fields]) => ({ category,
    activityCount: changedActivities.filter(row => row.fieldChanges.some(change => fields.includes(change.field))).length }));
  const endpoint = (link: { predecessorActivityId: string; successorActivityId: string }) => JSON.stringify([link.predecessorActivityId, link.successorActivityId]);
  const added = new Map<string, typeof comparison.addedRelationships>();
  const removed = new Map<string, typeof comparison.removedRelationships>();
  for (const link of comparison.addedRelationships) { const k = endpoint(link); const rows = added.get(k) ?? []; rows.push(link); added.set(k, rows); }
  for (const link of comparison.removedRelationships) { const k = endpoint(link); const rows = removed.get(k) ?? []; rows.push(link); removed.set(k, rows); }
  // Pair only unique endpoint signatures. Parallel links are not guessed.
  const modifiedRelationships = [...added].flatMap(([key, after]) => {
    const before = removed.get(key); return after.length === 1 && before?.length === 1 ? [{ before: before[0]!, after: after[0]! }] : [];
  });

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
      matchedActivityCount: 0,
      populationMatchPercent: null,
      addedActivityCount: 0,
      removedActivityCount: 0,
      modifiedActivityCount: 0,
      unchangedActivityCount: 0,
      addedRelationshipCount: 0,
      removedRelationshipCount: 0,
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
