import type {ProjectRuntimeState} from './project-state-types';
import {commercialPositionForState} from './commercial-runtime';

type Metric<T>={value:T|null};
export interface ContractTimeDates{
  contractualCompletionIso:string|null;
  extendedCompletionIso:string|null;
  awardedEotDays:number|null;
  /** The date lateness and delay damages are measured against: contract plus
   * awarded EOT; the contract date only when no EOT is awarded; unknown when an
   * award exists but the extended date is not established. */
  governingCompletionIso:string|null;
}

/** F33: the one shared reader of the contract time basis (canonical contract
 * completion plus approved EOT) used by every page, chart and calculation. */
export function contractTimeDatesFrom(time:{contractualCompletion:Metric<string>;approvedEotDays:Metric<number>;officialAdjustedCompletion:Metric<string>}):ContractTimeDates{
  const contractual=time.contractualCompletion.value,extended=time.officialAdjustedCompletion.value,award=time.approvedEotDays.value;
  return {contractualCompletionIso:contractual,extendedCompletionIso:extended,awardedEotDays:award,
    governingCompletionIso:extended??(award!==null&&award>0?null:contractual)};
}

export function contractTimeDates(state:ProjectRuntimeState):ContractTimeDates{
  return contractTimeDatesFrom(commercialPositionForState(state).timeExposure);
}
