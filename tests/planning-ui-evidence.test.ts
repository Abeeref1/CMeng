import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createSourceFile, ScriptTarget, isFunctionDeclaration } from 'typescript';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';
import { deliveryScript } from '../packages/runtime-api/src/ui-delivery';

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
   data,projectionFor:(v:any)=>v,planningKpis:()=>'',escapeHtml:String,fmt:String,percent2:(v:any)=>Number(v).toFixed(2),pmcDisplayOwner:()=> 'PMC Project Controls Manager'
 });
 for(const label of ['By WBS','By WBS Level','By Zone','By Level','By Work Front','By CBS'])assert.match(html,new RegExp(label));
 assert.match(html,/data-progress-filter/);
 assert.match(html,/Baseline planned progress is not shown/);
 assert.match(html,/not available from the current programme/i);
 assert.doesNotMatch(html,/Unresolved/i);
 assert.doesNotMatch(html,/confirm/i);
});


test('Completion Forecast converts calendar and graph diagnostics to business language',()=>{
 const run=functions(['forecastDiagnosticMessages'])+';forecastDiagnosticMessages';
 const messages=runInNewContext(run,{fmt:(v:any)=>String(v)})([
  'CALENDAR_SEMANTICS_UNRESOLVED:6:CALENDAR_WORKING_INTERVALS_NOT_ESTABLISHED:Supply The Calendar Working Days',
  'SCHEDULE_GRAPH_CYCLES:RMH 010 008',
  'SCHEDULE_GRAPH_DUPLICATE_ACTIVITY_IDS:RMH 010 008',
  'SCHEDULE_GRAPH_SELF_LOOPS:RMH 010 008',
  'SCHEDULE_GRAPH_BROKEN_PREDECESSORS:Native:1::99999999',
 ]);
 const text=messages.join(' ');
 assert.match(text,/calendar definition/i);
 assert.match(text,/cycle/i);
 assert.match(text,/duplicate activity ID/i);
 assert.match(text,/self-referencing relationship/i);
 assert.match(text,/predecessor that is not present/i);
 assert.doesNotMatch(text,/CALENDAR_SEMANTICS|SCHEDULE_GRAPH|WORKING_INTERVALS|DUPLICATE_ACTIVITY_IDS|SELF_LOOPS/i);
});

test('Interface Management uses its dedicated renderer and never prints undefined for an empty interface position',()=>{
 const data:any={
  projectionKey:'delivery',deliveryPage:'delivery-interfaces',interfaceProjectionKey:'interface_intelligence',
  managementPosition:'No confirmed or derivable interface population is available from the current Project information.',
  rows:[],confirmedCount:0,candidateCount:0,blockerCount:0,linkedActivityCount:0,basis:'Confirmed interfaces come from reviewed Interface records.',
 };
 const html=runInNewContext(functions(['interfaceDisplay','renderInterfaceIntelligenceVisual'])+';renderInterfaceIntelligenceVisual(data)',{
  data,projectionFor:(v:any)=>v,escapeHtml:String,fmt:String,humanizeKey:String,planningShortDate:String,
  planningKpis:()=>'<div>KPI</div>'
 });
 assert.match(html,/Interface position/);
 assert.match(html,/No confirmed or derivable interface population/);
 assert.doesNotMatch(html,/undefined/i);
 const routed=runInNewContext(deliveryScript()+';renderDelivery({data})',{data});
 assert.equal(routed,false,'Interface intelligence must bypass the generic Delivery renderer');
});

test('Master Dashboard groups repeated priority reasons and retains activity identities',()=>{
 const d:any={
  dataDateIso:'2026-08-31',counts:{critical:{value:3},negativeFloat:{value:3},nearCritical:{value:0}},
  wbsRows:[],network:{rows:[]},tableTotals:{network:0},completion:{},summary:'Position',
  actions:[
   {rank:1,activityId:'JRT-001-073',name:'Programme Management Activity 073',wbs:'Programme Management - WP01',reason:'-120 hours source float',action:'Review'},
   {rank:2,activityId:'JRT-001-074',name:'Programme Management Activity 074',wbs:'Programme Management - WP01',reason:'-120 hours source float',action:'Review'},
   {rank:3,activityId:'JRT-001-075',name:'Programme Management Activity 075',wbs:'Programme Management - WP01',reason:'-120 hours source float',action:'Review'},
  ],
 };
 const html=runInNewContext(functions(['renderProjectDashboardSummary'])+';renderProjectDashboardSummary(d)',{
  d,escapeHtml:String,fmt:String,planningShortDate:String,planningKpis:()=>'',renderCompletionPosition:()=>'',renderProjectDiagnosis:()=>''
 });
 assert.equal((html.match(/-120 hours source float/g)||[]).length,1);
 assert.match(html,/JRT-001-073/);
 assert.match(html,/JRT-001-074/);
 assert.match(html,/JRT-001-075/);
 assert.match(html,/WBS Programme Management - WP01/);
 assert.match(html,/Next: Review/);
});

