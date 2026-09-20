import {
  analyzeSchedule,
} from "../../schedule-analysis-core/src";
import type {
  CommercialMoney,
  CommercialRuntimeState,
  CostEvmSnapshot,
  PaymentCertificateRecord,
} from "../../commercial-core/src";
import type {
  ModuleRuntimeResult,
  ProjectRuntimeState,
} from "./project-state-types";
import {
  commercialModules,
} from "./registry";
import {
  runtimeProjects,
} from "./project-state";

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

function available(
  key: string,
  data: unknown,
  input: {
    status?: "ready" | "partial";
    reason?: string | null;
    dependencies?: string[];
  } = {},
): ModuleRuntimeResult {
  return {
    key,
    status:
      input.status ??
      "ready",
    reason:
      input.reason ??
      null,
    dependencies:
      input.dependencies ??
      [],
    data,
  };
}

function latestCost(
  commercial:
    CommercialRuntimeState,
): CostEvmSnapshot | null {
  return [
    ...commercial
      .costEvmSnapshots,
  ].sort(
    (a, b) =>
      (
        a.asOfIso ??
        ""
      ).localeCompare(
        b.asOfIso ??
        "",
      ),
  ).at(-1) ??
    null;
}

function amount(
  value:
    CommercialMoney |
    null |
    undefined,
): number | null {
  return value?.amount ??
    null;
}

function currency(
  value:
    CommercialMoney |
    null |
    undefined,
): string | null {
  return value?.currency ??
    null;
}

function sumMoney(
  values:
    Array<
      CommercialMoney |
      null |
      undefined
    >,
): {
  amount: number | null;
  currency: string | null;
  state:
    | "established"
    | "missing"
    | "mixed_currency";
} {
  const established =
    values.filter(
      (
        value,
      ): value is CommercialMoney =>
        Boolean(
          value &&
          value.amount !== null &&
          value.currency,
        ),
    );
  if (
    established.length === 0
  ) {
    return {
      amount: null,
      currency: null,
      state: "missing",
    };
  }
  const currencies =
    new Set(
      established.map(
        (value) =>
          value.currency!,
      ),
    );
  if (
    currencies.size !== 1
  ) {
    return {
      amount: null,
      currency: null,
      state:
        "mixed_currency",
    };
  }
  return {
    amount: Number(
      established
        .reduce(
          (sum, value) =>
            sum +
            value.amount!,
          0,
        )
        .toFixed(6),
    ),
    currency:
      established[0]!
        .currency,
    state:
      "established",
  };
}

function ratio(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator === 0
  ) {
    return null;
  }
  return Number(
    (
      numerator /
      denominator
    ).toFixed(6),
  );
}

function difference(
  a: number | null,
  b: number | null,
): number | null {
  if (
    a === null ||
    b === null
  ) {
    return null;
  }
  return Number(
    (a - b).toFixed(6),
  );
}

function currentProgrammeFinish(
  state:
    ProjectRuntimeState,
): string | null {
  const current =
    runtimeProjects
      .latestSchedule(
        state.projectId,
      );
  if (!current) {
    return null;
  }
  return (
    analyzeSchedule(
      current.revision.model,
    )
      .completionBases.find(
        (basis) =>
          basis.basis ===
          "forecast",
      )
      ?.dateIso ??
    null
  );
}

function daysBetween(
  fromIso: string | null,
  toIso: string | null,
): number | null {
  if (!fromIso || !toIso) {
    return null;
  }
  const from =
    Date.parse(fromIso);
  const to =
    Date.parse(toIso);
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to)
  ) {
    return null;
  }
  return Number(
    (
      (
        to -
        from
      ) /
      86_400_000
    ).toFixed(6),
  );
}

function addCalendarDays(
  dateIso: string | null,
  days: number | null,
): string | null {
  if (
    !dateIso ||
    days === null
  ) {
    return null;
  }
  const ms =
    Date.parse(dateIso);
  if (
    !Number.isFinite(ms)
  ) {
    return null;
  }
  return new Date(
    ms +
    days *
      86_400_000,
  ).toISOString();
}

function approvedVariationTotal(
  commercial:
    CommercialRuntimeState,
) {
  return sumMoney(
    commercial
      .variations
      .map(
        (row) =>
          row
            .approvedContractSumImpact,
      ),
  );
}

function paymentTotals(
  commercial:
    CommercialRuntimeState,
) {
  const certified =
    sumMoney(
      commercial
        .paymentCertificates
        .map(
          (row) =>
            row.netCertified,
        ),
    );
  const paid =
    sumMoney(
      commercial
        .paymentReceipts
        .map(
          (row) =>
            row.amount,
        ),
    );
  const retention =
    sumMoney(
      commercial
        .paymentCertificates
        .map(
          (row) =>
            row.retentionDeduction,
        ),
    );
  const advanceRecovery =
    sumMoney(
      commercial
        .paymentCertificates
        .map(
          (row) =>
            row.advanceRecovery,
        ),
    );
  return {
    certified,
    paid,
    retention,
    advanceRecovery,
    outstanding:
      certified.state ===
        "established" &&
      paid.state ===
        "established" &&
      certified.currency ===
        paid.currency
        ? {
            amount:
              Number(
                (
                  certified.amount! -
                  paid.amount!
                ).toFixed(6),
              ),
            currency:
              certified.currency,
            state:
              "established" as const,
          }
        : {
            amount: null,
            currency: null,
            state:
              commercial
                .paymentReceipts
                .length === 0
                ? "receipts_missing" as const
                : "not_comparable" as const,
          },
  };
}

