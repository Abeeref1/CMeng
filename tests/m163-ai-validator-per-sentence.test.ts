import test from 'node:test';
import assert from 'node:assert/strict';
import type {AnalysisResult,AnalysisTable,AskSession,Finding} from '../packages/project-ask/src/types';
import {resolveIntent} from '../packages/project-ask/src/intent';
import {columnsFor} from '../packages/project-ask/src/primitives';
import type {EvidenceItem} from '../packages/project-ask/src/evidence';
import {OpenAiAskModel,configuredModelLimits} from '../packages/project-ask/src/provider';

// M16.3 invariant. The AI validator judges each sentence, not the whole answer.
// A sentence with a figure, name or conclusion the cited evidence does not support
// is left out and counted; the grounded sentences stand. A number that is part of
// a name in the cited evidence ("Level 2", "Clause 20.1") is grounded. The answer
// is rejected only when nothing grounded remains or a structural check fails
// (scope, coverage, citations). A critic concern removes the blocks it names.

const user:AskSession={userId:'u',workspaceId:'w',name:null,title:null,company:null,allowModel:true};
const catalogue=[{id:'risks',title:'Risk',description:'Governed risk',module:'delivery-risks',domains:['delivery' as const],concepts:['risk'],fields:['score'],historical:false}];
function finding(id:string,title:string,explanation:string):Finding{return {id,severity:'action',title,explanation,traceIds:['trace-A'],values:{},action:'Review the linked source evidence.',owner:null,dueBasis:null};}
function analysis(findings:Finding[],projectId='PROJECT-A'):AnalysisResult{
  const rows:AnalysisTable['rows']=[{activityId:'L2-POUR',description:'Level 2 slab pour'}];
  const plan=resolveIntent('Explain the project exceptions',catalogue,user,null,null).plan;
  return {schemaVersion:1,id:'analysis-A',conversationId:'conversation-A',createdAt:'2026-08-31',scope:{scopeType:'project',projectId,projectName:'A',workspaceId:'w',userId:'u',projectVersion:4,dataDate:'2026-08-31',authorityState:'adopted',programmeRevision:'revision-A',pageContext:null},plan,
    presentation:{title:'Evidence review',audience:'project',language:'en',detail:'normal',charts:true,preparedBy:null,jobTitle:null,company:null,reportNumber:null,confidentiality:'Project',status:'Draft / Prepared',format:'interactive'},mode:'Deterministic CMeng Summary',
    sections:[{authorityId:'activities',title:'activities',state:'established',explanation:'Complete governed population at Data Date.',metrics:[],
      tables:[{id:'table-A',title:'Full population',authorityId:'activities',columns:columnsFor(rows,{}),rows,population:rows.length,excluded:0,state:'established',basis:'Whole applicable population.',traceId:'trace-A'}],charts:[],findings,
      traces:[{id:'trace-A',authorityId:'activities',projectId,module:'activities',path:'rows',sourceRefs:['source-A'],dataDate:'2026-08-31',basis:'Governed source',exclusions:[],state:'established'}]}],
    narrative:[],unresolved:['An independent measure is unavailable.'],referenceFiles:[],snapshotHash:'snapshot-A',factsHash:'facts-A',providerStatus:'not_needed',route:'cross_domain_diagnostic'};
}
const held=()=>[finding('finding-1','Level 2 slab pour held','Clause 20.1 notice is required before the Level 2 slab pour.')];
type Block={heading:string;text:string;evidenceIds?:string[]};
function answer(input:any,blocks:Block[]){
  return {...input.scope,evidenceHash:input.evidenceHash,coveredEvidenceIds:input.items.map((i:EvidenceItem)=>i.id),unresolvedAcknowledged:true,retrieval:[],
    blocks:blocks.map(b=>({heading:b.heading,text:b.text,traceIds:['trace-A'],evidenceIds:b.evidenceIds??input.items.map((i:EvidenceItem)=>i.id),entityIds:[],claimScope:'selected_evidence',claimType:'recommendation'}))};
}
function provider(transform:(input:any,stage:string,call:number)=>any){
  const requests:any[]=[];
  const request:typeof fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body)),input=JSON.parse(body.input);requests.push({stage:body.text.format.name,input});
    return new Response(JSON.stringify({status:'completed',usage:{input_tokens:10,output_tokens:5},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(transform(input,body.text.format.name,requests.length))}]}]}));};
  return {requests,request};
}
const model=(request:typeof fetch,critic=false)=>new OpenAiAskModel('fake','fake',request,{...configuredModelLimits({}),critic});

