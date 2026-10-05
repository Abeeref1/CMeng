import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {PDFDocument} from 'pdf-lib';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {parseBoqPdf} from '../packages/boq-pdf-parser/src';
import {TesseractOcrProvider,type OcrProvider} from '../packages/pdf-document-parser/src';
import {refreshDeferredPdfBoq} from '../packages/runtime-api/src/boq-pdf-refresh';
import {resolveBoqSource,quantityModelFromBoq,suppliedBoqFigures} from '../packages/runtime-api/src/boq-source';
import {ingestBoq} from '../packages/boq-ingestion/src';
import {assessQuantityMapping} from '../packages/quantity-progress-core/src';
import {documentClassificationForReview} from '../packages/runtime-api/src/document-identification';
import type {StoredEvidenceDocument,ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

const fixtureRoot=resolve(process.cwd(),'tests/fixtures/boq-scanned-regressions');
const manifest=JSON.parse(readFileSync(join(fixtureRoot,'sources.json'),'utf8')) as {filename:string;fixtureSha256:string}[];
function original(name:string){const bytes=readFileSync(join(fixtureRoot,name));assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.find(r=>r.filename===name)!.fixtureSha256);return bytes;}
function reader(){return new TesseractOcrProvider({languages:'eng',cachePath:join(tmpdir(),'cmeng-raster-regression-ocr')});}

// Independently specified visible source quantities. These three source pages
// are known regressions, not fresh or independently accepted project cohorts.
const known=[
 {file:'building-page-2.pdf',rows:[['Project Billboard/Signboard',1],['Occupational Safety',5],['Temporary Fence',57],['Scaffolding',325],['Clearing and Grubbing',210],['Sanitary/Plumbing Fixtures',7],['Concrete/Masonry Structure',27],['Doors and Windows',26],['Tiles / Floor Topping',184],['Removal of Ceiling',138],['Roofing Sheets',151]] as [string,number][]},
 {file:'flood-page-1.pdf',rows:[['Project Billboard',1],['Occupational Safety',4],['0.23m thick',2331],['0.10m thick',1480],['Curb & Gutter',740],['Roadway Excavation',245],['Hard Rock',3351],['Lean Concrete',11]] as [string,number][]},
 {file:'electrical-page-2.pdf',rows:[['Provision of Field Office',3],['Layout and Staking',126],['Project Billboard',1],['Occupational Safety',3],['Temporary Enclosure',89],['Scaffolding',55],['Removal of Tent Framing',472],['Structure Excavation (Solid Rock)',7],['Embankment',6],['Gravel Fill',5],['Soil Poisoning',5]] as [string,number][]},
];
for(const source of known)test('offline BOQ regression retains source quantities: '+source.file,{timeout:180000},async()=>{
 const progress:{page:number;total:number;phase:string}[]=[];
 const result=await parseBoqPdf(original(source.file),{ocrProvider:reader(),onProgress:(page,total,phase)=>progress.push({page,total,phase})});
 assert.ok(progress.some(p=>p.phase==='page_read'));assert.ok(progress.filter(p=>p.phase==='table_read').length>source.rows.length,'Actual cell reading must continue to publish progress after page OCR');
 assert.ok(progress.every(p=>p.page===1&&p.total===1));
 for(const [description,quantity] of [...source.rows,['Mobilization',1],['Demobilization',1]] as [string,number][]){const rows=result.items.filter(r=>r.description.includes(description));assert.equal(rows.length,1,description+' must have one physical source row');assert.equal(rows[0]!.quantity,quantity,description);assert.ok(rows[0]!.rasterEvidence?.cells.quantity?.length);assert.equal(rows[0]!.rate,null);assert.equal(rows[0]!.amount,null);}
 assert.equal(result.complete,false,'Partial table coverage cannot establish a fully reconciled BOQ');
 assert.ok(result.diagnostics.includes('BOQ_RASTER_PAGE_COVERAGE_REVIEW_REQUIRED:1'));
 assert.ok(!result.items.some(row=>row.unit==='sa.m.'),'A misread unknown unit must not be promoted');
 assert.equal(result.items.filter(row=>row.quantity!==null).length,source.file==='flood-page-1.pdf'?10:13,'No extra numeric row may be fabricated from section shading or blank cells');
 assert.ok(result.items.every(row=>row.rate===null&&row.amount===null),'These source pages are unpriced; blank price cells remain unknown');
});

