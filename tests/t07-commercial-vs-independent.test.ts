import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {buildCommercialFoundation} from '../packages/commercial-foundation/src';
import {buildCommercialPerformance} from '../packages/commercial-performance/src';
import {buildContractControls} from '../packages/commercial-contract-controls/src';
import {assessEventNotice, type CanonicalDelayEvent, type CanonicalNoticeRecord, type NoticeRequirement} from '../packages/delay-analysis-core/src';

// T07 judged against the T12 independent calculators (tools/independent, plain JS,
// validated in t12-independent-commercial-calculators). CMeng state is built the same
// way t07-tcpi-source-money-precision and stage1-notice-recovery-regressions build it.
// Each mismatch is either a CMeng defect (fixed at the shared producer, asserted equal
// here) or a stated basis difference (asserted and explained here). Entitlement and
// claim merit are judgment items and are never calculated by either side.
const root = path.resolve(__dirname, '..', '..');
const {evm} = require(path.join(root, 'tools/independent/evm.cjs'));
const nd = require(path.join(root, 'tools/independent/notice-dates.cjs'));
const ledger = require(path.join(root, 'tools/independent/ledger.cjs'));

const dataDateIso = '2026-08-31', generatedAt = '2026-10-19T00:00:00.000Z';
const emptyFoundation = (projectId: string) => buildCommercialFoundation({projectId, generatedAt, dataDateIso,
  contractValue: null, contractValueCandidates: [], variations: [], contractTimeBasis: null,
  ldTerms: null, contractSections: [], amendments: [], costMetrics: [], payments: []});

test('T07 EVM: CMeng cost position equals the independent EVM calculator', () => {
  const cases = [
    {bac: 1000, pv: 500, ev: 400, ac: 500, eac: 1100, etc: 600},
    {bac: 2450000.75, pv: 1200000.25, ev: 1100000.5, ac: 1250000.1, eac: 2700000, etc: 1449999.9},
    {bac: 0.3, pv: 0.1, ev: 0.3, ac: 0.2, eac: 0.3, etc: 0.1},
    {bac: 880000, pv: 300000, ev: 330000, ac: 290000, eac: 860000, etc: 570000},
  ];
  for (const [index, values] of cases.entries()) {
    const projectId = 'T07-EVM-' + index;
    const result = buildCommercialPerformance({projectId, generatedAt, dataDateIso, foundation: emptyFoundation(projectId),
      costSnapshots: [{currency: 'AED', taxBasis: 'exclusive', asOf: dataDateIso, state: 'official',
        values: {...values}, sourceRefs: ['SRC:' + index], diagnostics: []}], costMetrics: [], payments: []});
    const p = result.costControl.positions[0]!;
    const ind = evm(values);
    const label = 'case ' + index;
    assert.equal(p.sv.value, ind.sv, 'SV ' + label);
    assert.equal(p.cv.value, ind.cv, 'CV ' + label);
    assert.equal(p.spi.value, ind.spi, 'SPI ' + label);
    assert.equal(p.cpi.value, ind.cpi, 'CPI ' + label);
    assert.equal(p.tcpiBudget.value, ind.tcpi.bac, 'TCPI to BAC ' + label);
    assert.equal(p.tcpiForecast.value, ind.tcpi.eac, 'TCPI to EAC ' + label);
    assert.equal(p.calculatedVac.value, ind.vac.source, 'VAC = BAC - source EAC ' + label);
    // Submitted EAC stays apart from every calculated scenario.
    assert.equal(p.sourceEac.value, ind.eac.source, 'source EAC kept as submitted ' + label);
    assert.equal(p.sourceEac.authority === 'calculated', false, 'source EAC is not relabelled as calculated ' + label);
    const scenario = (method: string) => p.eacScenarios.find(s => s.method === method);
    assert.equal(scenario('bac_over_cpi')!.value.value, ind.eac.cpi, 'EAC = BAC/CPI ' + label);
    assert.equal(scenario('ac_plus_remaining_budget')!.value.value, ind.eac.budgetRate, 'EAC = AC + (BAC-EV) ' + label);
    assert.equal(scenario('bac_over_cpi')!.official, false);
    // Basis difference: CMeng does not offer the CPI x SPI composite EAC. It is a
    // scenario, never an approved forecast, so its absence hides no figure CMeng
    // presents. The independent value is kept here so the gap stays visible.
    assert.equal(scenario('ac_plus_cpi_spi'), undefined, 'CPI x SPI EAC is not a CMeng scenario ' + label);
    assert.equal(typeof ind.eac.cpiSpi, 'number');
    // Basis difference: CMeng checks AC + submitted ETC; the calculator derives ETC as
    // source EAC - AC. They agree when the submitted figures are consistent.
    const bottomUp = scenario('ac_plus_source_etc')!.value.value;
    assert.equal(bottomUp, ledger.major(ledger.minor(values.ac) + ledger.minor(values.etc)), 'AC + source ETC ' + label);
  }
});

