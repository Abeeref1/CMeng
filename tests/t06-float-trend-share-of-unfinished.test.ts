// SW-25 (T06): float trend across programme revisions. As work completes the
// unfinished population shrinks, so a falling raw count of critical or
// negative-float activities can be completion alone. Every point must carry its
// population and share, and the direction and wording must use the share.
import test from "node:test";
import assert from "node:assert/strict";
import {runInNewContext} from "node:vm";
import {createSourceFile, isFunctionDeclaration, ScriptTarget} from "typescript";

import type {CanonicalScheduleActivity, CanonicalScheduleModel} from "../packages/schedule-analysis-core/src";
import type {ScheduleRevision} from "../packages/schedule-revision-core/src";
import {buildRevisionTrendProjection} from "../packages/revision-trend/src";
import {buildVarianceTrendsProjection} from "../packages/variance-trends/src";
import {cmengUatHtml} from "../packages/runtime-api/src/ui";

function activity(activityId: string, overrides: Partial<CanonicalScheduleActivity> = {}): CanonicalScheduleActivity {
  return {
    projectId: "SW25", activityId, nativeId: null, name: activityId, wbsId: "W1", calendarId: "CAL1",
    activityType: "task", status: "not_started",
    baselineStartIso: "2026-01-01", baselineFinishIso: "2026-01-10",
    currentStartIso: "2026-01-01", currentFinishIso: "2026-01-10",
    actualStartIso: null, actualFinishIso: null, forecastStartIso: null, forecastFinishIso: null,
    originalDurationHours: 40, remainingDurationHours: 40, totalFloatHours: 400, freeFloatHours: 0,
    percentComplete: 0, sourceRefs: [], diagnostics: [], ...overrides,
  };
}

const completed = {status: "completed" as const, actualStartIso: "2026-01-01", actualFinishIso: "2026-01-05", remainingDurationHours: 0, percentComplete: 100};

function model(revisionId: string, dataDateIso: string, activities: CanonicalScheduleActivity[]): CanonicalScheduleModel {
  return {
    projectId: "SW25", source: "schedule_xlsx", sourceRevisionId: revisionId, dataDateIso, activities,
    relationships: [], wbs: [{wbsId: "W1", parentWbsId: null, name: "Works", sourceRefs: []}],
    calendars: [{calendarId: "CAL1", name: "5 Day", semanticComplete: true, sourceRefs: []}], diagnostics: [],
  };
}

// Revision 1: 10 unfinished activities, 4 of them with negative (critical) float = 40%.
// Revision 2: two of the critical and three of the non-critical activities are
// completed. Nothing else changes. Counts fall 4 -> 2, the population falls
// 10 -> 5, and the share stays 40%. That is completion, not improvement.
function onlyCompletionRevisions(): ScheduleRevision[] {
  const ids = Array.from({length: 10}, (_, index) => "A" + (index + 1));
  const isCritical = (id: string) => ["A1", "A2", "A3", "A4"].includes(id);
  const first = ids.map(id => activity(id, isCritical(id) ? {totalFloatHours: -8} : {}));
  const finished = new Set(["A1", "A2", "A5", "A6", "A7"]);
  const second = ids.map(id => activity(id, {...(isCritical(id) ? {totalFloatHours: -8} : {}), ...(finished.has(id) ? completed : {})}));
  return [
    {revisionId: "R1", label: "Update 1", sequence: 1, effectiveAt: "2026-01-04", model: model("R1", "2026-01-04", first)},
    {revisionId: "R2", label: "Update 2", sequence: 2, effectiveAt: "2026-02-04", model: model("R2", "2026-02-04", second)},
  ];
}

const options = {generatedAt: "2026-10-19T10:00:00.000Z", producerVersion: "sw25-test"};

test("SW-25: revision trend carries the unfinished population and share; a count that falls only by completion is not improvement", () => {
  const projection = buildRevisionTrendProjection(onlyCompletionRevisions(), options);
  const [first, last] = projection.points;
  // Raw counts remain available and unchanged in meaning.
  assert.equal(first!.criticalCount, 4); assert.equal(last!.criticalCount, 2);
  assert.equal(first!.negativeFloatCount, 4); assert.equal(last!.negativeFloatCount, 2);
  // Each point carries its denominator and the share of it.
  assert.equal(first!.unfinishedExecutionActivityCount, 10); assert.equal(last!.unfinishedExecutionActivityCount, 5);
  assert.equal(first!.floatShareBasis, "unfinished_execution_activities");
  assert.equal(first!.criticalSharePercent, 40); assert.equal(last!.criticalSharePercent, 40);
  assert.equal(first!.negativeFloatSharePercent, 40); assert.equal(last!.negativeFloatSharePercent, 40);

  const critical = projection.floatTrend!.measures.find(row => row.measure === "critical")!;
  assert.equal(projection.floatTrend!.basis, "share_of_unfinished_execution_activities");
  assert.equal(critical.countChange, -2);
  assert.equal(critical.shareChangePercentagePoints, 0);
  assert.equal(critical.direction, "share_unchanged");
  assert.notEqual(critical.direction, "share_lower");
  assert.equal(critical.countFellWithoutShareFalling, true);
  assert.deepEqual([critical.fromPopulation, critical.toPopulation], [10, 5]);
  const negative = projection.floatTrend!.measures.find(row => row.measure === "negative_float")!;
  assert.equal(negative.direction, "share_unchanged");
  assert.equal(negative.countFellWithoutShareFalling, true);
});

