// R14 (doctype): a letter or notice is classified by its content, not its file name.
// Before this fix an Engineer's notice of commencement uploaded as
// 'Engineer_Notice_of_Commencement.pdf' or 'scan_0042.pdf' fell back to the file
// name, was filed as a supporting document and held as historical, so its
// Commencement Date was never read. Only 'Letters_Notices_...pdf' was read.
// Now the shared document reader knows a letter by its notice title or its
// addressee / sender / date / subject header; the file name is a supporting signal only.
// The projects are built through the real upload path (HTTP gateway, real PDF reader).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {identifyEvidenceDocument} from '../packages/runtime-api/src/document-identification';

const COMMENCEMENT='2026-01-15';
const WORKS_COMPLETION='2027-07-09'; // 2026-01-15 + 540 calendar days

async function pdf(lines:string[]){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 const page=doc.addPage([595,842]);
 page.drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
 return new Uint8Array(await doc.save());
}
const CONTRACT=[
 'CONSTRUCTION CONTRACT','Contract Data','Contract currency is SAR.','Accepted Contract Amount: SAR 210,000,000.',
 'The Commencement Date shall be stated in the Engineer\'s Notice.',
 'Time for Completion of the Works: 540 days from the Commencement Date.',
 'The Contractor shall give a Notice of Claim within 28 days.',
];
const NOTICE=['ENGINEER\'S NOTICE OF COMMENCEMENT','Letter Ref: ENG-LET-0001','Date: 01 January 2026','From: The Engineer','To: The Contractor',
 'Subject: Notice of Commencement under Sub-Clause 8.1','The Engineer gives notice that the Commencement Date shall be 15 January 2026.'];
// The same letter without a notice title: known by its letter header alone.
const PLAIN_LETTER=['Our Ref: ENG-LET-0002','Date: 02 January 2026','To: The Contractor','From: The Engineer',
 'Subject: Site access','Please arrange access for the survey team.'];

async function request(base:string,path:string,init?:RequestInit){
 const response=await fetch(base+path,init),text=await response.text();
 let body:any=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
 return {status:response.status,body,text};
}
async function upload(base:string,projectId:string,filename:string,bytes:Uint8Array,contract=false){
 const response=await request(base,'/api/projects/'+encodeURIComponent(projectId)+(contract?'/contract/uploads':'/evidence/uploads'),{method:'POST',
  headers:{'content-type':'application/pdf','x-source-filename-encoded':encodeURIComponent(filename),'x-source-relative-path-encoded':encodeURIComponent(filename),
   ...(contract?{'x-contract-role':'main'}:{'x-upload-intent':'add_update','x-upload-id':projectId+'-'+filename})},body:Buffer.from(bytes)});
 assert.equal(response.status,201,filename+' upload failed: '+response.text.slice(0,500));
}
function milestonesPath(projectId:string){
 const page=moduleRegistry.find(row=>row.key==='milestones')!;
 const api=page.apiKey||page.key;
 return '/api/projects/'+encodeURIComponent(projectId)+(page.area==='management'?'/management/'+encodeURIComponent(api):'/'+page.area+'/modules/'+encodeURIComponent(api));
}

const NAMES=['Engineer_Notice_of_Commencement.pdf','scan_0042.pdf','Letters_Notices_01.pdf'];

test('R14 the shared reader classifies a notice letter by its content under any file name; contracts stay contracts',async()=>{
 const notice=await pdf(NOTICE),plain=await pdf(PLAIN_LETTER),contract=await pdf(CONTRACT);
 for(const name of NAMES){
  const read=(await identifyEvidenceDocument({bytes:notice,sourceFilename:name,sourceRelativePath:name,declaredMediaType:'application/pdf'})).identification;
  assert.equal(read.detectedDocumentType,'letters_notices',name+': '+read.signals.join('; '));
  assert.equal(read.detectedCategory,'correspondence',name);
  assert.notEqual(read.method,'metadata_fallback',name+': read from content, not the file name');
  assert.ok(read.signals.includes('notice title'),name+': notice title signal');
  assert.equal(read.needsReview,false,name+': a clear letter needs no review');
 }
 const header=(await identifyEvidenceDocument({bytes:plain,sourceFilename:'scan_0043.pdf',sourceRelativePath:'scan_0043.pdf',declaredMediaType:'application/pdf'})).identification;
 assert.equal(header.detectedDocumentType,'letters_notices','a letter is known by its addressee, sender, date and subject header');
 assert.ok(header.signals.includes('letter header (addressee, sender, date, subject)'));
 // A contract that mentions a Notice of Claim in its body is still a contract.
 for(const name of ['Main_Contract.pdf','scan_0044.pdf']){
  const read=(await identifyEvidenceDocument({bytes:contract,sourceFilename:name,sourceRelativePath:name,declaredMediaType:'application/pdf'})).identification;
  assert.equal(read.detectedDocumentType,'main_contract',name+': '+read.signals.join('; '));
 }
});

test('R14 through the real upload path: the same notice letter under three file names is classified the same and its Commencement Date reaches the contract time reader',{timeout:600000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'cmeng-r14-doctype-'));
 const gateway=await createProjectGateway(root,{maxWorkers:2});
 await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
 try{
  const notice=await pdf(NOTICE),contract=await pdf(CONTRACT);
  const seen:Array<{name:string;documentType:string;category:string;basisState:string}>=[];
  for(const [index,name] of NAMES.entries()){
   const projectId='R14-DOCTYPE-'+(index+1);
   const created=await request(base,'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId})});
   assert.equal(created.status,201,created.text);
   await upload(base,projectId,'Main_Contract.pdf',contract,true);
   await upload(base,projectId,name,notice);
   const documents=(await request(base,'/api/projects/'+encodeURIComponent(projectId)+'/evidence/documents')).body.documents;
   const letter=documents.find((d:any)=>d.sourceFilename===name);
   assert.ok(letter,name+' is stored');
   seen.push({name,documentType:letter.documentType,category:letter.category,basisState:letter.basisState});
   assert.equal(letter.documentType,'letters_notices',name+' is filed as letters and notices by its content');
   assert.ok(['active','additive'].includes(letter.basisState),name+' is part of the current basis, not held as historical ('+letter.basisState+')');
   const response=await request(base,milestonesPath(projectId));
   assert.equal(response.status,200,response.text.slice(0,300));
   const time=response.body.data.projectFacts.time;
   assert.equal(time.contractualCompletionIso.value,WORKS_COMPLETION,name+': Works date from the notice Commencement Date and the stated period');
   assert.match(time.contractualCompletionIso.basis,new RegExp('Commencement '+COMMENCEMENT+' \\(Engineer\'s notice of commencement\\) \\+ 540 calendar days'),name+': basis label');
  }
  // All three file names give one classification.
  assert.equal(new Set(seen.map(row=>row.documentType+'|'+row.category)).size,1,JSON.stringify(seen));
 }finally{
  await gateway.close();
  await rm(root,{recursive:true,force:true});
 }
});
