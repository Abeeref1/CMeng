import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContractControls,
  type ContractControlsInput,
  type ContractControlMoney,
} from "../packages/commercial-contract-controls/src";
import type {
  CommercialFinding,
} from "../packages/commercial-foundation/src";

function finding<T>(
  value: T | null,
  state:
    CommercialFinding<T>["state"] =
    value === null
      ? "missing"
      : "established",
): CommercialFinding<T> {
  return {
    value,
    basis: {
      asOfDate: "2026-08-31",
      method: "test",
      sourceRefs:
        value === null
          ? []
          : ["test:source"],
    },
    coverage: {
      known:
        value === null ? 0 : 1,
      total: 1,
      percent:
        value === null ? 0 : 100,
    },
    authority:
      value === null
        ? "missing"
        : state === "candidate"
          ? "candidate"
          : "source",
    submitted: value,
    independent: null,
    gap: null,
    consequence: null,
    action: null,
    state,
    diagnostics: [],
  };
}

function money(
  value: number | null,
  currency = "AED",
): ContractControlMoney {
  return {
    value,
    currency,
    state:
      value === null
        ? "missing"
        : "official",
    asOf: "2026-08-31",
    sourceRefs:
      value === null
        ? []
        : ["test:money"],
  };
}

function input():
  ContractControlsInput {
  return {
    projectId: "C2B2-UAT",
    generatedAt:
      "2026-09-21T17:00:00.000Z",
    dataDateIso: "2026-08-31",
    variations: [
      {
        variationId: "VO-001",
        description:
          "Employer instructed design change",
        status: "Approved",
        authority: "Engineer",
        instructionId: "SI-001",
        instructionDate:
          "2026-07-01",
        submittedDate:
          "2026-07-10",
        quotationDate:
          "2026-07-12",
        assessedDate:
          "2026-07-20",
        agreedDate:
          "2026-07-25",
        approvalDate:
          "2026-07-31",
        scheduleImpactDays: 5,
        claimId: "CLM-001",
        paymentId: "IPC-08",
        activityIds: [
          "A100",
          "A110",
        ],
        clauseIdentifiers: [
          "13.3",
        ],
        claimedAmount:
          money(500_000),
        assessedAmount:
          money(450_000),
        agreedAmount:
          money(425_000),
        approvedAmount:
          money(400_000),
        sourceRefs: [
          "test:vo",
        ],
      },
    ],
    siteInstructions: [
      {
        instructionId: "SI-002",
        description:
          "Revise drainage route",
        issueDate:
          "2026-08-01",
        status: "Open",
        variationId: null,
        quotationDueDate:
          "2026-08-10",
        quotationDate: null,
        scheduleImpactDays: null,
        claimId: null,
        paymentId: null,
        activityIds: [],
        clauseIdentifiers: [
          "13.1",
        ],
        estimatedAmount:
          money(100_000),
        sourceRefs: [
          "test:si",
        ],
      },
    ],
    obligations: [
      {
        obligationId:
          "OBL-001",
        clauseIdentifier:
          "4.2",
        description:
          "Renew performance security",
        responsibleParty:
          "Contractor",
        dueDate:
          "2026-08-15",
        completedDate: null,
        status: "Open",
        evidenceReference: null,
        sourceRefs: [
          "test:obligation",
        ],
      },
    ],
    contractClauses: [
      {
        clauseKey:
          "clause:insurance",
        identifier: "18.2",
        heading: "Insurance",
        governanceState:
          "effective",
        textPreview:
          "The Contractor shall maintain third-party liability insurance throughout the Works.",
        sourceRef:
          "test:clause",
      },
    ],
    bonds: [
      {
        bondId: "BG-01",
        kind: "performance",
        status: "active",
        expiryIso:
          "2026-08-20",
        amount: 1_000_000,
        currency: "AED",
        sourceRefs: [
          "test:bond",
        ],
      },
    ],
    insurances: [
      {
        policyId: "POL-01",
        kind:
          "third_party_liability",
        insurer: "Insurer",
        status: "Active",
        inceptionDate:
          "2026-01-01",
        expiryDate:
          "2026-09-15",
        coverageAmount:
          money(5_000_000),
        sourceRequirement:
          "Clause 18.2",
        sourceRefs: [
          "test:insurance",
        ],
      },
    ],
    retentions: [
      {
        retentionId: "RET-01",
        certificateNo:
          "IPC-07",
        state: "Held",
        trigger:
          "Taking Over Certificate",
        dueDate:
          "2026-08-15",
        releaseDate: null,
        amount:
          money(200_000),
        sourceRefs: [
          "test:retention",
        ],
      },
    ],
    existingRetentions: [
      {
        retentionId:
          "RET-CONTROL",
        state: "held",
        amount: 300_000,
        currency: "AED",
        sourceRefs: [
          "test:retention-control",
        ],
      },
    ],
    paymentRetentions: [
      {
        paymentId: "IPC-08",
        periodEnd:
          "2026-08-31",
        retentionDeduction:
          money(25_000),
        retentionReleaseDate:
          null,
        sourceRefs: [
          "test:ipc",
        ],
      },
    ],
    retentionPercent:
      finding(10),
    retentionCapPercent:
      finding(5),
    performanceBondRequirement:
      finding(
        "Performance bond 10% of Accepted Contract Amount",
      ),
    advancePaymentBondRequirement:
      finding(
        "Advance payment guarantee for outstanding advance",
      ),
    insuranceRequirementCount: 1,
    ldTerms: {
      rateState: "candidate",
      capState: "candidate",
      rate: {
        basis:
          "fixed_amount_per_day",
        amount: 10_000,
        currency: "AED",
        percent: null,
        sourceRefs: [
          "test:ld-rate",
        ],
      },
      cap: {
        basis:
          "percent_contract_amount",
        amount: null,
        currency: null,
        percent: 10,
        sourceRefs: [
          "test:ld-cap",
        ],
      },
      diagnostics: [],
    },
    contractValues: [
      {
        currency: "AED",
        value: 10_000_000,
        state: "established",
        sourceRefs: [
          "test:contract-value",
        ],
      },
    ],
    ldTime: {
      contractualCompletionIso:
        "2027-01-31",
      contractualCompletionState:
        "official",
      programmeCompletionIso:
        "2027-02-20",
      programmeCompletionMethod:
        "schedule_analytics_completion_basis:forecast",
      programmeSourceRefs: [
        "test:schedule",
      ],
      awardedEotDays: null,
      awardedEotState:
        "official",
      awardedOverlapResolution:
        "unresolved",
      eotSourceRefs: [
        "test:eot",
      ],
    },
  };
}

