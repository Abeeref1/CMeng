import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {compareProgressScopes} from '../packages/progress-scurve/src/projector';
import {classifyScheduleChanges,compareScheduleRevisions} from '../packages/schedule-revision-core/src';
import {durationEditReview,scheduleBasisReview} from '../packages/runtime-api/src/schedule-basis-review';
import {buildIndependentForecastProjection} from '../packages/independent-forecast/src';
import {delayClaimsAsOf} from '../packages/delay-analysis-core/src/reporting';
import {assessEventNotice} from '../packages/delay-analysis-core/src/notices';
import {buildModuleChallenge} from '../packages/module-challenge/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {buildNearCriticalProjection} from '../packages/near-critical-analysis/src';
import {buildLookAheadProjection} from '../packages/lookahead-schedule/src';
import {DEFAULT_SCHEDULE_ANALYSIS_CONFIG,type CanonicalScheduleActivity,type CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import type {CanonicalDelayEvent,DelayClaimsModel,NoticeRequirement} from '../packages/delay-analysis-core/src';

const activity=(id:string,overrides:Partial<CanonicalScheduleActivity>={}):CanonicalScheduleActivity=>({projectId:'UNRELATED',activityId:id,nativeId:id,name:id,wbsId:'area',calendarId:'everyday',activityType:'task',status:'in_progress',baselineStartIso:'2026-01-01',baselineFinishIso:'2026-01-11',baselineDateBasis:'xer_target_dates',currentStartIso:'2026-01-01',currentFinishIso:'2026-01-11',actualStartIso:'2026-01-01',actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:10,remainingDurationHours:5,totalFloatHours:20,freeFloatHours:null,percentComplete:50,sourceRefs:[],diagnostics:[],...overrides});
const model=(id:string,activities:CanonicalScheduleActivity[]):CanonicalScheduleModel=>({projectId:'UNRELATED',source:'xer',sourceRevisionId:id,dataDateIso:'2026-01-06',activities,relationships:[],wbs:[{wbsId:'area',parentWbsId:null,name:'Area Alpha',sourceRefs:[]}],calendars:[{calendarId:'everyday',name:'Every day',semanticComplete:true,standardDayHours:24,weeklyWorkMinutes:[1440,1440,1440,1440,1440,1440,1440],weeklyWorkIntervals:[1,2,3,4,5,6,7].map(dayIndex=>({dayIndex,intervals:[{start:"00:00",finish:"24:00",minutes:1440}]})),sourceRefs:[]}],diagnostics:[]});
const event:CanonicalDelayEvent={eventId:'E-OTHER',title:'Access',category:'late_access',startIso:null,awarenessIso:null,endIso:null,responsibility:'unknown',responsibilityState:'missing',describedImpactDays:null,describedImpactState:'missing',relatedActivityIds:[],relatedClauseIdentifiers:[],evidenceRefs:[],diagnostics:[]};
const rule=(overrides:Partial<NoticeRequirement>={}):NoticeRequirement=>({requirementId:'original',noticeKind:'claim_notice',eventCategories:[],noticePeriodDays:30,state:'official',clauseIdentifiers:[],evidenceRefs:[],triggerBasis:'awareness',effectiveToIso:'2026-07-01',...overrides});

test('like-for-like progress separates membership from changed duration weights without project constants',()=>{
  const before=model('B',[activity('alpha'),activity('beta')]);
  const after=model('C',[activity('alpha',{originalDurationHours:20,percentComplete:20}),activity('beta',{percentComplete:80}),activity('new scope',{status:'not_started',percentComplete:0,currentStartIso:'2026-02-01',actualStartIso:null})]);
  const r=compareProgressScopes(after,before)!;
  assert.equal(r.matchedActivityCount,2);assert.equal(r.addedActivityCount,1);
  assert.equal(r.snapshotPercent,50);assert.equal(r.snapshotCurrentWeightsPercent,40);
  assert.equal(r.durationWeightEffectPercentagePoints,-10);assert.equal(r.fullScopeSnapshotPercent,30);
  assert.equal(r.scopeDilutionPercentagePoints,-10);assert.equal(r.addedDurationWeightPercent,25);
  assert.equal(r.baselinePlannedPercent,50);assert.equal(r.gapPercentagePoints,0);
  assert.equal(after.activities.length,3);assert.equal(before.activities[0]!.originalDurationHours,10);
});

test('missing progress remains excluded and prevents a purported complete scope decomposition',()=>{
  const before=model('B',[activity('alpha'),activity('beta')]);
  const after=model('C',[activity('alpha',{percentComplete:null}),activity('beta')]);
  const r=compareProgressScopes(after,before)!;
  assert.equal(r.comparableActivityCount,1);assert.equal(r.state,'partial');assert.equal(r.scopeDilutionPercentagePoints,null);
});

test('target-date changes, controlled baseline changes and unknown date provenance remain distinct',()=>{
  for(const [basis,expected] of [['xer_target_dates','source_target'],['controlled_baseline','baseline'],[undefined,'date_basis_review']] as const){
    const a=activity('alpha'),b=activity('alpha',{baselineFinishIso:'2026-01-13'});
    delete a.baselineDateBasis;delete b.baselineDateBasis;if(basis){a.baselineDateBasis=basis;b.baselineDateBasis=basis;}
    const old=model('old',[a]),now=model('now',[b]);
    const changes=compareScheduleRevisions({revisionId:'old',sequence:1,effectiveAt:null,label:null,model:old},{revisionId:'now',sequence:2,effectiveAt:null,label:null,model:now});
    const categories=classifyScheduleChanges(changes.activityChanges,old,now);
    assert.equal(categories.find(c=>c.category===expected)!.activityCount,1);
    assert.equal(categories.filter(c=>['baseline','source_target','date_basis_review'].includes(c.category)).reduce((s,c)=>s+c.activityCount,0),1);
  }
});

test('strict near-critical and boundary watchlist use the same controlled date pairs',()=>{
  const current=model('C',[activity('near',{totalFloatHours:24}),activity('boundary',{totalFloatHours:0}),activity('added',{totalFloatHours:24})]);
  const input={generatedAt:'2026-01-06',producerVersion:'test',config:{...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,floatRiskWatchlistIncludesCriticalThreshold:true},controlledBaseline:{revisionId:'B',finishByActivity:new Map([['near','2026-01-09'],['boundary','2026-01-08']])}};
  const p=buildNearCriticalProjection(current,input);
  assert.equal(p.rows.find(r=>r.activityId==='near')!.baselineFinishIso,'2026-01-09');
  assert.equal(p.watchlistRows.find(r=>r.activityId==='near')!.baselineFinishIso,'2026-01-09');
  assert.equal(p.watchlistRows.find(r=>r.activityId==='boundary')!.baselineFinishIso,'2026-01-08');
  assert.equal(p.watchlistRows.find(r=>r.activityId==='added')!.baselineFinishIso,null);
  assert.equal(p.watchlistRows.find(r=>r.activityId==='near')!.sourceTargetFinishIso,'2026-01-11');
  assert.equal(buildNearCriticalProjection(current,{generatedAt:'2026-01-06',producerVersion:'test'}).rows[0]!.baselineFinishIso,null);
});

test('combined readiness dimensions retain actual blocker type and exclude future unblocked records',()=>{
  const current=model('C',[activity('alpha'),activity('beta')]);
  const records=[{recordId:'QUESTION-X',documentType:'rfi_register',state:'blocked' as const,dueIso:'2026-01-05',note:'Response overdue',sourceRefs:['rfi:X']},
    {recordId:'DRAWING-Y',documentType:'design_register',state:'unknown' as const,dueIso:'2026-02-01',note:'Not yet due',sourceRefs:['design:Y']}];
  const evidence={design_submittal:{state:'blocked' as const,sourceRefs:['rfi:X','design:Y'],records}};
  const p=buildLookAheadProjection(current,{generatedAt:'2026-01-06',producerVersion:'test',readinessEvidence:{alpha:evidence,beta:evidence}});
  assert.deepEqual(p.blockerTypes,[{documentType:'rfi_register',activityCount:2,recordCount:1,recordIds:['QUESTION-X']}]);
  assert.equal(p.blockedCount,2);assert.equal(p.rows[0]!.readiness.dimensions.find(d=>d.key==='design_submittal')!.records!.length,2);
});

test('repeated duration edits and additions reconcile as arithmetic without claiming causation',()=>{
  const before=model('B',[activity('alpha'),activity('beta')]);
  const after=model('C',[activity('alpha',{originalDurationHours:34}),activity('beta',{originalDurationHours:34}),activity('gamma',{originalDurationHours:48})]);
  const r=durationEditReview(before,after),p=r.packages[0]!;
  assert.deepEqual(r.distribution,[{deltaHours:24,count:2}]);assert.equal(r.addedCount,1);
  assert.equal(p.existingChangeDays,2);assert.equal(p.addedDays,2);
  assert.ok(Math.abs(p.currentDurationDays! - p.baselineDurationDays! - 4)<1e-10);
});

test('a finish can be late against contract and still have positive submitted float',()=>{
  const m=model('current',[activity('alpha'),activity('finish',{activityType:'finish_milestone',currentFinishIso:'2026-01-11',originalDurationHours:0,remainingDurationHours:0,totalFloatHours:24})]);
  const forecast=buildIndependentForecastProjection(m,{generatedAt:'2026-01-06',producerVersion:'test'});
  const r=scheduleBasisReview(m,forecast,'2026-01-09');
  assert.equal(r.packageCount,1);assert.equal(r.deadline.lateCount,1);assert.equal(r.deadline.positiveFloatButLateCount,1);assert.equal(r.deadline.latenessDays.max,2);
  assert.equal(m.activities[1]!.totalFloatHours,24);
});

test('notice-date cohorts cannot substitute for the awareness date or shortest rule',()=>{
  const rules=[rule(),rule({requirementId:'amended',noticePeriodDays:12,effectiveFromIso:'2026-07-01',effectiveToIso:null})];
  assert.equal(assessEventNotice(event,[],rules).timeliness,'event_date_missing');
  const known={...event,awarenessIso:'2026-06-30'};
  assert.equal(assessEventNotice(known,[],rules).requiredNoticeDays,30);
  assert.equal(assessEventNotice({...known,awarenessIso:'2026-07-01'},[],rules).requiredNoticeDays,12);
  assert.equal(assessEventNotice(known,[],[rule(),rule({noticePeriodDays:10})]).timeliness,'requirement_conflicted');
  assert.equal(assessEventNotice({...event,startIso:'2026-06-30'},[],[rule({triggerBasis:'not_stated'})]).timeliness,'requirement_conflicted');
});

test('date filtering retains reported claim numbers without backdating decisions',()=>{
  const source={projectId:'different',evidenceRevisionId:'register',dataDateIso:'2026-08-31',events:[],noticeRequirements:[],diagnostics:[],claims:[{claimId:'C-A',title:'Access',state:'determined',eventIds:[],submittedAt:null,claimedDays:28,assessedDays:9,assessedDaysState:'candidate',claimedAmount:null,assessedAmount:null,assessedAmountState:'missing',clauseIdentifiers:[],evidenceRefs:[],diagnostics:[]}],notices:[{noticeId:'N-A',claimId:'C-A',eventId:null,kind:'claim_notice',actualIssuedAt:'2026-06-01',actualReceivedAt:null,plannedAt:null,subject:null,clauseIdentifiers:[],evidenceRefs:[],diagnostics:[]}]} as DelayClaimsModel;
  const r=delayClaimsAsOf(source,'2026-08-31');assert.equal(r.current.claims[0]!.state,'unknown');assert.equal(r.current.claims[0]!.assessedDays,null);
  assert.equal(r.current.claims[0]!.sourceRegister!.claimedDays,28);assert.equal(r.reported.assessedDays.value,9);assert.equal(source.claims[0]!.state,'determined');
  assert.equal(delayClaimsAsOf(source,'2026-05-31').reported.recordCount,0);
});

test('generated browser and report scripts parse, including interpolated shared renderers',()=>{
  const html=cmengUatHtml();const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length);for(const s of scripts)assert.doesNotThrow(()=>new vm.Script(s[1]!));
});

 test('equal window values remain pending when their comparison basis is unconfirmed',()=>{
 const r=buildModuleChallenge({moduleKey:'any-window',generatedAt:'2026-01-06',assertions:[],metrics:[{metric:'finish',label:'Window finish movement',value:18,unit:'days',state:'calculated',sourceRefs:['source'],comparisonBasisEstablished:false,
 submittedOverride:{state:'submitted',value:18,unit:'days',authority:'submitted',sourceRefs:['register'],basisRevisionId:null,coveragePercent:100,asOfIso:'2026-01-06',confidence:1,diagnostics:[],note:null},
 consequenceWhenDifferent:'Review',consequenceWhenMissing:'Supply',actionWhenDifferent:'Reconcile',actionWhenMissing:'Read'}]});
 assert.equal(r.items[0]!.reconciliationState,'comparison_pending');assert.equal(r.items[0]!.evidenceState,'partial');assert.equal(r.reconciliationState,'comparison_pending');
 });