test('M16.3: numbers that are part of names in the cited evidence ("Level 2", "Clause 20.1") are accepted',async()=>{
  const result=analysis(held());
  const mock=provider(input=>answer(input,[{heading:'Level 2 slab pour',text:'The Level 2 slab pour is held. Clause 20.1 requires notice before the hold is relied on.'}]));
  const blocks=await model(mock.request).explain(result,[]);
  assert.equal(mock.requests.length,1,'accepted first time');
  assert.equal(blocks.length,1);
  assert.match(blocks[0]!.text,/Level 2 slab pour is held/);assert.match(blocks[0]!.text,/Clause 20\.1 requires notice/);
  assert.ok(!result.telemetry!.validationFailures.some(c=>c.startsWith('SENTENCE_DROPPED')));
  assert.equal(result.coverage!.representedToModel,true);
});

test('M16.3: only the unsupported sentence is left out; the grounded sentences stand and the drop is counted and stated',async()=>{
  for(const bad of ['The delay is 45 days.','Clause 99.9 removes the notice requirement.','Supplier PhantomCo is late.','All activities are on track.']){
    const result=analysis(held());
    const mock=provider(input=>answer(input,[{heading:'Position',text:'The Level 2 slab pour is held. '+bad+' Clause 20.1 requires notice before the hold is relied on.'}]));
    const blocks=await model(mock.request).explain(result,[]);
    assert.equal(mock.requests.length,1,bad+': no rejection, no correction turn');
    assert.equal(blocks[0]!.text,'The Level 2 slab pour is held. Clause 20.1 requires notice before the hold is relied on.',bad);
    assert.equal(result.telemetry!.validationFailures.filter(c=>c.startsWith('SENTENCE_DROPPED:')).length,1,bad+': counted once');
    assert.ok(result.unresolved.some(u=>/left out 1 AI sentence/.test(u)),bad+': the drop is stated');
  }
  // A block with nothing grounded is dropped; the other block stands.
  const result=analysis(held());
  const mock=provider(input=>answer(input,[{heading:'Position',text:'The Level 2 slab pour is held.'},{heading:'Cost',text:'CPI is 1.23. The overrun is 4 million.'}]));
  const blocks=await model(mock.request).explain(result,[]);
  assert.deepEqual(blocks.map(b=>b.heading),['Position']);
  // An ungrounded heading drops its block.
  const headed=analysis(held());
  const h=provider(input=>answer(input,[{heading:'Position',text:'The Level 2 slab pour is held.'},{heading:'Week 47 outlook',text:'Clause 20.1 requires notice.'}]));
  assert.deepEqual((await model(h.request).explain(headed,[])).map(b=>b.heading),['Position']);
});

test('M16.3: an answer with no grounded sentence is rejected after one correction turn that names the dropped sentences',async()=>{
  const result=analysis(held());
  const mock=provider(input=>answer(input,[{heading:'Position',text:'The delay is 45 days. CPI is 1.23.'}]));
  await assert.rejects(()=>model(mock.request).explain(result,[]),/MODEL_UNGROUNDED_FACT/);
  assert.equal(mock.requests.length,2,'exactly one correction turn');
  assert.deepEqual(mock.requests[1].input.coverageCorrection.droppedSentences.map((d:any)=>d.sentence),['The delay is 45 days.','CPI is 1.23.']);
  assert.equal(result.coverage!.representedToModel,false);
  // The correction turn recovers: the second answer is grounded.
  const fixed=analysis(held());
  const once=provider((input,_stage,call)=>answer(input,[{heading:'Position',text:call===1?'The delay is 45 days.':'The Level 2 slab pour is held.'}]));
  const blocks=await model(once.request).explain(fixed,[]);
  assert.equal(once.requests.length,2);assert.equal(blocks[0]!.text,'The Level 2 slab pour is held.');
});

