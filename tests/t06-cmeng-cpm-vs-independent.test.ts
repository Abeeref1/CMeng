import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import type {CanonicalCalendar, CanonicalScheduleActivity, CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {calculateCpm, workingHoursBetween} from '../packages/schedule-cpm/src';

// T06 judged by T12: CMeng's CPM engine against the independent solver
// (tools/independent/cpm-solver.cjs, validated by
// tests/t12-independent-cpm-solver.test.ts) on the same networks.
//
// Allowed basis difference B1 (instant convention): CMeng may show a date at
// the closing instant of a working day where the solver shows the opening
// instant of the next working day (or the reverse). These are the same
// working moment: zero working hours lie between them on the activity's own
// calendar, and floats must still be identical.
//
// Further basis differences found on mixed calendars (documented, see the
// last tests): B2 CMeng holds an FF/SF finish at the predecessor's event
// instant across the successor's nonworking time; B3 the solver puts a zero
// duration activity at the next opening of its own calendar, CMeng at the
// closing instant; B4 CMeng lets an SS/SF start event sit at a closing
// instant. Each moves dates by part of a nonworking gap and floats by about
// one hour, only where calendars differ across a start-type link or a
// zero-duration activity.
//
// Open CMeng defects (todo tests below, fail today, must pass once fixed):
// D1 negative total float with no deadline at all (cross-calendar FS into a
//    zero-duration activity whose late start is shown at the previous close);
// D2 SS lag from an in-progress predecessor counted from the data date
//    instead of its actual start.

const requireCjs = createRequire(__filename);
const {solve} = requireCjs(resolve(process.cwd(), 'tools/independent/cpm-solver.cjs'));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Net = {dataDate: string; calendars: any[]; activities: any[]; relationships: any[]};
const pad = (n: number) => String(n).padStart(2, '0');
function toCalendar(c: any): CanonicalCalendar {
  const iv = {start: pad(c.startHour) + ':00', finish: pad(c.startHour + c.hoursPerDay) + ':00', minutes: c.hoursPerDay * 60};
  const weeklyWorkIntervals = [0, 1, 2, 3, 4, 5, 6].map(d => ({dayIndex: d + 1, intervals: c.workDays.includes(d) ? [iv] : []}));
  return {calendarId: c.id, name: c.id, semanticComplete: true,
    weeklyWorkMinutes: weeklyWorkIntervals.map(d => d.intervals.length ? c.hoursPerDay * 60 : 0) as NonNullable<CanonicalCalendar['weeklyWorkMinutes']>,
    weeklyWorkIntervals, exceptions: (c.holidays || []).map((isoDate: string) => ({isoDate, nonWorking: true, workIntervals: []})),
    standardDayHours: c.hoursPerDay, standardWeekHours: c.hoursPerDay * c.workDays.length, sourceRefs: []};
}
function toModel(net: Net): CanonicalScheduleModel {
  const iso = (v?: string) => v ? new Date(Date.parse(v)).toISOString() : null;
  const activities: CanonicalScheduleActivity[] = net.activities.map(a => {
    const status = a.actualFinish ? 'completed' : a.actualStart ? 'in_progress' : 'not_started';
    return {projectId: 'T06', activityId: a.id, nativeId: null, name: a.id, wbsId: null, calendarId: a.calendar,
      activityType: 'task', status, baselineStartIso: null, baselineFinishIso: null, currentStartIso: null, currentFinishIso: null,
      actualStartIso: iso(a.actualStart), actualFinishIso: iso(a.actualFinish), forecastStartIso: null, forecastFinishIso: null,
      originalDurationHours: a.duration, remainingDurationHours: status === 'in_progress' ? a.remaining : status === 'completed' ? 0 : a.duration,
      totalFloatHours: null, freeFloatHours: null, percentComplete: null, sourceRefs: [], diagnostics: [],
      ...(a.constraint ? {sourceConstraints: [{type: a.constraint.type === 'start_on_or_after' ? 'CS_MSOA' : 'CS_MEOB', dateIso: iso(a.constraint.date)}]} : {}),
    } as CanonicalScheduleActivity;
  });
  return {projectId: 'T06', source: 'xer', sourceRevisionId: 'T06', dataDateIso: iso(net.dataDate), wbs: [], diagnostics: [],
    calendars: net.calendars.map(toCalendar), activities,
    relationships: net.relationships.map((r, i) => ({relationshipId: 'R' + i, predecessorActivityId: r.pred, successorActivityId: r.succ,
      type: r.type, lagHours: r.lag || 0, external: false, sourceRefs: [], diagnostics: []})),
  } as CanonicalScheduleModel;
}

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const CALS = [
  {id: 'C5', workDays: [1, 2, 3, 4, 5], startHour: 8, hoursPerDay: 8, holidays: ['2027-01-13']},
  {id: 'C6', workDays: [6, 0, 1, 2, 3, 4], startHour: 7, hoursPerDay: 10, holidays: ['2027-01-17']},
  {id: 'C7', workDays: [0, 1, 2, 3, 4, 5, 6], startHour: 0, hoursPerDay: 24, holidays: []},
];
function randomNet(seed: number, opts: {types: string[]; mixed: boolean; negative?: boolean; minDur?: number}): Net {
  const r = rng(seed), n = 6 + Math.floor(r() * 14);
  const cals = opts.mixed ? CALS : [CALS[Math.floor(r() * 3)]!];
  const activities: any[] = [];
  for (let i = 0; i < n; i++) activities.push({id: 'A' + i, calendar: cals[Math.floor(r() * cals.length)]!.id,
    duration: Math.max(opts.minDur || 0, Math.floor(r() * 5) * 8 + (r() < 0.3 ? Math.floor(r() * 6) : 0))});
  const relationships: any[] = [];
  for (let j = 1; j < n; j++) {
    const k = 1 + Math.floor(r() * 2);
    for (let q = 0; q < k; q++) {
      const i = Math.floor(r() * j);
      if (relationships.some(x => x.pred === 'A' + i && x.succ === 'A' + j)) continue;
      const type = opts.types[Math.floor(r() * opts.types.length)];
      const lag = r() < 0.5 ? 0 : (opts.negative && r() < 0.4 ? -1 : 1) * Math.floor(r() * 12);
      relationships.push({pred: 'A' + i, succ: 'A' + j, type, lag});
    }
  }
  return {dataDate: '2027-01-04T08:00:00Z', calendars: cals, activities, relationships};
}
const familySeed = (name: string, s: number) => s * 7919 + name.length;

type Mismatch = {id: string; field: string; independent: unknown; cmeng: unknown};
function compare(net: Net) {
  const independent = solve(net);
  const model = toModel(net);
  const cmeng = calculateCpm(model, {allowElapsedFallback: false, assumeMissingLagZero: false, assumeUnknownRelationshipTypeFs: false, applySourceConstraints: true});
  const real: Mismatch[] = [];
  let sameMoment = 0;
  if (independent.projectFinish !== cmeng.projectFinishIso) real.push({id: '*', field: 'projectFinish', independent: independent.projectFinish, cmeng: cmeng.projectFinishIso});
  for (const a of independent.activities) {
    const c = cmeng.activities.find(x => x.activityId === a.id)!;
    const cal = model.calendars.find(k => k.calendarId === a.calendar)!;
    for (const [f, g] of [['earlyStart', 'earlyStartIso'], ['earlyFinish', 'earlyFinishIso'], ['lateStart', 'lateStartIso'], ['lateFinish', 'lateFinishIso']] as const) {
      if (a[f] === c[g]) continue;
      if (typeof a[f] === 'string' && typeof c[g] === 'string') {
        const x = Date.parse(a[f]), y = Date.parse(c[g]!);
        if (workingHoursBetween(cal, Math.min(x, y), Math.max(x, y)) === 0) { sameMoment += 1; continue; } // B1
      }
      real.push({id: a.id, field: f, independent: a[f], cmeng: c[g]});
    }
    if (a.totalFloatHours !== c.totalFloatHours) real.push({id: a.id, field: 'totalFloatHours', independent: a.totalFloatHours, cmeng: c.totalFloatHours});
    if (a.critical !== c.critical) real.push({id: a.id, field: 'critical', independent: a.critical, cmeng: c.critical});
  }
  return {real, sameMoment, independent, cmeng};
}

// The 18 hand-worked networks of tests/t12-independent-cpm-solver.test.ts.
const C5 = {id: 'C5', workDays: [1, 2, 3, 4, 5], startHour: 8, hoursPerDay: 8, holidays: [] as string[]};
const C5H = {...C5, id: 'C5H', holidays: ['2027-01-06']};
const C6 = {id: 'C6', workDays: [6, 0, 1, 2, 3, 4], startHour: 7, hoursPerDay: 10, holidays: [] as string[]};
const C7 = {id: 'C7', workDays: [0, 1, 2, 3, 4, 5, 6], startHour: 0, hoursPerDay: 24, holidays: [] as string[]};
const MON = '2027-01-04T08:00:00Z';
const act = (id: string, calendar: string, duration: number, extra: object = {}) => ({id, calendar, duration, ...extra});
const rel = (pred: string, succ: string, type: string, lag = 0) => ({pred, succ, type, lag});
const N12: Net = {dataDate: '2027-01-06T08:00:00Z', calendars: [C5], activities: [
  act('A', 'C5', 16, {actualStart: MON, actualFinish: '2027-01-05T16:00:00Z'}), act('B', 'C5', 24, {remaining: 16, actualStart: '2027-01-05T08:00:00Z'}),
  act('C', 'C5', 8), act('D', 'C5', 8)], relationships: [rel('A', 'B', 'SS'), rel('A', 'C', 'FS'), rel('B', 'C', 'FS'), rel('B', 'D', 'SS', 8)]};
const HAND: Array<[string, Net]> = [
  ['N1', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 16), act('B', 'C5', 24), act('C', 'C5', 8)], relationships: [rel('A', 'B', 'FS'), rel('A', 'C', 'FS')]}],
  ['N2', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 8), act('B', 'C5', 8)], relationships: [rel('A', 'B', 'FS', 4)]}],
  ['N3', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 16), act('B', 'C5', 8)], relationships: [rel('A', 'B', 'FS', -4)]}],
  ['N4', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 24), act('B', 'C5', 8)], relationships: [rel('A', 'B', 'SS', 8)]}],
  ['N5', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 16), act('B', 'C5', 8), act('C', 'C5', 24)], relationships: [rel('A', 'B', 'FF')]}],
  ['N6', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 8), act('B', 'C5', 4)], relationships: [rel('A', 'B', 'SF', 8)]}],
  ['N7', {dataDate: '2027-01-07T07:00:00Z', calendars: [C6], activities: [act('A', 'C6', 20), act('B', 'C6', 30), act('C', 'C6', 10)], relationships: [rel('A', 'B', 'FS'), rel('A', 'C', 'FS')]}],
  ['N8', {dataDate: '2027-01-08T00:00:00Z', calendars: [C7], activities: [act('A', 'C7', 36), act('B', 'C7', 12), act('C', 'C7', 4)], relationships: [rel('A', 'B', 'FS', -6), rel('A', 'C', 'FS')]}],
  ['N9', {dataDate: MON, calendars: [C5H], activities: [act('A', 'C5H', 24), act('B', 'C5H', 8), act('C', 'C5H', 8)], relationships: [rel('A', 'B', 'FS')]}],
  ['N10', {dataDate: MON, calendars: [C5, C7], activities: [act('A', 'C5', 8), act('B', 'C7', 10)], relationships: [rel('A', 'B', 'FS', 8)]}],
  ['N11', {dataDate: MON, calendars: [C5, C7], activities: [act('A', 'C7', 20), act('B', 'C5', 8)], relationships: [rel('A', 'B', 'FS')]}],
  ['N13', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 8, {constraint: {type: 'start_on_or_after', date: '2027-01-06T08:00:00Z'}}), act('B', 'C5', 8)], relationships: []}],
  ['N14', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 8), act('B', 'C5', 8, {constraint: {type: 'finish_on_or_before', date: '2027-01-05T12:00:00Z'}}), act('C', 'C5', 32)], relationships: [rel('A', 'B', 'FS')]}],
  ['N15', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 16), act('B', 'C5', 8)], relationships: [rel('A', 'B', 'FF', 8)]}],
  ['N16', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 8, {constraint: {type: 'start_on_or_after', date: '2027-01-05T08:00:00Z'}}), act('B', 'C5', 8)], relationships: [rel('A', 'B', 'SS', -4)]}],
  ['N17', {dataDate: MON, calendars: [C5], activities: [act('A', 'C5', 16), act('M', 'C5', 0), act('B', 'C5', 8)], relationships: [rel('A', 'M', 'FS'), rel('M', 'B', 'FS')]}],
  ['N18', {dataDate: '2027-01-09T07:00:00Z', calendars: [C6], activities: [act('P', 'C6', 20, {remaining: 10, actualStart: '2027-01-07T07:00:00Z'}), act('Q', 'C6', 20)], relationships: [rel('P', 'Q', 'SF', -10)]}],
];

