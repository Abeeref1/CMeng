import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  RuntimeProjectStore,
} from "../packages/runtime-api/src/project-state";

function xerFixture(): Uint8Array {
  const text = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tdata_date",
    "%R\t1\tPERSIST\t2026-09-18",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\tROOT",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t10\tA100\tMobilise\tTK_Active\t2026-09-01\t2026-09-02\t2026-09-01\t2026-09-02\t16\t8\t8\t50",
    "%E",
  ].join("\n");
  return new TextEncoder()
    .encode(text);
}

test("volume-backed project state restores schedule revisions and controls after a new store instance", async () => {
  const dataDir = mkdtempSync(
    join(tmpdir(), "cmeng-state-"),
  );

  try {
    const first =
      new RuntimeProjectStore({
        dataDir,
        durable: true,
      });

    assert.equal(
      first.persistenceMode(),
      "railway_volume",
    );

    const upload =
      await first.ingestSchedule({
        projectId: "PERSIST",
        bytes: xerFixture(),
        mediaType: "text/plain",
        sourceFilename:
          "current.xer",
        role: "update",
        label: "Current",
        uploadedAt:
          "2026-09-18T20:00:00.000Z",
      });

    assert.equal(
      upload.activityCount,
      1,
    );

    first.updateControls(
      "PERSIST",
      {
        hseIncidents: [{
          incidentId: "H1",
          severity: "lti",
          status: "open",
          sourceRefs: [
            "hse:H1",
          ],
        }],
      },
    );

    const status =
      first.persistenceStatus();
    assert.equal(
      status.mode,
      "railway_volume",
    );
    assert.ok(
      existsSync(
        status.stateFile,
      ),
    );

    const uploadRoot = join(
      dataDir,
      "uploads",
      "PERSIST",
      "schedule",
    );
    assert.ok(
      existsSync(uploadRoot),
    );
    assert.ok(
      readdirSync(uploadRoot)
        .some(
          (name) =>
            name.endsWith(".xer"),
        ),
    );

    const second =
      new RuntimeProjectStore({
        dataDir,
        durable: true,
      });

    const restored =
      second.get("PERSIST");
    assert.ok(restored);
    assert.equal(
      restored!.schedules.length,
      1,
    );
    assert.equal(
      restored!.schedules[0]!
        .revision.model
        .activities[0]!
        .activityId,
      "A100",
    );
    assert.equal(
      restored!.controls
        .hseIncidents.length,
      1,
    );
    assert.equal(
      restored!.controls
        .hseIncidents[0]!
        .severity,
      "lti",
    );
  } finally {
    rmSync(
      dataDir,
      {
        recursive: true,
        force: true,
      },
    );
  }
});

test("local runtime explicitly reports non-durable mode when no Railway volume is configured", () => {
  const dataDir = mkdtempSync(
    join(tmpdir(), "cmeng-local-"),
  );

  try {
    const store =
      new RuntimeProjectStore({
        dataDir,
        durable: false,
      });

    assert.equal(
      store.persistenceMode(),
      "runtime_local",
    );
  } finally {
    rmSync(
      dataDir,
      {
        recursive: true,
        force: true,
      },
    );
  }
});
