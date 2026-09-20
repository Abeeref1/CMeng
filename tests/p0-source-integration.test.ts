import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import {
  join,
} from "node:path";
import {
  tmpdir,
} from "node:os";

import {
  weeklyResourceCapacityEvidence,
} from "../packages/runtime-api/src/resource-support-evidence";
import {
  deriveControlsFromCsv,
} from "../packages/runtime-api/src/evidence-control-adapters";
import {
  buildCommercialControlPosition,
} from "../packages/commercial-control/src";

function document(
  documentId: string,
  documentType: string,
  sourceFilename: string,
  storedPath = "",
): any {
  return {
    documentId,
    category:
      "risk_claims_procurement",
    documentType,
    sourceFilename,
    sourceRelativePath: null,
    mediaType: "text/csv",
    sourceHashSha256:
      documentId,
    sizeBytes: 1,
    uploadedAt:
      "2026-09-20T00:00:00.000Z",
    authority:
      "candidate_only",
    parserState: "parsed",
    storedPath,
    linkedArtifactId: null,
    scheduleRole: null,
    mapping: null,
    identification: {
      verifiedMediaType:
        "text/csv",
      detectedCategory:
        "risk_claims_procurement",
      detectedDocumentType:
        documentType,
      confidence: 1,
      method:
        "tabular_content",
      ocrUsed: false,
      ocrConfidence: null,
      pageCount: null,
      extractedCharacterCount:
        1,
      detectedTitle: null,
      filenameHintCategory:
        "risk_claims_procurement",
      filenameHintDocumentType:
        documentType,
      declaredCategory: null,
      declaredDocumentType: null,
      classificationConflict:
        false,
      needsReview: false,
      signals: [],
      diagnostics: [],
    },
    lineage: {
      effect: "original",
      predecessorDocumentIds: [],
      replacesEntireBasis:
        false,
      appliesAsDelta: false,
      inferred: true,
      confidence: 1,
      needsReview: false,
      diagnostics: [],
    },
    assertions: [],
    uploadIntent:
      "add_update",
    familyKey:
      "test:" +
      documentType,
    logicalDocumentKey:
      documentType,
    basisState: "active",
    supersededByDocumentId:
      null,
    supersedesDocumentIds: [],
    diagnostics: [],
  };
}

function state(): any {
  return {
    projectId: "P0-UAT",
    controls: {
      contractValue: {
        amount: 1000000,
        currency: "USD",
        sourceRefs: [
          "contract:C01",
        ],
      },
    },
  };
}

test("P0 resources reconcile capacity, planned demand and actual usage split across RES files without mixing units", () => {
  const dir =
    mkdtempSync(
      join(
        tmpdir(),
        "cmeng-res-",
      ),
    );
  const capacityPath =
    join(
      dir,
      "RES01.csv",
    );
  const usagePath =
    join(
      dir,
      "RES02.csv",
    );

  writeFileSync(
    capacityPath,
    [
      "Resource ID,Week Start,Available Capacity,Unit",
      "R1,2026-09-14,100,h",
    ].join("\n"),
  );
  writeFileSync(
    usagePath,
    [
      "Resource ID,Week Start,Planned Demand,Actual Approved Usage",
      "R1,2026-09-14,84.47,76.97",
    ].join("\n"),
  );

  const result =
    weeklyResourceCapacityEvidence(
      [
        document(
          "RES01",
          "resource_register",
          "RES01.csv",
          capacityPath,
        ),
        document(
          "RES02",
          "resource_register",
          "RES02.csv",
          usagePath,
        ),
      ],
    );

  assert.equal(
    result.state,
    "available",
  );
  assert.equal(
    result.resourceCount,
    1,
  );
  assert.equal(
    result.comparableRowCount,
    1,
  );
  assert.equal(
    result.plannedUtilizationPercent,
    84.47,
  );
  assert.equal(
    result.actualUtilizationPercent,
    76.97,
  );
  assert.deepEqual(
    result.unitLabels,
    ["H"],
  );
});

test("P0 CL01 derives governed delay events, commercial claims and deduplicated Engineer EOT determinations", () => {
  const csv = [
    "Claim ID,Event ID,Event Title,Event Start,Event End,Responsibility,Category,Activity ID,Notice Date,Days Claimed,Days Granted,Determination ID,Status,Claimed Amount USD,Assessed Amount USD,Day Basis",
    "CL-001,EV-001,Late access,2026-01-01,2026-01-10,Employer,Access,A100,2026-01-02,20,10,DET-01,Engineer Determined,100000,80000,Calendar",
    "CL-002,EV-002,Design information,2026-02-01,2026-02-12,Employer,Information,A200,2026-02-02,25,15,DET-02,Engineer Determined,200000,150000,Calendar",
    "CL-002,EV-002,Design information,2026-02-01,2026-02-12,Employer,Information,A200,2026-02-02,25,15,DET-02,Engineer Determined,200000,150000,Calendar",
  ].join("\n");

  const derived =
    deriveControlsFromCsv({
      state: state(),
      document: document(
        "CL01",
        "delay_eot_claims_register",
        "CL01.csv",
      ),
      bytes:
        Buffer.from(csv),
    });

  assert.equal(
    derived.delayClaims
      ?.events.length,
    2,
  );
  assert.equal(
    derived.delayClaims
      ?.claims.length,
    3,
  );
  assert.equal(
    derived.contractTimeBasis
      ?.officialApprovedEotDays,
    25,
  );
  assert.equal(
    derived.contractTimeBasis
      ?.eotDayBasis,
    "calendar_days",
  );
  assert.equal(
    derived.claimCommercials
      ?.length,
    2,
  );
  assert.equal(
    derived.claimCommercials
      ?.[0]
      ?.claimedAmount,
    100000,
  );
});

