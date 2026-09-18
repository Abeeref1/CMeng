import {
  analyzeSchedule,
} from "../../schedule-analysis-core/src";
import {
  compareScheduleRevisions,
  type ScheduleRevision,
} from "../../schedule-revision-core/src";
import {
  buildIndependentForecastProjection,
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
  return analyzeSchedule(revision.model)
    .progress.durationWeightedPercentComplete.value;
}

function windowBoundary(
  revision: ScheduleRevision,
): string | null {
  return (
    revision.model.dataDateIso ??
    revision.effectiveAt
  );
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
  },
): WindowsAnalysisProjection {
  const ordered = [...revisions].sort(
    (a, b) =>
      a.sequence - b.sequence ||
      a.revisionId.localeCompare(b.revisionId),
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
      buildIndependentForecastProjection(
        from.model,
        {
          generatedAt: input.generatedAt,
          producerVersion:
            input.producerVersion +
            ":from:" +
            from.revisionId,
          ...(input.cpmConfig
            ? { cpmConfig: input.cpmConfig }
            : {}),
        },
      );

    const toForecast =
      buildIndependentForecastProjection(
        to.model,
        {
          generatedAt: input.generatedAt,
          producerVersion:
            input.producerVersion +
            ":to:" +
            to.revisionId,
          ...(input.cpmConfig
            ? { cpmConfig: input.cpmConfig }
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
        movementDays(
          fromForecast.sourceForecastCompletionIso,
          toForecast.sourceForecastCompletionIso,
        ),

      fromIndependentForecastCompletionIso:
        fromForecast.independentForecastCompletionIso,
      toIndependentForecastCompletionIso:
        toForecast.independentForecastCompletionIso,
      independentForecastMovementDays:
        movementDays(
          fromForecast.independentForecastCompletionIso,
          toForecast.independentForecastCompletionIso,
        ),

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
    windows,
    diagnostics,
  };
}
