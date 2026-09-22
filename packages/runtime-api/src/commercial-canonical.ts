import { partitionAsOf } from "../../truth-kernel/src";
import { cell, has, norm, numberValue, dateValue, governedTables, sumKnown, ratio, round, type SourceReceipt, type SourceRow, type FactState, reportingScope } from '../../truth-kernel/src';
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
export type PaymentSeriesBasis =
  | 'incremental'
  | 'project_cumulative'
  | 'certificate_cumulative'
  | 'unknown';
export interface PaymentStageRecord {
  paymentId: string; periodEnd: string | null; sourceStatus: string;
  certifiedAmountBasis: PaymentSeriesBasis;
  paidAmountBasis: PaymentSeriesBasis;
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
export interface CommercialVariation {
  variationId:string;
  description:string;
  approvalDate:string|null;
  status:string;
  authority:string|null;
  instructionId:string|null;
  instructionDate:string|null;
  submittedDate:string|null;
  quotationDate:string|null;
  assessedDate:string|null;
  agreedDate:string|null;
  scheduleImpactDays:number|null;
  claimId:string|null;
  paymentId:string|null;
  activityIds:string[];
  clauseIdentifiers:string[];
  claimedAmount:CommercialMoney;
  assessedAmount:CommercialMoney;
  agreedAmount:CommercialMoney;
  approvedAmount:CommercialMoney;
  receipt:SourceReceipt;
}
export interface CommercialSiteInstruction {
  instructionId:string;
  description:string;
  issueDate:string|null;
  status:string;
  variationId:string|null;
  quotationDueDate:string|null;
  quotationDate:string|null;
  scheduleImpactDays:number|null;
  claimId:string|null;
  paymentId:string|null;
  activityIds:string[];
  clauseIdentifiers:string[];
  estimatedAmount:CommercialMoney;
  receipt:SourceReceipt;
}
export interface CommercialInsuranceRecord {
  policyId:string;
  kind:string;
  insurer:string|null;
  status:string;
  inceptionDate:string|null;
  expiryDate:string|null;
  coverageAmount:CommercialMoney;
  sourceRequirement:string|null;
  receipt:SourceReceipt;
}
export interface CommercialObligationRecord {
  obligationId:string;
  clauseIdentifier:string|null;
  description:string;
  responsibleParty:string|null;
  dueDate:string|null;
  completedDate:string|null;
  status:string;
  evidenceReference:string|null;
  receipt:SourceReceipt;
}
export interface CommercialRetentionRecord {
  retentionId:string;
  certificateNo:string|null;
  state:string;
  trigger:string|null;
  dueDate:string|null;
  releaseDate:string|null;
  amount:CommercialMoney;
  receipt:SourceReceipt;
}
export interface CanonicalCommercialModel {
  schemaVersion:'1.0'; producerVersion:'commercial-canonical-v1'; dataDateIso:string|null;
  costMetrics:CostMetricRecord[];
  payments:PaymentStageRecord[];
  variations:CommercialVariation[];
  siteInstructions:CommercialSiteInstruction[];
  insurances:CommercialInsuranceRecord[];
  obligations:CommercialObligationRecord[];
  retentions:CommercialRetentionRecord[];
  costPosition:Array<{ currency:string;taxBasis:string;asOf:string;state:FactState;values:Record<string,number|null>;receipts:SourceReceipt[];diagnostics:string[] }>;
  populations: { payments: import("../../truth-kernel/src").PopulationContract; variations: import("../../truth-kernel/src").PopulationContract; retentionDeductions: import("../../truth-kernel/src").PopulationContract };
  temporalPosition?: {
    payments: {asOfCount:number;futureCount:number;undatedCount:number};
    variations: {asOfApprovedCount:number;futureApprovalCount:number;undatedApprovalCount:number};
    money: Array<{currency:string;taxBasis:string;kind:string;asOfValue:number|null;futureValue:number|null;fullValue:number|null;asOfCount:number;futureCount:number;undatedCount:number}>;
  };
  diagnostics:string[];
}
const moneyNames=['applicationAmount','engineerAssessedAmount','employerCertifiedAmount','grossWork','variations','retentionDeduction','advanceRecovery','otherDeduction','taxAmount','netCertifiedAmount','paidAmount','outstandingAmount'] as const;
const paymentHeaders:Record<typeof moneyNames[number],string[]>={
  applicationAmount:['application amount','applied amount'],engineerAssessedAmount:['engineer assessed amount'],employerCertifiedAmount:['employer certified amount'],grossWork:['gross work'],variations:['variations'],retentionDeduction:['retention','retention deduction'],advanceRecovery:['advance recovery'],otherDeduction:['other deduction','other deductions'],taxAmount:['tax amount','vat amount'],netCertifiedAmount:['net certified','net certified amount'],paidAmount:['paid amount'],outstandingAmount:['outstanding amount'],
};
const tax=(s:string):CommercialMoney['taxBasis']=>/excl/i.test(s)?'exclusive':/incl/i.test(s)?'inclusive':'unknown';
function paymentSeriesBasis(value:string):PaymentSeriesBasis{
 const v=norm(value);
 if(!v)return 'unknown';
 if(/^(incremental|period|periodic|this period|transaction|current period|period amount)$/.test(v))return 'incremental';
 if(/^(project cumulative|cumulative project|cumulative to date|to date|project to date|cumulative total)$/.test(v))return 'project_cumulative';
 if(/^(cumulative|certificate total|cumulative allocated to certificate|certificate cumulative)$/.test(v))return 'certificate_cumulative';
 return 'unknown';
}
function money(row:SourceRow,value:string,amountBasis:string,currency:string|null,asOf:string|null):CommercialMoney{
 const v=numberValue(value);return {value:v,currency,taxBasis:tax(cell(row,'vat basis','tax basis')),amountBasis,
 state:v===null?'missing':currency===null?'partial':['active','additive'].includes(row.receipt.basisState)?'official':'candidate',asOf,receipts:[row.receipt]};
}
function splitList(value:string):string[]{
 return [...new Set(value.split(/[;,|]+/).map(v=>v.trim()).filter(Boolean))];
}
function amountHeader(headers:string[],...labels:string[]):string|null{
 for(const label of labels){
  const n=norm(label);
  const found=headers.find(h=>h===n||(h.startsWith(n+' ')&&/^[a-z]{3}$/.test(h.slice(n.length+1))));
  if(found)return found;
 }
 return null;
}
function headerCurrency(header:string|null):string|null{
 if(!header)return null;
 const parts=header.split(' ');
 const tail=parts.at(-1)??'';
 return /^[a-z]{3}$/.test(tail)?tail.toUpperCase():null;
}
function moneyFromHeader(row:SourceRow,header:string|null,basis:string,fallbackCurrency:string|null,asOf:string|null):CommercialMoney{
 const currency=cell(row,'currency')||headerCurrency(header)||fallbackCurrency;
 return money(row,header?cell(row,header):'',basis,currency,asOf);
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
 const costMetrics:CostMetricRecord[]=[],payments:PaymentStageRecord[]=[],variations:CommercialVariation[]=[],siteInstructions:CommercialSiteInstruction[]=[],insurances:CommercialInsuranceRecord[]=[],obligations:CommercialObligationRecord[]=[],retentions:CommercialRetentionRecord[]=[];
 for(const t of tables){
  if(has(t,'metric','value','unit','as of'))for(const r of t.rows){
   const unit=cell(r,'unit');if(!/^[A-Z]{3}$/.test(unit))continue;
   costMetrics.push({
    metric:cell(r,'metric'),
    amount:money(
      r,
      cell(r,'value'),
      cell(r,'amount basis','value basis','series basis','cash basis')||cell(r,'metric'),
      unit,
      dateValue(cell(r,'as of'))
    ),
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
    certifiedAmountBasis:paymentSeriesBasis(cell(r,'certified amount basis','net certified basis','certificate amount basis')),
    paidAmountBasis:paymentSeriesBasis(cell(r,'paid amount basis','payment amount basis')),
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
   const approvedHeader=amountHeader(t.headers,'approved amount');
   const agreedHeader=amountHeader(t.headers,'agreed amount');
   const assessedHeader=amountHeader(t.headers,'assessed amount');
   const claimedHeader=amountHeader(t.headers,'claimed amount','submitted amount');
   const approvalDate=dateValue(cell(r,'approval date'));
   const asOf=approvalDate??dateValue(cell(r,'agreed date','assessment date','submitted date','quotation date'));
   const fallbackCurrency=cell(r,'currency')||headerCurrency(approvedHeader)||headerCurrency(agreedHeader)||headerCurrency(assessedHeader)||headerCurrency(claimedHeader)||inheritedCurrency;
   variations.push({
    variationId:cell(r,'variation id'),
    description:cell(r,'description','variation description'),
    approvalDate,
    status:cell(r,'status'),
    authority:cell(r,'authority')||null,
    instructionId:cell(r,'instruction id','site instruction id','si id')||null,
    instructionDate:dateValue(cell(r,'instruction date','site instruction date','si date')),
    submittedDate:dateValue(cell(r,'submitted date','submission date')),
    quotationDate:dateValue(cell(r,'quotation date','quote date')),
    assessedDate:dateValue(cell(r,'assessment date','assessed date')),
    agreedDate:dateValue(cell(r,'agreed date')),
    scheduleImpactDays:numberValue(cell(r,'schedule impact days','time impact days','eot days')),
    claimId:cell(r,'claim id')||null,
    paymentId:cell(r,'payment id','certificate no','ipc')||null,
    activityIds:splitList(cell(r,'activity ids','activity id','schedule activity ids')),
    clauseIdentifiers:splitList(cell(r,'clause','clause identifiers','clause references')),
    claimedAmount:moneyFromHeader(r,claimedHeader,'claimed variation',fallbackCurrency,asOf),
    assessedAmount:moneyFromHeader(r,assessedHeader,'assessed variation',fallbackCurrency,asOf),
    agreedAmount:moneyFromHeader(r,agreedHeader,'agreed variation',fallbackCurrency,asOf),
    approvedAmount:moneyFromHeader(r,approvedHeader,'approved variation',fallbackCurrency,approvalDate),
    receipt:r.receipt
   });
  }
  const hasInstructionIdentity=t.headers.includes(norm('instruction id'))||t.headers.includes(norm('site instruction id'))||t.headers.includes(norm('si id'));
  const hasInstructionRegisterShape=t.headers.includes(norm('issue date'))||t.headers.includes(norm('quotation due date'))||t.headers.includes(norm('instruction description'));
  if(hasInstructionIdentity&&hasInstructionRegisterShape&&t.headers.includes(norm('status')))for(const r of t.rows){
   const estimateHeader=amountHeader(t.headers,'estimated amount','instruction amount','quotation amount');
   const issueDate=dateValue(cell(r,'issue date','instruction date','site instruction date','si date'));
   siteInstructions.push({
    instructionId:cell(r,'instruction id','site instruction id','si id'),
    description:cell(r,'description','instruction description'),
    issueDate,
    status:cell(r,'status'),
    variationId:cell(r,'variation id')||null,
    quotationDueDate:dateValue(cell(r,'quotation due date','quote due date')),
    quotationDate:dateValue(cell(r,'quotation date','quote date')),
    scheduleImpactDays:numberValue(cell(r,'schedule impact days','time impact days')),
    claimId:cell(r,'claim id')||null,
    paymentId:cell(r,'payment id','certificate no','ipc')||null,
    activityIds:splitList(cell(r,'activity ids','activity id','schedule activity ids')),
    clauseIdentifiers:splitList(cell(r,'clause','clause identifiers','clause references')),
    estimatedAmount:moneyFromHeader(r,estimateHeader,'site instruction estimate',cell(r,'currency')||inheritedCurrency,issueDate),
    receipt:r.receipt
   });
  }
  if(has(t,'policy id','status'))for(const r of t.rows){
   const coverageHeader=amountHeader(t.headers,'coverage amount','insured amount','policy limit');
   const expiryDate=dateValue(cell(r,'expiry date','expiration date'));
   insurances.push({
    policyId:cell(r,'policy id'),
    kind:cell(r,'insurance type','policy type','type'),
    insurer:cell(r,'insurer','insurance company')||null,
    status:cell(r,'status'),
    inceptionDate:dateValue(cell(r,'inception date','start date','effective date')),
    expiryDate,
    coverageAmount:moneyFromHeader(r,coverageHeader,'insurance coverage',cell(r,'currency')||inheritedCurrency,dateValue(cell(r,'inception date','start date','effective date'))),
    sourceRequirement:cell(r,'contract requirement','clause','clause reference')||null,
    receipt:r.receipt
   });
  }
  if(has(t,'obligation id','status'))for(const r of t.rows){
   obligations.push({
    obligationId:cell(r,'obligation id'),
    clauseIdentifier:cell(r,'clause','clause identifier','clause reference')||null,
    description:cell(r,'description','obligation'),
    responsibleParty:cell(r,'responsible party','owner','party')||null,
    dueDate:dateValue(cell(r,'due date')),
    completedDate:dateValue(cell(r,'completed date','completion date')),
    status:cell(r,'status'),
    evidenceReference:cell(r,'evidence reference','evidence','document reference')||null,
    receipt:r.receipt
   });
  }
  if(has(t,'retention id','status'))for(const r of t.rows){
   const amountH=amountHeader(t.headers,'retention amount','amount');
   const dueDate=dateValue(cell(r,'due date','release due date'));
   retentions.push({
    retentionId:cell(r,'retention id'),
    certificateNo:cell(r,'certificate no','ipc')||null,
    state:cell(r,'status','state'),
    trigger:cell(r,'trigger','release trigger')||null,
    dueDate,
    releaseDate:dateValue(cell(r,'release date','released date')),
    amount:moneyFromHeader(r,amountH,'retention balance',cell(r,'currency')||inheritedCurrency,dateValue(cell(r,'as of','as of date','balance date','record date','period end'))),
    receipt:r.receipt
   });
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
  const variationRows=variations.filter(v=>v.approvedAmount.currency===rows[0]!.amount.currency&&v.approvedAmount.taxBasis===rows[0]!.amount.taxBasis);
  const datedApproved=variationRows.filter(v=>reportingScope(v.approvalDate,rows[0]!.amount.asOf)==='as_of'&&/approved/i.test(v.status)&&v.approvedAmount.state==='official');
  const lineTotal=sumKnown(datedApproved.map(v=>v.approvedAmount.value));
  if(variationRows.length&&lineTotal!==null&&change!==null&&Math.abs(lineTotal-change)>.01)issues.push('DATED_VARIATION_LEDGER_VS_SOURCE_AGGREGATE_CONFLICT');
  if(variations.some(v=>v.approvedAmount.currency===rows[0]!.amount.currency&&v.approvedAmount.taxBasis!==rows[0]!.amount.taxBasis))issues.push('VARIATION_RECONCILIATION_TAX_BASIS_UNRESOLVED');
  if(!compatible)issues.push('TAX_BASIS_UNKNOWN_DERIVED_METRICS_WITHHELD');
  return {state:rows.some(r=>r.amount.state==='candidate')?'candidate' as const:issues.length?'partial' as const:'official' as const,currency:rows[0]!.amount.currency!,taxBasis:rows[0]!.amount.taxBasis,asOf:rows[0]!.amount.asOf!,values,receipts:rows.flatMap(r=>r.amount.receipts),diagnostics:issues};
 });
 const temporalMoney = new Map<string,Array<{value:number|null;date:string|null}>>();
 const collect=(kind:string,amount:CommercialMoney,date:string|null)=>{const key=[amount.currency??'Unknown',amount.taxBasis,kind].join('|');const group=temporalMoney.get(key)??[];group.push({value:amount.value,date});temporalMoney.set(key,group);};
 for(const row of payments)collect('Retention deductions',row.amounts.retentionDeduction,row.periodEnd);
 for(const row of variations)if(/approved/i.test(row.status))collect('Approved variation source values',row.approvedAmount,row.approvalDate);
 const temporalPosition={
   payments:{asOfCount:payments.filter(r=>reportingScope(r.periodEnd,dataDateIso)==='as_of').length,futureCount:payments.filter(r=>reportingScope(r.periodEnd,dataDateIso)==='future').length,undatedCount:payments.filter(r=>reportingScope(r.periodEnd,dataDateIso)==='undated').length},
   variations:{asOfApprovedCount:variations.filter(r=>/approved/i.test(r.status)&&reportingScope(r.approvalDate,dataDateIso)==='as_of').length,futureApprovalCount:variations.filter(r=>/approved/i.test(r.status)&&reportingScope(r.approvalDate,dataDateIso)==='future').length,undatedApprovalCount:variations.filter(r=>/approved/i.test(r.status)&&reportingScope(r.approvalDate,dataDateIso)==='undated').length},
   money:[...temporalMoney].map(([key,rows])=>{const [currency,taxBasis,kind]=key.split('|') as [string,string,string];const asOf=rows.filter(r=>reportingScope(r.date,dataDateIso)==='as_of'),future=rows.filter(r=>reportingScope(r.date,dataDateIso)==='future');return {currency,taxBasis,kind,asOfValue:sumKnown(asOf.map(r=>r.value)),futureValue:sumKnown(future.map(r=>r.value)),fullValue:sumKnown(rows.map(r=>r.value)),asOfCount:asOf.length,futureCount:future.length,undatedCount:rows.length-asOf.length-future.length};}),
 };
 const populationOptions={dataDateIso,sourceRevisionId:'evidence-version:'+state.version,authority:'source' as const};
 const paymentPopulation=partitionAsOf(payments,{...populationOptions,name:'Certificate periods by Data Date',entity:'certificate',dateBasis:'periodEnd',id:r=>r.paymentId,date:r=>r.periodEnd}).population;
 const variationPopulation=partitionAsOf(variations.filter(r=>/approved/i.test(r.status)),{...populationOptions,name:'Variation approvals by Data Date',entity:'variation',dateBasis:'approvalDate',id:r=>r.variationId,date:r=>r.approvalDate}).population;
 const retentionPopulation=partitionAsOf(payments,{...populationOptions,name:'Retention deductions by certificate period',entity:'retention_deduction',dateBasis:'periodEnd, not cash release',id:r=>r.paymentId,date:r=>r.periodEnd}).population;
 const populations={payments:paymentPopulation,variations:variationPopulation,retentionDeductions:retentionPopulation};
 const model:CanonicalCommercialModel={populations,schemaVersion:'1.0',producerVersion:'commercial-canonical-v1',dataDateIso,costMetrics,payments,variations,siteInstructions,insurances,obligations,retentions,costPosition,temporalPosition,diagnostics};
 cache.set(state,{version:state.version,value:model});return model;
}
