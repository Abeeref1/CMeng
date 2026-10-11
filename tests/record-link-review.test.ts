import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {proposeRecordLinks,validateLinkProposals,shortlistLinks,activeConfirmedLinks,latestLinkDecision,compatibleLink,type LinkContext,type LinkRecord,type RecordLinkReview} from '../packages/runtime-api/src/record-link-review';
import {sourceCommercialEvidence} from '../packages/runtime-api/src/source-commercial-evidence';
import {createCmengServer} from '../packages/runtime-api/src/server';
import {runtimeProjects,RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {currentLinkContext} from '../packages/runtime-api/src/link-review-context';
import {boqProgrammeLinks} from '../packages/runtime-api/src/boq-programme-links';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {askProviderConfiguration} from '../packages/project-ask/src/provider';
const record=(id:string,extra:Partial<LinkRecord>={}):LinkRecord=>({id,reference:id,label:'Concrete slab',text:'reinforced concrete slab level one',sourceRefs:['source:'+id],...extra});
const context=(kind:LinkContext['kind']='boq_activity'):LinkContext=>({kind,basisHash:'source-v1',basis:'Original sources',sources:[record('B1',{date:'2026-08-12',currency:'SAR',amount:100})],targets:[record('A1',{date:'2026-08-01',currency:'SAR',amount:100})]});
const reviewDecision=(id:string,decision:'confirmed'|'revoked'|'rejected',basisHash='source-v1')=>({candidateId:id,decision,actorId:'verified-user',decidedAt:'2026-10-11T09:00:00Z',reason:'Compared original records',sourceRef:'contract page 3',basisHash});

test('S-17/S-21 rules and AI proposals never approve a relationship or mutate facts',async()=>{
 for(const kind of ['boq_activity','payment_certificate'] as const){
  const ctx=context(kind),original=JSON.stringify(ctx),candidates=await proposeRecordLinks(ctx,['B1'],'reviewer',null);
  assert.equal(candidates.length,1);assert.equal(candidates[0]!.confidence,null);
  assert.equal(activeConfirmedLinks({candidates,decisions:[]},ctx).length,0);
  assert.equal(JSON.stringify(ctx),original);
  const result=await proposeRecordLinks(ctx,['B1'],'reviewer',{structured:async()=>({basisHash:ctx.basisHash,proposals:[{sourceId:'B1',targetId:'A1',confidence:0.9,reason:'Matching source scope'}]})});
  assert.equal(result[0]!.method,'ai');assert.equal(activeConfirmedLinks({candidates:result,decisions:[]},ctx).length,0);
  assert.equal(JSON.stringify(ctx),original);
 }
});
test('S-17/S-21 rejects invented identities, values, invalid confidence and stale source versions',()=>{
 const ctx=context(),list=shortlistLinks(ctx,['B1']),good={sourceId:'B1',targetId:'A1',confidence:0.91,reason:'Shared source description'};
 for(const patch of [{targetId:'invented'},{sourceId:'other-project'},{confidence:0.2},{confidence:NaN},{confidence:2},{amount:1000},{reason:''},{reason:'x'.repeat(601)}])assert.equal(validateLinkProposals(ctx,list,{basisHash:ctx.basisHash,proposals:[{...good,...patch}]}).length,0);
 assert.equal(validateLinkProposals(ctx,list,{basisHash:'old-version',proposals:[good]}).length,0);
 assert.equal(validateLinkProposals(ctx,list,{basisHash:ctx.basisHash,proposals:[good],approved:true}).length,0);
 assert.equal(validateLinkProposals(ctx,list,{basisHash:ctx.basisHash,proposals:[good,good]}).length,1);
});
test('S-21 rejects incompatible or impossible dated payment relationships',()=>{
 const s=record('P',{date:'2026-08-15',currency:'SAR',amount:100}),t=record('C',{date:'2026-08-01',currency:'SAR',amount:100});
 assert.equal(compatibleLink('payment_certificate',s,t),true);
 for(const extra of [{date:'2026-09-01'},{date:'2026-02-30'},{date:null},{currency:'AED'}])assert.equal(compatibleLink('payment_certificate',s,{...t,...extra}),false);
 assert.equal(compatibleLink('payment_certificate',{...s,amount:NaN},t),false);
 assert.equal(compatibleLink('boq_activity',record('B',{zone:'A'}),record('A',{zone:'B'})),false);
 assert.equal(compatibleLink('boq_activity',record('B',{unit:'m2'}),record('A',{unit:'m3'})),false);
});
test('confirmation is reversible and source changes invalidate previous decisions',async()=>{
 const ctx=context(),candidates=await proposeRecordLinks(ctx,['B1'],'owner',null),candidate=candidates[0]!,review:RecordLinkReview={candidates,decisions:[]};
 review.decisions.push(reviewDecision(candidate.id,'confirmed'));assert.equal(activeConfirmedLinks(review,ctx).length,1);
 review.decisions.push(reviewDecision(candidate.id,'revoked'));assert.equal(activeConfirmedLinks(review,ctx).length,0);
 review.decisions.push(reviewDecision(candidate.id,'confirmed'));assert.equal(activeConfirmedLinks(review,{...ctx,basisHash:'source-v2'}).length,0);
 assert.equal(activeConfirmedLinks(review,{...ctx,targets:[]}).length,0);
 assert.equal(review.decisions.length,3);
 assert.equal(latestLinkDecision(review,candidate.id)?.decision,'confirmed');
});
test('30,000 retained review decisions are indexed without losing or replacing history',()=>{
 const review:RecordLinkReview={candidates:[],decisions:Array.from({length:30000},(_,i)=>reviewDecision('link-'+i,'confirmed'))};
 for(let i=0;i<30000;i++)assert.equal(latestLinkDecision(review,'link-'+i)?.candidateId,'link-'+i);
 review.decisions.push(reviewDecision('link-29999','revoked'));assert.equal(latestLinkDecision(review,'link-29999')?.decision,'revoked');
 assert.equal(review.decisions.length,30001);
});
test('S-21 reviewed relationships count receipts once and never allocate cash',async()=>{
 const state:any={projectId:'LINK-SOURCE',version:1,evidenceDocuments:[],controls:{bonds:[]}};
 const ledger:any={payments:[{paymentId:'C-01',certificationDate:'2026-08-01',sourceStatus:'issued',amounts:{netCertifiedAmount:{value:100,currency:'SAR'}},receipt:{documentId:'cert',locator:'row1'}},
 {paymentId:'BANK-X',paymentReference:'TRANSFER-X',paymentDate:'2026-08-20',amounts:{paidAmount:{value:100,currency:'SAR'}},receipt:{documentId:'bank',locator:'row1'}}]};
 const original=JSON.stringify(ledger),first=sourceCommercialEvidence(state,ledger,{},'2026-08-31');
 assert.equal(first.paymentLinkage.linked,0);assert.equal(first.paymentLinkage.total,1);
 const ctx=(first.paymentLinkage as any).linkContext as LinkContext;
 const candidates=await proposeRecordLinks(ctx,[ctx.sources[0]!.id],'owner',null);assert.equal(candidates.length,1);
 state.recordLinkReview={candidates,decisions:[reviewDecision(candidates[0]!.id,'confirmed',ctx.basisHash)]};
 const confirmed=sourceCommercialEvidence(state,ledger,{},'2026-08-31');
 assert.equal(confirmed.paymentLinkage.linked,1);assert.equal(confirmed.paymentLinkage.coveragePercent,100);
 assert.equal(confirmed.paymentLinkage.rows[0]!.amount,100);assert.equal(JSON.stringify(ledger),original);
 assert.ok(!JSON.stringify(confirmed).includes('linkContext'),'Matching populations do not bloat every management response');
 state.recordLinkReview.decisions.push(reviewDecision(candidates[0]!.id,'revoked',ctx.basisHash));
 assert.equal(sourceCommercialEvidence(state,ledger,{},'2026-08-31').paymentLinkage.linked,0);
});
test('S-17 review API rejects forged users, persists verified decisions, and retains quantities',async()=>{
 const id='UAT-LINK-REVIEW',oldKey=process.env.CMENG_EXTERNAL_WORKER_KEY;
 process.env.CMENG_EXTERNAL_WORKER_KEY='isolated-test-key';loadCertifiedDemoProject(id);
 const state=runtimeProjects.get(id)!;state.quantities!.allocations=[];
 state.quantities!.items[0]!.description='Concrete FOUNDATION';runtimeProjects.touch(state);
 const ctx=currentLinkContext(state,'boq_activity');assert.ok(ctx.sources.length&&ctx.targets.length);
 const sourceId=ctx.sources[0]!.id,candidates=await proposeRecordLinks(ctx,[sourceId],'owner',null);assert.ok(candidates.length);
 state.recordLinkReview={candidates,decisions:[]};runtimeProjects.touch(state);
 const before=JSON.stringify(state.quantities),server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(server.address() as any).port+'/api/projects/'+id+'/link-review';
 const body={kind:'boq_activity',basisHash:ctx.basisHash,candidateId:candidates[0]!.id,decision:'confirmed',reason:'Source reference checked',sourceRef:'BOQ row 1'};
 const actor=Buffer.from(JSON.stringify({id:'test-owner'})).toString('base64url');
 const headers={'content-type':'application/json','x-cmeng-verified-actor':actor,'x-cmeng-verified-actor-signature':createHmac('sha256','isolated-test-key').update(actor).digest('hex')};
 try{
  const initial=await (await fetch(base+'?kind=boq_activity')).json() as any;assert.equal(initial.confirmationAllowed,false);
  const denied=await fetch(base+'/decide',{method:'POST',headers:{...headers,'x-cmeng-verified-actor-signature':'0'.repeat(64),'x-cmeng-paid-ai':'1'},body:JSON.stringify(body)});assert.equal(denied.status,403);
  assert.equal(state.recordLinkReview.decisions.length,0);
  const stale=await fetch(base+'/decide',{method:'POST',headers,body:JSON.stringify({...body,basisHash:'old'})});assert.equal(stale.status,409);
  const accepted=await fetch(base+'/decide',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(accepted.status,200,await accepted.text());
  assert.equal(state.recordLinkReview.decisions[0]?.actorId,'test-owner');assert.equal(JSON.stringify(state.quantities),before);
  const links=boqProgrammeLinks(state,projectControlSchedule(state)!.revision.model);assert.equal(links.confirmedRelationshipItemCount,1);assert.equal(links.approvedAllocatedItemCount,0);
  const dir=mkdtempSync(join(tmpdir(),'cmeng-link-restore-'));try{
   const store=new RuntimeProjectStore({dataDir:dir,durable:true}),copy=store.getOrCreate(id);Object.assign(copy,state);store.touch(copy);
   const restored=new RuntimeProjectStore({dataDir:dir,durable:true}).get(id)!;
   assert.deepEqual(restored.recordLinkReview,state.recordLinkReview);
   assert.equal(JSON.stringify(restored.quantities),before);
  }finally{rmSync(dir,{recursive:true,force:true});}
  const revoked=await fetch(base+'/decide',{method:'POST',headers,body:JSON.stringify({...body,decision:'revoked'})});assert.equal(revoked.status,200);
  assert.equal(boqProgrammeLinks(state,projectControlSchedule(state)!.revision.model).confirmedRelationshipItemCount,0);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(oldKey===undefined)delete process.env.CMENG_EXTERNAL_WORKER_KEY;else process.env.CMENG_EXTERNAL_WORKER_KEY=oldKey;}
});
test('provider configuration never exposes credentials and is independent of caller permission',()=>{
 const names=['CMENG_ASK_AI_API_KEY','CMENG_ASK_AI_MODEL','CMENG_ASK_AI_PROTOCOL','CMENG_ASK_AI_CONFIG_FILE','CMENG_ASK_AI_BASE_URL'],old=Object.fromEntries(names.map(key=>[key,process.env[key]]));
 try{for(const key of names)delete process.env[key];process.env.CMENG_ASK_AI_API_KEY='test-not-a-real-key';process.env.CMENG_ASK_AI_MODEL='gpt-4.1-mini';
  const status=askProviderConfiguration();assert.equal(status.configured,true);assert.ok(!JSON.stringify(status).includes('test-not-a-real-key'));
  process.env.CMENG_ASK_AI_PROTOCOL='none';assert.equal(askProviderConfiguration().configured,false);
 }finally{for(const key of names)if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}
});
