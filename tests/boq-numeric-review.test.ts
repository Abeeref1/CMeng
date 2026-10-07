import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomInt,createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,renameSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {createCanvas} from '@napi-rs/canvas';
import {PDFDocument} from 'pdf-lib';
import ExcelJS from 'exceljs';
import {ingestBoq,quarantineUnconfirmedBoqNumerics} from '../packages/boq-ingestion/src';
import {RuntimeProjectStore,runtimeProjects} from '../packages/runtime-api/src/project-state';
import {applyBoqNumericReviews,boqNumericReview,type BoqNumericReviewInput} from '../packages/runtime-api/src/boq-numeric-review';
import {resolveBoqSource,suppliedBoqFigures} from '../packages/runtime-api/src/boq-source';
import {projectActions} from '../packages/runtime-api/src/project-actions';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';
import {moduleForProject,invalidateProject} from '../packages/runtime-api/src/project-projections';
import {buildModuleJsonDownload,buildModuleWorkbook} from '../packages/runtime-api/src/module-report';
import {assessQuantityMapping} from '../packages/quantity-progress-core/src';
import {buildQuantityScurveProjection} from '../packages/quantity-scurve/src';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

async function scan(projectId:string,truth=[3,4,0,12.75]){
 const canvas=createCanvas(1000,300),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,300);ctx.fillStyle='black';ctx.font='18px Arial';
 const header=['Item','Description','Unit','Qty','Rate','Amount','Currency'];
 const trueRows=truth.map((q,i)=>[String(i+1),'Scope '+(i+1),'m2',q.toFixed(2),'4',(q*4).toFixed(2),'SAR']);
 [header,...trueRows].forEach((row,i)=>ctx.fillText(row.join(' | '),20,28+i*36));
 const pdf=await PDFDocument.create(),image=await pdf.embedPng(canvas.toBuffer('image/png'));pdf.addPage([500,150]).drawImage(image,{x:0,y:0,width:500,height:150});
 const bytes=Buffer.from(await pdf.save());canvas.width=1;canvas.height=1;
 // Inject deliberately wrong, arithmetically balanced OCR. This tests the review
 // workflow, not OCR accuracy. The PDF pixels and truth values are independent.
 const rows=[header,...truth.map((q,i)=>[String(i+1),'Scope '+(i+1),'m2',String(q*100),'4',String(q*400),'SAR'])],text=rows.map(r=>r.join(' | ')).join('\n');
 const boq=await ingestBoq({projectId,bytes,verifiedMediaType:'application/pdf',sourceFilename:'Source.pdf',receivedAt:'2026-10-05'}, {pdf:{ocrProvider:{name:'deliberate-decimal-error',recognize:async()=>({text,confidence:.999,language:'eng',diagnostics:[]})},aiTableExtractor:{name:'observed-span-test',extract:async()=>({confidence:.999,diagnostics:[],rows:rows.map(r=>r.map(value=>({value,sourceStart:text.indexOf(value),sourceEnd:text.indexOf(value)+value.length,sourceText:value})))})}}});
 return {boq,bytes,truth};
}
function inputFor(state:ReturnType<RuntimeProjectStore['getOrCreate']>,truth:number[]):BoqNumericReviewInput{
 const review=boqNumericReview(state),source=review.sources[0]!;
 return {batchId:randomUUID(),reviewToken:review.reviewToken,reviewedSource:true,items:source.rows.map((r,i)=>({ingestionId:source.ingestionId,sourceHash:source.sourceHash,itemId:r.itemId,fingerprint:r.fingerprint,values:{quantity:truth[i]!,rate:4,amount:truth[i]!*4}}))};
}
function newStore(t:any){const dir=mkdtempSync(join(tmpdir(),'cmeng-review-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,store:new RuntimeProjectStore({dataDir:dir,durable:true})};}

test('native BOQ rows including real zero need no numeric confirmation',async t=>{
 const {store}=newStore(t),projectId='AUTO-'+randomUUID();
 const bytes=Buffer.from('Item,Description,Unit,Qty,Rate,Amount\n1,Concrete,m3,3.25,4,13\n2,Zero,m3,0,4,0');
 const boq=await ingestBoq({projectId,bytes,verifiedMediaType:'text/csv',receivedAt:'2026-10-05'});store.attachBoq(boq,bytes,'BOQ.csv');
 const state=store.getOrCreate(projectId),review=boqNumericReview(state);
 assert.equal(review.pendingCount,0);assert.equal(review.automaticCount,2);
 assert.deepEqual(resolveBoqSource(state,'S').quantities!.items.map(i=>i.contractQuantity),[3.25,0]);
});

test('ten fresh projects save a single batch each, reuse correct figures and retain original sources',{timeout:180000},async t=>{
 const {dir,store}=newStore(t),cohort=randomUUID(),receipts=[];
 for(let p=0;p<10;p++){
   const projectId='REVIEW-'+cohort+'-'+p,truth=[randomInt(1,800)/100,randomInt(801,2000)/100,0,randomInt(2001,4000)/100];
   const {boq,bytes}=await scan(projectId,truth);store.attachBoq(boq,bytes,'Source.pdf');
   const state=store.getOrCreate(projectId),raw=JSON.stringify(state.boqRevisions),input=inputFor(state,truth);
   assert.equal(boqNumericReview(state).pendingCount,4);
   const result=store.confirmBoqNumericReadings(projectId,input);assert.equal(result.pendingCount,0);assert.equal(result.confirmedCount,4);
   assert.deepEqual(resolveBoqSource(state,'S').quantities!.items.map(i=>i.contractQuantity),truth);
   assert.equal(JSON.stringify(state.boqRevisions),raw,'Review never rewrites the parser receipt');
   assert.equal(createHash('sha256').update(readFileSync(state.evidenceDocuments[0]!.storedPath)).digest('hex'),boq.sourceHashSha256);
   assert.equal(state.boq!.authority,'candidate_only');assert.equal(state.boq!.complete,false,'Numeric review cannot claim complete source coverage');
   const version=state.version;assert.equal(store.confirmBoqNumericReadings(projectId,input).duplicate,true);assert.equal(state.version,version);
   const restored=new RuntimeProjectStore({dataDir:dir,durable:true}).getOrCreate(projectId);
   assert.equal(boqNumericReview(restored).pendingCount,0);assert.deepEqual(resolveBoqSource(restored,'S').quantities!.items.map(i=>i.contractQuantity),truth);
   receipts.push({projectId,sourceHash:boq.sourceHashSha256,truth});
 }
 console.log('BOQ_REVIEW_FRESH_COHORT='+JSON.stringify({cohort,projects:receipts}));
});

test('batch validation is atomic, source-bound, conflict-safe and independent of unrelated project edits',async t=>{
 const {store}=newStore(t),projectId='ATOMIC-'+randomUUID(),source=await scan(projectId);store.attachBoq(source.boq,source.bytes,'Source.pdf');
 const state=store.getOrCreate(projectId),input=inputFor(state,source.truth),before=state.version;
 const bad=structuredClone(input);bad.items[1]!.values.amount=123;
 assert.throws(()=>store.confirmBoqNumericReadings(projectId,bad),/does not agree/);assert.equal(state.version,before);assert.equal(state.boqNumericReviews,undefined);
 const duplicated=structuredClone(input);duplicated.items.push(duplicated.items[0]!);assert.throws(()=>store.confirmBoqNumericReadings(projectId,duplicated),/submitted twice/);
 const wrongSource=structuredClone(input);wrongSource.items[0]!.sourceHash='other-project';assert.throws(()=>store.confirmBoqNumericReadings(projectId,wrongSource),/source has changed/);
 const notReviewed=structuredClone(input);notReviewed.reviewedSource=false;assert.throws(()=>store.confirmBoqNumericReadings(projectId,notReviewed),/Check the selected/);
 const empty=structuredClone(input);empty.items[0]!.values={quantity:null,rate:null,amount:null};assert.throws(()=>store.confirmBoqNumericReadings(projectId,empty),/unreadable row/);
 store.updateControls(projectId,{});store.confirmBoqNumericReadings(projectId,input);
 const reused=structuredClone(input);reused.items[0]!.values.quantity=2;assert.throws(()=>store.confirmBoqNumericReadings(projectId,reused),/different values/);
 const stale={...input,batchId:randomUUID()};assert.throws(()=>store.confirmBoqNumericReadings(projectId,stale),/readings changed/);
});

test('partial review keeps other exceptions open, supports unpriced quantities and never reopens saved readings',async t=>{
 const {store}=newStore(t),projectId='PARTIAL-'+randomUUID(),source=await scan(projectId);store.attachBoq(source.boq,source.bytes,'Source.pdf');
 const state=store.getOrCreate(projectId),input=inputFor(state,source.truth);input.items=input.items.slice(0,1);input.items[0]!.values={quantity:3,rate:null,amount:null};
 store.confirmBoqNumericReadings(projectId,input);
 const remaining=boqNumericReview(state);assert.equal(remaining.pendingCount,3);assert.equal(remaining.confirmedCount,1);
 assert.deepEqual(resolveBoqSource(state,'S').quantities!.items.map(i=>i.contractQuantity),[3,null,null,null]);
 const figures=suppliedBoqFigures(resolveBoqSource(state,'S').boq,null);assert.equal(figures.rows[0]!.rate,null);
 const assessment={issues:[]} as any,actions=projectActions(state,assessment);assert.equal(actions.actions.filter(a=>a.id==='boq-numeric-review').length,1);
});

test('a failed durable save cannot leave confirmed values live and the exact batch can be retried',async t=>{
 const {dir,store}=newStore(t),projectId='SAVE-'+randomUUID(),source=await scan(projectId);store.attachBoq(source.boq,source.bytes,'Source.pdf');
 const state=store.getOrCreate(projectId),input=inputFor(state,source.truth),path=join(dir,'cmeng-project-state.json'),backup=path+'.saved';
 renameSync(path,backup);mkdirSync(path);
 assert.throws(()=>store.confirmBoqNumericReadings(projectId,input),/save could not be confirmed/);
 rmSync(path,{recursive:true});renameSync(backup,path);store.restoreSavedPosition();
 const restored=store.getOrCreate(projectId);assert.equal(boqNumericReview(restored).pendingCount,4);assert.equal(restored.boqNumericReviews,undefined);
 assert.ok(resolveBoqSource(restored,'S').quantities!.items.every(i=>i.contractQuantity===null));
 assert.equal(store.confirmBoqNumericReadings(projectId,input).pendingCount,0);
});

test('a changed reading or source cannot inherit confirmation; cross-project copies stay unresolved',async t=>{
 const {store}=newStore(t),projectId='CHANGE-'+randomUUID(),source=await scan(projectId);store.attachBoq(source.boq,source.bytes,'Source.pdf');
 const state=store.getOrCreate(projectId);store.confirmBoqNumericReadings(projectId,inputFor(state,source.truth));
 const originalHash=state.boq!.sourceHashSha256;
 state.boq!.canonicalItems[0]!.description='Different scope';
 assert.equal(resolveBoqSource(state,'S').quantities!.items[0]!.contractQuantity,null);assert.equal(boqNumericReview(state).pendingCount,1);
 const other=await scan('OTHER-'+randomUUID());store.attachBoq(other.boq,other.bytes,'Source.pdf');
 const otherState=store.getOrCreate(other.boq.projectId);otherState.boqNumericReviews=state.boqNumericReviews!;
 assert.ok(resolveBoqSource(otherState,'S').quantities!.items.every(i=>i.contractQuantity===null));
 state.boq!.sourceHashSha256='changed-source';assert.ok(resolveBoqSource(state,'S').quantities!.items.every(i=>i.contractQuantity===null));
 assert.equal(state.boqNumericReviews![0]!.sourceHash,originalHash,'The original decision is retained in history');
});

test('a saved review cannot be rebound to another revision or ingestion with identical readings',async t=>{
 const {store}=newStore(t),projectId='REVISION-'+randomUUID(),source=await scan(projectId);store.attachBoq(source.boq,source.bytes,'Source.pdf');
 const state=store.getOrCreate(projectId);store.confirmBoqNumericReadings(projectId,inputFor(state,source.truth));
 const saved=JSON.stringify(state.boqNumericReviews);
 assert.deepEqual(applyBoqNumericReviews(state.boq!,state).canonicalItems.map(i=>i.quantity),source.truth);
 for(const field of ['revision','ingestion']){
   const changed=structuredClone(state.boq!);
   if(field==='revision')changed.evidenceReceipt.revisionId+='-new';else changed.ingestionId+='-new';
   const effective=applyBoqNumericReviews(changed,state);
   assert.ok(effective.canonicalItems.every(i=>i.quantity===null&&!i.numericConfirmation),'A saved decision must not be rebound to a different '+field);
 }
 assert.equal(JSON.stringify(state.boqNumericReviews),saved,'The original saved decisions remain intact');
 assert.deepEqual(applyBoqNumericReviews(state.boq!,state).canonicalItems.map(i=>i.quantity),source.truth);
});

test('confirmed quantities drive mappings and S-curves without changing measured installations',async t=>{
 const {store}=newStore(t),projectId='CURVE-'+randomUUID(),source=await scan(projectId);store.attachBoq(source.boq,source.bytes,'Source.pdf');
 const state=store.getOrCreate(projectId);store.confirmBoqNumericReadings(projectId,inputFor(state,source.truth));
 const model=resolveBoqSource(state,'S').quantities!;
 model.allocations=model.items.map((i,n)=>({allocationId:'A'+n,quantityItemId:i.quantityItemId,activityId:'ACT',allocatedQuantity:source.truth[n]!,sourceRefs:[]}));
 model.installedSnapshots=[{snapshotId:'I',quantityItemId:model.items[0]!.quantityItemId,installedQuantity:1,asOfIso:'2026-10-05',sourceRefs:[]}];
 const schedule:CanonicalScheduleModel={projectId,source:'schedule_xlsx',sourceRevisionId:'S',dataDateIso:'2026-10-05',activities:[{projectId,activityId:'ACT',nativeId:null,name:'Works',wbsId:null,calendarId:null,activityType:'task',status:'not_started',baselineStartIso:'2026-10-01',baselineFinishIso:'2026-10-05',currentStartIso:'2026-10-01',currentFinishIso:'2026-10-05',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:32,remainingDurationHours:32,totalFloatHours:0,freeFloatHours:0,percentComplete:0,sourceRefs:[],diagnostics:[]}],relationships:[],wbs:[],calendars:[],diagnostics:[]};
 const expected=source.truth.reduce((a,b)=>a+b,0),mapping=assessQuantityMapping(model),curve=buildQuantityScurveProjection(model,schedule,{generatedAt:'2026-10-05',producerVersion:'review-test'});
 assert.equal(mapping.totalKnownContractQuantity,expected);assert.equal(curve.series[0]!.points.at(-1)!.baselinePlannedQuantity,expected);assert.equal(curve.series[0]!.points.at(-1)!.actualInstalledQuantity,1);
});

test('HTTP batch review updates Ask, JSON and Excel consistently and serves the exact source',{timeout:180000},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-review-ask-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const projectId='HTTP-REVIEW-'+randomUUID(),source=await scan(projectId);runtimeProjects.attachBoq(source.boq,source.bytes,'Source.pdf');
 const state=runtimeProjects.getOrCreate(projectId),server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/projects/'+projectId;
 const before=await (await fetch(base+'/boq/numeric-review')).json() as any;assert.equal(before.pendingCount,4);
 const input=inputFor(state,source.truth),save=await fetch(base+'/boq/numeric-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});assert.equal(save.status,200);assert.equal((await save.json() as any).pendingCount,0);
 const original=await fetch(base+'/boq/numeric-review/source/'+source.boq.ingestionId);assert.equal(original.status,200);assert.equal(createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex'),source.boq.sourceHashSha256);
 const wrongProject=await fetch('http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/projects/OTHER/boq/numeric-review/source/'+source.boq.ingestionId);assert.equal(wrongProject.status,404);
 let modelCalls=0;const engine=new ProjectAskEngine(new AskStore(dir),{plan:async()=>{modelCalls++;throw Error('No AI expected');},explain:async()=>{modelCalls++;throw Error('No AI expected');}});
 const answer=await engine.ask(projectId,{userId:'test',workspaceId:'test',name:null,title:null,company:null,allowModel:true},{question:'Show BOQ items and costs'});
 const rows=answer.sections.flatMap(s=>s.tables).flatMap(t=>t.rows).filter(r=>typeof r.description==='string'&&r.description.startsWith('Scope '));
 assert.equal(modelCalls,0);
 // Established amounts also produce a ranked-items table. Check the full source
 // table and every ranked occurrence against the same independently drawn values.
 assert.deepEqual(rows.slice(0,source.truth.length).map(r=>r.quantity),source.truth);
 assert.ok(rows.every(r=>r.quantity===source.truth[Number(String(r.description).replace('Scope ',''))-1]));
 invalidateProject(projectId);const module=moduleForProject(projectId,'challenge-contract'),json=JSON.parse(buildModuleJsonDownload(projectId,'challenge-contract',module).toString());
 assert.deepEqual(json.result.data.suppliedBoq.rows.map((r:any)=>r.quantity),source.truth);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await buildModuleWorkbook(projectId,'challenge-contract',module) as any);
 const sheet=book.worksheets.find(s=>Array.from(s.getRow(1).values as any[]).includes('numericConfirmation.decisionId'));assert.ok(sheet);
 const headers=sheet.getRow(1).values as any[],col=headers.indexOf('quantity');assert.deepEqual(source.truth.map((_,i)=>sheet.getRow(i+2).getCell(col).value),source.truth);
 const actions=projectActions(state,{issues:[]} as any);assert.ok(!actions.actions.some(a=>a.id==='boq-numeric-review'));
 assert.ok(state.boq!.canonicalItems.every(i=>i.quantity===null));
 assert.ok(state.boqNumericReviews!.every(d=>d.confirmedBy!=='cmeng-runtime'),'HTTP records the calling session, not a forged actor from the payload');
 const invalid=structuredClone(resolveBoqSource(state,'S').boq!);invalid.canonicalItems[0]!.numericConfirmation!.sourceHash='wrong';
 assert.equal(quarantineUnconfirmedBoqNumerics(invalid).canonicalItems[0]!.quantity,null);
 assert.equal(quarantineUnconfirmedBoqNumerics(invalid).canonicalItems[0]!.numericConfirmation,undefined,'An invalid binding must not be displayed as confirmed');
});
