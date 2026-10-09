import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {canonicalScheduleFromXer} from '../../schedule-analysis-core/src';
import {parseXerBytes} from '../../xer-parser/src';
import type {ProjectRuntimeState} from './project-state-types';

export const XER_CALENDAR_READER_VERSION='p6-record-separators-v2-dated-reconciliation';
const isCalendarDiagnostic=(value:string)=>value.startsWith('CALENDAR_');

/** Reread only failed calendar interpretations from the unchanged retained
 * source. Activity values, revision identities, selections and approvals stay
 * under their existing authorities. Includes separately governed phases. */
export function refreshStoredXerCalendars(state:ProjectRuntimeState):boolean {
  let changed=false;
  for(const scope of [state,...state.phaseProgrammes??[]])for(const stored of scope.schedules){
    const old=stored.revision.model;
    if(stored.format!=='xer'||stored.calendarReaderVersion===XER_CALENDAR_READER_VERSION||
       !old.diagnostics.some(d=>/CALENDAR_DATA_SYNTAX_ERROR:|CALENDAR_(?:WEEK|DAY)_HOURS_MISMATCH:/.test(d)))continue;
    const document=scope.evidenceDocuments.find(d=>d.linkedArtifactId===stored.revision.revisionId&&d.sourceHashSha256===stored.sourceHashSha256);
    if(!document)continue;
    const failure=(code:string)=>{if(!document.diagnostics.includes(code)){document.diagnostics.push(code);changed=true;}};
    if(!document.storedPath||!existsSync(document.storedPath)){failure('CALENDAR_REFRESH_SOURCE_UNAVAILABLE');continue;}
    try {
      const bytes=readFileSync(document.storedPath);
      if(createHash('sha256').update(bytes).digest('hex')!==stored.sourceHashSha256){failure('CALENDAR_REFRESH_SOURCE_HASH_MISMATCH');continue;}
      const fresh=canonicalScheduleFromXer(parseXerBytes(bytes),{sourceRevisionId:old.sourceRevisionId,projectId:state.projectId});
      // A source-to-model identity discrepancy is not permission to remap data.
      const ids=(values:typeof old.calendars)=>values.map(c=>c.calendarId).sort().join('\0');
      if(ids(old.calendars)!==ids(fresh.calendars)){failure('CALENDAR_REFRESH_IDENTITY_MISMATCH');continue;}
      const previousDiagnostics=old.diagnostics.filter(isCalendarDiagnostic);
      const diagnostics=fresh.diagnostics.filter(isCalendarDiagnostic);
      old.calendars=fresh.calendars;
      old.diagnostics=[...old.diagnostics.filter(d=>!isCalendarDiagnostic(d)),...diagnostics];
      document.diagnostics=[...document.diagnostics.filter(d=>!isCalendarDiagnostic(d)),...diagnostics];
      stored.calendarReaderVersion=XER_CALENDAR_READER_VERSION;
      stored.calendarReadRefresh={readerVersion:XER_CALENDAR_READER_VERSION,sourceHashSha256:stored.sourceHashSha256,
        refreshedAt:new Date().toISOString(),previousDiagnostics,diagnostics,
        resolvedCalendarCount:fresh.calendars.filter(c=>c.semanticComplete).length,totalCalendarCount:fresh.calendars.length};
      changed=true;
    }catch{failure('CALENDAR_REFRESH_READ_FAILED');}
  }
  return changed;
}
