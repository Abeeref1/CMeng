import type {DeliveryKind} from '../../delivery-core/src/types';
import type {ProjectRuntimeState} from './project-state-types';
import {deliveryRecords,deliveryStore,deliveryPopulationPosition} from './delivery-records';

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
