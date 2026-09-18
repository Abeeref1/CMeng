import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  ContractDocumentResult,
  ContractSection,
} from "../../contract-parser/src";
import type {
  ContractLdTerms,
  LdCapCandidate,
  LdRateCandidate,
} from "./types";

function refs(
  section: ContractSection,
): string[] {
  return section.sourceSpans.map(
    (span) =>
      [
        span.sourceKind,
        span.sourceIndex,
        span.start,
        span.end,
      ].join(":"),
  );
}

function cleanNumber(
  value: string,
): number | null {
  const number = Number(
    value.replace(/,/g, ""),
  );
  return Number.isFinite(number)
    ? number
    : null;
}

function snippet(
  text: string,
  index: number,
  length: number,
): string {
  return text
    .slice(
      Math.max(0, index - 120),
      Math.min(
        text.length,
        index + length + 180,
      ),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function currency(
  value: string,
): string {
  return value.toUpperCase();
}

function rateCandidates(
  section: ContractSection,
): LdRateCandidate[] {
  const text = [
    section.heading ?? "",
    section.text,
  ].join("\n");
  const sourceRefs = refs(section);
  const out: LdRateCandidate[] = [];

  const fixedPatterns = [
    /\b([A-Z]{3})\s*([\d,]+(?:\.\d+)?)\s*(?:per|\/)\s*(calendar\s+day|day|week)\b/gi,
    /\b([\d,]+(?:\.\d+)?)\s*([A-Z]{3})\s*(?:per|\/)\s*(calendar\s+day|day|week)\b/gi,
  ];

  for (let patternIndex = 0; patternIndex < fixedPatterns.length; patternIndex += 1) {
    const regex = fixedPatterns[patternIndex]!;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const currencyCode =
        patternIndex === 0
          ? match[1]!
          : match[2]!;
      const amountText =
        patternIndex === 0
          ? match[2]!
          : match[1]!;
      const unit = match[3]!.toLowerCase();
      const amount = cleanNumber(amountText);
      if (amount === null) continue;
      const basis =
        unit.includes("week")
          ? "fixed_amount_per_week" as const
          : "fixed_amount_per_day" as const;
      out.push({
        candidateId:
          "ld-rate-" +
          stableFingerprint({
            sectionKey: section.sectionKey,
            match: match[0],
            offset: match.index,
          }).slice(0, 20),
        basis,
        amount,
        currency: currency(currencyCode),
        percent: null,
        sourceRefs: [...sourceRefs],
        textSnippet: snippet(
          text,
          match.index,
          match[0].length,
        ),
      });
    }
  }

  const percentRegex =
    /\b(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:the\s+)?(?:accepted\s+contract\s+amount|contract\s+amount|contract\s+price))?\s*(?:per|\/)\s*(calendar\s+day|day|week)\b/gi;
  let percentMatch: RegExpExecArray | null;
  while (
    (percentMatch =
      percentRegex.exec(text)) !== null
  ) {
    const percent =
      Number(percentMatch[1]);
    if (
      !Number.isFinite(percent) ||
      percent < 0
    ) {
      continue;
    }
    const unit =
      percentMatch[2]!.toLowerCase();
    out.push({
      candidateId:
        "ld-rate-" +
        stableFingerprint({
          sectionKey: section.sectionKey,
          match: percentMatch[0],
          offset: percentMatch.index,
        }).slice(0, 20),
      basis:
        unit.includes("week")
          ? "percent_contract_amount_per_week"
          : "percent_contract_amount_per_day",
      amount: null,
      currency: null,
      percent,
      sourceRefs: [...sourceRefs],
      textSnippet: snippet(
        text,
        percentMatch.index,
        percentMatch[0].length,
      ),
    });
  }

  return out;
}

