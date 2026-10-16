import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import {documentReadReview,refreshDeferredPdfRead} from '../packages/runtime-api/src/document-read-review';
import {evidenceAvailabilityReview} from '../packages/runtime-api/src/evidence-availability-review';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import type {StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
import {parsePdfDocument,type OcrProvider} from '../packages/pdf-document-parser/src';

test('later read receipts supersede upload labels without changing source authority',()=>{
  const store=new RuntimeProjectStore({dataDir:mkdtempSync(join(tmpdir(),'cmeng-read-review-')),durable:false});
  const state=store.getOrCreate('OTHER-PORT-2031');
  const doc={documentId:'health',documentType:'hse_report',sourceHashSha256:'sha',parserState:'identified',basisState:'candidate',identification:{pageCount:2},hseSummary:{producerVersion:'hse-summary-v1',sourceHashSha256:'sha',periodEndIso:'2031-03-31',metrics:{manHours:850,nearMisses:2},sourceRefs:[],diagnostics:[]}} as unknown as StoredEvidenceDocument;
  assert.equal(documentReadReview(doc,state).label,'Report figures read');
  assert.equal(documentReadReview(doc,state).complete,false);
  assert.equal(doc.basisState,'candidate');assert.equal(doc.parserState,'identified');
  doc.hseSummary!.sourceHashSha256='stale';
  assert.equal(documentReadReview(doc,state).label,null);
  doc.correspondenceNarrativeRefresh={producerVersion:'test',sourceHashSha256:'sha',anchorSetHashSha256:'anchors',totalPages:8,nativePages:5,ocrPages:2,ocrFailedPages:1,unresolvedAnchorCount:3,completedAt:'2031-04-01'};
  assert.equal(documentReadReview(doc,state).complete,false);
  assert.match(documentReadReview(doc,state).note!,/7 of 8/);
});

test('an unparsed permit with no retained pages is unread, never implicitly complete',()=>{
  const store=new RuntimeProjectStore({dataDir:mkdtempSync(join(tmpdir(),'cmeng-permit-read-')),durable:false});
  const state=store.getOrCreate('UNRELATED-RAIL');
  state.evidenceDocuments.push({documentId:'permit-rules',documentType:'supporting_document',sourceFilename:'permit conditions.pdf',sourceHashSha256:'sha',parserState:'ocr_pending',basisState:'historical',identification:{pageCount:12}} as unknown as StoredEvidenceDocument);
  assert.equal(evidenceAvailabilityReview(state).find(r=>r.topic==='Permit status')!.state,'present_not_read');
});

test('deferred PDFs finish every page, retain failures, retry and preserve document adoption',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'cmeng-deferred-read-'));
  try{
    const pdf=await PDFDocument.create();pdf.addPage([100,100]);pdf.addPage([100,100]);
    const bytes=await pdf.save(),path=join(directory,'unrelated.pdf');writeFileSync(path,bytes);
    const doc={documentId:'scan',sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),storedPath:path,mediaType:'application/pdf',parserState:'ocr_pending',basisState:'historical',identification:{pageCount:2}} as unknown as StoredEvidenceDocument;
    let calls=0,closed=0;
    const provider=(fail:boolean):OcrProvider=>({name:'test',recognize:async(_image,page)=>{calls++;if(fail&&page===2)throw new Error('unread page');return {text:'Permit conditions require review before work starts.',confidence:0.99,language:'eng',diagnostics:[]};},close:async()=>{closed++;}});
    assert.equal(await refreshDeferredPdfRead(doc,()=>provider(true)),true);
    assert.equal(doc.fullTextRead!.result.failedPages,1);assert.equal(doc.fullTextRead!.result.complete,false);
    assert.equal(await refreshDeferredPdfRead(doc,()=>provider(false)),true);
    assert.equal(doc.fullTextRead!.result.ocrPages,2);assert.equal(doc.fullTextRead!.result.complete,true);
    assert.equal(await refreshDeferredPdfRead(doc,()=>provider(false)),false);
    assert.equal(calls,3);assert.equal(closed,2);assert.equal(doc.basisState,'historical');assert.equal(doc.parserState,'ocr_pending');
    delete doc.fullTextRead;writeFileSync(path,'changed source');
    await assert.rejects(refreshDeferredPdfRead(doc,()=>provider(false)),/SOURCE_HASH_MISMATCH/);
    assert.equal(calls,3);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('saved deferred-page checkpoint resumes after reload and does not repeat completed OCR',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'cmeng-resumed-read-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const pdf=await PDFDocument.create();pdf.addPage([100,100]);pdf.addPage([100,100]);const bytes=await pdf.save();const path=join(directory,'scan.pdf');writeFileSync(path,bytes);
 const doc={documentId:'scan',sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),storedPath:path,mediaType:'application/pdf',parserState:'ocr_pending',basisState:'candidate',identification:{pageCount:2}} as unknown as StoredEvidenceDocument;
 let retained:string|null=null,calls=0;
 const provider:OcrProvider={name:'test',recognize:async(_image,page)=>{calls++;return {text:'Verified retained page '+page+' includes explicit source conditions.',confidence:0.99,language:'eng',diagnostics:[]};}};
 await refreshDeferredPdfRead(doc,()=>provider,undefined,()=>{if(retained===null)retained=JSON.stringify(doc);});
 assert.equal(calls,2);assert.ok(retained);
 const restored=JSON.parse(retained!) as StoredEvidenceDocument;
 const state=new RuntimeProjectStore({dataDir:directory,durable:false}).getOrCreate('RESUME');
 assert.equal(documentReadReview(restored,state).readPageCount,1);assert.equal(documentReadReview(restored,state).complete,false);
 calls=0;await refreshDeferredPdfRead(restored,()=>provider);assert.equal(calls,1);assert.equal(restored.fullTextRead?.result.complete,true);assert.equal(restored.fullTextReadCheckpoint,undefined);assert.equal(restored.basisState,'candidate');
});

