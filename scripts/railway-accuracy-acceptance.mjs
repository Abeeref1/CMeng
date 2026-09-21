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
  if (response.status !== 200) {
    const raw = await response.text();
    let safeError = raw;
    try {
      const parsed = JSON.parse(raw);
      safeError = typeof parsed?.error === 'string' ? parsed.error : raw;
    } catch {}
    throw new Error(
      'GET failed: ' +
      path.replace(/projects\/[^/]+/, 'projects/[redacted]') +
      '\nHTTP ' +
      response.status +
      '\nServer error: ' +
      String(safeError).slice(0, 1200)
    );
  }
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
    for (const label of ["SCH01","SCH02","PDB","IF01","IF02","CL01","EOT01","EOT02","EOT03","L01"]) {
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
      sourceFilename: sourceClass(document) ? (document.sourceFilename ?? null) : null,
      sourceRelativePath: sourceClass(document) ? (document.sourceRelativePath ?? null) : null,
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
  const l01 = before.documents.find(document => sourceClass(document) === 'L01');
  const l01Refresh = l01?.correspondenceNarrativeRefresh;
  check('L01 mixed-PDF OCR refresh covers all low-native-text pages without OCR failure',
    l01Refresh?.totalPages === 180 &&
    l01Refresh?.nativePages === 144 &&
    l01Refresh?.ocrPages === 36 &&
    l01Refresh?.ocrFailedPages === 0);
  check('L01 unresolved-anchor remainder is recorded as source limitation, not manufactured linkage',
    l01Refresh?.unresolvedAnchorCount === 232);
  const commercialModuleKeys = new Set([
    'commercial-overview','cost-forecast','variations-change','payments',
    'cash-flow','commercial-claims-notices','contract-particulars-bonds'
  ]);
  const moduleArea = key => commercialModuleKeys.has(key) ? 'commercial' : 'schedule';
  const modulePath = key => prefix + '/' + moduleArea(key) + '/modules/' + key;
  const moduleReportPath = (key, format) => modulePath(key) + '/report.' + format;
  const module = key => json(modulePath(key));
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
    const report = await json(moduleReportPath(key, 'json'));
    check(key + ': report is generated from the same live governed result', report?.result?.key === key && comparableDigest(report.result.data) === comparableDigest(result.data));
  }
  check('All 29 Project Control pages are traced', modules.size === 29);

  const commercialCapabilityIndex = await json('/api/commercial/capabilities');
  check('C2B2 exposes fourteen controlled Commercial capabilities',
    commercialCapabilityIndex?.phase === 'C2B2' &&
    commercialCapabilityIndex?.capabilityCount === 14 &&
    Array.isArray(commercialCapabilityIndex?.capabilities) &&
    commercialCapabilityIndex.capabilities.map(item => item.key).join('|') ===
      'commercial-terms|cost-register|payment-register|cbs-breakdown|cost-control|evm-performance|cash-flow-register|cost-scurve|variations|site-instructions|contract-obligations|liquidated-damages|bonds-insurance|retention-calendar');
  const commercialCapabilityKeys = [
    'commercial-terms','cost-register','payment-register','cbs-breakdown',
    'cost-control','evm-performance','cash-flow-register','cost-scurve',
    'variations','site-instructions','contract-obligations','liquidated-damages',
    'bonds-insurance','retention-calendar'
  ];
  const commercialCapabilities = new Map();
  for (const key of commercialCapabilityKeys) {
    const result = await json(prefix + '/commercial/capabilities/' + key);
    commercialCapabilities.set(key, result);
    check(key + ': live Commercial capability resolves',
      result?.key === key && result?.status !== 'blocked' && result?.data?.capabilityKey === key);
    check(key + ': live Commercial capability has no non-finite serialization marker',
      !/NaN|Infinity/.test(JSON.stringify(result?.data)));
  }
  check('Commercial management views consume canonical foundation performance and contract-control producers',
    modules.get('commercial-overview')?.data?.position?.foundation?.producerVersion === 'commercial-foundation-v1' &&
    modules.get('cost-forecast')?.data?.position?.foundation?.producerVersion === 'commercial-foundation-v1' &&
    modules.get('cost-forecast')?.data?.position?.performance?.producerVersion === 'commercial-performance-v1' &&
    modules.get('variations-change')?.data?.position?.contractControls?.producerVersion === 'commercial-contract-controls-v1' &&
    modules.get('payments')?.data?.position?.foundation?.producerVersion === 'commercial-foundation-v1' &&
    modules.get('cash-flow')?.data?.position?.performance?.producerVersion === 'commercial-performance-v1' &&
    modules.get('contract-particulars-bonds')?.data?.position?.contractControls?.producerVersion === 'commercial-contract-controls-v1');

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
  check('Every controlled delay window publishes net completion and independent analytical movement',
    Array.isArray(windows.data?.windows) &&
    windows.data.windows.length > 0 &&
    windows.data.windows.every(window =>
      Object.prototype.hasOwnProperty.call(window,'netCompletionMovementDays') &&
      Object.prototype.hasOwnProperty.call(window,'netCompletionMovementBasis') &&
      Object.prototype.hasOwnProperty.call(window,'grossAnalyticalMovementDays') &&
      Object.prototype.hasOwnProperty.call(window,'analyticalRecoveryMovementDays') &&
      Object.prototype.hasOwnProperty.call(window,'analyticalVsNetDeltaDays') &&
      Object.prototype.hasOwnProperty.call(window,'overlapCandidateDays')));
  check('Cumulative gross analytical movement is calculated and source values are reconciliation-only',
    windows.data?.grossAnalyticalMovementDays === windows.data?.positiveProgrammeMovementDays &&
    windows.data?.sourceMovementReconciliation?.state !== undefined);
  check('Cumulative overlap reconciles analytical gross to positive net completion movement',
    windows.data?.overlapCandidateDays !== null &&
    Math.abs(
      windows.data.overlapCandidateDays -
      Math.max(0, windows.data.grossAnalyticalMovementDays - Math.max(0, windows.data.projectCompletionMovementDays))
    ) <= 0.000001);

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
  const activityAccepted = delay.data?.activityCorrespondenceAcceptedCount ?? 0;
  const activityCandidate = delay.data?.activityCorrespondenceCandidateCount ?? 0;
  const activityAmbiguous = delay.data?.activityCorrespondenceAmbiguousCount ?? 0;
  const activityUnresolved = delay.data?.activityCorrespondenceUnresolvedCount ?? 0;
  const activityLinked = delay.data?.activityLinkedEventCount ?? 0;
  check('Activity linkage benchmark follows source-supported evidence, not a minimum linkage percentage',
    activityAccepted + activityCandidate + activityAmbiguous + activityUnresolved === delay.data?.eventCount &&
    activityLinked === activityAccepted &&
    events
      .filter(e => ['ambiguous','candidate','unresolved'].includes(e.activityCorrespondence?.classification))
      .every(e => !Array.isArray(e.relatedActivityIds) || e.relatedActivityIds.length === 0));
  check('Accepted activity correspondence, when source-supported, carries bounded provenance and classification',
    events
      .filter(e => Array.isArray(e.relatedActivityIds) && e.relatedActivityIds.length > 0)
      .every(e =>
        e.activityCorrespondence &&
        Array.isArray(e.activityCorrespondence.acceptedActivityIds) &&
        e.activityCorrespondence.acceptedActivityIds.length > 0 &&
        e.activityCorrespondence.boundedCandidateCount <= 12 &&
        typeof e.activityCorrespondence.scheduleRevisionId === 'string' &&
        Array.isArray(e.activityCorrespondence.claimEvidenceRefs) &&
        e.activityCorrespondence.claimEvidenceRefs.length > 0 &&
        Array.isArray(e.activityCorrespondence.candidates) &&
        e.activityCorrespondence.candidates
          .filter(candidate => e.activityCorrespondence.acceptedActivityIds.includes(candidate.activityId))
          .every(candidate => Array.isArray(candidate.activitySourceRefs) && candidate.activitySourceRefs.length > 0)));
  check('Ambiguous candidate or unresolved correspondence fails closed',
    events
      .filter(e => ['ambiguous','candidate','unresolved'].includes(e.activityCorrespondence?.classification))
      .every(e => !Array.isArray(e.relatedActivityIds) || e.relatedActivityIds.length === 0));
  check('Delay-event windows are represented in the canonical chain', delay.data?.windowLinkedEventCount > 0 && events.some(e => Array.isArray(e.overlappingWindowIds) && e.overlappingWindowIds.length > 0));
  check('Delay-event notices are represented in the canonical chain', delay.data?.noticeLinkedEventCount > 0 && events.some(e => Array.isArray(e.noticeIds) && e.noticeIds.length > 0));
  check('All 16 Engineer determinations remain linked to governed events', delay.data?.determinationLinkedEventCount > 0 && new Set(events.flatMap(e => e.determinationIds ?? [])).size === 16);
  const determinationEvents = events.filter(e => Array.isArray(e.determinationIds) && e.determinationIds.length > 0);
  check('Determination-chain benchmark is evidence-complete and accepts explicit source-limited incompleteness',
    (delay.data?.fullDeterminationChainEventCount ?? 0) +
      (delay.data?.determinationChainIncompleteEventCount ?? 0) === determinationEvents.length &&
    determinationEvents.every(e =>
      e.evidenceChainState === 'full_determination_chain' ||
      (e.evidenceChainState === 'determination_chain_incomplete' &&
        Array.isArray(e.evidenceChainMissingLinks) &&
        e.evidenceChainMissingLinks.length > 0)));
  check('When activity evidence is not established, determination chains fail closed instead of fabricating schedule links',
    activityLinked > 0 ||
    ((delay.data?.fullDeterminationChainEventCount ?? 0) === 0 &&
      determinationEvents.every(e =>
        e.evidenceChainState === 'determination_chain_incomplete' &&
        Array.isArray(e.evidenceChainMissingLinks) &&
        e.evidenceChainMissingLinks.includes('activity'))));
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
      sourceProductivityCompletionIso: forecast.data?.sourceProductivityForecastCompletionIso ?? null,
      sourceProductivityMethod: forecast.data?.sourceProductivityForecastMethod ?? null,
      sourceProductivityDriverWorkPackageId: forecast.data?.sourceProductivityForecastDriverWorkPackageId ?? null,
      sourceProductivityWorkPackageCount: forecast.data?.sourceProductivityForecastWorkPackageCount ?? null,
      sourceProductivityCalculatedWorkPackageCount: forecast.data?.sourceProductivityForecastCalculatedWorkPackageCount ?? null,
      sourceProductivityCoveragePercent: forecast.data?.sourceProductivityForecastCoveragePercent ?? null,
      sourceProductivityReconciliation: forecast.data?.sourceProductivityForecastReconciliation ?? null,
      sourceProductivityDiagnostics: forecast.data?.sourceProductivityForecastEvidence?.diagnostics ?? [],
      sourceProductivityRowsSample: Array.isArray(forecast.data?.sourceProductivityForecastEvidence?.rows)
        ? forecast.data.sourceProductivityForecastEvidence.rows.slice(0, 5).map(row => ({
            workPackageId: row.workPackageId ?? null,
            state: row.state ?? null,
            calendarId: row.calendarId ?? null,
            remainingQuantity: row.remainingQuantity ?? null,
            actualHours: row.actualHours ?? null,
            evidencedRatePerHour: row.evidencedRatePerHour ?? null,
            rateBasis: row.rateBasis ?? null,
            allowanceHours: row.allowanceHours ?? null,
            allowanceWorkingDays: row.allowanceWorkingDays ?? null,
            allowanceCalendarDays: row.allowanceCalendarDays ?? null,
            completionIso: row.completionIso ?? null,
            diagnostics: row.diagnostics ?? []
          }))
        : [],
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
      grossAnalyticalMovementDays: windows.data?.grossAnalyticalMovementDays ?? null,
      analyticalRecoveryMovementDays: windows.data?.analyticalRecoveryMovementDays ?? null,
      analyticalVsNetDeltaDays: windows.data?.analyticalVsNetDeltaDays ?? null,
      overlapCandidateDays: windows.data?.overlapCandidateDays ?? null,
      analyticalMovementAvailableWindowCount: windows.data?.analyticalMovementAvailableWindowCount ?? null,
      sourceReportedGrossPositiveMovementDays: windows.data?.sourceReportedGrossPositiveMovementDays ?? null,
      sourceReportedGrossNegativeMovementDays: windows.data?.sourceReportedGrossNegativeMovementDays ?? null,
      sourceMovementReconciliation: windows.data?.sourceMovementReconciliation ?? null,
      perWindow: Array.isArray(windows.data?.windows)
        ? windows.data.windows.map(window => ({
            sequence: window.sequence,
            sourceForecastMovementDays: window.sourceForecastMovementDays ?? null,
            independentForecastMovementDays: window.independentForecastMovementDays ?? null,
            netCompletionMovementDays: window.netCompletionMovementDays ?? null,
            netCompletionMovementBasis: window.netCompletionMovementBasis ?? null,
            grossAnalyticalMovementDays: window.grossAnalyticalMovementDays ?? null,
            analyticalRecoveryMovementDays: window.analyticalRecoveryMovementDays ?? null,
            analyticalVsNetDeltaDays: window.analyticalVsNetDeltaDays ?? null,
            overlapCandidateDays: window.overlapCandidateDays ?? null,
            scheduleBoundaryMovementDays: window.scheduleBoundaryMovementDays ?? null,
            strongestPositiveActivityMovementDays: window.strongestPositiveActivityMovementDays ?? null,
            strongestPositiveActivityId: window.strongestPositiveActivityId ?? null,
            activityFinishShiftCoveragePercent: window.activityFinishShiftCoveragePercent ?? null,
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
      fullDeterminationChainEventCount: delay.data?.fullDeterminationChainEventCount ?? null,
      determinationChainIncompleteEventCount: delay.data?.determinationChainIncompleteEventCount ?? null,
      activityEvidenceInsufficientEventCount: delay.data?.activityEvidenceInsufficientEventCount ?? null,
      activityCorrespondenceAcceptedCount: delay.data?.activityCorrespondenceAcceptedCount ?? null,
      activityCorrespondenceCandidateCount: delay.data?.activityCorrespondenceCandidateCount ?? null,
      activityCorrespondenceAmbiguousCount: delay.data?.activityCorrespondenceAmbiguousCount ?? null,
      activityCorrespondenceUnresolvedCount: delay.data?.activityCorrespondenceUnresolvedCount ?? null,
      activityCorrespondenceSample: Array.isArray(events)
        ? events.filter(event => event.activityCorrespondence).slice(0,8).map(event => ({
            eventId: event.eventId,
            classification: event.activityCorrespondence?.classification ?? null,
            aiStage: event.activityCorrespondence?.aiStage ?? null,
            acceptedActivityIds: event.activityCorrespondence?.acceptedActivityIds ?? [],
            candidateActivityIds: event.activityCorrespondence?.candidateActivityIds ?? [],
            activityPoolCount: event.activityCorrespondence?.activityPoolCount ?? null,
            claimSignalTokenCount: event.activityCorrespondence?.claimSignalTokenCount ?? null,
            claimSignalCodeCount: event.activityCorrespondence?.claimSignalCodeCount ?? null,
            prefilterRawCandidateCount: event.activityCorrespondence?.prefilterRawCandidateCount ?? null,
            preFilterCandidateCount: event.activityCorrespondence?.preFilterCandidateCount ?? null,
            boundedCandidateCount: event.activityCorrespondence?.boundedCandidateCount ?? null,
            topCandidates: Array.isArray(event.activityCorrespondence?.candidates)
              ? event.activityCorrespondence.candidates.slice(0,3).map(candidate => ({
                  activityId: candidate.activityId,
                  prefilterScore: candidate.prefilterScore,
                  aiScore: candidate.aiScore,
                  finalScore: candidate.finalScore,
                  marginToNext: candidate.marginToNext,
                  classification: candidate.classification,
                  authority: candidate.authority
                }))
              : []
          }))
        : []
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
    const report = await json(moduleReportPath(key, 'json'));
    check(key + ': JSON export matches the live position', digest(report.result?.data?.position?.sourceLedger) === sourceDigest);
    if (key === 'payments') {
      check('Payment stages preserve missing cash as unknown', ledger.payments.length > 0 && ledger.payments.every(p => p.amounts.paidAmount.value !== null || p.calculatedOutstandingAmount?.value === null));
    }
    if (['cost-forecast','payments','variations-change'].includes(key)) {
      const response = await get(moduleReportPath(key, 'xlsx'));
      check(key + ': downloadable Excel content type', (response.headers.get('content-type') ?? '').includes('spreadsheetml'));
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
      check(key + ': Excel opens with populated worksheets', workbook.worksheets.length > 0 && workbook.worksheets.some(s => s.rowCount > 1));
    }
  }

  // Commercial actual-result reconciliation: canonical source -> capability -> management result.
  const commercialPosition = modules.get('commercial-overview')?.data?.position;
  const commercialLedger = commercialPosition?.sourceLedger;
  const foundation = commercialPosition?.foundation;
  const performance = commercialPosition?.performance;
  const contractControls = commercialPosition?.contractControls;
  const approx = (a, b, tolerance = 0.000001) =>
    typeof a === 'number' && Number.isFinite(a) &&
    typeof b === 'number' && Number.isFinite(b) &&
    Math.abs(a - b) <= tolerance;
  const normalMetric = value => String(value ?? '')
    .trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const metricValue = (values, aliases) => {
    const normalized = new Map(
      Object.entries(values ?? {}).map(([key, value]) => [normalMetric(key), value])
    );
    for (const alias of aliases) {
      if (normalized.has(normalMetric(alias))) return normalized.get(normalMetric(alias));
    }
    return null;
  };
  const findingValue = finding => finding?.value ?? null;
  const paymentStageNames = [
    'applicationAmount','engineerAssessedAmount','employerCertifiedAmount',
    'grossWork','variations','retentionDeduction','advanceRecovery',
    'otherDeduction','taxAmount','netCertifiedAmount','paidAmount','outstandingAmount'
  ];

  check('Commercial actual trace uses the canonical source ledger',
    commercialLedger?.producerVersion === 'commercial-canonical-v1' &&
    foundation?.producerVersion === 'commercial-foundation-v1' &&
    performance?.producerVersion === 'commercial-performance-v1' &&
    contractControls?.producerVersion === 'commercial-contract-controls-v1');

  // Tier 1: Cost Register / CBS must account for every canonical cost source row.
  const sourceCostRows = Array.isArray(commercialLedger?.costMetrics) ? commercialLedger.costMetrics : [];
  const mappedCostRows = sourceCostRows.filter(row => Boolean(row.cbsId)).length;
  check('Cost Register source-row population reconciles to canonical Commercial evidence',
    foundation?.costRegister?.mappedCbsRecordCount === mappedCostRows &&
    foundation?.costRegister?.unmappedCbsRecordCount === sourceCostRows.length - mappedCostRows &&
    (
      sourceCostRows.length === 0
        ? foundation?.costRegister?.mappingCoveragePercent === null
        : approx(foundation?.costRegister?.mappingCoveragePercent, mappedCostRows / sourceCostRows.length * 100, 0.01)
    ));
  check('CBS mapping population reconciles to the Cost Register',
    foundation?.cbsBreakdown?.unmappedCostMetricCount === sourceCostRows.length - mappedCostRows &&
    foundation?.cbsBreakdown?.mappingCoveragePercent === foundation?.costRegister?.mappingCoveragePercent);

  // Tier 1: Payment Register is a stage-preserving view of the actual canonical source rows.
  const sourcePayments = Array.isArray(commercialLedger?.payments) ? commercialLedger.payments : [];
  const paymentRows = Array.isArray(foundation?.paymentRegister?.rows) ? foundation.paymentRegister.rows : [];
  check('Payment Register population exactly matches canonical payment records',
    foundation?.paymentRegister?.recordCount === sourcePayments.length &&
    paymentRows.length === sourcePayments.length &&
    new Set(paymentRows.map(row => row.paymentId)).size === paymentRows.length &&
    sourcePayments.every(source => paymentRows.some(row => row.paymentId === source.paymentId)));
  check('Payment stage values and amount bases remain source-identical',
    sourcePayments.every(source => {
      const row = paymentRows.find(item => item.paymentId === source.paymentId);
      if (!row) return false;
      const stagesMatch = paymentStageNames.every(name =>
        findingValue(row.amounts?.[name]) === (source.amounts?.[name]?.value ?? null)
      );
      return stagesMatch &&
        row.certifiedAmountBasis === source.certifiedAmountBasis &&
        row.paidAmountBasis === source.paidAmountBasis &&
        row.periodEnd === source.periodEnd &&
        row.lifecycle?.applicationDate === source.applicationDate &&
        row.lifecycle?.assessmentDate === source.assessmentDate &&
        row.lifecycle?.certificationDate === source.certificationDate &&
        row.lifecycle?.paymentDate === source.paymentDate;
    }));
  check('Missing payment stages are never copied from another stage',
    sourcePayments.every(source => {
      const row = paymentRows.find(item => item.paymentId === source.paymentId);
      return row && paymentStageNames.every(name =>
        (source.amounts?.[name]?.value !== null && source.amounts?.[name]?.value !== undefined) ||
        findingValue(row.amounts?.[name]) === null
      );
    }));

  // Contract values: each currency position must reconcile its own original + approved change basis.
  const contractTermRows = Array.isArray(foundation?.commercialTerms?.originalContractValueByCurrency)
    ? foundation.commercialTerms.originalContractValueByCurrency
    : [];
  check('Commercial Terms current contract value reconciles per currency without pending-change addition',
    contractTermRows.every(row => {
      const original = findingValue(row.original);
      const approved = findingValue(row.approvedVariations);
      const current = findingValue(row.current);
      if (original === null) return current === null;
      return approx(current, original + (approved ?? 0), 0.01);
    }));

  // C2B1: latest source cost snapshot must be the exact basis of Cost Control.
  const sourceCostPositions = Array.isArray(commercialLedger?.costPosition) ? commercialLedger.costPosition : [];
  const costPositions = Array.isArray(performance?.costControl?.positions) ? performance.costControl.positions : [];
  const sourceByBasis = new Map();
  for (const source of sourceCostPositions) {
    const key = source.currency + '|' + source.taxBasis;
    const prior = sourceByBasis.get(key);
    if (!prior || String(prior.asOf) < String(source.asOf)) sourceByBasis.set(key, source);
  }
  check('Cost Control current positions use the latest canonical source period for each currency/tax basis',
    costPositions.length === sourceByBasis.size &&
    costPositions.every(position => {
      const source = sourceByBasis.get(position.currency + '|' + position.taxBasis);
      return source && source.asOf === position.asOf;
    }));

  const costEquationsPass = costPositions.every(position => {
    const source = sourceByBasis.get(position.currency + '|' + position.taxBasis);
    if (!source) return false;
    const bac = metricValue(source.values, ['bac','budget at completion','approved budget','current control budget']);
    const pv = metricValue(source.values, ['pv','planned value']);
    const ev = metricValue(source.values, ['ev','earned value']);
    const ac = metricValue(source.values, ['ac','actual cost','actual incurred cost']);
    const eac = metricValue(source.values, ['eac','estimate at completion','forecast final cost','current forecast']);

    if (
      findingValue(position.bac) !== bac ||
      findingValue(position.pv) !== pv ||
      findingValue(position.ev) !== ev ||
      findingValue(position.ac) !== ac ||
      findingValue(position.sourceEac) !== eac
    ) return false;

    if (position.taxBasis === 'unknown') {
      return findingValue(position.spi) === null &&
        findingValue(position.cpi) === null &&
        findingValue(position.sv) === null &&
        findingValue(position.cv) === null &&
        findingValue(position.calculatedVac) === null;
    }

    const expectedSpi = ev !== null && pv !== null && pv !== 0 ? ev / pv : null;
    const expectedCpi = ev !== null && ac !== null && ac !== 0 ? ev / ac : null;
    const expectedSv = ev !== null && pv !== null ? ev - pv : null;
    const expectedCv = ev !== null && ac !== null ? ev - ac : null;
    const expectedVac = bac !== null && eac !== null ? bac - eac : null;
    const compareNullable = (actual, expected) =>
      expected === null ? actual === null : approx(actual, expected, 0.00001);
    return compareNullable(findingValue(position.spi), expectedSpi) &&
      compareNullable(findingValue(position.cpi), expectedCpi) &&
      compareNullable(findingValue(position.sv), expectedSv) &&
      compareNullable(findingValue(position.cv), expectedCv) &&
      compareNullable(findingValue(position.calculatedVac), expectedVac);
  });
  check('Cost Control BAC/PV/EV/AC/EAC and EVM equations reconcile independently to source', costEquationsPass);

  check('Source EAC remains distinct from non-official CMeng forecast scenarios',
    costPositions.every(position => {
      const scenarios = Array.isArray(position.eacScenarios) ? position.eacScenarios : [];
      const sourceScenario = scenarios.find(row => row.method === 'source_reported');
      return (
        findingValue(position.sourceEac) === null ||
        (
          sourceScenario &&
          findingValue(sourceScenario.value) === findingValue(position.sourceEac) &&
          sourceScenario.official === (position.sourceEac.state === 'established')
        )
      ) &&
      scenarios.filter(row => row.method !== 'source_reported').every(row => row.official === false);
    }));

  // Time-phased EVM and Cost S-Curve must be direct source-snapshot consumers.
  const sourcePointMap = new Map(
    sourceCostPositions.map(source => [
      [source.currency, source.taxBasis, source.asOf].join('|'),
      source
    ])
  );
  const evmSeries = Array.isArray(performance?.evmPerformance?.series) ? performance.evmPerformance.series : [];
  check('EVM curve points reconcile one-for-one to canonical dated cost snapshots',
    evmSeries.every(series =>
      Array.isArray(series.points) &&
      series.points.every(point => {
        const source = sourcePointMap.get([series.currency, series.taxBasis, point.asOf].join('|'));
        if (!source) return false;
        return findingValue(point.pv) === metricValue(source.values, ['pv','planned value']) &&
          findingValue(point.ev) === metricValue(source.values, ['ev','earned value']) &&
          findingValue(point.ac) === metricValue(source.values, ['ac','actual cost','actual incurred cost']) &&
          (
            series.taxBasis !== 'unknown' ||
            (
              findingValue(point.spi) === null &&
              findingValue(point.cpi) === null &&
              findingValue(point.sv) === null &&
              findingValue(point.cv) === null
            )
          );
      })
    ));
  const costScurveSeries = Array.isArray(performance?.costScurve?.series) ? performance.costScurve.series : [];
  check('Cost S-Curve source positions reconcile to canonical PV/EV/AC/EAC snapshots',
    costScurveSeries.every(series =>
      Array.isArray(series.points) &&
      series.points.every(point => {
        const source = sourcePointMap.get([series.currency, series.taxBasis, point.asOf].join('|'));
        if (!source) return false;
        return findingValue(point.plannedCost) === metricValue(source.values, ['pv','planned value']) &&
          findingValue(point.earnedValue) === metricValue(source.values, ['ev','earned value']) &&
          findingValue(point.actualCost) === metricValue(source.values, ['ac','actual cost','actual incurred cost']) &&
          findingValue(point.sourceEac) === metricValue(source.values, ['eac','estimate at completion','forecast final cost','current forecast']) &&
          (series.taxBasis !== 'unknown' || findingValue(point.remainingCost) === null);
      })
    ));

  // Cash: only explicit incremental or project-cumulative source bases may create project totals.
  const cashCurrencies = Array.isArray(performance?.cashFlow?.currencies) ? performance.cashFlow.currencies : [];
  const safePaymentBasis = value => value === 'incremental' || value === 'project_cumulative';
  const cashBasisPass = cashCurrencies.every(cash => {
    const paidSource = sourcePayments
      .filter(payment =>
        (payment.amounts?.paidAmount?.currency ?? null) === cash.currency &&
        payment.amounts?.paidAmount?.value !== null &&
        payment.paymentDate &&
        (!commercialLedger?.dataDateIso || payment.paymentDate <= commercialLedger.dataDateIso)
      )
      .sort((a,b) => String(a.paymentDate).localeCompare(String(b.paymentDate)));
    const certifiedSource = sourcePayments
      .map(payment => {
        const amount = payment.amounts?.employerCertifiedAmount?.value !== null
          ? payment.amounts?.employerCertifiedAmount
          : payment.amounts?.netCertifiedAmount;
        return { payment, amount };
      })
      .filter(({payment, amount}) =>
        (amount?.currency ?? null) === cash.currency &&
        amount?.value !== null &&
        (payment.certificationDate ?? payment.periodEnd) &&
        (!commercialLedger?.dataDateIso || String(payment.certificationDate ?? payment.periodEnd) <= commercialLedger.dataDateIso)
      )
      .sort((a,b) => String(a.payment.certificationDate ?? a.payment.periodEnd).localeCompare(String(b.payment.certificationDate ?? b.payment.periodEnd)));

    const paidBases = new Set(paidSource.map(payment => payment.paidAmountBasis));
    const certifiedBases = new Set(certifiedSource.map(({payment}) => payment.certifiedAmountBasis));
    const paidEntries = (cash.entries ?? []).filter(entry => entry.kind === 'paid_income');
    const certifiedEntries = (cash.entries ?? []).filter(entry => entry.kind === 'certified_income');

    const checkSeries = (sources, bases, entries, totalFinding, basisGetter, valueGetter) => {
      if (!sources.length) return findingValue(totalFinding) === null && entries.length === 0;
      if (bases.size !== 1 || !safePaymentBasis([...bases][0])) {
        return findingValue(totalFinding) === null && entries.length === 0;
      }
      const basis = [...bases][0];
      const sourceValues = sources.map(valueGetter);
      const expectedTotal = basis === 'incremental'
        ? sourceValues.reduce((sum, value) => sum + value, 0)
        : sourceValues.at(-1);
      const entryValues = entries.map(entry => findingValue(entry.amount));
      return approx(findingValue(totalFinding), expectedTotal, 0.01) &&
        approx(entryValues.reduce((sum,value) => sum + value, 0), expectedTotal, 0.01) &&
        (
          basis !== 'project_cumulative' ||
          entryValues.every(value => typeof value === 'number' && value >= -0.01)
        );
    };

    return checkSeries(
      paidSource,
      paidBases,
      paidEntries,
      cash.paidIncome,
      payment => payment.paidAmountBasis,
      payment => payment.amounts.paidAmount.value
    ) && checkSeries(
      certifiedSource,
      certifiedBases,
      certifiedEntries,
      cash.certifiedIncome,
      row => row.payment.certifiedAmountBasis,
      row => row.amount.value
    );
  });
  check('Cash Flow totals obey actual payment series basis and never sum unknown/certificate-cumulative balances', cashBasisPass);
  check('Cash Flow entries with paid income always carry an actual payment date',
    cashCurrencies.every(cash =>
      (cash.entries ?? [])
        .filter(entry => entry.kind === 'paid_income')
        .every(entry => typeof entry.periodDate === 'string' && entry.periodDate.length >= 10)
    ));

  // C2B2 source registers: no invented lifecycle identities or explicit compliance records.
  const sourceVariations = Array.isArray(commercialLedger?.variations) ? commercialLedger.variations : [];
  const variationRows = Array.isArray(contractControls?.variations?.rows) ? contractControls.variations.rows : [];
  check('Variation lifecycle population and identities reconcile to canonical source records',
    variationRows.length === sourceVariations.length &&
    sourceVariations.every(source => variationRows.some(row => row.variationId === source.variationId)));
  const sourceInstructions = Array.isArray(commercialLedger?.siteInstructions) ? commercialLedger.siteInstructions : [];
  const instructionRows = Array.isArray(contractControls?.siteInstructions?.rows) ? contractControls.siteInstructions.rows : [];
  check('Site Instruction population and identities reconcile to canonical source records',
    instructionRows.length === sourceInstructions.length &&
    sourceInstructions.every(source => instructionRows.some(row => row.instructionId === source.instructionId)));
  const sourceObligations = Array.isArray(commercialLedger?.obligations) ? commercialLedger.obligations : [];
  const obligationRows = Array.isArray(contractControls?.contractObligations?.rows) ? contractControls.contractObligations.rows : [];
  const explicitObligations = obligationRows.filter(row => row.origin === 'explicit_register');
  const candidateObligations = obligationRows.filter(row => row.origin === 'contract_clause_candidate');
  check('Explicit Contract Obligation population is source-identical and clause candidates remain separate',
    explicitObligations.length === sourceObligations.length &&
    contractControls?.contractObligations?.explicitRecordCount === sourceObligations.length &&
    candidateObligations.length === (contractControls?.contractObligations?.clauseCandidateCount ?? -1) &&
    sourceObligations.every(source => explicitObligations.some(row => row.obligationId === source.obligationId)) &&
    candidateObligations.every(row => row.status === 'candidate' && row.dueDate === null));
  const sourceInsurances = Array.isArray(commercialLedger?.insurances) ? commercialLedger.insurances : [];
  check('Insurance control population reconciles to canonical insurance source records',
    (contractControls?.bondsInsurance?.insurances?.length ?? 0) === sourceInsurances.length &&
    sourceInsurances.every(source => contractControls.bondsInsurance.insurances.some(row => row.policyId === source.policyId)));
  const sourceRetentions = Array.isArray(commercialLedger?.retentions) ? commercialLedger.retentions : [];
  const explicitRetentionRows = (contractControls?.retentionCalendar?.rows ?? []).filter(row => row.origin === 'explicit_register');
  check('Explicit retention calendar population reconciles to canonical retention source records',
    explicitRetentionRows.length === sourceRetentions.length &&
    sourceRetentions.every(source => explicitRetentionRows.some(row => row.retentionId === source.retentionId)));

  // LD scenario mechanics are checked independently from the producer.
  const ldScenarios = Array.isArray(contractControls?.liquidatedDamages?.scenarios)
    ? contractControls.liquidatedDamages.scenarios
    : [];
  const DAY_MS = 86400000;
  check('LD exposure days reconcile adjusted completion to programme completion for every established scenario',
    ldScenarios.every(row => {
      const adjusted = findingValue(row.adjustedCompletion);
      const forecast = findingValue(row.forecastCompletion);
      const exposure = findingValue(row.exposureDays);
      if (!adjusted || !forecast) return exposure === null;
      const expected = Math.max(0, Math.round((Date.parse(forecast) - Date.parse(adjusted)) / DAY_MS));
      return exposure === expected;
    }));
  check('LD cap application never exceeds uncapped exposure or the established cap',
    ldScenarios.every(row => {
      const uncapped = findingValue(row.uncappedExposure);
      const cap = findingValue(row.capAmount);
      const capped = findingValue(row.cappedExposure);
      if (uncapped === null || cap === null) return capped === null;
      return approx(capped, Math.min(uncapped, cap), 0.01);
    }));

  summary.commercialActualTrace = {
    canonicalCostRows: sourceCostRows.length,
    costControlPositionCount: costPositions.length,
    paymentRecordCount: sourcePayments.length,
    variationRecordCount: sourceVariations.length,
    siteInstructionRecordCount: sourceInstructions.length,
    explicitObligationRecordCount: sourceObligations.length,
    clauseObligationCandidateCount: candidateObligations.length,
    insuranceRecordCount: sourceInsurances.length,
    explicitRetentionRecordCount: sourceRetentions.length,
    cashCurrencyCount: cashCurrencies.length,
    evmSeriesCount: evmSeries.length,
    costScurveSeriesCount: costScurveSeries.length
  };

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
