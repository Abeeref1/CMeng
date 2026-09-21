import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";

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
        "ready",
      );
      assert.equal(
        overview.reason,
        null,
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
        3,
      );
      assert.equal(
        item.partialModules,
        4,
      );
      assert.equal(
        item.blockedModules,
        22,
      );
    },
  );
});
