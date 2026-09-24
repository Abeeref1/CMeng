import { normalizeResourceType } from "../packages/schedule-resource-core/src/xer-adapter";
import test from 'node:test';
import assert from 'node:assert/strict';
import { activityPopulation, analyzeSchedule, DEFAULT_SCHEDULE_ANALYSIS_CONFIG, scheduleProgress, numericDistribution, type CanonicalScheduleActivity, type CanonicalScheduleModel, type CanonicalScheduleRelationship } from '../packages/schedule-analysis-core/src';
import { buildNearCriticalProjection } from '../packages/near-critical-analysis/src';
import { buildProgressBreakdownProjection } from '../packages/progress-breakdown/src';
import { buildProgressScurveProjection } from '../packages/progress-scurve/src';
import { assessPredecessorRequirement, buildLookAheadProjection } from '../packages/lookahead-schedule/src';
import { buildModuleChallenge, type IndependentMetricSpec, type ChallengeValue } from '../packages/module-challenge/src';
import { buildScheduleChangeReportProjection } from '../packages/schedule-change-report/src';
import { buildVarianceTrendsProjection } from '../packages/variance-trends/src';
import { resolveRevisionActivityCorrespondence } from '../packages/schedule-revision-core/src';
import { checkProjectionIntegrity } from '../packages/runtime-api/src/projection-integrity';
import { enforceModuleReadiness } from '../packages/runtime-api/src/module-readiness';
import { parseScheduleInstant } from '../packages/schedule-cpm/src/calendar';

