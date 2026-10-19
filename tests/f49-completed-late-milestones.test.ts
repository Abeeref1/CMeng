import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {buildMilestonesProjection} from '../packages/milestones-analysis/src';
import type {CanonicalScheduleActivity, CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// F49 (D-163): completed milestones that finished late must be listed, with
// days late in working days on the milestone's own calendar. The working-day
// figure is checked against the independent CPM solver (tools/independent):
// an activity of (working days x day hours) that starts at the baseline date
// must finish exactly at the actual date on the same calendar.

const requireCjs = createRequire(__filename);
const {solve} = requireCjs(resolve(process.cwd(), 'tools/independent/cpm-solver.cjs'));

// Sunday to Thursday, 08:00 to 16:00 UTC, Wednesday 2027-01-06 a holiday.
const calendar = {
  calendarId: 'GCC5', name: 'Sun-Thu 8h', semanticComplete: true,
  standardDayHours: 8, standardWeekHours: 40,
  weeklyWorkIntervals: [1, 2, 3, 4, 5].map(dayIndex => ({dayIndex, intervals: [{start: '08:00', finish: '16:00', minutes: 480}]})),
  exceptions: [{isoDate: '2027-01-06', nonWorking: true, workIntervals: []}],
  sourceRefs: [],
};
const independentCalendar = {id: 'GCC5', workDays: [0, 1, 2, 3, 4], startHour: 8, hoursPerDay: 8, holidays: ['2027-01-06']};

function act(id: string, over: Partial<CanonicalScheduleActivity>): CanonicalScheduleActivity {
  return {
    projectId: 'PF49', activityId: id, nativeId: null, name: id, wbsId: null, calendarId: 'GCC5',
    activityType: 'finish_milestone', status: 'completed',
    baselineStartIso: null, baselineFinishIso: null, currentStartIso: null, currentFinishIso: null,
    actualStartIso: null, actualFinishIso: null, forecastStartIso: null, forecastFinishIso: null,
    originalDurationHours: 0, remainingDurationHours: 0, totalFloatHours: null, freeFloatHours: null,
    percentComplete: 100, sourceRefs: [], diagnostics: [], ...over,
  } as CanonicalScheduleActivity;
}
const done = (id: string, name: string, baseline: string | null, actual: string | null, over: Partial<CanonicalScheduleActivity> = {}) =>
  act(id, {name, baselineStartIso: baseline, baselineFinishIso: baseline, currentStartIso: actual, currentFinishIso: actual, actualStartIso: actual, actualFinishIso: actual, ...over});

function model(): CanonicalScheduleModel {
  return {
    projectId: 'PF49', source: 'xer', sourceRevisionId: 'rev-f49', dataDateIso: '2027-02-01T08:00:00Z',
    activities: [
      done('M-LAND', 'Landscaping complete', '2027-01-04T16:00:00Z', '2027-01-11T16:00:00Z'),
      done('M-VILLA', 'Villa Type C complete', '2027-01-04T16:00:00Z', '2027-01-05T16:00:00Z'),
      done('M-ONTIME', 'On time', '2027-01-04T16:00:00Z', '2027-01-04T16:00:00Z'),
      done('M-EARLY', 'Early', '2027-01-11T16:00:00Z', '2027-01-04T16:00:00Z'),
      done('M-NOBASE', 'No baseline', null, '2027-01-11T16:00:00Z'),
      done('M-NOCAL', 'No calendar', '2027-01-04T16:00:00Z', '2027-01-07T16:00:00Z', {calendarId: null}),
      act('M-OPEN', {name: 'Open and forecast late', status: 'not_started', baselineFinishIso: '2027-01-04T16:00:00Z', currentFinishIso: '2027-03-01T16:00:00Z', percentComplete: 0}),
      done('T-TASK', 'A task, not a milestone', '2027-01-04T16:00:00Z', '2027-01-20T16:00:00Z', {activityType: 'task', originalDurationHours: 8}),
    ],
    relationships: [], wbs: [], calendars: [calendar as never], diagnostics: [],
  } as unknown as CanonicalScheduleModel;
}

test('F49: completed-late milestones are listed with working days late on the milestone calendar', () => {
  const p = buildMilestonesProjection(model(), {generatedAt: '2027-02-01T08:00:00Z', producerVersion: 'f49'});
  const late = p.completedLate;
  assert.ok(late, 'completedLate block present');
  assert.equal(late.basis, 'actual_date_after_baseline_date');
  assert.match(late.formula, /working hours between baseline date and actual date on the milestone calendar/);
  assert.deepEqual(late.milestones.map(m => m.activityId), ['M-LAND', 'M-VILLA', 'M-NOCAL']);
  assert.equal(late.count, 3);
  assert.equal(late.completedCount, 6);
  assert.equal(late.comparableCount, 5);
  assert.equal(late.notComparableCount, 1, 'missing baseline is unknown, not on time');
  assert.deepEqual(late.notComparableActivityIds, ['M-NOBASE']);

  const land = late.milestones[0]!;
  // Tue 5, Thu 7, Sun 10, Mon 11 (Wed 6 holiday; Fri/Sat off) = 4 working days; 7 calendar days.
  assert.equal(land.lateWorkingDays, 4);
  assert.equal(land.lateCalendarDays, 7);
  assert.equal(land.name, 'Landscaping complete');
  assert.equal(land.baselineDateIso, '2027-01-04T16:00:00Z');
  assert.equal(land.actualDateIso, '2027-01-11T16:00:00Z');
  assert.equal(late.milestones[1]!.lateWorkingDays, 1);
  const noCal = late.milestones[2]!;
  assert.equal(noCal.lateWorkingDays, null, 'no calendar: working days unknown, never assumed');
  assert.equal(noCal.lateCalendarDays, 3);
});

test('F49: working days late agree with the independent CPM solver', () => {
  const p = buildMilestonesProjection(model(), {generatedAt: '2027-02-01T08:00:00Z', producerVersion: 'f49'});
  for (const m of p.completedLate!.milestones.filter(x => x.lateWorkingDays !== null)) {
    const hours = m.lateWorkingDays! * independentCalendar.hoursPerDay;
    const result = solve({
      dataDate: m.baselineDateIso, calendars: [independentCalendar],
      activities: [{id: 'X', calendar: 'GCC5', duration: hours}], relationships: [],
    });
    const x = result.activities.find((a: {id: string}) => a.id === 'X');
    assert.equal(x.earlyFinish, new Date(m.actualDateIso).toISOString(), m.activityId + ' independent finish');
  }
});
