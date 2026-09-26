import type {ProjectRuntimeState,StoredEvidenceDocument,StoredScheduleRevision} from './project-state-types';

export const scenarioName=(name:string)=>/\b(draft|scenario|what if|proposed|recovery)\b/i.test(name.normalize('NFKC').replace(/[_/\\.-]+/g,' '));
export const isScenarioRevision=(revision:StoredScheduleRevision)=>revision.role==='recovery'||revision.role==='scenario'||scenarioName(revision.sourceFilename??revision.revision.label??'');
export function isAdoptedProgrammeRevision(state:ProjectRuntimeState,revision:StoredScheduleRevision){
  if(isScenarioRevision(revision))return false;
  const documents=state.evidenceDocuments.filter(d=>d.category==='schedule'&&d.linkedArtifactId===revision.revision.revisionId);
  if(!documents.length)return !state.evidenceDocuments.some(d=>d.category==='schedule'&&d.linkedArtifactId);
  return documents.some(d=>['active','superseded'].includes(d.basisState)&&d.scheduleAdoption?.sourceHashSha256===d.sourceHashSha256&&d.sourceHashSha256===revision.sourceHashSha256&&!!d.scheduleAdoption);
}
export function scheduleAuthorityReview(state:ProjectRuntimeState){
  const basis=state.activeEvidenceBasis['schedule:control']??state.activeEvidenceBasis['schedule:baseline'];
  const document=state.evidenceDocuments.find(d=>d.documentId===basis?.activeDocumentId);
  const revision=state.schedules.find(s=>s.revision.revisionId===basis?.activeArtifactId);
  const decision=document?.scheduleAdoption;
  const validDecision=!!document&&!!revision&&document.linkedArtifactId===revision.revision.revisionId&&decision?.sourceHashSha256===document.sourceHashSha256&&document.sourceHashSha256===revision.sourceHashSha256;
  const dataDateIso=revision?.revision.model.dataDateIso?.slice(0,10)??null;
  const pendingSchedules=state.schedules.filter(s=>!isScenarioRevision(s)).flatMap(s=>{
    const source=state.evidenceDocuments.find(d=>d.category==='schedule'&&d.linkedArtifactId===s.revision.revisionId&&d.basisState==='candidate');
    if(!source)return [];
    const date=s.revision.model.dataDateIso?.slice(0,10)??null;
    const dateRelationship=!date?'date_missing':!dataDateIso?'no_current_programme':date>dataDateIso?'later':date===dataDateIso?'same':'earlier';
    const adoptionBlocker=!date?'The programme Data Date must be established before adoption.':source.sourceHashSha256!==s.sourceHashSha256?'The programme and document source hashes do not agree. Review the source before adoption.':null;
    return [{documentId:source.documentId,revisionId:s.revision.revisionId,sourceHashSha256:source.sourceHashSha256,
      filename:source.sourceFilename,dataDateIso:date,uploadedAt:source.uploadedAt,role:s.role,dateRelationship,
      canAdopt:adoptionBlocker===null,adoptionBlocker,
      actionPath:'/api/projects/'+encodeURIComponent(state.projectId)+'/schedule/revisions/'+encodeURIComponent(s.revision.revisionId)+'/adopt'}];
  });
  return {projectId:state.projectId,currentRevisionId:revision?.revision.revisionId??null,dataDateIso,pendingSchedules,
    documentId:document?.documentId??null,sourceHashSha256:document?.sourceHashSha256??null,
    state:!revision?'missing':isScenarioRevision(revision)?'invalid':validDecision&&decision?.method==='explicit'?'established':'pending_review',
    method:validDecision?decision?.method:null,
    explanation:!revision?(pendingSchedules.length?'Programme uploaded and awaiting adoption. Review the programme below and select Adopt as current to enable programme-based reporting.':'Upload a programme, then review and adopt it to enable programme-based reporting.'):isScenarioRevision(revision)?'A draft or scenario cannot be the current programme.':validDecision&&decision?.method==='explicit'?'Current programme selected by an explicit adoption decision.':'The previous programme selection is retained as a source position. Confirm adoption in Documents; it is not an approved programme.',
  };
}

/** Preserve the previous non-scenario source selection and its provenance.
 * Never fabricate an approval. Withdraw automatic draft selections and replay
 * the recorded pre-existing family history; future additions need adoption. */
export function migrateScheduleAuthority(state:ProjectRuntimeState,rebuild:(state:ProjectRuntimeState,family:string)=>void){
  if(state.scheduleAuthorityVersion==='explicit-adoption-v1')return false;
  const families=new Set<string>();
  for(const revision of state.schedules){
    const documents=state.evidenceDocuments.filter(d=>d.linkedArtifactId===revision.revision.revisionId&&d.category==='schedule');
    if(isScenarioRevision(revision)){
      if(revision.role!=='recovery')revision.role='scenario';
      for(const d of documents){families.add(d.familyKey);d.scheduleRole=revision.role;d.documentType=revision.role==='recovery'?'schedule_recovery':'schedule_scenario';
        d.familyKey='schedule:scenario';d.logicalDocumentKey='schedule:scenario:'+d.documentId;families.add(d.familyKey);
        d.diagnostics.push('DRAFT_SCENARIO_EXCLUDED_FROM_CURRENT_AUTHORITY');}
    }else for(const d of documents)if(!d.scheduleAdoption&&['active','superseded'].includes(d.basisState)){
      d.scheduleAdoption={method:d.uploadIntent==='replace_current_basis'?'explicit':'legacy_retained',sourceHashSha256:d.sourceHashSha256,
        recordedAt:d.uploadedAt,note:d.uploadIntent==='replace_current_basis'?'Original explicit replacement decision.':'Retained previous source selection; no approval is inferred.'};
    }
  }
  for(const family of families)rebuild(state,family);
  state.scheduleAuthorityVersion='explicit-adoption-v1';
  return true;
}

export function explicitScheduleDecision(document:StoredEvidenceDocument,recordedAt:string){
  document.scheduleAdoption={method:'explicit',sourceHashSha256:document.sourceHashSha256,recordedAt,note:'User explicitly selected this programme as the active basis.'};
}
