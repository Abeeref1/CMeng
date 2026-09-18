import test from "node:test";
import assert from "node:assert/strict";

import type {
  ContractDocumentResult,
  ContractSection,
} from "../packages/contract-parser/src";
import {
  extractContractLdTerms,
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