async function synthetic(rotation=0,shuffle=false){
 const c=createCanvas(1800,1150),ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';ctx.font='bold 30px Arial';ctx.fillText('BILL OF QUANTITIES',80,100);
 const columns=shuffle?['Quantity','Item code','Unit','Description']:['Item code','Description','Quantity','Unit'];
 const widths=shuffle?[300,260,250,830]:[260,830,300,250],xs=[80];for(const w of widths)xs.push(xs.at(-1)!+w);
 const ys=[180,280,440,600,760,920];ctx.lineWidth=3;
 for(const x of xs){ctx.beginPath();ctx.moveTo(x,ys[0]!);ctx.lineTo(x,ys.at(-1)!);ctx.stroke();}
 for(const y of ys){ctx.beginPath();ctx.moveTo(xs[0]!,y);ctx.lineTo(xs.at(-1)!,y);ctx.stroke();}
 columns.forEach((h,i)=>ctx.fillText(h,xs[i]!+18,242));ctx.font='30px Arial';
 const data=[{description:'Concrete foundations',quantity:'125.50',unit:'m3',id:'101'},{description:'Temporary access',quantity:'0.00',unit:'month',id:'102'},{description:'Safety management',quantity:'5.00',unit:'month',id:'103'},{description:'Formwork preparation',quantity:'42.25',unit:'m2',id:'104'}];
 for(let row=0;row<data.length;row++){
  const d=data[row]!,top=ys[row+1]!;
  columns.forEach((h,i)=>{const value=h==='Quantity'?d.quantity:h==='Unit'?d.unit:h==='Item code'?d.id:d.description;ctx.fillText(value,xs[i]!+18,top+54);
   if(h==='Quantity'||h==='Unit'){ctx.beginPath();ctx.moveTo(xs[i]!,top+80);ctx.lineTo(xs[i+1]!,top+80);ctx.stroke();}
  });
 }
 const quarter=rotation===90||rotation===270,out=createCanvas(quarter?c.height:c.width,quarter?c.width:c.height),oc=out.getContext('2d');oc.translate(out.width/2,out.height/2);oc.rotate(rotation*Math.PI/180);oc.drawImage(c,-c.width/2,-c.height/2);
 const pdf=await PDFDocument.create(),png=await pdf.embedPng(await out.encode('png'));pdf.addPage([out.width/2,out.height/2]).drawImage(png,{x:0,y:0,width:out.width/2,height:out.height/2});return Buffer.from(await pdf.save());
}

test('offline table reading handles rotated shuffled columns and an explicit zero without paid AI',{timeout:180000},async()=>{
 const result=await parseBoqPdf(await synthetic(90,true),{ocrProvider:reader()});
 for(const [description,expected] of [['Concrete foundations',125.5],['Temporary access',0],['Safety management',5],['Formwork preparation',42.25]] as const){
  const item=result.items.find(row=>row.description===description);assert.ok(item,description);assert.equal(item.quantity,expected);assert.equal(item.rate,null);assert.equal(item.amount,null);assert.equal(item.rasterEvidence?.rotation,270);
 }
});

test('conflicting numeric rereads stay withheld and both source readings remain available',{timeout:180000},async()=>{
 const base=reader();const provider:OcrProvider={name:'conflict-injection',async recognize(image,page,options){const r=await base.recognize(image,page,options);return options?.segmentation==='line'&&r.text.trim()==='125.50'?{...r,text:'125.60'}:r;},close:()=>base.close()};
 const result=await parseBoqPdf(await synthetic(),{ocrProvider:provider});const item=result.items.find(row=>row.description==='Concrete foundations');assert.ok(item);assert.equal(item.quantity,null);assert.equal(item.status,'unresolved');assert.ok(item.diagnostics.includes('BOQ_RASTER_QUANTITY_REVIEW_REQUIRED'));assert.equal(item.rasterEvidence?.cells.quantity?.find(c=>c.text.trim())?.confirmation?.text,'125.60');
});

test('original decimal-loss source cannot expose 3.00 as 300 in quantities or mapping',{timeout:180000},async()=>{
 const bytes=original('building-page-6.pdf');
 const result=await ingestBoq({projectId:'decimal-loss-regression',bytes,verifiedMediaType:'application/pdf',receivedAt:'2026-10-05T00:00:00Z'}, {pdf:{ocrProvider:reader()}});
 const item=result.canonicalItems.find(row=>row.description==='Painting Works, Steel (Color: Paved Path)');assert.ok(item);
 // The original visible source says 3.00. Conflicting OCR interpretations must
 // remain unknown until resolved against the source; this is not a 300 quantity.
 assert.equal(item.quantity,null);assert.equal(item.status,'unresolved');
 assert.ok(item.diagnostics.includes('BOQ_RASTER_QUANTITY_REVIEW_REQUIRED'));
 const cell=item.sourceCellEvidence?.cells.quantity?.find(c=>c.text.trim());assert.ok(cell);
 const readings=[cell,cell.confirmation,...(cell.additionalReadings??[])].filter(r=>r);
 assert.ok(readings.some(r=>r!.text.trim()==='3.00'));
 assert.ok(readings.some(r=>r!.text.trim()==='300'));
 assert.equal(suppliedBoqFigures(result,null).rows.find(row=>row.itemId===item.itemId)!.quantity,null);
 const model=quantityModelFromBoq(result,'no-schedule',null),target=model.items.find(row=>row.quantityItemId===item.itemId)!;
 assert.equal(target.contractQuantity,null);
 const mapping=assessQuantityMapping({...model,items:[target],allocations:[{allocationId:'adversarial-allocation',quantityItemId:item.itemId,activityId:'painting',allocatedQuantity:300,sourceRefs:[]}]});
 assert.equal(mapping.knownQuantityItemCount,0);assert.equal(mapping.mappedQuantity,0);assert.equal(mapping.complete,false);
});