const options = { generatedAt: '2030-01-09T12:00:00Z', producerVersion: 'system-regression' };
function activity(id: string, overrides: Partial<CanonicalScheduleActivity> = {}): CanonicalScheduleActivity {
  return { projectId: 'UNRELATED-FIXTURE', activityId: id, nativeId: id, name: id, wbsId: 'LEAF', calendarId: 'SHIFT',
    activityType: 'task', status: 'in_progress', baselineStartIso: '2030-01-04T08:00:00', baselineFinishIso: '2030-01-08T16:00:00',
    currentStartIso: '2030-01-04T08:00:00', currentFinishIso: '2030-01-08T16:00:00', actualStartIso: null, actualFinishIso: null,
    forecastStartIso: null, forecastFinishIso: null, originalDurationHours: 24, remainingDurationHours: 12,
    totalFloatHours: 0, freeFloatHours: 0, percentComplete: 50, sourceRefs: [], diagnostics: [], ...overrides };
}
function model(activities: CanonicalScheduleActivity[] = [activity('A')]): CanonicalScheduleModel {
  return { projectId: 'UNRELATED-FIXTURE', source: 'schedule_xlsx', sourceRevisionId: 'R2', dataDateIso: '2030-01-07T16:00:00',
    activities, relationships: [], wbs: [{wbsId:'ROOT',parentWbsId:null,name:'Root',sourceRefs:[]},{wbsId:'LEAF',parentWbsId:'ROOT',name:'Child',sourceRefs:[]}],
    calendars: [{ calendarId: 'SHIFT', name: 'Five day eight hour shift', semanticComplete: true, standardDayHours: 8,
      weeklyWorkMinutes: [0,480,480,480,480,480,0], weeklyWorkIntervals: [2,3,4,5,6].map(dayIndex=>({dayIndex,intervals:[{start:'08:00',finish:'16:00',minutes:480}]})), sourceRefs: [] }], diagnostics: [] };
}
function relation(type: CanonicalScheduleRelationship['type'], lagHours: number | null): CanonicalScheduleRelationship {
  return { relationshipId: 'LINK', predecessorActivityId: 'P', successorActivityId: 'S', type, lagHours, external: false, sourceRefs: [], diagnostics: [] };
}
for (const threshold of [-8, 0, 12]) test('shared execution and WBS float populations at critical threshold '+threshold, () => {
  const input=model([activity('critical',{totalFloatHours:threshold}),activity('near',{totalFloatHours:threshold+4}),activity('other',{totalFloatHours:80}),
    activity('LOE',{activityType:'level_of_effort',totalFloatHours:-500,percentComplete:100}),activity('SUMMARY',{activityType:'wbs_summary',totalFloatHours:-200,percentComplete:100})]);
  const config={...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,criticalFloatThresholdHours:threshold,nearCriticalFloatThresholdHours:40,nearCriticalWorkingDays:null};
  const analysis=analyzeSchedule(input,config), near=buildNearCriticalProjection(input,{...options,config}), wbs=buildProgressBreakdownProjection(input,{...options,config});
  assert.equal(analysis.activityCount,5); assert.equal(analysis.population.executableActivityCount,3);
  assert.equal(analysis.float.criticalCount,1); assert.equal(near.nearCriticalCount,1); assert.equal(near.population?.denominator,3);
  assert.equal(wbs.totalActivityCount,3); assert.equal(wbs.rows[0]?.criticalCount,1); assert.equal(wbs.rows[0]?.nearCriticalCount,1);
  assert.equal(wbs.hierarchyRows?.find(r=>r.wbsId==='ROOT')?.activityCount,3);
  assert.equal(wbs.hierarchyRows?.find(r=>r.wbsId==='ROOT')?.directActivityCount,0);
  assert.equal(wbs.rows.reduce((n,r)=>n+r.activityCount,0),3);
});
test('working-day threshold follows each resource-independent activity calendar',()=>{
  const input=model([activity('six',{calendarId:'SIX',totalFloatHours:35}),activity('ten',{calendarId:'TEN',totalFloatHours:35})]);
  input.calendars=[{calendarId:'SIX',semanticComplete:true,name:null,standardDayHours:6,sourceRefs:[]},{calendarId:'TEN',semanticComplete:true,name:null,standardDayHours:10,sourceRefs:[]}];
  const config={...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:5};
  const near=buildNearCriticalProjection(input,{...options,config}); assert.deepEqual(near.rows.map(r=>r.activityId),['ten']);
});
test('unknown activity types stay visible and missing progress is not zero-filled',()=>{
  const input=model([activity('known',{originalDurationHours:10,percentComplete:40}),activity('missing',{originalDurationHours:90,percentComplete:null}),activity('unknown',{activityType:'unknown',originalDurationHours:null}),activity('LOE',{activityType:'level_of_effort',originalDurationHours:1000,percentComplete:100})]);
  const population=activityPopulation(input); assert.equal(population.contract.denominator,3); assert.equal(population.contract.unknownActivityTypeCount,1);
  const progress=scheduleProgress(input.activities); assert.equal(progress.value,40); assert.equal(progress.knownCount,1); assert.equal(progress.totalCount,3); assert.equal(progress.state,'partial');
});
test('working calendar progress excludes weekends and uses baseline fields before current and forecast',()=>{
  const input=model(); input.dataDateIso='2030-01-06T16:00:00';
  const baseline=model([activity('A',{currentFinishIso:'2030-02-28T16:00:00',forecastFinishIso:'2030-03-31T16:00:00'})]); baseline.sourceRevisionId='BASE';
  const curve=buildProgressScurveProjection(input,{...options,baselineModel:baseline});
  const at=curve.points.find(p=>p.dateIso.startsWith('2030-01-06'))!;
  assert.ok(at); assert.ok(Math.abs(at.baselinePlannedPercent!-100/3)<0.00001); assert.equal(at.currentForecastPercent,at.baselinePlannedPercent);
  const wbs=buildProgressBreakdownProjection(input,{...options,baselineModel:baseline});
  assert.equal(wbs.rows[0]?.baselinePlannedPercent,at.baselinePlannedPercent); assert.equal(wbs.rows[0]?.currentPlanPercent,at.currentForecastPercent);
});
test('unresolved calendar withholds planned phasing and exposes coverage',()=>{
  const input=model(); input.calendars=[]; const curve=buildProgressScurveProjection(input,options);
  assert.equal(curve.currentCoveragePercent,0); assert.ok(curve.points.every(p=>p.currentForecastPercent===null));
  assert.ok(curve.diagnostics.some(d=>d.startsWith('PROGRESS_WORKING_CALENDAR_UNRESOLVED')));
});
test('schedule history does not extend beyond its last observation or accept future actuals',()=>{
  const input=model(); input.dataDateIso='2030-01-09'; input.activities[0]!.currentFinishIso='2030-01-31';
  const curve=buildProgressScurveProjection(input,{...options,intervalDays:1,actualHistory:[
    {asOfIso:'2030-01-04',progressPercent:15,sourceRevisionId:'R1',sourceRefs:['R1']},
    {asOfIso:'2030-01-07',progressPercent:45,sourceRevisionId:'R2',sourceRefs:['R2']},
    {asOfIso:'2030-01-20',progressPercent:90,sourceRevisionId:'FUTURE',sourceRefs:['FUTURE']},
  ]});
  assert.equal(curve.observationCount,2); assert.ok(curve.points.some(p=>p.dateIso>'2030-01-09'));
  assert.ok(curve.points.filter(p=>p.dateIso.slice(0,10)>'2030-01-07').every(p=>p.actualProgressPercent===null));
});
test('conflicting observations at one reporting date are withheld',()=>{
  const input=model(); const curve=buildProgressScurveProjection(input,{...options,actualHistory:[30,60].map(progressPercent=>({asOfIso:input.dataDateIso!,progressPercent,sourceRevisionId:'R2',sourceRefs:['source']}))});
  assert.ok(curve.points.every(p=>p.actualProgressPercent===null)); assert.ok(curve.diagnostics.some(d=>d.startsWith('CONFLICTING_SCHEDULE_PROGRESS_SNAPSHOTS')));
});
for(const type of ['FS','SS','FF','SF'] as const) test(type+' predecessor uses the correct endpoint rather than predecessor completion status',()=>{
  const predecessor=activity('P',{status:'in_progress',currentStartIso:'2030-01-07T08:00:00',currentFinishIso:'2030-01-08T16:00:00'});
  const successor=activity('S',{currentStartIso:'2030-01-07T08:00:00',currentFinishIso:'2030-01-08T16:00:00'});
  const assessed=assessPredecessorRequirement(model([predecessor,successor]),relation(type,0),predecessor,successor);
  assert.equal(assessed.state,type==='FS'?'blocked':'ready');
});
test('positive and negative relationship lag use calendar evidence, missing lag stays unknown',()=>{
  const pred=activity('P',{currentFinishIso:'2030-01-04T16:00:00'}),succ=activity('S',{currentStartIso:'2030-01-07T12:00:00'}),input=model([pred,succ]);
  assert.equal(assessPredecessorRequirement(input,relation('FS',8),pred,succ).state,'blocked');
  assert.equal(assessPredecessorRequirement(input,relation('FS',-8),pred,succ).state,'ready');
  assert.equal(assessPredecessorRequirement(input,relation('FS',null),pred,succ).state,'unknown');
  input.calendars=[]; assert.equal(assessPredecessorRequirement(input,relation('FS',4),pred,succ).state,'unknown');
});
test('lookahead excludes LOE and exposes missed starts and gaps even in blocked work',()=>{
  const pred=activity('P',{currentFinishIso:'2030-01-15'}),succ=activity('S',{status:'not_started',currentStartIso:'2030-01-06',currentFinishIso:'2030-01-20'});
  const input=model([pred,succ,activity('LOE',{activityType:'level_of_effort'})]); input.relationships=[relation('FS',0)];
  const look=buildLookAheadProjection(input,options); const row=look.rows.find(r=>r.activityId==='S')!;
  assert.equal(look.rows.some(r=>r.activityId==='LOE'),false); assert.equal(row.missedPlannedStart,true); assert.equal(row.finishOverdue,false);
  assert.equal(row.readiness.state,'blocked'); assert.ok(look.blockedWithEvidenceGapCount!>0); assert.equal(look.evidenceGapActivityCount,look.rows.length);
});
function submitted(value: number, unit='activities'): ChallengeValue { return {value,unit,state:'submitted',authority:'submitted',sourceRefs:['source'],basisRevisionId:'R2',coveragePercent:100,asOfIso:'2030-01-07',confidence:1,diagnostics:[],note:null}; }
function challenge(value: number|null, override: ChallengeValue, tolerance=0) {
  const metric: IndependentMetricSpec={metric:'count',label:'Count',value,unit:'activities',state:value===null?'not_derivable':'calculated',sourceRefs:['calc'],submittedOverride:override,tolerance,
    consequenceWhenDifferent:'Different',consequenceWhenMissing:'Missing submitted',actionWhenDifferent:'Reconcile',actionWhenMissing:'Supply source'};
  return buildModuleChallenge({moduleKey:'fixture',generatedAt:options.generatedAt,assertions:[],metrics:[metric]});
}
test('independent unavailability never becomes missing contractor evidence or agreement',()=>{
  const result=challenge(null,submitted(9)); assert.equal(result.items[0]?.submitted.value,9); assert.equal(result.reconciliationState,'independent_unavailable'); assert.equal(result.unavailableCheckCount,1); assert.equal(result.notSubmittedCount,0);
  assert.doesNotMatch(result.items[0]!.action,/supply source/i); assert.equal(result.reconciledCount,0);
});
test('both comparison sides missing never blames contractor for an unavailable CMeng calculation',()=>{
  const result=challenge(null,{...submitted(0),value:null,state:'not_submitted'});
  assert.equal(result.reconciliationState,'independent_unavailable');
  assert.equal(result.notSubmittedCount,0);
  assert.equal(result.items[0]!.gap.state,'not_derivable');
  assert.match(result.items[0]!.gap.note!,/Independent comparison not established/);
  assert.doesNotMatch(result.items[0]!.gap.note!,/contractor did not submit/);
});
test('configured tolerance controls material-difference counts',()=>{
  assert.equal(challenge(10.4,submitted(10),0.5).materialDifferenceCount,0);
  assert.equal(challenge(10.4,submitted(10),0.5).reconciliationState,'within_tolerance');
  assert.equal(challenge(10.6,submitted(10),0.5).materialDifferenceCount,1);
});
test('different measurement units cannot be reconciled by numeric equality',()=>{
  const result=challenge(10,submitted(10,'hours')); assert.equal(result.reconciliationState,'incomparable'); assert.equal(result.items[0]?.gap.value,null);
});
test('numeric agreement with a scenario never removes the governance action',()=>{
  const result=buildModuleChallenge({moduleKey:'fixture',generatedAt:options.generatedAt,assertions:[],metrics:[{
    metric:'count',label:'Count',value:10,unit:'activities',state:'scenario',sourceRefs:['scenario'],submittedOverride:submitted(10),
    consequenceWhenDifferent:'Different',consequenceWhenMissing:'Missing',actionWhenDifferent:'Reconcile',actionWhenMissing:'Supply source',
  }]});
  assert.equal(result.reconciliationState,'scenario'); assert.equal(result.reconciledCount,0);
  assert.match(result.items[0]!.action,/govern/); assert.doesNotMatch(result.items[0]!.consequence,/within.*tolerance/i);
});
test('activity identity is shared across revision changes and controlled-baseline variance',()=>{
  const baseline=model([activity('OLD',{nativeId:'UID',baselineFinishIso:'2030-01-08',currentFinishIso:'2030-03-30'})]); baseline.sourceRevisionId='BASE';
  const current=model([activity('NEW',{nativeId:'UID',currentFinishIso:'2030-01-10'})]);
  const revisions=[{revisionId:'BASE',label:'Baseline',sequence:1,effectiveAt:'2030-01-01',model:baseline},{revisionId:'R2',label:'Update',sequence:2,effectiveAt:'2030-01-07',model:current}];
  const change=buildScheduleChangeReportProjection(revisions[0]!,revisions[1]!,options); assert.equal(change.matchedActivityCount,1); assert.equal(change.addedActivityCount,0); assert.equal(change.changedActivities[0]?.identityMethod,'native_id');
  const trend=buildVarianceTrendsProjection(revisions,{...options,controlledBaselineRevision:revisions[0]!}); assert.equal(trend.points[1]?.averageFinishVarianceDays,2); assert.equal(trend.points[1]?.comparableActivities,1);
});
test('ambiguous fallback identities remain unresolved',()=>{
  const before=[activity('OLD1',{nativeId:null,name:'Same'}),activity('OLD2',{nativeId:null,name:'Same'})];
  const after=[activity('NEW',{nativeId:null,name:'Same'})]; const matches=resolveRevisionActivityCorrespondence(before,after);
  assert.equal(matches.matches.length,0); assert.ok(matches.ambiguousFrom.size>0 || matches.ambiguousTo.size>0);
});
test('baseline mutations and unique relationship type/lag modifications remain auditable',()=>{
  const before=model([activity('P',{baselineDateBasis:'controlled_baseline'}),activity('S')]); before.sourceRevisionId='OLD'; before.relationships=[relation('FS',0)];
  const after=model([activity('P',{baselineDateBasis:'controlled_baseline',baselineFinishIso:'2030-01-09'}),activity('S')]); after.relationships=[relation('SS',8)];
  const result=buildScheduleChangeReportProjection({revisionId:'OLD',label:null,sequence:1,effectiveAt:null,model:before},{revisionId:'R2',label:null,sequence:2,effectiveAt:null,model:after},options);
  assert.equal(result.baselineMutationActivityCount,1); assert.equal(result.modifiedRelationships?.length,1); assert.equal(result.grossRelationshipChurn,2); assert.equal(result.netRelationshipCountChange,0);
});
test('runtime consistency gate exposes a wrong count rather than certifying it',()=>{
  const input=model(); const result=checkProjectionIntegrity({key:'near-critical',status:'ready',reason:null,dependencies:[],data:{nearCriticalCount:999}},input,DEFAULT_SCHEDULE_ANALYSIS_CONFIG);
  assert.equal(result.status,'partial'); assert.equal((result.data as any).systemEvidenceContract.state,'failed');
});
test('the universal module resolver never promotes pending, missing or failed gates to green',()=>{
  const base = {key:'fixture',status:'ready' as const,engineState:'ready' as const,evidenceState:'established' as const,
    professionalState:'defensible' as const,reason:null,dependencies:[],data:{challenge:{reconciliationState:'within_tolerance'},systemEvidenceContract:{state:'verified_for_checked_metrics',checks:[{passed:true}]}}};
  const pass = {state:'pass' as const,failedCheckIds:[],checkCount:6};
  assert.equal(enforceModuleReadiness(base,pass).status,'ready');
  assert.equal(enforceModuleReadiness({...base,data:{systemEvidenceContract:{state:'not_checked',checks:[]}}},pass).status,'partial');
  assert.equal(enforceModuleReadiness({...base,evidenceState:'missing'},pass).status,'partial');
  assert.equal(enforceModuleReadiness({...base,professionalState:'review_required'},pass).status,'partial');
  assert.equal(enforceModuleReadiness({...base,data:{...base.data,challenge:{reconciliationState:'material_difference'}}},pass).status,'partial');
  assert.equal(enforceModuleReadiness(base,{...pass,state:'fail',failedCheckIds:['POPULATION_MISMATCH']}).status,'partial');
});
test('distribution reports concentration without asserting causality',()=>{
  const result=numericDistribution([10,10,10,40,null]); assert.equal(result.median,10); assert.equal(result.dominantCount,3); assert.equal(result.unknownCount,1); assert.match(result.interpretation,/not evidence/);
  const secondary=numericDistribution([0,0,0,0,1,2,3,50,50,null]);
  assert.equal(secondary.dominantValue,0); assert.equal(secondary.maximum,50); assert.equal(secondary.maximumCount,2);
});
test('zone-less P6 timestamps have identical epoch meaning across server timezones',()=>{
  const before=process.env.TZ;
  try { process.env.TZ='Asia/Dubai';const a=parseScheduleInstant('2030-01-07T08:00:00');process.env.TZ='America/Los_Angeles';assert.equal(parseScheduleInstant('2030-01-07T08:00:00'),a);assert.equal(a,Date.parse('2030-01-07T08:00:00Z')); }
  finally { if(before===undefined)delete process.env.TZ;else process.env.TZ=before; }
});