function evmCalculated(
  source:
    CostEvmSnapshot,
) {
  const calculatedSpi =
    ratio(
      source.ev,
      source.pv,
    );
  const calculatedCpi =
    ratio(
      source.ev,
      source.ac,
    );
  const sv =
    difference(
      source.ev,
      source.pv,
    );
  const cv =
    difference(
      source.ev,
      source.ac,
    );

  const eacBacOverCpi =
    source.bac !== null &&
    calculatedCpi !==
      null &&
    calculatedCpi !== 0
      ? Number(
          (
            source.bac /
            calculatedCpi
          ).toFixed(6),
        )
      : null;

  const etcRemainingBudget =
    source.bac !== null &&
    source.ev !== null
      ? Number(
          (
            source.bac -
            source.ev
          ).toFixed(6),
        )
      : null;
  const eacAcPlusRemaining =
    source.ac !== null &&
    etcRemainingBudget !==
      null
      ? Number(
          (
            source.ac +
            etcRemainingBudget
          ).toFixed(6),
        )
      : null;

  const eacCpiSpi =
    source.ac !== null &&
    source.bac !== null &&
    source.ev !== null &&
    calculatedCpi !==
      null &&
    calculatedSpi !==
      null &&
    calculatedCpi !== 0 &&
    calculatedSpi !== 0
      ? Number(
          (
            source.ac +
            (
              source.bac -
              source.ev
            ) /
            (
              calculatedCpi *
              calculatedSpi
            )
          ).toFixed(6),
        )
      : null;

  return {
    spi:
      calculatedSpi,
    cpi:
      calculatedCpi,
    sv,
    cv,
    eacMethods: [
      {
        method:
          "source_reported",
        eac:
          source.eac,
        etc:
          source.etc,
        authority:
          "source_register",
        governed:
          false,
      },
      {
        method:
          "BAC / CPI",
        eac:
          eacBacOverCpi,
        etc:
          source.ac !==
            null &&
          eacBacOverCpi !==
            null
            ? Number(
                (
                  eacBacOverCpi -
                  source.ac
                ).toFixed(6),
              )
            : null,
        authority:
          "deterministic_calculation",
        governed:
          false,
      },
      {
        method:
          "AC + (BAC - EV)",
        eac:
          eacAcPlusRemaining,
        etc:
          etcRemainingBudget,
        authority:
          "deterministic_calculation",
        governed:
          false,
      },
      {
        method:
          "AC + (BAC - EV) / (CPI × SPI)",
        eac:
          eacCpiSpi,
        etc:
          source.ac !==
            null &&
          eacCpiSpi !==
            null
            ? Number(
                (
                  eacCpiSpi -
                  source.ac
                ).toFixed(6),
              )
            : null,
        authority:
          "deterministic_calculation",
        governed:
          false,
      },
    ],
  };
}

function commercialTerms(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const terms =
    c.contractTerms;
  const approved =
    approvedVariationTotal(c);
  const original =
    terms
      .originalContractValue;
  const current =
    terms
      .currentContractValue;
  const bridge =
    original?.amount !==
      null &&
    original?.amount !==
      undefined &&
    approved.amount !==
      null &&
    current?.amount !==
      null &&
    current?.amount !==
      undefined &&
    original.currency &&
    approved.currency ===
      original.currency &&
    current.currency ===
      original.currency
      ? Number(
          (
            original.amount +
            approved.amount -
            current.amount
          ).toFixed(6),
        )
      : null;

  const established =
    Boolean(
      current?.amount !==
        null &&
      current?.currency &&
      terms.revisedCompletionIso,
    );

  return available(
    "commercial-terms",
    {
      schemaVersion: "1.0",
      projectionKey:
        "commercial_terms",
      projectId:
        state.projectId,
      contractTerms:
        terms,
      amendmentCount:
        terms.amendments.length,
      contractValueReconciliation: {
        originalContractValue:
          original,
        approvedVariationRegisterTotal:
          approved,
        currentContractValue:
          current,
        difference:
          bridge,
        state:
          bridge === null
            ? "not_assessable"
            : Math.abs(
                bridge,
              ) < 0.01
              ? "reconciled"
              : "difference",
      },
      authorityLayers: {
        originalContract:
          original
            ?.authority ??
          "missing",
        currentContract:
          current
            ?.authority ??
          "missing",
        timeBasis:
          state.controls
            .contractTimeBasis
            ?.contractualCompletionState ??
          "missing",
        noticeRequirements:
          state.controls
            .contractNoticeRequirements
            .length > 0
            ? "official"
            : "missing",
      },
    },
    {
      status:
        established
          ? "ready"
          : "partial",
      reason:
        established
          ? null
          : "Commercial Terms are partially established. Current contract value, revised completion, payment/retention/LD or notice terms remain incomplete.",
      dependencies: [
        "main contract",
        "contract amendments",
      ],
    },
  );
}

function costRegister(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const latest =
    latestCost(c);
  const rows =
    c.costCodes;
  const commitmentTotal =
    sumMoney(
      c.commitments.map(
        (row) =>
          row.amount,
      ),
    );
  const accrualTotal =
    sumMoney(
      c.accruals.map(
        (row) =>
          row.amount,
      ),
    );

  return available(
    "cost-register",
    {
      schemaVersion: "1.0",
      projectionKey:
        "cost_register",
      projectId:
        state.projectId,
      costCodeCount:
        rows.length,
      costCodes: rows,
      commitmentCount:
        c.commitments.length,
      commitmentTotal,
      accrualCount:
        c.accruals.length,
      accrualTotal,
      allocationRuleCount:
        c.costAllocationRules
          .length,
      sourceControlSnapshot:
        latest,
      registerState:
        rows.length > 0
          ? "established"
          : latest
            ? "project_level_only"
            : "missing",
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : latest
            ? "Project-level cost/EVM evidence exists, but a governed CBS cost-code register is not established."
            : "A cost register or cost/EVM source is required.",
      dependencies: [
        "CBS cost register",
        "commitments",
        "accruals",
      ],
    },
  );
}

function paymentRegister(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const totals =
    paymentTotals(c);
  const missingApplication =
    c.paymentCertificates.filter(
      (row) =>
        !row.applicationId,
    ).length;
  const missingAssessment =
    c.paymentCertificates.filter(
      (row) =>
        !row.assessmentId,
    ).length;
  const receiptLinked =
    new Set(
      c.paymentReceipts.map(
        (row) =>
          row.certificateId,
      ),
    );
  const certificatesWithoutReceipts =
    c.paymentCertificates.filter(
      (row) =>
        !receiptLinked.has(
          row.certificateId,
        ),
    ).length;
  const hasCertificates =
    c.paymentCertificates
      .length > 0;
  const lifecycleComplete =
    hasCertificates &&
    missingApplication === 0 &&
    missingAssessment === 0 &&
    certificatesWithoutReceipts ===
      0;

  return available(
    "payment-register",
    {
      schemaVersion: "1.0",
      projectionKey:
        "payment_register",
      projectId:
        state.projectId,
      certificateCount:
        c.paymentCertificates
          .length,
      applicationCount:
        c.paymentApplications
          .length,
      assessmentCount:
        c.paymentAssessments
          .length,
      receiptCount:
        c.paymentReceipts
          .length,
      totals,
      lifecycleCoverage: {
        missingApplicationStage:
          missingApplication,
        missingAssessmentStage:
          missingAssessment,
        certificatesWithoutReceipts,
      },
      certificates:
        c.paymentCertificates,
      applications:
        c.paymentApplications,
      assessments:
        c.paymentAssessments,
      receipts:
        c.paymentReceipts,
      advanceRecoveries:
        c.advanceRecoveries,
      latePaymentInterest:
        c.latePaymentInterest,
      lifecycleComplete,
    },
    {
      status:
        lifecycleComplete
          ? "ready"
          : hasCertificates
            ? "partial"
            : "partial",
      reason:
        lifecycleComplete
          ? null
          : hasCertificates
            ? "Certificates are established, but application, assessment, receipt, due-date or payment-stage evidence is incomplete. Missing stages are not treated as zero."
            : "No governed IPC/payment certificate register is established.",
      dependencies: [
        "payment applications",
        "engineer assessments",
        "certificates",
        "receipts",
      ],
    },
  );
}

