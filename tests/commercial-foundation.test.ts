import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCommercialFoundation,
  type CommercialFoundationInput,
  type FoundationMoneyInput,
} from "../packages/commercial-foundation/src";

function money(
  value: number | null,
  currency = "AED",
  asOf = "2026-08-31",
): FoundationMoneyInput {
  return {
    value,
    currency,
    taxBasis: "exclusive",
    amountBasis: "source",
    state:
      value === null
        ? "missing"
        : "official",
    asOf,
    sourceRefs: [
      "evidence-document:COST:row:2",
    ],
  };
}

function input(): CommercialFoundationInput {
  return {
    projectId: "C2A-UAT",
    generatedAt:
      "2026-09-21T12:00:00.000Z",
    dataDateIso: "2026-08-31",
    contractValue: {
      amount: 10_000_000,
      currency: "AED",
      sourceRefs: [
        "evidence-document:CONTRACT:page:1",
      ],
      authority: "approved",
    },
    contractValueCandidates: [],
    variations: [
      {
        variationId: "VO-001",
        state: "approved",
        amount: 500_000,
        currency: "AED",
        sourceRefs: [
          "evidence-document:VO:row:2",
        ],
      },
    ],
    contractTimeBasis: {
      contractualCompletionIso:
        "2027-12-31",
      contractualCompletionState:
        "official",
      sourceRefs: [
        "evidence-document:AMD:page:2",
      ],
    },
    ldTerms: {
      rateState: "candidate",
      capState: "candidate",
      rate: {
        basis:
          "fixed_amount_per_day",
        amount: 25_000,
        currency: "AED",
        percent: null,
        sourceRefs: [
          "evidence-document:CONTRACT:page:12",
        ],
      },
      cap: {
        basis:
          "percent_contract_amount",
        amount: null,
        currency: null,
        percent: 10,
        sourceRefs: [
          "evidence-document:CONTRACT:page:12",
        ],
      },
      diagnostics: [],
    },
    contractSections: [
      {
        documentId: "CONTRACT",
        documentRole: "main",
        basisState: "active",
        revision: "R1",
        sourceHash: "h1",
        sectionKey: "clause:1",
        identifier: "1",
        parentIdentifier: null,
        heading: "Contract Data",
        text:
          "Contract currency is AED. Retention rate is 10%.",
        startPage: 1,
        sourceMode: "deterministic",
        sectionStatus: "verified",
      },
      {
        documentId: "CONTRACT",
        documentRole: "main",
        basisState: "active",
        revision: "R1",
        sourceHash: "h1",
        sectionKey: "clause:2",
        identifier: "2",
        parentIdentifier: null,
        heading: "Retention cap",
        text:
          "Retention shall not exceed 5% of the Accepted Contract Amount.",
        startPage: 2,
        sourceMode: "deterministic",
        sectionStatus: "verified",
      },
      {
        documentId: "CONTRACT",
        documentRole: "main",
        basisState: "active",
        revision: "R1",
        sourceHash: "h1",
        sectionKey: "clause:3",
        identifier: "3",
        parentIdentifier: null,
        heading: "Certification and payment",
        text:
          "The Engineer shall certify within 7 days. Payment shall be made within 28 days.",
        startPage: 3,
        sourceMode: "deterministic",
        sectionStatus: "verified",
      },
      {
        documentId: "CONTRACT",
        documentRole: "main",
        basisState: "active",
        revision: "R1",
        sourceHash: "h1",
        sectionKey: "clause:4",
        identifier: "4",
        parentIdentifier: null,
        heading: "Notice",
        text:
          "The Contractor shall give notice within 14 days.",
        startPage: 4,
        sourceMode: "deterministic",
        sectionStatus: "verified",
      },
      {
        documentId: "CONTRACT",
        documentRole: "main",
        basisState: "active",
        revision: "R1",
        sourceHash: "h1",
        sectionKey: "clause:5",
        identifier: "5",
        parentIdentifier: null,
        heading: "Performance Security",
        text:
          "The Contractor shall provide a performance bond equal to 10% of the Accepted Contract Amount.",
        startPage: 5,
        sourceMode: "deterministic",
        sectionStatus: "verified",
      },
      {
        documentId: "CONTRACT",
        documentRole: "main",
        basisState: "active",
        revision: "R1",
        sourceHash: "h1",
        sectionKey: "clause:6",
        identifier: "6",
        parentIdentifier: null,
        heading: "Advance Payment Security",
        text:
          "An advance-payment bond shall be maintained for the outstanding advance.",
        startPage: 6,
        sourceMode: "deterministic",
        sectionStatus: "verified",
      },
      {
        documentId: "CONTRACT",
        documentRole: "main",
        basisState: "active",
        revision: "R1",
        sourceHash: "h1",
        sectionKey: "clause:7",
        identifier: "7",
        parentIdentifier: null,
        heading: "Insurance",
        text:
          "The Contractor shall maintain third-party liability insurance.",
        startPage: 7,
        sourceMode: "deterministic",
        sectionStatus: "verified",
      },
      {
        documentId: "CONTRACT",
        documentRole: "main",
        basisState: "active",
        revision: "R1",
        sourceHash: "h1",
        sectionKey: "clause:8",
        identifier: "8",
        parentIdentifier: null,
        heading: "Order of Precedence",
        text:
          "The order of precedence shall be Agreement, Particular Conditions, General Conditions and Specifications.",
        startPage: 8,
        sourceMode: "deterministic",
        sectionStatus: "verified",
      },
    ],
    amendments: [
      {
        documentId: "AMD-01",
        effectiveDate: "2026-08-01",
        completionIso: "2027-12-31",
        incorporatedEotDays: 30,
        state: "official",
        sourceRefs: [
          "evidence-document:AMD-01:page:1",
        ],
        actions: [
          {
            targetIdentifier: "3",
            action: "amend",
            status: "resolved",
          },
        ],
      },
    ],
    costMetrics: [
      {
        metric: "BAC",
        amount: money(
          6_000_000,
        ),
        sourceStatus: "Approved",
        cbsId: "C01",
        cbsDescription:
          "Civil Works",
        parentCbsId: null,
        wbsId: "WBS-CIVIL",
        counterparty: null,
        boqItemId: "BOQ-001",
        paymentId: null,
      },
      {
        metric: "AC",
        amount: money(
          2_000_000,
        ),
        sourceStatus: "Actual",
        cbsId: "C01",
        cbsDescription:
          "Civil Works",
        parentCbsId: null,
        wbsId: "WBS-CIVIL",
        counterparty: null,
        boqItemId: "BOQ-001",
        paymentId: "IPC-001",
      },
      {
        metric: "BAC",
        amount: money(
          4_000_000,
        ),
        sourceStatus: "Approved",
        cbsId: "C02",
        cbsDescription:
          "MEP Works",
        parentCbsId: null,
        wbsId: "WBS-MEP",
        counterparty: null,
        boqItemId: "BOQ-002",
        paymentId: null,
      },
    ],
    payments: [
      {
        paymentId: "IPC-001",
        paymentType: "IPC",
        periodEnd: "2026-08-31",
        sourceStatus: "Certified",
        certifiedAmountBasis: "incremental",
        paidAmountBasis: "incremental",
        applicationDate: "2026-08-01",
        assessmentDate: "2026-08-05",
        certificationDate: "2026-08-10",
        certificationDueDate: null,
        paymentDueDate: null,
        paymentDate: "2026-09-05",
        paymentTimestamp:
          "2026-09-05T10:30:00+04:00",
        retentionReleaseDate: null,
        finalReceiptDate: null,
        paymentReference: "PAY-001",
        amounts: {
          applicationAmount:
            money(1_200_000),
          engineerAssessedAmount:
            money(1_150_000),
          employerCertifiedAmount:
            money(1_100_000),
          paidAmount:
            money(1_050_000),
        },
        calculatedOutstandingAmount:
          money(50_000),
        reconciliation: "matched",
        diagnostics: [],
        sourceRefs: [
          "evidence-document:IPC:row:2",
        ],
      },
    ],
  };
}

