import {createHash,randomUUID} from 'node:crypto';
import {quarantineUnconfirmedBoqNumerics,type BoqIngestionResult,type CanonicalBoqCommercialItem} from '../../boq-ingestion/src';
import {boqNumericFingerprint,numericFields,type BoqNumericConfirmation,type BoqNumericValues} from '../../boq-ingestion/src/numeric-confirmation';
import type {ProjectRuntimeState} from './project-state-types';
import {normalizeProjectCode} from './project-identity';

export type BoqNumericReviewDecision=BoqNumericConfirmation&{ingestionId:string;batchId:string;note:string};
export interface BoqNumericReviewInput {
  batchId:string;reviewToken:string;reviewedSource:boolean;
  items:Array<{ingestionId:string;sourceHash:string;itemId:string;fingerprint:string;values:BoqNumericValues}>;
}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function reviewableBoqs(state:ProjectRuntimeState):BoqIngestionResult[]{
 const sources=[...state.boqRevisions,...state.boq?[state.boq]:[]];
 return [...new Map(sources.filter(b=>normalizeProjectCode(b.projectId)===state.projectId).filter(b=>{
   const documents=state.evidenceDocuments.filter(d=>d.sourceHashSha256===b.sourceHashSha256&&(d.linkedArtifactId===b.ingestionId||d.boqTableRead?.ingestionId===b.ingestionId));
   return !documents.length||documents.some(d=>['candidate','active','additive'].includes(d.basisState));
 }).map(b=>[b.ingestionId,b])).values()];
}
export function applyBoqNumericReviews(boq:BoqIngestionResult,state:ProjectRuntimeState):BoqIngestionResult {
 const readings=quarantineUnconfirmedBoqNumerics(boq),decisions=state.boqNumericReviews??[];
 if(!decisions.length)return readings;
 const byItem=new Map(decisions.filter(d=>d.projectId===state.projectId&&d.sourceHash===boq.sourceHashSha256).map(d=>[d.itemId,d]));
 let changed=false;
 const canonicalItems=readings.canonicalItems.map(item=>{
   const d=byItem.get(item.itemId);
   if(!d||d.fingerprint!==boqNumericFingerprint(item))return item;
   changed=true;
   return {...item,numericConfirmation:{...d,projectId:boq.projectId,revisionId:boq.evidenceReceipt.revisionId}};
 });
 return changed?quarantineUnconfirmedBoqNumerics({...readings,canonicalItems}):readings;
}
function observation(item:CanonicalBoqCommercialItem):BoqNumericValues {
 return item.sourceNumericReadings??{quantity:item.quantity,rate:item.rate,amount:item.amount};
}
function reasons(item:CanonicalBoqCommercialItem):string[]{
 const codes=item.diagnostics,out:string[]=[];
 if(codes.includes('BOQ_AMOUNT_ARITHMETIC_MISMATCH'))out.push('Quantity × rate does not agree with the amount.');
 if(numericFields.some(f=>observation(item)[f]===null))out.push('Some figures were not supplied or could not be read; leave genuinely absent fields blank.');
 if(!out.length)out.push('Scanned figures need a source check. Repeated readings alone do not confirm the number.');
 return out;
}
export function boqNumericReview(state:ProjectRuntimeState){
 const sources=reviewableBoqs(state).map(raw=>{
   const effective=applyBoqNumericReviews(raw,state),byId=new Map(effective.canonicalItems.map(i=>[i.itemId,i]));
   const pending=quarantineUnconfirmedBoqNumerics(raw).canonicalItems.filter(i=>i.sourceNumericReadings&&!byId.get(i.itemId)?.numericConfirmation);
   const document=state.evidenceDocuments.find(d=>d.sourceHashSha256===raw.sourceHashSha256&&(d.linkedArtifactId===raw.ingestionId||d.boqTableRead?.ingestionId===raw.ingestionId));
   return {ingestionId:raw.ingestionId,sourceHash:raw.sourceHashSha256,revisionId:raw.evidenceReceipt.revisionId,
     filename:raw.sourceFilename??document?.sourceFilename??'BOQ',itemCount:raw.canonicalItems.length,
     pendingCount:pending.length,confirmedCount:effective.canonicalItems.filter(i=>i.numericConfirmation).length,
     automaticCount:effective.canonicalItems.filter(i=>!i.sourceNumericReadings).length,
     sourceAvailable:!!document?.storedPath,mediaType:raw.mediaType,
     rows:pending.map(item=>({itemId:item.itemId,fingerprint:boqNumericFingerprint(item),itemNumber:item.itemNumber,
       description:item.description,unit:item.unit,currency:item.currency,values:observation(item),reasons:reasons(item),
       page:Number(item.sourceRefs.map(r=>/(?:^|:)pdf:page:(\d+)/.exec(r)?.[1]).find(Boolean))||null,
       sourceRefs:item.sourceRefs,sourceCellEvidence:item.sourceCellEvidence??null,
       arithmeticConflict:item.diagnostics.includes('BOQ_AMOUNT_ARITHMETIC_MISMATCH')}))};
 });
 const reviewToken=hash([state.projectId,sources.map(s=>[s.ingestionId,s.sourceHash,s.revisionId,s.rows.map(r=>[r.itemId,r.fingerprint])]),state.boqNumericReviews??[]]);
 return {projectId:state.projectId,projectVersion:state.version,reviewToken,sources,
   pendingCount:sources.reduce((n,s)=>n+s.pendingCount,0),confirmedCount:sources.reduce((n,s)=>n+s.confirmedCount,0),
   automaticCount:sources.reduce((n,s)=>n+s.automaticCount,0),
   basis:'Review unresolved source readings together. Saved decisions are reused throughout the project; they do not approve the document or certify installed work.'};
}
/** Validate the whole batch before changing state. A retry is exactly idempotent. */
export function prepareBoqNumericReview(state:ProjectRuntimeState,input:BoqNumericReviewInput,actor:string){
 if(!input||typeof input.batchId!=='string'||!input.batchId.trim()||input.batchId.length>100)throw new Error('A review reference is required.');
 const payloadHash=hash(input),prior=state.boqNumericReviewBatches?.find(b=>b.batchId===input.batchId);
 if(prior){if(prior.payloadHash!==payloadHash)throw new Error('This review reference was already used for different values.');return {duplicate:true,payloadHash,decisions:[] as BoqNumericReviewDecision[]};}
 if(input.reviewToken!==boqNumericReview(state).reviewToken)throw new Error('The BOQ readings changed. Reopen this review before saving; your previous confirmations remain saved.');
 if(input.reviewedSource!==true)throw new Error('Check the selected figures against the original source before saving.');
 if(!Array.isArray(input.items)||!input.items.length||input.items.length>100000)throw new Error('Select the reviewed items to save.');
 const sources=new Map(reviewableBoqs(state).map(b=>[b.ingestionId,quarantineUnconfirmedBoqNumerics(b)])),seen=new Set<string>();
 const sourceItems=new Map([...sources].map(([id,boq])=>[id,new Map(boq.canonicalItems.map(item=>[item.itemId,item]))]));
 const confirmedAt=new Date().toISOString();
 const decisions=input.items.map(row=>{
   const boq=sources.get(row.ingestionId),item=sourceItems.get(row.ingestionId)?.get(row.itemId),key=row.ingestionId+':'+row.itemId;
   if(!boq||boq.sourceHashSha256!==row.sourceHash||!item||!item.sourceNumericReadings||boqNumericFingerprint(item)!==row.fingerprint)throw new Error('A selected BOQ item or its original source has changed.');
   if(seen.has(key))throw new Error('The same BOQ item was submitted twice.');seen.add(key);
   const values=row.values;
   if(!values||Object.keys(values).some(k=>!numericFields.includes(k as any))||!numericFields.every(f=>values[f]===null||typeof values[f]==='number'&&Number.isFinite(values[f])))throw new Error('Enter a finite number or leave an absent field blank.');
   if(numericFields.every(f=>values[f]===null))throw new Error('An unreadable row cannot be confirmed as three empty figures. Leave it for review or provide a clearer source.');
   const {quantity:q,rate:r,amount:a}=values;
   if(q!==null&&r!==null&&a!==null&&Math.abs(q*r-a)>Math.max(.02,Math.abs(a)*.0001))throw new Error('Item '+(item.itemNumber??item.itemId)+': quantity × rate does not agree with the amount. Check the original before saving.');
   return {decisionId:randomUUID(),projectId:state.projectId,sourceHash:boq.sourceHashSha256,revisionId:boq.evidenceReceipt.revisionId,
     itemId:item.itemId,ingestionId:boq.ingestionId,fingerprint:row.fingerprint,values:{...values},confirmedAt,confirmedBy:actor,
     batchId:input.batchId,note:'Source readings reviewed together; original file and readings retained.'};
 });
 return {duplicate:false,payloadHash,decisions};
}
