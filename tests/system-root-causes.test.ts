import {procurementTiming} from '../packages/truth-kernel/src';
import {deriveReadinessFromCsv} from '../packages/runtime-api/src/evidence-readiness';
import {buildLookAheadProjection} from '../packages/lookahead-schedule/src';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {managementSourceInventory} from '../packages/runtime-api/src/management-source-inventory';
import {managementVisualControl} from '../packages/runtime-api/src/management-visual-control';
import {commercialPositionForState} from '../packages/runtime-api/src/commercial-runtime';
import {performanceSecurityValidity} from '../packages/commercial-contract-controls/src/security-validity';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {reportingState,operationalReporting} from '../packages/runtime-api/src/reporting-state';
import {prioritizeActions,actionRecordKey,consolidateScheduleChains} from '../packages/runtime-api/src/action-priority';
import {managementAction} from '../packages/truth-kernel/src';
import {classifyScheduleActivity} from '../packages/runtime-api/src/schedule-scope-classification';
import {analyzeSchedule} from '../packages/schedule-analysis-core/src';
import {buildScheduleChangeReportProjection} from '../packages/schedule-change-report/src';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {projectActionRegisterForState,moduleForProject,directorForProject} from '../packages/runtime-api/src/project-projections';
import {programmeCashScenario} from '../packages/runtime-api/src/programme-cash-scenario';
import {contractCompletionDependencies,sectionCompletionMilestone} from '../packages/runtime-api/src/project-contract-sections';
import {contractNoticeRules} from '../packages/runtime-api/src/contract-notice-rules';
import {projectManagementContext} from '../packages/runtime-api/src/management-context';

test('management source inventory reads retained CSV rows and follows header identity before the filename',()=>{
 const folder=mkdtempSync(join(tmpdir(),'cmeng-source-inventory-'));
 try{
  const state=loadCertifiedDemoProject('CSV-INVENTORY-'+randomUUID()),path=join(folder,'Quality-risk.csv');
  const csv='RFI ID,Subject,Status,Raised Date,Due Date,Linked Activity,Discipline\nRFI-1,Drawing,Open,2026-01-01,2026-01-08,A,MEP\nRFI-2,Detail,Closed,2026-01-01,2026-01-08,B,STR\n';
  writeFileSync(path,csv);state.evidenceDocuments=[{documentId:'CSV-ONLY',documentType:'supporting_document',sourceFilename:'Quality-risk.csv',mediaType:'text/csv',sourceHashSha256:createHash('sha256').update(csv).digest('hex'),storedPath:path,basisState:'active',parserState:'parsed'} as any];
  const inventory=managementSourceInventory(state);
  assert.equal(inventory.domains.find(row=>row.domain==='design')!.readableRowCount,2);
  assert.equal(inventory.domains.find(row=>row.domain==='quality')!.documentCount,0);
 }finally{rmSync(folder,{recursive:true,force:true});}
});

test('risk source Score is retained and reconciled instead of being replaced by probability times impact',()=>{
 const folder=mkdtempSync(join(tmpdir(),'cmeng-risk-score-'));
 try{
  const state=loadCertifiedDemoProject('RISK-SCORE-'+randomUUID()),path=join(folder,'Risk.csv');
  const csv='Risk ID,Status,Probability,Impact,Score,Rating,Identified Date,Action Due Date,Last Reviewed,Owner\nR-1,Open,4,5,18,High,2026-01-01,2026-02-01,2026-01-15,Risk Lead\n';
  writeFileSync(path,csv);state.evidenceDocuments=[{documentId:'RISK-SCORE',documentType:'risk_register',sourceFilename:'Risk.csv',mediaType:'text/csv',sourceHashSha256:createHash('sha256').update(csv).digest('hex'),storedPath:path,basisState:'active',parserState:'parsed'} as any];state.version++;
  const validation=operationalReporting(state).risk.validation,row=validation.scoreRows[0]!;
  assert.equal(row.sourceScore,18);assert.equal(row.calculatedScore,20);assert.equal(row.score,18);assert.equal(row.scoreConflict,true);
  assert.equal(validation.state,'conflicted');assert.ok(validation.diagnostics.includes('RISK_SOURCE_SCORE_CONFLICT'));
 }finally{rmSync(folder,{recursive:true,force:true});}
});

