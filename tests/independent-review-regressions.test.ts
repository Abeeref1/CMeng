import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import ExcelJS from 'exceljs';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {projectDocumentRegister} from '../packages/runtime-api/src/server';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {documentReadReview} from '../packages/runtime-api/src/document-read-review';
import {resolveIntent} from '../packages/project-ask/src/intent';
import {askCatalogue} from '../packages/runtime-api/src/ask-engine';
import type {AskSession} from '../packages/project-ask/src/types';
import type {SourceTable} from '../packages/truth-kernel/src';

test('BOQ-only workbook receipts account for every parsed sheet without claiming governed quantities',async()=>{
  const projectId='RECEIPT-'+randomUUID(),book=new ExcelJS.Workbook();
  const headers=['Item No','Description','Unit','Quantity','Rate','Amount','Currency'];
  book.addWorksheet('Electrical').addRows([headers,['E-1','Conduit','m',12,3,36,'GBP']]);
  book.addWorksheet('Mechanical').addRows([headers,['M-1','Pipe','m',7,8,56,'GBP'],['M-2','Valve','no',2,9,18,'GBP']]);
  await runtimeProjects.ingestEvidenceFile({projectId,sourceFilename:'multisheet_boq.xlsx',bytes:Buffer.from(await book.xlsx.writeBuffer()),mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',uploadedAt:'2032-01-01'});
  const receipt=projectDocumentRegister(projectId)!.documents[0]!.readReview;
  assert.match(receipt.note!,/3 rows and 7 distinct fields read across 2 parsed tables/);
  assert.equal(receipt.complete,false);
  const result=moduleForProject(projectId,'quantity-scurve'),data=result.data as any;
  assert.equal(data.suppliedBoq.itemCount,3);
  assert.match(data.featureAvailability.reason,/BOQ\/quantity evidence is available/);
  assert.notEqual(data.featureAvailability.state,'active');
  assert.equal(data.featureAvailability.establishedResultCount,null);
});

test('multi-table receipts retain unrecognised rows and exclude stale or other-document receipts',()=>{
  const state=runtimeProjects.getOrCreate('RECEIPT-UNRESOLVED-'+randomUUID());
  const document={documentId:'D',sourceHashSha256:'H',parserState:'identified'} as any;
  const table=(id:string,hash:string,count:number,recognized:boolean):SourceTable=>({document:{documentId:id,sourceHashSha256:hash},headers:['Column'],rows:Array.from({length:count},()=>({cells:{Column:'x'}})),recognition:{recognized,readRowCount:count,headerRow:1,unknown:[]}} as unknown as SourceTable);
  const receipt=documentReadReview(document,state,[table('D','H',2,true),table('D','H',4,false),table('D','stale',99,true),table('other','H',50,true)]);
  assert.equal(receipt.state,'partial');assert.match(receipt.note!,/6 rows/);assert.match(receipt.note!,/1 tables have unrecognised/);assert.equal(receipt.complete,false);
});

test('Ask resolves explicit named reporting dates while rejecting invalid or conflicting cutoffs',()=>{
  const user:AskSession={userId:'test',workspaceId:'test',name:'Reviewer',title:'Review',company:'Test',allowModel:false};
  const intent=(question:string)=>resolveIntent(question,askCatalogue.available(user),user,null,null);
  for(const text of ['30 June 2031','June 30, 2031','30th June 2031','2031-06-30']){
    const result=intent('What is the total certified amount and total paid amount as of '+text+'? Keep currencies separate.');
    assert.equal(result.plan.kind,'historical');assert.equal(result.plan.asOf,'2031-06-30');
    assert.ok(!result.gaps.some(g=>g.includes('year or reporting date is missing')));
  }
  for(const text of ['31 June 2031','February 29, 2031','2031-02-31'])assert.throws(()=>intent('Payments as of '+text),/valid historical cut-off/);
  assert.equal(intent('Payments as of 30 June').plan.asOf,'unresolved');
  assert.equal(intent('Payments as of 30 June 2031 and as of 1 July 2031').plan.asOf,'unresolved');
});
