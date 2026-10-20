import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import * as vm from 'node:vm';
import {createSourceFile, ScriptTarget, isFunctionDeclaration} from 'typescript';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {reportingState} from '../packages/runtime-api/src/reporting-state';
import {projectScheduleControlBasis} from '../packages/runtime-api/src/schedule-control-basis';
import {pmcScheduleRules} from '../packages/runtime-api/src/pmc-schedule-rules';
import {buildIndependentForecastProjection} from '../packages/independent-forecast/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
process.env.CMENG_OCR_ENABLED = '0';
type Inputs = Parameters<typeof pmcScheduleRules>[3];

// F38 (D-006, D-008, D-032, D-165, D-234), the parts still open after round 10:
// 1. each driving activity labelled with its stage from the programme's own
//    activity codes and WBS (never guessed from names, except the existing
//    shared programme-stage name rule, labelled as such);
// 2. float erosion between the previous and current revision on the CMeng CPM
//    float, with the "turns critical by" date;
// 3. BEI named with its formula and the criticality definition stated.
// The project goes through the real upload path: two XER revisions (approved
// baseline, then an update) and a contract PDF. CMeng floats are judged by the
// independent solver tools/independent/cpm-solver.cjs.
//
// Hand calculation. Calendar C5: Mon-Fri 08:00-16:00 (8 h a day, stated by the
// calendar). Driving chain S42 40 h > S43 40 h > MEP 40 h > PNT 24 h > SNG 16 h >
// AUTH 8 h > PC (finish milestone). Parallel: X1 and Y1 (in progress) to PC.
//   Revision 1, Data Date Mon 04 Jan 2027 08:00: completion = DD + 168 h = Mon 01 Feb 16:00.
//     X1 remaining 136 h -> float 168 - 136 = 32 h;  Y1 remaining 140 h -> float 28 h.
//   Revision 2, Data Date Mon 11 Jan 2027 08:00 (40 working hours later); S42 done.
//     Completion unchanged = DD + 128 h. X1 remaining 112 h -> float 16 h; Y1 remaining 96 h -> float 32 h.
// Near-critical = float > 0 h and <= 5 working days (CMeng policy default) = 40 h on C5.
// Population (remaining, on the driving chain or near-critical): S43 MEP PNT SNG AUTH PC X1 Y1.
// X1: change -16 h over 40 working hours = -0.4 working days of float per working day.
//   Turns critical by = DD2 + 16 / 0.4 = 40 working hours = Fri 15 Jan 2027 16:00.
// Y1: change +4 h -> +0.1, not eroding. Driving activities: 0 -> 0, already critical.
// Average of the 8 rates = (-0.4 + 0.1) / 8 = -0.0375.
// BEI at DD2: tasks baselined (approved baseline) to finish by 11 Jan: MOB, S42, X1 (3);
//   completed by the Data Date: MOB, S42 (2) -> 2 / 3.

const requireCjs = createRequire(__filename);
const {solve} = requireCjs(resolve(process.cwd(), 'tools/independent/cpm-solver.cjs'));
const DAY = '(0||0(s|08:00|f|16:00)())';
const CALENDAR = '(0||CalendarData()((0||DaysOfWeek()(' + [1, 2, 3, 4, 5, 6, 7].map(d => '(0||' + d + '()(' + (d >= 2 && d <= 6 ? DAY : '') + '))').join('') + '))(0||Exceptions()())))';
type Task = {id: number; code: string; name: string; wbs: string; type?: string; status: 'TK_Complete' | 'TK_Active' | 'TK_NotStart';
  target: [string, string]; early: [string, string]; actual?: [string, string | null]; remaining: number; original: number; float: number | null; restart?: string};
