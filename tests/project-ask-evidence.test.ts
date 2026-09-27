import test from 'node:test';
import assert from 'node:assert/strict';
import type {AnalysisResult,AnalysisTable,AskSession,Finding} from '../packages/project-ask/src/types';
import {resolveIntent} from '../packages/project-ask/src/intent';
import {columnsFor,queryTable} from '../packages/project-ask/src/primitives';
import {isSocial,routeRequest} from '../packages/project-ask/src/router';
import {selectEvidence,retrieveEvidence,retrievePassages,type EvidenceItem,type ReferencePage} from '../packages/project-ask/src/evidence';
import {OpenAiAskModel,configuredModelLimits,estimateTokens} from '../packages/project-ask/src/provider';
const user:AskSession={userId:'u',workspaceId:'w',name:null,title:null,company:null,allowModel:true};
const catalogue=[{id:'boq',title:'BOQ',description:'Controlled BOQ',module:'boq',domains:['boq' as const],concepts:['boq','cost items'],fields:['amount'],historical:false},{id:'risks',title:'Risk',description:'Governed risk',module:'delivery-risks',domains:['delivery' as const],concepts:['risk'],fields:['score'],historical:false}];
function analysis(rows:AnalysisTable['rows'],authorityId='activities',findings:Finding[]=[]):AnalysisResult{
  const plan=resolveIntent('Explain the project exceptions',catalogue,user,null,null).plan;
  return {schemaVersion:1,id:'analysis-A',conversationId:'conversation-A',createdAt:'2026-08-31',scope:{scopeType:'project',projectId:'PROJECT-A',projectName:'A',workspaceId:'w',userId:'u',projectVersion:4,dataDate:'2026-08-31',authorityState:'adopted',programmeRevision:'revision-A',pageContext:null},plan,presentation:{title:'Evidence review',audience:'project',language:'en',detail:'normal',charts:true,preparedBy:null,jobTitle:null,company:null,reportNumber:null,confidentiality:'Project',status:'Draft / Prepared',format:'interactive'},mode:'Deterministic CMeng Summary',sections:[{authorityId,title:authorityId,state:'established',explanation:'Complete governed population at Data Date.',metrics:[{id:'m.zero',label:'Verified zero',value:0,unit:'records',state:'established',classification:'project_fact',traceId:'trace-A',basis:'Controlled register'},{id:'m.missing',label:'Unknown',value:null,unit:'records',state:'unavailable',classification:'project_fact',traceId:'trace-A',basis:'Missing supporting record'}],tables:[{id:'table-A',title:'Full population',authorityId,columns:columnsFor(rows,{amount:{aggregate:'sum',unit:'AED'}}),rows,population:rows.length,excluded:0,state:'established',basis:'Whole applicable population; no source sample.',traceId:'trace-A'}],charts:[],findings,traces:[{id:'trace-A',authorityId,projectId:'PROJECT-A',module:authorityId,path:'rows',sourceRefs:['source-A'],dataDate:'2026-08-31',basis:'Governed source',exclusions:[],state:'established'}]}],narrative:[],unresolved:['An independent measure is unavailable.'],referenceFiles:[],snapshotHash:'snapshot-A',factsHash:'facts-A',providerStatus:'not_needed',route:'cross_domain_diagnostic'};
}
function finding(index:number):Finding{return {id:'finding-'+index,severity:'action',title:'Constraint '+index,explanation:'Distinct required action for scope '+index,traceIds:['trace-A'],values:{exposure:index},action:'Review the linked source evidence.',owner:null,dueBasis:null};}
function response(input:any){return {...input.scope,evidenceHash:input.evidenceHash,coveredEvidenceIds:input.items.map((i:EvidenceItem)=>i.id),unresolvedAcknowledged:true,retrieval:[],blocks:[{heading:'Evidence review',text:'The controlled exceptions require attention. The available evidence does not establish a cause. Resolve the disclosed gaps before relying on a complete position.',traceIds:['trace-A'],evidenceIds:input.items.map((i:EvidenceItem)=>i.id),entityIds:[],claimScope:'selected_evidence',claimType:'recommendation'}]};}
function mockProvider(transform?:(input:any,stage:string,call:number)=>any){const requests:any[]=[];const request:typeof fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body)),input=JSON.parse(body.input);requests.push({body,input});const output=transform?transform(input,body.text.format.name,requests.length):response(input);return new Response(JSON.stringify({status:'completed',usage:{input_tokens:111,output_tokens:33},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]}));};return {requests,request};}

