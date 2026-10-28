import test from "node:test";
import assert from "node:assert/strict";

import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import type {
  ScheduleRevision,
} from "../packages/schedule-revision-core/src";
import type {
  DelayClaimsModel,
} from "../packages/delay-analysis-core/src";
import {
  buildWindowsAnalysisProjection,
} from "../packages/windows-analysis/src";
import {
  buildDelayClaimsProjection,
} from "../packages/delay-claims/src";
import {
  buildEotAssessmentProjection,
  type ContractTimeBasis,
} from "../packages/eot-assessment/src";

function activity(
  id: string,
  finishIso: string,
): CanonicalScheduleActivity {
  return {
    projectId: "P-MOVE",
    activityId: id,
    nativeId: id,
    name: id,
    wbsId: null,
    calendarId: null,
    activityType: "task",
    status: "in_progress",
    baselineStartIso:
      "2026-01-01T00:00:00.000Z",
    baselineFinishIso:
      finishIso,
    currentStartIso:
      "2026-01-01T00:00:00.000Z",
    currentFinishIso:
      finishIso,
    actualStartIso:
      "2026-01-01T00:00:00.000Z",
    actualFinishIso: null,
    forecastStartIso:
      "2026-01-01T00:00:00.000Z",
    forecastFinishIso:
      finishIso,
    originalDurationHours: 100,
    remainingDurationHours: 50,
    totalFloatHours: 0,
    freeFloatHours: 0,
    percentComplete: 50,
    sourceRefs: [],
    diagnostics: [],
  };
}

