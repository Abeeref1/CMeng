import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';

import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {defaultBlindSeed,generateBlindRound,type BlindDocument,type BlindProject} from './blind-project-generator';

const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function listen(gateway:Awaited<ReturnType<typeof createProjectGateway>>){
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
  return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
}
function pagePath(projectId:string,page:(typeof moduleRegistry)[number]){
  return '/api/projects/'+encodeURIComponent(projectId)+(page.area==='management'?'/management/'+page.key:'/'+page.area+'/modules/'+page.key);
}
function expectedInventory(project:BlindProject){
  return project.documents.map(document=>({
    sourceFilename:document.filename,
    sourceHashSha256:sha(document.bytes),
    sizeBytes:document.bytes.length,
  })).sort((a,b)=>a.sourceHashSha256.localeCompare(b.sourceHashSha256)||a.sourceFilename.localeCompare(b.sourceFilename));
}
function retainedInventory(register:any){
  return (register.documents??[]).map((document:any)=>({
    sourceFilename:document.sourceFilename,
    sourceHashSha256:document.sourceHashSha256,
    sizeBytes:document.sizeBytes,
  })).sort((a:any,b:any)=>a.sourceHashSha256.localeCompare(b.sourceHashSha256)||a.sourceFilename.localeCompare(b.sourceFilename));
}

