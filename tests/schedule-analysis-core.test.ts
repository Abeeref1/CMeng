import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeSchedule,
  analyzeScheduleGraph,
  canonicalScheduleFromTabular,
  canonicalScheduleFromXer,
  type CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import {
  buildScheduleAnalyticsProjection,
  serializeScheduleAnalyticsProjection,
} from "../packages/schedule-analytics/src";
import {
  parseScheduleCsv,
} from "../packages/schedule-tabular-parser/src";
import {
  parseXerBytes,
} from "../packages/xer-parser/src";

function model(
  overrides: Partial<CanonicalScheduleModel> = {},
): CanonicalScheduleModel {
  return {
    projectId: "P88",
    source: "schedule_csv",
    sourceRevisionId: "rev-1",
    dataDateIso: "2026-09-18",
    activities: [
      {
        projectId: "P88",
        activityId: "A100",
        nativeId: null,
        name: "Mobilize",
        wbsId: "W1",
        calendarId: "CAL1",
        activityType: "task",
        status: "completed",
        baselineStartIso: "2026-01-01",
        baselineFinishIso: "2026-01-03",
        currentStartIso: "2026-01-01",
        currentFinishIso: "2026-01-03",
        actualStartIso: "2026-01-01",
        actualFinishIso: "2026-01-03",
        forecastStartIso: null,
        forecastFinishIso: null,
        originalDurationHours: 16,
        remainingDurationHours: 0,
        totalFloatHours: 0,
        freeFloatHours: 0,
        percentComplete: 100,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        projectId: "P88",
        activityId: "A200",
        nativeId: null,
        name: "Excavate",
        wbsId: "W1",
        calendarId: "CAL1",
        activityType: "task",
        status: "in_progress",
        baselineStartIso: "2026-01-03",
        baselineFinishIso: "2026-01-08",
        currentStartIso: "2026-01-03",
        currentFinishIso: "2026-01-10",
        actualStartIso: "2026-01-03",
        actualFinishIso: null,
        forecastStartIso: "2026-01-03",
        forecastFinishIso: "2026-01-10",
        originalDurationHours: 40,
        remainingDurationHours: 16,
        totalFloatHours: 16,
        freeFloatHours: 8,
        percentComplete: 60,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        projectId: "P88",
        activityId: "A300",
        nativeId: null,
        name: "Foundation Complete",
        wbsId: "W1",
        calendarId: "CAL1",
        activityType: "finish_milestone",
        status: "not_started",
        baselineStartIso: "2026-01-08",
        baselineFinishIso: "2026-01-08",
        currentStartIso: "2026-01-10",
        currentFinishIso: "2026-01-10",
        actualStartIso: null,
        actualFinishIso: null,
        forecastStartIso: "2026-01-10",
        forecastFinishIso: "2026-01-10",
        originalDurationHours: 0,
        remainingDurationHours: 0,
        totalFloatHours: 40,
        freeFloatHours: 40,
        percentComplete: 0,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    relationships: [
      {
        relationshipId: "R1",
        predecessorActivityId: "A100",
        successorActivityId: "A200",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        relationshipId: "R2",
        predecessorActivityId: "A200",
        successorActivityId: "A300",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    wbs: [
      {
        wbsId: "W1",
        parentWbsId: null,
        name: "Civil",
        sourceRefs: [],
      },
    ],
    calendars: [
      {
        calendarId: "CAL1",
        name: "5 Day",
        semanticComplete: true,
        sourceRefs: [],
      },
    ],
    diagnostics: [],
    ...overrides,
  };
}

test("schedule graph builds one healthy acyclic chain", () => {
  const graph = analyzeScheduleGraph(model());

  assert.equal(graph.complete, true);
  assert.equal(graph.acyclic, true);
  assert.deepEqual(graph.openStartActivityIds, ["A100"]);
  assert.deepEqual(graph.openFinishActivityIds, ["A300"]);
  assert.deepEqual(graph.isolatedActivityIds, []);
  assert.equal(graph.connectedComponentCount, 1);
  assert.equal(graph.logicDensity, 0.666667);
  assert.deepEqual(graph.topologicalOrder, [
    "A100",
    "A200",
    "A300",
  ]);
});

test("schedule graph exposes exact cycle participants", () => {
  const input = model({
    relationships: [
      {
        relationshipId: "R1",
        predecessorActivityId: "A100",
        successorActivityId: "A200",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        relationshipId: "R2",
        predecessorActivityId: "A200",
        successorActivityId: "A100",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
  });

  const graph = analyzeScheduleGraph(input);

  assert.equal(graph.complete, false);
  assert.equal(graph.acyclic, false);
  assert.deepEqual(graph.cyclicActivityIds, [
    "A100",
    "A200",
  ]);
  assert.equal(graph.topologicalOrder, null);
});

test("missing float is not treated as zero or critical", () => {
  const input = model();
  input.activities[1]!.totalFloatHours = null;

  const result = analyzeSchedule(input);

  assert.equal(result.float.knownFloatCount, 2);
  assert.equal(result.float.unknownFloatCount, 1);
  assert.equal(result.float.coveragePercent, 66.6667);
  assert.equal(result.float.criticalCount, null);
  assert.equal(result.float.knownClassifications.critical, 1);
  assert.equal(result.float.nearCriticalCount, null);
});

test("working-day near-critical basis does not validate against the unused legacy hour threshold", () => {
  const input = model();
  input.calendars[0] = {
    ...input.calendars[0]!,
    standardDayHours: 8,
    standardWeekHours: 40,
  };

  const result = analyzeSchedule(input, {
    criticalFloatThresholdHours: 48,
    nearCriticalFloatThresholdHours: 40,
    nearCriticalWorkingDays: 5,
    floatRiskWatchlistIncludesCriticalThreshold: true,
    varianceLateThresholdDays: 0,
  });

  assert.equal(
    result.float.nearCriticalThresholdBasis,
    "activity_working_days",
  );
  assert.equal(
    result.float.nearCriticalWorkingDays,
    5,
  );
  assert.equal(
    result.float.nearCriticalThresholdHours,
    null,
  );
});

test("missing percent complete is excluded from averages and coverage", () => {
  const input = model();
  input.activities[1]!.percentComplete = null;

  const result = analyzeSchedule(input);

  assert.equal(
    result.progress.percentCompleteAverage.knownCount,
    2,
  );
  assert.equal(
    result.progress.percentCompleteAverage.coveragePercent,
    66.6667,
  );
  assert.equal(
    result.progress.durationWeightedPercentComplete.value,
    100,
  );
  assert.equal(
    result.progress.durationWeightedPercentComplete.knownCount,
    1,
  );
});

test("completion bases stay separate and actual completion stays partial until project is actually complete", () => {
  const result = analyzeSchedule(model());

  const programme = result.completionBases.find(
    (basis) => basis.basis === "programme",
  )!;
  const forecast = result.completionBases.find(
    (basis) => basis.basis === "forecast",
  )!;
  const actual = result.completionBases.find(
    (basis) => basis.basis === "actual",
  )!;

  assert.equal(programme.dateIso, "2026-01-08");
  assert.equal(programme.state, "available");
  assert.equal(forecast.dateIso, "2026-01-10");
  assert.equal(forecast.state, "available");
  assert.equal(actual.dateIso, null);
  assert.equal(actual.state, "partial");
});

test("schedule analytics reports source finish variance without pretending to recompute CPM", () => {
  const result = analyzeSchedule(model());

  assert.equal(
    result.finishVariance.comparableActivities,
    3,
  );
  assert.equal(result.finishVariance.lateActivities, 2);
  assert.equal(
    result.finishVariance.maximumDelayDays,
    2,
  );
  assert.match(
    result.finishVariance.method,
    /baseline finish/,
  );
});

test("tabular adapter preserves baseline actual current dates and embedded logic", () => {
  const csv = [
    "Activity ID,Activity Name,Baseline Start,Baseline Finish,Current Start,Current Finish,Actual Start,Actual Finish,Original Duration (h),Total Float (h),Percent Complete,Status,Predecessor ID",
    "A100,Mobilize,2026-01-01,2026-01-03,2026-01-01,2026-01-03,2026-01-01,2026-01-03,16,0,100,Completed,",
    "A200,Excavate,2026-01-03,2026-01-08,2026-01-03,2026-01-10,2026-01-03,,40,16,60,In Progress,A100",
  ].join("\n");

  const parsed = parseScheduleCsv(
    Buffer.from(csv, "utf8"),
  );
  const canonical = canonicalScheduleFromTabular(
    parsed,
    {
      sourceRevisionId: "schedule-rev-1",
      projectId: "P88",
    },
  );

  assert.equal(canonical.activities.length, 2);
  assert.equal(
    canonical.activities[0]!.baselineFinishIso,
    "2026-01-03",
  );
  assert.equal(
    canonical.activities[0]!.actualFinishIso,
    "2026-01-03",
  );
  assert.equal(
    canonical.activities[1]!.currentFinishIso,
    "2026-01-10",
  );
  assert.equal(canonical.relationships.length, 1);
  assert.equal(
    canonical.relationships[0]!.predecessorActivityId,
    "A100",
  );
  assert.equal(
    canonical.relationships[0]!.successorActivityId,
    "A200",
  );
});

test("XER adapter maps native TASKPRED ids to activity codes and uses source total float", () => {
  const xer = [
    "ERMHDR\t23.12",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name\tlast_recalc_date",
    "%R\t1\tP88\t2026-01-05",
    "%T\tPROJWBS",
    "%F\twbs_id\tproj_id\twbs_short_name",
    "%R\t10\t1\tCivil",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tfree_float_hr_cnt\tphys_complete_pct",
    "%R\t100\t1\t10\tA100\tMobilize\tTT_Task\tTK_Complete\t2026-01-01\t2026-01-03\t2026-01-01\t2026-01-03\t2026-01-01\t2026-01-03\t16\t0\t0\t0\t100",
    "%R\t101\t1\t10\tA200\tExcavate\tTT_Task\tTK_Active\t2026-01-03\t2026-01-08\t2026-01-03\t2026-01-10\t2026-01-03\t\t40\t16\t16\t8\t60",
    "%T\tTASKPRED",
    "%F\ttask_pred_id\tproj_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt",
    "%R\t900\t1\t101\t100\tPR_FS\t0",
    "%E",
  ].join("\n");

  const parsed = parseXerBytes(
    Buffer.from(xer, "utf8"),
  );
  const canonical = canonicalScheduleFromXer(
    parsed,
    {
      sourceRevisionId: "xer-rev-1",
    },
  );

  assert.equal(canonical.projectId, "P88");
  assert.equal(canonical.dataDateIso, "2026-01-05");
  assert.equal(canonical.activities.length, 2);
  assert.equal(
    canonical.activities[1]!.totalFloatHours,
    16,
  );
  assert.equal(
    canonical.activities[1]!.status,
    "in_progress",
  );
  assert.equal(canonical.relationships.length, 1);
  assert.equal(
    canonical.relationships[0]!.predecessorActivityId,
    "A100",
  );
  assert.equal(
    canonical.relationships[0]!.successorActivityId,
    "A200",
  );
  assert.equal(canonical.relationships[0]!.type, "FS");
});

test("schedule analytics projection is durable JSON-ready module output", () => {
  const projection = buildScheduleAnalyticsProjection(
    model(),
    {
      generatedAt: "2026-09-18T16:00:00.000Z",
      producerVersion: "schedule-analytics-v1",
    },
  );

  const bytes =
    serializeScheduleAnalyticsProjection(
      projection,
    );
  const decoded = JSON.parse(
    new TextDecoder().decode(bytes),
  );

  assert.equal(
    decoded.projectionKey,
    "schedule_analytics",
  );
  assert.equal(
    decoded.result.graph.complete,
    true,
  );
  assert.equal(
    decoded.result.milestones.milestoneActivityIds[0],
    "A300",
  );
});
