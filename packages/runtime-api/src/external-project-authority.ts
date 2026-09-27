import {randomUUID,timingSafeEqual} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {askCatalogue,ProjectAskEngine} from './ask-engine';
import {AskStore} from './ask-store';
import {runtimeProjects} from './project-state';
import {projectDataDate,projectControlSchedule} from './canonical-time-claims';
import {scheduleAuthorityReview} from './schedule-authority';
import {deliveryRecords} from './delivery-records';
import {selectEvidence,retrievePassages,type EvidenceItem,type ReferencePage} from '../../project-ask/src/evidence';
import type {AnalysisPlan,AskSession,AnalysisResult,Domain,SavedView} from '../../project-ask/src/types';
import {domains,fail,type ExternalBackend,type ExternalAnalysis,type ExternalUser,type ProjectManifest,type AnalysisSession,type Query} from '../../external-intelligence/src/types';
import {digest} from '../../external-intelligence/src/access';
import {sendHttpBody} from './http-response';

// Mixed management/forecast authorities require all contributing domains. New
// adapters fail closed until their disclosure domains have been reviewed.
const reviewed:Record<string,Domain[]>={programme:['schedule'],activities:['schedule'],float:['schedule'],milestones:['schedule'],wbs:['schedule'],progress:['schedule','boq'],resources:['schedule'],evm:['commercial'],boq:['boq','commercial'],quantities:['boq','schedule'],payments:['commercial'],variations:['commercial'],contract:['commercial','claims'],'financial-claims':['commercial','claims'],delay:['claims','schedule'],notices:['claims'],windows:['claims','schedule'],eot:['claims','schedule'],'phase-programmes':['schedule'],quality:['delivery'],submittals:['delivery'],design:['delivery'],hse:['delivery'],spares:['delivery'],permits:['delivery'],commissioning:['delivery'],assets:['delivery'],closeout:['delivery'],handover:['delivery'],weather:['delivery','claims'],risks:['delivery','claims']};
export const externalCatalogue=askCatalogue.available().map(a=>({...a,domains:[...new Set([...(reviewed[a.id]??domains),...a.domains])]}));
const principal=(user:ExternalUser,ids:string[]):AskSession=>({userId:user.id,workspaceId:user.workspaceId,name:null,title:null,company:null,allowModel:false,allowedAuthorityIds:ids});
function check(user:ExternalUser,projectId:string,ids:string[]){for(const id of ids){const a=externalCatalogue.find(a=>a.id===id);if(!a||!a.domains.every(d=>user.projects[projectId]?.includes(d)))fail(403,'authority_denied','The requested authority is not permitted.');}}
class EphemeralStore extends AskStore {override async saveResult(_result:AnalysisResult,_user:AskSession){/* External sessions persist only their bounded selection. */}}
const engine=new ProjectAskEngine(new EphemeralStore(),null);
export function externalProjectState(projectId:string,ids:string[]):ProjectManifest{
  const state=runtimeProjects.get(projectId);if(!state)fail(404,'project_not_found','The authorized project is not available.');
  return {projectId,projectVersion:state!.version,dataDate:projectDataDate(state!),programmeRevision:projectControlSchedule(state!)?.revision.revisionId??null,authorityState:scheduleAuthorityReview(state!).state,lastControlledUpdate:state!.auditHistory?.at(-1)?.occurredAt??null,authorityVersions:Object.fromEntries(ids.map(id=>[id,{version:state!.version,basis:'project-version',independentlyVersioned:false}])),changedDomains:null,snapshotId:null};
}
export async function externalProjectAnalysis(projectId:string,user:ExternalUser,plan:AnalysisPlan):Promise<ExternalAnalysis>{
  check(user,projectId,plan.authorities);const createdAt=new Date().toISOString();
  const view:SavedView={schemaVersion:1,id:randomUUID(),projectId,workspaceId:user.workspaceId,ownerId:user.id,name:'External scoped analysis',visibility:'personal',createdAt,updatedAt:createdAt,plan,presentation:{title:plan.objective,audience:'project',language:'en',detail:'detailed',charts:false,preparedBy:null,jobTitle:null,company:null,reportNumber:null,confidentiality:'Project Internal',status:'Draft / Prepared',format:'json'}};
  const result=await engine.ask(projectId,principal(user,plan.authorities),{question:plan.objective},view),pack=selectEvidence(result);
  // Preserve the deterministic table order in the external ranked presentation.
  // Evidence packages otherwise sort by identity for stable model context.
  for(const section of result.sections)for(const table of section.tables){
    if(!table.selection?.ranked)continue;
    const positions=new Map(table.rows.map((row,index)=>[row,index+1]));
    for(const item of pack.items)if(item.kind==='row'&&(item.data as any).tableId===table.id){const data=item.data as any;data.rank=positions.get(data.row);data.rankBy=table.selection.rankBy;data.rankDirection=table.selection.direction;}
  }
  pack.items.sort((a,b)=>a.authorityId.localeCompare(b.authorityId)||a.kind.localeCompare(b.kind)||((a.data as any).tableId===(b.data as any).tableId&&typeof(a.data as any).rank==='number'&&typeof(b.data as any).rank==='number'?(a.data as any).rank-(b.data as any).rank:a.id.localeCompare(b.id)));
  pack.coverage.evidenceHash=digest(pack.items);
  const traces=result.sections.flatMap(s=>s.traces),recordIds=[...new Set(pack.items.filter(i=>i.kind==='row').flatMap(i=>{const row=(i.data as any).row;return ['recordId','activityId','itemId','reference'].map(k=>row[k]).filter(v=>typeof v==='string');}))];
  return {id:result.id,createdAt:result.createdAt,scope:result.scope,plan:result.plan,items:pack.items,coverage:pack.coverage,traces,recordIds,sourceRefs:[...new Set(traces.flatMap(t=>t.sourceRefs))],factsHash:result.factsHash,llmInvoked:false};
}
function sourceDomains(type:string,category:string):Domain[]{if(/claim|notice|eot|delay/.test(type+' '+category))return ['claims'];if(/boq|cost|payment|variation|contract/.test(type+' '+category))return ['commercial',...(category==='boq_cost'?['boq' as const]:[])];if(/schedule|resource|programme/.test(type+' '+category))return ['schedule'];if(/submittal|rfi|design|quality|ncr|permit|hse|safety|spare|procurement|asset|commission|handover|risk/.test(type+' '+category))return ['delivery'];return domains;}
export async function externalProjectRetrieval(projectId:string,user:ExternalUser,session:AnalysisSession,operation:'get_related_records'|'get_evidence_trace'|'search_evidence',query:Query,limit:number){
  check(user,projectId,session.authorityIds);const state=runtimeProjects.get(projectId);if(!state||state.version!==session.projectVersion)fail(409,'analysis_stale','The project changed. Run a new analysis.');
  const access=user.projects[projectId]??[];
  if(operation==='get_evidence_trace'){
    const trace=session.analysis.traces.find(t=>t.id===query.traceId);if(!trace)fail(404,'trace_not_found','This trace is not retained by the analysis.');
    const refs=trace!.sourceRefs.slice(0,limit);return {items:[{id:trace!.id,kind:'basis' as const,authorityId:trace!.authorityId,mandatory:true,traceIds:[trace!.id],data:{...trace!,sourceRefs:refs,sourceReferenceCount:trace!.sourceRefs.length,sourceReferenceDigest:digest(trace!.sourceRefs)}}],matching:trace!.sourceRefs.length,qualification:refs.length<trace!.sourceRefs.length?'Source references are bounded; the full set is identified by its digest. Broad source enumeration belongs in CMeng.':'Trace references retain their source state; a reference does not independently establish approval.'};
  }
  if(operation==='get_related_records'){
    const records=deliveryRecords(state!).records,anchor=records.find(r=>r.recordId===query.recordId||r.reference===query.recordId);if(!anchor)return {items:[],matching:0,qualification:'No governed relationship authority is established for this retained record. No relationship has been inferred.'};
    const links=anchor.links;const permitted:Record<string,string[]>={};for(const [key,value]of Object.entries(links)){if(!Array.isArray(value)||!value.every(v=>typeof v==='string'))continue;const needed=/claim|notice/i.test(key)?['claims']:/variation|supplier/i.test(key)?['commercial','delivery']:/boq/i.test(key)?['boq']:/activit/i.test(key)?['schedule']:['delivery'];if(needed.every(d=>access.includes(d as Domain)))permitted[key]=value;}
    const entries=Object.entries(permitted).flatMap(([relationship,ids])=>ids.map(id=>({id,relationship}))),selected=entries.slice(0,limit);const items:EvidenceItem[]=selected.map(v=>({id:'related:'+digest([anchor.recordId,v]),kind:'row',authorityId:session.authorityIds[0]!,mandatory:true,traceIds:[],data:{fromRecordId:anchor.recordId,relatedId:v.id,relationship:v.relationship,basis:'Explicit retained record link; a link does not prove causation.'}}));return {items,matching:entries.length,qualification:entries.length>limit?'Related records exceed this bounded response; narrow the analysis objective. No complete relationship review is claimed.':'Only explicit relationships in permitted domains are returned.'};
  }
  const refs=session.analysis.sourceRefs,eligible=state!.evidenceDocuments.filter(d=>sourceDomains(d.documentType,d.category).every(domain=>access.includes(domain))&&refs.some(ref=>ref.includes(d.documentId)||ref.includes(d.sourceHashSha256)));
  const pages:ReferencePage[]=eligible.flatMap(d=>d.fullTextRead?.result.pages.map(p=>({filename:d.sourceFilename,fileId:d.documentId,hash:d.sourceHashSha256,page:p.pageNumber,text:p.text}))??d.textSegments?.map(s=>({filename:d.sourceFilename,fileId:d.documentId,hash:d.sourceHashSha256,page:s.pageNumber??1,text:s.text}))??[]);
  const sourceStates=new Map(eligible.map(d=>[d.documentId,{basisState:d.basisState,parserState:d.parserState,sourceHash:d.sourceHashSha256,readingComplete:d.fullTextRead?.result.complete??null,pageCoverage:d.fullTextRead?{processed:d.fullTextRead.result.processedPages,total:d.fullTextRead.result.totalPages,unresolved:d.fullTextRead.result.unresolvedPages}:null}]));
  const found=retrievePassages(pages,query.query??'',limit);return {items:found.passages.map(p=>({id:p.id,kind:'passage' as const,authorityId:'evidence',mandatory:true,traceIds:[],data:{...p,sourceState:sourceStates.get(p.fileId??'')??null,classification:'source_excerpt',governance:'An excerpt is supporting evidence, not an adopted fact. Review its source reading state.'}})),matching:found.matchingPassages,qualification:'Only sources referenced by this authorized analysis were searched. '+found.totalPages+' retained pages searched; '+found.passages.length+' of '+found.matchingPassages+' matching passages returned. Missing OCR or a missing link is not evidence of absence.'};
}
export const localExternalBackend:ExternalBackend={catalogue:externalCatalogue,state:async(id,ids)=>externalProjectState(id,ids),analyse:externalProjectAnalysis,retrieve:externalProjectRetrieval};
export async function internalExternalRequest(req:IncomingMessage,res:ServerResponse){
  const expected=process.env.CMENG_EXTERNAL_WORKER_KEY??'',supplied=String(req.headers['x-cmeng-external-worker-key']??'');
  if(!expected||supplied.length!==expected.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))||req.method!=='POST'||!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress??'')){sendHttpBody(res,404,{'content-type':'application/json'},'{"error":"not_found"}');return;}
  try{const chunks:Buffer[]=[];let size=0;for await(const c of req){size+=c.length;if(size>20*1024*1024)fail(413,'request_too_large','Internal analysis request is too large.');chunks.push(Buffer.from(c));}const input=JSON.parse(Buffer.concat(chunks).toString());let result:unknown;
    if(input.action==='state')result=externalProjectState(input.projectId,input.authorityIds);
    else if(input.action==='analyse')result=await externalProjectAnalysis(input.projectId,input.user,input.plan);
    else if(input.action==='retrieve')result=await externalProjectRetrieval(input.projectId,input.user,input.session,input.operation,input.query,input.limit);
    else fail(400,'unknown_action','Unknown external intelligence operation.');
    sendHttpBody(res,200,{'content-type':'application/json'},JSON.stringify(result));
  }catch(e){const error=e as any;sendHttpBody(res,error.status??500,{'content-type':'application/json'},JSON.stringify({error:error.code??'analysis_unavailable',message:error.status?error.message:'The project analysis could not be completed.'}));}
}
