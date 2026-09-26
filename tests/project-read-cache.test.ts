import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProjectReadCache,cacheableProjectRead} from '../packages/runtime-api/src/project-read-cache';
import {projectWorkerCapacity} from '../packages/runtime-api/src/project-worker-capacity';

test('saved analyses require the same project, release, source version and read route',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'saved-analysis-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const a=new ProjectReadCache(join(dir,'a')),b=new ProjectReadCache(join(dir,'b'));
 const route='/api/projects/A/overview',body=Buffer.from('{"projectId":"A","value":null}');
 await a.put('release1',5,route,body);
 assert.deepEqual(await a.get('release1',5,route),body);
 for(const [release,version,path] of [['release2',5,route],['release1',6,route],['release1',5,route+'?new=true']] as const)assert.equal(await a.get(release,version,path),null);
 assert.equal(await b.get('release1',5,route),null);
 assert.deepEqual(await new ProjectReadCache(join(dir,'a')).get('release1',5,route),body);
 await a.invalidate();assert.equal(await a.get('release1',5,route),null);
 for(const method of ['POST','PATCH','DELETE','HEAD'])assert.equal(cacheableProjectRead(method,route),false);
 assert.equal(cacheableProjectRead('GET',route),true);
 assert.equal(cacheableProjectRead('GET','/api/projects/A/evidence/documents'),false);
 assert.equal(cacheableProjectRead('GET','/api/projects/A/overview?refresh=1'),false);
});

test('project workers respect available CPU capacity and an explicit smaller limit',()=>{
 assert.equal(projectWorkerCapacity(undefined,2),2);
 assert.equal(projectWorkerCapacity(4,2),2);
 assert.equal(projectWorkerCapacity(1,24),1);
 assert.equal(projectWorkerCapacity(undefined,24),4);
 assert.equal(projectWorkerCapacity(8,24),8);
 assert.equal(projectWorkerCapacity(NaN,1),1);
});
