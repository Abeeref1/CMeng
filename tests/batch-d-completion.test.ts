import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceBusinessClass,resourceCapacityEligible,resourceLaborHourEligible} from '../packages/schedule-resource-core/src';
import {buildProgressScurveProjection} from '../packages/progress-scurve/src';
import {buildProgressReportProjection} from '../packages/progress-report/src';
import {buildManhourScurveProjection} from '../packages/manhour-scurve/src';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import type {CanonicalResourceModel} from '../packages/schedule-resource-core/src';

const calendar:any={calendarId:'C1',name:'5d',semanticComplete:true,weeklyWorkIntervals:[{dayIndex:1,intervals:[{start:'08:00',finish:'16:00',minutes:480}]}],sourceRefs:[]};
function schedule():CanonicalScheduleModel{return {projectId:'D',source:'schedule_xlsx',sourceRevisionId:'R1',dataDateIso:'2030-01-05',calendars:[calendar],wbs:[],relationships:[],diagnostics:[],activities:[{projectId:'D',activityId:'A1',nativeId:'1',name:'Work',wbsId:null,calendarId:'C1',activityType:'task',status:'in_progress',baselineStartIso:'2030-01-01',baselineFinishIso:'2030-01-10',currentStartIso:'2030-01-01',currentFinishIso:'2030-01-12',actualStartIso:'2030-01-01',actualFinishIso:null,forecastStartIso:'2030-01-01',forecastFinishIso:'2030-01-12',originalDurationHours:80,remainingDurationHours:40,totalFloatHours:8,freeFloatHours:null,percentComplete:25,sourceRefs:[],diagnostics:[]}]};}

test('Task 21 classification keeps Cost Engineer as labor and excludes quantity pseudo-resources',()=>{
 const labor:any={resourceType:'labor',name:'Cost Engineer',shortName:'CE',unitName:'Hour',unitAbbreviation:'hr',priceTimeUnit:'QT_Hour'};
 assert.equal(resourceBusinessClass(labor),'labor');
 assert.equal(resourceCapacityEligible(resourceBusinessClass(labor)),true);
 assert.equal(resourceLaborHourEligible(labor),true);
 const qty:any={resourceType:'unknown',name:'Quantity',shortName:null,unitName:'Quantity',unitAbbreviation:'qty',priceTimeUnit:null};
 assert.equal(resourceBusinessClass(qty),'quantity');
 assert.equal(resourceCapacityEligible(resourceBusinessClass(qty)),false);
});

test('Tasks 23-25 keep current planned phasing separate from achieved progress',()=>{
 const model=schedule();
 const scurve=buildProgressScurveProjection(model,{generatedAt:'2030-01-05',producerVersion:'D'});
 assert.equal(scurve.currentSeriesMeaning,'current_schedule_date_phasing_not_achieved_progress');
 const point=scurve.points.find(p=>p.dateIso==='2030-01-05')!;
 assert.equal(point.currentSchedulePhasingPercent,point.currentForecastPercent);
 const dummy:any={producerVersion:'x',projectId:'D',sourceRevisionId:'R1',result:{projectId:'D',sourceRevisionId:'R1',dataDateIso:'2030-01-05',population:{sourceActivityCount:1,executableActivityCount:1,excludedActivityCount:0,excludedByType:{wbsSummaryCount:0,levelOfEffortCount:0,otherExcludedCount:0},basis:'execution_control_population'},activityCount:1,relationshipCount:0,graph:{complete:true,openStartActivityIds:[],openFinishActivityIds:[]},float:{criticalCount:0,nearCriticalCount:0,negativeFloatCount:0,coveragePercent:100},status:{completed:0,inProgress:1,notStarted:0,unknown:0},progress:{durationWeightedPercentComplete:{value:25,coveragePercent:100}},diagnostics:[]}};
 const milestones:any={producerVersion:'m',projectId:'D',sourceRevisionId:'R1',milestoneCount:0,completedCount:0,openCount:0,lateOpenCount:0};
 const look:any={producerVersion:'l',projectId:'D',sourceRevisionId:'R1',windowDays:42,incompleteActivityCount:1,datedIncompleteActivityCount:1,currentDateCoveragePercent:100,overdueCount:0};
 const forecast:any={producerVersion:'f',projectId:'D',sourceRevisionId:'R1',sourceForecastCompletionIso:null,independentForecastCompletionIso:null,forecastVarianceDays:null,origin:'unresolved',complete:false,activityCoveragePercent:null,diagnostics:[]};
 const p=buildProgressReportProjection({generatedAt:'2030-01-05',producerVersion:'D',scheduleAnalytics:dummy,milestones,lookAhead:look,progressScurve:scurve,independentForecast:forecast,progressEvidence:{physical:{valuePercent:20,sourceRefs:['physical'],asOfIso:'2030-01-05'},earnedValue:{valuePercent:18,sourceRefs:['ev'],asOfIso:'2030-01-05'}}});
 assert.equal(p.progressBases.currentPlanned.valuePercent,p.progressBases.currentSchedule.valuePercent);
 assert.equal(p.headlineProgress.key,'physical');
 assert.equal(p.headlineProgress.valuePercent,20);
 assert.equal(p.progressBases.earnedValue.valuePercent,18);
});