test('M16.3: block structure and evidence IDs get the same single correction turn',async()=>{
  for(const broken of [(o:any)=>{o.blocks=[];},(o:any)=>{o.blocks[0].evidenceIds=[];}]){
    const result=analysis(held());
    const mock=provider((input,_stage,call)=>{const o=answer(input,[{heading:'Position',text:'The Level 2 slab pour is held.'}]);if(call===1)broken(o);return o;});
    const blocks=await model(mock.request).explain(result,[]);
    assert.equal(mock.requests.length,2);assert.match(mock.requests[1].input.coverageCorrection.rejected,/MODEL_(COMMENTARY|EVIDENCE)_INVALID/);
    assert.equal(blocks[0]!.text,'The Level 2 slab pour is held.');
  }
});

test('M16.3: structural checks stay hard: wrong scope or an alien trace rejects the whole answer',async()=>{
  const scope=analysis(held());
  const wrong=provider(input=>({...answer(input,[{heading:'Position',text:'The Level 2 slab pour is held.'}]),projectId:'PROJECT-B'}));
  await assert.rejects(()=>model(wrong.request).explain(scope,[]),/MODEL_SCOPE_INVALID/);
  assert.equal(scope.coverage!.representedToModel,false);
  const trace=analysis(held());
  const alien=provider(input=>{const o=answer(input,[{heading:'Position',text:'The Level 2 slab pour is held.'}]);o.blocks[0].traceIds=['alien-trace'];return o;});
  await assert.rejects(()=>model(alien.request).explain(trace,[]),/MODEL_CITATION_INVALID/);
});

test('M16.3: a critic concern removes only the blocks citing the evidence it names; an unplaceable rejection still rejects',async()=>{
  const two=()=>analysis([...held(),finding('finding-2','Roof crane permit','Permit is not yet issued.')]);
  const blocks=(input:any)=>answer(input,[{heading:'Slab',text:'The Level 2 slab pour is held.',evidenceIds:['finding-1']},{heading:'Crane',text:'The roof crane permit is the binding constraint.',evidenceIds:['finding-2']}]);
  const result=two();
  const mock=provider((input,stage)=>stage==='cmeng_project_critic'?{accepted:false,issues:[{code:'overstated',evidenceIds:['finding-2'],reason:'Not established.'}]}:blocks(input));
  const out=await model(mock.request,true).explain(result,[]);
  assert.deepEqual(out.map(b=>b.heading),['Slab'],'only the questioned block is left out');
  assert.ok(result.unresolved.some(u=>/questioned 1 part/.test(u)));
  assert.ok(result.telemetry!.validationFailures.includes('CRITIC_ISSUE:overstated'));
  const vague=two();
  const v=provider((input,stage)=>stage==='cmeng_project_critic'?{accepted:false,issues:[{code:'scope',evidenceIds:[],reason:'Unclear.'}]}:blocks(input));
  await assert.rejects(()=>model(v.request,true).explain(vague,[]),/MODEL_CRITIC_REJECTED/);
  const noted=two();
  const n=provider((input,stage)=>stage==='cmeng_project_critic'?{accepted:true,issues:[{code:'qualification',evidenceIds:[],reason:'Add a qualification.'}]}:blocks(input));
  assert.equal((await model(n.request,true).explain(noted,[])).length,2,'accepted with a note: kept and qualified');
  assert.ok(noted.unresolved.some(u=>/read it as qualified/.test(u)));
});
