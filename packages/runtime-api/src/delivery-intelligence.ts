import {canonicalHeader,numberValue,registerDate,sumKnown} from '../../truth-kernel/src';
import type {DeliveryRecord} from '../../delivery-core/src/types';

const value=(r:DeliveryRecord,key:string)=>String(r.fields[canonicalHeader(key)]??'').trim();
const number=(r:DeliveryRecord,key:string)=>numberValue(value(r,key));
const date=(r:DeliveryRecord,key:string)=>registerDate(value(r,key));

/** Exposure periods and incidents are separate populations. Aggregate reports
 * may carry both, but mixing reports and incident rows would double count. */
export function deliveryHsePosition(records:DeliveryRecord[],cutoff:string|null,complete:boolean){
 const rows=records.map(r=>({recordId:r.recordId,type:value(r,'type').toLowerCase(),scope:value(r,'exposure scope'),
  from:date(r,'period start'),to:date(r,'period end'),when:date(r,'report date')??date(r,'incident date')??date(r,'status as of'),
  hours:number(r,'man hours'),injuries:number(r,'lost time injuries'),factor:number(r,'frequency rate basis'),receipts:r.receipts}));
 const current=rows.filter(r=>cutoff&&r.when&&r.when<=cutoff&&(!r.to||r.to<=cutoff));
 const exposures=current.filter(r=>['exposure','exposure report','aggregate report'].includes(r.type));
 const incidents=current.filter(r=>r.type==='incident');
 const aggregates=exposures.filter(r=>r.type==='aggregate report');
 const diagnostics:string[]=[];
 if(current.some(r=>!['exposure','exposure report','aggregate report','incident','near miss','inspection','audit','training','competency','ptw','toolbox talk','emergency drill','corrective action'].includes(r.type)))diagnostics.push('Classify all current HSE rows before establishing the rate population.');
 if(!complete)diagnostics.push('Applicable HSE population is not confirmed.');
 if(rows.some(r=>!r.when))diagnostics.push('Some HSE records have no reporting date.');
 if(!exposures.length)diagnostics.push('No governed exposure periods.');
 if(exposures.some(r=>!r.from||!r.to||r.from>r.to||!r.scope||r.hours===null||r.hours<0))diagnostics.push('Every exposure period needs ordered start/end dates, a non-overlapping scope and non-negative hours.');
 const sorted=[...exposures].sort((a,b)=>a.scope.localeCompare(b.scope)||(a.from??'').localeCompare(b.from??''));
 const ends=new Map<string,string>();for(const r of sorted)if(r.from&&r.to){if((ends.get(r.scope)??'')>=r.from)diagnostics.push('Overlapping exposure periods in scope '+r.scope+'.');ends.set(r.scope,(ends.get(r.scope)??'')>r.to?ends.get(r.scope)!:r.to);}
 if(aggregates.length&&incidents.length)diagnostics.push('Aggregate injuries and individual incidents cannot be added together.');
 if(aggregates.length&&aggregates.length!==exposures.length)diagnostics.push('Aggregate report and exposure-only scopes require a single injury basis.');
 const injuryRows=aggregates.length?aggregates:incidents;
 if(incidents.some(r=>!r.scope||!r.when||!exposures.some(e=>e.scope===r.scope&&e.from&&e.to&&r.when!>=e.from&&r.when!<=e.to)))diagnostics.push('An incident is outside the established exposure scopes/periods.');
 const factors=[...new Set(exposures.map(r=>r.factor))];const factor=factors.length===1?factors[0]!:null;
 const hours=sumKnown(exposures.map(r=>r.hours));
 const injuries=injuryRows.length?sumKnown(injuryRows.map(r=>r.injuries)):complete&&exposures.length&&!aggregates.length?0:null;
 if(injuries===null||injuries<0)diagnostics.push('Lost-time injury population or counts are unresolved.');
 if(factor===null||factor<=0)diagnostics.push('Frequency-rate basis is unresolved or inconsistent.');
 const rate=diagnostics.length===0&&hours!==null&&hours>0&&injuries!==null&&factor!==null?Number((injuries/hours*factor).toFixed(4)):null;
 return {exposureHours:hours,lostTimeInjuries:injuries,rateBasis:factor,frequencyRate:rate,rows,
  includedRecordIds:current.map(r=>r.recordId),excludedRecordIds:rows.filter(r=>!current.includes(r)).map(r=>r.recordId),diagnostics:[...new Set(diagnostics)],
  explanation:'Rate uses confirmed, dated exposure periods and a matching incident population. Direct source facts remain in the register. '+[...new Set(diagnostics)].join(' ')};
}

export function deliveryEvidenceMetrics(records:DeliveryRecord[],cutoff:string|null){
 const eligible=records.filter(r=>{const when=date(r,'raised date')??date(r,'actual date')??date(r,'status as of');return !!when&&!!cutoff&&when<=cutoff;});
 const byCurrency=[...new Set(eligible.map(r=>value(r,'currency')).filter(Boolean))].map(currency=>{const rows=eligible.filter(r=>value(r,'currency')===currency);return {currency,reworkCost:sumKnown(rows.map(r=>number(r,'rework cost'))),knownCostRecordCount:rows.filter(r=>number(r,'rework cost')!==null).length,recordIds:rows.map(r=>r.recordId)};});
 return {reworkHours:sumKnown(eligible.map(r=>number(r,'rework hours'))),reworkCostByCurrency:byCurrency,
  unknownCostRecordIds:eligible.filter(r=>number(r,'rework cost')===null||!value(r,'currency')).map(r=>r.recordId),
  evidenceRecordCount:eligible.filter(r=>r.receipts.length>0).length,knownCurrentRecordCount:eligible.length,
  evidenceCoveragePercent:eligible.length?Number((eligible.filter(r=>r.receipts.length>0).length/eligible.length*100).toFixed(4)):null};
}
