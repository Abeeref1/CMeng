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

// The real page functions, taken from the built page script by name.
const PAGE_FUNCTIONS=['conditionalNotice','knownScreenCount','screenCountText',
  'resourcePerHourNotAssessableNote','manhourUnitNote','manhourActualMissingNote',
  'renderResourceVisual','renderManhourVisual'];
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
    planningKpis:()=>'',moduleEvidenceGate:()=>'',renderLineChart:()=>'',renderResourceBasisReview:()=>'',moduleBarList:()=>'',
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
