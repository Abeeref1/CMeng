// R15 (c4-state, guard R3): every file is read completely, or its record says
// exactly which part was not read. Before this fix a file whose whole text was
// read could still be stored as 'partial': a contract with no numbered clauses
// (the blind Main_Contract_*.txt, and the same text as a PDF), and a reference
// text file (MANIFEST_SOURCE_FILES.txt) held for a type review. Now one shared
// rule sets the reading state from what was read. A missing clause structure is
// a separate review note shown on the contract terms; a candidate contract with
// that note stays held exactly as before; nothing is adopted by reading. Stored
// projects get the corrected state once on start (versioned, idempotent), with
// document identity, basis, authority and decisions unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {contractTermVersions} from '../packages/runtime-api/src/contract-term-versions';
import {contractValueReview,contractValueEntryInput} from '../packages/runtime-api/src/source-review-decisions';
import {documentReadReview} from '../packages/runtime-api/src/document-read-review';
import {sourceCandidateHold,sourceCandidateHoldDiagnostic} from '../packages/truth-kernel/src';
import {READING_STATE_VERSION} from '../packages/runtime-api/src/reading-state';
import {canonicalTimeClaims} from '../packages/runtime-api/src/canonical-time-claims';

// The blind-round text contract: every byte decodes, no numbered clauses.
const NO_CLAUSES=[
 'MAIN WORKS CONTRACT AGREEMENT','Conditions of Contract and Contract Data.','Contract currency is SAR.',
 'Accepted Contract Amount is SAR 12000000.','Contractual completion date: 2033-04-28.',
 'The Contractor shall give notice within 14 calendar days as a condition precedent to an extension of time.',
 'The Engineer shall determine extensions of time in calendar days.','Delay damages apply per calendar day subject to the stated cap.',
];
const NUMBERED=[
 'CONSTRUCTION CONTRACT','1 Contract Particulars','Contract currency is SAR.','Accepted Contract Amount: SAR 48,500,000.',
 'Contractual completion date: 2032-06-30.','2 Certification and Payment','Payment period: 56 days after certification.',
 '3 Retention','Retention percentage: 5%',
];
const NOTE='No numbered clauses were found, so the clause structure needs review.';
const MANIFEST='Source files supplied for this project:\nProgramme_Update.xer\nClaims_Register.csv\nMain_Contract.pdf\n';
async function pdf(lines:string[]){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 doc.addPage([595,842]).drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
 return Buffer.from(await doc.save());
}
const text=(lines:string[])=>Buffer.from(lines.join('\n'),'utf8');
async function request(base:string,path:string,init?:RequestInit){
 const response=await fetch(base+path,init),body=await response.text();
 let json:any=null;try{json=body?JSON.parse(body):null;}catch{json=body;}
 return {status:response.status,body:json,text:body};
}
async function upload(base:string,projectId:string,filename:string,mediaType:string,bytes:Buffer){
 const response=await request(base,'/api/projects/'+encodeURIComponent(projectId)+'/evidence/uploads',{method:'POST',
  headers:{'content-type':mediaType,'x-source-filename-encoded':encodeURIComponent(filename),'x-source-relative-path-encoded':encodeURIComponent(filename),
   'x-upload-intent':'add_update','x-upload-id':projectId+'-'+filename},body:new Uint8Array(bytes)});
 assert.equal(response.status,201,filename+' upload failed: '+response.text.slice(0,500));
}
const reviewState=(d:any)=>({category:d.category,documentType:d.documentType,parserState:d.parserState,basisState:d.basisState,authority:d.authority,
 structureReview:d.structureReview?.note??null,readState:d.readReview.state,readComplete:d.readReview.complete,readingState:d.readingStatus?.state});

