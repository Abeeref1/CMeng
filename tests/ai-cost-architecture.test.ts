// 13 Nov owner brief: reduce duplicate AI work, never AI quality. Same model, same 0.90
// threshold, same source validation, no invented mappings, unresolved stays unresolved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  GroundedTableSemanticAiResolver,GroundedContractHeadingAiResolver,tableSemanticAiRequest,
  TABLE_RESOLVER_VERSION,type AiRequestEvent,type TableSemanticAiInput,aiReadingCoverage,
} from '../packages/runtime-api/src/evidence-semantic-ai';
import {SemanticAiCache} from '../packages/runtime-api/src/semantic-ai-cache';
import {estimateAiReading} from '../packages/runtime-api/src/ai-reading-estimate';
import {collectAiHeadingOverrides,type ContractTextBlock} from '../packages/contract-parser/src';
import {reserveModelUsage,monthlyAiUsage,callUpperBoundUsd} from '../packages/project-ask/src/usage-budget';
import {OpenAiAskModel,configuredModelLimits,requestNeverSent,type StructuredModel} from '../packages/project-ask/src/provider';
import {inferTableSemanticRoute} from '../packages/truth-kernel/src';

const tableRows=(rows:string[][],header=['ABC','Cut','Q1','Q2','FX','Stage'])=>[header,...rows];
const sheetA=tableRows([['PC-1','2039-01-31','1000','900','AED','Paid'],['PC-2','2039-02-28','1800','1700','AED','Certified'],['PC-3','2039-03-31','2500','2400','AED','Open']]);
// Same layout, other values (another month, another workbook, another project).
const sheetB=tableRows([['PC-7','2039-07-31','7000','6900','AED','Paid'],['PC-8','2039-08-31','7800','7700','AED','Open'],['PC-9','2039-09-30','8500','8400','AED','Open']]);
const sheetC=tableRows([['PC-4','2039-04-30','4000','3900','AED','Paid'],['PC-5','2039-05-31','4800','4700','AED','Open'],['PC-6','2039-06-30','5500','5400','AED','Open']],['abc','Cut','Q1','Q2','FX','Stage']);
// A different layout.
const other=tableRows([['X1','2039-01-31','AED','10'],['X2','2039-02-28','AED','20'],['X3','2039-03-31','AED','30']],['Ref','When','Ccy','Amt']);
const input=(rows:string[][],sheetName:string,hash='a'.repeat(64)):TableSemanticAiInput=>({sourceHashSha256:hash,sheetName,rows});

/** A fake model answering the payment layout validly and counting provider calls. */
function paymentModel(counter:{calls:number},confidence=0.97):StructuredModel{
  return {structured:async(_name,_schema,_prompt,payload:any)=>{
    counter.calls++;
    const header=payload.table.rows[0] as string[];
    if(!header.includes('Q1'))return {sourceHashSha256:payload.sourceHashSha256,sheetName:payload.sheetName,documentType:'unresolved',confidence:0,columns:[]};
    const meaning:Record<string,string>={abc:'certificate no',cut:'period end',q1:'net certified',q2:'paid amount',fx:'currency',stage:'status'};
    return {sourceHashSha256:payload.sourceHashSha256,sheetName:payload.sheetName,documentType:'payment_certificates',confidence,
      columns:header.map((rawHeader,columnIndex)=>({columnIndex,rawHeader,meaning:meaning[rawHeader.toLowerCase()]!,confidence:0.97}))};
  }};
}

test('1. one AI call per unique table structure; every reuse is validated against its own sheet',async()=>{
  const counter={calls:0},resolver=new GroundedTableSemanticAiResolver(paymentModel(counter));
  const a=await resolver.resolveWithReceipt(input(sheetA,'Jan'));
  const b=await resolver.resolveWithReceipt(input(sheetB,'Feb',"b".repeat(64)));
  const c=await resolver.resolveWithReceipt(input(sheetC,'Mar'));
  assert.equal(counter.calls,1,'three sheets with one layout: one paid call');
  assert.deepEqual([a.call,b.call,c.call],[true,false,false]);
  assert.equal(b.reuse,'run');
  for(const [receipt,rows] of [[a,sheetA],[b,sheetB],[c,sheetC]] as const){
    assert.equal(receipt.result?.documentType,'payment_certificates');
    // Validated against THIS sheet's own header row (sheet C writes "abc" in lower case).
    assert.equal(receipt.result?.columnMeanings?.[0]?.rawHeader,rows[0]![0]);
    assert.ok(receipt.result!.columnMeanings!.every(column=>column.confidence>=0.9));
  }
  const d=await resolver.resolveWithReceipt(input(other,'Other'));
  assert.equal(counter.calls,2,'a different layout gets its own call');
  assert.equal(d.result,null,'unresolved stays unresolved');
  const e=await resolver.resolveWithReceipt(input(other,'Other 2'));
  assert.equal(counter.calls,2,'an identical layout that AI could not validate is not asked again');
  assert.equal(e.call,false);assert.equal(e.result,null);
});

