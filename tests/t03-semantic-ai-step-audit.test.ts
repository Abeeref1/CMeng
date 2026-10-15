import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichRegisterSheetSemantics} from '../packages/runtime-api/src/project-state';
import type {TableSemanticAiResolver} from '../packages/runtime-api/src/evidence-semantic-ai';

const originalRows=[['Project Ref','Unfamiliar Code','Unknown Value'],['PK-001','W-77','A'],['PK-002','W-78','B']];
const original=()=>({producerVersion:'test',sourceHashSha256:'SOURCE-SHA-2026',sheets:[{name:'Original',rows:structuredClone(originalRows)}]}) as any;
test('T03 no paid model is called unless enabled; unresolved original headings are retained',async()=>{
 const steps:any[]=[],before=JSON.stringify(originalRows);
 await enrichRegisterSheetSemantics(original(),{steps,requested:false,resolver:null});
 assert.equal(steps.length,1);
 assert.equal(steps[0]?.attempted,false);
 assert.equal(steps[0]?.status,'disabled');
 assert.equal(JSON.stringify(originalRows),before);
});
test('T03 unavailable provider is reported separately from user-disabled AI',async()=>{
 const steps:any[]=[];
 await enrichRegisterSheetSemantics(original(),{steps,requested:true,resolver:null});
 assert.equal(steps[0]?.attempted,false);
 assert.equal(steps[0]?.status,'provider_unavailable');
});
test('T03 one injected nonpaid resolver can decline without inventing column mappings',async()=>{
 const steps:any[]=[],calls:any[]=[];
 const resolver:TableSemanticAiResolver={name:'in-memory-free-test',async resolveTable(input){calls.push({sheet:input.sheetName,hash:input.sourceHashSha256});return null;}};
 const result=await enrichRegisterSheetSemantics(original(),{steps,requested:true,resolver});
 assert.equal(calls.length,1);
 assert.equal(steps[0]?.status,'unresolved');assert.equal(steps[0]?.attempted,true);
 assert.notEqual(result.sheets[0]?.semantic?.method,'ai_grounded');
 assert.equal(result.sourceHashSha256,'SOURCE-SHA-2026');
});
test('T03 configured per-file zero calls is enforced without running any model',async()=>{
 const old=process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE;
 process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE='0';
 const steps:any[]=[];let calls=0;
 try{
  const resolver:TableSemanticAiResolver={name:'must-not-call',async resolveTable(){calls++;return null;}};
  await enrichRegisterSheetSemantics(original(),{steps,requested:true,resolver});
  assert.equal(calls,0);
  assert.equal(steps[0]?.status,'call_limit');
  assert.equal(steps[0]?.attempted,false);
 }finally{if(old===undefined)delete process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE;else process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE=old;}
});
