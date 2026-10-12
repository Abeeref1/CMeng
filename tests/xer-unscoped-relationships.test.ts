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

test('existing retained schedules receive link repairs without a new upload',async t=>{
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {createHash}=await import('node:crypto');
 const {refreshStoredXerCalendars}=await import('../packages/runtime-api/src/refresh-xer-calendars');
 const dir=mkdtempSync(join(tmpdir(),'cmeng-existing-links-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const bytes=Buffer.from(['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name','%R\t1\tFirst','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_type','%R\t100\t1\tA\tTT_Task','%R\t101\t1\tB\tTT_Task','%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type','%R\t9\t101\t100\tPR_FS','%E'].join('\n'));
 const fresh=canonicalScheduleFromXer(parseXerBytes(bytes),{sourceRevisionId:'stored'}),saved=structuredClone(fresh);
 saved.relationships[0]!.predecessorActivityId='native:::100';saved.relationships[0]!.successorActivityId='native:::101';
 const activities=structuredClone(saved.activities),sourceHashSha256=createHash('sha256').update(bytes).digest('hex'),storedPath=join(dir,'schedule.xer');writeFileSync(storedPath,bytes);
 const state:any={projectId:'P',schedules:[{format:'xer',sourceHashSha256,calendarReaderVersion:'p6-record-separators-v2-dated-reconciliation',revision:{revisionId:'stored',model:saved}}],evidenceDocuments:[{linkedArtifactId:'stored',sourceHashSha256,storedPath,diagnostics:[]} ]};
 assert.equal(refreshStoredXerCalendars(state),true);assert.deepEqual(saved.relationships,fresh.relationships);assert.deepEqual(saved.activities,activities);
 assert.equal(state.schedules[0].calendarReadRefresh.repairedRelationshipCount,1);assert.equal(refreshStoredXerCalendars(state),false);
});
