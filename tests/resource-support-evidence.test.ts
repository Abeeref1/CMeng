import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import {
  tmpdir,
} from "node:os";
import {
  join,
} from "node:path";

import {
  weeklyResourceCapacityEvidence,
} from "../packages/runtime-api/src/resource-support-evidence";
import type {
  StoredEvidenceDocument,
} from "../packages/runtime-api/src/project-state-types";

test("weekly resource evidence withholds future-dated actual usage after the schedule data date", () => {
  const dir = mkdtempSync(
    join(tmpdir(), "cmeng-resource-evidence-"),
  );
  try {
    const path = join(
      dir,
      "RES01_resource_capacity.csv",
    );
    writeFileSync(
      path,
      [
        "resource id,resource name,week start,available capacity,planned demand,actual approved usage,unit",
        "R1,Team 1,2026-08-24,100,80,70,labor_hour",
        "R1,Team 1,2026-08-31,100,80,72,labor_hour",
        "R1,Team 1,2026-09-07,100,80,0,labor_hour",
        "R1,Team 1,2026-09-14,100,80,0,labor_hour",
      ].join("\n"),
      "utf8",
    );

    const document = {
      documentId: "res-1",
      category: "schedule",
      documentType: "resource_register",
      sourceFilename:
        "RES01_resource_capacity.csv",
      sourceRelativePath: null,
      mediaType: "text/csv",
      sourceHashSha256: "test",
      sizeBytes: 1,
      uploadedAt:
        "2026-09-22T00:00:00.000Z",
      authority: "candidate_only",
      parserState: "parsed",
      storedPath: path,
      linkedArtifactId: null,
      scheduleRole: null,
      mapping: null,
      identification: {},
      lineage: {},
      assertions: [],
      uploadIntent: "evidence",
      familyKey: "res",
      logicalDocumentKey: "res",
      basisState: "active",
      supersededByDocumentId: null,
      supersedesDocumentIds: [],
      diagnostics: [],
    } as unknown as StoredEvidenceDocument;

    const result =
      weeklyResourceCapacityEvidence(
        [document],
        {
          dataDateIso:
            "2026-08-31T00:00:00.000Z",
        },
      );

    const future =
      result.weeklyTotals.filter(
        (row) =>
          row.weekStartIso !== null &&
          row.weekStartIso >
            "2026-08-31T00:00:00.000Z",
      );
    assert.equal(future.length, 2);
    assert.ok(
      future.every(
        (row) =>
          row.actualApprovedUsage ===
          null,
      ),
    );
    assert.equal(
      result.actualUtilizationPercent,
      71,
    );
    assert.ok(
      result.diagnostics.some(
        (item) =>
          item ===
          "FUTURE_RESOURCE_ACTUAL_USAGE_WITHHELD_AFTER_DATA_DATE:2",
      ),
    );
  } finally {
    rmSync(dir, {
      recursive: true,
      force: true,
    });
  }
});
