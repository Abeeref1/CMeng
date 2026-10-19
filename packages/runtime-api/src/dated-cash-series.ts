import {canonicalHeader,cell,dateValue,governedTables,norm,numberValue} from '../../truth-kernel/src';
import type {CommercialControlPosition} from '../../commercial-control/src';
import type {CanonicalCommercialModel} from './commercial-canonical';
import {projectControlSchedule} from './canonical-time-claims';
import {refreshResourceSourceFields} from './resource-source-refresh';
import type {ProjectRuntimeState} from './project-state-types';

/** F20/F29: the one shared dated cash series by calendar month.
 * Certified and paid points are the Cash Flow register entries (dated
 * certificates and dated receipts), so every page reads the same records.
 * The forecast is the supplied source cash-flow forecast when one exists.
 * Only when none is supplied is a forecast calculated from the remaining
 * value of work on the programme, and its basis is always stated:
 *  1. cost-loaded programme assignments: remaining cost spread over each
 *     assignment's own remaining dates (P6 linear default; assignments with a
 *     named non-linear curve are not spread and are counted instead);
 *  2. otherwise the programme receipts scenario: remaining contract value
 *     straight-line to the submitted programme finish.
 * Nothing is invented: a missing input leaves the forecast not established
 * with the exact reason. Calculated points never become source records. */
export type DatedCashKind='certified'|'paid'|'forecast';
export type DatedCashForecastBasis='source_cash_flow_forecast'|'programme_cost_loaded_remaining_value'|'programme_remaining_contract_value'|'not_established';
export interface DatedCashPoint{
 date:string;period:string;kind:DatedCashKind;amount:number;currency:string;
 flow:'income'|'expenditure'|'work_value';
 basis:'source_record'|Exclude<DatedCashForecastBasis,'not_established'>;
 state:string;sourceRefs:string[];
}
/** forecastIncome holds income and remaining work value; forecastExpenditure holds source outflow forecasts. They are never netted. */
export interface DatedCashPeriod{period:string;certified:number|null;paid:number|null;forecastIncome:number|null;forecastExpenditure:number|null;sourceRefs:string[]}
export interface DatedCashCurrencySeries{
 currency:string;taxBasis:string;points:DatedCashPoint[];periods:DatedCashPeriod[];
 certifiedToDate:number|null;paidToDate:number|null;latestActualPeriod:string|null;
 forecastBasis:DatedCashForecastBasis;forecastBasisLabel:string;forecastReason:string|null;
 forecastIncomeTotal:number|null;forecastExpenditureTotal:number|null;nextForecastPeriod:string|null;unplacedRemainingValue:number|null;
 currencyBasis:'stated_in_source'|'single_commercial_currency'|null;
}
export interface DatedCashSeries{dataDateIso:string|null;currencies:DatedCashCurrencySeries[];basis:string;diagnostics:string[]}

const FORECAST_EXPENDITURE=['expenditure forecast','cash expenditure forecast','cash forecast','cash flow forecast','forecast cash flow','forecast expenditure','forecast cash out'];
const FORECAST_INCOME=['forecast income','forecast receipts','income forecast','receipts forecast','forecast cash in','forecast certification','forecast certified income'];
const DATE_HEADERS=['period end','period','month','as of','date'];
const BASIS_LABEL:Record<DatedCashForecastBasis,string>={
 source_cash_flow_forecast:'Source cash-flow forecast',
 programme_cost_loaded_remaining_value:'Calculated: remaining cost-loaded programme value over activity dates',
 programme_remaining_contract_value:'Calculated: remaining contract value straight-line to the submitted programme finish',
 not_established:'Not established',
};
const month=(iso:string)=>iso.slice(0,7);
const round=(v:number)=>Math.round(v*100)/100;
const flowOf=(name:string):'income'|'expenditure'|null=>{const n=norm(name);return FORECAST_INCOME.map(norm).includes(n)?'income':FORECAST_EXPENDITURE.map(norm).includes(n)?'expenditure':null;};
const ref=(r:{documentId:string;locator:string})=>'evidence-document:'+r.documentId+':'+r.locator;

