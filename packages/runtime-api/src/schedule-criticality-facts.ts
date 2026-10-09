import {aggregateCount} from '../../truth-kernel/src';
import {buildScheduleAnalyticsProjection} from '../../schedule-analytics/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';
import {projectScheduleControlBasis} from './schedule-control-basis';
import {cachedIndependentForecast} from './forecast-cache';
import {activityFloatReconciliation} from './activity-float-reconciliation';
import {buildForecastReconciliationGate,hasUnreconciledScheduleCalendar} from './forecast-control';

/** Schedule-only source of headline criticality. This module MUST NOT import
 * project-facts, project-projections, action registers or management modules. */
type Aggregate={value:number|null;knownCount:number|null;unresolvedCount:number|null;populationCount:number|null};
type SourceFloat=ReturnType<typeof buildScheduleAnalyticsProjection>['result']['float'];
const missing=():Aggregate=>({value:null,knownCount:null,unresolvedCount:null,populationCount:null});
type Result={
 submittedCritical:Aggregate;submittedNearCritical:Aggregate;submittedNegativeFloat:Aggregate;
 independentCritical:Aggregate;independentNearCritical:Aggregate;independentNegativeFloat:Aggregate;
 canonicalCritical:Aggregate;canonicalNearCritical:Aggregate;canonicalNegativeFloat:Aggregate;
 floatBasis:'independent_cpm'|'source_total_float'|'missing';
 floatLabel:string;
 authoritativeIndependent:boolean;
 independentForecast:ReturnType<typeof cachedIndependentForecast>|null;
 reconciliation:{disputedActivityCount:number;numericDifferenceActivityCount:number;unresolvedActivityCount:number}|null;
};
const cache=new WeakMap<CanonicalScheduleModel,{version:number;value:Result}>();

export function scheduleCriticalityFacts(state:ProjectRuntimeState,providedFloat?:SourceFloat|null):Result{
  const model=projectControlSchedule(state)?.revision.model??null;
  if(!model){
    const unknown=missing();
    return {submittedCritical:unknown,submittedNearCritical:unknown,submittedNegativeFloat:unknown,
      independentCritical:unknown,independentNearCritical:unknown,independentNegativeFloat:unknown,
      canonicalCritical:unknown,canonicalNearCritical:unknown,canonicalNegativeFloat:unknown,
      floatBasis:'missing',floatLabel:'Criticality not established: no current programme',
      authoritativeIndependent:false,independentForecast:null,reconciliation:null};
  }
  const prior=cache.get(model);
  if(prior?.version===state.version)return prior.value;
  const config=projectScheduleControlBasis(state).analysisConfig;
  const source=providedFloat??buildScheduleAnalyticsProjection(model,{
    generatedAt:'project-version:'+state.version,producerVersion:'schedule-criticality-facts-v1',config
  }).result.float;
  const submittedCritical:Aggregate={value:source.criticalCount,
    knownCount:source.knownClassifications.critical,unresolvedCount:source.unknownFloatCount,
    populationCount:source.totalActivities};
  const submittedNearCritical:Aggregate={value:source.nearCriticalCount,
    knownCount:source.knownClassifications.nearCritical,
    unresolvedCount:source.unknownFloatCount+source.nearCriticalThresholdUnresolvedCount,
    populationCount:source.totalActivities};
  const openRows=model.activities.filter(row=>!['level_of_effort','wbs_summary'].includes(row.activityType)&&row.status!=='completed');
  const submittedNegativeFloat=aggregateCount(openRows,row=>row.totalFloatHours===null?null:row.totalFloatHours<0);

  const independentForecast=cachedIndependentForecast(model,'project-version:'+state.version);
  const review=independentForecast?activityFloatReconciliation(model,independentForecast,config):null;
  const check=independentForecast?buildForecastReconciliationGate({forecast:independentForecast,model,requiredFinishIso:null}):null;
  const comparable=review?[...review.byActivityId.values()].filter(row=>row.floatReconciliationState!=='not_applicable_completed'):[];
  const independentAggregate=(predicate:(row:(typeof comparable)[number])=>boolean):Aggregate=>{
    if(!comparable.length)return missing();
    const known=comparable.filter(row=>row.independentTotalFloatHours!==null&&row.independentCriticality!=='unknown');
    const unknown=comparable.length-known.length;
    const count=known.filter(predicate).length;
    return {value:unknown===0?count:null,knownCount:count,unresolvedCount:unknown,populationCount:comparable.length};
  };
  const independentCritical=independentAggregate(row=>row.independentCriticality==='critical');
  const independentNearCritical=independentAggregate(row=>row.independentCriticality==='near_critical');
  const independentNegativeFloat=independentAggregate(row=>row.independentTotalFloatHours!==null&&row.independentTotalFloatHours<0);
  const authoritativeIndependent=!!review&&!!check&&check.usable&&
    !hasUnreconciledScheduleCalendar(independentForecast)&&
    review.summary.independentCpmState==='established'&&review.summary.unresolvedActivityCount===0&&
    review.summary.disputedActivityCount===0&&independentCritical.value!==null&&independentNearCritical.value!==null;
  // A numeric-only difference is disclosed in planner detail; it does not veto
  // an otherwise valid forecast when classifications and material checks pass.
  const value:Result={
    submittedCritical,submittedNearCritical,submittedNegativeFloat,
    independentCritical,independentNearCritical,independentNegativeFloat,
    canonicalCritical:authoritativeIndependent?independentCritical:submittedCritical,
    canonicalNearCritical:authoritativeIndependent?independentNearCritical:submittedNearCritical,
    canonicalNegativeFloat:authoritativeIndependent?independentNegativeFloat:submittedNegativeFloat,
    floatBasis:authoritativeIndependent?'independent_cpm':'source_total_float',
    floatLabel:authoritativeIndependent?'Independent CPM — reconciled with submitted programme classifications':
      'Submitted programme float — independent CPM not reconciled with the submitted programme',
    authoritativeIndependent,independentForecast,
    reconciliation:review?{disputedActivityCount:review.summary.disputedActivityCount,
      numericDifferenceActivityCount:review.summary.numericDifferenceActivityCount,
      unresolvedActivityCount:review.summary.unresolvedActivityCount}:null,
  };
  cache.set(model,{version:state.version,value});
  return value;
}
