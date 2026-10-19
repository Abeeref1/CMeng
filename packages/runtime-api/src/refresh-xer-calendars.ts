import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {canonicalScheduleFromPrimaveraXml,canonicalScheduleFromXer} from '../../schedule-analysis-core/src';
import {parsePrimaveraXml} from '../../primavera-xml-parser/src';
import {parseXerBytes} from '../../xer-parser/src';
import type {ProjectRuntimeState,StoredScheduleRevision} from './project-state-types';

// One reader version per format; a stored programme read by an older reader
// is refreshed once from its unchanged retained source.
// XER v5: also the project option "Calendar for scheduling Relationship Lag"
// (PROJECT.sched_calendar_on_relationship_lag) and the project default
// calendar it may name, so stored programmes use the stated lag calendar.
export const XER_CALENDAR_READER_VERSION='p6-source-aliases-links-finish-lagcal-v5';
/** P6 XML calendar working time (StandardWorkWeek, HolidayOrExceptions) read
 * into the shared P6 calendar model; v2 also the project option
 * Project.RelationshipLagCalendar. */
export const P6XML_CALENDAR_READER_VERSION='p6xml-calendar-work-time-lagcal-v2';
/** The stated lag calendar option of a fresh read replaces the stored one (absent stays absent). */
function refreshLagCalendar(old:StoredScheduleRevision['revision']['model'],fresh:StoredScheduleRevision['revision']['model']){
  if(fresh.relationshipLagCalendar)old.relationshipLagCalendar=fresh.relationshipLagCalendar;else delete old.relationshipLagCalendar;
}
const isCalendarDiagnostic=(value:string)=>value.startsWith('CALENDAR_');

/** Refresh calendar interpretations and unresolved single-project links from the unchanged retained
 * source. Activity values, revision identities, selections and approvals stay
 * under their existing authorities. Includes separately governed phases. */
export function refreshStoredXerCalendars(state:ProjectRuntimeState):boolean {
  let changed=false;
  for(const scope of [state,...state.phaseProgrammes??[]])for(const stored of scope.schedules){
    const old=stored.revision.model;
    if(stored.format==='primavera_xml'&&stored.calendarReaderVersion!==P6XML_CALENDAR_READER_VERSION){
      if(refreshStoredP6XmlCalendars(state.projectId,scope.evidenceDocuments,stored))changed=true;
      continue;
    }
    if(stored.format!=='xer'||stored.calendarReaderVersion===XER_CALENDAR_READER_VERSION)continue;
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
      const activityIds=(values:typeof old.activities)=>values.map(a=>a.activityId).sort().join('\0');
      if(activityIds(old.activities)!==activityIds(fresh.activities)){failure('SCHEDULE_REFRESH_ACTIVITY_IDENTITY_MISMATCH');continue;}
      const freshLinks=new Map(fresh.relationships.map(r=>[r.relationshipId,r]));
      if(freshLinks.size!==fresh.relationships.length||old.relationships.length!==fresh.relationships.length||old.relationships.some(r=>!freshLinks.has(r.relationshipId))){failure('SCHEDULE_REFRESH_RELATIONSHIP_IDENTITY_MISMATCH');continue;}
      let repairedRelationshipCount=0;
      old.relationships=old.relationships.map(link=>{
        if(![link.predecessorActivityId,link.successorActivityId].some(id=>id.startsWith('native:::')))return link;
        const recovered=freshLinks.get(link.relationshipId)!;
        if(link.predecessorActivityId===recovered.predecessorActivityId&&link.successorActivityId===recovered.successorActivityId)return link;
        repairedRelationshipCount++;
        return {...link,predecessorActivityId:recovered.predecessorActivityId,successorActivityId:recovered.successorActivityId,external:recovered.external};
      });
      const previousDiagnostics=old.diagnostics.filter(isCalendarDiagnostic);
      const diagnostics=fresh.diagnostics.filter(isCalendarDiagnostic);
      old.calendars=fresh.calendars;
      old.declaredProjectFinishIso=fresh.declaredProjectFinishIso??null;
      refreshLagCalendar(old,fresh);
      old.diagnostics=[...old.diagnostics.filter(d=>!isCalendarDiagnostic(d)),...diagnostics];
      document.diagnostics=[...document.diagnostics.filter(d=>!isCalendarDiagnostic(d)),...diagnostics];
      stored.calendarReaderVersion=XER_CALENDAR_READER_VERSION;
      stored.calendarReadRefresh={readerVersion:XER_CALENDAR_READER_VERSION,sourceHashSha256:stored.sourceHashSha256,
        refreshedAt:new Date().toISOString(),previousDiagnostics,diagnostics,repairedRelationshipCount,
        resolvedCalendarCount:fresh.calendars.filter(c=>c.semanticComplete).length,totalCalendarCount:fresh.calendars.length};
      changed=true;
    }catch{failure('CALENDAR_REFRESH_READ_FAILED');}
  }
  return changed;
}

