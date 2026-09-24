import {contractValueBasisReview} from '../packages/runtime-api/src/source-basis-review';
import {contractNoticeRules} from '../packages/runtime-api/src/contract-notice-rules';
import {claimsReporting} from '../packages/runtime-api/src/reporting-state';
import {certificateProfile} from '../packages/runtime-api/src/certificate-profile';
import { canonicalCommercialModule } from "../packages/runtime-api/src/commercial-runtime";
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dateValue, numberValue, sumKnown, ratio, sourceTables, fact } from '../packages/truth-kernel/src';
import { RuntimeProjectStore } from '../packages/runtime-api/src/project-state';
import { evidenceFamily } from '../packages/runtime-api/src/evidence-control';
import { canonicalTimeClaims, projectDataDate, synchronizeCanonicalTimeClaims } from '../packages/runtime-api/src/canonical-time-claims';
import { canonicalResourceModule, canonicalResources } from '../packages/runtime-api/src/canonical-resource-runtime';
import { projectScheduleControlBasis } from '../packages/runtime-api/src/schedule-control-basis';
import { sourceProductivityForecastEvidence } from '../packages/runtime-api/src/source-productivity-forecast';
import { buildNearCriticalProjection } from '../packages/near-critical-analysis/src';
import { commercialCanonical } from '../packages/runtime-api/src/commercial-canonical';
import { identifyEvidenceDocument } from '../packages/runtime-api/src/document-identification';
import { inferEvidenceCategory, inferDocumentType } from '../packages/runtime-api/src/evidence';
import { buildEotAssessmentProjection } from '../packages/eot-assessment/src';
import type { ProjectRuntimeState, StoredEvidenceDocument } from '../packages/runtime-api/src/project-state-types';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';
import { PDFDocument, StandardFonts } from 'pdf-lib';

// These fixtures exercise native PDF/text ingestion. OCR providers have separate tests;
// do not make native extraction depend on downloading language models.
process.env.CMENG_OCR_ENABLED='0';

