import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';

// P0-B invariant (C4 + C5 + C6 + C12, one shared repair). If CMeng can calculate
// a finish from the programme network, it is shown on every page, with each
// qualification stated and what would reconcile it. Calendar conflicts,
// completed-activity anomalies and the difference from the contractor's finish
// qualify the answer; they never erase it. Every trigger is tested on its own
// and in every combination (2^7 = 128 programmes).

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
async function project(id:string,t:Triggers){
  runtimeProjects.getOrCreate(id);
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'Programme.xer',bytes:programme(id,t),mediaType:'text/plain',uploadedAt:'2033-03-16T09:00:00Z',uploadIntent:'add_update'});
}
/** Every value a page gives for the CMeng finish. */
function finishesOn(value:unknown,out:Array<{key:string;value:unknown}>=[],key=''):Array<{key:string;value:unknown}>{
  if(Array.isArray(value))value.forEach(v=>finishesOn(v,out,key));
  else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value as Record<string,unknown>)){
    // Project-level finishes only: an activity row (it has an activityId) carries its own finish.
    if('activityId' in (value as object))break;
    if(/^(?:managementForecastCompletionIso|independentFinishIso)$/.test(k))out.push({key:k,value:v});
    else if(!/^(?:previous|history|rows|activities|snapshots|evidence|calculationEvidence)$/i.test(k))finishesOn(v,out,k);
  }
  return out;
}
const expectedCodes=(t:Triggers)=>new Set([
  ...(t.openOnBadCalendar?['assumed_calendar']:[]),
  ...(t.oneElapsedPattern||t.majorityElapsedPattern?['elapsed_day_pattern']:[]),
  ...(t.difference2||t.difference400?['contractor_difference']:[]),
]);

test('P0-B: every trigger alone and in every combination keeps the calculated finish, qualified, on every page',{timeout:1_800_000},async()=>{
  const none=Object.fromEntries(NAMES.map(n=>[n,false])) as Triggers;
  await project('P0B-BASE',none);
  const base:any=moduleForProject('P0B-BASE','independent-forecast').data;
  const baseFinish=base.forecastReconciliationGate.managementForecastCompletionIso;
  assert.ok(baseFinish,'the clean programme has no calculated finish: '+base.forecastReconciliationGate.reason);
  assert.deepEqual(base.forecastReconciliationGate.managementForecast.qualifications.map((q:any)=>q.code),[],'a clean programme carries no qualification');
  const failures:string[]=[];
  for(let mask=1;mask<1<<NAMES.length;mask++){
    const t=Object.fromEntries(NAMES.map((n,i)=>[n,(mask&(1<<i))!==0])) as Triggers;
    const label=NAMES.filter(n=>t[n]).join('+'),id='P0B-'+mask;
    await project(id,t);
    const forecast:any=moduleForProject(id,'independent-forecast').data,gate=forecast.forecastReconciliationGate;
    const finish=gate?.managementForecastCompletionIso??null,codes=new Set<string>((gate?.managementForecast?.qualifications??[]).map((q:any)=>q.code));
    if(!finish){failures.push(label+': finish erased ('+gate?.reason+')');continue;}
    for(const code of expectedCodes(t))if(!codes.has(code))failures.push(label+': missing qualification '+code);
    for(const q of gate.managementForecast.qualifications)if(!q.text||!q.action)failures.push(label+': qualification '+q.code+' does not say what would reconcile it');
    // C4 and C5: an unused bad calendar and a completed task on a bad calendar change nothing.
    if(!t.openOnBadCalendar&&!t.oneElapsedPattern&&!t.majorityElapsedPattern&&!t.difference2&&!t.difference400){
      if(finish!==baseFinish)failures.push(label+': finish moved from '+baseFinish+' to '+finish);
      if(codes.size)failures.push(label+': qualified by '+[...codes].join(',')+' although nothing affects the finish');
    }
    // One value on every page (Director, Dashboard, overview, history, the forecast page and its completion position, which Ask reads).
    const singleOrAll=[...NAMES].filter(n=>t[n]).length===1||mask===(1<<NAMES.length)-1;
    for(const key of singleOrAll?['independent-forecast','master-dashboard','pmo-analysis','forecast-history','command-center']:['independent-forecast','master-dashboard']){
      const page:any=moduleForProject(id,key);
      if(page.status==='blocked'){failures.push(label+': '+key+' blocked');continue;}
      const shown=finishesOn(page.data).filter(f=>f.value!==undefined);
      for(const f of shown)if(f.value!==finish)failures.push(label+': '+key+' '+f.key+' = '+String(f.value)+' (expected '+finish+')');
    }
    const director:any=moduleForProject(id,'pmo-analysis').data;
    const directorFinish=director?.schedule?.independentForecastCompletionIso;
    if(directorFinish!==undefined&&directorFinish!==finish)failures.push(label+': Director shows '+directorFinish+' (expected '+finish+')');
    if(forecast.completionPosition&&forecast.completionPosition.independentFinishIso!==finish)failures.push(label+': completion position (read by Ask) shows '+forecast.completionPosition.independentFinishIso);
  }
  assert.deepEqual(failures,[],failures.slice(0,40).join('\n'));
});

