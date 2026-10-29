import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {commercialCanonical} from '../packages/runtime-api/src/commercial-canonical';
import {commercialPositionForState} from '../packages/runtime-api/src/commercial-runtime';
import {projectActions} from '../packages/runtime-api/src/project-actions';
import {summarizeControlIssues} from '../packages/truth-kernel/src';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// M10.2 invariant: one tax basis rule for every register amount. A row's own
// basis column first; when rows state none, the user's decision, else the basis
// the contract states, named with every total that uses it; else unknown, with
// one question. Whatever the contract wording or the register, the rule is the same.

function fixture(t:{after(fn:()=>void):unknown},contractText:string|null){
  const dir=mkdtempSync(join(tmpdir(),'m102-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const state=runtimeProjects.getOrCreate('M102-'+randomUUID().slice(0,8).toUpperCase());
  const model={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:'2031-04-15T18:00:00+04:00',wbs:[],relationships:[],calendars:[],diagnostics:[],activities:[]} as unknown as CanonicalScheduleModel;
  state.schedules.push({role:'update',format:'xer',sourceFilename:'u.xer',sourceHashSha256:'u',uploadedAt:'2031-05-01',revision:{revisionId:'CURRENT',label:'U',sequence:1,effectiveAt:'2031-04-15',model}} as ProjectRuntimeState['schedules'][number]);
  if(contractText!==null){
    state.evidenceDocuments.push({documentId:'MAIN',category:'contract',documentType:'contract_main',sourceFilename:'Contract.pdf',sourceHashSha256:'main',uploadedAt:'2031-05-01',basisState:'active',linkedArtifactId:null,diagnostics:[]} as unknown as StoredEvidenceDocument);
    state.contractDocuments.push({documentId:'MAIN',role:'main',result:{sections:[{text:contractText,startPage:1,sectionKey:'preamble',sourceMode:'deterministic',sourceSpans:[],kind:'preamble',status:'verified',diagnostics:[]}],pdf:{pages:[]}}} as unknown as ProjectRuntimeState['contractDocuments'][number]);
  }
  const csv=(text:string)=>{const id='pay-'+state.evidenceDocuments.length,path=join(dir,id+'.csv');writeFileSync(path,text);
    state.evidenceDocuments.push({documentId:id,sourceFilename:id+'.csv',storedPath:path,sourceHashSha256:createHash('sha256').update(text).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'boq_cost',documentType:'payment_certificate_register',familyKey:id,uploadedAt:'2031-05-01',diagnostics:[],assertions:[]} as unknown as StoredEvidenceDocument);
    state.version++;};
  state.version++;
  return {state,csv};
}
const NO_BASIS='Certificate No,Payment Type,Period End,Certificate Date,Gross Work,Variations,Retention,Advance Recovery,Other Deductions,Net Certified,Currency,Certified Amount Basis\nIPC1,Interim,2031-03-31,2031-04-01,100,0,5,0,0,95,AED,Incremental\nIPC2,Interim,2031-04-10,2031-04-11,200,0,10,0,0,190,AED,Incremental';
const amounts=(state:ProjectRuntimeState)=>commercialCanonical(state).payments.flatMap(p=>Object.values(p.amounts)).filter((a:any)=>a&&a.value!==null) as any[];
const taxItem=(state:ProjectRuntimeState)=>{const r=projectActions(state,summarizeControlIssues([],0));return [...r.actions,...r.information].filter(a=>a.id==='matter:tax-basis');};

for(const wording of ['All contract values are stated in AED and are exclusive of VAT unless expressly stated otherwise.','The Contract Price is AED 120,000,000 excluding VAT.','Accepted Contract Amount: AED 50,000,000 (exclusive of value added tax)'])
test('M10.2: the contract states "'+wording.slice(0,40)+'...": rows with no basis use it, it is named with the total, and one pre-filled question is asked',t=>{
  const {state,csv}=fixture(t,wording);
  csv(NO_BASIS);
  const read=amounts(state);
  assert.ok(read.length>0&&read.every(a=>a.taxBasis==='exclusive'&&a.taxBasisSource==='contract'),'every amount uses the contract basis, named');
  assert.ok(commercialCanonical(state).diagnostics.some(d=>d.startsWith('TAX_BASIS_FROM_CONTRACT:exclusive:')));
  assert.match(JSON.stringify(commercialPositionForState(state)),/TAX_BASIS_FROM_CONTRACT_ROWS_STATE_NONE/,'the certified total names its basis');
  const items=taxItem(state);
  assert.equal(items.length,1,'asked once');assert.equal(items[0]!.category,'confirmation');
  assert.equal(items[0]!.target.reviewChoice,'exclusive','pre-filled with the contract basis');
});

test('M10.2: the user decision replaces the contract basis for rows that state none; a row that states its own basis keeps it',t=>{
  const {state,csv}=fixture(t,'All contract values are stated in AED and are exclusive of VAT.');
  csv(NO_BASIS);
  csv('Certificate No,Payment Type,Period End,Certificate Date,Gross Work,Variations,Retention,Advance Recovery,Other Deductions,Net Certified,Currency,VAT Basis,Certified Amount Basis\nIPC9,Interim,2031-02-28,2031-03-01,50,0,0,0,0,50,AED,Inclusive,Incremental');
  const item=taxItem(state)[0]!;
  state.controls.reviewDecisions={...(state.controls.reviewDecisions??{}),'tax-basis':{choice:'inclusive',sourceFingerprint:item.reviewFingerprint!,confirmedAt:'2031-05-02',sourceRefs:[]} as any};
  state.version++;
  const read=amounts(state);
  assert.ok(read.filter(a=>a.taxBasisSource!=='row').every(a=>a.taxBasis==='inclusive'&&a.taxBasisSource==='user'),'the decision governs rows without a basis');
  assert.ok(read.filter(a=>a.taxBasisSource==='row').length>0&&read.filter(a=>a.taxBasisSource==='row').every(a=>a.taxBasis==='inclusive'),'the stated row basis stands');
  const after=taxItem(state);assert.equal(after.length,1);assert.equal(after[0]!.category,'information','decided: reachable to change, not asked again');
});

test('M10.2: no basis in the contract or the rows: amounts stay unknown and the one question is asked without a guess',t=>{
  const {state,csv}=fixture(t,null);
  csv(NO_BASIS);
  assert.ok(amounts(state).every(a=>a.taxBasis==='unknown'));
  const items=taxItem(state);assert.equal(items.length,1);assert.equal(items[0]!.target.reviewChoice,null);
});
