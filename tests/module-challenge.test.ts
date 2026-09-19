import test from "node:test";
import assert from "node:assert/strict";

import {
  buildModuleChallenge,
  extractDocumentAssertions,
} from "../packages/module-challenge/src";

test("contractor narrative assertions are extracted for independent challenge", () => {
  const assertions =
    extractDocumentAssertions(
      [
        "MONTHLY PROGRESS REPORT",
        "Activity count: 1",
        "Relationship count: 0",
        "Critical activities: 0",
        "Overall progress: 55.6%",
        "Forecast completion: 2026-07-10",
        "Average manpower: 1450",
        "Claimed EOT: 35 days",
      ].join("\n"),
      "evidence:monthly-report.txt",
    );

  const byMetric =
    new Map(
      assertions.map(
        (item) => [
          item.metric,
          item.value,
        ],
      ),
    );

  assert.equal(
    byMetric.get(
      "activity_count",
    ),
    1,
  );
  assert.equal(
    byMetric.get(
      "relationship_count",
    ),
    0,
  );
  assert.equal(
    byMetric.get(
      "critical_count",
    ),
    0,
  );
  assert.equal(
    byMetric.get(
      "progress_percent",
    ),
    55.6,
  );
  assert.equal(
    byMetric.get(
      "completion_date",
    ),
    "2026-07-10",
  );
  assert.equal(
    byMetric.get(
      "manpower_average",
    ),
    1450,
  );
  assert.equal(
    byMetric.get(
      "claimed_eot_days",
    ),
    35,
  );
});

test("missing submitted value does not suppress the independent answer", () => {
  const result =
    buildModuleChallenge({
      moduleKey:
        "schedule-analytics",
      generatedAt:
        "2026-09-19T00:00:00.000Z",
      assertions: [],
      metrics: [
        {
          metric:
            "activity_count",
          label:
            "Activity count",
          value: 1487,
          unit: "activities",
          state:
            "calculated",
          sourceRefs: [
            "schedule:S1",
          ],
          consequenceWhenDifferent:
            "Submitted count is inconsistent.",
          consequenceWhenMissing:
            "Contractor did not submit a count; CMeng still calculated the actual population.",
          actionWhenDifferent:
            "Reconcile the report.",
          actionWhenMissing:
            "Submit the contractor count and basis.",
        },
      ],
    });

  assert.equal(
    result.items[0]
      ?.submitted.state,
    "not_submitted",
  );
  assert.equal(
    result.items[0]
      ?.independent.value,
    1487,
  );
  assert.equal(
    result.items[0]
      ?.independent.state,
    "calculated",
  );
  assert.match(
    result.items[0]
      ?.consequence ?? "",
    /still calculated/i,
  );
  assert.ok(
    (
      result.items[0]
        ?.action.length ??
      0
    ) > 0,
  );
});


test("contradictory submitted values stay visible, each is calculated, and the strongest evidence is recommended without governing it", () => {
  const result =
    buildModuleChallenge({
      moduleKey:
        "progress-report",
      generatedAt:
        "2026-09-19T00:00:00.000Z",
      assertions: [
        {
          assertionId: "A1",
          metric:
            "progress_percent",
          label:
            "Reported progress",
          value: 55.6,
          valueType:
            "percent",
          unit: "%",
          sourceRef:
            "monthly-report:active",
          sourceText:
            "Overall progress: 55.6%",
          confidence: 0.95,
          documentId: "DOC-A",
          evidenceBasisState:
            "active",
          uploadedAt:
            "2026-09-18T00:00:00.000Z",
          basisRevisionId:
            "REPORT-09",
          sourceAuthority:
            "governed",
        },
        {
          assertionId: "A2",
          metric:
            "progress_percent",
          label:
            "Reported progress",
          value: 52,
          valueType:
            "percent",
          unit: "%",
          sourceRef:
            "meeting-minutes:candidate",
          sourceText:
            "Progress noted as 52%",
          confidence: 0.85,
          documentId: "DOC-B",
          evidenceBasisState:
            "candidate",
          uploadedAt:
            "2026-09-18T00:00:00.000Z",
          basisRevisionId:
            "MOM-18",
          sourceAuthority:
            "candidate",
        },
      ],
      metrics: [{
        metric:
          "progress_percent",
        label:
          "Progress",
        value: 54,
        unit: "%",
        state:
          "derived",
        sourceRefs: [
          "schedule:S1",
        ],
        consequenceWhenDifferent:
          "Submitted progress values diverge from the independent position.",
        consequenceWhenMissing:
          "No submitted progress.",
        actionWhenDifferent:
          "Reconcile the progress evidence.",
        actionWhenMissing:
          "Submit progress evidence.",
      }],
    });

  const item =
    result.items[0]!;
  assert.equal(
    item.submitted.state,
    "conflicted",
  );
  assert.equal(
    item.submitted
      .alternatives?.length,
    2,
  );
  assert.equal(
    item.candidateComparisons
      .length,
    2,
  );
  assert.deepEqual(
    item.candidateComparisons
      .map(
        (candidate) =>
          candidate.gapValue,
      )
      .sort(
        (a, b) =>
          Number(a) -
          Number(b),
      ),
    [-1.6, 2],
  );
  assert.equal(
    item.conflictRecommendation
      .state,
    "recommendation_only",
  );
  assert.equal(
    item.conflictRecommendation
      .recommendedValue,
    55.6,
  );
  assert.equal(
    item.conflictRecommendation
      .userDecisionRequired,
    true,
  );
  assert.equal(
    item.gap.state,
    "calculated",
  );
  assert.equal(
    item.gap.value,
    -1.6,
  );
});
