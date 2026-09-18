import type {
  AuthorityReceipt,
  FactCandidate,
  FactState,
  GovernedFact,
  PromotionResult,
} from "./types";

export function missingFact<T>(
  projectId: string,
  factKey: string,
  now: string,
): GovernedFact<T> {
  return {
    projectId,
    factKey,
    state: "missing",
    value: null,
    officialCandidateId: null,
    candidateIds: [],
    authorityReceipt: null,
    updatedAt: now,
  };
}

export function attachCandidate<T>(
  fact: GovernedFact<T>,
  candidate: FactCandidate<T>,
  now: string,
): GovernedFact<T> {
  if (
    candidate.projectId !== fact.projectId ||
    candidate.factKey !== fact.factKey
  ) {
    throw new Error(
      "Candidate does not belong to the governed fact",
    );
  }

  const candidateIds = fact.candidateIds.includes(
    candidate.candidateId,
  )
    ? [...fact.candidateIds]
    : [...fact.candidateIds, candidate.candidateId];

  const nextState: FactState =
    fact.state === "official"
      ? "official"
      : candidateIds.length === 1
        ? "provisional"
        : "conflicted";

  return {
    ...fact,
    state: nextState,
    candidateIds,
    updatedAt: now,
  };
}

export function promoteCandidate<T>(
  fact: GovernedFact<T>,
  candidate: FactCandidate<T>,
  authority: AuthorityReceipt | null,
  now: string,
): PromotionResult<T> {
  if (!authority) {
    return {
      fact,
      promoted: false,
      reason:
        "Official promotion requires an authority receipt.",
    };
  }

  if (!fact.candidateIds.includes(candidate.candidateId)) {
    throw new Error(
      "Candidate must be attached before promotion",
    );
  }

  return {
    promoted: true,
    reason: null,
    fact: {
      ...fact,
      state: "official",
      value: candidate.value,
      officialCandidateId: candidate.candidateId,
      authorityReceipt: authority,
      updatedAt: now,
    },
  };
}

export function numericFactValue(
  fact: GovernedFact<number>,
): number | null {
  // Missing/pending/partial/conflicted/provisional are not zero.
  return fact.state === "official"
    ? fact.value
    : null;
}
