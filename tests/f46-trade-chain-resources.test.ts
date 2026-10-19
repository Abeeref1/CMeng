import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src';
import {canonicalResourcesFromXer} from '../packages/schedule-resource-core/src';
import {buildTradeChainResourcePosition} from '../packages/resource-utilization/src';
import {scheduleScopeClassification} from '../packages/runtime-api/src/schedule-scope-classification';
import {tradeChainGroups,tradeChainResourcesForState} from '../packages/runtime-api/src/trade-chain-resources';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F46 (D-065): a repeated plaster chain (one plot after another, Villa Type B)
// must show its remaining assigned hours per week on the activity calendar,
// the stated capacity, the shortfall per week and the completion effect.
//
// Hand calculation. Calendar C1 works Sun-Thu 07:00-12:00 and 13:00-17:00:
// 9 h a day, 45 h a week (stated by the calendar, not an 8-hour assumption).
// Data Date Sun 01 Nov 2026 07:00. Periods: 7 days from the Data Date.
// Plaster Plot B41..B46 run one week each, FS, remaining plasterer hours
// 90, 135, 90, 180, 45, 135 = 675 h. Plot B40 is complete; its stale 30 h
// remaining quantity is not demand. Capacity: programme max units 2 per hour
// x 45 h = 90 h a week.
//   week  demand capacity shortfall carried-forward
//   1       90     90       0          0
//   2      135     90      45         45
//   3       90     90       0         45
//   4      180     90      90        135
//   5       45     90       0         90
//   6      135     90      45        135
// Shortfall total 180 h; 135 h is still owed when the chain is due to finish
// (Thu 10 Dec 17:00). Week 7 clears 90 h, week 8 the last 45 h at 2 per hour
// = 22.5 working hours from Sun 20 Dec 07:00: Sun 9 + Mon 9 + Tue 4.5 ->
// Tue 22 Dec 2026 11:30. Movement: 67.5 working hours = 11 days 18.5 hours
// = 11.7708 calendar days. The chain drives completion, so completion moves
// by the same 11.7708 days.
const DAILY='(0||0(s|07:00|f|12:00)())(0||1(s|13:00|f|17:00)())';
const CALENDAR='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d<=5?DAILY:'')+'))').join('')+'))(0||Exceptions()())))';
const DEMAND=[90,135,90,180,45,135];
const day=(offset:number)=>new Date(Date.UTC(2026,10,1)+offset*86400000).toISOString().slice(0,10);
interface Options {rate?:number|null;unit?:'Hour'|'Day'}
function xer(options:Options={}){
 const rate=options.rate===undefined?2:options.rate;
 const task=(id:number,code:string,name:string,status:string,start:string,finish:string,type='TT_Task',hours=45)=>
  ['%R',id,1,'WB','C1',code,name,type,status,start,finish,status==='TK_Complete'?'':start,status==='TK_Complete'?'':finish,status==='TK_Complete'?'':start,status==='TK_Complete'?'':finish,
   status==='TK_Complete'?start:'',status==='TK_Complete'?finish:'',hours,status==='TK_Complete'?0:hours,-88,status==='TK_Complete'?100:0].join('\t');
 const plots=DEMAND.map((_,i)=>({id:101+i,code:'PL-'+(41+i),name:'Plaster Plot B'+(41+i),start:day(7*i)+' 07:00',finish:day(7*i+4)+' 17:00'}));
 const lines=['ERMHDR\t23.12',
  '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tVTB\t2026-11-01 07:00',
  '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\tC1\tSun-Thu 9h\t9\t45\t'+CALENDAR,
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\tW0\t1\t\tROOT\tVilla Community','%R\tWB\t1\tW0\tVTB\tVilla Type B',
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\trestart_date\treend_date\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct',
  task(100,'PL-40','Plaster Plot B40','TK_Complete','2026-10-25 07:00','2026-10-29 17:00'),
  ...plots.map(p=>task(p.id,p.code,p.name,'TK_NotStart',p.start,p.finish)),
  task(107,'MEP-46','MEP first fix Plot B46','TK_NotStart',day(42)+' 07:00',day(46)+' 17:00'),
  task(108,'BW-42','Plaster boundary wall Plot B42','TK_NotStart',day(0)+' 07:00',day(1)+' 17:00','TT_Task',18),
  task(109,'PC-01','Practical completion','TK_NotStart',day(46)+' 17:00',day(46)+' 17:00','TT_FinMile',0),
  '%T\tACTVTYPE','%F\tactv_code_type_id\tactv_code_type','%R\tT1\tTrade',
  '%T\tACTVCODE','%F\tactv_code_id\tactv_code_type_id\tshort_name\tactv_code_name','%R\tC-PL\tT1\tPLASTER\tPlastering','%R\tC-MEP\tT1\tMEP\tMEP works',
  '%T\tTASKACTV','%F\ttask_id\tactv_code_type_id\tactv_code_id\tproj_id',
  ...[100,...plots.map(p=>p.id),108].map(id=>['%R',id,'T1','C-PL',1].join('\t')),['%R',107,'T1','C-MEP',1].join('\t'),
  '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\tpred_proj_id',
  ...[[100,101],[101,102],[102,103],[103,104],[104,105],[105,106],[106,107],[108,107],[107,109]].map(([pre,post],i)=>['%R',i+1,post,pre,'PR_FS',0,1,1].join('\t')),
  '%T\tUMEASURE','%F\tunit_id\tunit_name\tunit_abbrev\tseq_num','%R\t500\t'+(options.unit??'Hour')+'\t'+(options.unit==='Day'?'d':'hr')+'\t1',
  '%T\tRSRC','%F\trsrc_id\tparent_rsrc_id\tclndr_id\trsrc_short_name\trsrc_name\trsrc_type\tunit_id\tcost_qty_type','%R\tR1\t\tC1\tPLAST\tPlasterer gang\tRT_Labor\t500\tQT_Hour',
  ...(rate===null?[]:['%T\tRSRCRATE','%F\trsrc_rate_id\trsrc_id\tstart_date\tmax_qty_per_hr','%R\t1\tR1\t2026-01-01 00:00\t'+rate]),
  '%T\tTASKRSRC','%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trsrc_type\ttarget_qty\tact_reg_qty\tact_ot_qty\tremain_qty\ttotal_qty\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\trestart_date\treend_date',
  ['%R','AR100',1,100,'R1','RT_Labor',90,90,0,30,120,'2026-10-25 07:00','2026-10-29 17:00','2026-10-25 07:00','2026-10-29 17:00','',''].join('\t'),
  ...plots.map((p,i)=>['%R','AR'+p.id,1,p.id,'R1','RT_Labor',DEMAND[i],0,0,DEMAND[i],DEMAND[i],p.start,p.finish,'','',p.start,p.finish].join('\t')),
  ['%R','AR108',1,108,'R1','RT_Labor',18,0,0,18,18,day(0)+' 07:00',day(1)+' 17:00','','',day(0)+' 07:00',day(1)+' 17:00'].join('\t'),
  '%E'];
 return Buffer.from(lines.join('\n'));
}
function models(options:Options={}){
 const parsed=parseXerBytes(xer(options));
 const schedule=canonicalScheduleFromXer(parsed,{sourceRevisionId:'F46',projectId:'VTB'});
 const resources=canonicalResourcesFromXer(parsed,{sourceRevisionId:'F46',projectId:'VTB'});
 return {schedule,resources,groups:tradeChainGroups(scheduleScopeClassification(schedule).rows)};
}
const CHAIN=['PL-40','PL-41','PL-42','PL-43','PL-44','PL-45','PL-46'];
const weekStart=(i:number)=>day(7*i)+'T07:00:00.000Z';

