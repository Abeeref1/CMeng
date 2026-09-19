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
  const server =
    createCmengServer();
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

function xer(
  project: string,
): string {
  return [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tlast_recalc_date",
    "%R\t1\t" + project + "\t2026-06-01",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name\twbs_name",
    "%R\t10\t1\tROOT\tProject",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t10\tA100\tMobilise\tTK_Complete\t2026-05-01\t2026-05-02\t2026-05-01\t2026-05-02\t16\t0\t0\t100",
    "%R\t101\t1\t10\tA200\tExcavate East Station\tTK_Active\t2026-05-03\t2026-07-10\t2026-05-03\t2026-07-15\t48\t24\t16\t50",
    "%T\tTASKPRED",
    "%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt",
    "%R\tR1\t1\t101\t1\t100\tPR_FS\t0",
    "%E",
  ].join("\n");
}

test("every CMeng module emits Submitted Independent Gap Consequence Action instead of avoidable blocking", async () => {
  await withServer(
    async (base) => {
      const project =
        "UNIVERSAL-CHALLENGE-UAT";

      const schedule =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/uploads",
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
            body: xer(project),
          },
        );
      assert.equal(
        schedule.status,
        201,
      );

      const contractorReport = [
        "MONTHLY PROGRESS REPORT",
        "Activity count: 1",
        "Relationship count: 0",
        "Critical activities: 0",
        "Overall progress: 55.6%",
        "Forecast completion: 2026-07-10",
      ].join("\n");

      const report =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/uploads",
          {
            method: "POST",
            headers: {
              "content-type":
                "text/plain",
              "x-source-filename":
                "monthly-report.txt",
              "x-evidence-category":
                "other",
            },
            body:
              contractorReport,
          },
        );
      assert.equal(
        report.status,
        201,
      );

      const overview =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/overview",
          )
        ).json() as {
          moduleStates: Array<{
            key: string;
            status: string;
          }>;
        };

      assert.equal(
        overview
          .moduleStates
          .length,
        22,
      );
      assert.equal(
        overview
          .moduleStates
          .filter(
            (item) =>
              item.status ===
              "blocked",
          ).length,
        0,
      );

      for (
        const module of
          overview.moduleStates
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
            status: string;
            data: {
              challenge?: {
                itemCount: number;
                items: Array<{
                  submitted: {
                    state: string;
                    value:
                      number |
                      string |
                      null;
                  };
                  independent: {
                    state: string;
                    value:
                      number |
                      string |
                      null;
                  };
                  gap: {
                    state: string;
                    value:
                      number |
                      string |
                      null;
                  };
                  consequence:
                    string;
                  action: string;
                }>;
              };
            };
          };

        assert.notEqual(
          result.status,
          "blocked",
          module.key,
        );
        assert.ok(
          result.data
            .challenge,
          module.key,
        );
        assert.ok(
          result.data
            .challenge!
            .itemCount > 0,
          module.key,
        );
        for (
          const item of
            result.data
              .challenge!
              .items
        ) {
          assert.ok(
            item.submitted
              .state,
            module.key,
          );
          assert.ok(
            item.independent
              .state,
            module.key,
          );
          assert.ok(
            item.gap.state,
            module.key,
          );
          assert.ok(
            item.consequence
              .length > 0,
            module.key,
          );
          assert.ok(
            item.action.length >
              0,
            module.key,
          );
        }
      }

      const scheduleAnalytics =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/schedule/modules/schedule-analytics",
          )
        ).json() as {
          data: {
            challenge: {
              items: Array<{
                metric: string;
                submitted: {
                  value:
                    number |
                    string |
                    null;
                };
                independent: {
                  value:
                    number |
                    string |
                    null;
                };
                gap: {
                  value:
                    number |
                    string |
                    null;
                };
              }>;
            };
          };
        };

      const activityCount =
        scheduleAnalytics
          .data.challenge.items
          .find(
            (item) =>
              item.metric ===
              "activity_count",
          );
      assert.ok(
        activityCount,
      );
      assert.equal(
        activityCount
          .submitted.value,
        1,
      );
      assert.equal(
        activityCount
          .independent.value,
        2,
      );
      assert.equal(
        activityCount.gap.value,
        1,
      );

      const resource =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/schedule/modules/resource-utilization",
          )
        ).json() as {
          status: string;
          data: {
            authority: string;
            scheduleDerivedScenarios:
              Array<{
                crewSize: number;
              }>;
          };
        };

      assert.equal(
        resource.status,
        "partial",
      );
      assert.equal(
        resource.data.authority,
        "schedule_derived_scenario",
      );
      assert.deepEqual(
        resource.data
          .scheduleDerivedScenarios
          .map(
            (row) =>
              row.crewSize,
          ),
        [4, 6, 8],
      );
    },
  );
});