test('social classification stays lightweight while a mixed greeting retains the real request',()=>{
  for(const question of ['Good morning, how are you today?','Hello!','Thanks','Okay','السلام عليكم'])assert.equal(isSocial(question),true,question);
  const q='Good morning. Why did our completion date move?',plan=resolveIntent(q,catalogue,user,null,null).plan;
  assert.equal(isSocial(q),false);assert.ok(['ai_explanation','cross_domain_diagnostic'].includes(routeRequest(q,plan)));
});
test('full 140,000-row population is scanned; the last critical exception is selected and ordinary populations aggregate',()=>{
  const result=analysis(Array.from({length:100000},(_,i)=>({activityId:'A'+i,totalFloatHours:i===99999?-200:40,critical:i===99999}))),section=result.sections[0]!;
  section.tables.push({...section.tables[0]!,id:'boq',authorityId:'boq',rows:Array.from({length:30000},(_,i)=>({reference:'B'+i,amount:i,currency:'AED'})),columns:columnsFor([{reference:'B',amount:0,currency:'AED'}],{amount:{aggregate:'sum',unit:'AED'}}),population:30000});
  section.tables.push({...section.tables[0]!,id:'materials',authorityId:'materials',rows:Array.from({length:10000},(_,i)=>({reference:'M'+i,headroomCalendarDays:i===9999?-50:20})),columns:columnsFor([{reference:'M',headroomCalendarDays:0}]),population:10000});
  const pkg=selectEvidence(result),rows=pkg.items.filter(i=>i.kind==='row');
  assert.ok(rows.some(i=>(i.data as any).row.activityId==='A99999'));assert.ok(rows.length<100);
  assert.equal(pkg.coverage.entries.filter(c=>c.id!=='activities:findings').reduce((n,c)=>n+c.directlyRepresented+c.aggregated,0),140000);
  assert.equal(pkg.coverage.entries.find(c=>c.id==='table-A')!.mandatoryPopulation,1);
  assert.ok(estimateTokens(pkg)<60000,'compact evidence must not contain the raw population');
  const reversed=structuredClone(result);reversed.sections[0]!.tables.forEach(t=>t.rows.reverse());
  assert.equal(selectEvidence(reversed).coverage.evidenceHash,pkg.coverage.evidenceHash,'source ordering must not choose the evidence');
});
test('explicit Top 20 is ranked over every row and all twenty reach the provider, including a last-row maximum',async()=>{
  const result=analysis(Array.from({length:75},(_,i)=>({reference:'BOQ-'+i,amount:i===74?10000:i,currency:'AED'})),'boq');
  result.plan=resolveIntent('Explain Top 20 BOQ cost items',catalogue,user,null,null).plan;
  result.sections[0]!.tables[0]=queryTable(result.sections[0]!.tables[0]!,result.plan).table;
  assert.equal(result.sections[0]!.tables[0]!.rows[0]!.reference,'BOQ-74');
  const mock=mockProvider();await new OpenAiAskModel('fake','fake',mock.request).explain(result,[]);
  assert.equal(mock.requests[0].input.items.filter((i:EvidenceItem)=>i.kind==='row').length,20);
  assert.equal(result.coverage!.entries.find(c=>c.id==='table-A')!.mandatoryRepresented,20);
  assert.equal(result.telemetry!.calls[0]!.inputTokens,111);assert.equal(result.telemetry!.calls[0]!.outputTokens,33);
  assert.equal(mock.requests[0].body.store,false);assert.equal(mock.requests[0].body.tools,undefined);
});
test('many independent action findings are batched completely; no first-eight or first-two fallback',async()=>{
  const result=analysis([], 'activities',Array.from({length:110},(_,i)=>({...finding(i),explanation:'Independent blocking constraint '+i+'. '+('Source-qualified detail. '.repeat(14))})));
  const mock=mockProvider(),limits={...configuredModelLimits({}),contextTokens:24000,totalInputTokens:400000,maxCalls:20};
  await new OpenAiAskModel('fake','fake',mock.request,limits).explain(result,[]);
  const sectionCalls=mock.requests.filter(r=>r.body.text.format.name==='cmeng_project_section');assert.ok(sectionCalls.length>1);
  const seen=new Set(sectionCalls.flatMap(r=>r.input.items.filter((i:EvidenceItem)=>i.kind==='finding').map((i:EvidenceItem)=>i.id)));
  assert.equal(seen.size,110);assert.ok(seen.has('finding-109'));assert.equal(result.coverage!.representedToModel,true);
  assert.ok(mock.requests.every(r=>estimateTokens({instructions:r.body.instructions,input:r.input,schema:r.body.text.format.schema})+limits.safetyTokens+limits.outputTokens<=limits.contextTokens));
});
test('all pages and complete page text are searched: relevant evidence on page 76 beyond character 3000 wins',async()=>{
  const pages:ReferencePage[]=Array.from({length:100},(_,i)=>({filename:'Long report.pdf',fileId:'ref-A',hash:'hash-A',page:i+1,text:i===75?'Ordinary introduction. '.repeat(200)+'Transformer procurement acceptance constraint: permit denied.':'Ordinary meeting attendance and administration.'}));
  const result=analysis([]);result.plan.objective='Explain the transformer procurement acceptance constraint';
  const selected=retrievePassages(pages,result.plan.objective,6);assert.equal(selected.passages[0]!.page,76);assert.ok(selected.passages[0]!.start>3000);
  const mock=mockProvider();await new OpenAiAskModel('fake','fake',mock.request).explain(result,pages);
  assert.ok(mock.requests[0].input.items.some((i:EvidenceItem)=>i.kind==='passage'&&(i.data as any).page===76));
  assert.equal(result.coverage!.sourceComplete,false);assert.equal(result.coverage!.entries.find(c=>c.id==='reference-passages')!.sourcePopulation,100);
});
test('controlled retrieval cannot cross project/version/date, invent fields or exceed the per-analysis record budget',async()=>{
  const result=analysis([{activityId:'A1',totalFloatHours:10},{activityId:'A2',totalFloatHours:-2}]);
  const request={projectId:'PROJECT-A',projectVersion:4,dataDate:'2026-08-31',kind:'rows' as const,target:'table-A',query:'A2',filters:[],offset:0,limit:1};
  assert.equal((retrieveEvidence(result,[],request,5).rows[0] as any).activityId,'A2');
  for(const mutation of [{projectId:'PROJECT-B'},{projectVersion:5},{dataDate:'2026-09-30'},{target:'private-database'},{limit:500},{filters:[{field:'secret',operator:'eq',value:'x',upper:null}]}])assert.throws(()=>retrieveEvidence(result,[],{...request,...mutation} as any,5),/RETRIEVAL_/);
  const mock=mockProvider((input,_stage,call)=>call===1?{...response(input),blocks:[],retrieval:[request]}:response(input));
  await new OpenAiAskModel('fake','fake',mock.request).explain(result,[]);
  assert.equal(result.telemetry!.retrievalRounds,1);assert.equal(result.telemetry!.retrievedRecords,1);assert.ok(mock.requests[1].input.items.some((i:EvidenceItem)=>i.id==='retrieved:1:0'));
  const loop=mockProvider(input=>({...response(input),blocks:[],retrieval:[request]}));
  await assert.rejects(()=>new OpenAiAskModel('fake','fake',loop.request,{...configuredModelLimits({}),retrievalRounds:1}).explain(analysis([{activityId:'A2'}]),[]),/RETRIEVAL_LIMIT/);
  assert.equal(loop.requests.length,2);
});
test('validation rejects missing mandatory evidence, wrong scope, invented entities, unsupported blanket conclusions and causal entitlement',async()=>{
  const mutations=[(o:any)=>{o.coveredEvidenceIds=[];},(o:any)=>{o.projectId='PROJECT-B';},(o:any)=>{o.blocks[0].entityIds=['invented'];},(o:any)=>{o.blocks[0].text='All activities are on track.';},(o:any)=>{o.blocks[0].text='The delay is caused by the supplier.';o.blocks[0].claimType='observation';},(o:any)=>{o.blocks[0].text='Supplier PhantomCo caused the delay.';},(o:any)=>{o.blocks[0].text='CPI is 1.23';},(o:any)=>{o.blocks[0].traceIds=['alien-trace'];},(o:any)=>{o.unresolvedAcknowledged=false;}];
  for(const mutate of mutations){const result=analysis([{activityId:'LAST',critical:true}], 'activities',[finding(1)]),mock=mockProvider(input=>{const output=response(input);mutate(output);return output;});await assert.rejects(()=>new OpenAiAskModel('fake','fake',mock.request).explain(result,[]),/MODEL_/);assert.equal(result.coverage!.representedToModel,false);}
});
test('wrong user premise does not select only corroborating evidence; missing and zero are retained distinctly',async()=>{
  const result=analysis([{activityId:'CLEAR',critical:false,totalFloatHours:40}]);result.plan.objective='Explain why supplier performance is the cause of delay';
  result.sections[0]!.findings=[{...finding(1),title:'Workfront permit blocked',explanation:'Workfront permit is unresolved; procurement delivery is complete.'}];
  const mock=mockProvider(input=>({...response(input),blocks:[{...response(input).blocks[0],text:'The premise is not established. The controlled finding identifies an unresolved workfront permit. Delivery status alone does not establish the cause of programme delay.'}]}));
  await new OpenAiAskModel('fake','fake',mock.request).explain(result,[]);
  const items=mock.requests[0].input.items;assert.ok(items.some((i:EvidenceItem)=>i.kind==='finding'&&(i.data as any).title==='Workfront permit blocked'));
  assert.equal(items.find((i:EvidenceItem)=>i.id==='m.zero').data.value,0);assert.equal(items.find((i:EvidenceItem)=>i.id==='m.missing').data.value,null);
});
test('oversized indivisible mandatory evidence stops before network, and optional critic may reject a major output',async()=>{
  const result=analysis([], 'activities',[{...finding(1),explanation:'Mandatory '.repeat(10000)}]),mock=mockProvider();
  await assert.rejects(()=>new OpenAiAskModel('fake','fake',mock.request).explain(result,[]),/MANDATORY_ITEM_CONTEXT_LIMIT/);assert.equal(mock.requests.length,0);
  const critique=mockProvider((input,stage)=>stage==='cmeng_project_critic'?{accepted:false,issues:[{code:'overstated',evidenceIds:['finding-1'],reason:'Qualification missing.'}]}:response(input));
  const smaller=analysis([], 'activities',[finding(1)]);await assert.rejects(()=>new OpenAiAskModel('fake','fake',critique.request,{...configuredModelLimits({}),critic:true}).explain(smaller,[]),/CRITIC_REJECTED/);assert.equal(smaller.telemetry!.criticUsed,true);
});

