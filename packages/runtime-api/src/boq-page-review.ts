import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {ProjectRuntimeState} from './project-state-types';
import {reviewableBoqs,applyBoqNumericReviews} from './boq-numeric-review';
import {numericFields} from '../../boq-ingestion/src/numeric-confirmation';
import {boqItemPage,boqItemsByPage,boqPageCount,boqPageFingerprint,latestBoqPageDecisions,reviewHash,type BoqPageItem,type BoqPageDecision} from './boq-page-projection';
export interface BoqPageReviewInput {
 requestId:string;reviewToken:string;ingestionId:string;sourceHash:string;revisionId:string;page:number;
 action:'confirm'|'reopen';reviewedSource:boolean;items:BoqPageItem[];note:string;
}
export function boqPageReviewPendingCount(state:ProjectRuntimeState){
 let pending=0;
 for(const raw of reviewableBoqs(state).filter(b=>b.sourceFormat==='pdf')){
  const count=boqPageCount(raw),decisions=state.boqPageReviews?.length?latestBoqPageDecisions(raw,state):new Map<number,BoqPageDecision>();
  const unresolved=new Set(raw.sourcePageCoverage?.unresolvedPages??(raw.complete?[]:Array.from({length:count},(_,i)=>i+1)));
  for(let page=1;page<=count;page++){const decision=decisions.get(page);if(decision?.action==='reopen'||unresolved.has(page)&&decision?.action!=='confirm')pending++;}
 }return pending;
}
export function boqPageReview(state:ProjectRuntimeState){
 const sources=reviewableBoqs(state).filter(b=>b.sourceFormat==='pdf').map(raw=>{
  const effective=applyBoqNumericReviews(raw,state),count=boqPageCount(raw);
  const originalPages=boqItemsByPage(raw),effectivePages=boqItemsByPage(effective),decisions=latestBoqPageDecisions(raw,state,originalPages);
  const unresolvedPages=new Set(raw.sourcePageCoverage?.unresolvedPages??[]);
  const document=state.evidenceDocuments.find(d=>d.sourceHashSha256===raw.sourceHashSha256&&(d.linkedArtifactId===raw.ingestionId||d.boqTableRead?.ingestionId===raw.ingestionId));
  const pages=Array.from({length:count},(_,i)=>{
   const page=i+1,decision=decisions.get(page),originals=originalPages.get(page)??[];
   const automaticComplete=raw.sourcePageCoverage?!unresolvedPages.has(page):raw.complete;
   const status=decision?.action==='confirm'?'confirmed':decision?.action==='reopen'?'reopened':automaticComplete?'automatic':'needs_review';
   const fromItems=(effectivePages.get(page)??[]).map(item=>({id:item.itemId,origins:[item.itemId],kind:'item' as const,
    itemNumber:item.itemNumber,section:item.section,description:item.description,unit:item.unit,currency:item.currency,
    values:item.numericConfirmation?.values??item.sourceNumericReadings??{quantity:item.quantity,rate:item.rate,amount:item.amount},note:''}));
   const items=decision?.items??fromItems;
   const reviewToken=reviewHash([state.projectId,boqPageFingerprint(raw,page,originals),decision??null,items]);
   return {page,status,reviewToken,automaticItemCount:originals.length,addedItemCount:decision?.action==='confirm'?items.filter(r=>r.kind==='item'&&!r.origins.length).length:0,
    reviewedItemCount:decision?.action==='confirm'?items.filter(r=>r.kind==='item').length:null,items,note:decision?.note??'',
    confirmedAt:decision?.action==='confirm'?decision.confirmedAt:null,confirmedBy:decision?.action==='confirm'?decision.confirmedBy:null};
  });
  return {ingestionId:raw.ingestionId,sourceHash:raw.sourceHashSha256,revisionId:raw.evidenceReceipt.revisionId,filename:raw.sourceFilename??'BOQ',
   sourceAvailable:!!document?.storedPath,pages,automaticItemCount:raw.canonicalItems.length,automaticCoveragePercent:raw.sourcePageCoverage?.automaticCoveragePercent??raw.coveragePercent,
   reviewedCoveragePercent:count?Number((pages.filter(p=>['confirmed','automatic'].includes(p.status)).length/count*100).toFixed(4)):null};
 });
 return {projectId:state.projectId,sources,pendingPageCount:sources.flatMap(s=>s.pages).filter(p=>['needs_review','reopened'].includes(p.status)).length};
}
export function prepareBoqPageReview(state:ProjectRuntimeState,input:BoqPageReviewInput,actor:string){
 if(!input||typeof input.requestId!=='string'||!input.requestId.trim()||input.requestId.length>100)throw Error('A page review reference is required.');
 const payloadHash=reviewHash(input),prior=state.boqPageReviews?.find(d=>d.requestId===input.requestId);
 if(prior){if(prior.payloadHash!==payloadHash)throw Error('This review reference was used for different values.');return {duplicate:true,decision:prior};}
 const raw=reviewableBoqs(state).find(b=>b.ingestionId===input.ingestionId&&b.sourceHashSha256===input.sourceHash&&b.evidenceReceipt.revisionId===input.revisionId);
 const view=boqPageReview(state).sources.find(s=>s.ingestionId===input.ingestionId),page=view?.pages.find(p=>p.page===input.page);
 if(!raw||!view||!page||page.reviewToken!==input.reviewToken)throw Error('This page or its saved review changed. Reopen the source review.');
 if(!['confirm','reopen'].includes(input.action))throw Error('Choose confirm or reopen.');
 if(input.action==='confirm'&&page.status==='confirmed')throw Error('Reopen this saved page before correcting it.');
 if(input.action==='reopen'&&page.status!=='confirmed')throw Error('Only a confirmed page can be reopened.');
 const note=typeof input.note==='string'?input.note.trim():'';
 if(note.length>4000)throw Error('Keep the review note within 4000 characters.');
 let items=page.items;
 if(input.action==='confirm'){
  if(input.reviewedSource!==true)throw Error('Check the complete source page before confirming.');
  const document=state.evidenceDocuments.find(d=>d.sourceHashSha256===raw.sourceHashSha256&&(d.linkedArtifactId===raw.ingestionId||d.boqTableRead?.ingestionId===raw.ingestionId));
  if(!document?.storedPath||createHash('sha256').update(readFileSync(document.storedPath)).digest('hex')!==raw.sourceHashSha256)throw Error('The original source is unavailable or its identity changed.');
  if(!Array.isArray(input.items)||input.items.length>10000)throw Error('The page item list is invalid.');
  const originalIds=new Set(raw.canonicalItems.filter(i=>boqItemPage(i)===input.page).map(i=>i.itemId));
  const seen=new Set<string>(),accounted=new Set<string>();
  items=input.items.map(row=>{
   if(!row||typeof row.id!=='string'||!row.id.trim()||row.id.length>200||seen.has(row.id))throw Error('Every page item needs a unique reference.');seen.add(row.id);
   if(!Array.isArray(row.origins)||new Set(row.origins).size!==row.origins.length||row.origins.some(id=>!originalIds.has(id)))throw Error('A row refers to another page or source.');
   row.origins.forEach(id=>accounted.add(id));
   const text=(value:unknown,required=false)=>{if(value===null&&!required)return null;if(typeof value!=='string'||value.length>20000||required&&!value.trim())throw Error('Enter a readable item description and valid text fields.');return value.trim()||null;};
   if(!['item','non_item'].includes(row.kind))throw Error('Choose item or source heading.');
   const rowNote=text(row.note)??'';
   if(row.kind==='non_item'&&!rowNote)throw Error('Explain why this retained source text is not a BOQ item.');
   if(!row.values||Object.keys(row.values).some(k=>!numericFields.includes(k as any))||!numericFields.every(f=>row.values[f]===null||typeof row.values[f]==='number'&&Number.isFinite(row.values[f])))throw Error('Figures must be finite numbers or blank.');
   const {quantity:q,rate:r,amount:a}=row.values;
   if(row.kind==='item'&&q!==null&&r!==null&&a!==null&&Math.abs(q*r-a)>Math.max(.02,Math.abs(a)*.0001))throw Error('Quantity × rate does not agree with amount. Check the source before saving.');
   if(row.kind==='item'&&q===null&&!rowNote)throw Error('Explain a missing source quantity; it remains unresolved, never zero.');
   return {id:row.id,origins:[...row.origins],kind:row.kind,itemNumber:text(row.itemNumber),section:text(row.section),description:text(row.description,true)!,unit:text(row.unit),currency:text(row.currency),values:{...row.values},note:rowNote};
  });
  if([...originalIds].some(id=>!accounted.has(id)))throw Error('An extracted item is missing from this review. Keep it, combine it, or explain it as source heading text.');
  if(!items.some(i=>i.kind==='item')&&!note)throw Error('Explain why this source page has no BOQ items.');
 }
 const decision:BoqPageDecision={decisionId:randomUUID(),requestId:input.requestId,payloadHash,projectId:state.projectId,
  ingestionId:raw.ingestionId,sourceHash:raw.sourceHashSha256,revisionId:raw.evidenceReceipt.revisionId,page:input.page,
  sourceFingerprint:boqPageFingerprint(raw,input.page),action:input.action,items,note,confirmedAt:new Date().toISOString(),confirmedBy:actor};
 return {duplicate:false,decision};
}
