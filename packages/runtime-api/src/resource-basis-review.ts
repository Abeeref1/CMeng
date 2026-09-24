import {isExecutionActivity,parseScheduleTime} from '../../schedule-analysis-core/src';
import {sumKnown} from '../../truth-kernel/src';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {hseReportPosition} from './hse-report-evidence';
import {refreshResourceSourceFields} from './resource-source-refresh';
import {commercialCanonical} from './commercial-canonical';
import type {ProjectRuntimeState} from './project-state-types';
import type {WeeklyResourceCapacitySummary} from './canonical-resource-evidence';

const reviews=new WeakMap<ProjectRuntimeState,{version:number;weekly:WeeklyResourceCapacitySummary;value:ReturnType<typeof calculateResourceBasisReview>}>();
export function resourceBasisReview(state:ProjectRuntimeState,weekly:WeeklyResourceCapacitySummary){
  const cached=reviews.get(state);if(cached?.version===state.version&&cached.weekly===weekly)return cached.value;
  const value=calculateResourceBasisReview(state,weekly);reviews.set(state,{version:state.version,weekly,value});return value;
}
function calculateResourceBasisReview(state:ProjectRuntimeState,weekly:WeeklyResourceCapacitySummary){
  const current=projectControlSchedule(state),date=projectDataDate(state);
  const stored=current?state.resourcesByRevision.get(current.revision.revisionId):null;
  const model=stored?refreshResourceSourceFields(state,stored):null;
  const labor=model?.assignments.filter(a=>a.resourceType==='labor')??[];
  const sum=(values:Array<number|null|undefined>)=>sumKnown(values.map(v=>v??null));
  const periods=weekly.weeklyTotals.filter(r=>r.resourceClass==='labor'&&r.unit==='labor_hour'&&r.weekStartIso).sort((a,b)=>a.weekStartIso!.localeCompare(b.weekStartIso!));
  const through=periods.filter(r=>date&&r.weekStartIso!<=date);
  const fullPlan=sum(periods.map(r=>r.plannedDemand)),planToDate=sum(through.map(r=>r.plannedDemand)),actualToDate=sum(through.map(r=>r.actualApprovedUsage));
  const execution=current?.revision.model.activities.filter(isExecutionActivity)??[];
  const starts=execution.map(a=>a.currentStartIso??a.forecastStartIso??a.actualStartIso).filter((d):d is string=>Boolean(d)).sort();
  const finishes=execution.map(a=>a.forecastFinishIso??a.currentFinishIso??a.actualFinishIso).filter((d):d is string=>Boolean(d)).sort();
  const start=starts[0]??null,finish=finishes.at(-1)??null,last=periods.at(-1)?.weekStartIso??null;
  const regularActual=sum(labor.map(a=>a.actualRegularUnits));
  const costs=model?.assignments??[];
  const loadedCost=sum(costs.map(a=>a.plannedCost)),regularCost=sum(costs.map(a=>a.actualRegularCost));
  const byWeek=new Map<string,typeof weekly.points>();
  for(const row of weekly.points){if(!row.weekStartIso)continue;const list=byWeek.get(row.weekStartIso)??[];list.push(row);byWeek.set(row.weekStartIso,list);}
  const exceptions=[...byWeek].sort(([a],[b])=>a.localeCompare(b)).map(([dateIso,rows])=>({dateIso,
    plannedExceeded:rows.filter(r=>r.availableCapacity!==null&&r.plannedDemand!==null&&r.plannedDemand>r.availableCapacity).length,
    actualExceeded:date&&dateIso<=date?rows.filter(r=>r.availableCapacity!==null&&r.actualApprovedUsage!==null&&r.actualApprovedUsage>r.availableCapacity).length:null,
    comparableCount:rows.filter(r=>r.availableCapacity!==null&&r.plannedDemand!==null).length}));
  return {dataDateIso:date,weekly:{plannedHours:fullPlan,plannedHoursToDate:planToDate,actualHoursToDate:actualToDate,
    futurePlannedHours:fullPlan!==null&&planToDate!==null?fullPlan-planToDate:null,
    periodCount:periods.length,periodsThroughDataDate:through.length,firstWeekStartIso:periods[0]?.weekStartIso??null,lastWeekStartIso:last,
    averageApprovedHoursPerWeek:actualToDate!==null&&through.length?actualToDate/through.length:null},
    programme:{startIso:start,finishIso:finish,calendarWeekSpan:start&&finish?(parseScheduleTime(finish)-parseScheduleTime(start))/604800000:null,
      registerEndsBeforeProgramme:Boolean(last&&finish&&last<finish.slice(0,10))},
    xer:{laborAssignmentCount:labor.length,plannedLaborHours:sum(labor.map(a=>a.plannedUnits)),actualRegularLaborHours:regularActual,
      actualOvertimeLaborHours:sum(labor.map(a=>a.actualOvertimeUnits)),remainingLaborHours:sum(labor.map(a=>a.remainingUnits)),
      loadedCost,actualRegularCost:regularCost,actualOvertimeCost:sum(costs.map(a=>a.actualOvertimeCost)),remainingCost:sum(costs.map(a=>a.remainingCost)),
      actualRegularCostPercent:loadedCost&&regularCost!==null?regularCost/loadedCost*100:null,currency:'Not stated in these assignment columns'},
    costReports:commercialCanonical(state).costPosition.map(r=>({asOfIso:r.asOf,currency:r.currency,taxBasis:r.taxBasis,values:r.values,sourceRefs:r.receipts,diagnostics:r.diagnostics})),
    hse:hseReportPosition(state,date),
    weeklyToXerActualRegularRatio:actualToDate!==null&&regularActual?actualToDate/regularActual:null,
    capacityExceptionTrend:exceptions,
    interpretation:'The sources report different hour totals and horizons. Weekly staffing demand, schedule assignment budgets and HSE exposure are separate bases that need reconciliation. Coverage means completeness of the supplied rows, not the entire programme. Remaining assignment hours and future planned register hours are budgets, not measured productive work.'};
}
