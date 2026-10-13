import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWindowsAnalysisProjection,
} from "../packages/windows-analysis/src";
import type {
  ScheduleRevision,
} from "../packages/schedule-revision-core/src";
import {compareScheduleRevisions} from "../packages/schedule-revision-core/src";
import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";

function activity(
  id: string,
  finishIso: string,
): CanonicalScheduleActivity {
  return {
    projectId: "WINDOWS",
    activityId: id,
    nativeId: id,
    name: id,
    wbsId: "W1",
    calendarId: null,
    activityType: "task",
    status: "not_started",
    baselineStartIso: null,
    baselineFinishIso: null,
    currentStartIso: null,
    currentFinishIso: finishIso,
    actualStartIso: null,
    actualFinishIso: null,
    forecastStartIso: null,
    forecastFinishIso: finishIso,
    originalDurationHours: 8,
    remainingDurationHours: 8,
    totalFloatHours: 40,
    freeFloatHours: null,
    percentComplete: 0,
    sourceRefs: [],
    diagnostics: [],
  };
}

function revision(
  revisionId: string,
  sequence: number,
  dataDateIso: string,
  activities: CanonicalScheduleActivity[],
): ScheduleRevision {
  const model: CanonicalScheduleModel = {
    projectId: "WINDOWS",
    source: "xer",
    sourceRevisionId: revisionId,
    dataDateIso,
    activities,
    relationships: [],
    wbs: [],
    calendars: [],
    diagnostics: [],
  };
  return {
    revisionId,
    label: revisionId,
    sequence,
    effectiveAt: dataDateIso,
    model,
  };
}

const revisions: ScheduleRevision[] = [
  revision(
    "S01",
    1,
    "2026-01-01",
    [
      activity("A", "2027-01-01T00:00:00Z"),
      activity("B", "2027-03-01T00:00:00Z"),
    ],
  ),
  revision(
    "S02",
    2,
    "2026-04-01",
    [
      activity("A", "2027-05-23T22:04:48Z"),
      activity("B", "2027-03-01T00:00:00Z"),
    ],
  ),
  revision(
    "S03",
    3,
    "2026-08-31",
    [
      activity("A", "2027-05-23T22:04:48Z"),
      activity("B", "2027-04-30T06:00:00Z"),
    ],
  ),
];

const sourceForecasts = new Map([
  ["S01", "2029-12-31T00:00:00Z"],
  ["S02", "2030-04-30T00:00:00Z"],
  ["S03", "2030-06-30T00:00:00Z"],
]);

const independentForecasts = new Map([
  ["S01", "2029-12-31T00:00:00Z"],
  ["S02", "2030-05-22T22:04:48Z"],
  ["S03", "2030-07-22T04:04:48Z"],
]);

test("windows keep strongest activity movement separate from net project completion movement", () => {
  const projection =
    buildWindowsAnalysisProjection(
      revisions,
      {
        projectId: "WINDOWS",
        evidenceRevisionId: "test",
        events: [],
        claims: [],
        notices: [],
        noticeRequirements: [],
        diagnostics: [],
      } as any,
      {
        generatedAt:
          "2026-09-21T00:00:00.000Z",
        producerVersion:
          "window-gross-test",
        forecastResolver:
          (item) =>
            ({
              sourceForecastCompletionIso:
                sourceForecasts.get(
                  item.revisionId,
                ) ?? null,
              independentForecastCompletionIso:
                independentForecasts.get(
                  item.revisionId,
                ) ?? null,
              criticalActivityIds: [],
              assumptions: [],
              complete: false,
            }) as any,
      },
    );

  assert.equal(projection.windowCount, 2);
  assert.equal(
    projection.windows[0]!
      .strongestProgrammeMovementBasis,
    "independent_cpm",
  );
  assert.equal(
    projection.windows[0]!
      .strongestPositiveActivityMovementDays,
    142.92,
  );
  assert.equal(
    projection.windows[0]!
      .strongestPositiveActivityId,
    "A",
  );
  assert.equal(
    projection.windows[1]!
      .strongestPositiveActivityMovementDays,
    60.25,
  );
  assert.equal(
    projection.windows[1]!
      .strongestPositiveActivityId,
    "B",
  );
  assert.equal(
    projection.windows[0]!
      .netCompletionMovementDays,
    120,
  );
  assert.equal(
    projection.windows[0]!
      .grossAnalyticalMovementDays,
    142.92,
  );
  assert.equal(
    projection.windows[0]!
      .analyticalVsNetDeltaDays,
    22.92,
  );
  assert.equal(
    projection.windows[0]!
      .overlapCandidateDays,
    22.92,
  );
  assert.equal(
    projection.windows[1]!
      .netCompletionMovementDays,
    61,
  );
  assert.equal(
    projection.windows[1]!
      .grossAnalyticalMovementDays,
    60.25,
  );
  assert.equal(
    projection.windows[1]!
      .analyticalVsNetDeltaDays,
    -0.75,
  );
  assert.equal(
    projection.windows[1]!
      .overlapCandidateDays,
    0,
  );
  assert.equal(
    projection.grossAnalyticalMovementDays,
    203.17,
  );
  assert.equal(
    projection.analyticalVsNetDeltaDays,
    22.17,
  );
  assert.equal(
    projection.overlapCandidateDays,
    22.17,
  );
  assert.equal(
    projection.positiveProgrammeMovementDays,
    181,
  );
  assert.equal(
    projection.projectCompletionMovementDays,
    181,
  );
  assert.equal(
    projection.projectCompletionMovementBasis,
    "source_forecast",
  );
  assert.equal(
    projection.negativeProgrammeMovementDays,
    0,
  );
  assert.equal(
    projection.windows[0]!
      .activityFinishShiftCoveragePercent,
    100,
  );
});

