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
import {reportingState,claimsReporting,scheduleActualReporting,operationalReporting} from '../packages/runtime-api/src/reporting-state';
import {ingestBoq} from '../packages/boq-ingestion/src';
import {quantityModelFromBoq} from '../packages/runtime-api/src/boq-source';
import {buildScheduleChangeReportProjection} from '../packages/schedule-change-report/src';
import {buildActivityAnalyticsProjection} from '../packages/activity-analytics/src';
import {activityMovementAnalysis} from '../packages/activity-analytics/src/movement';
import {answerProjectQuestion} from '../packages/runtime-api/src/project-intelligence';
import {createCmengServer} from '../packages/runtime-api/src/server';
import type {AddressInfo} from 'node:net';
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

test('NCR and RFI lifecycles reconstruct the Data Date across director, dashboard and command center',t=>{
 const {state,csv}=fixture(t);
 csv('NCR ID,Raised Date,Close Date,Severity,Status\nN1,2031-04-01,2031-04-16,Major,Closed\nN2,2031-04-15,,Critical,Open\nN3,2031-04-16,,Critical,Open\nN4,2031-04-01,2031-04-15,Major,Closed','quality_ncr_register');
 csv('RFI ID,Raised Date,Response Date,Required Response,Status\nR1,2031-04-01,2031-04-16,2031-04-10,Closed\nR2,2031-04-16,,2031-04-12,Overdue','rfi_register');
 csv('Risk ID,Status,Due Date\nRISK-1,Open,2031-04-01','risk_register');
 const r=operationalReporting(state);assert.equal(r.counts.openCriticalMajorNcrCount,2);assert.equal(r.quality.futureRecordCount,1);assert.equal(r.counts.overdueRfiCount,1);
 assert.equal(r.risk.undatedRecordCount,1);assert.equal(r.counts.openRiskCount,null);
 assert.equal(reportingState(state).controls.ncrs.find(r=>r.ncrId==='N1')!.status,'open');
 const director=directorForProject(state.projectId)!;assert.equal(director.controls.openCriticalMajorNcrCount,2);assert.equal(director.controls.overdueRfiCount,1);assert.equal(director.controls.openRiskCount,null);
 for(const key of ['master-dashboard','command-center']){
  const p=moduleForProject(state.projectId,key).data as any;
  assert.equal(p.operationalReporting.counts.openCriticalMajorNcrCount,2);assert.equal(p.reportingContract.populations.ncrs.populationId,r.quality.population.populationId);
 }
 const answer=answerProjectQuestion(state.projectId,'What are the current NCR, RFI and risk register counts?')!;
 assert.match(answer.answer,/Confirmed open major\/critical NCRs · known subset: 2/);
 assert.match(answer.answer,/Open RFIs at Data Date: 1/);
 assert.match(answer.answer,/Overdue RFIs at Data Date: 1/);
 assert.match(answer.answer,/Open risks at Data Date · requires dated status: Not established/);
 state.schedules[0]!.revision.model.dataDateIso='2031-04-16';state.version++;
 assert.equal(directorForProject(state.projectId)!.controls.openCriticalMajorNcrCount,2);
 assert.equal(operationalReporting(state).quality.current.find(r=>r.ncrId==='N1')!.status,'closed');
});