test("MAT is a material resource class, not an unknown labor capacity",()=>{ assert.equal(normalizeResourceType("MAT"),"material");assert.equal(normalizeResourceType("RT_Mat"),"material"); });

test('initial quantity page and full management synthesis use the same unit population and preserve unmapped actuals',async()=>{
  const {runtimeProjects}=await import('../packages/runtime-api/src/project-state');
  const {moduleForProject}=await import('../packages/runtime-api/src/project-projections');
  const id='QUANTITY-PARITY-'+Date.now(); const state=runtimeProjects.getOrCreate(id); const schedule=model();
  schedule.projectId=id; schedule.activities=schedule.activities.map(a=>({...a,projectId:id}));
  state.schedules.push({role:'update',format:'xer',sourceFilename:'unrelated.xer',sourceHashSha256:'fixture',uploadedAt:options.generatedAt,
    revision:{revisionId:'R2',label:'Update',sequence:1,effectiveAt:schedule.dataDateIso,model:schedule}} as typeof state.schedules[number]);
  state.quantities={projectId:id,boqRevisionId:'BOQ',scheduleRevisionId:'R2',items:['m2','m3'].map((unit,i)=>({quantityItemId:'Q'+i,itemNumber:String(i),section:null,description:'Measured quantity '+i,unit,contractQuantity:100,sourceRefs:[{source:'boq_csv',locator:'row:'+i}],diagnostics:[]})),allocations:[],
    installedSnapshots:[{snapshotId:'MEASUREMENT',asOfIso:'2030-01-07',quantityItemId:'Q0',installedQuantity:7,sourceRefs:[{source:'progress_record',locator:'measurement:1'}]}],diagnostics:[]};
  state.version++;
  const initial=moduleForProject(id,'quantity-scurve').data as any;
  const pmo=moduleForProject(id,'pmo-analysis').data as any;
  assert.equal(initial.series.length,2); assert.equal(pmo.quantities.unitSeriesCount,initial.series.length);
  assert.equal(initial.boqState,'loaded'); assert.equal(initial.candidateMappingState,'evaluated');
  assert.equal(initial.series.find((s:any)=>s.unit==='m2').points.find((p:any)=>p.actualInstalledQuantity!==null).actualInstalledQuantity,7);
  assert.equal(state.quantities.allocations.length,0,'scenario evaluation must not govern a crosswalk');
});

