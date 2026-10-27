import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject,managementSurfaceForProject} from '../packages/runtime-api/src/project-projections';
import {commercialFoundationForState} from '../packages/runtime-api/src/commercial-foundation-runtime';
import {crossDomainAccountability} from '../packages/runtime-api/src/accountability-intelligence';
import * as pageValues from '../packages/runtime-api/src/page-value-checks';
import {runInNewContext} from './browser-context';

// T01 round 16, owner's ABB findings (group b). Each case builds a synthetic
// project with the same shape as ABB-100 through the real upload path
// (RuntimeProjectStore.ingestEvidenceFile) and reads the real page functions.
// The ABB source files are not in the repository; no ABB value is copied in.
process.env.CMENG_OCR_ENABLED='0';

type Act={id:string;nid?:number;wbs?:number;cal?:number;name?:string;ts:string;tf:string;es?:string;ef?:string;as?:string|null;af?:string|null;status:string;pct?:number;dur?:number;rem?:number;float?:number};
// Calendars carry hours per day but no work pattern and no base calendar (as ABB:
// CALENDAR_DATA_AND_BASE_BOTH_MISSING). 'stated' names give the days per week.
function xer(projectId:string,dataDate:string,acts:Act[],calendars:'stated'|'unstated'='stated'){
 const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectId+'\t'+dataDate+' 17:00',
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\tTITAN Phase 1','%R\t11\t1\t10\tBIO\tBiologics Manufacturing Building','%R\t12\t1\t10\tLAB\tResearch Laboratory Complex',
  '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt',
  calendars==='stated'?'%R\t1\t6D Site Calendar\t10':'%R\t1\tSite Calendar\t10',calendars==='stated'?'%R\t2\t5D Office\t10':'%R\t2\tOffice\t10',
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'];
 acts.forEach((a,i)=>lines.push(['%R',a.nid??(100+i),1,a.wbs??11,a.cal??1,a.id,a.name??('Activity '+a.id),'TT_Task',a.status,a.ts+' 08:00',a.tf+' 17:00',(a.es??a.ts)+' 08:00',(a.ef??a.tf)+' 17:00',
  a.as?a.as+' 08:00':'',a.af?a.af+' 17:00':'',a.dur??100,a.rem??(a.status==='TK_Complete'?0:50),a.float??0,a.pct??0].join('\t')));
 lines.push('%E');return Buffer.from(lines.join('\n'));
}
const upload=(projectId:string,sourceFilename:string,bytes:Buffer,extra:Record<string,unknown>={})=>runtimeProjects.ingestEvidenceFile({projectId,sourceFilename,bytes,
 mediaType:sourceFilename.endsWith('.csv')?'text/csv':'text/plain',uploadedAt:'2026-10-01',...extra} as any);
async function adoptBaseline(projectId:string,summary:any){
 const state=runtimeProjects.get(projectId)!,doc=state.evidenceDocuments.find(d=>d.linkedArtifactId===summary.linkedArtifactId)!;
 runtimeProjects.reviewSchedulePurpose(projectId,summary.linkedArtifactId,{expectedVersion:state.version,sourceHash:doc.sourceHashSha256,role:'baseline',approvalReference:'APP-T01B'} as any);
 runtimeProjects.adoptSchedule(projectId,summary.linkedArtifactId);
}
const plusDays=(iso:string,days:number)=>new Date(Date.parse(iso)+days*86400000).toISOString().slice(0,10);

