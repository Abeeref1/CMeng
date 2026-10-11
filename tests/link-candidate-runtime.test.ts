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
import {buildQuantityScheduleMapping} from '../packages/cross-domain-mapping/src/projector';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {assessLinkProposal,reviewLink,type LinkInput} from '../packages/runtime-api/src/link-candidate-core';
import {sourceCommercialEvidence} from '../packages/runtime-api/src/source-commercial-evidence';

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

test('S-21 confirmed payment-to-certificate relationship raises linkage coverage without changing money',()=>{
 const state=loadCertifiedDemoProject('PAY-LINK-'+randomUUID());state.evidenceDocuments=[];
 const money=(value:number|null)=>({value,currency:'AED',taxBasis:'exclusive',sourceRefs:[]});
 const certificate={paymentId:'IPC-03',periodEnd:'2026-07-31',sourceStatus:'Certified',certificationDate:'2026-08-01',paymentDate:null,paymentReference:null,receipt:{documentId:'certdoc',locator:'row:1'},amounts:{netCertifiedAmount:money(100),grossCertifiedAmount:money(100),employerCertifiedAmount:money(null),paidAmount:money(null)}};
 const receipt={paymentId:'BANK-42',periodEnd:null,sourceStatus:'Paid',certificationDate:null,paymentDate:'2026-08-20',paymentReference:'Bank transfer 42',receipt:{documentId:'paydoc',locator:'row:2'},amounts:{netCertifiedAmount:money(null),grossCertifiedAmount:money(null),employerCertifiedAmount:money(null),paidAmount:money(100)}};
 const ledger={payments:[certificate,receipt],bonds:[]};
 const before=JSON.stringify(ledger);
 state.linkCandidateReviews=[{id:'reviewed-payment-link',kind:'payment_certificate',state:'confirmed',basisVersion:state.version,sourceId:'paydoc:row:2',targetId:'certdoc:row:1'} as any];
 const position:any={certificateProfile:{groups:[]},currencies:[]};
 const result=sourceCommercialEvidence(state,ledger,position,'2026-08-31');
 assert.equal(result.paymentLinkage.total,1);assert.equal(result.paymentLinkage.linked,1);assert.equal(result.paymentLinkage.coveragePercent,100);
 assert.equal(result.paymentLinkage.rows[0]!.certificateReference,'IPC-03');assert.match(result.paymentLinkage.rows[0]!.basis,/user-confirmed certificate relationship/);
 assert.equal(JSON.stringify(ledger),before,'link review never changes source money');
});
test('Candidate approval, reviewer and source references survive store reload without source modifications',t=>{
 const dir=mkdtempSync(join(tmpdir(),'cmeng-link-restore-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('LINK-RESTORE');
 const c:LinkInput={kind:'boq_activity',projectId:state.projectId,basisVersion:state.version,dataDateIso:'2026-08-31',requestHash:'known',source:{id:'B1',projectId:state.projectId,reference:'1',description:'Concrete',sourceRefs:['boq:row:2']},targets:[{id:'A1',projectId:state.projectId,reference:'A1',description:'Concrete pour',sourceRefs:['schedule:A1']}]};
 const rows=assessLinkProposal(c,{projectId:c.projectId,requestHash:c.requestHash,sourceId:'B1',matches:[{targetId:'A1',confidence:.96,reason:'Explicit same concrete workfront for review.',sourceRefs:['boq:row:2','schedule:A1']}]});
 state.linkCandidateReviews=reviewLink(rows,rows[0]!.id,state.version,{decision:'confirm',confirmed:true,reviewer:'Reviewer',actor:'test-owner'});store.touch(state);
 const reloaded=new RuntimeProjectStore({dataDir:dir,durable:false}).get(state.projectId)!;assert.equal(reloaded.linkCandidateReviews![0]!.state,'confirmed');assert.equal(reloaded.linkCandidateReviews![0]!.reviewedBy,'Reviewer');assert.equal(reloaded.linkCandidateReviews![0]!.basisVersion,reloaded.version);assert.equal(reloaded.schedules.length,0);assert.equal(reloaded.boq,null);
});

test('BOQ grouped cold matcher exactly preserves brute-force rank, scores and ties for every source item',()=>{
 const state=loadCertifiedDemoProject('BOQ-GROUP-PARITY-'+randomUUID());
 const original=projectControlSchedule(state)!.revision.model;
 const base=original.activities.find(a=>a.activityType==='task')??original.activities[0]!;
 const wbs=Array.from({length:8},(_,i)=>({wbsId:'ZONE-'+i,name:'Mechanical Electrical Zone '+i,parentWbsId:null,sourceRefs:[]}));
 const activities=Array.from({length:145},(_,i)=>{
  const zone=i%8,trade=i%3===0?'Mechanical':i%3===1?'Electrical':'Civil';
  return {...base,projectId:state.projectId,activityId:'ACT-'+i,name:'Installation '+trade+' Zone '+zone,
   wbsId:'ZONE-'+zone,activityType:'task' as const,status:'not_started' as const};
 });
 const schedule={...original,activities,wbs,relationships:[]};
 const originalQuantities=state.quantities!;
 assert.ok(originalQuantities,'Demo source quantities must be established');
 const items=Array.from({length:30},(_,i)=>{
  const zone=i%8,trade=i%3===0?'Mechanical':i%3===1?'Electrical':'Civil';
  return {quantityItemId:'BQ-'+i,itemNumber:'BOQ.'+i,section:'Mechanical Electrical Zone '+zone,
   description:i%11===0?'Works linked to ACT-'+i:'Installation '+trade+' Zone '+zone,
   unit:'m3',contractQuantity:10,sourceRefs:[],diagnostics:[]};
 });
 const quantities={...originalQuantities,items,allocations:[],installedSnapshots:[]};
 const actual=buildQuantityScheduleMapping(quantities,schedule);
 const stop=new Set('the and for with from into work works system systems supply installation install provide including complete all of to in on at by or a an as per item package'.split(' '));
 const norm=(value:string|null|undefined)=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu,' ').replace(/\\s+/g,' ').trim();
 const tokens=(v:string|null|undefined)=>new Set(norm(v).split(' ').filter(x=>x.length>=2&&!stop.has(x)));
 const codes=(v:string)=>new Set(v.toUpperCase().match(/[A-Z]{1,8}-?\\d{1,8}|\\d{2,}/g)??[]);
 const jaccard=(a:Set<string>,b:Set<string>)=>{if(!a.size||!b.size)return 0;let n=0;for(const k of a)if(b.has(k))n++;return n/(a.size+b.size-n);};
 for(const item of items){
  const corpus=[item.itemNumber??'',item.section??'',item.description].join(' ');
  const features={description:norm(item.description),names:tokens(item.description),sections:tokens(item.section),codes:codes(corpus)};
  const expected=activities.map(activity=>{
   const wbsNode=wbs.find(x=>x.wbsId===activity.wbsId)!;
   const af={name:norm(activity.name),names:tokens(activity.name),wbs:tokens(wbsNode.wbsId+' '+wbsNode.name),codes:codes(activity.activityId+' '+activity.wbsId+' '+wbsNode.wbsId+' '+wbsNode.name)};
   const explicit=new RegExp('(^|[^A-Za-z0-9_.-])'+escaped+'([^A-Za-z0-9_.-]|$)','i').test(corpus);
   let value=0;
   if(explicit)value=.99;
   else{
    const desc=jaccard(features.names,af.names);
    if(desc)value+=Math.min(.62,desc*.72);
    if(features.description.length>=5&&af.name.length>=5&&(features.description.includes(af.name)||af.name.includes(features.description)))value+=.23;
    const sec=jaccard(features.sections,af.wbs);if(sec)value+=Math.min(.24,sec*.30);
    const cd=jaccard(features.codes,af.codes);if(cd)value+=Math.min(.18,cd*.22);
    value=Math.min(.97,value);
   }
   return {activityId:activity.activityId,confidence:Number(value.toFixed(4))};
  }).filter(row=>row.confidence>=.34).sort((a,b)=>b.confidence-a.confidence||a.activityId.localeCompare(b.activityId)).slice(0,5);
  const found=actual.candidates.filter(x=>x.quantityItemId===item.quantityItemId).map(x=>({activityId:x.activityId,confidence:x.confidence}));
  assert.deepEqual(found,expected,'Unchanged links and rankings for '+item.quantityItemId);
 }
});
