import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXerBytes} from '../packages/xer-parser/src';
import {parsePrimaveraXml} from '../packages/primavera-xml-parser/src';
import {parseScheduleCsv} from '../packages/schedule-tabular-parser/src';
import {
  analyzeScheduleGraph,
  canonicalScheduleFromPrimaveraXml,
  canonicalScheduleFromTabular,
  canonicalScheduleFromXer,
} from '../packages/schedule-analysis-core/src';

// T02 programme-file reading truth. Every fixture is hand made and every
// expected figure below was worked out by hand from the fixture text.

const xer=(lines:string[])=>canonicalScheduleFromXer(parseXerBytes(Buffer.from(['ERMHDR\t23.12',...lines,'%E'].join('\n'))),{sourceRevisionId:'t02'});
const shift=(day:number,intervals:Array<[string,string]>)=>'(0||'+day+'()('+intervals.map(([s,f],i)=>'(0||'+i+'(s|'+s+'|f|'+f+')())').join('')+'))';
const calendarData=(days:Array<Array<[string,string]>>,exceptions:string)=>
  '(0||CalendarData()((0||DaysOfWeek()('+days.map((intervals,i)=>shift(i+1,intervals)).join('')+'))(0||Exceptions()('+exceptions+'))))';

test('calendars: 8, 10 and 24 hour days with holidays are read hour for hour',()=>{
  const eight:Array<[string,string]>=[['08:00','12:00'],['13:00','17:00']];
  const ten:Array<[string,string]>=[['07:00','12:00'],['13:00','18:00']];
  // Index 1 = Sunday ... 7 = Saturday (P6).
  const cal8=calendarData([[],eight,eight,eight,eight,eight,[]],'(0||0(d|45292)())');            // 2024-01-01 holiday
  const cal10=calendarData([ten,ten,ten,ten,ten,[],[]],'(0||0(d|45390)())(0||1(d|45391)((0||0(s|08:00|f|12:00)())))'); // 2024-04-08 holiday, 2024-04-09 4h
  const cal24=calendarData(Array.from({length:7},()=>[['00:00','24:00']] as Array<[string,string]>),'');
  const m=xer(['%T\tPROJECT','%F\tproj_id\tproj_short_name','%R\t1\tP1',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\t10\t5d8h\t8\t40\t'+cal8,'%R\t11\t5d10h\t10\t50\t'+cal10,'%R\t12\t7d24h\t24\t168\t'+cal24,
    '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\tclndr_id\ttask_type','%R\t1\t1\tA\t10\tTT_Task','%R\t2\t1\tB\t11\tTT_Task','%R\t3\t1\tC\t12\tTT_Task']);
  const byId=new Map(m.calendars.map(c=>[c.calendarId,c]));
  assert.deepEqual(byId.get('10')!.weeklyWorkMinutes,[0,480,480,480,480,480,0]);
  assert.equal(byId.get('10')!.standardDayHours,8);assert.equal(byId.get('10')!.standardWeekHours,40);
  assert.deepEqual((byId.get('10')!.exceptions??[]).map(e=>[e.isoDate,e.nonWorking]),[['2024-01-01',true]]);
  assert.deepEqual(byId.get('11')!.weeklyWorkMinutes,[600,600,600,600,600,0,0]);
  assert.equal(byId.get('11')!.standardDayHours,10);assert.equal(byId.get('11')!.standardWeekHours,50);
  assert.deepEqual((byId.get('11')!.exceptions??[]).map(e=>[e.isoDate,e.nonWorking,e.workIntervals.reduce((s,i)=>s+i.minutes,0)]),[['2024-04-08',true,0],['2024-04-09',false,240]]);
  assert.deepEqual(byId.get('12')!.weeklyWorkMinutes,[1440,1440,1440,1440,1440,1440,1440]);
  assert.equal(byId.get('12')!.standardDayHours,24);assert.equal(byId.get('12')!.standardWeekHours,168);
  assert.deepEqual([...byId.values()].map(c=>c.semanticComplete),[true,true,true]);
  assert.deepEqual([...byId.values()].map(c=>c.sourceConversionDayHours),[8,10,24]);
});