function capCandidates(
  section: ContractSection,
): LdCapCandidate[] {
  const text = [
    section.heading ?? "",
    section.text,
  ].join("\n");
  const sourceRefs = refs(section);
  const out: LdCapCandidate[] = [];

  const percentRegex =
    /(?:cap(?:ped)?\s+(?:at|to)|shall\s+not\s+exceed|maximum(?:\s+aggregate)?(?:\s+liability)?(?:\s+of)?)\s*(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:the\s+)?(?:accepted\s+contract\s+amount|contract\s+amount|contract\s+price))?/gi;
  let match: RegExpExecArray | null;
  while ((match = percentRegex.exec(text)) !== null) {
    const percent = Number(match[1]);
    if (!Number.isFinite(percent)) continue;
    out.push({
      candidateId:
        "ld-cap-" +
        stableFingerprint({
          sectionKey: section.sectionKey,
          match: match[0],
          offset: match.index,
        }).slice(0, 20),
      basis:
        "percent_contract_amount",
      amount: null,
      currency: null,
      percent,
      sourceRefs: [...sourceRefs],
      textSnippet: snippet(
        text,
        match.index,
        match[0].length,
      ),
    });
  }

  const fixedPatterns = [
    /(?:cap(?:ped)?\s+(?:at|to)|shall\s+not\s+exceed|maximum(?:\s+aggregate)?(?:\s+liability)?(?:\s+of)?)\s*([A-Z]{3})\s*([\d,]+(?:\.\d+)?)/gi,
    /(?:cap(?:ped)?\s+(?:at|to)|shall\s+not\s+exceed|maximum(?:\s+aggregate)?(?:\s+liability)?(?:\s+of)?)\s*([\d,]+(?:\.\d+)?)\s*([A-Z]{3})/gi,
  ];

  for (let index = 0; index < fixedPatterns.length; index += 1) {
    const regex = fixedPatterns[index]!;
    let fixed: RegExpExecArray | null;
    while ((fixed = regex.exec(text)) !== null) {
      const currencyCode =
        index === 0
          ? fixed[1]!
          : fixed[2]!;
      const amountText =
        index === 0
          ? fixed[2]!
          : fixed[1]!;
      const amount = cleanNumber(amountText);
      if (amount === null) continue;
      out.push({
        candidateId:
          "ld-cap-" +
          stableFingerprint({
            sectionKey: section.sectionKey,
            match: fixed[0],
            offset: fixed.index,
          }).slice(0, 20),
        basis: "fixed_amount",
        amount,
        currency:
          currency(currencyCode),
        percent: null,
        sourceRefs: [...sourceRefs],
        textSnippet: snippet(
          text,
          fixed.index,
          fixed[0].length,
        ),
      });
    }
  }

  return out;
}

function uniqueRates(
  values: readonly LdRateCandidate[],
): LdRateCandidate[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = [
      value.basis,
      value.amount,
      value.currency,
      value.percent,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueCaps(
  values: readonly LdCapCandidate[],
): LdCapCandidate[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = [
      value.basis,
      value.amount,
      value.currency,
      value.percent,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractContractLdTerms(
  contract: ContractDocumentResult,
): ContractLdTerms {
  const eligible =
    contract.sections.filter(
      (section) =>
        /liquidated\s+damages|delay\s+damages|damages\s+for\s+delay/i.test(
          [
            section.heading ?? "",
            section.text,
          ].join(" "),
        ),
    );

  const rates = uniqueRates(
    eligible.flatMap(rateCandidates),
  );
  const caps = uniqueCaps(
    eligible.flatMap(capCandidates),
  );

  const rateState =
    rates.length === 0
      ? "missing"
      : rates.length === 1
        ? "candidate"
        : "conflicted";
  const capState =
    caps.length === 0
      ? "missing"
      : caps.length === 1
        ? "candidate"
        : "conflicted";

  return {
    rateState,
    capState,
    rate:
      rateState === "candidate"
        ? rates[0]!
        : null,
    cap:
      capState === "candidate"
        ? caps[0]!
        : null,
    rateCandidates: rates,
    capCandidates: caps,
    diagnostics: [
      ...(contract.semanticComplete
        ? []
        : [
            "LD_EXTRACTION_FROM_PARTIAL_CONTRACT_SEMANTICS",
          ]),
      ...(rateState === "conflicted"
        ? ["LD_RATE_CONFLICT_REQUIRES_REVIEW"]
        : []),
      ...(capState === "conflicted"
        ? ["LD_CAP_CONFLICT_REQUIRES_REVIEW"]
        : []),
      "LD_TERMS_ARE_EXTRACTION_CANDIDATES_UNTIL_GOVERNED_PROMOTION",
    ],
  };
}
