import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src';
function model(multi=false,external=false){
 const rows=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name','%R\t1\tFirst',...(multi?['%R\t2\tSecond']:[]),
 '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_type','%R\t100\t1\tA\tTT_Task','%R\t101\t1\tB\tTT_Task',...(multi?['%R\t100\t2\tC\tTT_Task']:[]),
 '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type','%R\t9\t101\t100\t\t'+(external?'99':'')+'\tPR_FS','%E'];
 return canonicalScheduleFromXer(parseXerBytes(Buffer.from(rows.join('\n'))),{sourceRevisionId:'source'});
}
test('single-project links without project fields attach to their unique native tasks',()=>{
 const r=model().relationships[0]!;
 assert.equal(r.predecessorActivityId,'A');assert.equal(r.successorActivityId,'B');assert.equal(r.external,false);
});
test('missing link project fields never guess across multiple projects',()=>{
 const r=model(true).relationships[0]!;
 assert.ok(r.predecessorActivityId.startsWith('native:'));assert.ok(r.successorActivityId.startsWith('native:'));
});
test('explicit external project references are not rebound to internal tasks',()=>{
 const r=model(false,true).relationships[0]!;
 assert.equal(r.predecessorActivityId,'native:99::100');assert.equal(r.external,true);
});
