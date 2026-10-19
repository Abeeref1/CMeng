import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parsePrimaveraXml} from '../packages/primavera-xml-parser/src';
import {parseScheduleCsv,parseScheduleXlsx} from '../packages/schedule-tabular-parser/src';
import {canonicalScheduleFromPrimaveraXml,canonicalScheduleFromTabular} from '../packages/schedule-analysis-core/src/adapters';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';

// T02 / R1: every programme column, in every programme format, is read into a
// field or listed as unused with its name and a sample. Expected values are
// written by hand from the fixtures below.
type Audit={table:string;sourceHeader:string;mappingState:string;sample?:string|null}[];
const entry=(audit:Audit|undefined,header:string)=>audit?.find(c=>c.sourceHeader===header);

test('T02 R1 P6 XML: unread Activity fields are listed as unused with a sample; read fields are recognised',()=>{
 const xml=`<?xml version="1.0" encoding="UTF-8"?>
 <APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V1">
  <Project><ObjectId>10</ObjectId><Id>P88</Id><Name>Project 88</Name></Project>
  <WBS><ObjectId>100</ObjectId><ProjectObjectId>10</ProjectObjectId><Code>1.1</Code></WBS>
  <Calendar><ObjectId>500</ObjectId><Name>5 Day</Name></Calendar>
  <Activity><ProjectObjectId>10</ProjectObjectId><ObjectId>1000</ObjectId><Id>A100</Id><Name>Excavation</Name>
   <WBSObjectId>100</WBSObjectId><CalendarObjectId>500</CalendarObjectId><OriginalDuration>288000000</OriginalDuration>
   <RemainingDuration>144000000</RemainingDuration><TotalFloat>57600000</TotalFloat><LocationName>Zone B</LocationName></Activity>
 </APIBusinessObjects>`;
 const model=canonicalScheduleFromPrimaveraXml(parsePrimaveraXml(Buffer.from(xml,'utf8')),{sourceRevisionId:'x1',projectId:'P88'});
 const audit=model.sourceColumnAudit as Audit|undefined;
 assert.equal(entry(audit,'Id')?.mappingState,'schema_recognized');
 assert.equal(entry(audit,'CalendarObjectId')?.mappingState,'schema_recognized');
 assert.equal(entry(audit,'LocationName')?.mappingState,'unused','an Activity field CMeng does not read is listed, never dropped');
 assert.equal(entry(audit,'LocationName')?.sample,'Zone B');
});

const header='Activity ID,Activity Name,WBS,Calendar,Original Duration (h),Remaining Duration (h),Total Float (h),Percent Complete,Status,Cost Account';
const rows=['A100,Excavation,1.1,5 Day,80,40,16,50,In Progress,CA-310','A200,Foundation,1.2,5 Day,120,120,-8,0,Not Started,CA-320'];

test('T02 R1 CSV programme: unread columns are listed as unused with a sample; read columns are recognised',()=>{
 const model=canonicalScheduleFromTabular(parseScheduleCsv(Buffer.from([header,...rows].join('\n'),'utf8')),{sourceRevisionId:'c1',projectId:'P1'});
 const audit=model.sourceColumnAudit as Audit|undefined;
 assert.equal(entry(audit,'Activity ID')?.mappingState,'schema_recognized');
 assert.equal(entry(audit,'Cost Account')?.mappingState,'unused');
 assert.equal(entry(audit,'Cost Account')?.sample,'CA-310');
 const dated=canonicalScheduleFromTabular(parseScheduleCsv(Buffer.from([header+',Data Date',...rows.map(r=>r+',2026-01-05')].join('\n'),'utf8')),{sourceRevisionId:'c2',projectId:'P1'});
 assert.equal(entry(dated.sourceColumnAudit as Audit,'Data Date')?.mappingState,'schema_recognized','the data-date column is read by its header text and is not listed as unused');
});

