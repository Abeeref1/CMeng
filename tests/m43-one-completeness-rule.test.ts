import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {changeDelivery} from '../packages/runtime-api/src/delivery-records';
import {operationalControlsAsOf} from '../packages/runtime-api/src/operational-reporting';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// M4.3 invariant (user rule, 29 Oct): readable current records give the available
// count at once, with a clear qualification that completeness is not established.
// The Dashboard and Delivery read ONE completeness rule, so they show the same
// counts and the same qualification; a full-register denominator or percentage
// appears only after the register is confirmed complete.

function project(t:{after(fn:()=>void):unknown}){
  const dir=mkdtempSync(join(tmpdir(),'m43-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const state=runtimeProjects.getOrCreate('M43-'+randomUUID().slice(0,8).toUpperCase());
  const model={projectId:state.projectId,source:'xer',sourceRevisionId:'C',dataDateIso:'2031-04-15T08:00:00',wbs:[],relationships:[],calendars:[],diagnostics:[],activities:[]} as unknown as CanonicalScheduleModel;
  state.schedules.push({role:'update',format:'xer',sourceFilename:'u.xer',sourceHashSha256:'u',uploadedAt:'2031-05-01',revision:{revisionId:'C',label:'U',sequence:1,effectiveAt:'2031-04-15',model}} as ProjectRuntimeState['schedules'][number]);
  const csv=(id:string,type:string,text:string)=>{const path=join(dir,id+'.csv');writeFileSync(path,text);
    state.evidenceDocuments.push({documentId:id,sourceFilename:id+'.csv',storedPath:path,sourceHashSha256:createHash('sha256').update(text).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'design_quality',documentType:type,familyKey:id,uploadedAt:'2031-05-01',diagnostics:[],assertions:[]} as unknown as StoredEvidenceDocument);};
  csv('NCR','quality_ncr_register','NCR No,Description,Raised Date,Closed Date,Status,Severity\nN1,Rebar cover,2031-03-01,,Open,Major\nN2,Formwork,2031-03-05,2031-04-01,Closed,Minor\nN3,Concrete,2031-04-10,,Open,Minor');
  csv('RFI','rfi_register','RFI Ref,Subject,Raised Date,Required Response,Response Date,Status\nR1,Door schedule,2031-03-02,2031-03-12,2031-03-10,Closed\nR2,Ceiling,2031-04-01,2031-04-20,,Open');
  state.version++;
  return state;
}
const confirm=(state:ProjectRuntimeState,kind:string)=>{changeDelivery(state,{action:'confirm_population',kind,note:'M43 check: register confirmed complete',expectedVersion:state.version});state.version++;};

test('M4.3: before and after confirming, the Dashboard and Delivery show the same NCR and RFI counts under one completeness rule',t=>{
  const state=project(t);
  const check=(confirmed:boolean)=>{
    const ops=operationalControlsAsOf(state,'2031-04-15'),facts=projectFactsForState(state) as any,delivery=deliveryPosition(state).summaries as any;
    // NCR: 2 open, 1 closed at the Data Date; RFI: 1 open.
    assert.equal(ops.counts.openNcrCount,2,'the available NCR count is published');
    assert.equal(facts.controls.openNcrCount.value,2,'Dashboard fact keeps the available count');
    assert.equal(delivery.quality.openCount,2,'Delivery shows the same available count');
    assert.equal(delivery.quality.closedCount,1);
    assert.equal(facts.controls.openRfiCount.value,1);assert.equal(delivery.design.openCount,1);
    if(!confirmed){
      assert.equal(facts.controls.openNcrCount.state,'from_register_not_confirmed','qualified, not confirmed');
      assert.match(facts.controls.openNcrCount.basis,/not confirmed complete/);
      assert.equal(delivery.quality.completenessState,'not_established');
      assert.match(String(delivery.quality.completenessNote),/not confirmed complete/);
      assert.equal(delivery.quality.currentCount,null,'no confirmed full-register denominator');
      assert.equal(delivery.quality.closurePercent,null,'no percentage over an unconfirmed register');
    }else{
      assert.equal(facts.controls.openNcrCount.state,'confirmed');
      assert.equal(delivery.quality.completenessState,'established');
      assert.equal(delivery.quality.completenessNote,null);
      assert.equal(delivery.quality.currentCount,3,'the confirmed denominator');
      assert.ok(typeof delivery.quality.closurePercent==='number','the percentage appears once confirmed');
    }
  };
  check(false);
  confirm(state,'quality');
  check(true);
  // RFI still unconfirmed: its fact stays qualified while NCR is confirmed.
  assert.equal((projectFactsForState(state) as any).controls.openRfiCount.state,'from_register_not_confirmed');
});