test('An incomplete probability calculation suppresses dates in every chart, not only the lower cards',()=>{
 const script=functions(['forecastDiagnosticMessages','renderForecastVisual','planningDateMs','planningShortDate','planningCalendarDaysBetween']);
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

test('An available probability calculation remains visible while forecast reconciliation needs review',()=>{
 const script=functions(['forecastDiagnosticMessages','renderForecastVisual','planningDateMs','planningShortDate','planningCalendarDaysBetween']);
 const bars:any[][]=[];
 const html=runInNewContext(script+';renderForecastVisual(data)',{
  data:{independentForecastCompletionIso:'2033-05-15',sourceForecastCompletionIso:'2030-06-30',dataDateIso:'2026-08-31',complete:true,managementReviewState:'review_required',probabilistic:{status:'available',p50CompletionIso:'2034-01-01',p80CompletionIso:'2035-01-01',p90CompletionIso:'2036-01-01'}},
  projectionFor:(v:any)=>v,renderCompletionPosition:()=>'',experienceDisclosure:(_t:string,b:string)=>b,planningKpis:()=>'',escapeHtml:String,fmt:String,humanizeKey:String,planningDateLadder:()=>'',
  renderVisualPanel:(_t:any,_s:any,body:any)=>body,renderVisualBars:(rows:any[])=>{bars.push(rows);return '';},renderWaterfallChart:(rows:any[])=>{bars.push(rows);return '';},
 });
 assert.ok(bars[0]!.every(r=>!/P50|P80|P90/.test(r.label)));
 assert.equal(typeof bars[1]!.find(r=>r.label==='P80 vs CMeng CPM').value,'number');
 assert.match(html,/2034/);assert.match(html,/2035/);assert.match(html,/2036/);assert.ok(!html.includes('P50, P80 and P90 are withheld'));assert.match(html,/assumptions/);
});

test('Milestone chart retains priority exceptions and represents repeated watch movement once',()=>{
 const script=functions(['planningMilestoneTimeline','planningDateMs','planningShortDate']);
 const rows=[{activityId:'critical',managementPriority:'critical',totalFloatHours:-10},...Array.from({length:8},(_,i)=>({activityId:'watch'+i,managementPriority:'watch',totalFloatHours:300}))].map(r=>({...r,status:'not_started',name:r.activityId,varianceDays:181,baselineDateIso:'2030-01-01',currentDateIso:'2030-07-01'}));
 const html=runInNewContext(script+';planningMilestoneTimeline(p,"2030-08-01")',{p:{rows,dataDateIso:'2026-08-31'},escapeHtml:String,fmt:String,planningMilestoneChartPriority:(r:any)=>r.managementPriority==='critical'?10:1,planningMilestonePriorityRank:()=>0,planningMilestoneCriticalityLabel:(r:any)=>r.managementPriority,planningMilestoneDueLabel:()=> 'future'});
 assert.match(html,/Representative of 8 watch milestones/);assert.match(html,/2 priority representatives from 9 open milestones/);assert.match(html,/critical/);
 assert.equal((html.match(/class="milestone-date-row"/g)||[]).length,2);
 assert.equal(rows.length,9,'source population is untouched');
 assert.match(html,/Contract including awarded EOT/);
 const lines=[...html.matchAll(/class="date-contract"[^>]*left:([\d.]+)%/g)];assert.equal(lines.length,2);
 assert.ok(lines.every(line=>Number(line[1])>0&&Number(line[1])<100),'contract dates beyond the last forecast remain on the chart axis');
});


test('Interface Management sanitizes literal undefined, null and NaN values',()=>{
 const script=functions(['interfaceDisplay','renderInterfaceIntelligenceVisual']);
 const data:any={interfaceProjectionKey:'interface_intelligence',managementPosition:'Open interfaces',confirmedCount:1,blockerCount:0,candidateCount:0,linkedActivityCount:1,basis:'Explicit links',rows:[{
   interfaceId:'IF-01',authority:'confirmed',state:'open',givingParty:'undefined',receivingParty:'null',package:'PKG-1',
   discipline:null,system:'NaN',location:'',requiredDeliverable:'undefined',requiredDate:null,responsibleParty:'undefined',
   linkedActivity:'A-1',linkedRfi:null,linkedSubmittal:null,linkedRisk:null,consequence:'undefined',escalation:null
 }]};
 const html=runInNewContext(script+';renderInterfaceIntelligenceVisual(data)',{
   data,projectionFor:(v:any)=>v,escapeHtml:String,humanizeKey:String,planningShortDate:String,fmt:String,planningKpis:()=>''
 });
 assert.doesNotMatch(html,/>undefined</i);
 assert.doesNotMatch(html,/>null</i);
 assert.doesNotMatch(html,/>NaN</i);
 assert.match(html,/Not established/);
});

test('Recovery and Acceleration explains eligibility instead of presenting a bare zero-scenario result',()=>{
 const script=functions(['renderRecoveryAccelerationVisual']);
 const data:any={projectionKey:'recovery_acceleration',scenarios:[],calculatedScenarioCount:0,assumptionRequiredCount:0,scenarioState:'no_eligible_recovery_basis',
   dataDateIso:'2026-08-31',managementPosition:'No recovery option currently meets the calculation criteria.',
   eligibility:{activityFeasibilityCheckCount:44,crewAccelerationCandidateCount:0,lateProcurementPackageCount:0,unresolvedFeasibilityCheckCount:0,governedResequencingWorkfrontCount:0},basis:'Evidence only.'};
 const html=runInNewContext(script+';renderRecoveryAccelerationVisual(data)',{
   data,projectionFor:(v:any)=>v,escapeHtml:String,humanizeKey:String,planningShortDate:String,fmt:String,
   planningKpis:(rows:any[])=>rows.map(r=>r.join(' ')).join(' ')
 });
 assert.match(html,/None qualify/);
 assert.match(html,/44/);
 assert.match(html,/No eligible quantified recovery scenario/i);
 assert.doesNotMatch(html,/Calculated recovery options 0\b/);
});
