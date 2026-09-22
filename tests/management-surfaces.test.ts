import assert from "node:assert/strict";
import test from "node:test";

import {
  buildManagementSurfaces,
  type ManagementSurfacesInput,
} from "../packages/management-surfaces/src";
import type {
  ProjectDirectorPosition,
} from "../packages/project-director/src";

function commercialMetric(
  value: number | null,
  state:
    ProjectDirectorPosition["commercialByCurrency"][number]["pendingVariationAmount"]["state"] =
    value === null
      ? "not_submitted"
      : "established",
) {
  return {
    value,
    state,
    sourceRefs:
      value === null
        ? []
        : ["test:commercial"],
    diagnostics: [],
  };
}

function director():
  ProjectDirectorPosition {
  return {
    schemaVersion: "1.0",
    generatedAt:
      "2026-09-21T19:00:00.000Z",
    projectId: "MGMT-UAT",
    schedule: {
      dataDateIso:
        "2026-08-31",
      contractualCompletionIso:
        "2030-03-31",
      officialAdjustedCompletionIso:
        "2030-04-26",
      submittedProgrammeCompletionIso:
        "2030-05-01",
      independentForecastCompletionIso:
        "2030-06-30",
      independentForecastBasisRevisionId:
        "S03",
      independentForecastCoveragePercent:
        100,
      independentForecastAuthority:
        "deterministic",
      varianceDaysToContractualCompletion:
        91,
      varianceDaysToOfficialAdjustedCompletion:
        65,
      varianceDaysToSubmittedProgrammeCompletion:
        60,
      forecastComparisonBasis:
        "official_adjusted_completion",
      criticalCount: 503,
      nearCriticalCount: 504,
      criticalityBasis:
        "source_total_float",
      independentCpmState:
        "established",
      drivingPathState:
        "independent_cpm_available",
      overdueLookAheadCount: 3,
      progressBases: {
        baselinePlanned: {
          valuePercent: 60,
        },
        currentSchedule: {
          valuePercent: 55,
        },
        physical: {
          valuePercent: null,
        },
        contractorReported: {
          valuePercent: null,
        },
        certified: {
          valuePercent: null,
        },
      } as ProjectDirectorPosition["schedule"]["progressBases"],
    },
    claims: {
      evidenceState:
        "established",
      eventCount: 3,
      claimCount: 2,
      fullyLinkedEventCount: 2,
      fullyLinkedClaimCount: 1,
      unlinkedClaimIds: [
        "CLM-2",
      ],
      observedProgrammeMovementDays:
        181,
      analyticalTimeImpactCandidateDays:
        30,
      attributableCandidateEotDays:
        20,
      unattributedTimeImpactDays:
        151,
      candidateAdditionalEotDays:
        10,
      officialApprovedEotDays:
        26,
    },
    ld: {
      delayDays: 65,
      delayBasis:
        "official_adjusted_completion",
      state:
        "scenario_candidate",
      currency: "AED",
      uncappedAmount:
        650_000,
      cappedAmount:
        650_000,
      capApplied: false,
      sourceRefs: [
        "contract:ld",
      ],
      recommendedScenarioId:
        null,
      recommendationRationale: [],
      userDecisionRequired: true,
      scenarios: [],
      diagnostics: [],
    },
    commercialByCurrency: [
      {
        currency: "AED",
        pendingVariationAmount:
          commercialMetric(500_000),
        approvedVariationAmount:
          commercialMetric(400_000),
        certifiedUnpaidAmount:
          commercialMetric(100_000),
        retentionDeductedAmount:
          commercialMetric(50_000),
        retentionHeldAmount:
          commercialMetric(null),
        activeBondAmount:
          commercialMetric(1_000_000),
        claimClaimedAmount:
          commercialMetric(250_000),
        claimAssessedAmount:
          commercialMetric(200_000),
        ldScenarioAmount:
          commercialMetric(650_000,"candidate"),
      },
    ],
    controls: {
      hseEvidenceState:
        "not_submitted",
      qualityEvidenceState:
        "established",
      rfiEvidenceState:
        "established",
      permitEvidenceState:
        "established",
      bondEvidenceState:
        "established",
      riskEvidenceState:
        "not_submitted",
      openRiskCount: null,
      openHseIncidentCount: 0,
      openLtiOrWorseCount: 0,
      openCriticalMajorNcrCount:
        1,
      openRfiCount: 4,
      overdueRfiCount: 2,
      openPermitCount: 1,
      overduePermitCount: 1,
      expiredBondCount: 1,
      expiringBondCount30Days:
        2,
    },
    boardEvidence: null,
    managementActions: [
      "Approve a recovery strategy for the independent forecast variance.",
    ],
    evidenceRefs: [],
    diagnostics: [],
  };
}

