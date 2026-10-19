import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import type {CanonicalCalendar, CanonicalScheduleActivity, CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {workingHoursBetween} from '../packages/schedule-cpm/src';
import {buildIndependentForecastProjection} from '../packages/independent-forecast/src';

// F26 (D-013, D-044, D-049, D-051, D-077): the CPM must be run both with and
// without the source constraints, and the difference in completion shown.
// Both CMeng runs are judged by the independent solver (tools/independent).

const requireCjs = createRequire(__filename);
const {solve} = requireCjs(resolve(process.cwd(), 'tools/independent/cpm-solver.cjs'));

const C5 = {id: 'C5', workDays: [1, 2, 3, 4, 5], startHour: 8, hoursPerDay: 8, holidays: [] as string[]};
const iv = {start: '08:00', finish: '16:00', minutes: 480};
const calendar: CanonicalCalendar = {
  calendarId: 'C5', name: 'C5', semanticComplete: true,
  weeklyWorkMinutes: [0, 480, 480, 480, 480, 480, 0],
  weeklyWorkIntervals: [0, 1, 2, 3, 4, 5, 6].map(d => ({dayIndex: d + 1, intervals: C5.workDays.includes(d) ? [iv] : []})),
  exceptions: [], standardDayHours: 8, standardWeekHours: 40, sourceRefs: [],
} as CanonicalCalendar;

const DATA_DATE = '2027-01-04T08:00:00.000Z'; // Monday
const MSOA = '2027-01-18T08:00:00.000Z'; // start on or after, two weeks later

function act(id: string, hours: number, constrained: boolean): CanonicalScheduleActivity {
  return {projectId: 'F26', activityId: id, nativeId: null, name: id, wbsId: null, calendarId: 'C5', activityType: 'task',
    status: 'not_started', baselineStartIso: null, baselineFinishIso: null, currentStartIso: null, currentFinishIso: null,
    actualStartIso: null, actualFinishIso: null, forecastStartIso: null, forecastFinishIso: null,
    originalDurationHours: hours, remainingDurationHours: hours, totalFloatHours: null, freeFloatHours: null,
    percentComplete: 0, sourceRefs: [], diagnostics: [],
    ...(constrained ? {sourceConstraints: [{type: 'CS_MSOA', dateIso: MSOA}]} : {}),
  } as CanonicalScheduleActivity;
}
function model(withConstraint: boolean): CanonicalScheduleModel {
  return {projectId: 'F26', source: 'xer', sourceRevisionId: 'F26-' + withConstraint, dataDateIso: DATA_DATE, wbs: [], diagnostics: [],
    calendars: [calendar], activities: [act('A', 16, false), act('B', 24, withConstraint), act('C', 8, false)],
    relationships: [
      {relationshipId: 'R1', predecessorActivityId: 'A', successorActivityId: 'B', type: 'FS', lagHours: 0, external: false, sourceRefs: [], diagnostics: []},
      {relationshipId: 'R2', predecessorActivityId: 'B', successorActivityId: 'C', type: 'FS', lagHours: 0, external: false, sourceRefs: [], diagnostics: []},
    ]} as CanonicalScheduleModel;
}
function independentFinish(withConstraint: boolean): string {
  const r = solve({dataDate: DATA_DATE, calendars: [C5], relationships: [{pred: 'A', succ: 'B', type: 'FS'}, {pred: 'B', succ: 'C', type: 'FS'}],
    activities: [{id: 'A', calendar: 'C5', duration: 16}, {id: 'B', calendar: 'C5', duration: 24, ...(withConstraint ? {constraint: {type: 'start_on_or_after', date: MSOA}} : {})}, {id: 'C', calendar: 'C5', duration: 8}]});
  return r.activities.find((a: {id: string}) => a.id === 'C').earlyFinish;
}
// Basis difference B1 (t06 test): closing instant vs next opening are the same working moment.
function sameWorkingMoment(a: string | null, b: string) {
  assert.ok(a, 'CMeng completion resolved');
  assert.equal(workingHoursBetween(calendar as never, Math.min(Date.parse(a), Date.parse(b)), Math.max(Date.parse(a), Date.parse(b))), 0, a + ' vs ' + b);
}

test('F26: forecast publishes the CPM with and without the source constraints and the difference', () => {
  const p = buildIndependentForecastProjection(model(true), {generatedAt: DATA_DATE, producerVersion: 'f26', cpmConfig: {applySourceConstraints: true}});
  const c = p.constraintComparison;
  assert.ok(c, 'constraintComparison present');
  assert.equal(c.basis, 'source_constraints_applied_vs_not_applied');
  assert.equal(c.constrainedActivityCount, 1);
  assert.match(c.formula, /completion with source constraints - completion without source constraints/);
  assert.equal(c.withConstraintsCompletionIso, p.independentForecastCompletionIso);
  sameWorkingMoment(c.withConstraintsCompletionIso, independentFinish(true));
  sameWorkingMoment(c.withoutConstraintsCompletionIso, independentFinish(false));
  // Without: A Mon-Tue, B Wed-Fri, C Mon 11 -> finish Mon 11 16:00.
  // With: B starts Mon 18, ends Wed 20, C Thu 21 -> finish Thu 21 16:00. Difference 10 calendar days.
  assert.equal(c.differenceCalendarDays, 10);
});

test('F26: no source constraints means one identical network, difference 0; no comparison unless asked', () => {
  const p = buildIndependentForecastProjection(model(false), {generatedAt: DATA_DATE, producerVersion: 'f26', cpmConfig: {applySourceConstraints: true}});
  assert.equal(p.constraintComparison?.basis, 'no_source_constraints_identical_network');
  assert.equal(p.constraintComparison?.constrainedActivityCount, 0);
  assert.equal(p.constraintComparison?.differenceCalendarDays, 0);
  sameWorkingMoment(p.constraintComparison!.withoutConstraintsCompletionIso, independentFinish(false));
  const plain = buildIndependentForecastProjection(model(true), {generatedAt: DATA_DATE, producerVersion: 'f26'});
  assert.equal(plain.constraintComparison, undefined);
});