const stamp='2026-09-20T10:00:00.000Z';
function fixture(t: { after(fn:()=>void): unknown }) {
  const dir=mkdtempSync(join(tmpdir(),'cmeng-canonical-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});
  const state=store.getOrCreate('CANONICAL');
  state.schedules.push({role:'update',format:'xer',sourceFilename:'renamed.xer',sourceHashSha256:'schedule-hash',uploadedAt:stamp,
    revision:{revisionId:'U1',label:'Current',sequence:1,effectiveAt:'2026-08-31',model:{projectId:'CANONICAL',source:'xer',sourceRevisionId:'U1',dataDateIso:'2026-08-31T08:00:00',activities:[],relationships:[],calendars:[],diagnostics:[]}}} as unknown as ProjectRuntimeState['schedules'][number]);
  function csvDoc(text:string,type='resource_register',basis:StoredEvidenceDocument['basisState']='active',familySuffix='') {
    const hash=createHash('sha256').update(text).digest('hex'),id='doc-'+state.evidenceDocuments.length;
    const path=join(dir,id+'.csv');writeFileSync(path,text);
    const category=['resource_register','schedule_control_basis','schedule_metric_register','project_data_book'].includes(type)?'schedule_control':type==='delay_eot_claims_register'?'risk_claims_procurement':type==='letters_notices'?'correspondence':'boq_cost';
    const family=evidenceFamily({category,documentType:type,scheduleRole:null,textSample:text,sourceFilename:id+'.csv'});
    const doc={documentId:id,category,documentType:type,sourceFilename:id+'.csv',sourceRelativePath:null,mediaType:'text/csv',sourceHashSha256:hash,sizeBytes:Buffer.byteLength(text),storedPath:path,uploadedAt:stamp,
      authority:'candidate_only',parserState:'parsed',linkedArtifactId:null,scheduleRole:null,mapping:null,assertions:[],uploadIntent:'add_update',familyKey:family.familyKey+familySuffix,logicalDocumentKey:family.logicalDocumentKey+familySuffix,basisState:basis,supersedesDocumentIds:[],supersededByDocumentId:null,diagnostics:[],identification:{},lineage:{}} as unknown as StoredEvidenceDocument;
    state.evidenceDocuments.push(doc);state.version++;
    return doc;
  }
  return {dir,store,state,csvDoc};
}
const master='Resource ID,Resource UID,Resource Name,Class,Unit,Utilization Applicable\nL,1,Labour,Labor,labor_hour,Yes\nE,2,Crane,Equipment,equipment_hour,Yes\nM,3,Concrete,Material,m3,No';
const weekly='Resource ID,Week Start,Available Capacity,Planned Demand,Actual Approved Usage,Unit\nL,2026-08-24,100,120,80,labor_hour\nE,2026-08-24,50,40,30,equipment_hour\nM,2026-08-24,1000,200,150,m3';
const claims='Claim ID,Event,Notice Date,Days Claimed,Source Granted Days,Status\nC1,Access unavailable,2026-08-02,20,5,Submitted';
const determinations='Determination ID,Claim ID,Awarded EOT Days,Determination Date,Status,Authority,Source Letter,Governance State\nD1,C1,15,2026-07-24,Determined,Engineer,L1,Immutable\nD2,C1,11,2026-08-16,Determined,Engineer,L2,Immutable\nD3,C1,112,2026-09-08,Determined,Engineer,L3,Immutable';
function amendment(state:ProjectRuntimeState) {
  const doc={documentId:'AMD',category:'contract',documentType:'contract_amendment',sourceFilename:'renamed.pdf',sourceHashSha256:'amd-hash',basisState:'additive',linkedArtifactId:null,diagnostics:[]} as unknown as StoredEvidenceDocument;
  state.evidenceDocuments.push(doc);
  state.contractDocuments.push({documentId:'AMD',role:'amendment',result:{sections:[{text:'Effective Date 15 August 2026\nRevised Contractual Completion 31 March 2030\nEOT Granted 90 calendar days',startPage:1,sectionKey:'preamble',sourceMode:'deterministic'}],pdf:{pages:[{method:'native',pageNumber:2,text:'All contract, BOQ, variation, payment and cost values are stated in AED and are exclusive of VAT unless expressly stated otherwise.'}]}}} as unknown as ProjectRuntimeState['contractDocuments'][number]);
  state.version++;
}

test('civil programme dates accept XER timestamps without inventing a timezone',()=>{
  for(const s of ['2026-08-31','2026-08-31T08:00:00','2026-08-31T08:00:00.000Z','2026-08-31T08:00:00+03:00','31 August 2026'])assert.equal(dateValue(s),'2026-08-31');
  for(const s of ['2026-02-30','2026-08-31T26:00:00','08/09/2026','garbage'])assert.equal(dateValue(s),null);
});
test('missing numeric evidence is not zero; invalid/grouped values fail closed',()=>{
  assert.equal(numberValue(''),null);assert.equal(numberValue('NaN'),null);assert.equal(numberValue('1,00'),null);
  assert.equal(numberValue('0'),0);assert.equal(numberValue('١٬٢٣٤٫٥'),1234.5);assert.equal(sumKnown([1,null]),null);assert.equal(sumKnown([]),null);assert.equal(sumKnown([0]),0);assert.equal(ratio(1,0),null);assert.equal(fact(1,[],'unsupported').state,'candidate');
});
test('content schemas distinguish resource capacity and actual registers without filenames',async()=>{
  const a=await identifyEvidenceDocument({bytes:Buffer.from(weekly),sourceFilename:'a.csv',sourceRelativePath:null});
  assert.equal(a.identification.detectedDocumentType,'resource_register');
  const first=evidenceFamily({category:'schedule_control',documentType:'resource_register',scheduleRole:null,textSample:master,sourceFilename:'same.csv'});
  const second=evidenceFamily({category:'schedule_control',documentType:'resource_register',scheduleRole:null,textSample:weekly,sourceFilename:'same.csv'});
  assert.notEqual(first.familyKey,second.familyKey);
});
test('linked correspondence PDF narrative is persisted and drives bounded activity correspondence with page provenance',async t=>{
  const {store,state,csvDoc}=fixture(t);
  state.schedules[0]!.revision.model.wbs=[
    {wbsId:'W-A',parentWbsId:null,name:'Tower A Structural',sourceRefs:[]},
    {wbsId:'W-B',parentWbsId:null,name:'Tower B Structural',sourceRefs:[]},
  ];
  state.schedules[0]!.revision.model.activities=[
    {
      projectId:'CANONICAL',activityId:'A-100',nativeId:'100',
      name:'Tower A concrete frame Level 13',wbsId:'W-A',calendarId:null,
      activityType:'task',status:'in_progress',
      baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:'2027-04-01',
      actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:'2027-04-01',
      originalDurationHours:100,remainingDurationHours:50,totalFloatHours:8,freeFloatHours:null,
      percentComplete:50,sourceRefs:[{source:'xer',locator:'TASK:line:10'}],diagnostics:[],
    },
    {
      projectId:'CANONICAL',activityId:'A-200',nativeId:'200',
      name:'Tower B concrete frame Level 13',wbsId:'W-B',calendarId:null,
      activityType:'task',status:'not_started',
      baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:'2027-04-02',
      actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:'2027-04-02',
      originalDurationHours:100,remainingDurationHours:100,totalFloatHours:16,freeFloatHours:null,
      percentComplete:0,sourceRefs:[{source:'xer',locator:'TASK:line:20'}],diagnostics:[],
    },
  ] as any;

  csvDoc(
    [
      'Claim ID,Event,Notice Date,Days Claimed,Status,Linked Letter',
      'CL-001,Delay event 0001,2026-08-20,12,Submitted,L-NOTICE-001',
    ].join('\n'),
    'delay_eot_claims_register',
    'active',
    ':cl01',
  );

  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const page=pdf.addPage([595,842]);
  [
    'PROJECT CORRESPONDENCE',
    'Reference: L / NOTICE / 001',
    'Subject: Late access affecting Tower A structural concrete frame Level 13',
    'The delayed access prevented the Tower A concrete frame works at Level 13.',
  ].forEach((line,index)=>page.drawText(line,{x:48,y:780-index*28,size:11,font}));
  const bytes=await pdf.save();
  const upload=await store.ingestEvidenceFile({
    projectId:'CANONICAL',
    bytes,
    mediaType:'application/pdf',
    sourceFilename:'correspondence.pdf',
    sourceRelativePath:'07_Correspondence_MOM/L01_Letters_Notices.pdf',
    uploadedAt:stamp,
    uploadIntent:'add_update',
  });
  assert.equal(upload.documentType,'letters_notices');

  const refreshed=await store.refreshCorrespondenceNarratives('CANONICAL');
  assert.equal(refreshed.refreshedDocumentCount,1);
  assert.equal(refreshed.segmentCount,1);
  assert.equal(refreshed.unresolvedAnchorCount,0);
  const letter=state.evidenceDocuments.find(doc=>doc.documentId===upload.documentId)!;
  assert.equal(letter.textSegments?.length,1);
  assert.equal(letter.textSegments?.[0]?.anchor,'L-NOTICE-001');
  assert.equal(letter.textSegments?.[0]?.pageNumber,1);
  assert.match(letter.textSegments?.[0]?.locator??'',/^page:1:anchor:L-NOTICE-001$/);

  const canonical=canonicalTimeClaims(state,true);
  const event=canonical.delayClaims?.events[0]!;
  assert.deepEqual(event.relatedActivityIds,['A-100']);
  assert.equal(event.activityCorrespondence?.classification,'accepted_deterministic');
  assert.ok(
    event.activityCorrespondence?.claimEvidenceRefs.some(
      ref=>ref.sourceId===letter.documentId&&ref.locator==='page:1:anchor:L-NOTICE-001'
    ),
  );
  assert.ok(event.diagnostics.includes('LINKED_CORRESPONDENCE_NARRATIVE_VERIFIED:L-NOTICE-001'));
});


test('correspondence anchor matching tolerates separators without partial-character false positives',async t=>{
  const {store,state,csvDoc}=fixture(t);
  csvDoc(
    [
      'Claim ID,Event,Notice Date,Days Claimed,Status,Linked Letter',
      'CL-ANCHOR,Generic delay event,2026-08-20,1,Submitted,L-NOTICE-001',
    ].join('\n'),
    'delay_eot_claims_register',
    'active',
    ':cl-anchor',
  );

  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const page=pdf.addPage([595,842]);
  [
    'PROJECT CORRESPONDENCE',
    'LONG GENERAL NOTICE LOG AND ADMINISTRATION NOTE',
    'Reference: L / NOTICE / 001',
    'Routine correspondence body with no schedule semantics.',
  ].forEach((line,index)=>page.drawText(line,{x:48,y:780-index*28,size:11,font}));
  const bytes=await pdf.save();
  const upload=await store.ingestEvidenceFile({
    projectId:'CANONICAL',
    bytes,
    mediaType:'application/pdf',
    sourceFilename:'anchor-variants.pdf',
    sourceRelativePath:'07_Correspondence_MOM/L01_Anchor_Variants.pdf',
    uploadedAt:stamp,
    uploadIntent:'add_update',
  });

  const refreshed=await store.refreshCorrespondenceNarratives('CANONICAL');
  assert.equal(refreshed.refreshedDocumentCount,1);
  assert.equal(refreshed.segmentCount,1);
  assert.equal(refreshed.unresolvedAnchorCount,0);
  const letter=state.evidenceDocuments.find(doc=>doc.documentId===upload.documentId)!;
  assert.equal(letter.textSegments?.length,1);
  assert.equal(letter.textSegments?.[0]?.anchor,'L-NOTICE-001');
  assert.match(letter.textSegments?.[0]?.text??'',/L \/ NOTICE \/ 001/);
});


test('stale correspondence segment producer versions are invalidated and recomputed from source bytes',async t=>{
  const {store,state,csvDoc}=fixture(t);
  csvDoc(
    [
      'Claim ID,Event,Notice Date,Days Claimed,Status,Linked Letter',
      'CL-STALE,Generic delay event,2026-08-20,1,Submitted,L-STALE-001',
    ].join('\n'),
    'delay_eot_claims_register',
    'active',
    ':cl-stale',
  );

  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const page=pdf.addPage([595,842]);
  [
    'PROJECT CORRESPONDENCE',
    'Reference: L-STALE-001',
    'Subject: Verified source narrative',
  ].forEach((line,index)=>page.drawText(line,{x:48,y:780-index*28,size:11,font}));
  const bytes=await pdf.save();
  const upload=await store.ingestEvidenceFile({
    projectId:'CANONICAL',
    bytes,
    mediaType:'application/pdf',
    sourceFilename:'stale-segment.pdf',
    sourceRelativePath:'07_Correspondence_MOM/L01_Stale_Segment.pdf',
    uploadedAt:stamp,
    uploadIntent:'add_update',
  });
  const letter=state.evidenceDocuments.find(doc=>doc.documentId===upload.documentId)!;
  letter.textSegments=[{
    segmentId:'stale-segment',
    producerVersion:'correspondence-linked-context-v1',
    kind:'linked_correspondence_context',
    anchor:'L-STALE-001',
    pageNumber:1,
    text:'STALE DERIVED CONTENT',
    locator:'page:1:anchor:L-STALE-001',
    method:'native_pdf_text',
    sourceHashSha256:letter.sourceHashSha256,
  }];

  const refreshed=await store.refreshCorrespondenceNarratives('CANONICAL');
  assert.equal(refreshed.refreshedDocumentCount,1);
  assert.equal(refreshed.segmentCount,1);
  assert.ok(refreshed.diagnostics.some(item=>item.startsWith('CORRESPONDENCE_SEGMENTS_STALE_PRODUCER:')));
  assert.equal(letter.textSegments?.length,1);
  assert.equal(letter.textSegments?.[0]?.producerVersion,'correspondence-linked-context-v3');
  assert.equal(letter.correspondenceNarrativeRefresh?.producerVersion,'correspondence-linked-context-v3');
  assert.equal(letter.correspondenceNarrativeRefresh?.ocrFailedPages,0);
  assert.notEqual(letter.textSegments?.[0]?.text,'STALE DERIVED CONTENT');
  assert.match(letter.textSegments?.[0]?.text??'',/Verified source narrative/);

  const reused=await store.refreshCorrespondenceNarratives('CANONICAL');
  assert.equal(reused.refreshedDocumentCount,0);
  assert.equal(reused.segmentCount,1);
  assert.equal(reused.unresolvedAnchorCount,0);
  assert.ok(reused.diagnostics.some(item=>item.startsWith('CORRESPONDENCE_REFRESH_RECEIPT_REUSED:')));
});

test('source receipt hashes are checked again when stored bytes change',t=>{
  const {csvDoc}=fixture(t);const d=csvDoc(master);assert.equal(sourceTables([d],[]).length,1);
  writeFileSync(d.storedPath,master+'\nchanged');const diagnostics:string[]=[];assert.equal(sourceTables([d],diagnostics).length,0);assert.ok(diagnostics.some(s=>s.startsWith('SOURCE_HASH_MISMATCH')));
});
test('malformed row widths and duplicate normalized headers are not silently repaired',t=>{
  const {csvDoc}=fixture(t);const a=csvDoc('A,B\n1,2,3'),b=csvDoc('Resource ID,resource_id\n1,2');const d:string[]=[];
  assert.equal(sourceTables([a,b],d).length,0);assert.ok(d.some(s=>s.startsWith('CSV_ROW_WIDTH_MISMATCH')));assert.ok(d.some(s=>s.startsWith('DUPLICATE_NORMALIZED_HEADERS')));
});
test('resource quantities are partitioned by class and unit; materials never enter utilization',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(master);csvDoc(weekly);csvDoc("Resource ID,Week Start,Actual Approved Usage,Source Status,Unit\nL,2026-08-24,80,Approved,labor_hour\nE,2026-08-24,30,Approved,equipment_hour");const r=canonicalResources(state);
  assert.equal(r.resourceCount,2);assert.equal(r.rowCount,2);assert.equal(r.capacityCoveragePercent,100);
  assert.equal(r.plannedAverageToDataDate,100);assert.equal(r.actualAverageToDataDate,70);assert.equal(r.overloadedRowCount,1);
  assert.deepEqual(r.weeklyTotals.map(p=>p.unit).sort(),['equipment_hour','labor_hour']);assert.ok(!r.points.some(p=>p.resourceId==='M'));
});
test('resource population coverage uses the applicable master, not only observed rows',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(master);csvDoc(weekly.split('\n').slice(0,2).join('\n'));const r=canonicalResources(state);
  assert.equal(r.capacityCoveragePercent,50);assert.equal(r.expectedResourceWeekCount,2);assert.equal(r.state,'partial');
});
test('resource/master unit mismatches withhold arithmetic, not source rows',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(master);csvDoc(weekly.replace('L,2026-08-24,100,120,80,labor_hour','L,2026-08-24,100,120,80,equipment_hour'));const r=canonicalResources(state);
  assert.equal(r.points.find(p=>p.resourceId==='L')?.plannedDemand,null);assert.equal(r.capacityCoveragePercent,50);assert.ok(r.diagnostics.some(s=>s.startsWith('RESOURCE_UNIT_CLASS_CONFLICT')));
});
test('explicit approved actual usage conflicts are visible and not averaged away',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(master);csvDoc(weekly);csvDoc('Resource ID,Week Start,Actual Approved Usage,Source Status,Unit\nL,2026-08-24,90,Approved,labor_hour');const r=canonicalResources(state);
  assert.equal(r.points.find(p=>p.resourceId==='L')?.actualApprovedUsage,null);assert.ok(r.diagnostics.some(s=>s.startsWith('ACTUAL_USAGE_RECONCILIATION_CONFLICT')));
});
test('a pending same-role revision does not override an accepted resource source',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(master);csvDoc(weekly);csvDoc(weekly.replace(',120,',',999,'),'resource_register','candidate');const r=canonicalResources(state);
  assert.equal(r.plannedAverageToDataDate,100);assert.ok(r.diagnostics.some(s=>s.startsWith('CANDIDATE_REVISION_NOT_APPLIED')));
});
test('PDF SCH01 is persisted as governed control assertions and legacy PDF assertions can be refreshed from verified bytes',async t=>{
  const {store,state}=fixture(t);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const page=pdf.addPage([595,842]);
  const lines=[
    'SCHEDULE CONTROL BASIS',
    'Data Date: 31 August 2026',
    'Critical activities: TF <= 0',
    'Near Critical Activities: 0 < TF <= +5 working days',
  ];
  lines.forEach((line,index)=>page.drawText(line,{x:50,y:780-index*24,size:12,font}));
  const bytes=await pdf.save();
  const upload=await store.ingestEvidenceFile({
    projectId:'CANONICAL',
    bytes,
    mediaType:'application/pdf',
    sourceFilename:'SCH01_Schedule_Control_Basis.pdf',
    sourceRelativePath:'03_Schedule_Control/SCH01_Schedule_Control_Basis.pdf',
    uploadedAt:stamp,
    uploadIntent:'add_update',
  });
  assert.equal(upload.documentType,'schedule_control_basis');
  const doc=state.evidenceDocuments.find(d=>d.documentId===upload.documentId)!;
  const originalHash=doc.sourceHashSha256;
  assert.equal(doc.basisState,'active');
  assert.equal(projectScheduleControlBasis(state).nearCriticalWorkingDays,5);

  const controlMetrics=new Set([
    'near_critical_working_days',
    'near_critical_threshold_hours',
    'critical_float_threshold_hours',
    'schedule_control_data_date',
  ]);
  doc.assertions=doc.assertions.filter(a=>!controlMetrics.has(a.metric));
  state.sourceIntegrationVersion='canonical-source-v3';
  state.version+=1;

  const refreshed=await store.refreshScheduleControlBasisAssertions();
  assert.equal(refreshed.refreshedDocumentCount,1);
  assert.equal(doc.sourceHashSha256,originalHash);
  assert.ok(doc.diagnostics.includes('SCHEDULE_CONTROL_BASIS_ASSERTION_REFRESH_V4'));
  assert.equal(state.sourceIntegrationVersion,'canonical-source-v5');
  assert.equal(projectScheduleControlBasis(state).nearCriticalWorkingDays,5);
});

