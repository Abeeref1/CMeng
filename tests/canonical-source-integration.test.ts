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
import { canonicalResources } from '../packages/runtime-api/src/canonical-resource-runtime';
import { projectScheduleControlBasis } from '../packages/runtime-api/src/schedule-control-basis';
import { sourceProductivityForecastEvidence } from '../packages/runtime-api/src/source-productivity-forecast';
import { buildNearCriticalProjection } from '../packages/near-critical-analysis/src';
import { commercialCanonical } from '../packages/runtime-api/src/commercial-canonical';
import { identifyEvidenceDocument } from '../packages/runtime-api/src/document-identification';
import { buildEotAssessmentProjection } from '../packages/eot-assessment/src';
import type { ProjectRuntimeState, StoredEvidenceDocument } from '../packages/runtime-api/src/project-state-types';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';
import { PDFDocument, StandardFonts } from 'pdf-lib';

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
test('source receipt hashes are checked again when stored bytes change',t=>{
  const {csvDoc}=fixture(t);const d=csvDoc(master);assert.equal(sourceTables([d],[]).length,1);
  writeFileSync(d.storedPath,master+'\nchanged');const diagnostics:string[]=[];assert.equal(sourceTables([d],diagnostics).length,0);assert.ok(diagnostics.some(s=>s.startsWith('SOURCE_HASH_MISMATCH')));
});
test('malformed row widths and duplicate normalized headers are not silently repaired',t=>{
  const {csvDoc}=fixture(t);const a=csvDoc('A,B\n1,2,3'),b=csvDoc('Resource ID,resource_id\n1,2');const d:string[]=[];
  assert.equal(sourceTables([a,b],d).length,0);assert.ok(d.some(s=>s.startsWith('CSV_ROW_WIDTH_MISMATCH')));assert.ok(d.some(s=>s.startsWith('DUPLICATE_NORMALIZED_HEADERS')));
});
test('resource quantities are partitioned by class and unit; materials never enter utilization',t=>{
  const {state,csvDoc}=fixture(t);csvDoc(master);csvDoc(weekly);const r=canonicalResources(state);
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
  assert.equal(doc.assertions.some(a=>a.metric==='near_critical_working_days'),false);

  const refreshed=await store.refreshScheduleControlBasisAssertions();
  assert.equal(refreshed.refreshedDocumentCount,1);
  assert.equal(doc.sourceHashSha256,originalHash);
  assert.equal(doc.assertions.find(a=>a.metric==='near_critical_working_days')?.value,5);
  assert.equal(projectScheduleControlBasis(state).nearCriticalWorkingDays,5);
  assert.ok(refreshed.diagnostics.some(d=>d.startsWith('SCHEDULE_CONTROL_BASIS_FULL_NATIVE_TEXT_USED')));
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

test('source near-critical population can uniquely reconcile the project working-day threshold without hard-coding it',t=>{
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
  csvDoc(
    'Metric,Value,As Of\nNear Critical Watchlist Count,2,2026-08-31',
    'schedule_metric_register',
  );
  const basis=projectScheduleControlBasis(state);
  assert.equal(basis.state,'official');
  assert.equal(basis.nearCriticalSourceCount,2);
  assert.equal(basis.nearCriticalWorkingDays,5);
  assert.equal(basis.nearCriticalThresholdMethod,'source_count_reconciliation');
  assert.ok(basis.diagnostics.includes('NEAR_CRITICAL_WORKING_DAYS_RECONCILED_FROM_SOURCE_COUNT:2:5'));
  const projection=buildNearCriticalProjection(
    state.schedules[0]!.revision.model,
    {generatedAt:stamp,producerVersion:'test',config:basis.analysisConfig},
  );
  assert.deepEqual(projection.rows.map(row=>row.activityId),['A40','A45']);
});

test('source population reconciliation fails closed when more than one working-day threshold reproduces the count',t=>{
  const {state,csvDoc}=fixture(t);
  state.schedules[0]!.revision.model.calendars=[
    {calendarId:'CAL8',name:'8h',semanticComplete:true,standardDayHours:8,sourceRefs:[]},
  ] as any;
  state.schedules[0]!.revision.model.activities=[
    {projectId:'CANONICAL',activityId:'A8',nativeId:'A8',name:'8h float',wbsId:null,calendarId:'CAL8',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:8,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]},
  ] as any;
  csvDoc(
    'Metric,Value\nNear Critical Watchlist Count,1',
    'schedule_metric_register',
  );
  const basis=projectScheduleControlBasis(state);
  assert.equal(basis.nearCriticalWorkingDays,null);
  assert.equal(basis.nearCriticalThresholdMethod,'unresolved');
  assert.ok(basis.diagnostics.some(d=>d.startsWith('NEAR_CRITICAL_SOURCE_COUNT_SOLUTION_NOT_UNIQUE:1:')));
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
  assert.equal(basis.nearCriticalWorkingDays,null);
  assert.ok(basis.diagnostics.includes('CONFLICTING_NEAR_CRITICAL_WORKING_DAY_DEFINITIONS'));
  assert.equal(basis.analysisConfig.nearCriticalWorkingDays,null);
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
  assert.ok(m.notices.some(n=>n.kind==='determination'&&n.diagnostics.includes('DETERMINATION_CORRESPONDENCE_LINK_VERIFIED')));
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
test('seven commercial views reuse the identical source-ledger position rather than page calculators',t=>{
  const {state,csvDoc}=fixture(t);csvDoc('Metric,Value,Unit,Status,As Of,VAT Basis\nBAC,100,USD,Approved,2026-08-31,Exclusive','cost_evm_report');
  const keys=['commercial-overview','cost-forecast','variations-change','payments','cash-flow','commercial-claims-notices','contract-particulars-bonds'];
  const positions=keys.map(key=>{const m=canonicalCommercialModule(state,key)!;assert.equal(m.key,key);assert.equal(m.status,'partial');return (m.data as {position:{sourceLedger:{costPosition:Array<{values:Record<string,number>}>}}}).position;});
  assert.ok(positions.every(p=>p===positions[0]));assert.equal(positions[0]!.sourceLedger.costPosition[0]!.values.bac,100);
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