function cbsBreakdown(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const mappedByDomain =
    new Map<
      string,
      number
    >();
  for (
    const mapping of
      c.mappings
  ) {
    mappedByDomain.set(
      mapping.sourceDomain,
      (
        mappedByDomain.get(
          mapping.sourceDomain,
        ) ??
        0
      ) + 1,
    );
  }

  const boqItems =
    state.boq
      ?.canonicalItems.length ??
    null;
  const mappedBoq =
    mappedByDomain.get(
      "boq",
    ) ??
    0;
  const paymentCount =
    c.paymentCertificates.length;
  const mappedPayments =
    mappedByDomain.get(
      "payment",
    ) ??
    0;

  return available(
    "cbs-breakdown",
    {
      schemaVersion: "1.0",
      projectionKey:
        "cbs_breakdown",
      projectId:
        state.projectId,
      cbsNodeCount:
        c.cbsNodes.length,
      costCodeCount:
        c.costCodes.length,
      nodes:
        c.cbsNodes,
      costCodes:
        c.costCodes,
      mappings:
        c.mappings,
      mappingCompleteness: {
        boq: {
          population:
            boqItems,
          mapped:
            mappedBoq,
          unmapped:
            boqItems === null
              ? null
              : Math.max(
                  0,
                  boqItems -
                  mappedBoq,
                ),
        },
        payments: {
          population:
            paymentCount,
          mapped:
            mappedPayments,
          unmapped:
            Math.max(
              0,
              paymentCount -
              mappedPayments,
            ),
        },
        wbs: {
          mapped:
            mappedByDomain.get(
              "wbs",
            ) ??
            0,
        },
      },
    },
    {
      status:
        c.cbsNodes.length >
          0 &&
        c.costCodes.length >
          0
          ? "ready"
          : "partial",
      reason:
        c.cbsNodes.length > 0
          ? "CBS exists but one or more BOQ/payment/WBS mapping populations remain incomplete."
          : "A governed CBS hierarchy and mapping rules are not established.",
      dependencies: [
        "CBS hierarchy",
        "BOQ-to-CBS mapping",
        "payment-to-CBS mapping",
        "WBS-to-CBS mapping",
      ],
    },
  );
}

function costControl(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const source =
    latestCost(c);
  if (!source) {
    return available(
      "cost-control",
      {
        schemaVersion: "1.0",
        projectionKey:
          "cost_control",
        projectId:
          state.projectId,
        sourceEvm:
          null,
        calculatedEvm:
          null,
        state: "missing",
      },
      {
        status: "partial",
        reason:
          "A governed cost/EVM reporting snapshot is required before Cost Control can calculate performance.",
        dependencies: [
          "cost/EVM report",
        ],
      },
    );
  }

  const calculated =
    evmCalculated(source);
  const eacValues =
    calculated.eacMethods
      .filter(
        (row) =>
          row.eac !== null,
      )
      .map(
        (row) =>
          row.eac!,
      );
  const range =
    eacValues.length > 0
      ? {
          min:
            Math.min(
              ...eacValues,
            ),
          max:
            Math.max(
              ...eacValues,
            ),
        }
      : {
          min: null,
          max: null,
        };

  return available(
    "cost-control",
    {
      schemaVersion: "1.0",
      projectionKey:
        "cost_control",
      projectId:
        state.projectId,
      dataDateIso:
        source.asOfIso,
      currency:
        source.currency,
      vatBasis:
        source.vatBasis,
      sourceEvm: source,
      calculatedEvm:
        calculated,
      reconciliation: {
        spiDifference:
          difference(
            source.spi,
            calculated.spi,
          ),
        cpiDifference:
          difference(
            source.cpi,
            calculated.cpi,
          ),
        svDifference:
          difference(
            source.sv,
            calculated.sv,
          ),
        cvDifference:
          difference(
            source.cv,
            calculated.cv,
          ),
      },
      eacMethodRange:
        range,
      selectedEacMethod:
        null,
      governance: {
        methodSelectionRequired:
          calculated
            .eacMethods.filter(
              (row) =>
                row.eac !==
                null,
            ).length > 1,
        sourceReportedEacPreserved:
          source.eac !== null,
        noSilentMethodSelection:
          true,
      },
    },
    {
      status:
        source.bac !== null &&
        source.pv !== null &&
        source.ev !== null &&
        source.ac !== null
          ? "ready"
          : "partial",
      reason:
        source.bac !== null &&
        source.pv !== null &&
        source.ev !== null &&
        source.ac !== null
          ? null
          : "Cost Control is partial because BAC/PV/EV/AC are not all established on the same source snapshot.",
      dependencies: [
        "BAC",
        "PV",
        "EV",
        "AC",
      ],
    },
  );
}

function evmPerformance(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const snapshots =
    [...state.commercial
      .costEvmSnapshots]
      .sort(
        (a, b) =>
          (
            a.asOfIso ??
            ""
          ).localeCompare(
            b.asOfIso ??
            "",
          ),
      );
  const latest =
    snapshots.at(-1) ??
    null;
  const points =
    snapshots.map(
      (snapshot) => ({
        dateIso:
          snapshot.asOfIso,
        pv: snapshot.pv,
        ev: snapshot.ev,
        ac: snapshot.ac,
        sourceSpi:
          snapshot.spi,
        sourceCpi:
          snapshot.cpi,
        calculatedSpi:
          ratio(
            snapshot.ev,
            snapshot.pv,
          ),
        calculatedCpi:
          ratio(
            snapshot.ev,
            snapshot.ac,
          ),
        sv:
          difference(
            snapshot.ev,
            snapshot.pv,
          ),
        cv:
          difference(
            snapshot.ev,
            snapshot.ac,
          ),
      }),
    );

  return available(
    "evm-performance",
    {
      schemaVersion: "1.0",
      projectionKey:
        "evm_performance",
      projectId:
        state.projectId,
      currency:
        latest?.currency ??
        null,
      snapshotCount:
        snapshots.length,
      points,
      latestSource:
        latest,
      comparisonState:
        latest
          ? "documented_vs_calculated"
          : "missing",
      seriesComplete:
        points.length > 1 &&
        points.every(
          (point) =>
            point.dateIso &&
            point.pv !== null &&
            point.ev !== null &&
            point.ac !== null,
        ),
    },
    {
      status:
        points.length > 1
          ? "ready"
          : "partial",
      reason:
        points.length > 1
          ? null
          : latest
            ? "Current EVM is established, but a time-phased trend needs at least two governed dated EVM snapshots."
            : "No EVM evidence is established.",
      dependencies: [
        "dated EVM snapshots",
      ],
    },
  );
}

