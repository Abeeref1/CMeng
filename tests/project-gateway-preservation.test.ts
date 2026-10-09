import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import type {AddressInfo} from 'node:net';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectDirectory} from '../packages/runtime-api/src/project-catalog';
import {projectResultMap} from '../packages/runtime-api/src/project-api-results';

test('worker gateway preserves all module, management, source and audit results for identical retained project data',{timeout:120000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-preserve-')),original=join(root,'original'),isolated=join(root,'isolated');
  await mkdir(isolated);
  const store=new RuntimeProjectStore({dataDir:original,durable:false});
  const state=loadCertifiedDemoProject('PRESERVE');state.demo=false;store.replace(state);
  const snapshot=await readFile(join(original,'cmeng-project-state.json'),'utf8');
  // Startup hydration creates a new audit event in each process. Compare its
  // contents, while preserving every identity already present in the snapshot.
  const comparable=(input:unknown)=>JSON.parse(JSON.stringify(input,(key,value)=>{
    if(typeof value!=='string'||snapshot.includes(value))return value;
    if((key==='eventId'||key==='requestId')&&/^[0-9a-f-]{36}$/.test(value))return '<new-audit-id>';
    if(key==='sourceRef'&&/^audit-request:[0-9a-f-]{36}$/.test(value))return 'audit-request:<new-audit-id>';
    return value;
  }));
  await writeFile(join(isolated,'cmeng-project-state.json'),snapshot);
  // Report hashes incorporate generation time. Hold the same clock in both
  // servers so hashes, receipts and all dates can be compared without exclusions.
  const clock=join(root,'clock.cjs'),oldOptions=process.env.NODE_OPTIONS;
  await writeFile(clock,"const RealDate=Date;global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2031-04-01T00:00:00.000Z']))}static now(){return 1932768000000}};");
  process.env.NODE_OPTIONS=(oldOptions??'')+' --require='+clock;
  const script=`(async()=>{const {runtimeProjects}=require(${JSON.stringify(join(__dirname,'../packages/runtime-api/src/project-state.js'))});for(const method of ['refreshScheduleControlBasisAssertions','refreshSpreadsheetRegisters','refreshHseReports','refreshCorrespondenceNarratives','refreshDeferredPdfReads'])await runtimeProjects[method]();const server=require(${JSON.stringify(join(__dirname,'../packages/runtime-api/src/server.js'))}).createCmengServer();server.listen(0,'127.0.0.1',()=>console.log('PORT='+server.address().port));})().catch(e=>{console.error(e);process.exit(1)});`;
  const originalEnv:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:original,CMENG_TEST_MODE:'0',NODE_TEST_CONTEXT:'',CMENG_PROJECT_WORKER:''};delete originalEnv.RAILWAY_VOLUME_MOUNT_PATH;
  const child=spawn(process.execPath,['-e',script],{env:originalEnv,stdio:['ignore','pipe','pipe']});
  const gateway=await createProjectGateway(isolated);
  try{
    const base=await new Promise<string>((resolve,reject)=>{let logs='';const timer=setTimeout(()=>reject(new Error('Original server startup timeout: '+logs)),30000);child.stdout.on('data',d=>{logs+=d;const port=/PORT=(\d+)/.exec(logs)?.[1];if(port){clearTimeout(timer);resolve('http://127.0.0.1:'+port);}});child.stderr.on('data',d=>{logs+=d;});child.once('exit',()=>{clearTimeout(timer);reject(new Error(logs));});});
    await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
    const worker='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
    const paths=['/overview','/phases','/evidence/documents','/schedule/revisions','/director-position','/board-report','/board-report/history?includeReport=true','/management-surfaces',...moduleRegistry.map(m=>m.area==='management'?'/management/'+m.key:'/'+m.area+'/modules/'+m.key),'/schedule/modules/quantity-scurve/report.json'];
    for(const path of paths){
      const replies=await Promise.all([base,worker].map(async url=>{const response=await fetch(url+'/api/projects/PRESERVE'+path);return {status:response.status,body:await response.json()};}));
      assert.ok(replies[0]!.status===200||path.startsWith('/delivery/')&&replies[0]!.status===409,path+' must return the actual project position, including Delivery blocked without governed records');
      assert.deepEqual(comparable(replies[1]),comparable(replies[0]),path+' must retain exact values, states, dates and retained source identities');
    }
    const before=JSON.parse(await readFile(join(original,'cmeng-project-state.json'),'utf8')).projects[0];
    const after=JSON.parse(await readFile(join(projectDirectory(isolated,'PRESERVE'),'cmeng-project-state.json'),'utf8')).projects[0];
    assert.deepEqual(comparable(after),comparable(before),'complete retained state, controls, evidence and audit history must be unchanged');
  }finally{child.kill();await gateway.close();if(oldOptions===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=oldOptions;await rm(root,{recursive:true,force:true});}
});

