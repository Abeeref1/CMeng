import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';

// Each project worker loads the same program modules before reading its
// project. The worker keeps their compiled bytecode in a compile cache that
// contains program code only. Project results are never part of it.
async function files(directory:string):Promise<string[]>{
  const out:string[]=[];
  for(const entry of await readdir(directory,{withFileTypes:true}).catch(()=>[])){
    const path=join(directory,entry.name);
    if(entry.isDirectory())out.push(...await files(path));else out.push(path);
  }
  return out;
}
test('project workers reuse a program-only compile cache across worker starts',{timeout:120000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-worker-compile-'));
  const cache=await mkdtemp(join(tmpdir(),'cmeng-worker-compile-cache-'));
  const previous=process.env.CMENG_WORKER_COMPILE_CACHE_DIR;process.env.CMENG_WORKER_COMPILE_CACHE_DIR=cache;
  const gateway=await createProjectGateway(root,{maxWorkers:1});
  await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
  try{
    const create=async(id:string)=>{const r=await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:id})});assert.equal(r.status,201);};
    await create('COMPILE-A');
    const firstOverview=await (await fetch(base+'/api/projects/COMPILE-A/overview')).json() as any;
    let written:string[]=[];
    for(const deadline=Date.now()+20000;!written.length&&Date.now()<deadline;await new Promise(resolve=>setTimeout(resolve,100)))written=await files(cache);
    assert.ok(written.length>0,'first worker writes compiled program modules');
    // Only compiled program files: the cache never holds project directories or data.
    assert.ok(written.every(path=>!path.includes('COMPILE-A')),'no project data in the compile cache');
    // A second worker (COMPILE-B evicts COMPILE-A) starts with the cache present
    // and the first project remains readable with its own identity.
    await create('COMPILE-B');
    const again=await (await fetch(base+'/api/projects/COMPILE-A/overview')).json() as any;
    assert.equal(again.projectId,'COMPILE-A');assert.equal(firstOverview.projectId,'COMPILE-A');
  }finally{
    await gateway.close();
    if(previous===undefined)delete process.env.CMENG_WORKER_COMPILE_CACHE_DIR;else process.env.CMENG_WORKER_COMPILE_CACHE_DIR=previous;
    await rm(root,{recursive:true,force:true});await rm(cache,{recursive:true,force:true});
  }
});
