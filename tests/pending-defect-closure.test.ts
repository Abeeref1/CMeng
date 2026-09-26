import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {commercialCanonical} from '../packages/runtime-api/src/commercial-canonical';
import {resolveBoqSource} from '../packages/runtime-api/src/boq-source';
import {withInstalledMeasurements} from '../packages/runtime-api/src/installed-measurements';
import {documentReadReview} from '../packages/runtime-api/src/document-read-review';
import {certifyCrossModuleConsistency} from '../packages/runtime-api/src/certification';
import {ingestBoq} from '../packages/boq-ingestion/src';
import {identifyEvidenceDocument} from '../packages/runtime-api/src/document-identification';

function fixture(t:any){const dir=mkdtempSync(join(tmpdir(),'pending-closure-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,store:new RuntimeProjectStore({dataDir:dir,durable:false})};}
function programme(date:string){return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tPROJ\t'+date,'%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt','%R\t1\t1\tA1\tWorks\t2031-01-01\t2031-12-31\t8\t8\t0','%E'].join('\n');}
async function schedule(store:RuntimeProjectStore,id:string,date:string,name:string,intent:'add_update'|'replace_current_basis'='replace_current_basis'){
 return store.ingestEvidenceFile({projectId:id,sourceFilename:name,bytes:Buffer.from(programme(date)),mediaType:'text/plain',uploadedAt:'2031-09-01T00:00:00Z',uploadIntent:intent});
}
async function csv(store:RuntimeProjectStore,id:string,name:string,text:string,intent:'add_update'|'replace_current_basis'='add_update'){
 return store.ingestEvidenceFile({projectId:id,sourceFilename:name,bytes:Buffer.from(text),mediaType:'text/csv',uploadedAt:'2031-09-01T00:00:00Z',uploadIntent:intent});
}

test('later programme data dates never adopt themselves; drafts remain scenarios even under replacement intent',async t=>{
 const {store,dir}=fixture(t),id='AUTH';
 const first=await schedule(store,id,'2031-03-31','Current.xer');
 const second=await schedule(store,id,'2031-06-30','Update.xer','add_update');
 const draft=await schedule(store,id,'2031-08-31','S04_DRAFT_Future.xer');
 let state=store.get(id)!;
 assert.equal(projectControlSchedule(state)?.revision.revisionId,first.linkedArtifactId);
 assert.equal(state.evidenceDocuments.find(d=>d.documentId===second.documentId)?.basisState,'candidate');
 assert.equal(state.evidenceDocuments.find(d=>d.documentId===draft.documentId)?.basisState,'scenario');
 assert.throws(()=>store.adoptSchedule(id,draft.linkedArtifactId!),/SCENARIO/);
 store.adoptSchedule(id,second.linkedArtifactId!);
 assert.equal(projectControlSchedule(state)?.revision.revisionId,second.linkedArtifactId);
 const restored=new RuntimeProjectStore({dataDir:dir,durable:false});state=restored.get(id)!;
 assert.equal(projectControlSchedule(state)?.revision.revisionId,second.linkedArtifactId);
 assert.equal(state.evidenceDocuments.find(d=>d.documentId===second.documentId)?.uploadIntent,'add_update','original upload intent retained separately from subsequent adoption');
});

test('legacy automatic draft selection is withdrawn using retained history without fabricating approval or changing sources',async t=>{
 const {store,dir}=fixture(t),id='LEGACY';
 const current=await schedule(store,id,'2031-03-31','Current.xer');
 const draft=await schedule(store,id,'2031-08-31','S04_DRAFT_Future.xer');
 const state=store.get(id)!,before=state.evidenceDocuments.map(d=>[d.documentId,d.sourceHashSha256,readFileSync(d.storedPath).toString('base64')]);
 for(const d of state.evidenceDocuments){delete d.scheduleAdoption;d.uploadIntent='add_update';d.familyKey='schedule:control';d.logicalDocumentKey='schedule:control';d.scheduleRole='update';d.basisState=d.documentId===draft.documentId?'active':'superseded';}
 state.schedules.forEach(s=>s.role='update');delete state.scheduleAuthorityVersion;
 state.activeEvidenceBasis['schedule:control']={familyKey:'schedule:control',behavior:'schedule_special',activeDocumentId:draft.documentId,activeArtifactId:draft.linkedArtifactId,updatedAt:'2031-09-01',reason:'Incoming control schedule has a later internal Data Date.',previousDocumentIds:[current.documentId]};store.touch(state);
 const restored=new RuntimeProjectStore({dataDir:dir,durable:false}),after=restored.get(id)!;
 assert.equal(projectControlSchedule(after)?.revision.revisionId,current.linkedArtifactId);
 assert.equal(after.evidenceDocuments.find(d=>d.documentId===current.documentId)?.scheduleAdoption?.method,'legacy_retained');
 assert.equal(after.evidenceDocuments.find(d=>d.documentId===draft.documentId)?.basisState,'scenario');
 assert.deepEqual(after.evidenceDocuments.map(d=>[d.documentId,d.sourceHashSha256,readFileSync(d.storedPath).toString('base64')]),before);
 after.activeEvidenceBasis['schedule:control']!.activeArtifactId=draft.linkedArtifactId;
 const gate=certifyCrossModuleConsistency({state:after,modules:new Map(),director:null,boardReport:null,generatedAt:'2031-09-01'});
 assert.equal(gate.checks.find(c=>c.checkId==='CURRENT_PROGRAMME_ADOPTION_AUTHORITY')?.state,'fail');
});

test('all supported EVM currency headers retain real figures and reject contradictory currencies',async t=>{
 const {store}=fixture(t);
 for(const header of ['Unit','Currency','Currency/Unit']){
  const id='COST-'+header.replace(/[^A-Za-z]/g,'').toUpperCase();await schedule(store,id,'2031-08-31','Current.xer');
  await csv(store,id,'COST01.csv','Metric,Value,'+header+',As Of,VAT Basis\nBAC,100,AED,2031-08-31,Exclusive of VAT\nPV,80,AED,2031-08-31,Exclusive of VAT\nEV,0,AED,2031-08-31,Exclusive of VAT\nAC,60,AED,2031-08-31,Exclusive of VAT\nCPI,0,index,2031-08-31,N/A');
  const ledger=commercialCanonical(store.get(id)!);
  assert.equal(ledger.costMetrics.length,4);assert.equal(ledger.costMetrics.find(m=>m.metric==='EV')?.amount.value,0);
 }
 await schedule(store,'CONFLICT','2031-08-31','Current.xer');
 await csv(store,'CONFLICT','COST01.csv','Metric,Value,Currency,Unit,As Of\nBAC,100,AED,SAR,2031-08-31');
 const conflict=commercialCanonical(store.get('CONFLICT')!);assert.equal(conflict.costMetrics.length,0);assert.ok(conflict.diagnostics.some(d=>d.startsWith('COST_ROW_CURRENCY_CONFLICT')));
});

test('installed measurement registers never replace BOQ and map only exact item and unit with retained future rows',async t=>{
 const {store}=fixture(t),id='QUANTITY';await schedule(store,id,'2031-08-31','Current.xer');
 await csv(store,id,'Original_BOQ.csv','Item No,Description,Unit,Quantity,Rate,Amount\n1,Concrete,m3,100,2,200');
 const original=resolveBoqSource(store.get(id)!,'').selection.sourceDocumentId;
 const measurement=await csv(store,id,'Installed.csv','Measurement Date,Item No,Cumulative Installed Qty,Unit,Measured By\n2031-07-31,1,12,m3,Engineer\n2031-08-31,1,20,m3,Engineer\n2031-09-30,1,30,m3,Engineer','replace_current_basis');
 assert.equal(measurement.documentType,'installed_measurement_register');assert.equal(measurement.basisEffect.familyKey,'quantity:measurements');
 const state=store.get(id)!,source=resolveBoqSource(state,'');assert.equal(source.selection.sourceDocumentId,original);
 const measured=withInstalledMeasurements(state,source.quantities,'2031-08-31')!;
 assert.deepEqual(measured.installedSnapshots.map(s=>s.installedQuantity),[12,20,30]);assert.equal(measured.measurementReview?.futureRowCount,1);assert.equal(measured.measurementReview?.complete,true);
 await csv(store,id,'Unmatched.csv','Measurement Date,Item No,Cumulative Installed Qty,Unit\n2031-08-31,UNKNOWN,4,m3');
 assert.equal(withInstalledMeasurements(state,source.quantities,'2031-08-31')?.measurementReview?.complete,false);
});

test('legacy measurement-as-BOQ migration restores the original quantities and keeps both raw sources',async t=>{
 const {store}=fixture(t),id='LEGACY-QUANTITY';await schedule(store,id,'2031-08-31','Current.xer');
 await csv(store,id,'Original_BOQ.csv','Item No,Description,Unit,Quantity,Rate,Amount\n1,Concrete,m3,100,2,200');
 const state=store.get(id)!,original=state.boq!;
 const bytes=Buffer.from('Measurement Date,Item No,Cumulative Installed Qty,Unit\n2031-08-31,1,20,m3');
 const misfiled=await ingestBoq({projectId:id,bytes,verifiedMediaType:'text/csv',sourceFilename:'Measured.csv',receivedAt:'2031-09-02'});
 store.attachBoq(misfiled,bytes,'Measured.csv',null,undefined,undefined,[],'replace_current_basis');
 assert.equal(state.boq?.ingestionId,misfiled.ingestionId);
 const before=state.evidenceDocuments.map(d=>[d.documentId,d.sourceHashSha256,readFileSync(d.storedPath).toString('base64')]);
 await store.refreshSpreadsheetRegisters(id);
 assert.equal(state.boq?.ingestionId,original.ingestionId);
 assert.equal(state.evidenceDocuments.find(d=>d.sourceFilename==='Measured.csv')?.familyKey,'quantity:measurements');
 const measured=withInstalledMeasurements(state,resolveBoqSource(state,'').quantities,'2031-08-31');
 assert.equal(measured?.installedSnapshots[0]?.installedQuantity,20);
 assert.deepEqual(state.evidenceDocuments.map(d=>[d.documentId,d.sourceHashSha256,readFileSync(d.storedPath).toString('base64')]),before);
});

test('security content is required while a genuine guarantee retains its evidence family',async()=>{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage();
 ['Performance bank guarantee','Guarantee number: BG-123','Beneficiary: Employer','Issuing bank: Bank','Guarantee amount: AED 100000','Expiry: 31 December 2031'].forEach((line,i)=>page.drawText(line,{x:30,y:700-i*25,size:12,font}));
 const result=await identifyEvidenceDocument({bytes:await pdf.save(),sourceFilename:'unrelated.pdf',sourceRelativePath:null});
 assert.equal(result.identification.detectedDocumentType,'bond_register');
 assert.notEqual(result.identification.method,'metadata_fallback');
});

test('native PDFs without OCR-pending status receive complete hash-bound page receipts; reference text receives a reading review',async t=>{
 const {store}=fixture(t),id='READ';const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let i=0;i<2;i++){const p=pdf.addPage();p.drawText('Reference memorandum. This page contains the retained supporting explanation for document review. Page '+(i+1),{x:30,y:600,size:11,font});}
 const result=await store.ingestEvidenceFile({projectId:id,sourceFilename:'SEC02_Confidential_Commercial_Memo.pdf',bytes:await pdf.save(),mediaType:'application/pdf',uploadedAt:'2031-09-01'});
 assert.notEqual(result.documentType,'bond_register');
 const state=store.get(id)!,document=state.evidenceDocuments[0]!;assert.notEqual(document.parserState,'ocr_pending');
 await store.refreshDeferredPdfReads(id);
 const review=documentReadReview(document,state);assert.equal(review.complete,true);assert.equal(review.readPageCount,2);assert.equal(document.fullTextRead?.sourceHashSha256,document.sourceHashSha256);
 const version=state.version;assert.equal((await store.refreshDeferredPdfReads(id)).refreshedDocumentCount,0);assert.equal(state.version,version);
 await store.ingestEvidenceFile({projectId:id,sourceFilename:'Instructions.txt',bytes:Buffer.from('Retained project reference instructions.'),mediaType:'text/plain',uploadedAt:'2031-09-01'});
 assert.equal(documentReadReview(state.evidenceDocuments[1]!,state).label,'Reference text read');
});