test("C2A Commercial Terms preserve governance, amendments and evidence-safe universal findings", () => {
  const result =
    buildCommercialFoundation(
      input(),
    );
  const terms =
    result.commercialTerms;

  assert.equal(
    result.producerVersion,
    "commercial-foundation-v1",
  );
  assert.equal(
    terms.contractCurrency.value,
    "AED",
  );
  assert.equal(
    terms.contractCurrency
      .authority,
    "approved",
  );
  assert.equal(
    terms.retentionPercent.value,
    10,
  );
  assert.equal(
    terms.retentionCapPercent
      .value,
    5,
  );
  assert.equal(
    terms.certificationPeriodDays
      .value,
    7,
  );
  assert.equal(
    terms.paymentPeriodDays.value,
    28,
  );
  assert.equal(
    terms.noticePeriodDays.value,
    14,
  );
  assert.equal(
    terms.insuranceRequirements
      .length,
    1,
  );
  assert.equal(
    terms
      .hierarchyAndPrecedenceClauses
      .length,
    1,
  );
  assert.equal(
    terms.amendments[0]
      ?.actions[0]
      ?.targetIdentifier,
    "3",
  );
  assert.equal(
    terms
      .originalContractValueByCurrency[0]
      ?.current.value,
    10_500_000,
  );
  assert.ok(
    terms.clauses.every(
      (clause) =>
        clause.governanceState ===
        "effective",
    ),
  );

  const universal =
    terms.paymentPeriodDays;
  assert.ok(universal.basis);
  assert.ok(universal.coverage);
  assert.equal(
    universal.submitted,
    28,
  );
  assert.equal(
    universal.independent,
    null,
  );
  assert.equal(
    universal.gap,
    null,
  );
  assert.equal(
    universal.state,
    "established",
  );
});

