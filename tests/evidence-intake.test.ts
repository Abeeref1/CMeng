import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import JSZip from "jszip";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";
import {
  runtimeProjects,
} from "../packages/runtime-api/src/project-state";

async function withServer(
  fn: (base: string) => Promise<void>,
) {
  const server = createCmengServer();
  await new Promise<void>((resolve) => {
    server.listen(
      0,
      "127.0.0.1",
      () => resolve(),
    );
  });

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
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
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
    "%R\t1\t" + project + "\t" + dataDate,
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\tROOT",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t10\tA100\tMobilise\tTK_Complete\t2026-01-01\t2026-01-02\t2026-01-01\t2026-01-02\t16\t0\t0\t100",
    "%R\t101\t1\t10\tA200\tExcavate\tTK_Active\t2026-01-03\t2026-01-10\t2026-01-03\t" + finish + "\t48\t24\t16\t50",
    "%T\tTASKPRED",
    "%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt",
    "%R\tR1\t1\t101\t1\t100\tPR_FS\t0",
    "%E",
  ].join("\n");
}

async function postSchedule(
  base: string,
  project: string,
  filename: string,
  role: string,
  dataDate: string,
  finish: string,
) {
  const response = await fetch(
    base +
      "/api/projects/" +
      project +
      "/schedule/uploads",
    {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        "x-source-filename": filename,
        "x-source-relative-path":
          "02_Schedules_XER/" +
          filename,
        "x-schedule-role": role,
      },
      body: xer(
        project,
        dataDate,
        finish,
      ),
    },
  );
  if (response.status !== 201) {
    throw new Error(
      "Expected HTTP 201, received " +
        response.status +
        ": " +
        await response.text(),
    );
  }
}

test("baseline, updates and recovery remain distinct and recovery never silently becomes current", async () => {
  await withServer(async (base) => {
    const project =
      "MULTI-SCHEDULE-UAT";

    await postSchedule(
      base,
      project,
      "S01_Baseline_Rev0.xer",
      "baseline",
      "2026-01-31",
      "2026-01-10",
    );
    await postSchedule(
      base,
      project,
      "S02_Update_U01.xer",
      "update",
      "2026-06-30",
      "2026-01-15",
    );
    await postSchedule(
      base,
      project,
      "S03_Update_U02.xer",
      "update",
      "2026-11-30",
      "2026-01-20",
    );
    await postSchedule(
      base,
      project,
      "S04_Recovery_01.xer",
      "recovery",
      "2027-02-28",
      "2026-01-12",
    );

    const overviewResponse =
      await fetch(
        base +
          "/api/projects/" +
          project +
          "/overview",
      );
    assert.equal(
      overviewResponse.status,
      200,
    );
    const overview =
      await overviewResponse.json() as {
        revisionCount: number;
        baselineRevisionCount: number;
        updateRevisionCount: number;
        recoveryRevisionCount: number;
        latestDataDateIso: string | null;
      };

    assert.equal(
      overview.revisionCount,
      4,
    );
    assert.equal(
      overview.baselineRevisionCount,
      1,
    );
    assert.equal(
      overview.updateRevisionCount,
      2,
    );
    assert.equal(
      overview.recoveryRevisionCount,
      1,
    );
    assert.match(
      overview.latestDataDateIso ?? "",
      /^2026-11-30/,
    );

    const revisions =
      await fetch(
        base +
          "/api/projects/" +
          project +
          "/schedule/revisions",
      );
    const rows =
      await revisions.json() as Array<{
        role: string;
      }>;
    assert.deepEqual(
      rows.map((row) => row.role),
      [
        "baseline",
        "update",
        "update",
        "recovery",
      ],
    );
  });
});

