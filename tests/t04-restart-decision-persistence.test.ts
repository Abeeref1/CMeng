import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';

const bytes=(text:string)=>new TextEncoder().encode(text);
const registerCsv=(id:string,amount:number)=>bytes('NCR ID,Severity,Status,Raised Date,Amount\n'+id+',Major,Open,2031-04-01,'+amount+'\n');
const paymentCsv=(id:string,amount:number)=>bytes('Certificate No,Period End,Net Certified,Currency,Status\n'+id+',2031-04-30,'+amount+',SAR,Certified\n');
function xer(project:string,date:string){
 return bytes([
  'ERMHDR\t23.12',
  '%T\tPROJECT','%F\tproj_id\tproj_short_name\tdata_date','%R\t1\t'+project+'\t'+date,
  '%T\tPROJWBS','%F\twbs_id\tproj_id\twbs_short_name','%R\t10\t1\tROOT',
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct',
  '%R\t100\t1\t10\tA100\tMain works\tTK_Active\t'+date+'\t2031-05-30\t'+date+'\t2031-05-30\t240\t160\t16\t35',
  '%E'
 ].join('\n'));
}

async function replaceEvidence(store:RuntimeProjectStore,projectId:string,kind:'register'|'commercial'){
 const common=kind==='register'
  ?{category:'construction',documentType:'quality_ncr_register',make:registerCsv}
  :{category:'boq_cost',documentType:'payment_certificate_register',make:paymentCsv};
 const old=await store.ingestEvidenceFile({projectId,bytes:common.make('OLD',100),mediaType:'text/csv',
  sourceFilename:kind+'-old.csv',category:common.category,documentType:common.documentType,
  uploadedAt:'2031-04-30T08:00:00Z',uploadIntent:'replace_current_basis'});
 const next=await store.ingestEvidenceFile({projectId,bytes:common.make('NEW',200),mediaType:'text/csv',
  sourceFilename:kind+'-new.csv',category:common.category,documentType:common.documentType,
  uploadedAt:'2031-04-30T09:00:00Z',uploadIntent:'add_update'});
 const state=store.get(projectId)!;
 const oldDoc=state.evidenceDocuments.find(d=>d.documentId===old.documentId)!;
 const nextDoc=state.evidenceDocuments.find(d=>d.documentId===next.documentId)!;
 store.reviewEvidenceRelationship(projectId,{documentId:nextDoc.documentId,sourceHash:nextDoc.sourceHashSha256,
  expectedVersion:state.version,kind:'replacement',targetDocumentId:oldDoc.documentId,note:'T04 explicit current source choice'});
 return {oldId:oldDoc.documentId,newId:nextDoc.documentId,family:nextDoc.familyKey,newHash:nextDoc.sourceHashSha256};
}

test('T04 register, commercial and programme source choices survive a fresh durable store',async()=>{
 const dataDir=mkdtempSync(join(tmpdir(),'cmeng-t04-restart-'));
 try{
  const first=new RuntimeProjectStore({dataDir,durable:true});
  const reg=await replaceEvidence(first,'T04-REGISTER','register');
  const commercial=await replaceEvidence(first,'T04-COMMERCIAL','commercial');

  await first.ingestSchedule({projectId:'T04-PROGRAMME',bytes:xer('T04-PROGRAMME','2031-04-30'),
    mediaType:'text/plain',sourceFilename:'Current_Programme.xer',sourceRelativePath:'Schedules/Current_Programme.xer',
    role:'update',roleConfirmed:true,label:'Current programme',uploadedAt:'2031-04-30T10:00:00Z',uploadIntent:'add_update'});
  const scheduleState=first.get('T04-PROGRAMME')!;
  const revision=scheduleState.schedules[0]!;
  first.adoptSchedule('T04-PROGRAMME',revision.revision.revisionId);

  const second=new RuntimeProjectStore({dataDir,durable:true});
  for(const [projectId,choice] of [['T04-REGISTER',reg],['T04-COMMERCIAL',commercial]] as const){
   const restored=second.get(projectId)!;
   const selected=restored.evidenceDocuments.find(d=>d.documentId===choice.newId)!;
   const prior=restored.evidenceDocuments.find(d=>d.documentId===choice.oldId)!;
   assert.equal(selected.relationshipDecision?.kind,'replacement',projectId);
   assert.equal(selected.relationshipDecision?.targetDocumentId,choice.oldId,projectId);
   assert.equal(selected.relationshipDecision?.sourceHash,choice.newHash,projectId);
   assert.equal(selected.basisState,'active',projectId);
   assert.equal(prior.basisState,'superseded',projectId);
   assert.equal(restored.activeEvidenceBasis[choice.family]?.activeDocumentId,choice.newId,projectId);
  }

  const restoredSchedule=second.get('T04-PROGRAMME')!;
  const restoredRevision=restoredSchedule.schedules[0]!;
  const scheduleDocument=restoredSchedule.evidenceDocuments.find(d=>d.linkedArtifactId===restoredRevision.revision.revisionId)!;
  assert.equal(scheduleDocument.scheduleAdoption?.sourceHashSha256,restoredRevision.sourceHashSha256);
  assert.equal(scheduleDocument.basisState,'active');
  assert.equal(restoredSchedule.activeEvidenceBasis[scheduleDocument.familyKey]?.activeDocumentId,scheduleDocument.documentId);
  assert.equal(projectControlSchedule(restoredSchedule)?.revision.revisionId,restoredRevision.revision.revisionId);
 }finally{rmSync(dataDir,{recursive:true,force:true});}
});
