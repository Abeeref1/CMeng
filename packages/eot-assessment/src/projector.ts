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

/** The legal completion date is a civil calendar date, not the server's timezone.
 * Reject impossible dates rather than letting Date.parse roll them forward. */
function ms(value: string | null): number | null {
  if (!value) return null;
  const date=value.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const parsed=Date.parse(date+'T00:00:00Z');
  return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===date?parsed:null;
}

function addCalendarDays(dateIso:string,days:number):string|null {
 const value=ms(dateIso);
 if(value===null||!Number.isFinite(days))return null;
 const target=value+days*86_400_000;
 return Number.isFinite(target)&&!Number.isNaN(new Date(target).getTime())
   ?new Date(target).toISOString().slice(0,10):null;
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

export function noticeBlocksEvent(
  event: DelayClaimEventAssessmentRow,
  policy: EotScenarioPolicy,
): boolean {
  if (
    !policy
      .requireTimelyNoticeWhenOfficialRequirementExists
  ) {
    return false;
  }

  // M7.3: only a confirmed (official) notice rule can time-bar an event. With no
  // rule, conflicting rules, a missing date or only a candidate rule, the event
  // is not barred; the assessment states what needs review instead.
  const late = event.noticeTimeliness === "late" || event.noticeTimeliness === "not_issued";
  return late && (event.noticeRequirementState === undefined || event.noticeRequirementState === "official");
}

function assessWindow(
  window: ScheduleWindowResult,
  delay: DelayClaimsProjection,
  policy: EotScenarioPolicy,
): EotWindowCandidate {
  const positiveIndependentMovement = window.independentForecastMovementDays === null ? null : Math.max(0, window.independentForecastMovementDays);
  const positiveProgrammeMovement = window.netCompletionMovementDays === null ? null : Math.max(0, window.netCompletionMovementDays);
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

  // P0-B (C12): a calendar-basis question about CMeng's own recalculation does not
  // hold the window. The candidate rests on the submitted programme movement and
  // the eligible events; the open calendar question is stated as an assumption.
  if(window.independentReconciliationRequired)assumptions.push('SEPARATE_CALENDAR_MODEL_MOVEMENT_REQUIRES_RECONCILIATION');

  if (positiveProgrammeMovement !== null && positiveProgrammeMovement <= 0) {
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
          .netCompletionMovementBasis,
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

    if ((event.noticeTimeliness === "late" || event.noticeTimeliness === "not_issued") && event.noticeRequirementState !== undefined && event.noticeRequirementState !== "official") {
      assumptions.push("EVENT_" + event.eventId + "_NOTICE_LATE_UNDER_UNCONFIRMED_RULE_NOT_TIME_BARRED");
    }
    if ((event.noticeTimeliness as string) === "requirement_conflicted") {
      assumptions.push("EVENT_" + event.eventId + "_NOTICE_RULES_CONFLICT_REVIEW_REQUIRED");
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
    positiveProgrammeMovement !== null && positiveProgrammeMovement > 0 &&
    eligibleAfterNotice.length > 0;

  const analyticalTimeImpactCandidateDays =
    include
      ? Number(
          positiveProgrammeMovement.toFixed(6),
        )
      : null;

  const reviewOnly = positiveProgrammeMovement === null || (positiveProgrammeMovement > 0 && !include);

  return {
    windowId: window.windowId,
    positiveIndependentMovementDays:
      positiveIndependentMovement,
    positiveProgrammeMovementDays:
      positiveProgrammeMovement,
    programmeMovementBasis:
      window
        .netCompletionMovementBasis,
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

  const observedProgrammeMovementDays = windows.positiveProgrammeMovementDays;

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
      ? observedProgrammeMovementDays
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
    ...(windows.positiveProgrammeMovementDays !== null && windows.positiveProgrammeMovementDays > 0 &&
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

  // C9: while the overlap is not confirmed, the additional days are CMeng's
  // proposal. The governing date uses it (qualified); an "official" adjusted
  // completion is only calculated once the user has decided.
  const rawAdditionalAwardDays = contractTime.overlapResolution === "unresolved"
    ? null
    : contractTime.overlapResolution
    ? contractTime.additionalApprovedEotDays ?? null
    : contractTime.officialApprovedEotDays;
  // Keep supplied awards untouched in the source contract record, but an
  // invalid number cannot create an adjusted date or a zero-day award.
  const additionalAwardDays=typeof rawAdditionalAwardDays==='number'&&Number.isFinite(rawAdditionalAwardDays)
    ?rawAdditionalAwardDays:null;
  if(rawAdditionalAwardDays!==null&&additionalAwardDays===null)
    diagnostics.push('EOT_AWARD_DAYS_NOT_FINITE_ADJUSTED_COMPLETION_WITHHELD');
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
      registerDeterminationCount: contractTime.registerDeterminationCount ?? null,
      effectiveDeterminationCount: contractTime.effectiveDeterminationCount ?? null,
      futureDeterminationCount: contractTime.futureDeterminationCount ?? null,
      additionalApprovedEotDays: additionalAwardDays,
      proposedAdditionalApprovedEotDays: contractTime.overlapResolution === "unresolved" ? contractTime.overlapProposal?.days ?? null : null,
      proposalReason: contractTime.overlapResolution === "unresolved" ? contractTime.overlapProposal?.reason ?? null : null,
      overlapResolution: contractTime.overlapResolution,
      dataDateIso: contractTime.dataDateIso ?? null,
    }} : {}),

    observedProgrammeMovementDays,
    projectCompletionMovementDays:
      windows.projectCompletionMovementDays,
    projectCompletionMovementBasis:
      windows.projectCompletionMovementBasis,
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
