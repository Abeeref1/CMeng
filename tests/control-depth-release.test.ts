import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scheduleScopeClassification} from '../packages/runtime-api/src/schedule-scope-classification';
import {scheduleRiskMonteCarlo} from '../packages/runtime-api/src/schedule-risk-monte-carlo';
import {earnedScheduleForState,evmByWbsForState} from '../packages/runtime-api/src/advanced-controls';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {projectMetadata} from '../packages/runtime-api/src/project-catalog';
import {resolveIntent} from '../packages/project-ask/src/intent';
import type {AuthorityDescriptor,AskSession} from '../packages/project-ask/src/types';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {ProjectAskEngine} from '../packages/runtime-api/src/ask-engine';
import {AskStore} from '../packages/runtime-api/src/ask-store';

const model:CanonicalScheduleModel={
  projectId:'CLASSIFY',source:'xer',sourceRevisionId:'R1',dataDateIso:'2030-01-31',
  wbs:[
    {wbsId:'ROOT',parentWbsId:null,name:'Project',sourceRefs:[]},
    {wbsId:'T2',parentWbsId:'ROOT',name:'Tower 2',sourceRefs:[]},
    {wbsId:'Z7',parentWbsId:'T2',name:'Zone 7',sourceRefs:[]},
    {wbsId:'EL',parentWbsId:'Z7',name:'Electrical',sourceRefs:[]},
    {wbsId:'L10',parentWbsId:'EL',name:'Level 10',sourceRefs:[]}
  ],calendars:[],relationships:[],diagnostics:[],
  activities:[{projectId:'CLASSIFY',activityId:'A1',nativeId:'1',name:'Install LV panels',wbsId:'L10',calendarId:null,activityType:'task',status:'not_started',
    baselineStartIso:null,baselineFinishIso:null,currentStartIso:'2030-01-01',currentFinishIso:'2030-02-01',actualStartIso:null,actualFinishIso:null,forecastStartIso:'2030-01-01',forecastFinishIso:'2030-02-01',
    originalDurationHours:80,remainingDurationHours:80,totalFloatHours:-8,freeFloatHours:0,percentComplete:0,sourceRefs:[],diagnostics:[]}]
};

test('shared schedule classification derives spatial and discipline filters from explicit source WBS text without promoting missing dimensions',()=>{
  const c=scheduleScopeClassification(model),row=c.rows[0]!;
  assert.equal(row.zone,'Zone 7');assert.equal(row.tower,'Tower 2');assert.equal(row.level,'Level 10');assert.equal(row.discipline,'Electrical');
  assert.match(row.wbsPath!,/Project > Tower 2 > Zone 7 > Electrical > Level 10/);
  assert.equal(row.package,null);
  assert.equal(c.coverage.find(x=>x.key==='zone')?.classified,1);
  assert.equal(c.coverage.find(x=>x.key==='package')?.classified,0);
});

test('compound delayed plus Zone request is decomposed into independent activity result sets and does not require Delivery locations',()=>{
  const catalogue:AuthorityDescriptor[]=[
    {id:'activities',title:'Activities',description:'',module:'activity-analytics',domains:['schedule'],concepts:['activities','activity'],fields:['scheduleDelayed','location','zone'],historical:false},
    {id:'float',title:'Float',description:'',module:'near-critical',domains:['schedule'],concepts:['float'],fields:['totalFloatHours'],historical:false},
    {id:'locations',title:'Locations',description:'',module:'construction-locations',domains:['delivery'],concepts:['zone','floor','location'],fields:['location'],historical:false}
  ];
  const principal:AskSession={userId:'u',workspaceId:'w',name:null,title:null,company:null,allowModel:false};
  const r=resolveIntent('list me all delayed activities and the activities for zone 7',catalogue,principal,null,null);
  assert.ok(r.plan.authorities.includes('activities'));assert.ok(!r.plan.authorities.includes('locations'));
  assert.ok(r.plan.authorityFilters?.activities?.some(f=>f.field==='scheduleDelayed'&&f.value===true));
  assert.deepEqual(r.plan.activityBreakouts?.[0]?.filters,[{field:'location',operator:'contains',value:'zone 7',upper:null}]);
  assert.ok(!r.plan.filters.some(f=>f.field==='location'),'Zone 7 must not be intersected with the primary delayed list');
});

