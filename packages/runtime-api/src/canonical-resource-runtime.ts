import { weeklyResourceCapacityEvidence, type WeeklyResourceCapacitySummary } from './canonical-resource-evidence';
import { projectDataDate, projectControlSchedule } from './canonical-time-claims';
import { buildResourceUtilizationProjection } from '../../resource-utilization/src';
import { sumKnown, round } from '../../truth-kernel/src';
import type { ProjectRuntimeState, ModuleRuntimeResult } from './project-state-types';
const cache=new WeakMap<ProjectRuntimeState,{version:number;summary:WeeklyResourceCapacitySummary}>();
export function canonicalResources(state:ProjectRuntimeState):WeeklyResourceCapacitySummary{
 const cached=cache.get(state);if(cached?.version===state.version)return cached.summary;
 const summary=weeklyResourceCapacityEvidence(state.evidenceDocuments,projectDataDate(state));cache.set(state,{version:state.version,summary});return summary;
}
export function canonicalResourceModule(state:ProjectRuntimeState,key:string):ModuleRuntimeResult|null{
 if(key!=='resource-utilization'&&key!=='manhour-scurve')return null;
 const summary=canonicalResources(state);if(summary.state==='not_found')return null;
 const generatedAt=new Date().toISOString();
 const current=projectControlSchedule(state);
 const resourceModel=current?state.resourcesByRevision.get(current.revision.revisionId):null;
 let data:unknown;
 if(key==='resource-utilization'){
  const hourly=resourceModel&&current?buildResourceUtilizationProjection(resourceModel,current.revision.model,{generatedAt,producerVersion:'p6-hourly-capacity-v1'}):null;
  const weeklyAssignedResourceCount=new Set(summary.points.map(p=>p.resourceId).filter(Boolean)).size;
  const distinctResourceCount=summary.masterResources.length||summary.observedResourceCount||hourly?.resourceCount||summary.resourceCount;
  const distinctAssignedResourceCount=weeklyAssignedResourceCount||hourly?.assignedResourceCount||0;
  data={...(hourly??{schemaVersion:'1.0',projectionKey:'resource_utilization',rows:[],assignedResourceCount:0,assignmentRecordCount:0,resourcePopulationBasis:'weekly_resource_evidence'}),
   producerVersion:'resource-source-integration-v1',generatedAt,projectId:state.projectId,sourceRevisionId:current?.revision.revisionId??null,dataDateIso:summary.dataDateIso,
   utilizationBasis:'weekly_source_evidence',resourcePopulationBasis:'weekly_resource_evidence',
   resourceCount:distinctResourceCount,assignedResourceCount:distinctAssignedResourceCount,
   assignmentRecordCount:resourceModel?.assignments.length??0,
   resourcePeriodRowCount:summary.rowCount,comparableResourcePeriodRowCount:summary.comparableRowCount,
   utilizationApplicableResourceCount:summary.resourceCount,capacityBasedResourceCount:summary.resourceCount,
   capacityCoveragePercent:summary.capacityCoveragePercent,perHourCapacityBasedResourceCount:hourly?.capacityBasedResourceCount??0,
   perHourCapacityCoveragePercent:hourly?.capacityCoveragePercent??null,perHourOverloadedResourceCount:hourly?.overloadedResourceCount??null,
   overloadedResourceCount:new Set(summary.points.filter(p=>p.availableCapacity!==null&&p.plannedDemand!==null&&p.plannedDemand>p.availableCapacity).map(p=>p.resourceId)).size,
   plannedUtilizationPercent:summary.plannedAverageToDataDate,actualUtilizationPercent:summary.actualAverageToDataDate,
   weeklyCapacityEvidence:summary,weeklyResourceRows:summary.resourceSummaries,diagnostics:summary.diagnostics,
  };
 }else{
  const labor=summary.weeklyTotals.filter(p=>p.resourceClass==='labor'&&p.unit==='labor_hour'&&p.weekStartIso!==null);
  if(!labor.length)return null;
  let planned:number|null=0,actual:number|null=0;
  const points=labor.map(p=>{planned=planned===null||p.plannedDemand===null?null:planned+p.plannedDemand;
   const historical=summary.dataDateIso!==null&&p.weekStartIso!<=summary.dataDateIso;
   if(historical)actual=actual===null||p.actualApprovedUsage===null?null:actual+p.actualApprovedUsage;
   return {dateIso:p.weekStartIso,plannedCumulativeHours:round(planned),actualCumulativeHours:historical?round(actual):null,forecastCumulativeHours:null};});
  data={schemaVersion:'1.0',projectionKey:'manhour_scurve',producerVersion:'resource-source-integration-v1',generatedAt,projectId:state.projectId,sourceRevisionId:current?.revision.revisionId??null,dataDateIso:summary.dataDateIso,
   unitBasis:'source_labor_hours',plannedTimePhasing:'source_weekly_demand',remainingTimePhasing:'not_established',actualHistoryMethod:'source_approved_weekly_usage',
   laborResourceCount:summary.resourceSummaries.filter(p=>p.resourceClass==='labor').length,laborAssignmentCount:resourceModel?.assignments.filter(a=>a.resourceType==='labor').length??null,
   plannedHoursKnown:sumKnown(labor.map(p=>p.plannedDemand)),actualHoursKnownCurrent:actual,remainingHoursKnown:null,
   plannedState:planned===null?'partial':'complete',actualState:actual===null?'partial':'complete',forecastState:'missing',
   plannedAssignmentCoveragePercent:null,plannedCurveCoveragePercent:null,actualAssignmentCoveragePercent:null,periodActualAssignmentCoveragePercent:null,remainingAssignmentCoveragePercent:null,remainingCurveCoveragePercent:null,
   points,sourcePeriodStart:points[0]?.dateIso??null,sourcePeriodEnd:points.at(-1)?.dateIso??null,
   assumptions:['Resource staffing demand and approved usage remain distinct from P6 assignment budget hours. Source coverage does not imply full-project lifetime coverage.'],
   diagnostics:[...summary.diagnostics,'FORECAST_CURVE_WITHHELD_PENDING_GOVERNED_REMAINING_HOURS'],
   receipts:summary.points.filter(p=>p.resourceClass==='labor').flatMap(p=>p.receipts),
  };
 }
 return {key,status:summary.state==='available'&&key==='resource-utilization'?'ready':'partial',reason:key==='manhour-scurve'?'Measured weekly labor history; remaining-hours forecast not established.':summary.state==='available'?null:'Source candidate or reconciliation gaps require review.',dependencies:['resource master','weekly capacity','approved usage','programme Data Date'],data};
}
