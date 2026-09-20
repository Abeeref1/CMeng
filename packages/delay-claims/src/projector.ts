import {
  assessAllEventNotices,
  type DelayClaimsModel,
} from "../../delay-analysis-core/src";
import type {
  WindowsAnalysisProjection,
} from "../../windows-analysis/src";
import type {
  DelayCandidateClass,
  DelayClaimEventAssessmentRow,
  DelayClaimsProjection,
} from "./types";

function classify(
  responsibility: string,
  responsibilityState: string,
  concurrent: boolean,
): DelayCandidateClass {
  if (concurrent) {
    return "concurrency_review";
  }

  if (
    responsibilityState === "missing" ||
    responsibility === "unknown"
  ) {
    return "insufficient_evidence";
  }

  if (responsibility === "contractor") {
    return "contractor_risk";
  }

  if (
    responsibility === "employer" ||
    responsibility === "neutral"
  ) {
    return "employer_or_neutral_time_candidate";
  }

  return "insufficient_evidence";
}

export function buildDelayClaimsProjection(
  windows: WindowsAnalysisProjection,
  model: DelayClaimsModel,
  input: {
    generatedAt: string;
    producerVersion: string;
  },
): DelayClaimsProjection {
  const noticeByEvent = new Map(
    assessAllEventNotices(model).map(
      (assessment) => [
        assessment.eventId,
        assessment,
      ],
    ),
  );

  const claimsByEvent =
    new Map<string, string[]>();

  for (const claim of model.claims) {
    for (const eventId of claim.eventIds) {
      const list =
        claimsByEvent.get(eventId) ?? [];
      list.push(claim.claimId);
      claimsByEvent.set(
        eventId,
        list,
      );
    }
  }

  const rows: DelayClaimEventAssessmentRow[] =
    model.events.map((event) => {
      const overlapping =
        windows.windows.filter(
          (window) =>
            window.delayEvents.some(
              (ref) =>
                ref.eventId ===
                event.eventId,
            ),
        );

      const net = overlapping.reduce(
        (sum, window) =>
          sum +
          (window.independentForecastMovementDays ??
            0),
        0,
      );

      const positive = overlapping.reduce(
        (sum, window) =>
          sum +
          Math.max(
            0,
            window.independentForecastMovementDays ??
              0,
          ),
        0,
      );

      const programmeNet =
        overlapping.reduce(
          (sum, window) =>
            sum +
            (window
              .strongestProgrammeMovementDays ??
              0),
          0,
        );

      const programmePositive =
        overlapping.reduce(
          (sum, window) =>
            sum +
            Math.max(
              0,
              window
                .strongestProgrammeMovementDays ??
                0,
            ),
          0,
        );

      const movementBases =
        new Set(
          overlapping
            .map(
              (window) =>
                window
                  .strongestProgrammeMovementBasis,
            )
            .filter(
              (basis) =>
                basis !==
                "unavailable",
            ),
        );
      const programmeMovementBasis:
        DelayClaimEventAssessmentRow["programmeMovementBasis"] =
        movementBases.size === 0
          ? "unavailable"
          : movementBases.size === 1
            ? [...movementBases][0]!
            : "mixed";

      const concurrencyCandidate =
        overlapping.some(
          (window) =>
            window.concurrentEventCandidate,
        );

      const notice =
        noticeByEvent.get(event.eventId);

      const diagnostics: string[] = [];

      if (
        overlapping.length === 0 &&
        event.startIso !== null
      ) {
        diagnostics.push(
          "DELAY_EVENT_NOT_CAPTURED_IN_SCHEDULE_WINDOWS",
        );
      }

      if (
        event.responsibilityState !==
        "official"
      ) {
        diagnostics.push(
          "DELAY_EVENT_RESPONSIBILITY_NOT_OFFICIAL",
        );
      }

      return {
        eventId: event.eventId,
        title: event.title,
        responsibility:
          event.responsibility,
        responsibilityState:
          event.responsibilityState,
        noticeTimeliness:
          notice?.timeliness ??
          "requirement_missing",
        linkedClaimIds: [
          ...new Set(
            claimsByEvent.get(
              event.eventId,
            ) ?? [],
          ),
        ].sort(),
        relatedActivityIds: [
          ...new Set(
            event.relatedActivityIds,
          ),
        ].sort(),
        overlappingWindowIds:
          overlapping.map(
            (window) =>
              window.windowId,
          ),
        observedNetIndependentMovementDays:
          Number(net.toFixed(6)),
        observedPositiveIndependentMovementDays:
          Number(positive.toFixed(6)),
        observedNetProgrammeMovementDays:
          Number(
            programmeNet.toFixed(6),
          ),
        observedPositiveProgrammeMovementDays:
          Number(
            programmePositive.toFixed(6),
          ),
        programmeMovementBasis,
        concurrencyCandidate,
        candidateClass: classify(
          event.responsibility,
          event.responsibilityState,
          concurrencyCandidate,
        ),
        scheduleAttribution:
          "not_causally_attributed",
        describedImpactDays:
          event.describedImpactDays,
        describedImpactState:
          event.describedImpactState,
        diagnostics,
      };
    });

  const eventById = new Map(
    rows.map((row) => [
      row.eventId,
      row,
    ]),
  );

  let employerOrNeutral = 0;
  let contractor = 0;
  let concurrent = 0;
  let unattributed = 0;

  for (const window of windows.windows) {
    const positive = Math.max(
      0,
      window.strongestProgrammeMovementDays ??
        0,
    );

    if (positive === 0) continue;

    if (window.concurrentEventCandidate) {
      concurrent += positive;
      continue;
    }

    const classes = new Set(
      window.delayEvents
        .map((event) =>
          eventById.get(event.eventId)
            ?.candidateClass,
        )
        .filter(
          (
            value,
          ): value is DelayCandidateClass =>
            value !== undefined,
        ),
    );

    if (
      classes.has(
        "employer_or_neutral_time_candidate",
      )
    ) {
      employerOrNeutral += positive;
    } else if (
      classes.has("contractor_risk")
    ) {
      contractor += positive;
    } else {
      unattributed += positive;
    }
  }

  return {
    schemaVersion: "1.0",
    projectionKey: "delay_claims",
    generatedAt: input.generatedAt,
    producerVersion:
      input.producerVersion,
    projectId: model.projectId,
    evidenceRevisionId:
      model.evidenceRevisionId,

    eventCount: rows.length,
    claimCount:
      model.claims.length,
    windowCount:
      windows.windowCount,

    observedPositiveIndependentMovementDays:
      Number(
        windows.positiveIndependentMovementDays.toFixed(
          6,
        ),
      ),
    observedPositiveProgrammeMovementDays:
      Number(
        windows.positiveProgrammeMovementDays.toFixed(
          6,
        ),
      ),
    projectCompletionMovementDays:
      windows.projectCompletionMovementDays,
    projectCompletionMovementBasis:
      windows.projectCompletionMovementBasis,
    unattributedProgrammeMovementDays:
      Number(
        unattributed.toFixed(6),
      ),
    employerOrNeutralCandidateWindowMovementDays:
      Number(employerOrNeutral.toFixed(6)),
    contractorRiskWindowMovementDays:
      Number(contractor.toFixed(6)),
    concurrentReviewWindowMovementDays:
      Number(concurrent.toFixed(6)),

    events: rows,
    diagnostics: [
      ...model.diagnostics,
      ...windows.diagnostics,
      "PROGRAMME_MOVEMENT_PROPAGATES_FORWARD_EVEN_WHEN_CAUSATION_IS_NOT_ESTABLISHED",
      "DELAY_WINDOW_MOVEMENT_IS_NOT_CONTRACTUAL_CAUSATION_OR_ENTITLEMENT",
    ],
  };
}