function cashFlow(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const rows =
    [...c.cashFlow]
      .sort(
        (a, b) =>
          a.periodId.localeCompare(
            b.periodId,
          ),
      );
  const byCurrency =
    new Map<
      string,
      {
        paidIncome: number;
        actualExpenditure: number;
        periods: number;
      }
    >();
  for (const row of rows) {
    const current =
      byCurrency.get(
        row.currency,
      ) ?? {
        paidIncome: 0,
        actualExpenditure: 0,
        periods: 0,
      };
    if (
      row.paidIncome !==
      null
    ) {
      current.paidIncome +=
        row.paidIncome;
    }
    if (
      row.actualExpenditure !==
      null
    ) {
      current.actualExpenditure +=
        row.actualExpenditure;
    }
    current.periods += 1;
    byCurrency.set(
      row.currency,
      current,
    );
  }

  return available(
    "cash-flow",
    {
      schemaVersion: "1.0",
      projectionKey:
        "cash_flow",
      projectId:
        state.projectId,
      periodCount:
        rows.length,
      rows,
      totalsByCurrency:
        Object.fromEntries(
          byCurrency,
        ),
      paymentReconciliation: {
        paymentReceiptCount:
          c.paymentReceipts
            .length,
        state:
          rows.length > 0 &&
          c.paymentReceipts
            .length > 0
            ? "available"
            : "not_assessable",
      },
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "No governed period cash-flow register is established. Payment certificates are not substituted for cash receipts.",
      dependencies: [
        "cash-flow register",
        "payment receipts",
        "actual expenditure",
      ],
    },
  );
}

function costScurve(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const snapshots =
    [...state.commercial
      .costEvmSnapshots]
      .filter(
        (row) =>
          row.asOfIso !==
          null,
      )
      .sort(
        (a, b) =>
          a.asOfIso!
            .localeCompare(
              b.asOfIso!,
            ),
      );
  const points =
    snapshots.map(
      (row) => ({
        dateIso:
          row.asOfIso,
        plannedCost:
          row.pv,
        earnedValue:
          row.ev,
        actualCost:
          row.ac,
        forecastCost:
          row.eac,
      }),
    );

  return available(
    "cost-scurve",
    {
      schemaVersion: "1.0",
      projectionKey:
        "cost_scurve",
      projectId:
        state.projectId,
      currency:
        snapshots.at(-1)
          ?.currency ??
        null,
      points,
      sourceSnapshotCount:
        snapshots.length,
      dataDateCutoffIso:
        snapshots.at(-1)
          ?.asOfIso ??
        null,
    },
    {
      status:
        points.length >= 2
          ? "ready"
          : "partial",
      reason:
        points.length >= 2
          ? null
          : points.length === 1
            ? "One dated cost/EVM snapshot is available. CMeng does not fabricate a historical Cost S-Curve from a single current point."
            : "No dated cost series is established.",
      dependencies: [
        "dated cost/EVM history",
      ],
    },
  );
}

function variations(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const approved =
    c.variations.filter(
      (row) =>
        row
          .approvedContractSumImpact
          ?.amount !==
        null,
    );
  const total =
    sumMoney(
      approved.map(
        (row) =>
          row
            .approvedContractSumImpact,
      ),
    );
  const timeImpactMissing =
    c.variations.filter(
      (row) =>
        row.timeImpactDays ===
        null,
    ).length;

  return available(
    "variations",
    {
      schemaVersion: "1.0",
      projectionKey:
        "variations",
      projectId:
        state.projectId,
      variationCount:
        c.variations.length,
      approvedCount:
        approved.length,
      approvedTotal:
        total,
      timeImpactMissingCount:
        timeImpactMissing,
      variations:
        c.variations,
      dayworks:
        c.dayworks,
      provisionalSums:
        c.provisionalSums,
      amendmentLinks:
        c.variations.filter(
          (row) =>
            row.amendmentId !==
            null,
        ).map(
          (row) => ({
            variationId:
              row.variationId,
            amendmentId:
              row.amendmentId,
          }),
        ),
    },
    {
      status:
        c.variations.length >
          0
          ? "partial"
          : "partial",
      reason:
        c.variations.length >
          0
          ? "Approved variation evidence is available, but full instruction → notice → quotation → assessment → agreement → certification lineage is only READY when every stage is linked."
          : "No governed variation register is established.",
      dependencies: [
        "variation register",
        "site instructions",
        "quotations",
        "certification",
      ],
    },
  );
}

function siteInstructions(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .siteInstructions;
  return available(
    "site-instructions",
    {
      schemaVersion: "1.0",
      projectionKey:
        "site_instructions",
      projectId:
        state.projectId,
      instructionCount:
        rows.length,
      nonComplianceCount:
        rows.filter(
          (row) =>
            row.nonComplianceState &&
            ![
              "closed",
              "complied",
            ].includes(
              row.nonComplianceState
                .toLowerCase(),
            ),
        ).length,
      stopWorkOrderCount:
        rows.filter(
          (row) =>
            row.stopWorkOrder ===
            true,
        ).length,
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "No governed Site Instruction register is established.",
      dependencies: [
        "site instruction register",
      ],
    },
  );
}

function contractObligations(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .obligations;
  const now =
    runtimeProjects
      .latestSchedule(
        state.projectId,
      )?.revision.model
      .dataDateIso ??
    null;
  const nowMs =
    now
      ? Date.parse(now)
      : Number.NaN;
  const overdue =
    rows.filter(
      (row) => {
        if (
          !row.dueIso ||
          !Number.isFinite(
            nowMs,
          )
        ) {
          return false;
        }
        const due =
          Date.parse(row.dueIso);
        return (
          Number.isFinite(due) &&
          due < nowMs &&
          ![
            "complete",
            "complied",
            "closed",
          ].includes(
            (
              row.status ??
              ""
            ).toLowerCase(),
          )
        );
      },
    );

  return available(
    "contract-obligations",
    {
      schemaVersion: "1.0",
      projectionKey:
        "contract_obligations",
      projectId:
        state.projectId,
      dataDateIso:
        now,
      obligationCount:
        rows.length,
      overdueCount:
        overdue.length,
      noticeRequirements:
        state.controls
          .contractNoticeRequirements,
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : state.controls
              .contractNoticeRequirements
              .length > 0
            ? "partial"
            : "partial",
      reason:
        rows.length > 0
          ? null
          : "Some notice obligations may be extracted, but a complete governed obligation register is not yet established.",
      dependencies: [
        "contract obligation extraction",
      ],
    },
  );
}

