import {
  compareScheduleRevisions,
  orderScheduleRevisionsChronologically,
  type ScheduleRevision,
} from "../../schedule-revision-core/src";
import {
  buildIndependentForecastProjection,
  type IndependentForecastProjection,
} from "../../independent-forecast/src";
import type {
  DelayClaimsModel,
  CanonicalDelayEvent,
} from "../../delay-analysis-core/src";
import type {
  CpmConfig,
} from "../../schedule-cpm/src";
import type {
  ScheduleWindowResult,
  WindowsAnalysisProjection,
  WindowEventRef,
} from "./types";

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function movementDays(
  from: string | null,
  to: string | null,
): number | null {
  const a = ms(from);
  const b = ms(to);
  if (a === null || b === null) return null;
  return Number(((b - a) / 86_400_000).toFixed(6));
}

function progress(
  revision: ScheduleRevision,
): number | null {
  let weighted = 0;
  let duration = 0;

  for (
    const activity of
      revision.model.activities
  ) {
    if (
      activity.activityType ===
        "wbs_summary" ||
      activity.activityType ===
        "level_of_effort" ||
      activity.activityType ===
        "milestone" ||
      activity.activityType ===
        "start_milestone" ||
      activity.activityType ===
        "finish_milestone" ||
      activity.originalDurationHours ===
        null ||
      activity.originalDurationHours <=
        0 ||
      activity.percentComplete ===
        null ||
      activity.percentComplete <
        0 ||
      activity.percentComplete >
        100
    ) {
      continue;
    }

    duration +=
      activity.originalDurationHours;
    weighted +=
      activity.originalDurationHours *
      activity.percentComplete;
  }

  return duration > 0
    ? Number(
        (
          weighted /
          duration
        ).toFixed(6),
      )
    : null;
}

function windowBoundary(
  revision: ScheduleRevision,
): string | null {
  return (
    revision.model.dataDateIso ??
    revision.effectiveAt
  );
}

function sourceScheduleBoundary(
  revision: ScheduleRevision,
): string | null {
  let latest: number | null = null;

  for (const activity of revision.model.activities) {
    const candidate =
      activity.status === "completed"
        ? (
            activity.actualFinishIso ??
            activity.forecastFinishIso ??
            activity.currentFinishIso
          )
        : (
            activity.forecastFinishIso ??
            activity.currentFinishIso
          );
    const value = ms(candidate);
    if (value === null) continue;
    latest =
      latest === null
        ? value
        : Math.max(latest, value);
  }

  return latest === null
    ? null
    : new Date(latest).toISOString();
}

function coverage(
  known: number,
  total: number,
): number | null {
  if (total <= 0) return null;
  return Number(
    ((known / total) * 100).toFixed(4),
  );
}

function activityFinishMovementStats(
  comparison: ReturnType<typeof compareScheduleRevisions>,
): {
  matchedActivityCount: number;
  comparableCount: number;
  coveragePercent: number | null;
  strongestPositiveDays: number | null;
  strongestPositiveActivityId: string | null;
  strongestNegativeDays: number | null;
  strongestNegativeActivityId: string | null;
  averagePositiveDays: number | null;
  averageNegativeDays: number | null;
} {
  const comparable = comparison.activityChanges
    .filter(
      (change) =>
        change.fromActivityId !== null &&
        change.toActivityId !== null &&
        change.finishShiftDays !== null,
    )
    .map((change) => ({
      activityId: change.activityId,
      days: change.finishShiftDays!,
    }));

  const positive = comparable
    .filter((item) => item.days > 0)
    .sort(
      (a, b) =>
        b.days - a.days ||
        a.activityId.localeCompare(
          b.activityId,
          undefined,
          { numeric: true },
        ),
    );
  const negative = comparable
    .filter((item) => item.days < 0)
    .sort(
      (a, b) =>
        a.days - b.days ||
        a.activityId.localeCompare(
          b.activityId,
          undefined,
          { numeric: true },
        ),
    );

  const average = (
    values: readonly { days: number }[],
  ): number | null =>
    values.length === 0
      ? null
      : Number(
          (
            values.reduce(
              (sum, item) => sum + item.days,
              0,
            ) / values.length
          ).toFixed(6),
        );

  return {
    matchedActivityCount:
      comparison.matchedActivityCount,
    comparableCount: comparable.length,
    coveragePercent: coverage(
      comparable.length,
      comparison.matchedActivityCount,
    ),
    strongestPositiveDays:
      positive[0]?.days ?? null,
    strongestPositiveActivityId:
      positive[0]?.activityId ?? null,
    strongestNegativeDays:
      negative[0]?.days ?? null,
    strongestNegativeActivityId:
      negative[0]?.activityId ?? null,
    averagePositiveDays:
      average(positive),
    averageNegativeDays:
      average(negative),
  };
}

