// R15 (c4-txt): a plain-text or Markdown contract is read by its content.
// Before this fix the contract clause reader took only PDF and Word. A contract
// uploaded as Main_Contract_919.txt was kept as 'Reference text read' with the
// state 'identified': guard rule R3 flagged it and none of its terms reached the
// contract readers. Now a .txt or .md file that document identification knows as
// a contract by its content goes through the same contract text reader as PDF
// page text. Its clauses become terms with the file as their source, under the
// same review and adoption rules as a PDF contract: the evidence authority stays
// 'candidate only', nothing is adopted without a decision, and the file counts
// as fully read (parsed) only when its whole text was read.
// The projects are built through the real upload path (HTTP gateway).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectDirectory} from '../packages/runtime-api/src/project-catalog';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {contractTermVersions} from '../packages/runtime-api/src/contract-term-versions';
import {contractCompletionPosition} from '../packages/runtime-api/src/contract-completion';
import {contractValueReview} from '../packages/runtime-api/src/source-review-decisions';
import {contractNoticeRules} from '../packages/runtime-api/src/contract-notice-rules';

// A main contract with numbered clauses (as a real contract states them).
const MAIN=[
 'CONSTRUCTION CONTRACT',
 '1 Contract Particulars',
 'Contract currency is SAR.',
 'Accepted Contract Amount: SAR 48,500,000.',
 'Contractual completion date: 2032-06-30.',
 '2 Certification and Payment',
 'Payment period: 56 days after certification.',
 '3 Retention',
 'Retention percentage: 5%',
 '4 Delay Damages',
 'Delay damages rate: SAR 25,000 per calendar day.',
 'Delay damages cap: 10% of the Contract Amount.',
 '5 Notices and Claims',
 'Initial claim notice: 28 calendar days after the event occurs.',
];
// The same contract written in Markdown.
const MAIN_MD=MAIN.map(line=>/^\d+ /.test(line)?'## '+line:line==='CONSTRUCTION CONTRACT'?'# '+line:line);
// The blind-round text contract: no numbered clauses at all.
const NO_CLAUSES=[
 'MAIN WORKS CONTRACT AGREEMENT','Conditions of Contract and Contract Data.','Contract currency is SAR.',
 'Accepted Contract Amount is SAR 12000000.','Contractual completion date: 2033-04-28.',
 'The Contractor shall give notice within 14 calendar days as a condition precedent to an extension of time.',
 'Delay damages apply per calendar day subject to the stated cap.',
];

