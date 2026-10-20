import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {countUnit} from '../packages/runtime-api/src/count-text';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {recoveryAccelerationIntelligence} from '../packages/runtime-api/src/recovery-acceleration';
import {tradeChainResourcesForState} from '../packages/runtime-api/src/trade-chain-resources';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F29 (D-079/D-097/D-099/D-180): best-available analyses instead of
// all-or-nothing. The consultant's case: a -88 h plaster chain on Villa Type B,
// one plot after another, with plasterers stated on the programme but no BOQ
// quantity or productivity linked. The Recovery page showed "crew acceleration
// candidates 0" and Challenge the Contract did not show the chain feasibility.
//
// Programme (same hand calculation as tests/f46-trade-chain-resources.test.ts):
// calendar C1 Sun-Thu 07:00-12:00 and 13:00-17:00, 9 h a day, 45 h a week.
// Data Date Sun 01 Nov 2026 07:00. Plaster Plot B41..B46 run one week each,
// remaining plasterer hours 90, 135, 90, 180, 45, 135 = 675 h; programme max
// units 2 per hour x 45 h = 90 h a week; shortfall 180 h; completion moves by
// 11.7708 calendar days. Plot B40 is complete. MEP first fix Plot B46 follows
// the chain and drives practical completion.
const DAILY='(0||0(s|07:00|f|12:00)())(0||1(s|13:00|f|17:00)())';
const CALENDAR='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d<=5?DAILY:'')+'))').join('')+'))(0||Exceptions()())))';
const DEMAND=[90,135,90,180,45,135];
const day=(offset:number)=>new Date(Date.UTC(2026,10,1)+offset*86400000).toISOString().slice(0,10);
interface Options {lagHours?:number;mepLabour?:boolean}
function xer(options:Options={}){
 const lag=options.lagHours??0;
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
  // Plot-to-plot links carry the stated lag; the chain to MEP and completion has none.
  ...[[100,101],[101,102],[102,103],[103,104],[104,105],[105,106]].map(([pre,post],i)=>['%R',i+1,post,pre,'PR_FS',lag,1,1].join('\t')),
  ...[[106,107],[108,107],[107,109]].map(([pre,post],i)=>['%R',i+7,post,pre,'PR_FS',0,1,1].join('\t')),
  '%T\tUMEASURE','%F\tunit_id\tunit_name\tunit_abbrev\tseq_num','%R\t500\tHour\thr\t1',
  '%T\tRSRC','%F\trsrc_id\tparent_rsrc_id\tclndr_id\trsrc_short_name\trsrc_name\trsrc_type\tunit_id\tcost_qty_type','%R\tR1\t\tC1\tPLAST\tPlasterer gang\tRT_Labor\t500\tQT_Hour',
  ...(options.mepLabour?['%R\tR2\t\tC1\tMEPF\tMEP fitter\tRT_Labor\t500\tQT_Hour']:[]),
  '%T\tRSRCRATE','%F\trsrc_rate_id\trsrc_id\tstart_date\tmax_qty_per_hr','%R\t1\tR1\t2026-01-01 00:00\t2',
  '%T\tTASKRSRC','%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trsrc_type\ttarget_qty\tact_reg_qty\tact_ot_qty\tremain_qty\ttotal_qty\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\trestart_date\treend_date',
  ['%R','AR100',1,100,'R1','RT_Labor',90,90,0,30,120,'2026-10-25 07:00','2026-10-29 17:00','2026-10-25 07:00','2026-10-29 17:00','',''].join('\t'),
  ...plots.map((p,i)=>['%R','AR'+p.id,1,p.id,'R1','RT_Labor',DEMAND[i],0,0,DEMAND[i],DEMAND[i],p.start,p.finish,'','',p.start,p.finish].join('\t')),
  ['%R','AR108',1,108,'R1','RT_Labor',18,0,0,18,18,day(0)+' 07:00',day(1)+' 17:00','','',day(0)+' 07:00',day(1)+' 17:00'].join('\t'),
  ...(options.mepLabour?[['%R','AR107',1,107,'R2','RT_Labor',45,0,0,45,45,day(42)+' 07:00',day(46)+' 17:00','','',day(42)+' 07:00',day(46)+' 17:00'].join('\t')]:[]),
  '%E'];
 return Buffer.from(lines.join('\n'));
}
async function upload(id:string,options:Options={}){
 await runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'Villa Type B.xer',bytes:xer(options),mediaType:'text/plain',uploadedAt:'2026-11-02',role:'update',uploadIntent:'replace_current_basis'});
 return runtimeProjects.get(id)!;
}
const OPEN=['PL-41','PL-42','PL-43','PL-44','PL-45','PL-46'];
const NEW_IDS=/^(trade-chain-crew|driving-resource-crew):/;