test('F46 a 6-plot plaster chain with stated programme capacity gives the exact weekly shortfall and completion effect',()=>{
 const {schedule,resources,groups}=models();
 const position=buildTradeChainResourcePosition(schedule,resources,{groups,drivingActivityIds:[...CHAIN.slice(1),'MEP-46','PC-01'],drivingPathBasis:'test driving path'});
 assert.equal(position.chainCount,1,'the unlinked boundary wall and the MEP successor are not a second chain');
 const chain=position.chains[0]!;
 assert.equal(chain.trade,'PLASTER');assert.equal(chain.tradeSource,'From activity code: Trade');
 assert.deepEqual(chain.activityIds,CHAIN,'same trade, joined by logic, one plot after another');
 assert.deepEqual(chain.openActivityIds,CHAIN.slice(1));
 assert.deepEqual(chain.locations,['Plot B40','Plot B41','Plot B42','Plot B43','Plot B44','Plot B45','Plot B46']);
 assert.equal(chain.remainingHours,675,'the completed plot\'s stale 30 h is not remaining demand');
 const row=chain.resources[0]!;
 assert.equal(chain.resources.length,1);assert.equal(row.resourceId,'R1');assert.equal(row.capacitySource,'programme_max_units');
 assert.equal(row.capacityUnitsPerHour,2);
 assert.deepEqual(row.periods.map(p=>[p.periodStartIso,p.demandHours,p.capacityHours,p.shortfallHours,p.backlogHours]),[
  [weekStart(0),90,90,0,0],[weekStart(1),135,90,45,45],[weekStart(2),90,90,0,45],
  [weekStart(3),180,90,90,135],[weekStart(4),45,90,0,90],[weekStart(5),135,90,45,135]]);
 assert.deepEqual(row.periods.map(p=>p.otherDemandHours),[18,0,0,0,0,0],'the same gang on the boundary wall is shown, not added to the chain');
 assert.equal(row.totalShortfallHours,180);assert.equal(row.peakShortfallHours,90);assert.equal(row.firstShortfallPeriodIso,weekStart(1));
 assert.equal(row.scheduledFinishIso,'2026-12-10T17:00:00.000Z');
 assert.equal(row.resourceLimitedFinishIso,'2026-12-22T11:30:00.000Z');
 assert.equal(row.finishMovementWorkingHours,67.5);assert.equal(row.finishMovementCalendarDays,11.7708);
 assert.equal(chain.onDrivingPath,true);assert.equal(chain.totalShortfallHours,180);assert.equal(chain.state,'established');
 assert.deepEqual({...chain.completionEffect,basis:undefined},{state:'established',chainFinishIso:'2026-12-10T17:00:00.000Z',resourceLimitedFinishIso:'2026-12-22T11:30:00.000Z',
  completionDelayCalendarDays:11.7708,completionDelayWorkingHours:67.5,basis:undefined,reasons:[]});
 const off=buildTradeChainResourcePosition(schedule,resources,{groups,drivingActivityIds:['BW-42'],drivingPathBasis:'test'}).chains[0]!;
 assert.equal(off.onDrivingPath,false);assert.equal(off.completionEffect.state,'not_on_driving_path');assert.equal(off.completionEffect.completionDelayCalendarDays,null);
 assert.equal(off.completionEffect.resourceLimitedFinishIso,'2026-12-22T11:30:00.000Z','the chain\'s own finish movement is still shown');
 const unknown=buildTradeChainResourcePosition(schedule,resources,{groups,drivingActivityIds:null,drivingPathBasis:'test'}).chains[0]!;
 assert.equal(unknown.onDrivingPath,null);assert.equal(unknown.completionEffect.state,'not_established');
 assert.deepEqual(unknown.completionEffect.reasons,['DRIVING_PATH_NOT_ESTABLISHED']);
});

