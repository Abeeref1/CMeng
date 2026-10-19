import {resolveWorkingCalendar} from '../../schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
/** The fields both weekly capacity readers supply. */
export interface WeeklyCapacityLike {
  state:'available'|'partial'|'candidate'|'not_found';
  resourceCount:number;
  comparableRowCount:number;
  capacityCoveragePercent:number|null;
  plannedUtilizationPercent?:number|null;
  actualUtilizationPercent?:number|null;
  utilizationByUnit?:unknown[];
}
import {pmcRoleOwner,ownerDisplayState} from './action-priority';

/** F07 (D-064, D-078, D-107, D-178, D-209, D-215, D-216): the inputs every page
 * depends on (programme calendars, resource capacity and risk owners) are
 * decided by ONE rule here. Pages and the shared project facts read these
 * functions; no page decides them again. Unknown stays unknown. */
export type ProjectInputState='established'|'partial'|'candidate'|'missing';

export interface CalendarInputStatus {
  state:ProjectInputState;
  openActivityCount:number|null;
  /** Open activities whose source calendar resolves to a readable working pattern. */
  calendarActivityCount:number|null;
  unresolvedCalendarActivityCount:number|null;
  basis:string;
}

/** One calendar rule: an open activity has working time only when its own source
 * calendar resolves. No elapsed or 8-hour fallback is assumed. */
const calendarCache=new WeakMap<CanonicalScheduleModel,CalendarInputStatus>();
export function calendarInputStatus(model:CanonicalScheduleModel|null|undefined):CalendarInputStatus{
  if(model){const cached=calendarCache.get(model);if(cached)return cached;const value=calculateCalendarInputStatus(model);calendarCache.set(model,value);return value;}
  return calculateCalendarInputStatus(null);
}
function calculateCalendarInputStatus(model:CanonicalScheduleModel|null):CalendarInputStatus{
  if(!model)return {state:'missing',openActivityCount:null,calendarActivityCount:null,unresolvedCalendarActivityCount:null,
    basis:'No reporting programme is adopted, so calendar coverage is unknown.'};
  const open=model.activities.filter(row=>row.status!=='completed');
  const resolved=open.filter(row=>resolveWorkingCalendar(row.calendarId,model.calendars,false)).length;
  const state:ProjectInputState=!open.length||!resolved?'missing':resolved===open.length?'established':'partial';
  return {state,openActivityCount:open.length,calendarActivityCount:resolved,unresolvedCalendarActivityCount:open.length-resolved,
    basis:!open.length?'The reporting programme has no open activities.':
      resolved+' of '+open.length+' open activities have a readable source calendar; no default working pattern is assumed.'};
}

export interface CapacityInputStatus {
  state:ProjectInputState;
  weeklyState:WeeklyCapacityLike['state'];
  /** Weekly capacity evidence may be used for utilization only when governed. */
  governed:boolean;
  resourceCount:number|null;
  comparableRowCount:number;
  capacityCoveragePercent:number|null;
  basis:string;
}

/** One capacity rule: governed weekly capacity (available or partial) is used;
 * candidate evidence is shown as candidate and never promoted. */
export function capacityInputStatus(weekly:WeeklyCapacityLike|null|undefined):CapacityInputStatus{
  const weeklyState=weekly?.state??'not_found';
  const governed=weeklyState==='available'||weeklyState==='partial';
  return {state:weeklyState==='available'?'established':weeklyState==='partial'?'partial':weeklyState==='candidate'?'candidate':'missing',
    weeklyState,governed,resourceCount:governed?weekly!.resourceCount:null,comparableRowCount:weekly?.comparableRowCount??0,
    capacityCoveragePercent:governed?weekly!.capacityCoveragePercent:null,
    basis:governed?'Governed weekly resource capacity evidence.':weeklyState==='candidate'
      ?'Resource support evidence exists only as candidate and is not promoted to confirmed utilization.'
      :'No governed weekly resource capacity evidence is established.'};
}

/** The resource-utilization capacity position, used by every path that builds
 * that page (full project build and single-page build). */
export function resourceUtilizationCapacity<W extends WeeklyCapacityLike>(
  projection:{assignedResourceCount:number;capacityBasedResourceCount:number;capacityCoveragePercent:number|null},
  weekly:W,
){
  const capacity=capacityInputStatus(weekly);
  const capacityKnown=projection.capacityBasedResourceCount;
  const allCapacityKnown=projection.assignedResourceCount>0&&capacityKnown===projection.assignedResourceCount;
  const weeklyComparable=weekly.comparableRowCount>0;
  const fields={
    scheduleCapacityCoveragePercent:projection.capacityCoveragePercent,
    capacityCoveragePercent:capacity.governed&&weekly.capacityCoveragePercent!==null?weekly.capacityCoveragePercent:projection.capacityCoveragePercent,
    plannedUtilizationPercent:capacity.governed?weekly.plannedUtilizationPercent??null:null,
    actualUtilizationPercent:capacity.governed?weekly.actualUtilizationPercent??null:null,
    utilizationByUnit:capacity.governed?(weekly.utilizationByUnit??[]) as NonNullable<W['utilizationByUnit']>:[] as NonNullable<W['utilizationByUnit']>,
    assessedOverloadResourceCount:capacityKnown,
    overloadAssessmentState:capacityKnown===0&&!weeklyComparable?'not_assessable_per_hour':allCapacityKnown||weekly.state==='available'?'complete':'partial',
    capacityStatus:capacity,
    weeklyCapacityEvidence:weekly,
  };
  const status:'ready'|'partial'=allCapacityKnown||weekly.state==='available'?'ready':'partial';
  const reason=weekly.state==='candidate'?capacity.basis:capacityKnown===0
    ?weeklyComparable
      ?'Per-hour resource capacity is not established in the schedule resource model. Weekly capacity and demand evidence is shown separately without unsafe unit conversion.'
      :'Resource assignments are available, but no usable capacity rate is established. Overload cannot be assessed and zero must not be inferred.'
    :'Resource utilization is calculated only for resources with established capacity; the remaining resources stay demand-only.';
  return {fields,status,reason};
}

/** One risk-owner rule, the same as Accountability: a named source owner is kept;
 * a blank or placeholder owner is the PMC Risk Manager role, shown as owner not set. */
export function riskOwner(sourceOwner:unknown):string{
  return pmcRoleOwner('risk',typeof sourceOwner==='string'?sourceOwner:null);
}

export interface RiskOwnerInputStatus {
  state:ProjectInputState;
  recordCount:number|null;
  namedOwnerCount:number|null;
  missingOwnerCount:number|null;
  basis:string;
}

export function riskOwnerInputStatus(rows:ReadonlyArray<{riskId:string;owner?:string|null}>|null|undefined):RiskOwnerInputStatus{
  if(!rows)return {state:'missing',recordCount:null,namedOwnerCount:null,missingOwnerCount:null,basis:'No risk register is supplied.'};
  let named=0;
  for(const row of rows)if(ownerDisplayState(riskOwner(row.owner)).named)named++;
  const state:ProjectInputState=!rows.length?'missing':named===rows.length?'established':named?'partial':'missing';
  return {state,recordCount:rows.length,namedOwnerCount:named,missingOwnerCount:rows.length-named,
    basis:'Source risk owners; a blank or placeholder owner is the PMC Risk Manager role with no named individual.'};
}
