import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {buildCommercialFoundation} from '../packages/commercial-foundation/src';
import {buildCommercialPerformance} from '../packages/commercial-performance/src';
import {buildContractControls, type ContractControlsInput} from '../packages/commercial-contract-controls/src';

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
  assert.deepEqual(full.changeRegister.stateCounts, {submitted: 1, underReview: 1, approved: 1, rejected: 1, withdrawn: 1, unknown: 0});
  assert.equal(full.rejectedCount, 1);

  // Only an approved list is supplied: approved is counted, every other state is
  // not established (never 0), and the position is not established.
  const approvedList = controls([
    variation('VO-3', 'Approved', {approvalDate: '2026-05-30'}, 1000),
    variation('VO-6', 'Approved', {approvalDate: '2026-07-15'}, 2500),
  ]);
  assert.equal(approvedList.changeRegister.state, 'not_established');
  assert.equal(approvedList.changeRegister.approvedOnly, true);
  assert.deepEqual(approvedList.changeRegister.stateCounts, {submitted: null, underReview: null, approved: 2, rejected: null, withdrawn: null, unknown: null});
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
  assert.deepEqual(p.sourceEacChallenge.findings.map(f => [f.rule, f.sourceEac, f.independentValue]),
    [['below_actual_cost', 450, 500], ['outside_independent_range', 450, 1100]]);
  assert.ok(p.sourceEacChallenge.rules.some(rule => /below actual cost/.test(rule)));

  // R2: above the higher independent forecast.
  const high = position({bac: 1000, pv: 500, ev: 400, ac: 500, eac: 1900});
  assert.equal(high.sourceEacChallenge.state, 'challenge');
  assert.deepEqual(high.sourceEacChallenge.findings.map(f => [f.rule, f.independentValue]), [['outside_independent_range', 1250]]);
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
