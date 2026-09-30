import test from "node:test";
import assert from "node:assert/strict";
import {FORECAST_TAXONOMY_LABELS,buildForecastReconciliationGate} from "../packages/runtime-api/src/forecast-control";
import {moduleFeatureAvailability} from "../packages/runtime-api/src/feature-availability";
import {buildDeliveryChallengeProjection} from "../packages/delivery-challenge/src";
import {cmengUatHtml} from "../packages/runtime-api/src/ui";

test("Task 29 exposes exactly the six governed forecast taxonomy labels",()=>{
  assert.deepEqual([...FORECAST_TAXONOMY_LABELS],[
    "Contractual completion",
    "Contractor programme forecast",
    "CMeng CPM/network recalculation",
    "Source productivity forecast",
    "Independent evidence-based forecast",
    "Scenario/recovery forecast",
  ]);
});

test("Task 30 blocks management publication when project finish matches but a material activity divergence remains",()=>{
  const forecast:any={
    independentForecastCompletionIso:"2030-12-31",
    sourceForecastCompletionIso:"2030-12-31",
    activityCoveragePercent:100,
    calculatedActivityCount:2,
    unresolvedActivityCount:0,
    diagnostics:[],
    activities:[
      {activityId:"A1",calendarMode:"source_calendar",status:"calculated",finishVarianceDays:0},
      {activityId:"A2",calendarMode:"source_calendar",status:"calculated",finishVarianceDays:30},
    ],
  };
  const model:any={activities:[
    {activityId:"A1",sourceConstraints:[]},
    {activityId:"A2",sourceConstraints:[]},
  ]};
  const gate=buildForecastReconciliationGate({forecast,model,requiredFinishIso:"2030-12-31",materialActivityScreeningDays:14});
  assert.equal(gate.publishable,false);
  assert.equal(gate.managementForecastCompletionIso,null);
  const divergence=gate.checks.find(row=>row.key==="material_activity_divergence")!;
  assert.equal(divergence.state,"review_required");
  assert.deepEqual(gate.materialActivityIds,["A2"]);
});

test("Task 32 enforces zero one and two-revision completion-history states",()=>{
  const zero=moduleFeatureAvailability("forecast-history",{points:[]});
  const one=moduleFeatureAvailability("forecast-history",{points:[{sourceRevisionId:"R1"}]});
  const two=moduleFeatureAvailability("forecast-history",{points:[{sourceRevisionId:"R1"},{sourceRevisionId:"R2"}]});
  assert.equal(zero.state,"blocked");
  assert.equal(one.state,"evidence_only");
  assert.equal(two.state,"active");
  assert.match(one.reason,/current completion position, not a trend/i);
});

test("Task 33 requires all six Challenge prerequisites before active assessment",()=>{
  const partial=moduleFeatureAvailability("challenge-contract",{
    suppliedBoq:{itemCount:1},
    boqFeasibility:{rows:[{quantityItemId:"Q1",activityId:"A1",remainingQuantity:10,laborHoursPerUnit:null,availableWorkingHours:null,submittedPeople:null}],activityChecks:[]},
  });
  assert.notEqual(partial.state,"active");
  assert.equal(partial.prerequisites?.length,6);
  assert.deepEqual(partial.prerequisites?.filter(row=>!row.established).map(row=>row.key),[
    "productivity","calendar_working_time","resource_basis",
  ]);
  const active=moduleFeatureAvailability("challenge-contract",{
    suppliedBoq:{itemCount:1},
    boqFeasibility:{
      rows:[{quantityItemId:"Q1",activityId:"A1",remainingQuantity:10,laborHoursPerUnit:2,availableWorkingHours:80,submittedPeople:4}],
      activityChecks:[{activityId:"A1",scheduleState:"fits",requiredAveragePeople:2}],
    },
  });
  assert.equal(active.state,"active");
});

test("Task 34 delivery challenge includes quantities manpower productivity duration and sequencing findings",()=>{
  const schedule:any={
    projectId:"E",source:"schedule_xlsx",sourceRevisionId:"R1",dataDateIso:"2030-01-01",
    activities:[{projectId:"E",activityId:"A1",nativeId:"1",name:"Work",wbsId:null,calendarId:null,activityType:"task",status:"not_started",baselineStartIso:"2030-01-01",baselineFinishIso:"2030-01-10",currentStartIso:"2030-01-01",currentFinishIso:"2030-01-10",actualStartIso:null,actualFinishIso:null,forecastStartIso:"2030-01-01",forecastFinishIso:"2030-01-10",originalDurationHours:80,remainingDurationHours:80,totalFloatHours:8,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}],
    relationships:[],wbs:[],calendars:[],diagnostics:[]
  };
  const forecast:any={sourceForecastCompletionIso:"2030-01-10",independentForecastCompletionIso:"2030-01-10",requiredFinishIso:"2030-01-10",origin:"deterministic_source_calendar",assumptions:[]};
  const result=buildDeliveryChallengeProjection({generatedAt:"2030-01-01",producerVersion:"E",schedule,quantities:null,resources:null,independentForecast:forecast,contractTimeBasis:null,submittedManpowerPlan:null});
  const topics=new Set(result.findings.map(row=>row.topic));
  for(const topic of ["quantity","manpower","productivity","programme","workfront"])assert.equal(topics.has(topic as any),true,topic);
});

test("Tasks 31 34 and 35 management UI exposes translated forecast diagnostics, five-column challenge contract and recovery basis distinction",()=>{
  const html=cmengUatHtml();
  assert.match(html,/Management forecast reconciliation gate/);
  assert.match(html,/Submitted assumption/);
  assert.match(html,/Independent requirement/);
  assert.match(html,/Programme consequence/);
  assert.match(html,/Required action/);
  assert.match(html,/No supporting recovery basis is established/);
  assert.match(html,/CPM remaining duration/i);
});
