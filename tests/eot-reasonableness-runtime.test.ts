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
  dataDate: string,
  finish: string,
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
      "\t1000\t500\t0\t50",
    "%E",
  ].join("\n");
}

test("multiple absurd claimed-EOT values cannot become the project EOT and do not erase independent movement", async () => {
  await withServer(
    async (base) => {
      const project =
        "EOT-OUTLIER-UAT";

      for (const upload of [
        {
          role: "baseline",
          filename:
            "baseline.xer",
          body: xer(
            project,
            "2026-06-01",
            "2026-08-01",
          ),
        },
        {
          role: "update",
          filename:
            "update.xer",
          body: xer(
            project,
            "2026-07-01",
            "2026-08-15",
          ),
        },
      ]) {
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
                  upload.filename,
                "x-schedule-role":
                  upload.role,
              },
              body: upload.body,
            },
          );
        assert.equal(
          response.status,
          201,
          await response.text(),
        );
      }

      const controls =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/controls",
          {
            method: "PUT",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              delayClaims: {
                projectId:
                  project,
                evidenceRevisionId:
                  "claims-1",
                events: [],
                notices: [],
                claims: [
                  {
                    claimId: "C1",
                    title:
                      "Claim 1",
                    state:
                      "submitted",
                    eventIds: [],
                    submittedAt:
                      "2026-07-02",
                    claimedDays:
                      8000,
                    claimedAmount:
                      null,
                    assessedDays:
                      null,
                    assessedDaysState:
                      "missing",
                    assessedAmount:
                      null,
                    assessedAmountState:
                      "missing",
                    clauseIdentifiers:
                      [],
                    evidenceRefs: [],
                    diagnostics: [],
                  },
                  {
                    claimId: "C2",
                    title:
                      "Claim 2",
                    state:
                      "submitted",
                    eventIds: [],
                    submittedAt:
                      "2026-07-03",
                    claimedDays:
                      6503,
                    claimedAmount:
                      null,
                    assessedDays:
                      null,
                    assessedDaysState:
                      "missing",
                    assessedAmount:
                      null,
                    assessedAmountState:
                      "missing",
                    clauseIdentifiers:
                      [],
                    evidenceRefs: [],
                    diagnostics: [],
                  },
                ],
                noticeRequirements:
                  [],
                diagnostics: [],
              },
              contractTimeBasis: {
                contractualCompletionIso:
                  "2026-09-01T00:00:00.000Z",
                contractualCompletionState:
                  "official",
                officialApprovedEotDays:
                  null,
                officialApprovedEotState:
                  "missing",
                eotDayBasis:
                  "calendar_days",
                eotDayBasisState:
                  "official",
                sourceRefs: [
                  "contract:completion",
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

      const response =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/schedule/modules/eot-assessment",
        );
      assert.equal(
        response.status,
        200,
      );

      const result =
        await response.json() as {
          data: {
            analyticalTimeImpactCandidateDays:
              number;
            attributableCandidateEotDays:
              number;
            candidateAdditionalEotDays:
              number;
            challenge: {
              items: Array<{
                metric: string;
                submitted: {
                  state: string;
                  value:
                    number |
                    string |
                    null;
                  note: string | null;
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
              }>;
            };
          };
        };

      assert.ok(
        result.data
          .analyticalTimeImpactCandidateDays >
          0,
      );
      assert.ok(
        result.data
          .analyticalTimeImpactCandidateDays <
          365,
        "independent time impact must remain a project-scale movement, not inherit the absurd raw claim total",
      );
      assert.equal(
        result.data
          .attributableCandidateEotDays,
        0,
      );
      assert.equal(
        result.data
          .candidateAdditionalEotDays,
        0,
      );

      const claimed =
        result.data.challenge.items
          .find(
            (item) =>
              item.metric ===
              "claimed_eot_days",
          );

      assert.ok(claimed);
      assert.equal(
        claimed.submitted.state,
        "conflicted",
      );
      assert.equal(
        claimed.submitted.value,
        14503,
      );
      assert.match(
        claimed.submitted.note ??
          "",
        /does not treat this as consolidated project EOT/i,
      );
      assert.equal(
        claimed.independent.value,
        result.data
          .analyticalTimeImpactCandidateDays,
      );
      assert.equal(
        claimed.independent.state,
        "scenario",
      );
      assert.equal(
        claimed.gap.state,
        "conflicted",
      );
      assert.equal(
        claimed.gap.value,
        null,
      );
    },
  );
});