async function pdf(lines:string[]){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 doc.addPage([595,842]).drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
 return Buffer.from(await doc.save());
}
const text=(lines:string[])=>Buffer.from(lines.join('\n')+'\n','utf8');
const words=(value:string)=>value.replace(/[#\s]+/g,' ').trim();
const _outline=(result:any)=>({clauses:result.clauses.map((c:any)=>[c.identifier,c.heading]),
 sections:result.sections.map((s:any)=>[s.kind,s.identifier,words(s.text)]),complete:result.complete,semanticComplete:result.semanticComplete});

async function request(base:string,path:string,init?:RequestInit){
 const response=await fetch(base+path,init),body=await response.text();
 let json:any=null;try{json=body?JSON.parse(body):null;}catch{json=body;}
 return {status:response.status,body:json,text:body};
}
async function evidenceUpload(base:string,projectId:string,filename:string,mediaType:string,bytes:Buffer){
 const response=await request(base,'/api/projects/'+encodeURIComponent(projectId)+'/evidence/uploads',{method:'POST',
  headers:{'content-type':mediaType,'x-source-filename-encoded':encodeURIComponent(filename),'x-source-relative-path-encoded':encodeURIComponent(filename),
   'x-upload-intent':'add_update','x-upload-id':projectId+'-'+filename},body:bytes});
 assert.equal(response.status,201,filename+' upload failed: '+response.text.slice(0,500));
}
async function contractUpload(base:string,projectId:string,filename:string,mediaType:string,role:string,bytes:Buffer){
 const response=await request(base,'/api/projects/'+encodeURIComponent(projectId)+'/contract/uploads',{method:'POST',
  headers:{'content-type':mediaType,'x-source-filename-encoded':encodeURIComponent(filename),'x-source-relative-path-encoded':encodeURIComponent(filename),'x-contract-role':role},body:bytes});
 assert.equal(response.status,201,filename+' contract upload failed: '+response.text.slice(0,500));
 return response.body;
}
async function createProject(base:string,projectId:string){
 const created=await request(base,'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId})});
 assert.equal(created.status,201,created.text);
}
async function contractDocument(base:string,projectId:string,filename:string){
 const documents=(await request(base,'/api/projects/'+encodeURIComponent(projectId)+'/evidence/documents')).body.documents;
 const document=documents.find((d:any)=>d.sourceFilename===filename);
 assert.ok(document,filename+' is stored');
 return document;
}
const reviewState=(document:any)=>({category:document.category,documentType:document.documentType,method:document.identification.method,
 parserState:document.parserState,basisState:document.basisState,authority:document.authority,sourceAnalyticalUse:document.sourceAnalyticalUse,
 readState:document.readReview.state,readComplete:document.readReview.complete,readingState:document.readingStatus?.state,readingReason:document.readingStatus?.reasonCode});
// The shared contract readers, with document identity and source locators left out.
function readers(state:any){
 const terms=contractTermVersions(state).map(v=>({term:v.term,value:v.value,unit:v.unit,from:v.effectiveFromIso,to:v.effectiveToIso,applicability:v.applicability,
  clause:v.clauseIdentifier,role:v.role,analytical:v.sourceAnalyticalUse??null,refs:v.sourceRefs.length}))
  .sort((a,b)=>a.term.localeCompare(b.term)||a.value-b.value);
 const completion=contractCompletionPosition(state,'2031-06-30') as any;
 const value=contractValueReview(state);
 const notices=contractNoticeRules(state).map((rule:any)=>({kind:rule.noticeKind,days:rule.noticePeriodDays,from:rule.effectiveFromIso,to:rule.effectiveToIso,
  applicability:rule.applicabilityState,trigger:rule.triggerBasis,state:rule.state,analytical:rule.sourceAnalyticalUse??null,clauses:rule.clauseIdentifiers}));
 return {terms,completion:{value:completion.value,state:completion.state},value:value.candidates.map((c:any)=>[c.amount,c.currency]),valueSelected:value.selected,notices};
}

test('R15 through the real upload path: the same contract as .txt, .md and .pdf gives the same candidate terms and the same review state; nothing is adopted',{timeout:600000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'cmeng-r15-txt-contract-'));
 const gateway=await createProjectGateway(root,{maxWorkers:2});
 await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
 const cases=[
  {projectId:'R15-TXT-PDF',filename:'Main_Contract_919.pdf',mediaType:'application/pdf',bytes:await pdf(MAIN)},
  {projectId:'R15-TXT-TXT',filename:'Main_Contract_919.txt',mediaType:'text/plain',bytes:text(MAIN)},
  {projectId:'R15-TXT-MD',filename:'Main_Contract_919.md',mediaType:'text/markdown',bytes:Buffer.from(MAIN_MD.join('\n'))},
 ];
 const documents:Record<string,any>={};
 try{
  for(const item of cases){
   await createProject(base,item.projectId);
   await evidenceUpload(base,item.projectId,item.filename,item.mediaType,item.bytes);
   documents[item.projectId]=await contractDocument(base,item.projectId,item.filename);
  }
  // A text file that does not fully decode: identified by content, read, but not fully.
  await createProject(base,'R15-TXT-BROKEN');
  await evidenceUpload(base,'R15-TXT-BROKEN','Main_Contract_920.txt','text/plain',Buffer.concat([text(MAIN.slice(0,5)),Buffer.from([0xff,0xfe,0xfd]),text(MAIN.slice(5))]));
  documents.broken=await contractDocument(base,'R15-TXT-BROKEN','Main_Contract_920.txt');
  // A text file with no contract content stays a reference document.
  await evidenceUpload(base,'R15-TXT-TXT','Notes.txt','text/plain',Buffer.from('General project notes. No tabular authority.'));
  documents.notes=await contractDocument(base,'R15-TXT-TXT','Notes.txt');
 }finally{
  await gateway.close();
 }
 try{
  const pdfDocument=documents['R15-TXT-PDF'],txt=documents['R15-TXT-TXT'],md=documents['R15-TXT-MD'];
  for(const document of [pdfDocument,txt,md]){
   assert.equal(document.category,'contract',document.sourceFilename);
   assert.equal(document.documentType,'main_contract',document.sourceFilename);
   assert.equal(document.identification.method,'native_text',document.sourceFilename+' is identified by its content');
   assert.equal(document.authority,'candidate_only',document.sourceFilename+': reading never adopts the contract');
   assert.equal(document.parserState,'parsed',document.sourceFilename+' is fully read: '+JSON.stringify(document.readReview));
   assert.equal(document.readReview.complete,true,document.sourceFilename);
  }
  assert.deepEqual(reviewState(txt),reviewState(pdfDocument),'the .txt contract has the same review state as the PDF');
  assert.deepEqual(reviewState(md),reviewState(pdfDocument),'the .md contract has the same review state as the PDF');
  assert.equal(txt.readReview.label,'All text read');
  assert.match(txt.readReview.note,/^\d+ characters read: the whole text\. Reading does not confirm structured facts, compliance or adoption\.$/);
  assert.equal(txt.linkedArtifactId,txt.documentId,'the text contract is a contract reading, not a reference file');
  // Not fully decoded: the reading record says what part was not read and the file is not 'parsed'.
  assert.equal(documents.broken.category,'contract');
  assert.equal(documents.broken.parserState,'partial');
  assert.equal(documents.broken.readReview.complete,false);
  assert.equal(documents.broken.readReview.label,'Text needs review');
  assert.match(documents.broken.readReview.note,/ of \d+ characters read\. Not read: \d+ byte sequences? that do(?:es)? not decode as UTF-8\. The unread part needs review\./);
  // A text file whose content is not a contract keeps its reference reading.
  assert.notEqual(documents.notes.category,'contract');
  assert.equal(documents.notes.readReview.label,'Reference text read');

  // The shared contract readers on the stored projects give the same terms.
  const load=(projectId:string)=>new RuntimeProjectStore({dataDir:projectDirectory(root,projectId),durable:true}).get(projectId)!;
  const fromPdf=load('R15-TXT-PDF'),fromText=load('R15-TXT-TXT'),fromMarkdown=load('R15-TXT-MD');
  assert.equal(fromText.contractDocuments.length,1,'the text contract is held as a contract reading');
  assert.equal(fromText.contractDocuments[0]!.result.sourceType,'text');
  const pdfRead=readers(fromPdf),textRead=readers(fromText),markdownRead=readers(fromMarkdown);
  assert.deepEqual(pdfRead.terms.map(t=>t.term),['ldCap','ldRate','noticePeriodDays','paymentPeriodDays','retentionPercent'],JSON.stringify(pdfRead.terms));
  assert.deepEqual(textRead,pdfRead,'the .txt contract gives the same terms, completion date, contract value and notice rule as the PDF');
  assert.deepEqual(markdownRead,pdfRead,'the .md contract gives the same terms as the PDF');
  assert.equal(textRead.completion.value,'2032-06-30');
  for(const version of contractTermVersions(fromText))
   assert.ok(version.sourceRefs.every(ref=>ref.startsWith('evidence-document:'+txt.documentId+':')),'each term names the text file as its source: '+version.sourceRefs.join(', '));
  // Nothing is adopted without a decision.
  for(const state of [fromPdf,fromText,fromMarkdown]){
   assert.deepEqual(Object.keys(state.controls.reviewDecisions??{}).filter(key=>/contract/.test(key)),[],'no contract decision is recorded');
   assert.equal(contractValueReview(state).selected,null,'the contract value is not adopted');
   assert.ok(!JSON.stringify(state.controls.contractTimeBasis??{}).includes('user-confirmation:'),'no confirmed contract date');
  }
 }finally{
  await rm(root,{recursive:true,force:true});
 }
});

// T04 end to end with text contracts: the same decisions are offered as for PDFs,
// nothing is adopted until the user decides, and the decision governs the pages.
const T04_MAIN=['Contract Data','Date for Completion: 2031-12-31','Retention percentage: 5%'];
const T04_AMENDMENT=['Contract Amendment No. AM-01','Revised Date for Completion: 2032-03-31','Retention percentage: 10%'];
const xer=(date:string)=>['ERMHDR\t23.12',
 '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tR15\t'+date,
 '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt',
 '%R\t1\t1\tA1\tMain works\t2031-01-01\t2031-12-31\t80\t80','%E'].join('\n');

test('R15 T04 decisions for .txt contracts: the same decisions as for PDF contracts, nothing adopted before the decision',{timeout:600000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'cmeng-r15-txt-decisions-'));
 const gateway=await createProjectGateway(root,{maxWorkers:2});
 await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
 const termRef='user-confirmation:contract-fact:retentionPercent:',completionRef='user-confirmation:contract-fact:contractualCompletion:';
 const offered:Record<string,any>={};
 try{
  for(const kind of ['pdf','txt'] as const){
   const P='R15-T04-'+kind.toUpperCase(),api='/api/projects/'+P;
   await createProject(base,P);
   const body=async(lines:string[])=>kind==='pdf'?await pdf(lines):text(lines);
   const media=kind==='pdf'?'application/pdf':'text/plain';
   const main=await contractUpload(base,P,'Main_Contract.'+kind,media,'main',await body(T04_MAIN));
   assert.equal(main.sourceType,kind==='pdf'?'pdf':'text');
   await contractUpload(base,P,'Contract_Amendment_1.'+kind,media,'amendment',await body(T04_AMENDMENT));
   const schedule=await request(base,api+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current programme.xer','x-upload-intent':'add_update','x-schedule-role':'update','x-schedule-role-confirmed':'1'},body:xer('2031-06-30')});
   assert.equal(schedule.status,201,schedule.text.slice(0,300));
   const pages=[api+'/commercial/modules/contract-particulars-bonds',api+'/schedule/modules/eot-assessment'];
   for(const page of pages){const read=await request(base,page);assert.equal(read.status,200,page);assert.ok(!read.text.includes(termRef)&&!read.text.includes(completionRef),kind+': nothing is decided before a decision: '+page);}
   const workflow=(await request(base,api+'/actions')).body;
   const items=[...workflow.actions,...(workflow.information??[])].filter((a:any)=>String(a.id).startsWith('matter:contract-fact:'));
   offered[kind]=items.map((a:any)=>({id:a.id,category:a.category,options:(a.target?.reviewOptions??[]).map((o:any)=>o.value).sort()})).sort((a:any,b:any)=>a.id.localeCompare(b.id));
   const documents=(await request(base,api+'/evidence/documents')).body.documents.filter((d:any)=>d.category==='contract');
   assert.equal(documents.length,2,kind+': both contract files are stored');
   for(const document of documents)assert.equal(document.authority,'candidate_only',kind+': '+document.sourceFilename+' is not adopted by reading');
   if(kind==='txt'){
    const retention=items.find((a:any)=>a.id==='matter:contract-fact:retentionPercent');
    assert.ok(retention,'the retention decision is offered for the text contracts');
    const decided=await request(base,api+'/actions/confirm-review',{method:'POST',headers:{'content-type':'application/json'},
     body:JSON.stringify({expectedVersion:workflow.projectVersion,actionId:retention.id,sourceFingerprint:retention.reviewFingerprint,choice:'use:10|%'})});
    assert.equal(decided.status,200,'retention decision saved: '+decided.text.slice(0,300));
    const after=await request(base,pages[0]!);
    assert.ok(after.text.includes(termRef),'the decided retention governs the contract particulars page');
   }
  }
  assert.ok(offered.pdf.length>=2,'the PDF contracts offer the retention and completion decisions: '+JSON.stringify(offered.pdf));
  assert.deepEqual(offered.txt,offered.pdf,'the text contracts offer the same decisions with the same choices as the PDF contracts');
 }finally{
  await gateway.close();
  await rm(root,{recursive:true,force:true});
 }
});