function xer(dataDate: string, tasks: Task[], codes: Array<[number, string, string]>) {
  const task = (t: Task) => ['%R', t.id, 1, t.wbs, 'C5', t.code, t.name, t.type ?? 'TT_Task', t.status, t.target[0], t.target[1], t.early[0], t.early[1],
    t.status === 'TK_Complete' ? '' : t.restart ?? t.early[0], t.status === 'TK_Complete' ? '' : t.early[1], t.actual?.[0] ?? '', t.actual?.[1] ?? '',
    t.original, t.remaining, t.float ?? '', t.status === 'TK_Complete' ? 100 : t.status === 'TK_Active' ? 30 : 0].join('\t');
  const links: Array<[string, string]> = [['MOB', 'S42'], ['MOB', 'X1'], ['MOB', 'Y1'], ['S42', 'S43'], ['S43', 'MEP'], ['MEP', 'PNT'], ['PNT', 'SNG'], ['SNG', 'AUTH'], ['AUTH', 'PC'], ['X1', 'PC'], ['Y1', 'PC']];
  const idOf = new Map(tasks.map(t => [t.code, t.id]));
  return Buffer.from(['ERMHDR\t23.12',
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tlast_recalc_date', '%R\t1\tANC\t' + dataDate,
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data', '%R\tC5\tMon-Fri 8h\t8\t40\t' + CALENDAR,
    '%T\tPROJWBS', '%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name',
    '%R\tW0\t1\t\tANC\tAl Noor Community', '%R\tW1\t1\tW0\tB42\tPlot B42', '%R\tW2\t1\tW0\tB43\tPlot B43', '%R\tW3\t1\tW0\tSNG\tSnagging', '%R\tW4\t1\tW0\tEXT\tExternal works',
    '%T\tTASK', '%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\trestart_date\treend_date\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct',
    ...tasks.map(task),
    '%T\tACTVTYPE', '%F\tactv_code_type_id\tactv_code_type', '%R\tT1\tPhase', '%R\tT2\tTrade', '%R\tT3\tPlot',
    '%T\tACTVCODE', '%F\tactv_code_id\tactv_code_type_id\tshort_name\tactv_code_name',
    '%R\tP-STR\tT1\tStructure\tStructural frame', '%R\tP-MEP\tT1\tMEP\tMEP works', '%R\tT-PNT\tT2\tPainting\tPainting works', '%R\tL-42\tT3\tPlot B42\tVilla plot B42', '%R\tL-43\tT3\tPlot B43\tVilla plot B43',
    '%T\tTASKACTV', '%F\ttask_id\tactv_code_type_id\tactv_code_id\tproj_id', ...codes.map(([task, type, code]) => ['%R', task, type, code, 1].join('\t')),
    '%T\tTASKPRED', '%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\tpred_proj_id',
    ...links.map(([pred, succ], i) => ['%R', i + 1, idOf.get(succ), idOf.get(pred), 'PR_FS', 0, 1, 1].join('\t')),
    '%E'].join('\n'));
}
const CODES: Array<[number, string, string]> = [[101, 'T1', 'P-STR'], [101, 'T3', 'L-42'], [102, 'T1', 'P-STR'], [102, 'T3', 'L-43'], [103, 'T1', 'P-MEP'], [104, 'T2', 'T-PNT']];
const plan = (start: string, finish: string) => ({target: [start, finish] as [string, string], early: [start, finish] as [string, string]});
const MOB: Task = {id: 100, code: 'MOB', name: 'Mobilisation', wbs: 'W0', status: 'TK_Complete', ...plan('2026-12-21 08:00', '2026-12-25 16:00'), actual: ['2026-12-21 08:00', '2026-12-25 16:00'], original: 40, remaining: 0, float: null};
function chain(s42Done: boolean): Task[] {
  return [
    s42Done ? {id: 101, code: 'S42', name: 'Villa structure Plot B42', wbs: 'W1', status: 'TK_Complete', ...plan('2027-01-04 08:00', '2027-01-08 16:00'), actual: ['2027-01-04 08:00', '2027-01-08 16:00'], original: 40, remaining: 0, float: null}
      : {id: 101, code: 'S42', name: 'Villa structure Plot B42', wbs: 'W1', status: 'TK_NotStart', ...plan('2027-01-04 08:00', '2027-01-08 16:00'), original: 40, remaining: 40, float: 0},
    {id: 102, code: 'S43', name: 'Villa structure Plot B43', wbs: 'W2', status: 'TK_NotStart', ...plan('2027-01-11 08:00', '2027-01-15 16:00'), original: 40, remaining: 40, float: 0},
    {id: 103, code: 'MEP', name: 'MEP first and second fix', wbs: 'W2', status: 'TK_NotStart', ...plan('2027-01-18 08:00', '2027-01-22 16:00'), original: 40, remaining: 40, float: 0},
    {id: 104, code: 'PNT', name: 'Internal painting', wbs: 'W2', status: 'TK_NotStart', ...plan('2027-01-25 08:00', '2027-01-27 16:00'), original: 24, remaining: 24, float: 0},
    {id: 105, code: 'SNG', name: 'Snag list and rectification', wbs: 'W3', status: 'TK_NotStart', ...plan('2027-01-28 08:00', '2027-01-29 16:00'), original: 16, remaining: 16, float: 0},
    {id: 106, code: 'AUTH', name: 'Authority inspection', wbs: 'W0', status: 'TK_NotStart', ...plan('2027-02-01 08:00', '2027-02-01 16:00'), original: 8, remaining: 8, float: 0},
    {id: 107, code: 'PC', name: 'Practical completion', wbs: 'W0', type: 'TT_FinMile', status: 'TK_NotStart', ...plan('2027-02-01 16:00', '2027-02-01 16:00'), original: 0, remaining: 0, float: 0},
  ];
}
const inProgress = (id: number, code: string, name: string, baselineFinish: string, original: number, remaining: number, finish: string, float: number, dataDate: string): Task =>
  ({id, code, name, wbs: 'W4', status: 'TK_Active', target: ['2026-12-28 08:00', baselineFinish], early: ['2026-12-28 08:00', finish], restart: dataDate, actual: ['2026-12-28 08:00', null], original, remaining, float});
