import assert from "node:assert/strict";
import test from "node:test";
import {securityStateAtDataDate,securityStatusAtDataDate,securityCoverage,SECURITY_EXPIRING_WINDOW_DAYS} from "../packages/truth-kernel/src";
import {buildContractControls,type ContractControlsInput,type ContractControlMoney} from "../packages/commercial-contract-controls/src";
import type {CommercialFinding} from "../packages/commercial-foundation/src";

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

function minimalContractInput():
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

test("F02 shared rule decides active, expiring, expired and released from the instrument's own dates at the Data Date", () => {
  const dd="2026-08-31";
  assert.equal(SECURITY_EXPIRING_WINDOW_DAYS,30);
  // A stored "active" status never overrides an expiry date before the Data Date.
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:"2026-07-25"},dd).state,"expired");
  assert.equal(securityStatusAtDataDate({status:"active",expiryIso:"2026-07-25"},dd),"expired");
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:"2026-09-20"},dd).state,"expiring");
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:"2026-09-30"},dd).state,"expiring");
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:"2026-10-01"},dd).state,"active");
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:"2026-08-31"},dd).state,"expiring");
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:"2027-12-31",releaseIso:"2026-08-01"},dd).state,"released");
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:"2027-12-31",releaseIso:"2026-10-01"},dd).state,"active","a future release date is not a release at the Data Date");
  assert.equal(securityStateAtDataDate({status:"Released",expiryIso:"2027-12-31"},dd).state,"released");
  // Unknown stays unknown: no expiry date or no Data Date is never active.
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:null},dd).state,"not_established");
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:"2026-07-25"},null).state,"not_established");
  assert.equal(securityStateAtDataDate({status:"active",expiryIso:null},dd).inForce,false);
});

test("F02 contract controls and Director count an expired security with a stale active status as expired, not active", () => {
  const bonds=[
    {bondId:"PB-01",kind:"performance" as const,status:"active" as const,expiryIso:"2027-12-31",amount:21_000_000,currency:"SAR",sourceRefs:["test:pb"]},
    {bondId:"APG-01",kind:"advance_payment" as const,status:"active" as const,expiryIso:"2026-07-25",amount:21_000_000,currency:"SAR",sourceRefs:["test:apg"]},
    {bondId:"RB-01",kind:"retention" as const,status:"active" as const,expiryIso:"2026-09-15",amount:5_000_000,currency:"SAR",sourceRefs:["test:rb"]},
    {bondId:"OB-01",kind:"other" as const,status:"active" as const,expiryIso:"2026-11-15",amount:1_000_000,currency:"SAR",sourceRefs:["test:ob"]},
  ];
  const states=bonds.map(b=>securityStateAtDataDate(b,"2026-08-31").state);
  assert.deepEqual(states,["active","expired","expiring","active"]);
  // Contract controls: the stale stored status no longer decides the count.
  const cc=buildContractControls({...minimalContractInput(),bonds} as never);
  assert.equal(cc.bondsInsurance.expiredBondCount,1);
  assert.equal(cc.bondsInsurance.activeBondCount,3,"active count = in force (active plus expiring)");
  assert.equal(cc.bondsInsurance.expiringBondCount,1,"expiring uses the one shared 30-day window (OB-01 at 76 days is active)");
  assert.equal(cc.bondsInsurance.bonds.find(b=>b.bondId==="APG-01")?.securityState?.state,"expired");
});

test("F35 coverage gap is raised when the security ends before the required period; unknown required period stays not established", () => {
  const gap=securityCoverage({expiryIso:"2027-12-31",requiredEndIso:"2028-10-06",requirementEstablished:true,requiredEndBasis:"taking-over plus 365-day DNP"});
  assert.equal(gap.coverageState,"gap");assert.equal(gap.daysShort,280);assert.match(gap.reason,/before the required cover end 2028-10-06/);
  assert.equal(securityCoverage({expiryIso:"2028-12-31",requiredEndIso:"2028-10-06",requirementEstablished:true}).coverageState,"covered");
  const unknown=securityCoverage({expiryIso:"2027-12-31",requiredEndIso:null,requirementEstablished:true});
  assert.equal(unknown.coverageState,"not_established");assert.equal(unknown.daysShort,null);
  assert.equal(securityCoverage({expiryIso:"2027-12-31",requiredEndIso:"2028-10-06",requirementEstablished:false}).coverageState,"not_established");
  assert.equal(securityCoverage({expiryIso:null,requiredEndIso:"2028-10-06",requirementEstablished:true}).coverageState,"not_established");
});
