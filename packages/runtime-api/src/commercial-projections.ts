import type {
  ProjectRuntimeState,
  ModuleRuntimeResult,
} from "./project-state-types";
import {
  isProgrammeScheduleRevision,
} from "./project-state";
import {
  buildCommercialCanonicalModel,
} from "./commercial-evidence";
import {
  commercialModuleDescriptor,
} from "./commercial-registry";
import {
  buildProjectTruth,
} from "./project-truth";
import {
  commercialReconciliation,
  costControlSummary,
  type CommercialCanonicalModel,
  type MoneyAmount,
} from "../../commercial-core/src";

function available(
  key: string,
  data: unknown,
  dependencies: string[] = [],
  status:
    | "ready"
    | "partial" = "ready",
  reason: string | null = null,
): ModuleRuntimeResult {
  return {
    key,
    status,
    reason,
    dependencies,
    data,
  };
}

function blocked(
  key: string,
  reason: string,
  dependencies: string[],
): ModuleRuntimeResult {
  return {
    key,
    status: "blocked",
    reason,
    dependencies,
    data: null,
  };
}

function latestProgramme(
  state: ProjectRuntimeState,
) {
  return state.schedules
    .filter(
      isProgrammeScheduleRevision,
    )
    .filter(
      (item) =>
        item.role !==
        "recovery",
    )
    .sort(
      (a, b) =>
        (
          a.revision.model
            .dataDateIso ??
          a.revision.effectiveAt ??
          ""
        ).localeCompare(
          b.revision.model
            .dataDateIso ??
          b.revision.effectiveAt ??
          "",
        ),
    )
    .at(-1) ??
    null;
}

function sumMoney(
  values: Array<
    MoneyAmount | null
  >,
): {
  amount: number;
  currency: string;
} | null {
  const established =
    values.filter(
      (
        value,
      ): value is MoneyAmount =>
        value !== null,
    );
  if (!established.length) {
    return null;
  }
  const currencies = [
    ...new Set(
      established.map(
        (value) =>
          value.currency,
      ),
    ),
  ];
  if (currencies.length !== 1) {
    return null;
  }
  return {
    amount:
      Number(
        established
          .reduce(
            (sum, value) =>
              sum +
              value.amount,
            0,
          )
          .toFixed(6),
      ),
    currency:
      currencies[0]!,
  };
}

function daysBetween(
  from: string | null,
  to: string | null,
): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  ) return null;
  return Number(
    (
      (b - a) /
      86_400_000
    ).toFixed(6),
  );
}

function common(
  model: CommercialCanonicalModel,
  generatedAt: string,
) {
  return {
    schemaVersion: "1.0",
    generatedAt,
    projectId: model.projectId,
    dataDateIso:
      model.dataDateIso,
    currencies:
      model.currencies,
    sourceDocumentIds:
      model.sourceDocumentIds,
    commercialDiagnostics:
      model.diagnostics,
    missingValuePolicy:
      "missing_not_zero",
    currencyPolicy:
      "no_cross_currency_arithmetic_without_governed_fx",
  };
}

function evidenceCount(
  state: ProjectRuntimeState,
  types: string[],
): number {
  return state.evidenceDocuments.filter(
    (document) =>
      types.includes(
        document.documentType,
      ) &&
      document.basisState !==
        "superseded",
  ).length;
}

function cumulativeCertified(
  model: CommercialCanonicalModel,
) {
  let cumulative = 0;
  return [...model.payments]
    .filter(
      (payment) =>
        payment
          .certificateDateIso &&
        payment
          .netCertified !==
        null,
    )
    .sort(
      (a, b) =>
        a.certificateDateIso!
          .localeCompare(
            b.certificateDateIso!,
          ),
    )
    .map(
      (payment) => {
        cumulative +=
          payment
            .netCertified!
            .amount;
        return {
          dateIso:
            payment
              .certificateDateIso,
          certifiedCumulative:
            Number(
              cumulative.toFixed(
                6,
              ),
            ),
          currency:
            payment
              .netCertified!
              .currency,
          sourceRefs:
            payment.sourceRefs,
        };
      },
    );
}