test('T02 R1 xlsx programme: unread columns are listed per sheet as unused with a sample',async()=>{
 const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Programme');
 sheet.addRow(header.split(','));for(const row of rows)sheet.addRow(row.split(','));
 const model=canonicalScheduleFromTabular(await parseScheduleXlsx(new Uint8Array(await book.xlsx.writeBuffer() as ArrayBuffer)),{sourceRevisionId:'x1',projectId:'P1'});
 const audit=model.sourceColumnAudit as Audit|undefined;
 assert.equal(entry(audit,'Activity Name')?.mappingState,'schema_recognized');
 assert.equal(entry(audit,'Cost Account')?.table,'Programme');
 assert.equal(entry(audit,'Cost Account')?.mappingState,'unused');
 assert.equal(entry(audit,'Cost Account')?.sample,'CA-310');
});

test('T02 R1 the column audit and activity codes are saved with the stored schedule revision and survive a reload',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'cmeng-r1-audit-'));
 const calendar='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()((0||0(s|08:00|f|16:00)())))').join('')+'))))';
 const xer=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tR1\t2030-01-01 08:00',
  '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\t1\tEight hour calendar\t8\t56\t'+calendar,
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t100\t1\t\tR1\tProject R1','%R\t110\t1\t100\tSUB\tSubstructure',
  '%T\tACCOUNT','%F\tacct_id\tacct_short_name\tacct_name','%R\t7\tCA-310\tConcrete works',
  '%T\tRSRC','%F\trsrc_id\trsrc_name\trsrc_short_name\trsrc_type','%R\t3\tConcrete gang\tCG\tRT_Labor',
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\tclndr_id\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tearly_start_date\tearly_end_date\tlocation_tag',
  '%R\t10\t1\t110\tA\tFoundation work\tTT_Task\tTK_NotStart\t1\t16\t16\t0\t2030-01-01 08:00\t2030-01-02 16:00\tZone B',
  '%T\tTASKRSRC','%F\ttaskrsrc_id\ttask_id\tproj_id\trsrc_id\tacct_id\ttarget_qty','%R\t900\t10\t1\t3\t7\t16',
  '%T\tACTVTYPE','%F\tactv_code_type_id\tactv_code_type','%R\t5\tArea',
  '%T\tACTVCODE','%F\tactv_code_id\tactv_code_type_id\tshort_name\tactv_code_name','%R\t50\t5\tL2\tLevel 2',
  '%T\tTASKACTV','%F\ttask_id\tactv_code_type_id\tactv_code_id\tproj_id','%R\t10\t5\t50\t1','%E'].join('\n');
 const store=new RuntimeProjectStore({dataDir,durable:false});
 await store.ingestSchedule({projectId:'R1-AUDIT',sourceFilename:'programme.xer',bytes:Buffer.from(xer),mediaType:'text/plain',uploadedAt:'2030-01-01',role:'update',uploadIntent:'replace_current_basis'} as any);
 const reloaded=new RuntimeProjectStore({dataDir,durable:false});
 const state=(reloaded as any).projects.get('R1-AUDIT');
 assert.ok(state,'project reloaded from the stored snapshot');
 const model=state.schedules.at(-1).revision.model;
 const audit=model.sourceColumnAudit as Audit;
 assert.equal(audit.find(c=>c.table==='TASK'&&c.sourceHeader==='location_tag')?.mappingState,'unused');
 assert.equal(audit.find(c=>c.table==='TASK'&&c.sourceHeader==='location_tag')?.sample,'Zone B');
 const activity=model.activities.find((a:any)=>a.activityId==='A');
 assert.deepEqual(activity.sourceActivityCodes,[{codeType:'Area',codeValue:'L2',codeDescription:'Level 2'}]);
 assert.deepEqual(activity.sourceWbsPath,['R1','SUB'],'WBS path from the project root to the activity WBS');
 assert.equal(activity.calendarId,'1');
 assert.deepEqual(activity.sourceResourceAssignments,[{resourceId:'3',resourceName:'Concrete gang',costAccountId:'7',costAccountCode:'CA-310',costAccountName:'Concrete works'}]);
 assert.equal(audit.find(c=>c.table==='TASKRSRC'&&c.sourceHeader==='taskrsrc_id')?.mappingState,'schema_recognized','a column read by the resource reader is not listed as unused');
 assert.equal(audit.find(c=>c.table==='CALENDAR'&&c.sourceHeader==='clndr_data')?.mappingState,'schema_recognized','calendar working time read by the calendar reader is not listed as unused');
});
