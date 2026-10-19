import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {createCmengServer} from '../packages/runtime-api/src/server';

// F60: a project with no sources at all opens every page with HTTP 200 and an
// explained empty state, never HTTP 409. Report downloads of a blocked module
// keep their explicit 409; they are downloads, not page loads.
test('F60 empty project: every page route answers 200 with an explained empty state',async t=>{
 const id='F60-EMPTY-'+randomUUID();runtimeProjects.touch(runtimeProjects.getOrCreate(id));
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const root='http://127.0.0.1:'+(server.address() as any).port;
 const get=async(path:string)=>{const response=await fetch(root+path);const text=await response.text();let body:any=null;try{body=JSON.parse(text);}catch{body=null;}return {status:response.status,body};};
 const keysOf=(value:any)=>(Array.isArray(value)?value:(value?.modules??value?.data??[])).map((row:any)=>row.key??row.moduleKey).filter(Boolean) as string[];
 const scheduleKeys=keysOf((await get('/api/schedule/modules')).body),commercialKeys=keysOf((await get('/api/commercial/modules')).body);
 assert.ok(scheduleKeys.length>10&&commercialKeys.length>3,'module catalogues are listed');
 const P='/api/projects/'+encodeURIComponent(id);
 const pages=[P+'/overview',P+'/director-position',P+'/actions',P+'/management-surfaces',
  ...['master-dashboard','command-center','master-control-programme','source-quality','cross-domain-accountability'].map(key=>P+'/management/'+key),
  ...scheduleKeys.map(key=>P+'/schedule/modules/'+encodeURIComponent(key)),
  ...commercialKeys.map(key=>P+'/commercial/modules/'+encodeURIComponent(key))];
 const failures:string[]=[],unexplained:string[]=[];
 for(const path of pages){
  const response=await get(path);
  if(response.status!==200){failures.push(path+' -> '+response.status+' '+JSON.stringify(response.body).slice(0,200));continue;}
  const body=response.body;
  // A module page whose module cannot be calculated must say why.
  if(body&&typeof body==='object'&&typeof body.status==='string'&&!['available','ready','partial'].includes(body.status)){
   const reason=body.reason??body.emptyState??body.data?.emptyState??body.page?.emptyState;
   if(!(typeof reason==='string'&&reason.trim().length>0))unexplained.push(path+' status '+body.status);
  }
 }
 console.log('F60 checked '+pages.length+' page routes on an empty project');
 assert.deepEqual(failures,[],'every page loads with HTTP 200');
 assert.deepEqual(unexplained,[],'every empty module explains its empty state');
});
