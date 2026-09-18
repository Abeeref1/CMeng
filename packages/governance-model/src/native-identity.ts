import {
  stableFingerprint,
} from "../../analysis-runtime/src";

export interface NativeEntityIdentity {
  projectId: string;
  sourceRevisionId: string;
  entityType: string;
  nativeId: string;
}

export function nativeEntityIdentityKey(
  identity: NativeEntityIdentity,
): string {
  return stableFingerprint({
    projectId: identity.projectId,
    sourceRevisionId: identity.sourceRevisionId,
    entityType: identity.entityType,
    nativeId: identity.nativeId,
  });
}
