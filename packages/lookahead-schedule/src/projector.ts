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

function readinessForActivity(
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
  const rows: LookAheadActivityRow[] = [];

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

    const isOverdue = finishMs < dataDateMs;
    const plannedStartMs = ms(activity.currentStartIso ?? activity.forecastStartIso);
    const missedStart = activity.status === "not_started" && !activity.actualStartIso && plannedStartMs !== null && plannedStartMs < dataDateMs;
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

    rows.push({
      activityId: activity.activityId,
      name: activity.name,
      wbsId: activity.wbsId,
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
    });
  }

  rows.sort((a, b) => {
    const aDate = a.finishIso ?? "9999";
    const bDate = b.finishIso ?? "9999";
    return (
      aDate.localeCompare(bDate) ||
      a.activityId.localeCompare(
        b.activityId,
        undefined,
        { numeric: true },
      )
    );
  });

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
    overdueCount: rows.filter(
      (row) => row.classification === "overdue",
    ).length,
    missedStartCount: rows.filter(row => row.missedPlannedStart).length,
    evidenceGapActivityCount: rows.filter(row => row.readiness.unknownCount > 0).length,
    blockedWithEvidenceGapCount: rows.filter(row => row.readiness.state === "blocked" && row.readiness.unknownCount > 0).length,
    blockerOccurrenceCount: rows.reduce((sum, row) => sum + row.readiness.blockedCount, 0),
    readinessCoverage: READINESS_KEYS.map(key => ({ key, denominator: rows.length,
      linkedActivityCount: rows.filter(row=>(row.readiness.dimensions.find(d=>d.key===key)?.sourceRefs.length??0)>0).length,
      linkedSourceRecordCount: new Set(rows.flatMap(row=>row.readiness.dimensions.find(d=>d.key===key)?.sourceRefs??[])).size,
      unresolvedLinkedActivityCount: rows.filter(row=>row.readiness.dimensions.some(d=>d.key===key&&d.state==='unknown'&&d.sourceRefs.length>0)).length,
      knownCount: rows.filter(row => row.readiness.dimensions.find(d => d.key === key)?.state !== "unknown").length,
      coveragePercent: coverage(rows.filter(row => row.readiness.dimensions.find(d => d.key === key)?.state !== "unknown").length, rows.length),
    })),
    readyCount: rows.filter(
      (row) => row.readiness.state === "ready",
    ).length,
    conditionalCount: rows.filter(
      (row) => row.readiness.state === "conditional",
    ).length,
    blockedCount: rows.filter(
      (row) => row.readiness.state === "blocked",
    ).length,
    rows,
    missingCurrentDateActivityIds:
      missingCurrentDateActivityIds.sort(),
  };
}
