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

/** F07: a page prerequisite is confirmed only when the shared input status is
 * established or partial (governed evidence exists). Candidate and missing
 * inputs are never confirmed on any page. */
export function inputConfirmed(status:{state:ProjectInputState}|null|undefined):boolean{
  return status?.state==='established'||status?.state==='partial';
}
const percentOf=(part:number,whole:number)=>whole>0?part/whole*100:null;
const plural=(n:number,word:string)=>n+' '+word+(n===1?'':'s');

export interface QuantityInputStatus {
  state:ProjectInputState;
  /** The BOQ source the project reads: adopted source, candidate, unreadable or none. */
  sourceState:'source'|'candidate'|'unreadable'|'missing';
  boqItemCount:number|null;
  /** Items whose contract quantity is a readable number (0 or more). */
  readableQuantityItemCount:number|null;
  /** Items that state a unit. */
  unitItemCount:number|null;
  /** Items with both a readable quantity and a unit. */
  readableItemCount:number|null;
  unreadableItemCount:number|null;
  basis:string;
  reason:string;
}
export interface QuantityItemLike {quantityItemId:string;unit?:string|null;contractQuantity?:number|null}
const readableQuantity=(item:QuantityItemLike)=>typeof item.contractQuantity==='number'&&Number.isFinite(item.contractQuantity)&&item.contractQuantity>=0;
const statedUnit=(item:QuantityItemLike)=>typeof item.unit==='string'&&item.unit.trim().length>0;

/** F07: one rule for BOQ quantities and units. An item is readable when its
 * contract quantity is a number and it states a unit. A BOQ that is only a
 * candidate source stays candidate on every page; no BOQ stays unknown. */
export function quantityInputStatus(selection:{state:string}|null|undefined,items:ReadonlyArray<QuantityItemLike>|null|undefined):QuantityInputStatus{
  const basis='Contract quantity and unit of every BOQ item in the BOQ source the project reads. Quantities in different units are never added.';
  if(!items){
    const sourceState=selection?.state==='unreadable'?'unreadable' as const:'missing' as const;
    return {state:'missing',sourceState,boqItemCount:null,readableQuantityItemCount:null,unitItemCount:null,readableItemCount:null,unreadableItemCount:null,basis,
      reason:sourceState==='unreadable'?'The BOQ source did not yield a readable item population; quantities are unknown.':'No BOQ is supplied; quantities are unknown.'};
  }
  const sourceState=selection?.state==='candidate'?'candidate' as const:'source' as const;
  const quantity=items.filter(readableQuantity).length,unit=items.filter(statedUnit).length;
  const readable=items.filter(item=>readableQuantity(item)&&statedUnit(item)).length;
  const state:ProjectInputState=!items.length||!readable?'missing':sourceState==='candidate'?'candidate':readable===items.length?'established':'partial';
  return {state,sourceState,boqItemCount:items.length,readableQuantityItemCount:quantity,unitItemCount:unit,readableItemCount:readable,unreadableItemCount:items.length-readable,basis,
    reason:!items.length?'The BOQ has no items.':
      readable+' of '+plural(items.length,'BOQ item')+' have a readable quantity and unit'+(sourceState==='candidate'?'; the BOQ is a candidate source, not adopted.':'.')};
}

export interface InstalledQuantityInputStatus {
  state:ProjectInputState;
  boqItemCount:number|null;
  /** BOQ items with a matched installed measurement dated on or before the Data Date. */
  measuredItemCount:number|null;
  unmeasuredItemCount:number|null;
  itemCoveragePercent:number|null;
  /** Measurement register rows read, matched to one BOQ item, unmatched at the Data Date, and dated after it. */
  sourceRowCount:number|null;
  matchedRowCount:number|null;
  unresolvedRowCount:number|null;
  futureRowCount:number|null;
  basis:string;
  reason:string;
}
export interface InstalledQuantityModelLike {
  items:ReadonlyArray<{quantityItemId:string}>;
  installedSnapshots:ReadonlyArray<{quantityItemId:string;asOfIso:string;installedQuantity:number}>;
  measurementReview?:{sourceRowCount:number;matchedRowCount:number;futureRowCount:number;currentUnresolvedRowCount:number}|null;
}

/** F07: one rule for installed quantities. A BOQ item is measured when a
 * dated installed measurement on or before the Data Date is matched to it
 * (unique item number and unit, as read by the measurement register). Rows
 * that match no item stay counted as unresolved. Unknown stays unknown. */
