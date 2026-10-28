// T11 (28 Oct): after a deployment every saved result belongs to the previous
// calculation release, so each project's first Overview and Dashboard was a full
// cold calculation (ABB-100: 42 s and 15 s). A new release now recalculates
// every previously calculated project before the deployment reports ready.
// These tests prove the saved results are this release's own calculation, that
// any change to a project recalculates exactly the affected project, and that a
// project never calculated before is not prepared (its first page stays cold).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectDirectory,calculationRelease} from '../packages/runtime-api/src/project-catalog';
import {ProjectReadCache} from '../packages/runtime-api/src/project-read-cache';

function xer(id:string,count:number,dataDate:string,finish:string){
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+id+'\t'+dataDate,'%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tEight hour calendar\tMon-Fri 08:00-16:00','%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt'];
  for(let i=0;i<count;i++)lines.push(['%R',i,1,1,'A'+i,id+' work '+i,'TK_NotStart',dataDate,finish,8,8,i%7].join('\t'));
  return [...lines,'%E'].join('\n');
}
type Gateway=Awaited<ReturnType<typeof createProjectGateway>>;
async function listen(gateway:Gateway){await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;}
const pages=(id:string)=>['/api/projects/'+id+'/overview','/api/projects/'+id+'/management/master-dashboard','/api/projects/'+id+'/management/cross-domain-accountability'];
const stored=(root:string,id:string,version:number,path:string)=>new ProjectReadCache(projectDirectory(root,id)).get(calculationRelease(),version,path);
const ids=['PREP-A','PREP-B'];
// Fields that record when a page was produced, not what it says.
const content=(body:Buffer)=>JSON.stringify(JSON.parse(body.toString()),(key,value)=>/^(generatedAt|calculatedAt|servedAt|timestamp)$/i.test(key)?undefined:value);
function firstDifference(a:unknown,b:unknown,path=''):string|null{
  if(typeof a!==typeof b||Array.isArray(a)!==Array.isArray(b)||(a===null)!==(b===null))return path+': '+JSON.stringify(a)?.slice(0,120)+' vs '+JSON.stringify(b)?.slice(0,120);
  if(a&&typeof a==='object'){
    const keys=[...new Set([...Object.keys(a as object),...Object.keys(b as object)])];
    for(const key of keys){const d=firstDifference((a as any)[key],(b as any)[key],path+'.'+key);if(d)return d;}
    return null;
  }
  return a===b?null:path+': '+JSON.stringify(a)?.slice(0,120)+' vs '+JSON.stringify(b)?.slice(0,120);
}
async function upload(base:string,id:string,dataDate:string,finish:string){
  const response=await fetch(base+'/api/projects/'+id+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'programme-'+dataDate+'.xer','x-upload-intent':'replace_current_basis','x-schedule-role':'update'},body:xer(id,60,dataDate,finish)});
  assert.equal(response.status,201,await response.text());
  return Number(response.headers.get('x-cmeng-project-version'));
}
async function simulatePreviousRelease(root:string){
  for(const id of ids){
    const directory=projectDirectory(root,id);
    const portfolio=JSON.parse(await readFile(join(directory,'portfolio.json'),'utf8'));
    portfolio.release='calc:previous-release';await writeFile(join(directory,'portfolio.json'),JSON.stringify(portfolio));
    await new ProjectReadCache(directory).invalidate();
  }
}
async function waitHealthy(base:string,limitMs:number){
  const started=Date.now(),seen:string[]=[];
  for(;;){
    const response=await fetch(base+'/health');const body=await response.json() as any;
    seen.push(response.status+':'+body.status);
    if(response.status===200)return {body,seen};
    assert.equal(response.status,503);assert.equal(body.status,'preparing');
    if(Date.now()-started>limitMs)assert.fail('not ready within '+limitMs+' ms: '+seen.slice(-3).join(','));
    await new Promise(r=>setTimeout(r,100));
  }
}

