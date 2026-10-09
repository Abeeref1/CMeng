import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src';
import {calculateCpm} from '../packages/schedule-cpm/src';

const dated=[
 ['A','2026-09-14 08:00','2026-09-18 16:00',40],
 ['B','2026-09-18 08:00','2026-09-21 16:00',16],
 ['C','2026-09-21 08:00','2026-09-28 16:00',48],
 ['D','2026-09-23 08:00','2026-09-29 16:00',40],
 ['E','2026-10-05 08:00','2026-10-09 16:00',40]
] as const;
function schedule(weekHours=40,withIntervals=false,onlyTwo=false){
 const clndr=withIntervals
 ? '(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(i=>
   '(0||'+i+'()('+([2,3,4,5,6].includes(i)?'(0||0(s|08:00|f|16:00)())':'')+'))').join('')+'))(0||Exceptions()())))'
 : '';
 const fields=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date',
 '%R\t1\tP6-CALENDAR\t2026-09-14 08:00','%T\tPROJWBS','%F\twbs_id\tproj_id',
 '%R\t10\t1','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
 '%R\t9\tWork Pattern\t8\t'+weekHours+'\t'+clndr,
 '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_type\tstatus_code\tremain_drtn_hr_cnt\tearly_start_date\tearly_end_date',
 ...(onlyTwo?dated.slice(0,2):dated).map(([id,start,finish,hours],index)=>
 '%R\t'+(index+1)+'\t1\t10\t9\t'+id+'\tTT_Task\tTK_NotStart\t'+hours+'\t'+start+'\t'+finish),
 '%E'];
 return parseXerBytes(Buffer.from(fields.join('\n')));
}
test('P6 date-duration evidence reconstructs an otherwise absent unique work pattern without promoting it as independent source time',()=>{
 const model=canonicalScheduleFromXer(schedule(),{sourceRevisionId:'DATED'});
 const c=model.calendars.find(row=>row.calendarId==='9')!;
 assert.equal(c.semanticComplete,true);
 assert.equal(c.reconciledFromP6Dates,true);
 assert.equal(c.standardWeekHours,40);
 assert.deepEqual(c.weeklyWorkMinutes,[0,480,480,480,480,480,0]);
 assert.ok(model.diagnostics.some(d=>d.startsWith('CALENDAR_P6_DATE_RECONCILIATION_QUALIFIED:9')));
 const first={...model,activities:[model.activities.find(a=>a.activityId==='A')!],relationships:[]};
 const recalculated=calculateCpm(first,{projectStartIso:'2026-09-14T08:00:00',allowElapsedFallback:false});
 assert.equal(recalculated.complete,true);
 assert.equal(recalculated.projectFinishIso?.slice(0,16),'2026-09-18T16:00');
 assert.ok(recalculated.assumptions.some(a=>a.startsWith('CALENDAR_P6_DATE_RECONCILIATION_QUALIFIED')));
});
test('insufficient or contradictory source evidence never invents a working calendar',()=>{
 for(const result of [schedule(40,false,true),schedule(42)]){
  const model=canonicalScheduleFromXer(result,{sourceRevisionId:'NO_INFERENCE'});
  assert.equal(model.calendars[0]!.semanticComplete,false);
  assert.equal(model.calendars[0]!.reconciledFromP6Dates,false);
 }
});
test('native P6 weekly working periods are authoritative ahead of inferred patterns',()=>{
 const model=canonicalScheduleFromXer(schedule(40,true),{sourceRevisionId:'NATIVE'});
 assert.equal(model.calendars[0]!.semanticComplete,true);
 assert.equal(model.calendars[0]!.reconciledFromP6Dates,false);
});