test('T07 EVM: unknown inputs stay unknown in CMeng and in the calculator', () => {
  const values = {bac: 1000, ev: 400};
  const result = buildCommercialPerformance({projectId: 'T07-EVM-MISSING', generatedAt, dataDateIso, foundation: emptyFoundation('T07-EVM-MISSING'),
    costSnapshots: [{currency: 'AED', taxBasis: 'exclusive', asOf: dataDateIso, state: 'official', values, sourceRefs: ['SRC'], diagnostics: []}],
    costMetrics: [], payments: []});
  const p = result.costControl.positions[0]!;
  const ind = evm(values);
  for (const [cm, iv, name] of [[p.cpi.value, ind.cpi, 'CPI'], [p.spi.value, ind.spi, 'SPI'], [p.cv.value, ind.cv, 'CV'],
    [p.sv.value, ind.sv, 'SV'], [p.tcpiBudget.value, ind.tcpi.bac, 'TCPI'], [p.calculatedVac.value, ind.vac.source, 'VAC']] as const) {
    assert.equal(cm, null, name + ' CMeng'); assert.equal(iv, null, name + ' calculator');
  }
});

test('T07 variation position: approved, submitted and rejected kept apart; current value equals the ledger', () => {
  const variations = [
    {variationId: 'V1', state: 'approved' as const, amount: 50000.1, approvalDate: '2026-05-01', currency: 'AED', sourceRefs: ['V1']},
    {variationId: 'V2', state: 'approved' as const, amount: 0.2, approvalDate: '2026-05-02', currency: 'AED', sourceRefs: ['V2']},
    {variationId: 'V3', state: 'pending' as const, amount: 30000, approvalDate: null, currency: 'AED', sourceRefs: ['V3']},
    {variationId: 'V4', state: 'rejected' as const, amount: 20000, approvalDate: null, currency: 'AED', sourceRefs: ['V4']},
    {variationId: 'V5', state: 'approved' as const, amount: 7000, approvalDate: '2026-09-01', currency: 'AED', sourceRefs: ['V5']},
    {variationId: 'V6', state: 'approved' as const, amount: 100.1, approvalDate: '2026-06-01', currency: 'AED', sourceRefs: ['V6']},
    {variationId: 'V7', state: 'approved' as const, amount: 200.2, approvalDate: '2026-06-02', currency: 'AED', sourceRefs: ['V7']},
    {variationId: 'V8', state: 'approved' as const, amount: 300.3, approvalDate: '2026-06-03', currency: 'AED', sourceRefs: ['V8']},
  ];
  const foundation = buildCommercialFoundation({projectId: 'T07-VAR', generatedAt, dataDateIso,
    contractValue: {amount: 1000000, currency: 'AED', sourceRefs: ['CONTRACT'], authority: 'approved'},
    contractValueCandidates: [], variations, contractTimeBasis: null, ldTerms: null, contractSections: [],
    amendments: [], costMetrics: [], payments: []});
  const row = foundation.commercialTerms.originalContractValueByCurrency.find(r => r.currency === 'AED')!;
  const ind = ledger.variationPosition({originalValue: 1000000, dataDateIso, variations: variations.map(v => ({id: v.variationId, state: v.state, amount: v.amount, approvalDate: v.approvalDate}))});
  // CMeng defect fixed (commercial-foundation approved_variation_sum): the binary
  // floating sum showed 50600.899999999994 for these approved items instead of 50600.9.
  assert.equal(ind.approved.value, 50600.9);
  assert.equal(row.approvedVariations.value, ind.approved.value, 'approved variation sum');
  assert.equal(row.approvedVariations.coverage.known, ind.approved.count, 'approved variation count (future and pending excluded)');
  assert.equal(row.current.value, ind.currentContractValue, 'current contract value');
  assert.equal(row.original.value, 1000000);
  // Pending (submitted) and rejected values never change the contract value.
  assert.equal(ind.submitted.value, 30000); assert.equal(ind.rejected.value, 20000); assert.equal(ind.futureApproved.value, 7000);
  // Undated approval: both sides withhold the current value.
  const undated = buildCommercialFoundation({projectId: 'T07-VAR-UNDATED', generatedAt, dataDateIso,
    contractValue: {amount: 1000, currency: 'AED', sourceRefs: ['C'], authority: 'approved'}, contractValueCandidates: [],
    variations: [{variationId: 'U', state: 'approved', amount: 5, approvalDate: null, currency: 'AED', sourceRefs: ['U']}],
    contractTimeBasis: null, ldTerms: null, contractSections: [], amendments: [], costMetrics: [], payments: []});
  const indUndated = ledger.variationPosition({originalValue: 1000, dataDateIso, variations: [{id: 'U', state: 'approved', amount: 5}]});
  assert.equal(undated.commercialTerms.originalContractValueByCurrency[0]!.current.value, indUndated.currentContractValue);
  assert.equal(indUndated.currentContractValue, null);
});

