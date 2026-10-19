import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {exportModuleReport} from '../packages/runtime-api/src/module-report';
import {publicModuleResult} from '../packages/runtime-api/src/registry';
import {pageProjectResponse} from '../packages/runtime-api/src/response-paging';
import {readablePathLabel} from '../packages/runtime-api/src/field-labels';

// T10 X1/X2: the page response and its report.json / report.xlsx downloads,
// compared by the same checker used in CI (scripts/verify-download-parity.cjs).
const parity=require(join(__dirname,'..','..','scripts','verify-download-parity.cjs'));

function moduleFixture(key:string){
  const rows=Array.from({length:60},(_,i)=>({activityId:'A'+i,name:'Work '+i,totalFloatHours:i%9,status:i%4===0?'completed':'not_started'}));
  return {key,status:'ready' as const,reason:'Current programme position.',dependencies:[],data:{
    reportingContract:{dataDateIso:'2031-04-15',metricContracts:{'summary.openCount':{unit:'activities',state:'calculated',authority:'calculated',dataDateIso:'2031-04-15'}}},
    dataDateIso:'2031-04-15',programmeRevisionId:'REV-3',
    summary:{openCount:45,completedCount:15},
    // A commercial ledger nests its register counts eight levels below data.
    position:{sourceLedger:{registerScopes:{payments:{asOf:{summary:{counts:{recordCount:7,reconciledBalanceCount:3}}}}}}},
    rows,
  }};
}
async function downloads(key:string,result:any){
  const screen=pageProjectResponse(publicModuleResult(result,key),'/api/projects/T10-P/schedule/modules/'+key) as any;
  const json=JSON.parse((await exportModuleReport('T10-P',key,result,'json')).bytes.toString('utf8'));
  const xlsx=await exportModuleReport('T10-P',key,result,'xlsx');
  const parts=await parity.workbookParts(xlsx.bytes);
  return {screen,json,parts};
}

test('X2: every figure on the page is in report.json with the same value and every table has its full population',async()=>{
  const result=moduleFixture('near-critical'),{screen,json}=await downloads('near-critical',result);
  assert.ok(screen.responsePaging.tables.some((t:any)=>t.pointer==='/data/rows'&&t.total===60&&t.shown<60),'the page previews the 60-row table');
  assert.deepEqual(parity.compareScreenWithJson(screen,json),[]);
});

test('X2: milestone page counts of the whole population are in both downloads',async()=>{
  const result=moduleFixture('milestones');
  result.data.rows=result.data.rows.map((row:any,i:number)=>({...row,status:i%4===0?'completed':'open',managementPriority:i%10===0?'critical':'normal'}));
  const {screen,json,parts}=await downloads('milestones',result);
  assert.ok(screen.data.milestoneFullCounts,'the page shows full milestone counts');
  assert.deepEqual(json.result.data.milestoneFullCounts,screen.data.milestoneFullCounts);
  assert.deepEqual(parity.compareScreenWithJson(screen,json),[]);
  const label=readablePathLabel('milestoneFullCounts.openCount');
  assert.ok(parts.summaryRows.some(([l,v]:any)=>l===label&&v===screen.data.milestoneFullCounts.openCount),label+' is in the workbook');
});

test('X2: the workbook states the data date, programme revision and scope, and keeps deep headline figures',async()=>{
  const result=moduleFixture('near-critical'),{screen,parts}=await downloads('near-critical',result);
  const row=(label:string)=>parts.summaryRows.find(([l]:any)=>l===label)?.[1];
  assert.equal(row('Data date'),'2031-04-15');
  assert.equal(row('Programme revision'),'REV-3');
  assert.match(String(row('Scope')),/T10-P/);
  assert.equal(row(readablePathLabel('position.sourceLedger.registerScopes.payments.asOf.summary.counts.recordCount')),7,'a figure nested eight levels deep is not replaced by "[nested data]"');
  assert.deepEqual(parity.compareScreenWithWorkbook(screen,parts.summaryRows,parts.headers,readablePathLabel),[]);
});

test('X1: workbook labels and column headings are reader words, with units where the page declares them',async()=>{
  const result=moduleFixture('near-critical'),{parts}=await downloads('near-critical',result);
  const labels=parts.summaryRows.map(([l]:any)=>l).filter((l:any)=>typeof l==='string');
  assert.equal(labels.some((l:string)=>/^[a-z]+[A-Z]\w*(?:\.\w+)*$/.test(l)||/^[a-z]\w*\.\w/.test(l)),false,'no data path or field name as a label (W1)');
  assert.ok(labels.includes('Summary · open count'));
  assert.ok(parts.headers.includes('Total float hours')&&parts.headers.includes('Activity ID'),'column headings are reader words');
  assert.equal(parts.headers.some((h:string)=>/^[a-z]+[A-Z]/.test(h)),false);
  const result2=moduleFixture('near-critical'),xlsx=await exportModuleReport('T10-P','near-critical',result2,'xlsx');
  const ExcelJS=(await import('exceljs')).default,book=new ExcelJS.Workbook();await book.xlsx.load(xlsx.bytes as any);
  let unit:unknown=null;book.getWorksheet('Report')!.eachRow(r=>{if(r.getCell(1).value==='Summary · open count')unit=r.getCell(3).value;});
  assert.equal(unit,'activities','the unit declared by the reporting contract is carried');
});
