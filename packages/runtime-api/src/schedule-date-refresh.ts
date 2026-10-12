import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseScheduleCsv,parseScheduleXlsx} from '../../schedule-tabular-parser/src';
import {canonicalScheduleFromTabular} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';

export const TABULAR_DATE_READER_VERSION='activity-date-columns-v1';

/** Re-read only programme-date facts from the retained, hash-verified source.
 * Existing activity facts, identities, source bytes and adoption decisions stay intact. */
export async function refreshTabularScheduleDates(state:ProjectRuntimeState){
 let refreshedDocumentCount=0;const diagnostics:string[]=[];
 for(const scope of [state,...(state.phaseProgrammes??[])])for(const stored of scope.schedules){
  if(!['schedule_csv','schedule_xlsx'].includes(stored.format)||stored.tabularDateReaderVersion===TABULAR_DATE_READER_VERSION)continue;
  const source=scope.evidenceDocuments.find(d=>d.sourceHashSha256===stored.sourceHashSha256);
  if(!source){diagnostics.push('SCHEDULE_DATE_REFRESH_SOURCE_UNAVAILABLE:'+stored.revision.revisionId);continue;}
  try{
   const bytes=readFileSync(source.storedPath);
   if(createHash('sha256').update(bytes).digest('hex')!==stored.sourceHashSha256)throw new Error('SOURCE_HASH_MISMATCH');
   const parsed=stored.format==='schedule_xlsx'?await parseScheduleXlsx(bytes):parseScheduleCsv(bytes);
   const recovered=canonicalScheduleFromTabular(parsed,{sourceRevisionId:stored.revision.revisionId,projectId:state.projectId});
   const previousDataDateIso=stored.revision.model.dataDateIso;
   const dateDiagnostics=recovered.diagnostics.filter(d=>d.startsWith('SCHEDULE_DATA_DATE_'));
   stored.revision.model={...stored.revision.model,dataDateIso:recovered.dataDateIso,
    diagnostics:[...stored.revision.model.diagnostics.filter(d=>!d.startsWith('SCHEDULE_DATA_DATE_')),...dateDiagnostics]};
   stored.revision.effectiveAt=recovered.dataDateIso??stored.uploadedAt;
   stored.tabularDateReaderVersion=TABULAR_DATE_READER_VERSION;
   stored.dataDateReadRefresh={readerVersion:TABULAR_DATE_READER_VERSION,sourceHashSha256:stored.sourceHashSha256,
    refreshedAt:new Date().toISOString(),previousDataDateIso,dataDateIso:recovered.dataDateIso,diagnostics:dateDiagnostics};
   refreshedDocumentCount++;
  }catch(error){diagnostics.push('SCHEDULE_DATE_REFRESH_UNRESOLVED:'+stored.revision.revisionId+':'+String(error));}
 }
 return {refreshedDocumentCount,diagnostics};
}
