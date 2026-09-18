import test from "node:test";
import assert from "node:assert/strict";

import {
  attachCandidate,
  candidateFromUpload,
  createSourceManifest,
  documentIdentityKey,
  evidenceReceiptFromUpload,
  executeGovernedPromotion,
  missingFact,
  nativeEntityIdentityKey,
  numericFactValue,
  promoteCandidate,
  promotionRequestFingerprint,
  type AuthorityReceipt,
} from "../packages/governance-model/src";
import {
  buildCanonicalManagementSummary,
  managementDto,
  rejectRawModelEnvelope,
  type DomainSummary,
} from "../packages/management-model/src";
import {
  createDependencyReceipt,
  validatePublication,
} from "../packages/projection-governance/src";
import {
  calculateSlaPerformance,
} from "../packages/operations-governance/src";
import {
  exportCoveragePercent,
  interactiveSliceCannotDescribeExport,
} from "../packages/export-model/src";
import {
  DEFAULT_STARTUP_CONTRACT,
  assertStartupContract,
  retryDecision,
  supervisedConnectionAttempt,
} from "../packages/runtime-supervision/src";

const now = "2026-09-18T10:00:00.000Z";

function authority(): AuthorityReceipt {
  return {
    authorityReceiptId: "auth-1",
    authorityType: "governing_document",
    authorityRef: "contract:rev-1",
    promotedBy: "system-rule",
    promotedAt: now,
  };
}

test("missing governed numeric fact is null, never zero", () => {
  const fact = missingFact<number>(
    "P88",
    "approved_budget",
    now,
  );

  assert.equal(fact.state, "missing");
  assert.equal(fact.value, null);
  assert.equal(numericFactValue(fact), null);
});

test("upload creates evidence receipt and provisional candidate, not official fact", () => {
  const manifest = createSourceManifest(
    "P88",
    [
      {
        documentId: "doc-1",
        revisionId: "rev-1",
        objectId: "obj-1",
        sha256: "a".repeat(64),
        role: "contract",
      },
    ],
    now,
  );

  const receipt = evidenceReceiptFromUpload(
    {
      projectId: "P88",
      documentId: "doc-1",
      revisionId: "rev-1",
      objectId: "obj-1",
      sha256: "a".repeat(64),
      role: "contract",
      receivedAt: now,
    },
    manifest,
  );

  const candidate = candidateFromUpload({
    projectId: "P88",
    factKey: "contract_completion_date",
    value: "2027-12-31",
    receipt,
    sourceRefs: ["doc-1:p42"],
    confidence: 0.99,
    createdAt: now,
  });

  const fact = attachCandidate(
    missingFact<string>(
      "P88",
      "contract_completion_date",
      now,
    ),
    candidate,
    now,
  );

  assert.equal(fact.state, "provisional");
  assert.equal(fact.value, null);
  assert.deepEqual(
    candidate.evidenceReceiptIds,
    [receipt.receiptId],
  );
});

test("candidate cannot become official without authority receipt", () => {
  const candidate = {
    candidateId: "candidate-1",
    projectId: "P88",
    factKey: "contract_completion_date",
    value: "2027-12-31",
    origin: "ai_proposal" as const,
    evidenceReceiptIds: ["receipt-1"],
    sourceRefs: ["contract:p42"],
    confidence: 0.99,
    createdAt: now,
  };

  const attached = attachCandidate(
    missingFact<string>(
      "P88",
      "contract_completion_date",
      now,
    ),
    candidate,
    now,
  );

  const denied = promoteCandidate(
    attached,
    candidate,
    null,
    now,
  );

  assert.equal(denied.promoted, false);
  assert.equal(denied.fact.state, "provisional");
  assert.equal(denied.fact.value, null);

  const promoted = promoteCandidate(
    attached,
    candidate,
    authority(),
    now,
  );

  assert.equal(promoted.promoted, true);
  assert.equal(promoted.fact.state, "official");
  assert.equal(
    promoted.fact.value,
    "2027-12-31",
  );
});

