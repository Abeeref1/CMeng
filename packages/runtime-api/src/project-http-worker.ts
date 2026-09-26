import {parentPort,workerData} from 'node:worker_threads';
import {createCmengServer} from './server';
import {runtimeProjects} from './project-state';
import {projectMetadata} from './project-catalog';
import type {AddressInfo} from 'node:net';

void (async()=>{
  const id=String(workerData.projectId);
  for(const retained of runtimeProjects.listProjectIds())if(retained!==id)throw new Error('PROJECT_WORKER_STATE_MISMATCH');
  await runtimeProjects.refreshScheduleControlBasisAssertions();
  await runtimeProjects.refreshSpreadsheetRegisters();
  await runtimeProjects.refreshHseReports();
  await runtimeProjects.refreshCorrespondenceNarratives();
  await runtimeProjects.refreshDeferredPdfReads();
  const server=createCmengServer();server.requestTimeout=0;
  server.on('request',(_req,res)=>res.on('finish',()=>{
    const state=runtimeProjects.get(id);if(!state)return;
    const metadata={...projectMetadata(state),latestDataDateIso:runtimeProjects.latestSchedule(id)?.revision.model.dataDateIso??null};parentPort?.postMessage({type:'metadata',metadata});
  }));
  server.listen(0,'127.0.0.1',()=>parentPort?.postMessage({type:'ready',port:(server.address() as AddressInfo).port}));
})().catch(error=>{throw error;});
