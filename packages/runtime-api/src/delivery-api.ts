import type {IncomingMessage,ServerResponse} from 'node:http';
import {runtimeProjects} from './project-state';
import {changeDelivery,deliveryRecords,deliveryStore,deliveryBatchReview} from './delivery-records';
import {projectControlSchedule} from './canonical-time-claims';
import {resolveBoqSource} from './boq-source';
import {deliveryAuthorityCatalog} from './delivery-authorities';
import {deliverySourceTables} from './delivery-sources';
import {sourceTables,canonicalHeader} from '../../truth-kernel/src';
import {sendHttpBody} from './http-response';
import {pageProjectResponse} from './response-paging';
import {deliveryKinds,deliveryLabels,lifecycleExamples} from '../../delivery-core/src/types';

export async function deliveryRequest(req:IncomingMessage,res:ServerResponse,url:URL):Promise<boolean>{
 const match=/^\/api\/projects\/([^/]+)\/delivery\/(records|catalog|sources|batch-review|source-values)(?:\/([^/]+))?$/.exec(url.pathname);if(!match)return false;
 const send=(status:number,data:unknown,exact=false)=>{sendHttpBody(res,status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},JSON.stringify(status===200&&req.method==='GET'&&!exact?pageProjectResponse(data,url.pathname):data));};
 const projectId=decodeURIComponent(match[1]!),state=runtimeProjects.get(projectId);if(!state){send(404,{error:'Project not found.'});return true;}
 try{
  if(req.method==='POST'&&match[2]==='records'){
   const parts:Buffer[]=[];let size=0;for await(const part of req){const b=Buffer.from(part);size+=b.length;if(size>2*1024*1024)throw new Error('Delivery edit exceeds the record limit. Import larger registers through Documents.');parts.push(b);}
   const input=JSON.parse(Buffer.concat(parts).toString('utf8'));const result=changeDelivery(state,input);runtimeProjects.touch(state);send(200,{projectId,projectVersion:state.version,...result});return true;
  }
  if(req.method!=='GET'){send(405,{error:'Method not supported.'});return true;}
  const source=deliveryRecords(state),q=(url.searchParams.get('q')??'').toLowerCase(),kind=url.searchParams.get('kind');
  if(match[2]==='batch-review'){
   const {eligibleRecords,rows,...preview}=deliveryBatchReview(state,{documentId:url.searchParams.get('documentId')??'',sourceHash:url.searchParams.get('sourceHash')??'',kind:kind??''});
   const filter=url.searchParams.get('filter'),matched=rows.filter(r=>(filter==='eligible'?r.eligible:filter==='retained'?!r.eligible:true)&&(!q||JSON.stringify(r).toLowerCase().includes(q))),offset=Math.max(0,Number(url.searchParams.get('offset'))||0),limit=25;
   send(200,{...preview,matchedCount:matched.length,offset,limit,rows:matched.slice(offset,offset+limit)});return true;
  }
  if(match[2]==='source-values'){
   const doc=state.evidenceDocuments.find(d=>d.documentId===url.searchParams.get('documentId')&&d.sourceHashSha256===url.searchParams.get('sourceHash'));if(!doc)throw new Error('Select the current source document.');
   const column=canonicalHeader(url.searchParams.get('column')??''),tables=deliverySourceTables(state,[]).filter(t=>t.document.documentId===doc.documentId&&t.headers.includes(column));if(!tables.length)throw new Error('Select a retained source column.');
   const counts=new Map<string,number>();for(const t of tables)for(const row of t.rows){const value=String(row.cells[column]??'');counts.set(value,(counts.get(value)??0)+1);}
   const rows=[...counts].map(([value,count])=>({value,count})),offset=Math.max(0,Number(url.searchParams.get('offset'))||0),limit=25;
   send(200,{projectId,projectVersion:state.version,documentId:doc.documentId,sourceHash:doc.sourceHashSha256,column,total:rows.length,sourceRowCount:rows.reduce((n,r)=>n+r.count,0),offset,limit,rows:rows.slice(offset,offset+limit)},true);return true;
  }
  if(match[2]==='sources'&&match[3]){
   const doc=state.evidenceDocuments.find(d=>d.documentId===decodeURIComponent(match[3]!)&&d.sourceHashSha256===url.searchParams.get('sourceHash'));if(!doc)throw new Error('Source document changed; reload its mapping.');
   const tables=deliverySourceTables(state,[]).filter(t=>t.document.documentId===doc.documentId),mapping=deliveryStore(state).mappings?.filter(m=>m.documentId===doc.documentId&&m.sourceHash===doc.sourceHashSha256).at(-1)??null;
   send(200,{projectId,projectVersion:state.version,document:{documentId:doc.documentId,filename:doc.sourceFilename,sourceHash:doc.sourceHashSha256,kinds:[...new Set(source.documents.filter(d=>d.documentId===doc.documentId).map(d=>d.kind).filter(Boolean))],headers:[...new Set(tables.flatMap(t=>t.headers))],mapping}},true);return true;
  }
  if(match[2]==='sources'){
   const tables=deliverySourceTables(state,[]);send(200,{projectId,projectVersion:state.version,documents:state.evidenceDocuments.map(d=>({documentId:d.documentId,filename:d.sourceFilename,sourceHash:d.sourceHashSha256,basisState:d.basisState,mediaType:d.mediaType,reading:d.fullTextRead?{completedAt:d.fullTextRead.completedAt,sourceHash:d.fullTextRead.sourceHashSha256}:null,...(url.searchParams.get('view')==='picker'?{}:{headers:[...new Set(tables.filter(t=>t.document.documentId===d.documentId).flatMap(t=>t.headers))]})})),readingStates:source.documents},url.searchParams.get('view')==='picker');return true;
  }
  if(match[2]==='records'&&match[3]){const record=source.records.find(r=>r.recordId===decodeURIComponent(match[3]!));if(!record){send(404,{error:'Delivery record not found in this project.'});return true;}
   const selected=new Set(Object.values(record.links).flat().filter((id):id is string=>typeof id==='string')),linkLabels:Record<string,string>={};
   for(const r of source.records)if(selected.has(r.recordId))linkLabels[r.recordId]=[r.reference,r.description].filter(Boolean).join(' · ');
   if(record.links.activityIds.length)for(const a of projectControlSchedule(state)?.revision.model.activities??[])if(selected.has(a.activityId))linkLabels[a.activityId]=a.activityId+' · '+a.name;
   if(record.links.boqItemIds.length)for(const i of resolveBoqSource(state,projectControlSchedule(state)?.revision.revisionId??'').quantities?.items??[])if(selected.has(i.quantityItemId))linkLabels[i.quantityItemId]=i.description+' · '+i.unit;
   send(200,{projectId,projectVersion:state.version,record,linkLabels,history:deliveryStore(state).decisions.filter(d=>d.recordId===record.recordId)});return true;}
  let rows:any[]=source.records.filter(r=>!kind||r.kind===kind);
  if(match[2]==='catalog'){
   if(kind==='activity')rows=projectControlSchedule(state)?.revision.model.activities.map(a=>({id:a.activityId,label:a.activityId+' · '+a.name}))??[];
   else if(kind==='boq')rows=resolveBoqSource(state,projectControlSchedule(state)?.revision.revisionId??'').quantities?.items.map(i=>({id:i.quantityItemId,label:i.quantityItemId+' · '+i.description+' · '+i.unit,unit:i.unit}))??[];
   else if(kind&&['risk','claim','notice','variation'].includes(kind))rows=deliveryAuthorityCatalog(state,kind).map(r=>({id:r.id,label:r.label,kind}));
   else rows=rows.filter(r=>['governed','verified'].includes(r.state)).map(r=>({id:r.recordId,label:(r.reference??'')+' · '+(r.description??''),kind:r.kind}));
  }
  if(q)rows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
  const offset=Math.max(0,Number(url.searchParams.get('offset'))||0),limit=Math.max(1,Math.min(25,Number(url.searchParams.get('limit'))||25));
  send(200,{projectId,projectVersion:state.version,total:rows.length,offset,limit,rows:rows.slice(offset,offset+limit),kinds:deliveryKinds,labels:deliveryLabels,lifecycleExamples});return true;
 }catch(error){const message=error instanceof Error?error.message:'Delivery request failed';send(message.startsWith('PROJECT_VERSION_CHANGED')?409:400,{error:message});return true;}
}