test('2. shared validated cache: an identical layout in another project makes no paid call; a new reader version never reuses',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-semantic-cache-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const counter={calls:0};
  await new GroundedTableSemanticAiResolver(paymentModel(counter),{cache:new SemanticAiCache(dir)}).resolveWithReceipt(input(sheetA,'Project 1'));
  assert.equal(counter.calls,1);
  // A new reading (new process, another project) with the same cache folder.
  const second=await new GroundedTableSemanticAiResolver(paymentModel(counter),{cache:new SemanticAiCache(dir)}).resolveWithReceipt(input(sheetB,'Project 2',"c".repeat(64)));
  assert.equal(counter.calls,1,'answered from the validated cache');
  assert.equal(second.reuse,'cache');assert.equal(second.result?.documentType,'payment_certificates');
  // Only validated answers are stored, and only under the current reader version.
  const fingerprint=tableSemanticAiRequest(input(sheetA,'x'))!.fingerprint;
  const cache=new SemanticAiCache(dir);
  assert.ok(cache.get('table',TABLE_RESOLVER_VERSION,fingerprint));
  assert.equal(cache.get('table','cmeng-grounded-table-semantics-v1:older',fingerprint),null,'another reader version never reads this entry');
  assert.equal(new SemanticAiCache(dir).get('table',TABLE_RESOLVER_VERSION,tableSemanticAiRequest(input(other,'x'))!.fingerprint),null,'an unresolved answer is never stored');
});

test('2b. a cached answer below the 0.90 threshold is not used: quality controls are unchanged',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-semantic-cache-low-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const cache=new SemanticAiCache(dir),fingerprint=tableSemanticAiRequest(input(sheetA,'x'))!.fingerprint;
  cache.put('table',TABLE_RESOLVER_VERSION,fingerprint,{documentType:'payment_certificates',confidence:0.85,columns:[{columnIndex:0,meaning:'certificate no',confidence:0.85}]});
  const counter={calls:0};
  const receipt=await new GroundedTableSemanticAiResolver(paymentModel(counter),{cache:new SemanticAiCache(dir)}).resolveWithReceipt(input(sheetA,'Jan'));
  assert.equal(counter.calls,1,'the weak entry fails validation, so the sheet gets its own call');
  assert.equal(receipt.call,true);
  const low=await new GroundedTableSemanticAiResolver(paymentModel({calls:0},0.89)).resolveWithReceipt(input(sheetA,'Jan'));
  assert.equal(low.result,null,'a 0.89 answer is still rejected');
});

test('3. deterministic-first: AI sees only the columns no canonical reader consumed',()=>{
  const request=tableSemanticAiRequest({...input(sheetA,'Jan'),unconsumedColumns:[{columnIndex:2,rawHeader:'Q1'},{columnIndex:3,rawHeader:'Q2'}]})!;
  const columns=(request.payload.table as {columns:Array<{columnIndex:number}>}).columns;
  assert.deepEqual(columns.map(column=>column.columnIndex),[2,3]);
});

test('4. only the candidate schema is sent when the rules already route the table; otherwise the full catalogue',()=>{
  const risk=[['Risk ID','Description','Owner','Due Date','Status'],['R-1','Access','PM','2039-02-01','Open'],['R-2','Design','Designer','2039-02-02','Open']];
  assert.equal(inferTableSemanticRoute(risk)?.documentType,'risk_register');
  const routed=tableSemanticAiRequest(input(risk,'Risk'))!;
  assert.deepEqual((routed.payload.allowedSchemas as Array<{documentType:string}>).map(schema=>schema.documentType),['risk_register']);
  assert.deepEqual((routed.schema as any).properties.documentType.enum,['risk_register','unresolved']);
  const open=tableSemanticAiRequest(input(sheetA,'Jan'))!;
  assert.ok((open.payload.allowedSchemas as unknown[]).length>10,'no route: the complete schema catalogue');
  assert.ok(Buffer.byteLength(JSON.stringify(routed.payload))<Buffer.byteLength(JSON.stringify(open.payload)),'the narrowed request is smaller');
});