// ---------- Delay, notices and claims: ABB C01 / C02 / CL01 shape ----------
const claimNoticeDates=['2026-02-02','2026-03-03','2026-06-01','2026-08-20'];
async function claimsProject(){
 const id='T01B-CLAIMS-'+randomUUID().slice(0,8).toUpperCase();
 // Baseline S01: E-07567 planned to finish 18 Mar 2026; POS-1 1 Nov 2026; NEG-1 20 Oct 2026.
 const base:Act[]=[
  {id:'E-07567',name:'Electrical Activity 07567',ts:'2026-01-10',tf:'2026-03-18',status:'TK_NotStart',dur:580},
  {id:'NEG-1',name:'Structure pour',ts:'2026-09-01',tf:'2026-10-20',status:'TK_NotStart',dur:300},
  {id:'POS-1',name:'Landscape works',ts:'2026-10-01',tf:'2026-11-01',status:'TK_NotStart',dur:200},
  {id:'DONE-1',name:'Mobilisation',ts:'2026-01-01',tf:'2026-02-01',status:'TK_NotStart',dur:100},
 ];
 // Current S03 (Data Date 30 Sep 2026): E-07567 is 95% complete and its own forecast
 // finish (1 Apr 2026) is already 182 days before the Data Date; it has positive float.
 const current:Act[]=[
  {id:'E-07567',name:'Electrical Activity 07567',ts:'2026-01-10',tf:'2026-03-18',es:'2026-01-10',ef:'2026-04-01',as:'2026-01-10',status:'TK_Active',pct:95,dur:580,rem:20,float:580},
  {id:'NEG-1',name:'Structure pour',ts:'2026-09-01',tf:'2026-10-20',es:'2026-09-01',ef:'2026-10-25',as:'2026-09-01',status:'TK_Active',pct:30,dur:300,float:-40},
  {id:'POS-1',name:'Landscape works',ts:'2026-10-01',tf:'2026-11-01',es:'2026-10-01',ef:'2026-12-20',status:'TK_NotStart',dur:200,float:630},
  {id:'DONE-1',name:'Mobilisation',ts:'2026-01-01',tf:'2026-02-01',as:'2026-01-01',af:'2026-02-01',status:'TK_Complete',pct:100,dur:100},
 ];
 const baseline=await upload(id,'S01_Baseline_Rev0.xer',xer(id,'2026-01-31',base),{scheduleRole:'baseline'});
 await upload(id,'S03_Update_U02.xer',xer(id,'2026-09-30',current),{scheduleRole:'update',uploadIntent:'replace_current_basis'});
 await adoptBaseline(id,baseline);
 // ABB contract wording (C01 clauses 1.5 / 1.6; C02 clause 1.1 amending 20.2.1).
 await upload(id,'C01_Main_Contract.txt',Buffer.from(['MAIN CONTRACT C01','Conditions of Contract','Contract currency is SAR.',
  '1.5 The initial notice of claim shall be given within 28 days after the claiming party became aware, or should have become aware, of the event or circumstance.',
  '1.6 The fully detailed claim shall be submitted within 84 days after the claiming party became aware, or should have become aware, of the event or circumstance.'].join('\n')));
 await upload(id,'C02_Amendment_01.txt',Buffer.from(['AMENDMENT No. 01 TO THE MAIN CONTRACT','Effective Date: 15 July 2026',
  '1.1 Clause 20.2.1 is amended: the initial notice of claim shall be given within 14 days after the claiming party became aware of the event or circumstance.'].join('\n')));
 // ABB CL01 columns: no awareness date, no detailed-claim date, no activity column; generic event text.
 await upload(id,'CL01_Delay_EOT_Claims_Register_4_Events.csv',Buffer.from('Claim ID,Event,Notice Date,Days Claimed,Days Granted,Status,Clause,Linked Letter\n'+
  claimNoticeDates.map((d,i)=>['CLM-000'+(i+1),'Delay event 000'+(i+1),d,String(10+i),'','Submitted','20.1','LTR-000'+(i+1)].join(',')).join('\n')));
 return id;
}

test('ABB G5_DELAY-27: detailed claims use the contract 84-day rule from awareness; a missing awareness date gives only a latest possible due date, and the screen never reads 0 for unresolved deadlines',async()=>{
 const id=await claimsProject();
 const page=moduleForProject(id,'notices-claims').data as any,checks=page.decisionAnalysis.claimChecks;
 assert.equal(checks.total,4);
 assert.ok(checks.rows.every((r:any)=>r.allowedDays===84),'the contract detailed-claim period, never a fixed 42 days');
 assert.ok(checks.rows.every((r:any)=>r.dueDateIso===null),'awareness is not recorded: the exact due date stays unknown');
 for(const [i,notice] of claimNoticeDates.entries()){
  const row=checks.rows.find((r:any)=>r.claimReference==='CLM-000'+(i+1));
  assert.equal(row.latestDueDateIso,plusDays(notice,84),'awareness cannot be later than the notice, so notice + 84 days is the latest possible due date');
  assert.equal(row.detailedClaimState,plusDays(notice,84)<'2026-09-30'?'overdue_no_submission':'due_basis_missing');
  assert.doesNotMatch(row.basis,/42/);
 }
 assert.equal(checks.lateCount,3);assert.equal(checks.unresolvedDeadlineCount,1);
 // The KPI is not a known count while one deadline is unresolved; it says why.
 const html=String(runInNewContext("renderDecisionAnalysis('notices-claims',{decisionAnalysis:a})",{a:page.decisionAnalysis,escapeHtml:String,fmt:String,humanizeKey:String,planningShortDate:String,readerText:String,managementModuleLink:()=>''}));
 assert.match(html,/Late or overdue detailed submissions<\/span><strong>Not established<\/strong>/);
 assert.match(html,/3 known late or overdue; 1 of 4 deadlines are not established/);
 assert.match(html,/Latest possible due/);
 // The per-claim time bar on the claims pages carries the same bound, never a determination.
 const delay=moduleForProject(id,'delay-claims').data as any;
 const claim=delay.claimsReporting.reported.rows.find((r:any)=>r.claimId==='CLM-0001');
 assert.equal(claim.detailedClaimTimeBar.latestDueDateIso,'2026-04-27');assert.equal(claim.detailedClaimTimeBar.status,'not_established');
 assert.equal(claim.detailedClaimTimeBar.allowedDays,84);
});

