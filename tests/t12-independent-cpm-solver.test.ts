import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

// T12: validate the independent CPM solver (tools/independent/cpm-solver.cjs)
// BEFORE it is used to judge CMeng. Every expected value below was worked out
// by hand from the solver's stated rules (see the header of the solver):
// whole working hours, lag on the successor calendar, a start is the start of
// a working hour, a finish is the end of a working hour, a zero-duration
// activity takes the start instant, retained logic for progress.
// Dates: 2027-01-04 is a Monday. All instants are UTC.

const requireCjs = createRequire(__filename);
const {solve} = requireCjs(resolve(process.cwd(), 'tools/independent/cpm-solver.cjs'));

const C5 = {id: 'C5', workDays: [1, 2, 3, 4, 5], startHour: 8, hoursPerDay: 8, holidays: [] as string[]};
const C5H = {id: 'C5H', workDays: [1, 2, 3, 4, 5], startHour: 8, hoursPerDay: 8, holidays: ['2027-01-06']};
const C6 = {id: 'C6', workDays: [6, 0, 1, 2, 3, 4], startHour: 7, hoursPerDay: 10, holidays: [] as string[]};
const C7 = {id: 'C7', workDays: [0, 1, 2, 3, 4, 5, 6], startHour: 0, hoursPerDay: 24, holidays: [] as string[]};
const MON = '2027-01-04T08:00:00Z';

type Row = Record<string, unknown>;
function rows(result: {activities: Row[]}) { return new Map(result.activities.map(a => [a.id as string, a] as [string, Row])); }
const t = (s: string) => new Date(s).toISOString();
function expectRow(result: {activities: Row[]}, id: string, e: {es: string; ef: string; ls?: string; lf?: string; tf?: number | null; ff?: number | null; tfd?: number; ffd?: number; crit?: boolean | null}) {
  const r = rows(result).get(id)!;
  assert.ok(r, id + ' present');
  assert.equal(r.earlyStart, t(e.es), id + ' early start');
  assert.equal(r.earlyFinish, t(e.ef), id + ' early finish');
  if (e.ls !== undefined) assert.equal(r.lateStart, t(e.ls), id + ' late start');
  if (e.lf !== undefined) assert.equal(r.lateFinish, t(e.lf), id + ' late finish');
  if (e.tf !== undefined) assert.equal(r.totalFloatHours, e.tf, id + ' total float hours');
  if (e.ff !== undefined) assert.equal(r.freeFloatHours, e.ff, id + ' free float hours');
  if (e.tfd !== undefined) assert.equal(r.totalFloatDays, e.tfd, id + ' total float days');
  if (e.ffd !== undefined) assert.equal(r.freeFloatDays, e.ffd, id + ' free float days');
  if (e.crit !== undefined) assert.equal(r.critical, e.crit, id + ' critical');
}

test('N1 5-day/8h FS: A16 -> B24, A -> C8', () => {
  // A Mon 08 + 16h = Tue 16. B and C start Wed 08 (Tue 16 is the end of the
  // day). B 24h = Wed, Thu, Fri -> Fri 16 = project finish. C Wed 08-16; it
  // may finish by Fri 16: late Fri 08-16, float = Thu 8 + Fri 8 = 16h = 2 days.
  const r = solve({dataDate: MON, calendars: [C5], activities: [
    {id: 'A', calendar: 'C5', duration: 16}, {id: 'B', calendar: 'C5', duration: 24}, {id: 'C', calendar: 'C5', duration: 8}],
  relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: 0}, {pred: 'A', succ: 'C', type: 'FS', lag: 0}]});
  assert.equal(r.projectFinish, t('2027-01-08T16:00Z'));
  expectRow(r, 'A', {es: MON, ef: '2027-01-05T16:00Z', ls: MON, lf: '2027-01-05T16:00Z', tf: 0, ff: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-06T08:00Z', ef: '2027-01-08T16:00Z', tf: 0, crit: true});
  expectRow(r, 'C', {es: '2027-01-06T08:00Z', ef: '2027-01-06T16:00Z', ls: '2027-01-08T08:00Z', lf: '2027-01-08T16:00Z', tf: 16, ff: 16, tfd: 2, ffd: 2, crit: false});
  assert.deepEqual(r.criticalIds, ['A', 'B']);
});

