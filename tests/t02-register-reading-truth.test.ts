import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {deliveryRecords} from '../packages/runtime-api/src/delivery-records';
import {documentClassificationForReview} from '../packages/runtime-api/src/document-identification';
import {readRegisterWorkbook} from '../packages/runtime-api/src/register-workbook';
import {prepareRegisterRows} from '../packages/truth-kernel/src';

// Hand-made fixtures. Every expected value below is written out by hand from
// the fixture itself, not computed by CMeng.

async function withServer(fn:(base:string)=>Promise<void>){
 const server=createCmengServer();
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',()=>resolve()));
 try{await fn('http://127.0.0.1:'+(server.address() as AddressInfo).port);}
 finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
async function upload(base:string,project:string,filename:string,body:string){
 const response=await fetch(base+'/api/projects/'+project+'/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':filename,'x-source-relative-path':'Uploads/'+filename},body});
 assert.equal(response.status,201,await response.clone().text());
 return await response.json() as {documentId:string;documentType:string;identification:{method:string;needsReview:boolean;classificationConflict:boolean;filenameHintDocumentType:string}};
}
const projectState=(project:string)=>(runtimeProjects as any).projects.get(project);
const evm=(asOf:string,ac:number)=>['As Of,PV,EV,AC,BAC,Currency',asOf+',1000000,900000,'+ac+',5000000,SAR'].join('\n');

test('T02 SW-12 the older cost report by its internal report date never becomes current, whatever its file name says',async()=>{
 await withServer(async base=>{
  const project='T02-COST-PAIR-NEWER-FIRST';
  const current=await upload(base,project,'Cost_Report_Rev1.csv',evm('2026-09-30',950000));
  const older=await upload(base,project,'Cost_Report_Rev2.csv',evm('2026-08-31',700000));
  assert.equal(current.documentType,'cost_evm_report');
  assert.equal(older.documentType,'cost_evm_report');
  const state=projectState(project);
  const byId=(id:string)=>state.evidenceDocuments.find((d:any)=>d.documentId===id);
  const family=byId(current.documentId).familyKey;
  assert.equal(byId(older.documentId).familyKey,family,'same report family');
  assert.equal(state.activeEvidenceBasis[family].activeDocumentId,current.documentId,'the 2026-09-30 report stays current');
  assert.equal(byId(current.documentId).basisState,'active');
  assert.equal(byId(current.documentId).supersededByDocumentId,null);
  assert.equal(byId(older.documentId).basisState,'candidate','the 2026-08-31 report is kept, never current');
 });
 await withServer(async base=>{
  const project='T02-COST-PAIR-OLDER-FIRST';
  const older=await upload(base,project,'Cost_Report_Rev2.csv',evm('2026-08-31',700000));
  const newer=await upload(base,project,'Cost_Report_Rev1.csv',evm('2026-09-30',950000));
  const state=projectState(project);
  const family=state.evidenceDocuments.find((d:any)=>d.documentId===newer.documentId).familyKey;
  assert.equal(state.activeEvidenceBasis[family].activeDocumentId,newer.documentId,'the later internal report date becomes current despite the lower file-name revision');
  assert.match(state.activeEvidenceBasis[family].reason,/report date inside the document \(2026-09-30 after 2026-08-31\)/);
  assert.equal(state.evidenceDocuments.find((d:any)=>d.documentId===older.documentId).basisState,'superseded');
 });
});

test('T02 SW-12 a cost report with no internal date or two dates is not ordered by content and keeps the existing rule',async()=>{
 await withServer(async base=>{
  const project='T02-COST-PAIR-UNKNOWN-DATE';
  const first=await upload(base,project,'Cost_Report_A.csv',['As Of,PV,EV,AC,Currency','2026-09-30,1,1,1,SAR','2026-08-31,1,1,1,SAR'].join('\n'));
  const second=await upload(base,project,'Cost_Report_B.csv',evm('2026-07-31',1));
  const state=projectState(project);
  const family=state.evidenceDocuments.find((d:any)=>d.documentId===first.documentId).familyKey;
  assert.equal(state.activeEvidenceBasis[family].activeDocumentId,first.documentId,'two report dates inside one file are unknown, never guessed');
  assert.equal(state.evidenceDocuments.find((d:any)=>d.documentId===second.documentId).basisState,'candidate');
 });
});

const submittalHeader='Submittal ID,Revision,Description,Procurement Package,Location,Criticality,Cost Code,Linked Letter,Status,Planned Issue';
const submittalRow='SUB-001,B,Chilled water pump shop drawings,PKG-07,Level 2 Plant Room,High,CC-23-410,LTR-0042,Approved with comments,2026-05-01';