function model(
  revisionId: string,
  dataDateIso: string,
  finishIso: string,
): CanonicalScheduleModel {
  return {
    projectId: "P-MOVE",
    source: "schedule_csv",
    sourceRevisionId: revisionId,
    dataDateIso,
    activities: [
      activity("A100", finishIso),
      activity("A200", finishIso),
    ],
    relationships: [
      {
        relationshipId:
          revisionId + "-R1",
        predecessorActivityId:
          "A100",
        successorActivityId:
          "A200",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        relationshipId:
          revisionId + "-R2",
        predecessorActivityId:
          "A200",
        successorActivityId:
          "A100",
        type: "FS",
        lagHours: 0,
        external: false,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    wbs: [],
    calendars: [],
    diagnostics: [],
  };
}

function revision(
  id: string,
  sequence: number,
  dataDateIso: string,
  finishIso: string,
): ScheduleRevision {
  return {
    revisionId: id,
    label: id,
    sequence,
    effectiveAt:
      dataDateIso,
    model: model(
      id,
      dataDateIso,
      finishIso,
    ),
  };
}

const emptyDelay:
  DelayClaimsModel = {
  projectId: "P-MOVE",
  evidenceRevisionId: "D1",
  events: [],
  notices: [],
  claims: [],
  noticeRequirements: [],
  diagnostics: [],
};

test('Delay and EOT retain completion movement when individual activities shift farther',()=>{
 const events:DelayClaimsModel={...emptyDelay,events:[{eventId:'E1',title:'Reported event',category:'other',startIso:'2031-01-01',endIso:'2031-03-01',responsibility:'unknown',responsibilityState:'missing',describedImpactDays:null,describedImpactState:'missing',relatedActivityIds:[],relatedClauseIdentifiers:[],evidenceRefs:[],diagnostics:[]}]};
 const windows=buildWindowsAnalysisProjection([
  revision('R1',1,'2031-01-01','2031-08-01'),revision('R2',2,'2031-02-01','2031-08-05'),revision('R3',3,'2031-03-01','2031-08-06')],events,{generatedAt:'2031-03-01',producerVersion:'test'});
 windows.windows.forEach((w,i)=>{w.strongestProgrammeMovementDays=[9,16][i]!;w.strongestProgrammeMovementBasis='matched_activity_finish_shift';});
 const before=JSON.stringify(windows),delay=buildDelayClaimsProjection(windows,events,{generatedAt:'2031-03-01',producerVersion:'test'});
 const eot=buildEotAssessmentProjection(windows,delay,contractTime,{generatedAt:'2031-03-01',producerVersion:'test'});
 assert.equal(delay.events[0]!.observedNetProgrammeMovementDays,5);assert.equal(delay.events[0]!.observedPositiveProgrammeMovementDays,5);assert.equal(delay.events[0]!.programmeMovementBasis,'source_forecast');
 assert.equal(delay.observedPositiveProgrammeMovementDays,5);assert.equal(delay.unattributedProgrammeMovementDays,5);
 assert.deepEqual(eot.windowCandidates.map(w=>w.positiveProgrammeMovementDays),[4,1]);assert.deepEqual(eot.windowCandidates.map(w=>w.programmeMovementBasis),['source_forecast','source_forecast']);
 assert.equal(eot.candidateAdditionalEotDays,null);assert.equal(JSON.stringify(windows),before,'original activity-shift evidence remains intact');
 windows.windows[0]!.netCompletionMovementDays=null;windows.windows[0]!.netCompletionMovementBasis='unavailable';
 const unknownDelay=buildDelayClaimsProjection(windows,events,{generatedAt:'2031-03-01',producerVersion:'test'});
 const unknownEot=buildEotAssessmentProjection(windows,unknownDelay,contractTime,{generatedAt:'2031-03-01',producerVersion:'test'});
 assert.equal(unknownDelay.events[0]!.observedPositiveProgrammeMovementDays,null);
 assert.equal(unknownDelay.unattributedProgrammeMovementDays,null);assert.equal(unknownEot.windowCandidates[0]!.positiveProgrammeMovementDays,null);
});

const contractTime:
  ContractTimeBasis = {
  contractualCompletionIso:
    "2026-09-01T00:00:00.000Z",
  contractualCompletionState:
    "official",
  officialApprovedEotDays:
    null,
  officialApprovedEotState:
    "missing",
  eotDayBasis:
    "calendar_days",
  eotDayBasisState:
    "official",
  sourceRefs: [
    "contract:completion",
  ],
};

test("programme movement survives CPM failure but is not promoted to EOT time impact without a causal event", () => {
  const windows =
    buildWindowsAnalysisProjection(
      [
        revision(
          "S1",
          1,
          "2026-06-01T00:00:00.000Z",
          "2026-08-01T00:00:00.000Z",
        ),
        revision(
          "S2",
          2,
          "2026-07-01T00:00:00.000Z",
          "2026-08-15T00:00:00.000Z",
        ),
      ],
      emptyDelay,
      {
        generatedAt:
          "2026-09-19T00:00:00.000Z",
        producerVersion: "test",
      },
    );

  assert.equal(
    windows.windowCount,
    1,
  );
  assert.equal(
    windows.windows[0]
      ?.independentForecastMovementDays,
    null,
  );
  assert.equal(
    windows.windows[0]
      ?.sourceForecastMovementDays,
    14,
  );
  assert.equal(
    windows.windows[0]
      ?.strongestProgrammeMovementDays,
    14,
  );
  assert.equal(
    windows.windows[0]
      ?.strongestProgrammeMovementBasis,
    "source_forecast",
  );
  assert.equal(
    windows.positiveProgrammeMovementDays,
    14,
  );

  const delay =
    buildDelayClaimsProjection(
      windows,
      emptyDelay,
      {
        generatedAt:
          "2026-09-19T00:00:00.000Z",
        producerVersion: "test",
      },
    );

  assert.equal(
    delay.observedPositiveIndependentMovementDays,
    null,
  );
  assert.equal(
    delay.observedPositiveProgrammeMovementDays,
    14,
  );
  assert.equal(
    delay.unattributedProgrammeMovementDays,
    14,
  );

  const eot =
    buildEotAssessmentProjection(
      windows,
      delay,
      contractTime,
      {
        generatedAt:
          "2026-09-19T00:00:00.000Z",
        producerVersion: "test",
      },
    );

  assert.equal(
    eot.observedProgrammeMovementDays,
    14,
  );
  assert.equal(
    eot.analyticalTimeImpactCandidateDays,
    null,
  );
  assert.equal(
    eot.attributableCandidateEotDays,
    null,
  );
  assert.equal(
    eot.unattributedTimeImpactDays,
    14,
  );
  assert.equal(
    eot.candidateAdditionalEotDays,
    null,
  );
  assert.equal(
    eot.timeImpactScenarioAdjustedCompletionIso,
    null,
  );
  assert.equal(
    eot.scenarioAdjustedCompletionIso,
    null,
  );
  assert.ok(
    eot.diagnostics.includes(
      "PROGRAMME_MOVEMENT_OBSERVED_WITHOUT_CAUSAL_TIME_IMPACT_CANDIDATE",
    ),
  );
  assert.equal(
    eot.windowCandidates[0]
      ?.state,
    "review",
  );
});

test("programme movement remains separate from entitlement when an eligible event is absent", () => {
  const windows =
    buildWindowsAnalysisProjection(
      [
        revision(
          "S1B",
          1,
          "2026-06-01T00:00:00.000Z",
          "2026-08-01T00:00:00.000Z",
        ),
        revision(
          "S2B",
          2,
          "2026-07-01T00:00:00.000Z",
          "2026-08-20T00:00:00.000Z",
        ),
      ],
      emptyDelay,
      {
        generatedAt:
          "2026-09-19T00:00:00.000Z",
        producerVersion: "test",
      },
    );

  const delay =
    buildDelayClaimsProjection(
      windows,
      emptyDelay,
      {
        generatedAt:
          "2026-09-19T00:00:00.000Z",
        producerVersion: "test",
      },
    );

  const eot =
    buildEotAssessmentProjection(
      windows,
      delay,
      contractTime,
      {
        generatedAt:
          "2026-09-19T00:00:00.000Z",
        producerVersion: "test",
      },
    );

  assert.equal(
    eot.analyticalTimeImpactCandidateDays,
    null,
  );
  assert.equal(
    eot.attributableCandidateEotDays,
    null,
  );
  assert.equal(
    eot.unattributedTimeImpactDays,
    19,
  );
  assert.ok(
    eot.windowCandidates[0]
      ?.reasons.includes(
        "NO_ELIGIBLE_EMPLOYER_OR_NEUTRAL_EVENT",
      ),
  );
});

test("gross positive window movement never replaces net Project Completion movement", () => {
  const windows =
    buildWindowsAnalysisProjection(
      [
        revision("S1C",1,"2026-06-01T00:00:00.000Z","2026-08-01T00:00:00.000Z"),
        revision("S2C",2,"2026-07-01T00:00:00.000Z","2026-08-20T00:00:00.000Z"),
        revision("S3C",3,"2026-08-01T00:00:00.000Z","2026-08-15T00:00:00.000Z"),
      ],
      emptyDelay,
      {
        generatedAt: "2026-09-20T00:00:00.000Z",
        producerVersion: "window-semantics-test",
      },
    );
  assert.equal(windows.positiveProgrammeMovementDays,19);
  assert.equal(windows.negativeProgrammeMovementDays,-5);
  assert.equal(windows.projectCompletionMovementDays,14);
  assert.equal(windows.projectCompletionMovementBasis,"source_forecast");
  const delay=buildDelayClaimsProjection(windows,emptyDelay,{generatedAt:"2026-09-20T00:00:00.000Z",producerVersion:"delay-test"});
  assert.equal(delay.observedPositiveProgrammeMovementDays,19);
  assert.equal(delay.projectCompletionMovementDays,14);
  const eot=buildEotAssessmentProjection(windows,delay,contractTime,{generatedAt:"2026-09-20T00:00:00.000Z",producerVersion:"eot-test"});
  assert.equal(eot.observedProgrammeMovementDays,19);
  assert.equal(eot.projectCompletionMovementDays,14);
});

test('unreconciled calendar scenarios cannot become EOT time-impact days',()=>{
 const windows=buildWindowsAnalysisProjection([
  revision('A',1,'2031-01-01','2031-05-01'),revision('B',2,'2031-02-01','2031-05-20')],emptyDelay,{generatedAt:'2031-02-01',producerVersion:'test'});
 windows.windows[0]!.independentReconciliationRequired=true;
 windows.windows[0]!.independentForecastMovementDays=400;
 windows.windows[0]!.strongestProgrammeMovementDays=400;
 const delay=buildDelayClaimsProjection(windows,emptyDelay,{generatedAt:'2031-02-01',producerVersion:'test'});
 const eot=buildEotAssessmentProjection(windows,delay,contractTime,{generatedAt:'2031-02-01',producerVersion:'test'});
 const row=eot.windowCandidates[0]!;assert.equal(row.analyticalTimeImpactCandidateDays,null);assert.equal(row.includedCandidateDays,0);
 assert.equal(row.positiveProgrammeMovementDays,19);assert.equal(row.positiveIndependentMovementDays,400);
 // P0-B (C12): the calendar question about CMeng's own recalculation is stated
 // with the window, not a hold. Candidate days only ever come from the submitted
 // programme movement; here no causal event exists, so none are included.
 assert.ok(row.reasons.includes('NO_ELIGIBLE_EMPLOYER_OR_NEUTRAL_EVENT'));
 assert.ok(row.assumptions.includes('SEPARATE_CALENDAR_MODEL_MOVEMENT_REQUIRES_RECONCILIATION'));
 assert.ok(!row.reasons.includes('CALENDAR_LOGIC_RECALCULATION_REQUIRES_RECONCILIATION_NOT_DELAY'));
});
