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

function duplicateCodeXer(
  project: string,
): string {
  return [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tlast_recalc_date",
    "%R\t1\t" +
      project +
      "\t2026-07-01",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name\twbs_name",
    "%R\t10\t1\tROOT\tProject",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t10\tDUP-100\tWork A\tTK_Active\t2026-01-01\t2026-08-01\t2026-01-01\t2026-08-01\t1000\t500\t-80\t50",
    "%R\t101\t1\t10\tDUP-100\tWork B\tTK_Active\t2026-01-01\t2026-08-15\t2026-01-01\t2026-08-15\t1000\t500\t-40\t50",
    "%E",
  ].join("\n");
}

test("failed CPM never relabels source total float as an independent driving path", async () => {
  await withServer(
    async (base) => {
      const project =
        "CPM-INTEGRITY-UAT";
      const upload =
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
                "broken.xer",
              "x-upload-intent":"replace_current_basis",
          "x-schedule-role":
                "update",
            },
            body:
              duplicateCodeXer(
                project,
              ),
          },
        );
      assert.equal(
        upload.status,
        201,
        await upload.text(),
      );

      const independent =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/schedule/modules/independent-forecast",
          )
        ).json() as {
          data: {
            complete: boolean;
          };
        };
      assert.equal(
        independent.data.complete,
        false,
      );

      const analytics =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/schedule/modules/schedule-analytics",
          )
        ).json() as {
          status: string;
          reason: string | null;
          data: {
            criticalityBasis:
              string;
            independentCpmState:
              string;
            drivingPathState:
              string;
            interpretation:
              string;
            result: {
              float: {
                criticalCount:
                  number;
              };
            };
          };
        };

      assert.equal(
        analytics.status,
        "partial",
      );
      assert.equal(
        analytics.data
          .criticalityBasis,
        "source_total_float",
      );
      assert.equal(
        analytics.data
          .independentCpmState,
        "not_established",
      );
      assert.equal(
        analytics.data
          .drivingPathState,
        "not_established",
      );
      assert.ok(
        analytics.data.result.float
          .criticalCount > 0,
      );
      assert.match(
        analytics.data
          .interpretation,
        /source total-float classifications/i,
      );
      assert.match(
        analytics.data
          .interpretation,
        /does not call them an independently established critical\/driving path/i,
      );
    },
  );
});
