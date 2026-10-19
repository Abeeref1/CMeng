import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parsePdfDocument,legiblePdfPageEvidence,type PdfDocumentResult,type OcrProvider} from '../../pdf-document-parser/src';
import {sourceTables,type SourceTable} from '../../truth-kernel/src';
import type {ProjectRuntimeState,StoredEvidenceDocument} from './project-state-types';
import {conditionalNotice} from './conditional-notice';

/** Validate actual PDF page identities instead of trusting aggregate counts.
 * Physical source reading does not establish document adoption or authority. */
function physicalPdfCoverage(pdf:PdfDocumentResult){
  const seen=new Set<number>();
  let native=0,ocr=0,blank=0,failed=0,unreadableNative=0,readPages=0;
  for(const page of pdf.pages){
    if(page.method==='native')native++;
    else if(page.method==='ocr')ocr++;
    else if(page.method==='blank')blank++;
    else failed++;
    const unreadable=page.method==='native'&&!legiblePdfPageEvidence(page);
    if(unreadable)unreadableNative++;
    if(!Number.isInteger(page.pageNumber)||page.pageNumber<1||page.pageNumber>pdf.totalPages||seen.has(page.pageNumber))continue;
    seen.add(page.pageNumber);
    if(legiblePdfPageEvidence(page)&&page.aiReview?.status!=='review_required')readPages++;
  }
  const complete=Number.isInteger(pdf.totalPages)&&pdf.totalPages>0&&
    pdf.pages.length===pdf.totalPages&&seen.size===pdf.totalPages&&readPages===pdf.totalPages&&
    native===pdf.nativePages&&ocr===pdf.ocrPages&&blank===pdf.blankPages&&failed===pdf.failedPages&&
    failed===0&&pdf.unresolvedPages===0;
  return {unreadableNative,readPages,complete};
}

