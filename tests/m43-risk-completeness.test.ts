import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {projectActions} from '../packages/runtime-api/src/project-actions';
import {riskRegisterCompleteness} from '../packages/runtime-api/src/register-completeness';
import {summarizeControlIssues} from '../packages/truth-kernel/src';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// M4.3 invariant for the risk register: the same rule as NCR, RFI and Delivery.
// Readable risk records give the available counts at once, qualified "not
// confirmed complete"; the full-register total only after the register is
// confirmed in Project Review; the confirmation survives a restart.

test('M4.3: risk counts are shown at once, qualified; confirmed in Project Review they become the confirmed totals, and stay so after a restart',t=>{
  const dir=mkdtempSync(join(tmpdir(),'m43-risk-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:true}),state=store.getOrCreate('M43-RISK');
  const model={projectId:state.projectId,source:'xer',sourceRevisionId:'C',dataDateIso:'2031-04-15T08:00:00',wbs:[],relationships:[],calendars:[],diagnostics:[],activities:[]} as unknown as CanonicalScheduleModel;
  state.schedules.push({role:'update',format:'xer',sourceFilename:'u.xer',sourceHashSha256:'u',uploadedAt:'2031-05-01',revision:{revisionId:'C',label:'U',sequence:1,effectiveAt:'2031-04-15',model}} as ProjectRuntimeState['schedules'][number]);
  const text='Risk ID,Description,Status,Raised Date,Status As Of,Owner,Rating\nK1,Ground water,Open,2031-03-01,2031-04-10,Site Manager,High\nK2,Steel price,Open,2031-03-05,2031-04-10,Commercial Manager,Medium\nK3,Crane access,Closed,2031-02-01,2031-04-10,Site Manager,Low';
  const path=join(dir,'risk.csv');writeFileSync(path,text);
  state.evidenceDocuments.push({documentId:'RISK',sourceFilename:'Risk_Register.csv',storedPath:path,sourceHashSha256:createHash('sha256').update(text).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'risk_claims_procurement',documentType:'risk_register',familyKey:'risk',uploadedAt:'2031-05-01',diagnostics:[],assertions:[]} as unknown as StoredEvidenceDocument);
  state.version++;
  const page=(s:ProjectRuntimeState)=>deliveryModule(s,'delivery-risks').data as any;
  const fact=(s:ProjectRuntimeState)=>(projectFactsForState(s) as any).controls.openRiskCount;
  // Before confirming: the available count, qualified, on both pages; no confirmed total.
  assert.equal(fact(state).value,2);assert.equal(fact(state).state,'from_register_not_confirmed');
  const before=page(state);
  assert.equal(before.summary.openCount,2,'the risk page shows the available count');
  assert.equal(before.summary.completenessState,'not_established');
  assert.equal(before.summary.currentCount,null,'no confirmed register total yet');
  const review=projectActions(state,summarizeControlIssues([],0));
  const item=review.actions.find(a=>a.id==='matter:risk-register-complete');
  assert.ok(item&&item.category==='confirmation'&&item.resolution?.requiresUserAction,'one confirmation item asks for it');
  // Confirm it the way the server stores a review-commercial-record decision.
  store.updateControls(state.projectId,{reviewDecisions:{...(state.controls.reviewDecisions??{}),'risk-register-complete':{sourceFingerprint:item!.reviewFingerprint!,choice:'confirm_complete',confirmedAt:'2031-05-02',sourceRefs:[]}}} as any);
  for(const [label,s] of [['after confirming',state],['after a restart',new RuntimeProjectStore({dataDir:dir,durable:true}).getOrCreate('M43-RISK')]] as const){
    assert.equal(riskRegisterCompleteness(s).state,'established',label);
    assert.equal(fact(s).state,'confirmed',label);assert.equal(fact(s).value,2,label);
    const after=page(s);
    assert.equal(after.summary.openCount,2,label);assert.equal(after.summary.completenessState,'established',label);
    assert.equal(after.summary.currentCount,3,label+': the confirmed register total (all three current risks)');
    assert.ok(!projectActions(s,summarizeControlIssues([],0)).actions.some(a=>a.id==='matter:risk-register-complete'),label+': not asked again');
  }
});
