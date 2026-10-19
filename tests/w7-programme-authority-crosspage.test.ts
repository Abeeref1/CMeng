import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {projectMetadata} from '../packages/runtime-api/src/project-catalog';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {scheduleAuthorityReview,programmeDocumentAuthority,explicitScheduleDecision,submittedScheduleDecision} from '../packages/runtime-api/src/schedule-authority';

// F08: a programme revision (e.g. Update02) has one state on every page.
function state(){
  const schedule={
    role:'update',roleConfirmed:true,approvalReference:null,sourceFilename:'Update02.xer',
    sourceHashSha256:'u2-hash',
    revision:{revisionId:'S-U2',sequence:2,label:'Update02',effectiveAt:'2042-08-20',
      model:{dataDateIso:'2042-08-20',activities:[{activityId:'A1000',name:'Structure',status:'in_progress'}],relationships:[],wbs:[],calendars:[]}},
  };
  return {
    projectId:'F08-CROSSPAGE',version:3,
    schedules:[schedule],
    activeEvidenceBasis:{'schedule:control':{activeArtifactId:'S-U2',activeDocumentId:'DOC-U2'}},
    evidenceDocuments:[{
      documentId:'DOC-U2',category:'schedule',documentType:'schedule_update',familyKey:'schedule:control',
      linkedArtifactId:'S-U2',basisState:'active',sourceHashSha256:'u2-hash',
      sourceFilename:'Update02.xer',sourceRelativePath:'Update02.xer',uploadedAt:'2042-08-21T00:00:00Z',
    }],
  } as any;
}
function documentsPageLabel(document:any){
  const embedded=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const ast=createSourceFile('browser.js',embedded,ScriptTarget.Latest,true);
  const fn=ast.statements.filter(isFunctionDeclaration).find(x=>x.name?.text==='documentUseLabel')!;
  return runInNewContext(fn.getText(ast)+';documentUseLabel('+JSON.stringify(document.basisState)+','+JSON.stringify(document)+')',{humanizeKey:(x:string)=>x});
}
function pages(project:any){
  const review=scheduleAuthorityReview(project);
  const document=project.evidenceDocuments[0];
  return {
    review,
    metadata:projectMetadata(project),
    control:projectControlSchedule(project),
    documents:documentsPageLabel({...document,programmeAuthority:programmeDocumentAuthority(review,document)}),
    authority:programmeDocumentAuthority(review,document),
  };
}

test('F08 unadopted programme is a candidate on every page, including the project catalog and Documents',()=>{
  const p=pages(state());
  assert.equal(p.review.programmeState,'candidate');
  assert.equal(p.control,null,'calculation pages do not treat it as current');
  // Before: the catalog took the evidence-selected revision as current and showed its Data Date.
  assert.equal(p.metadata.revisionCount,1,'the catalog sees the programme revision');
  assert.equal(p.metadata.latestDataDateIso,null);
  assert.equal(p.metadata.programmeAuthorityState,'candidate');
  assert.equal(p.authority?.state,'candidate');
  assert.equal(p.documents,'Programme candidate · needs adoption before current');
});

test('F08 submitted update is current (not an approval) on every page',()=>{
  const project=state();submittedScheduleDecision(project.evidenceDocuments[0],'2042-08-21T00:00:00Z');
  const p=pages(project);
  assert.equal(p.review.programmeState,'current');
  assert.equal(p.control?.revision.revisionId,'S-U2');
  assert.equal(p.metadata.latestDataDateIso,'2042-08-20');
  assert.equal(p.metadata.programmeAuthorityState,'current');
  assert.equal(p.documents,'Current submitted programme · not an approval');
});

test('F08 explicitly adopted programme is adopted on every page',()=>{
  const project=state();explicitScheduleDecision(project.evidenceDocuments[0],'2042-08-21T00:00:00Z');
  const p=pages(project);
  assert.equal(p.review.programmeState,'adopted');
  assert.equal(p.control?.revision.revisionId,'S-U2');
  assert.equal(p.metadata.latestDataDateIso,'2042-08-20');
  assert.equal(p.metadata.programmeAuthorityState,'adopted');
  assert.equal(p.documents,'Current programme · adopted');
});

test('F08 a later uploaded candidate is a candidate on Documents while the adopted one stays current',()=>{
  const project=state();explicitScheduleDecision(project.evidenceDocuments[0],'2042-08-21T00:00:00Z');
  project.schedules.push({...project.schedules[0],sourceFilename:'Update03.xer',sourceHashSha256:'u3-hash',
    revision:{...project.schedules[0].revision,revisionId:'S-U3',sequence:3,label:'Update03',model:{...project.schedules[0].revision.model,dataDateIso:'2042-09-20'}}});
  project.evidenceDocuments.push({...project.evidenceDocuments[0],documentId:'DOC-U3',linkedArtifactId:'S-U3',basisState:'candidate',sourceHashSha256:'u3-hash',sourceFilename:'Update03.xer',scheduleAdoption:undefined});
  const review=scheduleAuthorityReview(project);
  assert.equal(programmeDocumentAuthority(review,project.evidenceDocuments[1])?.state,'candidate');
  // Before: the catalog could not see adoption and would report the evidence basis only; now it reads the adopted revision.
  assert.equal(projectMetadata(project).latestDataDateIso,'2042-08-20');
  assert.equal(projectControlSchedule(project)?.revision.revisionId,'S-U2');
});