test("C2A Cost Register and CBS Breakdown preserve hierarchy, mappings, currency and source authority", () => {
  const result =
    buildCommercialFoundation(
      input(),
    );
  const cost =
    result.costRegister;
  const cbs =
    result.cbsBreakdown;

  assert.equal(
    cost.state,
    "established",
  );
  assert.equal(
    cost.mappingCoveragePercent,
    100,
  );
  assert.equal(
    cost.recordCount,
    2,
  );
  assert.equal(
    cbs.nodeCount,
    2,
  );
  assert.equal(
    cbs.mappingCoveragePercent,
    100,
  );
  const civil =
    cbs.nodes.find(
      (node) =>
        node.costCode === "C01",
    );
  assert.ok(civil);
  assert.deepEqual(
    civil?.wbsIds,
    ["WBS-CIVIL"],
  );
  assert.deepEqual(
    civil?.boqItemIds,
    ["BOQ-001"],
  );
  assert.deepEqual(
    civil?.paymentIds,
    ["IPC-001"],
  );
});

test("C2A Payment Register keeps application, assessment, certification and payment separate and calculates SLA dates only from evidenced terms", () => {
  const result =
    buildCommercialFoundation(
      input(),
    );
  const register =
    result.paymentRegister;
  const row =
    register.rows[0]!;

  assert.equal(
    register.recordCount,
    1,
  );
  assert.equal(
    register.stageCoveragePercent,
    100,
  );
  assert.deepEqual(
    register.lifecycleCounts,
    {
      applied: 1,
      assessed: 1,
      certified: 1,
      paid: 1,
    },
  );
  assert.deepEqual(
    register.slaCounts,
    {
      paidOnTime: 1,
      paidLate: 0,
      overdueUnpaid: 0,
      openUnpaid: 0,
      notEstablished: 0,
    },
  );
  assert.equal(
    row.amounts
      .applicationAmount
      ?.value,
    1_200_000,
  );
  assert.equal(
    row.amounts
      .engineerAssessedAmount
      ?.value,
    1_150_000,
  );
  assert.equal(
    row.amounts
      .employerCertifiedAmount
      ?.value,
    1_100_000,
  );
  assert.equal(
    row.amounts
      .paidAmount
      ?.value,
    1_050_000,
  );
  assert.equal(
    row.lifecycle
      .certificationDueDate
      .value,
    "2026-08-08",
  );
  assert.equal(
    row.lifecycle
      .paymentDueDate.value,
    "2026-09-07",
  );
  assert.equal(
    row.lifecycle.slaState,
    "on_time",
  );
});

test("C2A Payment Register distinguishes overdue unpaid cash from paid-late and open items", () => {
  const value = input();
  const base =
    value.payments[0]!;
  value.payments = [
    {
      ...base,
      paymentId:
        "IPC-OVERDUE",
      paymentDate: null,
      paymentTimestamp: null,
      paymentDueDate:
        "2026-08-20",
      amounts: {
        ...base.amounts,
        paidAmount:
          money(null),
      },
      calculatedOutstandingAmount:
        money(1_100_000),
    },
    {
      ...base,
      paymentId:
        "IPC-LATE-PAID",
      paymentDate:
        "2026-09-10",
      paymentTimestamp:
        "2026-09-10T10:00:00+04:00",
      paymentDueDate:
        "2026-09-01",
    },
    {
      ...base,
      paymentId:
        "IPC-OPEN",
      paymentDate: null,
      paymentTimestamp: null,
      paymentDueDate:
        "2026-09-15",
      amounts: {
        ...base.amounts,
        paidAmount:
          money(null),
      },
    },
  ];
  const register =
    buildCommercialFoundation(
      value,
    ).paymentRegister;
  assert.deepEqual(
    register.slaCounts,
    {
      paidOnTime: 0,
      paidLate: 1,
      overdueUnpaid: 1,
      openUnpaid: 1,
      notEstablished: 0,
    },
  );
  assert.equal(
    register.lifecycleCounts
      .paid,
    1,
  );
});

test("C2A missing CBS mappings stay explicit rather than disappearing or becoming zero", () => {
  const value = input();
  value.costMetrics.push({
    metric: "AC",
    amount: money(25_000),
    sourceStatus: "Actual",
    cbsId: null,
    cbsDescription: null,
    parentCbsId: null,
    wbsId: null,
    counterparty: null,
    boqItemId: null,
    paymentId: null,
  });
  const result =
    buildCommercialFoundation(
      value,
    );
  assert.equal(
    result.costRegister.state,
    "partial",
  );
  assert.equal(
    result.costRegister
      .unmappedCbsRecordCount,
    1,
  );
  assert.ok(
    (
      result.cbsBreakdown
        .diagnostics
    ).includes(
      "UNMAPPED_COST_ROWS_REMAIN_VISIBLE",
    ),
  );
});
