import test from 'node:test';
import assert from 'node:assert/strict';
import type {CanonicalCalendar,CanonicalScheduleActivity,CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';
import {calculateCpm} from '../packages/schedule-cpm/src/engine';
import {calculateCpm as referenceCalculateCpm} from './reference/t11-cpm-engine-bd851ecc';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CpmConfig} from '../packages/schedule-cpm/src/types';

// T11 speed work on the CPM engine must not change one result. The reference
// is the unmodified bd851ecc engine (tests/reference). Both run on the same
// random networks: mixed working calendars (day shift with a break, overnight
// shift, holidays and worked exceptions, 24h), FS/SS/FF/SF/unknown links,
// positive/negative/missing lags, external and broken links, source
// constraints (including ALAP and unsupported ones), progress states, cycles
// and duplicate identifiers. Every field, ordering and diagnostic must match.

function rng(seed:number){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

const day=(intervals:Array<[string,string]>)=>intervals.map(([start,finish])=>{
  const toMin=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3));
  const minutes=toMin(finish)>toMin(start)?toMin(finish)-toMin(start):1440-toMin(start)+toMin(finish);
  return {start,finish,minutes};
});
function weekCalendar(calendarId:string,pattern:Array<Array<[string,string]>>,exceptions:CanonicalCalendar['exceptions']=[]):CanonicalCalendar{
  const weeklyWorkIntervals=pattern.map((intervals,i)=>({dayIndex:i+1,intervals:day(intervals)}));
  return {calendarId,name:calendarId,semanticComplete:true,
    weeklyWorkMinutes:weeklyWorkIntervals.map(d=>d.intervals.reduce((s,x)=>s+x.minutes,0)) as NonNullable<CanonicalCalendar['weeklyWorkMinutes']>,
    weeklyWorkIntervals,exceptions,standardDayHours:8,standardWeekHours:40,sourceRefs:[]};
}
const dayShift:Array<[string,string]>=[['08:00','12:00'],['13:00','17:00']];
const nightShift:Array<[string,string]>=[['22:00','06:00']];
const calendars:CanonicalCalendar[]=[
  {...ELAPSED_24H_CALENDAR,calendarId:'ELAPSED'},
  weekCalendar('DAY5',[[],dayShift,dayShift,dayShift,dayShift,dayShift,[]]),
  weekCalendar('DAY6X',[dayShift,dayShift,dayShift,dayShift,dayShift,[],dayShift],[
    {isoDate:'2031-01-07',nonWorking:true,workIntervals:[]},
    {isoDate:'2031-01-10',nonWorking:false,workIntervals:day([['09:00','11:00']])},
    {isoDate:'2031-01-21',nonWorking:true,workIntervals:[]},
  ]),
  weekCalendar('NIGHT',[[],nightShift,nightShift,nightShift,nightShift,nightShift,[]]),
  {...weekCalendar('PARTIAL',[[],dayShift,dayShift,dayShift,dayShift,dayShift,[]]),reconciledFromP6Dates:true},
  {...weekCalendar('INCOMPLETE',[[],dayShift,[],[],[],[],[]]),semanticComplete:false},
];
const calendarIds=['ELAPSED','DAY5','DAY6X','NIGHT','PARTIAL','INCOMPLETE','MISSING',null];
const constraintTypes=['CS_MSO','CS_MSOB','CS_MSOA','CS_MEO','CS_MEOB','CS_MEOA','CS_MANDSTART','CS_MANDFIN','CS_ALAP','CS_ASAP','Start On Or After','CS_UNKNOWN'];

