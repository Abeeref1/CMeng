import test from "node:test";
import assert from "node:assert/strict";

import {
  commercialReconciliation,
  costControlSummary,
  type CommercialCanonicalModel,
  type CommercialFact,
  type MoneyAmount,
} from "../packages/commercial-core/src";

function money(
  amount: number,
  currency = "SAR",
): MoneyAmount {
  return {
    amount,
    currency,
    vatBasis: "exclusive",
  };
}

function fact<T>(
  value: T | null,
  unit: string | null = null,
): CommercialFact<T> {
  return {
    value,
    unit,
    state:
      value === null
        ? "missing"
        : "established",
    authority:
      value === null
        ? "missing"
        : "governed_source",
    effectiveAt: null,
    sourceRefs: [],
    method: "test",
    diagnostics: [],
  };
}

function model(): CommercialCanonicalModel {
  return {
    schemaVersion: "1.0",
    projectId: "ORBIT-TEST",
    dataDateIso: "2026-08-31",
    terms: {
      projectId: "ORBIT-TEST",
      currency: fact("SAR"),
      vatBasis: fact("exclusive"),
      originalContractValue: fact(money(7_800_000_000), "SAR"),
      currentContractValue: fact(money(8_250_000_000), "SAR"),
      commencementDateIso: fact("2026-04-01", "date"),
      originalCompletionIso: fact("2029-12-31", "date"),
      revisedCompletionIso: fact("2030-03-31", "date"),
      paymentTerms: fact<string>(null),
      retentionPercent: fact<number>(null, "%"),
      retentionCapPercent: fact<number>(null, "%"),
      ldRatePerDay: fact<MoneyAmount>(null, "SAR"),
      ldCapAmount: fact<MoneyAmount>(null, "SAR"),
      ldCapPercent: fact<number>(null, "%"),
      noticeTerms: [],
      instruments: [],
      amendments: [],
      precedence: [],
      diagnostics: [],
    },
    evm: {
      dataDateIso: "2026-08-31",
      currency: "SAR",
      bac: fact(money(8_250_000_000), "SAR"),
      pv: fact(money(2_000_000_000), "SAR"),
      ev: fact(money(1_850_000_000), "SAR"),
      ac: fact(money(1_950_000_000), "SAR"),
      spi: fact(0.925, "ratio"),
      cpi: fact(0.9487, "ratio"),
      etc: fact(money(6_600_000_000), "SAR"),
      eac: fact(money(8_550_000_000), "SAR"),
      vac: fact(money(-300_000_000), "SAR"),
      sourceRefs: [],
      diagnostics: [],
    },
    cbs: [],
    payments: [
      {
        paymentId: "IPC-01",
        type: "ipc",
        applicationDateIso: null,
        assessmentDateIso: null,
        certificateDateIso: "2026-07-31",
        paymentDueDateIso: null,
        paidDateIso: null,
        grossCertified: money(100_000_000),
        retentionWithheld: money(5_000_000),
        advanceRecovery: money(10_000_000),
        otherDeductions: null,
        netCertified: money(85_000_000),
        paidAmount: null,
        outstandingAmount: null,
        applicationStageAuthority: "missing",
        assessmentStageAuthority: "missing",
        certificationStageAuthority: "certified",
        receiptStageAuthority: "missing",
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    variations: [
      {
        variationId: "VAR-001",
        description: "Approved change",
        lifecycleState: "approved",
        instructionReference: null,
        approvalDateIso: "2026-08-15",
        claimedValue: null,
        assessedValue: null,
        agreedValue: money(450_000_000),
        approvedValue: money(450_000_000),
        certifiedValue: null,
        timeImpactDays: 90,
        authority: "approved",
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    commitments: [],
    accruals: [],
    cashFlow: [],
    mapping: {
      boqRowCount: 0,
      mappedBoqRowCount: 0,
      unmappedBoqRowCount: 0,
      paymentRowCount: 1,
      mappedPaymentRowCount: 0,
      unmappedPaymentRowCount: 1,
      wbsCount: 0,
      mappedWbsCount: 0,
      unmappedWbsCount: 0,
      completenessPercent: 0,
    },
    currencies: ["SAR"],
    sourceDocumentIds: [],
    diagnostics: [],
  };
}

test("cost control preserves documented EVM and reconciles deterministic checks", () => {
  const result =
    costControlSummary(model());

  assert.equal(result.bac, 8_250_000_000);
  assert.equal(result.pv, 2_000_000_000);
  assert.equal(result.ev, 1_850_000_000);
  assert.equal(result.ac, 1_950_000_000);
  assert.equal(result.spi, 0.925);
  assert.equal(result.cpi, 0.9487);
  assert.equal(result.eac, 8_550_000_000);
  assert.equal(result.vac, -300_000_000);
  assert.equal(
    result.evmReconciliation.calculatedSpi,
    0.925,
  );
  assert.equal(
    result.evmReconciliation.calculatedCpi,
    Number((1_850_000_000 / 1_950_000_000).toFixed(8)),
  );
});

test("commercial reconciliation never treats missing paid cash as zero", () => {
  const result =
    commercialReconciliation(model());

  assert.equal(result.originalContract, 7_800_000_000);
  assert.equal(result.approvedVariations, 450_000_000);
  assert.equal(result.revisedContract, 8_250_000_000);
  assert.equal(result.certified, 85_000_000);
  assert.equal(result.paid, null);
  assert.equal(result.outstandingCertified, null);
  assert.equal(result.balanceState, "partial");
  assert.ok(
    result.diagnostics.includes(
      "PAID_CASH_NOT_ESTABLISHED_FROM_PAYMENT_CERTIFICATE_EVIDENCE",
    ),
  );
});

test("commercial reconciliation blocks silent cross-currency arithmetic", () => {
  const input = model();
  input.payments[0]!.netCertified =
    money(85_000_000, "USD");

  const result =
    commercialReconciliation(input);

  assert.equal(result.currency, null);
  assert.equal(result.balanceState, "not_assessable");
  assert.ok(
    result.diagnostics.includes(
      "RECONCILIATION_REQUIRES_ONE_CURRENCY_PER_SERIES_OR_EXPLICIT_FX_CONVERSION",
    ),
  );
});
