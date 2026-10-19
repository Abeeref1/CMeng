import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src/adapters';

// T02 / R1: every XER column is read into a field or listed as unused with a
// sample, and activity codes (type and value) reach the activity model.
// Expected values are written by hand from the fixture below.
const xer=['ERMHDR\t23.12',
 '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCODES\t2026-01-05 08:00',
 '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tearly_start_date\tearly_end_date\tlocation_tag',
 '%R\t10\t1\tA100\tPour slab L2\tTT_Task\tTK_NotStart\t16\t2026-01-05 08:00\t2026-01-06 16:00\tZone B',
 '%T\tACTVTYPE','%F\tactv_code_type_id\tactv_code_type','%R\t5\tArea',
 '%T\tACTVCODE','%F\tactv_code_id\tactv_code_type_id\tshort_name\tactv_code_name','%R\t50\t5\tL2\tLevel 2',
 '%T\tTASKACTV','%F\ttask_id\tactv_code_type_id\tactv_code_id\tproj_id','%R\t10\t5\t50\t1',
 '%T\tUDFVALUE','%F\tudf_type_id\tfk_id\tudf_text','%R\t7\t10\tPackage P-04',
 '%E'].join('\n');

test('T02 R1 XER activity codes reach the activity: code type and value per activity',()=>{
 const model=canonicalScheduleFromXer(parseXerBytes(new TextEncoder().encode(xer)),{sourceRevisionId:'r1',projectId:'CODES'});
 const activity=model.activities.find(a=>a.activityId==='A100')!;
 assert.deepEqual(activity.activityCodes,[{typeName:'Area',value:'L2',description:'Level 2'}]);
});

test('T02 R1 every XER table column is listed as read or unused with its sample, not only TASK/TASKPRED/PROJWBS',()=>{
 const model=canonicalScheduleFromXer(parseXerBytes(new TextEncoder().encode(xer)),{sourceRevisionId:'r1',projectId:'CODES'});
 const audit=model.sourceColumnAudit!;
 const entry=(table:string,header:string)=>audit.find(c=>c.table===table&&c.sourceHeader===header);
 assert.equal(entry('TASK','task_code')?.mappingState,'schema_recognized');
 assert.equal(entry('TASK','location_tag')?.mappingState,'unused','an unread TASK column is listed, never dropped');
 assert.equal(entry('TASK','location_tag')?.sample,'Zone B');
 assert.equal(entry('UDFVALUE','udf_text')?.mappingState,'unused','tables outside TASK/TASKPRED/PROJWBS are listed too');
 assert.equal(entry('UDFVALUE','udf_text')?.sample,'Package P-04');
 assert.equal(entry('ACTVCODE','short_name')?.mappingState,'schema_recognized');
 assert.equal(entry('TASKACTV','actv_code_id')?.mappingState,'schema_recognized');
 for(const table of ['PROJECT','TASK','ACTVTYPE','ACTVCODE','TASKACTV','UDFVALUE'])assert.ok(audit.some(c=>c.table===table),table+' columns audited');
});
