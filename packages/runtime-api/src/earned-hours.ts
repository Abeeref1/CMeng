import {round} from '../../truth-kernel/src';
import {resourceLaborHourEligible} from '../../schedule-resource-core/src';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {refreshResourceSourceFields} from './resource-source-refresh';
import {canonicalResources,programmeRecordedLaborHours} from './canonical-resource-runtime';
import {recordedHoursByTradeWeek} from './resource-trade-week-hours';
import {projectDecisionFacts} from './project-decision-facts';
import type {ProjectRuntimeState} from './project-state-types';

/**
 * F45 earned hours: the sum over activities (or BOQ items with stated hours per unit) of
 * budgeted hours x % complete, compared with the actual hours spent.
 * Budgeted hours are used only where the source states them: the BOQ / norms column with
 * labour hours per unit, or the programme's labour resource assignments (budgeted units).
 * The BOQ basis is used when the BOQ states hours per unit and every such item is measured;
 * otherwise the programme assignments; if neither, earned hours are not established and the
 * reason is given. No unit hours or productivity norm is assumed.
 */
export interface EarnedHoursBasis{
  state:'established'|'not_established'|'not_supplied';
  budgetedHours:number|null;earnedHours:number|null;percentComplete:number|null;
  itemCount:number;knownItemCount:number;reason:string|null;basis:string;
}
export interface EarnedHoursPosition{
  state:'established'|'not_established';
  basis:'boq_unit_hours'|'programme_assignments'|null;
  dataDateIso:string|null;
  budgetedHours:number|null;earnedHours:number|null;percentComplete:number|null;
  actualHoursSpent:number|null;actualHoursBasis:'programme_recorded'|'register_recorded'|null;actualHoursReason:string|null;
  /** Earned hours / actual hours spent: above 1 means more work earned than hours spent. */
  earnedToSpentRatio:number|null;earnedMinusSpentHours:number|null;
  programme:EarnedHoursBasis;boq:EarnedHoursBasis;
  formula:string;reason:string|null;
}
const PROGRAMME_BASIS='Programme labour-hour resource assignments: budgeted units (P6 target quantity) per activity x the activity % complete read from the programme. A finished activity (actual finish) counts 100%; an activity not started (no actual start and no % complete) counts 0%; an activity in progress with no % complete is not established.';
const BOQ_BASIS='BOQ / measurement register labour hours per unit (stated, unique per item): budgeted hours = contract quantity x hours per unit; earned hours = measured installed quantity x hours per unit.';
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:EarnedHoursPosition}>();
export function earnedHoursForState(state:ProjectRuntimeState):EarnedHoursPosition{
  const hit=cache.get(state);if(hit?.version===state.version)return hit.value;
  const value=calculate(state);cache.set(state,{version:state.version,value});return value;
}
const notSupplied=(reason:string,basis:string):EarnedHoursBasis=>({state:'not_supplied',budgetedHours:null,earnedHours:null,percentComplete:null,itemCount:0,knownItemCount:0,reason,basis});
const pct=(earned:number|null,budget:number|null)=>earned!==null&&budget!==null&&budget>0?round(earned/budget*100):null;

function programmeBasis(state:ProjectRuntimeState){
  const current=projectControlSchedule(state);
  if(!current)return {result:notSupplied('No adopted programme is available.',PROGRAMME_BASIS),model:null};
  const stored=state.resourcesByRevision.get(current.revision.revisionId);
  const model=stored?refreshResourceSourceFields(state,stored):null;
  if(!model)return {result:notSupplied('The programme has no resource assignments.',PROGRAMME_BASIS),model:null};
  const eligible=new Set(model.resources.filter(resourceLaborHourEligible).map(r=>r.resourceId));
  const labour=model.assignments.filter(a=>a.resourceId!==null&&eligible.has(a.resourceId));
  if(!labour.length)return {result:notSupplied('The programme has no hour-based labour resource assignments.',PROGRAMME_BASIS),model};
  const activities=new Map(current.revision.model.activities.map(a=>[a.activityId,a]));
  const byActivity=new Map<string,typeof labour>();
  for(const a of labour){const list=byActivity.get(a.activityId)??[];list.push(a);byActivity.set(a.activityId,list);}
  let budget:number|null=0,earned:number|null=0,known=0,missingBudget=0,missingProgress=0;
  for(const [activityId,assignments] of byActivity){
    const activity=activities.get(activityId);
    const hours=assignments.every(a=>typeof a.plannedUnits==='number'&&Number.isFinite(a.plannedUnits)&&a.plannedUnits>=0)?assignments.reduce((n,a)=>n+a.plannedUnits!,0):null;
    const stated=activity&&typeof activity.percentComplete==='number'&&Number.isFinite(activity.percentComplete)&&activity.percentComplete>=0&&activity.percentComplete<=100?activity.percentComplete:null;
    const complete=activity?.actualFinishIso?100:stated??(activity&&!activity.actualStartIso&&activity.status==='not_started'?0:null);
    if(hours===null)missingBudget++;
    if(complete===null)missingProgress++;
    budget=budget===null||hours===null?null:budget+hours;
    earned=earned===null||hours===null||complete===null?null:earned+hours*complete/100;
    if(hours!==null&&complete!==null)known++;
  }
  const reasons=[missingBudget?missingBudget+' of '+byActivity.size+' activities with labour assignments have no budgeted hours.':null,
    missingProgress?missingProgress+' of '+byActivity.size+' activities with labour assignments have no % complete.':null].filter((v):v is string=>Boolean(v));
  return {model,result:{state:earned!==null&&budget!==null?'established':'not_established',budgetedHours:round(budget),earnedHours:round(earned),percentComplete:pct(earned,budget),
    itemCount:byActivity.size,knownItemCount:known,reason:reasons.length?reasons.join(' '):null,basis:PROGRAMME_BASIS} as EarnedHoursBasis};
}

