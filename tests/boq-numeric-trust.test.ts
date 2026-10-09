import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {PDFDocument} from 'pdf-lib';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {ingestBoq,quarantineUnconfirmedBoqNumerics,type BoqIngestionResult} from '../packages/boq-ingestion/src';
import {quantityModelFromBoq,resolveBoqSource,suppliedBoqFigures} from '../packages/runtime-api/src/boq-source';
import {assessQuantityMapping} from '../packages/quantity-progress-core/src';
import {RuntimeProjectStore,runtimeProjects} from '../packages/runtime-api/src/project-state';
import {boqScopeIntelligence} from '../packages/runtime-api/src/boq-scope-intelligence';
import {buildQuantityScurveProjection} from '../packages/quantity-scurve/src';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {buildModuleJsonDownload,buildModuleWorkbook} from '../packages/runtime-api/src/module-report';
import ExcelJS from 'exceljs';

const flag='BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED';
const observations=Array.from({length:100},(_,i)=>({id:String(i+1),trueQuantity:(i+1)/100,quantity:i+1,rate:7,amount:(i+1)*7}));
let cached:Promise<BoqIngestionResult>|undefined;
function observedBoq(){return cached??=(async()=>{
 const canvas=createCanvas(1100,2400),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='black';ctx.font='16px Arial';
 ctx.fillText('Item Description Unit Qty Rate Amount Currency',20,25);
 observations.forEach((v,i)=>ctx.fillText(v.id+' Concrete scope '+v.id+' m2 '+v.trueQuantity.toFixed(2)+' 7 '+(v.trueQuantity*7).toFixed(2)+' SAR',20,50+i*23));
 const pdf=await PDFDocument.create(),image=await pdf.embedPng(canvas.toBuffer('image/png'));pdf.addPage([550,1200]).drawImage(image,{x:0,y:0,width:550,height:1200});const bytes=await pdf.save();canvas.width=1;canvas.height=1;
 const rows=[['Item','Description','Unit','Qty','Rate','Amount','Currency'],...observations.map(v=>[v.id,'Concrete scope '+v.id,'m2',String(v.quantity),String(v.rate),String(v.amount),'SAR'])],text=rows.map(row=>row.join(' | ')).join('\n');
 const result=await ingestBoq({projectId:'NUMERIC-TRUST',bytes,verifiedMediaType:'application/pdf',receivedAt:'2026-10-05'}, {pdf:{ocrProvider:{name:'injected-correlated-error',recognize:async()=>({text,confidence:.999,language:'eng',diagnostics:[]})},aiTableExtractor:{name:'exact-ocr-span-fixture',extract:async()=>({confidence:.999,diagnostics:[],rows:rows.map(row=>row.map(value=>{const start=text.indexOf(value);return {value,sourceStart:start,sourceEnd:start+value.length,sourceText:value};}))})}}});
 assert.equal(result.sourceHashSha256,createHash('sha256').update(bytes).digest('hex'));return result;
})();}

test('one policy blocks 100 correlated decimal-loss cases even with exact OCR spans, high confidence and balanced arithmetic',{timeout:180000},async()=>{
 const result=await observedBoq();assert.equal(result.canonicalItems.length,100);
 result.canonicalItems.forEach((item,i)=>{
  assert.deepEqual([item.quantity,item.rate,item.amount],[null,null,null]);
  assert.deepEqual(item.sourceNumericReadings,{quantity:observations[i]!.quantity,rate:7,amount:observations[i]!.amount});
  assert.ok(item.diagnostics.includes(flag));assert.equal(item.status,'unresolved');
 });
 assert.equal(result.complete,false);assert.equal(result.verifiedRows,0);
 const mapping=assessQuantityMapping(quantityModelFromBoq(result,'S',null));assert.equal(mapping.knownQuantityItemCount,0);assert.equal(mapping.complete,false);assert.equal(mapping.mappingCoveragePercent,null);
 assert.equal(quarantineUnconfirmedBoqNumerics(result),result,'The projection is idempotent');
});

