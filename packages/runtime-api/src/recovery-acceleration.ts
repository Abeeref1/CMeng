import {deliveryFeasibilityForState} from './delivery-feasibility';
import {deliveryPosition} from './delivery-projections';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';

const dayDiff=(later:string|null,earlier:string|null)=>later&&earlier&&Number.isFinite(Date.parse(later))&&Number.isFinite(Date.parse(earlier))?Number(((Date.parse(later)-Date.parse(earlier))/86400000).toFixed(2)):null;
export interface RecoveryScenario {
  scenarioId:string;type:'additional_crew'|'procurement_expedite'|'additional_shift_or_calendar';state:'calculated'|'option_requires_assumption';
  subject:string;affectedActivities:string[];affectedPackages:string[];assumption:string;currentPosition:string;targetPosition:string;
  possibleDaysRecovered:number|null;effectBasis:string;additionalResources:string|null;estimatedCost:number|null;currency:string|null;costBasis:string;
  implementationDate:string|null;constraints:string[];risks:string[];diminishingReturn:string;authority:'scenario';
}
export function recoveryAccelerationIntelligence(state:ProjectRuntimeState){
  const feasibility=deliveryFeasibilityForState(state),delivery=deliveryPosition(state),programme=projectControlSchedule(state)?.revision.model??null,dataDateIso=projectDataDate(state);
  const scenarios:RecoveryScenario[]=[];
  for(const check of feasibility?.activityChecks??[]){
    if(check.scheduleState!=='exceeds'||typeof check.requiredAveragePeople!=='number'||typeof check.submittedPeople!=='number'||check.requiredAveragePeople<=check.submittedPeople||!check.submittedFinishIso)continue;
    const additional=Math.max(1,Math.ceil(check.requiredAveragePeople-check.submittedPeople)),recoverable=dayDiff(check.productionFinishIso,check.submittedFinishIso);
    scenarios.push({scenarioId:'crew:'+check.activityId,type:'additional_crew',state:'calculated',subject:check.activityId,affectedActivities:[check.activityId],affectedPackages:[],
      assumption:'Increase the activity-linked labour capacity from '+check.submittedPeople+' to at least '+Number(check.requiredAveragePeople.toFixed(2))+' average people over the established remaining working period.',
      currentPosition:'At the currently supplied activity crew capacity, quantity-driven production finishes '+(check.productionFinishIso?.slice(0,10)??'at an unresolved date')+'.',
      targetPosition:'The submitted activity finish is '+check.submittedFinishIso.slice(0,10)+'.',
      possibleDaysRecovered:recoverable!==null&&recoverable>0?recoverable:null,effectBasis:'Local activity production finish only: quantity × labour-hours/unit on the activity working calendar. This is not automatically Project completion recovery.',
      additionalResources:additional+' additional average people on the affected activity during the remaining working period.',estimatedCost:null,currency:null,
      costBasis:'Additional cost is not calculated because the canonical resource evidence does not establish a currency-specific marginal labour rate for this scenario.',
      implementationDate:dataDateIso,constraints:['The BOQ-to-activity allocation, installed quantity, productivity basis and activity calendar must remain valid.','Project-wide labour sharing and access constraints are not automatically resolved by increasing this activity crew.'],
      risks:['Additional labour may have diminishing productivity where workspace, supervision, plant or access is constrained.'],diminishingReturn:'Do not assume linear recovery beyond the calculated average requirement; productivity should be rechecked after each resource step.',authority:'scenario'});
  }
  for(const p of delivery.packageRows.filter(p=>typeof p.headroomCalendarDays==='number'&&p.headroomCalendarDays<0)){
    scenarios.push({scenarioId:'expedite:'+p.recordId,type:'procurement_expedite',state:'calculated',subject:p.reference??p.recordId,affectedActivities:[...p.activityIds],affectedPackages:[p.recordId],
      assumption:'Bring forecast delivery forward to the controlled programme need date without changing downstream logic.',
      currentPosition:'Forecast delivery '+(p.forecastDelivery??'unresolved')+' is '+(-p.headroomCalendarDays!)+' calendar days after programme need '+(p.programmeNeedDate??'unresolved')+'.',
      targetPosition:'Delivery no later than '+(p.programmeNeedDate??'the controlled programme need date')+'.',possibleDaysRecovered:-p.headroomCalendarDays!,
      effectBasis:'Package delivery headroom recovered locally. This is the maximum procurement lateness removed; Project completion recovery is only established if the linked activity is on a finish-driving path.',
      additionalResources:'Supplier expediting / logistics / approval acceleration to be defined by the package owner.',estimatedCost:null,currency:p.currency,
      costBasis:'Expediting cost is not established in the supplied Project records.',implementationDate:dataDateIso,constraints:['Supplier/manufacturing capability and approval lead times must support the earlier delivery.','A package arriving on time does not prove the linked construction activity will finish earlier.'],
      risks:['Premium freight, resequenced approvals or supplier acceleration may add cost and quality/interface risk.'],diminishingReturn:'Recovery cannot exceed the current package lateness unless downstream work is also resequenced.',authority:'scenario'});
  }
  const unresolved=(feasibility?.activityChecks??[]).filter(r=>r.scheduleState==='unresolved');
  for(const check of unresolved.slice(0,20)){
    scenarios.push({scenarioId:'calendar:'+check.activityId,type:'additional_shift_or_calendar',state:'option_requires_assumption',subject:check.activityId,affectedActivities:[check.activityId],affectedPackages:[],
      assumption:'Evaluate an added shift or calendar extension only after the missing working-time/productivity/resource evidence is established.',currentPosition:check.reason||'Current quantity/resource feasibility is unresolved.',targetPosition:'A quantified recovery target is not yet established.',possibleDaysRecovered:null,effectBasis:'Not calculated; CMeng will not invent hours-per-shift or productivity uplift.',additionalResources:null,estimatedCost:null,currency:null,costBasis:'Not calculable without a quantified shift/calendar and marginal resource cost.',
      implementationDate:null,constraints:['Confirm remaining quantity, productivity, available crew and working calendar first.'],risks:['An assumed extra shift can overstate recovery if access, supervision, materials or productivity do not support it.'],diminishingReturn:'Not calculable until a quantified scenario assumption is entered.',authority:'scenario'});
  }
  scenarios.sort((a,b)=>(b.possibleDaysRecovered??-1)-(a.possibleDaysRecovered??-1)||a.scenarioId.localeCompare(b.scenarioId));
  const calculated=scenarios.filter(s=>s.state==='calculated'),max=calculated.find(s=>s.possibleDaysRecovered!==null)??null;
  return {schemaVersion:'1.0',projectionKey:'recovery_acceleration',projectId:state.projectId,projectVersion:state.version,dataDateIso,programmeRevisionId:programme?.sourceRevisionId??null,scenarios,
    calculatedScenarioCount:calculated.length,assumptionRequiredCount:scenarios.length-calculated.length,
    managementPosition:max?'The strongest currently calculable local recovery option is '+max.subject+': up to '+max.possibleDaysRecovered+' days of local '+(max.type==='procurement_expedite'?'procurement headroom':'activity production')+' could be recovered under the stated scenario assumptions. This is not an approved Project plan or guaranteed completion recovery.':
      scenarios.length?'Recovery options exist, but the current Project evidence is insufficient to quantify days recovered without additional assumptions.':'No recovery scenario can be quantified from the current Project information.',
    basis:'Scenarios use existing BOQ/productivity/resource feasibility and package need-date calculations. They never replace the current programme, do not assert entitlement, and retain local-effect versus Project-completion effect separately.'};
}
export function recoveryAccelerationModule(state:ProjectRuntimeState):ModuleRuntimeResult{
  const data=recoveryAccelerationIntelligence(state);return {key:'recovery-acceleration',status:data.scenarios.length?'partial':'blocked',reason:data.managementPosition,dependencies:data.scenarios.length?[]:['remaining quantity/productivity/resource or late-package evidence'],data};
}
