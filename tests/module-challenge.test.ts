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
