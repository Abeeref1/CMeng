// Round 15 guard rules on the remaining shared states (real functions from the assembled browser script):
// N1 a list cut to the page size is never counted as the whole list, and a whole list is said as whole;
// S1 an unknown movement tile says why; A4 a missing action due date is shown as missing with the way to
// set it, and a register value the source does not state is not an action placeholder; C1 a page that
// shows values that do not agree gives the record a way to correct or choose them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext as runVm} from 'node:vm';
import {runInNewContext} from './browser-context';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';
import {baselineMovementReason} from '../packages/runtime-api/src/unknown-reason';
import {readableFieldLabel} from '../packages/runtime-api/src/field-labels';

// The guard's own patterns (sysguard.py).
const UNK=/(?:Not established|Not in source|Not available|Not assessable|Not calculated|Not provided|Not recorded|Not confirmed|Unknown)/;
const REASON=/\b(because|until|needs?|require[sd]?|upload|confirm|missing|not supplied|no supplied|supply|provide|awaiting|pending|enter|add |select|choose|review|no .{0,30}(register|file|record|value|date|column)|without|cannot|not (yet )?(read|linked|mapped|supplied|dated))/i;
const A4=/Not assigned|Not recorded|Suggested: [^\n\t]{0,40}|Individual Not Designated|Owner[:\s]+Not established|Due[^\n\t]{0,10}Not established/;
const C1=/\b(?:score conflict|date conflict|value conflict|classification conflict|source conflict|conflicting (?:values|dates|evidence|records|sources)|sources? (?:disagree|conflict)|reporting groups disagree|records disagree(?![ \t]*\d)|disagree(?:s|ment)? (?:with|between))\b/i;
const escapeHtml=(s:unknown)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const text=(html:string)=>html.replace(/<[^>]+>/g,'\n').replace(/&amp;/g,'&').replace(/\n+/g,'\n');
const tiles=(html:string)=>[...html.matchAll(/<div class="planning-kpi(?: [^"]*)?">([\s\S]*?)<\/div>/g)].map(m=>text(m[1]!).trim().split('\n').join(' | '));

test('S1: the movement reason comes from the baseline state and the revision comparison counts',()=>{
  assert.equal(baselineMovementReason({state:'unresolved',reason:'No confirmed baseline'},{comparableActivities:0,sourceActivityCount:47}),'Needs a confirmed baseline programme');
  assert.equal(baselineMovementReason({state:'established'},{comparableActivities:0,sourceActivityCount:47}),'Needs activities matched to the baseline (0 of 47 matched)');
  assert.equal(baselineMovementReason({state:'established'},{comparableActivities:12,sourceActivityCount:47}),'','a known comparison has no reason to give');
  assert.equal(baselineMovementReason({state:'established'},{forecastCompletionIso:null},'project_finish'),'Needs a submitted finish date in this revision');
  assert.equal(baselineMovementReason({state:'established'},{forecastCompletionIso:'2041-04-28'},'project_finish'),'Needs a finish date in the baseline programme');
});

test('S1: every unknown Variance Trend tile says why it is unknown',()=>{
  const point=(sequence:number)=>({revisionId:'R'+sequence,sequence,dataDateIso:'2040-0'+(6+sequence)+'-10',sourceActivityCount:47,comparableActivities:0,unmatchedActivityCount:47,
    averageFinishVarianceDays:null,maximumDelayDays:null,lateActivityCount:null,earlyActivityCount:null,onTimeActivityCount:null,negativeFloatCount:17,criticalCount:26,
    forecastCompletionIso:'2041-04-28',projectCompletionVarianceDays:null,movementDistribution:null});
  const ctx={escapeHtml,fmt:String,humanizeIsoText:(s:unknown)=>String(s??''),planningShortDate:String,projectionFor:(d:any)=>d,shortRevision:String,
    planningSignedBars:()=>'<svg>TREND</svg>',renderFloatPressureTrend:()=>'<svg>FLOAT</svg>',distributionSummary:()=>''};
  for(const [baseline,why] of [[{state:'unresolved',revisionId:null,reason:'No confirmed baseline'},/Needs a confirmed baseline programme/],[{state:'established',revisionId:'R0'},/Needs activities matched to the baseline \(0 of 47 matched\)/]] as const){
    const data={revisionCount:3,points:[point(1),point(2),point(3)],featureAvailability:{state:'active'},baselineComparison:baseline,projectFacts:{schedule:{delayedOpenActivityCount:{value:4}}}};
    const shown=tiles(runInNewContext('baselineMovementReason;renderVarianceTrendVisual(data)',{...ctx,data}) as string);
    for(const label of ['Latest avg movement','Latest max activity movement','Records finishing after baseline','Project finish movement']){
      const tile=shown.find(t=>t.startsWith(label+' |'));
      assert.ok(tile,label+' is shown');
      assert.match(tile!,UNK,label+' is unknown');
      assert.match(tile!,REASON,'S1: '+tile);
    }
    assert.match(shown.find(t=>t.startsWith('Latest avg movement |'))!,why);
  }
});

