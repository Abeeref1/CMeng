import test from 'node:test';
import assert from 'node:assert/strict';
import type {CanonicalCalendar, CanonicalScheduleActivity, CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src/adapters';
import {parseXerBytes} from '../packages/xer-parser/src/parser';
import {calculateCpm} from '../packages/schedule-cpm/src';
import {forecastQualifications} from '../packages/runtime-api/src/forecast-control';

// P6 retained logic with out-of-sequence progress, as the contractors' own P6
// dates show it (DMINFRA-101: 120 completed activities with an unfinished
// predecessor; UPTOWN-100: 317). Before this rule CMeng held such an activity
// at its actual dates, so its successors started at the data date: 978 and
// 1,007 activities more than 14 days from the P6 dates; after it, none.
// 1. The completed activity carries its unfinished predecessors' logic on, as
//    zero work, never before the data date (lags into it count).
// 2. Its FS/FF successors follow from that event without the link's lag.
// 3. SS/SF successors use its carried start only when the programme counts
//    start-to-start lag from Early Start (SCHEDOPTIONS.sched_lag_early_start_flag
//    = Y); from Actual Start they count from its actual start.
// 4. The backward pass runs through it: its predecessors lose that float.
// 5. With "from Early Start", an SS link from an in-progress predecessor counts
//    from its remaining early start, not its actual start.

const H = 3_600_000;
const dataDate = '2031-01-06T08:00:00.000Z';
const day: CanonicalCalendar = {calendarId: 'D', name: 'D', semanticComplete: true,
  weeklyWorkMinutes: [480, 480, 480, 480, 480, 480, 480],
  weeklyWorkIntervals: [1, 2, 3, 4, 5, 6, 7].map(dayIndex => ({dayIndex, intervals: [{start: '08:00', finish: '16:00', minutes: 480}]})),
  exceptions: [], standardDayHours: 8, standardWeekHours: 56, sourceRefs: []};

type A = {id: string; hours: number; status?: 'not_started' | 'in_progress' | 'completed'; start?: string; finish?: string; remaining?: number};
function model(acts: A[], links: Array<[string, string, 'FS' | 'SS' | 'FF' | 'SF', number]>, ssFromEarlyStart?: boolean): CanonicalScheduleModel {
  const activities = acts.map(a => ({projectId: 'OOS', activityId: a.id, nativeId: null, name: a.id, wbsId: null, calendarId: 'D',
    activityType: 'task', status: a.status ?? 'not_started', baselineStartIso: null, baselineFinishIso: null,
    currentStartIso: null, currentFinishIso: null, actualStartIso: a.start ?? null, actualFinishIso: a.status === 'completed' ? a.finish ?? null : null,
    forecastStartIso: null, forecastFinishIso: null, originalDurationHours: a.hours,
    remainingDurationHours: a.status === 'completed' ? 0 : a.remaining ?? a.hours, totalFloatHours: null, freeFloatHours: null,
    percentComplete: null, sourceRefs: [], diagnostics: []}) as unknown as CanonicalScheduleActivity);
  return {projectId: 'OOS', source: 'xer', sourceRevisionId: 'OOS', dataDateIso: dataDate, wbs: [], diagnostics: [], calendars: [day], activities,
    relationships: links.map(([p, s, type, lag]) => ({projectId: 'OOS', predecessorActivityId: p, successorActivityId: s, type, lagHours: lag, sourceRefs: [], diagnostics: []})),
    ...(ssFromEarlyStart === undefined ? {} : {startToStartLagFromEarlyStart: {value: ssFromEarlyStart, sourceValue: ssFromEarlyStart ? 'Y' : 'N', sourceRef: 'test'}}),
  } as unknown as CanonicalScheduleModel;
}
const run = (m: CanonicalScheduleModel) => {
  const r = calculateCpm(m, {allowElapsedFallback: false});
  return {r, a: new Map(r.activities.map(x => [x.activityId, x]))};
};
const at = (iso: string | null | undefined) => iso ? Date.parse(iso) : NaN;

test('a completed activity with an unfinished predecessor carries its logic on; the link lag out of it is dropped', () => {
  // A (16 h, from the data date) -> B (completed out of sequence) -FS +8 h-> C (8 h).
  const {r, a} = run(model([
    {id: 'A', hours: 16},
    {id: 'B', hours: 16, status: 'completed', start: '2031-01-01T08:00:00.000Z', finish: '2031-01-02T16:00:00.000Z'},
    {id: 'C', hours: 8},
  ], [['A', 'B', 'FS', 0], ['B', 'C', 'FS', 8]]));
  assert.equal(a.get('A')!.earlyFinishIso, '2031-01-07T16:00:00.000Z');
  // C follows A through B (not the data date), and B's 8 h lag is not added.
  assert.equal(a.get('C')!.earlyFinishIso, '2031-01-08T16:00:00.000Z');
  assert.equal(r.projectFinishIso, '2031-01-08T16:00:00.000Z');
  // B keeps its actual dates.
  assert.equal(a.get('B')!.earlyStartIso, '2031-01-01T08:00:00.000Z');
  assert.equal(a.get('B')!.earlyFinishIso, '2031-01-02T16:00:00.000Z');
  // The backward pass runs through B: A drives the finish and has no float.
  assert.equal(a.get('A')!.totalFloatHours, 0);
  assert.ok(r.drivingNetwork?.activityIds.includes('A') && r.drivingNetwork?.activityIds.includes('B'));
});

test('a lag into the completed activity counts; its FF successor follows the carried finish', () => {
  // A (8 h) -FF +8 h-> B (completed) -FF 0-> C (8 h).
  const {a} = run(model([
    {id: 'A', hours: 8},
    {id: 'B', hours: 8, status: 'completed', start: '2031-01-01T08:00:00.000Z', finish: '2031-01-01T16:00:00.000Z'},
    {id: 'C', hours: 8},
  ], [['A', 'B', 'FF', 8], ['B', 'C', 'FF', 0]]));
  // A finishes 6 Jan 16:00; B's carried finish is 8 working hours later (7 Jan 16:00).
  assert.equal(a.get('C')!.earlyFinishIso, '2031-01-07T16:00:00.000Z');
});

test('SS from the completed activity: actual start by default, carried start when SS lag counts from Early Start', () => {
  const acts: A[] = [
    {id: 'A', hours: 16},
    {id: 'B', hours: 16, status: 'completed', start: '2031-01-01T08:00:00.000Z', finish: '2031-01-02T16:00:00.000Z'},
    {id: 'C', hours: 8},
  ];
  const links: Array<[string, string, 'FS' | 'SS' | 'FF' | 'SF', number]> = [['A', 'B', 'FS', 0], ['B', 'C', 'SS', 0]];
  for (const option of [undefined, false]) {
    const {a} = run(model(acts, links, option));
    assert.equal(a.get('C')!.earlyStartIso, dataDate, 'option ' + option);
  }
  const {a} = run(model(acts, links, true));
  assert.ok(at(a.get('C')!.earlyStartIso) >= at('2031-01-07T16:00:00.000Z'), a.get('C')!.earlyStartIso!);
  assert.equal(a.get('C')!.earlyFinishIso, '2031-01-08T16:00:00.000Z');
});

test('SS from an in-progress predecessor counts from its remaining start when the programme says Early Start', () => {
  // X (8 h) -> P (in progress, 8 h left) -SS 0-> Q (8 h).
  const acts: A[] = [
    {id: 'X', hours: 8},
    {id: 'P', hours: 16, status: 'in_progress', start: '2031-01-03T08:00:00.000Z', remaining: 8},
    {id: 'Q', hours: 8},
  ];
  const links: Array<[string, string, 'FS' | 'SS' | 'FF' | 'SF', number]> = [['X', 'P', 'FS', 0], ['P', 'Q', 'SS', 0]];
  const fromActual = run(model(acts, links, false)).a;
  assert.equal(fromActual.get('Q')!.earlyStartIso, dataDate);
  const fromEarly = run(model(acts, links, true)).a;
  assert.equal(fromEarly.get('Q')!.earlyFinishIso, '2031-01-07T16:00:00.000Z');
  assert.ok(at(fromEarly.get('Q')!.earlyStartIso) - at(dataDate) >= 8 * H - 1);
});

test('the XER reader takes "Calculate start-to-start lag from" from SCHEDOPTIONS', () => {
  const xer = (flag: string) => ['ERMHDR\t24.12', '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tlast_recalc_date', '%R\t1\tP1\t2031-01-06 08:00',
    '%T\tSCHEDOPTIONS', '%F\tschedoptions_id\tproj_id\tsched_lag_early_start_flag', '%R\t1\t1\t' + flag, '%E'].join('\r\n');
  const read = (flag: string) => canonicalScheduleFromXer(parseXerBytes(Buffer.from(xer(flag))), {sourceRevisionId: 't'}).startToStartLagFromEarlyStart;
  assert.deepEqual(read('Y'), {value: true, sourceValue: 'Y', sourceRef: 'XER SCHEDOPTIONS.sched_lag_early_start_flag'});
  assert.equal(read('N')?.value, false);
  assert.equal(read('maybe'), undefined);
});

test('an assumed calendar names each calendar and the working time the file lacks (RYD-NME-PKG-C)', () => {
  const m = model([{id: 'A', hours: 8}, {id: 'B', hours: 8}], []);
  m.activities[1]!.calendarId = 'X';
  m.calendars = [{...day, calendarId: 'D', name: '6D-10H', semanticComplete: false, sourceConversionDayHours: 10, sourceConversionWeekHours: 60} as CanonicalCalendar,
    {...day, calendarId: 'X', name: 'EMPTY', semanticComplete: false} as CanonicalCalendar];
  const q = forecastQualifications({forecast: {assumedCalendarOpenActivityIds: ['A', 'B'], diagnostics: [], assumptions: []} as never, model: m,
    materialActivityScreeningDays: 14, materialDivergences: 0, unappliedConstraints: 0, graphDiagnostics: 0}).find(x => x.code === 'assumed_calendar')!;
  assert.match(q.text, /2 open activities have no readable working calendar/);
  assert.equal(q.action, 'Supply the working days, shift start and finish times and holidays for “6D-10H” (the file gives 10 h a day and 60 h a week only); “EMPTY” (the file gives no working time).');
});