/** A P6 XML programme stored before its calendar working time was read:
 * calendars, calendar diagnostics and the activity calendar links that were
 * not established (project default activity calendar) are filled from the
 * unchanged retained source. Activity dates, durations, relationships,
 * identities, selections and approvals stay as stored. */
function refreshStoredP6XmlCalendars(projectId:string,documents:ProjectRuntimeState['evidenceDocuments'],stored:StoredScheduleRevision):boolean{
  const old=stored.revision.model;
  const document=documents.find(d=>d.linkedArtifactId===stored.revision.revisionId&&d.sourceHashSha256===stored.sourceHashSha256);
  if(!document)return false;
  const failure=(code:string)=>{if(document.diagnostics.includes(code))return false;document.diagnostics.push(code);return true;};
  if(!document.storedPath||!existsSync(document.storedPath))return failure('CALENDAR_REFRESH_SOURCE_UNAVAILABLE');
  try {
    const bytes=readFileSync(document.storedPath);
    if(createHash('sha256').update(bytes).digest('hex')!==stored.sourceHashSha256)return failure('CALENDAR_REFRESH_SOURCE_HASH_MISMATCH');
    const fresh=canonicalScheduleFromPrimaveraXml(parsePrimaveraXml(bytes),{sourceRevisionId:old.sourceRevisionId,projectId});
    const ids=(values:typeof old.calendars)=>values.map(c=>c.calendarId).sort().join('\0');
    if(old.calendars.length&&ids(old.calendars)!==ids(fresh.calendars))return failure('CALENDAR_REFRESH_IDENTITY_MISMATCH');
    const activityIds=(values:typeof old.activities)=>values.map(a=>a.activityId).sort().join('\0');
    if(activityIds(old.activities)!==activityIds(fresh.activities))return failure('SCHEDULE_REFRESH_ACTIVITY_IDENTITY_MISMATCH');
    // Links are filled only for an activity ID that is unique in the file.
    const count=new Map<string,number>();for(const a of fresh.activities)count.set(a.activityId,(count.get(a.activityId)??0)+1);
    const freshById=new Map(fresh.activities.filter(a=>count.get(a.activityId)===1).map(a=>[a.activityId,a]));
    let linkedActivityCalendarCount=0;
    old.activities=old.activities.map(activity=>{
      const recovered=activity.calendarId===null?freshById.get(activity.activityId):undefined;
      if(!recovered||recovered.calendarId===null)return activity;
      linkedActivityCalendarCount++;
      return {...activity,calendarId:recovered.calendarId,
        diagnostics:[...activity.diagnostics,...recovered.diagnostics.filter(d=>d.startsWith('P6XML_ACTIVITY_CALENDAR_FROM_PROJECT_DEFAULT:'))]};
    });
    const previousDiagnostics=old.diagnostics.filter(isCalendarDiagnostic);
    const diagnostics=fresh.diagnostics.filter(isCalendarDiagnostic);
    old.calendars=fresh.calendars;
    refreshLagCalendar(old,fresh);
    old.diagnostics=[...old.diagnostics.filter(d=>!isCalendarDiagnostic(d)),...diagnostics];
    document.diagnostics=[...document.diagnostics.filter(d=>!isCalendarDiagnostic(d)),...diagnostics];
    stored.calendarReaderVersion=P6XML_CALENDAR_READER_VERSION;
    stored.calendarReadRefresh={readerVersion:P6XML_CALENDAR_READER_VERSION,sourceHashSha256:stored.sourceHashSha256,
      refreshedAt:new Date().toISOString(),previousDiagnostics,diagnostics,linkedActivityCalendarCount,
      resolvedCalendarCount:fresh.calendars.filter(c=>c.semanticComplete).length,totalCalendarCount:fresh.calendars.length};
    return true;
  }catch{return failure('CALENDAR_REFRESH_READ_FAILED');}
}