test('F46 register weekly capacity is used before the programme rate; weeks it does not state stay not established',()=>{
 const {schedule,resources,groups}=models();
 const register=(weeks:number)=>Array.from({length:weeks},(_,i)=>({resourceId:'PLAST',resourceName:'Plasterer gang',weekStartIso:day(7*i),capacityHours:90,authority:'stated_not_approved' as const,sourceRef:'evidence-document:REG:row:'+(i+1)}));
 const full=buildTradeChainResourcePosition(schedule,resources,{groups,drivingActivityIds:CHAIN,drivingPathBasis:'test',registerCapacity:register(8)}).chains[0]!;
 const row=full.resources[0]!;
 assert.equal(row.capacitySource,'resource_register');assert.match(row.capacityLabel,/stated in the register, not approved/);
 assert.deepEqual(row.periods.map(p=>[p.periodStartIso.slice(0,10),p.demandHours,p.capacityHours,p.shortfallHours]),
  [[day(0),90,90,0],[day(7),135,90,45],[day(14),90,90,0],[day(21),180,90,90],[day(28),45,90,0],[day(35),135,90,45]]);
 assert.equal(row.resourceLimitedFinishIso,'2026-12-22T11:30:00.000Z');assert.equal(full.completionEffect.completionDelayCalendarDays,11.7708);
 const short=buildTradeChainResourcePosition(schedule,resources,{groups,drivingActivityIds:CHAIN,drivingPathBasis:'test',registerCapacity:register(6)}).chains[0]!;
 assert.equal(short.resources[0]!.totalShortfallHours,180,'the six stated weeks still give the shortfall');
 assert.equal(short.resources[0]!.resourceLimitedFinishIso,null);
 assert.ok(short.resources[0]!.reasons.includes('REGISTER_CAPACITY_NOT_STATED_FOR_WEEK:R1:2026-12-13'));
 assert.equal(short.completionEffect.state,'not_established');
});