test('N1: the watchlist caption counts the true total and says a whole list is whole',()=>{
  const row=(i:number)=>({activityId:'A-'+i,name:'Activity '+i,status:'in_progress',totalFloatHours:8*i,submittedTotalFloatHours:8*i,submittedTotalFloatWorkingDays:i,workingDayHours:8,
    floatDaysBasis:'source_activity_calendar',calendarId:'C1',nearCriticalThresholdHours:40,nearCriticalThresholdWorkingDays:5,currentFinishIso:'2041-03-04',baselineFinishIso:null});
  const base={rows:[],criticalRows:[],negativeFloatRows:[],managementGroups:[],nearCriticalCount:0,zeroFloatCount:0,negativeFloatCount:0,
    floatCoveragePercent:100,classificationCoveragePercent:100,unresolvedActivityCount:0,criticalThresholdHours:0,nearCriticalThresholdHours:40,floatRiskWatchlistIncludesCriticalThreshold:true};
  const string=(value:unknown)=>String(value??'');
  const render=(p:any)=>runInNewContext('listTotal;knownScreenCount;screenCountText;renderNearCriticalVisual(p)',{p,shortRevision:(v:unknown)=>v?'Previous programme':'No comparison programme',projectionFor:(v:unknown)=>v,
    escapeHtml:string,fmt:string,planningShortDate:string,planningStateLabel:string,planningDaysBetween:()=>null,planningKpis:()=>'',planningFloatHistogram:()=>'',planningFinishPeriodBars:()=>'',distributionSummary:()=>''}) as string;
  const whole=text(render({...base,watchlistRows:[row(0),row(1),row(3)],floatRiskWatchlistCount:3}));
  assert.match(whole,/All 3 watchlist activities are listed below/);
  assert.doesNotMatch(whole,/Showing 3 of 3/,'a whole list is not said as a part of itself');
  const cut=text(render({...base,watchlistRows:[row(0),row(1)],floatRiskWatchlistCount:55}));
  assert.match(cut,/Showing 2 of 55 watchlist activities/,'a cut list says its true total');
  assert.match(text(render({...base,watchlistRows:[],floatRiskWatchlistCount:0})),/No activity is on the float-risk watchlist\./);
});

// A minimal table for the shared owner / due-date pass (the same DOM calls the page makes).
class Cell{
  tagName='TD';constructor(public innerHTML:string){}
  get textContent(){return this.innerHTML.replace(/<[^>]+>/g,'');}
  querySelector(selector:string){const attr=/^\[([a-z-]+)\]$/.exec(selector);return attr&&this.innerHTML.includes(attr[1]!)?{}:null;}
}
function table(headings:string[],rows:string[][]){
  const body=rows.map(row=>({children:row.map(html=>new Cell(html))}));
  const node={closest:()=>null,querySelectorAll:(selector:string)=>selector==='thead th'?headings.map(h=>({textContent:h})):selector==='tbody tr'?body:[]};
  return {root:{querySelectorAll:(selector:string)=>selector==='table'?[node]:[]},body};
}
const pageContext={moduleRegistry:[{key:'source-quality'},{key:'variations-change'},{key:'documents'}],names:{'source-quality':'Actions required'},
  blockOwnerEntry:(topic:string)=>topic==='review-items'?{owner:'source-quality'}:null,currentPageKey:()=>'variations-change',appView:'project',escapeHtml};

test('A4: a missing action due date is shown as missing with the way to set it, beside the missing owner',()=>{
  const {root,body}=table(['Finding','Exposure','Owner','Due','Action','Status'],[
    ['VO-1','Approved 856,240','Not recorded','Not recorded','No open lifecycle action indicated by the current stage.','Approved'],
    ['IPC-2','Certified 10,000','Not recorded','Not recorded<br><span class="muted">Contract payment period from certification</span>','Obtain payment evidence.','Due'],
    ['SI-3','Estimate 5,000','Jane Smith','Mar 29, 2041','Obtain quotation by the confirmed due date.','Open']]);
  runInNewContext('applyPmcDisplayOwners(root,"commercial")',{...pageContext,root});
  const [first,second,third]=body.map(row=>row.children);
  assert.match(first![3]!.innerHTML,/data-due-missing>Due date not set</);
  assert.match(first![3]!.innerHTML,/<button[^>]*data-module="source-quality"[^>]*>Set the due date in Actions required</);
  assert.match(first![2]!.innerHTML,/data-owner-missing>Owner not set</,'the owner keeps its own missing-owner control');
  assert.match(second![3]!.innerHTML,/Due date not set[\s\S]*Contract payment period from certification/,'the due-date basis line is kept');
  assert.equal(third![3]!.innerHTML,'Mar 29, 2041','a known due date is unchanged');
  assert.equal(third![2]!.innerHTML,'Jane Smith','a named owner is unchanged');
  for(const row of body)assert.doesNotMatch(row.children.map(c=>c.textContent).join('\t'),A4,'A4: no placeholder owner or due date');
  // On the page that sets due dates, the control says so instead of reopening the page (A2).
  assert.match(runInNewContext('dueMissingHtml("variations-change")',pageContext) as string,/<small data-set-due[^>]*>Set the due date on this page<\/small>/);
});