test('configured compatible provider transport retains the same grounding and usage validation',async()=>{
 const result=analysis([{reference:'A',amount:12}]);let called='';
 const request:typeof fetch=async(url,init)=>{called=String(url);const body=JSON.parse(String(init?.body)),input=JSON.parse(body.messages[1].content);assert.equal(body.store,false);assert.equal((init?.headers as any).authorization,undefined);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(response(input))}}],usage:{prompt_tokens:120,completion_tokens:35}}));};
 await new OpenAiAskModel('','on-prem-model',request,configuredModelLimits({}),{baseUrl:'http://customer-model.internal/v1',protocol:'chat-completions'}).explain(result,[]);
 assert.equal(called,'http://customer-model.internal/v1/chat/completions');assert.equal(result.telemetry!.calls[0]!.inputTokens,120);assert.equal(result.telemetry!.calls[0]!.outputTokens,35);
});

test('monetary Top N never ranks incomparable currencies by raw numbers',()=>{
 const result=analysis([{reference:'AED',amount:100,currency:'AED'},{reference:'USD',amount:90,currency:'USD'}],'boq');const table=result.sections[0]!.tables[0]!;table.columns.find(c=>c.key==='amount')!.unit='row currency';const plan=resolveIntent('Top 1 BOQ cost items',catalogue,user,null,null).plan;
 const queried=queryTable(table,plan);assert.equal(queried.table.selection!.ranked,false);assert.equal(queried.table.rows.length,2);assert.ok(queried.gaps.some(g=>g.includes('single currency')));
});