test("commercial adapters populate approved/pending variations, payments, retention, advance and bonds from evidence", () => {
  const variation =
    deriveControlsFromCsv({
      state: state(),
      document: document(
        "VAR01",
        "variation_register",
        "VAR01.csv",
      ),
      bytes:
        Buffer.from(
          [
            "Variation ID,Status,Submitted Amount USD,Approved Amount USD",
            "VO-01,Approved,120000,100000",
            "VO-02,Pending,50000,",
          ].join("\n"),
        ),
    });

  assert.deepEqual(
    variation.variations
      ?.map(
        (row) => [
          row.variationId,
          row.state,
          row.amount,
        ],
      ),
    [
      [
        "VO-01",
        "approved",
        100000,
      ],
      [
        "VO-02",
        "pending",
        50000,
      ],
    ],
  );

  const payment =
    deriveControlsFromCsv({
      state: state(),
      document: document(
        "PAY01",
        "payment_certificates",
        "PAY01.csv",
      ),
      bytes:
        Buffer.from(
          [
            "Certificate No,Certificate Date,Net Certified USD,Paid Amount USD,Payment Date,Retention Amount USD,Advance Recovery USD,Advance Balance USD",
            "IPC-01,2026-01-31,200000,180000,2026-02-15,10000,5000,95000",
            "IPC-02,2026-02-28,250000,225000,2026-03-15,12500,5000,90000",
          ].join("\n"),
        ),
    });

  assert.equal(
    payment.invoices
      ?.[1]
      ?.paidAmount,
    225000,
  );
  assert.equal(
    payment.invoices
      ?.[1]
      ?.advanceBalance,
    90000,
  );
  assert.equal(
    payment.retentions
      ?.length,
    2,
  );

  const bond =
    deriveControlsFromCsv({
      state: state(),
      document: document(
        "BOND01",
        "bond_register",
        "BOND01.csv",
      ),
      bytes:
        Buffer.from(
          [
            "Bond ID,Bond Type,Bond Amount USD,Status,Expiry Date",
            "BG-01,Performance,100000,Active,2027-01-01",
            "BG-02,Advance Payment,95000,Active,2027-01-01",
          ].join("\n"),
        ),
    });

  assert.equal(
    bond.bonds?.length,
    2,
  );
  assert.equal(
    bond.bonds?.[1]?.kind,
    "advance_payment",
  );
});

test("canonical commercial position never derives advance balance from bond value and preserves currency isolation", () => {
  const position =
    buildCommercialControlPosition({
      generatedAt:
        "2026-09-20T00:00:00.000Z",
      projectId: "P0-UAT",
      contractValue: {
        amount: 1000000,
        currency: "USD",
        sourceRefs: [
          "contract:C01",
        ],
      },
      variations: [
        {
          variationId: "VO-01",
          amount: 100000,
          currency: "USD",
          state: "approved",
          sourceRefs: [
            "variation:VO-01",
          ],
        },
        {
          variationId: "VO-AED",
          amount: 200000,
          currency: "AED",
          state: "approved",
          sourceRefs: [
            "variation:VO-AED",
          ],
        },
      ],
      invoices: [
        {
          invoiceId: "IPC-01",
          currency: "USD",
          certifiedAmount:
            200000,
          paidAmount: 180000,
          certificateDateIso:
            "2026-01-31T00:00:00.000Z",
          paymentDateIso:
            "2026-02-15T00:00:00.000Z",
          advanceBalance: 95000,
          sourceRefs: [
            "payment:IPC-01",
          ],
        },
        {
          invoiceId: "IPC-02",
          currency: "USD",
          certifiedAmount:
            250000,
          paidAmount: 225000,
          certificateDateIso:
            "2026-02-28T00:00:00.000Z",
          paymentDateIso:
            "2026-03-15T00:00:00.000Z",
          advanceBalance: 90000,
          sourceRefs: [
            "payment:IPC-02",
          ],
        },
      ],
      retentions: [],
      bonds: [
        {
          bondId: "APG-01",
          amount: 150000,
          currency: "USD",
          sourceRefs: [
            "bond:APG-01",
          ],
          kind:
            "advance_payment",
          status: "active",
          expiryIso: null,
        },
      ],
      claimCommercials: [],
      contractTimeBasis: {
        contractualCompletionIso:
          "2030-03-31",
        contractualCompletionState:
          "official",
        officialApprovedEotDays:
          138,
        officialApprovedEotState:
          "official",
        eotDayBasis:
          "calendar_days",
        eotDayBasisState:
          "official",
        sourceRefs: [
          "contract:C02",
          "claims:EOT03",
        ],
      },
      commercialEvidenceSubmitted:
        true,
      paymentEvidenceSubmitted:
        true,
      variationEvidenceSubmitted:
        true,
      bondEvidenceSubmitted:
        true,
      claimEvidenceSubmitted:
        true,
    });

  const usd =
    position.currencies.find(
      (row) =>
        row.currency === "USD",
    );
  const aed =
    position.currencies.find(
      (row) =>
        row.currency === "AED",
    );

  assert.equal(
    usd
      ?.currentContractValue
      .value,
    1100000,
  );
  assert.equal(
    aed
      ?.currentContractValue
      .value,
    null,
  );
  assert.equal(
    usd?.advanceBalance.value,
    90000,
  );
  assert.notEqual(
    usd?.advanceBalance.value,
    150000,
  );
  assert.equal(
    position.timeExposure
      .approvedEotDays.value,
    138,
  );
});