test('management driver groups retain the entire network and delayed WBS groups exclude completed work',()=>{
 const state=loadCertifiedDemoProject('FULL-DRIVER-'+randomUUID());
 const rows=Array.from({length:35},(_,i)=>({activityId:'A'+i,name:'Task '+i,wbsId:'W',wbsPath:'Work',status:i===34?'completed':'not_started',activityType:'task',currentFinishIso:i===33?'2036-12-31':'2036-02-01',totalFloatHours:-8,finishVarianceDays:5}));
 const modules=new Map([['activity-analytics',{data:{rows}}],['independent-forecast',{data:{drivingNetwork:{activityIds:rows.slice(0,34).map(row=>row.activityId),finishActivityIds:['A33']}}}],['milestones',{data:{rows:[{activityId:'A33',status:'not_started',currentDateIso:'2036-12-31'}]}}]]) as any;
 const view=managementVisualControl(state,modules,commercialPositionForState(state),{dataDateIso:'2036-01-01',schedule:{longLeadEvidence:[]}} as any);
 assert.equal(view.schedule.drivingActivities.length,34);assert.equal(view.schedule.priorityGroups[0]!.activityCount,34);
 assert.equal(view.schedule.priorityGroups[0]!.latestCurrentFinishIso,'2036-12-31');assert.deepEqual(view.schedule.priorityGroups[0]!.milestoneIds,['A33']);
 assert.equal(view.schedule.delayedWbs.reduce((sum,row)=>sum+row.count,0),34);
});

test('performance security expiry does not imply coverage through the contract defects obligation',()=>{
 const bond:any={bondId:'PB',kind:'performance',status:'active',expiryIso:'2027-12-31',sourceRefs:['register:PB']};
 const clauses:any=[{textPreview:'Performance Security shall be valid until the Contractor has completed the Works and remedied any defects.',sourceRef:'contract:4.2'}];
 const result=performanceSecurityValidity(bond,clauses,'2027-10-06')!;
 assert.equal(result.daysAfterProgrammeFinish,86);assert.equal(result.state,'review_required');assert.equal(result.requiredReleaseDateIso,null);assert.match(result.message,/defects obligations/);
 assert.match(performanceSecurityValidity({...bond,expiryIso:'2027-10-01'},clauses,'2027-10-06')!.message,/5 calendar days before/);
 assert.equal(performanceSecurityValidity({...bond,kind:'advance_payment'},clauses,'2027-10-06'),null);
});

test('revision engineering checks separate duration, constraints, lags and completion movement',()=>{
 const state=loadCertifiedDemoProject('ENGINEERING-CHANGES-'+randomUUID());
 const from=structuredClone(state.schedules[0]!.revision),to=structuredClone(state.schedules[0]!.revision),template=from.model.activities[0]!;
 from.model.activities=[{...template,activityId:'A',activityType:'task',status:'not_started',currentFinishIso:'2036-06-01',forecastFinishIso:null,actualFinishIso:null,originalDurationHours:8,remainingDurationHours:8,sourceConstraints:[]},{...template,activityId:'FIN',name:'Project completion',activityType:'finish_milestone',status:'not_started',currentFinishIso:'2036-07-01',forecastFinishIso:null,actualFinishIso:null}];
 from.model.dataDateIso='2036-01-01';from.model.relationships=[{relationshipId:'LINK',predecessorActivityId:'A',successorActivityId:'FIN',type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]}];
 to.revisionId+='-2';to.model=structuredClone(from.model);to.model.dataDateIso='2036-04-01';to.model.activities[0]!.originalDurationHours=16;to.model.activities[0]!.sourceConstraints=[{type:'CS_MEO',dateIso:'2036-05-31'}];to.model.activities[1]!.currentFinishIso='2036-07-08';to.model.relationships[0]!.type='SS';to.model.relationships[0]!.lagHours=8;
 const result=buildScheduleChangeReportProjection(from,to,{generatedAt:'2036-04-01',producerVersion:'test'}).engineeringChanges!;
 assert.deepEqual(result.originalDurationActivityIds,['A']);assert.deepEqual(result.constraintActivityIds,['A']);assert.equal(result.lagChangeCount,1);assert.equal(result.relationshipTypeChangeCount,1);assert.equal(result.completionMovementDays,7);assert.equal(result.updateGapCalendarDays,91);
});

