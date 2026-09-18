import test from "node:test";
import assert from "node:assert/strict";

import { parseXerBytes, verifyXerIntegrity } from "../packages/xer-parser/src";

test("external predecessor is preserved and separated from broken internal references", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\t1\tCURRENT",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code",
    "%R\t100\t1\t10\tA100",
    "%T\tTASKPRED",
    "%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt",
    "%R\t900\t1\t100\t99\t500\tPR_FS\t8",
    "%E",
  ].join("\n");

  const integrity = verifyXerIntegrity(parseXerBytes(Buffer.from(source, "utf8")));

  assert.equal(integrity.sourceComplete, true);
  assert.equal(integrity.graphComplete, false);
  assert.equal(integrity.complete, false);
  assert.equal(integrity.externalRelationshipCount, 1);
  assert.equal(integrity.externalRelationships[0]!.predecessorProjectId, "99");
  assert.equal(integrity.externalRelationships[0]!.predecessorTaskId, "500");
  assert.deepEqual(integrity.missingPredecessorTaskIds, []);
});

test("predecessor in an included project must exist and cannot hide as external", () => {
  const source = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\t1\tCURRENT",
    "%R\t2\tOTHER INCLUDED",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id",
    "%R\t10\t1",
    "%R\t20\t2",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code",
    "%R\t100\t1\t10\tA100",
    "%T\tTASKPRED",
    "%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type",
    "%R\t900\t1\t100\t2\t500\tPR_FS",
    "%E",
  ].join("\n");

  const integrity = verifyXerIntegrity(parseXerBytes(Buffer.from(source, "utf8")));

  assert.equal(integrity.externalRelationshipCount, 0);
  assert.deepEqual(integrity.missingPredecessorTaskIds, ["2::500"]);
  assert.equal(integrity.sourceComplete, false);
  assert.equal(integrity.complete, false);
});
