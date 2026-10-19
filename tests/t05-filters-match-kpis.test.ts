import test from 'node:test';
import assert from 'node:assert/strict';
import {activityAnalyticsCounts} from '../packages/activity-analytics/src/projector';
import {activityDelayStatus} from '../packages/activity-analytics/src/exceptions';
import {activityRegisterPage} from '../packages/runtime-api/src/activity-register-page';
import {preparedModuleResult} from '../packages/runtime-api/src/module-report';

// SW-26 / N12: a filter labelled like a KPI counts the same population as that KPI,
// on the screen register and in the filtered report. Completed work stays reachable
// through its own Status choice.
function rows(){
  const out:any[]=[];
  for(let i=0;i<60;i++)out.push({activityId:'C'+i,activityType:'task',status:'completed',criticality:'critical',
    totalFloatHours:i%2?-8:0,floatRiskWatchlist:true,finishVarianceDays:5,missedPlannedStart:false,finishOverdue:false});
  for(let i=0;i<90;i++){
    const kind=i%3,row:any={activityId:'R'+i,activityType:'task',status:i%2?'in_progress':'not_started'};
    if(kind===0)Object.assign(row,{criticality:'critical',totalFloatHours:i%2?0:-16,floatRiskWatchlist:true,finishVarianceDays:3,missedPlannedStart:false,finishOverdue:false});
    if(kind===1)Object.assign(row,{criticality:'near_critical',totalFloatHours:8,floatRiskWatchlist:true,finishVarianceDays:0,missedPlannedStart:false,finishOverdue:true});
    if(kind===2)Object.assign(row,{criticality:'noncritical',totalFloatHours:400,floatRiskWatchlist:false,finishVarianceDays:-2,missedPlannedStart:true,finishOverdue:false});
    out.push(row);
  }
  out.push({activityId:'LOE',activityType:'level_of_effort',status:'in_progress',criticality:'critical',totalFloatHours:0,floatRiskWatchlist:true,finishVarianceDays:9,missedPlannedStart:false,finishOverdue:false});
  return out.map(row=>({...row,...activityDelayStatus(row)}));
}

test('every filter with a KPI label counts the KPI population on the register and in the report',()=>{
  const source=rows(),before=JSON.stringify(source),counts=activityAnalyticsCounts(source);
  const execution=source.filter(r=>r.activityType!=='level_of_effort');
  const result={key:'activity-analytics',status:'partial' as const,reason:null,dependencies:[],data:{rows:source}};
  const cases:[string,Record<string,string>,keyof typeof counts][]=[
    ['Critical',{criticality:'critical'},'critical'],
    ['Near-critical',{criticality:'near_critical'},'nearCritical'],
    ['Float-risk watchlist',{condition:'float_risk'},'floatRisk'],
    ['Delayed execution activities',{condition:'delayed'},'late'],
    ['Any schedule pressure',{condition:'schedule_pressure'},'scheduleDelayed'],
    ['Missed start',{condition:'missed_start'},'missedStart'],
    ['Overdue finish',{condition:'overdue_finish'},'overdueFinish'],
  ];
  for(const [label,filter,measure] of cases){
    const kpi=counts[measure].value;
    assert.equal(typeof kpi,'number',label+' KPI is established in this fixture');
    const screen=activityRegisterPage(source,new URLSearchParams({...filter,pageSize:'100'}));
    assert.equal(screen.matchingCount,kpi,label+': screen filter count equals the KPI');
    assert.ok(screen.rows.every((r:any)=>r.status!=='completed'),label+': no completed work in a live filter');
    const reportFilters=filter.condition?{scheduleCondition:filter.condition}:{criticality:filter.criticality!};
    const report=(preparedModuleResult(result,{filters:reportFilters}).data as any).rows.filter((r:any)=>r.activityType!=='level_of_effort');
    assert.equal(report.length,kpi,label+': report filter count equals the KPI');
    assert.ok(report.every((r:any)=>r.status!=='completed'),label+': no completed work in the report filter');
  }
  // Float filters without their own tile here follow the same live population on both paths.
  for(const [condition,predicate] of [['negative_float',(r:any)=>r.totalFloatHours<0],['zero_float',(r:any)=>r.totalFloatHours===0]] as const){
    const expected=execution.filter(r=>r.status!=='completed'&&predicate(r)).length;
    assert.equal(activityRegisterPage(source,new URLSearchParams({condition})).matchingCount,expected,condition);
    const report=(preparedModuleResult(result,{filters:{scheduleCondition:condition}}).data as any).rows.filter((r:any)=>r.activityType!=='level_of_effort');
    assert.equal(report.length,expected,condition+' report');
  }
  // The KPI label is not a different measure from the filter: delayed is not the wider pressure set.
  assert.notEqual(counts.late.value,counts.scheduleDelayed.value,'fixture separates the two measures');
  // Completed work remains available as its own clearly labelled choice.
  assert.equal(activityRegisterPage(source,new URLSearchParams('status=completed')).matchingCount,60);
  assert.equal((preparedModuleResult(result,{filters:{status:'completed'}}).data as any).rows.length,60);
  assert.equal(activityRegisterPage(source,new URLSearchParams()).matchingCount,execution.length);
  assert.equal(JSON.stringify(source),before,'filters never change the source rows');
});
