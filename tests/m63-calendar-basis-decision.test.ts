import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeProjects,RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {moduleForProject,projectActionRegisterForState} from '../packages/runtime-api/src/project-projections';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {scheduleCriticalityFacts} from '../packages/runtime-api/src/schedule-criticality-facts';

// M6.3 invariant: ONE governed planner decision on the calendar basis, applied by
// ONE accessor, read by every forecast consumer. Without a decision CMeng's
// finish stays visible and qualified; CMeng never chooses a calendar.

type Triggers={unusedBadCalendar:boolean;openOnBadCalendar:boolean;completedOnBadCalendar:boolean;
  oneElapsedPattern:boolean;majorityElapsedPattern:boolean;difference2:boolean;difference400:boolean};
const NAMES=['unusedBadCalendar','openOnBadCalendar','completedOnBadCalendar','oneElapsedPattern','majorityElapsedPattern','difference2','difference400'] as const;
const DATA_DATE='2033-03-15'; // a Tuesday
const day=(iso:string,days:number)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};

function fiveDayCalendar(){
  const intervals=[['08:00','12:00'],['13:00','17:00']].map(([s,e],i)=>'(0||'+i+'(s|'+s+'|f|'+e+')())').join('');
  const days=[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d>=2&&d<=6?intervals:'')+'))').join('');
  return '(0||CalendarData()((0||DaysOfWeek()('+days+'))(0||Exceptions()())))'.replaceAll('(0||','\x7f\x7f  (0||');
}
/** A programme with completed history, an open chain and the chosen triggers. */
function programme(projectId:string,t:Triggers){
  const calendars=[['C1','Five Day 8h','8','40',fiveDayCalendar()]];
  const needsBad=t.openOnBadCalendar||t.completedOnBadCalendar;
  if(needsBad)calendars.push(['C2','Site shorthand','8','48','Sat-Thu']);
  if(t.unusedBadCalendar)calendars.push(['C3','Unused shorthand','8','48','6D-8H']);
  const tasks:string[][]=[];
  // Six completed tasks. A patterned one spans Thursday to Tuesday (5 elapsed days)
  // with 40 h of duration: calendar days x 8 h, not the 24 working hours between.
  const patterned=t.majorityElapsedPattern?5:t.oneElapsedPattern?1:0;
  for(let k=0;k<6;k++){
    const pattern=k<patterned,monday=day('2033-01-03',7*k);
    const start=pattern?day(monday,3):monday,finish=pattern?day(monday,8):day(monday,4);
    tasks.push([String(1000+k),'DONE-'+(k+1),'Completed works '+(k+1),'TT_Task','TK_Complete',
      t.completedOnBadCalendar&&k===5?'C2':'C1',start,finish,start,finish,pattern?'40':'32','0',start,finish]);
  }
  for(let i=0;i<12;i++){
    // The finish milestone sits at its predecessor's finish, as P6 submits it.
    const last=i===11,start=last?day(DATA_DATE,76):day(DATA_DATE,i*7),finish=last?day(DATA_DATE,76):day(DATA_DATE,i*7+6);
    const extra=i===5?(t.difference400?2400:t.difference2?16:0):0;
    tasks.push([String(2000+i),last?'MS-FINISH':'ACT-'+(100+i),last?'Project Completion':'Works package '+(i+1),last?'TT_FinMile':'TT_Task','TK_NotStart',
      t.openOnBadCalendar&&i===3?'C2':'C1',last?finish:start,finish,last?finish:start,finish,last?'0':String(40+extra),last?'0':String(40+extra),'',''] as string[]);
  }
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectId+'\t'+DATA_DATE,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\tMain Works',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',...calendars.map(c=>['%R',...c].join('\t')),
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\tclndr_id\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tact_start_date\tact_end_date',
    ...tasks.map(([id,code,name,type,status,cal,ts,te,es,ee,dur,rem,as,ae])=>['%R',id,'1','10',code,name,type,status,cal,ts,te,es,ee,dur,rem,as,ae].join('\t')),
    '%T\tTASKPRED','%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt'];
  const order=tasks.map(row=>row[0]!);
  for(let i=1;i<order.length;i++)lines.push(['%R',String(7000+i),'1',order[i],'1',order[i-1],'PR_FS','0'].join('\t'));
  lines.push('%E');
  return Buffer.from(lines.join('\n'),'utf8');
}

