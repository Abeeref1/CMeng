import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {pmcScheduleRules} from '../packages/runtime-api/src/pmc-schedule-rules';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {buildForecastReconciliationGate} from '../packages/runtime-api/src/forecast-control';
import {runInNewContext} from './browser-context';
process.env.CMENG_OCR_ENABLED='0';

// Round 16, owner's ABB findings, group a (Programme changes, Forecast and Finish,
// Programme and Planning). ABB-100's own files cannot be downloaded from the live
// release, so each finding's condition is rebuilt here in a small project with the
// same shape as the ABB XER set, uploaded through the real evidence upload route:
// no task_type column (every activity type unknown), calendars with no working-time
// definition, a baseline adopted with its approval reference, activities added in
// later updates, one activity ID that appears twice in the latest update, and two
// activities that went from "not started" to "completed" with the actual finish two
// days before the actual start. Every expected value is counted by hand below.

const DAY=86_400_000;
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const at=(day:string,ms:number)=>Date.parse(day+'T00:00:00Z')+ms;
type Row={code:string;taskId:number;name:string;start:string;finish:string;actualStart?:string;actualFinish?:string;float:number;status:'TK_NotStart'|'TK_Active'|'TK_Complete'};
function xer(dataDate:string,rows:Row[],relationships:Array<[number,number]>=[]){
  const lines=['ERMHDR\t8.4\t2026-09-15\tProject Management\tR16 Test Dataset\tSAR',
    '%T\tPROJECT','%F\tproj_id\tproj_short_name\tplan_start_date\tplan_end_date\tlast_recalc_date\tproj_name',
    '%R\t1\tR16-ABB-SHAPE\t2025-12-01 08:00\t2027-06-30 17:00\t'+dataDate+' 17:00\tR16 ABB-shaped programme',
    // As in the ABB XER set: calendars named, with hours per day but no work pattern.
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_type\thours_per_day','%R\t1\t5D-10H\tCA_Project\t10',
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name\tseq_num','%R\t1\t1\t\tROOT\tR16 Works\t1',
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tact_start_date\tact_end_date\ttotal_float_hr_cnt\tphys_complete_pct\tstatus_code'];
  for(const r of rows){
    const done=r.status==='TK_Complete';
    lines.push(['%R',r.taskId,1,1,1,r.code,r.name,40,done?0:40,r.start+' 08:00',r.finish+' 17:00',r.start+' 08:00',r.finish+' 17:00',r.actualStart?r.actualStart+' 08:00':'',r.actualFinish?r.actualFinish+' 17:00':'',r.float,done?100:0,r.status].join('\t'));
  }
  lines.push('%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt');
  relationships.forEach(([succ,pred],i)=>lines.push(['%R',i+1,succ,pred,'PR_FS',0].join('\t')));
  lines.push('%E');
  return Buffer.from(lines.join('\n'));
}
const code=(i:number)=>'A'+String(i).padStart(2,'0');
// Baseline: A01..A20, one every 14 days from 5 Jan 2026, four days long.
// A01..A10 carry negative float (critical); A11..A20 positive float.
const baseStart=(i:number)=>iso(at('2026-01-05',(i-1)*14*DAY));
const baseFinish=(i:number)=>iso(at('2026-01-09',(i-1)*14*DAY));
const float=(i:number)=>i<=10?-80:400;
function s01():Row[]{return Array.from({length:20},(_,k)=>{const i=k+1;return {code:code(i),taskId:100000+i,name:'Activity '+code(i),start:baseStart(i),finish:baseFinish(i),float:float(i),status:'TK_NotStart'};});}
// S02 (Data Date 31 May 2026): A01..A04 completed on their baseline dates; A05 and
// A06 re-planned to October; every other open activity 70 days later; A21 and A22 added.
const s02Start=(i:number)=>i===5?'2026-10-05':i===6?'2026-10-12':i>20?(i===21?'2026-06-15':'2026-06-29'):iso(at(baseStart(i),70*DAY));
const s02Finish=(i:number)=>i===5?'2026-10-09':i===6?'2026-10-16':i>20?(i===21?'2026-06-19':'2026-07-03'):iso(at(baseFinish(i),70*DAY));
function s02():Row[]{return Array.from({length:22},(_,k)=>{const i=k+1;
  return i<=4?{code:code(i),taskId:100000+i,name:'Activity '+code(i),start:baseStart(i),finish:baseFinish(i),actualStart:baseStart(i),actualFinish:baseFinish(i),float:float(i),status:'TK_Complete'}
    :{code:code(i),taskId:100000+i,name:'Activity '+code(i),start:s02Start(i),finish:s02Finish(i),float:i>20?400:float(i),status:'TK_NotStart'};});}
// S03 (Data Date 30 Sep 2026): A09..A12 completed on their S02 dates; A05 and A06
// completed with actual start 20 Jul and actual finish 18 Jul (finish before start);
// open work 7 days later than S02; A23..A25 added; the A08 row now carries code A07.
function s03():Row[]{
  const rows:Row[]=[];
  for(let i=1;i<=25;i++){
    const r:Row={code:code(i),taskId:100000+i,name:'Activity '+code(i),start:'',finish:'',float:i>20?400:float(i),status:'TK_NotStart'};
    if(i<=4)Object.assign(r,{start:baseStart(i),finish:baseFinish(i),actualStart:baseStart(i),actualFinish:baseFinish(i),status:'TK_Complete'});
    else if(i===5||i===6)Object.assign(r,{start:s02Start(i),finish:s02Finish(i),actualStart:'2026-07-20',actualFinish:'2026-07-18',status:'TK_Complete'});
    else if(i>=9&&i<=12)Object.assign(r,{start:s02Start(i),finish:s02Finish(i),actualStart:s02Start(i),actualFinish:s02Finish(i),status:'TK_Complete'});
    else if(i>22)Object.assign(r,{start:'2026-11-0'+(i-20),finish:'2026-11-1'+(i-20)});
    else Object.assign(r,{start:iso(at(s02Start(i),7*DAY)),finish:iso(at(s02Finish(i),7*DAY))});
    if(i===8)r.code='A07';
    rows.push(r);
  }
  return rows;
}

let programmeProject='';
async function abbShapedProject(){
  if(programmeProject)return programmeProject;
  const projectId='R16-ABB-SHAPE-'+process.pid;
  runtimeProjects.getOrCreate(projectId);
  const upload=(name:string,bytes:Buffer,day:string)=>runtimeProjects.ingestEvidenceFile({projectId,sourceFilename:name,bytes,mediaType:'text/plain',uploadedAt:day+'T09:00:00Z',uploadIntent:'add_update'});
  await upload('S01_Baseline_Rev0_20_Activities.xer',xer('2025-12-01',s01()),'2026-10-12');
  await upload('S02_Update_U01_22_Activities_2026-05-31.xer',xer('2026-05-31',s02()),'2026-10-12');
  await upload('S03_Latest_U02_25_Activities_2026-09-30.xer',xer('2026-09-30',s03()),'2026-10-12');
  // The owner's step on ABB-100: confirm the baseline purpose with its approval reference, then adopt it.
  const state=runtimeProjects.get(projectId)!;
  const baseline=state.schedules.find(s=>/S01_Baseline/.test(s.sourceFilename??''))!;
  runtimeProjects.reviewSchedulePurpose(projectId,baseline.revision.revisionId,{expectedVersion:state.version,sourceHash:baseline.sourceHashSha256,role:'baseline',approvalReference:'R16-BL-APPROVAL'});
  runtimeProjects.adoptSchedule(projectId,baseline.revision.revisionId);
  programmeProject=projectId;
  return projectId;
}
const page=(projectId:string,key:string)=>moduleForProject(projectId,key).data as any;
const issueCodes=(data:any)=>(data.issueAssessment?.issues??[]).map((i:any)=>i.code);

test('ABB G3_CHANGES_FORECAST-26: activities added or removed between revisions are not "finish date missing" and raise no data request',async()=>{
  const id=await abbShapedProject(),data=page(id,'schedule-change-report');
  const population=data.finishMovementAnalysis.population;
  // S02 -> S03: A23, A24, A25 added; A08 removed (its row now carries code A07);
  // A07 is ambiguous on both sides (one S02 record, two S03 rows): 3 change records.
  assert.deepEqual(population.exclusionCounts,{added_in_later_revision:3,identity_ambiguous:3,removed_in_later_revision:1},JSON.stringify(population.exclusionCounts));
  assert.equal(population.exclusionCounts.unmatched_or_finish_date_missing,undefined);
  // Matched S02 records with both finishes: A01..A22 less A07 and A08 = 20.
  assert.equal(population.denominator,20);
  assert.ok(!issueCodes(data).includes('EVENT_DATES_NOT_ESTABLISHED'),'no "identify the actual event dates" request for added or removed activities: '+JSON.stringify(issueCodes(data)));
  assert.ok(!(data.issueAssessment.issues as any[]).some(i=>/lack an established/.test(i.detail)));
});

test('ABB G3_CHANGES_FORECAST-28: the largest earlier movement is reported and an actual finish before the actual start is raised',async()=>{
  const id=await abbShapedProject(),data=page(id,'schedule-change-report'),a=data.finishMovementAnalysis;
  // Later movements: open work (A13..A22) moved 7 days -> maximum +7.
  assert.equal(a.maximumDays,7);
  // Earlier movements, hand count: A05 9 Oct -> 18 Jul = -83 days; A06 16 Oct -> 18 Jul = -90 days.
  assert.equal(a.largestEarlierDays,-90);
  assert.deepEqual(a.largestEarlierRows.map((r:any)=>[r.activityId,r.movementDays,r.actualDatesInvalid]),[['A06',-90,true]]);
  assert.equal(a.earlierMovementCount,2);
  assert.deepEqual(a.invalidActualDateRows.map((r:any)=>[r.activityId,r.revision,r.actualStartIso.slice(0,10),r.actualFinishIso.slice(0,10)]),
    [['A05','current','2026-07-20','2026-07-18'],['A06','current','2026-07-20','2026-07-18']]);
  const issue=(data.issueAssessment.issues as any[]).find(i=>i.code==='ACTUAL_FINISH_BEFORE_START');
  assert.ok(issue,JSON.stringify(issueCodes(data)));
  assert.equal(issue.kind,'data_quality');
  assert.match(issue.detail,/^2 activities have an actual finish before their own actual start: A05 \(actual start 2026-07-20, actual finish 2026-07-18\); A06/);
  // The page shows both movements and names the impossible dates.
  const html=String(runInNewContext('renderRevisionMovementConcentration(a,[])',{a}));
  assert.match(html,/Largest earlier movement: -90 elapsed days/);
  assert.match(html,/A06 \(actual finish before actual start: dates need correcting\)/);
  assert.match(html,/2 activities have an actual finish before the actual start/);
  assert.match(html,/Common maximum movement: 7 elapsed days/);
});

test('ABB G3_CHANGES_FORECAST-06: Revision History and Variance Trend count the near-critical measure they cannot establish',async()=>{
  const id=await abbShapedProject();
  for(const key of ['revision-trend','variance-trends']){
    const data=page(id,key);
    // The page cannot establish near-critical work, so its review findings are not an all-clear.
    assert.ok(data.issueAssessment.counts.missing_information>=1,key+' is not an all-clear: '+JSON.stringify(data.issueAssessment.counts));
    const issue=(data.issueAssessment.issues as any[]).find(i=>i.code==='NEAR_CRITICAL_NOT_ESTABLISHED');
    assert.ok(issue,key+': '+JSON.stringify(issueCodes(data)));
    // Unfinished at S03: 25 rows less 10 completed = 15; none has a readable working calendar.
    assert.equal(data.nearCriticalScreening.nearCriticalCount,null,key);
    assert.equal(data.nearCriticalScreening.unresolvedActivityCount,15,key);
    assert.equal(data.nearCriticalScreening.unreadableCalendarActivityCount,15,key);
    assert.equal(issue.kind,'missing_information');
    assert.match(issue.detail,/^15 of 15 unfinished activities cannot be classified as near-critical or not\. 15 of them have no readable working calendar/);
    const html=String(runInNewContext('renderIssueAssessment(a,false,null)',{a:data.issueAssessment,names:{},ownsBlock:()=>true,currentModuleResult:null}));
    assert.doesNotMatch(html,/No issues identified by the listed checks/,key);
  }
});

test('ABB G3_CHANGES_FORECAST-17: a duplicated activity ID is not counted twice in the baseline comparison',async()=>{
  const id=await abbShapedProject(),data=page(id,'variance-trends');
  const latest=data.points.at(-1);
  // S03 holds 25 rows: A01..A25 without A08, plus the second A07 row.
  assert.equal(latest.sourceActivityCount,25);
  // Matched to the S01 baseline with a finish: A01..A20 less A07 (ambiguous) and A08 (gone) = 18.
  // Counting the two A07 rows against the one baseline A07 would give 20.
  assert.equal(latest.comparableActivities,18);
  assert.equal(latest.ambiguousIdentityCount,1);
  assert.equal(latest.lateActivityCount+latest.earlyActivityCount+latest.onTimeActivityCount,18);
  assert.equal(latest.unmatchedActivityCount,7);
});

test('ABB G2_PLANNING-06: BEI counts activities whose type the source does not state, with the true counts and reason',async()=>{
  const id=await abbShapedProject(),bei=page(id,'schedule-analytics').projectFacts.programmeQuality.bei;
  // Baselined to finish by 30 Sep 2026: A01..A19 less A07 (ambiguous) and A08 (gone) = 17.
  // Completed by then among them: A01..A06 and A09..A12 = 10.
  assert.equal(bei.planned,17,JSON.stringify(bei));
  assert.equal(bei.completed,10,JSON.stringify(bei));
  assert.equal(bei.untypedActivityCount,25);
  assert.match(bei.basis,/25 activities have no activity type in the source; they are counted as detail work/);
  assert.notEqual(bei.reason,'The programme has no detail tasks.');
  // Seven rows have no adopted baseline finish (A21..A25 added later and the two A07 rows),
  // so the existing rule holds the ratio back and says why.
  assert.equal(bei.value,null);
  assert.equal(bei.reason,'The adopted baseline finish is not established for 7 of 25 detail tasks.');

  // The same rule with every baseline adopted gives the ratio.
  const model=loadCertifiedDemoProject('R16-BEI-UNTYPED').schedules.at(-1)!.revision.model,sample=model.activities[0]!;
  model.dataDateIso='2031-08-31';
  const row=(activityId:string,baselineFinishIso:string,actualFinishIso:string|null)=>({...sample,activityId,activityType:'unknown' as const,status:actualFinishIso?'completed' as const:'not_started' as const,
    actualStartIso:actualFinishIso?'2031-07-01':null,actualFinishIso,baselineFinishIso,baselineDateBasis:'controlled_baseline' as const});
  model.activities=[row('U1','2031-07-10','2031-07-12'),row('U2','2031-07-20','2031-07-21'),row('U3','2031-08-10',null),row('U4','2031-08-20',null),row('U5','2031-09-20',null)];
  model.relationships=[];
  const rule=pmcScheduleRules(model);
  // Baselined by 31 Aug: U1..U4 = 4; completed: U1, U2 = 2.
  assert.deepEqual([rule.bei.completed,rule.bei.planned,rule.bei.value],[2,4,0.5]);
  // Missed tasks (DCMA 11) use the same population: U1 and U2 finished after their
  // baseline finish, U3 and U4 are due and unfinished = 4 of 4.
  assert.deepEqual([rule.checks.find(c=>c.key==='missed_tasks')!.count,rule.checks.find(c=>c.key==='missed_tasks')!.population],[4,4]);
});

test('ABB G3_CHANGES_FORECAST-44: the activity divergence check is "not established", never "passed", when nothing was compared',async()=>{
  const id=await abbShapedProject(),data=page(id,'independent-forecast');
  // P0-B (M5.1): the repeated activity ID A07 no longer stops the network, so the
  // other activities are calculated (on an assumed calendar, qualified). The check
  // must match its own population: "not established" only when nothing was compared.
  const divergence=data.forecastReconciliationGate.checks.find((c:any)=>c.key==='material_activity_divergence');
  const compared=(data.activities??[]).filter((a:any)=>a.status==='calculated'&&typeof a.finishVarianceDays==='number').length;
  if(compared===0){
    assert.equal(divergence.state,'not_established');
    assert.equal(divergence.count,null);
    assert.match(divergence.detail,/^Not tested: no activity has both a calculated finish and a submitted finish to compare\./);
  }else assert.notEqual(divergence.state,'not_established','activities were compared, so the check has a result');
  assert.ok(data.forecastReconciliationGate.managementForecast.qualifications.some((q:any)=>q.code==='network_repaired'),'the left-out repeated ID is named');
  // A real comparison still passes or fails on its own population.
  const model:any={activities:[{activityId:'A1',sourceConstraints:[]},{activityId:'A2',sourceConstraints:[]}]};
  const calculated:any={independentForecastCompletionIso:'2030-12-31',activityCoveragePercent:100,calculatedActivityCount:2,unresolvedActivityCount:0,diagnostics:[],
    activities:[{activityId:'A1',calendarMode:'source_calendar',status:'calculated',finishVarianceDays:0},{activityId:'A2',calendarMode:'source_calendar',status:'calculated',finishVarianceDays:3}]};
  assert.equal(buildForecastReconciliationGate({forecast:calculated,model,requiredFinishIso:'2030-12-31'}).checks.find(c=>c.key==='material_activity_divergence')!.state,'passed');
  const untested={...calculated,activities:calculated.activities.map((a:any)=>({...a,finishVarianceDays:null}))};
  const gate=buildForecastReconciliationGate({forecast:untested,model,requiredFinishIso:'2030-12-31'});
  assert.equal(gate.checks.find(c=>c.key==='material_activity_divergence')!.state,'not_established');
  assert.equal(gate.publishable,false,'an untested check is not a passed check');
});

test('ABB G3_CHANGES_FORECAST-31: a comparison row says the CMeng check was calculated, not that the missing submission was verified',()=>{
  const item={metric:'schedule_change_count',label:'Schedule changes disclosed',evidenceState:'verified',reconciliationState:'submitted_missing',
    submitted:{state:'not_submitted',value:null,unit:null,note:'No submitted value was identified in the available contractor evidence.'},
    independent:{state:'calculated',value:8809,unit:'changes'},gap:{state:'derived',value:null,unit:'changes',note:'The contractor has not submitted a comparable value; the independent result is still shown.'},
    consequence:'The contractor did not provide a comparable disclosure of schedule changes.',action:'Submit the contractor change narrative/register.'};
  const html=String(runInNewContext('renderUniversalChallenge(challenge)',{challenge:{submittedEvidenceState:'not_submitted',independentState:'calculated',notSubmittedCount:1,unavailableCheckCount:0,scenarioCount:0,challengedCount:1,items:[item]}}));
  const row=html.slice(html.indexOf('<tbody>'),html.indexOf('</tbody>'));
  assert.match(row,/Schedule changes disclosed<\/b><br><span class="muted">CMeng check calculated/);
  assert.doesNotMatch(row,/>Verified</);
  assert.match(row,/Not provided/);
  assert.doesNotMatch(row,/Not established changes/,'no unit after an unknown gap');
});

// G2_PLANNING-55 and -56: Look-Ahead and Construction Readiness read the same
// activities of the same programme with one readiness state and consistent gates.
function readinessXer(){
  const rows:Row[]=[
    {code:'L1',taskId:200001,name:'Look-ahead activity L1',start:'2026-10-05',finish:'2026-10-09',float:80,status:'TK_NotStart'},
    {code:'L2',taskId:200002,name:'Look-ahead activity L2',start:'2026-10-12',finish:'2026-10-16',float:80,status:'TK_NotStart'},
  ];
  return xer('2026-09-30',rows);
}
const RFI='RFI ID,Discipline,Subject,Raised Date,Required Response,Response Date,Status,Linked Activity\n'+
  // L1: an open RFI not yet due, linked to the activity: linked evidence needs confirmation.
  'RFI-0001,STR,Technical query 0001,2026-09-01,2026-10-20,,Open,L1\n'+
  // L2: a closed RFI answered before the Data Date: its linked evidence is ready.
  'RFI-0002,MEP,Technical query 0002,2026-08-01,2026-08-10,2026-08-08,Closed,L2\n';
test('ABB G2_PLANNING-55/56: Look-Ahead and Construction Readiness give the same state to the same activity, and gates add up',async()=>{
  const projectId='R16-READINESS-'+process.pid;
  runtimeProjects.getOrCreate(projectId);
  await runtimeProjects.ingestEvidenceFile({projectId,sourceFilename:'S03_Latest_Readiness.xer',bytes:readinessXer(),mediaType:'text/plain',uploadedAt:'2026-10-12T09:00:00Z',uploadIntent:'replace_current_basis'});
  await runtimeProjects.ingestEvidenceFile({projectId,sourceFilename:'RFI01_Register_2_RFIs.csv',bytes:Buffer.from(RFI),mediaType:'text/csv',uploadedAt:'2026-10-12T09:05:00Z',uploadIntent:'add_update'});
  const lookahead=page(projectId,'lookahead-schedule');
  const forward=new Map((lookahead.forwardWindowRows as any[]).map(r=>[r.activityId,r]));
  assert.deepEqual([...forward.keys()].sort(),['L1','L2'],JSON.stringify(lookahead.forwardWindowRows?.map((r:any)=>r.activityId)));
  const design=(id:string)=>(forward.get(id) as any).readiness.dimensions.find((d:any)=>d.key==='design_submittal');
  assert.equal(design('L1').state,'unknown');assert.ok(design('L1').sourceRefs.length>0,'L1 is linked to RFI-0001');
  assert.equal(design('L2').state,'ready');assert.ok(design('L2').sourceRefs.length>0,'L2 is linked to RFI-0002');
  const construction=page(projectId,'construction-readiness');
  const rows=new Map((construction.rows as any[]).map(r=>[r.activityId??r.reference,r]));
  assert.equal((rows.get('L1') as any).state,'at_risk','the Look-Ahead tab says At risk for L1');
  assert.equal((rows.get('L2') as any).state,'unknown','the Look-Ahead tab says No known linked blocker for L2');
  const metric=(label:string)=>(construction.metrics as any[]).find(m=>m.label===label)?.value;
  assert.equal(metric('At risk · known subset'),1);assert.equal(metric('Unknown readiness'),1);
  // Look-Ahead counts the same: L1 at risk; L2 no known linked blocker (its only linked
  // record is ready, so no linked evidence needs confirmation).
  assert.deepEqual([lookahead.atRiskCount,lookahead.noKnownLinkedBlockerCount],[1,1]);
  // The Look-Ahead rows on the page use the same rule (the shared function embedded in the page).
  const pageState=(id:string)=>runInNewContext('readinessReviewState(r)',{r:(forward.get(id) as any).readiness});
  assert.equal(pageState('L1'),'at_risk');
  assert.equal(pageState('L2'),'unknown');
  // G2-56: each gate is counted once. No incoming logic: the predecessor gate is N/A.
  for(const [id,ready] of [['L1',0],['L2',1]] as const){
    const r:any=rows.get(id);
    assert.equal(r.notApplicableCount,1,id);assert.equal(r.applicableCount,8,id);
    assert.equal(r.readiness.readyCount,ready,id);
    assert.equal(r.readiness.readyCount+r.readiness.unknownCount+r.readiness.blockedCount,r.applicableCount,id+': satisfied + unknown + blocked = applicable');
    assert.equal(r.readinessPercent,ready/8*100,id);
  }
});
