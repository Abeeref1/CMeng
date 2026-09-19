import test from "node:test";
import assert from "node:assert/strict";

import type {
  ContractDocumentResult,
  ContractSection,
} from "../packages/contract-parser/src";
import {
  extractContractValue,
} from "../packages/contract-commercial/src";

function section(
  key: string,
  text: string,
): ContractSection {
  return {
    sectionKey: key,
    kind: "clause",
    identifier: key,
    contextKey: key,
    parentIdentifier: null,
    instanceOrdinal: 1,
    heading: "Contract Data",
    text,
    startPage: 1,
    endPage: 1,
    startBlock: null,
    endBlock: null,
    sourceSpans: [
      {
        sourceKind:
          "pdf_page",
        sourceIndex: 1,
        page: 1,
        block: null,
        start: 0,
        end: text.length,
        text,
      },
    ],
    sourceMode:
      "deterministic",
    status: "verified",
    diagnostics: [],
  };
}

function contract(
  sections: ContractSection[],
): ContractDocumentResult {
  return {
    sourceType: "pdf",
    pdf: null,
    docx: null,
    sections,
    clauses: sections,
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

test("contract value is extracted as a candidate before any manual fallback", () => {
  const result =
    extractContractValue(
      contract([
        section(
          "1",
          "Accepted Contract Amount: SAR 8,800,000,000.",
        ),
      ]),
    );

  assert.equal(
    result.state,
    "candidate",
  );
  assert.equal(
    result.value?.amount,
    8_800_000_000,
  );
  assert.equal(
    result.value?.currency,
    "SAR",
  );
  assert.equal(
    result.value?.kind,
    "accepted_contract_amount",
  );
  assert.ok(
    result.value
      ?.sourceRefs.length,
  );
  assert.ok(
    result.diagnostics.includes(
      "CONTRACT_VALUE_IS_A_CANDIDATE_UNTIL_GOVERNED_PROMOTION",
    ),
  );
});

test("conflicting contract values are exposed and never auto-promoted", () => {
  const result =
    extractContractValue(
      contract([
        section(
          "1",
          "Original Contract Sum: SAR 8,800,000,000.",
        ),
        section(
          "2",
          "Contract Price: SAR 9,300,000,000.",
        ),
      ]),
    );

  assert.equal(
    result.state,
    "conflicted",
  );
  assert.equal(
    result.value,
    null,
  );
  assert.equal(
    result.candidates.length,
    2,
  );
  assert.ok(
    result.diagnostics.includes(
      "CONTRACT_VALUE_CONFLICT_REQUIRES_REVIEW",
    ),
  );
});
