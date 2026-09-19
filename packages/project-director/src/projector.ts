import type {
  ContractLdTerms,
  LdCapCandidate,
  LdRateCandidate,
} from "../../contract-commercial/src";
import type {
  CurrencyCommercialPosition,
  DirectorPositionInput,
  MoneyValue,
  ProjectDirectorPosition,
} from "./types";

const DAY_MS = 86_400_000;

function ms(
  value: string | null,
): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function positiveDelayDays(
  contractual: string | null,
  forecast: string | null,
): number | null {
  const contractMs = ms(contractual);
  const forecastMs = ms(forecast);
  if (
    contractMs === null ||
    forecastMs === null
  ) {
    return null;
  }
  return Math.max(
    0,
    Number(
      (
        (forecastMs - contractMs) /
        DAY_MS
      ).toFixed(6),
    ),
  );
}

function upperCurrency(
  currency: string,
): string {
  return currency.trim().toUpperCase();
}

function evidenceState(
  explicit:
    | "established"
    | "submitted_unparsed"
    | "not_submitted"
    | undefined,
  hasStructuredRows: boolean,
): "established" | "submitted_unparsed" | "not_submitted" {
  if (explicit) return explicit;
  return hasStructuredRows
    ? "established"
    : "not_submitted";
}

function exposureFromRate(
  rate: LdRateCandidate,
  delayDays: number,
  contractValue: MoneyValue | undefined,
): {
  amount: number | null;
  currency: string | null;
  diagnostics: string[];
} {
  const timeMultiplier =
    rate.basis.endsWith("_per_week")
      ? delayDays / 7
      : delayDays;

  if (
    rate.basis.startsWith("fixed_amount")
  ) {
    if (
      rate.amount === null ||
      rate.currency === null
    ) {
      return {
        amount: null,
        currency: null,
        diagnostics: [
          "LD_FIXED_RATE_VALUE_INCOMPLETE",
        ],
      };
    }
    return {
      amount: Number(
        (
          rate.amount * timeMultiplier
        ).toFixed(6),
      ),
      currency:
        upperCurrency(rate.currency),
      diagnostics: [],
    };
  }

  if (
    rate.percent === null ||
    !contractValue
  ) {
    return {
      amount: null,
      currency: null,
      diagnostics: [
        "LD_PERCENT_RATE_REQUIRES_GOVERNED_CONTRACT_VALUE",
      ],
    };
  }

  return {
    amount: Number(
      (
        contractValue.amount *
        (rate.percent / 100) *
        timeMultiplier
      ).toFixed(6),
    ),
    currency:
      upperCurrency(contractValue.currency),
    diagnostics: [],
  };
}

function capValue(
  cap: LdCapCandidate,
  exposureCurrency: string,
  contractValue: MoneyValue | undefined,
): {
  amount: number | null;
  diagnostics: string[];
} {
  if (cap.basis === "fixed_amount") {
    if (
      cap.amount === null ||
      cap.currency === null
    ) {
      return {
        amount: null,
        diagnostics: [
          "LD_FIXED_CAP_VALUE_INCOMPLETE",
        ],
      };
    }
    if (
      upperCurrency(cap.currency) !==
      exposureCurrency
    ) {
      return {
        amount: null,
        diagnostics: [
          "LD_CAP_CURRENCY_DIFFERS_FROM_RATE_EXPOSURE_CURRENCY",
        ],
      };
    }
    return {
      amount: cap.amount,
      diagnostics: [],
    };
  }

  if (
    cap.percent === null ||
    !contractValue
  ) {
    return {
      amount: null,
      diagnostics: [
        "LD_PERCENT_CAP_REQUIRES_GOVERNED_CONTRACT_VALUE",
      ],
    };
  }

  if (
    upperCurrency(contractValue.currency) !==
    exposureCurrency
  ) {
    return {
      amount: null,
      diagnostics: [
        "LD_CONTRACT_VALUE_CURRENCY_DIFFERS_FROM_EXPOSURE_CURRENCY",
      ],
    };
  }

  return {
    amount: Number(
      (
        contractValue.amount *
        (cap.percent / 100)
      ).toFixed(6),
    ),
    diagnostics: [],
  };
}