function strongestMovement(
  input: {
    activityPositive: number | null;
    activityNegative: number | null;
    independent: number | null;
    sourceForecast: number | null;
    sourceBoundary: number | null;
  },
): {
  days: number | null;
  basis:
    ScheduleWindowResult["strongestProgrammeMovementBasis"];
} {
  if (input.activityPositive !== null) {
    return {
      days: input.activityPositive,
      basis:
        "matched_activity_finish_shift",
    };
  }
  if (
    input.activityNegative !== null &&
    input.independent === null &&
    input.sourceForecast === null &&
    input.sourceBoundary === null
  ) {
    return {
      days: input.activityNegative,
      basis:
        "matched_activity_finish_shift",
    };
  }
  if (input.independent !== null) {
    return {
      days: input.independent,
      basis:
        "independent_cpm",
    };
  }
  if (input.sourceForecast !== null) {
    return {
      days:
        input.sourceForecast,
      basis:
        "source_forecast",
    };
  }
  if (input.sourceBoundary !== null) {
    return {
      days:
        input.sourceBoundary,
      basis:
        "source_schedule_boundary",
    };
  }
  return {
    days: null,
    basis: "unavailable",
  };
}

function eventOverlapsWindow(
  event: CanonicalDelayEvent,
  startIso: string | null,
  endIso: string | null,
): boolean {
  const start = ms(startIso);
  const end = ms(endIso);
  const eventStart = ms(event.startIso);
  const eventEnd =
    ms(event.endIso) ?? eventStart;

  if (
    start === null ||
    end === null ||
    eventStart === null ||
    eventEnd === null
  ) {
    return false;
  }

  return (
    eventStart <= end &&
    eventEnd >= start
  );
}

