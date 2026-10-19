import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {weeklyResourceCapacityEvidence} from '../packages/runtime-api/src/canonical-resource-evidence';
import {weeklyResourceCapacityEvidence as supportWeekly} from '../packages/runtime-api/src/resource-support-evidence';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {runInNewContext} from './browser-context';

// F16 (D-011, D-158) and F45 earned hours (D-240/D-250), consultant case REEM:
// the weekly labour register "Resource ID, Resource Name, Unit, Week Start, Available Capacity,
// Planned Demand, Actual Approved Usage" holds actual usage through the Data Date and planned hours
// after it, yet Resources showed recorded hours "Unresolved", the Look-Ahead resources column had
// no hours for any activity, and the Man-hour page had no earned hours.
//
// Test project (uploaded through the real upload path): Villa Type B, Data Date Thu 10 Sep 2026.
// Programme labour resources 7001 Mason, 7002 Plasterer, 7003 Painter (P6 unit hour); the register
// uses another ID scheme (LAB-001 Mason, LAB-002 Plasterer), so trades link by unique trade name.
// Register weeks (Sunday starts) 16 Aug .. 25 Oct 2026. Recorded hours stop at the 30 Aug week; the
// 6 Sep week (it holds the Data Date) has no recorded value yet.
//
// Hand calculation
//  Recorded hours by trade and week to the Data Date (weeks 16 Aug, 23 Aug, 30 Aug, 6 Sep):
//   Mason      planned 150,150,160,150   recorded 140,150,160,(none) -> 450 h in 3 of 4 weeks, latest 30 Aug 160 h
//   Plasterer  planned   0,  0, 20, 40   recorded   0,  0, 20,(none) ->  20 h in 3 of 4 weeks, latest 30 Aug  20 h
//   Total 470 h in 6 of 8 trade-weeks; the 6 Sep week is not recorded (never 0), so the full total stays unknown.
//  Look-ahead window 10 Sep + 42 days = 22 Oct 2026; register weeks starting in it: 13 Sep .. 18 Oct (6 weeks).
//   Mason planned 100+0+0+0+0+0 = 100 h;  Plasterer 150+150+150+150+0+0 = 600 h.
//   A-110 Blockwork B42 (Mason, 200 h remaining): 100 h planned in window, last recorded 160 h (week of 30 Aug).
//   A-120 / A-130 Plaster (Plasterer, 300 h remaining each): 600 h planned in window, last recorded 20 h.
//   A-140 Paint (Painter): no register record for the trade -> not recorded, with the reason.
//   A-150 Snagging: no labour assignment -> stated.
//  Earned hours (programme assignments, budgeted units x activity % complete):
//   A-100 400 h x 100% (finished) + A-110 400 h x 50% + A-120 300 x 0 + A-130 300 x 0 + A-140 120 x 0
//   = 400 + 200 = 600 h earned of 1,520 h budgeted (39.4737%).
//   Hours spent (programme act_reg + act_ot): 420 + 0 + 180 + 10 = 610 h. Earned / spent = 600 / 610 = 0.9836.

