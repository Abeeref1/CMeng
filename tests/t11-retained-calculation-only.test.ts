import test from "node:test";
import assert from "node:assert/strict";
import type {AddressInfo} from "node:net";
import {createCmengServer} from "../packages/runtime-api/src/server";
import {fullCalculationRetained} from "../packages/runtime-api/src/project-projections";

// The project gateway publishes sibling owner pages after a finished
// management calculation. Those reads carry x-cmeng-retained-calculation-only
// and must never start a full analysis in the project worker.
test("retained-calculation-only owner page reads never start a full analysis", async () => {
  const server = createCmengServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  try {
    const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    const project = "RETAINED-ONLY-UAT";
    const xer = [
      "ERMHDR\t23.12",
      "%T\tPROJECT", "%F\tproj_id\tproj_short_name\tlast_recalc_date", "%R\t1\t" + project + "\t2026-07-01",
      "%T\tPROJWBS", "%F\twbs_id\tproj_id\twbs_short_name\twbs_name", "%R\t10\t1\tROOT\tProject",
      "%T\tTASK",
      "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
      "%R\t100\t1\t10\tRET-100\tWork A\tTK_Active\t2026-01-01\t2026-08-01\t2026-01-01\t2026-08-01\t1000\t500\t0\t50",
      "%R\t101\t1\t10\tRET-101\tWork B\tTK_NotStart\t2026-08-01\t2026-09-15\t2026-08-01\t2026-09-15\t500\t500\t0\t0",
      "%E",
    ].join("\n");
    const upload = await fetch(base + "/api/projects/" + project + "/schedule/uploads", {
      method: "POST",
      headers: {"content-type": "text/plain", "x-source-filename": "retained.xer", "x-upload-intent": "replace_current_basis", "x-schedule-role": "update"},
      body: xer,
    });
    assert.equal(upload.status, 201, await upload.text());
    const prefix = base + "/api/projects/" + project;
    const retainedOnly = {headers: {"x-cmeng-retained-calculation-only": "1"}};
    const ownerPages = ["/management/cross-domain-accountability", "/management/master-dashboard", "/director-position", "/management-surfaces"];

    // Before any calculation: every retained-only read is refused, and the
    // refusal itself leaves the worker without a calculation.
    for (const page of ownerPages) {
      const refused = await fetch(prefix + page, retainedOnly);
      assert.equal(refused.status, 409, page);
      assert.equal(((await refused.json()) as {error: string}).error, "calculation_not_retained");
    }
    assert.equal(fullCalculationRetained(project, "modules"), false);
    assert.equal(fullCalculationRetained(project, "management"), false);

    // A foreground Dashboard performs the one full calculation.
    const dashboard = await fetch(prefix + "/management/master-dashboard");
    assert.equal(dashboard.status, 200);
    await dashboard.arrayBuffer();
    assert.equal(fullCalculationRetained(project, "management"), true);

    // The same pages are now projections of that retained calculation and
    // are identical to their ordinary foreground responses.
    for (const page of ownerPages) {
      const retained = await fetch(prefix + page, retainedOnly);
      assert.equal(retained.status, 200, page);
      const foreground = await fetch(prefix + page);
      assert.equal(foreground.status, 200, page);
      assert.equal(retained.headers.get("x-cmeng-project-version"), foreground.headers.get("x-cmeng-project-version"));
      assert.deepEqual(await retained.json(), await foreground.json(), page);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
