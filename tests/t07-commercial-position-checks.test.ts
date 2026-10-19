import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {buildCommercialFoundation} from '../packages/commercial-foundation/src';
import {buildCommercialPerformance} from '../packages/commercial-performance/src';
import {buildContractControls, variationRegisterState, type ContractControlsInput} from '../packages/commercial-contract-controls/src';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {commercialContractControlsForState} from '../packages/runtime-api/src/commercial-contract-controls-runtime';
import {commercialPositionForState} from '../packages/runtime-api/src/commercial-runtime';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// SW-21 and SW-31 (T07): commercial position checks.
// SW-21: the variation position counts every variation in the change register by
// state; an approved-only list does not establish the full change register.
// SW-31: an implausible source EAC is challenged against CMeng's independent EVM
// calculation under stated rules, with both values shown; it is never replaced.
const root = path.resolve(__dirname, '..', '..');
const {evm} = require(path.join(root, 'tools/independent/evm.cjs'));

const dataDateIso = '2026-08-31', generatedAt = '2026-10-19T00:00:00.000Z';
const money = (value: number | null) => ({value, currency: 'AED', state: value === null ? 'missing' as const : 'official' as const, asOf: value === null ? null : '2026-05-30', sourceRefs: [] as string[]});
const missing = () => ({value: null, basis: {asOfDate: dataDateIso, method: 'test', sourceRefs: []}, coverage: {known: 0, total: 1, percent: 0},
  authority: 'missing' as const, submitted: null, independent: null, gap: null, consequence: null, action: null, state: 'missing' as const, diagnostics: []});
const variation = (variationId: string, status: string, dates: Partial<Record<'instructionDate' | 'submittedDate' | 'quotationDate' | 'assessedDate' | 'agreedDate' | 'approvalDate', string>>, approved: number | null = null) => ({
  variationId, description: variationId, status, authority: 'Engineer', instructionId: null, instructionDate: null, submittedDate: null,
  quotationDate: null, assessedDate: null, agreedDate: null, approvalDate: null, ...dates, scheduleImpactDays: null, claimId: null, paymentId: null,
  activityIds: [], clauseIdentifiers: [], claimedAmount: money(null), assessedAmount: money(null), agreedAmount: money(null), approvedAmount: money(approved),
  sourceRefs: ['test:' + variationId]});
const controls = (variations: ReturnType<typeof variation>[]) => buildContractControls({projectId: 'T07-SW21', generatedAt, dataDateIso,
  variations, siteInstructions: [], obligations: [], contractClauses: [], bonds: [], insurances: [], retentions: [], existingRetentions: [], paymentRetentions: [],
  retentionPercent: missing(), retentionCapPercent: missing(), performanceBondRequirement: missing(), advancePaymentBondRequirement: missing(),
  insuranceRequirementCount: 0, ldTerms: null, contractValues: [], sectionTerms: [],
  ldTime: {contractualCompletionIso: null, contractualCompletionState: 'missing', programmeCompletionIso: null, programmeCompletionMethod: 'none',
    programmeSourceRefs: [], awardedEotDays: null, awardedEotState: 'missing', awardedOverlapResolution: 'unresolved', eotSourceRefs: []}} as unknown as ContractControlsInput).variations;

test('SW-21 variation position: every change counted by state; an approved-only list is not the full change register', () => {
  // A full change register: one change in each state.
  const full = controls([
    variation('VO-1', 'Submitted', {submittedDate: '2026-06-01'}),
    variation('VO-2', 'Under review', {submittedDate: '2026-06-02', assessedDate: '2026-06-20'}),
    variation('VO-3', 'Approved', {submittedDate: '2026-05-01', approvalDate: '2026-05-30'}, 1000),
    variation('VO-4', 'Rejected', {submittedDate: '2026-05-02', approvalDate: '2026-05-31'}),
    variation('VO-5', 'Withdrawn', {submittedDate: '2026-05-03'}),
  ]);
  assert.equal(full.changeRegister.state, 'established');
  assert.equal(full.changeRegister.approvedOnly, false);
  assert.equal(full.changeRegister.recordCount, 5);
  // The fixture carries no instruction ids or dates, so instructions are not distinguished.
  assert.deepEqual(full.changeRegister.stateCounts, {instructed: null, submitted: 1, underReview: 1, approved: 1, rejected: 1, withdrawn: 1, unknown: 0});
  assert.equal(full.rejectedCount, 1);

  // Only an approved list is supplied: approved is counted, every other state is
  // not established (never 0), and the position is not established.
  const approvedList = controls([
    variation('VO-3', 'Approved', {approvalDate: '2026-05-30'}, 1000),
    variation('VO-6', 'Approved', {approvalDate: '2026-07-15'}, 2500),
  ]);
  assert.equal(approvedList.changeRegister.state, 'not_established');
  assert.equal(approvedList.changeRegister.approvedOnly, true);
  assert.deepEqual(approvedList.changeRegister.stateCounts, {instructed: null, submitted: null, underReview: null, approved: 2, rejected: null, withdrawn: null, unknown: null});
  assert.match(approvedList.changeRegister.consequence ?? '', /not the full change register/);
  // The approved list is not presented as an established full variation position.
  assert.notEqual(approvedList.state, 'established');
  assert.equal(approvedList.rejectedCount, null, 'rejections are not established by an approved list');
  assert.equal(approvedList.pendingCount, null, 'pending is not established by an approved list');
  // Approved figures themselves are kept unchanged.
  assert.equal(approvedList.approvedCount, 2);
  assert.equal(approvedList.recordCount, 2);
  assert.equal(approvedList.lifecycleStageCounts.approved, 2);
});