test('forward receipt assumptions conserve each currency and missing deductions withhold only the net figure',()=>{
 const position:any={foundation:{commercialTerms:{retentionPercent:{value:5},paymentPeriodDays:{value:45}}},contractControls:{liquidatedDamages:{scenarios:[{forecastCompletion:{value:'2036-10-15'}}]}},currencies:[{currency:'USD',currentContractValue:{value:1000},grossCertifiedAmount:{value:400},advanceBalance:{value:30}}]};
 const before=JSON.stringify(position),scenario=programmeCashScenario(position,'2036-08-31'),group=scenario.groups[0]!;
 assert.equal(group.remainingGross,600);assert.equal(group.retention,30);assert.equal(group.advanceRecovery,30);assert.equal(group.netReceipts,540);
 assert.equal(group.rows.reduce((sum,row)=>sum+row.grossValuation,0),600);assert.equal(group.rows.reduce((sum,row)=>sum+row.netReceipt!,0),540);
 assert.equal(group.rows[0]!.assumedReceiptIso,'2036-11-14');assert.equal(JSON.stringify(position),before);
 position.foundation.commercialTerms.retentionPercent.value=null;
 const partial=programmeCashScenario(position,'2036-08-31').groups[0]!;assert.equal(partial.remainingGross,600);assert.equal(partial.netReceipts,null);
});

test('contract section dependencies and detailed-claim trigger use their own explicit wording',()=>{
 const state=loadCertifiedDemoProject('SECTION-DEPENDENCY-'+randomUUID());
 const text='Section 2 (the whole of the Works) shall not be certified as complete until Section 1 (Infrastructure) has achieved Completion.\n20.2.4 Fully detailed claim\nWithin 42 days after the Contractor became aware of the event, submit supporting particulars.';
 state.contractDocuments=[{documentId:'CONTRACT-X',role:'main',result:{pdf:{pages:[{pageNumber:4,method:'native',text}]},sections:[{sourceMode:'deterministic',text,sectionKey:'20.2.4'}]}} as any];
 state.evidenceDocuments=[{documentId:'CONTRACT-X',sourceFilename:'Agreement.pdf',basisState:'active'} as any];
 const dependencies=contractCompletionDependencies(state);assert.equal(dependencies.length,1);assert.equal(dependencies[0]!.fromSection,'1');assert.equal(dependencies[0]!.toSection,'2');
 const detailed=contractNoticeRules(state,'detailed_claim');assert.equal(detailed[0]!.noticePeriodDays,42);assert.equal(detailed[0]!.triggerBasis,'awareness');
 state.contractDocuments[0]!.result.pdf!.pages[0]!.text='20.2.4 Fully detailed claim\nWithin 42 days submit supporting particulars.';
 assert.equal(contractNoticeRules(state,'detailed_claim')[0]!.triggerBasis,'not_stated','the initial notice trigger must not be borrowed for a detailed claim');
});

test('section completion chooses the named scope milestone and retains ambiguous matches',()=>{
 const rows:any=[{activityId:'ELEC',activityType:'finish_milestone',name:'Electrical Infrastructure - Complete'},{activityId:'INFRA',activityType:'finish_milestone',name:'Infrastructure Completion & Handover - Complete'},{activityId:'ALL',activityType:'finish_milestone',name:'Contractual Completion of the Works'}];
 assert.equal(sectionCompletionMilestone(rows,'Infrastructure')?.activityId,'INFRA');
 assert.equal(sectionCompletionMilestone(rows,'the whole of the Works')?.activityId,'ALL');
 assert.equal(sectionCompletionMilestone([...rows,{...rows[1],activityId:'DUP'}],'Infrastructure'),null);
});