test('explicit result records remain exact after their worker-local map is recreated',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-results-'));
  try{const expected={projectId:'P',state:'unresolved',amount:null,history:[{source:'receipt-1',at:'2031-04-01'}]};projectResultMap('director-results',root).set('P',expected);assert.deepEqual(projectResultMap('director-results',root).get('P'),expected);}
  finally{await rm(root,{recursive:true,force:true});}
});

test('explicit Live/Test classification persists, survives restart and partitions portfolio without losing project sources',{timeout:120000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-test-projects-'));
  const gateway=await createProjectGateway(root,{maxWorkers:2});
  try{
    await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;
    const post=async(path:string,body:unknown)=>{
      const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      return {status:response.status,data:await response.json()};
    };
    const live=await post('/api/projects',{projectId:'LIVE-F59',testProject:false});
    const testRecord=await post('/api/projects',{projectId:'TEST-F59',testProject:true});
    assert.equal(live.status,201,JSON.stringify(live));
    assert.equal(testRecord.status,201,JSON.stringify(testRecord));
    const qaFixture=await post('/api/projects',{projectId:'QA-F59',testProject:false});
    assert.equal(qaFixture.status,201,JSON.stringify(qaFixture));
    const getProjects=async(path:string)=>{const response=await fetch(base+path);assert.equal(response.status,200,path);return response.json() as Promise<{projects:Array<{projectId:string;testProject?:boolean}>}>;};
    let p=await getProjects('/api/portfolio'),tests=await getProjects('/api/test-projects');
    assert.ok(p.projects.some(r=>r.projectId==='LIVE-F59'));assert.ok(!p.projects.some(r=>r.projectId==='TEST-F59'));
    assert.ok(tests.projects.some(r=>r.projectId==='TEST-F59'));assert.ok(!tests.projects.some(r=>r.projectId==='LIVE-F59'));
    assert.ok(tests.projects.some(r=>r.projectId==='QA-F59'),'QA namespace fixture belongs to test projects');
    assert.ok(!p.projects.some(r=>r.projectId==='QA-F59'),'QA namespace must not inflate live client totals');
    const moved=await post('/api/projects/TEST-F59/purpose',{testProject:false});assert.equal(moved.status,200,JSON.stringify(moved));
    p=await getProjects('/api/portfolio');tests=await getProjects('/api/test-projects');
    assert.ok(p.projects.some(r=>r.projectId==='TEST-F59'));assert.ok(!tests.projects.some(r=>r.projectId==='TEST-F59'));
    const data=JSON.parse(await readFile(join(projectDirectory(root,'TEST-F59'),'cmeng-project-state.json'),'utf8'));
    assert.equal(data.projects[0].testProject,false);
    const marked=await post('/api/projects/TEST-F59/purpose',{testProject:true});assert.equal(marked.status,200,JSON.stringify(marked));
    const restored=JSON.parse(await readFile(join(projectDirectory(root,'TEST-F59'),'cmeng-project-state.json'),'utf8'));
    assert.equal(restored.projects[0].testProject,true,'type is durable and cannot be reset by a dashboard restart');
    assert.equal(restored.projects[0].projectId,'TEST-F59','project identity and source position are retained');
    const duplicate=await post('/api/projects',{projectId:'LIVE-F59',testProject:true});
    assert.equal(duplicate.status,409,'existing real project must not be silently relabelled');
  }finally{await gateway.close();await rm(root,{recursive:true,force:true});}
});
