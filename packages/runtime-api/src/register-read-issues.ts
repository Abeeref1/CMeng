import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceTables,csv,prepareRegisterRows} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
export interface RegisterReadIssue {documentId:string;documentType:string;filename:string;rowCount:number|null;columns:string[];message:string;}
const cache=new WeakMap<ProjectRuntimeState,{version:number;issues:RegisterReadIssue[]}>();
function collect(state:ProjectRuntimeState):RegisterReadIssue[]{
 const tables=sourceTables(state.evidenceDocuments,[]);
 const issues:RegisterReadIssue[]=tables.filter(t=>t.recognition?.recognized===false).map(t=>({documentId:t.document.documentId,documentType:t.document.documentType??'',filename:t.document.sourceFilename,rowCount:t.recognition!.readRowCount,columns:t.headers,message:'Read '+t.recognition!.readRowCount+' rows, columns not recognised: '+t.headers.join(', ')}));
 for(const d of state.evidenceDocuments){
  if(!['active','additive','candidate'].includes(d.basisState)||!/csv|spreadsheetml/.test(d.mediaType)||tables.some(t=>t.document.sourceHashSha256===d.sourceHashSha256))continue;
  try{
   const bytes=readFileSync(d.storedPath);if(createHash('sha256').update(bytes).digest('hex')!==d.sourceHashSha256)throw new Error('File content could not be verified.');
   const sheets=d.tabularRead?.sourceHashSha256===d.sourceHashSha256?d.tabularRead.sheets:[{name:'CSV',rows:csv(bytes.toString(bytes[0]===255&&bytes[1]===254?'utf16le':'utf8'))}];
   for(const sheet of sheets){const p=prepareRegisterRows(sheet.rows,d.documentType);issues.push({documentId:d.documentId,documentType:d.documentType,filename:d.sourceFilename,rowCount:p.readRowCount,columns:p.rawHeaders,message:'Read '+p.readRowCount+' rows, columns not recognised: '+p.rawHeaders.join(', ')+'. Check duplicate or missing headings and inconsistent row widths.'});}
  }catch(error){issues.push({documentId:d.documentId,documentType:d.documentType,filename:d.sourceFilename,rowCount:null,columns:[],message:'Unresolved: '+(error instanceof Error?error.message:'The register could not be read.')});}
 }
 return issues;
}
export function registerReadIssues(state:ProjectRuntimeState){const old=cache.get(state);if(old?.version===state.version)return old.issues;const issues=collect(state);cache.set(state,{version:state.version,issues});return issues;}
export function registerReadIssuesForModule(state:ProjectRuntimeState,key:string){
 const pattern=key==='notices-claims'||key==='commercial-claims-notices'?/claim|determination|notice/:key==='payments'||key==='cash-flow'?/payment|certificate/:key==='variations-change'?/variation/:null;
 return pattern?registerReadIssues(state).filter(r=>pattern.test(r.documentType)):[];
}