test("C2B2 Variations preserve claimed assessed agreed approved cost and schedule/claim/payment links", () => {
  const p =
    buildContractControls(
      input(),
    );
  const row =
    p.variations.rows[0]!;
  assert.equal(
    p.producerVersion,
    "commercial-contract-controls-v1",
  );
  assert.equal(
    row.lifecycleStage,
    "approved",
  );
  assert.equal(
    row.cost.claimed.value,
    500_000,
  );
  assert.equal(
    row.cost.assessed.value,
    450_000,
  );
  assert.equal(
    row.cost.agreed.value,
    425_000,
  );
  assert.equal(
    row.cost.approved.value,
    400_000,
  );
  assert.equal(
    row.scheduleImpactDays.value,
    5,
  );
  assert.equal(
    row.claimId,
    "CLM-001",
  );
  assert.equal(
    row.paymentId,
    "IPC-08",
  );
  assert.deepEqual(
    row.activityIds,
    ["A100", "A110"],
  );
  assert.equal(
    row.linkageCoveragePercent,
    100,
  );
  assert.equal(
    p.variations
      .lifecycleStageCounts
      .approved,
    1,
  );
  assert.deepEqual(
    p.variations
      .pendingAgeBands,
    {
      upTo30Days: 0,
      days31To60: 0,
      days61To90: 0,
      over90Days: 0,
      unknown: 0,
    },
  );
});