test('native structured values and an explicit zero remain usable under the same policy',async()=>{
 const rows=['Item,Description,Unit,Qty,Rate,Amount,Currency','Z,Explicit zero,m2,0,7,0,SAR',...observations.map(v=>[v.id,'Concrete scope '+v.id,'m2',v.trueQuantity.toFixed(2),7,(v.trueQuantity*7).toFixed(2),'SAR'].join(','))];
 const result=await ingestBoq({projectId:'NATIVE-TRUST',bytes:Buffer.from(rows.join('\n')),verifiedMediaType:'text/csv',receivedAt:'2026-10-05'});
 assert.equal(result.canonicalItems[0]!.quantity,0);assert.equal(result.canonicalItems[0]!.amount,0);
 assert.deepEqual(quantityModelFromBoq(result,'S',null).items.slice(1).map(i=>i.contractQuantity),observations.map(v=>v.trueQuantity));
 assert.ok(result.canonicalItems.every(i=>!i.diagnostics.includes(flag)));
});

function legacy(result:BoqIngestionResult):BoqIngestionResult{
 const copy=structuredClone(result);copy.complete=true;copy.state='verified_candidate';copy.diagnostics=[];
 copy.canonicalItems=copy.canonicalItems.map(item=>{const {sourceNumericReadings,...rest}=item;return {...rest,...sourceNumericReadings!,status:'verified',diagnostics:[]};});return copy;
}

test('legacy persisted OCR, adopted documents and cached quantities cannot bypass the numeric trust boundary',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-numeric-trust-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:true}),state=store.getOrCreate('NUMERIC-TRUST'),old=legacy(await observedBoq());state.boq=old;state.boqRevisions=[old];
 state.quantities=quantityModelFromBoq(old,'S',null);state.quantities.items.forEach((item,i)=>{item.contractQuantity=observations[i]!.quantity;item.diagnostics=[];});
 const original=JSON.stringify(old),selected=resolveBoqSource(state,'S');assert.equal(selected.selection.adoptedSource,true);
 assert.ok(selected.quantities!.items.every(i=>i.contractQuantity===null));assert.ok(selected.boq!.canonicalItems.every(i=>i.amount===null));assert.equal(JSON.stringify(old),original,'A read projection preserves the retained old receipt');
 const supplied=suppliedBoqFigures(old,state.quantities);assert.ok(supplied.rows.every(i=>i.quantity===null&&i.rate===null&&i.amount===null));assert.equal(supplied.rows[0]!.sourceNumericReadings!.quantity,1);
 const scope=boqScopeIntelligence(state);assert.ok(scope.rows.every(i=>i.amount===null),'Scope and commercial grouping cannot sum observations');
 store.updateControls(state.projectId,{});const restored=new RuntimeProjectStore({dataDir:dir,durable:true}).getOrCreate(state.projectId);
 assert.ok(restored.boq!.canonicalItems.every(i=>i.quantity===null&&i.rate===null&&i.amount===null));assert.ok(restored.quantities!.items.every(i=>i.contractQuantity===null));
 assert.equal(restored.boq!.sourceHashSha256,old.sourceHashSha256);assert.equal(restored.boq!.canonicalItems[0]!.sourceNumericReadings!.quantity,1);
 const missingRead=legacy(await observedBoq());delete missingRead.pdfRead;assert.ok(quarantineUnconfirmedBoqNumerics(missingRead).canonicalItems.every(i=>i.quantity===null),'Unknown PDF reading provenance is not proof of native text');
});

