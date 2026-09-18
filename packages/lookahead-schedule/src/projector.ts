import {
  buildScheduleActivityLogicIndex,
  type CanonicalScheduleActivity,
  type CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  ExternalLookAheadReadinessDimension,
  LookAheadActivityReadinessEvidence,
  LookAheadActivityRow,
  LookAheadProjection,
  LookAheadReadinessAssessment,
  LookAheadReadinessDimension,
  LookAheadReadinessEvidence,
} from "./types";

const EXTERNAL_DIMENSIONS:
  readonly ExternalLookAheadReadinessDimension[] = [
    "procurement",
    "design_rfi_submittal",
    "permit",
    "resource",
    "quality",
    "commercial_obligation",
    "risk",
    "access",
  ];

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(msValue: number): string {
  return new Date(msValue).toISOString().slice(0, 10);
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

function unknownEvidence(
  dimension: LookAheadReadinessDimension,
): LookAheadReadinessEvidence {
  return {
    state: "unknown",
    sourceRefs: [],
    note:
      "No governed readiness evidence provided for " +
      dimension,
  };
}

function predecessorReadiness(
  model: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
): LookAheadReadinessEvidence {
  if (
    activity.status === "in_progress" ||
    activity.actualStartIso
  ) {
    return {
      state: "not_applicable",
      sourceRefs: [],
      note:
        "Activity has already started; predecessor start-readiness is no longer applicable.",
    };
  }

  const incoming = model.relationships.filter(
    (relationship) =>
      !relationship.external &&
      relationship.successorActivityId ===
        activity.activityId,
  );

  if (incoming.length === 0) {
    return {
      state: "ready",
      sourceRefs: [],
      note:
        "No internal predecessor relationships constrain activity start readiness.",
    };
  }

  const byId = new Map(
    model.activities.map((candidate) => [
      candidate.activityId,
      candidate,
    ]),
  );

  let hasConditional = false;
  let hasUnknown = false;
  let hasBlocked = false;
  const sourceRefs: string[] = [];

  for (const relationship of incoming) {
    sourceRefs.push(
      "schedule-relationship:" +
        relationship.relationshipId,
    );

    const predecessor = byId.get(
      relationship.predecessorActivityId,
    );

    if (!predecessor) {
      hasUnknown = true;
      continue;
    }

    const started =
      predecessor.actualStartIso !== null ||
      predecessor.status === "in_progress" ||
      predecessor.status === "completed";

    const finished =
      predecessor.actualFinishIso !== null ||
      predecessor.status === "completed";

    switch (relationship.type) {
      case "FS":
        if (!finished) hasBlocked = true;
        break;
      case "SS":
        if (!started) hasBlocked = true;
        break;
      case "FF":
        if (!finished) hasConditional = true;
        break;
      case "SF":
        if (!started) hasConditional = true;
        break;
      case "unknown":
        hasUnknown = true;
        break;
    }
  }

  if (hasBlocked) {
    return {
      state: "blocked",
      sourceRefs,
      note:
        "One or more predecessor relationship conditions are not yet satisfied.",
    };
  }

  if (hasUnknown) {
    return {
      state: "unknown",
      sourceRefs,
      note:
        "Predecessor readiness cannot be fully established from the current relationship evidence.",
    };
  }

  if (hasConditional) {
    return {
      state: "conditional",
      sourceRefs,
      note:
        "Finish-based predecessor conditions remain outstanding.",
    };
  }

  return {
    state: "ready",
    sourceRefs,
    note:
      "All deterministic predecessor start conditions are satisfied.",
  };
}

function readinessAssessment(
  model: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
  evidence:
    | LookAheadActivityReadinessEvidence
    | undefined,
): LookAheadReadinessAssessment {
  const dimensions =
    {} as Record<
      LookAheadReadinessDimension,
      LookAheadReadinessEvidence
    >;

  dimensions.predecessor =
    predecessorReadiness(
      model,
      activity,
    );

  for (const dimension of EXTERNAL_DIMENSIONS) {
    dimensions[dimension] =
      evidence?.[dimension] ??
      unknownEvidence(dimension);
  }

  const entries =
    Object.entries(dimensions) as Array<
      [
        LookAheadReadinessDimension,
        LookAheadReadinessEvidence,
      ]
    >;

  const blockingDimensions = entries
    .filter(([, value]) =>
      value.state === "blocked",
    )
    .map(([dimension]) => dimension);

  const unknownDimensions = entries
    .filter(([, value]) =>
      value.state === "unknown",
    )
    .map(([dimension]) => dimension);

  const allReady = entries.every(
    ([, value]) =>
      value.state === "ready" ||
      value.state === "not_applicable",
  );

  return {
    overall:
      blockingDimensions.length > 0
        ? "blocked"
        : allReady
          ? "ready"
          : "conditional",
    dimensions,
    blockingDimensions,
    unknownDimensions,
  };
}

export function buildLookAheadProjection(
  model: CanonicalScheduleModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    windowDays?: number;
    readinessEvidence?: Record<
      string,
      LookAheadActivityReadinessEvidence
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

  const incomplete = model.activities.filter(
    (activity) =>
      activity.status !== "completed" &&
      activity.activityType !== "wbs_summary",
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

    const isOverdue =
      finishMs < dataDateMs;
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
      predecessorIds:
        activityLogic?.predecessorIds ?? [],
      successorIds:
        activityLogic?.successorIds ?? [],
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
      readiness: readinessAssessment(
        model,
        activity,
        input.readinessEvidence?.[
          activity.activityId
        ],
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
    readyCount: rows.filter(
      (row) => row.readiness.overall === "ready",
    ).length,
    blockedCount: rows.filter(
      (row) => row.readiness.overall === "blocked",
    ).length,
    conditionalCount: rows.filter(
      (row) =>
        row.readiness.overall ===
        "conditional",
    ).length,
    rows,
    missingCurrentDateActivityIds:
      missingCurrentDateActivityIds.sort(),
  };
}