test("stale promotion generation is rejected before official publication", () => {
  const candidate = {
    candidateId: "candidate-1",
    projectId: "P88",
    factKey: "approved_budget",
    value: 100,
    origin: "manual_entry" as const,
    evidenceReceiptIds: [],
    sourceRefs: [],
    confidence: 1,
    createdAt: now,
  };

  const fact = attachCandidate(
    missingFact<number>(
      "P88",
      "approved_budget",
      now,
    ),
    candidate,
    now,
  );

  const result = executeGovernedPromotion({
    fact,
    candidate,
    authority: authority(),
    command: {
      projectId: "P88",
      factKey: "approved_budget",
      candidateId: "candidate-1",
      expectedEvidenceRevisionId: "rev-1",
      currentEvidenceRevisionId: "rev-2",
      actorId: "user-1",
      requestId: "request-1",
    },
    now,
  });

  assert.equal(result.command.accepted, false);
  assert.equal(
    result.command.reason,
    "STALE_EVIDENCE_REVISION",
  );
  assert.equal(result.promotion, null);
});

test("promotion request fingerprint is idempotent for exact replay", () => {
  const command = {
    projectId: "P88",
    factKey: "approved_budget",
    candidateId: "candidate-1",
    expectedEvidenceRevisionId: "rev-1",
    currentEvidenceRevisionId: "rev-1",
    actorId: "user-1",
    requestId: "request-1",
  };

  assert.equal(
    promotionRequestFingerprint(command),
    promotionRequestFingerprint({
      ...command,
    }),
  );
});

test("document identity ignores filename and depends on IDs plus source hash", () => {
  const first = documentIdentityKey({
    documentId: "doc-1",
    revisionId: "rev-1",
    objectId: "obj-1",
    sha256: "a".repeat(64),
    sourceFilename: "contract-final.pdf",
  });

  const renamed = documentIdentityKey({
    documentId: "doc-1",
    revisionId: "rev-1",
    objectId: "obj-1",
    sha256: "a".repeat(64),
    sourceFilename: "NEW NAME REALLY FINAL.pdf",
  });

  const changedBytes = documentIdentityKey({
    documentId: "doc-1",
    revisionId: "rev-1",
    objectId: "obj-2",
    sha256: "b".repeat(64),
    sourceFilename: "contract-final.pdf",
  });

  assert.equal(first, renamed);
  assert.notEqual(first, changedBytes);
});

test("native entity identities keep different resource types and source revisions separate", () => {
  const labor = nativeEntityIdentityKey({
    projectId: "P88",
    sourceRevisionId: "rev-1",
    entityType: "resource",
    nativeId: "R001",
  });

  const unit = nativeEntityIdentityKey({
    projectId: "P88",
    sourceRevisionId: "rev-1",
    entityType: "resource_unit",
    nativeId: "R001",
  });

  const nextRevision = nativeEntityIdentityKey({
    projectId: "P88",
    sourceRevisionId: "rev-2",
    entityType: "resource",
    nativeId: "R001",
  });

  assert.notEqual(labor, unit);
  assert.notEqual(labor, nextRevision);
});

