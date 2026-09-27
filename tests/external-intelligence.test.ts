import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {ExternalAccess,digest,secret} from '../packages/external-intelligence/src/access';
import {ExternalIntelligenceService} from '../packages/external-intelligence/src/service';
import {ExternalHttp} from '../packages/external-intelligence/src/http';
import {domains,ExternalError,type ExternalPolicy,type ExternalBackend,type ExternalAnalysis} from '../packages/external-intelligence/src/types';
import {externalAuthorityMetadata} from '../packages/external-intelligence/src/authority-metadata';
import {externalCatalogue,localExternalBackend} from '../packages/runtime-api/src/external-project-authority';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {saveManagedAskSettings,readManagedAskSettings} from '../packages/project-ask/src/settings';

function fixture(t:any){
  const root=mkdtempSync(join(tmpdir(),'external-ai-'));t.after(()=>rmSync(root,{recursive:true,force:true}));let now=Date.now();const activation=secret();
  const policy:ExternalPolicy={schemaVersion:1,enabled:true,publicOrigin:'http://127.0.0.1',workspaceId:'workspace',identity:{issuer:'test',audience:'test',publicKeyPem:''},ownerActivation:{userId:'owner',hash:digest(activation),expiresAt:new Date(now+86400000).toISOString()},registrationRedirectOrigins:['https://assistant.example'],users:[{id:'owner',enabled:true,workspaceId:'workspace',externalAdmin:true,allowAudit:true,projects:{A:[...domains],B:[...domains]}}],projects:{A:{enabled:true,domains:[...domains]},B:{enabled:true,domains:[...domains]}},clients:[{id:'client',name:'Test AI',redirectUris:['https://assistant.example/callback']}]};
  const access=new ExternalAccess(root,()=>policy,()=>now),user=policy.users[0]!;
  const connection=access.create(user,{clientId:'client',profile:'customer',projects:{A:[...domains]}});
  let version=1,calls=0,analyses=0;let items=1;let beforeReturn:(()=>void)|undefined;
  const backend:ExternalBackend={catalogue:externalAuthorityMetadata,state:async(id,ids)=>{calls++;return {projectId:id,projectVersion:version,dataDate:'2036-08-31',programmeRevision:'r1',authorityState:'established',lastControlledUpdate:null,authorityVersions:Object.fromEntries(ids.map(id=>[id,{version,basis:'project-version',independentlyVersioned:false}])),changedDomains:null,snapshotId:null};},analyse:async(id,u,plan)=>{calls++;analyses++;const result:ExternalAnalysis={id:'test',createdAt:new Date(now).toISOString(),scope:{scopeType:'project',projectId:id,projectName:id,workspaceId:u.workspaceId,userId:u.id,projectVersion:version,dataDate:'2036-08-31',authorityState:'established',programmeRevision:'r1',pageContext:null},plan,items:Array.from({length:items},(_,i)=>({id:'row-'+i,kind:'row',authorityId:plan.authorities[0]!,mandatory:true,traceIds:[],data:{recordId:'record-'+i,value:i}})),coverage:{version:1,projectId:id,projectVersion:version,dataDate:'2036-08-31',entries:[],materialComplete:true,sourceComplete:true,evidenceHash:'hash',representedToModel:false},traces:[],recordIds:['record-0'],sourceRefs:[],factsHash:'hash',llmInvoked:false};beforeReturn?.();return result;},retrieve:async(_id,u)=>{calls++;assert.deepEqual(u.projects.A,['schedule']);return {items:[],matching:0,qualification:'No linked records.'};}};
  const token=access.issue(connection.id,policy.publicOrigin+'/external-ai/mcp').access_token;
  return {root,policy,access,user,connection,backend,token,activation,service:new ExternalIntelligenceService(access,backend),setVersion:(v:number)=>version=v,setItems:(n:number)=>items=n,setBeforeReturn:(fn:()=>void)=>beforeReturn=fn,calls:()=>calls,analyses:()=>analyses,advance:(n:number)=>now+=n};
}
const denied=(code:string)=>(e:unknown)=>e instanceof ExternalError&&e.code===code;

