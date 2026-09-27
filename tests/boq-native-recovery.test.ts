import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PDFDocument} from 'pdf-lib';
import {ingestBoq} from '../packages/boq-ingestion/src';
import {parseNativeBoqText,nativeBoqReportedTotals} from '../packages/boq-pdf-parser/src';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {resolveBoqSource} from '../packages/runtime-api/src/boq-source';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';

const text='Item Description Unit Rate Amount UAE\nDirhams\nPage: 4P/1\nSECTION P - CONVEYING INSTALLATIONS\nA Passenger lift nr 500,000.00 2,000,000.00\nB Provision for testing item Included\nC Service lift nr 300,000.00 600,000.00\nTotal - UAE Dirhams..Carried to Collection\nMarch 2030\n2\n4\n1\nQuantity\nBill No.4\nTower Three';
const summary='GENERAL SUMMARY\nTotal - UAE Dirhams - Exclusive of VAT 2,900,000.00';
test('native text recovers stated BOQ costs without assigning detached quantities or double-counting totals',()=>{
 const rows=parseNativeBoqText(8,text);assert.equal(rows.length,3);assert.equal(rows[0]!.description,'Passenger lift');assert.equal(rows[0]!.rate,500000);assert.equal(rows[0]!.amount,2000000);assert.ok(rows.every(r=>r.quantity===null));assert.equal(rows[1]!.amount,null);assert.equal(rows[0]!.section,'Bill 4 / Tower Three / SECTION P - CONVEYING INSTALLATIONS');
 assert.deepEqual(parseNativeBoqText(1,summary),[]);assert.equal(nativeBoqReportedTotals([{pageNumber:1,method:'native',text:summary}])[0]!.amount,2900000);
 assert.equal(parseNativeBoqText(8,text.replace(/UAE\s+Dirhams/g,'Unknown currency'))[0]!.currency,null);
 assert.equal(nativeBoqReportedTotals([{pageNumber:1,method:'ocr',text:summary}]).length,0);
 const unpriced=text.replace('Total - UAE','D Provide operating manuals item\n2,600,000.00\nTotal - UAE');
 assert.equal(parseNativeBoqText(8,unpriced).length,3,'a bare page total is never attached to an unpriced item above it');
});
test('an actual borderless PDF retains partial BOQ items when ruled-table detection fails',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([700,850]).drawText(text,{x:30,y:800,size:9,lineHeight:15});
 const value=await ingestBoq({projectId:'NATIVE-PDF',bytes:await pdf.save(),verifiedMediaType:'application/pdf',sourceFilename:'same-name.pdf',receivedAt:'2030-01-01'});
 assert.ok(value.canonicalItems.some(r=>r.description==='Passenger lift'&&r.amount===2000000));assert.equal(value.complete,false);
});
test('restored BOQ-only project answers cost questions from its own retained source, with hash/replacement guards and no model call',async t=>{
 const state=runtimeProjects.getOrCreate('BOQ-NATIVE-RESTORE');
 const original=await ingestBoq({projectId:state.projectId,bytes:Buffer.from('Item,Description,Unit,Quantity,Rate,Amount,Currency\n1,Lift,nr,4,500000,2000000,AED'),verifiedMediaType:'text/csv',receivedAt:'2030-01-01'});
 state.boq={...original,canonicalItems:[],sourceFormat:'pdf',complete:false,state:'partial_candidate'};state.boqRevisions=[state.boq];
 const read:any={producerVersion:'full-page-read-v1',sourceHashSha256:original.sourceHashSha256,completedAt:'2030-01-01',result:{totalPages:2,processedPages:2,nativePages:2,ocrPages:0,blankPages:0,failedPages:0,unresolvedPages:0,coveragePercent:100,complete:true,diagnostics:[],pages:[{pageNumber:1,method:'native',text:summary},{pageNumber:2,method:'native',text}]}};
 const doc:any={documentId:'native-boq',documentType:'boq',category:'boq_cost',basisState:'active',sourceHashSha256:original.sourceHashSha256,linkedArtifactId:original.ingestionId,sourceFilename:'programme-looking-name.pdf',fullTextRead:read,textSegments:[],assertions:[],diagnostics:[],identification:{detectedDocumentType:'boq',detectedCategory:'boq_cost',confidence:1}};
 state.evidenceDocuments=[doc];
 const source=resolveBoqSource(state,'');assert.equal(source.boq!.canonicalItems.length,3);assert.equal(state.boq.canonicalItems.length,0,'read projection does not rewrite authority');
 const root=mkdtempSync(join(tmpdir(),'boq-native-'));t.after(()=>rmSync(root,{recursive:true,force:true}));let calls=0;
 const engine=new ProjectAskEngine(new AskStore(root),{plan:async()=>{calls++;throw Error('Paid call');},explain:async()=>{calls++;throw Error('Paid call');}});
 const answer=await engine.ask(state.projectId,{userId:'owner',workspaceId:'w',name:null,title:null,company:null,allowModel:true},{question:'Show Top 20 BOQ cost drivers'});
 assert.equal(calls,0);assert.equal(answer.sections[0]!.tables[0]!.rows[0]!.amount,2000000);assert.match(answer.narrative[0]!.text,/Readable BOQ items: 3/);assert.doesNotMatch(answer.narrative[0]!.text,/Contract completion: Not established/);
 doc.fullTextRead={...read,sourceHashSha256:'wrong'};assert.equal(resolveBoqSource(state,'').boq!.canonicalItems.length,0);
 doc.fullTextRead=read;doc.basisState='superseded';assert.equal(resolveBoqSource(state,'').boq,null);
});
