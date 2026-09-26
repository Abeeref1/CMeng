import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtempSync,writeFileSync,unlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {projectDirectory} from '../packages/runtime-api/src/project-catalog';

test('gateway returns save failures honestly, preserves other projects, and acknowledges only a restart-safe retry',{timeout:60000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-gateway-fault-')),flag=join(root,'fail-write'),preload=join(root,'fault.cjs');let child:ChildProcess|undefined;
 writeFileSync(preload,`const fs=require('node:fs'),{workerData}=require('node:worker_threads');if(workerData?.projectId==='SAVE-FAULT'){const write=fs.writeSync;fs.writeSync=function(...args){if(fs.existsSync(${JSON.stringify(flag)})&&Buffer.from(args[1]).subarray(0,1).toString()==='{')throw Object.assign(new Error('Synthetic full disk'),{code:'ENOSPC'});return write.apply(fs,args);};}`);
 const start=async()=>{
  const env:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:root,CMENG_TEST_MODE:'0',NODE_TEST_CONTEXT:'',CMENG_PROJECT_WORKER:'',CMENG_OCR_ENABLED:'0',NODE_OPTIONS:'--require='+preload};delete env.RAILWAY_VOLUME_MOUNT_PATH;
  const script=`require(${JSON.stringify(join(__dirname,'../packages/runtime-api/src/project-gateway.js'))}).createProjectGateway(process.env.CMENG_DATA_DIR,{maxWorkers:2}).then(g=>g.server.listen(0,'127.0.0.1',()=>console.log('PORT='+g.server.address().port)));`;
  child=spawn(process.execPath,['-e',script],{env,stdio:['ignore','pipe','pipe']});let log='';child.stderr!.on('data',d=>log+=d);
  return new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('START_TIMEOUT '+log.slice(-1000))),15000);child!.stdout!.on('data',d=>{log+=d;const port=/PORT=(\d+)/.exec(log)?.[1];if(port){clearTimeout(timer);resolve('http://127.0.0.1:'+port);}});child!.once('exit',code=>{clearTimeout(timer);reject(new Error('START_EXIT '+code+' '+log.slice(-1000)));});});
 };
 const stop=async()=>{if(!child||child.exitCode!==null)return;const done=new Promise<void>(r=>child!.once('exit',()=>r()));child.kill();await done;};
 let base=await start();
 const api=async(path:string,init?:RequestInit)=>{const r=await fetch(base+path,init);return {status:r.status,body:await r.json() as any};};
 try{
  for(const projectId of ['SAVE-FAULT','OTHER'])assert.equal((await api('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId})})).status,201);
  const body=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tdata_date','%R\t1\tSAVE-FAULT\t2031-08-31','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\tMobilise\tTK_NotStart\t2031-08-31\t2031-09-01\t8\t8','%E'].join('\n');
  const upload=()=>api('/api/projects/SAVE-FAULT/schedule/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer'},body});
  writeFileSync(flag,'fail');
  for(let i=0;i<2;i++){const result=await upload();assert.equal(result.status,503);assert.match(result.body.error,/save could not be confirmed/);assert.equal((await api('/api/projects/SAVE-FAULT/schedule/revisions')).body.length,0);}
  assert.equal((await api('/health')).status,200);assert.equal((await api('/api/projects/OTHER/evidence/documents')).status,200);
  unlinkSync(flag);const success=await upload();assert.equal(success.status,201);assert.equal((await upload()).body.revisionId,success.body.revisionId);
  await stop();base=await start();const restored=await api('/api/projects/SAVE-FAULT/schedule/revisions');assert.equal(restored.status,200);assert.equal(restored.body.length,1);assert.equal(restored.body[0].revisionId,success.body.revisionId);
 }finally{await stop();rmSync(root,{recursive:true,force:true});}
});