test('Task 28 excludes labor assignments whose resource unit is not explicitly hours',()=>{
 const model:CanonicalResourceModel={projectId:'D',sourceRevisionId:'R1',units:[],financialPeriods:[],periodActuals:[],diagnostics:[],resources:[
  {resourceId:'H',nativeId:'H',shortName:'H',name:'Labor hours',parentResourceId:null,resourceType:'labor',unitId:null,unitName:'Hour',unitAbbreviation:'hr',calendarId:null,priceTimeUnit:'QT_Hour',rates:[],sourceRefs:[]},
  {resourceId:'D',nativeId:'D',shortName:'D',name:'Labor days',parentResourceId:null,resourceType:'labor',unitId:null,unitName:'Day',unitAbbreviation:'day',calendarId:null,priceTimeUnit:'QT_Day',rates:[],sourceRefs:[]}
 ],assignments:[
  {assignmentId:'AH',projectId:'D',activityId:'A1',nativeTaskId:'1',resourceId:'H',roleId:null,resourceType:'labor',plannedUnits:8,actualRegularUnits:2,actualOvertimeUnits:0,remainingUnits:6,atCompletionUnits:8,plannedUnitsPerHour:1,remainingUnitsPerHour:1,plannedStartIso:'2030-01-01',plannedFinishIso:'2030-01-08',actualStartIso:null,actualFinishIso:null,remainingStartIso:'2030-01-05',remainingFinishIso:'2030-01-12',curveId:null,sourceRefs:[],diagnostics:[]},
  {assignmentId:'AD',projectId:'D',activityId:'A1',nativeTaskId:'1',resourceId:'D',roleId:null,resourceType:'labor',plannedUnits:5,actualRegularUnits:1,actualOvertimeUnits:0,remainingUnits:4,atCompletionUnits:5,plannedUnitsPerHour:null,remainingUnitsPerHour:null,plannedStartIso:'2030-01-01',plannedFinishIso:'2030-01-08',actualStartIso:null,actualFinishIso:null,remainingStartIso:'2030-01-05',remainingFinishIso:'2030-01-12',curveId:null,sourceRefs:[],diagnostics:[]}
 ]};
 const p=buildManhourScurveProjection(model,schedule(),{generatedAt:'2030-01-05',producerVersion:'D'});
 assert.equal(p.laborResourceDefinitionCount,2);
 assert.equal(p.laborHourResourceCount,1);
 assert.deepEqual(p.excludedNonHourLaborResourceIds,['D']);
 assert.equal(p.plannedHoursKnown,8);
});
