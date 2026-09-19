import test from "node:test";
import assert from "node:assert/strict";

import {
  cmengUatHtml,
} from "../packages/runtime-api/src/ui";

test("CMeng workspace keeps the active module primary and browser script parseable", () => {
  const html =
    cmengUatHtml();

  const moduleIndex =
    html.indexOf(
      'class="card module-panel module-workspace"',
    );
  const evidenceIndex =
    html.indexOf(
      'id="evidenceControlDrawer"',
    );

  assert.ok(
    moduleIndex >= 0,
    "active module workspace must exist",
  );
  assert.ok(
    evidenceIndex > moduleIndex,
    "active module workspace must render before evidence control",
  );

  for (
    const id of [
      "scheduleIntent",
      "boqIntent",
      "contractIntent",
      "evidenceIntent",
    ]
  ) {
    assert.match(
      html,
      new RegExp(
        'id="' + id + '"',
      ),
      id,
    );
  }

  assert.match(
    html,
    /Contradictory evidence · parallel calculations retained/,
  );
  assert.match(
    html,
    /User decision required/,
  );
  assert.match(
    html,
    /replace_current_basis/,
  );

  const dedicatedModuleViews = [
    "pmo-analysis",
    "schedule-analytics",
    "activity-analytics",
    "resource-utilization",
    "lookahead-schedule",
    "progress-report",
    "schedule-change-report",
    "revision-trend",
    "variance-trends",
    "progress-scurve",
    "quantity-scurve",
    "progress-breakdown",
    "milestones",
    "near-critical",
    "manhour-scurve",
    "forecast-history",
    "independent-forecast",
    "delay-claims",
    "notices-claims",
    "windows-analysis",
    "eot-assessment",
  ];

  for (
    const key of dedicatedModuleViews
  ) {
    assert.match(
      html,
      new RegExp(
        'key==="' +
          key +
          '"',
      ),
      key,
    );
  }

  assert.match(
    html,
    /key==="challenge-contract"&&renderDeliveryChallenge/,
    "Challenge the Contract keeps its specialist renderer",
  );

  const script =
    html.match(
      /<script>([\s\S]*?)<\/script>/,
    )?.[1];

  assert.ok(
    script,
    "embedded browser script must exist",
  );

  assert.doesNotThrow(
    () =>
      new Function(
        script,
      ),
    "embedded browser script must parse",
  );
});