function browserFunctions(names:string[]){
 const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
 const parsed=createSourceFile('cmeng-screen.js',script,ScriptTarget.Latest,true);
 const found=parsed.statements.filter(isFunctionDeclaration).filter(n=>names.includes(n.name?.text??''));
 assert.equal(found.length,names.length,'browser functions present: '+names.join(', '));
 return {script,code:found.map(n=>n.getText(parsed)).join('\n')};
}
const text=(v:unknown)=>String(v??'');
const context={escapeHtml:text,fmt:text,countUnit,humanizeKey:(v:unknown)=>String(v??'').replace(/_/g,' '),planningShortDate:(v:unknown)=>String(v??'').slice(0,10),
 managementPanel:(title:string,description:string,body:string)=>title+' | '+description+' | '+body};

test('F29 a plaster chain with partial crew data still gives a crew candidate with its basis and the inputs that limit it',async()=>{
 // A one-day lag between plots: the chain is joined by programme logic but is
 // not a zero-lag finish-to-start crew sequence, and no BOQ productivity is held.
 const state=await upload('F29-HELD-LAG',{lagHours:9,mepLabour:true});
 const chain=tradeChainResourcesForState(state).chains[0]!;
 assert.equal(chain.trade,'PLASTER');assert.equal(chain.onDrivingPath,true,'the plaster chain drives completion');
 const result=recoveryAccelerationIntelligence(state);
 assert.equal(result.eligibility.knownCrewAccelerationCandidateCount,0,'no crew need is calculable without quantity and productivity');
 // Read untyped so the probe on the unfixed base compiles and fails on the values.
 const held:any=(result as any).heldDataCandidates;
 assert.equal(held?.state,'generated');
 const plaster=held.candidates.find((c:any)=>c.basisSource==='trade_chain')!;
 assert.ok(plaster,'the trade chain gives a candidate');
 assert.equal(plaster.candidateId,'trade-chain-crew:'+chain.chainId);
 assert.equal(plaster.trade,'PLASTER');assert.equal(plaster.type,'additional_crew');assert.equal(plaster.state,'option_requires_assumption');
 assert.deepEqual(plaster.affectedActivities,OPEN);assert.equal(plaster.activityCount,6);
 assert.equal(plaster.remainingHours,675);assert.equal(plaster.shortfallHours,chain.totalShortfallHours);
 assert.deepEqual(plaster.resourceIds,['R1']);
 assert.ok(plaster.held.some((line:string)=>/Remaining assigned hours on the chain: 675 h/.test(line)),'the basis states the held hours');
 assert.deepEqual(plaster.limitingInputs.map((l:any)=>l.code),['ADDED_CREW_NOT_STATED','PRODUCTIVITY_NOT_LINKED','CREW_LINKS_NOT_CONFIRMED'],'capacity is stated (programme max units); crew size and productivity are not');
 // Never invented: no gain, days, cost or CPM change.
 for(const c of held.candidates){
  assert.equal(c.possibleDaysRecovered,null);assert.equal(c.completionGainWorkingDays,null);assert.equal((c as any).estimatedCost,undefined);assert.equal((c as any).cpmChange,undefined);
  assert.match(c.completionGainBasis,/does not assume them/);
 }
 const mep=held.candidates.find((c:any)=>c.basisSource==='stated_labour_resource')!;
 assert.equal(mep.candidateId,'driving-resource-crew:R2');assert.deepEqual(mep.affectedActivities,['MEP-46']);assert.equal(mep.remainingHours,45);
 assert.deepEqual(mep.limitingInputs.map((l:any)=>l.code),['ADDED_CREW_NOT_STATED','PRODUCTIVITY_NOT_LINKED']);
 assert.deepEqual(held.crewOptionCounts,{calculatedNeed:0,sequentialChain:0,tradeChain:1,statedResource:1});
 assert.equal(held.crewCandidateTotal,2);
 assert.equal(held.uncoveredDrivingActivityCount,0);
 // The existing scenario population and every count derived from it are untouched.
 assert.ok(result.scenarios.every(s=>!NEW_IDS.test(s.scenarioId)),'candidates are not added to the scenarios');
 assert.equal(result.recoveryOptionCount,result.scenarios.filter(s=>s.pathRole==='recovery_option').length);
 assert.equal(result.calculatedScenarioCount,result.scenarios.filter(s=>s.pathRole==='recovery_option'&&typeof s.completionGainWorkingDays==='number').length);
 // The page carries the same candidates and shows them with the inputs that limit them.
 const page=moduleForProject('F29-HELD-LAG','recovery-acceleration').data as any;
 assert.deepEqual(page.heldDataCandidates,JSON.parse(JSON.stringify(held)));
 const {code}=browserFunctions(['recoveryHeldDataPanel']);
 const html=vm.runInNewContext(code+'\nrecoveryHeldDataPanel(h);',{...context,h:page.heldDataCandidates}) as string;
 assert.match(html,/Crew candidates from the data held: 2<\/b> · 0 from crew need · 0 second-crew sequences on the path to completion · 1 trade chains · 1 stated labour resources/);
 assert.match(html,/<b>PLASTER · 7 locations<\/b>/);
 assert.match(html,/6 \(PL-41 to PL-46\)/);
 assert.match(html,/Size and availability of the added crew are not stated in the data held/);
 assert.match(html,/Inputs that limit the rest:<\/b> .*Quantity and labour-hours per unit are not linked to every activity, so productivity is not established \(2 candidates\)/);
});

