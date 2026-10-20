import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runInNewContext as runVm} from 'node:vm';
import ExcelJS from 'exceljs';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {runInNewContext} from './browser-context';
import {decisionFactsScript} from '../packages/runtime-api/src/ui-decision-facts';
import {identifyEvidenceDocument} from '../packages/runtime-api/src/document-identification';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {projectDocumentRegister} from '../packages/runtime-api/src/server';
import {deliveryRecords} from '../packages/runtime-api/src/delivery-records';
import {prepareRegisterRows,unusedColumnReason} from '../packages/truth-kernel/src';

// Round 15 guard rules N8, N1, R2, R1 and R3 at their shared causes. Every
// expected value is written out by hand from the fixture itself.

test('N8 a gap between two counts is said in words, never as a negative count; durations keep their sign',()=>{
  const item=(label:string,submitted:number,independent:number,gap:number,unit:string)=>({metric:label,label,evidenceState:'verified',
    submitted:{state:'verified',value:submitted,unit},independent:{state:'calculated',value:independent,unit},gap:{state:'calculated',value:gap,unit,note:'Independent minus submitted.'}});
  const html=String(runInNewContext('renderUniversalChallenge(challenge)',{challenge:{submittedEvidenceState:'complete',independentState:'calculated',notSubmittedCount:0,unavailableCheckCount:0,scenarioCount:0,challengedCount:3,
    items:[item('Near-critical activity count',38,0,-38,'activities'),item('Milestones at risk',2,3,1,'milestones'),item('Finish movement',0,-5,-5,'days')]}}));
  assert.match(html,/38 fewer activities than submitted/);
  assert.match(html,/1 more milestone than submitted/);
  assert.doesNotMatch(html,/-38 activities/,'a count is never negative');
  assert.match(html,/-5 days/,'a signed duration keeps its sign and unit');
});

test('N1 a paged decision table shows its full total with the browse control under the table',()=>{
  const ctx:any={readerText:String,managementNumber:(v:number)=>v.toLocaleString('en'),escapeHtml:String,planningShortDate:String,currentModuleResult:null};
  const table=runVm(decisionFactsScript+';decisionTable',ctx);
  const rows=Array.from({length:30},(_,i)=>({activityReference:'ACT-'+i,name:'Activity '+i}));
  const html=String(table('erosion',rows,'/data/decisionAnalysis/trends/rows',119));
  const end=html.indexOf('</table>'),shown=html.indexOf('Showing 1–25 of 119'),next=html.indexOf('Next records');
  assert.ok(end>0&&shown>end&&next>shown,'"Showing 1–25 of 119" sits with Previous/Next under the 25 rows');
  assert.doesNotMatch(html,/ACT-25/,'the page holds 25 rows');
  const small=String(table('erosion',rows.slice(0,3),'/data/decisionAnalysis/trends/rows',3));
  assert.match(small,/Showing 1–3 of 3/);assert.doesNotMatch(small,/Next records/);
});

async function contractPdf(lines:string[]){
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([595,842]).drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
  return new Uint8Array(await pdf.save());
}

test('R2 a clear file is never recorded as a type conflict: an XER named as an update, a bond register, a titled contract',async()=>{
  const xer=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name','%R\t1\tP1','%T\tTASK','%F\ttask_id\ttask_code\ttask_name','%R\t1\tA100\tExcavation','%E'].join('\n');
  const update=(await identifyEvidenceDocument({bytes:Buffer.from(xer),sourceFilename:'Latest_Update_13.xer',sourceRelativePath:null})).identification;
  assert.equal(update.detectedDocumentType,'schedule_file');
  assert.equal(update.filenameHintDocumentType,'schedule_update');
  assert.equal(update.classificationConflict,false,'a schedule file named as an update is the same type');
  assert.ok(!update.diagnostics.includes('DOCUMENT_METADATA_CONTENT_CONFLICT'));

  const bond=(await identifyEvidenceDocument({bytes:Buffer.from('Bond ID,Bond Type,Bond Amount,Currency,Expiry Date,Status\nPB-01,Performance Bond,250000,USD,2043-01-31,Active\n'),sourceFilename:'Bond_Register_939.csv',sourceRelativePath:null})).identification;
  assert.equal(bond.detectedDocumentType,'bond_register');
  assert.equal(bond.filenameHintDocumentType,'bond_register');
  assert.equal(bond.classificationConflict,false,'name and content agree on the type; the catalogues file it under different categories');

  const contract=(await identifyEvidenceDocument({bytes:await contractPdf(['CONSTRUCTION CONTRACT','1 Contract Sum','The Accepted Contract Amount is USD 9,337,479.','Contractual completion date: 2043-04-17.',
    '2 Certification and Payment','The Engineer shall certify within 7 calendar days. Payment shall be made within 28 calendar days.']),sourceFilename:'Main_Works_Contract_284.pdf',sourceRelativePath:null})).identification;
  assert.equal(contract.detectedDocumentType,'main_contract');
  assert.equal(contract.needsReview,false,'a document titled Construction Contract is identified from its content');

  // A real disagreement between name and content is still recorded.
  const named=(await identifyEvidenceDocument({bytes:Buffer.from('Submittal ID,Revision,Description,Status\nSUB-1,A,Pump drawings,Approved\n'),sourceFilename:'Risk_Register.csv',sourceRelativePath:null})).identification;
  assert.equal(named.classificationConflict,true);
});

