import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';

function render(overrides:Record<string,unknown>={}):string {
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const start=script.indexOf('function renderNearCriticalVisual(data){');
  const end=script.indexOf('function renderManhourVisual(data){',start);
  assert.ok(start>=0&&end>start);
  // Real list-total and count-text helpers from the built page script (T05).
  const parsed=createSourceFile('cmeng-screen.js',script,ScriptTarget.Latest,true);
  const countHelpers='let responsePopulationRoot=null,responsePopulationIndex=new WeakMap(),responseRowPopulationIndex=new WeakMap();\n'+parsed.statements.filter(isFunctionDeclaration).filter(n=>['indexResponsePopulations','listTotal','knownScreenCount','screenCountText',
    // T06: real shared float-threshold and float-summary helpers from the same page script.
    'floatThresholdText','floatBucketDaysNote','floatDistributionSummary'].includes(n.name?.text??'')).map(n=>n.getText(parsed)).join('\n');
  const p={rows:[],watchlistRows:[],criticalRows:[],negativeFloatRows:[],managementGroups:[],
    nearCriticalCount:0,floatRiskWatchlistCount:0,zeroFloatCount:0,negativeFloatCount:0,
    floatCoveragePercent:100,classificationCoveragePercent:100,unresolvedActivityCount:0,
    criticalThresholdHours:0,nearCriticalThresholdHours:40,floatRiskWatchlistIncludesCriticalThreshold:true,
    ...overrides};
  const string=(value:unknown)=>String(value??'');
  return vm.runInNewContext(countHelpers+'\n'+script.slice(start,end)+';renderNearCriticalVisual(p);',{
    shortRevision:(value:unknown)=>value?'Previous programme':'No comparison programme',p,projectionFor:(value:unknown)=>value,escapeHtml:string,fmt:string,planningShortDate:string,
    planningStateLabel:string,planningDaysBetween:()=>null,planningKpis:()=>'',
    planningFloatHistogram:()=>'',planningFinishPeriodBars:()=>'',distributionSummary:()=>'',
  }) as string;
}
function visibleWithoutOpeningDetails(html:string):string {
  return html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
}
for(const [authority,label] of [
  ['project_source','Project control basis'],
  ['cmeng_screening_policy','CMeng screening policy'],
  ['unresolved','Threshold authority unresolved'],
] as const) test('Batch C: '+label+' remains visible before classification details',()=>{
  const html=render({nearCriticalThresholdAuthority:authority});
  const visible=visibleWithoutOpeningDetails(html);
  assert.match(visible,/Float screening basis:/);
  assert.ok(visible.includes(label));
  assert.match(visible,/Critical = TF ≤ 0 working days; Near-Critical screening = TF > 0 working days and ≤ 40 h \(an hours threshold; working days differ by activity calendar\)/);
  assert.ok(html.indexOf('Float classification coverage:')<html.indexOf('Float screening basis:'));
  assert.ok(html.indexOf('Float screening basis:')<html.indexOf('Work packages closest to critical'));
  assert.equal((html.match(/Float screening basis:/g)||[]).length,1,'one canonical basis, not duplicate disclosures');
});

test('Batch C: unestablished float coverage never says the whole population is classifiable',()=>{
  const visible=visibleWithoutOpeningDetails(render({classificationCoveragePercent:null,floatCoveragePercent:null}));
  assert.match(visible,/Float classification coverage: Not established/);
  assert.doesNotMatch(visible,/execution population is fully classifiable/);
  assert.match(visible,/project-wide classification is not established/i);
});

test('Batch C: partial coverage and unknown population remain ahead of management counts',()=>{
  const visible=visibleWithoutOpeningDetails(render({classificationCoveragePercent:62.5,unresolvedActivityCount:3}));
  assert.match(visible,/62.5%/);
  assert.match(visible,/3 execution activities still lack/);
  assert.doesNotMatch(visible,/execution population is fully classifiable/);
});