test('N2 FS with positive lag 4h', () => {
  // A Mon 08-16 = working position 8. B start = 8 + 4 = position 12 = Tue 12.
  // B 8h = Tue 12-16 (4) + Wed 08-12 (4) -> Wed 12.
  const r = solve({dataDate: MON, calendars: [C5], activities: [{id: 'A', calendar: 'C5', duration: 8}, {id: 'B', calendar: 'C5', duration: 8}],
    relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: 4}]});
  expectRow(r, 'A', {es: MON, ef: '2027-01-04T16:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-05T12:00Z', ef: '2027-01-06T12:00Z', tf: 0, crit: true});
});

test('N3 FS with negative lag -4h (lead)', () => {
  // A 16h -> Tue 16 = position 16. B start = 16 - 4 = 12 = Tue 12; B ends Wed 12.
  // Backward: A may finish where position - 4 <= 12, so Tue 16: no float.
  const r = solve({dataDate: MON, calendars: [C5], activities: [{id: 'A', calendar: 'C5', duration: 16}, {id: 'B', calendar: 'C5', duration: 8}],
    relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: -4}]});
  expectRow(r, 'A', {es: MON, ef: '2027-01-05T16:00Z', lf: '2027-01-05T16:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-05T12:00Z', ef: '2027-01-06T12:00Z', tf: 0, crit: true});
});

test('N4 SS with lag 8h', () => {
  // A 24h Mon 08 -> Wed 16 (project finish). B starts at A start + 8 = Tue 08,
  // ends Tue 16. B may finish Wed 16: float 8h = 1 day. A: late start bound
  // from SS is Tue 08 - 8 = Mon 08 and finish bound Wed 16: no float.
  const r = solve({dataDate: MON, calendars: [C5], activities: [{id: 'A', calendar: 'C5', duration: 24}, {id: 'B', calendar: 'C5', duration: 8}],
    relationships: [{pred: 'A', succ: 'B', type: 'SS', lag: 8}]});
  expectRow(r, 'A', {es: MON, ef: '2027-01-06T16:00Z', ls: MON, lf: '2027-01-06T16:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-05T08:00Z', ef: '2027-01-05T16:00Z', ls: '2027-01-06T08:00Z', lf: '2027-01-06T16:00Z', tf: 8, ff: 8, tfd: 1, crit: false});
});

test('N5 FF with an open-ended parallel activity', () => {
  // A 16h Mon-Tue 16. B 8h must finish no earlier than A: B Tue 08-16.
  // C 24h, no links: Mon-Wed 16 = project finish, so C is critical.
  // B late finish Wed 16 (float 8). A late finish: A finish <= B late finish
  // Wed 16 -> float 8, but any slip of A moves B's early finish: free float 0.
  const r = solve({dataDate: MON, calendars: [C5], activities: [
    {id: 'A', calendar: 'C5', duration: 16}, {id: 'B', calendar: 'C5', duration: 8}, {id: 'C', calendar: 'C5', duration: 24}],
  relationships: [{pred: 'A', succ: 'B', type: 'FF', lag: 0}]});
  expectRow(r, 'A', {es: MON, ef: '2027-01-05T16:00Z', ls: '2027-01-05T08:00Z', lf: '2027-01-06T16:00Z', tf: 8, ff: 0, crit: false});
  expectRow(r, 'B', {es: '2027-01-05T08:00Z', ef: '2027-01-05T16:00Z', lf: '2027-01-06T16:00Z', tf: 8, ff: 8, crit: false});
  expectRow(r, 'C', {es: MON, ef: '2027-01-06T16:00Z', tf: 0, ff: 0, crit: true});
});

