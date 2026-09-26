import test from "node:test";
import assert from "node:assert/strict";
import type {
  AddressInfo,
} from "node:net";

import {
  analyzeCsvEvidence,
} from "../packages/runtime-api/src/evidence";
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
  dataDate: string,
  finish: string,
  percent: number,
): string {
  return [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tlast_recalc_date",
    "%R\t1\t" +
      project +
      "\t" +
      dataDate,
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name\twbs_name",
    "%R\t10\t1\tROOT\tProject",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t10\tA100\tMain Works\tTK_Active\t2026-01-01\t" +
      finish +
      "\t2026-01-01\t" +
      finish +
      "\t1000\t500\t0\t" +
      percent,
    "%E",
  ].join("\n");
}

async function uploadSchedule(
  base: string,
  project: string,
  role: string,
  filename: string,
  body: string,
): Promise<void> {
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
            filename,
          "x-upload-intent":"replace_current_basis",
          "x-schedule-role":
            role,
        },
        body,
      },
    );
  assert.equal(
    response.status,
    201,
    await response.text(),
  );
}

test("revision analytics follow schedule chronology and recovery never contaminates actual progress history", async () => {
  await withServer(
    async (base) => {
      const project =
        "REVISION-CHRONOLOGY-UAT";

      // Deliberately upload out of chronological order.
      await uploadSchedule(
        base,
        project,
        "update",
        "late-update.xer",
        xer(
          project,
          "2026-08-01",
          "2026-10-01",
          60,
        ),
      );
      await uploadSchedule(
        base,
        project,
        "baseline",
        "baseline.xer",
        xer(
          project,
          "2026-01-01",
          "2026-09-01",
          10,
        ),
      );
      await uploadSchedule(
        base,
        project,
        "update",
        "mid-update.xer",
        xer(
          project,
          "2026-06-01",
          "2026-09-15",
          40,
        ),
      );
      await uploadSchedule(
        base,
        project,
        "recovery",
        "recovery.xer",
        xer(
          project,
          "2026-09-01",
          "2026-09-20",
          95,
        ),
      );

      // Explicitly select the late update after reviewing the out-of-order uploads.
      await uploadSchedule(base,project,"update","late-update.xer",xer(project,"2026-08-01","2026-10-01",60));

      const trend =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/schedule/modules/revision-trend",
          )
        ).json() as {
          data: {
            points: Array<{
              dataDateIso:
                string | null;
            }>;
          };
        };

      assert.deepEqual(
        trend.data.points.map(
          (point) =>
            point.dataDateIso
              ?.slice(0, 10),
        ),
        [
          "2026-01-01",
          "2026-06-01",
          "2026-08-01",
        ],
      );

      const history =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/schedule/modules/forecast-history",
          )
        ).json() as {
          data: {
            points: Array<{
              dataDateIso:
                string | null;
            }>;
          };
        };

      assert.deepEqual(
        history.data.points.map(
          (point) =>
            point.dataDateIso
              ?.slice(0, 10),
        ),
        [
          "2026-01-01",
          "2026-06-01",
          "2026-08-01",
        ],
      );

      const scurve =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/schedule/modules/progress-scurve",
          )
        ).json() as {
          data: {
            actualSnapshots:
              Array<{
                asOfIso: string;
                progressPercent:
                  number;
              }>;
          };
        };

      assert.deepEqual(
        scurve.data
          .actualSnapshots
          .map(
            (point) =>
              point.asOfIso
                .slice(0, 10),
          ),
        [
          "2026-01-01",
          "2026-06-01",
          "2026-08-01",
        ],
      );
      assert.ok(
        scurve.data
          .actualSnapshots
          .every(
            (point) =>
              point.progressPercent !==
              95,
          ),
        "Recovery scenario progress must never enter actual-progress history.",
      );
    },
  );
});

test("Primary WBS is not misreported as an Activity-ID mapping", () => {
  const csv = [
    "OBS Code,OBS Name,Primary WBS",
    "OBS-01,Project Director,WBS-CIVIL",
  ].join("\n");

  const result =
    analyzeCsvEvidence(
      Buffer.from(csv),
      new Set([
        "WBS-CIVIL",
        "A100",
      ]),
    );

  assert.equal(
    result.linkedActivityField,
    null,
  );
  assert.equal(
    result.linkedActivityCount,
    null,
  );
  assert.equal(
    result.mappedActivityCount,
    null,
  );
});

test("certified demo endpoint cannot replace a real project", async () => {
  await withServer(
    async (base) => {
      const realProject =
        "REAL-PROJECT-DO-NOT-OVERWRITE";
      await uploadSchedule(
        base,
        realProject,
        "update",
        "real.xer",
        xer(
          realProject,
          "2026-08-01",
          "2026-10-01",
          50,
        ),
      );

      const refused =
        await fetch(
          base +
            "/api/projects/" +
            realProject +
            "/demo",
          {
            method: "POST",
          },
        );
      assert.equal(
        refused.status,
        409,
      );

      const overview =
        await (
          await fetch(
            base +
              "/api/projects/" +
              realProject +
              "/overview",
          )
        ).json() as {
          demo: boolean;
          revisionCount: number;
        };
      assert.equal(
        overview.demo,
        false,
      );
      assert.equal(
        overview.revisionCount,
        1,
      );

      const demo =
        await fetch(
          base +
            "/api/projects/UAT-DEMO/demo",
          {
            method: "POST",
          },
        );
      assert.equal(
        demo.status,
        201,
        await demo.text(),
      );
    },
  );
});
