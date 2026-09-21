import { cell, has, norm, numberValue, dateValue, governedTables, sumKnown, ratio, round, type SourceReceipt, type SourceRow, type FactState } from '../../truth-kernel/src';
import { reconcilePaymentEvidence } from './payment-reconciliation';
import { canonicalTimeClaims, projectDataDate } from './canonical-time-claims';
import type { ProjectRuntimeState, ModuleRuntimeResult } from './project-state-types';
export interface CommercialMoney {
  value: number | null; currency: string | null; taxBasis: 'exclusive' | 'inclusive' | 'unknown';
  amountBasis: string; state: FactState; asOf: string | null; receipts: SourceReceipt[];
}
export interface CostMetricRecord {
  metric: string;
  amount: CommercialMoney;
  sourceStatus: string;
  cbsId: string | null;
  cbsDescription: string | null;
  parentCbsId: string | null;
  wbsId: string | null;
  counterparty: string | null;
  boqItemId: string | null;
  paymentId: string | null;
}
export interface PaymentStageRecord {
  paymentId: string; periodEnd: string | null; sourceStatus: string;
  amounts: Record<'applicationAmount'|'engineerAssessedAmount'|'employerCertifiedAmount'|'grossWork'|'variations'|'retentionDeduction'|'advanceRecovery'|'otherDeduction'|'taxAmount'|'netCertifiedAmount'|'paidAmount'|'outstandingAmount',CommercialMoney>;
  receipt: SourceReceipt; reconciliation: 'matched'|'conflicted'|'unresolved';
  diagnostics: string[]; calculatedOutstandingAmount: CommercialMoney;
  paymentType: string | null;
  applicationDate: string | null;
  assessmentDate: string | null;
  certificationDate: string | null;
  certificationDueDate: string | null;
  paymentDueDate: string | null;
  paymentDate: string | null;
  paymentTimestamp: string | null;
  retentionReleaseDate: string | null;
  finalReceiptDate: string | null;
  paymentReference: string | null;
}
export interface CommercialVariation { variationId:string; description:string; approvalDate:string|null; status:string; authority:string|null; approvedAmount:CommercialMoney; receipt:SourceReceipt }
export interface CanonicalCommercialModel {
  schemaVersion:'1.0'; producerVersion:'commercial-canonical-v1'; dataDateIso:string|null;
  costMetrics:CostMetricRecord[]; payments:PaymentStageRecord[]; variations:CommercialVariation[];
  costPosition:Array<{ currency:string;taxBasis:string;asOf:string;state:FactState;values:Record<string,number|null>;receipts:SourceReceipt[];diagnostics:string[] }>;
  diagnostics:string[];
}
const moneyNames=['applicationAmount','engineerAssessedAmount','employerCertifiedAmount','grossWork','variations','retentionDeduction','advanceRecovery','otherDeduction','taxAmount','netCertifiedAmount','paidAmount','outstandingAmount'] as const;
const paymentHeaders:Record<typeof moneyNames[number],string[]>={
  applicationAmount:['application amount','applied amount'],engineerAssessedAmount:['engineer assessed amount'],employerCertifiedAmount:['employer certified amount'],grossWork:['gross work'],variations:['variations'],retentionDeduction:['retention','retention deduction'],advanceRecovery:['advance recovery'],otherDeduction:['other deduction','other deductions'],taxAmount:['tax amount','vat amount'],netCertifiedAmount:['net certified','net certified amount'],paidAmount:['paid amount'],outstandingAmount:['outstanding amount'],
};
const tax=(s:string):CommercialMoney['taxBasis']=>/excl/i.test(s)?'exclusive':/incl/i.test(s)?'inclusive':'unknown';
function money(row:SourceRow,value:string,amountBasis:string,currency:string|null,asOf:string|null):CommercialMoney{
 const v=numberValue(value);return {value:v,currency,taxBasis:tax(cell(row,'vat basis','tax basis')),amountBasis,
 state:v===null?'missing':currency===null?'partial':['active','additive'].includes(row.receipt.basisState)?'official':'candidate',asOf,receipts:[row.receipt]};
}
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:CanonicalCommercialModel}>();
export function commercialCanonical(state:ProjectRuntimeState):CanonicalCommercialModel {
 const old=cache.get(state);if(old?.version===state.version)return old.value;
 const diagnostics:string[]=[],tables=governedTables(state.evidenceDocuments,diagnostics),dataDateIso=projectDataDate(state);
 // A currency is inherited only from an explicit contract currency statement, never from project location or an unrelated ledger.
 const contractCurrencies=new Set<string>(); const currencyReceipts:SourceReceipt[]=[];
 const approvedAmendments=new Set(canonicalTimeClaims(state).amendments.filter(a=>a.state==='official'&&a.effectiveDate&&dataDateIso&&a.effectiveDate<=dataDateIso).map(a=>a.documentId));
 for(const c of state.contractDocuments){if(c.role==='amendment'&&!approvedAmendments.has(c.documentId))continue;const d=state.evidenceDocuments.find(d=>d.documentId===c.documentId);if(!d||!['active','additive'].includes(d.basisState))continue;
 const textSources=[...c.result.sections.filter(s=>s.sourceMode==='deterministic').map(s=>({text:s.text,startPage:s.startPage})),...(c.result.pdf?.pages??[]).filter(p=>p.method==='native').map(p=>({text:p.text,startPage:p.pageNumber}))];
 for(const section of textSources)for(const m of section.text.matchAll(/(?:all contract[^\n.]{0,160}?values are stated in|contract currency(?:\s+is)?|currency of (?:the )?contract(?:\s+is)?)\s*[:\n]?\s*([A-Z]{3})\b/gi)){ contractCurrencies.add(m[1]!.toUpperCase());currencyReceipts.push({documentId:d.documentId,sourceHash:d.sourceHashSha256,revision:d.linkedArtifactId??d.sourceHashSha256,locator:'page:'+(section.startPage??1),basisState:d.basisState,authority:'source_record'}); }}
 const inheritedCurrency=contractCurrencies.size===1?[...contractCurrencies][0]!:null;
 const costMetrics:CostMetricRecord[]=[],payments:PaymentStageRecord[]=[],variations:CommercialVariation[]=[];
 for(const t of tables){
  if(has(t,'metric','value','unit','as of'))for(const r of t.rows){
   const unit=cell(r,'unit');if(!/^[A-Z]{3}$/.test(unit))continue;
   costMetrics.push({
    metric:cell(r,'metric'),
    amount:money(r,cell(r,'value'),cell(r,'metric'),unit,dateValue(cell(r,'as of'))),
    sourceStatus:cell(r,'status'),
    cbsId:cell(r,'cbs','cbs id','cost code')||null,
    cbsDescription:cell(r,'cbs description','cost code description','description')||null,
    parentCbsId:cell(r,'parent cbs','parent cbs id','parent cost code')||null,
    wbsId:cell(r,'wbs','wbs id')||null,
    counterparty:cell(r,'counterparty','vendor','subcontractor')||null,
    boqItemId:cell(r,'boq item','boq item id','boq line')||null,
    paymentId:cell(r,'payment id','certificate no','ipc')||null,
   });
  }
  if(has(t,'certificate no','net certified'))for(const r of t.rows){
   const asOf=dateValue(cell(r,'period end')),currency=cell(r,'currency')||inheritedCurrency;
   const amounts=Object.fromEntries(moneyNames.map(k=>[k,money(r,cell(r,...paymentHeaders[k]),k,currency,asOf)])) as PaymentStageRecord['amounts'];
   if(!cell(r,'currency')&&currency) for(const a of Object.values(amounts)) a.receipts.push(...currencyReceipts.filter((v,i,all)=>all.findIndex(x=>x.documentId===v.documentId)===i));
   const reconciliation = reconcilePaymentEvidence(r, amounts, dataDateIso);
   payments.push({
    paymentId:cell(r,'certificate no'),
    paymentType:cell(r,'payment type','type')||null,
    periodEnd:asOf,
    sourceStatus:cell(r,'status'),
    applicationDate:dateValue(cell(r,'application date','submission date')),
    assessmentDate:dateValue(cell(r,'assessment date','engineer assessment date')),
    certificationDate:dateValue(cell(r,'certificate date','certification date')),
    certificationDueDate:dateValue(cell(r,'certification due date','certificate due date')),
    paymentDueDate:dateValue(cell(r,'payment due date','due date')),
    paymentTimestamp:cell(r,'payment timestamp','paid timestamp')||null,
    retentionReleaseDate:dateValue(cell(r,'retention release date')),
    finalReceiptDate:dateValue(cell(r,'final receipt date')),
    amounts,
    receipt:r.receipt,
    ...reconciliation
   });
  }
  if(has(t,'variation id','status'))for(const r of t.rows){
   const amountHeader=t.headers.find(h=>/^approved amount(?: [a-z]{3})?$/.test(h));if(!amountHeader)continue;
   const headerCurrency=/approved amount ([a-z]{3})$/.exec(amountHeader)?.[1]?.toUpperCase()??null;
   const currency=cell(r,'currency')||headerCurrency||inheritedCurrency;
   const approvalDate=dateValue(cell(r,'approval date'));
   variations.push({variationId:cell(r,'variation id'),description:cell(r,'description'),approvalDate,status:cell(r,'status'),authority:cell(r,'authority')||null,approvedAmount:money(r,cell(r,amountHeader),'approved variation',currency,approvalDate),receipt:r.receipt});
  }
 }
 const groups=new Map<string,CostMetricRecord[]>();
 for(const r of costMetrics){if(!dataDateIso||!r.amount.asOf||r.amount.asOf>dataDateIso)continue;
  const k=[r.amount.currency,r.amount.taxBasis,r.amount.asOf].join('|');const list=groups.get(k)??[];list.push(r);groups.set(k,list);}
 const costPosition=[...groups.values()].map(rows=>{
  const values:Record<string,number|null>={},issues:string[]=[];
  for(const r of rows){const k=norm(r.metric);if(k in values&&values[k]!==r.amount.value){values[k]=null;issues.push('CONFLICTING_COST_METRIC:'+k);}else if(!(k in values))values[k]=r.amount.value;}
  const get=(k:string)=>values[k]??null;
  const compatible=rows[0]!.amount.taxBasis!=='unknown';
  values.spi=compatible?round(ratio(get('ev'),get('pv'))):null;values.cpi=compatible?round(ratio(get('ev'),get('ac'))):null;
  values['calculated sv']=compatible&&get('ev')!==null&&get('pv')!==null?get('ev')!-get('pv')!:null;
  values['calculated cv']=compatible&&get('ev')!==null&&get('ac')!==null?get('ev')!-get('ac')!:null;
  values['calculated vac']=compatible&&get('bac')!==null&&get('eac')!==null?get('bac')!-get('eac')!:null;
  values['cpi scenario eac']=compatible&&get('bac')!==null?round(ratio(get('bac'),ratio(get('ev'),get('ac'))),2):null;
  if(get('vac')!==null&&values['calculated vac']!==null&&Math.abs(get('vac')!-values['calculated vac']!)>0.01)issues.push('SOURCE_VAC_DOES_NOT_RECONCILE');
  const orig=get('original contract value'),change=get('approved variations'),current=get('current contract value');
  if(compatible&&orig!==null&&change!==null&&current!==null&&Math.abs(orig+change-current)>0.01)issues.push('CONTRACT_VARIATION_RECONCILIATION_CONFLICT');
  if(!compatible)issues.push('TAX_BASIS_UNKNOWN_DERIVED_METRICS_WITHHELD');
  return {state:rows.some(r=>r.amount.state==='candidate')?'candidate' as const:issues.length?'partial' as const:'official' as const,currency:rows[0]!.amount.currency!,taxBasis:rows[0]!.amount.taxBasis,asOf:rows[0]!.amount.asOf!,values,receipts:rows.flatMap(r=>r.amount.receipts),diagnostics:issues};
 });
 const model:CanonicalCommercialModel={schemaVersion:'1.0',producerVersion:'commercial-canonical-v1',dataDateIso,costMetrics,payments,variations,costPosition,diagnostics};
 cache.set(state,{version:state.version,value:model});return model;
}
