import test from 'node:test';
import assert from 'node:assert/strict';
import {collectAiHeadingOverrides} from '../packages/contract-parser/src/ai';
import type {ContractAiResolver,ContractTextBlock} from '../packages/contract-parser/src';

const blocks:ContractTextBlock[]=[{
  sourceKind:'docx_paragraph',sourceIndex:1,page:null,block:1,
  text:'Clause ??? unresolved heading A\nClause ??? unresolved heading B\nClause ??? unresolved heading C',
}];

test('T03 contract heading AI obeys the hard per-file call cap and records every blocked step',async()=>{
  let calls=0;
  const steps:any[]=[];
  const resolver:ContractAiResolver={name:'nonpaid-test',async resolveHeading(input){
    calls++;
    return {kind:'clause',identifier:'AI-'+calls,contextIdentifier:null,heading:'Resolved '+calls,confidence:0.99,
      sourceStart:input.sourceSpan.start,sourceEnd:input.sourceSpan.end,sourceText:input.sourceSpan.text,explanation:'fixture'};
  }};
  const result=await collectAiHeadingOverrides(blocks,resolver,{maxCalls:1,onStep:step=>steps.push(step)});
  assert.equal(calls,1);
  assert.equal(result.overrides.size,1);
  assert.deepEqual(steps.map(step=>step.status),['validated','call_limit','call_limit']);
  assert.deepEqual(steps.map(step=>step.attempted),[true,false,false]);
  assert.equal(result.diagnostics.filter(code=>code.startsWith('CONTRACT_AI_CALL_LIMIT_REACHED:')).length,2);
});

test('T03 zero contract AI budget makes no resolver call and preserves all unresolved source headings',async()=>{
  let calls=0;
  const steps:any[]=[];
  const resolver:ContractAiResolver={name:'must-not-call',async resolveHeading(){calls++;return null;}};
  const result=await collectAiHeadingOverrides(blocks,resolver,{maxCalls:0,onStep:step=>steps.push(step)});
  assert.equal(calls,0);
  assert.equal(result.overrides.size,0);
  assert.equal(steps.length,3);
  assert.ok(steps.every(step=>step.status==='call_limit'&&step.attempted===false));
});
