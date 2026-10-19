#!/usr/bin/env node
'use strict';
// T03 controlled real AI test. It makes at most ONE paid provider call, under a hard
// spending cap held in a fresh, private usage ledger. It never runs by itself:
// the owner must supply the key and pass --confirm-paid.
//
//   CMENG_ASK_AI_API_KEY=sk-... CMENG_ASK_AI_MODEL=gpt-4.1-mini \
//     node scripts/ai-controlled-test.cjs --confirm-paid [--cap-usd 0.05]
//
// Unknown models need CMENG_AI_INPUT_USD_PER_MILLION and CMENG_AI_OUTPUT_USD_PER_MILLION
// (the ledger refuses a call it cannot price). Run `npm run build` first.
const {mkdtempSync,readdirSync,readFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

const args=process.argv.slice(2);
const capIndex=args.indexOf('--cap-usd');
const cap=capIndex>=0?Number(args[capIndex+1]):0.05;
const HARD_MAX_USD=0.25;
if(!args.includes('--confirm-paid')){console.error('Refused: pass --confirm-paid to allow one paid AI call.');process.exit(2);}
if(!process.env.CMENG_ASK_AI_API_KEY||!process.env.CMENG_ASK_AI_MODEL){console.error('Refused: set CMENG_ASK_AI_API_KEY and CMENG_ASK_AI_MODEL.');process.exit(2);}
if(!Number.isFinite(cap)||cap<=0||cap>HARD_MAX_USD){console.error('Refused: --cap-usd must be above 0 and at most '+HARD_MAX_USD+'.');process.exit(2);}

// Only the supplied key is used, against a fresh ledger that holds this test's cap alone.
const ledger=mkdtempSync(join(tmpdir(),'cmeng-ai-controlled-'));
delete process.env.CMENG_ASK_AI_CONFIG_FILE;
delete process.env.CMENG_ASK_AI_BASE_URL;
process.env.CMENG_ASK_AI_PROTOCOL='responses';
process.env.CMENG_AI_USAGE_DIR=ledger;
process.env.CMENG_AI_MONTHLY_USD=String(cap);
process.env.CMENG_SEMANTIC_AI_MAX_CALLS_PER_FILE='1';

const dist=join(__dirname,'..','dist','packages','runtime-api','src');
const {enrichRegisterSheetSemantics}=require(join(dist,'project-state.js'));
const {configuredTableSemanticAiResolver}=require(join(dist,'evidence-semantic-ai.js'));

(async()=>{
  let calls=0;
  const real=configuredTableSemanticAiResolver();
  if(!real){console.error('FAIL: provider is not configured.');process.exit(1);}
  const resolver={name:real.name,async resolveTable(input){calls++;return real.resolveTable(input);}};
  // A small unfamiliar register the fixed rules cannot fully map. Second sheet proves the per-run limit.
  const rows=[['Ref No','Subject','Raised On','Owner','Current State'],
    ['RFI-001','Slab edge detail at grid C','2026-03-02','Structural','Open'],
    ['RFI-002','Door schedule revision','2026-03-05','Architect','Closed'],
    ['RFI-003','MEP riser clash level 4','2026-03-09','MEP','Open']];
  const read={producerVersion:'ai-controlled-test',sourceHashSha256:'AI-CONTROLLED-TEST-SOURCE',sheets:[{name:'Register',rows},{name:'Register copy',rows}]};
  const steps=[],diagnostics=[];
  const started=Date.now();
  await enrichRegisterSheetSemantics(read,{resolver,requested:true,steps,diagnostics});
  const file=readdirSync(ledger).find(name=>name.endsWith('.json'));
  const spend=file?JSON.parse(readFileSync(join(ledger,file),'utf8')):{reservedMicros:0,calls:0,inputTokens:0,outputTokens:0};
  rmSync(ledger,{recursive:true,force:true});
  const usd=spend.reservedMicros/1e6;
  const first=steps[0]||{};
  const report={model:process.env.CMENG_ASK_AI_MODEL,capUsd:cap,resolverCalls:calls,ledgerCalls:spend.calls,
    chargedOrReservedUsd:usd,inputTokens:spend.inputTokens,outputTokens:spend.outputTokens,seconds:(Date.now()-started)/1000,
    steps:steps.map(step=>({sheet:step.sheetName,status:step.status,attempted:step.attempted,note:step.note})),
    semanticMethod:read.sheets[0].semantic?.method??null,diagnostics};
  console.log(JSON.stringify(report,null,2));
  const failures=[];
  if(calls>1||spend.calls>1)failures.push('more than one paid call');
  if(usd>cap)failures.push('spend above cap');
  if(!['validated','unresolved'].includes(first.status))failures.push('first step did not complete: '+first.status);
  if(first.status==='validated'&&report.semanticMethod!=='ai_grounded')failures.push('validated output is not labelled as AI-read');
  if(steps[1]?.attempted)failures.push('second sheet was sent although the per-run limit is one call');
  if(failures.length){console.error('FAIL: '+failures.join('; '));process.exit(1);}
  console.log('PASS: one controlled AI call within USD '+cap+' (reserved or charged USD '+usd.toFixed(6)+').');
})().catch(error=>{rmSync(ledger,{recursive:true,force:true});console.error('FAIL: '+(error&&error.message||error));process.exit(1);});
