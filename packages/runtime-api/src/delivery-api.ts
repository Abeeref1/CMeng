import type {IncomingMessage,ServerResponse} from 'node:http';
import {runtimeProjects} from './project-state';
import {changeDelivery,deliveryRecords,deliveryStore} from './delivery-records';
import {projectControlSchedule} from './canonical-time-claims';
import {resolveBoqSource} from './boq-source';
import {sourceTables} from '../../truth-kernel/src';
import {sendHttpBody} from './http-response';
import {deliveryKinds,deliveryLabels,lifecycleExamples} from '../../delivery-core/src/types';

export async function deliveryRequest(req:IncomingMessage,res:ServerResponse,url:URL):Promise<boolean>{
 const match=/^\/api\/projects\/([^/]+)\/delivery\/(records|catalog|sources)(?:\/([^/]+))?$/.exec(url.pathname);if(!match)return false;
 const send=(status:number,data:unknown)=>{sendHttpBody(res,status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},JSON.stringify(data));};
 const projectId=decodeURIComponent(match[1]!),state=runtimeProjects.get(projectId);if(!state){send(404,{error:'Project not found.'});return true;}
 try{
  if(req.method==='POST'&&match[2]==='records'){
   const parts:Buffer[]=[];let size=0;for await(const part of req){const b=Buffer.from(part);size+=b.length;if(size>2*1024*1024)throw new Error('Delivery edit exceeds the record limit. Import larger registers through Documents.');parts.push(b);}
   const input=JSON.parse(Buffer.concat(parts).toString('utf8'));const result=changeDelivery(state,input);runtimeProjects.touch(state);send(200,{projectId,projectVersion:state.version,...result});return true;
  }
  if(req.method!=='GET'){send(405,{error:'Method not supported.'});return true;}
  const source=deliveryRecords(state),q=(url.searchParams.get('q')??'').toLowerCase(),kind=url.searchParams.get('kind');
  if(match[2]==='sources'){
   const tables=sourceTables(state.evidenceDocuments,[],{includeHistorical:true});send(200,{projectId,projectVersion:state.version,documents:state.evidenceDocuments.map(d=>({documentId:d.documentId,filename:d.sourceFilename,sourceHash:d.sourceHashSha256,basisState:d.basisState,mediaType:d.mediaType,reading:d.fullTextRead?{completedAt:d.fullTextRead.completedAt,sourceHash:d.fullTextRead.sourceHashSha256}:null,headers:[...new Set(tables.filter(t=>t.document.documentId===d.documentId).flatMap(t=>t.headers))]})),readingStates:source.documents});return true;
  }
  if(match[2]==='records'&&match[3]){const record=source.records.find(r=>r.recordId===decodeURIComponent(match[3]!));if(!record){send(404,{error:'Delivery record not found in this project.'});return true;}send(200,{projectId,projectVersion:state.version,record,history:deliveryStore(state).decisions.filter(d=>d.recordId===record.recordId)});return true;}
  let rows:any[]=source.records.filter(r=>!kind||r.kind===kind);
  if(match[2]==='catalog'){
   if(kind==='activity')rows=projectControlSchedule(state)?.revision.model.activities.map(a=>({id:a.activityId,label:a.activityId+' · '+a.name}))??[];
   else if(kind==='boq')rows=resolveBoqSource(state,projectControlSchedule(state)?.revision.revisionId??'').quantities?.items.map(i=>({id:i.quantityItemId,label:i.quantityItemId+' · '+i.description+' · '+i.unit,unit:i.unit}))??[];
   else rows=rows.filter(r=>['governed','verified'].includes(r.state)).map(r=>({id:r.recordId,label:(r.reference??'')+' · '+(r.description??''),kind:r.kind}));
  }
  if(q)rows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
  const offset=Math.max(0,Number(url.searchParams.get('offset'))||0),limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||50));
  send(200,{projectId,projectVersion:state.version,total:rows.length,offset,limit,rows:rows.slice(offset,offset+limit),kinds:deliveryKinds,labels:deliveryLabels,lifecycleExamples});return true;
 }catch(error){const message=error instanceof Error?error.message:'Delivery request failed';send(message.startsWith('PROJECT_VERSION_CHANGED')?409:400,{error:message});return true;}
}
