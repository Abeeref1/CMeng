import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src';
import {calculateCpm} from '../packages/schedule-cpm/src';

// 13 Nov 2026, DMCC-UPD2 (Approved Baseline R03 A, P6 24.7, 25,630 activities):
// CMeng's own finish was 29 Jan 2028 against P6's 29 Nov 2027 11:00, and 2,335
// activities differed by more than 14 days, on an unprogressed baseline.
// Running CMeng's reader and CPM on the real file found three causes, each
// pinned here on a small programme of the same shape:
//  1. P6 24.x writes "Calendar for scheduling Relationship Lag" in the
//     SCHEDOPTIONS table. CMeng read only PROJECT, found nothing and counted
//     lags on the successor calendar instead of the stated predecessor one.
//  2. A zero lag rolled the event to the next working time of the lag
//     calendar, and a finish milestone was placed at the next morning instead
//     of the close of the working period (11:00 on a short day, or 14:00 on a
//     Ramadan day before the Eid holidays).
//  3. An FF finish falling on a day the successor does not work stayed on
//     that nonworking day; P6 places it at the successor's next working time.
// And float: the file states "use project end date for float", so P6 counts
// total float to the Must Finish By (29 Nov 17:00), not to 11:00.
// After the fix the real file gives P6's dates exactly: finish 29 Nov 2027
// 11:00, every start and finish of 25,629 activities, every total float.