const DAILY='(0||0(s|07:00|f|12:00)())(0||1(s|13:00|f|17:00)())';
const CALENDAR='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d<=5?DAILY:'')+'))').join('')+'))(0||Exceptions()())))';
function xer(options:{assignments?:boolean}={}){
 const task=(id:number,code:string,name:string,status:string,start:string,finish:string,pct:number,hours:number)=>['%R',id,1,'WB','C1',code,name,'TT_Task',status,start,finish,
  status==='TK_Complete'?'':start,status==='TK_Complete'?'':finish,status==='TK_Complete'?'':start,status==='TK_Complete'?'':finish,
  status!=='TK_NotStart'?start:'',status==='TK_Complete'?finish:'',hours,status==='TK_Complete'?0:Math.round(hours*(1-pct/100)),0,pct].join('\t');
 const assign=(id:number,taskId:number,rsrc:string,target:number,reg:number,ot:number,remain:number,start:string,finish:string)=>
  ['%R','AR'+id,1,taskId,rsrc,'RT_Labor',target,reg,ot,remain,reg+ot+remain,start,finish,'','',start,finish].join('\t');
 const lines=['ERMHDR\t23.12',
  '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tVTB\t2026-09-10 07:00',
  '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\tC1\tSun-Thu 9h\t9\t45\t'+CALENDAR,
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\tW0\t1\t\tROOT\tVilla Community','%R\tWB\t1\tW0\tVTB\tVilla Type B',
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\trestart_date\treend_date\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct',
  task(100,'A-100','Blockwork Plot B41','TK_Complete','2026-08-16 07:00','2026-08-27 17:00',100,90),
  task(110,'A-110','Blockwork Plot B42','TK_Active','2026-08-30 07:00','2026-09-17 17:00',50,135),
  task(120,'A-120','Plaster Plot B41','TK_NotStart','2026-09-13 07:00','2026-09-24 17:00',0,90),
  task(130,'A-130','Plaster Plot B42','TK_NotStart','2026-09-27 07:00','2026-10-08 17:00',0,90),
  task(140,'A-140','Paint Plot B41','TK_NotStart','2026-10-11 07:00','2026-10-15 17:00',0,45),
  task(150,'A-150','Snagging Plot B41','TK_NotStart','2026-10-18 07:00','2026-10-19 17:00',0,18),
  '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\tpred_proj_id',
  ...[[100,110],[110,120],[120,130],[130,140],[140,150]].map(([pre,post],i)=>['%R',i+1,post,pre,'PR_FS',0,1,1].join('\t')),
  '%T\tUMEASURE','%F\tunit_id\tunit_name\tunit_abbrev\tseq_num','%R\t500\tHour\thr\t1',
  '%T\tRSRC','%F\trsrc_id\tparent_rsrc_id\tclndr_id\trsrc_short_name\trsrc_name\trsrc_type\tunit_id\tcost_qty_type',
  '%R\tR1\t\tC1\t7001\tMason\tRT_Labor\t500\tQT_Hour','%R\tR2\t\tC1\t7002\tPlasterer\tRT_Labor\t500\tQT_Hour','%R\tR3\t\tC1\t7003\tPainter\tRT_Labor\t500\tQT_Hour',
  ...(options.assignments===false?[]:[
  '%T\tTASKRSRC','%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trsrc_type\ttarget_qty\tact_reg_qty\tact_ot_qty\tremain_qty\ttotal_qty\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\trestart_date\treend_date',
  assign(100,100,'R1',400,420,0,0,'2026-08-16 07:00','2026-08-27 17:00'),
  assign(110,110,'R1',400,180,10,200,'2026-08-30 07:00','2026-09-17 17:00'),
  assign(120,120,'R2',300,0,0,300,'2026-09-13 07:00','2026-09-24 17:00'),
  assign(130,130,'R2',300,0,0,300,'2026-09-27 07:00','2026-10-08 17:00'),
  assign(140,140,'R3',120,0,0,120,'2026-10-11 07:00','2026-10-15 17:00')]),
  '%E'];
 return Buffer.from(lines.join('\n'));
}
const WEEKS=['2026-08-16','2026-08-23','2026-08-30','2026-09-06','2026-09-13','2026-09-20','2026-09-27','2026-10-04','2026-10-11','2026-10-18','2026-10-25'];
const TRADES=[
 {id:'LAB-001',name:'Mason',capacity:180,plan:[150,150,160,150,100,0,0,0,0,0,0],actual:[140,150,160]},
 {id:'LAB-002',name:'Plasterer',capacity:160,plan:[0,0,20,40,150,150,150,150,0,0,0],actual:[0,0,20]},
];
/** The consultant's register heading, one row per trade and week. */
function weekRowsRegister(){
 const rows=['Resource ID,Resource Name,Unit,Week Start,Available Capacity,Planned Demand,Actual Approved Usage'];
 WEEKS.forEach((week,i)=>{for(const t of TRADES)rows.push([t.id,t.name,'labor_hour',week,t.capacity,t.plan[i],t.actual[i]??''].join(','));});
 return rows.join('\n')+'\n';
}
/** The same register, one column per week, with the measure stated on each row. */
function weekColumnsRegister(){
 const rows=['Resource ID,Resource Name,Unit,Measure,'+WEEKS.join(',')];
 for(const t of TRADES){
  rows.push([t.id,t.name,'labor_hour','Available Capacity',...WEEKS.map(()=>t.capacity)].join(','));
  rows.push([t.id,t.name,'labor_hour','Planned Demand',...t.plan].join(','));
  rows.push([t.id,t.name,'labor_hour','Actual Approved Usage',...WEEKS.map((_,i)=>t.actual[i]??'')].join(','));
 }
 return rows.join('\n')+'\n';
}
async function uploadProject(register:string|null,options:{assignments?:boolean}={}){
 // Project codes are stored upper case; the programme carries the same code.
 const id='F16-REEM-'+randomUUID().slice(0,8).toUpperCase();
 await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'Villa Type B.xer',bytes:xer(options),mediaType:'text/plain',uploadedAt:'2026-09-11',uploadIntent:'replace_current_basis'});
 if(register!==null)await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'Weekly_Labour_Register.csv',bytes:Buffer.from(register),mediaType:'text/csv',uploadedAt:'2026-09-11'});
 return id;
}
const lookAhead=(id:string)=>{const d=moduleForProject(id,'lookahead-schedule').data as any;return d?.result?.projectionKey==='lookahead_schedule'?d.result:d;};
const rowOf=(p:any,activityId:string)=>(p.forwardWindowRows??p.rows).find((r:any)=>r.activityId===activityId);
const withoutRefs=(value:any)=>JSON.parse(JSON.stringify(value,(k,v)=>/^(?:sourceRef|sourceRefs|registerSourceRefs)$/.test(k)?undefined:v));
const text=(v:unknown)=>String(v??'');