test('A4: a value the claim register does not state reads as the table\'s other unstated values, never as an action placeholder',()=>{
  const data={events:[{eventId:'EV-0B',title:'Late design information',linkedClaimIds:['CLM-0B'],linkedClaimFigures:[{claimId:'CLM-0B',state:'under_review',claimedDays:9,assessedDays:null}],responsibility:'employer',noticeIds:['CLM-0B:notice']},
    {eventId:'EV-0D',title:'Unclaimed access delay',linkedClaimIds:[],responsibility:'employer'}],projectFacts:{claims:{pipeline:{rows:[]}}},delayEotEvidenceChain:{populationState:'established',linkOrder:['event'],rows:[]}};
  const html=runInNewContext('renderDelayClaimsVisual(data)',{currentModuleResult:{data},data,escapeHtml,fmt:String,humanizeKey:String,planningShortDate:String,readerText:String,planningKpis:()=>'',experienceDisclosure:(_t:string,body:string)=>body}) as string;
  assert.match(html,/<td>Under review<\/td><td>9<\/td><td>Not stated<\/td>|<td>under_review<\/td><td>9<\/td><td>Not stated<\/td>/);
  assert.match(html,/<td>No linked claim<\/td><td>No linked claim<\/td><td>No linked claim<\/td>/);
  assert.doesNotMatch(text(html),A4);
});

test('C1: the readiness grid checks status against both delivery-date rules and gives a failing record its correction control',()=>{
  const ui=runVm(deliveryScript()+`;({
    labels:deliveryColumns("procurement-readiness").map(c=>c[1]),
    open:deliveryCell({deliveryDateConflict:false,openStatusDeliveredConflict:true},"deliveryDateConflict"),
    completed:deliveryCell({deliveryDateConflict:true,openStatusDeliveredConflict:false},"deliveryDateConflict"),
    agree:deliveryCell({deliveryDateConflict:false,openStatusDeliveredConflict:false},"deliveryDateConflict"),
    workfront:deliveryCell({kind:"workfront"},"deliveryDateConflict"),
    control:deliveryCellControl({recordId:"delivery:abc",deliveryDateConflict:false,openStatusDeliveredConflict:true},"deliveryDateConflict"),
    none:deliveryCellControl({recordId:"delivery:abc",deliveryDateConflict:false,openStatusDeliveredConflict:false},"deliveryDateConflict")
  })`,{Intl,escapeHtml}) as any;
  assert.ok(ui.labels.includes('Status and delivery dates'));
  assert.equal(ui.labels.filter((label:string)=>C1.test(label)).length,0,'a column heading is not a conflict claim');
  assert.equal(ui.open,'Do not agree','an open status with an earlier actual delivery is not shown as agreeing');
  assert.equal(ui.completed,'Do not agree');
  assert.equal(ui.agree,'Agree');
  assert.equal(ui.workfront,null,'a record without the check stays unknown');
  assert.match(ui.control,/<button class="btn small" data-delivery-edit="delivery:abc">Review record<\/button>/,'the record opens its own correction editor');
  assert.equal(ui.none,'');
});

test('C1: the risk scoring basis never shows its internal fact key and offers the choice only when scores disagree',()=>{
  const validation={ratingDecision:null,state:'review_required',sourceRecordCount:1,missingProbabilityCount:1,missingImpactCount:1,sourceFactKey:'RISK_RATING_SCORE_CONFLICT',
    scoreConflictRows:[],ratingInconsistencyGroups:[],scoreRows:[{riskId:'R-DEL-472',probability:null,impact:null,sourceScore:null,calculatedScore:null,score:null,scoreConflict:false,rating:'High'}]};
  const html=runInNewContext('readerPresentationTechnicalField;humanizeKey;deliveryObjectDetail(v)+"\\n"+deliveryObjectDetail(v.scoreRows[0])+deliveryRiskScoreChoice(v)',{v:validation,escapeHtml}) as string;
  assert.doesNotMatch(html,/Source fact|risk rating score conflict/i,'the internal fact key is not shown as a finding');
  assert.match(html,/Supplied score differs from probability × impact/);
  assert.doesNotMatch(text(html),C1,'no conflict is claimed when none exists');
  assert.doesNotMatch(html,/Choose the value to use/);
  const choice=runInNewContext('deliveryRiskScoreChoice(v)',{v:{...validation,scoreConflictRows:[{riskId:'R-1',scoreConflict:true}],ratingInconsistencyGroups:[{score:6,ratings:['High','Medium']}]},escapeHtml}) as string;
  assert.match(choice,/1 supplied score differs from probability × impact; 1 score value has different supplied ratings\./);
  assert.match(choice,/<button[^>]*data-choose-source-value[^>]*onclick="openProjectActions\(true\)"[^>]*>Choose the value to use<\/button>/);
  assert.equal(readableFieldLabel('scoreConflictRows'),'Scores that differ from probability × impact','downloads use the same label');
});