test('complete retained physical PDF checkpoints are read, not falsely partial',()=>{
 const store=new RuntimeProjectStore({dataDir:mkdtempSync(join(tmpdir(),'cmeng-checkpoint-review-')),durable:false});
 const state=store.getOrCreate('CHECKPOINT-CLEAN');
 const makePage=(pageNumber:number)=>({pageNumber,method:'ocr',text:'Legible source text '+pageNumber});
 const doc={documentId:'commercial-report',sourceHashSha256:'known-hash',parserState:'identified',basisState:'candidate',fullTextReadCheckpoint:{sourceHashSha256:'known-hash',totalPages:2,pages:[makePage(1),makePage(2)]}} as unknown as StoredEvidenceDocument;
 const result=documentReadReview(doc,state);
 assert.equal(result.state,'read');assert.equal(result.complete,true);assert.equal(result.readPageCount,2);
 assert.equal(doc.basisState,'candidate');
 doc.fullTextReadCheckpoint!.pages.pop();
 assert.equal(documentReadReview(doc,state).state,'partial');
});

test('T04 fully read commercial and programme sources count without adopting either file',()=>{
 const store=new RuntimeProjectStore({durable:false});
 const state=store.getOrCreate('T04-CROSS-DOMAIN-READ');
 const commercial={documentId:'ipc-register',documentType:'payment_certificate_register',
  sourceHashSha256:'commercial-sha',parserState:'parsed',basisState:'candidate'} as unknown as StoredEvidenceDocument;
 const commercialTable={document:{documentId:'ipc-register',sourceHashSha256:'commercial-sha'},
  headers:['certificate no','net certified','currency'],rows:[{cells:{'certificate no':'IPC-01','net certified':'300','currency':'SAR'}}],
  recognition:{recognized:true}} as any;
 const read=documentReadReview(commercial,state,[commercialTable]);
 assert.equal(read.state,'read');
 assert.equal(read.complete,true,'recognized complete commercial rows must not be held as physically unread');
 assert.equal(commercial.basisState,'candidate','readability is not source adoption');
 const secondTable={...commercialTable,headers:['period end'],rows:[{cells:{'period end':'2031-04-30'}}]};
 assert.equal(documentReadReview(commercial,state,[commercialTable,secondTable]).complete,true,
   'two sheets in the same complete file must count as read');
 secondTable.recognition={recognized:false};
 assert.equal(documentReadReview(commercial,state,[commercialTable,secondTable]).complete,false,
   'an unresolved worksheet cannot pass the full-source reading gate');
 const unfinished={...commercial,parserState:'partial'} as StoredEvidenceDocument;
 assert.equal(documentReadReview(unfinished,state,[commercialTable]).complete,false);
 const model={activities:[{activityId:'A1'}],relationships:[],calendars:[{semanticComplete:false}]};
 state.schedules.push({sourceHashSha256:'programme-sha',revision:{revisionId:'rev-xer',model}} as any);
 const programme={documentId:'programme',category:'schedule',documentType:'programme',
  sourceHashSha256:'programme-sha',linkedArtifactId:'rev-xer',parserState:'parsed',basisState:'candidate'} as unknown as StoredEvidenceDocument;
 const scheduleRead=documentReadReview(programme,state);
 assert.equal(scheduleRead.state,'read');
 assert.equal(scheduleRead.complete,true,'valid programme parse is physically complete even with calendar interpretation review');
 assert.equal(programme.basisState,'candidate','reading does not establish programme adoption');
 assert.equal(documentReadReview({...programme,sourceHashSha256:'other-hash'},state).complete,false,
   'mismatched source receipts must never establish programme completion');
});