function randomModel(seed:number):{model:CanonicalScheduleModel;config:Partial<CpmConfig>}{
  const r=rng(seed),pick=<T,>(values:readonly T[]):T=>values[Math.floor(r()*values.length)]!;
  const n=3+Math.floor(r()*(seed%10===0?160:36));
  const iso=(dayOffset:number,hour=0)=>new Date(Date.UTC(2031,0,1+dayOffset,hour)).toISOString();
  const date=(dayOffset:number)=>iso(dayOffset).slice(0,10);
  const timeOrDate=(dayOffset:number)=>r()<0.5?date(dayOffset):iso(dayOffset,Math.floor(r()*24));
  const activities:CanonicalScheduleActivity[]=Array.from({length:n},(_,i)=>{
    const status=pick(['not_started','not_started','in_progress','completed','unknown'] as const);
    const remaining=r()<0.06?null:Math.round(r()*48*2)/2;
    const original=r()<0.06?null:Math.round(r()*64);
    const constraints=r()<0.25?Array.from({length:1+Math.floor(r()*2)},()=>({type:pick(constraintTypes),dateIso:r()<0.08?null:timeOrDate(Math.floor(r()*40))})):undefined;
    const actualStart=status!=='not_started'&&r()<0.8?timeOrDate(Math.floor(r()*10)):null;
    const actualFinish=status==='completed'&&r()<0.8?timeOrDate(10+Math.floor(r()*10)):null;
    return {projectId:'P'+seed,activityId:(seed%17===0&&i===n-1)?'A0':'A'+i,nativeId:String(i),name:'Work '+i,wbsId:null,
      calendarId:pick(calendarIds),activityType:pick(['task','task','task','start_milestone','finish_milestone','level_of_effort'] as const),status,
      baselineStartIso:r()<0.5?date(Math.floor(r()*20)):null,baselineFinishIso:null,
      currentStartIso:r()<0.5?timeOrDate(Math.floor(r()*20)):null,currentFinishIso:r()<0.5?timeOrDate(5+Math.floor(r()*30)):null,
      actualStartIso:actualStart,actualFinishIso:actualFinish,forecastStartIso:null,forecastFinishIso:null,
      originalDurationHours:original,remainingDurationHours:remaining,totalFloatHours:null,freeFloatHours:null,
      percentComplete:status==='completed'?100:status==='in_progress'?Math.round(r()*100):0,
      sourceRefs:[],diagnostics:r()<0.05?['SOURCE_NOTE']:[],
      ...(constraints?{sourceConstraints:constraints}:{}),
    } as CanonicalScheduleActivity;
  });
  // Random DAG over a random permutation, plus occasional cycle, external,
  // broken, unknown-type and missing-lag links.
  const rank=activities.map((_,i)=>i).sort(()=>r()-0.5);
  const relationships:CanonicalScheduleModel['relationships']=[];
  const links=Math.floor(n*(0.5+r()*1.5));
  for(let k=0;k<links;k++){
    const a=Math.floor(r()*n),b=Math.floor(r()*n);if(a===b)continue;
    const [p,s]=rank.indexOf(a)<rank.indexOf(b)?[a,b]:[b,a];
    const lag=r()<0.04?null:pick([0,0,0,4,8,-4,-8,2.5,-1.5,16,-24]);
    relationships.push({relationshipId:'R'+k,predecessorActivityId:'A'+p,successorActivityId:'A'+s,
      type:r()<0.04?'unknown':pick(['FS','FS','SS','FF','SF'] as const),lagHours:lag,
      external:r()<0.03,sourceRefs:[],diagnostics:r()<0.05?['LINK_NOTE']:[]} as CanonicalScheduleModel['relationships'][number]);
  }
  if(r()<0.04&&n>2)relationships.push({relationshipId:'CYCLE',predecessorActivityId:'A'+rank[rank.length-1],successorActivityId:'A'+rank[0],type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]});
  if(r()<0.05)relationships.push({relationshipId:'BROKEN',predecessorActivityId:'A0',successorActivityId:'GONE',type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]});
  const model:CanonicalScheduleModel={projectId:'P'+seed,source:'xer',sourceRevisionId:'REV'+seed,
    dataDateIso:r()<0.1?null as unknown as string:iso(Math.floor(r()*6),pick([0,8,13,23])),
    activities,relationships,wbs:[],calendars,diagnostics:r()<0.05?['SOURCE_CONSTRAINT_RECOVERY_NOT_ESTABLISHED']:[]};
  const config:Partial<CpmConfig>={
    ...(r()<0.6?{applySourceConstraints:true}:{}),
    ...(r()<0.2?{allowElapsedFallback:false}:{}),
    ...(r()<0.15?{assumeMissingLagZero:false}:{}),
    ...(r()<0.15?{assumeUnknownRelationshipTypeFs:false}:{}),
    ...(r()<0.25?{durationBasis:'original'}:{}),
    ...(r()<0.2?{requiredFinishIso:r()<0.5?date(20+Math.floor(r()*30)):iso(20+Math.floor(r()*30),12)}:{}),
    ...(r()<0.1?{projectStartIso:iso(Math.floor(r()*4),9)}:{}),
    ...(r()<0.2?{criticalThresholdHours:pick([0,8,16,-4])}:{}),
  };
  return {model,config};
}