function obligations(
  model: CommercialCanonicalModel,
) {
  const rows: Array<{
    obligationId: string;
    type: string;
    description: string;
    dueIso: string | null;
    value: string | number | null;
    unit: string | null;
    authority: string;
    sourceRefs: unknown[];
  }> = [];

  for (
    const term of
      model.terms.noticeTerms
  ) {
    rows.push({
      obligationId:
        term.termId,
      type: "notice",
      description:
        term.noticeType,
      dueIso: null,
      value:
        term.days.value,
      unit:
        term.days.unit,
      authority:
        term.days.authority,
      sourceRefs:
        term.days.sourceRefs,
    });
  }

  if (
    model.terms
      .revisedCompletionIso.value
  ) {
    rows.push({
      obligationId:
        "contract-completion",
      type:
        "completion",
      description:
        "Current contractual completion",
      dueIso:
        model.terms
          .revisedCompletionIso
          .value,
      value:
        model.terms
          .revisedCompletionIso
          .value,
      unit: "date",
      authority:
        model.terms
          .revisedCompletionIso
          .authority,
      sourceRefs:
        model.terms
          .revisedCompletionIso
          .sourceRefs,
    });
  }

  for (
    const instrument of
      model.terms.instruments
  ) {
    rows.push({
      obligationId:
        instrument.requirementId,
      type:
        instrument.kind,
      description:
        "Contract instrument requirement",
      dueIso: null,
      value:
        instrument
          .requiredPercent
          .value ??
        instrument
          .requiredAmount
          .value?.amount ??
        null,
      unit:
        instrument
          .requiredPercent
          .value !== null
          ? "%"
          : instrument
              .requiredAmount
              .value?.currency ??
            null,
      authority:
        instrument
          .requiredPercent
          .value !== null
          ? instrument
              .requiredPercent
              .authority
          : instrument
              .requiredAmount
              .authority,
      sourceRefs: [
        ...instrument.sourceRefs,
      ],
    });
  }

  return rows;
}

function contractRisk(
  model: CommercialCanonicalModel,
) {
  const findings: Array<{
    topic: string;
    state: string;
    severity: "high" | "medium" | "low";
    detail: string;
  }> = [];

  if (
    !model.terms
      .revisedCompletionIso.value
  ) {
    findings.push({
      topic:
        "Contractual completion",
      state: "missing",
      severity: "high",
      detail:
        "No governed current contractual completion is established.",
    });
  }
  if (
    model.terms
      .ldRatePerDay.value &&
    model.terms
      .ldRatePerDay.authority ===
      "candidate"
  ) {
    findings.push({
      topic:
        "Liquidated damages rate",
      state: "candidate",
      severity: "high",
      detail:
        "LD rate is extracted but not yet governed as an effective clause.",
    });
  }
  if (
    model.terms
      .ldCapAmount.value &&
    model.terms
      .ldCapAmount.authority ===
      "candidate"
  ) {
    findings.push({
      topic:
        "Liquidated damages cap",
      state: "candidate",
      severity: "medium",
      detail:
        "LD cap is extracted but not yet governed as an effective clause.",
    });
  }
  for (
    const term of
      model.terms.noticeTerms
  ) {
    if (
      term.days.value === null
    ) {
      findings.push({
        topic:
          term.noticeType,
        state: "missing",
        severity: "high",
        detail:
          "Notice period is not established.",
      });
    }
  }
  return findings;
}

