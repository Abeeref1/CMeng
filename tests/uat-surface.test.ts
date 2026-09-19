import test from "node:test";
import assert from "node:assert/strict";
import type {
  AddressInfo,
} from "node:net";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";

async function withServer(
  fn: (base: string) => Promise<void>,
) {
  const server = createCmengServer();
  await new Promise<void>((resolve) => {
    server.listen(
      0,
      "127.0.0.1",
      () => resolve(),
    );
  });

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
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      },
    );
  }
}

function xerFixture(): string {
  return [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tdata_date",
    "%R\t1\tREAL-UAT\t2026-09-18",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\tROOT",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t10\tA100\tMobilise\tTK_Complete\t2026-09-01\t2026-09-02\t2026-09-01\t2026-09-02\t16\t0\t0\t100",
    "%R\t101\t1\t10\tA200\tExcavate\tTK_Active\t2026-09-03\t2026-09-10\t2026-09-03\t2026-09-12\t48\t24\t16\t50",
    "%T\tTASKPRED",
    "%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt",
    "%R\tR1\t1\t101\t1\t100\tPR_FS\t0",
    "%E",
  ].join("\n");
}

test("browser root serves CMeng UAT application", async () => {
  await withServer(
    async (base) => {
      const response =
        await fetch(base + "/");
      assert.equal(
        response.status,
        200,
      );
      assert.match(
        response.headers.get(
          "content-type",
        ) ?? "",
        /text\/html/,
      );
      const html =
        await response.text();
      assert.match(
        html,
        /Project Director/,
      );
      assert.match(
        html,
        /Open sample project/,
      );
      assert.match(
        html,
        /Schedule revision/,
      );
    },
  );
});

test("certified demo exposes all 22 modules plus Director and board-ready report", async () => {
  await withServer(
    async (base) => {
      const project =
        "DEMO-E2E";

      const demo = await fetch(
        base +
          "/api/projects/" +
          project +
          "/demo",
        { method: "POST" },
      );
      assert.equal(
        demo.status,
        201,
      );

      const overview =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/overview",
        );
      assert.equal(
        overview.status,
        200,
      );
      const o =
        await overview.json() as {
          demo: boolean;
          revisionCount: number;
          moduleStates: Array<{
            key: string;
            status: string;
          }>;
        };

      assert.equal(o.demo, true);
      assert.equal(
        o.revisionCount,
        2,
      );
      assert.equal(
        o.moduleStates.length,
        22,
      );
      assert.equal(
        o.moduleStates.filter(
          (item) =>
            item.status === "blocked",
        ).length,
        0,
      );

      for (
        const module of o.moduleStates
      ) {
        const response =
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/schedule/modules/" +
              module.key,
          );
        assert.equal(
          response.status,
          200,
          module.key,
        );
        const result =
          await response.json() as {
            key: string;
            status: string;
            data: unknown;
          };
        assert.equal(
          result.key,
          module.key,
        );
        assert.notEqual(
          result.status,
          "blocked",
        );
        assert.notEqual(
          result.data,
          null,
        );
      }

      const director =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/director-position",
        );
      assert.equal(
        director.status,
        200,
      );
      const d =
        await director.json() as {
          commercialByCurrency:
            Array<{
              currency: string;
            }>;
          claims: {
            fullyLinkedClaimCount:
              number;
          };
        };
      assert.deepEqual(
        d.commercialByCurrency.map(
          (row) => row.currency,
        ),
        ["AED", "USD"],
      );
      assert.equal(
        d.claims
          .fullyLinkedClaimCount,
        1,
      );

      const board =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/board-report",
        );
      assert.equal(
        board.status,
        200,
      );
      const b =
        await board.json() as {
          state: string;
          evidenceReceiptIds:
            string[];
        };
      assert.equal(
        b.state,
        "board_ready",
      );
      assert.ok(
        b.evidenceReceiptIds
          .length > 0,
      );
    },
  );
});

