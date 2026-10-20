import type {ContractDocumentResult} from '../../contract-parser/src';
import {parseContractTextSource} from '../../contract-parser/src';
import type {EvidenceParserState,StoredEvidenceDocument} from './project-state-types';

/** R3, one rule for every reader: parserState says only whether the whole
 * source was read (every byte of a text file, every page of a PDF, every
 * paragraph of a Word file). What the source does not establish, such as a
 * contract whose clause numbering is missing, is a separate review note
 * (structureReview); it never makes a fully read file 'partial'. Reading
 * never adopts a document or any of its terms. */
export const READING_STATE_VERSION='whole-source-read-v1';

/** The review note for a contract read in full whose clause structure is not established. */
export function contractStructureNote(result:Pick<ContractDocumentResult,'clauses'|'semanticComplete'>):string|null{
  if(result.semanticComplete)return null;
  return result.clauses.length===0
    ?'No numbered clauses were found, so the clause structure needs review.'
    :'The clause structure needs review.';
}

/** Reading state of a contract document from its contract reading. */
export function contractReadingState(result:ContractDocumentResult,sourceHashSha256:string):{parserState:EvidenceParserState;structureReview:StoredEvidenceDocument['structureReview']}{
  const note=result.physicalComplete?contractStructureNote(result):null;
  return {parserState:result.physicalComplete?'parsed':'partial',structureReview:note?{sourceHashSha256,note}:null};
}

/** Plain text kept as a reference (not CSV, XER or XML, which have their own readers). */
export function referenceTextMedia(mediaType:string):boolean{
  return /^text\//i.test(mediaType)&&!/csv|tab-separated|xer|xml/i.test(mediaType);
}

/** Whether every byte of a text file was read (the shared text decoder). */
export function wholeTextRead(bytes:Uint8Array):boolean{
  return parseContractTextSource(bytes).complete;
}

/** Apply the contract reading state to its evidence document. */
export function applyContractReadingState(document:StoredEvidenceDocument,result:ContractDocumentResult){
  const next=contractReadingState(result,document.sourceHashSha256);
  document.parserState=next.parserState;
  if(next.structureReview)document.structureReview=next.structureReview;else delete document.structureReview;
}

/** A plain-text or Markdown source. The media type decides; the file name only
 * tells Markdown from plain text, or names an untyped upload. CSV, XER, XML and
 * every other typed content keep their own readers. */
export function contractTextFormat(
  mediaType: string,
  filename: string,
): "plain" | "markdown" | null {
  const media = mediaType.toLowerCase().trim();
  const name = filename.trim().toLowerCase();
  const untyped = media === "" || media.startsWith("application/octet-stream");
  if (/^text\/(?:x-)?markdown\b/.test(media)) return "markdown";
  if (!untyped && !/^text\/plain\b/.test(media)) return null;
  if (/\.(?:md|markdown)$/.test(name)) return "markdown";
  return untyped && !/\.txt$/.test(name) ? null : "plain";
}

/** The contract document role for an identified contract document type. */
export function contractRoleForDocumentType(documentType:string):"main"|"amendment"|"appendix"|"replacement"|"other"{
  return documentType==='main_contract'?'main'
    :documentType==='contract_amendment'?'amendment'
    :documentType==='contract_appendix'?'appendix'
    :documentType==='contract_replacement'?'replacement'
    :'other';
}
