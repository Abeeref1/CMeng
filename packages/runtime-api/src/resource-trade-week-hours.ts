import {round} from '../../truth-kernel/src';
import type {WeeklyResourceCapacityPoint,WeeklyResourceCapacitySummary} from './canonical-resource-evidence';

/**
 * F16: recorded (actual) hours by trade and week, read from the weekly labour register by
 * the shared canonical resource reader (the same points the Resources page, the Man-hour
 * S-curve and the Look-Ahead use). A trade is one register labour resource stated in hours.
 * A week on or before the Data Date with no recorded value is "not recorded", never 0;
 * recorded weeks are still shown and summed, with the count of weeks that have no value,
 * so one blank week no longer hides every recorded hour.
 */
export const TRADE_WEEKS_SHOWN=8;
const HOUR_UNIT=/^(?:(?:labou?r|man|equipment)[ _-]?)?(?:h|hr|hrs|hour|hours|manhours?|man[ _-]?hours?|mh)$/i;
export function registerHourUnit(unit:string|null|undefined):boolean{return HOUR_UNIT.test(String(unit??'').trim());}
export interface TradeWeekRow{weekStartIso:string;plannedHours:number|null;recordedHours:number|null}
export interface TradeWeekHoursTrade{
  resourceId:string;resourceName:string|null;unit:string|null;
  weekCountToDataDate:number;recordedWeekCount:number;notRecordedWeekCount:number;
  /** Sum of the recorded weeks on or before the Data Date (not the full actual when some weeks are not recorded). */
  recordedHours:number|null;
  plannedHoursToDataDate:number|null;
  latestRecorded:{weekStartIso:string;hours:number;sourceRef:string}|null;
  notRecordedWeekStarts:string[];
  weeks:TradeWeekRow[];
  reason:string|null;
}
export interface TradeWeekHours{
  state:'established'|'partial'|'not_recorded'|'not_established';
  dataDateIso:string|null;basis:string;shownWeekStarts:string[];trades:TradeWeekHoursTrade[];
  resourceWeekCountToDataDate:number;recordedResourceWeekCount:number;notRecordedResourceWeekCount:number;
  recordedHours:number|null;latestRecordedWeekIso:string|null;reason:string|null;
}
const BASIS='Weekly labour register read by the shared resource reader: one row per trade (register labour resource stated in hours) and week. Recorded hours are the register actual column (Actual Approved Usage, Actual Hours, Actual Man-hours or Recorded Hours) for weeks starting on or before the Data Date. A week with no value is not recorded, never 0.';
const cache=new WeakMap<WeeklyResourceCapacitySummary,TradeWeekHours>();
export function recordedHoursByTradeWeek(summary:WeeklyResourceCapacitySummary):TradeWeekHours{
  const hit=cache.get(summary);if(hit)return hit;
  const value=calculate(summary);cache.set(summary,value);return value;
}
function calculate(summary:WeeklyResourceCapacitySummary):TradeWeekHours{
  const cutoff=summary.dataDateIso;
  const empty=(state:TradeWeekHours['state'],reason:string):TradeWeekHours=>({state,dataDateIso:cutoff,basis:BASIS,shownWeekStarts:[],trades:[],
    resourceWeekCountToDataDate:0,recordedResourceWeekCount:0,notRecordedResourceWeekCount:0,recordedHours:null,latestRecordedWeekIso:null,reason});
  const labour=summary.points.filter(p=>p.resourceClass==='labor'&&p.weekStartIso!==null&&registerHourUnit(p.unit));
  if(!labour.length)return empty('not_established',summary.points.length?'The resource register has no labour rows stated in hours.':'No weekly resource register is read.');
  if(!cutoff)return empty('not_established','The Data Date is not established, so recorded hours to date cannot be placed.');
  const toDate=labour.filter(p=>p.weekStartIso!<=cutoff);
  const shownWeekStarts=[...new Set(toDate.map(p=>p.weekStartIso!))].sort().slice(-TRADE_WEEKS_SHOWN);
  const byTrade=new Map<string,WeeklyResourceCapacityPoint[]>();
  for(const p of labour){const k=JSON.stringify([p.resourceId,p.unit]);const list=byTrade.get(k)??[];list.push(p);byTrade.set(k,list);}
  const trades=[...byTrade.values()].map(points=>{
    const dated=points.filter(p=>p.weekStartIso!<=cutoff).sort((a,b)=>a.weekStartIso!.localeCompare(b.weekStartIso!));
    const recorded=dated.filter(p=>p.actualApprovedUsage!==null),missing=dated.filter(p=>p.actualApprovedUsage===null);
    const last=recorded.at(-1);
    return {resourceId:points[0]!.resourceId,resourceName:points[0]!.resourceName,unit:points[0]!.unit,
      weekCountToDataDate:dated.length,recordedWeekCount:recorded.length,notRecordedWeekCount:missing.length,
      recordedHours:recorded.length?round(recorded.reduce((n,p)=>n+p.actualApprovedUsage!,0)):null,
      plannedHoursToDataDate:dated.length&&dated.every(p=>p.plannedDemand!==null)?round(dated.reduce((n,p)=>n+p.plannedDemand!,0)):null,
      latestRecorded:last?{weekStartIso:last.weekStartIso!,hours:last.actualApprovedUsage!,sourceRef:last.sourceRef}:null,
      notRecordedWeekStarts:missing.map(p=>p.weekStartIso!).slice(-TRADE_WEEKS_SHOWN),
      weeks:dated.slice(-TRADE_WEEKS_SHOWN).map(p=>({weekStartIso:p.weekStartIso!,plannedHours:p.plannedDemand,recordedHours:p.actualApprovedUsage})),
      reason:!dated.length?'The register has no week for this trade on or before the Data Date.':
        !recorded.length?'No recorded hours for this trade on or before the Data Date.':
        missing.length?missing.length+' week(s) on or before the Data Date have no recorded value.':null};
  }).sort((a,b)=>(a.resourceName??a.resourceId).localeCompare(b.resourceName??b.resourceId)||a.resourceId.localeCompare(b.resourceId));
  const recordedCount=trades.reduce((n,t)=>n+t.recordedWeekCount,0),total=trades.reduce((n,t)=>n+t.weekCountToDataDate,0);
  const latest=trades.map(t=>t.latestRecorded?.weekStartIso).filter((v):v is string=>Boolean(v)).sort().at(-1)??null;
  const state:TradeWeekHours['state']=!total?'not_established':!recordedCount?'not_recorded':recordedCount===total?'established':'partial';
  return {state,dataDateIso:cutoff,basis:BASIS,shownWeekStarts,trades,
    resourceWeekCountToDataDate:total,recordedResourceWeekCount:recordedCount,notRecordedResourceWeekCount:total-recordedCount,
    recordedHours:recordedCount?round(trades.reduce((n,t)=>n+(t.recordedHours??0),0)):null,latestRecordedWeekIso:latest,
    reason:state==='established'?null:state==='not_established'?'The register has no labour week on or before the Data Date.':
      state==='not_recorded'?'The register states no recorded hours on or before the Data Date.':
      'Recorded hours are stated for '+recordedCount+' of '+total+' labour resource-weeks on or before the Data Date. The other '+(total-recordedCount)+' are not recorded (shown as not recorded, never 0), so the recorded total is not the full actual to date.'};
}
