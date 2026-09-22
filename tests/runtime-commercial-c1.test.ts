import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";
import {
  buildCommercialControlPosition,
} from "../packages/commercial-control/src";
import type {
  DelayClaimsModel,
} from "../packages/delay-analysis-core/src";

async function withServer(
  fn: (base: string) => Promise<void>,
) {
  const server = createCmengServer();
  await new Promise<void>(
    (resolve) => {
      server.listen(
        0,
        "127.0.0.1",
        () => resolve(),
      );
    },
  );
  try {
    const address =
      server.address() as AddressInfo;
    await fn(
      "http://127.0.0.1:" +
        address.port,
    );
  } finally {
    await new Promise<void>(
      (resolve, reject) => {
        server.close(
          (error) => {
            if (error) reject(error);
            else resolve();
          },
        );
      },
    );
  }
}

test("C1 exposes real Commercial routes, evidence-driven status and portfolio integration", async () => {
  await withServer(
    async (base) => {
      const project =
        "C1-COMMERCIAL-" +
        process.pid;

      const created =
        await fetch(
          base + "/api/projects",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              projectId: project,
            }),
          },
        );
      assert.equal(
        created.status,
        201,
        await created.text(),
      );

      const controls =
        await fetch(
          base +
            "/api/projects/" +
            encodeURIComponent(
              project,
            ) +
            "/controls",
          {
            method: "PUT",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              contractValue: {
                amount: 100,
                currency: "USD",
                sourceRefs: [
                  "test:contract-value",
                ],
              },
            }),
          },
        );
      assert.equal(
        controls.status,
        200,
        await controls.text(),
      );

      const overview =
        await (
          await fetch(
            base +
              "/api/projects/" +
              encodeURIComponent(
                project,
              ) +
              "/commercial/modules/commercial-overview",
          )
        ).json() as {
          key: string;
          status: string;
          reason: string | null;
          data: {
            projectionKey: string;
            position: {
              sourceLedger: {
                producerVersion:
                  string;
              };
            };
          };
        };

      assert.equal(
        overview.key,
        "commercial-overview",
      );
      assert.equal(
        overview.status,
        "partial",
        "Commercial Overview must remain under review when only contract value is established and payment/claim/security domains are incomplete.",
      );
      assert.match(
        overview.reason ?? "",
        /incomplete|review/i,
      );
      assert.equal(
        overview.data
          .projectionKey,
        "commercial_overview",
      );
      assert.equal(
        overview.data.position
          .sourceLedger
          .producerVersion,
        "commercial-canonical-v1",
      );

      const payments =
        await (
          await fetch(
            base +
              "/api/projects/" +
              encodeURIComponent(
                project,
              ) +
              "/commercial/modules/payments",
          )
        ).json() as {
          status: string;
          reason: string | null;
        };
      assert.equal(
        payments.status,
        "partial",
      );
      assert.match(
        payments.reason ?? "",
        /not been submitted/i,
      );

      const legacy =
        await fetch(
          base +
            "/api/projects/" +
            encodeURIComponent(
              project,
            ) +
            "/schedule/modules/commercial-overview",
        );
      assert.equal(
        legacy.status,
        200,
        "The old schedule-prefixed Commercial route remains a compatibility alias.",
      );

      const report =
        await (
          await fetch(
            base +
              "/api/projects/" +
              encodeURIComponent(
                project,
              ) +
              "/commercial/modules/commercial-overview/report.json",
          )
        ).json() as {
          result: {
            key: string;
            data: {
              projectionKey:
                string;
            };
          };
        };
      assert.equal(
        report.result.key,
        "commercial-overview",
      );
      assert.equal(
        report.result.data
          .projectionKey,
        "commercial_overview",
      );

      const invalid =
        await fetch(
          base +
            "/api/projects/" +
            encodeURIComponent(
              project,
            ) +
            "/commercial/modules/near-critical",
        );
      assert.equal(
        invalid.status,
        404,
      );

      const capabilityIndex =
        await (
          await fetch(
            base +
              "/api/commercial/capabilities",
          )
        ).json() as {
          capabilityCount: number;
          phase: string;
          capabilities: Array<{
            key: string;
          }>;
        };
      assert.equal(
        capabilityIndex
          .capabilityCount,
        14,
      );
      assert.equal(
        capabilityIndex.phase,
        "C2B2",
      );
      assert.deepEqual(
        capabilityIndex
          .capabilities
          .map(
            (capability) =>
              capability.key,
          ),
        [
          "commercial-terms",
          "cost-register",
          "payment-register",
          "cbs-breakdown",
          "cost-control",
          "evm-performance",
          "cash-flow-register",
          "cost-scurve",
          "variations",
          "site-instructions",
          "contract-obligations",
          "liquidated-damages",
          "bonds-insurance",
          "retention-calendar",
        ],
      );

      const commercialTerms =
        await (
          await fetch(
            base +
              "/api/projects/" +
              encodeURIComponent(
                project,
              ) +
              "/commercial/capabilities/commercial-terms",
          )
        ).json() as {
          key: string;
          status: string;
          data: {
            capabilityKey:
              string;
            originalContractValueByCurrency:
              Array<{
                currency:
                  string;
                original: {
                  value:
                    number | null;
                };
              }>;
          };
        };
      assert.equal(
        commercialTerms.key,
        "commercial-terms",
      );
      assert.equal(
        commercialTerms
          .data.capabilityKey,
        "commercial-terms",
      );
      assert.equal(
        commercialTerms
          .data
          .originalContractValueByCurrency[0]
          ?.currency,
        "USD",
      );
      assert.equal(
        commercialTerms
          .data
          .originalContractValueByCurrency[0]
          ?.original.value,
        100,
      );

      const costControl =
        await (
          await fetch(
            base +
              "/api/projects/" +
              encodeURIComponent(
                project,
              ) +
              "/commercial/capabilities/cost-control",
          )
        ).json() as {
          key: string;
          status: string;
          data: {
            capabilityKey: string;
          };
        };
      assert.equal(
        costControl.key,
        "cost-control",
      );
      assert.equal(
        costControl.data
          .capabilityKey,
        "cost-control",
      );

      const costScurve =
        await (
          await fetch(
            base +
              "/api/projects/" +
              encodeURIComponent(
                project,
              ) +
              "/commercial/capabilities/cost-scurve",
          )
        ).json() as {
          key: string;
          data: {
            capabilityKey: string;
          };
        };
      assert.equal(
        costScurve.data
          .capabilityKey,
        "cost-scurve",
      );

      const variationsCapability =
        await (
          await fetch(
            base +
              "/api/projects/" +
              encodeURIComponent(
                project,
              ) +
              "/commercial/capabilities/variations",
          )
        ).json() as {
          key: string;
          data: {
            capabilityKey: string;
          };
        };
      assert.equal(
        variationsCapability
          .data.capabilityKey,
        "variations",
      );

      const ldCapability =
        await (
          await fetch(
            base +
              "/api/projects/" +
              encodeURIComponent(
                project,
              ) +
              "/commercial/capabilities/liquidated-damages",
          )
        ).json() as {
          key: string;
          data: {
            capabilityKey: string;
          };
        };
      assert.equal(
        ldCapability.data
          .capabilityKey,
        "liquidated-damages",
      );

      const retentionCapability =
        await (
          await fetch(
            base +
              "/api/projects/" +
              encodeURIComponent(
                project,
              ) +
              "/commercial/capabilities/retention-calendar",
          )
        ).json() as {
          key: string;
          data: {
            capabilityKey: string;
          };
        };
      assert.equal(
        retentionCapability
          .data.capabilityKey,
        "retention-calendar",
      );

      const invalidCapability =
        await fetch(
          base +
            "/api/projects/" +
            encodeURIComponent(
              project,
            ) +
            "/commercial/capabilities/not-real",
        );
      assert.equal(
        invalidCapability.status,
        404,
      );

      const portfolio =
        await (
          await fetch(
            base +
              "/api/portfolio",
          )
        ).json() as {
          projects: Array<{
            projectId: string;
            moduleCount: number;
            scheduleModuleCount:
              number;
            commercialModuleCount:
              number;
            readyModules: number;
            partialModules: number;
            blockedModules: number;
            commercialCurrencyCount:
              number;
          }>;
        };
      const item =
        portfolio.projects.find(
          (entry) =>
            entry.projectId ===
            project,
        );
      assert.ok(item);
      assert.equal(
        item.moduleCount,
        29,
      );
      assert.equal(
        item.scheduleModuleCount,
        22,
      );
      assert.equal(
        item.commercialModuleCount,
        7,
      );
      assert.equal(
        item.commercialCurrencyCount,
        1,
      );
      assert.equal(
        item.readyModules,
        2,
      );
      assert.equal(
        item.partialModules,
        5,
      );
      assert.equal(
        item.blockedModules,
        22,
      );
    },
  );
});


