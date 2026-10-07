import test from 'node:test';
import assert from 'node:assert/strict';

import type {CanonicalScheduleActivity,CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {buildScheduleAnalyticsProjection} from '../packages/schedule-analytics/src';
import {buildMilestonesProjection} from '../packages/milestones-analysis/src';
import {buildLookAheadProjection} from '../packages/lookahead-schedule/src';
import {buildProgressScurveProjection} from '../packages/progress-scurve/src';
import {buildIndependentForecastProjection} from '../packages/independent-forecast/src';
import {buildProgressReportProjection} from '../packages/progress-report/src';
import {buildNoticesClaimsProjection} from '../packages/notices-claims/src';
import type {DelayClaimsModel} from '../packages/delay-analysis-core/src';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {canonicalCommercialModule} from '../packages/runtime-api/src/commercial-runtime';

function activity(projectId:string,id:string,i:number,kind:'task'|'finish_milestone'='task'):CanonicalScheduleActivity{
  const pct=(i*17)%101;
  const missingFloat=i%9===0;
  const float=missingFloat?null:(i%11===0?-16:(i%5===0?0:8+(i%4)*8));
  const day=String((i%20)+1).padStart(2,'0');
  return {
    projectId,
    activityId:id,
    nativeId:id,
    name:i%10===0?'نشاط تجريبي '+i:'Synthetic activity '+i,
    wbsId:'W'+(i%7),
    calendarId:null,
    activityType:kind,
    status:pct===100?'completed':pct>0?'in_progress':'not_started',
    baselineStartIso:'2036-01-'+day,
    baselineFinishIso:'2036-02-'+day,
    currentStartIso:'2036-01-'+day,
    currentFinishIso:'2036-03-'+day,
    actualStartIso:pct>0?'2036-01-'+day:null,
    actualFinishIso:pct===100?'2036-03-'+day:null,
    forecastStartIso:null,
    forecastFinishIso:null,
    originalDurationHours:kind==='finish_milestone'?0:80,
    remainingDurationHours:kind==='finish_milestone'?0:Math.max(0,80*(100-pct)/100),
    totalFloatHours:float,
    freeFloatHours:float,
    percentComplete:pct,
    sourceRefs:[],
    diagnostics:[],
  };
}
function model(i:number):CanonicalScheduleModel{
  const projectId='MATRIX-SCH-'+String(i).padStart(3,'0');
  const a=activity(projectId,'A'+i,i);
  const m=activity(projectId,'M'+i,i+1,'finish_milestone');
  return {
    projectId,
    source:'xer',
    sourceRevisionId:'REV-'+i,
    dataDateIso:'2036-04-'+String((i%20)+1).padStart(2,'0'),
    activities:[a,m],
    relationships:[{
      relationshipId:'R'+i,
      predecessorActivityId:a.activityId,
      successorActivityId:m.activityId,
      type:'FS',
      lagHours:0,
      external:false,
      sourceRefs:[],
      diagnostics:[],
    }],
    wbs:[
      {wbsId:'W'+(i%7),parentWbsId:null,name:i%8===0?'منطقة '+i:'Zone '+(i%7),sourceRefs:[]},
      {wbsId:'W'+((i+1)%7),parentWbsId:null,name:'Milestones '+i,sourceRefs:[]},
    ],
    calendars:[],
    diagnostics:[],
  };
}

test('Batch J 100-case matrix: Schedule and progress semantics survive 100 different project shapes',()=>{
  for(let i=0;i<100;i++){
    const source=model(i),generatedAt='2036-12-31T00:00:00.000Z';
    const schedule=buildScheduleAnalyticsProjection(source,{generatedAt,producerVersion:'matrix'});
    const milestones=buildMilestonesProjection(source,{generatedAt,producerVersion:'matrix'});
    const lookAhead=buildLookAheadProjection(source,{generatedAt,producerVersion:'matrix'});
    const scurve=buildProgressScurveProjection(source,{
      generatedAt,producerVersion:'matrix',
      actualHistory:[{asOfIso:source.dataDateIso!,progressPercent:(i*13)%101,sourceRevisionId:source.sourceRevisionId,sourceRefs:['matrix:'+i]}],
    });
    const forecast=buildIndependentForecastProjection(source,{generatedAt,producerVersion:'matrix'});
    const hasPhysical=i%2===0;
    const hasCertified=i%4===0;
    const report=buildProgressReportProjection({
      generatedAt,producerVersion:'matrix',scheduleAnalytics:schedule,milestones,lookAhead,progressScurve:scurve,independentForecast:forecast,
      progressEvidence:{
        ...(hasPhysical?{physical:{valuePercent:(i*7)%101,sourceRefs:['physical:'+i],asOfIso:source.dataDateIso}}:{}),
        ...(hasCertified?{certified:{valuePercent:(i*5)%101,sourceRefs:['certified:'+i],asOfIso:source.dataDateIso}}:{}),
      },
    });
    assert.equal(report.projectId,source.projectId,'project '+i);
    assert.equal(report.sourceRevisionId,source.sourceRevisionId,'revision '+i);
    assert.equal(report.progressBases.physical.valuePercent,hasPhysical?(i*7)%101:null,'physical '+i);
    assert.equal(report.progressBases.physical.authority,hasPhysical?'source_evidence':'missing','physical authority '+i);
    if(!hasPhysical&&!hasCertified)assert.equal(report.headlineProgress.key,'schedule_snapshot','headline '+i);
    if(hasPhysical)assert.equal(report.headlineProgress.key,'physical','headline physical '+i);
    assert.doesNotMatch(JSON.stringify(report),/NaN|Infinity/,'finite '+i);
  }
});

function claimModel(i:number):DelayClaimsModel{
  const projectId='MATRIX-CLM-'+String(i).padStart(3,'0');
  const eventId='EV-'+i,claimId='CL-'+i;
  const missingEventDate=i%5===0,missingNoticeDate=i%7===0,missingRequirement=i%11===0;
  return {
    projectId,
    evidenceRevisionId:'claims-'+i,
    dataDateIso:'2036-09-'+String((i%20)+1).padStart(2,'0'),
    events:[{
      eventId,
      title:i%9===0?'تأخير '+i:'Delay '+i,
      category:i%3===0?'late_access':i%3===1?'late_information':'change',
      startIso:missingEventDate?null:'2036-08-'+String((i%20)+1).padStart(2,'0'),
      endIso:null,
      responsibility:i%4===0?'neutral':i%4===1?'contractor':'employer',
      responsibilityState:'official',
      describedImpactDays:i%17,
      describedImpactState:'candidate',
      relatedActivityIds:i%2===0?['A-'+i]:[],
      relatedClauseIdentifiers:['20.'+(i%10)],
      evidenceRefs:[{sourceType:'correspondence',sourceId:'LETTER-'+i,locator:'page:1'}],
      diagnostics:[],
    }],
    notices:[{
      noticeId:'NT-'+i,
      kind:'eot_notice',
      eventId,
      claimId,
      actualIssuedAt:missingNoticeDate?null:'2036-08-'+String(((i+2)%20)+1).padStart(2,'0'),
      actualReceivedAt:null,
      plannedAt:null,
      subject:'Notice '+i,
      clauseIdentifiers:['20.'+(i%10)],
      evidenceRefs:[{sourceType:'notice',sourceId:'NT-'+i,locator:'page:1'}],
      diagnostics:[],
    }],
    claims:[{
      claimId,
      title:'Claim '+i,
      state:i%3===0?'under_review':'submitted',
      eventIds:[eventId],
      submittedAt:'2036-08-'+String(((i+4)%20)+1).padStart(2,'0'),
      claimedDays:i%31,
      claimedAmount:null,
      assessedDays:null,
      assessedDaysState:'missing',
      assessedAmount:null,
      assessedAmountState:'missing',
      clauseIdentifiers:['20.'+(i%10)],
      evidenceRefs:[{sourceType:'claim',sourceId:claimId,locator:'row:1'}],
      diagnostics:[],
    }],
    noticeRequirements:missingRequirement?[]:[{
      requirementId:'REQ-'+i,
      noticeKind:'eot_notice',
      eventCategories:[i%3===0?'late_access':i%3===1?'late_information':'change'],
      noticePeriodDays:7+(i%8),
      state:'official',
      clauseIdentifiers:['20.'+(i%10)],
      evidenceRefs:[{sourceType:'contract',sourceId:'CONTRACT-'+i,locator:'clause'}],
    }],
    diagnostics:[],
  };
}

test('Batch J 100-case matrix: Claims and Notice states remain truthful across 100 evidence combinations',()=>{
  for(let i=0;i<100;i++){
    const source=claimModel(i);
    const projection=buildNoticesClaimsProjection(source,{generatedAt:'2036-12-31T00:00:00.000Z',producerVersion:'matrix',populationEstablished:true});
    assert.equal(projection.projectId,source.projectId,'project '+i);
    assert.equal(projection.claimCount,1,'claim count '+i);
    assert.equal(projection.eventCount,1,'event count '+i);
    const classified=(projection.timelyNoticeCount??0)+(projection.lateNoticeCount??0)+(projection.missingNoticeCount??0)+(projection.noticeRequirementMissingCount??0)+(projection.noticeEventDateMissingCount??0)+(projection.noticeRequirementConflictCount??0);
    assert.equal(classified,1,'exactly one notice state '+i);
    if(i%11===0)assert.ok((projection.noticeRequirementMissingCount??0)>0,'missing requirement '+i);
    else if(i%5===0)assert.ok((projection.noticeEventDateMissingCount??0)>0,'missing event date '+i);
    else if(i%7===0)assert.ok((projection.missingNoticeCount??0)>0,'missing notice date '+i);
    assert.doesNotMatch(JSON.stringify(projection),/NaN|Infinity/,'finite '+i);
  }
});

test('Batch J 100-case matrix: Commercial values and missing-payment semantics survive 100 independent projects',()=>{
  const currencies=['AED','SAR','USD','EUR','GBP'];
  for(let i=0;i<100;i++){
    const id='MATRIX-COM-'+String(i).padStart(3,'0');
    const currency=currencies[i%currencies.length]!;
    const contract=1_000_000+i*12_345;
    const certified=100_000+i*321;
    const paidKnown=i%6!==0;
    const paid=paidKnown?Math.max(0,certified-(i%17)*1000):null;
    runtimeProjects.getOrCreate(id);
    runtimeProjects.updateControls(id,{
      contractValue:{amount:contract,currency,sourceRefs:['contract:'+i]},
      invoices:[{invoiceId:'IPC-'+i,currency,certifiedAmount:certified,paidAmount:paid,certificateDateIso:'2036-08-15',paymentDateIso:paidKnown?'2036-08-20':null,sourceRefs:['invoice:'+i]} as any],
    });
    const page:any=canonicalCommercialModule(runtimeProjects.get(id)!,'commercial-overview')!;
    assert.notEqual(page.status,'blocked','status '+i);
    const row=page.data.position.currencies.find((x:any)=>x.currency===currency);
    assert.equal(row.originalContractValue.value,contract,'contract '+i);
    assert.equal(row.grossCertifiedAmount.value,certified,'certified '+i);
    assert.equal(row.paidAmount.value,paid,'paid '+i);
    if(!paidKnown)assert.equal(row.certifiedUnpaidAmount.value,null,'no inferred unpaid '+i);
    assert.doesNotMatch(JSON.stringify(page.data),/NaN|Infinity/,'finite '+i);
  }
});

test('Batch J 100-case matrix: project identity never changes calculations for equivalent evidence',()=>{
  const base=model(42);
  const values:any[]=[];
  for(let i=0;i<100;i++){
    const copy:CanonicalScheduleModel=JSON.parse(JSON.stringify(base));
    copy.projectId='IDENTITY-'+String(i).padStart(3,'0');
    copy.activities=copy.activities.map(row=>({...row,projectId:copy.projectId}));
    const result=buildScheduleAnalyticsProjection(copy,{generatedAt:'2036-12-31T00:00:00.000Z',producerVersion:'matrix'}).result;
    values.push({
      activityCount:result.activityCount,
      criticalCount:result.float.criticalCount,
      negativeFloatCount:result.float.negativeFloatCount,
      floatCoveragePercent:result.float.coveragePercent,
      submittedCompletionIso:result.completionBases.find(x=>x.basis==='programme')?.dateIso??null,
    });
  }
  for(let i=1;i<values.length;i++)assert.deepEqual(values[i],values[0],'project ID changed calculation at variant '+i);
});
