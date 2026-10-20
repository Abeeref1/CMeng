import {countUnit} from './count-text';
import {projectScopeClassification} from './location-review';

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
import {classifyRecoveryAgainstCompletion,type RecoveryCpmChange} from './recovery-completion-path';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';
import {tradeChainResourcesForState} from './trade-chain-resources';
import {heldDataCrewCandidates} from './recovery-held-data';

const dayDiff=(later:string|null,earlier:string|null)=>later&&earlier&&Number.isFinite(Date.parse(later))&&Number.isFinite(Date.parse(earlier))?Number(((Date.parse(later)-Date.parse(earlier))/86400000).toFixed(2)):null;
export interface RecoveryScenario {
  drivingPath?:boolean|null;linkedFloatHours?:number|null;linkedFloatActivityId?:string|null;linkedFloatCalendarIds?:(string|null)[];
  remainingWorkHours?:number|null;sourceWorkingDays?:number|null;
  scenarioId:string;type:'additional_crew'|'procurement_expedite'|'additional_shift_or_calendar'|'parallel_workfront_resequence';state:'calculated'|'option_requires_assumption';
  subject:string;affectedActivities:string[];affectedPackages:string[];assumption:string;currentPosition:string;targetPosition:string;
  possibleDaysRecovered:number|null;effectBasis:string;additionalResources:string|null;estimatedCost:number|null;currency:string|null;costBasis:string;
  implementationDate:string|null;constraints:string[];risks:string[];diminishingReturn:string;authority:'scenario';
  // SW-24: role against the CPM path to completion, and the CPM completion gain.
  cpmChange?:RecoveryCpmChange|null;pathRole?:'recovery_option'|'late_work'|'path_not_established';pathBasis?:string;
  completionGainWorkingDays?:number|null;completionGainBasis?:string;
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
  const scenarios:RecoveryScenario[]=programme?plotCrewScenarios(programme,new Map(projectScopeClassification(state,programme).rows.map(r=>[r.activityId,r.plot]))):[];
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
      risks:['Additional labour may have diminishing productivity where workspace, supervision, plant or access is constrained.'],diminishingReturn:'Do not assume linear recovery beyond the calculated average requirement; productivity should be rechecked after each resource step.',authority:'scenario',
      // Stated crew ratio: submitted people over the scenario crew (submitted plus additional).
      cpmChange:check.submittedPeople>0?{removeRelationshipIds:[],addRelationships:[],durationScale:[{activityId:check.activityId,factor:check.submittedPeople/(check.submittedPeople+additional)}]}:null});
  }
  for(const p of latePackages){
    const staleForecast=Boolean(p.overdueUndelivered&&(!p.forecastDelivery||dataDateIso&&p.forecastDelivery.slice(0,10)<=dataDateIso.slice(0,10)));
    const pastNeed=Boolean(dataDateIso&&p.needDate&&p.needDate.slice(0,10)<dataDateIso.slice(0,10));
    const knownRecovery=!!dataDateIso&&!pastNeed&&!staleForecast&&p.headroomCalendarDays!==null;
    scenarios.push({scenarioId:'expedite:'+p.recordId,type:'procurement_expedite',state:knownRecovery?'calculated':'option_requires_assumption',subject:p.reference??p.recordId,affectedActivities:[...p.activityIds],affectedPackages:[p.recordId],
      assumption:knownRecovery?'Bring forecast delivery forward to the programme need date without changing downstream logic.':'Establish an achievable future delivery date and its effect on the remaining work.',
      currentPosition:pastNeed?'Required-on-site date '+p.needDate+' has passed. Historical lateness cannot be counted as future recovery.':!knownRecovery?'The current delivery forecast and reporting date must be established before recovery can be calculated.':'Forecast delivery '+p.forecastDelivery+' is '+(-p.headroomCalendarDays!)+' calendar days after need '+p.needDate+'.',
      targetPosition:!knownRecovery?'Obtain a current achievable delivery date and test the downstream recovery.':'Delivery no later than '+(p.needDate??'the required delivery date')+'.',possibleDaysRecovered:knownRecovery?Math.max(0,-p.headroomCalendarDays!):null,
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
        diminishingReturn:'The equal-shift result is an upper local sensitivity at unchanged productivity; do not extrapolate further shifts linearly.',authority:'scenario',
        // Stated working-hours ratio of the new shift pattern: required hours on two equal shifts over one.
        cpmChange:{removeRelationshipIds:[],addRelationships:[],durationScale:[{activityId:check.activityId,factor:(check.requiredLaborHours!/(check.submittedPeople!*2))/(check.requiredLaborHours!/check.submittedPeople!)}]}});
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
            risks:['Resource conflicts, access interfaces or permits may still prevent the earlier start even when schedule logic does not.'],diminishingReturn:'Recovery is capped at the local start shift shown; downstream recovery requires a fresh CPM calculation after an approved programme change.',authority:'scenario',
            cpmChange:{removeRelationshipIds:programme.relationships.filter(r=>!r.external&&r.successorActivityId===activityId).map(r=>r.relationshipId),addRelationships:[]}});
        }catch{}
      }
    }
  }

  for(const check of unresolvedChecks.slice(0,20)){
    scenarios.push({scenarioId:'calendar:'+check.activityId,type:'additional_shift_or_calendar',state:'option_requires_assumption',subject:check.activityId,affectedActivities:[check.activityId],affectedPackages:[],
      assumption:'Evaluate an added shift or calendar extension only after the missing working-time/productivity/resource evidence is established.',currentPosition:check.reason||'Current quantity/resource feasibility is unresolved.',targetPosition:'A quantified recovery target is not yet established.',possibleDaysRecovered:null,effectBasis:'Not calculated; CMeng will not invent hours-per-shift or productivity uplift.',additionalResources:null,estimatedCost:null,currency:null,costBasis:'Not calculable without a quantified shift/calendar and marginal resource cost.',
      implementationDate:null,constraints:['Confirm remaining quantity, productivity, available crew and working calendar first.'],risks:['An assumed extra shift can overstate recovery if access, supervision, materials or productivity do not support it.'],diminishingReturn:'Not calculable until a quantified scenario assumption is entered.',authority:'scenario'});
  }
  const forecast=programme?cachedIndependentForecast(programme,new Date().toISOString()):null;
  const drivingNetwork=forecast?.complete?forecast.drivingNetwork:null;
  const drivingIds=new Set(drivingNetwork?.activityIds??[]),activityById=new Map(programme?.activities.map(row=>[row.activityId,row])??[]);
  // S-24: show a sixth-working-day option without manufacturing an approved
  // extra calendar day, crew capacity or a guaranteed project-wide recovery.
  const fiveDayCalendars=new Set((programme?.calendars??[]).filter(calendar=>
    calendar.weeklyWorkMinutes?.length===7&&calendar.weeklyWorkMinutes.every(minutes=>Number.isFinite(minutes)&&minutes>=0)&&calendar.weeklyWorkMinutes.filter(minutes=>minutes>0).length===5).map(calendar=>calendar.calendarId));
  const drivingStatusComplete=!!drivingNetwork&&[...drivingIds].every(id=>['completed','in_progress','not_started'].includes(activityById.get(id)?.status??''));
  const drivingOpen=(programme?.activities??[]).filter(activity=>drivingIds.has(activity.activityId)&&['in_progress','not_started'].includes(activity.status));
  const fiveDayDriving=drivingOpen.filter(activity=>fiveDayCalendars.has(activity.calendarId??''));
  const drivingCalendarsComplete=drivingStatusComplete&&drivingOpen.every(activity=>{
    const calendar=programme?.calendars.find(row=>row.calendarId===activity.calendarId);
    return calendar?.weeklyWorkMinutes?.length===7&&calendar.weeklyWorkMinutes.every(minutes=>Number.isFinite(minutes)&&minutes>=0);
  });
  if(drivingOpen.length){
    scenarios.push({scenarioId:'sixth-working-day:'+String(programme?.sourceRevisionId||'current'),
      type:'additional_shift_or_calendar',state:'option_requires_assumption',
      subject:'Sixth working day — completion-driving chain',
      affectedActivities:(fiveDayDriving.length?fiveDayDriving:drivingOpen).slice(0,25).map(a=>a.activityId),
      affectedPackages:[],
      assumption:'Candidate six-working-day week only for currently unfinished completion-driving work. Do not assume source calendar approval, crew availability or overtime permission.',
      currentPosition:fiveDayDriving.length+' known unfinished driving activities have five-day source calendars; '+drivingOpen.length+' known unfinished activities sit on the calculated completion-driving network.'+(!drivingStatusComplete||!drivingCalendarsComplete?' Complete counts need the remaining activity status/calendar evidence.':''),
      targetPosition:'Confirm the sixth day, lawful work arrangements, source crew productivity, access and materials; recalculate the entire CPM network before asserting a recovered completion date.',
      possibleDaysRecovered:null,
      effectBasis:'Source working-day shortfall to the current contract date is disclosed separately. Added days are a scenario, not an asserted extension of contractual working time or guaranteed project recovery.',
      additionalResources:'Source-supported trade crews and matching supervision, access, plant, inspections and support for one additional working day.',
      estimatedCost:null,currency:null,
      costBasis:'Marginal overtime, workweek premiums and supervision/plant cost have not been established.',
      implementationDate:dataDateIso,
      constraints:['Confirm the governing source calendar and permitted sixth day.','Verify approved resource capacity and actual productivity on the driving chain.','Confirm workfront/material/HSE/legal readiness.','Recalculate the entire network before claiming recovered project days.'],
      risks:['Additional-day labour and supplier availability may differ from normal shifts.','Calendar changes can move downstream interfaces and the near-critical activities.'],
      diminishingReturn:'Do not assume linear weekly improvement where workfront congestion, shared crews or approvals constrain production.',
      authority:'scenario'});
  }
  for(const scenario of scenarios){scenario.drivingPath=scenario.affectedActivities.some(id=>drivingIds.has(id))?true:drivingNetwork&&scenario.affectedActivities.length&&scenario.affectedActivities.every(id=>activityById.has(id))?false:null;const floats=scenario.affectedActivities.map(id=>activityById.get(id)?.totalFloatHours).filter((value):value is number=>typeof value==='number');scenario.linkedFloatHours=floats.length?Math.min(...floats):null;scenario.linkedFloatActivityId=scenario.linkedFloatHours===null?null:scenario.affectedActivities.find(id=>activityById.get(id)?.totalFloatHours===scenario.linkedFloatHours)??null;scenario.linkedFloatCalendarIds=[...new Set(scenario.affectedActivities.filter(id=>typeof activityById.get(id)?.totalFloatHours==='number').map(id=>activityById.get(id)!.calendarId??null))];}
  scenarios.sort((a,b)=>Number(b.drivingPath)-Number(a.drivingPath)||(a.linkedFloatHours??Infinity)-(b.linkedFloatHours??Infinity)||(b.possibleDaysRecovered??-1)-(a.possibleDaysRecovered??-1)||a.scenarioId.localeCompare(b.scenarioId));
  const time= commercialPositionForState(state).timeExposure,pc=programmePcMilestone(programme),finish=pc.dateIso;
  const finishActivity=pc.activityIds.length===1?activityById.get(pc.activityIds[0]!):null,calendar=finishActivity&&programme?resolveWorkingCalendar(finishActivity.calendarId,programme.calendars,false)?.calendar:null;
  const completionPath=classifyRecoveryAgainstCompletion(scenarios,programme,forecast??null,calendar??null);
  const pathRank={recovery_option:0,path_not_established:1,late_work:2} as const;
  scenarios.sort((a,b)=>pathRank[a.pathRole??'path_not_established']-pathRank[b.pathRole??'path_not_established']);
  const target=(dateIso:string|null)=>{let hours:number|null=null;if(calendar&&dateIso&&finish)try{hours=Math.max(0,workingHoursBetween(calendar,Date.parse(dateIso.slice(0,10)),Date.parse(finish.slice(0,10))));}catch{}return {dateIso,calendarDays:dateIso&&finish?Math.max(0,(Date.parse(finish.slice(0,10))-Date.parse(dateIso.slice(0,10)))/86400000):null,workingHours:hours,workingDays:hours!==null&&calendar?.standardDayHours?hours/calendar.standardDayHours:null};};
  const recoveryTargets={submittedCompletionIso:finish,original:target(time.contractualCompletion.value),extended:target(time.officialAdjustedCompletion.value),basis:'Calendar days compare the date portion of the submitted completion and contract dates. Working days use the completion milestone calendar and its standard day hours; this is the recovery target, not a calculated scenario gain.'};
  const drivingChainShortfall={calendarDays:recoveryTargets.extended.calendarDays,
    workingDays:recoveryTargets.extended.workingDays,
    fiveDayDrivingActivityCount:drivingCalendarsComplete?fiveDayDriving.length:null,
    knownFiveDayDrivingActivityCount:fiveDayDriving.length,
    drivingOpenActivityCount:drivingStatusComplete?drivingOpen.length:null,
    knownDrivingOpenActivityCount:drivingOpen.length,
    sixthDayScenarioAvailable:drivingOpen.length>0?true:drivingStatusComplete?false:null,
    basis:'Submitted project finish versus current contractual completion including awarded EOT, using the completion milestone calendar. A sixth working day is a candidate only, not approved recoverable time.'};
  // SW-24: only options on the path to completion count, and "calculated"
  // means the completion gain came from a CMeng CPM run, not a local effect.
  const recoveryOptions=scenarios.filter(s=>s.pathRole==='recovery_option');
  const calculated=recoveryOptions.filter(s=>typeof s.completionGainWorkingDays==='number'),max=[...calculated].sort((a,b)=>b.completionGainWorkingDays!-a.completionGainWorkingDays!)[0]??null;
  const lateWorkNote=completionPath.lateWorkCount?' '+completionPath.lateWorkCount+' late item(s) are off the CPM path to completion: late work, not recovery.':'';
  const feasibilitySourceRowCount=feasibility?.rows?.length??0;
  const deliveryPackagePopulationCount=delivery.packageRows.length;
  const workfrontPopulationCount=delivery.records.filter(r=>r.kind==='workfront').length;
  // A record in one domain cannot establish coverage in another. Counts below
  // describe the supplied/reviewed populations, not whole-programme feasibility.
  const unlinkedFeasibilityRowCount=(feasibility?.rows??[]).filter(row=>!row.activityId).length;
  const feasibilityPopulationComplete=feasibilitySourceRowCount>0&&unlinkedFeasibilityRowCount===0;
  const crewAssessmentComplete=feasibilityPopulationComplete&&unresolvedChecks.length===0;
  const packageTimingAssessed=delivery.packageRows.filter(p=>p.overdueUndelivered||p.forecastLate||p.deliveredAtDataDate||
    !!dataDateIso&&!p.deliveredStatusOnly&&!p.deliveryDateConflict&&!!p.needDate&&p.headroomCalendarDays!==null&&
    (p.needDate.slice(0,10)>=dataDateIso.slice(0,10)||!!p.sourceStatus||!!p.actualDelivery));
  const packageAssessmentComplete=delivery.populations.package?.state==='established'&&packageTimingAssessed.length===deliveryPackagePopulationCount;
  const reviewedWorkfronts=delivery.records.filter(r=>r.kind==='workfront'&&['governed','verified'].includes(r.state));
  const permissionAssessed=reviewedWorkfronts.filter(r=>['yes','true','permitted','allowed','no','false','not permitted','not allowed'].includes(String(r.fields['resequencing permitted']??r.fields['parallel execution permitted']??'').trim().toLowerCase()));
  const workfrontAssessmentComplete=delivery.populations.workfront?.state==='established'&&permissionAssessed.length===delivery.populations.workfront.denominator;
  const supportingBasisAvailable=
    feasibilitySourceRowCount>0||
    deliveryPackagePopulationCount>0||
    workfrontPopulationCount>0||delivery.populations.package?.state==='established'||delivery.populations.workfront?.state==='established';
  const actualEligibilityChecksPerformed=
    feasibilityChecks.length+
    packageTimingAssessed.length+
    permissionAssessed.length;
  const eligibility={
    activityFeasibilityCheckCount:feasibilityPopulationComplete?feasibilityChecks.length:null,
    knownActivityFeasibilityCheckCount:feasibilityChecks.length,
    crewAccelerationCandidateCount:crewAssessmentComplete?crewEligibleChecks.length:null,
    knownCrewAccelerationCandidateCount:crewEligibleChecks.length,
    lateProcurementPackageCount:packageAssessmentComplete?latePackages.length:null,
    knownLateProcurementPackageCount:latePackages.length,
    unresolvedFeasibilityCheckCount:feasibilityPopulationComplete?unresolvedChecks.length:null,
    knownUnresolvedFeasibilityCheckCount:unresolvedChecks.length,
    governedResequencingWorkfrontCount:workfrontAssessmentComplete?governedResequencingWorkfronts.length:null,
    knownGovernedResequencingWorkfrontCount:governedResequencingWorkfronts.length,
    unlinkedFeasibilityRowCount,
    coverage:{feasibilityPopulationComplete,crewAssessmentComplete,packageAssessmentComplete,workfrontAssessmentComplete},
    feasibilitySourceRowCount,
    deliveryPackagePopulationCount,
    workfrontPopulationCount,
    supportingBasisAvailable,
    actualEligibilityChecksPerformed:supportingBasisAvailable?actualEligibilityChecksPerformed:null,
  };
  // F29: crew candidates from the data held, kept apart from the scenarios so
  // every existing count and figure above is unchanged.
  const heldDataCandidates=heldDataCrewCandidates({scenarios,drivingNetworkEstablished:!!drivingNetwork,drivingOpen,
    tradeChains:programme?tradeChainResourcesForState(state):null,resources,
    productivityActivityIds:new Set(feasibilityChecks.filter(check=>typeof check.requiredLaborHours==='number').map(check=>check.activityId)),
    calculatedNeedCount:crewEligibleChecks.length});
  const scenarioState=calculated.length?'calculated_options_available':recoveryOptions.length?'options_need_assumptions':'no_eligible_recovery_basis';
  const eligibilityAssessmentState=
    calculated.length
      ? 'calculated_options_available'
      : recoveryOptions.length
        ? 'candidates_need_assumptions'
        : scenarios.length
          ? 'no_completion_path_option'
        : !supportingBasisAvailable
          ? 'supporting_basis_absent'
          : !crewAssessmentComplete||!packageAssessmentComplete||!workfrontAssessmentComplete
            ? 'supporting_basis_incomplete'
            : 'checked_no_eligible_basis';
  const managementPosition=max
    ? 'The strongest CPM-calculated recovery option is '+max.subject+': in the CMeng CPM run the project finish moves '+max.completionGainWorkingDays+' '+countUnit(max.completionGainWorkingDays,'working days')+' earlier under the stated scenario assumptions. This is not an approved Project plan.'+lateWorkNote
    : recoveryOptions.length
      ? 'Recovery options on the path to completion exist, but their completion gain is not established by a CMeng CPM run without additional assumptions.'+(unresolvedChecks.length?' '+unresolvedChecks.length+' linked feasibility check(s) need a quantified working-time, productivity or resource basis.':'')+(unlinkedFeasibilityRowCount?' '+unlinkedFeasibilityRowCount+' source item(s) still need activity links before their feasibility can be checked.':!feasibilityPopulationComplete?' Activity feasibility coverage is not established.':'')+lateWorkNote
    : scenarios.length
      ? 'No recovery option on the CPM path to completion is established.'+lateWorkNote+(completionPath.pathNotEstablishedCount?' '+completionPath.pathNotEstablishedCount+' item(s) have no established path to completion.':'')
      : !supportingBasisAvailable
        ? 'No supporting recovery basis is established. Supply current quantity/productivity/resource evidence and applicable procurement/workfront records or confirm their absence through the existing register review.'
        : 'No eligible scenario has been established from the available evidence. '+feasibilityChecks.length+' linked activity feasibility position(s), '+packageTimingAssessed.length+' package timing position(s) and '+permissionAssessed.length+' explicit governed workfront permission(s) were checked.'+(!crewAssessmentComplete||!packageAssessmentComplete||!workfrontAssessmentComplete?' Eligibility remains incomplete; missing domains and unresolved inputs are not assessed zeros.':' No eligible scenario basis was found in these checked records.');
  return {schemaVersion:'1.0',projectionKey:'recovery_acceleration',projectId:state.projectId,projectVersion:state.version,dataDateIso,programmeRevisionId:programme?.sourceRevisionId??null,scenarios,recoveryTargets,drivingChainShortfall,
    calculatedScenarioCount:calculated.length,assumptionRequiredCount:recoveryOptions.length-calculated.length,scenarioState,eligibility,
    recoveryOptionCount:completionPath.recoveryOptionCount,lateWorkCount:completionPath.lateWorkCount,pathNotEstablishedCount:completionPath.pathNotEstablishedCount,
    eligibilityAssessmentState,
    heldDataCandidates,
    managementPosition,
    basis:'Scenarios use existing BOQ/productivity/resource feasibility, source calendars, resource costs where fully supported, governed workfront permissions and package need-date calculations. They never replace the current programme, do not assert entitlement, and retain local-effect versus Project-completion effect separately.'};
}
export function recoveryAccelerationModule(state:ProjectRuntimeState):ModuleRuntimeResult{
  const data=recoveryAccelerationIntelligence(state),hasProjectEvidence=Boolean(projectControlSchedule(state)||state.boqRevisions.length||state.evidenceDocuments.length);
  return {key:'recovery-acceleration',status:data.scenarios.length||hasProjectEvidence?'partial':'blocked',reason:data.managementPosition,dependencies:data.scenarios.length?[]:['remaining quantity/productivity/resource or late-package evidence'],data};
}
