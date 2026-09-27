import type {ProjectRuntimeState} from './project-state-types';
import {scheduleAuthorityReview} from './schedule-authority';
import {projectControlSchedule} from './canonical-time-claims';

export function validPhaseId(value:unknown):string {
  if(typeof value!=='string'||!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,79}$/u.test(value.trim()))throw new Error('PHASE_ID_REQUIRED');
  return value.trim().normalize('NFKC');
}
/** Phase programmes live in a separate collection. Existing whole-project producers
 * cannot accidentally choose a newer phase revision as their controlling programme. */
export function phaseProgrammeState(project:ProjectRuntimeState,phaseId:string,create=false):ProjectRuntimeState {
  const id=validPhaseId(phaseId);let phase=project.phaseProgrammes?.find(p=>p.phaseId===id);
  if(!phase){if(!create)throw new Error('PHASE_NOT_FOUND');phase={phaseId:id,name:id,schedules:[],evidenceDocuments:[],activeEvidenceBasis:{}};(project.phaseProgrammes??=[]).push(phase);}
  return {...project,schedules:phase.schedules,evidenceDocuments:phase.evidenceDocuments,activeEvidenceBasis:phase.activeEvidenceBasis,resourcesByRevision:new Map(),quantities:null,boq:null,boqRevisions:[],controls:{...project.controls},scheduleAuthorityVersion:'explicit-adoption-v1'};
}
export function phaseProgrammePosition(project:ProjectRuntimeState,phaseId:string){
  const state=phaseProgrammeState(project,phaseId),review=scheduleAuthorityReview(state),current=projectControlSchedule(state);
  return {projectId:project.projectId,projectVersion:project.version,scope:'phase',phaseId,wholeProjectAuthorityUnchanged:true,
    review:{...review,pendingSchedules:review.pendingSchedules.map(p=>({...p,actionPath:'/api/projects/'+encodeURIComponent(project.projectId)+'/phases/'+encodeURIComponent(phaseId)+'/schedule/revisions/'+encodeURIComponent(p.revisionId)+'/adopt'}))},
    programme:current?{revisionId:current.revision.revisionId,dataDate:current.revision.model.dataDateIso,activityCount:current.revision.model.activities.length,relationshipCount:current.revision.model.relationships.length,role:current.role}:null,
    revisions:state.schedules.map(s=>({revisionId:s.revision.revisionId,filename:s.sourceFilename,sourceHash:s.sourceHashSha256,role:s.role,approvalReference:s.approvalReference??null,canReview:state.evidenceDocuments.some(d=>d.linkedArtifactId===s.revision.revisionId&&!d.scheduleAdoption&&!['active','superseded'].includes(d.basisState)),dataDate:s.revision.model.dataDateIso,activityCount:s.revision.model.activities.length,adopted:state.evidenceDocuments.some(d=>d.linkedArtifactId===s.revision.revisionId&&d.basisState==='active')})),
    explanation:'This phase has its own programme decisions and reporting date. It does not replace, merge into or advance the whole-project programme. Cross-phase roll-ups require an explicitly coordinated whole-project programme.'};
}