test('SW-31 source EAC: implausible values are challenged beside the independent EVM values, never replaced', () => {
  const foundation = buildCommercialFoundation({projectId: 'T07-SW31', generatedAt, dataDateIso,
    contractValue: null, contractValueCandidates: [], variations: [], contractTimeBasis: null,
    ldTerms: null, contractSections: [], amendments: [], costMetrics: [], payments: []});
  const position = (values: Record<string, number>) => buildCommercialPerformance({projectId: 'T07-SW31', generatedAt, dataDateIso, foundation,
    costSnapshots: [{currency: 'AED', taxBasis: 'exclusive', asOf: dataDateIso, state: 'official', values: {...values}, sourceRefs: ['SRC'], diagnostics: []}],
    costMetrics: [], payments: []}).costControl.positions[0]!;

  // R1: EAC below actual cost to date. Independent range: AC+(BAC-EV)=1100, BAC/CPI=1250.
  const below = {bac: 1000, pv: 500, ev: 400, ac: 500, eac: 450};
  const ind = evm(below);
  const p = position(below);
  assert.equal(p.sourceEac.value, 450, 'source EAC kept as submitted');
  assert.equal(p.sourceEacChallenge.state, 'challenge');
  assert.equal(p.sourceEacChallenge.sourceEac, 450);
  assert.equal(p.sourceEacChallenge.actualCost, 500);
  assert.equal(p.sourceEacChallenge.independentRange!.bacOverCpi, ind.eac.cpi);
  assert.equal(p.sourceEacChallenge.independentRange!.acPlusRemainingBudget, ind.eac.budgetRate);
  assert.deepEqual(p.sourceEacChallenge.findings.map(f => [f.rule, f.severity, f.sourceEac, f.independentValue]),
    [['below_actual_cost', 'implausible', 450, 500], ['outside_independent_range', 'query', 450, 1100]]);
  assert.ok(p.sourceEacChallenge.rules.some(rule => /below actual cost/.test(rule)));

  // R2: above the higher independent forecast is a query (explain), not implausible:
  // a contractor may foresee further overruns.
  const high = position({bac: 1000, pv: 500, ev: 400, ac: 500, eac: 1900});
  assert.equal(high.sourceEacChallenge.state, 'query');
  assert.deepEqual(high.sourceEacChallenge.findings.map(f => [f.rule, f.severity, f.independentValue]), [['outside_independent_range', 'query', 1250]]);
  assert.match(high.sourceEacChallenge.findings[0]!.statement, /above the independent range; explain/);
  assert.equal(high.sourceEac.value, 1900);

  // Inside the independent range: consistent, no challenge.
  const inside = position({bac: 1000, pv: 500, ev: 400, ac: 500, eac: 1100});
  assert.equal(inside.sourceEacChallenge.state, 'consistent');
  assert.deepEqual(inside.sourceEacChallenge.findings, []);

  // No source EAC: nothing to challenge; unknown stays unknown.
  const none = position({bac: 1000, pv: 500, ev: 400, ac: 500});
  assert.equal(none.sourceEacChallenge.state, 'not_assessable');
  assert.equal(none.sourceEacChallenge.sourceEac, null);
});

