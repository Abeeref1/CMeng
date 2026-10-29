import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// M4.2 invariant: a register row's scope comes from the earliest date that shows
// the requirement exists, planned, due and required dates included. With a Data
// Date, dated rows split into current and future; none is "undated". Without a
// Data Date, the reason is the missing Data Date, not the row.

const DEFAULT_TEXT='Submittal No,Title,Planned Submission,Due Date,Status\nS1,Shop drawings level 1,2031-03-01,2031-03-20,Open\nS2,Shop drawings level 2,2031-05-01,2031-05-20,Open\nS3,Method statement,,2031-04-01,Open';
function project(t:{after(fn:()=>void):unknown},dataDate:string|null,text=DEFAULT_TEXT){
  const dir=mkdtempSync(join(tmpdir(),'m42-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const state=runtimeProjects.getOrCreate('M42-'+randomUUID().slice(0,8).toUpperCase());
  if(dataDate){const model={projectId:state.projectId,source:'xer',sourceRevisionId:'C',dataDateIso:dataDate+'T08:00:00',wbs:[],relationships:[],calendars:[],diagnostics:[],activities:[]} as unknown as CanonicalScheduleModel;
    state.schedules.push({role:'update',format:'xer',sourceFilename:'u.xer',sourceHashSha256:'u',uploadedAt:'2031-05-01',revision:{revisionId:'C',label:'U',sequence:1,effectiveAt:dataDate,model}} as ProjectRuntimeState['schedules'][number]);}
  const path=join(dir,'sub.csv');writeFileSync(path,text);
  state.evidenceDocuments.push({documentId:'SUB',sourceFilename:'Submittals.csv',storedPath:path,sourceHashSha256:createHash('sha256').update(text).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'design_quality',documentType:'submittal_register',familyKey:'sub',uploadedAt:'2031-05-01',diagnostics:[],assertions:[]} as unknown as StoredEvidenceDocument);
  state.version++;
  return state;
}
const rows=(state:ProjectRuntimeState)=>deliveryPosition(state).registerRows.filter((r:any)=>r.kind==='submittal');

test('M4.2: planned and due dates split current and future at the Data Date; nothing dated is undated',t=>{
  const state=project(t,'2031-04-15');
  const byRef=new Map(rows(state).map((r:any)=>[r.reference,r]));
  assert.equal(byRef.size,3,'three submittals read');
  assert.equal(byRef.get('S1').scope,'current');assert.equal(byRef.get('S2').scope,'future');assert.equal(byRef.get('S3').scope,'current','a due date alone shows the requirement');
  assert.ok(rows(state).every((r:any)=>r.scope!=='undated'));
  assert.equal(byRef.get('S1').scopeBasis,'planned_or_due_date');
});

test('M4.2: without a Data Date, dated rows wait for the Data Date and say so',t=>{
  const state=project(t,null);
  for(const r of rows(state) as any[])assert.equal(r.scopeBasis,'no_data_date',r.reference+': the reason is the missing Data Date');
});

// M4.1 invariant: the completeness question is asked only when confirming would
// give the percentages. Otherwise the item names the real blocker.
test('M4.1: an undated register gets an item naming the missing dates, not a completeness question; a dated register gets the question',async t=>{
  const {projectActions}=await import('../packages/runtime-api/src/project-actions');
  const {summarizeControlIssues}=await import('../packages/truth-kernel/src');
  const item=(state:ProjectRuntimeState)=>{const r=projectActions(state,summarizeControlIssues([],0));return [...r.actions,...r.information].find(a=>a.id==='delivery-population:submittal');};
  const undated=project(t,'2031-04-15','Submittal No,Title,Status\nS1,Shop drawings,Open\nS2,Method statement,Open');
  const blocked=item(undated);
  assert.ok(blocked,'an item exists');assert.equal(blocked!.category,'follow_up');assert.match(blocked!.reason,/no date/);
  assert.doesNotMatch(blocked!.reason,/so percentages can be reported/);
  const dated=project(t,'2031-04-15','Submittal No,Title,Submitted Date,Status\nS1,Shop drawings,2031-03-01,Open\nS2,Method statement,2031-05-01,Open');
  const ask=item(dated);
  assert.ok(ask,'the completeness question is asked');assert.equal(ask!.category,'confirmation');
});