test('undated or malformed operational records do not create a zero current result',t=>{
 const {state,csv}=fixture(t);
 csv('NCR ID,Raised Date,Close Date,Severity,Status\nN1,,,Major,Closed\nN2,2031-04-01,,?,Open','quality_ncr_register');
 const r=operationalReporting(state);assert.equal(r.quality.undatedRecordCount,1);assert.equal(r.counts.openCriticalMajorNcrCount,null);
 assert.equal(directorForProject(state.projectId)!.controls.openCriticalMajorNcrCount,null);
});
test('an impossible supplied closure is data quality while confirmed open NCRs remain visible',t=>{
 const {state,csv}=fixture(t);
 csv('NCR ID,Raised Date,Close Date,Severity,Status\nN1,2031-04-01,,Major,Open\nN2,2031-04-10,2031-04-02,Critical,Closed','quality_ncr_register');
 const r=operationalReporting(state);assert.equal(r.counts.openCriticalMajorNcrCount,null);
 assert.equal(r.knownCounts.openCriticalMajorNcrCount,1);assert.equal(r.knownCounts.uncertainCriticalMajorNcrCount,1);
 const result=moduleForProject(state.projectId,'command-center').data as any;
 assert.ok(result.issueAssessment.issues.some((i:any)=>i.kind==='data_quality'&&i.detail.includes('CLOSURE_BEFORE_RAISED_DATE')));
});
test('Look-Ahead shares dated lifecycles, excludes future NCRs and retains every current blocker',t=>{
 const {state,csv}=fixture(t);
 csv('NCR ID,Linked Activity,Raised Date,Close Date,Severity,Status\nN1,WORK,2031-04-01,2031-04-16,Major,Closed\nN2,WORK,2031-04-01,2031-04-15,Minor,Closed\nN3,FUTURE,2031-04-16,,Major,Open','quality_ncr_register');
 csv('Package ID,Linked Activity,Status,Required On Site\nP1,WORK,Delivered,2031-04-01','procurement_register');
 const view=reportingState(state);
 assert.equal(view.controls.readinessEvidence.WORK!.quality!.state,'blocked');
 assert.equal(view.controls.readinessEvidence.WORK!.quality!.sourceRefs.length,2);
 assert.equal(view.controls.readinessEvidence.FUTURE,undefined);
 assert.equal(view.controls.readinessEvidence.WORK!.procurement_material!.state,'unknown');
 const row=(moduleForProject(state.projectId,'lookahead-schedule').data as any).rows.find((r:any)=>r.activityId==='WORK');
 assert.equal(row.readiness.dimensions.find((d:any)=>d.key==='quality').state,'blocked');
 assert.equal(state.controls.readinessEvidence.WORK,undefined,'read-only reporting must not rewrite stored controls');
 state.schedules[0]!.revision.model.dataDateIso='2031-04-16';state.version++;
 assert.equal(reportingState(state).controls.readinessEvidence.WORK!.quality!.state,'ready');
});

test('legacy productivity classification cannot displace a BOQ; the sole source candidate stays explicitly unadopted',async t=>{
 const {state,csv}=fixture(t);
 const wrongText='Work Package,Remaining Quantity,Recent Achieved Rate / Day,Conservative Achievable Rate / Day,Independent Forecast Finish\nWork,100,5,4,2031-05-01';
 csv(wrongText,'boq');const wrong=state.evidenceDocuments[0]!;wrong.assertions=[{sourceText:wrongText} as any];
 const actualText='Item,Description,Unit,Quantity,Rate,Amount\n1,Concrete,m3,14,2,28\n2,Conduit,m,25,3,75';
 csv(actualText,'boq');const actual=state.evidenceDocuments[1]!;actual.basisState='candidate';
 const make=(text:string,name:string)=>ingestBoq({projectId:state.projectId,bytes:Buffer.from(text),verifiedMediaType:'text/csv',receivedAt:'2031-04-20',sourceFilename:name});
 const invalid=await make(wrongText,'productivity.csv'),valid=await make(actualText,'scope.csv');
 wrong.linkedArtifactId=invalid.ingestionId;actual.linkedArtifactId=valid.ingestionId;
 state.activeEvidenceBasis['boq:quantity']={activeArtifactId:invalid.ingestionId} as any;
 state.boq=invalid;state.boqRevisions=[invalid,valid];state.quantities=quantityModelFromBoq(invalid,'CURRENT',null);state.version++;
 const p=moduleForProject(state.projectId,'quantity-scurve').data as any;
 assert.equal(p.boqItemCount,2);assert.equal(p.knownQuantityItemCount,2);assert.equal(p.boqSource.state,'candidate');assert.equal(p.boqSource.adoptedSource,false);
 assert.equal(p.boqSource.excludedMisclassifiedDocuments.length,1);assert.equal(state.boq.ingestionId,invalid.ingestionId);assert.equal(actual.basisState,'candidate');
 assert.ok(!p.moduleReadiness.failedConsistencyCheckIds.includes('BOQ_ACTIVE_DOCUMENT_CONSISTENCY'));
 assert.equal(state.activeEvidenceBasis['boq:quantity']!.activeArtifactId,invalid.ingestionId,'candidate reporting must not mutate the adoption slot');
 const q=(moduleForProject(state.projectId,'challenge-contract').data as any).deliveryChallenge.quantityChallenge;
 assert.equal(q.unmappedItemCount,2);
});

