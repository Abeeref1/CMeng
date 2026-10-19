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
  /** Source resource-week rows. Each resource is one trade. */
  points?:ReadonlyArray<CapacityPointLike>;
  /** Resource master rows (a trade may be listed with no weekly rows). */
  masterResources?:ReadonlyArray<MasterResourceLike>;
}
export interface MasterResourceLike {resourceId:string;name?:string|null;unit?:string|null;resourceClass?:string;utilizationApplicable?:boolean|null}
/** The fields both weekly readers give for one resource-week. */
export interface CapacityPointLike {
  resourceId:string;
  resourceName?:string|null;
  unit?:string|null;
  availableCapacity?:number|null;
  /** Capacity as stated in the source, before any approval rule. */
  sourceAvailableCapacity?:number|null;
  capacityAuthority?:string;
}

export type TradeCapacityState='approved'|'stated_not_approved'|'stated_approval_not_given'|'stated'|'mixed'|'not_stated';
export interface TradeCapacityRow {
  resourceId:string;
  resourceName:string|null;
  unit:string|null;
  capacityState:TradeCapacityState;
  periodCount:number;
  statedPeriodCount:number;
  minStatedCapacity:number|null;
  maxStatedCapacity:number|null;
  capacityText:string;
}

/** F07: one rule for the capacity of every trade (resource) in the weekly
 * register. Every trade in the source is listed; a trade whose rows state no
 * capacity is 'not_stated', never dropped and never 0. */
export function tradeCapacityRows(points:ReadonlyArray<CapacityPointLike>|null|undefined,masters:ReadonlyArray<MasterResourceLike>|null|undefined=null):TradeCapacityRow[]{
  const groups=new Map<string,CapacityPointLike[]>();
  for(const point of points??[]){if(!point.resourceId)continue;const list=groups.get(point.resourceId)??[];list.push(point);groups.set(point.resourceId,list);}
  // A trade in the resource master with no weekly rows is still a trade: listed as not stated.
  const masterOnly=(masters??[]).filter(m=>m.resourceId&&!groups.has(m.resourceId)&&m.utilizationApplicable!==false&&m.resourceClass!=='material')
    .filter((m,i,all)=>all.findIndex(o=>o.resourceId===m.resourceId)===i)
    .map(m=>({resourceId:m.resourceId,resourceName:m.name||null,unit:m.unit||null,capacityState:'not_stated' as const,periodCount:0,statedPeriodCount:0,
      minStatedCapacity:null,maxStatedCapacity:null,capacityText:'Not stated'}));
  return [...[...groups.values()].map(rows=>{
    const first=rows[0]!;
    const statedOf=(p:CapacityPointLike)=>{const v='sourceAvailableCapacity' in p?p.sourceAvailableCapacity:p.availableCapacity;return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;};
    const stated=rows.filter(p=>statedOf(p)!==null),values=stated.map(p=>statedOf(p)!);
    const authorities=new Set(stated.map(p=>p.capacityAuthority??'not_recorded'));
    const capacityState:TradeCapacityState=!stated.length?'not_stated':authorities.size>1?'mixed':
      authorities.has('approved_source')?'approved':authorities.has('stated_not_approved')?'stated_not_approved':
      authorities.has('source_unconfirmed')?'stated_approval_not_given':'stated';
    const unit=first.unit??null,min=values.length?Math.min(...values):null,max=values.length?Math.max(...values):null;
    const label={approved:'approved',stated_not_approved:'stated, not approved',stated_approval_not_given:'stated, approval not given',stated:'stated',mixed:'partly approved',not_stated:''}[capacityState];
    const capacityText=capacityState==='not_stated'?'Not stated':
      (min===max?String(min):String(min)+' to '+String(max))+(unit?' '+unit:'')+' per week · '+stated.length+' of '+rows.length+' weeks stated · '+label;
    return {resourceId:first.resourceId,resourceName:first.resourceName??null,unit,capacityState,periodCount:rows.length,statedPeriodCount:stated.length,
      minStatedCapacity:min,maxStatedCapacity:max,capacityText};
  }),...masterOnly];
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
  /** Trades (resources) in the weekly register, and how many state a capacity. */
  tradeCount:number|null;
  statedCapacityTradeCount:number|null;
  notStatedCapacityTradeCount:number|null;
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
    ...((trades)=>({tradeCount:trades?trades.length:null,statedCapacityTradeCount:trades?trades.filter(t=>t.capacityState!=='not_stated').length:null,
      notStatedCapacityTradeCount:trades?trades.filter(t=>t.capacityState==='not_stated').length:null}))(weekly?.points?.length||weekly?.masterResources?.length?tradeCapacityRows(weekly.points,weekly.masterResources):null),
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

export interface RiskRowInputStatus {
  state:ProjectInputState;
  /** Every row the risk register supplies. */
  sourceRowCount:number|null;
  /** Rows dated on or before the Data Date (the reporting position). */
  currentRowCount:number|null;
  openCount:number|null;
  closedCount:number|null;
  unclearStatusCount:number|null;
  afterDataDateCount:number|null;
  undatedCount:number|null;
  /** Risk register page: the current subset of the whole register. */
  registerLabel:string;
  /** Delivery risks page: every register row with its subsets. */
  deliveryLabel:string;
  basis:string;
}

/** F07: one count rule for the risk register population. The risk register page
 * (current at the Data Date) and Delivery risks (every source row) both state
 * this same total and label their own subset. No row is dropped. */
export function riskRowInputStatus(risk:{sourceRecordCount:number;currentRecordCount:number;futureRecordCount:number;undatedRecordCount:number;current:ReadonlyArray<{status:string}>}|null|undefined):RiskRowInputStatus{
  if(!risk||!risk.sourceRecordCount)return {state:'missing',sourceRowCount:null,currentRowCount:null,openCount:null,closedCount:null,unclearStatusCount:null,
    afterDataDateCount:null,undatedCount:null,registerLabel:'No risk register rows read.',deliveryLabel:'No risk register rows read.',basis:'No risk register rows are read; the population is unknown.'};
  const open=risk.current.filter(r=>r.status==='open').length,closed=risk.current.filter(r=>r.status==='closed').length;
  const unclear=risk.current.length-open-closed,current=risk.currentRecordCount,total=risk.sourceRecordCount;
  const after=risk.futureRecordCount,undated=risk.undatedRecordCount;
  const split=open+' open, '+closed+' closed'+(unclear?', '+unclear+' with an unclear status':'');
  const plural=(n:number,word:string)=>n+' '+word+(n===1?'':'s');
  const notListed=after+undated;
  return {state:undated||unclear?'partial':'established',sourceRowCount:total,currentRowCount:current,openCount:open,closedCount:closed,unclearStatusCount:unclear,
    afterDataDateCount:after,undatedCount:undated,
    registerLabel:'Showing '+current+' current at the reporting date of '+plural(total,'risk register row')+' ('+split+').'+
      (notListed?' Not listed here: '+after+' dated after the Data Date and '+undated+' without a date; Delivery risks lists all '+total+'.':''),
    deliveryLabel:plural(total,'risk register row')+': '+current+' current at the reporting date ('+split+'), '+after+' dated after the Data Date, '+undated+' without a date.',
    basis:'Every supplied risk register row. Current = dated on or before the Data Date; status as of the Data Date.'};
}