test('unknown contract quantities cannot appear as allocated items when no crosswalk exists',async()=>{
  const {runtimeProjects}=await import('../packages/runtime-api/src/project-state');
  const {moduleForProject}=await import('../packages/runtime-api/src/project-projections');
  const id='QUANTITY-UNKNOWN-'+Date.now(), state=runtimeProjects.getOrCreate(id), schedule=model();
  schedule.projectId=id;
  state.schedules.push({role:'update',format:'xer',sourceFilename:'source.xer',sourceHashSha256:'fixture',uploadedAt:options.generatedAt,
    revision:{revisionId:'R2',label:'Update',sequence:1,effectiveAt:schedule.dataDateIso,model:schedule}} as typeof state.schedules[number]);
  state.quantities={projectId:id,boqRevisionId:'BOQ',scheduleRevisionId:'R2',items:[{quantityItemId:'Q',itemNumber:'1',section:null,
    description:'Quantity unknown',unit:null,contractQuantity:null,sourceRefs:[],diagnostics:[]}],allocations:[],installedSnapshots:[],diagnostics:[]};
  state.version++;
  const result=moduleForProject(id,'quantity-scurve').data as any;
  assert.equal(result.boqItemCount,1); assert.equal(result.knownQuantityItemCount,0);
  assert.equal(result.allocatedItemCount,0); assert.equal(result.itemLinkCoveragePercent,0);
  assert.deepEqual(result.unmappedItemIds,['Q']); assert.equal(result.mappingBasis,'missing');
  assert.equal(result.challenge.items[0].independent.value,0);
});

