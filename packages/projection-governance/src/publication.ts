import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  DependencyReceipt,
  GovernedPublication,
  PublicationValidation,
} from "./types";

export function createDependencyReceipt(input: Omit<
  DependencyReceipt,
  "dependencyReceiptId"
>): DependencyReceipt {
  return {
    ...input,
    dependencyReceiptId:
      "dep_" +
      stableFingerprint(input).slice(0, 24),
    upstreamProjectionHashes: {
      ...input.upstreamProjectionHashes,
    },
  };
}

export function validatePublication(
  publication: GovernedPublication,
  current: {
    projectId: string;
    analysisRunId: string;
    evidenceRevisionId: string;
    evidenceFingerprint: string;
    producerVersion: string;
    parserVersion: string;
    mappingVersion: string;
  },
): PublicationValidation {
  const reasons: string[] = [];
  const receipt = publication.dependencyReceipt;

  if (publication.projectId !== current.projectId) {
    reasons.push("PROJECT_ID_MISMATCH");
  }
  if (publication.analysisRunId !== current.analysisRunId) {
    reasons.push("ANALYSIS_RUN_MISMATCH");
  }
  if (
    publication.evidenceRevisionId !==
    current.evidenceRevisionId
  ) {
    reasons.push("EVIDENCE_REVISION_MISMATCH");
  }
  if (
    receipt.evidenceFingerprint !==
    current.evidenceFingerprint
  ) {
    reasons.push("EVIDENCE_FINGERPRINT_STALE");
  }
  if (
    receipt.producerVersion !==
    current.producerVersion
  ) {
    reasons.push("PRODUCER_VERSION_STALE");
  }
  if (
    receipt.parserVersion !==
    current.parserVersion
  ) {
    reasons.push("PARSER_VERSION_STALE");
  }
  if (
    receipt.mappingVersion !==
    current.mappingVersion
  ) {
    reasons.push("MAPPING_VERSION_STALE");
  }
  if (
    receipt.analysisRunId !==
      publication.analysisRunId ||
    receipt.evidenceRevisionId !==
      publication.evidenceRevisionId ||
    receipt.projectionKey !==
      publication.projectionKey
  ) {
    reasons.push("DEPENDENCY_RECEIPT_SCOPE_MISMATCH");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
