import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {partitionAsOf} from '../packages/truth-kernel/src';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject, directorForProject, overviewForProject, managementSurfacesForProject, managementSurfaceForProject, rerunProject} from '../packages/runtime-api/src/project-projections';
import {commercialCanonical} from '../packages/runtime-api/src/commercial-canonical';
import {commercialFoundationForState} from '../packages/runtime-api/src/commercial-foundation-runtime';
import {commercialContractControlsForState} from '../packages/runtime-api/src/commercial-contract-controls-runtime';
import {reportingState,claimsReporting,scheduleActualReporting} from '../packages/runtime-api/src/reporting-state';
import {buildActivityAnalyticsProjection} from '../packages/activity-analytics/src';
import {activityMovementAnalysis} from '../packages/activity-analytics/src/movement';
import type {ProjectRuntimeState,StoredEvidenceDocument} from '../packages/runtime-api/src/project-state-types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

let sequence=0;
function fixture(t:{after(fn:()=>void):unknown}) {
 const dir=mkdtempSync(join(tmpdir(),'universal-reporting-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const state=runtimeProjects.getOrCreate('DATE-CONTRACT-'+randomUUID());
 const model:CanonicalScheduleModel={projectId:state.projectId,source:'xer',sourceRevisionId:'CURRENT',dataDateIso:'2031-04-15T18:00:00+04:00',
  wbs:[],relationships:[],calendars:[{calendarId:'C',name:'Eight-hour day',standardDayHours:8,semanticComplete:true,sourceRefs:[]}],diagnostics:[],activities:[{
   projectId:state.projectId,activityId:'WORK',nativeId:'1',name:'Future planned work',wbsId:null,calendarId:'C',activityType:'task',status:'not_started',
   baselineStartIso:'2031-04-20',baselineFinishIso:'2031-05-01',currentStartIso:'2031-04-20',currentFinishIso:'2031-05-09',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
   originalDurationHours:40,remainingDurationHours:40,totalFloatHours:16,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}]};
 state.schedules.push({role:'update',format:'xer',sourceFilename:'arbitrary-update.xer',sourceHashSha256:'test',uploadedAt:'2031-05-01',revision:{revisionId:'CURRENT',label:'April update',sequence:1,effectiveAt:'2031-04-15',model}} as ProjectRuntimeState['schedules'][number]);state.version++;
 function csv(text:string,type='commercial_register'){
  const id='source-'+state.evidenceDocuments.length,path=join(dir,id+'.csv'),hash=createHash('sha256').update(text).digest('hex');writeFileSync(path,text);
  state.evidenceDocuments.push({documentId:id,sourceFilename:id+'.csv',storedPath:path,sourceHashSha256:hash,mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'boq_cost',documentType:type,familyKey:id,uploadedAt:'2031-05-01',diagnostics:[],assertions:[]} as unknown as StoredEvidenceDocument);state.version++;
 }
 return {state,model,csv};
}

test('temporal partition preserves boundary, invalid, future and undated records and population identity',()=>{
 const rows=Object.freeze([{id:'before',date:'2032-02-28'},{id:'boundary',date:'2032-02-29T23:59:00-05:00'},{id:'future',date:'2032-03-01'},{id:'invalid',date:'2032-02-30'},{id:'missing',date:null}]);
 const options={name:'Events',entity:'event',dataDateIso:'2032-02-29',dateBasis:'source civil event date',id:(r:typeof rows[number])=>r.id,date:(r:typeof rows[number])=>r.date};
 const result=partitionAsOf(rows,options);assert.deepEqual(result.asOf.map(r=>r.id),['before','boundary']);assert.equal(result.future.length,1);assert.equal(result.undated.length,2);
 assert.equal(result.population.denominator+result.population.exclusions.length,rows.length);
 assert.equal(partitionAsOf([...rows].reverse(),options).population.populationId,result.population.populationId);
 assert.notEqual(partitionAsOf(rows,{...options,dataDateIso:'2032-03-01'}).population.populationId,result.population.populationId);
 assert.equal(partitionAsOf(rows,{...options,dataDateIso:null}).asOf.length,0);
});

test('future approvals are separated and never contaminate pending aging or current stage amounts',t=>{
 const {state,csv}=fixture(t);
 csv('Variation ID,Description,Status,Submitted Date,Approval Date,Approved Amount,Claimed Amount,Currency,Tax Basis\nV1,Known request,Approved,2031-04-10,2031-04-20,900,950,USD,exclusive\nV2,Future request,Approved,2031-04-22,2031-05-01,1200,1250,USD,exclusive\nV3,Undated,Approved,,,400,450,EUR,exclusive');
 const source=commercialCanonical(state),vo=commercialContractControlsForState(state).variations;
 assert.equal(vo.sourceRecordCount,3);assert.equal(vo.recordCount,1);assert.equal(vo.futureRecordCount,1);assert.equal(vo.undatedRecordCount,1);
 assert.equal(vo.approvedCount,0);assert.equal(vo.pendingCount,1);assert.equal(vo.unknownAsOfStageCount,0);assert.equal(vo.pendingAgeBands.unknown,0);
 assert.equal(vo.rows[0]!.lifecycleStage,'submitted');assert.equal(vo.rows[0]!.cost.approved.value,null);assert.equal(source.variations[0]!.approvedAmount.value,900);
 assert.equal(vo.population.denominator,vo.rows.length);
});

test('certificate, retention, report payload and capability populations use the same cutoff',t=>{
 const {state,csv}=fixture(t);
 csv('Certificate No,Period End,Net Certified,Retention,Currency,Tax Basis,Status\nP1,2031-04-15,2000,100,USD,exclusive,Certified\nP2,2031-04-16,3000,150,USD,exclusive,Certified\nP3,,4000,200,USD,exclusive,Certified');
 const ledger=commercialCanonical(state),payment=commercialFoundationForState(state).paymentRegister,retention=commercialContractControlsForState(state).retentionCalendar;
 assert.equal(payment.recordCount,1);assert.equal(payment.sourceRecordCount,3);assert.equal(payment.futureRows.length,1);assert.equal(payment.undatedRows.length,1);
 assert.equal(retention.recordCount,1);assert.equal(retention.futureRows.length,1);assert.equal(retention.undatedRows.length,1);
 assert.equal(ledger.temporalPosition!.money.find(m=>m.kind==='Retention deductions')!.asOfValue,100);
 const module=moduleForProject(state.projectId,'payments');const data=module.data as any;
 assert.equal(data.position.foundation.paymentRegister.recordCount,payment.recordCount);
 assert.equal(data.reportingContract.populations.certificate_periods.populationId,payment.population.populationId);
 assert.equal(data.reportingContract.metricContracts['position.foundation.paymentRegister.sourceRecordCount'].denominator,3);
 assert.equal(data.reportingContract.metricContracts['position.foundation.paymentRegister.futureRecordCount'].denominator,1);
 assert.equal(data.position.currencies[0].retentionDeductedAmount.value,100);
 assert.equal(data.position.currencies[0].paidAmount.value,null);
 assert.equal(module.status,'partial');
});

test('claims cutoff is a read-only view; notice date never fills event start; unknown final states remain unknown',t=>{
 const {state,csv}=fixture(t);
 csv('Claim ID,Event,Notice Date,Days Claimed,Status\nC1,Access record,2031-04-15,8,Determined\nC2,Later record,2031-04-16,10,Rejected\nC3,Undated record,,12,Submitted','delay_eot_claims_register');
 const reporting=claimsReporting(state)!;assert.equal(reporting.claims.asOf.length,1);assert.equal(reporting.claims.future.length,1);assert.equal(reporting.claims.undated.length,1);
 assert.equal(reporting.current.events[0]!.startIso,null);assert.equal(reporting.current.claims[0]!.state,'unknown');assert.equal(reporting.source.claims[0]!.state,'determined');
 const view=reportingState(state);assert.notEqual(view,state);assert.equal(view.controls.delayClaims!.claims.length,1);assert.equal(state.controls.delayClaims,null);
 const module=moduleForProject(state.projectId,'delay-claims');assert.equal((module.data as any).claimCount,1);
 const director=directorForProject(state.projectId);assert.equal(director!.claims.claimCount,1);
 assert.equal((module.data as any).reportingContract.populations.claims.denominator,1);
 assert.equal((module.data as any).reportingContract.populations.claims.populationId,(director!.reportingContract as any).populations.claims.populationId);
});

test('missing registers stay null in director and contract controls payloads',t=>{
 const {state}=fixture(t);const director=directorForProject(state.projectId)!;
 assert.equal(director.controls.expiredBondCount,null);assert.equal(director.controls.openHseIncidentCount,null);assert.equal(director.controls.overdueRfiCount,null);
 const controls=commercialContractControlsForState(state);assert.equal(controls.bondsInsurance.activeBondCount,null);assert.equal(controls.bondsInsurance.activeInsuranceCount,null);assert.equal(controls.contractObligations.completeCount,null);
});

test('a future actual finish cannot establish historical completion or progress; source dates remain intact',t=>{
 const {state,model}=fixture(t);const row=model.activities[0]!;
 row.status='completed';row.percentComplete=100;row.actualStartIso='2031-04-12';row.actualFinishIso='2031-04-16';
 const view=reportingState(state),scoped=view.schedules[0]!.revision.model.activities[0]!;
 assert.equal(scoped.actualStartIso,'2031-04-12');assert.equal(scoped.actualFinishIso,null);assert.equal(scoped.status,'unknown');assert.equal(scoped.percentComplete,null);
 assert.equal(row.actualFinishIso,'2031-04-16');assert.equal(row.percentComplete,100);assert.equal(scoped.currentFinishIso,row.currentFinishIso);
 assert.equal(scheduleActualReporting(view).future.length,1);
 const payload=moduleForProject(state.projectId,'activity-analytics').data as any;
 assert.equal(payload.rows[0].actualFinishIso,null);assert.equal(payload.reportingContract.excludedScheduleActualEvents.future.length,1);
});

test('movement cohort verifies every pair, retains future planned work, and distinguishes successive comparisons',t=>{
 const {model}=fixture(t);model.activities.push({...model.activities[0]!,activityId:'MILE',activityType:'finish_milestone'});
 model.activities.push({...model.activities[0]!,activityId:'NEW',baselineFinishIso:null});
 const rows=buildActivityAnalyticsProjection(model,{generatedAt:'2031-04-16',producerVersion:'test'}).rows;
 const m=activityMovementAnalysis(rows,{dataDateIso:model.dataDateIso,currentRevisionId:'U2',currentLabel:'Second update',baselineRevisionId:'B0',baselineLabel:'Baseline',previousRevisionId:'U1',previousLabel:'First update',previousRows:model.activities.map(r=>({...r,currentFinishIso:'2031-05-06'}))});
 assert.equal(m.population.sourceCount,3);assert.equal(m.population.denominator,2);assert.equal(m.maximumRows.length,2);assert.equal(m.sourcePairVerifiedCount,2);
 assert.equal(m.maximumRows[0]!.baselineMovementDays,8);assert.equal(m.maximumRows[0]!.previousMovementDays,3);assert.equal(m.maximumRows[0]!.priorBaselineMovementDays,5);
 assert.equal(m.causation,'not_established');assert.equal(m.population.exclusions[0]!.id,'NEW');
});


test('changing dated evidence propagates automatically to all management surfaces and commercial consumers', t => {
 const {state,csv}=fixture(t);
 csv('Certificate No,Period End,Net Certified,Retention,Currency,Tax Basis,Status\nP1,2031-04-15,2000,100,USD,exclusive,Certified\nP2,2031-04-16,3000,150,USD,exclusive,Certified');
 csv('Claim ID,Event,Notice Date,Days Claimed,Status\nC1,Access,2031-04-15,8,Submitted\nC2,Later,2031-04-16,10,Submitted','delay_eot_claims_register');
 for (const [date, expectedClaims, expectedRetention] of [['2031-04-15',1,100],['2031-04-16',2,250]] as const) {
   state.schedules[0]!.revision.model.dataDateIso=date; state.version++;
   const commercial=moduleForProject(state.projectId,'commercial-overview').data as any;
   const claims=moduleForProject(state.projectId,'delay-claims').data as any;
   const surfaces=managementSurfacesForProject(state.projectId)!;
   for (const projection of [surfaces.masterDashboard,surfaces.commandCenter] as any[]) {
     assert.equal(projection.commercialByCurrency[0].retentionDeductedAmount.value,expectedRetention);
     assert.equal(projection.reportingContract.populations.claims.denominator,expectedClaims);
     assert.equal(projection.reportingContract.populations.claims.populationId,claims.reportingContract.populations.claims.populationId);
     assert.equal(projection.reportingContract.populations.retentionDeductions.populationId,commercial.reportingContract.populations.retentionDeductions.populationId);
   }
   const single=managementSurfaceForProject(state.projectId,'master-dashboard')!.data as any;
   assert.deepEqual(single.reportingContract,surfaces.masterDashboard['reportingContract' as keyof typeof surfaces.masterDashboard]);
   assert.equal(single.metrics.find((m:any)=>m.key==='claims-linkage').value,'0 / '+expectedClaims);
 }
});