export function buildCommercialModule(
  state: ProjectRuntimeState,
  key: string,
  generatedAt =
    new Date().toISOString(),
): ModuleRuntimeResult {
  const descriptor =
    commercialModuleDescriptor(key);
  if (!descriptor) {
    return blocked(
      key,
      "Unknown Commercial module.",
      [],
    );
  }

  const latest =
    latestProgramme(state);
  const dataDateIso =
    latest?.revision.model
      .dataDateIso ??
    null;
  const model =
    buildCommercialCanonicalModel(
      state,
      dataDateIso,
    );
  const truth =
    latest
      ? buildProjectTruth(
          state,
          latest.revision.model,
        )
      : null;
  const basis =
    common(
      model,
      generatedAt,
    );
  const cost =
    costControlSummary(model);
  const reconciliation =
    commercialReconciliation(
      model,
    );

  if (
    key ===
    "commercial-terms"
  ) {
    const hasContract =
      model.terms
        .originalContractValue
        .value !== null ||
      model.terms
        .currentContractValue
        .value !== null;
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "commercial_terms",
        purpose:
          descriptor.purpose,
        terms:
          model.terms,
        contractTimeTruth:
          truth?.contractTimeBasis ??
          null,
        amendmentCount:
          model.terms
            .amendments.length,
        authorityLayers: {
          extractedCandidate:
            "requires governance unless the source role itself establishes official amendment authority",
          amendmentPrecedence:
            "latest effective amendment overrides only the terms it expressly changes",
          unamendedTerms:
            "main contract remains in force",
        },
      },
      [
        "main contract",
        "contract amendments",
      ],
      hasContract
        ? "ready"
        : "partial",
      hasContract
        ? null
        : "Contract commercial terms are not fully established.",
    );
  }

  if (
    key ===
    "contract-amendments"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "contract_amendments",
        amendments:
          model.terms
            .amendments,
        amendmentCount:
          model.terms
            .amendments.length,
        precedence:
          model.terms
            .precedence,
        comparisonState:
          model.terms
              .amendments.length >
            0
            ? "term_level_comparison_available"
            : "not_established",
      },
      [
        "contract amendments",
      ],
      model.terms
          .amendments.length >
        0
        ? "ready"
        : "partial",
      model.terms
          .amendments.length >
        0
        ? null
        : "No contract amendment is established.",
    );
  }

  if (
    key === "cost-register"
  ) {
    const totalBudget =
      sumMoney(
        model.cbs.map(
          (row) =>
            row.budget,
        ),
      );
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "cost_register",
        rows: model.cbs,
        cbsCodeCount:
          model.cbs.length,
        totalBudget,
        commitmentState:
          model.commitments
              .length >
            0
            ? "established"
            : "missing",
        accrualState:
          model.accruals
              .length >
            0
            ? "established"
            : "missing",
        costAllocationState:
          model.mapping
              .completenessPercent ===
            100
            ? "complete"
            : "partial",
        mapping:
          model.mapping,
      },
      [
        "BOQ / cost codes",
        "commitments",
        "accruals",
      ],
      model.cbs.length > 0
        ? "partial"
        : "blocked",
      model.cbs.length > 0
        ? "Budget/CBS truth is established, but commitments, accruals or cost allocation may still be incomplete."
        : "No CBS cost basis is established.",
    );
  }

  if (
    key ===
    "payment-register"
  ) {
    const certified =
      sumMoney(
        model.payments.map(
          (payment) =>
            payment
              .netCertified,
        ),
      );
    const gross =
      sumMoney(
        model.payments.map(
          (payment) =>
            payment
              .grossCertified,
        ),
      );
    const retention =
      sumMoney(
        model.payments.map(
          (payment) =>
            payment
              .retentionWithheld,
        ),
      );
    const recovery =
      sumMoney(
        model.payments.map(
          (payment) =>
            payment
              .advanceRecovery,
        ),
      );
    const paid =
      sumMoney(
        model.payments.map(
          (payment) =>
            payment.paidAmount,
        ),
      );
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "payment_register",
        payments:
          model.payments,
        paymentCount:
          model.payments.length,
        grossCertified:
          gross,
        netCertified:
          certified,
        retentionWithheld:
          retention,
        advanceRecovery:
          recovery,
        paidAmount: paid,
        outstandingAmount:
          paid &&
          certified &&
          paid.currency ===
            certified.currency
            ? {
                amount:
                  Number(
                    (
                      certified.amount -
                      paid.amount
                    ).toFixed(6),
                  ),
                currency:
                  certified.currency,
              }
            : null,
        stages: {
          application:
            model.payments.filter(
              (payment) =>
                payment
                  .applicationStageAuthority !==
                "missing",
            ).length,
          assessment:
            model.payments.filter(
              (payment) =>
                payment
                  .assessmentStageAuthority !==
                "missing",
            ).length,
          certification:
            model.payments.filter(
              (payment) =>
                payment
                  .certificationStageAuthority !==
                "missing",
            ).length,
          receipt:
            model.payments.filter(
              (payment) =>
                payment
                  .receiptStageAuthority !==
                "missing",
            ).length,
        },
        latePaymentInterestState:
          "not_established",
      },
      [
        "payment certificate register",
        "cash receipts",
      ],
      model.payments.length >
        0
        ? "partial"
        : "blocked",
      model.payments.length >
        0
        ? "Certification is evidenced; application, assessment, receipt and late-interest stages remain missing unless separately supported."
        : "No payment certificate evidence is established.",
    );
  }

  if (
    key ===
    "cbs-breakdown"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "cbs_breakdown",
        rows: model.cbs,
        mapping:
          model.mapping,
        cbsCodeCount:
          model.cbs.length,
      },
      [
        "CBS / BOQ",
        "payment-to-CBS mapping",
        "WBS-to-CBS mapping",
      ],
      model.cbs.length > 0
        ? "partial"
        : "blocked",
      model.cbs.length > 0 &&
      model.mapping
          .completenessPercent !==
        100
        ? "CBS exists, but the mapping completeness dashboard contains unresolved BOQ/payment/WBS links."
        : null,
    );
  }

  if (
    key ===
    "cost-control"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "cost_control",
        cost,
        currentContractValue:
          model.terms
            .currentContractValue,
        evm:
          model.evm,
        costToCompleteMethod: {
          selected:
            model.evm?.etc
              .value
              ? "source_bottom_up_etc"
              : "not_established",
          governed:
            Boolean(
              model.evm?.etc
                .value,
            ),
          alternatives: [
            "BAC/CPI",
            "AC+(BAC-EV)",
            "bottom-up ETC",
            "manual governed forecast",
          ],
        },
      },
      [
        "EVM cost report",
      ],
      model.evm
        ? "ready"
        : "partial",
      model.evm
        ? null
        : "No documented EVM cost position is established.",
    );
  }

  if (
    key ===
    "evm-performance"
  ) {
    const point =
      model.evm
        ? [{
            dateIso:
              model.evm
                .dataDateIso,
            pv:
              model.evm.pv
                .value?.amount ??
              null,
            ev:
              model.evm.ev
                .value?.amount ??
              null,
            ac:
              model.evm.ac
                .value?.amount ??
              null,
            sourceRefs:
              model.evm
                .sourceRefs,
          }]
        : [];
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "evm_performance",
        documented:
          model.evm,
        calculated: {
          spi:
            cost
              .evmReconciliation
              .calculatedSpi,
          cpi:
            cost
              .evmReconciliation
              .calculatedCpi,
          bottomUpEac:
            cost
              .evmReconciliation
              .calculatedBottomUpEac,
        },
        reconciliation:
          cost
            .evmReconciliation,
        points: point,
        seriesCompleteness:
          point.length > 1
            ? "time_series"
            : point.length ===
                1
              ? "single_snapshot"
              : "missing",
      },
      [
        "dated EVM snapshots",
      ],
      model.evm
        ? "partial"
        : "blocked",
      model.evm
        ? "A documented EVM snapshot exists. A full EVM curve/trend requires multiple governed dated snapshots."
        : "No EVM snapshot is established.",
    );
  }

  if (
    key ===
    "cash-flow-register"
  ) {
    const paidEstablished =
      model.cashFlow.some(
        (row) =>
          row.paidIncome !==
          null,
      );
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "cash_flow_register",
        periods:
          model.cashFlow,
        periodCount:
          model.cashFlow.length,
        certifiedIncomeState:
          model.cashFlow.length
            ? "established"
            : "missing",
        paidIncomeState:
          paidEstablished
            ? "established"
            : "missing",
        expenditureState:
          model.cashFlow.some(
            (row) =>
              row
                .actualExpenditure !==
              null,
          )
            ? "established"
            : "missing",
      },
      [
        "payment certificates",
        "cash receipts",
        "actual expenditure",
      ],
      model.cashFlow.length
        ? "partial"
        : "blocked",
      model.cashFlow.length
        ? "Certified income periods are available, but cash receipts/expenditure are not inferred when source evidence is missing."
        : "No cash-flow evidence is established.",
    );
  }

  if (
    key === "cost-scurve"
  ) {
    const certifiedCurve =
      cumulativeCertified(
        model,
      );
    const evmPoint =
      model.evm
        ? {
            dateIso:
              model.evm
                .dataDateIso,
            plannedValue:
              model.evm.pv
                .value?.amount ??
              null,
            earnedValue:
              model.evm.ev
                .value?.amount ??
              null,
            actualCost:
              model.evm.ac
                .value?.amount ??
              null,
            forecastEac:
              model.evm.eac
                .value?.amount ??
              null,
          }
        : null;
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "cost_scurve",
        certifiedCurve,
        evmPoint,
        actualCostHistoryState:
          "single_snapshot_only",
        plannedCostHistoryState:
          "single_snapshot_only",
      },
      [
        "dated cost/EVM history",
        "payment certificates",
      ],
      certifiedCurve.length ||
      evmPoint
        ? "partial"
        : "blocked",
      "CMeng does not fabricate a cumulative PV/EV/AC history from a single EVM snapshot.",
    );
  }

  if (
    key === "variations"
  ) {
    const approved =
      model.variations.filter(
        (variation) =>
          variation.authority ===
            "approved",
      );
    const pending =
      model.variations.filter(
        (variation) =>
          variation.authority !==
            "approved",
      );
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "variations",
        rows:
          model.variations,
        variationCount:
          model.variations.length,
        approvedCount:
          approved.length,
        pendingCount:
          pending.length,
        approvedValue:
          sumMoney(
            approved.map(
              (variation) =>
                variation
                  .approvedValue,
            ),
          ),
        pendingExposure:
          sumMoney(
            pending.map(
              (variation) =>
                variation
                  .claimedValue,
            ),
          ),
        lifecycleGaps: {
          dayworks:
            "not_established",
          provisionalSums:
            "not_established",
          amendmentLinkage:
            model.terms
                .amendments.length
              ? "amendments_available_linkage_pending"
              : "not_established",
        },
      },
      [
        "variation register",
      ],
      model.variations.length
        ? "partial"
        : "blocked",
      model.variations.length
        ? "Variation values are established by register authority, but instruction/daywork/amendment/payment lineage is not complete."
        : "No variation register is established.",
    );
  }

  if (
    key ===
    "site-instructions"
  ) {
    const correspondence =
      evidenceCount(
        state,
        [
          "letters_notices",
        ],
      );
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "site_instructions",
        structuredInstructionCount:
          0,
        correspondenceDocumentCount:
          correspondence,
        nonComplianceTrackingState:
          "not_established",
        stopWorkOrderTrackingState:
          "not_established",
      },
      [
        "structured site-instruction register",
      ],
      "partial",
      correspondence
        ? "Correspondence evidence exists, but site instructions are not yet structured into governed instruction objects."
        : "No structured site-instruction evidence is established.",
    );
  }

  if (
    key ===
    "contract-obligations"
  ) {
    const rows =
      obligations(model);
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "contract_obligations",
        rows,
        obligationCount:
          rows.length,
        amendmentPrecedence:
          model.terms
            .precedence,
      },
      [
        "governed contract terms",
      ],
      rows.length
        ? "partial"
        : "blocked",
      rows.length
        ? "Core time/notice obligations are structured; bonds, insurance, submissions and conditions precedent require additional clause extraction/governance."
        : "No governed contractual obligations are established.",
    );
  }

  if (
    key ===
    "liquidated-damages"
  ) {
    const contractFinish =
      model.terms
        .revisedCompletionIso
        .value;
    const programmeFinish =
      truth?.schedule
        .currentCompletion.value ??
      null;
    const delayDays =
      daysBetween(
        contractFinish,
        programmeFinish,
      );
    const rate =
      model.terms
        .ldRatePerDay.value;
    const cap =
      model.terms
        .ldCapAmount.value;
    const candidateExposure =
      delayDays !== null &&
      delayDays > 0 &&
      rate
        ? {
            amount:
              Number(
                (
                  delayDays *
                  rate.amount
                ).toFixed(6),
              ),
            currency:
              rate.currency,
            authority:
              "candidate_clause_scenario",
          }
        : null;
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "liquidated_damages",
        contractFinish,
        programmeFinish,
        delayDays,
        ldRate:
          model.terms
            .ldRatePerDay,
        ldCapAmount:
          model.terms
            .ldCapAmount,
        ldCapPercent:
          model.terms
            .ldCapPercent,
        candidateGrossExposure:
          candidateExposure,
        cappedCandidateExposure:
          candidateExposure &&
          cap &&
          cap.currency ===
            candidateExposure.currency
            ? {
                amount:
                  Math.min(
                    candidateExposure
                      .amount,
                    cap.amount,
                  ),
                currency:
                  cap.currency,
              }
            : null,
        eotAuthority:
          truth?.contractTimeBasis ??
          null,
        sectionalLdState:
          "not_established",
      },
      [
        "governed LD terms",
        "contract completion",
        "programme completion",
        "EOT authority",
      ],
      contractFinish &&
      programmeFinish
        ? "partial"
        : "blocked",
      "LD monetary exposure remains a scenario until the effective LD rate/cap and relevant EOT/sectional terms are governed.",
    );
  }

  if (
    key ===
    "bonds-insurance"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "bonds_insurance",
        requirements:
          model.terms
            .instruments,
        issuedInstruments: [],
        calledEvents: [],
        insuranceClaims: [],
        recoveries: [],
      },
      [
        "bond / insurance clauses",
        "issued instrument evidence",
      ],
      "partial",
      "Contract instrument requirements and issued instruments require dedicated governed extraction; absence is not treated as zero.",
    );
  }

  if (
    key ===
    "retention-calendar"
  ) {
    const rows =
      model.payments
        .filter(
          (payment) =>
            payment
              .retentionWithheld !==
            null,
        )
        .map(
          (payment) => ({
            paymentId:
              payment.paymentId,
            certificateDateIso:
              payment
                .certificateDateIso,
            withheld:
              payment
                .retentionWithheld,
            released: null,
            remaining:
              payment
                .retentionWithheld,
            expectedReleaseDateIso:
              null,
            actualReleaseDateIso:
              null,
            trigger:
              null,
          }),
        );
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "retention_calendar",
        rows,
        totalWithheld:
          sumMoney(
            rows.map(
              (row) =>
                row.withheld,
            ),
          ),
        totalReleased: null,
        cap:
          model.terms
            .retentionCapPercent,
        capEnforcementState:
          model.terms
              .retentionCapPercent
              .value !== null
            ? "term_available_calculation_pending"
            : "not_established",
        guaranteeSubstitutionState:
          "not_established",
      },
      [
        "payment certificates",
        "retention release evidence",
      ],
      rows.length
        ? "partial"
        : "blocked",
      rows.length
        ? "Retention withholding is evidenced; release events/triggers are not inferred."
        : "No retention withholding evidence is established.",
    );
  }

  if (
    key ===
    "final-account"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "final_account",
        reconciliation,
        closeoutState:
          reconciliation
              .balanceState ===
            "established"
            ? "review"
            : "not_ready",
        defectsLiabilityState:
          "not_established",
        performanceCertificateState:
          "not_established",
        immutableCloseoutState:
          "not_frozen",
      },
      [
        "contract value",
        "approved variations",
        "claim awards",
        "certified payments",
        "cash receipts",
        "closeout certificates",
      ],
      "partial",
      "Final-account position is not frozen until certified, paid, claim-award and closeout-condition evidence is complete.",
    );
  }

  if (
    key ===
    "earned-schedule"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "earned_schedule",
        state:
          model.evm
            ? "insufficient_time_series"
            : "missing",
        dataPointCount:
          model.evm ? 1 : 0,
        es: null,
        spiT: null,
        svT: null,
        ieacT: null,
      },
      [
        "multiple dated PV/EV snapshots",
      ],
      "partial",
      "Earned Schedule is not calculated from a single EVM snapshot.",
    );
  }

  if (
    key === "evm-by-wbs"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "evm_by_wbs",
        cbs: model.cbs,
        mapping:
          model.mapping,
        projectEvm:
          model.evm,
        wbsEvmRows: [],
      },
      [
        "WBS-to-CBS mapping",
        "WBS-level PV/EV/AC allocation",
      ],
      "partial",
      "Project-level EVM is available where evidenced, but WBS-level allocation is not fabricated without a governed mapping.",
    );
  }

  if (
    key ===
    "risk-register"
  ) {
    const rows =
      state.controls.risks;
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "commercial_risk_register",
        rows,
        riskCount:
          rows.length,
        interdependencyState:
          "not_established",
      },
      [
        "risk register",
      ],
      rows.length
        ? "partial"
        : "blocked",
      rows.length
        ? "Risk register is available; risk interdependencies require a governed dependency model."
        : "No governed risk register is established.",
    );
  }

  if (
    key ===
    "monte-carlo-risk"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "commercial_monte_carlo",
        qraState:
          "not_certified",
        scheduleRiskInputState:
          latest
            ? "programme_available"
            : "missing",
        costRiskInputState:
          "not_established",
        p10: null,
        p50: null,
        p80: null,
        p90: null,
        costTimeTradeoffState:
          "not_established",
      },
      [
        "quantitative risk distributions",
        "risk/activity mapping",
        "cost-risk inputs",
      ],
      "partial",
      "A full QRA is not certified until governed distributions and risk-to-activity/cost mappings exist.",
    );
  }

  if (
    key === "contract-risk"
  ) {
    const findings =
      contractRisk(model);
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "contract_risk",
        findings,
        findingCount:
          findings.length,
        noticeTerms:
          model.terms
            .noticeTerms,
        amendmentPrecedence:
          model.terms
            .precedence,
      },
      [
        "commercial terms",
      ],
      model.terms
          .originalContractValue
          .value
        ? "partial"
        : "blocked",
      findings.length
        ? "Contract risks are source-grounded but recommendations remain management actions, not contractual facts."
        : null,
    );
  }

  if (
    key ===
    "tender-readiness"
  ) {
    const tenderDocs =
      evidenceCount(
        state,
        [
          "tender_employer_requirements",
        ],
      );
    const boqDocs =
      evidenceCount(
        state,
        ["boq"],
      );
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "tender_readiness",
        tenderEvidenceDocumentCount:
          tenderDocs,
        boqEvidenceDocumentCount:
          boqDocs,
        readinessState:
          tenderDocs &&
          boqDocs
            ? "partial"
            : "incomplete",
        clarificationsRegisterState:
          "not_established",
        bidComparisonState:
          "not_established",
      },
      [
        "tender-stage evidence",
        "returnables",
        "clarifications",
        "bid evaluation",
      ],
      "partial",
      "Tender readiness must respect the tender-stage evidence cutoff and cannot use later project records to prove bid readiness.",
    );
  }

  if (
    key ===
    "commitment-tracking"
  ) {
    if (
      !model.commitments.length
    ) {
      return blocked(
        key,
        "No governed PO, subcontract or service-agreement commitment register is established.",
        [
          "commitment register",
          "CBS linkage",
        ],
      );
    }
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "commitment_tracking",
        rows:
          model.commitments,
      },
      [
        "commitment register",
      ],
    );
  }

  if (key === "accruals") {
    if (!model.accruals.length) {
      return blocked(
        key,
        "No governed period-end accrual register is established.",
        [
          "accrual register",
          "invoice matching",
        ],
      );
    }
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "accruals",
        rows:
          model.accruals,
      },
      [
        "accrual register",
      ],
    );
  }

  if (
    key ===
    "contingency-reserve"
  ) {
    return blocked(
      key,
      "Contingency and management-reserve draws/releases are not established by the current evidence set.",
      [
        "reserve register",
        "risk linkage",
        "approval history",
      ],
    );
  }

  if (
    key ===
    "escalation-price-adjustment"
  ) {
    return blocked(
      key,
      "No governed escalation/price-adjustment formula and index series is established.",
      [
        "price adjustment clause",
        "base indices",
        "current indices",
      ],
    );
  }

  if (key === "vat-tax") {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "vat_tax",
        vatBasis:
          model.terms
            .vatBasis,
        taxInvoiceRegisterState:
          "not_established",
        withholdingTaxState:
          "not_established",
        reverseChargeState:
          "not_established",
      },
      [
        "contract VAT basis",
        "tax invoices",
      ],
      model.terms
          .vatBasis.value
        ? "partial"
        : "blocked",
      "Contract VAT basis is separated from tax-invoice, withholding-tax and reverse-charge evidence.",
    );
  }

  if (
    key ===
    "multi-currency"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "multi_currency",
        currencies:
          model.currencies,
        conversionState:
          model.currencies.length <=
          1
            ? "not_required_for_current_evidence"
            : "fx_source_required",
        fxRates: [],
        fxGainLoss:
          null,
        hedgingState:
          "not_established",
      },
      [
        "currency evidence",
        "FX source/date when multiple currencies exist",
      ],
      model.currencies.length <=
        1
        ? "ready"
        : "partial",
      model.currencies.length <=
        1
        ? null
        : "Cross-currency arithmetic is blocked until governed FX rates and dates are supplied.",
    );
  }

  if (
    key ===
    "cost-audit-trail"
  ) {
    const rows =
      model.sourceDocumentIds.map(
        (documentId) => {
          const document =
            state.evidenceDocuments.find(
              (item) =>
                item.documentId ===
                documentId,
            );
          return {
            documentId,
            uploadedAt:
              document
                ?.uploadedAt ??
              null,
            basisState:
              document
                ?.basisState ??
              null,
            sourceHashSha256:
              document
                ?.sourceHashSha256 ??
              null,
            mutationActor:
              null,
            before:
              null,
            after:
              null,
          };
        },
      );
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "cost_audit_trail",
        sourceLineage: rows,
        governedMutationHistoryState:
          "not_established",
      },
      [
        "cost mutation event log",
      ],
      "partial",
      "Document lineage is available, but actor/reason/before/after cost mutation history requires a dedicated immutable ledger.",
    );
  }

  if (
    key ===
    "reconciliation-report"
  ) {
    return available(
      key,
      {
        ...basis,
        projectionKey:
          "commercial_reconciliation",
        reconciliation,
        terms:
          {
            originalContract:
              model.terms
                .originalContractValue,
            currentContract:
              model.terms
                .currentContractValue,
          },
      },
      [
        "contract value",
        "variations",
        "payment certificates",
        "cash receipts",
      ],
      reconciliation
          .balanceState ===
        "established"
        ? "ready"
        : "partial",
      reconciliation
          .balanceState ===
        "established"
        ? null
        : "Money-flow reconciliation is partial because one or more authority layers, typically cash receipts, are not established.",
    );
  }

  if (
    key === "cost-position"
  ) {
    const paid =
      reconciliation.paid;
    if (paid === null) {
      return available(
        key,
        {
          ...basis,
          projectionKey:
            "cost_position",
          cashPosition:
            null,
          peakFundingNeed:
            null,
          overdraftRequirement:
            null,
          certified:
            reconciliation
              .certified,
          paid: null,
          state:
            "not_assessable",
        },
        [
          "cash receipts",
          "actual expenditure",
          "forecast cash flow",
        ],
        "partial",
        "Certified amounts exist, but cash position/funding requirement is not calculated without actual receipts and expenditure.",
      );
    }
  }

  return blocked(
    key,
    "The Commercial module is registered but does not yet have sufficient governed evidence to calculate a defensible position.",
    [],
  );
}
