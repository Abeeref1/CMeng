import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {countUnit} from '../packages/runtime-api/src/count-text';
import type {CanonicalCalendar, CanonicalScheduleActivity, CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {buildIndependentForecastProjection} from '../packages/independent-forecast/src';
import {buildLookAheadProjection} from '../packages/lookahead-schedule/src';
import * as vm from 'node:vm';
import {createSourceFile, ScriptTarget, isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F42 (D-054, D-055, D-119, D-232): the look-ahead names, for each driving
// activity, the incomplete predecessors, missing readiness items and linked
// open RFIs / NCRs / permits with due dates. Driving activities come from the
// CMeng independent CPM, checked against tools/independent/cpm-solver.cjs.

const requireCjs = createRequire(__filename);
const {solve} = requireCjs(resolve(process.cwd(), 'tools/independent/cpm-solver.cjs'));
const C5 = {id: 'C5', workDays: [1, 2, 3, 4, 5], startHour: 8, hoursPerDay: 8, holidays: [] as string[]};
const iv = {start: '08:00', finish: '16:00', minutes: 480};
const calendar = {
  calendarId: 'C5', name: 'C5', semanticComplete: true, weeklyWorkMinutes: [0, 480, 480, 480, 480, 480, 0],
  weeklyWorkIntervals: [0, 1, 2, 3, 4, 5, 6].map(d => ({dayIndex: d + 1, intervals: C5.workDays.includes(d) ? [iv] : []})),
  exceptions: [], standardDayHours: 8, standardWeekHours: 40, sourceRefs: [],
} as unknown as CanonicalCalendar;
const DD = '2027-01-04T08:00:00.000Z';

function act(id: string, hours: number, start: string, finish: string): CanonicalScheduleActivity {
  return {projectId: 'F42', activityId: id, nativeId: null, name: 'Activity ' + id, wbsId: null, calendarId: 'C5', activityType: 'task',
    status: 'not_started', baselineStartIso: start, baselineFinishIso: finish, currentStartIso: start, currentFinishIso: finish,
    actualStartIso: null, actualFinishIso: null, forecastStartIso: start, forecastFinishIso: finish,
    originalDurationHours: hours, remainingDurationHours: hours, totalFloatHours: 0, freeFloatHours: 0,
    percentComplete: 0, sourceRefs: [], diagnostics: []} as CanonicalScheduleActivity;
}
const NET = [['R1', 'A', 'B'], ['R2', 'B', 'C'], ['R3', 'D', 'C']] as const;
function model(): CanonicalScheduleModel {
  return {projectId: 'F42', source: 'xer', sourceRevisionId: 'F42', dataDateIso: DD, wbs: [], diagnostics: [], calendars: [calendar],
    activities: [act('A', 16, '2027-01-04T08:00:00Z', '2027-01-05T16:00:00Z'), act('B', 24, '2027-01-06T08:00:00Z', '2027-01-08T16:00:00Z'),
      act('C', 8, '2027-01-11T08:00:00Z', '2027-01-11T16:00:00Z'), act('D', 8, '2027-01-04T08:00:00Z', '2027-01-04T16:00:00Z')],
    relationships: NET.map(([relationshipId, p, s]) => ({relationshipId, predecessorActivityId: p, successorActivityId: s, type: 'FS', lagHours: 0, external: false, sourceRefs: [], diagnostics: []}))} as unknown as CanonicalScheduleModel;
}
const rec = (recordId: string, documentType: string, dueIso: string, note: string) => ({recordId, documentType, state: 'blocked' as const, dueIso, note, owner: 'Site manager', sourceRefs: [documentType + ':' + recordId]});

// Same harness as tests/batch-c-overdue-start-acceptance.test.ts: the real
// renderLookAheadVisual from the assembled browser script.
function renderLookAhead(p: ReturnType<typeof buildLookAheadProjection>): string {
  const script = cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const start = script.indexOf('function renderLookAheadVisual(data){');
  const end = script.indexOf('function renderMonteCarloRiskVisual(data){', start);
  assert.ok(start >= 0 && end > start);
  const source = createSourceFile('browser.js', script, ScriptTarget.Latest, true);
  const required = ['sourcePopulationControl', 'responseListPopulation', 'indexResponsePopulations', 'knownScreenCount', 'screenCountText', 'sourceWorkingFloat', 'listTotal', 'readinessReviewState'];
  const helpers = source.statements.filter(isFunctionDeclaration).filter(n => n.name && required.includes(n.name.text));
  assert.equal(helpers.length, required.length);
  const text = (value: unknown) => String(value ?? '');
  const scope: Record<string, unknown> = {
    currentModuleResult: null, responsePopulationRoot: null, responsePopulationIndex: new WeakMap(), responseRowPopulationIndex: new WeakMap(),
    p, projectionFor: (value: unknown) => value, escapeHtml: text, fmt: text, countUnit, planningShortDate: text, humanizeKey: text, planningStateLabel: text,
    planningKpis: () => '', experienceDisclosure: () => '', moduleBarList: () => '', planningLookAheadTimeline: () => '',
    planningStatusBand: () => '', planningLookAheadBlockers: () => '',
    managementPanel: (title: string, description: string, content: string) => '<section><h4>' + title + '</h4>' + description + content + '</section>',
  };
  return vm.runInNewContext(helpers.map(n => n.getText(source)).join('\n') + '\n' + script.slice(start, end) + ';renderLookAheadVisual(p);', scope) as string;
}

test('F42: each driving activity in the look-ahead names its incomplete predecessors, missing readiness items and open linked records with due dates', () => {
  const m = model();
  const forecast = buildIndependentForecastProjection(m, {generatedAt: DD, producerVersion: 'f42', cpmConfig: {applySourceConstraints: true}});
  const driving = forecast.drivingNetwork!.activityIds;
  const solver = solve({dataDate: DD, calendars: [C5], relationships: NET.map(([, pred, succ]) => ({pred, succ, type: 'FS'})),
    activities: [{id: 'A', calendar: 'C5', duration: 16}, {id: 'B', calendar: 'C5', duration: 24}, {id: 'C', calendar: 'C5', duration: 8}, {id: 'D', calendar: 'C5', duration: 8}]});
  assert.deepEqual([...driving].sort(), solver.activities.filter((a: {critical: boolean}) => a.critical).map((a: {id: string}) => a.id).sort());

  const p = buildLookAheadProjection(m, {generatedAt: DD, producerVersion: 'f42', drivingActivityIds: driving, readinessEvidence: {
    B: {
      permit: {state: 'blocked', sourceRefs: ['permit:PTW-12'], records: [rec('PTW-12', 'permit', '2027-01-05', 'Hot work permit not issued')]},
      quality: {state: 'blocked', sourceRefs: ['ncr:NCR-0259'], records: [rec('NCR-0259', 'ncr', '2027-01-06', 'Open NCR on formwork')]},
      design_submittal: {state: 'blocked', sourceRefs: ['rfi:RFI-0680'], records: [rec('RFI-0680', 'rfi', '2027-01-07', 'RFI awaiting reply')]},
      procurement_material: {state: 'ready', sourceRefs: ['po:PO-1']},
    },
  }});
  const blockers = p.drivingBlockers;
  assert.ok(blockers, 'drivingBlockers present');
  assert.match(blockers.formula, /predecessors not completed \+ readiness dimensions with no source evidence \+ linked source records still open/);
  assert.deepEqual(blockers.rows.map(r => r.activityId).sort(), ['A', 'B', 'C'], 'only driving activities; D (float) is not listed');
  const b = blockers.rows.find(r => r.activityId === 'B')!;
  assert.deepEqual(b.incompletePredecessors.map(x => x.activityId), ['A']);
  assert.deepEqual(b.openItems.map(x => [x.recordId, x.documentType, x.dueIso]).sort(),
    [['NCR-0259', 'ncr', '2027-01-06'], ['PTW-12', 'permit', '2027-01-05'], ['RFI-0680', 'rfi', '2027-01-07']]);
  const row = p.rows.find(r => r.activityId === 'B')!;
  const unknownDims = row.readiness.dimensions.filter(d => d.key !== 'predecessor' && d.state === 'unknown').map(d => d.key).sort();
  assert.deepEqual(b.missingReadiness.map(x => x.dimension).sort(), unknownDims, 'missing readiness = dimensions with no source evidence');
  assert.ok(!b.missingReadiness.some(x => ['permit', 'quality', 'design_submittal', 'procurement_material'].includes(x.dimension)));
  assert.equal(b.blockerCount, 1 + 3 + unknownDims.length);
  const c = blockers.rows.find(r => r.activityId === 'C')!;
  assert.deepEqual(c.incompletePredecessors.map(x => x.activityId).sort(), ['B', 'D']);
  assert.equal(blockers.drivingActivityCount, 3);

  const noPath = buildLookAheadProjection(m, {generatedAt: DD, producerVersion: 'f42'});
  assert.equal(noPath.drivingBlockers, undefined, 'no driving path: blockers unknown, not an empty "none" list');

  // The look-ahead page names them.
  const html = renderLookAhead(p);
  assert.match(html, /<h4>Driving-activity blockers<\/h4>/);
  assert.match(html, /<b>B<\/b>/);
  assert.match(html, /PTW-12 \(permit, due 2027-01-05\)/);
  assert.match(html, /NCR-0259 \(ncr, due 2027-01-06\)/);
  assert.match(html, /RFI-0680 \(rfi, due 2027-01-07\)/);
  assert.match(html, /<td>A Activity A<\/td>/, 'incomplete predecessor named');
  assert.doesNotMatch(renderLookAhead(noPath), /Driving-activity blockers/);
});