test('SCH01 threshold beyond classification sample pages is recovered by full-document extraction',async t=>{
  const {store,state}=fixture(t);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let index=1;index<=6;index+=1){
    const page=pdf.addPage([595,842]);
    const lines=index===1
      ? ['SCHEDULE CONTROL BASIS','Data Date: 31 August 2026','Critical Definition: TF <= 0']
      : index===5
        ? ['FLOAT CONTROL RULES','Near Critical Activities: 0 < TF <= +5 working days']
        : ['Schedule control supporting narrative page '+index,'Programme governance and reporting basis'];
    lines.forEach((line,row)=>page.drawText(line,{x:50,y:780-row*24,size:12,font}));
  }
  const bytes=await pdf.save();
  const upload=await store.ingestEvidenceFile({
    projectId:'CANONICAL',
    bytes,
    mediaType:'application/pdf',
    sourceFilename:'SCH01_Schedule_Control_Basis_Multipage.pdf',
    sourceRelativePath:'03_Schedule_Control/SCH01_Schedule_Control_Basis_Multipage.pdf',
    uploadedAt:stamp,
    uploadIntent:'add_update',
  });
  const doc=state.evidenceDocuments.find(d=>d.documentId===upload.documentId)!;
  const originalHash=doc.sourceHashSha256;
  assert.equal(doc.assertions.find(a=>a.metric==='near_critical_working_days')?.value,5);
  assert.equal(projectScheduleControlBasis(state).nearCriticalWorkingDays,5);
  assert.ok(
    doc.identification.diagnostics.some(
      d=>d.includes('PROJECT_CONTROL_DEEP_EXTRACTION:SCHEDULE_CONTROL_BASIS_FULL_NATIVE_TEXT_USED'),
    ),
  );

  const refreshed=await store.refreshScheduleControlBasisAssertions();
  assert.equal(refreshed.refreshedDocumentCount,0);
  assert.equal(doc.sourceHashSha256,originalHash);
  assert.equal(doc.assertions.find(a=>a.metric==='near_critical_working_days')?.value,5);
  assert.equal(projectScheduleControlBasis(state).nearCriticalWorkingDays,5);
});

test('legacy SCH01 misclassified before schedule-control rules is recovered from its original path without changing source hash',t=>{
  const {store,state,csvDoc,dir}=fixture(t);
  const doc=csvDoc(
    'Critical Definition,Near-Critical Definition,Data Date\nTF <= 0 hours,0 < TF <= +5 working days,2026-08-31',
    'schedule_control_basis',
    'historical',
  );
  doc.category='other';
  doc.documentType='supporting_document';
  doc.sourceFilename='SCH01_Schedule_Control_Basis.csv';
  doc.sourceRelativePath='03_Schedule_Control/SCH01_Schedule_Control_Basis.csv';
  doc.familyKey='other:supporting_document';
  doc.logicalDocumentKey='other:supporting_document:'+doc.documentId;
  doc.identification={
    ...doc.identification,
    detectedCategory:'other',
    detectedDocumentType:'supporting_document',
    filenameHintCategory:'other',
    filenameHintDocumentType:'supporting_document',
  } as any;
  state.activeEvidenceBasis={};
  state.sourceIntegrationVersion='canonical-source-v4';
  const hash=doc.sourceHashSha256;
  store.touch(state);

  const restored=new RuntimeProjectStore({dataDir:dir,durable:false}).get('CANONICAL')!;
  const restoredDoc=restored.evidenceDocuments.find(d=>d.documentId===doc.documentId)!;
  assert.equal(restored.sourceIntegrationVersion,'canonical-source-v5');
  assert.equal(restoredDoc.category,'schedule_control');
  assert.equal(restoredDoc.documentType,'schedule_control_basis');
  assert.equal(restoredDoc.familyKey,'schedule_control:schedule_control_basis');
  assert.equal(restoredDoc.basisState,'active');
  assert.equal(restoredDoc.sourceHashSha256,hash);
  assert.ok(restoredDoc.diagnostics.includes('SCHEDULE_CONTROL_BASIS_METADATA_MIGRATION_V5'));
  assert.ok(restoredDoc.diagnostics.includes('SCHEDULE_CONTROL_BASIS_GOVERNANCE_MIGRATION_V5'));
  assert.equal(projectScheduleControlBasis(restored).nearCriticalWorkingDays,5);
});

test('Critical Path Length is never interpreted as a critical total-float threshold',t=>{
  const {state,csvDoc}=fixture(t);
  csvDoc(
    [
      'Metric,Value,Unit,Source',
      'Critical Path Length,1200,working_day,Control basis',
      'Near Critical,629,count,TASK',
      'Negative Float,378,count,TASK',
    ].join('\n'),
    'schedule_metric_register',
  );
  const basis=projectScheduleControlBasis(state);
  assert.equal(basis.analysisConfig.criticalFloatThresholdHours,0);
  assert.equal(basis.criticalFloatThresholdHours,0);
  assert.equal(basis.nearCriticalSourceCount,629);
  assert.ok(
    !basis.diagnostics.includes('CONFLICTING_CRITICAL_FLOAT_DEFINITIONS'),
  );
});

test('project near-critical basis can be corroborated from governed SCH02 or Project Data Book when SCH01 text is not machine-readable',t=>{
  const {state,csvDoc}=fixture(t);
  csvDoc(
    'Metric,Value,Definition,As Of\nNear Critical Watchlist,629,0 < TF <= +5 working days,2026-08-31',
    'schedule_metric_register',
  );
  csvDoc(
    'Parameter,Value\nData Date,2026-08-31',
    'project_data_book',
  );
  const basis=projectScheduleControlBasis(state);
  assert.equal(basis.state,'official');
  assert.equal(basis.nearCriticalWorkingDays,5);
  assert.equal(basis.programmeDataDateIso,'2026-08-31');
  assert.ok(basis.diagnostics.includes('PROJECT_NEAR_CRITICAL_BASIS_CORROBORATED_FROM_CONTROL_REGISTER'));
});