test("supporting CSV evidence is retained and maps only explicit activity IDs", async () => {
  await withServer(async (base) => {
    const project =
      "EVIDENCE-MAPPING-UAT";
    await postSchedule(
      base,
      project,
      "S03_Latest_U02.xer",
      "update",
      "2026-11-30",
      "2026-01-20",
    );

    const body = [
      "Package ID,Description,Status,Linked Activity",
      "PKG-1,Rail package,Delivered,A200",
      "PKG-2,Signal package,Awarded,NOT-IN-SCHEDULE",
      "PKG-3,Unlinked package,Planned,",
    ].join("\n");

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
              "text/csv",
            "x-source-filename":
              "P01_Procurement_Register.csv",
            "x-source-relative-path":
              "05_Risk_Procurement_Claims/P01_Procurement_Register.csv",
          },
          body,
        },
      );
    if (response.status !== 201) {
      throw new Error(
        "Expected HTTP 201, received " +
          response.status +
          ": " +
          await response.text(),
      );
    }
    const result =
      await response.json() as {
        category: string;
        documentType: string;
        parserState: string;
        mapping: {
          linkedActivityCount: number | null;
          mappedActivityCount: number | null;
          unmappedActivityCount: number | null;
          coveragePercent: number | null;
        } | null;
      };
    assert.equal(
      result.category,
      "risk_claims_procurement",
    );
    assert.equal(
      result.documentType,
      "procurement_register",
    );
    assert.equal(
      result.parserState,
      "parsed",
    );
    assert.equal(
      result.mapping
        ?.linkedActivityCount,
      2,
    );
    assert.equal(
      result.mapping
        ?.mappedActivityCount,
      1,
    );
    assert.equal(
      result.mapping
        ?.unmappedActivityCount,
      1,
    );
    assert.equal(
      result.mapping
        ?.coveragePercent,
      50,
    );

    const library =
      await fetch(
        base +
          "/api/projects/" +
          project +
          "/evidence/documents",
      );
    assert.equal(
      library.status,
      200,
    );
    const documents =
      await library.json() as {
        documentCount: number;
        documents: Array<{
          sourceFilename: string;
        }>;
      };
    assert.equal(
      documents.documentCount,
      2,
    );
    assert.ok(
      documents.documents.some(
        (item) =>
          item.sourceFilename ===
          "P01_Procurement_Register.csv",
      ),
    );
  });
});