test('baseline start and finish come from the matched adopted baseline, never the update target dates',()=>{
 const state=loadCertifiedDemoProject('BASELINE-DATES-'+randomUUID());
 const baseline=state.schedules.find(r=>r.role==='baseline')!,current=state.schedules.at(-1)!;
 assert.ok(baseline);assert.notEqual(baseline,current);
 const row=baseline.revision.model.activities[0]!,target=current.revision.model.activities.find(a=>a.activityId===row.activityId)!;
 row.baselineStartIso='2025-01-01';row.baselineFinishIso='2025-01-10';
 target.baselineStartIso='2030-12-20';target.baselineFinishIso='2030-01-01';state.version++;
 const actual=reportingState(state).schedules.at(-1)!.revision.model.activities.find(a=>a.activityId===row.activityId)!;
 assert.equal(actual.baselineStartIso,'2025-01-01');assert.equal(actual.baselineFinishIso,'2025-01-10');
  assert.equal(actual.baselineDateBasis,'controlled_baseline','adopted dates must carry their authority into BEI and other shared rules');
 assert.equal(target.baselineStartIso,'2030-12-20','reporting must not overwrite retained evidence');
});

test('completed activities with missing float do not blank remaining-work float counts',()=>{
 const state=loadCertifiedDemoProject('FLOAT-POPULATION-'+randomUUID()),model=state.schedules.at(-1)!.revision.model;
 const sample=model.activities[0]!;model.activities=[{...sample,activityId:'DONE',status:'completed',totalFloatHours:null},{...sample,activityId:'OPEN',status:'not_started',totalFloatHours:-8}];model.relationships=[];
 const result=analyzeSchedule(model);assert.equal(result.float.criticalCount,1);assert.equal(result.float.unknownFloatCount,0);assert.equal(result.float.totalActivities,1);
});

test('one record produces one action and driving work outranks an older non-driving record',()=>{
 const state=loadCertifiedDemoProject('PRIORITY-'+randomUUID()),model=state.schedules.at(-1)!.revision.model,sample=model.activities[0]!;
 model.activities=[{...sample,activityId:'DRIVER',status:'not_started',totalFloatHours:-40},{...sample,activityId:'SLACK',status:'not_started',totalFloatHours:80}];
 const row=(id:string,activity:string,due:string,owner:string|null)=>managementAction({actionId:id,recordKey:actionRecordKey('RFI',id),issue:id,affectedScope:[activity],affectedMilestones:[],owner,organisation:null,requiredAction:'Obtain response',dueIso:due,escalation:null,severity:'high',authority:'source',consequence:null,sourceRefs:[id]});
 const result=prioritizeActions([row('OLD','SLACK','2020-01-01',null),row('NEW','DRIVER','2030-01-01','Design Lead'),{...row('NEW','DRIVER','2030-01-01',null),actionId:'activity-copy',sourceRefs:['second receipt']}],model,['DRIVER'],'independent_cpm',new Map([['DRIVER',-4],['SLACK',120]]));
 assert.equal(result.length,2);assert.equal(result[0]!.issue,'NEW');assert.equal(result[0]!.owner,'Design Lead');assert.deepEqual(result[0]!.sourceRefs,['NEW','second receipt']);
 assert.equal(result[0]!.priorityBasis?.linkedFloatHours,-4);assert.equal(result[0]!.priorityBasis?.floatAuthority,'independent_cpm');
});

test('plot location is parsed from source text without project-specific assumptions',()=>{
 const state=loadCertifiedDemoProject('PLOT-'+randomUUID()),model=state.schedules.at(-1)!.revision.model;
 const row=classifyScheduleActivity(model,{...model.activities[0]!,wbsId:null,name:'Waterproofing Plot 127B roof'});
 assert.equal(row.plot,'Plot 127B');assert.equal(row.location,'Plot 127B');assert.equal(row.classificationBasis.plot,'source_activity_text');
 assert.equal(classifyScheduleActivity(model,{...model.activities[0]!,wbsId:null,name:'Internal plaster - Plot B 42'}).plot,'Plot B 42');
});

