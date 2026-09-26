import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import type {AddressInfo} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {PDFParse} from 'pdf-parse';
import {TesseractOcrProvider} from '../packages/pdf-document-parser/src/tesseract-provider';
import {parsePdfDocument} from '../packages/pdf-document-parser/src/parser';

async function image(){const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage([600,140]).drawText('CMENG 12345',{x:30,y:65,size:44,font});const bytes=await pdf.save();const p=new PDFParse({data:bytes as any});try{const result=await p.getScreenshot({scale:2,imageBuffer:true,imageDataUrl:false});return result.pages[0]!.data as Uint8Array;}finally{await p.destroy();}}

test('actual model HTTP failure rejects OCR without an uncaught exception; the same provider recovers', {timeout:30000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-ocr-failure-'));let fail=true,requests=0;
 const model=readFileSync(join(dirname(require.resolve('@tesseract.js-data/eng/package.json')),'4.0.0_best_int/eng.traineddata.gz'));
 const server=createServer((_req,res)=>{requests++;res.writeHead(fail?403:200);res.end(fail?'Unavailable':model);});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const provider=new TesseractOcrProvider({languages:['eng'],cachePath:root,langPath:'http://127.0.0.1:'+(server.address() as AddressInfo).port,timeoutMs:10000});
 try{
  const png=await image();await assert.rejects(provider.recognize(png,1),/OCR_READING_FAILED.*403/);
  fail=false;const result=await provider.recognize(png,1);assert.match(result.text,/CMENG\s+12345/);assert.equal(requests,2);
 }finally{await provider.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true});}
});

test('a stalled model request times out and closes its worker; the host remains usable', {timeout:15000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-ocr-timeout-')),server=createServer(()=>{});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const provider=new TesseractOcrProvider({languages:['eng'],cachePath:root,langPath:'http://127.0.0.1:'+(server.address() as AddressInfo).port,timeoutMs:500});
 try{await assert.rejects(provider.recognize(await image(),1),/OCR_INITIALIZATION_TIMEOUT/);}
 finally{await provider.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true});}
});

test('bundled English and Arabic OCR work with an empty cache and malformed images stay inside the reader', {timeout:30000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-ocr-bundled-')),provider=new TesseractOcrProvider({languages:['eng','ara'],cachePath:root,timeoutMs:15000});
 try{
  const png=await image();const result=await provider.recognize(png,1);assert.match(result.text,/CMENG\s+12345/);assert.equal(result.language,'eng+ara');
  await assert.rejects(provider.recognize(Buffer.from('not an image'),2),/OCR_READING_FAILED/);
  assert.match((await provider.recognize(png,3)).text,/CMENG\s+12345/);
 }finally{await provider.close();rmSync(root,{recursive:true,force:true});}
});

test('a scanned PDF records a failed page when the real OCR worker cannot load its model', {timeout:15000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-pdf-ocr-failure-')),server=createServer((_req,res)=>{res.writeHead(403);res.end();});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{
  const pdf=await PDFDocument.create();pdf.addPage([120,100]);
  const result=await parsePdfDocument(await pdf.save(),{ocrProvider:new TesseractOcrProvider({languages:['eng'],cachePath:root,langPath:'http://127.0.0.1:'+(server.address() as AddressInfo).port,timeoutMs:5000})});
  assert.equal(result.complete,false);assert.equal(result.failedPages,1);assert.match(result.pages[0]!.diagnostics.join(' '),/403/);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true});}
});

test('new OCR faults: reset connections and corrupt models stay contained, then queued pages recover with their own results', {timeout:30000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-ocr-new-faults-'));let mode='reset',requests=0;
 const model=readFileSync(join(dirname(require.resolve('@tesseract.js-data/eng/package.json')),'4.0.0_best_int/eng.traineddata.gz'));
 const server=createServer((req,res)=>{requests++;if(mode==='reset'){req.socket.destroy();return;}res.writeHead(200);res.end(mode==='corrupt'?Buffer.from('broken compressed language data'):model);});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const provider=new TesseractOcrProvider({languages:['eng'],cachePath:root,langPath:'http://127.0.0.1:'+(server.address() as AddressInfo).port,timeoutMs:5000});
 try{
  const png=await image();await assert.rejects(provider.recognize(png,11),/OCR_READING_FAILED/);
  mode='corrupt';await assert.rejects(provider.recognize(png,12),/OCR_READING_FAILED/);
  mode='healthy';const [bad,good]=await Promise.allSettled([provider.recognize(Buffer.from('malformed page'),13),provider.recognize(png,14)]);
  assert.equal(bad.status,'rejected');assert.equal(good.status,'fulfilled');if(good.status==='fulfilled')assert.match(good.value.text,/CMENG\s+12345/);
  assert.ok(requests>=3);
 }finally{await provider.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true});}
});
