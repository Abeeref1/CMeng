import {schedulePlanPositions} from '../../progress-scurve/src/projector';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';

/** Reuse a complete source/Data-Date calculation between Delivery workfronts
 * and Progress Breakdown, which consume the same full programme and baseline.
 * The cache is tied to the provided reporting state and its version, not to
 * project name or a global source label. Different baselines never share.
 * No source text, rows, owner decision or calculation authority is modified.
 */
const positionsByState=new WeakMap<ProjectRuntimeState,{
  version:number;
  current:CanonicalScheduleModel;
  baseline:CanonicalScheduleModel|null;
  result:ReturnType<typeof schedulePlanPositions>;
}>();

export function sharedProjectPlanPositions(
 state:ProjectRuntimeState,
 current:CanonicalScheduleModel,
 baseline:CanonicalScheduleModel|null,
):ReturnType<typeof schedulePlanPositions>{
 const cached=positionsByState.get(state);
 if(cached&&cached.version===state.version&&cached.current===current&&cached.baseline===baseline)
  return cached.result;
 const result=schedulePlanPositions(current,baseline);
 positionsByState.set(state,{version:state.version,current,baseline,result});
 return result;
}
