import {randomBytes} from 'node:crypto';
import {createServer,request,type IncomingMessage,type ServerResponse} from 'node:http';
import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {cmengUatHtml} from './ui';
import {scheduleModuleSummary,commercialModuleSummary} from './registry';
import {normalizeProjectCode} from './project-identity';
import {loadProjectCatalog,projectDirectory,atomicJson,release,type CatalogEntry} from './project-catalog';
import {projectWorkerCapacity} from './project-worker-capacity';
import {ProjectReadCache,cacheableProjectRead,MAX_PROJECT_READ_BYTES} from './project-read-cache';

type Lane={worker:Worker;ready:Promise<number>;tail:Promise<void>;pending:number;lastUsed:number};
const send=(res:ServerResponse,status:number,body:unknown)=>{if(!res.destroyed&&!res.writableEnded){if(res.headersSent){res.destroy();return;}res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));}};
export async function createProjectGateway(root:string,options:{maxWorkers?:number}={}){
  const catalog=await loadProjectCatalog(root),lanes=new Map<string,Lane>(),progress=new Map<string,any>();
  const documentRegisters=new Map<string,{version:number;documents:Record<string,any>}>();
  const auditSecret=process.env.CMENG_AUDIT_SECRET??randomBytes(32).toString('hex');
  const configured=options.maxWorkers??Number(process.env.CMENG_PROJECT_WORKERS??4);
  const html=cmengUatHtml(),maxWorkers=projectWorkerCapacity(configured);
  const reads=(id:string)=>new ProjectReadCache(projectDirectory(root,id));
  let closing=false,catalogWrites=Promise.resolve();
  const reservations=new Map<string,Promise<Lane>>();
  const waiters=new Set<()=>void>();
  const signal=()=>{for(const wake of waiters)wake();waiters.clear();};
  const saveCatalog=()=>{catalogWrites=catalogWrites.then(()=>atomicJson(join(root,'project-catalog.json'),{schemaVersion:1,projectIds:[...catalog.keys()]}));return catalogWrites;};
  async function register(id:string){
    if(catalog.has(id))return;
    await mkdir(projectDirectory(root,id),{recursive:true});
    if(catalog.has(id))return;
    catalog.set(id,{projectId:id,metadata:null,summary:null,summaryRelease:null});await saveCatalog();
  }
  async function acquire(id:string):Promise<Lane>{
    if(closing)throw new Error('SERVICE_RESTARTING');
    const existing=lanes.get(id);if(existing){existing.pending++;return existing;}
    const reserved=reservations.get(id);if(reserved)return reserved.then(lane=>{lane.pending++;return lane;});
    const allocation=(async()=>{
      while(lanes.size>=maxWorkers){
        const idle=[...lanes].filter(([,lane])=>lane.pending===0).sort((a,b)=>a[1].lastUsed-b[1].lastUsed)[0];
        if(idle){lanes.delete(idle[0]);void idle[1].worker.terminate();break;}
        await new Promise<void>(resolve=>{waiters.add(resolve);setTimeout(()=>{waiters.delete(resolve);resolve();},1000).unref();});
        if(closing)throw new Error('SERVICE_RESTARTING');
      }
      const directory=projectDirectory(root,id);
      const env:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:directory,CMENG_TEST_MODE:'0',NODE_TEST_CONTEXT:'',CMENG_PROJECT_WORKER:'1',CMENG_PROFILE_PERF:'1',CMENG_AUDIT_SECRET:auditSecret};
      if(env.RAILWAY_VOLUME_MOUNT_PATH)env.RAILWAY_VOLUME_MOUNT_PATH=directory;
      const worker=new Worker(join(__dirname,'project-http-worker.js'),{workerData:{projectId:id,directory},env});
      const lane:Lane={worker,ready:Promise.resolve(0),tail:Promise.resolve(),pending:1,lastUsed:Date.now()};
      lane.ready=new Promise<number>((resolve,reject)=>{
        const timer=setTimeout(()=>{reject(new Error('PROJECT_START_TIMEOUT'));void worker.terminate();},120000);timer.unref();
        worker.on('message',message=>{
          if(message.type==='initializing')timer.refresh();
          if(message.type==='ready'){clearTimeout(timer);resolve(message.port);}
          if(message.type==='progress')progress.set(id+'::'+message.progress.uploadId,message.progress);
          if(message.type==='documents')documentRegisters.set(id,{version:message.version,documents:message.documents});
          if(message.type==='metadata'){
            const entry=catalog.get(id);if(entry){entry.metadata=message.metadata;if(entry.summary?.version!==entry.metadata?.version)entry.summaryRelease=null;}
          }
        });
        worker.once('error',error=>{clearTimeout(timer);reject(error);});
        worker.once('exit',code=>{clearTimeout(timer);reject(new Error('PROJECT_PROCESS_STOPPED_'+code));if(lanes.get(id)===lane)lanes.delete(id);signal();});
      });
      // Attach a rejection handler immediately; queued requests still receive the original failure.
      void lane.ready.catch(()=>{});lanes.set(id,lane);return lane;
    })();
    reservations.set(id,allocation);
    try{return await allocation;}finally{reservations.delete(id);}
  }
  async function work<T>(id:string,action:(port:number)=>Promise<T>):Promise<T>{
    const lane=await acquire(id);
    const result=lane.tail.then(()=>lane.ready).then(action);
    lane.tail=result.then(()=>{},()=>{});
    try{return await result;}finally{lane.pending--;lane.lastUsed=Date.now();signal();}
  }
  const updating=new Map<string,number>(),summaryJobs=new Map<string,Promise<void>>(),summaryAttempts=new Map<string,number>();
  const summaryFailures=new Map<string,number|undefined>();
  async function refreshSummary(id:string){
    if(closing)return;
    if(summaryJobs.has(id))return summaryJobs.get(id);
    summaryAttempts.set(id,Date.now());
    const task=work(id,async port=>{
      const response=await fetch('http://127.0.0.1:'+port+'/api/portfolio');
      if(!response.ok)throw new Error('PROJECT_SUMMARY_UNAVAILABLE');
      const body=await response.json() as {projects:Record<string,any>[]};const summary=body.projects.find(p=>p.projectId===id);
      const entry=catalog.get(id);if(!entry||!summary)return;
      if(entry.metadata&&entry.metadata.version!==summary.version)return;
      entry.summary=summary;entry.summaryRelease=release();
      summaryFailures.delete(id);
      await atomicJson(join(projectDirectory(root,id),'portfolio.json'),{release:release(),summary});
    }).catch(()=>{const entry=catalog.get(id);if(entry){entry.summaryRelease=null;summaryFailures.set(id,entry.metadata?.version);}}).finally(()=>summaryJobs.delete(id));
    summaryJobs.set(id,task);return task;
  }
  function portfolioEntry(entry:CatalogEntry){
    const busy=(updating.get(entry.projectId)??0)>0;
    if(!busy&&entry.summaryRelease===release()&&entry.summary?.version===entry.metadata?.version)return entry.summary;
    return {...entry.metadata,evidenceDocumentCount:busy?null:entry.metadata?.evidenceDocumentCount??null,revisionCount:busy?null:entry.metadata?.revisionCount??null,projectId:entry.projectId,positionState:'updating',analysisState:'unresolved',
      analysisError:busy?'Documents are being processed. The project position will update when finished.':'The project position is being checked. You can open this project or work in another.',
      forecastCompletionIso:null,officialCompletionIso:null,furtherAdjustedCompletionIso:null,programmeMovementDays:null,
      approvedEotDays:null,claimCount:null,fullyLinkedClaimCount:null,managementActionCount:null,commercialCurrencyCount:null,
      readyModules:null,partialModules:null,blockedModules:null,managementActions:[]};
  }
  async function proxy(id:string,req:IncomingMessage,res:ServerResponse,path=req.url??'/'){
    const mutation=req.method!=='GET'&&req.method!=='HEAD';
    if(mutation){updating.set(id,(updating.get(id)??0)+1);const e=catalog.get(id);if(e)e.summaryRelease=null;await reads(id).invalidate();}
    const uploadId=String(req.headers['x-upload-id']??'');
    if(uploadId)progress.set(id+'::'+uploadId,{projectId:id,uploadId,state:'receiving',percent:0,filename:req.headers['x-source-filename']??'project package',message:'Waiting to receive project documents',receivedBytes:0,totalBytes:null,documentTotal:null,processedDocuments:0,identifiedDocuments:0});
    let succeeded=false;
    try{
      await work(id,port=>new Promise<void>((resolve,reject)=>{
        if(req.aborted){reject(new Error('UPLOAD_CONNECTION_CLOSED'));return;}
        const upstream=request({host:'127.0.0.1',port,path,method:req.method,headers:{...req.headers,host:'127.0.0.1:'+port}},incoming=>{
          succeeded=(incoming.statusCode??500)<400;
          const version=Number(incoming.headers['x-cmeng-project-version']);
          const retain=cacheableProjectRead(req.method,path)&&incoming.statusCode===200&&Number.isInteger(version)&&version>=0;
          let bytes=0;const chunks:Buffer[]=[];
          if(retain)incoming.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes<=MAX_PROJECT_READ_BYTES)chunks.push(Buffer.from(chunk));else chunks.length=0;});
          if(!res.destroyed)res.writeHead(incoming.statusCode??502,incoming.headers);
          incoming.on('error',reject);incoming.on('aborted',()=>reject(new Error('PROJECT_RESPONSE_INTERRUPTED')));
          incoming.on('end',()=>{
            if(retain&&bytes<=MAX_PROJECT_READ_BYTES)void reads(id).put(release(),version,path,Buffer.concat(chunks)).then(resolve,resolve);
            else resolve();
          });if(res.destroyed)incoming.resume();else incoming.pipe(res);
        });
        upstream.on('error',reject);req.once('aborted',()=>upstream.destroy(new Error('UPLOAD_CONNECTION_CLOSED')));
        req.pipe(upstream);
      }));
    }catch(error){
      if(uploadId){const prior=progress.get(id+'::'+uploadId);progress.set(id+'::'+uploadId,{...prior,state:'failed',message:'The upload could not finish. Check the document register before retrying.'});}
      send(res,503,{error:'project_work_unavailable',message:'This project could not finish its request. Other projects remain available.'});
    }finally{
      if(mutation)updating.set(id,Math.max(0,(updating.get(id)??1)-1));
      if(succeeded&&/\/(overview|management\/[^/]+|evidence\/rerun|modules\/[^/]+)$/.test(path))void refreshSummary(id);
    }
  }
  const server=createServer((req,res)=>{void (async()=>{
    const url=new URL(req.url??'/','http://localhost');
    if(req.method==='GET'&&url.pathname==='/health'){send(res,200,{status:'ok',service:'cmeng',release:release(),scheduleModules:scheduleModuleSummary(),commercialModules:commercialModuleSummary(),boqIngestion:{persistence:process.env.RAILWAY_VOLUME_MOUNT_PATH?'railway_volume':'runtime_local',authority:'candidate_only'},projectWorkers:lanes.size});return;}
    if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return;}
    if(req.method==='GET'&&url.pathname==='/api/portfolio'){
      const visible=[...catalog.values()].filter(e=>!e.metadata?.demo&&!e.projectId.toUpperCase().startsWith('PERSISTENCE-SMOKE-'));
      send(res,200,{portfolioId:'default',generatedAt:new Date().toISOString(),projectCount:visible.length,projects:visible.map(portfolioEntry)});
      return;
    }
    if(req.method==='GET'&&url.pathname==='/api/background-work'){
      send(res,200,{projects:[...updating].filter(([,n])=>n>0).map(([projectId])=>({projectId,state:'processing'})),uploads:[...progress.values()]});return;
    }
    if(req.method==='POST'&&url.pathname==='/api/projects'){
      let body='';for await(const chunk of req){body+=chunk;if(body.length>8192){send(res,413,{error:'request_too_large'});return;}}
      let id=normalizeProjectCode(JSON.parse(body).projectId??'');if(!id){send(res,400,{error:'project_id_required',message:'Enter a project code.'});return;}
      const existing=[...catalog.keys()].find(key=>normalizeProjectCode(key)===id);
      if(existing&&catalog.get(existing)?.metadata){send(res,409,{error:'project_code_already_exists',projectId:existing,message:'Project code '+existing+' already exists. Open the existing project instead.'});return;}
      if(existing)id=existing;
      await register(id);
      const result=await work(id,async port=>{const response=await fetch('http://127.0.0.1:'+port+'/api/projects',{method:'POST',headers:{'content-type':'application/json',cookie:req.headers.cookie??'','x-forwarded-proto':String(req.headers['x-forwarded-proto']??'http')},body:JSON.stringify({projectId:id})});const cookie=response.headers.get('set-cookie');if(cookie)res.setHeader('set-cookie',cookie);return {status:response.status,body:await response.json()};});send(res,result.status,result.body);return;
    }
    const match=/^\/api\/projects\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if(match){
      const supplied=decodeURIComponent(match[1]!);const id=catalog.has(supplied)?supplied:[...catalog.keys()].find(key=>normalizeProjectCode(key)===normalizeProjectCode(supplied))??normalizeProjectCode(supplied);
      if(!id){send(res,400,{error:'project_id_required'});return;}
      const progressMatch=/^\/evidence\/upload-progress\/([^/]+)$/.exec(match[2]??'');
      if(req.method==='GET'&&progressMatch){const p=progress.get(id+'::'+decodeURIComponent(progressMatch[1]!));send(res,p?200:404,p??{error:'upload_progress_not_found'});return;}
      if(!catalog.has(id)){if(req.method==='GET'){send(res,404,{error:'project_not_found'});return;}await register(id);}
      const projectPath='/api/projects/'+encodeURIComponent(id)+(match[2]??'')+url.search;
      const version=catalog.get(id)?.metadata?.version;
      if(cacheableProjectRead(req.method,projectPath)&&version!==undefined&&!(updating.get(id)??0)){
        const cached=await reads(id).get(release(),version,projectPath);
        if(cached&&catalog.get(id)?.metadata?.version===version&&!(updating.get(id)??0)){
          res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','x-cmeng-project-version':String(version)});res.end(cached);return;
        }
      }
      if(req.method==='GET'&&req.headers['x-cmeng-async-view']==='1'){
        const entry=catalog.get(id)!;
        if(match[2]==='/evidence/documents'){
          const saved=documentRegisters.get(id);
          if(saved&&saved.version===entry.metadata?.version){send(res,200,saved.documents);return;}
          if((updating.get(id)??0)>0||summaryJobs.has(id)){
            send(res,202,{projectId:id,processing:true,documentCount:null,documents:[],message:'Updating the document register. The saved files will appear here as soon as processing finishes.'});return;
          }
        }
        if(match[2]==='/overview'&&((updating.get(id)??0)>0||summaryJobs.has(id)||entry.summaryRelease!==release()||entry.summary?.version!==entry.metadata?.version)){
          if(!updating.get(id)&&!summaryJobs.has(id)&&summaryFailures.has(id)&&summaryFailures.get(id)===entry.metadata?.version&&Date.now()-(summaryAttempts.get(id)??0)<60000){send(res,503,{error:'project_calculation_failed',message:'The project calculation could not finish. Your saved documents remain available. Try updating the project position again.'});return;}
          if(!(updating.get(id)??0)&&!summaryJobs.has(id))void refreshSummary(id);
          const saved=documentRegisters.get(id);
          send(res,202,{projectId:id,state:'updating',documentCount:saved?.version===entry.metadata?.version?saved?.documents.documentCount??null:null,releaseCommitSha:release(),message:(updating.get(id)??0)>0?'Processing documents and updating the project position':'Calculating the project position and checking the results'});return;
        }
      }
      await proxy(id,req,res,'/api/projects/'+encodeURIComponent(id)+(match[2]??'')+url.search);return;
    }
    if(url.pathname.startsWith('/api/')){await mkdir(projectDirectory(root,'_SYSTEM'),{recursive:true});await proxy('_SYSTEM',req,res);return;}
    send(res,404,{error:'not_found'});
  })().catch(error=>send(res,400,{error:'request_failed',message:error instanceof Error?error.message:String(error)}));});
  server.requestTimeout=0;
  // One low-priority summary at a time; leave capacity for interactive projects and uploads.
  let warming=false;
  const warmer=setInterval(()=>{
    for(const [key,value] of progress)if(value.updatedAt&&Date.now()-Date.parse(value.updatedAt)>6*60*60*1000)progress.delete(key);
    if(closing||warming)return;
    // Background portfolio work must not evict a recently used project's expensive
    // calculation cache. Foreground project requests still use normal LRU capacity.
    const entry=[...catalog.values()].find(e=>!e.metadata?.demo&&e.summaryRelease!==release()&&!updating.get(e.projectId)&&Date.now()-(summaryAttempts.get(e.projectId)??0)>60000&&
      (lanes.has(e.projectId)||lanes.size<maxWorkers||[...lanes.values()].some(l=>l.pending===0&&Date.now()-l.lastUsed>15*60*1000)));
    if(entry){warming=true;void refreshSummary(entry.projectId).finally(()=>{warming=false;});}
  },2000);warmer.unref();
  const close=async()=>{closing=true;clearInterval(warmer);signal();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await Promise.all([...lanes.values()].map(l=>l.worker.terminate()));await catalogWrites;};
  return {server,close,catalog};
}

if(require.main===module){
  const root=process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim()||process.env.CMENG_DATA_DIR?.trim()||join(process.cwd(),'.cmeng-runtime');
  void createProjectGateway(root).then(gateway=>{
    const port=Number(process.env.PORT??3000),host=process.env.HOST??'0.0.0.0';
    gateway.server.listen(port,host,()=>console.log('CMeng runtime listening on '+host+':'+port));
    process.once('SIGTERM',()=>{void gateway.close().then(()=>process.exit(0));});
  }).catch(error=>{console.error('CMENG_STARTUP_FAILED',error);process.exitCode=1;});
}