test('1c. contract headings: an identical heading under the same preceding section is read once; the per-file limit does not stop a reuse',async()=>{
  let calls=0;
  const model:StructuredModel={structured:async(_name,_schema,_prompt,payload:any)=>{calls++;const span=payload.sourceSpan;
    return {kind:'clause',identifier:'X1',contextIdentifier:null,heading:'Amended wording',confidence:0.97,sourceStart:span.start,sourceEnd:span.end,sourceText:span.text,explanation:'heading'};}};
  const blocks:ContractTextBlock[]=[{sourceKind:'docx_paragraph',sourceIndex:1,page:null,block:1,text:'Clause ??? unresolved heading A\nClause ??? unresolved heading A'},
    {sourceKind:'docx_paragraph',sourceIndex:2,page:null,block:2,text:'Clause ??? unresolved heading A\nClause ??? unresolved heading A'}];
  const steps:any[]=[];
  const result=await collectAiHeadingOverrides(blocks,new GroundedContractHeadingAiResolver(model),{maxCalls:2,onStep:step=>steps.push(step)});
  // Line 1 has no preceding section; lines 2 to 4 follow the section line 1 established, so
  // lines 3 and 4 ask the same question as line 2.
  assert.equal(calls,2,'four headings, two distinct questions, two calls');
  assert.equal(result.overrides.size,4,'every heading is resolved');
  assert.deepEqual(steps.map(step=>[step.status,step.attempted,step.reuse??null]),
    [['validated',true,null],['validated',true,null],['validated',false,'run'],['validated',false,'run']]);
  assert.equal(steps.filter(step=>step.status==='call_limit').length,0,'the per-file limit (2) does not stop a reuse');
});

test('1d. the contract plan follows the reading: a validated heading becomes the next heading\'s preceding section',async()=>{
  const {planningModel}=await import('../packages/runtime-api/src/evidence-semantic-ai');
  // The heading identity depends on the text only (the usual case).
  const byText=(payload:any)=>({kind:'clause',identifier:'C-'+payload.sourceSpan.text.slice(-1),contextIdentifier:null,heading:'Amended wording',confidence:0.97,
    sourceStart:payload.sourceSpan.start,sourceEnd:payload.sourceSpan.end,sourceText:payload.sourceSpan.text,explanation:'heading'});
  const doc=(text:string,sourceIndex=1):ContractTextBlock[]=>[{sourceKind:'docx_paragraph',sourceIndex,page:null,block:sourceIndex,text}];
  const cases:Array<[string,ContractTextBlock[]]>=[
    ['A, B, A: the second A follows B, a new question',doc('Clause ??? unresolved heading A\nClause ??? unresolved heading B\nClause ??? unresolved heading A')],
    ['the same heading six times (ORBIT C02)',doc(Array(6).fill('Clause ??? unresolved heading A').join('\n'))],
    ['two documents with the same text',[...doc('Clause ??? unresolved heading A\nClause ??? unresolved heading B',1),...doc('Clause ??? unresolved heading A\nClause ??? unresolved heading B',2)]],
  ];
  for(const [label,blocks] of cases){
    let calls=0;
    await collectAiHeadingOverrides(blocks,new GroundedContractHeadingAiResolver({structured:async(_n,_s,_p,payload:any)=>{calls++;return byText(payload);}}),{});
    const planned:AiRequestEvent[]=[];
    const dir=mkdtempSync(join(tmpdir(),'cmeng-plan-cache-'));const cache=new SemanticAiCache(dir);
    await collectAiHeadingOverrides(blocks,new GroundedContractHeadingAiResolver(planningModel,{planning:true,cache,observe:event=>planned.push(event)}),{});
    assert.equal(planned.filter(event=>event.call).length,calls,label+': planned calls equal the reading\'s calls');
    assert.equal(planned.length,blocks.flatMap(block=>block.text.split('\n')).length,label+': every heading is planned');
    assert.equal(readdirSync(dir).length,0,label+': a plan stores nothing in the shared cache');rmSync(dir,{recursive:true,force:true});
  }
  // Six identical headings are two questions: under no section, then under itself.
  let six=0;await collectAiHeadingOverrides(cases[1]![1],new GroundedContractHeadingAiResolver({structured:async(_n,_s,_p,payload:any)=>{six++;return byText(payload);}}),{});
  assert.equal(six,2);
});

