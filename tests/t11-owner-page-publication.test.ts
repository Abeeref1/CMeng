import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectDirectory,calculationRelease} from '../packages/runtime-api/src/project-catalog';
import {ProjectReadCache} from '../packages/runtime-api/src/project-read-cache';

// After a foreground management calculation, the sibling owner pages are
// published off the foreground turn: when the lane is idle with nobody
// waiting, or just before the lane is evicted. Either way the finished
// calculation is never thrown away.
function xer(id:string,count:number){
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+id+'\t2031-04-01','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tEight hour calendar\tMon-Fri 08:00-16:00','%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt'];
  for(let i=0;i<count;i++)lines.push(['%R',i,1,1,'A'+i,id+' work '+i,'TK_NotStart','2031-04-01','2031-06-01',8,8,i%7].join('\t'));
  return [...lines,'%E'].join('\n');
}
async function listen(gateway:Awaited<ReturnType<typeof createProjectGateway>>){await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;}
const ownerPages=['/management/cross-domain-accountability','/director-position','/management-surfaces'];
async function calculatedDashboard(base:string,id:string){
  const created=await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:id})});assert.equal(created.status,201);
  const upload=await fetch(base+'/api/projects/'+id+'/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'programme.xer','x-upload-intent':'replace_current_basis','x-schedule-role':'update'},body:xer(id,12)});
  assert.equal(upload.status,201,await upload.text());
  const dashboard=await fetch(base+'/api/projects/'+id+'/management/master-dashboard');assert.equal(dashboard.status,200);
  const version=Number(dashboard.headers.get('x-cmeng-project-version'));
  assert.ok((await dashboard.json() as any).data?.positionVerdict);assert.ok(Number.isInteger(version));
  return version;
}
const saved=(root:string,id:string,version:number,page:string)=>new ProjectReadCache(projectDirectory(root,id)).get(calculationRelease(),version,'/api/projects/'+id+page);

test('owner pages of a finished calculation are published before its worker is evicted',{timeout:120000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-owner-evict-'));
  const gateway=await createProjectGateway(root,{maxWorkers:1});const base=await listen(gateway);
  try{
    const version=await calculatedDashboard(base,'EVICT-A');
    // A second project needs the only worker immediately: EVICT-A is evicted.
    const other=await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'EVICT-B'})});
    assert.equal(other.status,201);
    for(const page of ownerPages)assert.ok(await saved(root,'EVICT-A',version,page),'saved before eviction: '+page);
    const health=await (await fetch(base+'/health')).json() as any;assert.equal(health.projectWorkers,1);
    // Served from the saved result: no worker is restarted for EVICT-A.
    const accountability=await fetch(base+'/api/projects/EVICT-A/management/cross-domain-accountability');
    assert.equal(accountability.status,200);assert.equal((await accountability.json() as any).data?.projectId,'EVICT-A');
    assert.equal(accountability.headers.get('x-cmeng-project-version'),String(version));
  }finally{await gateway.close();await rm(root,{recursive:true,force:true});}
});

test('owner pages are published while the lane is idle, after the foreground response',{timeout:120000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-owner-idle-'));
  const gateway=await createProjectGateway(root,{maxWorkers:2});const base=await listen(gateway);
  try{
    const version=await calculatedDashboard(base,'IDLE-A');
    // No other request: the idle lane publishes its retained owner pages.
    const deadline=Date.now()+20000;let missing=ownerPages;
    while(missing.length&&Date.now()<deadline){
      const next:string[]=[];for(const page of missing)if(!await saved(root,'IDLE-A',version,page))next.push(page);
      missing=next;if(missing.length)await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.deepEqual(missing,[],'idle lane publishes every owner page');
  }finally{await gateway.close();await rm(root,{recursive:true,force:true});}
});