// T06 D1/D2 (found by the independent CPM solver, tests/t06-cmeng-cpm-vs-
// independent.test.ts) deliberately change results relative to bd851ecc in
// exactly two situations; every other network must stay byte-identical.
// D1: a zero-duration activity's late start is its late finish (bd851ecc took
//     the previous closing instant, giving cross-calendar false negative float).
// D2: an SS/SF link from an in-progress predecessor counts from its actual
//     start (bd851ecc used the remaining start at the data date).
function d1d2Triggers(model:CanonicalScheduleModel,config:Partial<CpmConfig>,expected:ReturnType<typeof referenceCalculateCpm>|undefined){
  const d1=(expected?.activities??[]).some(a=>a.status==='calculated'&&a.durationHours===0&&a.lateStartIso!==a.lateFinishIso);
  const started=new Set(model.activities.filter(a=>a.status==='in_progress'&&a.actualStartIso).map(a=>a.activityId));
  const d2=(config.durationBasis??'remaining')==='remaining'&&model.relationships.some(r=>(r.type==='SS'||r.type==='SF')&&started.has(r.predecessorActivityId));
  return {d1,d2};
}
function assertCorrectedD1D2(actual:ReturnType<typeof calculateCpm>,expected:ReturnType<typeof referenceCalculateCpm>,label:string){
  // Same population, identifiers, order, calendars, durations and project start.
  assert.deepEqual(actual.activities.map(a=>[a.activityId,a.calendarId,a.durationHours,a.status]),
    expected.activities.map(a=>[a.activityId,a.calendarId,a.durationHours,a.status]),label);
  assert.equal(actual.projectStartIso,expected.projectStartIso,label);
  for(const a of actual.activities){
    // D1 corrected value: a zero-duration activity starts where it finishes.
    if(a.status==='calculated'&&a.durationHours===0)assert.equal(a.lateStartIso,a.lateFinishIso,label+' '+a.activityId);
    const e=expected.activities.find(x=>x.activityId===a.activityId)!;
    // Completed work keeps its actual dates.
    if(e.diagnostics.includes('CPM_COMPLETED_ACTIVITY_FLOAT_NOT_RECALCULATED'))assert.deepEqual(a,e,label+' '+a.activityId);
  }
}

function run(engine:typeof calculateCpm,model:CanonicalScheduleModel,config:Partial<CpmConfig>){
  try{return {result:engine(structuredClone(model),config)};}catch(error){return {error:String(error)};}
}

