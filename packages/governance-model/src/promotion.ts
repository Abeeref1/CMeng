import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  AuthorityReceipt,
  FactCandidate,
  GovernedFact,
  PromotionResult,
} from "./types";
import { promoteCandidate } from "./facts";

export interface PromotionCommand {
  projectId: string;
  factKey: string;
  candidateId: string;
  expectedEvidenceRevisionId: string;
  currentEvidenceRevisionId: string;
  actorId: string;
  requestId: string;
}

export interface PromotionCommandReceipt {
  requestFingerprint: string;
  accepted: boolean;
  reason: string | null;
}

export function promotionRequestFingerprint(
  command: PromotionCommand,
): string {
  return stableFingerprint({
    projectId: command.projectId,
    factKey: command.factKey,
    candidateId: command.candidateId,
    expectedEvidenceRevisionId:
      command.expectedEvidenceRevisionId,
    actorId: command.actorId,
    requestId: command.requestId,
  });
}

export function validatePromotionCommand(
  command: PromotionCommand,
): PromotionCommandReceipt {
  const requestFingerprint =
    promotionRequestFingerprint(command);

  if (
    command.expectedEvidenceRevisionId !==
    command.currentEvidenceRevisionId
  ) {
    return {
      requestFingerprint,
      accepted: false,
      reason:
        "STALE_EVIDENCE_REVISION",
    };
  }

  return {
    requestFingerprint,
    accepted: true,
    reason: null,
  };
}

export function executeGovernedPromotion<T>(input: {
  fact: GovernedFact<T>;
  candidate: FactCandidate<T>;
  authority: AuthorityReceipt | null;
  command: PromotionCommand;
  now: string;
}): {
  command: PromotionCommandReceipt;
  promotion: PromotionResult<T> | null;
} {
  const command =
    validatePromotionCommand(input.command);

  if (!command.accepted) {
    return {
      command,
      promotion: null,
    };
  }

  return {
    command,
    promotion: promoteCandidate(
      input.fact,
      input.candidate,
      input.authority,
      input.now,
    ),
  };
}