test("ZIP evidence pack routes schedules, BOQ CSV and other project evidence without flattening provenance", async () => {
  await withServer(async (base) => {
    const project =
      "ZIP-EVIDENCE-UAT";
    const zip = new JSZip();

    zip.file(
      "02_Schedules_XER/S01_Baseline_Rev0.xer",
      xer(
        project,
        "2026-01-31",
        "2026-01-10",
      ),
    );
    zip.file(
      "02_Schedules_XER/S02_Update_U01.xer",
      xer(
        project,
        "2026-06-30",
        "2026-01-15",
      ),
    );
    zip.file(
      "02_Schedules_XER/S03_Latest_U02.xer",
      xer(
        project,
        "2026-11-30",
        "2026-01-20",
      ),
    );
    zip.file(
      "02_Schedules_XER/S04_Recovery_01.xer",
      xer(
        project,
        "2027-02-28",
        "2026-01-12",
      ),
    );
    zip.file(
      "04_Cost_BOQ/B01_Original_BOQ.csv",
      [
        "Item No,Section,Cost Code,Description,Unit,Quantity,Rate SAR,Amount SAR,VAT Basis,Revision",
        "1.0001,Civil,CC-01,Excavation,m3,100,50,5000,Exclusive of VAT,P00",
        "1.0002,Track,CC-02,Rail,m,200,100,20000,Exclusive of VAT,P00",
      ].join("\n"),
    );
    zip.file(
      "07_Engineering/RFI01_Register.csv",
      [
        "RFI ID,Discipline,Subject,Status,Linked Activity",
        "RFI-1,STR,Foundation query,Open,A200",
      ].join("\n"),
    );

    const bytes =
      await zip.generateAsync({
        type: "uint8array",
      });
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
              "application/zip",
            "x-source-filename":
              "full-evidence.zip",
            "x-upload-id":
              "zip-progress-uat",
          },
          body: Buffer.from(bytes),
        },
      );
    if (response.status !== 201) {
      throw new Error(
        "Expected HTTP 201, received " +
          response.status +
          ": " +
          await response.text(),
      );
    }

    const progressResponse =
      await fetch(
        base +
          "/api/projects/" +
          project +
          "/evidence/upload-progress/zip-progress-uat",
      );
    assert.equal(
      progressResponse.status,
      200,
    );
    const progress =
      await progressResponse.json() as {
        state: string;
        percent: number;
        documentTotal: number | null;
        identifiedDocuments: number;
        processedDocuments: number;
        completedAt: string | null;
        updatedAt: string;
      };
    assert.equal(
      progress.state,
      "complete",
    );
    assert.equal(
      progress.percent,
      100,
    );
    assert.equal(
      progress.documentTotal,
      6,
    );
    assert.equal(
      progress.identifiedDocuments,
      6,
    );
    assert.equal(
      progress.processedDocuments,
      6,
    );
    assert.ok(progress.completedAt);
    assert.ok(progress.updatedAt);

    const result =
      await response.json() as {
        documentCount: number;
        documents: Array<{
          category: string;
          documentType: string;
          scheduleRole: string | null;
        }>;
      };
    assert.equal(
      result.documentCount,
      6,
    );
    assert.equal(
      result.documents.filter(
        (document) =>
          document.category ===
          "schedule",
      ).length,
      4,
    );
    assert.ok(
      result.documents.some(
        (document) =>
          document.documentType ===
          "boq",
      ),
    );

    const overview =
      await (
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/overview",
        )
      ).json() as {
        baselineRevisionCount: number;
        updateRevisionCount: number;
        recoveryRevisionCount: number;
        latestDataDateIso: string | null;
        boqState: string | null;
        evidenceDocumentCount: number;
      };
    assert.equal(
      overview.baselineRevisionCount,
      1,
    );
    assert.equal(
      overview.updateRevisionCount,
      2,
    );
    assert.equal(
      overview.recoveryRevisionCount,
      1,
    );
    assert.match(
      overview.latestDataDateIso ?? "",
      /^2026-11-30/,
    );
    assert.equal(
      overview.boqState,
      "verified_candidate",
    );
    assert.equal(
      overview.evidenceDocumentCount,
      6,
    );

    const documentRegister =
      await (
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/documents",
        )
      ).json() as {
        documents: Array<{
          uploadedAt: string;
          sourceFilename: string;
        }>;
      };
    assert.equal(
      documentRegister.documents.length,
      6,
    );
    assert.ok(
      documentRegister.documents.every(
        (document) =>
          Boolean(
            Date.parse(
              document.uploadedAt,
            ),
          ),
      ),
    );
  });
});