/** Upload classification, physical reading and adoption are different facts. */
export function documentReadReview(document:StoredEvidenceDocument,state:ProjectRuntimeState,sourceTables?:SourceTable|readonly SourceTable[]){
  const hash=document.sourceHashSha256;
  const pdf=document.fullTextRead?.sourceHashSha256===hash?document.fullTextRead.result:
    state.contractDocuments.find(d=>d.documentId===document.documentId&&d.sourceHashSha256===hash)?.result.pdf;
  const coverage=pdf?physicalPdfCoverage(pdf):null;
  const fullUnreadable=coverage?.unreadableNative??0;
  const fullPagesRead=coverage?.readPages??null;
  const fullReadComplete=coverage?.complete??false;
  // A stale per-page checkpoint must not overrule a fully completed receipt
  // from these same original source bytes. Source authority remains unchanged.
  const checkpoint=document.fullTextReadCheckpoint;
  if(checkpoint?.sourceHashSha256===hash&&!fullReadComplete){
    const eligible=checkpoint.pages.filter(p=>Number.isInteger(p.pageNumber)&&p.pageNumber>=1&&p.pageNumber<=checkpoint.totalPages);
    const read=new Set(eligible.filter(p=>legiblePdfPageEvidence(p)&&p.aiReview?.status!=='review_required').map(p=>p.pageNumber)).size;
    const complete=Number.isInteger(checkpoint.totalPages)&&checkpoint.totalPages>0&&read===checkpoint.totalPages&&checkpoint.pages.length===checkpoint.totalPages&&eligible.length===checkpoint.totalPages;
    return {state:complete?'read':'partial',label:complete?'All pages read':'Partial page reading retained',note:read+' of '+checkpoint.totalPages+' pages read. '+(complete?'Physical reading is complete; structured fact validation and adoption remain separate.':'Saved pages will be reused on the next processing attempt; unreadable pages still require reading.'),method:'Native text / OCR',pageCount:checkpoint.totalPages,readPageCount:read,complete};
  }
  if(pdf){
    const unreadableNative=fullUnreadable;
    const readPages=fullPagesRead!;
    const complete=fullReadComplete;
    return {state:complete?'read':'partial',label:complete?'All pages read':'Pages need review',
      note:`${readPages} of ${pdf.totalPages} pages read: ${pdf.nativePages-unreadableNative} native, ${pdf.ocrPages} OCR, ${pdf.blankPages} blank; ${pdf.failedPages} failed, ${pdf.unresolvedPages+unreadableNative} unresolved. Reading does not confirm structured facts, compliance or adoption.`,
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
  const tables=(Array.isArray(sourceTables)?sourceTables:sourceTables?[sourceTables]:[]).filter(table=>
    table.document.sourceHashSha256===hash&&table.document.documentId===document.documentId);
  if(tables.length>1){
    const unresolved=tables.filter(table=>table.recognition?.recognized===false);
    const rows=tables.reduce((sum,table)=>sum+(table.recognition?.recognized===false?table.recognition.readRowCount:table.rows.length),0);
    const fields=new Set(tables.flatMap(table=>table.headers)).size;
    const complete=document.parserState==='parsed'&&unresolved.length===0;
    return {state:complete?'read':'partial',label:complete?'Source rows read':'Source tables need review',
      note:`${rows} rows and ${fields} distinct fields read across ${tables.length} parsed tables. ${unresolved.length} tables have unrecognised columns. Field completeness, validation, mapping and adoption are checked separately.`,
      method:'Tabular content',pageCount:null,readPageCount:null,complete};
  }
  const table=tables[0];
  if(table){
    if(table.recognition?.recognized===false)return {state:'unresolved',label:'Columns not recognised',note:`Read ${table.recognition.readRowCount} rows, columns not recognised: ${table.headers.join(', ')}.`,method:'Tabular content',pageCount:null,readPageCount:null,complete:false};
    const complete=document.parserState==='parsed';
    return {state:complete?'read':'partial',label:complete?'Source rows read':'Source reading not complete',note:`${table.rows.length} rows and ${table.headers.length} fields read from the source. Field completeness, validation, mapping and adoption are checked separately.`,method:'Tabular content',pageCount:null,readPageCount:null,complete};
  }
  const schedule = state.schedules.find(row => row.sourceHashSha256 === hash &&
    row.revision.revisionId === document.linkedArtifactId);
  if (schedule) {
    const model = schedule.revision.model;
    const unresolvedCalendars = model.calendars.filter(calendar => !calendar.semanticComplete).length;
    const complete=document.parserState==='parsed'&&schedule.sourceHashSha256===hash&&model.activities.length>0;
    return {state:complete?'read':'partial',label:complete?'Schedule rows read':'Schedule reading needs review',
      note:`${model.activities.length} activities and ${model.relationships.length} relationships read. ${unresolvedCalendars} calendar definitions need review. Schedule completeness, calendar semantics and comparison authority are assessed separately.`,
      method:'Schedule parser',pageCount:null,readPageCount:null,complete};
  }
  if (/pdf/i.test(document.mediaType ?? '') && document.parserState !== 'error') {
    return {state:'partial',label:'Full-page coverage unresolved',
      // SW-46: "identification or extraction is available" only when the document carries one.
      note:conditionalNotice(Boolean(document.identification)||document.parserState==='parsed','Document identification or structured extraction is available, but no matching complete page-reading receipt is retained.','No document identification, structured extraction or complete page-reading receipt is retained.')+' This does not establish that every page was read or that every fact was extracted.',
      method:document.identification?.method ?? null,pageCount:document.identification?.pageCount ?? null,readPageCount:null,complete:false};
  }
  if(/^text\//.test(document.mediaType)&&!/csv/.test(document.mediaType)){
    try{
      const bytes=readFileSync(document.storedPath);
      if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('SOURCE_HASH_MISMATCH');
      const text=bytes.toString(bytes[0]===0xff&&bytes[1]===0xfe?'utf16le':'utf8');
      return {state:'read',label:'Reference text read',note:`${text.length} characters read from the matching source file. Reference reading does not establish numeric or contractual authority.`,method:'Text',pageCount:null,readPageCount:null,complete:true};
    }catch{return {state:'unresolved',label:'Reference reading unresolved',note:'The stored source could not be read and matched to its recorded hash.',method:'Text',pageCount:null,readPageCount:null,complete:false};}
  }
  return {state:document.parserState,label:null,note:null,method:null,pageCount:document.identification?.pageCount??null,readPageCount:null,complete:false};
}

/** SW-14 / R3: one reading state per uploaded document, so no document sits
 * unread without saying so. Deferred PDF reading is tracked per process: the
 * background reader marks a document queued, reading and done. Every PDF that
 * is not fully read is tried again each time the project server starts
 * (server startup refresh, or the project worker's idle queue). */
export type DocumentReadingState='read'|'reading'|'queued'|'partial'|'not_read';
export type DocumentReadingReason='ocr_off'|'ai_off'|'ai_not_run'|'unsupported_format'|'failed'|'incomplete'|'no_reader'|null;
export type DocumentReadingStatus={state:DocumentReadingState;label:string;reasonCode:DocumentReadingReason;reason:string|null;readBy:string|null;when:string|null};
// Keyed by document id and source hash: the stored document object can be
// replaced by a later state rebuild, but the same source bytes keep this key.
const deferredReading=new Map<string,'queued'|'reading'|'done'>();
const readingKey=(document:StoredEvidenceDocument)=>document.documentId+'|'+document.sourceHashSha256;
export function noteDeferredReading(document:StoredEvidenceDocument,state:'queued'|'reading'|'done'){
  deferredReading.set(readingKey(document),state);
}
const awaitingAiStatuses=new Set(['disabled','provider_unavailable','call_limit','stopped_at_cap','provider_error','invalid_response','failed']);
const PDF_READER='Background PDF reader (text layer first, then OCR for pages without text)';
const NEXT_START='Next time the project server starts (every PDF not fully read is tried again then)';
const READING_LABELS:Record<DocumentReadingState,string>={read:'Read',reading:'Reading now',queued:'Queued for reading',partial:'Partly read',not_read:'Not read'};
export function documentReadingStatus(document:StoredEvidenceDocument,review:{state:string;note:string|null;pageCount:number|null;readPageCount:number|null},
  setup:{ocrEnabled:boolean;aiSetUp:boolean}):DocumentReadingStatus{
  const hash=document.sourceHashSha256;
  const out=(state:DocumentReadingState,reasonCode:DocumentReadingReason,reason:string|null,readBy:string|null,when:string|null)=>({state,label:READING_LABELS[state],reasonCode,reason,readBy,when});
  const diagnostics=document.diagnostics??[];
  const failure=diagnostics.find(code=>code.startsWith('DEFERRED_PDF_REFRESH_FAILED:'))??null;
  const ocrOffCode=diagnostics.find(code=>/^(?:DOCUMENT_OCR_REQUIRED_BUT_DISABLED|DOCUMENT_IMAGE_OCR_DISABLED)/.test(code))??null;
  const aiSteps=(document.semanticAiSteps??[]).filter(step=>step.sourceHashSha256===hash);
  const aiWaiting=aiSteps.filter(step=>awaitingAiStatuses.has(step.status)).length;
  const pages=review.pageCount!==null&&review.readPageCount!==null?review.readPageCount+' of '+review.pageCount+' pages read. ':'';
  if(review.state==='read'||review.state==='parsed'){
    const aiUnresolved=aiSteps.filter(step=>step.status==='unresolved'||step.status==='source_read_failed').length;
    if(aiWaiting===0&&aiUnresolved>0)return out('partial','incomplete',aiUnresolved+' of '+aiSteps.length+' source steps could not be resolved and need review.',null,'No automatic retry is scheduled; the unread part needs review');
    if(aiWaiting===0)return out('read',null,null,null,null);
    return setup.aiSetUp
      ?out('partial','ai_not_run',aiWaiting+' of '+aiSteps.length+' source steps still need AI reading. AI is set up, but the owner must allow paid calls first.','AI reading','After the owner allows paid AI calls')
      :out('partial','ai_off',aiWaiting+' of '+aiSteps.length+' source steps need AI reading, and AI is not set up.',null,'Not until AI is set up');
  }
  if(/pdf/i.test(document.mediaType??'')){
    const here=deferredReading.get(readingKey(document))??null;
    if(here==='reading'||running.has(document))return out('reading',null,pages||null,PDF_READER,'Now');
    if(here==='queued')return out('queued',null,null,PDF_READER,'In this server session: one PDF at a time, when no page requests are running');
    if(here===null&&!failure)return out('queued',null,null,PDF_READER,NEXT_START);
    const readSome=(review.readPageCount??0)>0;
    if(failure)return out(readSome?'partial':'not_read','failed',pages+'The background reader failed: '+failure.split(':').slice(2).join(':').slice(0,200),PDF_READER,NEXT_START);
    if(!setup.ocrEnabled)return out(readSome?'partial':'not_read','ocr_off',pages+'OCR is turned off, so pages without a text layer are not read.',null,'Not until OCR is turned on');
    return out(readSome?'partial':'not_read','incomplete',pages+(review.note??'Some pages could not be read and need review.'),PDF_READER,NEXT_START);
  }
  if(document.parserState==='unsupported')return out('not_read','unsupported_format','CMeng has no reader for this file format ('+(document.mediaType||'unknown type')+'). The file is kept, but its content is not read.',null,'Will not be read');
  if(ocrOffCode&&!setup.ocrEnabled)return out('not_read','ocr_off','This file needs OCR, and OCR is turned off.',null,'Not until OCR is turned on');
  if(document.parserState==='error'||review.state==='unresolved'&&/could not be read/.test(review.note??''))
    return out('not_read','failed','Reading failed'+(diagnostics.length?': '+diagnostics[diagnostics.length-1]!.slice(0,200):'.'),null,'No automatic retry is scheduled');
  // A reading receipt exists but is incomplete: say what was read.
  if(review.note!==null&&(review.state==='partial'||review.state==='unresolved'))return out('partial','incomplete',review.note,null,'No automatic retry is scheduled; the unread part needs review');
  if(document.parserState==='ocr_pending')return out('not_read','no_reader','This file needs OCR, but the background reader only reads PDFs.',null,'Will not be read');
  // No reading receipt: no reader has read this content, whatever the upload state says.
  const sampled=(document.identification?.extractedCharacterCount??0)>0;
  return out('not_read','no_reader',sampled
    ?'No reader for this file type has read its full content. Only a short text sample was used to identify it.'
    :'No reader for this file type has read its content. CMeng recognised it from its name and file type only.',null,'Will not be read');
}

/** Counts and the deferred list for the documents page and the project overview. */
export function documentReadingSummary(rows:ReadonlyArray<{documentId:string;sourceFilename:string;readingStatus:DocumentReadingStatus}>){
  const count=(state:DocumentReadingState)=>rows.filter(row=>row.readingStatus.state===state).length;
  const read=count('read'),reading=count('reading'),queued=count('queued'),partial=count('partial'),notRead=count('not_read');
  const unreadCount=rows.length-read;
  return {total:rows.length,read,reading,queued,partial,notRead,unreadCount,
    statement:unreadCount===0?null:unreadCount+' of '+rows.length+' documents are not fully read: '+
      [[reading,'reading now'],[queued,'queued'],[partial,'partly read'],[notRead,'not read']].filter(([n])=>Number(n)>0).map(([n,t])=>n+' '+t).join(', ')+'.',
    unread:rows.filter(row=>row.readingStatus.state!=='read').map(row=>({documentId:row.documentId,sourceFilename:row.sourceFilename,...row.readingStatus}))};
}

export type DocumentReadingSummary=ReturnType<typeof documentReadingSummary>;
/** The single entry point used by the documents register and the overview. */
export function projectDocumentReading(state:ProjectRuntimeState,setup:{ocrEnabled:boolean;aiSetUp:boolean},tables?:readonly SourceTable[]){
  const parsed=tables??sourceTables(state.evidenceDocuments,[],{includeHistorical:true});
  const byDocument=new Map<string,DocumentReadingStatus>();
  const rows=state.evidenceDocuments.map(document=>{
    const readingStatus=documentReadingStatus(document,documentReadReview(document,state,parsed),setup);
    byDocument.set(document.documentId,readingStatus);
    return {documentId:document.documentId,sourceFilename:document.sourceFilename,readingStatus};
  });
  return {byDocument,summary:documentReadingSummary(rows)};
}
export function readingSetup(env:NodeJS.ProcessEnv=process.env,aiSetUp:boolean){
  return {ocrEnabled:env.CMENG_OCR_ENABLED?.trim()!=='0',aiSetUp};
}

const running=new WeakMap<StoredEvidenceDocument,Promise<boolean>>();
/** Finish deferred physical reading without promoting a document or inventing facts. */
export function refreshDeferredPdfRead(document:StoredEvidenceDocument,createProvider:()=>OcrProvider|undefined,onPageRead?:(pageNumber:number,totalPages:number)=>void,onCheckpoint?:()=>void):Promise<boolean>{
  const prior=running.get(document);if(prior)return prior;
  const work=(async()=>{
    if(!/pdf/i.test(document.mediaType)||
      (document.fullTextRead?.sourceHashSha256===document.sourceHashSha256&&physicalPdfCoverage(document.fullTextRead.result).complete))return false;
    const hash=document.sourceHashSha256,bytes=readFileSync(document.storedPath);
    if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('DEFERRED_PDF_SOURCE_HASH_MISMATCH');
    const provider=createProvider();
    const retained=document.fullTextReadCheckpoint?.sourceHashSha256===hash?document.fullTextReadCheckpoint.pages:
      document.fullTextRead?.sourceHashSha256===hash?document.fullTextRead.result.pages:[];
    // Keep source-legible pages with unresolved AI review in the checkpoint.
    // A provider-free retry must retain the review_required state, not
    // manufacture accepted reading from the same physical source bytes.
    const reusable=retained.filter(legiblePdfPageEvidence);
    const pages=new Map(reusable.map(page=>[page.pageNumber,page]));
    let newPages=0;
    const result=await parsePdfDocument(bytes,{...(provider?{ocrProvider:provider}:{}),
      checkpoint:{completedPages:reusable.map(page=>page.pageNumber),persistedPages:reusable},
      onPageRead:(page,total)=>{
        if(document.sourceHashSha256!==hash)throw new Error('DEFERRED_PDF_SOURCE_CHANGED');
        if(pages.get(page.pageNumber)!==page){
          pages.set(page.pageNumber,page);newPages++;
          document.fullTextReadCheckpoint={sourceHashSha256:hash,updatedAt:new Date().toISOString(),totalPages:total,pages:[...pages.values()].sort((a,b)=>a.pageNumber-b.pageNumber)};
          if(newPages===1||newPages%5===0||page.pageNumber===total)onCheckpoint?.();
        }
        onPageRead?.(page.pageNumber,total);
      }});
    if(document.sourceHashSha256!==hash)throw new Error('DEFERRED_PDF_SOURCE_CHANGED');
    delete document.fullTextReadCheckpoint;
    document.fullTextRead={producerVersion:'full-page-read-v1',sourceHashSha256:hash,completedAt:new Date().toISOString(),result};
    return true;
  })();
  running.set(document,work);void work.finally(()=>running.delete(document)).catch(()=>{});return work;
}
