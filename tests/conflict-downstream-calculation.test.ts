import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLdScenario,
} from "../packages/project-director/src";
import type {
  ContractLdTerms,
} from "../packages/contract-commercial/src";

test("conflicting LD rates create parallel downstream calculations instead of blocking", () => {
  const terms:
    ContractLdTerms = {
    rateState:
      "conflicted",
    capState:
      "missing",
    rate: null,
    cap: null,
    rateCandidates: [
      {
        candidateId:
          "rate-supported",
        basis:
          "fixed_amount_per_day",
        amount: 1000,
        currency: "USD",
        percent: null,
        sourceRefs: [
          "contract:8.7",
          "amendment:2:8.7",
        ],
        textSnippet:
          "USD 1,000 per day",
      },
      {
        candidateId:
          "rate-other",
        basis:
          "fixed_amount_per_day",
        amount: 1200,
        currency: "USD",
        percent: null,
        sourceRefs: [
          "report:ld-rate",
        ],
        textSnippet:
          "USD 1,200 per day",
      },
    ],
    capCandidates: [],
    diagnostics: [
      "LD_RATE_CONFLICT_REQUIRES_REVIEW",
    ],
  };

  const result =
    buildLdScenario(
      terms,
      10,
      undefined,
      [],
    );

  assert.equal(
    result.state,
    "multi_scenario",
  );
  assert.equal(
    result.scenarios.length,
    2,
  );
  assert.deepEqual(
    result.scenarios
      .map(
        (scenario) =>
          scenario
            .uncappedAmount,
      )
      .sort(
        (a, b) =>
          Number(a) -
          Number(b),
      ),
    [
      10_000,
      12_000,
    ],
  );
  assert.equal(
    result.userDecisionRequired,
    true,
  );
  assert.ok(
    result.recommendedScenarioId,
  );
  const recommended =
    result.scenarios.find(
      (scenario) =>
        scenario
          .scenarioId ===
        result
          .recommendedScenarioId,
    );
  assert.equal(
    recommended
      ?.rateCandidateId,
    "rate-supported",
  );
  assert.equal(
    recommended
      ?.recommended,
    true,
  );
});

test("contradictory contract values branch percent-based LD calculations across every candidate", () => {
  const terms:
    ContractLdTerms = {
    rateState:
      "candidate",
    capState:
      "candidate",
    rate: {
      candidateId:
        "rate-percent",
      basis:
        "percent_contract_amount_per_day",
      amount: null,
      currency: null,
      percent: 0.1,
      sourceRefs: [
        "contract:8.7",
      ],
      textSnippet:
        "0.1% per day",
    },
    cap: {
      candidateId:
        "cap-percent",
      basis:
        "percent_contract_amount",
      amount: null,
      currency: null,
      percent: 10,
      sourceRefs: [
        "contract:8.7",
      ],
      textSnippet:
        "maximum 10%",
    },
    rateCandidates: [{
      candidateId:
        "rate-percent",
      basis:
        "percent_contract_amount_per_day",
      amount: null,
      currency: null,
      percent: 0.1,
      sourceRefs: [
        "contract:8.7",
      ],
      textSnippet:
        "0.1% per day",
    }],
    capCandidates: [{
      candidateId:
        "cap-percent",
      basis:
        "percent_contract_amount",
      amount: null,
      currency: null,
      percent: 10,
      sourceRefs: [
        "contract:8.7",
      ],
      textSnippet:
        "maximum 10%",
    }],
    diagnostics: [],
  };

  const result =
    buildLdScenario(
      terms,
      10,
      undefined,
      [
        {
          amount:
            8_800_000,
          currency: "SAR",
          sourceRefs: [
            "contract:accepted-amount",
          ],
        },
        {
          amount:
            9_300_000,
          currency: "SAR",
          sourceRefs: [
            "amendment:revised-value",
          ],
        },
      ],
    );

  assert.equal(
    result.state,
    "multi_scenario",
  );
  assert.equal(
    result.scenarios.length,
    2,
  );
  assert.deepEqual(
    result.scenarios
      .map(
        (scenario) =>
          scenario
            .uncappedAmount,
      )
      .sort(
        (a, b) =>
          Number(a) -
          Number(b),
      ),
    [
      88_000,
      93_000,
    ],
  );
  assert.ok(
    result.scenarios
      .every(
        (scenario) =>
          scenario.state ===
            "calculated",
      ),
  );
  assert.equal(
    result.userDecisionRequired,
    true,
  );
});
