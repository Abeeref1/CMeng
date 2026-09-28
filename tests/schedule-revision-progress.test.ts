import test from "node:test";
import assert from "node:assert/strict";

import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import {
  compareScheduleRevisions,
  resolveRevisionActivityCorrespondence,
  type ScheduleRevision,
} from "../packages/schedule-revision-core/src";
import {
  buildScheduleChangeReportProjection,
} from "../packages/schedule-change-report/src";
import {
  buildRevisionTrendProjection,
} from "../packages/revision-trend/src";
import {
  buildVarianceTrendsProjection,
} from "../packages/variance-trends/src";
import {
  buildProgressBreakdownProjection,
} from "../packages/progress-breakdown/src";
import {
  buildProgressScurveProjection,
} from "../packages/progress-scurve/src";
import {
  buildImplementedScheduleRevisionProjection,
} from "../packages/schedule-modules/src";

function activity(
  activityId: string,
  overrides: Partial<CanonicalScheduleActivity> = {},
): CanonicalScheduleActivity {
  return {
    projectId: "P88",
    activityId,
    nativeId: null,
    name: activityId,
    wbsId: "W1",
    calendarId: "CAL1",
    activityType: "task",
    status: "not_started",
    baselineStartIso: "2026-01-01",
    baselineFinishIso: "2026-01-03",
    currentStartIso: "2026-01-01",
    currentFinishIso: "2026-01-03",
    actualStartIso: null,
    actualFinishIso: null,
    forecastStartIso: null,
    forecastFinishIso: null,
    originalDurationHours: 16,
    remainingDurationHours: 16,
    totalFloatHours: 40,
    freeFloatHours: 40,
    percentComplete: 0,
    sourceRefs: [],
    diagnostics: [],
    ...overrides,
  };
}

test('shared activity correspondence is invalidated by every mutable identity field and population change',()=>{
  const from=[activity('A',{nativeId:'1',name:'Concrete'}),activity('B',{nativeId:'2',name:'Steel'})];
  const to=from.map(a=>({...a}));
  const check=()=>assert.deepEqual(resolveRevisionActivityCorrespondence(from,to),resolveRevisionActivityCorrespondence(from.map(a=>({...a})),to.map(a=>({...a}))));
  check();
  for(const [field,value] of [['activityId','X'],['nativeId','9'],['name','Renamed'],['wbsId','W2'],['activityType','milestone']] as const){
    (to[0] as any)[field]=value;check();(from[1] as any)[field]=value;check();
  }
  to.push({...to[0]!});check();from.reverse();check();to.splice(0,1);check();
});

test('one correspondence consumer cannot alter another consumer matching the same source rows',()=>{
  const from=[activity('A')],to=[activity('A')];
  const result=resolveRevisionActivityCorrespondence(from,to);result.matches[0]!.toActivityId='invented';result.ambiguousTo.add('A');
  const next=resolveRevisionActivityCorrespondence(from,to);assert.equal(next.matches[0]!.toActivityId,'A');assert.equal(next.ambiguousTo.size,0);
});

