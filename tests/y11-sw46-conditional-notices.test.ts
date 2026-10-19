// SW-46 (W8): a notice that states a fact about the project is printed only when the
// project data supports it. A project where the fixed sentence is false must not show it,
// and a project where it is true must still show it.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {moduleFeatureAvailability} from '../packages/runtime-api/src/feature-availability';
import {conditionalNotice} from '../packages/runtime-api/src/conditional-notice';
import {summarizeControlIssues,totalChecksRun} from '../packages/truth-kernel/src';
import {assessModuleIssues} from '../packages/runtime-api/src/module-issues';
import {documentReadReview} from '../packages/runtime-api/src/document-read-review';
import {buildCommercialFoundation} from '../packages/commercial-foundation/src';
import {buildCommercialPerformance} from '../packages/commercial-performance/src';
import {deliveryCheckState} from '../packages/runtime-api/src/advanced-controls';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// The real page functions, taken from the built page script by name.
const PAGE_FUNCTIONS=['conditionalNotice','knownScreenCount','screenCountText',
  'resourcePerHourNotAssessableNote','manhourUnitNote','manhourActualMissingNote',
  'renderResourceVisual','renderManhourVisual','renderRevisionTrendVisual','renderIssueAssessment','renderForecastHistoryVisual','readyChecksPassedCount',
  'contractTimeLines'];
function pageScript():string {
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const parsed=createSourceFile('cmeng-screen.js',script,ScriptTarget.Latest,true);
  return parsed.statements.filter(isFunctionDeclaration).filter(n=>PAGE_FUNCTIONS.includes(n.name?.text??'')).map(n=>n.getText(parsed)).join('\n');
}
const text=(value:unknown)=>String(value??'');
const joinText=(...args:unknown[])=>args.filter(arg=>typeof arg==='string').join(' ');
function render(call:string,p:Record<string,unknown>):string {
  return vm.runInNewContext(pageScript()+'\n'+call+'(p);',{
    p,projectionFor:(value:unknown)=>value,escapeHtml:text,fmt:text,humanizeKey:text,planningShortDate:text,resourceUnitLabel:text,
    planningKpis:()=>'',planningRevisionLabel:text,issueBadge:()=>'',readerIssue:(i:any)=>({title:text(i?.title),owner:'',action:''}),readerText:text,names:{},renderForecastCalculationChecks:()=>'',planningCalendarDaysBetween:()=>null,planningDateTrend:()=>'',shortRevision:text,moduleEvidenceGate:()=>'',renderLineChart:()=>'',renderResourceBasisReview:()=>'',moduleBarList:()=>'',
    experienceDisclosure:joinText,managementPanel:joinText,renderVisualPanel:joinText,visualSection:joinText,
  }) as string;
}

test('SW-46 shared helper: the claim needs data that is exactly true; unknown is never read as true',()=>{
  assert.equal(conditionalNotice(true,'claim','false','unknown'),'claim');
  assert.equal(conditionalNotice(false,'claim','false','unknown'),'false');
  assert.equal(conditionalNotice(null,'claim','false','unknown'),'unknown');
  assert.equal(conditionalNotice(undefined,'claim','false'),'false');
  assert.equal(conditionalNotice(false,'claim'),'');
});

test('SW-46 Resources: "The XER contains resource assignments" is not shown when the programme has none',()=>{
  const weeklyOnly={rows:[],assignedResourceCount:0,assignmentRecordCount:0,perHourCapacityBasedResourceCount:0,capacityCoveragePercent:null};
  const html=render('renderResourceVisual',weeklyOnly);
  assert.doesNotMatch(html,/contains resource assignments/);
  assert.match(html,/Per-hour overload is not 0; it is not assessable\./);
  assert.match(html,/The current programme has no resource assignments/);

  const assigned=render('renderResourceVisual',{...weeklyOnly,assignedResourceCount:4,assignmentRecordCount:12});
  assert.match(assigned,/The XER contains resource assignments but no usable max-units-per-hour capacity for the assigned resources\. CMeng therefore leaves utilization blank/);

  const unknown=render('renderResourceVisual',{rows:[],perHourCapacityBasedResourceCount:0});
  assert.doesNotMatch(unknown,/contains resource assignments|has no resource assignments/);
  assert.match(unknown,/Resource assignments for the current programme are not established/);
});

