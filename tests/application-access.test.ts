import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomBytes,createHmac} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectDirectory} from '../packages/runtime-api/src/project-catalog';
import {applicationPolicyFromEnvironment,type ApplicationAccessPolicy} from '../packages/runtime-api/src/application-access';
import {auditContext,withRequestAudit} from '../packages/runtime-api/src/audit-context';

test('fresh projects enforce verified identity, roles and project scope before cache or writes',{timeout:120000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-app-auth-')),old=process.env.CMENG_EXTERNAL_POLICY_JSON;
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const ids=Array.from({length:10},()=> 'AUTH-'+randomBytes(6).toString('hex').toUpperCase());
 let policy:ApplicationAccessPolicy={schemaVersion:1,users:{admin:{enabled:true,administrator:true,projects:{}},reader:{enabled:true,projects:Object.fromEntries(ids.map(id=>[id,'viewer']))},writer:{enabled:true,projects:Object.fromEntries(ids.map(id=>[id,'editor']))},outsider:{enabled:true,projects:{}}}};
 const gateway=await createProjectGateway(root,{maxWorkers:2,appPolicy:()=>policy});
 await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(gateway.server.address() as {port:number}).port;
 process.env.CMENG_EXTERNAL_POLICY_JSON=JSON.stringify({schemaVersion:1,enabled:false,workspaceId:'app-test',publicOrigin:base,identity:{issuer:'fixture-issuer',audience:'cmeng',publicKeyPem:publicKey.export({type:'spki',format:'pem'})},users:['admin','reader','writer','outsider'].map(id=>({id,enabled:true,workspaceId:'app-test',externalAdmin:false,allowAudit:false,projects:{}})),projects:{},clients:[]});
 const cookie=(id:string,extra:Record<string,unknown>={})=>{const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url'),b=Buffer.from(JSON.stringify({sub:id,iss:'fixture-issuer',aud:'cmeng',workspaceId:'app-test',exp:Math.floor(Date.now()/1000)+3600,...extra})).toString('base64url');return 'cmeng_identity='+h+'.'+b+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+b),privateKey).toString('base64url');};
 const request=(id:string|null,path:string,method='GET',body?:string,extra:Record<string,string>={})=>fetch(base+path,{method,headers:{...(id?{cookie:cookie(id)}:{}),origin:base,'content-type':'application/json',...extra},...(body===undefined?{}:{body})});
 let assertions=0;
 async function status(expected:number,p:Promise<Response>){const response=await p;assert.equal(response.status,expected,await response.text());assertions++;}
 try{
  for(const id of ids){
   await status(201,request('admin','/api/projects','POST',JSON.stringify({projectId:id})));
   const path='/api/projects/'+id;
   await status(401,request(null,path+'/evidence/documents'));
   await status(403,request('outsider',path+'/evidence/documents'));
   await status(200,request('reader',path+'/evidence/documents'));
   await status(403,request('reader',path+'/evidence/rerun','POST'));
   await status(403,request('reader',path+'/evidence/documents/delete','POST','{}'));
   await status(403,request('reader',path+'/controls','PUT','{}'));
   await status(403,request('reader',path+'/boq/page-review','POST','{}'));
   await status(403,request('reader',path+'/delivery/records','POST','{}'));
   await status(403,request('writer',path+'/controls','PUT','{}',{origin:'https://untrusted.example'}));
   await status(401,request('reader',path+'/evidence/documents','GET',undefined,{cookie:cookie('reader',{exp:1})}));
   await status(401,request('reader',path+'/evidence/documents','GET',undefined,{cookie:cookie('reader',{aud:'wrong'})}));
  }
  const portfolio=await (await request('outsider','/api/portfolio')).json() as any;assert.equal(portfolio.projectCount,0);
  const first=ids[0]!;
  const source=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+first+'\t2026-08-31','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\tRandom authorized work\tTK_NotStart\t16\t16','%E'].join('\n');
  await status(201,request('writer','/api/projects/'+first+'/evidence/uploads','POST',source,{'content-type':'text/plain','x-source-filename':'current.xer','x-upload-intent':'replace_current_basis','x-cmeng-verified-actor':'FORGED','x-cmeng-verified-actor-signature':'0'.repeat(64)}));
  const snapshot=JSON.parse(readFileSync(join(projectDirectory(root,first),'cmeng-project-state.json'),'utf8'));
  assert.ok(snapshot.projects[0].auditHistory.some((e:any)=>e.actor.id==='writer'&&e.actor.identityVerified&&e.actor.kind==='user'));
  policy.users.reader!.projects={};
  await status(403,request('reader','/api/projects/'+first+'/evidence/documents'));
  await status(403,request('writer','/api/projects','POST',JSON.stringify({projectId:'NOT-ALLOWED'})));
  await status(403,request('reader','/api/unlisted-system-route'));
  policy.users.writer!.enabled=false;
  await status(403,request('writer','/api/projects/'+first+'/evidence/documents'));
  console.log('CMENG_FRESH_APP_ACCESS_RESULT='+JSON.stringify({projects:ids,assertions,classification:'Internal random identity/project tests, not deployed identity-provider acceptance'}));
 }finally{await gateway.close();if(old===undefined)delete process.env.CMENG_EXTERNAL_POLICY_JSON;else process.env.CMENG_EXTERNAL_POLICY_JSON=old;rmSync(root,{recursive:true,force:true});}
});

test('required application protection fails closed without policy',()=>{
 const names=['CMENG_REQUIRE_APP_AUTH','CMENG_APP_ACCESS_POLICY_JSON','CMENG_APP_ACCESS_POLICY_FILE'] as const,prior=names.map(n=>process.env[n]);
 try{process.env.CMENG_REQUIRE_APP_AUTH='1';delete process.env.CMENG_APP_ACCESS_POLICY_JSON;delete process.env.CMENG_APP_ACCESS_POLICY_FILE;assert.throws(applicationPolicyFromEnvironment,/not been configured/);process.env.CMENG_APP_ACCESS_POLICY_JSON='{broken';assert.throws(applicationPolicyFromEnvironment,/could not be loaded/);}
 finally{names.forEach((n,i)=>{if(prior[i]===undefined)delete process.env[n];else process.env[n]=prior[i];});}
});

test('verified audit callback failure is propagated once; forged signatures remain unverified',()=>{
 const prior=process.env.CMENG_EXTERNAL_WORKER_KEY,key=randomBytes(32).toString('hex');process.env.CMENG_EXTERNAL_WORKER_KEY=key;
 try{
  const actor=Buffer.from(JSON.stringify({id:'actual-user'})).toString('base64url');
  const req={method:'POST',url:'/api/projects/A/controls',headers:{'x-cmeng-verified-actor':actor,'x-cmeng-verified-actor-signature':createHmac('sha256',key).update(actor).digest('hex')}} as unknown as IncomingMessage;
  const res={setHeader(){}} as unknown as ServerResponse;let called=0;
  assert.throws(()=>withRequestAudit(req,res,()=>{called++;assert.equal(auditContext().actor.id,'actual-user');throw Error('save failed');}),/save failed/);assert.equal(called,1);
  req.headers['x-cmeng-verified-actor-signature']='0'.repeat(64);withRequestAudit(req,res,()=>assert.equal(auditContext().actor.identityVerified,false));
 }finally{if(prior===undefined)delete process.env.CMENG_EXTERNAL_WORKER_KEY;else process.env.CMENG_EXTERNAL_WORKER_KEY=prior;}
});
