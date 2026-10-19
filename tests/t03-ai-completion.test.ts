import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {RuntimeProjectStore,enrichRegisterSheetSemantics} from '../packages/runtime-api/src/project-state';
import {aiReadingCoverage,type TableSemanticAiResolver} from '../packages/runtime-api/src/evidence-semantic-ai';
import {callUpperBoundUsd,reserveModelUsage} from '../packages/project-ask/src/usage-budget';
import {configuredModelLimits,configuredProviderState,realProviderTestStatus} from '../packages/project-ask/src/provider';
import {explicitReferenceCandidates,type LinkEntity} from '../packages/runtime-api/src/link-candidate-core';
import {documentReadReview} from '../packages/runtime-api/src/document-read-review';

const NOT_RUN_NO_KEY='Real-provider test: not run, no provider key configured in this environment.';
const CONFIGURED_NOT_RUN='Real-provider test: configured but not run.';

test('T03 real-provider test status is explicit and never reads as passed',()=>{
 const none=configuredProviderState({});
 assert.equal(none.providerConfigured,false);
 assert.deepEqual(none.realProviderTest,{state:'not_run_no_key',run:false,passed:false,statement:NOT_RUN_NO_KEY});
 const configured=configuredProviderState({CMENG_ASK_AI_API_KEY:'fake',CMENG_ASK_AI_MODEL:'gpt-4.1-mini'});
 assert.equal(configured.providerConfigured,true);
 assert.equal(configured.realProviderTest.state,'configured_not_run');
 assert.equal(configured.realProviderTest.passed,false);
 assert.ok(configured.realProviderTest.statement.startsWith(CONFIGURED_NOT_RUN));
 for(const status of [realProviderTestStatus(true),realProviderTestStatus(false)])assert.doesNotMatch(status.statement,/\bpass(ed)?\b/i);
 // The reading-status screen carries the same statement.
 const docs=[{sourceHashSha256:'A',semanticAiSteps:[{sourceHashSha256:'A',status:'disabled',attempted:false}]}];
 assert.equal(aiReadingCoverage(docs,{providerConfigured:false,estimatedMaxUsdPerCall:null}).realProviderTest,NOT_RUN_NO_KEY);
 assert.match(aiReadingCoverage(docs,{providerConfigured:true,estimatedMaxUsdPerCall:0.02}).realProviderTest,/^Real-provider test: configured but not run\./);
});

test('T03 the controlled-test script reports "not run" when it does not run, and never calls a provider',()=>{
 const script=join(__dirname,'..','..','scripts','ai-controlled-test.cjs');
 const base={PATH:process.env.PATH??''};
 const noKey=spawnSync(process.execPath,[script,'--confirm-paid'],{env:base,encoding:'utf8'});
 assert.equal(noKey.status,2);
 assert.equal(noKey.stdout.trim(),NOT_RUN_NO_KEY);
 assert.doesNotMatch(noKey.stdout+noKey.stderr,/PASS|passed/);
 // A key is present but the owner has not confirmed the paid call: configured, not run, no request made.
 const keyed=spawnSync(process.execPath,[script],{env:{...base,CMENG_ASK_AI_API_KEY:'fake-not-used',CMENG_ASK_AI_MODEL:'gpt-4.1-mini',CMENG_ASK_AI_BASE_URL:'http://127.0.0.1:9'},encoding:'utf8'});
 assert.equal(keyed.status,2);
 assert.equal(keyed.stdout.trim(),CONFIGURED_NOT_RUN);
 assert.doesNotMatch(keyed.stdout+keyed.stderr,/PASS|passed/);
});

// Unfamiliar headings the fixed rules cannot map, so every sheet is in the eligible AI population.
const rows=()=>[['Project Ref','Unfamiliar Code','Unknown Value'],['PK-001','W-77','A'],['PK-002','W-78','B'],['PK-003','W-79','C']];
const workbook=(names:string[])=>({producerVersion:'test',sourceHashSha256:'SOURCE-SHA-T03-E2E',sheets:names.map(name=>({name,rows:rows()}))}) as any;
const entity=(id:string,reference:string,description:string):LinkEntity=>({id,projectId:'P',reference,description,sourceRefs:['ref:'+id]});