function revision1Model(): CanonicalScheduleModel {
  return {
    projectId: "P88",
    source: "schedule_xlsx",
    sourceRevisionId: "rev-1",
    dataDateIso: "2026-01-04",
    activities: [
      activity("A100", {
        name: "Mobilize",
        status: "completed",
        baselineStartIso: "2026-01-01",
        baselineFinishIso: "2026-01-03",
        currentStartIso: "2026-01-01",
        currentFinishIso: "2026-01-03",
        actualStartIso: "2026-01-01",
        actualFinishIso: "2026-01-03",
        originalDurationHours: 16,
        remainingDurationHours: 0,
        totalFloatHours: 0,
        freeFloatHours: 0,
        percentComplete: 100,
      }),
      activity("A200", {
        name: "Excavate",
        baselineStartIso: "2026-01-03",
        baselineFinishIso: "2026-01-08",
        currentStartIso: "2026-01-03",
        currentFinishIso: "2026-01-08",
        originalDurationHours: 40,
        remainingDurationHours: 40,
        totalFloatHours: 40,
        freeFloatHours: 24,
        percentComplete: 0,
      }),
      activity("A300", {
        name: "Foundation Complete",
        activityType: "finish_milestone",
        baselineStartIso: "2026-01-08",
        baselineFinishIso: "2026-01-08",
        currentStartIso: "2026-01-08",
        currentFinishIso: "2026-01-08",
        originalDurationHours: 0,
        remainingDurationHours: 0,
        totalFloatHours: 40,
        freeFloatHours: 40,
        percentComplete: 0,
      }),
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
      {
        wbsId: "W2",
        parentWbsId: null,
        name: "MEP",
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
  };
}

function revision2Model(): CanonicalScheduleModel {
  return {
    ...revision1Model(),
    sourceRevisionId: "rev-2",
    dataDateIso: "2026-01-09",
    activities: [
      activity("A100", {
        name: "Mobilize",
        status: "completed",
        baselineStartIso: "2026-01-01",
        baselineFinishIso: "2026-01-03",
        currentStartIso: "2026-01-01",
        currentFinishIso: "2026-01-03",
        actualStartIso: "2026-01-01",
        actualFinishIso: "2026-01-03",
        originalDurationHours: 16,
        remainingDurationHours: 0,
        totalFloatHours: 0,
        freeFloatHours: 0,
        percentComplete: 100,
      }),
      activity("A200", {
        name: "Excavate",
        status: "in_progress",
        baselineStartIso: "2026-01-03",
        baselineFinishIso: "2026-01-08",
        currentStartIso: "2026-01-03",
        currentFinishIso: "2026-01-10",
        forecastStartIso: "2026-01-03",
        forecastFinishIso: "2026-01-10",
        actualStartIso: "2026-01-03",
        originalDurationHours: 40,
        remainingDurationHours: 16,
        totalFloatHours: 16,
        freeFloatHours: 8,
        percentComplete: 60,
      }),
      activity("A300", {
        name: "Foundation Complete",
        activityType: "finish_milestone",
        baselineStartIso: "2026-01-08",
        baselineFinishIso: "2026-01-08",
        currentStartIso: "2026-01-12",
        currentFinishIso: "2026-01-12",
        forecastStartIso: "2026-01-12",
        forecastFinishIso: "2026-01-12",
        originalDurationHours: 0,
        remainingDurationHours: 0,
        totalFloatHours: 40,
        freeFloatHours: 40,
        percentComplete: 0,
      }),
      activity("A400", {
        name: "MEP Release",
        wbsId: "W2",
        baselineStartIso: "2026-01-10",
        baselineFinishIso: "2026-01-10",
        currentStartIso: "2026-01-10",
        currentFinishIso: "2026-01-12",
        forecastStartIso: "2026-01-10",
        forecastFinishIso: "2026-01-12",
        originalDurationHours: 20,
        remainingDurationHours: 20,
        totalFloatHours: 24,
        freeFloatHours: 16,
        percentComplete: 0,
      }),
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
        relationshipId: "R3",
        predecessorActivityId: "A200",
        successorActivityId: "A400",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        relationshipId: "R4",
        predecessorActivityId: "A400",
        successorActivityId: "A300",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
  };
}

function revisions(): ScheduleRevision[] {
  return [
    {
      revisionId: "rev-1",
      label: "Baseline Update 1",
      sequence: 1,
      effectiveAt: "2026-01-04",
      model: revision1Model(),
    },
    {
      revisionId: "rev-2",
      label: "Update 2",
      sequence: 2,
      effectiveAt: "2026-01-09",
      model: revision2Model(),
    },
  ];
}

test("revision comparison preserves exact added modified and logic populations", () => {
  const [from, to] = revisions();
  const comparison = compareScheduleRevisions(
    from!,
    to!,
  );

  assert.deepEqual(
    comparison.addedActivityIds,
    ["A400"],
  );
  assert.deepEqual(
    comparison.removedActivityIds,
    [],
  );
  assert.deepEqual(
    comparison.modifiedActivityIds,
    ["A200", "A300"],
  );
  assert.equal(
    comparison.matchedActivityCount,
    3,
  );
  assert.equal(
    comparison.populationMatchPercent,
    75,
  );
  assert.equal(
    comparison.addedRelationships.length,
    2,
  );
  assert.equal(
    comparison.removedRelationships.length,
    1,
  );

  const a200 = comparison.activityChanges.find(
    (change) => change.activityId === "A200",
  )!;
  assert.equal(a200.finishShiftDays, 2);
  assert.equal(a200.floatShiftHours, -24);
  assert.equal(a200.progressShiftPercent, 60);
});

test("Schedule Change Report is built from immutable revision comparison", () => {
  const [from, to] = revisions();
  const projection =
    buildScheduleChangeReportProjection(
      from!,
      to!,
      {
        generatedAt:
          "2026-09-18T17:00:00.000Z",
        producerVersion:
          "schedule-change-v1",
      },
    );

  assert.equal(
    projection.addedActivityCount,
    1,
  );
  assert.equal(
    projection.modifiedActivityCount,
    2,
  );
  assert.equal(
    projection.addedRelationshipCount,
    2,
  );
  assert.equal(
    projection.removedRelationshipCount,
    1,
  );
  assert.equal(
    projection.changedActivities.length,
    3,
  );
});

test("Revision Trend preserves progress float completion and change counts by revision", () => {
  const projection =
    buildRevisionTrendProjection(
      revisions(),
      {
        generatedAt:
          "2026-09-18T17:00:00.000Z",
        producerVersion:
          "revision-trend-v1",
      },
    );

  assert.equal(projection.revisionCount, 2);
  assert.equal(
    projection.points[0]!.addedVsPrevious,
    null,
  );
  assert.equal(
    projection.points[1]!.addedVsPrevious,
    1,
  );
  assert.equal(
    projection.points[1]!.modifiedVsPrevious,
    2,
  );
  assert.equal(
    projection.points[0]!.forecastCompletionIso,
    "2026-01-08",
  );
  assert.equal(
    projection.points[1]!.forecastCompletionIso,
    "2026-01-12",
  );
  assert.ok(
    projection.points[1]!
      .durationWeightedProgressPercent! >
      projection.points[0]!
        .durationWeightedProgressPercent!,
  );
});

test("Variance Trends exposes project and activity worsening without mixing revision populations", () => {
  const projection =
    buildVarianceTrendsProjection(
      revisions(),
      {
        generatedAt:
          "2026-09-18T17:00:00.000Z",
        controlledBaselineRevision:revisions()[0]!,
        producerVersion:
          "variance-trends-v1",
      },
    );

  assert.equal(projection.revisionCount, 2);
  assert.equal(
    projection.points[0]!
      .projectCompletionVarianceDays,
    0,
  );
  assert.equal(
    projection.points[1]!
      .projectCompletionVarianceDays,
    4, // Confirmed 8 January baseline to 12 January current finish.
  );

  const a200 = projection.activityTrends.find(
    (trend) => trend.activityId === "A200",
  )!;
  assert.equal(
    a200.worseningFinishVarianceDays,
    2,
  );
  assert.deepEqual(
    a200.points.map(
      (point) => point.finishVarianceDays,
    ),
    [0, 2],
  );
});

test("Progress Breakdown uses one WBS grouping and keeps missing values out of established averages", () => {
  const input = revision2Model();
  input.activities.push(
    activity("A500", {
      wbsId: null,
      name: "Unassigned",
      percentComplete: null,
      originalDurationHours: null,
      remainingDurationHours: null,
      totalFloatHours: null,
      freeFloatHours: null,
      currentStartIso: null,
      currentFinishIso: null,
      baselineStartIso: null,
      baselineFinishIso: null,
    }),
  );

  const projection =
    buildProgressBreakdownProjection(
      input,
      {
        generatedAt:
          "2026-09-18T17:00:00.000Z",
        producerVersion:
          "progress-breakdown-v1",
      },
    );

  assert.equal(
    projection.totalActivityCount,
    5,
  );

  const civil = projection.rows.find(
    (row) => row.wbsId === "W1",
  )!;
  assert.equal(civil.activityCount, 3);
  assert.equal(civil.completedCount, 1);
  assert.equal(civil.inProgressCount, 1);
  assert.equal(
    civil.durationWeightedProgressPercent,
    71.428571,
  );

  const unassigned = projection.rows.find(
    (row) =>
      row.wbsId === "__UNASSIGNED__",
  )!;
  assert.equal(
    unassigned.percentCompleteAverage,
    null,
  );
  assert.equal(
    unassigned.floatCoveragePercent,
    0,
  );
});


test("Progress Breakdown exposes the same governed current-programme progress across six structural views", () => {
  const input = revision2Model();
  const scope = {
    rows: input.activities.map(activity => {
      if (activity.activityId === "A400") {
        return {activityId:activity.activityId,wbsId:activity.wbsId,wbsLevel:1,zone:"Zone 2",level:"Level 2",workFront:null,cbs:"CBS-B"};
      }
      return {activityId:activity.activityId,wbsId:activity.wbsId,wbsLevel:1,zone:"Zone 1",level:"Level 1",workFront:"Work Front A",cbs:"CBS-A"};
    }),
  };
  const projection = buildProgressBreakdownProjection(input,{
    generatedAt:"2026-09-18T17:00:00.000Z",
    producerVersion:"progress-breakdown-multidimension-v1",
    scopeClassification:scope,
  });
  assert.equal(projection.baselinePlanAvailable,false);
  assert.equal(projection.dimensionViews?.length,6);
  for (const key of ["wbs","wbs_level","zone","level","work_front","cbs"]) {
    assert.ok(projection.dimensionViews?.find(view=>view.dimension===key));
  }
  const wbs=projection.dimensionViews!.find(view=>view.dimension==="wbs")!;
  assert.equal(wbs.available,true);
  assert.equal(wbs.rows.filter(row=>row.classified).length,2);
  assert.equal(wbs.rows.find(row=>row.groupKey==="W1")?.scheduleProgressPercent,71.428571);
  const workFront=projection.dimensionViews!.find(view=>view.dimension==="work_front")!;
  assert.equal(workFront.classifiedPopulation,3);
  assert.equal(workFront.unclassifiedPopulation,1);
  assert.ok(workFront.rows.some(row=>row.groupLabel==="Unclassified"));
  const cbs=projection.dimensionViews!.find(view=>view.dimension==="cbs")!;
  assert.equal(cbs.rows.find(row=>row.groupLabel==="CBS-A")?.activityCount,3);
  assert.equal(cbs.rows.find(row=>row.groupLabel==="CBS-B")?.activityCount,1);
  assert.equal(projection.overallScheduleProgressPercent,52.631579);
  assert.equal(projection.hierarchyRows?.every(row=>row.baselinePlannedPercent===null),true);
});

test("Progress Breakdown keeps unsupported dimensions unavailable without inventing classifications", () => {
  const input=revision2Model();
  const projection=buildProgressBreakdownProjection(input,{
    generatedAt:"2026-09-18T17:00:00.000Z",
    producerVersion:"progress-breakdown-wbs-only-v1",
    scopeClassification:{rows:input.activities.map(activity=>({activityId:activity.activityId,wbsId:activity.wbsId,wbsLevel:1,zone:null,level:null,workFront:null,cbs:null}))},
  });
  assert.equal(projection.dimensionViews?.find(view=>view.dimension==="wbs")?.available,true);
  for(const key of ["zone","level","work_front","cbs"]){
    const dimensionView:any=projection.dimensionViews!.find((candidate:any)=>candidate.dimension===key)!;
    assert.equal(dimensionView.available,false);
    assert.equal(dimensionView.classifiedPopulation,0);
    assert.equal(dimensionView.unclassifiedPopulation,projection.totalActivityCount);
  }
});

test("Progress Breakdown distinguishes controlled baseline presence from usable baseline phasing", () => {
  const unresolved=buildProgressBreakdownProjection(revision2Model(),{
    generatedAt:"2026-09-18T17:00:00.000Z",
    producerVersion:"progress-breakdown-baseline-unphased-v1",
    baselineModel:revision1Model(),
  });
  assert.equal(unresolved.controlledBaselineAvailable,true);
  assert.equal(unresolved.baselinePlanAvailable,false);

  const current=revision2Model(),baseline=revision1Model();
  const workingCalendar:any={
    calendarId:"CAL1",name:"5 Day",semanticComplete:true,
    weeklyWorkMinutes:[0,480,480,480,480,480,0],
    weeklyWorkIntervals:[
      {dayIndex:1,intervals:[]},
      {dayIndex:2,intervals:[{start:"08:00",finish:"16:00",minutes:480}]},
      {dayIndex:3,intervals:[{start:"08:00",finish:"16:00",minutes:480}]},
      {dayIndex:4,intervals:[{start:"08:00",finish:"16:00",minutes:480}]},
      {dayIndex:5,intervals:[{start:"08:00",finish:"16:00",minutes:480}]},
      {dayIndex:6,intervals:[{start:"08:00",finish:"16:00",minutes:480}]},
      {dayIndex:7,intervals:[]}
    ],
    exceptions:[],standardDayHours:8,standardWeekHours:40,sourceRefs:[]
  };
  current.calendars=[workingCalendar];baseline.calendars=[workingCalendar];
  const projection=buildProgressBreakdownProjection(current,{
    generatedAt:"2026-09-18T17:00:00.000Z",
    producerVersion:"progress-breakdown-baseline-v1",
    baselineModel:baseline,
  });
  assert.equal(projection.controlledBaselineAvailable,true);
  assert.equal(projection.baselinePlanAvailable,true);
  assert.ok(projection.hierarchyRows?.some(row=>typeof row.baselinePlannedPercent==="number"));
});

test("Progress S-Curve derives planned curves but never fabricates actual history from one snapshot", () => {
  const input = revision2Model();
  const projection =
    buildProgressScurveProjection(
      input,
      {
        generatedAt:
          "2026-09-18T17:00:00.000Z",
        producerVersion:
          "progress-scurve-v1",
        intervalDays: 2,
      },
    );

  assert.equal(
    projection.weightingMethod,
    "original_duration_hours",
  );
  assert.equal(
    projection.timePhasingMethod,
    "working_calendar_between_activity_dates",
  );
  assert.equal(
    projection.actualHistoryMode,
    "current_snapshot_only",
  );
  assert.equal(
    projection.actualSnapshots.length,
    1,
  );
  assert.equal(
    projection.actualSnapshots[0]!.asOfIso,
    "2026-01-09",
  );

  const beforeSnapshot = projection.points.filter(
    (point) =>
      point.dateIso < "2026-01-09",
  );
  assert.ok(
    beforeSnapshot.every(
      (point) =>
        point.actualProgressPercent === null,
    ),
  );

  assert.ok(
    projection.diagnostics.includes(
      "SCURVE_ACTUAL_HISTORY_NOT_RECONSTRUCTED_FROM_SINGLE_SNAPSHOT",
    ),
  );
});

test("Progress S-Curve uses real supplied history without interpolating fake actual points", () => {
  const projection =
    buildProgressScurveProjection(
      revision2Model(),
      {
        generatedAt:
          "2026-09-18T17:00:00.000Z",
        producerVersion:
          "progress-scurve-v1",
        intervalDays: 1,
        actualHistory: [
          {
            asOfIso: "2026-01-04",
            progressPercent: 20,
            sourceRevisionId: "rev-1",
            sourceRefs: ["rev-1:snapshot"],
          },
          {
            asOfIso: "2026-01-09",
            progressPercent: 50,
            sourceRevisionId: "rev-2",
            sourceRefs: ["rev-2:snapshot"],
          },
        ],
      },
    );

  assert.equal(
    projection.actualHistoryMode,
    "snapshot_history",
  );
  assert.equal(
    projection.actualSnapshots.length,
    2,
  );

  const jan5 = projection.points.find(
    (point) => point.dateIso === "2026-01-05",
  )!;
  assert.equal(
    jan5.actualProgressPercent,
    20,
  );

  const jan9 = projection.points.find(
    (point) => point.dateIso === "2026-01-09",
  )!;
  assert.equal(
    jan9.actualProgressPercent,
    50,
  );
});

test("revision module registry routes Schedule Change, Revision Trend and Variance Trends", () => {
  const items = revisions();

  const change =
    buildImplementedScheduleRevisionProjection(
      "schedule_change_report",
      items,
      {
        generatedAt:
          "2026-09-18T17:00:00.000Z",
        producerVersion: "test",
      },
    ) as any;

  const trend =
    buildImplementedScheduleRevisionProjection(
      "revision_trend",
      items,
      {
        generatedAt:
          "2026-09-18T17:00:00.000Z",
        producerVersion: "test",
      },
    ) as any;

  const variance =
    buildImplementedScheduleRevisionProjection(
      "variance_trends",
      items,
      {
        generatedAt:
          "2026-09-18T17:00:00.000Z",
        producerVersion: "test",
      },
    ) as any;

  assert.equal(
    change.projectionKey,
    "schedule_change_report",
  );
  assert.equal(
    trend.projectionKey,
    "revision_trend",
  );
  assert.equal(
    variance.projectionKey,
    "variance_trends",
  );
});
