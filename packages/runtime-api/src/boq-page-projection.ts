import {normalizeProjectCode} from './project-identity';
import {createHash} from 'node:crypto';
import {quarantineUnconfirmedBoqNumerics,type BoqIngestionResult,type CanonicalBoqCommercialItem} from '../../boq-ingestion/src';
import {boqNumericFingerprint,type BoqNumericValues} from '../../boq-ingestion/src/numeric-confirmation';
import type {ProjectRuntimeState} from './project-state-types';

export interface BoqPageItem {
 id:string;origins:string[];kind:'item'|'non_item';itemNumber:string|null;section:string|null;
 description:string;unit:string|null;currency:string|null;values:BoqNumericValues;note:string;
}
export interface BoqPageDecision {
 decisionId:string;requestId:string;payloadHash:string;projectId:string;ingestionId:string;sourceHash:string;revisionId:string;
 page:number;sourceFingerprint:string;action:'confirm'|'reopen';items:BoqPageItem[];note:string;confirmedAt:string;confirmedBy:string;
}
export const reviewHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function boqItemPage(item:CanonicalBoqCommercialItem){
 return Number(item.sourceRefs.map(ref=>/(?:^|:)pdf:page:(\d+)(?::|$)/.exec(ref)?.[1]).find(Boolean))||null;
}
export function boqPageCount(boq:BoqIngestionResult){return boq.sourcePageCoverage?.totalPages??boq.pdfRead?.totalPages??0;}
export function boqItemsByPage(boq:BoqIngestionResult){
 const pages=new Map<number,CanonicalBoqCommercialItem[]>();
 for(const item of boq.canonicalItems){const page=boqItemPage(item)??0;const rows=pages.get(page)??[];rows.push(item);pages.set(page,rows);}return pages;
}
export function boqPageFingerprint(boq:BoqIngestionResult,page:number,items=boq.canonicalItems.filter(i=>boqItemPage(i)===page)){
 return reviewHash([boq.projectId,boq.ingestionId,boq.sourceHashSha256,boq.evidenceReceipt.revisionId,page,boqPageCount(boq),
  items.map(i=>[i.itemId,boqNumericFingerprint(i)])]);
}
export function latestBoqPageDecisions(boq:BoqIngestionResult,state:ProjectRuntimeState,pages=boqItemsByPage(boq)){
 const latest=new Map<number,BoqPageDecision>(),fingerprints=new Map<number,string>();
 if(normalizeProjectCode(boq.projectId)!==state.projectId)return latest;
 for(const d of state.boqPageReviews??[]){
  if(d.projectId!==state.projectId||d.ingestionId!==boq.ingestionId||d.sourceHash!==boq.sourceHashSha256||d.revisionId!==boq.evidenceReceipt.revisionId||d.page<1||d.page>boqPageCount(boq))continue;
  if(!fingerprints.has(d.page))fingerprints.set(d.page,boqPageFingerprint(boq,d.page,pages.get(d.page)??[]));
  if(d.sourceFingerprint===fingerprints.get(d.page))latest.set(d.page,d);
 }return latest;
}
export function applyBoqPageReviews(boq:BoqIngestionResult,state:ProjectRuntimeState):BoqIngestionResult {
 if(boq.sourceFormat!=='pdf'||!state.boqPageReviews?.length)return boq;
 // Bind against the retained reader receipt, not a numeric overlay or the output of an earlier page review.
 const raw=[state.boq,...state.boqRevisions].find(b=>b&&b.ingestionId===boq.ingestionId&&b.sourceHashSha256===boq.sourceHashSha256&&b.evidenceReceipt.revisionId===boq.evidenceReceipt.revisionId);
 if(!raw)return boq;
 const count=boqPageCount(raw),allPages=Array.from({length:count},(_,i)=>i+1);
 const decisions=[...latestBoqPageDecisions(raw,state).values()].sort((a,b)=>a.page-b.page),effectivePages=boqItemsByPage(boq);
 if(!decisions.length)return boq;
 const confirmed=decisions.filter(d=>d.action==='confirm'),reopened=new Set(decisions.filter(d=>d.action==='reopen').map(d=>d.page));
 const byPage=new Map(confirmed.map(d=>[d.page,d]));
 const originals=new Map(raw.canonicalItems.map(i=>[i.itemId,i]));
 const output:CanonicalBoqCommercialItem[]=[];
 for(const page of allPages){
  const decision=byPage.get(page);
  if(!decision){output.push(...(effectivePages.get(page)??[]));continue;}
  const originUse=new Map<string,number>();
  for(const row of decision.items)if(row.kind==='item')for(const id of row.origins)originUse.set(id,(originUse.get(id)??0)+1);
  for(const row of decision.items.filter(i=>i.kind==='item')){
   const previous=row.origins.length===1?originals.get(row.origins[0]!):undefined;
   const sameScope=previous&&originUse.get(previous.itemId)===1&&['itemNumber','section','description','unit','currency'].every(k=>previous[k as keyof typeof previous]===row[k as keyof typeof row]);
   const item:CanonicalBoqCommercialItem={itemId:sameScope?previous!.itemId:'review:'+decision.decisionId+':'+row.id,
    itemNumber:row.itemNumber,section:row.section,description:row.description,unit:row.unit,currency:row.currency,
    quantity:null,rate:null,amount:null,sourceNumericReadings:{...row.values},sourceFormat:'pdf',
    sourceRefs:['evidence-receipt:'+raw.evidenceReceipt.receiptId,'sha256:'+raw.sourceHashSha256+':pdf:page:'+page+':review:'+decision.decisionId,
     ...row.origins.map(id=>'original-item:'+id)],
    status:row.values.quantity!==null&&row.unit!==null?'verified':'unresolved',diagnostics:['BOQ_PAGE_SOURCE_REVIEWED']};
   item.numericConfirmation={decisionId:decision.decisionId,projectId:boq.projectId,sourceHash:raw.sourceHashSha256,
    revisionId:raw.evidenceReceipt.revisionId,itemId:item.itemId,fingerprint:boqNumericFingerprint(item),values:{...row.values},
    confirmedAt:decision.confirmedAt,confirmedBy:decision.confirmedBy};
   output.push(item);
  }
 }
 // An unlocated original item cannot silently vanish through page review.
 for(const [page,items] of effectivePages)if(page<1||page>count)output.push(...items);
 const autoUnresolved=new Set(raw.sourcePageCoverage?.unresolvedPages??(raw.complete?[]:allPages));
 const pending=allPages.filter(page=>reopened.has(page)||(autoUnresolved.has(page)&&!byPage.has(page)));
 const coverage=count?Number(((count-pending.length)/count*100).toFixed(4)):null;
 const unlocated=output.some(i=>!boqItemPage(i));
 const effective=quarantineUnconfirmedBoqNumerics({...boq,canonicalItems:output});
 const unresolved=effective.canonicalItems.filter(i=>i.status==='unresolved').length;
 const complete=count>0&&!pending.length&&!unlocated&&!unresolved&&effective.canonicalItems.length>0;
 return {...effective,complete,state:complete?'verified_candidate':'partial_candidate',verifiedRows:output.length-unresolved,unresolvedRows:unresolved,
  // Preserve the extractor's metric. Reviewed coverage is a separate, explicitly named field.
  coveragePercent:boq.coveragePercent,
  sourceReview:{automaticItemCount:raw.canonicalItems.length,
   addedItemCount:confirmed.flatMap(d=>d.items).filter(r=>r.kind==='item'&&!r.origins.length).length,
   reviewedItemCount:confirmed.flatMap(d=>d.items).filter(r=>r.kind==='item').length,
   confirmedPages:confirmed.map(d=>d.page),pendingPages:pending,coveragePercent:coverage},
  diagnostics:[...new Set([...boq.diagnostics,'BOQ_SOURCE_PAGE_REVIEW_APPLIED',...(!complete?['BOQ_SOURCE_POPULATION_INCOMPLETE']:[])])]};
}