function input():
  ManagementSurfacesInput {
  return {
    schemaVersion: "1.0",
    projectId: "MGMT-UAT",
    generatedAt:
      "2026-09-21T19:00:00.000Z",
    director: director(),
    modules: [
      {
        key:
          "schedule-analytics",
        label:
          "Programme Review",
        group:
          "Programme & Planning",
        status: "ready",
        reason: null,
      },
      {
        key:
          "payments",
        label: "Payments",
        group: "Commercial",
        status: "partial",
        reason:
          "Payment dates incomplete",
      },
    ],
    evidenceDocumentCount: 12,
    evidenceGaps: [
      {
        key: "risk-information",
        label:
          "Governed risk information",
        state: "missing",
        action:
          "Establish the governed Risk Register.",
        owningModule: null,
      },
    ],
    candidates: [
      {
        candidateId:
          "contract-clause:C-1",
        type:
          "contract_clause",
        label:
          "Clause 20.1",
        sourceRef:
          "contract:C-1",
        status:
          "pending_review",
        owningModule:
          "contract-particulars-bonds",
      },
    ],
    history: [
      {
        eventId: "H-1",
        occurredAt:
          "2026-09-21T18:00:00.000Z",
        entity:
          "Current programme",
        action:
          "Project position recalculated",
        actor: null,
        state: "pass",
        sourceRef:
          "rerun:H-1",
      },
    ],
    revisionAuthority: {
      baselineRevisionId: "S01",
      baselineLabel:
        "Baseline",
      currentRevisionId: "S03",
      currentLabel:
        "Current Update",
      currentDataDateIso:
        "2026-08-31",
      governedRevisionCount: 3,
      recoveryScenarioCount: 1,
      correctionModule:
        "revision-trend",
    },
    wbsControl: {
      observedWbsCount: 42,
      observedWbsLabels: [
        "Civil",
        "MEP",
      ],
      activityCount: 1000,
      activitiesWithWbs: 990,
      observedCoveragePercent: 99,
      officialWorkPackageCoveragePercent:
        null,
      officialWorkPackageState:
        "not_established",
    },
    commercial: {
      overdueUnpaidPayments: 2,
      paidLatePayments: 1,
      lateNotices: 1,
      notIssuedNotices: 1,
      evmByCurrency: [
        {
          currency: "AED",
          cv: -250_000,
          spi: 0.91,
          cpi: 0.95,
          state:
            "established",
        },
      ],
    },
    boardPublicationState: "none",
  };
}

test("management surfaces stay evidence-safe and do not invent authority", () => {
  const result =
    buildManagementSurfaces(
      input(),
    );

  assert.equal(
    result.masterDashboard
      .readiness.ready,
    1,
  );
  assert.equal(
    result.masterDashboard
      .readiness.partial,
    1,
  );

  const contractRisk =
    result.masterDashboard
      .metrics.find(
        (item) =>
          item.key ===
          "contract-risk",
      );
  assert.equal(
    contractRisk?.state,
    "unavailable",
    "a composite Contract Risk score must not be manufactured before the governed capability exists",
  );
  assert.equal(
    contractRisk?.value,
    null,
  );

  const risk =
    result.masterDashboard
      .metrics.find(
        (item) =>
          item.key ===
          "open-risk",
      );
  assert.equal(
    risk?.value,
    null,
    "missing governed risk evidence must not appear as zero open risks",
  );
  assert.equal(
    risk?.state,
    "unavailable",
  );

  assert.equal(
    result.commandCenter
      .alerts.some(
        (item) =>
          item.alertId ===
          "overdue-unpaid-payment",
      ),
    true,
  );
  assert.equal(
    result.commandCenter
      .alerts.some(
        (item) =>
          item.alertId ===
          "late-notice",
      ),
    true,
  );
  assert.equal(
    result.commandCenter
      .decisions[0]
      ?.accountableOwner,
    null,
    "the system must not invent an accountable owner for a Project Director action",
  );
  assert.equal(
    result.commandCenter
      .decisions[0]
      ?.state,
    "not_assigned",
  );

  assert.equal(
    result.masterControlProgramme
      .wbsControl
      .officialWorkPackageState,
    "not_established",
    "observed WBS labels must not become official work packages",
  );
  assert.equal(
    result.masterControlProgramme
      .wbsControl
      .officialWorkPackageCoveragePercent,
    null,
  );
  assert.equal(
    result.masterControlProgramme
      .candidateInbox[0]
      ?.status,
    "pending_review",
    "candidate evidence must not auto-promote into the official MCP position",
  );
});


test("management dashboard uses defensibility wording for claim linkage", () => {
  const result =
    buildManagementSurfaces(
      input(),
    );
  const linkage =
    result.masterDashboard
      .metrics.find(
        (item) =>
          item.key ===
          "claims-linkage",
      );
  assert.equal(
    linkage?.label,
    "Fully defensible claim chain",
  );
  assert.equal(
    linkage?.basis,
    "Full chain: claim → event → activity",
  );
  assert.equal(
    linkage?.value,
    "1 / 2",
  );
});

test("MCP preserves null reason for a ready specialist position", () => {
  const result =
    buildManagementSurfaces(
      input(),
    );
  const ready =
    result.masterControlProgramme
      .specialistPositions.find(
        (item) =>
          item.key ===
          "schedule-analytics",
      );
  assert.equal(
    ready?.status,
    "ready",
  );
  assert.equal(
    ready?.reason,
    null,
    "a ready specialist position must not carry a contradictory not-established reason",
  );
});
