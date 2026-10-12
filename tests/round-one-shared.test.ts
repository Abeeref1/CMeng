import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {managementText,managementValue,managementNumber} from '../packages/runtime-api/src/management-values';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {projectActionRegisterForState,moduleForProject,forecastSnapshotFromProjection} from '../packages/runtime-api/src/project-projections';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {pageProjectResponse,recordDetailPage} from '../packages/runtime-api/src/response-paging';
import {responseSourceLabels} from '../packages/runtime-api/src/response-labels';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {classifyScheduleActivity} from '../packages/runtime-api/src/schedule-scope-classification';
import {activityRegisterPage} from '../packages/runtime-api/src/activity-register-page';
import {attachLookaheadResourceLinks} from '../packages/runtime-api/src/lookahead-resource-linkage';

for(let sample=0;sample<10;sample++)test('Round one shared population and presentation contract '+sample,()=>{
 const state=loadCertifiedDemoProject('R1-'+randomUUID()),seed=state.controls.rfis[0]!;
 assert.ok(seed,'fixture includes a real operational RFI shape');
 for(let i=0;i<100+sample;i++)state.controls.rfis.push({...seed,rfiId:'R1-SOURCE-'+sample+'-'+i,owner:'Design group '+sample,status:'open'});
 state.version++;
 const before=JSON.stringify(state.controls.rfis),register=projectActionRegisterForState(state);
 assert.ok(register.recordActions.length>=100+sample);
 assert.equal(register.actions.length,register.ownerGroups.length+register.reviewActionCount,'headlines count groups and source-review decisions, not member records');
 assert.equal(register.workflow.actionCount,register.actions.length);
 assert.equal(projectFactsForState(state).actions.openCount.value,register.actions.length);
 for(const key of ['master-dashboard','command-center','cross-domain-accountability']){
  const result=moduleForProject(state.projectId,key).data as any;
  assert.equal(result.projectFacts.actions.openCount.value,register.actions.length,key+' must use the canonical grouped fact');
 }
 const group=register.ownerGroups.find(g=>g.owner==='Design group '+sample)!;assert.ok(group);
 assert.equal(group.count,100+sample);
 const page=recordDetailPage({recordActions:register.recordActions},'/recordActions',75,25,{groupKey:group.key}) as any;
 assert.equal(page.total,group.count);assert.equal(page.rows.length,25);
 assert.ok(page.rows.every((row:any)=>group.memberActionIds.includes(row.actionId)));
 assert.equal(JSON.stringify(state.controls.rfis),before,'read-only grouping never changes source records');
 const narrative='due=2026-08-29T11:42:30.123Z; payment_register status=open; quantity '+(12.123456+sample)+'; null; undefined';
 const text=managementText(narrative);
 assert.match(text,/Aug 29, 2026/);assert.match(text,/Status: Open/);
 assert.doesNotMatch(text,/\d{4}-\d{2}-\d{2}|_register status=|\bnull\b|\bundefined\b|\.\d{5,}/);
 assert.equal(managementValue({value:null,valueState:'not_in_source'},'days'),'Not in source');
 assert.equal(managementNumber(0.0001),'<0.01');assert.equal(managementNumber(0),'0');
 const model=state.schedules.at(-1)!.revision.model;
 const activity={...model.activities[0]!,activityId:'PLOT-SOURCE',name:'Systems testing - System 01, Plot B12',wbsId:null};
 const classified=classifyScheduleActivity(model,activity);
 assert.equal(classified.system,'System 01');assert.equal(classified.plot,'Plot B12');
 const rows=[{activityId:'A',plot:'Plot B12',location:'North'},{activityId:'B',plot:'Plot A10',location:'South'}];
 const filtered=activityRegisterPage(rows,new URLSearchParams('plot=Plot+B12&location=North'));
 assert.equal(filtered.matchingCount,1);assert.equal(filtered.rows[0]!.activityId,'A');
 const source={key:'test',data:{rows:Array.from({length:140},(_,i)=>({recordId:'record_'+i,reference:'RFI-'+i})),sourceLabels:Object.fromEntries(Array.from({length:140},(_,i)=>['record_'+i,'RFI-'+i]))}};
 const paged=pageProjectResponse(source,'/api/projects/X/delivery/modules/test') as any;
 assert.equal(paged.responsePaging.tables.find((t:any)=>t.pointer==='/data/rows').total,140);
 assert.equal(paged.data.rows.length,25);assert.equal(paged.data.sourceLabels.record_4,'RFI-4');
 assert.equal(paged.data.sourceLabels.record_139,undefined,'only the visible label catalogue crosses transport');
 assert.equal(responseSourceLabels(source.data.sourceLabels,{message:'record_139'})['record_139'],'RFI-139');
});

