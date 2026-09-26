import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {projectDirectory,loadProjectCatalog} from '../packages/runtime-api/src/project-catalog';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import ExcelJS from 'exceljs';

function xer(id:string,count:number){
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+id+'\t2031-04-01','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tEight hour calendar\tMon-Fri 08:00-16:00','%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt'];
  for(let i=0;i<count;i++)lines.push(['%R',i,1,1,'A'+i,id+' work '+i,'TK_NotStart','2031-04-01','2031-06-01',8,8,i%7].join('\t'));
  return [...lines,'%E'].join('\n');
}
async function listen(gateway:Awaited<ReturnType<typeof createProjectGateway>>){await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;}

test('two real uploads leave another project, health, portfolio and upload progress responsive; both survive restart', {timeout:120000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-concurrent-'));let gateway=await createProjectGateway(root);let base=await listen(gateway);
  const json=async(path:string,init?:RequestInit)=>{const response=await fetch(base+path,init);assert.ok(response.ok,await response.clone().text());return response.json() as Promise<any>;};
  try{
    for(const id of ['UPLOAD-A','UPLOAD-B','WORK-C'])await json('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:id})});
    await json('/api/projects/WORK-C/overview');
    let pending=2;
    const uploads=['UPLOAD-A','UPLOAD-B'].map(id=>json('/api/projects/'+id+'/evidence/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':id+'_baseline.xer','x-evidence-category':'schedule','x-schedule-role':'baseline','x-upload-id':id},body:xer(id,30000)}).finally(()=>{pending--;}));
    const samples:Array<{path:string,ms:number,uploadsPending:number}>=[];
    for(let round=0;pending>0&&round<150;round++){for(const path of ['/health','/api/portfolio','/api/projects/WORK-C/overview']){
      const start=performance.now();const inFlight=pending;const result=await json(path);samples.push({path,ms:performance.now()-start,uploadsPending:inFlight});
      if(path.endsWith('/overview'))assert.equal(result.projectId,'WORK-C');
      if(path==='/api/portfolio'&&pending){for(const id of ['UPLOAD-A','UPLOAD-B']){const p=result.projects.find((p:any)=>p.projectId===id);assert.equal(p.forecastCompletionIso,null);assert.notEqual(p.positionState,'current');}}
    }
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.ok(samples.some(s=>s.uploadsPending===2),'reads must overlap both uploads');
    assert.ok(samples.every(s=>s.ms<2500),'a different project must not wait for either upload: '+JSON.stringify(samples));
    await Promise.all(uploads);
    pending=2;
    const reruns=['UPLOAD-A','UPLOAD-B'].map(id=>json('/api/projects/'+id+'/evidence/rerun',{method:'POST'}).finally(()=>{pending--;}));
    for(const id of ['UPLOAD-A','UPLOAD-B']){
      const start=performance.now();
      const docs=await json('/api/projects/'+id+'/evidence/documents',{headers:{'x-cmeng-async-view':'1'}});
      assert.equal(docs.documentCount,1,'saved documents must remain available during their own project recalculation');
      assert.ok(performance.now()-start<2500,'document register must not wait behind project calculation');
      const position=await fetch(base+'/api/projects/'+id+'/overview',{headers:{'x-cmeng-async-view':'1'}});
      assert.equal(position.status,202);const waiting=await position.json() as any;
      assert.equal(waiting.state,'updating');assert.equal(waiting.documentCount,1);
    }
    for(let round=0;pending>0&&round<150;round++){
      for(const path of ['/health','/api/projects/WORK-C/overview']){const start=performance.now(),inFlight=pending;await json(path);samples.push({path:'during recalculation '+path,ms:performance.now()-start,uploadsPending:inFlight});}
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    await Promise.all(reruns);
    assert.ok(samples.every(s=>s.ms<2500),'recalculation must also leave other projects responsive: '+JSON.stringify(samples));
    for(const id of ['UPLOAD-A','UPLOAD-B']){
      const p=await json('/api/projects/'+id+'/evidence/upload-progress/'+id);assert.equal(p.state,'complete');assert.equal(p.projectId,id);
      const docs=await json('/api/projects/'+id+'/evidence/documents');assert.equal(docs.documentCount,1);assert.ok(docs.documents.every((d:any)=>d.sourceFilename.startsWith(id)));
    }
    console.log('CONCURRENT_UPLOAD_READ_TIMINGS '+JSON.stringify(samples));
    await gateway.close();gateway=await createProjectGateway(root);base=await listen(gateway);
    for(const id of ['UPLOAD-A','UPLOAD-B']){
      const docs=await json('/api/projects/'+id+'/evidence/documents');assert.equal(docs.documentCount,1);
      const snapshot=JSON.parse(await readFile(join(projectDirectory(root,id),'cmeng-project-state.json'),'utf8'));
      assert.equal(snapshot.projects.length,1);assert.equal(snapshot.projects[0].projectId,id);assert.equal(snapshot.projects[0].schedules[0].revision.model.activities.length,30000);
    }
  }finally{await gateway.close();await rm(root,{recursive:true,force:true});}
});

test('legacy migration preserves complete states and leaves the original snapshot intact; stale metadata is unresolved',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-catalog-'));
  try{
    const store=new RuntimeProjectStore({dataDir:root,durable:false});
    for(const id of ['LEGACY-A','LEGACY-B']){const state=store.getOrCreate(id);state.controls.contractValue={currency:'SAR',amount:1234} as any;store.touch(state);}
    const original=await readFile(join(root,'cmeng-project-state.json'),'utf8');const parsed=JSON.parse(original);
    const catalog=await loadProjectCatalog(root);assert.equal(catalog.size,2);
    for(const state of parsed.projects){const copy=JSON.parse(await readFile(join(projectDirectory(root,state.projectId),'cmeng-project-state.json'),'utf8'));assert.deepEqual(copy.projects,[state]);}
    assert.equal(await readFile(join(root,'cmeng-project-state.json'),'utf8'),original);
    const file=join(projectDirectory(root,'LEGACY-A'),'cmeng-project-state.json');await writeFile(file,(await readFile(file,'utf8'))+' ');
    const restored=await loadProjectCatalog(root);assert.equal(restored.get('LEGACY-A')?.metadata,null);assert.equal(restored.get('LEGACY-A')?.summaryRelease,null);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('BOQ ingestion status remains retrievable after project worker eviction and restart',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmeng-boq-worker-'));let gateway=await createProjectGateway(root,{maxWorkers:3});let base=await listen(gateway);
  try{
    const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('BOQ');sheet.addRow(['Item','Description','Unit','Qty','Rate','Amount','Currency']);sheet.addRow(['1','Excavation','m3',100,20,2000,'AED']);
    const response=await fetch(base+'/api/projects/BOQ-OWNER/boq/uploads',{method:'POST',headers:{'x-source-filename':'original-boq.xlsx','content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},body:new Uint8Array(await workbook.xlsx.writeBuffer())});
    assert.equal(response.status,201);const created=await response.json() as any;
    const path='/api/projects/BOQ-OWNER/boq/uploads/'+created.ingestionId+'?includeItems=true';
    const original=await (await fetch(base+path)).json();
    for(const projectId of ['OTHER-1','OTHER-2','OTHER-3'])assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId})})).status,201);
    const evicted=await fetch(base+path);assert.equal(evicted.status,200);assert.deepEqual(await evicted.json(),original);
    await gateway.close();gateway=await createProjectGateway(root);base=await listen(gateway);
    const restored=await fetch(base+path);assert.equal(restored.status,200);assert.deepEqual(await restored.json(),original);
  }finally{await gateway.close();await rm(root,{recursive:true,force:true});}
});
