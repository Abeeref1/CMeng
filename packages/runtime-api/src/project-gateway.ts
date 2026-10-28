import {probeConfiguredProvider,providerProbeState} from './ai-provider-probe';
import {configuredProviderState} from '../../project-ask/src/provider';
import {retainedAuditSessionKey} from './audit-session-key';
import {ApplicationAccess,applicationPolicyFromEnvironment,type ApplicationAccessPolicy,type ApplicationPrincipal} from './application-access';
import {configuredUploadLimit} from './request-body';
import {createServer,request,type IncomingMessage,type ServerResponse} from 'node:http';
import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import {mkdir,statfs,stat} from 'node:fs/promises';
import {cmengUatHtml} from './ui';
import {scheduleModuleSummary,commercialModuleSummary,moduleRegistry} from './registry';
import {normalizeProjectCode} from './project-identity';
import {loadProjectCatalog,projectDirectory,atomicJson,release,calculationRelease,type CatalogEntry} from './project-catalog';
import {projectWorkerCapacity} from './project-worker-capacity';
import {abortProjectProxyOnDisconnect} from './project-proxy-cancellation';
import {ProjectReadCache,clearDerivedReadCaches,cacheableProjectRead,MAX_PROJECT_READ_BYTES} from './project-read-cache';
import {sendHttpBody,forwardHttpBody} from './http-response';
import {randomBytes,createHmac} from 'node:crypto';
import {ExternalAccess,filePolicy} from '../../external-intelligence/src/access';
import {ExternalIntelligenceService} from '../../external-intelligence/src/service';
import {ExternalHttp} from '../../external-intelligence/src/http';
import {externalAuthorityMetadata} from '../../external-intelligence/src/authority-metadata';
import {ExternalError,type ExternalBackend,type ExternalPolicy} from '../../external-intelligence/src/types';

