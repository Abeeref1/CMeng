import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import JSZip from "jszip";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";

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
