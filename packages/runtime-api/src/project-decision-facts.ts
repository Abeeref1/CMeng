import {floatHoursToWorkingDays,sourceCalendarWorkingDays} from './activity-float-reconciliation';
import {contractNoticeRules} from './contract-notice-rules';
import {detailedClaimDeadline} from './detailed-claim-time-bar';
import type {NoticeRequirement} from '../../delay-analysis-core/src';
import {cell,dateValue,numberValue,governedTables,type SourceRow} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {commercialPositionForState} from './commercial-runtime';
import {resolveBoqSource} from './boq-source';
import {withInstalledMeasurements} from './installed-measurements';
import {boqProgrammeLinks} from './boq-programme-links';
import {deliveryRecords,deliveryCurrentRecord} from './delivery-records';
import {canonicalHeader} from '../../truth-kernel/src';
import {assignScope,reconcileScope,type ScopeAssignment} from './boq-scope-mapping';
import {projectScopeClassification} from './location-review';

/** Management decisions derived once per source version. Screens and exports
 * consume these same results; no renderer reconstructs an engineering answer. */
export interface DecisionMetric {
 value:number|null; state:'value'|'not_in_source'|'not_calculable'|'records_disagree';
 unit:string; basis:string; missingInputs:string[]; sourceRefs:string[];
}
const finite=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const valueOf=(v:any):number|null=>finite(v&&typeof v==='object'?v.value:v);
const norm=(v:unknown)=>String(v??'').normalize('NFKC').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const date=(v:unknown)=>dateValue(String(v??''));
const days=(a:string|null,b:string|null)=>a&&b?(Date.parse(b.slice(0,10))-Date.parse(a.slice(0,10)))/86400000:null;
const rowRefs=(r:SourceRow)=>['evidence-document:'+r.receipt.documentId+':'+r.receipt.locator];
const metric=(v:number|null,unit:string,basis:string,missing:string[]=[],refs:string[]=[]):DecisionMetric=>({value:v,state:v===null?(missing.length?'not_in_source':'not_calculable'):'value',unit,basis,missingInputs:v===null?missing:[],sourceRefs:[...new Set(refs)]});
const plusDays=(d:string,n:number):string|null=>{
 const base=Date.parse(d.slice(0,10)),instant=base+n*86400000;
 return Number.isFinite(base)&&Number.isFinite(n)&&Number.isFinite(instant)&&
   !Number.isNaN(new Date(instant).getTime())?new Date(instant).toISOString().slice(0,10):null;
};
function monthDate(input:string,offset:number){const d=new Date(input.slice(0,10)+'T00:00:00Z'),day=d.getUTCDate(),wasMonthEnd=day===new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+offset);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(wasMonthEnd?last:Math.min(day,last));return d.toISOString().slice(0,10);}
function elapsedMonths(from:string,to:string){const a=new Date(from),b=new Date(to);let whole=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();if(monthDate(from,whole)>to)whole--;const start=monthDate(from,whole),end=monthDate(from,whole+1);return whole+(days(start,to)??0)/(days(start,end)??1);}
function afterMonths(from:string,n:number){if(!Number.isFinite(n)||n<0||n>1200)return null;const whole=Math.floor(n),start=monthDate(from,whole),end=monthDate(from,whole+1);return plusDays(start,(days(start,end)??0)*(n-whole));}
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof buildDecisionFacts>}>();

export function projectDecisionFacts(state:ProjectRuntimeState){const old=cache.get(state);if(old?.version===state.version)return old.value;const value=buildDecisionFacts(state);cache.set(state,{version:state.version,value});return value;}
function buildDecisionFacts(state:ProjectRuntimeState){
 const current=projectControlSchedule(state),model=current?.revision.model??null,cutoff=date(projectDataDate(state));
 // Expensive engineering families are lazy and cached independently. A dashboard
 // never recomputes measurements, programme-history rows or claim tables merely
 // to read three commercial facts or a completion constraint.
 const memo=new Map<string,unknown>();
 const once=<T>(key:string,build:()=>T):T=>{if(!memo.has(key))memo.set(key,build());return memo.get(key) as T;};
 const commercial=()=>once('commercial',()=>commercialPositionForState(state) as any);
 const sourceRows=()=>once('sourceRows',()=>governedTables(state.evidenceDocuments??[],[]).flatMap(t=>t.rows).filter(r=>{const d=date(cell(r,'as of','data date','reporting date','measurement date','period end'));return !d||!cutoff||d<=cutoff;}));
 const linkage=()=>once('links',()=>model?boqProgrammeLinks(state,model):null);
 const quantities=()=>once('quantities',()=>buildMeasuredPerformance(state,model,cutoff,sourceRows(),commercial(),linkage()));
 return {schemaVersion:'1.0',projectId:state.projectId,projectVersion:state.version,dataDateIso:cutoff,
  get commercialSummary(){return once('summary',()=>buildCommercialSummary(commercial()));},
  get completionConstraints(){return once('completion',()=>buildCompletionConstraints(model));},
  get negativeFloatConstraint(){return once('negativeFloatConstraint',()=>buildNegativeFloatConstraint(model));},
  get boqLinkage(){return linkage();},
  get quantities(){return quantities();},
  get trends(){return once('trends',()=>buildProgrammeTrends(state,model,cutoff));},
  get claimChecks(){return once('claims',()=>buildClaimChecks(sourceRows(),cutoff,contractNoticeRules(state,'detailed_claim')));},
  get paymentChecks(){return once('paymentChecks',()=>buildPaymentChecks(commercial(),cutoff));},
  get monthlyEvm(){return once('evm',()=>buildMonthlyEvm(commercial(),cutoff));},
  get registerValueChecks(){return once('registerChecks',()=>buildRegisterChecks(commercial(),commercial().sourceLedger??{},quantities(),procurementSourceTotals(state)));},
  sourceBasis:'Retained dated source records and current programme. Calculated planning scenarios do not adopt sources, establish contractual entitlement or infer absent inputs.'};
}
function buildMonthlyEvm(commercial:any,cutoff:string|null){
 return (commercial.performance?.evmPerformance?.series??[]).map((s:any)=>{
  const months=new Map<string,any>();
  for(const p of s.points??[]){const d=date(p.asOf);if(!d||(cutoff&&d>cutoff))continue;const prior=months.get(d.slice(0,7));if(!prior||String(date(prior.asOf))<=d)months.set(d.slice(0,7),p);}
  return {currency:s.currency,taxBasis:s.taxBasis,points:[...months.values()].sort((a,b)=>String(a.asOf).localeCompare(String(b.asOf))).map(p=>({dateIso:date(p.asOf),pv:valueOf(p.pv??p.plannedValue),ev:valueOf(p.ev??p.earnedValue),ac:valueOf(p.ac??p.actualCost),cpi:valueOf(p.cpi),spi:valueOf(p.spi)})),sourceRefs:s.sourceRefs??[],basis:'Latest dated cumulative planned value, earned value and actual cost in each source month; currencies and tax bases remain separate. No missing value becomes zero.'};
 });
}

