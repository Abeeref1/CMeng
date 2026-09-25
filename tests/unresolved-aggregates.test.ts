import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile, ScriptTarget, isFunctionDeclaration} from 'typescript';
import {aggregateCount, completeSum} from '../packages/truth-kernel/src/aggregates';
import {buildActivityAnalyticsProjection} from '../packages/activity-analytics/src';
import {buildNearCriticalProjection} from '../packages/near-critical-analysis/src';
import {buildMilestonesProjection} from '../packages/milestones-analysis/src';
import {buildWindowsAnalysisProjection} from '../packages/windows-analysis/src';
import {analyzeSchedule, DEFAULT_SCHEDULE_ANALYSIS_CONFIG} from '../packages/schedule-analysis-core/src';
import {buildBoqFeasibility} from '../packages/delivery-challenge/src/boq-feasibility';
import {resolveBoqSource, suppliedBoqFigures} from '../packages/runtime-api/src/boq-source';
import {ingestBoq} from '../packages/boq-ingestion/src';
import {buildCommercialControlPosition} from '../packages/commercial-control/src';
import {enforceModuleReadiness} from '../packages/runtime-api/src/module-readiness';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {numericDistribution} from '../packages/schedule-analysis-core/src/population';
import {buildScheduleChangeReportProjection} from '../packages/schedule-change-report/src';

test('maximum and modal populations require at least one measured value; measured zero is retained', () => {
  for (const values of [[], [null, null], [NaN, Infinity]]) {
    const result=numericDistribution(values);
    assert.equal(result.maximum,null);
    assert.equal(result.maximumCount,null);
    assert.equal(result.dominantCount,null);
  }
  const zero=numericDistribution([0,0]);
  assert.equal(zero.maximum,0);assert.equal(zero.maximumCount,2);assert.equal(zero.maximumPercent,100);
  assert.equal(numericDistribution([5,null]).maximumCount,1,'a disclosed known-value subset remains available');
  const model=schedule();model.activities.forEach((r:any)=>{r.currentFinishIso=null;r.baselineFinishIso=null;});
  const revisions=[0,1].map(i=>({revisionId:'S'+i,label:'S'+i,sequence:i,effectiveAt:'2031-01-0'+(i+1),model:{...model,sourceRevisionId:'S'+i}}));
  assert.equal(buildScheduleChangeReportProjection(revisions[0]!,revisions[1]!,options).finishMovementAnalysis?.maximumCount,null);
});

test('empty movement renderers explain unresolved populations without a zero count or unresolved percent', () => {
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
  for(const name of ['renderMovementConcentration','renderRevisionMovementConcentration']) {
    const fn=source.statements.filter(isFunctionDeclaration).find(n=>n.name?.text===name)!.getText(source);
    const html=runInNewContext(fn+';'+name+'(data,[])',{data:{distribution:numericDistribution([]),maximumDays:null,maximumRows:[]}});
    assert.match(html,/Activities sharing maximum: Unresolved/);
    assert.doesNotMatch(html,/Unresolved%|0 activities|0 at the maximum/);
  }
});

test('unreadable BOQ ingestion never establishes an empty quantity population', async () => {
  const boq=await ingestBoq({projectId:'P',bytes:Buffer.from('Month,Item,Installed Quantity\n2031-01,A,5'),verifiedMediaType:'text/csv',receivedAt:'2031-01-01',sourceFilename:'measurements.csv'});
  assert.equal(boq.canonicalItems.length,0);
  assert.equal(boq.complete,false);
  assert.ok(boq.diagnostics.includes('BOQ_CSV_DESCRIPTION_COLUMN_MISSING'));
  const stale={projectId:'P',boqRevisionId:boq.evidenceReceipt.revisionId,scheduleRevisionId:'S',items:[],allocations:[],installedSnapshots:[],diagnostics:[]};
  const state:any={boq,boqRevisions:[boq],quantities:stale,evidenceDocuments:[{documentId:'D',documentType:'boq',basisState:'active',linkedArtifactId:boq.ingestionId,sourceFilename:'measurements.csv',mediaType:'text/csv',assertions:[]}]};
  const result=resolveBoqSource(state,'S');
  assert.equal(result.selection.state,'unreadable');
  assert.equal(result.selection.sourceDocumentId,'D','retain source identity without promoting its failed parse');
  assert.equal(result.quantities,null);
  assert.equal(suppliedBoqFigures(result.boq,result.quantities).itemCount,null);
  assert.equal(state.quantities,stale,'reporting does not alter evidence');
});

test('aggregate contract preserves zero and known matches without fabricating a complete total', () => {
  for (const [rows, value, known, unresolved] of [
    [[false, false], 0, 0, 0], [[true, false], 1, 1, 0],
    [[false, null], null, 0, 1], [[true, null], null, 1, 1],
    [[null, undefined], null, 0, 2], [[], 0, 0, 0],
  ] as const) {
    assert.deepEqual(aggregateCount(rows, v => v), {value, knownCount: known, unresolvedCount: unresolved, populationCount: rows.length});
  }
  assert.equal(aggregateCount(null, () => false).value, null);
  assert.equal(completeSum([]), null);
  assert.equal(completeSum([0, 0]), 0);
  assert.equal(completeSum([5, null]), null);
  assert.equal(completeSum([0, NaN]), null);
});