test('SW-21 withdrawn changes: one state rule gives the same counts in lifecycle fields, change register, page, Ask facts and export data', async () => {
  const state = runtimeProjects.getOrCreate('T07-SW21-WITHDRAWN-' + randomUUID());
  const model: CanonicalScheduleModel = {projectId: state.projectId, source: 'xer', sourceRevisionId: 'CURRENT', dataDateIso: '2031-04-15T18:00:00+04:00',
    wbs: [], relationships: [], calendars: [{calendarId: 'C', name: 'Calendar', standardDayHours: 8, semanticComplete: true, sourceRefs: []}], diagnostics: [], activities: [{
      projectId: state.projectId, activityId: 'WORK', nativeId: '1', name: 'Work', wbsId: null, calendarId: 'C', activityType: 'task', status: 'not_started',
      baselineStartIso: '2031-04-20', baselineFinishIso: '2031-05-01', currentStartIso: '2031-04-20', currentFinishIso: '2031-05-09', actualStartIso: null, actualFinishIso: null,
      forecastStartIso: null, forecastFinishIso: null, originalDurationHours: 40, remainingDurationHours: 40, totalFloatHours: 16, freeFloatHours: null, percentComplete: 0, sourceRefs: [], diagnostics: []}]};
  state.schedules.push({role: 'update', format: 'xer', sourceFilename: 'update.xer', sourceHashSha256: 'test', uploadedAt: '2031-05-01',
    revision: {revisionId: 'CURRENT', label: 'April update', sequence: 1, effectiveAt: '2031-04-15', model}} as ProjectRuntimeState['schedules'][number]);
  state.version++;
  await runtimeProjects.ingestEvidenceFile({projectId: state.projectId, mediaType: 'text/csv', sourceFilename: 'Variations.csv', uploadedAt: '2031-04-15',
    bytes: Buffer.from('Variation ID,Description,Status,Submitted Date,Approval Date,Approved Amount,Claimed Amount,Currency,Tax Basis\n' +
      'S1,Open change,Submitted,2031-04-01,,,100,AED,exclusive\n' +
      'A1,Approved change,Approved,2031-03-01,2031-03-20,500,500,AED,exclusive\n' +
      'R1,Rejected change,Rejected,2031-03-05,,,200,AED,exclusive\n' +
      'W1,Withdrawn change,Withdrawn,2031-03-10,,,300,AED,exclusive')});
  const vo = commercialContractControlsForState(state).variations;
  // Lifecycle fields: the withdrawn change is withdrawn, not submitted or pending.
  assert.equal(vo.rows.find(r => r.variationId === 'W1')!.lifecycleStage, 'withdrawn');
  const lifecycle = vo.lifecycleStageCounts;
  assert.deepEqual([lifecycle.submitted, lifecycle.approved, lifecycle.rejected, lifecycle.withdrawn], [1, 1, 1, 1]);
  assert.equal(vo.knownPendingCount, 1);
  assert.equal(vo.pendingCount, 1);
  assert.equal(vo.rejectedCount, 1);
  assert.equal(vo.approvedCount, 1);
  // Change register: the same counts, from the same rule.
  const reg = vo.changeRegister.stateCounts;
  assert.deepEqual({submitted: reg.submitted, underReview: reg.underReview, approved: reg.approved, rejected: reg.rejected, withdrawn: reg.withdrawn, unknown: reg.unknown},
    {submitted: 1, underReview: 0, approved: 1, rejected: 1, withdrawn: 1, unknown: 0});
  // The source has no instruction id or date, so instructions are not a separate count.
  assert.equal(reg.instructed, null);
  for (const row of vo.rows) assert.notEqual(variationRegisterState(row.lifecycleStage), 'unknown', row.variationId);
  // Pending money excludes the withdrawn change (100, not 100 + 300); registers count it as withdrawn.
  const position = commercialPositionForState(state);
  assert.equal(position.currencies.find(r => r.currency === 'AED')!.pendingVariationAmount.value, 100);
  // Ask reads the shared project facts.
  const facts = projectFactsForState(state).commercial;
  assert.deepEqual([facts.pendingVariationCount.value, facts.approvedVariationCount.value, facts.rejectedVariationCount.value], [1, 1, 1]);
  // Variations page and its export data carry the same projection.
  const page = moduleForProject(state.projectId, 'variations-change').data as any;
  for (const control of [page.focus.variationControl, page.position.contractControls.variations]) {
    assert.deepEqual(control.lifecycleStageCounts, lifecycle);
    assert.deepEqual(control.changeRegister.stateCounts, vo.changeRegister.stateCounts);
    assert.equal(control.knownPendingCount, 1);
  }
  assert.equal(page.position.registers.variationStateCounts.withdrawn, 1);
  assert.equal(page.position.registers.variationStateCounts.pending, 1);
});
