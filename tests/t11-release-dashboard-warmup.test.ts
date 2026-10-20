import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectDirectory,calculationRelease} from '../packages/runtime-api/src/project-catalog';
import {ProjectReadCache} from '../packages/runtime-api/src/project-read-cache';

// After a new release (calculation version changed), every stored project's
// Dashboard is warmed in the background through the request path, most
// recently used first, and a user request is never queued behind warm-up.
function xer(id:string,count:number){
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+id+'\t2031-04-01','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tEight hour calendar\tMon-Fri 08:00-16:00','%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt'];
  for(let i=0;i<count;i++)lines.push(['%R',i,1,1,'A'+i,id+' work '+i,'TK_NotStart','2031-04-01','2031-06-01',8,8,i%7].join('\t'));
  return [...lines,'%E'].join('\n');
}
async function listen(gateway:Awaited<ReturnType<typeof createProjectGateway>>){await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;}
const dashboardPath=(id:string)=>'/api/projects/'+id+'/management/master-dashboard';
const saved=(root:string,id:string,version:number)=>new ProjectReadCache(projectDirectory(root,id)).get(calculationRelease(),version,dashboardPath(id));
const ids=['WARM-A','WARM-B','WARM-C','WARM-D'];

test('stored projects from another calculation version get their Dashboard warmed in the background, most recent first, without delaying a user',{timeout:240000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-release-warm-'));
  const versions=new Map<string,number>();
  try{
    // 1. Real upload path: create and upload each project.
    const first=await createProjectGateway(root,{maxWorkers:2});const base1=await listen(first);
    try{
      for(const id of ids){
        const created=await fetch(base1+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:id})});assert.equal(created.status,201);
        const upload=await fetch(base1+'/api/projects/'+id+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'programme.xer','x-upload-intent':'replace_current_basis','x-schedule-role':'update'},body:xer(id,40)});
        assert.equal(upload.status,201,await upload.text());
        versions.set(id,Number(upload.headers.get('x-cmeng-project-version')));
      }
    }finally{await first.close();}
    // 2. Simulate a new release: every stored result belongs to another calculation version.
    for(const [index,id] of ids.entries()){
      const directory=projectDirectory(root,id);
      try{const portfolio=JSON.parse(await readFile(join(directory,'portfolio.json'),'utf8'));portfolio.release='calc:previous-release';await writeFile(join(directory,'portfolio.json'),JSON.stringify(portfolio));}catch{}
      await new ProjectReadCache(directory).invalidate();
      // WARM-A is the least recently used, WARM-D the most recent.
      const at=new Date(Date.now()-(ids.length-index)*3600000);await utimes(directory,at,at);
    }
    // 3. New gateway, no request: Dashboards become ready in the background.
    const gateway=await createProjectGateway(root,{maxWorkers:2});const base=await listen(gateway);
    try{
      const readyAt=new Map<string,number>();
      const versionOf=async(id:string)=>{const v=gateway.catalog.get(id)?.metadata?.version;return v===undefined?versions.get(id)!:v;};
      const poll=async()=>{for(const id of ids)if(!readyAt.has(id)&&await saved(root,id,await versionOf(id)))readyAt.set(id,Date.now());};
      let deadline=Date.now()+120000;
      while(!readyAt.has('WARM-D')&&Date.now()<deadline){await poll();if(!readyAt.has('WARM-D'))await new Promise(r=>setTimeout(r,100));}
      assert.ok(readyAt.has('WARM-D'),'most recently used project warmed without any request');
      assert.ok(!readyAt.has('WARM-A'),'least recently used project is not warmed before the most recent one');
      // 4. A user opens the least recent (not yet warmed) project during warm-up.
      const pendingBefore=ids.filter(id=>!readyAt.has(id));
      const started=Date.now();
      const response=await fetch(base+dashboardPath('WARM-A'));
      const servedAt=Date.now();
      assert.equal(response.status,200);
      const body=Buffer.from(await response.arrayBuffer());
      const version=Number(response.headers.get('x-cmeng-project-version'));
      assert.equal(version,await versionOf('WARM-A'));
      assert.equal((JSON.parse(body.toString()) as any).data?.projectId,'WARM-A');
      await poll();
      // Served next: at most the one warm-up item already running may finish;
      // no queued warm-up item is served ahead of the user request.
      const overtook=pendingBefore.filter(id=>id!=='WARM-A'&&(readyAt.get(id)??Infinity)<servedAt);
      assert.ok(overtook.length<=1,'user request served before remaining warm-up items ('+(servedAt-started)+' ms): '+overtook.join(','));
      // 5. Remaining projects finish warming; every result equals a request-time result.
      deadline=Date.now()+120000;
      while(ids.some(id=>!readyAt.has(id))&&Date.now()<deadline){await poll();await new Promise(r=>setTimeout(r,150));}
      assert.deepEqual(ids.filter(id=>!readyAt.has(id)),[],'every stored project warmed');
      for(const id of ids){
        const cached=await saved(root,id,await versionOf(id));
        const served=await fetch(base+dashboardPath(id));assert.equal(served.status,200);
        assert.equal(served.headers.get('x-cmeng-project-version'),String(await versionOf(id)));
        assert.ok(cached&&Buffer.from(await served.arrayBuffer()).equals(cached),'warmed Dashboard equals the served Dashboard: '+id);
      }
    }finally{await gateway.close();}
  }finally{await rm(root,{recursive:true,force:true});}
});
