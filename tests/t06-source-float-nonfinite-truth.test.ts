import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFloatCriticality,sourceFloatInFloatRiskWatchlist,
  DEFAULT_SCHEDULE_ANALYSIS_CONFIG} from '../packages/schedule-analysis-core/src';
test('T06 all missing and nonfinite submitted floats remain unknown and never become false green counts',()=>{
 const config={...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:3,
   criticalFloatThresholdHours:0,floatRiskWatchlistIncludesCriticalThreshold:false};
 for(const hours of [8,12]){
  const model:any={calendars:[
   {calendarId:'C',semanticComplete:true,standardDayHours:hours},
   {calendarId:'C',semanticComplete:true,standardDayHours:20}]};
  for(const value of [null,undefined,NaN,Infinity,-Infinity]){
   const activity:any={calendarId:'C',totalFloatHours:value};
   assert.equal(sourceFloatCriticality(model,activity,config),'unknown');
   assert.equal(sourceFloatInFloatRiskWatchlist(model,activity,config),null);
   assert.ok(Object.is(activity.totalFloatHours,value),'original value retained');
  }
  const row:any={calendarId:'C',totalFloatHours:0};
  assert.equal(sourceFloatCriticality(model,row,config),'critical');
  row.totalFloatHours=hours*3;
  assert.equal(sourceFloatCriticality(model,row,config),'near_critical');
  assert.equal(sourceFloatInFloatRiskWatchlist(model,row,config),true);
  row.totalFloatHours=hours*3+1;
  assert.equal(sourceFloatCriticality(model,row,config),'noncritical');
  assert.equal(sourceFloatInFloatRiskWatchlist(model,row,config),false);
 }
});
