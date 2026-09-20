import test from "node:test";
import assert from "node:assert/strict";
import type {
  AddressInfo,
} from "node:net";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";

async function withServer(
  fn: (
    base: string,
  ) => Promise<void>,
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
            if (error) {
              reject(error);
            } else {
              resolve();
            }
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
      "\t1000\t500\t8\t50",
    "%E",
  ].join("\n");
}

async function uploadSchedule(
  base: string,
  project: string,
  role:
    | "baseline"
    | "update",
  filename: string,
  dataDate: string,
  finish: string,
) {
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
          "x-schedule-role":
            role,
        },
        body: xer(
          project,
          dataDate,
          finish,
        ),
      },
    );
  assert.equal(
    response.status,
    201,
    await response.text(),
  );
}

test("Progress Position does not relabel schedule progress as certified physical progress", async () => {
  await withServer(
    async (base) => {
      const project =
        "PROGRESS-AUTHORITY-UAT";
      await uploadSchedule(
        base,
        project,
        "baseline",
        "baseline.xer",
        "2026-06-01",
        "2026-12-31",
      );
      await uploadSchedule(
        base,
        project,
        "update",
        "update.xer",
        "2026-08-31",
        "2027-01-31",
      );

      const response =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/schedule/modules/progress-report",
        );
      assert.equal(
        response.status,
        200,
      );
      const result =
        await response.json() as {
          status: string;
          reason: string | null;
          data: {
            scheduleSnapshotOnly:
              boolean;
            progressBases: {
              physical: {
                authority:
                  string;
                valuePercent:
                  number | null;
              };
              contractorReported: {
                valuePercent:
                  number | null;
              };
              certified: {
                valuePercent:
                  number | null;
              };
            };
          };
        };

      assert.equal(
        result.status,
        "partial",
      );
      assert.equal(
        result.data
          .scheduleSnapshotOnly,
        true,
      );
      assert.equal(
        result.data
          .progressBases
          .physical.authority,
        "progress_snapshot",
      );
      assert.equal(
        result.data
          .progressBases
          .contractorReported
          .valuePercent,
        null,
      );
      assert.equal(
        result.data
          .progressBases
          .certified
          .valuePercent,
        null,
      );
      assert.match(
        result.reason ?? "",
        /not treated as certified physical progress/i,
      );
    },
  );
});

test("Notice counts are not presented as performance when delay events and requirements are absent", async () => {
  await withServer(
    async (base) => {
      const project =
        "NOTICE-ASSESSABILITY-UAT";
      await uploadSchedule(
        base,
        project,
        "update",
        "update.xer",
        "2026-08-31",
        "2027-01-31",
      );

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
                  "claims-register-1",
                events: [],
                notices: [
                  {
                    noticeId:
                      "N1",
                    kind:
                      "claim_notice",
                    eventId: null,
                    claimId: "C1",
                    actualIssuedAt:
                      "2026-08-15T00:00:00.000Z",
                    actualReceivedAt:
                      null,
                    plannedAt:
                      null,
                    subject:
                      "Claim notice",
                    clauseIdentifiers:
                      [],
                    evidenceRefs:
                      [],
                    diagnostics:
                      [],
                  },
                ],
                claims: [
                  {
                    claimId:
                      "C1",
                    title:
                      "Claim 1",
                    state:
                      "submitted",
                    eventIds: [],
                    submittedAt:
                      "2026-08-15T00:00:00.000Z",
                    claimedDays:
                      20,
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
                    evidenceRefs:
                      [],
                    diagnostics:
                      [],
                  },
                ],
                noticeRequirements:
                  [],
                diagnostics:
                  [],
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
            "/schedule/modules/notices-claims",
        );
      assert.equal(
        response.status,
        200,
      );
      const result =
        await response.json() as {
          status: string;
          reason: string | null;
          data: {
            claimCount: number;
            eventCount: number;
            timelyNoticeCount:
              number;
            lateNoticeCount:
              number;
            missingNoticeCount:
              number;
            noticeAssessmentState:
              string;
          };
        };

      assert.equal(
        result.status,
        "partial",
      );
      assert.equal(
        result.data.claimCount,
        1,
      );
      assert.equal(
        result.data.eventCount,
        0,
      );
      assert.equal(
        result.data
          .noticeAssessmentState,
        "not_assessable_without_delay_events_and_requirements",
      );
      assert.equal(
        result.data
          .timelyNoticeCount,
        0,
      );
      assert.equal(
        result.data
          .lateNoticeCount,
        0,
      );
      assert.equal(
        result.data
          .missingNoticeCount,
        0,
      );
      assert.match(
        result.reason ?? "",
        /not assessable/i,
      );
    },
  );
});
