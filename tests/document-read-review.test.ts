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
import type {OcrProvider} from '../packages/pdf-document-parser/src';

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
