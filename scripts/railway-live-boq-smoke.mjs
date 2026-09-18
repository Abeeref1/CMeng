import assert from "node:assert/strict";
import ExcelJS from "exceljs";

const base =
  process.env.CMENG_RAILWAY_URL ??
  "https://cmeng-main-production.up.railway.app";

const projectId =
  "LIVE-SMOKE-" +
  process.env.GITHUB_RUN_ID;

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Priced BOQ");

sheet.addRow([
  "Item",
  "Section",
  "Description",
  "Unit",
  "Qty",
  "Rate",
  "Amount",
  "Currency",
]);

sheet.addRow([
  "1.1",
  "A",
  "Concrete C40",
  "m3",
  125,
  450,
  56250,
  "USD",
]);

sheet.addRow([
  "1.2",
  "A",
  "Rebar",
  "kg",
  1000,
  3.5,
  3500,
  "AED",
]);

const buffer =
  await workbook.xlsx.writeBuffer();

const health = await fetch(
  base + "/health",
);

assert.equal(
  health.status,
  200,
  "Railway health endpoint must be available",
);

const healthBody = await health.json();

assert.equal(
  healthBody.status,
  "ok",
);
assert.equal(
  healthBody.service,
  "cmeng",
);
assert.equal(
  healthBody.boqIngestion?.authority,
  "candidate_only",
);
assert.equal(
  healthBody.boqIngestion?.persistence,
  "runtime_local",
);


const modulesResponse = await fetch(
  base + "/api/schedule/modules",
);

const modulesText =
  await modulesResponse.text();

assert.equal(
  modulesResponse.status,
  200,
  "Schedule modules endpoint failed: " +
    modulesText,
);

const modulesBody =
  JSON.parse(modulesText);

assert.equal(
  modulesBody.moduleCount,
  22,
);
assert.equal(
  new Set(
    modulesBody.modules.map(
      (module) => module.key,
    ),
  ).size,
  22,
);

const certificationResponse =
  await fetch(
    base +
      "/api/schedule/certification",
  );

const certificationText =
  await certificationResponse.text();

assert.equal(
  certificationResponse.status,
  200,
  "Schedule certification endpoint failed: " +
    certificationText,
);

const certification =
  JSON.parse(certificationText);

assert.equal(
  certification.scope,
  "schedule-22-final",
);
assert.equal(
  certification.moduleCount,
  22,
);
assert.equal(
  certification.invariants
    ?.missingEvidenceIsNotZero,
  true,
);
assert.equal(
  certification.invariants
    ?.candidateExtractionIsNotOfficial,
  true,
);
assert.equal(
  certification.invariants
    ?.currenciesAreNotCrossSummed,
  true,
);
assert.equal(
  certification.invariants
    ?.deterministicCpmRemainsCanonical,
  true,
);
assert.equal(
  certification.invariants
    ?.probabilisticForecastIsNonOfficial,
  true,
);
assert.equal(
  certification.invariants
    ?.claimsRequireDelayEventAndScheduleLinkage,
  true,
);
assert.equal(
  certification.invariants
    ?.boardReportRequiresEvidenceReceipts,
  true,
);

const expectedRelease =
  process.env.CMENG_EXPECTED_RELEASE ??
  null;

if (expectedRelease) {
  assert.equal(
    healthBody.release,
    expectedRelease,
    "Railway is not serving the expected final CMeng commit",
  );
  assert.equal(
    certification.release,
    expectedRelease,
    "Certification endpoint is not serving the expected final CMeng commit",
  );
}

const upload = await fetch(
  base +
    "/api/projects/" +
    encodeURIComponent(projectId) +
    "/boq/uploads",
  {
    method: "POST",
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "x-source-filename":
        "railway-live-multicurrency-boq.xlsx",
    },
    body: new Uint8Array(buffer),
  },
);

const uploadText = await upload.text();

assert.equal(
  upload.status,
  201,
  "BOQ upload failed: " + uploadText,
);

const created = JSON.parse(uploadText);

assert.equal(
  created.sourceFormat,
  "excel_ooxml",
);
assert.equal(
  created.authority,
  "candidate_only",
);
assert.equal(
  created.persistence,
  "runtime_local",
);
assert.equal(
  created.state,
  "verified_candidate",
);
assert.equal(
  created.candidateRows,
  2,
);
assert.equal(
  created.verifiedRows,
  2,
);
assert.equal(
  created.unresolvedRows,
  0,
);
assert.equal(
  created.coveragePercent,
  100,
);
assert.equal(
  created.complete,
  true,
);
assert.equal(
  created.canonicalItemCount,
  2,
);
assert.match(
  created.evidenceReceiptId,
  /^receipt_/,
);
assert.match(
  created.sourceHashSha256,
  /^[a-f0-9]{64}$/,
);

const status = await fetch(
  base +
    "/api/projects/" +
    encodeURIComponent(projectId) +
    "/boq/uploads/" +
    encodeURIComponent(
      created.ingestionId,
    ) +
    "?includeItems=true",
);

const statusText = await status.text();

assert.equal(
  status.status,
  200,
  "BOQ status lookup failed: " +
    statusText,
);

const stored = JSON.parse(statusText);

assert.equal(
  stored.canonicalItems.length,
  2,
);

const concrete =
  stored.canonicalItems.find(
    (item) => item.itemNumber === "1.1",
  );
const rebar =
  stored.canonicalItems.find(
    (item) => item.itemNumber === "1.2",
  );

assert.ok(concrete);
assert.ok(rebar);

assert.equal(
  concrete.amount,
  56250,
);
assert.equal(
  concrete.currency,
  "USD",
);
assert.equal(
  rebar.amount,
  3500,
);
assert.equal(
  rebar.currency,
  "AED",
);

for (const item of [
  concrete,
  rebar,
]) {
  assert.ok(
    item.sourceRefs.some(
      (ref) =>
        ref.startsWith(
          "evidence-receipt:",
        ),
    ),
  );
  assert.ok(
    item.sourceRefs.some(
      (ref) =>
        ref.startsWith(
          "excel:",
        ),
    ),
  );
}

console.log(
  JSON.stringify(
    {
      railway: base,
      release:
        healthBody.release ?? null,
      scheduleModuleCount:
        modulesBody.moduleCount,
      scheduleCertificationScope:
        certification.scope,
      ingestionId:
        created.ingestionId,
      evidenceReceiptId:
        created.evidenceReceiptId,
      sourceHashSha256:
        created.sourceHashSha256,
      candidateRows:
        created.candidateRows,
      verifiedRows:
        created.verifiedRows,
      currencies: [
        concrete.currency,
        rebar.currency,
      ],
      result: "PASS",
    },
    null,
    2,
  ),
);
