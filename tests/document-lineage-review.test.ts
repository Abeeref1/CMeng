import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {inferEvidenceLineage} from '../packages/runtime-api/src/evidence';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {projectActions} from '../packages/runtime-api/src/project-actions';
import {summarizeControlIssues} from '../packages/truth-kernel/src';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';

function fixture(t:any){
 const root=mkdtempSync(join(tmpdir(),'lineage-review-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:root,durable:false}),state=store.getOrCreate('LINEAGE');
 const upload=(type:string,body:string,name=type+'.csv',intent:'add_update'|'replace_current_basis'='add_update')=>store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(body),mediaType:'text/csv',sourceFilename:name,sourceRelativePath:'shared-folder/'+name,documentType:type,category:'engineering',uploadedAt:'2031-08-31',uploadIntent:intent});
 return {root,store,state,upload};
}

test('lineage compares source families rather than grouping distinct RFIs, submittals, HSE and NCRs',()=>{
 for(const [category,first,second] of [['engineering','rfi_register','submittal_register'],['hse_quality_fm','hse_monthly_report','quality_ncr_register']] as const){
  const document:any={documentId:'PRIOR',category,documentType:first,sourceFilename:'shared.csv',assertions:[]};
  const next=inferEvidenceLineage({category,documentType:second,textSample:'Revision 2',existingDocuments:[document]});
  assert.equal(next.effect,'original');assert.equal(next.needsReview,false);assert.deepEqual(next.predecessorDocumentIds,[]);
  const same=inferEvidenceLineage({category,documentType:first,textSample:'Revision 2',existingDocuments:[document]});
  assert.equal(same.effect,'revision_snapshot');assert.equal(same.needsReview,true);assert.deepEqual(same.predecessorDocumentIds,['PRIOR']);
 }
 const amendment=inferEvidenceLineage({category:'contract',documentType:'contract_amendment',textSample:'Amendment no. 2',existingDocuments:[{documentId:'BASE',category:'contract',familyKey:'contract:base',documentType:'main_contract'} as any]});
 assert.deepEqual(amendment.predecessorDocumentIds,['BASE']);assert.equal(amendment.effect,'delta_amendment');
});

// M3.3: a stale upload-time flag on a file CMeng already uses (active) asks nothing in
// Project Review; the relationship can still be decided from the document, and that decision stands.
test('an active file with a legacy relationship flag asks nothing; an explicit decision is still validated and kept',async t=>{
 const {root,store,state,upload}=fixture(t);
 await upload('rfi_register','RFI ID,Subject,Status\nR1,Question,Open');
 await upload('submittal_register','Submittal ID,Title,Status\nS1,Drawing,Approved');
 const rfi=state.evidenceDocuments[0]!,sub=state.evidenceDocuments[1]!;
 assert.equal(sub.lineage.needsReview,false);assert.equal(rfi.basisState,'active');assert.equal(sub.basisState,'active');
 sub.lineage={effect:'revision_snapshot',predecessorDocumentIds:[rfi.documentId],replacesEntireBasis:false,appliesAsDelta:false,inferred:true,confidence:.62,needsReview:true,diagnostics:['CHANGE_EFFECT_REQUIRES_REVIEW_BEFORE_REPLACING_CURRENT_BASIS']};
 const inferred=structuredClone(sub.lineage),source=readFileSync(sub.storedPath),rfiBefore=JSON.stringify(rfi);store.touch(state);
 assert.ok(!projectActions(state,summarizeControlIssues([])).actions.some(a=>a.id==='document:'+sub.documentId),'an active file with a stale flag is not asked about');
 const input={documentId:sub.documentId,sourceHash:sub.sourceHashSha256,expectedVersion:state.version,kind:'new_record' as const,note:'Separate submittal population'};
 assert.throws(()=>store.reviewEvidenceRelationship(state.projectId,{...input,kind:'replacement',targetDocumentId:rfi.documentId}),/FAMILY/);
 assert.throws(()=>store.reviewEvidenceRelationship(state.projectId,{...input,targetDocumentId:rfi.documentId}),/NEW_RECORD/);
 writeFileSync(sub.storedPath,'different bytes');assert.throws(()=>store.reviewEvidenceRelationship(state.projectId,input),/SOURCE_HASH/);writeFileSync(sub.storedPath,source);
 assert.equal(sub.relationshipDecision,undefined);assert.deepEqual(sub.lineage,inferred);
 store.reviewEvidenceRelationship(state.projectId,input);
 assert.equal(sub.lineage.effect,'original');assert.equal(sub.lineage.needsReview,false);assert.deepEqual(sub.lineage.predecessorDocumentIds,[]);
 assert.deepEqual(sub.relationshipDecision!.originalLineage,inferred);assert.equal(sub.relationshipHistory!.length,1);
 assert.equal(JSON.stringify(rfi),rfiBefore);assert.deepEqual(readFileSync(sub.storedPath),source);
 sub.lineage.needsReview=true;state.version++;
 assert.ok(!projectActions(state,summarizeControlIssues([])).actions.some(a=>a.id==='document:'+sub.documentId),'a stale machine flag cannot override the explicit decision for these same sources');
 store.touch(state);const restored=new RuntimeProjectStore({dataDir:root,durable:false}).get(state.projectId)!;
 assert.deepEqual(restored.evidenceDocuments.find(d=>d.documentId===sub.documentId)!.relationshipHistory,sub.relationshipHistory);
});

