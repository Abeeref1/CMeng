import test from "node:test";
import assert from "node:assert/strict";

import type {
  ContractDocumentResult,
  ContractSection,
} from "../packages/contract-parser/src";
import {
  extractContractLdTerms,
  extractContractValue,
} from "../packages/contract-commercial/src";

function contractWith(
  text: string,
): ContractDocumentResult {
  const section: ContractSection = {
    sectionKey: "ld",
    kind: "clause",
    identifier: "8.7",
    contextKey: "contract",
    parentIdentifier: null,
    instanceOrdinal: 1,
    heading: "Delay Damages",
    text,
    startPage: 20,
    endPage: 20,
    startBlock: null,
    endBlock: null,
    sourceSpans: [{
      sourceKind: "pdf_page",
      sourceIndex: 20,
      page: 20,
      block: null,
      start: 0,
      end: text.length,
      text,
    }],
    sourceMode: "deterministic",
    status: "verified",
    diagnostics: [],
  };

  return {
    sourceType: "pdf",
    pdf: null,
    docx: null,
    sections: [section],
    clauses: [section],
    appendices: [],
    duplicateIdentifiers: [],
    repeatedRawIdentifiers: [],
    references: [],
    amendmentActions: [],
    ignoredSpans: [],
    unclassifiedLines: [],
    semanticCoveragePercent: 100,
    physicalComplete: true,
    semanticComplete: true,
    complete: true,
    diagnostics: [],
  };
}

test("LD extraction is currency-agnostic and preserves rate and cap separately", () => {
  const result = extractContractLdTerms(
    contractWith(
      "Delay damages are AED 25,000 per calendar day and shall not exceed 10% of the Contract Amount.",
    ),
  );

  assert.equal(
    result.rateState,
    "candidate",
  );
  assert.equal(
    result.rate?.currency,
    "AED",
  );
  assert.equal(
    result.rate?.amount,
    25000,
  );
  assert.equal(
    result.rate?.basis,
    "fixed_amount_per_day",
  );
  assert.equal(
    result.capState,
    "candidate",
  );
  assert.equal(
    result.cap?.percent,
    10,
  );
});

test("ordinary tender LD prose cannot become a zero THE contract value", () => {
  const result = extractContractValue(contractWith(
    "Once the total sum of liquidated damages reaches ten percent (10%) of the total contract price, the Procuring Entity may rescind or terminate the contract, without prejudice to other courses of action and remedies available under the circumstances.",
  ));
  assert.equal(result.state, "missing");
  assert.equal(result.candidates.length, 0);
});

test("monetary extraction rejects punctuation amounts and prose currencies", () => {
  for (const text of [
    "Contract Price PHP ,", "Contract Price PHP 1,,000",
    "Contract Price 123 THE", "Contract Price THE 123",
  ]) {
    assert.equal(extractContractValue(contractWith(text)).state, "missing", text);
  }
  const ld = extractContractLdTerms(contractWith(
    "Delay damages are the 5 per day and shall not exceed the 10. Alternatively USD , per day capped at PHP ,.",
  ));
  assert.equal(ld.rateCandidates.length, 0);
  assert.equal(ld.capCandidates.length, 0);
});

test("explicit monetary zeros and valid currencies remain source candidates", () => {
  for (const [text, amount, currency] of [
    ["Accepted Contract Amount PHP 0", 0, "PHP"],
    ["Contract Price aed 1,234.50", 1234.5, "AED"],
    ["Original Contract Sum 25000 USD", 25000, "USD"],
  ] as const) {
    const result = extractContractValue(contractWith(text));
    assert.equal(result.state, "candidate", text);
    assert.equal(result.candidates[0]?.amount, amount, text);
    assert.equal(result.candidates[0]?.currency, currency, text);
  }
});

test("LD percentage-per-day rate is supported without inventing a currency", () => {
  const result = extractContractLdTerms(
    contractWith(
      "Delay damages shall be 0.1% of the Accepted Contract Amount per day capped at 7.5% of the Accepted Contract Amount.",
    ),
  );

  assert.equal(
    result.rateState,
    "candidate",
  );
  assert.equal(
    result.rate?.basis,
    "percent_contract_amount_per_day",
  );
  assert.equal(
    result.rate?.percent,
    0.1,
  );
  assert.equal(
    result.rate?.currency,
    null,
  );
  assert.equal(
    result.cap?.percent,
    7.5,
  );
});

test("sectional LD rates remain separate and an explicitly overall works rate governs project-completion exposure", () => {
  const contract=contractWith("placeholder");
  const section1={...contract.sections[0]!,sectionKey:"section-1",identifier:"Section 1",heading:"Section 1 — Delay Damages",text:"Delay damages are QAR 35,000 per calendar day."};
  const section2={...contract.sections[0]!,sectionKey:"section-2",identifier:"Section 2",heading:"Section 2 — Whole of the Works — Delay Damages",text:"Delay damages are QAR 60,000 per calendar day."};
  contract.sections=[section1,section2];
  contract.clauses=[section1,section2];
  const result=extractContractLdTerms(contract);
  assert.equal(result.rateCandidates.length,2);
  assert.equal(result.rateState,"candidate");
  assert.equal(result.rate?.amount,60000);
  assert.equal(result.rate?.currency,"QAR");
  assert.equal(result.rate?.sectionIdentifier,"Section 2");
  assert.ok(result.diagnostics.includes("LD_SECTIONAL_RATES_RETAINED:2"));
  assert.ok(result.diagnostics.includes("LD_OVERALL_WORKS_RATE_SELECTED_FROM_SECTIONAL_RATES"));
  assert.ok(!result.diagnostics.includes("LD_RATE_CONFLICT_REQUIRES_REVIEW"));
});

test("conflicting LD rates fail closed instead of selecting one", () => {
  const result = extractContractLdTerms(
    contractWith(
      "Delay damages are USD 10,000 per day. Alternatively delay damages are USD 15,000 per day. The cap is 10% of the Contract Amount.",
    ),
  );

  assert.equal(
    result.rateState,
    "conflicted",
  );
  assert.equal(
    result.rate,
    null,
  );
  assert.equal(
    result.rateCandidates.length,
    2,
  );
  assert.ok(
    result.diagnostics.includes(
      "LD_RATE_CONFLICT_REQUIRES_REVIEW",
    ),
  );
});