function buildCommercialSummary(commercial:any){
 const positions=commercial.performance?.costControl?.positions??[],sources=commercial.costBasisReview??[],currencies=commercial.currencies??[];
 const keys=[...new Set([...positions,...sources,...currencies].map((r:any)=>JSON.stringify([r.currency,r.taxBasis??null])))];
 const out:any[]=[];
 for(const key of keys){const [currency,taxBasis]=JSON.parse(key);if(!currency)continue;
  // Currency-only contract aggregates must not duplicate a known tax-specific cost position.
  if(taxBasis===null&&keys.some(k=>{const[x,t]=JSON.parse(k);return x===currency&&t!==null;}))continue;
  const p=positions.filter((r:any)=>r.currency===currency&&(taxBasis===null||r.taxBasis===taxBasis)).sort((a:any,b:any)=>String(a.asOf).localeCompare(String(b.asOf))).at(-1);
  const s=sources.filter((r:any)=>r.currency===currency&&(taxBasis===null||r.taxBasis===taxBasis)).sort((a:any,b:any)=>String(a.asOf).localeCompare(String(b.asOf))).at(-1);
  const c=currencies.find((r:any)=>r.currency===currency)??{};
  const eac=valueOf(p?.sourceEac)??valueOf(s?.sourceEac),cpi=valueOf(p?.cpi)??valueOf(s?.cpi);
  const refs=p?.sourceRefs??s?.sourceRefs??[];
  const rawUnpaid=c.certifiedUnpaidAmount;
  out.push({currency,taxBasis,asOf:p?.asOf??s?.asOf??commercial.sourceLedger?.dataDateIso??commercial.dataDateIso??null,
   currentContractValue:c.currentContractValue??metric(null,currency,'Current contract value',['Current contract value in '+currency]),
   forecastEac:p?.sourceEac?.value!=null?p.sourceEac:metric(eac,currency,'Latest source-reported estimate at completion in this currency and tax basis',['Source-reported EAC'],refs),
   cpi:p?.cpi?.value!=null?p.cpi:metric(cpi,'ratio','Earned value divided by actual cost in the same period, currency and tax basis',['Comparable earned value and actual cost'],refs),
   certifiedUnpaidAmount:rawUnpaid??metric(null,currency,'Issued certification less linked cash through the Data Date',['Dated issued certificates and allocated cash']),
   eacScenarios:(p?.eacScenarios??[]).filter((r:any)=>valueOf(r.value)!==null),
   sourceRefs:refs});
 }
 return out;
}

function buildCompletionConstraints(model:any){
 if(!model)return [];
 const activities=model.activities??[],outgoing=new Set((model.relationships??[]).filter((r:any)=>!r.external).map((r:any)=>r.predecessorActivityId));
 const terminal=activities.filter((a:any)=>!outgoing.has(a.activityId)&&a.status!=='completed');
 let finish:string|null=null;for(const a of terminal.length?terminal:activities){const d=date(a.forecastFinishIso??a.currentFinishIso);if(d&&(!finish||d>finish))finish=d;}
 const named=activities.filter((a:any)=>['milestone','finish_milestone','start_milestone'].includes(a.activityType)&&/completion|handover|taking.?over|finish.*project|project.*finish|final.*milestone/i.test(a.name??''));
 const latest=activities.filter((a:any)=>date(a.forecastFinishIso??a.currentFinishIso)===finish&&(!outgoing.has(a.activityId)||['milestone','finish_milestone'].includes(a.activityType)));
 const candidates=[...new Map([...named,...latest].map((a:any)=>[a.activityId,a])).values()];
 const labels:Record<string,string>={CS_MSO:'Start on',CS_MEO:'Finish on',CS_MEOB:'Finish on or before',CS_MEOA:'Finish on or after',CS_MANDSTART:'Mandatory start',CS_MANDFIN:'Mandatory finish',CS_MSOA:'Start on or after',CS_MSOB:'Start on or before',CS_ALAP:'As late as possible'};
 return candidates.flatMap((a:any)=>(a.sourceConstraints??[]).map((c:any)=>({activityReference:a.activityId,activityName:a.name,type:c.type,typeLabel:labels[c.type]??String(c.type??'Constraint').replaceAll('_',' '),dateIso:date(c.dateIso),basis:'Explicit constraint on a named or terminal completion activity in the current submitted programme; not a contract amendment'})));
}

