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
    "%R\t11\t1\tCIV-EAST\tCivil East Station",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t11\tACT-CIV-EAST-401\tEast Station Bulk Excavation\tTK_Active\t2026-05-01\t2026-08-01\t2026-05-01\t2026-08-01\t800\t400\t0\t50",
    "%E",
  ].join("\n");
}

test("runtime auto-identifies a contractor manpower plan and feeds it into Delivery Challenge", async () => {
  await withServer(
    async (base) => {
      const project =
        "MP-RUNTIME-UAT";

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
              "x-upload-intent":"replace_current_basis",
          "x-schedule-role":
                "update",
            },
            body: xer(project),
          },
        );
      assert.equal(
        schedule.status,
        201,
        await schedule.text(),
      );

      const manpowerBody = [
        "Period,Planned Manpower,Trade,Work Front",
        "2026-06,100,Civil,East Station",
        "2026-07,120,Civil,East Station",
      ].join("\n");

      const manpower =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/uploads",
          {
            method: "POST",
            headers: {
              "content-type":
                "text/csv",
              "x-source-filename":
                "random_upload.csv",
              "x-evidence-category":
                "other",
            },
            body: manpowerBody,
          },
        );

      if (
        manpower.status !==
        201
      ) {
        throw new Error(
          await manpower.text(),
        );
      }

      const identified =
        await manpower.json() as {
          documentType: string;
          parserState: string;
        };

      assert.equal(
        identified.documentType,
        "contractor_manpower_plan",
      );
      assert.ok(
        [
          "parsed",
          "partial",
        ].includes(
          identified.parserState,
        ),
      );

      const moduleResponse =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/schedule/modules/challenge-contract",
        );

      assert.equal(
        moduleResponse.status,
        200,
      );

      const module =
        await moduleResponse.json() as {
          status: string;
          data: {
            deliveryChallenge: {
              manpowerChallenge: {
                submittedPlanAvailable:
                  boolean;
                submittedAverageManpower:
                  number | null;
                submittedPeakManpower:
                  number | null;
              };
            };
          };
        };

      assert.notEqual(
        module.status,
        "blocked",
      );
      assert.equal(
        module.data
          .deliveryChallenge
          .manpowerChallenge
          .submittedPlanAvailable,
        true,
      );
      assert.ok(
        (
          module.data
            .deliveryChallenge
            .manpowerChallenge
            .submittedAverageManpower ??
          0
        ) > 0,
      );
      assert.equal(
        module.data
          .deliveryChallenge
          .manpowerChallenge
          .submittedPeakManpower,
        120,
      );
    },
  );
});