test('hand-worked networks: CMeng dates, floats and critical flags equal the independent solver', () => {
  let sameMoment = 0;
  for (const [name, net] of HAND) {
    const r = compare(net);
    assert.deepEqual(r.real, [], name);
    sameMoment += r.sameMoment;
  }
  // N17: CMeng shows the zero-duration activity's late start at Tue 16:00,
  // the solver at Wed 08:00. Same working moment (B1), zero float either way.
  assert.equal(sameMoment, 1);
});

test('30 random single-calendar networks (FS/SS/FF/SF, positive and negative lags, milestones) agree', () => {
  for (let s = 1; s <= 30; s += 1) {
    const net = randomNet(familySeed('all-single-neg', s), {types: ['FS', 'SS', 'FF', 'SF'], mixed: false, negative: true});
    assert.deepEqual(compare(net).real, [], 'single-calendar seed ' + s);
  }
});

test('20 random mixed-calendar FS networks (5-day, 6-day, 24h, holidays, signed lags) agree', () => {
  for (let s = 1; s <= 20; s += 1) {
    const net = randomNet(familySeed('fs-mixed-nomile', s), {types: ['FS'], mixed: true, negative: true, minDur: 1});
    assert.deepEqual(compare(net).real, [], 'mixed FS seed ' + s);
  }
});

