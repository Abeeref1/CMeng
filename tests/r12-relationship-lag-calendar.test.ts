import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import * as vm from 'node:vm';
import {createSourceFile, ScriptTarget, isFunctionDeclaration} from 'typescript';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {reportingState} from '../packages/runtime-api/src/reporting-state';
import {attachFloatWorkingDays, lagWorkingDays} from '../packages/runtime-api/src/activity-float-reconciliation';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import * as scheduleCpm from '../packages/schedule-cpm/src';
import {canonicalScheduleFromPrimaveraXml, canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src';
import {parsePrimaveraXml} from '../packages/primavera-xml-parser/src';
import {parseXerBytes} from '../packages/xer-parser/src';
process.env.CMENG_OCR_ENABLED = '0';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Results are read as plain data (any), so this test also compiles and runs,
// and fails, on the code before the fix.
const LAG_CALENDAR_NOT_STATED_BASIS = 'lag calendar not stated in the programme; successor calendar used';
const cpmOf = (model: unknown, config: Record<string, unknown>): any => scheduleCpm.calculateCpm(model as any, config as any);
const relationshipLagCalendarSummary = (scheduleCpm as any).relationshipLagCalendarSummary;

// R12: P6 measures relationship lag on the calendar the project option
// "Calendar for scheduling Relationship Lag" states (XER PROJECT field
// sched_calendar_on_relationship_lag: rcal_Predecessor, rcal_Successor,
// rcal_24Hour, rcal_ProjDefault). CMeng always used the successor calendar.
// One XER, uploaded through the real upload path four times (once per
// option) and once without the field; every CMeng CPM date equals the
// independent solver (tools/independent/cpm-solver.cjs, rule 4b) and the hand
// calculation below.
//
// Hand calculation. All calendars work 08:00-16:00 (8 h a day):
//   C5 Mon-Fri, C7 every day, C6 Mon-Sat (project default calendar,
//   PROJECT.clndr_id; no activity uses it). Data Date Mon 04 Jan 2027 08:00.
//   A (C5) 40 h, P (C7) 8 h, B (C7) 16 h, D (C5) 8 h.
//   A -> B FS lag 16 h; P -> B FS lag 16 h; B -> D SS lag 8 h.
//   A: Mon 04 08:00 - Fri 08 16:00. P: Mon 04 08:00 - Mon 04 16:00 (all options).
// Successor calendar (rcal_Successor; also the not-stated case):
//   A->B on C7 from Fri 16:00: Sat 09 + Sun 10 -> Sun 10 16:00 -> B Mon 11 08:00 - Tue 12 16:00.
//   (P->B on C7: Tue 05 + Wed 06 -> Thu 07 08:00, not driving.)
//   B->D on C5 from Mon 11 08:00: Mon 11 16:00 -> D Tue 12 08:00 - 16:00. Finish Tue 12 16:00.
//   Late: B LS Mon 11 08:00; less 16 h on C7 = Sat 09 08:00 -> A LF Fri 08 16:00 (TF 0),
//   P LF Fri 08 16:00 -> TF Tue-Fri = 32 h.
// Predecessor calendar (rcal_Predecessor):
//   A->B on C5: Mon 11 + Tue 12 -> B Wed 13 08:00 - Thu 14 16:00.
//   B->D on C7 from Wed 13 08:00: Wed 13 16:00 -> D Thu 14 08:00 - 16:00. Finish Thu 14 16:00.
//   Late: B LS Wed 13 08:00; P->B on C7: less 16 h = Mon 11 08:00 -> P LF Sun 10 16:00, TF 48 h.
// 24-hour calendar (rcal_24Hour):
//   A->B: Fri 16:00 + 16 h = Sat 09 08:00 -> B Sat 09 08:00 - Sun 10 16:00.
//   B->D: Sat 09 08:00 + 8 h = Sat 16:00 -> D Mon 11 08:00 - 16:00. Finish Mon 11 16:00.
//   Late: B LF Mon 11 16:00, LS Sun 10 08:00, TF 8 h (D's SS bound Mon 11 00:00 is not binding).
//   A->B: Sun 08:00 - 16 h = Sat 16:00 -> A LF Fri 08 16:00, TF 0. P LF Sat 09 16:00, TF 40 h.
// Project default calendar C6 (rcal_ProjDefault):
//   A->B on C6 from Fri 16:00: Sat 09 + Mon 11 -> Mon 11 16:00 -> B Tue 12 08:00 - Wed 13 16:00.
//   B->D on C6 from Tue 12 08:00: Tue 16:00 -> D Wed 13 08:00 - 16:00. Finish Wed 13 16:00.
//   Late: B LS Tue 12 08:00; less 16 h on C6 = Sat 09 08:00 -> A LF Fri 08 16:00, P LF Fri 08 16:00, TF 32 h.

const requireCjs = createRequire(__filename);
const {solve} = requireCjs(resolve(process.cwd(), 'tools/independent/cpm-solver.cjs'));
const DAY = '(0||0(s|08:00|f|16:00)())';
// P6 day numbers: 1 = Sunday .. 7 = Saturday.
const calendarData = (days: number[]) => '(0||CalendarData()((0||DaysOfWeek()(' + [1, 2, 3, 4, 5, 6, 7].map(d => '(0||' + d + '()(' + (days.includes(d) ? DAY : '') + '))').join('') + '))(0||Exceptions()())))';
type Rule = 'rcal_Successor' | 'rcal_Predecessor' | 'rcal_24Hour' | 'rcal_ProjDefault';
function xer(option: Rule | null) {
  const task = (id: number, cal: string, code: string, hours: number) => ['%R', id, 1, 'W0', cal, code, 'Activity ' + code, 'TT_Task', 'TK_NotStart',
    '2027-01-04 08:00', '2027-01-20 16:00', '2027-01-04 08:00', '2027-01-20 16:00', '2027-01-04 08:00', '2027-01-20 16:00', '', '', hours, hours, '', 0].join('\t');
  const link = (id: number, succ: number, pred: number, type: string, lag: number) => ['%R', id, succ, pred, type, lag, 1, 1].join('\t');
  return Buffer.from(['ERMHDR\t23.12',
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tlast_recalc_date\tclndr_id' + (option ? '\tsched_calendar_on_relationship_lag' : ''),
    '%R\t1\tLAGCAL\t2027-01-04 08:00\tC6' + (option ? '\t' + option : ''),
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC5\tMon-Fri 8h\t8\t40\t' + calendarData([2, 3, 4, 5, 6]),
    '%R\tC7\tSeven day 8h\t8\t56\t' + calendarData([1, 2, 3, 4, 5, 6, 7]),
    '%R\tC6\tMon-Sat 8h\t8\t48\t' + calendarData([2, 3, 4, 5, 6, 7]),
    '%T\tPROJWBS', '%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name', '%R\tW0\t1\t\tLAGCAL\tLag calendar project',
    '%T\tTASK', '%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\trestart_date\treend_date\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct',
    task(101, 'C5', 'A', 40), task(102, 'C7', 'P', 8), task(103, 'C7', 'B', 16), task(104, 'C5', 'D', 8),
    '%T\tTASKPRED', '%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\tpred_proj_id',
    link(1, 103, 101, 'PR_FS', 16), link(2, 103, 102, 'PR_FS', 16), link(3, 104, 103, 'PR_SS', 8),
    '%E'].join('\n'));
}

const C5 = {id: 'C5', workDays: [1, 2, 3, 4, 5], startHour: 8, hoursPerDay: 8, holidays: [] as string[]};
const C7 = {id: 'C7', workDays: [0, 1, 2, 3, 4, 5, 6], startHour: 8, hoursPerDay: 8, holidays: [] as string[]};
const C6 = {id: 'C6', workDays: [1, 2, 3, 4, 5, 6], startHour: 8, hoursPerDay: 8, holidays: [] as string[]};
function independent(rule: 'successor' | 'predecessor' | '24_hour' | 'project_default' | undefined) {
  return solve({dataDate: '2027-01-04T08:00:00Z', calendars: [C5, C7, C6], ...(rule ? {lagCalendar: rule} : {}), projectDefaultCalendar: 'C6',
    activities: [{id: 'A', calendar: 'C5', duration: 40}, {id: 'P', calendar: 'C7', duration: 8}, {id: 'B', calendar: 'C7', duration: 16}, {id: 'D', calendar: 'C5', duration: 8}],
    relationships: [{pred: 'A', succ: 'B', type: 'FS', lag: 16}, {pred: 'P', succ: 'B', type: 'FS', lag: 16}, {pred: 'B', succ: 'D', type: 'SS', lag: 8}]});
}

const at = (day: number, hour: number) => '2027-01-' + String(day).padStart(2, '0') + 'T' + String(hour).padStart(2, '0') + ':00:00.000Z';
type Row = [earlyStart: string, earlyFinish: string, lateStart: string, lateFinish: string, totalFloatHours: number];
const A: Row = [at(4, 8), at(8, 16), at(4, 8), at(8, 16), 0];
const HAND: Record<string, {finish: string; rows: Record<string, Row>; rule: string; method: string; basis: string; stated: boolean}> = {
  successor: {finish: at(12, 16), rule: 'successor', method: 'successor_calendar_forward_and_backward', stated: true,
    basis: 'lag calendar stated in the programme: successor activity calendar',
    rows: {A, P: [at(4, 8), at(4, 16), at(8, 8), at(8, 16), 32], B: [at(11, 8), at(12, 16), at(11, 8), at(12, 16), 0], D: [at(12, 8), at(12, 16), at(12, 8), at(12, 16), 0]}},
  predecessor: {finish: at(14, 16), rule: 'predecessor', method: 'predecessor_calendar_forward_and_backward', stated: true,
    basis: 'lag calendar stated in the programme: predecessor activity calendar',
    rows: {A, P: [at(4, 8), at(4, 16), at(10, 8), at(10, 16), 48], B: [at(13, 8), at(14, 16), at(13, 8), at(14, 16), 0], D: [at(14, 8), at(14, 16), at(14, 8), at(14, 16), 0]}},
  '24_hour': {finish: at(11, 16), rule: '24_hour', method: '24_hour_calendar_forward_and_backward', stated: true,
    basis: 'lag calendar stated in the programme: 24-hour calendar (continuous time)',
    rows: {A, P: [at(4, 8), at(4, 16), at(9, 8), at(9, 16), 40], B: [at(9, 8), at(10, 16), at(10, 8), at(11, 16), 8], D: [at(11, 8), at(11, 16), at(11, 8), at(11, 16), 0]}},
  project_default: {finish: at(13, 16), rule: 'project_default', method: 'project_default_calendar_forward_and_backward', stated: true,
    basis: 'lag calendar stated in the programme: project default calendar (C6)',
    rows: {A, P: [at(4, 8), at(4, 16), at(8, 8), at(8, 16), 32], B: [at(12, 8), at(13, 16), at(12, 8), at(13, 16), 0], D: [at(13, 8), at(13, 16), at(13, 8), at(13, 16), 0]}},
};
const RUNS: Array<{option: Rule | null; key: keyof typeof HAND; solverRule: Parameters<typeof independent>[0]}> = [
  {option: 'rcal_Successor', key: 'successor', solverRule: 'successor'},
  {option: 'rcal_Predecessor', key: 'predecessor', solverRule: 'predecessor'},
  {option: 'rcal_24Hour', key: '24_hour', solverRule: '24_hour'},
  {option: 'rcal_ProjDefault', key: 'project_default', solverRule: 'project_default'},
  {option: null, key: 'successor', solverRule: undefined},
];

async function upload(option: Rule | null) {
  // Project IDs are held in upper case by the runtime.
  const projectId = ('R12-LAGCAL-' + (option ?? 'NOT-STATED') + '-' + process.pid).toUpperCase().replace(/_/g, '-');
  runtimeProjects.getOrCreate(projectId);
  await runtimeProjects.ingestSchedule({projectId, sourceFilename: 'LAGCAL programme ' + (option ?? 'no option') + '.xer', bytes: xer(option), mediaType: 'text/plain',
    uploadedAt: '2027-01-04T09:00:00Z', role: 'update', uploadIntent: 'replace_current_basis'});
  return projectId;
}

for (const run of RUNS) {
  test('R12 lag calendar ' + (run.option ?? 'not stated') + ': uploaded XER, CMeng CPM dates = independent solver = hand calculation', async () => {
    const projectId = await upload(run.option);
    const state = runtimeProjects.get(projectId)!;
    const model: any = projectControlSchedule(reportingState(state))!.revision.model;
    const hand = HAND[run.key]!;
    // 1. The defect: every CMeng CPM date and float = the hand calculation.
    const cpm = cpmOf(model, {durationBasis: 'remaining', applySourceConstraints: true});
    assert.equal(cpm.complete, true, JSON.stringify(cpm.diagnostics));
    for (const [id, row] of Object.entries(hand.rows)) {
      const c = cpm.activities.find((a: any) => a.activityId === id)!;
      assert.deepEqual([c.earlyStartIso, c.earlyFinishIso, c.lateStartIso, c.lateFinishIso, c.totalFloatHours], row, id + ' CMeng CPM = hand');
    }
    assert.equal(cpm.projectFinishIso, hand.finish, 'CMeng CPM finish = hand');
    // 2. The independent solver, applying the same stated rule on its own, agrees.
    const ind = independent(run.solverRule);
    for (const [id, row] of Object.entries(hand.rows)) {
      const s = ind.activities.find((a: {id: string}) => a.id === id);
      assert.deepEqual([s.earlyStart, s.earlyFinish, s.lateStart, s.lateFinish, s.totalFloatHours], row, id + ' solver = hand');
    }
    assert.equal(ind.projectFinish, hand.finish, 'solver finish = hand');
    assert.equal(ind.lagCalendarRule, run.solverRule === '24_hour' ? '24_hour_continuous_both_passes' : (run.solverRule ?? 'successor') + '_calendar_both_passes');
    // 3. The reader keeps the stated option and the project default calendar.
    if (run.option) assert.deepEqual(model.relationshipLagCalendar, {rule: run.key, sourceValue: run.option, projectDefaultCalendarId: 'C6', sourceRef: 'XER PROJECT.sched_calendar_on_relationship_lag'});
    else assert.equal(model.relationshipLagCalendar, undefined, 'file without the field: nothing stated');
    assert.equal(cpm.relationshipLagCalendarMethod, hand.method);
    assert.deepEqual(cpm.assumptions, [], 'a stated (or not stated) option adds no assumption');

    // The forecast page of the uploaded project carries the same CPM dates and the basis.
    const page = moduleForProject(projectId, 'independent-forecast').data as any;
    assert.equal(page.independentForecastCompletionIso, hand.finish);
    assert.deepEqual(page.relationshipLagCalendar, {rule: hand.rule, stated: run.option !== null, sourceValue: run.option,
      projectDefaultCalendarId: run.key === 'project_default' ? 'C6' : null, basis: run.option ? hand.basis : LAG_CALENDAR_NOT_STATED_BASIS});
    for (const [id, row] of Object.entries(hand.rows)) {
      const r = page.activities.find((a: {activityId: string}) => a.activityId === id);
      assert.deepEqual([r.independentEarlyStartIso, r.independentEarlyFinishIso, r.independentTotalFloatHours], [row[0], row[1], row[4]], id + ' forecast page');
    }
    const script = cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
    const source = createSourceFile('browser.js', script, ScriptTarget.Latest, true);
    const fn = source.statements.filter(isFunctionDeclaration).find(n => n.name?.text === 'forecastLagCalendarText')!;
    assert.ok(fn, 'forecast page states the lag calendar basis');
    assert.equal(vm.runInNewContext(fn.getText(source) + ';forecastLagCalendarText(p)', {p: page, escapeHtml: String}),
      '<p><b>Relationship lag calendar:</b> ' + (run.option ? hand.basis : LAG_CALENDAR_NOT_STATED_BASIS) + '</p>');

    // Lag in working days is shown on the same calendar the CPM counts it on.
    const relationships = attachFloatWorkingDays({relationships: model.relationships.map((r: any) => ({successorActivityId: r.successorActivityId, predecessorActivityId: r.predecessorActivityId, lagHours: r.lagHours}))}, model) as any;
    const expectedBasis = run.option === null ? 'successor_activity_calendar' : {successor: 'successor_activity_calendar', predecessor: 'predecessor_activity_calendar', '24_hour': '24_hour_calendar', project_default: 'project_default_calendar'}[run.key];
    const expectedDays = run.key === '24_hour' ? [16 / 24, 16 / 24, 8 / 24].map(v => Number(v.toFixed(6))) : [2, 2, 1];
    assert.deepEqual(relationships.relationships.map((r: any) => [r.lagWorkingDays, r.lagDaysBasis]), expectedDays.map(d => [d, expectedBasis]));
    assert.equal((lagWorkingDays as any)(model, 'B', 16, 'A').basis, expectedBasis);
  });
}

test('R12 not stated: figures are exactly the successor-calendar figures, labelled as not stated', async () => {
  const stated = canonicalScheduleFromXer(parseXerBytes(xer('rcal_Successor')), {sourceRevisionId: 'r12-s'});
  const notStated = canonicalScheduleFromXer(parseXerBytes(xer(null)), {sourceRevisionId: 'r12-s'});
  const a = cpmOf(stated, {durationBasis: 'remaining'}), b = cpmOf(notStated, {durationBasis: 'remaining'});
  assert.deepEqual(b.activities, a.activities);
  assert.equal(b.projectFinishIso, a.projectFinishIso);
  assert.equal(b.relationshipLagCalendarMethod, 'successor_calendar_forward_and_backward');
  assert.deepEqual(Object.keys(b), Object.keys(a), 'same CPM result shape');
  assert.deepEqual((relationshipLagCalendarSummary as any)(notStated), {rule: 'successor', stated: false, sourceValue: null, projectDefaultCalendarId: null, basis: LAG_CALENDAR_NOT_STATED_BASIS});
  // The default calendar is read only when the option is stated.
  assert.equal(notStated.sourceColumnAudit?.find(c => c.table === 'PROJECT' && c.sourceHeader === 'clndr_id')?.mappingState, 'unused');
});

test('R12 unknown stays unknown: an unrecognised option is an assumption; an unreadable project default calendar withholds the CPM', () => {
  const odd: any = canonicalScheduleFromXer(parseXerBytes(Buffer.from(xer('rcal_Predecessor').toString().replace('rcal_Predecessor', 'rcal_Something'))), {sourceRevisionId: 'r12-u'});
  assert.equal(odd.relationshipLagCalendar?.rule, null);
  const cpm = cpmOf(odd, {durationBasis: 'remaining'});
  assert.equal(cpm.relationshipLagCalendarMethod, 'successor_calendar_forward_and_backward');
  assert.equal((relationshipLagCalendarSummary as any)(odd).stated, false);
  assert.deepEqual(cpm.assumptions, ['RELATIONSHIP_LAG_CALENDAR_NOT_ESTABLISHED_SUCCESSOR_CALENDAR_ASSUMED:rcal_Something']);
  const missing = canonicalScheduleFromXer(parseXerBytes(Buffer.from(xer('rcal_ProjDefault').toString().replace('LAGCAL\t2027-01-04 08:00\tC6', 'LAGCAL\t2027-01-04 08:00\tC9'))), {sourceRevisionId: 'r12-m'});
  const withheld = cpmOf(missing, {durationBasis: 'remaining'});
  assert.equal(withheld.complete, false);
  assert.equal(withheld.projectFinishIso, null);
  assert.ok(withheld.diagnostics.includes('CPM_RELATIONSHIP_LAG_CALENDAR_UNRESOLVED:project_default:C9'));
});

test('R12 P6 XML: Project.RelationshipLagCalendar and the project default calendar are read into the model', () => {
  const xml = (value: string) => `<?xml version="1.0" encoding="UTF-8"?>
 <APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V1">
  <Project><ObjectId>10</ObjectId><Id>P88</Id><Name>Project 88</Name><ActivityDefaultCalendarObjectId>600</ActivityDefaultCalendarObjectId>${value}</Project>
  <Calendar><ObjectId>500</ObjectId><Name>5 Day</Name></Calendar>
  <Activity><ProjectObjectId>10</ProjectObjectId><ObjectId>1000</ObjectId><Id>A100</Id><Name>Excavation</Name><CalendarObjectId>500</CalendarObjectId></Activity>
 </APIBusinessObjects>`;
  const read = (value: string): any => canonicalScheduleFromPrimaveraXml(parsePrimaveraXml(Buffer.from(xml(value), 'utf8')), {sourceRevisionId: 'x1', projectId: 'P88'});
  for (const [text, rule] of [['Predecessor Activity Calendar', 'predecessor'], ['Successor Activity Calendar', 'successor'], ['24 Hour Calendar', '24_hour'], ['Project Default Calendar', 'project_default']] as const) {
    assert.deepEqual(read('<RelationshipLagCalendar>' + text + '</RelationshipLagCalendar>').relationshipLagCalendar,
      {rule, sourceValue: text, projectDefaultCalendarId: '600', sourceRef: 'P6 XML Project.RelationshipLagCalendar'}, text);
  }
  assert.equal(read('').relationshipLagCalendar, undefined, 'not stated: nothing read');
});