test("real XER upload creates isolated project revision and usable schedule module", async () => {
  await withServer(
    async (base) => {
      const project =
        "REAL-E2E";
      const response =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/schedule/uploads",
          {
            method: "POST",
            headers: {
              "content-type":
                "text/plain",
              "x-source-filename":
                "current.xer",
              "x-schedule-role":
                "update",
            },
            body: xerFixture(),
          },
        );

      assert.equal(
        response.status,
        201,
      );
      const uploaded =
        await response.json() as {
          projectId: string;
          format: string;
          activityCount: number;
          relationshipCount: number;
        };
      assert.equal(
        uploaded.projectId,
        project,
      );
      assert.equal(
        uploaded.format,
        "xer",
      );
      assert.equal(
        uploaded.activityCount,
        2,
      );
      assert.equal(
        uploaded.relationshipCount,
        1,
      );

      const overview =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/overview",
        );
      const o =
        await overview.json() as {
          demo: boolean;
          revisionCount: number;
        };
      assert.equal(o.demo, false);
      assert.equal(
        o.revisionCount,
        1,
      );

      const analytics =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/schedule/modules/schedule-analytics",
        );
      assert.equal(
        analytics.status,
        200,
      );
      const a =
        await analytics.json() as {
          status: string;
          data: {
            result: {
              activityCount: number;
            };
          };
        };
      assert.equal(
        a.status,
        "ready",
      );
      assert.equal(
        a.data.result
          .activityCount,
        2,
      );

      const pmo =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/schedule/modules/pmo-analysis",
        );
      assert.equal(
        pmo.status,
        200,
      );
      const partial =
        await pmo.json() as {
          status: string;
          reason: string | null;
          data: {
            synthesisState: string;
            challenge: {
              itemCount: number;
              notSubmittedCount:
                number;
            };
          };
        };
      assert.equal(
        partial.status,
        "partial",
      );
      assert.equal(
        partial.data
          .synthesisState,
        "partial_cross_domain",
      );
      assert.ok(
        partial.data
          .challenge
          .itemCount > 0,
      );
      assert.match(
        partial.reason ?? "",
        /missing evidence|synthesized|specialist/i,
      );
    },
  );
});


test("deleting the current programme document restores the prior update", async () => {
  await withServer(
    async (base) => {
      const project =
        "DELETE-DOC-E2E";

      const earlier =
        xerFixture().replace(
          "2026-09-18",
          "2026-09-17",
        );
      const current =
        xerFixture();

      for (
        const [filename, body] of [
          [
            "Very Long Programme Update Rev 01 - 17 September 2026.xer",
            earlier,
          ],
          [
            "Very Long Programme Update Rev 02 - 18 September 2026.xer",
            current,
          ],
        ] as const
      ) {
        const uploaded =
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/schedule/uploads",
            {
              method: "POST",
              headers: {
                "content-type":
                  "text/plain",
                "x-source-filename":
                  filename,
                "x-schedule-role":
                  "update",
              },
              body,
            },
          );
        assert.equal(
          uploaded.status,
          201,
        );
      }

      const before =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/documents",
        );
      const beforeBody =
        await before.json() as {
          documents: Array<{
            documentId: string;
            sourceFilename: string;
            basisState: string;
          }>;
        };

      assert.equal(
        beforeBody.documents.length,
        2,
      );
      const active =
        beforeBody.documents.find(
          (document) =>
            document.basisState ===
            "active",
        );
      assert.ok(active);
      assert.match(
        active.sourceFilename,
        /Rev 02/,
      );

      const deleted =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/documents/" +
            encodeURIComponent(
              active.documentId,
            ),
          {
            method: "DELETE",
          },
        );
      assert.equal(
        deleted.status,
        200,
      );
      const deletedBody =
        await deleted.json() as {
          positionRefreshRequired:
            boolean;
          rerun?: unknown;
        };
      assert.equal(
        deletedBody
          .positionRefreshRequired,
        true,
      );
      assert.equal(
        "rerun" in deletedBody,
        false,
        "document deletion must not wait for a full project rerun",
      );

      const after =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/documents",
        );
      const afterBody =
        await after.json() as {
          documents: Array<{
            sourceFilename: string;
            basisState: string;
          }>;
        };

      assert.equal(
        afterBody.documents.length,
        1,
      );
      assert.match(
        afterBody.documents[0]!
          .sourceFilename,
        /Rev 01/,
      );
      assert.equal(
        afterBody.documents[0]!
          .basisState,
        "active",
      );

      const overview =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/overview",
        );
      const overviewBody =
        await overview.json() as {
          revisionCount: number;
          latestDataDateIso:
            string | null;
        };

      assert.equal(
        overviewBody.revisionCount,
        1,
      );
      assert.equal(
        overviewBody
          .latestDataDateIso,
        "2026-09-17",
      );
    },
  );
});