test('calendar with no work pattern stays unknown hours, never an assumed 8-hour day',()=>{
  const m=xer(['%T\tPROJECT','%F\tproj_id','%R\t1','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t20\tEmpty\t',
    '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\tclndr_id','%R\t1\t1\tA\t20']);
  assert.equal(m.calendars[0]!.standardDayHours,null);
  assert.equal(m.calendars[0]!.semanticComplete,false);
});

const multiProject=['%T\tPROJECT','%F\tproj_id\tproj_short_name','%R\t1\tP1','%R\t2\tP2',
  '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_type','%R\t100\t1\tA\tTT_Task','%R\t101\t1\tB\tTT_Task','%R\t200\t2\tC\tTT_Task'];

test('R4/SW-09: links whose rows carry no project ID attach by the unique task_id in a multi-project file',()=>{
  const m=xer([...multiProject,'%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type','%R\t1\t101\t100\tPR_FS','%R\t2\t200\t101\tPR_SS']);
  assert.deepEqual(m.relationships.map(r=>[r.relationshipId,r.predecessorActivityId,r.successorActivityId,r.type,r.external]),
    [['1','A','B','FS',false],['2','B','C','SS',false]]);
  const g=analyzeScheduleGraph(m);
  assert.deepEqual(g.brokenPredecessorActivityIds,[]);assert.deepEqual(g.brokenSuccessorActivityIds,[]);
});

test('R4/SW-09: links attach in a single-project file whose TASK rows carry no proj_id',()=>{
  const m=xer(['%T\tPROJECT','%F\tproj_id\tproj_short_name','%R\t1\tP1',
    '%T\tTASK','%F\ttask_id\ttask_code\ttask_type','%R\t100\tA\tTT_Task','%R\t101\tB\tTT_Task',
    '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type','%R\t1\t101\t100\t1\t1\tPR_FS','%R\t2\t101\t100\t\t\tPR_FF']);
  assert.deepEqual(m.relationships.map(r=>[r.predecessorActivityId,r.successorActivityId,r.type]),[['A','B','FS'],['A','B','FF']]);
});

test('R4: ambiguous task_ids, dangling ends and explicit foreign projects are never guessed',()=>{
  const m=xer([...multiProject,'%R\t300\t2\tD\tTT_Task',
    // task_id 101 is unique, but 999 does not exist: neither end is attached by guess.
    '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type',
    '%R\t1\t101\t999\t\t\tPR_FS',
    // explicit foreign predecessor project 99: stays native and external.
    '%R\t2\t101\t100\t1\t99\tPR_FS',
    // explicit successor project 2 for a task of project 1: no rebinding.
    '%R\t3\t101\t200\t2\t2\tPR_FS']);
  const r=new Map(m.relationships.map(x=>[x.relationshipId,x]));
  assert.deepEqual([r.get('1')!.predecessorActivityId,r.get('1')!.successorActivityId],['native:::999','native:::101']);
  assert.deepEqual([r.get('2')!.predecessorActivityId,r.get('2')!.successorActivityId,r.get('2')!.external],['native:99::100','B',true]);
  assert.deepEqual([r.get('3')!.predecessorActivityId,r.get('3')!.successorActivityId],['C','native:2::101']);
});