test("C1 Commercial claims and notices reuse governed lifecycle, notice timeliness and fail partial money coverage closed", () => {
  const ref = (
    sourceId: string,
  ) => ({
    sourceType:
      "claim" as const,
    sourceId,
    locator: null,
  });
  const delayClaims:
    DelayClaimsModel = {
    projectId: "CLAIMS-UAT",
    evidenceRevisionId:
      "CLAIMS-R1",
    events: [
      {
        eventId: "EV-1",
        title:
          "Late access to work area",
        category: "late_access",
        startIso:
          "2026-08-01",
        endIso: null,
        responsibility:
          "employer",
        responsibilityState:
          "official",
        describedImpactDays:
          5,
        describedImpactState:
          "candidate",
        relatedActivityIds: [],
        relatedClauseIdentifiers: [
          "2.1",
        ],
        evidenceRefs: [
          ref("EV-1"),
        ],
        diagnostics: [],
      },
    ],
    notices: [
      {
        noticeId: "N-1",
        kind: "claim_notice",
        eventId: "EV-1",
        claimId: "CLM-1",
        actualIssuedAt:
          "2026-08-10",
        actualReceivedAt:
          "2026-08-10",
        plannedAt: null,
        subject:
          "Late access notice",
        clauseIdentifiers: [
          "20.1",
        ],
        evidenceRefs: [
          {
            sourceType:
              "notice",
            sourceId: "N-1",
            locator: null,
          },
        ],
        diagnostics: [],
      },
    ],
    claims: [
      {
        claimId: "CLM-1",
        title:
          "Late access claim",
        state: "submitted",
        eventIds: ["EV-1"],
        submittedAt:
          "2026-08-15",
        claimedDays: 5,
        claimedAmount:
          100_000,
        assessedDays: null,
        assessedDaysState:
          "missing",
        assessedAmount: null,
        assessedAmountState:
          "missing",
        clauseIdentifiers: [
          "20.1",
        ],
        evidenceRefs: [
          ref("CLM-1"),
        ],
        diagnostics: [],
      },
      {
        claimId: "CLM-2",
        title:
          "Commercial-only amount pending",
        state: "under_review",
        eventIds: ["EV-1"],
        submittedAt:
          "2026-08-20",
        claimedDays: null,
        claimedAmount: null,
        assessedDays: null,
        assessedDaysState:
          "missing",
        assessedAmount: null,
        assessedAmountState:
          "missing",
        clauseIdentifiers: [],
        evidenceRefs: [
          ref("CLM-2"),
        ],
        diagnostics: [],
      },
    ],
    noticeRequirements: [
      {
        requirementId:
          "REQ-20.1",
        noticeKind:
          "claim_notice",
        eventCategories: [
          "late_access",
        ],
        noticePeriodDays: 7,
        state: "official",
        clauseIdentifiers: [
          "20.1",
        ],
        evidenceRefs: [
          {
            sourceType:
              "contract",
            sourceId:
              "CLAUSE-20.1",
            locator: null,
          },
        ],
      },
    ],
    diagnostics: [],
  };

  const position =
    buildCommercialControlPosition({
      generatedAt:
        "2026-09-21T18:00:00.000Z",
      projectId: "CLAIMS-UAT",
      contractValue: null,
      variations: [],
      invoices: [],
      retentions: [],
      bonds: [],
      claimCommercials: [
        {
          claimId: "CLM-1",
          currency: "AED",
          claimedAmount:
            100_000,
          assessedAmount:
            80_000,
          sourceRefs: [
            "claim-money:CLM-1",
          ],
        },
        {
          claimId: "CLM-2",
          currency: "AED",
          claimedAmount: null,
          assessedAmount: null,
          sourceRefs: [
            "claim-money:CLM-2",
          ],
        },
      ],
      delayClaims,
      contractTimeBasis: null,
      commercialEvidenceSubmitted:
        false,
      paymentEvidenceSubmitted:
        false,
      variationEvidenceSubmitted:
        false,
      bondEvidenceSubmitted:
        false,
      claimEvidenceSubmitted:
        true,
    });

  assert.equal(
    position.claimsNotices.state,
    "established",
  );
  assert.equal(
    position.claimsNotices
      .commercialLifecycleLinkCoveragePercent,
    100,
  );
  assert.equal(
    position.claimsNotices
      .claimStateCounts
      .submitted,
    1,
  );
  assert.equal(
    position.claimsNotices
      .claimStateCounts
      .under_review,
    1,
  );
  assert.equal(
    position.claimsNotices
      .noticeTimelinessCounts
      .late,
    1,
  );
  assert.equal(
    position.claimsNotices
      .noticeAssessments[0]
      ?.requiredNoticeDays,
    7,
  );

  const aed =
    position.currencies.find(
      (row) =>
        row.currency === "AED",
    )!;
  assert.equal(
    aed.claimedAmount.value,
    100_000,
  );
  assert.equal(
    aed.claimedAmount.state,
    "submitted_unparsed",
    "known claim money may remain visible but partial amount coverage must not be promoted as established total exposure",
  );
  assert.ok(
    aed.claimedAmount
      .diagnostics.includes(
        "CLAIMED_AMOUNT_COVERAGE_PARTIAL_MISSING_AMOUNTS_ARE_NOT_ZERO",
      ),
  );
  assert.equal(
    aed.assessedClaimAmount
      .value,
    80_000,
  );
  assert.equal(
    aed.assessedClaimAmount
      .state,
    "submitted_unparsed",
  );
});