test('SW-46 Man-hours: "unit gate passed" is not shown for an empty labour list, and "may exist" is replaced by what exists',()=>{
  const empty={points:[],laborResourceCount:0,laborHourResourceCount:0,laborAssignmentCount:0,excludedNonHourLaborResourceIds:[],unresolvedUnitLaborAssignmentCount:0,
    plannedHoursKnown:null,remainingHoursKnown:null,actualHoursKnownCurrent:null,actualHistoryMethod:'missing'};
  const html=render('renderManhourVisual',empty);
  assert.doesNotMatch(html,/unit gate passed/);
  assert.doesNotMatch(html,/may exist/);
  assert.match(html,/The current programme has 0 labour assignment\(s\) and 0 labour resource\(s\) with an hour unit\./);
  assert.match(html,/Planned labor hours are not established; remaining labor hours are not established\. No current actual-hours total is evidenced\./);

  const checked=render('renderManhourVisual',{...empty,laborResourceCount:2,laborHourResourceCount:2,laborAssignmentCount:9,plannedHoursKnown:1200,remainingHoursKnown:300});
  assert.match(checked,/Labour-hour unit gate passed\.<\/b> Man-hour totals use only labour resources whose unit metadata explicitly establishes hours\./);
  assert.match(checked,/Planned labor hours are established; remaining labor hours are established\./);

  // Source weekly labour hours: the programme unit check was not run, so it is not reported as passed.
  const weekly=render('renderManhourVisual',{points:[],actualHistoryMethod:'source_approved_weekly_usage',laborResourceCount:3,laborAssignmentCount:null,
    plannedHoursKnown:500,remainingHoursKnown:null,actualHoursKnownCurrent:null});
  assert.doesNotMatch(weekly,/unit gate passed/);
  assert.match(weekly,/Planned labor hours are established; remaining labor hours are not established\./);
});

test('SW-46 Delivery challenge prerequisites: calendars and labour hours are called available only when present',()=>{
  const evidence=(data:unknown,key:string)=>(moduleFeatureAvailability('challenge-contract',data).prerequisites as any[]).find(row=>row.key===key);
  const missing={suppliedBoq:{itemCount:25},boqFeasibility:{activityChecks:[],rows:[{boqItemId:'B1'}],programmeChecks:{calendarActivityCount:0,remainingLaborHours:null}}};
  const calendar=evidence(missing,'calendar_working_time'),resource=evidence(missing,'resource_basis');
  assert.equal(calendar.established,false);
  assert.doesNotMatch(calendar.evidence,/calendars are available/);
  assert.match(calendar.evidence,/Readable programme calendars are not established/);
  assert.equal(resource.established,false);
  assert.doesNotMatch(resource.evidence,/labour hours are available/);
  assert.match(resource.evidence,/labour hours and submitted headcount are not established/);

  const present={suppliedBoq:{itemCount:25},boqFeasibility:{activityChecks:[],rows:[{boqItemId:'B1'}],programmeChecks:{calendarActivityCount:40,remainingLaborHours:880}}};
  assert.equal(evidence(present,'calendar_working_time').established,true);
  assert.equal(evidence(present,'calendar_working_time').evidence,'Readable programme calendars are available independently of BOQ activity links; item-level working-time checks require those links.');
  assert.equal(evidence(present,'resource_basis').evidence,'Submitted activity-linked labour hours are available; independent required headcount also needs quantity/productivity evidence.');
});

