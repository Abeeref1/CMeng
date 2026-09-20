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

function activityFinish(
  revision: ScheduleRevision,
  activityId: string | null,
): string | null {
  if (!activityId) return null;
  const activity =
    revision.model.activities.find(
      (item) =>
        item.activityId ===
        activityId,
    );
  if (!activity) return null;
  return (
    (
      activity.status ===
        "completed"
        ? activity.actualFinishIso
        : null
    ) ??
    activity.forecastFinishIso ??
    activity.currentFinishIso ??
    activity.actualFinishIso
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

function strongestMovement(
  input: {
    independent: number | null;
    sourceForecast: number | null;
    sourceBoundary: number | null;
  },
): {
  days: number | null;
  basis:
    ScheduleWindowResult["strongestProgrammeMovementBasis"];
} {
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
    trackedCompletionActivityId?:
      string | null;
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
    const overlappingEvents =
      delayModel.events.filter((event) =>
        eventOverlapsWindow(
          event,
          startIso,
          endIso,
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
        independent:
          independentMovement,
        sourceForecast:
          sourceForecastMovement,
        sourceBoundary:
          scheduleBoundaryMovement,
      });
    const fromTrackedCompletionIso =
      activityFinish(
        from,
        input.trackedCompletionActivityId ??
          null,
      );
    const toTrackedCompletionIso =
      activityFinish(
        to,
        input.trackedCompletionActivityId ??
          null,
      );
    const trackedCompletionMovementDays =
      movementDays(
        fromTrackedCompletionIso,
        toTrackedCompletionIso,
      );

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
        from.revisionId +
        "->" +
        to.revisionId,
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

      trackedCompletionActivityId:
        input.trackedCompletionActivityId ??
        null,
      fromTrackedCompletionIso,
      toTrackedCompletionIso,
      trackedCompletionMovementDays,

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
                window.strongestProgrammeMovementDays ??
                  0,
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
                window.strongestProgrammeMovementDays ??
                  0,
              ),
            0,
          )
          .toFixed(6),
      ),
    programmeMovementAvailableWindowCount:
      windows.filter(
        (window) =>
          window
            .strongestProgrammeMovementDays !==
          null,
      ).length,
    trackedCompletionActivityId:
      input.trackedCompletionActivityId ??
      null,
    positiveTrackedCompletionMovementDays:
      Number(
        windows.reduce(
          (sum, window) =>
            sum +
            Math.max(
              0,
              window
                .trackedCompletionMovementDays ??
                0,
            ),
          0,
        ).toFixed(6),
      ),
    negativeTrackedCompletionMovementDays:
      Number(
        windows.reduce(
          (sum, window) =>
            sum +
            Math.min(
              0,
              window
                .trackedCompletionMovementDays ??
                0,
            ),
          0,
        ).toFixed(6),
      ),
    netTrackedCompletionMovementDays:
      input.trackedCompletionActivityId
        ? Number(
            windows.reduce(
              (sum, window) =>
                sum +
                (
                  window
                    .trackedCompletionMovementDays ??
                  0
                ),
              0,
            ).toFixed(6),
          )
        : null,
    windows,
    diagnostics,
  };
}
