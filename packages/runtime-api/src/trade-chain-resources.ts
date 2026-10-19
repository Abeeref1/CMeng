import {buildTradeChainResourcePosition,type TradeChainActivityGroup,type TradeChainResourcePosition} from '../../resource-utilization/src';
import {resourceLaborHourEligible} from '../../schedule-resource-core/src';
import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';
import {canonicalResources} from './canonical-resource-runtime';
import {refreshResourceSourceFields} from './resource-source-refresh';
import {projectScopeClassification} from './location-review';
import {cachedIndependentForecast} from './forecast-cache';
import type {ActivityScopeClassification} from './schedule-scope-classification';

/** F46: the one shared repeated-trade-chain resource position, read by the
 * project facts and the Resources page. Cached per project version. */
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:TradeChainResourcePosition}>();
const LABOUR_HOUR=/^(labor_hour|labour_hour)$/i;

export function tradeChainResourcesForState(state:ProjectRuntimeState):TradeChainResourcePosition{
  const cached=cache.get(state);if(cached?.version===state.version)return cached.value;
  const value=calculate(state);cache.set(state,{version:state.version,value});return value;
}

function notEstablished(dataDateIso:string|null,reason:string):TradeChainResourcePosition{
  return {schemaVersion:'1.0',projectionKey:'trade_chain_resources',dataDateIso,state:'not_established',reason,
    chainCount:0,establishedChainCount:0,shortfallChainCount:0,
    groupingBasis:'Activities of the same trade (activity code Discipline/Trade, else the labelled name match) joined by programme relationships and spanning two or more locations.',
    periodBasis:'Not calculated.',drivingPathBasis:'Not calculated.',chains:[],diagnostics:[reason]};
}

/** Trade = the SW-27 source discipline/trade group. Location = an explicit or
 * reviewed location group, else the location read from the WBS or activity
 * wording, else the activity's own WBS node. */
export function tradeChainGroups(rows:readonly ActivityScopeClassification[]):TradeChainActivityGroup[]{
  return rows.map(row=>{
    const coded=row.locationGroupBasis==='activity_code'||row.locationGroupBasis==='user_reviewed';
    const location=coded?row.locationGroup??null:row.location??row.wbsPath??null;
    const locationSource=coded?row.locationGroupSource??null:row.location?'From WBS or activity wording':row.wbsPath?'From WBS node':null;
    return {activityId:row.activityId,trade:row.disciplineGroup??null,tradeSource:row.disciplineGroupSource??null,tradeBasis:row.disciplineGroupBasis??null,location,locationSource};
  });
}

function calculate(state:ProjectRuntimeState):TradeChainResourcePosition{
  const current=projectControlSchedule(state);
  if(!current)return notEstablished(null,'CURRENT_PROGRAMME_NOT_ESTABLISHED');
  const model=current.revision.model;
  const stored=state.resourcesByRevision.get(current.revision.revisionId)??null;
  const resources=stored?refreshResourceSourceFields(state,stored):null;
  const labour=new Set((resources?.resources??[]).filter(resourceLaborHourEligible).map(r=>r.resourceId));
  // Without programme labour assignments there are no assigned hours to total;
  // the chain hours stay not established rather than being estimated.
  if(!resources||!resources.assignments.some(a=>a.resourceId&&labour.has(a.resourceId)))
    return notEstablished(model.dataDateIso,'PROGRAMME_LABOUR_HOUR_ASSIGNMENTS_NOT_SUPPLIED');
  const groups=tradeChainGroups(projectScopeClassification(state,model).rows);
  const forecast=cachedIndependentForecast(model,'project-version:'+state.version);
  const network=forecast?.complete?forecast.drivingNetwork??null:null;
  const weekly=canonicalResources(state);
  // The shared register capacity rule (F16): approved capacity, or capacity
  // stated by a register with no approval column (labelled stated, not
  // approved). Capacity a register explicitly leaves unapproved is not used.
  const registerCapacity=weekly.points.flatMap(point=>{
    const capacity=point.utilizationCapacity??point.availableCapacity??null;
    if(capacity===null||!point.weekStartIso||!point.unit||!LABOUR_HOUR.test(point.unit)||point.resourceClass!=='labor')return [];
    return [{resourceId:point.resourceId,resourceName:point.resourceName,weekStartIso:point.weekStartIso,capacityHours:capacity,
      authority:point.availableCapacity!==null?'approved_source' as const:'stated_not_approved' as const,sourceRef:point.sourceRef}];
  });
  return buildTradeChainResourcePosition(model,resources,{
    groups,
    drivingActivityIds:network?network.activityIds:null,
    drivingPathBasis:network?'Driving network traced from the independent CPM finish of the current programme.':'Driving path not established: the independent CPM calculation of the current programme is not complete.',
    registerCapacity,
    capacityConfirmations:(state.resourceCapacityConfirmations??[]).filter(row=>row.sourceRevisionId===current.revision.revisionId),
  });
}

/** Compact project-facts view: no period rows. */
export function tradeChainFacts(position:TradeChainResourcePosition){
  return {state:position.state,reason:position.reason,dataDateIso:position.dataDateIso,chainCount:position.chainCount,
    establishedChainCount:position.establishedChainCount,shortfallChainCount:position.shortfallChainCount,
    groupingBasis:position.groupingBasis,periodBasis:position.periodBasis,drivingPathBasis:position.drivingPathBasis,
    chains:position.chains.map(chain=>({chainId:chain.chainId,trade:chain.trade,tradeSource:chain.tradeSource,
      activityCount:chain.activityIds.length,openActivityCount:chain.openActivityIds.length,firstActivityId:chain.activityIds[0]??null,lastActivityId:chain.activityIds.at(-1)??null,
      locations:chain.locations,onDrivingPath:chain.onDrivingPath,remainingHours:chain.remainingHours,totalShortfallHours:chain.totalShortfallHours,
      resources:chain.resources.map(row=>({resourceId:row.resourceId,resourceName:row.resourceName,remainingHours:row.remainingHours,capacitySource:row.capacitySource,
        totalShortfallHours:row.totalShortfallHours,peakShortfallHours:row.peakShortfallHours,firstShortfallPeriodIso:row.firstShortfallPeriodIso,state:row.state})),
      completionEffect:chain.completionEffect,state:chain.state,reasons:chain.reasons}))};
}