function normalizeWindowReference(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function eventReferencesWindow(
  event: CanonicalDelayEvent,
  input: {
    windowId: string;
    sequence: number;
    fromRevisionId: string;
    toRevisionId: string;
  },
): boolean {
  const references =
    event.relatedWindowReferences ??
    [];
  if (references.length === 0) {
    return false;
  }
  const accepted = new Set([
    normalizeWindowReference(
      input.windowId,
    ),
    normalizeWindowReference(
      "window " +
        input.sequence,
    ),
    normalizeWindowReference(
      "w" +
        input.sequence,
    ),
    String(input.sequence),
    normalizeWindowReference(
      input.fromRevisionId +
        " to " +
        input.toRevisionId,
    ),
    normalizeWindowReference(
      input.fromRevisionId +
        "->" +
        input.toRevisionId,
    ),
  ]);
  return references.some(
    (reference) =>
      accepted.has(
        normalizeWindowReference(
          reference,
        ),
      ),
  );
}

function eventRef(
  event: CanonicalDelayEvent,
): WindowEventRef {
  return {
    eventId: event.eventId,
    title: event.title,
    responsibility:
      event.responsibility,
    responsibilityState:
      event.responsibilityState,
    describedImpactDays:
      event.describedImpactDays,
    describedImpactState:
      event.describedImpactState,
  };
}

function setDifference(
  after: readonly string[],
  before: readonly string[],
): string[] {
  const prior = new Set(before);
  return after
    .filter((value) => !prior.has(value))
    .sort();
}

export function buildWindowsAnalysisProjection(
  revisions: readonly ScheduleRevision[],
  delayModel: DelayClaimsModel,
  input: {
    generatedAt: string;
    producerVersion: string;
    cpmConfig?: Partial<CpmConfig>;
    forecastResolver?: (
      revision: ScheduleRevision,
    ) => IndependentForecastProjection;
  },
): WindowsAnalysisProjection {
  const ordered =
    orderScheduleRevisionsChronologically(
      revisions,
    );

  const windows: ScheduleWindowResult[] = [];
  const diagnostics: string[] = [
    ...delayModel.diagnostics,
  ];

  for (
    let index = 1;
    index < ordered.length;
    index += 1
  ) {
    const from = ordered[index - 1]!;
    const to = ordered[index]!;
    const comparison =
      compareScheduleRevisions(from, to);
    const activityMovement =
      activityFinishMovementStats(
        comparison,
      );

    const fromForecast =
      input.forecastResolver
        ? input.forecastResolver(
            from,
          )
        : buildIndependentForecastProjection(
            from.model,
            {
              generatedAt:
                input.generatedAt,
              producerVersion:
                input.producerVersion +
                ":from:" +
                from.revisionId,
              ...(input.cpmConfig
                ? {
                    cpmConfig:
                      input.cpmConfig,
                  }
                : {}),
            },
          );

    const toForecast =
      input.forecastResolver
        ? input.forecastResolver(
            to,
          )
        : buildIndependentForecastProjection(
            to.model,
            {
              generatedAt:
                input.generatedAt,
              producerVersion:
                input.producerVersion +
                ":to:" +
                to.revisionId,
              ...(input.cpmConfig
                ? {
                    cpmConfig:
                      input.cpmConfig,
                  }
                : {}),
            },
          );

    const startIso = windowBoundary(from);
    const endIso = windowBoundary(to);
    const canonicalWindowId =
      from.revisionId +
      "->" +
      to.revisionId;
    const overlappingEvents =
      delayModel.events.filter((event) =>
        eventOverlapsWindow(
          event,
          startIso,
          endIso,
        ) ||
        eventReferencesWindow(
          event,
          {
            windowId:
              canonicalWindowId,
            sequence: index,
            fromRevisionId:
              from.revisionId,
            toRevisionId:
              to.revisionId,
          },
        ),
      );

    const fromProgress = progress(from);
    const toProgress = progress(to);

    const fromScheduleBoundaryIso =
      sourceScheduleBoundary(from);
    const toScheduleBoundaryIso =
      sourceScheduleBoundary(to);

    const sourceForecastMovement =
      movementDays(
        fromForecast.sourceForecastCompletionIso,
        toForecast.sourceForecastCompletionIso,
      );
    const independentMovement =
      movementDays(
        fromForecast.independentForecastCompletionIso,
        toForecast.independentForecastCompletionIso,
      );
    const scheduleBoundaryMovement =
      movementDays(
        fromScheduleBoundaryIso,
        toScheduleBoundaryIso,
      );
    const strongest =
      strongestMovement({
        activityPositive:
          activityMovement.strongestPositiveDays,
        activityNegative:
          activityMovement.strongestNegativeDays,
        independent:
          independentMovement,
        sourceForecast:
          sourceForecastMovement,
        sourceBoundary:
          scheduleBoundaryMovement,
      });

    const assumptions = [
      ...fromForecast.assumptions,
      ...toForecast.assumptions,
    ];

    const windowDiagnostics: string[] = [];

    if (
      startIso === null ||
      endIso === null
    ) {
      windowDiagnostics.push(
        "WINDOW_BOUNDARY_DATE_MISSING",
      );
    }

    if (!fromForecast.complete) {
      windowDiagnostics.push(
        "WINDOW_FROM_INDEPENDENT_FORECAST_INCOMPLETE",
      );
    }
    if (!toForecast.complete) {
      windowDiagnostics.push(
        "WINDOW_TO_INDEPENDENT_FORECAST_INCOMPLETE",
      );
    }
    if (
      activityMovement.comparableCount === 0
    ) {
      windowDiagnostics.push(
        "WINDOW_ACTIVITY_FINISH_MOVEMENT_NOT_DERIVABLE",
      );
    } else if (
      activityMovement.coveragePercent !== 100
    ) {
      windowDiagnostics.push(
        "WINDOW_ACTIVITY_FINISH_MOVEMENT_PARTIAL_COVERAGE:" +
          activityMovement.comparableCount +
          "/" +
          activityMovement.matchedActivityCount,
      );
    }

    if (
      strongest.basis ===
      "source_forecast"
    ) {
      windowDiagnostics.push(
        "PROGRAMME_MOVEMENT_FALLBACK_TO_SOURCE_FORECAST",
      );
    } else if (
      strongest.basis ===
      "source_schedule_boundary"
    ) {
      windowDiagnostics.push(
        "PROGRAMME_MOVEMENT_FALLBACK_TO_SOURCE_SCHEDULE_BOUNDARY",
      );
    } else if (
      strongest.basis ===
      "unavailable"
    ) {
      windowDiagnostics.push(
        "PROGRAMME_MOVEMENT_NOT_DERIVABLE",
      );
    }

    const enteredCritical =
      setDifference(
        toForecast.criticalActivityIds,
        fromForecast.criticalActivityIds,
      );
    const exitedCritical =
      setDifference(
        fromForecast.criticalActivityIds,
        toForecast.criticalActivityIds,
      );

    const employerEventIds =
      overlappingEvents
        .filter(
          (event) =>
            event.responsibility ===
            "employer",
        )
        .map((event) => event.eventId)
        .sort();
    const contractorEventIds =
      overlappingEvents
        .filter(
          (event) =>
            event.responsibility ===
            "contractor",
        )
        .map((event) => event.eventId)
        .sort();
    const neutralEventIds =
      overlappingEvents
        .filter(
          (event) =>
            event.responsibility ===
              "neutral" ||
            event.responsibility ===
              "concurrent",
        )
        .map((event) => event.eventId)
        .sort();

    const state:
      ScheduleWindowResult["state"] =
      windowDiagnostics.length === 0
        ? "complete"
        : startIso !== null &&
            endIso !== null
          ? "partial"
          : "unresolved";

    windows.push({
      windowId:
        canonicalWindowId,
      sequence: index,
      fromRevisionId: from.revisionId,
      toRevisionId: to.revisionId,
      windowStartIso: startIso,
      windowEndIso: endIso,
      state,

      fromSourceForecastCompletionIso:
        fromForecast.sourceForecastCompletionIso,
      toSourceForecastCompletionIso:
        toForecast.sourceForecastCompletionIso,
      sourceForecastMovementDays:
        sourceForecastMovement,

      fromIndependentForecastCompletionIso:
        fromForecast.independentForecastCompletionIso,
      toIndependentForecastCompletionIso:
        toForecast.independentForecastCompletionIso,
      independentForecastMovementDays:
        independentMovement,

      fromScheduleBoundaryIso,
      toScheduleBoundaryIso,
      scheduleBoundaryMovementDays:
        scheduleBoundaryMovement,
      strongestProgrammeMovementDays:
        strongest.days,
      strongestProgrammeMovementBasis:
        strongest.basis,
      matchedActivityCount:
        activityMovement.matchedActivityCount,
      comparableActivityFinishShiftCount:
        activityMovement.comparableCount,
      activityFinishShiftCoveragePercent:
        activityMovement.coveragePercent,
      strongestPositiveActivityMovementDays:
        activityMovement.strongestPositiveDays,
      strongestPositiveActivityId:
        activityMovement.strongestPositiveActivityId,
      strongestNegativeActivityMovementDays:
        activityMovement.strongestNegativeDays,
      strongestNegativeActivityId:
        activityMovement.strongestNegativeActivityId,
      averagePositiveActivityMovementDays:
        activityMovement.averagePositiveDays,
      averageNegativeActivityMovementDays:
        activityMovement.averageNegativeDays,

      fromProgressPercent: fromProgress,
      toProgressPercent: toProgress,
      progressMovementPercent:
        fromProgress !== null &&
        toProgress !== null
          ? Number(
              (
                toProgress -
                fromProgress
              ).toFixed(6),
            )
          : null,

      addedActivityCount:
        comparison.addedActivityIds.length,
      removedActivityCount:
        comparison.removedActivityIds.length,
      modifiedActivityCount:
        comparison.modifiedActivityIds.length,
      addedRelationshipCount:
        comparison.addedRelationships.length,
      removedRelationshipCount:
        comparison.removedRelationships.length,

      enteredCriticalActivityIds:
        enteredCritical,
      exitedCriticalActivityIds:
        exitedCritical,

      delayEvents:
        overlappingEvents.map(eventRef),
      employerEventIds,
      contractorEventIds,
      neutralEventIds,
      concurrentEventCandidate:
        employerEventIds.length > 0 &&
        contractorEventIds.length > 0,

      attributionState: "not_attributed",
      assumptions: [
        ...new Set(assumptions),
      ],
      diagnostics: windowDiagnostics,
    });
  }

  const firstWindow = windows[0] ?? null;
  const lastWindow = windows.at(-1) ?? null;
  const sourceProjectMovement =
    movementDays(
      firstWindow?.fromSourceForecastCompletionIso ?? null,
      lastWindow?.toSourceForecastCompletionIso ?? null,
    );
  const boundaryProjectMovement =
    movementDays(
      firstWindow?.fromScheduleBoundaryIso ?? null,
      lastWindow?.toScheduleBoundaryIso ?? null,
    );
  const projectCompletionMovementDays =
    sourceProjectMovement ?? boundaryProjectMovement;
  const projectCompletionMovementBasis:
    WindowsAnalysisProjection["projectCompletionMovementBasis"] =
    sourceProjectMovement !== null
      ? "source_forecast"
      : boundaryProjectMovement !== null
        ? "source_schedule_boundary"
        : "unavailable";
  const firstProjectCompletionIso =
    sourceProjectMovement !== null
      ? firstWindow?.fromSourceForecastCompletionIso ?? null
      : boundaryProjectMovement !== null
        ? firstWindow?.fromScheduleBoundaryIso ?? null
        : null;
  const latestProjectCompletionIso =
    sourceProjectMovement !== null
      ? lastWindow?.toSourceForecastCompletionIso ?? null
      : boundaryProjectMovement !== null
        ? lastWindow?.toScheduleBoundaryIso ?? null
        : null;

  return {
    schemaVersion: "1.0",
    projectionKey: "windows_analysis",
    generatedAt: input.generatedAt,
    producerVersion: input.producerVersion,
    projectId:
      ordered[0]?.model.projectId ??
      null,
    revisionCount: ordered.length,
    windowCount: windows.length,
    completeWindowCount:
      windows.filter(
        (window) =>
          window.state === "complete",
      ).length,
    partialWindowCount:
      windows.filter(
        (window) =>
          window.state === "partial",
      ).length,
    unresolvedWindowCount:
      windows.filter(
        (window) =>
          window.state === "unresolved",
      ).length,
    positiveIndependentMovementDays:
      Number(
        windows
          .reduce(
            (sum, window) =>
              sum +
              Math.max(
                0,
                window.independentForecastMovementDays ??
                  0,
              ),
            0,
          )
          .toFixed(6),
      ),
    negativeIndependentMovementDays:
      Number(
        windows
          .reduce(
            (sum, window) =>
              sum +
              Math.min(
                0,
                window.independentForecastMovementDays ??
                  0,
              ),
            0,
          )
          .toFixed(6),
      ),
    positiveProgrammeMovementDays:
      Number(
        windows
          .reduce(
            (sum, window) =>
              sum +
              Math.max(
                0,
                window.strongestPositiveActivityMovementDays ??
                  (
                    window.strongestProgrammeMovementBasis ===
                      "matched_activity_finish_shift"
                      ? window.strongestProgrammeMovementDays ?? 0
                      : 0
                  ),
              ),
            0,
          )
          .toFixed(6),
      ),
    negativeProgrammeMovementDays:
      Number(
        windows
          .reduce(
            (sum, window) =>
              sum +
              Math.min(
                0,
                window.strongestNegativeActivityMovementDays ??
                  0,
              ),
            0,
          )
          .toFixed(6),
      ),
    projectCompletionMovementDays,
    projectCompletionMovementBasis,
    firstProjectCompletionIso,
    latestProjectCompletionIso,
    programmeMovementAvailableWindowCount:
      windows.filter(
        (window) =>
          window
            .strongestProgrammeMovementDays !==
          null,
      ).length,
    windows,
    diagnostics,
  };
}