test('SW-46 Revision History: "Revision History is available" is not shown when no revision is recorded',()=>{
  const featureAvailability={state:'evidence_only',reason:'At least two comparable programme revisions are required.'};
  const none=render('renderRevisionTrendVisual',{points:[],featureAvailability});
  assert.doesNotMatch(none,/Revision History is available/);
  assert.match(none,/No controlled programme revision is recorded, so Revision History and its trend are not available\./);
  const one=render('renderRevisionTrendVisual',{points:[{label:'Rev 1',sequence:1,dataDateIso:'2026-08-31'}],featureAvailability});
  assert.match(one,/Revision History is available, but a trend is not yet established\./);
});

test('SW-46 Resources: a programme without a stored resource model reports assignments as not established, not 0',()=>{
  // The projection count is null (see canonical-resource-runtime.ts); the page must not say the programme has none.
  const html=render('renderResourceVisual',{rows:[],assignedResourceCount:null,assignmentRecordCount:null,perHourCapacityBasedResourceCount:0,capacityCoveragePercent:null});
  assert.doesNotMatch(html,/has no resource assignments|contains resource assignments/);
  assert.match(html,/Resource assignments for the current programme are not established/);
});

test('SW-46 Review findings: "The listed checks passed" is not shown when the check state is missing',()=>{
  const missing=render('renderIssueAssessment',{issues:[],counts:{}});
  assert.doesNotMatch(missing,/The listed checks passed/);
  assert.match(missing,/The result of the listed calculation checks is not established\./);
  const passed=render('renderIssueAssessment',{issues:[],counts:{},systemCheckState:'listed_checks_passed'});
  assert.match(passed,/The listed checks passed\. Other calculations may remain outside their scope\./);
  const failed=render('renderIssueAssessment',{issues:[],counts:{},systemCheckState:'failed'});
  assert.match(failed,/Calculation failures require correction before reliance\./);
});

test('SW-46 Forecast history: "Source forecast history is available" is not shown when no revision has a submitted finish',()=>{
  const none=render('renderForecastHistoryVisual',{points:[{sourceRevisionId:'R1',sourceForecastCompletionIso:null}],establishedForecastCount:0});
  assert.doesNotMatch(none,/Source forecast history is available/);
  assert.match(none,/No submitted forecast finish is recorded in these revisions\./);
  const some=render('renderForecastHistoryVisual',{points:[{sourceRevisionId:'R1',sourceForecastCompletionIso:'2027-03-01'}],establishedForecastCount:0});
  assert.match(some,/Source forecast history is available\.<\/b> Programme calendar recalculation could not be established/);
});

test('SW-46 issue assessment: "listed checks passed" only when at least one check ran',()=>{
  assert.equal(summarizeControlIssues([]).systemCheckState,'unverified','unknown check count is not a pass');
  assert.equal(summarizeControlIssues([]).checksRunCount,null);
  assert.equal(summarizeControlIssues([],0).systemCheckState,'unverified','an empty check list is not a pass');
  const ran=summarizeControlIssues([],3);
  assert.equal(ran.systemCheckState,'listed_checks_passed');assert.equal(ran.checksRunCount,3);
  const defect={kind:'system_defect' as const,code:'X',summary:'s',detail:'d',action:'a',owner:'CMeng' as const,moduleKeys:['m'],evidencePaths:[],sourceRefs:[],checkIds:[]};
  assert.equal(summarizeControlIssues([defect],3).systemCheckState,'failed');
  assert.equal(totalChecksRun([null,undefined]),null);
  assert.equal(totalChecksRun([2,null,0,5]),7);
});