test('R15 R3 through the real upload path: a contract read in full with no numbered clauses is read completely as .txt and .pdf; the structure note sits on the contract terms',{timeout:600000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'cmeng-r15-read-state-'));
 const gateway=await createProjectGateway(root,{maxWorkers:2});
 await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
 try{
  const documents:Record<string,any>={},pages:Record<string,string>={};
  for(const [projectId,filename,mediaType,bytes] of [
   ['R3-TXT','Main_Contract_653.txt','text/plain',text(NO_CLAUSES)],
   ['R3-PDF','Main_Contract_653.pdf','application/pdf',await pdf(NO_CLAUSES)],
  ] as const){
   assert.equal((await request(base,'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId})})).status,201);
   await upload(base,projectId,filename,mediaType,bytes);
   await upload(base,projectId,'MANIFEST_SOURCE_FILES.txt','text/plain',Buffer.from(MANIFEST));
   await upload(base,projectId,'Risk Register.txt','text/plain',Buffer.from('Project risk register. The register table will be issued by the contractor.'));
   const listed=(await request(base,'/api/projects/'+projectId+'/evidence/documents')).body.documents;
   documents[projectId]=Object.fromEntries(listed.map((d:any)=>[d.sourceFilename.replace(/\.(?:txt|pdf)$/,''),d]));
   const page=await request(base,'/api/projects/'+projectId+'/commercial/modules/contract-particulars-bonds');
   assert.equal(page.status,200,page.text.slice(0,300));
   pages[projectId]=page.text;
  }
  const txt=documents['R3-TXT']['Main_Contract_653'],pdfDocument=documents['R3-PDF']['Main_Contract_653'];
  for(const document of [txt,pdfDocument]){
   assert.equal(document.category,'contract',document.sourceFilename);
   assert.equal(document.parserState,'parsed',document.sourceFilename+': the whole source was read, so it is read completely');
   assert.equal(document.readReview.complete,true,document.sourceFilename);
   assert.equal(document.structureReview?.note,NOTE,document.sourceFilename+': the missing clause structure is a separate review note');
   assert.ok(!/clause/i.test(document.readReview.note),document.sourceFilename+': the reading record says what was read, not the structure: '+document.readReview.note);
   assert.equal(document.authority,'candidate_only',document.sourceFilename+': reading never adopts the contract');
  }
  assert.deepEqual(reviewState(txt),reviewState(pdfDocument),'the .txt and .pdf contracts have the same state');
  for(const projectId of ['R3-TXT','R3-PDF']){
   assert.ok(pages[projectId]!.includes(NOTE),projectId+': the clause structure note is shown with the contract terms');
   assert.ok(!pages[projectId]!.includes('user-confirmation:contract-fact:'),projectId+': nothing is decided by reading');
   // A reference text file read in full is read completely; it has no authority.
   const manifest=documents[projectId]['MANIFEST_SOURCE_FILES'];
   assert.equal(manifest.parserState,'parsed',projectId+': '+JSON.stringify(manifest.readReview));
   assert.equal(manifest.readReview.label,'Reference text read');
   assert.equal(manifest.readReview.complete,true);
   assert.match(manifest.readReview.note,/Reference reading does not establish numeric or contractual authority\./);
   assert.notEqual(manifest.basisState,'active','a reference file is not a current basis');
   // A register uploaded as prose has no register rows: it is not reported as a parsed register.
   assert.notEqual(documents[projectId]['Risk Register'].parserState,'parsed','a risk register without rows is not a parsed register');
  }
 }finally{
  await gateway.close();
  await rm(root,{recursive:true,force:true});
 }
});

test('R15 R3 the shared candidate rule keeps a contract with a structure review held, under its own reason',()=>{
 const candidate=(extra:Record<string,unknown>)=>({documentId:'C2',sourceHashSha256:'h2',storedPath:'',sourceFilename:'Contract_B.txt',mediaType:'text/plain',
  basisState:'candidate',linkedArtifactId:'C2',uploadedAt:'2031-01-01',familyKey:'contract:replacement-review',documentType:'main_contract',parserState:'parsed',
  identification:{needsReview:false},lineage:{needsReview:false},supersededByDocumentId:null,...extra}) as any;
 const held=candidate({structureReview:{sourceHashSha256:'h2',note:NOTE}});
 const hold=sourceCandidateHold([held]);
 assert.equal(hold(held),'structure_review','read in full, but its clause structure needs review: still held');
 assert.equal(sourceCandidateHoldDiagnostic(held,'structure_review'),'CANDIDATE_STRUCTURE_REVIEW_REQUIRED:C2');
 const clear=candidate({});
 assert.equal(sourceCandidateHold([clear])(clear),null,'a fully read contract with a clear structure is admitted as before');
 const stale=candidate({structureReview:{sourceHashSha256:'older-source',note:NOTE}});
 assert.equal(sourceCandidateHold([stale])(stale),null,'a note for other source bytes does not apply');
 const partial=candidate({parserState:'partial'});
 assert.equal(sourceCandidateHold([partial])(partial),'not_fully_read','a file not read in full stays held as not fully read');
});

test('R15 R3 stored projects get the corrected reading state once on start; identity, basis, authority and decisions are kept',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'cmeng-r15-read-state-refresh-'));
 try{
  const first=new RuntimeProjectStore({dataDir,durable:true});
  const P='R3-STORED',Q='R3-STORED-OLD-TXT';
  const ingest=(store:RuntimeProjectStore,projectId:string,name:string,bytes:Buffer)=>store.ingestEvidenceFile({projectId,bytes,mediaType:'text/plain',sourceFilename:name,uploadedAt:'2031-09-01T00:00:00Z'});
  await ingest(first,P,'Main_Contract_653.txt',text(NO_CLAUSES));
  await ingest(first,P,'MANIFEST_SOURCE_FILES.txt',Buffer.from(MANIFEST));
  await ingest(first,Q,'Main_Contract_919.txt',text(NUMBERED));
  const R='R3-STORED-OLD-TXT-OTHER-DATE';
  await ingest(first,R,'Main_Contract_920.txt',text(NUMBERED));
  // A user decision recorded before the refresh.
  const review=contractValueReview(first.get(P)!);
  first.updateControls(P,{reviewDecisions:{'contract-value':{sourceFingerprint:review.sourceFingerprint,choice:'enter_value',...contractValueEntryInput({enteredValue:'12,000,000',enteredCurrency:'SAR'}),confirmedAt:'2031-09-02T00:00:00Z',sourceRefs:[]}} as any});
  // Put both projects back in the shape stored by the earlier reader.
  const p=first.get(P)!,q=first.get(Q)!;
  const contract=p.evidenceDocuments.find(d=>d.sourceFilename==='Main_Contract_653.txt')!,manifest=p.evidenceDocuments.find(d=>d.sourceFilename==='MANIFEST_SOURCE_FILES.txt')!;
  assert.equal(contract.parserState,'parsed');assert.equal(manifest.parserState,'parsed');
  contract.parserState='partial';delete contract.structureReview;manifest.parserState='partial';
  const old=q.evidenceDocuments.find(d=>d.sourceFilename==='Main_Contract_919.txt')!;
  q.contractDocuments=q.contractDocuments.filter(c=>c.documentId!==old.documentId);q.contract=null;q.contractFamily=null;
  old.parserState='identified';old.linkedArtifactId=null;old.semanticAiSteps=[];delete old.structureReview;
  const r=first.get(R)!,oldR=r.evidenceDocuments.find(d=>d.sourceFilename==='Main_Contract_920.txt')!;
  r.contractDocuments=r.contractDocuments.filter(c=>c.documentId!==oldR.documentId);r.contract=null;r.contractFamily=null;
  oldR.parserState='identified';oldR.linkedArtifactId=null;oldR.semanticAiSteps=[];delete oldR.structureReview;
  // A completion date the user confirmed in Actions required while the text was
  // read only as reference (stored exactly as the confirm-contract-completion route
  // stores it): the same date as the text for Q, a different date for R.
  const confirmed=(day:string)=>({contractualCompletionIso:day+'T00:00:00.000Z',contractualCompletionState:'official',completionReason:'Confirmed by user in Actions required.',
   officialApprovedEotDays:null,officialApprovedEotState:'missing',eotDayBasis:'unknown',eotDayBasisState:'missing',sourceRefs:['user-confirmation:contract-completion:'+day]}) as any;
  q.controls.contractTimeBasis=confirmed('2032-06-30');r.controls.contractTimeBasis=confirmed('2032-09-15');
  (first as any).persistSnapshot();
  const before={p:structuredClone(p),q:structuredClone(q),r:structuredClone(r)};
  const identity=(d:any)=>[d.documentId,d.sourceHashSha256,d.storedPath,d.basisState,d.authority,d.category,d.documentType,d.familyKey];

  const second=new RuntimeProjectStore({dataDir,durable:true});
  const p2=second.get(P)!,q2=second.get(Q)!;
  const contract2=p2.evidenceDocuments.find(d=>d.documentId===contract.documentId)!,manifest2=p2.evidenceDocuments.find(d=>d.documentId===manifest.documentId)!;
  assert.equal(contract2.parserState,'parsed','the stored contract read in full is read completely');
  assert.equal(contract2.structureReview?.note,NOTE);
  assert.deepEqual(contract2.readingStateRefresh&&[contract2.readingStateRefresh.producerVersion,contract2.readingStateRefresh.previousParserState],[READING_STATE_VERSION,'partial'],'the earlier state is kept on the receipt');
  assert.equal(manifest2.parserState,'parsed','the stored reference text read in full is read completely');
  assert.equal(documentReadReview(manifest2,p2).complete,true);
  for(const [a,b] of [[before.p.evidenceDocuments,p2.evidenceDocuments],[before.q.evidenceDocuments,q2.evidenceDocuments]] as const)
   assert.deepEqual(b.map(identity),a.map(identity),'document identity, basis, authority and family are unchanged');
  assert.deepEqual(p2.controls.reviewDecisions,before.p.controls.reviewDecisions,'decisions are unchanged');
  assert.ok(p2.version>before.p.version,'the corrected state is a new project version');
  // A text contract stored before text contracts were read is read once by the same reader.
  const old2=q2.evidenceDocuments.find(d=>d.documentId===old.documentId)!;
  assert.equal(old2.parserState,'parsed');
  assert.equal(old2.linkedArtifactId,old.documentId);
  assert.equal(old2.readingStateRefresh?.contractTextRead,true);
  assert.equal(q2.contractDocuments.find(c=>c.documentId===old.documentId)?.result.sourceType,'text');
  assert.ok(q2.contract,'the contract basis is restored from the text contract');
  assert.deepEqual(contractTermVersions(q2).map(v=>v.term).sort(),['paymentPeriodDays','retentionPercent'],'its terms are read with the file as source');
  assert.equal(old2.authority,'candidate_only');
  // The refresh changes no decision: the confirmed completion date stays the
  // reporting basis with its reason and source.
  assert.deepEqual(q2.controls.contractTimeBasis,before.q.controls.contractTimeBasis,'a confirmed completion date is kept as it was confirmed');
  const r2=second.get(R)!;
  assert.equal(r2.controls.contractTimeBasis?.contractualCompletionIso,'2032-09-15T00:00:00.000Z','a different date read from the contract does not replace the confirmed date');
  assert.equal(r2.controls.contractTimeBasis?.completionReason,'Confirmed by user in Actions required.');
  assert.deepEqual(r2.controls.contractTimeBasis?.sourceRefs,['user-confirmation:contract-completion:2032-09-15']);
  assert.deepEqual(r2.controls.contractTimeBasis?.contractualCompletionSourceConflicts,['UNADOPTED_SOURCE_COMPLETION_DIFFERS:2032-06-30:'+oldR.documentId],'the date read now is kept as a named conflict for the user');
  // Every page reads the one time position: it shows the confirmed date and names the conflict.
  const shownR=canonicalTimeClaims(r2,true).contractTimeBasis;
  assert.equal(shownR?.contractualCompletionIso,'2032-09-15T00:00:00.000Z','the pages show the confirmed date, not the date read by the refresh');
  assert.equal(shownR?.completionReason,'Confirmed by user in Actions required.');
  assert.deepEqual(shownR?.contractualCompletionSourceConflicts,['UNADOPTED_SOURCE_COMPLETION_DIFFERS:2032-06-30:'+oldR.documentId]);
  assert.equal(String(canonicalTimeClaims(q2,true).contractTimeBasis?.contractualCompletionIso).slice(0,10),'2032-06-30','the same confirmed day is shown when the contract states it too');

  // Idempotent: a further start changes nothing.
  const third=new RuntimeProjectStore({dataDir,durable:true});
  assert.equal(third.get(P)!.version,p2.version);
  assert.equal(third.get(Q)!.version,q2.version);
  assert.deepEqual(third.get(P)!.evidenceDocuments.map(d=>d.readingStateRefresh??null),p2.evidenceDocuments.map(d=>d.readingStateRefresh??null));
  assert.equal(third.get(Q)!.contractDocuments.length,q2.contractDocuments.length,'the text contract is not read twice');
  assert.deepEqual(third.get(R)!.controls.contractTimeBasis,r2.controls.contractTimeBasis,'a further start keeps the confirmed date and its conflict');
 }finally{
  await rm(dataDir,{recursive:true,force:true});
 }
});