function schedule() {
  const row = {projectId:'P',activityId:'A',nativeId:'A',name:'Known outside near band',wbsId:null,calendarId:'C',activityType:'task',status:'not_started',
    baselineStartIso:'2031-01-01',baselineFinishIso:'2031-01-10',currentStartIso:'2031-01-01',currentFinishIso:'2031-01-10',actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
    percentComplete:0,originalDurationHours:8,remainingDurationHours:8,totalFloatHours:160,freeFloatHours:null,sourceRefs:[],diagnostics:[]};
  return {projectId:'P',source:'xer',sourceRevisionId:'S',dataDateIso:'2031-01-01',wbs:[],relationships:[],diagnostics:[],
    calendars:[{calendarId:'C',name:'Working calendar',standardDayHours:8,semanticComplete:true,sourceRefs:[]}],activities:[row,{...row,activityId:'B',nativeId:'B'}]} as any;
}
const options = {generatedAt:'2031-01-01',producerVersion:'test',config:{...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:5}};

test('Activity Review and shared near-critical totals distinguish missing float, missing calendars and complete zero', () => {
  for (const kind of ['complete','calendar_missing','float_missing','partial_positive']) {
    const model=schedule();
    if(kind==='calendar_missing')model.activities[1].calendarId='UNREADABLE';
    if(kind==='float_missing'||kind==='partial_positive')model.activities[1].totalFloatHours=null;
    if(kind==='partial_positive')model.activities[0].totalFloatHours=16;
    const expected=kind==='complete'?0:null;
    const activity=buildActivityAnalyticsProjection(model,options);
    const near=buildNearCriticalProjection(model,options);
    assert.equal(activity.counts.nearCritical.value,expected,kind);
    assert.equal(activity.counts.floatRisk.value,expected,kind);
    assert.equal(near.nearCriticalCount,expected,kind);
    assert.equal(near.floatRiskWatchlistCount,expected,kind);
    assert.equal(analyzeSchedule(model,options.config).float.nearCriticalCount,expected,kind);
    assert.equal(activity.counts.nearCritical.knownCount,kind==='partial_positive'?1:0);
    assert.equal(near.unresolvedActivityCount,kind==='complete'?0:1);
  }
});

test('actual Activity Review renderer withholds incomplete headline counts, including missing comparison dates', () => {
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
  const fn=source.statements.filter(isFunctionDeclaration).find(n=>n.name?.text==='renderActivityAnalyticsVisual')!.getText(source);
  const model=schedule();model.activities[1].calendarId='UNREADABLE';model.activities[1].baselineFinishIso=null;
  const data=buildActivityAnalyticsProjection(model,options);
  const kpis:any[]=[];
  runInNewContext(fn+';renderActivityAnalyticsVisual(data)',{data,aggregateCount,projectionFor:(d:any)=>d,
    planningKpis:(rows:any[])=>{kpis.push(...rows);return '';},escapeHtml:String,fmt:(v:any)=>v==null?'Unresolved':String(v),humanizeKey:String,
    planningActivityPressure:()=>'',renderVisualPanel:()=>'',renderDonutChart:()=>'',planningStatusBand:()=>'',planningStateLabel:String,
    distributionSummary:()=>'',planningShortDate:String,planningSignedBars:()=>'',renderMovementConcentration:()=>'',planningProgressTrack:()=>'',renderScheduleBasisReview:()=>'',
  });
  for(const label of ['Near-critical','Float-risk watchlist','Later than baseline'])assert.equal(kpis.find(row=>row[0]===label)?.[1],null,label);
});

test('absent BOQ population cannot establish zero unresolved manpower calculations or source rows', () => {
  assert.equal(buildBoqFeasibility({schedule:schedule(),quantities:null,resources:null}).unresolvedCount,null);
  assert.equal(suppliedBoqFigures(null,null).itemCount,null);
});

test('milestone count predicates do not discard unknown float, dates or status', () => {
  const model=schedule();model.activities.forEach((row:any)=>row.activityType='finish_milestone');
  let result=buildMilestonesProjection(model,options);
  assert.equal(result.nearCriticalMilestoneCount,0);
  assert.equal(result.negativeFloatMilestoneCount,0);
  model.activities[1].totalFloatHours=null;model.activities[1].currentFinishIso=null;model.activities[1].currentStartIso=null;
  result=buildMilestonesProjection(model,options);
  assert.equal(result.nearCriticalMilestoneCount,null);
  assert.equal(result.negativeFloatMilestoneCount,null);
  assert.equal(result.due30Count,null);
  assert.equal(result.lateOpenCount,null);
});