test('SW-46 module issues: a verified contract with an empty check list is not "listed checks passed"',()=>{
  const pass={state:'pass' as const,failedCheckIds:[],checkCount:8};
  const module=(checks:unknown)=>({key:'arbitrary-control',status:'ready' as const,engineState:'ready' as const,evidenceState:'established' as const,professionalState:'defensible' as const,reason:null,dependencies:[],
    data:{systemEvidenceContract:{state:'verified_for_checked_metrics',checks},challenge:{reconciliationState:'within_tolerance'}}}) as any;
  const empty=assessModuleIssues(module([]),pass);
  assert.equal(empty.systemCheckState,'unverified');assert.equal(empty.checksRunCount,0);
  const missing=assessModuleIssues(module(undefined),pass);
  assert.equal(missing.systemCheckState,'unverified');assert.equal(missing.checksRunCount,null);
  const ran=assessModuleIssues(module([{metric:'population',passed:true}]),pass);
  assert.equal(ran.systemCheckState,'listed_checks_passed');assert.equal(ran.checksRunCount,1);
});

test('SW-46 Status page: "Listed readiness checks passed" counts only ready modules whose checks ran and passed',()=>{
  const count=(states:unknown)=>vm.runInNewContext(pageScript()+'\nreadyChecksPassedCount(states);',{states}) as number|null;
  assert.equal(count([{status:'ready',issueAssessment:{systemCheckState:'listed_checks_passed'}},{status:'ready',issueAssessment:{systemCheckState:'unverified'}},{status:'partial'}]),1);
  assert.equal(count([{status:'ready',issueAssessment:{systemCheckState:'listed_checks_passed'}},{status:'ready'}]),null,'a ready module without a check result makes the count not established');
});

