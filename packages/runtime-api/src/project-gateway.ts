import {retainedAuditSessionKey} from './audit-session-key';
import {ApplicationAccess,applicationPolicyFromEnvironment,type ApplicationAccessPolicy,type ApplicationPrincipal} from './application-access';
import {configuredUploadLimit} from './request-body';
import {createServer,request,type IncomingMessage,type ServerResponse} from 'node:http';
import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import {mkdir,statfs} from 'node:fs/promises';
import {cmengUatHtml} from './ui';
import {scheduleModuleSummary,commercialModuleSummary,moduleRegistry} from './registry';
import {normalizeProjectCode} from './project-identity';
import {loadProjectCatalog,projectDirectory,atomicJson,release,type CatalogEntry} from './project-catalog';
import {projectWorkerCapacity} from './project-worker-capacity';
import {ProjectReadCache,clearDerivedReadCaches,cacheableProjectRead,MAX_PROJECT_READ_BYTES} from './project-read-cache';
import {sendHttpBody,forwardHttpBody} from './http-response';
import {randomBytes,createHmac} from 'node:crypto';
import {ExternalAccess,filePolicy} from '../../external-intelligence/src/access';
import {ExternalIntelligenceService} from '../../external-intelligence/src/service';
import {ExternalHttp} from '../../external-intelligence/src/http';
import {externalAuthorityMetadata} from '../../external-intelligence/src/authority-metadata';
import {ExternalError,type ExternalBackend,type ExternalPolicy} from '../../external-intelligence/src/types';