test('connected schedule exceptions form one recovery action while linked NCRs retain their identity',()=>{
 const model=loadCertifiedDemoProject('CHAIN-'+randomUUID()).schedules.at(-1)!.revision.model;
 const template=model.activities[0]!;model.activities=[{...template,activityId:'A'},{...template,activityId:'B'}];
 model.relationships=[{relationshipId:'AB',predecessorActivityId:'A',successorActivityId:'B',type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]}];
 const row=(id:string,kind:string)=>managementAction({actionId:kind+id,recordKey:actionRecordKey(kind,id),issue:id,affectedScope:[id],affectedMilestones:[],owner:'Site manager',organisation:null,requiredAction:'Recover',dueIso:'2030-01-01',escalation:null,severity:'high',authority:'source',consequence:null,sourceRefs:[id]});
 const ncr={...row('B','NCR'),actionId:'NCR-1',recordKey:'ncr|NCR-1'};
 const result=consolidateScheduleChains([{...row('A','activity'),affectedScope:['Civil','A']},{...row('B','activity'),affectedScope:['Civil','B']},ncr],model);
 assert.equal(result.length,2);assert.deepEqual(result[0]!.affectedScope,['Civil','A','B']);assert.equal(result[1]!.actionId,'NCR-1');
 assert.deepEqual(result[0]!.sourceRefs,['A','B']);
});

test('all management surfaces, the Director and project review use one complete action register',()=>{
 const state=loadCertifiedDemoProject('ONE-ACTION-REGISTER-'+randomUUID());
 const snapshot=projectFactsForState(state),register=projectActionRegisterForState(state);
 assert.equal(snapshot.actions.openCount.value,register.actions.length);
 assert.equal(register.workflow.actionCount,register.actions.length);
 assert.deepEqual(register.workflow.actions.map(a=>a.id),register.actions.map(a=>a.actionId));
 assert.equal(new Set(register.actions.map(a=>a.recordKey)).size,register.actions.length);
 for(const key of ['master-dashboard','command-center','cross-domain-accountability']){
   const data=moduleForProject(state.projectId,key).data as any;
   assert.deepEqual(data.actions.map((a:any)=>a.actionId),register.actions.map(a=>a.actionId));
   assert.equal(data.projectFacts.actions.openCount.value,register.actions.length);
 }
 const brief=moduleForProject(state.projectId,'pmo-analysis').data as any;
 assert.equal(brief.projectDiagnosis.actionRegister.total,register.actions.length);
 assert.deepEqual(brief.projectDiagnosis.actionRegister.actions.map((a:any)=>a.actionId),register.actions.slice(0,5).map(a=>a.actionId));
 const director=directorForProject(state.projectId)!;
 assert.equal(director.managementActionCount,register.actions.length);
 assert.equal(director.managementActions.length,register.actions.length);
 assert.equal(projectFactsForState(state),snapshot,'the same version retains the exact fact snapshot');
});

test('server activity paging searches the entire population and does not mutate or truncate exports',async()=>{
 const {activityRegisterPage,activityRegisterView}=await import('../packages/runtime-api/src/activity-register-page');
 const rows=Array.from({length:2057},(_,i)=>({activityId:'A'+String(i).padStart(4,'0'),activityType:'task',name:i===2056?'Fire pumps':'Civil work',status:'not_started',criticality:'noncritical',totalFloatHours:40,discipline:i===2056?'Mechanical':'Civil'}));
 const first=activityRegisterPage(rows,new URLSearchParams('page=0&pageSize=50'));
 assert.equal(first.rows.length,50);assert.equal(first.totalCount,2057);assert.equal(first.pageCount,42);
 const tail=activityRegisterPage(rows,new URLSearchParams('page=41&pageSize=50'));assert.equal(tail.rows.length,7);
 const found=activityRegisterPage(rows,new URLSearchParams('q=Fire+pumps&discipline=Mechanical'));
 assert.equal(found.rows[0]!.activityId,'A2056');assert.equal(found.matchingCount,1);assert.equal(rows.length,2057);
 const view=activityRegisterView({rows,scopeClassification:{rows},counts:{critical:{value:0}}});
 assert.equal(view.rows.length,50);assert.equal(view.analysisRows.length,2057);assert.equal(view.scopeClassification.rows,undefined);
 assert.deepEqual(view.activitySummary.filterOptions.discipline,['Civil','Mechanical']);assert.equal(view.activitySummary.executionCount,2057);
 assert.equal(rows.length,2057,'browser projection does not alter the export population');
});