test('an explicit Replace current basis upload does not create another inferred relationship approval',async t=>{
 const {state,upload}=fixture(t);
 await upload('rfi_register','RFI ID,Subject,Status\nR1,Question,Open');
 await upload('rfi_register','RFI ID,Subject,Status\nR1,Question,Closed','RFI-revised.csv','replace_current_basis');
 const revised=state.evidenceDocuments.at(-1)!;assert.equal(revised.basisState,'active');
 assert.ok(!projectActions(state,summarizeControlIssues([])).actions.some(a=>a.id==='document:'+revised.documentId));
});

test('a relationship decision on an active file works through the gateway and survives restart (it is not asked first)',async t=>{
 let cleanup=()=>{};const {root,store,state,upload}=fixture({after:(fn:()=>void)=>{cleanup=fn;}});let gateway:Awaited<ReturnType<typeof createProjectGateway>>|undefined;
 t.after(async()=>{await gateway?.close();cleanup();});
 await upload('rfi_register','RFI ID,Subject,Status\nR1,Question,Open');await upload('submittal_register','Submittal ID,Title,Status\nS1,Drawing,Approved');
 const sub=state.evidenceDocuments[1]!;sub.lineage.needsReview=true;sub.lineage.predecessorDocumentIds=[state.evidenceDocuments[0]!.documentId];store.touch(state);
 let base='';const start=async()=>{gateway=await createProjectGateway(root,{maxWorkers:1});await new Promise<void>(r=>gateway!.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(gateway!.server.address() as any).port;};await start();
 const get=async(path:string)=>{const response=await fetch(base+'/api/projects/LINEAGE'+path);assert.equal(response.status,200);return await response.json() as any;};
 let workflow=await get('/actions');assert.ok(!workflow.actions.some((a:any)=>a.id==='document:'+sub.documentId),'M3.3: not asked');
 const request=(extra:any)=>fetch(base+'/api/projects/LINEAGE/evidence/documents/'+sub.documentId+'/relationship',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:workflow.projectVersion,sourceHash:sub.sourceHashSha256,kind:'new_record',note:'Source register is separate',...extra})});
 for(const bad of [{expectedVersion:workflow.projectVersion-1},{sourceHash:'stale'}])assert.equal((await request(bad)).status,409);
 assert.equal((await request({})).status,200);
 await gateway!.close();await start();workflow=await get('/actions');assert.ok(!workflow.actions.some((a:any)=>a.id==='document:'+sub.documentId));
 const docs=(await get('/evidence/documents')).documents;assert.equal(docs.length,2);assert.ok(docs.every((d:any)=>d.basisState==='active'));assert.equal(docs.find((d:any)=>d.documentId===sub.documentId).sourceHashSha256,sub.sourceHashSha256);
});
