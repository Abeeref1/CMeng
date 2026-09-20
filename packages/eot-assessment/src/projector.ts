import type {
  DelayClaimsProjection,
  DelayClaimEventAssessmentRow,
} from "../../delay-claims/src";
import type {
  WindowsAnalysisProjection,
  ScheduleWindowResult,
} from "../../windows-analysis/src";
import {
  DEFAULT_EOT_SCENARIO_POLICY,
  type ContractTimeBasis,
  type EotAssessmentProjection,
  type EotScenarioPolicy,
  type EotWindowCandidate,
} from "./types";

function ms(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addCalendarDays(
  dateIso: string,
  days: number,
): string | null {
  const value = ms(dateIso);
  if (value === null) return null;

  return new Date(
    value + days * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
}

function eventRowsForWindow(
  window: ScheduleWindowResult,
  delay: DelayClaimsProjection,
): DelayClaimEventAssessmentRow[] {
  const ids = new Set(
    window.delayEvents.map(
      (event) => event.eventId,
    ),
  );

  return delay.events.filter(
    (event) => ids.has(event.eventId),
  );
}

function noticeBlocksEvent(
  event: DelayClaimEventAssessmentRow,
  policy: EotScenarioPolicy,
): boolean {
  if (
    !policy
      .requireTimelyNoticeWhenOfficialRequirementExists
  ) {
    return false;
  }

  if (
    event.noticeTimeliness ===
      "requirement_missing" ||
    event.noticeTimeliness ===
      "event_date_missing" ||
    event.noticeTimeliness ===
      "notice_date_missing"
  ) {
    return false;
  }

  return (
    event.noticeTimeliness === "late" ||
    event.noticeTimeliness ===
      "not_issued"
  );
}

function assessWindow(
  window: ScheduleWindowResult,
  delay: DelayClaimsProjection,
  policy: EotScenarioPolicy,
): EotWindowCandidate {
  const positiveIndependentMovement = Math.max(
    0,
    window.independentForecastMovementDays ??
      0,
  );
  const positiveProgrammeMovement = Math.max(
    0,
    window.strongestProgrammeMovementDays ??
      0,
  );
  const eventRows =
    eventRowsForWindow(window, delay);

  const eligible = eventRows.filter(
    (event) =>
      policy.eligibleResponsibilities.includes(
        event.responsibility,
      ),
  );

  const contractor = eventRows.filter(
    (event) =>
      event.responsibility ===
      "contractor",
  );

  const reasons: string[] = [];
  const assumptions: string[] = [];

  if (positiveProgrammeMovement <= 0) {
    reasons.push(
      "NO_POSITIVE_INDEPENDENT_FORECAST_MOVEMENT",
    );
  }

  if (
    policy.excludeConcurrentWindows &&
    window.concurrentEventCandidate
  ) {
    reasons.push(
      "CONCURRENT_WINDOW_REQUIRES_REVIEW",
    );

    return {
      windowId: window.windowId,
      positiveIndependentMovementDays:
        positiveIndependentMovement,
      positiveProgrammeMovementDays:
        positiveProgrammeMovement,
      programmeMovementBasis:
        window
          .strongestProgrammeMovementBasis,
      analyticalTimeImpactCandidateDays:
        null,
      state: "review",
      eligibleEventIds:
        eligible.map(
          (event) => event.eventId,
        ),
      contractorEventIds:
        contractor.map(
          (event) => event.eventId,
        ),
      reasons,
      assumptions,
      includedCandidateDays: 0,
    };
  }

  if (eligible.length === 0) {
    reasons.push(
      "NO_ELIGIBLE_EMPLOYER_OR_NEUTRAL_EVENT",
    );
  }

  const noticeBlocked =
    eligible.filter(
      (event) =>
        noticeBlocksEvent(event, policy),
    );

  if (noticeBlocked.length > 0) {
    reasons.push(
      "OFFICIAL_NOTICE_REQUIREMENT_NOT_SATISFIED_FOR_ONE_OR_MORE_EVENTS",
    );
  }

  const eligibleAfterNotice =
    eligible.filter(
      (event) =>
        !noticeBlocksEvent(event, policy),
    );

  for (const event of eligibleAfterNotice) {
    if (
      event.responsibilityState !==
      "official"
    ) {
      assumptions.push(
        "EVENT_" +
          event.eventId +
          "_RESPONSIBILITY_NOT_OFFICIAL",
      );
    }

    if (
      event.noticeTimeliness ===
      "requirement_missing"
    ) {
      assumptions.push(
        "EVENT_" +
          event.eventId +
          "_NOTICE_REQUIREMENT_MISSING_NOT_TIME_BARRED_FOR_SCENARIO",
      );
    }

    if (
      event.noticeTimeliness ===
        "event_date_missing" ||
      event.noticeTimeliness ===
        "notice_date_missing"
    ) {
      assumptions.push(
        "EVENT_" +
          event.eventId +
          "_NOTICE_TIMELINESS_UNRESOLVED",
      );
    }
  }

  const include =
    positiveProgrammeMovement > 0 &&
    eligibleAfterNotice.length > 0;

  const analyticalTimeImpactCandidateDays =
    include
      ? Number(
          positiveProgrammeMovement.toFixed(6),
        )
      : null;

  const reviewOnly =
    positiveProgrammeMovement > 0 &&
    !include;

  return {
    windowId: window.windowId,
    positiveIndependentMovementDays:
      positiveIndependentMovement,
    positiveProgrammeMovementDays:
      positiveProgrammeMovement,
    programmeMovementBasis:
      window
        .strongestProgrammeMovementBasis,
    analyticalTimeImpactCandidateDays,
    state: include
      ? "included"
      : reviewOnly
        ? "review"
        : "excluded",
    eligibleEventIds:
      eligibleAfterNotice.map(
        (event) => event.eventId,
      ),
    contractorEventIds:
      contractor.map(
        (event) => event.eventId,
      ),
    reasons,
    assumptions: [
      ...new Set(assumptions),
    ],
    includedCandidateDays:
      include
        ? Number(
            positiveProgrammeMovement.toFixed(6),
          )
        : 0,
  };
}

export function buildEotAssessmentProjection(
  windows: WindowsAnalysisProjection,
  delay: DelayClaimsProjection,
  contractTime: ContractTimeBasis,
  input: {
    generatedAt: string;
    producerVersion: string;
    policy?: EotScenarioPolicy;
  },
): EotAssessmentProjection {
  const policy =
    input.policy ??
    DEFAULT_EOT_SCENARIO_POLICY;

  const windowCandidates =
    windows.windows.map(
      (window) =>
        assessWindow(
          window,
          delay,
          policy,
        ),
    );

  const includedWindowCandidates =
    windowCandidates.filter(
      (window) =>
        window.state ===
        "included",
    );
  const candidateAdditionalEotDays =
    includedWindowCandidates.length > 0
      ? Number(
          includedWindowCandidates
            .reduce(
              (sum, window) =>
                sum +
                window.includedCandidateDays,
              0,
            )
            .toFixed(6),
        )
      : null;

  const observedProgrammeMovementDays =
    Number(
      windowCandidates
        .reduce(
          (sum, window) =>
            sum +
            window.positiveProgrammeMovementDays,
          0,
        )
        .toFixed(6),
    );

  const establishedTimeImpacts =
    windowCandidates
      .map(
        (window) =>
          window
            .analyticalTimeImpactCandidateDays,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );
  const analyticalTimeImpactCandidateDays =
    establishedTimeImpacts.length > 0
      ? Number(
          establishedTimeImpacts
            .reduce(
              (sum, value) =>
                sum + value,
              0,
            )
            .toFixed(6),
        )
      : null;

  const attributableCandidateEotDays =
    candidateAdditionalEotDays;

  const unattributedTimeImpactDays =
    analyticalTimeImpactCandidateDays ===
      null
      ? Number(
          observedProgrammeMovementDays.toFixed(6),
        )
      : Number(
          Math.max(
            0,
            analyticalTimeImpactCandidateDays -
              (
                attributableCandidateEotDays ??
                0
              ),
          ).toFixed(6),
        );

  const assumptions =
    windowCandidates.flatMap(
      (window) => window.assumptions,
    );

  const diagnostics = [
    ...windows.diagnostics,
    ...delay.diagnostics,
    ...(windows.positiveProgrammeMovementDays > 0 &&
    analyticalTimeImpactCandidateDays === null
      ? [
          "PROGRAMME_MOVEMENT_OBSERVED_WITHOUT_CAUSAL_TIME_IMPACT_CANDIDATE",
        ]
      : analyticalTimeImpactCandidateDays !== null
        ? [
            "ANALYTICAL_TIME_IMPACT_CANDIDATE_SUPPORTED_BY_ELIGIBLE_EVENT_WINDOW",
          ]
        : []),
  ];

  const additionalAwardDays = contractTime.overlapResolution
    ? contractTime.additionalApprovedEotDays ?? null
    : contractTime.officialApprovedEotDays;
  if (contractTime.overlapResolution === "unresolved") {
    diagnostics.push("AMENDMENT_ALREADY_INCLUDES_EOT_DETERMINATION_OVERLAP_UNRESOLVED");
  }
  let officialAdjustedCompletionIso:
    | string
    | null = null;

  if (
    contractTime.contractualCompletionIso &&
    contractTime.contractualCompletionState ===
      "official" &&
    additionalAwardDays !==
      null &&
    contractTime.officialApprovedEotState ===
      "official"
  ) {
    if (
      contractTime.eotDayBasis ===
      "calendar_days"
    ) {
      officialAdjustedCompletionIso =
        addCalendarDays(
          contractTime.contractualCompletionIso,
          additionalAwardDays,
        );
    } else {
      diagnostics.push(
        "OFFICIAL_ADJUSTED_COMPLETION_REQUIRES_SUPPORTED_EOT_DAY_BASIS",
      );
    }
  }

  let scenarioBaseApprovedDays = 0;

  if (
    additionalAwardDays !==
      null &&
    contractTime.officialApprovedEotState ===
      "official"
  ) {
    scenarioBaseApprovedDays =
      additionalAwardDays;
  } else {
    assumptions.push(
      "OFFICIAL_APPROVED_EOT_NOT_ESTABLISHED_ASSUMED_ZERO_FOR_SCENARIO_ONLY",
    );
  }

  let scenarioAdjustedCompletionIso:
    | string
    | null = null;
  let timeImpactScenarioAdjustedCompletionIso:
    | string
    | null = null;

  if (
    contractTime.contractualCompletionIso &&
    contractTime.eotDayBasis ===
      "calendar_days"
  ) {
    scenarioAdjustedCompletionIso =
      candidateAdditionalEotDays ===
        null
        ? null
        : addCalendarDays(
            contractTime.contractualCompletionIso,
            scenarioBaseApprovedDays +
              candidateAdditionalEotDays,
          );
    timeImpactScenarioAdjustedCompletionIso =
      analyticalTimeImpactCandidateDays ===
        null
        ? null
        : addCalendarDays(
            contractTime.contractualCompletionIso,
            scenarioBaseApprovedDays +
              analyticalTimeImpactCandidateDays,
          );
  } else if (
    contractTime.eotDayBasis !==
    "calendar_days"
  ) {
    diagnostics.push(
      "SCENARIO_ADJUSTED_COMPLETION_NOT_CALCULATED_WITHOUT_CALENDAR_DAY_BASIS",
    );
  }

  return {
    schemaVersion: "1.0",
    projectionKey: "eot_assessment",
    generatedAt: input.generatedAt,
    producerVersion:
      input.producerVersion,
    projectId: delay.projectId,

    contractualCompletionIso:
      contractTime.contractualCompletionIso,
    contractualCompletionState:
      contractTime.contractualCompletionState,

    officialApprovedEotDays:
      contractTime.officialApprovedEotDays,
    officialApprovedEotState:
      contractTime.officialApprovedEotState,
    officialAdjustedCompletionIso,
    ...(contractTime.overlapResolution ? {timeBasisReconciliation: {
      incorporatedEotDays: contractTime.incorporatedEotDays ?? null,
      registerDeterminationDays: contractTime.registerDeterminationDays ?? null,
      additionalApprovedEotDays: additionalAwardDays,
      overlapResolution: contractTime.overlapResolution,
      dataDateIso: contractTime.dataDateIso ?? null,
    }} : {}),

    observedProgrammeMovementDays,
    analyticalTimeImpactCandidateDays,
    attributableCandidateEotDays,
    unattributedTimeImpactDays,

    candidateAdditionalEotDays,
    scenarioAdjustedCompletionIso,
    timeImpactScenarioAdjustedCompletionIso,

    eotDayBasis:
      contractTime.eotDayBasis,
    eotDayBasisState:
      contractTime.eotDayBasisState,

    includedWindowCount:
      includedWindowCandidates.length,
    excludedWindowCount:
      windowCandidates.filter(
        (window) =>
          window.state === "excluded",
      ).length,
    reviewWindowCount:
      windowCandidates.filter(
        (window) =>
          window.state === "review",
      ).length,

    windowCandidates,

    basis:
      "analytical_candidate_not_contractual_determination",
    assumptions: [
      ...new Set(assumptions),
    ],
    diagnostics: [
      ...new Set(diagnostics),
    ],
  };
}