function liquidatedDamages(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const terms =
    state.commercial
      .contractTerms;
  const forecast =
    currentProgrammeFinish(
      state,
    );
  const contractFinish =
    terms.revisedCompletionIso;
  const delayDays =
    daysBetween(
      contractFinish,
      forecast,
    );
  const rate =
    terms.ldRatePerDay;
  const currentValue =
    terms.currentContractValue;
  const raw =
    delayDays !== null &&
    delayDays > 0 &&
    rate?.amount !== null &&
    rate?.amount !==
      undefined
      ? Number(
          (
            delayDays *
            rate.amount
          ).toFixed(6),
        )
      : null;
  const cap =
    currentValue?.amount !==
      null &&
    currentValue?.amount !==
      undefined &&
    terms.ldCapPercent !==
      null
      ? Number(
          (
            currentValue.amount *
            terms.ldCapPercent /
            100
          ).toFixed(6),
        )
      : null;
  const capped =
    raw !== null
      ? cap !== null
        ? Math.min(
            raw,
            cap,
          )
        : raw
      : null;

  const officialApproved =
    state.controls
      .contractTimeBasis
      ?.officialApprovedEotDays ??
    null;
  const amendmentDays =
    state.controls
      .contractTimeBasis
      ?.incorporatedAmendmentEotDays ??
    null;
  const scenarios = [
    {
      scenario:
        "current revised contract",
      completionIso:
        contractFinish,
      delayDays:
        delayDays === null
          ? null
          : Math.max(
              0,
              delayDays,
            ),
      exposure:
        capped,
      authority:
        "contractual",
    },
    {
      scenario:
        "official aggregate EOT",
      completionIso:
        officialApproved ===
          null
          ? null
          : addCalendarDays(
              contractFinish,
              officialApproved,
            ),
      delayDays:
        officialApproved ===
          null
          ? null
          : Math.max(
              0,
              daysBetween(
                addCalendarDays(
                  contractFinish,
                  officialApproved,
                ),
                forecast,
              ) ??
              0,
            ),
      exposure: null,
      authority:
        officialApproved ===
          null
          ? "missing"
          : "official",
    },
  ];

  return available(
    "liquidated-damages",
    {
      schemaVersion: "1.0",
      projectionKey:
        "liquidated_damages",
      projectId:
        state.projectId,
      contractualCompletionIso:
        contractFinish,
      currentProgrammeCompletionIso:
        forecast,
      incorporatedAmendmentDays:
        amendmentDays,
      officialApprovedEotDays:
        officialApproved,
      delayDays:
        delayDays === null
          ? null
          : Math.max(
              0,
              delayDays,
            ),
      ratePerDay:
        rate,
      capPercent:
        terms.ldCapPercent,
      capAmount:
        cap,
      uncappedExposure:
        raw,
      cappedExposure:
        capped,
      currency:
        rate?.currency ??
        currentValue
          ?.currency ??
        null,
      scenarios,
      sectionalLd:
        state.commercial
          .sectionalLd,
      determinationRegister: {
        count:
          state.controls
            .contractTimeBasis
            ?.engineerDeterminationCount ??
          0,
        awardedDays:
          state.controls
            .contractTimeBasis
            ?.engineerDeterminationAwardedDaysTotal ??
          null,
        aggregationState:
          state.controls
            .contractTimeBasis
            ?.determinationAggregationState ??
          "not_submitted",
      },
      diagnostics: [
        "ENGINEER_DETERMINATION_REGISTER_IS_NOT_AUTOMATICALLY_ADDED_TO_AMENDMENT_TIME",
      ],
    },
    {
      status:
        contractFinish &&
        rate?.amount !== null &&
        rate?.amount !==
          undefined
          ? "partial"
          : "partial",
      reason:
        contractFinish &&
        rate?.amount !== null &&
        rate?.amount !==
          undefined
          ? "Base LD scenario is calculable. Awarded/assessed/claimed/sectional scenarios remain separate and require their own governed time basis."
          : "LD exposure requires a governed rate, cap basis and contractual completion.",
      dependencies: [
        "LD rate/cap",
        "contract completion",
        "EOT authority",
      ],
    },
  );
}

function bondsInsurance(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .instruments;
  return available(
    "bonds-insurance",
    {
      schemaVersion: "1.0",
      projectionKey:
        "bonds_insurance",
      projectId:
        state.projectId,
      instrumentCount:
        rows.length,
      calledEventCount:
        rows.filter(
          (row) =>
            row.calledAmount
              ?.amount !==
            null &&
            row.calledAmount !==
            null,
        ).length,
      insuranceClaimCount:
        rows.filter(
          (row) =>
            row.kind ===
              "insurance" &&
            row.claimedAmount
              ?.amount !==
            null &&
            row.claimedAmount !==
            null,
        ).length,
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "Contract requirements may exist, but issued bond/insurance instrument evidence is not established.",
      dependencies: [
        "bond/insurance register",
      ],
    },
  );
}

function retentionCalendar(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const sourceDeductions =
    c.paymentCertificates
      .filter(
        (row) =>
          row.retentionDeduction
            ?.amount !==
          null,
      );
  const withheld =
    sumMoney(
      sourceDeductions.map(
        (row) =>
          row.retentionDeduction,
      ),
    );
  const released =
    sumMoney(
      c.retentions.map(
        (row) =>
          row.released,
      ),
    );

  return available(
    "retention-calendar",
    {
      schemaVersion: "1.0",
      projectionKey:
        "retention_calendar",
      projectId:
        state.projectId,
      retentionPercent:
        c.contractTerms
          .retentionPercent,
      retentionCapPercent:
        c.contractTerms
          .retentionCapPercent,
      withheld,
      released,
      records:
        c.retentions,
      sourceCertificateDeductions:
        sourceDeductions,
      earlyReleaseCount:
        c.retentions.filter(
          (row) =>
            row.earlyRelease ===
            true,
        ).length,
      guaranteeSubstitutionCount:
        c.retentions.filter(
          (row) =>
            row
              .guaranteeSubstitutionInstrumentId !==
            null,
        ).length,
    },
    {
      status:
        c.retentions.length >
          0
          ? "ready"
          : sourceDeductions.length >
              0
            ? "partial"
            : "partial",
      reason:
        c.retentions.length > 0
          ? null
          : sourceDeductions.length > 0
            ? "Retention deductions are established from IPCs, but release stages/triggers and guarantee substitutions are not yet governed."
            : "Retention evidence is not established.",
      dependencies: [
        "retention terms",
        "IPC deductions",
        "release evidence",
      ],
    },
  );
}

