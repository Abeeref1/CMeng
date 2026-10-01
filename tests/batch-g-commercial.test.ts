import assert from "node:assert/strict";
import test from "node:test";

import {
  performancePaymentFromCanonical,
} from "../packages/runtime-api/src/commercial-performance-runtime";
import type {
  CommercialMoney,
  PaymentStageRecord,
} from "../packages/runtime-api/src/commercial-canonical";
import {
  contractTermSelectionFactState,
  termAtEvent,
  type ContractTermVersion,
} from "../packages/runtime-api/src/contract-term-versions";
import {
  cmengUatHtml,
} from "../packages/runtime-api/src/ui";

const receipt = (documentId:string) => ({
  documentId,
  sourceHash: documentId+"-hash",
  revision: documentId+"-rev",
  locator: "row:1",
  basisState: "active",
  authority: "source_record" as const,
});

function money(value:number|null, documentId:string):CommercialMoney {
  return {
    value,
    currency: "AED",
    taxBasis: "exclusive",
    amountBasis: documentId,
    state: value===null ? "missing" : "official",
    asOf: "2026-08-31",
    receipts: [receipt(documentId)],
  };
}

test("Batch G C1 never substitutes net certified for employer certified", () => {
  const amounts = {
    applicationAmount: money(1100,"application"),
    engineerAssessedAmount: money(1050,"assessment"),
    employerCertifiedAmount: money(null,"employer-certified"),
    grossWork: money(1000,"gross-work"),
    grossCertifiedAmount: money(1025,"gross-certified"),
    variations: money(100,"variation-component"),
    variationCertifiedAmount: money(80,"variation-certified"),
    retentionDeduction: money(50,"retention"),
    advanceRecovery: money(25,"advance"),
    otherDeduction: money(5,"other"),
    taxAmount: money(0,"tax"),
    netCertifiedAmount: money(900,"net-certified"),
    paidAmount: money(800,"paid"),
    outstandingAmount: money(100,"outstanding"),
  } satisfies PaymentStageRecord["amounts"];
  const row:PaymentStageRecord = {
    paymentId:"IPC-01",
    periodEnd:"2026-08-31",
    sourceStatus:"approved",
    certifiedAmountBasis:"project_cumulative",
    paidAmountBasis:"project_cumulative",
    amounts,
    receipt:receipt("ipc"),
    reconciliation:"unresolved",
    diagnostics:[],
    calculatedOutstandingAmount:money(null,"calculated-outstanding"),
    paymentType:"interim",
    applicationDate:"2026-08-01",
    assessmentDate:"2026-08-10",
    certificationDate:"2026-08-15",
    certificationDueDate:"2026-08-15",
    paymentDueDate:"2026-09-14",
    paymentDate:"2026-08-30",
    paymentTimestamp:null,
    retentionReleaseDate:null,
    finalReceiptDate:null,
    paymentReference:"PAY-01",
  };
  const performance = performancePaymentFromCanonical(row);
  assert.equal(performance.certifiedAmount, null);
  assert.equal(performance.paidAmount, 800);
  assert.equal(performance.currency, "AED");
  assert.ok(performance.sourceRefs.some(ref=>ref.includes("employer-certified")));
  assert.ok(!performance.sourceRefs.some(ref=>ref.includes("net-certified")));
});

function version(overrides:Partial<ContractTermVersion> = {}):ContractTermVersion {
  return {
    term:"paymentPeriodDays",
    value:30,
    unit:"calendar_days",
    effectiveFromIso:null,
    effectiveToIso:null,
    documentId:"CONTRACT",
    role:"main",
    sourceRefs:["contract:payment-period"],
    clauseIdentifier:"14.7",
    applicability:"prospective",
    ...overrides,
  };
}

test("Batch G C2 distinguishes unresolved applicability from real conflicts", () => {
  const unresolved = termAtEvent(
    [version({documentId:"AMD-01",role:"amendment",applicability:"unresolved"})],
    "paymentPeriodDays",
    "2026-08-31",
  );
  assert.deepEqual(
    contractTermSelectionFactState(unresolved),
    {state:"partial",authority:"candidate"},
  );

  const conflicting = termAtEvent(
    [version({value:30}),version({value:45,documentId:"CONTRACT-2",sourceRefs:["contract:payment-period-2"]})],
    "paymentPeriodDays",
    "2026-08-31",
  );
  assert.deepEqual(
    contractTermSelectionFactState(conflicting),
    {state:"conflicted",authority:"mixed"},
  );

  const missing = termAtEvent(
    [version({effectiveFromIso:"2027-01-01"})],
    "paymentPeriodDays",
    "2026-08-31",
  );
  assert.deepEqual(
    contractTermSelectionFactState(missing),
    {state:"missing",authority:"missing"},
  );
});

test("Batch G C3/C4 commercial action surfaces are present without invented ownership", () => {
  const html = cmengUatHtml();
  for (const label of [
    "Payment management actions",
    "Variation management actions",
    "Site Instruction management actions",
    "LD management actions",
  ]) assert.match(html,new RegExp(label));
  assert.match(html,/\["Finding","Exposure","Owner","Due","Action","Status"\]/);
  assert.match(html,/daysToExpiry\?\.action/);
  assert.match(html,/Owner stays unassigned unless a source records one/);
});