test("runtime activity variance uses the controlled baseline programme", async () => {
  await withServer(async (base) => {
    const project =
      "CONTROLLED-BASELINE-UAT";

    const customXer = (
      dataDate: string,
      targetFinish: string,
      currentFinish: string,
    ) => [
      "ERMHDR\t23.12",
      "%T\tPROJECT",
      "%F\tproj_id\tproj_short_name\tlast_recalc_date",
      "%R\t1\t" + project + "\t" + dataDate,
      "%T\tPROJWBS",
      "%F\twbs_id\tproj_id\twbs_short_name",
      "%R\t10\t1\tROOT",
      "%T\tTASK",
      "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
      "%R\t100\t1\t10\tA100\tMobilise\tTK_Complete\t2026-01-01\t2026-01-02\t2026-01-01\t2026-01-02\t16\t0\t0\t100",
      "%R\t101\t1\t10\tA200\tExcavate\tTK_Active\t2026-01-03\t" + targetFinish + "\t2026-01-03\t" + currentFinish + "\t48\t24\t16\t50",
      "%T\tTASKPRED",
      "%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt",
      "%R\tR1\t1\t101\t1\t100\tPR_FS\t0",
      "%E",
    ].join("\n");

    const upload = async (
      filename: string,
      role: string,
      dataDate: string,
      targetFinish: string,
      currentFinish: string,
    ) => {
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
              "x-source-relative-path":
                "02_Schedules_XER/" +
                filename,
              "x-schedule-role":
                role,
            },
            body: customXer(
              dataDate,
              targetFinish,
              currentFinish,
            ),
          },
        );
      const responseText =
        await response.text();
      assert.equal(
        response.status,
        201,
        responseText,
      );
    };

    await upload(
      "S01_Baseline_Rev0.xer",
      "baseline",
      "2026-01-01",
      "2026-01-10",
      "2026-01-10",
    );
    await upload(
      "S02_Current_U01.xer",
      "update",
      "2026-01-05",
      "2026-01-15",
      "2026-01-15",
    );

    const activityResponse =
      await fetch(
        base +
          "/api/projects/" +
          project +
          "/schedule/modules/activity-analytics",
      );
    assert.equal(
      activityResponse.status,
      200,
    );
    const activity =
      await activityResponse.json() as {
        data: {
          controlledBaselineRevisionId?: string;
          rows: Array<{
            activityId: string;
            finishVarianceDays: number | null;
          }>;
        };
      };

    assert.ok(
      activity.data
        .controlledBaselineRevisionId,
    );
    assert.equal(
      activity.data.rows.find(
        (row) =>
          row.activityId ===
          "A200",
      )?.finishVarianceDays,
      5,
    );

    const programmeResponse =
      await fetch(
        base +
          "/api/projects/" +
          project +
          "/schedule/modules/schedule-analytics",
      );
    assert.equal(
      programmeResponse.status,
      200,
    );
    const programme =
      await programmeResponse.json() as {
        data: {
          result: {
            completionBases: Array<{
              basis: string;
              dateIso: string | null;
            }>;
            finishVariance: {
              lateActivities: number;
              maximumDelayDays: number | null;
            };
          };
        };
      };
    assert.equal(
      programme.data.result
        .finishVariance
        .lateActivities,
      1,
    );
    assert.equal(
      programme.data.result
        .finishVariance
        .maximumDelayDays,
      5,
    );
    const programmeBasis =
      programme.data.result
        .completionBases.find(
          (basis) =>
            basis.basis ===
            "programme",
        );
    assert.match(
      programmeBasis?.dateIso ?? "",
      /^2026-01-10/,
      "Programme basis payload: " +
        JSON.stringify({
          programmeBasis,
          completionBases:
            programme.data.result
              .completionBases,
        }),
    );

    const managementResponse =
      await fetch(
        base +
          "/api/projects/" +
          project +
          "/schedule/modules/pmo-analysis",
      );
    assert.equal(
      managementResponse.status,
      200,
    );
    const management =
      await managementResponse.json() as {
        data: {
          programmeBaselineCompletionIso?: string | null;
        };
      };
    assert.match(
      management.data
        .programmeBaselineCompletionIso ??
        "",
      /^2026-01-10/,
    );

    const nearCriticalResponse =
      await fetch(
        base +
          "/api/projects/" +
          project +
          "/schedule/modules/near-critical",
      );
    assert.equal(
      nearCriticalResponse.status,
      200,
    );
    const nearCritical =
      await nearCriticalResponse.json() as {
        data: {
          rows: Array<{
            activityId: string;
            baselineFinishIso: string | null;
            currentFinishIso: string | null;
          }>;
        };
      };
    const nearRow =
      nearCritical.data.rows.find(
        (row) =>
          row.activityId ===
          "A200",
      );
    assert.match(
      nearRow?.baselineFinishIso ?? "",
      /^2026-01-10/,
    );
    assert.match(
      nearRow?.currentFinishIso ?? "",
      /^2026-01-15/,
    );
  });
});


test("legacy support artifacts are excluded from programme history even if stored as schedules", async () => {
  await withServer(async (base) => {
    const project =
      "LEGACY-SUPPORT-FILTER-UAT";

    await postSchedule(
      base,
      project,
      "S03_Current_U02.xer",
      "update",
      "2026-08-31",
      "2026-09-15",
    );

    // Simulates a legacy persisted mistake from an older release:
    // a comparison register was stored through the schedule route.
    await postSchedule(
      base,
      project,
      "SCH03_Baseline_to_Current_Activity_Comparison.csv",
      "baseline",
      "2026-09-01",
      "2026-09-20",
    );

    const overview =
      await (
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/overview",
        )
      ).json() as {
        revisionCount: number;
        updateRevisionCount: number;
        baselineRevisionCount: number;
        latestDataDateIso: string | null;
      };

    assert.equal(
      overview.revisionCount,
      1,
    );
    assert.equal(
      overview.updateRevisionCount,
      1,
    );
    assert.equal(
      overview.baselineRevisionCount,
      0,
    );
    assert.match(
      overview.latestDataDateIso ?? "",
      /^2026-08-31/,
    );

    const revisions =
      await (
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/schedule/revisions",
        )
      ).json() as Array<{
        sourceFilename: string | null;
      }>;

    assert.deepEqual(
      revisions.map(
        (row) =>
          row.sourceFilename,
      ),
      [
        "S03_Current_U02.xer",
      ],
    );
  });
});