test('5. the estimate comes from the actual requests: calls after reuse, expected cost, ceiling, worst case, month spend',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-estimate-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const events:AiRequestEvent[]=[];
  const planning:StructuredModel={structured:async()=>({sourceHashSha256:'',sheetName:'',documentType:'unresolved',confidence:0,columns:[]})};
  const resolver=new GroundedTableSemanticAiResolver(planning,{observe:event=>events.push(event)});
  for(const [rows,name] of [[sheetA,'Jan'],[sheetB,'Feb'],[sheetC,'Mar'],[other,'Other']] as const)await resolver.resolveWithReceipt(input(rows as string[][],name));
  // An earlier reservation this month.
  const env:NodeJS.ProcessEnv={CMENG_ASK_AI_API_KEY:'fake',CMENG_ASK_AI_MODEL:'gpt-4.1-mini',CMENG_ASK_AI_PROTOCOL:'responses',CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'20'};
  reserveModelUsage('gpt-4.1-mini',1000,500,env)!.finish(800,200);
  const estimate=estimateAiReading(events,env);
  assert.equal(estimate.pendingParts,4);assert.equal(estimate.uniqueStructures,2);assert.equal(estimate.aiCalls,2);assert.equal(estimate.reusedFromThisReading,2);
  assert.ok(estimate.expected.usd!>0&&estimate.expected.usd!<estimate.ceilingForPlannedCalls.usd!,'expected cost is below the ceiling');
  assert.ok(estimate.ceilingForPlannedCalls.usd!<estimate.worstCase.usd!,'the ceiling with reuse is below the no-reuse worst case');
  const oldWay=4*callUpperBoundUsd('gpt-4.1-mini',48000,5000,env)!;
  assert.ok(estimate.worstCase.usd!<oldWay,'never parts x the full 48,000/5,000-token allowance');
  assert.ok(estimate.expected.inputTokens>0&&estimate.expected.outputTokens>0);
  assert.equal(estimate.month?.capUsd,20);
  assert.ok(Math.abs(estimate.month!.committedUsd-callUpperBoundUsd('gpt-4.1-mini',800,200,env)!)<1e-6,'actual month-to-date spend from the ledger');
  assert.ok(Math.abs(estimate.month!.remainingUsd-(20-estimate.month!.committedUsd))<1e-9);
  assert.match(estimate.statement,/4 parts not fully read \(tables\)\. 2 unique structures; 2 AI calls after reuse\. Expected cost about USD/);
  const coverage=aiReadingCoverage([{sourceHashSha256:'A',semanticAiSteps:[{sourceHashSha256:'A',status:'call_limit',attempted:false}]}],{providerConfigured:true,estimatedMaxUsdPerCall:0.0272});
  assert.doesNotMatch(coverage.statement!,/USD/,'the documents line no longer quotes parts x the largest call');
  assert.equal(coverage.estimatedMaxUsdToFinish,null);
});