test('N6 SF with lag 8h', () => {
  // B (4h) must finish no earlier than A start + 8 = position 8 = Mon 16.
  // So B starts Mon 12, ends Mon 16 = project finish. A: start + 8 <= B late
  // finish (8) -> A late start Mon 08: no float.
  const r = solve({dataDate: MON, calendars: [C5], activities: [{id: 'A', calendar: 'C5', duration: 8}, {id: 'B', calendar: 'C5', duration: 4}],
    relationships: [{pred: 'A', succ: 'B', type: 'SF', lag: 8}]});
  expectRow(r, 'A', {es: MON, ef: '2027-01-04T16:00Z', ls: MON, tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-04T12:00Z', ef: '2027-01-04T16:00Z', tf: 0, crit: true});
});

test('N7 6-day/10h calendar (Saturday to Thursday, Friday off)', () => {
  // Data date Thu 2027-01-07 07:00. A 20h: Thu 07-17 (10), Friday off,
  // Sat 07-17 (10) -> Sat 17. B 30h: Sun, Mon, Tue -> Tue 2027-01-12 17.
  // C 10h: Sun 07-17; may finish Tue 17: float Mon 10 + Tue 10 = 20h = 2 days.
  const r = solve({dataDate: '2027-01-07T07:00:00Z', calendars: [C6], activities: [
    {id: 'A', calendar: 'C6', duration: 20}, {id: 'B', calendar: 'C6', duration: 30}, {id: 'C', calendar: 'C6', duration: 10}],
  relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: 0}, {pred: 'A', succ: 'C', type: 'FS', lag: 0}]});
  assert.equal(r.projectFinish, t('2027-01-12T17:00Z'));
  expectRow(r, 'A', {es: '2027-01-07T07:00Z', ef: '2027-01-09T17:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-10T07:00Z', ef: '2027-01-12T17:00Z', tf: 0, crit: true});
  expectRow(r, 'C', {es: '2027-01-10T07:00Z', ef: '2027-01-10T17:00Z', ls: '2027-01-12T07:00Z', lf: '2027-01-12T17:00Z', tf: 20, ff: 20, tfd: 2, ffd: 2, crit: false});
});

test('N8 7-day/24h calendar with a negative lag', () => {
  // Data date Fri 2027-01-08 00:00. A 36h -> Sat 12:00. B FS -6: Sat 06:00,
  // 12h -> Sat 18:00 = project finish. C 4h FS 0: Sat 12-16, may finish
  // Sat 18: float 2h = 2/24 day.
  const r = solve({dataDate: '2027-01-08T00:00:00Z', calendars: [C7], activities: [
    {id: 'A', calendar: 'C7', duration: 36}, {id: 'B', calendar: 'C7', duration: 12}, {id: 'C', calendar: 'C7', duration: 4}],
  relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: -6}, {pred: 'A', succ: 'C', type: 'FS', lag: 0}]});
  assert.equal(r.projectFinish, t('2027-01-09T18:00Z'));
  expectRow(r, 'A', {es: '2027-01-08T00:00Z', ef: '2027-01-09T12:00Z', lf: '2027-01-09T12:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-09T06:00Z', ef: '2027-01-09T18:00Z', tf: 0, crit: true});
  expectRow(r, 'C', {es: '2027-01-09T12:00Z', ef: '2027-01-09T16:00Z', lf: '2027-01-09T18:00Z', tf: 2, ff: 2, tfd: 2 / 24, crit: false});
});

