import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// T12: validate the independent commercial calculators (tools/independent, plain JS,
// no CMeng imports) against hand-worked cases BEFORE they are used to judge CMeng.
// Compiled to dist/tests, so the repository root is two levels up.
const root = path.resolve(__dirname, '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {evm} = require(path.join(root, 'tools/independent/evm.cjs'));
const nd = require(path.join(root, 'tools/independent/notice-dates.cjs'));
const ledger = require(path.join(root, 'tools/independent/ledger.cjs'));

test('T12 EVM calculator: hand-worked BAC 1000, PV 500, EV 400, AC 500, source EAC 1100', () => {
  const r = evm({bac: 1000, pv: 500, ev: 400, ac: 500, eac: 1100});
  assert.equal(r.sv, -100);            // 400 - 500
  assert.equal(r.cv, -100);            // 400 - 500
  assert.equal(r.spi, 0.8);            // 400 / 500
  assert.equal(r.cpi, 0.8);            // 400 / 500
  assert.equal(r.eac.source, 1100);    // submitted, kept apart
  assert.equal(r.eac.cpi, 1250);       // 1000 / 0.8
  assert.equal(r.eac.budgetRate, 1100);// 500 + (1000 - 400)
  assert.equal(r.eac.cpiSpi, 1437.5);  // 500 + 600 / (0.8 * 0.8)
  assert.equal(r.etc.source, 600);     // 1100 - 500
  assert.equal(r.etc.cpi, 750);        // 1250 - 500
  assert.equal(r.vac.source, -100);    // 1000 - 1100
  assert.equal(r.vac.cpi, -250);       // 1000 - 1250
  assert.equal(r.tcpi.bac, 1.2);       // 600 / 500
  assert.equal(r.tcpi.eac, 1);         // 600 / 600
});

test('T12 EVM calculator: unknown stays unknown, zero denominators give no ratio, decimals exact', () => {
  const r = evm({bac: 1000, pv: 0, ev: 400, ac: null, eac: null});
  assert.equal(r.cpi, null); assert.equal(r.cv, null); assert.equal(r.spi, null);
  assert.equal(r.sv, 400); assert.equal(r.eac.cpi, null); assert.equal(r.eac.source, null);
  assert.equal(r.tcpi.bac, null); assert.equal(r.vac.source, null);
  const d = evm({bac: 0.3, pv: 0.1, ev: 0.3, ac: 0.2, eac: 0.3});
  assert.equal(d.sv, 0.2);             // binary 0.3-0.1 is 0.19999999999999998
  assert.equal(d.cv, 0.1);
  assert.equal(d.tcpi.bac, 0);         // (0.3-0.3)/(0.3-0.2)
  assert.equal(d.spi, 3);
  // Third-decimal half-up: 2/3 -> 0.666667; -2/3 -> -0.666667.
  assert.equal(evm({ev: 2, ac: 3}).cpi, 0.666667);
  assert.equal(evm({ev: -2, ac: 3}).cpi, -0.666667);
});

test('T12 notice calculator: calendar days on civil dates, time of day does not move the day', () => {
  const rule = {periodDays: 28, dayBasis: 'calendar'};
  assert.deepEqual(nd.noticeDeadline({triggerIso: '2026-03-01', issuedIso: '2026-03-29T15:00:00Z', rule}),
    {deadlineIso: '2026-03-29', elapsedCalendarDays: 28, timeliness: 'timely'});
  assert.equal(nd.noticeDeadline({triggerIso: '2026-03-01', issuedIso: '2026-03-30', rule}).timeliness, 'late');
  assert.equal(nd.noticeDeadline({triggerIso: null, issuedIso: '2026-03-30', rule}).timeliness, 'trigger_missing');
  assert.equal(nd.noticeDeadline({triggerIso: '2026-03-01', issuedIso: null, rule}).timeliness, 'not_issued');
  assert.equal(nd.noticeDeadline({triggerIso: '2026-03-01', issuedIso: '2026-03-02', rule: null}).timeliness, 'rule_missing');
  assert.equal(nd.addCalendarDays('2028-02-28', 1), '2028-02-29');
  assert.equal(nd.addCalendarDays('2026-12-31', 1), '2027-01-01');
});

test('T12 notice calculator: working days follow the stated weekend and holidays only', () => {
  // 2026-03-05 is a Thursday. Weekend Friday(5)+Saturday(6).
  const rule = {periodDays: 5, dayBasis: 'working', weekendDays: [5, 6]};
  assert.equal(nd.addWorkingDays('2026-03-05', 5, rule), '2026-03-12');
  assert.equal(nd.addWorkingDays('2026-03-05', 5, {...rule, holidays: ['2026-03-09']}), '2026-03-15');
  assert.equal(nd.noticeDeadline({triggerIso: '2026-03-05', issuedIso: '2026-03-12', rule}).timeliness, 'timely');
  assert.equal(nd.noticeDeadline({triggerIso: '2026-03-05', issuedIso: '2026-03-13', rule}).timeliness, 'late');
  // Working days without a stated weekend: unknown, never a guessed Saturday/Sunday.
  assert.equal(nd.noticeDeadline({triggerIso: '2026-03-05', issuedIso: '2026-03-12', rule: {periodDays: 5, dayBasis: 'working'}}).timeliness, 'day_basis_unknown');
});

test('T12 date calculator: revised completion = original + awarded EOT, overlapping awards counted once', () => {
  assert.deepEqual(nd.revisedCompletion('2026-06-30', [{days: 10}, {days: 15}]), {awardedDays: 25, revisedIso: '2026-07-25'});
  // 01-10 Apr (10 d) and 06-20 Apr (15 d) overlap 6 days: union 01-20 Apr = 20 d.
  assert.deepEqual(nd.revisedCompletion('2026-06-30', [{fromIso: '2026-04-01', toIso: '2026-04-10'}, {fromIso: '2026-04-06', toIso: '2026-04-20'}]),
    {awardedDays: 20, revisedIso: '2026-07-20'});
  assert.equal(nd.unionDays([{fromIso: '2026-04-01', toIso: '2026-04-10'}, {fromIso: '2026-04-11', toIso: '2026-04-15'}]), 15);
  assert.equal(nd.unionDays([{fromIso: '2026-04-01', toIso: '2026-04-05'}, {fromIso: '2026-04-10', toIso: '2026-04-11'}]), 7);
  assert.deepEqual(nd.revisedCompletion('2026-06-30', []), {awardedDays: 0, revisedIso: '2026-06-30'});
  assert.deepEqual(nd.revisedCompletion(null, [{days: 3}]), {awardedDays: null, revisedIso: null});
  assert.deepEqual(nd.revisedCompletion('2026-06-30', [{days: null}]), {awardedDays: null, revisedIso: null});
});

test('T12 commercial ledger: variations kept apart, only dated approved ones change the contract value', () => {
  const r = ledger.variationPosition({originalValue: 1000000, dataDateIso: '2026-08-31', variations: [
    {id: 'V1', state: 'approved', amount: 50000.1, approvalDate: '2026-05-01'},
    {id: 'V2', state: 'approved', amount: 0.2, approvalDate: '2026-05-02'},
    {id: 'V3', state: 'pending', amount: 30000},
    {id: 'V4', state: 'rejected', amount: 20000},
    {id: 'V5', state: 'approved', amount: 7000, approvalDate: '2026-09-01'},
  ]});
  assert.deepEqual(r.approved, {count: 2, value: 50000.3});
  assert.deepEqual(r.submitted, {count: 1, value: 30000});
  assert.deepEqual(r.rejected, {count: 1, value: 20000});
  assert.deepEqual(r.futureApproved, {count: 1, value: 7000});
  assert.equal(r.currentContractValue, 1050000.3);
  const undated = ledger.variationPosition({originalValue: 1000, dataDateIso: '2026-08-31', variations: [{id: 'V', state: 'approved', amount: 5}]});
  assert.equal(undated.currentContractValue, null);
  assert.equal(ledger.variationPosition({originalValue: null, dataDateIso: '2026-08-31', variations: []}).currentContractValue, null);
});

test('T12 commercial ledger: payments vs certificates, retention, sectional LD with caps', () => {
  const p = ledger.paymentPosition([{certified: 100000.1, paid: 90000}, {certified: 50000.2, paid: 50000.2}]);
  assert.equal(p.certified, 150000.3); assert.equal(p.paid, 140000.2); assert.equal(p.outstanding, 10000.1);
  assert.deepEqual(p.rows.map((r: {outstanding: number}) => r.outstanding), [10000.1, 0]);
  assert.equal(ledger.paymentPosition([{certified: 1, paid: null}]).outstanding, null);
  const ret = ledger.retentionPosition({deductions: [5000, 2500.5], releases: [3000], capValue: 7000});
  assert.deepEqual(ret, {deducted: 7500.5, released: 3000, held: 4500.5, overRelease: false, capExceeded: true});
  const ld = ledger.sectionalLd({overallCap: 22000, sections: [
    {id: 'S1', ratePerDay: 1000, delayDays: 30, capValue: 20000},
    {id: 'S2', ratePerDay: 500, delayDays: 10, capValue: null},
    {id: 'S3', ratePerDay: 800, delayDays: -5, capValue: 1000},
  ]});
  assert.deepEqual(ld.rows.map((r: {capped: number}) => r.capped), [20000, 5000, 0]);
  assert.equal(ld.uncapped, 25000); assert.equal(ld.total, 22000); assert.equal(ld.overallCapApplied, true);
  assert.equal(ledger.sectionalLd({overallCap: null, sections: [{id: 'S', ratePerDay: null, delayDays: 3, capValue: null}]}).total, null);
});
