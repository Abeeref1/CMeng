import test from 'node:test';
import assert from 'node:assert/strict';
import {projectControlSchedule,projectDataDate} from '../packages/runtime-api/src/canonical-time-claims';
import {scheduleAuthorityReview} from '../packages/runtime-api/src/schedule-authority';

function state(){
  const schedule={
    role:'update',roleConfirmed:true,approvalReference:null,sourceFilename:'Current_Programme.xer',
    sourceHashSha256:'schedule-hash',
    revision:{revisionId:'S-CURRENT',sequence:1,label:'Current Programme',effectiveAt:'2042-08-20',
      model:{dataDateIso:'2042-08-20',activities:[],relationships:[],wbs:[],calendars:[]}},
  };
  return {
    projectId:'ADOPTION-GATE',
    schedules:[schedule],
    activeEvidenceBasis:{'schedule:control':{activeArtifactId:'S-CURRENT',activeDocumentId:'DOC-SCHEDULE'}},
    evidenceDocuments:[{
      documentId:'DOC-SCHEDULE',category:'schedule',documentType:'schedule_update',familyKey:'schedule:control',
      linkedArtifactId:'S-CURRENT',basisState:'active',sourceHashSha256:'schedule-hash',
      sourceFilename:'Current_Programme.xer',sourceRelativePath:'Current_Programme.xer',
    }],
  } as any;
}

test('active evidence basis does not make an unadopted programme current',()=>{
  const project=state();
  const review=scheduleAuthorityReview(project);
  assert.equal(review.state,'pending_review');
  assert.equal(review.method,null);
  assert.equal(projectControlSchedule(project),null);
  assert.equal(projectDataDate(project),null);
});

test('the exact source-bound adoption decision enables the current analytical programme',()=>{
  const project=state();
  project.evidenceDocuments[0].scheduleAdoption={
    method:'explicit',sourceHashSha256:'schedule-hash',recordedAt:'2042-08-21',note:'Explicitly adopted for analysis',
  };
  assert.equal(scheduleAuthorityReview(project).state,'established');
  assert.equal(projectControlSchedule(project)?.revision.revisionId,'S-CURRENT');
  assert.equal(projectDataDate(project),'2042-08-20');
});

test('stale adoption for a different source hash cannot authorize the programme',()=>{
  const project=state();
  project.evidenceDocuments[0].scheduleAdoption={
    method:'explicit',sourceHashSha256:'old-hash',recordedAt:'2042-08-21',note:'Stale decision',
  };
  assert.equal(projectControlSchedule(project),null);
  assert.equal(projectDataDate(project),null);
});
