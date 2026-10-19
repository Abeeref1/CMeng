import {calculateCpm} from '../../schedule-cpm/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ContractLdTerms} from '../../contract-commercial/src';
import {buildLdScenario} from '../../project-director/src/projector';

type MoneyValue={amount:number;currency:string;sourceRefs:string[]};

/** F44: the pending EOT scenario. If every pending assessed day is awarded,
 * the governing contract completion (contract + awarded EOT, the shared reader)
 * moves by those calendar days. The CMeng CPM is then run on the current
 * programme with that date as the required finish: its late pass gives the
 * completion float against the scenario date, and its finish gives the days
 * late and the delay-damages effect. When the CPM forecast cannot be published,
 * only the moved contract date is given, labelled as date arithmetic. */
export interface PendingEotScenario {
  method:'cmeng_cpm'|'date_arithmetic_fallback'|'unavailable';
  pendingCount:number;
  pendingAssessedDays:number|null;
  governingCompletionIso:string|null;
  scenarioContractCompletionIso:string|null;
  cpmCompletionIso:string|null;
  completionActivityIds:string[];
  completionFloatHoursAgainstScenario:number|null;
  currentDaysLate:number|null;
  scenarioDaysLate:number|null;
  delayDamages:{state:'calculated'|'not_calculable';currency:string|null;currentAmount:number|null;scenarioAmount:number|null;effectAmount:number|null;diagnostics:string[]};
  missingInputs:string[];
  basis:string;
  diagnostics:string[];
}

const dateOnly=(iso:string|null|undefined)=>typeof iso==='string'&&/^\d{4}-\d{2}-\d{2}/.test(iso)?iso.slice(0,10):null;
const calendarDays=(from:string|null,to:string|null)=>from&&to?Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000):null;

export function pendingEotScenario(input:{
  model:CanonicalScheduleModel|null;
  cpmPublishable:boolean;
  governingCompletionIso:string|null;
  pendingCount:number;
  pendingAssessedDays:number|null;
  ldTerms:ContractLdTerms|null;
  contractValue?:MoneyValue;
}):PendingEotScenario|null{
  if(input.pendingCount<=0)return null;
  const governing=dateOnly(input.governingCompletionIso);
  const missingInputs=[governing===null?'Governing contract completion (contract plus awarded EOT)':null,
    input.pendingAssessedDays===null?'Assessed days for every pending claim':null].filter((s):s is string=>s!==null);
  const emptyLd={state:'not_calculable' as const,currency:null,currentAmount:null,scenarioAmount:null,effectAmount:null,diagnostics:[] as string[]};
  const base={pendingCount:input.pendingCount,pendingAssessedDays:input.pendingAssessedDays,governingCompletionIso:governing,
    cpmCompletionIso:null,completionActivityIds:[] as string[],completionFloatHoursAgainstScenario:null,currentDaysLate:null,scenarioDaysLate:null,delayDamages:emptyLd};
  if(missingInputs.length)return {...base,method:'unavailable',scenarioContractCompletionIso:null,missingInputs,
    basis:'The pending EOT scenario needs the governing contract completion and an assessed day count for every pending claim.',diagnostics:['PENDING_EOT_SCENARIO_INPUT_MISSING']};
  // Awarded EOT is counted in calendar days on the contract completion date.
  const scenarioDate=new Date(Date.parse(governing+'T00:00:00Z')+input.pendingAssessedDays!*86400000).toISOString().slice(0,10);
  const fallback=(reason:string,diagnostic:string):PendingEotScenario=>({...base,method:'date_arithmetic_fallback',scenarioContractCompletionIso:scenarioDate,missingInputs:[],
    basis:'Date arithmetic only: governing contract completion plus every pending assessed day, assuming no overlap or duplicate days. '+reason+' No completion lateness or delay-damages effect is concluded.',diagnostics:[diagnostic]});
  if(!input.model||!input.cpmPublishable)return fallback('The CMeng CPM forecast cannot be published for this programme.','PENDING_EOT_CPM_FORECAST_NOT_PUBLISHABLE');
  // The required finish is the scenario date at the start of that day: the same
  // calendar-date convention every page uses for days late (finish date minus
  // contract date), so the CPM float and the day count agree.
  const model=input.model;
  const cpm=(()=>{try{return calculateCpm(model,{durationBasis:'remaining',requiredFinishIso:scenarioDate+'T00:00:00Z'});}catch{return null;}})();
  if(!cpm)return fallback('The CMeng CPM could not be run on this programme.','PENDING_EOT_CPM_FAILED');
  const finish=dateOnly(cpm.projectFinishIso);
  if(!cpm.complete||finish===null)return fallback('The CMeng CPM did not resolve the full network.','PENDING_EOT_CPM_INCOMPLETE');
  const finishIds=cpm.drivingNetwork?.finishActivityIds?.length?cpm.drivingNetwork.finishActivityIds:cpm.activities.filter(a=>a.earlyFinishIso===cpm.projectFinishIso).map(a=>a.activityId);
  const floats=cpm.activities.filter(a=>finishIds.includes(a.activityId)&&typeof a.totalFloatHours==='number').map(a=>a.totalFloatHours as number);
  const currentDaysLate=calendarDays(governing,finish),scenarioDaysLate=calendarDays(scenarioDate,finish);
  let delayDamages:PendingEotScenario['delayDamages']={...emptyLd,diagnostics:['LD_SCENARIO_REQUIRES_RATE']};
  if(input.ldTerms){
    const current=buildLdScenario(input.ldTerms,Math.max(0,currentDaysLate!),input.contractValue);
    const scenario=buildLdScenario(input.ldTerms,Math.max(0,scenarioDaysLate!),input.contractValue);
    const amount=(r:typeof current)=>r.state==='scenario_candidate'?r.cappedAmount:null;
    const a=amount(current),b=amount(scenario);
    const same=a!==null&&b!==null&&current.currency===scenario.currency;
    delayDamages={state:same?'calculated':'not_calculable',currency:same?current.currency:null,currentAmount:same?a:null,scenarioAmount:same?b:null,
      effectAmount:same?Number((a!-b!).toFixed(6)):null,
      diagnostics:[...new Set([...current.diagnostics,...scenario.diagnostics,...(current.state==='multi_scenario'||scenario.state==='multi_scenario'?['LD_MULTIPLE_RATE_OR_CAP_SCENARIOS_DECISION_REQUIRED']:[])])]};
  }
  return {...base,method:'cmeng_cpm',scenarioContractCompletionIso:scenarioDate,cpmCompletionIso:finish,completionActivityIds:[...finishIds].sort(),
    completionFloatHoursAgainstScenario:floats.length?Math.min(...floats):null,currentDaysLate,scenarioDaysLate,delayDamages,missingInputs:[],
    basis:'CMeng CPM on the current programme with the scenario contract completion as the required finish (late pass). Scenario date = governing contract completion plus every pending assessed day in calendar days, assuming no overlap or duplicate days. Days late compare calendar dates. Delay damages use the contract rate and cap on the days late; a scenario, not an award or a determination.',
    diagnostics:[]};
}
