import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {enrichRegisterSheetSemantics} from '../packages/runtime-api/src/project-state';
import {GroundedTableSemanticAiResolver,type TableSemanticAiResolver} from '../packages/runtime-api/src/evidence-semantic-ai';
import {OpenAiAskModel,configuredModelLimits} from '../packages/project-ask/src/provider';

// Unfamiliar headings the fixed rules cannot map, so every sheet is in the eligible AI population.
const rows=()=>[['Project Ref','Unfamiliar Code','Unknown Value'],['PK-001','W-77','A'],['PK-002','W-78','B'],['PK-003','W-79','C'],['PK-004','W-80','D']];
const workbook=(names:string[])=>({producerVersion:'test',sourceHashSha256:'SOURCE-SHA-T03',sheets:names.map(name=>({name,rows:rows()}))}) as any;
const withCallsPerFile=async(value:string|undefined,run:()=>Promise<void>)=>{
 const old=process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE;
 if(value===undefined)delete process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE;else process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE=value;
 try{await run();}finally{if(old===undefined)delete process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE;else process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE=old;}
};

test('T03 a restart never repeats a paid AI call already made for the same source sheet',async()=>{
 const calls:string[]=[];
 const resolver:TableSemanticAiResolver={name:'fake-free',async resolveTable(input){calls.push(input.sheetName);return null;}};
 const first:any[]=[];
 await enrichRegisterSheetSemantics(workbook(['S1','S2','S3']),{resolver,requested:true,steps:first});
 assert.deepEqual(calls,['S1','S2','S3']);
 assert.ok(first.every(step=>step.status==='unresolved'&&step.attempted));
 const second:any[]=[];
 await enrichRegisterSheetSemantics(workbook(['S1','S2','S3']),{resolver,requested:true,steps:second,priorSteps:first});
 assert.deepEqual(calls,['S1','S2','S3'],'no repeat paid call after restart');
 assert.equal(second.length,3);
 assert.ok(second.every(step=>step.status==='unresolved'&&/No repeat paid call/.test(step.note)));
});

test('T03 the AI step reaches the full eligible population across resumed runs, each sheet called once',async()=>{
 await withCallsPerFile('1',async()=>{
  const calls:string[]=[];
  const resolver:TableSemanticAiResolver={name:'fake-free',async resolveTable(input){calls.push(input.sheetName);return null;}};
  let prior:any[]|undefined;
  for(let run=0;run<3;run++){
   const steps:any[]=[];
   await enrichRegisterSheetSemantics(workbook(['S1','S2','S3']),{resolver,requested:true,steps,priorSteps:prior});
   prior=steps;
  }
  assert.deepEqual(calls,['S1','S2','S3']);
  assert.ok(prior!.every(step=>step.status==='unresolved'&&step.attempted),'every eligible sheet was read once');
 });
});

test('T03 the spending cap is checked before each call and the run stops cleanly at the cap',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'t03-cap-'));
 let fetches=0;
 const fakeFetch=(async()=>{fetches++;return new Response('{}',{status:500});}) as unknown as typeof fetch;
 try{
  // One call reserves the full context upper bound (about USD 0.027 at the published rate); the cap allows one.
  const model=new OpenAiAskModel('fake-key','gpt-4.1-mini',fakeFetch,configuredModelLimits({}),{},{CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'0.03'});
  const steps:any[]=[],diagnostics:string[]=[];
  await enrichRegisterSheetSemantics(workbook(['S1','S2','S3']),{resolver:new GroundedTableSemanticAiResolver(model),requested:true,steps,diagnostics});
  assert.equal(fetches,1,'no provider request after the cap is reached');
  assert.deepEqual(steps.map(step=>step.status),['failed','stopped_at_cap','stopped_at_cap']);
  assert.deepEqual(steps.map(step=>step.attempted),[true,false,false]);
  assert.ok(steps.slice(1).every(step=>/spending cap/.test(step.note)));
  assert.equal(diagnostics.filter(line=>/stopped at the spending cap/.test(line)).length,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