test('T04 complete full-source PDF reading overrides a stale partial checkpoint, never adopting the document',()=>{
 const project=new RuntimeProjectStore({durable:false}).getOrCreate('T04-STALE-CHECKPOINT');
 const pdf={
   totalPages:2,nativePages:2,ocrPages:0,blankPages:0,failedPages:0,unresolvedPages:0,
   pages:[{pageNumber:1,method:'native',text:'Legible certified report page one with text.'},
          {pageNumber:2,method:'native',text:'Legible certified report page two with text.'}],
 };
 const doc={documentId:'cost-report',mediaType:'application/pdf',parserState:'parsed',basisState:'candidate',
   sourceHashSha256:'retained-source-hash',
   fullTextRead:{sourceHashSha256:'retained-source-hash',result:pdf},
   fullTextReadCheckpoint:{sourceHashSha256:'retained-source-hash',totalPages:2,
     pages:[{pageNumber:1,method:'native',text:'Legible certified report page one with text.'}]},
 } as unknown as StoredEvidenceDocument;
 const before=JSON.stringify(doc);
 const result=documentReadReview(doc,project);
 assert.equal(result.state,'read');
 assert.equal(result.complete,true);
 assert.equal(result.readPageCount,2);
 assert.equal(doc.basisState,'candidate','reading is not adoption');
 assert.equal(JSON.stringify(doc),before,'no source receipt, checkpoint or decision mutated');
 doc.fullTextRead!.sourceHashSha256='other-hash';
 assert.equal(documentReadReview(doc,project).state,'partial','a mismatched source receipt is never accepted');
});

test('T02 PDF physical coverage requires distinct sequential identities and reconciled page counts',()=>{
 const project=new RuntimeProjectStore({durable:false}).getOrCreate('PDF-IDENTITIES-ISOLATED');
 const page=(pageNumber:number)=>({pageNumber,method:'native',text:'Legible retained source page '+pageNumber});
 const pdf={totalPages:2,processedPages:2,nativePages:2,ocrPages:0,blankPages:0,failedPages:0,
   unresolvedPages:0,coveragePercent:100,complete:true,pages:[page(1),page(2)],diagnostics:[]};
 const doc={documentId:'report',sourceHashSha256:'same-hash',basisState:'candidate',
   fullTextRead:{sourceHashSha256:'same-hash',result:pdf}} as unknown as StoredEvidenceDocument;
 const initial=JSON.stringify(doc);
 assert.equal(documentReadReview(doc,project).complete,true);
 for(const altered of [
   {...pdf,pages:[page(1)]},
   {...pdf,pages:[page(1),page(1)]},
   {...pdf,pages:[page(0),page(2)]},
   {...pdf,pages:[page(1),page(3)]},
   {...pdf,pages:[{...page(1),aiReview:{status:'review_required'}},page(2)]},
   {...pdf,nativePages:1},
 ]){
   doc.fullTextRead!.result=altered as any;
   assert.equal(documentReadReview(doc,project).complete,false,
     'Summary counts never certify a missing, duplicate, invalid or unresolved page');
 }
 doc.fullTextRead!.result=pdf as any;
 assert.equal(documentReadReview(doc,project).complete,true);
 assert.equal(JSON.stringify(doc),initial);
 assert.equal(doc.basisState,'candidate','reading must never adopt source');
});

test('T02 retained checkpoint cannot certify duplicate, out-of-range or AI-unresolved page',()=>{
 const project=new RuntimeProjectStore({durable:false}).getOrCreate('CHECKPOINT-IDENTITY');
 const page=(pageNumber:number)=>({pageNumber,method:'native',text:'Legible retained page '+pageNumber});
 const doc={documentId:'pending',sourceHashSha256:'hash',basisState:'candidate',
   fullTextReadCheckpoint:{sourceHashSha256:'hash',totalPages:2,pages:[page(1),page(2)]}} as unknown as StoredEvidenceDocument;
 assert.equal(documentReadReview(doc,project).complete,true);
 for(const numbers of [[1,1],[0,2],[1,3]]){
   doc.fullTextReadCheckpoint!.pages=numbers.map(page) as any;
   assert.equal(documentReadReview(doc,project).complete,false);
 }
 doc.fullTextReadCheckpoint!.pages=[page(1),{...page(2),aiReview:{status:'review_required'}}] as any;
 assert.equal(documentReadReview(doc,project).complete,false);
 assert.equal(doc.basisState,'candidate');
});

