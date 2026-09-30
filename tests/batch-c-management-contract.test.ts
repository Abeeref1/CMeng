import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMilestonesProjection} from '../packages/milestones-analysis/src';
import {buildNearCriticalProjection} from '../packages/near-critical-analysis/src';
import type {CanonicalScheduleActivity,CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

function activity(id:string,patch:Partial<CanonicalScheduleActivity>={}):CanonicalScheduleActivity{
  return {
    projectId:'C-MGMT',activityId:id,nativeId:id,name:id,wbsId:'W1',calendarId:null,
    activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:'2030-01-31',
    currentStartIso:'2030-01-01',currentFinishIso:'2030-02-01',actualStartIso:null,actualFinishIso:null,
    forecastStartIso:null,forecastFinishIso:null,originalDurationHours:80,remainingDurationHours:80,
    totalFloatHours:8,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[],...patch,
  };
}
function model(activities:CanonicalScheduleActivity[],relationships:any[]=[]):CanonicalScheduleModel{
  return {
    projectId:'C-MGMT',source:'schedule_xlsx',sourceRevisionId:'R2',dataDateIso:'2030-01-15',
    activities,relationships,wbs:[{wbsId:'W1',parentWbsId:null,name:'Testing and Handover',sourceRefs:[]}],
    calendars:[],diagnostics:[],
  };
}

test('Batch C Task 18 keeps current and forecast milestone dates separate and exposes authority/owner/driver/category',()=>{
  const driver=activity('DRV',{totalFloatHours:0,currentFinishIso:'2030-01-25'});
  const milestone=activity('MS1',{
    activityType:'finish_milestone',name:'Final handover',baselineFinishIso:'2030-01-31',
    currentFinishIso:'2030-02-01',forecastFinishIso:'2030-02-10',totalFloatHours:0,
  });
  const projection=buildMilestonesProjection(model([driver,milestone],[{
    relationshipId:'R1',predecessorActivityId:'DRV',successorActivityId:'MS1',type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[],
  }]),{generatedAt:'2030-01-15T00:00:00Z',producerVersion:'acceptance'});
  const row=projection.rows.find(r=>r.activityId==='MS1')!;
  assert.equal(row.currentDateIso,'2030-02-01');
  assert.equal(row.forecastDateIso,'2030-02-10');
  assert.equal(row.authority,'submitted_programme');
  assert.equal(row.owner,null);
  assert.deepEqual(row.driverActivityIds,['DRV']);
  assert.equal(row.category,'terminal_completion');
  assert.equal(row.movementBasis,'forecast_vs_baseline');
  assert.equal(row.varianceDays,10);
});

test('Batch C Task 19 calculates float erosion from the previous comparable revision rather than baseline lateness',()=>{
  const current=model([activity('A',{totalFloatHours:8,currentFinishIso:'2030-02-20'})]);
  const projection=buildNearCriticalProjection(current,{
    generatedAt:'2030-01-15T00:00:00Z',producerVersion:'acceptance',
    previousFloat:{revisionId:'R1',totalFloatByActivity:new Map([['A',24]])},
  });
  const row=projection.rows.find(r=>r.activityId==='A')!;
  assert.equal(projection.floatComparisonRevisionId,'R1');
  assert.equal(row.previousTotalFloatHours,24);
  assert.equal(row.totalFloatHours,8);
  assert.equal(row.floatErosionHours,16);
  const group=projection.managementGroups?.[0]!;
  assert.equal(group.floatErosionKnownCount,1);
  assert.equal(group.maxFloatErosionHours,16);
  assert.equal(group.averageFloatErosionHours,16);
});
