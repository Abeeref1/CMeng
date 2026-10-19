// One shared basis label and one shared like-for-like cost comparison.
// F27: every displayed sum states which records, currency, tax basis and date it uses.
// F37: the cost headline compares the forecast with the current approved contract
// (original contract plus approved variations), states that basis, and queries
// omission-labelled variations instead of treating them as savings without evidence.

export interface SumBasisInput{
  records:string|null|undefined;
  currency:string|null|undefined;
  taxBasis:string|null|undefined;
  asOf?:string|null|undefined;
}

const known=(value:unknown):string|null=>value===null||value===undefined||String(value).trim()===''?null:String(value).trim();

export function sumBasisLabel(input:SumBasisInput):string{
  return 'Basis: '+(known(input.records)??'records not established')+
    ' · currency '+(known(input.currency)??'not established')+
    ' · tax basis '+(known(input.taxBasis)??'not established')+
    ' · as of '+(known(input.asOf)??'not established');
}

export interface CostComparisonFact{value:number|null;state?:string|null;diagnostics?:readonly string[]|null}

export interface CostHeadlineInput{
  eac:number|null;
  eacBasis:'source_reported'|'cmeng_scenario'|null;
  currentContract:CostComparisonFact|null|undefined;
  approvedVariation:CostComparisonFact|null|undefined;
  currency:string|null|undefined;
  taxBasis:string|null|undefined;
  asOf?:string|null|undefined;
}

export interface CostHeadlineComparison{
  // EAC minus current approved contract; null when either side is unknown.
  difference:number|null;
  state:'established'|'queried'|'not_established';
  comparedWith:'current_approved_contract';
  basis:string;
  queries:string[];
}

const OMISSION_PREFIX='OMISSION_SIGN_REVIEW:';

export function costHeadlineComparison(input:CostHeadlineInput):CostHeadlineComparison{
  const contract=input.currentContract??null;
  const variation=input.approvedVariation??null;
  const contractValue=typeof contract?.value==='number'&&Number.isFinite(contract.value)?contract.value:null;
  const eac=typeof input.eac==='number'&&Number.isFinite(input.eac)?input.eac:null;
  const difference=eac===null||contractValue===null?null:eac-contractValue;
  const omissionIds=[...new Set((variation?.diagnostics??[]).filter(d=>typeof d==='string'&&d.startsWith(OMISSION_PREFIX)).map(d=>d.slice(OMISSION_PREFIX.length)))];
  const queries:string[]=[];
  if(omissionIds.length)queries.push(omissionIds.length+' omission-labelled approved variation'+(omissionIds.length===1?'':'s')+' ('+omissionIds.join(', ')+') carry a sign that is not confirmed; confirm before treating any as a saving or an addition.');
  if(contractValue!==null&&contract?.state&&contract.state!=='established')queries.push('Current contract value is '+contract.state+', not established.');
  if(variation&&variation.state&&variation.state!=='established'&&!omissionIds.length)queries.push('Approved variation total is '+variation.state+', not established.');
  if(difference!==null&&!known(input.taxBasis))queries.push('Tax basis of the forecast is not established; confirm it matches the contract value.');
  const eacLabel=input.eacBasis==='source_reported'?'source-reported EAC':input.eacBasis==='cmeng_scenario'?'CMeng scenario EAC':'EAC';
  const basis='Compares '+eacLabel+' with the current approved contract (original contract plus approved variations), not the original budget. '+
    sumBasisLabel({records:'cost forecast and approved variation register',currency:input.currency,taxBasis:input.taxBasis,asOf:input.asOf});
  return {
    difference,
    state:difference===null?'not_established':queries.length?'queried':'established',
    comparedWith:'current_approved_contract',
    basis,
    queries,
  };
}

// F36: the payment due date is shown with the rule that produced it. The date
// itself comes from the one shared commercial-foundation rule (explicit source
// due date, or certificate date plus the contract payment period). Unknown
// terms stay not established; nothing is inferred here.
export interface DueDateFindingLike{value:string|null;state?:string|null;basis?:{method?:string|null}|null;action?:string|null}

// Self-contained: the browser script embeds this function with toString().
export function paymentDueBasisLabel(due:DueDateFindingLike|null|undefined,certificationDateIso:string|null|undefined):string{
  const isoDay=(value:string|null|undefined):number|null=>{
    const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(value??''));
    return m?Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])):null;
  };
  const method=due?.basis?.method??null;
  if(!due||due.value===null||due.value===undefined)return 'Due date not established'+(due?.action?': '+due.action:': contract payment period or certificate date not established');
  if(method==='explicit_source_due_date')return 'Source due date';
  if(method==='certification_date_plus_contract_payment_period'){
    const from=isoDay(certificationDateIso),to=isoDay(due.value);
    const days=from===null||to===null?null:Math.round((to-from)/86_400_000);
    return 'Certificate date '+(certificationDateIso?String(certificationDateIso).slice(0,10):'not established')+
      ' + '+(days===null?'contract payment period':days+'-day contract payment period')+
      (due.state&&due.state!=='established'?' · period '+due.state+', not approved':'');
  }
  return 'Due-date basis not established';
}
