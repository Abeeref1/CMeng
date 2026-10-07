import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {reportingState} from '../packages/runtime-api/src/reporting-state';
import {prioritizeActions,actionRecordKey,consolidateScheduleChains} from '../packages/runtime-api/src/action-priority';
import {managementAction} from '../packages/truth-kernel/src';
import {classifyScheduleActivity} from '../packages/runtime-api/src/schedule-scope-classification';
import {analyzeSchedule} from '../packages/schedule-analysis-core/src';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {projectActionRegisterForState,moduleForProject,directorForProject} from '../packages/runtime-api/src/project-projections';
import {programmeCashScenario} from '../packages/runtime-api/src/programme-cash-scenario';
import {contractCompletionDependencies} from '../packages/runtime-api/src/project-contract-sections';
import {contractNoticeRules} from '../packages/runtime-api/src/contract-notice-rules';

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
 const result=prioritizeActions([row('OLD','SLACK','2020-01-01',null),row('NEW','DRIVER','2030-01-01','Design Lead'),{...row('NEW','DRIVER','2030-01-01',null),actionId:'activity-copy',sourceRefs:['second receipt']}],model,['DRIVER']);
 assert.equal(result.length,2);assert.equal(result[0]!.issue,'NEW');assert.equal(result[0]!.owner,'Design Lead');assert.deepEqual(result[0]!.sourceRefs,['NEW','second receipt']);
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
 for(const key of ['command-center','cross-domain-accountability']){
   const data=moduleForProject(state.projectId,key).data as any;
   assert.deepEqual(data.actions.map((a:any)=>a.actionId),register.actions.map(a=>a.actionId));
   assert.equal(data.projectFacts.actions.openCount.value,register.actions.length);
 }
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