test('R1 every register column the shared readers read is read; the rest are not used with a plain reason',()=>{
  const unknown=(headers:string[],type:string)=>prepareRegisterRows([headers,headers.map((_,i)=>'v'+i)],type).unknown;
  assert.deepEqual(unknown(['Bond ID','Bond Type','Bond Amount','Currency','Expiry Date','Status'],'bond_register'),[]);
  assert.deepEqual(unknown(['Variation ID','Status','Approved Amount','Agreed Amount','Assessed Amount','Payment ID','Agreed Date'],'variation_register'),[]);
  assert.deepEqual(unknown(['Claim ID','Event','Notice Date','Event ID','Impact Days','Day Basis','Assessed Amount'],'delay_eot_claims_register'),[]);
  assert.deepEqual(unknown(['Metric','As Of','Value','Currency','CBS ID','Amount Basis'],'cost_evm_report'),[]);
  assert.deepEqual(unknown(['Package ID','Description','Status','Delivered Quantity','Delivery Actual Date','PO Planned Date','Supplier ID','X0'],'procurement_register'),['X0']);
  assert.deepEqual(unknown(['Interface ID','Giving Party','Receiving Party','Required Deliverable','Status','Comment 0'],''),['Comment 0']);
  // A column counts as read only for the register whose reader reads it.
  assert.deepEqual(unknown(['Risk ID','Description','Status','Agreed Amount'],'risk_register'),['Agreed Amount']);
  assert.match(unusedColumnReason('Extra_0'),/^Placeholder heading/);
  assert.match(unusedColumnReason('Misc 1'),/^Placeholder heading/);
  assert.match(unusedColumnReason('X2'),/^Placeholder heading/);
  assert.match(unusedColumnReason('Comment 0'),/^Free-text comment/);
  assert.match(unusedColumnReason('ملاحظات 1'),/^Free-text comment/);
  assert.match(unusedColumnReason('Linked Letter'),/^No CMeng reader uses this column/);
});

test('R1 R3 a mixed delivery workbook: every column is read or shown as not used, and the file is read completely',async()=>{
  const projectId='R15-G6-'+randomUUID(),book=new ExcelJS.Workbook();
  book.addWorksheet('Overview').addRows([['Metro Extension 9'],['Delivery control evidence']]);
  book.addWorksheet('package 1').addRows([['Metro Extension 9'],
    ['Package ID','Description','Status','Required On Site','Delivered Quantity','Delivery Actual Date','PO Planned Date','Extra_0','Comment 0'],
    ['PK-1','Transformer package','Ordered','2041-06-01','8','2041-04-01','2041-02-22','1','late quote']]);
  book.addWorksheet('lifecycle 1').addRows([['Lifecycle ID','Stages','PO Duration','PO Day Basis','PO Duration Source','Delivery Duration','Description'],
    ['LC-1','po;delivery;installation','10','working days','Supplier programme','20','Imported equipment lifecycle']]);
  await runtimeProjects.ingestEvidenceFile({projectId,sourceFilename:'monthly_delivery_9.xlsx',bytes:Buffer.from(await book.xlsx.writeBuffer()),mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',uploadedAt:'2041-04-18'});
  const document=projectDocumentRegister(projectId)!.documents[0]! as any;
  const usage=document.columnUsage as any[];
  assert.equal(usage.length,3);
  for(const table of usage){
    assert.equal(table.ignoredColumns,undefined,'no column is left unexplained');
    for(const column of table.notUsedColumns)assert.ok(column.reason.length>20,'each column not used has its reason');
  }
  const overview=usage.find(t=>t.notUsedColumns.some((c:any)=>c.column==='Metro Extension 9')&&t.mappedColumns.length===0)!;
  assert.equal(overview.recognitionState,'title_sheet');
  const pack=usage.find(t=>t.mappedColumns.includes('Package ID'))!;
  for(const read of ['Delivered Quantity','Delivery Actual Date','PO Planned Date','Required On Site'])assert.ok(pack.mappedColumns.includes(read),read+' is read by the Delivery reader');
  assert.deepEqual(pack.notUsedColumns.map((c:any)=>c.column),['Extra_0','Comment 0']);
  assert.match(pack.notUsedColumns[0].reason,/^Placeholder heading/);
  assert.match(pack.notUsedColumns[1].reason,/^Free-text comment/);
  const lifecycle=usage.find(t=>t.mappedColumns.includes('Lifecycle ID'))!;
  assert.deepEqual(lifecycle.notUsedColumns,[],'lifecycle durations, day basis and source are read');
  assert.equal(lifecycle.recognitionState,'recognized');
  assert.equal(document.readReview.complete,true);
  assert.equal(document.readReview.state,'read');
  assert.match(document.readReview.note,/1 cover sheet read as text/);
  // The Delivery reader's own receipt says the same thing.
  const receipts=deliveryRecords(runtimeProjects.get(projectId)!).documents.filter(r=>r.documentId===document.documentId);
  const packageReceipt=receipts.find(r=>r.kind==='package')!;
  assert.deepEqual(packageReceipt.columnsNotUsed,['Extra_0','Comment 0']);
});