type Lane={worker:Worker;ready:Promise<number>;tail:Promise<void>;pending:number;lastUsed:number};
const send=(res:ServerResponse,status:number,body:unknown)=>{if(!res.destroyed&&!res.writableEnded){if(res.headersSent){res.destroy();return;}sendHttpBody(res,status,{'content-type':'application/json','cache-control':'no-store'},JSON.stringify(body));}};
export async function createProjectGateway(root:string,options:{maxWorkers?:number;appPolicy?:()=>ApplicationAccessPolicy|null}={}){
  await clearDerivedReadCaches(root,release());
  const storage=await statfs(root).catch(()=>null);if(storage)console.info(JSON.stringify({event:'derived_cache_reset',availableBytes:storage.bavail*storage.bsize}));
  const catalog=await loadProjectCatalog(root),lanes=new Map<string,Lane>(),progress=new Map<string,any>();
  const documentRegisters=new Map<string,{version:number;documents:Record<string,any>}>();
  const auditSecret=await retainedAuditSessionKey(root);
  const externalWorkerKey=randomBytes(32).toString('hex');
  const askSettingsPath=process.env.CMENG_ASK_AI_CONFIG_FILE??join(root,'ask-ai-provider.json');
  let externalHttp:ExternalHttp|undefined;
  const externalPolicy=():ExternalPolicy|null=>process.env.CMENG_EXTERNAL_POLICY_JSON?JSON.parse(process.env.CMENG_EXTERNAL_POLICY_JSON):filePolicy(process.env.CMENG_EXTERNAL_POLICY_FILE)();
  function externalController(){
    if(externalHttp)return externalHttp;
    const access=new ExternalAccess(join(root,'external-ai'),externalPolicy);
    const invoke=async(projectId:string,request:Record<string,unknown>)=>{
      if(!catalog.has(projectId))throw new ExternalError(404,'project_not_found','The authorized project is not available.');
      return work(projectId,async port=>{
        const response=await fetch('http://127.0.0.1:'+port+'/internal/external-intelligence',{method:'POST',headers:{'content-type':'application/json','x-cmeng-external-worker-key':externalWorkerKey},body:JSON.stringify({...request,projectId}),signal:AbortSignal.timeout(120000)});
        const body=await response.json() as any;if(!response.ok)throw new ExternalError(response.status,body.error??'analysis_unavailable',body.message??'The project analysis could not be completed.');return body;
      });
    };
    const backend:ExternalBackend={catalogue:externalAuthorityMetadata,state:(projectId,authorityIds)=>invoke(projectId,{action:'state',authorityIds}),analyse:(projectId,user,plan)=>invoke(projectId,{action:'analyse',user,plan}),retrieve:(projectId,user,session,operation,query,limit)=>invoke(projectId,{action:'retrieve',user,session,operation,query,limit})};
    externalHttp=new ExternalHttp(access,new ExternalIntelligenceService(access,backend),askSettingsPath);return externalHttp;
  }
  const applicationPolicy=options.appPolicy??applicationPolicyFromEnvironment;
  const applicationAccess=new ApplicationAccess(applicationPolicy,req=>externalController().access.identity(req),()=>externalPolicy()?.publicOrigin??null);
  const accessMode=()=>{try{return applicationPolicy()?'protected':'public_review';}catch{return 'unavailable';}};
  const actorHeaders=new WeakMap<IncomingMessage,Record<string,string>>();
  const configured=options.maxWorkers??Number(process.env.CMENG_PROJECT_WORKERS??6);
  const html=cmengUatHtml(),maxWorkers=projectWorkerCapacity(configured);
  const reads=(id:string)=>new ProjectReadCache(projectDirectory(root,id));
  let closing=false,catalogWrites=Promise.resolve();
  let lastForegroundProjectRequestAt=0;
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
      const env:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:directory,CMENG_TEST_MODE:'0',NODE_TEST_CONTEXT:'',CMENG_PROJECT_WORKER:'1',CMENG_PROFILE_PERF:'1',CMENG_AUDIT_SECRET:auditSecret,CMENG_EXTERNAL_WORKER_KEY:externalWorkerKey,CMENG_ASK_AI_CONFIG_FILE:askSettingsPath};
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
  // Background cache fills must NEVER keep summaryJobs open or hold one project
  // lane across every management page. That blocks foreground project navigation.
  let warmPageTail:Promise<void>=Promise.resolve();
  const scheduledWarmups=new Set<string>();
  async function warmProjectPages(id:string,version:number){
    const prefix='/api/projects/'+encodeURIComponent(id);
    const routes=[...new Set([
      prefix+'/overview',
      prefix+'/management/master-dashboard',
      prefix+'/director-position',
      prefix+'/management-surfaces',
      prefix+'/actions',
      prefix+'/evidence/documents',
      prefix+'/phases',
      prefix+'/boq/page-review',
      prefix+'/boq/numeric-review',
      ...moduleRegistry.map(page=>page.area==='management'?
        prefix+'/management/'+page.key:
        prefix+'/'+page.area+'/modules/'+page.key),
    ])];
    for(const route of routes){
      if(closing||(updating.get(id)??0)>0||catalog.get(id)?.metadata?.version!==version)return;
      // A foreground user always gets the next per-project worker turn.
      // Never keep a single worker turn during the entire cache warm-up.
      while(!closing&&Date.now()-lastForegroundProjectRequestAt<15000){
        await new Promise<void>(resolve=>setTimeout(resolve,1000));
        if((updating.get(id)??0)>0||catalog.get(id)?.metadata?.version!==version)return;
      }
      if(closing)return;
      if(await reads(id).get(release(),version,route))continue;
      try{
        await work(id,async port=>{
          if(closing||(updating.get(id)??0)>0||catalog.get(id)?.metadata?.version!==version||
            Date.now()-lastForegroundProjectRequestAt<15000)return;
          const page=await fetch('http://127.0.0.1:'+port+route,{signal:AbortSignal.timeout(20000)});
          if(!page.ok)return;
          const bytes=Buffer.from(await page.arrayBuffer());
          const responseVersion=Number(page.headers.get('x-cmeng-project-version'));
          if(responseVersion===version&&catalog.get(id)?.metadata?.version===version&&
            !(updating.get(id)??0)&&bytes.length<=MAX_PROJECT_READ_BYTES)
            await reads(id).put(release(),version,route,bytes);
        });
      }catch{/* Background warming never blocks an interactive request. */}
    }
  }
  function schedulePageWarmup(id:string,version:number){
    const key=id+'::'+version;
    if(scheduledWarmups.has(key))return;
    scheduledWarmups.add(key);
    // Bounded to one background project at a time, regardless of portfolio size.
    const task=warmPageTail.catch(()=>{}).then(()=>warmProjectPages(id,version))
      .catch(error=>console.warn('[project-warmup] '+id+': '+String(error)))
      .finally(()=>scheduledWarmups.delete(key));
    warmPageTail=task;
  }
  async function refreshSummary(id:string){
    if(closing)return;
    if(summaryJobs.has(id))return summaryJobs.get(id);
    const existing=catalog.get(id);
    if(existing?.summaryRelease===release()&&existing.summary?.version===existing.metadata?.version)return;
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
      // Publish the source-versioned portfolio first. Every control page is warmed
      // separately and only while there is no foreground navigation.
      schedulePageWarmup(id,summary.version);
    }).catch(error=>{const entry=catalog.get(id);if(entry){entry.summaryRelease=null;summaryFailures.set(id,entry.metadata?.version);}
      console.error('[refreshSummary] project='+id+' version='+entry?.metadata?.version+' failed:',error instanceof Error?error.stack??error.message:String(error));
    }).finally(()=>summaryJobs.delete(id));
    summaryJobs.set(id,task);return task;
  }
  function portfolioEntry(entry:CatalogEntry){
    const busy=(updating.get(entry.projectId)??0)>0;
    const sameVersion=entry.summary?.version===entry.metadata?.version;
    if(!busy&&entry.summaryRelease===release()&&sameVersion)return entry.summary;
    if(!busy&&sameVersion&&entry.summary){
      // Keep the last same-project-version position visible while this software
      // release rechecks it. A release cache miss is a verification state, not a
      // change in the project's management position.
      return {...entry.summary,analysisState:'stale',
        analysisError:'Showing the saved project position while CMeng rechecks this release. Project records are not being changed.'};
    }
    return {...entry.metadata,evidenceDocumentCount:busy?null:entry.metadata?.evidenceDocumentCount??null,revisionCount:busy?null:entry.metadata?.revisionCount??null,projectId:entry.projectId,
      positionState:busy?'updating':'checking',analysisState:busy?'processing':'unresolved',
      analysisError:busy?'Documents are being processed. The project position will update when finished.':'The project position has not yet been calculated for this release. Saved project metadata remains visible.',
      forecastCompletionIso:null,officialCompletionIso:null,furtherAdjustedCompletionIso:null,programmeMovementDays:null,
      approvedEotDays:null,claimCount:null,fullyLinkedClaimCount:null,managementActionCount:null,commercialCurrencyCount:null,
      readyModules:null,partialModules:null,blockedModules:null,managementActions:[]};
  }
  async function proxy(id:string,req:IncomingMessage,res:ServerResponse,path=req.url??'/'){
    // Paid CMeng Intelligence is fail-closed at the public gateway. Provider
    // credentials may come from the managed settings file or deployment
    // environment, but neither may be spent by an anonymous/browser-forged
    // request. Deterministic Ask remains available when this header is 0.
    let allowPaidModel='0';
    try{if(externalController().access.identity(req).externalAdmin)allowPaidModel='1';}catch{}

    const mutation=req.method!=='GET'&&req.method!=='HEAD'&&!/\/intelligence(?:\/|$)/.test(path);
    if(mutation){updating.set(id,(updating.get(id)??0)+1);const e=catalog.get(id);if(e)e.summaryRelease=null;await reads(id).invalidate();}
    const uploadId=String(req.headers['x-upload-id']??'');
    const encodedUploadFilename=String(req.headers['x-source-filename-encoded']??'');
    let progressFilename=String(req.headers['x-source-filename']??'project package');
    if(encodedUploadFilename){try{progressFilename=decodeURIComponent(encodedUploadFilename);}catch{progressFilename='project package';}}
    if(uploadId)progress.set(id+'::'+uploadId,{projectId:id,uploadId,state:'receiving',percent:0,filename:progressFilename,message:'Waiting to receive project documents',receivedBytes:0,totalBytes:null,documentTotal:null,processedDocuments:0,identifiedDocuments:0});
    let succeeded=false;
    try{
      await work(id,port=>new Promise<void>((resolve,reject)=>{
        if(req.aborted){reject(new Error('UPLOAD_CONNECTION_CLOSED'));return;}
        const upstream=request({host:'127.0.0.1',port,path,method:req.method,headers:{...req.headers,...actorHeaders.get(req),host:'127.0.0.1:'+port,'accept-encoding':'identity','x-cmeng-paid-ai':allowPaidModel}},incoming=>{
          succeeded=(incoming.statusCode??500)<400;
          const version=Number(incoming.headers['x-cmeng-project-version']);
          const retain=cacheableProjectRead(req.method,path)&&incoming.statusCode===200&&Number.isInteger(version)&&version>=0;
          let bytes=0;const chunks:Buffer[]=[];
          if(retain)incoming.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes<=MAX_PROJECT_READ_BYTES)chunks.push(Buffer.from(chunk));else chunks.length=0;});
          incoming.on('error',reject);incoming.on('aborted',()=>reject(new Error('PROJECT_RESPONSE_INTERRUPTED')));
          incoming.on('end',()=>{
            if(uploadId){
              const key=id+'::'+uploadId,prior=progress.get(key);
              if(prior?.state!=='complete'&&prior?.state!=='failed')progress.set(key,{...prior,state:succeeded?'complete':'failed',percent:succeeded?100:prior?.percent??0,message:succeeded?'File processed · check Documents for the reading result':'The upload could not finish. Check the document register before retrying.',updatedAt:new Date().toISOString()});
            }
            if(retain&&bytes<=MAX_PROJECT_READ_BYTES)void reads(id).put(release(),version,path,Buffer.concat(chunks)).then(resolve,resolve);
            else resolve();
          });forwardHttpBody(res,incoming);
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
    delete req.headers['x-cmeng-verified-actor'];delete req.headers['x-cmeng-verified-actor-signature'];
    const url=new URL(req.url??'/','http://localhost');
    if(url.pathname.startsWith('/internal/')){send(res,404,{error:'not_found'});return;}
    if(url.pathname.startsWith('/external-ai')||url.pathname.startsWith('/.well-known/oauth-')||url.pathname==='/settings/ask-ai'){await externalController().handle(req,res);return;}
    if(/^Bearer\s+cmeng_(ext|refresh)_/i.test(String(req.headers.authorization??''))){send(res,403,{error:'external_route_required',message:'External AI credentials may only call the external read-only gateway.'});return;}
    if(req.method==='GET'&&url.pathname==='/health'){send(res,200,{status:'ok',service:'cmeng',release:release(),scheduleModules:scheduleModuleSummary(),commercialModules:commercialModuleSummary(),boqIngestion:{persistence:process.env.RAILWAY_VOLUME_MOUNT_PATH?'railway_volume':'runtime_local',authority:'candidate_only'},uploadLimits:{maxFileBytes:configuredUploadLimit()},projectWorkers:lanes.size,applicationAccess:{mode:accessMode()}});return;}
    if(req.method==='GET'&&url.pathname==='/'){sendHttpBody(res,200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'},html);return;}
    const principal:ApplicationPrincipal|null=applicationAccess.authenticate(req);
    if(principal){const actor=Buffer.from(JSON.stringify({id:principal.id})).toString('base64url');actorHeaders.set(req,{'x-cmeng-verified-actor':actor,'x-cmeng-verified-actor-signature':createHmac('sha256',externalWorkerKey).update(actor).digest('hex')});}
    if(req.method==='GET'&&(url.pathname==='/api/portfolio'||url.pathname==='/api/test-projects')){
      const testList=url.pathname==='/api/test-projects';
      const isTest=(e:CatalogEntry)=>e.metadata?.testProject===true||
        /^(?:PERSISTENCE-SMOKE-|DIAGNOSIS-|SYN-|RELEASE-SCALE|UPLOAD-20000|BLIND-|TEST-PROJECT-|CONSULTANT-TEST-)/i.test(e.projectId);
      const visible=[...catalog.values()].filter(e=>applicationAccess.visible(principal,e.projectId)&&!e.metadata?.demo&&isTest(e)===testList);
      send(res,200,{portfolioId:'default',generatedAt:new Date().toISOString(),projectCount:visible.length,projects:visible.map(portfolioEntry)});
      return;
    }
    if(req.method==='GET'&&url.pathname==='/api/background-work'){
      send(res,200,{projects:[...updating].filter(([id,n])=>n>0&&applicationAccess.visible(principal,id)).map(([projectId])=>({projectId,state:'processing'})),uploads:[...progress.values()].filter(p=>applicationAccess.visible(principal,p.projectId))});return;
    }
    if(req.method==='POST'&&url.pathname==='/api/projects'){
      applicationAccess.administrator(principal);
      let body='';for await(const chunk of req){body+=chunk;if(body.length>8192){send(res,413,{error:'request_too_large'});return;}}
      const requested=JSON.parse(body) as {projectId?:string;testProject?:boolean};
      if(requested.testProject!==undefined&&typeof requested.testProject!=='boolean'){send(res,400,{error:'test_project_boolean_required'});return;}
      let id=normalizeProjectCode(requested.projectId??'');if(!id){send(res,400,{error:'project_id_required',message:'Enter a project code.'});return;}
      const existing=[...catalog.keys()].find(key=>normalizeProjectCode(key)===id);
      if(existing&&catalog.get(existing)?.metadata){send(res,409,{error:'project_code_already_exists',projectId:existing,message:'Project code '+existing+' already exists. Open the existing project instead.'});return;}
      if(existing)id=existing;
      await register(id);
      const result=await work(id,async port=>{const response=await fetch('http://127.0.0.1:'+port+'/api/projects',{method:'POST',headers:{'content-type':'application/json',cookie:req.headers.cookie??'','x-forwarded-proto':String(req.headers['x-forwarded-proto']??'http'),...actorHeaders.get(req)},body:JSON.stringify({projectId:id,testProject:requested.testProject===true})});const cookie=response.headers.get('set-cookie');if(cookie)res.setHeader('set-cookie',cookie);return {status:response.status,body:await response.json()};});send(res,result.status,result.body);return;
    }
    const match=/^\/api\/projects\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if(match){
      const supplied=decodeURIComponent(match[1]!);const id=catalog.has(supplied)?supplied:[...catalog.keys()].find(key=>normalizeProjectCode(key)===normalizeProjectCode(supplied))??normalizeProjectCode(supplied);
      if(!id){send(res,400,{error:'project_id_required'});return;}
      applicationAccess.project(principal,id,req.method==='POST'&&match[2]==='/intelligence/ask'?'GET':req.method);
      if(req.method==='POST'&&match[2]==='/purpose')applicationAccess.administrator(principal);
      const progressMatch=/^\/evidence\/upload-progress\/([^/]+)$/.exec(match[2]??'');
      if(req.method==='GET'&&progressMatch){const p=progress.get(id+'::'+decodeURIComponent(progressMatch[1]!));send(res,p?200:404,p??{error:'upload_progress_not_found'});return;}
      if(!catalog.has(id)){if(req.method==='GET'||(match[2]??'').startsWith('/intelligence')){send(res,404,{error:'project_not_found'});return;}applicationAccess.administrator(principal);await register(id);}
      // A browser request takes priority over background project warm-up.
      // Retained analyses of unchanged versions stay available from the volume.
      lastForegroundProjectRequestAt=Date.now();
      const projectPath='/api/projects/'+encodeURIComponent(id)+(match[2]??'')+url.search;
      const version=catalog.get(id)?.metadata?.version;
      if(cacheableProjectRead(req.method,projectPath)&&version!==undefined&&!(updating.get(id)??0)){
        const cached=await reads(id).get(release(),version,projectPath);
        if(cached&&catalog.get(id)?.metadata?.version===version&&!(updating.get(id)??0)){
          sendHttpBody(res,200,{'content-type':'application/json','cache-control':'no-store','x-cmeng-project-version':String(version)},cached);return;
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
        if(match[2]==='/overview'&&!entry.metadata?.demo&&((updating.get(id)??0)>0||summaryJobs.has(id)||entry.summaryRelease!==release()||entry.summary?.version!==entry.metadata?.version)){
          const recentFailure=!updating.get(id)&&!summaryJobs.has(id)&&summaryFailures.has(id)&&summaryFailures.get(id)===entry.metadata?.version&&Date.now()-(summaryAttempts.get(id)??0)<60000;
          if(!recentFailure){
            if(!(updating.get(id)??0)&&!summaryJobs.has(id))void refreshSummary(id);
            const saved=documentRegisters.get(id);
            send(res,202,{projectId:id,state:'updating',documentCount:saved?.version===entry.metadata?.version?saved?.documents.documentCount??null:null,releaseCommitSha:release(),message:(updating.get(id)??0)>0?'Processing documents and updating the project position':'Calculating the project position and checking the results'});return;
          }
          // Cached-summary path has failed recently. Do not hard-error a valid saved
          // project; fall through to the live worker and compute /overview directly.
        }
      }
      await proxy(id,req,res,'/api/projects/'+encodeURIComponent(id)+(match[2]??'')+url.search);return;
    }
    if(url.pathname.startsWith('/api/')){if(!(req.method==='GET'&&/^\/api\/(?:schedule|commercial|delivery)\/modules$/.test(url.pathname)))applicationAccess.administrator(principal);await mkdir(projectDirectory(root,'_SYSTEM'),{recursive:true});await proxy('_SYSTEM',req,res);return;}
    send(res,404,{error:'not_found'});
  })().catch(error=>send(res,error.statusCode??400,{error:error.code??'request_failed',message:error instanceof Error?error.message:String(error)}));});
  server.requestTimeout=0;
  // One low-priority summary at a time; leave capacity for interactive projects and uploads.
  let warming=false;
  const warmer=setInterval(()=>{
    for(const [key,value] of progress)if(value.updatedAt&&Date.now()-Date.parse(value.updatedAt)>6*60*60*1000)progress.delete(key);
    if(closing||warming)return;
    // On a shared six-project dashboard, calculations must already be retained
    // on the volume. Warm all projects over time, even when worker slots are
    // occupied, but never evict a busy worker or disturb an active user's
    // recent read. A 15-minute idle rule previously left 18 of 22 projects
    // cold after the initial four, causing a repeat 10-35 second first open.
    if(Date.now()-lastForegroundProjectRequestAt<15000)return;
    const idleLane=[...lanes.values()].some(l=>l.pending===0&&Date.now()-l.lastUsed>8000);
    const entry=[...catalog.values()].find(e=>!e.metadata?.demo&&e.summaryRelease!==release()&&!updating.get(e.projectId)&&Date.now()-(summaryAttempts.get(e.projectId)??0)>60000&&
      (lanes.has(e.projectId)||lanes.size<maxWorkers||idleLane));
    if(entry){warming=true;void refreshSummary(entry.projectId).finally(()=>{warming=false;});}
  },2000);warmer.unref();
  const close=async()=>{closing=true;clearInterval(warmer);signal();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await Promise.allSettled([...summaryJobs.values()]);await Promise.all([...lanes.values()].map(l=>l.worker.terminate()));await catalogWrites;};
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
