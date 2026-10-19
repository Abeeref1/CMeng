import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {parsePrimaveraXml} from '../packages/primavera-xml-parser/src';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromPrimaveraXml,canonicalScheduleFromXer,type CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {calculateCpm} from '../packages/schedule-cpm/src';
import {RuntimeProjectStore,runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {reportingState} from '../packages/runtime-api/src/reporting-state';
import {completionDelayCalendar} from '../packages/runtime-api/src/completion-delay-calendar';
import {attachProjectFloatWorkingDays} from '../packages/runtime-api/src/activity-float-reconciliation';
import {readSnapshotJson,writeSnapshotJson} from '../packages/runtime-api/src/snapshot-json';
import {P6XML_CALENDAR_READER_VERSION} from '../packages/runtime-api/src/refresh-xer-calendars';
process.env.CMENG_OCR_ENABLED='0';

// SW-13 / R1 (round 12): the P6 XML reader reads each Calendar's working time
// (StandardWorkWeek: StandardWorkHours per DayOfWeek with WorkTime Start /
// Finish; HolidayOrExceptions: dates with or without WorkTime) into the same
// P6 calendar model the XER reader produces, and links each Activity's
// CalendarObjectId (or the project's ActivityDefaultCalendarObjectId).
//
// One small programme is written twice, as XER and as P6 XML, with the same
// three calendars:
//   501 Mon-Fri 08:00-16:00 (8 h), holiday Wed 13 Jan 2027;
//   601 Sat-Thu 07:00-17:00 (10 h), Friday off, holiday Sun 10 Jan 2027;
//   701 7 days, 24 h.
// The P6 XML is written the way P6 writes it: a period's Finish is its last
// minute (08:00:00 to 15:59:00 is 08:00-16:00), a holiday is one 00:00 to
// 23:59 period or a nil WorkTime, a non-working weekday has a nil WorkTime.
// Activity G states no CalendarObjectId in the XML: it takes the project
// default activity calendar 501, which is its XER clndr_id.
// Durations and lags in the XML use the reader's numeric P6 XML duration
// convention (milliseconds; tests/primavera-xml.test.ts), so both files state
// the same hours.
//
// Both files go through the real upload path. The CMeng CPM dates and floats,
// and the working-day delay figures, must be identical for both formats and
// equal the independent solver tools/independent/cpm-solver.cjs.
//
// Hand check of the working-day delay figures (baseline finish to current
// finish on the activity's own calendar):
//   B (501) Mon 04 16:00 -> Wed 06 16:00 = 16 h = 2 working days;
//   C (501) Tue 12 16:00 -> Thu 14 16:00 = 8 h = 1 working day (Wed 13 is the holiday; 2 elapsed days);
//   D (601) Sat 09 17:00 -> Tue 12 16:00 = Mon 10 h + Tue 9 h = 1.9 working days (Sun 10 holiday);
//   F (701) Thu 14 04:00 -> Sat 16 04:00 = 48 h = 2 working days;
//   G (501) Tue 12 16:00 -> Fri 15 16:00 = 16 h = 2 working days;
//   B start slippage: planned Tue 29 Dec 08:00 -> actual Wed 30 Dec 08:00 = 8 h = 1 working day.

const requireCjs=createRequire(__filename);
const {solve}=requireCjs(resolve(process.cwd(),'tools/independent/cpm-solver.cjs'));

type Cal={id:string;name:string;workDays:number[];startHour:number;hoursPerDay:number;holidays:string[];nilHolidays?:boolean};
const CALS:Cal[]=[
  {id:'501',name:'Mon-Fri 8h',workDays:[1,2,3,4,5],startHour:8,hoursPerDay:8,holidays:['2027-01-13']},
  {id:'601',name:'Sat-Thu 10h',workDays:[6,0,1,2,3,4],startHour:7,hoursPerDay:10,holidays:['2027-01-10'],nilHolidays:true},
  {id:'701',name:'7 day 24h',workDays:[0,1,2,3,4,5,6],startHour:0,hoursPerDay:24,holidays:[]},
];
type Act={id:string;oid:string;cal:string;type:'task'|'finish_milestone';status:'completed'|'in_progress'|'not_started';original:number;remaining:number;
  baseline:[string,string];current:[string,string];actual?:[string,string|null];pct:number;xmlNoCalendar?:boolean;name?:string};
const ACTS:Act[]=[
  {id:'A',oid:'9001',cal:'501',type:'task',status:'completed',original:16,remaining:0,baseline:['2026-12-28 08:00','2026-12-29 16:00'],current:['2026-12-28 08:00','2026-12-29 16:00'],actual:['2026-12-28 08:00','2026-12-29 16:00'],pct:100},
  {id:'B',oid:'9002',cal:'501',type:'task',status:'in_progress',original:40,remaining:24,baseline:['2026-12-29 08:00','2027-01-04 16:00'],current:['2026-12-30 08:00','2027-01-06 16:00'],actual:['2026-12-30 08:00',null],pct:40},
  {id:'C',oid:'9003',cal:'501',type:'task',status:'not_started',original:40,remaining:40,baseline:['2027-01-06 08:00','2027-01-12 16:00'],current:['2027-01-07 08:00','2027-01-14 16:00'],pct:0},
  {id:'D',oid:'9004',cal:'601',type:'task',status:'not_started',original:30,remaining:30,baseline:['2027-01-06 07:00','2027-01-09 17:00'],current:['2027-01-07 16:00','2027-01-12 16:00'],pct:0},
  {id:'E',oid:'9005',cal:'601',type:'task',status:'not_started',original:20,remaining:20,baseline:['2027-01-07 07:00','2027-01-09 17:00'],current:['2027-01-09 16:00','2027-01-12 16:00'],pct:0},
  {id:'F',oid:'9006',cal:'701',type:'task',status:'not_started',original:36,remaining:36,baseline:['2027-01-12 16:00','2027-01-14 04:00'],current:['2027-01-14 16:00','2027-01-16 04:00'],pct:0},
  {id:'G',oid:'9007',cal:'501',type:'task',status:'not_started',original:16,remaining:16,baseline:['2027-01-11 08:00','2027-01-12 16:00'],current:['2027-01-14 08:00','2027-01-15 16:00'],pct:0,xmlNoCalendar:true},
  {id:'H',oid:'9008',cal:'701',type:'task',status:'not_started',original:24,remaining:24,baseline:['2027-01-09 17:00','2027-01-10 17:00'],current:['2027-01-12 16:00','2027-01-13 16:00'],pct:0},
  {id:'M',oid:'9009',name:'Practical Completion',cal:'501',type:'finish_milestone',status:'not_started',original:0,remaining:0,baseline:['2027-01-12 16:00','2027-01-12 16:00'],current:['2027-01-15 16:00','2027-01-15 16:00'],pct:0},
];
const LINKS:Array<{pred:string;succ:string;type:'FS'|'SS'|'FF';lag:number}>=[
  {pred:'A',succ:'B',type:'FS',lag:0},{pred:'B',succ:'C',type:'FS',lag:0},{pred:'B',succ:'D',type:'FS',lag:10},{pred:'D',succ:'E',type:'SS',lag:10},
  {pred:'C',succ:'F',type:'FS',lag:0},{pred:'C',succ:'G',type:'FF',lag:8},{pred:'E',succ:'H',type:'FS',lag:0},{pred:'G',succ:'M',type:'FS',lag:0},{pred:'C',succ:'M',type:'FS',lag:0},
];
const DATA_DATE='2027-01-04 08:00';
// The approved baseline: the same network, not started, on its planned dates.
const BASELINE_DATE='2026-12-28 08:00';
const asBaseline=(a:Act):Act=>{const {actual:_none,...rest}=a;return {...rest,status:'not_started',remaining:a.original,current:a.baseline,pct:0};};
const programme=(baseline:boolean)=>({dataDate:baseline?BASELINE_DATE:DATA_DATE,acts:baseline?ACTS.map(asBaseline):ACTS});
const pad=(n:number)=>String(n).padStart(2,'0');

function xerFile(baseline=false):Buffer{
  const {dataDate,acts}=programme(baseline);
  const calendarData=(c:Cal)=>{
    const shift='(0||0(s|'+pad(c.startHour)+':00|f|'+pad(c.startHour+c.hoursPerDay)+':00)())';
    const days=[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(c.workDays.includes(d-1)?shift:'')+'))').join('');
    const exceptions=c.holidays.map((iso,i)=>'(0||'+i+'(d|'+(Date.parse(iso+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000+')())').join('');
    return '(0||CalendarData()((0||DaysOfWeek()('+days+'))(0||Exceptions()('+exceptions+'))))';
  };
  const xerType=(a:Act)=>a.type==='finish_milestone'?'TT_FinMile':'TT_Task';
  const xerStatus=(a:Act)=>a.status==='completed'?'TK_Complete':a.status==='in_progress'?'TK_Active':'TK_NotStart';
  return Buffer.from(['ERMHDR\t23.12',
    '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date\tclndr_id','%R\t45\tXCAL\t'+dataDate+'\t501',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    ...CALS.map(c=>['%R',c.id,c.name,c.hoursPerDay,c.hoursPerDay*c.workDays.length,calendarData(c)].join('\t')),
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t70\t45\t\tXCAL\tCalendar programme',
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tphys_complete_pct',
    ...acts.map(a=>['%R',a.oid,45,70,a.cal,a.id,a.name??'Activity '+a.id,xerType(a),xerStatus(a),a.baseline[0],a.baseline[1],a.current[0],a.current[1],a.actual?.[0]??'',a.actual?.[1]??'',a.original,a.remaining,a.pct].join('\t')),
    '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\tpred_proj_id',
    ...LINKS.map((l,i)=>['%R',800+i,ACTS.find(a=>a.id===l.succ)!.oid,ACTS.find(a=>a.id===l.pred)!.oid,'PR_'+l.type,l.lag,45,45].join('\t')),
    '%E'].join('\n'));
}

const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function xmlFile(baseline=false):Buffer{
  const {dataDate,acts}=programme(baseline);
  const t=(value:string)=>value.replace(' ','T')+':00';
  const ms=(hours:number)=>String(hours*3600000);
  const lastMinute=(hour:number)=>pad(hour-1)+':59:00';
  const calendar=(c:Cal)=>'<Calendar><BaseCalendarObjectId xsi:nil="true"/><HoursPerDay>'+c.hoursPerDay+'</HoursPerDay><HoursPerWeek>'+c.hoursPerDay*c.workDays.length+'</HoursPerWeek>'+
    '<IsDefault>false</IsDefault><Name>'+c.name+'</Name><ObjectId>'+c.id+'</ObjectId><Type>Global</Type><StandardWorkWeek>'+
    DAY_NAMES.map((day,d)=>'<StandardWorkHours><DayOfWeek>'+day+'</DayOfWeek>'+(c.workDays.includes(d)
      ?'<WorkTime><Start>'+pad(c.startHour)+':00:00</Start><Finish>'+lastMinute(c.startHour+c.hoursPerDay)+'</Finish></WorkTime>':'<WorkTime xsi:nil="true"/>')+'</StandardWorkHours>').join('')+
    '</StandardWorkWeek><HolidayOrExceptions>'+c.holidays.map(iso=>'<HolidayOrException><Date>'+iso+'T00:00:00</Date>'+
      (c.nilHolidays?'<WorkTime xsi:nil="true"/>':'<WorkTime><Start>00:00:00</Start><Finish>23:59:00</Finish></WorkTime>')+'</HolidayOrException>').join('')+
    '</HolidayOrExceptions></Calendar>';
  const xmlType=(a:Act)=>a.type==='finish_milestone'?'Finish Milestone':'Task Dependent';
  const xmlStatus=(a:Act)=>a.status==='completed'?'Completed':a.status==='in_progress'?'In Progress':'Not Started';
  const activity=(a:Act)=>'<Activity><ProjectObjectId>4501</ProjectObjectId><ObjectId>'+a.oid+'</ObjectId><Id>'+a.id+'</Id><Name>'+(a.name??'Activity '+a.id)+'</Name>'+
    '<WBSObjectId>7001</WBSObjectId>'+(a.xmlNoCalendar?'':'<CalendarObjectId>'+a.cal+'</CalendarObjectId>')+'<Type>'+xmlType(a)+'</Type><Status>'+xmlStatus(a)+'</Status>'+
    '<PlannedStartDate>'+t(a.baseline[0])+'</PlannedStartDate><PlannedFinishDate>'+t(a.baseline[1])+'</PlannedFinishDate>'+
    '<StartDate>'+t(a.current[0])+'</StartDate><FinishDate>'+t(a.current[1])+'</FinishDate>'+
    (a.actual?.[0]?'<ActualStartDate>'+t(a.actual[0])+'</ActualStartDate>':'')+(a.actual?.[1]?'<ActualFinishDate>'+t(a.actual[1])+'</ActualFinishDate>':'')+
    '<PlannedDuration>'+ms(a.original)+'</PlannedDuration><RemainingDuration>'+ms(a.remaining)+'</RemainingDuration><PhysicalPercentComplete>'+a.pct+'</PhysicalPercentComplete></Activity>';
  const typeName={FS:'Finish to Start',SS:'Start to Start',FF:'Finish to Finish'};
  const relationship=(l:typeof LINKS[number])=>'<Relationship><PredecessorProjectObjectId>4501</PredecessorProjectObjectId><SuccessorProjectObjectId>4501</SuccessorProjectObjectId>'+
    '<PredecessorActivityObjectId>'+ACTS.find(a=>a.id===l.pred)!.oid+'</PredecessorActivityObjectId><SuccessorActivityObjectId>'+ACTS.find(a=>a.id===l.succ)!.oid+'</SuccessorActivityObjectId>'+
    '<Type>'+typeName[l.type]+'</Type><Lag>'+ms(l.lag)+'</Lag></Relationship>';
  return Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'+
    CALS.map(calendar).join('')+
    '<Project><ActivityDefaultCalendarObjectId>501</ActivityDefaultCalendarObjectId><DataDate>'+t(dataDate)+'</DataDate><Id>XCAL</Id><Name>Calendar programme</Name><ObjectId>4501</ObjectId>'+
    '<WBS><Code>XCAL</Code><Name>Calendar programme</Name><ObjectId>7001</ObjectId><ParentObjectId>4501</ParentObjectId><ProjectObjectId>4501</ProjectObjectId></WBS>'+
    acts.map(activity).join('')+LINKS.map(relationship).join('')+'</Project></APIBusinessObjects>','utf8');
}

function independent(){
  const iso=(value:string)=>value.replace(' ','T')+':00Z';
  return solve({dataDate:iso(DATA_DATE),calendars:CALS.map(c=>({id:c.id,workDays:c.workDays,startHour:c.startHour,hoursPerDay:c.hoursPerDay,holidays:c.holidays})),
    activities:ACTS.map(a=>({id:a.id,calendar:a.cal,duration:a.original,...(a.status==='in_progress'?{remaining:a.remaining}:{}),
      ...(a.actual?.[0]?{actualStart:iso(a.actual[0])}:{}),...(a.actual?.[1]?{actualFinish:iso(a.actual[1])}:{})})),
    relationships:LINKS.map(l=>({pred:l.pred,succ:l.succ,type:l.type,lag:l.lag}))});
}

const withoutRefs=(model:CanonicalScheduleModel)=>model.calendars.map(({sourceRefs:_ignored,...calendar})=>calendar);

test('P6 XML calendar working time reads into the same calendar model as the XER calendar',()=>{
  const xer=canonicalScheduleFromXer(parseXerBytes(xerFile()),{sourceRevisionId:'x',projectId:'XCAL'});
  const xml=canonicalScheduleFromPrimaveraXml(parsePrimaveraXml(xmlFile()),{sourceRevisionId:'x',projectId:'XCAL'});
  assert.equal(xml.calendars.length,3);
  assert.ok(xml.calendars.every(c=>c.semanticComplete),JSON.stringify(xml.diagnostics));
  assert.deepEqual(withoutRefs(xml),withoutRefs(xer),'same weekly intervals, exceptions, day and week hours, conversion factors and names');
  const five=xml.calendars.find(c=>c.calendarId==='501')!;
  assert.deepEqual(five.weeklyWorkMinutes,[0,480,480,480,480,480,0]);
  assert.deepEqual(five.weeklyWorkIntervals!.find(d=>d.dayIndex===2)!.intervals,[{start:'08:00',finish:'16:00',minutes:480}],'P6 Finish 15:59 is the end of the 15:59 minute');
  assert.deepEqual(five.exceptions,[{isoDate:'2027-01-13',nonWorking:true,workIntervals:[]}],'a one-period 00:00 to 23:59 exception is the P6 holiday form');
  assert.deepEqual(xml.calendars.find(c=>c.calendarId==='601')!.exceptions,[{isoDate:'2027-01-10',nonWorking:true,workIntervals:[]}],'a nil WorkTime exception is a holiday');
  assert.deepEqual(xml.calendars.find(c=>c.calendarId==='701')!.weeklyWorkMinutes,[1440,1440,1440,1440,1440,1440,1440],'Finish 23:59 is the end of the day');
  assert.equal(five.standardDayHours,8);assert.equal(five.sourceConversionDayHours,8);assert.equal(five.sourceConversionWeekHours,40);
  assert.deepEqual(five.sourceRefs,[{source:'primavera_xml',locator:'Calendar:501'}]);
  assert.deepEqual(xml.activities.map(a=>[a.activityId,a.calendarId]),xer.activities.map(a=>[a.activityId,a.calendarId]),'every activity linked to its calendar');
  const g=xml.activities.find(a=>a.activityId==='G')!;
  assert.ok(g.diagnostics.includes('P6XML_ACTIVITY_CALENDAR_FROM_PROJECT_DEFAULT:501'),'the project default calendar link is labelled');
  assert.ok(!xml.activities.find(a=>a.activityId==='C')!.diagnostics.some(d=>d.startsWith('P6XML_ACTIVITY_CALENDAR_FROM_PROJECT_DEFAULT')));
});

test('P6 XML calendar faults stay unknown: unread pattern, bad times and an absent default calendar are never guessed',()=>{
  const read=(calendar:string,activityCalendar='<CalendarObjectId>1</CalendarObjectId>',project='')=>canonicalScheduleFromPrimaveraXml(parsePrimaveraXml(Buffer.from(
    '<APIBusinessObjects><Project><ObjectId>10</ObjectId><Id>P</Id>'+project+'<Activity><ProjectObjectId>10</ProjectObjectId><ObjectId>2</ObjectId><Id>A</Id>'+activityCalendar+'</Activity></Project>'+calendar+'</APIBusinessObjects>')),{sourceRevisionId:'f'});
  const week=(time:string)=>'<StandardWorkWeek>'+DAY_NAMES.map(d=>'<StandardWorkHours><DayOfWeek>'+d+'</DayOfWeek>'+time+'</StandardWorkHours>').join('')+'</StandardWorkWeek>';
  const noPattern=read('<Calendar><ObjectId>1</ObjectId><Name>5 Day</Name><HoursPerDay>8</HoursPerDay></Calendar>');
  assert.equal(noPattern.calendars[0]!.semanticComplete,false,'no StandardWorkWeek: working time not established');
  assert.ok(noPattern.diagnostics.includes('CALENDAR_SEMANTICS_UNRESOLVED:1:CALENDAR_DATA_AND_BASE_BOTH_MISSING'));
  assert.equal(calculateCpm(noPattern,{allowElapsedFallback:false}).complete,false);
  const bad=read('<Calendar><ObjectId>1</ObjectId>'+week('<WorkTime><Start>08:00:00</Start><Finish>08:00:00</Finish></WorkTime>')+'</Calendar>');
  assert.equal(bad.calendars[0]!.semanticComplete,false);
  assert.ok(bad.diagnostics.some(d=>d.startsWith('CALENDAR_SEMANTICS_UNRESOLVED:1:CALENDAR_INTERVAL_INVALID')));
  const shortWeek=read('<Calendar><ObjectId>1</ObjectId><StandardWorkWeek><StandardWorkHours><DayOfWeek>Monday</DayOfWeek><WorkTime><Start>08:00:00</Start><Finish>16:00:00</Finish></WorkTime></StandardWorkHours></StandardWorkWeek></Calendar>');
  assert.equal(shortWeek.calendars[0]!.semanticComplete,false,'six weekdays not stated: never assumed non-working or 8 hours');
  assert.deepEqual(shortWeek.calendars[0]!.weeklyWorkIntervals,[{dayIndex:2,intervals:[{start:'08:00',finish:'16:00',minutes:480}]}],'a stated whole-minute Finish is read as stated');
  const full=read('<Calendar><ObjectId>1</ObjectId>'+week('<WorkTime><Start>08:00:00</Start><Finish>15:59:00</Finish></WorkTime>')+'</Calendar>','',
    '<ActivityDefaultCalendarObjectId>77</ActivityDefaultCalendarObjectId>');
  assert.equal(full.activities[0]!.calendarId,null,'a default calendar that is not in the file is not linked');
  const linked=read('<Calendar><ObjectId>1</ObjectId>'+week('<WorkTime><Start>08:00:00</Start><Finish>15:59:00</Finish></WorkTime>')+'</Calendar>','',
    '<ActivityDefaultCalendarObjectId>1</ActivityDefaultCalendarObjectId>');
  assert.equal(linked.activities[0]!.calendarId,'1');
});

async function upload(projectId:string,extension:'xer'|'xml',file:(baseline?:boolean)=>Buffer,mediaType:string){
  runtimeProjects.getOrCreate(projectId);
  await runtimeProjects.ingestSchedule({projectId,sourceFilename:'calendar programme baseline.'+extension,bytes:file(true),mediaType,uploadedAt:'2026-12-28T09:00:00Z',
    role:'baseline',roleConfirmed:true,approvalReference:'XCAL-BL-01',uploadIntent:'replace_current_basis'});
  const name='calendar programme update.'+extension;
  await runtimeProjects.ingestSchedule({projectId,sourceFilename:name,bytes:file(),mediaType,uploadedAt:'2027-01-04T09:00:00Z',role:'update',uploadIntent:'replace_current_basis'});
  const state=runtimeProjects.get(projectId)!;
  const model=projectControlSchedule(reportingState(state))?.revision.model;
  assert.ok(model,'uploaded programme is the current programme: '+name);
  return {state,model:model!};
}

test('the same programme uploaded as XER and as P6 XML: CMeng CPM dates, floats and working-day delays are identical and equal the independent solver',async()=>{
  const XER='XCAL-XER-'+process.pid,XML='XCAL-XML-'+process.pid;
  const x=await upload(XER,'xer',xerFile,'text/plain');
  const p=await upload(XML,'xml',xmlFile,'application/xml');
  assert.equal(p.model.dataDateIso?.slice(0,16),'2027-01-04T08:00','the update is the current programme');
  assert.equal(p.model.activities.find(a=>a.activityId==='C')!.baselineDateBasis,'controlled_baseline','baseline dates from the approved P6 XML baseline');
  assert.equal(p.model.source,'primavera_xml');
  const solver=independent();
  const solved=new Map<string,any>(solver.activities.map((a:any)=>[a.id,a]));
  const same=(a:string|null|undefined,b:string|null|undefined)=>a!=null&&b!=null&&Date.parse(a)===Date.parse(b);

  // 1. The CMeng CPM on the Independent Forecast page.
  const forecastOf=(projectId:string)=>moduleForProject(projectId,'independent-forecast').data as any;
  const fx=forecastOf(XER),fp=forecastOf(XML);
  for(const [label,f] of [['XER',fx],['P6 XML',fp]] as const){
    assert.equal(f.origin,'deterministic_source_calendar',label+' CPM on the source calendars');
    assert.ok(same(f.independentForecastCompletionIso,solver.projectFinish),label+' completion '+f.independentForecastCompletionIso+' = solver '+solver.projectFinish);
    for(const a of ACTS.filter(a=>a.status!=='completed')){
      const row=f.activities.find((r:any)=>r.activityId===a.id),s=solved.get(a.id);
      assert.ok(row,label+' '+a.id);
      assert.equal(row.calendarMode,'source_calendar',label+' '+a.id+' on its own source calendar');
      assert.ok(same(row.independentEarlyStartIso,s.earlyStart),label+' '+a.id+' early start '+row.independentEarlyStartIso+' = '+s.earlyStart);
      assert.ok(same(row.independentEarlyFinishIso,s.earlyFinish),label+' '+a.id+' early finish '+row.independentEarlyFinishIso+' = '+s.earlyFinish);
      assert.equal(row.independentTotalFloatHours,s.totalFloatHours,label+' '+a.id+' total float');
      assert.equal(row.critical,s.critical,label+' '+a.id+' critical');
    }
  }
  assert.deepEqual(withoutRefs(p.model),withoutRefs(x.model),'the stored P6 XML programme carries the same calendars as the XER');
  assert.equal(p.state.schedules.at(-1)!.calendarReaderVersion,P6XML_CALENDAR_READER_VERSION);
  assert.deepEqual([...fp.criticalActivityIds].sort(),[...fx.criticalActivityIds].sort());
  assert.deepEqual([...fp.criticalActivityIds].sort(),solver.criticalIds);
  const pick=(f:any)=>f.activities.map((r:any)=>[r.activityId,r.independentEarlyStartIso,r.independentEarlyFinishIso,r.independentTotalFloatHours,r.critical,r.calendarMode]);
  assert.deepEqual(pick(fp),pick(fx),'identical CPM rows for both formats');

  // 2. Late dates of the same CMeng CPM on the stored programmes.
  const cpm=(model:CanonicalScheduleModel)=>calculateCpm(model,{allowElapsedFallback:false,assumeMissingLagZero:false,assumeUnknownRelationshipTypeFs:false});
  const cx=cpm(x.model),cp=cpm(p.model);
  assert.equal(cp.complete,true);
  const late=(r:ReturnType<typeof cpm>)=>r.activities.map(a=>[a.activityId,a.calendarMode,a.earlyStartIso,a.earlyFinishIso,a.lateStartIso,a.lateFinishIso,a.totalFloatHours,a.critical]);
  assert.deepEqual(late(cp),late(cx));
  for(const a of cp.activities.filter(a=>a.status==='calculated')){
    const s=solved.get(a.activityId);if(!s||s.status==='completed')continue;
    assert.ok(same(a.lateStartIso,s.lateStart),a.activityId+' late start '+a.lateStartIso+' = '+s.lateStart);
    assert.ok(same(a.lateFinishIso,s.lateFinish),a.activityId+' late finish '+a.lateFinishIso+' = '+s.lateFinish);
  }

  // 3. Working-day delay figures on the activity analytics page, through the
  // same shared step the server applies to every screen and download.
  const rowsOf=(projectId:string)=>new Map<string,any>(((attachProjectFloatWorkingDays(runtimeProjects.get(projectId),moduleForProject(projectId,'activity-analytics').data) as any).rows as any[]).map(r=>[r.activityId,r]));
  const rx=rowsOf(XER),rp=rowsOf(XML);
  const FIELDS=['finishVarianceDays','finishVarianceWorkingDays','finishVarianceDaysBasis','startOverdueWorkingDays','finishOverdueWorkingDays',
    'startSlippageCalendarDays','startSlippageWorkingDays','startSlippageDaysBasis','independentTotalFloatHours','independentTotalFloatWorkingDays','remainingDurationWorkingDays','floatDaysBasis'];
  for(const a of ACTS){
    const ox=rx.get(a.id),op=rp.get(a.id);
    assert.ok(ox&&op,a.id+' on the activity analytics page');
    for(const field of FIELDS)assert.deepEqual(op[field],ox[field],a.id+' '+field);
  }
  const wd=(id:string)=>rp.get(id).finishVarianceWorkingDays;
  assert.deepEqual(['B','C','D','F','G'].map(wd),[2,1,1.9,2,2],'hand-checked working-day finish delays');
  assert.equal(rp.get('C').finishVarianceDays,2,'2 elapsed days, 1 working day: the holiday is not worked');
  assert.equal(rp.get('C').finishVarianceDaysBasis,'source_activity_calendar');
  assert.equal(rp.get('B').startSlippageWorkingDays,1);
  assert.equal(rp.get('D').independentTotalFloatWorkingDays,solved.get('D').totalFloatDays,'float in working days of the 10-hour calendar');

  // 4. Completion delay calendar: the completion milestone's own calendar.
  const kx=completionDelayCalendar(x.model,fx),kp=completionDelayCalendar(p.model,fp);
  assert.equal(kp.basis,'completion_milestone_calendar');
  assert.equal(kp.calendarId,'501');
  assert.deepEqual({...kp,calendar:kp.calendar?.calendarId},{...kx,calendar:kx.calendar?.calendarId});
});

test('a P6 XML programme stored before this reader gets its calendars from the retained source on restart; activity data and identities unchanged',async t=>{
  const root=mkdtempSync(join(tmpdir(),'cmeng-xml-calendar-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:root,durable:true});
  await store.ingestSchedule({projectId:'XMLCAL',bytes:xmlFile(),sourceFilename:'calendar programme.xml',mediaType:'application/xml',role:'update',uploadedAt:'2027-01-04T09:00:00Z',uploadIntent:'replace_current_basis'});
  new RuntimeProjectStore({dataDir:root,durable:true});
  const file=store.persistenceStatus().stateFile;
  const snapshot=readSnapshotJson<any>(file),project=snapshot.projects.find((p:any)=>p.projectId==='XMLCAL');
  const stored=project.schedules[0],fresh=structuredClone(stored.revision.model);
  // The stored shape of a P6 XML programme read before round 12.
  delete stored.calendarReaderVersion;
  stored.revision.model.calendars=[];
  stored.revision.model.diagnostics=stored.revision.model.diagnostics.filter((d:string)=>!d.startsWith('CALENDAR_'));
  const g=stored.revision.model.activities.find((a:any)=>a.activityId==='G');
  g.calendarId=null;g.diagnostics=g.diagnostics.filter((d:string)=>!d.startsWith('P6XML_ACTIVITY_CALENDAR_FROM_PROJECT_DEFAULT'));
  const before=structuredClone(stored.revision.model);
  writeSnapshotJson(file,snapshot);

  const restored=new RuntimeProjectStore({dataDir:root,durable:true}).get('XMLCAL')!;
  const s=restored.schedules[0]!,model=s.revision.model;
  assert.equal(s.calendarReaderVersion,P6XML_CALENDAR_READER_VERSION);
  assert.deepEqual(model.calendars,fresh.calendars,'calendars read from the retained source');
  assert.ok(model.calendars.every(c=>c.semanticComplete));
  assert.equal(s.calendarReadRefresh!.linkedActivityCalendarCount,1);
  assert.equal(s.calendarReadRefresh!.resolvedCalendarCount,3);
  assert.deepEqual(model.activities,fresh.activities,'only the unestablished calendar link is filled');
  assert.deepEqual(model.activities.map(a=>({...a,calendarId:null,diagnostics:[]})),before.activities.map((a:any)=>({...a,calendarId:null,diagnostics:[]})),'activity dates, durations and identities unchanged');
  assert.deepEqual(model.relationships,before.relationships);
  assert.equal(s.revision.revisionId,stored.revision.revisionId);
  assert.equal(calculateCpm(model,{allowElapsedFallback:false}).complete,true);
  const again=new RuntimeProjectStore({dataDir:root,durable:true}).get('XMLCAL')!;
  assert.equal(again.version,restored.version,'second restart is idempotent');
});
