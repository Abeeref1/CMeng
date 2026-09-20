import type {
  CommercialControlInput,
  CommercialControlPosition,
  CommercialEvidenceState,
  CommercialMetric,
  CommercialMoneyPosition,
  CommercialModuleProjection,
} from "./types";

const DAY_MS = 86_400_000;

function uniq(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function moneyMetric(
  value: number | null,
  state: CommercialEvidenceState,
  refs: string[],
  diagnostics: string[] = [],
): CommercialMetric<number> {
  return {
    value:
      value === null
        ? null
        : Number(value.toFixed(6)),
    state,
    sourceRefs: uniq(refs),
    diagnostics,
  };
}

function dateMetric(
  value: string | null,
  state: CommercialEvidenceState,
  refs: string[],
  diagnostics: string[] = [],
): CommercialMetric<string> {
  return {
    value,
    state,
    sourceRefs: uniq(refs),
    diagnostics,
  };
}

function stateFor(
  hasRows: boolean,
  submitted: boolean,
): CommercialEvidenceState {
  return hasRows
    ? "established"
    : submitted
      ? "submitted_unparsed"
      : "not_submitted";
}

function addDays(
  iso: string | null,
  days: number | null,
): string | null {
  if (!iso || days === null) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return new Date(
    parsed + days * DAY_MS,
  )
    .toISOString()
    .slice(0, 10);
}

function sum(
  values: number[],
): number {
  return values.reduce(
    (total, value) => total + value,
    0,
  );
}

function currenciesOf(
  input: CommercialControlInput,
): string[] {
  const values = new Set<string>();
  if (input.contractValue) {
    values.add(
      input.contractValue.currency
        .trim()
        .toUpperCase(),
    );
  }
  for (
    const candidate of
      input.contractValueCandidates ?? []
  ) {
    values.add(
      candidate.currency
        .trim()
        .toUpperCase(),
    );
  }
  for (const row of [
    ...input.variations,
    ...input.invoices,
    ...input.retentions,
    ...input.bonds,
    ...input.claimCommercials,
  ]) {
    values.add(
      row.currency
        .trim()
        .toUpperCase(),
    );
  }
  return [...values]
    .filter(Boolean)
    .sort();
}

export function buildCommercialControlPosition(
  input: CommercialControlInput,
): CommercialControlPosition {
  const contractTime =
    input.contractTimeBasis;
  const timeRefs =
    contractTime?.sourceRefs ?? [];
  const contractual =
    contractTime
      ?.contractualCompletionIso ??
    null;
  const approvedEot =
    contractTime
      ?.officialApprovedEotDays ??
    null;
  const adjusted =
    addDays(
      contractual,
      approvedEot,
    );

  const currencies =
    currenciesOf(input);
  const positions:
    CommercialMoneyPosition[] =
    currencies.map((currency) => {
      const contract =
        input.contractValue &&
        input.contractValue.currency
          .trim()
          .toUpperCase() === currency
          ? input.contractValue
          : null;
      const candidates =
        (
          input.contractValueCandidates ??
          []
        ).filter(
          (row) =>
            row.currency
              .trim()
              .toUpperCase() ===
            currency,
        );
      const variations =
        input.variations.filter(
          (row) =>
            row.currency
              .trim()
              .toUpperCase() ===
            currency,
        );
      const approvedVariations =
        variations.filter(
          (row) =>
            row.state ===
            "approved",
        );
      const pendingVariations =
        variations.filter(
          (row) =>
            row.state ===
            "pending",
        );
      const invoices =
        input.invoices.filter(
          (row) =>
            row.currency
              .trim()
              .toUpperCase() ===
            currency,
        );
      const certified =
        invoices.filter(
          (row) =>
            row.certifiedAmount !==
            null,
        );
      const paid =
        invoices.filter(
          (row) =>
            row.paidAmount !==
            null,
        );
      const retained =
        input.retentions.filter(
          (row) =>
            row.currency
              .trim()
              .toUpperCase() ===
              currency &&
            row.state === "held",
        );
      const explicitAdvanceBalances =
        invoices
          .filter(
            (row) =>
              row.advanceBalance !==
                null &&
              row.advanceBalance !==
                undefined,
          )
          .sort(
            (a, b) =>
              (
                a.paymentDateIso ??
                a.certificateDateIso ??
                ""
              ).localeCompare(
                b.paymentDateIso ??
                b.certificateDateIso ??
                "",
              ),
          );
      const latestAdvanceBalance =
        explicitAdvanceBalances
          .at(-1) ??
        null;
      const activeBonds =
        input.bonds.filter(
          (row) =>
            row.currency
              .trim()
              .toUpperCase() ===
              currency &&
            row.status === "active",
        );
      const claims =
        input.claimCommercials.filter(
          (row) =>
            row.currency
              .trim()
              .toUpperCase() ===
            currency,
        );
      const claimed =
        claims.filter(
          (row) =>
            row.claimedAmount !==
            null,
        );
      const assessed =
        claims.filter(
          (row) =>
            row.assessedAmount !==
            null,
        );

      const variationRefs =
        variations.flatMap(
          (row) => row.sourceRefs,
        );
      const invoiceRefs =
        invoices.flatMap(
          (row) => row.sourceRefs,
        );
      const retentionRefs =
        retained.flatMap(
          (row) => row.sourceRefs,
        );
      const bondRefs =
        activeBonds.flatMap(
          (row) => row.sourceRefs,
        );
      const claimRefs =
        claims.flatMap(
          (row) => row.sourceRefs,
        );

      const committedState:
        CommercialEvidenceState =
        contract
          ? "established"
          : candidates.length > 0
            ? "candidate"
            : input
                .commercialEvidenceSubmitted
              ? "submitted_unparsed"
              : "not_submitted";
      const committedValue =
        contract?.amount ??
        (
          candidates.length === 1
            ? candidates[0]!
                .amount
            : null
        );
      const committedRefs =
        contract?.sourceRefs ??
        (
          candidates.length === 1
            ? candidates[0]!
                .sourceRefs
            : []
        );

      const approvedAmount =
        sum(
          approvedVariations.map(
            (row) => row.amount,
          ),
        );
      const currentContractValue =
        committedValue !== null
          ? committedValue +
            approvedAmount
          : null;
      const completePaidCoverage =
        invoices.length > 0 &&
        paid.length ===
          invoices.length;
      const grossCertified =
        certified.length > 0
          ? sum(
              certified.map(
                (row) =>
                  row.certifiedAmount!,
              ),
            )
          : null;
      const paidTotal =
        paid.length > 0
          ? sum(
              paid.map(
                (row) =>
                  row.paidAmount!,
              ),
            )
          : null;

      return {
        currency,
        committedContractValue:
          moneyMetric(
            committedValue,
            committedState,
            committedRefs,
            candidates.length > 1 &&
            !contract
              ? [
                  "CONTRACT_VALUE_CONFLICT_REQUIRES_GOVERNED_SELECTION",
                ]
              : [],
          ),
        approvedVariationAmount:
          moneyMetric(
            approvedVariations
              .length > 0
              ? approvedAmount
              : null,
            stateFor(
              approvedVariations
                .length > 0,
              input
                .variationEvidenceSubmitted,
            ),
            variationRefs,
          ),
        pendingVariationAmount:
          moneyMetric(
            pendingVariations
              .length > 0
              ? sum(
                  pendingVariations.map(
                    (row) =>
                      row.amount,
                  ),
                )
              : null,
            stateFor(
              pendingVariations
                .length > 0,
              input
                .variationEvidenceSubmitted,
            ),
            variationRefs,
          ),
        currentContractValue:
          moneyMetric(
            currentContractValue,
            currentContractValue !==
              null
              ? committedState
              : "not_submitted",
            uniq([
              ...committedRefs,
              ...approvedVariations
                .flatMap(
                  (row) =>
                    row.sourceRefs,
                ),
            ]),
            currentContractValue !==
              null
              ? []
              : [
                  "CURRENT_CONTRACT_VALUE_REQUIRES_COMMITTED_CONTRACT_VALUE",
                ],
          ),
        interimCertificateCount:
          moneyMetric(
            invoices.length > 0
              ? invoices.length
              : null,
            stateFor(
              invoices.length > 0,
              input
                .paymentEvidenceSubmitted,
            ),
            invoiceRefs,
          ),
        grossCertifiedAmount:
          moneyMetric(
            grossCertified,
            stateFor(
              certified.length > 0,
              input
                .paymentEvidenceSubmitted,
            ),
            invoiceRefs,
          ),
        paidAmount:
          moneyMetric(
            paidTotal,
            stateFor(
              paid.length > 0,
              input
                .paymentEvidenceSubmitted,
            ),
            invoiceRefs,
            invoices.length > 0 &&
            !completePaidCoverage
              ? [
                  "PAYMENT_COVERAGE_PARTIAL_CERTIFIED_UNPAID_NOT_INFERRED",
                ]
              : [],
          ),
        certifiedUnpaidAmount:
          moneyMetric(
            grossCertified !== null &&
            paidTotal !== null &&
            completePaidCoverage
              ? Math.max(
                  0,
                  grossCertified -
                    paidTotal,
                )
              : null,
            grossCertified !== null &&
            paidTotal !== null &&
            completePaidCoverage
              ? "established"
              : input
                  .paymentEvidenceSubmitted
                ? "submitted_unparsed"
                : "not_submitted",
            invoiceRefs,
            completePaidCoverage
              ? []
              : [
                  "CERTIFIED_UNPAID_REQUIRES_PAID_AMOUNT_FOR_EVERY_CERTIFICATE",
                ],
          ),
        retentionHeldAmount:
          moneyMetric(
            retained.length > 0
              ? sum(
                  retained.map(
                    (row) =>
                      row.amount,
                  ),
                )
              : null,
            stateFor(
              retained.length > 0,
              input
                .paymentEvidenceSubmitted,
            ),
            retentionRefs,
          ),
        advanceBalance:
          moneyMetric(
            latestAdvanceBalance
              ?.advanceBalance ??
              null,
            latestAdvanceBalance
              ? "established"
              : input
                  .paymentEvidenceSubmitted
                ? "submitted_unparsed"
                : "not_submitted",
            latestAdvanceBalance
              ?.sourceRefs ??
              [],
            latestAdvanceBalance
              ? [
                  "ADVANCE_BALANCE_FROM_EXPLICIT_PAYMENT_CERTIFICATE_EVIDENCE",
                ]
              : [
                  "ADVANCE_BALANCE_IS_NOT_DERIVED_FROM_ADVANCE_PAYMENT_BOND_VALUE",
                ],
          ),
        activeBondAmount:
          moneyMetric(
            activeBonds.length > 0
              ? sum(
                  activeBonds.map(
                    (row) =>
                      row.amount,
                  ),
                )
              : null,
            stateFor(
              activeBonds.length > 0,
              input
                .bondEvidenceSubmitted,
            ),
            bondRefs,
          ),
        claimedAmount:
          moneyMetric(
            claimed.length > 0
              ? sum(
                  claimed.map(
                    (row) =>
                      row.claimedAmount!,
                  ),
                )
              : null,
            stateFor(
              claimed.length > 0,
              input
                .claimEvidenceSubmitted,
            ),
            claimRefs,
          ),
        assessedClaimAmount:
          moneyMetric(
            assessed.length > 0
              ? sum(
                  assessed.map(
                    (row) =>
                      row.assessedAmount!,
                  ),
                )
              : null,
            stateFor(
              assessed.length > 0,
              input
                .claimEvidenceSubmitted,
            ),
            claimRefs,
          ),
      };
    });

  const allRefs = uniq([
    ...(
      input.contractValue
        ?.sourceRefs ??
      []
    ),
    ...(
      input.contractValueCandidates ??
      []
    ).flatMap(
      (row) => row.sourceRefs,
    ),
    ...input.variations.flatMap(
      (row) => row.sourceRefs,
    ),
    ...input.invoices.flatMap(
      (row) => row.sourceRefs,
    ),
    ...input.retentions.flatMap(
      (row) => row.sourceRefs,
    ),
    ...input.bonds.flatMap(
      (row) => row.sourceRefs,
    ),
    ...input.claimCommercials
      .flatMap(
        (row) => row.sourceRefs,
      ),
    ...timeRefs,
  ]);

  return {
    schemaVersion: "1.0",
    projectionKey:
      "commercial_control_position",
    generatedAt:
      input.generatedAt,
    projectId:
      input.projectId,
    timeExposure: {
      contractualCompletion:
        dateMetric(
          contractual,
          contractTime
            ?.contractualCompletionState ===
            "official"
            ? "established"
            : contractual
              ? "candidate"
              : input
                  .commercialEvidenceSubmitted
                ? "submitted_unparsed"
                : "not_submitted",
          timeRefs,
        ),
      approvedEotDays:
        moneyMetric(
          approvedEot,
          contractTime
            ?.officialApprovedEotState ===
            "official"
            ? "established"
            : approvedEot !== null
              ? "candidate"
              : input
                  .claimEvidenceSubmitted
                ? "submitted_unparsed"
                : "not_submitted",
          timeRefs,
        ),
      officialAdjustedCompletion:
        dateMetric(
          adjusted,
          contractual &&
          approvedEot !== null &&
          contractTime
            ?.contractualCompletionState ===
            "official" &&
          contractTime
            ?.officialApprovedEotState ===
            "official"
            ? "established"
            : adjusted
              ? "candidate"
              : "not_submitted",
          timeRefs,
          adjusted
            ? []
            : [
                "ADJUSTED_COMPLETION_REQUIRES_CONTRACTUAL_COMPLETION_AND_APPROVED_EOT",
              ],
        ),
    },
    currencies: positions,
    variationCount:
      input.variations.length,
    invoiceCount:
      input.invoices.length,
    retentionRecordCount:
      input.retentions.length,
    bondCount:
      input.bonds.length,
    claimCommercialCount:
      input
        .claimCommercials.length,
    evidence: {
      commercial:
        stateFor(
          Boolean(
            input.contractValue ||
            (
              input
                .contractValueCandidates ??
              []
            ).length ||
            input.variations.length ||
            input.invoices.length ||
            input.retentions.length ||
            input.bonds.length ||
            input
              .claimCommercials.length,
          ),
          input
            .commercialEvidenceSubmitted,
        ),
      payments:
        stateFor(
          input.invoices.length > 0 ||
            input.retentions.length >
              0,
          input
            .paymentEvidenceSubmitted,
        ),
      variations:
        stateFor(
          input.variations.length >
            0,
          input
            .variationEvidenceSubmitted,
        ),
      bonds:
        stateFor(
          input.bonds.length > 0,
          input
            .bondEvidenceSubmitted,
        ),
      claims:
        stateFor(
          input
            .claimCommercials.length >
            0,
          input
            .claimEvidenceSubmitted,
        ),
    },
    sourceRefs: allRefs,
    diagnostics: [
      "CURRENCIES_ARE_NEVER_CROSS_SUMMED_WITHOUT_A_GOVERNED_FX_BASIS",
      "MISSING_COMMERCIAL_EVIDENCE_IS_NEVER_PRESENTED_AS_ZERO",
      "CURRENT_CONTRACT_VALUE_EQUALS_COMMITTED_VALUE_PLUS_APPROVED_VARIATIONS_ONLY_WITHIN_THE_SAME_CURRENCY",
    ],
  };
}

export function buildCommercialModuleProjection(
  key:
    CommercialModuleProjection["projectionKey"],
  position: CommercialControlPosition,
): CommercialModuleProjection {
  let focus: unknown;

  if (key === "commercial_overview") {
    focus = {
      timeExposure:
        position.timeExposure,
      currencies:
        position.currencies,
      evidence:
        position.evidence,
    };
  } else if (
    key === "cost_forecast"
  ) {
    focus = {
      currencies:
        position.currencies.map(
          (row) => ({
            currency:
              row.currency,
            committedContractValue:
              row
                .committedContractValue,
            approvedVariationAmount:
              row
                .approvedVariationAmount,
            pendingVariationAmount:
              row
                .pendingVariationAmount,
            currentContractValue:
              row
                .currentContractValue,
            claimedAmount:
              row.claimedAmount,
            assessedClaimAmount:
              row
                .assessedClaimAmount,
          }),
        ),
    };
  } else if (
    key === "variations_change"
  ) {
    focus = {
      variationCount:
        position.variationCount,
      currencies:
        position.currencies.map(
          (row) => ({
            currency:
              row.currency,
            approved:
              row
                .approvedVariationAmount,
            pending:
              row
                .pendingVariationAmount,
          }),
        ),
    };
  } else if (
    key === "payments"
  ) {
    focus = {
      invoiceCount:
        position.invoiceCount,
      retentionRecordCount:
        position
          .retentionRecordCount,
      currencies:
        position.currencies.map(
          (row) => ({
            currency:
              row.currency,
            interimCertificateCount:
              row
                .interimCertificateCount,
            grossCertifiedAmount:
              row
                .grossCertifiedAmount,
            paidAmount:
              row.paidAmount,
            certifiedUnpaidAmount:
              row
                .certifiedUnpaidAmount,
            retentionHeldAmount:
              row
                .retentionHeldAmount,
            advanceBalance:
              row.advanceBalance,
          }),
        ),
    };
  } else if (
    key === "cash_flow"
  ) {
    focus = {
      currencies:
        position.currencies.map(
          (row) => ({
            currency:
              row.currency,
            certified:
              row
                .grossCertifiedAmount,
            paid:
              row.paidAmount,
            retention:
              row
                .retentionHeldAmount,
            advanceBalance:
              row.advanceBalance,
          }),
        ),
      timeSeriesState:
        "not_established",
      diagnostic:
        "CASH_FLOW_TIME_SERIES_REQUIRES_DATED_CERTIFICATE_AND_PAYMENT_TRANSACTIONS",
    };
  } else if (
    key ===
    "commercial_claims_notices"
  ) {
    focus = {
      claimCommercialCount:
        position
          .claimCommercialCount,
      timeExposure:
        position.timeExposure,
      currencies:
        position.currencies.map(
          (row) => ({
            currency:
              row.currency,
            claimed:
              row.claimedAmount,
            assessed:
              row
                .assessedClaimAmount,
          }),
        ),
    };
  } else {
    focus = {
      timeExposure:
        position.timeExposure,
      bondCount:
        position.bondCount,
      currencies:
        position.currencies.map(
          (row) => ({
            currency:
              row.currency,
            committedContractValue:
              row
                .committedContractValue,
            currentContractValue:
              row
                .currentContractValue,
            activeBondAmount:
              row.activeBondAmount,
          }),
        ),
    };
  }

  return {
    schemaVersion: "1.0",
    projectionKey: key,
    generatedAt:
      position.generatedAt,
    projectId:
      position.projectId,
    position,
    focus,
    diagnostics: [
      ...position.diagnostics,
    ],
  };
}
