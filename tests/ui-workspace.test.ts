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
    /id="focusMode"/,
    "focus-mode control must remain available",
  );
  for (
    const uploadControl of [
      "openEvidenceTop",
      "openEvidenceHero",
      "openEvidenceQuick",
    ]
  ) {
    assert.match(
      html,
      new RegExp(
        'id="' +
          uploadControl +
          '"',
      ),
      uploadControl,
    );
  }
  assert.match(
    html,
    /id="evidenceControlDrawer" open/,
    "evidence upload workspace must be open by default",
  );
  assert.ok(
    html.indexOf(
      'id="evidenceControlDrawer"',
    ) <
      html.indexOf(
        'id="directorDrawer"',
      ),
    "evidence upload workspace must appear before Project Director",
  );
  assert.match(
    html,
    /const primaryView=specialized\|\|genericView/,
    "specialized module view must replace duplicate generic dashboard layers",
  );
  assert.match(
    html,
    /function renderModuleBasis/,
    "module evidence-basis context must remain rendered",
  );
  assert.match(
    html,
    /id="topbarModule"/,
    "active module must remain visible in the top bar",
  );
  assert.match(
    html,
    /id="releaseStatus"/,
    "production release state must remain visible",
  );
  assert.match(
    html,
    /replace_current_basis/,
  );
  assert.match(
    html,
    /aria-label="CMeng logo"/,
    "CMeng logo must remain visible in the shell",
  );
  for (
    const platformView of [
      "portfolioView",
      "projectsView",
      "projectWorkspace",
      "aiView",
    ]
  ) {
    assert.match(
      html,
      new RegExp(
        'id="' +
          platformView +
          '"',
      ),
      platformView,
    );
  }
  assert.match(
    html,
    /id="runAnalysisTop"/,
    "project workspace must expose an explicit Run analysis action",
  );
  assert.match(
    html,
    /id="openAiTop"/,
    "Ask CMeng must be directly accessible from project workspace",
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
