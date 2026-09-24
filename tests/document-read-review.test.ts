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
    assert.equal(calls,4);assert.equal(closed,2);assert.equal(doc.basisState,'historical');assert.equal(doc.parserState,'ocr_pending');
    delete doc.fullTextRead;writeFileSync(path,'changed source');
    await assert.rejects(refreshDeferredPdfRead(doc,()=>provider(false)),/SOURCE_HASH_MISMATCH/);
    assert.equal(calls,4);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