test('shared resource identity remains distinct from capacity approval',()=>{
 const p:any={sourceResourceTrades:[{resourceId:'P6-E',matchedRegisterResourceId:'REG-E',trade:'Electrician',registerLinkedByTradeName:true,capacityUnitsComparable:false,activityIds:['A'],registerSourceRefs:['register:row:2'],registerMatchBasis:'Unique matching trade name'}],forwardWindowRows:[{activityId:'A',readiness:{dimensions:[{key:'resource',state:'unknown',sourceRefs:[]}]}}],readinessCoverage:[{key:'resource'}]};
 attachLookaheadResourceLinks(p);assert.equal(p.resourceLinkedActivityCount,1);assert.equal(p.readinessCoverage[0].identityKnownCount,1);assert.equal(p.forwardWindowRows[0].readiness.dimensions[0].state,'unknown');
});

test('the complete assembled browser retains source-backed formatting and exact table counts',()=>{
 const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
 assert.doesNotThrow(()=>new Function(script));
 for(const fn of ['managementText','responseListPopulation','observeProjectDisplay','amendmentEotManagementDisplay'])assert.ok(script.includes('function '+fn+'('),fn);
 assert.ok(script.includes('amendment text not found'));
 assert.ok(script.includes("population.total"));
});

test('Forecast history publishes no recalculated date or difference after a hard CPM failure',()=>{
 const state=loadCertifiedDemoProject('HISTORY-GATE-'+randomUUID()),model=state.schedules.at(-1)!.revision.model;
 const source:any={schemaVersion:'1.0',projectionKey:'independent_forecast',snapshotId:'S',generatedAt:'2026-08-31',sourceRevisionId:model.sourceRevisionId,dataDateIso:model.dataDateIso,producerVersion:'test',origin:'deterministic_source_calendar',sourceForecastCompletionIso:'2027-01-01',independentForecastCompletionIso:'2028-07-02',complete:false,calculatedActivityCount:1,activityCoveragePercent:50,unresolvedActivityCount:1,assumptions:[],diagnostics:['CPM_NETWORK_NOT_CALCULABLE'],activities:[]};
 const before=JSON.stringify(source),snapshot=forecastSnapshotFromProjection(source,'S',model);
 assert.equal(snapshot.independentForecastCompletionIso,null);assert.equal(snapshot.calculationState,'withheld');
 assert.equal(snapshot.sourceForecastCompletionIso,'2027-01-01');assert.equal(snapshot.calculationEvidence.rawRecalculatedFinishIso,'2028-07-02');
 assert.equal(JSON.stringify(source),before,'audit evidence is not deleted to hide a failed calculation');
});

test('activity first-page size and full status split remain consistent through response paging',async()=>{
 const {activityRegisterView}=await import('../packages/runtime-api/src/activity-register-page');
 const rows=Array.from({length:201},(_,i)=>({activityId:'A-'+i,activityType:'task',status:i<70?'completed':'not_started',criticality:'critical',totalFloatHours:0}));
 const view=activityRegisterView({projectionKey:'activity_analytics',rows});
 const response=pageProjectResponse({key:'activity-analytics',data:view},'/api/projects/P/schedule/modules/activity-analytics') as any;
 assert.equal(response.data.rows.length,50,'the pager must not silently halve an already paged activity register');
 assert.equal(response.data.activitySummary.statusCounts.completed,70);assert.equal(response.data.activitySummary.statusCounts.not_started,131);
 assert.equal(response.data.activitySummary.criticalityCounts.critical,131,'completed activities do not enter the open criticality split');
 assert.equal(response.data.activitySummary.executionCount,201);assert.equal(rows.length,201);
});

test('known register EOT remains present even when amendment text is missing',async()=>{
 const {createSourceFile,ScriptTarget,isFunctionDeclaration}=await import('typescript');
 const {runInNewContext}=await import('node:vm');
 const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
 const source=createSourceFile('assembled.js',script,ScriptTarget.Latest,true);
 const declaration=source.statements.filter(isFunctionDeclaration).find(n=>n.name?.text==='amendmentEotManagementDisplay')!;
 assert.ok(declaration);
 const facts={awardedEotDays:{value:181},amendmentEotStatements:[{statement:'amendment text not found'}]};
 const result=runInNewContext(declaration.getText(source)+';amendmentEotManagementDisplay(null,facts)',{facts,fmt:String,managementNumber});
 assert.match(result,/181 days awarded in the determination register/);assert.match(result,/amendment text not found/);
 assert.doesNotMatch(result,/Not in source days|undefined|null/);assert.equal(facts.awardedEotDays.value,181);
});
