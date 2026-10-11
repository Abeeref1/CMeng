import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {runtimeProjects,RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {linkCandidatesRequest,linkDataset} from '../packages/runtime-api/src/link-candidates';
import {boqProgrammeLinks} from '../packages/runtime-api/src/boq-programme-links';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {assessLinkProposal,reviewLink,type LinkInput} from '../packages/runtime-api/src/link-candidate-core';

test('Candidate API denies anonymous spending; owner proposal requires explicit review and does not change BOQ figures',async t=>{
 const state=loadCertifiedDemoProject('TEST-LINK-'+randomUUID()),id=state.projectId;
 const before=JSON.stringify(state.quantities),data=linkDataset(state,'boq_activity');assert.ok(data.sources.length&&data.targets.length);
 const fetchOriginal=globalThis.fetch;let calls=0;
 const saved={key:process.env.CMENG_ASK_AI_API_KEY,model:process.env.CMENG_ASK_AI_MODEL,protocol:process.env.CMENG_ASK_AI_PROTOCOL,file:process.env.CMENG_ASK_AI_CONFIG_FILE,usage:process.env.CMENG_AI_USAGE_DIR};
 process.env.CMENG_ASK_AI_API_KEY='test-key-not-real';process.env.CMENG_ASK_AI_MODEL='gpt-4.1-mini';process.env.CMENG_ASK_AI_PROTOCOL='responses';delete process.env.CMENG_ASK_AI_CONFIG_FILE;delete process.env.CMENG_AI_USAGE_DIR;
 globalThis.fetch=(async(url:any,options:any)=>{
  if(!String(url).startsWith('https://api.openai.com/'))return fetchOriginal(url,options);
  calls++;const payload=JSON.parse(options.body),input=JSON.parse(payload.input),target=input.targets[0];
  const proposal={projectId:input.projectId,sourceId:input.source.id,requestHash:input.requestHash,matches:[{targetId:target.id,confidence:.94,reason:'Source description and programme scope support a relationship for explicit review.',sourceRefs:[input.source.sourceRefs[0],target.sourceRefs[0]]}]};
  return new Response(JSON.stringify({status:'completed',usage:{input_tokens:500,output_tokens:200},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(proposal)}]}]}),{status:200});
 }) as typeof fetch;
 t.after(()=>{globalThis.fetch=fetchOriginal;for(const [key,value] of Object.entries({CMENG_ASK_AI_API_KEY:saved.key,CMENG_ASK_AI_MODEL:saved.model,CMENG_ASK_AI_PROTOCOL:saved.protocol,CMENG_ASK_AI_CONFIG_FILE:saved.file,CMENG_AI_USAGE_DIR:saved.usage})){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 const server=createServer((req,res)=>{void linkCandidatesRequest(req,res,new URL(req.url!,'http://localhost')).then(handled=>{if(!handled){res.statusCode=404;res.end();}});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const base='http://127.0.0.1:'+((server.address() as any).port)+'/api/projects/'+id+'/link-candidates';
 const post=(path:string,payload:unknown,owner=false)=>fetchOriginal(base+path,{method:'POST',headers:{'content-type':'application/json','x-cmeng-paid-ai':owner?'1':'0'},body:JSON.stringify(payload)});
 const attempt={kind:'boq_activity',sourceId:data.sources[0]!.id,expectedVersion:state.version};
 const denied=await post('/suggest',attempt);assert.equal(denied.status,403);assert.equal(calls,0);
 const offered=await post('/suggest',attempt,true);const proposal:any=await offered.json();assert.equal(offered.status,200,JSON.stringify(proposal));assert.equal(proposal.rows.length,1);assert.equal(proposal.rows[0].state,'candidate');assert.equal(calls,1);assert.equal(JSON.stringify(state.quantities),before);
 const cached=await post('/suggest',{...attempt,expectedVersion:state.version},true);assert.equal((await cached.json() as any).cacheHit,true);assert.equal(calls,1);
 const reviewed=await post('/review',{id:proposal.rows[0].id,expectedVersion:state.version,decision:'confirm',confirmed:true,reviewer:'Independent test reviewer'});assert.equal(reviewed.status,200,await reviewed.text());
 assert.equal(state.linkCandidateReviews!.find(r=>r.id===proposal.rows[0].id)!.state,'confirmed');assert.equal(JSON.stringify(state.quantities),before);
 const links=boqProgrammeLinks(state,projectControlSchedule(state)!.revision.model);assert.equal(links.confirmedScopeLinkCount,1);
 const revoked=await post('/review',{id:proposal.rows[0].id,expectedVersion:state.version,decision:'reject',confirmed:true,reviewer:'Independent test reviewer'});assert.equal(revoked.status,200,await revoked.text());assert.equal(state.linkCandidateReviews!.find(r=>r.id===proposal.rows[0].id)!.state,'rejected');
});

test('Candidate approval, reviewer and source references survive store reload without source modifications',t=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-link-restore-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('LINK-RESTORE');
 const c:LinkInput={kind:'boq_activity',projectId:state.projectId,basisVersion:state.version,dataDateIso:'2026-08-31',requestHash:'known',source:{id:'B1',projectId:state.projectId,reference:'1',description:'Concrete',sourceRefs:['boq:row:2']},targets:[{id:'A1',projectId:state.projectId,reference:'A1',description:'Concrete pour',sourceRefs:['schedule:A1']}]};
 const rows=assessLinkProposal(c,{projectId:c.projectId,requestHash:c.requestHash,sourceId:'B1',matches:[{targetId:'A1',confidence:.96,reason:'Explicit same concrete workfront for review.',sourceRefs:['boq:row:2','schedule:A1']}]});
 state.linkCandidateReviews=reviewLink(rows,rows[0]!.id,state.version,{decision:'confirm',confirmed:true,reviewer:'Reviewer',actor:'test-owner'});store.touch(state);
 const reloaded=new RuntimeProjectStore({dataDir:dir,durable:false}).get(state.projectId)!;assert.equal(reloaded.linkCandidateReviews![0]!.state,'confirmed');assert.equal(reloaded.linkCandidateReviews![0]!.reviewedBy,'Reviewer');assert.equal(reloaded.linkCandidateReviews![0]!.basisVersion,reloaded.version);assert.equal(reloaded.schedules.length,0);assert.equal(reloaded.boq,null);
});
