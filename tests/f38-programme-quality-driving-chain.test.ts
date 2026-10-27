import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import type {CanonicalCalendar, CanonicalScheduleActivity, CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {workingHoursBetween} from '../packages/schedule-cpm/src';
import {buildIndependentForecastProjection} from '../packages/independent-forecast/src';
import {pmcScheduleRules, PROGRAMME_QUALITY_FORMULAS} from '../packages/runtime-api/src/pmc-schedule-rules';
import * as vm from 'node:vm';
import {createSourceFile, ScriptTarget, isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {countText} from '../packages/runtime-api/src/count-text';

// The real renderProgrammeQuality from the assembled browser script.
function renderQuality(q: unknown): string {
  const script = cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source = createSourceFile('browser.js', script, ScriptTarget.Latest, true);
  const fn = source.statements.filter(isFunctionDeclaration).find(n => n.name?.text === 'renderProgrammeQuality')!;
  assert.ok(fn, 'renderProgrammeQuality present');
  const text = (value: unknown) => String(value ?? '');
  return vm.runInNewContext(fn.getText(source) + ';renderProgrammeQuality(q);', {countText,
    q, escapeHtml: text, fmt: text, planningShortDate: text, experienceRecordCount: (rows: unknown[]) => String(rows.length),
    planningKpis: (rows: unknown[][]) => rows.map(r => '<kpi>' + r[0] + '=' + r[1] + '</kpi>').join(''), basisTable: () => '',
  }) as string;
}

// F38 (D-006, D-008, D-032, D-165, D-234): driving chain to completion from the
// independent CPM, DCMA-type checks (missing logic, resources, missed tasks
// added), BEI and CPLI, each from one shared module with its formula stated.
// The driving chain and completion are judged by tools/independent/cpm-solver.cjs.

const requireCjs = createRequire(__filename);
const {solve} = requireCjs(resolve(process.cwd(), 'tools/independent/cpm-solver.cjs'));
const C5 = {id: 'C5', workDays: [1, 2, 3, 4, 5], startHour: 8, hoursPerDay: 8, holidays: [] as string[]};
const iv = {start: '08:00', finish: '16:00', minutes: 480};
const calendar = {
  calendarId: 'C5', name: 'C5', semanticComplete: true, weeklyWorkMinutes: [0, 480, 480, 480, 480, 480, 0],
  weeklyWorkIntervals: [0, 1, 2, 3, 4, 5, 6].map(d => ({dayIndex: d + 1, intervals: C5.workDays.includes(d) ? [iv] : []})),
  exceptions: [], standardDayHours: 8, standardWeekHours: 40, sourceRefs: [],
} as unknown as CanonicalCalendar;
const DD = '2027-01-04T08:00:00.000Z'; // Monday

function act(id: string, hours: number, over: Partial<CanonicalScheduleActivity> = {}): CanonicalScheduleActivity {
  return {projectId: 'F38', activityId: id, nativeId: null, name: id, wbsId: null, calendarId: 'C5', activityType: 'task',
    status: 'not_started', baselineStartIso: null, baselineFinishIso: null, currentStartIso: null, currentFinishIso: null,
    actualStartIso: null, actualFinishIso: null, forecastStartIso: null, forecastFinishIso: null,
    originalDurationHours: hours, remainingDurationHours: hours, totalFloatHours: 0, freeFloatHours: 0,
    percentComplete: 0, sourceRefs: [], diagnostics: [], ...over} as CanonicalScheduleActivity;
}
const rel = (id: string, p: string, s: string) => ({relationshipId: id, predecessorActivityId: p, successorActivityId: s, type: 'FS', lagHours: 0, external: false, sourceRefs: [], diagnostics: []});
const NET = [['R1', 'A', 'B'], ['R2', 'B', 'C'], ['R3', 'D', 'C']] as const;
function network(): CanonicalScheduleModel {
  return {projectId: 'F38', source: 'xer', sourceRevisionId: 'F38', dataDateIso: DD, wbs: [], diagnostics: [], calendars: [calendar],
    activities: [act('A', 16), act('B', 24), act('C', 8), act('D', 8)],
    relationships: NET.map(([id, p, s]) => rel(id, p, s))} as unknown as CanonicalScheduleModel;
}
function independent() {
  return solve({dataDate: DD, calendars: [C5], relationships: NET.map(([, pred, succ]) => ({pred, succ, type: 'FS'})),
    activities: [{id: 'A', calendar: 'C5', duration: 16}, {id: 'B', calendar: 'C5', duration: 24}, {id: 'C', calendar: 'C5', duration: 8}, {id: 'D', calendar: 'C5', duration: 8}]});
}

test('F38: driving chain to completion and independent CPLI come from the independent CPM and match the independent solver', () => {
  const model = network();
  const forecast = buildIndependentForecastProjection(model, {generatedAt: DD, producerVersion: 'f38', cpmConfig: {applySourceConstraints: true}});
  const q = pmcScheduleRules(model, [], '2027-01-13', {independentForecast: forecast});
  const solver = independent();
  const critical = solver.activities.filter((a: {critical: boolean}) => a.critical).map((a: {id: string}) => a.id).sort();
  assert.equal(q.drivingChain.state, 'calculated');
  assert.deepEqual([...q.drivingChain.activityIds].sort(), critical, 'driving chain = independent solver critical path');
  assert.deepEqual(critical, ['A', 'B', 'C']);
  assert.deepEqual(q.drivingChain.finishActivityIds, ['C']);
  assert.equal(q.drivingChain.activityCount, 3);
  const solverFinish = solver.activities.find((a: {id: string}) => a.id === 'C').earlyFinish;
  const cmFinish = Date.parse(q.drivingChain.completionIso!);
  assert.equal(workingHoursBetween(calendar, Math.min(cmFinish, Date.parse(solverFinish)), Math.max(cmFinish, Date.parse(solverFinish))), 0, 'same working moment as the solver');
  // Data Date to completion = 16 + 24 + 8 = 48 working hours; completion Mon 11 to Wed 13 end of day = 16 working hours.
  assert.equal(q.independentCpli.remainingWorkingHours, 48);
  assert.equal(q.independentCpli.totalFloatWorkingHours, 16);
  assert.equal(q.independentCpli.value, (48 + 16) / 48);
  assert.equal(q.independentCpli.formula, PROGRAMME_QUALITY_FORMULAS.independent_cpli);

  const html = renderQuality(q);
  assert.match(html, /<kpi>Independent CPLI=1\.3333333333333333<\/kpi>/);
  assert.match(html, /Driving chain to completion \(independent CPM\): 3 activities/);
  assert.match(html, /Independent CPLI = \(working hours from the Data Date/);
  // W1: each formula is listed under its check's name, never under its field key ('missed_tasks').
  assert.match(html, /<dt>Missed tasks \(DCMA 11\)<\/dt><dd>count of detail tasks due by the Data Date/);
  assert.doesNotMatch(html, /missed_tasks|hard_constraints|sf_links/);

  const none = pmcScheduleRules(model, [], '2027-01-13');
  assert.match(renderQuality(none), /Driving chain to completion \(independent CPM\): not established/);
  assert.equal(none.drivingChain.state, 'not_established');
  assert.equal(none.independentCpli.value, null, 'no independent CPM: CPLI unknown, never invented');
});

test('F38: missing logic, resources and missed tasks checks, with every formula stated', () => {
  const model = network();
  const q = pmcScheduleRules(model, [], null, {resources: {assignments: [{activityId: 'A'}, {activityId: 'B'}]}});
  const check = (key: string) => q.checks.find(c => c.key === key)!;
  assert.deepEqual(q.logic.openStartActivityIds, ['A', 'D']);
  assert.deepEqual(q.logic.openEndActivityIds, ['C']);
  assert.deepEqual(check('missing_logic').activityIds, ['A', 'C', 'D']);
  assert.equal(check('missing_logic').population, 4);
  // An external (other-project) predecessor is real logic; a link only to a level-of-effort row is not.
  const ext = network();
  ext.activities.push(act('LOE', 80, {activityType: 'level_of_effort'}));
  ext.relationships.push({...rel('RX', 'EXT-1', 'D'), external: true} as never, rel('RL', 'C', 'LOE') as never);
  const extQ = pmcScheduleRules(ext, []);
  assert.deepEqual(extQ.logic.openStartActivityIds, ['A']);
  assert.deepEqual(extQ.logic.openEndActivityIds, ['C'], 'a successor that is only level of effort leaves C an open end');
  assert.deepEqual(check('resources').activityIds, ['C', 'D']);
  assert.equal(check('resources').count, 2);
  const noResources = pmcScheduleRules(model, [], null);
  assert.equal(noResources.checks.find(c => c.key === 'resources')!.count, null, 'no resource model: unknown, not 0');
  for (const c of q.checks) assert.ok(PROGRAMME_QUALITY_FORMULAS[c.key as keyof typeof PROGRAMME_QUALITY_FORMULAS], 'formula stated for ' + c.key);
  for (const key of ['bei', 'submitted_cpli', 'independent_cpli', 'driving_chain', 'leads', 'lags', 'sf_links'] as const) assert.ok(q.formulas[key]);

  // DCMA 11 missed tasks: due by the Data Date under the adopted baseline and unfinished or finished late.
  const b = {baselineDateBasis: 'controlled_baseline' as const};
  const m2 = {...network(), dataDateIso: '2027-01-11', relationships: [{...rel('R9', 'T1', 'T4'), type: 'SF'}], activities: [
    act('T1', 8, {...b, status: 'completed', baselineFinishIso: '2027-01-05', actualStartIso: '2027-01-05', actualFinishIso: '2027-01-05', remainingDurationHours: 0}),
    act('T2', 8, {...b, status: 'completed', baselineFinishIso: '2027-01-05', actualStartIso: '2027-01-07', actualFinishIso: '2027-01-07', remainingDurationHours: 0}),
    act('T3', 8, {...b, baselineFinishIso: '2027-01-06'}),
    act('T4', 8, {...b, baselineFinishIso: '2027-02-01'}),
  ]} as unknown as CanonicalScheduleModel;
  const missed = pmcScheduleRules(m2, []).checks.find(c => c.key === 'missed_tasks')!;
  assert.deepEqual(missed.activityIds, ['T2', 'T3']);
  assert.equal(missed.count, 2);
  assert.equal(missed.population, 3);
  assert.deepEqual(pmcScheduleRules(m2, []).sfRelationshipIds, ['R9']);
  const m3 = {...m2, activities: [...m2.activities, act('T5', 8, {...b, status: 'completed', baselineFinishIso: '2027-01-05', remainingDurationHours: 0})]} as CanonicalScheduleModel;
  const unknown = pmcScheduleRules(m3, []).checks.find(c => c.key === 'missed_tasks')!;
  assert.equal(unknown.count, null, 'completed without an actual finish: unknown, not on time');
  assert.deepEqual(unknown.unknownActivityIds, ['T5']);
});