test("SW-25: variance trend uses the same population, share and direction", () => {
  const revisions = onlyCompletionRevisions();
  const projection = buildVarianceTrendsProjection(revisions, {...options, controlledBaselineRevision: revisions[0]!});
  assert.deepEqual(projection.points.map(point => [point.criticalCount, point.unfinishedExecutionActivityCount, point.criticalSharePercent]), [[4, 10, 40], [2, 5, 40]]);
  const critical = projection.floatTrend!.measures.find(row => row.measure === "critical")!;
  assert.equal(critical.direction, "share_unchanged");
  assert.equal(critical.countFellWithoutShareFalling, true);
});

test("SW-25: a falling count with a rising share reads as a higher share; a real share fall reads as lower", () => {
  const revisions = onlyCompletionRevisions();
  // Complete one critical and four non-critical activities instead: 3 of 5 = 60%.
  const rising = revisions[1]!.model.activities.map(row => activity(row.activityId, {
    ...(["A1", "A2", "A3", "A4"].includes(row.activityId) ? {totalFloatHours: -8} : {}),
    ...(["A1", "A5", "A6", "A7", "A8"].includes(row.activityId) ? completed : {}),
  }));
  const risingTrend = buildRevisionTrendProjection([revisions[0]!, {...revisions[1]!, model: {...revisions[1]!.model, activities: rising}}], options).floatTrend!;
  const risingCritical = risingTrend.measures.find(row => row.measure === "critical")!;
  assert.equal(risingCritical.countChange, -1);
  assert.equal(risingCritical.direction, "share_higher");
  assert.equal(risingCritical.shareChangePercentagePoints, 20);
  assert.equal(risingCritical.countFellWithoutShareFalling, true);

  // Float recovered on two critical activities with nothing completed: 2 of 10 = 20%.
  const recovered = revisions[0]!.model.activities.map(row => ["A1", "A2"].includes(row.activityId) ? {...row, totalFloatHours: 400} : row);
  const recoveredTrend = buildRevisionTrendProjection([revisions[0]!, {...revisions[1]!, model: {...revisions[1]!.model, activities: recovered}}], options).floatTrend!;
  const recoveredCritical = recoveredTrend.measures.find(row => row.measure === "critical")!;
  assert.equal(recoveredCritical.direction, "share_lower");
  assert.equal(recoveredCritical.countFellWithoutShareFalling, false);
});

test("SW-25: unknown float stays unknown in share and direction, never 0", () => {
  const revisions = onlyCompletionRevisions();
  const unknown = revisions[1]!.model.activities.map(row => row.activityId === "A3" ? {...row, totalFloatHours: null} : row);
  const projection = buildRevisionTrendProjection([revisions[0]!, {...revisions[1]!, model: {...revisions[1]!.model, activities: unknown}}], options);
  assert.equal(projection.points[1]!.criticalCount, null);
  assert.equal(projection.points[1]!.criticalSharePercent, null);
  const critical = projection.floatTrend!.measures.find(row => row.measure === "critical")!;
  assert.equal(critical.direction, "not_established");
  assert.equal(critical.shareChangePercentagePoints, null);
});

test("SW-25: the float trend chart plots the share and its text does not call a completion-only fall an improvement", () => {
  const projection = buildRevisionTrendProjection(onlyCompletionRevisions(), options);
  const script = cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source = createSourceFile("browser.js", script, ScriptTarget.Latest, true);
  const fn = source.statements.filter(isFunctionDeclaration).find(node => node.name?.text === "renderFloatPressureTrend")!.getText(source);
  const charted: any[] = [], panels: string[] = [];
  const html: string = runInNewContext(fn + ";renderFloatPressureTrend(points,floatTrend)", {
    points: projection.points, floatTrend: projection.floatTrend, fmt: (value: any) => value == null ? "Unresolved" : String(value),
    renderVisualPanel: (title: string, description: string) => { panels.push(title + " | " + description); return ""; },
    renderLineChart: (points: any[]) => { charted.push(points); return ""; },
  });
  assert.deepEqual(charted[0].map((point: any) => point.criticalCount), [40, 40]);
  const critical = panels.find(panel => panel.startsWith("Critical"))!;
  assert.match(critical, /^Critical · 40% → 40%/);
  // W5: the unfinished-activity base the three small charts share is said once above them.
  assert.equal((html.match(/10 → 5 unfinished/g) || []).length, 1);
  assert.match(html, /A lower count alone does not establish improvement/);
  assert.match(critical, /Share of remaining work unchanged\./);
  assert.match(critical, /The count fell from 4 to 2 while unfinished activities fell from 10 to 5; the share did not fall, so this is not an improvement\./);
  assert.doesNotMatch(critical, /Share of remaining work fell/);
});
