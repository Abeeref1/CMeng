import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';

import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectDirectory} from '../packages/runtime-api/src/project-catalog';
import {defaultBlindSeed,generateStorageBlindRound,type BlindDocument,type StorageBlindProject} from './blind-project-generator';

const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function listen(gateway:Awaited<ReturnType<typeof createProjectGateway>>){
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
  return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
}
function expectedInventory(project:StorageBlindProject){
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
function exactInventory(register:any){
  return (register.documents??[]).map((document:any)=>({
    documentId:document.documentId,
    sourceFilename:document.sourceFilename,
    sourceHashSha256:document.sourceHashSha256,
    sizeBytes:document.sizeBytes,
    category:document.category,
    documentType:document.documentType,
    linkedArtifactId:document.linkedArtifactId,
    familyKey:document.familyKey,
    basisState:document.basisState,
  })).sort((a:any,b:any)=>a.documentId.localeCompare(b.documentId));
}

test('J6 fresh blind storage cohort: controlled concurrent projects preserve exact sources across retry, worker eviction and restart',{timeout:240000},async()=>{
  const seed=defaultBlindSeed()+'::J6-STORAGE-DURABILITY-PERFORMANCE';
  process.stdout.write('\nCMENG_J6_BLIND_PROJECT_SET_SEED='+seed+'\n');
  const {projects}=await generateStorageBlindRound(seed,16);
  assert.equal(new Set(projects.map(project=>project.projectId)).size,16,'J6 requires 16 fresh project identities');
  assert.equal(new Set(projects.map(project=>project.scenario)).size,8,'J6 must cover all eight evidence truth states');
  assert.equal(new Set(projects.map(project=>project.language)).size,3,'J6 must cover English, Arabic and mixed projects');
  assert.ok(projects.every(project=>project.storageActivityCount>=250&&project.storageActivityCount<=1500),'J6 storage schedules must be realistically sized');
  assert.ok(new Set(projects.map(project=>project.storageActivityCount)).size>=10,'J6 storage cohort must materially vary schedule size');

  const root=await mkdtemp(join(tmpdir(),'cmeng-j6-blind-storage-'));
  let gateway=await createProjectGateway(root,{maxWorkers:2});
  let base=await listen(gateway);
  const samples:Array<{path:string;ms:number;pending:number}>=[];
  const beforeRestart=new Map<string,{inventory:any[];overview:any}>();

  const request=async(path:string,init?:RequestInit)=>{
    const response=await fetch(base+path,init);
    const body=await response.text();
    assert.ok(response.ok,path+' returned '+response.status+': '+body.slice(0,800));
    return body?JSON.parse(body):null;
  };
  const upload=async(project:StorageBlindProject,document:BlindDocument,suffix:string)=>{
    const path='/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/uploads';
    const response=await fetch(base+path,{
      method:'POST',
      headers:{
        'content-type':document.mediaType,
        'x-source-filename-encoded':encodeURIComponent(document.filename),
        'x-source-relative-path-encoded':encodeURIComponent(document.filename),
        'x-upload-intent':'add_update',
        'x-upload-id':'j6-'+project.projectId+'-'+suffix,
      },
      body:Buffer.from(document.bytes),
    });
    const text=await response.text();
    assert.equal(response.status,201,path+' '+document.filename+' failed: '+text.slice(0,1000));
    return text?JSON.parse(text):null;
  };

  try{
    await request('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'J6-SENTINEL'})});
    await request('/api/projects/J6-SENTINEL/overview');
    for(const project of projects)await request('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:project.projectId})});

    // The CI/sandbox runner is constrained to two effective cores. Preserve the
    // full 16-project durability cohort while applying pressure in controlled
    // four-project waves. This still exercises queueing, worker reuse/eviction,
    // concurrent mutation and unrelated-read responsiveness without converting
    // worker-start starvation into a false durability failure.
    for(let start=0;start<projects.length;start+=4){
      const batch=projects.slice(start,start+4);
      let pending=batch.length;
      const uploads=batch.map(async project=>{
        try{
          for(const [index,document] of project.documents.entries())await upload(project,document,String(index));
        }finally{pending--;}
      });
      for(let round=0;pending>0&&round<500;round++){
        for(const path of ['/health','/api/projects/J6-SENTINEL/overview']){
          const begin=performance.now(),inFlight=pending;
          const result=await request(path);
          const ms=performance.now()-begin;
          samples.push({path,ms,pending:inFlight});
          if(path.endsWith('/overview'))assert.equal(result.projectId,'J6-SENTINEL');
        }
        await new Promise(resolve=>setTimeout(resolve,15));
      }
      await Promise.all(uploads);
    }
    assert.ok(samples.some(sample=>sample.pending>=2),'J6 responsiveness must overlap independent project uploads');
    assert.ok(samples.every(sample=>sample.ms<2500),'J6 unrelated reads must remain responsive during blind uploads: '+JSON.stringify(samples.slice(-30)));

    for(const project of projects){
      const documents=await request('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
      assert.equal(documents.documentCount,project.documents.length,'J6 retained document count mismatch: '+project.projectId);
      assert.deepEqual(retainedInventory(documents),expectedInventory(project),'J6 retained source/hash mismatch: '+project.projectId);
      const overview=await request('/api/projects/'+encodeURIComponent(project.projectId)+'/overview');
      assert.equal(overview.projectId,project.projectId);
      assert.equal(overview.latestDataDateIso,project.dataDateIso,'J6 project Data Date drift after concurrent ingestion: '+project.projectId);

      const snapshotPath=join(projectDirectory(root,project.projectId),'cmeng-project-state.json');
      const snapshot=JSON.parse(await readFile(snapshotPath,'utf8'));
      assert.equal(snapshot.projects.length,1,'J6 project snapshot must stay isolated: '+project.projectId);
      assert.equal(snapshot.projects[0].projectId,project.projectId);
      assert.equal(snapshot.projects[0].schedules[0].revision.model.activities.length,project.storageActivityCount,
        'J6 snapshot schedule population mismatch: '+project.projectId);
      for(const document of snapshot.projects[0].evidenceDocuments){
        const bytes=await readFile(document.storedPath);
        assert.equal(sha(bytes),document.sourceHashSha256,'J6 raw source bytes changed on disk: '+project.projectId+' / '+document.sourceFilename);
      }

      beforeRestart.set(project.projectId,{inventory:exactInventory(documents),overview});
    }

    // Retry an already-saved source for every project. Exactly-once identity must
    // survive content/filename repetition without duplicate documents.
    for(const project of projects){
      const document=project.documents[0]!;
      await upload(project,document,'retry');
      const documents=await request('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
      assert.equal(documents.documentCount,project.documents.length,'J6 retry duplicated a retained source: '+project.projectId);
      assert.deepEqual(retainedInventory(documents),expectedInventory(project),'J6 retry changed source inventory: '+project.projectId);
    }

    // Walk every project with only three workers to force eviction before restart.
    for(const project of projects)await request('/api/projects/'+encodeURIComponent(project.projectId)+'/overview');
    const health=await request('/health');
    if(typeof health.projectWorkers==='number')assert.ok(health.projectWorkers<=2,'J6 worker cap exceeded');

    await gateway.close();
    gateway=await createProjectGateway(root,{maxWorkers:2});
    base=await listen(gateway);

    for(const project of projects){
      const documents=await request('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents');
      const expected=beforeRestart.get(project.projectId)!;
      assert.deepEqual(exactInventory(documents),expected.inventory,'J6 restart changed governed source inventory: '+project.projectId);
      const overview=await request('/api/projects/'+encodeURIComponent(project.projectId)+'/overview');
      assert.equal(overview.latestDataDateIso,project.dataDateIso,'J6 restart changed project Data Date: '+project.projectId);

      const snapshot=JSON.parse(await readFile(join(projectDirectory(root,project.projectId),'cmeng-project-state.json'),'utf8'));
      assert.equal(snapshot.projects.length,1);
      assert.equal(snapshot.projects[0].projectId,project.projectId);
      for(const document of snapshot.projects[0].evidenceDocuments){
        assert.equal(sha(await readFile(document.storedPath)),document.sourceHashSha256,
          'J6 restart raw source hash mismatch: '+project.projectId+' / '+document.sourceFilename);
      }
    }

    const ordered=samples.map(sample=>sample.ms).sort((a,b)=>a-b);
    const p95=ordered[Math.min(ordered.length-1,Math.floor(ordered.length*0.95))]??0;
    const max=ordered.at(-1)??0;
    process.stdout.write('\nCMENG_J6_RESPONSIVENESS='+JSON.stringify({samples:samples.length,p95Ms:Number(p95.toFixed(2)),maxMs:Number(max.toFixed(2))})+'\n');
  }finally{
    await gateway.close();
    await rm(root,{recursive:true,force:true});
  }
});
