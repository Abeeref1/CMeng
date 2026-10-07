import { reportingScope } from "../../truth-kernel/src";
import { buildCommercialFoundation } from "../../commercial-foundation/src";
import { buildCommercialPerformance } from "../../commercial-performance/src";
import {
  assessAllEventNotices,
} from "../../delay-analysis-core/src";
import type {
  CommercialClaimsNoticesPosition,
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

type SourceAvailability = {submitted: boolean; read: boolean};

function sourceAvailability(input: CommercialControlInput) {
  const read = {
    commercial: Boolean(input.contractValue || input.contractValueCandidates?.length || input.contractTimeBasis || input.sourceLedger?.costMetrics.length || input.sourceLedger?.costPosition.length),
    payments: Boolean(input.invoices.length || input.retentions.length || input.sourceLedger?.payments.length),
    variations: Boolean(input.variations.length || input.sourceLedger?.variations.length),
    bonds: input.bonds.length > 0,
    claims: Boolean(input.claimCommercials.length || input.delayClaims || input.sourceDelayClaims),
  };
  return Object.fromEntries(Object.entries(read).map(([key, recordsRead]) => {
    const domain = key as keyof typeof read;
    const submitted = {commercial: input.commercialEvidenceSubmitted, payments: input.paymentEvidenceSubmitted, variations: input.variationEvidenceSubmitted, bonds: input.bondEvidenceSubmitted, claims: input.claimEvidenceSubmitted}[domain];
    return [domain, {submitted, read: recordsRead || input.sourceRead?.[domain] === true}];
  })) as Record<keyof typeof read, SourceAvailability>;
}

function stateFor(hasValue: boolean, source: SourceAvailability): CommercialEvidenceState {
  if (hasValue) return "established";
  if (source.read) return "missing_information";
  return source.submitted ? "submitted_unparsed" : "not_submitted";
}

function explainMissingInformation<T>(metric: CommercialMetric<T>, consequence: string, action: string): void {
  if (metric.state !== "missing_information") return;
  metric.consequence = consequence;
  metric.action = action;
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

function delayEvidenceRef(
  ref: {
    sourceType: string;
    sourceId: string;
    locator: string | null;
  },
): string {
  return [
    ref.sourceType,
    ref.sourceId,
    ref.locator,
  ]
    .filter(
      (value) =>
        Boolean(value),
    )
    .join(":");
}

function commercialClaimsNotices(
  input: CommercialControlInput,
): CommercialClaimsNoticesPosition {
  const sources = sourceAvailability(input);
  const lifecycle =
    input.delayClaims ?? null;
  const sourceLifecycle=input.sourceDelayClaims??lifecycle;
  const hasLifecycle =
    Boolean(
      lifecycle &&
      (
        lifecycle.events.length > 0 ||
        lifecycle.notices.length > 0 ||
        lifecycle.claims.length > 0
      ),
    );
  const commercialIds =
    new Set(
      input.claimCommercials.map(
        (row) => row.claimId,
      ),
    );
  const lifecycleIds =
    new Set(
      lifecycle?.claims.map(
        (row) => row.claimId,
      ) ?? [],
    );
  const linkedCommercialCount =
    input.claimCommercials.filter(
      (row) =>
        lifecycleIds.has(
          row.claimId,
        ),
    ).length;
  const linkCoverage =
    input.claimCommercials.length
      ? Number(
          (
            (
              linkedCommercialCount /
              input.claimCommercials.length
            ) *
            100
          ).toFixed(6),
        )
      : null;

  const claimStateCounts:
    CommercialClaimsNoticesPosition["claimStateCounts"] = {
      draft: 0,
      submitted: 0,
      under_review: 0,
      determined: 0,
      rejected: 0,
      withdrawn: 0,
      unknown: 0,
    };
  for (
    const claim of
      lifecycle?.claims ?? []
  ) {
    claimStateCounts[
      claim.state
    ] += 1;
  }

  const noticeKindCounts:
    CommercialClaimsNoticesPosition["noticeKindCounts"] = {
      notice: 0,
      early_warning: 0,
      eot_notice: 0,
      claim_notice: 0,
      detailed_claim: 0,
      response: 0,
      determination: 0,
    };
  for (
    const notice of
      lifecycle?.notices ?? []
  ) {
    noticeKindCounts[
      notice.kind
    ] += 1;
  }

  const assessments =
    lifecycle
      ? assessAllEventNotices(
          lifecycle,
        )
      : [];
  const noticeTimelinessCounts:
    CommercialClaimsNoticesPosition["noticeTimelinessCounts"] = {
      timely: 0,
      late: 0,
      not_issued: 0,
      requirement_missing: 0,
      requirement_conflicted: 0,
      event_date_missing: 0,
      notice_date_missing: 0,
    };
  for (
    const assessment of
      assessments
  ) {
    noticeTimelinessCounts[
      assessment.timeliness
    ] = (noticeTimelinessCounts[assessment.timeliness] ?? 0) + 1;
  }
  const lifecycleQuarantined = lifecycle?.integrity?.state === "quarantined";
  if(!lifecycle || lifecycleQuarantined)for(const key of Object.keys(noticeTimelinessCounts) as Array<keyof typeof noticeTimelinessCounts>)noticeTimelinessCounts[key]=null;

  const eventTitles =
    new Map(
      (
        lifecycle?.events ??
        []
      ).map(
        (event) => [
          event.eventId,
          event.title,
        ],
      ),
    );

  const diagnostics = [
    "COMMERCIAL_CLAIM_MONEY_AND_CLAIM_LIFECYCLE_LINK_BY_CLAIM_ID_ONLY",
    "NOTICE_TIMELINESS_REUSES_GOVERNED_DELAY_CLAIMS_REQUIREMENTS_AND_ACTUAL_DATES",
  ];
  if (
    input.claimCommercials
      .some(
        (row) =>
          !lifecycleIds.has(
            row.claimId,
          ),
      )
  ) {
    diagnostics.push(
      "COMMERCIAL_CLAIM_ROWS_WITHOUT_LIFECYCLE_LINK_REMAIN_VISIBLE_AND_UNMERGED",
    );
  }
  if (
    lifecycle?.claims.some(
      (row) =>
        !commercialIds.has(
          row.claimId,
        ),
    )
  ) {
    diagnostics.push(
      "LIFECYCLE_CLAIMS_WITHOUT_COMMERCIAL_MONEY_REMAIN_VISIBLE_WITH_MONEY_UNKNOWN",
    );
  }

  if(lifecycleQuarantined){
    diagnostics.push("CLAIM_POPULATION_QUARANTINED_SOURCE_RETAINED_COUNTS_WITHHELD");
  }

  return {
    state:
      lifecycleQuarantined
        ? "missing_information"
        : hasLifecycle
          ? "established"
          : stateFor(false, sources.claims),
    asOfNoticeCount:(lifecycle?.notices??[]).filter(n=>n.kind!=='determination'&&reportingScope(n.actualIssuedAt,input.sourceLedger?.dataDateIso??lifecycle?.dataDateIso)==='as_of').length,
    sourceNoticeCount:(sourceLifecycle?.notices??[]).filter(n=>n.kind!=='determination').length,
    futureNoticeCount:(sourceLifecycle?.notices??[]).filter(n=>n.kind!=='determination'&&reportingScope(n.actualIssuedAt,input.sourceLedger?.dataDateIso??lifecycle?.dataDateIso)==='future').length,
    undatedNoticeCount:(sourceLifecycle?.notices??[]).filter(n=>n.kind!=='determination'&&reportingScope(n.actualIssuedAt,input.sourceLedger?.dataDateIso??lifecycle?.dataDateIso)==='undated').length,
    dimensionalEvidenceGaps:lifecycleQuarantined
      ? {requirementMissing:null,eventDateMissing:null,noticeDateMissing:null}
      : {requirementMissing:assessments.filter(a=>a.evidenceGaps.requirementMissing).length,eventDateMissing:assessments.filter(a=>a.evidenceGaps.eventDateMissing).length,noticeDateMissing:assessments.filter(a=>a.evidenceGaps.noticeDateMissing).length},
    evidenceRevisionId:
      lifecycle
        ?.evidenceRevisionId ??
      null,
    eventCount:
      lifecycle?.events.length ??
      0,
    noticeCount:
      lifecycle?.notices.filter(notice=>notice.kind!=="determination").length ??
      0,
    lifecycleClaimCount:
      lifecycle?.claims.length ??
      0,
    commercialClaimCount:
      input.claimCommercials
        .length,
    commercialLifecycleLinkCoveragePercent:
      linkCoverage,
    claimStateCounts,
    noticeKindCounts,
    noticeTimelinessCounts,
    claims:
      (
        lifecycle?.claims ??
        []
      ).map(
        (claim) => ({
          ...(claim.sourceRegister?{sourceRegister:claim.sourceRegister}:{}),
          claimId:
            claim.claimId,
          title:
            claim.title,
          state:
            claim.state,
          submittedAt:
            claim.submittedAt,
          claimedDays:
            claim.claimedDays,
          claimedAmount:
            claim.claimedAmount,
          assessedDays:
            claim.assessedDays,
          assessedDaysState:
            claim
              .assessedDaysState,
          assessedAmount:
            claim.assessedAmount,
          assessedAmountState:
            claim
              .assessedAmountState,
          eventIds: [
            ...claim.eventIds,
          ],
          clauseIdentifiers: [
            ...claim
              .clauseIdentifiers,
          ],
          sourceRefs:
            claim.evidenceRefs.map(
              delayEvidenceRef,
            ),
        }),
      ),
    notices:
      (
        lifecycle?.notices ??
        []
      ).map(
        (notice) => ({
          noticeId:
            notice.noticeId,
          kind:
            notice.kind,
          eventId:
            notice.eventId,
          claimId:
            notice.claimId,
          actualIssuedAt:
            notice.actualIssuedAt,
          actualReceivedAt:
            notice.actualReceivedAt,
          subject:
            notice.subject,
          clauseIdentifiers: [
            ...notice
              .clauseIdentifiers,
          ],
          sourceRefs:
            notice.evidenceRefs.map(
              delayEvidenceRef,
            ),
        }),
      ),
    noticeAssessments:
      assessments.map(
        (assessment) => ({
          eventId:
            assessment.eventId,
          eventTitle:
            eventTitles.get(
              assessment.eventId,
            ) ?? null,
          requirementId:
            assessment
              .requirementId,
          requiredNoticeDays:
            assessment
              .requiredNoticeDays,
          eventStartIso:
            assessment
              .eventStartIso,
          noticeId:
            assessment.noticeId,
          noticeIssuedAt:
            assessment
              .noticeIssuedAt,
          elapsedDays:
            assessment
              .elapsedDays,
          timeliness:
            assessment.timeliness,
          requirementState:
            assessment
              .requirementState,
        }),
      ),
    diagnostics,
  };
}

function currenciesOf(
  input: CommercialControlInput,
): string[] {
  const values = new Set<string>([
    ...(input.sourceLedger?.costPosition ?? []).map(p => p.currency),
    ...(input.sourceLedger?.payments ?? []).map(p => p.amounts.netCertifiedAmount.currency),
    ...(input.sourceLedger?.variations ?? []).map(p => p.approvedAmount.currency),
  ].filter((v):v is string=>Boolean(v)));
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
  const sources = sourceAvailability(input);
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
    contractTime?.eotDayBasis === "calendar_days" ? addDays(
      contractual,
      contractTime?.overlapResolution ? (contractTime.additionalApprovedEotDays ?? null) : approvedEot,
    ) : null;

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
      const variationPopulation=input.contractControls?.variations;
      const noPendingInRegister=!!variationPopulation&&variationPopulation.sourceRecordCount>0&&variationPopulation.pendingCount===0&&variationPopulation.undatedRecordCount===0&&variationPopulation.unknownAsOfStageCount===0;
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
      const sourcePaymentRows =
        input.sourceLedger
          ?.payments.filter(
            (row) =>
              row.amounts
                .retentionDeduction
                .currency ===
              currency && reportingScope(row.periodEnd,input.sourceLedger?.dataDateIso)==='as_of',
          ) ?? [];
      const sourceRetentionDeductions =
        sourcePaymentRows.filter(
          (row) =>
            row.amounts
              .retentionDeduction
              .value !== null,
        );
      const retentionDeductedRefs =
        sourceRetentionDeductions
          .flatMap(
            (row) =>
              row.amounts
                .retentionDeduction
                .receipts.map(
                  (receipt) =>
                    "evidence-document:" +
                    receipt.documentId +
                    ":" +
                    receipt.locator,
                ),
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
            row.status === "active" &&
            (
              !(input.sourceLedger?.dataDateIso ?? input.foundation?.dataDateIso) ||
              !row.expiryIso ||
              row.expiryIso.slice(0,10) >= (input.sourceLedger?.dataDateIso ?? input.foundation?.dataDateIso)!.slice(0,10)
            ),
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
      const completeClaimedCoverage =
        claims.length > 0 &&
        claimed.length ===
          claims.length;
      const completeAssessedCoverage =
        claims.length > 0 &&
        assessed.length ===
          claims.length;

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
            : stateFor(false, sources.commercial);
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
      const advancePercent=input.foundation?.commercialTerms.advancePaymentPercent;
      const certifiedAdvanceRows=(input.sourceLedger?.payments??[]).filter(row=>
        row.amounts.advanceRecovery.currency===currency &&
        reportingScope(row.certificationDate,input.sourceLedger?.dataDateIso)==='as_of'
      );
      const advanceRecoveryKnown=certifiedAdvanceRows.length>0&&certifiedAdvanceRows.every(row=>row.amounts.advanceRecovery.value!==null);
      const advanceRecoveredTotal=advanceRecoveryKnown
        ?sum(certifiedAdvanceRows.map(row=>row.amounts.advanceRecovery.value!))
        :null;
      const derivedAdvanceBalance=
        committedValue!==null&&advancePercent?.value!==null&&advancePercent?.value!==undefined&&advanceRecoveredTotal!==null
          ?Math.max(0,Number((committedValue*advancePercent.value/100-advanceRecoveredTotal).toFixed(8)))
          :null;
      const derivedAdvanceRefs=uniq([
        ...(advancePercent?.basis.sourceRefs??[]),
        ...certifiedAdvanceRows.flatMap(row=>row.amounts.advanceRecovery.receipts.map(receipt=>"evidence-document:"+receipt.documentId+":"+receipt.locator)),
      ]);
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
      const retentionDeductedTotal =
        sourceRetentionDeductions.length > 0
          ? sum(sourceRetentionDeductions.map(row=>row.amounts.retentionDeduction.value!))
          : null;
      const retentionHeldTotal =
        retained.length > 0
          ? sum(retained.map(row=>row.amount))
          : null;

      return {
        currency,
        originalContractValue:
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
              sources.variations,
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
              : noPendingInRegister?0:null,
            stateFor(
              pendingVariations
                .length > 0||noPendingInRegister,
              sources.variations,
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
              sources.payments,
            ),
            invoiceRefs,
          ),
        grossCertifiedAmount:
          moneyMetric(
            grossCertified,
            stateFor(
              certified.length > 0,
              sources.payments,
            ),
            invoiceRefs,
          ),
        paidAmount:
          moneyMetric(
            paidTotal,
            stateFor(
              paid.length > 0,
              sources.payments,
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
              : stateFor(false, sources.payments),
            invoiceRefs,
            completePaidCoverage
              ? []
              : [
                  "CERTIFIED_UNPAID_REQUIRES_PAID_AMOUNT_FOR_EVERY_CERTIFICATE",
                ],
          ),
        retentionDeductedAmount:
          moneyMetric(
            retentionDeductedTotal,
            sourceRetentionDeductions.length > 0 &&
            sourceRetentionDeductions.length ===
              sourcePaymentRows.length
              ? "established"
              : stateFor(false, sources.payments),
            retentionDeductedRefs,
            sourcePaymentRows.length > 0 &&
            sourceRetentionDeductions.length !==
              sourcePaymentRows.length
              ? [
                  "RETENTION_DEDUCTION_COVERAGE_PARTIAL",
                ]
              : [
                  "RETENTION_DEDUCTION_IS_NOT_CURRENT_HELD_BALANCE",
                ],
          ),
        retentionHeldAmount:
          moneyMetric(
            retentionHeldTotal,
            stateFor(
              retained.length > 0,
              sources.payments,
            ),
            retentionRefs,
            retentionHeldTotal !== null
              ? [
                  "RETENTION_HELD_BALANCE_FROM_EXPLICIT_SOURCE_REGISTER",
                  ...(retentionDeductedTotal !== null &&
                     Math.abs(retentionHeldTotal-retentionDeductedTotal) > 0.01
                    ? ["RETENTION_HELD_BALANCE_DIFFERS_FROM_CERTIFICATE_DEDUCTIONS_RECONCILE"]
                    : []),
                ]
              : [],
          ),
        advanceBalance:
          moneyMetric(
            latestAdvanceBalance?.advanceBalance ?? derivedAdvanceBalance,
            latestAdvanceBalance
              ? "established"
              : derivedAdvanceBalance!==null
                ? advancePercent?.state==="established" ? "established" : "candidate"
                : stateFor(false, sources.payments),
            latestAdvanceBalance?.sourceRefs ?? derivedAdvanceRefs,
            latestAdvanceBalance
              ? [
                  "ADVANCE_BALANCE_FROM_EXPLICIT_PAYMENT_CERTIFICATE_EVIDENCE",
                ]
              : derivedAdvanceBalance!==null
                ? [
                    "ADVANCE_BALANCE_FROM_CONTRACT_ADVANCE_PERCENT_LESS_CERTIFIED_RECOVERIES",
                  ]
                : [
                    "ADVANCE_BALANCE_REQUIRES_CONTRACT_ADVANCE_AND_CERTIFIED_RECOVERIES",
                    "ADVANCE_BALANCE_IS_NOT_DERIVED_FROM_ADVANCE_PAYMENT_BOND_VALUE",
                  ],
          ),
        activeBondAmount:
          moneyMetric(
            activeBonds.length > 0 && activeBonds.every(row=>row.amount!==null)
              ? sum(
                  activeBonds.map(
                    (row) =>
                      row.amount!,
                  ),
                )
              : null,
            stateFor(
              activeBonds.length > 0 && activeBonds.every(row=>row.amount!==null),
              sources.bonds,
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
            completeClaimedCoverage
              ? "established"
              : stateFor(false, sources.claims),
            claimRefs,
            claims.length > 0 &&
            !completeClaimedCoverage
              ? [
                  "CLAIMED_AMOUNT_COVERAGE_PARTIAL_MISSING_AMOUNTS_ARE_NOT_ZERO",
                ]
              : [],
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
            completeAssessedCoverage
              ? "established"
              : stateFor(false, sources.claims),
            claimRefs,
            claims.length > 0 &&
            !completeAssessedCoverage
              ? [
                  "ASSESSED_CLAIM_AMOUNT_COVERAGE_PARTIAL_MISSING_AMOUNTS_ARE_NOT_ZERO",
                ]
              : [],
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
    ...(
      input.delayClaims
        ? [
            ...input.delayClaims.events
              .flatMap(
                (row) =>
                  row.evidenceRefs,
              ),
            ...input.delayClaims.notices
              .flatMap(
                (row) =>
                  row.evidenceRefs,
              ),
            ...input.delayClaims.claims
              .flatMap(
                (row) =>
                  row.evidenceRefs,
              ),
            ...input.delayClaims.noticeRequirements
              .flatMap(
                (row) =>
                  row.evidenceRefs,
              ),
          ].map(
            delayEvidenceRef,
          )
        : []
    ),
    ...timeRefs,
  ]);

  // A source summary is not a commitment ledger. Reuse explicit period/currency facts
  // without adding variation values twice or conflating net certification and cash receipts.
  if(input.sourceLedger){
    const ledger=input.sourceLedger;
    for(const position of positions){
      const reported=ledger.costPosition.filter(p=>p.currency===position.currency&&p.state!=="candidate"&&reportingScope(p.asOf,ledger.dataDateIso)==='as_of');
      const latest=reported.map(p=>p.asOf).sort().at(-1);
      const applicable=reported.filter(p=>p.asOf===latest);
      if(applicable.length===1){
        const source=applicable[0]!;
        const refs=source.receipts.map(r=>"evidence-document:"+r.documentId+":"+r.locator);
        const metric=(name:string)=>moneyMetric(source.values[name]??null,source.values[name]==null?"missing_information":source.diagnostics.some(d=>/CONFLICT|UNRESOLVED/.test(d))?"candidate":"established",refs,["EXPLICIT_SOURCE_SNAPSHOT_NOT_RECALCULATED_FROM_VARIATIONS",...source.diagnostics]);
        if("original contract value" in source.values)position.originalContractValue=metric("original contract value");
        if("current contract value" in source.values)position.currentContractValue=metric("current contract value");
        if("approved variations" in source.values)position.approvedVariationAmount=metric("approved variations");
      }else if(applicable.length>1){
        position.currentContractValue=moneyMetric(null,"candidate",[],["MIXED_TAX_BASES_USE_PARTITIONED_SOURCE_LEDGER"]);
      }
      const payments=ledger.payments.filter(p=>p.amounts.netCertifiedAmount.currency===position.currency);
      if(payments.length){
        const refs=payments.flatMap(p=>p.amounts.netCertifiedAmount.receipts.map(r=>"evidence-document:"+r.documentId+":"+r.locator));
        const periods=payments.filter(p=>reportingScope(p.periodEnd,ledger.dataDateIso)==='as_of');
        position.sourceCertificatePeriodCount={...moneyMetric(periods.length,"established",refs,["SOURCE_CERTIFICATE_PERIOD_COUNT_NOT_DATED_CERTIFICATION_COUNT"]),consequence:"Source certificate periods through Data Date; certification dates checked separately."};
        const unestablished=(reason:string)=>moneyMetric(null,"missing_information",refs,[reason]);
        const certified=payments.filter(p=>reportingScope(p.certificationDate,ledger.dataDateIso)==='as_of');
        const explicitlyNotCertified=(p:typeof payments[number])=>/appl(?:ied|ication)?|submitted|draft|pending|under review/i.test(p.sourceStatus??'');
        const undatedCertification=payments.some(p=>!p.certificationDate&&reportingScope(p.periodEnd,ledger.dataDateIso)!=='future'&&!explicitlyNotCertified(p));
        const compatible=certified.length>0&&!undatedCertification&&new Set(certified.map(p=>p.paymentId)).size===certified.length&&certified.every(p=>p.certifiedAmountBasis==='incremental');
        const total=(fields:Array<'grossWork'|'variations'|'netCertifiedAmount'>)=>{
          const amounts=certified.flatMap(p=>fields.map(f=>p.amounts[f]));
          const known=compatible&&amounts.every(a=>a.value!==null&&a.currency===position.currency&&a.taxBasis!=='unknown'&&a.state==='official')&&new Set(amounts.map(a=>a.taxBasis)).size===1;
          return known?moneyMetric(Number(amounts.reduce((n,a)=>n+a.value!,0).toFixed(8)),"established",refs):unestablished("DATED_INCREMENTAL_CERTIFICATES_WITH_COMPATIBLE_AMOUNTS_REQUIRED");
        };
        const sourceGrossCertified=total(['grossWork','variations']);
        const sourceNetCertified=total(['netCertifiedAmount']);
        const sourceCertificateCount=compatible?moneyMetric(certified.length,"established",refs):unestablished("DATED_INTERIM_CERTIFICATION_COUNT_REQUIRED");
        // Source registers can supplement a governed control position, but a
        // weaker/missing source interpretation must never erase a value that was
        // explicitly governed through the control layer.
        if(sourceGrossCertified.value!==null){
          const legacy=position.grossCertifiedAmount.value;
          position.grossCertifiedAmount={...sourceGrossCertified,diagnostics:[
            ...sourceGrossCertified.diagnostics,
            ...(legacy!==null&&Math.abs(legacy-sourceGrossCertified.value)>1e-8?["LEGACY_CERTIFIED_FIELD_WAS_NET_OR_DIFFERENT_FROM_CANONICAL_GROSS"]:[])
          ]};
        }
        if(sourceNetCertified.value!==null){
          const legacy=position.netCertifiedAmount?.value??null;
          position.netCertifiedAmount={...sourceNetCertified,diagnostics:[
            ...sourceNetCertified.diagnostics,
            ...(legacy!==null&&Math.abs(legacy-sourceNetCertified.value)>1e-8?["LEGACY_NET_CERTIFIED_DIFFERS_FROM_CANONICAL_NET"]:[])
          ]};
        }
        if(sourceCertificateCount.value!==null)position.interimCertificateCount=sourceCertificateCount;
        if(position.paidAmount.value===null)position.paidAmount=unestablished("DATED_PAYMENT_RECEIPT_AND_ALLOCATION_REQUIRED");
        if(position.certifiedUnpaidAmount.value===null)position.certifiedUnpaidAmount=unestablished("UNKNOWN_PAID_AMOUNT_IS_NOT_ZERO");
        if(position.retentionHeldAmount.value===null){
          position.retentionHeldAmount=unestablished("RETENTION_DEDUCTION_IS_NOT_A_RECONCILED_HELD_BALANCE");
        }
      }
    }
  }

  // A parsed register without the requested field is different from unread evidence.
  // Apply the distinction once so pages, reports and issue ownership agree.
  for(const position of positions){
    explainMissingInformation(position.approvedVariationAmount,"Approved amount not supported for this currency and cutoff.","Review the approved variation amounts, currency and effective dates in the supplied register.");
    explainMissingInformation(position.pendingVariationAmount,"Pending-variation amount not in the current data.","Confirm the pending variation register and supply its dated amounts; an empty subset is not proof of zero exposure.");
    explainMissingInformation(position.claimedAmount,"Claimed money is missing or incomplete for this currency; reported claim days remain separate.","Supply the monetary claim valuation by claim ID, currency and reporting date.");
    explainMissingInformation(position.assessedClaimAmount,"Assessed money is missing or incomplete for this currency; assessed days remain separate.","Supply the monetary assessment by claim ID, currency and reporting date.");
    explainMissingInformation(position.interimCertificateCount,"Dated certification count is not supported by the source periods.","Supply the certification dates and retain the source-period count separately.");
    explainMissingInformation(position.grossCertifiedAmount,"Dated gross certification is not supported by the supplied event dates.","Confirm the certification date and gross certified amount for each certificate; gross work remains available in the source profile.");
    explainMissingInformation(position.paidAmount,"Actual payment amounts and receipt dates are not confirmed.","Supply dated payments or receipts, references and certificate allocations.");
    explainMissingInformation(position.certifiedUnpaidAmount,"Unpaid balance needs confirmed certification and payment records.","Reconcile dated certificates with their allocated payments; missing payments are not zero.");
    explainMissingInformation(position.retentionHeldAmount,"Held balance needs opening retention and release records.","Reconcile the retention deductions with opening balances and dated releases.");
    explainMissingInformation(position.advanceBalance,"Advance balance is not supported by the current records.","Supply the original advance payment, receipt date and recovery allocation.");
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
              amountBasis:
                row.amount.amountBasis,
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
              certifiedAmountBasis:
                row.certifiedAmountBasis,
              paidAmountBasis:
                row.paidAmountBasis,
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

  const performance =
    input.performance ??
    buildCommercialPerformance({
      projectId:
        input.projectId,
      generatedAt:
        input.generatedAt,
      dataDateIso:
        input.sourceLedger
          ?.dataDateIso ??
        null,
      foundation,
      costSnapshots:
        input.sourceLedger
          ?.costPosition.map(
            (snapshot) => ({
              currency:
                snapshot.currency,
              taxBasis:
                snapshot.taxBasis as
                  | "exclusive"
                  | "inclusive"
                  | "unknown",
              asOf:
                snapshot.asOf,
              state:
                snapshot.state,
              values: {
                ...snapshot.values,
              },
              sourceRefs:
                snapshot.receipts.map(
                  (receipt) =>
                    "evidence-document:" +
                    receipt.documentId +
                    ":" +
                    receipt.locator,
                ),
              diagnostics: [
                ...snapshot
                  .diagnostics,
              ],
            }),
          ) ?? [],
      costMetrics:
        input.sourceLedger
          ?.costMetrics.map(
            (row) => ({
              metric:
                row.metric,
              value:
                row.amount.value,
              currency:
                row.amount.currency,
              taxBasis:
                row.amount.taxBasis,
              asOf:
                row.amount.asOf,
              state:
                row.amount.state,
              sourceStatus:
                row.sourceStatus,
              amountBasis:
                row.amount.amountBasis,
              cbsId:
                row.cbsId,
              wbsId:
                row.wbsId,
              sourceRefs:
                row.amount.receipts.map(
                  (receipt) =>
                    "evidence-document:" +
                    receipt.documentId +
                    ":" +
                    receipt.locator,
                ),
            }),
          ) ?? [],
      payments:
        input.sourceLedger
          ?.payments.map(
            (row) => {
              // Employer certification and net certification are distinct ledger facts.
              // Never substitute the net amount when employer certification is absent.
              const certifiedMoney =
                row.amounts
                  .employerCertifiedAmount;
              return {
                taxBasis:
                  certifiedMoney.taxBasis,
                paymentId:
                  row.paymentId,
                periodEnd:
                  row.periodEnd,
                certificationDate:
                  row.certificationDate,
                paymentDate:
                  row.paymentDate,
                currency:
                  certifiedMoney.currency ??
                  row.amounts
                    .paidAmount.currency,
                certifiedAmount:
                  certifiedMoney.value,
                certifiedAmountBasis:
                  row.certifiedAmountBasis,
                paidAmount:
                  row.amounts
                    .paidAmount.value,
                paidAmountBasis:
                  row.paidAmountBasis,
                sourceRefs: [
                  ...certifiedMoney.receipts.map(
                    (receipt) =>
                      "evidence-document:" +
                      receipt.documentId +
                      ":" +
                      receipt.locator,
                  ),
                  ...row.amounts
                    .paidAmount
                    .receipts.map(
                      (receipt) =>
                        "evidence-document:" +
                        receipt.documentId +
                        ":" +
                        receipt.locator,
                    ),
                ],
              };
            },
          ) ?? [],
    });

  // Commercial Performance is the canonical dated cash calculation. Reuse it
  // only when a currency has one unambiguous tax-basis position; never merge
  // incompatible tax bases merely to fill a Commercial Control headline.
  for (const position of positions) {
    const cashPositions =
      performance.cashFlow.currencies.filter(
        (row) =>
          row.currency ===
          position.currency,
      );
    if (cashPositions.length !== 1) continue;
    const cash = cashPositions[0]!;
    const performanceState = (
      state: string,
    ): CommercialEvidenceState =>
      state === "established"
        ? "established"
        : state === "missing"
          ? "missing_information"
          : "candidate";
    if (
      cash.paidIncome.value !== null
    ) {
      position.paidAmount =
        moneyMetric(
          cash.paidIncome.value,
          performanceState(
            cash.paidIncome.state,
          ),
          [
            ...cash.paidIncome
              .basis.sourceRefs,
          ],
          [
            ...cash.paidIncome
              .diagnostics,
            "PAID_AMOUNT_FROM_CANONICAL_DATED_CASH_PERFORMANCE",
          ],
        );
    }
    const netCertified=position.netCertifiedAmount;
    if (
      netCertified?.value !== null &&
      netCertified?.value !== undefined &&
      netCertified.state === "established" &&
      position.paidAmount.value !== null &&
      position.paidAmount.state === "established"
    ) {
      const netUnpaid=Math.max(0,Number((netCertified.value-position.paidAmount.value).toFixed(8)));
      position.certifiedUnpaidAmount =
        moneyMetric(
          netUnpaid,
          "established",
          uniq([
            ...netCertified.sourceRefs,
            ...position.paidAmount.sourceRefs,
          ]),
          [
            "CERTIFIED_UNPAID_FROM_NET_CERTIFIED_LESS_PAID_CASH",
            ...(cash.certifiedUnpaid.value!==null&&Math.abs(cash.certifiedUnpaid.value-netUnpaid)>1e-8
              ? ["GROSS_CERTIFIED_LESS_PAID_IS_NOT_NET_PAYMENT_EXPOSURE"]
              : []),
          ],
        );
    }
  }

  const claimsNotices =
    commercialClaimsNotices(
      input,
    );

  return {
    ...(input.sourceLedger ? {sourceLedger: input.sourceLedger} : {}),
    foundation,
    performance,
    ...(input.contractControls
      ? { contractControls: input.contractControls }
      : {}),
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
              : stateFor(false, sources.commercial),
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
              : stateFor(false, sources.claims),
          timeRefs,
        ),
      officialAdjustedCompletion:
        {...dateMetric(
          adjusted,
          adjusted !== null &&
          contractual &&
          approvedEot !== null &&
          contractTime
            ?.contractualCompletionState ===
            "official" &&
          contractTime
            ?.officialApprovedEotState ===
            "official" &&
          contractTime
            ?.overlapResolution !==
            "unresolved"
            ? "established"
            : adjusted
              ? "candidate"
              : contractTime
                  ?.overlapResolution ===
                  "unresolved"
                ? "candidate"
                : "not_submitted",
          timeRefs,
          adjusted
            ? []
            : contractTime?.overlapResolution === "unresolved"
              ? ["AMENDMENT_DETERMINATION_OVERLAP_NOT_CONFIRMED"]
            : contractTime?.eotDayBasis !== "calendar_days" ? ["OFFICIAL_ADJUSTED_COMPLETION_REQUIRES_SUPPORTED_EOT_DAY_BASIS"] : [
                "ADJUSTED_COMPLETION_REQUIRES_CONTRACTUAL_COMPLETION_AND_APPROVED_EOT",
              ],
        ),...(contractTime?.overlapResolution === "unresolved" ? {
          consequence:"Amendment and determination overlap needs review.",
          action:"Confirm which dated determinations are already incorporated in the amendment before applying additional days."
        } : {})},
    },
    currencies: positions,
    variationCount:
      input.contractControls&&input.contractControls.variations.sourceRecordCount>0?input.contractControls.variations.recordCount:input.variations.length||null,
    invoiceCount:
      input.invoices.length||null,
    retentionRecordCount:
      input.retentions.length||null,
    bondCount:
      input.bonds.length||null,
    claimCommercialCount:
      input
        .claimCommercials.length||null,
    claimsNotices,
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
          sources.commercial,
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
          sources.payments,
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
          sources.variations,
        ),
      bonds:
        stateFor(
          input.bonds.length > 0,
          sources.bonds,
        ),
      claims:
        stateFor(
          input
            .claimCommercials.length >
            0 ||
            claimsNotices.state ===
              "established",
          sources.claims,
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
      costControlSummary: {
        state:
          position.performance
            .costControl.state,
        positionCount:
          position.performance
            .costControl
            .positions.length,
      },
      evmPerformanceSummary: {
        state:
          position.performance
            .evmPerformance.state,
        seriesCount:
          position.performance
            .evmPerformance
            .series.length,
      },
      cashFlowSummary: {
        state:
          position.performance
            .cashFlow.state,
        currencyCount:
          position.performance
            .cashFlow
            .currencies.length,
      },
      costScurveSummary: {
        state:
          position.performance
            .costScurve.state,
        seriesCount:
          position.performance
            .costScurve
            .series.length,
      },
      contractControlSummary:
        position.contractControls
          ? {
              variations:
                position.contractControls
                  .variations.state,
              siteInstructions:
                position.contractControls
                  .siteInstructions.state,
              obligations:
                position.contractControls
                  .contractObligations.state,
              liquidatedDamages:
                position.contractControls
                  .liquidatedDamages.state,
              bondsInsurance:
                position.contractControls
                  .bondsInsurance.state,
              retentionCalendar:
                position.contractControls
                  .retentionCalendar.state,
            }
          : null,
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
      costControl:
        position.performance
          .costControl,
      evmPerformance:
        position.performance
          .evmPerformance,
      costScurve:
        position.performance
          .costScurve,
      currencies:
        position.currencies.map(
          (row) => ({
            currency:
              row.currency,
            originalContractValue:
              row
                .originalContractValue,
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
      variationControl:
        position.contractControls
          ?.variations ??
        null,
      siteInstructions:
        position.contractControls
          ?.siteInstructions ??
        null,
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
            sourceCertificatePeriodCount: row.sourceCertificatePeriodCount,
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
      cashFlowRegister:
        position.performance
          .cashFlow,
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
      claimsNotices:
        position.claimsNotices,
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
      contractObligations:
        position.contractControls
          ?.contractObligations ??
        null,
      liquidatedDamages:
        position.contractControls
          ?.liquidatedDamages ??
        null,
      bondsInsurance:
        position.contractControls
          ?.bondsInsurance ??
        null,
      retentionCalendar:
        position.contractControls
          ?.retentionCalendar ??
        null,
      timeExposure:
        position.timeExposure,
      bondCount:
        position.bondCount,
      currencies:
        position.currencies.map(
          (row) => ({
            currency:
              row.currency,
            originalContractValue:
              row
                .originalContractValue,
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