test("all pages consume the same canonical management summary instead of calculating status independently", () => {
  const domains: DomainSummary[] = [
    {
      key: "pmo_analysis",
      state: "ready",
      producerVersion: "pmo-v1",
      dependencyReceiptId: "dep-pmo",
      asOf: now,
    },
    {
      key: "progress_scurve",
      state: "pending",
      producerVersion: "scurve-v1",
      dependencyReceiptId: null,
      asOf: null,
    },
  ];

  const summary = buildCanonicalManagementSummary({
    projectId: "P88",
    analysisRunId: "run-1",
    evidenceRevisionId: "rev-1",
    generatedAt: now,
    domains,
    completionDates: [],
  });

  const pmo = managementDto(summary, {
    projectionKey: "pmo_analysis",
    projectId: "P88",
    analysisRunId: "run-1",
    evidenceRevisionId: "rev-1",
    state: "ready",
    validatedData: { overallProgress: 42 },
    dependencyReceiptId: "dep-pmo",
    producerVersion: "pmo-v1",
    readableEvidence: true,
  });

  const scurve = managementDto(summary, {
    projectionKey: "progress_scurve",
    projectId: "P88",
    analysisRunId: "run-1",
    evidenceRevisionId: "rev-1",
    state: "preparing",
    validatedData: null,
    dependencyReceiptId: null,
    producerVersion: "scurve-v1",
    readableEvidence: false,
  });

  assert.equal(pmo.summaryId, summary.summaryId);
  assert.equal(scurve.summaryId, summary.summaryId);
  assert.equal(summary.overallState, "partial");
});

test("readable current evidence renders as partial while slow producer continues", () => {
  const summary = buildCanonicalManagementSummary({
    projectId: "P88",
    analysisRunId: "run-1",
    evidenceRevisionId: "rev-1",
    generatedAt: now,
    domains: [
      {
        key: "progress_scurve",
        state: "failed",
        producerVersion: "scurve-v1",
        dependencyReceiptId: null,
        asOf: null,
      },
    ],
    completionDates: [],
  });

  const dto = managementDto(summary, {
    projectionKey: "progress_scurve",
    projectId: "P88",
    analysisRunId: "run-1",
    evidenceRevisionId: "rev-1",
    state: "retrying",
    validatedData: {
      readablePoints: [1, 2, 3],
    },
    dependencyReceiptId: null,
    producerVersion: "scurve-v1",
    readableEvidence: true,
  });

  assert.equal(dto.state, "partial");
  assert.deepEqual(dto.data, {
    readablePoints: [1, 2, 3],
  });
  assert.match(
    dto.processingMessage ?? "",
    /Readable current-revision evidence/,
  );
});

test("raw model output cannot be exposed directly as management DTO", () => {
  assert.throws(
    () =>
      rejectRawModelEnvelope({
        rawModelOutput: {
          summary: "model said this",
        },
        modelName: "test-model",
      }),
    /Raw model output cannot be exposed/,
  );
});

test("completion dates retain separate contractual programme CPM recovery forecast actual and EOT bases", () => {
  const summary = buildCanonicalManagementSummary({
    projectId: "P88",
    analysisRunId: "run-1",
    evidenceRevisionId: "rev-1",
    generatedAt: now,
    domains: [],
    completionDates: [
      {
        basis: "contractual",
        date: "2027-12-31",
        state: "official",
        sourceRefs: ["contract:p10"],
        evidenceRevisionIds: ["contract-rev-1"],
      },
      {
        basis: "programme",
        date: "2028-01-15",
        state: "official",
        sourceRefs: ["baseline:A100"],
        evidenceRevisionIds: ["schedule-rev-1"],
      },
      {
        basis: "cpm",
        date: "2028-01-20",
        state: "provisional",
        sourceRefs: ["cpm:run-1"],
        evidenceRevisionIds: ["schedule-rev-2"],
      },
      {
        basis: "recovery",
        date: "2028-02-01",
        state: "provisional",
        sourceRefs: ["recovery:rev-1"],
        evidenceRevisionIds: ["recovery-rev-1"],
      },
      {
        basis: "forecast",
        date: "2028-03-01",
        state: "provisional",
        sourceRefs: ["forecast:run-1"],
        evidenceRevisionIds: ["schedule-rev-2"],
      },
      {
        basis: "actual",
        date: null,
        state: "missing",
        sourceRefs: [],
        evidenceRevisionIds: [],
      },
      {
        basis: "eot",
        date: "2028-02-15",
        state: "provisional",
        sourceRefs: ["eot:candidate-1"],
        evidenceRevisionIds: ["claim-rev-1"],
      },
    ],
  });

  assert.deepEqual(
    summary.completionDates.map((item) => item.basis),
    [
      "contractual",
      "programme",
      "cpm",
      "recovery",
      "forecast",
      "actual",
      "eot",
    ],
  );
});

