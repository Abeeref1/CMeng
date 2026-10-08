import {refreshResourceSourceFields} from './resource-source-refresh';
import {resourceLaborHourEligible} from '../../schedule-resource-core/src';
import {commercialPositionForState} from './commercial-runtime';
import {cachedIndependentForecast} from './forecast-cache';
import {deliveryFeasibilityForState,programmePcMilestone} from './delivery-feasibility';
import {deliveryPosition} from './delivery-projections';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {resolveWorkingCalendar,addWorkingHours,workingHoursBetween} from '../../schedule-cpm/src/calendar';
import {commercialCanonical} from './commercial-canonical';
import {plotCrewScenarios} from './plot-crew-scenarios';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';

const dayDiff=(later:string|null,earlier:string|null)=>later&&earlier&&Number.isFinite(Date.parse(later))&&Number.isFinite(Date.parse(earlier))?Number(((Date.parse(later)-Date.parse(earlier))/86400000).toFixed(2)):null;
export interface RecoveryScenario {
  drivingPath?:boolean;linkedFloatHours?:number|null;
  remainingWorkHours?:number|null;sourceWorkingDays?:number|null;
  scenarioId:string;type:'additional_crew'|'procurement_expedite'|'additional_shift_or_calendar'|'parallel_workfront_resequence';state:'calculated'|'option_requires_assumption';
  subject:string;affectedActivities:string[];affectedPackages:string[];assumption:string;currentPosition:string;targetPosition:string;
  possibleDaysRecovered:number|null;effectBasis:string;additionalResources:string|null;estimatedCost:number|null;currency:string|null;costBasis:string;
  implementationDate:string|null;constraints:string[];risks:string[];diminishingReturn:string;authority:'scenario';
}
export function recoveryAccelerationIntelligence(state:ProjectRuntimeState){
  const control=projectControlSchedule(state),feasibility=deliveryFeasibilityForState(state),delivery=deliveryPosition(state),programme=control?.revision.model??null,dataDateIso=projectDataDate(state);
  const storedResources=control?state.resourcesByRevision.get(control.revision.revisionId)??null:null;
  const resources=storedResources?refreshResourceSourceFields(state,storedResources):null,commercial=commercialCanonical(state);
  const explicitCurrencies=[...new Set(commercial.costPosition.map(row=>row.currency).filter(Boolean))],resourceCurrency=explicitCurrencies.length===1?explicitCurrencies[0]!:null;
  const resourceById=new Map((resources?.resources??[]).map(r=>[r.resourceId,r]));
  const labourCost=(activityId:string,additionalPeople:number,availableWorkingHours:number|null)=>{
    if(!resources||availableWorkingHours===null||additionalPeople<=0)return null;
    const rows=resources.assignments.filter(a=>{
      if(a.activityId!==activityId||a.resourceType!=='labor'||a.remainingUnits===null||a.remainingUnits<=0||a.remainingCost===null||a.remainingCost===undefined||a.remainingCost<0)return false;
      const resource=a.resourceId?resourceById.get(a.resourceId):null;
      return Boolean(resource&&resourceLaborHourEligible(resource));
    });
    const expected=resources.assignments.filter(a=>a.activityId===activityId&&a.resourceType==='labor'&&(a.remainingUnits??0)>0);
    if(!rows.length||rows.length!==expected.length||!resourceCurrency)return null;
    const units=rows.reduce((sum,row)=>sum+row.remainingUnits!,0),cost=rows.reduce((sum,row)=>sum+row.remainingCost!,0);
    if(units<=0)return null;const rate=cost/units;
    return {amount:Number((additionalPeople*availableWorkingHours*rate).toFixed(2)),currency:resourceCurrency,rate:Number(rate.toFixed(6)),
      basis:'Activity-linked labour assignment remaining cost ÷ remaining labour-hours, applied to the additional average people over the established remaining working hours. The single explicit Project cost currency is '+resourceCurrency+'.'};
  };
  const feasibilityChecks=feasibility?.activityChecks??[];
  const latePackages=delivery.packageRows.filter(p=>p.overdueUndelivered||p.forecastLate);
  const unresolvedChecks=feasibilityChecks.filter(r=>r.scheduleState==='unresolved');
  const crewEligibleChecks=feasibilityChecks.filter(check=>check.scheduleState==='exceeds'&&typeof check.requiredAveragePeople==='number'&&typeof check.submittedPeople==='number'&&check.requiredAveragePeople>check.submittedPeople&&!!check.submittedFinishIso);
  const governedResequencingWorkfronts=delivery.records.filter(r=>r.kind==='workfront'&&['governed','verified'].includes(r.state)&&['yes','true','permitted','allowed'].includes(String(r.fields['resequencing permitted']??r.fields['parallel execution permitted']??'').trim().toLowerCase()));
  const scenarios:RecoveryScenario[]=programme?plotCrewScenarios(programme):[];
  for(const check of feasibilityChecks){
    if(check.scheduleState!=='exceeds'||typeof check.requiredAveragePeople!=='number'||typeof check.submittedPeople!=='number'||check.requiredAveragePeople<=check.submittedPeople||!check.submittedFinishIso)continue;
    const additional=Math.max(1,Math.ceil(check.requiredAveragePeople-check.submittedPeople)),recoverable=dayDiff(check.productionFinishIso,check.submittedFinishIso);
    const cost=labourCost(check.activityId,additional,check.availableWorkingHours??null);
    scenarios.push({scenarioId:'crew:'+check.activityId,type:'additional_crew',state:'calculated',subject:check.activityId,affectedActivities:[check.activityId],affectedPackages:[],
      assumption:'Increase the activity-linked labour capacity from '+check.submittedPeople+' to at least '+Number(check.requiredAveragePeople.toFixed(2))+' average people over the established remaining working period.',
      currentPosition:'At the currently supplied activity crew capacity, quantity-driven production finishes '+(check.productionFinishIso?.slice(0,10)??'at an unresolved date')+'.',
      targetPosition:'The submitted activity finish is '+check.submittedFinishIso.slice(0,10)+'.',
      possibleDaysRecovered:recoverable!==null&&recoverable>0?recoverable:null,effectBasis:'Local activity production finish only: quantity × labour-hours/unit on the activity working calendar. This is not automatically Project completion recovery.',
      additionalResources:additional+' additional average people on the affected activity during the remaining working period.',estimatedCost:cost?.amount??null,currency:cost?.currency??null,
      costBasis:cost?.basis??'Additional cost is not calculated because complete activity-linked remaining labour cost, labour-hour units and one explicit Project cost currency are not all established.',
      implementationDate:dataDateIso,constraints:['The BOQ-to-activity allocation, installed quantity, productivity basis and activity calendar must remain valid.','Project-wide labour sharing and access constraints are not automatically resolved by increasing this activity crew.'],
      risks:['Additional labour may have diminishing productivity where workspace, supervision, plant or access is constrained.'],diminishingReturn:'Do not assume linear recovery beyond the calculated average requirement; productivity should be rechecked after each resource step.',authority:'scenario'});
  }
  for(const p of latePackages){
    const staleForecast=Boolean(p.overdueUndelivered&&(!p.forecastDelivery||dataDateIso&&p.forecastDelivery.slice(0,10)<=dataDateIso.slice(0,10)));
    const knownRecovery=!staleForecast&&p.headroomCalendarDays!==null;
    scenarios.push({scenarioId:'expedite:'+p.recordId,type:'procurement_expedite',state:knownRecovery?'calculated':'option_requires_assumption',subject:p.reference??p.recordId,affectedActivities:[...p.activityIds],affectedPackages:[p.recordId],
      assumption:'Bring forecast delivery forward to the controlled programme need date without changing downstream logic.',
      currentPosition:!knownRecovery?'Required-on-site date '+p.needDate+' has passed; the package remains undelivered and its forecast delivery needs updating.':'Forecast delivery '+p.forecastDelivery+' is '+(-p.headroomCalendarDays!)+' calendar days after need '+p.needDate+'.',
      targetPosition:staleForecast?'Obtain a current achievable delivery date and test the downstream recovery.':'Delivery no later than '+(p.needDate??'the required delivery date')+'.',possibleDaysRecovered:knownRecovery?Math.max(0,-p.headroomCalendarDays!):null,
      effectBasis:'Package delivery headroom recovered locally. This is the maximum procurement lateness removed; Project completion recovery is only established if the linked activity is on a finish-driving path.',
      additionalResources:'Supplier expediting / logistics / approval acceleration to be defined by the package owner.',estimatedCost:null,currency:p.currency,
      costBasis:'Expediting cost is not established in the supplied Project records.',implementationDate:dataDateIso,constraints:['Supplier/manufacturing capability and approval lead times must support the earlier delivery.','A package arriving on time does not prove the linked construction activity will finish earlier.'],
      risks:['Premium freight, resequenced approvals or supplier acceleration may add cost and quality/interface risk.'],diminishingReturn:'Recovery cannot exceed the current package lateness unless downstream work is also resequenced.',authority:'scenario'});
  }
  // Equal-shift sensitivity: only where quantity, productivity, crew and the source calendar are already calculable.
  for(const check of feasibilityChecks.filter(r=>r.scheduleState==='exceeds'&&typeof r.requiredLaborHours==='number'&&typeof r.submittedPeople==='number'&&r.submittedPeople>0)){
    const activity=programme?.activities.find(a=>a.activityId===check.activityId),calendar=activity&&programme?resolveWorkingCalendar(activity.calendarId,programme.calendars,false)?.calendar:null;
    const start=dataDateIso&&activity?Math.max(Date.parse(dataDateIso),Date.parse(activity.forecastStartIso??activity.currentStartIso??dataDateIso)):NaN;
    if(!calendar||!Number.isFinite(start))continue;
    try{
      const current=addWorkingHours(calendar,start,check.requiredLaborHours!/check.submittedPeople!);
      const accelerated=addWorkingHours(calendar,start,check.requiredLaborHours!/(check.submittedPeople!*2));
      const recovered=Number(((current-accelerated)/86400000).toFixed(2));
      if(recovered<=0)continue;
      scenarios.push({scenarioId:'shift:'+check.activityId,type:'additional_shift_or_calendar',state:'calculated',subject:check.activityId,affectedActivities:[check.activityId],affectedPackages:[],
        assumption:'Sensitivity only: add one equivalent productive shift with the same average crew and productivity as the currently evidenced shift. This doubles daily productive capacity; it is not a statement that the Project has approved a second shift.',
        currentPosition:'Quantity-driven production finish at the currently evidenced crew/calendar is '+new Date(current).toISOString().slice(0,10)+'.',
        targetPosition:'Equal-shift sensitivity finish is '+new Date(accelerated).toISOString().slice(0,10)+'.',possibleDaysRecovered:recovered,
        effectBasis:'Required remaining labour-hours are unchanged; the sensitivity halves required source-calendar working hours by doubling equivalent shift capacity. Project completion recovery remains unproven unless downstream logic also moves.',
        additionalResources:'One additional equivalent shift: approximately '+check.submittedPeople+' average people plus matching supervision, access, plant and support where required.',
        estimatedCost:null,currency:null,costBasis:'Shift cost is withheld unless an explicit shift/overtime premium is supplied; base remaining labour cost is not treated as an acceleration premium.',
        implementationDate:dataDateIso,constraints:['The second shift must have equivalent access, productivity, supervision, plant and material availability.','Working-time rules, HSE limits and local approvals must permit the extended operation.'],
        risks:['Night/second-shift productivity may differ from the daytime basis.','Handover between shifts, supervision and congestion can reduce the theoretical recovery.'],
        diminishingReturn:'The equal-shift result is an upper local sensitivity at unchanged productivity; do not extrapolate further shifts linearly.',authority:'scenario'});
    }catch{}
  }

  // Resequencing is calculated only when a governed workfront explicitly permits it and no unfinished predecessor prevents the linked not-started activity from moving to the Data Date.
  if(programme&&dataDateIso){
    const predecessorMap=new Map<string,string[]>();for(const rel of programme.relationships.filter(r=>!r.external)){const list=predecessorMap.get(rel.successorActivityId)??[];list.push(rel.predecessorActivityId);predecessorMap.set(rel.successorActivityId,list);}
    const activities=new Map(programme.activities.map(a=>[a.activityId,a]));
    for(const workfront of delivery.records.filter(r=>r.kind==='workfront'&&['governed','verified'].includes(r.state))){
      const permit=String(workfront.fields['resequencing permitted']??workfront.fields['parallel execution permitted']??'').trim().toLowerCase();
      if(!['yes','true','permitted','allowed'].includes(permit))continue;
      for(const activityId of workfront.links.activityIds){
        const activity=activities.get(activityId);if(!activity||activity.status!=='not_started')continue;
        const predecessors=predecessorMap.get(activityId)??[];
        if(predecessors.some(id=>activities.get(id)?.status!=='completed'))continue;
        if((activity.sourceConstraints??[]).some(c=>c.dateIso&&c.dateIso.slice(0,10)>dataDateIso))continue;
        const currentStart=activity.forecastStartIso??activity.currentStartIso,currentFinish=activity.forecastFinishIso??activity.currentFinishIso,duration=activity.remainingDurationHours??activity.originalDurationHours;
        const calendar=resolveWorkingCalendar(activity.calendarId,programme.calendars,false)?.calendar;
        if(!currentStart||!currentFinish||duration===null||duration<=0||!calendar||Date.parse(currentStart)<=Date.parse(dataDateIso))continue;
        try{
          const scenarioFinish=addWorkingHours(calendar,Date.parse(dataDateIso),duration),recovered=Number(((Date.parse(currentFinish)-scenarioFinish)/86400000).toFixed(2));
          if(recovered<=0)continue;
          scenarios.push({scenarioId:'resequence:'+workfront.recordId+':'+activityId,type:'parallel_workfront_resequence',state:'calculated',subject:workfront.reference??activityId,affectedActivities:[activityId],affectedPackages:[...workfront.links.packageIds],
            assumption:'Use the governed workfront permission to start this not-started activity at the reporting Data Date in parallel with other work, preserving its source-calendar remaining duration.',
            currentPosition:'Current programme start is '+currentStart.slice(0,10)+' and finish is '+currentFinish.slice(0,10)+'.',
            targetPosition:'Resequenced local finish is '+new Date(scenarioFinish).toISOString().slice(0,10)+'.',possibleDaysRecovered:recovered,
            effectBasis:'Local workfront/activity shift only. The calculation requires no unfinished predecessor and no future source constraint; it does not rewrite downstream CPM logic.',
            additionalResources:'Resource sharing is not assumed. Confirm that the workfront can run in parallel without taking labour/plant from another controlling activity.',
            estimatedCost:null,currency:null,costBasis:'No additional cost is asserted because the scenario changes sequence, not evidenced resource quantities.',
            implementationDate:dataDateIso,constraints:['Governed workfront record explicitly permits parallel execution/resequencing.','All internal predecessors are complete at the reporting position.','No retained future source constraint prevents the earlier start.'],
            risks:['Resource conflicts, access interfaces or permits may still prevent the earlier start even when schedule logic does not.'],diminishingReturn:'Recovery is capped at the local start shift shown; downstream recovery requires a fresh CPM calculation after an approved programme change.',authority:'scenario'});
        }catch{}
      }
    }
  }

  for(const check of unresolvedChecks.slice(0,20)){
    scenarios.push({scenarioId:'calendar:'+check.activityId,type:'additional_shift_or_calendar',state:'option_requires_assumption',subject:check.activityId,affectedActivities:[check.activityId],affectedPackages:[],
      assumption:'Evaluate an added shift or calendar extension only after the missing working-time/productivity/resource evidence is established.',currentPosition:check.reason||'Current quantity/resource feasibility is unresolved.',targetPosition:'A quantified recovery target is not yet established.',possibleDaysRecovered:null,effectBasis:'Not calculated; CMeng will not invent hours-per-shift or productivity uplift.',additionalResources:null,estimatedCost:null,currency:null,costBasis:'Not calculable without a quantified shift/calendar and marginal resource cost.',
      implementationDate:null,constraints:['Confirm remaining quantity, productivity, available crew and working calendar first.'],risks:['An assumed extra shift can overstate recovery if access, supervision, materials or productivity do not support it.'],diminishingReturn:'Not calculable until a quantified scenario assumption is entered.',authority:'scenario'});
  }
  const drivingIds=new Set(programme?cachedIndependentForecast(programme,new Date().toISOString()).drivingNetwork?.activityIds??[]:[]),activityById=new Map(programme?.activities.map(row=>[row.activityId,row])??[]);
  for(const scenario of scenarios){scenario.drivingPath=scenario.affectedActivities.some(id=>drivingIds.has(id));const floats=scenario.affectedActivities.map(id=>activityById.get(id)?.totalFloatHours).filter((value):value is number=>typeof value==='number');scenario.linkedFloatHours=floats.length?Math.min(...floats):null;}
  scenarios.sort((a,b)=>Number(b.drivingPath)-Number(a.drivingPath)||(a.linkedFloatHours??Infinity)-(b.linkedFloatHours??Infinity)||(b.possibleDaysRecovered??-1)-(a.possibleDaysRecovered??-1)||a.scenarioId.localeCompare(b.scenarioId));
  const time= commercialPositionForState(state).timeExposure,pc=programmePcMilestone(programme),finish=pc.dateIso;
  const finishActivity=pc.activityIds.length===1?activityById.get(pc.activityIds[0]!):null,calendar=finishActivity&&programme?resolveWorkingCalendar(finishActivity.calendarId,programme.calendars,false)?.calendar:null;
  const target=(dateIso:string|null)=>{let hours:number|null=null;if(calendar&&dateIso&&finish)try{hours=Math.max(0,workingHoursBetween(calendar,Date.parse(dateIso.slice(0,10)),Date.parse(finish.slice(0,10))));}catch{}return {dateIso,calendarDays:dateIso&&finish?Math.max(0,(Date.parse(finish.slice(0,10))-Date.parse(dateIso.slice(0,10)))/86400000):null,workingHours:hours,workingDays:hours!==null&&calendar?.standardDayHours?hours/calendar.standardDayHours:null};};
  const recoveryTargets={submittedCompletionIso:finish,original:target(time.contractualCompletion.value),extended:target(time.officialAdjustedCompletion.value),basis:'Calendar days compare the date portion of the submitted completion and contract dates. Working days use the completion milestone calendar and its standard day hours; this is the recovery target, not a calculated scenario gain.'};
  const calculated=scenarios.filter(s=>s.state==='calculated'),max=calculated.find(s=>s.possibleDaysRecovered!==null)??null;
  const feasibilitySourceRowCount=feasibility?.rows?.length??0;
  const deliveryPackagePopulationCount=delivery.packageRows.length;
  const workfrontPopulationCount=delivery.records.filter(r=>r.kind==='workfront').length;
  const supportingBasisAvailable=
    feasibilitySourceRowCount>0||
    deliveryPackagePopulationCount>0||
    workfrontPopulationCount>0;
  const actualEligibilityChecksPerformed=
    feasibilityChecks.length+
    deliveryPackagePopulationCount+
    governedResequencingWorkfronts.length;
  const eligibility={
    activityFeasibilityCheckCount:feasibilityChecks.length,
    crewAccelerationCandidateCount:crewEligibleChecks.length,
    lateProcurementPackageCount:latePackages.length,
    unresolvedFeasibilityCheckCount:unresolvedChecks.length,
    governedResequencingWorkfrontCount:governedResequencingWorkfronts.length,
    feasibilitySourceRowCount,
    deliveryPackagePopulationCount,
    workfrontPopulationCount,
    supportingBasisAvailable,
    actualEligibilityChecksPerformed,
  };
  const scenarioState=calculated.length?'calculated_options_available':scenarios.length?'options_need_assumptions':'no_eligible_recovery_basis';
  const eligibilityAssessmentState=
    calculated.length
      ? 'calculated_options_available'
      : scenarios.length
        ? 'candidates_need_assumptions'
        : !supportingBasisAvailable
          ? 'supporting_basis_absent'
          : 'checked_no_eligible_basis';
  const managementPosition=max
    ? 'The strongest currently calculable local recovery option is '+max.subject+': up to '+max.possibleDaysRecovered+' days of local '+(max.type==='procurement_expedite'?'procurement headroom':'activity production')+' could be recovered under the stated scenario assumptions. This is not an approved Project plan or guaranteed completion recovery.'
    : scenarios.length
      ? 'Recovery options exist, but the current Project evidence is insufficient to quantify days recovered without additional assumptions. '+unresolvedChecks.length+' feasibility check(s) need a quantified working-time, productivity or resource basis.'
      : 'No recovery option currently meets the calculation criteria. CMeng checked '+feasibilityChecks.length+' activity feasibility position(s), '+latePackages.length+' late procurement package(s) and '+governedResequencingWorkfronts.length+' governed workfront permission(s). A zero is not presented as a recovery result; it means no eligible scenario basis was found.';
  return {schemaVersion:'1.0',projectionKey:'recovery_acceleration',projectId:state.projectId,projectVersion:state.version,dataDateIso,programmeRevisionId:programme?.sourceRevisionId??null,scenarios,recoveryTargets,
    calculatedScenarioCount:calculated.length,assumptionRequiredCount:scenarios.length-calculated.length,scenarioState,eligibility,
    eligibilityAssessmentState,
    managementPosition,
    basis:'Scenarios use existing BOQ/productivity/resource feasibility, source calendars, resource costs where fully supported, governed workfront permissions and package need-date calculations. They never replace the current programme, do not assert entitlement, and retain local-effect versus Project-completion effect separately.'};
}
export function recoveryAccelerationModule(state:ProjectRuntimeState):ModuleRuntimeResult{
  const data=recoveryAccelerationIntelligence(state),hasProjectEvidence=Boolean(projectControlSchedule(state)||state.boqRevisions.length||state.evidenceDocuments.length);
  return {key:'recovery-acceleration',status:data.scenarios.length||hasProjectEvidence?'partial':'blocked',reason:data.managementPosition,dependencies:data.scenarios.length?[]:['remaining quantity/productivity/resource or late-package evidence'],data};
}
