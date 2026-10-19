import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import type {AddressInfo} from 'node:net';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {contentReportDate} from '../packages/runtime-api/src/evidence-control';
import {readRegisterWorkbook} from '../packages/runtime-api/src/register-workbook';

// T02 / R2 / SW-12: the report date inside xlsx and PDF cost reports orders
// snapshots, the same as for CSV. Expected dates are written by hand from
// each fixture.

async function costWorkbook(label:string,value:Date|string){
 const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Cost Report');
 sheet.addRow(['Project Cost Report']);
 sheet.addRow([label,value]);
 sheet.addRow([]);
 sheet.addRow(['Cost Code','Description','Budget','Committed','Actual','Currency']);
 sheet.addRow(['CC-100','Substructure',1000000,900000,850000,'SAR']);
 sheet.addRow(['CC-200','Superstructure',2000000,1500000,1200000,'SAR']);
 return new Uint8Array(await book.xlsx.writeBuffer() as ArrayBuffer);
}
async function xlsxDocument(label:string,value:Date|string){
 const read=await readRegisterWorkbook(await costWorkbook(label,value),'hash-x','cost_evm_report');
 return {sourceHashSha256:'hash-x',mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',documentType:'cost_evm_report',tabularRead:read,identification:{}} as any;
}
const pdfDocument=(...lines:string[])=>({sourceHashSha256:'hash-p',mediaType:'application/pdf',documentType:'cost_evm_report',identification:{},
 textSegments:[{segmentId:'s1',producerVersion:'t',kind:'linked_correspondence_context',anchor:'p1',pageNumber:1,text:lines.join('\n'),locator:'page 1',method:'native_pdf_text'}]}) as any;

test('T02 R2 xlsx cost report: the date cell next to its "Report date" label is the report date',async()=>{
 assert.equal(contentReportDate(await xlsxDocument('Report date',new Date(Date.UTC(2026,8,30)))),'2026-09-30');
 assert.equal(contentReportDate(await xlsxDocument('Period ending:','31/08/2026')),'2026-08-31');
 assert.equal(contentReportDate(await xlsxDocument('As at','31 July 2026')),'2026-07-31');
 assert.equal(contentReportDate(await xlsxDocument('Report date','to follow')),null,'an unreadable report date stays unknown');
});

test('T02 R2 PDF cost report: the report date comes from the title line or a labelled line',()=>{
 assert.equal(contentReportDate(pdfDocument('Monthly Cost Report - Period ending 31 August 2026','Cost Code  Budget  Actual')),'2026-08-31');
 assert.equal(contentReportDate(pdfDocument('COST REPORT No. 7','As at 30/09/2026','Total budget SAR 3,000,000')),'2026-09-30');
 assert.equal(contentReportDate(pdfDocument('Cost Report','Report date: 2026-10-15')),'2026-10-15');
 assert.equal(contentReportDate(pdfDocument('Cost Report','Period ending 31 August 2026','As at 30/09/2026')),null,'two different report dates inside one document stay unknown');
 assert.equal(contentReportDate(pdfDocument('Cost Report Rev 3','Budget and actual by cost code')),null,'no stated date stays unknown');
});

async function withServer(fn:(base:string)=>Promise<void>){
 const server=createCmengServer();
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',()=>resolve()));
 try{await fn('http://127.0.0.1:'+(server.address() as AddressInfo).port);}
 finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
async function upload(base:string,project:string,filename:string,body:string){
 const response=await fetch(base+'/api/projects/'+project+'/evidence/uploads',{method:'POST',headers:{'content-type':'text/csv','x-source-filename':filename,'x-source-relative-path':'Uploads/'+filename},body});
 assert.equal(response.status,201,await response.clone().text());
 return await response.json() as {documentId:string};
}

test('T02 R2 when a cost report has no single date inside it, the basis reason says so and never states the file name as certain',async()=>{
 await withServer(async base=>{
  const project='T02-COST-NO-CONTENT-DATE-REASON';
  const first=await upload(base,project,'Cost_Report_Rev1.csv',['As Of,PV,EV,AC,BAC,Currency','2026-09-30,1,1,1,5,SAR','2026-08-31,1,1,1,5,SAR'].join('\n'));
  await upload(base,project,'Cost_Report_Rev2.csv',['As Of,PV,EV,AC,BAC,Currency','2026-07-31,1,1,1,5,SAR'].join('\n'));
  const state=(runtimeProjects as any).projects.get(project);
  const family=state.evidenceDocuments.find((d:any)=>d.documentId===first.documentId).familyKey;
  const reason=state.activeEvidenceBasis[family].reason as string;
  assert.match(reason,/No single report date was found inside Cost_Report_Rev1\.csv/);
  assert.match(reason,/not confirmed by the document content/);
  assert.doesNotMatch(reason,/explicit revision number/,'a file-name revision is not called explicit');
 });
});
