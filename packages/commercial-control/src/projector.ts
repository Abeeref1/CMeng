import { buildCommercialFoundation } from "../../commercial-foundation/src";
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
  const values = new Set<string>((input.sourceLedger?.costPosition ?? []).map(p => p.currency));
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
      contractTime?.overlapResolution ? (contractTime.additionalApprovedEotDays ?? null) : approvedEot,
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

  // A source summary is not a commitment ledger. Reuse explicit period/currency facts
  // without adding variation values twice or conflating net certification and cash receipts.
  if(input.sourceLedger){
    const ledger=input.sourceLedger;
    for(const position of positions){
      const reported=ledger.costPosition.filter(p=>p.currency===position.currency&&p.state!=="candidate");
      const latest=reported.map(p=>p.asOf).sort().at(-1);
      const applicable=reported.filter(p=>p.asOf===latest);
      if(applicable.length===1){
        const source=applicable[0]!;
        const refs=source.receipts.map(r=>"evidence-document:"+r.documentId+":"+r.locator);
        const metric=(name:string)=>moneyMetric(source.values[name]??null,source.values[name]==null?"submitted_unparsed":"established",refs,["EXPLICIT_SOURCE_SNAPSHOT_NOT_RECALCULATED_FROM_VARIATIONS"]);
        if("original contract value" in source.values)position.committedContractValue=metric("original contract value");
        if("current contract value" in source.values)position.currentContractValue=metric("current contract value");
        if("approved variations" in source.values)position.approvedVariationAmount=metric("approved variations");
      }else if(applicable.length>1){
        position.currentContractValue=moneyMetric(null,"submitted_unparsed",[],["MIXED_TAX_BASES_USE_PARTITIONED_SOURCE_LEDGER"]);
      }
      const payments=ledger.payments.filter(p=>p.amounts.netCertifiedAmount.currency===position.currency);
      if(payments.length){
        const refs=payments.flatMap(p=>p.amounts.netCertifiedAmount.receipts.map(r=>"evidence-document:"+r.documentId+":"+r.locator));
        const unestablished=(reason:string)=>moneyMetric(null,"submitted_unparsed",refs,[reason]);
        position.grossCertifiedAmount=unestablished("NET_CERTIFICATE_IS_NOT_GROSS_CERTIFICATION");
        position.netCertifiedAmount=unestablished("INCREMENTAL_VERSUS_CUMULATIVE_BASIS_REQUIRED_FOR_AGGREGATION");
        position.paidAmount=unestablished("DATED_PAYMENT_RECEIPT_AND_ALLOCATION_REQUIRED");
        position.certifiedUnpaidAmount=unestablished("UNKNOWN_PAID_AMOUNT_IS_NOT_ZERO");
        position.retentionHeldAmount=unestablished("RETENTION_DEDUCTION_IS_NOT_A_RECONCILED_HELD_BALANCE");
      }
    }
  }

  const foundation =
    input.foundation ??
    buildCommercialFoundation({
      projectId:
        input.projectId,
      generatedAt:
        input.generatedAt,
      dataDateIso:
        input.sourceLedger
          ?.dataDateIso ??
        null,
      contractValue:
        input.contractValue
          ? {
              amount:
                input
                  .contractValue
                  .amount,
              currency:
                input
                  .contractValue
                  .currency
                  .trim()
                  .toUpperCase(),
              sourceRefs: [
                ...input
                  .contractValue
                  .sourceRefs,
              ],
              authority:
                "approved",
            }
          : null,
      contractValueCandidates:
        (
          input
            .contractValueCandidates ??
          []
        ).map(
          (candidate) => ({
            amount:
              candidate.amount,
            currency:
              candidate.currency
                .trim()
                .toUpperCase(),
            sourceRefs: [
              ...candidate
                .sourceRefs,
            ],
            authority:
              "candidate",
          }),
        ),
      variations:
        input.variations.map(
          (variation) => ({
            variationId:
              variation
                .variationId,
            state:
              variation.state,
            amount:
              variation.amount,
            currency:
              variation.currency
                .trim()
                .toUpperCase(),
            sourceRefs: [
              ...variation
                .sourceRefs,
            ],
          }),
        ),
      contractTimeBasis:
        input.contractTimeBasis
          ? {
              contractualCompletionIso:
                input
                  .contractTimeBasis
                  .contractualCompletionIso,
              contractualCompletionState:
                input
                  .contractTimeBasis
                  .contractualCompletionState,
              sourceRefs: [
                ...input
                  .contractTimeBasis
                  .sourceRefs,
              ],
            }
          : null,
      ldTerms: null,
      contractSections: [],
      amendments: [],
      costMetrics:
        input.sourceLedger
          ?.costMetrics.map(
            (row) => ({
              metric:
                row.metric,
              amount: {
                value:
                  row.amount
                    .value,
                currency:
                  row.amount
                    .currency,
                taxBasis:
                  row.amount
                    .taxBasis,
                amountBasis:
                  row.amount
                    .amountBasis,
                state:
                  row.amount
                    .state,
                asOf:
                  row.amount
                    .asOf,
                sourceRefs:
                  row.amount
                    .receipts
                    .map(
                      (receipt) =>
                        "evidence-document:" +
                        receipt
                          .documentId +
                        ":" +
                        receipt
                          .locator,
                    ),
              },
              sourceStatus:
                row.sourceStatus,
              cbsId:
                row.cbsId,
              cbsDescription:
                row.cbsDescription,
              parentCbsId:
                row.parentCbsId,
              wbsId:
                row.wbsId,
              counterparty:
                row.counterparty,
              boqItemId:
                row.boqItemId,
              paymentId:
                row.paymentId,
            }),
          ) ?? [],
      payments:
        input.sourceLedger
          ?.payments.map(
            (row) => ({
              paymentId:
                row.paymentId,
              paymentType:
                row.paymentType,
              periodEnd:
                row.periodEnd,
              sourceStatus:
                row.sourceStatus,
              applicationDate:
                row.applicationDate,
              assessmentDate:
                row.assessmentDate,
              certificationDate:
                row.certificationDate,
              certificationDueDate:
                row
                  .certificationDueDate,
              paymentDueDate:
                row.paymentDueDate,
              paymentDate:
                row.paymentDate,
              paymentTimestamp:
                row
                  .paymentTimestamp,
              retentionReleaseDate:
                row
                  .retentionReleaseDate,
              finalReceiptDate:
                row
                  .finalReceiptDate,
              paymentReference:
                row
                  .paymentReference,
              amounts:
                Object.fromEntries(
                  Object.entries(
                    row.amounts,
                  ).map(
                    ([
                      key,
                      money,
                    ]) => [
                      key,
                      {
                        value:
                          money.value,
                        currency:
                          money
                            .currency,
                        taxBasis:
                          money
                            .taxBasis,
                        amountBasis:
                          money
                            .amountBasis,
                        state:
                          money.state,
                        asOf:
                          money.asOf,
                        sourceRefs:
                          money
                            .receipts
                            .map(
                              (
                                receipt,
                              ) =>
                                "evidence-document:" +
                                receipt
                                  .documentId +
                                ":" +
                                receipt
                                  .locator,
                            ),
                      },
                    ],
                  ),
                ),
              calculatedOutstandingAmount:
                {
                  value:
                    row
                      .calculatedOutstandingAmount
                      .value,
                  currency:
                    row
                      .calculatedOutstandingAmount
                      .currency,
                  taxBasis:
                    row
                      .calculatedOutstandingAmount
                      .taxBasis,
                  amountBasis:
                    row
                      .calculatedOutstandingAmount
                      .amountBasis,
                  state:
                    row
                      .calculatedOutstandingAmount
                      .state,
                  asOf:
                    row
                      .calculatedOutstandingAmount
                      .asOf,
                  sourceRefs:
                    row
                      .calculatedOutstandingAmount
                      .receipts
                      .map(
                        (
                          receipt,
                        ) =>
                          "evidence-document:" +
                          receipt
                            .documentId +
                          ":" +
                          receipt
                            .locator,
                      ),
                },
              reconciliation:
                row.reconciliation,
              diagnostics: [
                ...row
                  .diagnostics,
              ],
              sourceRefs: [
                "evidence-document:" +
                  row.receipt
                    .documentId +
                  ":" +
                  row.receipt
                    .locator,
              ],
            }),
          ) ?? [],
    });

  return {
    ...(input.sourceLedger ? {sourceLedger: input.sourceLedger} : {}),
    foundation,
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
    registers: {
      variations:
        input.variations.map(
          (row) => ({
            ...row,
            sourceRefs: [
              ...row.sourceRefs,
            ],
          }),
        ),
      invoices:
        input.invoices.map(
          (row) => ({
            ...row,
            sourceRefs: [
              ...row.sourceRefs,
            ],
          }),
        ),
      retentions:
        input.retentions.map(
          (row) => ({
            ...row,
            sourceRefs: [
              ...row.sourceRefs,
            ],
          }),
        ),
      bonds:
        input.bonds.map(
          (row) => ({
            ...row,
            sourceRefs: [
              ...row.sourceRefs,
            ],
          }),
        ),
      claims:
        input.claimCommercials.map(
          (row) => ({
            ...row,
            sourceRefs: [
              ...row.sourceRefs,
            ],
          }),
        ),
    },
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
              .claimCommercials.length ||
            (
              input.sourceLedger &&
              (
                input.sourceLedger
                  .costMetrics.length >
                  0 ||
                input.sourceLedger
                  .costPosition.length >
                  0 ||
                input.sourceLedger
                  .payments.length >
                  0 ||
                input.sourceLedger
                  .variations.length >
                  0
              )
            )
          ),
          input
            .commercialEvidenceSubmitted,
        ),
      payments:
        stateFor(
          input.invoices.length > 0 ||
            input.retentions.length >
              0 ||
            (
              input.sourceLedger
                ?.payments.length ??
              0
            ) >
              0,
          input
            .paymentEvidenceSubmitted,
        ),
      variations:
        stateFor(
          input.variations.length >
            0 ||
            (
              input.sourceLedger
                ?.variations.length ??
              0
            ) >
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
      commercialTerms:
        position.foundation
          .commercialTerms,
      costRegisterSummary: {
        state:
          position.foundation
            .costRegister.state,
        recordCount:
          position.foundation
            .costRegister
            .recordCount,
        mappingCoveragePercent:
          position.foundation
            .costRegister
            .mappingCoveragePercent,
      },
      paymentRegisterSummary: {
        state:
          position.foundation
            .paymentRegister.state,
        recordCount:
          position.foundation
            .paymentRegister
            .recordCount,
        stageCoveragePercent:
          position.foundation
            .paymentRegister
            .stageCoveragePercent,
      },
      cbsBreakdownSummary: {
        state:
          position.foundation
            .cbsBreakdown.state,
        nodeCount:
          position.foundation
            .cbsBreakdown
            .nodeCount,
        mappingCoveragePercent:
          position.foundation
            .cbsBreakdown
            .mappingCoveragePercent,
      },
    };
  } else if (
    key === "cost_forecast"
  ) {
    focus = {
      costRegister:
        position.foundation
          .costRegister,
      cbsBreakdown:
        position.foundation
          .cbsBreakdown,
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
      paymentRegister:
        position.foundation
          .paymentRegister,
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
    const datedTransactions =
      position.registers.invoices
        .filter(
          (row) =>
            Boolean(
              row.certificateDateIso ||
              row.paymentDateIso,
            ),
        )
        .map((row) => ({
          invoiceId:
            row.invoiceId,
          currency:
            row.currency,
          certificateDateIso:
            row.certificateDateIso ??
            null,
          paymentDateIso:
            row.paymentDateIso ??
            null,
          certifiedAmount:
            row.certifiedAmount,
          paidAmount:
            row.paidAmount,
          retentionAmount:
            row.retentionAmount ??
            null,
          advanceRecoveryAmount:
            row.advanceRecoveryAmount ??
            null,
          advanceBalance:
            row.advanceBalance ??
            null,
          sourceRefs: [
            ...row.sourceRefs,
          ],
        }));
    focus = {
      paymentRegister:
        position.foundation
          .paymentRegister,
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
      transactions:
        datedTransactions,
      timeSeriesState:
        datedTransactions.length > 0
          ? "established"
          : "not_established",
      diagnostic:
        datedTransactions.length > 0
          ? "CASH_FLOW_TIME_SERIES_USES_EXPLICIT_CERTIFICATE_AND_PAYMENT_DATES"
          : "CASH_FLOW_TIME_SERIES_REQUIRES_DATED_CERTIFICATE_AND_PAYMENT_TRANSACTIONS",
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
      commercialTerms:
        position.foundation
          .commercialTerms,
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
