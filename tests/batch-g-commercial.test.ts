import assert from "node:assert/strict";
import test from "node:test";

import {
  performancePaymentFromCanonical,
} from "../packages/runtime-api/src/commercial-performance-runtime";
import {
  buildCommercialControlPosition,
} from "../packages/commercial-control/src";
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

test("Cash receivable uses net certification while employer certification remains missing", () => {
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
  assert.equal(performance.certifiedAmount, 900);
  assert.equal(performance.certifiedAmountLabel,"Net certified receivable");
  assert.equal(row.amounts.employerCertifiedAmount.value,null);
  assert.equal(performance.paidAmount, 800);
  assert.equal(performance.currency, "AED");
  assert.ok(!performance.sourceRefs.some(ref=>ref.includes("employer-certified")));
  assert.ok(performance.sourceRefs.some(ref=>ref.includes("net-certified")));
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

test("Batch G C1 commercial-control performance path never substitutes net certified for missing employer certification", () => {
  const amounts = {
    applicationAmount: money(1100,"application-control"),
    engineerAssessedAmount: money(1050,"assessment-control"),
    employerCertifiedAmount: money(null,"employer-certified-control"),
    grossWork: money(1000,"gross-work-control"),
    grossCertifiedAmount: money(1025,"gross-certified-control"),
    variations: money(100,"variation-component-control"),
    variationCertifiedAmount: money(80,"variation-certified-control"),
    retentionDeduction: money(50,"retention-control"),
    advanceRecovery: money(25,"advance-control"),
    otherDeduction: money(5,"other-control"),
    taxAmount: money(0,"tax-control"),
    netCertifiedAmount: money(900,"net-certified-control"),
    paidAmount: money(800,"paid-control"),
    outstandingAmount: money(100,"outstanding-control"),
  } satisfies PaymentStageRecord["amounts"];
  const row:PaymentStageRecord = {
    paymentId:"IPC-CONTROL-01",
    periodEnd:"2026-08-31",
    sourceStatus:"approved",
    certifiedAmountBasis:"incremental",
    paidAmountBasis:"incremental",
    amounts,
    receipt:receipt("ipc-control"),
    reconciliation:"unresolved",
    diagnostics:[],
    calculatedOutstandingAmount:money(null,"calculated-outstanding-control"),
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
    paymentReference:"PAY-CONTROL-01",
  };
  const sourceLedger:any = {
    schemaVersion:"1.0",
    producerVersion:"commercial-canonical-v1",
    dataDateIso:"2026-08-31",
    costMetrics:[],
    payments:[row],
    variations:[],
    siteInstructions:[],
    insurances:[],
    obligations:[],
    retentions:[],
    costPosition:[],
    populations:{payments:{},variations:{},retentionDeductions:{}},
    diagnostics:[],
  };
  const position = buildCommercialControlPosition({
    projectId:"C1-COMMERCIAL-CONTROL",
    generatedAt:"2026-09-01T00:00:00.000Z",
    sourceLedger,
    contractValue:null,
    variations:[],
    invoices:[],
    retentions:[],
    bonds:[],
    claimCommercials:[],
    delayClaims:null,
    sourceDelayClaims:null,
    contractTimeBasis:null,
    commercialEvidenceSubmitted:false,
    paymentEvidenceSubmitted:true,
    variationEvidenceSubmitted:false,
    bondEvidenceSubmitted:false,
    claimEvidenceSubmitted:false,
  });
  const cash = position.performance.cashFlow.currencies.find((value:any)=>value.currency==="AED");
  assert.ok(cash);
  assert.equal(cash.certifiedIncome.value,null,'missing Employer Certified must stay missing even when Net Certified is present');
  assert.equal(cash.paidIncome.value,800,'independent paid evidence remains usable');
  assert.notEqual(cash.certifiedIncome.value,900,'Net Certified must never substitute for Employer Certified');
  const controlCurrency=position.currencies.find(value=>value.currency==='AED')!;
  assert.equal(controlCurrency.paidAmount.value,800,'Commercial Control must reuse the canonical dated cash position');
  assert.equal(controlCurrency.certifiedUnpaidAmount.value,100,'explicit Net Certified less actual Paid establishes the unpaid cash exposure without substituting Net Certified into the Employer Certified stage');
  assert.ok(controlCurrency.certifiedUnpaidAmount.diagnostics.includes("CERTIFIED_UNPAID_FROM_NET_CERTIFIED_LESS_PAID_CASH"));
});

test("Certified unpaid uses net certified less actual paid cash when gross and net stages differ", () => {
  const values=[
    {id:"IPC-1",employer:1330207,net:1231673,paid:1133139,date:"2026-06-21"},
    {id:"IPC-2",employer:2394372,net:2217011,paid:2039650,date:"2026-07-21"},
    {id:"IPC-3",employer:3458536,net:3202349,paid:2946161,date:"2026-08-15"},
  ];
  const rows:PaymentStageRecord[]=values.map(v=>({
    paymentId:v.id,periodEnd:v.date,sourceStatus:"approved",certifiedAmountBasis:"incremental",paidAmountBasis:"incremental",
    amounts:{
      applicationAmount:money(v.employer,"application-"+v.id),
      engineerAssessedAmount:money(v.employer,"assessment-"+v.id),
      employerCertifiedAmount:money(v.employer,"employer-"+v.id),
      grossWork:money(v.employer,"gross-work-"+v.id),
      grossCertifiedAmount:money(v.employer,"gross-certified-"+v.id),
      variations:money(0,"variations-"+v.id),
      variationCertifiedAmount:money(0,"variation-certified-"+v.id),
      retentionDeduction:money(v.employer-v.net,"retention-"+v.id),
      advanceRecovery:money(0,"advance-"+v.id),
      otherDeduction:money(0,"other-"+v.id),
      taxAmount:money(0,"tax-"+v.id),
      netCertifiedAmount:money(v.net,"net-"+v.id),
      paidAmount:money(v.paid,"paid-"+v.id),
      outstandingAmount:money(v.net-v.paid,"outstanding-"+v.id),
    },
    receipt:receipt("ipc-"+v.id),reconciliation:"matched",diagnostics:[],
    calculatedOutstandingAmount:money(v.net-v.paid,"calculated-outstanding-"+v.id),
    paymentType:"interim",applicationDate:v.date,assessmentDate:v.date,certificationDate:v.date,
    certificationDueDate:v.date,paymentDueDate:v.date,paymentDate:v.date,paymentTimestamp:null,
    retentionReleaseDate:null,finalReceiptDate:null,paymentReference:"PAY-"+v.id,
  }));
  const sourceLedger:any={
    schemaVersion:"1.0",producerVersion:"commercial-canonical-v1",dataDateIso:"2026-08-31",
    costMetrics:[],payments:rows,variations:[],siteInstructions:[],insurances:[],obligations:[],retentions:[],
    costPosition:[],populations:{payments:{},variations:{},retentionDeductions:{}},diagnostics:[],
  };
  const position=buildCommercialControlPosition({
    projectId:"CERTIFIED-UNPAID-NET-BASIS",generatedAt:"2026-09-01T00:00:00.000Z",sourceLedger,
    contractValue:null,variations:[],invoices:[],retentions:[],bonds:[],claimCommercials:[],
    delayClaims:null,sourceDelayClaims:null,contractTimeBasis:null,commercialEvidenceSubmitted:true,
    paymentEvidenceSubmitted:true,variationEvidenceSubmitted:false,bondEvidenceSubmitted:false,claimEvidenceSubmitted:false,
  });
  const cash=position.performance.cashFlow.currencies.find((row:any)=>row.currency==="AED")!;
  assert.equal(cash.certifiedUnpaid.value,1064165,"gross Employer Certified less paid remains a distinct cash-performance comparison");
  const currency=position.currencies.find(row=>row.currency==="AED")!;
  assert.equal(currency.netCertifiedAmount?.value,6651033);
  assert.equal(currency.paidAmount.value,6118950);
  assert.equal(currency.certifiedUnpaidAmount.value,532083,"management unpaid exposure must use Net Certified less actual Paid");
  assert.ok(currency.certifiedUnpaidAmount.diagnostics.includes("GROSS_CERTIFIED_LESS_PAID_IS_NOT_NET_PAYMENT_EXPOSURE"));
});

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


test("Stage 1 governed certificate and payment values survive weaker source-ledger gaps", () => {
  const sourceAmounts = {
    applicationAmount: money(null,"src-application"),
    engineerAssessedAmount: money(null,"src-assessment"),
    employerCertifiedAmount: money(null,"src-employer-certified"),
    grossWork: money(500,"src-gross-work"),
    grossCertifiedAmount: money(null,"src-gross-certified"),
    variations: money(0,"src-variations"),
    variationCertifiedAmount: money(0,"src-variation-certified"),
    retentionDeduction: money(0,"src-retention"),
    advanceRecovery: money(0,"src-advance"),
    otherDeduction: money(0,"src-other"),
    taxAmount: money(0,"src-tax"),
    netCertifiedAmount: money(null,"src-net"),
    paidAmount: money(null,"src-paid"),
    outstandingAmount: money(null,"src-outstanding"),
  } satisfies PaymentStageRecord["amounts"];
  const sourceRow:PaymentStageRecord = {
    paymentId:"IPC-SOURCE-GAP",
    periodEnd:"2026-08-31",
    sourceStatus:"approved",
    certifiedAmountBasis:"incremental",
    paidAmountBasis:"incremental",
    amounts:sourceAmounts,
    receipt:receipt("source-gap"),
    reconciliation:"unresolved",
    diagnostics:[],
    calculatedOutstandingAmount:money(null,"src-calc-outstanding"),
    paymentType:"interim",
    applicationDate:"2026-08-01",
    assessmentDate:"2026-08-05",
    certificationDate:"2026-08-10",
    certificationDueDate:"2026-08-10",
    paymentDueDate:"2026-09-07",
    paymentDate:null,
    paymentTimestamp:null,
    retentionReleaseDate:null,
    finalReceiptDate:null,
    paymentReference:null,
  };
  const sourceLedger:any={
    schemaVersion:"1.0",producerVersion:"commercial-canonical-v1",dataDateIso:"2026-08-31",
    costMetrics:[],payments:[sourceRow],variations:[],siteInstructions:[],insurances:[],obligations:[],retentions:[],
    costPosition:[],populations:{payments:{},variations:{},retentionDeductions:{}},diagnostics:[],
  };
  const position=buildCommercialControlPosition({
    projectId:"STAGE1-GOVERNED-PRECEDENCE",generatedAt:"2026-09-01T00:00:00.000Z",sourceLedger,
    contractValue:{amount:1000,currency:"AED",sourceRefs:["governed-contract"]},
    variations:[],
    invoices:[{
      invoiceId:"IPC-GOVERNED",currency:"AED",certifiedAmount:500,paidAmount:400,
      certificateDateIso:"2026-08-10",paymentDateIso:"2026-08-20",
      retentionAmount:0,advanceRecoveryAmount:0,advanceBalance:0,
      sourceRefs:["governed-certificate-payment"],
    }],
    retentions:[],bonds:[],claimCommercials:[],delayClaims:null,sourceDelayClaims:null,contractTimeBasis:null,
    commercialEvidenceSubmitted:true,paymentEvidenceSubmitted:true,variationEvidenceSubmitted:false,
    bondEvidenceSubmitted:false,claimEvidenceSubmitted:false,
  });
  const currency=position.currencies.find(row=>row.currency==="AED");
  assert.ok(currency);
  assert.equal(currency.grossCertifiedAmount.value,500);
  assert.equal(currency.paidAmount.value,400);
  assert.equal(currency.certifiedUnpaidAmount.value,100);
  assert.ok(!currency.grossCertifiedAmount.diagnostics.includes("DATED_INCREMENTAL_CERTIFICATES_WITH_COMPATIBLE_AMOUNTS_REQUIRED"));
});
