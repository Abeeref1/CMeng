import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';

import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectFactConsumerMismatches} from '../packages/runtime-api/src/project-fact-consumers';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {
  defaultBlindSeed,
  generateBlindRound,
  generateMixedWorkbookBlindRound,
  generateLifecycleMixedWorkbookBlindRound,
  generateSemanticAiBlindRound,
  type BlindDocument,
} from './blind-project-generator';

type ReleaseBlindProject={
  family:'general'|'mixed'|'lifecycle'|'semantic';
  projectId:string;
  projectName:string;
  language:string;
  dataDateIso:string;
  documents:BlindDocument[];
  scenario?:string;
};

const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const factsDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function listen(gateway:Awaited<ReturnType<typeof createProjectGateway>>){
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
  return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
}
function pagePath(projectId:string,page:(typeof moduleRegistry)[number]){
  return '/api/projects/'+encodeURIComponent(projectId)+(page.area==='management'?'/management/'+page.key:'/'+page.area+'/modules/'+page.key);
}
function expectedInventory(project:ReleaseBlindProject){
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

test('J8 final fresh blind release acceptance: 100 unseen projects remain truthful across every page, deterministic Ask and restart',{timeout:420000},async()=>{
  const rootSeed=defaultBlindSeed()+'::J8-FINAL-REAL-ACCEPTANCE';
  process.stdout.write('\nCMENG_J8_BLIND_PROJECT_SET_SEED='+rootSeed+'\n');

  const [general,mixed,lifecycle,semantic]=await Promise.all([
    generateBlindRound(rootSeed+'::general',40),
    generateMixedWorkbookBlindRound(rootSeed+'::mixed',25),
    generateLifecycleMixedWorkbookBlindRound(rootSeed+'::lifecycle',20),
    generateSemanticAiBlindRound(rootSeed+'::semantic',15),
  ]);
  const projects:ReleaseBlindProject[]=[
    ...general.projects.map(project=>({...project,family:'general' as const})),
    ...mixed.projects.map(project=>({...project,family:'mixed' as const})),
    ...lifecycle.projects.map(project=>({...project,family:'lifecycle' as const})),
    ...semantic.projects.map(project=>({...project,family:'semantic' as const})),
  ];

  assert.equal(projects.length,100,'J8 requires a 100-project fresh release cohort');
  assert.equal(new Set(projects.map(project=>project.projectId)).size,100,'J8 project identities must all be new and unique');
  assert.equal(moduleRegistry.length,58,'J8 must cover the complete current 58-page registry');
  assert.equal(new Set(general.projects.map(project=>project.scenario)).size,8,'J8 general family must cover all eight truth states');
  for(const family of ['general','mixed','lifecycle','semantic'] as const)
    assert.ok(projects.filter(project=>project.family===family).length>0,'J8 missing '+family+' family');
  assert.equal(new Set(projects.map(project=>project.language)).size,3,'J8 must include English, Arabic and mixed projects');

  const root=await mkdtemp(join(tmpdir(),'cmeng-j8-final-'));
  let gateway=await createProjectGateway(root,{maxWorkers:4});
  let base=await listen(gateway);
  let pageChecks=0,askChecks=0;

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
  const upload=async(project:ReleaseBlindProject,document:BlindDocument,index:number)=>{
    const result=await request('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/uploads',{
      method:'POST',
      headers:{
        'content-type':document.mediaType,
        'x-source-filename-encoded':encodeURIComponent(document.filename),
        'x-source-relative-path-encoded':encodeURIComponent(document.filename),
        'x-upload-intent':'add_update',
        'x-upload-id':'J8-SHARED-'+index,
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

    const allIds=projects.map(project=>project.projectId);
    for(const project of projects){
      const documents=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
      assert.equal(documents.documentCount,project.documents.length,'J8 retained document count mismatch: '+project.projectId);
      assert.deepEqual(retainedInventory(documents),expectedInventory(project),'J8 source inventory drift: '+project.projectId);

      const progress=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/upload-progress/J8-SHARED-0');
      assert.equal(progress.projectId,project.projectId,'J8 upload progress crossed project boundary');
      assert.equal(progress.state,'complete');

      const otherIds=allIds.filter(id=>id!==project.projectId);
      let usefulPages=0;
      let canonicalProjectFactsDigest:string|null=null;
      for(const page of moduleRegistry){
        const result=await request(pagePath(project.projectId,page));
        assert.ok(result.status===200||result.status===409,
          'J8 page must resolve or be explicitly governed-blocked: '+project.projectId+' / '+page.key+' -> '+result.status+' '+result.text.slice(0,500));
        if(result.status===200)usefulPages++;
        if(result.status===409){
          assert.equal(result.body?.status,'blocked','J8 409 is not a governed blocked result: '+project.projectId+' / '+page.key);
          assert.ok(typeof result.body?.reason==='string'&&result.body.reason.trim().length>0,
            'J8 blocked page has no explanation: '+project.projectId+' / '+page.key);
          assert.ok(Array.isArray(result.body?.dependencies),
            'J8 blocked page has no dependency evidence: '+project.projectId+' / '+page.key);
        }
        assert.ok(!/\b(?:NaN|Infinity|-Infinity)\b/.test(result.text),'J8 non-finite value escaped into JSON: '+project.projectId+' / '+page.key);
        for(const otherId of otherIds)assert.ok(!result.text.includes(otherId),
          'J8 cross-project disclosure: '+project.projectId+' / '+page.key+' contains '+otherId);
        if(result.body&&typeof result.body==='object'&&typeof result.body.projectId==='string')
          assert.equal(result.body.projectId,project.projectId,'J8 page project identity drift: '+page.key);
        const facts=result.body?.data?.projectFacts;
        assert.ok(facts&&facts.projectId===project.projectId,'J8 canonical project facts missing or cross-project: '+project.projectId+' / '+page.key);
        const currentFactsDigest=factsDigest(facts);
        if(canonicalProjectFactsDigest===null)canonicalProjectFactsDigest=currentFactsDigest;
        else assert.equal(currentFactsDigest,canonicalProjectFactsDigest,'J8 canonical project facts differ across pages: '+project.projectId+' / '+page.key);
        assert.deepEqual(projectFactConsumerMismatches(result.body?.data),[], 'J8 displayed consumer values differ from canonical facts: '+project.projectId+' / '+page.key);
        pageChecks++;
      }
      assert.ok(usefulPages>0,'J8 project became blocked/unresolved everywhere: '+project.projectId);

      const dateAnswer=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/intelligence/ask',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'What is the Data Date?'}),
      });
      assert.equal(dateAnswer.projectId,project.projectId,'J8 Ask Data Date crossed project');
      assert.equal(dateAnswer.telemetry?.aiInvoked,false,'J8 deterministic Data Date invoked paid AI');
      assert.ok(dateAnswer.plan?.authorities?.includes('programme'),'J8 Data Date did not use programme authority');
      askChecks++;

      const completionAnswer=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/intelligence/ask',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'What is current completion?'}),
      });
      assert.equal(completionAnswer.projectId,project.projectId,'J8 Ask completion crossed project');
      assert.equal(completionAnswer.telemetry?.aiInvoked,false,'J8 deterministic completion invoked paid AI');
      assert.ok(completionAnswer.plan?.authorities?.includes('forecast'),'J8 current completion did not use forecast authority');
      assert.ok(!completionAnswer.plan?.authorities?.includes('progress'),'J8 current completion regressed to progress routing');
      askChecks++;
    }

    assert.equal(pageChecks,100*58,'J8 full page matrix is incomplete');
    assert.equal(askChecks,100*2,'J8 deterministic Ask matrix is incomplete');

    const portfolio=await requireOk('/api/portfolio');
    assert.equal(portfolio.projectCount,100,'J8 portfolio lost or invented projects');
    assert.equal(new Set(portfolio.projects.map((project:any)=>project.projectId)).size,100,'J8 portfolio contains duplicate identities');

    const health=await requireOk('/health');
    assert.equal(health.status,'ok');
    assert.ok(health.projectWorkers<=4,'J8 exceeded configured worker cap');

    await gateway.close();
    gateway=await createProjectGateway(root,{maxWorkers:4});
    base=await listen(gateway);

    for(const project of projects){
      const documents=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
      assert.deepEqual(retainedInventory(documents),expectedInventory(project),'J8 restart changed source inventory: '+project.projectId);
      const overview=await requireOk('/api/projects/'+encodeURIComponent(project.projectId)+'/overview');
      assert.equal(overview.projectId,project.projectId,'J8 restart project identity drift');
      assert.equal(overview.latestDataDateIso,project.dataDateIso,'J8 restart Data Date drift: '+project.projectId);
    }

    process.stdout.write('\nCMENG_J8_FINAL_RESULT='+JSON.stringify({
      projects:projects.length,
      families:{general:40,mixed:25,lifecycle:20,semantic:15},
      pagesPerProject:moduleRegistry.length,
      pageChecks,
      askChecks,
      workerCap:4,
    })+'\n');
  }finally{
    await gateway.close();
    await rm(root,{recursive:true,force:true});
  }
});