test('SW-10: duplicate activity IDs across WBS and projects are reported with lines and never matched by a link',()=>{
  const m=xer(['%T\tPROJECT','%F\tproj_id\tproj_short_name','%R\t1\tP1','%R\t2\tP2',
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_type',
    '%R\t100\t1\t7\tA1000\tTT_Task',   // file line 8 (line 1 is ERMHDR)
    '%R\t101\t1\t7\tA1010\tTT_Task',   // line 9
    '%R\t200\t2\t8\tA1000\tTT_Task',   // line 10 (same ID, other project)
    '%R\t102\t1\t9\tA1010\tTT_Task',   // line 11 (same ID, other WBS, same project)
    '%R\t103\t1\t7\tA1020\tTT_Task',   // line 12
    '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type',
    '%R\t1\t101\t100\t1\t1\tPR_FS','%R\t2\t103\t100\t1\t1\tPR_FS']);
  assert.ok(m.diagnostics.includes('XER_DUPLICATE_ACTIVITY_ID:A1000:TASK:line:8|TASK:line:10'));
  assert.ok(m.diagnostics.includes('XER_DUPLICATE_ACTIVITY_ID:A1010:TASK:line:9|TASK:line:11'));
  const r=new Map(m.relationships.map(x=>[x.relationshipId,x]));
  assert.deepEqual([r.get('1')!.predecessorActivityId,r.get('1')!.successorActivityId],['native:1::100','native:1::101']);
  assert.deepEqual(r.get('1')!.diagnostics.sort(),['XER_LINK_ENDPOINT_DUPLICATE_ACTIVITY_ID:A1000','XER_LINK_ENDPOINT_DUPLICATE_ACTIVITY_ID:A1010']);
  assert.deepEqual([r.get('2')!.predecessorActivityId,r.get('2')!.successorActivityId],['native:1::100','A1020']);
  const g=analyzeScheduleGraph(m);
  assert.deepEqual(g.duplicateActivityIds,['A1000','A1010']);assert.equal(g.complete,false);
});

test('SW-16: task_type values map to activity types; missing type stays unknown',()=>{
  const m=xer(['%T\tPROJECT','%F\tproj_id','%R\t1','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_type\ttarget_drtn_hr_cnt',
    '%R\t1\t1\tT1\tTT_Task\t80','%R\t2\t1\tT2\tTT_Mile\t0','%R\t3\t1\tT3\tTT_FinMile\t0','%R\t4\t1\tT4\tTT_LOE\t40',
    '%R\t5\t1\tT5\tTT_WBS\t40','%R\t6\t1\tT6\tTT_Rsrc\t16','%R\t7\t1\tT7\t\t16','%R\t8\t1\tT8\tTT_Unheard\t16']);
  assert.deepEqual(m.activities.map(a=>[a.activityId,a.activityType]),[['T1','task'],['T2','start_milestone'],['T3','finish_milestone'],
    ['T4','level_of_effort'],['T5','wbs_summary'],['T6','task'],['T7','unknown'],['T8','unknown']]);
});

test('SW-16: a schedule sheet Activity Type column is read for every activity (was unknown for all)',()=>{
  const csv=['Activity ID,Activity Name,Activity Type,Original Duration,Start,Finish',
    'A1,Excavate,Task Dependent,5d,2026-01-04,2026-01-08',
    'A2,Handover,Finish Milestone,0d,,2026-01-08',
    'A3,Supervision,Level of Effort,5d,2026-01-04,2026-01-08',
    'A4,Crew,Resource Dependent,2d,2026-01-04,2026-01-05',
    'A5,Notice,Start Milestone,0d,2026-01-04,',
    'A6,Mystery,,3d,2026-01-04,2026-01-06'].join('\n');
  const parsed=parseScheduleCsv(Buffer.from(csv));
  assert.deepEqual(parsed.activities.map(a=>a.activityType??null),['Task Dependent','Finish Milestone','Level of Effort','Resource Dependent','Start Milestone',null]);
  const m=canonicalScheduleFromTabular(parsed,{sourceRevisionId:'t02'});
  assert.deepEqual(m.activities.map(a=>a.activityType),['task','finish_milestone','level_of_effort','task','start_milestone','unknown']);
});

test('statuses: TK_NotStart, TK_Active, TK_Complete; no status and no progress stays unknown',()=>{
  const m=xer(['%T\tPROJECT','%F\tproj_id','%R\t1','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\tstatus_code\tphys_complete_pct\tact_end_date',
    '%R\t1\t1\tS1\tTK_NotStart\t0\t','%R\t2\t1\tS2\tTK_Active\t40\t','%R\t3\t1\tS3\tTK_Complete\t100\t2026-01-05 17:00','%R\t4\t1\tS4\t\t\t']);
  assert.deepEqual(m.activities.map(a=>a.status),['not_started','in_progress','completed','unknown']);
});