test('F29 a zero-lag one-crew plaster sequence counts as a crew candidate and is not repeated as a trade-chain candidate',async()=>{
 const state=await upload('F29-HELD-FS0');
 const result=recoveryAccelerationIntelligence(state),held:any=(result as any).heldDataCandidates;
 assert.ok(held,'held-data crew candidates are reported');
 const sequence=result.scenarios.filter(s=>s.scenarioId.startsWith('plot-crews:'));
 const covered=new Set(result.scenarios.filter(s=>s.type==='additional_crew').flatMap(s=>s.affectedActivities));
 for(const c of held.candidates)for(const id of c.affectedActivities as string[])assert.ok(!covered.has(id),id+' is not offered twice');
 assert.ok((held.crewCandidateTotal??0)>0,'the driving plaster chain never shows zero crew candidates: '+JSON.stringify({sequence:sequence.map(s=>[s.scenarioId,s.pathRole]),held:held.crewOptionCounts}));
 assert.equal(held.crewCandidateTotal,held.crewOptionCounts.calculatedNeed+held.crewOptionCounts.sequentialChain+held.crewOptionCounts.tradeChain+held.crewOptionCounts.statedResource);
 assert.equal(held.crewOptionCounts.sequentialChain,sequence.filter(s=>s.pathRole==='recovery_option').length);
});

test('F29 Challenge the Contract shows the plaster-chain feasibility from the shared trade-chain calculation',async()=>{
 await upload('F29-CHALLENGE');
 const page=moduleForProject('F29-CHALLENGE','challenge-contract').data as any;
 const chains=page.projectFacts.resources.tradeChains;
 assert.equal(chains.chainCount,1);
 const chain=chains.chains[0];
 assert.deepEqual([chain.trade,chain.activityCount,chain.openActivityCount,chain.onDrivingPath,chain.remainingHours,chain.totalShortfallHours,chain.completionEffect.completionDelayCalendarDays],
  ['PLASTER',7,6,true,675,180,11.7708]);
 const {script,code}=browserFunctions(['tradeChainReason','renderDrivingChainFeasibility']);
 const html=vm.runInNewContext(code+'\nrenderDrivingChainFeasibility(tc);',{...context,tc:chains}) as string;
 assert.match(html,/^Driving-chain feasibility: trade chains against stated capacity/);
 assert.match(html,/PLASTER<\/b> · From activity code: Trade · 7 activities \(PL-40 to PL-46\), 6 open, across 7 locations · Driving path: Yes/);
 assert.match(html,/Remaining assigned hours: <b>675 h<\/b> · Shortfall: <b>180 h<\/b> · Not feasible at the stated capacity: completion later by 11\.7708 calendar days \(chain finish 2026-12-10 to 2026-12-22\)/);
 assert.match(html,/<td>R1 · Plasterer gang<\/td><td>675 h<\/td><td>programme max units<\/td><td>180 h<\/td><td>90 h \(first short week 2026-11-08\)<\/td>/);
 // The page renderer inserts it on Challenge the Contract.
 assert.match(script,/==='challenge-contract'&&result\.data\?\.projectFacts\?\.resources\?\.tradeChains\)container\.insertAdjacentHTML\('beforeend',renderDrivingChainFeasibility\(result\.data\.projectFacts\.resources\.tradeChains\)\)/);
 const empty=vm.runInNewContext(code+'\nrenderDrivingChainFeasibility(tc);',{...context,tc:{state:'not_established',reason:'PROGRAMME_LABOUR_HOUR_ASSIGNMENTS_NOT_SUPPLIED',chains:[]}}) as string;
 assert.match(empty,/Trade-chain feasibility is not established: the programme has no labour-hour resource assignments\./);
});