test('two equivalent crews recover local time on a cross-plot chain and never alter its source logic',async()=>{
 const {plotCrewScenarios}=await import('../packages/runtime-api/src/plot-crew-scenarios');
 const model=loadCertifiedDemoProject('CREW-'+randomUUID()).schedules.at(-1)!.revision.model,template=model.activities[0]!;
 model.dataDateIso='2034-01-01';model.calendars=[{calendarId:'C',name:'Daily shift',semanticComplete:true,standardDayHours:8,weeklyWorkMinutes:[480,480,480,480,480,480,480],weeklyWorkIntervals:[0,1,2,3,4,5,6].map(dayIndex=>({dayIndex,intervals:[{start:'08:00',finish:'16:00',minutes:480}]})),sourceRefs:[]}];
 model.activities=Array.from({length:4},(_,i)=>({...template,activityId:'A'+i,name:'Excavation Plot '+(i+1),wbsId:null,activityType:'task' as const,status:'not_started' as const,calendarId:'C',remainingDurationHours:8,sourceConstraints:[],actualStartIso:null,actualFinishIso:null}));
 model.relationships=Array.from({length:3},(_,i)=>({relationshipId:'LINK'+i,predecessorActivityId:'A'+i,successorActivityId:'A'+(i+1),type:'FS' as const,lagHours:0,external:false,sourceRefs:[],diagnostics:[]}));
 const before=JSON.stringify(model),scenarios=plotCrewScenarios(model);assert.equal(scenarios.length,1);assert.equal(scenarios[0]!.possibleDaysRecovered,2);assert.match(scenarios[0]!.assumption,/LINK0, LINK1, LINK2/);assert.match(scenarios[0]!.effectBasis,/local chain/);assert.equal(JSON.stringify(model),before);
 model.activities[1]!.sourceConstraints=[{type:'CS_MSO',dateIso:'2034-02-01'}];assert.equal(plotCrewScenarios(model)[0]!.possibleDaysRecovered,null,'unresolved constraint effect is not bypassed for a scenario');
});


test('management pages receive quantity summaries, not duplicated full item curves',()=>{
 const state=loadCertifiedDemoProject('QUANTITY-CONTEXT-'+randomUUID());
 const curves=Array.from({length:896},(_,i)=>({itemId:'ITEM-'+i,points:Array.from({length:40},(_,day)=>({dateIso:'2036-08-'+String(1+day%30).padStart(2,'0'),planned:day,actual:day/2}))}));
 const modules=new Map([['quantity-scurve',{data:{boqItemCount:896,installedQuantityStatus:'reported_source',series:curves}}]]) as any;
 const context=projectManagementContext(state,modules,null);
 assert.equal(context.crossModule.quantities.sourceSeriesCount,896);
 assert.equal(context.crossModule.quantities.curvesWithPoints,896);
 assert.equal(context.crossModule.quantities.detailModule,'quantity-scurve');
 assert.equal('series' in context.crossModule.quantities,false,'curves remain in owning quantity module only');
 assert.equal(curves.length,896,'original per-item source curves preserved');
 assert.ok(!JSON.stringify(context.crossModule.quantities).includes('ITEM-100'),'management summary cannot serialize raw curve points');
});