test("SLA performance uses actual event timestamps and ignores planned dates", () => {
  const result = calculateSlaPerformance(
    [
      {
        eventKey: "submitted",
        plannedAt: "2026-09-01T08:00:00Z",
        actualOccurredAt: "2026-09-10T08:00:00Z",
        actualCompletedAt: null,
      },
      {
        eventKey: "responded",
        plannedAt: "2026-09-02T08:00:00Z",
        actualOccurredAt: null,
        actualCompletedAt: "2026-09-10T10:00:00Z",
      },
    ],
    {
      ruleId: "RFI-RESPONSE",
      startEventKey: "submitted",
      endEventKey: "responded",
      targetMinutes: 180,
    },
  );

  assert.equal(result.status, "met");
  assert.equal(result.elapsedMinutes, 120);
  assert.equal(result.usedActualTimestampsOnly, true);
});

test("stale durable publication is rejected by dependency receipt and producer versions", () => {
  const receipt = createDependencyReceipt({
    projectId: "P88",
    analysisRunId: "run-1",
    evidenceRevisionId: "rev-1",
    projectionKey: "progress_scurve",
    evidenceFingerprint: "evidence-old",
    sourceManifestId: "manifest-1",
    upstreamProjectionHashes: {},
    producerVersion: "scurve-v1",
    parserVersion: "parser-v1",
    mappingVersion: "map-v1",
    createdAt: now,
  });

  const result = validatePublication(
    {
      projectId: "P88",
      analysisRunId: "run-1",
      evidenceRevisionId: "rev-1",
      projectionKey: "progress_scurve",
      artifact: {
        artifactId: "artifact-1",
        contentHash: "hash-1",
        byteLength: 100,
      },
      dependencyReceipt: receipt,
      publishedAt: now,
    },
    {
      projectId: "P88",
      analysisRunId: "run-2",
      evidenceRevisionId: "rev-2",
      evidenceFingerprint: "evidence-new",
      producerVersion: "scurve-v2",
      parserVersion: "parser-v2",
      mappingVersion: "map-v2",
    },
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.reasons.includes("ANALYSIS_RUN_MISMATCH"),
  );
  assert.ok(
    result.reasons.includes(
      "EVIDENCE_FINGERPRINT_STALE",
    ),
  );
  assert.ok(
    result.reasons.includes(
      "PRODUCER_VERSION_STALE",
    ),
  );
});

test("export coverage is based on exported population, never interactive top-N", () => {
  const receipt = {
    exportId: "export-1",
    analysisRunId: "run-1",
    evidenceRevisionId: "rev-1",
    projectionKey: "near_critical",
    sourcePopulationCount: 10_000,
    eligiblePopulationCount: 800,
    exportedPopulationCount: 800,
    omittedPopulationCount: 0,
    unresolvedPopulationCount: 0,
    generatedAt: now,
  };

  assert.equal(
    exportCoveragePercent(receipt),
    100,
  );

  assert.equal(
    interactiveSliceCannotDescribeExport({
      sortBy: "totalFloat",
      limit: 20,
      returnedCount: 20,
      totalAvailableCount: 800,
      filterSummary: "near critical",
    }),
    false,
  );
});

test("API startup contract forbids full rebuilds during startup", () => {
  assert.doesNotThrow(() =>
    assertStartupContract(
      DEFAULT_STARTUP_CONTRACT,
    ),
  );

  assert.throws(
    () =>
      assertStartupContract({
        bindLivenessFirst: true,
        startDurableRebuildsInline: true,
        durableWorkMode: "supervised_workers",
      } as any),
    /Full project rebuilds are forbidden/,
  );
});