test('SW-46 Document reading: "identification or structured extraction is available" is not shown for a PDF that has neither',t=>{
  const dir=mkdtempSync(join(tmpdir(),'cmeng-sw46-read-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const state=new RuntimeProjectStore({dataDir:dir,durable:false}).getOrCreate('SW46-READ');
  const bare={documentId:'pdf-1',documentType:'other',mediaType:'application/pdf',sourceHashSha256:'sha',parserState:'pending',basisState:'candidate'} as any;
  const none=documentReadReview(bare,state);
  assert.doesNotMatch(none.note!,/is available/);
  assert.match(none.note!,/^No document identification, structured extraction or complete page-reading receipt is retained\. This does not establish/);
  const identified=documentReadReview({...bare,parserState:'identified',identification:{pageCount:3}},state);
  assert.equal(identified.note,'Document identification or structured extraction is available, but no matching complete page-reading receipt is retained. This does not establish that every page was read or that every fact was extracted.');
});

test('SW-46 Cost control: a missing source EAC, ETC or VAC is not described as retained or reconciled',()=>{
  const foundation=buildCommercialFoundation({projectId:'SW46-COST',generatedAt:'2026-09-21T12:00:00.000Z',dataDateIso:'2026-08-31',contractValue:null,contractValueCandidates:[],
    variations:[],contractTimeBasis:null,ldTerms:null,contractSections:[],amendments:[],costMetrics:[],payments:[]});
  const snapshot=(values:Record<string,number>)=>({currency:'AED',taxBasis:'exclusive' as const,asOf:'2026-08-31',state:'official' as const,values,sourceRefs:['evidence-document:COST:row:2'],diagnostics:[]});
  const build=(values:Record<string,number>)=>buildCommercialPerformance({projectId:'SW46-COST',generatedAt:'2026-09-21T12:00:00.000Z',dataDateIso:'2026-08-31',foundation,
    costSnapshots:[snapshot(values)],costMetrics:[],payments:[]} as any).costControl.positions[0] as any;
  const missing=build({bac:10_000_000,pv:5_000_000,ev:4_500_000,ac:4_800_000});
  assert.equal(missing.sourceVac.value,null);
  assert.equal(missing.sourceVac.consequence,'Source VAC is not established in this cost snapshot, so there is no reported VAC to reconcile.');
  assert.equal(missing.sourceEtc.consequence,'Source ETC is not established in this cost snapshot.');
  assert.equal(missing.sourceEac.consequence,'Source EAC is not established in this cost snapshot.');
  for(const key of ['sourceVac','sourceEtc','sourceEac'])assert.doesNotMatch(missing[key].consequence,/is retained/);
  const present=build({bac:10_000_000,pv:5_000_000,ev:4_500_000,ac:4_800_000,eac:11_000_000,etc:6_200_000,vac:-1_000_000});
  assert.equal(present.sourceVac.consequence,'Source VAC is retained and reconciled against BAC minus source EAC.');
  assert.equal(present.sourceEtc.consequence,'Source ETC is retained as a submitted forecast basis.');
  assert.equal(present.sourceEac.consequence,'Source EAC is retained separately from CMeng forecast scenarios.');
  const noBac=build({pv:5_000_000,ev:4_500_000,ac:4_800_000});
  assert.equal(noBac.bac.consequence,'BAC is not established, so the approved control budget basis is unknown.');
});

test('SW-46 Final account: closeout and handover are "clear" only when records were checked',()=>{
  const ready=(rows:unknown)=>({status:'ready',reason:null,data:rows===undefined?{}:{rows}});
  assert.deepEqual(deliveryCheckState(ready([{id:'S1'}]),'closeout'),{state:'clear',detail:'Current closeout checks passed.'});
  assert.deepEqual(deliveryCheckState(ready([]),'closeout'),{state:'unresolved',detail:'No closeout records were checked.'});
  assert.deepEqual(deliveryCheckState(ready(undefined),'handover'),{state:'unresolved',detail:'Handover check coverage is not established.'});
  assert.deepEqual(deliveryCheckState({status:'partial',reason:null,data:{rows:[]}},'handover'),{state:'open',detail:'Handover requires review.'});
  assert.deepEqual(deliveryCheckState({status:'blocked',reason:'Not usable.',data:null},'closeout'),{state:'unresolved',detail:'Not usable.'});
  // A page reason, when the page gives one, is kept as the detail; the state still needs checked records.
  assert.deepEqual(deliveryCheckState({status:'ready',reason:'Page reason.',data:{rows:[]}},'closeout'),{state:'unresolved',detail:'Page reason.'});
});

test('SW-46 Notices issue: "have passed the listed checks" only when the module checks ran; identity and counts unchanged',()=>{
  const pass={state:'pass' as const,failedCheckIds:[],checkCount:8};
  const notices=(checks:unknown)=>({key:'notices-claims',status:'partial' as const,engineState:'ready' as const,evidenceState:'partial' as const,professionalState:'review_required' as const,reason:null,dependencies:[],
    data:{systemEvidenceContract:{state:'verified_for_checked_metrics',checks},noticeEventDateMissingCount:2,challenge:{reconciliationState:'within_tolerance'}}}) as any;
  const issue=(a:any)=>a.issues.find((i:any)=>i.code==='NOTICE_TRIGGER_DATES_MISSING');
  const ran=assessModuleIssues(notices([{metric:'population',passed:true}]),pass);
  const none=assessModuleIssues(notices([]),pass);
  const unknown=assessModuleIssues(notices(undefined),pass);
  assert.equal(issue(ran).detail,'2 events have no event/awareness date. Population, claimed-day retention and assessable timing arithmetic have passed the listed checks.');
  assert.doesNotMatch(issue(none).detail,/have passed the listed checks/);
  assert.equal(issue(none).detail,'2 events have no event/awareness date. No listed calculation check is recorded for this module, so population, claimed-day retention and timing arithmetic are not verified.');
  assert.doesNotMatch(issue(unknown).detail,/have passed the listed checks/);
  assert.match(issue(unknown).detail,/listed calculation checks for this module are not established/);
  // Wording never changes identity: same member ids and the same counts in every case.
  for(const other of [none,unknown]){
    assert.deepEqual(issue(other).memberIssueIds,issue(ran).memberIssueIds);
    assert.deepEqual(other.counts,ran.counts);
    assert.deepEqual(other.issues.map((i:any)=>[i.kind,i.code]),ran.issues.map((i:any)=>[i.kind,i.code]));
  }
});