test('one procurement date rule identifies overdue delivery and late forecasts for readiness and actions',()=>{
 const position=procurementTiming({dataDateIso:'2036-08-31',programmeNeedDate:'2036-09-13',sourceRequiredOnSite:'2036-08-29',forecastDelivery:null,actualDelivery:null,status:'Ordered'});
 assert.equal(position.overdueUndelivered,true);assert.equal(position.needDate,'2036-08-29');
 assert.equal(procurementTiming({dataDateIso:'2036-08-31',programmeNeedDate:'2036-09-13',sourceRequiredOnSite:null,forecastDelivery:'2036-09-20',actualDelivery:null,status:'Ordered'}).headroomCalendarDays,-7);
 assert.equal(procurementTiming({dataDateIso:'2036-08-31',programmeNeedDate:'2036-08-29',sourceRequiredOnSite:null,forecastDelivery:null,actualDelivery:'2036-09-02',status:'Delivered'}).overdueUndelivered,true,'future delivery must not clear a current blocker');
 const statusOnly=procurementTiming({dataDateIso:'2036-08-31',programmeNeedDate:'2036-08-29',sourceRequiredOnSite:null,forecastDelivery:'2036-09-05',actualDelivery:null,status:'Delivered'});
 assert.equal(statusOnly.deliveredStatusOnly,true,'source says delivered although dated proof is absent');
 assert.equal(statusOnly.deliveredAtDataDate,false,'undated status cannot become a dated actual');
 assert.equal(statusOnly.overdueUndelivered,false,'completed source status is not an open package');
 assert.equal(statusOnly.forecastLate,false,'stale forecast must not relabel a delivered-status package as late');
 const futureActual=procurementTiming({dataDateIso:'2036-08-31',programmeNeedDate:'2036-08-29',sourceRequiredOnSite:null,forecastDelivery:'2036-09-05',actualDelivery:'2036-09-02',status:'Delivered'});
 assert.equal(futureActual.deliveredStatusOnly,false,'future actual outranks stale completed status');
 assert.equal(futureActual.forecastLate,true,'future actual retains current schedule exposure');
 const mixed=Array.from({length:44},(_,i)=>procurementTiming({dataDateIso:'2036-08-31',programmeNeedDate:'2036-08-29',sourceRequiredOnSite:null,forecastDelivery:'2036-09-05',actualDelivery:null,status:i<17?'Ordered':'Delivered'}));
 assert.equal(mixed.filter(row=>row.overdueUndelivered||row.forecastLate).length,17,'status-only delivered rows excluded consistently from late totals');
 assert.equal(procurementTiming({dataDateIso:'2036-08-31',programmeNeedDate:'2036-08-29',sourceRequiredOnSite:null,forecastDelivery:'2036-09-02',actualDelivery:'2036-08-28',status:'Ordered'}).deliveredAtDataDate,true,'actual date wins over stale source status');
 const state=loadCertifiedDemoProject('PACKAGE-READINESS-'+randomUUID()),model=state.schedules.at(-1)!.revision.model;
 model.dataDateIso='2036-08-31';model.activities=[{...model.activities[0]!,activityId:'FIRE',activityType:'task',status:'not_started',actualStartIso:null,actualFinishIso:null,currentStartIso:'2036-09-13',currentFinishIso:'2036-09-24',forecastFinishIso:null,totalFloatHours:-88}];model.relationships=[];
 const document={documentType:'procurement_register',documentId:'PACKAGES'} as any;
 const readiness=deriveReadinessFromCsv({state,document,dataDateIso:'2036-08-31',bytes:Buffer.from('Package ID,Linked Activity,Required On Site,Forecast Delivery,Status,Owner\nPUMP,FIRE,2036-08-29,,Ordered,Procurement Manager')});
 assert.equal(readiness.FIRE!.procurement_material!.state,'blocked');assert.equal(readiness.FIRE!.procurement_material!.records![0]!.owner,'Procurement Manager');
 const result=buildLookAheadProjection(model,{generatedAt:'2036-08-31',producerVersion:'test',readinessEvidence:readiness,drivingActivityIds:['FIRE']});
 assert.equal(result.blockedCount,1);assert.equal(result.rows[0]!.totalFloatHours,-88);assert.equal(result.rows[0]!.drivingPath,true);
 assert.equal(result.managementInterventions![0]!.owner,'Procurement Manager');assert.deepEqual(result.blockerTypes![0]!.recordIds,['PUMP']);
});