test('T02/T03 deferred reading retains unresolved review and candidate authority through restart',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'cmeng-unresolved-physical-'));
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const pdf=await PDFDocument.create();pdf.addPage([100,100]);
 const bytes=await pdf.save();const path=join(directory,'source.pdf');writeFileSync(path,bytes);
 const provider:OcrProvider={name:'recorded-ocr',recognize:async()=>({
   text:'Original invoice evidence states amount 42 and a source review remains outstanding.',
   confidence:0.97,language:'eng',diagnostics:[],
 })};
 const source=await parsePdfDocument(bytes,{ocrProvider:provider,aiVerifier:{
   name:'no-cost-review',review:async()=>({status:'review_required',
     diagnostics:['Certificate is disputed'],proposedText:null,confidence:null}),
 }});
 assert.equal(source.ocrPages,1);assert.equal(source.unresolvedPages,1);assert.equal(source.complete,false);
 const sourceHashSha256=createHash('sha256').update(bytes).digest('hex');
 const doc={documentId:'original-source',sourceHashSha256,storedPath:path,mediaType:'application/pdf',
   parserState:'parsed',basisState:'candidate',
   fullTextRead:{producerVersion:'full-page-read-v1',sourceHashSha256,
     completedAt:'2031-05-01T00:00:00Z',result:source}} as unknown as StoredEvidenceDocument;
 const state=new RuntimeProjectStore({durable:false}).getOrCreate('RESTART-ORIGINAL');
 assert.equal(documentReadReview(doc,state).complete,false);
 const before=source.pages[0]!.text;
 assert.equal(await refreshDeferredPdfRead(doc,()=>undefined),true);
 assert.equal(doc.fullTextRead!.result.pages[0]!.text,before,'original OCR evidence is retained');
 assert.equal(doc.fullTextRead!.result.pages[0]!.aiReview?.status,'review_required');
 assert.equal(doc.fullTextRead!.result.complete,false,'no verifier means no established reading');
 assert.equal(documentReadReview(doc,state).complete,false);
 assert.equal(doc.basisState,'candidate','no formal source adoption');
});


test('T02 PDF source receipts cannot certify absent OCR/native text or content masquerading as blank',()=>{
 const state=new RuntimeProjectStore({durable:false}).getOrCreate('INDEPENDENT-PHYSICAL-READ');
 const page=(pageNumber:number,method:string,text:string)=>({pageNumber,method,text,
   nativeCharacterCount:method==='native'?text.length:0,ocrConfidence:null,aiReview:null,diagnostics:[]});
 const pages=[page(1,'native','Original signed payment certificate records total 425000.'),
   page(2,'ocr','Independent scanned register confirms invoice and date.'),page(3,'blank','')];
 const original={totalPages:3,processedPages:3,nativePages:1,ocrPages:1,blankPages:1,
   failedPages:0,unresolvedPages:0,coveragePercent:100,complete:true,pages,diagnostics:[]};
 const doc={documentId:'physical-verified',sourceHashSha256:'original-physical-hash',
   basisState:'candidate',fullTextRead:{sourceHashSha256:'original-physical-hash',result:original}} as unknown as StoredEvidenceDocument;
 assert.equal(documentReadReview(doc,state).complete,true);
 const corruptions:[number,string][]=[
   [0,''],[0,'  '],[0,'?!!'],[1,''],[1,'---'],[2,'Falsely inserted approval 99999']];
 for(const [index,text] of corruptions){
   const corrupted={...original,pages:pages.map((p,i)=>i===index?{...p,text}:p)};
   doc.fullTextRead!.result=corrupted as any;
   const result=documentReadReview(doc,state);
   assert.equal(result.complete,false,'a plausible saved method cannot replace source evidence');
   assert.equal(result.readPageCount,2);
   assert.equal(result.state,'partial');
   const checkpoint={...doc,fullTextRead:undefined,
     fullTextReadCheckpoint:{sourceHashSha256:doc.sourceHashSha256,totalPages:3,pages:corrupted.pages}} as StoredEvidenceDocument;
   assert.equal(documentReadReview(checkpoint,state).complete,false,'checkpoint uses identical physical criterion');
   assert.equal(documentReadReview(checkpoint,state).readPageCount,2);
 }
 doc.fullTextRead!.result=original as any;
 assert.equal(documentReadReview(doc,state).complete,true);
 assert.equal(doc.basisState,'candidate','source reading cannot adopt certificate');
 assert.equal(pages[0]!.text,'Original signed payment certificate records total 425000.');
});