const DD1 = '2027-01-04 08:00', DD2 = '2027-01-11 08:00';
const REV1 = xer(DD1, [MOB, ...chain(false), inProgress(108, 'X1', 'External works', '2027-01-08 16:00', 80, 136, '2027-01-26 16:00', 32, DD1),
  inProgress(109, 'Y1', 'Boundary wall', '2027-01-22 16:00', 160, 140, '2027-01-27 12:00', 28, DD1)], CODES);
const REV2 = xer(DD2, [MOB, ...chain(true), inProgress(108, 'X1', 'External works', '2027-01-08 16:00', 80, 112, '2027-01-28 16:00', 16, DD2),
  inProgress(109, 'Y1', 'Boundary wall', '2027-01-22 16:00', 160, 96, '2027-01-26 16:00', 32, DD2)], CODES);

// The same two networks for the independent solver.
const C5 = {id: 'C5', workDays: [1, 2, 3, 4, 5], startHour: 8, hoursPerDay: 8, holidays: [] as string[]};
const LINKS = [['MOB', 'S42'], ['MOB', 'X1'], ['MOB', 'Y1'], ['S42', 'S43'], ['S43', 'MEP'], ['MEP', 'PNT'], ['PNT', 'SNG'], ['SNG', 'AUTH'], ['AUTH', 'PC'], ['X1', 'PC'], ['Y1', 'PC']];
function solverFloats(second: boolean): Map<string, number | null> {
  const a = (id: string, duration: number, extra: Record<string, unknown> = {}) => ({id, calendar: 'C5', duration, ...extra});
  const result = solve({dataDate: second ? '2027-01-11T08:00:00Z' : '2027-01-04T08:00:00Z', calendars: [C5], relationships: LINKS.map(([pred, succ]) => ({pred, succ, type: 'FS'})),
    activities: [a('MOB', 40, {actualStart: '2026-12-21T08:00:00Z', actualFinish: '2026-12-25T16:00:00Z'}),
      second ? a('S42', 40, {actualStart: '2027-01-04T08:00:00Z', actualFinish: '2027-01-08T16:00:00Z'}) : a('S42', 40),
      a('S43', 40), a('MEP', 40), a('PNT', 24), a('SNG', 16), a('AUTH', 8), a('PC', 0),
      a('X1', 80, {actualStart: '2026-12-28T08:00:00Z', remaining: second ? 112 : 136}), a('Y1', 160, {actualStart: '2026-12-28T08:00:00Z', remaining: second ? 96 : 140})]});
  return new Map(result.activities.map((row: {id: string; totalFloatHours: number | null}) => [row.id, row.totalFloatHours]));
}

