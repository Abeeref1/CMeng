import type {IncomingMessage,ServerResponse} from 'node:http';
import {auditContext} from './audit-context';
import {runtimeProjects} from './project-state';
import {sendHttpBody} from './http-response';
import {configuredAskModel,askProviderConfiguration} from '../../project-ask/src/provider';
import {currentLinkContext} from './link-review-context';
import {compatibleLink,latestLinkDecision,proposeRecordLinks,type RecordLinkKind,type RecordLinkReview} from './record-link-review';
const send=(res:ServerResponse,status:number,value:unknown)=>sendHttpBody(res,status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},JSON.stringify(value));
async function input(req:IncomingMessage){let bytes=0;const chunks:Buffer[]=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>16_384)throw new Error('Request is too large.');chunks.push(Buffer.from(chunk));}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}') as Record<string,unknown>;}
const kindOf=(value:unknown):RecordLinkKind|null=>value==='boq_activity'||value==='payment_certificate'?value:null;
const windows=new Map<string,Promise<void>>();
async function lock<T>(id:string,work:()=>Promise<T>){const previous=windows.get(id)??Promise.resolve();let release!:()=>void;const tail=new Promise<void>(resolve=>{release=resolve;});windows.set(id,tail);await previous;try{return await work();}finally{release();if(windows.get(id)===tail)windows.delete(id);}}
export async function linkReviewRequest(req:IncomingMessage,res:ServerResponse,url:URL):Promise<boolean>{
 const route=/^\/api\/projects\/([^/]+)\/link-review(?:\/(propose|decide))?$/.exec(url.pathname);if(!route)return false;
 const state=runtimeProjects.get(decodeURIComponent(route[1]!));if(!state){send(res,404,{error:'project_not_found'});return true;}
 const actor=auditContext().actor,verified=actor.kind==='user'&&actor.identityVerified;
 const configuration=askProviderConfiguration();
 const allowedModel=/^gpt-4(?:o)?(?:[.-]|$)/i.test(configuration.model??'');
 const mayUseAi=verified&&req.headers['x-cmeng-paid-ai']==='1'&&configuration.configured&&allowedModel;
 try{
  if(req.method==='GET'&&!route[2]){
   const kind=kindOf(url.searchParams.get('kind'));if(!kind){send(res,400,{error:'link_kind_required'});return true;}
   const context=currentLinkContext(state,kind),review=state.recordLinkReview;
   const offset=Number(url.searchParams.get('offset')??0),q=String(url.searchParams.get('q')??'').trim().toLowerCase().slice(0,120);
   if(!Number.isSafeInteger(offset)||offset<0){send(res,400,{error:'invalid_offset'});return true;}
   const rows=(review?.candidates??[]).filter(row=>row.kind===kind).map(row=>({...row,state:row.basisHash!==context.basisHash?'source_changed':latestLinkDecision(review,row.id)?.decision??'candidate'}));
   const matchingSources=context.sources.filter(row=>!q||row.label.toLowerCase().includes(q)||row.reference.toLowerCase().includes(q));
   const visibleSources=matchingSources.slice(offset,offset+10),ids=new Set(visibleSources.map(row=>row.id));
   send(res,200,{projectId:state.projectId,projectVersion:state.version,kind,basisHash:context.basisHash,basis:context.basis,
    providerConfigured:configuration.configured,providerAllowed:mayUseAi,confirmationAllowed:verified,
    providerState:!configuration.configured?'not_configured':!verified?'verified_owner_access_required':!allowedModel?'configured_model_outside_agreed_GPT4_policy':mayUseAi?'available':'paid_provider_permission_required',
    sources:visibleSources,totalSources:context.sources.length,matchingSources:matchingSources.length,totalTargets:context.targets.length,offset,hasMore:offset+10<matchingSources.length,
    candidates:rows.filter(row=>ids.has(row.sourceId)),counts:{proposed:rows.filter(row=>row.state==='candidate').length,confirmed:rows.filter(row=>row.state==='confirmed').length,rejected:rows.filter(row=>row.state==='rejected').length,sourceChanged:rows.filter(row=>row.state==='source_changed').length},
    valuesChanged:false,allocationsChanged:false});return true;
  }
  if(req.method!=='POST'||!route[2]){send(res,405,{error:'method_not_allowed'});return true;}
  const body=await input(req),kind=kindOf(body.kind);if(!kind){send(res,400,{error:'link_kind_required'});return true;}
  await lock(state.projectId,async()=>{
   const context=currentLinkContext(state,kind);
   if(body.basisHash!==context.basisHash){send(res,409,{error:'source_changed',message:'Source records changed. Refresh the candidates before reviewing.'});return;}
   const review:RecordLinkReview=state.recordLinkReview??={candidates:[],decisions:[]};
   if(route[2]==='decide'){
    if(!verified){send(res,403,{error:'verified_user_required',message:'A verified user must confirm, reject or revoke a relationship. Source records remain unchanged.'});return;}
    const candidate=review.candidates.find(row=>row.id===body.candidateId&&row.kind===kind&&row.basisHash===context.basisHash);
    const decision=body.decision,reason=String(body.reason??'').trim(),sourceRef=String(body.sourceRef??'').trim();
    if(!candidate||!['confirmed','rejected','revoked'].includes(String(decision))||reason.length<3||reason.length>600||!sourceRef||sourceRef.length>300){send(res,400,{error:'review_requires_candidate_decision_reason_and_source'});return;}
    const source=context.sources.find(row=>row.id===candidate.sourceId),target=context.targets.find(row=>row.id===candidate.targetId);
    if(!source||!target||!compatibleLink(kind,source,target)){send(res,409,{error:'relationship_not_compatible'});return;}
    const current=latestLinkDecision(review,candidate.id);
    if(decision==='revoked'&&current?.decision!=='confirmed'){send(res,409,{error:'only_confirmed_relationships_can_be_revoked'});return;}
    if(current?.decision!==decision){review.decisions.push({candidateId:candidate.id,decision:decision as 'confirmed'|'rejected'|'revoked',actorId:actor.id,decidedAt:new Date().toISOString(),reason,sourceRef,basisHash:context.basisHash});runtimeProjects.touch(state);}
    send(res,200,{projectVersion:state.version,candidateId:candidate.id,state:decision,valuesChanged:false,allocationsChanged:false,message:'Relationship decision saved with the verified reviewer. Quantities, values, source records and cash allocations were not changed.'});return;
   }
   const sourceIds=body.sourceIds;
   if(!Array.isArray(sourceIds)||!sourceIds.length||sourceIds.length>10||sourceIds.some(id=>typeof id!=='string'||!context.sources.some(row=>row.id===id))){send(res,400,{error:'choose_one_to_ten_existing_source_records'});return;}
   const useAi=body.useAi===true;
   if(useAi&&!mayUseAi){send(res,403,{error:'paid_ai_not_authorized',message:'AI suggestions require verified owner access and the agreed GPT-4 provider. Rule-based candidates remain available.'});return;}
   const pendingIds=[...new Set(sourceIds as string[])].filter(id=>!(review.candidates??[]).some(row=>row.kind===kind&&row.basisHash===context.basisHash&&row.sourceId===id&&(useAi?row.method==='ai'||!!row.aiAssessment:row.method==='rules'))&&!(useAi&&(review.calls??[]).some(call=>call.kind===kind&&call.basisHash===context.basisHash&&call.state==='completed'&&call.sourceIds.includes(id))));
   if(!pendingIds.length){send(res,200,{saved:0,reused:true,projectVersion:state.version,message:'Existing suggestions retained; no repeated provider call.'});return;}
   let providerState=useAi?'completed':'not_requested',candidates;
   if(useAi){
    const today=new Date().toISOString().slice(0,10),limit=Math.max(1,Math.min(12,Number(process.env.CMENG_LINK_AI_CALLS_PER_PROJECT_DAY)||6));
    const spent=(review.calls??[]).filter(row=>row.at.startsWith(today)).length;
    if(spent>=limit){send(res,429,{error:'link_ai_daily_limit',message:'The bounded AI suggestion allowance is reached. Rule-based and manual review remain available.'});return;}
    (review.calls??=[]).push({at:new Date().toISOString(),actorId:actor.id,basisHash:context.basisHash,kind,sourceIds:pendingIds,state:'attempted'});
    runtimeProjects.touch(state);
   }
   try{candidates=await proposeRecordLinks(context,pendingIds,actor.id,useAi?configuredAskModel():null);}
   catch{providerState='failed_rules_retained';candidates=await proposeRecordLinks(context,pendingIds,actor.id,null);}
   if(currentLinkContext(state,kind).basisHash!==context.basisHash){send(res,409,{error:'source_changed_during_matching',message:'No candidates were saved against changed source records.'});return;}
   const known=new Map(review.candidates.map(row=>[row.id,row]));
   const fresh=candidates.filter(row=>!known.has(row.id));
   for(const candidate of candidates){const existing=known.get(candidate.id);
    if(existing&&candidate.method==='ai'&&candidate.confidence!==null)existing.aiAssessment={confidence:candidate.confidence,reason:candidate.reason,at:candidate.proposedAt,actorId:candidate.proposedBy};
   }
   review.candidates.push(...fresh);
   if(useAi&&review.calls?.length)review.calls[review.calls.length-1]!.state=providerState;
   if(fresh.length||useAi)runtimeProjects.touch(state);
   send(res,200,{saved:fresh.length,providerState,projectVersion:state.version,valuesChanged:false,allocationsChanged:false,message:'Candidates only. Review the source evidence before confirming relationships.'});
  });
 }catch(error){console.error('[link-review]',error instanceof Error?error.message:'request failed');send(res,400,{error:'link_review_request_failed',message:'The review request could not be completed. No source values or allocations were changed.'});}
 return true;
}