function ldScenario(
  terms: ContractLdTerms,
  delayDays: number | null,
  contractValue: MoneyValue | undefined,
): ProjectDirectorPosition["ld"] {
  if (
    terms.rateState === "conflicted" ||
    terms.capState === "conflicted"
  ) {
    return {
      delayDays,
      state: "conflicted",
      currency: null,
      uncappedAmount: null,
      cappedAmount: null,
      capApplied: null,
      sourceRefs: [
        ...terms.rateCandidates.flatMap(
          (candidate) => candidate.sourceRefs,
        ),
        ...terms.capCandidates.flatMap(
          (candidate) => candidate.sourceRefs,
        ),
      ],
      diagnostics: [
        ...terms.diagnostics,
        "LD_SCENARIO_BLOCKED_BY_CONFLICTING_TERMS",
      ],
    };
  }

  if (
    terms.rateState !== "candidate" ||
    !terms.rate ||
    delayDays === null
  ) {
    return {
      delayDays,
      state: "unavailable",
      currency: null,
      uncappedAmount: null,
      cappedAmount: null,
      capApplied: null,
      sourceRefs: [],
      diagnostics: [
        ...terms.diagnostics,
        "LD_SCENARIO_REQUIRES_SINGLE_RATE_AND_SCHEDULE_DELAY",
      ],
    };
  }

  const exposure = exposureFromRate(
    terms.rate,
    delayDays,
    contractValue,
  );
  if (
    exposure.amount === null ||
    exposure.currency === null
  ) {
    return {
      delayDays,
      state: "unavailable",
      currency: exposure.currency,
      uncappedAmount: null,
      cappedAmount: null,
      capApplied: null,
      sourceRefs: [
        ...terms.rate.sourceRefs,
      ],
      diagnostics: [
        ...terms.diagnostics,
        ...exposure.diagnostics,
      ],
    };
  }

  let cappedAmount = exposure.amount;
  let capApplied = false;
  const diagnostics = [
    ...terms.diagnostics,
    ...exposure.diagnostics,
  ];
  const sourceRefs = [
    ...terms.rate.sourceRefs,
  ];

  if (
    terms.capState === "candidate" &&
    terms.cap
  ) {
    sourceRefs.push(
      ...terms.cap.sourceRefs,
    );
    const cap = capValue(
      terms.cap,
      exposure.currency,
      contractValue,
    );
    diagnostics.push(
      ...cap.diagnostics,
    );
    if (cap.amount !== null) {
      cappedAmount = Math.min(
        exposure.amount,
        cap.amount,
      );
      capApplied =
        cappedAmount < exposure.amount;
    }
  }

  return {
    delayDays,
    state: "scenario_candidate",
    currency: exposure.currency,
    uncappedAmount: exposure.amount,
    cappedAmount:
      Number(cappedAmount.toFixed(6)),
    capApplied,
    sourceRefs: [
      ...new Set(sourceRefs),
    ],
    diagnostics,
  };
}

function positionMap() {
  return new Map<
    string,
    CurrencyCommercialPosition
  >();
}

function rowFor(
  map: Map<string, CurrencyCommercialPosition>,
  currency: string,
): CurrencyCommercialPosition {
  const code = upperCurrency(currency);
  const existing = map.get(code);
  if (existing) return existing;
  const row: CurrencyCommercialPosition = {
    currency: code,
    pendingVariationAmount: 0,
    approvedVariationAmount: 0,
    certifiedUnpaidAmount: 0,
    retentionHeldAmount: 0,
    activeBondAmount: 0,
    claimClaimedAmount: 0,
    claimAssessedAmount: 0,
    ldScenarioAmount: null,
  };
  map.set(code, row);
  return row;
}