// F33: name the submitted constraint that sets the programme's most negative
// float. A late-date constraint sets its own activity's late date, so the
// constrained activity carries the lowest float of the chain it governs. Only an
// explicit source constraint on an unfinished activity at that lowest float is
// named; otherwise the source is stated as not identifying it (never invented).
const LATE_DATE_CONSTRAINTS=new Set(['CS_MEO','CS_MEOB','CS_MANDFIN','CS_MSO','CS_MSOB','CS_MANDSTART']);
export function buildNegativeFloatConstraint(model:any){
 if(!model)return null;
 const open=(model.activities??[]).filter((a:any)=>a.status!=='completed'&&!['level_of_effort','wbs_summary'].includes(a.activityType)&&finite(a.totalFloatHours)!==null);
 if(!open.length)return null;
 const lowest=Math.min(...open.map((a:any)=>a.totalFloatHours as number));
 if(!(lowest<0))return null;
 const labels:Record<string,string>={CS_MSO:'Start on',CS_MEO:'Finish on',CS_MEOB:'Finish on or before',CS_MANDSTART:'Mandatory start',CS_MANDFIN:'Mandatory finish',CS_MSOB:'Start on or before'};
 const constraints=open.filter((a:any)=>a.totalFloatHours===lowest).flatMap((a:any)=>(a.sourceConstraints??[]).filter((c:any)=>LATE_DATE_CONSTRAINTS.has(c.type)).map((c:any)=>({activityReference:a.activityId,activityName:a.name??null,type:c.type,typeLabel:labels[c.type]!,dateIso:date(c.dateIso)})));
 return {lowestFloatHours:lowest,activityCountAtLowestFloat:open.filter((a:any)=>a.totalFloatHours===lowest).length,constraints,
  state:constraints.length?'named':'not_identified_in_source',
  basis:'Lowest total float among unfinished activities in the current submitted programme, and the explicit late-date constraint on an activity at that float. Submitted float in hours; not a contract amendment.'};
}

function buildProgrammeTrends(state:ProjectRuntimeState,model:any,cutoff:string|null){
 if(!model||!cutoff)return {rows:[],slipRate:metric(null,'days/month','Finish movement per elapsed calendar month',['Current and previous dated programme']),comparisonDateIso:null};
 const previous=state.schedules.filter(s=>s.role!=='scenario'&&s.revision.model!==model&&date(s.revision.model.dataDateIso)!==null&&date(s.revision.model.dataDateIso)!<cutoff).sort((a,b)=>String(a.revision.model.dataDateIso).localeCompare(String(b.revision.model.dataDateIso))).at(-1);
 const prior=previous?.revision.model,from=date(prior?.dataDateIso),months=from?elapsedMonths(from,cutoff):null;
 const index=new Map(prior?.activities.map(a=>[a.activityId,a])??[]);
 const riskRows=(model.activities??[]).filter((a:any)=>a.status!=='completed'&&!['level_of_effort','wbs_summary'].includes(a.activityType)).map((a:any)=>{
  const p=index.get(a.activityId),currentFloat=finite(a.totalFloatHours),priorFloat=finite(p?.totalFloatHours);
  const erosion=currentFloat!==null&&priorFloat!==null&&months!==null&&months>0?(priorFloat-currentFloat)/months:null;
  const turnsCriticalBy=currentFloat!==null&&currentFloat<=0?cutoff:currentFloat!==null&&erosion!==null&&erosion>0?afterMonths(cutoff,currentFloat/erosion):null;
  const movement=days(date(p?.forecastFinishIso??p?.currentFinishIso),date(a.forecastFinishIso??a.currentFinishIso));
  // T06: each float in working days of its own revision's source calendar.
  const currentDayHours=sourceCalendarWorkingDays(model).workingDayHours(a.calendarId??null);
  const priorDayHours=p&&prior?sourceCalendarWorkingDays(prior).workingDayHours(p.calendarId??null):null;
  return {activityReference:a.activityId,name:a.name,wbsId:a.wbsId,currentFloatHours:currentFloat,previousFloatHours:priorFloat,
   currentFloatWorkingDays:floatHoursToWorkingDays(currentFloat,currentDayHours),previousFloatWorkingDays:floatHoursToWorkingDays(priorFloat,priorDayHours),floatErosionHoursPerMonth:erosion,turnsCriticalByIso:turnsCriticalBy,
   slipDaysPerMonth:movement!==null&&months!==null&&months>0?movement/months:null,
   state:currentFloat!==null&&currentFloat<=0?'already_critical':erosion===null?'comparison_missing':erosion<=0?'no_positive_erosion':'erosion_scenario',
   basis:'Same activity in two dated programme revisions. Monthly erosion = previous float minus current float / elapsed calendar months. Critical-date scenario = Data Date + current float / positive monthly erosion; trend is assumed to continue, not a forecast guarantee.'};
 });
 const latestFinish=(xs:any[])=>{let last:string|null=null;for(const a of xs){const d=date(a.forecastFinishIso??a.currentFinishIso);if(d&&(!last||d>last))last=d;}return last;};
 const finishMovement=prior?days(latestFinish(prior.activities),latestFinish(model.activities)):null;
 return {rows:riskRows,comparisonDateIso:from,comparisonRevisionId:previous?.revision.revisionId??null,elapsedMonths:months,
  slipRate:metric(finishMovement!==null&&months!==null&&months>0?finishMovement/months:null,'days/month','Latest submitted programme finish movement / elapsed calendar months. Positive means slippage.',['Two comparable dated programme revisions']),
  population:riskRows.length,projectedCriticalCount:riskRows.filter((r:any)=>r.state==='erosion_scenario').length};
}

