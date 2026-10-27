// Live finding, 27 Oct (diagnostic deployment 13e3913b): ABB-100 failed to
// restore at stage canonical_time_sync with "RangeError: Invalid string length"
// at Array.join in contractNoticeRules. A labelled notice term cites the whole
// contract text as its context once per source reference, and the rule text
// joined that whole text once per reference. A long contract that states the
// notice period many times made one string longer than JavaScript allows.
// Each distinct context is now joined once; the rule read is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {contractNoticeRules} from '../packages/runtime-api/src/contract-notice-rules';
import {canonicalTimeClaims} from '../packages/runtime-api/src/canonical-time-claims';

test('R16 a long contract that states the notice period many times is read without one over-long string',{timeout:600000},async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'cmeng-r16-long-contract-'));
 try{
  const store=new RuntimeProjectStore({dataDir,durable:true});
  // One page per clause (a form feed is the plain-text page break): each page is a source reference.
  const clause=(i:number)=>'\f'+(i+1)+' Claims procedure '+(i+1)+'\nThe Contractor shall give notice. Notice of claim shall be given within 28 days after the Contractor became aware of the event. '+'General obligations of the parties apply. '.repeat(90);
  const text='MAIN WORKS CONTRACT AGREEMENT\nConditions of Contract.\nContractual completion date: 2033-04-28.'+Array.from({length:700},(_,i)=>clause(i)).join('');
  assert.ok(text.length>2_500_000,'the contract text is long ('+text.length+' characters)');
  await store.ingestEvidenceFile({projectId:'R16-LONG',bytes:Buffer.from(text,'utf8'),mediaType:'text/plain',sourceFilename:'Main_Contract_Long.txt',uploadedAt:'2031-09-01T00:00:00Z'});
  const state=store.get('R16-LONG')!;
  const rules=contractNoticeRules(state);
  assert.ok(rules.some(r=>r.noticePeriodDays===28),'the 28-day notice rule is read');
  assert.ok(rules.filter(r=>r.noticePeriodDays===28).every(r=>r.triggerBasis==='awareness'),'the trigger is read from the clause text');
  assert.doesNotThrow(()=>canonicalTimeClaims(state,true),'the shared time position is built');
  // A restart restores the project.
  const again=new RuntimeProjectStore({dataDir,durable:true});
  assert.ok(again.get('R16-LONG'),'the project is restored after a restart');
 }finally{
  await rm(dataDir,{recursive:true,force:true});
 }
});