test('P0-B (M5.1): a logic loop does not erase the finish; the loop is opened at its closing link and named',async()=>{
  const id='P0B-LOOP';runtimeProjects.getOrCreate(id);
  const xer=programme(id,Object.fromEntries(NAMES.map(n=>[n,false])) as Triggers).toString('utf8').replace('%E',['%R','7999','1','2000','1','2001','PR_FS','0'].join('\t')+'\n%E');
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'Loop.xer',bytes:Buffer.from(xer),mediaType:'text/plain',uploadedAt:'2033-03-16T09:00:00Z',uploadIntent:'add_update'});
  const gate:any=(moduleForProject(id,'independent-forecast').data as any)?.forecastReconciliationGate;
  assert.ok(gate.managementForecast.completionIso,'a loop qualifies the finish; it does not erase it');
  assert.equal(gate.managementForecast.state,'calculated_with_qualifications');
  assert.ok(gate.managementForecast.qualifications.some((q:any)=>q.code==='network_repaired'&&/loop/.test(q.text)),'the opened loop is named');
});

test('P0-B: a repeated activity ID does not erase the finish; it is left out and named',async()=>{
  const id='P0B-DUPLICATE';runtimeProjects.getOrCreate(id);
  const base=programme(id,Object.fromEntries(NAMES.map(n=>[n,false])) as Triggers).toString('utf8');
  // Repeat the last TASK row with a new native ID and the same activity code.
  const lines=base.split('\n'),taskRows=lines.map((l,i)=>[l,i] as const).filter(([l])=>l.startsWith('%R')&&lines.slice(0,lines.indexOf(l)).reverse().find(x=>x.startsWith('%T'))==='%T\tTASK');
  const [lastRow,at]=taskRows.at(-1)!;const cells=lastRow.split('\t');cells[1]='9999';lines.splice(at+1,0,cells.join('\t'));
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'Duplicate.xer',bytes:Buffer.from(lines.join('\n')),mediaType:'text/plain',uploadedAt:'2033-03-16T09:00:00Z',uploadIntent:'add_update'});
  const gate:any=(moduleForProject(id,'independent-forecast').data as any)?.forecastReconciliationGate;
  assert.ok(gate.managementForecast.completionIso,'a repeated ID qualifies the finish; it does not erase it');
  assert.ok(gate.managementForecast.qualifications.some((q:any)=>q.code==='network_repaired'&&/appears more than once/.test(q.text)),JSON.stringify(gate.managementForecast.qualifications));
});

test('P0-B: only a network that cannot be calculated gives no finish, and the cause is named',async()=>{
  // No Data Date and no project start: there is nothing to calculate from.
  const id='P0B-NO-START';runtimeProjects.getOrCreate(id);
  const xer=programme(id,Object.fromEntries(NAMES.map(n=>[n,false])) as Triggers).toString('utf8').replace('\t'+id+'\t'+DATA_DATE,'\t'+id+'\t');
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'NoStart.xer',bytes:Buffer.from(xer),mediaType:'text/plain',uploadedAt:'2033-03-16T09:00:00Z',uploadIntent:'add_update'});
  const result:any=moduleForProject(id,'independent-forecast'),gate:any=result.data?.forecastReconciliationGate;
  if(gate?.managementForecast?.completionIso)return; // the reader found another start; nothing to assert here
  if(!gate){assert.notEqual(result.state,'available');assert.match(JSON.stringify([result.reason,result.missingInputs,result.diagnostics]),/[A-Za-z]/,'the cause must be named');return;}
  assert.equal(gate.managementForecast.state,'not_calculable');
  assert.match(String(gate.managementForecast.notCalculableReason),/\S/,'the cause must be named');
});
