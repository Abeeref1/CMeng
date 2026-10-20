import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {readContractText} from '../../contract-parser/src';
import {evidenceFamily} from './evidence-control';
import type {EvidenceParserState,ProjectRuntimeState,StoredContractDocument,StoredEvidenceDocument} from './project-state-types';
import {READING_STATE_VERSION,contractReadingState,contractRoleForDocumentType,contractTextFormat,referenceTextMedia,wholeTextRead} from './reading-state';

/** R3 start-up refresh, once per document and source hash (versioned, like the
 * stored programme calendar refresh). A stored document gets the reading state
 * of the shared rule: read completely when its whole source was read, with a
 * missing contract clause structure kept as a separate review note.
 * - a contract with a stored contract reading: its state is taken from that
 *   reading (no file is read again);
 * - a reference text file: its unchanged source bytes are decoded again;
 * - a text contract stored before text contracts were read: its unchanged
 *   source bytes are read by the contract text reader (no AI).
 * Document identity, basis state, authority, decisions and source bytes stay
 * as they are; the earlier state is kept on the receipt. Nothing is removed. */
export function refreshStoredReadingStates(state:ProjectRuntimeState):{changed:boolean;contractsRead:StoredContractDocument[]}{
  let changed=false;
  const contractsRead:StoredContractDocument[]=[];
  const receipt=(document:StoredEvidenceDocument,previousParserState:EvidenceParserState,contractTextRead:boolean)=>{
    document.readingStateRefresh={producerVersion:READING_STATE_VERSION,sourceHashSha256:document.sourceHashSha256,
      refreshedAt:new Date().toISOString(),previousParserState,contractTextRead};
    changed=true;
  };
  const setState=(document:StoredEvidenceDocument,next:ReturnType<typeof contractReadingState>)=>{
    document.parserState=next.parserState;
    if(next.structureReview)document.structureReview=next.structureReview;else delete document.structureReview;
  };
  for(const document of state.evidenceDocuments){
    const hash=document.sourceHashSha256;
    if(document.readingStateRefresh?.producerVersion===READING_STATE_VERSION&&document.readingStateRefresh.sourceHashSha256===hash)continue;
    // A failed deferred page reading keeps its own state and retry.
    if((document.diagnostics??[]).some(code=>code.startsWith('DEFERRED_PDF_REFRESH_FAILED:')))continue;
    const contract=state.contractDocuments.find(c=>c.documentId===document.documentId&&c.sourceHashSha256===hash);
    if(document.category==='contract'&&contract){
      if(document.parserState!=='parsed'&&document.parserState!=='partial')continue;
      const next=contractReadingState(contract.result,hash);
      const review=(value:StoredEvidenceDocument['structureReview'])=>value?value.sourceHashSha256+'|'+value.note:'';
      if(next.parserState===document.parserState&&review(next.structureReview)===review(document.structureReview))continue;
      const previous=document.parserState;
      setState(document,next);receipt(document,previous,false);
      continue;
    }
    if((document.parserState!=='identified'&&document.parserState!=='partial')||document.identification?.method==='unreadable')continue;
    const format=document.category==='contract'&&!contract&&document.identification?.method==='native_text'
      ?contractTextFormat(document.mediaType,document.sourceFilename):null;
    // Same family behaviour as the evidence basis rule (applyEvidenceBasis).
    const reference=!format&&document.category!=='contract'&&referenceTextMedia(document.mediaType)&&evidenceFamily({category:document.category,
      documentType:document.documentType,scheduleRole:document.scheduleRole,textSample:document.assertions.map(a=>a.sourceText).join('\n'),
      sourceFilename:document.sourceFilename}).behavior==='reference';
    if(!format&&!reference)continue;
    if(!document.storedPath||!existsSync(document.storedPath))continue;
    let bytes:Buffer;
    try{bytes=readFileSync(document.storedPath);}catch{continue;}
    if(createHash('sha256').update(bytes).digest('hex')!==hash)continue;
    if(!format){
      const next:EvidenceParserState=wholeTextRead(bytes)?'parsed':'partial';
      if(next===document.parserState)continue;
      const previous=document.parserState;
      document.parserState=next;receipt(document,previous,false);
      continue;
    }
    // The same contract text reader as an upload, from the unchanged bytes.
    const result=readContractText(bytes,format);
    const stored:StoredContractDocument={documentId:document.documentId,role:contractRoleForDocumentType(document.documentType),
      sourceFilename:document.sourceFilename,sourceHashSha256:hash,uploadedAt:document.uploadedAt,lineage:document.lineage,result};
    state.contractDocuments.push(stored);contractsRead.push(stored);
    const previous=document.parserState;
    setState(document,contractReadingState(result,hash));
    document.linkedArtifactId=document.documentId;
    document.semanticAiSteps=[...(document.semanticAiSteps??[]),{sheetName:'Contract headings',sourceHashSha256:hash,status:'disabled',attempted:false,
      note:'AI heading reading was not requested; the rule-based contract reading remains the basis.'}];
    document.diagnostics=[...document.diagnostics,...result.diagnostics.filter(code=>!document.diagnostics.includes(code))];
    receipt(document,previous,true);
  }
  return {changed,contractsRead};
}
