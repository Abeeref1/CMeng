import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseScheduleCsv} from '../packages/schedule-tabular-parser/src';
import {canonicalScheduleFromTabular} from '../packages/schedule-analysis-core/src';
import {refreshTabularScheduleDates} from '../packages/runtime-api/src/schedule-date-refresh';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

test('retained date recovery preserves original bytes and approval decisions and survives snapshot reload',async()=>{
 const root=mkdtempSync(join(tmpdir(),'schedule-date-restore-'));
 try{
  const bytes=Buffer.from('Activity ID,Activity Name,Original Duration (h),Data Date\nA,Work,8,2031-06-30');
  const path=join(root,'source.csv');writeFileSync(path,bytes);
  const hash=createHash('sha256').update(bytes).digest('hex');
  const original=canonicalScheduleFromTabular(parseScheduleCsv(bytes),{projectId:'DATE-RESTORE',sourceRevisionId:'R1'});
  const activities=original.activities;
  const stored={revision:{revisionId:'R1',sequence:1,label:'Source',effectiveAt:'2031-07-01',model:{...original,dataDateIso:null}},format:'schedule_csv',sourceHashSha256:hash,uploadedAt:'2031-07-01',role:'baseline',roleConfirmed:false};
  const state={projectId:'DATE-RESTORE',schedules:[stored],evidenceDocuments:[{sourceHashSha256:hash,storedPath:path,basisState:'candidate',scheduleAdoption:null}]} as unknown as ProjectRuntimeState;
  assert.equal((await refreshTabularScheduleDates(state)).refreshedDocumentCount,1);
  assert.equal(state.schedules[0]!.revision.model.dataDateIso,'2031-06-30');
  assert.equal(state.schedules[0]!.revision.model.activities,activities);
  assert.equal(state.schedules[0]!.role,'baseline');assert.equal(state.schedules[0]!.roleConfirmed,false);
  assert.equal(state.evidenceDocuments[0]!.basisState,'candidate');assert.equal(state.evidenceDocuments[0]!.scheduleAdoption,null);
  assert.deepEqual(readFileSync(path),bytes);
  const restored=JSON.parse(JSON.stringify(state));
  assert.equal((await refreshTabularScheduleDates(restored)).refreshedDocumentCount,0);
  assert.equal(restored.schedules[0].dataDateReadRefresh.previousDataDateIso,null);
  delete state.schedules[0]!.tabularDateReaderVersion;writeFileSync(path,'altered source');
  const rejected=await refreshTabularScheduleDates(state);
  assert.equal(rejected.refreshedDocumentCount,0);assert.match(rejected.diagnostics[0]!,/SOURCE_HASH_MISMATCH/);
  assert.equal(state.schedules[0]!.revision.model.dataDateIso,'2031-06-30');
 }finally{rmSync(root,{recursive:true,force:true});}
});