test('XER target date changes do not assert that the controlled baseline changed',()=>{
  const before=model([activity('A',{baselineDateBasis:'xer_target_dates'})]);
  const after=model([activity('A',{baselineDateBasis:'xer_target_dates',currentFinishIso:'2030-01-15T16:00:00',baselineFinishIso:'2030-01-15T16:00:00'})]);
  const revision=(id:string,m:CanonicalScheduleModel,sequence:number)=>({revisionId:id,label:id,sequence,effectiveAt:m.dataDateIso,model:m});
  const p=buildScheduleChangeReportProjection(revision('update-1',before,1),revision('update-2',after,2),options);
  assert.equal(p.baselineMutationActivityCount,0);assert.equal(p.sourceTargetDateChangeCount,1);
  const governedBefore=model([activity('A',{baselineDateBasis:'controlled_baseline'})]);
  const governedAfter=model([activity('A',{baselineDateBasis:'controlled_baseline',baselineFinishIso:'2030-01-15T16:00:00'})]);
  assert.equal(buildScheduleChangeReportProjection(revision('base-1',governedBefore,1),revision('base-2',governedAfter,2),options).baselineMutationActivityCount,1);
});
test('runtime certification detects corrupted date movement and source populations across previously unchecked projections',()=>{
 const m=model([activity('A'),activity('LOE',{activityType:'level_of_effort'})]);
 const checked=(key:string,data:any)=>checkProjectionIntegrity({key,status:'ready',reason:null,dependencies:[],data},m,DEFAULT_SCHEDULE_ANALYSIS_CONFIG).data as any;
 const revision={revisionCount:1,points:[{revisionId:'R2',activityCount:2,executionActivityCount:1,completedCount:0,inProgressCount:1,notStartedCount:0,unknownStatusCount:0,criticalCount:1,nearCriticalCount:0}]};
 assert.equal(checked('revision-trend',revision).systemEvidenceContract.state,'verified_for_checked_metrics');
 assert.equal(checked('revision-trend',{...revision,revisionCount:2}).systemEvidenceContract.state,'failed');
 const forecast={activities:[{activityId:'A',status:'calculated',sourceFinishIso:'2030-01-08',independentEarlyFinishIso:'2030-01-10',finishVarianceDays:2}],calculatedActivityCount:1,unresolvedActivityCount:0,sourceForecastCompletionIso:'2030-01-08',independentForecastCompletionIso:'2030-01-10',forecastVarianceDays:2,requiredFinishIso:null,requiredFinishVarianceDays:null};
 assert.equal(checked('independent-forecast',forecast).systemEvidenceContract.failureCount,0);
 assert.equal(checked('independent-forecast',{...forecast,forecastVarianceDays:4}).systemEvidenceContract.state,'failed');
 assert.equal(checked('quantity-scurve',{unitKeyed:true,series:[{seriesKey:'m',points:[{dateIso:'2030-01-08',actualInstalledQuantity:1}]}]}).systemEvidenceContract.state,'failed');
 const history={snapshotCount:2,establishedForecastCount:1,points:[{snapshotId:'missing',independentForecastCompletionIso:null,movementDaysVsPrevious:null,movementDaysVsFirst:null},{snapshotId:'known',independentForecastCompletionIso:'2030-01-10',movementDaysVsPrevious:null,movementDaysVsFirst:0}]};
 assert.equal(checked('forecast-history',history).systemEvidenceContract.failureCount,0);
});