function sourceForecastPoints(state:ProjectRuntimeState,ledger:CanonicalCommercialModel|undefined,diagnostics:string[]):DatedCashPoint[]{
 const points:DatedCashPoint[]=[];
 // Long registers (Metric, Value, As Of) are already read once by the commercial ledger.
 for(const m of ledger?.costMetrics??[]){
  const flow=flowOf(m.metric);if(!flow)continue;
  const date=m.amount.asOf?.slice(0,10)??null;
  if(m.amount.value===null||!date){diagnostics.push('SOURCE_CASH_FORECAST_ROW_WITHOUT_VALUE_OR_DATE:'+m.metric);continue;}
  if(!m.amount.currency){diagnostics.push('SOURCE_CASH_FORECAST_ROW_WITHOUT_CURRENCY:'+m.metric+':'+date);continue;}
  points.push({date,period:month(date),kind:'forecast',amount:m.amount.value,currency:m.amount.currency,flow,basis:'source_cash_flow_forecast',state:m.amount.state,sourceRefs:m.amount.receipts.map(ref)});
 }
 // Wide cash-flow forecast registers (a period column and named forecast columns).
 const tables=governedTables(state.evidenceDocuments,[]);
 for(const t of tables){
  const dateHeader=DATE_HEADERS.map(h=>canonicalHeader(h)).find(h=>t.headers.includes(h));
  if(!dateHeader||t.headers.includes(canonicalHeader('metric')))continue;
  // A header names its currency only as a trailing ISO code after a recognised forecast name ("cash forecast qar").
  const columns=t.headers.map(h=>{const direct=flowOf(h);if(direct)return {h,flow:direct,tail:''};const tail=/ ([a-z]{3})$/.exec(h)?.[1]??'';const flow=tail?flowOf(h.slice(0,-4)):null;return {h,flow,tail};})
   .filter((c):c is {h:string;flow:'income'|'expenditure';tail:string}=>c.flow!==null);
  if(!columns.length)continue;
  for(const r of t.rows)for(const c of columns){
   const value=numberValue(cell(r,c.h)),date=dateValue(cell(r,dateHeader));
   if(value===null||!date)continue;
   const currency=(cell(r,'currency')||c.tail).trim().toUpperCase();
   if(!/^[A-Z]{3}$/.test(currency)){diagnostics.push('SOURCE_CASH_FORECAST_ROW_WITHOUT_CURRENCY:'+r.receipt.documentId+':'+r.receipt.locator);continue;}
   points.push({date:date.slice(0,10),period:month(date),kind:'forecast',amount:value,currency,flow:c.flow,basis:'source_cash_flow_forecast',
    state:['active','additive'].includes(r.receipt.basisState)?'official':'candidate',sourceRefs:[ref(r.receipt)]});
  }
 }
 return points;
}

/** Remaining cost of cost-loaded programme assignments, spread by calendar day
 * over each assignment's remaining dates after the Data Date. */
