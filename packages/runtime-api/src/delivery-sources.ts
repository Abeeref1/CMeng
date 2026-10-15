import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeEvidenceTable,sourceTables,csv,canonicalHeader,type SourceTable} from '../../truth-kernel/src';
import {kindIdentities} from '../../delivery-core/src/types';
import type {ProjectRuntimeState} from './project-state-types';

/** Reuse retained native/OCR pages. Only explicit tabular or labelled fields are
 * extracted. Prose, damaged columns and unread pages remain review requirements. */
export function deliverySourceTables(state:ProjectRuntimeState,diagnostics:string[]):SourceTable[]{
 const tables=sourceTables(state.evidenceDocuments,diagnostics,{includeHistorical:true});
 const identities=new Set(Object.values(kindIdentities).flat().map(v=>canonicalHeader(v)));
 for(const document of state.evidenceDocuments){
  const read=document.fullTextRead;if(!read||read.sourceHashSha256!==document.sourceHashSha256||tables.some(t=>t.document.documentId===document.documentId))continue;
  try{if(createHash('sha256').update(readFileSync(document.storedPath)).digest('hex')!==document.sourceHashSha256){diagnostics.push('SOURCE_HASH_MISMATCH:'+document.documentId);continue;}}
  catch{diagnostics.push('SOURCE_READ_FAILURE:'+document.documentId);continue;}
  // A PDF table may continue on the next physical page without repeating
  // its column header. Retain the last recognized header only for adjacent
  // readable pages; retain the original page/line for every continued row.
  let carryHeaders:string[]|null=null,carrySeparator:string|null=null,previousPage:number|null=null;
  for(const page of read.result.pages){
   if(!['native','ocr'].includes(page.method)||!page.text.trim())continue;
   const rows:Array<{line:number;cells:Record<string,string>}>=[];
   const adjacent=previousPage!==null&&page.pageNumber===previousPage+1;
   const lines=page.text.split(/\r?\n/);
   let headers:string[]|null=adjacent&&carryHeaders?[...carryHeaders]:null;
   let separator:string|null=adjacent?carrySeparator:null;
   let lastParsedRow=false;
   for(let i=0;i<lines.length;i++){
    const line=lines[i]!.trim();if(!line)continue;
    const sep=line.includes('\t')?'\t':line.includes('|')?'|':line.includes(',')?',':null;
    let values:string[]=[];
    if(sep===','){
     try{values=csv(line)[0]??[];}
     catch{
      // PDF prose can legitimately contain commas plus unmatched quotation marks
      // (for example inch marks). It is not CSV until a delivery table header has
      // actually been established. Once inside a comma table, keep the damaged
      // row visible as a review requirement instead of aborting the whole project.
      if(headers&&separator===',')diagnostics.push('DELIVERY_PAGE_ROW_REQUIRES_REVIEW:'+document.documentId+':page:'+page.pageNumber+':line:'+(i+1));
      continue;
     }
    }else if(sep)values=line.split(sep).map(s=>s.trim());
    const keys=values.map(v=>canonicalHeader(v));
    if(keys.some(k=>identities.has(k))&&keys.length>=2&&new Set(keys).size===keys.length){headers=keys;separator=sep;lastParsedRow=false;continue;}
    if(headers&&sep===separator&&values.length===headers.length){
     // Continuation is permitted only when a source identity column remains
     // populated. A page heading, footer or prose with separators is not a
     // delivery record and must not silently become a source fact.
     const identityColumns=headers.flatMap((h,index)=>identities.has(h)?[index]:[]);
     const identified=identityColumns.some(index=>String(values[index]??'').trim());
     if(!identified){diagnostics.push('DELIVERY_PAGE_ROW_IDENTITY_MISSING:'+document.documentId+':page:'+page.pageNumber+':line:'+(i+1));continue;}
     rows.push({line:i+1,cells:Object.fromEntries(headers.map((h,j)=>[h,values[j]!]))});lastParsedRow=true;
    }
    else if(headers&&sep===separator){diagnostics.push('DELIVERY_PAGE_ROW_REQUIRES_REVIEW:'+document.documentId+':page:'+page.pageNumber+':line:'+(i+1));}
   }
   // Only a table with an actual final record can supply the next page's
   // header. A different page number, unread page or non-table page breaks it.
   carryHeaders=lastParsedRow&&headers?[...headers]:null;
   carrySeparator=lastParsedRow?separator:null;
   previousPage=page.pageNumber;
   if(!rows.length){
    const cells:Record<string,string>={};let first=0,ambiguous=false;
    lines.forEach((line,index)=>{const match=/^\s*([^:]{2,80}):\s*(.+)$/.exec(line);if(!match)return;const key=canonicalHeader(match[1]!);if(Object.hasOwn(cells,key))ambiguous=true;cells[key]=match[2]!.trim();if(!first)first=index+1;});
    if(!ambiguous&&Object.keys(cells).some(k=>identities.has(k))&&Object.keys(cells).length>=2)rows.push({line:first,cells});
   }
   if(rows.length){
    const headers=[...new Set(rows.flatMap(r=>Object.keys(r.cells)))];
    const intelligence=analyzeEvidenceTable([headers,...rows.map(r=>headers.map(h=>r.cells[h]??''))]);
    tables.push({document,headers,intelligence,rows:rows.map(r=>({cells:r.cells,receipt:{documentId:document.documentId,sourceHash:document.sourceHashSha256,revision:document.linkedArtifactId??document.sourceHashSha256,locator:'page:'+page.pageNumber+':line:'+r.line,basisState:document.basisState,authority:'source_record'}}))});
   }
  }
  if(!read.result.complete)diagnostics.push('DELIVERY_PHYSICAL_PAGE_COVERAGE_INCOMPLETE:'+document.documentId);
 }
 return tables;
}
