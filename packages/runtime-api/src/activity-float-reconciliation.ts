import {isExecutionActivity,sourceFloatCriticality,type CanonicalScheduleModel,type ScheduleAnalysisConfig} from '../../schedule-analysis-core/src';
import type {IndependentForecastProjection} from '../../independent-forecast/src';

/** Submitted classifications remain source assertions. Every comparison retains
 * the activity identity and both answers; an aggregate count cannot clear a row. */
export function activityFloatReconciliation(model:CanonicalScheduleModel,forecast:IndependentForecastProjection,config:ScheduleAnalysisConfig){
 const revisionMatches=forecast.sourceRevisionId===model.sourceRevisionId;
 const deterministic=forecast.complete&&forecast.origin==='deterministic_source_calendar'&&revisionMatches;
 const qualifiedScenario=forecast.complete&&forecast.origin==='scenario_with_assumptions'&&revisionMatches;
 const calculated=new Map(forecast.activities.map(row=>[row.activityId,row]));
 const rows=model.activities.filter(isExecutionActivity).map(activity=>{
  const independent=calculated.get(activity.activityId);
  const completed=activity.status==='completed';
  const usable=!completed&&revisionMatches&&forecast.complete&&(deterministic||qualifiedScenario)&&independent?.status==='calculated'&&independent.calendarMode==='source_calendar';
  const independentTotalFloatHours=usable&&typeof independent?.independentTotalFloatHours==='number'&&Number.isFinite(independent.independentTotalFloatHours)?independent.independentTotalFloatHours:null;
  const submittedTotalFloatHours=typeof activity.totalFloatHours==='number'&&Number.isFinite(activity.totalFloatHours)?activity.totalFloatHours:null;
  const submittedCriticality=completed?'not_applicable':sourceFloatCriticality(model,{...activity,totalFloatHours:submittedTotalFloatHours},config);
  const independentCriticality=completed?'not_applicable':sourceFloatCriticality(model,{...activity,totalFloatHours:independentTotalFloatHours},config);
  const floatDifferenceHours=submittedTotalFloatHours!==null&&independentTotalFloatHours!==null?Number((independentTotalFloatHours-submittedTotalFloatHours).toFixed(6)):null;
  const state=completed?'not_applicable_completed':
   independentTotalFloatHours===null?'independent_not_established':submittedTotalFloatHours===null?'submitted_not_established':
   submittedCriticality!==independentCriticality?'material_difference':'matched';
  const authority=deterministic?'deterministic_source_calendar':qualifiedScenario&&usable?'qualified_scenario_source_calendar':'not_established';
  return {activityId:activity.activityId,name:activity.name,calendarId:activity.calendarId,sourceRevisionId:model.sourceRevisionId,
   submittedTotalFloatHours,independentTotalFloatHours,submittedCriticality,independentCriticality,floatDifferenceHours,
   floatReconciliationState:state,floatReviewLabel:state==='material_difference'?'Disputed / under review':state==='matched'&&floatDifferenceHours!==null&&Math.abs(floatDifferenceHours)>0.000001?'Classification matched; numeric difference retained in planner detail':state==='matched'?'Reconciled':state==='not_applicable_completed'?'Not applicable · completed':state==='submitted_not_established'?'Submitted float missing':'Independent CPM not established',
   independentCpmAuthority:authority,sourceRefs:[...activity.sourceRefs]};
 });
 const byActivityId=new Map(rows.map(row=>[row.activityId,row]));
 const comparableRows=rows.filter(row=>row.floatReconciliationState!=='not_applicable_completed');
 const scenarioComparable=qualifiedScenario&&comparableRows.some(row=>row.independentCpmAuthority==='qualified_scenario_source_calendar');
 const classificationsDiffer=comparableRows.filter(row=>row.floatReconciliationState==='material_difference');
 const numericOnly=comparableRows.filter(row=>row.floatReconciliationState==='matched'&&row.floatDifferenceHours!==null&&Math.abs(row.floatDifferenceHours)>0.000001);
 const differingRows=classificationsDiffer;
 const commonOffsetHours=comparableRows.length>=10&&numericOnly.length===comparableRows.length&&
   numericOnly.every(row=>row.floatDifferenceHours!==null&&Math.abs(row.floatDifferenceHours!-numericOnly[0]!.floatDifferenceHours!)<=0.000001)
   ?numericOnly[0]!.floatDifferenceHours:null;
 return {byActivityId,summary:{sourceRevisionId:model.sourceRevisionId,independentCpmState:deterministic?'established':scenarioComparable?'qualified_scenario':'not_established',
  sourceActivityCount:rows.length,checkedActivityCount:comparableRows.length,notApplicableCompletedCount:rows.length-comparableRows.length,
  matchedActivityCount:comparableRows.filter(row=>row.floatReconciliationState==='matched').length,
  disputedActivityCount:classificationsDiffer.length,
  totalDifferenceCount:classificationsDiffer.length+numericOnly.length,
  numberOnlyDifferenceCount:numericOnly.length,
  classChangeCount:classificationsDiffer.length,
  notEstablishedCount:comparableRows.filter(row=>!['matched','material_difference'].includes(row.floatReconciliationState)).length,
  criticalityDifferenceCount:classificationsDiffer.length,
  numericDifferenceActivityCount:numericOnly.length,
  differenceActivityCount:classificationsDiffer.length+numericOnly.length,
  numericAuditRows:numericOnly,
  commonOffsetHours,
  unresolvedActivityCount:comparableRows.filter(row=>!['matched','material_difference'].includes(row.floatReconciliationState)).length,
  basis:deterministic
    ?'Submitted total float and CMeng independent source-calendar CPM are compared for the same open activity and revision using the same critical and near-critical thresholds. Completed activities are outside the live float-comparison denominator.'
    :scenarioComparable
      ?'Open-activity submitted float is compared with CMeng source-calendar CPM using the assumptions stated in the calculation. The comparison remains visible as a qualified scenario and is not promoted to official CPM authority. Completed activities are not counted as unresolved float comparisons.'
      :'Independent source-calendar CPM is not established for the comparable open-activity population. Completed activities are outside the live float-comparison denominator.',
  toleranceHours:0.000001,rows:comparableRows.filter(row=>row.floatReconciliationState!=='matched')}};
}

export function attachActivityFloatReconciliation<T>(data:T,review:ReturnType<typeof activityFloatReconciliation>):T&{activityFloatReconciliation:typeof review.summary}{
 const visit=(value:any):any=>{
  if(Array.isArray(value))return value.map(visit);
  if(!value||typeof value!=='object')return value;
  const result=Object.fromEntries(Object.entries(value).map(([key,child])=>[key,visit(child)]));
  const row=typeof value.activityId==='string'?review.byActivityId.get(value.activityId):undefined;
  if(row&&('criticality' in value||'totalFloatHours' in value)&&(!value.sourceRevisionId||value.sourceRevisionId===row.sourceRevisionId))return {...result,...row};
  return result;
 };
 const result={...data} as any;
 for(const key of ['rows','watchlistRows','criticalRows','negativeFloatRows','priorityRows','managementRows','boundaryAudit'])if(result[key])result[key]=visit(result[key]);
 return {...result,activityFloatReconciliation:review.summary};
}