test("database connection failure returns retry decision instead of killing worker", async () => {
  const first = retryDecision(0);
  const later = retryDecision(6);

  assert.equal(first.giveUp, false);
  assert.equal(first.delayMs, 500);
  assert.equal(later.giveUp, false);
  assert.ok(later.delayMs <= 30_000);

  const result = await supervisedConnectionAttempt(
    async () => {
      throw new Error("database endpoint disabled");
    },
    2,
  );

  assert.equal(result.status, "retry");
  if (result.status === "retry") {
    assert.equal(result.decision.giveUp, false);
    assert.match(
      result.error.message,
      /database endpoint disabled/,
    );
  }
});


test("new candidate cannot silently replace an already-official fact", () => {
  const original = {
    candidateId: "candidate-official",
    projectId: "P88",
    factKey: "approved_budget",
    value: 100,
    origin: "manual_entry" as const,
    evidenceReceiptIds: [],
    sourceRefs: ["approved-register:1"],
    confidence: 1,
    createdAt: now,
  };
  const newer = {
    candidateId: "candidate-new-upload",
    projectId: "P88",
    factKey: "approved_budget",
    value: 125,
    origin: "document_extraction" as const,
    evidenceReceiptIds: ["receipt-new"],
    sourceRefs: ["new-upload:p1"],
    confidence: 0.99,
    createdAt: now,
  };

  const provisional = attachCandidate(
    missingFact<number>("P88", "approved_budget", now),
    original,
    now,
  );
  const official = promoteCandidate(
    provisional,
    original,
    authority(),
    now,
  ).fact;

  const afterNewCandidate = attachCandidate(
    official,
    newer,
    "2026-09-18T11:00:00.000Z",
  );

  assert.equal(afterNewCandidate.state, "official");
  assert.equal(afterNewCandidate.value, 100);
  assert.equal(
    afterNewCandidate.officialCandidateId,
    "candidate-official",
  );
  assert.ok(
    afterNewCandidate.candidateIds.includes(
      "candidate-new-upload",
    ),
  );
});

test("pending partial conflicted and provisional numeric facts are distinct from zero", () => {
  const states = [
    "missing",
    "pending",
    "partial",
    "conflicted",
    "provisional",
  ] as const;

  for (const state of states) {
    assert.equal(
      numericFactValue({
        projectId: "P88",
        factKey: "value",
        state,
        value: null,
        officialCandidateId: null,
        candidateIds: [],
        authorityReceipt: null,
        updatedAt: now,
      }),
      null,
    );
  }

  assert.equal(
    numericFactValue({
      projectId: "P88",
      factKey: "value",
      state: "official",
      value: 0,
      officialCandidateId: "official-zero",
      candidateIds: ["official-zero"],
      authorityReceipt: authority(),
      updatedAt: now,
    }),
    0,
  );
});

test("management DTO rejects stale producer or dependency receipt", () => {
  const summary = buildCanonicalManagementSummary({
    projectId: "P88",
    analysisRunId: "run-1",
    evidenceRevisionId: "rev-1",
    generatedAt: now,
    domains: [
      {
        key: "progress_scurve",
        state: "ready",
        producerVersion: "scurve-v2",
        dependencyReceiptId: "dep-current",
        asOf: now,
      },
    ],
    completionDates: [],
  });

  assert.throws(
    () =>
      managementDto(summary, {
        projectionKey: "progress_scurve",
        projectId: "P88",
        analysisRunId: "run-1",
        evidenceRevisionId: "rev-1",
        state: "ready",
        validatedData: { points: [1] },
        dependencyReceiptId: "dep-current",
        producerVersion: "scurve-v1",
        readableEvidence: true,
      }),
    /producer version/,
  );

  assert.throws(
    () =>
      managementDto(summary, {
        projectionKey: "progress_scurve",
        projectId: "P88",
        analysisRunId: "run-1",
        evidenceRevisionId: "rev-1",
        state: "ready",
        validatedData: { points: [1] },
        dependencyReceiptId: "dep-old",
        producerVersion: "scurve-v2",
        readableEvidence: true,
      }),
    /dependency receipt/,
  );
});
