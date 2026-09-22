import test from "node:test";
import assert from "node:assert/strict";

import {
  loadCertifiedDemoProject,
} from "../packages/runtime-api/src/demo-project";
import {
  directorForProject,
  invalidateProject,
} from "../packages/runtime-api/src/project-projections";
import {
  runtimeProjects,
} from "../packages/runtime-api/src/project-state";

test("missing control evidence is not presented as an established zero", () => {
  const project =
    "MISSING-ZERO-GUARD";
  const state =
    loadCertifiedDemoProject(
      project,
    );

  state.controls = {
    ...state.controls,
    hseIncidents: [],
    ncrs: [],
    rfis: [],
    permits: [],
    bonds: [],
    risks: [],
  };
  state.evidenceDocuments = [];
  state.version += 1;
  runtimeProjects.replace(state);
  invalidateProject(project);

  const director =
    directorForProject(project);
  assert.ok(director);

  assert.equal(
    director.controls
      .hseEvidenceState,
    "not_submitted",
  );
  assert.equal(
    director.controls
      .qualityEvidenceState,
    "not_submitted",
  );
  assert.equal(
    director.controls
      .rfiEvidenceState,
    "not_submitted",
  );
  assert.equal(
    director.controls
      .permitEvidenceState,
    "not_submitted",
  );
  assert.equal(
    director.controls
      .bondEvidenceState,
    "not_submitted",
  );
  assert.equal(
    director.controls
      .riskEvidenceState,
    "not_submitted",
  );
  assert.equal(
    director.controls
      .openRiskCount,
    null,
  );

  // The shared payload itself carries missingness, so every consumer is safe.
  assert.equal(
    director.controls
      .openHseIncidentCount,
    null,
  );
});
