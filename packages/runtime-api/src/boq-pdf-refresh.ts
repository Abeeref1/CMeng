import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ingestBoq} from '../../boq-ingestion/src';
import type {OcrProvider} from '../../pdf-document-parser/src';
import type {StoredEvidenceDocument,ProjectRuntimeState} from './project-state-types';
import {quantityModelFromBoq} from './boq-source';

const producerVersion='offline-boq-cells-v2';
const running=new WeakMap<StoredEvidenceDocument,Promise<boolean>>();
/** Refresh derived rows, not the uploaded document or its adoption history. */
export function refreshDeferredPdfBoq(document:StoredEvidenceDocument,state:ProjectRuntimeState,createProvider:()=>OcrProvider|undefined,onPageRead?:(pageNumber:number,totalPages:number)=>void):Promise<boolean>{
 const priorWork=running.get(document);if(priorWork)return priorWork;
 const work=(async()=>{
  const possibleBoq=document.documentType==='boq'||document.documentType==='supporting_document'&&/\b(?:bill[\W_]*of[\W_]*quantities|boq)\b/i.test(document.sourceFilename.replaceAll('_',' '));
  if(!possibleBoq||!/pdf/i.test(document.mediaType))return false;
  const hash=document.sourceHashSha256,receipt=document.boqTableRead;
  if(!hash)throw new Error('BOQ_REFRESH_SOURCE_HASH_MISSING');
  if(receipt&&receipt.sourceHashSha256===hash&&receipt.producerVersion===producerVersion)return false;
  const bytes=readFileSync(document.storedPath);
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('BOQ_REFRESH_SOURCE_HASH_MISMATCH');
  const prior=state.boqRevisions.find(b=>b.ingestionId===(receipt?.ingestionId??document.linkedArtifactId)&&b.sourceHashSha256===hash)
    ??(state.boq?.sourceHashSha256===hash?state.boq:null);
  const provider=createProvider();
  if(!provider)return false;
  const result=await ingestBoq({projectId:state.projectId,bytes,verifiedMediaType:document.mediaType,receivedAt:prior?.receivedAt??document.uploadedAt,sourceFilename:document.sourceFilename,
   ...(prior?{documentId:prior.evidenceReceipt.documentId,revisionId:prior.evidenceReceipt.revisionId,objectId:prior.evidenceReceipt.objectId}:{documentId:document.documentId})
  },{pdf:{ocrProvider:provider,...(onPageRead?{onProgress:(number,total)=>onPageRead(number,total)}:{})}});
  if(document.sourceHashSha256!==hash||!state.evidenceDocuments.includes(document))return false;
  const structuredTableFound=result.diagnostics.some(d=>d.startsWith('BOQ_OFFLINE_RASTER_TABLE:'));
  // A filename only selects a reading attempt. It cannot establish the family.
  if(document.documentType!=='boq'&&!structuredTableFound)return false;
  if(prior){
   result.ingestionId=prior.ingestionId;result.persistence=prior.persistence;
   if(result.evidenceReceipt.receiptId!==prior.evidenceReceipt.receiptId){
    for(const item of result.canonicalItems)item.sourceRefs=item.sourceRefs.map(ref=>ref==='evidence-receipt:'+result.evidenceReceipt.receiptId?'evidence-receipt:'+prior.evidenceReceipt.receiptId:ref);
   }
   result.evidenceReceipt=prior.evidenceReceipt;result.sourceManifest=prior.sourceManifest;
  }
  const index=state.boqRevisions.findIndex(b=>b.ingestionId===result.ingestionId);
  if(index>=0)state.boqRevisions[index]=result;else state.boqRevisions.push(result);
  if(state.boq?.ingestionId===result.ingestionId){state.boq=result;state.quantities=quantityModelFromBoq(result,state.quantities?.scheduleRevisionId??'',state.quantities);}
  if(document.documentType==='boq')document.linkedArtifactId=result.ingestionId;
  document.parserState=result.complete?'parsed':'partial';
  const completedAt=new Date().toISOString();
  if(result.pdfRead)document.fullTextRead={producerVersion:'full-page-read-v1',sourceHashSha256:hash,completedAt,result:result.pdfRead};
  // An OCR-disabled pass must not prevent a later offline OCR refresh.
  document.boqTableRead={producerVersion,sourceHashSha256:hash,completedAt,structuredTableFound,ingestionId:result.ingestionId};
  document.diagnostics=[...new Set([...document.diagnostics,...result.diagnostics])];
  return true;
 })();
 running.set(document,work);void work.finally(()=>running.delete(document)).catch(()=>{});return work;
}