function pageScript(): string {return cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;}
function render(names: string[], call: string, q: unknown): string {
  const script = pageScript();
  const source = createSourceFile('browser.js', script, ScriptTarget.Latest, true);
  const functions = source.statements.filter(isFunctionDeclaration).filter(n => names.includes(n.name?.text ?? ''));
  assert.equal(functions.length, names.length, 'page functions present: ' + names.join(', '));
  const text = (value: unknown) => String(value ?? '');
  return vm.runInNewContext(functions.map(f => f.getText(source)).join('\n') + ';' + call, {
    q, escapeHtml: text, fmt: text, planningShortDate: text, experienceRecordCount: (rows: unknown[]) => String(rows.length), listTotal: (rows: unknown[]) => rows.length,
    planningKpis: (rows: unknown[][]) => rows.map(r => '<kpi>' + r[0] + '=' + r[1] + '|' + r[2] + '</kpi>').join(''), basisTable: () => '',
  }) as string;
}

// The real Near-Critical page function (batch-c harness), with the uploaded project's shared facts.
function renderNearCriticalPage(projectFacts: unknown): string {
  const script = pageScript();
  const start = script.indexOf('function renderNearCriticalVisual(data){'), end = script.indexOf('function renderManhourVisual(data){', start);
  assert.ok(start >= 0 && end > start);
  const parsed = createSourceFile('cmeng-screen.js', script, ScriptTarget.Latest, true);
  const helpers = 'let responsePopulationRoot=null,responsePopulationIndex=new WeakMap(),responseRowPopulationIndex=new WeakMap();\n' + parsed.statements.filter(isFunctionDeclaration)
    .filter(n => ['indexResponsePopulations', 'listTotal', 'knownScreenCount', 'screenCountText', 'floatThresholdText', 'floatBucketDaysNote', 'floatDistributionSummary'].includes(n.name?.text ?? '')).map(n => n.getText(parsed)).join('\n');
  const p = {rows: [], watchlistRows: [], criticalRows: [], negativeFloatRows: [], managementGroups: [], nearCriticalCount: 0, floatRiskWatchlistCount: 0, zeroFloatCount: 0, negativeFloatCount: 0,
    floatCoveragePercent: 100, classificationCoveragePercent: 100, unresolvedActivityCount: 0, criticalThresholdHours: 0, nearCriticalThresholdHours: 40, floatRiskWatchlistIncludesCriticalThreshold: true,
    nearCriticalThresholdAuthority: 'cmeng_screening_policy', ...(projectFacts ? {projectFacts} : {})};
  const text = (value: unknown) => String(value ?? '');
  return vm.runInNewContext(helpers + '\n' + script.slice(start, end) + ';renderNearCriticalVisual(p);', {
    shortRevision: (value: unknown) => value ? 'Previous programme' : 'No comparison programme', p, projectionFor: (value: unknown) => value, escapeHtml: text, fmt: text, planningShortDate: text,
    planningStateLabel: text, planningDaysBetween: () => null, planningKpis: () => '', planningFloatHistogram: () => '', planningFinishPeriodBars: () => '', distributionSummary: () => '',
  }) as string;
}

let projectId = '';
async function uploadedProject() {
  if (projectId) return runtimeProjects.get(projectId)!;
  projectId = 'F38-STAGE-EROSION-' + process.pid;
  runtimeProjects.getOrCreate(projectId);
  await runtimeProjects.ingestSchedule({projectId, sourceFilename: 'ANC programme baseline.xer', bytes: REV1, mediaType: 'text/plain', uploadedAt: '2027-01-04T09:00:00Z',
    role: 'baseline', roleConfirmed: true, approvalReference: 'ANC-BL-01', uploadIntent: 'replace_current_basis'});
  await runtimeProjects.ingestSchedule({projectId, sourceFilename: 'ANC programme update 02.xer', bytes: REV2, mediaType: 'text/plain', uploadedAt: '2027-01-11T09:00:00Z',
    role: 'update', uploadIntent: 'replace_current_basis'});
  const {PDFDocument, StandardFonts} = await import('pdf-lib');
  const doc = await PDFDocument.create(), page = doc.addPage(), font = await doc.embedFont(StandardFonts.Helvetica);
  ['Article 1 Contract data', 'Commencement date: 21 December 2026', 'Contract completion date: 26 February 2027'].forEach((line, i) => page.drawText(line, {x: 40, y: 760 - i * 24, size: 12, font}));
  await runtimeProjects.ingestContract({projectId, bytes: await doc.save(), mediaType: 'application/pdf', sourceFilename: 'ANC contract.pdf', role: 'main', uploadedAt: '2027-01-11T10:00:00Z'});
  return runtimeProjects.get(projectId)!;
}

