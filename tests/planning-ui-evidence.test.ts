import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createSourceFile, ScriptTarget, isFunctionDeclaration } from 'typescript';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';

function functions(names: string[]) {
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
  const selected=source.statements.filter(isFunctionDeclaration).filter(node=>node.name && names.includes(node.name.text));
  assert.equal(selected.length,names.length);
  return selected.map(node=>node.getText(source)).join('\n');
}

test('S-Curve headline selects the exact Data Date observation in different browser timezones',()=>{
  const script=functions(['planningDateMs','renderProgressScurveVisual']);
  const data={projectionKey:'progress_scurve',dataDateIso:'2030-01-07T08:00:00',actualHistoryMode:'snapshot_history',points:[
    {dateIso:'2030-01-01T08:00:00Z',baselinePlannedPercent:12,currentForecastPercent:11,actualProgressPercent:10},
    {dateIso:'2030-01-07T08:00:00Z',baselinePlannedPercent:57.61,currentForecastPercent:56.21,actualProgressPercent:55.03},
    {dateIso:'2030-01-08T08:00:00Z',baselinePlannedPercent:80,currentForecastPercent:70,actualProgressPercent:null},
  ]};
  const previous=process.env.TZ;
  try {
    for(const zone of ['Asia/Dubai','America/Los_Angeles']) {
      process.env.TZ=zone;
      let kpis: any[]=[];
      runInNewContext(script+';renderProgressScurveVisual(data);',{
        data,projectionFor:(value: unknown)=>value,planningKpis:(rows:any[])=>{kpis=rows;return '';},
        fmt:String,percent2:String,escapeHtml:String,humanizeKey:String,renderLineChart:()=>'',renderProgressScope:()=>'',renderVisualPanel:()=>'',
      });
      assert.equal(kpis[0][1],'57.61%',zone); assert.equal(kpis[1][1],'56.21%',zone); assert.equal(kpis[2][1],'55.03%',zone);
    }
  } finally { if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous; }
});

test('displayed progress variance reconciles rounded values without changing the source precision',()=>{
  const delta=runInNewContext(functions(['displayPercentDifference'])+';displayPercentDifference');
  assert.equal(delta(9.228,9.204),0.03); assert.equal(delta(null,9.204),null);
});



test('Progress Breakdown exposes six structural filters without unresolved spam or confirmation prompts',()=>{
 const script=functions(['renderProgressBreakdownVisual']);
 const data={
   rows:[{wbsId:'W1',wbsName:'Civil',activityCount:2}],
   totalActivityCount:2,
   overallScheduleProgressPercent:45.92,
   overallProgressCoveragePercent:99.5,
   baselinePlanAvailable:false,
   hierarchyRows:[{wbsId:'W1',wbsName:'Civil',parentWbsId:null,depth:0,activityCount:2,directActivityCount:2,currentPlanPercent:40,currentPlanCoveragePercent:100,durationWeightedProgressPercent:45.92,durationWeightedCoveragePercent:99.5,criticalCount:1,negativeFloatCount:1}],
   dimensionViews:[
     {dimension:'wbs',label:'By WBS',sourcePopulation:2,classifiedPopulation:2,unclassifiedPopulation:0,classificationCoveragePercent:100,available:true,basis:'Direct WBS',rows:[{dimension:'wbs',groupKey:'W1',groupLabel:'Civil',classified:true,activityCount:2,completedCount:1,inProgressCount:1,notStartedCount:0,unknownStatusCount:0,scheduleProgressPercent:45.92,progressCoveragePercent:100,knownWeightHours:80,weightSharePercent:100,progressContributionPercentagePoints:45.92,criticalCount:1,nearCriticalCount:0,negativeFloatCount:1}]},
     {dimension:'wbs_level',label:'By WBS Level',sourcePopulation:2,classifiedPopulation:2,unclassifiedPopulation:0,classificationCoveragePercent:100,available:true,basis:'Hierarchy level',rows:[]},
     {dimension:'zone',label:'By Zone',sourcePopulation:2,classifiedPopulation:0,unclassifiedPopulation:2,classificationCoveragePercent:0,available:false,basis:'Explicit zone only',rows:[]},
     {dimension:'level',label:'By Level',sourcePopulation:2,classifiedPopulation:0,unclassifiedPopulation:2,classificationCoveragePercent:0,available:false,basis:'Explicit level only',rows:[]},
     {dimension:'work_front',label:'By Work Front',sourcePopulation:2,classifiedPopulation:0,unclassifiedPopulation:2,classificationCoveragePercent:0,available:false,basis:'Explicit work front only',rows:[]},
     {dimension:'cbs',label:'By CBS',sourcePopulation:2,classifiedPopulation:0,unclassifiedPopulation:2,classificationCoveragePercent:0,available:false,basis:'Explicit CBS only',rows:[]},
   ]
 };
 const html=runInNewContext(script+';renderProgressBreakdownVisual(data)',{
   data,projectionFor:(v:any)=>v,planningKpis:()=>'',escapeHtml:String,fmt:String,percent2:(v:any)=>Number(v).toFixed(2)
 });
 for(const label of ['By WBS','By WBS Level','By Zone','By Level','By Work Front','By CBS'])assert.match(html,new RegExp(label));
 assert.match(html,/data-progress-filter/);
 assert.match(html,/Baseline planned progress is not shown/);
 assert.match(html,/not available from the current programme/i);
 assert.doesNotMatch(html,/Unresolved/i);
 assert.doesNotMatch(html,/confirm/i);
});