test('mixed-calendar start-type links and milestones: differences stay inside the documented basis (B2 to B4)', () => {
  // Every difference must sit in a network that has a cross-calendar SS/SF/FF
  // link or a zero-duration activity, and no difference may be a negative
  // float that the solver does not have.
  let networksWithDifferences = 0;
  for (let s = 1; s <= 20; s += 1) {
    const net = randomNet(familySeed('all-mixed-neg', s), {types: ['FS', 'SS', 'FF', 'SF'], mixed: true, negative: true});
    const r = compare(net);
    if (r.real.length === 0) continue;
    networksWithDifferences += 1;
    const cal = new Map(net.activities.map(a => [a.id, a.calendar]));
    const trigger = net.activities.some(a => a.duration === 0) ||
      net.relationships.some(x => x.type !== 'FS' && cal.get(x.pred) !== cal.get(x.succ));
    assert.ok(trigger, 'seed ' + s + ' differs without a documented basis trigger: ' + JSON.stringify(r.real.slice(0, 4)));
    for (const a of r.cmeng.activities) {
      const own = r.independent.activities.find((x: any) => x.id === a.activityId);
      if (a.totalFloatHours !== null && a.totalFloatHours < 0) assert.ok(own.totalFloatHours < 0, 'seed ' + s + ' negative float only in CMeng: ' + a.activityId);
    }
  }
  assert.ok(networksWithDifferences > 0, 'the basis differences are real and must stay visible');
});