test('J7 fresh blind enterprise isolation: all 58 public pages remain project-scoped through concurrency, invalid requests and restart',{timeout:300000},async()=>{
  const seed=defaultBlindSeed()+'::J7-ENTERPRISE-ISOLATION-OPERATIONS';
  process.stdout.write('\nCMENG_J7_BLIND_PROJECT_SET_SEED='+seed+'\n');
  const {projects}=await generateBlindRound(seed,20);
  assert.equal(moduleRegistry.length,58,'J7 must exercise the complete 58-page registry');
  assert.equal(new Set(projects.map(project=>project.projectId)).size,20,'J7 requires 20 fresh project identities');
  assert.equal(new Set(projects.map(project=>project.scenario)).size,8,'J7 must cover all eight evidence truth states');
  assert.equal(new Set(projects.map(project=>project.language)).size,3,'J7 must cover English, Arabic and mixed projects');

  const root=await mkdtemp(join(tmpdir(),'cmeng-j7-enterprise-'));
  let gateway=await createProjectGateway(root,{maxWorkers:4});
  let base=await listen(gateway);
  let pageChecks=0;

  const request=async(path:string,init?:RequestInit)=>{
    const response=await fetch(base+path,init),text=await response.text();
    let body:any=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
    return {status:response.status,body,text};
  };
  const requireOk=async(path:string,init?:RequestInit)=>{
    const result=await request(path,init);
    assert.ok(result.status>=200&&result.status<300,path+' returned '+result.status+': '+result.text.slice(0,800));
    return result.body;
  };
  const upload=async(project:BlindProject,document:BlindDocument,index:number)=>{
    const result=await request('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/uploads',{
      method:'POST',
      headers:{
        'content-type':document.mediaType,
        'x-source-filename-encoded':encodeURIComponent(document.filename),
        'x-source-relative-path-encoded':encodeURIComponent(document.filename),
        'x-upload-intent':'add_update',
        'x-upload-id':'J7-SHARED-'+index,
      },
      body:Buffer.from(document.bytes),
    });
    assert.equal(result.status,201,project.projectId+' / '+document.filename+' upload failed: '+result.text.slice(0,800));
  };

  try{
    for(const project of projects){
      const created=await request('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:project.projectId})});
      assert.equal(created.status,201,project.projectId+' creation failed: '+created.text);
    }

    await Promise.all(projects.map(async project=>{
      for(const [index,document] of project.documents.entries())await upload(project,document,index);
    }));

    for(const project of projects){
      const documents=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
      assert.equal(documents.documentCount,project.documents.length,'J7 retained document count mismatch: '+project.projectId);
      assert.deepEqual(retainedInventory(documents),expectedInventory(project),'J7 source inventory crossed or changed: '+project.projectId);
      const progress=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/upload-progress/J7-SHARED-0');
      assert.equal(progress.projectId,project.projectId,'same upload ID leaked another project');
      assert.equal(progress.state,'complete');
      assert.equal(progress.filename,project.documents[0]!.filename);
    }

    const projectIds=projects.map(project=>project.projectId);
    for(const project of projects){
      const otherIds=projectIds.filter(id=>id!==project.projectId);
      for(const page of moduleRegistry){
        const result=await request(pagePath(project.projectId,page));
        assert.ok(result.status===200||result.status===409,
          'J7 page must resolve or fail closed without server error: '+project.projectId+' / '+page.key+' -> '+result.status+' '+result.text.slice(0,500));
        if(result.status===409){
          assert.equal(result.body?.status,'blocked','J7 409 must be an explicit governed blocked state: '+project.projectId+' / '+page.key);
          assert.ok(typeof result.body?.reason==='string'&&result.body.reason.trim().length>0,
            'J7 blocked page must explain why it is unavailable: '+project.projectId+' / '+page.key);
          assert.ok(Array.isArray(result.body?.dependencies),
            'J7 blocked page must expose its evidence dependencies: '+project.projectId+' / '+page.key);
        }
        for(const otherId of otherIds)assert.ok(!result.text.includes(otherId),
          'J7 cross-project disclosure: '+project.projectId+' / '+page.key+' contains '+otherId);
        if(result.body&&typeof result.body==='object'&&typeof result.body.projectId==='string')
          assert.equal(result.body.projectId,project.projectId,'J7 page project identity drift: '+page.key);
        pageChecks++;
      }
    }
    assert.equal(pageChecks,20*58,'J7 page-first matrix must be complete');

    const first=projects[0]!,second=projects[1]!;
    const before=await requireOk('/api/projects/'+encodeURIComponent(first.projectId)+'/evidence/documents');

    const mismatchedAsk=await request('/api/projects/'+encodeURIComponent(first.projectId)+'/intelligence/ask',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        question:'What is the Data Date?',
        pageContext:{projectId:second.projectId,page:'master-dashboard',filters:{},selectedActivity:null,selectedWbs:null,selectedLocation:null,selectedPackage:null},
      }),
    });
    assert.equal(mismatchedAsk.status,409,'Ask accepted a page context from another project');

    const malformed=await request('/api/projects/'+encodeURIComponent(first.projectId)+'/evidence/uploads',{
      method:'POST',
      headers:{'content-type':'text/plain','x-source-filename-encoded':'%E0%A4%A','x-source-relative-path-encoded':'%E0%A4%A','x-upload-id':'J7-MALFORMED'},
      body:'invalid metadata check',
    });
    assert.equal(malformed.status,400,'invalid encoded filename did not fail closed');
    const afterMalformed=await requireOk('/api/projects/'+encodeURIComponent(first.projectId)+'/evidence/documents');
    assert.deepEqual(retainedInventory(afterMalformed),retainedInventory(before),'failed metadata request changed the evidence register');

    assert.equal((await request('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:'{"projectId":'})).status,400);
    assert.equal((await request('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'X'.repeat(9000)})})).status,413);

    const unknown='J7-UNKNOWN-'+createHash('sha256').update(seed).digest('hex').slice(0,10).toUpperCase();
    assert.equal((await request('/api/projects/'+unknown+'/overview')).status,404,'unknown read implicitly created a project');
    const portfolio=await requireOk('/api/portfolio');
    const synthetic=await requireOk('/api/test-projects');
    assert.equal(portfolio.projectCount,0,'Blind fixtures leaked into a client project portfolio');
    assert.equal(synthetic.projectCount,20,'Invalid requests changed the blind test-project catalogue');
    assert.ok(!synthetic.projects.some((project:any)=>project.projectId===unknown));

    const health=await requireOk('/health');
    assert.equal(health.status,'ok');
    assert.ok(health.projectWorkers<=4,'J7 exceeded configured worker cap');

    for(const project of projects){
      const documents=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
      assert.deepEqual(retainedInventory(documents),expectedInventory(project),'J7 invalid-request phase damaged '+project.projectId);
    }

    await gateway.close();
    gateway=await createProjectGateway(root,{maxWorkers:4});
    base=await listen(gateway);

    for(const project of projects){
      const documents=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
      assert.deepEqual(retainedInventory(documents),expectedInventory(project),'J7 restart inventory drift: '+project.projectId);
      const overview=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/overview');
      assert.equal(overview.projectId,project.projectId,'J7 restart project identity drift');
      assert.equal(overview.latestDataDateIso,project.dataDateIso,'J7 restart Data Date drift: '+project.projectId);
    }

    process.stdout.write('\nCMENG_J7_ENTERPRISE_RESULT='+JSON.stringify({projects:projects.length,pagesPerProject:moduleRegistry.length,pageChecks,workerCap:4})+'\n');
  }finally{
    await gateway.close();
    await rm(root,{recursive:true,force:true});
  }
});