test('commercial notices retain excluded source counts after the current lifecycle has been resolved',t=>{
 const {state,csv}=fixture(t);csv('Claim ID,Event,Notice Date,Days Claimed,Status\nC1,Current,2031-04-15,8,Submitted\nC2,Future,2031-04-16,9,Submitted','delay_eot_claims_register');
 const p=moduleForProject(state.projectId,'commercial-claims-notices').data as any;
 assert.equal(p.position.claimsNotices.asOfNoticeCount,1);assert.equal(p.position.claimsNotices.futureNoticeCount,1);assert.equal(p.position.claimsNotices.sourceNoticeCount,2);
 assert.equal(p.position.claimsNotices.lifecycleClaimCount,1);
});

test('revision movement cohort includes unchanged matches and retains every maximum source pair',t=>{
 const {model}=fixture(t);const from={revisionId:'EARLIER',label:'Earlier revision',sequence:1,effectiveAt:'2031-04-01',model:structuredClone(model)};
 from.model.activities[0]!.currentFinishIso='2031-05-06';
 from.model.activities.push({...from.model.activities[0]!,activityId:'STABLE',currentFinishIso:'2031-05-10'});
 const to={...from,revisionId:'LATER',label:'Later revision',sequence:2,model:structuredClone(from.model)};
 to.model.activities[0]!.currentFinishIso='2031-05-09';
 const p=buildScheduleChangeReportProjection(from,to,{generatedAt:'2031-04-16',producerVersion:'test'}).finishMovementAnalysis!;
 assert.equal(p.population.denominator,2);assert.equal(p.maximumCount,1);assert.equal(p.maximumDays,3);assert.equal(p.maximumPercent,50);assert.equal(p.sourcePairVerifiedCount,1);
 assert.equal(p.maximumRows[0]!.fromFinishIso,'2031-05-06');assert.equal(p.causation,'not_established');
});