function finalAccount(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const approvedVariations =
    approvedVariationTotal(c);
  const payment =
    paymentTotals(c);
  const original =
    c.contractTerms
      .originalContractValue;
  const current =
    c.contractTerms
      .currentContractValue;

  return available(
    "final-account",
    {
      schemaVersion: "1.0",
      projectionKey:
        "final_account",
      projectId:
        state.projectId,
      records:
        c.finalAccounts,
      currentWorkingPosition: {
        originalContract:
          original,
        approvedVariations,
        currentContract:
          current,
        netCertified:
          payment.certified,
        paid:
          payment.paid,
        balance:
          payment.outstanding,
      },
      closeoutConditions: {
        defectsLiabilityEstablished:
          c.finalAccounts.some(
            (row) =>
              row
                .defectsLiabilityEndIso !==
              null,
          ),
        performanceCertificateEstablished:
          c.finalAccounts.some(
            (row) =>
              row
                .performanceCertificateIso !==
              null,
          ),
        frozenPositionExists:
          c.finalAccounts.some(
            (row) =>
              row.state ===
              "frozen",
          ),
      },
    },
    {
      status:
        c.finalAccounts.some(
          (row) =>
            row.state ===
            "frozen",
        )
          ? "ready"
          : "partial",
      reason:
        c.finalAccounts.length > 0
          ? "Final Account exists but is not fully approved/frozen with all closeout conditions."
          : "A working reconciliation can be shown, but no governed Final Account / immutable closeout record exists.",
      dependencies: [
        "final account",
        "payment receipts",
        "DLP/performance certificate",
      ],
    },
  );
}

function earnedSchedule(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const snapshots =
    [...state.commercial
      .costEvmSnapshots]
      .filter(
        (row) =>
          row.asOfIso &&
          row.pv !== null &&
          row.ev !== null,
      )
      .sort(
        (a, b) =>
          a.asOfIso!
            .localeCompare(
              b.asOfIso!,
            ),
      );
  return available(
    "earned-schedule",
    {
      schemaVersion: "1.0",
      projectionKey:
        "earned_schedule",
      projectId:
        state.projectId,
      state:
        snapshots.length >= 2
          ? "calculable"
          : "insufficient_series",
      sourceSnapshotCount:
        snapshots.length,
      points: [],
      diagnostics: [
        "EARNED_SCHEDULE_REQUIRES_TIME_PHASED_PV_CURVE_FOR_ES_INTERPOLATION",
        "EARNED_SCHEDULE_DOES_NOT_REPLACE_CPM_FORECAST",
      ],
    },
    {
      status:
        "partial",
      reason:
        snapshots.length >= 2
          ? "Dated EVM snapshots exist, but Earned Schedule requires a sufficiently granular time-phased PV curve for defensible ES interpolation."
          : "At least two dated EVM snapshots and a time-phased PV curve are required.",
      dependencies: [
        "time-phased PV/EV series",
      ],
    },
  );
}

function evmByWbs(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const mappedWbs =
    c.mappings.filter(
      (row) =>
        row.sourceDomain ===
        "wbs",
    );
  return available(
    "evm-by-wbs",
    {
      schemaVersion: "1.0",
      projectionKey:
        "evm_by_wbs",
      projectId:
        state.projectId,
      wbsMappingCount:
        mappedWbs.length,
      mappings:
        mappedWbs,
      rows: [],
      reconciliationState:
        "not_established",
    },
    {
      status: "partial",
      reason:
        "Project-level EVM may exist, but WBS-level PV/EV/AC attribution is not established until governed WBS-to-CBS/cost mappings and time-phased values exist.",
      dependencies: [
        "WBS cost mapping",
        "WBS EVM source",
      ],
    },
  );
}

function commercialRisk(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .risks;
  return available(
    "commercial-risk-register",
    {
      schemaVersion: "1.0",
      projectionKey:
        "commercial_risk_register",
      projectId:
        state.projectId,
      riskCount:
        rows.length,
      dependencyLinkCount:
        rows.reduce(
          (sum, row) =>
            sum +
            row
              .dependencyRiskIds
              .length,
          0,
        ),
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "No governed commercial risk register is established.",
      dependencies: [
        "risk register",
      ],
    },
  );
}

function monteCarlo(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .monteCarloResults;
  return available(
    "monte-carlo-risk",
    {
      schemaVersion: "1.0",
      projectionKey:
        "monte_carlo_risk",
      projectId:
        state.projectId,
      results: rows,
      qraReady:
        rows.some(
          (row) =>
            row.qraReady,
        ),
      costTimeTradeoffState:
        "not_established",
    },
    {
      status:
        rows.some(
          (row) =>
            row.qraReady,
        )
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? "Probabilistic outputs exist, but a full QRA/cost-time trade-off is only READY when the input distributions, correlations and revision basis are governed."
          : "No governed Monte Carlo/QRA result is established.",
      dependencies: [
        "QRA inputs",
        "risk distributions",
      ],
    },
  );
}

function contractRisk(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .contractRisks;
  return available(
    "contract-risk",
    {
      schemaVersion: "1.0",
      projectionKey:
        "contract_risk",
      projectId:
        state.projectId,
      riskCount:
        rows.length,
      rows,
      currentContractTerms:
        state.commercial
          .contractTerms,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "Contract facts exist, but clause-level governed risk findings have not yet been established.",
      dependencies: [
        "contract risk analysis",
      ],
    },
  );
}

function tenderReadiness(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  return available(
    "tender-readiness",
    {
      schemaVersion: "1.0",
      projectionKey:
        "tender_readiness",
      projectId:
        state.projectId,
      packageCount:
        c.tenderReadiness
          .length,
      packages:
        c.tenderReadiness,
      clarifications:
        c.tenderClarifications,
      bidEvaluations:
        c.bidEvaluations,
      evidenceCutoffRule:
        "tender-stage evidence only",
    },
    {
      status:
        c.tenderReadiness
          .length > 0
          ? "ready"
          : "partial",
      reason:
        c.tenderReadiness
          .length > 0
          ? null
          : "No governed tender package readiness assessment is established.",
      dependencies: [
        "tender-stage evidence",
      ],
    },
  );
}

function commitments(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .commitments;
  const totals =
    Object.fromEntries(
      [
        ...new Set(
          rows.map(
            (row) =>
              row.amount
                .currency,
          ).filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
        ),
      ].map(
        (code) => [
          code,
          sumMoney(
            rows
              .filter(
                (row) =>
                  row.amount
                    .currency ===
                  code,
              )
              .map(
                (row) =>
                  row.amount,
              ),
          ),
        ],
      ),
    );
  return available(
    "commitment-tracking",
    {
      schemaVersion: "1.0",
      projectionKey:
        "commitment_tracking",
      projectId:
        state.projectId,
      commitmentCount:
        rows.length,
      totalsByCurrency:
        totals,
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "No governed PO/subcontract/service-agreement commitment register is established.",
      dependencies: [
        "commitment register",
      ],
    },
  );
}

