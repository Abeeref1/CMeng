import {randomUUID} from 'node:crypto';
import {readdirSync,readFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {resolveIntent} from '../../project-ask/src/intent';
import type {AnalysisPlan,AuthorityDescriptor,AskSession,Domain} from '../../project-ask/src/types';
import type {EvidenceItem} from '../../project-ask/src/evidence';
import {ExternalAccess,digest,secret} from './access';
import {capabilities,fail,scalar,ExternalError,type Capability,type Query,type ExternalBackend,type ExternalUser,type Connection,type AnalysisSession} from './types';
const readOps=new Set(capabilities);
const objectiveLimit=4000;
export class ExternalIntelligenceService {
  private pending=new Map<string,number>();
  private sessionLocks=new Set<string>();
  constructor(readonly access:ExternalAccess,readonly backend:ExternalBackend){}
  allowed(c:Connection,u:ExternalUser,projectId:string){return this.backend.catalogue.filter(a=>a.domains.every(d=>u.projects[projectId]?.includes(d)&&c.projects[projectId]?.includes(d)&&this.access.configured().projects[projectId]?.domains.includes(d)));}
  private required(authorityIds:string[]){return [...new Set(authorityIds.flatMap(id=>{const a=this.backend.catalogue.find(a=>a.id===id);if(!a)fail(422,'unknown_authority','The requested authority is not available.');return a!.domains;}))];}
  private plan(q:Query,previous?:AnalysisSession):AnalysisPlan{
    const objective=q.objective??q.metric??'';if(typeof objective!=='string'||!objective.trim()||objective.length>objectiveLimit)fail(400,'objective_required','Enter a specific project objective of up to 4,000 characters.');
    const principal:AskSession={userId:'external-plan',workspaceId:'external-plan',name:null,title:null,company:null,allowModel:false};
    const prior=previous?{plan:previous.analysis.plan,presentation:{format:'interactive'}} as any:null;
    const result=resolveIntent(objective,this.backend.catalogue,principal,null,prior).plan;
    if(['scenario','proposal'].includes(result.kind))fail(403,'read_only','External access cannot change governed records or execute write actions.');
    if(q.authorityIds!==undefined){if(!Array.isArray(q.authorityIds)||!q.authorityIds.length||q.authorityIds.length>8||q.authorityIds.some(id=>typeof id!=='string'))fail(400,'authority_selection_invalid','Select up to eight available authorities.');result.authorities=[...new Set(q.authorityIds)];}
    if(result.authorities.length>8)fail(422,'objective_too_broad','Narrow the question to related project domains. A full project briefing is not an external capability.');
    this.required(result.authorities);
    const fields=new Set(result.authorities.flatMap(id=>this.backend.catalogue.find(a=>a.id===id)!.fields));
    if(q.filters!==undefined){if(!Array.isArray(q.filters)||q.filters.length>8||q.filters.some(f=>!f||!fields.has(f.field)||!['eq','contains','lt','lte','gt','gte','between'].includes(f.operator)||!scalar(f.value)||f.value===null||f.operator==='between'&&!scalar(f.upper)))fail(400,'filters_invalid','Use the supported fields and filters described by this capability.');result.filters=structuredClone(q.filters);}
    if(q.groupBy!==undefined){if(!Array.isArray(q.groupBy)||q.groupBy.length>3||q.groupBy.some(f=>!fields.has(f)))fail(400,'grouping_invalid','Use up to three supported grouping fields.');result.groupBy=[...q.groupBy];}
    if(q.rankBy!==undefined){if(!fields.has(q.rankBy)||q.direction!==undefined&&!['asc','desc'].includes(q.direction))fail(400,'ranking_invalid','Use a supported ranking field and direction.');result.rankBy=q.rankBy;result.rankDirection=q.direction??'desc';delete result.rankings;}
    if(q.limit!==undefined){if(!Number.isInteger(q.limit)||q.limit<1)fail(400,'rank_limit_invalid','Requested ranks must be positive whole numbers.');result.limit=q.limit;}
    if(q.asOf!==undefined){if(!/^\d{4}-\d{2}-\d{2}$/.test(q.asOf)||Number.isNaN(Date.parse(q.asOf))||new Date(q.asOf).toISOString().slice(0,10)!==q.asOf)fail(400,'date_invalid','Use a valid historical date.');result.asOf=q.asOf;result.kind='historical';}
    result.attachmentIds=[];return result;
  }
  private validate(operation:string,q:Query){if(!readOps.has(operation as Capability))fail(403,'read_only_capability','Only the listed read-only project capabilities are supported.');if(!q||typeof q!=='object'||Array.isArray(q))fail(400,'invalid_request','Provide a structured project request.');const known=new Set(['projectId','objective','authorityIds','metric','filters','groupBy','rankBy','direction','limit','asOf','analysisId','recordId','traceId','query','batchToken']);if(Object.keys(q).some(k=>!known.has(k)))fail(400,'unsupported_parameter','Raw queries, pagination, file enumeration and unlisted parameters are not supported.');if(typeof q.projectId!=='string'||!q.projectId.trim()||q.projectId.length>160)fail(400,'project_required','Select one permitted project.');for(const k of ['analysisId','recordId','traceId','query','batchToken'] as const)if(q[k]!==undefined&&(typeof q[k]!=='string'||q[k]!.length>4000))fail(400,'invalid_request','Invalid bounded retrieval parameter.');}
  private cleanSessions(c:Connection){const root=join(this.access.root,'sessions');let count=0;try{for(const name of readdirSync(root)){if(!/^[0-9a-f-]{36}\.json$/.test(name))continue;const file=join(root,name);let s:AnalysisSession;try{s=JSON.parse(readFileSync(file,'utf8'));}catch{continue;}if(Date.parse(s.expiresAt)<=this.access.now()){unlinkSync(file);continue;}if(s.userId===c.userId&&s.workspaceId===c.workspaceId)count++;}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}return count;}
  private serializeLimit(value:unknown,c:Connection){if(Buffer.byteLength(JSON.stringify(value))>this.access.limits(c.profile).responseBytes)fail(413,'response_too_large','The selected evidence cannot fit this response safely. Narrow the objective; no complete answer is claimed.');return value;}
  private page(s:AnalysisSession,c:Connection,offset=0){const limits=this.access.limits(c.profile),items:EvidenceItem[]=[];let nextOffset=offset;const base={analysisId:s.id,scope:s.analysis.scope,createdAt:s.createdAt,expiresAt:s.expiresAt,factsHash:s.analysis.factsHash,llmInvoked:false,coverage:s.analysis.coverage};
    while(nextOffset<s.analysis.items.length&&items.length<limits.recordsPerResponse){const item=s.analysis.items[nextOffset]!;if(Buffer.byteLength(JSON.stringify({...base,items:[...items,item]}))>limits.responseBytes-4096)break;items.push(item);nextOffset++;}
    if(!items.length&&offset<s.analysis.items.length)fail(413,'evidence_item_too_large','A required evidence item cannot fit the response. Narrow the question; no complete answer is claimed.');
    const newly=items.filter(i=>!s.deliveredItemIds.includes(i.id));if(s.recordsReturned+items.length>limits.recordsPerSession)fail(429,'bulk_export_required','This analysis reached its configured disclosure budget. Use a governed CMeng export for bulk records.');
    s.recordsReturned+=items.length;s.deliveredItemIds.push(...newly.map(i=>i.id));let nextBatchToken:string|null=null;if(nextOffset<s.analysis.items.length){nextBatchToken=secret();s.batchTokens[nextBatchToken]=nextOffset;}
    return {payload:{...base,items,delivery:{itemsInAnalysis:s.analysis.items.length,itemsReturned:items.length,materialCompleteInThisResponse:offset===0&&nextOffset===s.analysis.items.length&&s.analysis.coverage.materialComplete,nextBatchToken,qualification:nextBatchToken?'Further selected evidence remains. Retrieve the indicated batch before claiming a complete assessment.':'The selected evidence is delivered. Source completeness and calculation limitations remain in coverage.'}},charged:items.length};
  }
  async execute(token:string,operation:Capability,q:Query):Promise<any>{
    let c:Connection|undefined;let required:Domain[]=[];let version:number|undefined;let lockedKey:string|undefined;let sessionLock:string|undefined;
    try{
      this.validate(operation,q);const auth=this.access.authorize(token,q.projectId);c=auth.connection;const limits=this.access.limits(c.profile);
      this.access.consume(c,q.projectId);
      const allowed=this.allowed(c,auth.user,q.projectId),allowedIds=allowed.map(a=>a.id);
      const effectiveUser:ExternalUser={...auth.user,projects:{[q.projectId]:(auth.user.projects[q.projectId]??[]).filter(d=>c!.projects[q.projectId]?.includes(d)&&this.access.configured().projects[q.projectId]?.domains.includes(d))}};
      const key=digest([c.workspaceId,c.userId]);if((this.pending.get(key)??0)>=limits.concurrentRequests)fail(429,'concurrency_limit','A project analysis is already using the configured concurrency allowance.');this.pending.set(key,(this.pending.get(key)??0)+1);lockedKey=key;
      if(operation==='describe_capabilities'){const value={projectId:q.projectId,scope:'project',profile:c.profile,readOnly:true,llmInvoked:false,capabilities,authorities:allowed,limits,classification:['project_fact','calculated_intelligence','deterministic_finding'],evidenceStates:['established','partial','missing','candidate','stale','conflicting','unavailable'],freshness:'Check project state before substantive current questions and final outputs. Retained analyses carry their original version. External output is draft and is not an official CMeng record.'};this.access.audit(c,operation,q.projectId,[],0,'allowed');return this.serializeLimit(value,c);}
      let session=q.analysisId?this.access.session(q.analysisId,c):undefined;
      if(session){if(this.sessionLocks.has(session.id))fail(429,'analysis_busy','This analysis is already being refreshed. Retry after it finishes.');this.sessionLocks.add(session.id);sessionLock=session.id;}
      if(session&&session.projectId!==q.projectId)fail(404,'analysis_not_found','This analysis is not available for this project.');
      if(operation==='get_project_state'){const m=await this.backend.state(q.projectId,allowedIds);this.access.authorize(token,q.projectId);this.access.audit(c,operation,q.projectId,[],0,'allowed',undefined,undefined,m.projectVersion);return m;}
      if(['get_analysis_batch','check_analysis_freshness','get_related_records','get_evidence_trace','search_evidence'].includes(operation)){
        if(!session)fail(400,'analysis_required','Start a scoped project analysis before retrieving related evidence.');required=this.required(session!.authorityIds);this.access.authorize(token,q.projectId,required);
        const current=await this.backend.state(q.projectId,session!.authorityIds);version=current.projectVersion;this.access.authorize(token,q.projectId,required);
        if(operation==='check_analysis_freshness'){const value={analysisId:session!.id,analysisProjectVersion:session!.projectVersion,current,stale:current.projectVersion!==session!.projectVersion};this.access.audit(c,operation,q.projectId,required,0,'allowed',undefined,session!.id,version);return value;}
        if(current.projectVersion!==session!.projectVersion)fail(409,'analysis_stale','The project changed. Run a new analysis; the retained analysis is not the current position.');
        if(session!.retrievals>=limits.retrievalsPerSession)fail(429,'retrieval_limit','This analysis reached its retrieval budget. Bulk records belong in CMeng’s governed exports.');session!.retrievals++;
        let payload:any,charged=0;
        if(operation==='get_analysis_batch'){const offset=session!.batchTokens[q.batchToken??''];if(offset===undefined)fail(400,'batch_token_invalid','Use only the continuation token supplied for this analysis.');delete session!.batchTokens[q.batchToken!];const page=this.page(session!,c,offset);payload=page.payload;charged=page.charged;}
        else {if(operation==='get_related_records'&&(!q.recordId||!session!.analysis.recordIds.includes(q.recordId)))fail(403,'record_scope_denied','Related retrieval starts from a record represented in this analysis.');if(operation==='get_evidence_trace'&&(!q.traceId||!session!.analysis.traces.some(t=>t.id===q.traceId)))fail(403,'trace_scope_denied','Select a trace retained by this analysis.');if(operation==='search_evidence'&&(!q.query?.trim()||q.query.trim().length<3))fail(400,'search_objective_required','Provide specific evidence search terms.');
          const result=await this.backend.retrieve(q.projectId,effectiveUser,session!,operation as any,q,operation==='search_evidence'?limits.evidenceExcerpts:limits.recordsPerResponse);charged=result.items.reduce((n,i)=>n+Math.max(1,Array.isArray((i.data as any).sourceRefs)?(i.data as any).sourceRefs.length:1),0);if(session!.recordsReturned+charged>limits.recordsPerSession)fail(429,'bulk_export_required','This analysis reached its record budget.');session!.recordsReturned+=charged;payload={analysisId:session!.id,scope:session!.analysis.scope,...result,current,llmInvoked:false};}
        const finalState=await this.backend.state(q.projectId,session!.authorityIds);if(finalState.projectVersion!==version)fail(409,'analysis_stale','The project changed during evidence retrieval. Run a new analysis.');this.access.authorize(token,q.projectId,required);this.serializeLimit(payload,c);this.access.consume(c,q.projectId,charged,false);this.access.saveSession(session!);this.access.audit(c,operation,q.projectId,required,charged,'allowed',undefined,session!.id,version);return payload;
      }
      const plan=this.plan(q,session);required=this.required(plan.authorities);this.access.authorize(token,q.projectId,required);
      if(plan.limit!==null&&plan.limit>limits.maxRank||plan.rankings?.some(r=>r.limit>limits.maxRank))fail(422,'rank_exceeds_policy','The complete requested rank exceeds the configured external allowance. Use CMeng’s governed export; it will not be silently truncated.');
      if(operation==='get_ranked_result'&&(!plan.rankBy&&!plan.rankings?.length||plan.limit===null&&!plan.rankings?.length))fail(400,'ranking_required','Specify the ranking field, direction and complete requested rank.');
      const current=await this.backend.state(q.projectId,plan.authorities);version=current.projectVersion;
      // Unchanged related plans reuse retained facts. A new subject is never filled from old conversation data.
      const reuse=session&&session.projectVersion===current.projectVersion&&digest({...session.analysis.plan,objective:''})===digest({...plan,objective:''});
      const analysis=reuse?structuredClone(session!.analysis):await this.backend.analyse(q.projectId,effectiveUser,plan);
      const finalState=await this.backend.state(q.projectId,plan.authorities);if(finalState.projectVersion!==current.projectVersion||analysis.scope.projectVersion!==current.projectVersion)fail(409,'project_changed','The project changed during analysis. Request the current position again.');this.access.authorize(token,q.projectId,required);
      if(!reuse&&this.cleanSessions(c)>=limits.activeSessions)fail(429,'active_session_limit','The active analysis allowance is reached. Reuse a related analysis or wait for expiry.');
      analysis.id=reuse?session!.id:randomUUID();analysis.plan=plan;
      if(reuse){session!.analysis=analysis;session!.objectiveHash=digest(plan.objective);session!.batchTokens={};}
      else session={id:analysis.id,connectionId:c.id,userId:c.userId,workspaceId:c.workspaceId,projectId:q.projectId,projectVersion:analysis.scope.projectVersion,dataDate:analysis.scope.dataDate,createdAt:new Date(this.access.now()).toISOString(),expiresAt:new Date(this.access.now()+limits.sessionSeconds*1000).toISOString(),authorityIds:plan.authorities,objectiveHash:digest(plan.objective),retrievals:0,recordsReturned:0,deliveredItemIds:[],batchTokens:{},analysis};
      // All material exceptions and requested ranks must fit the complete bounded session.
      if(analysis.items.length>limits.recordsPerSession)fail(413,'analysis_scope_too_large','All relevant evidence cannot fit this analysis allowance. Narrow the objective or use a governed export. No complete answer is claimed.');
      const page=this.page(session!,c);const payload={...page.payload,current:finalState,reused:!!reuse};this.serializeLimit(payload,c);this.access.consume(c,q.projectId,page.charged,false);this.access.saveSession(session!);this.access.audit(c,operation,q.projectId,required,page.charged,'allowed',undefined,session!.id,version);return payload;
    }catch(e){const code=e instanceof ExternalError?e.code:'analysis_unavailable';this.access.audit(c??null,operation,typeof q?.projectId==='string'?q.projectId:null,required,0,code,undefined,q?.analysisId,version);throw e;}
    finally{if(lockedKey)this.pending.set(lockedKey,Math.max(0,(this.pending.get(lockedKey)??1)-1));if(sessionLock)this.sessionLocks.delete(sessionLock);}
  }
}
