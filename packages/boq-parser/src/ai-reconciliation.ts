import type { BoqColumnRole } from "./types";

export interface BoqAiHeaderProposal {
  sheet: string;
  headerRow: number;
  mapping: Record<number, BoqColumnRole>;
  confidence: number;
  explanation: string;
}

export interface BoqAiAssessment {
  accepted: boolean;
  authoritative: false;
  reasons: string[];
}

export function assessBoqAiHeaderProposal(
  proposal: BoqAiHeaderProposal,
): BoqAiAssessment {
  const reasons: string[] = [];

  if (!proposal.sheet.trim()) reasons.push("Sheet identity is required.");
  if (!Number.isSafeInteger(proposal.headerRow) || proposal.headerRow < 1) {
    reasons.push("Header row must be a positive integer.");
  }
  if (!Number.isFinite(proposal.confidence) || proposal.confidence < 0 || proposal.confidence > 1) {
    reasons.push("Confidence must be between 0 and 1.");
  }

  const roles = new Set(Object.values(proposal.mapping));
  if (!roles.has("description")) reasons.push("Description mapping is required.");
  if (![...roles].some((role) => role === "quantity" || role === "rate" || role === "amount")) {
    reasons.push("At least one commercial field mapping is required.");
  }

  return {
    accepted: reasons.length === 0,
    authoritative: false,
    reasons:
      reasons.length > 0
        ? reasons
        : [
            "AI mapping is advisory only. Source cells, data types, numeric conventions and row arithmetic must be deterministically validated before publication.",
          ],
  };
}