test('T03 end to end with a fake provider: full population once, resume, clean stop at cap, explicit references first, per-step status',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'t03-e2e-'));
 try{
  const limits=configuredModelLimits({});
  const perCall=callUpperBoundUsd('gpt-4.1-mini',limits.contextTokens,limits.outputTokens,{})!;
  assert.ok(perCall>0);
  let env:NodeJS.ProcessEnv={CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:String(perCall*2.5)};
  const calls:string[]=[];
  // Fake provider: reserves against the real spending ledger exactly as a paid call does, makes no network
  // request, and returns no usable reading (so every attempted sheet stays for review).
  const resolver:TableSemanticAiResolver={name:'fake-free',async resolveTable(input){
   reserveModelUsage('gpt-4.1-mini',limits.contextTokens,limits.outputTokens,env);calls.push(input.sheetName);return null;}};
  const sheets=['S1','S2','S3','S4','S5'];
  const read=async(prior?:any[])=>{const steps:any[]=[],diagnostics:string[]=[];
   await enrichRegisterSheetSemantics(workbook(sheets),{resolver,requested:true,steps,diagnostics,priorSteps:prior});return {steps,diagnostics};};
  const coverage=(steps:any[])=>aiReadingCoverage([{sourceHashSha256:'SOURCE-SHA-T03-E2E',semanticAiSteps:steps}],{providerConfigured:true,estimatedMaxUsdPerCall:perCall});

  // Run 1: the cap allows two calls; the run stops cleanly and marks the rest stopped_at_cap.
  const first=await read();
  assert.deepEqual(calls,['S1','S2']);
  assert.deepEqual(first.steps.map(s=>s.status),['unresolved','unresolved','stopped_at_cap','stopped_at_cap','stopped_at_cap']);
  assert.deepEqual(first.steps.map(s=>s.attempted),[true,true,false,false,false]);
  assert.equal(first.diagnostics.filter(line=>/stopped at the spending cap/.test(line)).length,3);
  const c1=coverage(first.steps);
  assert.equal(c1.incompleteSteps,5);assert.equal(c1.stepsAwaitingAi,3);
  assert.equal(c1.estimatedMaxUsdToFinish,Math.round(perCall*3*1e6)/1e6);
  assert.match(c1.statement!,/Reading is incomplete: 5 source steps are not fully read\. AI is set up\. Reading the remaining 3 with AI would cost at most USD/);

  // Run 2 (re-read, same cap): no paid call is repeated and nothing new is spent.
  const second=await read(first.steps);
  assert.deepEqual(calls,['S1','S2'],'re-read repeats no paid call');
  assert.deepEqual(second.steps.map(s=>s.status),['unresolved','unresolved','stopped_at_cap','stopped_at_cap','stopped_at_cap']);
  assert.ok(second.steps.slice(0,2).every(s=>/No repeat paid call/.test(s.note)));

  // Run 3: budget raised; reading resumes at S3 and reaches the full eligible population, each sheet once.
  env={CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:String(perCall*5.5)};
  const third=await read(second.steps);
  assert.deepEqual(calls,sheets,'every eligible sheet attempted exactly once');
  assert.ok(third.steps.every(s=>s.status==='unresolved'&&s.attempted));
  const c3=coverage(third.steps);
  assert.equal(c3.stepsAwaitingAi,0);assert.equal(c3.estimatedMaxUsdToFinish,0);
  assert.match(c3.statement!,/AI has already read the rest; they need review\./);

  // Run 4: nothing left to call.
  await read(third.steps);
  assert.deepEqual(calls,sheets);
  const ledger=JSON.parse(readFileSync(join(dir,readdirSync(dir).find(name=>name.endsWith('.json'))!),'utf8'));
  assert.equal(ledger.calls,5,'the ledger holds exactly one reservation per eligible sheet');

  // Explicit references are matched before any AI call; only the uncited source reaches the model.
  const targets=[entity('ACT-1050','ACT-1050','Formwork'),entity('ACT-2000','ACT-2000','Pour slab concrete level 3')];
  const sources=[entity('Q1','BOQ 4.2','Formwork, see activity ACT-1050'),entity('Q2','BOQ 4.3','Pour slab concrete level 3')];
  const modelCalls:string[]=[];
  const linked=sources.map(source=>{
   const explicit=explicitReferenceCandidates({kind:'boq_activity',projectId:'P',basisVersion:1,dataDateIso:null,source,targets,requestHash:'H-'+source.id});
   if(explicit.length)return {source:source.id,explicit:explicit.map(r=>r.targetId),ai:false};
   modelCalls.push(source.id);return {source:source.id,explicit:[],ai:true};
  });
  assert.deepEqual(linked,[{source:'Q1',explicit:['ACT-1050'],ai:false},{source:'Q2',explicit:[],ai:true}]);
  assert.deepEqual(modelCalls,['Q2']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('T03 deferred PDF reading matches a non-normalised project id to its stored normalised id',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'t03-pdf-id-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false});
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let i=0;i<2;i++){const p=pdf.addPage();p.drawText('Reference memorandum. This page contains the retained supporting explanation for document review. Page '+(i+1),{x:30,y:600,size:11,font});}
 await store.ingestEvidenceFile({projectId:'Read-Norm 1',sourceFilename:'Memo.pdf',bytes:await pdf.save(),mediaType:'application/pdf',uploadedAt:'2031-09-01'});
 const state=store.get('READ-NORM 1')!;
 assert.equal(state.projectId,'READ-NORM 1','stored id is normalised');
 const document=state.evidenceDocuments[0]!;
 // A worker id that is not normalised (case and spacing differ) must not skip this project's PDFs.
 const result=await store.refreshDeferredPdfReads('  read-norm   1 ',undefined,document.documentId);
 assert.equal(result.refreshedDocumentCount,1);
 assert.deepEqual(result.changedProjects,['READ-NORM 1']);
 assert.equal(documentReadReview(document,state).complete,true);
 // A different project id still matches nothing.
 assert.equal((await store.refreshDeferredPdfReads('OTHER')).refreshedDocumentCount,0);
});