test('D1 open defect: no negative total float without a deadline (cross-calendar FS into a milestone)', {todo: 'CMeng engine.ts late start of a zero-duration activity is taken at the previous closing instant; a predecessor on a calendar that works through that gap is forced to finish before its early finish'}, () => {
  // Generated network fs-mixed seed 29: A0 (6-day) -> A1 (6-day) -> A2 (5-day
  // milestone). A1 finishes Sat 2027-01-09 16:00; A2 is at Mon 08:00. A1 may
  // finish as late as Mon 2027-01-11 08:00 on its own calendar: float +12h.
  // CMeng gives A2 late start Fri 2027-01-08 16:00 and A0/A1 float -9h.
  const net = randomNet(familySeed('fs-mixed', 29), {types: ['FS'], mixed: true});
  const r = compare(net);
  for (const id of ['A0', 'A1']) {
    const c = r.cmeng.activities.find(a => a.activityId === id)!;
    const own = r.independent.activities.find((a: any) => a.id === id);
    assert.equal(own.totalFloatHours, 12);
    assert.equal(c.totalFloatHours, own.totalFloatHours, id);
  }
});

test('D2 open defect: SS lag from an in-progress predecessor counts from its actual start', {todo: 'CMeng engine.ts uses the remaining early start (data date) of an in-progress predecessor as its SS/SF start event'}, () => {
  // Hand network N12: B started Tue 08:00; D is SS +8h from B, so D may start
  // Wed 08:00 (the data date) and has 16h float. CMeng starts D Thu 08:00 with 8h float.
  const r = compare(N12);
  const d = r.cmeng.activities.find(a => a.activityId === 'D')!;
  assert.equal(d.earlyStartIso, '2027-01-06T08:00:00.000Z');
  assert.equal(d.totalFloatHours, 16);
});
