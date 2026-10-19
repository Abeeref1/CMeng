import {cell,dateValue,numberValue,governedTables} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
import {contractValueBasisReview} from './source-basis-review';
import {contractTaxBasis,likeForLikeCertifiedRatio,type ContractTaxEvidence} from './commercial-sum-basis';

/** Match retained business references, not row positions or amounts. An ambiguous
 * certificate remains unlinked. This projection never writes a cash ledger. */
export function sourceCommercialEvidence(state:ProjectRuntimeState,ledger:any,position:any,cutoff:string|null){
 const key=(v:unknown)=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/^(?:ipc|certificate|cert|payment certificate)\s*(?:no\.?|number|#|:|-)?\s*/i,'').replace(/[\s_-]+/g,'');
 // Contract and payment dates must be genuine source calendar days. A
 // malformed date cannot validate a certificate, even when it sorts before
 // the payment date as text (for example 2032-02-30).
 const validDate=(v:unknown):string|null=>{
  if(typeof v!=='string')return null;
  const token=/^\d{4}-\d{2}-\d{2}(?=$|[T\s])/.exec(v)?.[0];
  if(!token)return null;
  const instant=Date.parse(token+'T00:00:00Z');
  return Number.isFinite(instant)&&new Date(instant).toISOString().slice(0,10)===token?token:null;
 };
 const reportingDate=validDate(cutoff);
 const visible=(d:string|null)=>{const date=validDate(d);return date!==null&&(!reportingDate||date<=reportingDate);};
 const refs=(row:any)=>row.receipt?[row.receipt.documentId+':'+row.receipt.locator]:[];
 const certificates=(ledger.payments??[]).filter((p:any)=>visible(p.certificationDate)&&!/appli(?:ed|cation)|submitted|draft|pending certification/i.test(p.sourceStatus??'')&&
   [p.amounts?.grossCertifiedAmount?.value,p.amounts?.netCertifiedAmount?.value,p.amounts?.employerCertifiedAmount?.value].some(v=>typeof v==='number'&&Number.isFinite(v)));
 const byNumber=new Map<string,any[]>();
 for(const row of certificates){const k=key(row.paymentId);if(k)byNumber.set(k,[...(byNumber.get(k)??[]),row]);}
 type PaymentLink={reference:string;certificateNumber:string;certificateDate:string|null;paymentDate:string|null;amount:number|null;currency:string|null;state:'linked'|'ambiguous'|'unlinked'|'date_missing'|'cutoff_missing'|'future';certificateReference:string|null;basis:string;sourceRefs:string[]};
 const links:PaymentLink[]=[];const seen=new Set<string>();
 const reviewedRelationships=state.linkCandidateReviews??[],projectVersion=state.version;
 const retain=(reference:string,certificateNumber:string,certificateDate:string|null,paymentDate:string|null,amount:number|null,currency:string|null,sourceRefs:string[])=>{
  const identity=sourceRefs.join('|')+'|'+certificateNumber+'|'+paymentDate;
  if(seen.has(identity))return;seen.add(identity);
  let matches=byNumber.get(key(certificateNumber))??[];
  const reviewed=reviewedRelationships.filter(r=>r.kind==='payment_certificate'&&r.state==='confirmed'&&r.basisVersion===projectVersion&&sourceRefs.includes(r.sourceId));
  const confirmedTargets=new Set(reviewed.map(r=>r.targetId));
  // A saved source-bound choice restricts the candidates; if the selected
  // receipt is missing, unread or incompatible, NEVER silently fall back to
  // another certificate sharing the same business number. This rule applies
  // to source evidence across all projects, not to a particular register.
  if(confirmedTargets.size){
   matches=certificates.filter((r:any)=>refs(r).some(ref=>confirmedTargets.has(ref)));
   // A review can identify a source, but it cannot establish a missing
   // payment currency. Retain the decision; keep linkage unestablished.
   if(!currency)matches=[];
  }

  if(certificateDate)matches=matches.filter(r=>validDate(r.certificationDate)===certificateDate||validDate(r.periodEnd)===certificateDate);
  if(paymentDate)matches=matches.filter(r=>{
   const certified=validDate(r.certificationDate);
   return certified!==null&&certified<=paymentDate;
  });
  if(currency)matches=matches.filter(r=>!r.amounts?.netCertifiedAmount?.currency||r.amounts.netCertifiedAmount.currency===currency);
  const unique=[...new Map(matches.map(r=>[r.paymentId+'|'+r.certificationDate+'|'+refs(r).join('|'),r])).values()];
  // Contradictory confirmed choices must remain visible as a conflict even
  // if only one target passes a later date/currency filter.
  const conflictingChoices=confirmedTargets.size>1;
  const state:PaymentLink['state']=!reportingDate?'cutoff_missing':!paymentDate?'date_missing':!visible(paymentDate)?'future':conflictingChoices?'ambiguous':unique.length===1?'linked':unique.length>1?'ambiguous':'unlinked';
  links.push({reference,certificateNumber,certificateDate,paymentDate,amount,currency,state,
   certificateReference:state==='linked'?unique[0].paymentId:null,
   basis:state==='linked'?(confirmedTargets.size===1?'Explicitly user-confirmed certificate relationship; dates and currency revalidated':'Exact certificate reference and compatible certificate/payment dates; same currency'):
    state==='ambiguous'?(conflictingChoices?'Conflicting confirmed certificate sources require a reviewed choice':'More than one certificate matches; source selection required'):
    state==='future'?'Payment is after the reporting date':state==='cutoff_missing'?'Reporting Data Date is not established; no as-of cash assertion can be made':state==='date_missing'?'Actual payment date is not recorded':
    confirmedTargets.size&&!currency?'Saved source selection retained; payment currency must be established before linkage':
    confirmedTargets.size?'Saved certificate source selection did not meet dated, issued and same-currency evidence checks':
    'No unique dated certificate matches the payment reference',
   sourceRefs:[...new Set([...sourceRefs,...(state==='linked'?refs(unique[0]):[])])]});
 };
 const tables=governedTables((state.evidenceDocuments??[]).filter(d=>d.basisState!=='superseded'),[]);
 for(const table of tables){
  for(const row of table.rows){
   const paymentDate=dateValue(cell(row,'payment date','actual payment date','paid date','receipt date','date paid'));
   const paid=numberValue(cell(row,'paid amount','amount paid','payment amount','receipt amount','amount received'));
   const number=cell(row,'certificate no','certificate number','ipc no','ipc number','payment certificate','certificate ref');
   if(paid===null||!paymentDate)continue;
   if(!number&&!(state.linkCandidateReviews??[]).some(r=>r.kind==='payment_certificate'&&r.state==='confirmed'&&r.basisVersion===state.version&&refs(row).includes(r.sourceId)))continue;
   retain(cell(row,'payment reference','receipt reference','transaction no')||number||refs(row)[0]||'Payment source record',number,dateValue(cell(row,'certificate date','certification date')),paymentDate,paid,cell(row,'currency')||null,refs(row));
  }
 }
 for(const row of ledger.payments??[]){
  const amount=row.amounts?.paidAmount?.value;
  if(typeof amount!=='number'||!row.paymentDate)continue;
  const source=refs(row);if(links.some(link=>link.sourceRefs.some(r=>source.includes(r))))continue;
  retain(row.paymentReference||row.paymentId,row.paymentId,validDate(row.certificationDate),validDate(row.paymentDate),amount,row.amounts?.paidAmount?.currency??null,source);
 }
 const eligible=links.filter(r=>r.state!=='future'&&r.state!=='cutoff_missing'),linked=eligible.filter(r=>r.state==='linked').length;
 const advanceBonds=(ledger.bonds??state.controls?.bonds??[]).filter((r:any)=>/advance|mobilis|mobiliz/i.test([r.bondType,r.type,r.kind,r.name,r.description,r.bondId].join(' ')));
 // F36: the tax basis of the original contract value is taken only from a source
 // that states it for that same amount (contract text or the source cost ledger).
 const contractTaxEvidence:ContractTaxEvidence[]=[
  ...(Array.isArray(state.contractDocuments)&&state.contractDocuments.length&&(position.currencies??[]).some((c:any)=>typeof c.originalContractValue?.value==='number')
   ?contractValueBasisReview(state).rows:[]).filter((r:any)=>r.label!=='Revised Contract Value').map((r:any)=>({currency:r.currency,amount:r.amount,taxBasis:r.taxBasis,sourceRefs:r.sourceRefs??[]})),
  ...(ledger.costPosition??[]).filter((r:any)=>typeof r.values?.['original contract value']==='number').map((r:any)=>({currency:r.currency,amount:r.values['original contract value'],taxBasis:r.taxBasis,
    sourceRefs:(r.receipts??[]).map((x:any)=>'evidence-document:'+x.documentId+':'+x.locator)})),
 ];
 const originalContractTaxBases=(position.currencies??[]).map((c:any)=>({currency:c.currency,...contractTaxBasis(contractTaxEvidence,c.currency,c.originalContractValue?.value??null)}));
 const certifiedRatios=(position.certificateProfile?.groups??[]).map((group:any)=>{
  const currency=(position.currencies??[]).find((c:any)=>c.currency===group.currency);
  const contractTax=originalContractTaxBases.find((c:any)=>c.currency===group.currency)??contractTaxBasis([],group.currency,null);
  return {group,ratio:likeForLikeCertifiedRatio({currency:group.currency,certifiedGrossWork:group.certifiedTotals?.grossWork??null,certificateTaxBasis:group.taxBasis,
   originalContract:currency?.originalContractValue?.value??null,contractTax,asOf:reportingDate,certificateCount:group.certifiedCount??null})};
 });
 const certifiedProgress=certifiedRatios.filter(r=>r.ratio.state==='calculated').map(({group,ratio})=>({currency:group.currency,taxBasis:group.taxBasis,valuePercent:ratio.valuePercent,
    certifiedWork:ratio.certifiedWork,contractValue:ratio.contractValue,contractValueBasis:'original_contract',basis:ratio.basis,sourceRefs:group.sourceRefs??[]}));
 const certifiedProgressNotEstablished=certifiedRatios.filter(r=>r.ratio.state!=='calculated'&&r.ratio.certifiedWork!==null).map(({group,ratio})=>({currency:group.currency,taxBasis:group.taxBasis,
    certifiedWork:ratio.certifiedWork,contractValue:ratio.contractValue,reason:ratio.reason,basis:ratio.basis}));
 return {paymentLinkage:{total:reportingDate?eligible.length:null,linked:reportingDate?linked:null,unlinked:reportingDate?eligible.length-linked:null,coveragePercent:reportingDate&&eligible.length?linked/eligible.length*100:null,rows:links,
   basis:'Dated actual-payment records linked by certificate business reference, date and currency. Unpaid applications are not actual receipts.'},
  heldEvidence:{advancePaymentBonds:{state:advanceBonds.length?'records_present':'not_in_source',count:advanceBonds.length,rows:advanceBonds,
    basis:'Instrument records already held; contractual required cover and current validity remain separate checks.'},
   certificates:{state:certificates.length?'records_present':'not_in_source',count:certificates.length,sourceRefs:certificates.flatMap(refs)},
   certifiedProgress:{state:certifiedProgress.length?'calculated':'not_calculable',rows:certifiedProgress,notEstablished:certifiedProgressNotEstablished,
    missingInputs:certifiedProgress.length?[]:certifiedProgressNotEstablished.length?[...new Set(certifiedProgressNotEstablished.map(r=>r.reason!))]:
     certificates.length?['Comparable original contract value and dated gross certified work by currency on the same tax basis']:['Dated issued certificates']}},
  originalContractTaxBases};
}
