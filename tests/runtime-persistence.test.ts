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
import {
  sourceProductivityForecastEvidence,
} from "../packages/runtime-api/src/source-productivity-forecast";

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


test("restoring legacy baseline-named schedules repairs only strong source roles", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "cmeng-role-migration-"));
  try {
    const first = new RuntimeProjectStore({dataDir, durable:true});
    await first.ingestSchedule({
      projectId:"ROLE-MIGRATION",
      bytes:xerFixture(),
      mediaType:"text/plain",
      sourceFilename:"P7_Baseline_Rev0.xer",
      sourceRelativePath:"Schedules/P7_Baseline_Rev0.xer",
      role:"update",
      label:"P7 Baseline Rev0",
      uploadedAt:"2026-09-18T20:00:00.000Z",
    });
    await first.ingestSchedule({
      projectId:"ROLE-MIGRATION",
      bytes:new TextEncoder().encode(new TextDecoder().decode(xerFixture()).replace("2026-09-18","2026-09-19")),
      mediaType:"text/plain",
      sourceFilename:"CPS_Revision_01.xer",
      sourceRelativePath:"Schedules/CPS_Revision_01.xer",
      role:"update",
      label:"CPS Revision 01",
      uploadedAt:"2026-09-18T20:01:00.000Z",
    });
    const before=first.get("ROLE-MIGRATION")!;
    before.sourceIntegrationVersion="canonical-source-v5";
    first.replace(before);

    const second=new RuntimeProjectStore({dataDir,durable:true});
    const restored=second.get("ROLE-MIGRATION")!;
    const baseline=restored.schedules.find(s=>s.sourceFilename==="P7_Baseline_Rev0.xer")!;
    const generic=restored.schedules.find(s=>s.sourceFilename==="CPS_Revision_01.xer")!;
    assert.equal(baseline.role,"baseline");
    assert.equal(generic.role,"update","generic Revision_01 must not be guessed as baseline");
    const doc=restored.evidenceDocuments.find(d=>d.linkedArtifactId===baseline.revision.revisionId)!;
    assert.equal(doc.scheduleRole,"baseline");
    assert.equal(doc.documentType,"schedule_baseline");
    assert.equal(doc.familyKey,"schedule:baseline");
    assert.equal(restored.sourceIntegrationVersion,"canonical-source-v7");
  } finally {
    rmSync(dataDir,{recursive:true,force:true});
  }
});

test("restoring a stale runtime BOQ rebinds it to the governed active artifact", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "cmeng-boq-migration-"));
  try {
    const store=new RuntimeProjectStore({dataDir,durable:true});
    const base={
      projectId:"BOQ-MIGRATION",
      mediaType:"text/csv",
      uploadedAt:"2026-09-18T20:00:00.000Z",
      category:"boq_cost",
      documentType:"boq",
    };
    await store.ingestEvidenceFile({
      ...base,
      bytes:new TextEncoder().encode("Item No,Section,Cost Code,Description,Unit,Quantity,Rate SAR,Amount SAR\n1,Civil,CIV-01,Concrete,m3,10,2,20"),
      sourceFilename:"BOQ_Rev01.csv",
      uploadIntent:"add_update",
    });
    await store.ingestEvidenceFile({
      ...base,
      bytes:new TextEncoder().encode("Item No,Section,Cost Code,Description,Unit,Quantity,Rate SAR,Amount SAR\n1,Civil,CIV-01,Concrete,m3,20,2,40"),
      sourceFilename:"BOQ_Rev02.csv",
      uploadedAt:"2026-09-18T20:01:00.000Z",
      uploadIntent:"replace_current_basis",
    });
    const stale=store.get("BOQ-MIGRATION")!;
    assert.equal(stale.boqRevisions.length,2);
    const activeId=stale.activeEvidenceBasis["boq:quantity"]!.activeArtifactId!;
    const old=stale.boqRevisions.find(b=>b.ingestionId!==activeId)!;
    stale.boq=old;
    stale.sourceIntegrationVersion="canonical-source-v5";
    store.replace(stale);

    const restored=new RuntimeProjectStore({dataDir,durable:true}).get("BOQ-MIGRATION")!;
    assert.equal(restored.boq?.ingestionId,activeId);
    assert.equal(restored.quantities?.boqRevisionId,restored.boq?.evidenceReceipt.revisionId);
    assert.equal(restored.sourceIntegrationVersion,"canonical-source-v7");
  } finally {
    rmSync(dataDir,{recursive:true,force:true});
  }
});


