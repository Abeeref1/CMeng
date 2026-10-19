import {flushWorkerCompileCache} from './worker-compile-cache';
import {parentPort,workerData} from 'node:worker_threads';
import {createCmengServer,projectDocumentRegister} from './server';
import {runtimeProjects,normalizeProjectCode} from './project-state';
import {projectMetadata} from './project-catalog';
import {scheduleIdleProjectWork} from './project-idle-work';
import {noteDeferredReading} from './document-read-review';
import type {AddressInfo} from 'node:net';

void (async()=>{
  const id=String(workerData.projectId);
  for(const retained of runtimeProjects.listProjectIds())if(retained!==id)throw new Error('PROJECT_WORKER_STATE_MISMATCH');
  await runtimeProjects.refreshScheduleControlBasisAssertions();
  await runtimeProjects.refreshSpreadsheetRegisters();
  await runtimeProjects.refreshHseReports();
  await runtimeProjects.refreshCorrespondenceNarratives();
  // SW-14: every PDF in this worker's idle reading queue shows as queued.
  for(const document of runtimeProjects.get(id)?.evidenceDocuments??[])if(/pdf/i.test(document.mediaType??''))noteDeferredReading(document,'queued');

  let documentVersion:number|null=null;
  const publishDocuments=()=>{
    const state=runtimeProjects.get(id);if(!state||state.version===documentVersion)return;
    const documents=projectDocumentRegister(id);
    parentPort?.postMessage({type:'documents',version:state.version,documents});documentVersion=state.version;
  };
  const publishMetadata=()=>{
    const state=runtimeProjects.get(id);if(!state)return;
    const metadata={...projectMetadata(state),latestDataDateIso:runtimeProjects.latestSchedule(id)?.revision.model.dataDateIso??null};
    parentPort?.postMessage({type:'metadata',metadata});
  };
  publishDocuments();

  // Full PDF/OCR work used to block the project worker from listening, sometimes
  // for the duration of a large appendix. Keep the durable reader and its
  // authority rules, but open the project immediately after lightweight refresh.
  // Read one retained PDF per idle turn, after foreground page requests finish.
  const pendingPdfIds=(runtimeProjects.get(id)?.evidenceDocuments??[])
    .filter(document=>/pdf/i.test(document.mediaType??''))
    .map(document=>document.documentId);
  const deferredReading=scheduleIdleProjectWork(async()=>{
    const documentId=pendingPdfIds.shift();
    if(!documentId)return false;
    const result=await runtimeProjects.refreshDeferredPdfReads(id,undefined,documentId);
    if(result.diagnostics.length)console.warn(JSON.stringify({
      event:'deferred_pdf_read_diagnostics',
      projectId:id,
      documentId,
      diagnosticCodes:result.diagnostics.map(item=>item.split(':')[0]),
    }));
    if(result.changedProjects.some(changed=>normalizeProjectCode(changed)===normalizeProjectCode(id))){publishDocuments();publishMetadata();}
    return pendingPdfIds.length>0;
  },{idleMillis:4000,onError:error=>console.error('CMENG_DEFERRED_PDF_WORK_FAILED:'+String(error))});

  const server=createCmengServer();server.requestTimeout=0;
  server.prependListener('request',(_req,res)=>{
    deferredReading.requestStarted();
    res.once('close',()=>deferredReading.requestFinished());
    const writeHead=res.writeHead;
    res.writeHead=function(...args:any[]){
      const version=runtimeProjects.get(id)?.version;
      if(version!==undefined)res.setHeader('x-cmeng-project-version',String(version));
      return (writeHead as Function).apply(res,args);
    } as typeof res.writeHead;
  });
  server.on('request',(_req,res)=>res.on('finish',()=>{
    publishMetadata();
    publishDocuments();
  }));
  server.on('close',()=>deferredReading.close());
  server.listen(0,'127.0.0.1',()=>{
    parentPort?.postMessage({type:'ready',port:(server.address() as AddressInfo).port});
    deferredReading.start();
    setImmediate(flushWorkerCompileCache);
  });
})().catch(error=>{throw error;});