const ALL_OFF=Object.fromEntries(NAMES.map(n=>[n,false])) as Triggers;
async function ingest(store:{ingestEvidenceFile:typeof runtimeProjects.ingestEvidenceFile},id:string,xer:string,name='Programme.xer',at='2033-03-16T09:00:00Z'){
  await store.ingestEvidenceFile({projectId:id,sourceFilename:name,bytes:Buffer.from(xer),mediaType:'text/plain',uploadedAt:at,uploadIntent:'add_update'});
}
const gateOf=(id:string)=>(moduleForProject(id,'independent-forecast').data as any).forecastReconciliationGate;
const published=(id:string)=>{const w=projectActionRegisterForState(runtimeProjects.getOrCreate(id)).workflow;return {actions:w.actions,information:w.information};};
const decide=(id:string,key:string,choice:string,fingerprint:string)=>{
  const state=runtimeProjects.getOrCreate(id);
  state.controls.reviewDecisions={...(state.controls.reviewDecisions??{}),[key]:{choice,sourceFingerprint:fingerprint,confirmedAt:'2033-03-17T09:00:00Z',sourceRefs:[]} as any};
  state.version++;
};
/** Every place that shows CMeng's finish for the current programme. */
function finishesEverywhere(id:string){
  const state=runtimeProjects.getOrCreate(id);
  const gate=gateOf(id);
  const history=(moduleForProject(id,'forecast-history').data as any);
  const control=projectControlSchedule(state)!;
  const snapshots=JSON.stringify(history);
  const crit=scheduleCriticalityFacts(state).independentForecast as any;
  const item=published(id).actions.concat(published(id).information).find(a=>a.id==='matter:forecast-qualifications');
  return {gate:gate.managementForecast.completionIso?.slice(0,10),basis:gate.managementForecast.calendarBasis,qualifications:gate.managementForecast.qualifications.map((q:any)=>q.code),
    criticality:(crit?.calculatedCompletionIso??crit?.independentForecastCompletionIso)?.slice(0,10)??null,
    historyHasFinish:snapshots.includes(String(gate.managementForecast.completionIso).slice(0,10)),
    controlDecision:control.revision.model.calendarBasisDecision?.durationBasis??null,
    forecastItemTitle:item?.title??null};
}

test('M6.3: the duration basis is one planner decision read by every forecast consumer; no decision keeps the qualified finish',async()=>{
  const id='M63-BASIS';runtimeProjects.getOrCreate(id);
  await ingest(runtimeProjects,id,programme(id,{...ALL_OFF,majorityElapsedPattern:true}).toString('utf8'));
  // (1) Before: finish shown and qualified; one published question.
  const before=finishesEverywhere(id);
  assert.ok(before.gate,'the finish stays visible');
  assert.ok(before.qualifications.includes('elapsed_day_pattern'));
  assert.equal(before.basis.source,'programme');
  const ask=published(id).actions.filter(a=>a.id==='matter:calendar-basis');
  assert.equal(ask.length,1,'asked once in the published Project Review');
  assert.equal(ask[0]!.target.reviewChoice,null,'CMeng does not pre-fill a calendar basis');
  // (2) Calendar days: every consumer shows the same recalculated finish and the planner basis.
  decide(id,'calendar-basis','calendar_days',ask[0]!.reviewFingerprint!);
  const calendarDays=finishesEverywhere(id);
  assert.notEqual(calendarDays.gate,before.gate,'the confirmed basis changes the calculation');
  assert.equal(calendarDays.basis.source,'planner_confirmed');assert.equal(calendarDays.basis.durationBasis,'calendar_days');
  assert.ok(!calendarDays.qualifications.includes('elapsed_day_pattern'),'the pattern is answered');
  assert.equal(calendarDays.controlDecision,'calendar_days','the shared accessor carries the decision');
  assert.equal(calendarDays.criticality,calendarDays.gate,'criticality facts use the same forecast');
  assert.ok(calendarDays.historyHasFinish,'forecast history shows the same finish');
  assert.ok(!calendarDays.forecastItemTitle||calendarDays.forecastItemTitle.includes(calendarDays.gate!),'the forecast item names the same finish');
  assert.ok(published(id).information.some(a=>a.id==='matter:calendar-basis'),'decided: reachable to change, not asked again');
  assert.ok(!published(id).actions.some(a=>a.id==='matter:calendar-basis'));
  // (3) Working days: the original calculation, now planner-confirmed.
  decide(id,'calendar-basis','working_days',ask[0]!.reviewFingerprint!);
  const workingDays=finishesEverywhere(id);
  assert.equal(workingDays.gate,before.gate,'working days keep CMeng\'s calculation');
  assert.equal(workingDays.basis.source,'planner_confirmed');assert.ok(!workingDays.qualifications.includes('elapsed_day_pattern'));
  // (4) A new revision with changed calendars makes the decision stale: asked again, finish back to qualified.
  const changed=programme(id,{...ALL_OFF,majorityElapsedPattern:true,unusedBadCalendar:true}).toString('utf8').replace('\t'+id+'\t'+DATA_DATE,'\t'+id+'\t2033-03-22');
  await ingest(runtimeProjects,id,changed,'Programme_2.xer','2033-03-23T09:00:00Z');
  const stale=finishesEverywhere(id);
  assert.equal(stale.basis.source,'programme','a decision on other calendars is not applied');
  assert.ok(published(id).actions.some(a=>a.id==='matter:calendar-basis'),'asked again');
});

