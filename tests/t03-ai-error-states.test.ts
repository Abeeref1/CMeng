import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {collectAiHeadingOverrides} from '../packages/contract-parser/src/ai';
import type {ContractAiResolver,ContractTextBlock} from '../packages/contract-parser/src';
import {enrichRegisterSheetSemantics,RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {GroundedTableSemanticAiResolver,type TableSemanticAiResolver} from '../packages/runtime-api/src/evidence-semantic-ai';
import {OpenAiAskModel,configuredModelLimits} from '../packages/project-ask/src/provider';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {linkCandidatesRequest,linkDataset} from '../packages/runtime-api/src/link-candidates';

const blocks:ContractTextBlock[]=[{sourceKind:'docx_paragraph',sourceIndex:1,page:null,block:1,
 text:'Clause ??? unresolved heading A\nClause ??? unresolved heading B\nClause ??? unresolved heading C'}];
const failing=(message:string)=>{let calls=0;return {get calls(){return calls;},resolver:{name:'fake',async resolveHeading(){calls++;throw new Error(message);}} as ContractAiResolver};};

test('T03 contract headings stop cleanly at the spending cap: one refused call, the rest not called',async()=>{
 const fake=failing('MODEL_MONTHLY_BUDGET_EXHAUSTED'),steps:any[]=[];
 const result=await collectAiHeadingOverrides(blocks,fake.resolver,{maxCalls:10,onStep:step=>steps.push(step)});
 assert.equal(fake.calls,1,'after the ledger refuses, no further call is attempted');
 assert.deepEqual(steps.map(step=>step.status),['stopped_at_cap','stopped_at_cap','stopped_at_cap']);
 assert.ok(steps.every(step=>step.attempted===false));
 assert.equal(result.overrides.size,0);
});

test('T03 contract AI error states get their own status and never produce a heading',async()=>{
 for(const [message,status] of [['MODEL_PROVIDER_UNAVAILABLE','provider_error'],['MODEL_RESPONSE_INVALID','invalid_response'],['MODEL_RESPONSE_INCOMPLETE','invalid_response'],['boom','failed']] as const){
  const fake=failing(message),steps:any[]=[];
  const result=await collectAiHeadingOverrides(blocks,fake.resolver,{maxCalls:10,onStep:step=>steps.push(step)});
  assert.ok(steps.every(step=>step.status===status&&step.attempted===true),message);
  assert.equal(result.overrides.size,0,message);
 }
});

const sheetRows=()=>[['Project Ref','Unfamiliar Code','Unknown Value'],['PK-001','W-77','A'],['PK-002','W-78','B'],['PK-003','W-79','C']];
test('T03 sheet AI error states (provider down or timed out, invalid answer) are shown per step and nothing is marked AI-read',async()=>{
 for(const [response,status] of [[()=>{throw new TypeError('fetch failed');},'provider_error'],[()=>new Response('{}',{status:503}),'provider_error'],
   [()=>new Response('not json',{status:200}),'invalid_response'],[()=>new Response(JSON.stringify({status:'incomplete'}),{status:200}),'invalid_response']] as const){
  const dir=mkdtempSync(join(tmpdir(),'t03-err-'));
  try{
   const model=new OpenAiAskModel('fake','gpt-4.1-mini',(async()=>response()) as unknown as typeof fetch,configuredModelLimits({}),{},{CMENG_AI_USAGE_DIR:dir,CMENG_AI_MONTHLY_USD:'5'});
   const read={producerVersion:'t',sourceHashSha256:'H',sheets:[{name:'S1',rows:sheetRows()}]} as any,steps:any[]=[];
   await enrichRegisterSheetSemantics(read,{resolver:new GroundedTableSemanticAiResolver(model),requested:true,steps});
   assert.equal(steps[0]?.status,status);
   assert.equal(steps[0]?.attempted,true);
   assert.match(steps[0]?.note,status==='provider_error'?/unavailable or timed out/:/incomplete or unreadable/);
   assert.notEqual(read.sheets[0].semantic?.method,'ai_grounded');
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});

const csvRows=[['ABC','Cut','Q1','Q2','FX','Stage'],['PC-1','2039-01-31','1000','900','AED','Paid'],['PC-2','2039-02-28','1800','1700','AED','Certified'],['PC-3','2039-03-31','2500','2400','AED','Open']];
test('T03 CSV AI reading: spending cap and provider errors get their own status and leave the source unread by AI',async t=>{
 for(const [message,status,attempted] of [['MODEL_MONTHLY_BUDGET_EXHAUSTED','stopped_at_cap',false],['MODEL_PROVIDER_UNAVAILABLE','provider_error',true],['MODEL_RESPONSE_INVALID','invalid_response',true]] as const){
  const dir=mkdtempSync(join(tmpdir(),'t03-csv-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let calls=0;
  const resolver:TableSemanticAiResolver={name:'fake',async resolveTable(){calls++;throw new Error(message);}};
  const store=new RuntimeProjectStore({dataDir:dir,durable:false,semanticAiResolver:resolver});
  await store.ingestEvidenceFile({projectId:'T03-CSV',bytes:Buffer.from(csvRows.map(row=>row.join(',')).join('\n')),mediaType:'text/csv',sourceFilename:'opaque_t03.csv',
   sourceRelativePath:'opaque_t03.csv',uploadedAt:'2039-04-01T00:00:00.000Z',uploadIntent:'add_update',allowSemanticAi:true});
  const doc=store.get('T03-CSV')!.evidenceDocuments.find(d=>d.sourceFilename==='opaque_t03.csv')!;
  assert.equal(calls,1,message);
  const step=doc.semanticAiSteps!.find(s=>s.sheetName==='CSV')!;
  assert.equal(step.status,status,message);
  assert.equal(step.attempted,attempted,message);
  assert.notEqual(doc.csvSemantic?.method,'ai_grounded',message);
  assert.equal(store.get('T03-CSV')!.controls.invoices.length,0,'nothing is read into payment controls from a failed AI step');
 }
});

test('T03 suggest handler matches an explicit cited reference without calling the paid AI',async t=>{
 const state=loadCertifiedDemoProject('T03-LINK-'+randomUUID()),id=state.projectId;
 const data=linkDataset(state,'boq_activity');
 const target=data.targets.find(x=>/\d/.test(x.reference)&&x.reference.length>=3)!;assert.ok(target);
 // The source record cites the activity by its own reference, as a BOQ remark would.
 const source=data.sources[0]!;source.description=source.description+' see activity '+target.reference;
 const fetchOriginal=globalThis.fetch;let calls=0;
 globalThis.fetch=(async(url:any,options:any)=>{if(String(url).startsWith('http://127.0.0.1'))return fetchOriginal(url,options);calls++;throw new Error('no paid call allowed');}) as typeof fetch;
 t.after(()=>{globalThis.fetch=fetchOriginal;});
 const server=createServer((req,res)=>{void linkCandidatesRequest(req,res,new URL(req.url!,'http://localhost')).then(handled=>{if(!handled){res.statusCode=404;res.end();}});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const response=await fetchOriginal('http://127.0.0.1:'+((server.address() as any).port)+'/api/projects/'+id+'/link-candidates/suggest',{method:'POST',
  headers:{'content-type':'application/json','x-cmeng-paid-ai':'1'},body:JSON.stringify({kind:'boq_activity',sourceId:source.id,expectedVersion:state.version})});
 const body:any=await response.json();
 assert.equal(response.status,200,JSON.stringify(body));
 assert.equal(body.explicitReference,true);
 assert.equal(body.aiInvoked,false);
 assert.equal(calls,0,'no provider request');
 assert.ok(body.rows.some((row:any)=>row.targetId===target.id&&row.state==='candidate'&&/not AI-read/.test(row.reason)));
 assert.equal(body.automaticallyApproved,false);
});
