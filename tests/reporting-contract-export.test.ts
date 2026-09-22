import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {buildModuleWorkbook,buildModuleJsonDownload} from '../packages/runtime-api/src/module-report';

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
