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

test("restoring legacy schedule support evidence reclassifies it and removes the false programme revision", async () => {
  const dataDir =
    mkdtempSync(
      join(
        tmpdir(),
        "cmeng-legacy-support-",
      ),
    );

  try {
    const first =
      new RuntimeProjectStore({
        dataDir,
        durable: true,
      });

    await first.ingestSchedule({
      projectId:
        "LEGACY-SUPPORT",
      bytes: xerFixture(),
      mediaType:
        "text/plain",
      sourceFilename:
        "S03_Current_U02.xer",
      sourceRelativePath:
        "02_Schedules_XER/S03_Current_U02.xer",
      role: "update",
      label: "S03 Current",
      uploadedAt:
        "2026-09-18T20:00:00.000Z",
    });

    await first.ingestSchedule({
      projectId:
        "LEGACY-SUPPORT",
      bytes: new TextEncoder()
        .encode(
          new TextDecoder()
            .decode(
              xerFixture(),
            )
            .replace(
              "PERSIST",
              "LEGACY-SUPPORT",
            ),
        ),
      mediaType:
        "text/plain",
      sourceFilename:
        "SCH03_Baseline_to_Current_Activity_Comparison.xer",
      sourceRelativePath:
        "02_Schedules_XER/SCH03_Baseline_to_Current_Activity_Comparison.xer",
      role: "baseline",
      label:
        "Baseline to Current Comparison",
      uploadedAt:
        "2026-09-18T20:01:00.000Z",
    });

    const before =
      first.get(
        "LEGACY-SUPPORT",
      );
    assert.ok(before);
    assert.equal(
      before!.schedules.length,
      2,
      "legacy snapshot intentionally contains the historical misclassification",
    );

    const second =
      new RuntimeProjectStore({
        dataDir,
        durable: true,
      });
    const restored =
      second.get(
        "LEGACY-SUPPORT",
      );
    assert.ok(restored);

    assert.equal(
      restored!.schedules.length,
      1,
      "support comparison must not remain a programme revision after restore",
    );
    assert.equal(
      restored!.schedules[0]!
        .sourceFilename,
      "S03_Current_U02.xer",
    );

    const support =
      restored!
        .evidenceDocuments
        .find(
          (document) =>
            document
              .sourceFilename
              .startsWith(
                "SCH03_",
              ),
        );
    assert.ok(support);
    assert.equal(
      support!.category,
      "schedule_control",
    );
    assert.equal(
      support!.documentType,
      "schedule_activity_comparison",
    );
    assert.equal(
      support!.scheduleRole,
      null,
    );
    assert.equal(
      support!.linkedArtifactId,
      null,
    );
    assert.equal(
      restored!
        .activeEvidenceBasis[
          "schedule:control"
        ]?.activeDocumentId,
      restored!
        .evidenceDocuments
        .find(
          (document) =>
            document
              .sourceFilename ===
            "S03_Current_U02.xer",
        )?.documentId,
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