test('public external metadata matches live authorities without importing project engines in the gateway',()=>{assert.deepEqual(externalAuthorityMetadata,externalCatalogue);});
test('project, domain, profile, expiry and revocation checks happen before project retrieval',async t=>{
  const f=fixture(t);await assert.rejects(()=>f.service.execute(f.token,'get_project_metric',{projectId:'B',metric:'CPI'}),denied('connection_scope_denied'));assert.equal(f.calls(),0);
  f.user.projects.A=['schedule'];await assert.rejects(()=>f.service.execute(f.token,'get_project_metric',{projectId:'A',metric:'CPI'}),denied('project_or_domain_denied'));assert.equal(f.calls(),0);
  assert.throws(()=>f.access.create({...f.user,allowAudit:false},{clientId:'client',profile:'audit',projects:{A:['schedule']}}),denied('profile_denied'));
  f.access.disableProject(f.user,'A',true);await assert.rejects(()=>f.service.execute(f.token,'get_project_state',{projectId:'A'}),denied('project_or_domain_denied'));assert.equal(f.calls(),0);
  f.access.disableProject(f.user,'A',false);f.access.revoke(f.user,f.connection.id);await assert.rejects(()=>f.service.execute(f.token,'get_project_state',{projectId:'A'}),denied('invalid_token'));assert.equal(f.calls(),0);
});
test('owner activation is single-use, survives restart and cannot be replaced with an anonymous CMeng cookie',t=>{
  const f=fixture(t),token=f.access.activateOwner(f.activation),req={headers:{cookie:'cmeng_external_owner='+token}} as any;
  assert.equal(f.access.identity(req).id,'owner');assert.throws(()=>f.access.identity({headers:{cookie:'cmeng_audit_session=anything'}} as any),denied('verified_identity_required'));
  const restored=new ExternalAccess(f.root,()=>f.policy);assert.equal(restored.identity(req).id,'owner');assert.throws(()=>restored.activateOwner(f.activation),denied('activation_invalid'));
  assert.ok(!readFileSync(join(f.root,'connections.json'),'utf8').includes(token));
  f.advance(8*86400000);assert.throws(()=>f.access.identity(req),denied('verified_identity_required'));
});
test('access changes during calculation stop disclosure; session access remains project and connection bound',async t=>{
  const f=fixture(t);f.setBeforeReturn(()=>f.access.revoke(f.user,f.connection.id));await assert.rejects(()=>f.service.execute(f.token,'get_project_metric',{projectId:'A',metric:'CPI'}),denied('invalid_token'));
  const g=fixture(t),result=await g.service.execute(g.token,'get_project_metric',{projectId:'A',metric:'CPI'}),second=g.access.create(g.user,{clientId:'client',profile:'customer',projects:{A:[...domains]}}),other=g.access.issue(second.id,g.policy.publicOrigin+'/external-ai/mcp');
  await assert.rejects(()=>g.service.execute(other.access_token,'check_analysis_freshness',{projectId:'A',analysisId:result.analysisId}),denied('analysis_not_found'));
});
test('all 45 selected exceptions are delivered in bounded batches; replay, raw pagination and stale analysis fail',async t=>{
  const f=fixture(t);f.policy.limits={customer:{recordsPerResponse:20,maxRank:20}};f.setItems(45);
  const first=await f.service.execute(f.token,'run_project_analysis',{projectId:'A',objective:'critical activities'});assert.equal(first.items.length,20);assert.equal(first.delivery.materialCompleteInThisResponse,false);
  const second=await f.service.execute(f.token,'get_analysis_batch',{projectId:'A',analysisId:first.analysisId,batchToken:first.delivery.nextBatchToken});assert.equal(second.items.length,20);
  const last=await f.service.execute(f.token,'get_analysis_batch',{projectId:'A',analysisId:first.analysisId,batchToken:second.delivery.nextBatchToken});assert.equal(last.items.length,5);assert.equal(last.delivery.nextBatchToken,null);assert.equal(new Set([...first.items,...second.items,...last.items].map(i=>i.id)).size,45);
  await assert.rejects(()=>f.service.execute(f.token,'get_analysis_batch',{projectId:'A',analysisId:first.analysisId,batchToken:first.delivery.nextBatchToken}),denied('batch_token_invalid'));
  await assert.rejects(()=>f.service.execute(f.token,'run_project_analysis',{projectId:'A',objective:'activities',offset:20} as any),denied('unsupported_parameter'));
  f.setVersion(2);const freshness=await f.service.execute(f.token,'check_analysis_freshness',{projectId:'A',analysisId:first.analysisId});assert.equal(freshness.stale,true);assert.equal(freshness.current.projectVersion,2);
  await assert.rejects(()=>f.service.execute(f.token,'get_analysis_batch',{projectId:'A',analysisId:first.analysisId,batchToken:'anything'}),denied('analysis_stale'));
});
test('unchanged analysis reuses facts and disclosure budgets cannot be reset by a new connection',async t=>{
  const f=fixture(t);f.policy.limits={customer:{recordsPerMonth:2,activeSessions:1}};const first=await f.service.execute(f.token,'get_project_metric',{projectId:'A',metric:'CPI'});
  const again=await f.service.execute(f.token,'get_project_metric',{projectId:'A',metric:'CPI',analysisId:first.analysisId});assert.equal(again.reused,true);assert.equal(again.analysisId,first.analysisId);assert.equal(f.analyses(),1);assert.equal(f.access.session(first.analysisId,f.connection).recordsReturned,2);
  f.policy.limits!.customer!.activeSessions=2;
  const c=f.access.create(f.user,{clientId:'client',profile:'customer',projects:{A:[...domains]}}),token=f.access.issue(c.id,f.policy.publicOrigin+'/external-ai/mcp').access_token;
  await assert.rejects(()=>f.service.execute(token,'get_project_metric',{projectId:'A',metric:'CPI'}),denied('bulk_export_required'));
  const restored=new ExternalAccess(f.root,()=>f.policy);assert.throws(()=>restored.consume(c,'A',1,false),denied('bulk_export_required'));
});
test('related retrieval receives only the effective connection domains',async t=>{
  const f=fixture(t),c=f.access.create(f.user,{clientId:'client',profile:'customer',projects:{A:['schedule']}}),token=f.access.issue(c.id,f.policy.publicOrigin+'/external-ai/mcp').access_token;
  const a=await f.service.execute(token,'run_project_analysis',{projectId:'A',objective:'activities'});await f.service.execute(token,'get_related_records',{projectId:'A',analysisId:a.analysisId,recordId:'record-0'});
});
test('MCP and API share facts; OAuth checks callback, PKCE, CSRF, audience, rotation and one-time code use',async t=>{
  const f=fixture(t),http=new ExternalHttp(f.access,f.service),server=createServer((req,res)=>{void http.handle(req,res);});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());const base='http://127.0.0.1:'+(server.address() as any).port;f.policy.publicOrigin=base;
  const post=(path:string,body:any,extra:Record<string,string>={})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(body),redirect:'manual'});
  const registration=await post('/external-ai/register',{client_name:'Independent MCP client',redirect_uris:['https://assistant.example/callback']});assert.equal(registration.status,201);const client:any=await registration.json();
  assert.equal((await post('/external-ai/register',{client_name:'Bad',redirect_uris:['https://evil.example/callback']})).status,400);
  const activate=await post('/external-ai/activate',{token:f.activation},{origin:base});assert.equal(activate.status,200);const cookie=activate.headers.get('set-cookie')!.split(';')[0]!;
  const verifier=secret(),challenge=createHash('sha256').update(verifier).digest('base64url');const args=new URLSearchParams({client_id:client.client_id,redirect_uri:'https://assistant.example/callback',response_type:'code',resource:base+'/external-ai/mcp',code_challenge:challenge,code_challenge_method:'S256',scope:'cmeng:read',state:'owned-state'});
  const auth=await fetch(base+'/external-ai/authorize?'+args,{headers:{cookie}}),html=await auth.text();assert.equal(auth.status,200);assert.match(html,/Connect Independent MCP client/);const csrf=/name="csrf" value="([^"]+)"/.exec(html)![1];
  assert.equal((await post('/external-ai/authorize',{csrf,profile:'customer',projects:['A']},{cookie,origin:'https://evil.example'})).status,403);
  const consent=await post('/external-ai/authorize',{csrf,profile:'customer',projects:['A']},{cookie,origin:base});assert.equal(consent.status,303);const callback=new URL(consent.headers.get('location')!);assert.equal(callback.searchParams.get('state'),'owned-state');
  const grant={grant_type:'authorization_code',code:callback.searchParams.get('code'),client_id:client.client_id,redirect_uri:'https://assistant.example/callback',resource:base+'/external-ai/mcp',code_verifier:verifier};
  assert.equal((await post('/external-ai/token',{...grant,code_verifier:secret()})).status,400);const exchange=await post('/external-ai/token',grant);assert.equal(exchange.status,200);const tokens:any=await exchange.json();assert.equal((await post('/external-ai/token',grant)).status,400);
  const authorization='Bearer '+tokens.access_token,call={projectId:'A',metric:'CPI'};
  const rest=await post('/external-ai/api/get_project_metric',call,{authorization}),rv:any=await rest.json();assert.equal(rest.status,200);
  const mcp=await post('/external-ai/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_project_metric',arguments:call}},{authorization}),mv:any=await mcp.json();assert.equal(mv.result.isError,false);assert.deepEqual(mv.result.structuredContent.items,rv.items);assert.equal(mv.result.structuredContent.llmInvoked,false);
  assert.equal((await post('/external-ai/mcp',{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'get_project_state',arguments:{projectId:'A'}}})).status,401);
  assert.equal((await post('/external-ai/mcp',{jsonrpc:'2.0',id:3,method:'tools/list'},{origin:'https://evil.example'})).status,403);
  const rotate=await post('/external-ai/token',{grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:client.client_id,resource:base+'/external-ai/mcp'});assert.equal(rotate.status,200);assert.equal((await post('/external-ai/api/get_project_state',{projectId:'A'},{authorization})).status,401);
  assert.equal((await post('/external-ai/token',{grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:client.client_id,resource:base+'/external-ai/mcp'})).status,401);
});
test('real CPI and Top 20 BOQ remain identical to native Ask; no project mutation or model call',async t=>{
  const f=fixture(t),id='EXTERNAL-REAL',state=runtimeProjects.getOrCreate(id);f.policy.users[0]!.projects[id]=[...domains];f.policy.projects[id]={enabled:true,domains:[...domains]};
  const upload=(name:string,value:string)=>runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:name,bytes:Buffer.from(value),mediaType:name.endsWith('.xer')?'text/plain':'text/csv',uploadedAt:'2036-09-01',uploadIntent:'replace_current_basis'});
  await upload('Current.xer',['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tEXTERNAL\t2036-08-31','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\tWork\t2036-01-01\t2036-12-31\t80\t80','%E'].join('\n'));
  await upload('Cost.csv','Metric,Value,Unit,As Of,VAT Basis\nEV,720,AED,2036-08-31,Exclusive\nAC,900,AED,2036-08-31,Exclusive\nPV,800,AED,2036-08-31,Exclusive\nEV,9999,AED,2036-09-30,Exclusive');
  await upload('BOQ.csv','Item No,Description,Unit,Quantity,Rate,Amount,Currency\n'+Array.from({length:30},(_,i)=>`${i+1},Item ${i+1},No.,1,${i+1},${i+1},AED`).join('\n'));
  const c=f.access.create(f.user,{clientId:'client',profile:'audit',projects:{[id]:[...domains]}}),token=f.access.issue(c.id,f.policy.publicOrigin+'/external-ai/mcp').access_token,service=new ExternalIntelligenceService(f.access,localExternalBackend),before=state.version;
  const native=await new ProjectAskEngine(new AskStore(join(f.root,'native')),null).ask(id,{userId:'owner',workspaceId:'workspace',name:null,title:null,company:null,allowModel:false},{question:'What is CPI?'});
  const result=await service.execute(token,'get_project_metric',{projectId:id,metric:'What is CPI?'}),metric=result.items.find((i:any)=>i.kind==='metric'&&i.data.id.includes('.cpi-'));assert.equal(metric.data.value,.8);assert.equal(metric.data.value,native.sections.flatMap(s=>s.metrics).find(m=>m.id.includes('.cpi-'))!.value);assert.equal(result.scope.dataDate,'2036-08-31');assert.equal(result.llmInvoked,false);assert.doesNotMatch(JSON.stringify(result),/9999/);
  const ranked=await service.execute(token,'get_ranked_result',{projectId:id,objective:'Top 20 BOQ cost drivers'});const rows=ranked.items.filter((i:any)=>i.kind==='row'&&i.authorityId==='boq');assert.equal(rows.length,20);assert.equal(rows[0].data.row.amount,30);assert.equal(rows.at(-1).data.row.amount,11);assert.equal(state.version,before);
});