function costLoadedRemaining(state:ProjectRuntimeState,dataDateIso:string){
 const current=projectControlSchedule(state);
 const stored=current?state.resourcesByRevision.get(current.revision.revisionId):undefined;
 const model=stored?refreshResourceSourceFields(state,stored):null;
 const loaded=(model?.assignments??[]).filter(a=>typeof a.remainingCost==='number'&&Number.isFinite(a.remainingCost)&&a.remainingCost>0);
 const byPeriod=new Map<string,{amount:number;refs:Set<string>}>();
 let unplaced=0,unplacedCount=0;
 const dd=Date.parse(dataDateIso.slice(0,10)+'T00:00:00Z');
 for(const a of loaded){
  const start=(a.remainingStartIso??a.plannedStartIso)?.slice(0,10)??null,finish=(a.remainingFinishIso??a.plannedFinishIso)?.slice(0,10)??null;
  const s=start?Date.parse(start+'T00:00:00Z'):NaN,f=finish?Date.parse(finish+'T00:00:00Z'):NaN;
  // A named spread curve is not read, and remaining work dated before the
  // Data Date has no stated future period; neither is placed by assumption.
  if(a.curveId||!Number.isFinite(s)||!Number.isFinite(f)||f<s||f<=dd){unplaced+=a.remainingCost!;unplacedCount++;continue;}
  const from=Math.max(s,dd+86400000),days=(f-from)/86400000+1;
  let cursor=from;
  while(cursor<=f){
   const d=new Date(cursor),end=Math.min(f,Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0));
   const period=new Date(end).toISOString().slice(0,7),share=a.remainingCost!*((end-cursor)/86400000+1)/days;
   const row=byPeriod.get(period)??{amount:0,refs:new Set<string>()};row.amount+=share;
   for(const r of a.sourceRefs??[])row.refs.add(r.source+':'+r.locator);
   row.refs.add('programme-assignment:'+(current?.revision.revisionId??'')+':'+a.assignmentId);byPeriod.set(period,row);
   cursor=end+86400000;
  }
 }
 return {loadedCount:loaded.length,unplaced,unplacedCount,periods:[...byPeriod].sort(([a],[b])=>a.localeCompare(b)).map(([period,row])=>({period,amount:round(row.amount),refs:[...row.refs].slice(0,50)}))};
}