test('ABB G5_DELAY-30: dated notice versions (28 days to 15 Jul 2026, 14 days from it) give the latest stated period at the Data Date, not a conflict',async()=>{
 const id=await claimsProject(),state=runtimeProjects.get(id)!;
 const terms=commercialFoundationForState(state).commercialTerms as any;
 assert.deepEqual(terms.datedTerms.filter((t:any)=>t.term==='noticePeriodDays').map((t:any)=>[t.value,t.effectiveFromIso,t.effectiveToIso,t.clauseIdentifier]),
  [[28,null,'2026-07-15',null],[14,'2026-07-15',null,'20.2.1']]);
 assert.equal(terms.noticePeriodDays.value,14);assert.equal(terms.noticePeriodDays.state,'established');
 const page=moduleForProject(id,'notices-claims').data as any;
 assert.equal(page.contractNoticePeriod.value,14);assert.equal(page.contractNoticePeriod.state,'established');
});

test('ABB G1_MANAGEMENT-17: a notice taken from the same claim row is part of that claim, so each open claim is counted once',async()=>{
 const id=await claimsProject(),p=crossDomainAccountability(runtimeProjects.get(id)!) as any;
 const group=p.ownerGroups.find((g:any)=>g.register==='claims-and-notices');
 assert.equal(group.count,4,'4 claim rows, not 4 claims + 4 notices');
 assert.equal(p.recordActions.filter((a:any)=>a.owningModule==='notices-claims').length,0);
 assert.equal(p.recordActions.filter((a:any)=>a.owningModule==='delay-claims').length,4);
 const action=p.actions.find((a:any)=>a.ownerGroupKey===group.key||a.actionId===group.groupId);
 assert.match(action.issue,/\(4 records\)/);
});

test('ABB G1_MANAGEMENT-05/43: the planning group shows the oldest source date and escalates it; it never shows that date as an action deadline',async()=>{
 const id=await claimsProject(),p=crossDomainAccountability(runtimeProjects.get(id)!) as any;
 const group=p.ownerGroups.find((g:any)=>g.register==='activity-analytics');
 const action=p.actions.find((a:any)=>a.actionId===group.groupId);
 assert.equal(action.dueIso,null);assert.equal(action.sourceDueIso,'2026-04-01');assert.equal(action.sourceOverdueDays,182);
 assert.match(action.escalation,/overdue source record/);assert.equal(group.worstOverdueDays,182);
});

test('ABB G5_DELAY-14: programme pressure ranks overdue and negative-float work first and says why; a stale forecast finish is not read as +14 d',async()=>{
 const id=await claimsProject(),delay=moduleForProject(id,'delay-claims').data as any;
 const rows=delay.delayEotEvidenceChain.programmeContext.pressureRows;
 assert.deepEqual(rows.map((r:any)=>r.activityId),['E-07567','NEG-1','POS-1']);
 const stale=rows[0];
 assert.equal(stale.varianceDays,14,'the submitted finish movement is kept');
 assert.equal(stale.finishOverdueCalendarDays,182);assert.equal(stale.varianceAtDataDateDays,196);
 assert.match(stale.pressureReason,/Forecast finish passed before the Data Date/);
 assert.equal(rows[2].pressureReason,'Later than baseline; positive float');
 const html=String(runInNewContext('renderDelayProgrammeContext(data)',{data:delay,escapeHtml:String,fmt:String,humanizeKey:String,planningShortDate:String,readerText:String,planningKpis:()=>''}));
 assert.match(html,/Why listed/);assert.match(html,/Passed 182 calendar days before the Data Date/);assert.match(html,/At least \+196 calendar days at the Data Date/);
});

