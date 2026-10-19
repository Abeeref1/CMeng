import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {enrichRegisterSheetSemantics,workbookSemanticIdentity} from '../packages/runtime-api/src/project-state';
import {GroundedTableSemanticAiResolver,aiReadingCoverage,type TableSemanticAiResolver} from '../packages/runtime-api/src/evidence-semantic-ai';
import {callUpperBoundUsd,reserveModelUsage} from '../packages/project-ask/src/usage-budget';
import {readFileSync,readdirSync} from 'node:fs';
import {OpenAiAskModel,configuredModelLimits,configuredProviderState} from '../packages/project-ask/src/provider';
import {explicitReferenceCandidates,shortlistLinks,type LinkEntity} from '../packages/runtime-api/src/link-candidate-core';

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
  // The fake provider answers HTTP 500, which the provider reads as MODEL_PROVIDER_UNAVAILABLE: a provider error.
  assert.deepEqual(steps.map(step=>step.status),['provider_error','stopped_at_cap','stopped_at_cap']);
  assert.deepEqual(steps.map(step=>step.attempted),[true,false,false]);
  assert.ok(steps.slice(1).every(step=>/spending cap/.test(step.note)));
  assert.equal(diagnostics.filter(line=>/stopped at the spending cap/.test(line)).length,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

const entity=(id:string,reference:string,description:string):LinkEntity=>({id,projectId:'P',reference,description,sourceRefs:['ref:'+id]});
const boq=entity('Q1','BOQ 4.2','Pour slab concrete level 3, see activity ACT-1050');
const targets=[entity('ACT-2000','ACT-2000','Pour slab concrete level 3'),entity('ACT-1050','ACT-1050','Formwork'),entity('ACT-10501','ACT-10501','Pour slab concrete')];

test('T03 an explicit cited reference ranks first in the AI shortlist, ahead of word overlap',()=>{
 const ranked=shortlistLinks('boq_activity',boq,targets,null,1,0);
 assert.deepEqual(ranked.targets.map(t=>t.id),['ACT-1050']);
 assert.equal(ranked.eligibleCount,3);
});

test('T03 explicit references are matched before any AI call and stay candidates for human review',()=>{
 const input={kind:'boq_activity' as const,projectId:'P',basisVersion:2,dataDateIso:null,source:boq,targets,requestHash:'H'};
 const rows=explicitReferenceCandidates(input);
 assert.deepEqual(rows.map(r=>r.targetId),['ACT-1050'],'whole-reference match only (ACT-10501 is not cited)');
 assert.equal(rows[0]?.state,'candidate');
 assert.equal(rows[0]?.confidence,1);
 assert.match(rows[0]!.reason,/not AI-read/);
 assert.deepEqual(explicitReferenceCandidates({...input,source:entity('Q2','BOQ 4.3','Pour slab concrete')}),[]);
});

test('T03 the cost shown before AI is switched on equals what the ledger reserves for one call',()=>{
 const dir=mkdtempSync(join(tmpdir(),'t03-estimate-'));
 try{
  const limits=configuredModelLimits({});
  const shown=configuredProviderState({CMENG_ASK_AI_API_KEY:'fake',CMENG_ASK_AI_MODEL:'gpt-4.1-mini',CMENG_AI_USAGE_DIR:dir}).estimatedMaxUsdPerCall;
  assert.equal(shown,callUpperBoundUsd('gpt-4.1-mini',limits.contextTokens,limits.outputTokens,{}));
  reserveModelUsage('gpt-4.1-mini',limits.contextTokens,limits.outputTokens,{CMENG_AI_USAGE_DIR:dir});
  const ledger=JSON.parse(readFileSync(join(dir,readdirSync(dir).find(name=>name.endsWith('.json'))!),'utf8'));
  assert.equal(shown,ledger.reservedMicros/1e6);
  assert.equal(callUpperBoundUsd('unpriced-model',1000,1000,{}),null,'unknown price stays unknown, never zero');
  assert.equal(configuredProviderState({}).estimatedMaxUsdPerCall,null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('T03 R5: incomplete reading with AI set up is stated with the cost to finish; AI-read steps are not counted as read',()=>{
 const docs=[{sourceHashSha256:'A',semanticAiSteps:[
  {sourceHashSha256:'A',status:'disabled',attempted:false},{sourceHashSha256:'A',status:'stopped_at_cap',attempted:false},
  {sourceHashSha256:'A',status:'unresolved',attempted:true},{sourceHashSha256:'A',status:'validated',attempted:true},
  {sourceHashSha256:'OLD',status:'disabled',attempted:false}]}];
 const on=aiReadingCoverage(docs,{providerConfigured:true,estimatedMaxUsdPerCall:0.0272});
 assert.equal(on.incompleteSteps,3);
 assert.equal(on.stepsAwaitingAi,2);
 assert.equal(on.estimatedMaxUsdToFinish,0.0544);
 assert.match(on.statement!,/Reading is incomplete: 3 source steps are not fully read\. AI is set up\. .*at most USD 0\.0544.*Owner permission is required/);
 const off=aiReadingCoverage(docs,{providerConfigured:false,estimatedMaxUsdPerCall:null});
 assert.match(off.statement!,/AI is not set up\./);
 assert.equal(off.estimatedMaxUsdToFinish,null);
 const unpriced=aiReadingCoverage(docs,{providerConfigured:true,estimatedMaxUsdPerCall:null});
 assert.match(unpriced.statement!,/cost cannot be estimated/);
 assert.equal(aiReadingCoverage([{sourceHashSha256:'A',semanticAiSteps:[{sourceHashSha256:'A',status:'not_required',attempted:false}]}],{providerConfigured:true,estimatedMaxUsdPerCall:0.01}).statement,null);
});

test('T03 an AI-read worksheet role is labelled AI-read and left for review, never silently adopted',()=>{
 const identification={detectedCategory:'other',detectedDocumentType:'supporting_document',confidence:0.4,method:'metadata_fallback',needsReview:true,signals:[],diagnostics:[]} as any;
 const semantic=(method:string)=>({documentType:'rfi_register',category:'correspondence',confidence:0.95,method,signals:['fixture'],columnMeanings:[]});
 const ai=workbookSemanticIdentity('other' as any,'supporting_document',identification,{producerVersion:'t',sourceHashSha256:'H',sheets:[{name:'S',rows:[],semantic:semantic('ai_grounded')}]} as any);
 assert.equal(ai.identification.needsReview,true);
 assert.ok(ai.identification.signals.some((line:string)=>/AI-read/.test(line)));
 const rules=workbookSemanticIdentity('other' as any,'supporting_document',identification,{producerVersion:'t',sourceHashSha256:'H',sheets:[{name:'S',rows:[],semantic:semantic('tabular_content')}]} as any);
 assert.equal(rules.identification.needsReview,false,'rule-based reading keeps its existing behaviour');
});
