import {naturalCompare} from '../../shared/src/natural-order';
import type {
  ContractDocumentResult,
  ContractFamilyResult,
  ContractLogicalClauseGroup,
} from "./types";

function normalizeHeading(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function groupLogicalClauses(
  document: ContractDocumentResult,
): ContractLogicalClauseGroup[] {
  const groups = new Map<
    string,
    {
      sectionKeys: string[];
      contextKeys: Set<string>;
      headings: Set<string>;
    }
  >();

  for (const clause of document.clauses) {
    if (!clause.identifier) continue;

    const group = groups.get(clause.identifier) ?? {
      sectionKeys: [],
      contextKeys: new Set<string>(),
      headings: new Set<string>(),
    };

    group.sectionKeys.push(clause.sectionKey);
    group.contextKeys.add(clause.contextKey);

    const heading = normalizeHeading(clause.heading);
    if (heading) group.headings.add(heading);

    groups.set(clause.identifier, group);
  }

  return [...groups.entries()]
    .map(([identifier, group]) => ({
      identifier,
      sectionKeys: [...group.sectionKeys],
      contextKeys: [...group.contextKeys].sort(),
      headings: [...group.headings].sort(),
      consistentHeading: group.headings.size <= 1,
    }))
    .sort((a, b) =>
      naturalCompare(a.identifier, b.identifier),
    );
}

export function linkContractFamily(
  base: ContractDocumentResult,
  amendments: readonly ContractDocumentResult[],
): ContractFamilyResult {
  const diagnostics: string[] = [];
  const logicalClauses = groupLogicalClauses(base);
  const byIdentifier = new Map(
    logicalClauses.map((group) => [
      group.identifier,
      group,
    ]),
  );

  const amendmentLinks = amendments.flatMap((amendment) =>
    amendment.amendmentActions.map((action) => {
      const target = byIdentifier.get(
        action.targetIdentifier,
      );

      if (!target) {
        return {
          amendmentSectionKey: action.fromSectionKey,
          targetIdentifier: action.targetIdentifier,
          action: action.action,
          baseSectionKeys: [],
          status: "unresolved" as const,
        };
      }

      if (!target.consistentHeading) {
        diagnostics.push(
          "CONTRACT_LOGICAL_CLAUSE_HEADING_CONFLICT:" +
            target.identifier,
        );
      }

      return {
        amendmentSectionKey: action.fromSectionKey,
        targetIdentifier: action.targetIdentifier,
        action: action.action,
        baseSectionKeys: [...target.sectionKeys],
        status: "resolved" as const,
      };
    }),
  );

  const unresolvedAmendmentTargets = [
    ...new Set(
      amendmentLinks
        .filter((link) => link.status === "unresolved")
        .map((link) => link.targetIdentifier),
    ),
  ].sort();

  for (const identifier of unresolvedAmendmentTargets) {
    diagnostics.push(
      "CONTRACT_AMENDMENT_TARGET_UNRESOLVED:" +
        identifier,
    );
  }

  const complete =
    base.complete &&
    amendments.every((amendment) => amendment.complete) &&
    unresolvedAmendmentTargets.length === 0 &&
    diagnostics.length === 0;

  return {
    base,
    amendments: [...amendments],
    logicalClauses,
    amendmentLinks,
    unresolvedAmendmentTargets,
    complete,
    diagnostics,
  };
}