test('source near-critical label is reconciled after CMeng independently calculates strict and watchlist populations',t=>{
  const {state,csvDoc}=fixture(t);
  state.schedules[0]!.revision.model.calendars=[
    {calendarId:'CAL8',name:'8h',semanticComplete:true,standardDayHours:8,sourceRefs:[]},
    {calendarId:'CAL10',name:'10h',semanticComplete:true,standardDayHours:10,sourceRefs:[]},
  ] as any;
  state.schedules[0]!.revision.model.activities=[
    {projectId:'CANONICAL',activityId:'A0',nativeId:'A0',name:'zero float',wbsId:null,calendarId:'CAL8',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:0,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
    {projectId:'CANONICAL',activityId:'A40',nativeId:'A40',name:'40h float',wbsId:null,calendarId:'CAL8',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:40,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
    {projectId:'CANONICAL',activityId:'A45',nativeId:'A45',name:'45h float on 10h calendar',wbsId:null,calendarId:'CAL10',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:45,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
    {projectId:'CANONICAL',activityId:'A55',nativeId:'A55',name:'55h float on 10h calendar',wbsId:null,calendarId:'CAL10',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:55,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
  ] as any;
  csvDoc(
    'Metric,Value,Unit,As Of\nNear Critical,3,count,2026-08-31',
    'schedule_metric_register',
  );
  const basis=projectScheduleControlBasis(state);
  assert.equal(basis.state,'missing');
  assert.equal(basis.nearCriticalSourceCount,3);
  assert.equal(basis.nearCriticalWorkingDays,5);
  assert.equal(basis.nearCriticalThresholdMethod,'cmeng_policy_default');
  assert.equal(basis.sourceCountReconcilesTo,'float_risk_watchlist');
  const projection=buildNearCriticalProjection(
    state.schedules[0]!.revision.model,
    {generatedAt:stamp,producerVersion:'test',config:basis.analysisConfig},
  );
  assert.deepEqual(projection.rows.map(row=>row.activityId),['A40','A45']);
  assert.deepEqual(projection.watchlistRows.map(row=>row.activityId),['A0','A40','A45']);
  assert.equal(projection.nearCriticalCount,2);
  assert.equal(projection.floatRiskWatchlistCount,3);
  assert.equal(projection.zeroFloatCount,1);
});

test('source count never reverse-engineers CMeng threshold policy',t=>{
  const {state,csvDoc}=fixture(t);
  state.schedules[0]!.revision.model.calendars=[
    {calendarId:'CAL8',name:'8h',semanticComplete:true,standardDayHours:8,sourceRefs:[]},
  ] as any;
  state.schedules[0]!.revision.model.activities=[
    {projectId:'CANONICAL',activityId:'A8',nativeId:'A8',name:'8h float',wbsId:null,calendarId:'CAL8',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:8,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
  ] as any;
  csvDoc(
    'Metric,Value,Unit\nNear Critical,999,count',
    'schedule_metric_register',
  );
  const basis=projectScheduleControlBasis(state);
  assert.equal(basis.nearCriticalWorkingDays,5);
  assert.equal(basis.nearCriticalThresholdMethod,'cmeng_policy_default');
  assert.equal(basis.sourceCountReconcilesTo,'neither');
  assert.ok(basis.diagnostics.includes('SOURCE_NEAR_CRITICAL_LABEL_DIFFERS_FROM_CMENG_CLASSIFICATIONS'));
});

test('conflicting governed project-control definitions fail closed instead of choosing a near-critical threshold',t=>{
  const {state,csvDoc}=fixture(t);
  csvDoc(
    'Metric,Value\nNear Critical Definition,0 < TF <= +5 working days',
    'schedule_control_basis',
  );
  csvDoc(
    'Metric,Value\nNear Critical Definition,0 < TF <= +7 working days',
    'schedule_metric_register',
  );
  const basis=projectScheduleControlBasis(state);
  assert.equal(basis.state,'conflicted');
  assert.equal(basis.nearCriticalWorkingDays,5);
  assert.ok(basis.diagnostics.includes('CONFLICTING_NEAR_CRITICAL_WORKING_DAY_DEFINITIONS'));
  assert.equal(basis.analysisConfig.nearCriticalWorkingDays,5);
  assert.equal(basis.nearCriticalThresholdMethod,'cmeng_policy_default');
});

test('project near-critical basis comes from SCH01 and uses each activity calendar instead of generic 40h',t=>{
  const {state,csvDoc}=fixture(t);
  state.schedules[0]!.revision.model.calendars=[
    {calendarId:'CAL8',name:'8h',semanticComplete:true,standardDayHours:8,sourceRefs:[]},
    {calendarId:'CAL10',name:'10h',semanticComplete:true,standardDayHours:10,sourceRefs:[]},
  ] as any;
  state.schedules[0]!.revision.model.activities=[
    {projectId:'CANONICAL',activityId:'A40',nativeId:'A40',name:'40h float',wbsId:null,calendarId:'CAL8',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:40,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
    {projectId:'CANONICAL',activityId:'A45',nativeId:'A45',name:'45h float on 10h calendar',wbsId:null,calendarId:'CAL10',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:45,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
    {projectId:'CANONICAL',activityId:'A55',nativeId:'A55',name:'55h float on 10h calendar',wbsId:null,calendarId:'CAL10',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:55,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
  ] as any;
  csvDoc('Critical Definition,Near-Critical Definition,Data Date\nTF <= 0 hours,0 < TF <= +5 working days,2026-08-31','schedule_control_basis');
  const basis=projectScheduleControlBasis(state);
  assert.equal(basis.state,'official');assert.equal(basis.nearCriticalWorkingDays,5);assert.equal(basis.programmeDataDateIso,'2026-08-31');
  const p=buildNearCriticalProjection(state.schedules[0]!.revision.model,{generatedAt:stamp,producerVersion:'test',config:basis.analysisConfig});
  assert.equal(p.thresholdBasis,'activity_calendar_working_days');assert.equal(p.nearCriticalThresholdWorkingDays,5);
  assert.deepEqual(p.rows.map(r=>r.activityId),['A40','A45']);assert.equal(p.rows.find(r=>r.activityId==='A45')?.nearCriticalThresholdHours,50);
});
test('IF01 and IF02 route to schedule-control productivity evidence',()=>{
  assert.equal(
    inferEvidenceCategory('03_Schedule_Control/IF01_Productivity_Work_Packages.csv'),
    'schedule_control',
  );
  assert.equal(
    inferDocumentType('03_Schedule_Control/IF01_Productivity_Work_Packages.csv'),
    'productivity_work_package_register',
  );
  assert.equal(
    inferEvidenceCategory('03_Schedule_Control/IF02_Productivity_Forecast_Basis.csv'),
    'schedule_control',
  );
  assert.equal(
    inferDocumentType('03_Schedule_Control/IF02_Productivity_Forecast_Basis.csv'),
    'productivity_forecast_basis',
  );
});

test('live IF01 source model is validated and retained without inventing an unproven calendar basis',t=>{
  const {state,csvDoc}=fixture(t);
  const doc=csvDoc(
    [
      'Work Package,Description,Discipline,Remaining Quantity,Unit,Recent Achieved Rate / Day,Conservative Achievable Rate / Day,Available Start,Productive Days,Interface Allowance Days,Independent Forecast Finish,Status',
      'WP-001,Primary productivity driver,Civil,100,m3,12,10,2026-09-01,10,2,2030-07-20,Open',
      'WP-002,Secondary package,MEP,50,no,11,10,2026-09-01,5,1,2030-07-10,Open',
    ].join('\n'),
    'boq',
    'active',
    ':legacy-if01',
  );
  doc.category='boq_cost';
  doc.documentType='boq';
  doc.sourceFilename='IF01_Productivity_Remaining_Quantity_Model.csv';
  doc.sourceRelativePath='04_Resource_Productivity/IF01_Productivity_Remaining_Quantity_Model.csv';

  const p=sourceProductivityForecastEvidence(state);
  assert.equal(p.method,'source_work_package_productivity_model');
  assert.equal(p.state,'official');
  assert.equal(p.workPackageCount,2);
  assert.equal(p.calculatedWorkPackageCount,2);
  assert.equal(p.calendarCalculatedWorkPackageCount,0);
  assert.equal(p.sourceModelWorkPackageCount,2);
  assert.equal(p.calculationCoveragePercent,100);
  assert.equal(p.driverWorkPackageId,'WP-001');
  assert.deepEqual(p.driverWorkPackageIds,['WP-001']);
  assert.equal(p.completionIso,'2030-07-20');

  const wp1=p.rows.find(row=>row.workPackageId==='WP-001')!;
  assert.equal(wp1.discipline,'Civil');
  assert.equal(wp1.remainingQuantity,100);
  assert.equal(wp1.recentAchievedRatePerDay,12);
  assert.equal(wp1.conservativeAchievableRatePerDay,10);
  assert.equal(wp1.calculatedProductiveDays,10);
  assert.equal(wp1.sourceProductiveDays,10);
  assert.equal(wp1.productiveDaysReconciliation,'reconciled');
  assert.equal(wp1.sourceInterfaceAllowanceDays,2);
  assert.equal(wp1.sourceIndependentForecastFinishIso,'2030-07-20');
  assert.equal(wp1.rateBasis,'explicit_productive_day_rate');
  assert.equal(wp1.completionBasis,'source_model_finish');
  assert.equal(wp1.completionIso,'2030-07-20');
  assert.equal(wp1.calendarId,null);
  assert.ok(
    wp1.diagnostics.includes(
      'PRODUCTIVITY_SOURCE_MODEL_ARITHMETIC_RECONCILED',
    ),
  );
  assert.ok(
    wp1.diagnostics.includes(
      'PRODUCTIVITY_SOURCE_FINISH_RETAINED_CALENDAR_BASIS_NOT_INDEPENDENTLY_RECALCULATED',
    ),
  );
});

test('live IF01 source finish fails closed when productive-day arithmetic does not reconcile',t=>{
  const {state,csvDoc}=fixture(t);
  const doc=csvDoc(
    [
      'Work Package,Description,Discipline,Remaining Quantity,Unit,Recent Achieved Rate / Day,Conservative Achievable Rate / Day,Available Start,Productive Days,Interface Allowance Days,Independent Forecast Finish,Status',
      'WP-001,Arithmetic mismatch,Civil,100,m3,12,10,2026-09-01,12,2,2030-07-20,Open',
    ].join('\n'),
    'boq',
    'active',
    ':legacy-if01',
  );
  doc.category='boq_cost';
  doc.documentType='boq';
  doc.sourceFilename='IF01_Productivity_Remaining_Quantity_Model.csv';
  doc.sourceRelativePath='04_Resource_Productivity/IF01_Productivity_Remaining_Quantity_Model.csv';

  const p=sourceProductivityForecastEvidence(state);
  assert.equal(p.method,'missing');
  assert.equal(p.state,'missing');
  assert.equal(p.completionIso,null);
  assert.equal(p.workPackageCount,1);
  assert.equal(p.calculatedWorkPackageCount,0);
  const wp=p.rows[0]!;
  assert.equal(wp.calculatedProductiveDays,10);
  assert.equal(wp.sourceProductiveDays,12);
  assert.equal(wp.productiveDaysReconciliation,'different');
  assert.equal(wp.completionBasis,'unresolved');
  assert.equal(wp.completionIso,null);
  assert.ok(
    wp.diagnostics.includes(
      'PRODUCTIVITY_SOURCE_PRODUCTIVE_DAYS_ARITHMETIC_MISMATCH',
    ),
  );
});

test('productivity producer calculates work-package completion from remaining quantity measured rate calendar and explicit allowance',t=>{
  const {state,csvDoc}=fixture(t);
  state.schedules[0]!.revision.model.calendars=[
    {
      calendarId:'CAL8',
      name:'Standard 8h',
      semanticComplete:true,
      standardDayHours:8,
      standardWeekHours:40,
      weeklyWorkIntervals:[2,3,4,5,6].map(dayIndex=>({
        dayIndex,
        intervals:[{start:'08:00',finish:'16:00',minutes:480}],
      })),
      exceptions:[],
      sourceRefs:[],
    },
  ] as any;

  csvDoc(
    [
      'Work Package ID,Description,Calendar ID,Total Quantity,Installed Quantity,Remaining Quantity,Actual Hours,As Of',
      'WP-001,Primary driver,CAL8,100,20,80,10,2026-08-31',
      'WP-002,Secondary package,CAL8,80,40,40,10,2026-08-31',
    ].join('\n'),
    'productivity_work_package_register',
    'active',
    ':if01',
  );
  csvDoc(
    [
      'Work Package ID,Conservative Factor,Interface Allowance Working Days,As Of',
      'WP-001,0.5,2,2026-08-31',
      'WP-002,0.5,1,2026-08-31',
    ].join('\n'),
    'productivity_forecast_basis',
    'active',
    ':if02',
  );

  const p=sourceProductivityForecastEvidence(state);
  assert.equal(p.method,'source_evidence_derived_productivity');
  assert.equal(p.state,'official');
  assert.equal(p.workPackageCount,2);
  assert.equal(p.calculatedWorkPackageCount,2);
  assert.equal(p.calculationCoveragePercent,100);
  assert.equal(p.driverWorkPackageId,'WP-001');
  assert.deepEqual(p.driverWorkPackageIds,['WP-001']);
  assert.equal(p.completionIso,'2026-09-15');
  assert.equal(p.submittedCompletionIso,null);
  assert.equal(p.reconciliation.state,'calculated_only');

  const wp1=p.rows.find(row=>row.workPackageId==='WP-001')!;
  assert.equal(wp1.measuredRatePerHour,2);
  assert.equal(wp1.conservativeFactor,0.5);
  assert.equal(wp1.evidencedRatePerHour,1);
  assert.equal(wp1.rateBasis,'measured_rate_with_conservative_factor');
  assert.equal(wp1.requiredWorkingHours,80);
  assert.equal(wp1.allowanceWorkingDays,2);
  assert.equal(wp1.calendarId,'CAL8');
  assert.equal(wp1.completionIso,'2026-09-15');
});

test('productivity producer fails a work package closed when interface allowance is not evidenced',t=>{
  const {state,csvDoc}=fixture(t);
  state.schedules[0]!.revision.model.calendars=[
    {
      calendarId:'CAL8',
      name:'Standard 8h',
      semanticComplete:true,
      standardDayHours:8,
      standardWeekHours:40,
      weeklyWorkIntervals:[2,3,4,5,6].map(dayIndex=>({
        dayIndex,
        intervals:[{start:'08:00',finish:'16:00',minutes:480}],
      })),
      exceptions:[],
      sourceRefs:[],
    },
  ] as any;
  csvDoc(
    [
      'Work Package ID,Calendar ID,Remaining Quantity,Installed Quantity,Actual Hours,As Of',
      'WP-001,CAL8,80,20,10,2026-08-31',
    ].join('\n'),
    'productivity_work_package_register',
    'active',
    ':if01',
  );

  const p=sourceProductivityForecastEvidence(state);
  assert.equal(p.completionIso,null);
  assert.equal(p.state,'missing');
  assert.equal(p.rows[0]?.state,'unresolved');
  assert.ok(
    p.rows[0]?.diagnostics.includes(
      'PRODUCTIVITY_INTERFACE_ALLOWANCE_NOT_ESTABLISHED',
    ),
  );
});

test('productivity producer excludes future work-package evidence beyond the programme Data Date',t=>{
  const {state,csvDoc}=fixture(t);
  state.schedules[0]!.revision.model.calendars=[
    {
      calendarId:'CAL8',
      name:'Standard 8h',
      semanticComplete:true,
      standardDayHours:8,
      standardWeekHours:40,
      weeklyWorkIntervals:[2,3,4,5,6].map(dayIndex=>({
        dayIndex,
        intervals:[{start:'08:00',finish:'16:00',minutes:480}],
      })),
      exceptions:[],
      sourceRefs:[],
    },
  ] as any;
  csvDoc(
    [
      'Work Package ID,Calendar ID,Remaining Quantity,Installed Quantity,Actual Hours,Interface Allowance Working Days,As Of',
      'WP-001,CAL8,80,20,10,0,2026-08-31',
      'WP-001,CAL8,10,90,10,0,2026-09-30',
    ].join('\n'),
    'productivity_work_package_register',
    'active',
    ':if01',
  );

  const p=sourceProductivityForecastEvidence(state);
  assert.equal(p.workPackageCount,1);
  assert.equal(p.rows[0]?.installedQuantity,20);
  assert.ok(
    p.diagnostics.some(item=>
      item.startsWith('FUTURE_PRODUCTIVITY_WORK_PACKAGE_ROW_NOT_APPLIED:'),
    ),
  );
});

test('source productivity forecast is an explicit governed position and future evidence cannot leak before the Data Date',t=>{
  const {state,csvDoc}=fixture(t);
  csvDoc('Metric,Value,As Of\nSource Productivity Forecast Completion,2030-08-31,2026-08-31\nSource Productivity Forecast Completion,2031-01-01,2026-09-30','schedule_metric_register');
  const p=sourceProductivityForecastEvidence(state);
  assert.equal(p.state,'official');assert.equal(p.completionIso,'2030-08-31');assert.ok(p.diagnostics.some(d=>d.startsWith('FUTURE_SOURCE_PRODUCTIVITY_FORECAST_NOT_APPLIED')));
});
test('L01 correspondence is resolved to source rows and determination evidence reaches the governed event chain',t=>{
  const {state,csvDoc}=fixture(t);
  csvDoc('Letter ID,Letter Date,Claim ID,Event ID,Subject\nL1,2026-08-02,C1,C1:event,Notice of delay\nL2,2026-08-16,C1,C1:event,Engineer determination','letters_notices');
  csvDoc('Claim ID,Event,Notice Date,Days Claimed,Linked Letter,Status\nC1,Access unavailable,2026-08-02,20,L1,Submitted','delay_eot_claims_register');
  csvDoc('Determination ID,Claim ID,Awarded EOT Days,Determination Date,Status,Authority,Source Letter,Governance State\nD1,C1,11,2026-08-16,Determined,Engineer,L2,Immutable','delay_eot_claims_register');
  const m=canonicalTimeClaims(state,true).delayClaims!;
  const event=m.events[0]!;
  assert.ok(event.diagnostics.some(d=>d==='LINKED_CORRESPONDENCE_VERIFIED:L1'));
  assert.ok(event.evidenceRefs.some(ref=>ref.sourceType==='correspondence'&&ref.locator==='row:2'));
  assert.ok(event.evidenceRefs.some(ref=>ref.locator==='row:2'&&ref.sourceId!==m.evidenceRevisionId));
  const determination=m.notices.find(n=>n.kind==='determination')!;
  assert.ok(determination.evidenceRefs.some(ref=>ref.sourceType==='correspondence'&&ref.locator==='row:3'));
  assert.ok(determination.diagnostics.includes('DETERMINATION_LETTER_IDENTITY_FOUND_CONTENT_REQUIRES_REVIEW'));
  assert.ok(!determination.diagnostics.includes('DETERMINATION_CORRESPONDENCE_LINK_VERIFIED'));
});

test('programme Data Date comes from the active revision, not a future candidate',t=>{
  const {state}=fixture(t);state.activeEvidenceBasis['schedule:control']={activeArtifactId:'U1'} as ProjectRuntimeState['activeEvidenceBasis'][string];
  const future=structuredClone(state.schedules[0]!);future.revision.revisionId='U2';future.revision.sequence=2;future.revision.model.dataDateIso='2027-01-01';state.schedules.push(future);
  assert.equal(projectDataDate(state),'2026-08-31');
});
test('claim-register event identities do not invent dates, responsibility or critical causation',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(claims,'delay_eot_claims_register');const m=canonicalTimeClaims(state).delayClaims!;
  assert.equal(m.events.length,1);assert.equal(m.claims[0]!.eventIds[0],m.events[0]!.eventId);assert.equal(m.events[0]!.startIso,null);assert.equal(m.events[0]!.responsibilityState,'missing');assert.equal(m.claims[0]!.assessedDaysState,'candidate');assert.equal(m.notices[0]!.actualIssuedAt,'2026-08-02');
});
test('determination register total, as-of total and future population remain separate',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(claims,'delay_eot_claims_register');csvDoc(determinations,'delay_eot_claims_register');amendment(state);const m=canonicalTimeClaims(state);
  assert.equal(m.registerDeterminationDays,138);assert.equal(m.effectiveDeterminationDays,26);assert.equal(m.futureDeterminationCount,1);
  assert.equal(m.contractTimeBasis?.contractualCompletionIso,'2030-03-31');assert.equal(m.contractTimeBasis?.incorporatedEotDays,90);assert.equal(m.contractTimeBasis?.additionalApprovedEotDays,null);assert.equal(m.contractTimeBasis?.overlapResolution,'unresolved');
});
test('conflicting immutable determination IDs fail closed instead of summing or overwriting',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(determinations+'\nD1,C1,99,2026-07-24,Determined,Engineer,L1,Immutable','delay_eot_claims_register');const m=canonicalTimeClaims(state);
  assert.equal(m.registerDeterminationDays,null);assert.equal(m.effectiveDeterminationDays,null);assert.ok(m.diagnostics.some(s=>s.startsWith('IMMUTABLE_DETERMINATION_CONFLICT')));
});
test('explicit same-claim supersession removes only the superseded determination',t=>{
  const {state,csvDoc}=fixture(t);csvDoc('Determination ID,Claim ID,Awarded EOT Days,Determination Date,Status,Authority,Source Letter,Governance State,Supersedes\nD1,C1,10,2026-07-01,Determined,Engineer,L1,Immutable,\nD2,C1,15,2026-08-01,Determined,Engineer,L2,Immutable,D1','delay_eot_claims_register');
  assert.equal(canonicalTimeClaims(state).registerDeterminationDays,15);
});
test('future-only dated awards establish zero as-of, not a missing whole register',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(determinations.split('\n')[0]+'\nD1,C1,10,2027-01-01,Determined,Engineer,L1,Immutable','delay_eot_claims_register');const m=canonicalTimeClaims(state);assert.equal(m.registerDeterminationDays,10);assert.equal(m.effectiveDeterminationDays,0);
});
test('commercial values stay separated by currency, tax basis and period',t=>{
  const {state,csvDoc}=fixture(t);csvDoc('Metric,Value,Unit,Status,As Of,VAT Basis\nBAC,1000,AED,Approved,2026-08-31,Exclusive\nEV,200,AED,Approved,2026-08-31,Exclusive\nAC,250,AED,Actual,2026-08-31,Exclusive\nPV,300,AED,Plan,2026-08-31,Exclusive\nEAC,1300,AED,Forecast,2026-08-31,Exclusive\nBAC,100,KWD,Approved,2026-08-31,Exclusive\nAC,20.123,KWD,Actual,2026-08-31,Exclusive\nEV,25,AED,Approved,2026-08-31,Inclusive\nBAC,9000,AED,Future,2027-01-01,Exclusive','cost_evm_report');const m=commercialCanonical(state);
  assert.equal(m.costPosition.length,3);const a=m.costPosition.find(p=>p.currency==='AED'&&p.taxBasis==='exclusive')!;assert.equal(a.values.cpi,0.8);assert.equal(a.values['cpi scenario eac'],1250);assert.equal(a.values.eac,1300);assert.equal(a.values['calculated vac'],-300);
  const k=m.costPosition.find(p=>p.currency==='KWD')!;assert.equal(k.values.ac,20.123);assert.equal(k.values.cpi,null);
});
test('missing cost evidence and unknown tax basis do not manufacture EVM ratios',t=>{
  const {state,csvDoc}=fixture(t);csvDoc('Metric,Value,Unit,Status,As Of\nEV,200,USD,Source,2026-08-31\nAC,250,USD,Source,2026-08-31','cost_evm_report');const p=commercialCanonical(state).costPosition[0]!;assert.equal(p.values.cpi,null);assert.ok(p.diagnostics.includes('TAX_BASIS_UNKNOWN_DERIVED_METRICS_WITHHELD'));
});
test('payment application, assessment, certification and receipts are never conflated',t=>{
  const {state,csvDoc}=fixture(t);csvDoc('Certificate No,Period End,Gross Work,Variations,Retention,Advance Recovery,Other Deductions,Net Certified,VAT Basis,Status,Currency\nIPC1,2026-08-31,1000,100,50,20,0,1030,Exclusive,Paid,AED','payment_certificates');const p=commercialCanonical(state).payments[0]!;
  assert.equal(p.amounts.applicationAmount.value,null);assert.equal(p.amounts.engineerAssessedAmount.value,null);assert.equal(p.amounts.employerCertifiedAmount.value,null);assert.equal(p.amounts.paidAmount.value,null);assert.equal(p.amounts.outstandingAmount.value,null);assert.equal(p.amounts.netCertifiedAmount.value,1030);assert.equal(p.reconciliation,'matched');
});
test('currency inheritance requires an explicit applicable contract statement and receipt',t=>{
  const {state,csvDoc}=fixture(t);csvDoc('Certificate No,Period End,Net Certified,VAT Basis\nIPC1,2026-08-31,1000,Exclusive','payment_certificates');assert.equal(commercialCanonical(state).payments[0]!.amounts.netCertifiedAmount.currency,null);
  amendment(state);const p=commercialCanonical(state).payments[0]!;assert.equal(p.amounts.netCertifiedAmount.currency,'AED');assert.ok(p.amounts.netCertifiedAmount.receipts.some(r=>r.documentId==='AMD'&&r.locator==='page:2'));
});
test('legacy SCH01 reference state migrates once to governed active basis without changing source bytes',t=>{
  const {store,state,csvDoc,dir}=fixture(t);
  const doc=csvDoc(
    'Critical Definition,Near-Critical Definition,Data Date\nTF <= 0 hours,0 < TF <= +5 working days,2026-08-31',
    'schedule_control_basis',
    'historical',
  );
  doc.familyKey='schedule_control:schedule_control_basis';
  doc.logicalDocumentKey='schedule_control:schedule_control_basis:'+doc.sourceFilename;
  state.activeEvidenceBasis={};
  state.sourceIntegrationVersion='canonical-source-v2';
  const hash=doc.sourceHashSha256;
  store.touch(state);

  const restored=new RuntimeProjectStore({dataDir:dir,durable:false}).get('CANONICAL')!;
  const restoredDoc=restored.evidenceDocuments.find(d=>d.documentId===doc.documentId)!;
  assert.equal(restored.sourceIntegrationVersion,'canonical-source-v5');
  assert.equal(restoredDoc.basisState,'active');
  assert.equal(restoredDoc.sourceHashSha256,hash);
  assert.equal(restored.activeEvidenceBasis['schedule_control:schedule_control_basis']?.activeDocumentId,doc.documentId);
  assert.ok(restoredDoc.diagnostics.includes('SCHEDULE_CONTROL_BASIS_GOVERNANCE_MIGRATION_V5'));
  const basis=projectScheduleControlBasis(restored);
  assert.equal(basis.state,'official');
  assert.equal(basis.nearCriticalWorkingDays,5);

  const version=restored.version;
  const again=new RuntimeProjectStore({dataDir:dir,durable:false}).get('CANONICAL')!;
  assert.equal(again.version,version);
  assert.equal(again.evidenceDocuments.find(d=>d.documentId===doc.documentId)?.basisState,'active');
});
test('legacy typed-family migration is audited, durable and does not modify source hashes',t=>{
  const {store,state,csvDoc,dir}=fixture(t);const a=csvDoc(master),b=csvDoc(weekly,'resource_register','candidate');for(const d of [a,b]){d.familyKey='schedule_control:resource_register';d.logicalDocumentKey=d.familyKey;}state.activeEvidenceBasis[a.familyKey]={familyKey:a.familyKey,activeDocumentId:a.documentId,activeArtifactId:null,behavior:'snapshot',updatedAt:stamp,reason:'legacy',previousDocumentIds:[]};
  const hashes=state.evidenceDocuments.map(d=>d.sourceHashSha256);store.touch(state);const restored=new RuntimeProjectStore({dataDir:dir,durable:false}).get('CANONICAL')!;
  assert.notEqual(restored.evidenceDocuments[0]!.familyKey,restored.evidenceDocuments[1]!.familyKey);assert.ok(restored.evidenceDocuments.every(d=>d.basisState==='active'));assert.deepEqual(restored.evidenceDocuments.map(d=>d.sourceHashSha256),hashes);assert.ok(restored.evidenceDocuments[1]!.diagnostics.some(d=>d.startsWith('SOURCE_ROLE_FAMILY_MIGRATION_V1')));
  const version=restored.version;const again=new RuntimeProjectStore({dataDir:dir,durable:false}).get('CANONICAL')!;assert.equal(again.version,version);
});
test('seven commercial views are real canonical projections with evidence-driven module status',t=>{
  const {state,csvDoc}=fixture(t);csvDoc('Metric,Value,Unit,Status,As Of,VAT Basis\nBAC,100,USD,Approved,2026-08-31,Exclusive','cost_evm_report');
  const keys=['commercial-overview','cost-forecast','variations-change','payments','cash-flow','commercial-claims-notices','contract-particulars-bonds'];
  const expectedStatus:Record<string,string>={
    'commercial-overview':'ready',
    'cost-forecast':'ready',
    'variations-change':'partial',
    'payments':'partial',
    'cash-flow':'partial',
    'commercial-claims-notices':'partial',
    'contract-particulars-bonds':'partial',
  };
  const positions=keys.map(key=>{
    const m=canonicalCommercialModule(state,key)!;
    assert.equal(m.key,key);
    assert.equal(m.status,expectedStatus[key]);
    const data=m.data as {projectionKey:string;position:{sourceLedger:{producerVersion:string;costPosition:Array<{values:Record<string,number>}>}}};
    assert.ok(data.projectionKey);
    assert.equal(data.position.sourceLedger.producerVersion,'commercial-canonical-v1');
    return data.position;
  });
  assert.ok(positions.every(p=>p===positions[0]));
  assert.equal(positions[0]!.sourceLedger.costPosition[0]!.values.bac,100);
});

test('amendment overlap cannot add the full determination total twice',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(determinations,'delay_eot_claims_register');amendment(state);
  const windows={windows:[],diagnostics:[],positiveProgrammeMovementDays:0} as unknown as Parameters<typeof buildEotAssessmentProjection>[0];
  const delay={projectId:state.projectId,events:[],claims:[],diagnostics:[]} as unknown as Parameters<typeof buildEotAssessmentProjection>[1];
  const p=buildEotAssessmentProjection(windows,delay,canonicalTimeClaims(state).contractTimeBasis!,{generatedAt:stamp,producerVersion:'test'});
  assert.equal(p.officialAdjustedCompletionIso,null);assert.equal(p.timeBasisReconciliation?.incorporatedEotDays,90);assert.equal(p.timeBasisReconciliation?.additionalApprovedEotDays,null);
});
test('commercial and EOT user views expose stage separation and double-counting safeguards',()=>{
  const html=cmengUatHtml();for(const term of ['commercial-cost-position','commercial-payment-register','Payment stages and certificates','CPI scenario EAC','Amendment and determination reconciliation','Weekly resource utilization detail'])assert.ok(html.includes(term),term);
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(script);assert.doesNotThrow(()=>new Function(script));
});


test('future supersession does not remove an award from an earlier reporting cutoff', t => {
  const {state,csvDoc}=fixture(t);
  csvDoc('Determination ID,Claim ID,Awarded EOT Days,Determination Date,Status,Authority,Source Letter,Governance State,Supersedes\nD1,C1,10,2026-07-01,Determined,Engineer,L1,Immutable,\nD2,C1,15,2026-09-01,Determined,Engineer,L2,Immutable,D1','delay_eot_claims_register');
  const model=canonicalTimeClaims(state);
  assert.equal(model.registerDeterminationDays,15);
  assert.equal(model.effectiveDeterminationDays,10);
  assert.equal(model.futureDeterminationCount,1);
});
test('a later candidate amendment does not displace the official contractual date', t => {
  const {state}=fixture(t);amendment(state);
  const doc=structuredClone(state.evidenceDocuments[0]!);doc.documentId='PENDING';doc.basisState='candidate';state.evidenceDocuments.push(doc);
  const contract=structuredClone(state.contractDocuments[0]!);contract.documentId='PENDING';
  contract.result.sections[0]!.text='Effective Date 20 August 2026\nRevised Contractual Completion 31 May 2030\nEOT Granted 151 calendar days';
  state.contractDocuments.push(contract);state.version++;
  const model=canonicalTimeClaims(state);
  assert.equal(model.contractTimeBasis?.contractualCompletionIso,'2030-03-31');
  assert.equal(model.contractTimeBasis?.contractualCompletionState,'official');
  assert.ok(model.diagnostics.includes('CANDIDATE_AMENDMENT_NOT_APPLIED'));
});
test('source-derived current facts clear after evidence is no longer active while immutable history remains', t => {
  const {state,csvDoc}=fixture(t);const doc=csvDoc(claims,'delay_eot_claims_register');amendment(state);
  synchronizeCanonicalTimeClaims(state,true);assert.equal(state.controls.delayClaims?.events.length,1);
  const history=structuredClone(state.delayEventHistory);
  doc.basisState='historical';state.evidenceDocuments.find(d=>d.documentId==='AMD')!.basisState='historical';state.version++;
  synchronizeCanonicalTimeClaims(state,true);
  assert.equal(state.controls.delayClaims,null);assert.equal(state.controls.contractTimeBasis,null);
  assert.deepEqual(state.delayEventHistory,history);
});
const paymentColumns=['Certificate No','Period End','Gross Work','Variations','Retention','Advance Recovery','Other Deductions','Net Certified','VAT Basis','Currency','Paid Amount','Paid Date','Payment Reference','Paid Amount Basis','Payment Source Status','Outstanding Amount'];
function paymentFixture(t:Parameters<typeof fixture>[0], overrides:Record<string,string>={}) {
  const fx=fixture(t);
  const row:Record<string,string>={'Certificate No':'IPC1','Period End':'2026-08-31','Gross Work':'1000','Variations':'100','Retention':'50','Advance Recovery':'20','Other Deductions':'10','Net Certified':'1020','VAT Basis':'Exclusive','Currency':'AED','Paid Amount':'200','Paid Date':'2026-08-31','Payment Reference':'RECEIPT1','Paid Amount Basis':'cumulative','Payment Source Status':'posted','Outstanding Amount':'820',...overrides};
  const headers=[...new Set([...paymentColumns,...Object.keys(overrides)])];
  fx.csvDoc(headers.join(',')+'\n'+headers.map(h=>row[h]??'').join(','),'payment_certificates');
  return commercialCanonical(fx.state).payments[0]!;
}
test('certificate reconciliation includes explicitly recorded other deductions', t => {
  const p=paymentFixture(t);assert.equal(p.reconciliation,'matched');
  assert.equal(p.calculatedOutstandingAmount.value,820);assert.equal(p.calculatedOutstandingAmount.state,'official');
});
test('unprovided deductions stay unknown and cannot yield a matched certificate', t => {
  const p=paymentFixture(t,{'Other Deductions':''});assert.equal(p.reconciliation,'unresolved');
});
test('net inclusive tax is added only to explicitly exclusive components with a tax amount', t => {
  const p=paymentFixture(t,{'Net Certified':'1122','Net VAT Basis':'Inclusive','Tax Amount':'102','Paid VAT Basis':'Inclusive','Outstanding Amount':'922'});
  assert.equal(p.reconciliation,'matched');assert.equal(p.calculatedOutstandingAmount.value,922);
});
test('a tax-basis transition without tax evidence remains unresolved', t => {
  const p=paymentFixture(t,{'Net VAT Basis':'Inclusive'});assert.equal(p.reconciliation,'unresolved');
});
test('calculated outstanding never overwrites a contradictory source figure', t => {
  const p=paymentFixture(t,{'Outstanding Amount':'900'});
  assert.equal(p.amounts.outstandingAmount.value,900);assert.equal(p.calculatedOutstandingAmount.value,820);
  assert.equal(p.calculatedOutstandingAmount.state,'conflicted');
});
for(const [name,override] of Object.entries({
  undated:{'Paid Date':''},future:{'Paid Date':'2026-09-01'},unallocated:{'Paid Amount Basis':'incremental'},
  unapproved:{'Payment Source Status':'pending'},missingReceipt:{'Payment Reference':''},
  differentCurrency:{'Paid Currency':'USD'},unknownTax:{'VAT Basis':''},
})) test('cash balance does not become official from '+name+' payment evidence', t => {
  const p=paymentFixture(t,override);assert.equal(p.amounts.paidAmount.value,200);
  assert.equal(p.calculatedOutstandingAmount.value,null);
});


test('C2B2 canonical Commercial ingestion distinguishes VO references from standalone SI and ingests obligation insurance retention registers',t=>{
  const {state,csvDoc}=fixture(t);

  csvDoc(
    [
      'Variation ID,Status,Description,Instruction ID,Instruction Date,Approved Amount AED,Approval Date,Claim ID,Certificate No,Activity IDs,Clause',
      'VO-001,Approved,Design change,SI-REF-001,2026-07-01,400000,2026-07-31,CLM-001,IPC-08,A100;A110,13.3',
    ].join('\n'),
    'variation_register',
  );

  let model=commercialCanonical(state);
  assert.equal(model.variations.length,1);
  assert.equal(model.variations[0]?.instructionId,'SI-REF-001');
  assert.deepEqual(model.variations[0]?.activityIds,['A100','A110']);
  assert.equal(model.siteInstructions.length,0,'a variation reference must not fabricate a Site Instruction record');

  csvDoc(
    [
      'Instruction ID,Issue Date,Status,Instruction Description,Quotation Due Date,Estimated Amount AED,Variation ID,Clause',
      'SI-002,2026-08-01,Open,Revise drainage route,2026-08-10,100000,,13.1',
    ].join('\n'),
    'site_instruction_register',
    'active',
    ':si',
  );
  csvDoc(
    [
      'Policy ID,Status,Insurance Type,Insurer,Inception Date,Expiry Date,Coverage Amount AED,Clause Reference',
      'POL-01,Active,Third Party Liability,Insurer,2026-01-01,2026-09-15,5000000,18.2',
    ].join('\n'),
    'insurance_register',
    'active',
    ':insurance',
  );
  csvDoc(
    [
      'Obligation ID,Status,Clause,Description,Responsible Party,Due Date,Evidence Reference',
      'OBL-01,Open,4.2,Renew performance security,Contractor,2026-08-15,BG-01',
    ].join('\n'),
    'contract_obligations_register',
    'active',
    ':obligation',
  );
  csvDoc(
    [
      'Retention ID,Status,Certificate No,Retention Amount AED,Release Trigger,Release Due Date',
      'RET-01,Held,IPC-07,200000,Taking Over Certificate,2026-08-15',
    ].join('\n'),
    'retention_register',
    'active',
    ':retention',
  );

  model=commercialCanonical(state);
  assert.equal(model.siteInstructions.length,1);
  assert.equal(model.siteInstructions[0]?.instructionId,'SI-002');
  assert.equal(model.siteInstructions[0]?.estimatedAmount.value,100000);
  assert.equal(model.insurances.length,1);
  assert.equal(model.insurances[0]?.coverageAmount.value,5000000);
  assert.equal(model.obligations.length,1);
  assert.equal(model.obligations[0]?.dueDate,'2026-08-15');
  assert.equal(model.retentions.length,1);
  assert.equal(model.retentions[0]?.amount.value,200000);
  assert.ok(model.siteInstructions[0]?.receipt.locator.startsWith('row:'));
  assert.ok(model.insurances[0]?.receipt.documentId);
});


test('embedded usage cannot become approved actuals without its approved source register',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(master);csvDoc(weekly);const summary=canonicalResources(state);
  assert.equal(summary.actualAverageToDataDate,null);
  assert.ok(summary.points.every(row=>row.actualApprovedUsage===null));
  assert.ok(summary.diagnostics.some(d=>d.startsWith('UNAPPROVED_EMBEDDED_ACTUAL_USAGE_WITHHELD')));
});
test('weekly actuals stop at Data Date in both resource and manhour views, with same-period plan variance',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(master);
  csvDoc('Resource ID,Week Start,Available Capacity,Planned Demand,Actual Approved Usage,Unit\nL,2026-08-24,100,120,80,labor_hour\nL,2026-09-07,100,150,50,labor_hour');
  csvDoc('Resource ID,Week Start,Actual Approved Usage,Source Status,Unit\nL,2026-08-24,80,Approved,labor_hour\nL,2026-09-07,50,Approved,labor_hour');
  const resources=canonicalResourceModule(state,'resource-utilization')!.data as any;
  const hours=canonicalResourceModule(state,'manhour-scurve')!.data as any;
  assert.equal(resources.assignedResourceCount,0,'weekly resources do not manufacture P6 assignments');
  assert.equal(resources.weeklyObservedResourceCount,1);assert.equal(resources.capacityBasedResourceCount,0);
  assert.equal(resources.weeklyCapacityEvidence.points[1].actualApprovedUsage,null);
  assert.equal(hours.points[1].actualCumulativeHours,null);assert.equal(hours.plannedHoursToDataDate,120);assert.equal(hours.actualHoursToDataDate,80);
  assert.equal(hours.actualMinusPlannedHoursToDataDate,-40);assert.equal(hours.plannedHoursKnown,270);assert.equal(hours.actualPeriodCoveragePercent,100);
});

test('resource-week overload position stops at the Data Date and remains distinct from resources ever overloaded',t=>{
 const {state,csvDoc}=fixture(t);
 csvDoc('Resource ID,Week Start,Available Capacity,Planned Demand,Unit,Class\nL,2026-08-24,100,110,labor_hour,Labor\nL,2026-08-31,100,90,labor_hour,Labor\nL,2026-09-07,100,200,labor_hour,Labor');
 csvDoc('Resource ID,Week Start,Actual Approved Usage,Source Status,Unit\nL,2026-08-24,120,Approved,labor_hour\nL,2026-08-31,80,Approved,labor_hour\nL,2026-09-07,300,Approved,labor_hour');
 const r=canonicalResources(state);assert.deepEqual(r.capacityChecksToDataDate?.actual,{comparableCount:2,exceededCount:1,resourceCount:1});
 assert.deepEqual(r.capacityChecksToDataDate?.planned,{comparableCount:2,exceededCount:1,resourceCount:1});assert.equal(r.overloadedRowCount,2);
});

test('HSE text PDF summaries refresh for any project, preserve source hashes, and never fabricate incident closure',async t=>{
 const {store,state}=fixture(t);const pdf=await PDFDocument.create();const page=pdf.addPage([600,800]);
 page.drawText('Reporting Month August 2026\nTotal Manhours 250000\nLost Time Injuries 3\nMedical Treatment Cases 2\nFirst Aid Cases 17\nNear Misses 31\nLTIFR 12\nTRIR 4',{x:30,y:750,size:12});
 const bytes=Buffer.from(await pdf.save());const hash=createHash('sha256').update(bytes).digest('hex');const dir=mkdtempSync(join(tmpdir(),'hse-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'unrelated-name.pdf');writeFileSync(path,bytes);
 const doc={documentId:'unrelated-hse',documentType:'hse_report',sourceFilename:'unrelated-name.pdf',mediaType:'application/pdf',storedPath:path,sourceHashSha256:hash,basisState:'active'} as StoredEvidenceDocument;state.evidenceDocuments.push(doc);
 const result=await store.refreshHseReports(state.projectId);assert.equal(result.refreshedDocumentCount,1);assert.equal(doc.hseSummary?.metrics.lostTimeInjuries,3);assert.equal(doc.hseSummary?.periodEndIso,'2026-08-31');assert.equal(doc.hseSummary?.sourceHashSha256,hash);
 assert.equal((await store.refreshHseReports(state.projectId)).refreshedDocumentCount,0);
});


test('source claim reporting preserves granted and assessed values separately across all claim consumers',t=>{
 const {state,csvDoc}=fixture(t);
 csvDoc('Claim ID,Event,Notice Date,Days Claimed,Source Granted Days,Status\nXX-A,Access,2026-07-02,31,11,Determined','delay_eot_claims_register');
 csvDoc('Claim ID,Assessed Days,Employer Delay Days,Contractor Delay Days\nXX-A,7,5,2','delay_eot_claims_register','active',':assessment');
 const source=canonicalTimeClaims(state).delayClaims!;
 const report=claimsReporting(state)!;
 assert.equal(source.claims[0]!.sourceRegister!.registerGrantedDays,11);
 assert.equal(report.reported.claimedDays.value,31);assert.equal(report.reported.assessedDays.value,7);
 assert.equal(report.reported.employerDelayDays.value,5);assert.equal(report.reported.contractorDelayDays.value,2);
 assert.equal(report.current.claims[0]!.assessedDays,null);assert.ok(report.reported.conflictingRows[0]!.diagnostics.includes('REGISTER_DETERMINED_STATUS_NOT_IN_DETERMINATION_REGISTER'));
});

test('certificate source sums retain current and future values without certification or cash authority',t=>{
 const {state,csvDoc}=fixture(t);amendment(state);
 csvDoc('Certificate No,Period End,Gross Work,Variations,Retention,Advance Recovery,Net Certified,Currency,VAT Basis,Status\nOTHER-1,2026-08-01,100,20,6,10,104,AED,Exclusive of VAT,Certified\nOTHER-2,2026-09-01,200,10,8,10,192,AED,Exclusive of VAT,Certified','payment_certificate');
 const p=certificateProfile(commercialCanonical(state));const g=p.groups[0]!;
 assert.equal(g.as_of.length,1);assert.equal(g.future.length,1);assert.equal(g.totals!.netCertifiedAmount,104);assert.equal(g.futureTotals!.netCertifiedAmount,192);
 assert.deepEqual(g.certificationUnconfirmedIds,['OTHER-1']);assert.deepEqual(g.futureSourceStatusConflictIds,['OTHER-2']);assert.equal(g.cumulativeBasis,'source_row_sum_only');
});

test('individual resource overload survives aggregation below total capacity',t=>{
 const {state,csvDoc}=fixture(t);csvDoc('Resource ID,Resource Name,Class,Unit,Utilization Applicable\nA,Trade A,Labor,labor_hour,Yes\nB,Trade B,Labor,labor_hour,Yes');
 csvDoc('Resource ID,Week Start,Available Capacity,Planned Demand,Actual Approved Usage,Unit\nA,2026-08-24,100,150,120,labor_hour\nB,2026-08-24,100,10,10,labor_hour','resource_register','active',':capacity');
 csvDoc('Resource ID,Week Start,Actual Approved Usage,Unit,Source Status\nA,2026-08-24,120,labor_hour,Approved\nB,2026-08-24,10,labor_hour,Approved','resource_register','active',':approved');
 const p=canonicalResourceModule(state,'resource-utilization')!.data as any;
 const w=p.basisComparison.capacityExceptionTrend[0];assert.equal(w.plannedExceeded,1);assert.equal(w.actualExceeded,1);assert.equal(w.comparableCount,2);
});

test('contract amount selection respects version dates without borrowing the budget',t=>{
 const {state}=fixture(t);
 function contract(id:string,role:'main'|'amendment',text:string){
  state.evidenceDocuments.push({documentId:id,basisState:role==='main'?'active':'additive'} as StoredEvidenceDocument);
  state.contractDocuments.push({documentId:id,role,sourceFilename:id+'.pdf',result:{sections:[{text,startPage:2,sourceMode:'deterministic',sectionKey:'cover'}],pdf:{pages:[]}}} as unknown as ProjectRuntimeState['contractDocuments'][number]);
 }
 contract('ORIGINAL','main','Accepted Contract Amount AED 1,000 excluding VAT');
 contract('AMENDED','amendment','Effective Date 1 July 2026\nrevised contract value aed 1,250 excluding VAT');
 contract('FUTURE','amendment','Effective Date 1 January 2027\nRevised Contract Value AED 1,800 excluding VAT');
 contract('UNDATED','amendment','Revised Contract Value AED 9,000 excluding VAT');
 const r=contractValueBasisReview(state);
 assert.equal(r.current!.amount,1250);assert.equal(r.current!.currency,'AED');
 assert.equal(r.rows.find(r=>r.documentId==='FUTURE')!.scope,'future');assert.equal(r.rows.find(r=>r.documentId==='UNDATED')!.scope,'undated');
 contract('CONFLICT','amendment','Effective Date 1 July 2026\nRevised Contract Value AED 1,260 excluding VAT');
 assert.equal(contractValueBasisReview(state).current,null);assert.equal(contractValueBasisReview(state).state,'conflicted');
});

test('notice cover-table period remains a source rule with its unknown trigger visible',t=>{
 const {state}=fixture(t);
 for(const [id,role,text] of [['ORIG','main','Initial Claim Notice 40 days'],['AMEND','amendment','Effective Date 1 July 2026\nInitial notice of claim shall be given within 18 days after the Contractor became aware']] as const){
  state.evidenceDocuments.push({documentId:id,basisState:'active'} as StoredEvidenceDocument);
  state.contractDocuments.push({documentId:id,role,result:{sections:[{text,startPage:1,sectionKey:'cover',sourceMode:'deterministic'}],pdf:{pages:[]}}} as unknown as ProjectRuntimeState['contractDocuments'][number]);
 }
 const rules=contractNoticeRules(state);
 assert.equal(rules[0]!.noticePeriodDays,40);assert.equal(rules[0]!.triggerBasis,'not_stated');assert.equal(rules[0]!.effectiveToIso,'2026-07-01');
 assert.equal(rules[1]!.noticePeriodDays,18);assert.equal(rules[1]!.triggerBasis,'awareness');
});