export function buildDatedCashSeries(state:ProjectRuntimeState,position:CommercialControlPosition,dataDateIso:string|null):DatedCashSeries{
 const diagnostics:string[]=[];
 const cash=position.performance?.cashFlow?.currencies??[];
 const source=sourceForecastPoints(state,position.sourceLedger,diagnostics);
 const currencies=[...new Set([...cash.map(c=>c.currency),...source.map(p=>p.currency)])].sort();
 const scenario=position.programmeCashScenario;
 const costLoaded=dataDateIso?costLoadedRemaining(state,dataDateIso):null;
 const singleCurrency=currencies.length===1;
 const out:DatedCashCurrencySeries[]=currencies.map(currency=>{
  const rows=cash.filter(c=>c.currency===currency);
  const points:DatedCashPoint[]=[];
  for(const row of rows)for(const e of row.entries??[]){
   const kind:DatedCashKind|null=e.kind==='certified_income'?'certified':e.kind==='paid_income'?'paid':null;
   if(!kind||e.amount.value===null||!e.periodDate)continue;
   const date=e.periodDate.slice(0,10);
   points.push({date,period:month(date),kind,amount:e.amount.value,currency,flow:'income',basis:'source_record',state:e.amount.state,sourceRefs:[...new Set([...(e.sourceRefs??[]),...(e.amount.basis?.sourceRefs??[])])]});
  }
  const sourceForecast=source.filter(p=>p.currency===currency);
  let forecastBasis:DatedCashForecastBasis='not_established',forecastReason:string|null=null,unplacedRemainingValue:number|null=null;
  let currencyBasis:DatedCashCurrencySeries['currencyBasis']=null;
  if(sourceForecast.length){forecastBasis='source_cash_flow_forecast';currencyBasis='stated_in_source';points.push(...sourceForecast);}
  else if(costLoaded&&costLoaded.loadedCount>0&&costLoaded.periods.length&&singleCurrency){
   forecastBasis='programme_cost_loaded_remaining_value';currencyBasis='single_commercial_currency';
   unplacedRemainingValue=costLoaded.unplaced?round(costLoaded.unplaced):0;
   const firstFuture=new Date(Date.parse(dataDateIso!.slice(0,10)+'T00:00:00Z')+86400000).toISOString().slice(0,10);
   for(const p of costLoaded.periods)points.push({date:p.period===month(firstFuture)?firstFuture:p.period+'-01',period:p.period,kind:'forecast',amount:p.amount,currency,flow:'work_value',basis:'programme_cost_loaded_remaining_value',state:'calculated',sourceRefs:p.refs});
   forecastReason='No source cash-flow forecast is supplied. Remaining cost on '+costLoaded.loadedCount+' cost-loaded programme assignment(s) is spread over their own remaining dates; the programme does not state a cost currency, so the single commercial currency '+currency+' is used.'+(costLoaded.unplacedCount?' '+costLoaded.unplacedCount+' assignment(s) with a named curve or no future dates are not placed.':'');
  }else{
   const group=scenario?.groups?.find(g=>g.currency===currency&&g.rows.length>0);
   if(group){
    forecastBasis='programme_remaining_contract_value';currencyBasis='stated_in_source';
    for(const r of group.rows)points.push({date:r.periodEndIso,period:month(r.periodEndIso),kind:'forecast',amount:r.grossValuation,currency,flow:'work_value',basis:'programme_remaining_contract_value',state:'calculated',sourceRefs:['programme-cash-scenario:'+currency]});
    forecastReason='No source cash-flow forecast or cost-loaded programme is supplied. '+(scenario?.basis??'');
   }else{
    const missing=[...new Set([...(scenario?.missingInputs??[]),...(scenario?.groups?.find(g=>g.currency===currency)?.missingInputs??[])])];
    forecastReason='No source cash-flow forecast is supplied'+(costLoaded&&costLoaded.loadedCount>0&&!singleCurrency?'; cost-loaded programme values exist but the programme states no currency and the project has '+currencies.length+' currencies':costLoaded&&costLoaded.loadedCount===0?'; the programme has no cost-loaded assignments with remaining cost':'')+(missing.length?'; a remaining-value forecast also needs: '+missing.join(', '):'')+'.';
   }
  }
  points.sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind));
  const byPeriod=new Map<string,DatedCashPeriod>();
  for(const p of points){
   const row=byPeriod.get(p.period)??{period:p.period,certified:null,paid:null,forecastIncome:null,forecastExpenditure:null,sourceRefs:[]};
   const key=p.kind==='forecast'?(p.flow==='expenditure'?'forecastExpenditure':'forecastIncome'):p.kind;
   row[key]=round((row[key]??0)+p.amount);
   for(const r of p.sourceRefs)if(!row.sourceRefs.includes(r)&&row.sourceRefs.length<50)row.sourceRefs.push(r);
   byPeriod.set(p.period,row);
  }
  const periods=[...byPeriod.values()].sort((a,b)=>a.period.localeCompare(b.period));
  const sum=(kind:DatedCashKind)=>{const list=points.filter(p=>p.kind===kind&&(!dataDateIso||p.date<=dataDateIso.slice(0,10)));return list.length?round(list.reduce((s,p)=>s+p.amount,0)):null;};
  const actual=points.filter(p=>p.kind!=='forecast').map(p=>p.period).sort();
  const future=points.filter(p=>p.kind==='forecast'&&(!dataDateIso||p.date>dataDateIso.slice(0,10)));
  const total=(list:DatedCashPoint[])=>list.length?round(list.reduce((s,p)=>s+p.amount,0)):null;
  return {currency,taxBasis:rows[0]?.taxBasis??'unknown',points,periods,certifiedToDate:sum('certified'),paidToDate:sum('paid'),latestActualPeriod:actual.at(-1)??null,
   forecastBasis,forecastBasisLabel:BASIS_LABEL[forecastBasis],forecastReason,
   forecastIncomeTotal:total(future.filter(p=>p.flow!=='expenditure')),forecastExpenditureTotal:total(future.filter(p=>p.flow==='expenditure')),
   nextForecastPeriod:future[0]?.period??null,unplacedRemainingValue,currencyBasis};
 });
 return {dataDateIso,currencies:out,diagnostics,
  basis:'Monthly periods. Certified and paid points are the dated Cash Flow register entries; forecast points come from the source cash-flow forecast, or, only when none is supplied, from the remaining programme value with its basis stated. Calculated points are never source records.'};
}