test("schedule support registers never become programme revisions", async () => {
  await withServer(async (base) => {
    const project =
      "SCHEDULE-SUPPORT-UAT";

    await postSchedule(
      base,
      project,
      "S03_Current_U02.xer",
      "update",
      "2026-08-31",
      "2026-09-15",
    );

    const supportFiles = [
      {
        filename:
          "REL01_Longest_Path_Register.csv",
        body: [
          "Activity ID,Driving Path,Float Path,Total Float,Finish,Status",
          "A200,Yes,FP-01,16,2026-09-15,In Progress",
        ].join("\n"),
        expectedType:
          "longest_path_register",
      },
      {
        filename:
          "SCH03_Baseline_to_Current_Activity_Comparison.csv",
        body: [
          "Activity ID,Baseline Finish,Current Finish,Finish Variance Days,Change",
          "A200,2026-09-10,2026-09-15,5,Modified",
        ].join("\n"),
        expectedType:
          "schedule_activity_comparison",
      },
    ];

    for (const file of supportFiles) {
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
                "text/csv",
              "x-source-filename":
                file.filename,
              "x-source-relative-path":
                "02_Schedules_XER/" +
                file.filename,
            },
            body: file.body,
          },
        );

      const responseText =
        await response.text();
      assert.equal(
        response.status,
        201,
        responseText,
      );
      const result =
        JSON.parse(
          responseText,
        ) as {
          category: string;
          documentType: string;
        };
      assert.equal(
        result.category,
        "schedule_control",
      );
      assert.equal(
        result.documentType,
        file.expectedType,
      );
    }

    const overview =
      await (
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/overview",
        )
      ).json() as {
        revisionCount: number;
        updateRevisionCount: number;
      };

    assert.equal(
      overview.revisionCount,
      1,
    );
    assert.equal(
      overview.updateRevisionCount,
      1,
    );

    const revisions =
      await (
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/schedule/revisions",
        )
      ).json() as Array<{
        sourceFilename: string | null;
      }>;

    assert.equal(
      revisions.length,
      1,
    );
    assert.equal(
      revisions[0]
        ?.sourceFilename,
      "S03_Current_U02.xer",
    );
  });
});


test("content overrides a wrong filename, wrong MIME type and wrong declared category", async () => {
  await withServer(async (base) => {
    const project =
      "CONTENT-FIRST-UAT";
    const body = [
      "Risk ID,Category,Description,Probability,Impact,Rating,Owner,Status,Due Date",
      "RISK-0001,Cost,Supply chain risk,0.4,3,Extreme,Planning,Mitigating,2026-12-02",
    ].join("\n");

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
              "application/pdf",
            "x-source-filename":
              "C01_Main_Contract.pdf",
            "x-source-relative-path":
              "Other/C01_Main_Contract.pdf",
            "x-evidence-category":
              "contract",
            "x-document-type":
              "main_contract",
          },
          body,
        },
      );

    if (response.status !== 201) {
      throw new Error(
        "Expected HTTP 201, received " +
          response.status +
          ": " +
          await response.text(),
      );
    }

    const result =
      await response.json() as {
        category: string;
        documentType: string;
        identification: {
          verifiedMediaType:
            string;
          classificationConflict:
            boolean;
          confidence: number;
          method: string;
        };
      };

    assert.equal(
      result.category,
      "risk_claims_procurement",
    );
    assert.equal(
      result.documentType,
      "risk_register",
    );
    assert.equal(
      result.identification
        .verifiedMediaType,
      "text/csv",
    );
    assert.equal(
      result.identification
        .classificationConflict,
      true,
    );
    assert.ok(
      result.identification
        .confidence >= 0.62,
    );
    assert.equal(
      result.identification
        .method,
      "tabular_content",
    );
  });
});