function calendarXer(dataDate='2030-01-01 08:00'){
  const cal='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()((0||0(s|08:00|f|16:00)())))').join('')+'))))';
  return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tRISK\t'+dataDate,
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\t1\tEight hour calendar\t8\t56\t'+cal,
    '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\tstatus_code\tclndr_id\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tearly_start_date\tearly_end_date',
    '%R\t1\t1\tA\tFoundation work\tTT_Task\tTK_NotStart\t1\t160\t160\t0\t2030-01-01 08:00\t2030-01-20 16:00','%E'].join('\n');
}

test('Monte Carlo risk is reproducible, activity-by-activity, percentile ordered and never mutates project truth',async()=>{
  const id='MONTE-'+Date.now();await runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'programme.xer',bytes:Buffer.from(calendarXer()),mediaType:'text/plain',uploadedAt:'2030-01-01',role:'update',uploadIntent:'replace_current_basis'});
  const state=runtimeProjects.get(id)!,before=state.version;
  const a:any=scheduleRiskMonteCarlo(state,{iterations:100,seed:77,minFactor:.8,modeFactor:1,maxFactor:1.3});
  const b:any=scheduleRiskMonteCarlo(state,{iterations:100,seed:77,minFactor:.8,modeFactor:1,maxFactor:1.3});
  assert.equal(state.version,before);assert.equal(a.data.uncertainty.authority,'scenario_only');assert.equal(a.data.iterationsCompleted,100);
  assert.deepEqual(a.data.confidence,b.data.confidence);
  const ms=Object.fromEntries(a.data.confidence.map((r:any)=>[r.percentile,Date.parse(r.completionIso)]));
  assert.ok(ms.P10<=ms.P50&&ms.P50<=ms.P80&&ms.P80<=ms.P90&&ms.P90<=ms.P95);
  assert.ok(a.data.riskDrivers.some((r:any)=>r.activityId==='A'));
  assert.match(a.data.assumptions.join(' '),/not the official project forecast/i);
});

test('project catalogue retains a lightweight Data Date rather than displaying a false blank while summary warms',async()=>{
  const id='META-'+Date.now();await runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'programme.xer',bytes:Buffer.from(calendarXer('2030-01-05 08:00')),mediaType:'text/plain',uploadedAt:'2030-01-05',role:'update',uploadIntent:'replace_current_basis'});
  const meta=projectMetadata(runtimeProjects.get(id)!);assert.equal(meta.latestDataDateIso,'2030-01-05');assert.equal(meta.revisionCount,1);
});

test('Earned Schedule and EVM by WBS fail closed or calculate only from compatible source time series',async t=>{
  const id='ADV-'+Date.now(),root=mkdtempSync(join(tmpdir(),'cmeng-control-depth-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  await runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'programme.xer',bytes:Buffer.from(calendarXer('2030-01-21 08:00')),mediaType:'text/plain',uploadedAt:'2030-01-21',role:'update',uploadIntent:'replace_current_basis'});
  const csv=[
    'Metric,Value,Unit,Status,As Of,VAT Basis,WBS',
    'PV,0,AED,Approved,2030-01-01,Exclusive,W1','EV,0,AED,Approved,2030-01-01,Exclusive,W1','AC,0,AED,Actual,2030-01-01,Exclusive,W1',
    'PV,50,AED,Approved,2030-01-11,Exclusive,W1','EV,40,AED,Approved,2030-01-11,Exclusive,W1','AC,45,AED,Actual,2030-01-11,Exclusive,W1',
    'PV,100,AED,Approved,2030-01-21,Exclusive,W1','EV,80,AED,Approved,2030-01-21,Exclusive,W1','AC,90,AED,Actual,2030-01-21,Exclusive,W1'
  ].join('\n');
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'Cost-EVM.csv',bytes:Buffer.from(csv),mediaType:'text/csv',uploadedAt:'2030-01-21',uploadIntent:'replace_current_basis'});
  const state=runtimeProjects.get(id)!;
  const es:any=earnedScheduleForState(state),series=es.data.series[0];assert.equal(series.state,'established');assert.ok(Math.abs(series.current.schedulePerformanceIndexTime-.8)<.000001);
  const byWbs:any=evmByWbsForState(state),row=byWbs.data.rows.find((r:any)=>r.wbsId==='W1');assert.ok(row);assert.equal(row.spi,.8);assert.equal(Number(row.cpi.toFixed(6)),Number((80/90).toFixed(6)));
  const engine=new ProjectAskEngine(new AskStore(root),null);assert.ok(engine);
});
