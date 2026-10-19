import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration,isCallExpression,isIdentifier,forEachChild,type Node} from 'typescript';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectFactConsumerMismatches} from '../packages/runtime-api/src/project-fact-consumers';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {contractTimeProject,PENDING_CLAIMS,CONTRACT_COMPLETION,EXTENDED_COMPLETION} from './f33-f44-contract-time-fixture';

// F33: the extended completion date (contract + awarded EOT) is read by one
// shared reader and is the same on the Dashboard, Brief, Milestones, Completion
// History and Completion Forecast and on every finish chart; days late are
// measured against it (15 days: 06 Oct 2027 against 21 Sep 2027).
const PAGES=['master-dashboard','pmo-analysis','milestones','forecast-history','independent-forecast'] as const;
const data=(projectId:string,key:string):any=>moduleForProject(projectId,key).data;

const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const ast=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
const fnText=(names:string[])=>{
  const found=ast.statements.filter(isFunctionDeclaration).filter(n=>n.name&&names.includes(n.name.text));
  assert.equal(found.length,names.length,'every named browser function exists');
  return found.map(n=>n.getText(ast)).join('\n');
};
const context={escapeHtml:(s:unknown)=>String(s),fmt:String,planningShortDate:(s:unknown)=>s==null?'Not available':String(s).slice(0,10),
  planningRevisionLabel:String,managementPanel:(_t:string,_s:string,body:string)=>body,
  planningMilestoneChartPriority:()=>1,planningMilestonePriorityRank:()=>0,planningMilestoneCriticalityLabel:()=>'',planningMilestoneDueLabel:()=>'',planningMilestoneChartName:String,sourceWorkingFloat:()=>'',listTotal:(list:unknown[])=>Array.isArray(list)?list.length:0,screenCountText:String};