test('R17 a new release prepares every previously calculated project before it reports ready; a change recalculates only that project',{timeout:300000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-r17-prepare-'));
  try{
    // 1. Two projects uploaded and opened under the current release.
    const versions=new Map<string,number>(),requestTime=new Map<string,string>();
    const first=await createProjectGateway(root,{maxWorkers:2,prepareRelease:false});const base1=await listen(first);
    try{
      for(const id of ids){
        const created=await fetch(base1+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:id})});assert.equal(created.status,201);
        versions.set(id,await upload(base1,id,'2031-04-01','2031-06-01'));
        // The Overview reads the project's finished calculation, so it is taken after Accountability and Dashboard, as in preparation.
        for(const path of [pages(id)[2]!,pages(id)[1]!,pages(id)[0]!]){const r=await fetch(base1+path);assert.equal(r.status,200);requestTime.set(path,content(Buffer.from(await r.arrayBuffer())));}
      }
      // Summaries are saved before the release changes.
      const deadline=Date.now()+60000;
      while(ids.some(id=>first.catalog.get(id)?.summaryRelease!==calculationRelease())&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
      assert.ok(ids.every(id=>first.catalog.get(id)?.summaryRelease===calculationRelease()),'summaries saved');
    }finally{await first.close();}

    // A never-calculated project in the same data root is not prepared.
    const fresh=await createProjectGateway(root,{maxWorkers:2,prepareRelease:false});const baseFresh=await listen(fresh);
    try{
      const created=await fetch(baseFresh+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'PREP-NEW'})});assert.equal(created.status,201);
    }finally{await fresh.close();}

    // 2. A new release: every saved result belongs to another calculation version.
    await simulatePreviousRelease(root);
    const spare=await mkdtemp(join(tmpdir(),'cmeng-r17-prepare-limit-'));
    await cp(root,spare,{recursive:true});

    const gateway=await createProjectGateway(root,{maxWorkers:2,prepareRelease:true,releasePreparationMs:120000});const base=await listen(gateway);
    try{
      const {body,seen}=await waitHealthy(base,120000);
      assert.equal(seen[0],'503:preparing','the release is not ready before preparation finishes');
      assert.equal(body.releasePreparation.state,'complete');
      assert.equal(body.releasePreparation.totalProjects,2,'only the two previously calculated projects are prepared');
      assert.equal(body.releasePreparation.preparedProjects,2);
      assert.equal(body.releasePreparation.allPagesProjects,2,'the remaining pages are prepared before ready too');
      for(const id of ids){
        const version=gateway.catalog.get(id)!.metadata!.version;
        for(const path of ['/schedule/modules/near-critical','/commercial/modules/contract-particulars-bonds','/actions'].map(p=>'/api/projects/'+id+p))
          assert.ok(await stored(root,id,version,path),'module page prepared before ready: '+path);
      }
      // 3. Every first page is this release's saved calculation and equals the request-time result.
      for(const id of ids){
        const version=gateway.catalog.get(id)!.metadata!.version;assert.equal(version,versions.get(id));
        for(const path of pages(id)){
          const saved=await stored(root,id,version,path);
          assert.ok(saved,'prepared before ready: '+path);
          const served=await fetch(base+path);assert.equal(served.status,200);
          assert.equal(served.headers.get('x-cmeng-project-version'),String(version));
          const bytes=Buffer.from(await served.arrayBuffer());
          assert.ok(bytes.equals(saved!),'served from the prepared result: '+path);
          assert.ok(content(bytes)===requestTime.get(path),'prepared result equals the request-time calculation: '+path+' '+firstDifference(JSON.parse(content(bytes)),JSON.parse(requestTime.get(path)!)));
        }
      }
      // 4. Invalidation: a new programme for PREP-A changes its version and data date.
      const before=Buffer.from(await (await fetch(base+pages('PREP-A')[0])).arrayBuffer());
      const untouched=new Map<string,Buffer>();
      for(const path of pages('PREP-B'))untouched.set(path,Buffer.from(await (await fetch(base+path)).arrayBuffer()));
      const changed=await upload(base,'PREP-A','2031-05-01','2031-07-15');
      assert.ok(changed>versions.get('PREP-A')!,'the change gives a new project version');
      for(const path of pages('PREP-A'))assert.equal(await stored(root,'PREP-A',versions.get('PREP-A')!,path),null,'results of the old version are removed: '+path);
      const after=await fetch(base+pages('PREP-A')[0]);assert.equal(after.status,200);
      assert.equal(after.headers.get('x-cmeng-project-version'),String(changed));
      const afterBytes=Buffer.from(await after.arrayBuffer());
      assert.notEqual(content(afterBytes),content(before),'the Overview is recalculated');
      assert.ok(afterBytes.toString().includes('2031-05-01'),'the new data date is shown');
      const dashboard=await fetch(base+pages('PREP-A')[1]);assert.equal(dashboard.headers.get('x-cmeng-project-version'),String(changed));
      // The other project is not recalculated: the same saved result is served.
      for(const [path,bytes] of untouched){const again=Buffer.from(await (await fetch(base+path)).arrayBuffer());assert.ok(again.equals(bytes),'unchanged project keeps its result: '+path);}
    }finally{await gateway.close();}

    // 5. Restart: nothing to prepare; the recalculated result is served after the restart.
    const restarted=await createProjectGateway(root,{maxWorkers:2,prepareRelease:true,releasePreparationMs:120000});const base3=await listen(restarted);
    try{
      const {body}=await waitHealthy(base3,60000);
      assert.equal(body.releasePreparation.totalProjects,0,'a restart of the same release prepares nothing');
      const overview=await fetch(base3+pages('PREP-A')[0]);assert.equal(overview.status,200);
      assert.ok(Buffer.from(await overview.arrayBuffer()).toString().includes('2031-05-01'));
    }finally{await restarted.close();}

    // 6. Time limit: the release reports ready at the limit and preparation continues.
    const limited=await createProjectGateway(spare,{maxWorkers:2,prepareRelease:true,releasePreparationMs:1});const base4=await listen(limited);
    try{
      const {body}=await waitHealthy(base4,10000);
      assert.equal(body.releasePreparation.state,'timed_out');
      const deadline=Date.now()+120000;
      const done=async()=>{for(const id of ids){const v=limited.catalog.get(id)?.metadata?.version;if(v===undefined||!await stored(spare,id,v,pages(id)[1]!))return false;}return true;};
      while(!await done()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,200));
      assert.ok(await done(),'preparation continues after the time limit');
    }finally{await limited.close();await rm(spare,{recursive:true,force:true});}
  }finally{await rm(root,{recursive:true,force:true});}
});