function accruals(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .accruals;
  return available(
    "accruals",
    {
      schemaVersion: "1.0",
      projectionKey:
        "accruals",
      projectId:
        state.projectId,
      accrualCount:
        rows.length,
      unmatchedCount:
        rows.filter(
          (row) =>
            !row.matchedInvoiceId,
        ).length,
      reversalMissingCount:
        rows.filter(
          (row) =>
            row.status ===
              "reversed" &&
            !row.reversalIso,
        ).length,
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "Accrual evidence is not established. Incurred cost must not be treated as complete without accruals.",
      dependencies: [
        "accrual register",
      ],
    },
  );
}

function contingency(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .contingency;
  return available(
    "contingency-reserve",
    {
      schemaVersion: "1.0",
      projectionKey:
        "contingency_reserve",
      projectId:
        state.projectId,
      reserveCount:
        rows.length,
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "No governed contingency / management reserve register is established.",
      dependencies: [
        "reserve register",
        "approval records",
      ],
    },
  );
}

function priceAdjustment(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .priceAdjustments;
  return available(
    "price-adjustment",
    {
      schemaVersion: "1.0",
      projectionKey:
        "price_adjustment",
      projectId:
        state.projectId,
      adjustmentCount:
        rows.length,
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "No governed escalation/price-adjustment evidence is established.",
      dependencies: [
        "price adjustment formula",
        "indices",
      ],
    },
  );
}

function vatTax(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .taxes;
  const sourceVatBases = [
    ...new Set(
      [
        ...state.commercial
          .costEvmSnapshots.map(
            (row) =>
              row.vatBasis,
          ),
        ...state.commercial
          .paymentCertificates.map(
            (row) =>
              row.vatBasis,
          ),
      ].filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      ),
    ),
  ];
  return available(
    "vat-tax",
    {
      schemaVersion: "1.0",
      projectionKey:
        "vat_tax",
      projectId:
        state.projectId,
      taxRecordCount:
        rows.length,
      sourceVatBases,
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : sourceVatBases.length >
              0
            ? "partial"
            : "partial",
      reason:
        rows.length > 0
          ? null
          : sourceVatBases.length > 0
            ? "VAT basis labels exist in cost/payment evidence, but a governed tax invoice/tax-treatment register is not established."
            : "VAT/tax treatment is not established.",
      dependencies: [
        "tax treatment",
        "tax invoice register",
      ],
    },
  );
}

function multiCurrency(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const currencies =
    new Set<string>();
  const add = (
    value:
      string |
      null |
      undefined,
  ) => {
    if (value) {
      currencies.add(
        value,
      );
    }
  };
  add(
    c.contractTerms
      .originalContractValue
      ?.currency,
  );
  add(
    c.contractTerms
      .currentContractValue
      ?.currency,
  );
  c.costEvmSnapshots
    .forEach(
      (row) =>
        add(row.currency),
    );
  c.paymentCertificates
    .forEach(
      (row) =>
        add(
          row.netCertified
            ?.currency,
        ),
    );
  c.variations
    .forEach(
      (row) =>
        add(
          row
            .approvedContractSumImpact
            ?.currency,
        ),
    );

  return available(
    "multi-currency",
    {
      schemaVersion: "1.0",
      projectionKey:
        "multi_currency",
      projectId:
        state.projectId,
      currencies: [
        ...currencies,
      ].sort(),
      fxRateCount:
        c.fxRates.length,
      fxRates:
        c.fxRates,
      aggregationRule:
        "never cross-sum currencies without governed FX conversion",
    },
    {
      status:
        currencies.size <= 1
          ? "ready"
          : c.fxRates.length >
              0
            ? "ready"
            : "partial",
      reason:
        currencies.size <= 1
          ? null
          : c.fxRates.length > 0
            ? null
            : "Multiple currencies exist but governed FX rates are not established. CMeng will not cross-sum them.",
      dependencies: [
        "FX source/date when multi-currency",
      ],
    },
  );
}

function costAuditTrail(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const rows =
    state.commercial
      .costAuditTrail;
  return available(
    "cost-audit-trail",
    {
      schemaVersion: "1.0",
      projectionKey:
        "cost_audit_trail",
      projectId:
        state.projectId,
      changeCount:
        rows.length,
      rows,
    },
    {
      status:
        rows.length > 0
          ? "ready"
          : "partial",
      reason:
        rows.length > 0
          ? null
          : "Canonical source receipts exist, but a dedicated before/after user mutation audit register is not yet populated.",
      dependencies: [
        "cost mutation audit records",
      ],
    },
  );
}

function reconciliation(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const original =
    c.contractTerms
      .originalContractValue;
  const approved =
    approvedVariationTotal(c);
  const current =
    c.contractTerms
      .currentContractValue;
  const payments =
    paymentTotals(c);

  const bridgeDifference =
    amount(original) !==
      null &&
    approved.amount !==
      null &&
    amount(current) !==
      null &&
    currency(original) &&
    currency(original) ===
      approved.currency &&
    approved.currency ===
      currency(current)
      ? Number(
          (
            amount(original)! +
            approved.amount! -
            amount(current)!
          ).toFixed(6),
        )
      : null;

  return available(
    "commercial-reconciliation",
    {
      schemaVersion: "1.0",
      projectionKey:
        "commercial_reconciliation",
      projectId:
        state.projectId,
      moneyFlow: {
        originalContract:
          original,
        approvedVariations:
          approved,
        currentContract:
          current,
        certified:
          payments.certified,
        paid:
          payments.paid,
        outstanding:
          payments.outstanding,
      },
      contractBridgeDifference:
        bridgeDifference,
      contractBridgeState:
        bridgeDifference === null
          ? "not_assessable"
          : Math.abs(
              bridgeDifference,
            ) < 0.01
            ? "reconciled"
            : "difference",
      paymentBridgeState:
        payments
          .outstanding
          .state,
      warnings: [
        ...(payments
          .outstanding
          .state ===
          "receipts_missing"
          ? [
              "PAID_AND_OUTSTANDING_NOT_ESTABLISHED_WITHOUT_PAYMENT_RECEIPTS",
            ]
          : []),
      ],
    },
    {
      status:
        bridgeDifference !==
          null &&
        payments.certified
          .state ===
          "established"
          ? "partial"
          : "partial",
      reason:
        payments.paid.state ===
        "missing"
          ? "Contract and certification positions can be reconciled, but paid/outstanding balances require receipt evidence."
          : "Commercial reconciliation remains partial until contract, variations, certification, receipts and final account all close.",
      dependencies: [
        "contract",
        "variations",
        "certificates",
        "receipts",
      ],
    },
  );
}