test('unconfirmed OCR allocations cannot enter S-curves while independently dated installed measurements survive',async()=>{
 const result=await observedBoq(),model=quantityModelFromBoq(result,'S',null);model.items=model.items.slice(0,1);
 model.allocations=[{allocationId:'STALE',quantityItemId:model.items[0]!.quantityItemId,activityId:'ACT',allocatedQuantity:9999,sourceRefs:[]}];
 model.installedSnapshots=[{snapshotId:'MEASURED',quantityItemId:model.items[0]!.quantityItemId,installedQuantity:2,asOfIso:'2026-10-05',sourceRefs:[]}];
 const schedule:CanonicalScheduleModel={projectId:'NUMERIC-TRUST',source:'schedule_xlsx',sourceRevisionId:'S',dataDateIso:'2026-10-05',activities:[{projectId:'NUMERIC-TRUST',activityId:'ACT',nativeId:null,name:'Works',wbsId:null,calendarId:null,activityType:'task',status:'not_started',baselineStartIso:'2026-10-01',baselineFinishIso:'2026-10-05',currentStartIso:'2026-10-01',currentFinishIso:'2026-10-05',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:32,remainingDurationHours:32,totalFloatHours:0,freeFloatHours:0,percentComplete:0,sourceRefs:[],diagnostics:[]}],relationships:[],wbs:[],calendars:[],diagnostics:[]};
 const curve=buildQuantityScurveProjection(model,schedule,{generatedAt:'2026-10-05',producerVersion:'numeric-trust'});
 assert.equal(curve.series[0]!.knownContractQuantity,0);assert.equal(curve.series[0]!.points.at(-1)!.baselinePlannedQuantity,null);assert.equal(curve.series[0]!.points.at(-1)!.currentForecastQuantity,null);assert.equal(curve.series[0]!.points.at(-1)!.actualInstalledQuantity,2);assert.ok(curve.diagnostics.includes('QUANTITY_ALLOCATION_SOURCE_WITHHELD:STALE'));
});

test('Ask, module JSON and Excel preserve unknown calculation fields and separate OCR observations',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-numeric-output-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const state=runtimeProjects.getOrCreate('NUMERIC-OUTPUT-TRUST'),old=legacy(await observedBoq());state.boq=old;state.boqRevisions=[old];state.quantities=quantityModelFromBoq(old,'',null);state.version++;
 let modelCalls=0;const engine=new ProjectAskEngine(new AskStore(dir),{plan:async()=>{modelCalls++;throw Error('No model call expected');},explain:async()=>{modelCalls++;throw Error('No model call expected');}});
 const answer=await engine.ask(state.projectId,{userId:'owner',workspaceId:'w',name:null,title:null,company:null,allowModel:true},{question:'Show BOQ items and costs'});
 const tables=answer.sections.flatMap(section=>section.tables),items=tables.flatMap(table=>table.rows).filter(row=>typeof row.description==='string'&&row.description.startsWith('Concrete scope '));
 assert.equal(modelCalls,0);assert.equal(items.length,100);assert.ok(items.every(row=>row.quantity===null&&row.rate===null&&row.amount===null));
 const costs=tables.flatMap(table=>table.rows).filter(row=>'readableAmount' in row||'readableValue' in row);assert.ok(costs.length>0);assert.ok(costs.every(row=>('readableAmount' in row?row.readableAmount:row.readableValue)===null));
 const result=moduleForProject(state.projectId,'challenge-contract'),download=JSON.parse(buildModuleJsonDownload(state.projectId,'challenge-contract',result).toString());
 const rows=download.result.data.suppliedBoq.rows;assert.equal(rows.length,100);assert.ok(rows.every((row:any)=>row.quantity===null&&row.rate===null&&row.amount===null));assert.equal(rows[0].sourceNumericReadings.quantity,1);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await buildModuleWorkbook(state.projectId,'challenge-contract',result) as any);
 const sheet=workbook.worksheets.find(sheet=>sheet.getRow(1).values&&Array.from(sheet.getRow(1).values as any[]).includes('sourceNumericReadings.quantity'));
 assert.ok(sheet,'Source observations must be explicitly named in the workbook');
 const header=sheet.getRow(1).values as any[],quantity=header.indexOf('quantity'),rate=header.indexOf('rate'),amount=header.indexOf('amount'),observed=header.indexOf('sourceNumericReadings.quantity');
 assert.ok(quantity>0&&rate>0&&amount>0);assert.equal(sheet.rowCount,101);
 for(let n=2;n<=sheet.rowCount;n++){const row=sheet.getRow(n);assert.equal(row.getCell(quantity).value,null);assert.equal(row.getCell(rate).value,null);assert.equal(row.getCell(amount).value,null);assert.equal(row.getCell(observed).value,n-1);}
});