test('SW-57: PROJECT scd_end_date, plan_end_date and last_recalc_date are read as separate facts',()=>{
  const m=xer(['%T\tPROJECT','%F\tproj_id\tproj_short_name\tplan_end_date\tscd_end_date\tlast_recalc_date',
    '%R\t1\tP1\t2027-06-30 17:00\t2027-08-12 17:00\t2026-03-01 08:00']);
  assert.equal(m.declaredProjectFinishIso?.slice(0,10),'2027-06-30');
  assert.equal(m.scheduledProjectFinishIso?.slice(0,10),'2027-08-12');
  assert.equal(m.dataDateIso?.slice(0,10),'2026-03-01');
  // Must-finish-by blank: the scheduled finish is still read, the declared one stays unknown.
  const blank=xer(['%T\tPROJECT','%F\tproj_id\tplan_end_date\tscd_end_date\tlast_recalc_date','%R\t1\t\t2027-08-12 17:00\t2026-03-01 08:00']);
  assert.equal(blank.declaredProjectFinishIso,null);assert.equal(blank.scheduledProjectFinishIso?.slice(0,10),'2027-08-12');
});

test('multi-project file: differing data dates stay unknown with a diagnostic; equal ones are kept',()=>{
  const differ=xer(['%T\tPROJECT','%F\tproj_id\tscd_end_date\tlast_recalc_date','%R\t1\t2027-08-12 17:00\t2026-03-01 08:00','%R\t2\t2027-09-01 17:00\t2026-02-01 08:00']);
  assert.equal(differ.dataDateIso,null);assert.equal(differ.scheduledProjectFinishIso,null);
  assert.ok(differ.diagnostics.some(d=>d.startsWith('XER_PROJECT_DATA_DATE_CONFLICT:')));
  const same=xer(['%T\tPROJECT','%F\tproj_id\tlast_recalc_date','%R\t1\t2026-03-01 08:00','%R\t2\t2026-03-01 08:00']);
  assert.equal(same.dataDateIso?.slice(0,10),'2026-03-01');
  assert.ok(!same.diagnostics.some(d=>d.startsWith('XER_PROJECT_DATA_DATE_CONFLICT:')));
});

test('Primavera XML: project data date, scheduled finish and must-finish-by are read; activity types map',()=>{
  const xml=`<?xml version="1.0" encoding="UTF-8"?><APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V1">
  <Project><ObjectId>10</ObjectId><Id>P88</Id><Name>P88</Name><DataDate>2026-03-01T08:00:00</DataDate>
  <ScheduledFinishDate>2027-08-12T17:00:00</ScheduledFinishDate><MustFinishByDate>2027-06-30T17:00:00</MustFinishByDate></Project>
  <Activity><ProjectObjectId>10</ProjectObjectId><ObjectId>1</ObjectId><Id>X1</Id><Name>a</Name><Type>Start Milestone</Type></Activity>
  <Activity><ProjectObjectId>10</ProjectObjectId><ObjectId>2</ObjectId><Id>X2</Id><Name>b</Name><Type>Task Dependent</Type></Activity>
  </APIBusinessObjects>`;
  const m=canonicalScheduleFromPrimaveraXml(parsePrimaveraXml(Buffer.from(xml)),{sourceRevisionId:'t02'});
  assert.equal(m.dataDateIso?.slice(0,10),'2026-03-01');
  assert.equal(m.scheduledProjectFinishIso?.slice(0,10),'2027-08-12');
  assert.equal(m.declaredProjectFinishIso?.slice(0,10),'2027-06-30');
  assert.deepEqual(m.activities.map(a=>a.activityType),['start_milestone','task']);
});
