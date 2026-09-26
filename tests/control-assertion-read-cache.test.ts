import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {retainedControlAssertionRead} from '../packages/runtime-api/src/control-assertion-read-cache';

test('an absent control fact is read once across sessions, without becoming an assertion',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'cmeng-control-read-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const input={bytes:Buffer.from('same verified PDF'),sourceRef:'evidence:control.pdf:full-document',metrics:new Set(['near_critical_working_days','completion_date']),requiredMetrics:new Set(['near_critical_working_days']),readerConfig:[true,'eng,ara',null,'16']};
  let calls=0;const read=async()=>{calls++;return {assertions:[],diagnostics:['SCHEDULE_CONTROL_BASIS_FULL_DOCUMENT_THRESHOLD_NOT_FOUND']};};
  await retainedControlAssertionRead(dir,input,read);
  const repeat=await retainedControlAssertionRead(dir,{...input,metrics:new Set(['near_critical_working_days'])},read);
  assert.equal(calls,1);assert.deepEqual(repeat.assertions,[]);assert.ok(repeat.diagnostics[0]!.includes('NOT_FOUND'));
  await retainedControlAssertionRead(dir,{...input,bytes:Buffer.from('changed PDF')},read);assert.equal(calls,2);
  await retainedControlAssertionRead(dir,{...input,requiredMetrics:new Set(['completion_date'])},read);assert.equal(calls,3);
  await retainedControlAssertionRead(dir,{...input,readerConfig:[false,'eng,ara',null,'16']},read);assert.equal(calls,4);
  await retainedControlAssertionRead(dir,{...input,sourceRef:'evidence:other.pdf:full-document'},read);assert.equal(calls,5);
});

test('failed control extraction remains retryable',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'cmeng-control-retry-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const input={bytes:Buffer.from('PDF'),sourceRef:'evidence:control.pdf',metrics:new Set(['completion_date']),requiredMetrics:new Set(['completion_date']),readerConfig:[true]};
  let calls=0;const read=async()=>{calls++;return {assertions:[],diagnostics:['SCHEDULE_CONTROL_BASIS_FULL_DOCUMENT_PARSE_ERROR:OCR failed']};};
  await retainedControlAssertionRead(dir,input,read);await retainedControlAssertionRead(dir,input,read);assert.equal(calls,2);
});
