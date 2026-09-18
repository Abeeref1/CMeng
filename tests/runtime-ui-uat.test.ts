import test from "node:test";
import assert from "node:assert/strict";
import type {
  AddressInfo,
} from "node:net";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";

function xer(
  finish = "2026-01-10",
): Uint8Array {
  const value = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tlast_recalc_date",
    "%R\t1\tP88\t2026-01-05",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\tCivil",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tfree_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t10\tA100\tMobilize\tTT_Task\tTK_Complete\t2026-01-01\t2026-01-03\t2026-01-01\t2026-01-03\t2026-01-01\t2026-01-03\t16\t0\t0\t0\t100",
    "%R\t101\t1\t10\tA200\tExcavate\tTT_Task\tTK_Active\t2026-01-03\t2026-01-08\t2026-01-03\t" +
      finish +
      "\t2026-01-03\t\t40\t16\t16\t8\t60",
    "%T\tTASKPRED",
    "%F\ttask_pred_id\tproj_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt",
    "%R\t900\t1\t101\t100\tPR_FS\t0",
    "%E",
  ].join("\n");

  return new TextEncoder().encode(
    value,
  );
}

async function withServer(
  fn: (base: string) => Promise<void>,
) {
  const server = createCmengServer();
  await new Promise<void>((resolve) =>
    server.listen(
      0,
      "127.0.0.1",
      resolve,
    ),
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
      (resolve, reject) =>
        server.close((error) =>
          error
            ? reject(error)
            : resolve(),
        ),
    );
  }
}

test("browser UAT root is HTML and XER upload drives real Schedule modules", async () => {
  await withServer(async (base) => {
    const home = await fetch(base + "/");
    assert.equal(home.status, 200);
    assert.match(
      home.headers.get(
        "content-type",
      ) ?? "",
      /text\/html/,
    );
    const page = await home.text();
    assert.match(
      page,
      /CMeng Schedule Control Center/,
    );
    assert.match(
      page,
      /Evidence Workspace/,
    );

    const upload1 = await fetch(
      base +
        "/api/projects/UAT-001/schedule/uploads",
      {
        method: "POST",
        headers: {
          "content-type":
            "text/plain",
          "x-source-filename":
            "update-01.xer",
          "x-revision-id":
            "rev-1",
          "x-revision-label":
            "Update 01",
          "x-revision-sequence":
            "1",
        },
        body: xer(),
      },
    );
    assert.equal(
      upload1.status,
      201,
    );
    const first =
      await upload1.json() as {
        sourceProjectId:
          string | null;
        projectId: string;
        activityCount: number;
        evidenceReceiptId: string;
      };
    assert.equal(
      first.projectId,
      "UAT-001",
    );
    assert.equal(
      first.sourceProjectId,
      "P88",
    );
    assert.equal(
      first.activityCount,
      2,
    );
    assert.match(
      first.evidenceReceiptId,
      /^receipt_/,
    );

    const analytics = await fetch(
      base +
        "/api/projects/UAT-001/schedule/modules/schedule-analytics",
    );
    assert.equal(
      analytics.status,
      200,
    );
    const analyticsBody =
      await analytics.json() as {
        status: string;
        projection: {
          projectionKey: string;
        };
      };
    assert.equal(
      analyticsBody.status,
      "available",
    );
    assert.equal(
      analyticsBody.projection
        .projectionKey,
      "schedule_analytics",
    );

    const changeBefore =
      await fetch(
        base +
          "/api/projects/UAT-001/schedule/modules/schedule-change-report",
      );
    const beforeBody =
      await changeBefore.json() as {
        status: string;
        missingEvidence: string[];
      };
    assert.equal(
      beforeBody.status,
      "evidence_required",
    );
    assert.ok(
      beforeBody.missingEvidence
        .includes(
          "second_schedule_revision",
        ),
    );

    const upload2 = await fetch(
      base +
        "/api/projects/UAT-001/schedule/uploads",
      {
        method: "POST",
        headers: {
          "content-type":
            "text/plain",
          "x-source-filename":
            "update-02.xer",
          "x-revision-id":
            "rev-2",
          "x-revision-label":
            "Update 02",
          "x-revision-sequence":
            "2",
        },
        body: xer(
          "2026-01-12",
        ),
      },
    );
    assert.equal(
      upload2.status,
      201,
    );

    const changeAfter =
      await fetch(
        base +
          "/api/projects/UAT-001/schedule/modules/schedule-change-report",
      );
    const afterBody =
      await changeAfter.json() as {
        status: string;
        projection: {
          projectionKey: string;
        };
      };
    assert.equal(
      afterBody.status,
      "available",
    );
    assert.equal(
      afterBody.projection
        .projectionKey,
      "schedule_change_report",
    );

    const challenge = await fetch(
      base +
        "/api/projects/UAT-001/schedule/modules/challenge-contract",
    );
    const challengeBody =
      await challenge.json() as {
        status: string;
        missingEvidence: string[];
      };
    assert.equal(
      challengeBody.status,
      "evidence_required",
    );
    assert.ok(
      challengeBody.missingEvidence
        .includes(
          "contract_document",
        ),
    );

    const summary = await fetch(
      base +
        "/api/projects/UAT-001",
    );
    const project =
      await summary.json() as {
        scheduleRevisionCount: number;
        currentActivityCount: number;
        resourceAssignmentCount: number;
      };
    assert.equal(
      project.scheduleRevisionCount,
      2,
    );
    assert.equal(
      project.currentActivityCount,
      2,
    );
    assert.ok(
      project.resourceAssignmentCount >=
        0,
    );
  });
});
