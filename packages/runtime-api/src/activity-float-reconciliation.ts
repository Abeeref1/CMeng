import {isExecutionActivity,sourceFloatCriticality,type CanonicalScheduleModel,type ScheduleAnalysisConfig} from '../../schedule-analysis-core/src';
import type {IndependentForecastProjection} from '../../independent-forecast/src';

/** Submitted classifications remain source assertions. Every comparison retains
 * the activity identity and both answers; an aggregate count cannot clear a row. */
export function activityFloatReconciliation(model:CanonicalScheduleModel,forecast:IndependentForecastProjection,config:ScheduleAnalysisConfig){
 const established=forecast.complete&&forecast.origin==='deterministic_source_calendar'&&forecast.sourceRevisionId===model.sourceRevisionId;
 const calculated=new Map(forecast.activities.map(row=>[row.activityId,row]));
 const rows=model.activities.filter(isExecutionActivity).map(activity=>{
  const independent=calculated.get(activity.activityId);
  const usable=established&&independent?.status==='calculated'&&independent.calendarMode==='source_calendar';
  const independentTotalFloatHours=usable&&typeof independent?.independentTotalFloatHours==='number'&&Number.isFinite(independent.independentTotalFloatHours)?independent.independentTotalFloatHours:null;
  const submittedTotalFloatHours=typeof activity.totalFloatHours==='number'&&Number.isFinite(activity.totalFloatHours)?activity.totalFloatHours:null;
  const submittedCriticality=sourceFloatCriticality(model,{...activity,totalFloatHours:submittedTotalFloatHours},config);
  const independentCriticality=sourceFloatCriticality(model,{...activity,totalFloatHours:independentTotalFloatHours},config);
  const floatDifferenceHours=submittedTotalFloatHours!==null&&independentTotalFloatHours!==null?Number((independentTotalFloatHours-submittedTotalFloatHours).toFixed(6)):null;
  const state=independentTotalFloatHours===null?'independent_not_established':submittedTotalFloatHours===null?'submitted_not_established':
   Math.abs(floatDifferenceHours!)>0.000001||submittedCriticality!==independentCriticality?'material_difference':'matched';
  return {activityId:activity.activityId,name:activity.name,calendarId:activity.calendarId,sourceRevisionId:model.sourceRevisionId,
   submittedTotalFloatHours,independentTotalFloatHours,submittedCriticality,independentCriticality,floatDifferenceHours,
   floatReconciliationState:state,floatReviewLabel:state==='material_difference'?'Disputed / under review':state==='matched'?'Reconciled':state==='submitted_not_established'?'Submitted float missing':'Independent CPM not established',
   independentCpmAuthority:established?'deterministic_source_calendar':'not_established',sourceRefs:[...activity.sourceRefs]};
 });
 const byActivityId=new Map(rows.map(row=>[row.activityId,row]));
 return {byActivityId,summary:{sourceRevisionId:model.sourceRevisionId,independentCpmState:established?'established':'not_established',
  checkedActivityCount:rows.length,matchedActivityCount:rows.filter(row=>row.floatReconciliationState==='matched').length,
  disputedActivityCount:rows.filter(row=>row.floatReconciliationState==='material_difference').length,
  unresolvedActivityCount:rows.filter(row=>!['matched','material_difference'].includes(row.floatReconciliationState)).length,
  basis:'Submitted total float and CMeng independent calendar CPM are compared for the same activity and revision using the same critical and near-critical thresholds. Disputed source classifications remain under review. Scenario or incomplete CPM is not treated as an established independent answer.',
  toleranceHours:0.000001,rows:rows.filter(row=>row.floatReconciliationState!=='matched')}};
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