test("C2B2 Variations publish pending lifecycle age bands from governed lifecycle dates", () => {
  const value = input();
  const approved =
    value.variations[0]!;
  value.variations.push({
    ...approved,
    variationId:
      "VO-002",
    status: "Submitted",
    instructionId:
      "SI-002",
    instructionDate:
      "2026-07-01",
    submittedDate:
      "2026-08-20",
    quotationDate: null,
    assessedDate: null,
    agreedDate: null,
    approvalDate: null,
    scheduleImpactDays: null,
    claimId: null,
    paymentId: null,
    activityIds: [],
    claimedAmount:
      money(250_000),
    assessedAmount:
      money(null),
    agreedAmount:
      money(null),
    approvedAmount:
      money(null),
    sourceRefs: [
      "test:vo-002",
    ],
  });
  const variations =
    buildContractControls(
      value,
    ).variations;
  assert.equal(
    variations
      .lifecycleStageCounts
      .submitted,
    1,
  );
  assert.equal(
    variations.pendingCount,
    1,
  );
  assert.deepEqual(
    variations.pendingAgeBands,
    {
      upTo30Days: 1,
      days31To60: 0,
      days61To90: 0,
      over90Days: 0,
      unknown: 0,
    },
  );
});

test("C2B2 Site Instructions age open quotations without turning instructions into variations", () => {
  const p =
    buildContractControls(
      input(),
    );
  const row =
    p.siteInstructions
      .rows[0]!;
  assert.equal(
    row.quotationTimeliness,
    "late",
  );
  assert.equal(
    row.openAgeDays.value,
    30,
  );
  assert.equal(
    row.variationId,
    null,
  );
  assert.equal(
    p.siteInstructions
      .overdueQuotationCount,
    1,
  );
  assert.ok(
    p.siteInstructions
      .diagnostics.includes(
        "SITE_INSTRUCTION_IS_NOT_AUTOMATICALLY_A_VARIATION_OR_ENTITLEMENT",
      ),
  );
});

test("C2B2 Contract Obligations keep explicit compliance separate from clause-derived candidates", () => {
  const p =
    buildContractControls(
      input(),
    );
  assert.equal(
    p.contractObligations
      .explicitRecordCount,
    1,
  );
  assert.equal(
    p.contractObligations
      .clauseCandidateCount,
    1,
  );
  assert.equal(
    p.contractObligations
      .overdueCount,
    1,
  );
  assert.equal(
    p.contractObligations
      .openCount,
    0,
  );
  const explicit =
    p.contractObligations
      .rows.find(
        (row) =>
          row.origin ===
          "explicit_register",
      );
  const candidate =
    p.contractObligations
      .rows.find(
        (row) =>
          row.origin ===
          "contract_clause_candidate",
      );
  assert.equal(
    explicit?.status,
    "overdue",
  );
  assert.equal(
    candidate?.status,
    "candidate",
  );
  assert.equal(
    candidate?.dueDate,
    null,
  );
});

test("C2B2 LD scenarios only use no-EOT and governed awarded-EOT time bases and fail closed on unresolved award overlap", () => {
  const p =
    buildContractControls(
      input(),
    );
  const ld =
    p.liquidatedDamages;
  assert.equal(
    ld.scenarios.length,
    2,
  );
  const noEot =
    ld.scenarios.find(
      (row) =>
        row.scenario ===
        "no_eot",
    )!;
  const awarded =
    ld.scenarios.find(
      (row) =>
        row.scenario ===
        "awarded_eot",
    )!;

  assert.equal(
    noEot.exposureDays.value,
    20,
  );
  assert.equal(
    noEot.uncappedExposure
      .value,
    200_000,
  );
  assert.equal(
    noEot.capAmount.value,
    1_000_000,
  );
  assert.equal(
    noEot.cappedExposure
      .value,
    200_000,
  );
  assert.deepEqual(
    ld.scenarios.map(
      (row) => row.scenario,
    ),
    ["no_eot", "awarded_eot"],
  );
  assert.ok(
    ld.diagnostics.includes(
      "CLAIM_REGISTER_DAY_SUMS_ARE_NOT_PROJECT_EOT_AND_NEVER_ADJUST_COMPLETION",
    ),
  );
  assert.equal(
    awarded.eotDays.value,
    null,
  );
  assert.equal(
    awarded.cappedExposure
      .value,
    null,
  );
  assert.ok(
    awarded.diagnostics.includes(
      "AWARDED_EOT_NOT_APPLIED_WHILE_AMENDMENT_DETERMINATION_OVERLAP_UNRESOLVED",
    ),
  );
});