test('N9 holiday removes a whole working day', () => {
  // Wed 2027-01-06 is a holiday. A 24h = Mon + Tue + Thu -> Thu 16. B 8h Fri.
  // C 8h, no links: Mon; may finish Fri 16: float Tue + Thu + Fri = 24h = 3 days.
  const r = solve({dataDate: MON, calendars: [C5H], activities: [
    {id: 'A', calendar: 'C5H', duration: 24}, {id: 'B', calendar: 'C5H', duration: 8}, {id: 'C', calendar: 'C5H', duration: 8}],
  relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: 0}]});
  expectRow(r, 'A', {es: MON, ef: '2027-01-07T16:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-08T08:00Z', ef: '2027-01-08T16:00Z', tf: 0, crit: true});
  expectRow(r, 'C', {es: MON, ef: '2027-01-04T16:00Z', ls: '2027-01-08T08:00Z', lf: '2027-01-08T16:00Z', tf: 24, ff: 24, tfd: 3, crit: false});
});

test('N10 lag is counted on the successor calendar', () => {
  // A (5-day) Mon 08-16. B (24h) FS lag 8 on B's calendar: Mon 16 + 8 elapsed
  // working hours = Tue 00:00 (on A's calendar it would be Tue 16:00).
  // B 10h -> Tue 10:00 = project finish. A: no float.
  const r = solve({dataDate: MON, calendars: [C5, C7], activities: [{id: 'A', calendar: 'C5', duration: 8}, {id: 'B', calendar: 'C7', duration: 10}],
    relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: 8}]});
  assert.equal(r.lagCalendarRule, 'successor_calendar_both_passes');
  expectRow(r, 'A', {es: MON, ef: '2027-01-04T16:00Z', lf: '2027-01-04T16:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-05T00:00Z', ef: '2027-01-05T10:00Z', tf: 0, crit: true});
});

test('N11 mixed calendars: 24h predecessor has float into the 5-day gap', () => {
  // A (24h) 20h from Mon 08 -> Tue 04:00. B (5-day) can start at its next
  // working hour Tue 08, ends Tue 16. A may finish as late as Tue 08:00 on its
  // own 24h calendar: float 4h = 4/24 day, so A is not critical.
  const r = solve({dataDate: MON, calendars: [C5, C7], activities: [{id: 'A', calendar: 'C7', duration: 20}, {id: 'B', calendar: 'C5', duration: 8}],
    relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: 0}]});
  expectRow(r, 'A', {es: MON, ef: '2027-01-05T04:00Z', ls: '2027-01-04T12:00Z', lf: '2027-01-05T08:00Z', tf: 4, ff: 4, tfd: 4 / 24, crit: false});
  expectRow(r, 'B', {es: '2027-01-05T08:00Z', ef: '2027-01-05T16:00Z', tf: 0, crit: true});
});

test('N12 progress: completed, in progress (retained logic) and SS from an actual start', () => {
  // Data date Wed 2027-01-06 08:00. A done (Mon 08 - Tue 16): actual dates,
  // no float. B started Tue 08 with 16h left: Wed 08 - Thu 16. C after A and B:
  // Fri 08-16 = project finish. D SS 8 from B's ACTUAL start Tue 08 -> Wed 08
  // (also the data date), ends Wed 16; may finish Fri 16: float 16h = 2 days.
  const r = solve({dataDate: '2027-01-06T08:00:00Z', calendars: [C5], activities: [
    {id: 'A', calendar: 'C5', duration: 16, actualStart: MON, actualFinish: '2027-01-05T16:00:00Z'},
    {id: 'B', calendar: 'C5', duration: 24, remaining: 16, actualStart: '2027-01-05T08:00:00Z'},
    {id: 'C', calendar: 'C5', duration: 8}, {id: 'D', calendar: 'C5', duration: 8}],
  relationships: [{pred: 'A', succ: 'B', type: 'SS', lag: 0}, {pred: 'A', succ: 'C', type: 'FS', lag: 0},
    {pred: 'B', succ: 'C', type: 'FS', lag: 0}, {pred: 'B', succ: 'D', type: 'SS', lag: 8}]});
  assert.equal(r.projectFinish, t('2027-01-08T16:00Z'));
  expectRow(r, 'A', {es: MON, ef: '2027-01-05T16:00Z', tf: null, ff: null, crit: null});
  expectRow(r, 'B', {es: '2027-01-06T08:00Z', ef: '2027-01-07T16:00Z', ls: '2027-01-06T08:00Z', lf: '2027-01-07T16:00Z', tf: 0, crit: true});
  expectRow(r, 'C', {es: '2027-01-08T08:00Z', ef: '2027-01-08T16:00Z', tf: 0, crit: true});
  expectRow(r, 'D', {es: '2027-01-06T08:00Z', ef: '2027-01-06T16:00Z', lf: '2027-01-08T16:00Z', tf: 16, ff: 16, tfd: 2, crit: false});
});