export function installedQuantityInputStatus(quantities:QuantityInputStatus,model:InstalledQuantityModelLike|null|undefined,dataDateIso:string|null|undefined):InstalledQuantityInputStatus{
  const basis='Dated installed measurements matched to a BOQ item by unique item number and unit (and BOQ section when an item number repeats), on or before the Data Date. A measurement never creates a BOQ item; unmeasured items are not zero.';
  const review=model?.measurementReview??null;
  const rows={sourceRowCount:review?.sourceRowCount??null,matchedRowCount:review?.matchedRowCount??null,unresolvedRowCount:review?.currentUnresolvedRowCount??null,futureRowCount:review?.futureRowCount??null};
  const unknown=(reason:string):InstalledQuantityInputStatus=>({state:'missing',boqItemCount:quantities.boqItemCount,measuredItemCount:null,unmeasuredItemCount:null,itemCoveragePercent:null,...rows,basis,reason});
  if(!model||quantities.boqItemCount===null)return unknown('No readable BOQ item population, so installed quantities cannot be matched.');
  if(!review&&!model.installedSnapshots.length)return unknown('No installed measurement records are supplied; installed quantities are unknown.');
  const dataDate=dataDateIso?.slice(0,10)??null;
  if(!dataDate)return unknown('The programme Data Date is not established, so dated measurements cannot be placed at the reporting position.');
  const itemIds=new Set(model.items.map(item=>item.quantityItemId));
  const measured=new Set(model.installedSnapshots.filter(row=>itemIds.has(row.quantityItemId)&&row.asOfIso.slice(0,10)<=dataDate&&
    typeof row.installedQuantity==='number'&&Number.isFinite(row.installedQuantity)&&row.installedQuantity>=0).map(row=>row.quantityItemId)).size;
  const total=model.items.length,unresolved=rows.unresolvedRowCount??0;
  const state:ProjectInputState=!measured?'missing':quantities.state==='candidate'?'candidate':measured===total&&unresolved===0?'established':'partial';
  return {state,boqItemCount:total,measuredItemCount:measured,unmeasuredItemCount:total-measured,itemCoveragePercent:percentOf(measured,total),...rows,basis,
    reason:!measured?'No installed measurement is matched to a BOQ item on or before the Data Date.':
      measured+' of '+plural(total,'BOQ item')+' have a matched installed measurement on or before the Data Date'+
      (unresolved?'; '+plural(unresolved,'measurement row')+(unresolved===1?' matches no BOQ item and needs review':' match no BOQ item and need review'):'')+
      (quantities.state==='candidate'?'; the BOQ is a candidate source, not adopted.':'.')};
}

export interface CpmCoverageInputStatus {
  state:ProjectInputState;
  /** Activities in the CMeng CPM population and how many it calculates. */
  activityCount:number|null;
  calculatedActivityCount:number|null;
  unresolvedActivityCount:number|null;
  coveragePercent:number|null;
  /** The CPM network run completed with readable source calendars. */
  calculationComplete:boolean;
  /** The CMeng CPM finish may be published as a management forecast. */
  publishable:boolean;
  /** Reasons the CPM is not publishable (failed gate checks and held calendar/finish differences). */
  holdReasons:string[];
  basis:string;
  reason:string;
}
export interface CpmForecastLike {
  calculatedActivityCount:number;unresolvedActivityCount:number;activityCoveragePercent:number|null;complete:boolean;
  activities:ReadonlyArray<unknown>;
}

/** F07: one rule for CMeng CPM coverage and publication. The share of
 * activities the CPM calculates, and the CPM is publishable only when every
 * reconciliation check passes and no calendar or finish difference is held
 * (the same rule the Dashboard uses for the CMeng finish). */
