import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {createHash,randomInt,randomUUID} from 'node:crypto';
import {parseBoqPdf} from '../packages/boq-pdf-parser/src';

async function document(tables:(string[][]|null)[]) {
 const pdf=await PDFDocument.create();
 for(const rows of tables){
  const page=pdf.addPage([650,500]);
  if(!rows){page.drawText('Unrelated correspondence',{x:30,y:430,size:12});continue;}
  const xs=rows[0]!.length===4?[30,330,420,490,620]:[30,270,360,450,530,620];
  const top=430,height=40;
  for(let row=0;row<=rows.length;row++)page.drawLine({start:{x:30,y:top-row*height},end:{x:620,y:top-row*height},thickness:1});
  for(const x of xs)page.drawLine({start:{x,y:top},end:{x,y:top-rows.length*height},thickness:1});
  rows.forEach((row,i)=>row.forEach((value,j)=>page.drawText(value,{x:xs[j]!+4,y:top-i*height-24,size:10})));
 }
 return pdf.save();
}
const first=[['Description','Quantity','Unit','Amount'],['Excavation','10','m3','100'],['Backfill','20','m3','200']];
const continuation=[['Further excavation','0','m3','0'],['Adjustment','-3','m3','-30']];

test('native continuation without a repeated header retains every row and original locator',async()=>{
 const result=await parseBoqPdf(await document([first,continuation,continuation]));
 const rows=result.items.filter(i=>i.rowKind==='line_item');
 assert.deepEqual(rows.map(i=>i.quantity),[10,20,0,-3,0,-3]);
 assert.deepEqual(rows.map(i=>i.amount),[100,200,0,-30,0,-30]);
 for(const item of rows.filter(i=>i.page>1)){
  assert.ok(item.diagnostics.includes('BOQ_PDF_TABLE_HEADER_INHERITED_FROM_CONTINUATION'));
  assert.ok(!item.diagnostics.includes('BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED'));
  assert.equal(item.sourceCells.quantity!.column,2);
  assert.equal(item.sourceCells.quantity!.row,item.row);
 }
 assert.equal(rows.find(i=>i.page===2)!.row,1,'The first data row is not consumed as a header');
});

for(const [name,second] of [
 ['changed column count',[['Other work','m3','2','10','20'],['More work','m3','3','10','30']]],
 ['unrelated table',[['Contact','Telephone','Department','Extension'],['Jane','1234','Design','12'],['John','5678','Finance','34']]],
] as const)test('native continuation cannot inherit into '+name,async()=>{
 const result=await parseBoqPdf(await document([first,second.map(row=>[...row])]));
 assert.equal(result.items.filter(i=>i.page===2&&i.diagnostics.includes('BOQ_PDF_TABLE_HEADER_INHERITED_FROM_CONTINUATION')).length,0);
});

test('native continuation cannot cross an intervening non-table page',async()=>{
 const result=await parseBoqPdf(await document([first,null,continuation]));
 assert.equal(result.items.filter(i=>i.page===3&&i.diagnostics.includes('BOQ_PDF_TABLE_HEADER_INHERITED_FROM_CONTINUATION')).length,0);
});

test('a native table own header replaces earlier column roles',async()=>{
 const second=[['Description','Amount','Quantity','Unit'],['New work','70','7','m2'],['Other work','80','8','m2']];
 const result=await parseBoqPdf(await document([first,second]));
 const rows=result.items.filter(i=>i.page===2&&i.rowKind==='line_item');
 assert.deepEqual(rows.map(i=>i.quantity),[7,8]);
 assert.deepEqual(rows.map(i=>i.amount),[70,80]);
 assert.ok(rows.every(i=>!i.diagnostics.includes('BOQ_PDF_TABLE_HEADER_INHERITED_FROM_CONTINUATION')));
});

test('ten fresh native continuation projects preserve shuffled roles and source quantities',async t=>{
 for(let project=0;project<10;project++){
  const id=randomUUID(),quantities=[randomInt(1,9000)/100,0,-randomInt(1,9000)/100];
  const shuffled=project%2===1;
  const names=shuffled?['Description','Unit','Amount','Quantity']:['Description','Quantity','Unit','Amount'];
  const values=quantities.map((q,i)=>shuffled?['Scope '+id.slice(0,8)+' '+i,'m3',(q*10).toFixed(2),q.toFixed(2)]:['Scope '+id.slice(0,8)+' '+i,q.toFixed(2),'m3',(q*10).toFixed(2)]);
  const bytes=await document([[names,values[0]!],[values[1]!],[values[2]!]]);
  const result=await parseBoqPdf(bytes),rows=result.items.filter(i=>i.rowKind==='line_item');
  assert.deepEqual(rows.map(i=>i.quantity),quantities,id);
  assert.deepEqual(rows.map(i=>i.amount),quantities.map(q=>Number((q*10).toFixed(2))),id);
  assert.ok(rows.every(i=>!i.diagnostics.includes('BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED')));
  t.diagnostic(JSON.stringify({projectId:id,sha256:createHash('sha256').update(bytes).digest('hex'),quantities,shuffled}));
 }
});