test('N13 start-on-or-after constraint and an open-ended activity', () => {
  // A cannot start before Wed 08: Wed 08-16 = project finish. B, no links,
  // Mon 08-16; may finish Wed 16: float 16h.
  const r = solve({dataDate: MON, calendars: [C5], activities: [
    {id: 'A', calendar: 'C5', duration: 8, constraint: {type: 'start_on_or_after', date: '2027-01-06T08:00:00Z'}},
    {id: 'B', calendar: 'C5', duration: 8}], relationships: []});
  expectRow(r, 'A', {es: '2027-01-06T08:00Z', ef: '2027-01-06T16:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: MON, ef: '2027-01-04T16:00Z', lf: '2027-01-06T16:00Z', tf: 16, crit: false});
});

test('N14 finish-on-or-before deadline gives negative float', () => {
  // A 8h -> B 8h FS; C 32h open (project finish Thu 16). B must finish by
  // Tue 12 = position 12, early finish is position 16: float -4h (-0.5 day).
  // B late start = position 4 = Mon 12. A late finish = Mon 12, float -4h.
  const r = solve({dataDate: MON, calendars: [C5], activities: [
    {id: 'A', calendar: 'C5', duration: 8},
    {id: 'B', calendar: 'C5', duration: 8, constraint: {type: 'finish_on_or_before', date: '2027-01-05T12:00:00Z'}},
    {id: 'C', calendar: 'C5', duration: 32}], relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: 0}]});
  expectRow(r, 'B', {es: '2027-01-05T08:00Z', ef: '2027-01-05T16:00Z', ls: '2027-01-04T12:00Z', lf: '2027-01-05T12:00Z', tf: -4, tfd: -0.5, crit: true});
  expectRow(r, 'A', {es: MON, ef: '2027-01-04T16:00Z', ls: '2027-01-01T12:00Z', lf: '2027-01-04T12:00Z', tf: -4, crit: true});
  expectRow(r, 'C', {es: MON, ef: '2027-01-07T16:00Z', tf: 0, crit: true});
});

test('N15 FF with positive lag 8h', () => {
  // A 16h -> Tue 16 (position 16). B must finish at 16 + 8 = 24 = Wed 16,
  // so B (8h) runs Wed 08-16. A late finish: position + 8 <= 24 -> 16: no float.
  const r = solve({dataDate: MON, calendars: [C5], activities: [{id: 'A', calendar: 'C5', duration: 16}, {id: 'B', calendar: 'C5', duration: 8}],
    relationships: [{pred: 'A', succ: 'B', type: 'FF', lag: 8}]});
  expectRow(r, 'A', {es: MON, ef: '2027-01-05T16:00Z', lf: '2027-01-05T16:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-06T08:00Z', ef: '2027-01-06T16:00Z', tf: 0, crit: true});
});

test('N16 SS with negative lag -4h', () => {
  // A cannot start before Tue 08 (position 8): Tue 08-16 = project finish.
  // B SS -4: start >= 8 - 4 = 4 = Mon 12, ends Tue 12. B may finish Tue 16:
  // float 4h = 0.5 day.
  const r = solve({dataDate: MON, calendars: [C5], activities: [
    {id: 'A', calendar: 'C5', duration: 8, constraint: {type: 'start_on_or_after', date: '2027-01-05T08:00:00Z'}},
    {id: 'B', calendar: 'C5', duration: 8}], relationships: [{pred: 'A', succ: 'B', type: 'SS', lag: -4}]});
  expectRow(r, 'A', {es: '2027-01-05T08:00Z', ef: '2027-01-05T16:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-04T12:00Z', ef: '2027-01-05T12:00Z', lf: '2027-01-05T16:00Z', tf: 4, ff: 4, tfd: 0.5, crit: false});
});

