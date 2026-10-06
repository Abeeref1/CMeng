import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomInt,createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,renameSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import type {AddressInfo} from 'node:net';
import ExcelJS from 'exceljs';
import {ingestBoq} from '../packages/boq-ingestion/src';
import {RuntimeProjectStore,runtimeProjects} from '../packages/runtime-api/src/project-state';
import {boqPageReview,boqPageReviewPendingCount,type BoqPageReviewInput} from '../packages/runtime-api/src/boq-page-review';
import {boqNumericReview} from '../packages/runtime-api/src/boq-numeric-review';
import {resolveBoqSource,suppliedBoqFigures} from '../packages/runtime-api/src/boq-source';
import {assessQuantityMapping} from '../packages/quantity-progress-core/src';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {moduleForProject,invalidateProject} from '../packages/runtime-api/src/project-projections';
import {buildModuleJsonDownload,buildModuleWorkbook} from '../packages/runtime-api/src/module-report';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';

function setup(t:any){const dir=mkdtempSync(join(tmpdir(),'cmeng-pages-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,store:new RuntimeProjectStore({dataDir:dir,durable:true})};}
async function fixture(projectId:string){
 const truth=[randomInt(1,500)/100,0,-randomInt(1,500)/100],pdf=await PDFDocument.create();
 for(let p=0;p<3;p++){
  const page=pdf.addPage([650,500]),rows=[['Description','Quantity','Unit','Amount'],['Work '+(p+1),String(truth[p]),'m3',String(Number((truth[p]!*2).toFixed(2)))]];
  const xs=[30,330,420,490,620];for(let i=0;i<3;i++)page.drawLine({start:{x:30,y:430-i*40},end:{x:620,y:430-i*40},thickness:1});for(const x of xs)page.drawLine({start:{x,y:430},end:{x,y:350},thickness:1});
  rows.forEach((row,i)=>row.forEach((v,j)=>page.drawText(v,{x:xs[j]!+4,y:406-i*40,size:10})));
 }
 const bytes=await pdf.save(),boq=await ingestBoq({projectId,bytes,verifiedMediaType:'application/pdf',receivedAt:'2026-10-06',sourceFilename:'Original.pdf'});
 assert.equal(boq.canonicalItems.length,3,'The separately generated source has three source items');
 // Deliberate extraction faults test the correction workflow, not OCR recognition.
 // Page 2 has no output at all; pages 1 and 3 carry incorrect observed values.
 boq.canonicalItems=boq.canonicalItems.filter((_,i)=>i!==1).map(i=>({...i,quantity:null,rate:null,amount:null,sourceNumericReadings:{quantity:999,rate:2,amount:1998},status:'unresolved' as const,diagnostics:['BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED']}));
 boq.sourcePageCoverage={totalPages:3,unresolvedPages:[1,2,3],automaticCoveragePercent:0};boq.complete=false;boq.coveragePercent=0;boq.state='partial_candidate';
 return {boq,bytes,truth};
}
function input(store:RuntimeProjectStore,id:string,pageNumber:number):BoqPageReviewInput{
 const source=boqPageReview(store.getOrCreate(id)).sources[0]!,page=source.pages.find(p=>p.page===pageNumber)!;
 return {requestId:randomUUID(),reviewToken:page.reviewToken,ingestionId:source.ingestionId,sourceHash:source.sourceHash,revisionId:source.revisionId,page:pageNumber,action:'confirm',reviewedSource:true,items:structuredClone(page.items),note:''};
}
function correct(i:BoqPageReviewInput,q:number){
 if(!i.items.length)i.items.push({id:randomUUID(),origins:[],kind:'item',itemNumber:null,section:null,description:'Work '+i.page,unit:'m3',currency:null,values:{quantity:q,rate:2,amount:Number((q*2).toFixed(2))},note:''});
 else i.items[0]!.values={quantity:q,rate:2,amount:Number((q*2).toFixed(2))};return i;
}

test('ten fresh source projects recover a wholly missing page, preserve original counts, and survive restart',async t=>{
 const {dir,store}=setup(t),receipts=[];
 for(let n=0;n<10;n++){
  const id='PAGE-'+randomUUID(),f=await fixture(id);store.attachBoq(f.boq,f.bytes,'Original.pdf');const state=store.getOrCreate(id),original=JSON.stringify(state.boqRevisions);
  assert.equal(boqPageReview(state).sources[0]!.pages[1]!.items.length,0);
  for(let page=1;page<=3;page++){
   const request=correct(input(store,id,page),f.truth[page-1]!);store.confirmBoqPage(id,request);
   const version=state.version;assert.equal(store.confirmBoqPage(id,request).duplicate,true);assert.equal(state.version,version);
  }
  const effective=resolveBoqSource(state,'S').boq!;
  assert.equal(effective.complete,true);assert.equal(effective.coveragePercent,0,'The automatic reading metric never becomes a human-corrected accuracy claim');
  assert.deepEqual(effective.sourceReview,{automaticItemCount:2,addedItemCount:1,reviewedItemCount:3,confirmedPages:[1,2,3],pendingPages:[],coveragePercent:100});
  assert.deepEqual(effective.canonicalItems.map(i=>i.quantity),f.truth);assert.equal(boqNumericReview(state).pendingCount,0);
  assert.equal(boqPageReview(state).pendingPageCount,0);assert.equal(JSON.stringify(state.boqRevisions),original);
  assert.equal(createHash('sha256').update(readFileSync(state.evidenceDocuments[0]!.storedPath)).digest('hex'),f.boq.sourceHashSha256);
  assert.equal(effective.authority,'candidate_only');
  const restored=new RuntimeProjectStore({dataDir:dir,durable:true}).getOrCreate(id);assert.deepEqual(resolveBoqSource(restored,'S').boq!.canonicalItems.map(i=>i.quantity),f.truth);assert.equal(boqPageReview(restored).pendingPageCount,0);
  receipts.push({projectId:id,sourceHash:f.boq.sourceHashSha256,truth:f.truth});
 }
 console.log('BOQ_PAGE_FRESH_COHORT='+JSON.stringify(receipts));
});

test('split/combine preserve ordering and source history, with arithmetic and complete-origin checks',async t=>{
 const {store}=setup(t),id='SPLIT-'+randomUUID(),f=await fixture(id);store.attachBoq(f.boq,f.bytes,'Original.pdf');
 let i=correct(input(store,id,1),4),first=i.items[0]!;first.values={quantity:2,rate:2,amount:4};
 i.items.push({...structuredClone(first),id:'second',values:{quantity:2,rate:2,amount:4}});
 store.confirmBoqPage(id,i);let effective=resolveBoqSource(store.getOrCreate(id),'S').boq!;
 assert.equal(new Set(effective.canonicalItems.map(x=>x.itemId)).size,effective.canonicalItems.length,'Split rows with identical descriptions still have unique identities');
 assert.deepEqual(effective.canonicalItems.slice(0,2).map(x=>x.quantity),[2,2]);
 const reopen={...input(store,id,1),action:'reopen' as const};store.confirmBoqPage(id,reopen);
 i=input(store,id,1);i.items=[{...i.items[0]!,id:'combined',origins:[...new Set(i.items.flatMap(x=>x.origins))],values:{quantity:4,rate:2,amount:8}}];store.confirmBoqPage(id,i);
 assert.equal(resolveBoqSource(store.getOrCreate(id),'S').boq!.canonicalItems[0]!.quantity,4);
 assert.equal(store.getOrCreate(id).boqPageReviews!.length,3,'Confirmation, reopen and correction history remain intact');
});

test('page confirmation cannot invent completeness through missing origins, foreign items, stale tokens or invalid amounts',async t=>{
 const {store}=setup(t),id='GUARD-'+randomUUID(),f=await fixture(id);store.attachBoq(f.boq,f.bytes,'Original.pdf');const state=store.getOrCreate(id),good=correct(input(store,id,1),3),version=state.version;
 const cases=[{items:[]},{reviewedSource:false},{sourceHash:'wrong'},{revisionId:'wrong'},{reviewToken:'wrong'},
 {items:[{...good.items[0]!,origins:['other-page']}]},{items:[{...good.items[0]!,values:{quantity:3,rate:2,amount:600}}]}];
 for(const patch of cases)assert.throws(()=>store.confirmBoqPage(id,{...good,...patch} as any));
 assert.equal(state.version,version);assert.equal(state.boqPageReviews,undefined);
 store.confirmBoqPage(id,good);assert.throws(()=>store.confirmBoqPage(id,{...good,requestId:randomUUID()}),/changed/);
 assert.throws(()=>store.confirmBoqPage(id,{...good,note:'different'}),/different values/);
 const changed=structuredClone(state);changed.boq!.evidenceReceipt.revisionId+='-changed';changed.boqRevisions.forEach(b=>b.evidenceReceipt.revisionId+='-changed');
 assert.equal(boqPageReview(changed).pendingPageCount,3);assert.equal(resolveBoqSource(changed,'S').boq!.canonicalItems[0]!.quantity,null);
 const foreign=await fixture('FOREIGN-'+randomUUID());store.attachBoq(foreign.boq,foreign.bytes,'Original.pdf');const foreignState=store.getOrCreate(foreign.boq.projectId);foreignState.boqPageReviews=state.boqPageReviews!;
 assert.equal(boqPageReview(foreignState).pendingPageCount,3);
});

test('reopening withdraws completeness while retaining a correctable draft; missing quantities never become zero',async t=>{
 const {store}=setup(t),id='REOPEN-'+randomUUID(),f=await fixture(id);store.attachBoq(f.boq,f.bytes,'Original.pdf');
 for(let page=1;page<=3;page++)store.confirmBoqPage(id,correct(input(store,id,page),f.truth[page-1]!));
 const state=store.getOrCreate(id);store.confirmBoqPage(id,{...input(store,id,2),action:'reopen'});
 assert.equal(resolveBoqSource(state,'S').boq!.complete,false);assert.equal(boqPageReview(state).sources[0]!.pages[1]!.items[0]!.values.quantity,0);
 assert.equal(resolveBoqSource(state,'S').boq!.sourceReview!.coveragePercent,66.6667);
 let i=input(store,id,2);i.items[0]!.values={quantity:null,rate:null,amount:null};i.items[0]!.note='Quantity absent in source';store.confirmBoqPage(id,i);
 const b=resolveBoqSource(state,'S').boq!;assert.equal(b.sourceReview!.coveragePercent,100);assert.equal(b.complete,false);assert.equal(b.canonicalItems[1]!.quantity,null);
 const model=resolveBoqSource(state,'S').quantities!;assert.equal(assessQuantityMapping(model).complete,false);
});

test('a failed durable page save rolls back and can be retried with the same request',async t=>{
 const {store,dir}=setup(t),id='SAVE-PAGE-'+randomUUID(),f=await fixture(id);store.attachBoq(f.boq,f.bytes,'Original.pdf');const i=correct(input(store,id,1),f.truth[0]!),path=join(dir,'cmeng-project-state.json'),backup=path+'.bak';
 renameSync(path,backup);mkdirSync(path);assert.throws(()=>store.confirmBoqPage(id,i),/save could not be confirmed/);rmSync(path,{recursive:true});renameSync(backup,path);store.restoreSavedPosition();
 assert.equal(boqPageReview(store.getOrCreate(id)).pendingPageCount,3);assert.equal(store.confirmBoqPage(id,i).pendingPageCount,2);
});

test('a confirmed page cannot make the remaining source population fully mapped',async t=>{
 const {store}=setup(t),id='POP-'+randomUUID(),f=await fixture(id);store.attachBoq(f.boq,f.bytes,'Original.pdf');
 store.confirmBoqPage(id,correct(input(store,id,1),3));store.confirmBoqPage(id,correct(input(store,id,3),4));
 const model=resolveBoqSource(store.getOrCreate(id),'S').quantities!;
 model.allocations=model.items.map((i,n)=>({allocationId:'A'+n,quantityItemId:i.quantityItemId,activityId:'ACT',allocatedQuantity:i.contractQuantity!,sourceRefs:[]}));
 assert.equal(assessQuantityMapping(model).complete,false,'The entirely omitted middle page still prevents a complete scope claim');
});

test('50,000 items across 1,000 pages remain reviewable without losing empty pages or population counts',{timeout:15000},async t=>{
 const {store}=setup(t),id='PAGE-SCALE-'+randomUUID(),f=await fixture(id);store.attachBoq(f.boq,f.bytes,'Original.pdf');
 const state=store.getOrCreate(id),boq=state.boq!,prototype=boq.canonicalItems[0]!;
 // Generated metadata workload only; this does not certify the three-page fixture as a 1,000-page source.
 boq.canonicalItems=Array.from({length:50000},(_,n)=>({...prototype,itemId:'SCALE-'+n,sourceRefs:['pdf:page:'+(Math.floor(n/50)+1)+':row:'+n]}));
 boq.sourcePageCoverage={totalPages:1001,unresolvedPages:Array.from({length:1001},(_,n)=>n+1),automaticCoveragePercent:0};
 state.boqRevisions=[boq];
 assert.equal(boqPageReviewPendingCount(state),1001);
 const view=boqPageReview(state);assert.equal(view.sources[0]!.pages.length,1001);
 assert.equal(view.sources[0]!.pages.flatMap(p=>p.items).length,50000);
 assert.equal(view.sources[0]!.pages[1000]!.items.length,0);
 assert.equal(view.pendingPageCount,1001);
});

test('HTTP correction reaches deterministic Ask, JSON and Excel with unchanged original bytes',async t=>{
 const {dir}=setup(t),id='HTTP-PAGE-'+randomUUID(),f=await fixture(id);runtimeProjects.attachBoq(f.boq,f.bytes,'Original.pdf');
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/projects/'+id;
 for(let page=1;page<=3;page++){
  const i=correct(input(runtimeProjects,id,page),f.truth[page-1]!);const r=await fetch(base+'/boq/page-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(i)});assert.equal(r.status,200);
 }
 const view=await (await fetch(base+'/boq/page-review')).json() as any;assert.equal(view.pendingPageCount,0);
 const state=runtimeProjects.getOrCreate(id),effective=resolveBoqSource(state,'S').boq!;assert.equal(suppliedBoqFigures(effective,null).sourcePopulationComplete,true);
 const engine=new ProjectAskEngine(new AskStore(dir),{plan:async()=>{throw Error('No paid AI');},explain:async()=>{throw Error('No paid AI');}});
 const answer=await engine.ask(id,{userId:'test',workspaceId:'test',name:null,title:null,company:null,allowModel:false},{question:'Show BOQ items and costs'});
 const rows=answer.sections.flatMap(s=>s.tables).flatMap(t=>t.rows).filter(r=>typeof r.description==='string'&&r.description.startsWith('Work '));assert.deepEqual(rows.slice(0,3).map(r=>r.quantity),f.truth);
 invalidateProject(id);const module=moduleForProject(id,'challenge-contract'),json=JSON.parse(buildModuleJsonDownload(id,'challenge-contract',module).toString());assert.deepEqual(json.result.data.suppliedBoq.rows.map((r:any)=>r.quantity),f.truth);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await buildModuleWorkbook(id,'challenge-contract',module) as any);const sheet=book.worksheets.find(s=>(s.getRow(1).values as any[]).includes('numericConfirmation.decisionId'))!;assert.ok(sheet);const col=(sheet.getRow(1).values as any[]).indexOf('quantity');assert.deepEqual(f.truth.map((_,i)=>sheet.getRow(i+2).getCell(col).value),f.truth);
 const original=await fetch(base+'/boq/numeric-review/source/'+f.boq.ingestionId);assert.equal(createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex'),f.boq.sourceHashSha256);
});