test('F38 uploaded programme: driving chain stages from codes and WBS, float erosion and turns-critical date checked against the independent solver, BEI and criticality stated', async () => {
  const state = await uploadedProject();
  const current = projectControlSchedule(reportingState(state));
  assert.equal(current?.revision.model.dataDateIso?.slice(0, 16), '2027-01-11T08:00', 'the update is the current programme');
  const facts = projectFactsForState(state);
  const q = facts.programmeQuality as any;
  const forecastPage = moduleForProject(projectId, 'independent-forecast').data as any;
  const debug = JSON.stringify({gate: forecastPage?.forecastReconciliationGate?.reason, required: forecastPage?.requiredFinishIso, chain: q?.drivingChain?.state, reason: q?.drivingChain?.reason,
    erosion: q?.floatErosion?.reason, revisions: state.schedules.map(s => [s.role, s.revision.model.dataDateIso])});
  assert.equal(q.drivingChain.state, 'calculated', debug);

  // 1. Stage of each driving activity, from the programme's own data.
  const stages = q.drivingChain.stages;
  assert.equal(stages.state, 'calculated', debug);
  const byId = new Map(stages.rows.map((r: any) => [r.activityId, r]));
  const expect = (id: string, stage: string, stageSource: string | null, basis: string, location: string | null) => {
    const row: any = byId.get(id);
    assert.ok(row, id + ' on the driving chain: ' + JSON.stringify(q.drivingChain.activityIds));
    assert.deepEqual([row.stage, row.stageSource, row.basis, row.location], [stage, stageSource, basis, location], id);
  };
  expect('S43', 'Structure', 'From activity code: Phase', 'activity_code', 'Plot B43');
  expect('MEP', 'MEP', 'From activity code: Phase', 'activity_code', null);
  expect('PNT', 'Painting', 'From activity code: Trade', 'activity_code', null);
  expect('SNG', 'Snagging', 'From WBS level 2', 'wbs', null);
  expect('AUTH', 'Not classified', null, 'not_classified', null);
  expect('PC', 'Handover & closeout', 'Programme stage name rule (name match)', 'name_rule', null);
  // The driving chain's remaining activities are exactly the solver's zero-float activities.
  const after = solverFloats(true);
  const solverCritical = [...after].filter(([, tf]) => tf !== null && tf <= 0).map(([id]) => id).sort();
  assert.deepEqual(q.drivingChain.activityIds.filter((id: string) => id !== 'S42').sort(), solverCritical);
  assert.deepEqual(solverCritical, ['AUTH', 'MEP', 'PC', 'PNT', 'S43', 'SNG']);
  const labels = stages.segments.map((s: any) => s.label + ' (' + s.activityCount + ')');
  assert.deepEqual(labels.slice(labels.indexOf('Structure · Plot B43 (1)')), ['Structure · Plot B43 (1)', 'MEP (1)', 'Painting (1)', 'Snagging (1)', 'Not classified (1)', 'Handover & closeout (1)']);
  assert.equal(stages.counts.notClassified, 1);
  assert.equal(stages.counts.nameRule, 1);
  assert.equal(stages.counts.wbs, 1);

  // 2. Float erosion: CMeng CPM floats of both revisions equal the independent solver.
  const before = solverFloats(false);
  const erosion = q.floatErosion;
  assert.equal(erosion.state, 'calculated', debug);
  assert.equal(erosion.previousDataDateIso.slice(0, 16), '2027-01-04T08:00');
  assert.equal(erosion.floatBasis, 'cmeng_cpm');
  const rows = new Map(erosion.rows.map((r: any) => [r.activityId, r]));
  assert.deepEqual([...rows.keys()].sort(), ['AUTH', 'MEP', 'PC', 'PNT', 'S43', 'SNG', 'X1', 'Y1'], 'remaining driving and near-critical activities');
  for (const [id, row] of rows as Map<string, any>) {
    assert.equal(row.previousFloatHours, before.get(id), id + ' previous float = solver');
    assert.equal(row.currentFloatHours, after.get(id), id + ' current float = solver');
    assert.equal(row.elapsedWorkingHours, 40, id);
  }
  assert.deepEqual([before.get('X1'), after.get('X1'), before.get('Y1'), after.get('Y1')], [32, 16, 28, 32]);
  const x1: any = rows.get('X1'), y1: any = rows.get('Y1');
  assert.deepEqual([x1.state, x1.floatChangeHours, x1.floatChangePerElapsedWorkingDay, x1.turnsCriticalByIso], ['eroding', -16, -0.4, '2027-01-15T16:00:00.000Z']);
  assert.deepEqual([y1.state, y1.floatChangeHours, y1.floatChangePerElapsedWorkingDay, y1.turnsCriticalByIso], ['not_eroding', 4, 0.1, null]);
  for (const id of ['S43', 'MEP', 'PNT', 'SNG', 'AUTH', 'PC']) assert.equal((rows.get(id) as any).state, 'already_critical', id);
  assert.deepEqual([erosion.populationCount, erosion.matchedCount, erosion.erodingCount, erosion.notErodingCount, erosion.alreadyCriticalCount, erosion.notComparableCount], [8, 8, 1, 1, 6, 0]);
  assert.equal(erosion.averageFloatChangePerElapsedWorkingDay, -0.0375);
  assert.deepEqual(erosion.earliestTurnsCritical, {activityId: 'X1', dateIso: '2027-01-15T16:00:00.000Z'});

  // 3. BEI named with its formula; the criticality definition from the shared rule.
  assert.equal(q.bei.name, 'Baseline Execution Index (BEI)');
  assert.match(q.bei.formula, /detail tasks completed by the Data Date \/ detail tasks baselined \(adopted baseline\) to finish by the Data Date/);
  assert.deepEqual([q.bei.completed, q.bei.planned, q.bei.value], [2, 3, 2 / 3], debug + JSON.stringify(q.bei));
  const definition = q.criticalityDefinition;
  assert.equal(definition.state, 'stated');
  assert.equal(definition.thresholdMethod, projectScheduleControlBasis(reportingState(state)).nearCriticalThresholdMethod);
  assert.equal(definition.critical, 'critical = total float of 0 working days or less on the CMeng CPM');
  assert.equal(definition.nearCritical, 'near-critical = more than 0 and up to 5 working days of each activity calendar (CMeng policy default)');

  // The same shared result reaches the Programme Review and the Near-Critical page.
  for (const key of ['schedule-analytics', 'near-critical']) {
    const page = moduleForProject(projectId, key).data as any;
    assert.deepEqual(page.projectFacts.programmeQuality.floatErosion, erosion, key);
    assert.deepEqual(page.projectFacts.programmeQuality.drivingChain.stages, stages, key);
  }
  const review = render(['renderProgrammeQuality'], 'renderProgrammeQuality(q);', q);
  assert.match(review, /<kpi>Baseline Execution Index \(BEI\)=0\.6666666666666666\|Tasks completed by the Data Date \/ tasks baselined to finish by the Data Date<\/kpi>/);
  assert.match(review, /Driving chain by stage<\/b> \(from the programme activity codes and WBS\): .*Structure · Plot B43 \(1\) > MEP \(1\) > Painting \(1\) > Snagging \(1\) > Not classified \(1\) > Handover & closeout \(1\)\./);
  assert.match(review, /Stage source: \d from activity codes, 1 from WBS, 1 by the Programme stage name rule \(name match\), 1 not classified\./);
  assert.match(review, /Criticality definition:<\/b> critical = total float of 0 working days or less on the CMeng CPM; near-critical = more than 0 and up to 5 working days of each activity calendar \(CMeng policy default\)\./);
  assert.match(review, /Float erosion<\/b> \(CMeng CPM total float, previous to current revision\): 2027-01-04T08:00[^ ]* to 2027-01-11T08:00[^ ]*: 8 of 8 near-critical and driving activities compared; 1 losing float; average change -0\.0375 working days of total float per working day elapsed, on the activity calendar\. Turns critical by: 2027-01-15T16:00:00\.000Z \(X1\)\./);
  assert.match(review, /BEI \(Baseline Execution Index\) = detail tasks completed by the Data Date/);
  const nearCritical = renderNearCriticalPage((moduleForProject(projectId, 'near-critical').data as any).projectFacts);
  assert.match(nearCritical, /<h4>CMeng CPM criticality and float erosion<\/h4>/);
  assert.match(nearCritical, /<b>Turns critical by:<\/b> 2027-01-15T16:00:00\.000Z \(X1\)/);
  assert.match(nearCritical, /<tr><td><b>X1<\/b><br><span class="muted">External works<\/span><\/td><td>32 h<\/td><td>16 h<\/td><td>-0\.4<\/td><td>2027-01-15T16:00:00\.000Z<\/td><td>Losing float<\/td><\/tr>/);
  assert.ok(nearCritical.indexOf('Float screening basis:') < nearCritical.indexOf('CMeng CPM criticality and float erosion'), 'shown after the float screening basis');
  assert.doesNotMatch(renderNearCriticalPage(undefined), /CMeng CPM criticality and float erosion/, 'no project facts: no panel');
});