const ref = (sourceType: any, sourceId: string) => ({sourceType, sourceId, locator: 'row:1'});
const event = (overrides: Partial<CanonicalDelayEvent> = {}): CanonicalDelayEvent => ({
  eventId: 'E-1', title: 'Late access', category: 'late_information', startIso: '2026-03-01', awarenessIso: null, endIso: null,
  responsibility: 'employer', responsibilityState: 'official', describedImpactDays: null, describedImpactState: 'missing',
  relatedActivityIds: [], relatedClauseIdentifiers: ['20.1'], evidenceRefs: [ref('other', 'E-1')], diagnostics: [], ...overrides});
const notice = (date: string | null): CanonicalNoticeRecord => ({noticeId: 'N-1', kind: 'claim_notice', eventId: 'E-1', claimId: null,
  actualIssuedAt: date, actualReceivedAt: date, plannedAt: null, subject: 'Notice', clauseIdentifiers: ['20.1'],
  evidenceRefs: [ref('notice', 'N-1')], diagnostics: []});
const rule = (overrides: Partial<NoticeRequirement> = {}): NoticeRequirement => ({requirementId: 'R-1', noticeKind: 'claim_notice',
  eventCategories: ['late_information'], noticePeriodDays: 28, effectiveFromIso: null, effectiveToIso: null, triggerBasis: 'event_start',
  state: 'official', clauseIdentifiers: ['20.1'], evidenceRefs: [ref('contract', '20.1')], ...overrides});

test('T07 notices: calendar-day contract rule gives the same timeliness as the notice calculator', () => {
  const cases: Array<[string, string]> = [
    ['2026-03-01', '2026-03-28'], ['2026-03-01', '2026-03-29'], ['2026-03-01', '2026-03-30'],
    // Time of day on the last allowed day: still within 28 days (civil-day count).
    ['2026-03-01', '2026-03-29T15:00:00Z'], ['2026-03-01', '2026-03-29T23:59:00+04:00'],
    ['2026-03-01T09:00:00Z', '2026-03-29T08:00:00Z'], ['2026-03-01', '2026-03-30T00:30:00+04:00'],
    ['2028-02-01', '2028-02-29'], ['2028-02-01', '2028-03-01'],
  ];
  for (const [trigger, issued] of cases) {
    const cm = assessEventNotice(event({startIso: trigger}), [notice(issued)], [rule()]);
    const ind = nd.noticeDeadline({triggerIso: trigger, issuedIso: issued, rule: {periodDays: 28, dayBasis: 'calendar'}});
    const label = trigger + ' -> ' + issued;
    // CMeng defect fixed (delay-analysis-core assessEventNotice): elapsed time was
    // measured in milliseconds, so a notice sent at 15:00 on day 28 counted as 28.625
    // days and showed "late" against a 28-day rule.
    assert.equal(cm.timeliness, ind.timeliness, 'timeliness ' + label);
    assert.equal(cm.elapsedDays, ind.elapsedCalendarDays, 'elapsed civil days ' + label);
    assert.equal(cm.requiredNoticeDays, 28);
  }
  // Same for the awareness trigger.
  const aware = assessEventNotice(event({awarenessIso: '2026-03-05'}), [notice('2026-04-02T10:00:00Z')], [rule({triggerBasis: 'awareness'})]);
  assert.equal(aware.timeliness, nd.noticeDeadline({triggerIso: '2026-03-05', issuedIso: '2026-04-02T10:00:00Z', rule: {periodDays: 28, dayBasis: 'calendar'}}).timeliness);
  assert.equal(aware.timeliness, 'timely');
});