test('future approvals are separated and never contaminate pending aging or current stage amounts',t=>{
 const {state,csv}=fixture(t);
 csv('Variation ID,Description,Status,Submitted Date,Approval Date,Approved Amount,Claimed Amount,Currency,Tax Basis\nV1,Known request,Approved,2031-04-10,2031-04-20,900,950,USD,exclusive\nV2,Future request,Approved,2031-04-22,2031-05-01,1200,1250,USD,exclusive\nV3,Undated,Approved,,,400,450,EUR,exclusive');
 const source=commercialCanonical(state),vo=commercialContractControlsForState(state).variations;
 assert.equal(vo.sourceRecordCount,3);assert.equal(vo.recordCount,1);assert.equal(vo.futureRecordCount,1);assert.equal(vo.undatedRecordCount,1);
 assert.equal(vo.approvedCount,0);assert.equal(vo.pendingCount,1);assert.equal(vo.unknownAsOfStageCount,0);assert.equal(vo.pendingAgeBands.unknown,0);
 assert.equal(vo.rows[0]!.lifecycleStage,'submitted');assert.equal(vo.rows[0]!.cost.approved.value,null);assert.equal(source.variations[0]!.approvedAmount.value,900);
 assert.equal(vo.rows[0]!.cost.approved.reportingScope,'future');assert.equal(vo.rows[0]!.cost.approved.submitted,900);assert.equal(vo.rows[0]!.cost.approved.state,'partial');assert.equal(vo.rows[0]!.cost.approved.action,null);
 assert.equal(vo.futureRows[0]!.source.approvedAmount.value,1200);assert.equal(vo.futureRows[0]!.source.submittedDate,'2031-04-22');assert.equal(vo.futureRows[0]!.cost.approved.value,null);
 assert.equal(vo.undatedRows[0]!.source.approvedAmount.value,400);assert.match(vo.undatedRows[0]!.cost.approved.action!,/event date/);
 assert.equal(vo.population.denominator,vo.rows.length);
 state.schedules[0]!.revision.model.dataDateIso='2031-05-01';state.version++;
 const advanced=commercialContractControlsForState(state).variations;
 assert.equal(advanced.futureRecordCount,0);assert.equal(advanced.approvedCount,2);assert.equal(advanced.rows.find(r=>r.variationId==='V2')!.cost.approved.value,1200);
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
 assert.equal(data.position.currencies[0].paidAmount.state,'missing_information');
 assert.equal(data.position.currencies[0].retentionHeldAmount.state,'missing_information');
 assert.equal(data.position.foundation.paymentRegister.sourceRecordCount,3,'a parsed register with absent cash dates is not an unparsed submission');
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

test('portfolio retains the shared current contract, separate further adjustment and scenario authority',async t=>{
 const {state}=fixture(t);
 state.controls.contractTimeBasis={contractualCompletionIso:'2031-12-31',contractualCompletionState:'official',officialApprovedEotDays:null,officialApprovedEotState:'missing',eotDayBasis:'calendar_days',eotDayBasisState:'official',sourceRefs:['governed-contract']};
 state.version++;
 const director=directorForProject(state.projectId)!;
 assert.equal(director.schedule.contractualCompletionIso,'2031-12-31');
 assert.equal(director.schedule.officialAdjustedCompletionIso,null);
 const server=createCmengServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  const port=(server.address() as AddressInfo).port;
  const response=await fetch('http://127.0.0.1:'+port+'/api/portfolio');assert.equal(response.status,200);
  const body=await response.json() as any, item=body.projects.find((p:any)=>p.projectId===state.projectId);
  assert.equal(item.officialCompletionIso,'2031-12-31');assert.equal(item.furtherAdjustedCompletionIso,null);
  assert.equal(item.forecastAuthority,director.schedule.independentForecastAuthority);
  assert.equal(item.approvedEotDays,null);assert.match(item.approvedEotBasis,/overlap.*reconciliation/);
 } finally {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
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


test('all specialist and management status surfaces use the same fail-closed readiness result',t=>{
 const {state}=fixture(t);
 const overview=overviewForProject(state.projectId)!;
 const surfaces=managementSurfacesForProject(state.projectId)!;
 for (const specialist of surfaces.masterControlProgramme.specialistPositions) {
   const resolved=moduleForProject(state.projectId,specialist.key);
   if(resolved.data) {
     const gate=(resolved.data as any).moduleReadiness;
     assert.ok(gate, specialist.key);
     if(gate.calculation!=='checked'||gate.evidence!=='established'||gate.consistency!=='pass') assert.notEqual(resolved.status,'ready',specialist.key);
     assert.equal(specialist.status,resolved.status,specialist.key);
   }
 }
 assert.ok(overview);
 assert.equal(overview.managementStates.length,3);
 for (const item of [...overview.moduleStates,...overview.managementStates]) {
   const resolved=moduleForProject(state.projectId,item.key);
   assert.equal(item.status,resolved.status,item.key+' navigation status');
   assert.equal(item.reason,resolved.reason,item.key+' navigation reason');
   assert.deepEqual(item.issueAssessment,resolved.issueAssessment,item.key+' navigation classification');
 }
 const collected=new Set(surfaces.masterDashboard.issueAssessment!.issues.flatMap(i=>i.moduleKeys));
 for(const specialist of surfaces.masterControlProgramme.specialistPositions){
   const resolved=moduleForProject(state.projectId,specialist.key);
   assert.deepEqual(specialist.issueAssessment,resolved.issueAssessment,specialist.key+' MCP classification');
   if(resolved.issueAssessment?.issues.length)assert.ok(collected.has(specialist.key));
 }
});

test('AI commercial questions answer the dated ledger and preserve future exclusions and missing balances',t=>{
 const {state,csv}=fixture(t);
 csv('Variation ID,Description,Status,Submitted Date,Approval Date,Approved Amount,Claimed Amount,Currency,Tax Basis\nV1,Current approval,Approved,2031-04-01,2031-04-15,900,950,USD,exclusive\nV2,Future approval,Approved,2031-04-16,2031-04-20,1200,1250,USD,exclusive');
 csv('Certificate No,Period End,Net Certified,Retention,Currency,Tax Basis,Status\nP1,2031-04-15,2000,100,USD,exclusive,Certified\nP2,2031-04-16,3000,150,USD,exclusive,Certified');
 const answer=answerProjectQuestion(state.projectId,'What are approved variations and retention deductions at the Data Date?')!;
 assert.deepEqual(answer.relevantModules.map(m=>m.key),['variations-change','payments']);
 assert.match(answer.answer,/Dated approved variations on\/before Data Date: 1/);
 assert.match(answer.answer,/Approvals after Data Date \(excluded\): 1/);
 assert.match(answer.answer,/Retention deductions · USD · tax exclusive · on\/before Data Date: 100/);
 assert.match(answer.answer,/Retention deductions · USD · tax exclusive · after Data Date \(excluded\): 150/);
 assert.match(answer.answer,/Retention held balance · USD: Not established/);
 assert.doesNotMatch(answer.answer,/Evidence Revision Id|canonical-evidence|Core project records: Yes/);
 assert.match(answer.answer,/Review required/);
});

test('claim, notice and event-count metadata and AI answers preserve distinct populations',t=>{
 const {state,csv}=fixture(t);
 csv('Claim ID,Event,Notice Date,Days Claimed,Status\nC1,Access record,2031-04-15,8,Determined\nC2,Later record,2031-04-16,10,Rejected\nC3,Undated record,,12,Submitted','delay_eot_claims_register');
 const d=moduleForProject(state.projectId,'delay-claims').data as any;
 for (const field of ['claimLinkedEventCount','noticeLinkedEventCount','windowLinkedEventCount']) assert.equal(d.reportingContract.metricContracts[field].populationId,d.reportingContract.populations.events.populationId,field);
 const n=moduleForProject(state.projectId,'notices-claims').data as any;
 assert.equal(n.reportingContract.metricContracts.noticeCount.populationId,n.reportingContract.populations.claim_notices.populationId);
 assert.equal(n.noticeCount,n.reportingContract.populations.claim_notices.denominator);
 const answer=answerProjectQuestion(state.projectId,'How many claims and notices are current and after the Data Date?')!;
 assert.match(answer.answer,/Claim identities on\/before Data Date: 1/);
 assert.match(answer.answer,/Claim identities after Data Date \(excluded\): 1/);
 assert.match(answer.answer,/Claim notices, excluding determinations on\/before Data Date: 1/);
 assert.match(answer.answer,/without a usable date \(excluded\): 1/);
});

test('loaded risks retain the source population and distinguish rating conflicts from missing historical dates',t=>{
 const {state,csv}=fixture(t);
 csv('Risk ID,Probability,Impact,Rating,Status,Due Date\nA,0.2,2,Extreme,Open,2031-05-01\nB,0.2,2,Low,Open,2031-05-01\nC,0.8,5,Low,Open,2031-05-01','risk_register');
 const r=operationalReporting(state);assert.equal(r.risk.sourceRecordCount,3);assert.equal(r.counts.openRiskCount,null);
 assert.equal(r.risk.validation.ratingInconsistencyGroups.length,1);assert.equal(r.risk.validation.ratingInconsistencyGroups[0]!.score,.4);
 const surfaces=managementSurfacesForProject(state.projectId)!;
 const gap=surfaces.commandCenter.evidenceGaps.find(g=>g.key==='risk-information')!;
 assert.equal(gap.state,'partial');assert.match(gap.action,/3 risk records are present/);assert.doesNotMatch(gap.action,/Establish the governed Risk Register/);
 assert.equal(surfaces.masterDashboard.metrics.find(m=>m.key==='open-risk')!.value,null);
});

test('design prerequisites use planned dates and actual issue dates, not a future overdue status label',async t=>{
 const {deriveReadinessFromCsv}=await import('../packages/runtime-api/src/evidence-readiness');
 const {state,model,csv}=fixture(t);model.activities[0]!.activityId='A';model.activities[0]!.currentFinishIso='2031-04-30';
 const text='Deliverable ID,Linked Activity,Planned Issue,Actual Issue,Status\nD1,A,2031-05-01,,Overdue\nD2,B,2031-04-14,,Pending\nD3,C,2031-04-10,2031-04-14,Issued\nD4,D,2031-04-10,2031-04-16,Issued';
 csv(text,'design_deliverables');const document=state.evidenceDocuments.at(-1)!;
 const r=deriveReadinessFromCsv({state,document,bytes:Buffer.from(text)});
 assert.equal(r.A!.design_submittal!.state,'unknown');assert.match(r.A!.design_submittal!.note!,/not yet due.*source overdue label conflicts/);
 assert.equal(r.B!.design_submittal!.state,'blocked');assert.equal(r.C!.design_submittal!.state,'ready');assert.equal(r.D!.design_submittal!.state,'blocked');
 const material='Package ID,Linked Activity,Required On Site,Status\nP1,A,2031-06-01,Delivered';csv(material,'procurement_register');
 const m=deriveReadinessFromCsv({state,document:state.evidenceDocuments.at(-1)!,bytes:Buffer.from(material)});
 assert.equal(m.A!.procurement_material!.state,'unknown');assert.match(m.A!.procurement_material!.note!,/after activity finish/);
});

test('certificate source profile exposes components and future plans without manufacturing confirmed certification or cash',async t=>{
 const {certificateProfile}=await import('../packages/runtime-api/src/certificate-profile');const {state,csv}=fixture(t);
 csv('Certificate No,Period End,Currency,VAT Basis,Gross Work,Variations,Retention,Advance Recovery,Net Certified,Status\nC1,2031-03-31,EUR,Exclusive of VAT,100,20,6,10,104,Certified\nC2,2031-04-15,EUR,Exclusive of VAT,200,20,11,10,199,Certified\nC3,2031-05-31,EUR,Exclusive of VAT,300,20,16,10,294,Certified','payment_register');
 const ledger=commercialCanonical(state),p=certificateProfile(ledger),g=p.groups[0]!;
 assert.equal(g.as_of.length,2);assert.equal(g.future.length,1);assert.equal(g.totals!.netCertifiedAmount,303);assert.equal(g.totals!.retentionDeduction,17);
 assert.equal(g.futureTotals!.netCertifiedAmount,294);assert.equal(g.beforeLatestTotals!.netCertifiedAmount,104);
 assert.deepEqual(g.certificationUnconfirmedIds,['C1','C2']);assert.equal(g.cumulativeBasis,'source_row_sum_only');
 assert.deepEqual(g.futureSourceStatusConflictIds,['C3']);assert.equal(g.advanceRecoverySourceTotal,30);
 const before=JSON.stringify(ledger.payments);certificateProfile(ledger);assert.equal(JSON.stringify(ledger.payments),before);
 ledger.payments[0]!.certifiedAmountBasis='project_cumulative';assert.equal(certificateProfile(ledger).groups[0]!.totals,null,'project cumulative balances cannot be added');
});

test('HSE report totals are not open incidents; inconsistent rates retain source values and comparison bases',async t=>{
 const {parseHseSummary,hseReportPosition}=await import('../packages/runtime-api/src/hse-report-evidence');const {state}=fixture(t);
 const report=parseHseSummary('Reporting Month March 2031\nTotal Manhours 1,000,000\nLost Time Injuries 2\nMedical Treatment Cases 3\nFirst Aid Cases 8\nNear Misses 19\nLTIFR 0.4\nTRIR 7.0','hash','summary-page-1');
 state.evidenceDocuments.push({documentId:'hse',documentType:'hse_report',sourceFilename:'monthly.pdf',sourceRelativePath:null,mediaType:'application/pdf',sourceHashSha256:'hash',category:'hse_quality_fm',basisState:'active',hseSummary:report,assertions:[],diagnostics:[]} as unknown as StoredEvidenceDocument);state.version++;
 const p=hseReportPosition(state,'2031-04-15');assert.equal(p.metrics.lostTimeInjuries,2);assert.equal(p.periodEndIso,'2031-03-31');
 assert.deepEqual(p.rates.comparisons.map(r=>r.fromReportedCases),[1,5]);assert.ok(p.diagnostics.includes('HSE_TRIR_RECONCILIATION_REQUIRED'));
 assert.equal(directorForProject(state.projectId)!.controls.openHseIncidentCount,null);
 assert.equal(hseReportPosition(state,'2031-03-30').periodEndIso,null,'future monthly totals do not enter the current position');
 const conflict=parseHseSummary('Reporting Month March 2031\nLost Time Injuries 2\nLost Time Injuries 4','hash','page');assert.equal(conflict.metrics.lostTimeInjuries,null);
});

test('a coherent dated risk register is established for current counts without asserting universal rating verification',t=>{
 const {state,csv}=fixture(t);
 csv('Risk ID,Probability,Impact,Rating,Status,Raised Date,Status As Of,Due Date\nA,0.2,2,Low,Open,2031-04-01,2031-04-15,2031-05-01\nB,0.8,5,Extreme,Open,2031-04-03,2031-04-15,2031-06-01','risk_register');
 const r=operationalReporting(state);assert.equal(r.counts.openRiskCount,2);assert.equal(r.risk.validation.state,'consistent_in_checked_scores');
 const surfaces=managementSurfacesForProject(state.projectId)!;assert.ok(!surfaces.commandCenter.evidenceGaps.some(g=>g.key==='risk-information'));
 assert.equal(surfaces.masterDashboard.metrics.find(m=>m.key==='open-risk')!.value,2);
});
