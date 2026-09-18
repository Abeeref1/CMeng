import { createHash } from "node:crypto";
import type {
  AnalysisInputSnapshot,
  AnalysisRunIdentity,
} from "./types";

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableFingerprint(
  value: unknown,
): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(normalize);
    }
    if (
      input !== null &&
      typeof input === "object"
    ) {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, normalize(item)]),
      );
    }
    return input;
  };

  return sha256(JSON.stringify(normalize(value)));
}

export function analysisInputFingerprint(
  snapshot: AnalysisInputSnapshot,
): string {
  return stableFingerprint({
    projectId: snapshot.projectId,
    evidenceRevisionId: snapshot.evidenceRevisionId,
    evidenceFingerprint: snapshot.evidenceFingerprint,
    mappingVersion: snapshot.mappingVersion,
    parserVersion: snapshot.parserVersion,
    analysisEngineVersion: snapshot.analysisEngineVersion,
    analysisPlanVersion: snapshot.analysisPlanVersion,
    projectConfigFingerprint:
      snapshot.projectConfigFingerprint,
  });
}

export function analysisRunIdentity(
  snapshot: AnalysisInputSnapshot,
): AnalysisRunIdentity {
  const inputFingerprint =
    analysisInputFingerprint(snapshot);

  return {
    runId:
      "run_" +
      inputFingerprint.slice(0, 24),
    inputFingerprint,
    projectId: snapshot.projectId,
    evidenceRevisionId: snapshot.evidenceRevisionId,
  };
}

export function artifactHash(
  payload: Uint8Array,
): string {
  return sha256(payload);
}