const pad=(n:number)=>String(n).padStart(2,'0');
type Cal={id:string;workDays:number[];startHour:number;hours:number;short?:Record<string,[number,number]>;holidays?:string[]};
const MON_FRI:Cal={id:'5D',workDays:[1,2,3,4,5],startHour:8,hours:8};
const MON_SAT:Cal={id:'6D',workDays:[1,2,3,4,5,6],startHour:8,hours:8,short:{'2027-11-29':[8,11]}};
const SEVEN:Cal={id:'7D',workDays:[0,1,2,3,4,5,6],startHour:8,hours:8};
const serial=(iso:string)=>(Date.parse(iso+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;
function calendarData(c:Cal){
  const shift=(from:number,to:number)=>'(0||0(s|'+pad(from)+':00|f|'+pad(to)+':00)())';
  const days=[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(c.workDays.includes(d-1)?shift(c.startHour,c.startHour+c.hours):'')+'))').join('');
  const exceptions=[
    ...Object.entries(c.short??{}).map(([iso,[from,to]],i)=>'(0||'+i+'(d|'+serial(iso)+')('+shift(from,to)+'))'),
    ...(c.holidays??[]).map((iso,i)=>'(0||'+(100+i)+'(d|'+serial(iso)+')())'),
  ].join('');
  return '(0||CalendarData()((0||DaysOfWeek()('+days+'))(0||Exceptions()('+exceptions+'))))';
}
type Act={code:string;cal:string;type?:'TT_Task'|'TT_FinMile';hours:number;start:string;finish:string;float:number};
// Activities without predecessors start at the data date, so each case sets it.
function xer(input:{dataDate?:string;acts:Act[];links:Array<[string,string,'PR_FS'|'PR_SS'|'PR_FF',number]>;lagOn?:'project'|'options'|'both'|'none';floatOption?:'Y'|'N'|null;calendars?:Cal[]}):Buffer{
  const lagOn=input.lagOn??'options';
  const projectLag=lagOn==='project'?'rcal_Predecessor':lagOn==='both'?'rcal_Successor':'';
  const optionLag=lagOn==='options'||lagOn==='both'?'rcal_Predecessor':'';
  const cals=input.calendars??[MON_FRI,MON_SAT,SEVEN];
  const id=(code:string)=>String(1000+input.acts.findIndex(a=>a.code===code));
  return Buffer.from(['ERMHDR\t24.7',
    '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date\tplan_start_date\tplan_end_date\tscd_end_date\tclndr_id\tsched_calendar_on_relationship_lag',
    '%R\t1499\tP183-TEST\t'+(input.dataDate??'2027-11-01 00:00')+'\t'+(input.dataDate??'2027-11-01 00:00')+'\t2027-11-29 17:00\t2027-11-29 11:00\t7D\t'+projectLag,
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    ...cals.map(c=>['%R',c.id,c.id,c.hours,c.hours*c.workDays.length,calendarData(c)].join('\t')),
    '%T\tSCHEDOPTIONS','%F\tschedoptions_id\tproj_id\tsched_calendar_on_relationship_lag\tsched_use_project_end_date_for_float',
    '%R\t1\t1499\t'+optionLag+'\t'+(input.floatOption===undefined?'Y':input.floatOption??''),
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t70\t1499\t\tP183\tTest',
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct',
    ...input.acts.map(a=>['%R',id(a.code),1499,70,a.cal,a.code,a.code,a.type??'TT_Task','TK_NotStart',a.start,a.finish,a.start,a.finish,a.hours,a.hours,a.float,0].join('\t')),
    '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\tpred_proj_id',
    ...input.links.map(([pred,succ,type,lag],i)=>['%R',800+i,id(succ),id(pred),type,lag,1499,1499].join('\t')),
    '%E'].join('\n'));
}
const read=(bytes:Buffer)=>canonicalScheduleFromXer(parseXerBytes(bytes),{sourceRevisionId:'parity'});
const run=(bytes:Buffer)=>{const model=read(bytes);return {model,cpm:calculateCpm(model,{applySourceConstraints:true})};};
const row=(cpm:ReturnType<typeof calculateCpm>,id:string)=>cpm.activities.find(a=>a.activityId===id)!;
const at=(iso:string|null|undefined)=>iso?.slice(0,16);

// A Mon-Fri task finishes Fri 05 Nov 16:00; a 7-day successor waits 16 lag hours.
// On the predecessor calendar (stated): Mon 08 and Tue 09 -> starts Wed 10 08:00.
// On the successor calendar (old fallback): Sat 06 and Sun 07 -> starts Mon 08 08:00.
const lagCase=(lagOn:'project'|'options'|'both'|'none')=>xer({lagOn,acts:[
  {code:'P',cal:'5D',hours:40,start:'2027-11-01 08:00',finish:'2027-11-05 16:00',float:0},
  {code:'S',cal:'7D',hours:8,start:'2027-11-10 08:00',finish:'2027-11-10 16:00',float:0},
],links:[['P','S','PR_FS',16]]});

test('1. the lag calendar stated in SCHEDOPTIONS (P6 24.x) is read and used',()=>{
  const {model,cpm}=run(lagCase('options'));
  assert.equal(model.relationshipLagCalendar?.rule,'predecessor');
  assert.equal(model.relationshipLagCalendar?.sourceValue,'rcal_Predecessor');
  assert.equal(model.relationshipLagCalendar?.sourceRef,'XER SCHEDOPTIONS.sched_calendar_on_relationship_lag');
  assert.equal(at(row(cpm,'S').earlyStartIso),'2027-11-10T08:00','16 lag hours on the Mon-Fri predecessor calendar');
  // A value on PROJECT is the project's own and is read first.
  assert.equal(read(lagCase('project')).relationshipLagCalendar?.sourceRef,'XER PROJECT.sched_calendar_on_relationship_lag');
  assert.equal(read(lagCase('both')).relationshipLagCalendar?.rule,'successor');
  // Stated nowhere: unchanged fallback (successor calendar), and it says so.
  const none=run(lagCase('none'));
  assert.equal(none.model.relationshipLagCalendar,undefined);
  assert.equal(at(row(none.cpm,'S').earlyStartIso),'2027-11-08T08:00');
});

test('2. a finish milestone stays at the close of the working period (short day, and before a holiday)',()=>{
  // DMCC: the last task ends Mon 29 Nov at 11:00, the close of a short day on its
  // Mon-Sat calendar; the finish milestone is 29 Nov 11:00 in P6 (was 30 Nov 08:00).
  const {cpm}=run(xer({dataDate:'2027-11-22 00:00',acts:[
    {code:'T',cal:'6D',hours:51,start:'2027-11-22 08:00',finish:'2027-11-29 11:00',float:0},
    {code:'FINISH',cal:'6D',type:'TT_FinMile',hours:0,start:'2027-11-29 11:00',finish:'2027-11-29 11:00',float:0},
  ],links:[['T','FINISH','PR_FS',0]]}));
  assert.equal(at(row(cpm,'T').earlyFinishIso),'2027-11-29T11:00');
  assert.equal(at(row(cpm,'FINISH').earlyStartIso),'2027-11-29T11:00');
  assert.equal(at(row(cpm,'FINISH').earlyFinishIso),'2027-11-29T11:00');
  assert.equal(at(cpm.projectFinishIso),'2027-11-29T11:00','the project finish equals P6 scd_end_date');
  // A lag ending exactly at the close of the last day before holidays keeps the
  // milestone on that day (DMCC: 8 Mar 14:00, not 13 Mar after Eid).
  const eid:Cal={...MON_SAT,short:{},holidays:['2027-11-06','2027-11-08','2027-11-09']};
  const before=run(xer({calendars:[MON_FRI,eid,SEVEN],acts:[
    {code:'A',cal:'5D',hours:8,start:'2027-11-01 08:00',finish:'2027-11-01 16:00',float:0},
    {code:'M',cal:'6D',type:'TT_FinMile',hours:0,start:'2027-11-05 16:00',finish:'2027-11-05 16:00',float:0},
  ],links:[['A','M','PR_FS',32]]}));
  assert.equal(at(row(before.cpm,'M').earlyFinishIso),'2027-11-05T16:00','not Wed 10 08:00 after the holidays');
  // A milestone reached in nonworking time still moves to the next working time.
  const weekend=run(xer({dataDate:'2027-11-07 00:00',acts:[
    {code:'W',cal:'7D',hours:8,start:'2027-11-07 08:00',finish:'2027-11-07 16:00',float:0},
    {code:'N',cal:'5D',type:'TT_FinMile',hours:0,start:'2027-11-08 08:00',finish:'2027-11-08 08:00',float:0},
  ],links:[['W','N','PR_FS',0]]}));
  assert.equal(at(row(weekend.cpm,'N').earlyFinishIso),'2027-11-08T08:00','Sunday 16:00 is not a Mon-Fri working time');
});

test('3. an FF finish on a day the successor does not work moves to its next working time',()=>{
  // DMCC CN-T3-ST-05-SOS-1000: predecessor (Mon-Sat) finishes Sat 17:00; the 8 h
  // Mon-Fri successor finishes Mon 08:00 in P6 and starts Fri 08:00.
  const {cpm}=run(xer({dataDate:'2027-11-05 00:00',acts:[
    {code:'PRE',cal:'6D',hours:16,start:'2027-11-05 08:00',finish:'2027-11-06 16:00',float:0},
    {code:'POST',cal:'5D',hours:8,start:'2027-11-05 08:00',finish:'2027-11-08 08:00',float:0},
  ],links:[['PRE','POST','PR_FF',0]]}));
  assert.equal(at(row(cpm,'POST').earlyFinishIso),'2027-11-08T08:00');
  assert.equal(at(row(cpm,'POST').earlyStartIso),'2027-11-05T08:00');
});

test('4. float counts to the Must Finish By when the programme says so, and only then',()=>{
  const programme=(floatOption:'Y'|'N'|null)=>xer({dataDate:'2027-11-22 00:00',floatOption,acts:[
    {code:'T',cal:'6D',hours:51,start:'2027-11-22 08:00',finish:'2027-11-29 11:00',float:0},
    {code:'OPEN',cal:'7D',hours:8,start:'2027-11-22 08:00',finish:'2027-11-22 16:00',float:0},
  ],links:[]});
  const yes=run(programme('Y'));
  assert.deepEqual(yes.model.projectEndDateForFloat,{value:true,sourceValue:'Y',sourceRef:'XER SCHEDOPTIONS.sched_use_project_end_date_for_float'});
  assert.equal(at(yes.cpm.latePassFinishIso),'2027-11-29T17:00','backward pass from PROJECT.plan_end_date');
  assert.equal(row(yes.cpm,'T').totalFloatHours,0,'its calendar closes at 11:00 that day');
  const no=run(programme('N'));
  assert.equal(at(no.cpm.latePassFinishIso),'2027-11-29T11:00','backward pass from the calculated finish');
  assert.equal((row(yes.cpm,'OPEN').totalFloatHours??0)-(row(no.cpm,'OPEN').totalFloatHours??0),5,'11:00 to 16:00 on the 7-day calendar');
  assert.equal(run(programme(null)).model.projectEndDateForFloat,undefined,'not stated: nothing assumed');
});
