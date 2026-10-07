import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {PDFDocument} from 'pdf-lib';
import {parseBoqWorkbook,parseBoqOoxmlWorkbook} from '../packages/boq-parser/src';
import {parseBoqCsv} from '../packages/boq-csv-parser/src';
import {parseBoqPdf} from '../packages/boq-pdf-parser/src';
import {ingestBoq} from '../packages/boq-ingestion/src';
import {quantityItemsFromBoqCsv,quantityItemsFromBoqXlsx,quantityItemsFromBoqPdf,assessQuantityMapping,type CanonicalQuantityItem} from '../packages/quantity-progress-core/src';
import {quantityModelFromBoq,resolveBoqSource,suppliedBoqFigures} from '../packages/runtime-api/src/boq-source';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {buildQuantityScurveProjection} from '../packages/quantity-scurve/src';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

const rows=[['Item','Description','Unit','Qty','Rate','Amount'],
 ['1','Lost decimal','m2','300','4','12'],['2','Correct decimal','m2','3.00','4','12'],
 ['3','Unresolved rate','m2','7','unknown','unknown'],['4','Explicit zero','m2','0','4','0']];
const csv=Buffer.from(rows.map(row=>row.join(',')).join('\n'));
async function workbook(){const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('BOQ');rows.forEach(row=>sheet.addRow(row));return Buffer.from(await book.xlsx.writeBuffer());}
function check(items:CanonicalQuantityItem[]){
 assert.deepEqual(items.map(item=>item.contractQuantity),[null,3,7,0]);
 assert.ok(items[0]!.diagnostics.includes('BOQ_AMOUNT_ARITHMETIC_MISMATCH'));
 assert.ok(items[0]!.diagnostics.includes('QUANTITY_ITEM_CANDIDATE_WITHHELD:300'));
 assert.ok(items[2]!.diagnostics.includes('QUANTITY_ITEM_SOURCE_UNRESOLVED'));
 assert.ok(items.slice(1).every(item=>!item.diagnostics.some(code=>code.startsWith('QUANTITY_ITEM_CANDIDATE_WITHHELD:'))));
 const mapping=assessQuantityMapping({projectId:'P',boqRevisionId:'B',scheduleRevisionId:'S',items:[items[0]!],allocations:[{allocationId:'A',quantityItemId:items[0]!.quantityItemId,activityId:'ACT',allocatedQuantity:300,sourceRefs:[]}],installedSnapshots:[],diagnostics:[]});
 assert.equal(mapping.knownQuantityItemCount,0);assert.equal(mapping.totalKnownContractQuantity,0);assert.equal(mapping.mappedQuantity,0);assert.equal(mapping.mappingCoveragePercent,null);assert.equal(mapping.complete,false);
}
test('CSV arithmetic mismatch is quarantined without suppressing good, unrelated-unresolved or explicit-zero quantities',()=>check(quantityItemsFromBoqCsv(parseBoqCsv(csv))));
for(const [name,parse]of [['XLSX',parseBoqWorkbook],['OOXML',parseBoqOoxmlWorkbook]] as const){
 test(name+' arithmetic mismatch is quarantined at the quantity adapter',async()=>check(quantityItemsFromBoqXlsx(await parse(await workbook()))));
}
test('PDF arithmetic mismatch is quarantined after source-backed structured extraction',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([595,842]);const text=rows.map(row=>row.join(' ')).join('\n');
 const parsed=await parseBoqPdf(await pdf.save(),{ocrProvider:{name:'fixture-source-reading',recognize:async()=>({text,confidence:.99,language:'eng',diagnostics:[]})},aiTableExtractor:{name:'fixture-source-spans',extract:async()=>({confidence:.99,diagnostics:[],rows:rows.map(row=>row.map(value=>{const start=value?text.indexOf(value):0;return{value,sourceStart:start,sourceEnd:start+value.length,sourceText:value};}))})}});
 const items=quantityItemsFromBoqPdf(parsed);
 assert.ok(items.every(item=>item.contractQuantity===null),'Even arithmetically consistent OCR values require independent source confirmation');
 assert.ok(items[0]!.diagnostics.includes('BOQ_AMOUNT_ARITHMETIC_MISMATCH'));
 assert.ok(items.every(item=>item.diagnostics.includes('BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED')));
 assert.deepEqual(parsed.items.filter(item=>item.rowKind==='line_item').map(item=>item.quantity),[300,3,7,0],'Raw OCR observations remain inspectable');
});
for(const format of ['csv','xlsx']as const){
 test(format+' canonical ingestion retains raw source readings but quarantines calculated quantities',async()=>{
  const boq=await ingestBoq({projectId:'QUARANTINE',bytes:format==='csv'?csv:await workbook(),verifiedMediaType:format==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',receivedAt:'2026-10-05'});
  const before=JSON.stringify(boq),model=quantityModelFromBoq(boq,'S',null);check(model.items);
  const row=suppliedBoqFigures(boq,model).rows[0]!;
  assert.equal(row.quantity,null);assert.equal(row.sourceNumericReadings!.quantity,300,'the observation remains inspectable separately from calculation fields');assert.equal(JSON.stringify(boq),before);
 });
}
test('cached and durably restored legacy quantities cannot bypass a source arithmetic mismatch',async t=>{
 const dataDir=mkdtempSync(join(tmpdir(),'cmeng-quarantine-'));t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir,durable:true}),state=store.getOrCreate('QUARANTINE-RESTORE');
 const boq=await ingestBoq({projectId:state.projectId,bytes:csv,verifiedMediaType:'text/csv',receivedAt:'2026-10-05'});
 state.boq=boq;state.boqRevisions=[boq];state.quantities=quantityModelFromBoq(boq,'S',null);
 state.quantities.items[0]!.contractQuantity=300;state.quantities.items[0]!.diagnostics=[];
 state.quantities.allocations=[{allocationId:'A',quantityItemId:boq.canonicalItems[0]!.itemId,activityId:'ACT',allocatedQuantity:300,sourceRefs:[]}];
 state.quantities.installedSnapshots=[{snapshotId:'I',quantityItemId:boq.canonicalItems[0]!.itemId,installedQuantity:1,asOfIso:'2026-10-05',sourceRefs:[]}];
 const original=JSON.stringify(state.quantities),resolved=resolveBoqSource(state,'S').quantities!;check(resolved.items);
 assert.equal(JSON.stringify(state.quantities),original,'read projection leaves persisted source and mapping evidence intact');
 assert.deepEqual(resolved.allocations,state.quantities.allocations);assert.deepEqual(resolved.installedSnapshots,state.quantities.installedSnapshots);
 store.updateControls(state.projectId,{});
 const restored=new RuntimeProjectStore({dataDir,durable:true}).getOrCreate(state.projectId);
 check(restored.quantities!.items);assert.deepEqual(restored.quantities!.allocations,state.quantities.allocations);assert.deepEqual(restored.quantities!.installedSnapshots,state.quantities.installedSnapshots);
 assert.equal(restored.boq!.canonicalItems[0]!.quantity,null);assert.equal(restored.boq!.canonicalItems[0]!.sourceNumericReadings!.quantity,300);assert.equal(restored.boq!.sourceHashSha256,boq.sourceHashSha256);
});