test('deployed gateway boundary reaches the isolated project worker and rejects internal routes and write credentials',async t=>{
  const f=fixture(t),old=process.env.CMENG_EXTERNAL_POLICY_JSON,gateway=await createProjectGateway(join(f.root,'gateway'),{maxWorkers:1});
  t.after(async()=>{if(old===undefined)delete process.env.CMENG_EXTERNAL_POLICY_JSON;else process.env.CMENG_EXTERNAL_POLICY_JSON=old;await gateway.close();});
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+(gateway.server.address() as any).port;f.policy.publicOrigin=base;process.env.CMENG_EXTERNAL_POLICY_JSON=JSON.stringify(f.policy);
  assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'A'})})).status,201);
  const call=(path:string,body:any,headers:Record<string,string>={})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),redirect:'manual'});
  assert.equal((await call('/internal/external-intelligence',{action:'state',projectId:'A'})).status,404);
  assert.equal((await call('/api/projects/A/evidence/rerun',{}, {authorization:'Bearer cmeng_ext_'+secret()})).status,403);
  const access=new ExternalAccess(join(f.root,'gateway','external-ai'),()=>f.policy),c=access.create(f.user,{clientId:'client',profile:'audit',projects:{A:[...domains]}}),token=access.issue(c.id,base+'/external-ai/mcp').access_token;
  // The HTTP controller has not been created yet, so it reloads the durable connection state.
  const response=await call('/external-ai/api/get_project_state',{projectId:'A'},{authorization:'Bearer '+token}),body:any=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.projectId,'A');assert.equal(body.dataDate,null);
  const answer=await call('/external-ai/api/get_project_metric',{projectId:'A',metric:'CPI'},{authorization:'Bearer '+token}),facts:any=await answer.json();assert.equal(answer.status,200,JSON.stringify(facts));assert.equal(facts.llmInvoked,false);assert.equal(facts.items.find((x:any)=>x.kind==='metric'&&x.data.id.includes('.cpi')).data.value,null);
  const denied=await call('/external-ai/api/get_project_state',{projectId:'B'},{authorization:'Bearer '+token});assert.equal(denied.status,403);
  saveManagedAskSettings(join(f.root,'gateway','ask-ai-provider.json'),'gpt-5-mini','sk-test-'+secret());
  const outsider=await fetch(base+'/api/projects/A/intelligence/home',{headers:{'x-cmeng-paid-ai':'1'}}),outsideHome:any=await outsider.json();assert.equal(outsideHome.providerConfigured,false,'a forged client header cannot spend the owner key');
  const activated=await call('/external-ai/activate',{token:f.activation},{origin:base}),cookie=activated.headers.get('set-cookie')!.split(';')[0]!;
  const owner=await fetch(base+'/api/projects/A/intelligence/home',{headers:{cookie}}),ownerHome:any=await owner.json();assert.equal(ownerHome.providerConfigured,true,'same owner browser can use the configured built-in model');
  const settings=await fetch(base+'/settings/ask-ai',{headers:{cookie}}),settingsHtml=await settings.text();assert.match(settingsHtml,/gpt-5-mini/);assert.doesNotMatch(settingsHtml,/sk-test-/);assert.equal(readManagedAskSettings(join(f.root,'gateway','ask-ai-provider.json'))!.model,'gpt-5-mini');
  const csrf=/name="csrf" value="([^"]+)"/.exec(settingsHtml)![1];assert.equal((await call('/settings/ask-ai',{csrf,model:'gpt-6',apiKey:''},{cookie,origin:base})).status,400);
  const local=await call('/api/projects/A/intelligence/ask',{question:'What is CPI?'},{cookie}),localResult:any=await local.json();assert.equal(local.status,200);assert.equal(localResult.telemetry.aiInvoked,false,'a configured paid model is not called for CPI');
  f.policy.enabled=false;process.env.CMENG_EXTERNAL_POLICY_JSON=JSON.stringify(f.policy);
  const separateHome:any=await (await fetch(base+'/api/projects/A/intelligence/home',{headers:{cookie}})).json();assert.equal(separateHome.providerConfigured,true,'disabling external access does not disable the owner built-in provider');
  assert.equal((await call('/external-ai/api/get_project_state',{projectId:'A'},{authorization:'Bearer '+token})).status,503);
});

