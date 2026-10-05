import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {parsePdfDocument,fragmentedPdfText,type OcrProvider} from '../packages/pdf-document-parser/src';
import {documentReadReview,refreshDeferredPdfRead} from '../packages/runtime-api/src/document-read-review';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

// A rotated public BOQ exposed this class: plentiful Latin characters but
// virtually no words. Input is generic and deliberately contains no project ID.
const broken=Array.from({length:80},(_,i)=>['o','n','m','q','D','--t','a','3'][i%8]).join('\n');
async function pdf(text:string){const d=await PDFDocument.create();const p=d.addPage([595,1600]);p.drawText(text,{x:30,y:1550,size:9,font:await d.embedFont(StandardFonts.Helvetica)});return Buffer.from(await d.save());}
function provider(text:string):OcrProvider{return {name:'independent-fixture',async recognize(){return {text,confidence:0.98,language:'eng',diagnostics:[]};}};}

test('abundant fragmented PDF characters cannot establish readable pages',async()=>{
 const result=await parsePdfDocument(await pdf(broken));
 assert.equal(result.nativePages,0);assert.equal(result.failedPages,1);assert.equal(result.complete,false);
 assert.ok(result.pages[0]!.diagnostics.includes('PDF_NATIVE_TEXT_FRAGMENTED_REQUIRES_OCR'));
});
test('fragmented native layer uses OCR and retains why it was replaced',async()=>{
 const result=await parsePdfDocument(await pdf(broken),{ocrProvider:provider('Bill of Quantities. Roadway excavation quantity 245.00 cubic metres.')});
 assert.equal(result.ocrPages,1);assert.equal(result.complete,true);assert.match(result.pages[0]!.text,/245.00/);
 assert.ok(result.pages[0]!.diagnostics.includes('PDF_NATIVE_TEXT_FRAGMENTED_REQUIRES_OCR'));
});
test('empty or fragmented OCR cannot convert a populated unreadable page to blank/read',async()=>{
 for(const text of ['',broken]){const r=await parsePdfDocument(await pdf(broken),{ocrProvider:provider(text)});assert.equal(r.complete,false);assert.equal(r.failedPages,1);assert.equal(r.blankPages,0);}
});
test('valid technical, Arabic, CJK and sparse text is not rejected by fragmentation heuristic',()=>{
 for(const text of ['A B C 1 2 3',Array(80).fill('Concrete reinforcement quantities and unit rates').join('\n'),Array(50).fill('جدول الكميات كمية الخرسانة والأعمال').join('\n'),Array(70).fill('施工 工程 数量 单位').join('\n')])assert.equal(fragmentedPdfText(text),false);
});
test('legacy native checkpoint is re-read when its retained text is fragmented',async()=>{
 const bytes=await pdf(broken);const old={pageNumber:1,method:'native' as const,text:broken,nativeCharacterCount:160,ocrConfidence:null,aiReview:null,diagnostics:[]};
 const r=await parsePdfDocument(bytes,{checkpoint:{completedPages:[1],persistedPages:[old]},ocrProvider:provider('Recovered specification text with quantities and explicit units.')});
 assert.equal(r.ocrPages,1);assert.equal(r.nativePages,0);assert.equal(r.complete,true);
});
test('legacy complete receipt cannot skip fragmented-page refresh or claim all pages read',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-text-layer-'));try{
 const bytes=await pdf(broken),path=join(dir,'source.pdf'),hash=createHash('sha256').update(bytes).digest('hex');writeFileSync(path,bytes);
 const old={totalPages:1,processedPages:1,nativePages:1,ocrPages:0,blankPages:0,failedPages:0,unresolvedPages:0,coveragePercent:100,complete:true,diagnostics:[],pages:[{pageNumber:1,method:'native' as const,text:broken,nativeCharacterCount:160,ocrConfidence:null,aiReview:null,diagnostics:[]}]};
 const doc={documentId:'source',mediaType:'application/pdf',storedPath:path,sourceHashSha256:hash,basisState:'candidate',fullTextRead:{producerVersion:'full-page-read-v1',sourceHashSha256:hash,completedAt:'2026-01-01',result:old}} as unknown as StoredEvidenceDocument;
 const state={contractDocuments:[]} as unknown as ProjectRuntimeState;
 assert.equal(documentReadReview(doc,state).complete,false);assert.equal(documentReadReview(doc,state).readPageCount,0);
 assert.equal(await refreshDeferredPdfRead(doc,()=>provider('Recovered source rows remain candidate evidence only.')),true);
 assert.equal(doc.fullTextRead!.result.ocrPages,1);assert.equal(doc.basisState,'candidate');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
