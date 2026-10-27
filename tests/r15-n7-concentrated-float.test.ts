// R15 guard N7 (near-critical): "25 activities share exactly 0 h total float".
// Float is said in working days with the day type, never in hours. The shared
// value is each activity's own calendar figure; when the same source hours mean
// different working days on different calendars, the note says so instead of
// inventing one working-day figure.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as vm from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {countText,countUnit} from '../packages/runtime-api/src/count-text';

function renderNearCritical(watchlistRows:unknown[]):string{
 const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
 const start=script.indexOf('function renderNearCriticalVisual(data){'),end=script.indexOf('function renderManhourVisual(data){',start);
 assert.ok(start>=0&&end>start);
 const parsed=createSourceFile('cmeng-screen.js',script,ScriptTarget.Latest,true);
 const helpers='let responsePopulationRoot=null,responsePopulationIndex=new WeakMap(),responseRowPopulationIndex=new WeakMap();\n'+parsed.statements.filter(isFunctionDeclaration)
  .filter(n=>['indexResponsePopulations','listTotal','knownScreenCount','screenCountText','floatThresholdText','floatBucketDaysNote','floatDistributionSummary','sourceWorkingFloat','sourceWorkingFloatField'].includes(n.name?.text??''))
  .map(n=>n.getText(parsed)).join('\n');
 const p={rows:watchlistRows,watchlistRows,criticalRows:[],negativeFloatRows:[],managementGroups:[],nearCriticalCount:watchlistRows.length,floatRiskWatchlistCount:watchlistRows.length,zeroFloatCount:0,negativeFloatCount:0,
  floatCoveragePercent:100,classificationCoveragePercent:100,unresolvedActivityCount:0,criticalThresholdHours:0,nearCriticalThresholdHours:40,floatRiskWatchlistIncludesCriticalThreshold:true,
  nearCriticalThresholdAuthority:'cmeng_screening_policy'};
 const text=(value:unknown)=>String(value??'');
 return vm.runInNewContext(helpers+'\n'+script.slice(start,end)+';renderNearCriticalVisual(p);',{countText,countUnit,
  shortRevision:(value:unknown)=>value?'Previous programme':'No comparison programme',p,projectionFor:(value:unknown)=>value,escapeHtml:text,fmt:text,planningShortDate:text,
  planningStateLabel:text,planningDaysBetween:()=>null,planningKpis:()=>'',planningFloatHistogram:()=>'',planningFinishPeriodBars:()=>'',distributionSummary:()=>'',
 }) as string;
}
const row=(i:number,hours:number,workingDays:number)=>({activityId:'A'+i,activityName:'Activity '+i,status:'not_started',totalFloatHours:hours,totalFloatWorkingDays:workingDays,
 submittedTotalFloatHours:hours,submittedTotalFloatWorkingDays:workingDays,floatDaysBasis:'activity_calendar',nearCriticalThresholdHours:40});

test('R15 N7: a concentrated submitted float value is said in working days, not hours',()=>{
 const html=renderNearCritical(Array.from({length:30},(_,i)=>row(i,0,0)));
 assert.match(html,/Concentrated submitted float values\.<\/b> 30 activities share exactly 0 working days · 0 original h total float\./);
 assert.doesNotMatch(html,/share exactly -?\d[\d,.]* ?h total float/,'never hours');
});

test('R15 N7: the same source hours on calendars with different day lengths are not given one working-day figure',()=>{
 const html=renderNearCritical([...Array.from({length:15},(_,i)=>row(i,8,1)),...Array.from({length:15},(_,i)=>row(100+i,8,0.8))]);
 assert.match(html,/30 activities share exactly the same submitted total float on activity calendars with different working-day lengths\./);
 assert.doesNotMatch(html,/share exactly -?\d[\d,.]* ?h total float/);
});