export function buildProjectDirectorPosition(
  input: DirectorPositionInput,
): ProjectDirectorPosition {
  const schedule =
    input.scheduleAnalytics.result;
  if (
    schedule.projectId !== null &&
    schedule.projectId !== input.projectId
  ) {
    throw new Error(
      "Director position schedule project mismatch",
    );
  }

  const officialCompletion =
    input.eotAssessment
      .officialAdjustedCompletionIso ??
    input.eotAssessment
      .contractualCompletionIso;
  const forecast =
    input.independentForecast
      .independentForecastCompletionIso;
  const delayDays = positiveDelayDays(
    officialCompletion,
    forecast,
  );
  const ld = ldScenario(
    input.ldTerms,
    delayDays,
    input.contractValue,
  );

  const positions = positionMap();
  const evidenceRefs: string[] = [];

  for (const variation of input.variations) {
    const row = rowFor(
      positions,
      variation.currency,
    );
    if (variation.state === "pending") {
      row.pendingVariationAmount +=
        variation.amount;
    } else if (
      variation.state === "approved"
    ) {
      row.approvedVariationAmount +=
        variation.amount;
    }
    evidenceRefs.push(
      ...variation.sourceRefs,
    );
  }

  for (const invoice of input.invoices) {
    if (
      invoice.certifiedAmount === null
    ) {
      continue;
    }
    const row = rowFor(
      positions,
      invoice.currency,
    );
    if (invoice.paidAmount !== null) {
      row.certifiedUnpaidAmount +=
        Math.max(
          0,
          invoice.certifiedAmount -
            invoice.paidAmount,
        );
    }
    evidenceRefs.push(
      ...invoice.sourceRefs,
    );
  }

  for (const retention of input.retentions) {
    if (retention.state !== "held") {
      continue;
    }
    rowFor(
      positions,
      retention.currency,
    ).retentionHeldAmount +=
      retention.amount;
    evidenceRefs.push(
      ...retention.sourceRefs,
    );
  }

  for (const bond of input.bonds) {
    if (bond.status === "active") {
      rowFor(
        positions,
        bond.currency,
      ).activeBondAmount += bond.amount;
    }
    evidenceRefs.push(...bond.sourceRefs);
  }

  for (
    const claim of input.claimCommercials
  ) {
    const row = rowFor(
      positions,
      claim.currency,
    );
    if (claim.claimedAmount !== null) {
      row.claimClaimedAmount +=
        claim.claimedAmount;
    }
    if (claim.assessedAmount !== null) {
      row.claimAssessedAmount +=
        claim.assessedAmount;
    }
    evidenceRefs.push(
      ...claim.sourceRefs,
    );
  }

  if (
    ld.state === "scenario_candidate" &&
    ld.currency &&
    ld.cappedAmount !== null
  ) {
    rowFor(
      positions,
      ld.currency,
    ).ldScenarioAmount =
      ld.cappedAmount;
  }

  if (input.contractValue) {
    evidenceRefs.push(
      ...input.contractValue.sourceRefs,
    );
  }
  evidenceRefs.push(...ld.sourceRefs);

  const eventById = new Map(
    input.delayClaims.events.map(
      (event) => [event.eventId, event],
    ),
  );
  const fullyLinkedEvents =
    input.delayClaims.events.filter(
      (event) =>
        event.linkedClaimIds.length > 0 &&
        event.relatedActivityIds.length > 0,
    );

  const linkedClaimIds = new Set(
    fullyLinkedEvents.flatMap(
      (event) => event.linkedClaimIds,
    ),
  );
  const unlinkedClaimIds =
    input.noticesClaims.claims
      .map((claim) => claim.claimId)
      .filter(
        (claimId) =>
          !linkedClaimIds.has(claimId),
      )
      .sort();

  const generatedMs =
    Date.parse(input.generatedAt);
  const overdue = (
    dueIso: string | null,
  ) => {
    const due = ms(dueIso);
    return (
      due !== null &&
      Number.isFinite(generatedMs) &&
      due < generatedMs
    );
  };

  const openHse =
    input.hseIncidents.filter(
      (item) => item.status === "open",
    );
  const openNcrs =
    input.ncrs.filter(
      (item) =>
        item.status === "open" &&
        (
          item.severity === "critical" ||
          item.severity === "major"
        ),
    );
  const openRfis =
    input.rfis.filter(
      (item) => item.status === "open",
    );
  const openPermits =
    input.permits.filter(
      (item) =>
        item.status === "required" ||
        item.status === "submitted" ||
        item.status === "expired",
    );

  const expiring30 =
    input.bonds.filter((bond) => {
      if (
        bond.status !== "active" ||
        !bond.expiryIso
      ) {
        return false;
      }
      const expiry = ms(bond.expiryIso);
      return (
        expiry !== null &&
        Number.isFinite(generatedMs) &&
        expiry >= generatedMs &&
        expiry <=
          generatedMs + 30 * DAY_MS
      );
    }).length;

  const actions: string[] = [];
  if (
    input.progressReport
      .lookAhead.overdueCount > 0
  ) {
    actions.push(
      "Resolve overdue look-ahead activities.",
    );
  }
  if (unlinkedClaimIds.length > 0) {
    actions.push(
      "Link open claims to governed delay events and affected schedule activities.",
    );
  }
  if (
    input.eotAssessment
      .unattributedTimeImpactDays >
      0
  ) {
    actions.push(
      "Reconcile the quantified programme movement to dated delay events, notices, clauses and affected activities so causation and EOT eligibility can be tested without discarding the calculated movement.",
    );
  }
  if (openNcrs.length > 0) {
    actions.push(
      "Close critical/major NCRs.",
    );
  }
  if (
    openRfis.some((item) =>
      overdue(item.dueIso),
    )
  ) {
    actions.push(
      "Escalate overdue RFIs affecting delivery.",
    );
  }
  if (
    openPermits.some((item) =>
      item.status === "expired" ||
      overdue(item.dueIso),
    )
  ) {
    actions.push(
      "Resolve overdue or expired permits.",
    );
  }
  if (
    input.boardEvidence === null ||
    input.boardEvidence.state !==
      "finalized"
  ) {
    actions.push(
      "Finalize a current board report with evidence receipts.",
    );
  }

  const hseEvidenceState =
    evidenceState(
      input.evidenceAvailability
        ?.hse,
      input.hseIncidents.length >
        0,
    );
  const qualityEvidenceState =
    evidenceState(
      input.evidenceAvailability
        ?.quality,
      input.ncrs.length > 0,
    );
  const rfiEvidenceState =
    evidenceState(
      input.evidenceAvailability
        ?.rfi,
      input.rfis.length > 0,
    );
  const permitEvidenceState =
    evidenceState(
      input.evidenceAvailability
        ?.permits,
      input.permits.length > 0,
    );
  const bondEvidenceState =
    evidenceState(
      input.evidenceAvailability
        ?.bonds,
      input.bonds.length > 0,
    );
  const riskEvidenceState =
    evidenceState(
      input.evidenceAvailability
        ?.risk,
      false,
    );

  const controls = {
    hseEvidenceState,
    qualityEvidenceState,
    rfiEvidenceState,
    permitEvidenceState,
    bondEvidenceState,
    riskEvidenceState,
    openRiskCount:
      null,
    openHseIncidentCount:
      openHse.length,
    openLtiOrWorseCount:
      openHse.filter(
        (item) =>
          item.severity === "fatality" ||
          item.severity === "lti",
      ).length,
    openCriticalMajorNcrCount:
      openNcrs.length,
    openRfiCount: openRfis.length,
    overdueRfiCount:
      openRfis.filter((item) =>
        overdue(item.dueIso),
      ).length,
    openPermitCount:
      openPermits.length,
    overduePermitCount:
      openPermits.filter(
        (item) =>
          item.status === "expired" ||
          overdue(item.dueIso),
      ).length,
    expiredBondCount:
      input.bonds.filter(
        (bond) =>
          bond.status === "expired",
      ).length,
    expiringBondCount30Days:
      expiring30,
  };

  for (const item of [
    ...input.hseIncidents,
    ...input.ncrs,
    ...input.rfis,
    ...input.permits,
  ]) {
    evidenceRefs.push(
      ...item.sourceRefs,
    );
  }
  if (input.boardEvidence) {
    evidenceRefs.push(
      ...input.boardEvidence
        .evidenceReceiptIds.map(
          (id) =>
            "evidence-receipt:" + id,
        ),
    );
    if (
      input.boardEvidence.sourceManifestId
    ) {
      evidenceRefs.push(
        "source-manifest:" +
          input.boardEvidence
            .sourceManifestId,
      );
    }
  }

  return {
    schemaVersion: "1.0",
    generatedAt: input.generatedAt,
    projectId: input.projectId,
    schedule: {
      dataDateIso:
        schedule.dataDateIso,
      contractualCompletionIso:
        input.eotAssessment
          .contractualCompletionIso,
      officialAdjustedCompletionIso:
        input.eotAssessment
          .officialAdjustedCompletionIso,
      independentForecastCompletionIso:
        forecast,
      varianceDaysToOfficialAdjustedCompletion:
        delayDays,
      criticalCount:
        schedule.float.criticalCount,
      nearCriticalCount:
        schedule.float.nearCriticalCount,
      criticalityBasis:
        "source_total_float",
      independentCpmState:
        input.independentForecast
          .complete
          ? "established"
          : "not_established",
      drivingPathState:
        input.independentForecast
          .complete
          ? "independent_cpm_available"
          : "not_established",
      overdueLookAheadCount:
        input.progressReport
          .lookAhead.overdueCount,
      progressBases:
        input.progressReport
          .progressBases,
    },
    claims: {
      eventCount:
        input.delayClaims.eventCount,
      claimCount:
        input.noticesClaims.claimCount,
      fullyLinkedEventCount:
        fullyLinkedEvents.length,
      fullyLinkedClaimCount:
        linkedClaimIds.size,
      unlinkedClaimIds,
      observedProgrammeMovementDays:
        input.delayClaims
          .observedPositiveProgrammeMovementDays,
      analyticalTimeImpactCandidateDays:
        input.eotAssessment
          .analyticalTimeImpactCandidateDays,
      attributableCandidateEotDays:
        input.eotAssessment
          .attributableCandidateEotDays,
      unattributedTimeImpactDays:
        input.eotAssessment
          .unattributedTimeImpactDays,
      candidateAdditionalEotDays:
        input.eotAssessment
          .candidateAdditionalEotDays,
      officialApprovedEotDays:
        input.eotAssessment
          .officialApprovedEotDays,
    },
    ld,
    commercialByCurrency:
      [...positions.values()]
        .map((row) => ({
          ...row,
          pendingVariationAmount:
            Number(
              row.pendingVariationAmount
                .toFixed(6),
            ),
          approvedVariationAmount:
            Number(
              row.approvedVariationAmount
                .toFixed(6),
            ),
          certifiedUnpaidAmount:
            Number(
              row.certifiedUnpaidAmount
                .toFixed(6),
            ),
          retentionHeldAmount:
            Number(
              row.retentionHeldAmount
                .toFixed(6),
            ),
          activeBondAmount:
            Number(
              row.activeBondAmount
                .toFixed(6),
            ),
          claimClaimedAmount:
            Number(
              row.claimClaimedAmount
                .toFixed(6),
            ),
          claimAssessedAmount:
            Number(
              row.claimAssessedAmount
                .toFixed(6),
            ),
        }))
        .sort(
          (a, b) =>
            a.currency.localeCompare(
              b.currency,
            ),
        ),
    controls,
    boardEvidence:
      input.boardEvidence
        ? {
            ...input.boardEvidence,
            evidenceReceiptIds: [
              ...input.boardEvidence
                .evidenceReceiptIds,
            ],
          }
        : null,
    managementActions: actions,
    evidenceRefs: [
      ...new Set(evidenceRefs),
    ].sort(),
    diagnostics: [
      ...ld.diagnostics,
      ...(input.boardEvidence?.state ===
      "stale"
        ? ["BOARD_REPORT_EVIDENCE_STALE"]
        : []),
      "CURRENCIES_ARE_NOT_CROSS_SUMMED_WITHOUT_A_GOVERNED_FX_BASIS",
      "LD_EXPOSURE_IS_A_SCENARIO_CANDIDATE_NOT_AN_AWARD_OR_ACCRUAL",
    ],
  };
}
