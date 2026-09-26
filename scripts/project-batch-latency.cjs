// Replay already ingested source states in a new temporary gateway. Never run
// against production storage directly; provide an offline snapshot directory.
// CMENG_BENCHMARK_DATA_DIR=/offline/snapshot node scripts/project-batch-latency.cjs
// Optional CMENG_BENCHMARK_PROJECT_IDS=id1,id2, CMENG_BENCHMARK_MODE=concurrent,
// CMENG_BENCHMARK_OUTPUT=/tmp/results.json. Upload/OCR time is excluded.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createProjectGateway}=require('../dist/packages/runtime-api/src/project-gateway');
const {projectDirectory}=require('../dist/packages/runtime-api/src/project-catalog');
const source=process.env.CMENG_BENCHMARK_DATA_DIR;
if(!source)throw new Error('Provide CMENG_BENCHMARK_DATA_DIR: an offline project snapshot directory.');
(async()=>{
 const sourceCatalog=JSON.parse(await fs.readFile(path.join(source,'project-catalog.json'),'utf8'));
 const selected=process.env.CMENG_BENCHMARK_PROJECT_IDS?.split(',');
 const ids=sourceCatalog.projectIds.filter(id=>!selected||selected.includes(id));
 if(!ids.length)throw new Error('No matching projects.');
 const mode=process.env.CMENG_BENCHMARK_MODE==='concurrent'?'concurrent':'sequential';
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'cmeng-batch-replay-'));
 let gateway,base,stop=false,probe;
 const rows=[],health=[];
 const result={scope:'Offline first-analysis replay; original upload time excluded. Worker startup may refresh document readers. OCR configuration is recorded explicitly. Sequential and concurrent groups are separate; no samples removed.',mode,availableCpus:os.availableParallelism(),ocrEnabled:process.env.CMENG_OCR_ENABLED?.trim()!=='0',configuredWorkers:process.env.CMENG_PROJECT_WORKERS??'default',release:process.env.GIT_COMMIT_SHA??'local',projects:ids,rows,health};
 try{
  for(const id of ids){
   const dir=projectDirectory(root,id);await fs.mkdir(dir,{recursive:true});
   await fs.copyFile(path.join(projectDirectory(source,id),'cmeng-project-state.json'),path.join(dir,'cmeng-project-state.json'));
  }
  await fs.writeFile(path.join(root,'project-catalog.json'),JSON.stringify({schemaVersion:1,projectIds:ids}));
  gateway=await createProjectGateway(root);
  await new Promise(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+gateway.server.address().port;
  probe=(async()=>{while(!stop){
   const start=performance.now();let status,error=null;
   try{status=(await fetch(base+'/health',{signal:AbortSignal.timeout(30000)})).status;}catch(e){error=String(e);}
   health.push({ms:performance.now()-start,status:status??null,error});await new Promise(resolve=>setTimeout(resolve,100));
  }})();
  const read=async(id,phase)=>{
   const start=performance.now();let status=null,body={},error=null;
   try{const response=await fetch(base+'/api/projects/'+encodeURIComponent(id)+'/overview',{signal:AbortSignal.timeout(600000)});status=response.status;body=await response.json();}catch(e){error=String(e);}
   const row={projectId:id,phase,ms:performance.now()-start,status,returnedProjectId:body.projectId??null,error:error??body.error??null};rows.push(row);console.log(JSON.stringify(row));
  };
  if(mode==='concurrent')await Promise.all(ids.map(id=>read(id,'first analysis')));
  else for(const id of ids)await read(id,'first analysis');
  for(const id of ids)await read(id,'repeat after project group');
 }finally{
  stop=true;if(probe)await probe;if(gateway)await gateway.close();
  await fs.writeFile(process.env.CMENG_BENCHMARK_OUTPUT??'/tmp/cmeng-project-batch-latency.json',JSON.stringify(result,null,2));
  await fs.rm(root,{recursive:true,force:true});
 }
 if(rows.some(r=>r.status!==200||r.returnedProjectId!==r.projectId))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