test("a document uploaded as Other is identified from its content", async () => {
  await withServer(async (base) => {
    const project =
      "OTHER-AUTO-ID-UAT";
    const body = [
      "CONTRACT AGREEMENT",
      "FIDIC Conditions of Contract for Construction.",
      "Accepted Contract Amount SAR 100000000 excluding VAT.",
      "The Time for Completion is 900 days.",
      "Liquidated damages apply for delay.",
    ].join("\n");

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
              "application/octet-stream",
            "x-source-filename":
              "upload_00931.dat",
            "x-source-relative-path":
              "Other/upload_00931.dat",
            "x-evidence-category":
              "other",
          },
          body,
        },
      );

    if (response.status !== 201) {
      throw new Error(
        "Expected HTTP 201, received " +
          response.status +
          ": " +
          await response.text(),
      );
    }

    const result =
      await response.json() as {
        category: string;
        documentType: string;
        parserState: string;
        identification: {
          verifiedMediaType:
            string;
          confidence: number;
          detectedTitle:
            string | null;
          signals: string[];
        };
      };

    assert.equal(
      result.category,
      "contract",
    );
    assert.equal(
      result.documentType,
      "main_contract",
    );
    assert.equal(
      result.identification
        .verifiedMediaType,
      "text/plain",
    );
    assert.ok(
      result.identification
        .confidence >= 0.7,
    );
    assert.match(
      result.identification
        .detectedTitle ?? "",
      /contract agreement/i,
    );
    assert.ok(
      result.identification
        .signals.length >= 2,
    );
    assert.ok(
      [
        "identified",
        "parsed",
      ].includes(
        result.parserState,
      ),
    );
  });
});

test("Primavera content is recognized even when the file is named as a PDF", async () => {
  await withServer(async (base) => {
    const project =
      "RENAMED-XER-UAT";
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
              "application/pdf",
            "x-source-filename":
              "unknown_document.pdf",
            "x-source-relative-path":
              "Other/unknown_document.pdf",
            "x-evidence-category":
              "other",
            "x-schedule-role":
              "update",
          },
          body: xer(
            project,
            "2026-11-30",
            "2026-12-15",
          ),
        },
      );

    if (response.status !== 201) {
      throw new Error(
        "Expected HTTP 201, received " +
          response.status +
          ": " +
          await response.text(),
      );
    }

    const result =
      await response.json() as {
        category: string;
        scheduleRole: string | null;
        identification: {
          verifiedMediaType:
            string;
          confidence: number;
        };
      };

    assert.equal(
      result.category,
      "schedule",
    );
    assert.equal(
      result.scheduleRole,
      "update",
    );
    assert.equal(
      result.identification
        .verifiedMediaType,
      "text/x-primavera-xer",
    );
    assert.ok(
      result.identification
        .confidence >= 0.99,
    );
  });
});


test("ZIP routing identifies a renamed schedule before mapping unrelated filenames", async () => {
  await withServer(async (base) => {
    const project =
      "ZIP-CONTENT-FIRST-UAT";
    const zip = new JSZip();

    zip.file(
      "AAA/not_a_contract.pdf",
      [
        "Package ID,Description,Required On Site,Forecast Delivery,Status,Long Lead,Linked Activity,Vendor",
        "PKG-001,Rail package,2026-12-16,2026-12-15,Awarded,No,A200,Vendor 01",
      ].join("\n"),
    );
    zip.file(
      "ZZZ/random_binary.dat",
      xer(
        project,
        "2026-11-30",
        "2026-12-15",
      ),
    );

    const bytes =
      await zip.generateAsync({
        type: "uint8array",
      });
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
              "application/zip",
            "x-source-filename":
              "misnamed-pack.zip",
          },
          body:
            Buffer.from(bytes),
        },
      );

    if (response.status !== 201) {
      throw new Error(
        "Expected HTTP 201, received " +
          response.status +
          ": " +
          await response.text(),
      );
    }

    const result =
      await response.json() as {
        documents: Array<{
          category: string;
          sourceFilename: string;
          mapping: {
            mappedActivityCount:
              number | null;
          } | null;
          identification: {
            verifiedMediaType:
              string;
          };
        }>;
      };

    const schedule =
      result.documents.find(
        (document) =>
          document.category ===
          "schedule",
      );
    const procurement =
      result.documents.find(
        (document) =>
          document.category ===
          "risk_claims_procurement",
      );

    assert.ok(schedule);
    assert.equal(
      schedule
        .identification
        .verifiedMediaType,
      "text/x-primavera-xer",
    );
    assert.ok(procurement);
    assert.equal(
      procurement
        .mapping
        ?.mappedActivityCount,
      1,
    );
  });
});