test('window aggregates withhold empty and partly unreadable calculations but retain measured zero', () => {
  const revisions=[0,1,2].map(i=>({revisionId:'S'+i,label:'S'+i,sequence:i,effectiveAt:'2031-01-0'+(i+1),model:{...schedule(),sourceRevisionId:'S'+i}}));
  const claims:any={events:[],claims:[],notices:[],noticeRequirements:[],diagnostics:[]};
  for(const missing of [false,true]) {
    const result=buildWindowsAnalysisProjection(revisions,claims,{...options,forecastResolver:r=>({
      sourceForecastCompletionIso:'2031-01-10',independentForecastCompletionIso:missing&&r.sequence===2?null:'2031-01-10',criticalActivityIds:[],assumptions:[],complete:!missing,
    } as any)});
    assert.equal(result.positiveIndependentMovementDays,missing?null:0);
    assert.equal(result.negativeIndependentMovementDays,missing?null:0);
    assert.equal(result.grossAnalyticalMovementDays,missing?null:0);
    assert.equal(result.positiveProgrammeMovementDays,0,'known submitted dates remain usable');
    assert.equal(result.overlapCandidateDays,missing?null:0);
  }
  const empty=buildWindowsAnalysisProjection([],claims,options);
  assert.equal(empty.positiveIndependentMovementDays,null);
  assert.equal(empty.positiveProgrammeMovementDays,null);
});

test('a superseded or reclassified pointer cannot override the active BOQ, while an aligned pointer stays valid',async () => {
  const make=(quantity:number,name:string)=>ingestBoq({projectId:'P',bytes:Buffer.from('Item,Description,Unit,Quantity,Rate,Amount\n1,Concrete,m3,'+quantity+',2,'+quantity*2),verifiedMediaType:'text/csv',receivedAt:'2031-01-01',sourceFilename:name});
  const old=await make(99,'old.csv'),active=await make(10,'active.csv');
  for(const condition of ['aligned','superseded','reclassified','candidate']) {
    const state:any={boq:condition==='aligned'?active:old,boqRevisions:[old,active],quantities:null,evidenceDocuments:[
      {documentId:'OLD',documentType:condition==='reclassified'?'productivity_forecast_basis':'boq',basisState:condition==='superseded'?'superseded':condition==='candidate'?'candidate':'active',linkedArtifactId:old.ingestionId,sourceFilename:'old.csv',mediaType:'text/csv',assertions:[]},
      {documentId:'ACTIVE',documentType:'boq',basisState:'active',linkedArtifactId:active.ingestionId,sourceFilename:'active.csv',mediaType:'text/csv',assertions:[]},
    ]};
    const result=resolveBoqSource(state,'S');
    assert.equal(result.boq?.sourceHashSha256,active.sourceHashSha256,condition);
    assert.equal(result.selection.sourceDocumentId,'ACTIVE',condition);
    assert.equal(result.boq?.canonicalItems[0]?.quantity,10,condition);
  }
});

test('commercial adjusted completion requires the supported day basis', () => {
  for(const basis of ['unknown','working_days','calendar_days']) {
    const result=buildCommercialControlPosition({generatedAt:'2031-01-01',projectId:'P',contractValue:null,variations:[],invoices:[],retentions:[],bonds:[],claimCommercials:[],delayClaims:null,
      commercialEvidenceSubmitted:true,claimEvidenceSubmitted:true,contractTimeBasis:{contractualCompletionIso:'2031-01-01',contractualCompletionState:'official',officialApprovedEotDays:3,officialApprovedEotState:'official',eotDayBasis:basis,eotDayBasisState:'official',sourceRefs:[]}} as any);
    assert.equal(result.timeExposure.officialAdjustedCompletion.value,basis==='calendar_days'?'2031-01-04':null,basis);
    assert.equal(result.timeExposure.officialAdjustedCompletion.state==='established',basis==='calendar_days',basis);
  }
});

test('comparison applicability and register-date dependencies agree with module readiness', () => {
  const review:any={likelyMappingFault:true,rows:['rfi_register','risk_register','quality_ncr_register'].map(documentType=>({documentType,total:1,valid:0,state:'column_not_found'})),message:'Date reader review'};
  const base:any={key:'payments',status:'ready',engineState:'ready',evidenceState:'established',professionalState:'defensible',reason:null,dependencies:[],data:{registerDateReview:review,challenge:{items:[{metric:'module_position'}],reconciliationState:'not_checked'},systemEvidenceContract:{state:'verified_for_checked_metrics',checks:[{metric:'payment_control',passed:true}]}}};
  const result=enforceModuleReadiness(base,{state:'pass',failedCheckIds:[],checkCount:0,checks:[]});
  assert.equal(result.status,'ready');
  assert.equal((result.data as any).moduleReadiness.comparisonRequired,false);
  assert.ok(!result.issueAssessment?.issues.some(i=>['INDEPENDENT_COMPARISON_NOT_ESTABLISHED','REGISTER_DATE_READING_REVIEW'].includes(i.code)));
  const dependent=enforceModuleReadiness({...base,key:'lookahead-schedule'},{state:'pass',failedCheckIds:[],checkCount:0,checks:[]});
  assert.ok(dependent.issueAssessment?.issues.some(i=>i.code==='REGISTER_DATE_READING_REVIEW'));
});
