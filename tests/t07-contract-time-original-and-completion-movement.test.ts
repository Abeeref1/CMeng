import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {CanonicalScheduleActivity,CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import type {ScheduleRevision} from '../packages/schedule-revision-core/src';
import type {DelayClaimsModel} from '../packages/delay-analysis-core/src';
import {buildWindowsAnalysisProjection} from '../packages/windows-analysis/src';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {contractCompletionPosition} from '../packages/runtime-api/src/contract-completion';

// T07 SW-22: the original completion date is read from the contract and from
// amendments that restate it, kept apart from the current / extended date.
// A date read only from an unadopted source is a labelled candidate (T04).
const evidence=(projectId:string,name:string,familyKey:string,basisState:string)=>({
  documentId:projectId+':'+name,category:'contract',documentType:'main_contract',
  sourceFilename:name+'.pdf',sourceRelativePath:name+'.pdf',mediaType:'application/pdf',
  storedPath:'/nonexistent/'+name,sourceHashSha256:createHash('sha256').update(name).digest('hex'),sizeBytes:1,uploadedAt:'2028-01-01T00:00:00Z',
  authority:basisState==='active'?'source_approved':'candidate_only',parserState:'parsed',basisState,familyKey,logicalDocumentKey:name,supersededByDocumentId:null,
  identification:{needsReview:false},lineage:{needsReview:false},sourceRefs:[],
}) as any;
const contract=(documentId:string,role:string,text:string)=>({documentId,role,
  result:{sections:[{heading:'Contract Data',text,startPage:1,sectionKey:'s1',sourceMode:'deterministic',sourceSpans:[]}]}}) as any;
const setup=(id:string)=>new RuntimeProjectStore({durable:false}).getOrCreate(id);

test('SW-22 original completion is read from the contract and its amendment, apart from the extended date, with the T04 label',()=>{
  // A. The amendment restates the original date while the main contract line is
  // not machine-read: the original must not be recorded as missing.
  const a=setup('T07-SW22-A');
  const mainA=evidence(a.projectId,'main','contract:main','active');
  const amendA=evidence(a.projectId,'amendment-1','contract:amendment-1','active');
  a.evidenceDocuments.push(mainA,amendA);
  (a.contractDocuments as any[]).push(contract(mainA.documentId,'main','The Works shall be completed as set out in the Appendix.'));
  (a.contractDocuments as any[]).push(contract(amendA.documentId,'amendment','Effective Date: 2029-01-15\nOriginal Completion 31 December 2028\nRevised Completion Date: 2029-03-31'));
  const posA=contractCompletionPosition(a,'2029-02-01') as any;
  assert.equal(posA.value,'2029-03-31','current contract completion is the applicable amended date');
  assert.equal(posA.original?.value,'2028-12-31','original read from the amendment restatement, not missing');
  assert.equal(posA.original?.state,'official','both sources are adopted');
  assert.ok(posA.original.sourceRefs.some((r:string)=>r.startsWith('evidence-document:'+amendA.documentId+':')));

  // B. Main contract and amendment both state the original date; the main
  // contract is a unique unadopted source: candidate with the T04 label, never official.
  const b=setup('T07-SW22-B');
  const mainB=evidence(b.projectId,'main','contract:main','candidate');
  const amendB=evidence(b.projectId,'amendment-1','contract:amendment-1','candidate');
  b.evidenceDocuments.push(mainB,amendB);
  (b.contractDocuments as any[]).push(contract(mainB.documentId,'main','Original Completion 31 December 2028'));
  (b.contractDocuments as any[]).push(contract(amendB.documentId,'amendment','Effective Date: 2029-01-15\nOriginal Completion 31 December 2028\nRevised Completion Date: 2029-03-31'));
  const posB=contractCompletionPosition(b,'2029-02-01') as any;
  assert.equal(posB.original?.value,'2028-12-31');
  assert.equal(posB.original?.state,'candidate','an unadopted source is never shown as formally adopted');
  assert.equal(posB.original?.sourceAnalyticalUse,'qualified_source_read');
  assert.equal(posB.original?.sourceAnalyticalNote,'Read from source; not formally adopted.');
  assert.equal(posB.value,'2029-03-31','extended date kept separate from the original');

  // C. Different original dates stay a conflict (unknown, never a picked value).
  const c=setup('T07-SW22-C');
  const mainC=evidence(c.projectId,'main','contract:main','active');
  const amendC=evidence(c.projectId,'amendment-1','contract:amendment-1','active');
  c.evidenceDocuments.push(mainC,amendC);
  (c.contractDocuments as any[]).push(contract(mainC.documentId,'main','Original Completion 30 November 2028'));
  (c.contractDocuments as any[]).push(contract(amendC.documentId,'amendment','Effective Date: 2029-01-15\nOriginal Completion 31 December 2028\nRevised Completion Date: 2029-03-31'));
  const posC=contractCompletionPosition(c,'2029-02-01') as any;
  assert.equal(posC.original?.value,null);
  assert.equal(posC.original?.state,'conflicted');
});

// T07 SW-23: window programme movement is completion movement between
// revisions, never the largest shift of a single activity.
function activity(id:string,finishIso:string):CanonicalScheduleActivity{
  return {projectId:'P-SW23',activityId:id,nativeId:id,name:id,wbsId:null,calendarId:null,activityType:'task',status:'in_progress',
    baselineStartIso:'2031-01-01T00:00:00.000Z',baselineFinishIso:finishIso,currentStartIso:'2031-01-01T00:00:00.000Z',currentFinishIso:finishIso,
    actualStartIso:'2031-01-01T00:00:00.000Z',actualFinishIso:null,forecastStartIso:'2031-01-01T00:00:00.000Z',forecastFinishIso:finishIso,
    originalDurationHours:100,remainingDurationHours:50,totalFloatHours:0,freeFloatHours:0,percentComplete:50,sourceRefs:[],diagnostics:[]};
}
function revision(id:string,sequence:number,dataDateIso:string,finishIso:string,sideFinishIso:string):ScheduleRevision{
  // A closed loop keeps the independent CPM from solving, so the submitted
  // completion forecast is the completion measure (as on a real project
  // whose logic cannot be recalculated).
  const model:CanonicalScheduleModel={projectId:'P-SW23',source:'schedule_csv',sourceRevisionId:id,dataDateIso,
    activities:[activity('A100',finishIso),activity('A200',finishIso),activity('SIDE',sideFinishIso)],
    relationships:[
      {relationshipId:id+'-R1',predecessorActivityId:'A100',successorActivityId:'A200',type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]},
      {relationshipId:id+'-R2',predecessorActivityId:'A200',successorActivityId:'A100',type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]},
    ],wbs:[],calendars:[],diagnostics:[]};
  return {revisionId:id,label:id,sequence,effectiveAt:dataDateIso,model} as ScheduleRevision;
}
const emptyDelay:DelayClaimsModel={projectId:'P-SW23',evidenceRevisionId:'D1',events:[],notices:[],claims:[],noticeRequirements:[],diagnostics:[]};

test('SW-23 window programme movement is the completion movement, not the largest single-activity shift',()=>{
  const windows=buildWindowsAnalysisProjection([
    revision('R1',1,'2031-03-01T00:00:00.000Z','2031-08-01T00:00:00.000Z','2031-04-20T00:00:00.000Z'),
    revision('R2',2,'2031-04-01T00:00:00.000Z','2031-08-05T00:00:00.000Z','2031-05-06T00:00:00.000Z'),
  ],emptyDelay,{generatedAt:'2031-04-01T00:00:00.000Z',producerVersion:'test'});
  const w=windows.windows[0]!;
  assert.equal(w.independentForecastMovementDays,null,'independent CPM not available in this case');
  assert.equal(w.netCompletionMovementDays,4,'project completion moved 4 days');
  assert.equal(w.strongestPositiveActivityMovementDays,16,'single-activity shift is still kept in its own field');
  assert.equal(w.strongestPositiveActivityId,'SIDE');
  assert.equal(w.strongestProgrammeMovementDays,4,'window programme movement uses completion movement');
  assert.equal(w.strongestProgrammeMovementBasis,'source_forecast');
});
