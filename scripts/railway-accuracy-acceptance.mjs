import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';

// Read-only acceptance against the exact released revision. No upload, delete or control writes.
const base = process.env.CMENG_RAILWAY_URL ?? 'https://cmeng-main-production.up.railway.app';
const expected = process.env.CMENG_EXPECTED_RELEASE;
assert.match(expected ?? '', /^[a-f0-9]{40}$/, 'An exact expected release SHA is required');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const comparableRuntimeValue = value => {
  if (Array.isArray(value)) return value.map(comparableRuntimeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'generatedAt')
        .map(([key, child]) => [key, comparableRuntimeValue(child)])
    );
  }
  return value;
};
const comparableDigest = value => digest(comparableRuntimeValue(value));
const evidenceDigest = docs => digest(docs.map(d => [d.documentId, d.sourceHashSha256]).sort((a,b) => a[0].localeCompare(b[0])));
const summary = { expectedRelease: expected, mode: 'GET_ONLY', checks: [], status: 'running' };
const check = (name, condition) => {
  const passed = Boolean(condition);
  summary.checks.push({ name, status: passed ? 'pass' : 'fail' });
  return passed;
};
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
  const sourceClass = document => {
    const value = String(document.sourceRelativePath ?? document.sourceFilename ?? "")
      .split(/[\\/]/).at(-1)?.toUpperCase() ?? "";
    for (const label of ["SCH01","SCH02","PDB","CL01","EOT01","EOT02","EOT03","L01"]) {
      if (value.startsWith(label)) return label;
    }
    return null;
  };
  const mediaClass = document => {
    const value = String(document.mediaType ?? "") + " " + String(document.sourceFilename ?? "");
    if (/csv/i.test(value)) return "csv";
    if (/spreadsheet|excel|xlsx|xlsm/i.test(value)) return "excel";
    if (/pdf/i.test(value)) return "pdf";
    if (/wordprocessing|docx/i.test(value)) return "docx";
    return "other";
  };
  summary.sourceInventory = before.documents
    .map(document => ({
      sourceClass: sourceClass(document),
      category: document.category ?? null,
      documentType: document.documentType ?? null,
      basisState: document.basisState ?? null,
      mediaClass: mediaClass(document),
      parserState: document.parserState ?? null,
      mapping: document.mapping ? {
        method: document.mapping.method ?? null,
        linkedActivityField: document.mapping.linkedActivityField ?? null,
        linkedActivityCount: document.mapping.linkedActivityCount ?? null,
        mappedActivityCount: document.mapping.mappedActivityCount ?? null,
        unmappedActivityCount: document.mapping.unmappedActivityCount ?? null,
        coveragePercent: document.mapping.coveragePercent ?? null
      } : null,
      assertionMetrics: Array.isArray(document.assertions)
        ? [...new Set(document.assertions.map(item => item.metric).filter(Boolean))].sort()
        : [],
      schemaHeaders: Array.isArray(document.schemaHeaders)
        ? document.schemaHeaders
        : []
    }))
    .filter(item => item.sourceClass !== null);
  const module = key => json(prefix + '/schedule/modules/' + key);
  const allModuleKeys = [
    'pmo-analysis','schedule-analytics','activity-analytics','lookahead-schedule',
    'schedule-change-report','revision-trend','milestones','near-critical',
    'resource-utilization','progress-report','variance-trends','progress-scurve',
    'quantity-scurve','progress-breakdown','manhour-scurve','forecast-history',
    'independent-forecast','delay-claims','notices-claims','windows-analysis',
    'eot-assessment','challenge-contract','commercial-overview','cost-forecast',
    'variations-change','payments','cash-flow','commercial-claims-notices',
    'contract-particulars-bonds'
  ];
  const modules = new Map();
  for (const key of allModuleKeys) {
    const result = await module(key);
    modules.set(key, result);
    check(key + ': live page resolves', result?.key === key && result?.status !== 'blocked' && result?.data !== null);
    check(key + ': live JSON has no non-finite serialization marker', !/NaN|Infinity/.test(JSON.stringify(result?.data)));
    const report = await json(prefix + '/schedule/modules/' + key + '/report.json');
    check(key + ': report is generated from the same live governed result', report?.result?.key === key && comparableDigest(report.result.data) === comparableDigest(result.data));
  }
  check('All 29 Project Control pages are traced', modules.size === 29);

  const overview = await json(prefix + '/overview');
  check('Current programme Data Date is 31 Aug 2026', String(overview.latestDataDateIso ?? '').startsWith('2026-08-31'));
  for (const [key, result] of modules) {
    const date = result.data?.dataDateIso ?? result.data?.result?.dataDateIso ?? null;
    if (date !== null) check(key + ': Data Date follows current programme', String(date).startsWith('2026-08-31'));
  }

  const resource = modules.get('resource-utilization');
  const weekly = resource.data?.weeklyCapacityEvidence;
  check('Resources use canonical weekly source evidence', resource.data?.producerVersion === 'resource-source-integration-v1' && weekly?.rowCount > 0);
  check('RES01–RES07 utilization-applicable population is 210', resource.data?.utilizationApplicableResourceCount === 210);
  check('RES01–RES07 weekly population is 19,110 rows', weekly?.rowCount === 19110);
  check('RES01–RES07 approved actual-usage population is 4,620 rows', weekly?.approvedActualUsageRowCount === 4620);
  check('Resource capacity coverage is established, not zero', resource.data?.capacityCoveragePercent > 0);
  check('Planned utilization reconciles to source 84.47%', Math.abs(resource.data?.plannedUtilizationPercent - 84.47) <= 0.02);
  check('Actual utilization reconciles to source 76.97%', Math.abs(resource.data?.actualUtilizationPercent - 76.97) <= 0.02);
  check('Resource arithmetic remains class/unit partitioned', Array.isArray(weekly?.weeklyTotals) && weekly.weeklyTotals.every(row => row.resourceClass !== 'material' && typeof row.unit === 'string' && row.unit.length > 0));
  const manhours = modules.get('manhour-scurve');
  check('Man-Hour S-Curve is labor-only source history', manhours.data?.unitBasis === 'source_labor_hours' && manhours.data?.actualHistoryMethod === 'source_approved_weekly_usage');
  const near = modules.get('near-critical');
  check('Near-critical uses activity-calendar working days', near.data?.thresholdBasis === 'activity_calendar_working_days' && near.data?.nearCriticalThresholdWorkingDays === 5);
  check('Strict Near-Critical is 0 < TF <= 5 working days', near.data?.nearCriticalCount === 504);
  check('Float-Risk Watchlist is 0 <= TF <= 5 working days', near.data?.floatRiskWatchlistCount === 629);
  check('Zero-float population is preserved separately', near.data?.zeroFloatCount === 125);
  check('Negative-float population is preserved separately', near.data?.negativeFloatCount === 378);
  check('Source label Near Critical reconciles to the Float-Risk Watchlist rather than redefining CMeng taxonomy',
    near.data?.sourceReportedNearCriticalLabelCount === 629 &&
    near.data?.reconciliation?.sourceLabelReconcilesTo === 'float_risk_watchlist' &&
    near.data?.reconciliation?.gap === 0);

  const scheduleReview = modules.get('schedule-analytics');
  check('Programme Review keeps strict Near-Critical separate', scheduleReview.data?.result?.float?.nearCriticalCount === 504 && scheduleReview.data?.result?.float?.nearCriticalThresholdBasis === 'activity_working_days');
  check('Programme Review carries the same Float-Risk Watchlist', scheduleReview.data?.result?.float?.floatRiskWatchlistCount === 629);
  check('Programme Review criticality remains TF <= 0', scheduleReview.data?.result?.float?.criticalCount === 503 && scheduleReview.data?.result?.float?.zeroFloatCount === 125 && scheduleReview.data?.result?.float?.negativeFloatCount === 378);

  const activityReview = modules.get('activity-analytics');
  check('Activity Review strict Near-Critical taxonomy is consistent', Array.isArray(activityReview.data?.rows) && activityReview.data.rows.filter(row => row.criticality === 'near_critical').length === 504);
  check('Activity Review Float-Risk Watchlist is consistent', Array.isArray(activityReview.data?.rows) && activityReview.data.rows.filter(row => row.floatRiskWatchlist === true).length === 629);

  const revision = modules.get('revision-trend');
  check('Revision History latest point keeps strict Near-Critical', revision.data?.points?.at(-1)?.nearCriticalCount === 504);
  check('Revision History latest point carries Float-Risk Watchlist', revision.data?.points?.at(-1)?.floatRiskWatchlistCount === 629);

  const variance = modules.get('variance-trends');
  check('Variance Trend latest point keeps strict Near-Critical', variance.data?.points?.at(-1)?.nearCriticalCount === 504);
  check('Variance Trend latest point carries Float-Risk Watchlist', variance.data?.points?.at(-1)?.floatRiskWatchlistCount === 629);

  const forecast = modules.get('independent-forecast');
  check('Forecast taxonomy has four distinct named positions',
    forecast.data?.forecastTaxonomy?.contractorProgramme?.label === 'Contractor Programme Forecast' &&
    forecast.data?.forecastTaxonomy?.sourceProductivity?.label === 'Source Productivity Forecast' &&
    forecast.data?.forecastTaxonomy?.cmengCpm?.label === 'CMeng Independent CPM Forecast' &&
    forecast.data?.forecastTaxonomy?.probabilistic?.label === 'CMeng Probabilistic Forecast');
  check('Contractor Programme Forecast is established', forecast.data?.forecastTaxonomy?.contractorProgramme?.completionIso !== null);
  check('Source Productivity Forecast is a separate source position', forecast.data?.sourceProductivityForecastCompletionIso !== null && !['missing','conflicted'].includes(forecast.data?.sourceProductivityForecastState));
  check('CMeng deterministic and probabilistic positions stay separately labelled', forecast.data?.independentForecastCompletionIso !== undefined && forecast.data?.probabilistic?.p50CompletionIso !== undefined && forecast.data?.probabilistic?.p80CompletionIso !== undefined && forecast.data?.probabilistic?.p90CompletionIso !== undefined);

  const windows = modules.get('windows-analysis');
  check('Gross positive window movement reconciles to 203.17 days', Math.abs(windows.data?.positiveProgrammeMovementDays - 203.17) <= 0.02);
  check('Net Project Completion movement reconciles to 181 days', Math.abs(windows.data?.projectCompletionMovementDays - 181) <= 0.02);
  check('Window gross and net measures remain distinct', Math.abs(windows.data?.positiveProgrammeMovementDays - windows.data?.projectCompletionMovementDays) > 0.1);

  const eot = modules.get('eot-assessment');
  const time = eot.data?.timeBasisReconciliation;
  check('EOT exposes amendment/determination reconciliation', !!time);
  check('C02 governs revised contractual completion at 31 Mar 2030', String(eot.data?.contractualCompletionIso ?? '').startsWith('2030-03-31'));
  check('EOT03 immutable register population is 16', time?.registerDeterminationCount === 16);
  check('EOT03 immutable register sums to 138 days', time?.registerDeterminationDays === 138);
  check('C02 already incorporates 90 EOT days', time?.incorporatedEotDays === 90);
  check('EOT is cutoff-controlled at the 31 Aug 2026 Data Date', time?.dataDateIso === '2026-08-31' && time?.effectiveDeterminationCount === 2 && eot.data?.officialApprovedEotDays === 26);
  check('Unresolved EOT overlap never manufactures an adjusted completion', time.overlapResolution !== 'unresolved' || eot.data.officialAdjustedCompletionIso === null);

  const delay = modules.get('delay-claims');
  // DelayClaimsProjection exposes event rows, claimCount and linkedClaimIds, not raw claims.
  const events = delay.data?.events;
  check('Delay claim/event identities reach runtime', Array.isArray(events) && events.length > 0 && delay.data.claimCount > 0 && events.every(e => typeof e.eventId === 'string' && e.eventId.length > 0 && Array.isArray(e.linkedClaimIds) && e.linkedClaimIds.length > 0 && e.linkedClaimIds.every(id => typeof id === 'string' && id.length > 0)));
  check('CL01 governed event population is 350', delay.data?.eventCount === 350 && events.length === 350);
  check('Delay identity populations are complete and consistent', delay.data.eventCount === events.length && new Set(events.map(e => e.eventId)).size === events.length && new Set(events.flatMap(e => e.linkedClaimIds)).size === delay.data.claimCount);
  check('All governed events retain claim linkage', delay.data?.claimLinkedEventCount === 350);
  check('Delay-event activities are represented in the canonical chain', delay.data?.activityLinkedEventCount > 0 && events.some(e => Array.isArray(e.relatedActivityIds) && e.relatedActivityIds.length > 0));
  check('Delay-event windows are represented in the canonical chain', delay.data?.windowLinkedEventCount > 0 && events.some(e => Array.isArray(e.overlappingWindowIds) && e.overlappingWindowIds.length > 0));
  check('Delay-event notices are represented in the canonical chain', delay.data?.noticeLinkedEventCount > 0 && events.some(e => Array.isArray(e.noticeIds) && e.noticeIds.length > 0));
  check('All 16 Engineer determinations remain linked to governed events', delay.data?.determinationLinkedEventCount > 0 && new Set(events.flatMap(e => e.determinationIds ?? [])).size === 16);
  check('Determination chains preserve claim/activity/window/notice/determination where source evidence supports all links', delay.data?.fullDeterminationChainEventCount > 0);
  summary.observed = {
    nearCritical: {
      thresholdBasis: near.data?.thresholdBasis ?? null,
      workingDays: near.data?.nearCriticalThresholdWorkingDays ?? near.data?.nearCriticalWorkingDays ?? null,
      thresholdHours: near.data?.nearCriticalThresholdHours ?? null,
      strictNearCriticalCount: near.data?.nearCriticalCount ?? null,
      floatRiskWatchlistCount: near.data?.floatRiskWatchlistCount ?? null,
      zeroFloatCount: near.data?.zeroFloatCount ?? null,
      negativeFloatCount: near.data?.negativeFloatCount ?? null,
      sourceReportedNearCriticalLabelCount: near.data?.sourceReportedNearCriticalLabelCount ?? null,
      sourceLabelReconcilesTo: near.data?.reconciliation?.sourceLabelReconcilesTo ?? null,
      floatCoveragePercent: near.data?.floatCoveragePercent ?? null,
      classificationCoveragePercent: near.data?.classificationCoveragePercent ?? null,
      unresolvedActivityCount: near.data?.thresholdUnresolvedActivityCount ?? null,
      programmeReviewStrictCount: scheduleReview.data?.result?.float?.nearCriticalCount ?? null,
      programmeReviewWatchlistCount: scheduleReview.data?.result?.float?.floatRiskWatchlistCount ?? null,
      programmeReviewCriticalCount: scheduleReview.data?.result?.float?.criticalCount ?? null,
      programmeReviewBasis: scheduleReview.data?.result?.float?.nearCriticalThresholdBasis ?? null,
      activityReviewStrictCount: Array.isArray(activityReview.data?.rows)
        ? activityReview.data.rows.filter(row => row.criticality === 'near_critical').length
        : null,
      activityReviewWatchlistCount: Array.isArray(activityReview.data?.rows)
        ? activityReview.data.rows.filter(row => row.floatRiskWatchlist === true).length
        : null,
      revisionLatestStrictCount: revision.data?.points?.at(-1)?.nearCriticalCount ?? null,
      revisionLatestWatchlistCount: revision.data?.points?.at(-1)?.floatRiskWatchlistCount ?? null,
      varianceLatestStrictCount: variance.data?.points?.at(-1)?.nearCriticalCount ?? null,
      varianceLatestWatchlistCount: variance.data?.points?.at(-1)?.floatRiskWatchlistCount ?? null
    },
    forecast: {
      sourceProductivityState: forecast.data?.sourceProductivityForecastState ?? null,
      sourceProductivityCompletionPresent: Boolean(forecast.data?.sourceProductivityForecastCompletionIso),
      contractorCompletionPresent: Boolean(forecast.data?.sourceForecastCompletionIso),
      cmengCompletionPresent: forecast.data?.independentForecastCompletionIso !== undefined,
      probabilisticPresent: Boolean(forecast.data?.probabilistic)
    },
    windows: {
      windowCount: windows.data?.windowCount ?? null,
      completeWindowCount: windows.data?.completeWindowCount ?? null,
      partialWindowCount: windows.data?.partialWindowCount ?? null,
      grossPositiveDays: windows.data?.positiveProgrammeMovementDays ?? null,
      grossNegativeDays: windows.data?.negativeProgrammeMovementDays ?? null,
      projectCompletionMovementDays: windows.data?.projectCompletionMovementDays ?? null,
      projectCompletionMovementBasis: windows.data?.projectCompletionMovementBasis ?? null,
      positiveIndependentDays: windows.data?.positiveIndependentMovementDays ?? null,
      negativeIndependentDays: windows.data?.negativeIndependentMovementDays ?? null,
      perWindow: Array.isArray(windows.data?.windows)
        ? windows.data.windows.map(window => ({
            sequence: window.sequence,
            sourceForecastMovementDays: window.sourceForecastMovementDays ?? null,
            independentForecastMovementDays: window.independentForecastMovementDays ?? null,
            scheduleBoundaryMovementDays: window.scheduleBoundaryMovementDays ?? null,
            strongestProgrammeMovementDays: window.strongestProgrammeMovementDays ?? null,
            strongestProgrammeMovementBasis: window.strongestProgrammeMovementBasis ?? null,
            linkedDelayEventCount: Array.isArray(window.delayEvents) ? window.delayEvents.length : 0
          }))
        : []
    },
    delayChain: {
      eventCount: delay.data?.eventCount ?? null,
      claimCount: delay.data?.claimCount ?? null,
      claimLinkedEventCount: delay.data?.claimLinkedEventCount ?? null,
      activityLinkedEventCount: delay.data?.activityLinkedEventCount ?? null,
      windowLinkedEventCount: delay.data?.windowLinkedEventCount ?? null,
      noticeLinkedEventCount: delay.data?.noticeLinkedEventCount ?? null,
      determinationLinkedEventCount: delay.data?.determinationLinkedEventCount ?? null,
      fullDeterminationChainEventCount: delay.data?.fullDeterminationChainEventCount ?? null
    },
    eot: {
      contractualCompletionPresent: Boolean(eot.data?.contractualCompletionIso),
      officialApprovedEotDays: eot.data?.officialApprovedEotDays ?? null,
      projectCompletionMovementDays: eot.data?.projectCompletionMovementDays ?? null,
      registerDeterminationCount: time?.registerDeterminationCount ?? null,
      registerDeterminationDays: time?.registerDeterminationDays ?? null,
      effectiveDeterminationCount: time?.effectiveDeterminationCount ?? null,
      incorporatedEotDays: time?.incorporatedEotDays ?? null,
      overlapResolution: time?.overlapResolution ?? null
    }
  };

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
  const failedChecks = summary.checks.filter(item => item.status === 'fail');
  if (failedChecks.length > 0) {
    throw new Error(
      'Production accuracy checks failed: ' +
      failedChecks.map(item => item.name).join(' | ')
    );
  }
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