test('F46 unknown capacity or a non-hour unit stays not established with the reason, never 0 or an 8-hour day',()=>{
 const none=models({rate:null});
 const chain=buildTradeChainResourcePosition(none.schedule,none.resources,{groups:none.groups,drivingActivityIds:CHAIN,drivingPathBasis:'test'}).chains[0]!;
 assert.equal(chain.remainingHours,675,'assigned hours are still totalled');
 assert.ok(chain.resources[0]!.periods.every(p=>p.capacityHours===null&&p.shortfallHours===null));
 assert.equal(chain.resources[0]!.totalShortfallHours,null);
 assert.ok(chain.reasons.includes('CAPACITY_NOT_STATED:R1'));assert.equal(chain.state,'not_established');
 assert.equal(chain.completionEffect.state,'not_established');
 const days=models({unit:'Day'});
 const dayChain=buildTradeChainResourcePosition(days.schedule,days.resources,{groups:days.groups,drivingActivityIds:CHAIN,drivingPathBasis:'test'}).chains[0]!;
 assert.equal(dayChain.remainingHours,null);assert.equal(dayChain.resources.length,0);
 assert.ok(dayChain.reasons.some(r=>r.startsWith('RESOURCE_UNIT_NOT_HOURS:R1:')),'day quantities are never converted with an assumed day length');
 assert.equal(dayChain.state,'not_established');
});

function renderPanel(tc:unknown):string{
 const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
 const parsed=createSourceFile('cmeng-screen.js',script,ScriptTarget.Latest,true);
 const names=['tradeChainReason','renderTradeChainPanel'];
 const code=parsed.statements.filter(isFunctionDeclaration).filter(n=>names.includes(n.name?.text??'')).map(n=>n.getText(parsed)).join('\n');
 const text=(v:unknown)=>String(v??'');
 return vm.runInNewContext(code+'\nrenderTradeChainPanel(tc);',{tc,escapeHtml:text,fmt:text,planningShortDate:(v:unknown)=>String(v??'').slice(0,10),
  managementPanel:(title:string,description:string,body:string)=>title+' | '+description+' | '+body}) as string;
}