test('6. a request that never left this server releases its reservation; a sent request with unknown usage keeps it',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-reservation-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const env={CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'1'};
  const ledger=()=>JSON.parse(readFileSync(join(dir,new Date().toISOString().slice(0,7)+'.json'),'utf8'));
  reserveModelUsage('gpt-4.1-mini',1000,500,env)!.release();
  assert.equal(ledger().reservedMicros,0);assert.equal(ledger().calls,0);
  const refused=Object.assign(new TypeError('fetch failed'),{cause:Object.assign(new Error('connect'),{code:'ECONNREFUSED'})});
  assert.equal(requestNeverSent(refused),true);
  assert.equal(requestNeverSent(new DOMException('timed out','TimeoutError')),false);
  const schema={type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false};
  const budget={CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'1'};
  const notSent=new OpenAiAskModel('k','gpt-4.1-mini',(async()=>{throw refused;}) as typeof fetch,configuredModelLimits({}),{},budget);
  await assert.rejects(()=>notSent.structured('t',schema,'Return ok.',{ok:true}),/PROVIDER_UNAVAILABLE/);
  assert.equal(ledger().reservedMicros,0,'never sent: released');
  const sentUnknown=new OpenAiAskModel('k','gpt-4.1-mini',(async()=>{throw new DOMException('timed out','TimeoutError');}) as typeof fetch,configuredModelLimits({}),{},budget);
  await assert.rejects(()=>sentUnknown.structured('t',schema,'Return ok.',{ok:true}),/PROVIDER_UNAVAILABLE/);
  const held=ledger().reservedMicros;
  assert.ok(held>0,'may have been sent: the conservative reservation is kept');
  // The reservation is this request's own ceiling (payload + full output allowance), not 48,000 input tokens.
  assert.ok(held<callUpperBoundUsd('gpt-4.1-mini',48000,5000,{})!*1e6);
  assert.ok(held>=callUpperBoundUsd('gpt-4.1-mini',0,5000,{})!*1e6,'the full output allowance stays reserved');
});

test('5b. the estimate route plans without calling or changing the project; a run whose work grew past the approved ceiling does not start',async t=>{
  const {runtimeProjects}=await import('../packages/runtime-api/src/project-state');
  const {createCmengServer}=await import('../packages/runtime-api/src/server');
  const {randomUUID}=await import('node:crypto');
  const dir=mkdtempSync(join(tmpdir(),'cmeng-estimate-route-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const saved={...process.env};t.after(()=>{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);});
  // A configured provider whose transport must never be reached by this test.
  Object.assign(process.env,{CMENG_ASK_AI_API_KEY:'fake',CMENG_ASK_AI_MODEL:'gpt-4.1-mini',CMENG_ASK_AI_PROTOCOL:'responses',CMENG_ASK_AI_BASE_URL:'http://127.0.0.1:9/v1',CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'20'});
  const projectId='COST-'+randomUUID().slice(0,8);
  // Two files, one layout, different records (October and November logs).
  for(const [name,month] of [['RFI-Oct.csv','10'],['RFI-Nov.csv','11']] as const)
    await runtimeProjects.ingestEvidenceFile({projectId,bytes:Buffer.from('RFI ID,Subject,Status,Date Raised,Response Due,Site Weather\nRFI-'+month+'1,Door detail,Open,2031-'+month+'-02,2031-'+month+'-09,Sunny\nRFI-'+month+'2,Slab edge,Closed,2031-'+month+'-03,2031-'+month+'-10,Rain\n'),mediaType:'text/csv',sourceFilename:name,uploadedAt:'2031-12-05'});
  const state=runtimeProjects.get(projectId)!;
  for(const document of state.evidenceDocuments)delete (document as {semanticAiSteps?:unknown}).semanticAiSteps;
  const before=JSON.stringify(state.evidenceDocuments),version=state.version;
  const server=createCmengServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const base='http://127.0.0.1:'+(server.address() as any).port+'/api/projects/'+projectId+'/evidence/ai-reading';
  const response=await fetch(base+'/estimate');assert.equal(response.status,200,await response.clone().text());
  const {estimate}=await response.json() as {estimate:any};
  assert.equal(estimate.pendingParts,2);
  assert.equal(estimate.uniqueStructures,1,'two files, one layout');
  assert.equal(estimate.aiCalls,1,'one call after reuse');
  assert.ok(estimate.expected.usd>0&&estimate.expected.usd<estimate.ceilingForPlannedCalls.usd);
  assert.equal(estimate.month.capUsd,20);
  assert.equal(JSON.stringify(state.evidenceDocuments),before,'planning changed nothing');assert.equal(state.version,version);
  // The approval is the most the reading can cost; a smaller approval than the work now needs is
  // refused before any provider request.
  const refused=await fetch(base,{method:'POST',headers:{'content-type':'application/json','x-cmeng-paid-ai':'1'},body:JSON.stringify({approvedCeilingUsd:estimate.worstCase.usd/10})});
  assert.equal(refused.status,409);assert.equal((await refused.json() as any).error,'estimate_changed');
  assert.equal(JSON.stringify(state.evidenceDocuments),before,'nothing was read');
});