test('M6.3: a 6D-8H calendar: the known part is stated, the planner chooses the working week, every consumer recalculates',async()=>{
  const id='M63-SHORT';runtimeProjects.getOrCreate(id);
  const xer=programme(id,ALL_OFF).toString('utf8')
    .replace("%R\tC1\tFive Day 8h","%R\tC3\tSix by eight\t8\t48\t6D-8H\n%R\tC1\tFive Day 8h")
    .replace(/(%R\t2003\t1\t10\tACT-103\t[^\t]*\tTT_Task\tTK_NotStart\t)C1/,'$1C3');
  await ingest(runtimeProjects,id,xer);
  const ask=published(id).actions.find(a=>a.id==='matter:calendar-pattern:C3');
  assert.ok(ask,'one item for the calendar');
  assert.match(ask!.reason,/6 working days of 8 h/,'the known part is stated');
  assert.equal(ask!.target.reviewChoice,null,'the working week is the planner\'s choice');
  const before=gateOf(id).managementForecast;
  decide(id,'calendar-pattern:C3',ask!.target.reviewOptions![0]!.value,ask!.reviewFingerprint!);
  const after=gateOf(id).managementForecast;
  assert.equal(after.calendarBasis.source,'planner_confirmed');
  assert.ok(after.completionIso,'the finish is calculated on the chosen week');
  console.log('M63 6D-8H before',before.completionIso,before.qualifications.map((q:any)=>q.code).join(','),'after',after.completionIso,after.qualifications.map((q:any)=>q.code).join(','));
  assert.ok(before.qualifications.some((q:any)=>q.code==='assumed_calendar'),'before: the unread calendar is an assumption, named');
  assert.ok(!after.qualifications.some((q:any)=>q.code==='assumed_calendar'),'after: the planner\'s week replaces the assumption');
  assert.notEqual(after.completionIso,before.completionIso,'the chosen week changes the calculation');
  assert.ok(published(id).information.some(a=>a.id==='matter:calendar-pattern:C3'));
});

test('M6.3: the decision survives a restart',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'m63-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const id='M63-RESTART';
  const first=new RuntimeProjectStore({dataDir:dir,durable:true});first.getOrCreate(id);
  await ingest(first as any,id,programme(id,{...ALL_OFF,majorityElapsedPattern:true}).toString('utf8'));
  const {calendarBasisFingerprint}=await import('../packages/runtime-api/src/calendar-basis');
  const stored=first.getOrCreate(id).schedules.at(-1)!;
  first.updateControls(id,{reviewDecisions:{'calendar-basis':{choice:'calendar_days',sourceFingerprint:calendarBasisFingerprint(stored.revision.model),confirmedAt:'2033-03-17T09:00:00Z',sourceRefs:[]}}} as any);
  await (first as any).flush?.();
  const second=new RuntimeProjectStore({dataDir:dir,durable:true});
  const reloaded=second.get(id)!;
  assert.ok(reloaded,'the project reloads');
  assert.equal(projectControlSchedule(reloaded)?.revision.model.calendarBasisDecision?.durationBasis,'calendar_days','the decision is applied after restart');
});