test('F16 Resources: recorded hours by trade and week are read from the REEM register heading; the blank Data-Date week stays not recorded',async()=>{
 const id=await uploadProject(weekRowsRegister());
 const page=moduleForProject(id,'resource-utilization').data as any;
 const tw=page.actualHoursByTradeWeek;
 assert.ok(tw,'the Resources page carries actual hours by trade and week');
 assert.equal(tw.dataDateIso,'2026-09-10');
 assert.deepEqual(tw.shownWeekStarts,['2026-08-16','2026-08-23','2026-08-30','2026-09-06']);
 assert.equal(tw.state,'partial');
 assert.equal(tw.recordedHours,470);assert.equal(tw.recordedResourceWeekCount,6);assert.equal(tw.resourceWeekCountToDataDate,8);assert.equal(tw.notRecordedResourceWeekCount,2);
 assert.equal(tw.latestRecordedWeekIso,'2026-08-30');
 assert.match(tw.reason,/Recorded hours are stated for 6 of 8 labour resource-weeks/);
 const mason=tw.trades.find((t:any)=>t.resourceName==='Mason');
 assert.deepEqual([mason.resourceId,mason.recordedHours,mason.recordedWeekCount,mason.weekCountToDataDate,mason.plannedHoursToDataDate,mason.latestRecorded.weekStartIso,mason.latestRecorded.hours],
  ['LAB-001',450,3,4,610,'2026-08-30',160]);
 assert.deepEqual(mason.notRecordedWeekStarts,['2026-09-06']);
 assert.deepEqual(mason.weeks.map((w:any)=>[w.weekStartIso,w.plannedHours,w.recordedHours]),
  [['2026-08-16',150,140],['2026-08-23',150,150],['2026-08-30',160,160],['2026-09-06',150,null]],'a blank week is not recorded, never 0');
 const plaster=tw.trades.find((t:any)=>t.resourceName==='Plasterer');
 assert.deepEqual([plaster.recordedHours,plaster.recordedWeekCount,plaster.latestRecorded.hours,plaster.plannedHoursToDataDate],[20,3,20,60]);
 // The strict register total stays unknown (one week is not recorded); the recorded weeks are now stated beside it.
 const weekly=page.basisComparison.weekly;
 assert.equal(weekly.actualHoursToDate,null);
 assert.deepEqual([weekly.recordedHoursInRecordedWeeks,weekly.recordedResourceWeekCount,weekly.resourceWeekCountThroughDataDate,weekly.latestRecordedWeekIso],[470,6,8,'2026-08-30']);
 // The page shows them.
 const ctx={p:{rows:[],perHourCapacityBasedResourceCount:0,capacityCoveragePercent:null,actualHoursByTradeWeek:tw},projectionFor:(v:unknown)=>v,escapeHtml:text,fmt:text,humanizeKey:text,planningShortDate:text,resourceUnitLabel:text,
  planningKpis:()=>'',renderLineChart:()=>'',renderResourceBasisReview:()=>'',moduleBarList:()=>'',moduleEvidenceGate:()=>'',
  experienceDisclosure:(...a:unknown[])=>a.filter(x=>typeof x==='string').join(' '),managementPanel:(...a:unknown[])=>a.filter(x=>typeof x==='string').join(' | '),
  renderVisualPanel:(...a:unknown[])=>a.filter(x=>typeof x==='string').join(' '),visualSection:(...a:unknown[])=>a.filter(x=>typeof x==='string').join(' ')};
 const html=runInNewContext('renderResourceVisual(p)',ctx) as string;
 assert.match(html,/Recorded hours by trade and week/);
 assert.match(html,/Recorded hours to the Data Date: 470 h in 6 of 8 trade-weeks; latest recorded week 2026-08-30\./);
 assert.match(html,/<b>Mason<\/b><br><small>LAB-001<\/small><\/td><td>450 h \(3 of 4 weeks\)<\/td><td>160 h · 2026-08-30<\/td><td>150 \/ 140<\/td><td>150 \/ 150<\/td><td>160 \/ 160<\/td><td>150 \/ not recorded<\/td>/);
 const review=runInNewContext('renderResourceBasisReview(b)',{b:page.basisComparison,escapeHtml:text,fmt:text,planningShortDate:text}) as string;
 assert.match(review,/<td>Weekly labor register<\/td><td>1370<\/td><td>470 h in 6 of 8 trade-weeks; the other weeks are not recorded<\/td>/,'recorded hours are no longer "Unresolved"');
});