test('Forecast review suppresses probability dates in every chart, not only the lower cards',()=>{
 const script=functions(['renderForecastVisual','planningDateMs','planningShortDate','planningCalendarDaysBetween']);
 const bars:any[][]=[];
 const html=runInNewContext(script+';renderForecastVisual(data)',{
  data:{independentForecastCompletionIso:'2033-05-15',sourceForecastCompletionIso:'2030-06-30',dataDateIso:'2026-08-31',complete:true,managementReviewState:'review_required',probabilistic:{p50CompletionIso:'2034-01-01',p80CompletionIso:'2035-01-01',p90CompletionIso:'2036-01-01'}},
  projectionFor:(v:any)=>v,renderCompletionPosition:()=>'',experienceDisclosure:(_t:string,b:string)=>b,planningKpis:()=>'',escapeHtml:String,fmt:String,humanizeKey:String,planningDateLadder:()=>'',
  renderVisualPanel:(_t:any,_s:any,body:any)=>body,renderVisualBars:(rows:any[])=>{bars.push(rows);return '';},renderWaterfallChart:(rows:any[])=>{bars.push(rows);return '';},
 });
 assert.ok(bars[0]!.every(r=>!/P50|P80|P90/.test(r.label)));
 assert.equal(bars[1]!.find(r=>r.label==='P80 vs CMeng CPM').value,null);
 assert.ok(!/2034|2035|2036/.test(html));assert.match(html,/P50, P80 and P90 are withheld/);
});

test('Milestone chart retains priority exceptions and represents repeated watch movement once',()=>{
 const script=functions(['planningMilestoneTimeline','planningDateMs','planningShortDate']);
 const rows=[{activityId:'critical',managementPriority:'critical',totalFloatHours:-10},...Array.from({length:8},(_,i)=>({activityId:'watch'+i,managementPriority:'watch',totalFloatHours:300}))].map(r=>({...r,status:'not_started',name:r.activityId,varianceDays:181,baselineDateIso:'2030-01-01',currentDateIso:'2030-07-01'}));
 const html=runInNewContext(script+';planningMilestoneTimeline(p)',{p:{rows,dataDateIso:'2026-08-31'},escapeHtml:String,fmt:String,planningMilestoneChartPriority:(r:any)=>r.managementPriority==='critical'?10:1,planningMilestonePriorityRank:()=>0,planningMilestoneCriticalityLabel:(r:any)=>r.managementPriority,planningMilestoneDueLabel:()=> 'future'});
 assert.match(html,/Representative of 8 watch milestones/);assert.match(html,/2 priority representatives from 9 open milestones/);assert.match(html,/critical/);
 assert.equal((html.match(/class="milestone-date-row"/g)||[]).length,2);
 assert.equal(rows.length,9,'source population is untouched');
});
