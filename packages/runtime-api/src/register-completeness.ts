import type {DeliveryKind} from '../../delivery-core/src/types';
import type {ProjectRuntimeState} from './project-state-types';
import {deliveryRecords,deliveryStore,deliveryPopulationPosition} from './delivery-records';
import {operationalReporting} from './reporting-state';
import {createHash} from 'node:crypto';

/** M4.3 (with K2): the one register completeness rule. Readable current records
 * give available counts at once, qualified with this note. A register is a
 * confirmed complete denominator only when its Delivery population is
 * confirmed (the one confirmation every page reads). */
export const REGISTER_NOT_CONFIRMED_NOTE='Available records; the register is not confirmed complete.';
export type RegisterCompleteness={state:'established'|'not_established';note:string|null};

const cache=new WeakMap<object,{version:number;delivery:object;value:Map<DeliveryKind,RegisterCompleteness>}>();
/** Whether the register of this Delivery kind is confirmed complete. */
export function registerCompleteness(state:ProjectRuntimeState,kind:DeliveryKind):RegisterCompleteness{
  const source=deliveryRecords(state);
  let entry=cache.get(state);
  if(!entry||entry.version!==state.version||entry.delivery!==source){entry={version:state.version,delivery:source,value:new Map()};cache.set(state,entry);}
  const hit=entry.value.get(kind);if(hit)return hit;
  const store=deliveryStore(state);
  const scope=source.records.filter(r=>r.kind===kind);
  const decision=[...store.populations].reverse().find(p=>p.kind===kind&&!p.scopeId);
  const established=scope.length>0&&deliveryPopulationPosition(kind,null,scope,source.documents,decision as any).state==='established';
  const value:RegisterCompleteness={state:established?'established':'not_established',note:established?null:REGISTER_NOT_CONFIRMED_NOTE};
  entry.value.set(kind,value);return value;
}

/** The Project Review decision that confirms the risk register complete. */
export const RISK_COMPLETE_DECISION_KEY='risk-register-complete';
/** The current risk population the confirmation is bound to: a changed risk set needs a new confirmation. */
export function riskPopulationFingerprint(state:ProjectRuntimeState):string{
  const risk=operationalReporting(state).risk as {current:Array<{riskId:string;status:string}>;sourceRecordCount:number};
  return createHash('sha256').update(JSON.stringify(['risk-population-v1',risk.sourceRecordCount,risk.current.map(r=>[r.riskId,r.status]).sort()])).digest('hex').slice(0,24);
}
/** M4.3 for the risk register (not a Delivery kind): the same rule, confirmed through Project Review. */
export function riskRegisterCompleteness(state:ProjectRuntimeState):RegisterCompleteness{
  const saved=state.controls?.reviewDecisions?.[RISK_COMPLETE_DECISION_KEY] as {choice?:string;sourceFingerprint?:string}|undefined;
  const established=!!saved&&saved.choice==='confirm_complete'&&saved.sourceFingerprint===riskPopulationFingerprint(state);
  return {state:established?'established':'not_established',note:established?null:REGISTER_NOT_CONFIRMED_NOTE};
}