test('F46 the Resources page and the project facts show the same plaster-chain calculation from the uploaded programme',async()=>{
 const id='F46-TRADE-CHAIN';
 await runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'Villa Type B.xer',bytes:xer(),mediaType:'text/plain',uploadedAt:'2026-11-02',role:'update',uploadIntent:'replace_current_basis'});
 const state=runtimeProjects.get(id)!;
 const position=tradeChainResourcesForState(state);
 assert.equal(position.chainCount,1);
 const chain=position.chains[0]!;
 assert.deepEqual(chain.activityIds,CHAIN);
 assert.equal(chain.onDrivingPath,true,'the independent CPM driving network runs through the plaster chain');
 assert.equal(chain.resources[0]!.totalShortfallHours,180);
 assert.equal(chain.completionEffect.state,'established');assert.equal(chain.completionEffect.completionDelayCalendarDays,11.7708);
 const page=moduleForProject(id,'resource-utilization').data as any;
 assert.deepEqual(page.tradeChains.chains,position.chains,'the page carries the shared calculation');
 const facts=projectFactsForState(state).resources!.tradeChains;
 assert.equal(facts.chainCount,1);
 assert.deepEqual([facts.chains[0]!.trade,facts.chains[0]!.remainingHours,facts.chains[0]!.totalShortfallHours,facts.chains[0]!.resources[0]!.peakShortfallHours,facts.chains[0]!.completionEffect.completionDelayCalendarDays],
  ['PLASTER',675,180,90,11.7708]);
 assert.deepEqual(page.projectFacts.resources.tradeChains,facts,'one snapshot for the page and the facts');
 const html=renderPanel(page.tradeChains);
 assert.match(html,/Repeated trade chains: hours against capacity/);
 assert.match(html,/PLASTER<\/b> · From activity code: Trade · 7 activities \(PL-40 to PL-46\) across 7 locations · Driving path: Yes/);
 assert.match(html,/Remaining assigned hours: <b>675 h<\/b> · Shortfall: <b>180 h<\/b> · Completion later by 11\.7708 calendar days \(chain finish 2026-12-10 to 2026-12-22\)/);
 assert.match(html,/<td>R1<\/td><td>2026-11-29<\/td><td>45 h<\/td><td>90 h<\/td><td>0 h<\/td><td>0 h<\/td><td>90 h<\/td>/);
 const empty=renderPanel({state:'not_established',reason:'PROGRAMME_LABOUR_HOUR_ASSIGNMENTS_NOT_SUPPLIED',chains:[]});
 assert.match(empty,/Trade-chain hours are not established: the programme has no labour-hour resource assignments\./);
});

// The register path on the uploaded project follows the shared register
// capacity rule: a register with no approval column states the capacity
// (used, labelled stated, not approved); a register whose approval column does
// not say approved is not used, and the programme max units apply instead.
function register(dir:string,id:string,approval:string|null){
 const head='resource id,resource name,week start,available capacity,planned demand,unit'+(approval?',capacity approval':'');
 const rows=Array.from({length:8},(_,i)=>['PLAST','Plasterer gang',day(7*i),90,0,'labor_hour',...(approval?[approval]:[])].join(','));
 const bytes=Buffer.from([head,...rows].join('\n')+'\n'),storedPath=join(dir,id+'.csv');writeFileSync(storedPath,bytes);
 return {documentId:id,sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),storedPath,sourceFilename:'resource_'+id+'.csv',mediaType:'text/csv',
  basisState:'active',linkedArtifactId:null,uploadedAt:'2026-11-02',familyKey:'family-'+id,documentType:'resource_register',parserState:'parsed',
  identification:{needsReview:false},lineage:{needsReview:false},supersededByDocumentId:null} as any;
}
test('F46 on the uploaded project the resource register capacity follows the shared stated-capacity rule',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'f46-register-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 for(const [suffix,approval,source,label] of [['STATED',null,'resource_register',/stated in the register, not approved/],['PENDING','Pending','programme_max_units',/Programme resource max units/]] as const){
  const id='F46-REGISTER-'+suffix;
  await runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'Villa Type B.xer',bytes:xer(),mediaType:'text/plain',uploadedAt:'2026-11-02',role:'update',uploadIntent:'replace_current_basis'});
  const state=runtimeProjects.get(id)!;
  state.evidenceDocuments.push(register(dir,'reg-'+suffix.toLowerCase(),approval));runtimeProjects.touch(state);
  const row=tradeChainResourcesForState(state).chains[0]!.resources[0]!;
  assert.equal(row.capacitySource,source);assert.match(row.capacityLabel,label);
  assert.deepEqual(row.periods.map(p=>[p.demandHours,p.capacityHours,p.shortfallHours]),[[90,90,0],[135,90,45],[90,90,0],[180,90,90],[45,90,0],[135,90,45]]);
  assert.equal(row.resourceLimitedFinishIso,'2026-12-22T11:30:00.000Z');
  const page=moduleForProject(id,'resource-utilization').data as any;
  assert.equal(page.tradeChains.chains[0].resources[0].capacitySource,source,'the page shows the same capacity basis');
 }
});