test("windows preserve strongest recovery separately from positive movement", () => {
  const recoveryRevisions = [
    revision(
      "R1",
      1,
      "2026-01-01",
      [
        activity(
          "A",
          "2027-06-01T00:00:00Z",
        ),
      ],
    ),
    revision(
      "R2",
      2,
      "2026-02-01",
      [
        activity(
          "A",
          "2027-05-22T00:00:00Z",
        ),
      ],
    ),
  ];

  const projection =
    buildWindowsAnalysisProjection(
      recoveryRevisions,
      {
        projectId: "WINDOWS",
        evidenceRevisionId: "test",
        events: [],
        claims: [],
        notices: [],
        noticeRequirements: [],
        diagnostics: [],
      } as any,
      {
        generatedAt:
          "2026-09-21T00:00:00.000Z",
        producerVersion:
          "window-recovery-test",
        forecastResolver:
          () =>
            ({
              sourceForecastCompletionIso:
                null,
              independentForecastCompletionIso:
                null,
              criticalActivityIds: [],
              assumptions: [],
              complete: false,
            }) as any,
      },
    );

  assert.equal(
    projection.positiveProgrammeMovementDays,
    0,
  );
  assert.equal(
    projection.negativeProgrammeMovementDays,
    -10,
  );
  assert.equal(
    projection.windows[0]!
      .strongestNegativeActivityMovementDays,
    -10,
  );
});

test('shared revision comparisons preserve complete windows and never match different source objects', () => {
  const source=structuredClone(revisions);
  const delay={projectId:'WINDOWS',evidenceRevisionId:'comparison-parity',events:[],claims:[],notices:[],noticeRequirements:[],diagnostics:[]};
  const input={generatedAt:'2026-09-21T00:00:00Z',producerVersion:'comparison-parity'};
  const comparisons=new Map(source.slice(1).map((to,i)=>[source[i]!,new Map([[to,compareScheduleRevisions(source[i]!,to)]]) ]));
  const retained=JSON.stringify([...comparisons.values()].map(rows=>[...rows.values()]));
  const fresh=buildWindowsAnalysisProjection(source,delay,input);
  assert.deepEqual(buildWindowsAnalysisProjection(source,delay,{...input,precomputedComparisons:comparisons}),fresh);
  assert.equal(JSON.stringify([...comparisons.values()].map(rows=>[...rows.values()])),retained);
  const changed=structuredClone(source);
  changed[1]!.model.activities[0]!.currentFinishIso='2028-01-01';
  changed[1]!.model.activities[0]!.forecastFinishIso='2028-01-01';
  const changedFresh=buildWindowsAnalysisProjection(changed,delay,input);
  assert.notDeepEqual(changedFresh,fresh);
  assert.deepEqual(buildWindowsAnalysisProjection(changed,delay,{...input,precomputedComparisons:comparisons}),changedFresh);
});

test('window association counts retain the complete events when HTTP paging trims the preview',async()=>{
 const {pageProjectResponse}=await import('../packages/runtime-api/src/response-paging');
 const events=Array.from({length:240},(_,i)=>({eventId:'E'+i,title:'Event '+i,description:'Source event',startIso:'2020-01-01',endIso:'2035-01-01',responsibility:'unknown',category:'other',linkedActivityIds:[],sourceRefs:[],diagnostics:[]}));
 const projection=buildWindowsAnalysisProjection(revisions,{projectId:'WINDOWS',evidenceRevisionId:'events',events,claims:[],notices:[],noticeRequirements:[],diagnostics:[]} as any,{generatedAt:'2026-09-21T00:00:00Z',producerVersion:'population-test'});
 assert.ok(projection.windows.length>1);assert.ok(projection.windows.every(w=>w.delayEventCount===240));
 assert.equal(projection.associatedEventCount,240*projection.windows.length);
 const page=pageProjectResponse({key:'windows-analysis',data:projection},'/api/projects/WINDOWS/schedule/modules/windows-analysis') as any;
 assert.equal(page.data.windows[0].delayEvents.length,25);assert.equal(page.data.windows[0].delayEventCount,240);assert.equal(page.data.associatedEventCount,projection.associatedEventCount);
});