test('F38 float erosion is not established without two dated revisions with matching ids; never invented', async () => {
  const state = reportingState(await uploadedProject());
  const [first, second] = [...state.schedules].sort((a, b) => String(a.revision.model.dataDateIso).localeCompare(String(b.revision.model.dataDateIso))).map(s => s.revision.model);
  const cpm = (model: typeof first) => buildIndependentForecastProjection(model!, {generatedAt: 't', producerVersion: 'f38', cpmConfig: {applySourceConstraints: true}});
  const config = projectScheduleControlBasis(state).analysisConfig;
  const criticality = {config, thresholdMethod: 'cmeng_policy_default', headlineFloatBasis: 'independent_cpm'};
  const now = cpm(second);
  const run = (previousRevision: any, withRule = true) => pmcScheduleRules(second!, [], '2027-02-26', {independentForecast: now, ...(withRule ? {criticality} : {}), previousRevision} as Inputs) as any;
  assert.match(run(null).floatErosion.reason, /No earlier dated, adopted programme revision/);
  assert.equal(run(null).floatErosion.state, 'not_established');
  assert.equal(run(null).floatErosion.earliestTurnsCritical, null);
  assert.match(run({revisionId: 'same', label: null, model: second, forecast: now}).floatErosion.reason, /not earlier than the current Data Date/);
  assert.match(run({revisionId: 'p', label: null, model: first, forecast: null, reason: 'Previous CPM withheld.'}).floatErosion.reason, /^Previous CPM withheld\.$/);
  const noRule = run({revisionId: 'p', label: null, model: first, forecast: cpm(first)}, false);
  assert.equal(noRule.floatErosion.state, 'not_established');
  assert.equal(noRule.criticalityDefinition.state, 'not_established');
  // A new activity (no matching id in the previous revision) is not comparable, never 0.
  const withoutX1 = {...first!, activities: first!.activities.filter(a => a.activityId !== 'X1'), relationships: first!.relationships.filter(r => r.predecessorActivityId !== 'X1' && r.successorActivityId !== 'X1')};
  const partial = run({revisionId: 'p', label: null, model: withoutX1, forecast: cpm(withoutX1)}).floatErosion;
  const x1 = partial.rows.find((r: any) => r.activityId === 'X1');
  assert.deepEqual([x1.state, x1.previousFloatHours, x1.floatChangePerElapsedWorkingDay, x1.turnsCriticalByIso], ['not_comparable', null, null, null]);
  assert.match(x1.reason, /no matching activity id/);
  assert.equal(partial.notComparableCount, 1);
  assert.equal(partial.earliestTurnsCritical, null, 'no eroding activity left to date');
  // No CMeng CPM for the current revision: stages and erosion stay not established.
  const none = pmcScheduleRules(second!, [], '2027-02-26', {independentForecast: null, criticality} as Inputs) as any;
  assert.equal(none.drivingChain.stages.state, 'not_established');
  assert.match(none.floatErosion.reason, /CMeng CPM of the current revision is not complete and publishable/);
});