test('expired credentials and concurrent reuse cannot bypass project or session budgets',async t=>{
  const f=fixture(t);const result=await f.service.execute(f.token,'get_project_metric',{projectId:'A',metric:'CPI'});
  let release!:(v:any)=>void;const state=f.backend.state;f.backend.state=()=>new Promise(resolve=>{release=resolve;});
  const first=f.service.execute(f.token,'check_analysis_freshness',{projectId:'A',analysisId:result.analysisId});
  await assert.rejects(()=>f.service.execute(f.token,'get_project_metric',{projectId:'A',metric:'CPI',analysisId:result.analysisId}),denied('analysis_busy'));
  release(await state('A',[]));await first;
  f.advance(901000);const before=f.calls();await assert.rejects(()=>f.service.execute(f.token,'get_project_state',{projectId:'A'}),denied('invalid_token'));assert.equal(f.calls(),before);
});

test('unreadable paid AI settings do not break deterministic calculation and can be repaired',async t=>{
  const f=fixture(t),path=join(f.root,'model.json'),old=process.env.CMENG_ASK_AI_CONFIG_FILE;
  t.after(()=>{if(old===undefined)delete process.env.CMENG_ASK_AI_CONFIG_FILE;else process.env.CMENG_ASK_AI_CONFIG_FILE=old;});
  process.env.CMENG_ASK_AI_CONFIG_FILE=path;writeFileSync(path,'invalid config');
  const {configuredAskModel}=await import('../packages/project-ask/src/provider');assert.equal(configuredAskModel(),null);
  const id='EXTERNAL-CONFIG-REPAIR';runtimeProjects.getOrCreate(id);
  const answer=await new ProjectAskEngine(new AskStore(join(f.root,'native')),configuredAskModel()).ask(id,{userId:'owner',workspaceId:'workspace',name:null,title:null,company:null,allowModel:true},{question:'What is CPI?'});
  assert.equal(answer.telemetry?.aiInvoked,false);assert.equal(answer.sections.flatMap(s=>s.metrics).find(m=>m.id.includes('.cpi'))!.value,null);
  saveManagedAskSettings(path,'gpt-4.1-mini','sk-test-'+secret());assert.equal(readManagedAskSettings(path)!.model,'gpt-4.1-mini');
});