test('F16 Look-Ahead: the resources column gives each activity its trade hours in the window and the latest recorded hours, from the shared reader',async()=>{
 const id=await uploadProject(weekRowsRegister());
 const p=lookAhead(id);
 // Each look-ahead activity names its trades and its own remaining programme hours.
 assert.deepEqual(rowOf(p,'A-110').resourceHours,[{resourceId:'R1',trade:'Mason',activityRemainingHours:200}]);
 for(const a of ['A-120','A-130'])assert.deepEqual(rowOf(p,a).resourceHours,[{resourceId:'R2',trade:'Plasterer',activityRemainingHours:300}]);
 assert.deepEqual(rowOf(p,'A-140').resourceHours,[{resourceId:'R3',trade:'Painter',activityRemainingHours:120}]);
 assert.equal(rowOf(p,'A-150').resourceHours,undefined,'no labour assignment: nothing per row');
 assert.equal(p.resourceHoursNoAssignmentReason,'The programme assigns no labour resource to this activity.');
 // Each trade states once its planned register hours in the window and its latest recorded week, or why not.
 const trade=(name:string)=>p.sourceResourceTrades.find((t:any)=>t.trade===name);
 const figures=(name:string)=>{const t=trade(name);return [t.matchedRegisterResourceId,t.capacityUnitsComparable,t.registerPeriodCount,t.registerPlannedDemand,t.registerAvailableCapacity,t.registerActualToDate,
  t.registerLatestRecorded&&[t.registerLatestRecorded.weekStartIso,t.registerLatestRecorded.hours],t.registerPlannedReason,t.registerActualReason];};
 // The programme hour unit and the register labour-hour unit are both hours.
 assert.deepEqual(figures('Mason'),['LAB-001',true,6,100,1080,null,['2026-08-30',160],null,null]);
 assert.deepEqual(figures('Plasterer'),['LAB-002',true,6,600,960,null,['2026-08-30',20],null,null]);
 const none='No weekly resource register record matches this trade by resource ID or a unique trade name.';
 assert.deepEqual(figures('Painter'),[null,false,0,null,null,null,null,none,none]);
 assert.ok(trade('Mason').registerLatestRecorded.sourceRef.includes(':row:'),'the recorded week is cited');
 // The same figures as the Resources page (one shared reader).
 const tw=(moduleForProject(id,'resource-utilization').data as any).actualHoursByTradeWeek;
 assert.equal(tw.trades.find((t:any)=>t.resourceId==='LAB-001').latestRecorded.hours,trade('Mason').registerLatestRecorded.hours);
 // The page shows them in the Resources column.
 const ctx={p,currentModuleResult:null,responsePopulationRoot:null,responsePopulationIndex:new WeakMap(),responseRowPopulationIndex:new WeakMap(),
  projectionFor:(v:unknown)=>v,escapeHtml:text,fmt:text,planningShortDate:text,humanizeKey:text,planningStateLabel:text,
  planningKpis:()=>'',experienceDisclosure:()=>'',moduleBarList:()=>'',planningLookAheadTimeline:()=>'',planningStatusBand:()=>'',planningLookAheadBlockers:()=>'',
  managementPanel:(title:string,description:string,content:string)=>'<section><h4>'+title+'</h4>'+description+content+'</section>'};
 const html=runInNewContext('renderLookAheadVisual(p)',ctx) as string;
 assert.match(html,/<small class="resource-hours">Mason: 100 h planned in window · last recorded 160 h \(week of 2026-08-30\)<\/small>/);
 assert.match(html,/<small class="resource-hours">Plasterer: 600 h planned in window · last recorded 20 h \(week of 2026-08-30\)<\/small>/);
 assert.match(html,/<small class="resource-hours">Painter: window plan not established · not recorded<\/small>/);
 assert.match(html,/Not recorded: No weekly resource register record matches this trade by resource ID or a unique trade name\./);
 assert.match(html,/<small class="resource-hours">No labour assigned<\/small>/);
 assert.match(html,/this activity: 200 h remaining/);
 assert.match(html,/Last recorded 160 h \(week of 2026-08-30\)/,'the trades panel gives the latest recorded week');
});

