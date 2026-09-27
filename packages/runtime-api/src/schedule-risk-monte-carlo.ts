import {calculateCpm} from '../../schedule-cpm/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';
import {canonicalTimeClaims,projectControlSchedule} from './canonical-time-claims';
import {operationalReporting} from './reporting-state';
import {cell,numberValue,sourceTables} from '../../truth-kernel/src';

export interface MonteCarloConfig {
  iterations:number;
  seed:number;
  minFactor:number;
  modeFactor:number;
  maxFactor:number;
}
const DEFAULT_CONFIG:MonteCarloConfig={iterations:1000,seed:20260927,minFactor:0.9,modeFactor:1,maxFactor:1.25};

function seededRandom(seed:number){let state=seed>>>0;return()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
function triangularFromU(u:number,min:number,mode:number,max:number){const split=(mode-min)/(max-min);return u<split?min+Math.sqrt(u*(max-min)*(mode-min)):max-Math.sqrt((1-u)*(max-min)*(max-mode));}
function triangular(random:()=>number,min:number,mode:number,max:number){return triangularFromU(random(),min,mode,max);}
function quantile(values:number[],p:number){if(!values.length)return null;const i=Math.min(values.length-1,Math.max(0,Math.ceil(p*values.length)-1));return values[i]??null;}
function iso(ms:number|null){return ms===null?null:new Date(ms).toISOString();}
function validConfig(c:MonteCarloConfig){return Number.isSafeInteger(c.iterations)&&c.iterations>=100&&c.iterations<=10000&&c.minFactor>0&&c.minFactor<=c.modeFactor&&c.modeFactor<=c.maxFactor&&c.maxFactor>c.minFactor;}
type ActivityUncertainty={activityId:string;minFactor:number;modeFactor:number;maxFactor:number;correlationGroup:string|null;sourceRefs:string[]};
function sourceUncertainty(state:ProjectRuntimeState,remainingById:Map<string,number>){
  const docs=state.evidenceDocuments.filter(d=>['active','additive'].includes(d.basisState)),diagnostics:string[]=[];
  const tables=sourceTables(docs,diagnostics),byId=new Map<string,ActivityUncertainty>(),conflicts:string[]=[];
  for(const table of tables)for(const row of table.rows){
    const activityId=cell(row,'activity id','activity code','schedule activity id').trim();if(!activityId||!remainingById.has(activityId))continue;
    const minFactor=numberValue(cell(row,'minimum factor','min factor','optimistic factor'));
    const modeFactor=numberValue(cell(row,'most likely factor','mode factor','likely factor'));
    const maxFactor=numberValue(cell(row,'maximum factor','max factor','pessimistic factor'));
    const base=remainingById.get(activityId)!;
    const optimisticHours=numberValue(cell(row,'optimistic remaining hours','minimum remaining hours','min remaining hours'));
    const likelyHours=numberValue(cell(row,'most likely remaining hours','mode remaining hours'));
    const pessimisticHours=numberValue(cell(row,'pessimistic remaining hours','maximum remaining hours','max remaining hours'));
    const min=minFactor??(optimisticHours!==null&&base>0?optimisticHours/base:null);
    const mode=modeFactor??(likelyHours!==null&&base>0?likelyHours/base:null);
    const max=maxFactor??(pessimisticHours!==null&&base>0?pessimisticHours/base:null);
    if(min===null||mode===null||max===null)continue;
    if(!(min>0&&min<=mode&&mode<=max&&max>min)){conflicts.push('INVALID_UNCERTAINTY_RANGE:'+activityId);continue;}
    const candidate:ActivityUncertainty={activityId,minFactor:min,modeFactor:mode,maxFactor:max,correlationGroup:cell(row,'correlation group','risk correlation group','correlation').trim()||null,
      sourceRefs:['evidence-document:'+row.receipt.documentId+':'+row.receipt.locator]};
    const prior=byId.get(activityId);
    if(prior&&(prior.minFactor!==candidate.minFactor||prior.modeFactor!==candidate.modeFactor||prior.maxFactor!==candidate.maxFactor||prior.correlationGroup!==candidate.correlationGroup)){conflicts.push('CONFLICTING_UNCERTAINTY_RANGE:'+activityId);byId.delete(activityId);continue;}
    if(!conflicts.includes('CONFLICTING_UNCERTAINTY_RANGE:'+activityId))byId.set(activityId,candidate);
  }
  return {byId,conflicts,diagnostics};
}


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
  const remainingById=new Map(uncertain.map(a=>[a.activityId,a.remainingDurationHours!])),sourceRanges=sourceUncertainty(state,remainingById);
  const sourceCovered=uncertain.filter(a=>sourceRanges.byId.has(a.activityId)).length;
  const finishes:number[]=[];
  const criticalCounts=new Map<string,number>();
  let failedIterations=0;
  const uncertainIds=new Set(uncertain.map(a=>a.activityId));
  for(let iteration=0;iteration<iterations;iteration+=1){
    const factors=new Map<string,number>(),groupU=new Map<string,number>();
    for(const activity of uncertain){
      const source=sourceRanges.byId.get(activity.activityId),range=source??{minFactor:requested.minFactor,modeFactor:requested.modeFactor,maxFactor:requested.maxFactor,correlationGroup:null};
      let u:number;
      if(source?.correlationGroup){if(!groupU.has(source.correlationGroup))groupU.set(source.correlationGroup,random());u=groupU.get(source.correlationGroup)!;}else u=random();
      factors.set(activity.activityId,triangularFromU(u,range.minFactor,range.modeFactor,range.maxFactor));
    }
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
    uncertainty:{minFactor:requested.minFactor,modeFactor:requested.modeFactor,maxFactor:requested.maxFactor,
      authority:sourceCovered===uncertain.length&&uncertain.length?'source_ranges':sourceCovered?'mixed_source_and_scenario':'scenario_only',
      sourceCoveredActivityCount:sourceCovered,scenarioDefaultActivityCount:uncertain.length-sourceCovered,coveragePercent:uncertain.length?Number((sourceCovered/uncertain.length*100).toFixed(2)):null,
      correlationGroupCount:new Set([...sourceRanges.byId.values()].map(r=>r.correlationGroup).filter(Boolean)).size,
      conflicts:sourceRanges.conflicts,
      basis:'Each incomplete execution activity is sampled from an explicit source triangular range where available; otherwise the stated scenario default is used. Activities with the same explicit correlation group share the same percentile draw. The full schedule network is recalculated each successful iteration.'},
    activityPopulation:execution.length,uncertainActivityCount:uncertain.length,confidence,finishByRequiredDateProbabilityPercent:finishProbability,
    histogram:[...histogram.entries()].map(([weekStartIso,count])=>({weekStartIso,count})).sort((a,b)=>a.weekStartIso.localeCompare(b.weekStartIso)),
    riskDrivers:drivers,riskRegister:{currentRiskCount:risk.currentRecordCount??null,linkedOpenRiskActivityCount:openRiskActivities.size,
      basis:'Risk-register links are shown as context only. No duration impact or probability is invented from qualitative risk ratings.'},
    assumptions:[
      'This is a schedule-risk scenario, not the official project forecast or contractual completion position.',
      sourceCovered?sourceCovered+' activity uncertainty range(s) are read from explicit source factor/hour fields; remaining activities use the displayed scenario defaults.':'Default uncertainty factors are explicit scenario assumptions until project-specific activity uncertainty ranges are supplied.',
      sourceRanges.byId.size?'Explicit correlation groups are applied where supplied; ungrouped activities are sampled independently.':'Activity durations are sampled independently because no explicit correlation groups are established from the current project evidence.',
      'Completed activities retain their actual dates. Deterministic CPM remains the canonical current schedule calculation.'
    ]};
  const result:ModuleRuntimeResult={key:'monte-carlo-risk',status:completed?'partial':'blocked',engineState:'ready',evidenceState:'partial',professionalState:'review_required',
    reason:completed?'Monte Carlo is available as an explicit scenario. Project-specific uncertainty ranges and correlation groups are not established, so P-values are not an official forecast.':'No successful simulation iterations were produced.',
    dependencies:['adopted programme','complete deterministic CPM','remaining durations','scenario uncertainty factors'],data};
  cache.set(state,{version:state.version,key,result});return result;
}