test('T11 CPM engine: 200 random networks give results identical to the bd851ecc engine', () => {
  let calculated=0,constrained=0,driving=0,notCalculable=0,corrected=0,identical=0,repaired=0;
  for(let seed=1;seed<=200;seed++){
    const {model,config}=randomModel(seed);
    const expected=run(referenceCalculateCpm,model,config);
    const actual=run(calculateCpm,model,config);
    // P0-B (M5.1): where the reference engine stopped for a loop or a repeated ID,
    // this engine opens the loop or leaves the repeated activity out, names it,
    // and calculates the rest (never "complete").
    if(expected.result&&actual.result&&expected.result.projectFinishIso===null&&actual.result.diagnostics.some(d=>/^CPM_(LOOP_LINK|DUPLICATE_ACTIVITY_ID)_LEFT_OUT:/.test(d))){
      assert.equal(actual.result.complete,false,'seed '+seed);repaired++;notCalculable++;continue;
    }
    const triggers=d1d2Triggers(model,config,expected.result);
    if((triggers.d1||triggers.d2)&&expected.result&&actual.result&&JSON.stringify(actual)!==JSON.stringify(expected)){
      assertCorrectedD1D2(actual.result,expected.result,'seed '+seed);
      corrected++;
      continue;
    }
    identical++;
    assert.deepStrictEqual(actual,expected,'seed '+seed);
    assert.equal(JSON.stringify(actual),JSON.stringify(expected),'seed '+seed+' key order');
    if(expected.result){
      calculated+=expected.result.activities.filter(a=>a.status==='calculated').length;
      if(expected.result.diagnostics.some(d=>d.startsWith('SOURCE_CONSTRAINTS_APPLIED')))constrained++;
      if((expected.result.drivingNetwork?.relationships.length??0)>0)driving++;
      if(expected.result.activities.some(a=>a.diagnostics.includes('CPM_NETWORK_NOT_CALCULABLE')))notCalculable++;
    }
  }
  // The random population genuinely exercises the calculated, constrained,
  // driving-path and not-calculable branches.
  assert.ok(calculated>1000,'calculated activities '+calculated);
  assert.ok(constrained>20,'constrained networks '+constrained);
  assert.ok(driving>50,'networks with driving links '+driving);
  assert.ok(notCalculable>3,'not calculable networks '+notCalculable);
  // Most networks have neither situation and remain byte-identical.
  assert.ok(identical>=150,'identical networks '+identical+', corrected '+corrected);
});

test('T11 CPM engine: a profile-scale network (8,900 activities, 6 calendars) is identical', () => {
  const activities:CanonicalScheduleActivity[]=Array.from({length:8900},(_,i)=>({projectId:'SCALE',activityId:'ACC-'+i,nativeId:String(i),
    name:'Work '+i,wbsId:null,calendarId:['ELAPSED','DAY5','DAY6X','NIGHT','PARTIAL','ELAPSED'][i%6]!,activityType:'task',status:i<300?'completed':i<600?'in_progress':'not_started',
    baselineStartIso:'2031-01-01',baselineFinishIso:'2031-02-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',
    actualStartIso:i<600?'2031-01-02':null,actualFinishIso:i<300?'2031-01-03':null,forecastStartIso:null,forecastFinishIso:null,
    originalDurationHours:24,remainingDurationHours:i%11,totalFloatHours:null,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[],
    ...(i%97===0?{sourceConstraints:[{type:i%2?'CS_ALAP':'CS_MSOA',dateIso:'2031-01-20'}]}:{})}) as CanonicalScheduleActivity);
  const relationships:CanonicalScheduleModel['relationships']=[];
  for(let i=1;i<8900;i++){
    if(i%100!==0)relationships.push({relationshipId:'R'+i,predecessorActivityId:'ACC-'+(i-1),successorActivityId:'ACC-'+i,type:(['FS','SS','FF','SF'] as const)[i%4]!,lagHours:[0,4,-4,8][i%4]!,external:false,sourceRefs:[],diagnostics:[]});
    if(i>5&&i%3===0)relationships.push({relationshipId:'D'+i,predecessorActivityId:'ACC-'+(i-5),successorActivityId:'ACC-'+i,type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]});
  }
  const model:CanonicalScheduleModel={projectId:'SCALE',source:'xer',sourceRevisionId:'SCALE-1',dataDateIso:'2031-01-05',activities,relationships,wbs:[],calendars,diagnostics:[]};
  for(const config of [{applySourceConstraints:true},{}] as Array<Partial<CpmConfig>>){
    const expected=run(referenceCalculateCpm,model,config),actual=run(calculateCpm,model,config);
    assert.ok(expected.result,'reference calculated');
    // Activities 300 to 599 are in progress and the chain carries SS/SF links
    // from them: D2 applies, so the corrected values are checked instead.
    assert.ok(d1d2Triggers(model,config,expected.result).d2);
    assert.ok(actual.result);
    assertCorrectedD1D2(actual.result,expected.result!,'scale');
  }
});
