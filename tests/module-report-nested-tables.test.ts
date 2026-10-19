import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {collectReportArrays,reportArrayRows} from '../packages/runtime-api/src/report-tables';
import {buildModuleWorkbook,buildModuleJsonDownload,exportModuleReport,preparedModuleResult} from '../packages/runtime-api/src/module-report';
import {readablePathLabel} from '../packages/runtime-api/src/field-labels';

const fixture=()=>({key:'quantity-scurve',status:'partial' as const,reason:'Measured item histories remain separate.',dependencies:[],data:{projectionKey:'quantity_scurve',series:Array.from({length:61},(_,i)=>({quantityItemId:'Q'+i,itemNumber:'ITEM-'+i,unit:i%2?'m':'m3',points:[{dateIso:'2026-07-31',actualInstalledQuantity:0},{dateIso:'2026-08-31',actualInstalledQuantity:i===60?null:i+1}],sourceRefs:['SOURCE-'+i]}))}});

test('nested report populations retain every parent, path, zero and null without mutating source',()=>{
 const result=fixture(),before=JSON.stringify(result),sections=collectReportArrays(result.data),points=sections.find(s=>s.path==='series.points')!;
 assert.equal(points.rowCount,122);assert.equal(points.groups.length,61);
 const rows=[...reportArrayRows(points)] as any[];
 assert.equal(rows[120].sourcePointer,'/data/series/60/points/0');assert.equal(rows[120].parentPointer,'/data/series/60');assert.match(rows[120].parentReference,/quantityItemId=Q60/);
 assert.equal(rows[120].record.actualInstalledQuantity,0);assert.equal(rows[121].record.actualInstalledQuantity,null);
 const shared={values:[{sample:1}]};const repeated=collectReportArrays({'a/b~c':[shared,shared]});
 assert.equal(repeated.find(s=>s.path==='a/b~c.values')!.rowCount,2,'shared source objects have distinct parent positions');
 assert.equal(([...reportArrayRows(repeated.find(s=>s.path==='a/b~c.values')!)] as any[])[1].sourcePointer,'/data/a~1b~0c/1/values/0');
 const matrix=collectReportArrays({rows:[[0,null],[2,3]]});assert.equal(matrix.find(s=>s.path==='rows.[]')!.rowCount,4);
 const late={rows:Array.from({length:61},(_,i)=>i===60?{recordId:'LAST',lateOnly:[0,null,false]}:{recordId:'R'+i})};
 const later=collectReportArrays(late).find(s=>s.path==='rows.lateOnly')!;
 assert.equal(later.rowCount,3);assert.deepEqual(([...reportArrayRows(later)] as any[]).map(r=>r.record),[0,null,false]);
 let deep:any={values:['DEEP-LAST']};for(let i=0;i<12;i++)deep={next:deep};assert.equal(collectReportArrays(deep)[0]!.rowCount,1);
 assert.equal(JSON.stringify(result),before);assert.deepEqual(JSON.parse(buildModuleJsonDownload('P','quantity-scurve',result).toString()).result.data,result.data);
});

test('actual workbook and structured report include the last parent history with identifiable ownership',async()=>{
 const result=fixture(),before=JSON.stringify(result),bytes=await buildModuleWorkbook('P','quantity-scurve',result),book=new ExcelJS.Workbook();await book.xlsx.load(bytes as any);
 const sheet=book.getWorksheet('points')!;assert.ok(sheet);assert.equal(sheet.rowCount,123);
 const headers=sheet.getRow(1).values as string[],column=(key:string)=>headers.indexOf(({parentReference:'Parent record',sourcePointer:'Record location'} as Record<string,string>)[key]??readablePathLabel(key));
 assert.ok(column('record.dateIso')>0);assert.ok(column('parentReference')>0);
 assert.equal(sheet.getRow(122).getCell(column('sourcePointer')).value,'/data/series/60/points/0');
 assert.equal(sheet.getRow(122).getCell(column('record.actualInstalledQuantity')).value,0);
 assert.equal(sheet.getRow(123).getCell(column('record.actualInstalledQuantity')).value,null);
 assert.match(String(sheet.getRow(123).getCell(column('parentReference')).value),/itemNumber=ITEM-60/);
 assert.equal(book.getWorksheet('sourceRefs')!.rowCount,62);
 const structured=JSON.parse((await exportModuleReport('P','quantity-scurve',result,'json',{})).bytes.toString());
 const section=structured.sections.find((s:any)=>s.tables.some((t:any)=>t.title==='series.points'));
 assert.equal(section.tables[0].population,122);assert.equal(section.tables[0].rows.at(-1)['record.actualInstalledQuantity'],null);
 assert.equal(section.charts.length,0,'independent parent histories and units must not be merged into one automatic chart');
 assert.equal(JSON.stringify(result),before);
});

test('a report search selects the item while retaining its complete dated history and source references',async()=>{
 const result=fixture(),view={filters:{search:'ITEM-60'}},selected=preparedModuleResult(result,view) as any;
 assert.equal(selected.data.series.length,1);assert.deepEqual(selected.data.series[0],result.data.series[60]);
 const workbook=await exportModuleReport('P','quantity-scurve',result,'json',view),analysis=JSON.parse(workbook.bytes.toString());
 const points=analysis.sections.flatMap((s:any)=>s.tables).find((t:any)=>t.title==='series.points');
 assert.equal(points.population,2);assert.equal(points.rows[0]['record.actualInstalledQuantity'],0);assert.equal(points.rows[1]['record.actualInstalledQuantity'],null);
 assert.equal(result.data.series.length,61);
});

test('streamed worksheets split at Excel row capacity and retain boundary and final records', {timeout:120000}, async()=>{
 const values=new Array(1_048_577).fill('retained');values[1_048_574]='END-FIRST';values[1_048_575]='FIRST-SECOND';values[1_048_576]='LAST-ROW';
 const bytes=await buildModuleWorkbook('LIMIT','progress-report',{key:'progress-report',status:'ready',reason:null,dependencies:[],data:{rows:values}});
 const zip=await JSZip.loadAsync(bytes),names=Object.keys(zip.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n));assert.equal(names.length,3,'summary plus two complete table worksheets');
 const countRows=(xml:string)=>{let count=0;const pattern=/<row\b/g;while(pattern.exec(xml))count++;return count;};
 const first=await zip.file('xl/worksheets/sheet2.xml')!.async('string'),last=await zip.file('xl/worksheets/sheet3.xml')!.async('string');
 assert.equal(countRows(first),1_048_576);assert.equal(countRows(last),3);assert.match(first,/>END-FIRST</);assert.doesNotMatch(first,/>FIRST-SECOND</);assert.match(last,/>FIRST-SECOND</);assert.match(last,/>LAST-ROW</);
 assert.equal(values.length,1_048_577);assert.equal(values.at(-1),'LAST-ROW');
});
