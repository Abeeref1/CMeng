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


test('Forecast review suppresses probability dates in every chart, not only the lower cards',()=>{
 const script=functions(['renderForecastVisual','planningDateMs','planningShortDate','planningCalendarDaysBetween']);
 const bars:any[][]=[];
 const html=runInNewContext(script+';renderForecastVisual(data)',{
  data:{independentForecastCompletionIso:'2033-05-15',sourceForecastCompletionIso:'2030-06-30',dataDateIso:'2026-08-31',complete:true,managementReviewState:'review_required',probabilistic:{p50CompletionIso:'2034-01-01',p80CompletionIso:'2035-01-01',p90CompletionIso:'2036-01-01'}},
  projectionFor:(v:any)=>v,planningKpis:()=>'',escapeHtml:String,fmt:String,humanizeKey:String,planningDateLadder:()=>'',
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
