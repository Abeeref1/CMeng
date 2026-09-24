import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parsePdfDocument,type OcrProvider} from '../../pdf-document-parser/src';
import type {SourceTable} from '../../truth-kernel/src';
import type {ProjectRuntimeState,StoredEvidenceDocument} from './project-state-types';

/** Upload classification, physical reading and adoption are different facts. */
export function documentReadReview(document:StoredEvidenceDocument,state:ProjectRuntimeState,table?:SourceTable){
  const hash=document.sourceHashSha256;
  const pdf=document.fullTextRead?.sourceHashSha256===hash?document.fullTextRead.result:
    state.contractDocuments.find(d=>d.documentId===document.documentId&&d.sourceHashSha256===hash)?.result.pdf;
  if(pdf){
    const readPages=pdf.nativePages+pdf.ocrPages+pdf.blankPages;
    const complete=pdf.totalPages>0&&readPages===pdf.totalPages&&pdf.failedPages===0&&pdf.unresolvedPages===0;
    return {state:complete?'read':'partial',label:complete?'All pages read':'Pages need review',
      note:`${readPages} of ${pdf.totalPages} pages read: ${pdf.nativePages} native, ${pdf.ocrPages} OCR, ${pdf.blankPages} blank; ${pdf.failedPages} failed, ${pdf.unresolvedPages} unresolved. Reading does not confirm structured facts, compliance or adoption.`,
      method:pdf.ocrPages?'Native text / OCR':'Native text',pageCount:pdf.totalPages,readPageCount:readPages,complete};
  }
  const receipt=document.correspondenceNarrativeRefresh;
  if(receipt?.sourceHashSha256===hash){
    const readPages=receipt.nativePages+receipt.ocrPages;
    const complete=receipt.totalPages>0&&readPages===receipt.totalPages&&receipt.ocrFailedPages===0;
    return {state:complete?'read':'partial',label:complete?'All pages read':'Pages need review',
      note:`${readPages} of ${receipt.totalPages} pages read: ${receipt.nativePages} native, ${receipt.ocrPages} OCR; ${receipt.ocrFailedPages} OCR failures. ${receipt.unresolvedAnchorCount} referenced identities remain unresolved. Reading does not confirm notice or award contents.`,
      method:receipt.ocrPages?'Native text / OCR':'Native text',pageCount:receipt.totalPages,readPageCount:readPages,complete};
  }
  if(document.hseSummary?.sourceHashSha256===hash){
    const known=Object.values(document.hseSummary.metrics).filter(v=>v!==null).length;
    return {state:known?'read':'partial',label:known?'Report figures read':'Report figures need review',note:`${known} report figures extracted. Reporting period, rate basis and incident status are assessed separately.`,method:'Native text',pageCount:null,readPageCount:null,complete:false};
  }
  if(table?.document.sourceHashSha256===hash){
    if(table.recognition?.recognized===false)return {state:'unresolved',label:'Columns not recognised',note:`Read ${table.recognition.readRowCount} rows, columns not recognised: ${table.headers.join(', ')}.`,method:'Tabular content',pageCount:null,readPageCount:null,complete:false};
    return {state:'read',label:'Source rows read',note:`${table.rows.length} rows and ${table.headers.length} fields read from the source. Field completeness, validation, mapping and adoption are checked separately.`,method:'Tabular content',pageCount:null,readPageCount:null,complete:false};
  }
  return {state:document.parserState,label:null,note:null,method:null,pageCount:document.identification?.pageCount??null,readPageCount:null,complete:false};
}

const running=new WeakMap<StoredEvidenceDocument,Promise<boolean>>();
/** Finish deferred physical reading without promoting a document or inventing facts. */
export function refreshDeferredPdfRead(document:StoredEvidenceDocument,createProvider:()=>OcrProvider):Promise<boolean>{
  const prior=running.get(document);if(prior)return prior;
  const work=(async()=>{
    if(document.parserState!=='ocr_pending'||!/pdf/i.test(document.mediaType)||
      (document.fullTextRead?.sourceHashSha256===document.sourceHashSha256&&document.fullTextRead.result.complete))return false;
    const hash=document.sourceHashSha256,bytes=readFileSync(document.storedPath);
    if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('DEFERRED_PDF_SOURCE_HASH_MISMATCH');
    const result=await parsePdfDocument(bytes,{ocrProvider:createProvider()});
    if(document.sourceHashSha256!==hash)throw new Error('DEFERRED_PDF_SOURCE_CHANGED');
    document.fullTextRead={producerVersion:'full-page-read-v1',sourceHashSha256:hash,completedAt:new Date().toISOString(),result};
    return true;
  })();
  running.set(document,work);void work.finally(()=>running.delete(document)).catch(()=>{});return work;
}
