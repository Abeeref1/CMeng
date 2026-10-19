import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {buildDeliveryWorkbook,deliveryColumnKeys} from '../packages/runtime-api/src/delivery-export';
import {publicModuleResult,titleForModule} from '../packages/runtime-api/src/registry';
import {pageProjectResponse} from '../packages/runtime-api/src/response-paging';
import {readablePathLabel} from '../packages/runtime-api/src/field-labels';
import {numericDistribution} from '../packages/schedule-analysis-core/src/population';

// T10 X1/X2 on delivery downloads and X3 chart-versus-table, with the same
// checker used in CI (scripts/verify-download-parity.cjs).
const parity=require(join(__dirname,'..','..','scripts','verify-download-parity.cjs'));

function deliveryFixture(){
  const rows=Array.from({length:40},(_,i)=>({recordId:'S'+i,status:i%3===0?'closed':'open',requiredOnSite:i===0?null:'2031-05-'+String(1+i%28).padStart(2,'0'),
    ...(i===1?{reviewComment:'Resubmit with revised calculations'}:{})}));
  return {key:'delivery-submittals',status:'partial' as const,reason:'Submittal position from the governed register.',dependencies:[],data:{
    projectionKey:'delivery',deliveryPage:'delivery-submittals',dataDateIso:'2031-04-15',programmeRevisionId:'REV-2',authorityScope:'governed_register',
    summary:{openCount:26,closedCount:14},rows}};
}
async function load(bytes:Buffer){const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as any);return book;}

test('X1: delivery workbook headings are reader words, read back to field keys through the Column keys sheet',async()=>{
  const book=await load(await buildDeliveryWorkbook('T10-D',deliveryFixture() as any));
  const sheet=book.worksheets.find(s=>s.name.endsWith('rows'))!;assert.ok(sheet);
  const headings=(sheet.getRow(1).values as any[]).filter(Boolean);
  assert.ok(headings.includes('Required on site')&&headings.includes('Record ID')&&headings.includes('Row number'));
  assert.equal(headings.some((h:string)=>/^[a-z]+[A-Z]/.test(h)),false,'no camelCase field name as a heading');
  const keys=deliveryColumnKeys(book,sheet.name);
  assert.equal(keys[headings.indexOf('Required on site')+1],'requiredOnSite');
  assert.equal(sheet.rowCount,41,'every record is kept');
});

test('X1: an unknown value uses the screen word and an absent field stays empty; no "Unresolved" filler',async()=>{
  const book=await load(await buildDeliveryWorkbook('T10-D',deliveryFixture() as any));
  const cells:unknown[]=[];for(const s of book.worksheets)s.eachRow(r=>r.eachCell(c=>cells.push(c.value)));
  assert.equal(cells.includes('Unresolved'),false);
  const sheet=book.worksheets.find(s=>s.name.endsWith('rows'))!,keys=deliveryColumnKeys(book,sheet.name);
  const col=(key:string)=>keys.indexOf(key);
  assert.equal(sheet.getRow(2).getCell(col('requiredOnSite')).value,'Not established','record S0 has no required date');
  assert.equal(sheet.getRow(2).getCell(col('reviewComment')).value,null,'record S0 has no review comment field: empty, not "unknown"');
  assert.equal(sheet.getRow(3).getCell(col('reviewComment')).value,'Resubmit with revised calculations');
});

test('X2: delivery workbook carries the page title, data date, programme revision, scope and headline figures',async()=>{
  const result=deliveryFixture(),book=await load(await buildDeliveryWorkbook('T10-D',result as any));
  const parts=await parity.workbookParts(await buildDeliveryWorkbook('T10-D',result as any));
  const row=(label:string)=>parts.summaryRows.find(([l]:any)=>l===label)?.[1];
  assert.equal(row('Page'),titleForModule('delivery-submittals'));
  assert.equal(row('Data date'),'2031-04-15');
  assert.equal(row('Programme revision'),'REV-2');
  assert.match(String(row('Scope')),/T10-D/);
  assert.equal(row(readablePathLabel('summary.openCount')),26);
  const screen=pageProjectResponse(publicModuleResult(result as any,'delivery-submittals'),'/api/projects/T10-D/delivery/modules/delivery-submittals') as any;
  assert.deepEqual(parity.compareScreenWithWorkbook(screen,parts.summaryRows,parts.headers,readablePathLabel),[]);
  assert.ok(book.getWorksheet('Column keys'));
});

test('X3: chart buckets are checked against the population of the table they summarise',()=>{
  const values=[...Array.from({length:30},(_,i)=>i%13),null,null];
  const distribution=numericDistribution(values);
  assert.deepEqual(parity.checkChartTables({data:{finishVariance:{denominator:32,distribution}}}),[],'shared distribution producer is consistent');
  const histogram={knownCount:30,unknownCount:2,groups:[{count:20,lowerHours:0,upperHours:8},{count:9,lowerHours:8,upperHours:16}]};
  const found=parity.checkChartTables({data:{floatHourHistogram:histogram}});
  assert.equal(found.length,1);assert.match(found[0].problem,/histogram bars total 29, table known count 30/);
  const screening={populationCount:12,distributionUnresolvedCount:1,floatDistribution:[{count:5,workingDays:0},{count:5,workingDays:1}]};
  assert.match(parity.checkChartTables({data:{nearCriticalScreening:screening}})[0].problem,/chart buckets 10 \+ unresolved 1, table population 12/);
});