test('quarantined quantities cannot survive in saved S-curve plans or establish complete mixed-item mapping',async()=>{
 const boq=await ingestBoq({projectId:'QUARANTINE-PLAN',bytes:csv,verifiedMediaType:'text/csv',receivedAt:'2026-10-05'});
 const model=quantityModelFromBoq(boq,'S',null);model.items=model.items.slice(0,2);
 model.allocations=model.items.map((item,index)=>({allocationId:'A'+index,quantityItemId:item.quantityItemId,activityId:'ACT',allocatedQuantity:index===0?300:3,sourceRefs:[]}));
 const mapping=assessQuantityMapping(model);assert.equal(mapping.totalKnownContractQuantity,3);assert.equal(mapping.mappedQuantity,3);assert.equal(mapping.complete,false,'one unknown item prevents complete population coverage');
 const schedule:CanonicalScheduleModel={projectId:'QUARANTINE-PLAN',source:'schedule_xlsx',sourceRevisionId:'S',dataDateIso:'2026-10-05',activities:[{projectId:'QUARANTINE-PLAN',activityId:'ACT',nativeId:null,name:'Works',wbsId:null,calendarId:null,activityType:'task',status:'not_started',baselineStartIso:'2026-10-01',baselineFinishIso:'2026-10-05',currentStartIso:'2026-10-01',currentFinishIso:'2026-10-05',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:32,remainingDurationHours:32,totalFloatHours:0,freeFloatHours:0,percentComplete:0,sourceRefs:[],diagnostics:[]}],relationships:[],wbs:[],calendars:[],diagnostics:[]};
 const curve=buildQuantityScurveProjection(model,schedule,{generatedAt:'2026-10-05',producerVersion:'regression'});
 assert.equal(curve.allocationState,'partial');assert.equal(curve.series[0]!.knownContractQuantity,3);
 assert.equal(curve.series[0]!.points.at(-1)!.baselinePlannedQuantity,3);assert.equal(curve.series[0]!.points.at(-1)!.currentForecastQuantity,3);
 assert.ok(curve.diagnostics.includes('QUANTITY_ALLOCATION_SOURCE_WITHHELD:A0'));
});
