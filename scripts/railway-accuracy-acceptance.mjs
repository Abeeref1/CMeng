import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';

// Read-only acceptance against the exact released revision. No upload, delete or control writes.
const base = process.env.CMENG_RAILWAY_URL ?? 'https://cmeng-main-production.up.railway.app';
const expected = process.env.CMENG_EXPECTED_RELEASE;
assert.match(expected ?? '', /^[a-f0-9]{40}$/, 'An exact expected release SHA is required');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const evidenceDigest = docs => digest(docs.map(d => [d.documentId, d.sourceHashSha256]).sort((a,b) => a[0].localeCompare(b[0])));
const summary = { expectedRelease: expected, mode: 'GET_ONLY', checks: [], status: 'running' };
const check = (name, condition) => { assert.ok(condition, name); summary.checks.push({ name, status: 'pass' }); };
async function get(path) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(90000) });
  assert.equal(response.status, 200, 'GET failed: ' + path.replace(/projects\/[^/]+/, 'projects/[redacted]'));
  return response;
}
async function json(path) { return (await get(path)).json(); }
try {
  let health;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { health = await json('/health'); } catch { health = null; }
    if (health?.release === expected && health?.status === 'ok') break;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  check('Exact CMeng release is healthy', health?.release === expected && health?.service === 'cmeng');
  summary.observedRelease = health.release;
  const portfolio = await json('/api/portfolio');
  const requested = process.env.CMENG_PROJECT_CODE;
  let candidates = requested ? portfolio.projects.filter(p => p.projectId === requested) : portfolio.projects.filter(p => /ORBIT/i.test(p.projectId));
  if (!requested && !candidates.length && portfolio.projects.length === 1) candidates = portfolio.projects;
  check('Acceptance project resolves uniquely', candidates.length === 1);
  const project = candidates[0];
  summary.projectFingerprint = digest(project.projectId);
  const prefix = '/api/projects/' + encodeURIComponent(project.projectId);
  const before = await json(prefix + '/evidence/documents');
  const sourceBefore = evidenceDigest(before.documents);
  summary.documentCount = before.documentCount;
  const module = key => json(prefix + '/schedule/modules/' + key);
  const resource = await module('resource-utilization');
  const weekly = resource.data?.weeklyCapacityEvidence;
  check('Resources use canonical weekly source evidence', resource.data?.producerVersion === 'resource-source-integration-v1' && weekly?.rowCount > 0);
  check('Resource capacity is not an empty zero fallback', resource.data.capacityCoveragePercent > 0 && resource.data.plannedUtilizationPercent !== null);
  const eot = await module('eot-assessment');
  const time = eot.data?.timeBasisReconciliation;
  check('EOT exposes amendment/determination reconciliation', !!time);
  check('Unresolved EOT overlap never manufactures an adjusted completion', time.overlapResolution !== 'unresolved' || eot.data.officialAdjustedCompletionIso === null);
  const delay = await module('delay-claims');
  check('Delay claim/event identities reach runtime', delay.data?.events?.length > 0 && delay.data?.claims?.length > 0);
  const keys = ['commercial-overview','cost-forecast','variations-change','payments','cash-flow','commercial-claims-notices','contract-particulars-bonds'];
  let sourceDigest;
  for (const key of keys) {
    const result = await module(key);
    const ledger = result.data?.position?.sourceLedger;
    check(key + ': canonical source ledger is connected', ledger?.producerVersion === 'commercial-canonical-v1');
    sourceDigest ??= digest(ledger);
    check(key + ': shared position agrees across modules', digest(ledger) === sourceDigest);
    const report = await json(prefix + '/schedule/modules/' + key + '/report.json');
    check(key + ': JSON export matches the live position', digest(report.result?.data?.position?.sourceLedger) === sourceDigest);
    if (key === 'payments') {
      check('Payment stages preserve missing cash as unknown', ledger.payments.length > 0 && ledger.payments.every(p => p.amounts.paidAmount.value !== null || p.calculatedOutstandingAmount?.value === null));
    }
    if (['cost-forecast','payments','variations-change'].includes(key)) {
      const response = await get(prefix + '/schedule/modules/' + key + '/report.xlsx');
      check(key + ': downloadable Excel content type', (response.headers.get('content-type') ?? '').includes('spreadsheetml'));
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
      check(key + ': Excel opens with populated worksheets', workbook.worksheets.length > 0 && workbook.worksheets.some(s => s.rowCount > 1));
    }
  }
  const after = await json(prefix + '/evidence/documents');
  check('All original source identities and hashes remain unchanged', sourceBefore === evidenceDigest(after.documents));
  const finalHealth = await json('/health');
  check('Release stayed unchanged throughout acceptance', finalHealth.release === expected);
  summary.status = 'pass';
} catch (error) {
  summary.status = 'fail';
  summary.error = error instanceof Error ? error.message : 'Unknown error';
  process.exitCode = 1;
} finally {
  // Do not publish source rows, filenames, project codes or monetary values in CI artifacts.
  writeFileSync('accuracy-acceptance.json', JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
