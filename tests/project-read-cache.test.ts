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
 assert.equal(cacheableProjectRead('GET','/api/projects/A/evidence/documents'),true);
 assert.equal(cacheableProjectRead('GET','/api/projects/A/management/command-center?view=page'),true);
 assert.equal(cacheableProjectRead('GET','/api/projects/A/overview?refresh=1'),false);
});

test('cache retains a compressible finished management result larger than old two-megabyte threshold',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'large-result-read-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const cache=new ProjectReadCache(dir);
 const route='/api/projects/P/management/command-center';
 const bytes=Buffer.from(JSON.stringify({projectId:'P',populationTotal:58000,rows:Array.from({length:90000},(_,i)=>'ITEM-'+(i%100))}));
 assert.ok(bytes.length>2*1024*1024,'fixture must exceed the old raw response cap');
 assert.ok(bytes.length<8*1024*1024,'fixture must remain within bounded raw cache limit');
 await cache.put('release-a',7,route,bytes);
 assert.deepEqual(await cache.get('release-a',7,route),bytes);
 assert.equal(await cache.get('release-b',7,route),null,'new release cannot use an old calculation');
});

test('project workers respect available CPU capacity and an explicit smaller limit',()=>{
 assert.equal(projectWorkerCapacity(undefined,2),2);
 assert.equal(projectWorkerCapacity(4,2),2);
 assert.equal(projectWorkerCapacity(1,24),1);
 assert.equal(projectWorkerCapacity(undefined,24),6);
 assert.equal(projectWorkerCapacity(8,24),8);
 assert.equal(projectWorkerCapacity(NaN,1),1);
});

test('derived read storage is bounded and release cleanup preserves source and saved results',async t=>{
 const {mkdir,writeFile,readFile,readdir}=await import('node:fs/promises');
 const {clearDerivedReadCaches}=await import('../packages/runtime-api/src/project-read-cache');
 const root=await mkdtemp(join(tmpdir(),'bounded-reads-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,'projects','a'.repeat(64)),cache=new ProjectReadCache(directory,12);
 await cache.put('r',1,'one',Buffer.from('12345678'));await cache.put('r',1,'two',Buffer.from('87654321'));
 assert.equal((await readdir(join(directory,'.analysis-reads'))).filter(name=>name.endsWith('.json')).length,1);
 assert.equal(await cache.get('r',1,'one'),null);assert.equal((await cache.get('r',1,'two'))?.toString(),'87654321');
 await writeFile(join(directory,'cmeng-project-state.json'),'source-state');await mkdir(join(directory,'ask-ai'));await writeFile(join(directory,'ask-ai','saved.json'),'saved-analysis');
 await clearDerivedReadCaches(root,'r');assert.equal((await cache.get('r',1,'two'))?.toString(),'87654321','same-release restart preserves valid derived reads');
 await clearDerivedReadCaches(root,'next-release');assert.equal((await cache.get('r',1,'two'))?.toString(),'87654321','rollback-safe exact-release cache remains available');
 assert.equal(await cache.get('next-release',1,'two'),null,'a new release never sees previous-release data');
 assert.equal(await readFile(join(directory,'cmeng-project-state.json'),'utf8'),'source-state');assert.equal(await readFile(join(directory,'ask-ai','saved.json'),'utf8'),'saved-analysis');
});
