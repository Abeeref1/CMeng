import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import ExcelJS from 'exceljs';
import {parseScheduleCsv,parseScheduleXlsx} from '../packages/schedule-tabular-parser/src';
import {canonicalScheduleFromTabular} from '../packages/schedule-analysis-core/src';

const canonical=(parsed:ReturnType<typeof parseScheduleCsv>)=>canonicalScheduleFromTabular(parsed,{sourceRevisionId:'data-date-regression'});
const csv=(dates:string[],headers=['Data Date'])=>Buffer.from([
 ['Activity ID','Activity Name','Original Duration (h)',...headers].join(','),
 ...dates.map((date,index)=>['A'+index,'Work '+index,8,date].join(',')),
].join('\n'));

test('independent reviewer CSV regression retains supplied programme date and row locators',()=>{
 const source=Buffer.from('Project ID,Data Date,Revision,Approval Status,Activity ID,Activity Name,Activity Type,Start,Finish,Duration,Percent Complete,Actual Start,Actual Finish,Total Float,Predecessors\nP,2026-09-30,C1,Approved,A,Foundation,Task,2026-09-01,2026-09-11,10,100,2026-09-01,2026-09-11,5,\nP,2026-09-30,C1,Approved,B,Structure,Task,2026-09-11,2026-10-01,20,50,2026-09-11,,5,A\nP,2026-09-30,C1,Approved,C,Fit out,Task,2026-10-01,2026-10-31,30,0,,,5,B');
 const parsed=parseScheduleCsv(source);
 assert.equal(canonical(parsed).dataDateIso,'2026-09-30');
 assert.equal(parsed.activities.length,3);
 assert.deepEqual(parsed.dataDateValues?.map(v=>v.locator.address),['R2C2','R3C2','R4C2']);
 assert.equal(parsed.activities[0]!.originalDurationHours,null,'Unknown duration unit must remain unresolved');
});

test('ten fresh CSV/XLSX sources retain consistent date aliases without deriving dates from activity starts',async()=>{
 for(let i=0;i<10;i++){
  const token=randomBytes(8).toString('hex');
  const day=1+Number.parseInt(token.slice(0,2),16)%28;
  const expected='2032-06-'+String(day).padStart(2,'0');
  const alias=['Data Date','data_date','Status Date','Current Data Date'][i%4]!;
  const input=csv([expected,expected],[alias]);
  assert.equal(canonical(parseScheduleCsv(input)).dataDateIso,expected);
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Plan-'+token);
  sheet.addRow(['Activity ID','Activity Name','Start','Original Duration (h)',alias]);
  sheet.addRow(['A-'+token,'First','2032-01-01',8,expected]);
  sheet.addRow(['B-'+token,'Second','2032-01-02',8,expected]);
  const parsed=await parseScheduleXlsx(Buffer.from(await book.xlsx.writeBuffer()));
  assert.equal(canonical(parsed).dataDateIso,expected);
  assert.equal(parsed.dataDateValues?.[0]?.locator.address,'E2');
  assert.equal(parsed.dataDateValues?.[0]?.locator.sheet,'Plan-'+token);
 }
});

test('conflicting, invalid, ambiguous and absent dates stay unestablished',()=>{
 for(const dates of [['2032-06-01','2032-06-02'],['2032-06-01','not-a-date'],['03/04/2032','03/04/2032'],['','']]){
  const model=canonical(parseScheduleCsv(csv(dates)));
  assert.equal(model.dataDateIso,null,JSON.stringify(dates));
  if(dates.some(Boolean))assert.ok(model.diagnostics.some(d=>d.startsWith('SCHEDULE_DATA_DATE_')));
 }
 assert.equal(canonical(parseScheduleCsv(csv(['2032-06-01','']))).dataDateIso,'2032-06-01','Blank repeated cell does not contradict an explicit programme date');
});

test('duplicate date columns and repeated activity sections cannot silently override conflicting source dates',()=>{
 const duplicate=parseScheduleCsv(csv(['2032-06-01,2032-06-02'],['Data Date','data_date']));
 assert.equal(duplicate.dataDateValues?.length,2);
 assert.equal(canonical(duplicate).dataDateIso,null);
 const repeated=Buffer.concat([csv(['2032-06-01']),Buffer.from('\n'),csv(['2032-06-02'])]);
 assert.equal(canonical(parseScheduleCsv(repeated)).dataDateIso,null);
});

test('activity date must reconcile with metadata and other worksheets',async()=>{
 const book=new ExcelJS.Workbook(),meta=book.addWorksheet('Metadata');
 meta.addRow(['Field','Value','Field','Value']);
 meta.addRow(['Project','P','Data Date','2032-06-01']);
 meta.addRow(['Revision','U1','Status','Submitted']);
 for(const [name,date] of [['One','2032-06-01'],['Two','2032-06-02']]){
  const sheet=book.addWorksheet(name!);sheet.addRow(['Activity ID','Activity Name','Original Duration (h)','Data Date']);sheet.addRow([name,'Work',8,date]);
 }
 const parsed=await parseScheduleXlsx(Buffer.from(await book.xlsx.writeBuffer()));
 assert.equal(canonical(parsed).dataDateIso,null);
 assert.ok(canonical(parsed).diagnostics.includes('SCHEDULE_DATA_DATE_CONFLICTING'));
 const metadataOnly={...parsed,dataDateValues:[]};
 assert.equal(canonical(metadataOnly).dataDateIso,'2032-06-01');
});