test('T07 notices: working-day rule is a stated basis difference; CMeng withholds, it never guesses calendar days', () => {
  // Basis difference: a CMeng NoticeRequirement carries no weekend or holiday calendar,
  // so a working-day rule is withheld (no timely/late verdict). The calculator can
  // only answer when the contract states the weekend; without it, it also withholds.
  const working = rule({noticePeriodDays: 5, sourceDayBasis: 'working'});
  const cm = assessEventNotice(event({startIso: '2026-03-05'}), [notice('2026-03-12')], [working]);
  assert.notEqual(cm.timeliness, 'timely'); assert.notEqual(cm.timeliness, 'late');
  assert.equal(cm.elapsedDays, null);
  assert.equal(nd.noticeDeadline({triggerIso: '2026-03-05', issuedIso: '2026-03-12', rule: {periodDays: 5, dayBasis: 'working'}}).timeliness, 'day_basis_unknown');
  assert.equal(nd.noticeDeadline({triggerIso: '2026-03-05', issuedIso: '2026-03-12', rule: {periodDays: 5, dayBasis: 'working', weekendDays: [5, 6]}}).timeliness, 'timely');
});

test('T07 sectional LD: CMeng section scenarios equal the ledger (rate x delay, capped per section)', () => {
  const missing = () => ({value: null, basis: {asOfDate: dataDateIso, method: 'test', sourceRefs: []}, coverage: {known: 0, total: 1, percent: 0},
    authority: 'missing' as const, submitted: null, independent: null, gap: null, consequence: null, action: null, state: 'missing' as const, diagnostics: []});
  const sec = (sectionId: string, rate: number, rateBasis: string, capAmount: number | null, due: string, extended: string | null, programme: string) =>
    ({sectionId, label: sectionId, rate, rateBasis, currency: 'AED', capAmount, capPercent: null, contractCompletionIso: due,
      extendedCompletionIso: extended, programmeCompletionIso: programme, milestoneId: null, sourceRefs: [sectionId]});
  const sections = [
    sec('S1', 1000, 'fixed_amount_per_day', 20000, '2026-06-30', null, '2026-07-30'),       // 30 d late, cap bites
    sec('S2', 3500, 'fixed_amount_per_week', 100000, '2026-06-30', '2026-07-05', '2026-07-15'), // EOT-extended due date, 10 d at 500/d
    sec('S3', 800, 'fixed_amount_per_day', 1000, '2026-06-30', null, '2026-06-25'),        // early: no LD
    sec('S4', 500, 'fixed_amount_per_day', null, '2026-06-30', null, '2026-07-10'),        // cap not read
  ];
  const p = buildContractControls({projectId: 'T07-LD', generatedAt, dataDateIso, variations: [], siteInstructions: [], obligations: [],
    contractClauses: [], bonds: [], insurances: [], retentions: [], existingRetentions: [], paymentRetentions: [],
    retentionPercent: missing(), retentionCapPercent: missing(), performanceBondRequirement: missing(), advancePaymentBondRequirement: missing(),
    insuranceRequirementCount: 0, ldTerms: null, contractValues: [], sectionTerms: sections,
    ldTime: {contractualCompletionIso: null, contractualCompletionState: 'missing', programmeCompletionIso: null, programmeCompletionMethod: 'none',
      programmeSourceRefs: [], awardedEotDays: null, awardedEotState: 'missing', awardedOverlapResolution: 'unresolved', eotSourceRefs: []}});
  const cm = p.liquidatedDamages.sectionScenarios;
  const ind = ledger.sectionalLd({overallCap: null, sections: sections.map(s => ({id: s.sectionId,
    ratePerDay: s.rateBasis === 'fixed_amount_per_week' ? s.rate / 7 : s.rate,
    delayDays: nd.civilDaysBetween(s.extendedCompletionIso ?? s.contractCompletionIso, s.programmeCompletionIso), capValue: s.capAmount}))});
  for (const [i, row] of cm.entries()) {
    const want = ind.rows[i];
    assert.equal(row.lateDays, Math.max(0, nd.civilDaysBetween(sections[i]!.extendedCompletionIso ?? sections[i]!.contractCompletionIso, sections[i]!.programmeCompletionIso)), 'late days ' + row.sectionId);
    assert.equal(row.uncappedExposure, want.raw, 'uncapped ' + row.sectionId);
    if (sections[i]!.capAmount !== null) assert.equal(row.cappedExposure, want.capped, 'capped ' + row.sectionId);
  }
  // Basis difference: a section cap that was not read stays unknown in CMeng (no
  // capped figure); the ledger treats a missing cap as "no cap". CMeng also never
  // adds sections into a whole-project figure, so no overall cap is applied.
  assert.equal(cm[3]!.cappedExposure, null);
  assert.equal(ind.rows[3].capped, 5000);
});