test('ABB G5_DELAY-08/09: with a claims register only, event-to-activity figures are withheld with the reason, never a gap count or zero; the matcher result and AI set-up are stated',async()=>{
 const id=await claimsProject(),delay=moduleForProject(id,'delay-claims').data as any;
 assert.equal(delay.eventPopulationState,'not_established','a claim row is not a delay event (SW-15)');
 assert.equal(delay.activityLinkedEventCount,null);assert.equal(delay.activityEvidenceInsufficientEventCount,null);
 assert.equal(delay.activityCorrespondenceNoCandidateCount,4,'the generic event text names no activity, so the matcher found no candidate');
 assert.equal(delay.activityCorrespondenceAiNotConfiguredCount,4);
 const kpis:any[]=[];
 runInNewContext('renderDelayClaimsVisual(data)',{currentModuleResult:{data:delay},data:delay,escapeHtml:String,fmt:String,humanizeKey:String,planningShortDate:String,readerText:String,
  planningKpis:(rows:any[])=>{kpis.push(...rows);return '';},experienceDisclosure:(_t:string,body:string)=>body});
 const tile=(label:string)=>kpis.find(r=>r[0]===label);
 for(const label of ['Events linked to activities','Activity evidence gaps','Incomplete determination chains'])
  assert.ok(tile(label)[1]===null||tile(label)[1]==='Not established',label+' is withheld, not counted from claim rows');
 assert.match(tile('Events linked to activities')[2],/the record text names no activity CMeng could match \(4 records\)/);
 assert.match(tile('Events linked to activities')[2],/AI matching is not set up for this project/);
});

// ---------- Progress: ABB S01 / S02 / S03 shape ----------
function progressActivities(stage:'S01'|'S02'|'S03'){
 const rows:Act[]=[];
 // 10 activities wholly before the Data Date, 10 wholly after, 4 spanning it.
 for(let i=1;i<=10;i++)rows.push({id:'P'+String(i).padStart(2,'0'),ts:'2026-01-05',tf:'2026-03-01',status:stage==='S01'?'TK_NotStart':'TK_Complete',pct:stage==='S01'?0:100,as:stage==='S01'?null:'2026-01-05',af:stage==='S01'?null:'2026-03-01',dur:200,float:100});
 for(let i=1;i<=10;i++)rows.push({id:'F'+String(i).padStart(2,'0'),wbs:12,ts:'2027-01-05',tf:'2027-03-01',status:'TK_NotStart',dur:300,float:-50});
 for(let i=1;i<=4;i++)rows.push({id:'S'+i,ts:'2026-08-01',tf:'2026-11-30',status:stage==='S03'?'TK_Active':'TK_NotStart',pct:stage==='S03'?40:0,as:stage==='S03'?'2026-08-01':null,dur:400,float:0});
 // One activity ID that appears once in S01/S02 and twice in S03 (ABB TIT-00701).
 rows.push({id:'D-701',nid:900,ts:'2026-02-01',tf:'2026-04-01',status:stage==='S01'?'TK_NotStart':'TK_Active',pct:stage==='S01'?0:stage==='S02'?20:60,as:stage==='S01'?null:'2026-02-01',dur:100,float:10});
 if(stage==='S03'){
  rows.push({id:'D-701',nid:901,ts:'2026-02-01',tf:'2026-04-01',status:'TK_Active',pct:60,as:'2026-02-01',dur:100,float:10});
  for(let i=1;i<=3;i++)rows.push({id:'ADD'+i,ts:'2027-02-18',tf:'2027-04-01',status:'TK_NotStart',dur:100,float:20});
 }
 return rows;
}
async function progressProject(calendars:'stated'|'unstated'){
 const id='T01B-PROGRESS-'+calendars.toUpperCase()+'-'+randomUUID().slice(0,8).toUpperCase();
 const baseline=await upload(id,'S01_Baseline_Rev0.xer',xer(id,'2026-01-31',progressActivities('S01'),calendars),{scheduleRole:'baseline'});
 await upload(id,'S02_Update_U01.xer',xer(id,'2026-05-31',progressActivities('S02'),calendars),{scheduleRole:'update'});
 await upload(id,'S03_Update_U02.xer',xer(id,'2026-09-30',progressActivities('S03'),calendars),{scheduleRole:'update'});
 await adoptBaseline(id,baseline);
 return id;
}