export function cpmCoverageInputStatus(forecast:CpmForecastLike|null|undefined,gate:{publishable:boolean;checks:ReadonlyArray<{label:string;state:string;detail:string}>}|null|undefined,calendarOrFinishHeld:boolean):CpmCoverageInputStatus{
  const basis='CMeng CPM run on the current programme logic, remaining durations and source calendars; publication needs every forecast reconciliation check passed and no held calendar or finish difference.';
  if(!forecast)return {state:'missing',activityCount:null,calculatedActivityCount:null,unresolvedActivityCount:null,coveragePercent:null,calculationComplete:false,publishable:false,
    holdReasons:['No current programme is adopted, so the CMeng CPM is not calculated.'],basis,reason:'No current programme is adopted, so CPM coverage is unknown.'};
  const holdReasons=[...(gate?.checks??[]).filter(check=>check.state!=='passed').map(check=>check.label+': '+check.detail),
    ...(calendarOrFinishHeld?['Calendar or finish difference held: the CMeng CPM finish differs from the submitted finish, or a calendar is unresolved; it is held until reconciled.']:[]),
    ...(!gate?['The forecast reconciliation gate is not established.']:[])];
  const publishable=!!gate&&gate.publishable&&!calendarOrFinishHeld;
  const calculated=forecast.calculatedActivityCount,total=forecast.activities.length;
  const state:ProjectInputState=!calculated?'missing':publishable&&forecast.activityCoveragePercent===100?'established':'partial';
  return {state,activityCount:total,calculatedActivityCount:calculated,unresolvedActivityCount:forecast.unresolvedActivityCount,coveragePercent:forecast.activityCoveragePercent,
    calculationComplete:forecast.complete,publishable,holdReasons:publishable?[]:holdReasons,basis,
    reason:'The CMeng CPM calculates '+calculated+' of '+total+' '+(total===1?'activity':'activities')+'; '+(publishable?'it is publishable.':'it is not publishable: '+holdReasons.join(' '))};
}

export interface DisciplineInputStatus {
  state:ProjectInputState;
  /** Programme activities in the classified population (level of effort and WBS summaries excluded). */
  activityCount:number|null;
  groupedActivityCount:number|null;
  activityCodeActivityCount:number|null;
  /** Grouped by the shared name rule on activity and WBS names. */
  nameRuleActivityCount:number|null;
  notGroupedActivityCount:number|null;
  disciplineCount:number|null;
  disciplines:Array<{value:string;activityCount:number;activityCodeActivityCount:number;nameRuleActivityCount:number}>;
  basis:string;
  reason:string;
}

/** F07: one discipline list: the programme Discipline/Trade activity code,
 * else the shared name rule on activity and WBS names. Every page lists these
 * same disciplines; activities matching none are counted as not grouped. */
export function disciplineInputStatus(rows:ReadonlyArray<{discipline:string|null;classificationBasis:Record<string,string>}>|null|undefined):DisciplineInputStatus{
  const basis='Programme Discipline/Trade activity code first; else the shared name rule on the activity name and its WBS names. Ambiguous names stay not grouped.';
  if(!rows)return {state:'missing',activityCount:null,groupedActivityCount:null,activityCodeActivityCount:null,nameRuleActivityCount:null,notGroupedActivityCount:null,disciplineCount:null,disciplines:[],basis,
    reason:'No current programme is adopted, so the discipline list is unknown.'};
  const groups=new Map<string,{value:string;activityCount:number;activityCodeActivityCount:number;nameRuleActivityCount:number}>();
  let code=0,name=0;
  for(const row of rows){
    const value=typeof row.discipline==='string'&&row.discipline.trim()?row.discipline:null;if(!value)continue;
    const group=groups.get(value)??{value,activityCount:0,activityCodeActivityCount:0,nameRuleActivityCount:0};
    group.activityCount++;
    if(row.classificationBasis.discipline==='source_activity_code'){group.activityCodeActivityCount++;code++;}else{group.nameRuleActivityCount++;name++;}
    groups.set(value,group);
  }
  const grouped=code+name,disciplines=[...groups.values()].sort((a,b)=>b.activityCount-a.activityCount||a.value.localeCompare(b.value));
  const state:ProjectInputState=!grouped?'missing':grouped===rows.length?'established':'partial';
  return {state,activityCount:rows.length,groupedActivityCount:grouped,activityCodeActivityCount:code,nameRuleActivityCount:name,notGroupedActivityCount:rows.length-grouped,
    disciplineCount:disciplines.length,disciplines,basis,
    reason:!rows.length?'The programme has no activities to group.':
      grouped+' of '+rows.length+' programme activities have a discipline ('+code+' from activity codes, '+name+' from the name rule); '+plural(disciplines.length,'discipline')+'.'};
}