function costPosition(
  state:
    ProjectRuntimeState,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const cash =
    c.cashFlow;
  const byCurrency =
    new Map<
      string,
      {
        inflow: number;
        outflow: number;
        current: number;
        minimum: number;
      }
    >();

  for (const row of cash) {
    const entry =
      byCurrency.get(
        row.currency,
      ) ?? {
        inflow: 0,
        outflow: 0,
        current: 0,
        minimum: 0,
      };
    entry.inflow +=
      row.paidIncome ??
      0;
    entry.outflow +=
      row.actualExpenditure ??
      0;
    entry.current =
      entry.inflow -
      entry.outflow;
    entry.minimum =
      Math.min(
        entry.minimum,
        entry.current,
      );
    byCurrency.set(
      row.currency,
      entry,
    );
  }

  return available(
    "cost-position",
    {
      schemaVersion: "1.0",
      projectionKey:
        "cost_position",
      projectId:
        state.projectId,
      positions:
        Object.fromEntries(
          [
            ...byCurrency.entries(),
          ].map(
            ([code, row]) => [
              code,
              {
                currentCashPosition:
                  row.current,
                peakFundingNeed:
                  Math.abs(
                    Math.min(
                      0,
                      row.minimum,
                    ),
                  ),
                overdraftRequirement:
                  Math.abs(
                    Math.min(
                      0,
                      row.minimum,
                    ),
                  ),
              },
            ],
          ),
        ),
      periodCount:
        cash.length,
    },
    {
      status:
        cash.length > 0
          ? "ready"
          : "partial",
      reason:
        cash.length > 0
          ? null
          : "Cash Position cannot be inferred from certificates alone. Governed paid income and actual expenditure periods are required.",
      dependencies: [
        "cash flow",
        "receipts",
        "actual expenditure",
      ],
    },
  );
}

function genericRegisterModule(
  state:
    ProjectRuntimeState,
  key: string,
): ModuleRuntimeResult {
  const c =
    state.commercial;
  const mapping:
    Record<
      string,
      {
        projectionKey: string;
        rows: unknown[];
        dependency: string;
        extra?: Record<
          string,
          unknown
        >;
      }
    > = {
      "commitment-tracking": {
        projectionKey:
          "commitment_tracking",
        rows: c.commitments,
        dependency:
          "commitment register",
      },
      accruals: {
        projectionKey:
          "accruals",
        rows: c.accruals,
        dependency:
          "accrual register",
      },
      "contingency-reserve": {
        projectionKey:
          "contingency_reserve",
        rows: c.contingency,
        dependency:
          "contingency / reserve register",
      },
      "price-adjustment": {
        projectionKey:
          "price_adjustment",
        rows:
          c.priceAdjustments,
        dependency:
          "price-adjustment register",
      },
      "cost-audit-trail": {
        projectionKey:
          "cost_audit_trail",
        rows:
          c.costAuditTrail,
        dependency:
          "audit trail",
      },
    };
  const spec =
    mapping[key];
  if (!spec) {
    return blocked(
      key,
      "Commercial module is not registered.",
      [],
    );
  }
  return available(
    key,
    {
      schemaVersion: "1.0",
      projectionKey:
        spec.projectionKey,
      projectId:
        state.projectId,
      rowCount:
        spec.rows.length,
      rows:
        spec.rows,
      ...(spec.extra ?? {}),
    },
    {
      status:
        spec.rows.length > 0
          ? "ready"
          : "partial",
      reason:
        spec.rows.length > 0
          ? null
          : "No governed " +
            spec.dependency +
            " is established. Missing evidence is not presented as zero.",
      dependencies: [
        spec.dependency,
      ],
    },
  );
}

export function commercialModuleForState(
  state:
    ProjectRuntimeState,
  key: string,
): ModuleRuntimeResult {
  if (
    !commercialModules.some(
      (module) =>
        module.key === key,
    )
  ) {
    return blocked(
      key,
      "Unknown Commercial module.",
      [],
    );
  }

  switch (key) {
    case "commercial-terms":
      return commercialTerms(
        state,
      );
    case "cost-register":
      return costRegister(
        state,
      );
    case "payment-register":
      return paymentRegister(
        state,
      );
    case "cbs-breakdown":
      return cbsBreakdown(
        state,
      );
    case "cost-control":
      return costControl(
        state,
      );
    case "evm-performance":
      return evmPerformance(
        state,
      );
    case "cash-flow":
      return cashFlow(
        state,
      );
    case "cost-scurve":
      return costScurve(
        state,
      );
    case "variations":
      return variations(
        state,
      );
    case "site-instructions":
      return siteInstructions(
        state,
      );
    case "contract-obligations":
      return contractObligations(
        state,
      );
    case "liquidated-damages":
      return liquidatedDamages(
        state,
      );
    case "bonds-insurance":
      return bondsInsurance(
        state,
      );
    case "retention-calendar":
      return retentionCalendar(
        state,
      );
    case "final-account":
      return finalAccount(
        state,
      );
    case "earned-schedule":
      return earnedSchedule(
        state,
      );
    case "evm-by-wbs":
      return evmByWbs(
        state,
      );
    case "commercial-risk-register":
      return commercialRisk(
        state,
      );
    case "monte-carlo-risk":
      return monteCarlo(
        state,
      );
    case "contract-risk":
      return contractRisk(
        state,
      );
    case "tender-readiness":
      return tenderReadiness(
        state,
      );
    case "commitment-tracking":
      return commitments(
        state,
      );
    case "accruals":
      return accruals(
        state,
      );
    case "contingency-reserve":
      return contingency(
        state,
      );
    case "price-adjustment":
      return priceAdjustment(
        state,
      );
    case "vat-tax":
      return vatTax(
        state,
      );
    case "multi-currency":
      return multiCurrency(
        state,
      );
    case "cost-audit-trail":
      return costAuditTrail(
        state,
      );
    case "commercial-reconciliation":
      return reconciliation(
        state,
      );
    case "cost-position":
      return costPosition(
        state,
      );
    default:
      return genericRegisterModule(
        state,
        key,
      );
  }
}

export function commercialModuleForProject(
  projectId: string,
  key: string,
): ModuleRuntimeResult {
  const state =
    runtimeProjects.get(
      projectId,
    );
  if (!state) {
    return blocked(
      key,
      "Project not found.",
      [],
    );
  }
  return commercialModuleForState(
    state,
    key,
  );
}

export function commercialOverviewForProject(
  projectId: string,
) {
  const state =
    runtimeProjects.get(
      projectId,
    );
  if (!state) {
    return null;
  }
  const modules =
    commercialModules.map(
      (module) =>
        commercialModuleForState(
          state,
          module.key,
        ),
    );
  return {
    projectId:
      state.projectId,
    moduleCount:
      modules.length,
    readyCount:
      modules.filter(
        (module) =>
          module.status ===
          "ready",
      ).length,
    partialCount:
      modules.filter(
        (module) =>
          module.status ===
          "partial",
      ).length,
    blockedCount:
      modules.filter(
        (module) =>
          module.status ===
          "blocked",
      ).length,
    moduleStates:
      modules.map(
        (module) => ({
          key:
            module.key,
          status:
            module.status,
          reason:
            module.reason,
        }),
      ),
  };
}