test('ABB G4_PROGRESS-12/29: calendars with no work pattern still give a baseline plan and S-curve; activities wholly before or after the Data Date need no calendar',async()=>{
 const stated=await progressProject('stated');
 const report=moduleForProject(stated,'progress-report').data as any,curve=moduleForProject(stated,'progress-scurve').data as any;
 assert.equal(report.progressBases.baselinePlanned.state,'established');
 assert.equal(report.scopeComparison.comparableActivityCount,report.scopeComparison.matchedActivityCount);
 assert.equal(curve.baselineCoveragePercent,100);assert.equal(curve.currentCoveragePercent,100);
 assert.ok(curve.points.filter((p:any)=>p.dateIso.slice(0,10)<='2026-09-30').every((p:any)=>typeof p.baselinePlannedPercent==='number'));
 // No days per week stated: only the 4 activities that span the Data Date need a calendar.
 const unstated=await progressProject('unstated');
 const scope=(moduleForProject(unstated,'progress-report').data as any).scopeComparison;
 assert.equal(scope.matchedActivityCount,24);assert.equal(scope.comparableActivityCount,20,'the 20 activities wholly before or after the Data Date are comparable');
 assert.equal(scope.state,'partial');assert.equal(scope.baselinePlannedPercent,10*200*100/(10*200+10*300),'plan on the comparable activities only');
 assert.equal((moduleForProject(unstated,'progress-report').data as any).progressBases.baselinePlanned.valuePercent,null,'the whole-scope plan stays unknown while 4 spanning activities have no working-time basis');
});

test('ABB G4_PROGRESS-05: "Missing submitted values" counts every row the page lists as a missing submitted value',async()=>{
 const id=await progressProject('stated');
 for(const key of ['progress-report','resource-utilization','manhour-scurve']){
  const challenge=(moduleForProject(id,key).data as any)?.challenge;if(!challenge)continue;
  const missing=challenge.items.filter((i:any)=>i.submitted.state==='not_submitted').length;
  assert.equal(challenge.notSubmittedCount,missing,key);
 }
 const challenge=(moduleForProject(id,'progress-report').data as any).challenge;
 assert.ok(challenge.items.some((i:any)=>i.submitted.state==='not_submitted'&&i.reconciliationState==='independent_unavailable'),'the case where both sides are missing');
 assert.ok(challenge.notSubmittedCount>=1);
});

test('ABB G4_PROGRESS-24: a duplicated activity ID is ambiguous and the scope counts close on both sides',async()=>{
 const id=await progressProject('stated'),scope=(moduleForProject(id,'progress-report').data as any).scopeComparison;
 assert.equal(scope.removedActivityCount,0,'the duplicate never creates a false removed activity');
 assert.equal(scope.baselineActivityCount,scope.matchedActivityCount+scope.removedActivityCount+scope.ambiguousBaselineActivityCount);
 assert.equal(scope.currentActivityCount,scope.matchedActivityCount+scope.addedActivityCount+scope.ambiguousCurrentActivityCount);
 assert.equal(scope.ambiguousBaselineActivityCount,1);assert.equal(scope.ambiguousCurrentActivityCount,2);
 const html=String(runInNewContext('renderProgressScope(scope)',{scope,escapeHtml:String,fmt:String,humanizeKey:String,planningShortDate:String,readerText:String}));
 assert.match(html,/Baseline activities 25 = 24 matched \+ 0 removed \+ 1 with an ambiguous ID/);
 assert.match(html,/Current activities 29 = 24 matched \+ 3 added \+ 2 with an ambiguous ID/);
});

test('ABB G4_PROGRESS-20: progress since the previous update is shown on the same activities when some activities are new',async()=>{
 const id=await progressProject('stated'),report=moduleForProject(id,'progress-report').data as any;
 const since=report.progressSinceLastUpdate;
 assert.ok(since,'Progress Status carries the movement since the previous update');
 assert.equal(since.previousDataDateIso?.slice(0,10),'2026-05-31');
 assert.equal(since.matchedActivityCount,24);
 // Independent: S02 -> S03 on P01-P10, F01-F10, S1-S4 (D-701 is ambiguous; ADD1-3 are new).
 const weight=10*200+10*300+4*400,previous=10*200*100/weight,current=(10*200*100+4*400*40)/weight;
 assert.ok(Math.abs(since.matchedScopeMovementPercentagePoints-(current-previous))<1e-6);
 const area=report.areaProgress.find((r:any)=>typeof r.previousComparisonCoveragePercent==='number'&&r.previousComparisonCoveragePercent<100);
 assert.ok(area,'an area with new activities');
 assert.equal(area.scheduleProgressMovementPercentagePoints,null,'the whole-area movement still needs every activity in both updates');
 assert.equal(typeof area.matchedScopeProgressMovementPercentagePoints,'number');
 const kpis:any[]=[];
 const html=String(runInNewContext('renderProgressReportVisual(data)',{data:report,currentModuleResult:{data:report},escapeHtml:String,fmt:String,humanizeKey:String,planningShortDate:String,readerText:String,
  planningKpis:(rows:any[])=>{kpis.push(...rows);return '';}}));
 const tile=kpis.find(r=>r[0]==='Since previous update');
 assert.equal(tile[1],'+'+(current-previous).toFixed(2)+' pp');
 assert.match(tile[2],/same 24 of \d+ activities as the 2026-05-31/);
 assert.match(html,/<th>Since previous update<\/th>/);
});