test('F16 a week-column register (one column per week, measure on each row) gives the same hours on both pages',async()=>{
 const rowsId=await uploadProject(weekRowsRegister()),columnsId=await uploadProject(weekColumnsRegister());
 const trades=(id:string)=>withoutRefs((moduleForProject(id,'resource-utilization').data as any).actualHoursByTradeWeek);
 const wide=trades(columnsId);
 assert.equal(wide.recordedHours,470);
 assert.deepEqual(wide,trades(rowsId));
 const hours=(id:string)=>{const p=lookAhead(id);return {rows:['A-110','A-120','A-140','A-150'].map(a=>rowOf(p,a).resourceHours??null),trades:withoutRefs(p.sourceResourceTrades)};};
 assert.equal(hours(columnsId).trades.find((t:any)=>t.trade==='Mason').registerPlannedDemand,100);
 assert.deepEqual(hours(columnsId),hours(rowsId));
 assert.ok(lookAhead(columnsId).sourceResourceTrades.find((t:any)=>t.trade==='Mason').registerLatestRecorded.sourceRef.includes(':column:'),'the cell is cited by row and week column');
});

function stored(dir:string,id:string,body:string){
 const bytes=Buffer.from(body),storedPath=join(dir,id+'.csv');writeFileSync(storedPath,bytes);
 return {documentId:id,sourceHashSha256:createHash('sha256').update(bytes).digest('hex'),storedPath,sourceFilename:'resource_'+id+'.csv',mediaType:'text/csv',
  basisState:'active',linkedArtifactId:null,uploadedAt:'2026-09-11',familyKey:'family-'+id,documentType:'resource_register',parserState:'parsed',
  identification:{needsReview:false},lineage:{needsReview:false},supersededByDocumentId:null} as any;
}
test('F16 both resource readers read week columns with the measure in the heading; an unstated measure or a dd/mm date is not guessed',()=>{
 const dir=mkdtempSync(join(tmpdir(),'f16-week-columns-'));
 try{
  const key=(p:any)=>[p.resourceId,String(p.weekStartIso).slice(0,10),p.availableCapacity??null,p.plannedDemand,p.actualApprovedUsage,p.unit];
  const head=['Resource ID','Resource Name','Unit',...WEEKS.flatMap(w=>['Available Capacity '+w,'Planned Demand '+w,'Actual Approved Usage '+w])].join(',');
  const body=TRADES.map(t=>[t.id,t.name,'labor_hour',...WEEKS.flatMap((_,i)=>[t.capacity,t.plan[i],t.actual[i]??''])].join(',')).join('\n');
  const headings=stored(dir,'headings',head+'\n'+body+'\n'),rows=stored(dir,'rows',weekRowsRegister());
  const canonicalKey=(p:any)=>[p.resourceId,p.weekStartIso,p.utilizationCapacity,p.plannedDemand,p.actualApprovedUsage,p.unit];
  const canonical=(doc:any)=>weeklyResourceCapacityEvidence([doc],'2026-09-10').points.map(canonicalKey).map(k=>JSON.stringify(k)).sort();
  assert.equal(canonical(headings).length,22);
  assert.deepEqual(canonical(headings),canonical(rows),'the canonical reader reads the measure-in-heading week columns as the week rows');
  const support=(doc:any)=>(supportWeekly([doc],{dataDateIso:'2026-09-10T07:00:00.000Z'} as any) as any).points.map(key).map((k:unknown)=>JSON.stringify(k)).sort();
  assert.equal(support(headings).length,22);
  assert.deepEqual(support(headings),support(rows),'the resource-support reader applies the same week-column rule');
  const unstated=stored(dir,'unstated','Resource ID,Resource Name,Unit,'+WEEKS.slice(0,2).join(',')+'\nLAB-001,Mason,labor_hour,150,150\n');
  const none=weeklyResourceCapacityEvidence([unstated],'2026-09-10');
  assert.equal(none.points.length,0,'values without a stated measure are not read');
  assert.ok(none.diagnostics.some(d=>d.startsWith('RESOURCE_WEEK_COLUMNS_MEASURE_NOT_STATED:')));
  const numeric=stored(dir,'numeric','Resource ID,Unit,Measure,07/09/2026\nLAB-001,labor_hour,Planned Demand,150\n');
  assert.equal(weeklyResourceCapacityEvidence([numeric],'2026-09-10').points.length,0,'a dd/mm or mm/dd heading is ambiguous and not read');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('F45 earned hours: programme budgeted units x % complete against programme-recorded hours spent, on Man-hour and Resources',async()=>{
 const id=await uploadProject(weekRowsRegister());
 const manhour=moduleForProject(id,'manhour-scurve').data as any;
 const e=manhour.earnedHours;
 assert.ok(e,'the Man-hour page carries earned hours');
 assert.deepEqual([e.state,e.basis,e.budgetedHours,e.earnedHours,e.percentComplete,e.actualHoursSpent,e.actualHoursBasis,e.earnedToSpentRatio,e.earnedMinusSpentHours],
  ['established','programme_assignments',1520,600,39.4737,610,'programme_recorded',0.9836,-10]);
 assert.deepEqual([e.programme.itemCount,e.programme.knownItemCount],[5,5]);
 assert.equal(e.boq.state,'not_supplied');assert.match(e.boq.reason,/^No BOQ (is supplied|items are read)\.$/);
 assert.deepEqual((moduleForProject(id,'resource-utilization').data as any).earnedHours,e,'one shared calculation on both pages');
 const html=runInNewContext('renderEarnedHoursPanel(e)',{e,escapeHtml:text,fmt:text,managementPanel:(t:string,d:string,b:string)=>t+' | '+d+' | '+b}) as string;
 assert.match(html,/Earned hours against hours spent/);
 assert.match(html,/<td>Budgeted hours<\/td><td><b>1520 h<\/b><\/td><td>programme labour assignments \(budgeted units\)<\/td>/);
 assert.match(html,/<td>Earned hours<\/td><td><b>600 h<\/b><\/td>/);
 assert.match(html,/<td>Actual hours spent<\/td><td><b>610 h<\/b><\/td><td>programme-recorded actual hours \(P6\)<\/td>/);
 assert.match(html,/<td>Earned \/ spent<\/td><td><b>0\.9836<\/b><\/td>/);
});

test('F45 earned hours: no stated budget in the BOQ or the programme stays not established with the reason',async()=>{
 const id=await uploadProject(null,{assignments:false});
 const e=(moduleForProject(id,'manhour-scurve').data as any).earnedHours;
 assert.ok(e);
 assert.deepEqual([e.state,e.basis,e.budgetedHours,e.earnedHours,e.earnedToSpentRatio],['not_established',null,null,null,null]);
 assert.match(e.reason,/BOQ: No BOQ (is supplied|items are read)\./);
 assert.match(e.reason,/Programme: The programme has no (hour-based labour )?resource assignments\./);
});

test('F45 earned hours: BOQ items with stated labour hours per unit come first (measured quantity x hours per unit)',t=>{
 const dir=mkdtempSync(join(tmpdir(),'f45-boq-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const state=loadCertifiedDemoProject('F45-BOQ-'+randomUUID());state.evidenceDocuments=[];state.controls.bonds=[];state.controls.progressEvidence={};state.version++;
 const model=state.schedules.at(-1)!.revision.model;model.dataDateIso='2026-08-31';
 const q=state.quantities!;q.installedSnapshots=[];q.items[0]!.section='Earthworks';
 for(const a of model.activities)if(a.activityId==='A200'){a.currentFinishIso='2026-09-30';a.forecastFinishIso='2026-09-30';}
 const content='Item No,Unit,Section,Measurement Date,Cumulative Installed Qty,Labour Hours Per Unit,Actual Labour Hours,Period Start,Period End,Area\n1.1,m3,Earthworks,2026-07-31,20,2,10,2026-06-30,2026-07-31,Plot 01\n1.1,m3,Earthworks,2026-08-31,50,2,15,2026-07-31,2026-08-31,Plot 01';
 const storedPath=join(dir,'measure.csv');writeFileSync(storedPath,content);
 state.evidenceDocuments.push({documentId:'measure',sourceFilename:'installed_measurement_register.csv',storedPath,sourceHashSha256:createHash('sha256').update(content).digest('hex'),mediaType:'text/csv',basisState:'active',linkedArtifactId:null,category:'boq_cost',documentType:'installed_measurement_register',familyKey:'measure',uploadedAt:'2026-09-01',diagnostics:[],assertions:[]} as any);state.version++;
 const {earnedHoursForState}=require('../packages/runtime-api/src/earned-hours');
 const e=earnedHoursForState(state);
 const item=q.items[0]!;
 assert.equal(e.basis,'boq_unit_hours');
 assert.equal(e.boq.itemCount,1,'only the item whose source states hours per unit');
 assert.equal(e.earnedHours,100,'50 m3 installed x 2 h/m3');
 assert.equal(e.budgetedHours,(item.contractQuantity as number)*2);
 assert.match(e.boq.basis,/hours per unit/);
});