test('T02 SW-11 R2 a file named as one type but holding another is identified by content and queued for review',async()=>{
 await withServer(async base=>{
  const project='T02-NAME-CONTENT-CONFLICT';
  const result=await upload(base,project,'Risk_Register.csv',[submittalHeader,submittalRow].join('\n'));
  assert.equal(result.documentType,'submittal_register','content decides the type');
  assert.equal(result.identification.method,'tabular_content');
  assert.equal(result.identification.filenameHintDocumentType,'risk_register');
  assert.equal(result.identification.classificationConflict,true);
  const document=projectState(project).evidenceDocuments.find((d:any)=>d.documentId===result.documentId);
  const plain=documentClassificationForReview(document);
  assert.equal(plain.documentType,'submittal_register');
  assert.equal(plain.reviewRequired,true,'queued for review, not filed silently');
  assert.match(String(plain.reason),/file name suggests risk register but the content shows submittal register/);
  const withRows=documentClassificationForReview(document,[submittalHeader.split(','),submittalRow.split(',')]);
  assert.equal(withRows.documentType,'submittal_register');
  assert.equal(withRows.reviewRequired,true);
  // A recorded user decision closes the review.
  const decided=documentClassificationForReview({...document,classificationDecision:{sourceHash:document.sourceHashSha256,documentType:document.documentType,category:document.category,reference:'Checked source',recordedAt:'2026-10-19T00:00:00Z',originalDocumentType:document.documentType,originalCategory:document.category}});
  assert.equal(decided.reviewRequired,false);
  // A matching file name raises no review.
  const named=await upload(base,project,'Submittal_Register.csv',[submittalHeader,submittalRow.replace('SUB-001','SUB-002')].join('\n'));
  assert.equal(documentClassificationForReview(projectState(project).evidenceDocuments.find((d:any)=>d.documentId===named.documentId)).reviewRequired,false);
 });
});

test('T02 SW-11 a type taken only from the file name is always queued for review',async()=>{
 await withServer(async base=>{
  const project='T02-NAME-ONLY-GUESS';
  const result=await upload(base,project,'Submittal_Register.csv',['Alpha,Beta','one,two'].join('\n'));
  assert.equal(result.identification.method,'metadata_fallback');
  assert.equal(result.identification.needsReview,true);
  const document=projectState(project).evidenceDocuments.find((d:any)=>d.documentId===result.documentId);
  assert.equal(documentClassificationForReview(document).reviewRequired,true);
 });
});

test('T02 SW-13 R1 SW-06 every submittal register column is read, and columns no calculation uses are shown as not used',async()=>{
 await withServer(async base=>{
  const project='T02-SUBMITTAL-COLUMNS';
  const result=await upload(base,project,'Submittal_Register.csv',[submittalHeader,submittalRow].join('\n'));
  const {records,documents}=deliveryRecords(projectState(project));
  const record=records.find(r=>r.receipts[0]?.documentId===result.documentId)!;
  assert.equal(record.kind,'submittal');
  assert.equal(record.reference,'SUB-001');
  assert.deepEqual({...record.fields},{
   'submittal id':'SUB-001','revision':'B','description':'Chilled water pump shop drawings','package id':'PKG-07',
   'location':'Level 2 Plant Room','criticality':'High','cost code':'CC-23-410','linked letter':'LTR-0042',
   'status':'Approved with comments','planned issue':'2026-05-01',
  },'every source column and its exact value is read');
  assert.deepEqual(record.links.packageIds,['PKG-07'],'procurement package links the record');
  const receipt=documents.find(d=>d.documentId===result.documentId)!;
  assert.deepEqual(receipt.columnsNotUsed,['Cost Code','Linked Letter']);
  assert.ok(receipt.diagnostics.includes('Source columns read and kept but not used by any calculation: Cost Code, Linked Letter.'));
 });
 const audit=prepareRegisterRows([submittalHeader.split(','),submittalRow.split(',')],'submittal_register').columnAudit;
 assert.equal(audit.length,10,'no column dropped');
 assert.ok(audit.every(c=>c.mappingState==='schema_recognized'||c.mappingState==='unused'));
 assert.equal(audit.find(c=>c.sourceHeader==='Cost Code')!.kind,'other','a cost code names a record; it is not a money amount');
 assert.equal(audit.find(c=>c.sourceHeader==='Planned Issue')!.kind,'date');
});

test('T02 R1 the xlsx register reader reads every column and value of a hand-made workbook',async()=>{
 const {default:ExcelJS}=await import('exceljs');
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Submittals');
 sheet.addRow(['Submittal Register - hand-made fixture']);
 sheet.addRow(submittalHeader.split(','));
 const values:any[]=submittalRow.split(',');values[9]=new Date(Date.UTC(2026,4,1));
 sheet.addRow(values);
 const bytes=new Uint8Array(await workbook.xlsx.writeBuffer() as ArrayBuffer);
 const read=await readRegisterWorkbook(bytes,createHash('sha256').update(bytes).digest('hex'),'submittal_register');
 assert.equal(read.sheets.length,1);
 const prepared=prepareRegisterRows(read.sheets[0]!.rows,'submittal_register');
 assert.equal(prepared.headerRow,2,'title row kept at its source position');
 assert.deepEqual(prepared.rawHeaders,submittalHeader.split(','));
 assert.deepEqual(prepared.rows,[['SUB-001','B','Chilled water pump shop drawings','PKG-07','Level 2 Plant Room','High','CC-23-410','LTR-0042','Approved with comments','2026-05-01']]);
 assert.deepEqual(prepared.unknown,['Cost Code','Linked Letter']);
});