test('ABB G1_MANAGEMENT-85: programme stage totals add up to the unfinished and critical counts at the Data Date',async()=>{
 const id='T01B-STAGES-'+randomUUID().slice(0,8).toUpperCase();
 // BAD-1 is marked complete in the source but its actual finish is after the Data Date (ABB invalid-date rows).
 await upload(id,'S03_Update.xer',xer(id,'2026-09-30',[
  {id:'A1',name:'Excavation works',ts:'2026-09-01',tf:'2026-10-20',as:'2026-09-01',status:'TK_Active',pct:30,float:-40},
  {id:'A2',name:'Concrete pour',ts:'2026-10-01',tf:'2026-11-01',status:'TK_NotStart',float:0},
  {id:'A3',name:'Design review',ts:'2026-10-01',tf:'2026-11-01',status:'TK_NotStart',float:50},
  {id:'BAD-1',name:'Electrical installation',ts:'2026-08-01',tf:'2026-10-10',as:'2026-08-01',af:'2026-10-15',status:'TK_Complete',pct:100,float:-10},
  {id:'DONE',name:'Mobilisation',ts:'2026-01-01',tf:'2026-02-01',as:'2026-01-01',af:'2026-02-01',status:'TK_Complete',pct:100,float:0},
 ]),{scheduleRole:'update',uploadIntent:'replace_current_basis'});
 const mcp=managementSurfaceForProject(id,'master-control-programme')!.data as any,facts=(managementSurfaceForProject(id,'master-dashboard')!.data as any).projectFacts;
 const stages=mcp.managementContext.schedule.programmeStages;
 const open=stages.reduce((n:number,s:any)=>n+s.openActivityCount,0),critical=stages.reduce((n:number,s:any)=>n+s.criticalOrNegativeFloatCount,0);
 assert.equal(open,facts.programmeQuality.remainingActivityCount);
 assert.equal(open,4);
 assert.equal(critical,facts.schedule.criticalActivityCount.value);
 assert.equal(critical,3);
});

test('ABB G1_MANAGEMENT-77: the consistency badge reads the page-value checks; a page contradiction fails it',async()=>{
 const merge=(pageValues as any).consistencyWithPageValueChecks;
 assert.equal(typeof merge,'function');
 const checks=[{metric:'Reporting Data Date',state:'passed',values:[]},{metric:'Contract completion',state:'failed',values:[{page:'milestones',value:'2029-03-01'},{page:'notices-claims',value:null}]},{metric:'Matched-scope progress gap',state:'not_comparable',values:[]}];
 const shown=merge({state:'pass',checkCount:88,failedCheckIds:[],scope:'s'},checks);
 assert.equal(shown.state,'fail');assert.equal(shown.checkCount,90);assert.deepEqual(shown.failedCheckIds,['page-value:Contract completion']);
 // Real pages: the badge on each management page counts the compared page-value checks.
 const id=await progressProject('stated');
 const quality=managementSurfaceForProject(id,'source-quality')!.data as any;
 const compared=quality.pageValueChecks.filter((c:any)=>c.state!=='not_comparable').length;
 assert.ok(compared>0);
 const badges=['master-dashboard','command-center','master-control-programme'].map(key=>(managementSurfaceForProject(id,key)!.data as any).consistency);
 assert.ok(badges.every(b=>b.checkCount===badges[0].checkCount&&b.state===badges[0].state));
 const failed=quality.pageValueChecks.filter((c:any)=>c.state==='failed').map((c:any)=>'page-value:'+c.metric);
 assert.deepEqual(badges[0].failedCheckIds.filter((x:string)=>x.startsWith('page-value:')),failed);
 if(failed.length)assert.equal(badges[0].state,'fail');
});
