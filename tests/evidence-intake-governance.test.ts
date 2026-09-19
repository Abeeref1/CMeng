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
  date: string,
  finish: string,
): string {
  return [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tlast_recalc_date",
    "%R\t1\t" +
      project +
      "\t" +
      date,
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

async function upload(
  base: string,
  project: string,
  filename: string,
  body: string,
  contentType: string,
  intent:
    | "add_update"
    | "replace_current_basis" =
    "add_update",
) {
  const response =
    await fetch(
      base +
        "/api/projects/" +
        project +
        "/evidence/uploads",
      {
        method: "POST",
        headers: {
          "content-type":
            contentType,
          "x-source-filename":
            filename,
          "x-upload-intent":
            intent,
        },
        body,
      },
    );
  if (
    response.status !==
    201
  ) {
    throw new Error(
      "Upload failed " +
        response.status +
        ": " +
        await response.text(),
    );
  }
  return await response.json() as any;
}

test("unified evidence intake governs Add Replace and family-specific history", async () => {
  await withServer(
    async (base) => {
      const project =
        "INTAKE-GOVERNANCE-UAT";

      const baseline =
        await upload(
          base,
          project,
          "Baseline_Rev0.xer",
          xer(
            project,
            "2026-01-01",
            "2026-09-01",
          ),
          "text/plain",
        );
      assert.equal(
        baseline.basisEffect
          .basisState,
        "active",
        "baseline=" +
          JSON.stringify(
            baseline.basisEffect,
          ),
      );

      const update =
        await upload(
          base,
          project,
          "Update_U01.xer",
          xer(
            project,
            "2026-06-01",
            "2026-09-20",
          ),
          "text/plain",
        );
      assert.equal(
        update.basisEffect
          .familyKey,
        "schedule:control",
      );
      assert.equal(
        update.basisEffect
          .basisState,
        "active",
        "update=" +
          JSON.stringify(
            update.basisEffect,
          ),
      );

      const recovery =
        await upload(
          base,
          project,
          "Recovery_R01.xer",
          xer(
            project,
            "2026-07-01",
            "2026-09-10",
          ),
          "text/plain",
        );
      assert.equal(
        recovery.basisEffect
          .basisState,
        "scenario",
      );
      assert.equal(
        recovery.basisEffect
          .changedActiveBasis,
        false,
      );

      const boq1 =
        [
          "Item No,Section,Cost Code,Description,Unit,Quantity,Rate SAR,Amount SAR",
          "1,Civil,CIV-01,Concrete,m3,100,10,1000",
        ].join("\n");
      const b1 =
        await upload(
          base,
          project,
          "BOQ_Rev01.csv",
          boq1,
          "text/csv",
        );
      assert.equal(
        b1.basisEffect
          .familyKey,
        "boq:quantity",
      );
      assert.equal(
        b1.basisEffect
          .basisState,
        "active",
        "boq1=" +
          JSON.stringify(
            b1.basisEffect,
          ),
      );

      const boq2 =
        [
          "Item No,Section,Cost Code,Description,Unit,Quantity,Rate SAR,Amount SAR",
          "1,Civil,CIV-01,Concrete,m3,120,10,1200",
        ].join("\n");
      const b2Candidate =
        await upload(
          base,
          project,
          "BOQ_Rev02.csv",
          boq2,
          "text/csv",
          "add_update",
        );
      assert.equal(
        b2Candidate
          .basisEffect
          .basisState,
        "candidate",
      );
      assert.equal(
        b2Candidate
          .basisEffect
          .changedActiveBasis,
        false,
      );

      const boq3 =
        [
          "Item No,Section,Cost Code,Description,Unit,Quantity,Rate SAR,Amount SAR",
          "1,Civil,CIV-01,Concrete,m3,130,10,1300",
        ].join("\n");
      const b3 =
        await upload(
          base,
          project,
          "BOQ_Rev03.csv",
          boq3,
          "text/csv",
          "replace_current_basis",
        );
      assert.equal(
        b3.basisEffect
          .basisState,
        "active",
        "boq3=" +
          JSON.stringify(
            b3.basisEffect,
          ),
      );
      assert.equal(
        b3.basisEffect
          .changedActiveBasis,
        true,
      );

      const risk1 =
        [
          "Risk ID,Category,Description,Probability,Impact,Rating,Owner,Status,Due Date",
          "R1,Schedule,Late access,High,High,High,PM,Open,2026-06-15",
        ].join("\n");
      const r1 =
        await upload(
          base,
          project,
          "Risk_Register_Rev01.csv",
          risk1,
          "text/csv",
        );
      assert.equal(
        r1.basisEffect
          .basisState,
        "active",
        "risk1=" +
          JSON.stringify(
            r1.basisEffect,
          ),
      );

      const risk2 =
        [
          "Risk ID,Category,Description,Probability,Impact,Rating,Owner,Status,Due Date",
          "R1,Schedule,Late access,High,High,High,PM,Closed,2026-06-15",
          "R2,Commercial,Variation exposure,Medium,High,High,CM,Open,2026-07-01",
        ].join("\n");
      const r2 =
        await upload(
          base,
          project,
          "Risk_Register_Rev02.csv",
          risk2,
          "text/csv",
        );
      assert.equal(
        r2.basisEffect
          .basisState,
        "active",
        "risk2=" +
          JSON.stringify(
            r2.basisEffect,
          ),
      );
      assert.equal(
        r2.basisEffect
          .changedActiveBasis,
        true,
      );

      const vo1 =
        await upload(
          base,
          project,
          "VO-014 Rev0.txt",
          [
            "VARIATION ORDER",
            "VO No: VO-014",
            "Variation Amount: SAR 500000",
            "Additional quantities",
          ].join("\n"),
          "text/plain",
        );
      const vo2 =
        await upload(
          base,
          project,
          "VO-015 Rev0.txt",
          [
            "VARIATION ORDER",
            "VO No: VO-015",
            "Variation Amount: SAR 300000",
            "Additional quantities",
          ].join("\n"),
          "text/plain",
        );
      assert.equal(
        vo1.basisEffect
          .basisState,
        "additive",
      );
      assert.equal(
        vo2.basisEffect
          .basisState,
        "additive",
      );

      const vo1Rev1 =
        await upload(
          base,
          project,
          "VO-014 Rev1.txt",
          [
            "VARIATION ORDER",
            "VO No: VO-014",
            "Variation Amount: SAR 550000",
            "Additional quantities",
          ].join("\n"),
          "text/plain",
          "replace_current_basis",
        );
      assert.equal(
        vo1Rev1.basisEffect
          .basisState,
        "additive",
      );

      const evidence =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/evidence/documents",
          )
        ).json() as any;

      const updateDocument =
        evidence.documents.find(
          (d: any) =>
            d.documentId ===
            update.documentId,
        );
      const recoveryDocument =
        evidence.documents.find(
          (d: any) =>
            d.documentId ===
            recovery.documentId,
        );
      const oldBoq =
        evidence.documents.find(
          (d: any) =>
            d.documentId ===
            b1.documentId,
        );
      const oldRisk =
        evidence.documents.find(
          (d: any) =>
            d.documentId ===
            r1.documentId,
        );
      const oldVo14 =
        evidence.documents.find(
          (d: any) =>
            d.documentId ===
            vo1.documentId,
        );
      const vo15 =
        evidence.documents.find(
          (d: any) =>
            d.documentId ===
            vo2.documentId,
        );

      assert.equal(
        updateDocument
          .basisState,
        "active",
      );
      assert.equal(
        recoveryDocument
          .basisState,
        "scenario",
      );
      assert.equal(
        oldBoq.basisState,
        "superseded",
      );
      assert.equal(
        oldRisk.basisState,
        "superseded",
      );
      assert.equal(
        oldVo14.basisState,
        "superseded",
      );
      assert.equal(
        vo15.basisState,
        "additive",
      );

      const overview =
        await (
          await fetch(
            base +
              "/api/projects/" +
              project +
              "/overview",
          )
        ).json() as any;

      assert.equal(
        overview
          .minimumEvidenceBasis
          .ready,
        true,
      );
      assert.equal(
        overview
          .activeEvidenceBasis[
            "schedule:control"
          ].activeDocumentId,
        update.documentId,
      );
      assert.equal(
        overview
          .activeEvidenceBasis[
            "boq:quantity"
          ].activeDocumentId,
        b3.documentId,
      );
      assert.equal(
        overview
          .activeEvidenceBasis[
            "risk_claims_procurement:risk_register"
          ].activeDocumentId,
        r2.documentId,
      );

      const rerun =
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/rerun",
          {
            method: "POST",
          },
        );
      const receipt =
        await rerun.json() as any;
      assert.equal(
        rerun.status,
        200,
        "rerun certification=" +
          JSON.stringify(
            receipt.certification,
          ),
      );
      assert.equal(
        receipt.certification
          .state,
        "pass",
        JSON.stringify(
          receipt.certification,
        ),
      );
      assert.deepEqual(
        receipt.certification
          .failedCheckIds,
        [],
      );
      assert.equal(
        receipt.moduleCount,
        22,
      );
      assert.equal(
        receipt
          .pmoRecalculated,
        true,
      );
      assert.equal(
        receipt
          .directorRecalculated,
        true,
      );
      assert.equal(
        receipt
          .moduleResults
          .length,
        22,
      );

      const certificationIds =
        new Set(
          receipt.certification
            .checks.map(
              (check: any) =>
                check.checkId,
            ),
        );
      for (
        const required of [
          "ACTIVE_SCHEDULE_REVISION_CONSISTENCY",
          "PROGRESS_VALUE_CONSISTENCY",
          "PROGRESS_COVERAGE_CONSISTENCY",
          "FORECAST_COVERAGE_CONSISTENCY",
          "FORECAST_AUTHORITY_CONSISTENCY",
          "BOQ_ACTIVE_DOCUMENT_CONSISTENCY",
          "BOQ_BASIS_CONSISTENCY",
          "AUTHORITY_ON_ESTABLISHED_VALUES",
          "COVERAGE_RANGE_ON_EVIDENCE_VALUES",
          "CONTRADICTIONS_REMAIN_CALCULABLE_AND_USER_GOVERNED",
          "BOARD_EXPORT_PUBLICATION_BASIS",
        ]
      ) {
        assert.equal(
          certificationIds.has(
            required,
          ),
          true,
          required,
        );
      }

      const risk3 =
        [
          "Risk ID,Category,Description,Probability,Impact,Rating,Owner,Status,Due Date",
          "R1,Schedule,Late access,High,High,High,PM,Closed,2026-06-15",
          "R2,Commercial,Variation exposure,Medium,High,High,CM,Closed,2026-07-01",
          "R3,Interface,System integration,High,High,Critical,SI,Open,2026-08-01",
        ].join("\n");
      const rerunUpload =
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
                "Risk_Register_Rev03.csv",
              "x-upload-intent":
                "add_update",
              "x-rerun-after-upload":
                "true",
            },
            body: risk3,
          },
        );
      if (
        rerunUpload.status !==
        201
      ) {
        throw new Error(
          "Rerun upload failed " +
            rerunUpload.status +
            ": " +
            await rerunUpload.text(),
        );
      }
      const rerunUploadBody =
        await rerunUpload.json() as any;
      assert.equal(
        rerunUploadBody
          .rerun
          .certification
          .state,
        "pass",
        JSON.stringify(
          rerunUploadBody
            .rerun
            .certification,
        ),
      );
      assert.equal(
        rerunUploadBody
          .rerun
          .moduleCount,
        22,
      );
      assert.equal(
        rerunUploadBody
          .rerun
          .evidenceChanges
          .length,
        1,
      );
      assert.equal(
        rerunUploadBody
          .rerun
          .evidenceChanges[0]
          .familyKey,
        "risk_claims_procurement:risk_register",
      );
      assert.equal(
        rerunUploadBody
          .rerun
          .evidenceChanges[0]
          .changedActiveBasis,
        true,
      );
    },
  );
});
