"use strict";
// Independent, source-pinned integrity and ratchet self-test. Do not modify
// the owner's guard, its baseline, lock file, or any imported project record.
// Real branch-vs-23-project guard acceptance is a SEPARATE required check.
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} = require("node:fs");
const {join,resolve} = require("node:path");
const {tmpdir} = require("node:os");
const {execFileSync,spawnSync} = require("node:child_process");

const zip=resolve(__dirname,"../docs/repair-notes/CMeng_Repair_Pack_original_20261014.zip");
const expectedZipHash="b7021b121acc0c4ea69c6bee50f201c74dc3a237b504939f8a56b882d1c32e1e";
assert.equal(createHash("sha256").update(readFileSync(zip)).digest("hex"),expectedZipHash,
  "The byte-for-byte owner ZIP may not be changed by the engineer.");
const dir=mkdtempSync(join(tmpdir(),"cmeng-original-owner-guard-"));
try{
  execFileSync("unzip",["-qq",zip,"-d",dir]);
  const root=join(dir,"cmeng-guard");
  const baselinePath=join(root,"starting_point_b3c76d6.json");
  const baseline=JSON.parse(readFileSync(baselinePath,"utf8"));
  const projects=readFileSync(join(root,"projects.txt"),"utf8").trim().split(/\r?\n/);
  const rules=[...readFileSync(join(root,"sysguard.py"),"utf8")
    .matchAll(/^\s*\('([A-Z][0-9]+)',\s*'/gm)].map(match=>match[1]);
  assert.equal(baseline.length,11822,"Historical starting-point failures must remain 11,822.");
  assert.equal(new Set(baseline.map(row=>JSON.stringify(row))).size,11822,"No duplicate baseline check identities.");
  assert.equal(projects.length,23,"Run against all original projects, not a shortened cohort.");
  assert.equal(new Set(projects).size,23,"No duplicate project identities.");
  assert.deepEqual(new Set(baseline.map(row=>row[1])),new Set(projects),
    "Historical failures must come from the same 23 supplied project IDs.");
  assert.equal(rules.length,39,"Original complete rule catalogue must remain 39.");
  assert.equal(new Set(rules).size,39,"Rule IDs may not be duplicated.");
  const historicalExecuted=33*57*23+6*23;
  assert.equal(historicalExecuted,43401,"Guard scope is 57 pages x 23 x 33 plus six project rules x 23.");
  const zeroRules=new Set(rules.filter(rule=>!baseline.some(row=>row[0]===rule)));
  for(const name of ["L4","A2","P2"])assert.ok(zeroRules.has(name),
    "Historically locked rule "+name+" must have zero baseline failures.");
  for(const rel of ["capture_sys.mjs","reader.py","fetch_documents.py","guard_compare.py",
     "run_guard.sh","README.md","app/modules.json","locked_rules.txt"])
    assert.ok(readFileSync(join(root,rel)).length>0,"Missing original owner file "+rel);
  const results=join(dir,"simulated-historical-results");
  mkdirSync(results);
  const hits=new Map(projects.map(project=>[project,[]]));
  for(const entry of baseline){
    assert.equal(entry.length,3);
    const [rule,project,page]=entry;
    assert.ok(rules.includes(rule)&&hits.has(project)&&typeof page==="string",
      "Baseline contains an unrecognized rule, project or page.");
    hits.get(project).push({rule,page});
  }
  projects.forEach((project,index)=>writeFileSync(join(results,"historical-"+index+".json"),
    JSON.stringify({project,hits:hits.get(project)})));
  writeFileSync(join(results,"summary.json"),JSON.stringify({rules:rules.map(rule=>[rule])}));
  const compare=(args=[])=>spawnSync("python3",[join(root,"guard_compare.py"),baselinePath,results,...args],
    {encoding:"utf8"});
  const unchanged=compare();
  assert.equal(unchanged.status,0,"Original guard rejected its own unchanged baseline: "+unchanged.stdout+" "+unchanged.stderr);
  // Append an independent check that was PASS at baseline. The owner ratchet
  // must block it; nothing in the supplied rules, lock file or source changes.
  const probePath=join(results,"historical-0.json");
  const probe=JSON.parse(readFileSync(probePath,"utf8"));
  probe.hits.push({rule:"L4",page:"master-dashboard"});
  writeFileSync(probePath,JSON.stringify(probe));
  const lockedFailure=compare();
  assert.equal(lockedFailure.status,1,"Owner guard failed to block a new locked-rule regression.");
  assert.match(lockedFailure.stdout,/LOCKED RULE FAILURES/);
  writeFileSync(probePath,JSON.stringify({project:probe.project,hits:hits.get(probe.project)}));
  const requiredRule=[...new Set(baseline.map(row=>row[0]))][0];
  const requiredFailure=compare(["--require",requiredRule]);
  assert.equal(requiredFailure.status,1,"Owner guard failed to block an unmet required rule.");
  assert.match(requiredFailure.stdout,/REQUIRED RULES NOT AT ZERO/);
  console.log("Original owner ZIP hash verified; 39 rules; 23 distinct projects;");
  console.log("11,822 historical failures of 43,401 checks; 3 original locked rules.");
  console.log("Ratchet unchanged baseline PASS; added locked failure BLOCKED; required nonzero rule BLOCKED.");
  console.log("THIS IS NOT A CURRENT 23-PROJECT BRANCH GUARD RUN.");
}finally{rmSync(dir,{recursive:true,force:true});}
