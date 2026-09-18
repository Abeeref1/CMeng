import {
  createHash,
} from "node:crypto";

import {
  createSourceManifest,
  evidenceReceiptFromUpload,
} from "../../governance-model/src";
import {
  canonicalScheduleFromXer,
} from "../../schedule-analysis-core/src";
import {
  canonicalResourcesFromXer,
} from "../../schedule-resource-core/src";
import {
  parseXerBytes,
} from "../../xer-parser/src";
import type {
  ScheduleIngestionInput,
  ScheduleIngestionResult,
} from "./types";

function sha256(
  bytes: Uint8Array,
): string {
  return createHash("sha256")
    .update(bytes)
    .digest("hex");
}

function stableId(
  prefix: string,
  value: string,
): string {
  return (
    prefix +
    "_" +
    createHash("sha256")
      .update(value)
      .digest("hex")
      .slice(0, 24)
  );
}

function looksLikeXer(
  bytes: Uint8Array,
): boolean {
  const preview = Buffer.from(
    bytes.slice(0, 32_768),
  ).toString("utf8");
  return (
    /(^|\n)ERMHDR\t/i.test(preview) ||
    /(^|\n)%T\tPROJECT(?:\n|\r|$)/m.test(
      preview,
    )
  );
}

export function supportsXerMediaType(
  mediaType: string,
): boolean {
  const normalized =
    mediaType
      .split(";")[0]!
      .trim()
      .toLowerCase();

  return (
    normalized === "" ||
    normalized === "text/plain" ||
    normalized ===
      "application/octet-stream" ||
    normalized ===
      "application/x-primavera-xer" ||
    normalized ===
      "application/x-xer"
  );
}

export async function ingestScheduleXer(
  input: ScheduleIngestionInput,
): Promise<ScheduleIngestionResult> {
  if (!input.projectId.trim()) {
    throw new Error(
      "SCHEDULE_PROJECT_ID_REQUIRED",
    );
  }
  if (input.bytes.length === 0) {
    throw new Error(
      "SCHEDULE_UPLOAD_EMPTY",
    );
  }
  if (
    !supportsXerMediaType(
      input.verifiedMediaType,
    ) ||
    !looksLikeXer(input.bytes)
  ) {
    throw new Error(
      "SCHEDULE_XER_MEDIA_OR_SIGNATURE_INVALID",
    );
  }

  const hash = sha256(input.bytes);
  const revisionId =
    input.revisionId?.trim() ||
    stableId("schedule-rev", hash);
  const documentId =
    input.documentId?.trim() ||
    stableId("schedule-doc", hash);
  const objectId =
    stableId("schedule-obj", hash);

  const parsed = parseXerBytes(
    Buffer.from(input.bytes),
  );

  const schedule =
    canonicalScheduleFromXer(
      parsed,
      {
        sourceRevisionId: revisionId,
      },
    );

  if (
    schedule.projectId !== null &&
    schedule.projectId !==
      input.projectId
  ) {
    throw new Error(
      "SCHEDULE_SOURCE_PROJECT_ID_MISMATCH:" +
        schedule.projectId +
        ":" +
        input.projectId,
    );
  }

  // Project context is governed by the upload route.
  schedule.projectId = input.projectId;

  const resources =
    canonicalResourcesFromXer(
      parsed,
      {
        sourceRevisionId: revisionId,
        projectId: input.projectId,
      },
    );

  const sourceManifest =
    createSourceManifest(
      input.projectId,
      [{
        documentId,
        revisionId,
        objectId,
        sha256: hash,
        role: "schedule",
      }],
      input.receivedAt,
    );

  const evidenceReceipt =
    evidenceReceiptFromUpload(
      {
        projectId: input.projectId,
        documentId,
        revisionId,
        objectId,
        sha256: hash,
        role: "schedule",
        receivedAt:
          input.receivedAt,
      },
      sourceManifest,
    );

  const sequence =
    input.revisionSequence ??
    1;

  if (
    !Number.isSafeInteger(sequence) ||
    sequence <= 0
  ) {
    throw new Error(
      "SCHEDULE_REVISION_SEQUENCE_INVALID",
    );
  }

  const revision = {
    revisionId,
    label:
      input.revisionLabel?.trim() ||
      revisionId,
    sequence,
    effectiveAt:
      input.effectiveAt?.trim() ||
      schedule.dataDateIso ||
      input.receivedAt,
    model: schedule,
  };

  return {
    ingestionId: stableId(
      "schedule-ingest",
      input.projectId +
        "|" +
        hash +
        "|" +
        revisionId,
    ),
    projectId: input.projectId,
    sourceFormat: "xer",
    mediaType:
      input.verifiedMediaType,
    sourceFilename:
      input.sourceFilename?.trim() ||
      null,
    sourceHashSha256: hash,
    sourceManifest,
    evidenceReceipt,
    authority: "candidate_only",
    persistence: "runtime_local",
    revision,
    schedule,
    resources,
    diagnostics: [
      ...parsed.diagnostics,
      ...schedule.diagnostics,
      ...resources.diagnostics,
      "SCHEDULE_UPLOAD_IS_CANDIDATE_UNTIL_GOVERNED_PROMOTION",
    ],
  };
}
