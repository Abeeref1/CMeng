import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleAuthorityReview} from '../packages/runtime-api/src/schedule-authority';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F32 guard: the page footer "A newly uploaded schedule needs your review" shows
// only when a schedule is really awaiting review, never after adoption because of
// a re-upload of the adopted programme or an older upload.
const rev=(id:string,date:string,hash:string)=>({role:'update',roleConfirmed:true,approvalReference:null,sourceFilename:id+'.xer',sourceHashSha256:hash,
  revision:{revisionId:id,sequence:1,label:id,effectiveAt:date,model:{dataDateIso:date,activities:[],relationships:[],wbs:[],calendars:[]}}});
const doc=(id:string,rid:string,hash:string,basisState:string,adopted=false)=>({documentId:id,category:'schedule',documentType:'schedule_update',familyKey:'schedule:control',
  linkedArtifactId:rid,basisState,sourceHashSha256:hash,sourceFilename:rid+'.xer',sourceRelativePath:rid+'.xer',
  ...(adopted?{scheduleAdoption:{method:'explicit',sourceHashSha256:hash,recordedAt:'2042-08-21',note:'Adopted'}}:{})});
function project(extraSchedules:any[],extraDocs:any[]){
  return {projectId:'F32-FOOTER',schedules:[rev('S2','2042-08-20','h2'),...extraSchedules],
    activeEvidenceBasis:{'schedule:control':{activeArtifactId:'S2',activeDocumentId:'D2'}},
    evidenceDocuments:[doc('D2','S2','h2','active',true),...extraDocs]} as any;
}

test('F32 after adoption a re-upload of the adopted programme is not awaiting review',()=>{
  const review=scheduleAuthorityReview(project([],[doc('D2-again','S2','h2','candidate')]));
  assert.equal(review.state,'established');
  assert.equal(review.pendingSchedules.length,1,'the retained upload stays listed for review records');
  assert.equal(review.awaitingReviewSchedules.length,0);
});

test('F32 after adoption an upload older than the adopted Data Date is not a new schedule awaiting review',()=>{
  const review=scheduleAuthorityReview(project([rev('S1','2042-07-20','h1')],[doc('D1','S1','h1','candidate')]));
  assert.equal(review.pendingSchedules[0]?.dateRelationship,'earlier');
  assert.equal(review.awaitingReviewSchedules.length,0);
});

test('F32 a later unadopted upload is still awaiting review',()=>{
  const review=scheduleAuthorityReview(project([rev('S3','2042-09-20','h3')],[doc('D3','S3','h3','candidate')]));
  assert.deepEqual(review.awaitingReviewSchedules.map(s=>s.revisionId),['S3']);
});

test('F32 the page footer reads the shared awaiting-review rule, not every retained upload',()=>{
  const html=cmengUatHtml();
  const line=html.split('\n').find(l=>l.includes('A newly uploaded schedule needs your review.'))??'';
  assert.ok(line,'footer text present');
  const footerCondition=html.slice(Math.max(0,html.indexOf('A newly uploaded schedule needs your review.')-700),html.indexOf('A newly uploaded schedule needs your review.'));
  assert.match(footerCondition,/review\.awaitingReviewSchedules/);
  assert.doesNotMatch(footerCondition,/\|\|review\.pendingSchedules\?\.length\)\)\{/);
});
