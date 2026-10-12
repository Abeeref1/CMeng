import test from 'node:test';
import assert from 'node:assert/strict';
import {applyUniversalModuleChallenges} from '../packages/runtime-api/src/module-challenges';
import {comparisonRequirement} from '../packages/runtime-api/src/comparison-requirement';
import {assessModuleIssues} from '../packages/runtime-api/src/module-issues';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import type {ModuleRuntimeResult} from '../packages/runtime-api/src/project-state-types';

test('independent near-critical comparison excludes completed work with no live float',()=>{
 const state=loadCertifiedDemoProject('NEAR-CRITICAL-COMPLETED');
 const source=state.schedules.at(-1)!.revision.model;
 const model={...source,activities:source.activities.filter(a=>a.activityType==='task').slice(0,2).map((a,i)=>({...a,status:i?'completed' as const:'not_started' as const}))};
 assert.equal(model.activities.length,2);
 const result:ModuleRuntimeResult={key:'near-critical',status:'partial',reason:null,dependencies:[],data:{nearCriticalCount:1}};
 const modules=new Map([[result.key,result]]);
 applyUniversalModuleChallenges({state,modules,model,generatedAt:'2034-02-15T00:00:00.000Z',independentForecast:{complete:true,activities:model.activities.map((a,i)=>({activityId:a.activityId,independentTotalFloatHours:i?null:8}))} as any,
  deliveryChallenge:{manpowerChallenge:{requiredAverageManpowerToContract:null,submittedAverageManpower:null,submittedPeakManpower:null,scheduleDerivedScenarios:[]}} as any});
 const item=(modules.get(result.key)!.data as any).challenge.items.find((r:any)=>r.metric==='near_critical_count');
 assert.equal(item.independent.value,1);assert.notEqual(item.reconciliationState,'independent_unavailable');
});

test('Stage 1 weekly resource comparison uses ratios through Data Date while retaining the separate headcount challenge',()=>{
  const state=loadCertifiedDemoProject('RESOURCE-BASIS-REGRESSION');
  const result:ModuleRuntimeResult={key:'resource-utilization',status:'ready',reason:null,dependencies:['weekly capacity','approved usage'],data:{
    projectionKey:'resource_utilization',weeklyCapacityEvidence:{
      dataDateIso:'2034-02-15',capacityCoveragePercent:100,actualPeriodCoveragePercent:100,
      points:[
        {resourceId:'LABOUR',weekStartIso:'2034-02-01',availableCapacity:100,plannedDemand:80,actualApprovedUsage:60,receipts:[]},
        {resourceId:'EQUIPMENT',weekStartIso:'2034-02-08',availableCapacity:200,plannedDemand:200,actualApprovedUsage:180,receipts:[]},
        {resourceId:'FUTURE',weekStartIso:'2034-02-16',availableCapacity:100,plannedDemand:999,actualApprovedUsage:999,receipts:[]},
        {resourceId:'ZERO-CAPACITY',weekStartIso:'2034-02-08',availableCapacity:0,plannedDemand:100,actualApprovedUsage:100,receipts:[]},
        {resourceId:'MISSING',weekStartIso:'2034-02-08',availableCapacity:100,plannedDemand:null,actualApprovedUsage:null,receipts:[]},
      ],
    },
  }};
  const modules=new Map([[result.key,result]]);
  applyUniversalModuleChallenges({state,modules,generatedAt:'2034-02-15T00:00:00.000Z',
    model:state.schedules.at(-1)!.revision.model,independentForecast:{} as any,
    deliveryChallenge:{manpowerChallenge:{requiredAverageManpowerToContract:null,submittedAverageManpower:null,submittedPeakManpower:null,scheduleDerivedScenarios:[]}} as any,
  });
  const data=modules.get(result.key)!.data as any;
  assert.equal(data.challenge.items.find((row:any)=>row.metric==='weekly_planned_utilization_percent').independent.value,90);
  assert.equal(data.challenge.items.find((row:any)=>row.metric==='weekly_actual_utilization_percent').independent.value,75);
  assert.ok(data.manpowerRequirementComparison.items.some((row:any)=>row.metric==='manpower_average'));
  assert.ok(data.manpowerRequirementComparison.items.some((row:any)=>row.metric==='manpower_peak'));
  assert.equal(comparisonRequirement(data,result.key).required,false);
  assert.equal(comparisonRequirement({projectionKey:'resource_utilization_scenario',challenge:data.manpowerRequirementComparison},result.key).required,true);
  assert.equal(comparisonRequirement({...data,weeklyCapacityEvidence:{points:[]}},result.key).required,true,'an empty source shell cannot qualify as an established source view');
  const assessment=assessModuleIssues(modules.get(result.key)!,{state:'pass',failedCheckIds:[],checkCount:1});
  assert.ok(!assessment.issues.some(issue=>issue.evidencePaths.some(path=>path.includes('manpowerRequirementComparison'))),
    'headcount evidence remains a separate comparison instead of blocking the established hours basis');
});