type Lane={worker:Worker;ready:Promise<number>;tail:Promise<void>;pending:number;lastUsed:number;unpublished?:{version:number;served:string}|undefined};
const send=(res:ServerResponse,status:number,body:unknown)=>{if(!res.destroyed&&!res.writableEnded){if(res.headersSent){res.destroy();return;}sendHttpBody(res,status,{'content-type':'application/json','cache-control':'no-store'},JSON.stringify(body));}};
export async function createProjectGateway(root:string,options:{maxWorkers?:number;appPolicy?:()=>ApplicationAccessPolicy|null;workerExecArgv?:string[];prepareRelease?:boolean;releasePreparationMs?:number}={}){
  await clearDerivedReadCaches(root,calculationRelease());
  const storage=await statfs(root).catch(()=>null);if(storage)console.info(JSON.stringify({event:'derived_cache_reset',availableBytes:storage.bavail*storage.bsize}));
  const catalog=await loadProjectCatalog(root),lanes=new Map<string,Lane>(),progress=new Map<string,any>();
  // Background warm-up order: most recently used projects first. The project
  // directory changes whenever its stored results or sources are written, so it
  // is the durable last-use signal across restarts; foreground opens update it.
  const lastUsedAt=new Map<string,number>();
  for(const id of catalog.keys())lastUsedAt.set(id,(await stat(projectDirectory(root,id)).catch(()=>null))?.mtimeMs??0);
  const recentFirst=<T extends {projectId:string}>(entries:T[])=>entries.sort((a,b)=>(lastUsedAt.get(b.projectId)??0)-(lastUsedAt.get(a.projectId)??0));
  const documentRegisters=new Map<string,{version:number;documents:Record<string,any>}>();
  const auditSecret=await retainedAuditSessionKey(root);
  const externalWorkerKey=randomBytes(32).toString('hex');
  const askSettingsPath=process.env.CMENG_ASK_AI_CONFIG_FILE??join(root,'ask-ai-provider.json');
  const aiUsageDirectory=process.env.CMENG_AI_USAGE_DIR?.trim()||join(root,'ai-usage');
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
  const explicitlyParallel=Number(process.env.CMENG_PROJECT_CONCURRENT_LANES??0);
  const html=cmengUatHtml(),maxWorkers=projectWorkerCapacity(configured,undefined,explicitlyParallel);
  const readStores=new Map<string,ProjectReadCache>();
  const pendingReadPublications=new Map<string,Promise<void>>();
  const siblingPublications=new Set<Promise<void>>();
  const reads=(id:string)=>{let cache=readStores.get(id);if(!cache)cache=new ProjectReadCache(projectDirectory(root,id));readStores.delete(id);readStores.set(id,cache);while(readStores.size>16)readStores.delete(readStores.keys().next().value!);return cache;};
  function retainCalculatedRead(id:string,port:number,version:number,path:string,body:Buffer){
    // Overview navigation waits only for the read itself and its Overview
    // snapshot; the remaining owner pages finish in the same worker turn.
    let overviewPublished!:()=>void;
    const overview=new Promise<void>(resolve=>{overviewPublished=resolve;});
    const publication=storeCalculatedRead(id,port,version,path,body,overviewPublished);
    void publication.then(overviewPublished,overviewPublished);
    pendingReadPublications.set(id,overview);siblingPublications.add(publication);
    const done=()=>{if(pendingReadPublications.get(id)===overview)pendingReadPublications.delete(id);};
    void overview.then(done,done);
    void publication.then(()=>siblingPublications.delete(publication),()=>siblingPublications.delete(publication));
    return publication;
  }
  async function storeCalculatedRead(id:string,port:number,version:number,path:string,body:Buffer,overviewPublished:()=>void=()=>{}){
    await reads(id).put(calculationRelease(),version,path,body);
    const pathname=new URL(path,'http://localhost').pathname;
    if(!/\/(?:management\/[^/]+|(?:schedule|commercial|delivery)\/modules\/[^/]+|management-surfaces|director-position)$/.test(pathname))return;
    // A source-version cache can contain a cold Overview even after specialist
    // calculations finish. Publish their lightweight current navigation snapshot
    // in the same worker turn, retaining it across worker eviction/restart.
    // This reads existing results only; Overview never starts full analysis.
    const prefix='/api/projects/'+encodeURIComponent(id);
    const overviewPath=prefix+'/overview';
    try{
      const response=await fetch('http://127.0.0.1:'+port+overviewPath,{signal:AbortSignal.timeout(5000)});
      if(response.ok&&Number(response.headers.get('x-cmeng-project-version'))===version){
        const snapshot=Buffer.from(await response.arrayBuffer());
        if(snapshot.length<=MAX_PROJECT_READ_BYTES)await reads(id).put(calculationRelease(),version,overviewPath,snapshot);
      }else await response.arrayBuffer().catch(()=>{});
    }catch(error){console.warn('[overview-snapshot] '+id+': '+String(error));}
    overviewPublished();
    // The owner pages are projections of the SAME full calculation. They are
    // published later, off the foreground critical path: when this lane is idle
    // with no project waiting for a worker, or just before the lane is evicted.
    const lane=lanes.get(id);
    if(lane)lane.unpublished={version,served:pathname};
  }
  const ownerRoutes=(id:string)=>{const prefix='/api/projects/'+encodeURIComponent(id);
    return [prefix+'/management/cross-domain-accountability',prefix+'/management/master-dashboard',prefix+'/director-position',prefix+'/management-surfaces'];};
  // A recycled worker otherwise discards the finished calculation, and the next
  // Accountability or Dashboard request repeats the entire analysis. Each page
  // is fetched for this exact version while the worker still holds the finished
  // calculation. The worker refuses (409) unless that calculation is already
  // cached, so this path never starts a new full analysis. Each page is its own
  // lane turn, so a foreground request for this project waits for one page at most.
  function publishRetainedOwnerPages(id:string,lane:Lane):Promise<void>{
    const retained=lane.unpublished;lane.unpublished=undefined;
    if(!retained)return Promise.resolve();
    const {version,served}=retained;
    lane.pending++;
    const publication=(async()=>{
      for(const route of ownerRoutes(id)){
        if(route===served)continue;
        if(closing||(updating.get(id)??0)>0||lanes.get(id)!==lane)return;
        if(await reads(id).get(calculationRelease(),version,route))continue;
        const turn=lane.tail.then(()=>lane.ready).then(async port=>{
          if(closing||(updating.get(id)??0)>0)return;
          if(await reads(id).get(calculationRelease(),version,route))return;
          try{
            const response=await fetch('http://127.0.0.1:'+port+route,{headers:{'x-cmeng-retained-calculation-only':'1'},signal:AbortSignal.timeout(20000)});
            if(!response.ok||Number(response.headers.get('x-cmeng-project-version'))!==version){await response.arrayBuffer().catch(()=>{});return;}
            const page=Buffer.from(await response.arrayBuffer());
            if(page.length<=MAX_PROJECT_READ_BYTES&&!closing&&!(updating.get(id)??0))await reads(id).put(calculationRelease(),version,route,page);
          }catch(error){console.warn('[owner-page-snapshot] '+id+': '+String(error));}
        });
        lane.tail=turn.then(()=>{},()=>{});
        await turn.catch(()=>{});
      }
    })().finally(()=>{lane.pending--;signal();});
    siblingPublications.add(publication);
    void publication.then(()=>siblingPublications.delete(publication),()=>siblingPublications.delete(publication));
    return publication;
  }
  let closing=false,catalogWrites=Promise.resolve();
  let lastForegroundProjectRequestAt=Date.now();
  let activeForegroundRequests=0;
  const reservations=new Map<string,Promise<Lane>>();
  const waiters=new Set<()=>void>();
  const signal=()=>{for(const wake of waiters)wake();waiters.clear();};
  // Projects currently waiting for a free worker. Idle owner-page publication
  // never runs while another project waits; eviction publishes first instead.
  // Projects waiting for a worker are served strictly in arrival order: only
  // the head of this queue may claim (or publish and then evict) an idle lane.
  const workerQueue:object[]=[];
  let waitingForWorker=0;
  const publishIdleLanes=()=>{
    if(closing||waitingForWorker>0)return;
    for(const [id,lane] of lanes)if(lane.pending===0&&lane.unpublished)void publishRetainedOwnerPages(id,lane);
  };
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
      let waiting=false;const ticket={};
      try{
        while(lanes.size>=maxWorkers){
          if(!waiting){waiting=true;waitingForWorker++;workerQueue.push(ticket);}
          const idle=workerQueue[0]===ticket?[...lanes].filter(([,lane])=>lane.pending===0).sort((a,b)=>a[1].lastUsed-b[1].lastUsed)[0]:undefined;
          if(idle){
            // Never discard a finished calculation: publish its owner pages
            // first, then re-check that the lane is still idle before eviction.
            if(idle[1].unpublished){await publishRetainedOwnerPages(idle[0],idle[1]);if(closing)throw new Error('SERVICE_RESTARTING');continue;}
            lanes.delete(idle[0]);void idle[1].worker.terminate();break;
          }
          await new Promise<void>(resolve=>{waiters.add(resolve);setTimeout(()=>{waiters.delete(resolve);resolve();},1000).unref();});
          if(closing)throw new Error('SERVICE_RESTARTING');
        }
      }finally{if(waiting){workerQueue.splice(workerQueue.indexOf(ticket),1);signal();waitingForWorker--;queueMicrotask(publishIdleLanes);}}
      const directory=projectDirectory(root,id);
      const env:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:directory,CMENG_TEST_MODE:'0',NODE_TEST_CONTEXT:'',CMENG_PROJECT_WORKER:'1',CMENG_PROFILE_PERF:'1',CMENG_AUDIT_SECRET:auditSecret,CMENG_EXTERNAL_WORKER_KEY:externalWorkerKey,CMENG_ASK_AI_CONFIG_FILE:askSettingsPath,CMENG_AI_USAGE_DIR:aiUsageDirectory};
      if(env.RAILWAY_VOLUME_MOUNT_PATH)env.RAILWAY_VOLUME_MOUNT_PATH=directory;
      const worker=new Worker(join(__dirname,'project-http-worker.js'),{workerData:{projectId:id,directory},env,...(options.workerExecArgv?{execArgv:[...options.workerExecArgv]}:{})});
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
    try{return await result;}finally{lane.pending--;lane.lastUsed=Date.now();signal();queueMicrotask(publishIdleLanes);}
  }
  const updating=new Map<string,number>(),summaryJobs=new Map<string,Promise<void>>(),summaryAttempts=new Map<string,number>();
  const summaryFailures=new Map<string,number|undefined>();
  // Background cache fills must NEVER keep summaryJobs open or hold one project
  // lane across every management page. That blocks foreground project navigation.
  let warmPageTail:Promise<void>=Promise.resolve();
  const releasePreparation:{state:'not_needed'|'preparing'|'complete'|'timed_out';prepared:number;pagesPrepared:number;total:number;priorityElapsedMs:number|null;elapsedMs:number|null}={state:'not_needed',prepared:0,pagesPrepared:0,total:0,priorityElapsedMs:null,elapsedMs:null};
  const scheduledWarmups=new Set<string>();
  const pendingSecondaryWarmups=new Map<string,number>();
  let secondaryWarmupActive=false;
  async function warmProjectPages(id:string,version:number,phase:'priority'|'secondary'){
    const prefix='/api/projects/'+encodeURIComponent(id);
    const priorityRoutes=[prefix+'/management/cross-domain-accountability',prefix+'/management/master-dashboard',prefix+'/overview'];
    const allRoutes=[...new Set([
      prefix+'/overview',
      prefix+'/management/master-dashboard',
      prefix+'/management/cross-domain-accountability',
      prefix+'/schedule/modules/lookahead-schedule',
      prefix+'/commercial/modules/contract-particulars-bonds',
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
    // Prepare the three owner-facing pages across the entire portfolio before
    // spending worker capacity on the complete specialist library of one project.
    const routes=phase==='priority'?priorityRoutes:allRoutes.filter(route=>!priorityRoutes.includes(route));
    for(const route of routes){
      if(closing||(updating.get(id)??0)>0||catalog.get(id)?.metadata?.version!==version)return;
      // A foreground user always gets the next per-project worker turn.
      // Never keep a single worker turn during the entire cache warm-up.
      while(!closing&&Date.now()-lastForegroundProjectRequestAt<3000){
        await new Promise<void>(resolve=>setTimeout(resolve,250));
        if((updating.get(id)??0)>0||catalog.get(id)?.metadata?.version!==version)return;
      }
      if(closing)return;
      if(await reads(id).get(calculationRelease(),version,route))continue;
      try{
        await work(id,async port=>{
          if(closing||(updating.get(id)??0)>0||catalog.get(id)?.metadata?.version!==version||
            Date.now()-lastForegroundProjectRequestAt<3000)return;
          const page=await fetch('http://127.0.0.1:'+port+route,{signal:AbortSignal.timeout(20000)});
          if(!page.ok)return;
          const bytes=Buffer.from(await page.arrayBuffer());
          const responseVersion=Number(page.headers.get('x-cmeng-project-version'));
          if(responseVersion===version&&catalog.get(id)?.metadata?.version===version&&
            !(updating.get(id)??0)&&bytes.length<=MAX_PROJECT_READ_BYTES)
            await retainCalculatedRead(id,port,version,route,bytes);
        });
      }catch{/* Background warming never blocks an interactive request. */}
    }
  }
  function schedulePageWarmup(id:string,version:number){
    const key=id+'::'+version;
    if(scheduledWarmups.has(key))return;
    scheduledWarmups.add(key);
    // Bounded to one background project at a time, regardless of portfolio size.
    const task=warmPageTail.catch(()=>{}).then(()=>warmProjectPages(id,version,'priority'))
      .catch(error=>console.warn('[project-warmup] '+id+': '+String(error)))
      .finally(()=>{scheduledWarmups.delete(key);if(!closing&&catalog.get(id)?.metadata?.version===version)pendingSecondaryWarmups.set(id,version);});
    warmPageTail=task;
  }
  function scheduleSecondaryWarmup(){
    if(closing||secondaryWarmupActive||scheduledWarmups.size||summaryJobs.size||activeSummaryWarmups)return;
    // Do not let one project monopolize all its pages while another project
    // still needs its first Accountability and Master Dashboard calculations.
    if([...catalog.values()].some(e=>!e.metadata?.demo&&e.summaryRelease!==calculationRelease()&&!summaryFailures.has(e.projectId)))return;
    const next=recentFirst([...pendingSecondaryWarmups].map(([projectId,version])=>({projectId,version})))[0];
    if(!next)return;
    const {projectId:id,version}=next;pendingSecondaryWarmups.delete(id);
    if(catalog.get(id)?.metadata?.version!==version||(updating.get(id)??0)>0)return;
    secondaryWarmupActive=true;
    void warmProjectPages(id,version,'secondary')
      .catch(error=>console.warn('[project-warmup-secondary] '+id+': '+String(error)))
      .finally(()=>{secondaryWarmupActive=false;});
  }
  async function refreshSummary(id:string){
    if(closing)return;
    if(summaryJobs.has(id))return summaryJobs.get(id);
    const existing=catalog.get(id);
    if(existing?.summaryRelease===calculationRelease()&&existing.summary?.version===existing.metadata?.version)return;
    summaryAttempts.set(id,Date.now());
    const task=work(id,async port=>{
      // Fill the small, source-versioned owner position BEFORE the wider
      // portfolio analysis. Foreground Accountability can use this result while
      // other specialist projections are still being prepared in the worker.
      const entry=catalog.get(id);if(!entry)return;
      // Never delay the portfolio position behind an optional specialist page.
      // Once the source-version summary is saved, the low-priority page
      // warmer will prepare Accountability and other modules independently.
      const response=await fetch('http://127.0.0.1:'+port+'/api/portfolio');
      if(!response.ok)throw new Error('PROJECT_SUMMARY_UNAVAILABLE');
      const body=await response.json() as {projects:Record<string,any>[]};const summary=body.projects.find(p=>p.projectId===id);
      if(!summary)return;
      if(entry.metadata&&entry.metadata.version!==summary.version)return;
      entry.summary=summary;entry.summaryRelease=calculationRelease();
      summaryFailures.delete(id);
      await atomicJson(join(projectDirectory(root,id),'portfolio.json'),{release:calculationRelease(),summary});
      // Publish the source-versioned portfolio first. Every control page is warmed
      // separately and only while there is no foreground navigation.
      schedulePageWarmup(id,summary.version);
    }).catch(error=>{const entry=catalog.get(id);if(entry){entry.summaryRelease=null;summaryFailures.set(id,entry.metadata?.version);}
      // The timed-out summary cannot be treated as ready. The idle sweep will
      // retry the same unchanged project after its existing bounded backoff;
      // it never turns a failed calculation into a fabricated zero.
      console.error('[refreshSummary] project='+id+' version='+entry?.metadata?.version+' failed:',error instanceof Error?error.stack??error.message:String(error));
    }).finally(()=>summaryJobs.delete(id));
    summaryJobs.set(id,task);return task;
  }
  function portfolioEntry(entry:CatalogEntry){
    const busy=(updating.get(entry.projectId)??0)>0;
    const sameVersion=entry.summary?.version===entry.metadata?.version;
    if(!busy&&entry.summaryRelease===calculationRelease()&&sameVersion)return entry.summary;
    const refreshFailed=summaryFailures.has(entry.projectId)&&summaryFailures.get(entry.projectId)===entry.metadata?.version&&!summaryJobs.has(entry.projectId);
    if(!busy&&sameVersion&&entry.summary){
      // A timeout must not erase the last valid source-version snapshot.
      // The old calculated values remain explicitly provisional until this
      // content-addressed calculation version finishes successfully.
      return {...entry.summary,positionState:'updating',analysisState:'updating',
        analysisError:refreshFailed
          ?'Updating: the latest refresh timed out. Previous figures are temporarily shown for reference, not as the current verified calculation. Background retry remains scheduled.'
          :'Updating management calculations. Previous figures are displayed temporarily and must not be treated as current until the update finishes.'};
    }
    return {...entry.metadata,evidenceDocumentCount:busy?null:entry.metadata?.evidenceDocumentCount??null,revisionCount:busy?null:entry.metadata?.revisionCount??null,projectId:entry.projectId,
      positionState:busy?'updating':'checking',analysisState:busy?'processing':'unresolved',
      analysisError:refreshFailed?'The latest calculation could not be completed. Previous figures are withheld until the project is recalculated.':busy?'Documents are being processed. The project position will update when finished.':'The project position has not yet been calculated for this release. Saved project metadata remains visible.',
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
      await work(id,async port=>{
        // A read queued behind an owner-page publication of the same version
        // reuses that saved result instead of repeating it in the worker.
        const version=catalog.get(id)?.metadata?.version;
        if(!mutation&&cacheableProjectRead(req.method,path)&&version!==undefined&&!(updating.get(id)??0)){
          const cached=await reads(id).get(calculationRelease(),version,path);
          if(cached&&catalog.get(id)?.metadata?.version===version&&!(updating.get(id)??0)){
            succeeded=true;sendHttpBody(res,200,{'content-type':'application/json','cache-control':'no-store','x-cmeng-project-version':String(version)},cached);return;
          }
        }
        return new Promise<void>((resolve,reject)=>{
        if(req.aborted||((req.method==='GET'||req.method==='HEAD')&&res.destroyed&&!res.writableFinished)){reject(new Error('UPLOAD_CONNECTION_CLOSED'));return;}
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
            if(retain&&bytes<=MAX_PROJECT_READ_BYTES)void retainCalculatedRead(id,port,version,path,Buffer.concat(chunks)).then(resolve,resolve);
            else resolve();
          });forwardHttpBody(res,incoming);
        });
        upstream.on('error',reject);
        // A browser leaving this page aborts the obsolete upstream HTTP turn,
        // rather than keeping a worker lane reserved for a result nobody can see.
        // Successful requests and uploads retain their normal response stream.
        // Mutating uploads and save operations must complete durably after
        // receiving their body even when the browser no longer waits for a reply.
        // Only obsolete, read-only calculations are cancelable on response close.
        if(req.method==='GET'||req.method==='HEAD')abortProjectProxyOnDisconnect(req,res,upstream);
        else req.once('aborted',()=>upstream.destroy(new Error('UPLOAD_CONNECTION_CLOSED')));
        req.pipe(upstream);
      });});
    }catch(error){
      if(uploadId){const prior=progress.get(id+'::'+uploadId);progress.set(id+'::'+uploadId,{...prior,state:'failed',message:'The upload could not finish. Check the document register before retrying.'});}
      send(res,503,{error:'project_work_unavailable',message:'This project could not finish its request. Other projects remain available.'});
    }finally{
      if(mutation)updating.set(id,Math.max(0,(updating.get(id)??1)-1));
      // A successful project read must not immediately occupy the worker for a
      // background portfolio refresh ahead of the user's next page. The idle
      // sweep maintains the portfolio without competing for foreground turns.
    }
  }
  const server=createServer((req,res)=>{void (async()=>{
    delete req.headers['x-cmeng-verified-actor'];delete req.headers['x-cmeng-verified-actor-signature'];delete req.headers['x-cmeng-retained-calculation-only'];
    const url=new URL(req.url??'/','http://localhost');
    if(url.pathname.startsWith('/internal/')){send(res,404,{error:'not_found'});return;}
    if(url.pathname.startsWith('/external-ai')||url.pathname.startsWith('/.well-known/oauth-')||url.pathname==='/settings/ask-ai'){await externalController().handle(req,res);return;}
    if(/^Bearer\s+cmeng_(ext|refresh)_/i.test(String(req.headers.authorization??''))){send(res,403,{error:'external_route_required',message:'External AI credentials may only call the external read-only gateway.'});return;}
    // T11: while a new calculation release prepares the projects saved by the
    // previous release, the deployment is not ready, so the platform keeps
    // traffic away until every first Overview and Dashboard is calculated.
    if(req.method==='GET'&&url.pathname==='/health'&&releasePreparation.state==='preparing'){send(res,503,{status:'preparing',service:'cmeng',release:release(),calculationVersion:calculationRelease(),preparedProjects:releasePreparation.prepared,allPagesProjects:releasePreparation.pagesPrepared,totalProjects:releasePreparation.total});return;}
    if(req.method==='GET'&&url.pathname==='/health'){send(res,200,{status:'ok',releasePreparation:{state:releasePreparation.state,preparedProjects:releasePreparation.prepared,allPagesProjects:releasePreparation.pagesPrepared,totalProjects:releasePreparation.total,priorityElapsedMs:releasePreparation.priorityElapsedMs,elapsedMs:releasePreparation.elapsedMs},service:'cmeng',release:release(),calculationVersion:calculationRelease(),scheduleModules:scheduleModuleSummary(),commercialModules:commercialModuleSummary(),boqIngestion:{persistence:process.env.RAILWAY_VOLUME_MOUNT_PATH?'railway_volume':'runtime_local',authority:'candidate_only'},uploadLimits:{maxFileBytes:configuredUploadLimit()},projectWorkers:lanes.size,applicationAccess:{mode:accessMode()},ai:{...configuredProviderState({...process.env,CMENG_ASK_AI_CONFIG_FILE:askSettingsPath,CMENG_AI_USAGE_DIR:aiUsageDirectory}),ownerPermissionRequired:true,automaticApproval:false,lastProviderCheck:providerProbeState(root,calculationRelease())}});return;}
    if(req.method==='GET'&&url.pathname==='/'){sendHttpBody(res,200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'},html);return;}
    const principal:ApplicationPrincipal|null=applicationAccess.authenticate(req);
    if(principal){const actor=Buffer.from(JSON.stringify({id:principal.id})).toString('base64url');actorHeaders.set(req,{'x-cmeng-verified-actor':actor,'x-cmeng-verified-actor-signature':createHmac('sha256',externalWorkerKey).update(actor).digest('hex')});}
    if(req.method==='GET'&&(url.pathname==='/api/portfolio'||url.pathname==='/api/test-projects')){
      const testList=url.pathname==='/api/test-projects';
      // Explicit test classification always applies. Reserved QA/test code namespaces
      // are also shown in the Test list, without deleting or rewriting any source.
      const isTest=(e:CatalogEntry)=>e.metadata?.testProject===true||
        /^(?:QA-|PERSISTENCE-SMOKE-|DIAGNOSIS-|SYN-|RELEASE-SCALE|UPLOAD-20000|BLIND-|TEST-PROJECT-|CONSULTANT-TEST-)/i.test(e.projectId);
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
      lastForegroundProjectRequestAt=Date.now();lastUsedAt.set(id,lastForegroundProjectRequestAt);
      const projectPath='/api/projects/'+encodeURIComponent(id)+(match[2]??'')+url.search;
      // A completed calculation may already have reached the browser while its
      // durable Overview snapshot is still being published. Never return the
      // previous same-version navigation in that short interval.
      if(req.method==='GET'&&match[2]==='/overview')await pendingReadPublications.get(id)?.catch(()=>{});
      const version=catalog.get(id)?.metadata?.version;
      if(cacheableProjectRead(req.method,projectPath)&&version!==undefined&&!(updating.get(id)??0)){
        const cached=await reads(id).get(calculationRelease(),version,projectPath);
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
        if(match[2]==='/overview'&&!entry.metadata?.demo&&((updating.get(id)??0)>0||summaryJobs.has(id)||entry.summaryRelease!==calculationRelease()||entry.summary?.version!==entry.metadata?.version)){
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
      activeForegroundRequests++;
      try{await proxy(id,req,res,'/api/projects/'+encodeURIComponent(id)+(match[2]??'')+url.search);}
      finally{activeForegroundRequests=Math.max(0,activeForegroundRequests-1);}
      return;
    }
    if(url.pathname.startsWith('/api/')){if(!(req.method==='GET'&&/^\/api\/(?:schedule|commercial|delivery)\/modules$/.test(url.pathname)))applicationAccess.administrator(principal);await mkdir(projectDirectory(root,'_SYSTEM'),{recursive:true});await proxy('_SYSTEM',req,res);return;}
    send(res,404,{error:'not_found'});
  })().catch(error=>send(res,error.statusCode??400,{error:error.code??'request_failed',message:error instanceof Error?error.message:String(error)}));});
  server.requestTimeout=0;
  // One low-priority summary at a time; leave capacity for interactive projects and uploads.
  // Prepare up to three distinct projects concurrently, but always leave at
  // least one project worker available for foreground navigation. This removes
  // the former one-at-a-time 22-project cold-start queue.
  let activeSummaryWarmups=0;
  const maxSummaryWarmups=Math.max(1,Math.min(3,maxWorkers-1));
  const warmSweep=()=>{
    publishIdleLanes();
    // Never begin heavyweight background calculations while project pages are
    // being opened or uploaded; these jobs previously queued ahead of the
    // first Overview, making a light read take more than five seconds.
    if(activeForegroundRequests>0||Date.now()-lastForegroundProjectRequestAt<1500)return;
    for(const [key,value] of progress)if(value.updatedAt&&Date.now()-Date.parse(value.updatedAt)>6*60*60*1000)progress.delete(key);
    // Every background lane counts against one budget (summaries and the page
    // warm-up chain together), so at least one worker always stays free for a
    // user request when maxWorkers>1: a user never waits behind warm-up work.
    const backgroundLanes=activeSummaryWarmups+(scheduledWarmups.size?1:0)+(secondaryWarmupActive?1:0);
    if(closing||backgroundLanes>=maxSummaryWarmups)return;
    const idleLane=[...lanes.values()].some(l=>l.pending===0&&Date.now()-l.lastUsed>8000);
    const entry=recentFirst([...catalog.values()]).find(e=>!e.metadata?.demo&&e.summaryRelease!==calculationRelease()&&!updating.get(e.projectId)&&!summaryJobs.has(e.projectId)&&Date.now()-(summaryAttempts.get(e.projectId)??0)>60000&&
      (lanes.has(e.projectId)||lanes.size<maxWorkers||idleLane));
    if(!entry){scheduleSecondaryWarmup();return;}
    activeSummaryWarmups++;
    void refreshSummary(entry.projectId).finally(()=>{activeSummaryWarmups--;});
  };
  const warmer=setInterval(warmSweep,2000);warmer.unref();
  // Prepare one existing project worker before declaring the gateway ready:
  // no imported records are altered, and this avoids making the first browser
  // request pay for loading/parsing a full project snapshot. Remaining workers
  // and calculation-versioned pages warm incrementally without blocking health.
  const firstProject=recentFirst([...catalog.values()]).find(e=>e.metadata&&!e.metadata.demo)?.projectId;
  const firstVersion=firstProject?catalog.get(firstProject)?.metadata?.version:undefined;
  const retainedFirstViews=firstProject&&firstVersion!==undefined&&
    await reads(firstProject).get(calculationRelease(),firstVersion,'/api/projects/'+encodeURIComponent(firstProject)+'/overview')&&
    await reads(firstProject).get(calculationRelease(),firstVersion,'/api/projects/'+encodeURIComponent(firstProject)+'/management/master-dashboard');
  if(firstProject&&!retainedFirstViews){
    let startupTimer:NodeJS.Timeout|undefined;
    const workerReady=work(firstProject,async()=>{}).catch(error=>console.warn('[project-worker-prime] '+firstProject+': '+String(error)));
    await Promise.race([workerReady,new Promise<void>(resolve=>{startupTimer=setTimeout(resolve,8000);})]);
    if(startupTimer)clearTimeout(startupTimer);
  }
  // The full portfolio remains accessible even if another project's warmup fails.
  const initialWarmup=setTimeout(warmSweep,4000);initialWarmup.unref();
  // T11 release preparation. A new calculation release finds every project's
  // saved results stamped with the previous release, so the first Overview and
  // Dashboard of each project would be a full cold calculation (ABB-100: about
  // 40 s). Before this deployment reports ready, each such project is
  // recalculated by THIS release through the normal request path (summary, then
  // Accountability, Dashboard and Overview) and stored with this release and the
  // project's version. Nothing is reused across releases or versions: a saved
  // result is served only for the same calculation release and project version,
  // and any change to a project removes its saved results (see proxy()).
  // Projects never calculated before (no saved summary) are not prepared here,
  // so a new project's first calculation is always measured cold.
  // After the time limit (default 240 s) the deployment reports ready and
  // preparation continues in the background, so a slow project can never keep
  // the service down.
  const preparationEnabled=options.prepareRelease??(process.env.CMENG_PREPARE_RELEASE?.trim()==='1'||Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim())&&process.env.CMENG_PREPARE_RELEASE?.trim()!=='0');
  const preparationTargets=preparationEnabled?recentFirst([...catalog.values()])
    .filter(e=>e.summary&&!e.metadata?.demo&&e.summaryRelease!==calculationRelease())
    .map(e=>e.projectId):[];
  releasePreparation.total=preparationTargets.length;
  if(preparationTargets.length){
    releasePreparation.state='preparing';
    const started=Date.now();
    const limitMs=options.releasePreparationMs??Number(process.env.CMENG_RELEASE_PREPARATION_SECONDS??240)*1000;
    const lanesForPreparation=Math.max(1,Math.min(maxWorkers,4));
    // Phase 1 prepares every project's summary, Accountability, Dashboard and
    // Overview; phase 2 the remaining pages (modules, actions, documents), which
    // are projections of the same calculation. Readiness waits for both.
    const prepareOne=async(id:string,phase:'priority'|'secondary')=>{
      const projectStarted=Date.now();
      try{
        if(phase==='priority')await refreshSummary(id);
        const entry=catalog.get(id),version=entry?.metadata?.version;
        if(version!==undefined&&entry?.summaryRelease===calculationRelease())await warmProjectPages(id,version,phase);
      }catch(error){console.warn('[release-preparation] '+id+': '+String(error));}
      if(phase==='priority')releasePreparation.prepared++;else releasePreparation.pagesPrepared++;
      console.log(JSON.stringify({event:'release_preparation_project',phase,projectId:id,ms:Math.round(Date.now()-projectStarted)}));
    };
    const runPhase=async(phase:'priority'|'secondary')=>{
      const queue=[...preparationTargets];
      await Promise.all(Array.from({length:lanesForPreparation},async()=>{for(let id=queue.shift();id!==undefined&&!closing;id=queue.shift())await prepareOne(id,phase);}));
    };
    const preparation=runPhase('priority').then(()=>{releasePreparation.priorityElapsedMs=Date.now()-started;return runPhase('secondary');});
    let limitTimer:NodeJS.Timeout|undefined;
    void Promise.race([preparation.then(()=>'complete' as const),new Promise<'timed_out'>(resolve=>{limitTimer=setTimeout(()=>resolve('timed_out'),limitMs);limitTimer.unref();})]).then(outcome=>{
      if(limitTimer)clearTimeout(limitTimer);
      releasePreparation.state=outcome;releasePreparation.elapsedMs=Date.now()-started;
      console.log(JSON.stringify({event:'release_preparation',state:outcome,preparedProjects:releasePreparation.prepared,allPagesProjects:releasePreparation.pagesPrepared,totalProjects:releasePreparation.total,priorityElapsedMs:releasePreparation.priorityElapsedMs,elapsedMs:releasePreparation.elapsedMs}));
    });
  }
  const close=async()=>{closing=true;clearInterval(warmer);clearTimeout(initialWarmup);signal();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await Promise.allSettled([...summaryJobs.values(),...pendingReadPublications.values(),...siblingPublications]);await Promise.all([...lanes.values()].map(l=>l.worker.terminate()));await catalogWrites;};
  return {server,close,catalog};
}

if(require.main===module){
  const root=process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim()||process.env.CMENG_DATA_DIR?.trim()||join(process.cwd(),'.cmeng-runtime');
  void createProjectGateway(root).then(gateway=>{
    const port=Number(process.env.PORT??3000),host=process.env.HOST??'0.0.0.0';
    gateway.server.listen(port,host,()=>{console.log('CMeng runtime listening on '+host+':'+port);void probeConfiguredProvider(root,calculationRelease()).catch(()=>console.warn('AI provider self-check unavailable; CMeng calculations remain enabled.'));});
    process.once('SIGTERM',()=>{void gateway.close().then(()=>process.exit(0));});
  }).catch(error=>{console.error('CMENG_STARTUP_FAILED',error);process.exitCode=1;});
}