test("C2B2 capped LD remains missing when the cap is missing", () => {
  const value = input();
  value.ldTerms = {
    ...value.ldTerms!,
    capState: "missing",
    cap: null,
  };
  const ld =
    buildContractControls(
      value,
    ).liquidatedDamages;
  const noEot =
    ld.scenarios.find(
      (row) =>
        row.scenario ===
        "no_eot",
    )!;
  assert.equal(
    noEot.uncappedExposure
      .value,
    200_000,
  );
  assert.equal(
    noEot.cappedExposure
      .value,
    null,
  );
});

test("C2B2 Bonds and Insurance expose expiry risk without treating securities as cash balances", () => {
  const p =
    buildContractControls(
      input(),
    );
  assert.equal(
    p.bondsInsurance.state,
    "partial",
    "known performance/advance security requirements remain a gap when current valid instruments are not established",
  );
  assert.equal(
    p.bondsInsurance
      .expiredBondCount,
    1,
  );
  assert.equal(
    p.bondsInsurance
      .expiringInsuranceCount,
    1,
  );
  assert.equal(
    p.bondsInsurance
      .bonds[0]
      ?.daysToExpiry.value,
    -11,
  );
  assert.equal(
    p.bondsInsurance
      .insurances[0]
      ?.daysToExpiry.value,
    15,
  );
  assert.ok(
    p.bondsInsurance
      .diagnostics.includes(
        "BOND_VALUE_IS_NOT_ADVANCE_OR_RETENTION_CASH_BALANCE",
      ),
  );
  assert.ok(
    p.bondsInsurance
      .diagnostics.includes(
        "PERFORMANCE_SECURITY_REQUIREMENT_NOT_SATISFIED_BY_CURRENT_VALID_BOND",
      ),
  );
  assert.ok(
    p.bondsInsurance
      .diagnostics.includes(
        "ADVANCE_PAYMENT_SECURITY_REQUIREMENT_NOT_SATISFIED_BY_CURRENT_VALID_BOND",
      ),
  );
});

test("C2B2 Retention Calendar never invents release dates from percentages or deductions", () => {
  const p =
    buildContractControls(
      input(),
    );
  const calendar =
    p.retentionCalendar;
  assert.equal(
    calendar.retentionPercent
      .value,
    10,
  );
  assert.equal(
    calendar.retentionCapPercent
      .value,
    5,
  );
  assert.equal(
    calendar.overdueCount,
    null,
    "aggregate overdue retention must be withheld when some unreleased retention rows have no governed due date",
  );
  const controlled =
    calendar.rows.find(
      (row) =>
        row.origin ===
        "governed_control",
    );
  const payment =
    calendar.rows.find(
      (row) =>
        row.origin ===
        "payment_deduction",
    );
  assert.equal(
    controlled?.dueDate.value,
    null,
  );
  assert.equal(
    payment?.dueDate.value,
    null,
  );
  assert.ok(
    calendar.diagnostics.includes(
      "RELEASE_DATE_IS_NEVER_INFERRED_FROM_PERCENTAGE_WITHOUT_A_TRIGGER_EVENT",
    ),
  );
  assert.ok(
    calendar.diagnostics.includes(
      "RETENTION_OVERDUE_NOT_ASSESSABLE_WITHOUT_RELEASE_DUE_DATES",
    ),
  );
});
