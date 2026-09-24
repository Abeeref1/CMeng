import test from "node:test";
import assert from "node:assert/strict";

import {
  buildQuantityScheduleMapping,
} from "../packages/cross-domain-mapping/src";
import {
  buildDeliveryChallengeProjection,
} from "../packages/delivery-challenge/src";
import type {
  ContractTimeBasis,
} from "../packages/eot-assessment/src";
import type {
  IndependentForecastProjection,
} from "../packages/independent-forecast/src";
import type {
  CanonicalQuantityProgressModel,
} from "../packages/quantity-progress-core/src";
import type {
  CanonicalScheduleModel,
} from "../packages/schedule-analysis-core/src";
import type {
  CanonicalResourceModel,
} from "../packages/schedule-resource-core/src";

function schedule():
  CanonicalScheduleModel {
  return {
    projectId: "P1",
    source: "schedule_csv",
    sourceRevisionId: "S1",
    dataDateIso:
      "2026-06-01T00:00:00.000Z",
    activities: [
      {
        projectId: "P1",
        activityId:
          "ACT-CIV-EAST-401",
        nativeId: "401",
        name:
          "East Station Bulk Excavation",
        wbsId:
          "WBS-CIV-EAST",
        calendarId: null,
        activityType: "task",
        status: "in_progress",
        baselineStartIso:
          "2026-05-01T00:00:00.000Z",
        baselineFinishIso:
          "2026-07-01T00:00:00.000Z",
        currentStartIso:
          "2026-05-05T00:00:00.000Z",
        currentFinishIso:
          "2026-08-01T00:00:00.000Z",
        actualStartIso:
          "2026-05-05T00:00:00.000Z",
        actualFinishIso: null,
        forecastStartIso:
          "2026-05-05T00:00:00.000Z",
        forecastFinishIso:
          "2026-08-01T00:00:00.000Z",
        originalDurationHours:
          800,
        remainingDurationHours:
          400,
        totalFloatHours: 0,
        freeFloatHours: 0,
        percentComplete: 50,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        projectId: "P1",
        activityId:
          "ACT-CIV-WEST-402",
        nativeId: "402",
        name:
          "West Station Excavation",
        wbsId:
          "WBS-CIV-WEST",
        calendarId: null,
        activityType: "task",
        status: "not_started",
        baselineStartIso:
          "2026-06-10T00:00:00.000Z",
        baselineFinishIso:
          "2026-08-15T00:00:00.000Z",
        currentStartIso:
          "2026-06-10T00:00:00.000Z",
        currentFinishIso:
          "2026-08-15T00:00:00.000Z",
        actualStartIso: null,
        actualFinishIso: null,
        forecastStartIso:
          "2026-06-10T00:00:00.000Z",
        forecastFinishIso:
          "2026-08-15T00:00:00.000Z",
        originalDurationHours:
          500,
        remainingDurationHours:
          500,
        totalFloatHours: 24,
        freeFloatHours: 8,
        percentComplete: 0,
        sourceRefs: [],
        diagnostics: [],
      },
      {
        projectId: "P1",
        activityId:
          "MS-COMPLETE",
        nativeId: "999",
        name:
          "Contract Completion",
        wbsId: "ROOT",
        calendarId: null,
        activityType:
          "finish_milestone",
        status: "not_started",
        baselineStartIso:
          "2026-09-01T00:00:00.000Z",
        baselineFinishIso:
          "2026-09-01T00:00:00.000Z",
        currentStartIso:
          "2026-09-01T00:00:00.000Z",
        currentFinishIso:
          "2026-09-01T00:00:00.000Z",
        actualStartIso: null,
        actualFinishIso: null,
        forecastStartIso:
          "2026-09-01T00:00:00.000Z",
        forecastFinishIso:
          "2026-09-01T00:00:00.000Z",
        originalDurationHours: 0,
        remainingDurationHours: 0,
        totalFloatHours: 0,
        freeFloatHours: 0,
        percentComplete: 0,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    relationships: [],
    wbs: [
      {
        wbsId: "ROOT",
        parentWbsId: null,
        name: "Project",
        sourceRefs: [],
      },
      {
        wbsId:
          "WBS-CIV-EAST",
        parentWbsId: "ROOT",
        name:
          "Civil East Station",
        sourceRefs: [],
      },
      {
        wbsId:
          "WBS-CIV-WEST",
        parentWbsId: "ROOT",
        name:
          "Civil West Station",
        sourceRefs: [],
      },
    ],
    calendars: [],
    diagnostics: [],
  };
}

function quantities():
  CanonicalQuantityProgressModel {
  return {
    projectId: "P1",
    boqRevisionId: "B1",
    scheduleRevisionId: "S1",
    items: [
      {
        quantityItemId:
          "BOQ-1.100",
        itemNumber: "1.100",
        section:
          "Civil East Station",
        description:
          "Bulk excavation East Station",
        unit: "m3",
        contractQuantity: 1000,
        sourceRefs: [
          {
            source:
              "boq_csv",
            locator:
              "boq.csv:row:2",
          },
        ],
        diagnostics: [],
      },
    ],
    allocations: [],
    installedSnapshots: [
      {
        snapshotId:
          "QTY-2026-06",
        asOfIso:
          "2026-06-01T00:00:00.000Z",
        quantityItemId:
          "BOQ-1.100",
        installedQuantity: 500,
        sourceRefs: [
          {
            source:
              "progress_record",
            locator:
              "progress:row:1",
          },
        ],
      },
    ],
    diagnostics: [],
  };
}

function resources():
  CanonicalResourceModel {
  return {
    projectId: "P1",
    sourceRevisionId: "S1",
    units: [
      {
        unitId: "HOUR",
        name: "Hours",
        abbreviation: "hr",
        sourceRefs: [],
      },
    ],
    financialPeriods: [],
    resources: [
      {
        resourceId: "LAB-01",
        nativeId: "R1",
        shortName:
          "Civil Labour",
        name: "Civil Labour",
        parentResourceId: null,
        resourceType: "labor",
        unitId: "HOUR",
        unitName: "Hours",
        unitAbbreviation: "hr",
        calendarId: null,
        priceTimeUnit: null,
        rates: [],
        sourceRefs: [],
      },
    ],
    assignments: [
      {
        assignmentId:
          "ASG-01",
        projectId: "P1",
        activityId:
          "ACT-CIV-EAST-401",
        nativeTaskId: "401",
        resourceId: "LAB-01",
        roleId: null,
        resourceType: "labor",
        plannedUnits: 800,
        actualRegularUnits: 400,
        actualOvertimeUnits: 0,
        remainingUnits: 400,
        atCompletionUnits: 800,
        plannedUnitsPerHour:
          null,
        remainingUnitsPerHour:
          null,
        plannedStartIso:
          "2026-05-05T00:00:00.000Z",
        plannedFinishIso:
          "2026-08-01T00:00:00.000Z",
        actualStartIso:
          "2026-05-05T00:00:00.000Z",
        actualFinishIso: null,
        remainingStartIso:
          "2026-06-01T00:00:00.000Z",
        remainingFinishIso:
          "2026-08-01T00:00:00.000Z",
        curveId: null,
        sourceRefs: [],
        diagnostics: [],
      },
    ],
    periodActuals: [],
    diagnostics: [],
  };
}

function forecast():
  IndependentForecastProjection {
  return {
    schemaVersion: "1.0",
    projectionKey:
      "independent_forecast",
    generatedAt:
      "2026-06-01T00:00:00.000Z",
    producerVersion: "test",
    projectId: "P1",
    sourceRevisionId: "S1",
    dataDateIso:
      "2026-06-01T00:00:00.000Z",
    origin:
      "deterministic_source_calendar",
    durationBasis: "remaining",
    calculationMode:
      "calendar_working_time",
    sourceForecastCompletionIso:
      "2026-08-01T00:00:00.000Z",
    independentForecastCompletionIso:
      "2026-08-15T00:00:00.000Z",
    forecastVarianceDays: 14,
    requiredFinishIso:
      "2026-09-01T00:00:00.000Z",
    requiredFinishVarianceDays:
      -17,
    calculatedActivityCount: 3,
    unresolvedActivityCount: 0,
    activityCoveragePercent: 100,
    criticalActivityIds: [
      "ACT-CIV-EAST-401",
    ],
    assumptions: [],
    diagnostics: [],
    probabilistic: {
      status: "unavailable",
      method:
        "limited_triangular_duration_factor",
      authority: "non_official",
      iterations: 2000,
      seed: 1,
      minFactor: 0.9,
      modeFactor: 1,
      maxFactor: 1.25,
      p50CompletionIso: null,
      p80CompletionIso: null,
      p90CompletionIso: null,
      assumptions: [],
    },
    activities: [],
    complete: true,
  };
}

const contractTime:
  ContractTimeBasis = {
  contractualCompletionIso:
    "2026-09-01T00:00:00.000Z",
  contractualCompletionState:
    "official",
  officialApprovedEotDays: 0,
  officialApprovedEotState:
    "official",
  eotDayBasis:
    "calendar_days",
  eotDayBasisState: "official",
  sourceRefs: [
    "contract:8.2",
  ],
};

test("BOQ activity mapping can infer a strong link when IDs do not match", () => {
  const result =
    buildQuantityScheduleMapping(
      quantities(),
      schedule(),
    );

  assert.equal(
    result.governedLinkCount,
    0,
  );
  assert.ok(
    result.scenarioLinkCount >=
      1,
  );
  const selected =
    result.selectedScenarioLinks.find(
      (row) =>
        row.quantityItemId ===
        "BOQ-1.100",
    );
  assert.ok(selected);
  assert.equal(
    selected.activityId,
    "ACT-CIV-EAST-401",
  );
  assert.ok(
    selected.confidence >= 0.7,
  );
  assert.equal(
    selected.authority,
    "candidate_scenario",
  );
  assert.ok(
    selected.signals.some(
      (signal) =>
        signal.key ===
          "description" ||
        signal.key ===
          "section",
    ),
  );
});
test('indexed quantity mapping retains explicit IDs, containment and combined section/code candidates',()=>{
 const s=schedule(),q=quantities();const first=s.activities[0]!;
 s.activities=[{...first,activityId:'X-81',name:'Unrelated',wbsId:'81'},
  {...first,activityId:'TARGET',name:'installation',wbsId:'81'},
  {...first,activityId:'DIRECT',name:'Other',wbsId:null}];
 s.wbs=[{wbsId:'81',name:'Concrete',parentWbsId:null,sourceRefs:[]}];
 const item=q.items[0]!;
 q.items=[{...item,quantityItemId:'EXPLICIT',description:'Specified DIRECT',section:null,itemNumber:null},
  {...item,quantityItemId:'COMBINED',description:'Unconnected',section:'Concrete 81',itemNumber:'X-81'},
  {...item,quantityItemId:'CONTAINS',description:'installation work',section:'Concrete 81',itemNumber:null}];
 const result=buildQuantityScheduleMapping(q,s);
 assert.ok(result.candidates.some(c=>c.quantityItemId==='EXPLICIT'&&c.activityId==='DIRECT'&&c.confidence===0.99));
 assert.ok(result.candidates.some(c=>c.quantityItemId==='COMBINED'&&c.activityId==='X-81'));
 assert.ok(result.candidates.some(c=>c.quantityItemId==='CONTAINS'&&c.activityId==='TARGET'));
});

test("delivery challenge uses inferred quantity mapping for productivity without promoting it to official", () => {
  const result =
    buildDeliveryChallengeProjection({
      generatedAt:
        "2026-06-01T00:00:00.000Z",
      producerVersion: "test",
      schedule: schedule(),
      quantities:
        quantities(),
      resources:
        resources(),
      independentForecast:
        forecast(),
      contractTimeBasis:
        contractTime,
      submittedManpowerPlan:
        null,
    });

  assert.equal(
    result.mapping
      ?.governedLinkCount,
    0,
  );
  assert.ok(
    (
      result.mapping
        ?.scenarioLinkCount ??
      0
    ) >= 1,
  );
  assert.equal(
    result.productivityChallenge
      .productivityEvidenceState,
    "measured",
  );
  assert.equal(
    result.productivityChallenge
      .byUnit[0]
      ?.actualMeasuredQuantityPerLaborHour,
    1.25,
  );
  assert.equal(
    result.productivityChallenge
      .byUnit[0]
      ?.requiredQuantityPerLaborHour,
    1.25,
  );
  assert.deepEqual(
    result.manpowerChallenge
      .scheduleDerivedScenarios.map(
        (row) => row.crewSize,
      ),
    [],
  );
  assert.equal(
    result.authority,
    "analytical_challenge_not_replacement_programme",
  );
  assert.match(
    result.disclaimer,
    /does not create a replacement programme/i,
  );
});

test('an assumption-qualified independent finish remains a scenario and assigns calculation reconciliation to CMeng',()=>{
 const f=forecast();f.origin='scenario_with_assumptions';f.assumptions=['SOURCE_CONSTRAINTS_RETAINED_NOT_APPLIED_TO_UNCONSTRAINED_NETWORK:1'];
 const result=buildDeliveryChallengeProjection({generatedAt:'2031-04-01T00:00:00Z',producerVersion:'test',schedule:schedule(),quantities:null,resources:null,independentForecast:f,contractTimeBasis:contractTime,submittedManpowerPlan:null});
 const programme=result.findings.find(x=>x.topic==='programme')!;
 assert.equal(programme.state,'scenario');assert.equal(programme.independent.authority,'scenario');
 assert.match(programme.requiredResponse!,/^CMeng must reconcile/);assert.equal(result.position,'scenario_only');
});

test("submitted manpower is compared with independently required manpower when available", () => {
  const result =
    buildDeliveryChallengeProjection({
      generatedAt:
        "2026-06-01T00:00:00.000Z",
      producerVersion: "test",
      schedule: schedule(),
      quantities:
        quantities(),
      resources:
        resources(),
      independentForecast:
        forecast(),
      contractTimeBasis:
        contractTime,
      submittedManpowerPlan: {
        planId: "MP1",
        periods: [
          {
            periodId: "JUN",
            startIso:
              "2026-06-01T00:00:00.000Z",
            endIso:
              "2026-07-01T00:00:00.000Z",
            plannedManpower: 1,
            trade: null,
            workFront: null,
            sourceRefs: [
              "mp:1",
            ],
          },
          {
            periodId: "JUL",
            startIso:
              "2026-07-01T00:00:00.000Z",
            endIso:
              "2026-08-01T00:00:00.000Z",
            plannedManpower: 1,
            trade: null,
            workFront: null,
            sourceRefs: [
              "mp:2",
            ],
          },
        ],
        sourceRefs: [
          "mp",
        ],
        diagnostics: [],
      },
    });

  assert.equal(
    result.manpowerChallenge
      .submittedPlanAvailable,
    true,
  );
  assert.equal(
    result.manpowerChallenge
      .submittedAverageManpower,
    1,
  );
  assert.ok(
    result.manpowerChallenge
      .requiredAverageManpowerToContract !==
      null,
  );
  assert.ok(
    result.findings.some(
      (row) =>
        row.topic ===
        "manpower",
    ),
  );
});


test("non-hour labor UOM is not silently converted into manpower hours", () => {
  const r =
    resources();
  r.resources[0]!.unitName =
    "Persons";
  r.resources[0]!.unitAbbreviation =
    "person";

  const result =
    buildDeliveryChallengeProjection({
      generatedAt:
        "2026-06-01T00:00:00.000Z",
      producerVersion: "test",
      schedule: schedule(),
      quantities:
        quantities(),
      resources: r,
      independentForecast:
        forecast(),
      contractTimeBasis:
        contractTime,
      submittedManpowerPlan:
        null,
    });

  assert.equal(
    result.manpowerChallenge
      .evidenceRemainingLaborHours,
    null,
  );
  assert.equal(
    result.manpowerChallenge
      .requiredAverageManpowerToContract,
    null,
  );
  assert.ok(
    result.diagnostics.some(
      (code) =>
        code.startsWith(
          "LABOR_UNIT_NOT_HOURS_NOT_USED_FOR_MANPOWER_CALCULATION",
        ),
    ),
  );
  assert.deepEqual(
    result.manpowerChallenge
      .scheduleDerivedScenarios
      .map((row) => row.crewSize),
    [],
  );
});
