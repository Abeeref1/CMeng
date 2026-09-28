import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {PDFParse} from 'pdf-parse';
import {buildModuleWorkbook,buildModuleJsonDownload,exportModuleReport} from '../packages/runtime-api/src/module-report';

test('report exports retain large populations and all contract fields without oversized Excel cells',async()=>{
 const members=Array.from({length:4000},(_,i)=>'LONG-SOURCE-ACTIVITY-'+String(i).padStart(5,'0'));
 const fields=Object.fromEntries(Array.from({length:1300},(_,i)=>['metric_'+i,i]));
 const result={key:'near-critical',status:'partial' as const,reason:'fixture',dependencies:[],data:{reportingContract:{dataDateIso:'2031-04-15',populations:{eligible:{populationId:'synthetic-population',denominator:members.length,memberIds:members,exclusions:[]}},metricContracts:fields}}};
 const json=JSON.parse(buildModuleJsonDownload('EXPORT-BOUNDARY','near-critical',result).toString());
 assert.deepEqual(json.result.data,result.data);
 const bytes=await buildModuleWorkbook('EXPORT-BOUNDARY','near-critical',result),book=new ExcelJS.Workbook();
 await book.xlsx.load(bytes as any);
 const known=new Set(members);let found=0,maximumCell=0,lastContractField=false;
 for(const sheet of book.worksheets)sheet.eachRow(row=>row.eachCell(cell=>{
   if(typeof cell.value==='string'){
     maximumCell=Math.max(maximumCell,cell.value.length);
     if(known.has(cell.value))found++;
     if(cell.value==='reportingContract.metricContracts.metric_1299')lastContractField=true;
   }
 }));
 assert.equal(found,members.length);assert.ok(maximumCell<=32767);assert.equal(lastContractField,true);
});


test('JSON report preserves the exact page route key used by the live page',()=>{
 const result={key:'progress-report',status:'ready' as const,reason:null,dependencies:[],data:{value:17}};
 const json=JSON.parse(buildModuleJsonDownload('CLIENT-PROJECT','progress-report',result).toString());
 assert.equal(json.result.key,'progress-report');
 assert.equal(json.result.legacyKey,'progress-report');
 assert.deepEqual(json.result.data,result.data);
 assert.equal(json.report.moduleKey,'progress-status');
});


test('module report preview definition drives Excel PDF Word CSV Power BI and JSON consistently',async()=>{
 const result={key:'near-critical',status:'partial' as const,reason:'Scoped recovery review',dependencies:[],data:{projectVersion:7,dataDateIso:'2031-04-15',
   rows:[{name:'A',value:1,state:'known'},{name:'B',value:2,state:'known'}],
   secondary:[{name:'C',value:99,state:'other'}],unknownValue:null,knownZero:0}};
 const view={title:'Selected page report',subtitle:'Only the first table',includeAuthorities:['table-0'],sectionOrder:['table-0'],includeCharts:[],includeTables:['module-table-0'],includeMetrics:[],chartTypes:{},chartLimits:{},layout:'standard',detailLevel:'normal' as const};
 const jsonOutput=await exportModuleReport('PARITY','near-critical',result,'json',view),json=JSON.parse(jsonOutput.bytes.toString());
 assert.equal(json.presentation.title,'Selected page report');assert.deepEqual(json.sections.map((section:any)=>section.authorityId),['table-0']);
 assert.deepEqual(json.sections[0].metrics,[]);assert.deepEqual(json.sections[0].charts,[]);assert.equal(json.sections[0].tables[0].id,'module-table-0');assert.equal(json.sections[0].tables[0].rows.length,2);
 assert.equal(JSON.stringify(json).includes('"value":99'),false,'hidden secondary section must not leak into structured export');
 assert.equal(JSON.stringify(json).includes('"knownZero":0'),false,'hidden KPI section must stay hidden rather than silently returning all metrics');

 const excel=await exportModuleReport('PARITY','near-critical',result,'xlsx',view),book=new ExcelJS.Workbook();await book.xlsx.load(excel.bytes as any);
 assert.ok(book.worksheets.some(sheet=>sheet.name.includes('rows')));assert.equal(book.worksheets.some(sheet=>sheet.name.includes('secondary')),false);
 const dataSheet=book.worksheets.find(sheet=>sheet.name.includes('rows'))!;const values=dataSheet.getSheetValues().flat(2);assert.ok(values.includes('A'));assert.ok(values.includes(1));assert.ok(values.includes('B'));assert.ok(values.includes(2));assert.equal(values.includes(99),false);

 const pdf=await exportModuleReport('PARITY','near-critical',result,'pdf',view),parser=new PDFParse({data:pdf.bytes as any});const pdfText=(await parser.getText()).text;await parser.destroy();
 assert.match(pdfText,/Selected page report/);assert.match(pdfText,/Only the first table/);assert.doesNotMatch(pdfText,/secondary/i);

 const word=await exportModuleReport('PARITY','near-critical',result,'docx',view),docx=await JSZip.loadAsync(word.bytes),document=await docx.file('word/document.xml')!.async('string');
 assert.match(document,/Selected page report/);assert.match(document,/Only the first table/);assert.doesNotMatch(document,/secondary/i);

 for(const format of ['csv','powerbi'] as const){
   const output=await exportModuleReport('PARITY','near-critical',result,format,view),zip=await JSZip.loadAsync(output.bytes),embedded=JSON.parse(await zip.file('analysis.json')!.async('string'));
   assert.deepEqual(embedded.sections,json.sections,format+' must use the exact same selected semantic sections');
 }
});