test('lower-confidence numeric disagreement cannot be discarded to promote a quantity',{timeout:180000},async()=>{
 const base=reader();const provider:OcrProvider={name:'low-confidence-conflict',async recognize(image,page,options){const r=await base.recognize(image,page,options);return options?.segmentation==='line'&&r.text.trim()==='125.50'?{...r,text:'12550',confidence:.70}:r;},close:()=>base.close()};
 const result=await parseBoqPdf(await synthetic(),{ocrProvider:provider});const item=result.items.find(row=>row.description==='Concrete foundations');assert.ok(item);assert.equal(item.quantity,null);assert.equal(item.status,'unresolved');
});

test('conflicting units and item identifiers stay unknown without hiding separately readable quantities',{timeout:180000},async()=>{
 const base=reader();const provider:OcrProvider={name:'unit-and-code-conflict',async recognize(image,page,options){const r=await base.recognize(image,page,options);return options?.segmentation==='line'&&['m3','101'].includes(r.text.trim())?{...r,text:r.text.trim()==='m3'?'m2':'105',confidence:.99}:r;},close:()=>base.close()};
 const result=await parseBoqPdf(await synthetic(),{ocrProvider:provider});const item=result.items.find(row=>row.description==='Concrete foundations');assert.ok(item);
 assert.equal(item.quantity,125.5);assert.equal(item.unit,null);assert.equal(item.itemNumber,null);assert.equal(item.status,'unresolved');
 assert.ok(item.diagnostics.includes('BOQ_RASTER_UNIT_REVIEW_REQUIRED'));assert.ok(item.diagnostics.includes('BOQ_RASTER_ITEM_NUMBER_REVIEW_REQUIRED'));
});

test('restored misclassified BOQ exposes candidate rows without changing source identity or adoption',{timeout:180000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-boq-refresh-'));try{
  const bytes=original('flood-page-1.pdf'),path=join(dir,'source.pdf'),hash=createHash('sha256').update(bytes).digest('hex');writeFileSync(path,bytes);
  const doc={documentId:'retained-source',documentType:'supporting_document',category:'general',sourceFilename:'Bill of quantities.pdf',mediaType:'application/pdf',storedPath:path,sourceHashSha256:hash,uploadedAt:'2026-01-01T00:00:00Z',linkedArtifactId:null,basisState:'active',authority:'candidate_only',parserState:'identified',familyKey:'general:supporting',identification:{method:'metadata_fallback',detectedTitle:null},assertions:[],diagnostics:[]} as unknown as StoredEvidenceDocument;
  const state={projectId:'restored-raster',evidenceDocuments:[doc],boq:null,boqRevisions:[],quantities:null,activeEvidenceBasis:{'general:supporting':{activeDocumentId:doc.documentId}}} as unknown as ProjectRuntimeState;
  const before=JSON.stringify(state.activeEvidenceBasis);assert.equal(await refreshDeferredPdfBoq(doc,state,reader),true);
  assert.equal(doc.documentType,'supporting_document');assert.equal(doc.basisState,'active');assert.equal(doc.linkedArtifactId,null);assert.equal(doc.sourceHashSha256,hash);assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash);assert.equal(JSON.stringify(state.activeEvidenceBasis),before);
  assert.equal(documentClassificationForReview(doc).documentType,'boq');assert.equal(documentClassificationForReview(doc).reviewRequired,true);
  const selected=resolveBoqSource(state,'');assert.equal(selected.selection.state,'candidate');assert.equal(selected.selection.adoptedSource,false);assert.equal(selected.boq!.canonicalItems.find(row=>row.description==='Roadway Excavation')!.quantity,245);assert.equal(state.boq,null);
  assert.equal(await refreshDeferredPdfBoq(doc,state,()=>{throw Error('Unchanged receipt must not rerun OCR');}),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('legacy BOQ without a source hash cannot gain a reading receipt or call OCR',async()=>{
 const doc={documentType:'boq',mediaType:'application/pdf',sourceFilename:'unknown.pdf',storedPath:'/must-not-be-read'} as unknown as StoredEvidenceDocument;
 const state={projectId:'missing-hash',evidenceDocuments:[doc],boq:null,boqRevisions:[]} as unknown as ProjectRuntimeState;
 await assert.rejects(refreshDeferredPdfBoq(doc,state,()=>{throw Error('Unverified source must not start OCR');}),/BOQ_REFRESH_SOURCE_HASH_MISSING/);
 assert.equal(doc.boqTableRead,undefined);assert.equal(state.boq,null);assert.equal(state.boqRevisions.length,0);
});
