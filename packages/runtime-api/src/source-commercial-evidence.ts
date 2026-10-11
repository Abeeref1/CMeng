import {cell,dateValue,numberValue,governedTables} from '../../truth-kernel/src';
import {linkHash,linkRecordId,activeConfirmedLinks,type LinkContext,type LinkRecord} from './record-link-review';
import type {ProjectRuntimeState} from './project-state-types';

/** Match retained business references, not row positions or amounts. An ambiguous
 * certificate remains unlinked. This projection never writes a cash ledger. */
export function sourceCommercialEvidence(state:ProjectRuntimeState,ledger:any,position:any,cutoff:string|null){
 const key=(v:unknown)=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/^(?:ipc|certificate|cert|payment certificate)\s*(?:no\.?|number|#|:|-)?\s*/i,'').replace(/[\s_-]+/g,'');
 const validDate=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):null;
 const visible=(d:string|null)=>!!d&&(!cutoff||d<=cutoff);
 const refs=(row:any)=>row.receipt?[row.receipt.documentId+':'+row.receipt.locator]:[];
 const certificates=(ledger.payments??[]).filter((p:any)=>visible(p.certificationDate)&&!/appli(?:ed|cation)|submitted|draft|pending certification/i.test(p.sourceStatus??'')&&
   [p.amounts?.grossCertifiedAmount?.value,p.amounts?.netCertifiedAmount?.value,p.amounts?.employerCertifiedAmount?.value].some(v=>typeof v==='number'&&Number.isFinite(v)));
 const byNumber=new Map<string,any[]>();
 for(const row of certificates){const k=key(row.paymentId);if(k)byNumber.set(k,[...(byNumber.get(k)??[]),row]);}
 type PaymentLink={sourceId:string;certificateId:string|null;reference:string;certificateNumber:string;certificateDate:string|null;paymentDate:string|null;amount:number|null;currency:string|null;state:'linked'|'ambiguous'|'unlinked'|'date_missing'|'future'|'confirmed';certificateReference:string|null;confirmedCertificateReferences?:string[];basis:string;sourceRefs:string[]};
 const links:PaymentLink[]=[];const seen=new Set<string>();
 const retain=(reference:string,certificateNumber:string,certificateDate:string|null,paymentDate:string|null,amount:number|null,currency:string|null,sourceRefs:string[])=>{
  const identity=sourceRefs.join('|')+'|'+certificateNumber+'|'+paymentDate;
  if(seen.has(identity))return;seen.add(identity);
  let matches=byNumber.get(key(certificateNumber))??[];
  if(certificateDate)matches=matches.filter(r=>validDate(r.certificationDate)===certificateDate||validDate(r.periodEnd)===certificateDate);
  if(paymentDate)matches=matches.filter(r=>!r.certificationDate||validDate(r.certificationDate)!<=paymentDate);
  if(currency)matches=matches.filter(r=>!r.amounts?.netCertifiedAmount?.currency||r.amounts.netCertifiedAmount.currency===currency);
  const unique=[...new Map(matches.map(r=>[r.paymentId+'|'+r.certificationDate+'|'+refs(r).join('|'),r])).values()];
  const state:PaymentLink['state']=!paymentDate?'date_missing':!visible(paymentDate)?'future':unique.length===1?'linked':unique.length>1?'ambiguous':'unlinked';
  links.push({sourceId:linkRecordId('receipt',[reference,certificateNumber,paymentDate],sourceRefs),certificateId:state==='linked'?linkRecordId('certificate',[unique[0].paymentId,unique[0].certificationDate],refs(unique[0])):null,reference,certificateNumber,certificateDate,paymentDate,amount,currency,state,
   certificateReference:state==='linked'?unique[0].paymentId:null,
   basis:state==='linked'?'Exact certificate reference and compatible certificate/payment dates; same currency':state==='ambiguous'?'More than one certificate matches; source selection required':state==='future'?'Payment is after the reporting date':state==='date_missing'?'Actual payment date is not recorded':'No unique dated certificate matches the payment reference',
   sourceRefs:[...new Set([...sourceRefs,...(state==='linked'?refs(unique[0]):[])])]});
 };
 const tables=governedTables((state.evidenceDocuments??[]).filter(d=>d.basisState!=='superseded'),[]);
 for(const table of tables){
  for(const row of table.rows){
   const paymentDate=dateValue(cell(row,'payment date','actual payment date','paid date','receipt date','date paid'));
   const paid=numberValue(cell(row,'paid amount','amount paid','payment amount','receipt amount','amount received'));
   const number=cell(row,'certificate no','certificate number','ipc no','ipc number','payment certificate','certificate ref');
   if(paid===null)continue;
   if(!number&&!cell(row,'payment reference','receipt reference','transaction no')&&!paymentDate)continue;
   retain(cell(row,'payment reference','receipt reference','transaction no')||number,number,dateValue(cell(row,'certificate date','certification date')),paymentDate,paid,cell(row,'currency')||null,refs(row));
  }
 }
 for(const row of ledger.payments??[]){
  const amount=row.amounts?.paidAmount?.value;
  if(typeof amount!=='number'||!row.paymentDate)continue;
  const source=refs(row);if(links.some(link=>link.sourceRefs.some(r=>source.includes(r))))continue;
  retain(row.paymentReference||row.paymentId,row.paymentId,validDate(row.certificationDate),validDate(row.paymentDate),amount,row.amounts?.paidAmount?.currency??null,source);
 }
 const certificateRows:LinkRecord[]=certificates.map((row:any)=>({id:linkRecordId('certificate',[row.paymentId,row.certificationDate],refs(row)),reference:row.paymentId,label:row.paymentId,text:row.paymentId+' '+row.sourceStatus,sourceRefs:refs(row),date:validDate(row.certificationDate),currency:row.amounts?.netCertifiedAmount?.currency??row.amounts?.grossCertifiedAmount?.currency??null,amount:row.amounts?.netCertifiedAmount?.value??row.amounts?.grossCertifiedAmount?.value??null}));
 const receiptRows:LinkRecord[]=links.filter(row=>row.state!=='future').map(row=>({id:row.sourceId,reference:row.reference||row.certificateNumber||row.sourceRefs[0]||'Payment reference not supplied',label:row.reference||row.certificateNumber||'Payment reference not supplied',text:[row.reference,row.certificateNumber].filter(Boolean).join(' '),sourceRefs:row.sourceRefs,date:row.paymentDate,currency:row.currency,amount:row.amount}));
 const basisHash=linkHash([state.projectId,'payment_certificate',cutoff,receiptRows,certificateRows]);
 const linkContext:LinkContext={kind:'payment_certificate',basisHash,sources:receiptRows,targets:certificateRows,basis:'Existing receipts and issued certificates. A confirmed relationship does not allocate or change cash.'};
 for(const confirmed of activeConfirmedLinks(state.recordLinkReview,linkContext)){
  const row=links.find(item=>item.sourceId===confirmed.sourceId),certificate=certificateRows.find(item=>item.id===confirmed.targetId);
  if(row&&certificate){
   (row.confirmedCertificateReferences??=[]).push(certificate.reference);
   if(row.state!=='linked')Object.assign(row,{state:'confirmed',certificateId:row.confirmedCertificateReferences.length===1?certificate.id:null,certificateReference:row.confirmedCertificateReferences.join('; '),basis:'Relationship confirmed by a verified user against source evidence; cash allocation remains separate.'});
  }
 }
 const eligible=links.filter(r=>r.state!=='future'),linked=eligible.filter(r=>r.state==='linked'||r.state==='confirmed').length;
 const advanceBonds=(ledger.bonds??state.controls?.bonds??[]).filter((r:any)=>/advance|mobilis|mobiliz/i.test([r.bondType,r.type,r.kind,r.name,r.description,r.bondId].join(' ')));
 const certifiedProgress=(position.certificateProfile?.groups??[]).flatMap((group:any)=>{
  const contract=(position.currencies??[]).find((c:any)=>c.currency===group.currency)?.currentContractValue?.value;
  const certified=group.certifiedTotals?.grossWork??null;
  return typeof contract==='number'&&contract>0&&typeof certified==='number'?[{currency:group.currency,taxBasis:group.taxBasis,valuePercent:certified/contract*100,
    certifiedWork:certified,contractValue:contract,basis:'Certified work divided by the same-currency current contract; financial certification, not measured physical completion',sourceRefs:group.sourceRefs??[]}]:[];
 });
 const paymentLinkage={total:eligible.length,linked,unlinked:eligible.length-linked,coveragePercent:eligible.length?linked/eligible.length*100:null,rows:links,
   basis:'Dated actual-payment records linked by certificate business reference, date and currency or verified-user relationship review. A relationship does not establish cash allocation. Unpaid applications are not actual receipts.'};
 // Keep full matching inputs available internally, not copied into every page
 // or export. The paginated review endpoint exposes their actual population.
 Object.defineProperty(paymentLinkage,'linkContext',{value:linkContext,enumerable:false});
 return {paymentLinkage,
  heldEvidence:{advancePaymentBonds:{state:advanceBonds.length?'records_present':'not_in_source',count:advanceBonds.length,rows:advanceBonds,
    basis:'Instrument records already held; contractual required cover and current validity remain separate checks.'},
   certificates:{state:certificates.length?'records_present':'not_in_source',count:certificates.length,sourceRefs:certificates.flatMap(refs)},
   certifiedProgress:{state:certifiedProgress.length?'calculated':'not_calculable',rows:certifiedProgress,
    missingInputs:certifiedProgress.length?[]:certificates.length?['Comparable current contract value and dated gross certified work by currency']:['Dated issued certificates']}}};
}