test('N17 zero-duration activity takes the start of the next working hour', () => {
  // A 16h -> Tue 16. M (0h) sits at position 16, reported at the start
  // instant Wed 08. B 8h Wed 08-16. All on the critical path.
  const r = solve({dataDate: MON, calendars: [C5], activities: [
    {id: 'A', calendar: 'C5', duration: 16}, {id: 'M', calendar: 'C5', duration: 0}, {id: 'B', calendar: 'C5', duration: 8}],
  relationships: [{pred: 'A', succ: 'M', type: 'FS', lag: 0}, {pred: 'M', succ: 'B', type: 'FS', lag: 0}]});
  expectRow(r, 'M', {es: '2027-01-06T08:00Z', ef: '2027-01-06T08:00Z', ls: '2027-01-06T08:00Z', lf: '2027-01-06T08:00Z', tf: 0, crit: true});
  expectRow(r, 'B', {es: '2027-01-06T08:00Z', ef: '2027-01-06T16:00Z', tf: 0, crit: true});
});

test('N18 6-day calendar, SF with negative lag and progress', () => {
  // Data date Sat 2027-01-09 07:00 on C6 (Sat-Thu 07-17). P started Thu
  // 2027-01-07 07:00, 10h left: Sat 07-17. Q (20h) SF -10 from P's actual
  // start: Q finish >= pos(Thu 07) - 10 -> before the data date, so the data
  // date drives: Q Sat 07 -> Sun 17. Project finish Sun 17. P may finish
  // Sun 17: float 10h = 1 day (its SF start event is fixed by the actual start).
  const r = solve({dataDate: '2027-01-09T07:00:00Z', calendars: [C6], activities: [
    {id: 'P', calendar: 'C6', duration: 20, remaining: 10, actualStart: '2027-01-07T07:00:00Z'},
    {id: 'Q', calendar: 'C6', duration: 20}], relationships: [{pred: 'P', succ: 'Q', type: 'SF', lag: -10}]});
  expectRow(r, 'P', {es: '2027-01-09T07:00Z', ef: '2027-01-09T17:00Z', lf: '2027-01-10T17:00Z', tf: 10, ff: 10, tfd: 1, crit: false});
  expectRow(r, 'Q', {es: '2027-01-09T07:00Z', ef: '2027-01-10T17:00Z', tf: 0, crit: true});
});

test('the solver refuses missing or invented inputs instead of assuming them', () => {
  const base = {dataDate: MON, relationships: [] as unknown[]};
  assert.throws(() => solve({...base, calendars: [{id: 'X', workDays: [1], startHour: 8}], activities: [{id: 'A', calendar: 'X', duration: 8}]}), /hoursPerDay/);
  assert.throws(() => solve({...base, calendars: [C5], activities: [{id: 'A', calendar: 'C5', duration: 7.5}]}), /whole hours/);
  assert.throws(() => solve({...base, calendars: [C5], activities: [{id: 'A', calendar: 'NONE', duration: 8}]}), /calendar NONE unknown/);
  assert.throws(() => solve({dataDate: MON, calendars: [C5], activities: [{id: 'A', calendar: 'C5', duration: 8}, {id: 'B', calendar: 'C5', duration: 8}],
    relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: 0}, {pred: 'B', succ: 'A', type: 'FS', lag: 0}]}), /loop/);
  assert.throws(() => solve({...base, calendars: [C5], activities: [{id: 'A', calendar: 'C5', duration: 8, constraint: {type: 'mandatory_start', date: MON}}]}), /not supported/);
});