const charts=fnText(['contractTimeLines','planningDateTrend','planningDateMs','renderDashboardTrend','planningMilestoneTimeline']);
const render=(call:string,input:Record<string,unknown>)=>String(runInNewContext(charts+';'+call,{...context,...input}));
const lineDates=(html:string)=>[...new Set([...html.matchAll(/(Contract completion|Contract including awarded EOT[^·<"]*) · (\d{4}-\d{2}-\d{2})/g)].map(m=>m[1]!.trim()+' '+m[2]))];

test('F33 every page reads the same extended completion and days late from the shared contract time reader',()=>{
  const projectId=contractTimeProject({claims:PENDING_CLAIMS});
  for(const key of PAGES){
    const d=data(projectId,key),time=d.projectFacts.time;
    assert.equal(time.contractualCompletionIso.value,CONTRACT_COMPLETION,key);
    assert.equal(time.extendedContractCompletionIso.value,EXTENDED_COMPLETION,key);
    assert.equal(time.governingContractCompletionIso.value,EXTENDED_COMPLETION,key+' lateness is measured against the extended date');
    assert.equal(time.submittedDaysAfterExtendedCompletion.value,15,key);
    assert.equal(time.submittedDaysAfterCurrentContract.value,15,key);
    assert.deepEqual(projectFactConsumerMismatches(d),[],key+' bound page fields equal the shared fact');
  }
  const dashboard=data(projectId,'master-dashboard'),brief=data(projectId,'pmo-analysis'),milestones=data(projectId,'milestones'),forecast=data(projectId,'independent-forecast');
  // Before: the Dashboard (published without the per-page binding) had no extended date in its completion position.
  assert.equal(dashboard.completionPosition.extendedContractFinishIso,EXTENDED_COMPLETION);
  assert.equal(dashboard.projectDiagnosis.completion.extendedContractFinishIso,EXTENDED_COMPLETION);
  assert.equal(brief.completionPosition.extendedContractFinishIso,EXTENDED_COMPLETION);
  assert.equal(brief.claims.officialAdjustedCompletionIso,EXTENDED_COMPLETION);
  assert.equal(forecast.requiredFinishIso,EXTENDED_COMPLETION);
  assert.equal(forecast.requiredFinishVarianceDays,15);
  assert.equal(forecast.forecastTaxonomy.contractualCompletion.completionIso,EXTENDED_COMPLETION);
  assert.equal(forecast.completionPosition.extendedContractFinishIso,EXTENDED_COMPLETION);
  // Before: package lateness on Milestones and Completion Forecast used the original 08 Sep 2027.
  assert.equal(milestones.scheduleBasisReview.contractFinishIso,EXTENDED_COMPLETION);
  assert.equal(forecast.scheduleBasisReview.contractFinishIso,EXTENDED_COMPLETION);
});

test('F33 every finish chart draws the contract and the extended line from the same reader',()=>{
  const projectId=contractTimeProject({claims:PENDING_CLAIMS});
  const expected=['Contract completion '+CONTRACT_COMPLETION,'Contract including awarded EOT '+EXTENDED_COMPLETION];
  const points=[{dataDateIso:'2027-02-01',sourceForecastCompletionIso:'2027-10-01'},{dataDateIso:'2027-03-01',sourceForecastCompletionIso:'2027-10-06'}];
  for(const key of PAGES){
    const d=data(projectId,key);
    // Completion History and Revision History trends.
    const trend=render('planningDateTrend(points.map(p=>({...p,dateIso:p.dataDateIso})),[{key:"sourceForecastCompletionIso",label:"Submitted",color:"#000"}],contractTimeLines(d))',{d,points});
    assert.deepEqual(lineDates(trend),expected,key+' trend chart');
    // Milestones timeline.
    const rows=[{activityId:'M900',name:'Project Completion',status:'not_started',baselineDateIso:'2027-10-06',currentDateIso:'2027-10-06',forecastDateIso:'2027-10-06',varianceDays:0,managementPriority:'critical'}];
    const timeline=render('planningMilestoneTimeline({rows,dataDateIso:"2027-03-01"},contractTimeLines(d))',{d,rows});
    assert.deepEqual(lineDates(timeline),expected,key+' milestone chart');
  }
  // Before: the Dashboard completion trend drew no contract line at all.
  const dashboard=data(projectId,'master-dashboard');
  const dashboardTrend=render('renderDashboardTrend({...d,trend:{points}})',{d:dashboard,points});
  assert.deepEqual(lineDates(dashboardTrend),expected,'Dashboard completion trend');
  // Every finish chart caller in the browser script passes the shared reader.
  const calls:string[]=[];
  const visit=(node:Node)=>{if(isCallExpression(node)&&isIdentifier(node.expression)&&['planningDateTrend','planningMilestoneTimeline'].includes(node.expression.text))calls.push(node.arguments.at(-1)?.getText(ast)??'');forEachChild(node,visit);};
  visit(ast);
  assert.ok(calls.length>=4,'finish chart callers found');
  assert.deepEqual(calls.filter(arg=>arg!=='contractTimeLines(data)'),[],'no finish chart reads its own contract date');
});

test('F33 without an awarded EOT the original date is never labelled as including EOT',()=>{
  const projectId=contractTimeProject({eot:false});
  const d=data(projectId,'independent-forecast');
  assert.equal(d.projectFacts.time.extendedContractCompletionIso.value,null);
  assert.equal(d.projectFacts.time.governingContractCompletionIso.value,CONTRACT_COMPLETION);
  const points=[{dataDateIso:'2027-02-01',sourceForecastCompletionIso:'2027-10-01'},{dataDateIso:'2027-03-01',sourceForecastCompletionIso:'2027-10-06'}];
  const trend=render('planningDateTrend(points.map(p=>({...p,dateIso:p.dataDateIso})),[{key:"sourceForecastCompletionIso",label:"Submitted",color:"#000"}],contractTimeLines(d))',{d,points});
  assert.deepEqual(lineDates(trend),['Contract completion '+CONTRACT_COMPLETION]);
  assert.doesNotMatch(trend,/including awarded EOT/);
});