test("BOQ full replacement is retained beside the original and never silently overwrites the established basis", async () => {
  await withServer(async (base) => {
    const project =
      "BOQ-LINEAGE-UAT";

    const original = [
      "Item No,Section,Description,Unit,Quantity,Rate SAR,Amount SAR",
      "1.0001,Civil,Excavation,m3,100,50,5000",
    ].join("\n");
    const revised = [
      "Item No,Section,Description,Unit,Quantity,Rate SAR,Amount SAR",
      "1.0001,Civil,Revised BOQ supersedes original bill of quantities - Excavation,m3,100,60,6000",
    ].join("\n");

    for (const [name, body] of [
      ["original.csv", original],
      ["revised.csv", revised],
    ] as const) {
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
                "text/csv",
              "x-source-filename":
                name,
              "x-evidence-category":
                "boq_cost",
              "x-document-type":
                "boq",
            },
            body,
          },
        );
      if (response.status !== 201) {
        throw new Error(
          "Expected HTTP 201, received " +
            response.status +
            ": " +
            await response.text(),
        );
      }
    }

    const state =
      runtimeProjects.get(project);
    assert.ok(state);
    assert.equal(
      state.boqRevisions.length,
      2,
    );
    assert.equal(
      state.boq
        ?.canonicalItems[0]
        ?.amount,
      5000,
    );

    const library =
      await (
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/documents",
        )
      ).json() as {
        documents: Array<{
          sourceFilename: string;
          documentId: string;
          lineage: {
            effect: string;
            predecessorDocumentIds:
              string[];
            replacesEntireBasis:
              boolean;
            appliesAsDelta:
              boolean;
          };
        }>;
      };

    const originalDoc =
      library.documents.find(
        (item) =>
          item.sourceFilename ===
          "original.csv",
      );
    const revisedDoc =
      library.documents.find(
        (item) =>
          item.sourceFilename ===
          "revised.csv",
      );

    assert.ok(originalDoc);
    assert.ok(revisedDoc);
    assert.equal(
      originalDoc.lineage.effect,
      "original",
    );
    assert.equal(
      revisedDoc.lineage.effect,
      "full_replacement",
    );
    assert.equal(
      revisedDoc.lineage
        .replacesEntireBasis,
      true,
    );
    assert.equal(
      revisedDoc.lineage
        .appliesAsDelta,
      false,
    );
    assert.ok(
      revisedDoc.lineage
        .predecessorDocumentIds
        .includes(
          originalDoc.documentId,
        ),
    );
  });
});

