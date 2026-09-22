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
  const contractMs = ms(contractual?.slice(0, 10) ?? null);
  const forecastMs = ms(forecast?.slice(0, 10) ?? null);
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
        "LD_PERCENT_RATE_REQUIRES_CONTRACT_VALUE_CANDIDATE",
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
        "LD_PERCENT_CAP_REQUIRES_CONTRACT_VALUE_CANDIDATE",
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

export function buildLdScenario(
  terms: ContractLdTerms,
  delayDays: number | null,
  contractValue: MoneyValue | undefined,
  contractValueCandidates:
    MoneyValue[] = [],
): Omit<ProjectDirectorPosition["ld"], "delayBasis"> {
  const rateCandidates =
    terms.rateState ===
      "candidate" &&
    terms.rate
      ? [terms.rate]
      : terms.rateCandidates;

  const capCandidates:
    Array<
      LdCapCandidate | null
    > =
    terms.capState ===
      "candidate" &&
    terms.cap
      ? [terms.cap]
      : terms.capCandidates
          .length > 0
        ? terms.capCandidates
        : [null];

  const values: Array<
    MoneyValue | undefined
  > =
    contractValue
      ? [contractValue]
      : contractValueCandidates
          .length > 0
        ? contractValueCandidates
        : [undefined];

  if (
    rateCandidates.length ===
      0 ||
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
      recommendedScenarioId:
        null,
      recommendationRationale:
        [],
      userDecisionRequired:
        false,
      scenarios: [],
      diagnostics: [
        ...terms.diagnostics,
        ...(rateCandidates.length ===
        0
          ? [
              "LD_SCENARIO_REQUIRES_RATE",
            ]
          : []),
        ...(delayDays === null
          ? [
              "LD_SCENARIO_REQUIRES_SCHEDULE_DELAY",
            ]
          : []),
      ],
    };
  }

  const rawScenarios:
    ProjectDirectorPosition["ld"]["scenarios"] =
    [];

  for (
    const rate of
      rateCandidates
  ) {
    for (
      const cap of
        capCandidates
    ) {
      for (
        const candidateValue of
          values
      ) {
        const exposure =
          exposureFromRate(
            rate,
            delayDays,
            candidateValue,
          );
        const diagnostics = [
          ...terms.diagnostics,
          ...exposure.diagnostics,
        ];
        const sourceRefs = [
          ...rate.sourceRefs,
          ...(cap
            ? cap.sourceRefs
            : []),
          ...(candidateValue
            ? candidateValue
                .sourceRefs
            : []),
        ];

        let cappedAmount:
          number | null =
          exposure.amount;
        let capApplied:
          boolean | null =
          exposure.amount ===
          null
            ? null
            : false;

        if (
          cap &&
          exposure.amount !==
            null &&
          exposure.currency !==
            null
        ) {
          const capResult =
            capValue(
              cap,
              exposure.currency,
              candidateValue,
            );
          diagnostics.push(
            ...capResult.diagnostics,
          );
          if (
            capResult.amount !==
            null
          ) {
            cappedAmount =
              Math.min(
                exposure.amount,
                capResult.amount,
              );
            capApplied =
              cappedAmount <
              exposure.amount;
          }
        }

        const state =
          exposure.amount !==
            null &&
          exposure.currency !==
            null &&
          cappedAmount !== null
            ? "calculated" as const
            : "not_calculable" as const;

        const evidenceScore =
          Number(
            (
              (
                terms.rateState ===
                  "candidate"
                  ? 30
                  : 18
              ) +
              (
                cap === null
                  ? 5
                  : terms.capState ===
                      "candidate"
                    ? 25
                    : 15
              ) +
              (
                contractValue &&
                candidateValue ===
                  contractValue
                  ? 50
                  : candidateValue
                    ? 20
                    : 0
              ) +
              Math.min(
                20,
                new Set(
                  sourceRefs,
                ).size * 2,
              ) -
              diagnostics.length * 2
            ).toFixed(4),
          );

        const scenarioId = [
          "ld",
          rate.candidateId,
          cap?.candidateId ??
            "no-cap",
          candidateValue
            ? (
                candidateValue.currency +
                "-" +
                candidateValue.amount
              )
            : "no-contract-value",
        ].join(":");

        rawScenarios.push({
          scenarioId,
          rateCandidateId:
            rate.candidateId,
          capCandidateId:
            cap?.candidateId ??
            null,
          contractValueAmount:
            candidateValue
              ?.amount ??
            null,
          contractValueCurrency:
            candidateValue
              ?.currency ??
            null,
          state,
          currency:
            exposure.currency,
          uncappedAmount:
            exposure.amount,
          cappedAmount:
            cappedAmount ===
            null
              ? null
              : Number(
                  cappedAmount.toFixed(
                    6,
                  ),
                ),
          capApplied,
          evidenceScore,
          recommended: false,
          sourceRefs: [
            ...new Set(
              sourceRefs,
            ),
          ],
          diagnostics: [
            ...new Set(
              diagnostics,
            ),
          ],
        });
      }
    }
  }

  const deduped =
    new Map<
      string,
      ProjectDirectorPosition["ld"]["scenarios"][number]
    >();

  for (
    const scenario of
      rawScenarios
  ) {
    const key = [
      scenario
        .rateCandidateId,
      scenario
        .capCandidateId ??
        "",
      scenario
        .contractValueAmount ??
        "",
      scenario
        .contractValueCurrency ??
        "",
      scenario.currency ??
        "",
      scenario
        .uncappedAmount ??
        "",
      scenario
        .cappedAmount ??
        "",
    ].join("|");
    const existing =
      deduped.get(key);
    if (
      !existing ||
      scenario.evidenceScore >
        existing.evidenceScore
    ) {
      deduped.set(
        key,
        scenario,
      );
    }
  }

  const scenarios = [
    ...deduped.values(),
  ].sort(
    (a, b) =>
      (
        b.state ===
        "calculated"
          ? 1
          : 0
      ) -
        (
          a.state ===
          "calculated"
            ? 1
            : 0
        ) ||
      b.evidenceScore -
        a.evidenceScore ||
      a.scenarioId.localeCompare(
        b.scenarioId,
      ),
  );

  const calculated =
    scenarios.filter(
      (scenario) =>
        scenario.state ===
        "calculated",
    );

  if (
    calculated.length === 0
  ) {
    return {
      delayDays,
      state: "unavailable",
      currency: null,
      uncappedAmount: null,
      cappedAmount: null,
      capApplied: null,
      sourceRefs: [
        ...new Set(
          scenarios.flatMap(
            (scenario) =>
              scenario.sourceRefs,
          ),
        ),
      ],
      recommendedScenarioId:
        null,
      recommendationRationale: [
        "All contradictory branches were retained and attempted, but a mathematically required input is genuinely absent from every branch.",
      ],
      userDecisionRequired:
        scenarios.length > 1,
      scenarios,
      diagnostics: [
        ...terms.diagnostics,
        "LD_ALL_CANDIDATE_BRANCHES_NOT_CALCULABLE",
      ],
    };
  }

  const highestScore =
    calculated[0]!
      .evidenceScore;
  const strongest =
    calculated.filter(
      (scenario) =>
        scenario.evidenceScore ===
        highestScore,
    );
  const uniqueRecommendation =
    strongest.length === 1
      ? strongest[0]!
      : null;

  if (
    uniqueRecommendation
  ) {
    uniqueRecommendation
      .recommended = true;
  }

  const conflictExists =
    terms.rateState ===
      "conflicted" ||
    terms.capState ===
      "conflicted" ||
    (
      !contractValue &&
      contractValueCandidates
        .length > 1
    ) ||
    calculated.length > 1;

  const chosen =
    uniqueRecommendation ??
    calculated[0]!;

  return {
    delayDays,
    state:
      conflictExists
        ? "multi_scenario"
        : "scenario_candidate",
    currency:
      chosen.currency,
    uncappedAmount:
      chosen.uncappedAmount,
    cappedAmount:
      chosen.cappedAmount,
    capApplied:
      chosen.capApplied,
    sourceRefs: [
      ...new Set(
        scenarios.flatMap(
          (scenario) =>
            scenario.sourceRefs,
        ),
      ),
    ],
    recommendedScenarioId:
      uniqueRecommendation
        ?.scenarioId ??
      null,
    recommendationRationale:
      uniqueRecommendation
        ? [
            "This branch has the strongest evidence score among the calculable contradictory branches.",
            ...(contractValue
              ? [
                  "It uses the governed contract value.",
                ]
              : []),
            "Recommendation is analytical only; user confirmation is required before changing the governed basis.",
          ]
        : [
            "Multiple calculable branches remain equally supported. CMeng retains every result and requires the user to select the governed basis.",
          ],
    userDecisionRequired:
      conflictExists,
    scenarios,
    diagnostics: [
      ...terms.diagnostics,
      ...(conflictExists
        ? [
            "CONTRADICTORY_LD_INPUTS_CALCULATED_AS_PARALLEL_SCENARIOS",
          ]
        : []),
      ...(uniqueRecommendation
        ? [
            "LD_RECOMMENDATION_IS_ANALYTICAL_NOT_GOVERNED",
          ]
        : []),
    ],
  };
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

  const contractualCompletion =
    input.eotAssessment
      .contractualCompletionIso;
  const officialAdjustedCompletion =
    input.eotAssessment
      .officialAdjustedCompletionIso;
  const submittedProgrammeCompletion =
    input.independentForecast
      .sourceForecastCompletionIso;
  const forecast =
    input.independentForecast
      .independentForecastCompletionIso;

  const varianceDaysToContractualCompletion =
    positiveDelayDays(
      contractualCompletion,
      forecast,
    );
  const varianceDaysToOfficialAdjustedCompletion =
    positiveDelayDays(
      officialAdjustedCompletion,
      forecast,
    );
  const varianceDaysToSubmittedProgrammeCompletion =
    positiveDelayDays(
      submittedProgrammeCompletion,
      forecast,
    );

  const delayDays =
    varianceDaysToOfficialAdjustedCompletion;
  const ld = buildLdScenario(
    input.ldTerms,
    delayDays,
    input.contractValue,
    input.contractValueCandidates ??
      [],
  );

  const missingCommercialMetric = () => ({
    value: null,
    state: "not_submitted" as const,
    sourceRefs: [] as string[],
    diagnostics: [
      "COMMERCIAL_VALUE_NOT_ESTABLISHED",
    ],
  });
  const cloneCommercialMetric = (
    metric:
      CurrencyCommercialPosition[
        "pendingVariationAmount"
      ],
  ) => ({
    value: metric.value,
    state: metric.state,
    sourceRefs: [
      ...metric.sourceRefs,
    ],
    diagnostics: [
      ...metric.diagnostics,
    ],
  });

  const positions:
    CurrencyCommercialPosition[] =
    input.commercialByCurrency.map(
      (row) => ({
        currency:
          upperCurrency(
            row.currency,
          ),
        pendingVariationAmount:
          cloneCommercialMetric(
            row.pendingVariationAmount,
          ),
        approvedVariationAmount:
          cloneCommercialMetric(
            row.approvedVariationAmount,
          ),
        certifiedUnpaidAmount:
          cloneCommercialMetric(
            row.certifiedUnpaidAmount,
          ),
        retentionDeductedAmount:
          cloneCommercialMetric(
            row.retentionDeductedAmount,
          ),
        retentionHeldAmount:
          cloneCommercialMetric(
            row.retentionHeldAmount,
          ),
        activeBondAmount:
          cloneCommercialMetric(
            row.activeBondAmount,
          ),
        claimClaimedAmount:
          cloneCommercialMetric(
            row.claimClaimedAmount,
          ),
        claimAssessedAmount:
          cloneCommercialMetric(
            row.claimAssessedAmount,
          ),
        ldScenarioAmount:
          cloneCommercialMetric(
            row.ldScenarioAmount,
          ),
      }),
    );

  if (
    ld.currency &&
    ld.cappedAmount !== null
  ) {
    const code =
      upperCurrency(ld.currency);
    let row =
      positions.find(
        (item) =>
          item.currency === code,
      );
    if (!row) {
      row = {
        currency: code,
        pendingVariationAmount:
          missingCommercialMetric(),
        approvedVariationAmount:
          missingCommercialMetric(),
        certifiedUnpaidAmount:
          missingCommercialMetric(),
        retentionDeductedAmount:
          missingCommercialMetric(),
        retentionHeldAmount:
          missingCommercialMetric(),
        activeBondAmount:
          missingCommercialMetric(),
        claimClaimedAmount:
          missingCommercialMetric(),
        claimAssessedAmount:
          missingCommercialMetric(),
        ldScenarioAmount:
          missingCommercialMetric(),
      };
      positions.push(row);
    }
    row.ldScenarioAmount = {
      value: ld.cappedAmount,
      state: "candidate",
      sourceRefs: [
        ...ld.sourceRefs,
      ],
      diagnostics: [
        "LD_EXPOSURE_IS_SCENARIO_NOT_AWARD_OR_ACCRUAL",
      ],
    };
  }

  const evidenceRefs: string[] =
    positions.flatMap(
      (row) => [
        ...row.pendingVariationAmount.sourceRefs,
        ...row.approvedVariationAmount.sourceRefs,
        ...row.certifiedUnpaidAmount.sourceRefs,
        ...row.retentionDeductedAmount.sourceRefs,
        ...row.retentionHeldAmount.sourceRefs,
        ...row.activeBondAmount.sourceRefs,
        ...row.claimClaimedAmount.sourceRefs,
        ...row.claimAssessedAmount.sourceRefs,
        ...row.ldScenarioAmount.sourceRefs,
      ],
    );

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
    Date.parse(input.progressReport.dataDateIso ?? "");
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
    const unlinked = input.noticesClaims.claims.filter(claim => unlinkedClaimIds.includes(claim.claimId));
    const missingEvents = unlinked.filter(claim => !claim.eventIds.some(id => eventById.has(id))).length;
    const missingActivities = unlinked.filter(claim => claim.eventIds.some(id => eventById.has(id)) &&
      !claim.eventIds.some(id => (eventById.get(id)?.relatedActivityIds.length ?? 0) > 0)).length;
    actions.push(
      [missingEvents ? String(missingEvents) + " current claim(s) need a governed event link." : "",
        missingActivities ? String(missingActivities) + " current claim(s) have event links but need affected activity linkage." : "",
        "Review the incomplete chains and their notice and causation evidence."].filter(Boolean).join(" "),
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

  const claimEvidenceState =
    evidenceState(
      input.evidenceAvailability
        ?.claims,
      input.noticesClaims
        .claimCount > 0 ||
      input.delayClaims
        .eventCount > 0,
    );

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
      input.openRiskCount !==
        undefined &&
      input.openRiskCount !==
        null,
    );

  const controls = {
    hseEvidenceState, qualityEvidenceState, rfiEvidenceState, permitEvidenceState, bondEvidenceState, riskEvidenceState,
    openRiskCount: riskEvidenceState === "established" ? input.openRiskCount ?? null : null,
    openHseIncidentCount: hseEvidenceState === "established" ? openHse.length : null,
    openLtiOrWorseCount: hseEvidenceState === "established" ? openHse.filter(item=>item.severity==="fatality"||item.severity==="lti").length : null,
    openCriticalMajorNcrCount: qualityEvidenceState === "established" ? openNcrs.length : null,
    openRfiCount: rfiEvidenceState === "established" ? openRfis.length : null,
    overdueRfiCount: rfiEvidenceState === "established" ? openRfis.filter(item=>overdue(item.dueIso)).length : null,
    openPermitCount: permitEvidenceState === "established" ? openPermits.length : null,
    overduePermitCount: permitEvidenceState === "established" ? openPermits.filter(item=>item.status==="expired"||overdue(item.dueIso)).length : null,
    expiredBondCount: input.bondMonitoring ? input.bondMonitoring.expiredCount : bondEvidenceState === "established" ? input.bonds.filter(bond=>bond.status==="expired").length : null,
    expiringBondCount30Days: input.bondMonitoring ? input.bondMonitoring.expiring30Count : bondEvidenceState === "established" ? expiring30 : null,
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
        contractualCompletion,
      officialAdjustedCompletionIso:
        officialAdjustedCompletion,
      submittedProgrammeCompletionIso:
        submittedProgrammeCompletion,
      independentForecastCompletionIso:
        forecast,
      independentForecastBasisRevisionId:
        input.independentForecast
          .sourceRevisionId,
      independentForecastCoveragePercent:
        input.independentForecast
          .activityCoveragePercent,
      independentForecastAuthority:
        input.independentForecast.origin ===
          "deterministic_source_calendar"
          ? "deterministic"
          : input.independentForecast.origin ===
              "scenario_with_assumptions"
            ? "scenario"
            : "unresolved",
      varianceDaysToContractualCompletion,
      varianceDaysToOfficialAdjustedCompletion,
      varianceDaysToSubmittedProgrammeCompletion,
      forecastComparisonBasis:
        varianceDaysToOfficialAdjustedCompletion !== null
          ? "official_adjusted_completion"
          : varianceDaysToContractualCompletion !== null
            ? "contractual_completion"
            : varianceDaysToSubmittedProgrammeCompletion !== null
              ? "submitted_programme"
              : "none",
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
      evidenceState:
        claimEvidenceState,
      eventCount:
        claimEvidenceState ===
          "established"
          ? input.delayClaims
              .eventCount
          : null,
      claimCount:
        claimEvidenceState ===
          "established"
          ? input.noticesClaims
              .claimCount
          : null,
      fullyLinkedEventCount:
        claimEvidenceState ===
          "established"
          ? fullyLinkedEvents.length
          : null,
      fullyLinkedClaimCount:
        claimEvidenceState ===
          "established"
          ? linkedClaimIds.size
          : null,
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
    ld: {
      ...ld,
      delayBasis:
        delayDays === null
          ? "unavailable"
          : "official_adjusted_completion",
    },
    commercialByCurrency:
      positions
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
