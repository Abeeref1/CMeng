import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {commercialCanonical} from '../packages/runtime-api/src/commercial-canonical';
import {commercialPositionForState} from '../packages/runtime-api/src/commercial-runtime';
import {commercialContractControlsForState} from '../packages/runtime-api/src/commercial-contract-controls-runtime';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';

function fixture(t:any){
 const dir=mkdtempSync(join(tmpdir(),'shared-commercial-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const state=loadCertifiedDemoProject('COMMERCIAL-REPAIR-'+randomUUID());
 state.schedules.at(-1)!.revision.model.dataDateIso='2031-08-31';state.evidenceDocuments=[];state.controls.bonds=[];state.version++;
 const csv=(type:string,content:string)=>{const documentId='source-'+state.evidenceDocuments.length,storedPath=join(dir,documentId+'.csv');writeFileSync(storedPath,content);
  state.evidenceDocuments.push({documentId,sourceFilename:documentId+'.csv',storedPath,sourceHashSha256:createHash('sha256').update(content).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'boq_cost',documentType:type,familyKey:documentId,uploadedAt:'2031-09-01',diagnostics:[],assertions:[]} as any);state.version++;return documentId;};
 return {state,csv};
}

test('ten fresh projects refresh retained mixed security rows without counting insurance twice',t=>{
 for(let i=1;i<=10;i++){
  const {state,csv}=fixture(t),amount=i*13007;
  const id=csv('bond_register','Bond ID,Instrument,Amount,Currency,Expiry Date,Status\nPB,Performance Bond,'+amount+',QAR,2032-12-31,Expired\nAPG,Advance Payment Guarantee,'+amount+',QAR,2031-07-01,Active\nCAR,CAR Insurance Policy,'+amount*10+',QAR,2031-08-01,Expired');
  state.controls.bonds=[{bondId:'CAR',kind:'other',amount:amount*10,currency:'QAR',expiryIso:'2031-08-01',status:'expired',sourceRefs:['evidence-document:'+id+':row:4']}];state.version++;
  const ledger=commercialCanonical(state);assert.equal(ledger.bonds!.length,2);assert.equal(ledger.insurances.length,1);
  assert.equal(ledger.bonds!.find(r=>r.bondId==='PB')!.kind,'performance');assert.equal(ledger.bonds!.find(r=>r.bondId==='PB')!.status,'active');
  const securities=commercialContractControlsForState(state).bondsInsurance;
  assert.equal(securities.activeBondCount,1);assert.equal(securities.expiredBondCount,1);assert.equal(securities.expiredInsuranceCount,1);
  assert.equal(projectFactsForState(state).commercial.currencies.find(r=>r.currency==='QAR')!.activeBondAmount.value,amount);
  assert.equal(state.controls.bonds.length,1,'read-time refresh must retain the original imported evidence');
 }
});

test('an explicit unpaid zero needs no invented payment date and a blank payment remains unknown',t=>{
 for(const unpaid of ['0','']){
  const {state,csv}=fixture(t);
  csv('payment_certificates','Certificate No,Period End,Certificate Date,Payment Date,Gross Work,Variations,Net Certified,Paid Amount,Currency,Tax Basis,Status,Certified Amount Basis,Paid Amount Basis\nP1,2031-06-30,2031-07-10,2031-07-20,110,0,100,100,QAR,exclusive,Paid,incremental,incremental\nP2,2031-07-31,2031-08-10,,60,0,50,'+unpaid+',QAR,exclusive,Certified,incremental,incremental\nP3,2031-08-31,,,20,0,18,0,QAR,exclusive,Applied,incremental,incremental');
  const p=commercialPositionForState(state,'2031-08-31T00:00:00Z').currencies.find(r=>r.currency==='QAR')!;
  assert.equal(p.netCertifiedAmount!.value,150);assert.equal(p.interimCertificateCount.value,2);
  assert.equal(p.certifiedUnpaidAmount.value,unpaid==='0'?50:null);
 }
});

test('delay facts distinguish all source records from execution activities without changing the evidence',t=>{
 const {state}=fixture(t),current=state.schedules.at(-1)!,baseline=state.schedules.find(r=>r.role==='baseline')!;
 const a=current.revision.model.activities[0]!;
 current.revision.model.activities=[{...a,activityId:'WORK',status:'not_started',activityType:'task',currentFinishIso:'2032-01-10'},{...a,activityId:'SUPPORT',status:'in_progress',activityType:'level_of_effort',currentFinishIso:'2032-01-10',actualStartIso:'2031-08-01',actualFinishIso:null}];
 baseline.revision.model.activities=current.revision.model.activities.map(r=>({...r,baselineFinishIso:'2032-01-01',baselineStartIso:'2031-08-01'}));state.version++;
 const facts=projectFactsForState(state);assert.equal(facts.schedule.delayedOpenActivityCount.value,2);assert.equal(facts.schedule.delayedExecutionActivityCount.value,1);
});