test("contract amendments remain deltas while an amended-and-restated contract is a full replacement candidate", async () => {
  await withServer(async (base) => {
    const project =
      "CONTRACT-LINEAGE-UAT";
    const uploads = [
      {
        name: "doc001.dat",
        text: [
          "CONTRACT AGREEMENT",
          "FIDIC Conditions of Contract for Construction",
          "Accepted Contract Amount SAR 100000000",
          "Time for Completion 900 days",
        ].join("\n"),
      },
      {
        name: "misc002.dat",
        text: [
          "CONTRACT AMENDMENT NO. 1",
          "Clause 8.7 is amended.",
          "The revised contract value is SAR 105000000.",
        ].join("\n"),
      },
      {
        name: "anything003.dat",
        text: [
          "AMENDED AND RESTATED CONTRACT AGREEMENT",
          "This restated agreement supersedes the previous contract.",
          "Accepted Contract Amount SAR 105000000.",
        ].join("\n"),
      },
    ];

    for (const upload of uploads) {
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
                "application/octet-stream",
              "x-source-filename":
                upload.name,
              "x-evidence-category":
                "other",
            },
            body:
              upload.text,
          },
        );
      if (response.status !== 201) {
        throw new Error(
          "Expected HTTP 201, received " +
            response.status +
            ": " +
            await response.text(),
        );
      }
    }

    const library =
      await (
        await fetch(
          base +
            "/api/projects/" +
            project +
            "/evidence/documents",
        )
      ).json() as {
        documents: Array<{
          sourceFilename: string;
          documentId: string;
          documentType: string;
          lineage: {
            effect: string;
            predecessorDocumentIds:
              string[];
            replacesEntireBasis:
              boolean;
            appliesAsDelta:
              boolean;
          };
        }>;
      };

    const original =
      library.documents.find(
        (item) =>
          item.sourceFilename ===
          "doc001.dat",
      );
    const amendment =
      library.documents.find(
        (item) =>
          item.sourceFilename ===
          "misc002.dat",
      );
    const replacement =
      library.documents.find(
        (item) =>
          item.sourceFilename ===
          "anything003.dat",
      );

    assert.ok(original);
    assert.ok(amendment);
    assert.ok(replacement);

    assert.equal(
      original.lineage.effect,
      "original",
    );
    assert.equal(
      amendment.documentType,
      "contract_amendment",
    );
    assert.equal(
      amendment.lineage.effect,
      "delta_amendment",
    );
    assert.equal(
      amendment.lineage
        .appliesAsDelta,
      true,
    );
    assert.equal(
      replacement.documentType,
      "contract_replacement",
    );
    assert.equal(
      replacement.lineage.effect,
      "full_replacement",
    );
    assert.equal(
      replacement.lineage
        .replacesEntireBasis,
      true,
    );
    assert.ok(
      replacement.lineage
        .predecessorDocumentIds
        .includes(
          original.documentId,
        ),
    );
    assert.ok(
      replacement.lineage
        .predecessorDocumentIds
        .includes(
          amendment.documentId,
        ),
    );
  });
});


test("variation order is preserved as a delta against the existing commercial basis", async () => {
  await withServer(async (base) => {
    const project =
      "VO-LINEAGE-UAT";

    const original = [
      "Item No,Section,Description,Unit,Quantity,Rate SAR,Amount SAR",
      "1.0001,Civil,Excavation,m3,100,50,5000",
    ].join("\n");

    const originalResponse =
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
              "original_boq.csv",
          },
          body: original,
        },
      );
    assert.equal(
      originalResponse.status,
      201,
    );

    const vo = [
      "VARIATION ORDER",
      "VO No. VO-014",
      "Variation amount SAR 750000",
      "Additional quantities for station civil works.",
    ].join("\n");

    const voResponse =
      await fetch(
        base +
          "/api/projects/" +
          project +
          "/evidence/uploads",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/octet-stream",
            "x-source-filename":
              "random_file.bin",
            "x-evidence-category":
              "other",
          },
          body: vo,
        },
      );

    if (voResponse.status !== 201) {
      throw new Error(
        await voResponse.text(),
      );
    }

    const result =
      await voResponse.json() as {
        category: string;
        documentType: string;
        lineage: {
          effect: string;
          appliesAsDelta: boolean;
          replacesEntireBasis: boolean;
          predecessorDocumentIds:
            string[];
        };
      };

    assert.equal(
      result.category,
      "boq_cost",
    );
    assert.equal(
      result.documentType,
      "variation_order",
    );
    assert.equal(
      result.lineage.effect,
      "variation_order",
    );
    assert.equal(
      result.lineage.appliesAsDelta,
      true,
    );
    assert.equal(
      result.lineage
        .replacesEntireBasis,
      false,
    );
    assert.equal(
      result.lineage
        .predecessorDocumentIds
        .length,
      1,
    );

    const state =
      runtimeProjects.get(project);
    assert.equal(
      state?.boqRevisions.length,
      1,
    );
    assert.equal(
      state?.boq
        ?.canonicalItems[0]
        ?.amount,
      5000,
    );
  });
});