test("restoring legacy productivity evidence promotes its source family without inventing forecast values", async () => {
  const dataDir =
    mkdtempSync(
      join(
        tmpdir(),
        "cmeng-productivity-migration-",
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
        "PRODUCTIVITY-MIGRATION",
      bytes:
        new TextEncoder().encode(
          new TextDecoder()
            .decode(
              xerFixture(),
            )
            .replace(
              "PERSIST",
              "PRODUCTIVITY-MIGRATION",
            ),
        ),
      mediaType: "text/plain",
      sourceFilename:
        "S03_Current_U02.xer",
      role: "update",
      label: "Current",
      uploadedAt:
        "2026-09-18T20:00:00.000Z",
    });

    const productivity =
      [
        "Work Package ID,Remaining Quantity,Conservative Achievable Rate Per Day,Productive Days,Interface Allowance Days,Independent Forecast Finish,As Of",
        "WP-01,100,10,10,2,2026-10-01,2026-09-18",
      ].join("\n");

    const upload =
      await first.ingestEvidenceFile({
        projectId:
          "PRODUCTIVITY-MIGRATION",
        bytes:
          new TextEncoder().encode(
            productivity,
          ),
        mediaType:
          "text/csv",
        sourceFilename:
          "IF01_Remaining_Quantity_Productivity_Model.csv",
        sourceRelativePath:
          "03_Schedule_Control/IF01_Remaining_Quantity_Productivity_Model.csv",
        uploadedAt:
          "2026-09-18T20:01:00.000Z",
      });

    const legacy =
      first.get(
        "PRODUCTIVITY-MIGRATION",
      )!;
    const document =
      legacy.evidenceDocuments.find(
        (item) =>
          item.documentId ===
          upload.documentId,
      )!;

    document.basisState =
      "historical";
    delete legacy.activeEvidenceBasis[
      document.familyKey
    ];
    legacy.sourceIntegrationVersion =
      "canonical-source-v6";
    first.replace(legacy);

    const restored =
      new RuntimeProjectStore({
        dataDir,
        durable: true,
      }).get(
        "PRODUCTIVITY-MIGRATION",
      )!;

    const restoredDocument =
      restored.evidenceDocuments.find(
        (item) =>
          item.documentId ===
          upload.documentId,
      )!;

    assert.equal(
      restoredDocument.category,
      "schedule_control",
    );
    assert.equal(
      restoredDocument.documentType,
      "productivity_work_package_register",
    );
    assert.equal(
      restoredDocument.basisState,
      "active",
    );
    assert.equal(
      restored.activeEvidenceBasis[
        restoredDocument.familyKey
      ]?.activeDocumentId,
      restoredDocument.documentId,
    );
    assert.equal(
      restored.sourceIntegrationVersion,
      "canonical-source-v7",
    );

    const forecast =
      sourceProductivityForecastEvidence(
        restored,
      );
    assert.equal(
      forecast.workPackageCount,
      1,
      "governed IF01 rows must be visible to the generic productivity producer",
    );
    assert.equal(
      forecast.method,
      "source_work_package_productivity_model",
    );
    assert.equal(
      forecast.completionIso,
      "2026-10-01",
      "source model finish is retained only because its quantity/rate/productive-day arithmetic reconciles",
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
