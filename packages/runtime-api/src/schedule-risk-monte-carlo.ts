import {calculateCpm} from '../../schedule-cpm/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';
import {canonicalTimeClaims,projectControlSchedule} from './canonical-time-claims';
import {operationalReporting} from './reporting-state';

export interface MonteCarloConfig {
  iterations:number;
  seed:number;
  minFactor:number;
  modeFactor:number;
  maxFactor:number;
}
const DEFAULT_CONFIG:MonteCarloConfig={iterations:1000,seed:20260927,minFactor:0.9,modeFactor:1,maxFactor:1.25};

function seededRandom(seed:number){let state=seed>>>0;return()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
function triangular(random:()=>number,min:number,mode:number,max:number){const u=random(),split=(mode-min)/(max-min);return u<split?min+Math.sqrt(u*(max-min)*(mode-min)):max-Math.sqrt((1-u)*(max-min)*(max-mode));}
function quantile(values:number[],p:number){if(!values.length)return null;const i=Math.min(values.length-1,Math.max(0,Math.ceil(p*values.length)-1));return values[i]??null;}
function iso(ms:number|null){return ms===null?null:new Date(ms).toISOString();}
function validConfig(c:MonteCarloConfig){return Number.isSafeInteger(c.iterations)&&c.iterations>=100&&c.iterations<=10000&&c.minFactor>0&&c.minFactor<=c.modeFactor&&c.modeFactor<=c.maxFactor&&c.maxFactor>c.minFactor;}

const cache=new WeakMap<ProjectRuntimeState,{version:number;key:string;result:ModuleRuntimeResult}>();

export function scheduleRiskMonteCarlo(state:ProjectRuntimeState,input:Partial<MonteCarloConfig>={}):ModuleRuntimeResult{
  const requested={...DEFAULT_CONFIG,...input};
  const key=JSON.stringify(requested),prior=cache.get(state);
  if(prior?.version===state.version&&prior.key===key)return prior.result;
  const current=projectControlSchedule(state);
  if(!current){
    const result:ModuleRuntimeResult={key:'monte-carlo-risk',status:'blocked',engineState:'blocked',evidenceState:'missing',professionalState:'not_defensible',
      reason:'Select an adopted reporting programme before running schedule risk simulation.',dependencies:['adopted programme'],data:null};
    cache.set(state,{version:state.version,key,result});return result;
  }
  if(!validConfig(requested)){
    const result:ModuleRuntimeResult={key:'monte-carlo-risk',status:'blocked',engineState:'blocked',evidenceState:'missing',professionalState:'not_defensible',
      reason:'Monte Carlo scenario parameters are invalid.',dependencies:['valid uncertainty scenario'],data:null};
    cache.set(state,{version:state.version,key,result});return result;
  }
  const model=current.revision.model;
  const deterministic=calculateCpm(model,{durationBasis:'remaining'});
  if(!deterministic.complete||!deterministic.projectFinishIso){
    const result:ModuleRuntimeResult={key:'monte-carlo-risk',status:'partial',engineState:'ready',evidenceState:'partial',professionalState:'review_required',
      reason:'The deterministic network must be fully calculable before a schedule-risk distribution can be interpreted.',
      dependencies:['complete CPM network','readable working calendars','relationships','remaining durations'],
      data:{projectionKey:'schedule_risk_monte_carlo',schemaVersion:'1.0',state:'unavailable',dataDateIso:model.dataDateIso,sourceRevisionId:model.sourceRevisionId,
        deterministicFinishIso:deterministic.projectFinishIso,iterations:0,assumptionAuthority:'scenario_only',diagnostics:deterministic.diagnostics}};
    cache.set(state,{version:state.version,key,result});return result;
  }

  const execution=model.activities.filter(a=>!['level_of_effort','wbs_summary'].includes(a.activityType));
  const uncertain=execution.filter(a=>a.status!=='completed'&&typeof a.remainingDurationHours==='number'&&a.remainingDurationHours>=0);
  if(!uncertain.length){
    const result:ModuleRuntimeResult={key:'monte-carlo-risk',status:'partial',engineState:'ready',evidenceState:'partial',professionalState:'review_required',
      reason:'No incomplete execution activity has a readable remaining duration to vary.',dependencies:['remaining durations'],
      data:{projectionKey:'schedule_risk_monte_carlo',schemaVersion:'1.0',state:'unavailable',dataDateIso:model.dataDateIso,sourceRevisionId:model.sourceRevisionId,
        deterministicFinishIso:deterministic.projectFinishIso,iterations:0,assumptionAuthority:'scenario_only'}};
    cache.set(state,{version:state.version,key,result});return result;
  }

  // Large networks remain genuinely activity-by-activity, but the default sample
  // count is bounded so the on-demand analysis does not monopolize a project worker.
  const iterations=Math.min(requested.iterations,execution.length>20000?500:execution.length>10000?750:requested.iterations);
  const random=seededRandom(requested.seed);
  const finishes:number[]=[];
  const criticalCounts=new Map<string,number>();
  let failedIterations=0;
  const uncertainIds=new Set(uncertain.map(a=>a.activityId));
  for(let iteration=0;iteration<iterations;iteration+=1){
    const factors=new Map<string,number>();
    for(const activity of uncertain)factors.set(activity.activityId,triangular(random,requested.minFactor,requested.modeFactor,requested.maxFactor));
    const sampled:CanonicalScheduleModel={...model,activities:model.activities.map(activity=>{
      if(!uncertainIds.has(activity.activityId)||typeof activity.remainingDurationHours!=='number')return activity;
      return {...activity,remainingDurationHours:Number((activity.remainingDurationHours*(factors.get(activity.activityId)??1)).toFixed(6))};
    })};
    const run=calculateCpm(sampled,{durationBasis:'remaining'});
    const finish=run.projectFinishIso?Date.parse(run.projectFinishIso):NaN;
    if(!run.complete||!Number.isFinite(finish)){failedIterations++;continue;}
    finishes.push(finish);
    for(const id of run.criticalActivityIds)criticalCounts.set(id,(criticalCounts.get(id)??0)+1);
  }
  finishes.sort((a,b)=>a-b);
  const completed=finishes.length;
  const required=canonicalTimeClaims(state).contractTimeBasis?.contractualCompletionIso??null;
  const requiredMs=required?Date.parse(required):NaN;
  const finishProbability=Number.isFinite(requiredMs)&&completed?Number((finishes.filter(v=>v<=requiredMs).length/completed*100).toFixed(2)):null;
  const risk=operationalReporting(state).risk;
  const openRiskActivities=new Map<string,number>();
  for(const row of risk.current??[])if(row.status==='open'&&row.linkedActivityId)openRiskActivities.set(row.linkedActivityId,(openRiskActivities.get(row.linkedActivityId)??0)+1);
  const byId=new Map(model.activities.map(a=>[a.activityId,a]));
  const drivers=[...criticalCounts.entries()].map(([activityId,count])=>{const a=byId.get(activityId);return {
    activityId,name:a?.name??null,wbsId:a?.wbsId??null,status:a?.status??'unknown',remainingDurationHours:a?.remainingDurationHours??null,
    sourceTotalFloatHours:a?.totalFloatHours??null,criticalityIndexPercent:completed?Number((count/completed*100).toFixed(2)):null,
    linkedOpenRiskCount:openRiskActivities.get(activityId)??0
  };}).sort((a,b)=>(b.criticalityIndexPercent??-1)-(a.criticalityIndexPercent??-1)||String(a.activityId).localeCompare(String(b.activityId))).slice(0,50);

  const histogram=new Map<string,number>();
  for(const value of finishes){const date=new Date(value);const monday=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));const day=monday.getUTCDay()||7;monday.setUTCDate(monday.getUTCDate()-day+1);const bucket=monday.toISOString().slice(0,10);histogram.set(bucket,(histogram.get(bucket)??0)+1);}
  const confidence=[0.1,0.2,0.5,0.8,0.9,0.95].map(p=>({percentile:'P'+Math.round(p*100),completionIso:iso(quantile(finishes,p))}));

  const data={projectionKey:'schedule_risk_monte_carlo',schemaVersion:'1.0',state:completed?'scenario':'unavailable',projectId:state.projectId,
    sourceRevisionId:model.sourceRevisionId,dataDateIso:model.dataDateIso,deterministicFinishIso:deterministic.projectFinishIso,requiredFinishIso:required,
    iterationsRequested:requested.iterations,iterationsCompleted:completed,failedIterations,seed:requested.seed,
    uncertainty:{minFactor:requested.minFactor,modeFactor:requested.modeFactor,maxFactor:requested.maxFactor,authority:'scenario_only',
      basis:'Each incomplete execution activity is sampled independently using the stated triangular factor applied to its source remaining duration. The full schedule network is recalculated each successful iteration.'},
    activityPopulation:execution.length,uncertainActivityCount:uncertain.length,confidence,finishByRequiredDateProbabilityPercent:finishProbability,
    histogram:[...histogram.entries()].map(([weekStartIso,count])=>({weekStartIso,count})).sort((a,b)=>a.weekStartIso.localeCompare(b.weekStartIso)),
    riskDrivers:drivers,riskRegister:{currentRiskCount:risk.currentRecordCount??null,linkedOpenRiskActivityCount:openRiskActivities.size,
      basis:'Risk-register links are shown as context only. No duration impact or probability is invented from qualitative risk ratings.'},
    assumptions:[
      'This is a schedule-risk scenario, not the official project forecast or contractual completion position.',
      'Default uncertainty factors are explicit scenario assumptions until project-specific activity uncertainty ranges are supplied.',
      'Activity durations are sampled independently; correlation groups are not established from the current project evidence.',
      'Completed activities retain their actual dates. Deterministic CPM remains the canonical current schedule calculation.'
    ]};
  const result:ModuleRuntimeResult={key:'monte-carlo-risk',status:completed?'partial':'blocked',engineState:'ready',evidenceState:'partial',professionalState:'review_required',
    reason:completed?'Monte Carlo is available as an explicit scenario. Project-specific uncertainty ranges and correlation groups are not established, so P-values are not an official forecast.':'No successful simulation iterations were produced.',
    dependencies:['adopted programme','complete deterministic CPM','remaining durations','scenario uncertainty factors'],data};
  cache.set(state,{version:state.version,key,result});return result;
}