function certifiedValueFromRows(rows:SourceRow[],cutoff:string|null,itemCurrency:string|null){
 const entries=new Map<string,{amount:number;date:string;basis:'incremental'|'cumulative'|'unknown';sourceRefs:string[]}>();let conflicted=false;
 for(const r of rows){
  const number=cell(r,'certificate no','certificate number','ipc'),d=date(cell(r,'certification date','certificate date'));
  const amount=numberValue(cell(r,'certified value','certified amount','gross certified','gross certified amount'));
  const status=norm(cell(r,'status','certificate status','source status')),sourceCurrency=cell(r,'currency');
  if(!number||!d||amount===null||(cutoff&&d>cutoff)||/applied|application|draft|submitted/.test(status))continue;
  if(sourceCurrency&&itemCurrency&&norm(sourceCurrency)!==norm(itemCurrency))continue;
  const raw=norm(cell(r,'certified amount basis','amount basis','series basis','basis'));
  const basis:'incremental'|'cumulative'|'unknown'=/cumulative|to date|to-date/.test(raw)?'cumulative':/incremental|period|this month|this certificate/.test(raw)?'incremental':'unknown';
  const key=norm(number)+'|'+d,prior=entries.get(key),sourceRefs=rowRefs(r);
  if(prior&&(prior.amount!==amount||prior.basis!==basis)){conflicted=true;continue;}
  if(prior)prior.sourceRefs.push(...sourceRefs);else entries.set(key,{amount,date:d,basis,sourceRefs:[...sourceRefs]});
 }
 const values=[...entries.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(conflicted||!values.length)return {value:null as number|null,sourceRefs:values.flatMap(v=>v.sourceRefs),state:conflicted?'records_disagree':'not_in_source'};
 if(values.length===1)return {value:values[0]!.amount,sourceRefs:values[0]!.sourceRefs,state:'value'};
 const bases=new Set(values.map(v=>v.basis));
 const value=bases.size===1&&bases.has('incremental')?values.reduce((sum,v)=>sum+v.amount,0):
  bases.size===1&&bases.has('cumulative')?values.at(-1)!.amount:null;
 return {value,sourceRefs:values.flatMap(v=>v.sourceRefs),state:value===null?'not_calculable':'value'};
}

function buildMeasuredPerformance(state:ProjectRuntimeState,model:any,cutoff:string|null,rows:SourceRow[],commercial:any,links:any){
 const source=resolveBoqSource(state,model?.sourceRevisionId??''),q=withInstalledMeasurements(state,source.quantities,cutoff);
 const priced=new Map((source.boq?.canonicalItems??[]).map(r=>[r.itemId,r]));
 const snapshots=new Map<string,any[]>();for(const s of q?.installedSnapshots??[]){const d=date(s.asOfIso);if(!d||!cutoff||d>cutoff)continue;const a=snapshots.get(s.quantityItemId)??[];a.push(s);snapshots.set(s.quantityItemId,a);}
 const sourceByNumber=new Map<string,SourceRow[]>();for(const r of rows){const k=norm(cell(r,'item no','item number','boq item','boq item number'));if(k)sourceByNumber.set(k,[...(sourceByNumber.get(k)??[]),r]);}
 const modelById=new Map((model?.activities??[]).map((a:any)=>[a.activityId,a]));
 const linksByItem=new Map((links?.rows??[]).map((r:any)=>[r.itemId,r]));
 const numberCounts=new Map<string,number>();for(const item of q?.items??[]){const key=norm(item.itemNumber);numberCounts.set(key,(numberCounts.get(key)??0)+1);}
 // F21: the programme's own areas (activity code, WBS level or reviewed
 // location; never a name match) for activities linked to a BOQ item, and
 // the programme area / WBS names a BOQ section can match exactly.
 const classification=model?.activities?projectScopeClassification(state,model):null;
 const programmeArea=new Map<string,string>();
 for(const row of classification?.rows??[])if(row.locationGroup&&row.locationGroupBasis&&row.locationGroupBasis!=='name_match')programmeArea.set(row.activityId,row.locationGroup);
 const programmeNames=new Map<string,string[]>();
 for(const name of [...programmeArea.values(),...(model?.wbs??[]).map((w:any)=>w.name)])if(name){const k=norm(name);if(k&&!(programmeNames.get(k)??[]).includes(name))programmeNames.set(k,[...(programmeNames.get(k)??[]),name]);}
 const areaAssignments=new Map<string,ScopeAssignment>();
 const items=(q?.items??[]).map(item=>{
  const xs=(snapshots.get(item.quantityItemId)??[]).sort((a,b)=>String(a.asOfIso).localeCompare(String(b.asOfIso)));
  const now=xs.at(-1),prior=xs.filter(s=>date(s.asOfIso)!<date(now?.asOfIso)!).at(-1);
  const installed=finite(now?.installedQuantity),before=finite(prior?.installedQuantity),contract=finite(item.contractQuantity),price=priced.get(item.quantityItemId);
  const rate=finite(price?.rate),currency=price?.currency??null;
  // Use the admissible source amount, including an explicit zero. Multiplying
  // rounded quantities and rates can disagree with the BOQ's stated value.
  // resolveBoqSource has already withheld unconfirmed numeric readings.
  const sourceAmount=finite(price?.amount);
  const calculatedAmount=contract!==null&&rate!==null?finite(contract*rate):null;
  const contractValue=sourceAmount??calculatedAmount;
  const contractValueBasis=sourceAmount!==null?'Source BOQ amount':calculatedAmount!==null?'Calculated from BOQ quantity × rate; source amount not supplied':'Priced scope not established';
  const period=installed!==null&&before!==null?installed-before:null,periodDays=days(date(prior?.asOfIso),date(now?.asOfIso));
  const linked=(linksByItem.get(item.quantityItemId) as any)?.activityIds??[];
  let target:string|null=null;for(const id of linked){const a=modelById.get(id) as any;const d=date(a?.forecastFinishIso??a?.currentFinishIso);if(d&&(!target||d>target))target=d;}
  const remainingDays=days(cutoff,target),remaining=contract!==null&&installed!==null?Math.max(0,contract-installed):null;
  const matches=sourceByNumber.get(norm(item.itemNumber))??[];
  const sameNumberItemCount=numberCounts.get(norm(item.itemNumber))??0;
  const sourceRows=matches.filter(r=>{
   const section=cell(r,'section','boq section','trade section'),unit=cell(r,'unit','uom');
   if(unit&&item.unit&&norm(unit)!==norm(item.unit))return false;
   if(section)return norm(section)===norm(item.section);
   return sameNumberItemCount===1;
  });
  const candidateRates=[...new Set(sourceRows.map(r=>numberValue(cell(r,'labor hours per unit','labour hours per unit','man hours per unit'))).filter((v):v is number=>v!==null&&v>=0))];
  const hpu=candidateRates.length===1?candidateRates[0]!:null;
  const periodActuals=sourceRows.filter(r=>date(cell(r,'period end','measurement date','as of'))===date(now?.asOfIso)&&(!prior||date(cell(r,'period start','from date'))===date(prior.asOfIso)));
  const actualHs=periodActuals.map(r=>numberValue(cell(r,'actual labor hours','actual labour hours','actual man hours','actual hours'))).filter((v):v is number=>v!==null);
  const actualHours=actualHs.length===1?actualHs[0]!:null;
  // F21 shared area rule: the item's own area/zone/plot reference first, then
  // the programme area of its linked activities, then a BOQ section equal to
  // exactly one programme area or WBS name. Several candidates stay unmapped
  // with the candidates listed; a section is never itself taken as an area.
  const areaAssignment=assignScope({values:sourceRows.map(r=>cell(r,'plot','area','zone','location','workfront','plot code','area code','zone code','location code')),basis:'Explicit measurement/BOQ area'},[
   {values:linked.map((id:string)=>programmeArea.get(id)),basis:'Programme area of the BOQ item\'s linked activities'},
   {values:programmeNames.get(norm(item.section))??[],basis:'BOQ section equals one programme area or WBS name'}]);
  areaAssignments.set(item.quantityItemId,areaAssignment);
  const area=areaAssignment.group;
  const installedValue=installed!==null&&rate!==null?installed*rate:null;
  const itemCertification=certifiedValueFromRows(sourceRows,cutoff,currency),certifiedValue=itemCertification.value;
  return {itemId:item.quantityItemId,itemNumber:item.itemNumber,description:item.description,unit:item.unit,area,areaBasis:areaAssignment.state==='ambiguous'?'Area references disagree; not mapped ('+areaAssignment.basis+')':areaAssignment.state==='unmapped'?'No explicit area reference and no unique programme area match; not mapped':areaAssignment.basis,
   areaMappingState:areaAssignment.state,areaCandidates:areaAssignment.candidates,section:item.section??null,currency,
   contractQuantity:contract,installedQuantity:installed,installedPercent:contract!==null&&contract>0&&installed!==null?100*installed/contract:null,
   periodInstalledQuantity:period,periodStartIso:date(prior?.asOfIso),periodEndIso:date(now?.asOfIso),
   periodProgressPercent:period!==null&&contract!==null&&contract>0?100*period/contract:null,
   actualRatePerCalendarDay:period!==null&&periodDays!==null&&periodDays>0?period/periodDays:null,
   requiredRatePerCalendarDay:remaining!==null&&remainingDays!==null&&remainingDays>0?remaining/remainingDays:null,
   remainingQuantity:remaining,targetFinishIso:target,earnedHours:installed!==null&&hpu!==null?installed*hpu:null,
   periodEarnedHours:period!==null&&hpu!==null?period*hpu:null,actualHours,
   productivityPerActualHour:period!==null&&actualHours!==null&&actualHours>0?period/actualHours:null,
   installedValue,certifiedValue,installedAgainstCertified:installedValue!==null&&certifiedValue!==null?installedValue-certifiedValue:null,
   contractValue,contractValueBasis,
   sourceRefs:[...new Set([...(price?.sourceRefs??[]),...(now?.sourceRefs??[]).map((r:any)=>r.locator),...sourceRows.flatMap(rowRefs),...itemCertification.sourceRefs])],
   missingInputs:[installed===null?'Dated measured installation':null,prior?null:'Previous comparable installed measurement',hpu===null?'Unique budget labour hours per unit':null,actualHours===null?'Actual labour hours for the measurement interval':null,target?null:'Linked activity forecast finish',rate===null?'BOQ unit rate':null,certifiedValue===null?'Item-level certified value with certificate number, date and amount basis':null].filter(Boolean),
   basis:'Priced scope uses the admissible source BOQ amount; quantity × rate is used only when no amount is supplied. Installed values use measured cumulative quantities × the unit rate, never schedule percentage or a rescaled source amount. An item-certified value requires a dated certificate that explicitly identifies this BOQ item. A whole-project certificate without item references cannot establish the certified value for an individual BOQ item. Rates use stated calendar days. Earned hours use a supplied budget labour-hours-per-unit rate; actual productivity requires measured output and actual hours for the same interval.'};
 });
 const areaMap=new Map<string,typeof items>();for(const r of items){const key=JSON.stringify([r.area,r.currency]);const group=areaMap.get(key)??[];group.push(r);areaMap.set(key,group);}
 const certificates=(commercial.sourceLedger?.payments??[]).filter((r:any)=>date(r.certificationDate)&&(!cutoff||date(r.certificationDate)!<=cutoff)&&!/applied|application|draft|submitted/i.test(r.sourceStatus??''));
 const areas=[...areaMap].map(([key,xs])=>{const[area,currency]=JSON.parse(key);const pricedRows=xs.filter(r=>r.contractValue!==null),measuredRows=xs.filter(r=>r.installedValue!==null);
  const contractValue=pricedRows.length?pricedRows.reduce((s,r)=>s+r.contractValue!,0):null,installedValue=measuredRows.length?measuredRows.reduce((s,r)=>s+r.installedValue!,0):null;
  // The unmapped part never receives certificates: a row without an area
  // reference (such as a whole-project certificate) is not an area allocation.
  const certRows=area===null?[]:rows.filter(r=>norm(cell(r,'plot','area','zone','location','workfront','section'))===norm(area)&&(!currency||cell(r,'currency')===currency));
  const certification=certRows.filter(r=>{const d=date(cell(r,'certification date','certificate date'));return !!d&&(!cutoff||d<=cutoff)&&!/applied|application|draft|submitted/i.test(cell(r,'status'));});
  const byCert=new Map<string,{amount:number;date:string;basis:string}>();let ambiguous=false;
  for(const r of certification){
   const number=cell(r,'certificate no','certificate number','ipc'),v=numberValue(cell(r,'certified amount','gross certified','gross certified amount','certified value'));
   const d=date(cell(r,'certification date','certificate date'));
   const rawBasis=norm(cell(r,'certified amount basis','amount basis','series basis','basis'));
   const basis=/cumulative|to date|to-date/.test(rawBasis)?'cumulative':/incremental|period|this month|this certificate/.test(rawBasis)?'incremental':'unknown';
   if(!number||v===null||!d)continue;
   const identity=norm(number)+'|'+d,old=byCert.get(identity);
   if(old&&(old.amount!==v||old.basis!==basis))ambiguous=true;else byCert.set(identity,{amount:v,date:d,basis});
  }
  const certValues=[...byCert.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const basisSet=new Set(certValues.map(v=>v.basis));
  const certifiedValue=ambiguous||!certValues.length?null:certValues.length===1?certValues[0]!.amount:
   basisSet.size===1&&basisSet.has('incremental')?certValues.reduce((s,v)=>s+v.amount,0):
   basisSet.size===1&&basisSet.has('cumulative')?certValues.at(-1)!.amount:null;

  return {area:area??'Area not recorded',mapped:area!==null,currency,itemCount:xs.length,measuredItemCount:measuredRows.length,pricedItemCount:pricedRows.length,
   contractValue,installedValue,physicalProgressPercent:installedValue!==null&&contractValue!==null&&contractValue>0?100*installedValue/contractValue:null,
   sourceAmountItemCount:xs.filter(r=>r.contractValueBasis==='Source BOQ amount').length,
   calculatedAmountItemCount:xs.filter(r=>r.contractValue!==null&&r.contractValueBasis!=='Source BOQ amount').length,
   pricedScopeBasis:'Source BOQ amounts; quantity × rate only for items without a supplied amount. Unpriced items are excluded from this qualified subtotal.',
   physicalBasis:'Measured installed quantity × unit rate / priced BOQ scope value in this area and currency. Source BOQ amounts take precedence in priced scope; rounding can therefore differ from measured value at full quantity. Unmeasured and unpriced items remain coverage qualifications, not recorded zeros.',
   certifiedValue,certifiedProgressPercent:certifiedValue!==null&&contractValue!==null&&contractValue>0?100*certifiedValue/contractValue:null,
   installedAgainstCertified:installedValue!==null&&certifiedValue!==null?installedValue-certifiedValue:null,
   certificationBasis:'Explicit certificate number, dated certification and area allocation. Whole-project certificates are not apportioned to areas.',
   missingInputs:[installedValue===null?'Measured installed quantities and rates for this area':null,contractValue===null?'Priced BOQ scope in this area':null,certifiedValue===null?'Dated certificate amounts explicitly allocated to this area, with a consistent incremental or cumulative basis':null].filter(Boolean)};
 });
 const areaReconciliation=reconcileScope(items.map(r=>({itemId:r.itemId,itemNumber:r.itemNumber,currency:r.currency,value:r.contractValue})),r=>areaAssignments.get(r.itemId)!,'Area not recorded');
 return {items,itemCount:q?items.length:null,measuredItemCount:items.filter(r=>r.installedQuantity!==null).length,areas,areaReconciliation,certificateCount:certificates.length,
  basis:'Full retained BOQ item population; area and currency totals use explicit source associations. Quantities with unlike units are never summed into a project physical percentage.'};
}

export function buildClaimChecks(rows:SourceRow[],cutoff:string|null,rules:NoticeRequirement[]=[]){
 const seen=new Set<string>(),checks:any[]=[];
 for(const r of rows){const ref=cell(r,'claim id','claim no','claim number','event id','event no');const notice=date(cell(r,'notice date','event notice date','notice submitted date'));
  const submitted=date(cell(r,'detailed claim date','fully detailed claim date','detailed submission date','claim submission date','submission date'));
  const start=date(cell(r,'window start','window start date','delay start')),end=date(cell(r,'window end','window end date','delay end'));
  if(!ref)continue;
  const identity=ref+'|'+notice+'|'+submitted+'|'+start+'|'+end;if(seen.has(identity))continue;seen.add(identity);
  const awareness=date(cell(r,'awareness date','date of awareness','became aware date'));
  const eventStart=date(cell(r,'event start','event start date','event date'));
  // F47: the same shared detailed-claim rule the claim records carry.
  const {rule,trigger,due,limit,detailedClaimState,daysAfterDue,basis}=detailedClaimDeadline({awarenessIso:awareness,eventStartIso:eventStart,submittedIso:submitted,cutoffIso:cutoff},rules);
  checks.push({claimReference:ref,noticeDateIso:notice,detailedSubmissionDateIso:submitted,dueDateIso:due,allowedDays:limit,
   triggerDateIso:trigger,triggerBasis:rule?.triggerBasis??null,
   daysAfterDue,
   detailedClaimState,
   windowStartIso:start,windowEndIso:end,windowCalendarDays:days(start,end),longWindow:start&&end?end>monthDate(start,3):null,
   sourceRefs:[...rowRefs(r),...(rule?.evidenceRefs??[]).map(ref=>ref.sourceType+':'+ref.sourceId+':'+ref.locator)],
   basis,
   warning:start&&end&&end>monthDate(start,3)?'Delay window exceeds three calendar months; subdivide the analysis or justify the longer window.':null,
   missingInputs:[!due?'Applicable contract detailed-claim rule, valid calendar-day period and dated starting event':null,!submitted?'Fully detailed submission date':null].filter(Boolean)});
 }
 return {rows:checks,total:checks.length,lateCount:checks.filter(r=>r.detailedClaimState==='late'||r.detailedClaimState==='overdue_no_submission').length,longWindowCount:checks.filter(r=>r.longWindow).length,
  basis:'Dated claim screening; all source references retained. No entitlement, waiver, time-bar or liability determination is inferred.'};
}

function buildPaymentChecks(commercial:any,cutoff:string|null){
 const foundation=commercial.foundation??{},terms=foundation.commercialTerms??{},period=valueOf(terms.paymentPeriodDays);
 // Reuse the contract-version-aware payment-register producer. In particular,
 // never reconstruct its due date from a bare number, or convert working days
 // into calendar days, when the governing trigger/basis is unresolved.
 const paymentRows=foundation.paymentRegister?.rows??[];
 const rows=paymentRows.map((r:any)=>{
  const lifecycle=r.lifecycle??{},start=date(lifecycle.certificationDate),paid=date(lifecycle.paymentDate);
  const applied=/applied|application|draft|submitted|pending certification/i.test(r.sourceStatus??'')||!start;
  const rawDue=lifecycle.paymentDueDate, due=typeof rawDue?.value==='string'?date(rawDue.value):null;
  const method=rawDue?.basis?.method??null;
  return {certificateReference:r.paymentId,sourceStatus:r.sourceStatus,certificationDateIso:start,actualPaymentDateIso:paid,
   paymentPeriodDays:period,contractDueDateIso:due,daysLate:due&&paid?Math.max(0,days(due,paid)??0):due&&cutoff&&!paid?Math.max(0,days(due,cutoff)??0):null,
   state:applied?'application_not_certified':!due?'due_basis_missing':!paid?'payment_not_recorded':paid>due?'paid_late':'paid_within_period',
   includedInCertifiedTotals:!applied,paymentDueDate:rawDue??null,
   basis:method?String(method).replaceAll('_',' '):'The contract payment trigger, period or date basis is not established.',
   qualifications:rawDue?.diagnostics??[],
   missingInputs:[period===null?'Contract payment period':null,!start?'Actual certification date':null,!due?'Applicable contract due-date basis':null,!paid?'Actual payment date':null].filter(Boolean),
   sourceRefs:r.sourceRefs??[]};
 });
 return {rows,total:rows.length,appliedExcludedCount:rows.filter((r:any)=>!r.includedInCertifiedTotals).length,lateCount:rows.filter((r:any)=>r.state==='paid_late').length,
  basis:'Applications are not certifications. Due dates are the same contract-version-aware dates used in the issued payment register; no trigger or working-day calendar is inferred.'};
}

/** Active package rows remain individual source records, never invented
 * procurement budgets. A subtotal is comparable only within its stated
 * currency and never certifies completeness or tax-basis reconciliation. */
type ProcurementComparisonRow={currency:string|null;amount:number|null;sourceRefs:string[];recordId:string};
function procurementSourceTotals(state:ProjectRuntimeState):ProcurementComparisonRow[]{
 const records=deliveryRecords(state).records.filter(r=>r.kind==='package'&&deliveryCurrentRecord(r));
 return records.map(r=>{
  const read=(...names:string[]):string=>{
   for(const name of names){const v=r.fields[canonicalHeader(name)];if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim();}
   return '';
  };
  const iso=read('currency').toUpperCase();
  const currency=/^[A-Z]{3}$/.test(iso)?iso:null;
  const raw=read('package value','package amount','amount','value');
  const amount=raw?numberValue(raw):null;
  return {currency,amount,recordId:r.recordId,
   sourceRefs:r.receipts.map(receipt=>'evidence-document:'+receipt.documentId+':'+receipt.locator)};
 });
}

/** F37: the same register-to-contract rule, limited to the procurement package
 * register so a dashboard can show its query without BOQ measurement work. */
export function packageRegisterContractChecks(state:ProjectRuntimeState,commercial:any){
 return buildRegisterChecks(commercial,{},null,procurementSourceTotals(state)).checkedRows.filter((r:any)=>String(r.register).startsWith('Procurement package register'));
}

/** Source-qualified commercial comparison, whether or not an exception exists.
 * Consumers keep the exceptions in rows exactly as before. The supporting
 * checkedRows show which comparable source populations were actually examined;
 * absent amounts do not become zero and different currencies never combine. */
export function buildRegisterChecks(commercial:any,_ledger:any,quantities:any,procurement:ProcurementComparisonRow[]=[]){
 const exceptions:any[]=[],checkedRows:any[]=[];
 for(const currency of commercial.currencies??[]){
  const contract=valueOf(currency.currentContractValue);
  if(contract===null||contract<=0)continue;
  const series:Array<{name:string;total:number|null;refs:string[];count:number|null}>=[
   {name:'Gross issued certificates',total:valueOf(currency.grossCertifiedAmount),refs:currency.grossCertifiedAmount?.sourceRefs??[],count:null},
   {name:'Net issued certificates',total:valueOf(currency.netCertifiedAmount),refs:currency.netCertifiedAmount?.sourceRefs??[],count:null},
   {name:'Paid receipts',total:valueOf(currency.paidAmount),refs:currency.paidAmount?.sourceRefs??[],count:null},
   {name:'Pending variations',total:valueOf(currency.pendingVariationAmount),refs:currency.pendingVariationAmount?.sourceRefs??[],count:null},
  ];
  const boq=(quantities?.items??[]).filter((r:any)=>r.currency===currency.currency&&r.contractValue!==null&&Number.isFinite(r.contractValue));
  if(boq.length)series.push({name:'Priced BOQ items',
   total:boq.reduce((sum:number,r:any)=>sum+r.contractValue,0),
   // Aggregate counts retain full source provenance without repeating 30,000
   // item references in every screen/report's five-row control summary.
   refs:boq.slice(0,12).flatMap((r:any)=>r.sourceRefs??[]),count:boq.length});
  const sourcePackages=procurement.filter(p=>p.currency===currency.currency);
  const measuredPackages=sourcePackages.filter(p=>p.amount!==null&&p.sourceRefs.length>0);
  const pkgSourceCount=sourcePackages.length;
  if(measuredPackages.length)series.push({name:'Procurement package register · sourced subtotal',
   total:measuredPackages.reduce((sum,p)=>sum+p.amount!,0),
   refs:measuredPackages.slice(0,12).flatMap(p=>p.sourceRefs),
   count:pkgSourceCount});
  for(const entry of series){
   if(entry.total===null||!Number.isFinite(entry.total))continue;
   const gap=entry.total-contract,above=gap>0.01;
   const row={register:entry.name,currency:currency.currency,registerTotal:entry.total,
    currentContractValue:contract,excess:above?gap:0,
    comparisonDifference:gap,
    state:above?'query_required':entry.name.startsWith('Procurement package register')?'provisional_scope_comparison':'within_qualified_contract_comparison',
    contractAuthorityState:currency.currentContractValue?.state??'not_established',
    sourceRecordCount:entry.count,
    sourceRefs:[...new Set(entry.refs)].slice(0,12),
    basis:'Same-currency arithmetic check of the retained source total against the current contract sum. Verify cumulative/incremental basis, tax and scope separately; this is not a certification of entitlement.',
    action:above?'Reconcile the source scope, series basis, duplicate records, tax and currency before relying on the excess.':
     entry.name.startsWith('Procurement package register')
       ?'Compare the sourced package subtotal with the current contract, then verify package coverage, omissions, duplicate scopes and tax basis before concluding the procurement register is complete.'
       :'No above-contract arithmetic exception identified for this retained amount; source authority and reconciliation remain qualified.'};
   checkedRows.push(row);
   if(above)exceptions.push(row);
  }
 }
 return {rows:exceptions,count:exceptions.length,checkedRows,checkedCount:checkedRows.length,
  basis:'Full comparable source totals, including those without exceptions. Missing amounts and incomparable currencies are not reported as zero.'};
}

/** A substantive decision table has one home. Other pages link to that home.
 * This shared ownership applies to every project and every export. */
export function decisionAnalysisForModule(state:ProjectRuntimeState,key:string,projection?:unknown){
 const d=projectDecisionFacts(state);
 const basis={dataDateIso:d.dataDateIso,sourceVersion:d.projectVersion};
 switch(key){
  case 'pmo-analysis':return {...basis,kind:'management_commercial',commercialSummary:d.commercialSummary,completionConstraints:d.completionConstraints,negativeFloatConstraint:d.negativeFloatConstraint};
  case 'near-critical':return {...basis,kind:'float_erosion',trends:d.trends};
  case 'variance-trends':return {...basis,kind:'finish_slip',slipRate:d.trends.slipRate,comparisonDateIso:d.trends.comparisonDateIso,elapsedMonths:d.trends.elapsedMonths};
  case 'quantity-scurve':return {...basis,kind:'measured_productivity',quantities:{...d.quantities,areas:undefined}};
  case 'progress-breakdown':return {...basis,kind:'area_progress',areas:d.quantities.areas,areaCount:d.quantities.areas.length,areaReconciliation:d.quantities.areaReconciliation};
  case 'progress-scurve':return {...basis,kind:'monthly_evm',series:d.monthlyEvm};
  case 'notices-claims':return {...basis,kind:'detailed_claims',claimChecks:d.claimChecks};
  case 'windows-analysis':{
   const value=projection&&typeof projection==='object'?projection as Record<string,any>:{};
   const source=value.windows??value.result?.windows;
   const fromProgramme=Array.isArray(source)?source.map((w:any,index:number)=>{
    const start=date(w.windowStartIso),end=date(w.windowEndIso),longWindow=start&&end?end>monthDate(start,3):null;
    return {claimReference:'Programme analysis window '+(w.sequence??index+1),windowId:w.windowId??null,
      windowStartIso:start,windowEndIso:end,windowCalendarDays:days(start,end),longWindow,
      warning:longWindow?'Delay window exceeds three calendar months; subdivide the analysis or justify the longer window.':null,
      missingInputs:[!start?'Window start date':null,!end?'Window end date':null].filter(Boolean),
      sourceRefs:[w.fromRevisionId,w.toRevisionId].filter(Boolean),
      basis:'The actual from/to programme interval already used by Windows Analysis; no replacement window or entitlement is inferred.'};
   }):[];
   const registered=d.claimChecks.rows.filter(r=>r.windowStartIso||r.windowEndIso);
   const rows=[...fromProgramme,...registered];
   return {...basis,kind:'long_windows',claimChecks:{...d.claimChecks,rows,windowCount:rows.length,longWindowCount:rows.filter(r=>r.longWindow).length}};
  }
  case 'payments':return {...basis,kind:'payment_due',paymentChecks:d.paymentChecks};
  case 'commercial-overview':return {...basis,kind:'register_reconciliation',registerValueChecks:d.registerValueChecks};
  default:return null;
 }
}