function boqBasis(state:ProjectRuntimeState):EarnedHoursBasis{
  if(!state.boq&&!state.quantities)return notSupplied('No BOQ is supplied.',BOQ_BASIS);
  const items=(projectDecisionFacts(state).quantities?.items??[]) as Array<{budgetHoursPerUnit:number|null;contractQuantity:number|null;installedQuantity:number|null}>;
  const withHours=items.filter(i=>typeof i.budgetHoursPerUnit==='number'&&Number.isFinite(i.budgetHoursPerUnit));
  if(!withHours.length)return notSupplied(items.length?'The BOQ and measurement registers state no labour hours per unit.':'No BOQ items are read.',BOQ_BASIS);
  const budget=withHours.every(i=>i.contractQuantity!==null)?withHours.reduce((n,i)=>n+i.contractQuantity!*i.budgetHoursPerUnit!,0):null;
  const measured=withHours.filter(i=>i.installedQuantity!==null);
  const earned=measured.length===withHours.length?measured.reduce((n,i)=>n+i.installedQuantity!*i.budgetHoursPerUnit!,0):null;
  const reasons=[budget===null?withHours.filter(i=>i.contractQuantity===null).length+' of '+withHours.length+' BOQ items with hours per unit have no contract quantity.':null,
    earned===null?(withHours.length-measured.length)+' of '+withHours.length+' BOQ items with hours per unit have no dated installed quantity.':null].filter((v):v is string=>Boolean(v));
  return {state:earned!==null&&budget!==null?'established':'not_established',budgetedHours:round(budget),earnedHours:round(earned),percentComplete:pct(earned,budget),
    itemCount:withHours.length,knownItemCount:measured.length,reason:reasons.length?reasons.join(' '):null,basis:BOQ_BASIS};
}

function calculate(state:ProjectRuntimeState):EarnedHoursPosition{
  const programme=programmeBasis(state),boq=boqBasis(state);
  const chosen=boq.state==='established'?{basis:'boq_unit_hours' as const,value:boq}:programme.result.state==='established'?{basis:'programme_assignments' as const,value:programme.result}:null;
  // Hours spent: the programme's own recorded actual hours on the same labour assignments;
  // otherwise the weekly register's recorded hours when every labour week to the Data Date is recorded.
  const recorded=programmeRecordedLaborHours(programme.model);
  const register=recorded.hours===null?recordedHoursByTradeWeek(canonicalResources(state)):null;
  const spent=recorded.hours??(register?.state==='established'?register.recordedHours:null);
  const spentBasis=recorded.hours!==null?'programme_recorded' as const:spent!==null?'register_recorded' as const:null;
  const earned=chosen?.value.earnedHours??null;
  return {state:chosen?'established':'not_established',basis:chosen?.basis??null,dataDateIso:projectDataDate(state),
    budgetedHours:chosen?.value.budgetedHours??null,earnedHours:earned,percentComplete:chosen?.value.percentComplete??null,
    actualHoursSpent:spent,actualHoursBasis:spentBasis,
    actualHoursReason:spent!==null?null:[recorded.reason,register?.reason].filter(Boolean).join(' ')||'Actual hours spent are not stated.',
    earnedToSpentRatio:earned!==null&&spent!==null&&spent>0?round(earned/spent):null,
    earnedMinusSpentHours:earned!==null&&spent!==null?round(earned-spent):null,
    programme:programme.result,boq,
    formula:'Earned hours = sum of budgeted hours x % complete. Earned / spent = earned hours / actual hours spent.',
    reason:chosen?null:'Earned hours are not established. BOQ: '+(boq.reason??'not established')+' Programme: '+(programme.result.reason??'not established')};
}
