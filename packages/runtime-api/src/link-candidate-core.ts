import {createHash} from 'node:crypto';
export type LinkKind='boq_activity'|'payment_certificate';
export interface LinkEntity {id:string;projectId:string;reference:string;description:string;sourceRefs:string[];unit?:string|null;area?:string|null;currency?:string|null;amount?:number|null;dateIso?:string|null;certified?:boolean;party?:string|null}
export interface LinkInput {kind:LinkKind;projectId:string;basisVersion:number;dataDateIso:string|null;source:LinkEntity;targets:LinkEntity[];requestHash:string}
export interface LinkCandidate {id:string;kind:LinkKind;projectId:string;basisVersion:number;requestHash:string;sourceId:string;targetId:string;sourceLabel:string;targetLabel:string;confidence:number;reason:string;sourceRefs:string[];state:'candidate'|'confirmed'|'rejected';proposedAt:string;reviewedAt?:string;reviewedBy?:string;reviewActor?:string}
export const linkHash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const norm=(v:unknown)=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export function compatibleLink(kind:LinkKind,source:LinkEntity,target:LinkEntity,cutoff:string|null):string|null{
 if(source.projectId!==target.projectId)return 'different_project';
 if(kind==='boq_activity'){
  if(source.area&&target.area&&norm(source.area)!==norm(target.area))return 'different_explicit_scope';
  if(source.unit&&target.unit&&norm(source.unit)!==norm(target.unit))return 'different_units';
  return null;
 }
 if(target.certified!==true)return 'not_an_issued_certificate';
 if(!source.currency||!target.currency)return 'currency_not_established';
 if(source.currency.toUpperCase()!==target.currency.toUpperCase())return 'different_currency';
 if(!cutoff||!source.dateIso||!target.dateIso)return 'dated_payment_and_certification_required';
 if(source.dateIso>cutoff||target.dateIso>cutoff)return 'after_reporting_date';
 if(target.dateIso>source.dateIso)return 'payment_precedes_certification';
 if(typeof source.amount!=='number'||!Number.isFinite(source.amount)||source.amount<=0)return 'paid_amount_not_established';
 if(source.party&&target.party&&norm(source.party)!==norm(target.party))return 'different_payee';
 return null;
}
export function assessLinkProposal(input:LinkInput,proposal:any):LinkCandidate[]{
 if(!proposal||proposal.projectId!==input.projectId||proposal.requestHash!==input.requestHash||proposal.sourceId!==input.source.id||!Array.isArray(proposal.matches)||proposal.matches.length>5)return [];
 if(Object.keys(proposal).some(k=>!['projectId','requestHash','sourceId','matches'].includes(k)))return [];
 const targets=new Map(input.targets.map(x=>[x.id,x])),used=new Set<string>(),out:LinkCandidate[]=[];
 for(const p of proposal.matches){
  if(!p||Object.keys(p).some(k=>!['targetId','confidence','reason','sourceRefs'].includes(k))||typeof p.targetId!=='string'||used.has(p.targetId))continue;
  const target=targets.get(p.targetId);if(!target||compatibleLink(input.kind,input.source,target,input.dataDateIso))continue;
  if(typeof p.confidence!=='number'||!Number.isFinite(p.confidence)||p.confidence<0.9||p.confidence>1||typeof p.reason!=='string'||p.reason.trim().length<8||p.reason.length>1000)continue;
  const refs=new Set([...input.source.sourceRefs,...target.sourceRefs]);
  if(!Array.isArray(p.sourceRefs)||!p.sourceRefs.length||p.sourceRefs.some((x:any)=>typeof x!=='string'||!refs.has(x))||!p.sourceRefs.some((x:string)=>input.source.sourceRefs.includes(x))||!p.sourceRefs.some((x:string)=>target.sourceRefs.includes(x)))continue;
  used.add(p.targetId);out.push({id:'link-'+linkHash([input.kind,input.projectId,input.requestHash,input.source.id,p.targetId]).slice(0,24),kind:input.kind,projectId:input.projectId,basisVersion:input.basisVersion,requestHash:input.requestHash,sourceId:input.source.id,targetId:p.targetId,sourceLabel:input.source.reference+' · '+input.source.description,targetLabel:target.reference+' · '+target.description,confidence:p.confidence,reason:p.reason.trim(),sourceRefs:[...new Set<string>(p.sourceRefs)],state:'candidate',proposedAt:new Date().toISOString()});
 }
 return out;
}
export function reviewLink(rows:LinkCandidate[],id:string,version:number,review:{decision:'confirm'|'reject';confirmed:boolean;reviewer:string;actor:string}):LinkCandidate[]{
 const record=rows.find(r=>r.id===id);if(!record)throw Error('LINK_CANDIDATE_NOT_FOUND');
 if(record.basisVersion!==version)throw Error('LINK_SOURCE_CHANGED');
 if(review.confirmed!==true||!review.reviewer.trim()||!review.actor.trim())throw Error('LINK_EXPLICIT_REVIEW_REQUIRED');
 if(!['confirm','reject'].includes(review.decision))throw Error('LINK_REVIEW_INVALID');
 if(record.state!=='candidate'&&!(record.state==='confirmed'&&review.decision==='reject'))throw Error('LINK_ALREADY_REVIEWED');
 // One explicit receipt relationship at a time. Split-payment allocation is a
 // separate documented financial operation, never guessed by this matcher.
 if(review.decision==='confirm'&&record.kind==='payment_certificate'&&rows.some(r=>r.id!==id&&r.kind===record.kind&&r.sourceId===record.sourceId&&r.state==='confirmed'&&r.basisVersion===version))throw Error('PAYMENT_ALREADY_LINKED');
 return rows.map(r=>({...r,...(r.basisVersion===version?{basisVersion:version+1}:{}),...(r.id===id?{state:review.decision==='confirm'?'confirmed' as const:'rejected' as const,reviewedAt:new Date().toISOString(),reviewedBy:review.reviewer.trim(),reviewActor:review.actor}:{})}));
}
export function shortlistLinks(kind:LinkKind,source:LinkEntity,targets:LinkEntity[],cutoff:string|null,limit=50,offset=0){
 const words=(v:string)=>new Set(norm(v).split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1));
 const sw=words(source.reference+' '+source.description+' '+(source.area??''));
 const eligible=targets.filter(t=>!compatibleLink(kind,source,t,cutoff));
 const ranked=eligible.map(t=>{const ts=words(t.reference+' '+t.description+' '+(t.area??''));let score=0;for(const w of sw)if(ts.has(w))score++;return{entity:t,score};}).sort((a,b)=>b.score-a.score||a.entity.id.localeCompare(b.entity.id));
 const batchSize=Math.max(1,Math.min(100,Math.trunc(limit)||50)),start=Math.max(0,Math.trunc(offset)||0),end=Math.min(ranked.length,start+batchSize);
 return {eligibleCount:eligible.length,screenedCount:targets.length,offset:start,batchSize:end-start,hasMore:end<ranked.length,nextOffset:end<ranked.length?end:null,
  targets:ranked.slice(start,end).map(r=>r.entity)};
}
