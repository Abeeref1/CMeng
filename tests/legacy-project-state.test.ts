import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
} from "node:fs";
import {
  tmpdir,
} from "node:os";
import {
  join,
} from "node:path";

import {
  RuntimeProjectStore,
} from "../packages/runtime-api/src/project-state";

test("legacy persisted project controls are normalized on restore", () => {
  const dir =
    mkdtempSync(
      join(
        tmpdir(),
        "cmeng-legacy-state-",
      ),
    );

  try {
    const store =
      new RuntimeProjectStore({
        dataDir: dir,
        durable: false,
      });
    const state =
      store.getOrCreate(
        "LEGACY-PROJECT",
      );

    const controls =
      state.controls as unknown as
        Record<string, unknown>;

    for (
      const key of [
        "variations",
        "invoices",
        "retentions",
        "bonds",
        "claimCommercials",
        "hseIncidents",
        "ncrs",
        "rfis",
        "permits",
        "risks",
      ]
    ) {
      delete controls[key];
    }
    delete controls[
      "readinessEvidence"
    ];
    delete controls[
      "progressEvidence"
    ];

    store.touch(state);

    const restored =
      new RuntimeProjectStore({
        dataDir: dir,
        durable: false,
      }).get(
        "LEGACY-PROJECT",
      );

    assert.ok(restored);
    assert.deepEqual(
      restored.controls.variations,
      [],
    );
    assert.deepEqual(
      restored.controls.invoices,
      [],
    );
    assert.deepEqual(
      restored.controls.retentions,
      [],
    );
    assert.deepEqual(
      restored.controls.bonds,
      [],
    );
    assert.deepEqual(
      restored.controls.claimCommercials,
      [],
    );
    assert.deepEqual(
      restored.controls.hseIncidents,
      [],
    );
    assert.deepEqual(
      restored.controls.ncrs,
      [],
    );
    assert.deepEqual(
      restored.controls.rfis,
      [],
    );
    assert.deepEqual(
      restored.controls.permits,
      [],
    );
    assert.deepEqual(
      restored.controls.risks,
      [],
    );
    assert.deepEqual(
      restored.controls.readinessEvidence,
      {},
    );
    assert.deepEqual(
      restored.controls.progressEvidence,
      {},
    );
  } finally {
    rmSync(
      dir,
      {
        recursive: true,
        force: true,
      },
    );
  }
});
