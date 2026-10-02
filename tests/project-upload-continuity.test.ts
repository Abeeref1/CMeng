import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {projectControlSchedule,projectDataDate} from '../packages/runtime-api/src/canonical-time-claims';
import {phaseProgrammePosition} from '../packages/runtime-api/src/phase-programmes';
import {applyEvidenceBasis,evidenceFamily} from '../packages/runtime-api/src/evidence-control';
import type {StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
import {boqItemContinuity} from '../packages/runtime-api/src/boq-item-continuity';
const xer=(date:string,code='A1')=>Buffer.from(['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tTEST\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt','%R\t1\t1\t'+code+'\tWork\tTK_NotStart\t2036-09-01\t2036-10-01\t80\t80\t0','%E'].join('\n'));
function store(t:any){const root=mkdtempSync(join(tmpdir(),'cmeng-phase-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return {root,store:new RuntimeProjectStore({dataDir:root,durable:true})};}

test('phase updates, baselines, scenarios and restart retain separate authority and cannot advance the project Data Date',async t=>{
  const f=store(t),projectId='CONTROLLED',state=f.store.getOrCreate(projectId),upload=(date:string,role:string,phaseId?:string,adopt=true)=>f.store.ingestSchedule({projectId,bytes:xer(date,phaseId??'PROJECT'),mediaType:'text/plain',sourceFilename:'same-name.xer',role,roleConfirmed:true,approvalReference:'Engineer approval E-101',...(phaseId?{phaseId}:{}),uploadedAt:date,uploadIntent:adopt?'replace_current_basis':'add_update'});
  const base=await upload('2036-01-01','baseline'),current=await upload('2036-08-31','update');
  const before=projectControlSchedule(state)!.revision.revisionId;
  const phaseBaseline=await upload('2037-01-31','baseline','PHASE-2'),phaseUpdate=await upload('2037-03-31','update','PHASE-2');
  assert.equal(state.schedules.length,2);assert.equal(state.evidenceDocuments.filter(d=>d.category==='schedule').length,2);
  assert.equal(projectControlSchedule(state)!.revision.revisionId,before);assert.equal(projectDataDate(state),'2036-08-31');
  assert.equal(phaseProgrammePosition(state,'PHASE-2').programme!.revisionId,phaseUpdate.revisionId);
  const revised=await upload('2037-04-30','revised_baseline','PHASE-2');
  assert.equal(phaseProgrammePosition(state,'PHASE-2').programme!.revisionId,phaseUpdate.revisionId,'baseline adoption is distinct from a current update');
  assert.equal(state.phaseProgrammes![0]!.activeEvidenceBasis['schedule:baseline']!.activeArtifactId,revised.revisionId);
  const recovery=await upload('2037-05-31','recovery','PHASE-2',false);
  assert.throws(()=>f.store.adoptSchedule(projectId,recovery.revisionId,'PHASE-2'),/SCENARIO/);
  assert.throws(()=>f.store.adoptSchedule(projectId,phaseUpdate.revisionId),/NOT_FOUND/);
  assert.throws(()=>f.store.adoptSchedule(projectId,current.revisionId,'PHASE-2'),/NOT_FOUND/);
  const submitted=await upload('2037-03-31','update','PHASE-3',false);
  assert.equal(phaseProgrammePosition(state,'PHASE-3').programme!.revisionId,submitted.revisionId,'first dated phase update becomes the submitted analytical programme');
  assert.equal(projectDataDate(state),'2036-08-31','phase programme must not advance the parent project Data Date');
  const restored=new RuntimeProjectStore({dataDir:f.root,durable:true}),again=restored.get(projectId)!;
  assert.equal(projectControlSchedule(again)!.revision.revisionId,current.revisionId);assert.equal(again.activeEvidenceBasis['schedule:baseline']!.activeArtifactId,base.revisionId);
  assert.equal(phaseProgrammePosition(again,'PHASE-2').programme!.revisionId,phaseUpdate.revisionId);
  assert.equal(phaseProgrammePosition(again,'PHASE-3').programme!.revisionId,submitted.revisionId);
  assert.ok(again.phaseProgrammes![0]!.schedules.some(s=>s.revision.revisionId===phaseBaseline.revisionId));
});

test('confirmed programme purpose overrides filename hints and baseline adoption requires an approval reference',async t=>{
  const f=store(t),input={projectId:'NAMES',bytes:xer('2036-08-31'),mediaType:'text/plain',sourceFilename:'Draft-Recovery-Phase-99.xer',role:'update',roleConfirmed:true,uploadIntent:'replace_current_basis' as const,uploadedAt:'2036-09-01'};
  const result=await f.store.ingestSchedule(input);assert.equal(result.role,'update');assert.equal(projectDataDate(f.store.get('NAMES')!),'2036-08-31');
  await assert.rejects(()=>f.store.ingestSchedule({...input,projectId:'NO-APPROVAL',role:'baseline'}),/APPROVAL_REFERENCE/);
});
test('mitigation and acceleration programme names stay scenario-only until purpose is explicitly confirmed',async t=>{
  const f=store(t),projectId='RECOVERY-NAMES';
  for(const [index,name] of ['Mitigation_Programme_01.xer','Acceleration_Programme_02.xer','WhatIf_Programme_03.xer'].entries()){
    const uploaded=await f.store.ingestEvidenceFile({
      projectId,bytes:xer('2036-0'+(index+8)+'-31'),mediaType:'text/plain',sourceFilename:name,
      uploadedAt:'2036-10-01',uploadIntent:'add_update',
    });
    const state=f.store.get(projectId)!,document=state.evidenceDocuments.find(d=>d.linkedArtifactId===uploaded.linkedArtifactId)!;
    assert.equal(uploaded.scheduleRole,'recovery',name+' must be recognised as recovery intent');
    assert.equal(document.basisState,'scenario',name+' must not become the current analytical programme');
    assert.equal(projectDataDate(state),null,name+' must not establish the project Data Date');
  }
  const explicit=await f.store.ingestSchedule({
    projectId:'EXPLICIT-ACCELERATION',bytes:xer('2036-08-31'),mediaType:'text/plain',
    sourceFilename:'Acceleration_Programme_03.xer',role:'update',roleConfirmed:true,
    uploadedAt:'2036-09-01',uploadIntent:'replace_current_basis',
  });
  assert.equal(explicit.role,'update','an explicit confirmed programme purpose must override the filename hint');
  assert.equal(projectDataDate(f.store.get('EXPLICIT-ACCELERATION')!),'2036-08-31');
});

test('BOQ identity ignores row order and filename but refuses missing, ambiguous or changed scope identities',()=>{
  const old={id:'hash-old-row-1',itemNumber:'B1',section:'MEP',description:'Chiller',unit:'No.'},same={...old,id:'hash-new-row-200'};
  assert.equal(boqItemContinuity([old],[same]).get(old.id),same.id);
  for(const altered of [{...same,unit:'m'},{...same,description:'Pump'},{...same,itemNumber:null}])assert.equal(boqItemContinuity([old],[altered]).size,0);
  assert.equal(boqItemContinuity([old],[same,{...same,id:'duplicate'}]).size,0);
});
test('identical BOQ uploads under the same and different filenames retain one active source',async t=>{
  const f=store(t),projectId='BOQ-IDENTICAL',bytes=Buffer.from('Item No,Description,Unit,Quantity,Rate,Amount,Currency\nA,Equipment,No.,10,2,20,AED');
  const upload=(name:string,intent:'add_update'|'replace_current_basis')=>f.store.ingestEvidenceFile({projectId,sourceFilename:name,bytes,mediaType:'text/csv',uploadedAt:'2036-09-01',uploadIntent:intent});
  await upload('Original.csv','replace_current_basis');const first=f.store.get(projectId)!.activeEvidenceBasis['boq:quantity']!.activeDocumentId;
  await upload('Original.csv','add_update');await upload('Renamed.csv','add_update');const state=f.store.get(projectId)!;
  assert.equal(state.activeEvidenceBasis['boq:quantity']!.activeDocumentId,first);assert.equal(state.evidenceDocuments.find(d=>d.documentId===first)!.basisState,'active');assert.equal(state.evidenceDocuments.filter(d=>d.basisState==='active').length,1);
});
function document(id:string,text:string,type='variation_order'):StoredEvidenceDocument{
  const family=evidenceFamily({category:'risk_claims_procurement',documentType:type,scheduleRole:null,textSample:text,sourceFilename:id+'.txt'});
  return {documentId:id,category:'risk_claims_procurement',documentType:type,sourceFilename:id+'.txt',sourceRelativePath:null,mediaType:'text/plain',sourceHashSha256:id,sizeBytes:1,uploadedAt:'2036-08-01',authority:'candidate_only',parserState:'parsed',storedPath:'',linkedArtifactId:null,scheduleRole:null,mapping:null,identification:{} as any,lineage:{effect:'variation_order',predecessorDocumentIds:[],replacesEntireBasis:false,appliesAsDelta:true,inferred:true,confidence:.9,needsReview:false,diagnostics:[]},assertions:[{sourceText:text} as any],uploadIntent:'add_update',...family,basisState:'candidate',supersededByDocumentId:null,supersedesDocumentIds:[],diagnostics:[]};
}
test('same business VO identifier is held for review; explicit replacement works with unrelated filenames and version checks',t=>{
  const f=store(t),state=f.store.getOrCreate('VO-PROJECT'),old=document('first-name','Variation Order No: VO-001'),revision=document('totally-different-name','Variation Order No: VO-001'),second=document('next','Variation Order No: VO-002');
  for(const d of [old,revision,second]){state.evidenceDocuments.push(d);applyEvidenceBasis(state,d,'add_update');}
  assert.equal(old.basisState,'additive');assert.equal(revision.basisState,'candidate');assert.equal(second.basisState,'additive');
  const review={documentId:revision.documentId,sourceHash:revision.sourceHashSha256,expectedVersion:state.version,kind:'replacement' as const,targetDocumentId:old.documentId,note:'Corrected amount on the same VO.'};
  assert.throws(()=>f.store.reviewEvidenceRelationship(state.projectId,{...review,expectedVersion:state.version+1}),/VERSION/);
  assert.throws(()=>f.store.reviewEvidenceRelationship(state.projectId,{...review,targetDocumentId:'another-project-document'}),/TARGET/);
  f.store.reviewEvidenceRelationship(state.projectId,review);assert.equal(old.basisState,'superseded');assert.equal(revision.basisState,'additive');assert.equal(second.basisState,'additive');
  assert.equal(revision.relationshipDecision!.targetSourceHash,old.sourceHashSha256);
});


test('candidate purpose review is revision-bound, fills missing approval and cannot rewrite adopted history',async t=>{
 const f=store(t),projectId='PURPOSE';
 const first=await f.store.ingestSchedule({projectId,bytes:xer('2036-08-31'),mediaType:'text/plain',uploadedAt:'2036-09-01',sourceFilename:'draft-file.xer',role:'baseline',roleConfirmed:true,uploadIntent:'add_update'});
 const state=f.store.get(projectId)!,revision=state.schedules[0]!;
 assert.throws(()=>f.store.adoptSchedule(projectId,first.revisionId),/APPROVAL_REFERENCE/);
 const input={expectedVersion:state.version,sourceHash:revision.sourceHashSha256,role:'baseline',approvalReference:'Engineer E-12'};
 assert.throws(()=>f.store.reviewSchedulePurpose(projectId,first.revisionId,{...input,sourceHash:'old'}),/REVISION_CHANGED/);
 f.store.reviewSchedulePurpose(projectId,first.revisionId,input);assert.equal(projectDataDate(state),null);
 f.store.adoptSchedule(projectId,first.revisionId);assert.equal(projectDataDate(state),'2036-08-31');
 assert.throws(()=>f.store.reviewSchedulePurpose(projectId,first.revisionId,{...input,expectedVersion:state.version,role:'recovery'}),/IMMUTABLE/);
});

test('several pending corrections replace only the selected active VO and do not double count after restart',t=>{
 const f=store(t),state=f.store.getOrCreate('VO-MULTI'),rows=[document('original','Variation Order No: VO-009'),document('pending-a','Variation Order No: VO-009'),document('pending-b','Variation Order No: VO-009')];
 for(const [i,d] of rows.entries()){d.uploadedAt='2036-08-0'+(i+1);state.evidenceDocuments.push(d);applyEvidenceBasis(state,d,'add_update');}
 f.store.reviewEvidenceRelationship(state.projectId,{documentId:rows[1]!.documentId,sourceHash:rows[1]!.sourceHashSha256,expectedVersion:state.version,kind:'replacement',targetDocumentId:rows[0]!.documentId,note:'Corrected value with source reference'});
 assert.deepEqual(rows.map(r=>r.basisState),['superseded','additive','candidate']);
 const again=new RuntimeProjectStore({dataDir:f.root,durable:true}).get(state.projectId)!;
 assert.deepEqual(again.evidenceDocuments.map(r=>r.basisState),['superseded','additive','candidate']);
});

test('HTTP gateway persists phase review/adoption, refreshes project versions and rejects stale relationship changes',async t=>{
 const {createProjectGateway}=await import('../packages/runtime-api/src/project-gateway');
 const f=store(t);let gateway=await createProjectGateway(f.root,{maxWorkers:1});let closed=false;t.after(async()=>{if(!closed)await gateway.close();});
 const listen=async()=>{await new Promise<void>(r=>gateway.server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+(gateway.server.address() as any).port;};let base=await listen();
 const path='/api/projects/PHASE-HTTP',jsonHeaders={'content-type':'application/json'};
 assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:jsonHeaders,body:JSON.stringify({projectId:'PHASE-HTTP'})})).status,201);
 const upload=await fetch(base+path+'/phases/NEXT/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'same.xer','x-schedule-role':'baseline','x-schedule-role-confirmed':'1'},body:xer('2037-03-31')});assert.equal(upload.status,201);const stored:any=await upload.json();assert.equal(stored.position.programme,null);
 const revision=stored.position.revisions[0],purpose={expectedVersion:stored.position.projectVersion,sourceHash:revision.sourceHash,role:'baseline',approvalReference:'Engineer E-12'};
 assert.equal((await fetch(base+path+'/phases/NEXT/schedule/revisions/'+revision.revisionId+'/purpose',{method:'POST',headers:jsonHeaders,body:JSON.stringify(purpose)})).status,200);
 assert.equal((await fetch(base+path+'/phases/NEXT/schedule/revisions/'+revision.revisionId+'/purpose',{method:'POST',headers:jsonHeaders,body:JSON.stringify(purpose)})).status,409);
 assert.equal((await fetch(base+path+'/phases/NEXT/schedule/revisions/'+revision.revisionId+'/adopt',{method:'POST'})).status,200);
 assert.equal((await fetch(base+path+'/schedule/revisions/'+revision.revisionId+'/adopt',{method:'POST'})).status,409);
 await gateway.close();gateway=await createProjectGateway(f.root,{maxWorkers:1});base=await listen();
 const restored:any=await (await fetch(base+path+'/phases/NEXT')).json();assert.equal(restored.programme.dataDate,'2037-03-31');
 const ask:any=await (await fetch(base+path+'/intelligence/ask',{method:'POST',headers:jsonHeaders,body:JSON.stringify({question:'What is the Data Date?'})})).json();assert.equal(ask.scope.dataDate,null);assert.equal(ask.telemetry.aiInvoked,false);
 await gateway.close();closed=true;
});


test('ambiguous renamed VO is pending until its relationship is explicit; same filename can still be a distinct reviewed record',t=>{
 const f=store(t),state=f.store.getOrCreate('VO-AMBIGUOUS'),a=document('a','Additional scope amount AED 100'),b=document('b','Additional scope amount AED 150');
 for(const d of [a,b]){state.evidenceDocuments.push(d);applyEvidenceBasis(state,d,'add_update');}assert.equal(a.basisState,'additive');assert.equal(b.basisState,'candidate');
 b.sourceFilename=a.sourceFilename;b.logicalDocumentKey=a.logicalDocumentKey;
 f.store.reviewEvidenceRelationship(state.projectId,{documentId:b.documentId,sourceHash:b.sourceHashSha256,expectedVersion:state.version,kind:'new_record',note:'Separate instructed scope; register identifier not supplied.'});
 assert.equal(a.basisState,'additive');assert.equal(b.basisState,'additive');assert.notEqual(a.logicalDocumentKey,b.logicalDocumentKey);
});


test('real text intake retains source VO identity beyond numeric assertions regardless of filenames',async t=>{
 const f=store(t),projectId='VO-CONTENT-ID';
 const upload=(filename:string,amount:number)=>f.store.ingestEvidenceFile({projectId,sourceFilename:filename,bytes:Buffer.from('VARIATION ORDER\nVO No: VO-101\nVariation Amount: AED '+amount+'\nAdditional quantities'),mediaType:'text/plain',uploadedAt:'2036-09-01'});
 await upload('unrelated-one.txt',100);await upload('entirely-renamed.txt',150);
 const docs=f.store.get(projectId)!.evidenceDocuments;assert.deepEqual(docs.map(d=>d.basisState),['additive','candidate']);assert.ok(docs.every(d=>d.identification.sourceDocumentIdentity==='vo:vo-101'));assert.equal(docs[0]!.logicalDocumentKey,docs[1]!.logicalDocumentKey);
});
