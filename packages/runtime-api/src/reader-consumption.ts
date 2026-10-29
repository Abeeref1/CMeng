import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {ProjectRuntimeState,StoredEvidenceDocument} from './project-state-types';
import {canonicalTimeClaims,projectDataDate} from './canonical-time-claims';
import {commercialCanonical} from './commercial-canonical';
import {operationalControlsAsOf} from './operational-reporting';
import {deliveryRecords} from './delivery-records';
import {consumedColumnsFor,forgetConsumedColumns,registerReaderColumns,sourceTables} from '../../truth-kernel/src';
import {registerCsv} from './register-workbook';
import {deliveryDocumentKinds} from '../../delivery-core/src/reader-columns';

/** M2.1: run the shared register readers for the current project version, so
 * the column report reflects what each reader consumed. Each reader is cached
 * per project version; this only reads what has not been read yet. */
export function runRegisterReaders(state:ProjectRuntimeState,documentTypes?:readonly string[]):void{
  // The readers that read these document types (all of them when the types are not given or not known).
  const types=(documentTypes??[]).join(' ').toLowerCase();
  const wanted={time:/delay|eot|claim|determination|notice|letter|correspond|contract/.test(types),
    commercial:/payment|certificate|variation|cost|evm|bond|insurance|retention|security|invoice|cash|budget|commit|boq|commercial/.test(types),
    operational:/ncr|rfi|risk|hse|incident|quality|design|submittal|procurement|testing|commissioning/.test(types),
    delivery:(documentTypes??[]).some(type=>Boolean((deliveryDocumentKinds as Record<string,unknown>)[type]))};
  const any=!documentTypes||!Object.values(wanted).some(Boolean);
  const readers:Array<[boolean,()=>unknown]>=[[wanted.time,()=>canonicalTimeClaims(state)],[wanted.commercial,()=>commercialCanonical(state)],
    [wanted.operational,()=>operationalControlsAsOf(state,projectDataDate(state))],[wanted.delivery,()=>deliveryRecords(state)]];
  for(const [use,read] of readers){
    if(!any&&!use)continue;
    try{read();}catch{/* a reader that cannot run reads nothing; its columns stay not used */}
  }
}

/** M2.1: the one reader interpretation of a table: the canonical columns a CMeng
 * reader consumed for this document (recorded by the shared cell reader), plus
 * the columns of the record readers that read whole records. The column report
 * and the upload-time AI gate both use this; the recognition word list never
 * decides that a column is read. */
export function readerConsumedColumns(_state:ProjectRuntimeState|null,documentId:string,headers:readonly string[],documentType:string):Set<string>{
  return new Set([...consumedColumnsFor(documentId),...registerReaderColumns(headers,documentType).keys()]);
}

/** M2.1 (upload): the same interpretation for a table that is being uploaded.
 * The shared readers run on a scratch copy of the project holding only this
 * table (the project itself is not changed), then the consumed columns are read
 * exactly as the column report reads them. Returns the canonical headers and the
 * columns with values that no reader consumed. */
export function uploadReaderInterpretation(base:ProjectRuntimeState,input:{rows:readonly string[][];documentType:string;category:string;sheetName:string;meanings?:ReadonlyArray<{columnIndex:number}>}):
  {headers:string[];consumed:Set<string>;unconsumed:Array<{columnIndex:number;rawHeader:string}>;recognized:boolean}{
  const text=registerCsv(input.rows);
  const dir=mkdtempSync(join(tmpdir(),'cmeng-upload-reading-'));
  const documentId='upload-reading-'+createHash('sha256').update(text+'\u0000'+input.sheetName+'\u0000'+input.documentType).digest('hex').slice(0,24);
  try{
    const path=join(dir,'table.csv');writeFileSync(path,text);
    const doc={documentId,sourceFilename:input.sheetName+'.csv',sourceRelativePath:null,storedPath:path,sourceHashSha256:createHash('sha256').update(text).digest('hex'),
      mediaType:'text/csv',sizeBytes:Buffer.byteLength(text),basisState:'active',linkedArtifactId:null,category:input.category,documentType:input.documentType,
      familyKey:documentId,logicalDocumentKey:documentId,uploadedAt:new Date(0).toISOString(),diagnostics:[],assertions:[],authority:'candidate_only',parserState:'parsed',
      scheduleRole:null,mapping:null,uploadIntent:'add_update',supersedesDocumentIds:[],supersededByDocumentId:null,identification:{},lineage:{}} as unknown as StoredEvidenceDocument;
    // The readers see a copy of the project's controls without the large derived
    // readiness map (no register reader reads it), so the project is never changed.
    const scratch={...base,projectId:base.projectId+'::upload-reading',evidenceDocuments:[doc],controls:structuredClone({...base.controls,readinessEvidence:{}}),version:base.version+1} as ProjectRuntimeState;
    forgetConsumedColumns(documentId);
    runRegisterReaders(scratch,[input.documentType]);
    // The same table reading the column report uses (sourceTables), never a second parse.
    const table=sourceTables([doc],[])[0];
    if(!table)return {headers:[],consumed:new Set(),unconsumed:[],recognized:false};
    const consumed=readerConsumedColumns(scratch,documentId,table.headers,input.documentType);
    const answered=new Set((input.meanings??[]).map(m=>m.columnIndex));
    const raw=table.intelligence.columns.map(column=>column.rawHeader);
    const unconsumed=raw.map((rawHeader,columnIndex)=>({rawHeader,columnIndex}))
      .filter(({columnIndex})=>!answered.has(columnIndex)&&!consumed.has(table.headers[columnIndex]??'')&&table.rows.some(row=>Boolean(String(row.cells[table.headers[columnIndex]??'']??'').trim())));
    return {headers:[...table.headers],consumed,unconsumed,recognized:table.recognition?.recognized!==false};
  }finally{
    forgetConsumedColumns(documentId);
    rmSync(dir,{recursive:true,force:true});
  }
}