test('completed work carries register cleanup rather than a release-to-start blocker',async()=>{
 const {buildProgressBreakdownProjection}=await import('../packages/progress-breakdown/src');
 const state=loadCertifiedDemoProject('COMPLETED-READINESS-'+randomUUID()),model=state.schedules.at(-1)!.revision.model;
 model.dataDateIso='2036-08-31';model.activities=[{...model.activities[0]!,activityId:'DONE',wbsId:'AREA',activityType:'task',status:'completed',actualFinishIso:'2036-08-01',percentComplete:100}];model.wbs=[{wbsId:'AREA',parentWbsId:null,name:'Finished area',sourceRefs:[]}];model.relationships=[];
 const result=buildProgressBreakdownProjection(model,{generatedAt:'2036-08-31',producerVersion:'test',readinessEvidence:{DONE:{design_submittal:{state:'blocked',records:[{owner:'Design manager'}]}}}});
 assert.equal(result.rows[0]!.designBlockerCount,0);assert.equal(result.rows[0]!.completedRecordCleanupCount,1);assert.match(result.rows[0]!.managementAction!,/closeout/);assert.equal(result.rows[0]!.owner,'Design manager');
});

test('certified measured-work ratios exclude applications and future certification dates',async()=>{
 const {certificateProfile}=await import('../packages/runtime-api/src/certificate-profile');
 const amount=(value:number)=>({value,currency:'USD',taxBasis:'exclusive',receipts:[]});
 const row=(id:string,status:string,date:string|null)=>({paymentId:id,periodEnd:'2036-08-01',certificationDate:date,certifiedAmountBasis:'incremental',sourceStatus:status,amounts:{grossWork:amount(100),variations:amount(10),retentionDeduction:amount(5),advanceRecovery:amount(10),netCertifiedAmount:amount(95)}});
 const result=certificateProfile({dataDateIso:'2036-08-31',payments:[row('CERT','Certified','2036-08-10'),row('APP','Application',null),row('FUTURE','Certified','2036-09-10')]} as any).groups[0]!;
 assert.equal(result.certifiedCount,1);assert.equal(result.certifiedTotals!.grossWork,100);assert.equal(result.totals!.grossWork,300,'retained source period arithmetic stays a separate population');
});


test('delay evidence shows dated awards and excludes completed work from current pressure',async()=>{
 const {buildDelayEotEvidenceChain}=await import('../packages/runtime-api/src/delay-eot-evidence-chain');
 const state=loadCertifiedDemoProject('AWARD-CHAIN-'+randomUUID()),model=state.schedules.at(-1)!.revision.model,template=model.activities[0]!;
 model.dataDateIso='2036-08-31';model.activities=[{...template,activityId:'OPEN',activityType:'task',status:'not_started',baselineFinishIso:'2036-09-01',currentFinishIso:'2036-10-01',forecastFinishIso:null,totalFloatHours:-8},{...template,activityId:'DONE',activityType:'task',status:'completed',baselineFinishIso:'2036-01-01',actualFinishIso:'2036-02-01',totalFloatHours:-8}];
 const event:any={eventId:'C:event',title:'Access',linkedClaimIds:['C'],noticeIds:[],relatedActivityIds:['OPEN'],overlappingWindowIds:[],determinationIds:['DET'],noticeTimeliness:'unknown',candidateClass:'insufficient_evidence',describedImpactDays:4,describedImpactState:'candidate',responsibility:'employer',responsibilityState:'candidate',observedPositiveProgrammeMovementDays:10};
 const input:any={schedule:model,windows:{revisionCount:1,windows:[],projectCompletionMovementDays:10},delay:{events:[event]},notices:{events:[]},populationState:'established',sourceClaimCount:1,quarantinedClaimCount:0,determinations:[{determinationId:'DET',claimId:'C',state:'source_immutable',determinationDate:'2036-08-10',awardedDays:4,supersedes:null}]};
 const chain=buildDelayEotEvidenceChain(input);
 assert.equal(chain.programmeContext.delayedActivityCount,1);assert.equal(chain.programmeContext.negativeFloatActivityCount,1);assert.equal(chain.rows[0]!.links.find(row=>row.key==='eot')!.value,4);
 input.determinations[0].determinationDate='2036-09-10';assert.equal(buildDelayEotEvidenceChain(input).rows[0]!.links.find(row=>row.key==='eot')!.value,null);
});