export interface SharedProjectInputs {
  calendar:CalendarInputStatus;capacity:CapacityInputStatus;riskOwners:RiskOwnerInputStatus;riskRows:RiskRowInputStatus;
  quantities:QuantityInputStatus;installedQuantities:InstalledQuantityInputStatus;cpmCoverage:CpmCoverageInputStatus;disciplines:DisciplineInputStatus;
}
/** F07: the pages that show or gate on a shared input, and which inputs. */
export const SHARED_INPUT_PAGES:Readonly<Record<string,ReadonlyArray<keyof SharedProjectInputs>>>={
  'quantity-scurve':['quantities','installedQuantities'],
  'progress-breakdown':['quantities','installedQuantities'],
  'progress-report':['quantities','installedQuantities'],
  'challenge-contract':['calendar','quantities','installedQuantities'],
  'delivery-control':['quantities','installedQuantities'],
  'procurement-packages':['quantities','installedQuantities'],
  'material-tracking':['quantities','installedQuantities'],
  'long-lead':['quantities','installedQuantities'],
  'pmo-analysis':['cpmCoverage'],
  'schedule-analytics':['cpmCoverage'],
  'near-critical':['cpmCoverage'],
  'independent-forecast':['cpmCoverage'],
  'forecast-history':['cpmCoverage'],
  'recovery-acceleration':['cpmCoverage'],
  'activity-analytics':['disciplines'],
  'scope-classification':['disciplines'],
  'construction-discipline':['disciplines'],
  'resource-utilization':['disciplines'],
};
/** The Quantities page wording of the shared installed-quantity state. */
export function installedQuantityPageState(status:InstalledQuantityInputStatus):'available'|'partial'|'candidate'|'unresolved'{
  return status.state==='established'?'available':status.state==='partial'?'partial':status.state==='candidate'?'candidate':'unresolved';
}
/** F07: a page that shows or gates on a shared input carries that input as
 * `inputStatus`, and its own prerequisite fields read it. No page decides
 * these inputs again. Additive fields; no row or figure is recalculated. */
export function bindSharedInputStatus<T extends Record<string,any>>(key:string,data:T,inputs:SharedProjectInputs|null|undefined):T{
  const keys=SHARED_INPUT_PAGES[key];
  if(!keys||!inputs)return data;
  const out:Record<string,any>={...data,inputStatus:Object.fromEntries(keys.map(name=>[name,inputs[name]]))};
  if(key==='quantity-scurve'&&out.installedQuantityStatus){
    const installed=inputs.installedQuantities;
    out.installedQuantityStatus={...out.installedQuantityStatus,state:installedQuantityPageState(installed),measuredItemCount:installed.measuredItemCount,
      boqItemCount:installed.boqItemCount,itemCoveragePercent:installed.itemCoveragePercent,explanation:installed.reason+' Programme links are a separate requirement for planned curves.'};
  }
  const cpm=inputs.cpmCoverage;
  const cpmState=cpm.calculationComplete?'established':'not_established';
  if(['schedule-analytics','near-critical'].includes(key)&&'independentCpmState' in out){
    out.independentCpmState=cpmState;
    if('drivingPathState' in out)out.drivingPathState=cpm.calculationComplete?'independent_cpm_available':'not_established';
  }
  if(key==='pmo-analysis'){
    if(out.schedule&&typeof out.schedule==='object'&&'independentCpmState' in out.schedule)out.schedule={...out.schedule,independentCpmState:cpmState,
      ...('drivingPathState' in out.schedule?{drivingPathState:cpm.calculationComplete?'independent_cpm_available':'not_established'}:{})};
    if(out.forecast&&typeof out.forecast==='object'&&'activityCoveragePercent' in out.forecast)out.forecast={...out.forecast,activityCoveragePercent:cpm.coveragePercent};
  }
  if(key==='independent-forecast'&&out.forecastReconciliationGate&&typeof out.forecastReconciliationGate==='object'){
    // Publication of the CMeng CPM finish follows the one shared rule (the
    // Dashboard's): a held calendar or finish difference also withholds it here.
    const gate=out.forecastReconciliationGate,held=gate.publishable===true&&!cpm.publishable;
    out.forecastReconciliationGate={...gate,publishable:cpm.publishable,state:cpm.publishable?'publishable':'review_required',
      ...(held?{reason:cpm.holdReasons.join(' '),heldBySharedRule:true}:{})};
    out.managementReviewState=cpm.publishable?'accepted_for_analysis':'review_required';
    out.managementReviewReason=cpm.publishable?null:held?cpm.holdReasons.join(' '):out.managementReviewReason??gate.reason??null;
    if(out.forecastTaxonomy?.cmengCpm)out.forecastTaxonomy={...out.forecastTaxonomy,cmengCpm:{...out.forecastTaxonomy.cmengCpm,publishableAsManagementForecast:cpm.publishable}};
  }
  return out as T;
}
