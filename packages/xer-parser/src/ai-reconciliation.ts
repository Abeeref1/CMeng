import type { XerRow } from "./types";

export interface XerAiRepairProposal {
  table: string;
  line: number;
  reconstructedValues: string[];
  explanation: string;
  confidence: number;
}

export interface XerAiRepairAssessment {
  accepted: boolean;
  status: "rejected" | "suggested" | "deterministically_confirmed";
  reasons: string[];
}

export function assessAiRowRepair(
  row: XerRow,
  proposal: XerAiRepairProposal,
): XerAiRepairAssessment {
  const reasons: string[] = [];

  if (row.status !== "unresolved") {
    reasons.push("Only unresolved rows may be repaired.");
  }
  if (proposal.table !== row.table || proposal.line !== row.line) {
    reasons.push("Proposal source identity does not match the unresolved row.");
  }
  if (proposal.reconstructedValues.length !== row.fields.length) {
    reasons.push(
      "Proposed value count does not equal the source schema field count.",
    );
  }
  if (
    !Number.isFinite(proposal.confidence) ||
    proposal.confidence < 0 ||
    proposal.confidence > 1
  ) {
    reasons.push("AI confidence must be between 0 and 1.");
  }

  if (reasons.length > 0) {
    return { accepted: false, status: "rejected", reasons };
  }

  /*
   * AI is advisory here. A syntactically plausible reconstruction is not
   * authoritative by itself. A downstream deterministic rule must prove the
   * reconstruction (for example by uniquely reconciling field types, IDs,
   * arithmetic, and cross references) before CMeng can upgrade it from a
   * suggestion to a verified parsed row.
   */
  return {
    accepted: true,
    status: "suggested",
    reasons: [
      "Proposal is structurally admissible but remains non-authoritative until deterministic confirmation.",
    ],
  };
}
